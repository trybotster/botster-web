/** Session type authoring forms and Hub mutation projection helpers. */

import { environmentFromForm, formatMetadata, joinTokenList, readRecord, readString, stringArray, stringRecord, stringValue, tokenListFromForm } from "./values";

/**
 * Permissive ONLY before Hub status arrives. Once a status record exists it is authoritative,
 * so a missing, malformed, or empty feature list all mean unsupported — none of them declare
 * `session_type_entity_subscriptions`. Treating a loaded record as "still loading" would let
 * the client infer capability from Hub's silence, which is the inference this surface removes.
 */
export function sessionTypeManagementSupported(hubStatus: Record<string, unknown> | undefined): boolean {
  if (hubStatus === undefined) return true;
  const features = readRecord(hubStatus.compatibility).features;
  return Array.isArray(features) && features.includes("session_type_entity_subscriptions");
}


export type SessionTypePresetId = "agent" | "shell" | "custom";
export type SessionTypeExecutionMode = "relative_executable" | "shell_command";

export interface SessionTypePreset {
  id: SessionTypePresetId;
  label: string;
  description: string;
  role: string;
  interaction: string;
  lifecycle: string;
  traits: string;
}

/** Named starting points for the common 80% shapes Hub already documents. */
export const SESSION_TYPE_PRESETS: Record<Exclude<SessionTypePresetId, "custom">, SessionTypePreset> = {
  agent: {
    id: "agent",
    label: "Agent",
    description: "Interactive coding agent (task lifecycle, terminal trait)",
    role: "botster.agent",
    interaction: "interactive",
    lifecycle: "task",
    traits: "terminal"
  },
  shell: {
    id: "shell",
    label: "Shell",
    description: "Interactive terminal accessory (botster.accessory, terminal trait)",
    role: "botster.accessory",
    interaction: "interactive",
    // Match TUI Shell seed (`task`); Hub still owns lifecycle vocabulary.
    lifecycle: "task",
    traits: "terminal"
  }
};

export interface SessionTypeFormState {
  mode: "create" | "edit";
  source: string;
  sourceTargetId: string;
  sessionTypeId?: string;
  /** Authored definition.target_id — distinct from mutation source target_id. */
  definitionTargetId: string;
  id: string;
  label: string;
  description: string;
  icon: string;
  /**
   * When false (create default), Name drives both label and id (slug).
   * Set true when the operator edits Identifier in Advanced.
   */
  idLocked: boolean;
  /** UX starting point only; wire fields remain role/interaction/lifecycle/traits. */
  preset: SessionTypePresetId;
  role: string;
  interaction: string;
  traits: string;
  lifecycle: string;
  executionMode: SessionTypeExecutionMode;
  command: string;
  args: string;
  workingDirectoryPolicy: string;
  workingDirectoryPath: string;
  environment: string;
  allowedEnvironmentOverrides: string;
  contextKeys: string;
  /** Authored arrays/maps; re-emitted verbatim while the paired text control is untouched. */
  seededTraits?: string[];
  seededArgs?: string[];
  seededContext?: string[];
  seededAllowedEnvironmentOverrides?: string[];
  seededEnvironment?: Record<string, string>;
  submitting: boolean;
  error?: string;
}

export const emptySessionTypeForm: SessionTypeFormState = {
  mode: "create",
  source: "device",
  sourceTargetId: "",
  definitionTargetId: "",
  id: "",
  label: "",
  description: "",
  icon: "",
  idLocked: false,
  preset: "custom",
  role: "",
  interaction: "",
  traits: "",
  lifecycle: "",
  executionMode: "relative_executable",
  command: "",
  args: "",
  // Hub default when omitted is package_root (source root). Form starts explicit.
  workingDirectoryPolicy: "package_root",
  workingDirectoryPath: "",
  environment: "",
  allowedEnvironmentOverrides: "",
  contextKeys: "",
  submitting: false
};

/**
 * Product name → bare Hub definition id (monorepo style: "claude", "rails-server").
 * Hub still requires a separate id on the wire; create derives it from Name.
 */
export function sessionTypeIdFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);
}

/**
 * Primary Name field: sets display label; on create also sets id unless locked.
 */
export function applySessionTypeName(
  form: SessionTypeFormState,
  name: string
): SessionTypeFormState {
  if (form.mode === "create" && !form.idLocked) {
    return {
      ...form,
      label: name,
      id: sessionTypeIdFromName(name)
    };
  }
  return { ...form, label: name };
}

