import type { KittyPlacement, RenderState, ResttyWasmExports, ResttyWasmOptions, SearchStatus, SearchViewportMatch, WasmAbi } from "./types";
/** WASM terminal core runtime with memory management and typed array caching. */
export declare class ResttyWasm {
    readonly exports: ResttyWasmExports;
    readonly abi: WasmAbi;
    readonly memory: WebAssembly.Memory;
    private readonly renderViewCaches;
    private readonly snapshotReaders;
    private constructor();
    /** Load and instantiate the embedded WASM module. */
    static load(options?: ResttyWasmOptions): Promise<ResttyWasm>;
    /** Create a new terminal instance and return its handle. */
    create(cols: number, rows: number, maxScrollback: number): number;
    /** Destroy a terminal instance and free its resources. */
    destroy(handle: number): void;
    private getRenderViewCache;
    /** Resize the terminal grid. */
    resize(handle: number, cols: number, rows: number): void;
    /** Create one incremental GHOSTSNP reader for one attach subscription. */
    createSnapshotReader(handle: number): GhosttySnapshotReader | null;
    releaseSnapshotReader(handle: number, reader: GhosttySnapshotReader): void;
    /** Set pixel dimensions for Kitty graphics protocol. */
    setPixelSize(handle: number, widthPx: number, heightPx: number): void;
    /** Update internal render buffers after state changes. */
    renderUpdate(handle: number): void;
    /** Scroll the viewport by delta rows. */
    scrollViewport(handle: number, delta: number): void;
    /** Read and clear pending output replies from terminal. */
    drainOutput(handle: number): string;
    /** Get active Kitty keyboard protocol flags. */
    getKittyKeyboardFlags(handle: number): number;
    /**
     * Read Ghostty mouse tracking/format mode bits for JS MouseController rehydrate.
     * Bits: 9, 1000, 1002, 1003, 1005, 1006, 1015, 1016 (see mouse.ts).
     */
    getMouseTrackingBits(handle: number): number;
    /** Set the active terminal search query. */
    setSearchQuery(handle: number, query: string): void;
    /** Clear the active terminal search query and results. */
    clearSearch(handle: number): void;
    /** Advance terminal search work by a bounded budget. */
    stepSearch(handle: number, budget: number): void;
    /** Select the next search match. */
    searchNext(handle: number): void;
    /** Select the previous search match. */
    searchPrevious(handle: number): void;
    /** Get the current terminal search status. */
    getSearchStatus(handle: number): SearchStatus;
    /** Get visible search-highlight spans for the current viewport. */
    getSearchViewportMatches(handle: number): SearchViewportMatch[];
    /** Get all active Kitty graphics placements. */
    getKittyPlacements(handle: number): KittyPlacement[];
    /** Write text to terminal for processing. */
    write(handle: number, text: string): void;
    /** Write raw bytes to terminal for processing (no encoding step). */
    writeBytes(handle: number, data: Uint8Array): void;
    /** Set default colors for terminal (RGB packed as 0xRRGGBB). */
    setDefaultColors(handle: number, fg: number, bg: number, cursor: number): void;
    /** Set terminal color palette (RGB triples). */
    setPalette(handle: number, colors: Uint8Array, count: number): void;
    /** Reset terminal palette to defaults. */
    resetPalette(handle: number): void;
    /** Get the active foreground color as 0x00RRGGBB, or null if unset. */
    getColorForeground(handle: number): number | null;
    /** Get the active background color as 0x00RRGGBB, or null if unset. */
    getColorBackground(handle: number): number | null;
    /** Get the active cursor color as 0x00RRGGBB, or null if unset. */
    getColorCursor(handle: number): number | null;
    /** Get a single palette color as 0x00RRGGBB, or null for invalid index. */
    getPaletteColor(handle: number, index: number): number | null;
    /** Get the full 256-color palette as a Uint8Array (768 bytes: R,G,B × 256). */
    getPalette(handle: number): Uint8Array | null;
    /** Load a binary snapshot bundle into the terminal state.
     *  Returns null on success, or a string describing the failure. */
    loadBinarySnapshot(handle: number, data: Uint8Array): string | null;
    /** Get current render state with cached typed array views. */
    getRenderState(handle: number): RenderState | null;
}
export type GhosttySnapshotNextResult = {
    status: "page";
} | {
    status: "finish";
} | {
    status: "error";
    error: string;
};
/** A queued Ghostty reader for one incremental snapshot subscription. */
export declare class GhosttySnapshotReader {
    private readonly wasm;
    private readonly terminalHandle;
    private readerHandle;
    private readyComplete;
    private pendingResize;
    constructor(wasm: ResttyWasm, terminalHandle: number, readerHandle: number);
    /** Feed the first opaque frame and decode through READY. */
    ready(data: Uint8Array): string | null;
    /** Feed one opaque PAGE or FINISH frame. */
    next(data: Uint8Array): GhosttySnapshotNextResult;
    /** Queue the latest terminal resize while history is incomplete. */
    queueResize(cols: number, rows: number): boolean;
    /** Release the decoder and keep any READY terminal and restored history. */
    cancel(applyPendingResize?: boolean): void;
    private callWithFrame;
    private finish;
}
/** Load and instantiate the embedded WASM module (convenience function). */
export declare function loadResttyWasm(options?: ResttyWasmOptions): Promise<ResttyWasm>;
