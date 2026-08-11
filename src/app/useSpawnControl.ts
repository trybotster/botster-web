/** Spawn-point CRUD and new-session picker control. */

import { useCallback, useRef, useState } from "react";

import type { ActionBinding } from "../botster/actions";
import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import {
  applySpawnSessionListResult,
  listSessionTypesForTargetAction,
  rejectedSpawnSessionForm,
  spawnSessionAction,
  spawnSessionFormForTarget,
  type SpawnSessionFormState
} from "./spawnSession";
import {
  emptySpawnTargetForm,
  spawnTargetFormFromRecord,
  spawnTargetIdFromLabel,
  type SpawnTargetFormState
} from "./spawnTargets";
import { parseMetadata, readRecord, stringValue, visibleStatusText } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function useSpawnControl(options: {
  runtimeClient: RuntimeClient;
  dispatchAction: (action: ActionBinding) => void;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
  navigateToView: (view: "dashboard") => void;
  navigateToHubSettings: (section: "session-types") => void;
}) {
  const {
    runtimeClient,
    dispatchAction,
    recordDiagnostic,
    updateLocalState,
    setPackageActionToast,
    navigateToView,
    navigateToHubSettings
  } = options;

  const [spawnTargetForm, setSpawnTargetForm] = useState<SpawnTargetFormState | undefined>();
  const [spawnSessionForm, setSpawnSessionForm] = useState<SpawnSessionFormState | undefined>();
  const [deleteSpawnTarget, setDeleteSpawnTarget] = useState<Record<string, unknown> | undefined>();
  const spawnSessionListGeneration = useRef(0);

  const openCreateSpawnTarget = useCallback(() => {
    setSpawnTargetForm(emptySpawnTargetForm);
  }, []);
  const openEditSpawnTarget = useCallback((target: Record<string, unknown>) => {
    setSpawnTargetForm(spawnTargetFormFromRecord(target));
  }, []);
  const submitSpawnTargetForm = useCallback(() => {
    if (!spawnTargetForm) return;
    const root = spawnTargetForm.root.trim();
    const label = spawnTargetForm.label.trim();
    const targetId = spawnTargetForm.targetId.trim() || spawnTargetIdFromLabel(label);
    if (!root || !label || !targetId || (spawnTargetForm.mode === "edit" && !spawnTargetForm.originalTargetId)) return;

    const requestType = spawnTargetForm.mode === "create" ? "create_spawn_target" : "update_spawn_target";
    dispatchAction({
      id: "botster.spawn_target.daemon_request",
      target: spawnTargetForm.mode === "edit" ? spawnTargetForm.originalTargetId : targetId,
      label: spawnTargetForm.mode === "create" ? "Create spawn point" : "Save spawn point",
      params: {
        daemon_request: {
          request_type: requestType,
          target_id: spawnTargetForm.mode === "create" ? targetId || undefined : spawnTargetForm.originalTargetId,
          label,
          root,
          enabled: spawnTargetForm.enabled,
          kind: spawnTargetForm.kind.trim() || "directory",
          metadata: parseMetadata(spawnTargetForm.metadata)
        }
      }
    });
    setSpawnTargetForm(undefined);
  }, [dispatchAction, spawnTargetForm]);
  const confirmDeleteSpawnTarget = useCallback(() => {
    if (!deleteSpawnTarget) return;
    const targetId = stringValue(deleteSpawnTarget.target_id, String(deleteSpawnTarget.id));
    if (!targetId) return;
    dispatchAction({
      id: "botster.spawn_target.daemon_request",
      target: targetId,
      label: "Delete spawn point",
      params: {
        daemon_request: {
          request_type: "delete_spawn_target",
          target_id: targetId
        }
      }
    });
    setDeleteSpawnTarget(undefined);
  }, [deleteSpawnTarget, dispatchAction]);

  const openSpawnSession = useCallback((target: Record<string, unknown>) => {
    spawnSessionListGeneration.current += 1;
    const listGeneration = spawnSessionListGeneration.current;
    const form = spawnSessionFormForTarget(target, listGeneration);
    setSpawnSessionForm(form);
    const action = listSessionTypesForTargetAction(form.targetId);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      const payload = readRecord(result.result);
      setSpawnSessionForm((current) => applySpawnSessionListResult(
        current,
        { targetId: form.targetId, listGeneration },
        {
          accepted: result.accepted,
          reason: result.reason,
          sessionTypes: payload.session_types
        }
      ) ?? current);
    }).catch((error: unknown) => {
      setSpawnSessionForm((current) => applySpawnSessionListResult(
        current,
        { targetId: form.targetId, listGeneration },
        {
          accepted: false,
          reason: error instanceof Error ? error.message : undefined
        }
      ) ?? current);
    });
  }, [recordDiagnostic, runtimeClient]);

  const submitSpawnSession = useCallback(() => {
    if (!spawnSessionForm || !spawnSessionForm.sessionTypeId || spawnSessionForm.submitting) return;
    const sessionId = crypto.randomUUID();
    const action = spawnSessionAction(spawnSessionForm, sessionId);

    setSpawnSessionForm((current) => current ? { ...current, submitting: true, error: undefined } : current);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setSpawnSessionForm((current) => current ? rejectedSpawnSessionForm(current, result.reason) : current);
        return;
      }

      const resultPayload = readRecord(result.result);
      const spawnedSessionId = stringValue(resultPayload.session_id, sessionId);
      setSpawnSessionForm(undefined);
      setPackageActionToast({ message: `Session started at ${spawnSessionForm.targetLabel}`, color: "success" });
      updateLocalState({ "production.diagnostic_action_status": `Started session ${visibleStatusText(spawnedSessionId)}` });
      navigateToView("dashboard");
    }).catch((error: unknown) => {
      setSpawnSessionForm((current) => current ? rejectedSpawnSessionForm(
        current,
        error instanceof Error ? error.message : undefined
      ) : current);
    });
  }, [navigateToView, recordDiagnostic, runtimeClient, setPackageActionToast, spawnSessionForm, updateLocalState]);

  const manageSessionTypesFromSpawn = useCallback(() => {
    setSpawnSessionForm(undefined);
    navigateToHubSettings("session-types");
  }, [navigateToHubSettings]);

  return {
    spawnTargetForm,
    setSpawnTargetForm,
    spawnSessionForm,
    setSpawnSessionForm,
    deleteSpawnTarget,
    setDeleteSpawnTarget,
    openCreateSpawnTarget,
    openEditSpawnTarget,
    submitSpawnTargetForm,
    confirmDeleteSpawnTarget,
    openSpawnSession,
    submitSpawnSession,
    manageSessionTypesFromSpawn
  };
}

export type SpawnControl = ReturnType<typeof useSpawnControl>;
