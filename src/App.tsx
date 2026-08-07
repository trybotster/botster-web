import {
  IonApp,
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCheckbox,
  IonChip,
  IonCol,
  IonContent,
  IonFooter,
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
  IonModal,
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addOutline,
  arrowBackOutline,
  cogOutline,
  constructOutline,
  cubeOutline,
  keyOutline,
  layersOutline,
  openOutline,
  playOutline,
  powerOutline,
  refreshOutline,
  serverOutline
} from "ionicons/icons";

import { TerminalViewHost } from "./botster/TerminalViewHost";
import { ConnectionDiagnosticsPanel } from "./botster/ConnectionDiagnosticsPanel";
import { LocalHubFirstScreen, type HubEntityLoadStatus } from "./botster/LocalHubFirstScreen";
import { UiNodeSurface } from "./botster/UiNodeSurface";
import { botsterWebCapabilities, defaultUiCapabilitySet } from "./botster/capabilities";
import { botsterWebClientContract, createBotsterWebClient } from "./botster/client";
import {
  actionFailureDiagnostic,
  compatibilityDiagnosticsFromFrame,
  connectionFailureDiagnostic,
  hubConnectionDiagnosticFromFrame,
  hubStatusFamily,
  initialConnectionDiagnostics,
  operatorErrorDiagnostic,
  schemaVersionInformationFromFrame,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  type ConnectionDiagnostic
} from "./botster/connectionDiagnostics";
import { createHubRuntimeConfig } from "./botster/hubRuntime";
import { webRtcDaemonLifecycleEventName, type LocalWebrtcBootstrap, type WebrtcDaemonLifecycleEvent } from "./botster/webrtcDaemonClient";
import type { ActionBinding, ActionDispatchResult } from "./botster/actions";
import type { EntityFrameStore } from "./botster/entities";
import type { EntitySubscriptionErrorPayload } from "./botster/protocol";
import type { TerminalAttachmentStatus, TerminalDataPlaneAttachment, TerminalViewDescriptor } from "./botster/terminal";
import {
  isAttachableSession,
  sessionDisplayStatus,
  sessionDisplayTitle
} from "./botster/terminalSession";
import {
  pluginSurfaceActionRequest,
  type UiActionRequest,
  type UiNodeActionDispatch,
  type UiTreeSnapshot
} from "./botster/uiNodes";
import {
  acceptedResultMatches,
  applyAcceptedPresentation,
  presentationValues,
  replaceAcceptedSurface,
  type UiPresentationState
} from "./botster/uiPresentation";
import { configurationFieldType, configurationSaveAction } from "./packageConfigurationForm";

const mobileUserAgentPattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

setupIonicReact({
  mode: "md",
  platform: {
    desktop: (win) => !mobileUserAgentPattern.test(win.navigator.userAgent)
  }
});

type AppView = "dashboard" | "apps" | "hub-settings" | "session";
type HubSettingsSection = "general" | "spawn-points" | "session-types" | "extensions" | "support";
type AppRoute =
  | { view: "dashboard" }
  | { view: "apps"; packageName?: string; surfaceId?: string; settings?: false }
  | { view: "apps"; packageName: string; settings: true; surfaceId?: string }
  | { view: "hub-settings"; section?: HubSettingsSection }
  | { view: "session"; sessionId: string };

const navigationItems: Array<{ label: string; icon: string; view: AppView }> = [
  { label: "Home", icon: layersOutline, view: "dashboard" },
  { label: "Apps", icon: cubeOutline, view: "apps" }
];

const appViewPaths: Record<AppView, string> = {
  dashboard: "/dashboard",
  apps: "/apps",
  "hub-settings": "/settings",
  session: "/sessions"
};

const hubSettingsSections: Array<{ id: HubSettingsSection; label: string; description: string }> = [
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
  onOpen
}: {
  entries: Record<string, unknown>[];
  onOpen: (entry: Record<string, unknown>) => void;
}) {
  if (entries.length === 0) return null;

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
  surface: "botster-web.production.loading",
  version: "local-loading-v1",
  root: {
    id: "production-loading-root",
    type: "section",
    props: { title: "Waiting for local surface" },
    children: [
      {
        id: "production-loading-copy",
        type: "text",
        props: { text: "The local session surface is loading." }
      }
    ]
  }
};

const terminalRenderer = "restty" as const;

export function terminalDescriptorForSessionId(sessionId: string | undefined): TerminalViewDescriptor | undefined {
  return sessionId ? { sessionId, renderer: terminalRenderer } : undefined;
}

export function terminalReleaseToast(
  sessionId: string,
  status?: TerminalAttachmentStatus
): { message: string; color: "danger" | "medium" } {
  return status?.state === "failed"
    ? { message: status.message, color: "danger" }
    : { message: `Session ${sessionId} ended`, color: "medium" };
}

type BotsterPackageWindow = typeof window & {
  __BOTSTER_PACKAGE_RUNTIME__?: boolean;
  __BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__?: LocalWebrtcBootstrap;
};

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

  const root = validatedPluginSurfaceSnapshotNode(hubSnapshot.body);
  if (!root) return undefined;

  return {
    kind: "ui_tree_snapshot",
    surface: `${packageName}/${surfaceId}`,
    version: "plugin-surface-hub-validated-v1",
    root
  };
}

function validatedPluginSurfaceSnapshotNode(value: unknown): UiTreeSnapshot["root"] | undefined {
  const record = readRecord(value);
  if (!readString(record.type)) return undefined;

  // The Hub has already identity-matched and validated this body against the
  // canonical UI contract. Web preserves that grammar instead of translating
  // it into a second browser-owned node vocabulary.
  return value as UiTreeSnapshot["root"];
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
  packageName?: string;
  surfaceId?: string;
  actionResult?: import("@trybotster/ui-contract").UiActionResult;
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
      snapshot: renderedSurfaceSnapshot,
      packageName: expectedSurface?.packageName,
      surfaceId: expectedSurface?.surfaceId
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

function spawnTargetActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } | undefined {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type);
  if (!requestType?.includes("spawn_target")) return undefined;
  const actionLabel = actionLabelFromId(requestType).replace("Spawn Target", "Spawn Point");

  if (!result.accepted) {
    return {
      message: result.reason ?? `${actionLabel} failed`,
      color: "danger"
    };
  }

  const targets = Array.isArray(payload.spawn_targets) ? payload.spawn_targets : [];
  const target = readRecord(targets[0]);
  const targetId = readString(target.target_id) ?? readString(payload.target_id);
  return {
    message: targetId ? `${targetId}: ${actionLabel}` : `${actionLabel} accepted`,
    color: "success"
  };
}

/**
 * Hub-reported failure of a held entity subscription, scoped to one family. Rendered
 * verbatim on the owning surface; it never triggers a refetch or a resubscribe.
 */
export function entitySubscriptionErrorFromFrame(
  frame: { kind: string; payload: unknown },
  family: string
): EntitySubscriptionErrorPayload | undefined {
  if (frame.kind !== "entity_error") return undefined;
  const payload = readRecord(frame.payload);
  if (readString(payload.family) !== family) return undefined;
  const code = readString(payload.code);
  const message = readString(payload.message);
  if (!code || !message) return undefined;
  return { family, code, message };
}

/**
 * Permissive ONLY before Hub status arrives. Once a status record exists it is authoritative,
 * so a missing, malformed, or empty feature list all mean unsupported — none of them declare
 * `session_type_entity_subscriptions`. Treating a loaded record as "still loading" would let
 * the client infer capability from Hub's silence, which is the inference this surface removes.
 */
export function sessionTypeManagementSupported(hubStatus: Record<string, unknown> | undefined): boolean {
  if (hubStatus === undefined) return true;
  const features = readRecord(hubStatus.compatibility).features;
  return Array.isArray(features) && features.includes("session_type_entity_subscriptions");
}

/**
 * The capability state and the subscription-error state are independent conditions on the
 * same surface: one says Hub never offered session types, the other says a live subscription
 * failed. Extracted so both can be rendered and asserted, rather than proved by source text.
 */
export function SessionTypesSurfaceNotices({
  supported,
  subscriptionError,
  onCreate
}: {
  supported: boolean;
  subscriptionError: EntitySubscriptionErrorPayload | undefined;
  onCreate: () => void;
}) {
  return (
    <>
      {supported ? (
        <div className="modal-actions">
          <IonButton size="small" onClick={onCreate} data-testid="create-session-type">
            Add session type
          </IonButton>
        </div>
      ) : (
        <IonNote color="warning" data-testid="session-types-unsupported">
          This hub does not provide session_type_entity_subscriptions.
        </IonNote>
      )}
      {subscriptionError ? (
        <IonNote color="danger" data-testid="session-types-subscription-error">
          {subscriptionError.code}: {subscriptionError.message}
        </IonNote>
      ) : null}
    </>
  );
}

export function isEntitySnapshotFrameForFamily(
  frame: { kind: string; payload: unknown },
  family: string
): boolean {
  if (frame.kind !== "entity_snapshot") return false;
  return readString(readRecord(frame.payload).family) === family;
}

