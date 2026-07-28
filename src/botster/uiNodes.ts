import type {
  JsonValue,
  UiAction,
  UiActionKind,
  UiActionResult,
  UiFormValues,
  UiNode
} from "@trybotster/ui-contract";

import type { UiCapabilitySet } from "./capabilities";
import type { EntityFrameStore } from "./entities";

export type {
  JsonObject,
  JsonValue,
  UiAction,
  UiActionKind,
  UiActionRequest,
  UiActionResult,
  UiBind,
  UiBindIf,
  UiBindList,
  UiChild,
  UiFormValues,
  UiNode,
  UiPresentationOperation,
  UiPresentationPredicate
} from "@trybotster/ui-contract";

export interface UiTreeSnapshot {
  kind: "ui_tree_snapshot";
  surface: string;
  root: UiNode;
  version: string;
}

export interface UiNodeActionDispatch {
  action: UiAction;
  node: UiNode;
  kind: UiActionKind;
  values?: UiFormValues;
}

export interface UiNodeRendererRegistry {
  render(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options?: UiNodeRenderOptions): unknown;
  supports(primitive: string): boolean;
}

export interface UiNodeRenderOptions {
  capabilities?: UiCapabilitySet;
  localState?: Record<string, unknown>;
  presentation?: Record<string, JsonValue>;
  actionResult?: UiActionResult;
  collectAction?: (dispatch: UiNodeActionDispatch) => void;
  dispatchAction?: (dispatch: UiNodeActionDispatch) => void;
}
