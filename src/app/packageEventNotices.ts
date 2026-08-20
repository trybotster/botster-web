/** Production filter and identity join for Hub `question.opened` notices. */

export const QUESTION_OPENED_EVENT_OWNER = "project-pipelines";
export const QUESTION_OPENED_EVENT_NAME = "question.opened";
export const RUN_STEP_FAMILY = "project-pipelines.run_step";
export const RUN_FAMILY = "project-pipelines.run";
export const PACKAGE_EVENT_NOTICE_DURATION_MS = 5000;

export const questionOpenedSubscribePayload = {
  owner: QUESTION_OPENED_EVENT_OWNER,
  name: QUESTION_OPENED_EVENT_NAME,
  subjects: [] as string[]
};

export type WorkflowIdentity = {
  run_id?: string;
  ticket_id?: string;
  step_id?: string;
};

export type PackageEventSubscribeSpec = {
  owner: string;
  name: string;
  subjects: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Join the viewed session uuid to Project Pipelines 0.4.0 `run_step.agent_session_uuid`.
 * A missing or blank binding resolves no identity.
 */
export function workflowIdentityFromSessionRecords(
  sessionId: string | undefined,
  runSteps: ReadonlyArray<Record<string, unknown>>,
  runs: ReadonlyArray<Record<string, unknown>>
): WorkflowIdentity | undefined {
  if (!sessionId) return undefined;
  const step = runSteps.find((record) => record.agent_session_uuid === sessionId);
  if (!step) return undefined;
  const run_id = optionalId(step.run_id);
  const step_id = optionalId(step.step_id);
  const run = run_id ? runs.find((record) => record.id === run_id) : undefined;
  const ticket_id = optionalId(run?.ticket_id);
  if (!run_id && !step_id && !ticket_id) return undefined;
  return { run_id, step_id, ticket_id };
}

export function viewedSessionIdFromRoute(route: { view: string; sessionId?: string }): string | undefined {
  return route.view === "session" && typeof route.sessionId === "string" && route.sessionId.length > 0
    ? route.sessionId
    : undefined;
}

const WORKFLOW_ID_KEYS = ["run_id", "ticket_id", "step_id"] as const;

/**
 * Accept a payload only when at least one present workflow ID matches identity
 * and no present workflow ID conflicts with identity.
 * Project Pipelines step IDs repeat across runs, so a matching step_id cannot
 * override a conflicting run_id or ticket_id.
 */
export function payloadMatchesWorkflowIdentity(
  payload: Record<string, unknown>,
  identity: WorkflowIdentity
): boolean {
  let matched = false;
  for (const key of WORKFLOW_ID_KEYS) {
    const payloadId = optionalId(payload[key]);
    const identityId = optionalId(identity[key]);
    if (!payloadId || !identityId) continue;
    if (payloadId === identityId) {
      matched = true;
    } else {
      return false;
    }
  }
  return matched;
}

/**
 * Return the transient notice text when the payload is valid and matches active workflow identity.
 * No identity, invalid payloads, conflicting ids, and non-matching ids produce no notice.
 */
export function questionOpenedNoticeFromEvent(
  payload: unknown,
  identity: WorkflowIdentity | undefined
): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.question_id !== "string" || payload.question_id.length === 0) return undefined;
  if (payload.kind !== "human" && payload.kind !== "agent") return undefined;
  if (typeof payload.notice !== "string" || payload.notice.length === 0) return undefined;
  for (const key of WORKFLOW_ID_KEYS) {
    if (payload[key] !== undefined && typeof payload[key] !== "string") return undefined;
  }
  if (!identity) return undefined;
  return payloadMatchesWorkflowIdentity(payload, identity) ? payload.notice : undefined;
}

export function packageEventSubscriptionKey(spec: PackageEventSubscribeSpec): string {
  return `${spec.owner}\0${spec.name}\0${JSON.stringify(spec.subjects)}`;
}
