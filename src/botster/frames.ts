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
      title: "UiNode root",
      summary: "Structural UI tree entry point supplied by hub/plugin surfaces.",
      source: "placeholder"
    },
    {
      id: "action-inspect-frame",
      kind: "action",
      title: "Action binding",
      summary: "Semantic action intent placeholder for renderer-dispatched commands.",
      source: "placeholder"
    },
    {
      id: "entity-session-read-model",
      kind: "entity",
      title: "Entity frame",
      summary: "Entity-backed read model placeholder for hub-owned state.",
      source: "placeholder"
    }
  ]
};