export function sessionTypeActionFeedback(result: { accepted: boolean; reason?: string; result?: unknown }): { message: string; color: string } | undefined {
  const payload = readRecord(result.result);
  const requestType = readString(payload.request_type);
  if (!requestType?.includes("session_type")) return undefined;

  return {
    message: result.accepted
      ? `${actionLabelFromId(requestType)} accepted`
      : result.reason ?? `${actionLabelFromId(requestType)} failed`,
    color: result.accepted ? "success" : "danger"
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

type SpawnTargetFormMode = "create" | "edit";

interface SpawnTargetFormState {
  mode: SpawnTargetFormMode;
  targetId: string;
  originalTargetId?: string;
  label: string;
  root: string;
  kind: string;
  enabled: boolean;
  metadata: string;
}

export interface SpawnSessionFormState {
  targetId: string;
  targetLabel: string;
  sessionTypeId: string;
  prompt: string;
  submitting: boolean;
  error?: string;
}

/**
 * Hub resolves a session type against exactly one spawn target, so filtering by the
 * Hub-provided target_id presents Hub's own eligibility rather than duplicating it.
 * Unavailable types are kept and rendered disabled; hiding them would enforce
 * eligibility invisibly on the client.
 */
export function sessionTypesForSpawnTarget(
  sessionTypes: Record<string, unknown>[],
  targetId: string
): Record<string, unknown>[] {
  return sessionTypes.filter((sessionType) => stringValue(sessionType.target_id, "") === targetId);
}

export function spawnSessionFormForTarget(
  target: Record<string, unknown>,
  sessionTypes: Record<string, unknown>[]
): SpawnSessionFormState {
  const targetId = stringValue(target.target_id, String(target.id));
  const selectable = sessionTypesForSpawnTarget(sessionTypes, targetId)
    .filter((sessionType) => sessionType.available !== false);
  return {
    targetId,
    targetLabel: stringValue(target.label, stringValue(target.title, targetId)),
    sessionTypeId: selectable.length === 1 ? String(selectable[0].id) : "",
    prompt: "",
    submitting: false
  };
}

export function spawnSessionAction(form: SpawnSessionFormState, sessionId: string): ActionBinding {
  return {
    id: "botster.spawn_point.spawn_session",
    target: form.targetId,
    label: "Start session",
    params: {
      session_type_id: form.sessionTypeId,
      session_id: sessionId,
      prompt: form.prompt.trim()
    }
  };
}

export function rejectedSpawnSessionForm(
  form: SpawnSessionFormState,
  reason: string | undefined
): SpawnSessionFormState {
  return {
    ...form,
    submitting: false,
    error: reason ?? "Botster could not start this session."
  };
}

/**
 * Create-only. See SessionTypeListItem for why editing is withheld until Hub publishes a
 * lossless authoring view (ticket_1786039258_173310 / ticket_1786039279_917823).
 */
export interface SessionTypeFormState {
  source: string;
  sourceTargetId: string;
  sessionTypeId?: string;
  id: string;
  label: string;
  description: string;
  icon: string;
  role: string;
  interaction: string;
  traits: string;
  lifecycle: string;
  command: string;
  args: string;
  workingDirectoryPolicy: string;
  workingDirectoryPath: string;
  environment: string;
  allowedEnvironmentOverrides: string;
  contextKeys: string;
  submitting: boolean;
  error?: string;
}

export const emptySessionTypeForm: SessionTypeFormState = {
  source: "device",
  sourceTargetId: "",
  id: "",
  label: "",
  description: "",
  icon: "",
  role: "",
  interaction: "",
  traits: "",
  lifecycle: "",
  command: "",
  args: "",
  workingDirectoryPolicy: "",
  workingDirectoryPath: "",
  environment: "",
  allowedEnvironmentOverrides: "",
  contextKeys: "",
  submitting: false
};

/**
 * A mutation source for an existing row, read from Hub's own `source` and `target_id`.
 * Deliberately not a full form projection: the published row cannot reconstruct an
 * authoring definition, so nothing here may be used to seed an edit.
 */
export function sessionTypeMutationSourceFromRecord(record: Record<string, unknown>): Record<string, unknown> {
  const source = stringValue(record.source, "device");
  return source === "repo"
    ? { source: "repo", target_id: stringValue(record.target_id, "") }
    : { source };
}

/**
 * Writable sources are read from Hub-projected state only: the device source plus any
 * enabled admitted spawn target. Hub still owns admission and every semantic rejection.
 */
export function writableSessionTypeSources(
  spawnTargets: Record<string, unknown>[]
): { source: string; targetId: string; label: string }[] {
  return [
    { source: "device", targetId: "", label: "This device" },
    ...spawnTargets
      .filter((target) => target.enabled !== false)
      .map((target) => {
        const targetId = stringValue(target.target_id, String(target.id));
        return {
          source: "repo",
          targetId,
          label: stringValue(target.label, stringValue(target.title, targetId))
        };
      })
  ];
}

export function sessionTypeMutationSource(form: SessionTypeFormState): Record<string, unknown> {
  return form.source === "repo"
    ? { source: "repo", target_id: form.sourceTargetId }
    : { source: form.source };
}

export function sessionTypeDefinitionFromForm(form: SessionTypeFormState): Record<string, unknown> {
  return {
    id: form.id.trim(),
    label: form.label.trim(),
    description: form.description.trim(),
    icon: form.icon.trim(),
    role: form.role.trim(),
    interaction: form.interaction.trim(),
    traits: parseTokenList(form.traits),
    lifecycle: form.lifecycle.trim(),
    command: form.command.trim(),
    args: parseTokenList(form.args),
    ...(form.workingDirectoryPolicy.trim()
      ? {
          working_directory: {
            policy: form.workingDirectoryPolicy.trim(),
            path: form.workingDirectoryPath.trim()
          }
        }
      : {}),
    environment: parseMetadata(form.environment),
    allowed_environment_overrides: parseTokenList(form.allowedEnvironmentOverrides),
    context: parseTokenList(form.contextKeys)
  };
}

/**
 * Renders Hub's own rejection on the owning form. The error kind is carried verbatim when
 * Hub supplies one; Web never authors a replacement explanation.
 */
export function rejectedSessionTypeForm(
  form: SessionTypeFormState,
  result: { reason?: string; result?: unknown }
): SessionTypeFormState {
  const payload = readRecord(result.result);
  const errorKind = readString(payload.error_kind);
  const message = result.reason ?? "Botster could not save this session type.";
  return {
    ...form,
    submitting: false,
    error: errorKind ? `${errorKind}: ${message}` : message
  };
}

/**
 * Structural emptiness only. Token shape, namespacing, uniqueness, and path rules are
 * Hub's authority and must not be re-implemented here.
 */
export function sessionTypeFormIsStructurallyComplete(form: SessionTypeFormState): boolean {
  return Boolean(
    form.id.trim() &&
    form.label.trim() &&
    form.role.trim() &&
    form.interaction.trim() &&
    form.lifecycle.trim() &&
    form.command.trim() &&
    (form.source !== "repo" || form.sourceTargetId.trim())
  );
}

/**
 * Groups by the Hub-provided source token. Sources are sorted by name only -- Hub already
 * resolved precedence, so display order must not imply it.
 */
export function groupSessionTypesBySource(
  sessionTypes: Record<string, unknown>[]
): { source: string; rows: Record<string, unknown>[] }[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const sessionType of sessionTypes) {
    const source = stringValue(sessionType.source, "");
    const rows = groups.get(source);
    if (rows) {
      rows.push(sessionType);
    } else {
      groups.set(source, [sessionType]);
    }
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, rows]) => ({ source, rows }));
}

function parseTokenList(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

const emptySpawnTargetForm: SpawnTargetFormState = {
  mode: "create",
  targetId: "",
  label: "",
  root: "",
  kind: "directory",
  enabled: true,
  metadata: ""
};

function spawnTargetFormFromRecord(record: Record<string, unknown>): SpawnTargetFormState {
  const targetId = stringValue(record.target_id, String(record.id));
  return {
    mode: "edit",
    targetId,
    originalTargetId: targetId,
    label: stringValue(record.label, stringValue(record.title, targetId)),
    root: stringValue(record.root, ""),
    kind: stringValue(record.kind, "directory"),
    enabled: record.enabled !== false,
    metadata: formatMetadata(readRecord(record.metadata))
  };
}

function formatMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseMetadata(input: string): Record<string, string> {
  return Object.fromEntries(
    input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex < 1) return [];
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return key ? [[key, value]] : [];
      })
  );
}

function spawnTargetIdFromLabel(label: string): string {
  return label
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function compareSpawnTargetRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftEnabled = left.enabled !== false ? 0 : 1;
  const rightEnabled = right.enabled !== false ? 0 : 1;
  return leftEnabled - rightEnabled
    || stringValue(left.label, stringValue(left.title, String(left.id))).localeCompare(stringValue(right.label, stringValue(right.title, String(right.id))))
    || String(left.id).localeCompare(String(right.id));
}

/**
 * Renders one Hub session-type row. Every visible value is a Hub descriptor rendered
 * verbatim -- no name humanising, no lookup table, no classification inferred from
 * command or id. Delete is gated solely on Hub's per-row `editable`.
 *
 * Editing is deliberately absent. Hub's published row carries `working_directory_policy`
 * but not the authored path, and no `environment`, while Hub's update replaces the stored
 * definition wholesale -- so a client-side edit would silently drop those fields. Rather
 * than let the affordance look broken or missing for no reason, editable rows say so.
 * Tracked by ticket_1786039279_917823, which depends on the Hub-side lossless authoring
 * view in ticket_1786039258_173310.
 */
export function SessionTypeListItem({
  sessionType,
  onDelete
}: {
  sessionType: Record<string, unknown>;
  onDelete: (sessionType: Record<string, unknown>) => void;
}) {
  const sessionTypeId = String(sessionType.id);
  const label = stringValue(sessionType.label, "");
  const description = stringValue(sessionType.description, "");
  const editable = sessionType.editable === true;
  const available = sessionType.available !== false;
  const traits = Array.isArray(sessionType.traits) ? sessionType.traits : [];
  const overriddenSources = Array.isArray(sessionType.overridden_sources) ? sessionType.overridden_sources : [];
  const diagnostics = Array.isArray(sessionType.diagnostics) ? sessionType.diagnostics : [];

  return (
    <IonItem className="session-type-item" data-testid={`session-type-${sessionTypeId}`}>
      <IonLabel>
        <h2>{label}</h2>
        {description ? <p>{description}</p> : null}
        <p data-testid={`session-type-semantics-${sessionTypeId}`}>
          {stringValue(sessionType.role, "")} · {stringValue(sessionType.interaction, "")} · {stringValue(sessionType.lifecycle, "")}
        </p>
        {traits.length > 0 ? (
          <p data-testid={`session-type-traits-${sessionTypeId}`}>
            {traits.map((trait) => String(trait)).join(", ")}
          </p>
        ) : null}
        <p data-testid={`session-type-provenance-${sessionTypeId}`}>
          {stringValue(sessionType.source, "")} · {stringValue(sessionType.source_name, "")} · {stringValue(sessionType.target_id, "")}
        </p>
        <p className="session-type-technical-detail">{stringValue(sessionType.command, "")}</p>
        {overriddenSources.length > 0 ? (
          <p data-testid={`session-type-overrides-${sessionTypeId}`}>
            Overrides {overriddenSources
              .map((entry) => {
                const source = readRecord(entry);
                return `${stringValue(source.kind, "")}:${stringValue(source.name, "")}`;
              })
              .join(", ")}
          </p>
        ) : null}
        {diagnostics.map((diagnostic, index) => (
          <p key={index} data-testid={`session-type-diagnostic-${sessionTypeId}`}>
            {String(diagnostic)}
          </p>
        ))}
      </IonLabel>
      <IonBadge color={available ? "success" : "medium"} slot="end">
        {available ? "Available" : "Unavailable"}
      </IonBadge>
      {editable ? (
        <IonButtons slot="end">
          <IonNote data-testid={`session-type-edit-unavailable-${sessionTypeId}`}>
            Editing not available yet
          </IonNote>
          <IonButton
            aria-label={`Delete ${label}`}
            fill="outline"
            color="danger"
            onClick={() => onDelete(sessionType)}
            data-testid={`delete-session-type-${sessionTypeId}`}
          >
            Delete
          </IonButton>
        </IonButtons>
      ) : (
        <IonBadge color="medium" slot="end" data-testid={`session-type-read-only-${sessionTypeId}`}>
          Read-only
        </IonBadge>
      )}
    </IonItem>
  );
}

