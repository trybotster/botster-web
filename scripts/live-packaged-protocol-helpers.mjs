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

export function assertWorkspacesLifecycleStateOwnership({
  lifecycleMode,
  durableStateMode,
  suppliedDataDir
}) {
  if (lifecycleMode && (suppliedDataDir !== undefined || durableStateMode)) {
    throw new Error(
      "Workspaces lifecycle mode mutates canonical sessions and plugin state and requires a fresh harness-owned data directory; " +
        "unset BOTSTER_LIVE_DATA_DIR and BOTSTER_LIVE_DURABLE_STATE."
    );
  }
}

export function convergeEntityFamily(events, family) {
  const records = new Map();
  const chronology = [];
  for (const entry of events ?? []) {
    if (entry?.kind !== "hub_frame") continue;
    const frame = entry.payload ?? {};
    if (!["entity_snapshot", "entity_upsert", "entity_patch", "entity_remove"].includes(frame.kind)) continue;
    const payload = frame.payload ?? {};
    const frameFamily = payload.family ?? payload.key?.family;
    if (frameFamily !== family) continue;
    chronology.push({ kind: frame.kind, payload });
    if (frame.kind === "entity_snapshot") {
      records.clear();
      for (const record of payload.records ?? []) {
        const id = record?.id ?? record?.session_uuid ?? record?.session_id;
        if (typeof id === "string") records.set(id, { ...record, id });
      }
      continue;
    }
    const id = payload.key?.id ?? payload.record?.id ?? payload.record?.session_uuid ?? payload.record?.session_id;
    if (typeof id !== "string") continue;
    if (frame.kind === "entity_remove") {
      records.delete(id);
    } else if (frame.kind === "entity_patch") {
      records.set(id, { ...(records.get(id) ?? { id }), ...(payload.record ?? payload.patch ?? {}) });
    } else {
      records.set(id, { ...(payload.record ?? {}), id });
    }
  }
  return { records: [...records.values()], chronology };
}

export function classifyWorkspacesReference({
  uiTree,
  referenceId,
  lifecycleClass,
  canonicalRecord,
  renderedNodeIds = []
}) {
  const bindings = collectBindLists(uiTree).filter((node) =>
    node.source === "/session" &&
    node.where?.session_uuid === referenceId &&
    (lifecycleClass === "unavailable"
      ? node.where?.lifecycle_class == null && node.empty_template
      : node.where?.lifecycle_class === lifecycleClass)
  );
  if (bindings.length === 0) {
    return identityClassification({ referenceId, lifecycleClass, outcome: "not-authored" });
  }

  const binding = bindings[0];
  const useEmpty = lifecycleClass === "unavailable" && canonicalRecord == null;
  const template = useEmpty ? binding.empty_template : binding.item_template;
  const identity = describeTemplateIdentity(template?.id, canonicalRecord);
  const allRealizedIds = collectBindLists(uiTree)
    .filter((node) => node.where?.session_uuid == null || node.where.session_uuid === referenceId)
    .map((node) => describeTemplateIdentity(node.item_template?.id, canonicalRecord).resolvedValue)
    .filter((value) => typeof value === "string" && value.length > 0);
  const collision = identity.resolvedValue != null &&
    allRealizedIds.filter((value) => value === identity.resolvedValue).length > 1;
  let outcome;
  if (!identity.resolvedValue) outcome = "dropped-empty";
  else if (collision) outcome = "dropped-collision";
  else if (renderedNodeIds.includes(identity.resolvedValue)) outcome = "materialized";
  else outcome = "dropped-empty";

  return identityClassification({
    referenceId,
    lifecycleClass,
    outcome,
    identity,
    emptyTemplateIdentity: binding.empty_template
      ? describeTemplateIdentity(binding.empty_template.id, canonicalRecord)
      : undefined,
    bindingSource: binding.source,
    where: binding.where
  });
}

