import type { ActionBinding } from "./actions";
import type { DaemonQuarantine, DaemonQuarantineTarget } from "./generated/daemon-protocol";

/** Action that asks the Hub to resolve one quarantine (protocol 11 resolve_quarantine). */
export const resolveQuarantineActionId = "botster.hub.resolve_quarantine";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The quarantines the Hub reports in its status, in Hub order. An entry of an unknown kind or
 * with missing identity is left out: it cannot be addressed by resolve_quarantine.
 */
export function hubQuarantines(hubStatus: Record<string, unknown> | undefined): DaemonQuarantine[] {
  const entries = hubStatus?.quarantines;
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry): entry is DaemonQuarantine => {
    if (!isRecord(entry)) return false;
    if (entry.kind === "package") return typeof entry.package_name === "string" && entry.package_name.length > 0;
    if (entry.kind === "repository_session_types") return typeof entry.root === "string" && entry.root.length > 0;
    return false;
  });
}

export function quarantineTarget(quarantine: DaemonQuarantine): DaemonQuarantineTarget {
  return quarantine.kind === "package"
    ? { kind: "package", package_name: quarantine.package_name }
    : { kind: "repository_session_types", root: quarantine.root };
}

/** Stable identity of a quarantine target, for keys, per-row feedback, and test ids. */
export function quarantineTargetKey(target: DaemonQuarantineTarget): string {
  return target.kind === "package" ? `package:${target.package_name}` : `repository_session_types:${target.root}`;
}

export function quarantineKey(quarantine: DaemonQuarantine): string {
  return quarantineTargetKey(quarantineTarget(quarantine));
}

/**
 * Per-row Resolve feedback. pending: dispatched, no answer yet. refreshing: the Hub confirmed
 * the resolve and the status read that follows has not settled. refused: the Hub refused it
 * (reason shown, Resolve offered again). resolved_stale: resolved, but the status re-read failed,
 * so the row may still be listed. failed: the dispatch failed without a Hub answer. Resolve is
 * offered only after refused and failed.
 */
export type QuarantineResolveOutcome =
  | { state: "pending" }
  | { state: "refreshing" }
  | { state: "refused"; message: string }
  | { state: "resolved_stale"; message: string }
  | { state: "failed"; message: string };

/**
 * An outcome, the Resolve operation that owns it, and the quarantined_at_ms of the listing that
 * operation was dispatched for.
 */
export type QuarantineRowOutcome = QuarantineResolveOutcome & {
  operationId: string;
  quarantinedAtMs: number | undefined;
};

export type QuarantineRowOutcomes = Record<string, QuarantineRowOutcome>;

function replaceOutcome(
  current: QuarantineRowOutcomes,
  key: string,
  entry: QuarantineRowOutcome,
  outcome: QuarantineResolveOutcome | null
): QuarantineRowOutcomes {
  const next = { ...current };
  if (outcome) next[key] = { ...outcome, operationId: entry.operationId, quarantinedAtMs: entry.quarantinedAtMs };
  else delete next[key];
  return next;
}

/** A new Resolve operation owns the row from dispatch: pending. */
export function startQuarantineResolve(
  current: QuarantineRowOutcomes,
  key: string,
  operationId: string,
  quarantinedAtMs: number | undefined
): QuarantineRowOutcomes {
  return { ...current, [key]: { state: "pending", operationId, quarantinedAtMs } };
}

/**
 * The action result (or dispatch failure) of one operation. It settles only that operation's
 * pending entry: its status_refresh may have settled it already, and a newer operation may own
 * the row.
 */
export function settleQuarantineResult(
  current: QuarantineRowOutcomes,
  key: string,
  operationId: string,
  outcome: QuarantineResolveOutcome
): QuarantineRowOutcomes {
  const entry = current[key];
  if (entry?.operationId !== operationId || entry.state !== "pending") return current;
  return replaceOutcome(current, key, entry, outcome);
}

/**
 * The status_refresh of one operation: null clears the row, resolved_stale keeps it without
 * Resolve. It settles only that operation's pending or refreshing entry.
 */
export function settleQuarantineRefresh(
  current: QuarantineRowOutcomes,
  key: string,
  operationId: string,
  outcome: QuarantineResolveOutcome | null
): QuarantineRowOutcomes {
  const entry = current[key];
  if (entry?.operationId !== operationId || (entry.state !== "pending" && entry.state !== "refreshing")) return current;
  return replaceOutcome(current, key, entry, outcome);
}

/**
 * The outcome that applies to a listed quarantine. An outcome for an earlier listing of the same
 * target (the target was quarantined again) does not apply.
 */
export function quarantineRowOutcome(
  quarantine: DaemonQuarantine,
  outcomes: QuarantineRowOutcomes | undefined
): QuarantineResolveOutcome | undefined {
  const outcome = outcomes?.[quarantineKey(quarantine)];
  return outcome && outcome.quarantinedAtMs === quarantine.quarantined_at_ms ? outcome : undefined;
}

/** The Hub request carries only the target; quarantined_at_ms keys the row feedback. */
export function resolveQuarantineAction(quarantine: DaemonQuarantine): ActionBinding {
  return {
    id: resolveQuarantineActionId,
    label: "Resolve",
    params: { target: quarantineTarget(quarantine), quarantined_at_ms: quarantine.quarantined_at_ms }
  };
}

/** The Resolve operation an action belongs to (set by the dispatching hook). */
export function quarantineOperationIdFromAction(action: ActionBinding): string | undefined {
  const value = action.params?.operation_id;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** The quarantined_at_ms that a Resolve action was dispatched for. */
export function quarantinedAtMsFromAction(action: ActionBinding): number | undefined {
  const value = action.params?.quarantined_at_ms;
  return typeof value === "number" ? value : undefined;
}

/** The target an action carries, or undefined when it is not a well-formed quarantine target. */
export function quarantineTargetFromAction(action: ActionBinding): DaemonQuarantineTarget | undefined {
  const target = action.params?.target;
  if (!isRecord(target)) return undefined;
  if (target.kind === "package" && typeof target.package_name === "string" && target.package_name.length > 0) {
    return { kind: "package", package_name: target.package_name };
  }
  if (target.kind === "repository_session_types" && typeof target.root === "string" && target.root.length > 0) {
    return { kind: "repository_session_types", root: target.root };
  }
  return undefined;
}
