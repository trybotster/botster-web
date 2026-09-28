/** Home dashboard: Hub-authoritative current sessions, plus ended rows when Hub lists them. */

import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { cubeOutline, serverOutline } from "ionicons/icons";

import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import {
  isAttachableSession,
  sessionDisplayStatus,
  sessionDisplayTitle,
  sessionFailure
} from "../botster/terminalSession";
import { SessionActionsMenu } from "./SessionActionsMenu";

/**
 * Recovery for a session that is no longer current: forget it (the Hub refuses a session that
 * is not terminal, and the refusal is shown), and for a failed one, start a new session.
 */
function SessionRecovery({
  sessionTitle,
  removing,
  onRemove,
  onNewSession
}: {
  sessionTitle: string;
  removing: boolean;
  onRemove: () => void;
  onNewSession?: () => void;
}) {
  return (
    <div className="session-recovery" slot="end" data-testid="session-recovery">
      <IonButton
        fill="outline"
        size="small"
        disabled={removing}
        aria-label={`Remove session ${sessionTitle}`}
        data-testid="session-remove"
        onClick={onRemove}
      >
        {removing ? "Removing…" : "Remove"}
      </IonButton>
      {onNewSession ? (
        <IonButton fill="clear" size="small" data-testid="session-new" onClick={onNewSession}>
          New session
        </IonButton>
      ) : null}
    </div>
  );
}

export function SessionListItem({
  session,
  stopping,
  onOpen,
  onStop,
  showActions = true,
  removing = false,
  onRemove,
  onNewSession
}: {
  session: Record<string, unknown>;
  stopping: boolean;
  onOpen: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
  showActions?: boolean;
  removing?: boolean;
  onRemove?: (sessionId: string) => void;
  onNewSession?: () => void;
}) {
  const sessionId = String(session.id);
  const attachable = isAttachableSession(session);
  const sessionTitle = sessionDisplayTitle(session);
  const failure = sessionFailure(session);
  return (
    <IonItem
      button={attachable}
      detail={false}
      onClick={() => attachable && onOpen(sessionId)}
    >
      <IonIcon icon={serverOutline} slot="start" aria-hidden="true" />
      <IonLabel>
        <h2>{sessionTitle}</h2>
        {failure ? (
          <p
            className="session-status-failed"
            data-testid="session-failure"
            data-session-id={sessionId}
            data-session-failure={failure.crashed ? "crashed" : "failed"}
          >
            {sessionDisplayStatus(session)}
          </p>
        ) : (
          <p>{sessionDisplayStatus(session)}</p>
        )}
      </IonLabel>
      {onRemove ? (
        <SessionRecovery
          sessionTitle={sessionTitle}
          removing={removing}
          onRemove={() => onRemove(sessionId)}
          onNewSession={failure ? onNewSession : undefined}
        />
      ) : null}
      {showActions ? (
        <SessionActionsMenu
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          stopping={stopping}
          onStop={() => onStop(sessionId)}
        />
      ) : null}
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
  endedSessions = [],
  attentionSessions = [],
  sessionLoadStatus,
  stoppingSessionIds,
  removingSessionIds = new Set<string>(),
  onOpenSession,
  onStopSession,
  onRemoveSession,
  onNavigateToApps,
  onNavigateToSpawnPoints
}: {
  sessions: Record<string, unknown>[];
  endedSessions?: Record<string, unknown>[];
  attentionSessions?: Record<string, unknown>[];
  sessionLoadStatus: HubEntityLoadStatus;
  stoppingSessionIds: ReadonlySet<string>;
  removingSessionIds?: ReadonlySet<string>;
  onOpenSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
  onRemoveSession?: (sessionId: string) => void;
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
                stopping={stoppingSessionIds.has(String(session.id))}
                onOpen={onOpenSession}
                onStop={onStopSession}
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
      {attentionSessions.length > 0 ? (
        <section
          className="workflow-section home-sessions"
          aria-labelledby="attention-sessions-heading"
          data-testid="dashboard-attention-sessions"
        >
          <div className="section-heading">
            <div>
              <h2 id="attention-sessions-heading">Needs attention</h2>
              <p className="page-description">The Hub cannot confirm these sessions are running.</p>
            </div>
            <IonBadge color="warning">{attentionSessions.length}</IonBadge>
          </div>
          <IonList lines="full" aria-label="Sessions that need attention">
            {attentionSessions.map((session) => (
              <SessionListItem
                key={String(session.id)}
                session={session}
                stopping={stoppingSessionIds.has(String(session.id))}
                showActions={false}
                removing={removingSessionIds.has(String(session.id))}
                onOpen={onOpenSession}
                onStop={onStopSession}
                onRemove={onRemoveSession}
                onNewSession={onNavigateToSpawnPoints}
              />
            ))}
          </IonList>
        </section>
      ) : null}
      {endedSessions.length > 0 ? (
        <section
          className="workflow-section home-sessions"
          aria-labelledby="ended-sessions-heading"
          data-testid="dashboard-ended-sessions"
        >
          <div className="section-heading">
            <div>
              <h2 id="ended-sessions-heading">Ended sessions</h2>
            </div>
            <IonBadge color="medium">{endedSessions.length}</IonBadge>
          </div>
          <IonList lines="full" aria-label="Ended sessions">
            {endedSessions.map((session) => (
              <SessionListItem
                key={String(session.id)}
                session={session}
                stopping={stoppingSessionIds.has(String(session.id))}
                showActions={false}
                removing={removingSessionIds.has(String(session.id))}
                onOpen={onOpenSession}
                onStop={onStopSession}
                onRemove={onRemoveSession}
                onNewSession={onNavigateToSpawnPoints}
              />
            ))}
          </IonList>
        </section>
      ) : null}
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
