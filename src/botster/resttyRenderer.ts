import { createInputHandler, Restty } from "../vendor/restty/internal.js";
import type {
  ResttyFontSource,
  ResttySnapshotReader
} from "../vendor/restty/internal.js";
import type {
  ModeDependentTerminalInput,
  TerminalDataPlaneAttachment,
  TerminalInput,
  TerminalOutput,
  TerminalRendererAdapter,
  TerminalSnapshotReader,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";
import { bytesToBase64 } from "./hubTerminalDataPlane";
import type { DaemonModeFlags } from "./realHubDaemonDto";
import { BotsterTerminalPtyTransport } from "./botsterTerminalPtyTransport";
import type { TerminalGrid } from "./terminalGrid";
import {
  coreMouseTrackingEnabled,
  mouseTrackingBitsFromCoreMode
} from "./mouseMode";
import {
  encodeWheelDecision,
  MountScopedWheelReencoder,
  shouldRouteWheelToAppMouse,
  unmatchedWheelBytesShouldDrop,
  type WheelDecision
} from "./mountScopedWheelReencoder";

export {
  CORE_MOUSE_NORMAL,
  CORE_MOUSE_ANY,
  CORE_MOUSE_BUTTON,
  CORE_MOUSE_SGR,
  coreMouseTrackingEnabled,
  mouseTrackingBitsFromCoreMode
} from "./mouseMode";

const botsterResttyFontSources: ResttyFontSource[] = [
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf",
    label: "JetBrains Mono Nerd Font Regular"
  }
];

/**
 * Kitty flag used when Hub reports kitty_enabled without bit-level detail.
 * DisambiguateEscapeCodes (0x1) is the common baseline for protocol-enabled sessions.
 */
const kittyEnabledBaselineFlags = 0x1;

type MouseReportKind = "down" | "up" | "move" | "wheel";

type PendingSemanticInput =
  | { kind: "key"; event: KeyboardEvent }
  | { kind: "mouse"; event: PointerEvent | WheelEvent; reportKind: MouseReportKind }
  | { kind: "bytes"; data: string };

