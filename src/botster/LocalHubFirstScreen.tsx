import { IonBadge } from "@ionic/react";

import { realHubDogfoodSessionId } from "./realHubDogfoodTransport";
import type { ConnectionDiagnostic } from "./connectionDiagnostics";
import type { EntityRecord } from "./entities";

export type HubEntityLoadStatus = "not_loaded" | "loading" | "loaded" | "error";

export interface LocalHubFirstScreenProps {
  mode: string;
  statusText: string;
  diagnostics: ConnectionDiagnostic[];
  packages: EntityRecord[];
  packageLoadStatus: HubEntityLoadStatus;
  sessions: EntityRecord[];
  sessionLoadStatus: HubEntityLoadStatus;
  actionStatus: string;
}

interface StatusSummary {
  key: string;
  label: string;
  state: string;
  detail: string;
  severity: ConnectionDiagnostic["severity"];
}

export function LocalHubFirstScreen({
  mode,
  statusText,
  diagnostics,
  packages,
  packageLoadStatus,
  sessions,
  sessionLoadStatus,
  actionStatus
}: LocalHubFirstScreenProps) {
  const summaries = hubStatusSummaries({
    mode,
    statusText,
    diagnostics,
    packages,
    packageLoadStatus,
    sessions,
    sessionLoadStatus,
    actionStatus
  });

  return (
    <section className="local-hub-first-screen" aria-labelledby="local-hub-status-heading">
      <div className="local-hub-status-lead">
        <p className="eyebrow">Local hub status</p>
        <h1 id="local-hub-status-heading">Local hub workbench</h1>
        <p>
          Hub, bridge, package registry, session state, spawn action, and terminal
          health are visible here without opening the browser console.
        </p>
      </div>
      <div className="local-hub-primary-action" aria-label="Primary local hub action">
        <div>
          <p className="eyebrow">Primary action</p>
          <h2>Start local hub session</h2>
          <p>
            Runs the local hub startup command. Output appears in the terminal panel.
          </p>
          <p className="local-hub-action-state">{visibleStatusText(actionStatus)}</p>
        </div>
        <IonBadge color="primary">Primary</IonBadge>
      </div>
      <div className="local-hub-status-grid" aria-label="Local hub health summary">
        {summaries.map((summary) => (
          <article className={`local-hub-status-card ${summary.severity}`} key={summary.key}>
            <div className="local-hub-status-title">
              <h3>{summary.label}</h3>
              <IonBadge color={badgeColor(summary.severity)}>{summary.state}</IonBadge>
            </div>
            <p>{summary.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function hubStatusSummaries({
  mode,
  statusText,
  diagnostics,
  packages,
  packageLoadStatus,
  sessions,
  sessionLoadStatus,
  actionStatus
}: LocalHubFirstScreenProps): StatusSummary[] {
  const bridgeDiagnostic = diagnostics.find((diagnostic) => diagnostic.source === "bridge" && diagnostic.severity === "danger");
  const hubDiagnostic = highestSeverityDiagnostic(
    diagnostics.filter((diagnostic) => diagnostic.source === "stream" || diagnostic.source === "compatibility")
  );
  const terminalDiagnostic = highestSeverityDiagnostic(diagnostics.filter((diagnostic) => diagnostic.source === "terminal"));
  const actionDiagnostics = diagnostics.filter((diagnostic) => diagnostic.source === "action" && isSpawnDiagnostic(diagnostic));
  const actionDiagnostic =
    actionDiagnostics.find((diagnostic) => diagnostic.title === "Hub action failed") ??
    highestSeverityDiagnostic(actionDiagnostics);
  const runningSession = sessions.find((session) => session.id === realHubDogfoodSessionId && session.status === "running");
  const pendingSession = sessions.find((session) => session.id === realHubDogfoodSessionId && session.status === "pending");
  const localHubMode = mode === "real-hub" || mode === "webrtc";

  return [
    {
      key: "hub",
      label: "Hub",
      state: hubDiagnostic
        ? stateLabel(hubDiagnostic.severity)
        : bridgeDiagnostic
          ? "Blocked"
          : localHubMode ? "Connecting" : "Fixture",
      detail: hubDiagnostic?.detail ?? bridgeDiagnostic?.detail ?? statusText,
      severity: hubDiagnostic?.severity ?? bridgeDiagnostic?.severity ?? "info"
    },
    {
      key: "bridge",
      label: mode === "webrtc" ? "Transport" : "Bridge",
      state: bridgeDiagnostic ? "Blocked" : localHubMode ? "Ready" : "Fixture",
      detail: bridgeDiagnostic?.detail ?? statusText,
      severity: bridgeDiagnostic?.severity ?? (localHubMode ? "success" : "info")
    },
    packageSummary(packages, packageLoadStatus),
    sessionSummary(sessions, sessionLoadStatus),
    {
      key: "spawn",
      label: "Spawn action",
      state: actionDiagnostic ? "Blocked" : runningSession ? "Running" : pendingSession ? "Pending" : spawnRequested(actionStatus) ? "Requested" : "Ready",
      detail: actionDiagnostic?.detail ??
        (runningSession
          ? "The local hub session is running; output appears in the terminal panel."
          : pendingSession
            ? "Start requested locally; waiting for the authoritative hub session snapshot or delta."
          : "Creates a local hub session with the command shown above."),
      severity: actionDiagnostic?.severity ?? (runningSession ? "success" : "info")
    },
    {
      key: "terminal",
      label: "Terminal",
      state: terminalDiagnostic ? stateLabel(terminalDiagnostic.severity) : "Ready",
      detail: terminalDiagnostic?.detail ?? "Terminal output destination: local hub session.",
      severity: terminalDiagnostic?.severity ?? "success"
    }
  ];
}

function packageSummary(packages: EntityRecord[], loadStatus: HubEntityLoadStatus): StatusSummary {
  if (loadStatus === "not_loaded" || loadStatus === "loading") {
    return {
      key: "packages",
      label: "Packages",
      state: loadStatus === "loading" ? "Loading" : "Not loaded",
      detail: "Package registry pull has not completed yet.",
      severity: "info"
    };
  }

  if (loadStatus === "error") {
    return {
      key: "packages",
      label: "Packages",
      state: "Error",
      detail: "Package registry pull failed.",
      severity: "danger"
    };
  }

  if (packages.length === 0) {
    return {
      key: "packages",
      label: "Packages",
      state: "Empty",
      detail: "Loaded package registry returned zero package records.",
      severity: "warning"
    };
  }

  const failedEntrypoints = packages.filter((record) => String(record.entrypoint_process_summary ?? "").includes(" failed"));
  return {
    key: "packages",
    label: "Packages",
    state: failedEntrypoints.length > 0 ? "Error" : "Loaded",
    detail: `${packages.length} package record${packages.length === 1 ? "" : "s"} loaded${
      failedEntrypoints.length > 0 ? `; ${failedEntrypoints.length} has failed entrypoint state.` : "."
    }`,
    severity: failedEntrypoints.length > 0 ? "danger" : "success"
  };
}

function sessionSummary(sessions: EntityRecord[], loadStatus: HubEntityLoadStatus): StatusSummary {
  if (loadStatus === "not_loaded" || loadStatus === "loading") {
    return {
      key: "sessions",
      label: "Sessions",
      state: loadStatus === "loading" ? "Loading" : "Not loaded",
      detail: "Session pull has not completed yet.",
      severity: "info"
    };
  }

  if (loadStatus === "error") {
    return {
      key: "sessions",
      label: "Sessions",
      state: "Error",
      detail: "Session pull failed.",
      severity: "danger"
    };
  }

  if (sessions.length === 0) {
    return {
      key: "sessions",
      label: "Sessions",
      state: "Empty",
      detail: "No sessions are loaded yet; start a local hub session to create one.",
      severity: "warning"
    };
  }

  const running = sessions.filter((record) => record.status === "running");
  const pending = sessions.filter((record) => record.status === "pending");
  return {
    key: "sessions",
    label: "Sessions",
    state: running.length > 0 ? "Running" : pending.length > 0 ? "Pending" : "Loaded",
    detail: pending.length > 0
      ? `${pending.length} client-local spawn pending; authoritative session state has not arrived yet.`
      : `${sessions.length} session record${sessions.length === 1 ? "" : "s"} loaded; ${running.length} running.`,
    severity: running.length > 0 ? "success" : "info"
  };
}

function highestSeverityDiagnostic(diagnostics: ConnectionDiagnostic[]): ConnectionDiagnostic | undefined {
  return [...diagnostics].sort((left, right) => severityRank(right.severity) - severityRank(left.severity))[0];
}

function severityRank(severity: ConnectionDiagnostic["severity"]) {
  if (severity === "danger") return 4;
  if (severity === "warning") return 3;
  if (severity === "success") return 2;
  return 1;
}

function stateLabel(severity: ConnectionDiagnostic["severity"]) {
  if (severity === "danger") return "Blocked";
  if (severity === "warning") return "Warning";
  if (severity === "success") return "Healthy";
  return "Info";
}

function spawnRequested(actionStatus: string) {
  return actionStatus.toLowerCase().includes("spawn requested");
}

function visibleStatusText(value: string): string {
  return value
    .replaceAll(realHubDogfoodSessionId, "local hub session")
    .replace(/dogfood/gi, "local");
}

function isSpawnDiagnostic(diagnostic: ConnectionDiagnostic) {
  return diagnostic.operation === "spawn" ||
    (diagnostic.actionId === "botster.session.select" && diagnostic.actionTarget === realHubDogfoodSessionId);
}

function badgeColor(severity: ConnectionDiagnostic["severity"]) {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "medium";
}
