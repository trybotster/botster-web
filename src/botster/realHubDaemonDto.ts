// Source of truth: botster-hub-client/src/lib.rs DaemonRequest,
// DaemonResponse, and DaemonEvent serde JSON shapes.
// Keep this browser-side structural subset aligned with that crate.
export type DaemonRequest =
  | { type: "status" }
  | { type: "list_sessions" }
  | { type: "list_packages" }
  | { type: "spawn"; session_id: string; command: string }
  | { type: "attach"; session_id: string; subscription_id: string }
  | { type: "detach"; session_id: string; subscription_id: string }
  | { type: "send_input"; session_id: string; data: string }
  | { type: "resize"; session_id: string; rows: number; cols: number }
  | { type: "shutdown_session"; session_id: string }
  | { type: "drain"; session_id: string }
  | { type: "daemon_shutdown" };

export interface DaemonResponse {
  kind: string;
  status?: DaemonStatus | null;
  sessions?: DaemonSession[];
  packages?: DaemonPackage[];
  events?: DaemonEvent[];
  cleanup?: { session_id: string; outcome: string } | null;
  error?: DaemonOperatorError | null;
  diagnostics?: DaemonDiagnostic[];
}

export interface DaemonStatus {
  lifecycle_state: string;
  compatibility?: DaemonCompatibility | null;
  host_id: string;
  host_display_name: string;
  schema_version: number;
  data_dir_configured: boolean;
  core_initialized: boolean;
  state_source: string;
  package_count: number;
  enabled_package_count: number;
  provider_count: number;
  enabled_provider_count: number;
  session_count: number;
  recovered_sessions: string[];
  stale_sessions: string[];
  diagnostics?: DaemonDiagnostic[];
}

export interface DaemonCompatibility {
  protocol: string;
  protocol_version: number;
  features: string[];
  conformance_fixture_revision: number;
}

export interface DaemonSession {
  session_id: string;
  lifecycle: string;
}

export interface DaemonPackage {
  package_name: string;
  version: string;
  classification: string;
  state: string;
  requested_capabilities: DaemonCapability[];
  runnable_entrypoints: DaemonPackageRunnableEntrypoint[];
  provider_profile_admitted: boolean;
}

export interface DaemonCapability {
  surface: string;
  scope?: string | null;
}

export interface DaemonPackageRunnableEntrypoint {
  id: string;
  kind: string;
  command: string;
  args: string[];
  working_directory: DaemonPackageWorkingDirectory;
  environment: DaemonPackageEnvironmentRequirement[];
  mode: string;
  capabilities: DaemonCapability[];
  may_supervise: boolean;
  process: DaemonPackageProcess;
}

export interface DaemonPackageWorkingDirectory {
  policy: string;
  path?: string | null;
}

export interface DaemonPackageEnvironmentRequirement {
  name: string;
  required: boolean;
  default?: string | null;
  description?: string | null;
}

export interface DaemonPackageProcess {
  state: string;
  pid?: number | null;
  started_at?: number | null;
  exited_at?: number | null;
  exit_status?: string | null;
  diagnostics: DaemonPackageDiagnostic[];
}

export interface DaemonPackageDiagnostic {
  kind: string;
  message: string;
}

export type DaemonEvent =
  | {
      type: "session_lifecycle";
      session_id: string;
      state: string;
    }
  | {
      type: "terminal_output";
      session_id: string;
      subscription_id: string;
      data: string;
    }
  | {
      type: "snapshot" | "scrollback";
      session_id: string;
      subscription_id: string;
      bytes: number;
    }
  | {
      type: "process_exit";
      session_id: string;
      subscription_id: string;
      code?: number | null;
    }
  | {
      type: "attach_state";
      session_id: string;
      subscription_id: string;
      state: string;
    }
  | {
      type: "runtime_observation";
      kind: string;
    };

export interface DaemonOperatorError {
  code: string;
  request_id: string;
  operation: string;
  message: string;
}

export interface DaemonDiagnostic {
  kind: string;
  operation?: string | null;
  feature?: string | null;
  message?: string | null;
}

export interface DaemonBridgeRequestEnvelope {
  kind: "daemon_request";
  request_id: string;
  payload: DaemonRequest;
}

export interface DaemonBridgeResponseEnvelope {
  kind: "daemon_response";
  request_id: string;
  payload: DaemonResponse;
}
