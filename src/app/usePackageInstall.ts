/** Add-package marketplace registry and local install control. */

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { ActionBinding } from "../botster/actions";
import type { createBotsterWebClient } from "../botster/client";
import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import type { HubEntityLoadKey } from "./hubLifecycle";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function usePackageInstall(options: {
  runtimeClient: RuntimeClient;
  dispatchAction: (action: ActionBinding) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setEntityLoadStatus: Dispatch<SetStateAction<Record<HubEntityLoadKey, HubEntityLoadStatus>>>;
}) {
  const { runtimeClient, dispatchAction, updateLocalState, setEntityLoadStatus } = options;
  const [marketplaceRegistryPath, setMarketplaceRegistryPath] = useState("");
  const [localPackagePath, setLocalPackagePath] = useState("");
  const [addPackageOpen, setAddPackageOpen] = useState(false);

  const loadMarketplaceRegistry = useCallback(() => {
    const registryPath = marketplaceRegistryPath.trim();
    if (!registryPath) return;

    setEntityLoadStatus((current) => ({ ...current, availablePackage: "loading" }));
    void runtimeClient.entities
      .pull({ family: "botster-web.available_package", registry_path: registryPath })
      .then(() => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "loaded" }));
        updateLocalState({ "production.diagnostic_action_status": `Loaded marketplace registry ${registryPath}` });
      })
      .catch((error: unknown) => {
        setEntityLoadStatus((current) => ({ ...current, availablePackage: "error" }));
        updateLocalState({
          "production.diagnostic_action_status": error instanceof Error ? error.message : "Marketplace registry load failed"
        });
      });
  }, [marketplaceRegistryPath, runtimeClient, setEntityLoadStatus, updateLocalState]);

  const installLocalPackage = useCallback(() => {
    const packagePath = localPackagePath.trim();
    if (!packagePath) return;

    setAddPackageOpen(false);
    dispatchAction({
      id: "botster.package.daemon_request",
      target: packagePath,
      label: "Install local package",
      params: {
        daemon_request: {
          request_type: "install_package_local_path",
          path: packagePath
        }
      }
    });
  }, [dispatchAction, localPackagePath]);

  return {
    marketplaceRegistryPath,
    setMarketplaceRegistryPath,
    localPackagePath,
    setLocalPackagePath,
    addPackageOpen,
    setAddPackageOpen,
    loadMarketplaceRegistry,
    installLocalPackage
  };
}

export type PackageInstallControl = ReturnType<typeof usePackageInstall>;
