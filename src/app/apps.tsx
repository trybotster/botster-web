/** Apps launcher list items and shell. */

import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { addOutline, cogOutline, constructOutline, cubeOutline } from "ionicons/icons";
import type { ReactNode } from "react";

import {
  capabilityCountLabel,
  packageActions,
  packageAppSurfaces,
  packageSettingsSurfaces,
  type PackageSurfaceRecord,
  surfaceDescription,
  surfaceLaunchAction,
  surfaceTitle
} from "./packageSurfaces";
import { appDisplayName, arrayOfStrings, readRecord, stringValue } from "./values";

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
