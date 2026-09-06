/**
 * Maps Web semantic input records onto the Core-generated scheme 2 input encoders.
 *
 * Every table value comes from the generated artifact: physical keys by W3C `code`,
 * modifier bits, and mouse buttons. This module owns only the browser-to-Core naming.
 */

import {
  encodeFocus,
  encodeKey,
  encodeMouse,
  encodePaste,
  encodeRawBytes,
  encodeResize,
  terminalKeyFromCode,
  TerminalMods,
  type OperationId,
  type TerminalMouseButtonName
} from "./generated/terminal-protocol";
import type {
  TerminalModifierState,
  TerminalMouseButton,
  TerminalSemanticInput
} from "./terminalInputEvents";

/** One input operation whose frames are produced once the data plane assigns its id. */
export interface EncodedInputOperation {
  /** Client payload bytes the operation carries, for local queue accounting. */
  bodyBytes: number;
  frames(operationId: OperationId): Uint8Array[];
}

export function terminalModsBits(mods: TerminalModifierState): number {
  let bits = 0;
  if (mods.shift) bits |= TerminalMods.SHIFT;
  if (mods.ctrl) bits |= TerminalMods.CTRL;
  if (mods.alt) bits |= TerminalMods.ALT;
  if (mods.super) bits |= TerminalMods.SUPER;
  if (mods.capsLock) bits |= TerminalMods.CAPS_LOCK;
  if (mods.numLock) bits |= TerminalMods.NUM_LOCK;
  return bits;
}

export function terminalMouseButtonName(button: TerminalMouseButton | undefined): TerminalMouseButtonName | null {
  switch (button) {
    case "left":
      return "left";
    case "middle":
      return "middle";
    case "right":
      return "right";
    case "back":
      return "button8";
    case "forward":
      return "button9";
    case "wheel_up":
      return "wheel_up";
    case "wheel_down":
      return "wheel_down";
    case "wheel_left":
      return "wheel_left";
    case "wheel_right":
      return "wheel_right";
    default:
      return null;
  }
}

/**
 * Modifiers the browser already applied to produce `text`. Shift that changed the
 * unshifted codepoint into the committed character is consumed; the worker encoder then
 * does not report it a second time.
 */
function consumedModsForKey(input: Extract<TerminalSemanticInput, { kind: "key" }>, mods: number): number {
  if (!input.text || !input.mods.shift) return 0;
  const textCodepoint = input.text.codePointAt(0) ?? 0;
  return textCodepoint !== input.unshiftedCodepoint ? mods & TerminalMods.SHIFT : 0;
}

export function encodeSemanticInput(input: TerminalSemanticInput): EncodedInputOperation | undefined {
  switch (input.kind) {
    case "raw":
      return {
        bodyBytes: input.bytes.byteLength,
        frames: (operationId) => [encodeRawBytes(operationId, input.bytes)]
      };
    case "key": {
      const mods = terminalModsBits(input.mods);
      const text = input.text;
      return {
        bodyBytes: 12 + text.length,
        frames: (operationId) => [
          encodeKey(operationId, {
            action: input.action,
            key: input.code ? terminalKeyFromCode(input.code) : terminalKeyFromCode("Unidentified"),
            mods,
            consumed_mods: consumedModsForKey(input, mods),
            composing: input.composing,
            unshifted_codepoint: input.unshiftedCodepoint,
            text
          })
        ]
      };
    }
    case "mouse":
      return {
        bodyBytes: 17,
        frames: (operationId) => [
          encodeMouse(operationId, {
            action: input.action,
            button: terminalMouseButtonName(input.button),
            mods: terminalModsBits(input.mods),
            col: input.col,
            row: input.row,
            x_px: input.xPx,
            y_px: input.yPx
          })
        ]
      };
    case "focus":
      return {
        bodyBytes: 1,
        frames: (operationId) => [encodeFocus(operationId, input.focused)]
      };
    case "resize":
      return {
        bodyBytes: 12,
        frames: (operationId) => [encodeResize(operationId, input.rows, input.cols, input.widthPx, input.heightPx)]
      };
    case "paste":
      return encodePasteOperation(new TextEncoder().encode(input.text));
  }
}

/** One paste: PASTE_BEGIN, ordered chunks, PASTE_COMMIT under one operation id. */
export function encodePasteOperation(data: Uint8Array, allowUnsafe = false): EncodedInputOperation {
  return {
    bodyBytes: data.byteLength,
    frames: (operationId) => encodePaste(operationId, allowUnsafe, data)
  };
}
