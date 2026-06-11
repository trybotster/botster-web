import type { TerminalDataPlaneAttachment, TerminalOutput, TerminalSubscription } from "./terminal";
import type { DaemonBridgeClient } from "./realHubDogfoodTransport";
import { realHubDogfoodSessionId, realHubDogfoodSubscriptionId } from "./realHubDogfoodTransport";
import type { DaemonEvent } from "./realHubDaemonDto";

export interface RealHubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
}

export class RealHubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private readonly subscriptionId: string;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private streamSubscription: { unsubscribe(): void } | undefined;
  private detached = false;

  constructor(private readonly options: RealHubTerminalDataPlaneOptions) {
    this.sessionId = options.sessionId ?? realHubDogfoodSessionId;
    this.subscriptionId = options.subscriptionId ?? realHubDogfoodSubscriptionId;
  }

  async writeInput(data: string): Promise<void> {
    recordLiveHarnessTerminal("input", { data });
    await this.options.bridge.request({
      type: "send_input",
      session_id: this.sessionId,
      data
    });
  }

  subscribeOutput(listener: (data: TerminalOutput) => void): TerminalSubscription {
    this.listeners.add(listener);
    void this.ensureAttached();

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
        if (this.listeners.size === 0) {
          this.closeStream();
        }
      }
    };
  }

  async resize(rows: number, columns: number): Promise<void> {
    recordLiveHarnessTerminal("resize", { rows, columns });
    await this.options.bridge.request({
      type: "resize",
      session_id: this.sessionId,
      rows,
      cols: columns
    });
  }

  async detach(): Promise<void> {
    this.detached = true;
    this.closeStream();
    this.listeners.clear();

    await this.options.bridge.request({
      type: "detach",
      session_id: this.sessionId,
      subscription_id: this.subscriptionId
    });
  }

  private ensureAttached(): void {
    if (this.streamSubscription || this.detached) {
      return;
    }

    if (!this.options.bridge.streamTerminal) {
      throw new Error("real hub bridge does not expose a streaming terminal attach");
    }

    this.streamSubscription = this.options.bridge.streamTerminal(
      this.sessionId,
      this.subscriptionId,
      (event) => this.emitTerminalEvent(event)
    );
  }

  private closeStream(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
  }

  private emitTerminalEvent(event: DaemonEvent): void {
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
