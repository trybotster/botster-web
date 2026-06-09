import type { ActionBinding, UiActionRequest } from "./actions";
import type { EntityFrame } from "./entities";
import type { HubControlFrame, HubControlFrameHandler, HubControlTransport } from "./protocol";
import type {
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonEvent,
  DaemonOperatorError,
  DaemonRequest,
  DaemonResponse,
  DaemonSession
} from "./realHubDaemonDto";
import type { UiTreeSnapshot } from "./uiNodes";

export const realHubDogfoodSessionId = "botster-web-dogfood-session";
export const realHubDogfoodSubscriptionId = "botster-web-dogfood-terminal";

const dogfoodSurface = "botster-web.dogfood.session";
const sessionFamily = "botster-web.session";
const draftFamily = "botster-web.session_draft";
const statusFamily = "botster-web.hub_status";

export interface DaemonBridgeClient {
  request(request: DaemonRequest): Promise<DaemonResponse>;
  streamTerminal?(
    sessionId: string,
    subscriptionId: string,
    onEvent: (event: DaemonEvent) => void
  ): { unsubscribe(): void };
}

export interface HttpDaemonBridgeClientOptions {
  url: string;
  terminalUrl?: string;
  fetchImpl?: typeof fetch;
  requestIdGenerator?: () => string;
}

export function createHttpDaemonBridgeClient({
  url,
  terminalUrl = url.replace(/\/request$/, "/terminal"),
  fetchImpl = fetch,
  requestIdGenerator = createRequestIdGenerator("daemon-request")
}: HttpDaemonBridgeClientOptions): DaemonBridgeClient {
  return {
    async request(request) {
      const envelope: DaemonBridgeRequestEnvelope = {
        kind: "daemon_request",
        request_id: requestIdGenerator(),
        payload: request
      };
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope)
      });

      if (!response.ok) {
        throw new Error(`real hub bridge request failed with HTTP ${response.status}`);
      }

      const reply = (await response.json()) as DaemonBridgeResponseEnvelope;
      if (reply.kind !== "daemon_response") {
        throw new Error("real hub bridge returned an unexpected transport envelope");
      }

      return reply.payload;
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      const terminalStreamUrl = new URL(terminalUrl, window.location.href);
      terminalStreamUrl.searchParams.set("session_id", sessionId);
      terminalStreamUrl.searchParams.set("subscription_id", subscriptionId);
      const source = new EventSource(terminalStreamUrl.toString());
      source.addEventListener("daemon_event", (event) => {
        onEvent(JSON.parse(event.data) as DaemonEvent);
      });

      return {
        unsubscribe: () => {
          source.close();
        }
      };
    }
  };
}

export interface RealHubDogfoodTransportOptions {
  bridge: DaemonBridgeClient;
  sessionId?: string;
  spawnCommand?: string;
}

export function createRealHubDogfoodTransport({
  bridge,
  sessionId = realHubDogfoodSessionId,
  spawnCommand = defaultSpawnCommand()
}: RealHubDogfoodTransportOptions): HubControlTransport {
  let ingress: HubControlFrameHandler | undefined;
  let sequence = 1;

  const emit = (frame: HubControlFrame) => {
    queueMicrotask(() => ingress?.(frame));
  };
  const emitResponse = (response: DaemonResponse) => {
    for (const frame of daemonResponseFrames(response, sequence++)) {
      emit(frame);
    }
  };

  return {
    async connect(_capabilities, nextIngress) {
      ingress = nextIngress;
      emit({ kind: "hello_ack", payload: { mode: "real_hub_dogfood" } });
      emitResponse(await bridge.request({ type: "status" }));
    },
    async disconnect() {
      ingress = undefined;
    },
    async send(frame) {
      if (frame.kind === "subscribe") {
        emitResponse(await bridge.request({ type: "list_sessions" }));
        return;
      }

      if (frame.kind === "surface_subscribe") {
        emit({ kind: "ui_tree_snapshot", payload: realHubDogfoodUiTreeSnapshot });
        emitResponse(await bridge.request({ type: "status" }));
        emitResponse(await bridge.request({ type: "list_sessions" }));
        return;
      }

      if (frame.kind === "entity_pull") {
        const request = frame.payload as { family?: unknown };
        if (request.family === statusFamily) {
          emitResponse(await bridge.request({ type: "status" }));
        } else if (request.family === sessionFamily) {
          emitResponse(await bridge.request({ type: "list_sessions" }));
        } else if (request.family === draftFamily) {
          emit({
            kind: "entity_snapshot",
            payload: draftSnapshot(sequence++)
          });
        }
        return;
      }

      if (frame.kind === "action_request") {
        const request = frame.payload as UiActionRequest;
        await dispatchDaemonAction(bridge, request, sessionId, spawnCommand, emitResponse, emit);
      }
    }
  };
}

