export type BotsterClientCapability =
  | "ionic_shell"
  | "ui_tree_snapshot"
  | "entity_frame_store"
  | "semantic_actions"
  | "terminal_view_bridge"
  | "plugin_surface_sandbox";

export interface ClientCapabilityDeclaration {
  client: "botster-web";
  capabilities: BotsterClientCapability[];
}

export interface NegotiatedCapabilities {
  accepted: BotsterClientCapability[];
  unavailable: BotsterClientCapability[];
}

export const botsterWebCapabilities: ClientCapabilityDeclaration = {
  client: "botster-web",
  capabilities: [
    "ionic_shell",
    "ui_tree_snapshot",
    "entity_frame_store",
    "semantic_actions",
    "terminal_view_bridge",
    "plugin_surface_sandbox"
  ]
};
