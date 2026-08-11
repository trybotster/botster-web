/** Workbench toast notifications. */

import { IonToast } from "@ionic/react";

export interface WorkbenchNotificationsProps {
  toast?: { message: string; color: string };
  onDismiss: () => void;
}

export function WorkbenchNotifications({ toast, onDismiss }: WorkbenchNotificationsProps) {
  return (
    <IonToast
      isOpen={Boolean(toast)}
      message={toast?.message}
      color={toast?.color}
      duration={5000}
      position="bottom"
      onDidDismiss={onDismiss}
    />
  );
}
