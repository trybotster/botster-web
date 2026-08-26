import { createInputHandler } from "../vendor/restty/internal.js";
import type { DaemonModeFlags } from "./realHubDaemonDto";
import {
  coreMouseTrackingEnabled,
  mouseTrackingBitsFromCoreMode
} from "./mouseMode";

/** Discrete PTY wheel reports per write. Matches vendored Restty `WHEEL_REPORTS_PER_BURST`. */
export const WHEEL_REPORTS_PER_BURST = 3;

export type WheelLikeEvent = {
  deltaY: number;
  deltaMode?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
};

export type WheelCell = { col: number; row: number };

export type WheelDecision = {
  steps: number;
  direction: "up" | "down";
  buttonCode: number;
  col: number;
  row: number;
  cellHeight: number;
  rows: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
};

export type WheelMetrics = {
  cellHeight: number;
  rows: number;
  cell: WheelCell;
  /** When false, this event is local scrollback and must not enter PTY accumulation. */
  applicationMouseActive: boolean;
};

type WheelBurstTarget = {
  buttonCode: number;
  col: number;
  row: number;
  cellHeight: number;
  rows: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  direction: "up" | "down";
};

export type MountScopedWheelReencoderOptions = {
  scheduleDrain?: (callback: () => void) => void;
  onDrain?: (decision: WheelDecision) => void;
  isCurrent?: () => boolean;
};

/**
 * Convert a DOM wheel event into pixel delta for accumulation.
 * DOM_DELTA_PIXEL = 0, LINE = 1, PAGE = 2.
 */
export function wheelDeltaPixels(event: WheelLikeEvent, cellHeight: number, rows: number): number {
  const dy = event.deltaY;
  if (!dy || !Number.isFinite(dy)) return 0;
  const height = Math.max(1, cellHeight);
  const rowCount = Math.max(1, rows);
  if (event.deltaMode === 1) return dy * height;
  if (event.deltaMode === 2) return dy * rowCount * height;
  return dy;
}

/**
 * Mounted Restty sendInput wheel bytes are unmatched. A pending pointer
 * mouse or key semantic is not a match. The mount-scoped re-encoder is
 * the only PTY wheel byte authority.
 */
export function unmatchedWheelBytesShouldDrop(initialBytes: string): boolean {
  return looksLikeWheelReport(initialBytes);
}

/**
 * Restty `shouldRoutePointerToAppMouse`: Shift always means local scrollback,
 * even when application mouse tracking is active.
 */
export function shouldRouteWheelToAppMouse(
  event: WheelLikeEvent,
  applicationMouseActive: boolean
): boolean {
  if (event.shiftKey) return false;
  return applicationMouseActive;
}

const ESC = String.fromCharCode(0x1b);
const SGR_WHEEL_BUTTONS = new Set([64, 65, 68, 69, 72, 73, 80, 81]);
const URXVT_WHEEL_BUTTONS = new Set([96, 97, 100, 101, 104, 105, 112, 113]);

export function looksLikeWheelReport(data: string): boolean {
  if (!data) return false;
  const sgrMarker = `${ESC}[<`;
  let sgrIndex = data.indexOf(sgrMarker);
  while (sgrIndex >= 0) {
    const button = Number.parseInt(data.slice(sgrIndex + sgrMarker.length), 10);
    if (SGR_WHEEL_BUTTONS.has(button)) return true;
    sgrIndex = data.indexOf(sgrMarker, sgrIndex + sgrMarker.length);
  }
  const csiMarker = `${ESC}[`;
  let csiIndex = data.indexOf(csiMarker);
  while (csiIndex >= 0) {
    const button = Number.parseInt(data.slice(csiIndex + csiMarker.length), 10);
    if (URXVT_WHEEL_BUTTONS.has(button)) return true;
    csiIndex = data.indexOf(csiMarker, csiIndex + csiMarker.length);
  }
  if (data.startsWith(`${ESC}[M`) && data.length >= 4) {
    const code = data.charCodeAt(3) - 32;
    const stripped = code & ~(4 | 8 | 16);
    return stripped === 64 || stripped === 65;
  }
  return false;
}

