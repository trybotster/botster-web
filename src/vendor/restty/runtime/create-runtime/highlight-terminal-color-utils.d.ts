import { type ThemeTerminalColor } from "../../theme";
import type { Color } from "../../renderer";
export type RuntimeTerminalColor = {
    kind: "color";
    color: Color;
} | {
    kind: "cell-foreground";
} | {
    kind: "cell-background";
};
export declare function runtimeTerminalColorFromTheme(value: ThemeTerminalColor): RuntimeTerminalColor;
export declare function resolveHighlightBackgroundColor(value: RuntimeTerminalColor, cellFg: Color, cellBg: Color, inverse: boolean): Color;
export declare function resolveHighlightForegroundColor(value: RuntimeTerminalColor, cellFg: Color, cellBg: Color, inverse: boolean): Color;
