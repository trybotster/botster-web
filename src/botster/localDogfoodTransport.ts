import type { ActionBinding, UiActionRequest } from "./actions";
import type { EntityFrame } from "./entities";
import type { HubControlFrame, HubControlFrameHandler, HubControlTransport } from "./protocol";
import type { UiTreeSnapshot } from "./uiNodes";

const dogfoodSurface = "botster-web.dogfood.session";
const packageFamily = "botster-web.package";
const sessionFamily = "botster-web.session";
const draftFamily = "botster-web.session_draft";

// Local dogfood surface grammar mirrors the same temporary core-import gap as
// uiNodeConformance.ts; replace both with canonical core fixtures when exposed.
const initialEntityFrames: EntityFrame[] = [
  {
    operation: "entity_snapshot",
    family: packageFamily,
    sequence: 1,
    records: [
      {
        id: "botster-web",
        title: "botster-web",
        version: "0.1.0",
        status: "enabled",
        classification: "plugin",
        capability_summary: "No requested capabilities",
        view_surface: "botster-web.plugin.botster-web",
        settings_surface: "botster-web.plugin.botster-web.settings"
      },
      {
        id: "project-pipelines",
        title: "project-pipelines",
        version: "1.0.0",
        status: "enabled",
        classification: "plugin",
        capability_summary: "Mcp, PluginDb:project-pipelines",
        view_surface: "project-pipelines.app"
      },
      {
        id: "local-diagnostics",
        title: "local-diagnostics",
        version: "0.1.0",
        status: "installed",
        classification: "plugin",
        capability_summary: "No requested capabilities"
      }
    ]
  },
  {
    operation: "entity_snapshot",
    family: sessionFamily,
    sequence: 1,
    records: [
      {
        id: "session-local-1",
        title: "Local validation session",
        status: "ready",
        target: "botster-web",
        last_result: "Waiting for action_request"
      }
    ]
  },
  {
    operation: "entity_snapshot",
    family: draftFamily,
    sequence: 1,
    records: [
      {
        id: "draft-1",
        fields: [
          {
            id: "session_name",
            label: "Session name",
            kind: "text_input",
            value: "",
            errors: []
          },
          {
            id: "target",
            label: "Target",
            kind: "text_input",
            value: "botster-web",
            errors: []
          }
        ]
      }
    ]
  }
];

