export type UiFrameKind = "uinode" | "action" | "entity";

export interface UiFrame {
  id: string;
  kind: UiFrameKind;
  title: string;
  summary: string;
  source: "placeholder";
}

export interface UiFrameSet {
  id: string;
  title: string;
  frames: UiFrame[];
}

export const placeholderFrameSet: UiFrameSet = {
  id: "placeholder-renderer-seam",
  title: "UiNode / action / entity frame seam",
  frames: [
    {
      id: "uinode-workspace-root",
      kind: "uinode",
      title: "ui_tree_snapshot",
      summary: "Structural UI tree entry point supplied by hub/plugin surfaces.",
      source: "placeholder"
    },
    {
      id: "action-inspect-frame",
      kind: "action",
      title: "semantic action binding",
      summary: "Renderer-dispatched command intent, not a DOM event name.",
      source: "placeholder"
    },
    {
      id: "entity-session-read-model",
      kind: "entity",
      title: "entity_snapshot / upsert / patch / remove",
      summary: "Pull-hydrated read model placeholder for hub-owned state.",
      source: "placeholder"
    }
  ]
};
