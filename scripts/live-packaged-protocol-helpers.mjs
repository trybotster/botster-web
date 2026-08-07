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

/**
 * Shared host-chrome selector/attribute vocabulary for the live packaged harness and
 * default-suite anti-drift contracts. Extraction stays per-side (DOM vs markup); names and
 * detach decision logic do not.
 */
export const HOST_CHROME = Object.freeze({
  terminalContainerClass: "terminal-view-container",
  terminalStatusClass: "terminal-status",
  terminalSessionIdAttr: "data-terminal-session-id",
  terminalAttachStateAttr: "data-terminal-attach-state",
  dashboardTestId: "dashboard-view",
  appsViewTestId: "apps-view",
  diagnosticsViewTestId: "diagnostics-view",
  terminalSessionViewTestId: "terminal-session-view",
  pluginSettingsRouteTestId: "plugin-settings-route",
  selectedAppSurfaceTestId: "selected-app-surface",
  sessionTypesViewTestId: "session-types-view",
  createSessionTypeTestId: "create-session-type",
  submitSessionTypeTestId: "submit-session-type",
  deleteSessionTypeTestIdPrefix: "delete-session-type-",
  hubSettingsGeneralTestId: "hub-settings-general",
  hubSoftwareIdentityTestId: "hub-software-identity",
  hubHostIdentityTestId: "hub-host-identity",
  hubInternalStateTestId: "hub-internal-state",
  hubSoftwareUpdateTestId: "hub-software-update",
  hubUpdateOutcomeTestId: "hub-update-outcome",
  schemaDiagnosticId: "schema-version",
  developerDiagnosticsClass: "developer-diagnostics",
  installedListLabel: "Installed",
  packageConfigurationLabel: "Package configuration",
  remoteBrowserAccessHeading: "Remote browser access",
  workbenchNavLabel: "Botster workbench",
  hubSettingsSectionsLabel: "Hub settings sections",
  homeNavButtonName: "Home",
  appsNavButtonName: "Apps",
  hubSettingsNavButtonName: "Hub settings",
  sessionTypesSectionLabel: "Session types",
  supportSectionLabel: "Support",
  openSessionButtonName: "Open",
  settingsBackButtonName: "Back",
  checkForUpdatesButtonName: "Check for updates",
  sessionsHeadingName: "Sessions",
  hubHeadingName: "Hub",
  schemaFloorSourcePin: "status.schema_version < 3"
});

export function deleteSessionTypeTestId(sessionTypeId) {
  return `${HOST_CHROME.deleteSessionTypeTestIdPrefix}${sessionTypeId}`;
}

/**
 * Pure detach decision over already-extracted facts.
 * Success = positive destination (dashboard) + session terminal host gone.
 */
export function isTerminalDetached({ sessionContainerIds, dashboardPresent }, sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return false;
  }
  const ids = Array.isArray(sessionContainerIds) ? sessionContainerIds : [];
  return dashboardPresent === true && !ids.includes(sessionId);
}

/** Extract terminal container session ids from renderToStaticMarkup HTML using shared attr names. */
export function extractTerminalSessionIdsFromMarkup(markup) {
  const attr = HOST_CHROME.terminalSessionIdAttr;
  const pattern = new RegExp(`${attr}="([^"]*)"`, "g");
  const ids = [];
  for (const match of String(markup).matchAll(pattern)) {
    if (match[1]) ids.push(match[1]);
  }
  return ids;
}

export function extractDashboardPresentFromMarkup(markup) {
  return String(markup).includes(`data-testid="${HOST_CHROME.dashboardTestId}"`);
}

export function extractAttachStateFromMarkup(markup) {
  const attr = HOST_CHROME.terminalAttachStateAttr;
  const match = String(markup).match(new RegExp(`${attr}="([^"]*)"`));
  return match?.[1] ?? null;
}

export function markupContainsTestId(markup, testId) {
  return String(markup).includes(`data-testid="${testId}"`);
}

export function markupContainsDiagnosticId(markup, diagnosticId) {
  return String(markup).includes(`data-diagnostic-id="${diagnosticId}"`);
}

/**
 * Default-path host-chrome inventory. Unit suite evaluates each entry against rendered
 * product markup (or shared decision facts). Mode-branch chrome is out of scope.
 */
