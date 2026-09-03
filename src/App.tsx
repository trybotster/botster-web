import { setupIonicReact } from "@ionic/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createBotsterWebClient } from "./botster/client";
import {
  initialConnectionDiagnostics,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  type ConnectionDiagnostic
} from "./botster/connectionDiagnostics";
import { createHubRuntimeConfig } from "./botster/hubRuntime";
import {
  webRtcDaemonLifecycleEventName,
  type LocalWebrtcBootstrap,
  type WebrtcDaemonLifecycleEvent
} from "./botster/webrtcDaemonClient";
import type { HubEntityLoadStatus } from "./botster/LocalHubFirstScreen";
import type { TerminalAttachmentStatus, TerminalViewDescriptor } from "./botster/terminal";
import type { UiTreeSnapshot } from "./botster/uiNodes";
import { TerminalViewHost } from "./botster/TerminalViewHost";
import { isMountedSessionRoute } from "./botster/terminalSession";

import { AppsRouteView } from "./app/AppsRouteView";
import { DashboardView } from "./app/dashboard";
import { currentDashboardSessions, endedDashboardSessions } from "./app/dashboardSessions";
import {
  type HubEntityLoadKey,
  replayHubStatusOnLifecycleEvent
} from "./app/hubLifecycle";
import { HubSettingsRouteView } from "./app/HubSettingsRouteView";
import type { SelectedPluginSurface } from "./app/pluginSurfaceState";
import { SessionRouteView } from "./app/sessionRoute";
import { compareSpawnTargetRows } from "./app/spawnTargets";
import { terminalDescriptorForSessionId, terminalReleaseToast } from "./app/terminalChrome";
import { useAppNavigation } from "./app/useAppNavigation";
import { useSessionEntityDetach } from "./app/useSessionEntityDetach";
import { useHubActions } from "./app/useHubActions";
import { usePackageInstall } from "./app/usePackageInstall";
import { usePackageOpenControls } from "./app/usePackageOpenControls";
import { usePluginRouteState } from "./app/usePluginRouteState";
import { usePluginSurfaceDispatch } from "./app/usePluginSurfaceDispatch";
import { usePackageEventNotices } from "./app/usePackageEventNotices";
import { useProductionHubConnection } from "./app/useProductionHubConnection";
import { viewedSessionIdFromRoute } from "./app/packageEventNotices";
import { useSessionTypeControl } from "./app/useSessionTypeControl";
import { useSessionControl } from "./app/useSessionControl";
import { useSpawnControl } from "./app/useSpawnControl";
import { WorkbenchDialogs } from "./app/WorkbenchDialogs";
import { WorkbenchShell } from "./app/WorkbenchShell";

const mobileUserAgentPattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

setupIonicReact({
  mode: "md",
  platform: {
    desktop: (win) => !mobileUserAgentPattern.test(win.navigator.userAgent)
  }
});

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

type BotsterPackageWindow = typeof window & {
  __BOTSTER_PACKAGE_RUNTIME__?: boolean;
  __BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__?: LocalWebrtcBootstrap;
};

