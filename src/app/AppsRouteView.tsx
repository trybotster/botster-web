/** Apps launcher, plugin surface route, and package settings route. */

import { IonLabel, IonListHeader } from "@ionic/react";

import type { ActionBinding } from "../botster/actions";
import type { EntityFrameStore, EntityRecord } from "../botster/entities";
import type { UiNodeActionDispatch } from "../botster/uiNodes";
import type { UiPresentationState } from "../botster/uiPresentation";
import { AppListItem, AppsView, PluginListItem } from "./apps";
import {
  compareInstalledAppRows,
  compareInstalledPackageRows,
  packageAppSurfaces,
  type PackageSurfaceRecord
} from "./packageSurfaces";
import { PluginSettingsRoutePage, PluginSurfaceRoutePage } from "./pluginRoutes";
import type { SelectedPluginSurface } from "./pluginSurfaceState";
import type { AppRoute } from "./routing";
import { stringValue } from "./values";

export interface AppsRouteViewProps {
  routePluginSurface?: { packageName: string; surfaceId: string };
  routeSettingsPackageName?: string;
  packages: EntityRecord[];
  installedApps: EntityRecord[];
  appSurfacePackages: Map<string, Record<string, unknown>>;
  selectedPluginSurface?: SelectedPluginSurface;
  uiPresentationState: UiPresentationState;
  routePluginSurfaceKey?: string;
  routePluginSurfaceDiagnostic?: string;
  settingsPackage?: Record<string, unknown>;
  settingsPackageDiagnostic?: string;
  routeSettingsSurfaceKey?: string;
  routeSettingsSurfaceDiagnostic?: string;
  packageSettingsReturnRoute: { current: AppRoute };
  localState: Record<string, unknown>;
  entities: EntityFrameStore;
  dispatchAction: (action: ActionBinding) => void;
  dispatchPluginSurfaceAction: (packageName: string, surfaceId: string, dispatch: UiNodeActionDispatch) => void;
  dismissPluginSurfacePresentation: (packageName: string, surfaceId: string, key: string) => void;
  openPackage: (app: Record<string, unknown>) => void;
  openApp: (app: Record<string, unknown>) => void;
  openPackageSettings: (app: Record<string, unknown>) => void;
  openPackageSettingsSurface: (packageName: string, surface: PackageSurfaceRecord) => void;
  navigateToRoute: (route: AppRoute) => void;
  onAddPackage: () => void;
}

export function AppsRouteView(props: AppsRouteViewProps) {
  const {
    routePluginSurface,
    routeSettingsPackageName,
    packages,
    installedApps,
    appSurfacePackages,
    selectedPluginSurface,
    uiPresentationState,
    routePluginSurfaceKey,
    routePluginSurfaceDiagnostic,
    settingsPackage,
    settingsPackageDiagnostic,
    routeSettingsSurfaceKey,
    routeSettingsSurfaceDiagnostic,
    packageSettingsReturnRoute,
    localState,
    entities,
    dispatchAction,
    dispatchPluginSurfaceAction,
    dismissPluginSurfacePresentation,
    openPackage,
    openApp,
    openPackageSettings,
    openPackageSettingsSurface,
    navigateToRoute,
    onAddPackage
  } = props;

  const installedPackageNames = new Set(packages.map((appPackage) => stringValue(appPackage.package_name, String(appPackage.id))));
  const installedPackageRows = [...packages].sort(compareInstalledPackageRows);
  const installedAppPackageRows = installedPackageRows.filter((app) => packageAppSurfaces(app).length > 0);
  const installedPluginPackageRows = installedPackageRows.filter((app) => packageAppSurfaces(app).length === 0);
  const installedAppRows = installedApps
    .filter((app) => !installedPackageNames.has(stringValue(app.package_name, "")))
    .sort(compareInstalledAppRows);
  const installedRowCount = installedPackageRows.length + installedAppRows.length;

  if (routePluginSurface) {
    return (
      <PluginSurfaceRoutePage
        diagnostic={routePluginSurfaceDiagnostic}
        packageName={routePluginSurface.packageName}
        selectedSurface={selectedPluginSurface?.routeKey === routePluginSurfaceKey ? selectedPluginSurface : undefined}
        surfaceId={routePluginSurface.surfaceId}
        localState={localState}
        entities={entities}
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
    );
  }

  if (routeSettingsPackageName) {
    return (
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
        entities={entities}
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
    );
  }

  return (
    <AppsView
      installedRowCount={installedRowCount}
      onAddPackage={onAddPackage}
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
  );
}
