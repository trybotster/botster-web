export declare const OVERLAY_SCROLLBAR_WIDTH_CSS_PX = 7;
export declare const OVERLAY_SCROLLBAR_MARGIN_CSS_PX = 4;
export declare const OVERLAY_SCROLLBAR_INSET_Y_CSS_PX = 2;
export declare const OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX = 28;
export type OverlayScrollbarLayout = {
    total: number;
    offset: number;
    len: number;
    denom: number;
    width: number;
    trackX: number;
    trackY: number;
    trackH: number;
    thumbY: number;
    thumbH: number;
};
export declare function computeOverlayScrollbarLayout(total: number, offset: number, len: number, canvasWidth: number, canvasHeight: number, currentDpr: number): OverlayScrollbarLayout | null;
