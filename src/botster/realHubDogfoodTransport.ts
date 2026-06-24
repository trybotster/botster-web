import type { ActionBinding, UiActionRequest } from "./actions";
import { hubStatusFamily } from "./connectionDiagnostics";
import type { EntityFrame } from "./entities";
import type { HubControlFrame, HubControlFrameHandler, HubControlTransport } from "./protocol";
import type {
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonDiagnostic,
  DaemonEvent,
  DaemonOperatorError,
  DaemonPackage,
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
const packageFamily = "botster-web.package";
const statusFamily = hubStatusFamily;

type HubConnectionDiagnosticPayload = Omit<Partial<DaemonDiagnostic>, "kind"> & { kind: string };

export interface DaemonBridgeClient {
  request(request: DaemonRequest): Promise<DaemonResponse>;
  subscribeEvents?(onEvent: (event: DaemonEvent) => void): { unsubscribe(): void };
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
  const eventListeners = new Set<(event: DaemonEvent) => void>();

  return {
    async request(request) {
      recordLiveHarnessEvent("daemon_request", request);
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

      recordLiveHarnessEvent("daemon_response", reply.payload);
      return reply.payload;
    },
    subscribeEvents(onEvent) {
      eventListeners.add(onEvent);
      return {
        unsubscribe: () => {
          eventListeners.delete(onEvent);
        }
      };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      const terminalStreamUrl = new URL(terminalUrl, window.location.href);
      terminalStreamUrl.searchParams.set("session_id", sessionId);
      terminalStreamUrl.searchParams.set("subscription_id", subscriptionId);
      const source = new EventSource(terminalStreamUrl.toString());
      source.addEventListener("daemon_event", (event) => {
        const daemonEvent = JSON.parse(event.data) as DaemonEvent;
        recordLiveHarnessEvent("daemon_event", daemonEvent);
        eventListeners.forEach((listener) => listener(daemonEvent));
        onEvent(daemonEvent);
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
    recordLiveHarnessEvent("hub_frame", frame);
    queueMicrotask(() => ingress?.(frame));
  };
  const emitResponse = (response: DaemonResponse) => {
    for (const frame of daemonResponseFrames(response, sequence++)) {
      emit(frame);
    }
  };
  let daemonEventSubscription: { unsubscribe(): void } | undefined;

  return {
    async connect(_capabilities, nextIngress) {
      ingress = nextIngress;
      daemonEventSubscription = bridge.subscribeEvents?.((event) => {
        const frame = daemonEventFrame(event, sequence++);
        if (frame) {
          emit(frame);
        }
      });
      emit({ kind: "hello_ack", payload: { mode: "real_hub_dogfood" } });
      emitResponse(await bridge.request({ type: "status" }));
    },
    async disconnect() {
      daemonEventSubscription?.unsubscribe();
      daemonEventSubscription = undefined;
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
        } else if (request.family === packageFamily) {
          emitResponse(await bridge.request({ type: "list_packages" }));
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
        records: [statusRecord(response.status, response.diagnostics)]
      } satisfies EntityFrame
    });
  }

  if (responseOwnsSessions(response) && Array.isArray(response.sessions)) {
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

  if (responseOwnsPackages(response) && Array.isArray(response.packages)) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: packageFamily,
        sequence,
        records: response.packages.map(packageRecord)
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

  for (const diagnostic of responseDiagnostics(response)) {
    frames.push(connectionDiagnosticFrame(diagnostic));
  }

  return frames;
}

function responseOwnsSessions(response: DaemonResponse): boolean {
  return response.kind === "sessions" || response.kind === "spawned";
}

function responseOwnsPackages(response: DaemonResponse): boolean {
  return response.kind === "packages";
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
          ...sessionAttachFields(event.session_id, event.state),
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
          ...sessionAttachFields(event.session_id, "exited"),
          last_result: `process exited${typeof event.code === "number" ? ` with ${event.code}` : ""}`
        }
      } satisfies EntityFrame
    };
  }

  if (event.type === "runtime_observation") {
    return connectionDiagnosticFrame({
      kind: event.kind,
      message: `Runtime observation: ${event.kind}`
    });
  }

  return undefined;
}

