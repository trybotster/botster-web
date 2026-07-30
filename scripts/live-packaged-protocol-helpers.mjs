export function packageEnsureDecision(packages, packageName) {
  if (!Array.isArray(packages)) {
    throw new Error("package ensure requires a structured package list");
  }

  const packageRecord = packages.find((candidate) => candidate?.package_name === packageName);

  return {
    install: packageRecord == null,
    enable: packageRecord == null || packageRecord.state !== "enabled",
    state: packageRecord?.state ?? "absent"
  };
}

export function assertDurableStateOwnership({ durableStateMode, suppliedDataDir }) {
  if (durableStateMode && suppliedDataDir !== undefined) {
    throw new Error(
      "BOTSTER_LIVE_DURABLE_STATE owns and seeds its generated data directory; " +
      "it cannot be combined with caller-owned BOTSTER_LIVE_DATA_DIR"
    );
  }
}

export function assertWorkspacesStateOwnership({
  requireWorkspacesMode,
  durableStateMode,
  suppliedDataDir
}) {
  if (
    requireWorkspacesMode &&
    (suppliedDataDir !== undefined || durableStateMode)
  ) {
    throw new Error(
      "Workspaces compatibility mode creates durable plugin state and requires a fresh harness-owned data directory; " +
        "unset BOTSTER_LIVE_DATA_DIR and BOTSTER_LIVE_DURABLE_STATE."
    );
  }
}

export function durableSeedSessionIdsForDiagnosticsLimit(limit) {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("Diagnostics entity record limit must be a non-negative integer");
  }
  return Array.from(
    { length: limit + 1 },
    (_, index) => `botster-web-durable-exited-${index + 1}`
  );
}

export function assertPackageReused(decision, packageName) {
  if (decision.install || decision.enable) {
    throw new Error(
      `durable package state was not restored enabled for ${packageName}: ${JSON.stringify(decision)}`
    );
  }
}

export function htmlAssetUrls(html) {
  return [...String(html).matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/assets/"))
    .sort();
}

export function harnessEventMatches(entry, criteria) {
  if (entry?.kind !== criteria.kind) return false;
  const payload = entry.payload ?? {};
  if (criteria.frameKind && payload.kind !== criteria.frameKind) return false;

  const framePayload = payload.payload ?? {};
  const hasRecordCriteria =
    criteria.id != null ||
    criteria.status != null ||
    criteria.lifecycle != null ||
    criteria.lifecycle_class != null ||
    typeof criteria.attachable === "boolean";

  const family = framePayload.key?.family ?? framePayload.family;
  if (criteria.family && family !== criteria.family) return false;

  if (hasRecordCriteria) {
    const records = [];
    if (framePayload.record) {
      records.push({ id: framePayload.key?.id, ...framePayload.record });
    }
    if (Array.isArray(framePayload.records)) {
      records.push(...framePayload.records);
    }
    if (payload.kind === "entity_remove" && framePayload.key) {
      records.push({ id: framePayload.key.id });
    }

    if (!records.some((record) =>
      (criteria.id == null || record.id === criteria.id) &&
      (criteria.status == null || record.status === criteria.status) &&
      (criteria.lifecycle == null || record.lifecycle === criteria.lifecycle) &&
      (criteria.lifecycle_class == null || record.lifecycle_class === criteria.lifecycle_class) &&
      (typeof criteria.attachable !== "boolean" || record.attachable === criteria.attachable)
    )) return false;
  }

  if (criteria.type && payload.type !== criteria.type) return false;
  if (criteria.entity_type && payload.entity_type !== criteria.entity_type) return false;
  if (criteria.package_name && payload.package_name !== criteria.package_name) return false;
  if (
    criteria.package_name_pattern &&
    !new RegExp(criteria.package_name_pattern).test(payload.package_name)
  ) return false;
  if (criteria.surface_id && (payload.surface_id ?? payload.request?.surface_id) !== criteria.surface_id) return false;
  if (criteria.action_id && (payload.action_id ?? payload.request?.action_id) !== criteria.action_id) return false;
  if (typeof criteria.rows === "number" && payload.rows !== criteria.rows) return false;
  if (typeof criteria.cols === "number" && payload.cols !== criteria.cols) return false;
  if (criteria.state && payload.state !== criteria.state) return false;
  if (criteria.requestType && payload.requestType !== criteria.requestType) return false;
  return true;
}
