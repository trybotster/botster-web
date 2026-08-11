/** Session-type authoring control (create, edit, delete). */

import { useCallback, useState } from "react";

import type { ActionBinding } from "../botster/actions";
import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import type { EntitySubscriptionErrorPayload } from "../botster/protocol";
import { sessionTypeActionFeedback } from "./actionFeedback";
import {
  createSessionTypeForm,
  rejectedSessionTypeForm,
  sessionTypeDefinitionFromForm,
  sessionTypeFormFromAuthoringDefinition,
  sessionTypeFormIsStructurallyComplete,
  sessionTypeMutationSource,
  sessionTypeMutationSourceFromRecord,
  type SessionTypeFormState
} from "./sessionTypes";
import { readRecord, stringValue } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function useSessionTypeControl(options: {
  runtimeClient: RuntimeClient;
  dispatchAction: (action: ActionBinding) => void;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
}) {
  const { runtimeClient, dispatchAction, recordDiagnostic, setPackageActionToast } = options;

  const [sessionTypeForm, setSessionTypeForm] = useState<SessionTypeFormState | undefined>();
  const [deleteSessionType, setDeleteSessionType] = useState<Record<string, unknown> | undefined>();
  const [sessionTypeSubscriptionError, setSessionTypeSubscriptionError] = useState<EntitySubscriptionErrorPayload | undefined>();

  const openCreateSessionType = useCallback(() => {
    setSessionTypeForm(createSessionTypeForm("agent"));
  }, []);

  const openEditSessionType = useCallback((sessionType: Record<string, unknown>) => {
    const compositeId = stringValue(
      sessionType.session_type_id,
      stringValue(sessionType.id, "")
    );
    if (!compositeId) return;

    const action: ActionBinding = {
      id: "botster.session_type.daemon_request",
      target: compositeId,
      label: "Load session type for edit",
      params: {
        daemon_request: {
          request_type: "show_session_type_definition",
          session_type_id: compositeId
        }
      }
    };

    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setPackageActionToast({
          message: result.reason ?? "Botster could not load this session type for editing.",
          color: "danger"
        });
        return;
      }

      const payload = readRecord(result.result);
      const editable = readRecord(payload.session_type_definition);
      const form = sessionTypeFormFromAuthoringDefinition(editable);
      if (!form) {
        setPackageActionToast({
          message: "Botster returned an incomplete authoring definition for this session type.",
          color: "danger"
        });
        return;
      }

      setSessionTypeForm(form);
    }).catch((error: unknown) => {
      setPackageActionToast({
        message: error instanceof Error ? error.message : "Botster could not load this session type for editing.",
        color: "danger"
      });
    });
  }, [recordDiagnostic, runtimeClient, setPackageActionToast]);

  const submitSessionTypeForm = useCallback(() => {
    if (!sessionTypeForm || !sessionTypeFormIsStructurallyComplete(sessionTypeForm)) return;
    if (sessionTypeForm.submitting) return;

    const isEdit = sessionTypeForm.mode === "edit";
    const action: ActionBinding = {
      id: "botster.session_type.daemon_request",
      target: sessionTypeForm.sessionTypeId,
      label: isEdit ? "Update session type" : "Create session type",
      params: {
        daemon_request: {
          request_type: isEdit ? "update_session_type" : "create_session_type",
          source: sessionTypeMutationSource(sessionTypeForm),
          definition: sessionTypeDefinitionFromForm(sessionTypeForm)
        }
      }
    };

    setSessionTypeForm((current) => current ? { ...current, submitting: true, error: undefined } : current);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setSessionTypeForm((current) => current ? rejectedSessionTypeForm(current, result) : current);
        return;
      }

      setSessionTypeForm(undefined);
      setPackageActionToast(sessionTypeActionFeedback(result) ?? { message: "Session type saved", color: "success" });
    }).catch((error: unknown) => {
      setSessionTypeForm((current) => current ? {
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : "Botster could not save this session type."
      } : current);
    });
  }, [recordDiagnostic, runtimeClient, sessionTypeForm, setPackageActionToast]);

  const confirmDeleteSessionType = useCallback(() => {
    if (!deleteSessionType) return;
    const definitionId = stringValue(deleteSessionType.definition_id, "");
    if (!definitionId) return;

    dispatchAction({
      id: "botster.session_type.daemon_request",
      target: stringValue(deleteSessionType.session_type_id, String(deleteSessionType.id)),
      label: "Delete session type",
      params: {
        daemon_request: {
          request_type: "delete_session_type",
          source: sessionTypeMutationSourceFromRecord(deleteSessionType),
          session_type_id: definitionId
        }
      }
    });
    setDeleteSessionType(undefined);
  }, [deleteSessionType, dispatchAction]);

  return {
    sessionTypeForm,
    setSessionTypeForm,
    deleteSessionType,
    setDeleteSessionType,
    sessionTypeSubscriptionError,
    setSessionTypeSubscriptionError,
    openCreateSessionType,
    openEditSessionType,
    submitSessionTypeForm,
    confirmDeleteSessionType
  };
}

export type SessionTypeControl = ReturnType<typeof useSessionTypeControl>;
