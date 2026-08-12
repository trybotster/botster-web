import type { InputHandler, MouseMode } from "../input";
import type { GhosttyTheme } from "../theme";
import type { ResttyManagedAppPane, ResttyManagedPaneSearchUiStyleOptions } from "./pane-app-manager";
import type { ResttySearchState, ResttyShaderStage } from "../runtime/types";
import type { ResttyPaneSearchUiCloseOptions, ResttyPaneSearchUiOpenOptions } from "./pane-search-ui";
type PaneSearchUiHandleOps = {
    open: (paneId: number, options?: ResttyPaneSearchUiOpenOptions) => void;
    close: (paneId: number, options?: ResttyPaneSearchUiCloseOptions) => void;
    toggle: (paneId: number, options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
    isOpen: (paneId: number) => boolean;
    getStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
    setStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
};
/**
 * Public API surface exposed by each pane handle.
 */
export type ResttyPaneApi = {
    id: number;
    setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
    setPaused: (value: boolean) => void;
    togglePause: () => void;
    setFontSize: (value: number) => void;
    applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
    resetTheme: () => void;
    sendInput: (text: string, source?: string) => void;
    sendKeyInput: (text: string, source?: string) => void;
    clearScreen: () => void;
    loadBinarySnapshot: (data: Uint8Array) => boolean;
    getColorForeground: () => number | null;
    getColorBackground: () => number | null;
    getColorCursor: () => number | null;
    getPaletteColor: (index: number) => number | null;
    getPalette: () => Uint8Array | null;
    connectPty: (url?: string) => void;
    disconnectPty: () => void;
    isPtyConnected: () => boolean;
    setMouseMode: (value: MouseMode) => void;
    getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
    copySelectionToClipboard: () => Promise<boolean>;
    pasteFromClipboard: () => Promise<boolean>;
    setSearchQuery: (query: string) => void;
    clearSearch: () => void;
    searchNext: () => void;
    searchPrevious: () => void;
    getSearchState: () => ResttySearchState;
    openSearch: (options?: ResttyPaneSearchUiOpenOptions) => void;
    closeSearch: (options?: ResttyPaneSearchUiCloseOptions) => void;
    toggleSearch: (options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
    isSearchOpen: () => boolean;
    dumpAtlasForCodepoint: (cp: number) => void;
    resize: (cols: number, rows: number) => void;
    focus: () => void;
    blur: () => void;
    updateSize: (force?: boolean) => void;
    getBackend: () => string;
    getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
    setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
    setShaderStages: (stages: ResttyShaderStage[]) => void;
    getShaderStages: () => ResttyShaderStage[];
    getRawPane: () => ResttyManagedAppPane;
};
/**
 * Thin wrapper around a managed pane that delegates calls to the
 * underlying app. Resolves the pane lazily so it stays valid across
 * layout changes.
 */
export declare class ResttyPaneHandle implements ResttyPaneApi {
    private readonly resolvePane;
    private readonly searchUiOps;
    constructor(resolvePane: () => ResttyManagedAppPane, searchUiOps: PaneSearchUiHandleOps);
    get id(): number;
    setRenderer(value: "auto" | "webgpu" | "webgl2"): void;
    setPaused(value: boolean): void;
    togglePause(): void;
    setFontSize(value: number): void;
    applyTheme(theme: GhosttyTheme, sourceLabel?: string): void;
    resetTheme(): void;
    sendInput(text: string, source?: string): void;
    sendKeyInput(text: string, source?: string): void;
    clearScreen(): void;
    loadBinarySnapshot(data: Uint8Array): boolean;
    getColorForeground(): number | null;
    getColorBackground(): number | null;
    getColorCursor(): number | null;
    getPaletteColor(index: number): number | null;
    getPalette(): Uint8Array | null;
    connectPty(url?: string): void;
    disconnectPty(): void;
    isPtyConnected(): boolean;
    setMouseMode(value: MouseMode): void;
    getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]>;
    copySelectionToClipboard(): Promise<boolean>;
    pasteFromClipboard(): Promise<boolean>;
    setSearchQuery(query: string): void;
    clearSearch(): void;
    searchNext(): void;
    searchPrevious(): void;
    getSearchState(): ResttySearchState;
    openSearch(options?: ResttyPaneSearchUiOpenOptions): void;
    closeSearch(options?: ResttyPaneSearchUiCloseOptions): void;
    toggleSearch(options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions): void;
    isSearchOpen(): boolean;
    dumpAtlasForCodepoint(cp: number): void;
    resize(cols: number, rows: number): void;
    focus(): void;
    blur(): void;
    updateSize(force?: boolean): void;
    getBackend(): string;
    getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
    setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void;
    setShaderStages(stages: ResttyShaderStage[]): void;
    getShaderStages(): ResttyShaderStage[];
    getRawPane(): ResttyManagedAppPane;
}
export {};