export function formatWorkspacesLifecycleFailure({
  stage,
  oracle,
  classifications,
  uiTree,
  renderedRows,
  canonicalRecords,
  frameChronology,
  subscriptionId,
  requestCounts
}) {
  return [
    `Workspaces lifecycle oracle failed: stage=${stage} oracle=${oracle}`,
    `identity classifications=${JSON.stringify(classifications)}`,
    `rendered rows=${JSON.stringify(compactReferenceRows(renderedRows, classifications))}`,
    `canonical session records=${JSON.stringify(canonicalRecords)}`,
    `session frame chronology=${JSON.stringify(frameChronology)}`,
    `latest subscription id=${JSON.stringify(subscriptionId)}`,
    `request counts=${JSON.stringify(requestCounts)}`,
    `delivered UiNode tree=${JSON.stringify(compactUiTree(uiTree, classifications))}`
  ].join("\n");
}

function compactReferenceRows(renderedRows, classifications) {
  const referenceIds = (classifications ?? []).map((entry) => entry.referenceId).filter(Boolean);
  return (renderedRows ?? []).filter((row) =>
    referenceIds.some((referenceId) => row.id?.includes(referenceId) || row.text?.includes(referenceId))
  );
}

function compactUiTree(uiTree, classifications) {
  const nodes = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type || value.$kind) {
      nodes.push({
        kind: value.$kind ?? value.type,
        id: value.id ?? null,
        source: value.source ?? null,
        where: value.where ?? null,
        itemTemplateId: value.item_template?.id ?? null,
        emptyTemplateId: value.empty_template?.id ?? null
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(uiTree);
  const referenceIds = (classifications ?? []).map((entry) => entry.referenceId).filter(Boolean);
  return {
    nodeCount: nodes.length,
    root: nodes[0] ?? null,
    bindLists: nodes.filter((node) => node.kind === "bind_list"),
    referenceNodes: nodes.filter((node) =>
      referenceIds.some((referenceId) => typeof node.id === "string" && node.id.includes(referenceId))
    )
  };
}

export function reconnectGenerationEvidence(events, previousSubscriptionId) {
  const subscriptions = (events ?? [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry?.kind === "daemon_request" && entry.payload?.type === "subscribe_entities" && entry.payload?.entity_type === "session")
    .map(({ entry, index }) => ({ index, subscriptionId: entry.payload?.subscription_id }))
    .filter((entry) => typeof entry.subscriptionId === "string");
  const latest = subscriptions.at(-1);
  const previous = typeof previousSubscriptionId === "string"
    ? { subscriptionId: previousSubscriptionId }
    : subscriptions.at(-2);
  const snapshotAfterLatest = latest != null && (events ?? []).slice(latest.index + 1).some((entry) =>
    entry?.kind === "hub_frame" &&
    entry.payload?.kind === "entity_snapshot" &&
    (entry.payload?.payload?.family ?? entry.payload?.payload?.key?.family) === "session"
  );
  return {
    previousSubscriptionId: previous?.subscriptionId ?? null,
    subscriptionId: latest?.subscriptionId ?? null,
    fresh: Boolean(previous && latest && previous.subscriptionId !== latest.subscriptionId),
    authoritativeSnapshot: snapshotAfterLatest
  };
}

function identityClassification(details) {
  return {
    referenceId: details.referenceId,
    lifecycleClass: details.lifecycleClass,
    outcome: details.outcome,
    identityKind: details.identity?.kind ?? null,
    identitySource: details.identity?.source ?? null,
    resolvedValue: details.identity?.resolvedValue ?? null,
    emptyTemplateIdentity: details.emptyTemplateIdentity ?? null,
    bindingSource: details.bindingSource ?? null,
    where: details.where ?? null
  };
}

function describeTemplateIdentity(id, record) {
  if (typeof id === "string") {
    return { kind: "literal", source: id, resolvedValue: id };
  }
  const source = id?.$bind;
  if (typeof source !== "string") {
    return { kind: "bound", source: source ?? null, resolvedValue: null };
  }
  const key = source.startsWith("@/") ? source.slice(2) : null;
  const value = key ? record?.[key] : undefined;
  return {
    kind: "bound",
    source,
    resolvedValue: typeof value === "string" && value.length > 0 ? value : null
  };
}

function collectBindLists(root) {
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.$kind === "bind_list") found.push(value);
    Object.values(value).forEach(visit);
  };
  visit(root);
  return found;
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
