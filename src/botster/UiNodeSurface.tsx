import { IonIcon } from "@ionic/react";
import { trailSignOutline } from "ionicons/icons";
import type { ReactNode } from "react";

import { ionicUiNodeRendererRegistry } from "./IonicUiNodeRenderer";
import type { ActionBinding } from "./actions";
import type { UiCapabilitySet } from "./capabilities";
import type { EntityFrameStore } from "./entities";
import type { UiNode, UiTreeSnapshot } from "./uiNodes";

interface UiNodeSurfaceProps {
  snapshot: UiTreeSnapshot;
  entities: EntityFrameStore;
  capabilities?: UiCapabilitySet;
  localState?: Record<string, unknown>;
  onAction?: (action: ActionBinding, node: UiNode) => void;
}

export function UiNodeSurface({ snapshot, entities, capabilities, localState, onAction }: UiNodeSurfaceProps) {
  const renderedTree = ionicUiNodeRendererRegistry.render(snapshot, entities, {
    capabilities,
    dispatchAction: onAction,
    localState
  }) as ReactNode;

  return (
    <section className="renderer-surface" aria-labelledby="renderer-heading" data-testid="ui-node-surface">
      <div className="panel-heading">
        <IonIcon icon={trailSignOutline} aria-hidden="true" />
        <div>
          <p className="eyebrow">Renderer registry</p>
          <h2 id="renderer-heading">{snapshot.surface}</h2>
        </div>
      </div>

      <div className="uinode-root">
        {renderedTree}
      </div>
    </section>
  );
}
