/** RGBA color with 0-255 byte components. */
export type ThemeColor = {
    r: number;
    g: number;
    b: number;
    a?: number;
};
export type ThemeTerminalColor = ThemeColor | "cell-foreground" | "cell-background";
/**
 * Parsed Ghostty terminal theme with semantic colors and full 256-color palette.
 */
export type GhosttyTheme = {
    /** Optional theme name extracted from source. */
    name?: string;
    /** Semantic colors and ANSI palette entries. */
    colors: {
        /** Default background color. */
        background?: ThemeColor;
        /** Default foreground (text) color. */
        foreground?: ThemeColor;
        /** Cursor fill color. */
        cursor?: ThemeColor;
        /** Text color under the cursor. */
        cursorText?: ThemeColor;
        /** Selection background color. */
        selectionBackground?: ThemeTerminalColor;
        /** Selection foreground (text) color. */
        selectionForeground?: ThemeTerminalColor;
        /** Search match background color. */
        searchBackground?: ThemeTerminalColor;
        /** Search match foreground color. */
        searchForeground?: ThemeTerminalColor;
        /** Active search match background color. */
        searchSelectedBackground?: ThemeTerminalColor;
        /** Active search match foreground color. */
        searchSelectedForeground?: ThemeTerminalColor;
        /** 256-color palette (indices 0-255). */
        palette: Array<ThemeColor | undefined>;
    };
    /** Original key-value pairs from the theme source. */
    raw: Record<string, string>;
};
/** Parse a Ghostty color value (hex, rgb/rgba, or named color). */
export declare function parseGhosttyColor(value: string): ThemeColor | null;
/** Parse a Ghostty TerminalColor value. */
export declare function parseGhosttyTerminalColor(value: string): ThemeTerminalColor | null;
/** Convert ThemeColor to normalized RGBA floats (0.0-1.0). */
export declare function colorToFloats(color: ThemeColor, alphaOverride?: number): [number, number, number, number];
/** Convert ThemeColor to packed 24-bit RGB integer (0xRRGGBB). */
export declare function colorToRgbU32(color: ThemeColor): number;
/** Parse a Ghostty theme configuration from key=value format. */
export declare function parseGhosttyTheme(text: string): GhosttyTheme;