function normalizeLocalWebrtcBootstrap(bootstrap: LocalWebrtcBootstrap | undefined): LocalWebrtcBootstrap | undefined {
  if (!bootstrap?.grant_id || !bootstrap.grant_secret || bootstrap.signaling_transport !== "daemon_request") {
    return undefined;
  }

  return {
    ...bootstrap,
    signaling_url: new URL(bootstrap.signaling_url, window.location.origin).toString()
  };
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
    () => createBotsterWebClient({ transport: hubRuntime.transport }),
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
  const [selectedPluginSurface, setSelectedPluginSurface] = useState<SelectedPluginSurface | undefined>();
  const [, setFrameVersion] = useState(0);

  const updateLocalState = useCallback((patch: Record<string, unknown>) => {
    setLocalState((current) => ({ ...current, ...patch }));
  }, []);
  const recordDiagnostic = useCallback((diagnostic: ConnectionDiagnostic | undefined) => {
    setDiagnostics((current) => upsertDiagnostic(current, diagnostic));
  }, []);
  const recordDiagnostics = useCallback((nextDiagnostics: ConnectionDiagnostic[]) => {
    setDiagnostics((current) => nextDiagnostics.reduce(upsertDiagnostic, current));
  }, []);

  const navigation = useAppNavigation();
  const {
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
    navigateToPackageSettings
  } = navigation;

  useEffect(() => {
    const recordWebRtcLifecycle = (event: Event) => {
      const detail = (event as CustomEvent<WebrtcDaemonLifecycleEvent>).detail;
      recordDiagnostic(webRtcLifecycleDiagnostic(detail));
      replayHubStatusOnLifecycleEvent(detail, runtimeClient.entities);
    };
    window.addEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);
    return () => window.removeEventListener(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle);
  }, [recordDiagnostic, runtimeClient]);

  const actions = useHubActions({
    runtimeClient,
    recordDiagnostic,
    updateLocalState,
    setSelectedPluginSurface
  });

  const sessionTypes = useSessionTypeControl({
    runtimeClient,
    dispatchAction: actions.dispatchAction,
    recordDiagnostic,
    setPackageActionToast: actions.setPackageActionToast
  });

  const sessionControl = useSessionControl({
    runtimeClient,
    recordDiagnostic,
    setPackageActionToast: actions.setPackageActionToast,
    updateLocalState
  });

  useProductionHubConnection({
    runtimeClient,
    recordDiagnostic,
    recordDiagnostics,
    updateLocalState,
    setSurfaceSnapshot,
    setFrameVersion,
    setEntityLoadStatus,
    setSessionTypeSubscriptionError: sessionTypes.setSessionTypeSubscriptionError
  });

  const installedApps = runtimeClient.entities.list("botster-web.app");
  const hubStatus = runtimeClient.entities.get("botster-web.hub_status", "local-hub");
  const packageNavigation = runtimeClient.entities.list("botster-web.package_navigation");
  const packages = runtimeClient.entities.list("botster-web.package");
  const availablePackages = runtimeClient.entities.list("botster-web.available_package");
  const spawnTargets = [...runtimeClient.entities.list("botster-web.spawn_target")].sort(compareSpawnTargetRows);
  const sessionTypeRecords = runtimeClient.entities.list("session_type");
  const sessions = currentDashboardSessions(runtimeClient.entities.list("session"));
  const endedSessions = endedDashboardSessions(runtimeClient.entities.list("session"));

  const pluginRoutes = usePluginRouteState({
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
  });

  const pluginDispatch = usePluginSurfaceDispatch({
    runtimeClient,
    recordDiagnostic,
    updateLocalState,
    setPackageActionToast: actions.setPackageActionToast,
    setSelectedPluginSurface
  });

  const packageOpen = usePackageOpenControls({
    packages,
    packageNavigation,
    activeView,
    navigateToPluginSurface,
    navigateToPackageSettings,
    navigateToHubRoutePath,
    navigateToRoute,
    setPackageActionToast: actions.setPackageActionToast
  });

  const spawn = useSpawnControl({
    runtimeClient,
    dispatchAction: actions.dispatchAction,
    recordDiagnostic,
    updateLocalState,
    setPackageActionToast: actions.setPackageActionToast,
    navigateToView: (view) => navigateToView(view),
    navigateToHubSettings: (section) => navigateToHubSettings(section)
  });

  const packageInstall = usePackageInstall({
    runtimeClient,
    dispatchAction: actions.dispatchAction,
    updateLocalState,
    setEntityLoadStatus
  });

  const openSession = useCallback((sessionId: string) => {
    navigateToRoute({ view: "session", sessionId });
  }, [navigateToRoute]);

  const releaseTerminalSession = useCallback((
    sessionId: string,
    status?: TerminalAttachmentStatus
  ) => {
    if (!isMountedSessionRoute(activeRoute, sessionId)) return;
    actions.setPackageActionToast(terminalReleaseToast(sessionId, status));
    navigateToView("dashboard");
  }, [activeRoute, actions, navigateToView]);

  const recordTerminalAttachmentStatus = useCallback((
    sessionId: string,
    status: TerminalAttachmentStatus
  ) => {
    if (status.state === "failed") releaseTerminalSession(sessionId, status);
  }, [releaseTerminalSession]);

  const recordTerminalDiagnostic = useCallback(
    (error: unknown) => recordDiagnostic(terminalUnavailableDiagnostic(error)),
    [recordDiagnostic]
  );

  const routeSessionId = viewedSessionIdFromRoute(activeRoute);
  const packageEventNotices = usePackageEventNotices({
    runtimeClient,
    viewedSessionId: routeSessionId,
    packages,
    recordDiagnostic
  });
  useSessionEntityDetach(
    routeSessionId,
    runtimeClient.entities,
    runtimeClient.hub,
    releaseTerminalSession
  );
  const terminalDescriptor: TerminalViewDescriptor | undefined = useMemo(
    () => terminalDescriptorForSessionId(routeSessionId),
    [routeSessionId]
  );
  const terminalDataPlane = useMemo(
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

  const sessionRoute = terminalSessionRouteActive ? (
    <SessionRouteView sessionId={activeRoute.view === "session" ? activeRoute.sessionId : ""}>
      {terminalPanel}
    </SessionRouteView>
  ) : null;

  const main = (
    <>
      {activeView === "dashboard" ? (
        <DashboardView
          sessions={sessions}
          endedSessions={endedSessions}
          sessionLoadStatus={entityLoadStatus.session}
          stoppingSessionIds={sessionControl.stoppingSessionIds}
          onOpenSession={openSession}
          onStopSession={sessionControl.stopSession}
          onNavigateToApps={() => navigateToView("apps")}
          onNavigateToSpawnPoints={() => navigateToHubSettings("spawn-points")}
        />
      ) : null}
      {activeView === "apps" ? (
        <AppsRouteView
          routePluginSurface={routePluginSurface}
          routeSettingsPackageName={routeSettingsPackageName}
          packages={packages}
          installedApps={installedApps}
          appSurfacePackages={packageOpen.appSurfacePackages}
          selectedPluginSurface={selectedPluginSurface}
          uiPresentationState={pluginDispatch.uiPresentationState}
          routePluginSurfaceKey={pluginRoutes.routePluginSurfaceKey}
          routePluginSurfaceDiagnostic={pluginRoutes.routePluginSurfaceDiagnostic}
          settingsPackage={pluginRoutes.settingsPackage}
          settingsPackageDiagnostic={pluginRoutes.settingsPackageDiagnostic}
          routeSettingsSurfaceKey={pluginRoutes.routeSettingsSurfaceKey}
          routeSettingsSurfaceDiagnostic={pluginRoutes.routeSettingsSurfaceDiagnostic}
          packageSettingsReturnRoute={packageOpen.packageSettingsReturnRoute}
          localState={localState}
          entities={runtimeClient.entities}
          dispatchAction={actions.dispatchAction}
          dispatchPluginSurfaceAction={pluginDispatch.dispatchPluginSurfaceAction}
          dismissPluginSurfacePresentation={pluginDispatch.dismissPluginSurfacePresentation}
          openPackage={packageOpen.openPackage}
          openApp={packageOpen.openApp}
          openPackageSettings={packageOpen.openPackageSettings}
          openPackageSettingsSurface={packageOpen.openPackageSettingsSurface}
          navigateToRoute={navigateToRoute}
          onAddPackage={() => packageInstall.setAddPackageOpen(true)}
        />
      ) : null}
      {activeView === "hub-settings" ? (
        <HubSettingsRouteView
          activeHubSettingsSection={activeHubSettingsSection}
          navigateToHubSettings={navigateToHubSettings}
          packages={packages}
          sessions={sessions}
          spawnTargets={spawnTargets}
          sessionTypes={sessionTypeRecords}
          hubStatus={hubStatus}
          diagnostics={diagnostics}
          blockingDiagnostics={blockingDiagnostics}
          hubUpdate={actions.hubUpdate}
          hubRuntime={hubRuntime}
          runtimeClient={runtimeClient}
          entityLoadStatus={entityLoadStatus}
          surfaceSnapshot={surfaceSnapshot}
          loadingSnapshot={loadingSnapshot}
          localState={localState}
          actionStatus={actionStatus}
          diagnosticActionStatus={diagnosticActionStatus}
          dispatchAction={actions.dispatchAction}
          openPackageSettings={packageOpen.openPackageSettings}
          openCreateSpawnTarget={spawn.openCreateSpawnTarget}
          openEditSpawnTarget={spawn.openEditSpawnTarget}
          setDeleteSpawnTarget={spawn.setDeleteSpawnTarget}
          openSpawnSession={spawn.openSpawnSession}
          openCreateSessionType={sessionTypes.openCreateSessionType}
          openEditSessionType={sessionTypes.openEditSessionType}
          setDeleteSessionType={sessionTypes.setDeleteSessionType}
          sessionTypeSubscriptionError={sessionTypes.sessionTypeSubscriptionError}
        />
      ) : null}
    </>
  );

  const dialogs = (
    <WorkbenchDialogs
      availablePackages={availablePackages}
      spawnTargets={spawnTargets}
      addPackageOpen={packageInstall.addPackageOpen}
      setAddPackageOpen={packageInstall.setAddPackageOpen}
      marketplaceRegistryPath={packageInstall.marketplaceRegistryPath}
      setMarketplaceRegistryPath={packageInstall.setMarketplaceRegistryPath}
      localPackagePath={packageInstall.localPackagePath}
      setLocalPackagePath={packageInstall.setLocalPackagePath}
      loadMarketplaceRegistry={packageInstall.loadMarketplaceRegistry}
      installLocalPackage={packageInstall.installLocalPackage}
      openPackage={packageOpen.openPackage}
      openPackageSettings={packageOpen.openPackageSettings}
      spawnTargetForm={spawn.spawnTargetForm}
      setSpawnTargetForm={spawn.setSpawnTargetForm}
      spawnSessionForm={spawn.spawnSessionForm}
      setSpawnSessionForm={spawn.setSpawnSessionForm}
      deleteSpawnTarget={spawn.deleteSpawnTarget}
      setDeleteSpawnTarget={spawn.setDeleteSpawnTarget}
      submitSpawnTargetForm={spawn.submitSpawnTargetForm}
      confirmDeleteSpawnTarget={spawn.confirmDeleteSpawnTarget}
      submitSpawnSession={spawn.submitSpawnSession}
      manageSessionTypesFromSpawn={spawn.manageSessionTypesFromSpawn}
      sessionTypeForm={sessionTypes.sessionTypeForm}
      setSessionTypeForm={sessionTypes.setSessionTypeForm}
      deleteSessionType={sessionTypes.deleteSessionType}
      setDeleteSessionType={sessionTypes.setDeleteSessionType}
      submitSessionTypeForm={sessionTypes.submitSessionTypeForm}
      confirmDeleteSessionType={sessionTypes.confirmDeleteSessionType}
      packageActionToast={actions.packageActionToast}
      setPackageActionToast={actions.setPackageActionToast}
      packageEventToast={packageEventNotices.toast}
      packageEventDurationMs={packageEventNotices.durationMs}
      onPackageEventDismiss={packageEventNotices.onDismiss}
    />
  );

  return (
    <WorkbenchShell
      navigation={{
        activeView,
        navigateToView,
        navigateToHubSettings,
        packageNavigationShortcuts: packageOpen.packageNavigationShortcuts,
        onOpenPackageNavigation: packageOpen.openPackageNavigation
      }}
      chrome={{
        terminalSessionRouteActive,
        pluginAppRouteActive,
        toolbarTitle,
        sessionRoute
      }}
      main={main}
      dialogs={dialogs}
    />
  );
}
