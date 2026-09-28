/** Session terminal chrome helpers. Terminal truth remains Hub-owned. */

import type { TerminalViewDescriptor } from "../botster/terminal";

const terminalRenderer = "restty" as const;

export function terminalDescriptorForSessionId(sessionId: string | undefined): TerminalViewDescriptor | undefined {
  return sessionId ? { sessionId, renderer: terminalRenderer } : undefined;
}
