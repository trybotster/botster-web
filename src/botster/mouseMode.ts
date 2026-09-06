/**
 * Mouse capture policy from the authoritative Core MODES frame. The bit table is the
 * generated `ModeBits`; nothing here names a bit value.
 */

import { decodeModeFlags } from "./generated/terminal-protocol";
import type { TerminalModes } from "./terminal";
import type { TerminalMouseCapturePolicy } from "./terminalInputCapture";

export function mouseCapturePolicyFromModes(modes: TerminalModes): TerminalMouseCapturePolicy {
  const flags = decodeModeFlags(modes.modeBits);
  const tracking = flags.mouse_normal || flags.mouse_button || flags.mouse_any;
  return {
    tracking,
    dragMotion: flags.mouse_button || flags.mouse_any,
    anyMotion: flags.mouse_any
  };
}
