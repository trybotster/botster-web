import type { UiActionRequest, UiActionResult } from "@trybotster/ui-contract";

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
  payload?: unknown;
  label?: string;
  disabled?: boolean;
  pluginSurface?: {
    package_name: string;
    request: Omit<UiActionRequest, "request_id">;
  };
}

export interface ActionDispatchRequest {
  action: ActionBinding;
  origin: "ui_node" | "terminal_view" | "plugin_surface";
}

export interface ActionDispatchResult {
  accepted: boolean;
  request_id?: string;
  result?: unknown;
  reason?: string;
  pluginActionResult?: UiActionResult;
}

export interface ActionDispatcher {
  dispatch(request: ActionDispatchRequest): Promise<ActionDispatchResult>;
  receiveResult(result: ActionResultEnvelope): void;
  rejectPending(reason: string): void;
  pendingCount(): number;
}

export interface ActionRequestEnvelope extends ActionDispatchRequest {
  request_id: string;
}

export interface ActionResultEnvelope {
  request_id: string;
  accepted?: boolean;
  ok?: boolean;
  result?: unknown;
  reason?: string;
  error?: string;
}

export interface ActionDispatcherOptions {
  send: (request: ActionRequestEnvelope) => Promise<void>;
  idGenerator?: () => string;
  timeoutMs?: number;
}

interface PendingAction {
  resolve(result: ActionDispatchResult): void;
  timer?: ReturnType<typeof setTimeout>;
}

let nextRequestId = 1;

export class CorrelatedActionDispatcher implements ActionDispatcher {
  private readonly pending = new Map<string, PendingAction>();
  private readonly idGenerator: () => string;
  private readonly timeoutMs: number;

  constructor(private readonly options: ActionDispatcherOptions) {
    this.idGenerator = options.idGenerator ?? (() => `ui-action-${nextRequestId++}`);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  dispatch(request: ActionDispatchRequest): Promise<ActionDispatchResult> {
    const requestId = this.idGenerator();
    const envelope: ActionRequestEnvelope = {
      request_id: requestId,
      action: request.action,
      origin: request.origin
    };

    return new Promise((resolve) => {
      const pending: PendingAction = { resolve };

      pending.timer = setTimeout(() => {
        this.resolve(requestId, {
          accepted: false,
          request_id: requestId,
          reason: "action_result timeout"
        });
      }, this.timeoutMs);

      this.pending.set(requestId, pending);

      this.options.send(envelope).catch((error: unknown) => {
        this.resolve(requestId, {
          accepted: false,
          request_id: requestId,
          reason: error instanceof Error ? error.message : "action_request send failed"
        });
      });
    });
  }

  receiveResult(result: ActionResultEnvelope): void {
    if (!this.pending.has(result.request_id)) {
      return;
    }

    const accepted = result.accepted ?? result.ok ?? false;

    const resultRecord = result.result && typeof result.result === "object" && !Array.isArray(result.result)
      ? result.result as Record<string, unknown>
      : {};
    const pluginActionResult = resultRecord.plugin_action_result as UiActionResult | undefined;

    this.resolve(result.request_id, {
      accepted,
      request_id: result.request_id,
      result: result.result,
      reason: result.reason ?? result.error,
      ...(pluginActionResult ? { pluginActionResult } : {})
    });
  }

  rejectPending(reason: string): void {
    for (const requestId of Array.from(this.pending.keys())) {
      this.resolve(requestId, {
        accepted: false,
        request_id: requestId,
        reason
      });
    }
  }

  pendingCount(): number {
    return this.pending.size;
  }

  private resolve(requestId: string, result: ActionDispatchResult): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    this.pending.delete(requestId);
    pending.resolve(result);
  }
}

export function createActionDispatcher(options: ActionDispatcherOptions): ActionDispatcher {
  return new CorrelatedActionDispatcher(options);
}
