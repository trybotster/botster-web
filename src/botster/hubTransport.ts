import type { ActionBinding, ActionRequestEnvelope } from "./actions";
import type {
  PackageSurfaceDescriptor,
  PackageSurfaceKind,
  PackageSurfaceOperation
} from "@trybotster/ui-contract";
import { hubStatusFamily } from "./connectionDiagnostics";
import type { EntityFrame } from "./entities";
import type {
  EntitySubscriptionErrorPayload,
  HubControlFrame,
  HubControlFrameHandler,
  HubControlTransport
} from "./protocol";
import type {
  DaemonApp,
  DaemonDiagnostic,
  DaemonEntityFrame,
  DaemonEvent,
  DaemonOperatorError,
  DaemonAvailablePackage,
  DaemonPackage,
  DaemonPackageActionRequest,
  DaemonPackageActionState,
  DaemonPackageConfiguration,
  DaemonPackageNavigationEntry,
  DaemonPackageRouteDescriptor,
  DaemonPackageRunnableEntrypoint,
  DaemonRequest,
  DaemonResponse,
  DaemonSessionEntity,
  DaemonSessionType,
  DaemonSessionTypeDefinition,
  DaemonSessionTypeMutationSource,
  JsonValue
} from "./realHubDaemonDto";

export const hubTerminalSubscriptionId = "botster-web-terminal";

const sessionFamily = "session";
const sessionTypeFamily = "session_type";
const appFamily = "botster-web.app";
const packageNavigationFamily = "botster-web.package_navigation";
const packageFamily = "botster-web.package";
const availablePackageFamily = "botster-web.available_package";
const spawnTargetFamily = "botster-web.spawn_target";
const statusFamily = hubStatusFamily;

type HubConnectionDiagnosticPayload = Omit<Partial<DaemonDiagnostic>, "kind"> & { kind: string };

interface DaemonSpawnTarget {
  target_id: string;
  label: string;
  root: string;
  enabled: boolean;
  kind: string;
  metadata?: Record<string, string>;
}

export interface DaemonBridgeClient {
  request(request: DaemonRequest): Promise<DaemonResponse>;
  disconnect?(): void;
  subscribeEvents?(onEvent: (event: DaemonEvent) => void): { unsubscribe(): void };
  subscribeEntityFrames?(
    entityType: string,
    onFrame: (frame: DaemonEntityFrame) => void
  ): { ready: Promise<void>; unsubscribe(): void };
  streamTerminal?(
    sessionId: string,
    subscriptionId: string,
    onEvent: (event: DaemonEvent) => void
  ): { unsubscribe(): void };
}

export interface HubTransportOptions {
  bridge: DaemonBridgeClient;
}

