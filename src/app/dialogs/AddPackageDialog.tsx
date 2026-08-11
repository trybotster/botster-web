/** Add-package marketplace and local install modal. */

import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonTitle,
  IonToolbar
} from "@ionic/react";
import { cubeOutline } from "ionicons/icons";

import type { EntityRecord } from "../../botster/entities";
import { PluginListItem } from "../apps";

export interface AddPackageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availablePackages: EntityRecord[];
  marketplaceRegistryPath: string;
  setMarketplaceRegistryPath: (path: string) => void;
  localPackagePath: string;
  setLocalPackagePath: (path: string) => void;
  loadMarketplaceRegistry: () => void;
  installLocalPackage: () => void;
  openPackage: (app: Record<string, unknown>) => void;
  openPackageSettings: (app: Record<string, unknown>) => void;
}

export function AddPackageDialog({
  isOpen,
  onClose,
  availablePackages,
  marketplaceRegistryPath,
  setMarketplaceRegistryPath,
  localPackagePath,
  setLocalPackagePath,
  loadMarketplaceRegistry,
  installLocalPackage,
  openPackage,
  openPackageSettings
}: AddPackageDialogProps) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Add package</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>Close</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="add-package-flow">
          {availablePackages.length > 0 ? (
            <IonList lines="full" aria-label="Marketplace packages">
              <IonListHeader>
                <IonLabel>Marketplace</IonLabel>
              </IonListHeader>
              {availablePackages.map((app) => (
                <PluginListItem
                  app={app}
                  key={app.id}
                  onOpen={openPackage}
                  onSettings={openPackageSettings}
                />
              ))}
            </IonList>
          ) : (
            <div className="marketplace-empty">
              <IonIcon icon={cubeOutline} aria-hidden="true" />
              <h2>No marketplace connected</h2>
              <p>Marketplace extensions will appear here when a source is configured.</p>
            </div>
          )}
          <details className="advanced-install-options">
            <summary>Install from local files</summary>
            <p>Developer option for installing an extension from this device.</p>
            <IonList lines="full" aria-label="Local installation options">
              <IonItem>
                <IonInput
                  label="Marketplace registry file"
                  labelPlacement="stacked"
                  value={marketplaceRegistryPath}
                  placeholder="/path/to/marketplace.json"
                  onIonInput={(event) => setMarketplaceRegistryPath(String(event.detail.value ?? ""))}
                />
                <IonButton slot="end" disabled={!marketplaceRegistryPath.trim()} onClick={loadMarketplaceRegistry}>
                  Load
                </IonButton>
              </IonItem>
              <IonItem>
                <IonInput
                  label="Extension folder"
                  labelPlacement="stacked"
                  value={localPackagePath}
                  placeholder="/path/to/extension"
                  onIonInput={(event) => setLocalPackagePath(String(event.detail.value ?? ""))}
                />
                <IonButton slot="end" disabled={!localPackagePath.trim()} onClick={installLocalPackage}>
                  Install
                </IonButton>
              </IonItem>
            </IonList>
          </details>
        </div>
      </IonContent>
    </IonModal>
  );
}
