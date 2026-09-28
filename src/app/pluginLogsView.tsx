/** Hub settings: one plugin's structured log records, newest first. */

import { IonBadge, IonButton, IonNote } from "@ionic/react";

import type { createBotsterWebClient } from "../botster/client";
import type { DaemonPluginLogRecord } from "../botster/generated/daemon-protocol";
import type { PluginLogView } from "../botster/pluginLogs";
import { usePluginLogs, type PluginLogStatus } from "./usePluginLogs";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

const levelColors: Record<string, string> = {
  debug: "medium",
  info: "primary",
  warn: "warning",
  error: "danger"
};

function formattedFields(fieldsJson: string | undefined): string | undefined {
  if (!fieldsJson) return undefined;
  try {
    return JSON.stringify(JSON.parse(fieldsJson), null, 2);
  } catch {
    return fieldsJson;
  }
}

function PluginLogRow({ record, newestGeneration }: { record: DaemonPluginLogRecord; newestGeneration: number }) {
  const fields = formattedFields(record.fields_json);
  return (
    <li
      className="plugin-log-record"
      data-testid="plugin-log-record"
      data-seq={record.seq}
      data-level={record.level}
      data-generation={record.generation}
    >
      {record.dropped_before > 0 ? (
        <p className="plugin-log-gap" data-testid="plugin-logs-rate-limited">
          {record.dropped_before} {record.dropped_before === 1 ? "record was" : "records were"} rate-limited before this one.
        </p>
      ) : null}
      <div className="plugin-log-heading">
        <IonBadge color={levelColors[record.level] ?? "medium"}>{record.level}</IonBadge>
        <time dateTime={new Date(record.at_ms).toISOString()}>{new Date(record.at_ms).toLocaleString()}</time>
        <span className="plugin-log-generation">
          Load {record.generation}{record.generation < newestGeneration ? " (earlier load)" : ""}
        </span>
      </div>
      <p className="plugin-log-message">{record.message}</p>
      {fields ? <pre className="plugin-log-fields" data-testid="plugin-log-fields">{fields}</pre> : null}
    </li>
  );
}

/** Markup for a log view and status; exported for markup tests. */
export function PluginLogsPanel({
  view,
  status,
  onLoadNewer,
  onRetry
}: {
  view: PluginLogView;
  status: PluginLogStatus;
  onLoadNewer: () => void;
  onRetry: () => void;
}) {
  const newestGeneration = view.records.reduce((max, record) => Math.max(max, record.generation), 0);
  const newestFirst = [...view.records].reverse();
  return (
    <section className="workflow-section plugin-logs" aria-labelledby="plugin-logs-heading" data-testid="plugin-logs">
      <div className="section-heading">
        <div>
          <h3 id="plugin-logs-heading">Plugin logs</h3>
          <p className="page-description">Records the plugin wrote with botster.log, newest first.</p>
        </div>
        <IonButton
          fill="outline"
          size="small"
          disabled={status.kind === "loading"}
          onClick={onLoadNewer}
          data-testid="plugin-logs-load-newer"
        >
          {status.kind === "loading" ? "Reading…" : "Load newer"}
        </IonButton>
      </div>
      {view.restarted ? (
        <IonNote className="plugin-logs-restarted" data-testid="plugin-logs-restarted">
          The plugin&apos;s log started again (the package was loaded after an unload or disable, or the Hub restarted).
        </IonNote>
      ) : null}
      {status.kind === "refused" ? (
        <div className="plugin-logs-refused" role="alert" data-testid="plugin-logs-refused">
          <p>{status.message}</p>
          <IonButton fill="clear" size="small" onClick={onRetry} data-testid="plugin-logs-retry">Retry</IonButton>
        </div>
      ) : null}
      {view.loaded && view.records.length === 0 ? (
        <p className="entity-empty" data-testid="plugin-logs-empty">No log records.</p>
      ) : null}
      <ul className="plugin-log-list">
        {newestFirst.map((record) => (
          <PluginLogRow key={`${view.logId ?? "none"}:${record.seq}`} record={record} newestGeneration={newestGeneration} />
        ))}
      </ul>
      {view.evicted.map((gap) => (
        <p className="plugin-log-gap" data-testid="plugin-logs-evicted" key={`${gap.fromSeq}-${gap.toSeq}`}>
          {gap.fromSeq === gap.toSeq ? `Record ${gap.fromSeq} was` : `Records ${gap.fromSeq}–${gap.toSeq} were`} evicted before they were read.
        </p>
      ))}
    </section>
  );
}

export function PluginLogsSection({ runtimeClient, packageName }: { runtimeClient: RuntimeClient; packageName: string }) {
  const { view, status, loadNewer, retry } = usePluginLogs(runtimeClient, packageName);
  return <PluginLogsPanel view={view} status={status} onLoadNewer={loadNewer} onRetry={retry} />;
}
