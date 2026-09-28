/** Hub session action bindings. */

import type { ActionBinding } from "../botster/actions";

export function stopSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.stop",
    target: sessionId,
    label: "Stop session"
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
