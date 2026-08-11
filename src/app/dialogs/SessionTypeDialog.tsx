/** Session-type authoring modal and delete confirmation. */

import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import type { Dispatch, SetStateAction } from "react";

import type { EntityRecord } from "../../botster/entities";
import {
  applySessionTypeHomeKind,
  applySessionTypeName,
  applySessionTypePreset,
  enabledSpawnPointSessionTypeSources,
  SESSION_TYPE_PRESETS,
  SESSION_TYPE_SOURCE_GLOBAL_LABEL,
  sessionTypeFormHasAdvancedValues,
  sessionTypeFormIsStructurallyComplete,
  sessionTypeSemanticsSummary,
  type SessionTypeFormState,
  type SessionTypePresetId
} from "../sessionTypes";
import {
  SessionTypeAdvancedOptions,
  SessionTypeExecutionControl,
  SessionTypeSubmitButton
} from "../sessionTypeUi";
import { stringValue } from "../values";

export interface SessionTypeDialogProps {
  form: SessionTypeFormState | undefined;
  setForm: Dispatch<SetStateAction<SessionTypeFormState | undefined>>;
  deleteSessionType: Record<string, unknown> | undefined;
  setDeleteSessionType: Dispatch<SetStateAction<Record<string, unknown> | undefined>>;
  spawnTargets: EntityRecord[];
  onSubmit: () => void;
  onConfirmDelete: () => void;
}

