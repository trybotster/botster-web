/**
 * Web-owned semantic terminal input records.
 *
 * The browser produces these records from DOM events at the terminal container. They
 * carry the information the Core input schema needs (W3C `KeyboardEvent.code`, modifier
 * state, committed text, composition state, cell and pixel geometry) in browser terms.
 * The Hub terminal data plane maps them onto the Core-generated typed input commands.
 * Nothing in this module encodes bytes or names a Core enum value.
 */

export interface TerminalModifierState {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  super: boolean;
  capsLock: boolean;
  numLock: boolean;
}

export type TerminalKeyAction = "press" | "release" | "repeat";

export interface TerminalKeyInputEvent {
  kind: "key";
  action: TerminalKeyAction;
  /** W3C UI Events `KeyboardEvent.code` physical key name; empty when unknown. */
  code: string;
  /** DOM `KeyboardEvent.key` value; used for the unshifted codepoint and printable text. */
  key: string;
  mods: TerminalModifierState;
  /** Committed text for this event: a printable key, an IME commit, or an inserted string. */
  text: string;
  /** True while an IME composition is active for this event. */
  composing: boolean;
  /** Unshifted Unicode codepoint of the key when it is a single printable character, else 0. */
  unshiftedCodepoint: number;
}

export type TerminalMouseAction = "press" | "release" | "motion";

/** Browser button identity; the data plane maps it onto the Core button table. */
export type TerminalMouseButton =
  | "left"
  | "middle"
  | "right"
  | "back"
  | "forward"
  | "wheel_up"
  | "wheel_down"
  | "wheel_left"
  | "wheel_right";

export interface TerminalMouseInputEvent {
  kind: "mouse";
  action: TerminalMouseAction;
  button?: TerminalMouseButton;
  mods: TerminalModifierState;
  /** Zero-based grid cell under the pointer. */
  col: number;
  row: number;
  /** Pointer position in CSS pixels relative to the terminal canvas origin. */
  xPx: number;
  yPx: number;
}

export interface TerminalFocusInputEvent {
  kind: "focus";
  focused: boolean;
}

export interface TerminalResizeInputEvent {
  kind: "resize";
  rows: number;
  cols: number;
  widthPx: number;
  heightPx: number;
}

export interface TerminalPasteInputEvent {
  kind: "paste";
  text: string;
}

/** Explicit raw bytes. Only harness and diagnostics paths intend raw bytes. */
export interface TerminalRawInputEvent {
  kind: "raw";
  bytes: Uint8Array;
}

export type TerminalSemanticInput =
  | TerminalKeyInputEvent
  | TerminalMouseInputEvent
  | TerminalFocusInputEvent
  | TerminalResizeInputEvent
  | TerminalPasteInputEvent
  | TerminalRawInputEvent;

export interface TerminalCellGeometry {
  cols: number;
  rows: number;
  /** Canvas bounding rectangle in CSS pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Canvas backing-store pixels per CSS pixel on each axis, so pixel reports match RESIZE. */
  scaleX: number;
  scaleY: number;
}

export function modifiersFromEvent(event: {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  getModifierState?: (key: string) => boolean;
}): TerminalModifierState {
  return {
    shift: Boolean(event.shiftKey),
    ctrl: Boolean(event.ctrlKey),
    alt: Boolean(event.altKey),
    super: Boolean(event.metaKey),
    capsLock: event.getModifierState?.("CapsLock") === true,
    numLock: event.getModifierState?.("NumLock") === true
  };
}

/**
 * True for DOM key values that stand for a physical key rather than text, such as
 * "Enter", "ArrowLeft", or "Shift". A single UTF-16 code unit, or one surrogate pair, is text.
 */
export function isPrintableKeyValue(key: string): boolean {
  if (!key) return false;
  const codepoints = Array.from(key);
  return codepoints.length === 1;
}

/** Keys the browser reports while an IME or virtual keyboard owns the event. */
export function isCompositionPlaceholderKey(event: { key: string; keyCode?: number; isComposing?: boolean }): boolean {
  return (
    event.isComposing === true ||
    event.key === "Process" ||
    event.key === "Unidentified" ||
    event.key === "Dead" ||
    event.keyCode === 229
  );
}

/**
 * Text that a printable keydown commits without an IME. Control and command chords carry no
 * text: the worker encoder derives the byte from key and modifiers.
 */
export function committedTextForKeydown(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}): string {
  if (!isPrintableKeyValue(event.key)) return "";
  if (event.ctrlKey || event.metaKey) return "";
  return event.key;
}

/** The unshifted codepoint for a printable key, else 0. */
export function unshiftedCodepointForKeydown(event: { key: string; shiftKey: boolean }): number {
  if (!isPrintableKeyValue(event.key)) return 0;
  const lowered = event.shiftKey ? event.key.toLowerCase() : event.key;
  return lowered.codePointAt(0) ?? 0;
}

export function keyInputFromKeyboardEvent(
  event: KeyboardEvent,
  action: TerminalKeyAction
): TerminalKeyInputEvent {
  return {
    kind: "key",
    action,
    code: typeof event.code === "string" ? event.code : "",
    key: typeof event.key === "string" ? event.key : "",
    mods: modifiersFromEvent(event),
    text: action === "release" ? "" : committedTextForKeydown(event),
    composing: false,
    unshiftedCodepoint: unshiftedCodepointForKeydown(event)
  };
}

