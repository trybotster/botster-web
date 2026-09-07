/** User-visible text for terminal input outcomes. Kept outside the component module. */

import type { TerminalInputOperationKind, TerminalInputOutcome } from "./terminal";

const operationLabels: Record<TerminalInputOperationKind, string> = {
  raw: "Input",
  key: "Key input",
  mouse: "Mouse input",
  focus: "Focus report",
  resize: "Resize",
  paste: "Paste"
};

export function terminalInputSize(outcome: TerminalInputOutcome): string {
  return outcome.requestedBytes !== undefined ? `${outcome.requestedBytes} bytes` : "the input";
}

export function terminalInputMessage(outcome: TerminalInputOutcome): string {
  const label = operationLabels[outcome.kind];
  const written =
    outcome.writtenPtyBytes !== undefined ? ` ${outcome.writtenPtyBytes} PTY bytes were written.` : "";
  switch (outcome.outcome) {
    case "written":
      return outcome.detail;
    case "partial_write":
      // writtenPtyBytes counts PTY bytes, which include encoder-added bytes such as
      // bracketed-paste markers, so it is never presented as "N of M" against the input size.
      return `${label} partially delivered (${outcome.writtenPtyBytes ?? 0} PTY bytes written for ${terminalInputSize(outcome)}): ${outcome.detail}`;
    case "write_failed":
      return `${label} failed: ${outcome.detail}`;
    case "cancelled":
      return `${label} cancelled before delivery finished.${written} ${outcome.detail}`.trim();
    case "rejected_not_writable":
      return `${label} rejected: the terminal is not writable. ${outcome.detail}`.trim();
    case "rejected_too_large":
      return `${label} rejected: ${terminalInputSize(outcome)} exceeds the limit. ${outcome.detail}`.trim();
    case "rejected_unsafe_paste":
      if (outcome.unsafePasteConsent) {
        return `Paste was not sent. Multiline or control input can execute commands. Confirm ${terminalInputSize(outcome)} only if you trust the clipboard source.`;
      }
      return `Paste rejected: the clipboard text contains control sequences the terminal considers unsafe. ${outcome.detail}`.trim();
    case "rejected_lane_full":
      return `${label} rejected: too many input operations are in flight. ${outcome.detail}`.trim();
    case "rejected_protocol":
      return `${label} rejected by the terminal protocol: ${outcome.detail}`;
    case "session_ended":
      return `${label} not delivered: the session has ended.`;
    case "outcome_unknown":
      return `${label} delivery unknown: ${outcome.detail}`;
    case "rejected_locally":
      return `${label} rejected (${outcome.reason ?? "local"}): ${outcome.detail}`;
  }
}
