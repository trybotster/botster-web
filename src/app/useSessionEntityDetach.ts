/** Detach the mounted session route when the subscribed session entity is terminal. */

import { useEffect } from "react";

import { sessionEntityRequiresDetach } from "../botster/terminalSession";

export function useSessionEntityDetach(
  sessionId: string | undefined,
  sessionRecord: Record<string, unknown> | undefined,
  releaseTerminalSession: (sessionId: string) => void
): void {
  const requiresDetach = sessionEntityRequiresDetach(sessionRecord);

  useEffect(() => {
    if (!sessionId || !requiresDetach) return;
    releaseTerminalSession(sessionId);
  }, [sessionId, requiresDetach, releaseTerminalSession]);
}
