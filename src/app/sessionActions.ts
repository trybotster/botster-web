/** Hub session action bindings. */

import type { ActionBinding } from "../botster/actions";

export function stopSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.stop",
    target: sessionId,
    label: "Stop session"
  };
}

/**
 * Start an ended session again under the same id (Hub restart_session). The Hub offers this only
 * for a session entity with `restartable` true, and refuses any other session with a typed code.
 */
export function restartSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.restart",
    target: sessionId,
    label: "Restart session"
  };
}

/** Forget an ended session (Hub remove_session; the Hub refuses a session that is not terminal). */
export function removeSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.remove",
    target: sessionId,
    label: "Remove session"
  };
}
