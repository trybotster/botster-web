import { useState } from "react";
import { useProductionHubConnection } from "../useProductionHubConnection";
import type { HubEntityLoadKey } from "../hubLifecycle";
import type { HubEntityLoadStatus } from "../../botster/LocalHubFirstScreen";
import type { UiTreeSnapshot } from "../../botster/uiNodes";
import type { EntitySubscriptionErrorPayload } from "../../botster/protocol";

type Options = Parameters<typeof useProductionHubConnection>[0];

export function ProductionHubConnectionHarness(props: Pick<Options,
  "runtimeClient" | "recordDiagnostic" | "recordDiagnostics" | "updateLocalState"
> & { onLoads: (loads: Record<HubEntityLoadKey, HubEntityLoadStatus>) => void }) {
  const [loads, setEntityLoadStatus] = useState({} as Record<HubEntityLoadKey, HubEntityLoadStatus>);
  const [, setFrameVersion] = useState(0);
  const [, setSurfaceSnapshot] = useState<UiTreeSnapshot>();
  const [, setSessionTypeSubscriptionError] = useState<EntitySubscriptionErrorPayload>();
  useProductionHubConnection({
    ...props,
    setEntityLoadStatus,
    setFrameVersion,
    setSurfaceSnapshot,
    setSessionTypeSubscriptionError
  });
  props.onLoads(loads);
  return <ul>{props.runtimeClient.entities.list("session").map((session) =>
    <li key={session.id}>{session.id}</li>
  )}</ul>;
}
