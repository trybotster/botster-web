/** New-session picker form helpers. Hub list-for-target remains authoritative. */

import type { ActionBinding } from "../botster/actions";
import { readRecord, stringValue } from "./values";

export type SpawnSessionListStatus = "loading" | "ready" | "error";

/** One-shot Hub option for New session; not the management entity catalog row. */
export interface SpawnSessionTypeOption {
  sessionTypeId: string;
  label: string;
  available: boolean;
}
export interface SpawnSessionFormState {
  targetId: string;
  targetLabel: string;
  sessionTypeId: string;
  prompt: string;
  submitting: boolean;
  error?: string;
  /** Bumped on each open so late list responses for a prior open cannot apply. */
  listGeneration: number;
  listStatus: SpawnSessionListStatus;
  options: SpawnSessionTypeOption[];
}

/**
 * Open New session with an empty one-shot list shell. Options come only from Hub
 * `list_session_types_for_target` — never from the management entity catalog.
 */
export function spawnSessionFormForTarget(
  target: Record<string, unknown>,
  listGeneration: number
): SpawnSessionFormState {
  const targetId = stringValue(target.target_id, String(target.id));
  return {
    targetId,
    targetLabel: stringValue(target.label, stringValue(target.title, targetId)),
    sessionTypeId: "",
    prompt: "",
    submitting: false,
    listGeneration,
    listStatus: "loading",
    options: []
  };
}

export function listSessionTypesForTargetAction(targetId: string): ActionBinding {
  return {
    id: "botster.session_type.daemon_request",
    target: targetId,
    label: "List session types for spawn point",
    params: {
      daemon_request: {
        request_type: "list_session_types_for_target",
        target_id: targetId
      }
    }
  };
}

/**
 * Map Hub list rows to picker options using authoritative Hub `session_type_id` only.
 * Returns undefined when the payload is missing, not an array, or contains a row without
 * `session_type_id` — callers must treat that as error, not empty success.
 * An empty array is a valid Hub empty list.
 */
export function spawnSessionOptionsFromHubList(sessionTypes: unknown): SpawnSessionTypeOption[] | undefined {
  if (!Array.isArray(sessionTypes)) return undefined;
  const options: SpawnSessionTypeOption[] = [];
  for (const row of sessionTypes) {
    const record = readRecord(row);
    const sessionTypeId = typeof record.session_type_id === "string" ? record.session_type_id.trim() : "";
    if (!sessionTypeId) return undefined;
    options.push({
      sessionTypeId,
      label: stringValue(record.label, sessionTypeId),
      available: record.available !== false
    });
  }
  return options;
}

/**
 * Apply a list response only when the modal is still open for the same target and
 * generation. Returns undefined when the response is stale or the modal closed.
 * Ready/empty success requires an accepted response with a real array of Hub rows.
 */
export function applySpawnSessionListResult(
  form: SpawnSessionFormState | undefined,
  identity: { targetId: string; listGeneration: number },
  result: { accepted: boolean; reason?: string; sessionTypes?: unknown }
): SpawnSessionFormState | undefined {
  if (!form) return undefined;
  if (form.targetId !== identity.targetId || form.listGeneration !== identity.listGeneration) {
    return undefined;
  }
  if (!result.accepted) {
    return {
      ...form,
      listStatus: "error",
      options: [],
      sessionTypeId: "",
      error: result.reason ?? "Botster could not load session types for this spawn point."
    };
  }
  const options = spawnSessionOptionsFromHubList(result.sessionTypes);
  if (options === undefined) {
    return {
      ...form,
      listStatus: "error",
      options: [],
      sessionTypeId: "",
      error: result.reason
        ?? "Botster returned an incomplete session type list for this spawn point."
    };
  }
  const available = options.filter((option) => option.available);
  return {
    ...form,
    listStatus: "ready",
    options,
    sessionTypeId: available.length === 1 ? available[0].sessionTypeId : "",
    error: undefined
  };
}

export function spawnSessionAction(form: SpawnSessionFormState, sessionId: string): ActionBinding {
  return {
    id: "botster.spawn_point.spawn_session",
    target: form.targetId,
    label: "Start session",
    params: {
      session_type_id: form.sessionTypeId,
      session_id: sessionId,
      prompt: form.prompt.trim()
    }
  };
}

export function rejectedSpawnSessionForm(
  form: SpawnSessionFormState,
  reason: string | undefined
): SpawnSessionFormState {
  return {
    ...form,
    submitting: false,
    error: reason ?? "Botster could not start this session."
  };
}
