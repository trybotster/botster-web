/** Admitted plugin navigation shortcuts for the workbench sidebar. */

import { IonIcon, IonMenuToggle } from "@ionic/react";
import { cubeOutline } from "ionicons/icons";

import {
  packageNavigationShortcut,
  type PackageNavigationShortcut
} from "./pluginNavigationModel";

export function PackageNavigationShortcutButton({
  shortcut,
  onOpen
}: {
  shortcut: PackageNavigationShortcut;
  onOpen: () => void;
}) {
  const disabled = !shortcut.openable;
  return (
    <IonMenuToggle autoHide={false}>
      <button
        type="button"
        className={disabled ? "nav-item app-shortcut disabled" : "nav-item app-shortcut"}
        aria-disabled={disabled ? "true" : undefined}
        title={shortcut.diagnostic}
        onClick={() => {
          if (shortcut.openable) onOpen();
        }}
      >
        <IonIcon icon={cubeOutline} aria-hidden="true" />
        <span className="nav-item-copy">
          <span>{shortcut.label}</span>
          {shortcut.diagnostic ? <small>{shortcut.diagnostic}</small> : null}
        </span>
      </button>
    </IonMenuToggle>
  );
}

export function PluginNavigationShortcuts({
  entries,
  onOpen
}: {
  entries: Record<string, unknown>[];
  onOpen: (entry: Record<string, unknown>) => void;
}) {
  if (entries.length === 0) return null;

  const hasOverflow = entries.length > 8;
  const shortcuts = entries.map((entry) => {
    const shortcut = packageNavigationShortcut(entry);
    return (
      <PackageNavigationShortcutButton
        key={String(entry.id)}
        shortcut={shortcut}
        onOpen={() => onOpen(entry)}
      />
    );
  });

  return (
    <div className="sidebar-section" aria-label="Admitted plugin navigation">
      <p className="sidebar-section-label">Plugins</p>
      {hasOverflow ? (
        <>
          <div
            className="sidebar-section-scroll"
            tabIndex={0}
            aria-label="Scrollable plugin navigation"
            aria-describedby="plugin-navigation-overflow-hint"
          >
            {shortcuts}
          </div>
          <p id="plugin-navigation-overflow-hint" className="sidebar-overflow-hint">
            Scroll for more plugin navigation.
          </p>
        </>
      ) : shortcuts}
    </div>
  );
}