export function daemonResponseFrames(response: DaemonResponse, sequence: number): HubControlFrame[] {
  const frames: HubControlFrame[] = [];

  if (response.status) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: statusFamily,
        sequence,
        records: [statusRecord(response.status)]
      } satisfies EntityFrame
    });
  }

  if (Array.isArray(response.sessions)) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: sessionFamily,
        sequence,
        records: response.sessions.map(sessionRecord)
      } satisfies EntityFrame
    });
  }

  if (Array.isArray(response.events)) {
    for (const event of response.events) {
      const frame = daemonEventFrame(event, sequence);
      if (frame) {
        frames.push(frame);
      }
    }
  }

  if (response.error) {
    frames.push(operatorErrorFrame(response.error));
  }

  return frames;
}

export function daemonEventFrame(event: DaemonEvent, sequence: number): HubControlFrame | undefined {
  if (event.type === "session_lifecycle") {
    return {
      kind: "entity_patch",
      payload: {
        operation: "entity_patch",
        key: { family: sessionFamily, id: event.session_id },
        sequence,
        record: {
          id: event.session_id,
          status: event.state,
          last_result: `session ${event.state}`
        }
      } satisfies EntityFrame
    };
  }

  if (event.type === "process_exit") {
    return {
      kind: "entity_patch",
      payload: {
        operation: "entity_patch",
        key: { family: sessionFamily, id: event.session_id },
        sequence,
        record: {
          id: event.session_id,
          status: "exited",
          last_result: `process exited${typeof event.code === "number" ? ` with ${event.code}` : ""}`
        }
      } satisfies EntityFrame
    };
  }

  return undefined;
}

function statusRecord(status: NonNullable<DaemonResponse["status"]>) {
  return {
    id: "local-hub",
    title: status.host_display_name,
    status: status.lifecycle_state,
    host_id: status.host_id,
    sessions: status.session_count,
    packages: status.package_count,
    state_source: status.state_source
  };
}

function sessionRecord(session: DaemonSession) {
  return {
    id: session.session_id,
    title: session.session_id,
    status: session.lifecycle,
    target: "isolated-local-hub",
    last_result: `daemon session ${session.lifecycle}`
  };
}

function draftSnapshot(sequence: number): EntityFrame {
  return {
    operation: "entity_snapshot",
    family: draftFamily,
    sequence,
    records: [
      {
        id: "draft-1",
        fields: [
          {
            id: "session_name",
            label: "Session name",
            kind: "text_input",
            value: realHubDogfoodSessionId,
            errors: []
          },
          {
            id: "target",
            label: "Target",
            kind: "text_input",
            value: "isolated-local-hub",
            errors: []
          }
        ]
      }
    ]
  };
}

