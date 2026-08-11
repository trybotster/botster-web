/** Session type management and authoring UI. */

import {
  IonBadge,
  IonButton,
  IonButtons,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea
} from "@ionic/react";
import { useState, type ReactNode } from "react";

import type { EntitySubscriptionErrorPayload } from "../botster/protocol";
import {
  inferSessionTypePreset,
  type SessionTypeExecutionMode,
  type SessionTypeFormState,
  workingDirectoryPolicyLabel,
  workingDirectoryPolicyOptions,
  workingDirectoryPolicySelectValue
} from "./sessionTypes";
import { readRecord, stringValue } from "./values";

export function SessionTypesSurfaceNotices({
  supported,
  subscriptionError,
  onCreate
}: {
  supported: boolean;
  subscriptionError: EntitySubscriptionErrorPayload | undefined;
  onCreate: () => void;
}) {
  return (
    <>
      {supported ? (
        <div className="modal-actions">
          <IonButton size="small" onClick={onCreate} data-testid="create-session-type">
            Add session type
          </IonButton>
        </div>
      ) : (
        <IonNote color="warning" data-testid="session-types-unsupported">
          This hub does not provide session_type_entity_subscriptions.
        </IonNote>
      )}
      {subscriptionError ? (
        <IonNote color="danger" data-testid="session-types-subscription-error">
          {subscriptionError.code}: {subscriptionError.message}
        </IonNote>
      ) : null}
    </>
  );
}

/**
 * Empty session-types panel. Create stays surface-local (no second CTA path) when supported.
 */
export function SessionTypesEmptyState({
  supported,
  onCreate
}: {
  supported: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="home-empty-state" data-testid="session-types-empty">
      <h3>No session types yet</h3>
      <p>
        {supported
          ? "Add a session type to define how sessions start at each spawn point."
          : "This hub does not publish session types for management."}
      </p>
      {supported ? (
        <IonButton fill="outline" size="small" onClick={onCreate} data-testid="session-types-empty-create">
          Add session type
        </IonButton>
      ) : null}
    </div>
  );
}

/**
 * Spawn modal empty types notice with a path to Hub session-type authoring.
 */
export function SpawnSessionTypesEmptyNotice({
  loading,
  onManageSessionTypes
}: {
  loading: boolean;
  onManageSessionTypes: () => void;
}) {
  if (loading) {
    return (
      <IonNote color="medium" data-testid="spawn-session-types-loading">
        Loading session types…
      </IonNote>
    );
  }
  return (
    <div className="home-empty-state" data-testid="spawn-session-types-empty">
      <h3>No session types for this spawn point</h3>
      <p>Add a session type in Hub settings, or choose another spawn point.</p>
      <IonButton fill="outline" size="small" onClick={onManageSessionTypes}>
        Manage session types
      </IonButton>
    </div>
  );
}