/** Whether Advanced should open for non-default authored policy fields. */
export function sessionTypeFormHasAdvancedValues(form: SessionTypeFormState): boolean {
  return (
    form.workingDirectoryPolicy === "relative" ||
    Boolean(form.workingDirectoryPath.trim()) ||
    Boolean(form.environment.trim()) ||
    Boolean(form.allowedEnvironmentOverrides.trim()) ||
    Boolean(form.contextKeys.trim()) ||
    Boolean(form.description.trim()) ||
    Boolean(form.args.trim()) ||
    form.idLocked
  );
}

/**
 * Create form defaults to the Agent preset so the common case is not free-text
 * role / interaction / lifecycle / traits entry.
 */
export function createSessionTypeForm(
  preset: SessionTypePresetId = "agent"
): SessionTypeFormState {
  return applySessionTypePreset({ ...emptySessionTypeForm }, preset);
}

/**
 * Apply a named preset onto form semantics. Custom keeps current free-text values
 * so the operator can continue editing without a wipe.
 *
 * Clears `seededTraits` when a named preset writes traits text, so submit uses the
 * new tokens rather than a prior lossless seed.
 */
export function applySessionTypePreset(
  form: SessionTypeFormState,
  presetId: SessionTypePresetId
): SessionTypeFormState {
  if (presetId === "custom") {
    return { ...form, preset: "custom" };
  }
  const preset = SESSION_TYPE_PRESETS[presetId];
  return {
    ...form,
    preset: presetId,
    role: preset.role,
    interaction: preset.interaction,
    lifecycle: preset.lifecycle,
    traits: preset.traits,
    seededTraits: undefined
  };
}

/**
 * Match role / interaction / lifecycle to a named preset when they are exact.
 * Traits stay free so extra tokens (or empty traits from a TUI-authored draft)
 * do not force Custom — same rule as the TUI client.
 */
export function inferSessionTypePreset(
  form: Pick<SessionTypeFormState, "role" | "interaction" | "lifecycle" | "traits">
): SessionTypePresetId {
  const role = form.role.trim();
  const interaction = form.interaction.trim();
  const lifecycle = form.lifecycle.trim();

  for (const preset of Object.values(SESSION_TYPE_PRESETS)) {
    if (
      role === preset.role &&
      interaction === preset.interaction &&
      lifecycle === preset.lifecycle
    ) {
      return preset.id;
    }
  }
  return "custom";
}

/**
 * One-line scan of filled semantics so Agent/Shell create stays honest without
 * opening Advanced. Empty when no tokens are set.
 */
