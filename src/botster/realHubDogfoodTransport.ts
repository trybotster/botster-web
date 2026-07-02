import type { ActionBinding, UiActionRequest } from "./actions";
import { hubStatusFamily } from "./connectionDiagnostics";
import type { EntityFrame } from "./entities";
import type { HubControlFrame, HubControlFrameHandler, HubControlTransport } from "./protocol";
import type {
  DaemonBridgeRequestEnvelope,
  DaemonBridgeResponseEnvelope,
  DaemonApp,
  DaemonDiagnostic,
  DaemonEvent,
  DaemonOperatorError,
  DaemonAvailablePackage,
  DaemonPackage,
  DaemonPackageActionRequest,
  DaemonPackageActionState,
  DaemonPackageConfiguration,
  DaemonPackageRunnableEntrypoint,
  DaemonPackageSurfaceDescriptor,
  DaemonRequest,
  DaemonResponse,
  DaemonSession,
  JsonValue
} from "./realHubDaemonDto";
import type { UiTreeSnapshot } from "./uiNodes";

export const realHubDogfoodSessionId = "botster-web-dogfood-session";
export const realHubDogfoodSubscriptionId = "botster-web-dogfood-terminal";

const dogfoodSurface = "botster-web.dogfood.session";
const sessionFamily = "botster-web.session";
const draftFamily = "botster-web.session_draft";
const appFamily = "botster-web.app";
const packageFamily = "botster-web.package";
const availablePackageFamily = "botster-web.available_package";
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
        const request = frame.payload as { family?: unknown; registry_path?: unknown };
        if (request.family === statusFamily) {
          emitResponse(await bridge.request({ type: "status" }));
        } else if (request.family === sessionFamily) {
          emitResponse(await bridge.request({ type: "list_sessions" }));
        } else if (request.family === appFamily) {
          emitResponse(await bridge.request({ type: "list_apps" }));
        } else if (request.family === packageFamily) {
          emitResponse(await bridge.request({ type: "list_packages" }));
        } else if (request.family === availablePackageFamily) {
          const registryPath = typeof request.registry_path === "string" ? request.registry_path : "";
          if (registryPath) {
            emitResponse(await bridge.request({ type: "list_available_packages", registry_path: registryPath }));
          } else {
            emit({
              kind: "entity_snapshot",
              payload: {
                operation: "entity_snapshot",
                family: availablePackageFamily,
                sequence: sequence++,
                records: []
              } satisfies EntityFrame
            });
          }
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

  if (responseOwnsApps(response)) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: appFamily,
        sequence,
        records: (response.apps ?? []).map(appRecord)
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

  if (responseOwnsAvailablePackages(response) && Array.isArray(response.available_packages)) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: availablePackageFamily,
        sequence,
        records: response.available_packages.map(availablePackageRecord)
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

function responseOwnsApps(response: DaemonResponse): boolean {
  return response.kind === "apps";
}

function responseOwnsPackages(response: DaemonResponse): boolean {
  return response.kind === "packages" || response.kind === "package_decision" || response.kind === "package_update_status";
}

function responseOwnsAvailablePackages(response: DaemonResponse): boolean {
  return response.kind === "available_packages" || response.kind === "package_install_plan";
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

function appRecord(app: DaemonApp) {
  const actions = packageActionRecords(app.actions, app.package_name, app.entrypoint_id);
  const blockedReasons = app.blocked_reasons ?? [];
  const diagnostics = [
    ...blockedReasons,
    ...(app.diagnostics ?? []).map((diagnostic) => `${diagnostic.kind}: ${diagnostic.message}`),
    ...actions.flatMap((action) => [
      action.status === "available" ? "" : `${action.action_id} ${action.status}`,
      action.reason
    ]).filter((message): message is string => Boolean(message))
  ];
  const localUrl = app.launch_target.local_url ?? "";
  const isWebApp = app.kind === "web_app" || app.launch_target.kind === "web_app";
  const isTerminalApp = app.kind === "terminal_app" || app.launch_target.kind === "terminal_app";
  const missingLocalUrl = isWebApp && localUrl.length === 0;
  const blockedAction = actions.some((action) => action.status !== "available");
  const openDisabled = isTerminalApp || missingLocalUrl || blockedReasons.length > 0 || blockedAction;
  const title = app.app_id === app.package_name ? app.package_name : `${app.package_name} ${app.app_id}`;

  return {
    id: `${app.package_name}:${app.app_id}`,
    title,
    package_name: app.package_name,
    app_id: app.app_id,
    entrypoint_id: app.entrypoint_id,
    kind: app.kind,
    launch_mode: app.launch_mode,
    lifecycle_state: app.lifecycle_state,
    launch_target_kind: app.launch_target.kind,
    local_url: localUrl,
    blocked_reasons: blockedReasons,
    diagnostics,
    diagnostics_summary: appDiagnosticSummary({
      isTerminalApp,
      missingLocalUrl,
      diagnostics,
      lifecycleState: app.lifecycle_state
    }),
    app_actions: actions,
    app_action_summary: actionListSummary(actions, "No app actions returned"),
    open_action: {
      id: "botster.app.open_url",
      target: `${app.package_name}:${app.app_id}`,
      label: isTerminalApp ? "Launch in terminal" : "Open app",
      disabled: openDisabled,
      params: {
        package_name: app.package_name,
        app_id: app.app_id,
        entrypoint_id: app.entrypoint_id,
        kind: app.kind,
        launch_target_kind: app.launch_target.kind,
        local_url: localUrl,
        blocked_reasons: blockedReasons,
        diagnostics
      }
    } satisfies ActionBinding
  };
}

function appDiagnosticSummary({
  isTerminalApp,
  missingLocalUrl,
  diagnostics,
  lifecycleState
}: {
  isTerminalApp: boolean;
  missingLocalUrl: boolean;
  diagnostics: string[];
  lifecycleState: string;
}): string {
  if (isTerminalApp) return "Requires local terminal launch.";
  if (missingLocalUrl) return "Web app has no hub-provided local URL.";
  if (diagnostics.length > 0) return diagnostics.join("; ");
  return `Lifecycle: ${lifecycleState}`;
}

function packageRecord(packageRecord: DaemonPackage) {
  const capabilities = packageRecord.requested_capabilities ?? [];
  const runnableEntrypoints = packageRecord.runnable_entrypoints ?? [];
  const appSurfaces = packageSurfaceRecords(packageRecord, "app");
  const settingsSurfaces = packageSurfaceRecords(packageRecord, "settings");
  const configurationFields = packageConfigurationFields(packageRecord.configuration);
  const configurable = configurationFields.length > 0;
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
  const packageActions = packageActionRecords(packageRecord.actions, packageRecord.package_name);
  const configurationSubmit = packageActionBinding(
    packageRecord.actions?.find((action) => action.action_id === "set_package_configuration"),
    packageRecord.package_name
  );

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
    availability_state: packageRecord.availability?.state ?? "",
    availability_summary: availabilitySummary(packageRecord.availability?.reasons),
    dependency_availability: availabilityMatrixRecords(packageRecord.dependency_availability),
    dependency_availability_summary: availabilityMatrixSummary(packageRecord.dependency_availability, "No dependency gates"),
    feature_availability: availabilityMatrixRecords(packageRecord.feature_availability),
    feature_availability_summary: availabilityMatrixSummary(packageRecord.feature_availability, "No feature gates"),
    has_app_surfaces: appSurfaces.length > 0,
    app_surface_count: appSurfaces.length,
    app_surfaces: appSurfaces,
    app_surface_summary: surfaceListSummary(appSurfaces, "No app surfaces"),
    has_settings_surfaces: settingsSurfaces.length > 0,
    settings_surface_count: settingsSurfaces.length,
    settings_surfaces: settingsSurfaces,
    settings_surface_summary: surfaceListSummary(settingsSurfaces, "No settings surfaces"),
    configurable,
    configure_action: configurable && configurationSubmit
      ? {
          id: "botster.package.configure",
          target: packageRecord.package_name,
          label: `Configure ${packageRecord.package_name}`,
          params: { package_name: packageRecord.package_name }
        } satisfies ActionBinding
      : undefined,
    configuration_title: `${packageRecord.package_name} configuration`,
    configuration_fields: configurationFields,
    configuration_submit: configurationSubmit
      ? {
          ...configurationSubmit,
          id: "botster.package.configuration.save",
          label: configurationSubmit.label ?? "Save configuration"
        } satisfies ActionBinding
      : undefined,
    package_actions: packageActions,
    package_action_summary: actionListSummary(packageActions, "No package actions returned"),
    entrypoint_actions: runnableEntrypoints.flatMap((entrypoint) => entrypointActionRecords(packageRecord.package_name, entrypoint)),
    diagnostics_summary: `${packageRecord.classification} package is ${packageRecord.state}`
  };
}

function availablePackageRecord(packageRecord: DaemonAvailablePackage) {
  const actions = packageActionRecords(packageRecord.actions, packageRecord.package_name);

  return {
    id: packageRecord.entry_id,
    entry_id: packageRecord.entry_id,
    package_name: packageRecord.package_name,
    title: packageRecord.package_name,
    version: packageRecord.version,
    status: packageRecord.state,
    classification: packageRecord.classification,
    source_kind: packageRecord.source_kind,
    source_label: packageRecord.source_label,
    first_party: packageRecord.first_party,
    capability_summary: (packageRecord.requested_capabilities ?? []).length === 0
      ? "No requested capabilities"
      : packageRecord.requested_capabilities.map(capabilityLabel).join(", "),
    compatibility_summary: packageRecord.compatibility.diagnostics.length === 0
      ? packageRecord.compatibility.result
      : `${packageRecord.compatibility.result}: ${packageRecord.compatibility.diagnostics.join("; ")}`,
    package_actions: actions,
    package_action_summary: actionListSummary(actions, "No marketplace actions returned")
  };
}

function packageSurfaceRecords(packageRecord: DaemonPackage, kind: "app" | "settings") {
  return [...(packageRecord.surfaces ?? [])]
    .filter((surface) => surface.kind === kind)
    .sort(compareSurfaceDescriptors)
    .map((surface) => ({
      id: `${packageRecord.package_name}:${surface.id}`,
      surface_id: surface.id,
      kind: surface.kind,
      title: surface.title,
      description: surface.description ?? "",
      icon: surface.icon ?? "",
      category: surface.category ?? "",
      supports: surface.supports ?? [],
      launch_action: {
        id: "botster.package.surface.render",
        target: packageRecord.package_name,
        label: surface.title,
        params: {
          package_name: packageRecord.package_name,
          surface_id: surface.id,
          surface_kind: surface.kind,
          supports: surface.supports ?? []
        }
      } satisfies ActionBinding
    }));
}

function compareSurfaceDescriptors(left: DaemonPackageSurfaceDescriptor, right: DaemonPackageSurfaceDescriptor): number {
  const leftOrder = typeof left.order === "number" ? left.order : Number.POSITIVE_INFINITY;
  const rightOrder = typeof right.order === "number" ? right.order : Number.POSITIVE_INFINITY;
  return leftOrder - rightOrder || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function surfaceListSummary(surfaces: ReturnType<typeof packageSurfaceRecords>, empty: string): string {
  return surfaces.length === 0 ? empty : surfaces.map((surface) => `${surface.title} (${surface.surface_id})`).join("; ");
}

function entrypointActionRecords(packageName: string, entrypoint: DaemonPackageRunnableEntrypoint) {
  return packageActionRecords(entrypoint.actions, packageName, entrypoint.id);
}

function packageActionRecords(actions: DaemonPackageActionState[] | undefined, packageName: string, entrypointId?: string) {
  return (actions ?? []).map((action) => ({
    id: `${packageName}:${entrypointId ? `${entrypointId}:` : ""}${action.action_id}`,
    action_id: action.action_id,
    status: action.status,
    reason: action.reason ?? "",
    diagnostics: (action.diagnostics ?? []).map((diagnostic) => `${diagnostic.kind}: ${diagnostic.message}`),
    required_references: action.required_references ?? [],
    action: packageActionBinding(action, packageName, entrypointId)
  }));
}

function packageActionBinding(action: DaemonPackageActionState | undefined, packageName: string, entrypointId?: string): ActionBinding | undefined {
  if (!action) return undefined;

  return {
    id: "botster.package.daemon_request",
    target: action.request?.package_name ?? packageName,
    label: actionLabel(action.action_id),
    disabled: action.status !== "available" || !action.request,
    params: {
      package_name: action.request?.package_name ?? packageName,
      entrypoint_id: action.request?.entrypoint_id ?? entrypointId,
      action_id: action.action_id,
      action_status: action.status,
      action_reason: action.reason ?? "",
      daemon_request: action.request
    }
  };
}

function actionListSummary(actions: ReturnType<typeof packageActionRecords>, empty: string): string {
  return actions.length === 0
    ? empty
    : actions.map((action) => `${action.action_id} ${action.status}${action.reason ? ` (${action.reason})` : ""}`).join("; ");
}

function actionLabel(actionId: string): string {
  return actionId
    .replace(/^set_package_configuration$/, "configure")
    .replace(/^package_entrypoint_status$/, "refresh entrypoint")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function availabilitySummary(reasons: DaemonPackage["availability"]["reasons"] | undefined): string {
  return reasons && reasons.length > 0
    ? reasons.map((reason) => `${reason.action}: ${reason.reason}`).join("; ")
    : "No blocked reasons";
}

function availabilityMatrixRecords(
  rows: Array<{ id: string; state: string; package_name?: string; reasons?: DaemonPackage["availability"]["reasons"] }> | undefined
) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    package_name: row.package_name ?? "",
    state: row.state,
    reasons: availabilitySummary(row.reasons)
  }));
}