async function dispatchDaemonAction(
  bridge: DaemonBridgeClient,
  request: UiActionRequest,
  sessionId: string,
  spawnCommand: string,
  emitResponse: (response: DaemonResponse) => void,
  emit: (frame: HubControlFrame) => void
) {
  const action = request.action;

  if (action.id === "botster.session.select") {
    const response = await bridge.request({
      type: "spawn",
      session_id: sessionId,
      command: spawnCommand
    });
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, { session_id: sessionId, kind: response.kind }));
    return;
  }

  if (action.id === "botster.session.rename") {
    const response = await bridge.request({
      type: "shutdown_session",
      session_id: action.target ?? "missing-real-hub-session"
    });
    emitResponse(response);
    emit(actionResultFrame(request, false, response.error?.message ?? "Real hub rejected the validation action", response.error));
    return;
  }

  emit(actionResultFrame(request, false, `Unsupported real hub action: ${action.id}`));
}

function actionResultFrame(
  request: UiActionRequest,
  accepted: boolean,
  reason?: string,
  result?: unknown
): HubControlFrame {
  return {
    kind: "action_result",
    payload: {
      request_id: request.request_id,
      accepted,
      result,
      reason
    }
  };
}

function operatorErrorFrame(error: DaemonOperatorError): HubControlFrame {
  return {
    kind: "operator_error",
    payload: error
  };
}

function defaultSpawnCommand(): string {
  return "printf 'botster-web-dogfood-ready\\n'; while IFS= read -r line; do printf 'botster-web-dogfood-echo:%s\\n' \"$line\"; done";
}

function createRequestIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

export const realHubDogfoodUiTreeSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: dogfoodSurface,
  version: "real-hub-dogfood-v1",
  root: {
    id: "real-hub-dogfood-root",
    primitive: "stack",
    props: { label: "Real isolated hub dogfood surface" },
    slots: {
      children: [
        {
          id: "real-hub-summary",
          primitive: "section",
          slots: {
            children: [
              {
                id: "real-hub-heading",
                primitive: "heading",
                props: { level: 2, text: "Isolated local hub dogfood" }
              },
              {
                id: "real-hub-copy",
                primitive: "text",
                props: {
                  text: "Status, session rows, actions, validation errors, and terminal output are mapped from daemon DTOs after they cross the local bridge."
                }
              },
              {
                id: "real-hub-action-status",
                primitive: "text",
                bindings: [{ source: "local_state", path: "dogfood.action_status", prop: "text" }]
              },
              {
                id: "real-hub-spawn-action",
                primitive: "action",
                props: {
                  action: {
                    id: "botster.session.select",
                    target: realHubDogfoodSessionId,
                    label: "Spawn isolated session",
                    params: { mode: "real_hub_dogfood" }
                  } satisfies ActionBinding
                }
              }
            ]
          }
        },
        {
          id: "real-hub-status-list",
          primitive: "list",
          props: { label: "Hub status" },
          bindings: [{ source: "entity", path: `/${statusFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-status-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "hub-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "hub-status", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] },
                    { id: "hub-source", primitive: "text", bindings: [{ source: "entity", path: "@/state_source", prop: "text" }] }
                  ]
                }
              }
            ]
          }
        },
        {
          id: "real-hub-session-list",
          primitive: "list",
          props: { label: "Runtime sessions" },
          bindings: [{ source: "entity", path: `/${sessionFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-session-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "real-hub-session-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "real-hub-session-status", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] },
                    { id: "real-hub-session-result", primitive: "text", bindings: [{ source: "entity", path: "@/last_result", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "real-hub-sessions-empty",
                primitive: "empty_state",
                props: { title: "No daemon sessions", body: "Spawn an isolated session to populate this entity family." }
              }
            ]
          }
        },
        {
          id: "real-hub-validation-form",
          primitive: "form",
          props: {
            title: "Error state",
            submit: {
              id: "botster.session.rename",
              target: "missing-real-hub-session",
              label: "Trigger invalid action",
              params: { mode: "real_hub_dogfood_error" }
            }
          },
          bindings: [{ source: "entity", path: `/${draftFamily}/draft-1/fields`, prop: "fields" }]
        }
      ]
    }
  }
};
