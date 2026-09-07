/**
 * Container-level terminal input capture.
 *
 * Restty keeps receiving the DOM events for its local behavior: selection, local scrollback,
 * IME preedit display, copy shortcuts, and search. Restty's own key and mouse encoders are
 * render-only in Botster: the PTY transport sink drops their bytes. This module observes the
 * same DOM events in the capture phase at the terminal container and produces one Web
 * semantic input record per user gesture, so the worker's Ghostty encoder receives every
 * key press, release, repeat, IME commit, pointer, wheel, and focus change exactly once.
 *
 * Clipboard paste is the one gesture this module consumes: it is default-prevented and
 * stopped before Restty's paste handler, so paste never becomes key input.
 *
 * Only events whose target is the terminal input surface are captured: the container
 * itself, Restty's pane canvas, and Restty's IME textarea. Restty's local widgets inside the
 * container, such as the search bar and the context menu, keep their events local.
 */

import {
  isCompositionPlaceholderKey,
  keyInputFromCommittedText,
  keyInputFromKeyboardEvent,
  modifiersFromEvent,
  mouseInputFromPointerEvent,
  pointerPositionInGeometry,
  WheelStepAccumulator,
  type TerminalCellGeometry,
  type TerminalMouseInputEvent,
  type TerminalSemanticInput
} from "./terminalInputEvents";

/** Mouse capture policy derived from the authoritative Core MODES frame. */
export interface TerminalMouseCapturePolicy {
  /** Any mouse tracking mode is enabled: press and release reports are wanted. */
  tracking: boolean;
  /** Motion with a button held is wanted (button-event or any-event tracking). */
  dragMotion: boolean;
  /** Motion without a button is wanted (any-event tracking). */
  anyMotion: boolean;
}

export const noMouseCapture: TerminalMouseCapturePolicy = Object.freeze({
  tracking: false,
  dragMotion: false,
  anyMotion: false
});

/**
 * Restty's own input-target predicate accepts its IME textarea by these class names; the
 * pane canvas receives pointer and wheel gestures; the container receives keyboard focus
 * before a pane exists.
 */
const terminalInputSurfaceClasses = ["pane-ime-input", "restty-pane-ime-input", "pane-canvas"];

export function isTerminalInputSurface(container: HTMLElement, target: EventTarget | null): boolean {
  if (target === container) return true;
  const classList = (target as { classList?: DOMTokenList } | null)?.classList;
  if (!classList || typeof classList.contains !== "function") return false;
  return terminalInputSurfaceClasses.some((name) => classList.contains(name));
}

export interface TerminalInputCaptureOptions {
  container: HTMLElement;
  /** Receives one semantic record per gesture; the data plane orders and encodes them. */
  sink: (input: TerminalSemanticInput) => void;
  /** Clipboard text consumed at the container; returns after the paste owner takes it. */
  onPaste: (text: string, source: "clipboard_event" | "beforeinput") => void;
  /** Current canvas geometry for cell and pixel mapping. */
  geometry: () => TerminalCellGeometry | undefined;
  /** Authoritative mouse capture policy from the latest MODES frame. */
  mousePolicy: () => TerminalMouseCapturePolicy;
  /** Records diagnostics only when a harness recorder is installed. */
  record?: (kind: string, payload: unknown) => void;
}

/** Window after a printable keydown in which a matching `insertText` is the same gesture. */
export const KEYDOWN_INSERT_TEXT_DEDUPE_MS = 100;

export interface TerminalInputCapture {
  uninstall(): void;
  /** Clears wheel accumulation; called when tracking changes or the attachment resets. */
  resetWheel(): void;
}

