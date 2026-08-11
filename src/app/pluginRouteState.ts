/** Plugin app/settings route projection from Hub package rows. */

import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import type { HubEntityLoadKey } from "./hubLifecycle";
import {
  packageAppSurfaces,
  packageSettingsSurfaces,
  type PackageSurfaceRecord,
  surfaceLaunchAction,
  surfaceTitle
} from "./packageSurfaces";
import type { SelectedPluginSurface } from "./pluginSurfaceState";
import { renderedPluginSurfaceState } from "./pluginSurfaceState";
import { firstString, stringValue, visibleStatusText } from "./values";

export interface PluginRouteTarget {
  packageName: string;
  surfaceId: string;
}

export interface PluginAppRouteProjection {
  routePluginSurfaceKey?: string;
  routePluginSurfaceDiagnostic?: string;
  routePluginSurfaceRecord?: PackageSurfaceRecord;
  routePluginLaunchAction?: ReturnType<typeof surfaceLaunchAction>;
  routePluginEffectiveSurfaceId?: string;
}

export interface PluginSettingsRouteProjection {
  settingsPackage?: Record<string, unknown>;
  settingsPackageDiagnostic?: string;
  routeSettingsSurfaceKey?: string;
  routeSettingsSurfaceDiagnostic?: string;
  routeSettingsSurfaceRecord?: PackageSurfaceRecord;
  routeSettingsLaunchAction?: ReturnType<typeof surfaceLaunchAction>;
}

export function projectPluginAppRoute(options: {
  packages: Record<string, unknown>[];
  entityLoadStatus: Record<HubEntityLoadKey, HubEntityLoadStatus>;
  routePluginSurface?: PluginRouteTarget;
}): PluginAppRouteProjection {
  const { packages, entityLoadStatus, routePluginSurface } = options;
  if (!routePluginSurface) return {};

  const routePluginPackage = packages.find(
    (appPackage) => stringValue(appPackage.package_name, String(appPackage.id)) === routePluginSurface.packageName
  );
  const routePluginRequestedSurfaceRecord = routePluginPackage
    ? packageAppSurfaces(routePluginPackage).find(
        (surface) => firstString(surface.surface_id, surface.id) === routePluginSurface.surfaceId
      )
    : undefined;
  const routePluginCanonicalSurfaceRecord = routePluginPackage && !routePluginRequestedSurfaceRecord
    ? packageAppSurfaces(routePluginPackage).length === 1
      ? packageAppSurfaces(routePluginPackage)[0]
      : undefined
    : undefined;
  const routePluginSurfaceRecord = routePluginRequestedSurfaceRecord ?? routePluginCanonicalSurfaceRecord;
  const routePluginEffectiveSurfaceId = routePluginSurfaceRecord
    ? firstString(routePluginSurfaceRecord.surface_id, routePluginSurfaceRecord.id)
    : routePluginSurface.surfaceId;
  const routePluginSurfaceKey = routePluginEffectiveSurfaceId
    ? `${routePluginSurface.packageName}/${routePluginEffectiveSurfaceId}`
    : undefined;
  const routePluginLaunchAction = surfaceLaunchAction(routePluginSurfaceRecord);
  const routePluginSurfaceDiagnostic =
    entityLoadStatus.package !== "loaded"
      ? "Loading package surfaces from the hub."
      : !routePluginPackage
        ? `No package named ${routePluginSurface.packageName} is loaded from the hub.`
        : !routePluginRequestedSurfaceRecord && !routePluginCanonicalSurfaceRecord
          ? `Package ${routePluginSurface.packageName} does not expose app surface ${routePluginSurface.surfaceId}.`
          : routePluginSurfaceRecord?.route_enabled === false
            ? `Surface ${routePluginEffectiveSurfaceId ?? routePluginSurface.surfaceId} is disabled by the hub route descriptor.`
            : routePluginSurfaceRecord?.route_blocked === true
              ? `Surface ${routePluginEffectiveSurfaceId ?? routePluginSurface.surfaceId} is blocked by the hub route descriptor.`
              : !routePluginLaunchAction
                ? `Surface ${routePluginEffectiveSurfaceId ?? routePluginSurface.surfaceId} has no hub-provided render action.`
                : undefined;

  return {
    routePluginSurfaceKey,
    routePluginSurfaceDiagnostic,
    routePluginSurfaceRecord,
    routePluginLaunchAction,
    routePluginEffectiveSurfaceId
  };
}

