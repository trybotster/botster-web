/** Home dashboard: Hub-authoritative current sessions only. */

import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { cubeOutline, serverOutline } from "ionicons/icons";

import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import {
  isAttachableSession,
  sessionDisplayStatus,
  sessionDisplayTitle
} from "../botster/terminalSession";

export function SessionListItem({
  session,
  onOpen
}: {
  session: Record<string, unknown>;
  onOpen: (sessionId: string) => void;
}) {
  const sessionId = String(session.id);
  const attachable = isAttachableSession(session);
  return (
    <IonItem>
      <IonIcon icon={serverOutline} slot="start" aria-hidden="true" />
      <IonLabel>
        <h2>{sessionDisplayTitle(session)}</h2>
        <p>{sessionDisplayStatus(session)}</p>
      </IonLabel>
      {attachable ? <IonButton slot="end" fill="outline" onClick={() => onOpen(sessionId)}>Open</IonButton> : null}
    </IonItem>
  );
}

/**
 * Dashboard (Home) view. Extracted for export-for-contract so detach oracle unit tests
 * can prove data-testid="dashboard-view" against real rendered product markup.
 * Behavior-neutral structural extraction — App renders the same tree via this component.
 */
export function DashboardView({
  sessions,
  sessionLoadStatus,
  onOpenSession,
  onNavigateToApps,
  onNavigateToSpawnPoints
}: {
  sessions: Record<string, unknown>[];
  sessionLoadStatus: HubEntityLoadStatus;
  onOpenSession: (sessionId: string) => void;
  onNavigateToApps: () => void;
  onNavigateToSpawnPoints: () => void;
}) {
  return (
    <section className="view-stack" aria-labelledby="dashboard-heading" data-testid="dashboard-view">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Local hub</p>
          <h1 id="dashboard-heading">Your sessions</h1>
          <p>Return to work already running on this device.</p>
        </div>
      </section>
      <section className="workflow-section home-sessions" aria-labelledby="recent-sessions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent work</p>
            <h2 id="recent-sessions-heading">Sessions</h2>
          </div>
          <IonBadge color="medium">{sessions.length}</IonBadge>
        </div>
        {sessionLoadStatus === "error" ? (
          <p className="entity-empty">Sessions could not be loaded. Open Hub settings for connection details.</p>
        ) : sessions.length > 0 ? (
          <IonList lines="full" aria-label="Sessions">
            {sessions.map((session) => (
              <SessionListItem
                key={String(session.id)}
                session={session}
                onOpen={onOpenSession}
              />
            ))}
          </IonList>
        ) : (
          <div className="home-empty-state">
            <h3>No sessions yet</h3>
            <p>Choose a spawn point to get ready for your first session.</p>
            <IonButton fill="outline" size="small" onClick={onNavigateToSpawnPoints}>
              View spawn points
            </IonButton>
          </div>
        )}
      </section>
      <div className="home-shortcuts" aria-label="Set up Botster">
        <button type="button" onClick={onNavigateToApps}>
          <IonIcon icon={cubeOutline} aria-hidden="true" />
          <span><strong>Apps</strong><small>Open installed tools and extensions</small></span>
        </button>
        <button type="button" onClick={onNavigateToSpawnPoints}>
          <IonIcon icon={serverOutline} aria-hidden="true" />
          <span><strong>Spawn points</strong><small>Choose where sessions can run</small></span>
        </button>
      </div>
    </section>
  );
}
