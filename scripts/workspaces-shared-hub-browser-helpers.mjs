import { createHash } from "node:crypto";

const allowSkipPattern = /^BOTSTER_LIVE_ALLOW_.*_SKIP$/;
const lifecycleStates = new Set(["current", "ended"]);

export function assertNoRequiredSmokeSkip(environment = process.env) {
  const rejected = Object.entries(environment)
    .filter(([name, value]) => allowSkipPattern.test(name) && value != null && value !== "0" && value !== "")
    .map(([name]) => name)
    .sort();
  if (rejected.length > 0) {
    throw new Error(`shared-Hub browser proof rejects allow-skip inputs: ${rejected.join(", ")}`);
  }
}

export function parseWorkspacesSpawnAssignment(serialized) {
  if (typeof serialized !== "string" || serialized.trim() === "") {
    throw new Error("BOTSTER_WORKSPACES_SPAWN_CASES is required");
  }
  let assignment;
  try {
    assignment = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`BOTSTER_WORKSPACES_SPAWN_CASES must be JSON: ${error.message}`, { cause: error });
  }
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
    throw new Error("BOTSTER_WORKSPACES_SPAWN_CASES must be an object");
  }
  const generation = requiredString(assignment.generation, "generation");
  const entryState = requiredString(assignment.entry_state, "entry_state");
  if (!new Set(["cold", "reused"]).has(entryState)) {
    throw new Error("entry_state must be cold or reused");
  }
  const workspaceName = requiredString(assignment.workspace_name, "workspace_name");
  if (!Array.isArray(assignment.cases) || assignment.cases.length === 0) {
    throw new Error("cases must be a non-empty array");
  }
  const caseIds = new Set();
  const cases = assignment.cases.map((candidate, index) => {
    const path = `cases[${index}]`;
    const normalized = {
      case_id: requiredString(candidate?.case_id, `${path}.case_id`),
      target_id: requiredString(candidate?.target_id, `${path}.target_id`),
      branch: requiredString(candidate?.branch, `${path}.branch`),
      template_id: requiredString(candidate?.template_id, `${path}.template_id`),
      prompt: optionalString(candidate?.prompt, `${path}.prompt`),
      ticket_id: optionalString(candidate?.ticket_id, `${path}.ticket_id`),
      expected_lifecycle: candidate?.expected_lifecycle ?? "ended"
    };
    if (!lifecycleStates.has(normalized.expected_lifecycle)) {
      throw new Error(`${path}.expected_lifecycle must be current or ended`);
    }
    if (caseIds.has(normalized.case_id)) throw new Error(`duplicate case_id ${normalized.case_id}`);
    caseIds.add(normalized.case_id);
    return normalized;
  });
  const observe = assignment.observe == null ? null : {
    workspace_id: requiredString(assignment.observe.workspace_id, "observe.workspace_id"),
    workspace_name: requiredString(assignment.observe.workspace_name, "observe.workspace_name"),
    session_id: requiredString(assignment.observe.session_id, "observe.session_id"),
    lifecycle: requiredString(assignment.observe.lifecycle, "observe.lifecycle")
  };
  if (entryState === "cold" && observe != null) throw new Error("cold entry_state cannot include observe");
  if (entryState === "reused" && observe == null) throw new Error("reused entry_state requires observe");
  return { generation, entry_state: entryState, workspace_name: workspaceName, observe, cases };
}

export function assignmentDigest(assignment) {
  return createHash("sha256").update(stableJson(assignment)).digest("hex");
}

export function chooseCreateControl(entryState, renderedNodeIds) {
  const expected = entryState === "cold"
    ? "botster-workspaces-empty-create"
    : "botster-workspaces-new";
  if (!(renderedNodeIds ?? []).includes(expected)) {
    throw new Error(`${entryState} Workspaces surface omitted required rendered create control ${expected}`);
  }
  return expected;
}

export function assertReconciliationCounts(before, after) {
  for (const key of ["plugin_surface_render", "list_sessions"]) {
    if (before?.[key] !== after?.[key]) {
      throw new Error(`shared-Hub reconciliation changed ${key}: before=${before?.[key]} after=${after?.[key]}`);
    }
  }
  return { plugin_surface_render: after.plugin_surface_render, list_sessions: after.list_sessions };
}

export function assertTwoGenerationLedger(summaries) {
  if (!Array.isArray(summaries) || summaries.length !== 2) {
    throw new Error(`shared-Hub smoke requires two driver generations; observed=${summaries?.length ?? 0}`);
  }
  const [cold, reused] = summaries;
  if (cold.entry_state !== "cold" || cold.create_control !== "botster-workspaces-empty-create") {
    throw new Error("first shared-Hub generation did not prove the cold empty-state create path");
  }
  if (reused.entry_state !== "reused" || reused.create_control !== "botster-workspaces-new") {
    throw new Error("second shared-Hub generation did not prove the reused toolbar create path");
  }
  if (reused.observed_prior?.workspace_id !== cold.workspace?.workspace_id ||
      reused.observed_prior?.session_id !== cold.cases?.[0]?.session?.session_id) {
    throw new Error("second shared-Hub generation did not observe the first generation identities");
  }
  for (const summary of summaries) {
    if (summary.completed !== true || summary.lifecycle_reconciliation !== true) {
      throw new Error(`shared-Hub generation ${summary.generation} is incomplete`);
    }
    if (summary.case_count !== summary.cases?.length || summary.case_count < 1) {
      throw new Error(`shared-Hub generation ${summary.generation} omitted assigned case evidence`);
    }
  }
  return { generations: summaries.map((summary) => summary.generation), completed: true };
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
  return value.trim();
}

function optionalString(value, path) {
  if (value == null) return undefined;
  return requiredString(value, path);
}

function stableJson(value) {
  return JSON.stringify(value, (_key, nested) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)))
      : nested
  );
}
