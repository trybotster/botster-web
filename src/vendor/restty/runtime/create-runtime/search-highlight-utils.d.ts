import type { Color } from "../../renderer";
import type { ResttySearchViewportMatch } from "../types";
export type SearchCellHighlightKind = 0 | 1 | 2;
type AppendSearchHighlightsOptions = {
    target: number[];
    matches: ResttySearchViewportMatch[];
    rows: number;
    cols: number;
    cellW: number;
    cellH: number;
    inactiveColor: Color;
    activeColor: Color;
    pushRect: (target: number[], x: number, y: number, width: number, height: number, color: Color) => void;
};
export declare function appendSearchHighlightsForRow(target: number[], matches: readonly ResttySearchViewportMatch[], startIndex: number, row: number, rowY: number, cols: number, cellW: number, cellH: number, inactiveColor: Color, activeColor: Color, pushRect: (target: number[], x: number, y: number, width: number, height: number, color: Color) => void): number;
export declare function appendSearchHighlights(options: AppendSearchHighlightsOptions): void;
export declare function searchHighlightForColumn(matches: readonly ResttySearchViewportMatch[], startIndex: number, endIndex: number, col: number, cols: number): {
    nextIndex: number;
    kind: SearchCellHighlightKind;
};
export {};
