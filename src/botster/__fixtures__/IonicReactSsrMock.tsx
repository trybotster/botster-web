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
export const IonButton = tag("ion-button");
export const IonCheckbox = tag("ion-checkbox");
export const IonInput = tag("ion-input");
export const IonItem = tag("ion-item");
export const IonLabel = tag("ion-label");
export const IonList = tag("ion-list");
export const IonNote = tag("ion-note");
export const IonSelect = tag("ion-select");
export const IonSelectOption = tag("ion-select-option");
export const IonTextarea = tag("ion-textarea");
