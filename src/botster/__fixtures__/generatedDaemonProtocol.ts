import type { DaemonRequest, DaemonResponse } from "../realHubDaemonDto";

export const generatedDaemonRequestFixtures = [
  { type: "list_packages" },
  {
    type: "set_package_configuration",
    package_name: "project-pipelines",
    values: {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      api_token: { type: "secret", state: "write_only" }
    }
  },
  { type: "install_package_local_path", path: "/tmp/botster-package" },
  {
    type: "start_package_entrypoint",
    package_name: "project-pipelines",
    entrypoint_id: "web-client",
    environment_overrides: { BOTSTER_HUB_SOCKET: "/tmp/botster-hub.sock" }
  },
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: { route: "/pipelines" }
  },
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    surface_id: "home",
    action_id: "ticket.open",
    payload: { ticket_id: "ticket_1" }
  }
] satisfies DaemonRequest[];

export const generatedPackageResponseFixture = {
  kind: "packages",
  status: null,
  sessions: [],
  packages: [
    {
      package_name: "project-pipelines",
      version: "0.8.0",
      classification: "plugin",
      state: "enabled",
      requested_capabilities: [{ surface: "McpTools", scope: null }],
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
      provider_profile_admitted: false
    }
  ],
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