function statusRecord(
  status: NonNullable<DaemonResponse["status"]>,
  responseDiagnostics: HubConnectionDiagnosticPayload[] = []
) {
  return {
    id: "local-hub",
    title: status.host_display_name,
    status: status.lifecycle_state,
    host_id: status.host_id,
    schema_version: status.schema_version,
    compatibility: status.compatibility,
    sessions: status.session_count,
    packages: status.package_count,
    state_source: status.state_source,
    diagnostics: [...(status.diagnostics ?? []), ...responseDiagnostics]
  };
}

function sessionRecord(session: DaemonSession) {
  return {
    title: session.session_id,
    target: "isolated-local-hub",
    last_result: `daemon session ${session.lifecycle}`,
    ...sessionAttachFields(session.session_id, session.lifecycle)
  };
}

function sessionAttachFields(sessionId: string, lifecycle: string) {
  const isRunning = lifecycle === "running";

  return {
    id: sessionId,
    status: lifecycle,
    attachable: isRunning,
    attach_status: isRunning ? "Attachable" : "Exited sessions cannot attach",
    attach_action: {
      id: "botster.session.attach",
      target: sessionId,
      label: isRunning ? `Attach ${sessionId}` : "Not attachable",
      disabled: !isRunning,
      params: { mode: "real_hub_dogfood" }
    } satisfies ActionBinding
  };
}

function packageRecord(packageRecord: DaemonPackage) {
  const capabilities = packageRecord.requested_capabilities ?? [];
  const runnableEntrypoints = packageRecord.runnable_entrypoints ?? [];
  const capabilitySummary =
    capabilities.length === 0
      ? "No requested capabilities"
      : capabilities.map(capabilityLabel).join(", ");
  const providerProfile = packageRecord.provider_profile_admitted
    ? "Provider profile admitted"
    : "No provider profile admission";
  const entrypointSummary = entrypointListSummary(runnableEntrypoints);
  const entrypointProcessSummary = entrypointProcessListSummary(runnableEntrypoints);
  const entrypointDiagnosticsSummary = entrypointDiagnosticsListSummary(runnableEntrypoints);

  return {
    id: packageRecord.package_name,
    title: packageRecord.package_name,
    version: packageRecord.version,
    status: packageRecord.state,
    classification: packageRecord.classification,
    capability_summary: capabilitySummary,
    compatibility_summary: providerProfile,
    runnable_entrypoints: runnableEntrypoints,
    entrypoint_count: runnableEntrypoints.length,
    entrypoint_summary: entrypointSummary,
    entrypoint_process_summary: entrypointProcessSummary,
    entrypoint_diagnostics_summary: entrypointDiagnosticsSummary,
    diagnostics_summary: `${packageRecord.classification} package is ${packageRecord.state}`
  };
}

function capabilityLabel(capability: { surface: string; scope?: string | null }) {
  return capability.scope ? `${capability.surface}:${capability.scope}` : capability.surface;
}

function entrypointListSummary(entrypoints: DaemonPackage["runnable_entrypoints"]) {
  if (entrypoints.length === 0) {
    return "No runnable entrypoints";
  }

  return entrypoints
    .map((entrypoint) => `${entrypoint.id} (${entrypoint.kind})`)
    .join("; ");
}

