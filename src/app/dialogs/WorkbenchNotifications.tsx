/** Workbench toast notifications. */

import { IonToast } from "@ionic/react";

export interface WorkbenchNotificationsProps {
  toast?: { message: string; color: string };
  onDismiss: () => void;
  packageEventToast?: { message: string; color?: string };
  packageEventDurationMs?: number;
  onPackageEventDismiss?: () => void;
}

export function WorkbenchNotifications({
  toast,
  onDismiss,
  packageEventToast,
  packageEventDurationMs = 5000,
  onPackageEventDismiss
}: WorkbenchNotificationsProps) {
  return (
    <>
      <IonToast
        isOpen={Boolean(toast)}
        message={toast?.message}
        color={toast?.color}
        duration={5000}
        position="bottom"
        onDidDismiss={onDismiss}
      />
      <IonToast
        isOpen={Boolean(packageEventToast)}
        message={packageEventToast?.message}
        color={packageEventToast?.color}
        duration={packageEventDurationMs}
        position="top"
        data-testid="package-event-notice"
        onDidDismiss={onPackageEventDismiss}
      />
    </>
  );
}
