/** Spawn-point list item. */

import { IonBadge, IonButton, IonButtons, IonIcon, IonItem, IonLabel } from "@ionic/react";
import { playOutline } from "ionicons/icons";

import { stringValue } from "./values";

export function SpawnTargetListItem({
  target,
  onSpawn,
  onEdit,
  onDelete
}: {
  target: Record<string, unknown>;
  onSpawn: (target: Record<string, unknown>) => void;
  onEdit: (target: Record<string, unknown>) => void;
  onDelete: (target: Record<string, unknown>) => void;
}) {
  const targetId = stringValue(target.target_id, String(target.id));
  const label = stringValue(target.label, stringValue(target.title, targetId));
  const root = stringValue(target.root, "");
  const kind = stringValue(target.kind, "directory");
  const enabled = target.enabled !== false;

  return (
    <IonItem className="spawn-target-item">
      <IonLabel>
        <h2>{label}</h2>
        <p>{root}</p>
        <p className="spawn-target-technical-detail">{targetId} · {kind}</p>
      </IonLabel>
      <IonBadge color={enabled ? "success" : "medium"} slot="end">
        {enabled ? "Enabled" : "Disabled"}
      </IonBadge>
      <IonButtons slot="end">
        <IonButton
          aria-label={`New session at ${label}`}
          fill="outline"
          disabled={!enabled}
          onClick={() => onSpawn(target)}
        >
          <IonIcon icon={playOutline} slot="start" aria-hidden="true" />
          New session
        </IonButton>
        <IonButton aria-label={`Edit ${label}`} onClick={() => onEdit(target)}>
          Edit
        </IonButton>
        <IonButton aria-label={`Delete ${label}`} color="danger" onClick={() => onDelete(target)}>
          Delete
        </IonButton>
      </IonButtons>
    </IonItem>
  );
}