export function SessionTypeListItem({
  sessionType,
  onEdit,
  onDelete
}: {
  sessionType: Record<string, unknown>;
  onEdit: (sessionType: Record<string, unknown>) => void;
  onDelete: (sessionType: Record<string, unknown>) => void;
}) {
  const sessionTypeId = String(sessionType.id);
  const label = stringValue(sessionType.label, "");
  const description = stringValue(sessionType.description, "");
  const editable = sessionType.editable === true;
  const available = sessionType.available !== false;
  const traits = Array.isArray(sessionType.traits) ? sessionType.traits : [];
  const overriddenSources = Array.isArray(sessionType.overridden_sources) ? sessionType.overridden_sources : [];
  const diagnostics = Array.isArray(sessionType.diagnostics) ? sessionType.diagnostics : [];

  return (
    <IonItem className="session-type-item" data-testid={`session-type-${sessionTypeId}`}>
      <IonLabel>
        <h2>{label}</h2>
        {description ? <p>{description}</p> : null}
        <p data-testid={`session-type-semantics-${sessionTypeId}`}>
          {stringValue(sessionType.role, "")} · {stringValue(sessionType.interaction, "")} · {stringValue(sessionType.lifecycle, "")}
        </p>
        {traits.length > 0 ? (
          <p data-testid={`session-type-traits-${sessionTypeId}`}>
            {traits.map((trait) => String(trait)).join(", ")}
          </p>
        ) : null}
        <p data-testid={`session-type-provenance-${sessionTypeId}`}>
          {stringValue(sessionType.source, "")} · {stringValue(sessionType.source_name, "")} · {stringValue(sessionType.target_id, "")}
        </p>
        <p className="session-type-technical-detail">{stringValue(sessionType.command, "")}</p>
        {overriddenSources.length > 0 ? (
          <p data-testid={`session-type-overrides-${sessionTypeId}`}>
            Overrides {overriddenSources
              .map((entry) => {
                const source = readRecord(entry);
                return `${stringValue(source.kind, "")}:${stringValue(source.name, "")}`;
              })
              .join(", ")}
          </p>
        ) : null}
        {diagnostics.map((diagnostic, index) => (
          <p key={index} data-testid={`session-type-diagnostic-${sessionTypeId}`}>
            {String(diagnostic)}
          </p>
        ))}
      </IonLabel>
      <IonBadge color={available ? "success" : "medium"} slot="end">
        {available ? "Available" : "Unavailable"}
      </IonBadge>
      {editable ? (
        <IonButtons slot="end">
          <IonButton
            aria-label={`Edit ${label}`}
            fill="outline"
            onClick={() => onEdit(sessionType)}
            data-testid={`edit-session-type-${sessionTypeId}`}
          >
            Edit
          </IonButton>
          <IonButton
            aria-label={`Delete ${label}`}
            fill="outline"
            color="danger"
            onClick={() => onDelete(sessionType)}
            data-testid={`delete-session-type-${sessionTypeId}`}
          >
            Delete
          </IonButton>
        </IonButtons>
      ) : (
        <IonBadge color="medium" slot="end" data-testid={`session-type-read-only-${sessionTypeId}`}>
          Read-only
        </IonBadge>
      )}
    </IonItem>
  );
}

export function SessionTypesView({
  sessionTypeCount,
  children
}: {
  sessionTypeCount: number;
  children?: ReactNode;
}) {
  return (
    <section
      className="view-stack hub-settings-panel"
      aria-labelledby="session-types-heading"
      data-testid="session-types-view"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sessions</p>
          <h2 id="session-types-heading">Session types</h2>
          <p className="page-description">Available ways to start a session at each spawn point.</p>
        </div>
        <IonBadge color="medium">{sessionTypeCount}</IonBadge>
      </div>
      {children}
    </section>
  );
}

/**
 * Session-type form submit control — single production button for create and edit.
 * Export-for-contract for harness testid; pending "Saving…" is asserted via render.
 */
export function SessionTypeSubmitButton({
  mode,
  disabled,
  submitting,
  onClick
}: {
  mode: "create" | "edit";
  disabled: boolean;
  submitting: boolean;
  onClick: () => void;
}) {
  return (
    <IonButton
      disabled={disabled}
      onClick={onClick}
      data-testid="submit-session-type"
    >
      {submitting ? "Saving…" : mode === "edit" ? "Save" : "Create"}
    </IonButton>
  );
}

