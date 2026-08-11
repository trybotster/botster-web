/** Admitted plugin navigation shortcut projection (model only). */

import { supportsHubRoutePath } from "./routing";
import { firstString, stringValue } from "./values";

export type PackageNavigationShortcut = {
  id: string;
  label: string;
  targetKind: string;
  openable: boolean;
  diagnostic?: string;
};

export function packageNavigationShortcut(entry: Record<string, unknown>): PackageNavigationShortcut {
  const targetKind = stringValue(entry.target_kind, "");
  const blocked = entry.enabled === false || entry.blocked === true;
  const blockedDiagnostic = firstString(entry.diagnostics_summary, ...(Array.isArray(entry.diagnostics) ? entry.diagnostics : []))
    ?? "Unavailable from hub navigation registry";
  const openablePluginSurface =
    targetKind === "plugin_surface" &&
    (supportsHubRoutePath(firstString(entry.route_path)) || Boolean(firstString(entry.package_name) && firstString(entry.surface_id)));

  return {
    id: String(entry.id),
    label: stringValue(entry.label, String(entry.id)),
    targetKind,
    openable: !blocked && openablePluginSurface,
    diagnostic: blocked
      ? blockedDiagnostic
      : openablePluginSurface
        ? undefined
        : `Unsupported navigation target: ${targetKind || "unknown"}`
  };
}
