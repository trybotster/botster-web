import {
  IonApp,
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addOutline,
  arrowBackOutline,
  cogOutline,
  cubeOutline,
  playOutline,
  serverOutline
} from "ionicons/icons";

import { TerminalViewHost } from "./botster/TerminalViewHost";
import { ConnectionDiagnosticsPanel } from "./botster/ConnectionDiagnosticsPanel";
import { LocalHubFirstScreen, type HubEntityLoadStatus } from "./botster/LocalHubFirstScreen";
import { UiNodeSurface } from "./botster/UiNodeSurface";
import { defaultUiCapabilitySet } from "./botster/capabilities";
import { botsterWebClientContract, createBotsterWebClient } from "./botster/client";
import {
  actionFailureDiagnostic,
  initialConnectionDiagnostics,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  type ConnectionDiagnostic
} from "./botster/connectionDiagnostics";
import { createHubRuntimeConfig } from "./botster/hubRuntime";
import { webRtcDaemonLifecycleEventName, type LocalWebrtcBootstrap, type WebrtcDaemonLifecycleEvent } from "./botster/webrtcDaemonClient";
import type { ActionBinding } from "./botster/actions";
import type { EntitySubscriptionErrorPayload } from "./botster/protocol";
import type { TerminalAttachmentStatus, TerminalDataPlaneAttachment, TerminalViewDescriptor } from "./botster/terminal";
import {
  pluginSurfaceActionRequest,
  type UiActionRequest,
  type UiNodeActionDispatch,
  type UiTreeSnapshot
} from "./botster/uiNodes";
import {
  acceptedResultMatches,
  applyAcceptedPresentation,
  clearPresentationValue,
  replaceAcceptedSurface,
  type UiPresentationState
} from "./botster/uiPresentation";

