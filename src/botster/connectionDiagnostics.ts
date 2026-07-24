import type { ActionBinding, ActionDispatchResult } from "./actions";
import type { TerminalDataPlaneKind } from "./hubRuntime";
import type { HubControlFrame } from "./protocol";
import type { WebrtcDaemonLifecycleEvent } from "./webrtcDaemonClient";

export const expectedDaemonSchemaVersion = 1;
export const hubStatusFamily = "botster-web.hub_status";
export const hubCompatibilityDiagnosticId = "hub-compatibility";
export const expectedDaemonProtocol = "botster-hub-daemon-v1";
export const minimumDaemonProtocolVersion = 1;
export const minimumConformanceFixtureRevision = 14;
export const requiredDaemonFeatures = [
  "sessions",
  "terminal_streaming",
  "resize",
  "terminal_readback",
  "plugin_surface_render",
  "plugin_surface_action"
] as const;

export type ConnectionDiagnosticSeverity = "info" | "success" | "warning" | "danger";

export interface ConnectionDiagnostic {
  id: string;
  title: string;
  detail: string;
  severity: ConnectionDiagnosticSeverity;
  source:
    | "server"
    | "compatibility"
    | "stream"
    | "action"
    | "terminal"
    | "pairing"
    | "signaling"
    | "webrtc"
    | "encryption"
    | "data-plane";
  operation?: string;
  actionId?: string;
  actionTarget?: string;
}

export function hubConnectionDiagnosticFromFrame(frame: HubControlFrame): ConnectionDiagnostic | undefined {
  if (frame.kind !== "connection_diagnostic" || !isRecord(frame.payload)) {
    return undefined;
  }

  const kind = typeof frame.payload.kind === "string" ? frame.payload.kind : "runtime_observation";
  const message =
    typeof frame.payload.message === "string" && frame.payload.message
      ? frame.payload.message
      : `Hub reported ${kind}.`;
  const feature = typeof frame.payload.feature === "string" ? frame.payload.feature : undefined;
  const operation = typeof frame.payload.operation === "string" ? frame.payload.operation : undefined;
  const details = [message];
  if (feature) details.push(`Capability: ${feature}.`);
  if (operation) details.push(`Operation: ${operation}.`);

  return {
    id: `hub-diagnostic-${kind}${feature ? `-${feature}` : ""}`,
    title: hubDiagnosticTitle(kind),
    detail: details.join(" "),
    severity: hubDiagnosticSeverity(kind),
    source: hubDiagnosticSource(kind),
    operation
  };
}

export function initialConnectionDiagnostics(
  mode: string,
  statusText: string,
  terminalDataPlaneKind: TerminalDataPlaneKind = "webrtc",
  startupError?: unknown
): ConnectionDiagnostic[] {
  const diagnostics: ConnectionDiagnostic[] = [
    dataPlaneDiagnostic(terminalDataPlaneKind),
    {
      id: "package-asset-revision",
      title: "Package asset revision unknown",
      detail: "No package build timestamp or asset revision was provided to the browser runtime.",
      severity: "info",
      source: "compatibility"
    }
  ];

  if (terminalDataPlaneKind === "webrtc") {
    diagnostics.push(
      {
        id: "packaged-ui-server",
        title: "Packaged UI server active",
        detail: "The local server delivered botster-web and its package runtime marker; terminal bytes use WebRTC only after a valid bootstrap and signaling.",
        severity: "success",
        source: "server"
      }
    );
    const startupDiagnostic = webRtcFailureDiagnostic(startupError);
    if (startupDiagnostic) {
      diagnostics.push(startupDiagnostic);
    } else {
      diagnostics.push(
        {
          id: "webrtc-bootstrap-ready",
          title: "Local WebRTC bootstrap ready",
          detail: "A local WebRTC bootstrap grant is present for same-device daemon signaling.",
          severity: "success",
          source: "pairing"
        },
        {
          id: "webrtc-signaling-server",
          title: "Local WebRTC signaling ready",
          detail: "The local package server handles bootstrap refresh and signaling; terminal traffic stays on WebRTC.",
          severity: "info",
          source: "signaling"
        }
      );
    }
  }

  return [
    ...diagnostics,
    {
      id: "transport-mode",
      title: "Local hub WebRTC selected",
      detail: statusText,
      severity: "info",
      source: "stream"
    }
  ];
}

