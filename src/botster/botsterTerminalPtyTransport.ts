import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../vendor/restty/pty/types";
import type {
  ModeDependentTerminalInput,
  TerminalDataPlaneAttachment,
  TerminalInputOutcome,
  TerminalOutput,
  TerminalSubscription
} from "./terminal";
import {
  installSnapshotAndReapplyGrid,
  TerminalGridState,
  type TerminalGrid
} from "./terminalGrid";

interface BotsterTerminalPtyTransportOptions {
  createModeDependentInput(data: string): ModeDependentTerminalInput;
  record(kind: string, payload: unknown): void;
}

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

  sendInput(data: string): boolean {
    if (!this.dataPlane) return false;
    this.options.record("pty_send_input", { data, sessionId: this.dataPlane.sessionId });

    if (this.dataPlane.writeModeGatedInput) {
      const semantic = this.options.createModeDependentInput(data);
      return this.writeSemantic(semantic);
    }

    void this.dataPlane.writeInput(data);
    return true;
  }

  /**
   * Send a prepared semantic through the mode-gated path only.
   * Returns false when no data plane or no ModeGatedInput owner exists so a
   * wheel decision cannot fall through as raw bytes.
   */
  writeSemantic(semantic: ModeDependentTerminalInput): boolean {
    if (!this.dataPlane?.writeModeGatedInput) return false;
    void Promise.resolve(this.dataPlane.writeModeGatedInput(semantic)).catch((error: unknown) => {
      this.options.record("mode_gated_input_error", {
        message: error instanceof Error ? error.message : String(error),
        sessionId: this.dataPlane?.sessionId
      });
    });
    return true;
  }

  /**
   * Explicit clipboard paste. A recognized paste stays a paste: it is never rewritten as
   * key input. Without a paste owner the outcome is an explicit unsupported rejection.
   */
  async writePaste(text: string): Promise<TerminalInputOutcome> {
    // The clipboard is not encoded here: the paste owner bounds and encodes it once.
    // `chars` is the UTF-16 length, a lower bound on the UTF-8 size.
    const chars = text.length;
    const dataPlane = this.dataPlane;
    if (!dataPlane) {
      this.options.record("paste_unsupported", { chars, reason: "no_data_plane" });
      return { kind: "paste", outcome: "rejected", bytes: chars, reason: "unsupported", detail: "No terminal is attached; paste was not delivered." };
    }
    if (!dataPlane.writePaste) {
      this.options.record("paste_unsupported", { chars, reason: "no_paste_owner", sessionId: dataPlane.sessionId });
      return {
        kind: "paste",
        outcome: "rejected",
        bytes: chars,
        reason: "unsupported",
        detail: "This terminal attachment does not support clipboard paste; paste was not delivered."
      };
    }
    this.options.record("pty_write_paste", { chars, sessionId: dataPlane.sessionId });
    try {
      return await dataPlane.writePaste(text);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.options.record("paste_error", { chars, message: detail, sessionId: dataPlane.sessionId });
      return { kind: "paste", outcome: "unknown", bytes: chars, reason: "error", detail: `Paste failed before an outcome was known: ${detail}` };
    }
  }

  resize(cols: number, rows: number): boolean {
    return this.gridState.measure(cols, rows);
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
