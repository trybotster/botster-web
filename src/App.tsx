import {
  IonApp,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonNote,
  IonPage,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSplitPane,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
  setupIonicReact
} from "@ionic/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cogOutline,
  constructOutline,
  cubeOutline,
  gitBranchOutline,
  keyOutline,
  layersOutline,
  listCircleOutline,
  openOutline,
  powerOutline,
  pricetagOutline,
  refreshOutline,
  serverOutline
} from "ionicons/icons";

import { TerminalViewHost } from "./botster/TerminalViewHost";
import { ConnectionDiagnosticsPanel } from "./botster/ConnectionDiagnosticsPanel";
import { DogfoodFirstScreen, type DogfoodEntityLoadStatus } from "./botster/dogfoodFirstScreen";
import { UiNodeSurface } from "./botster/UiNodeSurface";
import { botsterWebCapabilities, defaultUiCapabilitySet } from "./botster/capabilities";
import { botsterWebClientContract, createBotsterWebClient } from "./botster/client";
import {
  actionFailureDiagnostic,
  compatibilityDiagnosticsFromFrame,
  connectionFailureDiagnostic,
  hubConnectionDiagnosticFromFrame,
  initialConnectionDiagnostics,
  operatorErrorDiagnostic,
  schemaVersionDiagnosticFromFrame,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  type ConnectionDiagnostic
} from "./botster/connectionDiagnostics";
import { createDogfoodRuntimeConfig, terminalDataPlaneLabel } from "./botster/dogfoodMode";
import { realHubDogfoodSessionId } from "./botster/realHubDogfoodTransport";
import { webRtcDaemonLifecycleEventName, type LocalWebrtcBootstrap, type WebrtcDaemonLifecycleEvent } from "./botster/webrtcDaemonClient";
import type { ActionBinding } from "./botster/actions";
import type { EntityFrameStore } from "./botster/entities";
import type { TerminalDataPlaneAttachment, TerminalViewDescriptor } from "./botster/terminal";
import type { UiTreeSnapshot } from "./botster/uiNodes";
import { configurationFieldType, configurationSaveAction } from "./packageConfigurationForm";

const mobileUserAgentPattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

setupIonicReact({
  mode: "md",
  platform: {
    desktop: (win) => !mobileUserAgentPattern.test(win.navigator.userAgent)
  }
});

type AppView = "dashboard" | "apps" | "diagnostics";
type AppRoute =
  | { view: "dashboard" }
  | { view: "apps"; packageName?: string; surfaceId?: string; settings?: false }
  | { view: "apps"; packageName: string; settings: true; surfaceId?: string }
  | { view: "diagnostics" };

const navigationItems: Array<{ label: string; icon: string; view: AppView }> = [
  { label: "Dashboard", icon: layersOutline, view: "dashboard" },
  { label: "Apps", icon: cubeOutline, view: "apps" },
  { label: "Diagnostics", icon: listCircleOutline, view: "diagnostics" }
];

const appViewPaths: Record<AppView, string> = {
  dashboard: "/dashboard",
  apps: "/apps",
  diagnostics: "/diagnostics"
};

function appRouteFromPathname(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === appViewPaths.diagnostics || normalizedPath.startsWith(`${appViewPaths.diagnostics}/`)) return { view: "diagnostics" };
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

function supportsHubRoutePath(routePath: string | undefined): boolean {
  if (!routePath) return false;
  const route = appRouteFromPathname(routePath);
  return route.view === "apps" && Boolean(route.packageName);
}

function appViewFromRoute(route: AppRoute): AppView {
  return route.view;
}

function appRouteFromLocation(): AppRoute {
  return appRouteFromPathname(window.location.pathname);
}

function appRoutePath(route: AppRoute): string {
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

function appRouteUrl(route: AppRoute): string {
  const url = new URL(window.location.href);
  url.pathname = appRoutePath(route);
  return `${url.pathname}${url.search}${url.hash}`;
}

function pushAppRouteUrl(route: AppRoute): void {
  const nextUrl = appRouteUrl(route);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.pushState({ botsterRoute: route }, "", nextUrl);
  }
}

export type PackageNavigationShortcut = {
  id: string;
  label: string;
  targetKind: string;
  openable: boolean;
  diagnostic?: string;
};

export function packageNavigationShortcut(entry: Record<string, unknown>): PackageNavigationShortcut {
  const targetKind = stringValue(entry.target_kind, "");
  const blocked = entry.enabled === false || entry.blocked === true;
  const blockedDiagnostic = firstString(entry.diagnostics_summary, ...(Array.isArray(entry.diagnostics) ? entry.diagnostics : []))
    ?? "Unavailable from hub navigation registry";
  const openablePluginSurface =
    targetKind === "plugin_surface" &&
    (supportsHubRoutePath(firstString(entry.route_path)) || Boolean(firstString(entry.package_name) && firstString(entry.surface_id)));

  return {
    id: String(entry.id),
    label: stringValue(entry.label, String(entry.id)),
    targetKind,
    openable: !blocked && openablePluginSurface,
    diagnostic: blocked
      ? blockedDiagnostic
      : openablePluginSurface
        ? undefined
        : `Unsupported navigation target: ${targetKind || "unknown"}`
  };
}

export function PackageNavigationShortcutButton({
  shortcut,
  onOpen
}: {
  shortcut: PackageNavigationShortcut;
  onOpen: () => void;
}) {
  const disabled = !shortcut.openable;
  return (
    <IonMenuToggle autoHide={false}>
      <button
        type="button"
        className={disabled ? "nav-item app-shortcut disabled" : "nav-item app-shortcut"}
        aria-disabled={disabled ? "true" : undefined}
        title={shortcut.diagnostic}
        onClick={() => {
          if (shortcut.openable) onOpen();
        }}
      >
        <IonIcon icon={cubeOutline} aria-hidden="true" />
        <span className="nav-item-copy">
          <span>{shortcut.label}</span>
          {shortcut.diagnostic ? <small>{shortcut.diagnostic}</small> : null}
        </span>
      </button>
    </IonMenuToggle>
  );
}

export function PluginNavigationShortcuts({
  entries,
  loadStatus,
  onOpen
}: {
  entries: Record<string, unknown>[];
  loadStatus: DogfoodEntityLoadStatus;
  onOpen: (entry: Record<string, unknown>) => void;
}) {
  const hasOverflow = entries.length > 8;
  const shortcuts = entries.map((entry) => {
    const shortcut = packageNavigationShortcut(entry);
    return (
      <PackageNavigationShortcutButton
        key={String(entry.id)}
        shortcut={shortcut}
        onOpen={() => onOpen(entry)}
      />
    );
  });

  return (
    <div className="sidebar-section" aria-label="Admitted plugin navigation">
      <p className="sidebar-section-label">Plugins</p>
      {loadStatus === "loaded" && entries.length === 0 ? (
        <p className="sidebar-empty">No plugin navigation</p>
      ) : null}
      {hasOverflow ? (
        <>
          <div
            className="sidebar-section-scroll"
            tabIndex={0}
            aria-label="Scrollable plugin navigation"
            aria-describedby="plugin-navigation-overflow-hint"
          >
            {shortcuts}
          </div>
          <p id="plugin-navigation-overflow-hint" className="sidebar-overflow-hint">
            Scroll for more plugin navigation.
          </p>
        </>
      ) : shortcuts}
    </div>
  );
}

const loadingSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "botster-web.dogfood.loading",
  version: "local-loading-v1",
  root: {
    id: "dogfood-loading-root",
    primitive: "section",
    slots: {
      children: [
        {
          id: "dogfood-loading-heading",
          primitive: "heading",
          props: { level: 2, text: "Waiting for local surface" }
        },
        {
          id: "dogfood-loading-copy",
          primitive: "text",
          props: { text: "The local session surface is loading." }
        }
      ]
    }
  }
};

const terminalRenderer = "restty" as const;

type BotsterPackageWindow = typeof window & {
  __BOTSTER_PACKAGE_RUNTIME__?: boolean;
  __BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__?: LocalWebrtcBootstrap;
};

