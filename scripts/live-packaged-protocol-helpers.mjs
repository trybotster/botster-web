export function packageEnsureDecision(packages, packageName) {
  if (!Array.isArray(packages)) {
    throw new Error("package ensure requires a structured package list");
  }

  const packageRecord = packages.find((candidate) =>
    candidate?.package_name === packageName ||
    candidate?.name === packageName ||
    candidate?.id === packageName
  );

  return {
    install: packageRecord == null,
    enable: packageRecord == null || packageRecord.state !== "enabled",
    state: packageRecord?.state ?? "absent"
  };
}

export function harnessEventMatches(entry, criteria) {
  if (entry?.kind !== criteria.kind) return false;
  const payload = entry.payload ?? {};
  if (criteria.frameKind && payload.kind !== criteria.frameKind) return false;

  const framePayload = payload.payload ?? {};
  const hasRecordCriteria =
    criteria.id != null ||
    criteria.status != null ||
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
  if (criteria.surface_id && payload.surface_id !== criteria.surface_id) return false;
  if (typeof criteria.rows === "number" && payload.rows !== criteria.rows) return false;
  if (typeof criteria.cols === "number" && payload.cols !== criteria.cols) return false;
  if (criteria.state && payload.state !== criteria.state) return false;
  if (criteria.requestType && payload.requestType !== criteria.requestType) return false;
  return true;
}
