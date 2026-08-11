/** Package and navigation open controls for the Apps launcher. */

import { useCallback, useMemo, useRef } from "react";

import {
  packageAppSurfaces,
  type PackageSurfaceRecord,
  surfaceLaunchAction
} from "./packageSurfaces";
import type { AppRoute, AppView } from "./routing";
import { appRouteFromPathname } from "./routing";
import { appDisplayName, arrayOfStrings, firstString, readRecord, stringValue } from "./values";

export function usePackageOpenControls(options: {
  packages: Record<string, unknown>[];
  packageNavigation: Record<string, unknown>[];
  activeView: AppView;
  navigateToPluginSurface: (packageName: string, surfaceId: string) => void;
  navigateToPackageSettings: (packageName: string, surfaceId?: string) => void;
  navigateToHubRoutePath: (routePath: string) => boolean;
  navigateToRoute: (route: AppRoute) => void;
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
}) {
  const {
    packages,
    packageNavigation,
    activeView,
    navigateToPluginSurface,
    navigateToPackageSettings,
    navigateToHubRoutePath,
    navigateToRoute,
    setPackageActionToast
  } = options;

  const packageSettingsReturnRoute = useRef<AppRoute>({ view: "apps" });

  const appSurfacePackages = useMemo(
    () =>
      new Map(
        packages
          .map((appPackage) => [stringValue(appPackage.package_name, String(appPackage.id)), appPackage] as const)
          .filter(([, appPackage]) => packageAppSurfaces(appPackage).length > 0)
      ),
    [packages]
  );

  const navigateToPluginSurfaceRecord = useCallback((packageName: string, surface: PackageSurfaceRecord) => {
    const routePath = firstString(surface.route_path);
    const route = routePath ? appRouteFromPathname(routePath) : undefined;
    if (routePath && route?.view === "apps" && route.packageName) {
      if (!navigateToHubRoutePath(routePath)) {
        navigateToRoute(route);
      }
      return;
    }

    const surfaceId = firstString(surface.surface_id, surface.id);
    if (surfaceId) navigateToPluginSurface(packageName, surfaceId);
  }, [navigateToHubRoutePath, navigateToPluginSurface, navigateToRoute]);

  const openPackage = useCallback(
    (app: Record<string, unknown>) => {
      const surface = packageAppSurfaces(app)[0];
      const launchAction = surfaceLaunchAction(surface);
      const packageName = stringValue(app.package_name, String(app.id));
      if (launchAction && surface) {
        navigateToPluginSurfaceRecord(packageName, surface);
      } else {
        navigateToPackageSettings(packageName);
      }
    },
    [navigateToPackageSettings, navigateToPluginSurfaceRecord]
  );

  const openApp = useCallback((app: Record<string, unknown>) => {
    const title = appDisplayName(app.title, String(app.id));
    const kind = stringValue(app.kind, "");
    const targetKind = stringValue(app.launch_target_kind, kind);
    const localUrl = stringValue(app.local_url, "");
    const diagnostics = arrayOfStrings(app.diagnostics);
    const openAction = readRecord(app.open_action);
    const openDisabled = openAction.disabled === true;
    const surfacePackage = appSurfacePackages.get(stringValue(app.package_name, ""));
    const surface = packageAppSurfaces(surfacePackage ?? {})[0];
    const launchAction = surfaceLaunchAction(surface);

    const surfaceId = firstString(surface?.surface_id, surface?.id);
    const packageName = stringValue(app.package_name, "");
    if (launchAction && surface && surfaceId && packageName) {
      navigateToPluginSurfaceRecord(packageName, surface);
      return;
    }

    if (kind === "terminal_app" || targetKind === "terminal_app") {
      setPackageActionToast({
        message: `${title} requires local terminal launch.`,
        color: "medium"
      });
      return;
    }

    if (openDisabled && diagnostics.length > 0) {
      setPackageActionToast({
        message: `${title}: ${diagnostics[0]}`,
        color: "warning"
      });
      return;
    }

    if (!localUrl) {
      setPackageActionToast({
        message: `${title} has no hub-provided local URL.`,
        color: "warning"
      });
      return;
    }

    window.open(localUrl, "_blank", "noopener,noreferrer");
    setPackageActionToast({
      message: `Opening ${title}`,
      color: "success"
    });
  }, [appSurfacePackages, navigateToPluginSurfaceRecord, setPackageActionToast]);

  const openPackageSettings = useCallback((app: Record<string, unknown>) => {
    packageSettingsReturnRoute.current = activeView === "hub-settings"
      ? { view: "hub-settings", section: "extensions" }
      : { view: "apps" };
    navigateToPackageSettings(stringValue(app.package_name, String(app.id)));
  }, [activeView, navigateToPackageSettings]);

  const openPackageSettingsSurface = useCallback((packageName: string, surface: PackageSurfaceRecord) => {
    const surfaceId = firstString(surface.surface_id, surface.id);
    if (surfaceId) navigateToPackageSettings(packageName, surfaceId);
  }, [navigateToPackageSettings]);

  const openPackageNavigation = useCallback((entry: Record<string, unknown>) => {
    const targetKind = stringValue(entry.target_kind, "");
    if (targetKind !== "plugin_surface") return;

    const routePath = firstString(entry.route_path);
    if (routePath && navigateToHubRoutePath(routePath)) {
      return;
    }

    const packageName = firstString(entry.package_name);
    const surfaceId = firstString(entry.surface_id);
    if (packageName && surfaceId) {
      navigateToPluginSurface(packageName, surfaceId);
    }
  }, [navigateToHubRoutePath, navigateToPluginSurface]);

  return {
    appSurfacePackages,
    packageSettingsReturnRoute,
    packageNavigationShortcuts: packageNavigation,
    openPackage,
    openApp,
    openPackageSettings,
    openPackageSettingsSurface,
    openPackageNavigation
  };
}

export type PackageOpenControls = ReturnType<typeof usePackageOpenControls>;
