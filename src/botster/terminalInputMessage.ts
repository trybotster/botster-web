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
      return `Paste partially delivered (${outcome.deliveredBytes} of ${terminalInputSize(outcome)}): ${outcome.detail}`;
    case "cancelled":
      return `Paste cancelled before delivery: ${outcome.detail}`;
    case "unknown":
      return `Paste delivery unknown: ${outcome.detail}`;
    case "admitted":
      return outcome.detail;
  }
}
