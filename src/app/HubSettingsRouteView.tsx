/** Hub settings sections: general, session types, extensions, spawn points, support. */

import {
  IonBadge,
  IonButton,
  IonChip,
  IonCol,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRow
} from "@ionic/react";
import { addOutline, serverOutline } from "ionicons/icons";

import { ConnectionDiagnosticsPanel } from "../botster/ConnectionDiagnosticsPanel";
import { LocalHubFirstScreen, type HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import { UiNodeSurface } from "../botster/UiNodeSurface";
import { defaultUiCapabilitySet } from "../botster/capabilities";
import { botsterWebClientContract, createBotsterWebClient } from "../botster/client";
import type { ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { ActionBinding } from "../botster/actions";
import type { EntityRecord } from "../botster/entities";
import type { HubRuntimeConfig } from "../botster/hubRuntime";
import type { EntitySubscriptionErrorPayload } from "../botster/protocol";
import type { UiTreeSnapshot } from "../botster/uiNodes";
import {
  EntityFamilyPanel,
  HubGeneralSection,
  DiagnosticsView,
  HubSettingsSectionsNav
} from "./hubSettings";
import { hubUpdateCheckAction, type HubEntityLoadKey, type HubUpdateOutcome } from "./hubLifecycle";
import { compareInstalledPackageRows, packageAppSurfaces } from "./packageSurfaces";
import type { HubSettingsSection } from "./routing";
import {
  groupSessionTypesBySource,
  sessionTypeManagementSupported,
  sessionTypeSourceGroupLabel
} from "./sessionTypes";
import {
  SessionTypeListItem,
  SessionTypesEmptyState,
  SessionTypesSurfaceNotices,
  SessionTypesView
} from "./sessionTypeUi";
import { SpawnTargetListItem } from "./spawnTargetUi";
import { appDisplayName, stringValue } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export interface HubSettingsRouteViewProps {
  activeHubSettingsSection: HubSettingsSection;
  navigateToHubSettings: (section?: HubSettingsSection) => void;
  packages: EntityRecord[];
  sessions: EntityRecord[];
  spawnTargets: EntityRecord[];
  sessionTypes: EntityRecord[];
  hubStatus: EntityRecord | undefined;
  diagnostics: ConnectionDiagnostic[];
  blockingDiagnostics: ConnectionDiagnostic[];
  hubUpdate: HubUpdateOutcome | undefined;
  hubRuntime: HubRuntimeConfig;
  runtimeClient: RuntimeClient;
  entityLoadStatus: Record<HubEntityLoadKey, HubEntityLoadStatus>;
  surfaceSnapshot: UiTreeSnapshot | undefined;
  loadingSnapshot: UiTreeSnapshot;
  localState: Record<string, unknown>;
  actionStatus: string;
  diagnosticActionStatus: string;
  dispatchAction: (action: ActionBinding) => void;
  openPackageSettings: (app: Record<string, unknown>) => void;
  openCreateSpawnTarget: () => void;
  openEditSpawnTarget: (target: Record<string, unknown>) => void;
  setDeleteSpawnTarget: (target: Record<string, unknown> | undefined) => void;
  openSpawnSession: (target: Record<string, unknown>) => void;
  openCreateSessionType: () => void;
  openEditSessionType: (sessionType: Record<string, unknown>) => void;
  setDeleteSessionType: (sessionType: Record<string, unknown> | undefined) => void;
  sessionTypeSubscriptionError?: EntitySubscriptionErrorPayload;
}

export function HubSettingsRouteView(props: HubSettingsRouteViewProps) {
  const {
    activeHubSettingsSection,
    navigateToHubSettings,
    packages,
    sessions,
    spawnTargets,
    sessionTypes,
    hubStatus,
    diagnostics,
    blockingDiagnostics,
    hubUpdate,
    hubRuntime,
    runtimeClient,
    entityLoadStatus,
    surfaceSnapshot,
    loadingSnapshot,
    localState,
    actionStatus,
    diagnosticActionStatus,
    dispatchAction,
    openPackageSettings,
    openCreateSpawnTarget,
    openEditSpawnTarget,
    setDeleteSpawnTarget,
    openSpawnSession,
    openCreateSessionType,
    openEditSessionType,
    setDeleteSessionType,
    sessionTypeSubscriptionError
  } = props;

  const installedPackageRows = [...packages].sort(compareInstalledPackageRows);
  const sessionTypeSourceGroups = groupSessionTypesBySource(sessionTypes);
  const sessionTypeSubscriptionsSupported = sessionTypeManagementSupported(hubStatus);

  return (
    <>
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

                {activeHubSettingsSection === "general" ? (
                  <HubGeneralSection
                    hubStatus={hubStatus}
                    hubUpdate={hubUpdate}
                    onCheckForUpdates={() => dispatchAction(hubUpdateCheckAction())}
                  />
                ) : null}

                {activeHubSettingsSection === "session-types" ? (
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

                {activeHubSettingsSection === "extensions" ? (
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

                {activeHubSettingsSection === "spawn-points" ? (
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

                {activeHubSettingsSection === "support" ? (
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
    </>
  );
}