function availabilityMatrixSummary(
  rows: Array<{ id: string; state: string; package_name?: string; reasons?: DaemonPackage["availability"]["reasons"] }> | undefined,
  empty: string
): string {
  return rows && rows.length > 0
    ? rows.map((row) => `${row.id} ${row.state}${row.reasons && row.reasons.length > 0 ? ` (${availabilitySummary(row.reasons)})` : ""}`).join("; ")
    : empty;
}

function packageConfigurationFields(configuration: DaemonPackageConfiguration | undefined) {
  const schema = readConfigObject(configuration?.schema);
  const fields = Array.isArray(schema.fields) ? schema.fields.filter(isRecord) : [];
  const effectiveValues = isRecord(configuration?.effective_values) ? configuration.effective_values : {};
  const missingRequired = Array.isArray(configuration?.missing_required)
    ? configuration.missing_required.filter((key): key is string => typeof key === "string")
    : [];
  const diagnostics = Array.isArray(configuration?.diagnostics) ? configuration.diagnostics : [];

  return fields.map((field) => {
    const id = readConfigString(field.key);
    const configType = readConfigString(field.type, "string");
    const value = effectiveValues[id];
    const redactedSecret = isSecretValue(value, "redacted");
    const errors = [
      ...(missingRequired.includes(id) ? ["Required configuration is missing."] : []),
      ...diagnostics.map((diagnostic) => diagnostic.message).filter((message): message is string => typeof message === "string")
    ];

    return {
      id,
      label: readConfigString(field.label, id),
      kind: formFieldKind(configType),
      config_type: configType,
      required: field.required === true,
      value: redactedSecret ? "" : configurationValue(value),
      secret_state: redactedSecret ? "redacted" : undefined,
      placeholder: redactedSecret ? "Existing secret is saved" : undefined,
      helper: redactedSecret ? "Leave blank to keep the existing secret." : readConfigString(field.description, undefined),
      options: readConfigOptions(field.options),
      errors
    };
  });
}

