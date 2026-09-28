import { IonButton, IonNote } from "@ionic/react";
import { useState, type ReactNode } from "react";

import type { UiAction, UiNodeActionDispatch, UiNodeRenderOptions } from "./uiNodes";

export type UiNodeFormDraft = Record<string, unknown>;
export type UiNodeFormSubmitClickPhase = "blocked_disabled" | "blocked_invalid" | "dispatched";

/**
 * A UiNode form: it owns the draft; the renderer supplies how its fields render and are
 * validated, so this component needs nothing from the renderer module (no import cycle).
 */
export function UiNodeForm({
  nodeId,
  submitAction,
  submitLabel,
  actionResult,
  initialDraft,
  renderFields,
  hasInvalidControl,
  submitDispatch,
  collectAction,
  dispatchAction,
  markSubmitClick
}: {
  nodeId: string | undefined;
  submitAction: UiAction;
  submitLabel: string;
  /** The latest action result, only when it belongs to this form's node and submit action. */
  actionResult?: UiNodeRenderOptions["actionResult"];
  initialDraft: () => UiNodeFormDraft;
  renderFields: (
    draft: UiNodeFormDraft,
    setDraft: (update: (current: UiNodeFormDraft) => UiNodeFormDraft) => void,
    actionResult: UiNodeRenderOptions["actionResult"]
  ) => ReactNode;
  hasInvalidControl: (draft: UiNodeFormDraft) => boolean;
  submitDispatch: (draft: UiNodeFormDraft) => UiNodeActionDispatch;
  collectAction?: (dispatch: UiNodeActionDispatch) => void;
  dispatchAction?: (dispatch: UiNodeActionDispatch) => void;
  markSubmitClick: (phase: UiNodeFormSubmitClickPhase, gated: boolean) => void;
}) {
  const [draft, setDraft] = useState<UiNodeFormDraft>(initialDraft);
  const [appliedResultId, setAppliedResultId] = useState<string>();
  if (actionResult && actionResult.request_id !== appliedResultId) {
    setAppliedResultId(actionResult.request_id);
    if (actionResult.normalized_values) {
      setDraft((current) => ({ ...current, ...actionResult.normalized_values }));
    }
  }
  // Re-project on every render so entity frame updates invalidate without a surface refresh.
  const invalid = hasInvalidControl(draft);
  const dispatch = submitDispatch(draft);
  collectAction?.(dispatch);
  const submitGated = Boolean(submitAction.disabled || invalid);

  return (
    <form className="uinode-form" data-ui-node-id={nodeId} data-form-invalid={invalid ? "true" : "false"}>
      {renderFields(draft, setDraft, actionResult)}
      {actionResult?.form_errors?.map((error) => (
        <IonNote color="danger" className="uinode-form-error" key={error}>{error}</IonNote>
      ))}
      <IonButton
        data-action-id={submitAction.id}
        disabled={submitGated}
        type="button"
        onClick={() => {
          // Fail closed at click time too: entity frames may have landed after last paint.
          if (submitAction.disabled) {
            markSubmitClick("blocked_disabled", submitGated);
            return;
          }
          if (hasInvalidControl(draft)) {
            markSubmitClick("blocked_invalid", submitGated);
            return;
          }
          dispatchAction?.(submitDispatch(draft));
          markSubmitClick("dispatched", submitGated);
        }}
      >
        {submitLabel}
      </IonButton>
    </form>
  );
}