export function dataPlaneDiagnostic(kind: TerminalDataPlaneKind): ConnectionDiagnostic {
  switch (kind) {
    case "webrtc":
      return {
        id: "terminal-data-plane",
        title: "Terminal data plane: WebRTC DataChannel",
        detail: "Terminal requests and terminal stream polling use the encrypted local WebRTC DataChannel after bootstrap/signaling.",
        severity: "success",
        source: "data-plane"
      };
  }
}

export function webRtcLifecycleDiagnostic(event: WebrtcDaemonLifecycleEvent): ConnectionDiagnostic {
  switch (event.type) {
    case "data-channel-open":
      return {
        id: "webrtc-data-channel-state",
        title: "WebRTC DataChannel open",
        detail: "The local daemon WebRTC DataChannel is open for encrypted request/response traffic.",
        severity: "success",
        source: "webrtc"
      };
    case "data-channel-closed":
      return {
        id: "webrtc-data-channel-state",
        title: "WebRTC DataChannel closed",
        detail: "The local daemon WebRTC DataChannel closed; terminal data-plane requests cannot continue until reconnect.",
        severity: "danger",
        source: "webrtc"
      };
    case "data-channel-error":
      return {
        id: "webrtc-data-channel-state",
        title: "WebRTC DataChannel error",
        detail: "The local daemon WebRTC DataChannel reported an error.",
        severity: "danger",
        source: "webrtc"
      };
    case "encrypted-stream-ready":
      return {
        id: "webrtc-encrypted-stream",
        title: "Encrypted client stream ready",
        detail: `Encrypted WebRTC request/response traffic is active for ${event.requestType}.`,
        severity: "success",
        source: "encryption"
      };
  }
}

export function hubUnavailableDiagnostic(error: unknown): ConnectionDiagnostic {
  return {
    id: "hub-unavailable",
    title: "Local hub unavailable",
    detail: errorMessage(error, "The local hub did not answer the control request."),
    severity: "danger",
    source: "signaling"
  };
}

export function streamDisconnectedDiagnostic(error: unknown): ConnectionDiagnostic {
  return {
    id: "stream-disconnected",
    title: "Control stream disconnected",
    detail: errorMessage(error, "The local hub stream stopped before the surface finished loading."),
    severity: "warning",
    source: "stream"
  };
}

export function connectionFailureDiagnostic(controlStreamEstablished: boolean, error: unknown): ConnectionDiagnostic {
  const webRtcDiagnostic = webRtcFailureDiagnostic(error);
  if (webRtcDiagnostic) {
    return webRtcDiagnostic;
  }

  return controlStreamEstablished ? streamDisconnectedDiagnostic(error) : hubUnavailableDiagnostic(error);
}

export function terminalUnavailableDiagnostic(error: unknown): ConnectionDiagnostic {
  const webRtcDiagnostic = webRtcFailureDiagnostic(error);
  if (webRtcDiagnostic) {
    return webRtcDiagnostic;
  }

  return {
    id: "terminal-unavailable",
    title: "Terminal stream unavailable",
    detail: errorMessage(error, "The terminal data plane could not attach to the selected session."),
    severity: "danger",
    source: "terminal"
  };
}

export function webRtcFailureDiagnostic(error: unknown): ConnectionDiagnostic | undefined {
  const stage = webRtcFailureStage(error);
  if (!stage) {
    return undefined;
  }

  const detail = errorMessage(error, "The local WebRTC transport failed.");
  switch (stage) {
    case "bootstrap":
      return {
        id: "webrtc-bootstrap-failed",
        title: "Local WebRTC bootstrap failed",
        detail,
        severity: "danger",
        source: "pairing"
      };
    case "signaling":
      return {
        id: "webrtc-signaling-failed",
        title: "Local WebRTC signaling failed",
        detail,
        severity: "danger",
        source: "signaling"
      };
    case "transport":
      return {
        id: "webrtc-transport-failed",
        title: "Local WebRTC transport failed",
        detail,
        severity: "danger",
        source: "webrtc"
      };
    case "encryption":
      return {
        id: "webrtc-encryption-failed",
        title: "Local WebRTC encryption failed",
        detail,
        severity: "danger",
        source: "encryption"
      };
    case "data-plane":
      return {
        id: "webrtc-data-plane-failed",
        title: "Local WebRTC data plane failed",
        detail,
        severity: "danger",
        source: "data-plane"
      };
  }
}

