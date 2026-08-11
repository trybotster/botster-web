/** Browser route parsing and workbench path helpers. Hub remains authoritative for product policy. */

export type AppView = "dashboard" | "apps" | "hub-settings" | "session";
export type HubSettingsSection = "general" | "spawn-points" | "session-types" | "extensions" | "support";
export type AppRoute =
  | { view: "dashboard" }
  | { view: "apps"; packageName?: string; surfaceId?: string; settings?: false }
  | { view: "apps"; packageName: string; settings: true; surfaceId?: string }
  | { view: "hub-settings"; section?: HubSettingsSection }
  | { view: "session"; sessionId: string };

export const appViewPaths: Record<AppView, string> = {
  dashboard: "/dashboard",
  apps: "/apps",
  "hub-settings": "/settings",
  session: "/sessions"
};

export const hubSettingsSections: Array<{ id: HubSettingsSection; label: string; description: string }> = [
  { id: "general", label: "General", description: "Hub identity and software" },
  { id: "spawn-points", label: "Spawn points", description: "Where sessions can start" },
  { id: "session-types", label: "Session types", description: "How sessions are launched" },
  { id: "extensions", label: "Extensions", description: "Plugin configuration" },
  { id: "support", label: "Support", description: "Health and diagnostics" }
];

export function appRouteFromPathname(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/diagnostics" || normalizedPath.startsWith("/diagnostics/")) return { view: "hub-settings", section: "support" };
  if (normalizedPath === "/spawn-points" || normalizedPath.startsWith("/spawn-points/")) return { view: "hub-settings", section: "spawn-points" };
  if (normalizedPath.startsWith(`${appViewPaths.session}/`)) {
    const sessionId = decodeURIComponent(normalizedPath.slice(appViewPaths.session.length + 1));
    if (sessionId) return { view: "session", sessionId };
  }
  if (normalizedPath === appViewPaths["hub-settings"] || normalizedPath.startsWith(`${appViewPaths["hub-settings"]}/`)) {
    const section = normalizedPath.slice(appViewPaths["hub-settings"].length + 1) as HubSettingsSection;
    return { view: "hub-settings", section: hubSettingsSections.some((entry) => entry.id === section) ? section : "general" };
  }
  if (normalizedPath === appViewPaths.apps) return { view: "apps" };
  if (normalizedPath.startsWith("/packages/")) {
    const segments = normalizedPath
      .slice("/packages/".length)
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
    const [packageName, routeKind, targetId] = segments;
    if (!packageName) return { view: "apps" };
    if (routeKind === "settings") {
      return { view: "apps", packageName, settings: true };
    }
    if (routeKind === "surfaces" && targetId) {
      return { view: "apps", packageName, surfaceId: targetId, settings: false };
    }
    return { view: "apps", packageName };
  }
  if (normalizedPath.startsWith(`${appViewPaths.apps}/`)) {
    const segments = normalizedPath
      .slice(appViewPaths.apps.length + 1)
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
    const [packageName, secondSegment, thirdSegment] = segments;
    if (!packageName) return { view: "apps" };
    if (secondSegment === "settings") {
      return { view: "apps", packageName, settings: true, surfaceId: thirdSegment };
    }
    return { view: "apps", packageName, surfaceId: secondSegment, settings: false };
  }
  return { view: "dashboard" };
}

export function supportsHubRoutePath(routePath: string | undefined): boolean {
  if (!routePath) return false;
  const route = appRouteFromPathname(routePath);
  return route.view === "apps" && Boolean(route.packageName);
}

export function appViewFromRoute(route: AppRoute): AppView {
  return route.view;
}

export function appRouteFromLocation(): AppRoute {
  return appRouteFromPathname(window.location.pathname);
}

export function appRoutePath(route: AppRoute): string {
  if (route.view === "hub-settings") {
    return route.section
      ? `${appViewPaths["hub-settings"]}/${route.section}`
      : appViewPaths["hub-settings"];
  }
  if (route.view === "session") return `${appViewPaths.session}/${encodeURIComponent(route.sessionId)}`;
  if (route.view !== "apps") return appViewPaths[route.view];
  if (!route.packageName) return appViewPaths.apps;
  const packageSegment = encodeURIComponent(route.packageName);
  if (route.settings) {
    return route.surfaceId
      ? `${appViewPaths.apps}/${packageSegment}/settings/${encodeURIComponent(route.surfaceId)}`
      : `${appViewPaths.apps}/${packageSegment}/settings`;
  }
  return route.surfaceId
    ? `${appViewPaths.apps}/${packageSegment}/${encodeURIComponent(route.surfaceId)}`
    : appViewPaths.apps;
}

export function appRouteUrl(route: AppRoute): string {
  const url = new URL(window.location.href);
  url.pathname = appRoutePath(route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function pushAppRouteUrl(route: AppRoute): void {
  const nextUrl = appRouteUrl(route);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.pushState({ botsterRoute: route }, "", nextUrl);
  }
}
