/** Browser route state and navigation helpers for the workbench shell. */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  appRouteFromLocation,
  appRouteFromPathname,
  appViewFromRoute,
  type AppRoute,
  type AppView,
  type HubSettingsSection,
  pushAppRouteUrl,
  supportsHubRoutePath
} from "./routing";

export function useAppNavigation() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => appRouteFromLocation());

  const navigateToRoute = useCallback((route: AppRoute) => {
    setActiveRoute(route);
    pushAppRouteUrl(route);
  }, []);

  const navigateToHubRoutePath = useCallback((routePath: string) => {
    if (!supportsHubRoutePath(routePath)) return false;
    const route = appRouteFromPathname(routePath);
    const url = new URL(window.location.href);
    url.pathname = routePath;
    setActiveRoute(route);
    window.history.pushState({ botsterRoute: route }, "", `${url.pathname}${url.search}${url.hash}`);
    return true;
  }, []);

  const navigateToView = useCallback((view: AppView) => {
    navigateToRoute({ view } as AppRoute);
  }, [navigateToRoute]);

  const navigateToHubSettings = useCallback((section: HubSettingsSection = "general") => {
    navigateToRoute({ view: "hub-settings", section });
  }, [navigateToRoute]);

  const activeView = appViewFromRoute(activeRoute);
  const activeHubSettingsSection = activeRoute.view === "hub-settings"
    ? activeRoute.section ?? "general"
    : "general";

  const routePluginSurface = useMemo(
    () => activeRoute.view === "apps" && !activeRoute.settings && activeRoute.packageName && activeRoute.surfaceId
      ? { packageName: activeRoute.packageName, surfaceId: activeRoute.surfaceId }
      : undefined,
    [activeRoute]
  );
  const routeSettingsPackageName = activeRoute.view === "apps" && activeRoute.settings ? activeRoute.packageName : undefined;
  const routeSettingsSurfaceId = activeRoute.view === "apps" && activeRoute.settings ? activeRoute.surfaceId : undefined;

  const navigateToPluginSurface = useCallback((packageName: string, surfaceId: string) => {
    navigateToRoute({ view: "apps", packageName, surfaceId, settings: false });
  }, [navigateToRoute]);

  const navigateToPackageSettings = useCallback((packageName: string, surfaceId?: string) => {
    navigateToRoute({ view: "apps", packageName, settings: true, surfaceId });
  }, [navigateToRoute]);

  useEffect(() => {
    const syncViewFromLocation = () => {
      setActiveRoute(appRouteFromLocation());
    };

    window.history.replaceState({ botsterRoute: appRouteFromLocation() }, "", window.location.href);
    window.addEventListener("popstate", syncViewFromLocation);

    return () => {
      window.removeEventListener("popstate", syncViewFromLocation);
    };
  }, []);

  return {
    activeRoute,
    activeView,
    activeHubSettingsSection,
    routePluginSurface,
    routeSettingsPackageName,
    routeSettingsSurfaceId,
    navigateToRoute,
    navigateToHubRoutePath,
    navigateToView,
    navigateToHubSettings,
    navigateToPluginSurface,
    navigateToPackageSettings,
    setActiveRoute
  };
}

export type AppNavigation = ReturnType<typeof useAppNavigation>;
