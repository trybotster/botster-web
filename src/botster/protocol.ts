import type { ClientCapabilityDeclaration } from "./capabilities";

export type HubControlFrameKind =
  | "hello"
  | "hello_ack"
  | "subscribe"
  | "route_registry"
  | "ui_tree_snapshot"
  | "entity_snapshot"
  | "entity_upsert"
  | "entity_patch"
  | "entity_remove"
  | "action_result"
  | "operator_error";

export interface HubControlFrame {
  kind: HubControlFrameKind;
  payload: unknown;
}

export interface HubConnectionLifecycle {
  connect(capabilities: ClientCapabilityDeclaration): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(): Promise<void>;
}

export interface HubProtocolIngress {
  receive(frame: HubControlFrame): void;
}
