/** Current-session actions and Hub-authored result feedback. */

import { useCallback, useRef, useState } from "react";

import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import { stopSessionAction } from "./sessionActions";

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

  return {
    stopSession,
    stoppingSessionIds
  };
}

export type SessionControl = ReturnType<typeof useSessionControl>;