function entrypointProcessListSummary(entrypoints: DaemonPackage["runnable_entrypoints"]) {
  if (entrypoints.length === 0) {
    return "No entrypoint process state";
  }

  return entrypoints
    .map((entrypoint) => {
      const process = entrypoint.process;
      const details = [
        process.pid ? `pid ${process.pid}` : undefined,
        process.started_at ? `started_at ${process.started_at}` : undefined,
        process.exited_at ? `exited_at ${process.exited_at}` : undefined,
        process.exit_status ? `exit_status ${process.exit_status}` : undefined
      ].filter((detail): detail is string => typeof detail === "string");

      return `${entrypoint.id} ${process.state}${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
    })
    .join("; ");
}

function entrypointDiagnosticsListSummary(entrypoints: DaemonPackage["runnable_entrypoints"]) {
  const diagnostics = entrypoints.flatMap((entrypoint) =>
    (entrypoint.process.diagnostics ?? []).map((diagnostic) => `${entrypoint.id} ${diagnostic.kind}: ${diagnostic.message}`)
  );

  return diagnostics.length === 0 ? "No entrypoint diagnostics" : diagnostics.join("; ");
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

  if (action.id === "botster.session.attach") {
    const targetSessionId = action.target ?? "";
    if (!targetSessionId) {
      emit(actionResultFrame(request, false, "Real hub attach action is missing a session target"));
      return;
    }

    emit(
      actionResultFrame(request, true, undefined, {
        session_id: targetSessionId,
        state: "selected",
        mode: "real_hub_dogfood"
      })
    );
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

function connectionDiagnosticFrame(diagnostic: HubConnectionDiagnosticPayload): HubControlFrame {
  return {
    kind: "connection_diagnostic",
    payload: diagnostic
  };
}

function responseDiagnostics(response: DaemonResponse): DaemonDiagnostic[] {
  const diagnostics: DaemonDiagnostic[] = [];

  if (Array.isArray(response.status?.diagnostics)) {
    diagnostics.push(...response.status.diagnostics);
  }

  if (Array.isArray(response.diagnostics)) {
    diagnostics.push(...response.diagnostics);
  }

  return diagnostics;
}

export function defaultSpawnCommand(): string {
  return "printf 'botster-web-dogfood-ready\\n'; while IFS= read -r line; do if [ \"$line\" = 'botster-web-dogfood-size' ]; then set -- $(stty size 2>/dev/null || printf '0 0'); printf 'botster-web-dogfood-size:%sx%s\\n' \"$1\" \"$2\"; elif [ \"$line\" = 'botster-web-dogfood-exit' ]; then printf 'botster-web-dogfood-exiting\\n'; exit 0; else printf 'botster-web-dogfood-echo:%s\\n' \"$line\"; fi; done";
}

function createRequestIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function recordLiveHarnessEvent(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      events?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.events?.push({ kind, payload });
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
                  text: `Spawn creates ${realHubDogfoodSessionId}, runs the dogfood readiness command, and sends output to the terminal panel.`
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
                    label: `Spawn ${realHubDogfoodSessionId} to terminal`,
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
          id: "real-hub-package-list",
          primitive: "list",
          props: { label: "Installed packages" },
          bindings: [{ source: "entity", path: `/${packageFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-package-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "real-hub-package-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "real-hub-package-state", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] },
                    { id: "real-hub-package-version", primitive: "text", bindings: [{ source: "entity", path: "@/version", prop: "text" }] },
                    { id: "real-hub-package-classification", primitive: "text", bindings: [{ source: "entity", path: "@/classification", prop: "text" }] },
                    { id: "real-hub-package-capabilities", primitive: "text", bindings: [{ source: "entity", path: "@/capability_summary", prop: "text" }] },
                    { id: "real-hub-package-compatibility", primitive: "text", bindings: [{ source: "entity", path: "@/compatibility_summary", prop: "text" }] },
                    { id: "real-hub-package-entrypoints", primitive: "text", bindings: [{ source: "entity", path: "@/entrypoint_summary", prop: "text" }] },
                    { id: "real-hub-package-entrypoint-processes", primitive: "text", bindings: [{ source: "entity", path: "@/entrypoint_process_summary", prop: "text" }] },
                    { id: "real-hub-package-entrypoint-diagnostics", primitive: "text", bindings: [{ source: "entity", path: "@/entrypoint_diagnostics_summary", prop: "text" }] },
                    { id: "real-hub-package-diagnostics", primitive: "text", bindings: [{ source: "entity", path: "@/diagnostics_summary", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "real-hub-packages-empty",
                primitive: "empty_state",
                props: { title: "No installed packages", body: "This daemon returned an empty package registry." }
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
                    { id: "real-hub-session-result", primitive: "text", bindings: [{ source: "entity", path: "@/last_result", prop: "text" }] },
                    { id: "real-hub-session-attach-status", primitive: "text", bindings: [{ source: "entity", path: "@/attach_status", prop: "text" }] },
                    { id: "real-hub-session-attach-action", primitive: "action", bindings: [{ source: "entity", path: "@/attach_action", prop: "action" }] }
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
            title: "Diagnostic action failure",
            submit: {
              id: "botster.session.rename",
              target: "missing-real-hub-session",
              label: "Run missing-session diagnostic",
              params: { mode: "real_hub_dogfood_error" }
            }
          },
          bindings: [{ source: "entity", path: `/${draftFamily}/draft-1/fields`, prop: "fields" }]
        },
        {
          id: "real-hub-diagnostic-action-status",
          primitive: "text",
          bindings: [{ source: "local_state", path: "dogfood.diagnostic_action_status", prop: "text" }]
        }
      ]
    }
  }
};
