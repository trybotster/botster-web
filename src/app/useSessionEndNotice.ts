/** The notice of the last released session route, and its later upgrade to a crash notice. */

import { useCallback, useEffect, useRef } from "react";

import type { TerminalAttachmentStatus } from "../botster/terminal";
import { sessionRecordForRoute } from "../botster/terminalSession";
import {
  recordSessionEndNotice,
  sessionEndNotice,
  upgradeSessionEndNotice,
  type SessionEndNotice
} from "./sessionEndNotice";

type SessionEntities = {
  get(family: string, id: string): Record<string, unknown> | undefined;
  list(family: string): Record<string, unknown>[];
};

/**
 * `release` shows the notice for a released session. One frame listener, for the life of the
 * hook, upgrades the CURRENT notice when its own session's entity reports a crash: the listener
 * reads the current notice at the moment of each frame, so a session released earlier can never
 * change the notice (or the toast) of a session released later.
 */
export function useSessionEndNotice(options: {
  entities: SessionEntities;
  hub: { onFrame(handler: (frame?: unknown) => void): () => void };
  showToast: (toast: { message: string; color: string }) => void;
}): { release: (sessionId: string, status?: TerminalAttachmentStatus) => SessionEndNotice } {
  const { entities, hub, showToast } = options;
  const currentNotice = useRef<SessionEndNotice | undefined>(undefined);

  const show = useCallback((notice: SessionEndNotice) => {
    currentNotice.current = notice;
    recordSessionEndNotice(notice);
    showToast({ message: notice.message, color: notice.color });
  }, [showToast]);

  const release = useCallback((sessionId: string, status?: TerminalAttachmentStatus) => {
    const notice = sessionEndNotice(sessionId, status, sessionRecordForRoute(entities, sessionId));
    show(notice);
    return notice;
  }, [entities, show]);

  useEffect(() => hub.onFrame(() => {
    const current = currentNotice.current;
    if (!current || current.kind === "crashed") return;
    const next = upgradeSessionEndNotice(current, current.sessionId, sessionRecordForRoute(entities, current.sessionId));
    if (next && next !== current) show(next);
  }), [entities, hub, show]);

  return { release };
}
