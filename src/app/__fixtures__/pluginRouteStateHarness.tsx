/** Mount harness for production usePluginRouteState race tests. */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { HubEntityLoadStatus } from "../../botster/LocalHubFirstScreen";
import type { HubEntityLoadKey } from "../hubLifecycle";
import type { PluginRouteTarget } from "../pluginRouteState";
import type { SelectedPluginSurface } from "../pluginSurfaceState";
import { usePluginRouteState } from "../usePluginRouteState";

export interface PluginRouteStateHarnessProps {
  packages: Record<string, unknown>[];
  availablePackages?: Record<string, unknown>[];
  entityLoadStatus?: Partial<Record<HubEntityLoadKey, HubEntityLoadStatus>>;
  routePluginSurface?: PluginRouteTarget;
  routeSettingsPackageName?: string;
  routeSettingsSurfaceId?: string;
  runtimeClient: {
    actions: {
      dispatch: (request: { origin: string; action: { id: string; label?: string } }) => Promise<{
        accepted: boolean;
        reason?: string;
        result?: unknown;
      }>;
    };
  };
  /** Latest selected surface after each selection change. */
  onSelected: (selected: SelectedPluginSurface | undefined) => void;
  /** Optional local-state observer for status writes. */
  onLocalState?: (patch: Record<string, unknown>) => void;
}

const defaultLoadStatus: Record<HubEntityLoadKey, HubEntityLoadStatus> = {
  hubStatus: "loaded",
  app: "loaded",
  packageNavigation: "loaded",
  package: "loaded",
  availablePackage: "loaded",
  spawnTarget: "loaded",
  sessionType: "loaded",
  session: "loaded"
};

export function PluginRouteStateHarness({
  packages,
  availablePackages = [],
  entityLoadStatus,
  routePluginSurface,
  routeSettingsPackageName,
  routeSettingsSurfaceId,
  runtimeClient,
  onSelected,
  onLocalState
}: PluginRouteStateHarnessProps) {
  const [selectedPluginSurface, setSelectedPluginSurface] = useState<SelectedPluginSurface | undefined>();
  const loadStatus = { ...defaultLoadStatus, ...entityLoadStatus };

  usePluginRouteState({
    runtimeClient: runtimeClient as never,
    packages,
    availablePackages,
    entityLoadStatus: loadStatus,
    routePluginSurface,
    routeSettingsPackageName,
    routeSettingsSurfaceId,
    recordDiagnostic: () => undefined,
    updateLocalState: (patch) => {
      onLocalState?.(patch);
    },
    setSelectedPluginSurface: setSelectedPluginSurface as Dispatch<SetStateAction<SelectedPluginSurface | undefined>>
  });

  useEffect(() => {
    onSelected(selectedPluginSurface);
  }, [onSelected, selectedPluginSurface]);

  return null;
}