function formFieldKind(configType: string): string {
  if (configType === "multiline_text") return "textarea";
  if (configType === "boolean") return "checkbox";
  if (configType === "select") return "select";
  if (configType === "secret") return "secret";
  return "text_input";
}

function configurationValue(value: unknown): unknown {
  if (!isRecord(value)) return "";
  if (value.type === "boolean") return value.value === true;
  if (typeof value.value === "string" || typeof value.value === "number") return value.value;
  return "";
}

function isSecretValue(value: unknown, state: string): boolean {
  return isRecord(value) && value.type === "secret" && value.state === state;
}

function readConfigOptions(value: unknown) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((option) => ({
      value: readConfigString(option.value),
      label: readConfigString(option.label, readConfigString(option.value))
    }))
    : [];
}

function readConfigObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readConfigString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonObject(value: unknown): Record<string, JsonValue> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, JsonValue] => isJsonValue(entry[1]))) : {};
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
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

  if (action.id === "botster.package.configure") {
    emit(
      actionResultFrame(request, true, undefined, {
        package_name: action.target,
        state: "selected"
      })
    );
    return;
  }

  if (action.id === "botster.package.configuration.save") {
    const packageName = action.target ?? readConfigString(action.params?.package_name);
    if (!packageName) {
      emit(actionResultFrame(request, false, "Package configuration save is missing a package target"));
      return;
    }

    const response = await bridge.request(packageConfigurationRequest(packageName, action));
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      package_name: packageName,
      kind: response.kind,
      diagnostics: responseDiagnostics(response)
    }));
    return;
  }

  if (action.id === "botster.package.surface.render") {
    const packageName = action.target ?? readConfigString(action.params?.package_name);
    const surfaceId = readConfigString(action.params?.surface_id);
    if (!packageName || !surfaceId) {
      emit(actionResultFrame(request, false, "Package surface render is missing a package or surface target"));
      return;
    }

    const response = await bridge.request({
      type: "plugin_surface_render",
      package_name: packageName,
      surface_id: surfaceId,
      payload: jsonObject(action.params?.payload)
    });
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      package_name: packageName,
      surface_id: surfaceId,
      kind: response.kind,
      plugin_surface: response.plugin_surface
    }));
    return;
  }

  if (action.id === "botster.package.daemon_request") {
    const daemonRequest = daemonRequestFromAction(action);
    if (!daemonRequest) {
      emit(actionResultFrame(request, false, "Package action is missing a hub-provided daemon request"));
      return;
    }

    const response = await bridge.request(daemonRequest);
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      request_type: daemonRequest.type,
      kind: response.kind,
      package_decision: response.package_decision,
      install_plan: response.install_plan,
      update_status: response.update_status,
      diagnostics: responseDiagnostics(response)
    }));
    return;
  }

  emit(actionResultFrame(request, false, `Unsupported real hub action: ${action.id}`));
}

