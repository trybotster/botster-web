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
  const [, setFrameVersion] = useState(0);
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
          setLocalState({
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
  }, [recordDiagnostic, recordDiagnostics, runtimeClient]);

  const dispatchAction = useCallback(
    (action: ActionBinding) => {
      setLocalState({ "dogfood.action_status": `Dispatching ${action.id}` });
      void runtimeClient.actions.dispatch({ origin: "ui_node", action }).then((result) => {
        const isSpawnAction = action.id === "botster.session.select";
        setLocalState({
          "dogfood.action_status": result.accepted && isSpawnAction
            ? `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
            : result.accepted
              ? `Accepted ${action.id}`
              : result.reason ?? `Rejected ${action.id}`
        });
        recordDiagnostic(actionFailureDiagnostic(action, result));
      });
    },
    [recordDiagnostic, runtimeClient]
  );
  const recordTerminalDiagnostic = useCallback(
    (error: unknown) => {
      recordDiagnostic(terminalUnavailableDiagnostic(error));
    },
    [recordDiagnostic]
  );
  const packages = runtimeClient.entities.list("botster-web.package");
  const sessions = runtimeClient.entities.list("botster-web.session");
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
                <TerminalViewHost
                  dataPlane={dogfoodRuntime.terminalDataPlane}
                  descriptor={dogfoodRuntime.terminalDescriptor}
                  onDiagnostic={recordTerminalDiagnostic}
                />
              </section>
            </main>
          </IonContent>
        </IonPage>
      </IonSplitPane>
    </IonApp>
  );
}