import {
  packageActionFeedback,
  pluginSurfaceActionFeedback,
  sessionTypeActionFeedback,
  spawnTargetActionFeedback
} from "./app/actionFeedback";
import { AppListItem, AppsView, PluginListItem } from "./app/apps";
import { DashboardView } from "./app/dashboard";
import { currentDashboardSessions } from "./app/dashboardSessions";
import {
  EntityFamilyPanel,
  HubGeneralSection,
  DiagnosticsView,
  HubSettingsSectionsNav
} from "./app/hubSettings";
import {
  hubUpdateCheckAction,
  hubUpdateCheckActionId,
  hubUpdateOutcomeFromResult,
  type HubEntityLoadKey,
  type HubUpdateOutcome,
  replayHubStatusOnLifecycleEvent
} from "./app/hubLifecycle";
import {
  compareInstalledAppRows,
  compareInstalledPackageRows,
  packageAppSurfaces,
  packageSettingsSurfaces,
  type PackageSurfaceRecord,
  surfaceLaunchAction,
  surfaceTitle
} from "./app/packageSurfaces";
import { PluginNavigationShortcuts } from "./app/pluginNavigation";
import { PluginSettingsRoutePage, PluginSurfaceRoutePage } from "./app/pluginRoutes";
import {
  renderedPluginSurfaceState,
  type SelectedPluginSurface
} from "./app/pluginSurfaceState";
import {
  appRouteFromLocation,
  appRouteFromPathname,
  appViewFromRoute,
  type AppRoute,
  type AppView,
  type HubSettingsSection,
  pushAppRouteUrl,
  supportsHubRoutePath
} from "./app/routing";
import { SessionRouteView } from "./app/sessionRoute";
import {
  applySessionTypeHomeKind,
  applySessionTypeName,
  applySessionTypePreset,
  createSessionTypeForm,
  enabledSpawnPointSessionTypeSources,
  groupSessionTypesBySource,
  rejectedSessionTypeForm,
  SESSION_TYPE_PRESETS,
  SESSION_TYPE_SOURCE_GLOBAL_LABEL,
  sessionTypeDefinitionFromForm,
  sessionTypeFormFromAuthoringDefinition,
  sessionTypeFormHasAdvancedValues,
  sessionTypeFormIsStructurallyComplete,
  sessionTypeManagementSupported,
  sessionTypeMutationSource,
  sessionTypeMutationSourceFromRecord,
  sessionTypeSemanticsSummary,
  sessionTypeSourceGroupLabel,
  type SessionTypeFormState,
  type SessionTypePresetId
} from "./app/sessionTypes";
import {
  SessionTypeAdvancedOptions,
  SessionTypeExecutionControl,
  SessionTypeListItem,
  SessionTypesEmptyState,
  SessionTypeSubmitButton,
  SessionTypesSurfaceNotices,
  SessionTypesView,
  SpawnSessionTypesEmptyNotice
} from "./app/sessionTypeUi";
import {
  applySpawnSessionListResult,
  listSessionTypesForTargetAction,
  rejectedSpawnSessionForm,
  spawnSessionAction,
  spawnSessionFormForTarget,
  type SpawnSessionFormState
} from "./app/spawnSession";
import {
  compareSpawnTargetRows,
  emptySpawnTargetForm,
  spawnTargetFormFromRecord,
  spawnTargetIdFromLabel,
  type SpawnTargetFormState
} from "./app/spawnTargets";
import { SpawnTargetListItem } from "./app/spawnTargetUi";
import { terminalDescriptorForSessionId, terminalReleaseToast } from "./app/terminalChrome";
import {
  actionLabelFromId,
  appDisplayName,
  arrayOfStrings,
  firstString,
  parseMetadata,
  readRecord,
  stringValue,
  visibleStatusText
} from "./app/values";
import { useProductionHubConnection } from "./app/useProductionHubConnection";
import { WorkbenchNav } from "./app/workbench";

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
  const spawnSessionListGeneration = useRef(0);
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

  useProductionHubConnection({
    runtimeClient,
    recordDiagnostic,
    recordDiagnostics,
    updateLocalState,
    setSurfaceSnapshot,
    setFrameVersion,
    setEntityLoadStatus,
    setSessionTypeSubscriptionError
  });

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
  // Authoring homes only (Global vs admitted spawn points). New session options come from Hub list-for-target.
  const sessionTypeSpawnPoints = enabledSpawnPointSessionTypeSources(spawnTargets);
  const openSpawnSession = useCallback((target: Record<string, unknown>) => {
    spawnSessionListGeneration.current += 1;
    const listGeneration = spawnSessionListGeneration.current;
    const form = spawnSessionFormForTarget(target, listGeneration);
    setSpawnSessionForm(form);
    const action = listSessionTypesForTargetAction(form.targetId);
    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      const payload = readRecord(result.result);
      setSpawnSessionForm((current) => applySpawnSessionListResult(
        current,
        { targetId: form.targetId, listGeneration },
        {
          accepted: result.accepted,
          reason: result.reason,
          sessionTypes: payload.session_types
        }
      ) ?? current);
    }).catch((error: unknown) => {
      setSpawnSessionForm((current) => applySpawnSessionListResult(
        current,
        { targetId: form.targetId, listGeneration },
        {
          accepted: false,
          reason: error instanceof Error ? error.message : undefined
        }
      ) ?? current);
    });
  }, [recordDiagnostic, runtimeClient]);
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
    setSessionTypeForm(createSessionTypeForm("agent"));
  }, []);
  const openEditSessionType = useCallback((sessionType: Record<string, unknown>) => {
    // Prefer Hub's composite session_type_id for the authoring read so Hub can disambiguate.
    const compositeId = stringValue(
      sessionType.session_type_id,
      stringValue(sessionType.id, "")
    );
    if (!compositeId) return;

    const action: ActionBinding = {
      id: "botster.session_type.daemon_request",
      target: compositeId,
      label: "Load session type for edit",
      params: {
        daemon_request: {
          request_type: "show_session_type_definition",
          session_type_id: compositeId
        }
      }
    };

    void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
      recordDiagnostic(actionFailureDiagnostic(action, result));
      if (!result.accepted) {
        setPackageActionToast({
          message: result.reason ?? "Botster could not load this session type for editing.",
          color: "danger"
        });
        return;
      }

      const payload = readRecord(result.result);
      const editable = readRecord(payload.session_type_definition);
      const form = sessionTypeFormFromAuthoringDefinition(editable);
      if (!form) {
        // Never fall back to the sanitized entity row — that is the silent-loss path.
        setPackageActionToast({
          message: "Botster returned an incomplete authoring definition for this session type.",
          color: "danger"
        });
        return;
      }

      setSessionTypeForm(form);
    }).catch((error: unknown) => {
      setPackageActionToast({
        message: error instanceof Error ? error.message : "Botster could not load this session type for editing.",
        color: "danger"
      });
    });
  }, [recordDiagnostic, runtimeClient]);
  const submitSessionTypeForm = useCallback(() => {
    if (!sessionTypeForm || !sessionTypeFormIsStructurallyComplete(sessionTypeForm)) return;
    if (sessionTypeForm.submitting) return;

    const isEdit = sessionTypeForm.mode === "edit";
    const action: ActionBinding = {
      id: "botster.session_type.daemon_request",
      target: sessionTypeForm.sessionTypeId,
      label: isEdit ? "Update session type" : "Create session type",
      params: {
        daemon_request: {
          request_type: isEdit ? "update_session_type" : "create_session_type",
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
  const sessions = currentDashboardSessions(runtimeClient.entities.list("session"));
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
                    onDismissPresentation={(key) => dismissPluginSurfacePresentation(
                      selectedPluginSurface?.packageName ?? routePluginSurface.packageName,
                      selectedPluginSurface?.surfaceId ?? routePluginSurface.surfaceId,
                      key
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
                    onDismissPresentation={(key) => {
                      if (selectedPluginSurface?.packageName && selectedPluginSurface.surfaceId) {
                        dismissPluginSurfacePresentation(
                          selectedPluginSurface.packageName,
                          selectedPluginSurface.surfaceId,
                          key
                        );
                      }
                    }}
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
                        {sessionTypeSourceGroups.map((group) => {
                          const groupLabel = sessionTypeSourceGroupLabel(group.source);
                          return (
                          <div key={group.source} data-testid={`session-type-group-${group.source}`}>
                            <h3>{groupLabel}</h3>
                            <IonList lines="full" aria-label={`${groupLabel} session types`}>
                              {group.rows.map((sessionType) => (
                                <SessionTypeListItem
                                  key={String(sessionType.id)}
                                  sessionType={sessionType}
                                  onEdit={openEditSessionType}
                                  onDelete={setDeleteSessionType}
                                />
                              ))}
                            </IonList>
                          </div>
                          );
                        })}
                      </>
                    ) : entityLoadStatus.sessionType === "loading" || entityLoadStatus.sessionType === "not_loaded" ? (
                      <p className="entity-empty" data-testid="session-types-loading">Loading session types…</p>
                    ) : (
                      <SessionTypesEmptyState
                        supported={sessionTypeSubscriptionsSupported}
                        onCreate={openCreateSessionType}
                      />
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
                    {spawnSessionForm.listStatus === "loading" ? (
                      <SpawnSessionTypesEmptyNotice loading onManageSessionTypes={() => {}} />
                    ) : spawnSessionForm.listStatus === "error" ? (
                      <IonNote color="danger" data-testid="spawn-session-types-error">
                        {spawnSessionForm.error ?? "Botster could not load session types for this spawn point."}
                      </IonNote>
                    ) : spawnSessionForm.options.length === 0 ? (
                      <SpawnSessionTypesEmptyNotice
                        loading={false}
                        onManageSessionTypes={() => {
                          setSpawnSessionForm(undefined);
                          navigateToHubSettings("session-types");
                        }}
                      />
                    ) : (
                      <IonList lines="full" aria-label="New session form">
                        <IonItem>
                          <IonSelect
                            label="Session type"
                            labelPlacement="stacked"
                            value={spawnSessionForm.sessionTypeId}
                            placeholder="Choose a session type"
                            disabled={spawnSessionForm.submitting}
                            interface="popover"
                            onIonChange={(event) => setSpawnSessionForm((current) => current ? {
                              ...current,
                              sessionTypeId: String(event.detail.value ?? ""),
                              error: undefined
                            } : current)}
                          >
                            {spawnSessionForm.options.map((sessionType) => (
                              <IonSelectOption
                                key={sessionType.sessionTypeId}
                                value={sessionType.sessionTypeId}
                                disabled={!sessionType.available}
                              >
                                {sessionType.label}
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
                    {spawnSessionForm.error && spawnSessionForm.listStatus !== "error" ? (
                      <IonNote color="danger">{spawnSessionForm.error}</IonNote>
                    ) : null}
                    {spawnSessionForm.listStatus === "ready" && spawnSessionForm.options.length > 0 ? (
                      <div className="modal-actions">
                        <IonButton
                          disabled={!spawnSessionForm.sessionTypeId || spawnSessionForm.submitting}
                          onClick={submitSpawnSession}
                        >
                          <IonIcon icon={playOutline} slot="start" aria-hidden="true" />
                          {spawnSessionForm.submitting ? "Starting…" : "Start session"}
                        </IonButton>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </IonContent>
            </IonModal>
            <IonModal isOpen={Boolean(sessionTypeForm)} onDidDismiss={() => setSessionTypeForm(undefined)}>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>{sessionTypeForm?.mode === "edit" ? "Edit session type" : "Add session type"}</IonTitle>
                  <IonButtons slot="end">
                    <IonButton disabled={sessionTypeForm?.submitting} onClick={() => setSessionTypeForm(undefined)}>
                      Close
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                {sessionTypeForm ? (
                  <div className="session-type-form" data-testid="session-type-form">
                    <div className="session-type-form-intro">
                      <p>
                        Name it and point at a launch script. Like monorepo agents: claude, codex,
                        rails-server — not a full protocol form.
                      </p>
                    </div>
                    <IonList lines="full" aria-label="Session type form">
                      <IonItem>
                        <IonSelect
                          label="Where it lives"
                          labelPlacement="stacked"
                          value={sessionTypeForm.source === "repo" ? "repo" : "device"}
                          data-testid="session-type-source"
                          disabled={sessionTypeForm.mode === "edit"}
                          interface="popover"
                          onIonChange={(event) => {
                            const kind = String(event.detail.value ?? "device") === "repo" ? "repo" : "device";
                            setSessionTypeForm((current) => current
                              ? applySessionTypeHomeKind(current, kind, sessionTypeSpawnPoints)
                              : current);
                          }}
                        >
                          <IonSelectOption value="device">{SESSION_TYPE_SOURCE_GLOBAL_LABEL}</IonSelectOption>
                          <IonSelectOption value="repo" disabled={sessionTypeSpawnPoints.length === 0}>
                            Spawn point
                          </IonSelectOption>
                        </IonSelect>
                        <IonNote slot="helper" color="medium" data-testid="session-type-source-note">
                          {sessionTypeSpawnPoints.length === 0
                            ? "Global only until you add a spawn point under Hub settings."
                            : "Global is available at every spawn point. Spawn point limits the type to one path."}
                        </IonNote>
                      </IonItem>
                      {sessionTypeForm.source === "repo" ? (
                        <IonItem>
                          <IonSelect
                            label="Spawn point"
                            labelPlacement="stacked"
                            value={sessionTypeForm.sourceTargetId}
                            placeholder="Choose a spawn point"
                            data-testid="session-type-spawn-point"
                            disabled={sessionTypeForm.mode === "edit"}
                            interface="popover"
                            onIonChange={(event) => setSessionTypeForm((current) => current
                              ? { ...current, sourceTargetId: String(event.detail.value ?? "") }
                              : current)}
                          >
                            {sessionTypeSpawnPoints.map((point) => (
                              <IonSelectOption key={point.targetId} value={point.targetId}>
                                {point.label}
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                          <IonNote slot="helper" color="medium">
                            Definition is stored for this admitted path only.
                          </IonNote>
                        </IonItem>
                      ) : null}
                      <IonItem>
                        <IonInput
                          label="Name"
                          labelPlacement="stacked"
                          value={sessionTypeForm.label}
                          placeholder="claude"
                          data-testid="session-type-name"
                          onIonInput={(event) => setSessionTypeForm((current) => current
                            ? applySessionTypeName(current, String(event.detail.value ?? ""))
                            : current)}
                        />
                        <IonNote slot="helper" color="medium" data-testid="session-type-name-note">
                          Product name (claude, codex, rails-server). Sets the Hub id from this name.
                        </IonNote>
                      </IonItem>
                      <SessionTypeExecutionControl
                        mode={sessionTypeForm.executionMode}
                        onChange={(executionMode) => setSessionTypeForm((current) => current
                          ? { ...current, executionMode }
                          : current)}
                      />
                      <IonItem>
                        <IonInput
                          label="Command"
                          labelPlacement="stacked"
                          value={sessionTypeForm.command}
                          placeholder="bin/init.sh"
                          data-testid="session-type-command"
                          onIonInput={(event) => setSessionTypeForm((current) => current ? { ...current, command: String(event.detail.value ?? "") } : current)}
                        />
                        <IonNote slot="helper" color="medium" data-testid="session-type-command-note">
                          {sessionTypeForm.executionMode === "shell_command"
                            ? "Shell command text. Hub does not derive arguments from this text."
                            : "Relative path under the source root. Not a PATH binary name."}
                        </IonNote>
                      </IonItem>
                      <IonItem>
                        <IonSelect
                          label="Kind"
                          labelPlacement="stacked"
                          value={sessionTypeForm.preset}
                          data-testid="session-type-preset"
                          interface="popover"
                          onIonChange={(event) => {
                            const selected = String(event.detail.value ?? "custom") as SessionTypePresetId;
                            setSessionTypeForm((current) => current
                              ? applySessionTypePreset(current, selected)
                              : current);
                          }}
                        >
                          <IonSelectOption value="agent">{SESSION_TYPE_PRESETS.agent.label}</IonSelectOption>
                          <IonSelectOption value="shell">{SESSION_TYPE_PRESETS.shell.label}</IonSelectOption>
                          <IonSelectOption value="custom">Custom</IonSelectOption>
                        </IonSelect>
                        <IonNote slot="helper" color="medium" data-testid="session-type-preset-note">
                          {sessionTypeForm.preset === "custom"
                            ? "Edit role and related fields under Advanced."
                            : `${SESSION_TYPE_PRESETS[sessionTypeForm.preset].description}.`}
                        </IonNote>
                      </IonItem>
                      {sessionTypeSemanticsSummary(sessionTypeForm) ? (
                        <IonItem lines="none" className="session-type-semantics-item">
                          <IonNote
                            color="medium"
                            data-testid="session-type-semantics-summary"
                            className="session-type-semantics-summary"
                          >
                            {sessionTypeSemanticsSummary(sessionTypeForm)}
                          </IonNote>
                        </IonItem>
                      ) : null}
                    </IonList>
                    <SessionTypeAdvancedOptions
                      key={`${sessionTypeForm.mode}:${sessionTypeForm.sessionTypeId ?? "new"}:${sessionTypeForm.preset}`}
                      form={sessionTypeForm}
                      initiallyOpen={
                        sessionTypeForm.preset === "custom" ||
                        sessionTypeForm.mode === "edit" ||
                        sessionTypeFormHasAdvancedValues(sessionTypeForm)
                      }
                      onChange={setSessionTypeForm}
                    />
                    {sessionTypeForm.error ? (
                      <IonNote color="danger" data-testid="session-type-form-error">{sessionTypeForm.error}</IonNote>
                    ) : null}
                    <div className="modal-actions">
                      <SessionTypeSubmitButton
                        mode={sessionTypeForm.mode}
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
