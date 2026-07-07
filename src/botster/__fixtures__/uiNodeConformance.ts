import type { ActionBinding } from "../actions";
import type { EntityFrame } from "../entities";
import type { UiTreeSnapshot } from "../uiNodes";

// Mirrored from botster-core UiNode v1 conformance work for this ticket.
// botster-core is external to botster-web in this checkout, so the web tests keep
// explicit fixture provenance until a package import seam exists.
export const fixtureProvenance = {
  source: "botster-core UiNode v1/action/capability conformance dependencies",
  ticketIds: [
    "ticket_1780939862_945903",
    "ticket_1780939862_251954",
    "ticket_1780939862_542875"
  ],
  mirroredFor: "ticket_1780941197_299829"
};

export const inspectTicketAction: ActionBinding = {
  id: "botster.session.select",
  target: "session:alpha",
  label: "Inspect session",
  params: {
    source: "fixture"
  }
};

export const fixtureEntityFrames: EntityFrame[] = [
  {
    operation: "entity_snapshot",
    family: "project-pipelines.ticket",
    records: [
      {
        id: "ticket-alpha",
        title: "Renderer registry",
        status: "review",
        priority: "high"
      },
      {
        id: "ticket-beta",
        title: "Capability fallback",
        status: "blocked",
        priority: "medium"
      }
    ]
  }
];

export const uiNodeConformanceSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "botster-web.fixture.registry",
  version: "core-fixture-mirror-v1",
  root: {
    id: "root",
    primitive: "stack",
    props: { gap: "normal", label: "UiNode renderer conformance" },
    slots: {
      children: [
        {
          id: "intro",
          primitive: "section",
          slots: {
            children: [
              {
                id: "intro-heading",
                primitive: "heading",
                props: { level: 2, text: "Universal primitives" }
              },
              {
                id: "intro-copy",
                primitive: "text",
                props: { text: "Layout, content, actions, forms, tables, lists, dialogs, and fallbacks render from one UiNode snapshot." }
              },
              {
                id: "inspect-action",
                primitive: "action",
                props: { action: inspectTicketAction }
              }
            ]
          }
        },
        {
          id: "tickets",
          primitive: "list",
          props: { label: "Bound tickets" },
          bindings: [{ source: "entity", path: "/project-pipelines.ticket", prop: "items" }],
          slots: {
            item: [
              {
                id: "ticket-row",
                primitive: "row",
                slots: {
                  children: [
                    { id: "ticket-title", primitive: "text", bindings: [{ source: "entity", path: "@/title", prop: "text" }] },
                    { id: "ticket-status", primitive: "badge", bindings: [{ source: "entity", path: "@/status", prop: "text" }] }
                  ]
                }
              }
            ],
            empty: [
              {
                id: "tickets-empty",
                primitive: "empty_state",
                props: { title: "No tickets", body: "The entity-backed list has no records." }
              }
            ]
          }
        },
        {
          id: "ticket-table",
          primitive: "table",
          props: {
            columns: [
              { key: "title", label: "Title" },
              { key: "priority", label: "Priority" }
            ]
          },
          bindings: [{ source: "entity", path: "/project-pipelines.ticket", prop: "rows" }]
        },
        {
          id: "edit-form",
          primitive: "form",
          props: {
            action: { id: "botster.session.rename", label: "Save draft", target: "session:alpha" }
          },
          slots: {
            children: [
              {
                id: "edit-form-section",
                primitive: "form_section",
                props: { title: "Validation fixture" },
                slots: {
                  children: [
                    { id: "title", primitive: "text_input", props: { name: "title", label: "Title", value: "Renderer registry", error: "Title already exists" } },
                    { id: "notes", primitive: "textarea", props: { name: "notes", label: "Notes", value: "Keep the renderer generic." } },
                    { id: "urgent", primitive: "checkbox", props: { name: "urgent", label: "Urgent", checked: true } }
                  ]
                }
              }
            ]
          }
        },
        {
          id: "dialog",
          primitive: "dialog",
          props: { title: "Local presentation dialog", open: true },
          slots: {
            children: [{ id: "dialog-copy", primitive: "text", props: { text: "Dialog open state can be controlled by the snapshot or local presentation state." } }]
          }
        },
        {
          id: "requires-missing-capability",
          primitive: "action",
          props: {
            requires: ["isolated_plugin_asset"],
            action: { id: "botster.plugin.asset.open", label: "Open isolated asset" }
          }
        },
        {
          id: "unknown-node",
          primitive: "timeline",
          props: { label: "Future primitive" }
        }
      ]
    }
  }
};