export function actionFailureDiagnostic(action: ActionBinding, result: ActionDispatchResult): ConnectionDiagnostic | undefined {
  if (result.accepted) {
    return undefined;
  }

  const diagnostics = actionResultDiagnostics(result.result);
  const detail = [result.reason ?? `The hub rejected ${action.id}.`, ...diagnostics].join(" ");

  return {
    id: `action-failure-${action.id}`,
    title: "Action failed",
    detail,
    severity: "warning",
    source: "action",
    actionId: action.id,
    actionTarget: action.target
  };
}

function actionResultDiagnostics(result: unknown): string[] {
  if (!isRecord(result) || !Array.isArray(result.diagnostics)) return [];
  return result.diagnostics.map((diagnostic) => {
    if (typeof diagnostic === "string") return diagnostic;
    if (!isRecord(diagnostic)) return "";
    const kind = typeof diagnostic.kind === "string" ? diagnostic.kind : "";
    const message = typeof diagnostic.message === "string" ? diagnostic.message : "";
    const field = typeof diagnostic.field === "string" ? diagnostic.field : "";
    return [kind, field, message].filter(Boolean).join(": ");
  }).filter((diagnostic) => diagnostic.length > 0);
}

export function operatorErrorDiagnostic(frame: HubControlFrame): ConnectionDiagnostic | undefined {
  if (frame.kind !== "operator_error" || !isRecord(frame.payload)) {
    return undefined;
  }

  return {
    id: `operator-error-${String(frame.payload.operation ?? frame.payload.code ?? "hub")}`,
    title: "Hub operator error",
    detail: String(frame.payload.message ?? "The hub returned an operator error."),
    severity: "danger",
    source: "action",
    operation: typeof frame.payload.operation === "string" ? frame.payload.operation : undefined
  };
}

export function schemaVersionDiagnosticFromFrame(frame: HubControlFrame): ConnectionDiagnostic | undefined {
  const status = hubStatusRecordFromFrame(frame);
  if (!status || typeof status.schema_version !== "number") {
    return undefined;
  }

  if (status.schema_version === expectedDaemonSchemaVersion) {
    return {
      id: "schema-version",
      title: "Daemon schema compatible",
      detail: `Daemon schema ${status.schema_version} matches botster-web.`,
      severity: "success",
      source: "compatibility"
    };
  }

  return {
    id: "schema-version",
    title: "Daemon schema mismatch",
    detail: `Daemon schema ${status.schema_version} does not match botster-web expected schema ${expectedDaemonSchemaVersion}.`,
    severity: "danger",
    source: "compatibility"
  };
}

export function compatibilityDiagnosticsFromFrame(frame: HubControlFrame): ConnectionDiagnostic[] {
  const status = hubStatusRecordFromFrame(frame);
  if (!status) {
    return [];
  }

  if (hasHubCompatibilityDiagnostic(status)) {
    return [];
  }

  const compatibility = status.compatibility;
  if (!isRecord(compatibility)) {
    return [
      {
        id: hubCompatibilityDiagnosticId,
        title: "Hub compatibility descriptor unavailable",
        detail: "DaemonStatus.compatibility was not returned by the local hub status response.",
        severity: "warning",
        source: "compatibility"
      }
    ];
  }

  if (compatibility.protocol !== expectedDaemonProtocol) {
    return [
      {
        id: hubCompatibilityDiagnosticId,
        title: "Hub protocol mismatch",
        detail: `Running hub protocol ${String(compatibility.protocol)} does not match ${expectedDaemonProtocol}.`,
        severity: "danger",
        source: "compatibility"
      }
    ];
  }

  if (
    typeof compatibility.protocol_version !== "number" ||
    compatibility.protocol_version < minimumDaemonProtocolVersion
  ) {
    return [
      {
        id: hubCompatibilityDiagnosticId,
        title: "Hub protocol version mismatch",
        detail: `Running hub protocol version ${String(compatibility.protocol_version)} is below required version ${minimumDaemonProtocolVersion}.`,
        severity: "danger",
        source: "compatibility"
      }
    ];
  }

  if (
    typeof compatibility.conformance_fixture_revision !== "number" ||
    compatibility.conformance_fixture_revision < minimumConformanceFixtureRevision
  ) {
    return [
      {
        id: hubCompatibilityDiagnosticId,
        title: "Hub conformance fixture mismatch",
        detail: `Running hub conformance fixture revision ${String(compatibility.conformance_fixture_revision)} is below required revision ${minimumConformanceFixtureRevision}.`,
        severity: "danger",
        source: "compatibility"
      }
    ];
  }

  const features = Array.isArray(compatibility.features)
    ? compatibility.features.filter((feature): feature is string => typeof feature === "string")
    : [];
  const missingFeatures = requiredDaemonFeatures.filter((feature) => !features.includes(feature));
  if (missingFeatures.length > 0) {
    return [
      {
        id: hubCompatibilityDiagnosticId,
        title: "Hub capability missing",
        detail: `Running hub does not advertise required feature(s): ${missingFeatures.join(", ")}.`,
        severity: "danger",
        source: "compatibility"
      }
    ];
  }

  return [
    {
      id: hubCompatibilityDiagnosticId,
      title: "Hub compatibility descriptor compatible",
      detail: `Protocol ${compatibility.protocol} v${compatibility.protocol_version} advertises required features.`,
      severity: "success",
      source: "compatibility"
    }
  ];
}

