/** Production Hub connect, entity hydration, and frame diagnostics wiring. */

import { useEffect, type Dispatch, type SetStateAction } from "react";

import { botsterWebCapabilities } from "../botster/capabilities";
import {
  compatibilityDiagnosticsFromFrame,
  connectionFailureDiagnostic,
  hubConnectionDiagnosticFromFrame,
  hubStatusFamily,
  operatorErrorDiagnostic,
  schemaVersionInformationFromFrame,
  type ConnectionDiagnostic
} from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import type { EntityFrame } from "../botster/entities";
import type { HubEntityLoadStatus } from "../botster/LocalHubFirstScreen";
import type { EntitySubscriptionErrorPayload } from "../botster/protocol";
import type { UiTreeSnapshot } from "../botster/uiNodes";
import { entitySubscriptionErrorFromFrame, isEntitySnapshotFrameForFamily } from "./entitySubscription";
import type { HubEntityLoadKey } from "./hubLifecycle";
import { visibleStatusText } from "./values";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

type LiveProtocolHarnessEntityControl = {
  applyEntityFrame?: (frame: EntityFrame) => void;
  listEntities?: (family: string) => Array<Record<string, unknown> & { id: string }>;
  demandEntityFamily?: (family: string) => Promise<void>;
  releaseEntityFamily?: (family: string) => Promise<void>;
};