export function SessionTypeExecutionControl({
  mode,
  onChange
}: {
  mode: SessionTypeExecutionMode;
  onChange: (mode: SessionTypeExecutionMode) => void;
}) {
  return (
    <IonItem>
      <IonSelect
        label="Execution"
        labelPlacement="stacked"
        value={mode}
        data-testid="session-type-execution"
        interface="popover"
        onIonChange={(event) => onChange(
          String(event.detail.value ?? "relative_executable") === "shell_command"
            ? "shell_command"
            : "relative_executable"
        )}
      >
        <IonSelectOption value="relative_executable">Relative executable</IonSelectOption>
        <IonSelectOption value="shell_command">Shell command</IonSelectOption>
      </IonSelect>
      <IonNote slot="helper" color="medium" data-testid="session-type-execution-note">
        {mode === "shell_command"
          ? "Run Command through the platform shell. Arguments stay separate."
          : "Run Command as an executable path relative to the source root. Arguments stay separate."}
      </IonNote>
    </IonItem>
  );
}

/**
 * Secondary fields. Create keeps this closed for Agent/Shell name+command.
 * Opens for Custom, edit (Role still reachable), or when advanced values exist.
 */
export function SessionTypeAdvancedOptions({
  form,
  initiallyOpen,
  onChange
}: {
  form: SessionTypeFormState;
  initiallyOpen: boolean;
  onChange: (updater: (current: SessionTypeFormState | undefined) => SessionTypeFormState | undefined) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  const policyOptions = workingDirectoryPolicyOptions(form.workingDirectoryPolicy);

  return (
    <details
      className="advanced-session-type-options"
      open={open}
      data-testid="session-type-advanced"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>Advanced options</summary>
      <p className="session-type-advanced-lead">
        Optional Hub fields. Most monorepo types only need Name and Command.
      </p>
      <IonList lines="full" aria-label="Advanced session type options">
        <IonItem>
          <IonInput
            label="Identifier"
            labelPlacement="stacked"
            value={form.id}
            placeholder="claude"
            disabled={form.mode === "edit"}
            data-testid="session-type-id"
            onIonInput={(event) => onChange((current) => {
              if (!current || current.mode === "edit") return current;
              return {
                ...current,
                id: String(event.detail.value ?? ""),
                idLocked: true
              };
            })}
          />
          <IonNote slot="helper" color="medium">
            Bare Hub id. Derived from Name unless you set it here.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Description"
            labelPlacement="stacked"
            value={form.description}
            onIonInput={(event) => onChange((current) => current
              ? { ...current, description: String(event.detail.value ?? "") }
              : current)}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label="Arguments"
            labelPlacement="stacked"
            value={form.args}
            placeholder="--flag value"
            onIonInput={(event) => onChange((current) => current
              ? { ...current, args: String(event.detail.value ?? "") }
              : current)}
          />
          <IonNote slot="helper" color="medium">
            Argv tokens, split on spaces or commas.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Role"
            labelPlacement="stacked"
            value={form.role}
            placeholder="botster.agent"
            data-testid="session-type-role"
            onIonInput={(event) => onChange((current) => {
              if (!current) return current;
              const role = String(event.detail.value ?? "");
              return {
                ...current,
                role,
                preset: inferSessionTypePreset({
                  role,
                  interaction: current.interaction,
                  lifecycle: current.lifecycle,
                  traits: current.traits
                })
              };
            })}
          />
          <IonNote slot="helper" color="medium">
            Namespaced token (must contain a dot), for example botster.agent.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Interaction"
            labelPlacement="stacked"
            value={form.interaction}
            placeholder="interactive"
            data-testid="session-type-interaction"
            onIonInput={(event) => onChange((current) => {
              if (!current) return current;
              const interaction = String(event.detail.value ?? "");
              return {
                ...current,
                interaction,
                preset: inferSessionTypePreset({
                  role: current.role,
                  interaction,
                  lifecycle: current.lifecycle,
                  traits: current.traits
                })
              };
            })}
          />
          <IonNote slot="helper" color="medium">
            How the session interacts (for example interactive or service). Not an enum; Hub checks shape.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Lifecycle"
            labelPlacement="stacked"
            value={form.lifecycle}
            placeholder="task"
            data-testid="session-type-lifecycle"
            onIonInput={(event) => onChange((current) => {
              if (!current) return current;
              const lifecycle = String(event.detail.value ?? "");
              return {
                ...current,
                lifecycle,
                preset: inferSessionTypePreset({
                  role: current.role,
                  interaction: current.interaction,
                  lifecycle,
                  traits: current.traits
                })
              };
            })}
          />
          <IonNote slot="helper" color="medium">
            How long the session is expected to live (for example task or persistent).
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Traits"
            labelPlacement="stacked"
            value={form.traits}
            placeholder="terminal, companion"
            data-testid="session-type-traits"
            onIonInput={(event) => onChange((current) => {
              if (!current) return current;
              const traits = String(event.detail.value ?? "");
              return {
                ...current,
                traits,
                seededTraits: undefined,
                preset: inferSessionTypePreset({
                  role: current.role,
                  interaction: current.interaction,
                  lifecycle: current.lifecycle,
                  traits
                })
              };
            })}
          />
          <IonNote slot="helper" color="medium">
            Unique tokens (for example terminal). Space- or comma-separated.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonSelect
            label="Working directory"
            labelPlacement="stacked"
            value={workingDirectoryPolicySelectValue(form.workingDirectoryPolicy)}
            interface="popover"
            data-testid="session-type-working-directory-policy"
            onIonChange={(event) => onChange((current) => current
              ? { ...current, workingDirectoryPolicy: String(event.detail.value ?? "package_root") }
              : current)}
          >
            {policyOptions.map((policy) => (
              <IonSelectOption key={policy} value={policy}>
                {workingDirectoryPolicyLabel(policy)}
              </IonSelectOption>
            ))}
          </IonSelect>
          <IonNote slot="helper" color="medium">
            Process cwd relative to this definition’s source root. Hub default is source root
            (wire policy package_root).
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Working directory path"
            labelPlacement="stacked"
            value={form.workingDirectoryPath}
            placeholder="relative/subdir"
            data-testid="session-type-working-directory-path"
            disabled={workingDirectoryPolicySelectValue(form.workingDirectoryPolicy) !== "relative"}
            onIonInput={(event) => onChange((current) => current
              ? { ...current, workingDirectoryPath: String(event.detail.value ?? "") }
              : current)}
          />
          {workingDirectoryPolicySelectValue(form.workingDirectoryPolicy) === "relative" ? (
            <IonNote slot="helper" color="medium">
              Relative path under the source root. Required when Working directory is relative.
            </IonNote>
          ) : (
            <IonNote slot="helper" color="medium">
              Used only when Working directory is relative.
            </IonNote>
          )}
        </IonItem>
        <IonItem>
          <IonTextarea
            label="Environment"
            labelPlacement="stacked"
            value={form.environment}
            autoGrow
            placeholder={"KEY=value"}
            onIonInput={(event) => onChange((current) => current
              ? { ...current, environment: String(event.detail.value ?? "") }
              : current)}
          />
          <IonNote slot="helper" color="medium">
            Fixed KEY=value lines for the process. Names must be valid environment variable names.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Allowed environment overrides"
            labelPlacement="stacked"
            value={form.allowedEnvironmentOverrides}
            onIonInput={(event) => onChange((current) => current
              ? { ...current, allowedEnvironmentOverrides: String(event.detail.value ?? "") }
              : current)}
          />
          <IonNote slot="helper" color="medium">
            Env names a spawn request may override. Other overrides are rejected by Hub.
          </IonNote>
        </IonItem>
        <IonItem>
          <IonInput
            label="Context keys"
            labelPlacement="stacked"
            value={form.contextKeys}
            placeholder="prompt"
            onIonInput={(event) => onChange((current) => current
              ? { ...current, contextKeys: String(event.detail.value ?? "") }
              : current)}
          />
          <IonNote slot="helper" color="medium">
            Context fields this type may consume at spawn (for example prompt). Space- or comma-separated.
          </IonNote>
        </IonItem>
      </IonList>
    </details>
  );
}