export function countWheelReports(data: string): number {
  if (!data) return 0;
  const sgr = data.split(`${ESC}[<`).length - 1;
  if (sgr > 0) return sgr;
  const x10 = data.split(`${ESC}[M`).length - 1;
  if (x10 > 0) return x10;
  return data.split(`${ESC}[`).length - 1;
}

function wheelModifiers(event: WheelLikeEvent): number {
  let mods = 0;
  if (event.shiftKey) mods |= 4;
  if (event.altKey) mods |= 8;
  if (event.ctrlKey) mods |= 16;
  return mods;
}

function burstLimit(rows: number): number {
  return Math.max(1, Math.min(WHEEL_REPORTS_PER_BURST, rows || 24));
}

function defaultScheduleDrain(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 16);
}

/**
 * Render PTY bytes from an immutable wheel decision against the supplied modes.
 * Does not advance or rewind the mount-scoped accumulator.
 */
export function encodeWheelDecision(decision: WheelDecision, modes: DaemonModeFlags): string {
  if (decision.steps <= 0) return "";
  if (!coreMouseTrackingEnabled(modes.mouse_mode)) return "";
  const replies: string[] = [];
  const inputHandler = createInputHandler({
    sendReply: (data) => {
      replies.push(data);
    },
    suppressQueryReplies: true,
    positionToCell: () => ({ col: decision.col, row: decision.row }),
    getCellHeight: () => decision.cellHeight,
    getRows: () => decision.rows
  });
  inputHandler.setMouseMode?.("auto");
  inputHandler.rehydrateMouseFromTrackingBits?.(mouseTrackingBitsFromCoreMode(modes.mouse_mode));
  const deltaY = decision.direction === "up" ? -decision.steps * decision.cellHeight : decision.steps * decision.cellHeight;
  const sent = inputHandler.sendMouseEvent?.("wheel", {
    deltaY,
    deltaMode: 0,
    shiftKey: decision.shiftKey,
    altKey: decision.altKey,
    ctrlKey: decision.ctrlKey
  } as WheelEvent);
  if (sent && replies.length > 0) return replies.join("");
  return "";
}

/**
 * Mount-scoped PTY wheel authority. Mutates accumulator state once per browser
 * wheel event (or once per deferred remainder drain) and yields an immutable
 * decision that `encode` may render any number of times.
 */
export class MountScopedWheelReencoder {
  private pendingWheelPx = 0;
  private drainEpoch = 0;
  private burstTarget: WheelBurstTarget | null = null;
  private lastApplicationMouseActive = false;
  private readonly scheduleDrain: (callback: () => void) => void;
  private readonly onDrain?: (decision: WheelDecision) => void;
  private readonly isCurrent: () => boolean;
  accumulatorMutations = 0;

  constructor(options: MountScopedWheelReencoderOptions = {}) {
    this.scheduleDrain = options.scheduleDrain ?? defaultScheduleDrain;
    this.onDrain = options.onDrain;
    this.isCurrent = options.isCurrent ?? (() => true);
  }

  reset(): void {
    this.drainEpoch += 1;
    this.pendingWheelPx = 0;
    this.burstTarget = null;
    this.lastApplicationMouseActive = false;
  }

  /**
   * Follow Restty: mode disable and rehydrate clear the wheel accumulator.
   * Call this when application-mouse tracking changes, including after output
   * that may have enabled or disabled mouse modes.
   */
  syncApplicationMouseActive(active: boolean): void {
    if (active === this.lastApplicationMouseActive) return;
    this.drainEpoch += 1;
    this.pendingWheelPx = 0;
    this.burstTarget = null;
    this.lastApplicationMouseActive = active;
  }

  pendingPixels(): number {
    return this.pendingWheelPx;
  }

