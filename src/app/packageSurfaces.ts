/** Package surface projection helpers for the Apps launcher. */

import type { ActionBinding } from "../botster/actions";
import { appDisplayName, firstString, stringValue } from "./values";

export type PackageSurfaceRecord = Record<string, unknown> & {
  launch_action?: ActionBinding;
};

export function packageAppSurfaces(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.app_surfaces);
}

export function packageSettingsSurfaces(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.settings_surfaces);
}

export function packageActions(app: Record<string, unknown>): PackageSurfaceRecord[] {
  return packageSurfaceRecords(app.package_actions);
}

function packageSurfaceRecords(value: unknown): PackageSurfaceRecord[] {
  return Array.isArray(value)
    ? value.filter((surface): surface is PackageSurfaceRecord => Boolean(surface && typeof surface === "object" && !Array.isArray(surface)))
    : [];
}

export function surfaceLaunchAction(surface: PackageSurfaceRecord | undefined): ActionBinding | undefined {
  return surface?.launch_action && typeof surface.launch_action === "object" ? surface.launch_action : undefined;
}

export function packageActionBinding(record: PackageSurfaceRecord | undefined): ActionBinding | undefined {
  return record?.action && typeof record.action === "object" ? (record.action as ActionBinding) : undefined;
}

export function packageActionKey(record: PackageSurfaceRecord): string {
  return firstString(record.id, record.action_id, packageActionBinding(record)?.id) ?? JSON.stringify(record);
}

export function packageActionDetail(record: PackageSurfaceRecord): string {
  const status = stringValue(record.status, "unknown");
  const reason = firstString(record.reason);
  return reason ? `${status}: ${reason}` : status;
}

export function surfaceTitle(surface: PackageSurfaceRecord): string {
  return firstString(surface.title, surface.surface_id, surface.id) ?? "Plugin surface";
}

export function surfaceDescription(surface: PackageSurfaceRecord): string | undefined {
  return firstString(surface.description);
}

export function surfaceKey(surface: PackageSurfaceRecord): string {
  return firstString(surface.surface_id, surface.id, surface.title) ?? JSON.stringify(surface);
}

function installedRowName(app: Record<string, unknown>): string {
  return appDisplayName(app.title, stringValue(app.package_name, String(app.id))).toLocaleLowerCase();
}

// Exported for focused regression coverage of the installed launcher ordering.
export function compareInstalledPackageRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftIsApp = packageAppSurfaces(left).length > 0;
  const rightIsApp = packageAppSurfaces(right).length > 0;
  if (leftIsApp !== rightIsApp) {
    return leftIsApp ? -1 : 1;
  }

  return installedRowName(left).localeCompare(installedRowName(right));
}

export function compareInstalledAppRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return installedRowName(left).localeCompare(installedRowName(right));
}

export function capabilityCountLabel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value === "No requested capabilities") {
    return "No special access";
  }

  const count = value.split(",").filter((part) => part.trim().length > 0).length;
  return `${count} permission${count === 1 ? "" : "s"}`;
}
