/** Plugin surface and settings route pages. */

import { IonBadge, IonButton, IonItem, IonLabel, IonList } from "@ionic/react";

import type { ActionBinding } from "../botster/actions";
import { defaultUiCapabilitySet } from "../botster/capabilities";
import type { EntityFrameStore } from "../botster/entities";
import type { UiNodeActionDispatch } from "../botster/uiNodes";
import { UiNodeSurface } from "../botster/UiNodeSurface";
import { presentationValues, type UiPresentationState } from "../botster/uiPresentation";
import { PluginSettingsPanel } from "./packageSettings";
import type { PackageSurfaceRecord } from "./packageSurfaces";
import type { SelectedPluginSurface } from "./pluginSurfaceState";
import { appDisplayName } from "./values";

interface PluginSurfaceRoutePageProps {
  packageName: string;
  surfaceId: string;
  diagnostic?: string;
  selectedSurface?: SelectedPluginSurface;
  localState: Record<string, unknown>;
  entities: EntityFrameStore;
  presentationState?: UiPresentationState;
  onAction: (dispatch: UiNodeActionDispatch) => void;
  onDismissPresentation?: (key: string) => void;
}

export function PluginSurfaceRoutePage({
  packageName,
  surfaceId,
  diagnostic,
  selectedSurface,
  localState,
  entities,
  presentationState = {},
  onAction,
  onDismissPresentation
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
          onDismissPresentation={onDismissPresentation}
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
  onDismissPresentation?: (key: string) => void;
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
  presentationState = {},
  onDismissPresentation
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
              onDismissPresentation={onDismissPresentation}
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
