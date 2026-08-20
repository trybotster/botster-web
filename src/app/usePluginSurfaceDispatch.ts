/** Plugin surface action dispatch and local presentation updates. */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { ActionBinding } from "../botster/actions";
import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import {
  pluginSurfaceActionRequest,
  type UiActionRequest,
  type UiNodeActionDispatch
} from "../botster/uiNodes";
import {
  acceptedResultMatches,
  applyAcceptedPresentation,
  clearPresentationValue,
  replaceAcceptedSurface,
  type UiPresentationState
} from "../botster/uiPresentation";
import type { SelectedPluginSurface } from "./pluginSurfaceState";
import { pluginActionResultFeedback } from "./actionFeedback";
import { actionLabelFromId } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function usePluginSurfaceDispatch(options: {
  runtimeClient: RuntimeClient;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
  setSelectedPluginSurface: Dispatch<SetStateAction<SelectedPluginSurface | undefined>>;
}) {
  const {
    runtimeClient,
    recordDiagnostic,
    updateLocalState,
    setPackageActionToast,
    setSelectedPluginSurface
  } = options;

  const [uiPresentationState, setUiPresentationState] = useState<UiPresentationState>({});

  const dispatchPluginSurfaceAction = useCallback(
    (packageName: string, surfaceId: string, dispatch: UiNodeActionDispatch) => {
      const requestWithoutId = pluginSurfaceActionRequest(surfaceId, dispatch);
      const action: ActionBinding = {
        id: dispatch.action.id,
        payload: dispatch.action.payload,
        disabled: dispatch.action.disabled,
        pluginSurface: {
          package_name: packageName,
          request: requestWithoutId
        }
      };

      updateLocalState({ "production.diagnostic_action_status": `Dispatching ${dispatch.action.id}` });
      void runtimeClient.actions.dispatch({ origin: "plugin_surface", action }).then((result) => {
        const pluginActionResult = result.pluginActionResult;
        if (!pluginActionResult || !result.request_id) {
          setPackageActionToast({
            message: result.reason ?? `${actionLabelFromId(dispatch.action.id)} failed`,
            color: "danger"
          });
          return;
        }

        const request: UiActionRequest = { request_id: result.request_id, ...requestWithoutId };
        const identityMatches =
          pluginActionResult.request_id === request.request_id &&
          pluginActionResult.surface_id === request.surface_id &&
          pluginActionResult.action_id === request.action_id &&
          pluginActionResult.node_id === request.node_id;
        if (!identityMatches) {
          setPackageActionToast({ message: "Plugin action result identity mismatch", color: "danger" });
          return;
        }

        const scope = { hubId: "local", packageName, surfaceId };
        setUiPresentationState((current) => applyAcceptedPresentation(current, scope, request, pluginActionResult));
        setSelectedPluginSurface((current) => {
          if (!current?.snapshot || current.packageName !== packageName || current.surfaceId !== surfaceId) return current;

          return {
            ...current,
            actionResult: pluginActionResult,
            snapshot: acceptedResultMatches(request, pluginActionResult)
              ? {
                  ...current.snapshot,
                  root: replaceAcceptedSurface(current.snapshot.root, pluginActionResult)
                }
              : current.snapshot
          };
        });

        const accepted = acceptedResultMatches(request, pluginActionResult);
        setPackageActionToast(pluginActionResultFeedback(pluginActionResult));
        updateLocalState({
          "production.diagnostic_action_status": accepted
            ? `Accepted ${dispatch.action.id}`
            : pluginActionResult.error ?? `Rejected ${dispatch.action.id}`
        });
        recordDiagnostic(actionFailureDiagnostic(action, {
          accepted,
          request_id: result.request_id,
          result: result.result,
          reason: result.reason
        }));
      });
    },
    [recordDiagnostic, runtimeClient, setPackageActionToast, setSelectedPluginSurface, updateLocalState]
  );

  useEffect(() => {
    const harness = (window as typeof window & {
      __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
        dispatchPluginSurfaceAction?: (
          packageName: string,
          surfaceId: string,
          actionId: string,
          payload?: unknown
        ) => void;
      };
    }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    if (!harness) return;
    const dispatch = (packageName: string, surfaceId: string, actionId: string, payload?: unknown) => {
      dispatchPluginSurfaceAction(packageName, surfaceId, {
        action: { id: actionId, ...(payload !== undefined ? { payload } : {}) },
        node: {
          id: actionId,
          type: "button",
          props: { label: actionId, action: { id: actionId } }
        },
        kind: "submit"
      } as UiNodeActionDispatch);
    };
    harness.dispatchPluginSurfaceAction = dispatch;
    return () => {
      if (harness.dispatchPluginSurfaceAction === dispatch) {
        delete harness.dispatchPluginSurfaceAction;
      }
    };
  }, [dispatchPluginSurfaceAction]);

  const dismissPluginSurfacePresentation = useCallback((
    packageName: string,
    surfaceId: string,
    key: string
  ) => {
    setUiPresentationState((current) => clearPresentationValue(current, {
      hubId: "local",
      packageName,
      surfaceId
    }, key));
  }, []);

  return {
    uiPresentationState,
    dispatchPluginSurfaceAction,
    dismissPluginSurfacePresentation
  };
}

export type PluginSurfaceDispatch = ReturnType<typeof usePluginSurfaceDispatch>;