export function installTerminalInputCapture(options: TerminalInputCaptureOptions): TerminalInputCapture {
  const { container, sink, onPaste, geometry, mousePolicy } = options;
  const record = options.record ?? (() => undefined);
  const wheel = new WheelStepAccumulator();
  let composing = false;
  let lastPrintableKeydown: { text: string; at: number } | undefined;
  let heldButtons = 0;

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const onSurface = (event: Event): boolean => isTerminalInputSurface(container, event.target);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!onSurface(event)) return;
    if (isCompositionPlaceholderKey(event)) {
      // The IME or virtual keyboard owns this gesture; its text arrives through
      // beforeinput or compositionend.
      return;
    }
    const input = keyInputFromKeyboardEvent(event, event.repeat ? "repeat" : "press");
    if (input.text) {
      lastPrintableKeydown = { text: input.text, at: now() };
    } else {
      lastPrintableKeydown = undefined;
    }
    sink(input);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!onSurface(event) || isCompositionPlaceholderKey(event)) return;
    sink(keyInputFromKeyboardEvent(event, "release"));
  };

  const onCompositionStart = (event: CompositionEvent) => {
    if (!onSurface(event)) return;
    composing = true;
    lastPrintableKeydown = undefined;
  };

  const onCompositionEnd = (event: CompositionEvent) => {
    if (!onSurface(event)) return;
    composing = false;
    const text = event.data ?? "";
    if (text) {
      // Chromium may also fire beforeinput insertCompositionText; the commit is this event.
      lastPrintableKeydown = { text, at: now() };
      sink(keyInputFromCommittedText(text, false));
    }
  };

  const onBeforeInput = (event: Event) => {
    if (!onSurface(event)) return;
    const input = event as InputEvent;
    if (input.inputType === "insertFromPaste") {
      const text = input.dataTransfer?.getData("text/plain") ?? input.data ?? "";
      if (!text) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      record("clipboard_paste", { source: "beforeinput", chars: text.length });
      onPaste(text, "beforeinput");
      return;
    }
    if (composing || input.isComposing || input.inputType === "insertCompositionText") return;
    if (input.inputType !== "insertText") return;
    const text = input.data ?? "";
    if (!text) return;
    const last = lastPrintableKeydown;
    if (last && last.text === text && now() - last.at <= KEYDOWN_INSERT_TEXT_DEDUPE_MS) {
      // The keydown already carried this printable text.
      lastPrintableKeydown = undefined;
      return;
    }
    // Text with no owning keydown: dictation, virtual keyboards, or autocomplete.
    sink(keyInputFromCommittedText(text, false));
  };

  const onPasteEvent = (event: ClipboardEvent) => {
    if (!onSurface(event)) return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    record("clipboard_paste", { source: "clipboard_event", chars: text.length });
    onPaste(text, "clipboard_event");
  };

  const pointerGeometry = (): TerminalCellGeometry | undefined => geometry();

  const emitMouse = (
    event: PointerEvent | MouseEvent,
    action: TerminalMouseInputEvent["action"]
  ): void => {
    const cells = pointerGeometry();
    if (!cells) return;
    sink(mouseInputFromPointerEvent(event, action, cells));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!onSurface(event)) return;
    heldButtons = event.buttons;
    const policy = mousePolicy();
    // Shift holds the pointer for local selection, matching Restty's own routing.
    if (!policy.tracking || event.shiftKey) return;
    emitMouse(event, "press");
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!onSurface(event)) return;
    const wasHeld = heldButtons !== 0;
    heldButtons = event.buttons;
    const policy = mousePolicy();
    if (!policy.tracking || event.shiftKey || !wasHeld) return;
    emitMouse(event, "release");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!onSurface(event)) return;
    const policy = mousePolicy();
    if (!policy.tracking || event.shiftKey) return;
    const held = event.buttons !== 0;
    if (held ? !policy.dragMotion : !policy.anyMotion) return;
    emitMouse(event, "motion");
  };

  const onWheel = (event: WheelEvent) => {
    if (!onSurface(event)) return;
    const policy = mousePolicy();
    if (!policy.tracking || event.shiftKey) {
      // Local scrollback: Restty scrolls its own viewport.
      wheel.reset();
      return;
    }
    const cells = pointerGeometry();
    if (!cells || cells.cols <= 0 || cells.rows <= 0) return;
    const cellWidth = cells.width / cells.cols;
    const cellHeight = cells.height / cells.rows;
    const reports = wheel.consume(event, cellWidth, cellHeight, cells.cols, cells.rows);
    if (reports.length === 0) return;
    const position = pointerPositionInGeometry(event, cells);
    const mods = modifiersFromEvent(event);
    for (const report of reports) {
      for (let step = 0; step < report.steps; step += 1) {
        sink({ kind: "mouse", action: "press", button: report.button, mods, ...position });
      }
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    if (!onSurface(event)) return;
    sink({ kind: "focus", focused: true });
  };

  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && container.contains(next)) return;
    composing = false;
    heldButtons = 0;
    sink({ kind: "focus", focused: false });
  };

  const capture = true;
  container.addEventListener("keydown", onKeyDown, capture);
  container.addEventListener("keyup", onKeyUp, capture);
  container.addEventListener("compositionstart", onCompositionStart, capture);
  container.addEventListener("compositionend", onCompositionEnd, capture);
  container.addEventListener("beforeinput", onBeforeInput, capture);
  container.addEventListener("paste", onPasteEvent, capture);
  container.addEventListener("pointerdown", onPointerDown, capture);
  container.addEventListener("pointerup", onPointerUp, capture);
  container.addEventListener("pointermove", onPointerMove, capture);
  container.addEventListener("wheel", onWheel, { capture, passive: true });
  container.addEventListener("focusin", onFocusIn, capture);
  container.addEventListener("focusout", onFocusOut, capture);

  return {
    uninstall() {
      container.removeEventListener("keydown", onKeyDown, capture);
      container.removeEventListener("keyup", onKeyUp, capture);
      container.removeEventListener("compositionstart", onCompositionStart, capture);
      container.removeEventListener("compositionend", onCompositionEnd, capture);
      container.removeEventListener("beforeinput", onBeforeInput, capture);
      container.removeEventListener("paste", onPasteEvent, capture);
      container.removeEventListener("pointerdown", onPointerDown, capture);
      container.removeEventListener("pointerup", onPointerUp, capture);
      container.removeEventListener("pointermove", onPointerMove, capture);
      container.removeEventListener("wheel", onWheel, capture);
      container.removeEventListener("focusin", onFocusIn, capture);
      container.removeEventListener("focusout", onFocusOut, capture);
      wheel.reset();
    },
    resetWheel() {
      wheel.reset();
    }
  };
}
