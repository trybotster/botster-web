import { IonButton, IonModal } from "@ionic/react";
import { useState, type ReactNode } from "react";

interface UiNodeDialogProps {
  children: ReactNode;
  fullscreen: boolean;
  nodeId?: string;
  onDismiss?: () => void;
  presentation: string;
  title: string;
}

export function UiNodeDialog({
  children,
  fullscreen,
  nodeId,
  onDismiss,
  presentation,
  title
}: UiNodeDialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <IonModal
      backdropDismiss
      canDismiss
      className={[
        "uinode-dialog",
        fullscreen ? "uinode-dialog-fullscreen" : "uinode-dialog-overlay",
        `presentation-${presentation || "auto"}`
      ].join(" ")}
      data-ui-node-id={nodeId}
      isOpen={open}
      onDidDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
    >
      <div className="uinode-dialog-sheet">
        <header className="uinode-dialog-header">
          {title ? <h2 className="uinode-dialog-title">{title}</h2> : <span />}
          <IonButton
            aria-label="Close dialog"
            className="uinode-dialog-close"
            fill="clear"
            onClick={() => setOpen(false)}
          >
            Close
          </IonButton>
        </header>
        <div className="uinode-dialog-body">{children}</div>
      </div>
    </IonModal>
  );
}
