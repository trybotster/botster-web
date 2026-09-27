/** Shared Hub action dispatch, toast feedback, and live-harness bridge. */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ActionBinding } from "../botster/actions";
import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import type { StatusRefreshPayload } from "../botster/protocol";
import {
  packageActionFeedback,
  pluginSurfaceActionFeedback,
  quarantineActionFeedback,
  quarantineRefreshOutcome,
  quarantineResolveOutcome,
  sessionTypeActionFeedback,
  spawnTargetActionFeedback
} from "./actionFeedback";
import {
  hubUpdateCheckActionId,
  hubUpdateOutcomeFromResult,
  type HubUpdateOutcome
} from "./hubLifecycle";
import {
  quarantinedAtMsFromAction,
  quarantineTargetFromAction,
  quarantineTargetKey,
  resolveQuarantineActionId,
  settleQuarantineRefresh,
  settleQuarantineResult,
  startQuarantineResolve,
  type QuarantineResolveOutcome,
  type QuarantineRowOutcomes
} from "../botster/hubQuarantines";
import { renderedPluginSurfaceState, type SelectedPluginSurface } from "./pluginSurfaceState";
import { visibleStatusText } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function useHubActions(options: {
  runtimeClient: RuntimeClient;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setSelectedPluginSurface: Dispatch<SetStateAction<SelectedPluginSurface | undefined>>;
}) {
  const { runtimeClient, recordDiagnostic, updateLocalState, setSelectedPluginSurface } = options;
  const [packageActionToast, setPackageActionToast] = useState<{ message: string; color: string } | undefined>();
  const [hubUpdate, setHubUpdate] = useState<HubUpdateOutcome | undefined>();
  // Resolve feedback per quarantine target key; a clean resolve removes its entry.
  const [quarantineOutcomes, setQuarantineOutcomes] = useState<QuarantineRowOutcomes>({});
  const quarantineOperationSequence = useRef(0);

  const dispatchAction = useCallback(
    (
      action: ActionBinding,
      renderedSurfaceContext?: {
        expectedSurface: { packageName: string; surfaceId: string };
        routeKey: string;
      }
    ) => {
      const statusKey = "production.diagnostic_action_status";
      updateLocalState({ [statusKey]: `Dispatching ${action.id}` });
      // Each Resolve is one operation. Its result and its status_refresh settle the row only while
      // that operation still owns it; the Hub request itself carries only the target.
      const quarantineTarget = action.id === resolveQuarantineActionId ? quarantineTargetFromAction(action) : undefined;
      const quarantineOutcomeKey = quarantineTarget ? quarantineTargetKey(quarantineTarget) : undefined;
      const quarantineOperationId = quarantineOutcomeKey ? `resolve-${++quarantineOperationSequence.current}` : undefined;
      if (quarantineOutcomeKey && quarantineOperationId) {
        const quarantinedAtMs = quarantinedAtMsFromAction(action);
        action = { ...action, params: { ...action.params, operation_id: quarantineOperationId } };
        setQuarantineOutcomes((current) => startQuarantineResolve(current, quarantineOutcomeKey, quarantineOperationId, quarantinedAtMs));
      }
      const settleQuarantineOutcome = (outcome: QuarantineResolveOutcome) => {
        if (!quarantineOutcomeKey || !quarantineOperationId) return;
        setQuarantineOutcomes((current) => settleQuarantineResult(current, quarantineOutcomeKey, quarantineOperationId, outcome));
      };
      void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
        const renderedSurface = action.id === "botster.package.surface.render"
          ? renderedPluginSurfaceState(
              result,
              action.label ?? "Plugin surface",
              renderedSurfaceContext?.expectedSurface,
              renderedSurfaceContext?.routeKey
            )
          : undefined;
        if (renderedSurface) {
          setSelectedPluginSurface(renderedSurface);
        }
        const packageFeedback = action.id === "botster.package.daemon_request" || action.id === "botster.package.configuration.save"
          ? packageActionFeedback(result)
          : undefined;
        if (packageFeedback) {
          setPackageActionToast(packageFeedback);
        }
        const pluginSurfaceFeedback = pluginSurfaceActionFeedback(result);
        if (pluginSurfaceFeedback) {
          setPackageActionToast(pluginSurfaceFeedback);
        }
        const spawnTargetFeedback = spawnTargetActionFeedback(result);
        if (spawnTargetFeedback) {
          setPackageActionToast(spawnTargetFeedback);
        }
        const sessionTypeFeedback = sessionTypeActionFeedback(result);
        if (sessionTypeFeedback) {
          setPackageActionToast(sessionTypeFeedback);
        }
        const quarantineFeedback = quarantineActionFeedback(result);
        if (quarantineFeedback) {
          setPackageActionToast(quarantineFeedback);
        }
        if (quarantineOutcomeKey) {
          // A result without the resolve payload never reached the Hub's answer (for example,
          // the action deadline expired): failed, and Resolve is offered again.
          settleQuarantineOutcome(
            quarantineResolveOutcome(result) ?? { state: "failed", message: result.reason ?? "Resolve quarantine failed" }
          );
        }
        if (action.id === "botster.package.configuration.save") {
          void runtimeClient.entities.pull({ family: "botster-web.package" });
        }
        if (action.id === "botster.package.daemon_request" || action.id === "botster.package.configuration.save") {
          void runtimeClient.entities.pull({ family: "botster-web.package_navigation" });
        }
        if (action.id === "botster.spawn_target.daemon_request") {
          void runtimeClient.entities.pull({ family: "botster-web.spawn_target" });
        }
        if (action.id === hubUpdateCheckActionId) {
          setHubUpdate(hubUpdateOutcomeFromResult(result));
        }
        updateLocalState({
          [statusKey]: result.accepted
            ? `Accepted ${action.id}`
            : result.reason ?? `Rejected ${action.id}`,
          ...(renderedSurface?.status ? { "production.plugin_surface_status": visibleStatusText(renderedSurface.status) } : {})
        });
        recordDiagnostic(actionFailureDiagnostic(action, result));
      }).catch((error: unknown) => {
        settleQuarantineOutcome({
          state: "failed",
          message: error instanceof Error ? error.message : "Resolve quarantine failed"
        });
        updateLocalState({
          [statusKey]: error instanceof Error ? error.message : `Rejected ${action.id}`
        });
      });
    },
    [recordDiagnostic, runtimeClient, setSelectedPluginSurface, updateLocalState]
  );

  // After a confirmed resolve, the transport reads status again and reports that read in a
  // status_refresh frame: success clears the row outcome, failure makes it resolved_stale.
  useEffect(() => runtimeClient.hub.onFrame((frame) => {
    if (frame.kind !== "status_refresh") return;
    const payload = frame.payload as StatusRefreshPayload;
    const target = quarantineTargetFromAction({ id: resolveQuarantineActionId, params: { target: payload.target } });
    const operationId = payload.operation_id;
    if (payload.cause !== "resolve_quarantine" || !target || !operationId) return;
    const key = quarantineTargetKey(target);
    const outcome = quarantineRefreshOutcome(payload);
    setQuarantineOutcomes((current) => settleQuarantineRefresh(current, key, operationId, outcome));
    if (outcome) setPackageActionToast({ message: outcome.message, color: "warning" });
  }), [runtimeClient]);

  useEffect(() => {
    const harness = (window as typeof window & {
      __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
        dispatchAction?: (
          action: ActionBinding,
          renderedSurfaceContext?: {
            expectedSurface: { packageName: string; surfaceId: string };
            routeKey: string;
          }
        ) => void;
      };
    }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    if (!harness) return;

    harness.dispatchAction = dispatchAction;
    return () => {
      if (harness.dispatchAction === dispatchAction) {
        delete harness.dispatchAction;
      }
    };
  }, [dispatchAction]);

  return {
    dispatchAction,
    packageActionToast,
    setPackageActionToast,
    hubUpdate,
    setHubUpdate,
    quarantineOutcomes
  };
}

export type HubActions = ReturnType<typeof useHubActions>;