export function useProductionHubConnection(options: {
  runtimeClient: RuntimeClient;
  recordDiagnostic: (diagnostic: ConnectionDiagnostic | undefined) => void;
  recordDiagnostics: (diagnostics: ConnectionDiagnostic[]) => void;
  updateLocalState: (patch: Record<string, unknown>) => void;
  setSurfaceSnapshot: Dispatch<SetStateAction<UiTreeSnapshot | undefined>>;
  setFrameVersion: Dispatch<SetStateAction<number>>;
  setEntityLoadStatus: Dispatch<SetStateAction<Record<HubEntityLoadKey, HubEntityLoadStatus>>>;
  setSessionTypeSubscriptionError: Dispatch<SetStateAction<EntitySubscriptionErrorPayload | undefined>>;
}): void {
  const {
    runtimeClient,
    recordDiagnostic,
    recordDiagnostics,
    updateLocalState,
    setSurfaceSnapshot,
    setFrameVersion,
    setEntityLoadStatus,
    setSessionTypeSubscriptionError
  } = options;

  // Live-protocol harness only: apply a real entity frame through the production store and
  // bump the same frame version used for hub-delivered frames. Does not alter validation policy.
  // Also expose listEntities for authoritative cleanup/oracles (read-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const harness = (window as typeof window & {
      __BOTSTER_LIVE_PROTOCOL_HARNESS__?: LiveProtocolHarnessEntityControl;
    }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    if (!harness) return;

    const applyEntityFrame = (frame: EntityFrame) => {
      runtimeClient.entities.apply(frame);
      setFrameVersion((version) => version + 1);
    };
    const listEntities = (family: string) =>
      runtimeClient.entities.list(family).map((record) => ({ ...record }));
    const demandEntityFamily = (family: string) =>
      runtimeClient.hub.send({ kind: "entity_pull", payload: { family } });
    const releaseEntityFamily = (family: string) =>
      runtimeClient.hub.send({ kind: "entity_release", payload: { family } });
    harness.applyEntityFrame = applyEntityFrame;
    harness.listEntities = listEntities;
    harness.demandEntityFamily = demandEntityFamily;
    harness.releaseEntityFamily = releaseEntityFamily;
    return () => {
      if (harness.applyEntityFrame === applyEntityFrame) {
        delete harness.applyEntityFrame;
      }
      if (harness.listEntities === listEntities) {
        delete harness.listEntities;
      }
      if (harness.demandEntityFamily === demandEntityFamily) {
        delete harness.demandEntityFamily;
      }
      if (harness.releaseEntityFamily === releaseEntityFamily) {
        delete harness.releaseEntityFamily;
      }
    };
  }, [runtimeClient, setFrameVersion]);

  useEffect(() => {
    let cancelled = false;
    let controlStreamEstablished = false;
    const unsubscribeTree = runtimeClient.uiTree.subscribe((snapshot) => {
      if (!cancelled) {
        setSurfaceSnapshot(snapshot);
      }
    });
    const unsubscribeFrames = runtimeClient.hub.onFrame(() => {
      if (!cancelled) {
        setFrameVersion((version) => version + 1);
      }
    });
    const unsubscribeDiagnostics = runtimeClient.hub.onFrame((frame) => {
      if (!cancelled) {
        recordDiagnostic(operatorErrorDiagnostic(frame));
        recordDiagnostic(hubConnectionDiagnosticFromFrame(frame));
        recordDiagnostic(schemaVersionInformationFromFrame(frame));
        recordDiagnostics(compatibilityDiagnosticsFromFrame(frame));
        const subscriptionError = entitySubscriptionErrorFromFrame(frame, "session_type");
        if (subscriptionError) {
          setSessionTypeSubscriptionError(subscriptionError);
        } else if (isEntitySnapshotFrameForFamily(frame, "session_type")) {
          // A fresh authoritative baseline ends the failed generation. The error is terminal
          // for its own generation only -- it must not outlive a successful resubscribe.
          setSessionTypeSubscriptionError(undefined);
        }
      }
    });

    const pullProductionEntity = async (
      key: HubEntityLoadKey,
      request: { family: string; id?: string }
    ) => {
      setEntityLoadStatus((current) => ({ ...current, [key]: "loading" }));
      try {
        await runtimeClient.entities.pull(request);
        if (!cancelled) {
          setEntityLoadStatus((current) => ({ ...current, [key]: "loaded" }));
        }
      } catch (error) {
        if (!cancelled) {
          setEntityLoadStatus((current) => ({ ...current, [key]: "error" }));
        }
        throw error;
      }
    };

    void runtimeClient.hub
      .connect(botsterWebCapabilities)
      .then(() => {
        controlStreamEstablished = true;
      })
      .then(() => runtimeClient.hub.subscribe())
      .then(() => runtimeClient.hub.subscribeSurface({ surface: "botster-web.production.session", path: "/sessions/local" }))
      .then(() => pullProductionEntity("hubStatus", { family: hubStatusFamily }))
      .then(() => pullProductionEntity("app", { family: "botster-web.app" }))
      .then(() => pullProductionEntity("packageNavigation", { family: "botster-web.package_navigation" }))
      .then(() => pullProductionEntity("package", { family: "botster-web.package" }))
      .then(() => pullProductionEntity("availablePackage", { family: "botster-web.available_package" }))
      .then(() => pullProductionEntity("spawnTarget", { family: "botster-web.spawn_target" }))
      .then(() => pullProductionEntity("sessionType", { family: "session_type" }))
      .then(() => pullProductionEntity("session", { family: "session" }))
      .catch((error: unknown) => {
        if (!cancelled) {
          updateLocalState({
            "production.action_status": error instanceof Error ? visibleStatusText(error.message) : "Local hub connection failed"
          });
          recordDiagnostic(connectionFailureDiagnostic(controlStreamEstablished, error));
        }
      });

    return () => {
      cancelled = true;
      unsubscribeTree();
      unsubscribeFrames();
      unsubscribeDiagnostics();
      runtimeClient.actions.rejectPending("botster-web unmounted");
      void runtimeClient.hub.disconnect();
    };
  }, [
    recordDiagnostic,
    recordDiagnostics,
    runtimeClient,
    setEntityLoadStatus,
    setFrameVersion,
    setSessionTypeSubscriptionError,
    setSurfaceSnapshot,
    updateLocalState
  ]);
}
