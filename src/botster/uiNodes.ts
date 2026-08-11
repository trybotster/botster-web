import type {
  JsonValue,
  UiAction,
  UiActionKind,
  UiActionRequest,
  UiActionResult,
  UiFormValues,
  UiNode,
  UiNodeId
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

type RealizeNodeIdentity<T extends UiNode = UiNode> = T extends UiNode
  ? Omit<T, "id"> & { id?: UiNodeId }
  : never;

export type RealizedUiNode = RealizeNodeIdentity;

export interface UiNodeActionDispatch {
  action: UiAction;
  node: RealizedUiNode;
  kind: UiActionKind;
  values?: UiFormValues;
}

export function pluginSurfaceActionRequest(
  surfaceId: string,
  dispatch: UiNodeActionDispatch
): Omit<UiActionRequest, "request_id"> {
  const nodeId = dispatch.node.id;
  return {
    surface_id: surfaceId,
    action_id: dispatch.action.id,
    ...(nodeId ? { node_id: nodeId } : {}),
    kind: dispatch.kind,
    ...(dispatch.values ? { values: dispatch.values } : {}),
    ...(dispatch.action.payload !== undefined ? { payload: dispatch.action.payload } : {})
  };
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
  dismissPresentation?: (key: string) => void;
}
