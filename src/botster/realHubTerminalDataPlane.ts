import type { TerminalDataPlaneAttachment, TerminalOutput, TerminalSubscription } from "./terminal";
import type { DaemonBridgeClient } from "./realHubDogfoodTransport";
import { realHubDogfoodSessionId, realHubDogfoodSubscriptionId } from "./realHubDogfoodTransport";
import type { DaemonEvent, DaemonResponse } from "./realHubDaemonDto";

export interface RealHubTerminalDataPlaneOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  subscriptionId?: string;
  drainIntervalMs?: number;
}

export class RealHubTerminalDataPlane implements TerminalDataPlaneAttachment {
  readonly sessionId: string;

  private readonly subscriptionId: string;
  private readonly drainIntervalMs: number;
  private readonly listeners = new Set<(data: TerminalOutput) => void>();
  private poller: ReturnType<typeof setInterval> | undefined;
  private attached = false;
  private detached = false;

  constructor(private readonly options: RealHubTerminalDataPlaneOptions) {
    this.sessionId = options.sessionId ?? realHubDogfoodSessionId;
    this.subscriptionId = options.subscriptionId ?? realHubDogfoodSubscriptionId;
    this.drainIntervalMs = options.drainIntervalMs ?? 250;
  }

  async writeInput(data: string): Promise<void> {
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
      }
    };
  }

  async resize(rows: number, columns: number): Promise<void> {
    await this.options.bridge.request({
      type: "resize",
      session_id: this.sessionId,
      rows,
      cols: columns
    });
  }

  async detach(): Promise<void> {
    this.detached = true;
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = undefined;
    }
    this.listeners.clear();

    if (this.attached) {
      await this.options.bridge.request({
        type: "detach",
        session_id: this.sessionId,
        subscription_id: this.subscriptionId
      });
    }
  }

  private async ensureAttached(): Promise<void> {
    if (this.attached || this.detached) {
      return;
    }

    this.attached = true;
    this.emitTerminalEvents(
      await this.options.bridge.request({
        type: "attach",
        session_id: this.sessionId,
        subscription_id: this.subscriptionId
      })
    );
    this.poller = setInterval(() => {
      void this.drain();
    }, this.drainIntervalMs);
  }

  private async drain(): Promise<void> {
    if (this.detached || this.listeners.size === 0) {
      return;
    }

    this.emitTerminalEvents(
      await this.options.bridge.request({
        type: "drain",
        session_id: this.sessionId
      })
    );
  }

  private emitTerminalEvents(response: DaemonResponse): void {
    for (const event of response.events ?? []) {
      this.emitTerminalEvent(event);
    }
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
  }
}

export function createRealHubTerminalDataPlane(options: RealHubTerminalDataPlaneOptions): TerminalDataPlaneAttachment {
  return new RealHubTerminalDataPlane(options);
}