export const HOST_CHROME_CONTRACTS = Object.freeze([
  Object.freeze({
    id: "terminal-mounted",
    harnessUse: "waitForTerminalSession / terminal attach assertions",
    render: "TerminalViewHost",
    constants: ["terminalContainerClass", "terminalSessionIdAttr", "terminalAttachStateAttr", "terminalStatusClass"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "terminal-detached",
    harnessUse: "waitForTerminalDetached after shutdownProductionSession",
    render: "DashboardView",
    constants: ["dashboardTestId", "terminalSessionIdAttr"],
    decide: "isTerminalDetached",
    class: "host-chrome"
  }),
  Object.freeze({
    id: "settings-back",
    harnessUse: "plugin settings close path (getByRole Back)",
    render: "PluginSettingsRoutePage",
    constants: ["pluginSettingsRouteTestId", "settingsBackButtonName"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "schema-presentation-neutral",
    harnessUse: "assertCurrentHubSchemaPresentation",
    render: "ConnectionDiagnosticsPanel",
    constants: ["schemaDiagnosticId", "hubHeadingName"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "schema-floor-in-harness",
    harnessUse: "assertCurrentHubCompatibilityAndSchema floor check",
    render: "schemaFloorSourcePin",
    constants: ["schemaFloorSourcePin"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "dashboard-view",
    harnessUse: "openHomeView / openSessionTerminal / detach destination",
    render: "DashboardView",
    constants: ["dashboardTestId", "sessionsHeadingName", "openSessionButtonName"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "terminal-session-view",
    harnessUse: "openSessionTerminal / reconnect cycle route restore",
    render: "SessionRouteView",
    constants: ["terminalSessionViewTestId"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "hub-general-chrome",
    harnessUse: "assertAuthoritativeHubIdentity / assertHubUpdateCheck",
    render: "HubGeneralSection",
    constants: [
      "hubSettingsGeneralTestId",
      "hubSoftwareIdentityTestId",
      "hubHostIdentityTestId",
      "hubInternalStateTestId",
      "hubSoftwareUpdateTestId",
      "hubUpdateOutcomeTestId",
      "checkForUpdatesButtonName"
    ],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "apps-view",
    harnessUse: "openAppsView / installedList",
    render: "AppsView",
    constants: ["appsViewTestId", "installedListLabel"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "workbench-nav",
    harnessUse: "openHomeView / openAppsView Home+Apps buttons",
    render: "WorkbenchNav",
    constants: ["workbenchNavLabel", "homeNavButtonName", "appsNavButtonName"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "selected-app-surface",
    harnessUse: "plugin surface wait/read paths (default path package surfaces)",
    render: "PluginSurfaceRoutePage",
    constants: ["selectedAppSurfaceTestId"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "diagnostics-view",
    harnessUse: "openDiagnosticsView / durable diagnostics panel",
    render: "DiagnosticsView",
    constants: ["diagnosticsViewTestId", "developerDiagnosticsClass", "supportSectionLabel"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "hub-settings-sections",
    harnessUse: "openDiagnosticsView / createSessionTypeThroughRenderedForm section nav",
    render: "HubSettingsSectionsNav",
    constants: [
      "hubSettingsSectionsLabel",
      "sessionTypesSectionLabel",
      "supportSectionLabel",
      "hubSettingsNavButtonName"
    ],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "session-types-chrome",
    harnessUse: "exerciseSessionTypes / createSessionTypeThroughRenderedForm",
    render: "SessionTypesView + SessionTypesSurfaceNotices + SessionTypeListItem + SessionTypeSubmitButton",
    constants: [
      "sessionTypesViewTestId",
      "createSessionTypeTestId",
      "submitSessionTypeTestId",
      "deleteSessionTypeTestIdPrefix"
    ],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "package-settings-chrome",
    harnessUse: "assertRemoteAccessSettingsDispatch / package settings open",
    render: "PluginSettingsPanel + RemoteAccessConfigurationItem",
    constants: ["packageConfigurationLabel", "remoteBrowserAccessHeading"],
    class: "host-chrome"
  }),
  Object.freeze({
    id: "local-hub-first-screen",
    harnessUse: "assertCurrentHubSchemaPresentation Hub card heading",
    render: "LocalHubFirstScreen",
    constants: ["hubHeadingName"],
    class: "host-chrome"
  })
]);

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
  canonicalRecords,
  renderedNodeIds = []
}) {
  const records = canonicalRecords ?? (canonicalRecord ? [canonicalRecord] : []);
  const bindings = collectBindLists(uiTree).filter((node) =>
    node.source === "/session" &&
    (node.where?.session_uuid == null || node.where.session_uuid === referenceId) &&
    (canonicalRecord != null || node.where?.session_uuid === referenceId)
  );
  if (bindings.length === 0) {
    return identityClassification({ referenceId, lifecycleClass, outcome: "not-authored" });
  }

  const realizedBindings = bindings.map((binding) => {
    const matchingRecords = records.filter((record) => recordMatchesWhere(record, binding.where));
    const candidates = matchingRecords.length > 0
      ? matchingRecords.map((record) => ({
          branch: "item",
          identity: describeTemplateIdentity(binding.item_template?.id, record),
          record,
          recordId: entityRecordId(record)
        }))
      : binding.empty_template && binding.where?.session_uuid === referenceId
        ? [{
            branch: "empty",
            identity: describeTemplateIdentity(binding.empty_template.id),
            record: undefined,
            recordId: referenceId
          }]
        : [];
    const resolvedBoundIds = typeof binding.item_template?.id === "object"
      ? candidates
          .filter((candidate) => candidate.branch === "item")
          .map((candidate) => candidate.identity.resolvedValue)
          .filter(Boolean)
      : [];
    return {
      binding,
      candidates,
      collisionIds: duplicateValues(resolvedBoundIds)
    };
  });
  const referenceCandidates = realizedBindings.flatMap(({ binding, candidates, collisionIds }) =>
    candidates
      .filter((candidate) => candidate.recordId === referenceId)
      .map((candidate) => ({ ...candidate, binding, collisionIds }))
  );
  const materialized = referenceCandidates.find((candidate) =>
    candidate.identity.resolvedValue && renderedNodeIds.includes(candidate.identity.resolvedValue)
  );
  const collision = referenceCandidates.find((candidate) =>
    candidate.identity.resolvedValue && candidate.collisionIds.includes(candidate.identity.resolvedValue)
  );
  const unresolved = referenceCandidates.find((candidate) => !candidate.identity.resolvedValue);
  const selected = materialized ?? collision ?? unresolved ?? referenceCandidates[0];
  const outcome = materialized
    ? "materialized"
    : collision
      ? "dropped-collision"
      : unresolved
        ? "dropped-empty"
        : "authored-not-materialized";

  return identityClassification({
    referenceId,
    lifecycleClass,
    outcome,
    identity: selected?.identity,
    branch: selected?.branch,
    whereMatched: referenceCandidates.some((candidate) => candidate.branch === "item"),
    emptyTemplateIdentity: selected?.binding.empty_template
      ? describeTemplateIdentity(selected.binding.empty_template.id)
      : undefined,
    bindingSource: selected?.binding.source ?? bindings[0].source,
    where: selected?.binding.where ?? bindings[0].where
  });
}

const workspacesLifecycleRegionPattern = /-sessions-(current|ended|unavailable)-/g;

export function workspacesLifecycleRegion(ancestors, lifecycleClass) {
  for (const ancestor of ancestors ?? []) {
    const lifecycleClasses = [...(ancestor.id ?? "").matchAll(workspacesLifecycleRegionPattern)]
      .map((match) => match[1]);
    if (lifecycleClasses.length === 1 && lifecycleClasses[0] === lifecycleClass) {
      return { ...ancestor, text: (ancestor.text ?? "").slice(0, 320), lifecycleClasses };
    }
  }
  return null;
}

export function workspacesLifecyclePartitionExpectations(partition) {
  const lifecycleClasses = ["current", "ended", "unavailable"];
  const assignments = new Map();
  const expectations = [];
  for (const lifecycleClass of lifecycleClasses) {
    for (const referenceId of partition[lifecycleClass] ?? []) {
      if (assignments.has(referenceId)) {
        throw new Error(
          `Workspaces lifecycle reference ${referenceId} belongs to both ` +
          `${assignments.get(referenceId)} and ${lifecycleClass}`
        );
      }
      assignments.set(referenceId, lifecycleClass);
      expectations.push({
        referenceId,
        lifecycleClass
      });
    }
  }
  const absentExpectations = [...assignments].flatMap(([referenceId, expectedClass]) =>
    lifecycleClasses
      .filter((lifecycleClass) => lifecycleClass !== expectedClass)
      .map((lifecycleClass) => ({
        referenceId,
        lifecycleClass
      }))
  );
  return { expectations, absentExpectations };
}

export function workspacesLifecycleDomResult({ count = 1, visible, text, region, actions, branch }) {
  const reason = count !== 1
    ? "row-count"
    : visible !== true
      ? "not-visible"
      : (text ?? "").length === 0
        ? "empty-text"
        : region == null
          ? "no-semantic-region"
          : branch === "item" && (actions ?? []).length === 0
            ? "no-contained-action"
            : null;
  return { valid: reason == null, reason };
}

export function workspacesLifecycleMaterializationResult(classification, dom) {
  return dom.valid
    ? { ...classification, dom }
    : {
        ...classification,
        identityOutcome: classification.outcome,
        outcome: "materialized-not-legible",
        dom
      };
}

export function workspacesLifecycleAbsenceResult({
  currentResolvedValue,
  priorResolvedValue,
  renderedNodeIds,
  regions
}) {
  const unexpectedRegions = (regions ?? []).filter((entry) => entry.region != null);
  const priorOnlyId = priorResolvedValue && priorResolvedValue !== currentResolvedValue
    ? priorResolvedValue
    : null;
  const priorOnlyRendered = priorOnlyId != null && (renderedNodeIds ?? []).includes(priorOnlyId);
  const reason = unexpectedRegions.length > 0
    ? "still-in-semantic-region"
    : priorOnlyRendered
      ? "prior-row-still-rendered"
      : null;
  return {
    valid: reason == null,
    reason,
    currentResolvedValue: currentResolvedValue ?? null,
    priorResolvedValue: priorResolvedValue ?? null,
    priorOnlyId,
    priorOnlyRendered,
    regions: regions ?? []
  };
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

export function latestAcceptedWorkspacesUiTree(events) {
  for (const entry of [...(events ?? [])].reverse()) {
    if (entry?.kind === "hub_frame" && entry.payload?.kind === "action_result") {
      const payload = entry.payload?.payload;
      const result = payload?.result;
      const pluginActionResult = result?.plugin_action_result;
      if (
        payload?.accepted === true &&
        result?.package_name === "botster-workspaces" &&
        result?.surface_id === "workspaces" &&
        pluginActionResult?.state === "accepted" &&
        pluginActionResult.replacement
      ) return pluginActionResult.replacement;
    }
    if (entry?.kind === "daemon_response") {
      const surface = entry.payload?.plugin_surface;
      const snapshot = surface?.ui_tree_snapshot;
      if (
        surface?.package_name === "botster-workspaces" &&
        surface?.surface_id === "workspaces" &&
        snapshot?.package_name === "botster-workspaces" &&
        snapshot?.surface_id === "workspaces" &&
        snapshot?.body
      ) return snapshot.body;
    }
  }
  return null;
}

function identityClassification(details) {
  return {
    referenceId: details.referenceId,
    lifecycleClass: details.lifecycleClass,
    outcome: details.outcome,
    identityKind: details.identity?.kind ?? null,
    identitySource: details.identity?.source ?? null,
    resolvedValue: details.identity?.resolvedValue ?? null,
    branch: details.branch ?? null,
    whereMatched: details.whereMatched ?? null,
    emptyTemplateIdentity: details.emptyTemplateIdentity ?? null,
    bindingSource: details.bindingSource ?? null,
    where: details.where ?? null
  };
}

function recordMatchesWhere(record, where) {
  return Object.entries(where ?? {}).every(([key, value]) => record?.[key] === value);
}

function entityRecordId(record) {
  return record?.session_uuid ?? record?.session_id ?? record?.id;
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
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

export function packageRuntimeNavigation({ appUrl, currentUrl, mode }) {
  const packageUrl = new URL(appUrl);
  const selectedUrl = new URL(currentUrl);
  if (selectedUrl.origin !== packageUrl.origin) {
    throw new Error(
      `package runtime navigation started on unexpected origin: page=${selectedUrl} app=${packageUrl}`
    );
  }

  if (mode === "reload-current-route") {
    return { action: "reload", expectedUrl: selectedUrl.toString(), mode };
  }
  if (mode === "revisit-package-root") {
    return { action: "goto", expectedUrl: packageUrl.toString(), mode };
  }
  throw new Error(`unsupported package runtime navigation mode ${JSON.stringify(mode)}`);
}
