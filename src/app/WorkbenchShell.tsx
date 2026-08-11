/** Workbench chrome: menu, header, and slots for main content and dialogs. */

import {
  IonApp,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonList,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonPage,
  IonSplitPane,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import type { ReactNode } from "react";
import { arrowBackOutline, cogOutline } from "ionicons/icons";

import type { AppView, HubSettingsSection } from "./routing";
import { PluginNavigationShortcuts } from "./pluginNavigation";
import { WorkbenchNav } from "./workbench";

export interface WorkbenchShellProps {
  /** Primary navigation state for menu chrome. */
  navigation: {
    activeView: AppView;
    navigateToView: (view: AppView) => void;
    navigateToHubSettings: (section?: HubSettingsSection) => void;
    packageNavigationShortcuts: Record<string, unknown>[];
    onOpenPackageNavigation: (entry: Record<string, unknown>) => void;
  };
  /** Header/terminal chrome. */
  chrome: {
    terminalSessionRouteActive: boolean;
    pluginAppRouteActive: boolean;
    toolbarTitle?: string;
    sessionRoute: ReactNode;
  };
  /** Focused route trees rendered by App (dashboard / apps / hub-settings). */
  main: ReactNode;
  /** Dialog host rendered by App. */
  dialogs: ReactNode;
}

export function WorkbenchShell({
  navigation,
  chrome,
  main,
  dialogs
}: WorkbenchShellProps) {
  const {
    activeView,
    navigateToView,
    navigateToHubSettings,
    packageNavigationShortcuts,
    onOpenPackageNavigation
  } = navigation;
  const {
    terminalSessionRouteActive,
    pluginAppRouteActive,
    toolbarTitle,
    sessionRoute
  } = chrome;

  return (
    <IonApp>
      <IonSplitPane contentId="main-content" when="md" className="app-split-pane">
        <IonMenu contentId="main-content" type="overlay" className="app-sidebar">
          <IonHeader>
            <IonToolbar>
              <IonTitle>Botster</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <WorkbenchNav activeView={activeView} onNavigate={navigateToView}>
              <PluginNavigationShortcuts
                entries={packageNavigationShortcuts}
                onOpen={onOpenPackageNavigation}
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

          <IonContent
            fullscreen
            className={
              terminalSessionRouteActive
                ? "terminal-session-content"
                : pluginAppRouteActive
                  ? "plugin-app-content"
                  : undefined
            }
          >
            <main
              className={
                terminalSessionRouteActive
                  ? "terminal-session-shell"
                  : pluginAppRouteActive
                    ? "workspace-shell plugin-workspace-shell"
                    : "workspace-shell"
              }
            >
              {sessionRoute}
              {main}
            </main>
            {dialogs}
          </IonContent>
        </IonPage>
      </IonSplitPane>
    </IonApp>
  );
}