/** A committed IME string or an inserted string with no owning physical key. */
export function keyInputFromCommittedText(text: string, composing = false): TerminalKeyInputEvent {
  return {
    kind: "key",
    action: "press",
    code: "",
    key: "",
    mods: { shift: false, ctrl: false, alt: false, super: false, capsLock: false, numLock: false },
    text,
    composing,
    unshiftedCodepoint: 0
  };
}

export function mouseButtonFromPointerButton(button: number): TerminalMouseButton | undefined {
  switch (button) {
    case 0:
      return "left";
    case 1:
      return "middle";
    case 2:
      return "right";
    case 3:
      return "back";
    case 4:
      return "forward";
    default:
      return undefined;
  }
}

export interface TerminalPointerPosition {
  col: number;
  row: number;
  xPx: number;
  yPx: number;
}

/**
 * Zero-based cell and backing-store pixel position of a pointer within the canvas geometry.
 * Pixels use the same unit as the RESIZE pixel size (canvas backing store), matching Restty.
 */
export function pointerPositionInGeometry(
  event: { clientX: number; clientY: number },
  geometry: TerminalCellGeometry
): TerminalPointerPosition {
  const cssX = Math.max(0, event.clientX - geometry.left);
  const cssY = Math.max(0, event.clientY - geometry.top);
  const xPx = Math.round(cssX * (geometry.scaleX > 0 ? geometry.scaleX : 1));
  const yPx = Math.round(cssY * (geometry.scaleY > 0 ? geometry.scaleY : 1));
  if (geometry.width <= 0 || geometry.height <= 0 || geometry.cols <= 0 || geometry.rows <= 0) {
    return { col: 0, row: 0, xPx, yPx };
  }
  const col = Math.min(geometry.cols - 1, Math.max(0, Math.floor((cssX / geometry.width) * geometry.cols)));
  const row = Math.min(geometry.rows - 1, Math.max(0, Math.floor((cssY / geometry.height) * geometry.rows)));
  return { col, row, xPx, yPx };
}

export function mouseInputFromPointerEvent(
  event: PointerEvent | MouseEvent,
  action: TerminalMouseAction,
  geometry: TerminalCellGeometry
): TerminalMouseInputEvent {
  const position = pointerPositionInGeometry(event, geometry);
  const button = action === "motion" ? undefined : mouseButtonFromPointerButton(event.button);
  return {
    kind: "mouse",
    action,
    ...(button ? { button } : {}),
    mods: modifiersFromEvent(event),
    ...position
  };
}

/** Discrete wheel reports per browser wheel event, matching the mounted Restty burst cap. */
export const WHEEL_REPORTS_PER_BURST = 3;

/**
 * Convert a DOM wheel event delta into CSS pixels.
 * DOM_DELTA_PIXEL = 0, DOM_DELTA_LINE = 1, DOM_DELTA_PAGE = 2.
 */
export function wheelDeltaPixels(delta: number, deltaMode: number, cellSize: number, span: number): number {
  if (!delta || !Number.isFinite(delta)) return 0;
  const size = Math.max(1, cellSize);
  const count = Math.max(1, span);
  if (deltaMode === 1) return delta * size;
  if (deltaMode === 2) return delta * count * size;
  return delta;
}

/**
 * Accumulates wheel pixels per axis and yields whole-cell steps. The accumulator resets when
 * the direction changes, when the owner resets it, or when tracking stops.
 */
export class WheelStepAccumulator {
  private pendingY = 0;
  private pendingX = 0;

  reset(): void {
    this.pendingY = 0;
    this.pendingX = 0;
  }

  /**
   * Returns the whole steps for one event, capped per burst. A positive count with
   * `button` "wheel_down" or "wheel_right" scrolls forward; "wheel_up" or "wheel_left" scrolls back.
   */
  consume(
    event: { deltaX: number; deltaY: number; deltaMode: number },
    cellWidth: number,
    cellHeight: number,
    cols: number,
    rows: number
  ): Array<{ button: TerminalMouseButton; steps: number }> {
    const reports: Array<{ button: TerminalMouseButton; steps: number }> = [];
    const stepY = this.consumeAxis("y", wheelDeltaPixels(event.deltaY, event.deltaMode, cellHeight, rows), cellHeight, rows);
    if (stepY !== 0) {
      reports.push({ button: stepY < 0 ? "wheel_up" : "wheel_down", steps: Math.abs(stepY) });
    }
    const stepX = this.consumeAxis("x", wheelDeltaPixels(event.deltaX, event.deltaMode, cellWidth, cols), cellWidth, cols);
    if (stepX !== 0) {
      reports.push({ button: stepX < 0 ? "wheel_left" : "wheel_right", steps: Math.abs(stepX) });
    }
    return reports;
  }

  private consumeAxis(axis: "x" | "y", deltaPx: number, cellSize: number, span: number): number {
    if (!deltaPx) return 0;
    const size = Math.max(1, cellSize);
    let pending = axis === "y" ? this.pendingY : this.pendingX;
    if (pending !== 0 && Math.sign(pending) !== Math.sign(deltaPx)) pending = 0;
    pending += deltaPx;
    const rawSteps = Math.trunc(pending / size);
    const cap = Math.max(1, Math.min(WHEEL_REPORTS_PER_BURST, span || 24));
    const steps = Math.sign(rawSteps) * Math.min(Math.abs(rawSteps), cap);
    pending -= steps * size;
    if (axis === "y") this.pendingY = pending;
    else this.pendingX = pending;
    return steps;
  }
}
