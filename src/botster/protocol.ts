import type { ClientCapabilityDeclaration } from "./capabilities";

export type HubControlFrameKind =
  | "hello"
  | "hello_ack"
  | "subscribe"
  | "entity_pull"
  | "surface_subscribe"
  | "route_registry"
  | "ui_tree_snapshot"
  | "entity_snapshot"
  | "entity_upsert"
  | "entity_patch"
  | "entity_remove"
  | "action_request"
  | "action_result"
  | "operator_error"
  | "connection_diagnostic";

export interface HubControlFrame {
  kind: HubControlFrameKind;
  payload: unknown;
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
