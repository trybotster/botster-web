import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../vendor/restty/pty/types";
import type {
  ModeDependentTerminalInput,
  TerminalDataPlaneAttachment,
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
  private onRender?: (data: string) => void;
  private connected = false;
  private readonly gridState = new TerminalGridState();

  constructor(private readonly options: BotsterTerminalPtyTransportOptions) {}

  setRenderObserver(onRender: (data: string) => void): void {
    this.onRender = onRender;
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
      void Promise.resolve(this.dataPlane.writeModeGatedInput(semantic)).catch((error: unknown) => {
        this.options.record("mode_gated_input_error", {
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
