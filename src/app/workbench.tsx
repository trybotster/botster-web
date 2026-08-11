/** Primary workbench navigation (Home / Apps). */

import { IonIcon, IonList, IonMenuToggle } from "@ionic/react";
import { cubeOutline, layersOutline } from "ionicons/icons";
import type { ReactNode } from "react";

import type { AppView } from "./routing";

const navigationItems: Array<{ label: string; icon: string; view: AppView }> = [
  { label: "Home", icon: layersOutline, view: "dashboard" },
  { label: "Apps", icon: cubeOutline, view: "apps" }
];

/**
 * Workbench primary nav (Home / Apps). Exported for host-chrome anti-drift contracts —
 * no behavior change; App renders this in the sidebar.
 */
export function WorkbenchNav({
  activeView,
  onNavigate,
  children
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  children?: ReactNode;
}) {
  return (
    <nav aria-label="Botster workbench">
      <IonList lines="none" className="nav-list">
        {navigationItems.map((item) => (
          <IonMenuToggle autoHide={false} key={item.label}>
            <button
              type="button"
              className={activeView === item.view ? "nav-item active" : "nav-item"}
              aria-current={activeView === item.view ? "page" : undefined}
              onClick={() => onNavigate(item.view)}
            >
              <IonIcon icon={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          </IonMenuToggle>
        ))}
      </IonList>
      {children}
    </nav>
  );
}
