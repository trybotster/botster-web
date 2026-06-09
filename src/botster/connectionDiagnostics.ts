import type { ActionBinding, ActionDispatchResult } from "./actions";
import type { HubControlFrame } from "./protocol";

export const expectedDaemonSchemaVersion = 1;
export const hubStatusFamily = "botster-web.hub_status";
export const expectedDaemonProtocol = "botster-hub-daemon-v1";
export const minimumDaemonProtocolVersion = 1;
export const minimumConformanceFixtureRevision = 1;
export const requiredDaemonFeatures = [
  "sessions",
  "terminal_streaming",
  "resize",
  "plugin_surface_render",
  "plugin_surface_action"
] as const;

export type ConnectionDiagnosticSeverity = "info" | "success" | "warning" | "danger";

export interface ConnectionDiagnostic {
  id: string;
  title: string;
  detail: string;
  severity: ConnectionDiagnosticSeverity;
  source: "bridge" | "compatibility" | "stream" | "action" | "terminal";
}

export function initialConnectionDiagnostics(mode: string, statusText: string): ConnectionDiagnostic[] {
  return [
    {
      id: "bridge-mode",
      title: mode === "real-hub" ? "Real hub bridge selected" : "Fixture transport selected",
      detail: statusText,
      severity: mode === "real-hub" ? "info" : "success",
      source: "bridge"
    }
  ];
}

export function bridgeUnavailableDiagnostic(error: unknown): ConnectionDiagnostic {
  return {
    id: "bridge-unavailable",
    title: "Local hub bridge unavailable",
    detail: errorMessage(error, "The local dogfood bridge did not answer the control request."),
    severity: "danger",
    source: "bridge"
  };
}

export function streamDisconnectedDiagnostic(error: unknown): ConnectionDiagnostic {
  return {
    id: "stream-disconnected",
    title: "Control stream disconnected",
    detail: errorMessage(error, "The local hub stream stopped before the dogfood surface finished loading."),
    severity: "warning",
    source: "stream"
  };
}

export function connectionFailureDiagnostic(controlStreamEstablished: boolean, error: unknown): ConnectionDiagnostic {
  return controlStreamEstablished ? streamDisconnectedDiagnostic(error) : bridgeUnavailableDiagnostic(error);
}

export function terminalUnavailableDiagnostic(error: unknown): ConnectionDiagnostic {
  return {
    id: "terminal-unavailable",
    title: "Terminal stream unavailable",
    detail: errorMessage(error, "The terminal data plane could not attach to the selected session."),
    severity: "danger",
    source: "terminal"
  };
}

export function actionFailureDiagnostic(action: ActionBinding, result: ActionDispatchResult): ConnectionDiagnostic | undefined {
  if (result.accepted) {
    return undefined;
  }

  return {
    id: `action-failure-${action.id}`,
    title: "Action failed",
    detail: result.reason ?? `The hub rejected ${action.id}.`,
    severity: "warning",
    source: "action"
  };
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
    source: "action"
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

  const compatibility = status.compatibility;
  if (!isRecord(compatibility)) {
    return [
      {
        id: "compatibility-descriptor-unavailable",
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
        id: "hub-protocol-mismatch",
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
        id: "hub-protocol-version-mismatch",
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
        id: "hub-conformance-fixture-mismatch",
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
        id: "hub-missing-required-capability",
        title: "Hub capability missing",
        detail: `Running hub does not advertise required feature(s): ${missingFeatures.join(", ")}.`,
        severity: "danger",
        source: "compatibility"
      }
    ];
  }

  return [
    {
      id: "hub-compatibility-descriptor",
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

export function upsertDiagnostic(
  diagnostics: ConnectionDiagnostic[],
  diagnostic: ConnectionDiagnostic | undefined
): ConnectionDiagnostic[] {
  if (!diagnostic) {
    return diagnostics;
  }

  // This panel is a running diagnostic log for the current dogfood session.
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