function isAttachableSession(record: Record<string, unknown> | undefined): record is Record<string, unknown> & { id: string } {
  return Boolean(record && typeof record.id === "string" && record.status === "running" && record.attachable === true);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeLocalWebrtcBootstrap(bootstrap: LocalWebrtcBootstrap | undefined): LocalWebrtcBootstrap | undefined {
  if (!bootstrap?.grant_id || !bootstrap.grant_secret || bootstrap.signaling_transport !== "daemon_request") {
    return undefined;
  }

  return {
    ...bootstrap,
    signaling_url: new URL(bootstrap.signaling_url, window.location.origin).toString()
  };
}

function pluginSurfaceRecord(result: unknown): Record<string, unknown> {
  return readRecord(readRecord(result).plugin_surface);
}

function hasPluginSurfaceBody(pluginSurface: Record<string, unknown>): boolean {
  return Object.hasOwn(pluginSurface, "body");
}

function pluginSurfaceBodyText(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (typeof body === "number" || typeof body === "boolean") return String(body);

  const bodyRecord = readRecord(body);
  return readString(bodyRecord.text)
    ?? readString(bodyRecord.body)
    ?? readString(bodyRecord.message)
    ?? readString(bodyRecord.label)
    ?? readString(bodyRecord.title)
    ?? readString(readRecord(bodyRecord.props).text)
    ?? readString(readRecord(bodyRecord.props).title)
    ?? pluginSurfaceChildBodyText(bodyRecord);
}

function pluginSurfaceChildBodyText(body: Record<string, unknown>): string | undefined {
  const children = Array.isArray(body.children) ? body.children : [];
  for (const child of children) {
    const childText = pluginSurfaceBodyText(child);
    if (childText) return childText;
  }
  return undefined;
}

function pluginSurfaceStatus(result: unknown, title = "Plugin surface"): string | undefined {
  const pluginSurface = pluginSurfaceRecord(result);
  const packageName = readString(pluginSurface.package_name);
  const surfaceId = readString(pluginSurface.surface_id);

  if (!packageName || !surfaceId || !hasPluginSurfaceBody(pluginSurface)) {
    return undefined;
  }

  const body = pluginSurfaceBodyText(pluginSurface.body);
  return body
    ? `${title}: ${body} (${packageName}/${surfaceId})`
    : `${title} rendered (${packageName}/${surfaceId})`;
}

function pluginSurfaceMatches(result: unknown, packageName: string, surfaceId: string): boolean {
  const pluginSurface = pluginSurfaceRecord(result);
  return (
    readString(pluginSurface.package_name) === packageName &&
    readString(pluginSurface.surface_id) === surfaceId
  );
}

function pluginSurfaceSnapshot(result: unknown, expectedSurface?: { packageName: string; surfaceId: string }): UiTreeSnapshot | undefined {
  const snapshot = readRecord(readRecord(result).ui_tree_snapshot);
  if (snapshot.kind === "ui_tree_snapshot") return snapshot as unknown as UiTreeSnapshot;

  const pluginSurface = pluginSurfaceRecord(result);
  const hubSnapshot = readRecord(pluginSurface.ui_tree_snapshot);
  const packageName = readString(hubSnapshot.package_name);
  const surfaceId = readString(hubSnapshot.surface_id);
  if (!packageName || !surfaceId) return undefined;
  if (expectedSurface && (packageName !== expectedSurface.packageName || surfaceId !== expectedSurface.surfaceId)) return undefined;

  const root = validatedPluginSurfaceSnapshotNode(hubSnapshot.body, packageName, surfaceId);
  if (!root) return undefined;

  return {
    kind: "ui_tree_snapshot",
    surface: `${packageName}/${surfaceId}`,
    version: "plugin-surface-hub-validated-v1",
    root
  };
}

function validatedPluginSurfaceSnapshotNode(value: unknown, packageName: string, surfaceId: string): UiTreeSnapshot["root"] | undefined {
  const record = readRecord(value);
  const rawType = readString(record.primitive) ?? readString(record.type);
  const id = readString(record.id);
  if (!rawType || !id) return undefined;

  const props = { ...readRecord(record.props) };
  const primitive = rawType === "panel" ? "section" : rawType === "button" ? "action" : rawType;
  const actionId = readString(props.action);
  if (primitive === "action" && actionId) {
    props.action = {
      id: actionId,
      label: readString(props.label) ?? actionId,
      params: {
        package_name: packageName,
        surface_id: surfaceId,
        action_id: actionId
      }
    };
  }
  if (primitive === "section" && props.title && !props.label) {
    props.label = props.title;
  }

  const slotChildren = readRecord(record.slots).children;
  const rawChildren = Array.isArray(record.children)
    ? record.children
    : Array.isArray(slotChildren)
      ? slotChildren
      : [];
  const children = rawChildren.map((child) => validatedPluginSurfaceSnapshotNode(child, packageName, surfaceId)).filter((child): child is UiTreeSnapshot["root"] => Boolean(child));

  return {
    id,
    primitive,
    props,
    ...(children.length > 0 ? { slots: { children } } : {})
  };
}

function incompatiblePluginSurfaceSnapshotStatus(title: string, packageName: string, surfaceId: string): string {
  return `${title} requires a hub validated UiTree snapshot for ${packageName}/${surfaceId}; this hub returned only an unvalidated plugin surface body.`;
}

type PluginSurfaceRenderPhase = "rendering" | "rendered" | "error";

interface SelectedPluginSurface {
  routeKey?: string;
  title: string;
  phase: PluginSurfaceRenderPhase;
  status?: string;
  snapshot?: UiTreeSnapshot;
}

// Exported for focused regression coverage of route render terminal-state derivation.
// eslint-disable-next-line react-refresh/only-export-components
export function renderedPluginSurfaceState(
  result: { accepted: boolean; reason?: string; result?: unknown },
  title: string,
  expectedSurface?: { packageName: string; surfaceId: string },
  routeKey?: string
): SelectedPluginSurface {
  const renderedSurfaceStatus = pluginSurfaceStatus(result.result, title);
  const renderedSurfaceSnapshot = pluginSurfaceSnapshot(result.result, expectedSurface);
  const matchedExpectedSurface = expectedSurface
    ? pluginSurfaceMatches(result.result, expectedSurface.packageName, expectedSurface.surfaceId)
    : true;
  const hasTerminalSuccess = result.accepted && Boolean(renderedSurfaceSnapshot) && matchedExpectedSurface;

  if (hasTerminalSuccess) {
    return {
      routeKey,
      title,
      phase: "rendered",
      status: renderedSurfaceStatus ?? `${title} rendered`,
      snapshot: renderedSurfaceSnapshot
    };
  }

  return {
    routeKey,
    title,
    phase: "error",
    status: result.accepted
      ? renderedSurfaceStatus && expectedSurface && matchedExpectedSurface
        ? incompatiblePluginSurfaceSnapshotStatus(title, expectedSurface.packageName, expectedSurface.surfaceId)
        : `Render response did not include ${expectedSurface ? `${expectedSurface.packageName}/${expectedSurface.surfaceId}` : "a plugin surface"} validated snapshot.`
      : result.reason ?? "Plugin surface render was rejected."
  };
}

function packageActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type) ?? "package action";
  const decision = readRecord(payload.package_decision);
  const installPlan = readRecord(payload.install_plan);
  const updateStatus = readRecord(payload.update_status);
  const diagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics.map(readDiagnosticMessage).filter(Boolean) : [];

  if (!result.accepted) {
    return {
      message: result.reason ?? `${actionLabelFromId(requestType)} failed`,
      color: "danger"
    };
  }

  const decisionPackage = readString(decision.package_name);
  const decisionAction = readString(decision.action);
  const decisionState = readString(decision.state);
  if (decisionPackage) {
    return {
      message: `${decisionPackage}: ${actionLabelFromId(decisionAction ?? requestType)}${decisionState ? ` (${decisionState})` : ""}`,
      color: "success"
    };
  }

  const installEntry = readRecord(installPlan.entry);
  const installPackage = readString(installEntry.package_name);
  const installEffects = Array.isArray(installPlan.effects)
    ? installPlan.effects.map((effect) => readString(readRecord(effect).message)).filter(Boolean)
    : [];
  if (installPackage) {
    return {
      message: `${installPackage}: ${installEffects[0] ?? "Install plan received"}`,
      color: "success"
    };
  }

  const updatePackage = readString(updateStatus.package_name);
  if (updatePackage) {
    return {
      message: `${updatePackage}: ${updateStatus.update_available === true ? "Update available" : "No update available"}`,
      color: "success"
    };
  }

  return {
    message: diagnostics[0] ?? `${actionLabelFromId(requestType)} accepted`,
    color: "success"
  };
}

function pluginSurfaceActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } | undefined {
  const payload = readRecord(result.result);
  const pluginActionResult = readRecord(payload.plugin_action_result);
  const packageName = readString(payload.package_name);
  const surfaceId = readString(payload.surface_id);
  const actionId = readString(payload.action_id);
  if (!packageName || !surfaceId || !actionId || Object.keys(pluginActionResult).length === 0) return undefined;

  const state = readString(pluginActionResult.state);
  const message = readString(pluginActionResult.message);
  const error = readString(pluginActionResult.error);
  return {
    message: result.accepted
      ? message ?? `${actionLabelFromId(actionId)} accepted`
      : result.reason ?? error ?? `${actionLabelFromId(actionId)} failed`,
    color: result.accepted && state !== "error" ? "success" : "danger"
  };
}

function readDiagnosticMessage(value: unknown): string | undefined {
  const record = readRecord(value);
  return readString(record.message);
}

