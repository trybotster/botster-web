/** Plugin surface render-state derivation from Hub action results. */

import type { UiTreeSnapshot } from "../botster/uiNodes";
import { readRecord, readString } from "./values";

function pluginSurfaceBodyText(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (typeof body === "number" || typeof body === "boolean") return String(body);

  const bodyRecord = readRecord(body);
  return readString(bodyRecord.text)
    ?? readString(bodyRecord.body)
    ?? readString(bodyRecord.message)
    ?? readString(bodyRecord.label)
    ?? readString(bodyRecord.title)
    ?? readString(readRecord(bodyRecord.props).text)
    ?? readString(readRecord(bodyRecord.props).title)
    ?? pluginSurfaceChildBodyText(bodyRecord);
}

function pluginSurfaceChildBodyText(body: Record<string, unknown>): string | undefined {
  const children = Array.isArray(body.children) ? body.children : [];
  for (const child of children) {
    const childText = pluginSurfaceBodyText(child);
    if (childText) return childText;
  }
  return undefined;
}

type PluginSurfaceSnapshotError = "missing_snapshot" | "identity_mismatch" | "invalid_snapshot_body";

type PluginSurfaceSnapshotResult =
  | { snapshot: UiTreeSnapshot; packageName: string; surfaceId: string }
  | { error: PluginSurfaceSnapshotError };

function pluginSurfaceSnapshot(
  result: unknown,
  expectedSurface?: { packageName: string; surfaceId: string }
): PluginSurfaceSnapshotResult {
  const pluginSurface = readRecord(readRecord(result).plugin_surface);
  const packageName = readString(pluginSurface.package_name);
  const surfaceId = readString(pluginSurface.surface_id);
  const hubSnapshot = readRecord(pluginSurface.ui_tree_snapshot);
  const snapshotPackageName = readString(hubSnapshot.package_name);
  const snapshotSurfaceId = readString(hubSnapshot.surface_id);

  if (!snapshotPackageName || !snapshotSurfaceId || !Object.hasOwn(hubSnapshot, "body")) {
    return { error: "missing_snapshot" };
  }

  if (
    !packageName ||
    !surfaceId ||
    packageName !== snapshotPackageName ||
    surfaceId !== snapshotSurfaceId ||
    (expectedSurface && (
      packageName !== expectedSurface.packageName ||
      surfaceId !== expectedSurface.surfaceId
    ))
  ) {
    return { error: "identity_mismatch" };
  }

  const root = validatedPluginSurfaceSnapshotNode(hubSnapshot.body);
  if (!root) return { error: "invalid_snapshot_body" };

  return {
    packageName,
    surfaceId,
    snapshot: {
      kind: "ui_tree_snapshot",
      surface: `${packageName}/${surfaceId}`,
      root
    }
  };
}

function validatedPluginSurfaceSnapshotNode(value: unknown): UiTreeSnapshot["root"] | undefined {
  const record = readRecord(value);
  if (!readString(record.type)) return undefined;

  // The Hub has already identity-matched and validated this body against the
  // canonical UI contract. Web preserves that grammar.
  return value as UiTreeSnapshot["root"];
}

function pluginSurfaceProtocolErrorStatus(
  title: string,
  expectedSurface: { packageName: string; surfaceId: string } | undefined,
  error: PluginSurfaceSnapshotError
): string {
  const surface = expectedSurface
    ? `${expectedSurface.packageName}/${expectedSurface.surfaceId}`
    : "the requested plugin surface";

  if (error === "identity_mismatch") {
    return `${title} render response has a snapshot identity mismatch for ${surface}.`;
  }
  if (error === "invalid_snapshot_body") {
    return `${title} render response has an invalid snapshot body for ${surface}.`;
  }
  return `${title} render response does not include the required snapshot for ${surface}.`;
}

export type PluginSurfaceRenderPhase = "rendering" | "rendered" | "error";

export interface SelectedPluginSurface {
  routeKey?: string;
  title: string;
  phase: PluginSurfaceRenderPhase;
  status?: string;
  snapshot?: UiTreeSnapshot;
  packageName?: string;
  surfaceId?: string;
  actionResult?: import("@trybotster/ui-contract").UiActionResult;
}

// Exported for focused regression coverage of route render terminal-state derivation.

export function renderedPluginSurfaceState(
  result: { accepted: boolean; reason?: string; result?: unknown },
  title: string,
  expectedSurface?: { packageName: string; surfaceId: string },
  routeKey?: string
): SelectedPluginSurface {
  if (!result.accepted) {
    return {
      routeKey,
      title,
      phase: "error",
      status: result.reason ?? "Plugin surface render was rejected."
    };
  }

  const snapshotResult = pluginSurfaceSnapshot(result.result, expectedSurface);
  if ("error" in snapshotResult) {
    return {
      routeKey,
      title,
      phase: "error",
      status: pluginSurfaceProtocolErrorStatus(title, expectedSurface, snapshotResult.error)
    };
  }

  const bodyText = pluginSurfaceBodyText(snapshotResult.snapshot.root);
  const status = bodyText
    ? `${title}: ${bodyText} (${snapshotResult.packageName}/${snapshotResult.surfaceId})`
    : `${title} rendered (${snapshotResult.packageName}/${snapshotResult.surfaceId})`;

  return {
    routeKey,
    title,
    phase: "rendered",
    status,
    snapshot: snapshotResult.snapshot,
    packageName: snapshotResult.packageName,
    surfaceId: snapshotResult.surfaceId
  };
}