export const dogfoodUiTreeSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: dogfoodSurface,
  version: "local-dogfood-v1",
  root: {
    id: "dogfood-root",
    primitive: "stack",
    props: { label: "Local Botster web surface" },
    slots: {
      children: [
        {
          id: "session-summary",
          primitive: "section",
          slots: {
            children: [
              {
                id: "session-heading",
                primitive: "heading",
                props: { level: 2, text: "Session spawn/attach" }
              },
              {
                id: "session-copy",
                primitive: "text",
                props: {
                  text: "Spawn a local session, watch the session row update, and keep terminal output isolated in the terminal panel."
                }
              },
              {
                id: "runtime-action-status",
                primitive: "text",
                bindings: [{ source: "local_state", path: "dogfood.action_status", prop: "text" }]
              },
              {
                id: "spawn-action",
                primitive: "action",
                props: {
                  action: {
                    id: "botster.session.select",
                    target: "session-local-1",
                    label: "Spawn local session",
                    params: { mode: "local_dogfood" }
                  } satisfies ActionBinding
                }
              }
            ]
          }
        },
        {
          id: "session-list",
          primitive: "list",
          props: { label: "Runtime sessions" },
          bindings: [{ source: "entity", path: `/${sessionFamily}`, prop: "items" }],
          slots: {
            item: [
              {
                id: "session-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "session-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "session-status", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] },
                    { id: "session-result", primitive: "text", bindings: [{ source: "entity", path: "@/last_result", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "sessions-empty",
                primitive: "empty_state",
                props: { title: "No sessions", body: "The local adapter has not delivered entity_snapshot yet." }
              }
            ]
          }
        },
        {
          id: "validation-form",
          primitive: "form",
          props: {
            action: {
              id: "botster.session.rename",
              target: "session-local-1",
              label: "Submit invalid draft",
              params: { draft_id: "draft-1" }
            }
          },
          slots: {
            children: [
              {
                id: "validation-state",
                primitive: "form_section",
                props: { title: "Validation state" },
                slots: {
                  children: [
                    {
                      id: "session-name",
                      primitive: "text_input",
                      props: {
                        name: "session_name",
                        label: "Session name",
                        value: "",
                        error: "Session name is required"
                      }
                    },
                    {
                      id: "target",
                      primitive: "text_input",
                      props: {
                        name: "target",
                        label: "Target",
                        value: "botster-web"
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  }
};

const botsterWebPluginSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "botster-web.plugin.botster-web",
  version: "local-plugin-botster-web-v1",
  root: {
    id: "botster-web-plugin-root",
    primitive: "stack",
    props: { label: "botster-web plugin" },
    slots: {
      children: [
        {
          id: "botster-web-plugin-summary",
          primitive: "section",
          slots: {
            children: [
              {
                id: "botster-web-plugin-heading",
                primitive: "heading",
                props: { level: 2, text: "botster-web" }
              },
              {
                id: "botster-web-plugin-copy",
                primitive: "text",
                props: { text: "This plugin owns the web client surface and renderer diagnostics." }
              }
            ]
          }
        }
      ]
    }
  }
};

const projectPipelinesPluginSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "project-pipelines.app",
  version: "local-plugin-project-pipelines-v1",
  root: {
    id: "project-pipelines-root",
    primitive: "stack",
    props: { label: "Project pipelines" },
    slots: {
      children: [
        {
          id: "project-pipelines-summary",
          primitive: "section",
          slots: {
            children: [
              {
                id: "project-pipelines-heading",
                primitive: "heading",
                props: { level: 2, text: "Project pipelines" }
              },
              {
                id: "project-pipelines-copy",
                primitive: "text",
                props: { text: "Pipeline planning, review, and MCP-backed project workflows will render here." }
              }
            ]
          }
        }
      ]
    }
  }
};

const pluginSnapshots = new Map<string, UiTreeSnapshot>([
  [botsterWebPluginSnapshot.surface, botsterWebPluginSnapshot],
  [projectPipelinesPluginSnapshot.surface, projectPipelinesPluginSnapshot]
]);

export interface LocalDogfoodTransportOptions {
  latencyMs?: number;
}

export function createLocalDogfoodTransport(options: LocalDogfoodTransportOptions = {}): HubControlTransport {
  const latencyMs = options.latencyMs ?? 0;
  let ingress: HubControlFrameHandler | undefined;
  let sequence = 2;

  const emit = (frame: HubControlFrame) => {
    const deliver = () => ingress?.(frame);
    if (latencyMs > 0) {
      window.setTimeout(deliver, latencyMs);
    } else {
      queueMicrotask(deliver);
    }
  };

  const emitSurface = (surface: string) => {
    emit({ kind: "ui_tree_snapshot", payload: pluginSnapshots.get(surface) ?? dogfoodUiTreeSnapshot });
  };

  const emitEntitySnapshot = (family: string) => {
    const frame = initialEntityFrames.find((entityFrame) => entityFrame.operation === "entity_snapshot" && entityFrame.family === family);
    if (frame) {
      emit({ kind: frame.operation, payload: frame });
    }
  };

  return {
    async connect(_capabilities, nextIngress) {
      ingress = nextIngress;
      emit({ kind: "hello_ack", payload: { mode: "local_dogfood" } });
    },
    async disconnect() {
      ingress = undefined;
    },
    async send(frame) {
      if (frame.kind === "surface_subscribe") {
        const request = frame.payload as { surface?: unknown };
        emitSurface(typeof request.surface === "string" ? request.surface : dogfoodSurface);
        return;
      }

      if (frame.kind === "entity_pull") {
        const request = frame.payload as { family?: unknown };
        if (typeof request.family === "string") {
          emitEntitySnapshot(request.family);
        }
        return;
      }

      if (frame.kind === "action_request") {
        const request = frame.payload as UiActionRequest;

        if (request.action.id === "botster.session.select") {
          emit({
            kind: "entity_patch",
            payload: {
              operation: "entity_patch",
              key: { family: sessionFamily, id: "session-local-1" },
              sequence: sequence++,
              record: {
                id: "session-local-1",
                status: "running",
                last_result: "action_request accepted by local validation adapter"
              }
            } satisfies EntityFrame
          });
          emit({
            kind: "action_result",
            payload: {
              request_id: request.request_id,
              accepted: true,
              result: { session_id: request.action.target, state: "running" }
            }
          });
          return;
        }

        if (request.action.id === "botster.session.rename") {
          emit({
            kind: "entity_patch",
            payload: {
              operation: "entity_patch",
              key: { family: draftFamily, id: "draft-1" },
              sequence: sequence++,
              record: {
                id: "draft-1",
                fields: [
                  {
                    id: "session_name",
                    label: "Session name",
                    kind: "text_input",
                    value: "",
                    errors: ["Session name is required"]
                  },
                  {
                    id: "target",
                    label: "Target",
                    kind: "text_input",
                    value: "botster-web",
                    errors: []
                  }
                ]
              }
            } satisfies EntityFrame
          });
          emit({
            kind: "action_result",
            payload: {
              request_id: request.request_id,
              accepted: false,
              reason: "Session name is required"
            }
          });
        }
      }
    }
  };
}
