import type { ResttyWasm, SearchViewportMatch } from "../../wasm";
import type { ResttyAppCallbacks, ResttySearchState } from "../types";
type CreateRuntimeSearchOptions = {
    callbacks?: ResttyAppCallbacks;
    cleanupFns: Array<() => void>;
    getWasmReady: () => boolean;
    getWasm: () => ResttyWasm | null;
    getWasmHandle: () => number;
    markNeedsRender: () => void;
};
type RuntimeSearch = {
    setQuery: (query: string) => void;
    clear: () => void;
    next: () => void;
    previous: () => void;
    getState: () => ResttySearchState;
    getViewportMatches: () => SearchViewportMatch[];
    markDirty: () => void;
    handleWasmReset: () => void;
};
export declare function createRuntimeSearch(options: CreateRuntimeSearchOptions): RuntimeSearch;
export {};
