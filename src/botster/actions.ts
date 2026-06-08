export type SemanticActionId =
  | "botster.session.select"
  | "botster.workspace.toggle"
  | "botster.session.preview.toggle"
  | "botster.session.preview.open_external"
  | "botster.session.rename"
  | "botster.session.stop"
  | "botster.session.delete"
  | (string & {});

export interface ActionBinding {
  id: SemanticActionId;
  target?: string;
  params?: Record<string, unknown>;
}

export interface ActionDispatchRequest {
  action: ActionBinding;
  origin: "ui_node" | "terminal_view" | "plugin_surface";
}

export interface ActionDispatchResult {
  accepted: boolean;
  reason?: string;
}

export interface ActionDispatcher {
  dispatch(request: ActionDispatchRequest): Promise<ActionDispatchResult>;
}
