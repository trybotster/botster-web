import type { DaemonRequest, DaemonResponse } from "../realHubDaemonDto";

export const generatedDaemonRequestFixtures = [
  { type: "list_packages" },
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
