/** Hub session action bindings. */

import type { ActionBinding } from "../botster/actions";

export function stopSessionAction(sessionId: string): ActionBinding {
  return {
    id: "botster.session.stop",
    target: sessionId,
    label: "Stop session"
  };
}
