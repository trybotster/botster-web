import type { UiChild } from "@trybotster/ui-contract";

import type { UiTreeSnapshot } from "../uiNodes";

const children = [
  {
    $kind: "when",
    condition: { width: "regular" },
    node: {
      id: "session-conditional-child",
      type: "text",
      props: { text: "Conditional child" }
    }
  },
  {
    $kind: "bind_if",
    path: "/session/session-stable-current/lifecycle",
    node: {
      id: "session-bound-child",
      type: "text",
      props: {
        text: { $bind: "/session/session-stable-current/lifecycle_class" }
      }
    }
  },
  {
    $kind: "bind_list",
    source: "/session",
    where: { session_uuid: "session-stable-current" },
    item_template: {
      id: "session-nested-row",
      type: "section",
      children: [
        {
          id: "session-nested-lifecycle",
          type: "text",
          props: { text: { $bind: "@/lifecycle_class" } }
        },
        {
          $kind: "bind_if",
          path: "@/lifecycle",
          node: {
            id: "session-nested-bound-child",
            type: "text",
            props: { text: "Nested bound child" }
          }
        }
      ]
    }
  }
] satisfies UiChild[];

export const sessionBindingVariantSnapshot: UiTreeSnapshot = {
  kind: "ui_tree_snapshot",
  surface: "session-binding-child-variants",
  version: "hub-test-support-revision-24",
  root: {
    id: "session-binding-child-variants-root",
    type: "stack",
    props: { direction: "vertical" },
    children
  }
};