export function projectPluginSettingsRoute(options: {
  packages: Record<string, unknown>[];
  availablePackages: Record<string, unknown>[];
  entityLoadStatus: Record<HubEntityLoadKey, HubEntityLoadStatus>;
  routeSettingsPackageName?: string;
  routeSettingsSurfaceId?: string;
}): PluginSettingsRouteProjection {
  const {
    packages,
    availablePackages,
    entityLoadStatus,
    routeSettingsPackageName,
    routeSettingsSurfaceId
  } = options;
  if (!routeSettingsPackageName) return {};

  const settingsPackage = packages.find((app) => stringValue(app.package_name, String(app.id)) === routeSettingsPackageName)
    ?? availablePackages.find((app) => stringValue(app.package_name, String(app.id)) === routeSettingsPackageName);
  const settingsPackageDiagnostic =
    entityLoadStatus.package !== "loaded"
      ? "Loading package settings from the hub."
      : !settingsPackage
        ? `No package named ${routeSettingsPackageName} is loaded from the hub.`
        : undefined;
  const routeSettingsSurfaceRecord = settingsPackage && routeSettingsSurfaceId
    ? packageSettingsSurfaces(settingsPackage).find(
        (surface) => firstString(surface.surface_id, surface.id) === routeSettingsSurfaceId
      )
    : undefined;
  const routeSettingsLaunchAction = surfaceLaunchAction(routeSettingsSurfaceRecord);
  const routeSettingsSurfaceKey = routeSettingsPackageName && routeSettingsSurfaceId
    ? `${routeSettingsPackageName}/settings/${routeSettingsSurfaceId}`
    : undefined;
  const routeSettingsSurfaceDiagnostic = routeSettingsSurfaceId
    ? settingsPackageDiagnostic
      ? settingsPackageDiagnostic
      : !routeSettingsSurfaceRecord
        ? `Package ${routeSettingsPackageName} does not expose settings surface ${routeSettingsSurfaceId}.`
        : routeSettingsSurfaceRecord.route_enabled === false
          ? `Settings surface ${routeSettingsSurfaceId} is disabled by the hub route descriptor.`
          : routeSettingsSurfaceRecord.route_blocked === true
            ? `Settings surface ${routeSettingsSurfaceId} is blocked by the hub route descriptor.`
            : !routeSettingsLaunchAction
              ? `Settings surface ${routeSettingsSurfaceId} has no hub-provided render action.`
              : undefined
    : undefined;

  return {
    settingsPackage,
    settingsPackageDiagnostic,
    routeSettingsSurfaceKey,
    routeSettingsSurfaceDiagnostic,
    routeSettingsSurfaceRecord,
    routeSettingsLaunchAction
  };
}

/**
 * Race protection for plugin route renders: only one in-flight render per route key.
 * Returns false when the same key was already rendered (caller must skip).
 */
export function claimPluginRouteRender(
  lastRenderedKey: string | undefined,
  nextRouteKey: string | undefined
): { claim: boolean; nextLastKey: string | undefined } {
  if (!nextRouteKey) {
    return { claim: false, nextLastKey: undefined };
  }
  if (lastRenderedKey === nextRouteKey) {
    return { claim: false, nextLastKey: lastRenderedKey };
  }
  return { claim: true, nextLastKey: nextRouteKey };
}

/**
 * Stale-completion guard: apply state only when the claimed route is still current.
 * An older app/settings render that finishes after a newer claim must not write state.
 */
export function isPluginRouteCompletionCurrent(
  claimedKey: string | undefined,
  completionKey: string
): boolean {
  return claimedKey === completionKey;
}

/**
 * Apply a completion side-effect only while completionKey still matches the claim.
 * Returns true when the effect ran.
 */
export function applyPluginRouteCompletionIfCurrent(
  claimedKey: string | undefined,
  completionKey: string,
  apply: () => void
): boolean {
  if (!isPluginRouteCompletionCurrent(claimedKey, completionKey)) {
    return false;
  }
  apply();
  return true;
}

export function pluginRouteRenderStarted(
  surfaceRecord: PackageSurfaceRecord,
  routeKey: string
): SelectedPluginSurface {
  return {
    routeKey,
    title: surfaceTitle(surfaceRecord),
    phase: "rendering",
    status: `Rendering ${surfaceTitle(surfaceRecord)}`
  };
}

export function pluginRouteRenderCompleted(
  result: { accepted: boolean; reason?: string; result?: unknown },
  launchLabel: string,
  expectedSurface: PluginRouteTarget,
  routeKey: string
): SelectedPluginSurface {
  return renderedPluginSurfaceState(result, launchLabel, expectedSurface, routeKey);
}

export function pluginSurfaceStatusLocalState(
  renderedSurface: SelectedPluginSurface
): Record<string, unknown> {
  return {
    "production.plugin_surface_status": renderedSurface.status
      ? visibleStatusText(renderedSurface.status)
      : undefined
  };
}
