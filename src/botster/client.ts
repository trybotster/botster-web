import { createActionDispatcher, type ActionDispatcher } from "./actions";
import { botsterWebCapabilities } from "./capabilities";
import { createEntityFrameStore, type EntityFrameStore, type EntityFrame } from "./entities";
import type { PluginSurfaceSandboxHost } from "./pluginSurfaces";
import {
  HubConnection,
  type HubConnectionLifecycle,
  type HubControlFrame,
  type HubControlTransport,
  type HubProtocolIngress
} from "./protocol";
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

export interface BotsterWebClientOptions {
  transport: HubControlTransport;
  actionIdGenerator?: () => string;
  actionTimeoutMs?: number;
}

export interface BotsterWebRuntimeClient {
  hub: HubConnection;
  entities: EntityFrameStore;
  actions: ActionDispatcher;
}

export function createBotsterWebClient(options: BotsterWebClientOptions): BotsterWebRuntimeClient {
  const hub = new HubConnection(options.transport);
  const entities = createEntityFrameStore({
    sendPull: (request) =>
      hub.send({
        kind: "entity_pull",
        payload: request
      })
  });
  const actions = createActionDispatcher({
    idGenerator: options.actionIdGenerator,
    timeoutMs: options.actionTimeoutMs,
    send: (request) =>
      hub.send({
        kind: "action_request",
        payload: request
      })
  });

  hub.onFrame((frame) => {
    if (isEntityFrame(frame)) {
      entities.apply(frame.payload as EntityFrame);
    } else if (frame.kind === "action_result") {
      actions.receiveResult(frame.payload as Parameters<ActionDispatcher["receiveResult"]>[0]);
    }
  });

  return {
    hub,
    entities,
    actions
  };
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

function isEntityFrame(frame: HubControlFrame): boolean {
  return (
    frame.kind === "entity_snapshot" ||
    frame.kind === "entity_upsert" ||
    frame.kind === "entity_patch" ||
    frame.kind === "entity_remove"
  );
}
