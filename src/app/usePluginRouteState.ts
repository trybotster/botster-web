/** Plugin app/settings route projection and Hub-driven surface render effects. */

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { actionFailureDiagnostic, type ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import type { HubEntityLoadKey } from "./hubLifecycle";
import {
  collectSurfaceEntityOptionFamilies,
  diffEntityOptionsDemand,
  releaseEntityOptionsDemand
} from "./entityOptionsDemand";
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
  selectedPluginSurface?: SelectedPluginSurface;
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
    selectedPluginSurface,
    recordDiagnostic,
    updateLocalState,
    setSelectedPluginSurface
  } = options;

  /** Authoritative claim for in-flight/app-visible plugin route render. */
  const claimedPluginRouteKey = useRef<string | undefined>(undefined);
  /** Families demanded for the current claim (surface-scoped + process-wide session chrome). */
  const demandedFamiliesRef = useRef<{ routeKey?: string; families: Set<string> }>({
    families: new Set()
  });

  /**
   * Claim-scoped entity-options demand uses held subscribe via hub entity_pull/entity_release.
   * Do not call entities.pull(): that registers the family in EntityFrameStore.activePulls, which
   * would survive route-exit release and could be restored by replayActivePulls (no production
   * caller today, but Hub Settings still surfaces the stale count).
   */
  const demandEntityFamily = useCallback((family: string) => {
    void runtimeClient.hub.send({ kind: "entity_pull", payload: { family } }).catch(() => undefined);
  }, [runtimeClient]);

  const releaseEntityFamily = useCallback((family: string) => {
    void runtimeClient.hub.send({ kind: "entity_release", payload: { family } }).catch(() => undefined);
  }, [runtimeClient]);

  const syncEntityOptionsDemand = useCallback((routeKey: string | undefined, root: unknown) => {
    const desired = routeKey ? collectSurfaceEntityOptionFamilies(root) : [];
    const previous = demandedFamiliesRef.current;

    if (previous.routeKey !== routeKey) {
      for (const family of releaseEntityOptionsDemand(previous.families)) {
        releaseEntityFamily(family);
      }
      demandedFamiliesRef.current = { routeKey, families: new Set() };
    }

    if (!routeKey) {
      demandedFamiliesRef.current = { families: new Set() };
      return;
    }

    const held = demandedFamiliesRef.current.families;
    const diff = diffEntityOptionsDemand(desired, held);
    for (const family of diff.demand) {
      demandEntityFamily(family);
    }
    for (const family of diff.release) {
      releaseEntityFamily(family);
    }
    demandedFamiliesRef.current = {
      routeKey,
      families: new Set(diff.nextHeld)
    };
  }, [demandEntityFamily, releaseEntityFamily]);

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
      syncEntityOptionsDemand(undefined, undefined);
    }
  }, [appRoute.routePluginSurfaceKey, settingsRoute.routeSettingsSurfaceKey, syncEntityOptionsDemand]);

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
      () => {
        setSelectedPluginSurface(pluginRouteRenderStarted(surfaceRecord, routeKey));
        // Clear surface-scoped demand while the new claim is loading.
        syncEntityOptionsDemand(routeKey, undefined);
      }
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
        if (renderedSurface.phase === "rendered" && renderedSurface.snapshot?.root) {
          syncEntityOptionsDemand(routeKey, renderedSurface.snapshot.root);
        }
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
    syncEntityOptionsDemand,
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
      () => {
        setSelectedPluginSurface(pluginRouteRenderStarted(surfaceRecord, routeKey));
        syncEntityOptionsDemand(routeKey, undefined);
      }
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
        if (renderedSurface.phase === "rendered" && renderedSurface.snapshot?.root) {
          syncEntityOptionsDemand(routeKey, renderedSurface.snapshot.root);
        }
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
    syncEntityOptionsDemand,
    updateLocalState
  ]);

  // Accepted action results may replace the surface root with new options_source families.
  // Demand stays claim-scoped: only the current claim may apply or refresh demand.
  useEffect(() => {
    const routeKey = selectedPluginSurface?.routeKey;
    if (!routeKey) return;
    if (selectedPluginSurface?.phase !== "rendered" || !selectedPluginSurface.snapshot?.root) return;
    applyPluginRouteCompletionIfCurrent(claimedPluginRouteKey.current, routeKey, () => {
      syncEntityOptionsDemand(routeKey, selectedPluginSurface.snapshot?.root);
    });
  }, [selectedPluginSurface, syncEntityOptionsDemand]);

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
