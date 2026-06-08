import type { EntityFrameStore } from "./entities";

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
}

export interface UiTreeSnapshot {
  kind: "ui_tree_snapshot";
  surface: string;
  root: UiNode;
  version: string;
}

export interface UiNodeRendererRegistry {
  render(snapshot: UiTreeSnapshot, entities: EntityFrameStore): unknown;
  supports(primitive: string): boolean;
}
