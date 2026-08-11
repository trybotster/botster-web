import type {
  JsonValue,
  UiActionRequest,
  UiActionResult,
  UiNode,
  UiPresentationOperation
} from "@trybotster/ui-contract";

export interface UiPresentationScope {
  hubId: string;
  packageName: string;
  surfaceId: string;
}

export type UiPresentationState = Record<string, Record<string, JsonValue>>;

export function uiPresentationScopeKey(scope: UiPresentationScope): string {
  return JSON.stringify([scope.hubId, scope.packageName, scope.surfaceId]);
}

export function presentationValues(
  state: UiPresentationState,
  scope: UiPresentationScope
): Record<string, JsonValue> {
  return state[uiPresentationScopeKey(scope)] ?? {};
}

export function applyAcceptedPresentation(
  state: UiPresentationState,
  scope: UiPresentationScope,
  request: UiActionRequest,
  result: UiActionResult
): UiPresentationState {
  if (!acceptedResultMatches(request, result) || !result.presentation?.length) return state;

  const scopeKey = uiPresentationScopeKey(scope);
  const nextValues = { ...(state[scopeKey] ?? {}) };
  for (const operation of result.presentation) {
    applyPresentationOperation(nextValues, operation);
  }
  return { ...state, [scopeKey]: nextValues };
}

export function clearPresentationValue(
  state: UiPresentationState,
  scope: UiPresentationScope,
  key: string
): UiPresentationState {
  const scopeKey = uiPresentationScopeKey(scope);
  const currentValues = state[scopeKey];
  if (!currentValues || !Object.hasOwn(currentValues, key)) return state;

  const nextValues = { ...currentValues };
  delete nextValues[key];
  return { ...state, [scopeKey]: nextValues };
}

export function acceptedResultMatches(request: UiActionRequest, result: UiActionResult): boolean {
  return (
    result.state === "accepted" &&
    result.request_id === request.request_id &&
    result.surface_id === request.surface_id &&
    result.action_id === request.action_id &&
    result.node_id === request.node_id
  );
}

export function replaceAcceptedSurface(root: UiNode, result: UiActionResult): UiNode {
  if (result.state !== "accepted" || !result.replacement) return root;
  return result.replacement;
}

function applyPresentationOperation(
  values: Record<string, JsonValue>,
  operation: UiPresentationOperation
): void {
  if (operation.kind === "set") {
    values[operation.key] = operation.value;
  } else if (operation.kind === "clear") {
    delete values[operation.key];
  } else {
    values[operation.key] = !values[operation.key];
  }
}