function actionLabelFromId(actionId: string): string {
  return actionId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function App() {
  const dogfoodRuntime = useMemo(
    () => {
      const packageRuntime = Boolean(
        (window as BotsterPackageWindow).__BOTSTER_PACKAGE_RUNTIME__
      );
      const localWebrtcBootstrap = packageRuntime
        ? normalizeLocalWebrtcBootstrap((window as BotsterPackageWindow).__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__)
        : undefined;
      return createDogfoodRuntimeConfig({
        env: import.meta.env,
        locationHref: window.location.href,
        ...(packageRuntime ? { bridgeUrl: `${window.location.origin}/request` } : {}),
        packageRuntime,
        localWebrtcBootstrap
      });
    },
    []
  );
  const runtimeClient = useMemo(
    () =>
      createBotsterWebClient({
        transport: dogfoodRuntime.transport
      }),
    [dogfoodRuntime]
  );
  const [surfaceSnapshot, setSurfaceSnapshot] = useState<UiTreeSnapshot | undefined>(() => runtimeClient.uiTree.current());
  const [localState, setLocalState] = useState<Record<string, unknown>>({
    "dogfood.action_status": dogfoodRuntime.statusText
  });
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostic[]>(() =>
    initialConnectionDiagnostics(dogfoodRuntime.mode, dogfoodRuntime.statusText, dogfoodRuntime.terminalDataPlaneKind)
  );
  const [entityLoadStatus, setEntityLoadStatus] = useState<Record<"app" | "packageNavigation" | "package" | "availablePackage" | "session" | "draft", DogfoodEntityLoadStatus>>({
    app: "not_loaded",
    packageNavigation: "not_loaded",
    package: "not_loaded",
    availablePackage: "not_loaded",
    session: "not_loaded",
    draft: "not_loaded"
  });
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => appRouteFromLocation());
  const [marketplaceRegistryPath, setMarketplaceRegistryPath] = useState("");
  const [localPackagePath, setLocalPackagePath] = useState("");
  const [packageActionToast, setPackageActionToast] = useState<{ message: string; color: string } | undefined>();
  const [selectedPluginSurface, setSelectedPluginSurface] = useState<SelectedPluginSurface | undefined>();
  const lastPluginRouteRenderKey = useRef<string | undefined>(undefined);
  const [selectedRealHubTerminalSessionId, setSelectedRealHubTerminalSessionId] = useState<string | undefined>();
  const [, setFrameVersion] = useState(0);
  const updateLocalState = useCallback((patch: Record<string, unknown>) => {
    setLocalState((current) => ({ ...current, ...patch }));
  }, [setLocalState]);
  const recordDiagnostic = useCallback((diagnostic: ConnectionDiagnostic | undefined) => {
    setDiagnostics((current) => upsertDiagnostic(current, diagnostic));
  }, [setDiagnostics]);
  const recordDiagnostics = useCallback((nextDiagnostics: ConnectionDiagnostic[]) => {
    setDiagnostics((current) => nextDiagnostics.reduce(upsertDiagnostic, current));
  }, [setDiagnostics]);
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
    if (view === "apps") {
      navigateToRoute({ view: "apps" });
    } else if (view === "diagnostics") {
      navigateToRoute({ view: "diagnostics" });
    } else {
      navigateToRoute({ view: "dashboard" });
    }
  }, [navigateToRoute]);
  const activeView = appViewFromRoute(activeRoute);
  const routePluginSurface = useMemo(
    () => activeRoute.view === "apps" && !activeRoute.settings && activeRoute.packageName && activeRoute.surfaceId
      ? { packageName: activeRoute.packageName, surfaceId: activeRoute.surfaceId }
      : undefined,
    [activeRoute]
  );
  const routeSettingsPackageName = activeRoute.view === "apps" && activeRoute.settings ? activeRoute.packageName : undefined;
  const routeSettingsSurfaceId = activeRoute.view === "apps" && activeRoute.settings ? activeRoute.surfaceId : undefined;
  const routePluginSurfaceKey = routePluginSurface
    ? `${routePluginSurface.packageName}/${routePluginSurface.surfaceId}`
    : undefined;

  useEffect(() => {
    if (!routePluginSurfaceKey) {
      lastPluginRouteRenderKey.current = undefined;
    }
  }, [routePluginSurfaceKey]);

  const navigateToPluginSurface = useCallback((packageName: string, surfaceId: string) => {
    navigateToRoute({ view: "apps", packageName, surfaceId, settings: false });
  }, [navigateToRoute]);
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
  const navigateToPackageSettings = useCallback((packageName: string, surfaceId?: string) => {
    navigateToRoute({ view: "apps", packageName, settings: true, surfaceId });
  }, [navigateToRoute]);

  useEffect(() => {
    const recordWebRtcLifecycle = (event: Event) => {
      recordDiagnostic(webRtcLifecycleDiagnostic((event as CustomEvent<WebrtcDaemonLifecycleEvent>).detail));
    };

    window.addEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);

    return () => {
      window.removeEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);
    };
  }, [recordDiagnostic]);

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

  useEffect(() => {
    let cancelled = false;
    let controlStreamEstablished = false;
    const unsubscribeTree = runtimeClient.uiTree.subscribe((snapshot) => {
      if (!cancelled) {
        setSurfaceSnapshot(snapshot);
      }
    });
    const unsubscribeFrames = runtimeClient.hub.onFrame(() => {
      if (!cancelled) {
        setFrameVersion((version) => version + 1);
      }
    });
    const unsubscribeDiagnostics = runtimeClient.hub.onFrame((frame) => {
      if (!cancelled) {
        recordDiagnostic(operatorErrorDiagnostic(frame));
        recordDiagnostic(hubConnectionDiagnosticFromFrame(frame));
        recordDiagnostic(schemaVersionDiagnosticFromFrame(frame));
        recordDiagnostics(compatibilityDiagnosticsFromFrame(frame));
      }
    });

    const pullDogfoodEntity = async (
      key: "app" | "packageNavigation" | "package" | "availablePackage" | "session" | "draft",
      request: { family: string; id?: string }
    ) => {
      setEntityLoadStatus((current) => ({ ...current, [key]: "loading" }));
      try {
        await runtimeClient.entities.pull(request);
        if (!cancelled) {
          setEntityLoadStatus((current) => ({ ...current, [key]: "loaded" }));
        }
      } catch (error) {
        if (!cancelled) {
          setEntityLoadStatus((current) => ({ ...current, [key]: "error" }));
        }
        throw error;
      }
    };

    void runtimeClient.hub
      .connect(botsterWebCapabilities)
      .then(() => {
        controlStreamEstablished = true;
      })
      .then(() => runtimeClient.hub.subscribe())
      .then(() => runtimeClient.hub.subscribeSurface({ surface: "botster-web.dogfood.session", path: "/sessions/local" }))
      .then(() => pullDogfoodEntity("app", { family: "botster-web.app" }))
      .then(() => pullDogfoodEntity("packageNavigation", { family: "botster-web.package_navigation" }))
      .then(() => pullDogfoodEntity("package", { family: "botster-web.package" }))
      .then(() => pullDogfoodEntity("availablePackage", { family: "botster-web.available_package" }))
      .then(() => pullDogfoodEntity("session", { family: "botster-web.session" }))
      .then(() => pullDogfoodEntity("draft", { family: "botster-web.session_draft", id: "draft-1" }))
      .catch((error: unknown) => {
        if (!cancelled) {
          updateLocalState({
            "dogfood.action_status": error instanceof Error ? error.message : "Local dogfood connection failed"
          });
          recordDiagnostic(connectionFailureDiagnostic(controlStreamEstablished, error));
        }
      });

    return () => {
      cancelled = true;
      unsubscribeTree();
      unsubscribeFrames();
      unsubscribeDiagnostics();
      runtimeClient.actions.rejectPending("botster-web unmounted");
      void runtimeClient.hub.disconnect();
    };
  }, [recordDiagnostic, recordDiagnostics, runtimeClient, updateLocalState]);

  const dispatchAction = useCallback(
    (action: ActionBinding) => {
      const isSpawnAction = action.id === "botster.session.select" && action.target === realHubDogfoodSessionId;
      const statusKey = isSpawnAction ? "dogfood.action_status" : "dogfood.diagnostic_action_status";
      updateLocalState({ [statusKey]: `Dispatching ${action.id}` });
      void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
        const isAttachAction = action.id === "botster.session.attach";
        if (result.accepted && isAttachAction && action.target) {
          setSelectedRealHubTerminalSessionId(action.target);
        }
        const renderedSurface = action.id === "botster.package.surface.render"
          ? renderedPluginSurfaceState(result, action.label ?? "Plugin surface")
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
        if (action.id === "botster.package.configuration.save") {
          void runtimeClient.entities.pull({ family: "botster-web.package" });
        }
        if (action.id === "botster.package.daemon_request" || action.id === "botster.package.configuration.save") {
          void runtimeClient.entities.pull({ family: "botster-web.package_navigation" });
        }
        updateLocalState({
          [statusKey]: result.accepted && isSpawnAction
            ? `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
            : result.accepted && isAttachAction && action.target
              ? `Attached terminal panel to ${action.target}.`
            : result.accepted
              ? `Accepted ${action.id}`
              : result.reason ?? `Rejected ${action.id}`,
          ...(renderedSurface?.status ? { "dogfood.plugin_surface_status": renderedSurface.status } : {})
        });
        recordDiagnostic(actionFailureDiagnostic(action, result));
      });
    },
    [recordDiagnostic, runtimeClient, updateLocalState]
  );
  useEffect(() => {
    const harness = (window as typeof window & {
      __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
        dispatchAction?: (action: ActionBinding) => void;
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
  const loadMarketplaceRegistry = useCallback(() => {
    const registryPath = marketplaceRegistryPath.trim();
    if (!registryPath) return;

    setEntityLoadStatus((current) => ({ ...current, availablePackage: "loading" }));
    void runtimeClient.entities
      .pull({ family: "botster-web.available_package", registry_path: registryPath })
      .then(() => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "loaded" }));
        updateLocalState({ "dogfood.diagnostic_action_status": `Loaded marketplace registry ${registryPath}` });
      })
      .catch((error: unknown) => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "error" }));
        updateLocalState({
          "dogfood.diagnostic_action_status": error instanceof Error ? error.message : "Marketplace registry load failed"
        });
      });
  }, [marketplaceRegistryPath, runtimeClient, updateLocalState]);
  const installLocalPackage = useCallback(() => {
    const packagePath = localPackagePath.trim();
    if (!packagePath) return;

    dispatchAction({
      id: "botster.package.daemon_request",
      target: packagePath,
      label: "Install local package",
      params: {
        daemon_request: {
          request_type: "install_package_local_path",
          path: packagePath
        }
      }
    });
  }, [dispatchAction, localPackagePath]);
  const recordTerminalDiagnostic = useCallback(
    (error: unknown) => {
      recordDiagnostic(terminalUnavailableDiagnostic(error));
    },
    [recordDiagnostic]
  );
  const installedApps = runtimeClient.entities.list("botster-web.app");
  const packageNavigation = runtimeClient.entities.list("botster-web.package_navigation");
  const packages = runtimeClient.entities.list("botster-web.package");
  const appSurfacePackages = useMemo(
    () =>
      new Map(
        packages
          .map((appPackage) => [stringValue(appPackage.package_name, String(appPackage.id)), appPackage] as const)
          .filter(([, appPackage]) => packageAppSurfaces(appPackage).length > 0)
      ),
    [packages]
  );
  const routePluginPackage = routePluginSurface
    ? packages.find((appPackage) => stringValue(appPackage.package_name, String(appPackage.id)) === routePluginSurface.packageName)
    : undefined;
  const routePluginSurfaceRecord = routePluginPackage && routePluginSurface
    ? packageAppSurfaces(routePluginPackage).find((surface) => firstString(surface.surface_id, surface.id) === routePluginSurface.surfaceId)
    : undefined;
  const routePluginLaunchAction = surfaceLaunchAction(routePluginSurfaceRecord);
  const routePluginSurfaceDiagnostic = routePluginSurface
    ? entityLoadStatus.package !== "loaded"
      ? "Loading package surfaces from the hub."
      : !routePluginPackage
        ? `No package named ${routePluginSurface.packageName} is loaded from the hub.`
        : !routePluginSurfaceRecord
          ? `Package ${routePluginSurface.packageName} does not expose app surface ${routePluginSurface.surfaceId}.`
          : routePluginSurfaceRecord.route_enabled === false
            ? `Surface ${routePluginSurface.surfaceId} is disabled by the hub route descriptor.`
          : routePluginSurfaceRecord.route_blocked === true
            ? `Surface ${routePluginSurface.surfaceId} is blocked by the hub route descriptor.`
          : !routePluginLaunchAction
            ? `Surface ${routePluginSurface.surfaceId} has no hub-provided render action.`
            : undefined
    : undefined;
  const availablePackages = runtimeClient.entities.list("botster-web.available_package");
  const settingsPackage = routeSettingsPackageName
    ? packages.find((app) => stringValue(app.package_name, String(app.id)) === routeSettingsPackageName)
      ?? availablePackages.find((app) => stringValue(app.package_name, String(app.id)) === routeSettingsPackageName)
    : undefined;
  const settingsPackageDiagnostic = routeSettingsPackageName
    ? entityLoadStatus.package !== "loaded"
      ? "Loading package settings from the hub."
      : !settingsPackage
        ? `No package named ${routeSettingsPackageName} is loaded from the hub.`
        : undefined
    : undefined;
  const routeSettingsSurfaceRecord = settingsPackage && routeSettingsSurfaceId
    ? packageSettingsSurfaces(settingsPackage).find((surface) => firstString(surface.surface_id, surface.id) === routeSettingsSurfaceId)
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

  useEffect(() => {
    if (routePluginSurfaceDiagnostic) return;
    if (!routePluginSurface) return;
    if (!routePluginSurfaceKey || !routePluginSurfaceRecord || !routePluginLaunchAction) return;
    if (lastPluginRouteRenderKey.current === routePluginSurfaceKey) return;

    const expectedSurface = {
      packageName: routePluginSurface.packageName,
      surfaceId: routePluginSurface.surfaceId
    };
    lastPluginRouteRenderKey.current = routePluginSurfaceKey;
    setSelectedPluginSurface({
      routeKey: routePluginSurfaceKey,
      title: surfaceTitle(routePluginSurfaceRecord),
      phase: "rendering",
      status: `Rendering ${surfaceTitle(routePluginSurfaceRecord)}`
    });
    void runtimeClient.actions.dispatch({ origin: "ui_node", action: routePluginLaunchAction }).then((result) => {
      const renderedSurface = renderedPluginSurfaceState(
        result,
        routePluginLaunchAction.label ?? surfaceTitle(routePluginSurfaceRecord),
        expectedSurface,
        routePluginSurfaceKey
      );
      setSelectedPluginSurface(renderedSurface);
      updateLocalState({
        "dogfood.plugin_surface_status": renderedSurface.status
      });
      recordDiagnostic(actionFailureDiagnostic(routePluginLaunchAction, result));
    });
  }, [
    recordDiagnostic,
    routePluginLaunchAction,
    routePluginSurface,
    routePluginSurfaceDiagnostic,
    routePluginSurfaceKey,
    routePluginSurfaceRecord,
    runtimeClient,
    updateLocalState
  ]);

  useEffect(() => {
    if (routeSettingsSurfaceDiagnostic) return;
    if (!routeSettingsPackageName || !routeSettingsSurfaceId) return;
    if (!routeSettingsSurfaceKey || !routeSettingsSurfaceRecord || !routeSettingsLaunchAction) return;
    if (lastPluginRouteRenderKey.current === routeSettingsSurfaceKey) return;

    const expectedSurface = {
      packageName: routeSettingsPackageName,
      surfaceId: routeSettingsSurfaceId
    };
    lastPluginRouteRenderKey.current = routeSettingsSurfaceKey;
    setSelectedPluginSurface({
      routeKey: routeSettingsSurfaceKey,
      title: surfaceTitle(routeSettingsSurfaceRecord),
      phase: "rendering",
      status: `Rendering ${surfaceTitle(routeSettingsSurfaceRecord)}`
    });
    void runtimeClient.actions.dispatch({ origin: "ui_node", action: routeSettingsLaunchAction }).then((result) => {
      const renderedSurface = renderedPluginSurfaceState(
        result,
        routeSettingsLaunchAction.label ?? surfaceTitle(routeSettingsSurfaceRecord),
        expectedSurface,
        routeSettingsSurfaceKey
      );
      setSelectedPluginSurface(renderedSurface);
      updateLocalState({
        "dogfood.plugin_surface_status": renderedSurface.status
      });
      recordDiagnostic(actionFailureDiagnostic(routeSettingsLaunchAction, result));
    });
  }, [
    recordDiagnostic,
    routeSettingsLaunchAction,
    routeSettingsPackageName,
    routeSettingsSurfaceDiagnostic,
    routeSettingsSurfaceId,
    routeSettingsSurfaceKey,
    routeSettingsSurfaceRecord,
    runtimeClient,
    updateLocalState
  ]);

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
  }, [appSurfacePackages, navigateToPluginSurfaceRecord]);
  const openPackageSettings = useCallback((app: Record<string, unknown>) => {
    navigateToPackageSettings(stringValue(app.package_name, String(app.id)));
  }, [navigateToPackageSettings]);
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
  const packageNavigationShortcuts = packageNavigation;
  const sessions = runtimeClient.entities.list("botster-web.session");
  const attachableDogfoodSession = sessions.find((session) => session.id === realHubDogfoodSessionId && isAttachableSession(session));
  const selectedRealHubSession = selectedRealHubTerminalSessionId
    ? sessions.find((session) => session.id === selectedRealHubTerminalSessionId)
    : undefined;
  const selectedRealHubSessionAttachable = isAttachableSession(selectedRealHubSession);
  const selectedTerminalSessionId = selectedRealHubSessionAttachable ? selectedRealHubTerminalSessionId : undefined;
  const defaultTerminalSessionId = attachableDogfoodSession ? String(attachableDogfoodSession.id) : undefined;
  const activeRealHubTerminalSessionId = selectedTerminalSessionId ?? defaultTerminalSessionId;
  const terminalDescriptor: TerminalViewDescriptor | undefined = useMemo(
    () =>
      dogfoodRuntime.mode === "real-hub" || dogfoodRuntime.mode === "webrtc"
        ? activeRealHubTerminalSessionId
          ? { sessionId: activeRealHubTerminalSessionId, renderer: terminalRenderer }
          : undefined
        : dogfoodRuntime.terminalDescriptor,
    [
      activeRealHubTerminalSessionId,
      dogfoodRuntime
    ]
  );
  const terminalDataPlane: TerminalDataPlaneAttachment | undefined = useMemo(
    () => (terminalDescriptor ? dogfoodRuntime.createTerminalDataPlane(terminalDescriptor.sessionId) : undefined),
    [dogfoodRuntime, terminalDescriptor]
  );
  const actionStatus =
    typeof localState["dogfood.action_status"] === "string"
      ? localState["dogfood.action_status"]
      : dogfoodRuntime.statusText;
  const diagnosticActionStatus =
    typeof localState["dogfood.diagnostic_action_status"] === "string"
      ? localState["dogfood.diagnostic_action_status"]
      : "No diagnostic action has been dispatched.";
  const runningSessions = sessions.filter((session) => session.status === "running");
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "danger");
  const warningDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const workflowSummaries = [
    {
      key: "connection",
      label: "Connection",
      value: terminalDataPlaneLabel(dogfoodRuntime.terminalDataPlaneKind),
      detail: dogfoodRuntime.statusText,
      severity: blockingDiagnostics.length > 0 ? "danger" : warningDiagnostics.length > 0 ? "warning" : "success"
    },
    {
      key: "packages",
      label: "Packages",
      value: entityLoadStatus.package === "loaded" ? String(packages.length) : loadStatusLabel(entityLoadStatus.package),
      detail: packages.length === 1 ? "1 package record loaded" : `${packages.length} package records loaded`,
      severity: entityLoadStatus.package === "error" ? "danger" : entityLoadStatus.package === "loaded" ? "success" : "info"
    },
    {
      key: "apps",
      label: "Apps",
      value: entityLoadStatus.app === "loaded" ? String(installedApps.length) : loadStatusLabel(entityLoadStatus.app),
      detail: installedApps.length === 1 ? "1 installed app loaded" : `${installedApps.length} installed app records loaded`,
      severity: entityLoadStatus.app === "error" ? "danger" : entityLoadStatus.app === "loaded" ? "success" : "info"
    },
    {
      key: "sessions",
      label: "Sessions",
      value: runningSessions.length > 0 ? `${runningSessions.length} running` : loadStatusLabel(entityLoadStatus.session),
      detail: sessions.length === 1 ? "1 session record loaded" : `${sessions.length} session records loaded`,
      severity: entityLoadStatus.session === "error" ? "danger" : runningSessions.length > 0 ? "success" : "info"
    },
    {
      key: "terminal",
      label: "Terminal",
      value: terminalDescriptor ? "Attached" : "Detached",
      detail: terminalDescriptor ? `${terminalDescriptor.sessionId} via ${terminalDescriptor.renderer}` : "No attachable session selected",
      severity: terminalDescriptor ? "success" : "info"
    }
  ] satisfies WorkflowSummary[];
  const terminalPanel = terminalDescriptor && terminalDataPlane ? (
    <TerminalViewHost
      dataPlane={terminalDataPlane}
      descriptor={terminalDescriptor}
      onDiagnostic={recordTerminalDiagnostic}
    />
  ) : (
    <aside className="terminal-panel" aria-labelledby="terminal-heading">
      <div className="panel-heading">
        <h2 id="terminal-heading">Terminal renderer</h2>
      </div>
      <p className="terminal-status" data-terminal-session-id="none">
        Select a running session to attach the terminal panel.
      </p>
    </aside>
  );

  return (
    <IonApp>
      <IonSplitPane contentId="main-content" when="md" className="app-split-pane">
        <IonMenu
          contentId="main-content"
          type="overlay"
          className="app-sidebar"
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Botster</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <nav aria-label="Botster workbench">
              <IonList lines="none" className="nav-list">
                {navigationItems.map((item) => (
                  <IonMenuToggle autoHide={false} key={item.label}>
                    <button
                      type="button"
                      className={activeView === item.view ? "nav-item active" : "nav-item"}
                      aria-current={activeView === item.view ? "page" : undefined}
                      onClick={() => navigateToView(item.view)}
                    >
                      <IonIcon icon={item.icon} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </IonMenuToggle>
                ))}
              </IonList>
              <PluginNavigationShortcuts
                entries={packageNavigationShortcuts}
                loadStatus={entityLoadStatus.packageNavigation}
                onOpen={openPackageNavigation}
              />
            </nav>
          </IonContent>
        </IonMenu>

        <IonPage id="main-content">
          <IonHeader className="app-header">
            <IonToolbar>
              <IonButtons slot="start">
                <IonMenuButton />
              </IonButtons>
              <IonTitle>botster-web</IonTitle>
              <IonButtons slot="end" className="toolbar-status">
                  <IonChip color="medium" outline>
                    <IonIcon icon={gitBranchOutline} aria-hidden="true" />
                    <IonLabel>{botsterWebClientContract.label}</IonLabel>
                  </IonChip>
                  <IonChip color={dogfoodRuntime.mode === "fixture" ? "medium" : "success"} outline>
                    <IonLabel>{dogfoodRuntime.mode}</IonLabel>
                  </IonChip>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent fullscreen>
            <main className="workspace-shell">
              {activeView === "dashboard" ? (
                <section className="view-stack" aria-labelledby="dashboard-heading" data-testid="dashboard-view">
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">Home</p>
                      <h1 id="dashboard-heading">Dashboard</h1>
                    </div>
                    <IonBadge color={blockingDiagnostics.length > 0 ? "danger" : "success"}>
                      {blockingDiagnostics.length > 0 ? `${blockingDiagnostics.length} blocked` : "Ready"}
                    </IonBadge>
                  </div>
                  <IonGrid className="workflow-overview" id="workflow-overview" aria-label="Workflow overview" data-testid="workflow-overview">
                    <IonRow>
                      {workflowSummaries.map((summary) => (
                        <IonCol size="12" sizeMd="6" sizeLg="3" key={summary.key}>
                          <IonCard className={`workflow-card ${summary.severity}`} data-testid={`workflow-${summary.key}`}>
                            <IonCardHeader>
                              <IonCardSubtitle>{summary.label}</IonCardSubtitle>
                              <IonBadge color={badgeColor(summary.severity)}>{summary.value}</IonBadge>
                            </IonCardHeader>
                            <IonCardContent>{summary.detail}</IonCardContent>
                          </IonCard>
                        </IonCol>
                      ))}
                    </IonRow>
                  </IonGrid>
                  <IonGrid className="dashboard-layout" aria-label="Dashboard widgets">
                    <IonRow>
                      <IonCol size="12">
                        <div className="dashboard-main">
                          <section className="workflow-section" aria-labelledby="attention-heading">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Attention</p>
                                <h2 id="attention-heading">What needs attention</h2>
                              </div>
                              <IonBadge color={blockingDiagnostics.length > 0 ? "danger" : "medium"}>
                                {blockingDiagnostics.length + warningDiagnostics.length}
                              </IonBadge>
                            </div>
                            <IonGrid className="dashboard-widget-list">
                              <IonRow>
                                <IonCol size="12" sizeMd="4">
                                  <DashboardWidget
                                    title="Running sessions"
                                    value={String(runningSessions.length)}
                                    detail={runningSessions.length > 0 ? "Active terminal work is available." : "No session is running yet."}
                                    severity={runningSessions.length > 0 ? "success" : "info"}
                                  />
                                </IonCol>
                                <IonCol size="12" sizeMd="4">
                                  <DashboardWidget
                                    title="Installed apps"
                                    value={String(installedApps.length)}
                                    detail={installedApps.length > 0 ? "Apps are available from the Apps view." : "No hub-provided apps are loaded yet."}
                                    severity={installedApps.length > 0 ? "success" : "warning"}
                                  />
                                </IonCol>
                                <IonCol size="12" sizeMd="4">
                                  <DashboardWidget
                                    title="Diagnostics"
                                    value={blockingDiagnostics.length > 0 ? "Blocked" : warningDiagnostics.length > 0 ? "Warnings" : "Healthy"}
                                    detail={blockingDiagnostics[0]?.detail ?? warningDiagnostics[0]?.detail ?? "No blocking diagnostics are active."}
                                    severity={blockingDiagnostics.length > 0 ? "danger" : warningDiagnostics.length > 0 ? "warning" : "success"}
                                  />
                                </IonCol>
                              </IonRow>
                            </IonGrid>
                          </section>
                          <section className="workflow-section" aria-labelledby="plugin-widgets-heading">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Plugin widgets</p>
                                <h2 id="plugin-widgets-heading">Dashboard widgets</h2>
                              </div>
                              <IonBadge color="medium">Host managed</IonBadge>
                            </div>
                            <IonGrid className="plugin-widget-grid">
                              <IonRow>
                                {installedApps.length > 0 ? installedApps.slice(0, 3).map((app) => (
                                  <IonCol size="12" sizeMd="4" key={app.id}>
                                    <IonCard className="plugin-widget">
                                      <IonCardHeader>
                                        <IonCardSubtitle>
                                          <IonIcon icon={cubeOutline} aria-hidden="true" />
                                          App
                                        </IonCardSubtitle>
                                        <IonCardTitle>{stringValue(app.title, app.id)}</IonCardTitle>
                                      </IonCardHeader>
                                      <IonCardContent>
                                        {stringValue(app.diagnostics_summary, stringValue(app.lifecycle_state, "Loaded"))}
                                      </IonCardContent>
                                    </IonCard>
                                  </IonCol>
                                )) : (
                                  <IonCol size="12">
                                    <p className="entity-empty">No plugin dashboard widgets are registered yet.</p>
                                  </IonCol>
                                )}
                              </IonRow>
                            </IonGrid>
                          </section>
                        </div>
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                </section>
              ) : null}

              {activeView === "apps" ? (
                <section className="view-stack" aria-labelledby="apps-heading" data-testid="apps-view">
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">Launcher</p>
                      <h1 id="apps-heading">Apps</h1>
                    </div>
                    <IonBadge color="medium">{installedApps.length}</IonBadge>
                  </div>
                  {routePluginSurface ? (
                    <PluginSurfaceRoutePage
                      diagnostic={routePluginSurfaceDiagnostic}
                      packageName={routePluginSurface.packageName}
                      selectedSurface={selectedPluginSurface?.routeKey === routePluginSurfaceKey ? selectedPluginSurface : undefined}
                      surfaceId={routePluginSurface.surfaceId}
                      localState={localState}
                      entities={runtimeClient.entities}
                      onAction={dispatchAction}
                    />
                  ) : routeSettingsPackageName ? (
                    <PluginSettingsRoutePage
                      diagnostic={settingsPackageDiagnostic}
                      packageName={routeSettingsPackageName}
                      packageRecord={settingsPackage}
                      onAction={dispatchAction}
                      onBack={() => navigateToView("apps")}
                      onOpenSurface={openPackageSettingsSurface}
                      selectedSurface={routeSettingsSurfaceKey && selectedPluginSurface?.routeKey === routeSettingsSurfaceKey ? selectedPluginSurface : undefined}
                      surfaceDiagnostic={routeSettingsSurfaceDiagnostic}
                      entities={runtimeClient.entities}
                    />
                  ) : (
                    <>
                      <IonList lines="full" aria-label="Add packages and marketplaces">
                        <IonListHeader>
                          <IonLabel>Add packages</IonLabel>
                        </IonListHeader>
                        <IonItem>
                          <IonInput
                            label="Marketplace registry path"
                            labelPlacement="stacked"
                            value={marketplaceRegistryPath}
                            placeholder="/path/to/marketplace.json"
                            onIonInput={(event) => setMarketplaceRegistryPath(String(event.detail.value ?? ""))}
                          />
                          <IonButton slot="end" disabled={!marketplaceRegistryPath.trim()} onClick={loadMarketplaceRegistry}>
                            Load
                          </IonButton>
                        </IonItem>
                        <IonItem>
                          <IonInput
                            label="Local package path"
                            labelPlacement="stacked"
                            value={localPackagePath}
                            placeholder="/path/to/plugin"
                            onIonInput={(event) => setLocalPackagePath(String(event.detail.value ?? ""))}
                          />
                          <IonButton slot="end" disabled={!localPackagePath.trim()} onClick={installLocalPackage}>
                            Install
                          </IonButton>
                        </IonItem>
                      </IonList>
                      {availablePackages.length > 0 || packages.length > 0 || installedApps.length > 0 ? (
                        <>
                      <IonList lines="full" aria-label="Installed apps">
                        <IonListHeader>
                          <IonLabel>Installed apps</IonLabel>
                        </IonListHeader>
                        {installedApps.length > 0 ? installedApps.map((app) => (
                          <AppListItem
                            app={app}
                            key={app.id}
                            surface={packageAppSurfaces(appSurfacePackages.get(stringValue(app.package_name, "")) ?? {})[0]}
                            onOpen={openApp}
                          />
                        )) : (
                          <IonItem disabled>
                            <IonLabel>No installed apps returned</IonLabel>
                          </IonItem>
                        )}
                      </IonList>
                      <IonList lines="full" aria-label="Available marketplace packages">
                        <IonListHeader>
                          <IonLabel>Available marketplace packages</IonLabel>
                        </IonListHeader>
                        {availablePackages.length > 0 ? availablePackages.map((app) => (
                          <PluginListItem
                            app={app}
                            key={app.id}
                            onOpen={openPackage}
                            onSettings={openPackageSettings}
                          />
                        )) : (
                          <IonItem disabled>
                            <IonLabel>No available marketplace packages returned</IonLabel>
                          </IonItem>
                        )}
                      </IonList>
                      <IonList lines="full" aria-label="Installed packages">
                        <IonListHeader>
                          <IonLabel>Installed packages</IonLabel>
                        </IonListHeader>
                        {packages.length > 0 ? packages.map((app) => (
                          <PluginListItem
                            app={app}
                            key={app.id}
                            onOpen={openPackage}
                            onSettings={openPackageSettings}
                          />
                        )) : (
                          <IonItem disabled>
                            <IonLabel>No installed packages returned</IonLabel>
                          </IonItem>
                        )}
                      </IonList>
                        </>
                      ) : (
                        <article className="workflow-section">
                          <div className="section-heading">
                            <div>
                              <p className="eyebrow">Apps</p>
                              <h2>No apps loaded</h2>
                            </div>
                          </div>
                          <p className="entity-empty">The hub has not returned installed apps, packages, or marketplace rows.</p>
                        </article>
                      )}
                    </>
                  )}
                </section>
              ) : null}

              {activeView === "diagnostics" ? (
                <section className="view-stack" aria-labelledby="diagnostics-view-heading" data-testid="diagnostics-view">
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">Operations</p>
                      <h1 id="diagnostics-view-heading">Diagnostics</h1>
                    </div>
                    <IonBadge color={blockingDiagnostics.length > 0 ? "danger" : "medium"}>
                      {diagnostics.length}
                    </IonBadge>
                  </div>
                  <DogfoodFirstScreen
                    mode={dogfoodRuntime.mode}
                    statusText={dogfoodRuntime.statusText}
                    diagnostics={diagnostics}
                    packages={packages}
                    packageLoadStatus={entityLoadStatus.package}
                    sessions={sessions}
                    sessionLoadStatus={entityLoadStatus.session}
                    actionStatus={actionStatus}
                  />
                  <IonGrid className="workspace-grid" aria-label="Diagnostic workspace">
                    <IonRow>
                      <IonCol size="12" sizeLg="8">
                        <div className="dogfood-main">
                          <section className="workflow-section" aria-label="Renderer registry surface" data-testid="renderer-registry-workflow">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Renderer surface</p>
                                <h2>Renderer registry</h2>
                              </div>
                              <IonBadge color="medium">Diagnostic</IonBadge>
                            </div>
                            <UiNodeSurface
                              snapshot={surfaceSnapshot ?? loadingSnapshot}
                              entities={runtimeClient.entities}
                              capabilities={{
                                ...defaultUiCapabilitySet,
                                isolated_plugin_asset: false
                              }}
                              localState={localState}
                              onAction={dispatchAction}
                            />
                          </section>
                          <section className="workflow-section contract-section" aria-label="Botster client contract" data-testid="client-contract">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Client contract</p>
                                <h2>Protocol surfaces under test</h2>
                              </div>
                              <IonBadge color="medium">{botsterWebClientContract.seams.length} seams</IonBadge>
                            </div>
                            <div className="contract-strip">
                              {botsterWebClientContract.seams.map((seam) => (
                                <IonChip key={seam} color="light">
                                  <IonLabel>{seam}</IonLabel>
                                </IonChip>
                              ))}
                            </div>
                          </section>
                          <div id="diagnostics-workflow" data-testid="diagnostics-workflow">
                            <ConnectionDiagnosticsPanel diagnostics={diagnostics} />
                          </div>
                          <section className="workflow-section" id="entity-workflow" aria-labelledby="entity-workflow-heading" data-testid="entity-workflow">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Entity frames</p>
                                <h2 id="entity-workflow-heading">Loaded hub state</h2>
                              </div>
                              <IonBadge color="medium">{runtimeClient.entities.activePullCount()} active pulls</IonBadge>
                            </div>
                            <IonGrid className="entity-summary-grid">
                              <IonRow>
                                <IonCol size="12" sizeMd="6">
                                  <EntityFamilyPanel
                                    title="Packages"
                                    records={packages}
                                    emptyText="No package records loaded."
                                    primaryField="title"
                                    secondaryField="status"
                                  />
                                </IonCol>
                                <IonCol size="12" sizeMd="6">
                                  <EntityFamilyPanel
                                    title="Sessions"
                                    records={sessions}
                                    emptyText="No session records loaded."
                                    primaryField="title"
                                    secondaryField="status"
                                  />
                                </IonCol>
                              </IonRow>
                            </IonGrid>
                          </section>
                          <section className="workflow-section" id="action-workflow" aria-labelledby="action-workflow-heading" data-testid="action-workflow">
                            <div className="section-heading">
                              <div>
                                <p className="eyebrow">Actions</p>
                                <h2 id="action-workflow-heading">Dispatch status</h2>
                              </div>
                              <IonIcon icon={serverOutline} aria-hidden="true" />
                            </div>
                            <dl className="action-status-list">
                              <div>
                                <dt>Spawn session</dt>
                                <dd>{actionStatus}</dd>
                              </div>
                              <div>
                                <dt>Diagnostic action</dt>
                                <dd>{diagnosticActionStatus}</dd>
                              </div>
                              <div>
                                <dt>Terminal session</dt>
                                <dd>{terminalDescriptor?.sessionId ?? "No terminal session attached"}</dd>
                              </div>
                            </dl>
                          </section>
                        </div>
                      </IonCol>
                      <IonCol size="12" sizeLg="4">
                        {terminalPanel}
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                </section>
              ) : null}
            </main>
          </IonContent>
        </IonPage>
      </IonSplitPane>
      <IonToast
        isOpen={Boolean(packageActionToast)}
        message={packageActionToast?.message}
        color={packageActionToast?.color}
        duration={5000}
        position="bottom"
        onDidDismiss={() => setPackageActionToast(undefined)}
      />
    </IonApp>
  );
}

interface PluginSurfaceRoutePageProps {
  packageName: string;
  surfaceId: string;
  diagnostic?: string;
  selectedSurface?: SelectedPluginSurface;
  localState: Record<string, unknown>;
  entities: ReturnType<typeof createBotsterWebClient>["entities"];
  onAction: (action: ActionBinding) => void;
}

export function PluginSurfaceRoutePage({
  packageName,
  surfaceId,
  diagnostic,
  selectedSurface,
  localState,
  entities,
  onAction
}: PluginSurfaceRoutePageProps) {
  const badgeLabel = diagnostic ? "Diagnostic" : selectedSurface?.phase === "rendered" ? "Rendered" : selectedSurface?.phase === "error" ? "Error" : "Loading";
  const badgeColor = diagnostic ? "warning" : selectedSurface?.phase === "rendered" ? "success" : selectedSurface?.phase === "error" ? "danger" : "medium";

  return (
    <article className="workflow-section" aria-label="Rendered app surface" data-testid="selected-app-surface">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Plugin surface</p>
          <h2>{selectedSurface?.title ?? `${packageName}/${surfaceId}`}</h2>
        </div>
        <IonBadge color={badgeColor} data-testid="plugin-route-status-badge">
          {badgeLabel}
        </IonBadge>
      </div>
      {diagnostic ? (
        <p className="entity-empty" data-testid="plugin-route-diagnostic">{diagnostic}</p>
      ) : selectedSurface?.snapshot ? (
        <UiNodeSurface
          snapshot={selectedSurface.snapshot}
          entities={entities}
          capabilities={{
            ...defaultUiCapabilitySet,
            isolated_plugin_asset: false
          }}
          localState={localState}
          onAction={onAction}
        />
      ) : (
        <p className="entity-empty">{selectedSurface?.status ?? "Rendering plugin surface from the hub."}</p>
      )}
    </article>
  );
}

interface PluginSettingsRoutePageProps {
  packageName: string;
  packageRecord?: Record<string, unknown>;
  diagnostic?: string;
  onAction: (action: ActionBinding) => void;
  onBack: () => void;
  onOpenSurface: (packageName: string, surface: PackageSurfaceRecord) => void;
  selectedSurface?: SelectedPluginSurface;
  surfaceDiagnostic?: string;
  entities: EntityFrameStore;
}

function PluginSettingsRoutePage({
  packageName,
  packageRecord,
  diagnostic,
  onAction,
  onBack,
  onOpenSurface,
  selectedSurface,
  surfaceDiagnostic,
  entities
}: PluginSettingsRoutePageProps) {
  return (
    <article className="workflow-section" aria-label="Plugin settings" data-testid="plugin-settings-route">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Plugin settings</p>
          <h2>{packageRecord ? appDisplayName(packageRecord.title, String(packageRecord.id)) : packageName}</h2>
        </div>
        <IonButton fill="clear" onClick={onBack}>Apps</IonButton>
      </div>
      {diagnostic ? (
        <p className="entity-empty" data-testid="plugin-settings-route-diagnostic">{diagnostic}</p>
      ) : packageRecord ? (
        <>
          <PluginSettingsPanel
            app={packageRecord}
            key={String(packageRecord.id)}
            onAction={onAction}
            onOpenSurface={(surface) => onOpenSurface(packageName, surface)}
          />
          {surfaceDiagnostic ? (
            <p className="entity-empty" data-testid="plugin-settings-surface-diagnostic">{surfaceDiagnostic}</p>
          ) : selectedSurface?.snapshot ? (
            <UiNodeSurface
              snapshot={selectedSurface.snapshot}
              entities={entities}
              capabilities={{
                ...defaultUiCapabilitySet,
                isolated_plugin_asset: false
              }}
              onAction={onAction}
            />
          ) : selectedSurface ? (
            <p className="entity-empty">{selectedSurface.status ?? "Rendering plugin settings surface from the hub."}</p>
          ) : null}
        </>
      ) : (
        <p className="entity-empty">Loading package settings from the hub.</p>
      )}
    </article>
  );
}

interface WorkflowSummary {
  key: string;
  label: string;
  value: string;
  detail: string;
  severity: "success" | "info" | "warning" | "danger";
}

interface EntityFamilyPanelProps {
  title: string;
  records: Record<string, unknown>[];
  emptyText: string;
  primaryField: string;
  secondaryField: string;
}

function DashboardWidget({ title, value, detail, severity }: Omit<WorkflowSummary, "key" | "label"> & { title: string }) {
  return (
    <IonCard className={`dashboard-widget ${severity}`}>
      <IonCardHeader>
        <IonCardTitle>{title}</IonCardTitle>
        <IonBadge color={badgeColor(severity)}>{value}</IonBadge>
      </IonCardHeader>
      <IonCardContent>{detail}</IonCardContent>
    </IonCard>
  );
}

function EntityFamilyPanel({ title, records, emptyText, primaryField, secondaryField }: EntityFamilyPanelProps) {
  return (
    <IonCard className="entity-family-panel">
      <div className="entity-family-heading">
        <h3>{title}</h3>
        <IonBadge color="medium">{records.length}</IonBadge>
      </div>
      {records.length > 0 ? (
        <div className="entity-record-list">
          {records.slice(0, 4).map((record) => (
            <div className="entity-record-row" key={String(record.id)}>
              <strong>{stringValue(record[primaryField], String(record.id))}</strong>
              <span>{stringValue(record[secondaryField], "unknown")}</span>
            </div>
          ))}
          {records.length > 4 ? <p className="entity-overflow">{records.length - 4} more records loaded.</p> : null}
        </div>
      ) : (
        <p className="entity-empty">{emptyText}</p>
      )}
    </IonCard>
  );
}

interface PluginListItemProps {
  app: Record<string, unknown>;
  onOpen: (app: Record<string, unknown>) => void;
  onSettings: (app: Record<string, unknown>) => void;
}

interface AppListItemProps {
  app: Record<string, unknown>;
  surface?: PackageSurfaceRecord;
  onOpen: (app: Record<string, unknown>) => void;
}

export function AppListItem({ app, surface, onOpen }: AppListItemProps) {
  const kind = stringValue(app.kind, "unknown");
  const lifecycle = stringValue(app.lifecycle_state, "unknown");
  const diagnostics = arrayOfStrings(app.diagnostics);
  const openAction = readRecord(app.open_action);
  const disabled = openAction.disabled === true;
  const surfaceAction = surfaceLaunchAction(surface);
  const hasSurface = Boolean(surfaceAction && surface);
  const title = appDisplayName(app.title, String(app.id));
  const badgeLabel = hasSurface ? "Open UI" : kind === "terminal_app" ? "Terminal" : disabled ? "Unavailable" : "Open";
  const badgeColor = hasSurface ? "primary" : kind === "terminal_app" ? "medium" : disabled ? "warning" : "primary";
  const surfaceDetail = surface ? surfaceDescription(surface) ?? `${surfaceTitle(surface)} UI surface` : undefined;

  return (
    <IonItem
      button
      detail={hasSurface || !disabled}
      onClick={() => onOpen(app)}
    >
      <IonIcon slot="start" icon={kind === "terminal_app" ? constructOutline : cubeOutline} color="primary" aria-hidden="true" />
      <IonLabel>
        <h2 title={stringValue(app.title, String(app.id))}>{title}</h2>
        <p>
          {kind} · {lifecycle}
        </p>
        <p>{hasSurface ? surfaceDetail : stringValue(app.diagnostics_summary, diagnostics[0] ?? "Hub-provided app registry row")}</p>
      </IonLabel>
      <IonBadge slot="end" color={badgeColor}>
        {badgeLabel}
      </IonBadge>
    </IonItem>
  );
}

export function PluginListItem({ app, onOpen, onSettings }: PluginListItemProps) {
  const appSurfaces = packageAppSurfaces(app);
  const settingsSurfaces = packageSettingsSurfaces(app);
  const actions = packageActions(app);
  const hasUi = appSurfaces.length > 0;
  const hasSettings = settingsSurfaces.length > 0;
  const hasManagement = hasSettings || actions.length > 0;

  return (
    <IonItem
      button
      detail={hasUi}
      onClick={() => onOpen(app)}
    >
      <IonIcon slot="start" icon={cubeOutline} color="primary" aria-hidden="true" />
      <IonLabel>
        <h2 title={stringValue(app.title, String(app.id))}>{appDisplayName(app.title, String(app.id))}</h2>
        <p>
          <IonIcon icon={pricetagOutline} aria-hidden="true" /> {stringValue(app.version, "unknown")}
          {" "}
          <IonIcon icon={keyOutline} aria-hidden="true" /> {capabilityCountLabel(app.capability_summary)}
        </p>
      </IonLabel>
      <IonBadge slot="end" color={hasUi ? "primary" : "medium"}>
        {hasUi ? `${appSurfaces.length} UI` : hasManagement ? "Settings" : "No UI"}
      </IonBadge>
      <IonButton
        slot="end"
        fill="clear"
        disabled={!hasManagement}
        aria-label={`Settings for ${appDisplayName(app.title, String(app.id))}`}
        onClick={(event) => {
          event.stopPropagation();
          onSettings(app);
        }}
      >
        <IonIcon icon={cogOutline} slot="icon-only" aria-hidden="true" />
      </IonButton>
    </IonItem>
  );
}

interface PluginSettingsPanelProps {
  app: Record<string, unknown>;
  onAction: (action: ActionBinding) => void;
  onOpenSurface?: (surface: PackageSurfaceRecord) => void;
}

export function PluginSettingsPanel({ app, onAction, onOpenSurface }: PluginSettingsPanelProps) {
  const settingsSurfaces = packageSettingsSurfaces(app);
  const actions = packageActions(app);
  const configurationFields = useMemo(() => packageSurfaceRecords(app.configuration_fields), [app.configuration_fields]);
  const remoteAccessField = useMemo(
    () => configurationFields.find((field) => firstString(field.id) === "remote_browser_rendezvous_enabled"),
    [configurationFields]
  );
  const genericConfigurationFields = useMemo(
    () => configurationFields.filter((field) => firstString(field.id) !== "remote_browser_rendezvous_enabled"),
    [configurationFields]
  );
  const configurationSubmit = packageActionFromValue(app.configuration_submit);
  const configurationDraftBaseline = useMemo(
    () => configurationDraftValues(genericConfigurationFields),
    [genericConfigurationFields]
  );
  const configurationDraftBaselineKey = JSON.stringify(configurationDraftBaseline);

  return (
    <IonList lines="full">
      {configurationFields.length > 0 ? (
        <>
          <IonListHeader>
            <IonLabel>Package configuration</IonLabel>
          </IonListHeader>
          {remoteAccessField ? (
            <RemoteAccessConfigurationItem
              field={remoteAccessField}
              submit={configurationSubmit}
              onAction={onAction}
            />
          ) : null}
          {genericConfigurationFields.length > 0 ? (
            <GenericConfigurationForm
              fields={genericConfigurationFields}
              key={configurationDraftBaselineKey}
              onAction={onAction}
              submit={configurationSubmit}
            />
          ) : null}
        </>
      ) : null}
      {settingsSurfaces.length > 0 ? (
        settingsSurfaces.map((surface) => {
          const launchAction = surfaceLaunchAction(surface);
          return (
            <IonItem
              button
              key={surfaceKey(surface)}
              disabled={!launchAction}
              onClick={() => {
                if (onOpenSurface) {
                  onOpenSurface(surface);
                } else if (launchAction) {
                  onAction(launchAction);
                }
              }}
            >
              <IonIcon slot="start" icon={constructOutline} aria-hidden="true" />
              <IonLabel>
                <h2>{surfaceTitle(surface)}</h2>
                <p>{surfaceDescription(surface) ?? `${capabilityCountLabel(app.capability_summary)} capabilities`}</p>
              </IonLabel>
            </IonItem>
          );
        })
      ) : (
        <IonItem disabled>
          <IonIcon slot="start" icon={constructOutline} aria-hidden="true" />
          <IonLabel>
            <h2>Configure</h2>
            <p>No settings surface registered</p>
          </IonLabel>
        </IonItem>
      )}
      {actions.map((record) => {
        const action = packageActionBinding(record);
        return (
          <IonItem
            button
            disabled={!action || action.disabled === true}
            key={packageActionKey(record)}
            onClick={() => {
              if (action) onAction(action);
            }}
          >
            <IonIcon slot="start" icon={packageActionIcon(record)} aria-hidden="true" />
            <IonLabel>
              <h2>{stringValue(action?.label, stringValue(record.action_id, "Package action"))}</h2>
              <p>{packageActionDetail(record)}</p>
            </IonLabel>
          </IonItem>
        );
      })}
    </IonList>
  );
}

function GenericConfigurationForm({
  fields,
  submit,
  onAction
}: {
  fields: PackageSurfaceRecord[];
  submit: ActionBinding | undefined;
  onAction: (action: ActionBinding) => void;
}) {
  const [configurationDraft, setConfigurationDraft] = useState<Record<string, unknown>>(() => configurationDraftValues(fields));

  const updateConfigurationField = useCallback((field: PackageSurfaceRecord, value: unknown) => {
    const id = configurationFieldId(field);
    setConfigurationDraft((currentValues) => ({ ...currentValues, [id]: value }));
  }, []);

  const saveConfiguration = useCallback(() => {
    if (!submit) return;

    onAction(configurationSaveAction(submit, fields, configurationDraft));
  }, [submit, fields, configurationDraft, onAction]);

  return (
    <>
      {fields.map((field) => (
        <ConfigurationFieldItem
          field={field}
          key={configurationFieldKey(field)}
          onChange={updateConfigurationField}
          value={configurationDraft[configurationFieldId(field)]}
        />
      ))}
      <IonItem>
        <IonButton
          data-testid="package-configuration-save"
          disabled={!submit || submit.disabled === true}
          onClick={saveConfiguration}
          slot="end"
        >
          {submit?.label ?? "Save configuration"}
        </IonButton>
      </IonItem>
    </>
  );
}

function RemoteAccessConfigurationItem({
  field,
  submit,
  onAction
}: {
  field: PackageSurfaceRecord;
  submit: ActionBinding | undefined;
  onAction: (action: ActionBinding) => void;
}) {
  const enabled = field.value === true;
  const nextEnabled = !enabled;
  const disabled = !submit || submit.disabled === true;
  const errors = arrayOfStrings(field.errors);

  return (
    <IonItem>
      <IonIcon slot="start" icon={serverOutline} aria-hidden="true" />
      <IonLabel>
        <h2>Remote browser access</h2>
        <p>{enabled ? "Remote browser rendezvous is opted in." : "Remote browser rendezvous is off."}</p>
        <p>Local installed access stays available. Remote access requires opt-in, pairing, and device approval.</p>
        {errors.map((error) => (
          <IonNote color="danger" key={error}>
            {error}
          </IonNote>
        ))}
      </IonLabel>
      <IonBadge slot="end" color={enabled ? "success" : "medium"}>
        {enabled ? "Opted in" : "Off"}
      </IonBadge>
      <IonButton
        slot="end"
        fill={enabled ? "outline" : "solid"}
        disabled={disabled}
        onClick={() => {
          if (!submit) return;
          onAction({
            ...submit,
            params: {
              ...submit.params,
              values: {
                remote_browser_rendezvous_enabled: {
                  type: "boolean",
                  value: nextEnabled
                }
              }
            }
          });
        }}
      >
        {enabled ? "Opt out" : "Opt in"}
      </IonButton>
    </IonItem>
  );
}

function ConfigurationFieldItem({
  field,
  onChange,
  value
}: {
  field: PackageSurfaceRecord;
  onChange: (field: PackageSurfaceRecord, value: unknown) => void;
  value: unknown;
}) {
  const label = firstString(field.label, field.id) ?? "Configuration field";
  const kind = firstString(field.config_type, field.kind) ?? "string";
  const helper = firstString(field.helper, field.placeholder);
  const errors = configurationFieldErrors(field);
  const required = field.required === true;

  return (
    <IonItem>
      <IonIcon slot="start" icon={keyOutline} aria-hidden="true" />
      <IonLabel>
        <h2>{required ? `${label} *` : label}</h2>
        <p>{kind}</p>
        {helper ? <p>{helper}</p> : null}
        {errors.map((error) => (
          <IonNote color="danger" key={error}>
            {error}
          </IonNote>
        ))}
      </IonLabel>
      <ConfigurationFieldControl field={field} onChange={onChange} value={value} />
      {configurationFieldSecretRedacted(field) && !value ? <IonBadge slot="end" color="medium">Secret saved</IonBadge> : null}
    </IonItem>
  );
}

function ConfigurationFieldControl({
  field,
  onChange,
  value
}: {
  field: PackageSurfaceRecord;
  onChange: (field: PackageSurfaceRecord, value: unknown) => void;
  value: unknown;
}) {
  const kind = formControlKind(field);
  const placeholder = firstString(field.placeholder);
  const label = firstString(field.label, field.id) ?? "Configuration field";
  const fieldId = configurationFieldId(field);

  if (kind === "checkbox") {
    return (
      <IonCheckbox
        aria-label={label}
        checked={value === true}
        data-configuration-field={fieldId}
        onIonChange={(event) => onChange(field, event.detail.checked === true)}
        slot="end"
      />
    );
  }

  if (kind === "select") {
    return (
      <IonSelect
        aria-label={label}
        data-configuration-field={fieldId}
        interface="popover"
        onIonChange={(event) => onChange(field, event.detail.value ?? "")}
        placeholder={placeholder}
        slot="end"
        value={value}
      >
        {configurationFieldOptions(field).map((option) => (
          <IonSelectOption key={option.value} value={option.value}>
            {option.label}
          </IonSelectOption>
        ))}
      </IonSelect>
    );
  }

  if (kind === "textarea") {
    return (
      <IonTextarea
        aria-label={label}
        data-configuration-field={fieldId}
        onIonInput={(event) => onChange(field, event.detail.value ?? "")}
        placeholder={placeholder}
        slot="end"
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  return (
    <IonInput
      aria-label={label}
      data-configuration-field={fieldId}
      onIonInput={(event) => onChange(field, event.detail.value ?? "")}
      placeholder={placeholder}
      slot="end"
      type={kind === "secret" ? "password" : "text"}
      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
    />
  );
}

function configurationFieldKey(field: PackageSurfaceRecord): string {
  return firstString(field.id, field.label, field.config_type) ?? JSON.stringify(field);
}

function configurationFieldId(field: PackageSurfaceRecord): string {
  return firstString(field.id, field.label, field.config_type) ?? JSON.stringify(field);
}

function configurationDraftValues(fields: PackageSurfaceRecord[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [configurationFieldId(field), configurationFieldValue(field)]));
}

function configurationFieldValue(field: PackageSurfaceRecord): unknown {
  if (formControlKind(field) === "checkbox") return field.value === true;
  if (typeof field.value === "string" || typeof field.value === "number" || typeof field.value === "boolean") return field.value;
  return "";
}

function formControlKind(field: PackageSurfaceRecord): string {
  const configType = configurationFieldType(field);
  if (configType === "multiline_text") return "textarea";
  if (configType === "boolean") return "checkbox";
  if (configType === "select") return "select";
  if (configType === "secret") return "secret";
  return firstString(field.kind) ?? "text_input";
}

function configurationFieldOptions(field: PackageSurfaceRecord): Array<{ value: string; label: string }> {
  return packageSurfaceRecords(field.options).map((option) => ({
    value: stringValue(option.value, ""),
    label: stringValue(option.label, stringValue(option.value, ""))
  })).filter((option) => option.value.length > 0);
}

function configurationFieldErrors(field: PackageSurfaceRecord): string[] {
  return arrayOfStrings(field.errors);
}

function configurationFieldSecretRedacted(field: PackageSurfaceRecord): boolean {
  return configurationFieldType(field) === "secret" && field.secret_state === "redacted";
}

function packageActionFromValue(value: unknown): ActionBinding | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ActionBinding) : undefined;
}

function loadStatusLabel(status: DogfoodEntityLoadStatus): string {
  if (status === "not_loaded") return "Not loaded";
  if (status === "loading") return "Loading";
  if (status === "loaded") return "Loaded";
  return "Error";
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function appDisplayName(title: unknown, fallback: string): string {
  return stringValue(title, fallback).replace(/[-_]+/g, " ");
}

function capabilityCountLabel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value === "No requested capabilities") {
    return "0";
  }

  return String(value.split(",").filter((part) => part.trim().length > 0).length);
}

export type PackageSurfaceRecord = Record<string, unknown> & {
  launch_action?: ActionBinding;
};

export function packageAppSurfaces(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.app_surfaces);
}

export function packageSettingsSurfaces(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.settings_surfaces);
}

function packageActions(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.package_actions);
}

function packageSurfaceRecords(value: unknown): PackageSurfaceRecord[] {
  return Array.isArray(value)
    ? value.filter((surface): surface is PackageSurfaceRecord => Boolean(surface && typeof surface === "object" && !Array.isArray(surface)))
    : [];
}

export function surfaceLaunchAction(surface: PackageSurfaceRecord | undefined): ActionBinding | undefined {
  return surface?.launch_action && typeof surface.launch_action === "object" ? surface.launch_action : undefined;
}

function packageActionBinding(record: PackageSurfaceRecord | undefined): ActionBinding | undefined {
  return record?.action && typeof record.action === "object" ? (record.action as ActionBinding) : undefined;
}

function packageActionKey(record: PackageSurfaceRecord): string {
  return firstString(record.id, record.action_id, packageActionBinding(record)?.id) ?? JSON.stringify(record);
}

function packageActionDetail(record: PackageSurfaceRecord): string {
  const status = stringValue(record.status, "unknown");
  const reason = firstString(record.reason);
  return reason ? `${status}: ${reason}` : status;
}

function packageActionIcon(record: PackageSurfaceRecord): string {
  const actionId = stringValue(record.action_id, "");
  if (actionId.includes("update")) return openOutline;
  if (actionId.includes("enable") || actionId.includes("disable") || actionId.includes("start") || actionId.includes("stop")) return powerOutline;
  if (actionId.includes("reload") || actionId.includes("restart")) return refreshOutline;
  return constructOutline;
}

function surfaceTitle(surface: PackageSurfaceRecord): string {
  return firstString(surface.title, surface.surface_id, surface.id) ?? "Plugin surface";
}

function surfaceDescription(surface: PackageSurfaceRecord): string | undefined {
  return firstString(surface.description);
}

function surfaceKey(surface: PackageSurfaceRecord): string {
  return firstString(surface.surface_id, surface.id, surface.title) ?? JSON.stringify(surface);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function badgeColor(severity: WorkflowSummary["severity"]): string {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "medium";
}
