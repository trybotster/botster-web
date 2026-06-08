import { IonBadge, IonIcon } from "@ionic/react";
import { cubeOutline, radioButtonOnOutline, trailSignOutline } from "ionicons/icons";

import type { UiFrame, UiFrameSet } from "./frames";

const frameIcons: Record<UiFrame["kind"], string> = {
  uinode: trailSignOutline,
  action: radioButtonOnOutline,
  entity: cubeOutline
};

interface UiFrameHostProps {
  frameSet: UiFrameSet;
}

export function UiFrameHost({ frameSet }: UiFrameHostProps) {
  return (
    <section
      className="renderer-surface"
      aria-labelledby="renderer-heading"
      data-testid="ui-frame-host"
    >
      <div className="panel-heading">
        <IonIcon icon={trailSignOutline} aria-hidden="true" />
        <div>
          <p className="eyebrow">Renderer seam</p>
          <h2 id="renderer-heading">{frameSet.title}</h2>
        </div>
      </div>

      <div className="frame-list">
        {frameSet.frames.map((frame) => (
          <article className="frame-row" key={frame.id}>
            <div className="frame-icon">
              <IonIcon icon={frameIcons[frame.kind]} aria-hidden="true" />
            </div>
            <div>
              <div className="frame-title">
                <h3>{frame.title}</h3>
                <IonBadge color="light">{frame.kind}</IonBadge>
              </div>
              <p>{frame.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
