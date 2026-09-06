import { Restty } from "../vendor/restty/internal.js";
import type {
  ResttyFontSource,
  ResttySnapshotReader
} from "../vendor/restty/internal.js";
import type {
  TerminalDataPlaneAttachment,
  TerminalInputOutcome,
  TerminalModes,
  TerminalOutput,
  TerminalRendererAdapter,
  TerminalSnapshotReader,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";
import { createRendererWriteObserver } from "./terminal";
import { BotsterTerminalPtyTransport, looksLikeResttyFocusReport } from "./botsterTerminalPtyTransport";
import type { TerminalGrid } from "./terminalGrid";
import {
  installTerminalInputCapture,
  noMouseCapture,
  type TerminalInputCapture,
  type TerminalMouseCapturePolicy
} from "./terminalInputCapture";
import type { TerminalCellGeometry } from "./terminalInputEvents";
import { mouseCapturePolicyFromModes } from "./mouseMode";

const botsterResttyFontSources: ResttyFontSource[] = [
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf",
    label: "JetBrains Mono Nerd Font Regular"
  }
];

/**
 * Restty as a render-only terminal model.
 *
 * Output bytes and GHOSTSNP snapshots feed Restty's terminal state and paint. Every user
 * gesture is captured at the container and sent to the data plane as semantic input; the
 * worker's Ghostty encoder produces the PTY bytes. Restty's own encoders still run for its
 * local behavior but their bytes stop at the PTY transport sink. Authoritative MODES frames
 * drive mouse capture and keep Restty's local mouse tracking state in step.
 */
export class ResttyTerminalRenderer implements TerminalRendererAdapter {
  private readonly ptyTransport = new BotsterTerminalPtyTransport({
    record: recordLiveHarnessTerminal,
    onUncapturedInput: (source, data) => this.reportUncapturedResttyInput(source, data)
  });
  private readonly inputOutcomeListeners = new Set<(outcome: TerminalInputOutcome) => void>();
  private terminal?: Restty;
  private container?: HTMLElement;
  private inputCapture?: TerminalInputCapture;
  private uninstallPaletteProbe?: () => void;
  private modesSubscription?: TerminalSubscription;
  private outcomeSubscription?: TerminalSubscription;
  private mousePolicy: TerminalMouseCapturePolicy = noMouseCapture;
  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.ptyTransport.setRenderObserver(createRendererWriteObserver(this.descriptor.sessionId));
    this.inputCapture = installTerminalInputCapture({
      container,
      sink: (input) => {
        if (!this.ptyTransport.sendSemantic(input)) {
          recordLiveHarnessTerminal("input_dropped_unattached", { kind: input.kind, sessionId: this.descriptor.sessionId });
        }
      },
      onPaste: (text, source) => {
        void this.routePaste(text, source);
      },
      geometry: () => this.canvasGeometry(),
      mousePolicy: () => this.mousePolicy,
      record: (kind, payload) => recordLiveHarnessTerminal(kind, { ...(payload as object), sessionId: this.descriptor.sessionId })
    });

