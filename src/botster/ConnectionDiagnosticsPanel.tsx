import { IonBadge } from "@ionic/react";

import type { ConnectionDiagnostic } from "./connectionDiagnostics";

export interface ConnectionDiagnosticsPanelProps {
  diagnostics: ConnectionDiagnostic[];
}

export function ConnectionDiagnosticsPanel({ diagnostics }: ConnectionDiagnosticsPanelProps) {
  const sortedDiagnostics = [...diagnostics].sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity)
  );

  return (
    <aside className="diagnostic-panel" aria-labelledby="diagnostics-heading">
      <div className="panel-heading">
        <h2 id="diagnostics-heading">Connection diagnostics</h2>
      </div>
      <div className="diagnostic-list">
        {sortedDiagnostics.map((diagnostic) => (
          <article
            className={`diagnostic-row ${diagnostic.severity}`}
            data-diagnostic-id={diagnostic.id}
            key={diagnostic.id}
          >
            <div className="diagnostic-title">
              <h3>{diagnostic.title}</h3>
              <IonBadge color={badgeColor(diagnostic.severity)}>
                {severityLabel(diagnostic.severity)} / {diagnostic.source}
              </IonBadge>
            </div>
            <p>{diagnostic.detail}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

function severityRank(severity: ConnectionDiagnostic["severity"]): number {
  if (severity === "danger") return 4;
  if (severity === "warning") return 3;
  if (severity === "success") return 2;
  return 1;
}

function severityLabel(severity: ConnectionDiagnostic["severity"]): string {
  if (severity === "danger") return "Blocked";
  if (severity === "warning") return "Warning";
  if (severity === "success") return "Healthy";
  return "Info";
}

function badgeColor(severity: ConnectionDiagnostic["severity"]): string {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "medium";
}
