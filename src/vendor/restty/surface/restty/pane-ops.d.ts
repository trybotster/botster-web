import type { ResttyAppPaneManager, ResttyManagedAppPane, ResttyManagedPaneStyleOptions, ResttyManagedPaneSearchUiStyleOptions } from "../pane-app-manager";
import type { ResttyPaneManager, ResttyPaneSplitDirection } from "../panes-types";
import { ResttyPaneHandle } from "../restty-pane-handle";
import type { ResttyLifecycleHookPayload, ResttyPluginEvents } from "../restty-plugin-types";
import type { ResttyPaneSearchUiCloseOptions, ResttyPaneSearchUiOpenOptions } from "../pane-search-ui";
type ResttyPaneLookup = {
    getPanes: () => ResttyManagedAppPane[];
    getPaneById: (id: number) => ResttyManagedAppPane | null;
    getActivePane: () => ResttyManagedAppPane | null;
    getFocusedPane: () => ResttyManagedAppPane | null;
    openPaneSearch: (id: number, options?: ResttyPaneSearchUiOpenOptions) => void;
    closePaneSearch: (id: number, options?: ResttyPaneSearchUiCloseOptions) => void;
    togglePaneSearch: (id: number, options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
    isPaneSearchOpen: (id: number) => boolean;
    getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
    setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
};
type ResttyLifecycleEmitter = {
    runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
    emitPluginEvent: <E extends keyof ResttyPluginEvents>(event: E, payload: ResttyPluginEvents[E]) => void;
};
export declare function requirePaneById(getPaneById: (id: number) => ResttyManagedAppPane | null, id: number): ResttyManagedAppPane;
export declare function makePaneHandle(lookup: Pick<ResttyPaneLookup, "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">, id: number): ResttyPaneHandle;
export declare function requireActivePaneHandle(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">): ResttyPaneHandle;
export declare function panes(lookup: Pick<ResttyPaneLookup, "getPanes" | "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">): ResttyPaneHandle[];
export declare function pane(lookup: Pick<ResttyPaneLookup, "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">, id: number): ResttyPaneHandle | null;
export declare function activePane(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">): ResttyPaneHandle | null;
export declare function focusedPane(lookup: Pick<ResttyPaneLookup, "getFocusedPane" | "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">): ResttyPaneHandle | null;
export declare function forEachPane(lookup: Pick<ResttyPaneLookup, "getPanes" | "getPaneById" | "openPaneSearch" | "closePaneSearch" | "togglePaneSearch" | "isPaneSearchOpen" | "getSearchUiStyleOptions" | "setSearchUiStyleOptions">, visitor: (pane: ResttyPaneHandle) => void): void;
export declare function createInitialPane(paneManager: ResttyPaneManager<ResttyManagedAppPane>, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, options?: {
    focus?: boolean;
}): ResttyManagedAppPane;
export declare function splitActivePane(paneManager: ResttyPaneManager<ResttyManagedAppPane>, lookup: Pick<ResttyPaneLookup, "getActivePane">, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null;
export declare function splitPane(paneManager: ResttyPaneManager<ResttyManagedAppPane>, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, id: number, direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null;
export declare function closePane(paneManager: ResttyPaneManager<ResttyManagedAppPane>, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, id: number): boolean;
export declare function setActivePane(paneManager: ResttyPaneManager<ResttyManagedAppPane>, lookup: Pick<ResttyPaneLookup, "getActivePane">, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, id: number, options?: {
    focus?: boolean;
}): void;
export declare function markPaneFocused(paneManager: ResttyPaneManager<ResttyManagedAppPane>, lookup: Pick<ResttyPaneLookup, "getFocusedPane">, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, id: number, options?: {
    focus?: boolean;
}): void;
export declare function connectPty(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">, url?: string): void;
export declare function disconnectPty(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">, hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">): void;
export declare function resize(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">, hooks: ResttyLifecycleEmitter, cols: number, rows: number): void;
export declare function focus(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">, hooks: ResttyLifecycleEmitter): void;
export declare function blur(lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">, hooks: ResttyLifecycleEmitter): void;
export declare function getPaneStyleOptions(paneManager: ResttyPaneManager<ResttyManagedAppPane>): Readonly<Required<ResttyManagedPaneStyleOptions>>;
export declare function setPaneStyleOptions(paneManager: ResttyPaneManager<ResttyManagedAppPane>, options: ResttyManagedPaneStyleOptions): void;
export declare function getSearchUiStyleOptions(paneManager: Pick<ResttyAppPaneManager, "getSearchUiStyleOptions">): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
export declare function setSearchUiStyleOptions(paneManager: Pick<ResttyAppPaneManager, "setSearchUiStyleOptions">, options: ResttyManagedPaneSearchUiStyleOptions): void;
export {};
