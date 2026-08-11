/** Plugin app/settings route projection and Hub-driven surface render effects. */

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import type { HubEntityLoadKey } from "./hubLifecycle";
import { surfaceTitle } from "./packageSurfaces";
import type { SelectedPluginSurface } from "./pluginSurfaceState";
import {
  applyPluginRouteCompletionIfCurrent,
  claimPluginRouteRender,
  pluginRouteRenderCompleted,
  pluginRouteRenderStarted,
  pluginSurfaceStatusLocalState,
  projectPluginAppRoute,
  projectPluginSettingsRoute,
  type PluginRouteTarget
} from "./pluginRouteState";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function usePluginRouteState(options: {
  runtimeClient: RuntimeClient;
  packages: Record<string, unknown>[];
  availablePackages: Record<string, unknown>[];
  entityLoadStatus: Record<HubEntityLoadKey, HubEntityLoadStatus>;
  routePluginSurface?: PluginRouteTarget;
  routeSettingsPackageName?: string;
  routeSettingsSurfaceId?: string;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setSelectedPluginSurface: Dispatch<SetStateAction<SelectedPluginSurface | undefined>>;
}) {
  const {
    runtimeClient,
    packages,
    availablePackages,
    entityLoadStatus,
    routePluginSurface,
    routeSettingsPackageName,
    routeSettingsSurfaceId,
    recordDiagnostic,
    updateLocalState,
    setSelectedPluginSurface
  } = options;

  /** Authoritative claim for in-flight/app-visible plugin route render. */
  const claimedPluginRouteKey = useRef<string | undefined>(undefined);

  const appRoute = projectPluginAppRoute({
    packages,
    entityLoadStatus,
    routePluginSurface
  });
  const settingsRoute = projectPluginSettingsRoute({
    packages,
    availablePackages,
    entityLoadStatus,
    routeSettingsPackageName,
    routeSettingsSurfaceId
  });

  useEffect(() => {
    if (!appRoute.routePluginSurfaceKey && !settingsRoute.routeSettingsSurfaceKey) {
      claimedPluginRouteKey.current = undefined;
    }
  }, [appRoute.routePluginSurfaceKey, settingsRoute.routeSettingsSurfaceKey]);

  useEffect(() => {
    if (appRoute.routePluginSurfaceDiagnostic) return;
    if (!routePluginSurface) return;
    if (!appRoute.routePluginSurfaceKey || !appRoute.routePluginSurfaceRecord || !appRoute.routePluginLaunchAction) return;

    const routeKey = appRoute.routePluginSurfaceKey;
    const claim = claimPluginRouteRender(claimedPluginRouteKey.current, routeKey);
    if (!claim.claim) return;
    claimedPluginRouteKey.current = claim.nextLastKey;

    const expectedSurface = {
      packageName: routePluginSurface.packageName,
      surfaceId: appRoute.routePluginEffectiveSurfaceId ?? routePluginSurface.surfaceId
    };
    const surfaceRecord = appRoute.routePluginSurfaceRecord;
    const launchAction = appRoute.routePluginLaunchAction;

    // Start is only valid while this claim still owns the route.
    applyPluginRouteCompletionIfCurrent(
      claimedPluginRouteKey.current,
      routeKey,
      () => setSelectedPluginSurface(pluginRouteRenderStarted(surfaceRecord, routeKey))
    );

    void runtimeClient.actions.dispatch({ origin: "ui_node", action: launchAction }).then((result) => {
      // Stale completion: a later claim (other app/settings route) must keep authority.
      applyPluginRouteCompletionIfCurrent(claimedPluginRouteKey.current, routeKey, () => {
        const renderedSurface = pluginRouteRenderCompleted(
          result,
          launchAction.label ?? surfaceTitle(surfaceRecord),
          expectedSurface,
          routeKey
        );
        setSelectedPluginSurface(renderedSurface);
        updateLocalState(pluginSurfaceStatusLocalState(renderedSurface));
        recordDiagnostic(actionFailureDiagnostic(launchAction, result));
      });
    });
  }, [
    appRoute.routePluginEffectiveSurfaceId,
    appRoute.routePluginLaunchAction,
    appRoute.routePluginSurfaceDiagnostic,
    appRoute.routePluginSurfaceKey,
    appRoute.routePluginSurfaceRecord,
    recordDiagnostic,
    routePluginSurface,
    runtimeClient,
    setSelectedPluginSurface,
    updateLocalState
  ]);

  useEffect(() => {
    if (settingsRoute.routeSettingsSurfaceDiagnostic) return;
    if (!routeSettingsPackageName || !routeSettingsSurfaceId) return;
    if (!settingsRoute.routeSettingsSurfaceKey || !settingsRoute.routeSettingsSurfaceRecord || !settingsRoute.routeSettingsLaunchAction) return;

    const routeKey = settingsRoute.routeSettingsSurfaceKey;
    const claim = claimPluginRouteRender(claimedPluginRouteKey.current, routeKey);
    if (!claim.claim) return;
    claimedPluginRouteKey.current = claim.nextLastKey;

    const expectedSurface = {
      packageName: routeSettingsPackageName,
      surfaceId: routeSettingsSurfaceId
    };
    const surfaceRecord = settingsRoute.routeSettingsSurfaceRecord;
    const launchAction = settingsRoute.routeSettingsLaunchAction;

    applyPluginRouteCompletionIfCurrent(
      claimedPluginRouteKey.current,
      routeKey,
      () => setSelectedPluginSurface(pluginRouteRenderStarted(surfaceRecord, routeKey))
    );

    void runtimeClient.actions.dispatch({ origin: "ui_node", action: launchAction }).then((result) => {
      applyPluginRouteCompletionIfCurrent(claimedPluginRouteKey.current, routeKey, () => {
        const renderedSurface = pluginRouteRenderCompleted(
          result,
          launchAction.label ?? surfaceTitle(surfaceRecord),
          expectedSurface,
          routeKey
        );
        setSelectedPluginSurface(renderedSurface);
        updateLocalState(pluginSurfaceStatusLocalState(renderedSurface));
        recordDiagnostic(actionFailureDiagnostic(launchAction, result));
      });
    });
  }, [
    recordDiagnostic,
    routeSettingsPackageName,
    routeSettingsSurfaceId,
    runtimeClient,
    setSelectedPluginSurface,
    settingsRoute.routeSettingsLaunchAction,
    settingsRoute.routeSettingsSurfaceDiagnostic,
    settingsRoute.routeSettingsSurfaceKey,
    settingsRoute.routeSettingsSurfaceRecord,
    updateLocalState
  ]);

  return {
    routePluginSurfaceKey: appRoute.routePluginSurfaceKey,
    routePluginSurfaceDiagnostic: appRoute.routePluginSurfaceDiagnostic,
    settingsPackage: settingsRoute.settingsPackage,
    settingsPackageDiagnostic: settingsRoute.settingsPackageDiagnostic,
    routeSettingsSurfaceKey: settingsRoute.routeSettingsSurfaceKey,
    routeSettingsSurfaceDiagnostic: settingsRoute.routeSettingsSurfaceDiagnostic
  };
}

export type PluginRouteState = ReturnType<typeof usePluginRouteState>;