export function SpawnTargetListItem({
  target,
  onSpawn,
  onEdit,
  onDelete
}: {
  target: Record<string, unknown>;
  onSpawn: (target: Record<string, unknown>) => void;
  onEdit: (target: Record<string, unknown>) => void;
  onDelete: (target: Record<string, unknown>) => void;
}) {
  const targetId = stringValue(target.target_id, String(target.id));
  const label = stringValue(target.label, stringValue(target.title, targetId));
  const root = stringValue(target.root, "");
  const kind = stringValue(target.kind, "directory");
  const enabled = target.enabled !== false;

  return (
    <IonItem className="spawn-target-item">
      <IonLabel>
        <h2>{label}</h2>
        <p>{root}</p>
        <p className="spawn-target-technical-detail">{targetId} · {kind}</p>
      </IonLabel>
      <IonBadge color={enabled ? "success" : "medium"} slot="end">
        {enabled ? "Enabled" : "Disabled"}
      </IonBadge>
      <IonButtons slot="end">
        <IonButton
          aria-label={`New session at ${label}`}
          fill="outline"
          disabled={!enabled}
          onClick={() => onSpawn(target)}
        >
          <IonIcon icon={playOutline} slot="start" aria-hidden="true" />
          New session
        </IonButton>
        <IonButton aria-label={`Edit ${label}`} onClick={() => onEdit(target)}>
          Edit
        </IonButton>
        <IonButton aria-label={`Delete ${label}`} color="danger" onClick={() => onDelete(target)}>
          Delete
        </IonButton>
      </IonButtons>
    </IonItem>
  );
}

export function SessionListItem({
  session,
  onOpen
}: {
  session: Record<string, unknown>;
  onOpen: (sessionId: string) => void;
}) {
  const sessionId = String(session.id);
  const attachable = isAttachableSession(session);
  return (
    <IonItem>
      <IonIcon icon={serverOutline} slot="start" aria-hidden="true" />
      <IonLabel>
        <h2>{sessionDisplayTitle(session)}</h2>
        <p>{sessionDisplayStatus(session)}</p>
      </IonLabel>
      {attachable ? <IonButton slot="end" fill="outline" onClick={() => onOpen(sessionId)}>Open</IonButton> : null}
    </IonItem>
  );
}

/**
 * Workbench primary nav (Home / Apps). Exported for host-chrome anti-drift contracts —
 * no behavior change; App renders this in the sidebar.
 */
