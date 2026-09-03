/** Dashboard session list projection from Hub-authored lifecycle_class. */

import type { EntityRecord } from "../botster/entities";

/**
 * Dashboard current rows show only Hub-authored current sessions.
 * Web does not infer lifecycle from raw lifecycle, registry_state, or local heuristics.
 */
export function currentDashboardSessions(sessions: EntityRecord[]): EntityRecord[] {
  return sessions.filter((session) => session.lifecycle_class === "current");
}

/**
 * Dashboard ended rows show only Hub-authored ended sessions.
 * Web does not infer lifecycle from raw lifecycle, registry_state, or local heuristics.
 */
export function endedDashboardSessions(sessions: EntityRecord[]): EntityRecord[] {
  return sessions.filter((session) => session.lifecycle_class === "ended");
}
