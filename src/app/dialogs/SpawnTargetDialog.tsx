/** Spawn-point create/edit modal and delete confirmation. */

import {
  IonAlert,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import type { Dispatch, SetStateAction } from "react";

import { spawnTargetIdFromLabel, type SpawnTargetFormState } from "../spawnTargets";
import { stringValue } from "../values";

export interface SpawnTargetDialogProps {
  form: SpawnTargetFormState | undefined;
  setForm: Dispatch<SetStateAction<SpawnTargetFormState | undefined>>;
  deleteSpawnTarget: Record<string, unknown> | undefined;
  setDeleteSpawnTarget: Dispatch<SetStateAction<Record<string, unknown> | undefined>>;
  onSubmit: () => void;
  onConfirmDelete: () => void;
}

export function SpawnTargetDialog({
  form,
  setForm,
  deleteSpawnTarget,
  setDeleteSpawnTarget,
  onSubmit,
  onConfirmDelete
}: SpawnTargetDialogProps) {
  return (
    <>
      <IonModal isOpen={Boolean(form)} onDidDismiss={() => setForm(undefined)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{form?.mode === "edit" ? "Edit spawn point" : "Add spawn point"}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setForm(undefined)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {form ? (
            <div className="spawn-target-form">
              <IonList lines="full" aria-label="Spawn point form">
                <IonItem>
                  <IonInput
                    label="Spawn point name"
                    labelPlacement="stacked"
                    value={form.label}
                    placeholder="My project"
                    onIonInput={(event) => setForm((current) => current ? { ...current, label: String(event.detail.value ?? "") } : current)}
                  />
                </IonItem>
                <IonItem>
                  <IonInput
                    label="Folder"
                    labelPlacement="stacked"
                    value={form.root}
                    placeholder="/path/to/project"
                    onIonInput={(event) => setForm((current) => current ? { ...current, root: String(event.detail.value ?? "") } : current)}
                  />
                </IonItem>
                <IonItem>
                  <IonCheckbox
                    checked={form.enabled}
                    onIonChange={(event) => setForm((current) => current ? { ...current, enabled: event.detail.checked } : current)}
                  >
                    Enabled
                  </IonCheckbox>
                </IonItem>
              </IonList>
              <details className="advanced-spawn-target-options">
                <summary>Advanced options</summary>
                <IonList lines="full" aria-label="Advanced spawn point options">
                  <IonItem>
                    <IonInput
                      label="Identifier"
                      labelPlacement="stacked"
                      value={form.targetId}
                      disabled={form.mode === "edit"}
                      placeholder={spawnTargetIdFromLabel(form.label) || "my-project"}
                      onIonInput={(event) => setForm((current) => current ? { ...current, targetId: String(event.detail.value ?? "") } : current)}
                    />
                  </IonItem>
                  <IonItem>
                    <IonTextarea
                      label="Metadata"
                      labelPlacement="stacked"
                      value={form.metadata}
                      autoGrow
                      placeholder={"owner=platform\npurpose=agents"}
                      onIonInput={(event) => setForm((current) => current ? { ...current, metadata: String(event.detail.value ?? "") } : current)}
                    />
                  </IonItem>
                </IonList>
              </details>
              <div className="modal-actions">
                <IonButton
                  disabled={!form.label.trim() || !form.root.trim() || (form.mode === "edit" ? !form.originalTargetId : false)}
                  onClick={onSubmit}
                >
                  {form.mode === "edit" ? "Save" : "Create"}
                </IonButton>
              </div>
            </div>
          ) : null}
        </IonContent>
      </IonModal>
      <IonAlert
        isOpen={Boolean(deleteSpawnTarget)}
        header="Delete spawn point"
        message={deleteSpawnTarget ? `Delete ${stringValue(deleteSpawnTarget.label, String(deleteSpawnTarget.id))}?` : undefined}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => setDeleteSpawnTarget(undefined)
          },
          {
            text: "Delete",
            role: "destructive",
            handler: onConfirmDelete
          }
        ]}
        onDidDismiss={() => setDeleteSpawnTarget(undefined)}
      />
    </>
  );
}
