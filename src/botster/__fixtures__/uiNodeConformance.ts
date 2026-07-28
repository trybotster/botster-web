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
  }
];

const dialogPresence = fixtures.dialog_presence as UiBindIf;
const selectedWorkspaceEquality = fixtures.selected_workspace_equality as UiBindIf;
const contractForm = fixtures.form as UiNode;

export const uiNodeConformanceSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "botster-web.fixture.registry",
  version: `ui-contract-${uiContractConformance.contract_version}`,
  root: {
    id: "root",
    type: "stack",
    props: { gap: "md", label: "UiNode renderer conformance" },
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
          id: "ticket-row",
          type: "inline",
          children: [
            { id: "ticket-title", type: "text", props: { text: { $bind: "@/title" } } },
            { id: "ticket-status", type: "badge", props: { text: { $bind: "@/status" } } }
          ]
        },
        empty_template: {
          id: "tickets-empty",
          type: "empty_state",
          props: { title: "No tickets", description: "The entity-backed list has no records." }
        }
      },
      contractForm,
      dialogPresence,
      selectedWorkspaceEquality
    ]
  }
};
