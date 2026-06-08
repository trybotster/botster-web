import {
  IonApp,
  IonBadge,
  IonButton,
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
import {
  codeSlashOutline,
  cubeOutline,
  gitBranchOutline,
  layersOutline,
  radioButtonOnOutline,
  terminalOutline
} from "ionicons/icons";

import { UiFrameHost } from "./botster/UiFrameHost";
import { placeholderFrameSet } from "./botster/frames";

setupIonicReact({
  mode: "md"
});

const navigationItems = [
  { label: "Workbench", icon: layersOutline, active: true },
  { label: "Entity Frames", icon: cubeOutline, active: false },
  { label: "Actions", icon: radioButtonOnOutline, active: false },
  { label: "Terminal", icon: terminalOutline, active: false }
];

export default function App() {
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
                  <IonLabel>renderer shell</IonLabel>
                </IonChip>
                <IonButton fill="solid" color="primary">
                  <IonIcon slot="start" icon={codeSlashOutline} aria-hidden="true" />
                  Inspect frames
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent fullscreen>
            <main className="workspace-shell">
              <section className="workspace-overview" aria-labelledby="overview-heading">
                <div>
                  <p className="eyebrow">First-party client</p>
                  <h1 id="overview-heading">Ionic React renderer shell</h1>
                  <p>
                    Botster hub/core own runtime truth. This client renders structured
                    UiNode, action, and entity frames.
                  </p>
                </div>
                <div className="status-strip" aria-label="Shell contract status">
                  <span>
                    <IonBadge color="success">Ionic</IonBadge>
                    shell
                  </span>
                  <span>
                    <IonBadge color="tertiary">UiNode</IonBadge>
                    frame seam
                  </span>
                  <span>
                    <IonBadge color="medium">Restty</IonBadge>
                    deferred
                  </span>
                </div>
              </section>

              <section className="workspace-grid" aria-label="Renderer workbench">
                <UiFrameHost frameSet={placeholderFrameSet} />

                <aside className="terminal-placeholder" aria-labelledby="terminal-heading">
                  <div className="panel-heading">
                    <IonIcon icon={terminalOutline} aria-hidden="true" />
                    <h2 id="terminal-heading">Terminal renderer placeholder</h2>
                  </div>
                  <p>
                    Restty integration is intentionally not mounted in this scaffold.
                    Future terminal tickets own the renderer lifecycle and destroy path.
                  </p>
                </aside>
              </section>
            </main>
          </IonContent>
        </IonPage>
      </IonSplitPane>
    </IonApp>
  );
}
