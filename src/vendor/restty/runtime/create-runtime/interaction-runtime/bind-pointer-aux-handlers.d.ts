import type { InputHandler } from "../../../input";
import type { RuntimeCell, RuntimeDesktopSelectionState, RuntimeGridState, RuntimeSelectionState, RuntimeTouchSelectionState } from "./types";
type CreatePointerAuxHandlersOptions = {
    inputHandler: InputHandler;
    shouldRoutePointerToAppMouse: (shiftKey: boolean) => boolean;
    scrollViewportByWheel?: (event: WheelEvent) => void;
    getWasmReady: () => boolean;
    getWasmHandle: () => number;
    getGridState: () => RuntimeGridState;
    updateLinkHover: (cell: RuntimeCell | null) => void;
    clearPendingDesktopSelection: () => void;
    clearPendingTouchSelection: () => void;
    isTouchPointer: (event: PointerEvent) => boolean;
    selectionState: RuntimeSelectionState;
    touchSelectionState: RuntimeTouchSelectionState;
    desktopSelectionState: RuntimeDesktopSelectionState;
    updateCanvasCursor: () => void;
    markNeedsRender: () => void;
};
export type PointerAuxHandlers = {
    onPointerCancel: (event: PointerEvent) => void;
    onWheel: (event: WheelEvent) => void;
    onContextMenu: (event: MouseEvent) => void;
    onPointerLeave: () => void;
};
export declare function createPointerAuxHandlers(options: CreatePointerAuxHandlersOptions): PointerAuxHandlers;
export {};
