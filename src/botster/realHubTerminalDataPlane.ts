import type {
  TerminalDataPlaneAttachment,
  TerminalDataPlaneDiagnostic,
  TerminalOutput,
  TerminalSubscription
} from "./terminal";
import type { DaemonBridgeClient } from "./realHubDogfoodTransport";
import { realHubDogfoodSessionId, realHubDogfoodSubscriptionId } from "./realHubDogfoodTransport";
import type { DaemonEvent } from "./realHubDaemonDto";

const maxAttachAttempts = 80;
const attachRetryDelayMs = 250;

export interface RealHubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
}

export class RealHubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private readonly subscriptionId: string;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private readonly diagnosticListeners = new Set<(diagnostic: TerminalDataPlaneDiagnostic) => void>();
  private streamSubscription: { unsubscribe(): void } | undefined;
  private attachPromise: Promise<void> | undefined;
  private pendingResize: { rows: number; columns: number } | undefined;
  private detached = false;

  constructor(private readonly options: RealHubTerminalDataPlaneOptions) {
    this.sessionId = options.sessionId ?? realHubDogfoodSessionId;
    this.subscriptionId = options.subscriptionId ?? realHubDogfoodSubscriptionId;
  }

  async writeInput(data: string): Promise<void> {
    recordLiveHarnessTerminal("input", { data });
    await this.ensureAttached();
    await this.options.bridge.request({
      type: "send_input",
      session_id: this.sessionId,
      data
    });
  }

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    void this.ensureAttached().catch((error: unknown) => {
      recordLiveHarnessTerminal("attach_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
        if (this.listeners.size === 0) {
          this.closeStream();
        }
      }
    };
  }

  subscribeDiagnostics(listener: (diagnostic: TerminalDataPlaneDiagnostic) => void): TerminalSubscription {
    this.diagnosticListeners.add(listener);

    return {
      unsubscribe: () => {
        this.diagnosticListeners.delete(listener);
      }
    };
  }

  async resize(rows: number, columns: number): Promise<void> {
    recordLiveHarnessTerminal("resize", { rows, columns });
    this.pendingResize = { rows, columns };
    await this.ensureAttached();
    await this.flushPendingResize();
  }

  async detach(): Promise<void> {
    this.detached = true;
    this.closeStream();
    this.listeners.clear();
    this.diagnosticListeners.clear();

    await this.options.bridge.request({
      type: "detach",
      session_id: this.sessionId,
      subscription_id: this.subscriptionId
    });
  }

  private ensureAttached(): Promise<void> {
    if (this.streamSubscription || this.detached) {
      return Promise.resolve();
    }

    if (!this.options.bridge.streamTerminal) {
      throw new Error("real hub bridge does not expose a streaming terminal attach");
    }

    this.attachPromise ??= this.attachWhenSessionIsVisible().finally(() => {
      this.attachPromise = undefined;
    });

    return this.attachPromise;
  }

  private async attachWhenSessionIsVisible(): Promise<void> {
    for (let attempt = 1; attempt <= maxAttachAttempts; attempt += 1) {
      if (this.streamSubscription || this.detached || this.listeners.size === 0) {
        return;
      }

      const response = await this.options.bridge.request({ type: "list_sessions" });
      const session = response.sessions?.find((entry) => entry.session_id === this.sessionId);
      if (session && session.lifecycle !== "exited") {
        this.streamSubscription = this.options.bridge.streamTerminal!(
          this.sessionId,
          this.subscriptionId,
          (event) => this.emitTerminalEvent(event)
        );
        recordLiveHarnessTerminal("attach", { attempt });
        await this.flushPendingResize();
        return;
      }

      recordLiveHarnessTerminal("attach_retry", { attempt });
      await wait(attachRetryDelayMs);
    }

    throw new Error(`timed out waiting for session ${this.sessionId} before terminal attach`);
  }

  private closeStream(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
  }

  private async flushPendingResize(): Promise<void> {
    if (!this.streamSubscription || !this.pendingResize) return;

    const resize = this.pendingResize;
    this.pendingResize = undefined;
    await this.options.bridge.request({
      type: "resize",
      session_id: this.sessionId,
      rows: resize.rows,
      cols: resize.columns
    });
  }

  private emitTerminalEvent(event: DaemonEvent): void {
    if (
      (event.type === "snapshot" || event.type === "scrollback") &&
      event.session_id === this.sessionId &&
      event.subscription_id === this.subscriptionId
    ) {
      this.emitHistoricalScrollbackUnavailable(event);
      return;
    }

    if (
      event.type !== "terminal_output" ||
      event.session_id !== this.sessionId ||
      event.subscription_id !== this.subscriptionId
    ) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event.data);
    }
    recordLiveHarnessTerminal("output", { data: event.data });
  }

  private emitHistoricalScrollbackUnavailable(
    event: Extract<DaemonEvent, { type: "snapshot" | "scrollback" }>
  ): void {
    const diagnostic: TerminalDataPlaneDiagnostic = {
      id: "historical-scrollback-unavailable",
      title: "Historical scrollback unavailable",
      detail: `Real hub reported ${event.bytes} bytes of ${event.type}, but the daemon protocol exposes only byte counts to botster-web.`,
      severity: "warning"
    };

    for (const listener of this.diagnosticListeners) {
      listener(diagnostic);
    }
    recordLiveHarnessTerminal("historical_scrollback_unavailable", {
      event_type: event.type,
      bytes: event.bytes
    });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRealHubTerminalDataPlane(options: RealHubTerminalDataPlaneOptions): TerminalDataPlaneAttachment {
  return new RealHubTerminalDataPlane(options);
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
