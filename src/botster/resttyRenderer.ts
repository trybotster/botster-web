import { createInputHandler, Restty } from "../vendor/restty/internal.js";
import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../vendor/restty/pty/types";
import type { ResttyFontSource } from "../vendor/restty/runtime/types";
import type {
  ModeDependentTerminalInput,
  TerminalDataPlaneAttachment,
  TerminalInput,
  TerminalRendererAdapter,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";
import type { DaemonModeFlags } from "./realHubDaemonDto";
import {
  coreMouseTrackingEnabled,
  mouseTrackingBitsFromCoreMode
} from "./mouseMode";

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
  private readonly ptyTransport = new BotsterTerminalPtyTransport();
  private readonly inputListeners = new Set<(data: TerminalInput) => void>();
  private terminal?: Restty;
  private container?: HTMLElement;
  private pendingSemantic: PendingSemanticInput | undefined;
  private removeDomListeners?: () => void;
  private uninstallPaletteProbe?: () => void;
  /** Authoritative grid size for mouse re-encode (updated on resize). */
  private gridCols = 80;
  private gridRows = 24;

  constructor(readonly descriptor: TerminalViewDescriptor) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.ptyTransport.setRenderObserver((data) => {
      if (this.container?.dataset) {
        this.container.dataset.terminalLastRenderedOutput = data;
      }
      recordLiveHarnessTerminal("renderer_write", { data, sessionId: this.descriptor.sessionId });
    });
    this.ptyTransport.setSemanticInputProvider(() => this.takePendingSemantic());
    this.ptyTransport.setPositionToCell((event) => this.positionToCell(event));

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
      this.pendingSemantic = { kind: "mouse", event, reportKind: "wheel" };
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

    // Pane construction starts Restty init without awaiting. GHOSTSNP import requires
    // wasmReady + wasmHandle; poll until ready rather than re-entering init().
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const ok = terminal.loadBinarySnapshot(bytes);
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
    dataPlane.bindBinarySnapshotInstaller?.((bytes) => this.loadBinarySnapshot(bytes));
    const subscription = this.ptyTransport.attach(dataPlane);
    this.terminal?.connectPty();
    return subscription;
  }

  onInput(listener: (data: TerminalInput) => void): TerminalSubscription {
    this.inputListeners.add(listener);

    return {
      unsubscribe: () => {
        this.inputListeners.delete(listener);
      }
    };
  }

  write(data: string): void {
    this.terminal?.sendInput(data, "pty");
  }

  resize(rows: number, columns: number): void {
    if (columns > 0) this.gridCols = columns;
    if (rows > 0) this.gridRows = rows;
    this.terminal?.resize(columns, rows);
  }

  focus(): void {
    this.terminal?.focus();
  }

  destroy(): void {
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
    // Prefer live Restty pane grid when available; fall back to last resize.
    const pane = this.terminal?.activePane?.() as
      | { cols?: number; rows?: number; getCols?: () => number; getRows?: () => number }
      | null
      | undefined;
    const liveCols =
      (typeof pane?.getCols === "function" ? pane.getCols() : undefined) ??
      (typeof pane?.cols === "number" ? pane.cols : undefined) ??
      this.gridCols;
    const liveRows =
      (typeof pane?.getRows === "function" ? pane.getRows() : undefined) ??
      (typeof pane?.rows === "number" ? pane.rows : undefined) ??
      this.gridRows;
    const cols = Math.max(1, liveCols);
    const rows = Math.max(1, liveRows);
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
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class BotsterTerminalPtyTransport implements PtyTransport {
  private dataPlane?: TerminalDataPlaneAttachment;
  private callbacks?: PtyCallbacks;
  private outputSubscription?: TerminalSubscription;
  private onRender?: (data: string) => void;
  private semanticInputProvider?: () => PendingSemanticInput | undefined;
  private positionToCellFn?: (event: MouseEvent | PointerEvent | WheelEvent) => { col: number; row: number };
  private connected = false;

  setRenderObserver(onRender: (data: string) => void): void {
    this.onRender = onRender;
  }

  setSemanticInputProvider(provider: () => PendingSemanticInput | undefined): void {
    this.semanticInputProvider = provider;
  }

  setPositionToCell(
    positionToCell: (event: MouseEvent | PointerEvent | WheelEvent) => { col: number; row: number }
  ): void {
    this.positionToCellFn = positionToCell;
  }

  attach(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
    this.detach();
    this.dataPlane = dataPlane;
    this.outputSubscription = dataPlane.subscribeOutput((data) => {
      this.callbacks?.onData?.(data);
      this.onRender?.(data);
    });
    if (this.callbacks) {
      this.connected = true;
      this.callbacks.onConnect?.();
      recordLiveHarnessTerminal("pty_connected", { sessionId: this.dataPlane.sessionId });
    }

    return {
      unsubscribe: () => {
        this.detach();
      }
    };
  }

  connect(_options: PtyConnectOptions): void {
    this.callbacks = _options.callbacks;
    if (this.dataPlane) {
      this.connected = true;
      this.callbacks.onConnect?.();
      recordLiveHarnessTerminal("pty_connected", { sessionId: this.dataPlane.sessionId });
    }
  }

  disconnect(): void {
    if (this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
  }

  sendInput(data: string): boolean {
    if (!this.dataPlane) return false;
    recordLiveHarnessTerminal("pty_send_input", { data, sessionId: this.dataPlane.sessionId });

    if (this.dataPlane.writeModeGatedInput) {
      const semantic = this.createModeDependentInput(data);
      void Promise.resolve(this.dataPlane.writeModeGatedInput(semantic)).catch((error: unknown) => {
        recordLiveHarnessTerminal("mode_gated_input_error", {
          message: error instanceof Error ? error.message : String(error),
          sessionId: this.dataPlane?.sessionId
        });
      });
      return true;
    }

    void this.dataPlane.writeInput(data);
    return true;
  }

  resize(cols: number, rows: number): boolean {
    if (!this.dataPlane?.resize) return false;
    void this.dataPlane.resize(rows, cols);
    return true;
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.dataPlane);
  }

  destroy(): void {
    this.detach();
    this.callbacks = undefined;
    this.semanticInputProvider = undefined;
  }

  private createModeDependentInput(initialBytes: string): ModeDependentTerminalInput {
    // Consume one-shot semantic state so a later mouse report cannot reuse a key event.
    let pending = this.semanticInputProvider?.() ?? { kind: "bytes" as const, data: initialBytes };
    // insertText / IME paths may not fire keydown, while canvas.click leaves a pending mouse
    // semantic. Only honor a pending kind when the Restty-encoded bytes match that kind.
    if (pending.kind === "mouse" && !looksLikeMouseReport(initialBytes)) {
      pending = { kind: "bytes", data: initialBytes };
    } else if (pending.kind === "key" && looksLikeMouseReport(initialBytes)) {
      pending = { kind: "bytes", data: initialBytes };
    }
    const positionToCell = this.positionToCellFn;
    return {
      encode: (modes: DaemonModeFlags) =>
        encodeSemanticInput(pending, modes, initialBytes, positionToCell)
    };
  }

  private detach(): void {
    this.outputSubscription?.unsubscribe();
    this.outputSubscription = undefined;
    if (this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
    this.dataPlane = undefined;
  }
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
