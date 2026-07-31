import type { DaemonRequest, DaemonResponse } from "../realHubDaemonDto";

export const generatedDaemonRequestFixtures = [
  { type: "list_apps" },
  { type: "list_package_navigation" },
  { type: "list_packages" },
  { type: "list_available_packages", registry_path: "/tmp/botster-registry" },
  { type: "inspect_available_package", registry_path: "/tmp/botster-registry", entry_id: "github-provider" },
  { type: "preview_package_install", registry_path: "/tmp/botster-registry", entry_id: "github-provider" },
  { type: "install_package_registry_entry", registry_path: "/tmp/botster-registry", entry_id: "github-provider" },
  {
    type: "set_package_configuration",
    package_name: "project-pipelines",
    values: {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      api_token: { type: "secret", state: "write_only" }
    }
  },
  {
    type: "set_package_configuration",
    package_name: "botster-web",
    values: {
      remote_browser_rendezvous_enabled: { type: "boolean", value: true }
    }
  },
  { type: "install_package_local_path", path: "/tmp/botster-package" },
  {
    type: "start_package_entrypoint",
    package_name: "project-pipelines",
    entrypoint_id: "web-client",
    environment_overrides: {
      BOTSTER_HUB_CONNECTION: "{\"transport\":{\"type\":\"unix_socket\",\"path\":\"/tmp/botster-hub.sock\"}}"
    }
  },
  { type: "stop_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" },
  { type: "restart_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" },
  { type: "package_entrypoint_status", package_name: "project-pipelines", entrypoint_id: "web-client" },
  { type: "enable_package", package_name: "project-pipelines" },
  { type: "disable_package", package_name: "project-pipelines" },
  { type: "remove_package", package_name: "project-pipelines" },
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: { route: "/pipelines" }
  },
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    request: {
      request_id: "fixture-action-1",
      surface_id: "home",
      action_id: "ticket.open",
      node_id: "ticket-row-1",
      kind: "submit",
      payload: { ticket_id: "ticket_1" }
    }
  },
  { type: "read_mode_flags", session_id: "mode-flags-fixture-session" }
] satisfies DaemonRequest[];

export const generatedModeFlagsResponseFixture = {
  kind: "read_mode_flags",
  status: null,
  sessions: [],
  mode_flags: {
    session_id: "mode-flags-fixture-session",
    mouse_mode: 9
  },
  packages: [],
  package_decision: null,
  lifecycle: [],
  plugin_tools: [],
  plugin_tool_result: null,
  events: [],
  cleanup: null,
  coordination: null,
  error: null
} satisfies DaemonResponse;

export const generatedPluginResourceCountersResponseFixture = {
  kind: "status",
  status: null,
  sessions: [],
  packages: [],
  package_decision: null,
  lifecycle: [],
  plugin_resource_counters: {
    active_timer_resources: 3
  },
  plugin_tools: [],
  plugin_tool_result: null,
  events: [],
  cleanup: null,
  coordination: null,
  error: null
} satisfies DaemonResponse;