  /**
   * Consume one browser wheel event. This is the only accumulator mutation for
   * that event. `encodeWheelDecision` must not call this method.
   */
  consumeWheelEvent(event: WheelLikeEvent, metrics: WheelMetrics): WheelDecision | undefined {
    this.accumulatorMutations += 1;
    if (!shouldRouteWheelToAppMouse(event, metrics.applicationMouseActive)) {
      this.syncApplicationMouseActive(false);
      return undefined;
    }
    this.syncApplicationMouseActive(true);
    this.drainEpoch += 1;
    this.burstTarget = null;
    const cellHeight = Math.max(1, metrics.cellHeight || 20);
    const rows = Math.max(1, metrics.rows || 24);
    const dyPx = wheelDeltaPixels(event, cellHeight, rows);
    if (!dyPx) return undefined;
    let next = this.pendingWheelPx;
    if (next !== 0 && Math.sign(next) !== Math.sign(dyPx)) next = 0;
    next += dyPx;
    const mods = wheelModifiers(event);
    const direction: "up" | "down" = dyPx < 0 ? "up" : "down";
    const buttonCode = (direction === "up" ? 64 : 65) + mods;
    if (Math.abs(next) < cellHeight) {
      this.pendingWheelPx = next;
      return { steps: 0, direction, buttonCode, col: metrics.cell.col, row: metrics.cell.row, cellHeight, rows, shiftKey: Boolean(event.shiftKey), altKey: Boolean(event.altKey), ctrlKey: Boolean(event.ctrlKey) };
    }
    const rawSteps = Math.trunc(next / cellHeight);
    if (!rawSteps) {
      this.pendingWheelPx = next;
      return { steps: 0, direction, buttonCode, col: metrics.cell.col, row: metrics.cell.row, cellHeight, rows, shiftKey: Boolean(event.shiftKey), altKey: Boolean(event.altKey), ctrlKey: Boolean(event.ctrlKey) };
    }
    const steps = Math.min(Math.abs(rawSteps), burstLimit(rows));
    this.pendingWheelPx = next - Math.sign(rawSteps) * steps * cellHeight;
    this.burstTarget = {
      buttonCode,
      col: metrics.cell.col,
      row: metrics.cell.row,
      cellHeight,
      rows,
      shiftKey: Boolean(event.shiftKey),
      altKey: Boolean(event.altKey),
      ctrlKey: Boolean(event.ctrlKey),
      direction
    };
    if (Math.abs(this.pendingWheelPx) >= cellHeight) this.queueDrain();
    else this.burstTarget = null;
    return {
      steps,
      direction,
      buttonCode,
      col: metrics.cell.col,
      row: metrics.cell.row,
      cellHeight,
      rows,
      shiftKey: Boolean(event.shiftKey),
      altKey: Boolean(event.altKey),
      ctrlKey: Boolean(event.ctrlKey)
    };
  }

  private queueDrain(): void {
    const cellHeight = Math.max(1, this.burstTarget?.cellHeight || 20);
    if (!this.burstTarget || Math.abs(this.pendingWheelPx) < cellHeight) return;
    const epoch = this.drainEpoch;
    this.scheduleDrain(() => {
      if (epoch !== this.drainEpoch) return;
      if (!this.isCurrent()) {
        this.reset();
        return;
      }
      const decision = this.flushRemainder();
      if (decision && decision.steps > 0) this.onDrain?.(decision);
    });
  }

  private flushRemainder(): WheelDecision | undefined {
    const target = this.burstTarget;
    if (!target) {
      this.reset();
      return undefined;
    }
    this.accumulatorMutations += 1;
    const cellHeight = Math.max(1, target.cellHeight || 20);
    if (Math.abs(this.pendingWheelPx) < cellHeight) {
      this.burstTarget = null;
      return undefined;
    }
    const rawSteps = Math.trunc(this.pendingWheelPx / cellHeight);
    if (!rawSteps) return undefined;
    const steps = Math.min(Math.abs(rawSteps), burstLimit(target.rows));
    this.pendingWheelPx -= Math.sign(rawSteps) * steps * cellHeight;
    const decision: WheelDecision = {
      steps,
      direction: target.direction,
      buttonCode: target.buttonCode,
      col: target.col,
      row: target.row,
      cellHeight,
      rows: target.rows,
      shiftKey: target.shiftKey,
      altKey: target.altKey,
      ctrlKey: target.ctrlKey
    };
    if (Math.abs(this.pendingWheelPx) >= cellHeight) this.queueDrain();
    else this.burstTarget = null;
    return decision;
  }
}
