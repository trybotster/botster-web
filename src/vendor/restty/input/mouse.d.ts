import type { CellPosition, MouseMode, MouseStatus } from "./types";
/**
 * Construction options for MouseController.
 */
export type MouseControllerOptions = {
    /** Sink for mouse report sequences sent back to the PTY. */
    sendReply: (data: string) => void;
    /** Map pointer events to 0-based cell coordinates. */
    positionToCell: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition;
    /** Map pointer events to 1-based pixel coordinates (for SGR-Pixels mode). */
    positionToPixel?: (event: MouseEvent | PointerEvent | WheelEvent) => {
        x: number;
        y: number;
    };
    /**
     * Cell height in CSS pixels for wheel accumulation.
     * Defaults to 20 when omitted.
     */
    getCellHeight?: () => number;
    /**
     * Viewport rows. Scales page-mode wheel deltas.
     * Defaults to 24 when omitted.
     */
    getRows?: () => number;
    /**
     * Schedule a later wheel-remainder flush. Defaults to requestAnimationFrame
     * so a coalesced flick is paced like native OS scroll callbacks.
     */
    scheduleWheelDrain?: (cb: () => void) => void;
};
/** Discrete reports per PTY write. TUIs redraw once per report. */
export declare const WHEEL_REPORTS_PER_BURST = 3;
/**
 * Tracks mouse reporting state (mode, format, motion tracking) and encodes
 * pointer events into terminal mouse sequences (X10, UTF-8, URxvt, SGR).
 */
export declare class MouseController {
    private mode;
    private enabled;
    private format;
    private motion;
    private pressed;
    private button;
    private flags;
    private x10Event;
    /** Accumulated wheel pixels until one cell height. */
    private pendingWheelPx;
    private wheelDrainEpoch;
    private wheelBurstTarget;
    private sendReply;
    private positionToCell;
    private positionToPixel?;
    private getCellHeight;
    private getRows;
    private scheduleWheelDrain;
    constructor(options: MouseControllerOptions);
    setReplySink(fn: (data: string) => void): void;
    setPositionToCell(fn: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition): void;
    setPositionToPixel(fn: (event: MouseEvent | PointerEvent | WheelEvent) => {
        x: number;
        y: number;
    }): void;
    setMode(mode: MouseMode): void;
    handleModeSeq(seq: string): boolean;
    /**
     * Apply a single DEC private mode code (same semantics as CSI ? … h/l).
     * Used by live CSI handling and post-GHOSTSNP rehydrate from Ghostty state.
     */
    applyPrivateMode(code: number, enabled: boolean): boolean;
    /**
     * Rehydrate mouse tracking/format from Ghostty mode bits after snapshot import.
     * Bit layout matches `restty_mouse_tracking_bits` in wasm.
     */
    rehydrateFromTrackingBits(bits: number): void;
    private recomputeEnabledFromFlags;
    private resetWheelAccumulator;
    private wheelBurstLimit;
    private queueWheelDrain;
    private flushWheelRemainder;
    isActive(): boolean;
    getStatus(): MouseStatus;
    sendMouseEvent(kind: "down" | "up" | "move" | "wheel", event: PointerEvent | WheelEvent): boolean;
    private updateFlags;
    private isX10EventMode;
    private modifiers;
    private sendMouse;
    private sendWheelBatch;
    private encodeMouse;
}
/**
 * Convert a DOM wheel event into pixel delta for accumulation.
 * DOM_DELTA_PIXEL = 0, LINE = 1, PAGE = 2.
 */
export declare function wheelDeltaPixels(event: WheelEvent, cellH: number, rows: number): number;