function hubStatusRecordFromFrame(frame: HubControlFrame): Record<string, unknown> | undefined {
  if (frame.kind !== "entity_snapshot" || !isRecord(frame.payload)) {
    return undefined;
  }

  if (frame.payload.family !== hubStatusFamily || !Array.isArray(frame.payload.records)) {
    return undefined;
  }

  const status = frame.payload.records.find((record) => isRecord(record) && record.id === "local-hub");
  return isRecord(status) ? status : undefined;
}

function hasHubCompatibilityDiagnostic(status: Record<string, unknown>): boolean {
  if (!Array.isArray(status.diagnostics)) {
    return false;
  }

  return status.diagnostics.some((diagnostic) => {
    if (!isRecord(diagnostic)) {
      return false;
    }

    return diagnostic.kind === "compatibility_mismatch" || diagnostic.kind === "unsupported_feature";
  });
}

export function upsertDiagnostic(
  diagnostics: ConnectionDiagnostic[],
  diagnostic: ConnectionDiagnostic | undefined
): ConnectionDiagnostic[] {
  if (!diagnostic) {
    return diagnostics;
  }

  // This panel is a running diagnostic log for the current production session.
  // Retry/recovery flows should add explicit recovery rows instead of silently
  // deleting the failure evidence that explains the current session history.
  const existing = diagnostics.findIndex((entry) => entry.id === diagnostic.id);
  if (existing === -1) {
    return [...diagnostics, diagnostic];
  }

  return diagnostics.map((entry, index) => (index === existing ? diagnostic : entry));
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallback;
}

function webRtcFailureStage(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const stage = error.botsterWebrtcStage;
  return typeof stage === "string" ? stage : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hubDiagnosticTitle(kind: string): string {
  switch (kind) {
    case "connected":
      return "Hub connection established";
    case "disconnected":
      return "Hub connection disconnected";
    case "compatibility_mismatch":
      return "Hub compatibility mismatch";
    case "unsupported_feature":
      return "Hub capability unsupported";
    case "terminal_stream_unavailable":
      return "Terminal stream unavailable";
    case "action_failure":
      return "Hub action failed";
    case "daemon_startup_failure":
      return "Hub daemon startup failed";
    default:
      return "Hub runtime observation";
  }
}

function hubDiagnosticSeverity(kind: string): ConnectionDiagnosticSeverity {
  switch (kind) {
    case "connected":
      return "success";
    case "disconnected":
    case "unsupported_feature":
    case "action_failure":
      return "warning";
    case "compatibility_mismatch":
    case "terminal_stream_unavailable":
    case "daemon_startup_failure":
      return "danger";
    default:
      return "info";
  }
}

function hubDiagnosticSource(kind: string): ConnectionDiagnostic["source"] {
  switch (kind) {
    case "compatibility_mismatch":
    case "unsupported_feature":
      return "compatibility";
    case "terminal_stream_unavailable":
      return "terminal";
    case "action_failure":
      return "action";
    case "connected":
    case "disconnected":
      return "stream";
    default:
      return "stream";
  }
}
