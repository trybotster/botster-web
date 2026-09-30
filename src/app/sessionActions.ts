/** Hub session action bindings. */

import type { ActionBinding } from "../botster/actions";
import { readRecord } from "./values";

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

/**
 * True only when the Hub advertises the `session_restart` feature in its Hello compatibility
 * features. Strict, unlike the session-type check: with no Hub status yet, or a missing,
 * malformed or empty feature list, Restart is unsupported, so the client never infers the
 * capability from the Hub's silence. A Hub without the feature would refuse the request anyway.
 */
export function sessionRestartSupported(hubStatus: Record<string, unknown> | undefined): boolean {
  if (hubStatus === undefined) return false;
  const features = readRecord(hubStatus.compatibility).features;
  return Array.isArray(features) && features.includes("session_restart");
}

/** Forget an ended session (Hub remove_session; the Hub refuses a session that is not terminal). */
export function removeSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.remove",
    target: sessionId,
    label: "Remove session"
  };
}