function packageConfigurationRequest(packageName: string, action: ActionBinding): DaemonRequest {
  const daemonRequest = daemonRequestFromAction(action);
  return {
    type: "set_package_configuration",
    package_name: daemonRequest?.type === "set_package_configuration" ? daemonRequest.package_name : packageName,
    values: jsonObject(action.params?.values)
  };
}

function daemonRequestFromAction(action: ActionBinding): DaemonRequest | undefined {
  const request = action.params?.daemon_request;
  if (!isRecord(request)) return undefined;
  return daemonRequestFromDescriptor(request as unknown as DaemonPackageActionRequest);
}

function daemonRequestFromDescriptor(request: DaemonPackageActionRequest): DaemonRequest | undefined {
  const packageName = request.package_name ?? "";
  const entrypointId = request.entrypoint_id ?? "";
  const entryId = request.entry_id ?? "";
  const registryPath = request.registry_path ?? "";
  const localPath = readConfigString((request as DaemonPackageActionRequest & { path?: unknown }).path);

  if (request.request_type === "install_package_local_path" && localPath) return { type: "install_package_local_path", path: localPath };
  if (request.request_type === "enable_package_local_path" && localPath) return { type: "enable_package_local_path", path: localPath };
  if (request.request_type === "enable_package" && packageName) return { type: "enable_package", package_name: packageName };
  if (request.request_type === "disable_package" && packageName) return { type: "disable_package", package_name: packageName };
  if (request.request_type === "remove_package" && packageName) return { type: "remove_package", package_name: packageName };
  if (request.request_type === "set_package_configuration" && packageName) {
    return { type: "set_package_configuration", package_name: packageName, values: {} };
  }
  if (request.request_type === "start_package_entrypoint" && packageName && entrypointId) {
    return { type: "start_package_entrypoint", package_name: packageName, entrypoint_id: entrypointId };
  }
  if (request.request_type === "stop_package_entrypoint" && packageName && entrypointId) {
    return { type: "stop_package_entrypoint", package_name: packageName, entrypoint_id: entrypointId };
  }
  if (request.request_type === "restart_package_entrypoint" && packageName && entrypointId) {
    return { type: "restart_package_entrypoint", package_name: packageName, entrypoint_id: entrypointId };
  }
  if (request.request_type === "package_entrypoint_status" && packageName && entrypointId) {
    return { type: "package_entrypoint_status", package_name: packageName, entrypoint_id: entrypointId };
  }
  if (request.request_type === "install_package_registry_entry" && registryPath && entryId) {
    return { type: "install_package_registry_entry", registry_path: registryPath, entry_id: entryId };
  }
  if (request.request_type === "check_package_update" && packageName) return { type: "check_package_update", package_name: packageName };
  if (request.request_type === "preview_package_update" && packageName && request.pin) {
    return { type: "preview_package_update", package_name: packageName, pin: request.pin };
  }
  if (request.request_type === "apply_package_update" && packageName && request.pin) {
    return { type: "apply_package_update", package_name: packageName, pin: request.pin };
  }
  return undefined;
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
                    { id: "real-hub-package-availability", primitive: "text", bindings: [{ source: "entity", path: "@/availability_summary", prop: "text" }] },
                    { id: "real-hub-package-dependency-gates", primitive: "text", bindings: [{ source: "entity", path: "@/dependency_availability_summary", prop: "text" }] },
                    { id: "real-hub-package-feature-gates", primitive: "text", bindings: [{ source: "entity", path: "@/feature_availability_summary", prop: "text" }] },
                    { id: "real-hub-package-app-surfaces", primitive: "text", bindings: [{ source: "entity", path: "@/app_surface_summary", prop: "text" }] },
                    { id: "real-hub-package-settings-surfaces", primitive: "text", bindings: [{ source: "entity", path: "@/settings_surface_summary", prop: "text" }] },
                    { id: "real-hub-package-configure-action", primitive: "action", bindings: [{ source: "entity", path: "@/configure_action", prop: "action" }] },
                    { id: "real-hub-package-action-summary", primitive: "text", bindings: [{ source: "entity", path: "@/package_action_summary", prop: "text" }] },
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
          id: "real-hub-available-package-list",
          primitive: "list",
          props: { label: "Available marketplace packages" },
          bindings: [{ source: "entity", path: `/${availablePackageFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-available-package-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "real-hub-available-package-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "real-hub-available-package-state", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] },
                    { id: "real-hub-available-package-source", primitive: "text", bindings: [{ source: "entity", path: "@/source_label", prop: "text" }] },
                    { id: "real-hub-available-package-compatibility", primitive: "text", bindings: [{ source: "entity", path: "@/compatibility_summary", prop: "text" }] },
                    { id: "real-hub-available-package-actions-summary", primitive: "text", bindings: [{ source: "entity", path: "@/package_action_summary", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "real-hub-available-packages-empty",
                primitive: "empty_state",
                props: { title: "No available packages", body: "No marketplace catalog rows have been returned by the daemon." }
              }
            ]
          }
        },
        {
          id: "real-hub-package-action-list",
          primitive: "list",
          props: { label: "Package lifecycle actions" },
          bindings: [{ source: "entity", path: `/${packageFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-package-action-buttons",
                primitive: "list",
                bindings: [{ source: "entity", path: "@/package_actions", prop: "items" }],
                slots: {
                  item: [
                    { id: "real-hub-package-action", primitive: "action", bindings: [{ source: "entity", path: "@/action", prop: "action" }] }
                  ]
                }
              }
            ]
          }
        },
        {
          id: "real-hub-app-list",
          primitive: "list",
          props: { label: "Installed apps" },
          bindings: [{ source: "entity", path: `/${appFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-app-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "real-hub-app-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "real-hub-app-kind", primitive: "badge", bindings: [{ source: "entity", path: "@/kind", prop: "text" }] },
                    { id: "real-hub-app-lifecycle", primitive: "text", bindings: [{ source: "entity", path: "@/lifecycle_state", prop: "text" }] },
                    { id: "real-hub-app-diagnostics", primitive: "text", bindings: [{ source: "entity", path: "@/diagnostics_summary", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "real-hub-apps-empty",
                primitive: "empty_state",
                props: { title: "No installed apps", body: "The daemon returned an empty installed app registry." }
              }
            ]
          }
        },
        {
          id: "real-hub-app-actions",
          primitive: "list",
          props: { label: "Launch installed apps" },
          bindings: [{ source: "entity", path: `/${appFamily}`, prop: "items" }],
          slots: {
            item: [
              { id: "real-hub-app-launch", primitive: "action", bindings: [{ source: "entity", path: "@/open_action", prop: "action" }] }
            ]
          }
        },
        {
          id: "real-hub-package-settings-surface-actions",
          primitive: "list",
          props: { label: "Open settings surfaces" },
          bindings: [{ source: "entity", path: `/${packageFamily}`, prop: "items", where: { has_settings_surfaces: true } }],
          slots: {
            item: [
              {
                id: "real-hub-package-settings-surface-launches",
                primitive: "list",
                bindings: [{ source: "entity", path: "@/settings_surfaces", prop: "items" }],
                slots: {
                  item: [
                    { id: "real-hub-package-settings-surface-launch", primitive: "action", bindings: [{ source: "entity", path: "@/launch_action", prop: "action" }] }
                  ]
                }
              }
            ]
          }
        },
        {
          id: "real-hub-plugin-surface-render-result",
          primitive: "section",
          props: { label: "Rendered package surface" },
          slots: {
            children: [
              {
                id: "real-hub-plugin-surface-render-result-heading",
                primitive: "heading",
                props: { level: 3, text: "Rendered package surface" }
              },
              {
                id: "real-hub-plugin-surface-render-result-text",
                primitive: "text",
                bindings: [{ source: "local_state", path: "dogfood.plugin_surface_status", prop: "text" }]
              }
            ]
          }
        },
        {
          id: "real-hub-package-configuration-list",
          primitive: "list",
          props: { label: "Package configuration" },
          bindings: [{ source: "entity", path: `/${packageFamily}`, prop: "items", where: { configurable: true } }],
          slots: {
            item: [
              {
                id: "real-hub-package-configuration-form",
                primitive: "form",
                bindings: [
                  { source: "entity", path: "@/configuration_title", prop: "title" },
                  { source: "entity", path: "@/configuration_fields", prop: "fields" },
                  { source: "entity", path: "@/configuration_submit", prop: "submit" }
                ]
              }
            ],
            empty: [
              {
                id: "real-hub-package-configuration-empty",
                primitive: "empty_state",
                props: { title: "No package configuration", body: "Installed packages did not expose configuration schema." }
              }
            ]
          }
        },
        {
          id: "real-hub-package-entrypoint-actions",
          primitive: "list",
          props: { label: "Entrypoint controls" },
          bindings: [{ source: "entity", path: `/${packageFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "real-hub-package-entrypoint-action-list",
                primitive: "list",
                bindings: [{ source: "entity", path: "@/entrypoint_actions", prop: "items" }],
                slots: {
                  item: [
                    { id: "real-hub-package-entrypoint-action", primitive: "action", bindings: [{ source: "entity", path: "@/action", prop: "action" }] }
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
