/** Current-session actions and Hub-authored result feedback. */

import { useCallback, useRef, useState } from "react";

import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import { removeSessionAction, restartSessionAction, stopSessionAction } from "./sessionActions";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function useSessionControl(options: {
  runtimeClient: RuntimeClient;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
}) {
  const { runtimeClient, recordDiagnostic, setPackageActionToast, updateLocalState } = options;
  const [stoppingSessionIds, setStoppingSessionIds] = useState<ReadonlySet<string>>(() => new Set());
  const stoppingSessionIdsRef = useRef(new Set<string>());

  const stopSession = useCallback((sessionId: string) => {
    if (stoppingSessionIdsRef.current.has(sessionId)) return;

    const action = stopSessionAction(sessionId);
    stoppingSessionIdsRef.current.add(sessionId);
    setStoppingSessionIds(new Set(stoppingSessionIdsRef.current));
    updateLocalState({ "production.diagnostic_action_status": `Stopping session ${sessionId}` });

    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      setPackageActionToast({
        message: result.accepted
          ? `Stopping session ${sessionId}`
          : result.reason ?? `Botster could not stop session ${sessionId}.`,
        color: result.accepted ? "success" : "danger"
      });
      updateLocalState({
        "production.diagnostic_action_status": result.accepted
          ? `Accepted ${action.id}`
          : result.reason ?? `Rejected ${action.id}`
      });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : `Botster could not stop session ${sessionId}.`;
      setPackageActionToast({ message, color: "danger" });
      updateLocalState({ "production.diagnostic_action_status": message });
    }).finally(() => {
      stoppingSessionIdsRef.current.delete(sessionId);
      setStoppingSessionIds(new Set(stoppingSessionIdsRef.current));
    });
  }, [recordDiagnostic, runtimeClient, setPackageActionToast, updateLocalState]);

  const [removingSessionIds, setRemovingSessionIds] = useState<ReadonlySet<string>>(() => new Set());
  const removingSessionIdsRef = useRef(new Set<string>());

  // Recovery for an ended session: the Hub forgets it and the entity stream removes its row.
  const removeSession = useCallback((sessionId: string) => {
    if (removingSessionIdsRef.current.has(sessionId)) return;

    const action = removeSessionAction(sessionId);
    removingSessionIdsRef.current.add(sessionId);
    setRemovingSessionIds(new Set(removingSessionIdsRef.current));
    updateLocalState({ "production.diagnostic_action_status": `Removing session ${sessionId}` });

    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      setPackageActionToast({
        message: result.accepted
          ? `Removed session ${sessionId}`
          : result.reason ?? `Botster could not remove session ${sessionId}.`,
        color: result.accepted ? "success" : "danger"
      });
      updateLocalState({
        "production.diagnostic_action_status": result.accepted
          ? `Accepted ${action.id}`
          : result.reason ?? `Rejected ${action.id}`
      });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : `Botster could not remove session ${sessionId}.`;
      setPackageActionToast({ message, color: "danger" });
      updateLocalState({ "production.diagnostic_action_status": message });
    }).finally(() => {
      removingSessionIdsRef.current.delete(sessionId);
      setRemovingSessionIds(new Set(removingSessionIdsRef.current));
    });
  }, [recordDiagnostic, runtimeClient, setPackageActionToast, updateLocalState]);

  const [restartingSessionIds, setRestartingSessionIds] = useState<ReadonlySet<string>>(() => new Set());
  const restartingSessionIdsRef = useRef(new Set<string>());

  // Recovery for an ended session the Hub can restart (restartable): the same id runs again, and
  // the entity stream moves its row back to current. The Hub refuses anything else with a typed
  // code, and its message is shown.
  const restartSession = useCallback((sessionId: string) => {
    if (restartingSessionIdsRef.current.has(sessionId)) return;

    const action = restartSessionAction(sessionId);
    restartingSessionIdsRef.current.add(sessionId);
    setRestartingSessionIds(new Set(restartingSessionIdsRef.current));
    updateLocalState({ "production.diagnostic_action_status": `Restarting session ${sessionId}` });

    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      setPackageActionToast({
        message: result.accepted
          ? `Restarted session ${sessionId}`
          : result.reason ?? `Botster could not restart session ${sessionId}.`,
        color: result.accepted ? "success" : "danger"
      });
      updateLocalState({
        "production.diagnostic_action_status": result.accepted
          ? `Accepted ${action.id}`
          : result.reason ?? `Rejected ${action.id}`
      });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : `Botster could not restart session ${sessionId}.`;
      setPackageActionToast({ message, color: "danger" });
      updateLocalState({ "production.diagnostic_action_status": message });
    }).finally(() => {
      restartingSessionIdsRef.current.delete(sessionId);
      setRestartingSessionIds(new Set(restartingSessionIdsRef.current));
    });
  }, [recordDiagnostic, runtimeClient, setPackageActionToast, updateLocalState]);

  return {
    stopSession,
    stoppingSessionIds,
    removeSession,
    removingSessionIds,
    restartSession,
    restartingSessionIds
  };
}

export type SessionControl = ReturnType<typeof useSessionControl>;