export function SessionTypeDialog({
  form,
  setForm,
  deleteSessionType,
  setDeleteSessionType,
  spawnTargets,
  onSubmit,
  onConfirmDelete
}: SessionTypeDialogProps) {
  const sessionTypeSpawnPoints = enabledSpawnPointSessionTypeSources(spawnTargets);

  return (
    <>
      <IonModal isOpen={Boolean(form)} onDidDismiss={() => setForm(undefined)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{form?.mode === "edit" ? "Edit session type" : "Add session type"}</IonTitle>
            <IonButtons slot="end">
              <IonButton disabled={form?.submitting} onClick={() => setForm(undefined)}>
                Close
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {form ? (
            <div className="session-type-form" data-testid="session-type-form">
              <div className="session-type-form-intro">
                <p>
                  Name it and point at a launch script. Like monorepo agents: claude, codex,
                  rails-server — not a full protocol form.
                </p>
              </div>
              <IonList lines="full" aria-label="Session type form">
                <IonItem>
                  <IonSelect
                    label="Where it lives"
                    labelPlacement="stacked"
                    value={form.source === "repo" ? "repo" : "device"}
                    data-testid="session-type-source"
                    disabled={form.mode === "edit"}
                    interface="popover"
                    onIonChange={(event) => {
                      const kind = String(event.detail.value ?? "device") === "repo" ? "repo" : "device";
                      setForm((current) => current
                        ? applySessionTypeHomeKind(current, kind, sessionTypeSpawnPoints)
                        : current);
                    }}
                  >
                    <IonSelectOption value="device">{SESSION_TYPE_SOURCE_GLOBAL_LABEL}</IonSelectOption>
                    <IonSelectOption value="repo" disabled={sessionTypeSpawnPoints.length === 0}>
                      Spawn point
                    </IonSelectOption>
                  </IonSelect>
                  <IonNote slot="helper" color="medium" data-testid="session-type-source-note">
                    {sessionTypeSpawnPoints.length === 0
                      ? "Global only until you add a spawn point under Hub settings."
                      : "Global is available at every spawn point. Spawn point limits the type to one path."}
                  </IonNote>
                </IonItem>
                {form.source === "repo" ? (
                  <IonItem>
                    <IonSelect
                      label="Spawn point"
                      labelPlacement="stacked"
                      value={form.sourceTargetId}
                      placeholder="Choose a spawn point"
                      data-testid="session-type-spawn-point"
                      disabled={form.mode === "edit"}
                      interface="popover"
                      onIonChange={(event) => setForm((current) => current
                        ? { ...current, sourceTargetId: String(event.detail.value ?? "") }
                        : current)}
                    >
                      {sessionTypeSpawnPoints.map((point) => (
                        <IonSelectOption key={point.targetId} value={point.targetId}>
                          {point.label}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <IonNote slot="helper" color="medium">
                      Definition is stored for this admitted path only.
                    </IonNote>
                  </IonItem>
                ) : null}
                <IonItem>
                  <IonInput
                    label="Name"
                    labelPlacement="stacked"
                    value={form.label}
                    placeholder="claude"
                    data-testid="session-type-name"
                    onIonInput={(event) => setForm((current) => current
                      ? applySessionTypeName(current, String(event.detail.value ?? ""))
                      : current)}
                  />
                  <IonNote slot="helper" color="medium" data-testid="session-type-name-note">
                    Product name (claude, codex, rails-server). Sets the Hub id from this name.
                  </IonNote>
                </IonItem>
                <SessionTypeExecutionControl
                  mode={form.executionMode}
                  onChange={(executionMode) => setForm((current) => current
                    ? { ...current, executionMode }
                    : current)}
                />
                <IonItem>
                  <IonInput
                    label="Command"
                    labelPlacement="stacked"
                    value={form.command}
                    placeholder="bin/init.sh"
                    data-testid="session-type-command"
                    onIonInput={(event) => setForm((current) => current ? { ...current, command: String(event.detail.value ?? "") } : current)}
                  />
                  <IonNote slot="helper" color="medium" data-testid="session-type-command-note">
                    {form.executionMode === "shell_command"
                      ? "Shell command text. Hub does not derive arguments from this text."
                      : "Relative path under the source root. Not a PATH binary name."}
                  </IonNote>
                </IonItem>
                <IonItem>
                  <IonSelect
                    label="Kind"
                    labelPlacement="stacked"
                    value={form.preset}
                    data-testid="session-type-preset"
                    interface="popover"
                    onIonChange={(event) => {
                      const selected = String(event.detail.value ?? "custom") as SessionTypePresetId;
                      setForm((current) => current
                        ? applySessionTypePreset(current, selected)
                        : current);
                    }}
                  >
                    <IonSelectOption value="agent">{SESSION_TYPE_PRESETS.agent.label}</IonSelectOption>
                    <IonSelectOption value="shell">{SESSION_TYPE_PRESETS.shell.label}</IonSelectOption>
                    <IonSelectOption value="custom">Custom</IonSelectOption>
                  </IonSelect>
                  <IonNote slot="helper" color="medium" data-testid="session-type-preset-note">
                    {form.preset === "custom"
                      ? "Edit role and related fields under Advanced."
                      : `${SESSION_TYPE_PRESETS[form.preset].description}.`}
                  </IonNote>
                </IonItem>
                {sessionTypeSemanticsSummary(form) ? (
                  <IonItem lines="none" className="session-type-semantics-item">
                    <IonNote
                      color="medium"
                      data-testid="session-type-semantics-summary"
                      className="session-type-semantics-summary"
                    >
                      {sessionTypeSemanticsSummary(form)}
                    </IonNote>
                  </IonItem>
                ) : null}
              </IonList>
              <SessionTypeAdvancedOptions
                key={`${form.mode}:${form.sessionTypeId ?? "new"}:${form.preset}`}
                form={form}
                initiallyOpen={
                  form.preset === "custom" ||
                  form.mode === "edit" ||
                  sessionTypeFormHasAdvancedValues(form)
                }
                onChange={setForm}
              />
              {form.error ? (
                <IonNote color="danger" data-testid="session-type-form-error">{form.error}</IonNote>
              ) : null}
              <div className="modal-actions">
                <SessionTypeSubmitButton
                  mode={form.mode}
                  disabled={!sessionTypeFormIsStructurallyComplete(form) || form.submitting}
                  submitting={Boolean(form.submitting)}
                  onClick={onSubmit}
                />
              </div>
            </div>
          ) : null}
        </IonContent>
      </IonModal>
      <IonAlert
        isOpen={Boolean(deleteSessionType)}
        header="Delete session type"
        message={`Delete ${stringValue(deleteSessionType?.label, "")}?`}
        onDidDismiss={() => setDeleteSessionType(undefined)}
        buttons={[
          { text: "Cancel", role: "cancel" },
          { text: "Delete", role: "destructive", handler: onConfirmDelete }
        ]}
      />
    </>
  );
}
