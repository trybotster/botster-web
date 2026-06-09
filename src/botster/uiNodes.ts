import type { EntityFrameStore } from "./entities";
import type { ActionBinding } from "./actions";
import type { UiCapabilitySet } from "./capabilities";

export type UiNodeId = string;

export interface UiNode {
  id: UiNodeId;
  primitive: string;
  props?: Record<string, unknown>;
  slots?: Record<string, UiNode[]>;
  bindings?: UiNodeBinding[];
}

export interface UiNodeBinding {
  source: "entity" | "local_state";
  path: string;
  prop?: string;
  where?: Record<string, string | number | boolean>;
}

export interface UiTreeSnapshot {
  kind: "ui_tree_snapshot";
  surface: string;
  root: UiNode;
  version: string;
}

export interface UiNodeRendererRegistry {
  render(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options?: UiNodeRenderOptions): unknown;
  supports(primitive: string): boolean;
}

export interface UiNodeRenderOptions {
  capabilities?: UiCapabilitySet;
  localState?: Record<string, unknown>;
  collectAction?: (action: ActionBinding, node: UiNode) => void;
  dispatchAction?: (action: ActionBinding, node: UiNode) => void;
}
