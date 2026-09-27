import type { ClientCapabilityDeclaration } from "./capabilities";

export type HubControlFrameKind =
  | "hello"
  | "hello_ack"
  | "subscribe"
  | "entity_pull"
  | "entity_release"
  | "events_subscribe"
  | "events_release"
  | "package_event"
  | "event_gap"
  | "surface_subscribe"
  | "route_registry"
  | "ui_tree_snapshot"
  | "entity_snapshot"
  | "entity_upsert"
  | "entity_patch"
  | "entity_remove"
  | "entity_error"
  | "action_request"
  | "action_result"
  | "operator_error"
  | "connection_diagnostic"
  | "status_refresh";

/**
 * A client-side Hub status read that follows a confirmed mutation (today: resolve_quarantine).
 * The status frames come first; this frame says whether that read succeeded.
 */
export interface StatusRefreshPayload {
  cause: "resolve_quarantine";
  target: unknown;
  /** The operation_id of the Resolve action that caused this read, when it carried one. */
  operation_id?: string;
  ok: boolean;
  error?: string;
}

export interface HubControlFrame {
  kind: HubControlFrameKind;
  payload: unknown;
}

/**
 * Hub-reported failure of a held entity subscription. Terminal for that subscription
 * generation: the code and message are rendered verbatim and never trigger a refetch.
 */
export interface EntitySubscriptionErrorPayload {
  family: string;
  code: string;
  message: string;
}

export type HubControlFrameHandler = (frame: HubControlFrame) => void;

export interface HubControlTransport {
  connect?(capabilities: ClientCapabilityDeclaration, ingress: HubControlFrameHandler): Promise<void>;
  disconnect?(): Promise<void>;
  send(frame: HubControlFrame): Promise<void>;
}

export interface HubConnectionLifecycle {
  connect(capabilities: ClientCapabilityDeclaration): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(): Promise<void>;
}

export interface HubProtocolIngress {
  receive(frame: HubControlFrame): void;
}

export interface HubSurfaceSubscription {
  surface: string;
  path?: string;
}

export class HubConnection implements HubConnectionLifecycle, HubProtocolIngress {
  readonly received: HubControlFrame[] = [];

  private connected = false;
  private subscribed = false;
  private readonly surfaceSubscriptions = new Map<string, HubSurfaceSubscription>();
  private readonly ingressHandlers = new Set<HubControlFrameHandler>();

  constructor(private readonly transport: HubControlTransport) {}

  async connect(capabilities: ClientCapabilityDeclaration): Promise<void> {
    await this.transport.connect?.(capabilities, (frame) => this.receive(frame));
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscribed = false;
    await this.transport.disconnect?.();
  }

  async subscribe(): Promise<void> {
    await this.send({
      kind: "subscribe",
      payload: {}
    });
    this.subscribed = true;
  }

  async send(frame: HubControlFrame): Promise<void> {
    await this.transport.send(frame);
  }

  receive(frame: HubControlFrame): void {
    this.received.push(frame);
    for (const handler of this.ingressHandlers) {
      handler(frame);
    }
  }

  onFrame(handler: HubControlFrameHandler): () => void {
    this.ingressHandlers.add(handler);

    return () => {
      this.ingressHandlers.delete(handler);
    };
  }

  async subscribeSurface(subscription: HubSurfaceSubscription): Promise<void> {
    this.surfaceSubscriptions.set(surfaceSubscriptionKey(subscription), subscription);
    await this.send({
      kind: "surface_subscribe",
      payload: subscription
    });
  }

  async replaySurfaceSubscriptions(): Promise<void> {
    for (const subscription of this.surfaceSubscriptions.values()) {
      await this.send({
        kind: "surface_subscribe",
        payload: subscription
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  isSubscribed(): boolean {
    return this.subscribed;
  }
}

function surfaceSubscriptionKey(subscription: HubSurfaceSubscription): string {
  return `${subscription.surface}:${subscription.path ?? ""}`;
}
