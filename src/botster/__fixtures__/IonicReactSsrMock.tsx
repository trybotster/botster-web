import { createElement, type ReactNode } from "react";

type IonicTestProps = Record<string, unknown> & {
  children?: ReactNode;
};

function tag(name: string) {
  return function IonicTestComponent({ children, ...props }: IonicTestProps) {
    return createElement(name, props, children);
  };
}

export const IonBadge = tag("ion-badge");
export const IonAlert = tag("ion-alert");
export const IonApp = tag("ion-app");
export const IonButton = tag("ion-button");
export const IonButtons = tag("ion-buttons");
export const IonCard = tag("ion-card");
export const IonCardContent = tag("ion-card-content");
export const IonCardHeader = tag("ion-card-header");
export const IonCardSubtitle = tag("ion-card-subtitle");
export const IonCardTitle = tag("ion-card-title");
export const IonCheckbox = tag("ion-checkbox");
export const IonChip = tag("ion-chip");
export const IonCol = tag("ion-col");
export const IonContent = tag("ion-content");
export const IonGrid = tag("ion-grid");
export const IonHeader = tag("ion-header");
export const IonIcon = tag("ion-icon");
export const IonInput = tag("ion-input");
export const IonItem = tag("ion-item");
export const IonLabel = tag("ion-label");
export const IonList = tag("ion-list");
export const IonListHeader = tag("ion-list-header");
export const IonMenu = tag("ion-menu");
export const IonMenuButton = tag("ion-menu-button");
export const IonMenuToggle = tag("ion-menu-toggle");
export const IonModal = tag("ion-modal");
export const IonNote = tag("ion-note");
export const IonPage = tag("ion-page");
export const IonPopover = tag("ion-popover");
export const IonRow = tag("ion-row");
export const IonSelect = tag("ion-select");
export const IonSelectOption = tag("ion-select-option");
export const IonSplitPane = tag("ion-split-pane");
export const IonTextarea = tag("ion-textarea");
export const IonTitle = tag("ion-title");
export const IonToolbar = tag("ion-toolbar");

export function setupIonicReact() {
  return undefined;
}
