import uiContractConformance from "@trybotster/ui-contract/conformance-fixtures";

import type { EntityFrame } from "../entities";
import type { UiBindIf, UiNode, UiTreeSnapshot } from "../uiNodes";

const fixtures = uiContractConformance.fixtures;

export const fixtureProvenance = {
  source: "@trybotster/ui-contract/conformance-fixtures",
  contractVersion: uiContractConformance.contract_version
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
        comments: [
          { id: "comment-alpha", body: "Nested row context" }
        ]
      },
      {
        id: "ticket-beta",
        title: "Capability fallback",
        status: "blocked",
        comments: []
      }
    ]
  },
  {
    operation: "entity_snapshot",
    family: "session",
    records: [
      { id: "session-alpha", session_uuid: "sess-alpha", lifecycle_class: "current" },
      { id: "session-beta", session_uuid: "sess-beta", lifecycle_class: "current" },
      { id: "session-historic", session_uuid: "sess-historic", lifecycle_class: "historic" }
    ]
  }
];

const dialogPresence = fixtures.dialog_presence as UiBindIf;
const selectedWorkspaceEquality = fixtures.selected_workspace_equality as UiBindIf;
const contractForm = fixtures.form as UiNode;
const boundRowIdentity = fixtures.bound_row_identity as UiNode;

export const uiNodeConformanceSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "botster-web.fixture.registry",
  version: `ui-contract-${uiContractConformance.contract_version}`,
  root: {
    id: "root",
    type: "stack",
    props: { direction: "vertical", gap: "md", label: "UiNode renderer conformance" },
    children: [
      {
        id: "intro",
        type: "section",
        props: {
          title: "Universal primitives",
          description: "Canonical UI contract fixtures render through the production registry."
        },
        children: [
          {
            id: "inspect-action",
            type: "button",
            props: {
              label: "Inspect session",
              action: { id: "botster.session.select", payload: { source: "fixture" } }
            }
          }
        ]
      },
      {
        $kind: "bind_list",
        source: "/project-pipelines.ticket",
        item_template: {
          id: { $bind: "@/id" },
          type: "inline",
          children: [
            {
              id: { $kind: "bind_list_descendant_id", key: "title" },
              type: "text",
              props: { text: { $bind: "@/title" } }
            },
            {
              id: { $kind: "bind_list_descendant_id", key: "status" },
              type: "text",
              props: { text: { $bind: "@/status" } }
            }
          ]
        },
        empty_template: {
          id: "tickets-empty",
          type: "empty_state",
          props: { title: "No tickets", description: "The entity-backed list has no records." }
        }
      },
      boundRowIdentity,
      contractForm,
      dialogPresence,
      selectedWorkspaceEquality
    ]
  }
};
