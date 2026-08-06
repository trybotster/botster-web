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
