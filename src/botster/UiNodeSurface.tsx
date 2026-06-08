import { IonIcon } from "@ionic/react";
import { trailSignOutline } from "ionicons/icons";
import type { ReactNode } from "react";

import { ionicUiNodeRendererRegistry } from "./IonicUiNodeRenderer";
import type { UiCapabilitySet } from "./capabilities";
import type { EntityFrameStore } from "./entities";
import type { UiTreeSnapshot } from "./uiNodes";

interface UiNodeSurfaceProps {
  snapshot: UiTreeSnapshot;
  entities: EntityFrameStore;
  capabilities?: UiCapabilitySet;
  localState?: Record<string, unknown>;
}

export function UiNodeSurface({ snapshot, entities, capabilities, localState }: UiNodeSurfaceProps) {
  const renderedTree = ionicUiNodeRendererRegistry.render(snapshot, entities, { capabilities, localState }) as ReactNode;

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
