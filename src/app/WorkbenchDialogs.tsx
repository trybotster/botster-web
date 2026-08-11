/** Host for workbench dialogs and notifications. */

import type { Dispatch, SetStateAction } from "react";

import type { EntityRecord } from "../botster/entities";
import { AddPackageDialog } from "./dialogs/AddPackageDialog";
import { SessionTypeDialog } from "./dialogs/SessionTypeDialog";
import { SpawnSessionDialog } from "./dialogs/SpawnSessionDialog";
import { SpawnTargetDialog } from "./dialogs/SpawnTargetDialog";
import { WorkbenchNotifications } from "./dialogs/WorkbenchNotifications";
import type { SessionTypeFormState } from "./sessionTypes";
import type { SpawnSessionFormState } from "./spawnSession";
import type { SpawnTargetFormState } from "./spawnTargets";

export interface WorkbenchDialogsProps {
  availablePackages: EntityRecord[];
  spawnTargets: EntityRecord[];
  addPackageOpen: boolean;
  setAddPackageOpen: (open: boolean) => void;
  marketplaceRegistryPath: string;
  setMarketplaceRegistryPath: (path: string) => void;
  localPackagePath: string;
  setLocalPackagePath: (path: string) => void;
  loadMarketplaceRegistry: () => void;
  installLocalPackage: () => void;
  openPackage: (app: Record<string, unknown>) => void;
  openPackageSettings: (app: Record<string, unknown>) => void;
  spawnTargetForm?: SpawnTargetFormState;
  setSpawnTargetForm: Dispatch<SetStateAction<SpawnTargetFormState | undefined>>;
  spawnSessionForm?: SpawnSessionFormState;
  setSpawnSessionForm: Dispatch<SetStateAction<SpawnSessionFormState | undefined>>;
  deleteSpawnTarget?: Record<string, unknown>;
  setDeleteSpawnTarget: Dispatch<SetStateAction<Record<string, unknown> | undefined>>;
  submitSpawnTargetForm: () => void;
  confirmDeleteSpawnTarget: () => void;
  submitSpawnSession: () => void;
  manageSessionTypesFromSpawn: () => void;
  sessionTypeForm?: SessionTypeFormState;
  setSessionTypeForm: Dispatch<SetStateAction<SessionTypeFormState | undefined>>;
  deleteSessionType?: Record<string, unknown>;
  setDeleteSessionType: Dispatch<SetStateAction<Record<string, unknown> | undefined>>;
  submitSessionTypeForm: () => void;
  confirmDeleteSessionType: () => void;
  packageActionToast?: { message: string; color: string };
  setPackageActionToast: (toast: { message: string; color: string } | undefined) => void;
}

export function WorkbenchDialogs(props: WorkbenchDialogsProps) {
  return (
    <>
      <AddPackageDialog
        isOpen={props.addPackageOpen}
        onClose={() => props.setAddPackageOpen(false)}
        availablePackages={props.availablePackages}
        marketplaceRegistryPath={props.marketplaceRegistryPath}
        setMarketplaceRegistryPath={props.setMarketplaceRegistryPath}
        localPackagePath={props.localPackagePath}
        setLocalPackagePath={props.setLocalPackagePath}
        loadMarketplaceRegistry={props.loadMarketplaceRegistry}
        installLocalPackage={props.installLocalPackage}
        openPackage={props.openPackage}
        openPackageSettings={props.openPackageSettings}
      />
      <SpawnSessionDialog
        form={props.spawnSessionForm}
        setForm={props.setSpawnSessionForm}
        onSubmit={props.submitSpawnSession}
        onManageSessionTypes={props.manageSessionTypesFromSpawn}
      />
      <SessionTypeDialog
        form={props.sessionTypeForm}
        setForm={props.setSessionTypeForm}
        deleteSessionType={props.deleteSessionType}
        setDeleteSessionType={props.setDeleteSessionType}
        spawnTargets={props.spawnTargets}
        onSubmit={props.submitSessionTypeForm}
        onConfirmDelete={props.confirmDeleteSessionType}
      />
      <SpawnTargetDialog
        form={props.spawnTargetForm}
        setForm={props.setSpawnTargetForm}
        deleteSpawnTarget={props.deleteSpawnTarget}
        setDeleteSpawnTarget={props.setDeleteSpawnTarget}
        onSubmit={props.submitSpawnTargetForm}
        onConfirmDelete={props.confirmDeleteSpawnTarget}
      />
      <WorkbenchNotifications
        toast={props.packageActionToast}
        onDismiss={() => props.setPackageActionToast(undefined)}
      />
    </>
  );
}
