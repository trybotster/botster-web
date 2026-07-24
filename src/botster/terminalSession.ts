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
  retainedSessionId?: string
): string | undefined {
  if (retainedSessionId && sessions.some((session) => session.id === retainedSessionId)) {
    return retainedSessionId;
  }

  const attachableSession = sessions.find(isAttachableSession);
  return attachableSession ? String(attachableSession.id) : undefined;
}
