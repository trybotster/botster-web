/** Shared Hub action dispatch, toast feedback, and live-harness bridge. */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { ActionBinding } from "../botster/actions";
import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import {
  packageActionFeedback,
  pluginSurfaceActionFeedback,
  sessionTypeActionFeedback,
  spawnTargetActionFeedback
} from "./actionFeedback";
import {
  hubUpdateCheckActionId,
  hubUpdateOutcomeFromResult,
  type HubUpdateOutcome
} from "./hubLifecycle";
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
        updateLocalState({
          [statusKey]: error instanceof Error ? error.message : `Rejected ${action.id}`
        });
      });
    },
    [recordDiagnostic, runtimeClient, setSelectedPluginSurface, updateLocalState]
  );

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
    setHubUpdate
  };
}

export type HubActions = ReturnType<typeof useHubActions>;
