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

export function sessionDisplayStatus(record: Record<string, unknown>): string {
  return typeof record.lifecycle_class === "string"
    ? record.lifecycle_class
    : "Unknown status";
}
