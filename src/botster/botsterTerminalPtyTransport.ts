import type { PtyCallbacks, PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../vendor/restty/pty/types";
import type {
  TerminalDataPlaneAttachment,
  TerminalInputOutcome,
  TerminalOutput,
  TerminalSubscription
} from "./terminal";
import type { TerminalSemanticInput } from "./terminalInputEvents";
import {
  installSnapshotAndReapplyGrid,
  TerminalGridState,
  type TerminalGrid
} from "./terminalGrid";

interface BotsterTerminalPtyTransportOptions {
  record(kind: string, payload: unknown): void;
  /**
   * Restty produced PTY bytes from a source the container capture does not cover. The
   * bytes are never forwarded; the renderer reports the gap to the user instead.
   */
  onUncapturedInput(source: string, data: string): void;
}

const ESC = "\u001b";

/** Mouse reports Restty emits through its reply sink: SGR, X10, and URXVT encodings. */
export function looksLikeResttyMouseReport(data: string): boolean {
  if (data.startsWith(`${ESC}[<`) || data.startsWith(`${ESC}[M`)) return true;
  // URXVT: ESC [ button ; col ; row M
  if (!data.startsWith(`${ESC}[`)) return false;
  return /^\d+;\d+;\d+M/.test(data.slice(2));
}

/** Focus reports Restty emits as `program` input when focus reporting is on. */
export function looksLikeResttyFocusReport(data: string): boolean {
  return data === `${ESC}[I` || data === `${ESC}[O`;
}

/**
 * Restty's PTY transport seam, used as a render-only sink.
 *
 * Output flows from the data plane into Restty through `onData`. Input never flows the
 * other way: Restty's own key, mouse, and query encodings are dropped here, because the
 * container-level capture already reported the same gestures as semantic input and the
 * worker's Ghostty encoder owns the bytes. Resize is the one Restty-originated message that
 * reaches the data plane, because Restty measures the grid and pixel size.
 */
export class BotsterTerminalPtyTransport implements PtyTransport {
  private dataPlane?: TerminalDataPlaneAttachment;
  private callbacks?: PtyCallbacks;
  private outputSubscription?: TerminalSubscription;
  private onRender?: (data: TerminalOutput) => void;
  private connected = false;
  private readonly gridState = new TerminalGridState();

  constructor(private readonly options: BotsterTerminalPtyTransportOptions) {}

  setRenderObserver(onRender: ((data: TerminalOutput) => void) | undefined): void {
    this.onRender = onRender;
  }

  deliverOutput(data: TerminalOutput): void {
    this.callbacks?.onData?.(data);
    this.onRender?.(data);
  }

  attach(dataPlane: TerminalDataPlaneAttachment): TerminalSubscription {
    this.detach();
    this.dataPlane = dataPlane;
    this.gridState.attach(dataPlane);
    this.outputSubscription = dataPlane.subscribeOutput((data) => {
      this.callbacks?.onData?.(data);
      this.onRender?.(data);
    });
    if (this.callbacks && !this.connected) {
      this.connected = true;
      this.callbacks.onConnect?.();
    }
    if (this.callbacks) {
      this.options.record("pty_connected", { sessionId: this.dataPlane.sessionId });
    }

    return {
      unsubscribe: () => {
        this.detach();
      }
    };
  }

  connect(connectOptions: PtyConnectOptions): void {
    this.callbacks = connectOptions.callbacks;
    if (!this.connected) {
      this.connected = true;
      this.callbacks.onConnect?.();
    }
    if (this.dataPlane) {
      this.options.record("pty_connected", { sessionId: this.dataPlane.sessionId });
    }
  }

  disconnect(): void {
    if (this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
  }

  /**
   * Restty-encoded input is render-only. Mouse reports reach this sink through Restty's
   * reply path; the same gesture already reached the data plane as semantic input from the
   * container capture, so forwarding these bytes would double it. Any other bytes come from
   * a source the capture does not cover and are reported, never silently dropped.
   */
  sendInput(data: string): boolean {
    if (looksLikeResttyMouseReport(data) || looksLikeResttyFocusReport(data)) {
      this.options.record("restty_input_dropped", {
        bytes: data.length,
        sessionId: this.dataPlane?.sessionId
      });
      return true;
    }
    this.options.onUncapturedInput("pty_sink", data);
    return true;
  }

  /** Semantic input from the container capture. Returns false when no data plane is attached. */
  sendSemantic(input: TerminalSemanticInput): boolean {
    const dataPlane = this.dataPlane;
    if (!dataPlane) return false;
    dataPlane.sendInput(input);
    return true;
  }

  /**
   * Explicit clipboard paste. A recognized paste stays a paste: it is never rewritten as
   * key input. Without an attached data plane the outcome is an explicit local rejection.
   */
  async writePaste(text: string): Promise<TerminalInputOutcome> {
    const chars = text.length;
    const dataPlane = this.dataPlane;
    if (!dataPlane) {
      this.options.record("paste_unsupported", { chars, reason: "no_data_plane" });
      return {
        kind: "paste",
        outcome: "rejected_locally",
        requestedBytes: chars,
        reason: "no_data_plane",
        detail: "No terminal is attached; paste was not delivered."
      };
    }
    this.options.record("pty_write_paste", { chars, sessionId: dataPlane.sessionId });
    try {
      return await dataPlane.writePaste(text);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.options.record("paste_error", { chars, message: detail, sessionId: dataPlane.sessionId });
      return {
        kind: "paste",
        outcome: "outcome_unknown",
        requestedBytes: chars,
        reason: "error",
        detail: `Paste failed before an outcome was known: ${detail}`
      };
    }
  }

  resize(cols: number, rows: number, meta?: PtyResizeMeta): boolean {
    return this.gridState.measure(cols, rows, meta?.widthPx ?? 0, meta?.heightPx ?? 0);
  }

  currentGrid(): TerminalGrid | undefined {
    return this.gridState.current();
  }

  installSnapshot(
    install: () => boolean | Promise<boolean>,
    apply: (grid: TerminalGrid) => void
  ): Promise<boolean> {
    return installSnapshotAndReapplyGrid(install, this.gridState, apply);
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy(): void {
    this.disconnect();
    this.detach();
    this.callbacks = undefined;
  }

  private detach(): void {
    const hadDataPlane = Boolean(this.dataPlane);
    this.outputSubscription?.unsubscribe();
    this.outputSubscription = undefined;
    if (hadDataPlane && this.connected) {
      this.connected = false;
      this.callbacks?.onDisconnect?.();
    }
    const dataPlane = this.dataPlane;
    this.dataPlane = undefined;
    if (dataPlane) {
      this.gridState.detach(dataPlane);
    }
  }
}
