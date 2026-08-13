/** Actions for one current Hub session. */

import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover
} from "@ionic/react";
import { ellipsisVertical, stopCircleOutline } from "ionicons/icons";
import { useState } from "react";

export function SessionActionsMenu({
  className,
  sessionId,
  sessionTitle,
  stopping,
  onStop
}: {
  className?: string;
  sessionId: string;
  sessionTitle: string;
  stopping: boolean;
  onStop: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const triggerId = `session-actions-${sessionId}`;

  return (
    <div
      className={["session-actions", className].filter(Boolean).join(" ")}
      slot="end"
      onClick={(event) => event.stopPropagation()}
    >
      <IonButton
        id={triggerId}
        fill="clear"
        color="medium"
        aria-label={`Session options for ${sessionTitle}`}
        aria-haspopup="menu"
        disabled={stopping}
        onClick={() => setMenuOpen(true)}
      >
        <IonIcon slot="icon-only" icon={ellipsisVertical} aria-hidden="true" />
      </IonButton>
      <IonPopover
        trigger={triggerId}
        isOpen={menuOpen}
        dismissOnSelect
        className="session-actions-popover"
        onDidDismiss={() => setMenuOpen(false)}
      >
        <IonContent>
          <IonList lines="none" aria-label={`Session options for ${sessionTitle}`}>
            <IonItem
              button
              detail={false}
              disabled={stopping}
              className="session-action-danger"
              onClick={() => setConfirmStopOpen(true)}
            >
              <IonIcon icon={stopCircleOutline} slot="start" aria-hidden="true" />
              <IonLabel>{stopping ? "Stopping…" : "Stop session"}</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonPopover>
      <IonAlert
        isOpen={confirmStopOpen}
        header="Stop session?"
        message={`Stop ${sessionTitle}? The session process will exit.`}
        onDidDismiss={() => setConfirmStopOpen(false)}
        buttons={[
          { text: "Cancel", role: "cancel" },
          { text: "Stop", role: "destructive", handler: onStop }
        ]}
      />
    </div>
  );
}