export function sessionTypeSemanticsSummary(
  form: Pick<SessionTypeFormState, "role" | "interaction" | "lifecycle" | "traits">
): string {
  return [form.role, form.interaction, form.lifecycle, form.traits]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Hub only authors package_root | relative. Empty form policy means Hub's default
 * (package_root). Unknown values from lossless edit stay selectable.
 */
export function workingDirectoryPolicyOptions(current: string): string[] {
  const known = ["package_root", "relative"];
  const trimmed = current.trim();
  if (trimmed && !known.includes(trimmed)) {
    return [...known, trimmed];
  }
  return known;
}

/** Select value: blank means Hub default package_root. */
export function workingDirectoryPolicySelectValue(policy: string): string {
  return policy.trim() || "package_root";
}

export function workingDirectoryPolicyLabel(policy: string): string {
  switch (policy) {
    case "":
    case "package_root":
      // Wire token is package_root; for device/repo sources this is the source root,
      // not only a package install tree.
      return "Source root";
    case "relative":
      return "Relative path under source root";
    default:
      return policy;
  }
}

/**
 * A mutation source for an existing row, read from Hub's own `source` and `target_id`.
 * Deliberately not a full form projection: the published row cannot reconstruct an
 * authoring definition, so nothing here may be used to seed an edit.
 */
export function sessionTypeMutationSourceFromRecord(record: Record<string, unknown>): Record<string, unknown> {
  const source = stringValue(record.source, "device");
  return source === "repo"
    ? { source: "repo", target_id: stringValue(record.target_id, "") }
    : { source };
}

/** Product label for wire source `device` (hub-wide session type storage). */
export const SESSION_TYPE_SOURCE_GLOBAL_LABEL = "Global";

/**
 * Operator-facing label for one spawn point in the session-type home picker.
 * Pairs display name with root path (or target id) so targets stay distinguishable.
 */
export function spawnPointSessionTypeSourceLabel(
  name: string,
  root: string,
  targetId: string
): string {
  const displayName = name.trim() || targetId.trim() || "Spawn point";
  const path = root.trim() || targetId.trim();
  return path ? `${displayName} — ${path}` : displayName;
}

/**
 * Enabled admitted spawn targets that can host a project-scoped session type.
 * Hub owns admission; wire source is `repo` + target_id.
 */
export function enabledSpawnPointSessionTypeSources(
  spawnTargets: Record<string, unknown>[]
): { targetId: string; label: string }[] {
  return spawnTargets
    .filter((target) => target.enabled !== false)
    .map((target) => {
      const targetId = stringValue(target.target_id, String(target.id));
      const name = stringValue(target.label, stringValue(target.title, targetId));
      const root = stringValue(target.root, "");
      return {
        targetId,
        label: spawnPointSessionTypeSourceLabel(name, root, targetId)
      };
    });
}

/**
 * Flat writable homes: Global plus each enabled spawn point.
 * Prefer the two-step create UI (Global | Spawn point → pick target); this list remains
 * for tests and any single-select consumer.
 */
export function writableSessionTypeSources(
  spawnTargets: Record<string, unknown>[]
): { source: string; targetId: string; label: string }[] {
  return [
    { source: "device", targetId: "", label: SESSION_TYPE_SOURCE_GLOBAL_LABEL },
    ...enabledSpawnPointSessionTypeSources(spawnTargets).map((point) => ({
      source: "repo",
      targetId: point.targetId,
      label: point.label
    }))
  ];
}

/**
 * Apply Global vs Spawn point on create. Picking Spawn point auto-selects the only
 * enabled target when there is exactly one.
 */
export function applySessionTypeHomeKind(
  form: SessionTypeFormState,
  kind: "device" | "repo",
  spawnPoints: { targetId: string }[]
): SessionTypeFormState {
  if (kind === "device") {
    return { ...form, source: "device", sourceTargetId: "" };
  }
  const stillValid = spawnPoints.some((point) => point.targetId === form.sourceTargetId);
  const sourceTargetId = stillValid
    ? form.sourceTargetId
    : spawnPoints.length === 1
      ? spawnPoints[0].targetId
      : "";
  return { ...form, source: "repo", sourceTargetId };
}

export function sessionTypeMutationSource(form: SessionTypeFormState): Record<string, unknown> {
  return form.source === "repo"
    ? { source: "repo", target_id: form.sourceTargetId }
    : { source: form.source };
}

export function sessionTypeDefinitionFromForm(form: SessionTypeFormState): Record<string, unknown> {
  const description = form.description.trim();
  const icon = form.icon.trim();
  const definitionTargetId = form.definitionTargetId.trim();
  const workingDirectoryPolicy = form.workingDirectoryPolicy.trim();
  // Preserve empty relative paths: Hub's Relative variant requires `path` (no serde default).
  const workingDirectoryPath = form.workingDirectoryPath.trim();

  return {
    id: form.id.trim(),
    label: form.label.trim(),
    // Accepted normalization (plan + Hub Option+skip_serializing_if): blank form strings
    // omit on the wire (absent / None), not Some(""). Opening and saving therefore collapses
    // authored Some("") and whitespace-only values to absent; not dual-stated in the UI.
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    role: form.role.trim(),
    interaction: form.interaction.trim(),
    traits: tokenListFromForm(form.traits, form.seededTraits),
    lifecycle: form.lifecycle.trim(),
    execution: { mode: form.executionMode },
    command: form.command.trim(),
    args: tokenListFromForm(form.args, form.seededArgs),
    // Hub enum is package_root | relative. Blank means the same default as package_root.
    ...(workingDirectoryPolicy === "relative"
      ? { working_directory: { policy: "relative", path: workingDirectoryPath } }
      : workingDirectoryPolicy === "package_root" || !workingDirectoryPolicy
        ? { working_directory: { policy: "package_root" } }
        : {
            working_directory: {
              policy: workingDirectoryPolicy,
              ...(workingDirectoryPath ? { path: workingDirectoryPath } : {})
            }
          }),
    environment: environmentFromForm(form.environment, form.seededEnvironment),
    allowed_environment_overrides: tokenListFromForm(
      form.allowedEnvironmentOverrides,
      form.seededAllowedEnvironmentOverrides
    ),
    context: tokenListFromForm(form.contextKeys, form.seededContext),
    // Opaque authored field: re-emit on every create/update when present so wholesale
    // replacement cannot drop it. Never invent this from the sanitized row's target_id.
    ...(definitionTargetId ? { target_id: definitionTargetId } : {})
  };
}

/**
 * Seed the edit form solely from an accepted `DaemonSessionTypeEditableDefinition`.
 * Sanitized entity rows must not be passed here — they omit path/environment and would
 * cause silent data loss under wholesale update.
 */
export function sessionTypeFormFromAuthoringDefinition(
  editable: Record<string, unknown>
): SessionTypeFormState | undefined {
  const definition = readRecord(editable.definition);
  const source = readRecord(editable.source);
  const sourceKind = stringValue(source.source, "");
  if (!definition.id || !sourceKind) return undefined;

  const workingDirectory = readRecord(definition.working_directory);
  const seededTraits = stringArray(definition.traits);
  const seededArgs = stringArray(definition.args);
  const seededContext = stringArray(definition.context);
  const seededAllowedEnvironmentOverrides = stringArray(definition.allowed_environment_overrides);
  const seededEnvironment = stringRecord(definition.environment);

  const role = stringValue(definition.role, "");
  const interaction = stringValue(definition.interaction, "");
  const traits = joinTokenList(seededTraits);
  const lifecycle = stringValue(definition.lifecycle, "");
  const execution = readRecord(definition.execution);
  const executionMode = stringValue(execution.mode, "relative_executable") === "shell_command"
    ? "shell_command"
    : "relative_executable";

  return {
    mode: "edit",
    source: sourceKind,
    sourceTargetId: sourceKind === "repo" ? stringValue(source.target_id, "") : "",
    sessionTypeId: stringValue(editable.session_type_id, ""),
    definitionTargetId: stringValue(definition.target_id, ""),
    id: stringValue(definition.id, ""),
    label: stringValue(definition.label, ""),
    description: stringValue(definition.description, ""),
    icon: stringValue(definition.icon, ""),
    // Edit never rewrites id from Name; id is fixed on create.
    idLocked: true,
    preset: inferSessionTypePreset({ role, interaction, lifecycle, traits }),
    role,
    interaction,
    traits,
    lifecycle,
    executionMode,
    command: stringValue(definition.command, ""),
    args: joinTokenList(seededArgs),
    // Absent working_directory on the wire is Hub's package_root default.
    workingDirectoryPolicy: stringValue(workingDirectory.policy, "package_root"),
    workingDirectoryPath: stringValue(workingDirectory.path, ""),
    environment: formatMetadata(seededEnvironment),
    allowedEnvironmentOverrides: joinTokenList(seededAllowedEnvironmentOverrides),
    contextKeys: joinTokenList(seededContext),
    seededTraits,
    seededArgs,
    seededContext,
    seededAllowedEnvironmentOverrides,
    seededEnvironment,
    submitting: false
  };
}

/**
 * Renders Hub's own rejection on the owning form. The error kind is carried verbatim when
 * Hub supplies one; Web never authors a replacement explanation.
 */
export function rejectedSessionTypeForm(
  form: SessionTypeFormState,
  result: { reason?: string; result?: unknown }
): SessionTypeFormState {
  const payload = readRecord(result.result);
  const errorKind = readString(payload.error_kind);
  const message = result.reason ?? "Botster could not save this session type.";
  return {
    ...form,
    submitting: false,
    error: errorKind ? `${errorKind}: ${message}` : message
  };
}

/**
 * Structural emptiness only. Token shape, namespacing, uniqueness, and path rules are
 * Hub's authority and must not be re-implemented here.
 */
export function sessionTypeFormIsStructurallyComplete(form: SessionTypeFormState): boolean {
  return Boolean(
    form.id.trim() &&
    form.label.trim() &&
    form.role.trim() &&
    form.interaction.trim() &&
    form.lifecycle.trim() &&
    form.command.trim() &&
    (form.source !== "repo" || form.sourceTargetId.trim())
  );
}

/**
 * Groups by the Hub-provided source token. Sources are sorted by name only -- Hub already
 * resolved precedence, so display order must not imply it.
 */
export function groupSessionTypesBySource(
  sessionTypes: Record<string, unknown>[]
): { source: string; rows: Record<string, unknown>[] }[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const sessionType of sessionTypes) {
    const source = stringValue(sessionType.source, "");
    const rows = groups.get(source);
    if (rows) {
      rows.push(sessionType);
    } else {
      groups.set(source, [sessionType]);
    }
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, rows]) => ({ source, rows }));
}

/**
 * Operator-facing group heading for a Hub source token. Does not rewrite row fields —
 * only the section title. Unknown tokens stay verbatim.
 *
 * Wire token `device` is hub-wide storage on this hub, not a separate machine from the hub.
 */
export function sessionTypeSourceGroupLabel(source: string): string {
  switch (source) {
    case "device":
      return "Global";
    case "repo":
      return "Spawn points";
    case "package":
      return "Packages";
    default:
      return source;
  }
}
