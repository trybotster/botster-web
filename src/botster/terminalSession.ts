export function isAttachableSession(
  record: Record<string, unknown> | undefined
): record is Record<string, unknown> & { id: string } {
  return Boolean(
    record &&
    typeof record.id === "string" &&
    record.lifecycle === "running" &&
    record.lifecycle_class === "current"
  );
}

/** Hub-authored session lifecycle values that require the mounted terminal to detach. */
export function sessionEntityRequiresDetach(
  record: Record<string, unknown> | undefined
): boolean {
  return record?.lifecycle === "exited" || record?.lifecycle === "failed";
}

export function isMountedSessionRoute(
  route: { view?: string; sessionId?: string } | undefined,
  sessionId: string
): boolean {
  return route?.view === "session" && route.sessionId === sessionId;
}

export function sessionRecordForRoute(
  entities: {
    get(family: string, id: string): Record<string, unknown> | undefined;
    list(family: string): Record<string, unknown>[];
  },
  sessionId: string
): Record<string, unknown> | undefined {
  const exact = entities.get("session", sessionId);
  if (exact) return exact;
  return entities.list("session").find((record) =>
    record.id === sessionId ||
    record.session_uuid === sessionId ||
    record.session_id === sessionId
  );
}

export function sessionDisplayTitle(record: Record<string, unknown>): string {
  return typeof record.session_uuid === "string"
    ? record.session_uuid
    : String(record.id);
}

/**
 * The Hub-authored failure of a session: lifecycle "failed" with its failure_reason. A crash is
 * failure_reason "worker_lost" (the session's worker died without an exit report).
 */
export function sessionFailure(
  record: Record<string, unknown> | undefined
): { crashed: boolean; reason: string | undefined } | undefined {
  if (record?.lifecycle !== "failed") return undefined;
  const reason = typeof record.failure_reason === "string" && record.failure_reason.length > 0
    ? record.failure_reason
    : undefined;
  return { crashed: reason === "worker_lost", reason };
}

export function sessionDisplayStatus(record: Record<string, unknown>): string {
  const failure = sessionFailure(record);
  if (failure) {
    if (failure.crashed) return "Crashed: worker lost";
    return failure.reason ? `Failed: ${failure.reason}` : "Failed";
  }
  return typeof record.lifecycle_class === "string"
    ? record.lifecycle_class
    : "Unknown status";
}
