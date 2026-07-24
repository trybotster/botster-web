export function isAttachableSession(
  record: Record<string, unknown> | undefined
): record is Record<string, unknown> & { id: string } {
  return Boolean(
    record &&
    typeof record.id === "string" &&
    record.status === "running" &&
    record.attachable === true
  );
}

export function resolveTerminalSessionId(
  sessions: Record<string, unknown>[],
  retainedSessionId?: string,
  attachedSessionId?: string
): string | undefined {
  const retainedSession = retainedSessionId
    ? sessions.find((session) => session.id === retainedSessionId)
    : undefined;
  if (
    retainedSession &&
    (retainedSessionId === attachedSessionId || isAttachableSession(retainedSession))
  ) {
    return retainedSessionId;
  }

  const attachableSession = sessions.find(isAttachableSession);
  return attachableSession ? String(attachableSession.id) : undefined;
}