export function createHubTransport({ bridge }: HubTransportOptions): HubControlTransport {
  let ingress: HubControlFrameHandler | undefined;
  let sequence = 1;

  const emit = (frame: HubControlFrame) => {
    recordLiveHarnessEvent("hub_frame", frame);
    queueMicrotask(() => ingress?.(frame));
  };
  const emitResponse = (response: DaemonResponse) => {
    recordLiveHarnessEvent("daemon_response", response);
    for (const frame of daemonResponseFrames(response, sequence++)) {
      emit(frame);
    }
  };
  // A failed subscription is both a transport fact and a surface fact, so emit both.
  const emitEntityFrame = (frame: DaemonEntityFrame) => {
    const diagnostic = entitySubscriptionDiagnosticFrame(frame);
    if (diagnostic) emit(diagnostic);
    const projected = daemonEntityFrame(frame);
    if (projected) emit(projected);
  };
  let daemonEventSubscription: { unsubscribe(): void } | undefined;
  let sessionEntitySubscription: { ready: Promise<void>; unsubscribe(): void } | undefined;
  let sessionTypeEntitySubscription: { ready: Promise<void>; unsubscribe(): void } | undefined;
  const ensureSessionEntitySubscription = () => {
    if (!sessionEntitySubscription) {
      if (!bridge.subscribeEntityFrames) {
        throw new Error("session entity subscription requires the WebRTC entity-frame delivery path");
      }
      sessionEntitySubscription = bridge.subscribeEntityFrames("session", emitEntityFrame);
    }
    return sessionEntitySubscription.ready;
  };
  const ensureSessionTypeEntitySubscription = () => {
    if (!sessionTypeEntitySubscription) {
      if (!bridge.subscribeEntityFrames) {
        throw new Error("session type entity subscription requires the WebRTC entity-frame delivery path");
      }
      sessionTypeEntitySubscription = bridge.subscribeEntityFrames(sessionTypeFamily, emitEntityFrame);
    }
    return sessionTypeEntitySubscription.ready;
  };

  return {
    async connect(_capabilities, nextIngress) {
      ingress = nextIngress;
      daemonEventSubscription = bridge.subscribeEvents?.((event) => {
        const frame = daemonEventFrame(event);
        if (frame) {
          emit(frame);
        }
      });
      emit({ kind: "hello_ack", payload: { mode: "hub" } });
      emitResponse(await bridge.request({ type: "status" }));
    },
    async disconnect() {
      daemonEventSubscription?.unsubscribe();
      daemonEventSubscription = undefined;
      sessionEntitySubscription?.unsubscribe();
      sessionEntitySubscription = undefined;
      sessionTypeEntitySubscription?.unsubscribe();
      sessionTypeEntitySubscription = undefined;
      ingress = undefined;
      bridge.disconnect?.();
    },
    async send(frame) {
      if (frame.kind === "subscribe") {
        await ensureSessionEntitySubscription();
        return;
      }

      if (frame.kind === "entity_pull") {
        const request = frame.payload as { family?: unknown; registry_path?: unknown };
        if (request.family === statusFamily) {
          emitResponse(await bridge.request({ type: "status" }));
        } else if (request.family === sessionFamily) {
          await ensureSessionEntitySubscription();
        } else if (request.family === sessionTypeFamily) {
          await ensureSessionTypeEntitySubscription();
        } else if (request.family === appFamily) {
          emitResponse(await bridge.request({ type: "list_apps" }));
        } else if (request.family === packageNavigationFamily) {
          emitResponse(await bridge.request({ type: "list_package_navigation" }));
        } else if (request.family === packageFamily) {
          emitResponse(await bridge.request({ type: "list_packages" }));
        } else if (request.family === spawnTargetFamily) {
          emitResponse(await bridge.request(spawnTargetDaemonRequest({ type: "list_spawn_targets" })));
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
        }
        return;
      }

      if (frame.kind === "action_request") {
        const request = frame.payload as ActionRequestEnvelope;
        await dispatchDaemonAction(bridge, request, emitResponse, emit);
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

  if (responseOwnsPackageNavigation(response)) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: packageNavigationFamily,
        sequence,
        records: (response.package_navigation ?? []).map(packageNavigationRecord)
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

  const spawnTargets = responseSpawnTargets(response);
  if (responseOwnsSpawnTargets(response) && spawnTargets) {
    frames.push({
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: spawnTargetFamily,
        sequence,
        records: spawnTargets.map(spawnTargetRecord)
      } satisfies EntityFrame
    });
  }

  if (Array.isArray(response.events)) {
    for (const event of response.events) {
      const frame = daemonEventFrame(event);
      if (frame) frames.push(frame);
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

function responseOwnsApps(response: DaemonResponse): boolean {
  return response.kind === "apps";
}

function responseOwnsPackageNavigation(response: DaemonResponse): boolean {
  return response.kind === "package_navigation";
}

function responseOwnsPackages(response: DaemonResponse): boolean {
  return response.kind === "packages" || response.kind === "package_decision";
}

function responseOwnsAvailablePackages(response: DaemonResponse): boolean {
  return response.kind === "available_packages" || response.kind === "package_install_plan";
}

function responseOwnsSpawnTargets(response: DaemonResponse): boolean {
  return String(response.kind) === "spawn_targets";
}

function responseSpawnTargets(response: DaemonResponse): DaemonSpawnTarget[] | undefined {
  const value = (response as unknown as { spawn_targets?: unknown }).spawn_targets;
  return Array.isArray(value) ? value.filter(isDaemonSpawnTarget) : undefined;
}

function responseSpawnTargetValidation(response: DaemonResponse): unknown {
  return (response as unknown as { spawn_target_validation?: unknown }).spawn_target_validation;
}

function isDaemonSpawnTarget(value: unknown): value is DaemonSpawnTarget {
  const record = readConfigObject(value);
  return (
    typeof record.target_id === "string" &&
    typeof record.label === "string" &&
    typeof record.root === "string" &&
    typeof record.enabled === "boolean" &&
    typeof record.kind === "string"
  );
}

export function daemonEventFrame(event: DaemonEvent): HubControlFrame | undefined {
  if (event.type === "runtime_observation") {
    return connectionDiagnosticFrame({
      kind: event.kind,
      message: `Runtime observation: ${event.kind}`
    });
  }

  return undefined;
}

interface CanonicalEntityProjection {
  family: string;
  record(value: unknown): (Record<string, unknown> & { id: string }) | undefined;
}

function canonicalEntityProjection(entityType: string): CanonicalEntityProjection | undefined {
  if (entityType === sessionFamily) {
    return {
      family: sessionFamily,
      record: (value) => (isDaemonSessionEntity(value) ? sessionEntityRecord(value) : undefined)
    };
  }

  if (entityType === sessionTypeFamily) {
    return {
      family: sessionTypeFamily,
      record: (value) => (isDaemonSessionType(value) ? sessionTypeEntityRecord(value) : undefined)
    };
  }

  return undefined;
}

/**
 * Connection-level view of a failed entity subscription, for the diagnostics panel. It is
 * emitted alongside -- not instead of -- the surface-scoped `entity_error` projection
 * below: the panel reports transport health for any entity type, while the owning surface
 * renders Hub's verbatim code and message for the family it subscribes to.
 */
export function entitySubscriptionDiagnosticFrame(frame: DaemonEntityFrame): HubControlFrame | undefined {
  if (frame.type !== "entity_error") return undefined;

  return connectionDiagnosticFrame({
    kind: frame.code,
    message: `Entity subscription error for ${frame.entity_type}: ${frame.message}`,
    operation: "subscribe_entities",
    feature: frame.entity_type
  });
}

export function daemonEntityFrame(frame: DaemonEntityFrame): HubControlFrame | undefined {
  const projection = canonicalEntityProjection(frame.entity_type);
  if (!projection) return undefined;

  if (frame.type === "entity_snapshot") {
    return {
      kind: "entity_snapshot",
      payload: {
        operation: "entity_snapshot",
        family: projection.family,
        sequence: frame.snapshot_seq,
        records: frame.items.flatMap((item) => {
          const record = projection.record(item);
          return record ? [record] : [];
        })
      } satisfies EntityFrame
    };
  }

  if (frame.type === "entity_remove") {
    return {
      kind: "entity_remove",
      payload: {
        operation: "entity_remove",
        key: { family: projection.family, id: frame.id },
        sequence: frame.snapshot_seq
      } satisfies EntityFrame
    };
  }

  if (frame.type === "entity_upsert") {
    const record = projection.record(frame.entity);
    if (!record) return undefined;

    return {
      kind: "entity_upsert",
      payload: {
        operation: "entity_upsert",
        key: { family: projection.family, id: frame.id },
        sequence: frame.snapshot_seq,
        record
      } satisfies EntityFrame
    };
  }

  // Hub reports a terminal subscription failure. Surface it verbatim; never refetch or resubscribe.
  if (frame.type === "entity_error") {
    return {
      kind: "entity_error",
      payload: {
        family: projection.family,
        code: frame.code,
        message: frame.message
      } satisfies EntitySubscriptionErrorPayload
    };
  }

  const patch = isRecord(frame.patch) ? frame.patch : {};
  return {
    kind: "entity_patch",
    payload: {
      operation: "entity_patch",
      key: { family: projection.family, id: frame.id },
      sequence: frame.snapshot_seq,
      record: {
        ...patch,
        id: frame.id
      }
    } satisfies EntityFrame
  };
}

function statusRecord(
  status: NonNullable<DaemonResponse["status"]>,
  responseDiagnostics: HubConnectionDiagnosticPayload[] = []
) {
  return {
    id: "local-hub",
    title: status.host_display_name,
    status: status.lifecycle_state,
    software: status.software,
    installation: status.installation,
    host_id: status.host_id,
    schema_version: status.schema_version,
    compatibility: status.compatibility,
    sessions: status.session_count,
    packages: status.package_count,
    state_source: status.state_source,
    diagnostics: [...(status.diagnostics ?? []), ...responseDiagnostics]
  };
}

function sessionEntityRecord(session: DaemonSessionEntity) {
  return {
    ...session,
    id: session.session_uuid
  };
}

/**
 * The entity store keys rows by `id`, but Hub's `id` is the bare authoring identifier that
 * create/update/delete address definitions by, while `session_type_id` is the composite
 * `{source_name}/{id}`. Keep the producer's bare id under its own key so mutations can use
 * it; overwriting `id` alone would make edit and delete send the composite and get
 * `unknown_session_type`.
 */
function sessionTypeEntityRecord(sessionType: DaemonSessionType) {
  return {
    ...sessionType,
    definition_id: sessionType.id,
    id: sessionType.session_type_id
  };
}

function isDaemonSessionType(value: unknown): value is DaemonSessionType {
  if (!isRecord(value)) return false;

  return (
    typeof value.session_type_id === "string" &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.source_name === "string" &&
    typeof value.editable === "boolean" &&
    typeof value.label === "string" &&
    typeof value.role === "string" &&
    typeof value.interaction === "string" &&
    typeof value.lifecycle === "string" &&
    typeof value.command === "string" &&
    typeof value.working_directory_policy === "string" &&
    typeof value.target_id === "string" &&
    typeof value.available === "boolean"
  );
}

function isDaemonSessionEntity(value: unknown): value is DaemonSessionEntity {
  if (!isRecord(value)) return false;

  return (
    typeof value.session_uuid === "string" &&
    typeof value.registry_state === "string" &&
    (value.lifecycle === undefined || value.lifecycle === null || typeof value.lifecycle === "string") &&
    typeof value.lifecycle_class === "string" &&
    typeof value.rows === "number" &&
    typeof value.cols === "number" &&
    typeof value.updated_at === "number" &&
    (value.exit_code === undefined || value.exit_code === null || typeof value.exit_code === "number") &&
    (value.failure_reason === undefined || value.failure_reason === null || typeof value.failure_reason === "string")
  );
}

function spawnTargetRecord(target: DaemonSpawnTarget) {
  return {
    id: target.target_id,
    target_id: target.target_id,
    title: target.label,
    label: target.label,
    root: target.root,
    enabled: target.enabled,
    status: target.enabled ? "enabled" : "disabled",
    kind: target.kind,
    metadata: target.metadata ?? {},
    metadata_summary: metadataSummary(target.metadata),
    edit_action: spawnTargetAction("update_spawn_target", target.target_id, "Save", {
      label: target.label,
      root: target.root,
      enabled: target.enabled,
      kind: target.kind,
      metadata: target.metadata ?? {}
    }),
    delete_action: spawnTargetAction("delete_spawn_target", target.target_id, "Delete")
  };
}

function metadataSummary(metadata: Record<string, string> | undefined): string {
  const entries = Object.entries(metadata ?? {});
  return entries.length === 0 ? "No metadata" : entries.map(([key, value]) => `${key}: ${value}`).join("; ");
}

function spawnTargetAction(requestType: string, targetId: string | undefined, label: string, values: Record<string, unknown> = {}): ActionBinding {
  return {
    id: "botster.spawn_target.daemon_request",
    target: targetId,
    label,
    params: {
      daemon_request: {
        request_type: requestType,
        target_id: targetId,
        ...values
      }
    }
  };
}

function appRecord(app: DaemonApp) {
  const actions = packageActionRecords(app.actions, app.package_name, app.entrypoint_id);
  const route = app.route ? packageRouteRecord(app.route) : undefined;
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
    route,
    route_path: route?.route_path,
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
  const routes = packageRouteRecords(packageRecord.routes);
  const appSurfaces = packageSurfaceRecords(packageRecord, "app", routes);
  const settingsSurfaces = packageSurfaceRecords(packageRecord, "settings", routes);
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
    routes,
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

function packageNavigationRecord(entry: DaemonPackageNavigationEntry) {
  const diagnostics = (entry.diagnostics ?? []).map((diagnostic) => `${diagnostic.kind}: ${diagnostic.message}`);
  const surfaceId = entry.source.surface_id ?? entry.target.surface_id ?? "";
  const entrypointId = entry.source.entrypoint_id ?? entry.target.entrypoint_id ?? "";
  const unavailable = !entry.enabled || entry.blocked;
  const renderablePluginSurface = entry.target.kind === "plugin_surface" && surfaceId.length > 0;
  return {
    id: `${entry.package_name}:${entry.item_id}`,
    package_name: entry.package_name,
    item_id: entry.item_id,
    label: entry.label,
    title: entry.label,
    icon: entry.icon ?? "",
    description: entry.description ?? "",
    route_id: entry.route_id,
    route_path: entry.route_path,
    target_kind: entry.target.kind,
    source_kind: entry.source.kind,
    surface_id: surfaceId,
    entrypoint_id: entrypointId,
    enabled: entry.enabled,
    blocked: entry.blocked,
    diagnostics,
    diagnostics_summary: diagnostics.length > 0 ? diagnostics.join("; ") : unavailable ? "Unavailable from hub navigation registry" : "",
    launch_action: unavailable || !renderablePluginSurface
      ? undefined
      : {
          id: "botster.package.surface.render",
          target: entry.package_name,
          label: entry.label,
          params: {
            package_name: entry.package_name,
            surface_id: surfaceId,
            route_id: entry.route_id,
            source_kind: entry.source.kind
          }
        } satisfies ActionBinding
  };
}

function packageSurfaceRecords(
  packageRecord: DaemonPackage,
  kind: Extract<PackageSurfaceKind, "app" | "settings">,
  routes: PackageRouteRecord[] = []
) {
  return [...(packageRecord.surfaces ?? [])]
    .filter((surface) => surface.kind === kind)
    .sort(compareSurfaceDescriptors)
    .map((surface) => {
      const route = routes.find((candidate) => candidate.surface_id === surface.id);
      const supports: PackageSurfaceOperation[] = surface.supports ?? [];
      return {
        id: `${packageRecord.package_name}:${surface.id}`,
        surface_id: surface.id,
        kind: surface.kind,
        title: surface.title,
        description: surface.description ?? "",
        icon: surface.icon ?? "",
        category: surface.category ?? "",
        supports,
        route,
        route_id: route?.route_id,
        route_path: route?.route_path,
        route_enabled: route?.enabled,
        route_blocked: route?.blocked,
        route_diagnostics: route?.diagnostics ?? [],
        launch_action: {
          id: "botster.package.surface.render",
          target: packageRecord.package_name,
          label: surface.title,
          ...(route?.enabled === false || route?.blocked === true ? { disabled: true } : {}),
          params: {
            package_name: packageRecord.package_name,
            surface_id: surface.id,
            surface_kind: surface.kind,
            supports
          }
        } satisfies ActionBinding
      };
    });
}

type PackageRouteRecord = ReturnType<typeof packageRouteRecord>;

function packageRouteRecords(routes: DaemonPackageRouteDescriptor[] | undefined): PackageRouteRecord[] {
  return [...(routes ?? [])]
    .sort(comparePackageRouteDescriptors)
    .map(packageRouteRecord);
}

function packageRouteRecord(route: DaemonPackageRouteDescriptor) {
  return {
    package_name: route.package_name,
    route_id: route.route_id,
    route_path: route.route_path,
    target_kind: route.target.kind,
    entrypoint_id: route.target.entrypoint_id ?? "",
    surface_id: route.surface_id ?? route.target.surface_id ?? "",
    title: route.title,
    label: route.label,
    app_id: route.app_id ?? "",
    icon: route.icon ?? "",
    category: route.category ?? "",
    layout_mode: route.layout_mode,
    required_capabilities: route.required_capabilities ?? [],
    enabled: route.enabled,
    blocked: route.blocked,
    diagnostics: route.diagnostics ?? [],
    supports_settings: route.supports_settings
  };
}

function comparePackageRouteDescriptors(left: DaemonPackageRouteDescriptor, right: DaemonPackageRouteDescriptor): number {
  return left.route_path.localeCompare(right.route_path) || left.route_id.localeCompare(right.route_id);
}

function compareSurfaceDescriptors(left: PackageSurfaceDescriptor, right: PackageSurfaceDescriptor): number {
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

async function dispatchDaemonAction(
  bridge: DaemonBridgeClient,
  request: ActionRequestEnvelope,
  emitResponse: (response: DaemonResponse) => void,
  emit: (frame: HubControlFrame) => void
) {
  const action = request.action;

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
        mode: "hub"
      })
    );
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

  if (action.id === "botster.hub.check_update") {
    const response = await bridge.request({ type: "check_hub_update" });
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      request_type: "check_hub_update",
      kind: response.kind,
      hub_update: response.hub_update ?? null,
      diagnostics: responseDiagnostics(response)
    }));
    return;
  }

  if (action.id === "botster.spawn_target.daemon_request") {
    const daemonRequest = spawnTargetRequestFromAction(action);
    if (!daemonRequest) {
      emit(actionResultFrame(request, false, "Spawn point action is missing a hub daemon request"));
      return;
    }

    const response = await bridge.request(daemonRequest);
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      request_type: daemonRequest.type,
      kind: response.kind,
      target_id: "target_id" in daemonRequest ? daemonRequest.target_id : undefined,
      spawn_targets: responseSpawnTargets(response),
      validation: responseSpawnTargetValidation(response),
      diagnostics: responseDiagnostics(response)
    }));
    return;
  }

  if (action.id === "botster.spawn_point.spawn_session") {
    const sessionTypeId = readConfigString(action.params?.session_type_id);
    const sessionId = readConfigString(action.params?.session_id);
    const targetId = action.target ?? readConfigString(action.params?.target_id);
    const prompt = readConfigString(action.params?.prompt).trim();
    if (!sessionTypeId || !sessionId || !targetId) {
      emit(actionResultFrame(request, false, "New session is missing a spawn point or session type"));
      return;
    }

    const response = await bridge.request({
      type: "spawn_session_type",
      session_type_id: sessionTypeId,
      session_id: sessionId,
      request: {
        target_id: targetId,
        context: prompt ? { prompt } : {}
      }
    });
    emitResponse(response);
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      request_type: "spawn_session_type",
      kind: response.kind,
      target_id: targetId,
      session_type_id: sessionTypeId,
      error_kind: response.error?.code,
      session_id: response.sessions?.[0]?.session_id ?? sessionId,
      diagnostics: responseDiagnostics(response)
    }));
    return;
  }

  if (action.id === "botster.session_type.daemon_request") {
    const daemonRequest = sessionTypeRequestFromAction(action);
    if (!daemonRequest) {
      emit(actionResultFrame(request, false, "Session type action is missing a hub daemon request"));
      return;
    }

    const response = await bridge.request(daemonRequest);
    emitResponse(response);
    // Hub owns validation, admission, and precedence. Report its verdict verbatim and
    // publish no optimistic entity frame; the held subscription delivers the truth.
    // Authoring reads carry session_type_definition so the form can seed a lossless edit.
    emit(actionResultFrame(request, !response.error, response.error?.message, {
      request_type: daemonRequest.type,
      kind: response.kind,
      error_kind: response.error?.code,
      diagnostics: responseDiagnostics(response),
      ...(response.session_type_definition
        ? { session_type_definition: response.session_type_definition }
        : {})
    }));
    return;
  }

  const pluginSurfaceAction = pluginSurfaceActionRequest(action, request.request_id);
  if (pluginSurfaceAction) {
    const response = await bridge.request({
      type: "plugin_surface_action",
      package_name: pluginSurfaceAction.packageName,
      request: pluginSurfaceAction.request
    });
    const pluginActionResult = response.plugin_action_result;
    const identityMatches = Boolean(
      pluginActionResult &&
      pluginActionResult.request_id === pluginSurfaceAction.request.request_id &&
      pluginActionResult.surface_id === pluginSurfaceAction.request.surface_id &&
      pluginActionResult.action_id === pluginSurfaceAction.request.action_id &&
      pluginActionResult.node_id === pluginSurfaceAction.request.node_id
    );
    const actionState = pluginActionResult?.state;
    const actionError = pluginActionResult?.error;
    const formError = pluginActionResult?.form_errors?.[0];
    emitResponse(response);
    emit(actionResultFrame(request, !response.error && identityMatches && actionState === "accepted", response.error?.message ?? actionError ?? formError ?? (!identityMatches ? "Plugin action result identity mismatch" : undefined), {
      package_name: pluginSurfaceAction.packageName,
      surface_id: pluginSurfaceAction.request.surface_id,
      action_id: pluginSurfaceAction.request.action_id,
      kind: response.kind,
      plugin_action_result: response.plugin_action_result
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

  emit(actionResultFrame(request, false, `Unsupported hub action: ${action.id}`));
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

function spawnTargetDaemonRequest(request: Record<string, unknown>): DaemonRequest {
  return request as unknown as DaemonRequest;
}

function spawnTargetRequestFromAction(action: ActionBinding): DaemonRequest | undefined {
  const request = action.params?.daemon_request;
  if (!isRecord(request)) return undefined;

  const requestType = readConfigString(request.request_type);
  const targetId = readConfigString(request.target_id);
  const label = readConfigString(request.label, undefined);
  const root = readConfigString(request.root);
  const kind = readConfigString(request.kind, undefined);
  const enabled = typeof request.enabled === "boolean" ? request.enabled : undefined;
  const metadata = stringRecord(request.metadata);

  if (requestType === "create_spawn_target" && root) {
    return spawnTargetDaemonRequest({
      type: "create_spawn_target",
      target_id: targetId || undefined,
      label,
      root,
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      kind,
      metadata
    });
  }

  if (requestType === "update_spawn_target" && targetId) {
    return spawnTargetDaemonRequest({
      type: "update_spawn_target",
      target_id: targetId,
      label,
      ...(root ? { root } : {}),
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      kind,
      metadata
    });
  }

  if (requestType === "delete_spawn_target" && targetId) {
    return spawnTargetDaemonRequest({ type: "delete_spawn_target", target_id: targetId });
  }

  if (requestType === "validate_spawn_target" && targetId) {
    return spawnTargetDaemonRequest({ type: "validate_spawn_target", target_id: targetId });
  }

  return undefined;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry): entry is string => typeof entry === "string");
  return entries.length > 0 ? entries : undefined;
}

function sessionTypeMutationSource(value: unknown): DaemonSessionTypeMutationSource | undefined {
  if (!isRecord(value)) return undefined;

  const source = readConfigString(value.source);
  if (source === "device") return { source: "device" };

  if (source === "repo") {
    const targetId = readConfigString(value.target_id);
    return targetId ? { source: "repo", target_id: targetId } : undefined;
  }

  if (source === "package") {
    const packageName = readConfigString(value.package_name);
    return packageName ? { source: "package", package_name: packageName } : undefined;
  }

  return undefined;
}

/**
 * Structural projection only. Every semantic rule -- token shape, role namespacing, trait
 * uniqueness, path safety, environment naming -- stays Hub-side and is reported by Hub.
 */
function sessionTypeDefinition(value: unknown): DaemonSessionTypeDefinition | undefined {
  if (!isRecord(value)) return undefined;

  const id = readConfigString(value.id);
  const label = readConfigString(value.label);
  const role = readConfigString(value.role);
  const interaction = readConfigString(value.interaction);
  const lifecycle = readConfigString(value.lifecycle);
  const command = readConfigString(value.command);
  if (!id || !label || !role || !interaction || !lifecycle || !command) return undefined;

  const workingDirectoryPath = readConfigString(isRecord(value.working_directory) ? value.working_directory.path : undefined);
  const workingDirectoryPolicy = readConfigString(isRecord(value.working_directory) ? value.working_directory.policy : undefined);
  const environment = stringRecord(value.environment);
  const targetId = readConfigString(value.target_id, "");

  return {
    id,
    label,
    ...(readConfigString(value.description, "") ? { description: readConfigString(value.description) } : {}),
    ...(readConfigString(value.icon, "") ? { icon: readConfigString(value.icon) } : {}),
    role,
    interaction,
    ...(stringList(value.traits) ? { traits: stringList(value.traits) } : {}),
    lifecycle,
    command,
    ...(stringList(value.args) ? { args: stringList(value.args) } : {}),
    ...(workingDirectoryPolicy === "relative" && workingDirectoryPath
      ? { working_directory: { policy: "relative" as const, path: workingDirectoryPath } }
      : workingDirectoryPolicy === "package_root"
        ? { working_directory: { policy: "package_root" as const } }
        : {}),
    ...(Object.keys(environment).length > 0 ? { environment } : {}),
    ...(stringList(value.allowed_environment_overrides)
      ? { allowed_environment_overrides: stringList(value.allowed_environment_overrides) }
      : {}),
    ...(stringList(value.context) ? { context: stringList(value.context) } : {}),
    ...(targetId ? { target_id: targetId } : {})
  };
}

function sessionTypeRequestFromAction(action: ActionBinding): DaemonRequest | undefined {
  const request = action.params?.daemon_request;
  if (!isRecord(request)) return undefined;

  const requestType = readConfigString(request.request_type);

  // Authoring read: composite session_type_id preferred. No mutation source on the wire.
  if (requestType === "show_session_type_definition") {
    const sessionTypeId = readConfigString(request.session_type_id);
    return sessionTypeId
      ? { type: "show_session_type_definition", session_type_id: sessionTypeId }
      : undefined;
  }

  const source = sessionTypeMutationSource(request.source);
  if (!source) return undefined;

  if (requestType === "create_session_type") {
    const definition = sessionTypeDefinition(request.definition);
    return definition ? { type: "create_session_type", source, definition } : undefined;
  }

  if (requestType === "update_session_type") {
    const definition = sessionTypeDefinition(request.definition);
    return definition ? { type: "update_session_type", source, definition } : undefined;
  }

  if (requestType === "delete_session_type") {
    const sessionTypeId = readConfigString(request.session_type_id);
    return sessionTypeId ? { type: "delete_session_type", source, session_type_id: sessionTypeId } : undefined;
  }

  return undefined;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, recordValue]) => (
      typeof recordValue === "string" ? [[key, recordValue]] : []
    ))
  );
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
  if (request.request_type === "reload_package" && packageName) return { type: "reload_package", package_name: packageName };
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

function pluginSurfaceActionRequest(
  action: ActionBinding,
  requestId: string
): { packageName: string; request: import("@trybotster/ui-contract").UiActionRequest } | undefined {
  if (!action.pluginSurface?.package_name) return undefined;

  return {
    packageName: action.pluginSurface.package_name,
    request: {
      ...action.pluginSurface.request,
      request_id: requestId
    }
  };
}

function actionResultFrame(
  request: ActionRequestEnvelope,
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

function recordLiveHarnessEvent(kind: string, payload: unknown): void {
  if (typeof window === "undefined") return;

  const harness = (window as typeof window & {
    __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
      events?: Array<{ kind: string; payload: unknown }>;
    };
  }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  harness?.events?.push({ kind, payload: redactedHarnessPayload(payload) });
}

function redactedHarnessPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((entry) => redactedHarnessPayload(entry));
  }
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
      key,
      key === "grant_secret" ? "[redacted]" : redactedHarnessPayload(value)
    ])
  );
}
