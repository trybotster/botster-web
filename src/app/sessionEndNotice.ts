/**
 * The notice shown when a mounted session route is released. A crash can be learned from the
 * terminal close reason or from the session entity, in either order (the Hub closes the data
 * channel and reports the close event on separate paths), so the notice of a released session
 * may be upgraded to "crashed" later. It is never downgraded, and only the same session can
 * upgrade it.
 */

import type { TerminalAttachmentStatus } from "../botster/terminal";
import { sessionFailure } from "../botster/terminalSession";

export type SessionEndNotice = {
  sessionId: string;
  kind: "crashed" | "failed" | "ended";
  message: string;
  color: "danger" | "medium";
};

function crashedNotice(sessionId: string): SessionEndNotice {
  return {
    sessionId,
    kind: "crashed",
    message: `Session ${sessionId} crashed: its worker process was lost.`,
    color: "danger"
  };
}

export function sessionEndNotice(
  sessionId: string,
  status?: TerminalAttachmentStatus,
  sessionEntity?: Record<string, unknown>
): SessionEndNotice {
  const failure = sessionFailure(sessionEntity);
  if (failure?.crashed || status?.closeReason === "worker_lost") return crashedNotice(sessionId);
  if (status?.state === "failed") return { sessionId, kind: "failed", message: status.message, color: "danger" };
  if (failure) {
    return {
      sessionId,
      kind: "failed",
      message: failure.reason ? `Session ${sessionId} failed: ${failure.reason}.` : `Session ${sessionId} failed.`,
      color: "danger"
    };
  }
  return { sessionId, kind: "ended", message: `Session ${sessionId} ended`, color: "medium" };
}

/**
 * The notice after a later session entity for `sessionId`: the crash notice when that entity
 * reports a crash for the session the current notice is about, otherwise the current notice.
 */
export function upgradeSessionEndNotice(
  current: SessionEndNotice | undefined,
  sessionId: string,
  sessionEntity: Record<string, unknown> | undefined
): SessionEndNotice | undefined {
  if (!current || current.sessionId !== sessionId || current.kind === "crashed") return current;
  return sessionFailure(sessionEntity)?.crashed ? crashedNotice(sessionId) : current;
}

/** Operator harness record of each shown notice (the live lane reads it); production has none. */
export function recordSessionEndNotice(notice: SessionEndNotice): void {
  if (typeof window === "undefined") return;
  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: { events?: Array<{ kind: string; payload: unknown }> };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.events?.push({ kind: "session_end_notice", payload: { ...notice } });
}
