import {
  IonApp,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuButton,
  IonPage,
  IonSplitPane,
  IonTitle,
  IonToolbar,
  setupIonicReact
} from "@ionic/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cubeOutline,
  gitBranchOutline,
  layersOutline,
  radioButtonOnOutline,
  terminalOutline
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
  type ConnectionDiagnostic
} from "./botster/connectionDiagnostics";
import { createDogfoodRuntimeConfig } from "./botster/dogfoodMode";
import { realHubDogfoodSessionId } from "./botster/realHubDogfoodTransport";
import type { ActionBinding } from "./botster/actions";
import type { TerminalDataPlaneAttachment, TerminalViewDescriptor } from "./botster/terminal";
import type { UiTreeSnapshot } from "./botster/uiNodes";

setupIonicReact({
  mode: "md"
});

const navigationItems = [
  { label: "Workbench", icon: layersOutline, active: true },
  { label: "Entity Frames", icon: cubeOutline, active: false },
  { label: "Actions", icon: radioButtonOnOutline, active: false },
  { label: "Terminal", icon: terminalOutline, active: false }
];

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

function pluginSurfaceStatus(result: unknown): string | undefined {
  const pluginSurface = readRecord(readRecord(result).plugin_surface);
  const packageName = readString(pluginSurface.package_name);
  const surfaceId = readString(pluginSurface.surface_id);

  if (!packageName || !surfaceId) {
    return undefined;
  }

  const title = readString(pluginSurface.title) ?? "Plugin surface";
  const body = readString(pluginSurface.body);
  return body
    ? `${title}: ${body} (${packageName}/${surfaceId})`
    : `${title} rendered (${packageName}/${surfaceId})`;
}

export default function App() {
  const dogfoodRuntime = useMemo(
    () => {
      const packageRuntime = Boolean(
        (window as typeof window & { __BOTSTER_PACKAGE_RUNTIME__?: boolean }).__BOTSTER_PACKAGE_RUNTIME__
      );
      return createDogfoodRuntimeConfig({
        env: import.meta.env,
        locationHref: window.location.href,
        ...(packageRuntime ? { bridgeUrl: `${window.location.origin}/request` } : {}),
        packageRuntime
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
    initialConnectionDiagnostics(dogfoodRuntime.mode, dogfoodRuntime.statusText)
  );
  const [entityLoadStatus, setEntityLoadStatus] = useState<Record<"package" | "session" | "draft", DogfoodEntityLoadStatus>>({
    package: "not_loaded",
    session: "not_loaded",
    draft: "not_loaded"
  });
  const [selectedRealHubTerminalSessionId, setSelectedRealHubTerminalSessionId] = useState<string | undefined>();
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
      key: "package" | "session" | "draft",
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
      .then(() => pullDogfoodEntity("package", { family: "botster-web.package" }))
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
        const renderedSurfaceStatus = action.id === "botster.package.surface.render"
          ? pluginSurfaceStatus(result.result)
          : undefined;
        if (result.accepted && isAttachAction && action.target) {
          setSelectedRealHubTerminalSessionId(action.target);
        }
        updateLocalState({
          [statusKey]: result.accepted && isSpawnAction
            ? `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
            : result.accepted && isAttachAction && action.target
              ? `Attached terminal panel to ${action.target}.`
            : result.accepted
              ? `Accepted ${action.id}`
              : result.reason ?? `Rejected ${action.id}`,
          ...(renderedSurfaceStatus ? { "dogfood.plugin_surface_status": renderedSurfaceStatus } : {})
        });
        recordDiagnostic(actionFailureDiagnostic(action, result));
      });
    },
    [recordDiagnostic, runtimeClient, updateLocalState]
  );
  const recordTerminalDiagnostic = useCallback(
    (error: unknown) => {
      recordDiagnostic(terminalUnavailableDiagnostic(error));
    },
    [recordDiagnostic]
  );
  const packages = runtimeClient.entities.list("botster-web.package");
  const sessions = runtimeClient.entities.list("botster-web.session");
  const attachableDogfoodSession = sessions.find((session) => session.id === realHubDogfoodSessionId && isAttachableSession(session));
  const selectedRealHubSession = selectedRealHubTerminalSessionId
    ? sessions.find((session) => session.id === selectedRealHubTerminalSessionId)
    : undefined;
  const selectedRealHubSessionAttachable = isAttachableSession(selectedRealHubSession);
  const activeRealHubTerminalSessionId = selectedRealHubSessionAttachable
    ? selectedRealHubTerminalSessionId
    : attachableDogfoodSession?.id;
  const terminalDescriptor: TerminalViewDescriptor | undefined = useMemo(
    () =>
      dogfoodRuntime.mode === "real-hub"
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

  return (
    <IonApp>
      <IonSplitPane contentId="main-content" when="lg">
        <IonMenu contentId="main-content" type="overlay" className="app-sidebar">
          <IonHeader>
            <IonToolbar>
              <IonTitle>Botster</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <nav aria-label="Botster workbench">
              <IonList lines="none" className="nav-list">
                {navigationItems.map((item) => (
                  <button
                    type="button"
                    className={item.active ? "nav-item active" : "nav-item"}
                    key={item.label}
                    aria-current={item.active ? "page" : undefined}
                  >
                    <IonIcon icon={item.icon} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </IonList>
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
                  <IonChip color={dogfoodRuntime.mode === "real-hub" ? "success" : "medium"} outline>
                    <IonLabel>{dogfoodRuntime.mode}</IonLabel>
                  </IonChip>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent fullscreen>
            <main className="workspace-shell">
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

              <section className="contract-strip" aria-label="Botster client contract">
                {botsterWebClientContract.seams.map((seam) => (
                  <IonChip key={seam} color="light">
                    <IonLabel>{seam}</IonLabel>
                  </IonChip>
                ))}
              </section>

              <section className="workspace-grid" aria-label="Renderer workbench">
                <div className="dogfood-main">
                  <ConnectionDiagnosticsPanel diagnostics={diagnostics} />
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
                </div>
                {terminalDescriptor && terminalDataPlane ? (
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
                )}
              </section>
            </main>
          </IonContent>
        </IonPage>
      </IonSplitPane>
    </IonApp>
  );
}
