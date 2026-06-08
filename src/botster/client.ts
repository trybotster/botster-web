import type { ActionDispatcher } from "./actions";
import { botsterWebCapabilities } from "./capabilities";
import type { EntityFrameStore } from "./entities";
import type { PluginSurfaceSandboxHost } from "./pluginSurfaces";
import type { HubConnectionLifecycle, HubProtocolIngress } from "./protocol";
import type { TerminalViewBridge } from "./terminal";
import type { UiNodeRendererRegistry } from "./uiNodes";

export interface BotsterWebClientAdapters {
  hub: HubConnectionLifecycle & HubProtocolIngress;
  entities: EntityFrameStore;
  uiNodes: UiNodeRendererRegistry;
  actions: ActionDispatcher;
  terminal: TerminalViewBridge;
  pluginSurfaces: PluginSurfaceSandboxHost;
}

export const botsterWebClientContract = {
  id: "botster-web-client-contract",
  label: "Hub/core renderer contract",
  capabilities: botsterWebCapabilities.capabilities,
  seams: [
    "hub connection",
    "protocol ingress",
    "entity frame store",
    "UiNode renderer registry",
    "semantic action dispatch",
    "terminal_view bridge",
    "plugin surface sandbox"
  ]
} as const;
