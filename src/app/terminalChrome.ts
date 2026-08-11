/** Session terminal chrome helpers. Terminal truth remains Hub-owned. */

import type { TerminalAttachmentStatus, TerminalViewDescriptor } from "../botster/terminal";

const terminalRenderer = "restty" as const;

export function terminalDescriptorForSessionId(sessionId: string | undefined): TerminalViewDescriptor | undefined {
  return sessionId ? { sessionId, renderer: terminalRenderer } : undefined;
}

export function terminalReleaseToast(
  sessionId: string,
  status?: TerminalAttachmentStatus
): { message: string; color: "danger" | "medium" } {
  return status?.state === "failed"
    ? { message: status.message, color: "danger" }
    : { message: `Session ${sessionId} ended`, color: "medium" };
}