export const generatedPackageResponseFixture = {
  kind: "packages",
  status: null,
  sessions: [],
  packages: [
    {
      package_name: "project-pipelines",
      version: "0.8.0",
      classification: "plugin",
      source_kind: "local_path",
      state: "enabled",
      requested_capabilities: [{ surface: "McpTools", scope: null }],
      surfaces: [
        {
          id: "home",
          kind: "app",
          title: "Pipelines",
          description: "Project Pipelines workbench",
          order: 1,
          category: "workflow",
          supports: ["render"]
        },
        {
          id: "settings",
          kind: "settings",
          title: "Pipeline Settings",
          description: "Project Pipelines package settings",
          order: 2,
          supports: ["render"]
        }
      ],
      runnable_entrypoints: [],
      configuration: {
        schema: {
          fields: [
            { key: "endpoint", type: "url", label: "Webhook endpoint", required: true },
            {
              key: "mode",
              type: "select",
              label: "Mode",
              default: { type: "select", value: "read" },
              options: [
                { value: "read", label: "Read" },
                { value: "write", label: "Write" }
              ]
            },
            { key: "enabled", type: "boolean", label: "Enabled", default: { type: "boolean", value: true } },
            { key: "api_token", type: "secret", label: "API token", required: true }
          ]
        },
        effective_values: {
          endpoint: { type: "url", value: "https://example.invalid/hook" },
          mode: { type: "select", value: "read" },
          enabled: { type: "boolean", value: true },
          api_token: { type: "secret", state: "redacted" }
        },
        missing_required: [],
        diagnostics: []
      },
      availability: { state: "available", reasons: [] },
      dependency_availability: [
        { id: "local-hub", package_name: "botster", state: "available", reasons: [] }
      ],
      feature_availability: [
        { id: "pipeline-runs", state: "available", reasons: [] }
      ],
      actions: [
        {
          action_id: "enable_package",
          status: "unavailable",
          reason: "already_enabled",
          diagnostics: [{ kind: "already_enabled", message: "package is already enabled" }],
          required_references: [],
          request: null
        },
        {
          action_id: "disable_package",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: { request_type: "disable_package", package_name: "project-pipelines" }
        },
        {
          action_id: "remove_package",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: { request_type: "remove_package", package_name: "project-pipelines" }
        },
        {
          action_id: "set_package_configuration",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: { request_type: "set_package_configuration", package_name: "project-pipelines" }
        },
        {
          action_id: "check_package_update",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: { request_type: "check_package_update", package_name: "project-pipelines" }
        }
      ],
      provider_profile_admitted: false
    },
    {
      package_name: "botster-web",
      version: "0.1.0",
      classification: "plugin",
      source_kind: "local_path",
      state: "enabled",
      requested_capabilities: [],
      surfaces: [
        {
          id: "production-settings",
          kind: "settings",
          title: "botster-web Settings",
          description: "Descriptor-backed settings surface for package launcher validation.",
          order: 2,
          supports: ["render"]
        }
      ],
      runnable_entrypoints: [],
      configuration: {
        schema: {
          fields: [
            {
              key: "remote_browser_rendezvous_enabled",
              type: "boolean",
              label: "Remote browser access",
              description: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
              default: { type: "boolean", value: false }
            }
          ]
        },
        effective_values: {
          remote_browser_rendezvous_enabled: { type: "boolean", value: false }
        },
        missing_required: [],
        diagnostics: []
      },
      availability: { state: "available", reasons: [] },
      dependency_availability: [],
      feature_availability: [],
      actions: [
        {
          action_id: "set_package_configuration",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: { request_type: "set_package_configuration", package_name: "botster-web" }
        }
      ],
      provider_profile_admitted: false
    }
  ],
  available_packages: [
    {
      entry_id: "github-provider",
      package_name: "github-provider",
      version: "1.2.3",
      classification: "provider",
      source_kind: "git",
      source_label: "github.invalid/trybotster/github-provider",
      first_party: true,
      state: "available",
      requested_capabilities: [{ surface: "ClientAdmission", scope: "github" }],
      compatibility: {
        botster_requirement: ">=0.1.0",
        hub_version: "0.1.0",
        result: "compatible",
        diagnostics: []
      },
      pin: {
        revision: "rev-github-provider",
        branch: "main",
        update_policy: "manual"
      },
      actions: [
        {
          action_id: "install_package_registry_entry",
          status: "blocked",
          reason: "auth_required",
          diagnostics: [{ kind: "auth_required", message: "GitHub auth is required before installing provider features" }],
          required_references: [{ kind: "auth", key: "github" }],
          request: null
        }
      ]
    }
  ],
  install_plan: null,
  update_status: null,
  package_decision: null,
  lifecycle: [],
  plugin_tools: [],
  plugin_tool_result: null,
  events: [],
  cleanup: null,
  coordination: null,
  error: null,
  diagnostics: []
} satisfies DaemonResponse;

export const generatedPackageNavigationResponseFixture = {
  kind: "package_navigation",
  status: null,
  sessions: [],
  package_navigation: [
    {
      package_name: "project-pipelines",
      item_id: "home",
      label: "Pipelines",
      icon: "workflow",
      description: "Project Pipelines workbench",
      route_id: "surface:home",
      route_path: "/packages/project-pipelines/surfaces/home",
      target: { kind: "plugin_surface", surface_id: "home" },
      source: { kind: "surface", surface_id: "home" },
      enabled: true,
      blocked: false,
      diagnostics: []
    },
    {
      package_name: "project-pipelines",
      item_id: "blocked",
      label: "Blocked Pipelines",
      route_id: "surface:blocked",
      route_path: "/packages/project-pipelines/surfaces/blocked",
      target: { kind: "plugin_surface", surface_id: "blocked" },
      source: { kind: "surface", surface_id: "blocked" },
      enabled: false,
      blocked: true,
      diagnostics: [{ kind: "package_not_enabled", message: "package is disabled" }]
    }
  ],
  packages: [],
  package_decision: null,
  lifecycle: [],
  plugin_tools: [],
  plugin_tool_result: null,
  events: [],
  cleanup: null,
  coordination: null,
  error: null
} satisfies DaemonResponse;

export const generatedAppResponseFixture = {
  kind: "apps",
  status: null,
  sessions: [],
  apps: [
    {
      package_name: "botster-web",
      app_id: "production",
      entrypoint_id: "web-client",
      kind: "web_app",
      launch_mode: "browser",
      lifecycle_state: "running",
      diagnostics: [],
      actions: [
        {
          action_id: "start_package_entrypoint",
          status: "available",
          diagnostics: [],
          required_references: [],
          request: {
            request_type: "start_package_entrypoint",
            package_name: "botster-web",
            entrypoint_id: "web-client"
          }
        }
      ],
      blocked_reasons: [],
      launch_target: {
        kind: "web_app",
        local_url: "http://127.0.0.1:41821"
      }
    },
    {
      package_name: "project-pipelines",
      app_id: "worker",
      entrypoint_id: "worker",
      kind: "terminal_app",
      launch_mode: "terminal",
      lifecycle_state: "installed",
      diagnostics: [],
      actions: [],
      blocked_reasons: [],
      launch_target: {
        kind: "terminal_app"
      }
    }
  ],
  packages: [],
  lifecycle: [],
  plugin_tools: [],
  plugin_tool_result: null,
  events: [],
  cleanup: null,
  coordination: null,
  error: null,
  package_decision: null,
  diagnostics: []
} satisfies DaemonResponse;
