/** New-session picker modal for an admitted spawn point. */

import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import { playOutline } from "ionicons/icons";
import type { Dispatch, SetStateAction } from "react";

import type { SpawnSessionFormState } from "../spawnSession";
import { SpawnSessionTypesEmptyNotice } from "../sessionTypeUi";

export interface SpawnSessionDialogProps {
  form: SpawnSessionFormState | undefined;
  setForm: Dispatch<SetStateAction<SpawnSessionFormState | undefined>>;
  onSubmit: () => void;
  onManageSessionTypes: () => void;
}

export function SpawnSessionDialog({
  form,
  setForm,
  onSubmit,
  onManageSessionTypes
}: SpawnSessionDialogProps) {
  return (
    <IonModal isOpen={Boolean(form)} onDidDismiss={() => setForm(undefined)}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>New session</IonTitle>
          <IonButtons slot="end">
            <IonButton disabled={form?.submitting} onClick={() => setForm(undefined)}>
              Close
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {form ? (
          <div className="spawn-session-form">
            <div className="spawn-session-intro">
              <p className="eyebrow">Spawn point</p>
              <h2>{form.targetLabel}</h2>
              <p>Choose how this session should start. Botster will use the spawn point's folder and policy.</p>
            </div>
            {form.listStatus === "loading" ? (
              <SpawnSessionTypesEmptyNotice loading onManageSessionTypes={() => {}} />
            ) : form.listStatus === "error" ? (
              <IonNote color="danger" data-testid="spawn-session-types-error">
                {form.error ?? "Botster could not load session types for this spawn point."}
              </IonNote>
            ) : form.options.length === 0 ? (
              <SpawnSessionTypesEmptyNotice
                loading={false}
                onManageSessionTypes={onManageSessionTypes}
              />
            ) : (
              <IonList lines="full" aria-label="New session form">
                <IonItem>
                  <IonSelect
                    label="Session type"
                    labelPlacement="stacked"
                    value={form.sessionTypeId}
                    placeholder="Choose a session type"
                    disabled={form.submitting}
                    interface="popover"
                    onIonChange={(event) => setForm((current) => current ? {
                      ...current,
                      sessionTypeId: String(event.detail.value ?? ""),
                      error: undefined
                    } : current)}
                  >
                    {form.options.map((sessionType) => (
                      <IonSelectOption
                        key={sessionType.sessionTypeId}
                        value={sessionType.sessionTypeId}
                        disabled={!sessionType.available}
                      >
                        {sessionType.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonTextarea
                    label="Prompt (optional)"
                    labelPlacement="stacked"
                    value={form.prompt}
                    autoGrow
                    rows={4}
                    placeholder="What should this session work on?"
                    disabled={form.submitting}
                    onIonInput={(event) => setForm((current) => current ? {
                      ...current,
                      prompt: String(event.detail.value ?? ""),
                      error: undefined
                    } : current)}
                  />
                </IonItem>
              </IonList>
            )}
            {form.error && form.listStatus !== "error" ? (
              <IonNote color="danger">{form.error}</IonNote>
            ) : null}
            {form.listStatus === "ready" && form.options.length > 0 ? (
              <div className="modal-actions">
                <IonButton
                  disabled={!form.sessionTypeId || form.submitting}
                  onClick={onSubmit}
                >
                  <IonIcon icon={playOutline} slot="start" aria-hidden="true" />
                  {form.submitting ? "Starting…" : "Start session"}
                </IonButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </IonContent>
    </IonModal>
  );
}
