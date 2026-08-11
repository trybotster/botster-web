import { IonIcon } from "@ionic/react";
import { trailSignOutline } from "ionicons/icons";
import type { ReactNode } from "react";

import { ionicUiNodeRendererRegistry } from "./IonicUiNodeRenderer";
import type { UiCapabilitySet } from "./capabilities";
import type { EntityFrameStore } from "./entities";
import type { JsonValue, UiActionResult, UiNodeActionDispatch, UiTreeSnapshot } from "./uiNodes";

interface UiNodeSurfaceProps {
  snapshot: UiTreeSnapshot;
  entities: EntityFrameStore;
  showTechnicalHeader?: boolean;
  capabilities?: UiCapabilitySet;
  localState?: Record<string, unknown>;
  presentation?: Record<string, JsonValue>;
  actionResult?: UiActionResult;
  onAction?: (dispatch: UiNodeActionDispatch) => void;
  onDismissPresentation?: (key: string) => void;
}

export function UiNodeSurface({
  snapshot,
  entities,
  showTechnicalHeader = true,
  capabilities,
  localState,
  presentation,
  actionResult,
  onAction,
  onDismissPresentation
}: UiNodeSurfaceProps) {
  const renderedTree = ionicUiNodeRendererRegistry.render(snapshot, entities, {
    actionResult,
    capabilities,
    dispatchAction: onAction,
    dismissPresentation: onDismissPresentation,
    localState,
    presentation
  }) as ReactNode;

  if (!showTechnicalHeader) {
    return (
      <div className="uinode-root" data-testid="ui-node-surface">
        {renderedTree}
      </div>
    );
  }

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