export class ResttyTerminalRenderer implements TerminalRendererAdapter {
  private readonly ptyTransport = new BotsterTerminalPtyTransport({
    createModeDependentInput: (data) => this.createModeDependentInput(data),
    record: recordLiveHarnessTerminal
  });
  private readonly inputListeners = new Set<(data: TerminalInput) => void>();
  private terminal?: Restty;
  private container?: HTMLElement;
  private pendingSemantic: PendingSemanticInput | undefined;
  private removeDomListeners?: () => void;
  private uninstallPaletteProbe?: () => void;
  private wheelAlive = true;
  private readonly wheelReencoder = new MountScopedWheelReencoder({
    isCurrent: () => this.wheelAlive,
    onDrain: (decision) => this.sendWheelDecision(decision)
  });
  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.ptyTransport.setRenderObserver((data) => {
      if (this.container?.dataset) {
        this.container.dataset.terminalLastRenderedOutput = bytesToBase64(data);
      }
      const harness = (globalThis as typeof globalThis & {
        __BOTSTER_LIVE_PROTOCOL_HARNESS__?: { suppressRendererWriteTelemetry?: boolean };
      }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
      if (!harness?.suppressRendererWriteTelemetry) {
        recordLiveHarnessTerminal("renderer_write", {
          payload_bytes_base64: bytesToBase64(data),
          bytes: data.byteLength,
          sessionId: this.descriptor.sessionId
        });
      }
    });
    const onKeyDown = (event: KeyboardEvent) => {
      // One-shot keyboard semantic; cleared when sendInput consumes it.
      this.pendingSemantic = { kind: "key", event };
    };
    const onPointerDown = (event: PointerEvent) => {
      this.pendingSemantic = { kind: "mouse", event, reportKind: "down" };
    };
    const onPointerUp = (event: PointerEvent) => {
      this.pendingSemantic = { kind: "mouse", event, reportKind: "up" };
    };
    const onPointerMove = (event: PointerEvent) => {
      // Only track motion when buttons are down or Restty is in any-motion mode;
      // still retain the event so a subsequent sendInput is not a stale key.
      if (event.buttons !== 0) {
        this.pendingSemantic = { kind: "mouse", event, reportKind: "move" };
      }
    };
    const onWheel = (event: WheelEvent) => {
      const decision = this.wheelReencoder.consumeWheelEvent(event, {
        cellHeight: this.liveCellHeight(),
        rows: this.liveRows(),
        cell: this.positionToCell(event),
        applicationMouseActive: shouldRouteWheelToAppMouse(event, this.applicationMouseTrackingActive())
      });
      if (decision && decision.steps > 0) {
        this.sendWheelDecision(decision);
      }
    };

    container.addEventListener("keydown", onKeyDown, true);
    container.addEventListener("pointerdown", onPointerDown, true);
    container.addEventListener("pointerup", onPointerUp, true);
    container.addEventListener("pointermove", onPointerMove, true);
    container.addEventListener("wheel", onWheel, true);
    this.removeDomListeners = () => {
      container.removeEventListener("keydown", onKeyDown, true);
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("pointerup", onPointerUp, true);
      container.removeEventListener("pointermove", onPointerMove, true);
      container.removeEventListener("wheel", onWheel, true);
    };

    this.terminal = new Restty({
      root: container,
      createInitialPane: { focus: false },
      fontSources: botsterResttyFontSources,
      appOptions: {
        // Pure renderer: session owns PTY queries including OSC color replies.
        // Restty ≥448497041 wires readOnly → suppressQueryReplies (OSC 10/11/12).
        readOnly: true,
        ptyTransport: this.ptyTransport,
        beforeInput: ({ text, source }) => {
          recordLiveHarnessTerminal("before_input", {
            text,
            source,
            sessionId: this.descriptor.sessionId
          });
          if (source !== "pty" && text) {
            this.emitInput(text);
          }
          return text;
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
    // wasmReady + wasmHandle; poll until ready rather than re-entering init().
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
    this.wheelReencoder.reset();
    dataPlane.bindIncrementalSnapshotReader?.(() => this.createIncrementalSnapshotReader());
    const subscription = this.ptyTransport.attach(dataPlane);
    this.terminal?.connectPty();
    return subscription;
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

  onInput(listener: (data: TerminalInput) => void): TerminalSubscription {
    this.inputListeners.add(listener);

    return {
      unsubscribe: () => {
        this.inputListeners.delete(listener);
      }
    };
  }

  write(data: TerminalOutput): void {
    this.ptyTransport.deliverOutput(data);
    this.wheelReencoder.syncApplicationMouseActive(this.applicationMouseTrackingActive());
  }

  resize(rows: number, columns: number): void {
    if (!this.ptyTransport.resize(columns, rows)) return;
    const grid = this.ptyTransport.currentGrid();
    if (grid) {
      this.applyGridToRestty(grid);
    }
  }

  focus(): void {
    this.terminal?.focus();
  }

  destroy(): void {
    this.wheelAlive = false;
    this.wheelReencoder.reset();
    this.removeDomListeners?.();
    this.removeDomListeners = undefined;
    this.pendingSemantic = undefined;
    this.uninstallPaletteProbe?.();
    this.uninstallPaletteProbe = undefined;
    this.ptyTransport.destroy();
    this.inputListeners.clear();
    this.terminal?.destroy();
    this.terminal = undefined;
    this.container = undefined;
  }

  private livePaneGrid(): { cols: number; rows: number; cellHeight?: number } {
    const pane = this.terminal?.activePane?.() as
      | {
          cols?: number;
          rows?: number;
          cellH?: number;
          getCols?: () => number;
          getRows?: () => number;
          getCellHeight?: () => number;
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
    const cellHeight =
      (typeof pane?.getCellHeight === "function" ? pane.getCellHeight() : undefined) ??
      (typeof pane?.cellH === "number" ? pane.cellH : undefined);
    return { cols: Math.max(1, cols), rows: Math.max(1, rows), cellHeight };
  }

  private liveRows(): number {
    return this.livePaneGrid().rows;
  }

  /**
   * Restty `isMouseActive` / `getMouseStatus().active` only. Shift is a separate
   * override in `shouldRouteWheelToAppMouse`, matching
   * `shouldRoutePointerToAppMouse`.
   */
  private applicationMouseTrackingActive(): boolean {
    const status = this.terminal?.getMouseStatus?.() as { active?: boolean } | undefined;
    return status?.active === true;
  }

  private liveCellHeight(): number {
    const paneHeight = this.livePaneGrid().cellHeight;
    if (typeof paneHeight === "number" && paneHeight > 0) return paneHeight;
    const canvas = this.container?.querySelector?.("canvas");
    const rect = canvas?.getBoundingClientRect?.();
    const rows = this.liveRows();
    if (rect && rect.height > 0 && rows > 0) return rect.height / rows;
    return 20;
  }

  /** Zero-based cell under a pointer/wheel event using the mounted canvas + current grid. */
  private positionToCell(event: MouseEvent | PointerEvent | WheelEvent): { col: number; row: number } {
    const canvas =
      (event.target instanceof HTMLElement && event.target.closest?.("canvas")) ||
      this.container?.querySelector?.("canvas") ||
      null;
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { col: 0, row: 0 };
    }
    const { cols, rows } = this.livePaneGrid();
    // Restty MouseController adds 1 to col/row; supply zero-based grid coords.
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * rows)));
    return { col, row };
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

  private takePendingSemantic(): PendingSemanticInput | undefined {
    const pending = this.pendingSemantic;
    this.pendingSemantic = undefined;
    return pending;
  }

  private emitInput(data: TerminalInput): void {
    for (const listener of this.inputListeners) {
      listener(data);
    }
  }

  private applyGridToRestty(grid: TerminalGrid): void {
    this.terminal?.resize(grid.columns, grid.rows);
  }

  private sendWheelDecision(decision: WheelDecision): void {
    if (!this.wheelAlive || decision.steps <= 0) return;
    this.ptyTransport.writeSemantic({
      encode: (modes: DaemonModeFlags) => encodeWheelDecision(decision, modes)
    });
  }

  private createModeDependentInput(initialBytes: string): ModeDependentTerminalInput {
    // Unmatched mounted Restty wheel drain bytes must not reach raw PTY input.
    if (unmatchedWheelBytesShouldDrop(initialBytes, this.pendingSemantic?.kind)) {
      return { encode: () => "" };
    }
    // Consume one-shot semantic state so a later mouse report cannot reuse a key event.
    let pending = this.takePendingSemantic() ?? { kind: "bytes" as const, data: initialBytes };
    // insertText / IME paths may not fire keydown, while canvas.click leaves a pending mouse
    // semantic. Only honor a pending kind when the Restty-encoded bytes match that kind.
    if (pending.kind === "mouse" && !looksLikeMouseReport(initialBytes)) {
      pending = { kind: "bytes", data: initialBytes };
    } else if (pending.kind === "key" && looksLikeMouseReport(initialBytes)) {
      pending = { kind: "bytes", data: initialBytes };
    }
    const positionToCell = (event: MouseEvent | PointerEvent | WheelEvent) => this.positionToCell(event);
    return {
      encode: (modes: DaemonModeFlags) =>
        encodeSemanticInput(pending, modes, initialBytes, positionToCell)
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function encodeSemanticInput(
  pending: PendingSemanticInput,
  modes: DaemonModeFlags,
  initialBytes: string,
  positionToCell?: (event: MouseEvent | PointerEvent | WheelEvent) => { col: number; row: number }
): string {
  if (pending.kind === "key") {
    let kittyFlags = 0;
    const inputHandler = createInputHandler({
      getKittyKeyboardFlags: () => kittyFlags,
      suppressQueryReplies: true
    });
    kittyFlags = kittyFlagsFromModeFlags(modes);
    return inputHandler.encodeKeyEvent(pending.event) || initialBytes;
  }

  if (pending.kind === "mouse") {
    // Fresh modes may disable mouse tracking: discard without ModeGatedInput payload.
    if (!coreMouseTrackingEnabled(modes.mouse_mode)) {
      return "";
    }
    const replies: string[] = [];
    const inputHandler = createInputHandler({
      sendReply: (data) => {
        replies.push(data);
      },
      suppressQueryReplies: true,
      // Restty adds 1 to col/row; supply zero-based grid coordinates.
      positionToCell: positionToCell ?? (() => ({ col: 0, row: 0 }))
    });
    // Keep Restty mouse mode in "auto" so enablement follows rehydrated tracking bits only.
    inputHandler.setMouseMode?.("auto");
    inputHandler.rehydrateMouseFromTrackingBits?.(mouseTrackingBitsFromCoreMode(modes.mouse_mode));
    const sent = inputHandler.sendMouseEvent?.(pending.reportKind, pending.event as PointerEvent);
    if (sent && replies.length > 0) {
      return replies.join("");
    }
    // Modes claim tracking but Restty could not encode — discard rather than send stale key bytes.
    return "";
  }

  return pending.data || initialBytes;
}

function looksLikeMouseReport(data: string): boolean {
  return (
    data.startsWith("\u001b[<") ||
    data.startsWith("\u001b[M") ||
    data.startsWith("\u001b[>")
  );
}

function kittyFlagsFromModeFlags(modes: DaemonModeFlags): number {
  return modes.kitty_enabled ? kittyEnabledBaselineFlags : 0;
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
