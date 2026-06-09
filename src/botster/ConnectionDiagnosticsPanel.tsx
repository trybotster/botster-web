import { IonBadge } from "@ionic/react";

import type { ConnectionDiagnostic } from "./connectionDiagnostics";

export interface ConnectionDiagnosticsPanelProps {
  diagnostics: ConnectionDiagnostic[];
}

export function ConnectionDiagnosticsPanel({ diagnostics }: ConnectionDiagnosticsPanelProps) {
  return (
    <aside className="diagnostic-panel" aria-labelledby="diagnostics-heading">
      <div className="panel-heading">
        <h2 id="diagnostics-heading">Connection diagnostics</h2>
      </div>
      <div className="diagnostic-list">
        {diagnostics.map((diagnostic) => (
          <article
            className={`diagnostic-row ${diagnostic.severity}`}
            data-diagnostic-id={diagnostic.id}
            key={diagnostic.id}
          >
            <div className="diagnostic-title">
              <h3>{diagnostic.title}</h3>
              <IonBadge color={badgeColor(diagnostic.severity)}>{diagnostic.source}</IonBadge>
            </div>
            <p>{diagnostic.detail}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

function badgeColor(severity: ConnectionDiagnostic["severity"]): string {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "medium";
}
