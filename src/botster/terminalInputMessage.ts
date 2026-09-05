/** User-visible text for terminal input outcomes. Kept outside the component module. */

import type { TerminalInputOutcome } from "./terminal";

export function terminalInputSize(outcome: TerminalInputOutcome): string {
  return outcome.requestedBytes !== undefined
    ? `${outcome.requestedBytes} bytes`
    : `at least ${outcome.minimumBytes} bytes`;
}

export function terminalInputMessage(outcome: TerminalInputOutcome): string {
  switch (outcome.outcome) {
    case "rejected":
      return `Paste rejected (${outcome.reason}): ${outcome.detail}`;
    case "partial":
      // deliveredBytes counts PTY bytes, which include Core's bracketed-paste markers, so it
      // is never presented as "N of M" against the clipboard size.
      return `Paste partially delivered (${outcome.deliveredBytes} PTY bytes written for ${terminalInputSize(outcome)} of clipboard text): ${outcome.detail}`;
    case "cancelled":
      return `Paste cancelled before delivery: ${outcome.detail}`;
    case "unknown":
      return `Paste delivery unknown: ${outcome.detail}`;
    case "admitted":
      return outcome.detail;
  }
}
