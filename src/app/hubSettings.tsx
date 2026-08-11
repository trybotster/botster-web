/** Hub settings sections, software identity, and diagnostics support. */

import {
  IonBadge,
  IonButton,
  IonCard
} from "@ionic/react";
import type { ReactNode } from "react";

import {
  entityFamilyRecordLimit,
  hubUpdateOutcomeSummary,
  type HubUpdateOutcome
} from "./hubLifecycle";
import { hubSettingsSections, type HubSettingsSection } from "./routing";
import { arrayOfStrings, readRecord, readString, reportedNumber, stringValue } from "./values";

/**
 * Hub settings section nav (General / Session types / Support / …).
 * Exported for host-chrome anti-drift contracts — behavior-neutral.
 */
export function HubSettingsSectionsNav({
  activeSection,
  onNavigate
}: {
  activeSection: HubSettingsSection;
  onNavigate: (section: HubSettingsSection) => void;
}) {
  return (
    <nav className="hub-settings-nav" aria-label="Hub settings sections">
      {hubSettingsSections.map((section) => (
        <button
          type="button"
          key={section.id}
          className={activeSection === section.id ? "active" : undefined}
          aria-current={activeSection === section.id ? "page" : undefined}
          onClick={() => onNavigate(section.id)}
        >
          <strong>{section.label}</strong>
          <span>{section.description}</span>
        </button>
      ))}
    </nav>
  );
}
/**
 * Support / diagnostics panel shell. Exported so diagnostics-view and
 * developer-diagnostics remain inventory-covered under npm test.
 */
export function DiagnosticsView({
  diagnosticCount,
  blocking,
  children,
  developerDetails
}: {
  diagnosticCount: number;
  blocking: boolean;
  children?: ReactNode;
  developerDetails?: ReactNode;
}) {
  return (
    <section
      className="view-stack hub-settings-panel"
      aria-labelledby="diagnostics-view-heading"
      data-testid="diagnostics-view"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="diagnostics-view-heading">Support</h2>
        </div>
        <IonBadge color={blocking ? "danger" : "medium"}>
          {diagnosticCount}
        </IonBadge>
      </div>
      {children}
      {developerDetails !== undefined ? (
        <details className="developer-diagnostics">
          <summary>Developer details</summary>
          <p>Protocol, renderer, entity-frame, and terminal details for troubleshooting.</p>
          {developerDetails}
        </details>
      ) : null}
    </section>
  );
}

export function HubGeneralSection({
  hubStatus,
  hubUpdate,
  onCheckForUpdates
}: {
  hubStatus: Record<string, unknown> | undefined;
  hubUpdate: HubUpdateOutcome | undefined;
  onCheckForUpdates: () => void;
}) {
  const software = readRecord(hubStatus?.software);
  const installation = readRecord(hubStatus?.installation);
  const compatibility = readRecord(hubStatus?.compatibility);
  const buildRevision = readString(software.build_revision);
  const releaseChannel = readString(installation.release_channel);
  const provider = readString(installation.provider);
  const features = arrayOfStrings(compatibility.features);
  const updateState = readString(readRecord(hubUpdate?.update).state);
  const updateAction = readString(readRecord(hubUpdate?.update).action);
  return (
    <section className="view-stack hub-settings-panel" aria-labelledby="hub-general-heading" data-testid="hub-settings-general">
      <div className="page-heading">
        <div>
          <p className="eyebrow">About this hub</p>
          <h2 id="hub-general-heading">General</h2>
          <p className="page-description">Identity and software information for this Botster Hub.</p>
        </div>
      </div>
      <dl className="hub-metadata-list" data-testid="hub-software-identity">
        <div><dt>Software</dt><dd>{stringValue(software.product_name, "Not reported")}</dd></div>
        <div><dt>Version</dt><dd>{stringValue(software.version, "Not reported")}</dd></div>
        {buildRevision ? <div><dt>Build</dt><dd>{buildRevision}</dd></div> : null}
        <div><dt>Installation</dt><dd>{stringValue(installation.mode, "Not reported")}</dd></div>
        <div><dt>Provenance</dt><dd>{stringValue(installation.provenance, "Not reported")}</dd></div>
        {releaseChannel ? <div><dt>Release channel</dt><dd>{releaseChannel}</dd></div> : null}
        {provider ? <div><dt>Provider</dt><dd>{provider}</dd></div> : null}
      </dl>
      <div
        className="hub-software-update"
        data-testid="hub-software-update"
        {...(updateState ? { "data-hub-update-state": updateState } : {})}
      >
        <div>
          <h3>Software updates</h3>
          <p data-testid="hub-update-outcome">{hubUpdateOutcomeSummary(hubUpdate)}</p>
          {updateAction ? <p data-testid="hub-update-action">{updateAction}</p> : null}
        </div>
        <IonButton fill="outline" size="small" onClick={onCheckForUpdates}>
          Check for updates
        </IonButton>
      </div>
      <dl className="hub-metadata-list" data-testid="hub-host-identity">
        <div><dt>Name</dt><dd>{stringValue(hubStatus?.title, "Local Hub")}</dd></div>
        <div><dt>Host ID</dt><dd>{stringValue(hubStatus?.host_id, "Not reported")}</dd></div>
      </dl>
      <dl className="hub-metadata-list hub-metadata-secondary" data-testid="hub-internal-state">
        <div><dt>Protocol</dt><dd>{stringValue(compatibility.protocol, "Not reported")} · version {reportedNumber(compatibility.protocol_version, "Not reported")}</dd></div>
        <div><dt>Conformance revision</dt><dd>{reportedNumber(compatibility.conformance_fixture_revision, "Not reported")}</dd></div>
        <div><dt>Features</dt><dd>{features.length > 0 ? features.join(", ") : "Not reported"}</dd></div>
        <div><dt>State schema</dt><dd>Version {reportedNumber(hubStatus?.schema_version, "Not reported")}</dd></div>
      </dl>
    </section>
  );
}

interface EntityFamilyPanelProps {
  title: string;
  records: Record<string, unknown>[];
  emptyText: string;
  primaryField: string;
  secondaryField: string;
}

export function EntityFamilyPanel({ title, records, emptyText, primaryField, secondaryField }: EntityFamilyPanelProps) {
  return (
    <IonCard className="entity-family-panel">
      <div className="entity-family-heading">
        <h3>{title}</h3>
        <IonBadge color="medium">{records.length}</IonBadge>
      </div>
      {records.length > 0 ? (
        <div className="entity-record-list">
          {records.slice(0, entityFamilyRecordLimit).map((record) => (
            <div className="entity-record-row" key={String(record.id)}>
              <strong>{stringValue(record[primaryField], String(record.id))}</strong>
              <span>{stringValue(record[secondaryField], "unknown")}</span>
            </div>
          ))}
          {records.length > entityFamilyRecordLimit ? (
            <p className="entity-overflow">
              {records.length - entityFamilyRecordLimit} more records loaded.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="entity-empty">{emptyText}</p>
      )}
    </IonCard>
  );
}