    this.terminal = new Restty({
      root: container,
      createInitialPane: { focus: false },
      fontSources: botsterResttyFontSources,
      // Restty's default context menu keeps every item; only its Paste action is redirected
      // to the explicit paste owner through the pane app's paste entry point.
      onPaneCreated: (pane) => this.installContextMenuPasteOwner(pane),
      appOptions: {
        // Pure renderer: the session owns PTY queries including OSC color replies.
        readOnly: true,
        ptyTransport: this.ptyTransport,
        // Restty's own key, IME, paste, and focus encodings are render-only: the container
        // capture already reported the gesture. A source the capture does not cover is
        // reported to the user rather than dropped in silence.
        beforeInput: ({ text, source }) => {
          if (source === "key" || source === "paste" || source === "ime") return null;
          if (source === "program" && looksLikeResttyFocusReport(text)) return null;
          this.reportUncapturedResttyInput(source, text);
          return null;
        }
      }
    });
    this.installPaletteProbe();
  }

  async loadBinarySnapshot(data: Uint8Array): Promise<boolean> {
    const terminal = this.terminal as Restty & {
      loadBinarySnapshot?: (bytes: Uint8Array) => boolean;
    } | undefined;
    if (!terminal?.loadBinarySnapshot) {
      recordLiveHarnessTerminal("ghostsnp_install_failed", {
        reason: "restty_loadBinarySnapshot_missing",
        sessionId: this.descriptor.sessionId
      });
      return false;
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    // Pane construction starts Restty init without awaiting. Snapshot import requires
    // wasmReady + wasmHandle; wait for readiness rather than re-entering init().
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const ok = await this.ptyTransport.installSnapshot(
          () => terminal.loadBinarySnapshot(bytes),
          (grid) => this.applyGridToRestty(grid)
        );
        if (ok) {
          recordLiveHarnessTerminal("restty_load_binary_snapshot", {
            ok: true,
            bytes: bytes.byteLength,
            attempt,
            sessionId: this.descriptor.sessionId
          });
          return true;
        }
      } catch (error: unknown) {
        recordLiveHarnessTerminal("restty_load_binary_snapshot_error", {
          attempt,
          message: error instanceof Error ? error.message : String(error),
          sessionId: this.descriptor.sessionId
        });
      }
      await delay(50);
    }

    recordLiveHarnessTerminal("restty_load_binary_snapshot", {
      ok: false,
      bytes: bytes.byteLength,
      sessionId: this.descriptor.sessionId
    });
    return false;
  }

  attachDataPlane(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
    this.releaseDataPlaneSubscriptions();
    this.inputCapture?.resetWheel();
    this.mousePolicy = noMouseCapture;
    dataPlane.bindIncrementalSnapshotReader?.(() => this.createIncrementalSnapshotReader());
    const subscription = this.ptyTransport.attach(dataPlane);
    this.modesSubscription = dataPlane.subscribeModes?.((modes) => this.applyModes(modes));
    this.outcomeSubscription = dataPlane.subscribeInputOutcomes?.((outcome) => this.publishInputOutcome(outcome));
    this.terminal?.connectPty();
    return {
      unsubscribe: () => {
        this.releaseDataPlaneSubscriptions();
        subscription.unsubscribe();
      }
    };
  }

  private releaseDataPlaneSubscriptions(): void {
    this.modesSubscription?.unsubscribe();
    this.modesSubscription = undefined;
    this.outcomeSubscription?.unsubscribe();
    this.outcomeSubscription = undefined;
  }

  /**
   * Authoritative modes drive the mouse capture policy for the container listeners. Restty
   * keeps its own local tracking state from the same output bytes and snapshot import for
   * selection versus application-mouse routing; it does not expose a rehydrate entry point.
   */
  private applyModes(modes: TerminalModes): void {
    const previous = this.mousePolicy;
    this.mousePolicy = mouseCapturePolicyFromModes(modes);
    if (previous.tracking !== this.mousePolicy.tracking) {
      this.inputCapture?.resetWheel();
    }
    recordLiveHarnessTerminal("modes_applied", {
      mode_bits: modes.modeBits,
      rows: modes.rows,
      cols: modes.cols,
      mouse_tracking: this.mousePolicy.tracking,
      sessionId: this.descriptor.sessionId
    });
  }

  private createIncrementalSnapshotReader(): TerminalSnapshotReader {
    let reader: ResttySnapshotReader | undefined;
    let firstFrame = true;
    let cancelled = false;
    const acquireReader = async (): Promise<ResttySnapshotReader> => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (cancelled) throw new Error("Restty incremental snapshot reader was cancelled.");
        const candidate = this.terminal?.createBinarySnapshotReader();
        if (candidate) return candidate;
        await delay(50);
      }
      throw new Error("Restty incremental snapshot reader is unavailable.");
    };

    return {
      read: async (bytes) => {
        if (!reader) {
          const acquired = await acquireReader();
          if (cancelled) {
            acquired.cancel();
            throw new Error("Restty incremental snapshot reader was cancelled.");
          }
          reader = acquired;
        }
        const result = firstFrame ? reader.ready(bytes) : reader.next(bytes);
        if (result.status === "error") {
          throw new Error(`Restty rejected an incremental snapshot frame: ${result.error}`);
        }
        firstFrame = false;
        if (result.status === "ready") {
          this.ptyTransport.currentGrid();
        }
        recordLiveHarnessTerminal("restty_incremental_snapshot", {
          bytes: bytes.byteLength,
          status: result.status,
          sessionId: this.descriptor.sessionId
        });
        return result.status;
      },
      cancel: () => {
        cancelled = true;
        reader?.cancel();
      }
    };
  }

  write(data: TerminalOutput): void {
    this.ptyTransport.deliverOutput(data);
  }

  resize(rows: number, columns: number): void {
    const current = this.ptyTransport.currentGrid();
    if (!this.ptyTransport.resize(columns, rows, { widthPx: current?.widthPx, heightPx: current?.heightPx })) return;
    const grid = this.ptyTransport.currentGrid();
    if (grid) {
      this.applyGridToRestty(grid);
    }
  }

  focus(): void {
    this.terminal?.focus();
  }

  destroy(): void {
    this.releaseDataPlaneSubscriptions();
    this.inputCapture?.uninstall();
    this.inputCapture = undefined;
    this.uninstallPaletteProbe?.();
    this.uninstallPaletteProbe = undefined;
    this.ptyTransport.destroy();
    this.inputOutcomeListeners.clear();
    this.terminal?.destroy();
    this.terminal = undefined;
    this.container = undefined;
  }

  private livePaneGrid(): { cols: number; rows: number } {
    const pane = this.terminal?.activePane?.() as
      | {
          cols?: number;
          rows?: number;
          getCols?: () => number;
          getRows?: () => number;
        }
      | null
      | undefined;
    const measuredGrid = this.ptyTransport.currentGrid();
    const cols =
      (typeof pane?.getCols === "function" ? pane.getCols() : undefined) ??
      (typeof pane?.cols === "number" ? pane.cols : undefined) ??
      measuredGrid?.columns ??
      80;
    const rows =
      (typeof pane?.getRows === "function" ? pane.getRows() : undefined) ??
      (typeof pane?.rows === "number" ? pane.rows : undefined) ??
      measuredGrid?.rows ??
      24;
    return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
  }

  /** Mounted canvas rectangle, grid, and backing-store scale for pointer mapping. */
  private canvasGeometry(): TerminalCellGeometry | undefined {
    const canvas = this.container?.querySelector?.("canvas");
    const rect = canvas?.getBoundingClientRect?.();
    if (!canvas || !rect || rect.width <= 0 || rect.height <= 0) return undefined;
    const { cols, rows } = this.livePaneGrid();
    return {
      cols,
      rows,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      scaleX: canvas.width > 0 ? canvas.width / rect.width : 1,
      scaleY: canvas.height > 0 ? canvas.height / rect.height : 1
    };
  }

  private installPaletteProbe(): void {
    if (typeof window === "undefined") return;
    const harnessWindow = window as typeof window & {
      __BOTSTER_RESTTY_DEBUG__?: {
        getPaletteColor?: (index: number) => number | null;
        active?: { getPaletteColor?: (index: number) => number | null };
      };
    };
    const getPaletteColor = (index: number): number | null => {
      const pane = this.terminal?.activePane?.() as { getPaletteColor?: (i: number) => number | null } | null;
      if (typeof pane?.getPaletteColor === "function") {
        return pane.getPaletteColor(index);
      }
      return null;
    };
    harnessWindow.__BOTSTER_RESTTY_DEBUG__ = {
      getPaletteColor,
      active: { getPaletteColor }
    };
    this.uninstallPaletteProbe = () => {
      if (harnessWindow.__BOTSTER_RESTTY_DEBUG__?.getPaletteColor === getPaletteColor) {
        delete harnessWindow.__BOTSTER_RESTTY_DEBUG__;
      }
    };
  }

  private applyGridToRestty(grid: TerminalGrid): void {
    this.terminal?.resize(grid.columns, grid.rows);
  }

  onInputOutcome(listener: (outcome: TerminalInputOutcome) => void): TerminalSubscription {
    this.inputOutcomeListeners.add(listener);
    return {
      unsubscribe: () => {
        this.inputOutcomeListeners.delete(listener);
      }
    };
  }

  private async routePaste(text: string, source: string): Promise<TerminalInputOutcome> {
    const outcome = await this.ptyTransport.writePaste(text);
    recordLiveHarnessTerminal("paste_routed", { source, ...outcome, sessionId: this.descriptor.sessionId });
    this.publishInputOutcome(outcome);
    return outcome;
  }

  /**
   * Restty's context-menu Paste item calls pane.app.pasteFromClipboard(), which would
   * format and submit the text as key input. Redirect that one entry point to the explicit
   * paste owner; every other menu item stays as shipped. The clipboard is read exactly
   * once: an empty read is inert, and a failed read is reported as an explicit outcome.
   */
  private installContextMenuPasteOwner(pane: { app?: { pasteFromClipboard?: () => Promise<boolean> } }): void {
    const app = pane.app;
    if (!app || typeof app.pasteFromClipboard !== "function") return;
    app.pasteFromClipboard = async () => {
      let text: string;
      try {
        text = await navigator.clipboard.readText();
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        recordLiveHarnessTerminal("clipboard_read_failed", { message: detail, sessionId: this.descriptor.sessionId });
        this.publishInputOutcome({
          kind: "paste",
          outcome: "rejected_locally",
          reason: "clipboard_unavailable",
          detail: `Clipboard could not be read: ${detail}`
        });
        return false;
      }
      if (!text) {
        recordLiveHarnessTerminal("clipboard_paste_empty", { source: "context_menu", sessionId: this.descriptor.sessionId });
        return false;
      }
      recordLiveHarnessTerminal("clipboard_paste", {
        source: "context_menu",
        chars: text.length,
        sessionId: this.descriptor.sessionId
      });
      const outcome = await this.routePaste(text, "context_menu");
      return outcome.outcome === "written";
    };
  }

  /** Restty produced input the capture does not cover; the user sees the gap as an outcome. */
  private reportUncapturedResttyInput(source: string, data: string): void {
    recordLiveHarnessTerminal("restty_input_uncaptured", {
      source,
      bytes: data.length,
      sessionId: this.descriptor.sessionId
    });
    this.publishInputOutcome({
      kind: "raw",
      outcome: "rejected_locally",
      requestedBytes: data.length,
      reason: "uncaptured_restty_input",
      detail: `Restty produced ${data.length} bytes of ${source} input that the terminal does not capture; nothing was sent.`
    });
  }

  private publishInputOutcome(outcome: TerminalInputOutcome): void {
    for (const listener of this.inputOutcomeListeners) {
      listener(outcome);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function recordLiveHarnessTerminal(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      terminal?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.terminal?.push({ kind, payload });
}

export function createResttyTerminalRenderer(
  descriptor: TerminalViewDescriptor
): TerminalRendererAdapter {
  return new ResttyTerminalRenderer(descriptor);
}
