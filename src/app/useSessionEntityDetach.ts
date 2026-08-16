/** Detach the mounted session route when the subscribed session entity is terminal. */

import { useEffect } from "react";

import {
  sessionEntityRequiresDetach,
  sessionRecordForRoute
} from "../botster/terminalSession";

export function useSessionEntityDetach(
  sessionId: string | undefined,
  entities: {
    get(family: string, id: string): Record<string, unknown> | undefined;
    list(family: string): Record<string, unknown>[];
  },
  hub: {
    onFrame(handler: (frame?: unknown) => void): () => void;
  },
  releaseTerminalSession: (sessionId: string) => void
): void {
  useEffect(() => {
    if (!sessionId) return;

    const tryRelease = () => {
      if (sessionEntityRequiresDetach(sessionRecordForRoute(entities, sessionId))) {
        releaseTerminalSession(sessionId);
      }
    };

    tryRelease();
    return hub.onFrame(tryRelease);
  }, [entities, hub, releaseTerminalSession, sessionId]);
}