export function WorkbenchNav({
  activeView,
  onNavigate,
  children
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  children?: ReactNode;
}) {
  return (
    <nav aria-label="Botster workbench">
      <IonList lines="none" className="nav-list">
        {navigationItems.map((item) => (
          <IonMenuToggle autoHide={false} key={item.label}>
            <button
              type="button"
              className={activeView === item.view ? "nav-item active" : "nav-item"}
              aria-current={activeView === item.view ? "page" : undefined}
              onClick={() => onNavigate(item.view)}
            >
              <IonIcon icon={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          </IonMenuToggle>
        ))}
      </IonList>
      {children}
    </nav>
  );
}

/**
 * Dashboard (Home) view. Extracted for export-for-contract so detach oracle unit tests
 * can prove data-testid="dashboard-view" against real rendered product markup.
 * Behavior-neutral structural extraction — App renders the same tree via this component.
 */
export function DashboardView({
  sessions,
  sessionLoadStatus,
  onOpenSession,
  onNavigateToApps,
  onNavigateToSpawnPoints
}: {
  sessions: Record<string, unknown>[];
  sessionLoadStatus: HubEntityLoadStatus;
  onOpenSession: (sessionId: string) => void;
  onNavigateToApps: () => void;
  onNavigateToSpawnPoints: () => void;
}) {
  return (
    <section className="view-stack" aria-labelledby="dashboard-heading" data-testid="dashboard-view">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Local hub</p>
          <h1 id="dashboard-heading">Your sessions</h1>
          <p>Return to work already running on this device.</p>
        </div>
      </section>
      <section className="workflow-section home-sessions" aria-labelledby="recent-sessions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent work</p>
            <h2 id="recent-sessions-heading">Sessions</h2>
          </div>
          <IonBadge color="medium">{sessions.length}</IonBadge>
        </div>
        {sessionLoadStatus === "error" ? (
          <p className="entity-empty">Sessions could not be loaded. Open Hub settings for connection details.</p>
        ) : sessions.length > 0 ? (
          <IonList lines="full" aria-label="Sessions">
            {sessions.map((session) => (
              <SessionListItem
                key={String(session.id)}
                session={session}
                onOpen={onOpenSession}
              />
            ))}
          </IonList>
        ) : (
          <div className="home-empty-state">
            <h3>No sessions yet</h3>
            <p>Choose a spawn point to get ready for your first session.</p>
            <IonButton fill="outline" size="small" onClick={onNavigateToSpawnPoints}>
              View spawn points
            </IonButton>
          </div>
        )}
      </section>
      <div className="home-shortcuts" aria-label="Set up Botster">
        <button type="button" onClick={onNavigateToApps}>
          <IonIcon icon={cubeOutline} aria-hidden="true" />
          <span><strong>Apps</strong><small>Open installed tools and extensions</small></span>
        </button>
        <button type="button" onClick={onNavigateToSpawnPoints}>
          <IonIcon icon={serverOutline} aria-hidden="true" />
          <span><strong>Spawn points</strong><small>Choose where sessions can run</small></span>
        </button>
      </div>
    </section>
  );
}

/**
 * Apps launcher shell. Exported so default-path host-chrome inventory can prove
 * data-testid="apps-view" from rendered markup (behavior-neutral).
 */
export function AppsView({
  installedRowCount,
  onAddPackage,
  children
}: {
  installedRowCount: number;
  onAddPackage: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="view-stack" aria-labelledby="apps-heading" data-testid="apps-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Launcher</p>
          <h1 id="apps-heading">Apps</h1>
        </div>
        <IonButton aria-label="Add package" onClick={onAddPackage}>
          <IonIcon icon={addOutline} slot="start" aria-hidden="true" />
          Add
        </IonButton>
      </div>
      {installedRowCount > 0 ? (
        <IonList lines="full" aria-label="Installed">
          {children}
        </IonList>
      ) : (
        <article className="workflow-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Installed</p>
              <h2>No packages installed</h2>
            </div>
          </div>
          <p className="entity-empty">Add a package to make an app or plugin available here.</p>
        </article>
      )}
    </section>
  );
}

/**
 * Hub settings section nav (General / Session types / Support / …).
 * Exported for host-chrome anti-drift contracts — behavior-neutral.
 */
export function HubSettingsSectionsNav({
  activeSection,
  onNavigate
}: {
  activeSection: HubSettingsSection;
  onNavigate: (section: HubSettingsSection) => void;
}) {
  return (
    <nav className="hub-settings-nav" aria-label="Hub settings sections">
      {hubSettingsSections.map((section) => (
        <button
          type="button"
          key={section.id}
          className={activeSection === section.id ? "active" : undefined}
          aria-current={activeSection === section.id ? "page" : undefined}
          onClick={() => onNavigate(section.id)}
        >
          <strong>{section.label}</strong>
          <span>{section.description}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * Support / diagnostics panel shell. Exported so diagnostics-view and
 * developer-diagnostics remain inventory-covered under npm test.
 */
export function DiagnosticsView({
  diagnosticCount,
  blocking,
  children,
  developerDetails
}: {
  diagnosticCount: number;
  blocking: boolean;
  children?: ReactNode;
  developerDetails?: ReactNode;
}) {
  return (
    <section
      className="view-stack hub-settings-panel"
      aria-labelledby="diagnostics-view-heading"
      data-testid="diagnostics-view"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="diagnostics-view-heading">Support</h2>
        </div>
        <IonBadge color={blocking ? "danger" : "medium"}>
          {diagnosticCount}
        </IonBadge>
      </div>
      {children}
      {developerDetails !== undefined ? (
        <details className="developer-diagnostics">
          <summary>Developer details</summary>
          <p>Protocol, renderer, entity-frame, and terminal details for troubleshooting.</p>
          {developerDetails}
        </details>
      ) : null}
    </section>
  );
}

/**
 * Session types settings panel shell. Exported for default-path host-chrome inventory.
 */
export function SessionTypesView({
  sessionTypeCount,
  children
}: {
  sessionTypeCount: number;
  children?: ReactNode;
}) {
  return (
    <section
      className="view-stack hub-settings-panel"
      aria-labelledby="session-types-heading"
      data-testid="session-types-view"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sessions</p>
          <h2 id="session-types-heading">Session types</h2>
          <p className="page-description">Available ways to start a session at each spawn point.</p>
        </div>
        <IonBadge color="medium">{sessionTypeCount}</IonBadge>
      </div>
      {children}
    </section>
  );
}

/** Create-session-type form submit control — export-for-contract for harness testid. */
export function SessionTypeSubmitButton({
  disabled,
  submitting,
  onClick
}: {
  disabled: boolean;
  submitting: boolean;
  onClick: () => void;
}) {
  return (
    <IonButton
      disabled={disabled}
      onClick={onClick}
      data-testid="submit-session-type"
    >
      {submitting ? "Saving…" : "Create"}
    </IonButton>
  );
}

type HubEntityLoadKey =
  | "hubStatus"
  | "app"
  | "packageNavigation"
  | "package"
  | "availablePackage"
  | "spawnTarget"
  | "sessionType"
  | "session";

/**
 * Reconnect hydration is listener-driven per family, deliberately.
 *
 * `EntityFrameStore.replayActivePulls()` exists but has no production caller anywhere in
 * `src/`, so registering a family as an active pull makes it replay-ELIGIBLE without
 * anything replaying it. This function is therefore the sole mechanism keeping hub
 * identity, protocol, and schema facts from regressing after a WebRTC reconnect — the
 * `botster-web.hub_status` registration in the connect chain does not cover it. Removing
 * this listener on the assumption that registered pulls are replayed would silently
 * reintroduce the regression. See [[botster browser pull requests must retry after webrtc
 * reconnect]]; widening it to a generic replay of every family is out of this ticket's scope.
 */
export function replayHubStatusOnLifecycleEvent(
  detail: WebrtcDaemonLifecycleEvent,
  entities: { pull(request: { family: string }): Promise<void> }
): boolean {
  if (detail.type !== "data-channel-open") return false;
  void entities.pull({ family: hubStatusFamily });
  return true;
}

export const hubUpdateCheckActionId = "botster.hub.check_update";

export function hubUpdateCheckAction(): ActionBinding {
  return { id: hubUpdateCheckActionId, label: "Check for updates" };
}

export interface HubUpdateOutcome {
  accepted: boolean;
  update?: Record<string, unknown>;
  reason?: string;
}

/**
 * The update outcome is authored entirely by the accepted action result. A rejected
 * result (offline transport, or a hub operator error) carries no `hub_update`, so no
 * DaemonHubUpdateState is ever synthesized on the client.
 */
export function hubUpdateOutcomeFromResult(result: ActionDispatchResult): HubUpdateOutcome {
  const update = readRecord(readRecord(result.result).hub_update);
  const state = readString(update.state);
  return {
    accepted: result.accepted,
    ...(result.accepted && state ? { update } : {}),
    ...(readString(result.reason) ? { reason: result.reason } : {})
  };
}

export function hubUpdateOutcomeSummary(outcome: HubUpdateOutcome | undefined): string {
  if (!outcome) return "Check whether a newer Hub version is available.";

  const update = readRecord(outcome.update);
  const state = readString(update.state);
  if (!state) {
    return outcome.reason ? `Update check failed: ${outcome.reason}` : "Update check failed.";
  }

  const currentVersion = readString(update.current_version);
  const availableVersion = readString(update.available_version);
  const headline =
    state === "available"
      ? `Update available${availableVersion ? `: ${availableVersion}` : ""}`
      : state === "current"
        ? `Up to date${currentVersion ? `: ${currentVersion}` : ""}`
        : `Updates ${state}`;
  const reason = readString(update.reason);
  return reason ? `${headline} — ${reason}` : headline;
}

export function HubGeneralSection({
  hubStatus,
  hubUpdate,
  onCheckForUpdates
}: {
  hubStatus: Record<string, unknown> | undefined;
  hubUpdate: HubUpdateOutcome | undefined;
  onCheckForUpdates: () => void;
}) {
  const software = readRecord(hubStatus?.software);
  const installation = readRecord(hubStatus?.installation);
  const compatibility = readRecord(hubStatus?.compatibility);
  const buildRevision = readString(software.build_revision);
  const releaseChannel = readString(installation.release_channel);
  const provider = readString(installation.provider);
  const features = arrayOfStrings(compatibility.features);
  const updateState = readString(readRecord(hubUpdate?.update).state);
  const updateAction = readString(readRecord(hubUpdate?.update).action);
  return (
    <section className="view-stack hub-settings-panel" aria-labelledby="hub-general-heading" data-testid="hub-settings-general">
      <div className="page-heading">
        <div>
          <p className="eyebrow">About this hub</p>
          <h2 id="hub-general-heading">General</h2>
          <p className="page-description">Identity and software information for this Botster Hub.</p>
        </div>
      </div>
      <dl className="hub-metadata-list" data-testid="hub-software-identity">
        <div><dt>Software</dt><dd>{stringValue(software.product_name, "Not reported")}</dd></div>
        <div><dt>Version</dt><dd>{stringValue(software.version, "Not reported")}</dd></div>
        {buildRevision ? <div><dt>Build</dt><dd>{buildRevision}</dd></div> : null}
        <div><dt>Installation</dt><dd>{stringValue(installation.mode, "Not reported")}</dd></div>
        <div><dt>Provenance</dt><dd>{stringValue(installation.provenance, "Not reported")}</dd></div>
        {releaseChannel ? <div><dt>Release channel</dt><dd>{releaseChannel}</dd></div> : null}
        {provider ? <div><dt>Provider</dt><dd>{provider}</dd></div> : null}
      </dl>
      <div
        className="hub-software-update"
        data-testid="hub-software-update"
        {...(updateState ? { "data-hub-update-state": updateState } : {})}
      >
        <div>
          <h3>Software updates</h3>
          <p data-testid="hub-update-outcome">{hubUpdateOutcomeSummary(hubUpdate)}</p>
          {updateAction ? <p data-testid="hub-update-action">{updateAction}</p> : null}
        </div>
        <IonButton fill="outline" size="small" onClick={onCheckForUpdates}>
          Check for updates
        </IonButton>
      </div>
      <dl className="hub-metadata-list" data-testid="hub-host-identity">
        <div><dt>Name</dt><dd>{stringValue(hubStatus?.title, "Local Hub")}</dd></div>
        <div><dt>Host ID</dt><dd>{stringValue(hubStatus?.host_id, "Not reported")}</dd></div>
      </dl>
      <dl className="hub-metadata-list hub-metadata-secondary" data-testid="hub-internal-state">
        <div><dt>Protocol</dt><dd>{stringValue(compatibility.protocol, "Not reported")} · version {reportedNumber(compatibility.protocol_version, "Not reported")}</dd></div>
        <div><dt>Conformance revision</dt><dd>{reportedNumber(compatibility.conformance_fixture_revision, "Not reported")}</dd></div>
        <div><dt>Features</dt><dd>{features.length > 0 ? features.join(", ") : "Not reported"}</dd></div>
        <div><dt>State schema</dt><dd>Version {reportedNumber(hubStatus?.schema_version, "Not reported")}</dd></div>
      </dl>
    </section>
  );
}

export function SessionRouteView({
  sessionId,
  children
}: {
  sessionId: string;
  children: ReactNode;
}) {
  return (
    <section className="terminal-session-view" aria-label={`Terminal session ${sessionId}`} data-testid="terminal-session-view">
      {children}
    </section>
  );
}

export default function App() {
  const hubRuntime = useMemo(
    () => {
      const packageRuntime = Boolean(
        (window as BotsterPackageWindow).__BOTSTER_PACKAGE_RUNTIME__
      );
      const localWebrtcBootstrap = packageRuntime
        ? normalizeLocalWebrtcBootstrap((window as BotsterPackageWindow).__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__)
        : undefined;
      return createHubRuntimeConfig({
        locationHref: window.location.href,
        ...(packageRuntime ? { signalingUrl: `${window.location.origin}/request` } : {}),
        localWebrtcBootstrap
      });
    },
    []
  );
  const runtimeClient = useMemo(
    () =>
      createBotsterWebClient({
        transport: hubRuntime.transport
      }),
    [hubRuntime]
  );
  const [surfaceSnapshot, setSurfaceSnapshot] = useState<UiTreeSnapshot | undefined>(() => runtimeClient.uiTree.current());
  const [localState, setLocalState] = useState<Record<string, unknown>>({
    "production.action_status": hubRuntime.statusText
  });
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostic[]>(() =>
    initialConnectionDiagnostics(
      hubRuntime.mode,
      hubRuntime.statusText,
      hubRuntime.terminalDataPlaneKind,
      hubRuntime.startupError
    )
  );
  const [entityLoadStatus, setEntityLoadStatus] = useState<Record<HubEntityLoadKey, HubEntityLoadStatus>>({
    hubStatus: "not_loaded",
    app: "not_loaded",
    packageNavigation: "not_loaded",
    package: "not_loaded",
    availablePackage: "not_loaded",
    spawnTarget: "not_loaded",
    sessionType: "not_loaded",
    session: "not_loaded"
  });
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => appRouteFromLocation());
  const [marketplaceRegistryPath, setMarketplaceRegistryPath] = useState("");
  const [localPackagePath, setLocalPackagePath] = useState("");
  const [addPackageOpen, setAddPackageOpen] = useState(false);
  const [spawnTargetForm, setSpawnTargetForm] = useState<SpawnTargetFormState | undefined>();
  const [spawnSessionForm, setSpawnSessionForm] = useState<SpawnSessionFormState | undefined>();
  const [sessionTypeForm, setSessionTypeForm] = useState<SessionTypeFormState | undefined>();
  const [deleteSessionType, setDeleteSessionType] = useState<Record<string, unknown> | undefined>();
  const [sessionTypeSubscriptionError, setSessionTypeSubscriptionError] = useState<EntitySubscriptionErrorPayload | undefined>();
  const [deleteSpawnTarget, setDeleteSpawnTarget] = useState<Record<string, unknown> | undefined>();
  const [packageActionToast, setPackageActionToast] = useState<{ message: string; color: string } | undefined>();
  const [hubUpdate, setHubUpdate] = useState<HubUpdateOutcome | undefined>();
  const [selectedPluginSurface, setSelectedPluginSurface] = useState<SelectedPluginSurface | undefined>();
  const [uiPresentationState, setUiPresentationState] = useState<UiPresentationState>({});
  const lastPluginRouteRenderKey = useRef<string | undefined>(undefined);
  const packageSettingsReturnRoute = useRef<AppRoute>({ view: "apps" });
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
      const detail = (event as CustomEvent<WebrtcDaemonLifecycleEvent>).detail;
      recordDiagnostic(webRtcLifecycleDiagnostic(detail));
      replayHubStatusOnLifecycleEvent(detail, runtimeClient.entities);
    };

    window.addEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);

    return () => {
      window.removeEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);
    };
  }, [recordDiagnostic, runtimeClient]);

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
        recordDiagnostic(schemaVersionInformationFromFrame(frame));
        recordDiagnostics(compatibilityDiagnosticsFromFrame(frame));
        const subscriptionError = entitySubscriptionErrorFromFrame(frame, "session_type");
        if (subscriptionError) {
          setSessionTypeSubscriptionError(subscriptionError);
        } else if (isEntitySnapshotFrameForFamily(frame, "session_type")) {
          // A fresh authoritative baseline ends the failed generation. The error is terminal
          // for its own generation only -- it must not outlive a successful resubscribe.
          setSessionTypeSubscriptionError(undefined);
        }
      }
    });

    const pullProductionEntity = async (
      key: HubEntityLoadKey,
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
      .then(() => runtimeClient.hub.subscribeSurface({ surface: "botster-web.production.session", path: "/sessions/local" }))
      .then(() => pullProductionEntity("hubStatus", { family: hubStatusFamily }))
      .then(() => pullProductionEntity("app", { family: "botster-web.app" }))
      .then(() => pullProductionEntity("packageNavigation", { family: "botster-web.package_navigation" }))
      .then(() => pullProductionEntity("package", { family: "botster-web.package" }))
      .then(() => pullProductionEntity("availablePackage", { family: "botster-web.available_package" }))
      .then(() => pullProductionEntity("spawnTarget", { family: "botster-web.spawn_target" }))
      .then(() => pullProductionEntity("sessionType", { family: "session_type" }))
      .then(() => pullProductionEntity("session", { family: "session" }))
      .catch((error: unknown) => {
        if (!cancelled) {
          updateLocalState({
            "production.action_status": error instanceof Error ? visibleStatusText(error.message) : "Local hub connection failed"
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
    [recordDiagnostic, runtimeClient, updateLocalState]
  );
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
        setPackageActionToast({
          message: accepted
            ? `${actionLabelFromId(dispatch.action.id)} accepted`
            : pluginActionResult.form_errors?.[0] ?? pluginActionResult.error ?? `${actionLabelFromId(dispatch.action.id)} rejected`,
          color: accepted ? "success" : "danger"
        });
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
    [recordDiagnostic, runtimeClient, updateLocalState]
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
  const loadMarketplaceRegistry = useCallback(() => {
    const registryPath = marketplaceRegistryPath.trim();
    if (!registryPath) return;

    setEntityLoadStatus((current) => ({ ...current, availablePackage: "loading" }));
    void runtimeClient.entities
      .pull({ family: "botster-web.available_package", registry_path: registryPath })
      .then(() => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "loaded" }));
        updateLocalState({ "production.diagnostic_action_status": `Loaded marketplace registry ${registryPath}` });
      })
      .catch((error: unknown) => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "error" }));
        updateLocalState({
          "production.diagnostic_action_status": error instanceof Error ? error.message : "Marketplace registry load failed"
        });
      });
  }, [marketplaceRegistryPath, runtimeClient, updateLocalState]);
  const installLocalPackage = useCallback(() => {
    const packagePath = localPackagePath.trim();
    if (!packagePath) return;

    setAddPackageOpen(false);
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
  const openCreateSpawnTarget = useCallback(() => {
    setSpawnTargetForm(emptySpawnTargetForm);
  }, []);
  const openEditSpawnTarget = useCallback((target: Record<string, unknown>) => {
    setSpawnTargetForm(spawnTargetFormFromRecord(target));
  }, []);
  const submitSpawnTargetForm = useCallback(() => {
    if (!spawnTargetForm) return;
    const root = spawnTargetForm.root.trim();
    const label = spawnTargetForm.label.trim();
    const targetId = spawnTargetForm.targetId.trim() || spawnTargetIdFromLabel(label);
    if (!root || !label || !targetId || (spawnTargetForm.mode === "edit" && !spawnTargetForm.originalTargetId)) return;

    const requestType = spawnTargetForm.mode === "create" ? "create_spawn_target" : "update_spawn_target";
    dispatchAction({
      id: "botster.spawn_target.daemon_request",
      target: spawnTargetForm.mode === "edit" ? spawnTargetForm.originalTargetId : targetId,
      label: spawnTargetForm.mode === "create" ? "Create spawn point" : "Save spawn point",
      params: {
        daemon_request: {
          request_type: requestType,
          target_id: spawnTargetForm.mode === "create" ? targetId || undefined : spawnTargetForm.originalTargetId,
          label,
          root,
          enabled: spawnTargetForm.enabled,
          kind: spawnTargetForm.kind.trim() || "directory",
          metadata: parseMetadata(spawnTargetForm.metadata)
        }
      }
    });
    setSpawnTargetForm(undefined);
  }, [dispatchAction, spawnTargetForm]);
  const confirmDeleteSpawnTarget = useCallback(() => {
    if (!deleteSpawnTarget) return;
    const targetId = stringValue(deleteSpawnTarget.target_id, String(deleteSpawnTarget.id));
    if (!targetId) return;
    dispatchAction({
      id: "botster.spawn_target.daemon_request",
      target: targetId,
      label: "Delete spawn point",
      params: {
        daemon_request: {
          request_type: "delete_spawn_target",
          target_id: targetId
        }
      }
    });
    setDeleteSpawnTarget(undefined);
  }, [deleteSpawnTarget, dispatchAction]);
  const recordTerminalDiagnostic = useCallback(
    (error: unknown) => {
      recordDiagnostic(terminalUnavailableDiagnostic(error));
    },
    [recordDiagnostic]
  );
  const installedApps = runtimeClient.entities.list("botster-web.app");
  const hubStatus = runtimeClient.entities.get("botster-web.hub_status", "local-hub");
  const packageNavigation = runtimeClient.entities.list("botster-web.package_navigation");
  const packages = runtimeClient.entities.list("botster-web.package");
  const installedPackageNames = useMemo(
    () => new Set(packages.map((appPackage) => stringValue(appPackage.package_name, String(appPackage.id)))),
    [packages]
  );
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
  const routePluginRequestedSurfaceRecord = routePluginPackage && routePluginSurface
    ? packageAppSurfaces(routePluginPackage).find((surface) => firstString(surface.surface_id, surface.id) === routePluginSurface.surfaceId)
    : undefined;
  const routePluginCanonicalSurfaceRecord = routePluginPackage && routePluginSurface && !routePluginRequestedSurfaceRecord
    ? packageAppSurfaces(routePluginPackage).length === 1
      ? packageAppSurfaces(routePluginPackage)[0]
      : undefined
    : undefined;
  const routePluginSurfaceRecord = routePluginRequestedSurfaceRecord ?? routePluginCanonicalSurfaceRecord;
  const routePluginEffectiveSurfaceId = routePluginSurfaceRecord
    ? firstString(routePluginSurfaceRecord.surface_id, routePluginSurfaceRecord.id)
    : routePluginSurface?.surfaceId;
  const routePluginSurfaceKey = routePluginSurface && routePluginEffectiveSurfaceId
    ? `${routePluginSurface.packageName}/${routePluginEffectiveSurfaceId}`
    : undefined;
  const routePluginLaunchAction = surfaceLaunchAction(routePluginSurfaceRecord);
  const routePluginSurfaceDiagnostic = routePluginSurface
    ? entityLoadStatus.package !== "loaded"
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
            : undefined
    : undefined;

  useEffect(() => {
    if (!routePluginSurfaceKey) {
      lastPluginRouteRenderKey.current = undefined;
    }
  }, [routePluginSurfaceKey]);
  const availablePackages = runtimeClient.entities.list("botster-web.available_package");
  const spawnTargets = [...runtimeClient.entities.list("botster-web.spawn_target")].sort(compareSpawnTargetRows);
  const sessionTypes = runtimeClient.entities.list("session_type");
  const sessionTypeSourceGroups = groupSessionTypesBySource(sessionTypes);
  const sessionTypeSubscriptionsSupported = sessionTypeManagementSupported(hubStatus);
  const sessionTypeWritableSources = writableSessionTypeSources(spawnTargets);
  const spawnSessionTypes = spawnSessionForm
    ? sessionTypesForSpawnTarget(sessionTypes, spawnSessionForm.targetId)
    : [];
  const openSpawnSession = useCallback((target: Record<string, unknown>) => {
    setSpawnSessionForm(spawnSessionFormForTarget(
      target,
      runtimeClient.entities.list("session_type")
    ));
  }, [runtimeClient]);
  const submitSpawnSession = useCallback(() => {
    if (!spawnSessionForm || !spawnSessionForm.sessionTypeId || spawnSessionForm.submitting) return;
    const sessionId = crypto.randomUUID();
    const action = spawnSessionAction(spawnSessionForm, sessionId);

    setSpawnSessionForm((current) => current ? { ...current, submitting: true, error: undefined } : current);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setSpawnSessionForm((current) => current ? rejectedSpawnSessionForm(current, result.reason) : current);
        return;
      }

      const resultPayload = readRecord(result.result);
      const spawnedSessionId = stringValue(resultPayload.session_id, sessionId);
      setSpawnSessionForm(undefined);
      setPackageActionToast({ message: `Session started at ${spawnSessionForm.targetLabel}`, color: "success" });
      updateLocalState({ "production.diagnostic_action_status": `Started session ${visibleStatusText(spawnedSessionId)}` });
      navigateToView("dashboard");
    }).catch((error: unknown) => {
      setSpawnSessionForm((current) => current ? rejectedSpawnSessionForm(
        current,
        error instanceof Error ? error.message : undefined
      ) : current);
    });
  }, [navigateToView, recordDiagnostic, runtimeClient, spawnSessionForm, updateLocalState]);
  const openCreateSessionType = useCallback(() => {
    setSessionTypeForm(emptySessionTypeForm);
  }, []);
  const submitSessionTypeForm = useCallback(() => {
    if (!sessionTypeForm || !sessionTypeFormIsStructurallyComplete(sessionTypeForm)) return;
    if (sessionTypeForm.submitting) return;

    const action: ActionBinding = {
      id: "botster.session_type.daemon_request",
      target: sessionTypeForm.sessionTypeId,
      label: "Create session type",
      params: {
        daemon_request: {
          request_type: "create_session_type",
          source: sessionTypeMutationSource(sessionTypeForm),
          definition: sessionTypeDefinitionFromForm(sessionTypeForm)
        }
      }
    };

    // The form owns the verdict: it stays open and keeps the draft until Hub accepts, so a
    // rejection renders Hub's kind and message here rather than discarding the user's work.
    setSessionTypeForm((current) => current ? { ...current, submitting: true, error: undefined } : current);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setSessionTypeForm((current) => current ? rejectedSessionTypeForm(current, result) : current);
        return;
      }

      setSessionTypeForm(undefined);
      setPackageActionToast(sessionTypeActionFeedback(result) ?? { message: "Session type saved", color: "success" });
    }).catch((error: unknown) => {
      setSessionTypeForm((current) => current ? {
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : "Botster could not save this session type."
      } : current);
    });
  }, [recordDiagnostic, runtimeClient, sessionTypeForm]);
  const confirmDeleteSessionType = useCallback(() => {
    if (!deleteSessionType) return;
    // Hub deletes by the bare authoring id within the row's source, not the composite id.
    const definitionId = stringValue(deleteSessionType.definition_id, "");
    if (!definitionId) return;

    dispatchAction({
      id: "botster.session_type.daemon_request",
      target: stringValue(deleteSessionType.session_type_id, String(deleteSessionType.id)),
      label: "Delete session type",
      params: {
        daemon_request: {
          request_type: "delete_session_type",
          source: sessionTypeMutationSourceFromRecord(deleteSessionType),
          session_type_id: definitionId
        }
      }
    });
    setDeleteSessionType(undefined);
  }, [deleteSessionType, dispatchAction]);
  const installedPackageRows = useMemo(() => [...packages].sort(compareInstalledPackageRows), [packages]);
  const installedAppPackageRows = useMemo(
    () => installedPackageRows.filter((app) => packageAppSurfaces(app).length > 0),
    [installedPackageRows]
  );
  const installedPluginPackageRows = useMemo(
    () => installedPackageRows.filter((app) => packageAppSurfaces(app).length === 0),
    [installedPackageRows]
  );
  const installedAppRows = useMemo(
    () =>
      installedApps
        .filter((app) => !installedPackageNames.has(stringValue(app.package_name, "")))
        .sort(compareInstalledAppRows),
    [installedApps, installedPackageNames]
  );
  const installedRowCount = installedPackageRows.length + installedAppRows.length;
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
      surfaceId: routePluginEffectiveSurfaceId ?? routePluginSurface.surfaceId
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
        "production.plugin_surface_status": renderedSurface.status ? visibleStatusText(renderedSurface.status) : undefined
      });
      recordDiagnostic(actionFailureDiagnostic(routePluginLaunchAction, result));
    });
  }, [
    recordDiagnostic,
    routePluginLaunchAction,
    routePluginEffectiveSurfaceId,
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
        "production.plugin_surface_status": renderedSurface.status ? visibleStatusText(renderedSurface.status) : undefined
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
  const packageNavigationShortcuts = packageNavigation;
  const sessions = runtimeClient.entities.list("session");
  const openSession = useCallback((sessionId: string) => {
    navigateToRoute({ view: "session", sessionId });
  }, [navigateToRoute]);
  const releaseTerminalSession = useCallback((
    sessionId: string,
    status?: TerminalAttachmentStatus
  ) => {
    if (activeRoute.view !== "session" || activeRoute.sessionId !== sessionId) return;

    setPackageActionToast(terminalReleaseToast(sessionId, status));
    navigateToView("dashboard");
  }, [activeRoute, navigateToView]);
  const recordTerminalAttachmentStatus = useCallback((
    sessionId: string,
    status: TerminalAttachmentStatus
  ) => {
    if (status.state === "failed") {
      releaseTerminalSession(sessionId, status);
    }
  }, [releaseTerminalSession]);
  const routeSessionId = activeRoute.view === "session" ? activeRoute.sessionId : undefined;
  const terminalDescriptor: TerminalViewDescriptor | undefined = useMemo(
    () => terminalDescriptorForSessionId(routeSessionId),
    [routeSessionId]
  );
  const terminalDataPlane: TerminalDataPlaneAttachment | undefined = useMemo(
    () => (terminalDescriptor ? hubRuntime.createTerminalDataPlane(terminalDescriptor.sessionId) : undefined),
    [hubRuntime, terminalDescriptor]
  );
  const actionStatus =
    typeof localState["production.action_status"] === "string"
      ? localState["production.action_status"]
      : hubRuntime.statusText;
  const diagnosticActionStatus =
    typeof localState["production.diagnostic_action_status"] === "string"
      ? localState["production.diagnostic_action_status"]
      : "No diagnostic action has been dispatched.";
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "danger");
  const pluginAppRouteActive = activeView === "apps" && Boolean(routePluginSurface);
  const terminalSessionRouteActive = activeRoute.view === "session";
  const toolbarTitle = activeView === "dashboard"
    ? "Home"
    : activeView === "hub-settings"
      ? "Hub settings"
      : activeView === "session"
        ? "Session"
        : routeSettingsPackageName
          ? "App settings"
          : routePluginSurface
            ? undefined
            : "Apps";
  const terminalPanel = terminalDescriptor && terminalDataPlane ? (
    <TerminalViewHost
      dataPlane={terminalDataPlane}
      descriptor={terminalDescriptor}
      onAttachmentStatus={recordTerminalAttachmentStatus}
      onDiagnostic={recordTerminalDiagnostic}
      onExit={releaseTerminalSession}
    />
  ) : null;

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
            <WorkbenchNav activeView={activeView} onNavigate={navigateToView}>
              <PluginNavigationShortcuts
                entries={packageNavigationShortcuts}
                onOpen={openPackageNavigation}
              />
            </WorkbenchNav>
          </IonContent>
          <IonFooter className="app-sidebar-footer">
            <IonList lines="none" className="nav-list sidebar-advanced">
              <IonMenuToggle autoHide={false}>
                <button
                  type="button"
                  className={activeView === "hub-settings" ? "nav-item active" : "nav-item"}
                  aria-current={activeView === "hub-settings" ? "page" : undefined}
                  onClick={() => navigateToHubSettings("general")}
                >
                  <IonIcon icon={cogOutline} aria-hidden="true" />
                  <span>Hub settings</span>
                </button>
              </IonMenuToggle>
            </IonList>
          </IonFooter>
        </IonMenu>

        <IonPage id="main-content">
          <IonHeader className={terminalSessionRouteActive ? "app-header terminal-session-header" : "app-header"}>
            <IonToolbar>
              <IonButtons slot="start">
                <IonMenuButton aria-label="Open navigation" />
                {pluginAppRouteActive ? (
                  <IonButton aria-label="Back to Apps" fill="clear" onClick={() => navigateToView("apps")}>
                    <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
                  </IonButton>
                ) : null}
              </IonButtons>
              {toolbarTitle ? <IonTitle className="app-toolbar-title">{toolbarTitle}</IonTitle> : null}
            </IonToolbar>
          </IonHeader>

          <IonContent fullscreen className={terminalSessionRouteActive ? "terminal-session-content" : pluginAppRouteActive ? "plugin-app-content" : undefined}>
            <main className={terminalSessionRouteActive ? "terminal-session-shell" : pluginAppRouteActive ? "workspace-shell plugin-workspace-shell" : "workspace-shell"}>
              {terminalSessionRouteActive ? (
                <SessionRouteView sessionId={activeRoute.sessionId}>
                  {terminalPanel}
                </SessionRouteView>
              ) : null}
              {activeView === "dashboard" ? (
                <DashboardView
                  sessions={sessions}
                  sessionLoadStatus={entityLoadStatus.session}
                  onOpenSession={openSession}
                  onNavigateToApps={() => navigateToView("apps")}
                  onNavigateToSpawnPoints={() => navigateToHubSettings("spawn-points")}
                />
              ) : null}

                {activeView === "apps" ? (
                  routePluginSurface ? (
                  <PluginSurfaceRoutePage
                    diagnostic={routePluginSurfaceDiagnostic}
                    packageName={routePluginSurface.packageName}
                    selectedSurface={selectedPluginSurface?.routeKey === routePluginSurfaceKey ? selectedPluginSurface : undefined}
                    surfaceId={routePluginSurface.surfaceId}
                    localState={localState}
                    entities={runtimeClient.entities}
                    presentationState={uiPresentationState}
                    onAction={(dispatch) => dispatchPluginSurfaceAction(
                      selectedPluginSurface?.packageName ?? routePluginSurface.packageName,
                      selectedPluginSurface?.surfaceId ?? routePluginSurface.surfaceId,
                      dispatch
                    )}
                  />
                ) : routeSettingsPackageName ? (
                  <PluginSettingsRoutePage
                    diagnostic={settingsPackageDiagnostic}
                    packageName={routeSettingsPackageName}
                    packageRecord={settingsPackage}
                    onAction={dispatchAction}
                    onSurfaceAction={(dispatch) => {
                      if (selectedPluginSurface?.packageName && selectedPluginSurface.surfaceId) {
                        dispatchPluginSurfaceAction(selectedPluginSurface.packageName, selectedPluginSurface.surfaceId, dispatch);
                      }
                    }}
                    onBack={() => navigateToRoute(packageSettingsReturnRoute.current)}
                    onOpenSurface={openPackageSettingsSurface}
                    selectedSurface={routeSettingsSurfaceKey && selectedPluginSurface?.routeKey === routeSettingsSurfaceKey ? selectedPluginSurface : undefined}
                    surfaceDiagnostic={routeSettingsSurfaceDiagnostic}
                    entities={runtimeClient.entities}
                    presentationState={uiPresentationState}
                  />
                ) : (
                  <AppsView
                    installedRowCount={installedRowCount}
                    onAddPackage={() => setAddPackageOpen(true)}
                  >
                    <IonListHeader>
                      <IonLabel>Installed</IonLabel>
                    </IonListHeader>
                    {installedAppPackageRows.map((app) => (
                      <PluginListItem
                        app={app}
                        key={app.id}
                        onOpen={openPackage}
                        onSettings={openPackageSettings}
                      />
                    ))}
                    {installedAppRows.map((app) => (
                      <AppListItem
                        app={app}
                        key={app.id}
                        surface={packageAppSurfaces(appSurfacePackages.get(stringValue(app.package_name, "")) ?? {})[0]}
                        onOpen={openApp}
                      />
                    ))}
                    {installedPluginPackageRows.map((app) => (
                      <PluginListItem
                        app={app}
                        key={app.id}
                        onOpen={openPackage}
                        onSettings={openPackageSettings}
                      />
                    ))}
                  </AppsView>
                  )
                ) : null}

                {activeView === "hub-settings" ? (
                  <section className="view-stack" aria-labelledby="hub-settings-heading" data-testid="hub-settings-view">
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">Local hub</p>
                        <h1 id="hub-settings-heading">Hub settings</h1>
                        <p className="page-description">Manage where sessions run, how they start, and the extensions connected to this hub.</p>
                      </div>
                    </div>
                    <HubSettingsSectionsNav
                      activeSection={activeHubSettingsSection}
                      onNavigate={navigateToHubSettings}
                    />
                  </section>
                ) : null}

                {activeView === "hub-settings" && activeHubSettingsSection === "general" ? (
                  <HubGeneralSection
                    hubStatus={hubStatus}
                    hubUpdate={hubUpdate}
                    onCheckForUpdates={() => dispatchAction(hubUpdateCheckAction())}
                  />
                ) : null}

                {activeView === "hub-settings" && activeHubSettingsSection === "session-types" ? (
                  <SessionTypesView sessionTypeCount={sessionTypes.length}>
                    <SessionTypesSurfaceNotices
                      supported={sessionTypeSubscriptionsSupported}
                      subscriptionError={sessionTypeSubscriptionError}
                      onCreate={openCreateSessionType}
                    />
                    {entityLoadStatus.sessionType === "error" ? (
                      <IonNote color="danger">Session types could not be loaded from Botster.</IonNote>
                    ) : sessionTypes.length > 0 ? (
                      <>
                        {sessionTypeSubscriptionError ? (
                          <p className="entity-empty" data-testid="session-types-stale">
                            Showing the last session types Botster sent.
                          </p>
                        ) : null}
                        {sessionTypeSourceGroups.map((group) => (
                          <div key={group.source} data-testid={`session-type-group-${group.source}`}>
                            <h3>{group.source}</h3>
                            <IonList lines="full" aria-label={`${group.source} session types`}>
                              {group.rows.map((sessionType) => (
                                <SessionTypeListItem
                                  key={String(sessionType.id)}
                                  sessionType={sessionType}
                                  onDelete={setDeleteSessionType}
                                />
                              ))}
                            </IonList>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="entity-empty">No session types are available yet.</p>
                    )}
                  </SessionTypesView>
                ) : null}

                {activeView === "hub-settings" && activeHubSettingsSection === "extensions" ? (
                  <section className="view-stack hub-settings-panel" aria-labelledby="extension-settings-heading" data-testid="extension-settings-view">
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">Installed</p>
                        <h2 id="extension-settings-heading">Extension configuration</h2>
                        <p className="page-description">Open settings supplied by apps and extensions installed on this hub.</p>
                      </div>
                    </div>
                    {installedPackageRows.length > 0 ? (
                      <IonList lines="full" aria-label="Installed extensions">
                        {installedPackageRows.map((appPackage) => {
                          const packageType = packageAppSurfaces(appPackage).length > 0
                            ? "App"
                            : stringValue(appPackage.classification, "") === "provider"
                              ? "Provider"
                              : "Extension";
                          return (
                          <IonItem button detail key={String(appPackage.id)} onClick={() => openPackageSettings(appPackage)}>
                            <IonLabel>
                              <h2>{appDisplayName(appPackage.title, String(appPackage.id))}</h2>
                              <p>{packageType} · Version {stringValue(appPackage.version, "unknown")} · {stringValue(appPackage.status, "unknown")}</p>
                            </IonLabel>
                            <IonNote slot="end">Manage</IonNote>
                          </IonItem>
                          );
                        })}
                      </IonList>
                    ) : (
                      <p className="entity-empty">No apps or extensions are installed.</p>
                    )}
                  </section>
                ) : null}

                {activeView === "hub-settings" && activeHubSettingsSection === "spawn-points" ? (
                  <section className="view-stack hub-settings-panel" aria-labelledby="spawn-points-heading" data-testid="spawn-points-view">
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">Local setup</p>
                        <h2 id="spawn-points-heading">Spawn points</h2>
                        <p className="page-description">Directories and Git repositories where Botster can start sessions.</p>
                      </div>
                      <IonButton onClick={openCreateSpawnTarget}>
                        <IonIcon icon={addOutline} slot="start" aria-hidden="true" />
                        Add spawn point
                      </IonButton>
                    </div>
                    {entityLoadStatus.spawnTarget === "error" ? (
                      <IonNote color="danger">Spawn points could not be loaded from Botster.</IonNote>
                    ) : null}
                    {spawnTargets.length > 0 ? (
                      <IonList lines="full" aria-label="Spawn points">
                        {spawnTargets.map((target) => (
                          <SpawnTargetListItem
                            key={String(target.id)}
                            target={target}
                            onSpawn={openSpawnSession}
                            onEdit={openEditSpawnTarget}
                            onDelete={setDeleteSpawnTarget}
                          />
                        ))}
                      </IonList>
                    ) : (
                      <article className="workflow-section">
                          <div className="section-heading">
                            <div>
                              <p className="eyebrow">Spawn points</p>
                              <h2>No spawn points yet</h2>
                            </div>
                          </div>
                          <p className="entity-empty">Add a directory or Git repository where Botster can start local sessions.</p>
                      </article>
                    )}
                  </section>
                ) : null}

                {activeView === "hub-settings" && activeHubSettingsSection === "support" ? (
                <DiagnosticsView
                  diagnosticCount={diagnostics.length}
                  blocking={blockingDiagnostics.length > 0}
                  developerDetails={(
                    <IonGrid className="workspace-grid" aria-label="Developer diagnostic details">
                      <IonRow>
                        <IonCol size="12">
                          <div className="local-hub-main">
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
                                onAction={({ action }) => dispatchAction({
                                  id: action.id,
                                  payload: action.payload,
                                  disabled: action.disabled
                                })}
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
                              </dl>
                            </section>
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  )}
                >
                  <LocalHubFirstScreen
                    mode={hubRuntime.mode}
                    statusText={hubRuntime.statusText}
                    diagnostics={diagnostics}
                    packages={packages}
                    packageLoadStatus={entityLoadStatus.package}
                    sessions={sessions}
                    sessionLoadStatus={entityLoadStatus.session}
                    actionStatus={actionStatus}
                  />
                </DiagnosticsView>
              ) : null}
            </main>
            <IonModal isOpen={addPackageOpen} onDidDismiss={() => setAddPackageOpen(false)}>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>Add package</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setAddPackageOpen(false)}>Close</IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                <div className="add-package-flow">
                  {availablePackages.length > 0 ? (
                    <IonList lines="full" aria-label="Marketplace packages">
                      <IonListHeader>
                        <IonLabel>Marketplace</IonLabel>
                      </IonListHeader>
                      {availablePackages.map((app) => (
                        <PluginListItem
                          app={app}
                          key={app.id}
                          onOpen={openPackage}
                          onSettings={openPackageSettings}
                        />
                      ))}
                    </IonList>
                  ) : (
                    <div className="marketplace-empty">
                      <IonIcon icon={cubeOutline} aria-hidden="true" />
                      <h2>No marketplace connected</h2>
                      <p>Marketplace extensions will appear here when a source is configured.</p>
                    </div>
                  )}
                  <details className="advanced-install-options">
                    <summary>Install from local files</summary>
                    <p>Developer option for installing an extension from this device.</p>
                    <IonList lines="full" aria-label="Local installation options">
                      <IonItem>
                        <IonInput
                          label="Marketplace registry file"
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
                          label="Extension folder"
                          labelPlacement="stacked"
                          value={localPackagePath}
                          placeholder="/path/to/extension"
                          onIonInput={(event) => setLocalPackagePath(String(event.detail.value ?? ""))}
                        />
                        <IonButton slot="end" disabled={!localPackagePath.trim()} onClick={installLocalPackage}>
                          Install
                        </IonButton>
                      </IonItem>
                    </IonList>
                  </details>
                </div>
              </IonContent>
            </IonModal>
            <IonModal isOpen={Boolean(spawnSessionForm)} onDidDismiss={() => setSpawnSessionForm(undefined)}>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>New session</IonTitle>
                  <IonButtons slot="end">
                    <IonButton disabled={spawnSessionForm?.submitting} onClick={() => setSpawnSessionForm(undefined)}>
                      Close
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                {spawnSessionForm ? (
                  <div className="spawn-session-form">
                    <div className="spawn-session-intro">
                      <p className="eyebrow">Spawn point</p>
                      <h2>{spawnSessionForm.targetLabel}</h2>
                      <p>Choose how this session should start. Botster will use the spawn point's folder and policy.</p>
                    </div>
                    {entityLoadStatus.sessionType === "error" ? (
                      <IonNote color="danger">Session types could not be loaded from Botster.</IonNote>
                    ) : spawnSessionTypes.length === 0 ? (
                      <IonNote color="medium">
                        {entityLoadStatus.sessionType === "loaded"
                          ? "No session types are available for this spawn point."
                          : "Loading session types…"}
                      </IonNote>
                    ) : (
                      <IonList lines="full" aria-label="New session form">
                        <IonItem>
                          <IonSelect
                            label="Session type"
                            labelPlacement="stacked"
                            value={spawnSessionForm.sessionTypeId}
                            placeholder="Choose a session type"
                            disabled={spawnSessionForm.submitting}
                            onIonChange={(event) => setSpawnSessionForm((current) => current ? {
                              ...current,
                              sessionTypeId: String(event.detail.value ?? ""),
                              error: undefined
                            } : current)}
                          >
                            {spawnSessionTypes.map((sessionType) => (
                              <IonSelectOption
                                key={String(sessionType.id)}
                                value={String(sessionType.id)}
                                disabled={sessionType.available === false}
                              >
                                {stringValue(sessionType.label, "")}
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
                        <IonItem>
                          <IonTextarea
                            label="Prompt (optional)"
                            labelPlacement="stacked"
                            value={spawnSessionForm.prompt}
                            autoGrow
                            rows={4}
                            placeholder="What should this session work on?"
                            disabled={spawnSessionForm.submitting}
                            onIonInput={(event) => setSpawnSessionForm((current) => current ? {
                              ...current,
                              prompt: String(event.detail.value ?? ""),
                              error: undefined
                            } : current)}
                          />
                        </IonItem>
                      </IonList>
                    )}
                    {spawnSessionForm.error ? <IonNote color="danger">{spawnSessionForm.error}</IonNote> : null}
                    <div className="modal-actions">
                      <IonButton
                        disabled={!spawnSessionForm.sessionTypeId || spawnSessionForm.submitting}
                        onClick={submitSpawnSession}
                      >
                        <IonIcon icon={playOutline} slot="start" aria-hidden="true" />
                        {spawnSessionForm.submitting ? "Starting…" : "Start session"}
                      </IonButton>
                    </div>
                  </div>
                ) : null}
              </IonContent>
            </IonModal>
            <IonModal isOpen={Boolean(sessionTypeForm)} onDidDismiss={() => setSessionTypeForm(undefined)}>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>Add session type</IonTitle>
                  <IonButtons slot="end">
                    <IonButton disabled={sessionTypeForm?.submitting} onClick={() => setSessionTypeForm(undefined)}>
                      Close
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                {sessionTypeForm ? (
                  <div className="session-type-form">
                    <IonList lines="full" aria-label="Session type form">
                      <IonItem>
                        <IonSelect
                          label="Where it lives"
                          labelPlacement="stacked"
                          value={sessionTypeForm.source === "repo" ? `repo:${sessionTypeForm.sourceTargetId}` : sessionTypeForm.source}
                          data-testid="session-type-source"
                          onIonChange={(event) => {
                            const selected = String(event.detail.value ?? "device");
                            setSessionTypeForm((current) => current ? {
                              ...current,
                              source: selected.startsWith("repo:") ? "repo" : selected,
                              sourceTargetId: selected.startsWith("repo:") ? selected.slice("repo:".length) : ""
                            } : current);
                          }}
                        >
                          {sessionTypeWritableSources.map((source) => (
                            <IonSelectOption
                              key={`${source.source}:${source.targetId}`}
                              value={source.source === "repo" ? `repo:${source.targetId}` : source.source}
                            >
                              {source.label}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Identifier"
                          labelPlacement="stacked"
                          value={sessionTypeForm.id}
                          placeholder="my-agent"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, id: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Name"
                          labelPlacement="stacked"
                          value={sessionTypeForm.label}
                          placeholder="My agent"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, label: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Description"
                          labelPlacement="stacked"
                          value={sessionTypeForm.description}
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, description: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Role"
                          labelPlacement="stacked"
                          value={sessionTypeForm.role}
                          placeholder="botster.agent"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, role: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Interaction"
                          labelPlacement="stacked"
                          value={sessionTypeForm.interaction}
                          placeholder="interactive"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, interaction: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Lifecycle"
                          labelPlacement="stacked"
                          value={sessionTypeForm.lifecycle}
                          placeholder="task"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, lifecycle: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Traits"
                          labelPlacement="stacked"
                          value={sessionTypeForm.traits}
                          placeholder="terminal, companion"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, traits: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Command"
                          labelPlacement="stacked"
                          value={sessionTypeForm.command}
                          placeholder="claude"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, command: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                      <IonItem>
                        <IonInput
                          label="Arguments"
                          labelPlacement="stacked"
                          value={sessionTypeForm.args}
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, args: String(event.detail.value ?? "") } : current)}
                        />
                      </IonItem>
                    </IonList>
                    <details className="advanced-session-type-options">
                      <summary>Advanced options</summary>
                      <IonList lines="full" aria-label="Advanced session type options">
                        <IonItem>
                          <IonInput
                            label="Working directory policy"
                            labelPlacement="stacked"
                            value={sessionTypeForm.workingDirectoryPolicy}
                            placeholder="package_root"
                            onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, workingDirectoryPolicy: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonInput
                            label="Working directory path"
                            labelPlacement="stacked"
                            value={sessionTypeForm.workingDirectoryPath}
                            onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, workingDirectoryPath: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonTextarea
                            label="Environment"
                            labelPlacement="stacked"
                            value={sessionTypeForm.environment}
                            autoGrow
                            placeholder={"KEY=value"}
                            onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, environment: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonInput
                            label="Allowed environment overrides"
                            labelPlacement="stacked"
                            value={sessionTypeForm.allowedEnvironmentOverrides}
                            onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, allowedEnvironmentOverrides: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonInput
                            label="Context keys"
                            labelPlacement="stacked"
                            value={sessionTypeForm.contextKeys}
                            onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, contextKeys: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                      </IonList>
                    </details>
                    {sessionTypeForm.error ? (
                      <IonNote color="danger" data-testid="session-type-form-error">{sessionTypeForm.error}</IonNote>
                    ) : null}
                    <div className="modal-actions">
                      <SessionTypeSubmitButton
                        disabled={!sessionTypeFormIsStructurallyComplete(sessionTypeForm) || sessionTypeForm.submitting}
                        submitting={Boolean(sessionTypeForm.submitting)}
                        onClick={submitSessionTypeForm}
                      />
                    </div>
                  </div>
                ) : null}
              </IonContent>
            </IonModal>
            <IonAlert
              isOpen={Boolean(deleteSessionType)}
              header="Delete session type"
              message={`Delete ${stringValue(deleteSessionType?.label, "")}?`}
              onDidDismiss={() => setDeleteSessionType(undefined)}
              buttons={[
                { text: "Cancel", role: "cancel" },
                { text: "Delete", role: "destructive", handler: confirmDeleteSessionType }
              ]}
            />
            <IonModal isOpen={Boolean(spawnTargetForm)} onDidDismiss={() => setSpawnTargetForm(undefined)}>
                <IonHeader>
                  <IonToolbar>
                  <IonTitle>{spawnTargetForm?.mode === "edit" ? "Edit spawn point" : "Add spawn point"}</IonTitle>
                    <IonButtons slot="end">
                      <IonButton onClick={() => setSpawnTargetForm(undefined)}>Close</IonButton>
                    </IonButtons>
                  </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                  {spawnTargetForm ? (
                    <div className="spawn-target-form">
                      <IonList lines="full" aria-label="Spawn point form">
                        <IonItem>
                          <IonInput
                            label="Spawn point name"
                            labelPlacement="stacked"
                            value={spawnTargetForm.label}
                            placeholder="My project"
                            onIonInput={(event) => setSpawnTargetForm((current) => current ? { ...current, label: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonInput
                            label="Folder"
                            labelPlacement="stacked"
                            value={spawnTargetForm.root}
                            placeholder="/path/to/project"
                            onIonInput={(event) => setSpawnTargetForm((current) => current ? { ...current, root: String(event.detail.value ?? "") } : current)}
                          />
                        </IonItem>
                        <IonItem>
                          <IonCheckbox
                            checked={spawnTargetForm.enabled}
                            onIonChange={(event) => setSpawnTargetForm((current) => current ? { ...current, enabled: event.detail.checked } : current)}
                          >
                            Enabled
                          </IonCheckbox>
                        </IonItem>
                      </IonList>
                      <details className="advanced-spawn-target-options">
                        <summary>Advanced options</summary>
                        <IonList lines="full" aria-label="Advanced spawn point options">
                          <IonItem>
                            <IonInput
                              label="Identifier"
                              labelPlacement="stacked"
                              value={spawnTargetForm.targetId}
                              disabled={spawnTargetForm.mode === "edit"}
                              placeholder={spawnTargetIdFromLabel(spawnTargetForm.label) || "my-project"}
                              onIonInput={(event) => setSpawnTargetForm((current) => current ? { ...current, targetId: String(event.detail.value ?? "") } : current)}
                            />
                          </IonItem>
                          <IonItem>
                            <IonTextarea
                              label="Metadata"
                              labelPlacement="stacked"
                              value={spawnTargetForm.metadata}
                              autoGrow
                              placeholder={"owner=platform\npurpose=agents"}
                              onIonInput={(event) => setSpawnTargetForm((current) => current ? { ...current, metadata: String(event.detail.value ?? "") } : current)}
                            />
                          </IonItem>
                        </IonList>
                      </details>
                      <div className="modal-actions">
                        <IonButton
                          disabled={!spawnTargetForm.label.trim() || !spawnTargetForm.root.trim() || (spawnTargetForm.mode === "edit" ? !spawnTargetForm.originalTargetId : false)}
                          onClick={submitSpawnTargetForm}
                        >
                          {spawnTargetForm.mode === "edit" ? "Save" : "Create"}
                        </IonButton>
                      </div>
                    </div>
                  ) : null}
                </IonContent>
              </IonModal>
            </IonContent>
          </IonPage>
        </IonSplitPane>
        <IonAlert
          isOpen={Boolean(deleteSpawnTarget)}
          header="Delete spawn point"
          message={deleteSpawnTarget ? `Delete ${stringValue(deleteSpawnTarget.label, String(deleteSpawnTarget.id))}?` : undefined}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => setDeleteSpawnTarget(undefined)
            },
            {
              text: "Delete",
              role: "destructive",
              handler: confirmDeleteSpawnTarget
            }
          ]}
          onDidDismiss={() => setDeleteSpawnTarget(undefined)}
        />
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
  presentationState?: UiPresentationState;
  onAction: (dispatch: UiNodeActionDispatch) => void;
}

export function PluginSurfaceRoutePage({
  packageName,
  surfaceId,
  diagnostic,
  selectedSurface,
  localState,
  entities,
  presentationState = {},
  onAction
}: PluginSurfaceRoutePageProps) {
  const badgeLabel = diagnostic ? "Diagnostic" : selectedSurface?.phase === "rendered" ? "Rendered" : selectedSurface?.phase === "error" ? "Error" : "Loading";
  const badgeColor = diagnostic ? "warning" : selectedSurface?.phase === "rendered" ? "success" : selectedSurface?.phase === "error" ? "danger" : "medium";

  if (selectedSurface?.snapshot && !diagnostic) {
    return (
      <section className="plugin-surface-page" aria-label="Rendered app surface" data-testid="selected-app-surface">
        <UiNodeSurface
          snapshot={selectedSurface.snapshot}
          entities={entities}
          showTechnicalHeader={false}
          capabilities={{
            ...defaultUiCapabilitySet,
            isolated_plugin_asset: false
          }}
          actionResult={selectedSurface.actionResult}
          localState={localState}
          onAction={onAction}
          presentation={presentationValues(presentationState, {
            hubId: "local",
            packageName: selectedSurface.packageName ?? packageName,
            surfaceId: selectedSurface.surfaceId ?? surfaceId
          })}
        />
      </section>
    );
  }

  return (
    <section className="view-stack" aria-label="Rendered app surface" data-testid="selected-app-surface">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Plugin surface</p>
          <h1>{selectedSurface?.title ?? `${packageName}/${surfaceId}`}</h1>
        </div>
        <IonBadge color={badgeColor} data-testid="plugin-route-status-badge">
          {badgeLabel}
        </IonBadge>
      </div>
      <IonList lines="full" aria-label="Plugin surface status">
        <IonItem>
          <IonLabel>
            <h2>{diagnostic ? "Unable to render plugin surface" : "Rendering plugin surface"}</h2>
            <p data-testid={diagnostic ? "plugin-route-diagnostic" : undefined}>
              {diagnostic ?? selectedSurface?.status ?? "Rendering plugin surface from the hub."}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>
    </section>
  );
}

interface PluginSettingsRoutePageProps {
  packageName: string;
  packageRecord?: Record<string, unknown>;
  diagnostic?: string;
  onAction: (action: ActionBinding) => void;
  onSurfaceAction?: (dispatch: UiNodeActionDispatch) => void;
  onBack: () => void;
  onOpenSurface: (packageName: string, surface: PackageSurfaceRecord) => void;
  selectedSurface?: SelectedPluginSurface;
  surfaceDiagnostic?: string;
  entities: EntityFrameStore;
  presentationState?: UiPresentationState;
}

export function PluginSettingsRoutePage({
  packageName,
  packageRecord,
  diagnostic,
  onAction,
  onSurfaceAction,
  onBack,
  onOpenSurface,
  selectedSurface,
  surfaceDiagnostic,
  entities,
  presentationState = {}
}: PluginSettingsRoutePageProps) {
  return (
    <article className="workflow-section" aria-label="Extension settings" data-testid="plugin-settings-route">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Extension settings</p>
          <h2>{packageRecord ? appDisplayName(packageRecord.title, String(packageRecord.id)) : packageName}</h2>
        </div>
        <IonButton fill="clear" onClick={onBack}>Back</IonButton>
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
              showTechnicalHeader={false}
              capabilities={{
                ...defaultUiCapabilitySet,
                isolated_plugin_asset: false
              }}
              actionResult={selectedSurface.actionResult}
              onAction={onSurfaceAction}
              presentation={presentationValues(presentationState, {
                hubId: "local",
                packageName: selectedSurface.packageName ?? packageName,
                surfaceId: selectedSurface.surfaceId ?? "settings"
              })}
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

interface EntityFamilyPanelProps {
  title: string;
  records: Record<string, unknown>[];
  emptyText: string;
  primaryField: string;
  secondaryField: string;
}

export const entityFamilyRecordLimit = 4;

function EntityFamilyPanel({ title, records, emptyText, primaryField, secondaryField }: EntityFamilyPanelProps) {
  return (
    <IonCard className="entity-family-panel">
      <div className="entity-family-heading">
        <h3>{title}</h3>
        <IonBadge color="medium">{records.length}</IonBadge>
      </div>
      {records.length > 0 ? (
        <div className="entity-record-list">
          {records.slice(0, entityFamilyRecordLimit).map((record) => (
            <div className="entity-record-row" key={String(record.id)}>
              <strong>{stringValue(record[primaryField], String(record.id))}</strong>
              <span>{stringValue(record[secondaryField], "unknown")}</span>
            </div>
          ))}
          {records.length > entityFamilyRecordLimit ? (
            <p className="entity-overflow">
              {records.length - entityFamilyRecordLimit} more records loaded.
            </p>
          ) : null}
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
  const packageKind = hasUi ? "App" : "Extension";

  return (
    <IonItem
      button={hasUi}
      detail={hasUi}
      onClick={hasUi ? () => onOpen(app) : undefined}
    >
      <IonIcon slot="start" icon={cubeOutline} color="primary" aria-hidden="true" />
      <IonLabel>
        <h2 title={stringValue(app.title, String(app.id))}>{appDisplayName(app.title, String(app.id))}</h2>
        <p>Version {stringValue(app.version, "unknown")} · {capabilityCountLabel(app.capability_summary)}</p>
      </IonLabel>
      <IonBadge slot="end" color={hasUi ? "primary" : "medium"}>
        {packageKind}
      </IonBadge>
      {hasManagement ? (
        <IonButton
          slot="end"
          fill="clear"
          aria-label={`Settings for ${appDisplayName(app.title, String(app.id))}`}
          onClick={(event) => {
            event.stopPropagation();
            onSettings(app);
          }}
        >
          <IonIcon icon={cogOutline} slot="icon-only" aria-hidden="true" />
        </IonButton>
      ) : null}
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
      ) : null}
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

export function RemoteAccessConfigurationItem({
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

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Numeric hub facts such as protocol version, conformance revision, and state schema
 * arrive as JSON numbers. Rendering them through stringValue() reports every one of
 * them as the fallback, which is the "regressed to unknown" failure the hub never made.
 */
function reportedNumber(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function appDisplayName(title: unknown, fallback: string): string {
  return stringValue(title, fallback).replace(/[-_]+/g, " ");
}

function installedRowName(app: Record<string, unknown>): string {
  return appDisplayName(app.title, stringValue(app.package_name, String(app.id))).toLocaleLowerCase();
}

// Exported for focused regression coverage of the installed launcher ordering.
// eslint-disable-next-line react-refresh/only-export-components
export function compareInstalledPackageRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftIsApp = packageAppSurfaces(left).length > 0;
  const rightIsApp = packageAppSurfaces(right).length > 0;
  if (leftIsApp !== rightIsApp) {
    return leftIsApp ? -1 : 1;
  }

  return installedRowName(left).localeCompare(installedRowName(right));
}

function compareInstalledAppRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return installedRowName(left).localeCompare(installedRowName(right));
}

function capabilityCountLabel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value === "No requested capabilities") {
    return "No special access";
  }

  const count = value.split(",").filter((part) => part.trim().length > 0).length;
  return `${count} permission${count === 1 ? "" : "s"}`;
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

function visibleStatusText(value: string): string {
  return value;
}
