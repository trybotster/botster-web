import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  applicationPrimitivesFixturePath,
  materializePluginContractMatrixFixture,
  metadata as hubTestSupportMetadata,
  pluginContractMatrixFixturePath,
  readDaemonProtocolTypescript,
  readLateAttachHistoryConformanceFixture,
  readLocalWebrtcDeliveryChunkConformanceFixture,
  readModeFlagsConformanceFixture,
  readSessionLifecycleSubscriptionConformanceFixture,
  readSessionPluginBindingConformanceFixture,
  readUiContractConformanceFixtures,
  verifyPackageAssets
} from "@trybotster/hub-test-support";
import { realizeBindListDescendantId } from "@trybotster/ui-contract";
import ts from "typescript";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeHubConnection, HubConnectionError } from "../scripts/hubConnection.mjs";
import {
  assertDurableStateOwnership,
  assertPackageReused,
  assertWorkspacesLifecycleStateOwnership,
  assertWorkspacesStateOwnership,
  classifyWorkspacesReference,
  convergeEntityFamily,
  durableSeedSessionIdsForDiagnosticsLimit,
  deleteSessionTypeTestId,
  editSessionTypeTestId,
  extractAttachStateFromMarkup,
  extractDashboardPresentFromMarkup,
  extractTerminalSessionIdsFromMarkup,
  formatWorkspacesLifecycleFailure,
  harnessEventMatches,
  HOST_CHROME,
  HOST_CHROME_CONTRACTS,
  htmlAssetUrls,
  isTerminalDetached,
  latestAcceptedWorkspacesUiTree,
  markupContainsDiagnosticId,
  markupContainsTestId,
  packageRuntimeNavigation,
  packageEnsureDecision,
  reconnectGenerationEvidence,
  workspacesLifecycleAbsenceResult,
  workspacesLifecycleDomResult,
  workspacesLifecycleMaterializationResult,
  workspacesLifecyclePartitionExpectations,
  workspacesLifecycleRegion
} from "../scripts/live-packaged-protocol-helpers.mjs";
import {
  assignmentDigest,
  assertBinaryProvenanceStable,
  assertNoRequiredSmokeSkip,
  assertReconciliationCounts,
  assertSharedHubSpawnResult,
  assertTwoGenerationLedger,
  chooseCreateControl,
  parseWorkspacesSpawnAssignment,
  requiredProvenanceField,
  WORKSPACES_SPAWN_OPENER_ACTION_ID,
  WORKSPACES_SPAWN_OPENER_SELECTOR
} from "../scripts/workspaces-shared-hub-browser-helpers.mjs";

const hostForTests = "127.0.0.1";
const activeHubSessionId = "test-hub-session";
let nextTestResponseMessageId = 0;
const uiContractConformanceFixtures = await readUiContractConformanceFixtures();

const sharedHubColdAssignment = parseWorkspacesSpawnAssignment(JSON.stringify({
  generation: "cold-1",
  entry_state: "cold",
  workspace_name: "Cold workspace",
  cases: [{
    case_id: "case-a",
    target_id: "target-a",
    branch: "branch-a",
    session_type_id: "target-a/template-a"
  }]
}));
assert.equal(sharedHubColdAssignment.cases[0].expected_lifecycle, "ended");
assert.equal(assignmentDigest(sharedHubColdAssignment).length, 64);
assert.throws(() => parseWorkspacesSpawnAssignment(""), /BOTSTER_WORKSPACES_SPAWN_CASES is required/);
assert.throws(() => parseWorkspacesSpawnAssignment("{"), /must be JSON/);
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  entry_state: "reused"
})), /requires observe/);
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  cases: [sharedHubColdAssignment.cases[0], sharedHubColdAssignment.cases[0]]
})), /duplicate case_id/);
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  cases: [{ ...sharedHubColdAssignment.cases[0], expected_lifecycle: "current" }]
})), /expected_lifecycle must be ended/);
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  cases: [{ ...sharedHubColdAssignment.cases[0], expect_created_branch: "yes" }]
})), /expect_created_branch must be a boolean/);
// Cold cut: the superseded template_id key is rejected, not silently accepted as an
// alias. Workspaces now names this spawn form field session_type_id, and a driver that
// still sent template_id would key on a field the installed package never reads.
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  cases: [{
    case_id: "case-a",
    target_id: "target-a",
    branch: "branch-a",
    template_id: "template-a"
  }]
})), /cases\[0\]\.template_id is superseded by cases\[0\]\.session_type_id/);
// The old key must be rejected on its own merits, not merely because session_type_id is
// missing. A case carrying both would otherwise validate and silently drop template_id,
// which is the compatibility tolerance this migration forbids.
assert.throws(() => parseWorkspacesSpawnAssignment(JSON.stringify({
  ...sharedHubColdAssignment,
  cases: [{ ...sharedHubColdAssignment.cases[0], template_id: "template-a" }]
})), /cases\[0\]\.template_id is superseded by cases\[0\]\.session_type_id/);
assert.throws(() => assertNoRequiredSmokeSkip({ BOTSTER_LIVE_ALLOW_SURFACE_SKIP: "1" }), /rejects allow-skip inputs/);
assert.throws(() => assertNoRequiredSmokeSkip({ BOTSTER_LIVE_ALLOW_BROWSER_SKIP: "true" }), /rejects allow-skip inputs/);
assert.doesNotThrow(() => assertNoRequiredSmokeSkip({ BOTSTER_LIVE_ALLOW_SURFACE_SKIP: "0" }));
assert.equal(requiredProvenanceField({ protocol_version: 4 }, "protocol_version", "status.compatibility"), 4);
assert.throws(
  () => requiredProvenanceField({}, "protocol_version", "status.compatibility"),
  /omitted provenance field status\.compatibility\.protocol_version/
);
const launchedBinaryProvenance = {
  hub: { path: "/hub", sha256: "a".repeat(64) },
  session_worker: { path: "/worker", sha256: "b".repeat(64) }
};
assert.deepEqual(
  assertBinaryProvenanceStable(launchedBinaryProvenance, structuredClone(launchedBinaryProvenance)),
  {
    hub: { ...launchedBinaryProvenance.hub, stability: "digest_before_launch_matches_completion" },
    session_worker: {
      ...launchedBinaryProvenance.session_worker,
      stability: "digest_before_launch_matches_completion"
    }
  }
);
assert.throws(
  () => assertBinaryProvenanceStable(launchedBinaryProvenance, {
    ...launchedBinaryProvenance,
    hub: { ...launchedBinaryProvenance.hub, sha256: "c".repeat(64) }
  }),
  /hub binary changed while shared-Hub browser proof was running/
);
assert.throws(
  () => assertBinaryProvenanceStable(launchedBinaryProvenance, {
    ...launchedBinaryProvenance,
    session_worker: { ...launchedBinaryProvenance.session_worker, sha256: "d".repeat(64) }
  }),
  /session_worker binary changed while shared-Hub browser proof was running/
);
assert.equal(chooseCreateControl("cold", ["botster-workspaces-empty-create"]), "botster-workspaces-empty-create");
assert.equal(chooseCreateControl("reused", ["botster-workspaces-new"]), "botster-workspaces-new");
assert.throws(() => chooseCreateControl("reused", ["botster-workspaces-empty-create"]), /omitted required rendered create control/);
assert.deepEqual(assertReconciliationCounts(
  { plugin_surface_render: 1, list_sessions: 0 },
  { plugin_surface_render: 1, list_sessions: 0 }
), {
  before: { plugin_surface_render: 1, list_sessions: 0 },
  after: { plugin_surface_render: 1, list_sessions: 0 },
  request_counts_unchanged: true
});
assert.throws(() => assertReconciliationCounts(
  { plugin_surface_render: 1, list_sessions: 0 },
  { plugin_surface_render: 2, list_sessions: 0 }
), /changed plugin_surface_render/);
const coldLedgerSummary = {
  generation: "cold-1", entry_state: "cold", create_control: "botster-workspaces-empty-create",
  workspace: { workspace_id: "workspace-a" }, cases: [{
    case_id: "case-a",
    spawn_opener: {
      dom: { action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-a" },
      request: {
        action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-a",
        payload: { selected_workspace: "workspace-a", dialog: "spawn-target:workspace-a" }
      },
      result: {
        accepted: true, request_id: "open-request-a", state: "accepted",
        action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-a"
      }
    },
    workspace: { workspace_id: "workspace-a" },
    session: { session_id: "session-a" }, action_result: { accepted: true },
    reconciliation: { request_counts_unchanged: true }
  }],
  case_count: 1, lifecycle_reconciliation: true, completed: true
};
const reusedLedgerSummary = {
  generation: "reused-2", entry_state: "reused", create_control: "botster-workspaces-new",
  observed_prior: { workspace_id: "workspace-a", session_id: "session-a" },
  cases: [{
    case_id: "case-b",
    spawn_opener: {
      dom: { action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-b" },
      request: {
        action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-b",
        payload: { selected_workspace: "workspace-a", dialog: "spawn-target:workspace-a" }
      },
      result: {
        accepted: true, request_id: "open-request-b", state: "accepted",
        action_id: "botster_workspaces.open_spawn", node_id: "opaque-opener-b"
      }
    },
    workspace: { workspace_id: "workspace-a" },
    session: { session_id: "session-b" }, action_result: { accepted: true },
    reconciliation: { request_counts_unchanged: true }
  }], case_count: 1,
  lifecycle_reconciliation: true, completed: true
};
assert.deepEqual(assertTwoGenerationLedger([coldLedgerSummary, reusedLedgerSummary]), {
  generations: ["cold-1", "reused-2"], completed: true
});
assert.throws(() => assertTwoGenerationLedger([coldLedgerSummary]), /requires two driver generations/);
const genericOpenerLedgerSummary = structuredClone(reusedLedgerSummary);
genericOpenerLedgerSummary.cases[0].spawn_opener.request.action_id = "botster_workspaces.open";
assert.throws(
  () => assertTwoGenerationLedger([coldLedgerSummary, genericOpenerLedgerSummary]),
  /omitted consistent open_spawn evidence/
);
const mismatchedOpenerLedgerSummary = structuredClone(reusedLedgerSummary);
mismatchedOpenerLedgerSummary.cases[0].spawn_opener.result.node_id = "different-opener";
assert.throws(
  () => assertTwoGenerationLedger([coldLedgerSummary, mismatchedOpenerLedgerSummary]),
  /did not preserve opaque opener node identity/
);
const missingPayloadLedgerSummary = structuredClone(reusedLedgerSummary);
delete missingPayloadLedgerSummary.cases[0].spawn_opener.request.payload;
assert.throws(
  () => assertTwoGenerationLedger([coldLedgerSummary, missingPayloadLedgerSummary]),
  /did not preserve the producer-authored opener payload/
);
const sharedHubResultCase = {
  case_id: "case-a", target_id: "target-a", branch: "branch-a",
  expect_created_branch: true, expect_created_worktree: true, expect_reused_worktree: false
};
const sharedHubResult = {
  target_id: "target-a", branch: "branch-a", created_branch: true,
  created_worktree: true, reused_worktree: false, base_ref: "main", base_commit: "abc123",
  worktree_id: "managed:target-a:branch-a", worktree_path: "/tmp/worktree"
};
assert.doesNotThrow(() => assertSharedHubSpawnResult(sharedHubResultCase, sharedHubResult));
assert.throws(() => assertSharedHubSpawnResult(
  sharedHubResultCase,
  { ...sharedHubResult, reused_worktree: true }
), /changed reused_worktree/);

assert.deepEqual(
  packageRuntimeNavigation({
    appUrl: "http://127.0.0.1:4200/",
    currentUrl: "http://127.0.0.1:4200/packages/botster.plugin/surfaces/main?tab=active#row-2",
    mode: "reload-current-route"
  }),
  {
    action: "reload",
    expectedUrl: "http://127.0.0.1:4200/packages/botster.plugin/surfaces/main?tab=active#row-2",
    mode: "reload-current-route"
  }
);
assert.deepEqual(
  packageRuntimeNavigation({
    appUrl: "http://127.0.0.1:4200/",
    currentUrl: "http://127.0.0.1:4200/packages/botster.plugin/surfaces/main?tab=active#row-2",
    mode: "revisit-package-root"
  }),
  { action: "goto", expectedUrl: "http://127.0.0.1:4200/", mode: "revisit-package-root" }
);
assert.throws(
  () => packageRuntimeNavigation({
    appUrl: "http://127.0.0.1:4200/",
    currentUrl: "http://localhost:4200/packages/botster.plugin/surfaces/main",
    mode: "reload-current-route"
  }),
  /unexpected origin/
);
assert.throws(
  () => packageRuntimeNavigation({
    appUrl: "http://127.0.0.1:4200/",
    currentUrl: "http://127.0.0.1:4200/packages/botster.plugin/surfaces/main",
    mode: "workspaces-lifecycle"
  }),
  /unsupported package runtime navigation mode/
);

assert.deepEqual(packageEnsureDecision([], "botster-web"), {
  install: true,
  enable: true,
  state: "absent"
});
assert.deepEqual(packageEnsureDecision([{ package_name: "botster-web", state: "disabled" }], "botster-web"), {
  install: false,
  enable: true,
  state: "disabled"
});
assert.deepEqual(packageEnsureDecision([{ package_name: "botster-web", state: "enabled" }], "botster-web"), {
  install: false,
  enable: false,
  state: "enabled"
});
assert.deepEqual(packageEnsureDecision([{ name: "botster-web", state: "enabled" }], "botster-web"), {
  install: true,
  enable: true,
  state: "absent"
});
assert.throws(
  () => assertDurableStateOwnership({ durableStateMode: true, suppliedDataDir: "/caller/data" }),
  /cannot be combined with caller-owned BOTSTER_LIVE_DATA_DIR/
);
assert.throws(
  () => assertDurableStateOwnership({ durableStateMode: true, suppliedDataDir: "" }),
  /cannot be combined with caller-owned BOTSTER_LIVE_DATA_DIR/
);
assert.doesNotThrow(
  () => assertDurableStateOwnership({ durableStateMode: true, suppliedDataDir: undefined })
);
assert.doesNotThrow(() =>
  assertWorkspacesStateOwnership({
    requireWorkspacesMode: true,
    durableStateMode: false,
    suppliedDataDir: undefined
  })
);
for (const suppliedDataDir of ["", "/caller/data"]) {
  assert.throws(
    () =>
      assertWorkspacesStateOwnership({
        requireWorkspacesMode: true,
        durableStateMode: false,
        suppliedDataDir
      }),
    /requires a fresh harness-owned data directory/
  );
}
assert.throws(
  () =>
    assertWorkspacesStateOwnership({
      requireWorkspacesMode: true,
      durableStateMode: true,
      suppliedDataDir: undefined
    }),
  /requires a fresh harness-owned data directory/
);
assert.doesNotThrow(() =>
  assertWorkspacesLifecycleStateOwnership({
    lifecycleMode: true,
    durableStateMode: false,
    suppliedDataDir: undefined
  })
);
assert.throws(
  () => assertWorkspacesLifecycleStateOwnership({
    lifecycleMode: true,
    durableStateMode: false,
    suppliedDataDir: "/caller/data"
  }),
  /mutates canonical sessions.*fresh harness-owned data directory/
);
const lifecycleEntityEvents = [
  { kind: "hub_frame", payload: { kind: "entity_snapshot", payload: { family: "session", records: [{ id: "session-a", lifecycle_class: "current" }] } } },
  { kind: "hub_frame", payload: { kind: "entity_patch", payload: { key: { family: "session", id: "session-a" }, record: { lifecycle_class: "ended" } } } },
  { kind: "hub_frame", payload: { kind: "entity_upsert", payload: { key: { family: "session", id: "session-b" }, record: { lifecycle_class: "current" } } } },
  { kind: "hub_frame", payload: { kind: "entity_remove", payload: { key: { family: "session", id: "session-b" } } } }
];
assert.deepEqual(convergeEntityFamily(lifecycleEntityEvents, "session").records, [
  { id: "session-a", lifecycle_class: "ended" }
]);
const literalLifecycleTree = {
  type: "section",
  children: [
    {
      $kind: "bind_list",
      source: "/session",
      where: { session_uuid: "session-a", lifecycle_class: "ended" },
      item_template: { type: "list_item", id: "workspace-session-a-ended" }
    },
    {
      $kind: "bind_list",
      source: "/session",
      where: { session_uuid: "session-missing" },
      item_template: { type: "text", id: "workspace-session-missing-present" },
      empty_template: { type: "list_item", id: "workspace-session-missing-unavailable" }
    }
  ]
};
assert.equal(classifyWorkspacesReference({
  uiTree: literalLifecycleTree,
  referenceId: "session-a",
  lifecycleClass: "ended",
  canonicalRecord: { session_uuid: "session-a", lifecycle_class: "ended" },
  renderedNodeIds: ["workspace-session-a-ended"]
}).outcome, "materialized");
assert.deepEqual(classifyWorkspacesReference({
  uiTree: literalLifecycleTree,
  referenceId: "session-missing",
  lifecycleClass: "unavailable",
  canonicalRecord: undefined,
  renderedNodeIds: ["workspace-session-missing-unavailable"]
}), {
  referenceId: "session-missing",
  lifecycleClass: "unavailable",
  outcome: "materialized",
  identityKind: "literal",
  identitySource: "workspace-session-missing-unavailable",
  resolvedValue: "workspace-session-missing-unavailable",
  branch: "empty",
  whereMatched: false,
  emptyTemplateIdentity: {
    kind: "literal",
    source: "workspace-session-missing-unavailable",
    resolvedValue: "workspace-session-missing-unavailable"
  },
  bindingSource: "/session",
  where: { session_uuid: "session-missing" }
});
assert.equal(classifyWorkspacesReference({
  uiTree: { $kind: "bind_list", source: "/session", where: { session_uuid: "session-empty", lifecycle_class: "current" }, item_template: { id: { $bind: "@/missing_identity" }, type: "list_item" } },
  referenceId: "session-empty",
  lifecycleClass: "current",
  canonicalRecord: { session_uuid: "session-empty", lifecycle_class: "current" },
  renderedNodeIds: []
}).outcome, "dropped-empty");
const collisionTree = {
  $kind: "bind_list",
  source: "/session",
  item_template: { id: { $bind: "@/shared_identity" }, type: "list_item" }
};
assert.equal(classifyWorkspacesReference({
  uiTree: collisionTree,
  referenceId: "session-collision",
  lifecycleClass: "current",
  canonicalRecord: { session_uuid: "session-collision", lifecycle_class: "current", shared_identity: "duplicate-row" },
  canonicalRecords: [
    { session_uuid: "session-collision", lifecycle_class: "current", shared_identity: "duplicate-row" },
    { session_uuid: "session-other", lifecycle_class: "current", shared_identity: "duplicate-row" }
  ],
  renderedNodeIds: []
}).outcome, "dropped-collision");
const mutuallyExclusiveBoundTree = {
  children: ["current", "ended"].map((lifecycleClass) => ({
    $kind: "bind_list",
    source: "/session",
    where: { session_uuid: "session-bound", lifecycle_class: lifecycleClass },
    item_template: { id: { $bind: "@/session_uuid" }, type: "list_item" }
  }))
};
assert.equal(classifyWorkspacesReference({
  uiTree: mutuallyExclusiveBoundTree,
  referenceId: "session-bound",
  lifecycleClass: "current",
  canonicalRecord: { session_uuid: "session-bound", lifecycle_class: "current" },
  renderedNodeIds: ["session-bound"]
}).outcome, "materialized");
assert.equal(classifyWorkspacesReference({
  uiTree: {
    $kind: "bind_list",
    source: "/session",
    where: { session_uuid: "session-authored", lifecycle_class: "ended" },
    item_template: { id: "session-authored-ended", type: "list_item" }
  },
  referenceId: "session-authored",
  lifecycleClass: "ended",
  canonicalRecord: { session_uuid: "session-authored", lifecycle_class: "current" },
  renderedNodeIds: []
}).outcome, "authored-not-materialized");
assert.equal(classifyWorkspacesReference({
  uiTree: {},
  referenceId: "session-not-authored",
  lifecycleClass: "current"
}).outcome, "not-authored");
const endedRegion = workspacesLifecycleRegion([
  { id: "row", text: "Unavailable current historical session label" },
  { id: "botster-workspaces-sessions-ended-workspace-a", text: "Anything at all" }
], "ended");
assert.deepEqual(endedRegion, {
  id: "botster-workspaces-sessions-ended-workspace-a",
  text: "Anything at all",
  lifecycleClasses: ["ended"]
});
assert.equal(workspacesLifecycleRegion([
  { id: "botster-workspaces-sessions-current-workspace-a", text: "Ended" }
], "ended"), null);
assert.equal(workspacesLifecycleRegion([
  { id: "ended-region", text: "Ended" }
], "ended"), null);
assert.equal(workspacesLifecycleRegion([
  { id: "botster-workspaces-session-ended-workspace-a", text: "Ended" }
], "ended"), null);
assert.equal(workspacesLifecycleRegion([
  {
    id: "botster-workspaces-sessions-current-workspace-a-sessions-ended-workspace-a",
    text: "Ended"
  }
], "ended"), null);
const lifecyclePartition = workspacesLifecyclePartitionExpectations({
  current: ["transition-1", "transition-2", "transition-3", "transition-4"],
  ended: [
    "stable-1", "stable-2", "stable-3", "stable-4",
    "remove-1", "remove-2", "remove-3", "remove-4"
  ],
  unavailable: ["missing-1", "missing-2", "missing-3", "missing-4"]
});
assert.equal(lifecyclePartition.expectations.length, 16);
assert.equal(lifecyclePartition.absentExpectations.length, 32);
assert.equal(Object.hasOwn(lifecyclePartition.expectations[0], "oracle"), false);
assert.equal(Object.hasOwn(lifecyclePartition.absentExpectations[0], "oracle"), false);
assert.deepEqual(
  lifecyclePartition.expectations.filter((entry) => entry.lifecycleClass === "current").map((entry) => entry.referenceId),
  ["transition-1", "transition-2", "transition-3", "transition-4"]
);
assert.throws(() => workspacesLifecyclePartitionExpectations({
  current: ["duplicate"],
  ended: ["duplicate"]
}), /belongs to both current and ended/);
const endedWithUnavailablePresentStack = {
  children: [
    {
      $kind: "bind_list",
      source: "/session",
      where: { session_uuid: "session-co-located", lifecycle_class: "ended" },
      item_template: { type: "list_item", id: "session-co-located-ended" }
    },
    {
      $kind: "bind_list",
      source: "/session",
      where: { session_uuid: "session-co-located" },
      item_template: { type: "stack", id: "session-co-located-present" },
      empty_template: { type: "list_item", id: "session-co-located-absent" }
    }
  ]
};
assert.equal(classifyWorkspacesReference({
  uiTree: endedWithUnavailablePresentStack,
  referenceId: "session-co-located",
  lifecycleClass: "ended",
  canonicalRecord: { session_uuid: "session-co-located", lifecycle_class: "ended" },
  renderedNodeIds: ["session-co-located-ended", "session-co-located-present"]
}).resolvedValue, "session-co-located-ended");
assert.deepEqual(workspacesLifecycleDomResult({
  visible: true,
  text: "Friendly session label",
  region: endedRegion,
  actions: [],
  branch: "empty"
}), { valid: true, reason: null });
assert.deepEqual(workspacesLifecycleDomResult({
  visible: true,
  text: "Friendly session label",
  region: endedRegion,
  actions: [],
  branch: "item"
}), { valid: false, reason: "no-contained-action" });
assert.deepEqual(workspacesLifecycleDomResult({
  visible: true,
  text: "Friendly session label",
  region: null,
  actions: [{ actionId: "open" }],
  branch: "item"
}), { valid: false, reason: "no-semantic-region" });
assert.equal(workspacesLifecycleDomResult({
  visible: false,
  text: "Friendly session label",
  region: endedRegion,
  actions: [{ actionId: "open" }],
  branch: "item"
}).reason, "not-visible");
assert.equal(workspacesLifecycleDomResult({
  visible: true,
  text: "",
  region: endedRegion,
  actions: [{ actionId: "open" }],
  branch: "item"
}).reason, "empty-text");
assert.equal(workspacesLifecycleDomResult({
  count: 0,
  visible: false,
  text: "",
  region: null,
  actions: [],
  branch: "item"
}).reason, "row-count");
assert.deepEqual(workspacesLifecycleMaterializationResult(
  { outcome: "materialized", resolvedValue: "ended-row" },
  { valid: false, reason: "no-semantic-region" }
), {
  outcome: "materialized-not-legible",
  identityOutcome: "materialized",
  resolvedValue: "ended-row",
  dom: { valid: false, reason: "no-semantic-region" }
});
assert.deepEqual(workspacesLifecycleAbsenceResult({
  currentResolvedValue: "shared-row",
  priorResolvedValue: "shared-row",
  renderedNodeIds: ["shared-row"],
  regions: [{ id: "shared-row", region: null }]
}), {
  valid: true,
  reason: null,
  currentResolvedValue: "shared-row",
  priorResolvedValue: "shared-row",
  priorOnlyId: null,
  priorOnlyRendered: false,
  regions: [{ id: "shared-row", region: null }]
});
assert.equal(workspacesLifecycleAbsenceResult({
  currentResolvedValue: "ended-row",
  priorResolvedValue: "current-row",
  renderedNodeIds: ["ended-row", "current-row"],
  regions: [{ id: "ended-row", region: null }]
}).reason, "prior-row-still-rendered");
assert.equal(workspacesLifecycleAbsenceResult({
  currentResolvedValue: "ended-row",
  priorResolvedValue: "current-row",
  renderedNodeIds: ["ended-row"],
  regions: [{ id: "ended-row", region: endedRegion }]
}).reason, "still-in-semantic-region");
const lifecycleFailure = formatWorkspacesLifecycleFailure({
  stage: "never-existing-reference",
  oracle: "unavailable",
  classifications: [{ outcome: "not-authored" }],
  uiTree: literalLifecycleTree,
  renderedRows: [],
  canonicalRecords: [],
  frameChronology: [],
  subscriptionId: "subscription-2",
  requestCounts: { plugin_surface_render: 1, list_sessions: 0 }
});
assert.match(lifecycleFailure, /stage=never-existing-reference oracle=unavailable/);
assert.match(lifecycleFailure, /not-authored/);
assert.match(lifecycleFailure, /delivered UiNode tree=/);
assert.deepEqual(reconnectGenerationEvidence([
  { kind: "daemon_request", payload: { type: "subscribe_entities", entity_type: "session", subscription_id: "subscription-1" } },
  { kind: "hub_frame", payload: { kind: "entity_snapshot", payload: { family: "session", records: [] } } },
  { kind: "daemon_request", payload: { type: "subscribe_entities", entity_type: "session", subscription_id: "subscription-2" } },
  { kind: "hub_frame", payload: { kind: "entity_snapshot", payload: { family: "session", records: [] } } }
]), {
  previousSubscriptionId: "subscription-1",
  subscriptionId: "subscription-2",
  fresh: true,
  authoritativeSnapshot: true
});
assert.deepEqual(reconnectGenerationEvidence([
  { kind: "daemon_request", payload: { type: "subscribe_entities", entity_type: "session", subscription_id: "subscription-2" } },
  { kind: "hub_frame", payload: { kind: "entity_snapshot", payload: { family: "session", records: [] } } }
], "subscription-1"), {
  previousSubscriptionId: "subscription-1",
  subscriptionId: "subscription-2",
  fresh: true,
  authoritativeSnapshot: true
});
const acceptedWorkspacesTree = { type: "panel", id: "accepted-workspaces-tree" };
const rejectedWorkspacesTree = { type: "panel", id: "rejected-workspaces-tree" };
assert.equal(latestAcceptedWorkspacesUiTree([
  {
    kind: "daemon_response",
    payload: {
      plugin_surface: {
        package_name: "botster-workspaces",
        surface_id: "workspaces",
        body: { type: "panel", id: "unvalidated-raw-body" }
      }
    }
  },
  {
    kind: "hub_frame",
    payload: {
      kind: "action_result",
      payload: {
        accepted: false,
        result: {
          package_name: "botster-workspaces",
          surface_id: "workspaces",
          plugin_action_result: { state: "rejected", replacement: rejectedWorkspacesTree }
        }
      }
    }
  }
]), null);
assert.equal(latestAcceptedWorkspacesUiTree([
  {
    kind: "daemon_response",
    payload: {
      plugin_surface: {
        package_name: "botster-workspaces",
        surface_id: "workspaces",
        ui_tree_snapshot: {
          package_name: "botster-workspaces",
          surface_id: "workspaces",
          body: acceptedWorkspacesTree
        }
      }
    }
  }
]), acceptedWorkspacesTree);
assert.equal(latestAcceptedWorkspacesUiTree([
  {
    kind: "hub_frame",
    payload: {
      kind: "action_result",
      payload: {
        accepted: true,
        result: {
          package_name: "botster-workspaces",
          surface_id: "workspaces",
          plugin_action_result: { state: "accepted", replacement: acceptedWorkspacesTree }
        }
      }
    }
  }
]), acceptedWorkspacesTree);
const durableSeedIds = durableSeedSessionIdsForDiagnosticsLimit(4);
assert.equal(durableSeedIds.length, 5);
assert.equal(durableSeedIds.length > 4, true);
assert.doesNotThrow(
  () => assertPackageReused({ install: false, enable: false, state: "enabled" }, "botster-web")
);
assert.throws(
  () => assertPackageReused({ install: true, enable: true, state: "absent" }, "botster-web"),
  /durable package state was not restored enabled/
);
assert.deepEqual(
  htmlAssetUrls(
    '<link rel="stylesheet" href="/assets/index-a.css"><script type="module" src="/assets/index-b.js"></script>'
  ),
  ["/assets/index-a.css", "/assets/index-b.js"]
);

const multiSessionSnapshot = {
  kind: "hub_frame",
  payload: {
    kind: "entity_snapshot",
    payload: {
      family: "session",
      records: [
        { id: "target", lifecycle: "exited" },
        { id: "other", lifecycle: "running" }
      ]
    }
  }
};
assert.equal(
  harnessEventMatches(multiSessionSnapshot, {
    kind: "hub_frame",
    family: "session",
    id: "target",
    lifecycle: "running"
  }),
  false
);
assert.equal(
  harnessEventMatches(multiSessionSnapshot, {
    kind: "hub_frame",
    family: "session",
    id: "other",
    lifecycle: "running"
  }),
  true
);
assert.equal(
  harnessEventMatches(
    {
      kind: "hub_frame",
      payload: {
        kind: "entity_snapshot",
        payload: { family: "session", records: [] }
      }
    },
    { kind: "hub_frame", family: "session" }
  ),
  true
);

const coreHubConnectionSchema = JSON.parse(
  await readFile(new URL("../fixtures/core-runnable-entrypoint-hub-connection/schema.json", import.meta.url), "utf8")
);
const coreHubConnectionFixture = JSON.parse(
  await readFile(new URL("../fixtures/core-runnable-entrypoint-hub-connection/unix-socket.json", import.meta.url), "utf8")
);
assert.equal(coreHubConnectionSchema.$id, "https://trybotster.dev/schemas/runnable-entrypoint-hub-connection.json");
assert.deepEqual(decodeHubConnection(JSON.stringify(coreHubConnectionFixture)), coreHubConnectionFixture);
for (const invalid of [
  undefined,
  "",
  "{",
  "{}",
  '{"transport":{"type":"unix_socket","path":"relative.sock"}}',
  '{"transport":{"type":"tcp","path":"/tmp/hub.sock"}}',
  '{"transport":{"type":"unix_socket","path":"/tmp/hub.sock","extra":true}}',
  '{"transport":{"type":"unix_socket","path":"/tmp/hub.sock"},"extra":true}'
]) {
  assert.throws(() => decodeHubConnection(invalid), HubConnectionError);
}

const [
  main,
  app,
  client,
  hubRuntimeSource,
  realHubDaemonDto,
  generatedDaemonProtocol,
  hubTransport,
  hubTerminalDataPlane,
  webrtcDaemonClient,
  connectionDiagnostics,
  connectionDiagnosticsPanel,
  localHubFirstScreen,
  protocol,
  entities,
  uiNodes,
  actions,
  terminal,
  resttyRenderer,
  terminalHost,
  terminalSmokeFixture,
  pluginSurfaces,
  packageManifestRaw,
  packageJsonRaw,
  pluginEntrypoint,
  checkDaemonProtocolDriftScript,
  localPackageServerScript,
  browserRuntimeSmokeScript,
  liveProtocolHarnessScript,
  workspacesSharedHubBrowserSmokeScript,
  architecture,
  readme,
  uiContractDeclarations,
  uiContractSchemaRaw,
  contractMatrixManifestRaw,
  css,
  variablesCss,
  vendorReadme
] = await Promise.all([
  readFile(new URL("./main.tsx", import.meta.url), "utf8"),
  readFile(new URL("./App.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/client.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/hubRuntime.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/realHubDaemonDto.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/generated/daemon-protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/hubTransport.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/hubTerminalDataPlane.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/webrtcDaemonClient.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/connectionDiagnostics.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/ConnectionDiagnosticsPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/LocalHubFirstScreen.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/entities.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/uiNodes.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminal.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/resttyRenderer.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/TerminalViewHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminalSmokeFixture.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/pluginSurfaces.ts", import.meta.url), "utf8"),
  readFile(new URL("../botster-package.json", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../plugin.lua", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-daemon-protocol-drift.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/local-package-server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/browser-runtime-smoke.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/live-packaged-protocol-harness.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/workspaces-shared-hub-browser-smoke.mjs", import.meta.url), "utf8"),
  readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../node_modules/@trybotster/ui-contract/index.d.ts", import.meta.url), "utf8"),
  readFile(new URL("../node_modules/@trybotster/ui-contract/schema.json", import.meta.url), "utf8"),
  readFile(new URL("../node_modules/@trybotster/hub-test-support/fixtures/plugin-contract-matrix/botster-package.json", import.meta.url), "utf8"),
  readFile(new URL("./theme/app.css", import.meta.url), "utf8"),
  readFile(new URL("./theme/variables.css", import.meta.url), "utf8"),
  readFile(new URL("./vendor/restty/README.md", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiNodeSurface \} from "\.\/botster\/UiNodeSurface"/);
assert.match(app, /IonToast/);
assert.match(app, /import \{ TerminalViewHost \} from "\.\/botster\/TerminalViewHost"/);
assert.match(app, /import \{ ConnectionDiagnosticsPanel \} from "\.\/botster\/ConnectionDiagnosticsPanel"/);
assert.match(app, /import \{ LocalHubFirstScreen/);
assert.match(app, /createBotsterWebClient/);
assert.match(app, /createHubRuntimeConfig/);
assert.match(app, /platform:\s*\{\s*desktop:/);
assert.match(app, /packageRuntime \? \{ signalingUrl: `\$\{window\.location\.origin\}\/request` \} : \{\}/);
assert.match(app, /__BOTSTER_PACKAGE_RUNTIME__/);
assert.match(app, /initialConnectionDiagnostics\([\s\S]*hubRuntime\.startupError/);
assert.match(app, /window\.addEventListener\(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle\)/);
assert.match(app, /runtimeClient\.hub\.subscribeSurface/);
assert.match(app, /runtimeClient\.entities\.pull/);
assert.match(app, /type AppRoute =/);
assert.match(app, /const appViewPaths: Record<AppView, string>/);
assert.match(app, /function appRouteFromPathname\(pathname: string\): AppRoute/);
assert.match(app, /normalizedPath\.startsWith\("\/packages\/"\)/);
assert.match(app, /routeKind === "surfaces"/);
assert.match(app, /routeKind === "settings"/);
assert.match(app, /function appRoutePath\(route: AppRoute\): string/);
assert.match(app, /function pushAppRouteUrl\(route: AppRoute\): void/);
assert.match(app, /navigateToHubRoutePath/);
assert.match(app, /botster-web\.package_navigation/);
assert.match(app, /openPackageNavigation/);
assert.doesNotMatch(app, /installedApps\.slice\(0, 5\)/);
assert.match(app, /window\.history\.pushState\(\{ botsterRoute: route \}/);
assert.match(app, /window\.addEventListener\("popstate", syncViewFromLocation\)/);
assert.match(app, /lastPluginRouteRenderKey/);
assert.match(app, /routePluginSurfaceDiagnostic/);
assert.match(app, /data-testid="plugin-settings-route"/);
assert.match(app, /IonModal/);
assert.match(app, /aria-label="Add package"/);
assert.match(app, /Marketplace registry file/);
assert.match(app, /Extension folder/);
assert.match(app, /Install from local files/);
assert.match(app, /registry_path: registryPath/);
assert.match(app, /request_type: "install_package_local_path"/);
assert.match(app, /packageActionFeedback\(result\)/);
assert.match(app, /setPackageActionToast\(packageFeedback\)/);
assert.match(app, /package_decision/);
assert.match(app, /install_plan/);
assert.match(app, /schemaVersionInformationFromFrame/);
assert.match(app, /operatorErrorDiagnostic/);
assert.match(app, /hubConnectionDiagnosticFromFrame/);
assert.match(app, /production\.diagnostic_action_status/);
assert.match(app, /production\.plugin_surface_status/);
assert.match(app, /plugin-surface-hub-validated-v1/);
assert.doesNotMatch(app, /plugin-surface-body-v1|normalizePluginSurfaceNode|pluginSurfaceBodySnapshot/);
assert.match(app, /terminalUnavailableDiagnostic/);
assert.match(app, /surfaceSnapshot \?\? loadingSnapshot/);
assert.match(app, /runtimeClient\.entities\.list\("botster-web\.app"\)/);
assert.match(app, /pullProductionEntity\("app", \{ family: "botster-web\.app" \}\)/);
assert.match(app, /window\.open\(localUrl, "_blank", "noopener,noreferrer"\)/);
assert.match(app, /export function AppListItem/);
assert.match(app, /export function PluginNavigationShortcuts/);
assert.match(app, /<PluginNavigationShortcuts\s+[\s\S]*entries=\{packageNavigationShortcuts\}[\s\S]*onOpen=\{openPackageNavigation\}/);
assert.doesNotMatch(app, /packageNavigation(?:Shortcuts)?\.slice\(0,\s*8\)/);
assert.match(app, /appSurfacePackages\.get\(stringValue\(app\.package_name, ""\)\)/);
assert.match(app, /packageAppSurfaces\(app\)/);
assert.match(app, /packageSettingsSurfaces\(app\)/);
assert.match(app, /navigateToPluginSurface\(packageName, surfaceId\)/);
assert.match(app, /runtimeClient\.actions\.dispatch\(\{ origin: "ui_node", action: routePluginLaunchAction \}\)/);
assert.match(app, /surfaceLaunchAction\(surface\)/);
assert.match(app, /const routePluginCanonicalSurfaceRecord = routePluginPackage && routePluginSurface && !routePluginRequestedSurfaceRecord/);
assert.match(app, /const routePluginSurfaceRecord = routePluginRequestedSurfaceRecord \?\? routePluginCanonicalSurfaceRecord/);
assert.match(app, /surfaceId: routePluginEffectiveSurfaceId \?\? routePluginSurface\.surfaceId/);
assert.doesNotMatch(app, /const packagesWithUi|const packagesWithoutUi/);
assert.match(app, /aria-label="Rendered app surface"/);
assert.match(app, /routePluginSurface \? \(\s*<PluginSurfaceRoutePage/);
assert.match(app, /const pluginAppRouteActive = activeView === "apps" && Boolean\(routePluginSurface\)/);
assert.doesNotMatch(app, /terminal-session-back|aria-label="Back to sessions"/);
assert.match(app, /aria-label="Back to Apps"/);
assert.doesNotMatch(app, /function pluginViewSurface/);
assert.doesNotMatch(app, /function pluginSettingsSurface/);
assert.doesNotMatch(app, /app\.view_surface(?!s)|app\.plugin_view_surface|app\.primary_surface|app\.ui_surface/);
assert.doesNotMatch(app, /app\.settings_surface(?!s)|app\.plugin_settings_surface/);
assert.doesNotMatch(app, /fixtureEntityFrames/);
assert.doesNotMatch(app, /uiNodeConformanceSnapshot/);
assert.doesNotMatch(app, /createInMemoryEntityFrameStore\(fixtureEntityFrames\)/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.doesNotMatch(app, /Ionic React renderer shell/);
assert.doesNotMatch(app, /<IonButton fill="solid" color="primary">\s*[\s\S]*Inspect frames/);
assert.doesNotMatch(app, /Inspect frames/);
assert.match(app, /<UiNodeSurface/);
assert.match(app, /<ConnectionDiagnosticsPanel/);
assert.match(app, /<LocalHubFirstScreen/);
assert.match(app, /data-testid="renderer-registry-workflow"/);
assert.match(app, /aria-label="Developer diagnostic details"/);
assert.doesNotMatch(app, /data-testid="terminal-workflow"/);
assert.doesNotMatch(app, /Selected app/);
assert.doesNotMatch(app, /selected-app-panel/);
assert.doesNotMatch(app, /<IonGrid className="workflow-overview"/);
assert.doesNotMatch(app, /<IonGrid className="dashboard-layout"/);
assert.doesNotMatch(app, /data-testid="active-workflows"/);
assert.match(app, /aria-label="Sessions"/);
assert.match(app, /<h1 id="dashboard-heading">Your sessions<\/h1>/);
assert.match(app, /sessions\.map/);
assert.doesNotMatch(app, /sessionsWithPending|session_draft|pendingSessionId/);
assert.match(app, /label: "Spawn points"/);
assert.doesNotMatch(app, /\{ label: "Hub settings", icon: cogOutline, view: "hub-settings" \}/);
assert.match(app, /className="nav-list sidebar-advanced"/);
assert.match(app, /<IonFooter className="app-sidebar-footer">/);
assert.match(app, /<span>Hub settings<\/span>/);
assert.doesNotMatch(app, /toolbar-status/);
assert.match(app, /<h1 id="hub-settings-heading">Hub settings<\/h1>/);
assert.match(app, /<h2 id="spawn-points-heading">Spawn points<\/h2>/);
assert.match(app, /data-testid="session-types-view"/);
assert.match(app, /data-testid="extension-settings-view"/);
assert.match(app, /data-testid="hub-settings-general"/);
assert.match(app, /aria-label="Installed extensions"/);
assert.match(app, /Check for updates/);
assert.doesNotMatch(app, /data-testid="hub-updates-view"/);
assert.doesNotMatch(app, />Diagnostics<\/span>/);
assert.doesNotMatch(app, /Hub configuration summary|Hub setup shortcuts/);
assert.match(app, /label="Spawn point name"/);
assert.doesNotMatch(app, /(?:Add|Edit|Delete|View) workspace/);
assert.match(app, /<IonLabel>Installed<\/IonLabel>/);
assert.doesNotMatch(app, /<IonLabel>Installed apps<\/IonLabel>/);
assert.doesNotMatch(app, /<IonLabel>Available marketplace packages<\/IonLabel>/);
assert.doesNotMatch(app, /<IonLabel>Installed packages<\/IonLabel>/);
assert.match(liveProtocolHarnessScript, /HOST_CHROME\.installedListLabel/);
assert.doesNotMatch(liveProtocolHarnessScript, /\[aria-label='Installed apps'\]/);
assert.doesNotMatch(liveProtocolHarnessScript, /\[aria-label='Installed packages'\]/);
assert.match(localPackageServerScript, /function isSpaRoutePath\(pathname\)/);
assert.match(localPackageServerScript, /pathname\.startsWith\("\/packages\/"\)/);
assert.match(localPackageServerScript, /pathname\.startsWith\("\/sessions\/"\)/);
assert.match(app, /onAction=\{dispatchAction\}/);
assert.doesNotMatch(app, /selectedRealHubTerminalSessionId|attachedRealHubTerminalSessionId/);
assert.match(app, /isAttachableSession/);
assert.match(app, /hubRuntime\.createTerminalDataPlane\(terminalDescriptor\.sessionId\)/);
assert.match(app, /descriptor=\{terminalDescriptor\}/);
assert.match(app, /dataPlane=\{terminalDataPlane\}/);
assert.match(app, /onAttachmentStatus=\{recordTerminalAttachmentStatus\}/);
assert.match(app, /onExit=\{releaseTerminalSession\}/);
assert.match(app, /onDiagnostic=\{recordTerminalDiagnostic\}/);
assert.doesNotMatch(app, /terminal-placeholder/);
assert.match(client, /export const botsterWebClientContract/);
assert.match(client, /createBotsterWebClient/);
assert.match(client, /InMemoryUiTreeSnapshotStore/);
assert.match(client, /frame\.kind === "ui_tree_snapshot"/);
assert.match(client, /"terminal_view bridge"/);
assert.doesNotMatch(hubRuntimeSource, /fixture|MockTerminalDataPlane/);
assert.match(hubRuntimeSource, /createHubTransport/);
assert.match(hubRuntimeSource, /createHubTerminalDataPlane/);
assert.match(hubRuntimeSource, /requires a valid local WebRTC bootstrap grant/);
assert.doesNotMatch(hubRuntimeSource, /real-hub|createHttpDaemonBridgeClient|VITE_BOTSTER_HUB/);
assert.match(realHubDaemonDto, /export type \* from "\.\/generated\/daemon-protocol"/);
assert.match(realHubDaemonDto, /DaemonBridgeRequestEnvelope/);
assert.match(realHubDaemonDto, /DaemonBridgeResponseEnvelope/);
assert.doesNotMatch(realHubDaemonDto, /export type DaemonRequest\s*=/);
assert.doesNotMatch(realHubDaemonDto, /export interface DaemonResponse\s*\{/);
assert.doesNotMatch(realHubDaemonDto, /export interface DaemonPackage\s*\{/);
assert.doesNotMatch(realHubDaemonDto, /export type DaemonEvent\s*=/);
assert.match(generatedDaemonProtocol, /Generated from crates\/botster-hub-client Rust serde DTOs/);
assert.match(generatedDaemonProtocol, /\| \{ type: "read_mode_flags"; session_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_apps" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_package_navigation" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_packages" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_available_packages"; registry_path: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "install_package_registry_entry"; registry_path: string; entry_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "set_package_configuration"; package_name: string; values: Record<string, JsonValue> \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "install_package_local_path"; path: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "enable_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "disable_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "remove_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "start_package_entrypoint"; package_name: string; entrypoint_id: string; environment_overrides\?: Record<string, string> \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "stop_package_entrypoint"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "restart_package_entrypoint"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "package_entrypoint_status"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "plugin_surface_render"; package_name: string; surface_id: string; payload: JsonValue \}/);
assert.match(generatedDaemonProtocol, /import type \{ PackageSurfaceDescriptor, UiActionRequest, UiActionResult, UiNode \} from "@trybotster\/ui-contract"/);
assert.doesNotMatch(generatedDaemonProtocol, /DaemonPackageSurfaceDescriptor/);
assert.match(
  hubTransport,
  /import type \{\s*PackageSurfaceDescriptor,\s*PackageSurfaceKind,\s*PackageSurfaceOperation\s*\} from "@trybotster\/ui-contract"/
);
assert.doesNotMatch(hubTransport, /DaemonPackageSurfaceDescriptor/);
assert.match(generatedDaemonProtocol, /\| \{ type: "plugin_surface_action"; package_name: string; request: UiActionRequest \}/);
assert.doesNotMatch(app, /action\.id === "contract\.action"/);
assert.doesNotMatch(hubTransport, /action\.id === "contract\.action"/);
assert.doesNotMatch(hubTransport, /botster\.plugin-contract-matrix|surface_id:\s*"contract\.app"/);
assert.match(hubTransport, /pluginSurfaceActionRequest\(action, request\.request_id\)/);
assert.match(hubTransport, /package_name:\s*pluginSurfaceAction\.packageName/);
assert.match(hubTransport, /request:\s*pluginSurfaceAction\.request/);
assert.match(liveProtocolHarnessScript, /waitForContractActionResult/);
assert.match(liveProtocolHarnessScript, /waitForVisibleContractMatrixText/);
assert.doesNotMatch(liveProtocolHarnessScript, /accepted\|accepted/i);
assert.doesNotMatch(liveProtocolHarnessScript, /operator\/i/);
assert.doesNotMatch(liveProtocolHarnessScript, /Rejected contract\\.action\|error/i);
assert.match(generatedDaemonProtocol, /plugin_surface\?: DaemonPluginSurface \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonPluginSurface/);
assert.match(generatedDaemonProtocol, /body: UiNode;/);
assert.match(generatedDaemonProtocol, /ui_tree_snapshot\?: DaemonUiTreeSnapshot \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonUiTreeSnapshot/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackage/);
assert.match(generatedDaemonProtocol, /apps\?: DaemonApp\[\];/);
assert.match(generatedDaemonProtocol, /package_navigation\?: DaemonPackageNavigationEntry\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonApp/);
assert.match(generatedDaemonProtocol, /export interface DaemonAppLaunchTarget/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageNavigationEntry/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageNavigationSource/);
assert.match(generatedDaemonProtocol, /local_url\?: string \| null;/);
assert.match(generatedDaemonProtocol, /package_name: string/);
assert.match(generatedDaemonProtocol, /requested_capabilities: DaemonCapability\[\]/);
assert.match(generatedDaemonProtocol, /runnable_entrypoints: DaemonPackageRunnableEntrypoint\[\]/);
assert.match(generatedDaemonProtocol, /configuration: DaemonPackageConfiguration;/);
assert.match(generatedDaemonProtocol, /actions\?: DaemonPackageActionState\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageActionState/);
assert.match(generatedDaemonProtocol, /request\?: DaemonPackageActionRequest \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageConfiguration/);
assert.match(generatedDaemonProtocol, /schema\?: JsonValue \| null;/);
assert.match(generatedDaemonProtocol, /effective_values\?: Record<string, JsonValue>;/);
assert.match(generatedDaemonProtocol, /missing_required\?: string\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageProcess/);
assert.match(generatedDaemonProtocol, /pid\?: number;/);
assert.match(generatedDaemonProtocol, /diagnostics\?: DaemonDiagnostic\[\]/);
assert.match(generatedDaemonProtocol, /mode_flags\?: DaemonModeFlags \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonModeFlags/);
assert.match(generatedDaemonProtocol, /mouse_mode: number;/);
assert.match(generatedDaemonProtocol, /\| "read_mode_flags"/);
assert.match(generatedDaemonProtocol, /export type DaemonEvent/);
assert.match(generatedDaemonProtocol, /\| \{ type: "snapshot"; session_id: string; subscription_id: string; payload_base64: string; payload_encoding: "base64"; bytes: number \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "scrollback"; session_id: string; subscription_id: string; payload_base64: string; payload_encoding: "base64"; bytes: number \}/);
assert.doesNotMatch(generatedDaemonProtocol, /type: "(?:snapshot|scrollback)"[^\n]*data: string/);
assert.doesNotMatch(realHubDaemonDto, /compressed\?: boolean|encoding\?: string/);
assert.doesNotMatch(hubTransport, /createHttpDaemonBridgeClient|EventSource|fetchImpl/);
assert.match(hubTransport, /subscribeEvents/);
assert.match(hubTransport, /daemonEventSubscription/);
assert.match(hubTransport, /recordLiveHarnessEvent\("hub_frame"/);
assert.match(hubTransport, /recordLiveHarnessEvent\("daemon_response", response\)/);
assert.match(hubTransport, /daemonResponseFrames/);
assert.doesNotMatch(hubTransport, /ui_tree_snapshot/);
// Session types are a canonical bare family delivered by a held subscription. No
// botster-web.* pull family, no list request, and no name-derived title may survive in
// the production transport. This assertion names the tokens it proves absent, which is
// why it is scoped to production source rather than the whole repository.
assert.match(hubTransport, /const sessionTypeFamily = "session_type"/);
assert.match(hubTransport, /ensureSessionTypeEntitySubscription/);
assert.match(hubTransport, /bridge\.subscribeEntityFrames\(sessionTypeFamily/);
assert.doesNotMatch(hubTransport, /botster-web\.session_template|botster-web\.session_type/);
// Management catalog stays subscription-only. Bare list_session_types is banned; target-scoped
// list_session_types_for_target is the New session picker authority.
assert.doesNotMatch(hubTransport, /list_session_templates/);
assert.doesNotMatch(hubTransport, /type: "list_session_types"/);
assert.match(hubTransport, /type: "list_session_types_for_target"/);
assert.match(hubTransport, /requestType === "list_session_types_for_target"/);
assert.match(hubTransport, /session_types: response\.session_types/);
assert.doesNotMatch(hubTransport, /humanizeIdentifier|sessionTemplateRecord/);
assert.doesNotMatch(hubTransport, /"session_templates"/);
assert.match(hubTransport, /type: "spawn_session_type"/);
assert.match(hubTransport, /botster\.session_type\.daemon_request/);
// Assert the CONSTRUCTED requests, not the tokens: an alternation over bare tokens is
// satisfied by explanatory prose and would stay green with every branch deleted.
assert.match(hubTransport, /type: "create_session_type"/);
assert.match(hubTransport, /type: "delete_session_type"/);
// Edit control is live: transport constructs show (authoring read) and update requests.
assert.match(hubTransport, /type: "show_session_type_definition"/);
assert.match(hubTransport, /type: "update_session_type"/);
assert.match(hubTransport, /requestType === "update_session_type"/);
assert.match(hubTransport, /requestType === "show_session_type_definition"/);
assert.match(hubTransport, /session_type_definition: response\.session_type_definition/);
assert.doesNotMatch(app, /botster-web\.session_template|list_session_templates/);
assert.doesNotMatch(app, /type: "list_session_types"/);
assert.doesNotMatch(app, /sessionTypesForSpawnTarget/);
assert.match(app, /list_session_types_for_target/);
assert.match(app, /listSessionTypesForTargetAction|applySpawnSessionListResult/);
assert.match(app, /runtimeClient\.entities\.list\("session_type"\)/);
assert.match(hubTransport, /const packageFamily = "botster-web\.package"/);
assert.match(hubTransport, /const appFamily = "botster-web\.app"/);
assert.match(hubTransport, /const packageNavigationFamily = "botster-web\.package_navigation"/);
assert.match(hubTransport, /bridge\.request\(\{ type: "list_apps" \}\)/);
assert.match(hubTransport, /bridge\.request\(\{ type: "list_package_navigation" \}\)/);
assert.match(hubTransport, /const availablePackageFamily = "botster-web\.available_package"/);
assert.match(hubTransport, /bridge\.request\(\{ type: "list_packages" \}\)/);
assert.match(hubTransport, /type: "list_available_packages"/);
assert.match(hubTransport, /type: "set_package_configuration"/);
assert.match(hubTransport, /botster\.package\.configuration\.save/);
assert.match(hubTransport, /botster\.package\.configure/);
assert.match(hubTransport, /botster\.package\.surface\.render/);
assert.match(hubTransport, /type: "plugin_surface_render"/);
assert.match(hubTransport, /DaemonPackageActionState/);
assert.match(hubTransport, /function appRecord\(app: DaemonApp\)/);
assert.match(hubTransport, /family: appFamily/);
assert.match(hubTransport, /id: "botster\.app\.open_url"/);
assert.match(hubTransport, /botster\.package\.daemon_request/);
assert.match(hubTransport, /package_decision: response\.package_decision/);
assert.match(hubTransport, /install_plan: response\.install_plan/);
assert.match(hubTransport, /diagnostics: responseDiagnostics\(response\)/);
assert.match(hubTransport, /daemonRequestFromDescriptor/);
assert.match(hubTransport, /type: "enable_package"/);
assert.match(hubTransport, /type: "disable_package"/);
assert.match(hubTransport, /type: "remove_package"/);
assert.match(hubTransport, /type: "reload_package"/);
assert.match(hubTransport, /type: "start_package_entrypoint"/);
assert.match(hubTransport, /type: "stop_package_entrypoint"/);
assert.match(hubTransport, /type: "restart_package_entrypoint"/);
assert.match(hubTransport, /type: "package_entrypoint_status"/);
assert.doesNotMatch(hubTransport, /function packageManagementRequest|function packageEntrypointRequest|unsupportedPackageAction/);
assert.match(hubTransport, /family: packageFamily/);
assert.match(hubTransport, /family: availablePackageFamily/);
assert.doesNotMatch(hubTransport, /["']view_surface["']|["']settings_surface["']|UpdatePackage|update_package|type: "restart_hub"/);
assert.match(hubTerminalDataPlane, /streamTerminal/);
assert.match(hubTerminalDataPlane, /type: "send_input"/);
assert.match(hubTerminalDataPlane, /recordLiveHarnessTerminal\("input"/);
assert.match(hubTerminalDataPlane, /recordLiveHarnessTerminal\("resize"/);
assert.match(hubTerminalDataPlane, /this\.emitOutput\(event\.data, "output"\)/);
assert.match(hubTerminalDataPlane, /type: "read_screen"/);
assert.match(hubTerminalDataPlane, /this\.emitOutput\(readScreen\.text, "read_screen"\)/);
assert.match(hubTerminalDataPlane, /bufferHydratingOutput/);
assert.doesNotMatch(hubTerminalDataPlane, /event\.data, event\.type|restoredHistory|scrollback_unavailable/);
assert.match(hubTerminalDataPlane, /recordLiveHarnessTerminal\("attach_state"/);
assert.match(hubTerminalDataPlane, /type: "detach"/);
assert.match(hubTerminalDataPlane, /attachToAuthoritativeSession/);
assert.doesNotMatch(hubTerminalDataPlane, /type: "list_sessions"/);
assert.match(hubTerminalDataPlane, /this\.listeners\.size === 0/);
assert.doesNotMatch(connectionDiagnostics, /expectedDaemonSchemaVersion/);
assert.match(connectionDiagnostics, /schemaVersionInformationFromFrame/);
assert.match(connectionDiagnostics, /operatorErrorDiagnostic/);
assert.match(connectionDiagnostics, /terminalUnavailableDiagnostic/);
assert.match(connectionDiagnosticsPanel, /data-diagnostic-id/);
assert.match(connectionDiagnosticsPanel, /severityRank/);
assert.match(connectionDiagnosticsPanel, /severityLabel/);
assert.match(localHubFirstScreen, /Local Botster health/);
assert.match(localHubFirstScreen, /packageLoadStatus/);
assert.match(localHubFirstScreen, /sessionLoadStatus/);
assert.doesNotMatch(localHubFirstScreen, /activeHubSessionId/);
assert.match(localPackageServerScript, /protocol = "botster-hub-daemon-v1"/);
assert.match(localPackageServerScript, /decodeHubConnection/);
assert.match(localPackageServerScript, /serveStaticUi/);
assert.match(localPackageServerScript, /__BOTSTER_PACKAGE_RUNTIME__/);
assert.match(localPackageServerScript, /case "\.mjs":/);
assert.match(localPackageServerScript, /case "\.map":/);
assert.match(localPackageServerScript, /kind: "daemon_response"/);
assert.match(localPackageServerScript, /signalingRequestTypes/);
assert.match(localPackageServerScript, /issue_local_webrtc_bootstrap/);
assert.match(localPackageServerScript, /local_webrtc_signal/);
assert.doesNotMatch(localPackageServerScript, /text\/event-stream|EventSource|\/terminal|sendSseEvent|deterministicBotsterWebSurfaceResponse/);
assert.match(browserRuntimeSmokeScript, /proveMissingBootstrapDiagnostic/);
assert.match(browserRuntimeSmokeScript, /Local WebRTC bootstrap failed/);
assert.match(liveProtocolHarnessScript, /BOTSTER_HUB_BIN/);
assert.match(liveProtocolHarnessScript, /BOTSTER_SESSION_WORKER_BIN/);
assert.match(liveProtocolHarnessScript, /chromium\.launch/);
assert.match(liveProtocolHarnessScript, /__BOTSTER_LIVE_PROTOCOL_HARNESS__/);
assert.match(liveProtocolHarnessScript, /loadProductionAppRouteFromPathname/);
assert.doesNotMatch(liveProtocolHarnessScript, /diagnosticsEntityRecordLimit = 4/);
assert.match(liveProtocolHarnessScript, /appRouteFromPathname\(routeDescriptor\.routePath\)/);
assert.doesNotMatch(liveProtocolHarnessScript, /\.surfaces \?\? [^;]*app_surfaces/);
assert.match(liveProtocolHarnessScript, /const daemonPackages = \[\]/);
assert.match(liveProtocolHarnessScript, /const projectedPackages = \[\]/);
assert.match(liveProtocolHarnessScript, /daemonPackage\?\.surfaces/);
assert.match(liveProtocolHarnessScript, /projectedPackage\?\.app_surfaces/);
const pluginSurfaceRouteDescriptorSource = liveProtocolHarnessScript.slice(
  liveProtocolHarnessScript.indexOf("async function pluginSurfaceRouteDescriptor"),
  liveProtocolHarnessScript.indexOf("async function loadProductionAppRouteFromPathname")
);
assert.match(pluginSurfaceRouteDescriptorSource, /daemonPackages\.find\(\(record\) => record\.package_name === packageName\)/);
assert.match(pluginSurfaceRouteDescriptorSource, /projectedPackages\.find\(\(record\) => record\.id === packageName\)/);
assert.match(pluginSurfaceRouteDescriptorSource, /const surfaces = projectedPackage\?\.app_surfaces \?\? \[\]/);
assert.doesNotMatch(pluginSurfaceRouteDescriptorSource, /package_name \?\? record\.name \?\? record\.id/);
assert.match(liveProtocolHarnessScript, /events\.slice\(sinceIndex\)\.some/);
assert.match(liveProtocolHarnessScript, /openContractAppFromNavigation/);
assert.match(liveProtocolHarnessScript, /getByLabel\("Admitted plugin navigation"\)/);
assert.match(liveProtocolHarnessScript, /proveLiveTerminalAfterAttach/);
assert.match(liveProtocolHarnessScript, /const echoProbe = "keys"/);
assert.match(liveProtocolHarnessScript, /const attachProbe = "botster-web-production-attach-probe"/);
assert.match(liveProtocolHarnessScript, /\$\{attachProbe\}-/);
assert.match(liveProtocolHarnessScript, /sequence: initialEvents\.map/);
assert.doesNotMatch(liveProtocolHarnessScript, /unwrappedReadScreenText|replace\(\/\[\\r\\n\]\//);
assert.match(liveProtocolHarnessScript, /package_version: packageVersion/);
assert.doesNotMatch(webrtcDaemonClient, /terminal_stream_batch/);
assert.match(webrtcDaemonClient, /terminal_stream_error/);
assert.match(liveProtocolHarnessScript, /page\.reload/);
assert.match(liveProtocolHarnessScript, /navigatePackageRuntimeAndAssertWebrtc/);
assert.match(liveProtocolHarnessScript, /assertContractSurfaceRouteReconnect/);
assert.match(liveProtocolHarnessScript, /renderCount !== 1/);
assert.match(liveProtocolHarnessScript, /workspaces lifecycle selected route reconnect/);
assert.doesNotMatch(liveProtocolHarnessScript, /reloadSamePackageUrlAndAssertWebrtc/);
assert.doesNotMatch(liveProtocolHarnessScript, /navigatePackageRuntimeAndAssertWebrtc\(page, "workspaces-lifecycle"/);
assert.match(liveProtocolHarnessScript, /latestLocalWebrtcGrantId/);
assert.doesNotMatch(liveProtocolHarnessScript, /type: "stop_package_entrypoint"/);
assert.doesNotMatch(liveProtocolHarnessScript, /startSessionButton|observeStartSessionButtonTransitions|Start session button/);
assert.match(liveProtocolHarnessScript, /proveExternalSessionLifecycle/);
assert.match(liveProtocolHarnessScript, /waitForRunningSessionFrame\(page\)/);
assert.match(liveProtocolHarnessScript, /waitForAutomaticTerminalRestore/);
assert.match(liveProtocolHarnessScript, /assertCurrentHubCompatibilityAndSchema/);
assert.match(liveProtocolHarnessScript, /assertCurrentHubSchemaPresentation/);
assert.match(liveProtocolHarnessScript, /status\.schema_version < 3/);
assert.match(liveProtocolHarnessScript, /protocolVersion < 6/);
assert.match(liveProtocolHarnessScript, /revision < 31/);
// Shared detach decision + constants — no residual none-placeholder oracle.
assert.match(liveProtocolHarnessScript, /isTerminalDetached/);
assert.match(liveProtocolHarnessScript, /HOST_CHROME/);
assert.match(liveProtocolHarnessScript, /waitForTerminalDetached\(page, productionSessionId\)/);
assert.doesNotMatch(liveProtocolHarnessScript, /data-terminal-session-id=['"]none['"]/);
assert.equal(HOST_CHROME.schemaFloorSourcePin, "status.schema_version < 3");
assert.match(liveProtocolHarnessScript, new RegExp(HOST_CHROME.schemaFloorSourcePin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
// The live harness owns the authoritative-identity and real update-check DOM proof; the
// bridge-less browser smoke owns the no-Hub and offline rendering.
assert.match(liveProtocolHarnessScript, /assertAuthoritativeHubIdentity/);
assert.match(liveProtocolHarnessScript, /assertHubUpdateCheck/);
assert.match(liveProtocolHarnessScript, /assertHubUpdateSupportDiagnostics/);
assert.match(liveProtocolHarnessScript, /requiredProvenanceField\(software, "product_name"/);
assert.match(liveProtocolHarnessScript, /data-hub-update-state/);
// Reconnect is proven on a surviving document, not by a reload that remounts App.
assert.match(liveProtocolHarnessScript, /proveInPageReconnectReplaysHubStatus/);
assert.match(liveProtocolHarnessScript, /transportControl\?\.closeDataChannel/);
assert.match(liveProtocolHarnessScript, /__BOTSTER_RECONNECT_DOCUMENT_SENTINEL__/);
assert.match(webrtcDaemonClient, /closeDataChannelForLiveHarness/);
assert.match(webrtcDaemonClient, /installLiveHarnessTransportControl/);
assert.match(browserRuntimeSmokeScript, /proveHubGeneralWithoutHub/);
assert.match(browserRuntimeSmokeScript, /Update check failed/);
assert.doesNotMatch(browserRuntimeSmokeScript, /check_hub_update/);
// The shared-Hub fixture must write the file the authoritative Hub actually reads
// (.botster/session-types.json / session_types) with the fields PackageSessionType
// requires. The former session-templates.json contributed no session type at all, so the
// admitted repo exposed nothing for the Workspaces/Web spawn path to select.
assert.match(workspacesSharedHubBrowserSmokeScript, /"\.botster", "session-types\.json"/);
assert.match(workspacesSharedHubBrowserSmokeScript, /session_types: \[/);
assert.doesNotMatch(workspacesSharedHubBrowserSmokeScript, /session-templates\.json|session_templates:/);
for (const requiredField of ["id", "label", "role", "interaction", "lifecycle", "command"]) {
  assert.match(workspacesSharedHubBrowserSmokeScript, new RegExp(`${requiredField}: "`));
}
// The Workspaces plugin still owns the assignment vocabulary; that seam is preserved.
// Hub qualifies effective session-type ids as `<source name>/<id>` and a repo source's
// name is the spawn target id, so the value the driver selects must be the qualified
// `shared-git/shared-browser` the plugin renders — not the bare authored id.
assert.match(workspacesSharedHubBrowserSmokeScript, /session_type_id: "shared-git\/shared-browser"/);
assert.doesNotMatch(workspacesSharedHubBrowserSmokeScript, /template_id/);
// The qualified value must be observed among the rendered options before injection, and
// the submit request must be captured by identity rather than admitted by matching the
// expected values map, or the session_type_id assertion cannot fail against live output.
assert.match(liveProtocolHarnessScript, /readUiNodeSelectOptionValues/);
assert.match(liveProtocolHarnessScript, /is not among the /);
assert.match(liveProtocolHarnessScript, /assertSharedHubSpawnSubmission/);

// Session-type live stage: held subscription, no legacy list hydration, Hub-owned CRUD.
assert.match(liveProtocolHarnessScript, /exerciseSessionTypes/);
assert.match(liveProtocolHarnessScript, /assertNoSessionTypeListHydration/);
assert.match(liveProtocolHarnessScript, /entity_type: "session_type"/);
assert.match(liveProtocolHarnessScript, /type: "create_session_type"/);
assert.match(liveProtocolHarnessScript, /type: "update_session_type"/);
assert.match(liveProtocolHarnessScript, /type: "delete_session_type"/);
assert.match(liveProtocolHarnessScript, /Info \/ server/);
assert.match(liveProtocolHarnessScript, /waitForTerminalRendererWrite/);
assert.match(liveProtocolHarnessScript, /waitForTerminalCanvas/);
assert.match(liveProtocolHarnessScript, /waitForDaemonRequestCount/);
assert.match(liveProtocolHarnessScript, /waitForTerminalSession/);
assert.match(liveProtocolHarnessScript, /type: "send_input"/);
assert.match(liveProtocolHarnessScript, /typeThroughMountedTerminal\(page, `\$\{echoProbe\}\\n`\)/);
assert.match(liveProtocolHarnessScript, /callTerminalControl\(page, "focus"\)/);
assert.match(liveProtocolHarnessScript, /page\.waitForTimeout\(100\)/);
assert.match(liveProtocolHarnessScript, /page\.keyboard\.insertText\(data\)/);
assert.doesNotMatch(liveProtocolHarnessScript, /callTerminalControl\(page, "writeInput", `\$\{echoProbe\}\\n`\)/);
assert.match(liveProtocolHarnessScript, /key === "grant_secret" && nextValue !== "\[redacted\]"/);
assert.match(liveProtocolHarnessScript, /waitForTerminalAttachState\(page, \["attached"\]\)/);
assert.match(liveProtocolHarnessScript, /waitForTerminalDetached/);
assert.match(liveProtocolHarnessScript, /botster-web-production-echo:/);
assert.match(liveProtocolHarnessScript, /botster-web-production-size:/);
assert.match(liveProtocolHarnessScript, /waitForResizeProof/);
assert.match(liveProtocolHarnessScript, /assertNoUnknownSession/);
assert.match(liveProtocolHarnessScript, /last observed/);
assert.match(liveProtocolHarnessScript, /botster-web-production-exiting/);
assert.match(liveProtocolHarnessScript, /proveExternalSessionLifecycle/);
assert.match(liveProtocolHarnessScript, /entity_remove/);
assert.match(liveProtocolHarnessScript, /waitForSessionStatus/);
assert.match(liveProtocolHarnessScript, /hub_frame/);
assert.match(liveProtocolHarnessScript, /family: "session"/);
assert.doesNotMatch(liveProtocolHarnessScript, /family: "botster-web\.session"/);
assert.match(liveProtocolHarnessScript, /runHubCommand\(\["shutdown"/);
assert.match(liveProtocolHarnessScript, /assertNoBrowserFailures/);
assert.match(liveProtocolHarnessScript, /browserFailureSummary/);
assert.match(protocol, /type HubControlFrameKind/);
assert.match(protocol, /"action_request"/);
assert.match(protocol, /"ui_tree_snapshot"/);
assert.match(protocol, /"entity_snapshot"/);
assert.match(entities, /class InMemoryEntityFrameStore/);
assert.match(entities, /createInMemoryEntityFrameStore/);
assert.match(entities, /replayActivePulls/);
assert.match(
  uiNodes,
  /render\(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options\?: UiNodeRenderOptions\)/
);
assert.match(actions, /class CorrelatedActionDispatcher/);
assert.match(actions, /botster\.session\.select/);
assert.doesNotMatch(actions, /click|submit|change/);
assert.match(uiNodes, /dispatchAction\?: \(dispatch: UiNodeActionDispatch\) => void/);
assert.doesNotMatch(uiNodes, /export interface UiNode\s*\{/);
assert.doesNotMatch(actions, /export interface UiActionRequest\s*\{|export interface UiActionResult\s*\{/);
assert.doesNotMatch(app, /dangerouslySetInnerHTML|srcDoc/);
assert.doesNotMatch(client, /dangerouslySetInnerHTML|srcDoc/);
assert.doesNotMatch(hubTransport, /dangerouslySetInnerHTML|srcDoc/);
assert.match(terminal, /renderer: "restty"/);
assert.match(terminal, /class DefaultTerminalViewBridge/);
assert.match(terminal, /TerminalViewMount/);
assert.match(terminal, /attach\(/);
assert.match(terminal, /detach\(/);
assert.match(terminal, /state\.dataPlane === dataPlane/);
assert.match(terminal, /renderer\.attachDataPlane/);
assert.match(terminal, /renderer_write/);
assert.match(terminal, /terminalLastRenderedOutput/);
assert.match(terminal, /writeInput\(/);
assert.match(terminal, /subscribeOutput/);
assert.match(terminal, /renderer\.destroy\(\)/);
assert.match(resttyRenderer, /from "\.\.\/vendor\/restty\/internal\.js"/);
assert.doesNotMatch(resttyRenderer, /vendor\/restty\/xterm\.js/);
assert.match(resttyRenderer, /new Restty/);
assert.match(resttyRenderer, /createInitialPane:\s*\{\s*focus:\s*false\s*\}/);
assert.match(resttyRenderer, /fontSources: botsterResttyFontSources/);
assert.match(resttyRenderer, /ptyTransport: this\.ptyTransport/);
assert.match(resttyRenderer, /connectPty\(\)/);
assert.doesNotMatch(resttyRenderer, /connectPty\(dataPlane\.sessionId\)/);
assert.match(resttyRenderer, /dataPlane\.resize\(rows, cols\)/);
assert.doesNotMatch(resttyRenderer, /fontPreset:\s*"none"/);
assert.doesNotMatch(resttyRenderer, /terminalRendererInput/);
assert.doesNotMatch(resttyRenderer, /sendInput\(data, "key"\)/);
assert.match(resttyRenderer, /this\.terminal\?\.destroy\(\)/);
assert.doesNotMatch(terminalHost, /ResizeObserver/);
assert.doesNotMatch(terminalHost, /requestAnimationFrame/);
assert.doesNotMatch(terminalHost, /cancelAnimationFrame/);
assert.match(terminalHost, /data-terminal-attach-state/);
assert.match(terminalHost, /subscribeStatus/);
assert.match(terminalHost, /status\.state === "exited"/);
assert.match(terminalHost, /onExitRef\.current\?\.\(descriptor\.sessionId\)/);
assert.match(terminalHost, /onAttachmentStatusRef\.current\?\.\(descriptor\.sessionId, status\)/);
assert.match(terminalHost, /bridge\.attach/);
assert.match(terminalHost, /focus: \(\) => bridge\.focus\(descriptor\)/);
assert.match(terminalHost, /bridge\.unmount/);
assert.match(terminalHost, /delete harness\.terminalControl/);
assert.match(terminalHost, /terminalMount/);
assert.match(terminalHost, /data-terminal-diagnostic="mount-failed"/);
assert.doesNotMatch(terminalHost, /tabIndex=\{0\}/);
assert.doesNotMatch(terminalHost, /onFocus=\{/);
assert.match(terminalSmokeFixture, /runTerminalViewBridgeSmokeFixture/);
assert.match(terminalSmokeFixture, /emitInput\("ls\\n"\)/);
assert.match(terminalSmokeFixture, /dataPlane\.emitOutput\("ok\\r\\n"\)/);
assert.match(terminalSmokeFixture, /bridge\.resize\(descriptor, 24, 80\)/);
assert.match(terminalSmokeFixture, /bridge\.writeInput\(descriptor, "premount\\n"\)/);
assert.match(terminalSmokeFixture, /bridge\.unmount\(descriptor\)/);
assert.match(pluginSurfaces, /sandbox: "host_rendered" \| "isolated_asset"/);
assert.match(architecture, /Production transport/);
assert.match(architecture, /Terminal data stays outside `HubControlFrame`/);
assert.match(architecture, /Restty is a terminal renderer only/);
assert.match(architecture, /DaemonRequest/);
assert.match(readme, /Restty is the terminal renderer/);
assert.match(readme, /BOTSTER_HUB_BIN/);
assert.match(readme, /smoke:live-packaged-protocol/);
assert.match(readme, /local WebRTC bootstrap grant/);
assert.match(architecture, /src\/botster\/webrtcDaemonClient\.ts/);
assert.match(architecture, /encrypted ordered data-channel delivery/);
assert.match(generatedDaemonProtocol, /export interface AesGcmEnvelope/);
assert.match(generatedDaemonProtocol, /export interface DaemonLocalWebrtcDeliveryChunk/);
assert.match(generatedDaemonProtocol, /type: "local_webrtc_signal"/);
assert.match(generatedDaemonProtocol, /\| \{ type: "issue_local_webrtc_bootstrap"; package_name: string; entrypoint_id: string; origin: string \}/);
assert.match(generatedDaemonProtocol, /DaemonLocalWebrtcBootstrap/);
assert.match(generatedDaemonProtocol, /DaemonLocalWebrtcAnswer/);
assert.match(generatedDaemonProtocol, /local_webrtc_bootstrap/);
assert.match(generatedDaemonProtocol, /local_webrtc_answer/);
assert.doesNotMatch(localPackageServerScript, /BOTSTER_LOCAL_WEBRTC_GRANT_ID|BOTSTER_LOCAL_WEBRTC_GRANT_SECRET|BOTSTER_LOCAL_WEBRTC_EXPECTED_ORIGIN/);
assert.match(localPackageServerScript, /async function issueLocalWebrtcBootstrap/);
assert.match(localPackageServerScript, /__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__/);
assert.match(app, /normalizeLocalWebrtcBootstrap/);
assert.match(webrtcDaemonClient, /createWebrtcDaemonClient/);
assert.match(webrtcDaemonClient, /createLocalWebrtcBootstrapRefresher/);
assert.match(webrtcDaemonClient, /createDataChannel\("botster-daemon"/);
assert.match(webrtcDaemonClient, /type: "local_webrtc_signal"/);
assert.match(webrtcDaemonClient, /grant_secret: "\[redacted\]"/);
assert.match(webrtcDaemonClient, /key === "grant_secret" \? "\[redacted\]" : redactedHarnessPayload\(value\)/);
assert.match(hubTransport, /key === "grant_secret" \? "\[redacted\]" : redactedHarnessPayload\(value\)/);
assert.match(webrtcDaemonClient, /crypto\.subtle\.encrypt/);
assert.match(webrtcDaemonClient, /crypto\.subtle\.decrypt/);
assert.match(webrtcDaemonClient, /AesGcmEnvelope/);
assert.match(webrtcDaemonClient, /DaemonLocalWebrtcDeliveryChunk/);
assert.match(webrtcDaemonClient, /maximumFrameBytesExclusive: 65_536/);
assert.match(webrtcDaemonClient, /maximumResponseBytes: 16_777_216/);
assert.match(webrtcDaemonClient, /maximumAggregateRetainedBytes: 32 \* 1_024 \* 1_024/);
assert.match(webrtcDaemonClient, /maximumConcurrentAssemblies: 16/);
assert.match(webrtcDaemonClient, /chunks: new Map/);
assert.doesNotMatch(webrtcDaemonClient, /new Array\([^)]*chunk/i);
assert.doesNotMatch(webrtcDaemonClient, /decryptDaemonResponse\(key, String\(data\)\)/);
assert.match(liveProtocolHarnessScript, /webrtc_response_assembly/);
assert.match(liveProtocolHarnessScript, /response_assembly_telemetry/);
assert.match(liveProtocolHarnessScript, /telemetry\.duration_ms > 8_000/);
assert.match(architecture, /Generated `DaemonLocalWebrtcDeliveryChunk` frames multiplex/);
assert.match(readme, /two fresh WebRTC subscription generations/);
assert.match(readme, /scripts\/local-package-server\.mjs/);
assert.match(readme, /kind: web_app/);
assert.match(readme, /launch_mode: background/);
assert.match(readme, /readiness: local_url/);
assert.match(readme, /rejects daemon operations other than/);
assert.match(vendorReadme, /e9742252312ee616d8f186b697d70349cf329250/);
assert.doesNotMatch(uiNodes, /terminal_view/);
assert.doesNotMatch(protocol, /terminal_input|terminal_output|terminal_resize|pty_bytes/);
assert.doesNotMatch(hubTransport, /terminal_input|terminal_output|terminal_resize|pty_bytes/);

const packageManifest = JSON.parse(packageManifestRaw);
const packageJson = JSON.parse(packageJsonRaw);
const uiContractSchema = JSON.parse(uiContractSchemaRaw);
const contractMatrixManifest = JSON.parse(contractMatrixManifestRaw);
assert.equal(packageManifest.name, "botster-web");
assert.equal(packageManifest.version, packageJson.version);
const expectedHubDaemonProtocolSha256 = hubTestSupportMetadata.daemon_protocol.sha256;
const installedDaemonProtocol = readDaemonProtocolTypescript();
assert.equal(packageJson.dependencies[hubTestSupportMetadata.ui_contract.package_name], hubTestSupportMetadata.ui_contract.package_version);
assert.equal(hubTestSupportMetadata.package_name, "@trybotster/hub-test-support");
assert.equal(hubTestSupportMetadata.protocol_version, 6);
assert.equal(hubTestSupportMetadata.conformance_fixture_revision, 33);
const documentedContractClaims = [
  `${hubTestSupportMetadata.ui_contract.package_name}@${packageJson.dependencies[hubTestSupportMetadata.ui_contract.package_name]}`,
  `${hubTestSupportMetadata.package_name}@${packageJson.devDependencies[hubTestSupportMetadata.package_name]}`,
  `revision-${hubTestSupportMetadata.conformance_fixture_revision}`
];
for (const document of [readme, architecture]) {
  for (const claim of documentedContractClaims) assert.equal(document.includes(claim), true);
}
for (const canonicalType of [
  "PackageSurfaceDescriptor",
  "PackageSurfaceKind",
  "PackageSurfaceOperation",
  "PackageNavigationEntry",
  "PackageNavigationTarget"
]) {
  assert.match(uiContractDeclarations, new RegExp(`(?:interface|type) ${canonicalType}`));
  assert.equal(Boolean(uiContractSchema.$defs[canonicalType]), true);
}
assert.deepEqual(
  contractMatrixManifest.navigation.map((entry) => entry.target),
  [
    { kind: "surface", surface_id: "contract.app" },
    { kind: "surface", surface_id: "contract.settings" }
  ]
);
assert.equal(createHash("sha256").update(installedDaemonProtocol).digest("hex"), expectedHubDaemonProtocolSha256);
assert.equal(createHash("sha256").update(generatedDaemonProtocol).digest("hex"), expectedHubDaemonProtocolSha256);
assert.match(installedDaemonProtocol, /plugin_resource_counters\?: DaemonPluginResourceCounters \| null/);
assert.match(installedDaemonProtocol, /interface DaemonPluginResourceCounters/);
assert.match(generatedDaemonProtocol, /\{ type: "refresh_local_packages" \}/);
assert.equal(hubTestSupportMetadata.plugin_contract_matrix.package_name, "botster.plugin-contract-matrix");
assert.equal(hubTestSupportMetadata.application_primitives.surface_id, "contract.app");
for (const primitive of ["button", "dialog", "form", "panel", "text", "text_input", "toolbar"]) {
  assert.equal(hubTestSupportMetadata.application_primitives.primitive_kinds.includes(primitive), true);
}
assert.equal(hubTestSupportMetadata.application_primitives.primitive_kinds.includes("action"), false);
assert.equal(applicationPrimitivesFixturePath(), pluginContractMatrixFixturePath());
assert.equal(verifyPackageAssets().ok, true);
const modeFlagsConformanceFixture = readModeFlagsConformanceFixture();
assert.equal(modeFlagsConformanceFixture.conformance_fixture_revision, hubTestSupportMetadata.conformance_fixture_revision);
assert.deepEqual(modeFlagsConformanceFixture.request, {
  type: "read_mode_flags",
  session_id: "mode-flags-fixture-session"
});
assert.deepEqual(modeFlagsConformanceFixture.mouse_off, {
  response_kind: "read_mode_flags",
  mode_flags: { session_id: "mode-flags-fixture-session", mouse_mode: 0 }
});
assert.deepEqual(modeFlagsConformanceFixture.mouse_on, {
  response_kind: "read_mode_flags",
  mode_flags: { session_id: "mode-flags-fixture-session", mouse_mode: 9 }
});
for (const failure of [modeFlagsConformanceFixture.unknown_session, modeFlagsConformanceFixture.backend_failure]) {
  assert.equal(failure.response_kind, "operator_error");
  assert.equal(failure.operation, "read_mode_flags");
  assert.equal(failure.mode_flags, null);
}
assert.equal(modeFlagsConformanceFixture.unknown_session.error_code, "unknown_session");
assert.equal(modeFlagsConformanceFixture.backend_failure.error_code, "runtime_error");
const lateAttachHistoryConformanceFixture = readLateAttachHistoryConformanceFixture();
assert.equal(lateAttachHistoryConformanceFixture.conformance_fixture_revision, hubTestSupportMetadata.conformance_fixture_revision);
assert.deepEqual(
  lateAttachHistoryConformanceFixture.history_then_live.map((event) =>
    event.type === "attach_state" ? `${event.type}:${event.state}` : event.type
  ),
  ["attach_state:attaching", "snapshot", "attach_state:attached", "terminal_output", "process_exit"]
);
assert.deepEqual(
  lateAttachHistoryConformanceFixture.no_history_then_live.map((event) =>
    event.type === "attach_state" ? `${event.type}:${event.state}` : event.type
  ),
  ["attach_state:attaching", "attach_state:attached", "terminal_output", "process_exit"]
);
for (const event of lateAttachHistoryConformanceFixture.history_then_live) {
  if (event.type !== "snapshot" && event.type !== "scrollback") continue;
  assert.equal(event.payload_encoding, "base64");
  assert.equal(Buffer.from(event.payload_base64, "base64").byteLength, event.bytes);
  assert.equal("data" in event, false);
}
assert.equal(lateAttachHistoryConformanceFixture.read_screen_text, "history-before-live\r\n");
assert.equal(lateAttachHistoryConformanceFixture.no_history_read_screen_text, "");
const localWebrtcDeliveryChunkFixture = readLocalWebrtcDeliveryChunkConformanceFixture();
assert.equal(localWebrtcDeliveryChunkFixture.version, 2);
assert.equal(localWebrtcDeliveryChunkFixture.maximum_frame_bytes_exclusive, 65_536);
assert.equal(localWebrtcDeliveryChunkFixture.maximum_delivery_bytes, 16_777_216);
assert.deepEqual(
  new Set(localWebrtcDeliveryChunkFixture.scenarios.daemon_entity_frame.map((chunk) => chunk.delivery_kind)),
  new Set(["daemon_entity_frame"])
);
const largeGeneratedChunkFixture = localWebrtcDeliveryChunkFixture.scenarios.large_generated;
const generatedFixturePayload = repeatUtf8Pattern(
  largeGeneratedChunkFixture.pattern,
  largeGeneratedChunkFixture.total_bytes
);
const generatedFixtureChunks = chunkUtf8Payload(generatedFixturePayload, largeGeneratedChunkFixture.chunk_payload_bytes);
assert.equal(Buffer.byteLength(generatedFixturePayload), 262_145);
assert.equal(generatedFixtureChunks.length, 22);
assert.equal(generatedFixtureChunks.length, largeGeneratedChunkFixture.expected_chunk_count);
const reorderedGeneratedFixtureChunks = generatedFixtureChunks.map((payload, chunk_index) => ({
  version: 2,
  delivery_kind: "daemon_response",
  message_id: largeGeneratedChunkFixture.message_id,
  chunk_index,
  chunk_count: generatedFixtureChunks.length,
  total_bytes: largeGeneratedChunkFixture.total_bytes,
  payload
})).toReversed();
assert.equal(
  createHash("sha256").update(reassembleFixtureChunks(reorderedGeneratedFixtureChunks)).digest("hex"),
  "06d24e206edb54bed524319b1127725b46e20ea4aae5934688599abd42fa4317"
);
assert.equal(
  reassembleFixtureChunks(localWebrtcDeliveryChunkFixture.scenarios.over_budget_operator_error),
  "encrypted-operator-error"
);
const sessionLifecycleFixture = readSessionLifecycleSubscriptionConformanceFixture();
assert.equal(sessionLifecycleFixture.conformance_fixture_revision, hubTestSupportMetadata.conformance_fixture_revision);
assert.equal(sessionLifecycleFixture.fresh_subscription.requires_authoritative_snapshot_before_deltas, true);
const sessionPluginBindingFixture = readSessionPluginBindingConformanceFixture();
assert.equal(sessionPluginBindingFixture.conformance_fixture_revision, hubTestSupportMetadata.conformance_fixture_revision);
assert.equal(sessionPluginBindingFixture.binding_family, "/session");
assert.equal(sessionPluginBindingFixture.entity_type, "session");
assert.deepEqual(
  sessionPluginBindingFixture.references,
  [
    "session-transition",
    "session-stable-current",
    "session-ended",
    "session-indeterminate",
    "session-missing"
  ]
);
assert.match(checkDaemonProtocolDriftScript, /@trybotster\/hub-test-support/);
assert.doesNotMatch(checkDaemonProtocolDriftScript, /\.\.\/botster-hub|Skipping daemon protocol drift check|check out \.\.\/botster-hub/);
assert.match(liveProtocolHarnessScript, /@trybotster\/hub-test-support/);
assert.match(liveProtocolHarnessScript, /materializePluginContractMatrixFixture/);
assert.match(liveProtocolHarnessScript, /assertTerminalAttachChronology/);
assert.match(liveProtocolHarnessScript, /event\.type === "attach_state" \? `\$\{event\.type\}:\$\{event\.state\}`/);
assert.match(liveProtocolHarnessScript, /binaryProvenanceFor/);
assert.match(liveProtocolHarnessScript, /requiredProvenanceField\(compatibility, "protocol"/);
assert.match(liveProtocolHarnessScript, /if \(!sharedHubDriverMode\)/);
assert.match(liveProtocolHarnessScript, /live packaged protocol binary provenance/);
assert.match(liveProtocolHarnessScript, /locator\(WORKSPACES_SPAWN_OPENER_SELECTOR\)/);
assert.doesNotMatch(liveProtocolHarnessScript, /hasText:\s*\/\^Spawn\$\//);
assert.match(liveProtocolHarnessScript, /const openRequest = await latestWorkspacesActionRequest\(page, openSince/);
assert.match(liveProtocolHarnessScript, /const openResult = await latestWorkspacesActionResult\(page, openSince/);
assert.match(liveProtocolHarnessScript, /spawn_opener:\s*\{/);
assert.doesNotMatch(
  liveProtocolHarnessScript,
  /BOTSTER_HUB_SOURCE_DIR \? join\(process\.env\.BOTSTER_HUB_SOURCE_DIR, "fixtures\/plugins\/plugin-contract-matrix"\)/
);
const materializedFixtureRoot = await mkdtemp(join(tmpdir(), "botster-web-contract-matrix-fixture-"));
try {
  const materializedFixturePath = materializePluginContractMatrixFixture(materializedFixtureRoot);
  const materializedFixtureManifest = JSON.parse(await readFile(join(materializedFixturePath, "botster-package.json"), "utf8"));
  const materializedFixturePlugin = await readFile(join(materializedFixturePath, "plugin.lua"), "utf8");
  assert.equal(materializedFixtureManifest.name, "botster.plugin-contract-matrix");
  assert.match(materializedFixturePlugin, /contract\.app/);
} finally {
  await rm(materializedFixtureRoot, { recursive: true, force: true });
}
const mismatchedProtocolRoot = await mkdtemp(join(tmpdir(), "botster-web-daemon-protocol-mismatch-"));
try {
  const mismatchedProtocolPath = join(mismatchedProtocolRoot, "daemon-protocol.ts");
  await writeFile(mismatchedProtocolPath, `${generatedDaemonProtocol}\n// deliberate drift\n`);
  const driftResult = await runNodeScript(new URL("../scripts/check-daemon-protocol-drift.mjs", import.meta.url), {
    BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL: mismatchedProtocolPath
  });
  assert.notEqual(driftResult.code, 0);
  assert.match(`${driftResult.stdout}\n${driftResult.stderr}`, /Vendored daemon protocol drift detected/);
  assert.doesNotMatch(`${driftResult.stdout}\n${driftResult.stderr}`, /missing|Skipping daemon protocol drift check/i);
} finally {
  await rm(mismatchedProtocolRoot, { recursive: true, force: true });
}
assert.equal(
  packageJson.scripts["smoke:live-packaged-protocol"],
  "npm run build && node scripts/live-packaged-protocol-harness.mjs"
);
assert.equal(
  packageJson.scripts["smoke:live-packaged-protocol:caller-repeatability"],
  "npm run build && node scripts/live-caller-owned-repeatability.mjs"
);
assert.equal(
  packageJson.scripts["smoke:workspaces-lifecycle"],
  "npm run build && BOTSTER_LIVE_WORKSPACES_LIFECYCLE=1 node scripts/live-packaged-protocol-harness.mjs"
);
assert.match(liveProtocolHarnessScript, /exerciseWorkspacesLifecycle/);
assert.match(liveProtocolHarnessScript, /transitions: Array\.from\(\{ length: 4 \}/);
assert.match(liveProtocolHarnessScript, /stableEnded: Array\.from\(\{ length: 4 \}/);
assert.match(liveProtocolHarnessScript, /removals: Array\.from\(\{ length: 4 \}/);
assert.match(liveProtocolHarnessScript, /neverExisting: Array\.from\(\{ length: 4 \}/);
assert.match(liveProtocolHarnessScript, /stageExpectations\(removedPartition\)/);
assert.match(liveProtocolHarnessScript, /observedWorkspacesLifecyclePartition\(reconnected\.classifications\)/);
assert.match(liveProtocolHarnessScript, /priorEvidence: \[initial, removed\]/);
assert.match(
  liveProtocolHarnessScript,
  /assertStableLifecycleIdentity\(transitioned, reconnected, sessionId, "ended"\)/
);
assert.match(
  liveProtocolHarnessScript,
  /assertStableLifecycleIdentity\(initial, reconnected, sessionId, "ended"\)/
);
assert.match(
  liveProtocolHarnessScript,
  /assertStableLifecycleIdentity\(removed, reconnected, sessionId, "unavailable"\)/
);
assert.match(
  liveProtocolHarnessScript,
  /assertStableLifecycleIdentity\(initial, reconnected, sessionId, "unavailable"\)/
);
assert.equal(packageManifest.kind, "plugin");
assert.equal(packageManifest.botster, ">=0.1.0");
assert.deepEqual(packageManifest.source, { type: "path", path: "." });
assert.deepEqual(packageManifest.capabilities, []);
assert.deepEqual(packageManifest.configuration, {
  fields: [
    {
      key: "remote_browser_rendezvous_enabled",
      type: "boolean",
      label: "Remote browser access",
      description: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
      default: { type: "boolean", value: false }
    }
  ]
});
assert.deepEqual(packageManifest.surfaces, []);
assert.deepEqual(packageManifest.entrypoints, [
  { runtime: "lua", path: "plugin.lua", bootstrap: false }
]);
assert.equal(packageManifest.runnable_entrypoints.length, 1);
assert.doesNotMatch(pluginEntrypoint, /surface_route|descriptor_id|Deterministic/);
assert.doesNotMatch(pluginEntrypoint, /tools|commands|surfaces|entities|mcp/);

const [webClientEntrypoint] = packageManifest.runnable_entrypoints;
assert.equal(webClientEntrypoint.id, "web-client");
assert.equal(webClientEntrypoint.kind, "web_app");
assert.equal(webClientEntrypoint.launch_mode, "background");
assert.equal(webClientEntrypoint.command, "node");
assert.deepEqual(webClientEntrypoint.args, ["scripts/local-package-server.mjs"]);
assert.deepEqual(webClientEntrypoint.working_directory, { policy: "package_root" });
assert.equal(Object.hasOwn(webClientEntrypoint, "mode"), false);
assert.equal(webClientEntrypoint.may_supervise, true);
assert.deepEqual(webClientEntrypoint.capabilities, [{ surface: "network", scope: "localhost" }]);
assert.deepEqual(
  webClientEntrypoint.injections.map(({ kind, target, required }) => ({ kind, target, required })),
  [
    {
      kind: "hub_connection",
      target: { type: "environment", name: "BOTSTER_HUB_CONNECTION" },
      required: true
    }
  ]
);
assert.equal(
  webClientEntrypoint.environment.length,
  0
);
assert.deepEqual(webClientEntrypoint.readiness, { result_fields: ["local_url"] });
assert.equal(
  webClientEntrypoint.injections.some(({ target }) => target.name === "BOTSTER_HUB_BIN"),
  false
);
assert.equal(
  webClientEntrypoint.injections.some(({ target }) => target.name === "BOTSTER_LIVE_DATA_DIR"),
  false
);

const packageServerRuntime = await startPackageServerRuntime({ launchResult: true });
try {
  const rootResponse = await fetch(`${packageServerRuntime.origin}/`);
  const rootHtml = await rootResponse.text();
  assert.equal(rootResponse.status, 200, rootHtml);
  assert.match(rootResponse.headers.get("content-type"), /text\/html/);
  assert.equal(rootResponse.headers.get("access-control-allow-origin"), null);
  assert.match(rootHtml, /<div id="root"><\/div>/);
  assert.match(rootHtml, /window\.__BOTSTER_PACKAGE_RUNTIME__ = true/);
  assert.match(rootHtml, /window\.__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__/);
  assert.match(rootHtml, new RegExp(`"expected_origin":"${packageServerRuntime.origin.replaceAll(".", "\\.")}"`));
  assert.match(rootHtml, /"signaling_url":"\/request"/);

  const faviconResponse = await fetch(`${packageServerRuntime.origin}/favicon.ico`);
  assert.equal(faviconResponse.status, 204);

  const fallbackResponse = await fetch(`${packageServerRuntime.origin}/sessions/local-production`);
  const fallbackHtml = await fallbackResponse.text();
  assert.equal(fallbackResponse.status, 200);
  assert.match(fallbackHtml, /botster package runtime/);
  assert.match(rootHtml, /"grant_id":"package-server-grant-1"/);
  assert.match(fallbackHtml, /"grant_id":"package-server-grant-2"/);

  const assetResponse = await fetch(`${packageServerRuntime.origin}/assets/app.js`);
  const assetBody = await assetResponse.text();
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type"), /text\/javascript/);
  assert.match(assetBody, /console\.log\("package asset"\)/);
  assert.doesNotMatch(assetBody, /__BOTSTER_PACKAGE_RUNTIME__/);

  const traversalResponse = await fetch(`${packageServerRuntime.origin}/%2e%2e/package.json`);
  assert.equal(traversalResponse.status, 404);

  const healthResponse = await fetch(`${packageServerRuntime.origin}/health`);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    connection: "hub",
    transport: "unix_socket",
    local_url: packageServerRuntime.origin
  });
  assert.deepEqual(await readLaunchResult(packageServerRuntime.launchResultPath), {
    entrypoint_id: "web-client",
    process_state: "running",
    local_url: packageServerRuntime.origin
  });

  const requestResponse = await fetch(`${packageServerRuntime.origin}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "daemon_request",
      request_id: "package-runtime-status",
      payload: { type: "status" }
    })
  });
  assert.equal(requestResponse.status, 400);
  const rejectedRequest = await requestResponse.json();
  assert.equal(rejectedRequest.request_id, "package-runtime-status");
  assert.equal(rejectedRequest.payload.error.code, "unsupported_package_server_request");
  assert.equal(packageServerRuntime.daemonRequests.length >= 2, true);
  assert.equal(
    packageServerRuntime.daemonRequests.every(
      (request) =>
        request.type === "issue_local_webrtc_bootstrap" &&
        request.package_name === "botster-web" &&
        request.entrypoint_id === "web-client" &&
        request.origin === packageServerRuntime.origin
    ),
    true
  );
} finally {
  await packageServerRuntime.stop();
}

const invalidFallbackBootstrapRuntime = await startPackageServerRuntime({
  launchResult: true,
  invalidBootstrapAt: 2
});
try {
  const rootResponse = await fetch(`${invalidFallbackBootstrapRuntime.origin}/`);
  assert.equal(rootResponse.status, 200);

  const fallbackResponse = await fetch(`${invalidFallbackBootstrapRuntime.origin}/apps/direct-load`);
  assert.equal(fallbackResponse.status, 503);
  assert.deepEqual(await fallbackResponse.json(), {
    error: "local_webrtc_bootstrap_unavailable",
    message: "Hub returned an invalid local WebRTC bootstrap grant."
  });

  const healthResponse = await fetch(`${invalidFallbackBootstrapRuntime.origin}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).ok, true);
} finally {
  await invalidFallbackBootstrapRuntime.stop();
}

const dynamicPackageServerRuntime = await startPackageServerRuntime({
  launchResult: true,
  dynamicPort: true
});
try {
  const launchResult = await readLaunchResult(dynamicPackageServerRuntime.launchResultPath);
  assert.equal(launchResult.local_url, dynamicPackageServerRuntime.origin);
  assert.match(dynamicPackageServerRuntime.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
} finally {
  await dynamicPackageServerRuntime.stop();
}

const occupiedPackageServerResult = await startPackageServerRuntime({
  launchResult: true,
  occupiedPort: true
});
assert.notEqual(occupiedPackageServerResult.code, 0);
assert.match(occupiedPackageServerResult.stderr, /"code":"package_server_listen_failed"/);
assert.match(occupiedPackageServerResult.stderr, /EADDRINUSE/);
assert.equal(occupiedPackageServerResult.launchResultPublished, false);

const desktopCss = removeCssAtRules(css);
const appRootRule = extractTopLevelCssRule(desktopCss, "#root");
assert.match(appRootRule, /height:\s*100%/);
assert.match(appRootRule, /min-height:\s*100dvh/);
assert.match(appRootRule, /border-radius:\s*0/);
const sidebarContainerRule = extractTopLevelCssRule(desktopCss, ".app-sidebar::part(container)");
assert.match(sidebarContainerRule, /height:\s*100%/);
assert.match(sidebarContainerRule, /min-height:\s*100%/);
assert.match(sidebarContainerRule, /border-radius:\s*0/);
assert.match(sidebarContainerRule, /background:\s*#10131a/);
assert.doesNotMatch(desktopCss, /\.workspace-grid\s*\{[^}]*grid-template-columns/);
assert.doesNotMatch(desktopCss, /\.dashboard-layout\s*\{[^}]*grid-template-columns/);
assert.doesNotMatch(desktopCss, /\.active-work-grid\s*\{/);
assert.doesNotMatch(desktopCss, /\.app-grid\s*\{[^}]*grid-template-columns/);
assert.match(variablesCss, /@media\s*\(prefers-color-scheme:\s*dark\)/);
assert.match(variablesCss, /--ion-background-color:\s*#0f1218/);
assert.match(variablesCss, /--ion-item-background:\s*#171b23/);
assert.match(variablesCss, /--app-surface-color:\s*#171b23/);

const sidebarFooterRule = extractTopLevelCssRule(desktopCss, ".app-sidebar-footer");
assert.match(sidebarFooterRule, /background:\s*#10131a/);
assert.match(sidebarFooterRule, /border-top:\s*1px\s+solid\s+#242b38/);
const sidebarSettingsRule = extractTopLevelCssRule(desktopCss, ".app-sidebar .sidebar-advanced");
assert.match(sidebarSettingsRule, /margin:\s*0/);
assert.match(sidebarSettingsRule, /env\(safe-area-inset-bottom\)/);

const pluginWorkspaceShellRule = extractTopLevelCssRule(desktopCss, ".workspace-shell.plugin-workspace-shell");
assert.match(pluginWorkspaceShellRule, /width:\s*100%/);
assert.match(pluginWorkspaceShellRule, /padding:\s*0/);
const pluginSurfaceSectionRule = extractTopLevelCssRule(desktopCss, ".plugin-surface-page .uinode-section");
assert.match(pluginSurfaceSectionRule, /border:\s*0/);
assert.match(pluginSurfaceSectionRule, /background:\s*transparent/);
const uiNodeSectionRule = extractTopLevelCssRule(desktopCss, ".uinode-section");
assert.match(uiNodeSectionRule, /border:\s*1px\s+solid\s+var\(--app-border-color\)/);
assert.match(uiNodeSectionRule, /border-radius:\s*8px/);
assert.match(uiNodeSectionRule, /background:\s*var\(--app-surface-color\)/);
const uiNodeInlineRule = extractTopLevelCssRule(desktopCss, ".uinode-inline");
assert.match(uiNodeInlineRule, /flex-wrap:\s*wrap/);
const uiNodeEmptyStateRule = extractTopLevelCssRule(desktopCss, ".uinode-empty-state");
assert.match(uiNodeEmptyStateRule, /place-items:\s*center/);
assert.match(uiNodeEmptyStateRule, /text-align:\s*center/);

const terminalPanelRule = extractTopLevelCssRule(desktopCss, ".terminal-panel");
assert.match(terminalPanelRule, /max-height:\s*calc\(100vh\s*-\s*210px\)/);
assert.match(terminalPanelRule, /overflow:\s*hidden/);
assert.match(terminalPanelRule, /background:\s*var\(--app-surface-color\)/);

const terminalSessionShellRule = extractTopLevelCssRule(desktopCss, ".terminal-session-shell");
assert.match(terminalSessionShellRule, /width:\s*100%/);
assert.match(terminalSessionShellRule, /height:\s*100%/);
assert.match(terminalSessionShellRule, /margin:\s*0/);
assert.match(terminalSessionShellRule, /padding:\s*0/);
const terminalSessionPanelRule = extractTopLevelCssRule(desktopCss, ".terminal-session-view .terminal-panel");
assert.match(terminalSessionPanelRule, /width:\s*100%/);
assert.match(terminalSessionPanelRule, /height:\s*100%/);
assert.match(terminalSessionPanelRule, /max-height:\s*none/);
assert.match(terminalSessionPanelRule, /padding:\s*0/);
assert.match(terminalSessionPanelRule, /border:\s*0/);
assert.match(terminalSessionPanelRule, /border-radius:\s*0/);
assert.match(terminalSessionPanelRule, /box-shadow:\s*none/);
assert.match(terminalSessionPanelRule, /position:\s*relative/);
const terminalSessionStatusRule = extractTopLevelCssRule(desktopCss, ".terminal-session-view .terminal-status");
assert.match(terminalSessionStatusRule, /position:\s*absolute/);
assert.match(terminalSessionStatusRule, /background:\s*rgb\(17\s+19\s+24\s*\/\s*0\.9\)/);
assert.match(
  extractTopLevelCssRule(desktopCss, '.terminal-session-view .terminal-status[data-terminal-attach-state="attached"]'),
  /display:\s*none/
);
const desktopTerminalNavigationCss = extractCssAtRule(css, "@media (min-width: 768px)");
assert.match(extractTopLevelCssRule(desktopTerminalNavigationCss, ".terminal-session-header"), /display:\s*none/);

const localHubMainRule = extractTopLevelCssRule(desktopCss, ".local-hub-main");
assert.match(localHubMainRule, /display:\s*grid/);

const diagnosticPanelRule = extractTopLevelCssRule(desktopCss, ".diagnostic-panel");
assert.match(diagnosticPanelRule, /padding:\s*14px/);
assert.match(diagnosticPanelRule, /background:\s*var\(--app-surface-color\)/);

const localHubStatusGridRule = extractTopLevelCssRule(desktopCss, ".local-hub-status-grid");
assert.match(localHubStatusGridRule, /display:\s*grid/);
assert.match(localHubStatusGridRule, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);

const localHubPrimaryActionRule = extractTopLevelCssRule(desktopCss, ".local-hub-primary-action");
assert.match(localHubPrimaryActionRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
assert.match(localHubPrimaryActionRule, /background:\s*var\(--app-accent-surface-color\)/);

const mobileCss = extractCssAtRule(css, "@media (max-width: 860px)");
assert.doesNotMatch(mobileCss, /\.workspace-grid\s*\{[^}]*grid-template-columns/);
assert.match(extractTopLevelCssRule(mobileCss, ".local-hub-status-grid"), /grid-template-columns:\s*1fr\s*;/);
assert.match(extractTopLevelCssRule(mobileCss, ".local-hub-primary-action"), /grid-template-columns:\s*1fr\s*;/);
assert.match(extractTopLevelCssRule(mobileCss, ".terminal-panel"), /max-height:\s*none/);

const testCompileDir = await mkdtemp(join(tmpdir(), "botster-terminal-smoke-"));
const terminalJs = ts.transpileModule(terminal, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const terminalSmokeFixtureJs = ts
  .transpileModule(terminalSmokeFixture, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  })
  .outputText.replace('from "./terminal";', 'from "./terminal.mjs";');

await Promise.all([
  writeFile(join(testCompileDir, "terminal.mjs"), terminalJs),
  writeFile(join(testCompileDir, "terminalSmokeFixture.mjs"), terminalSmokeFixtureJs)
]);

const { runTerminalViewBridgeSmokeFixture } = await import(
  pathToFileURL(join(testCompileDir, "terminalSmokeFixture.mjs"))
);
const smoke = await runTerminalViewBridgeSmokeFixture();

assert.deepEqual(smoke.dataPlane.inputs, ["ls\n"]);
assert.deepEqual(smoke.firstRenderer.writes, ["ready\r\n", "ok\r\n"]);
assert.deepEqual(smoke.firstRenderer.resizes, [{ rows: 24, columns: 80 }]);
assert.equal(smoke.dataPlane.outputSubscriptionCount, 1);
assert.equal(smoke.dataPlane.outputUnsubscribeCount, 1);
assert.equal(smoke.dataPlane.detachCount, 1);
assert.ok(smoke.secondRenderer);
assert.ok(smoke.lifecycle.indexOf("destroy") < smoke.lifecycle.lastIndexOf("create"));
assert.equal(smoke.lifecycle.filter((event) => event === "focus").length, 2);
assert.equal(smoke.lifecycle.filter((event) => event === "input:unsubscribe").length, 1);
assert.doesNotMatch(smoke.firstRenderer.writes.join(""), /stale/);
assert.doesNotMatch(smoke.dataPlane.inputs.join(""), /stale/);
assert.doesNotMatch(smoke.dataPlane.inputs.join(""), /premount/);

const compiledRoot = join(tmpdir(), "botster-web-runtime-test");
await rm(compiledRoot, { recursive: true, force: true });
await mkdir(join(compiledRoot, "botster"), { recursive: true });
await mkdir(join(compiledRoot, "botster/__fixtures__"), { recursive: true });

await Promise.all([
  compileTsModule("botster/__fixtures__/generatedDaemonProtocol.ts", join(compiledRoot, "botster/__fixtures__/generatedDaemonProtocol.js")),
  compileTsModule("botster/actions.ts", join(compiledRoot, "botster/actions.js")),
  compileTsModule("botster/capabilities.ts", join(compiledRoot, "botster/capabilities.js")),
  compileTsModule("botster/client.ts", join(compiledRoot, "botster/client.js")),
  compileTsModule("botster/connectionDiagnostics.ts", join(compiledRoot, "botster/connectionDiagnostics.js")),
  compileTsModule("botster/hubRuntime.ts", join(compiledRoot, "botster/hubRuntime.js")),
  compileTsModule("botster/entities.ts", join(compiledRoot, "botster/entities.js")),
  compileTsModule("botster/protocol.ts", join(compiledRoot, "botster/protocol.js")),
  compileTsModule("botster/realHubDaemonDto.ts", join(compiledRoot, "botster/realHubDaemonDto.js")),
  compileTsModule("botster/hubTransport.ts", join(compiledRoot, "botster/hubTransport.js")),
  compileTsModule("botster/hubTerminalDataPlane.ts", join(compiledRoot, "botster/hubTerminalDataPlane.js")),
  compileTsModule("botster/webrtcDaemonClient.ts", join(compiledRoot, "botster/webrtcDaemonClient.js")),
  compileTsModule("botster/terminal.ts", join(compiledRoot, "botster/terminal.js"))
]);

const requireRuntime = createRequire(join(compiledRoot, "runtime-test.cjs"));
const { createBotsterWebClient } = requireRuntime("./botster/client.js");
const { createInMemoryEntityFrameStore } = requireRuntime("./botster/entities.js");
const { createHubRuntimeConfig, terminalDataPlaneLabel } = requireRuntime("./botster/hubRuntime.js");
const {
  createHubTransport,
  daemonEntityFrame,
  entitySubscriptionDiagnosticFrame,
  daemonResponseFrames,
} = requireRuntime("./botster/hubTransport.js");
const { createHubTerminalDataPlane } = requireRuntime("./botster/hubTerminalDataPlane.js");
const {
  createLocalWebrtcBootstrapRefresher,
  createWebrtcDaemonClient,
  localWebrtcResponseChunkLimits,
  WebrtcDaemonClientError,
  webRtcDaemonLifecycleEventName
} = requireRuntime("./botster/webrtcDaemonClient.js");
const { DefaultTerminalViewBridge } = requireRuntime("./botster/terminal.js");
const {
  generatedDaemonRequestFixtures,
  generatedAppResponseFixture,
  generatedModeFlagsResponseFixture,
  generatedPluginResourceCountersResponseFixture,
  generatedPackageNavigationResponseFixture,
  generatedPackageResponseFixture
} = requireRuntime("./botster/__fixtures__/generatedDaemonProtocol.js");
const {
  actionFailureDiagnostic,
  hubUnavailableDiagnostic,
  compatibilityDiagnosticsFromFrame,
  connectionFailureDiagnostic,
  hubConnectionDiagnosticFromFrame,
  hubCompatibilityDiagnosticId,
  hubStatusFamily,
  initialConnectionDiagnostics,
  minimumConformanceFixtureRevision,
  minimumDaemonProtocolVersion,
  operatorErrorDiagnostic,
  requiredDaemonFeatures,
  schemaVersionInformationFromFrame,
  streamDisconnectedDiagnostic,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  webRtcFailureDiagnostic
} = requireRuntime("./botster/connectionDiagnostics.js");

assert.deepEqual(generatedDaemonRequestFixtures.map((request) => request.type), [
  "list_apps",
  "list_package_navigation",
  "list_packages",
  "list_available_packages",
  "inspect_available_package",
  "preview_package_install",
  "install_package_registry_entry",
  "set_package_configuration",
  "set_package_configuration",
  "install_package_local_path",
  "start_package_entrypoint",
  "stop_package_entrypoint",
  "restart_package_entrypoint",
  "package_entrypoint_status",
  "enable_package",
  "disable_package",
  "remove_package",
  "plugin_surface_render",
  "plugin_surface_action",
  "read_mode_flags"
]);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "read_mode_flags"),
  modeFlagsConformanceFixture.request
);
assert.equal(generatedModeFlagsResponseFixture.kind, modeFlagsConformanceFixture.mouse_on.response_kind);
assert.deepEqual(generatedModeFlagsResponseFixture.mode_flags, modeFlagsConformanceFixture.mouse_on.mode_flags);
assert.equal(generatedPluginResourceCountersResponseFixture.kind, "plugin_lifecycle");
assert.deepEqual(generatedPluginResourceCountersResponseFixture.lifecycle, [
  { package_name: "project-pipelines", state: "running", loaded: true }
]);
assert.equal(generatedPluginResourceCountersResponseFixture.plugin_worker_counters.live_plugin_executors, 1);
assert.equal(generatedPluginResourceCountersResponseFixture.plugin_resource_counters.active_timer_resources, 3);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "set_package_configuration" && request.package_name === "project-pipelines"),
  {
    type: "set_package_configuration",
    package_name: "project-pipelines",
    values: {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      api_token: { type: "secret", state: "write_only" }
    }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "set_package_configuration" && request.package_name === "botster-web"),
  {
    type: "set_package_configuration",
    package_name: "botster-web",
    values: {
      remote_browser_rendezvous_enabled: { type: "boolean", value: true }
    }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "plugin_surface_render"),
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: { route: "/pipelines" }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "plugin_surface_action"),
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    request: {
      request_id: "fixture-action-1",
      surface_id: "home",
      action_id: "ticket.open",
      node_id: "ticket-row-1",
      kind: "submit",
      payload: { ticket_id: "ticket_1" }
    }
  }
);
assert.equal(
  daemonResponseFrames(generatedPackageResponseFixture, 12)
    .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package")
    .payload.records[0].id,
  "project-pipelines"
);
assert.equal(
  daemonResponseFrames({
    ...generatedPackageResponseFixture,
    kind: "package_update_status",
    packages: [],
    update_status: {
      package_name: "project-pipelines",
      current_pin: null,
      candidate_pin: null,
      update_available: false,
      diagnostics: [],
      actions: []
    }
  }, 12).some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package"),
  false
);
const packageNavigationSnapshot = daemonResponseFrames(generatedPackageNavigationResponseFixture, 12)
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package_navigation");
assert.equal(packageNavigationSnapshot.payload.records.length, 2);
assert.equal(packageNavigationSnapshot.payload.records[0].id, "project-pipelines:home");
assert.equal(packageNavigationSnapshot.payload.records[0].route_path, "/packages/project-pipelines/surfaces/home");
assert.equal(packageNavigationSnapshot.payload.records[0].launch_action.id, "botster.package.surface.render");
assert.equal(packageNavigationSnapshot.payload.records[1].blocked, true);
assert.equal(packageNavigationSnapshot.payload.records[1].launch_action, undefined);
const optionalDaemonAppFrames = daemonResponseFrames(
  {
    kind: "apps",
    apps: [
      {
        package_name: "optional-web",
        app_id: "browser",
        entrypoint_id: "web",
        kind: "web_app",
        launch_mode: "browser",
        lifecycle_state: "running",
        launch_target: { kind: "web_app" }
      }
    ],
    events: []
  },
  13
);
const optionalDaemonPackageFrames = daemonResponseFrames(
  {
    kind: "packages",
    packages: [
      {
        package_name: "optional-package",
        version: "0.1.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [],
        runnable_entrypoints: [],
        configuration: {},
        availability: { state: "available" },
        provider_profile_admitted: false
      }
    ],
    events: []
  },
  14
);
const optionalDaemonAppRecord = optionalDaemonAppFrames
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app")
  .payload.records[0];
const optionalDaemonPackageRecord = optionalDaemonPackageFrames
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package")
  .payload.records[0];
assert.equal(optionalDaemonAppRecord.local_url, "");
assert.equal(optionalDaemonAppRecord.diagnostics_summary, "Web app has no hub-provided local URL.");
assert.equal(optionalDaemonAppRecord.app_action_summary, "No app actions returned");
assert.equal(optionalDaemonPackageRecord.app_surface_summary, "No app surfaces");
assert.equal(optionalDaemonPackageRecord.settings_surface_summary, "No settings surfaces");
assert.equal(optionalDaemonPackageRecord.package_action_summary, "No package actions returned");
assert.deepEqual(optionalDaemonPackageRecord.configuration_fields, []);
const appSnapshot = daemonResponseFrames(generatedAppResponseFixture, 12)
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app");
assert.equal(appSnapshot.payload.records[0].id, "botster-web:production");
assert.equal(appSnapshot.payload.records[0].local_url, "http://127.0.0.1:41821");
assert.equal(appSnapshot.payload.records[0].open_action.disabled, false);
assert.equal(appSnapshot.payload.records[1].kind, "terminal_app");
assert.equal(appSnapshot.payload.records[1].open_action.disabled, true);
assert.match(appSnapshot.payload.records[1].diagnostics_summary, /local terminal launch/);
assert.equal(
  daemonResponseFrames({ ...generatedPackageResponseFixture, kind: "available_packages" }, 12)
    .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.available_package")
    .payload.records[0].id,
  "github-provider"
);

const sessionLifecycleStore = createInMemoryEntityFrameStore();
const applySessionLifecycleFrame = (frame) => {
  const projected = daemonEntityFrame(frame);
  assert.ok(projected);
  sessionLifecycleStore.apply(projected.payload);
};
const [
  lifecycleInitialSnapshot,
  lifecycleUpsert,
  lifecycleDimensionsPatch,
  lifecycleEndedPatch,
  lifecycleRemove
] = sessionLifecycleFixture.normalized_frames;
applySessionLifecycleFrame(lifecycleInitialSnapshot);
assert.deepEqual(sessionLifecycleStore.list("session"), []);
applySessionLifecycleFrame(lifecycleUpsert);
assert.deepEqual(sessionLifecycleStore.get("session", "slc-session"), {
  ...lifecycleUpsert.entity,
  id: "slc-session"
});
applySessionLifecycleFrame(lifecycleDimensionsPatch);
assert.equal(sessionLifecycleStore.get("session", "slc-session").rows, 31);
assert.equal(sessionLifecycleStore.get("session", "slc-session").cols, 101);
applySessionLifecycleFrame(lifecycleEndedPatch);
assert.equal(sessionLifecycleStore.get("session", "slc-session").lifecycle, "exited");
assert.equal(sessionLifecycleStore.get("session", "slc-session").lifecycle_class, "ended");
applySessionLifecycleFrame(lifecycleRemove);
assert.equal(sessionLifecycleStore.get("session", "slc-session"), undefined);

sessionLifecycleStore.apply({
  operation: "entity_upsert",
  key: { family: "session", id: "prior-generation-row" },
  sequence: 3,
  record: { id: "prior-generation-row", session_uuid: "prior-generation-row" }
});
applySessionLifecycleFrame(sessionLifecycleFixture.fresh_subscription.snapshot);
assert.deepEqual(sessionLifecycleStore.list("session"), []);
assert.equal(sessionLifecycleFixture.fresh_subscription.prior_generation_frames_discarded, true);
assert.equal(sessionLifecycleFixture.overflow.resync_reason, "subscriber_overflow");
applySessionLifecycleFrame(sessionLifecycleFixture.overflow.resync_snapshot);
assert.deepEqual(sessionLifecycleStore.list("session"), []);

const validGenericSession = {
  session_uuid: "generic-session",
  registry_state: "active",
  lifecycle: "running",
  lifecycle_class: "current",
  rows: 24,
  cols: 80,
  updated_at: 1785880000
};
const genericSessionSnapshot = daemonEntityFrame({
  type: "entity_snapshot",
  subscription_id: "generic-session-boundary",
  entity_type: "session",
  snapshot_seq: 1,
  items: [null, "not-a-session", { session_uuid: "missing-fields" }, validGenericSession]
});
assert.deepEqual(genericSessionSnapshot.payload.records, [{ ...validGenericSession, id: "generic-session" }]);
assert.deepEqual(daemonEntityFrame({
  type: "entity_upsert",
  subscription_id: "generic-session-boundary",
  entity_type: "session",
  snapshot_seq: 2,
  id: "generic-session",
  entity: validGenericSession
}).payload.record, { ...validGenericSession, id: "generic-session" });
assert.equal(daemonEntityFrame({
  type: "entity_upsert",
  subscription_id: "generic-session-boundary",
  entity_type: "session",
  snapshot_seq: 2,
  id: "missing-fields",
  entity: { session_uuid: "missing-fields" }
}), undefined);
assert.equal(daemonEntityFrame({
  type: "entity_snapshot",
  subscription_id: "package-entities",
  entity_type: "project-pipelines.ticket",
  snapshot_seq: 1,
  items: [{ id: "ticket-1", title: "Preserve generic package records" }]
}), undefined);
// Protocol 6 adds entity_error, which carries no id/patch/snapshot_seq. It must never fall
// through the delta branches, and it is BOTH a transport fact and a surface fact: the
// connection diagnostic reports subscription health for any entity type, while the
// family-scoped projection lets the owning surface render Hub's code and message verbatim.
const entityErrorInput = {
  type: "entity_error",
  subscription_id: "session-subscription",
  entity_type: "session",
  code: "entity_subscription_failed",
  message: "Session family could not be projected"
};
const entityErrorDiagnostic = entitySubscriptionDiagnosticFrame(entityErrorInput);
assert.equal(entityErrorDiagnostic.kind, "connection_diagnostic");
assert.deepEqual(entityErrorDiagnostic.payload, {
  kind: "entity_subscription_failed",
  message: "Entity subscription error for session: Session family could not be projected",
  operation: "subscribe_entities",
  feature: "session"
});
assert.equal(
  hubConnectionDiagnosticFromFrame(entityErrorDiagnostic).detail,
  "Entity subscription error for session: Session family could not be projected Capability: session. Operation: subscribe_entities."
);
// Non-session families still surface a diagnostic rather than being dropped.
assert.equal(
  entitySubscriptionDiagnosticFrame({
    type: "entity_error",
    subscription_id: "package-entities",
    entity_type: "project-pipelines.ticket",
    code: "entity_subscription_failed",
    message: "Plugin family unavailable"
  }).kind,
  "connection_diagnostic"
);
// Only entity_error produces a diagnostic; ordinary deltas do not.
assert.equal(
  entitySubscriptionDiagnosticFrame({
    type: "entity_remove",
    subscription_id: "session-subscription",
    entity_type: "session",
    snapshot_seq: 4,
    id: "gone"
  }),
  undefined
);
// The family-scoped projection carries Hub's code and message verbatim for the owning surface.
const entityErrorFrame = daemonEntityFrame(entityErrorInput);
assert.equal(entityErrorFrame.kind, "entity_error");
assert.deepEqual(entityErrorFrame.payload, {
  family: "session",
  code: "entity_subscription_failed",
  message: "Session family could not be projected"
});
sessionLifecycleStore.apply({
  operation: "entity_upsert",
  key: { family: "session", id: "post-resync-row" },
  sequence: sessionLifecycleFixture.overflow.resync_snapshot.snapshot_seq + 1,
  record: {
    id: "post-resync-row",
    session_uuid: "post-resync-row",
    lifecycle: "running",
    lifecycle_class: "current",
    registry_state: "active"
  }
});
assert.equal(sessionLifecycleStore.get("session", "post-resync-row").lifecycle_class, "current");

const transport = {
  sent: [],
  ingress: undefined,
  async connect(_capabilities, ingress) {
    this.ingress = ingress;
  },
  async disconnect() {
    this.ingress = undefined;
  },
  async send(frame) {
    this.sent.push(frame);
  },
  inject(frame) {
    this.ingress?.(frame);
  }
};
const runtime = createBotsterWebClient({
  transport,
  actionIdGenerator: deterministicIds("ui-action"),
  actionTimeoutMs: 10
});

await runtime.hub.connect({ client: "botster-web", capabilities: [] });
await runtime.hub.subscribe();
assert.equal(runtime.entities.list("session").length, 0);
assert.equal(transport.sent.filter((frame) => frame.kind === "entity_pull").length, 0);
assert.equal(runtime.uiTree.current(), undefined);

transport.inject({
  kind: "ui_tree_snapshot",
  payload: {
    kind: "ui_tree_snapshot",
    surface: "runtime-test",
    version: "test-v1",
    root: { id: "runtime-root", type: "text", props: { text: "Runtime snapshot" } }
  }
});
assert.equal(runtime.uiTree.current().surface, "runtime-test");

transport.inject({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: "session",
    sequence: 5,
    records: [
      { id: "session-1", title: "One" },
      { id: "session-2", title: "Two" }
    ]
  }
});
assert.deepEqual(runtime.entities.list("session").map((record) => record.id), [
  "session-1",
  "session-2"
]);

transport.inject({
  kind: "entity_upsert",
  payload: {
    operation: "entity_upsert",
    key: { family: "session", id: "session-3" },
    sequence: 6,
    record: { id: "ignored", title: "Three", active: false }
  }
});
assert.equal(runtime.entities.get("session", "session-3").title, "Three");

transport.inject({
  kind: "entity_patch",
  payload: {
    operation: "entity_patch",
    key: { family: "session", id: "session-3" },
    sequence: 7,
    record: { active: true }
  }
});
assert.deepEqual(runtime.entities.get("session", "session-3"), {
  id: "session-3",
  title: "Three",
  active: true
});

transport.inject({
  kind: "entity_remove",
  payload: {
    operation: "entity_remove",
    key: { family: "session", id: "session-2" },
    sequence: 8
  }
});
assert.equal(runtime.entities.get("session", "session-2"), undefined);

transport.inject({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: "session",
    sequence: 1,
    records: [{ id: "session-reset", title: "Reconnect baseline" }]
  }
});
assert.deepEqual(runtime.entities.list("session").map((record) => record.id), ["session-reset"]);

transport.inject({
  kind: "entity_patch",
  payload: {
    operation: "entity_patch",
    key: { family: "session", id: "session-reset" },
    sequence: 0,
    record: { title: "stale" }
  }
});
assert.equal(runtime.entities.get("session", "session-reset").title, "Reconnect baseline");

const actionResult = runtime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.session.select", target: "session-reset" }
});
const actionFrame = transport.sent.find((frame) => frame.kind === "action_request");
assert.equal(actionFrame.payload.request_id, "ui-action-1");
assert.equal(actionFrame.payload.action.id, "botster.session.select");
assert.equal(runtime.actions.pendingCount(), 1);

transport.inject({
  kind: "action_result",
  payload: {
    request_id: "unknown-request",
    accepted: true
  }
});
assert.equal(runtime.actions.pendingCount(), 1);

transport.inject({
  kind: "action_result",
  payload: {
    request_id: "ui-action-1",
    accepted: true,
    result: { selected: "session-reset" }
  }
});
assert.deepEqual(await actionResult, {
  accepted: true,
  request_id: "ui-action-1",
  result: { selected: "session-reset" },
  reason: undefined
});
assert.equal(runtime.actions.pendingCount(), 0);

await runtime.entities.pull({ family: "session" });
await runtime.hub.subscribeSurface({ surface: "workspace", path: "/sessions" });
transport.sent.length = 0;
await runtime.entities.replayActivePulls();
await runtime.hub.replaySurfaceSubscriptions();
assert.deepEqual(transport.sent.map((frame) => frame.kind), ["entity_pull", "surface_subscribe"]);

const configurablePackageConfiguration = {
  schema: {
    fields: [
      { key: "endpoint", type: "url", label: "Webhook endpoint", required: true },
      {
        key: "mode",
        type: "select",
        label: "Mode",
        default: { type: "select", value: "read" },
        options: [
          { value: "read", label: "Read" },
          { value: "write", label: "Write" }
        ]
      },
      { key: "enabled", type: "boolean", label: "Enabled", default: { type: "boolean", value: true } },
      { key: "api_token", type: "secret", label: "API token", required: true, default: { type: "secret", state: "unset" } }
    ]
  },
  effective_values: {
    mode: { type: "select", value: "read" },
    enabled: { type: "boolean", value: true },
    api_token: { type: "secret", state: "redacted" }
  },
  missing_required: ["endpoint"],
  diagnostics: []
};
const configuredPackageConfiguration = {
  ...configurablePackageConfiguration,
  effective_values: {
    endpoint: { type: "url", value: "https://example.invalid/hook" },
    mode: { type: "select", value: "read" },
    enabled: { type: "boolean", value: true },
    api_token: { type: "secret", state: "redacted" }
  },
  missing_required: []
};
const botsterWebRemoteAccessConfiguration = {
  schema: packageManifest.configuration,
  effective_values: {
    remote_browser_rendezvous_enabled: { type: "boolean", value: false }
  },
  missing_required: [],
  diagnostics: []
};
const emptyPackageConfiguration = {};
const availablePackageAvailability = { state: "available", reasons: [] };
const blockedGithubAvailability = {
  state: "blocked",
  reasons: [
    {
      reason: "auth_required",
      action: "enable_package",
      requirement: "github"
    }
  ]
};

function daemonAction(action_id, status, request, reason = undefined, diagnostics = []) {
  return {
    action_id,
    status,
    reason,
    diagnostics,
    required_references: [],
    request
  };
}

function packageRequest(request_type, package_name) {
  return { request_type, package_name };
}

function entrypointRequest(request_type, package_name, entrypoint_id) {
  return { request_type, package_name, entrypoint_id };
}

function installedPackageActions(package_name, enabled = true, configurable = false) {
  return [
    daemonAction("enable_package", enabled ? "unavailable" : "available", enabled ? null : packageRequest("enable_package", package_name), enabled ? "already_enabled" : undefined),
    daemonAction("disable_package", enabled ? "available" : "unavailable", enabled ? packageRequest("disable_package", package_name) : null, enabled ? undefined : "not_enabled"),
    daemonAction("remove_package", "available", packageRequest("remove_package", package_name)),
    daemonAction("set_package_configuration", configurable ? "available" : "unavailable", configurable ? packageRequest("set_package_configuration", package_name) : null, configurable ? undefined : "no_configuration_schema"),
    daemonAction("check_package_update", "available", packageRequest("check_package_update", package_name)),
    daemonAction("reload_package", "unavailable", null, "unsupported"),
    daemonAction("restart_hub", "unavailable", null, "unsupported")
  ];
}

function entrypointActions(package_name, entrypoint_id) {
  return [
    daemonAction("start_package_entrypoint", "available", entrypointRequest("start_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("stop_package_entrypoint", "available", entrypointRequest("stop_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("restart_package_entrypoint", "available", entrypointRequest("restart_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("package_entrypoint_status", "available", entrypointRequest("package_entrypoint_status", package_name, entrypoint_id))
  ];
}

const bridgeRequests = [];
const bridgeTerminalStreams = [];
const bridgeEntitySubscriptions = [];
let authoritativeSessionItems = [];
let authoritativeHubUpdate = {
  state: "current",
  current_version: "0.1.0",
  reason: "Development checkouts are updated with git.",
  action: "git pull"
};
// Hub-shaped session_type rows: interactive agent, interactive accessory, service
// accessory, a read-only package row, an override winner, and an unknown namespaced
// role/trait. Deliberately no title/subtitle -- Web must render Hub's own label.
const authoritativeSessionTypeItems = [
  {
    session_type_id: "device/codex",
    source_name: "device",
    id: "codex",
    source: "device",
    editable: true,
    label: "Codex agent",
    description: "Interactive coding agent",
    role: "botster.agent",
    interaction: "interactive",
    traits: ["terminal"],
    lifecycle: "task",
    command: "codex",
    args: ["--interactive"],
    working_directory_policy: "spawn_target",
    allowed_environment_overrides: ["CODEX_TOKEN"],
    context_keys: ["prompt"],
    target_id: "project-main",
    available: true
  },
  {
    session_type_id: "device/companion",
    source_name: "device",
    id: "companion",
    source: "device",
    editable: true,
    label: "Companion shell",
    role: "botster.accessory",
    interaction: "interactive",
    traits: ["terminal", "companion"],
    lifecycle: "persistent",
    command: "bash",
    working_directory_policy: "spawn_target",
    context_keys: [],
    target_id: "project-main",
    available: true
  },
  {
    session_type_id: "device/watcher",
    source_name: "device",
    id: "watcher",
    source: "device",
    editable: true,
    label: "Build watcher",
    role: "botster.accessory",
    interaction: "service",
    traits: ["background"],
    lifecycle: "persistent",
    command: "watch",
    working_directory_policy: "spawn_target",
    context_keys: [],
    target_id: "project-main",
    available: false
  },
  {
    session_type_id: "botster/reviewer",
    source_name: "botster",
    id: "reviewer",
    source: "package",
    editable: false,
    label: "Packaged reviewer",
    role: "botster.agent",
    interaction: "interactive",
    traits: ["terminal"],
    lifecycle: "task",
    command: "review",
    working_directory_policy: "package_root",
    context_keys: [],
    target_id: "project-main",
    available: true
  },
  {
    session_type_id: "project-main/repo-codex",
    source_name: "project-main",
    id: "repo-codex",
    source: "repo",
    editable: true,
    overridden_sources: [
      { kind: "device", name: "device" },
      { kind: "package", name: "botster" }
    ],
    diagnostics: ["repo definition overrides device and package definitions"],
    label: "Repo Codex",
    role: "acme.custom_role",
    interaction: "interactive",
    traits: ["acme.custom_trait"],
    lifecycle: "task",
    command: "codex",
    working_directory_policy: "spawn_target",
    context_keys: ["prompt"],
    target_id: "project-main",
    available: true
  }
];
const bridge = {
  async request(request) {
    bridgeRequests.push(request);
    if (request.type === "check_hub_update") {
      return {
        kind: "hub_update",
        hub_update: authoritativeHubUpdate,
        diagnostics: [{ kind: "connected", operation: "check_hub_update", message: "Hub update check completed" }]
      };
    }
    if (request.type === "status") {
      return {
        kind: "status",
        status: {
          lifecycle_state: "running",
          software: {
            product_id: "botster-hub",
            product_name: "Botster Hub",
            version: "0.1.0",
            build_revision: "8a60bd5"
          },
          installation: {
            mode: "development",
            provenance: "development_build"
          },
          compatibility: {
            protocol: "botster-hub-daemon-v1",
            protocol_version: 1,
            features: [
              "sessions",
              "terminal_streaming",
              "resize",
              "terminal_readback",
              "plugin_surface_render",
              "plugin_surface_action"
            ],
            conformance_fixture_revision: 14
          },
          host_id: "production-host",
          host_display_name: "Production Hub",
          schema_version: 1,
          data_dir_configured: true,
          core_initialized: true,
          state_source: "explicit",
          package_count: 3,
          enabled_package_count: 1,
          provider_count: 0,
          enabled_provider_count: 0,
          session_count: 1,
          recovered_sessions: [],
          stale_sessions: [],
          diagnostics: [
            {
              kind: "connected",
              message: "Hub control channel is connected"
            }
          ]
        },
        sessions: [],
        events: [],
        diagnostics: [
          {
            kind: "unsupported_feature",
            feature: "terminal_streaming"
          }
        ]
      };
    }

    if (request.type === "list_apps") {
      return generatedAppResponseFixture;
    }

    if (request.type === "list_packages") {
      return {
        kind: "packages",
        packages: [
          {
            package_name: "botster-web",
            version: "0.1.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [],
            surfaces: packageManifest.surfaces,
            runnable_entrypoints: [
              {
                id: "web-client",
                kind: "web",
                command: "node",
                args: ["scripts/local-package-server.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [{ surface: "network", scope: "localhost" }],
                may_supervise: true,
                process: {
                  state: "running",
                  pid: 41821,
                  started_at: 1781112600,
                  diagnostics: []
                },
                actions: entrypointActions("botster-web", "web-client")
              }
            ],
            configuration: botsterWebRemoteAccessConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions("botster-web", true, true),
            provider_profile_admitted: false
          },
          {
            package_name: "project-pipelines",
            version: "0.8.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [
              { surface: "SessionActions", scope: "project-pipelines" },
              { surface: "McpTools", scope: null }
            ],
            surfaces: [
              {
                id: "home",
                kind: "app",
                title: "Pipelines",
                description: "Project Pipelines workbench",
                order: 1,
                category: "workflow",
                supports: ["render"]
              },
              {
                id: "settings",
                kind: "settings",
                title: "Pipeline Settings",
                description: "Project Pipelines settings",
                order: 2,
                supports: ["render"]
              }
            ],
            view_surface: { id: "legacy-view", title: "Legacy View" },
            settings_surface: { id: "legacy-settings", title: "Legacy Settings" },
            runnable_entrypoints: [
              {
                id: "web-client",
                kind: "web",
                command: "node",
                args: ["scripts/local-package-server.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [{ surface: "network", scope: "localhost" }],
                may_supervise: true,
                process: {
                  state: "running",
                  pid: 4273,
                  started_at: 1781112500,
                  diagnostics: []
                },
                actions: entrypointActions("project-pipelines", "web-client")
              },
              {
                id: "worker",
                kind: "daemon",
                command: "node",
                args: ["scripts/worker.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [],
                may_supervise: true,
                process: {
                  state: "failed",
                  started_at: 1781112400,
                  exited_at: 1781112460,
                  exit_status: "exit:42",
                  diagnostics: [{ kind: "stderr", message: "fixture failure" }]
                },
                actions: entrypointActions("project-pipelines", "worker")
              }
            ],
            configuration: configurablePackageConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [
              { id: "botster", package_name: "botster", state: "available", reasons: [] }
            ],
            feature_availability: [
              { id: "pipeline-runs", state: "available", reasons: [] }
            ],
            actions: installedPackageActions("project-pipelines", true, true),
            provider_profile_admitted: false
          },
          {
            package_name: "github-provider",
            version: "1.2.3",
            classification: "provider",
            state: "disabled",
            requested_capabilities: [{ surface: "ClientAdmission", scope: "github" }],
            surfaces: [
              {
                id: "settings",
                kind: "settings",
                title: "GitHub Settings",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [
              {
                id: "poller",
                kind: "provider",
                command: "node",
                args: ["scripts/poller.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "local",
                capabilities: [],
                may_supervise: true,
                process: {
                  state: "stopped",
                  started_at: 1781112100,
                  exited_at: 1781112200,
                  exit_status: "signal:term",
                  diagnostics: []
                },
                actions: entrypointActions("github-provider", "poller")
              }
            ],
            configuration: emptyPackageConfiguration,
            availability: blockedGithubAvailability,
            dependency_availability: [
              {
                id: "project-pipelines",
                package_name: "project-pipelines",
                state: "blocked",
                reasons: [{ reason: "dependency_disabled", action: "enable_package", package_name: "project-pipelines" }]
              }
            ],
            feature_availability: [
              {
                id: "github-prs",
                state: "blocked",
                reasons: [{ reason: "auth_required", action: "enable_package", requirement: "github" }]
              }
            ],
            actions: [
              daemonAction(
                "enable_package",
                "blocked",
                null,
                "auth_required",
                [{ kind: "auth_required", message: "GitHub auth is required" }]
              ),
              ...installedPackageActions("github-provider", false, false).filter((action) => action.action_id !== "enable_package")
            ],
            provider_profile_admitted: false
          },
          {
            package_name: "local-diagnostics",
            version: "0.1.0",
            classification: "plugin",
            state: "installed",
            requested_capabilities: [],
            surfaces: [
              {
                id: "misc",
                kind: "diagnostic",
                title: "Diagnostics",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [],
            configuration: emptyPackageConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions("local-diagnostics", false, false),
            provider_profile_admitted: false
          }
        ],
        events: [],
        diagnostics: [
          {
            kind: "connected",
            operation: "list_packages",
            message: "Package registry listed"
          }
        ]
      };
    }

    if (request.type === "set_package_configuration") {
      const endpoint = request.values.endpoint;
      const configuration =
        endpoint && typeof endpoint === "object" && "value" in endpoint && endpoint.value
          ? configuredPackageConfiguration
          : configurablePackageConfiguration;
      return {
        kind: "packages",
        packages: [
          {
            package_name: request.package_name,
            version: "0.8.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [{ surface: "SessionActions", scope: "project-pipelines" }],
            surfaces: [
              {
                id: "home",
                kind: "app",
                title: "Pipelines",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [],
            configuration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions(request.package_name, true, true),
            provider_profile_admitted: false
          }
        ],
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "list_sessions") {
      return {
        kind: "sessions",
        sessions: [{ session_id: activeHubSessionId, lifecycle: "running" }],
        events: []
      };
    }

    if (
      request.type === "create_session_type" ||
      request.type === "update_session_type" ||
      request.type === "delete_session_type"
    ) {
      return { kind: "session_types", session_types: [], sessions: [], events: [] };
    }

    if (request.type === "list_session_types_for_target") {
      return {
        kind: "session_types",
        session_types: authoritativeSessionTypeItems.map((item) => ({
          ...item,
          // List context target_id is the admitted spawn point, not storage provenance.
          target_id: request.target_id
        })),
        sessions: [],
        events: []
      };
    }

    if (request.type === "plugin_surface_render") {
      if (request.package_name === "botster-web") {
        const settings = request.surface_id === "production-settings";
        const bodyText = settings
          ? "Deterministic settings surface rendered by the botster-web validation package."
          : "Deterministic app surface rendered by the botster-web validation package.";
        return {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: request.surface_id,
            body: bodyText,
            ui_tree_snapshot: {
              package_name: "botster-web",
              surface_id: request.surface_id,
              body: {
                id: `botster-web-${request.surface_id}-root`,
                type: "section",
                props: { title: settings ? "botster-web Settings" : "botster-web App" },
                children: [
                  {
                    id: `botster-web-${request.surface_id}-copy`,
                    type: "text",
                    props: { text: bodyText }
                  }
                ]
              }
            }
          },
          events: [],
          diagnostics: []
        };
      }

      return {
        kind: "plugin_surface",
        plugin_surface: {
          package_name: request.package_name,
          surface_id: request.surface_id,
          body: { rendered: true },
          ui_tree_snapshot: {
            package_name: request.package_name,
            surface_id: request.surface_id,
            body: {
              id: `${request.package_name}-${request.surface_id}-root`,
              type: "section",
              props: { title: "Rendered plugin surface" }
            }
          }
        },
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "plugin_surface_action") {
      return {
        kind: "plugin_action_result",
        plugin_action_result: {
          request_id: request.request.request_id,
          surface_id: request.request.surface_id,
          action_id: request.request.action_id,
          node_id: request.request.node_id,
          state: "accepted",
          payload: { message: `${request.request.action_id} accepted` }
        },
        events: [],
        diagnostics: []
      };
    }

    if (
      request.type === "enable_package" ||
      request.type === "disable_package" ||
      request.type === "remove_package" ||
      request.type === "start_package_entrypoint" ||
      request.type === "stop_package_entrypoint" ||
      request.type === "restart_package_entrypoint" ||
      request.type === "package_entrypoint_status"
    ) {
      return {
        kind: "packages",
        packages: [],
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "spawn") {
      authoritativeSessionItems = [{
        session_uuid: request.session_id,
        registry_state: "active",
        lifecycle: "running",
        rows: 24,
        cols: 80,
        updated_at: 1
      }];
      return {
        kind: "spawned",
        sessions: [{ session_id: request.session_id, lifecycle: "running" }],
        events: [{ type: "session_lifecycle", session_id: request.session_id, state: "running" }]
      };
    }

    if (request.type === "spawn_session_type") {
      return {
        kind: "spawned",
        sessions: [{ session_id: request.session_id, lifecycle: "running" }],
        events: [{ type: "session_lifecycle", session_id: request.session_id, state: "running" }]
      };
    }

    if (request.type === "shutdown_session") {
      return {
        kind: "operator_error",
        sessions: [],
        events: [],
        error: {
          code: "session_not_found",
          request_id: "operator-error-1",
          operation: "shutdown_session",
          message: "Session not found"
        }
      };
    }

    if (request.type === "attach" || request.type === "drain") {
      return {
        kind: "events",
        events: [
          {
            type: "terminal_output",
            session_id: request.session_id,
            subscription_id: "botster-web-production-terminal",
            data: request.type === "attach" ? "botster-web-production-ready\r\n" : "botster-web-production-echo:ping\r\n"
          }
        ]
      };
    }

    if (request.type === "read_screen") {
      return {
        kind: "read_screen",
        read_screen: {
          session_id: request.session_id,
          text: "hub-owned-screen\r\n"
        },
        events: []
      };
    }

    return { kind: "events", events: [] };
  },
  subscribeEntityFrames(entityType, onFrame) {
    let resolveReady;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const subscription = { entityType, onFrame, unsubscribed: false };
    bridgeEntitySubscriptions.push(subscription);
    queueMicrotask(() => {
      onFrame({
        type: "entity_snapshot",
        subscription_id: `bridge-${entityType}-generation-1`,
        entity_type: entityType,
        snapshot_seq: 0,
        items: entityType === "session_type" ? authoritativeSessionTypeItems : authoritativeSessionItems
      });
      resolveReady();
    });
    return {
      ready,
      unsubscribe() {
        subscription.unsubscribed = true;
      }
    };
  },
  streamTerminal(sessionId, subscriptionId, onEvent) {
    bridgeTerminalStreams.push({ sessionId, subscriptionId });
    onEvent({
      type: "attach_state",
      session_id: sessionId,
      subscription_id: subscriptionId,
      state: "attaching"
    });
    onEvent({
      type: "snapshot",
      session_id: sessionId,
      subscription_id: subscriptionId,
      payload_base64: "AP9HVFkB",
      payload_encoding: "base64",
      bytes: 6
    });
    onEvent({
      type: "attach_state",
      session_id: sessionId,
      subscription_id: subscriptionId,
      state: "attached"
    });
    onEvent({
      type: "terminal_output",
      session_id: sessionId,
      subscription_id: subscriptionId,
      data: "botster-web-production-ready\r\n"
    });
    return {
      unsubscribe() {
        bridgeTerminalStreams.push({ sessionId, subscriptionId, unsubscribed: true });
      }
    };
  }
};

const localWebrtcBootstrapFixture = {
  grant_id: "grant-test",
  grant_secret: "secret-0000000000000000000000000000000000000000000000000000000000000000",
  package_name: "botster-web",
  entrypoint_id: "web-client",
  expected_origin: "http://127.0.0.1:41821",
  expires_at: 0,
  signaling_transport: "daemon_request",
  data_plane: "webrtc_data_channel",
  ordered: true,
  signaling_url: "http://127.0.0.1:41821/request"
};
const missingBootstrapMode = createHubRuntimeConfig({
  locationHref: "http://127.0.0.1:41821/",
  packageRuntime: true
});
assert.equal(missingBootstrapMode.mode, "webrtc");
assert.equal(missingBootstrapMode.statusText, "Local WebRTC bootstrap unavailable");
assert.match(missingBootstrapMode.startupError?.message ?? "", /requires a valid local WebRTC bootstrap grant/);
const productionMode = createHubRuntimeConfig({
  locationHref: "http://127.0.0.1:41821/",
  bridge,
  packageRuntime: true,
  localWebrtcBootstrap: localWebrtcBootstrapFixture
});
assert.equal(productionMode.mode, "webrtc");
assert.equal(productionMode.terminalDataPlaneKind, "webrtc");
assert.equal(productionMode.statusText, "Connected to local hub over WebRTC");
assert.equal(typeof productionMode.createTerminalDataPlane, "function");
const webRtcModeDiagnostics = initialConnectionDiagnostics(productionMode.mode, productionMode.statusText, productionMode.terminalDataPlaneKind);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "terminal-data-plane").title,
  "Terminal data plane: WebRTC DataChannel"
);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "webrtc-signaling-server").source,
  "signaling"
);
assert.match(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "packaged-ui-server").detail,
  /terminal bytes use WebRTC/
);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "package-asset-revision").title,
  "Package asset revision unknown"
);
const originalWindow = globalThis.window;
const lifecycleEvents = [];
globalThis.window = {
  location: { origin: "http://127.0.0.1:41821" },
  setTimeout,
  clearTimeout,
  dispatchEvent(event) {
    lifecycleEvents.push({ name: event.type, detail: event.detail });
    return true;
  }
};
try {
  const bootstrapRefreshRequests = [];
  const refreshedBootstrapFixture = {
    ...localWebrtcBootstrapFixture,
    grant_id: "grant-refresh",
    grant_secret: localWebrtcBootstrapFixture.grant_secret.replace(/0/g, "1")
  };
  const refreshedBootstrap = await createLocalWebrtcBootstrapRefresher({
    bootstrap: localWebrtcBootstrapFixture,
    signalingUrl: "http://127.0.0.1:41821/request",
    requestIdGenerator: () => "bootstrap-refresh-test",
    fetchImpl: async (url, init) => {
      const envelope = JSON.parse(init.body);
      bootstrapRefreshRequests.push({ url, envelope });
      return {
        ok: true,
        json: async () => ({
          kind: "daemon_response",
          request_id: envelope.request_id,
          payload: {
            kind: "local_webrtc_bootstrap",
            local_webrtc_bootstrap: refreshedBootstrapFixture
          }
        })
      };
    }
  })();
  assert.equal(bootstrapRefreshRequests[0].url, "http://127.0.0.1:41821/request");
  assert.deepEqual(bootstrapRefreshRequests[0].envelope, {
    kind: "daemon_request",
    request_id: "bootstrap-refresh-test",
    payload: {
      type: "issue_local_webrtc_bootstrap",
      package_name: "botster-web",
      entrypoint_id: "web-client",
      origin: "http://127.0.0.1:41821"
    }
  });
  assert.equal(refreshedBootstrap.grant_id, "grant-refresh");
  assert.equal(refreshedBootstrap.signaling_url, localWebrtcBootstrapFixture.signaling_url);

  const dataChannels = [createFakeDataChannel(), createFakeDataChannel()];
  let nextPeerConnectionIndex = 0;
  const dataChannel = dataChannels[0];
  const signalingRequests = [];
  const refreshedBootstraps = [
    refreshedBootstrapFixture,
    {
      ...localWebrtcBootstrapFixture,
      grant_id: "grant-refresh-2",
      grant_secret: localWebrtcBootstrapFixture.grant_secret.replace(/0/g, "2")
    }
  ];
  let refreshBootstrapCalls = 0;
  const webrtcClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    refreshBootstrap: async () => refreshedBootstraps[refreshBootstrapCalls++],
    peerConnectionFactory: () => createFakePeerConnection(dataChannels[nextPeerConnectionIndex++]),
    fetchImpl: async (_url, init) => {
      const envelope = JSON.parse(init.body);
      signalingRequests.push(envelope.payload);
      return {
        ok: true,
        json: async () => ({
          payload: {
            local_webrtc_answer: {
              grant_id: "grant-test",
              answer: { type: "answer", sdp: "answer-sdp" }
            }
          }
        })
      };
    }
  });
  const responsePromise = webrtcClient.request({ type: "status" });
  await waitForTestCondition(() => signalingRequests.length > 0);
  assert.equal(signalingRequests[0].type, "local_webrtc_signal");
  assert.equal(signalingRequests[0].grant_id, "grant-refresh");
  await waitForTestCondition(() => lifecycleEvents.some((event) => event.detail.type === "data-channel-open"));
  assert.equal(lifecycleEvents.find((event) => event.detail.type === "data-channel-open").name, webRtcDaemonLifecycleEventName);
  assert.equal(
    webRtcLifecycleDiagnostic(lifecycleEvents.find((event) => event.detail.type === "data-channel-open").detail).title,
    "WebRTC DataChannel open"
  );
  await waitForTestCondition(() => dataChannel.sent.length > 0);
  assert.equal(
    lifecycleEvents.some((event) => event.detail.type === "encrypted-stream-ready" && event.detail.requestType === "status"),
    true
  );
  assert.equal(
    webRtcLifecycleDiagnostic(lifecycleEvents.find((event) => event.detail.type === "encrypted-stream-ready").detail).title,
    "Encrypted client stream ready"
  );
  assert.equal(dataChannel.sent.length, 1);
  assert.doesNotMatch(dataChannel.sent[0], /"type":"status"/);
  const outboundEnvelope = JSON.parse(dataChannel.sent[0]);
  assert.deepEqual(Object.keys(outboundEnvelope).sort(), ["ciphertext", "nonce", "version"]);
  await emitChunkedTestResponse(dataChannel, refreshedBootstraps[0].grant_secret,
    { kind: "status", status: null, sessions: [], packages: [], package_decision: null, lifecycle: [], plugin_tools: [], plugin_tool_result: null, events: [], cleanup: null, coordination: null, error: null }
  );
  assert.equal((await responsePromise).kind, "status");
  const secondResponsePromise = webrtcClient.request({ type: "list_sessions" });
  await waitForTestCondition(() => dataChannel.sent.length > 1);
  await emitChunkedTestResponse(dataChannel, refreshedBootstraps[0].grant_secret, {
    kind: "sessions", sessions: [], events: [], diagnostics: []
  });
  assert.equal((await secondResponsePromise).kind, "sessions");
  assert.equal(
    lifecycleEvents.filter((event) => event.detail.type === "encrypted-stream-ready").length,
    1
  );
  dataChannel.close();
  await waitForTestCondition(() => lifecycleEvents.some((event) => event.detail.type === "data-channel-closed"));
  const reconnectResponsePromise = webrtcClient.request({ type: "list_apps" });
  await waitForTestCondition(() => signalingRequests.length === 2);
  assert.equal(signalingRequests[1].type, "local_webrtc_signal");
  assert.equal(signalingRequests[1].grant_id, "grant-refresh-2");
  await waitForTestCondition(() => dataChannels[1].sent.length > 0);
  assert.deepEqual(
    await decryptTestEnvelope(refreshedBootstraps[1].grant_secret, dataChannels[1].sent[0]),
    { type: "list_apps" }
  );
  await emitChunkedTestResponse(dataChannels[1], refreshedBootstraps[1].grant_secret, {
    kind: "apps", apps: [], events: [], diagnostics: []
  });
  assert.equal((await reconnectResponsePromise).kind, "apps");
  assert.equal(
    lifecycleEvents.filter((event) => event.detail.type === "encrypted-stream-ready").length,
    2
  );

  const entityChannels = [createFakeDataChannel(), createFakeDataChannel()];
  let nextEntitySubscriptionId = 0;
  const entityClient = createWebrtcTestClient(entityChannels, localWebrtcBootstrapFixture, {
    entitySubscriptionIdGenerator: (_entityType, generation) =>
      `session-generation-${generation}-${++nextEntitySubscriptionId}`
  });
  const receivedEntityFrames = [];
  const entitySubscription = entityClient.subscribeEntityFrames("session", (frame) => {
    receivedEntityFrames.push(frame);
  });
  await waitForTestCondition(() => entityChannels[0].sent.length === 1);
  assert.deepEqual(
    await decryptTestEnvelope(localWebrtcBootstrapFixture.grant_secret, entityChannels[0].sent[0]),
    {
      type: "subscribe_entities",
      entity_type: "session",
      subscription_id: "session-generation-1-1"
    }
  );
  await emitChunkedTestResponse(
    entityChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_snapshot",
      subscription_id: "session-generation-1-1",
      entity_type: "session",
      snapshot_seq: 0,
      items: []
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-initial-snapshot" }
  );
  await emitChunkedTestResponse(
    entityChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "entity-subscribe-response" }
  );
  await entitySubscription.ready;
  assert.deepEqual(receivedEntityFrames.map((frame) => frame.type), ["entity_snapshot"]);

  const statusWhileSubscribed = entityClient.request({ type: "status" });
  await waitForTestCondition(() => entityChannels[0].sent.length === 2);
  await emitChunkedTestResponse(
    entityChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_upsert",
      subscription_id: "session-generation-1-1",
      entity_type: "session",
      snapshot_seq: 1,
      id: "external-session",
      entity: {
        session_uuid: "external-session",
        registry_state: "active",
        lifecycle: "running",
        rows: 24,
        cols: 80,
        updated_at: 1
      }
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-upsert" }
  );
  await emitChunkedTestResponse(
    entityChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    {
      kind: "status",
      status: null,
      sessions: [],
      packages: [],
      package_decision: null,
      lifecycle: [],
      plugin_tools: [],
      plugin_tool_result: null,
      events: [],
      cleanup: null,
      coordination: null,
      error: null
    },
    { messageId: "status-while-entity-streaming" }
  );
  assert.equal((await statusWhileSubscribed).kind, "status");
  assert.deepEqual(receivedEntityFrames.map((frame) => frame.type), ["entity_snapshot", "entity_upsert"]);

  await emitChunkedTestResponse(
    entityChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_patch",
      subscription_id: "stale-subscription",
      entity_type: "session",
      snapshot_seq: 2,
      id: "external-session",
      patch: { rows: 99 }
    },
    { deliveryKind: "daemon_entity_frame", messageId: "stale-entity-patch" }
  );
  assert.equal(receivedEntityFrames.length, 2);

  entityChannels[0].close();
  await waitForTestCondition(() => entityChannels[1].sent.length === 1);
  assert.deepEqual(
    await decryptTestEnvelope(localWebrtcBootstrapFixture.grant_secret, entityChannels[1].sent[0]),
    {
      type: "subscribe_entities",
      entity_type: "session",
      subscription_id: "session-generation-2-2"
    }
  );
  await emitChunkedTestResponse(
    entityChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "entity-reconnect-subscribe-response" }
  );
  await emitChunkedTestResponse(
    entityChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_patch",
      subscription_id: "session-generation-1-1",
      entity_type: "session",
      snapshot_seq: 2,
      id: "external-session",
      patch: { rows: 120 }
    },
    { deliveryKind: "daemon_entity_frame", messageId: "prior-generation-frame" }
  );
  assert.equal(receivedEntityFrames.length, 2);
  await emitChunkedTestResponse(
    entityChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_snapshot",
      subscription_id: "session-generation-2-2",
      entity_type: "session",
      snapshot_seq: 4,
      items: []
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-reconnect-snapshot" }
  );
  await waitForTestCondition(() => receivedEntityFrames.length === 3);
  assert.equal(receivedEntityFrames[2].subscription_id, "session-generation-2-2");
  entitySubscription.unsubscribe();
  await waitForTestCondition(() => entityChannels[1].sent.length === 2);
  await emitChunkedTestResponse(
    entityChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_unsubscribed", events: [], diagnostics: [] },
    { messageId: "entity-unsubscribe-response" }
  );
  entityClient.disconnect();

  const deltaBeforeSnapshotChannel = createFakeDataChannel();
  let nextResyncSubscriptionId = 0;
  const deltaBeforeSnapshotClient = createWebrtcTestClient(
    [deltaBeforeSnapshotChannel],
    localWebrtcBootstrapFixture,
    {
      entitySubscriptionIdGenerator: () => `resync-subscription-${++nextResyncSubscriptionId}`
    }
  );
  const resyncedFrames = [];
  const resyncSubscription = deltaBeforeSnapshotClient.subscribeEntityFrames(
    "session",
    (frame) => resyncedFrames.push(frame)
  );
  await waitForTestCondition(() => deltaBeforeSnapshotChannel.sent.length === 1);
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "resync-initial-subscribe-response" }
  );
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_upsert",
      subscription_id: "resync-subscription-1",
      entity_type: "session",
      snapshot_seq: 1,
      id: "too-early",
      entity: {
        session_uuid: "too-early",
        registry_state: "active",
        lifecycle: "running",
        rows: 24,
        cols: 80,
        updated_at: 1
      }
    },
    { deliveryKind: "daemon_entity_frame", messageId: "delta-before-snapshot" }
  );
  await waitForTestCondition(() => deltaBeforeSnapshotChannel.sent.length === 2);
  assert.deepEqual(
    await decryptTestEnvelope(localWebrtcBootstrapFixture.grant_secret, deltaBeforeSnapshotChannel.sent[1]),
    { type: "unsubscribe_entities", subscription_id: "resync-subscription-1" }
  );
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_unsubscribed", events: [], diagnostics: [] },
    { messageId: "resync-unsubscribe-response" }
  );
  await waitForTestCondition(() => deltaBeforeSnapshotChannel.sent.length === 3);
  assert.deepEqual(
    await decryptTestEnvelope(localWebrtcBootstrapFixture.grant_secret, deltaBeforeSnapshotChannel.sent[2]),
    {
      type: "subscribe_entities",
      entity_type: "session",
      subscription_id: "resync-subscription-2"
    }
  );
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "resync-second-subscribe-response" }
  );
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_snapshot",
      subscription_id: "resync-subscription-2",
      entity_type: "session",
      snapshot_seq: 5,
      items: [],
      resync_reason: "subscriber_overflow"
    },
    { deliveryKind: "daemon_entity_frame", messageId: "resync-authoritative-snapshot" }
  );
  await resyncSubscription.ready;
  assert.deepEqual(resyncedFrames.map((frame) => frame.type), ["entity_snapshot"]);
  resyncSubscription.unsubscribe();
  await waitForTestCondition(() => deltaBeforeSnapshotChannel.sent.length === 4);
  await emitChunkedTestResponse(
    deltaBeforeSnapshotChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_unsubscribed", events: [], diagnostics: [] },
    { messageId: "resync-final-unsubscribe-response" }
  );
  deltaBeforeSnapshotClient.disconnect();

  // Protocol 6 entity_error carries no snapshot_seq. It must be delivered to the listener
  // and must NOT reach the sequence-gap branch, where `undefined !== N + 1` would fire an
  // endless resubscribe. Satisfying tsc with a cast or an `in` guard would still ship that
  // loop, so this asserts the runtime behavior: no unsubscribe/resubscribe traffic follows.
  const entityErrorChannel = createFakeDataChannel();
  const entityErrorClient = createWebrtcTestClient([entityErrorChannel], localWebrtcBootstrapFixture, {
    entitySubscriptionIdGenerator: () => "entity-error-subscription-1"
  });
  const entityErrorFrames = [];
  const entityErrorSubscription = entityErrorClient.subscribeEntityFrames(
    "session",
    (frame) => entityErrorFrames.push(frame)
  );
  await waitForTestCondition(() => entityErrorChannel.sent.length === 1);
  await emitChunkedTestResponse(
    entityErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "entity-error-subscribe-response" }
  );
  await emitChunkedTestResponse(
    entityErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_snapshot",
      subscription_id: "entity-error-subscription-1",
      entity_type: "session",
      snapshot_seq: 4,
      items: []
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-error-baseline-snapshot" }
  );
  await entityErrorSubscription.ready;
  await emitChunkedTestResponse(
    entityErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_error",
      subscription_id: "entity-error-subscription-1",
      entity_type: "session",
      code: "entity_subscription_failed",
      message: "Session family could not be projected"
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-error-frame" }
  );
  await waitForTestCondition(() => entityErrorFrames.length === 2);
  assert.deepEqual(entityErrorFrames.map((frame) => frame.type), ["entity_snapshot", "entity_error"]);
  assert.deepEqual(entityErrorFrames[1], {
    type: "entity_error",
    subscription_id: "entity-error-subscription-1",
    entity_type: "session",
    code: "entity_subscription_failed",
    message: "Session family could not be projected"
  });
  // No resubscribe traffic: the only frame sent remains the original subscribe.
  assert.equal(entityErrorChannel.sent.length, 1);
  // A later in-sequence delta still applies, so the baseline sequence was not corrupted.
  await emitChunkedTestResponse(
    entityErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_remove",
      subscription_id: "entity-error-subscription-1",
      entity_type: "session",
      snapshot_seq: 5,
      id: "after-entity-error"
    },
    { deliveryKind: "daemon_entity_frame", messageId: "entity-error-following-delta" }
  );
  await waitForTestCondition(() => entityErrorFrames.length === 3);
  assert.deepEqual(entityErrorFrames.map((frame) => frame.type), ["entity_snapshot", "entity_error", "entity_remove"]);
  assert.equal(entityErrorChannel.sent.length, 1);
  entityErrorSubscription.unsubscribe();
  await waitForTestCondition(() => entityErrorChannel.sent.length === 2);
  await emitChunkedTestResponse(
    entityErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_unsubscribed", events: [], diagnostics: [] },
    { messageId: "entity-error-unsubscribe-response" }
  );
  entityErrorClient.disconnect();

  // The in-place transport-loss seam is installed ONLY when the live-protocol harness global
  // is present, so it cannot leak into an ordinary production runtime.
  assert.equal(globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__, undefined);
  const noHarnessChannel = createFakeDataChannel();
  const noHarnessClient = createWebrtcTestClient([noHarnessChannel], localWebrtcBootstrapFixture);
  assert.equal(globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__, undefined);
  noHarnessClient.disconnect();

  globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { events: [] };
  try {
    const seamChannel = createFakeDataChannel();
    const seamClient = createWebrtcTestClient([seamChannel], localWebrtcBootstrapFixture, {
      entitySubscriptionIdGenerator: () => "transport-seam-subscription-1"
    });
    const transportControl = globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__.transportControl;
    assert.equal(typeof transportControl?.closeDataChannel, "function");
    // No channel open yet, so there is nothing to close.
    assert.equal(transportControl.closeDataChannel(), false);

    const seamSubscription = seamClient.subscribeEntityFrames("session", () => {});
    await waitForTestCondition(() => seamChannel.sent.length === 1);
    await emitChunkedTestResponse(
      seamChannel,
      localWebrtcBootstrapFixture.grant_secret,
      { kind: "entity_subscribed", events: [], diagnostics: [] },
      { messageId: "transport-seam-subscribe-response" }
    );
    assert.equal(seamChannel.readyState, "open");
    const lifecycleBefore = lifecycleEvents.length;
    // Closes the real channel and takes the ordinary transport-loss path.
    assert.equal(transportControl.closeDataChannel(), true);
    assert.equal(seamChannel.readyState, "closed");
    assert.equal(
      lifecycleEvents.slice(lifecycleBefore).some((event) => event.detail?.type === "data-channel-closed"),
      true
    );
    // Idempotent: an already-closed channel reports nothing left to close.
    assert.equal(transportControl.closeDataChannel(), false);
    seamSubscription.unsubscribe();
    seamClient.disconnect();
  } finally {
    delete globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  }
  // entity_error is terminal for the subscription generation. It carries no snapshot_seq,
  // so it must not be read as a sequence gap: the client delivers it and stops. Any
  // resubscribe here would be the loop the session-type surface exists to avoid.
  const subscriptionErrorChannel = createFakeDataChannel();
  let nextSubscriptionErrorId = 0;
  const subscriptionErrorClient = createWebrtcTestClient(
    [subscriptionErrorChannel],
    localWebrtcBootstrapFixture,
    {
      entitySubscriptionIdGenerator: () => `session-type-subscription-${++nextSubscriptionErrorId}`
    }
  );
  const subscriptionErrorFrames = [];
  const sessionTypeSubscription = subscriptionErrorClient.subscribeEntityFrames(
    "session_type",
    (frame) => subscriptionErrorFrames.push(frame)
  );
  await waitForTestCondition(() => subscriptionErrorChannel.sent.length === 1);
  assert.deepEqual(
    await decryptTestEnvelope(localWebrtcBootstrapFixture.grant_secret, subscriptionErrorChannel.sent[0]),
    {
      type: "subscribe_entities",
      entity_type: "session_type",
      subscription_id: "session-type-subscription-1"
    }
  );
  await emitChunkedTestResponse(
    subscriptionErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_subscribed", events: [], diagnostics: [] },
    { messageId: "session-type-subscribe-response" }
  );
  await emitChunkedTestResponse(
    subscriptionErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_snapshot",
      subscription_id: "session-type-subscription-1",
      entity_type: "session_type",
      snapshot_seq: 0,
      items: []
    },
    { deliveryKind: "daemon_entity_frame", messageId: "session-type-snapshot" }
  );
  await sessionTypeSubscription.ready;
  await emitChunkedTestResponse(
    subscriptionErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      type: "entity_error",
      subscription_id: "session-type-subscription-1",
      entity_type: "session_type",
      code: "entity_provider_frame_too_large",
      message: "session_type snapshot exceeded the frame budget"
    },
    { deliveryKind: "daemon_entity_frame", messageId: "session-type-entity-error" }
  );
  await waitForTestCondition(() => subscriptionErrorFrames.length === 2);
  assert.deepEqual(
    subscriptionErrorFrames.map((frame) => frame.type),
    ["entity_snapshot", "entity_error"]
  );
  assert.equal(subscriptionErrorFrames[1].code, "entity_provider_frame_too_large");
  assert.equal(subscriptionErrorFrames[1].message, "session_type snapshot exceeded the frame budget");
  // Still exactly one outbound frame: the original subscribe. No unsubscribe, no resubscribe.
  assert.equal(subscriptionErrorChannel.sent.length, 1);
  sessionTypeSubscription.unsubscribe();
  await waitForTestCondition(() => subscriptionErrorChannel.sent.length === 2);
  await emitChunkedTestResponse(
    subscriptionErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "entity_unsubscribed", events: [], diagnostics: [] },
    { messageId: "session-type-unsubscribe-response" }
  );
  subscriptionErrorClient.disconnect();

  assert.deepEqual(localWebrtcResponseChunkLimits, {
    maximumFrameBytesExclusive: 65_536,
    maximumResponseBytes: 16_777_216,
    maximumAggregateRetainedBytes: 32 * 1_024 * 1_024,
    maximumConcurrentAssemblies: 16,
    maximumCompletedMessageIds: 64,
    requestTimeoutMs: 10_000,
    assemblyBookkeepingBytes: 256,
    chunkBookkeepingBytes: 64,
    completedMessageBookkeepingBytes: 64
  });

  const largeResponseChannel = createFakeDataChannel();
  const largeResponseClient = createWebrtcTestClient([largeResponseChannel], localWebrtcBootstrapFixture);
  const largeOperatorMessage = "large-response-".repeat(24_000);
  const largeResponse = {
    kind: "operator_error",
    error: {
      code: "large_response_test",
      request_id: "large-response-request",
      operation: "status",
      message: largeOperatorMessage
    },
    events: []
  };
  const largeResponsePromise = largeResponseClient.request({ type: "status" });
  await waitForTestCondition(() => largeResponseChannel.sent.length === 1);
  const largeResponseChunks = await emitChunkedTestResponse(
    largeResponseChannel,
    localWebrtcBootstrapFixture.grant_secret,
    largeResponse,
    { chunkPayloadBytes: 12_288, reordered: true, messageId: "large-production-response" }
  );
  assert.ok(Buffer.byteLength(largeOperatorMessage) > 256 * 1_024);
  assert.ok(largeResponseChunks.length > 1);
  assert.deepEqual(await largeResponsePromise, largeResponse);

  const operatorErrorChannel = createFakeDataChannel();
  const operatorErrorClient = createWebrtcTestClient([operatorErrorChannel], localWebrtcBootstrapFixture);
  const operatorErrorResponse = {
    kind: "operator_error",
    error: {
      code: "response_too_large",
      request_id: "operator-error-request",
      operation: "capture_snapshot",
      message: "daemon response exceeded its sender budget"
    },
    events: []
  };
  const operatorErrorPromise = operatorErrorClient.request({ type: "status" });
  await waitForTestCondition(() => operatorErrorChannel.sent.length === 1);
  const operatorErrorChunks = await emitChunkedTestResponse(
    operatorErrorChannel,
    localWebrtcBootstrapFixture.grant_secret,
    operatorErrorResponse,
    { messageId: "operator-error-response" }
  );
  assert.equal(operatorErrorChunks.length, 1);
  assert.deepEqual(await operatorErrorPromise, operatorErrorResponse);

  const duplicateChannel = createFakeDataChannel();
  const duplicateClient = createWebrtcTestClient([duplicateChannel], localWebrtcBootstrapFixture);
  const duplicateResponse = { kind: "sessions", sessions: [], events: [], diagnostics: [] };
  const duplicatePromise = duplicateClient.request({ type: "list_sessions" });
  await waitForTestCondition(() => duplicateChannel.sent.length === 1);
  const duplicateChunks = await chunkedTestResponse(
    localWebrtcBootstrapFixture.grant_secret,
    duplicateResponse,
    { chunkPayloadBytes: 40, messageId: "identical-duplicate-response" }
  );
  duplicateChannel.emitMessage(JSON.stringify(duplicateChunks[0]));
  duplicateChannel.emitMessage(JSON.stringify(duplicateChunks[0]));
  for (const chunk of duplicateChunks.slice(1)) duplicateChannel.emitMessage(JSON.stringify(chunk));
  assert.deepEqual(await duplicatePromise, duplicateResponse);

  const completedReplayChannels = [createFakeDataChannel(), createFakeDataChannel()];
  const completedReplayClient = createWebrtcTestClient(completedReplayChannels, localWebrtcBootstrapFixture);
  const completedResponse = { kind: "apps", apps: [], events: [], diagnostics: [] };
  const completedPromise = completedReplayClient.request({ type: "list_apps" });
  await waitForTestCondition(() => completedReplayChannels[0].sent.length === 1);
  const completedChunks = await emitChunkedTestResponse(
    completedReplayChannels[0],
    localWebrtcBootstrapFixture.grant_secret,
    completedResponse,
    { messageId: "completed-response" }
  );
  assert.deepEqual(await completedPromise, completedResponse);

  const replayTargetPromise = completedReplayClient.request({ type: "list_sessions" });
  const replayTargetRejection = assert.rejects(
    replayTargetPromise,
    (error) => error instanceof WebrtcDaemonClientError && /message id was already completed/.test(error.message)
  );
  await waitForTestCondition(() => completedReplayChannels[0].sent.length === 2);
  completedReplayChannels[0].emitMessage(JSON.stringify(completedChunks[0]));
  await replayTargetRejection;

  const completedReplayRecovery = completedReplayClient.request({ type: "status" });
  await waitForTestCondition(() => completedReplayChannels[1].sent.length === 1);
  await emitChunkedTestResponse(
    completedReplayChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    {
      kind: "status",
      status: null,
      sessions: [],
      packages: [],
      package_decision: null,
      lifecycle: [],
      plugin_tools: [],
      plugin_tool_result: null,
      events: [],
      cleanup: null,
      coordination: null,
      error: null
    },
    { messageId: "completed-response" }
  );
  assert.equal((await completedReplayRecovery).kind, "status");

  const boundedCompletedLedgerChannel = createFakeDataChannel();
  const boundedCompletedLedgerClient = createWebrtcTestClient(
    [boundedCompletedLedgerChannel],
    localWebrtcBootstrapFixture
  );
  const longMessageIdSuffix = "x".repeat(60_000);
  for (let index = 0; index < 600; index += 1) {
    const responsePromise = boundedCompletedLedgerClient.request({ type: "list_apps" });
    await waitForTestCondition(() => boundedCompletedLedgerChannel.sent.length === index + 1);
    await emitChunkedTestResponse(
      boundedCompletedLedgerChannel,
      localWebrtcBootstrapFixture.grant_secret,
      completedResponse,
      { messageId: `bounded-completed-response-${index}-${longMessageIdSuffix}` }
    );
    assert.deepEqual(await responsePromise, completedResponse);
  }
  assert.equal(boundedCompletedLedgerChannel.readyState, "open");

  const conflictingChannels = [createFakeDataChannel(), createFakeDataChannel()];
  const conflictingClient = createWebrtcTestClient(conflictingChannels, localWebrtcBootstrapFixture);
  const conflictingPromise = conflictingClient.request({ type: "status" });
  const conflictingRejection = assert.rejects(
    conflictingPromise,
    (error) => error instanceof WebrtcDaemonClientError && /conflicts with a duplicate index/.test(error.message)
  );
  await waitForTestCondition(() => conflictingChannels[0].sent.length === 1);
  const conflictingChunks = await chunkedTestResponse(
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "events", events: [] },
    { chunkPayloadBytes: 40, messageId: "conflicting-duplicate-response" }
  );
  conflictingChannels[0].emitMessage(JSON.stringify(conflictingChunks[0]));
  conflictingChannels[0].emitMessage(JSON.stringify({ ...conflictingChunks[0], payload: `${conflictingChunks[0].payload}x` }));
  await conflictingRejection;
  const recoveredPromise = conflictingClient.request({ type: "list_apps" });
  await waitForTestCondition(() => conflictingChannels[1].sent.length === 1);
  conflictingChannels[0].emitMessage("not-json-from-obsolete-peer");
  await emitChunkedTestResponse(
    conflictingChannels[1],
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "apps", apps: [], events: [], diagnostics: [] },
    { messageId: "recovered-response" }
  );
  assert.equal((await recoveredPromise).kind, "apps");

  const legacyFrameChannel = createFakeDataChannel();
  const legacyFrameClient = createWebrtcTestClient([legacyFrameChannel], localWebrtcBootstrapFixture);
  const legacyFramePromise = legacyFrameClient.request({ type: "status" });
  const legacyFrameRejection = assert.rejects(
    legacyFramePromise,
    (error) => error instanceof WebrtcDaemonClientError && /delivery chunk version is unsupported/.test(error.message)
  );
  await waitForTestCondition(() => legacyFrameChannel.sent.length === 1);
  legacyFrameChannel.emitMessage(await encryptTestEnvelope(
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "events", events: [] }
  ));
  await legacyFrameRejection;

  const oversizedFrameChannel = createFakeDataChannel();
  const oversizedFrameClient = createWebrtcTestClient([oversizedFrameChannel], localWebrtcBootstrapFixture);
  const oversizedFramePromise = oversizedFrameClient.request({ type: "status" });
  const oversizedFrameRejection = assert.rejects(
    oversizedFramePromise,
    (error) => error instanceof WebrtcDaemonClientError && /frame exceeds the transport limit/.test(error.message)
  );
  await waitForTestCondition(() => oversizedFrameChannel.sent.length === 1);
  oversizedFrameChannel.emitMessage("x".repeat(65_536));
  await oversizedFrameRejection;

  const malformedCases = [
    {},
    { version: 1, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "unknown", message_id: "x", chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "", chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: -1, chunk_count: 1, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: 2, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: 1, total_bytes: 16_777_217, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: "" },
    { version: 2, delivery_kind: "daemon_response", message_id: 1, chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: "1", total_bytes: 1, payload: "x" },
    { version: 2, delivery_kind: "daemon_response", message_id: "x", chunk_index: 0, chunk_count: 1, total_bytes: 1, payload: 1 }
  ];
  for (const [index, malformedChunk] of malformedCases.entries()) {
    const malformedChannel = createFakeDataChannel();
    const malformedClient = createWebrtcTestClient([malformedChannel], localWebrtcBootstrapFixture);
    const malformedPromise = malformedClient.request({ type: "status" });
    const malformedRejection = assert.rejects(malformedPromise, WebrtcDaemonClientError);
    await waitForTestCondition(() => malformedChannel.sent.length === 1);
    malformedChannel.emitMessage(index === 0 ? "not-json" : JSON.stringify(malformedChunk));
    await malformedRejection;
  }

  const concurrentChannel = createFakeDataChannel();
  const concurrentClient = createWebrtcTestClient([concurrentChannel], localWebrtcBootstrapFixture);
  const concurrentPromises = Array.from({ length: 17 }, () => concurrentClient.request({ type: "status" }));
  const concurrentRejection = Promise.all(concurrentPromises.map((promise) => assert.rejects(promise, WebrtcDaemonClientError)));
  await waitForTestCondition(() => concurrentChannel.sent.length === 17);
  for (let index = 0; index < 17; index += 1) {
    concurrentChannel.emitMessage(JSON.stringify({
      version: 2,
      delivery_kind: "daemon_response",
      message_id: `concurrent-response-${index}`,
      chunk_index: 0,
      chunk_count: 2,
      total_bytes: 2,
      payload: "x"
    }));
  }
  await concurrentRejection;

  const mismatchChannel = createFakeDataChannel();
  const mismatchClient = createWebrtcTestClient([mismatchChannel], localWebrtcBootstrapFixture);
  const mismatchPromise = mismatchClient.request({ type: "status" });
  const mismatchRejection = assert.rejects(
    mismatchPromise,
    (error) => error instanceof WebrtcDaemonClientError && /do not match declared total/.test(error.message)
  );
  await waitForTestCondition(() => mismatchChannel.sent.length === 1);
  mismatchChannel.emitMessage(JSON.stringify({
    version: 2,
    delivery_kind: "daemon_response",
    message_id: "total-mismatch",
    chunk_index: 0,
    chunk_count: 1,
    total_bytes: 2,
    payload: "x"
  }));
  await mismatchRejection;

  const metadataChannel = createFakeDataChannel();
  const metadataClient = createWebrtcTestClient([metadataChannel], localWebrtcBootstrapFixture);
  const metadataPromise = metadataClient.request({ type: "status" });
  const metadataRejection = assert.rejects(
    metadataPromise,
    (error) => error instanceof WebrtcDaemonClientError && /metadata conflicts/.test(error.message)
  );
  await waitForTestCondition(() => metadataChannel.sent.length === 1);
  metadataChannel.emitMessage(JSON.stringify({
    version: 2,
    delivery_kind: "daemon_response",
    message_id: "metadata-conflict",
    chunk_index: 0,
    chunk_count: 2,
    total_bytes: 2,
    payload: "x"
  }));
  metadataChannel.emitMessage(JSON.stringify({
    version: 2,
    delivery_kind: "daemon_response",
    message_id: "metadata-conflict",
    chunk_index: 1,
    chunk_count: 3,
    total_bytes: 3,
    payload: "x"
  }));
  await metadataRejection;

  const aggregateChannel = createFakeDataChannel();
  const aggregateClient = createWebrtcTestClient([aggregateChannel], localWebrtcBootstrapFixture);
  const aggregatePromises = Array.from({ length: 3 }, () => aggregateClient.request({ type: "status" }));
  const aggregateRejection = Promise.all(aggregatePromises.map((promise) => assert.rejects(
    promise,
    (error) => error instanceof WebrtcDaemonClientError && /aggregate retained-byte limit exceeded/.test(error.message)
  )));
  await waitForTestCondition(() => aggregateChannel.sent.length === 3);
  const aggregatePayload = "x".repeat(60_000);
  let aggregateChunkIndex = 0;
  while (aggregateChannel.readyState === "open") {
    for (let assemblyIndex = 0; assemblyIndex < 3; assemblyIndex += 1) {
      aggregateChannel.emitMessage(JSON.stringify({
        version: 2,
        delivery_kind: "daemon_response",
        message_id: `aggregate-response-${assemblyIndex}`,
        chunk_index: aggregateChunkIndex,
        chunk_count: 1_000,
        total_bytes: 16_777_216,
        payload: aggregatePayload
      }));
    }
    aggregateChunkIndex += 1;
    if (aggregateChunkIndex % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    if (aggregateChunkIndex > 1_000) assert.fail("aggregate retained-byte limit did not reject bounded state");
  }
  await aggregateRejection;

  const timeoutChannels = [createFakeDataChannel(), createFakeDataChannel()];
  const timeoutClient = createWebrtcTestClient(timeoutChannels, localWebrtcBootstrapFixture);
  const originalWindowSetTimeout = globalThis.window.setTimeout;
  const originalWindowClearTimeout = globalThis.window.clearTimeout;
  const controlledTimers = new Map();
  let nextControlledTimer = 0;
  globalThis.window.setTimeout = (callback) => {
    const timer = ++nextControlledTimer;
    controlledTimers.set(timer, callback);
    return timer;
  };
  globalThis.window.clearTimeout = (timer) => controlledTimers.delete(timer);
  try {
    const timeoutPromise = timeoutClient.request({ type: "status" });
    const timeoutRejection = assert.rejects(
      timeoutPromise,
      (error) => error instanceof WebrtcDaemonClientError && /assembly timed out/.test(error.message)
    );
    await waitForTestCondition(() => timeoutChannels[0].sent.length === 1);
    timeoutChannels[0].emitMessage(JSON.stringify({
      version: 2,
      delivery_kind: "daemon_response",
      message_id: "incomplete-timeout-response",
      chunk_index: 0,
      chunk_count: 2,
      total_bytes: 2,
      payload: "x"
    }));
    await flushMicrotasks();
    const assemblyTimeout = [...controlledTimers.values()].at(-1);
    assert.equal(typeof assemblyTimeout, "function");
    assemblyTimeout();
    await timeoutRejection;

    const afterTimeoutPromise = timeoutClient.request({ type: "list_apps" });
    await waitForTestCondition(() => timeoutChannels[1].sent.length === 1);
    timeoutChannels[0].emitMessage(JSON.stringify({
      version: 2,
      delivery_kind: "daemon_response",
      message_id: "incomplete-timeout-response",
      chunk_index: 1,
      chunk_count: 2,
      total_bytes: 2,
      payload: "y"
    }));
    await emitChunkedTestResponse(
      timeoutChannels[1],
      localWebrtcBootstrapFixture.grant_secret,
      { kind: "apps", apps: [], events: [], diagnostics: [] },
      { messageId: "after-timeout-response" }
    );
    assert.equal((await afterTimeoutPromise).kind, "apps");
  } finally {
    globalThis.window.setTimeout = originalWindowSetTimeout;
    globalThis.window.clearTimeout = originalWindowClearTimeout;
  }

  const staleAttachChannel = createFakeDataChannel();
  const staleAttachClient = createWebrtcTestClient([staleAttachChannel], localWebrtcBootstrapFixture);
  const staleAttachEvents = [];
  const staleAttachment = staleAttachClient.streamTerminal(
    "stale-attach-session",
    "stale-attach-subscription",
    (event) => staleAttachEvents.push(event)
  );
  await waitForTestCondition(() => staleAttachChannel.sent.length === 1);
  staleAttachment.unsubscribe();
  await waitForTestCondition(() => staleAttachChannel.sent.length === 2);
  await emitChunkedTestResponse(
    staleAttachChannel,
    localWebrtcBootstrapFixture.grant_secret,
    {
      kind: "events",
      events: [{
        type: "snapshot",
        session_id: "stale-attach-session",
        subscription_id: "stale-attach-subscription",
        data: "must-not-render",
        bytes: 15
      }]
    },
    { messageId: "stale-attach-response" }
  );
  await emitChunkedTestResponse(
    staleAttachChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "events", events: [] },
    { messageId: "stale-detach-response" }
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(staleAttachEvents, []);

  const invalidBootstrapClient = createWebrtcDaemonClient({
    bootstrap: {
      ...localWebrtcBootstrapFixture,
      grant_secret: "secret-invalid"
    },
    peerConnectionFactory: () => createFakePeerConnection(createFakeDataChannel()),
    fetchImpl: async () => {
      throw new Error("signaling should not be called for invalid bootstrap");
    }
  });
  await assert.rejects(
    invalidBootstrapClient.request({ type: "status" }),
    (error) => connectionFailureDiagnostic(false, error).id === "webrtc-bootstrap-failed"
  );

  const signalingFailureClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    peerConnectionFactory: () => createFakePeerConnection(createFakeDataChannel()),
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    })
  });
  await assert.rejects(
    signalingFailureClient.request({ type: "status" }),
    (error) => connectionFailureDiagnostic(false, error).id === "webrtc-signaling-failed"
  );
} finally {
  globalThis.window = originalWindow;
}
const mountedWebrtcInputs = [];
const mountedWebrtcDataPlane = {
  sessionId: activeHubSessionId,
  writeInput(data) {
    mountedWebrtcInputs.push(data);
  },
  subscribeOutput() {
    return { unsubscribe() {} };
  },
  detach() {}
};
let mountedInputListener;
const mountedWebrtcBridge = new DefaultTerminalViewBridge(() => ({
  mount() {},
  onInput(listener) {
    mountedInputListener = listener;
    return { unsubscribe() {} };
  },
  write() {},
  resize() {},
  focus() {},
  destroy() {}
}));
await mountedWebrtcBridge.mount(
  { dataset: {} },
  { sessionId: activeHubSessionId, renderer: "restty" }
);
await mountedWebrtcBridge.attach(
  { sessionId: activeHubSessionId, renderer: "restty" },
  mountedWebrtcDataPlane
);
mountedInputListener("webrtc-mounted-input\n");
assert.deepEqual(mountedWebrtcInputs, ["webrtc-mounted-input\n"]);

globalThis.window = {
  location: { origin: "http://127.0.0.1:41821" },
  setTimeout,
  clearTimeout
};
try {
  const mountedRealWebrtcDataChannel = createFakeDataChannel();
  const mountedRealWebrtcBridgeClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    peerConnectionFactory: () => createFakePeerConnection(mountedRealWebrtcDataChannel),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        payload: {
          local_webrtc_answer: {
            grant_id: "grant-test",
            answer: { type: "answer", sdp: "answer-sdp" }
          }
        }
      })
    })
  });
  let mountedRealWebrtcWritePromise;
  const mountedRealWebrtcDataPlane = {
    sessionId: activeHubSessionId,
    writeInput(data) {
      mountedRealWebrtcWritePromise = mountedRealWebrtcBridgeClient.request({
        type: "send_input",
        session_id: activeHubSessionId,
        data
      });
      return mountedRealWebrtcWritePromise;
    },
    subscribeOutput() {
      return { unsubscribe() {} };
    },
    detach() {}
  };
  let mountedRealWebrtcInputListener;
  const mountedRealWebrtcBridge = new DefaultTerminalViewBridge(() => ({
    mount() {},
    onInput(listener) {
      mountedRealWebrtcInputListener = listener;
      return { unsubscribe() {} };
    },
    write() {},
    resize() {},
    focus() {},
    destroy() {}
  }));
  await mountedRealWebrtcBridge.mount(
    { dataset: {} },
    { sessionId: activeHubSessionId, renderer: "restty" }
  );
  await mountedRealWebrtcBridge.attach(
    { sessionId: activeHubSessionId, renderer: "restty" },
    mountedRealWebrtcDataPlane
  );
  mountedRealWebrtcInputListener("webrtc-mounted-input\n");
  const mountedRealWebrtcInputRequest = await waitForEncryptedRequest(
    mountedRealWebrtcDataChannel,
    localWebrtcBootstrapFixture.grant_secret,
    (request) => request.type === "send_input" && request.data === "webrtc-mounted-input\n"
  );
  assert.deepEqual(mountedRealWebrtcInputRequest, {
    type: "send_input",
    session_id: activeHubSessionId,
    data: "webrtc-mounted-input\n"
  });
  await emitChunkedTestResponse(mountedRealWebrtcDataChannel,
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "events", events: [] }
  );
  await mountedRealWebrtcWritePromise;
  await mountedRealWebrtcBridge.detach({ sessionId: activeHubSessionId, renderer: "restty" });
} finally {
  globalThis.window = originalWindow;
}

const realTransport = createHubTransport({ bridge });
const realFrames = [];
await realTransport.connect({ client: "botster-web", capabilities: [] }, (frame) => realFrames.push(frame));
await flushMicrotasks();
await realTransport.send({ kind: "subscribe", payload: {} });
await realTransport.send({ kind: "entity_pull", payload: { family: "session" } });
bridgeEntitySubscriptions[0].onFrame({
  type: "entity_upsert",
  subscription_id: "bridge-session-generation-1",
  entity_type: "session",
  snapshot_seq: 1,
  id: "external-session",
  entity: {
    session_uuid: "external-session",
    registry_state: "active",
    lifecycle: "running",
    rows: 24,
    cols: 80,
    updated_at: 1
  }
});
bridgeEntitySubscriptions[0].onFrame({
  type: "entity_patch",
  subscription_id: "bridge-session-generation-1",
  entity_type: "session",
  snapshot_seq: 2,
  id: "external-session",
  patch: { rows: 31, cols: 101, updated_at: 2 }
});
bridgeEntitySubscriptions[0].onFrame({
  type: "entity_remove",
  subscription_id: "bridge-session-generation-1",
  entity_type: "session",
  snapshot_seq: 3,
  id: "external-session"
});
await realTransport.send({ kind: "surface_subscribe", payload: { surface: "botster-web.production.session" } });
await flushMicrotasks();
await realTransport.send({ kind: "entity_pull", payload: { family: "botster-web.app" } });
await flushMicrotasks();
await realTransport.send({ kind: "entity_pull", payload: { family: "botster-web.package" } });
await flushMicrotasks();
await realTransport.send({ kind: "entity_pull", payload: { family: "session_type" } });
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-list-session-types-for-target-1",
    origin: "ui_node",
    action: {
      id: "botster.session_type.daemon_request",
      target: "project-main",
      params: {
        daemon_request: {
          request_type: "list_session_types_for_target",
          target_id: "project-main"
        }
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-spawn-session-type-1",
    origin: "ui_node",
    action: {
      id: "botster.spawn_point.spawn_session",
      target: "project-main",
      params: {
        session_type_id: "device/codex",
        session_id: "spawned-from-point",
        prompt: "Review the current changes"
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-action-1",
    origin: "ui_node",
    action: { id: "botster.session.select", target: activeHubSessionId }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-missing-required",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "project-pipelines",
      params: {
        values: {}
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-1",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "project-pipelines",
      params: {
        values: {
          endpoint: { type: "url", value: "https://example.invalid/hook" },
          mode: { type: "select", value: "write" },
          enabled: { type: "boolean", value: true }
        }
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-remote-access",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "botster-web",
      params: {
        values: {
          remote_browser_rendezvous_enabled: { type: "boolean", value: true }
        }
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-plugin-surface-action-1",
    origin: "ui_node",
    action: {
      id: "ticket.open",
      label: "Open ticket",
      payload: {
        ticket_id: "ticket_123"
      },
      pluginSurface: {
        package_name: "project-pipelines",
        request: {
          surface_id: "home",
          action_id: "ticket.open",
          node_id: "ticket-row-123",
          kind: "submit",
          values: {
            title: "Canonical values"
          },
          payload: {
            ticket_id: "ticket_123"
          }
        }
      }
    }
  }
});
await flushMicrotasks();
for (const action of [
  {
    id: "botster.package.surface.render",
    target: "project-pipelines",
    params: { package_name: "project-pipelines", surface_id: "home" }
  },
  {
    id: "botster.package.surface.render",
    target: "botster-web",
    params: { package_name: "botster-web", surface_id: "production-app" }
  },
  {
    id: "botster.package.surface.render",
    target: "botster-web",
    params: { package_name: "botster-web", surface_id: "production-settings" }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "enable_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "disable_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "remove_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "reload_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "start_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "stop_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "restart_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "package_entrypoint_status", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  }
]) {
  await realTransport.send({
    kind: "action_request",
    payload: {
      request_id: `real-${action.id}`,
      origin: "ui_node",
      action
    }
  });
  await flushMicrotasks();
}
assert.equal(bridgeRequests.some((request) => request.type === "status"), true);
assert.equal(bridgeRequests.some((request) => request.type === "list_sessions"), false);
// session and session_type are both canonical held subscriptions, not pull families.
assert.equal(bridgeEntitySubscriptions.length, 2);
assert.deepEqual(
  bridgeEntitySubscriptions.map((subscription) => subscription.entityType).sort(),
  ["session", "session_type"]
);
assert.equal(
  realFrames.some(
    (frame) =>
      frame.kind === "entity_snapshot" &&
      frame.payload.family === "session" &&
      frame.payload.records.length === 0
  ),
  true
);
// The session_type snapshot arrives from the held subscription and carries Hub's own
// label, provenance, and editability -- no title/subtitle synthesised from the id.
const realSessionTypeSnapshot = realFrames.find(
  (frame) => frame.kind === "entity_snapshot" && frame.payload.family === "session_type"
);
assert.notEqual(realSessionTypeSnapshot, undefined);
assert.equal(realSessionTypeSnapshot.payload.records.length, authoritativeSessionTypeItems.length);
const realDeviceCodex = realSessionTypeSnapshot.payload.records.find((record) => record.id === "device/codex");
assert.equal(realDeviceCodex.label, "Codex agent");
assert.equal(realDeviceCodex.title, undefined);
assert.equal(realDeviceCodex.subtitle, undefined);
assert.equal(realDeviceCodex.source, "device");
assert.equal(realDeviceCodex.editable, true);
const realPackageReviewer = realSessionTypeSnapshot.payload.records.find(
  (record) => record.id === "botster/reviewer"
);
assert.equal(realPackageReviewer.editable, false);

// entity_error is BOTH a transport fact and a surface fact, and the split only works if
// emitEntityFrame emits both. Asserting the two projector functions in isolation cannot
// catch a dropped emit() -- this drives one entity_error through the real subscription
// path and requires both frames out the other side. Deleting either emit() reddens this.
const sessionTypeSubscription = bridgeEntitySubscriptions.find(
  (subscription) => subscription.entityType === "session_type"
);
const framesBeforeEntityError = realFrames.length;
sessionTypeSubscription.onFrame({
  type: "entity_error",
  subscription_id: "bridge-session_type-generation-1",
  entity_type: "session_type",
  code: "entity_provider_frame_too_large",
  message: "session_type snapshot exceeded the frame budget"
});
await flushMicrotasks();
const framesFromEntityError = realFrames.slice(framesBeforeEntityError);
const emittedDiagnostic = framesFromEntityError.find((frame) => frame.kind === "connection_diagnostic");
const emittedSurfaceError = framesFromEntityError.find((frame) => frame.kind === "entity_error");
assert.notEqual(emittedDiagnostic, undefined);
assert.notEqual(emittedSurfaceError, undefined);
assert.equal(emittedDiagnostic.payload.kind, "entity_provider_frame_too_large");
assert.equal(
  emittedDiagnostic.payload.message,
  "Entity subscription error for session_type: session_type snapshot exceeded the frame budget"
);
assert.deepEqual(emittedSurfaceError.payload, {
  family: "session_type",
  code: "entity_provider_frame_too_large",
  message: "session_type snapshot exceeded the frame budget"
});
// Terminal for the generation: nothing refetches and no management list request is provoked.
assert.equal(bridgeRequests.some((request) => request.type === "list_session_types"), false);

assert.equal(bridgeRequests.some((request) => request.type === "list_packages"), true);
assert.equal(bridgeRequests.some((request) => request.type === "spawn"), false);
// New session picker authority: target-scoped list through the real action → transport path.
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "list_session_types_for_target"),
  {
    type: "list_session_types_for_target",
    target_id: "project-main"
  }
);
const listForTargetResult = realFrames.find(
  (frame) =>
    frame.kind === "action_result" &&
    frame.payload?.request_id === "real-list-session-types-for-target-1"
);
assert.notEqual(listForTargetResult, undefined);
assert.equal(listForTargetResult.payload.accepted, true);
assert.equal(listForTargetResult.payload.result?.request_type, "list_session_types_for_target");
assert.equal(Array.isArray(listForTargetResult.payload.result?.session_types), true);
assert.equal(
  listForTargetResult.payload.result.session_types.some((row) => row.session_type_id === "device/codex"),
  true
);
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "spawn_session_type"),
  {
    type: "spawn_session_type",
    session_type_id: "device/codex",
    session_id: "spawned-from-point",
    request: {
      target_id: "project-main",
      context: { prompt: "Review the current changes" }
    }
  }
);
// Cold cut: the legacy management list-refresh path must stay gone.
assert.equal(bridgeRequests.some((request) => request.type === "list_session_templates"), false);
assert.equal(bridgeRequests.some((request) => request.type === "list_session_types"), false);
assert.equal(bridgeRequests.some((request) => /workspace_id/.test(JSON.stringify(request))), false);
const configSaveRequests = bridgeRequests.filter((request) => request.type === "set_package_configuration");
assert.equal(configSaveRequests.length, 3);
assert.deepEqual(configSaveRequests[0], {
  type: "set_package_configuration",
  package_name: "project-pipelines",
  values: {}
});
const configSaveRequest = configSaveRequests[1];
assert.deepEqual(configSaveRequest, {
  type: "set_package_configuration",
  package_name: "project-pipelines",
  values: {
    endpoint: { type: "url", value: "https://example.invalid/hook" },
    mode: { type: "select", value: "write" },
    enabled: { type: "boolean", value: true }
  }
});
assert.doesNotMatch(JSON.stringify(configSaveRequest), /api_token|redacted|write_only|super-secret-token/);
assert.deepEqual(configSaveRequests[2], {
  type: "set_package_configuration",
  package_name: "botster-web",
  values: {
    remote_browser_rendezvous_enabled: { type: "boolean", value: true }
  }
});
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "plugin_surface_render"),
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: {}
  }
);
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "plugin_surface_action"),
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    request: {
      request_id: "real-plugin-surface-action-1",
      surface_id: "home",
      action_id: "ticket.open",
      node_id: "ticket-row-123",
      kind: "submit",
      values: {
        title: "Canonical values"
      },
      payload: {
        ticket_id: "ticket_123"
      }
    }
  }
);
assert.deepEqual(
  bridgeRequests.filter((request) => request.type === "plugin_surface_render" && request.package_name === "botster-web"),
  [
    {
      type: "plugin_surface_render",
      package_name: "botster-web",
      surface_id: "production-app",
      payload: {}
    },
    {
      type: "plugin_surface_render",
      package_name: "botster-web",
      surface_id: "production-settings",
      payload: {}
    }
  ]
);
assert.equal(bridgeRequests.some((request) => request.type === "enable_package" && request.package_name === "project-pipelines"), true);
assert.equal(bridgeRequests.some((request) => request.type === "disable_package" && request.package_name === "project-pipelines"), true);
assert.equal(bridgeRequests.some((request) => request.type === "remove_package" && request.package_name === "project-pipelines"), true);
assert.equal(bridgeRequests.some((request) => request.type === "reload_package" && request.package_name === "project-pipelines"), true);
assert.equal(
  bridgeRequests.some((request) => request.type === "start_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "stop_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "restart_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "package_entrypoint_status" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(bridgeRequests.some((request) => request.type === "list_apps"), true);
assert.equal(bridgeRequests.some((request) => /legacy/.test(JSON.stringify(request))), false);
assert.equal(bridgeRequests.some((request) => /update_package|restart_hub/.test(request.type)), false);
assert.equal(realFrames.some((frame) => frame.kind === "ui_tree_snapshot"), false);
assert.equal(realFrames.some((frame) => frame.kind === "entity_snapshot"), true);
assert.equal(
  realFrames.some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package"),
  true
);
assert.equal(
  realFrames.some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app"),
  true
);
assert.equal(
  realFrames.some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "session_type"),
  true
);
// The Web-owned pull family is gone entirely; no alias, no dual schema.
assert.equal(
  realFrames.some((frame) => frame.payload?.family === "botster-web.session_template"),
  false
);
assert.equal(realFrames.some((frame) => frame.kind === "entity_patch"), true);
assert.equal(realFrames.some((frame) => frame.kind === "action_result"), true);

const realRuntime = createBotsterWebClient({
  transport: productionMode.transport,
  actionIdGenerator: deterministicIds("real-runtime-action"),
  actionTimeoutMs: 50
});
await realRuntime.hub.connect({ client: "botster-web", capabilities: [] });
await realRuntime.hub.subscribeSurface({ surface: "botster-web.production.session", path: "/sessions/real-hub" });
await realRuntime.entities.pull({ family: "botster-web.hub_status" });
await realRuntime.entities.pull({ family: "botster-web.package" });
await realRuntime.entities.pull({ family: "session" });
await flushMicrotasks();
assert.equal(realRuntime.uiTree.current(), undefined);
assert.deepEqual(realRuntime.entities.list("session").map((record) => record.id), []);
assert.equal(realRuntime.entities.get("session", "session-local-1"), undefined);
assert.equal(realRuntime.entities.get("botster-web.hub_status", "local-hub").host_id, "production-host");
assert.deepEqual(realRuntime.entities.get("botster-web.hub_status", "local-hub").software, {
  product_id: "botster-hub",
  product_name: "Botster Hub",
  version: "0.1.0",
  build_revision: "8a60bd5"
});
assert.deepEqual(realRuntime.entities.get("botster-web.hub_status", "local-hub").installation, {
  mode: "development",
  provenance: "development_build"
});
assert.equal(realRuntime.entities.get("botster-web.hub_status", "local-hub").schema_version, 1);
// Hub identity must never be derived from a package row: the authoritative facts are
// present with zero botster-hub package rows loaded.
assert.equal(realRuntime.entities.list("botster-web.package").some((row) => row.package_name === "botster-hub"), false);
// Support diagnostics survive the software/installation addition to statusRecord().
assert.equal(
  realRuntime.entities.get("botster-web.hub_status", "local-hub").diagnostics
    .some((diagnostic) => diagnostic.message === "Hub control channel is connected"),
  true
);
assert.equal(
  realRuntime.entities.get("botster-web.hub_status", "local-hub").diagnostics
    .some((diagnostic) => diagnostic.kind === "unsupported_feature"),
  true
);

// botster.hub.check_update issues the Hub self-update request and the outcome is
// authored entirely by the accepted action result.
const hubUpdateCurrentResult = await realRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.hub.check_update", label: "Check for updates" }
});
assert.deepEqual(bridgeRequests.filter((request) => request.type === "check_hub_update"), [{ type: "check_hub_update" }]);
assert.equal(bridgeRequests.some((request) => request.type === "check_package_update"), false);
assert.equal(hubUpdateCurrentResult.accepted, true);
assert.deepEqual(hubUpdateCurrentResult.result.hub_update, {
  state: "current",
  current_version: "0.1.0",
  reason: "Development checkouts are updated with git.",
  action: "git pull"
});
assert.equal(hubUpdateCurrentResult.result.request_type, "check_hub_update");
assert.deepEqual(hubUpdateCurrentResult.result.diagnostics, [
  { kind: "connected", operation: "check_hub_update", message: "Hub update check completed" }
]);

authoritativeHubUpdate = {
  state: "available",
  current_version: "0.1.0",
  available_version: "0.2.0",
  build_revision: "deadbee",
  reason: "A managed release is published.",
  action: "Restart Hub to install 0.2.0"
};
const hubUpdateAvailableResult = await realRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.hub.check_update", label: "Check for updates" }
});
assert.equal(hubUpdateAvailableResult.result.hub_update.state, "available");
assert.equal(hubUpdateAvailableResult.result.hub_update.available_version, "0.2.0");

authoritativeHubUpdate = {
  state: "unavailable",
  current_version: "0.1.0",
  reason: "This installation is managed by the operating system package manager.",
  action: "Use your package manager"
};
const hubUpdateUnavailableResult = await realRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.hub.check_update", label: "Check for updates" }
});
assert.equal(hubUpdateUnavailableResult.result.hub_update.state, "unavailable");

// Error path: connected Hub answering check_hub_update with a DaemonOperatorError.
// This is a different code path from transport rejection and must not synthesize a state.
const hubUpdateErrorRuntime = createBotsterWebClient({
  transport: createHubTransport({
    bridge: {
      async request() {
        return {
          kind: "hub_update",
          hub_update: null,
          error: { code: "update_check_failed", message: "Release metadata could not be read", operation: "check_hub_update" },
          diagnostics: []
        };
      }
    }
  }),
  actionIdGenerator: deterministicIds("hub-update-error"),
  actionTimeoutMs: 50
});
const hubUpdateOperatorErrorFrames = [];
hubUpdateErrorRuntime.hub.onFrame((frame) => hubUpdateOperatorErrorFrames.push(frame));
await hubUpdateErrorRuntime.hub.connect({ client: "botster-web", capabilities: [] });
const hubUpdateErrorResult = await hubUpdateErrorRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.hub.check_update", label: "Check for updates" }
});
await flushMicrotasks();
assert.equal(hubUpdateErrorResult.accepted, false);
assert.equal(hubUpdateErrorResult.reason, "Release metadata could not be read");
assert.equal(hubUpdateErrorResult.result.hub_update, null);
const hubUpdateOperatorErrorFrame = hubUpdateOperatorErrorFrames.find((frame) => frame.kind === "operator_error");
assert.equal(hubUpdateOperatorErrorFrame.payload.code, "update_check_failed");
assert.equal(
  operatorErrorDiagnostic(hubUpdateOperatorErrorFrame).detail,
  "Release metadata could not be read"
);

// Offline path: no reachable Hub. The transport rejection surfaces as a rejected action
// result carrying the transport reason and no hub_update payload at all.
const hubUpdateOfflineRuntime = createBotsterWebClient({
  transport: createHubTransport({
    bridge: {
      async request() {
        throw new Error("Local WebRTC data channel is closed");
      }
    }
  }),
  actionIdGenerator: deterministicIds("hub-update-offline"),
  actionTimeoutMs: 50
});
const hubUpdateOfflineResult = await hubUpdateOfflineRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.hub.check_update", label: "Check for updates" }
});
assert.equal(hubUpdateOfflineResult.accepted, false);
assert.equal(hubUpdateOfflineResult.reason, "Local WebRTC data channel is closed");
assert.equal(hubUpdateOfflineResult.result, undefined);
for (const daemonHubUpdateState of ["current", "available", "unavailable"]) {
  assert.equal(JSON.stringify(hubUpdateOfflineResult).includes(`"${daemonHubUpdateState}"`), false);
  assert.equal(JSON.stringify(hubUpdateErrorResult).includes(`"${daemonHubUpdateState}"`), false);
}

authoritativeHubUpdate = {
  state: "current",
  current_version: "0.1.0",
  reason: "Development checkouts are updated with git.",
  action: "git pull"
};

// botster-web.hub_status is a registered active pull, so it is replay-eligible after
// a WebRTC reconnect rather than depending on connect()'s one-shot status side effect.
const statusRequestsBeforeReplay = bridgeRequests.filter((request) => request.type === "status").length;
await realRuntime.entities.replayActivePulls();
await flushMicrotasks();
assert.equal(bridgeRequests.filter((request) => request.type === "status").length > statusRequestsBeforeReplay, true);
assert.equal(realRuntime.entities.get("botster-web.hub_status", "local-hub").software.product_name, "Botster Hub");
assert.equal(realRuntime.entities.get("botster-web.hub_status", "local-hub").schema_version, 1);
assert.deepEqual(realRuntime.entities.get("botster-web.hub_status", "local-hub").compatibility.protocol_version, 1);
assert.deepEqual(realRuntime.entities.list("botster-web.package").map((record) => record.id), [
  "botster-web",
  "project-pipelines",
  "github-provider",
  "local-diagnostics"
]);
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").status, "enabled");
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").app_surface_count, 0);
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").settings_surface_count, 0);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").status, "enabled");
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").capability_summary, /SessionActions:project-pipelines/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").capability_summary, /McpTools/);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_count, 2);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_summary, /web-client \(web\)/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_summary, /worker \(daemon\)/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /web-client running/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /pid 4273/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /worker failed/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /exit_status exit:42/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_diagnostics_summary, /worker stderr: fixture failure/);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").app_surface_count, 1);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").settings_surface_count, 1);
assert.deepEqual(realRuntime.entities.get("botster-web.package", "project-pipelines").app_surfaces[0].launch_action, {
  id: "botster.package.surface.render",
  target: "project-pipelines",
  label: "Pipelines",
  params: {
    package_name: "project-pipelines",
    surface_id: "home",
    surface_kind: "app",
    supports: ["render"]
  }
});
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").view_surface, undefined);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").settings_surface, undefined);
const projectPipelineActions = realRuntime.entities.get("botster-web.package", "project-pipelines").package_actions;
assert.equal(projectPipelineActions.find((action) => action.action_id === "enable_package").action.disabled, true);
assert.equal(projectPipelineActions.find((action) => action.action_id === "disable_package").action.id, "botster.package.daemon_request");
assert.equal(projectPipelineActions.find((action) => action.action_id === "remove_package").action.id, "botster.package.daemon_request");
assert.equal(projectPipelineActions.find((action) => action.action_id === "check_package_update").action.disabled, false);
assert.equal(projectPipelineActions.find((action) => action.action_id === "reload_package").action.disabled, true);
assert.equal(projectPipelineActions.find((action) => action.action_id === "restart_hub").action.disabled, true);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").availability_summary, /No blocked reasons/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").dependency_availability_summary, /botster available/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").feature_availability_summary, /pipeline-runs available/);
assert.deepEqual(
  realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_actions.map((entrypointAction) => entrypointAction.action_id).slice(0, 4),
  [
    "start_package_entrypoint",
    "stop_package_entrypoint",
    "restart_package_entrypoint",
    "package_entrypoint_status"
  ]
);
assert.equal(
  realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_actions.every((entrypointAction) => entrypointAction.action.id === "botster.package.daemon_request"),
  true
);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").status, "disabled");
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").availability_summary, /enable_package: auth_required/);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").app_surface_count, 0);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").settings_surface_count, 1);
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").entrypoint_process_summary, /poller stopped/);
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").entrypoint_process_summary, /exited_at 1781112200/);
assert.equal(realRuntime.entities.get("botster-web.package", "local-diagnostics").capability_summary, "No requested capabilities");
assert.equal(realRuntime.entities.get("botster-web.package", "local-diagnostics").entrypoint_summary, "No runnable entrypoints");
assert.deepEqual(realRuntime.entities.get("botster-web.hub_status", "local-hub").compatibility.features, [
  "sessions",
  "terminal_streaming",
  "resize",
  "terminal_readback",
  "plugin_surface_render",
  "plugin_surface_action"
]);
assert.equal(
  daemonResponseFrames({ kind: "status", sessions: [], packages: [], events: [] }, 21)
    .some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "session"),
  false
);
assert.equal(
  daemonResponseFrames({ kind: "sessions", sessions: [], packages: [], events: [] }, 21)
    .some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "session"),
  false
);
assert.equal(
  daemonResponseFrames({
    kind: "spawned",
    sessions: [{ session_id: "spawned-target", lifecycle: "running" }],
    packages: [],
    events: []
  }, 22).some((frame) => frame.kind.startsWith("entity_") && frame.payload.family === "session"),
  false
);

const runtimeDiagnostics = [];
const diagnosticRuntime = createBotsterWebClient({
  transport: productionMode.transport,
  actionIdGenerator: deterministicIds("diagnostic-runtime-action"),
  actionTimeoutMs: 50
});
diagnosticRuntime.hub.onFrame((frame) => {
  const schemaDiagnostic = schemaVersionInformationFromFrame(frame);
  if (schemaDiagnostic) runtimeDiagnostics.push(schemaDiagnostic);
  const hubDiagnostic = hubConnectionDiagnosticFromFrame(frame);
  if (hubDiagnostic) runtimeDiagnostics.push(hubDiagnostic);
  runtimeDiagnostics.push(...compatibilityDiagnosticsFromFrame(frame));
});
await diagnosticRuntime.hub.connect({ client: "botster-web", capabilities: [] });
await flushMicrotasks();
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "schema-version"), true);
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "hub-compatibility"), false);
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "hub-diagnostic-connected"), true);
assert.equal(
  runtimeDiagnostics.some(
    (diagnostic) =>
      diagnostic.id === "hub-diagnostic-unsupported_feature-terminal_streaming" &&
      diagnostic.detail.includes("Capability: terminal_streaming")
  ),
  true
);
assert.equal(
  runtimeDiagnostics.some((diagnostic) => diagnostic.title === "Hub compatibility descriptor compatible"),
  false
);

const hubDiagnosticFrames = daemonResponseFrames({
  kind: "status",
  status: {
    lifecycle_state: "running",
    compatibility: {
      protocol: "botster-hub-daemon-v1",
      protocol_version: 1,
      features: [
        "sessions",
        "terminal_streaming",
        "resize",
        "plugin_surface_render",
        "plugin_surface_action"
      ],
      conformance_fixture_revision: 1
    },
    host_id: "production-host",
    host_display_name: "Production Hub",
    schema_version: 1,
    data_dir_configured: true,
    core_initialized: true,
    state_source: "explicit",
    package_count: 0,
    enabled_package_count: 0,
    provider_count: 0,
    enabled_provider_count: 0,
    session_count: 1,
    recovered_sessions: [],
    stale_sessions: [],
    diagnostics: [
      {
        kind: "compatibility_mismatch",
        message: "Hub protocol is not compatible",
        operation: "status"
      }
    ]
  },
  events: [
    {
      type: "runtime_observation",
      kind: "terminal_stream_unavailable"
    }
  ],
  diagnostics: [
    {
      kind: "action_failure",
      message: "Spawn action failed",
      operation: "spawn"
    }
  ]
}, 11).filter((frame) => frame.kind === "connection_diagnostic");
assert.equal(hubDiagnosticFrames.length, 3);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "compatibility_mismatch")).title,
  "Hub compatibility mismatch"
);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "terminal_stream_unavailable")).title,
  "Terminal stream unavailable"
);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")).source,
  "action"
);
assert.match(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")).detail,
  /Operation: spawn/
);
assert.equal(
  streamDisconnectedDiagnostic(new Error("WebRTC closed")).title,
  "Control stream disconnected"
);

const mappedFrames = daemonResponseFrames({
  kind: "operator_error",
  events: [],
  error: {
    code: "invalid",
    request_id: "operator-error-2",
    operation: "test",
    message: "Invalid request"
  }
}, 10);
assert.equal(mappedFrames.some((frame) => frame.kind === "operator_error"), true);
assert.equal(operatorErrorDiagnostic(mappedFrames.find((frame) => frame.kind === "operator_error")).title, "Hub operator error");

const spawnFailureDiagnosticMessage = "Spawn failed before terminal attach; the requested session already exists.";
const spawnFailureFrames = daemonResponseFrames({
  kind: "operator_error",
  sessions: [],
  packages: [],
  events: [],
  error: {
    code: "session_already_exists",
    request_id: "spawn-failure-runtime",
    operation: "spawn",
    message: "runtime failed while handling Spawn: Runtime"
  },
  diagnostics: [
    {
      kind: "action_failure",
      operation: "spawn",
      feature: null,
      message: spawnFailureDiagnosticMessage
    }
  ]
}, 12);
const spawnFailureOperatorDiagnostic = operatorErrorDiagnostic(spawnFailureFrames.find((frame) => frame.kind === "operator_error"));
const spawnFailureHubDiagnostic = hubConnectionDiagnosticFromFrame(
  spawnFailureFrames.find((frame) => frame.kind === "connection_diagnostic")
);
assert.equal(spawnFailureFrames.some((frame) => frame.kind === "operator_error"), true);
assert.equal(spawnFailureFrames.some((frame) => frame.kind === "connection_diagnostic"), true);
assert.equal(spawnFailureOperatorDiagnostic.title, "Hub operator error");
assert.equal(spawnFailureOperatorDiagnostic.detail, "runtime failed while handling Spawn: Runtime");
assert.equal(spawnFailureHubDiagnostic.title, "Hub action failed");
assert.equal(spawnFailureHubDiagnostic.severity, "warning");
assert.equal(spawnFailureHubDiagnostic.source, "action");
assert.match(spawnFailureHubDiagnostic.detail, new RegExp(spawnFailureDiagnosticMessage));
assert.match(spawnFailureHubDiagnostic.detail, /Operation: spawn/);
assert.doesNotMatch(spawnFailureHubDiagnostic.detail, /Capability:/);

const schemaTwoInformation = schemaVersionInformationFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 2 }]
  }
});
assert.equal(schemaTwoInformation.title, "Hub durable-state schema");
assert.equal(schemaTwoInformation.severity, "info");
assert.equal(schemaTwoInformation.source, "server");
assert.match(schemaTwoInformation.detail, /durable-state schema version 2/);
assert.match(schemaTwoInformation.detail, /DaemonStatus\.compatibility/);
assert.doesNotMatch(schemaTwoInformation.detail, /compatible|mismatch|expected/i);

const schemaOneInformation = schemaVersionInformationFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 1 }]
  }
});
assert.equal(schemaOneInformation.title, "Hub durable-state schema");
assert.equal(schemaOneInformation.severity, "info");
assert.match(schemaOneInformation.detail, /durable-state schema version 1/);

const descriptorUnavailableDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 1 }]
  }
})[0];
assert.equal(descriptorUnavailableDiagnostic.title, "Hub compatibility descriptor unavailable");
assert.equal(descriptorUnavailableDiagnostic.id, "hub-compatibility");

const protocolMismatchDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "other-protocol",
          protocol_version: 1,
          features: [
            "sessions",
            "terminal_streaming",
            "resize",
            "terminal_readback",
            "plugin_surface_render",
            "plugin_surface_action"
          ],
          conformance_fixture_revision: 14
        }
      }
    ]
  }
})[0];
assert.equal(protocolMismatchDiagnostic.title, "Hub protocol mismatch");

const outdatedProtocolVersionDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 2,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: minimumDaemonProtocolVersion - 1,
          features: requiredDaemonFeatures,
          conformance_fixture_revision: minimumConformanceFixtureRevision
        }
      }
    ]
  }
})[0];
assert.equal(outdatedProtocolVersionDiagnostic.title, "Hub protocol version mismatch");
assert.equal(outdatedProtocolVersionDiagnostic.severity, "danger");

const missingCapabilityDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: ["sessions"],
          conformance_fixture_revision: 14
        }
      }
    ]
  }
})[0];
assert.equal(missingCapabilityDiagnostic.title, "Hub capability missing");
assert.match(missingCapabilityDiagnostic.detail, /terminal_streaming/);
assert.match(missingCapabilityDiagnostic.detail, /terminal_readback/);
assert.equal(missingCapabilityDiagnostic.id, "hub-compatibility");

for (const missingFeature of requiredDaemonFeatures) {
  const diagnostic = compatibilityDiagnosticsFromFrame({
    kind: "entity_snapshot",
    payload: {
      operation: "entity_snapshot",
      family: hubStatusFamily,
      records: [
        {
          id: "local-hub",
          schema_version: 2,
          compatibility: {
            protocol: "botster-hub-daemon-v1",
            protocol_version: minimumDaemonProtocolVersion,
            features: requiredDaemonFeatures.filter((feature) => feature !== missingFeature),
            conformance_fixture_revision: minimumConformanceFixtureRevision
          }
        }
      ]
    }
  })[0];
  assert.equal(diagnostic.title, "Hub capability missing");
  assert.equal(diagnostic.severity, "danger");
  assert.match(diagnostic.detail, new RegExp(missingFeature));
}

const outdatedConformanceDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: requiredDaemonFeatures,
          conformance_fixture_revision: 13
        }
      }
    ]
  }
})[0];
assert.equal(outdatedConformanceDiagnostic.title, "Hub conformance fixture mismatch");
assert.match(outdatedConformanceDiagnostic.detail, /revision 13 is below required revision 14/);

const compatibleDescriptorDiagnostics = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: [
            "sessions",
            "terminal_streaming",
            "resize",
            "terminal_readback",
            "plugin_surface_render",
            "plugin_surface_action"
          ],
          conformance_fixture_revision: 14
        }
      }
    ]
  }
});
const [compatibleDescriptorDiagnostic] = compatibleDescriptorDiagnostics;
assert.deepEqual(requiredDaemonFeatures, [
  "sessions",
  "terminal_streaming",
  "resize",
  "terminal_readback",
  "plugin_surface_render",
  "plugin_surface_action"
]);
assert.equal(minimumConformanceFixtureRevision, 14);
assert.equal(minimumDaemonProtocolVersion, 1);
assert.equal(compatibleDescriptorDiagnostics.length, 1);
assert.equal(compatibleDescriptorDiagnostic.title, "Hub compatibility descriptor compatible");
assert.equal(compatibleDescriptorDiagnostic.id, "hub-compatibility");

// Stale client / new Hub: a protocol-6 conformance-31 Hub stays compatible under the
// deliberately permissive floor, and the authoritative facts are carried through for
// rendering rather than degrading to "Not reported".
const protocolSixHubStatusRecord = {
  id: "local-hub",
  schema_version: 3,
  software: { product_id: "botster-hub", product_name: "Botster Hub", version: "0.1.0" },
  installation: { mode: "development", provenance: "development_build" },
  compatibility: {
    protocol: "botster-hub-daemon-v1",
    protocol_version: 6,
    features: [
      "sessions",
      "terminal_streaming",
      "resize",
      "terminal_readback",
      "plugin_surface_render",
      "plugin_surface_action"
    ],
    conformance_fixture_revision: 32
  }
};
const protocolSixDiagnostics = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [protocolSixHubStatusRecord]
  }
});
assert.equal(protocolSixDiagnostics.length, 1);
assert.equal(protocolSixDiagnostics[0].title, "Hub compatibility descriptor compatible");
assert.equal(protocolSixDiagnostics[0].severity, "success");
assert.match(protocolSixDiagnostics[0].detail, /Protocol botster-hub-daemon-v1 v6 advertises required features\./);
assert.equal(protocolSixDiagnostics.some((diagnostic) => /mismatch/i.test(diagnostic.title)), false);
assert.equal(protocolSixDiagnostics.some((diagnostic) => /unsupported_feature/.test(JSON.stringify(diagnostic))), false);
assert.equal(minimumDaemonProtocolVersion, 1);
assert.equal(minimumConformanceFixtureRevision, 14);

const advertisedTerminalReadbackDiagnostics = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: requiredDaemonFeatures,
          conformance_fixture_revision: 14
        }
      }
    ]
  }
});
assert.equal(advertisedTerminalReadbackDiagnostics.length, 1);
assert.equal(advertisedTerminalReadbackDiagnostics[0].id, hubCompatibilityDiagnosticId);
assert.equal(advertisedTerminalReadbackDiagnostics[0].severity, "success");

const hubReportedTerminalReadbackDiagnostic = hubConnectionDiagnosticFromFrame({
  kind: "connection_diagnostic",
  payload: {
    kind: "unsupported_feature",
    feature: "terminal_readback"
  }
});
assert.equal(hubReportedTerminalReadbackDiagnostic.id, "hub-diagnostic-unsupported_feature-terminal_readback");

const hubReportedTerminalReadbackDiagnostics = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: [
            "sessions",
            "terminal_streaming",
            "resize",
            "terminal_readback",
            "plugin_surface_render",
            "plugin_surface_action"
          ],
          conformance_fixture_revision: 14
        },
        diagnostics: [
          {
            kind: "unsupported_feature",
            feature: "terminal_readback",
            message: "Terminal readback is unavailable"
          }
        ]
      }
    ]
  }
});
assert.deepEqual(hubReportedTerminalReadbackDiagnostics, []);

const transitionedCompatibilityDiagnostics = [
  descriptorUnavailableDiagnostic,
  ...compatibleDescriptorDiagnostics
].reduce((diagnostics, diagnostic) => upsertDiagnostic(diagnostics, diagnostic), []);
assert.equal(transitionedCompatibilityDiagnostics.length, 1);
assert.equal(transitionedCompatibilityDiagnostics[0].title, "Hub compatibility descriptor compatible");

const absentHubDiagnosticIds = [hubUnavailableDiagnostic(new Error("connect ECONNREFUSED"))].map(({ id }) => id);
assert.deepEqual(absentHubDiagnosticIds, ["hub-unavailable"]);
assert.equal(absentHubDiagnosticIds.includes("hub-compatibility"), false);

assert.equal(hubUnavailableDiagnostic(new Error("connect ECONNREFUSED")).title, "Local hub unavailable");
assert.equal(streamDisconnectedDiagnostic(new Error("WebRTC closed")).title, "Control stream disconnected");
assert.equal(connectionFailureDiagnostic(false, new Error("connect ECONNREFUSED")).id, "hub-unavailable");
assert.notEqual(connectionFailureDiagnostic(false, new Error("connect ECONNREFUSED")).id, "stream-disconnected");
assert.equal(connectionFailureDiagnostic(true, new Error("WebRTC closed")).id, "stream-disconnected");
const webRtcDiagnosticCases = [
  ["bootstrap", "webrtc-bootstrap-failed", "Local WebRTC bootstrap failed", "pairing"],
  ["signaling", "webrtc-signaling-failed", "Local WebRTC signaling failed", "signaling"],
  ["transport", "webrtc-transport-failed", "Local WebRTC transport failed", "webrtc"],
  ["encryption", "webrtc-encryption-failed", "Local WebRTC encryption failed", "encryption"],
  ["data-plane", "webrtc-data-plane-failed", "Local WebRTC data plane failed", "data-plane"]
];
for (const [stage, id, title, source] of webRtcDiagnosticCases) {
  const diagnostic = webRtcFailureDiagnostic(new WebrtcDaemonClientError(stage, `${stage} reachable failure`));
  assert.equal(diagnostic.id, id);
  assert.equal(diagnostic.title, title);
  assert.equal(diagnostic.source, source);
  assert.match(diagnostic.detail, new RegExp(`${stage} reachable failure`));

  const connectionDiagnostic = connectionFailureDiagnostic(false, new WebrtcDaemonClientError(stage, `${stage} connect failure`));
  assert.equal(connectionDiagnostic.id, id);
  assert.notEqual(connectionDiagnostic.id, "hub-unavailable");
  assert.notEqual(connectionDiagnostic.id, "stream-disconnected");
}
assert.equal(
  terminalUnavailableDiagnostic(new WebrtcDaemonClientError("data-plane", "attach drain failed")).id,
  "webrtc-data-plane-failed"
);
assert.notEqual(
  terminalUnavailableDiagnostic(new WebrtcDaemonClientError("encryption", "decrypt failed")).id,
  "terminal-unavailable"
);
assert.equal(
  actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "Session not found" }
  ).detail,
  "Session not found"
);
assert.equal(
  actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "Session not found" }
  ).actionTarget,
  "missing-real-hub-session"
);
assert.match(
  actionFailureDiagnostic(
    { id: "botster.package.configuration.save", target: "project-pipelines" },
    {
      accepted: false,
      reason: "Package configuration failed",
      result: {
        diagnostics: [
          {
            kind: "field",
            field: "pipeline_mode",
            message: "select_option_unknown: invalid-mode"
          }
        ]
      }
    }
  ).detail,
  /Package configuration failed field: pipeline_mode: select_option_unknown: invalid-mode/
);

const terminalDataPlane = createHubTerminalDataPlane({
  bridge,
  sessionId: activeHubSessionId
});
const terminalOutput = [];
const terminalStatuses = [];
const terminalStatusSubscription = terminalDataPlane.subscribeStatus((status) => terminalStatuses.push(status));
const terminalSubscription = terminalDataPlane.subscribeOutput((data) => terminalOutput.push(data));
await flushMicrotasks();
await terminalDataPlane.writeInput("ping\n");
await terminalDataPlane.resize(24, 80);
const detachRequestsBeforeListenerClose = bridgeRequests.filter((request) => request.type === "detach").length;
terminalSubscription.unsubscribe();
assert.equal(
  bridgeRequests.filter((request) => request.type === "detach").length,
  detachRequestsBeforeListenerClose
);
assert.equal(bridgeTerminalStreams.filter((stream) => stream.unsubscribed === true).length, 1);
await terminalDataPlane.detach();
terminalStatusSubscription.unsubscribe();
assert.equal(bridgeTerminalStreams.some((stream) => stream.sessionId === activeHubSessionId), true);
assert.equal(bridgeRequests.some((request) => request.type === "send_input" && request.data === "ping\n"), true);
assert.equal(bridgeRequests.some((request) => request.type === "resize" && request.rows === 24 && request.cols === 80), true);
assert.equal(bridgeRequests.some((request) => request.type === "detach"), true);
assert.equal(bridgeTerminalStreams.filter((stream) => stream.unsubscribed === true).length, 1);
assert.deepEqual(terminalOutput.slice(0, 2), [
  "hub-owned-screen\r\n",
  "botster-web-production-ready\r\n"
]);
assert.equal(terminalOutput.some((data) => data.includes("botster-web-production-ready")), true);
assert.equal(terminalStatuses.some((status) => status.state === "attached" && status.message.includes("Visible terminal screen restored")), true);

const readbackRequests = [];
const readScreenResponses = [
  { session_id: activeHubSessionId, text: "hub-owned-screen\r\n" },
  null,
  undefined,
  { session_id: "replacement-session", text: "wrong screen\r\n" }
];
const captureSnapshotResponses = [
  { session_id: activeHubSessionId, rows: 24, cols: 80, payload_format: null, payload_bytes: 512 },
  { session_id: activeHubSessionId, rows: 30, cols: 100, payload_bytes: 0 },
  null,
  undefined,
  { session_id: "replacement-session", rows: 24, cols: 80, payload_bytes: 512 }
];
const readbackOutput = [];
const readbackDataPlane = createHubTerminalDataPlane({
  sessionId: activeHubSessionId,
  bridge: {
    async request(request) {
      if (request.type === "list_sessions") {
        return {
          kind: "sessions",
          sessions: [{ session_id: activeHubSessionId, lifecycle: "running" }],
          events: []
        };
      }
      readbackRequests.push(request);
      if (request.type === "read_screen") {
        const read_screen = readScreenResponses.shift();
        return read_screen === undefined ? { kind: "read_screen", events: [] } : { kind: "read_screen", read_screen, events: [] };
      }
      if (request.type === "capture_snapshot") {
        const capture_snapshot = captureSnapshotResponses.shift();
        return capture_snapshot === undefined
          ? { kind: "capture_snapshot", events: [] }
          : { kind: "capture_snapshot", capture_snapshot, events: [] };
      }
      return { kind: "events", events: [] };
    },
    streamTerminal() {
      return { unsubscribe() {} };
    }
  }
});
readbackDataPlane.subscribeOutput((data) => readbackOutput.push(data));
await flushMicrotasks();
assert.deepEqual(await readbackDataPlane.readScreen(), {
  session_id: activeHubSessionId,
  text: "hub-owned-screen\r\n"
});
assert.deepEqual(await readbackDataPlane.captureSnapshot(), {
  session_id: activeHubSessionId,
  rows: 24,
  cols: 80,
  payload_format: null,
  payload_bytes: 512
});
assert.equal(await readbackDataPlane.readScreen(), undefined);
assert.deepEqual(await readbackDataPlane.captureSnapshot(), {
  session_id: activeHubSessionId,
  rows: 30,
  cols: 100,
  payload_bytes: 0
});
assert.equal(await readbackDataPlane.readScreen(), undefined);
assert.equal(await readbackDataPlane.captureSnapshot(), undefined);
assert.equal(await readbackDataPlane.readScreen(), undefined);
assert.equal(await readbackDataPlane.captureSnapshot(), undefined);
assert.equal(await readbackDataPlane.captureSnapshot(), undefined);
assert.deepEqual(readbackRequests, [
  { type: "read_screen", session_id: activeHubSessionId },
  { type: "capture_snapshot", session_id: activeHubSessionId },
  { type: "read_screen", session_id: activeHubSessionId },
  { type: "capture_snapshot", session_id: activeHubSessionId },
  { type: "read_screen", session_id: activeHubSessionId },
  { type: "capture_snapshot", session_id: activeHubSessionId },
  { type: "read_screen", session_id: activeHubSessionId },
  { type: "capture_snapshot", session_id: activeHubSessionId },
  { type: "capture_snapshot", session_id: activeHubSessionId }
]);
assert.deepEqual(readbackOutput, []);

for (const readbackType of ["read_screen", "capture_snapshot"]) {
  let resolveReadback;
  const staleDataPlane = createHubTerminalDataPlane({
    sessionId: activeHubSessionId,
    bridge: {
      async request(request) {
        if (request.type === readbackType) {
          return new Promise((resolve) => {
            resolveReadback = resolve;
          });
        }
        if (request.type === "list_sessions") {
          return {
            kind: "sessions",
            sessions: [{ session_id: activeHubSessionId, lifecycle: "running" }],
            events: []
          };
        }
        return { kind: "events", events: [] };
      },
      streamTerminal() {
        return { unsubscribe() {} };
      }
    }
  });
  const pendingReadback = readbackType === "read_screen"
    ? staleDataPlane.readScreen()
    : staleDataPlane.captureSnapshot();
  await flushMicrotasks();
  await staleDataPlane.detach();
  const replacementSubscription = staleDataPlane.subscribeOutput(() => undefined);
  await flushMicrotasks();
  resolveReadback(readbackType === "read_screen"
    ? {
        kind: "read_screen",
        read_screen: { session_id: activeHubSessionId, text: "late screen\r\n" },
        events: []
      }
    : {
        kind: "capture_snapshot",
        capture_snapshot: { session_id: activeHubSessionId, rows: 24, cols: 80, payload_bytes: 512 },
        events: []
      });
  assert.equal(await pendingReadback, undefined, "late reply from a previous attachment must be discarded after re-subscribe");
  replacementSubscription.unsubscribe();
}

for (const [events, readScreenText, expectedOutput] of [
  [lateAttachHistoryConformanceFixture.history_then_live, lateAttachHistoryConformanceFixture.read_screen_text, ["history-before-live\r\n", "live-after-attach\r\n"]],
  [lateAttachHistoryConformanceFixture.no_history_then_live, lateAttachHistoryConformanceFixture.no_history_read_screen_text, ["live-without-history\r\n"]]
]) {
  const sessionId = events[0].session_id;
  const subscriptionId = events[0].subscription_id;
  const fixtureOutput = [];
  const fixtureTimeline = [];
  const fixtureDataPlane = createHubTerminalDataPlane({
    sessionId,
    subscriptionId,
    bridge: {
      async request(request) {
        if (request.type === "list_sessions") {
          return {
            kind: "sessions",
            sessions: [{ session_id: sessionId, lifecycle: "running" }],
            events: []
          };
        }
        if (request.type === "read_screen") {
          return {
            kind: "read_screen",
            read_screen: { session_id: sessionId, text: readScreenText },
            events: []
          };
        }
        return { kind: "events", events: [] };
      },
      streamTerminal(nextSessionId, nextSubscriptionId, onEvent) {
        assert.equal(nextSessionId, sessionId);
        assert.equal(nextSubscriptionId, subscriptionId);
        events.forEach(onEvent);
        return { unsubscribe() {} };
      }
    }
  });
  fixtureDataPlane.subscribeStatus((status) => {
    fixtureTimeline.push(`status:${status.state}:${status.message}`);
  });
  fixtureDataPlane.subscribeOutput((data) => {
    fixtureOutput.push(data);
    fixtureTimeline.push(`output:${data}`);
  });
  await waitFor(() => fixtureOutput.length === expectedOutput.length);
  assert.deepEqual(fixtureOutput, expectedOutput);

  const attachingIndex = fixtureTimeline.findIndex((entry) => entry.startsWith("status:attaching:"));
  const protocolAttachedIndex = fixtureTimeline.findIndex((entry) =>
    entry === "status:attached:Terminal stream attached; waiting for available output."
  );
  const liveOutputIndex = fixtureTimeline.findIndex((entry) => entry === `output:${expectedOutput.at(-1)}`);
  assert.equal(attachingIndex >= 0, true);
  assert.equal(protocolAttachedIndex > attachingIndex, true);
  assert.equal(liveOutputIndex > protocolAttachedIndex, true);

  if (expectedOutput.length === 2) {
    const restoredStatusIndex = fixtureTimeline.findIndex((entry) =>
      entry.includes("Visible terminal screen restored from daemon readback.")
    );
    const historyOutputIndex = fixtureTimeline.findIndex((entry) => entry === `output:${expectedOutput[0]}`);
    assert.equal(restoredStatusIndex > attachingIndex, true);
    assert.equal(historyOutputIndex > restoredStatusIndex, true);
    assert.equal(historyOutputIndex > protocolAttachedIndex, true);
    assert.equal(liveOutputIndex > historyOutputIndex, true);
  } else {
    const liveOnlyIndex = fixtureTimeline.findIndex((entry) => entry.startsWith("status:live_only:"));
    assert.equal(liveOnlyIndex > protocolAttachedIndex, true);
    assert.equal(liveOutputIndex > liveOnlyIndex, true);
  }
}

let resolveDelayedScreen;
const delayedHydrationOutput = [];
const delayedHydrationDataPlane = createHubTerminalDataPlane({
  sessionId: "delayed-hydration-session",
  subscriptionId: "delayed-hydration-subscription",
  bridge: {
    async request(request) {
      if (request.type === "list_sessions") {
        return {
          kind: "sessions",
          sessions: [{ session_id: "delayed-hydration-session", lifecycle: "running" }],
          events: []
        };
      }
      if (request.type === "read_screen") {
        return new Promise((resolve) => {
          resolveDelayedScreen = resolve;
        });
      }
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      onEvent({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "attaching" });
      onEvent({
        type: "snapshot",
        session_id: sessionId,
        subscription_id: subscriptionId,
        payload_base64: "AP9HVFkB",
        payload_encoding: "base64",
        bytes: 6
      });
      onEvent({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "attached" });
      onEvent({ type: "terminal_output", session_id: sessionId, subscription_id: subscriptionId, data: "live-one\r\n" });
      onEvent({ type: "terminal_output", session_id: sessionId, subscription_id: subscriptionId, data: "live-two\r\n" });
      return { unsubscribe() {} };
    }
  }
});
delayedHydrationDataPlane.subscribeOutput((data) => delayedHydrationOutput.push(data));
await waitFor(() => typeof resolveDelayedScreen === "function");
assert.deepEqual(delayedHydrationOutput, []);
resolveDelayedScreen({
  kind: "read_screen",
  read_screen: { session_id: "delayed-hydration-session", text: "visible-screen\r\n" },
  events: []
});
await waitFor(() => delayedHydrationOutput.length === 3);
assert.deepEqual(delayedHydrationOutput, ["visible-screen\r\n", "live-one\r\n", "live-two\r\n"]);

let resolveStaleAutomaticScreen;
let staleAutomaticStreamCount = 0;
let staleAutomaticReadCount = 0;
const staleAutomaticOutput = [];
const staleAutomaticDataPlane = createHubTerminalDataPlane({
  sessionId: "stale-automatic-session",
  subscriptionId: "stale-automatic-subscription",
  bridge: {
    async request(request) {
      if (request.type === "list_sessions") {
        return {
          kind: "sessions",
          sessions: [{ session_id: "stale-automatic-session", lifecycle: "running" }],
          events: []
        };
      }
      if (request.type === "read_screen") {
        staleAutomaticReadCount += 1;
        if (staleAutomaticReadCount === 1) {
          return new Promise((resolve) => {
            resolveStaleAutomaticScreen = resolve;
          });
        }
        return {
          kind: "read_screen",
          read_screen: { session_id: "stale-automatic-session", text: "current-screen\r\n" },
          events: []
        };
      }
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      staleAutomaticStreamCount += 1;
      const live = staleAutomaticStreamCount === 1 ? "stale-live\r\n" : "current-live\r\n";
      onEvent({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "attached" });
      onEvent({ type: "terminal_output", session_id: sessionId, subscription_id: subscriptionId, data: live });
      return { unsubscribe() {} };
    }
  }
});
const staleAutomaticFirstSubscription = staleAutomaticDataPlane.subscribeOutput((data) => staleAutomaticOutput.push(data));
await waitFor(() => typeof resolveStaleAutomaticScreen === "function");
staleAutomaticFirstSubscription.unsubscribe();
const staleAutomaticSecondSubscription = staleAutomaticDataPlane.subscribeOutput((data) => staleAutomaticOutput.push(data));
await waitFor(() => staleAutomaticOutput.includes("current-live\r\n"));
resolveStaleAutomaticScreen({
  kind: "read_screen",
  read_screen: { session_id: "stale-automatic-session", text: "stale-screen\r\n" },
  events: []
});
await flushMicrotasks();
assert.deepEqual(staleAutomaticOutput, ["current-screen\r\n", "current-live\r\n"]);
staleAutomaticSecondSubscription.unsubscribe();

const reattachedTerminalOutput = [];
const reattachedTerminalSubscription = terminalDataPlane.subscribeOutput((data) => reattachedTerminalOutput.push(data));
await waitFor(() => reattachedTerminalOutput.some((data) => data.includes("botster-web-production-ready")));
reattachedTerminalSubscription.unsubscribe();
assert.equal(
  bridgeTerminalStreams.filter((stream) => stream.sessionId === activeHubSessionId && stream.unsubscribed !== true).length,
  2
);
assert.equal(
  bridgeRequests.filter((request) => request.type === "list_sessions").length,
  0
);

const byteOnlyTerminalStatuses = [];
const byteOnlyTerminalOutput = [];
const byteOnlyTerminalDataPlane = createHubTerminalDataPlane({
  sessionId: activeHubSessionId,
  bridge: {
    async request(request) {
      if (request.type === "list_sessions") {
        return {
          kind: "sessions",
          sessions: [{ session_id: activeHubSessionId, lifecycle: "running" }],
          events: []
        };
      }
      if (request.type === "read_screen") {
        return {
          kind: "read_screen",
          read_screen: { session_id: activeHubSessionId, text: "" },
          events: []
        };
      }
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      onEvent({
        type: "attach_state",
        session_id: sessionId,
        subscription_id: subscriptionId,
        state: "attaching"
      });
      onEvent({
        type: "snapshot",
        session_id: sessionId,
        subscription_id: subscriptionId,
        payload_base64: "AP9HVFkB",
        payload_encoding: "base64",
        bytes: 6
      });
      onEvent({
        type: "attach_state",
        session_id: sessionId,
        subscription_id: subscriptionId,
        state: "attached"
      });
      onEvent({
        type: "terminal_output",
        session_id: sessionId,
        subscription_id: subscriptionId,
        data: "byte-only-live-output\r\n"
      });
      return {
        unsubscribe() {}
      };
    }
  }
});
byteOnlyTerminalDataPlane.subscribeStatus((status) => byteOnlyTerminalStatuses.push(status));
byteOnlyTerminalDataPlane.subscribeOutput((data) => byteOnlyTerminalOutput.push(data));
await waitFor(() => byteOnlyTerminalOutput.some((data) => data.includes("byte-only-live-output")));
assert.deepEqual(byteOnlyTerminalOutput, ["byte-only-live-output\r\n"]);
assert.equal(
  byteOnlyTerminalStatuses.some((status) => status.message.includes("Visible terminal screen restored")),
  false
);
assert.equal(byteOnlyTerminalStatuses.some((status) => status.state === "live_only"), true);

const delayedBridgeRequests = [];
const delayedBridgeTerminalStreams = [];
const delayedTerminalDataPlane = createHubTerminalDataPlane({
  sessionId: activeHubSessionId,
  bridge: {
    async request(request) {
      delayedBridgeRequests.push(request);
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      delayedBridgeTerminalStreams.push({ sessionId, subscriptionId });
      onEvent({
        type: "terminal_output",
        session_id: sessionId,
        subscription_id: subscriptionId,
        data: "botster-web-production-ready-after-retry\r\n"
      });
      return {
        unsubscribe() {
          delayedBridgeTerminalStreams.push({ sessionId, subscriptionId, unsubscribed: true });
        }
      };
    }
  }
});
const delayedOutput = [];
const delayedStatuses = [];
delayedTerminalDataPlane.subscribeStatus((status) => delayedStatuses.push(status));
delayedTerminalDataPlane.subscribeOutput((data) => delayedOutput.push(data));
const delayedResize = delayedTerminalDataPlane.resize(9, 34);
await waitFor(() => delayedOutput.some((data) => data.includes("ready-after-retry")));
await delayedResize;
assert.equal(delayedStatuses.some((status) => status.state === "live_only"), true);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize").length, 1);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize")[0].rows, 9);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize")[0].cols, 34);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "list_sessions").length, 0);
assert.equal(delayedBridgeTerminalStreams.length, 1);

const terminalWithoutStream = createHubTerminalDataPlane({
  sessionId: activeHubSessionId,
  bridge: {
    async request() {
      return { kind: "events", events: [] };
    }
  }
});
let terminalAttachError;
try {
  terminalWithoutStream.subscribeOutput(() => undefined);
} catch (error) {
  terminalAttachError = error;
}
assert.match(terminalAttachError.message, /does not expose terminal streaming/);
assert.equal(terminalUnavailableDiagnostic(terminalAttachError).title, "Terminal stream unavailable");

const vite = await createServer({
  configFile: false,
  resolve: {
    alias: {
      "@ionic/react": new URL("./botster/__fixtures__/IonicReactSsrMock.tsx", import.meta.url)
        .pathname
    }
  },
  optimizeDeps: {
    noDiscovery: true
  },
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const [
    { ionicUiNodeRendererRegistry },
    { uiNodeConformanceSnapshot, fixtureEntityFrames, fixtureProvenance },
    { uiNodeConformanceSnapshot: productionUiTreeSnapshot },
    { uiNodeConformanceSnapshot: hubUiTreeSnapshot },
    { ConnectionDiagnosticsPanel },
    { LocalHubFirstScreen },
    { createInMemoryEntityFrameStore },
    {
      acceptedResultMatches,
      applyAcceptedPresentation,
      presentationValues,
      replaceAcceptedSurface
    },
    { configurationFieldType, configurationSaveAction, configurationSubmitValues },
    { isAttachableSession, sessionDisplayStatus, sessionDisplayTitle },
    { UiNodeSurface },
    { sessionBindingVariantSnapshot },
    { pluginSurfaceActionRequest },
    { TerminalViewHost },
    {
      AppListItem,
      AppsView,
      PackageNavigationShortcutButton,
      PluginNavigationShortcuts,
      PluginListItem,
      HubGeneralSection,
      SessionListItem,
      SessionRouteView,
      SessionTypeListItem,
      SessionTypesSurfaceNotices,
      SessionTypesView,
      SessionTypeSubmitButton,
      SpawnTargetListItem,
      DashboardView,
      DiagnosticsView,
      HubSettingsSectionsNav,
      WorkbenchNav,
      hubUpdateCheckAction,
      hubUpdateCheckActionId,
      hubUpdateOutcomeFromResult,
      hubUpdateOutcomeSummary,
      replayHubStatusOnLifecycleEvent,
      PluginSurfaceRoutePage,
      PluginSettingsRoutePage,
      PluginSettingsPanel,
      RemoteAccessConfigurationItem,
      entityFamilyRecordLimit,
      appRouteFromPathname,
      appRoutePath,
      compareSpawnTargetRows,
      compareInstalledPackageRows,
      packageAppSurfaces,
      packageNavigationShortcut,
      packageSettingsSurfaces,
      renderedPluginSurfaceState,
      rejectedSpawnSessionForm,
      applySpawnSessionListResult,
      groupSessionTypesBySource,
      writableSessionTypeSources,
      sessionTypeMutationSourceFromRecord,
      sessionTypeManagementSupported,
      sessionTypeDefinitionFromForm,
      sessionTypeFormFromAuthoringDefinition,
      sessionTypeFormIsStructurallyComplete,
      sessionTypeMutationSource,
      rejectedSessionTypeForm,
      entitySubscriptionErrorFromFrame,
      emptySessionTypeForm,
      listSessionTypesForTargetAction,
      spawnSessionAction,
      spawnSessionFormForTarget,
      spawnSessionOptionsFromHubList,
      surfaceLaunchAction,
      terminalDescriptorForSessionId,
      terminalReleaseToast
    }
  ] = await Promise.all([
    vite.ssrLoadModule("/src/botster/IonicUiNodeRenderer.tsx"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
    vite.ssrLoadModule("/src/botster/ConnectionDiagnosticsPanel.tsx"),
    vite.ssrLoadModule("/src/botster/LocalHubFirstScreen.tsx"),
    vite.ssrLoadModule("/src/botster/entities.ts"),
    vite.ssrLoadModule("/src/botster/uiPresentation.ts"),
    vite.ssrLoadModule("/src/packageConfigurationForm.ts"),
    vite.ssrLoadModule("/src/botster/terminalSession.ts"),
    vite.ssrLoadModule("/src/botster/UiNodeSurface.tsx"),
    vite.ssrLoadModule("/src/botster/__fixtures__/sessionBindingUiChildren.ts"),
    vite.ssrLoadModule("/src/botster/uiNodes.ts"),
    vite.ssrLoadModule("/src/botster/TerminalViewHost.tsx"),
    vite.ssrLoadModule("/src/App.tsx")
  ]);

  const runningTerminalSession = {
    id: activeHubSessionId,
    session_uuid: activeHubSessionId,
    registry_state: "active",
    lifecycle: "running",
    lifecycle_class: "current"
  };
  const indeterminateTerminalSession = {
    id: "indeterminate-session",
    session_uuid: "indeterminate-session",
    registry_state: "running",
    lifecycle_class: "indeterminate"
  };
  const contradictoryTerminalSession = {
    ...indeterminateTerminalSession,
    lifecycle: "running"
  };
  assert.equal(sessionDisplayTitle(runningTerminalSession), activeHubSessionId);
  assert.equal(sessionDisplayStatus(runningTerminalSession), "current");
  assert.equal(sessionDisplayStatus(indeterminateTerminalSession), "indeterminate");
  assert.equal(sessionDisplayStatus(contradictoryTerminalSession), "indeterminate");
  assert.equal(sessionDisplayStatus({ id: "unknown-session", registry_state: "running" }), "Unknown status");
  assert.equal(isAttachableSession(runningTerminalSession), true);
  assert.equal(isAttachableSession(indeterminateTerminalSession), false);
  assert.equal(isAttachableSession(contradictoryTerminalSession), false);
  const currentSessionListItem = renderToStaticMarkup(
    createElement(SessionListItem, {
      session: runningTerminalSession,
      onOpen: () => {}
    })
  );
  assert.match(currentSessionListItem, />current</);
  assert.match(currentSessionListItem, />Open</);
  const indeterminateSessionListItem = renderToStaticMarkup(
    createElement(SessionListItem, {
      session: indeterminateTerminalSession,
      onOpen: () => {}
    })
  );
  assert.match(indeterminateSessionListItem, />indeterminate</);
  assert.doesNotMatch(indeterminateSessionListItem, />Open</);
  const contradictorySessionListItem = renderToStaticMarkup(
    createElement(SessionListItem, {
      session: contradictoryTerminalSession,
      onOpen: () => {}
    })
  );
  assert.match(contradictorySessionListItem, />indeterminate</);
  assert.doesNotMatch(contradictorySessionListItem, />Open</);
  assert.equal(entityFamilyRecordLimit, 4);

  // --- Authoritative Hub identity and update availability ---------------------
  assert.equal(hubUpdateCheckActionId, "botster.hub.check_update");
  assert.deepEqual(hubUpdateCheckAction(), { id: "botster.hub.check_update", label: "Check for updates" });

  // The outcome is authored by the accepted action result. Every rejected result
  // yields no update record, so no DaemonHubUpdateState can be synthesized.
  assert.deepEqual(hubUpdateOutcomeFromResult(hubUpdateCurrentResult), {
    accepted: true,
    update: {
      state: "current",
      current_version: "0.1.0",
      reason: "Development checkouts are updated with git.",
      action: "git pull"
    }
  });
  assert.deepEqual(hubUpdateOutcomeFromResult(hubUpdateOfflineResult), {
    accepted: false,
    reason: "Local WebRTC data channel is closed"
  });
  assert.deepEqual(hubUpdateOutcomeFromResult(hubUpdateErrorResult), {
    accepted: false,
    reason: "Release metadata could not be read"
  });
  // An accepted result that somehow carries no state still yields no update record.
  assert.deepEqual(hubUpdateOutcomeFromResult({ accepted: true, result: { hub_update: null } }), { accepted: true });

  assert.equal(hubUpdateOutcomeSummary(undefined), "Check whether a newer Hub version is available.");
  assert.equal(
    hubUpdateOutcomeSummary(hubUpdateOutcomeFromResult(hubUpdateAvailableResult)),
    "Update available: 0.2.0 — A managed release is published."
  );
  assert.equal(
    hubUpdateOutcomeSummary(hubUpdateOutcomeFromResult(hubUpdateUnavailableResult)),
    "Updates unavailable — This installation is managed by the operating system package manager."
  );
  assert.equal(
    hubUpdateOutcomeSummary(hubUpdateOutcomeFromResult(hubUpdateCurrentResult)),
    "Up to date: 0.1.0 — Development checkouts are updated with git."
  );
  assert.equal(
    hubUpdateOutcomeSummary(hubUpdateOutcomeFromResult(hubUpdateOfflineResult)),
    "Update check failed: Local WebRTC data channel is closed"
  );
  assert.equal(hubUpdateOutcomeSummary({ accepted: false }), "Update check failed.");

  const developmentHubStatus = {
    id: "local-hub",
    title: "Production Hub",
    host_id: "production-host",
    schema_version: 3,
    software: {
      product_id: "botster-hub",
      product_name: "Botster Hub",
      version: "0.1.0",
      build_revision: "8a60bd5"
    },
    installation: { mode: "development", provenance: "development_build" },
    compatibility: {
      protocol: "botster-hub-daemon-v1",
      protocol_version: 6,
      features: ["sessions", "terminal_streaming", "resize", "terminal_readback", "plugin_surface_render", "plugin_surface_action"],
      conformance_fixture_revision: 32
    }
  };
  const renderHubGeneralSection = (hubStatus, hubUpdate) => renderToStaticMarkup(
    createElement(HubGeneralSection, { hubStatus, hubUpdate, onCheckForUpdates: () => {} })
  );

  const developmentGeneralMarkup = renderHubGeneralSection(developmentHubStatus, undefined);
  assert.match(developmentGeneralMarkup, /data-testid="hub-settings-general"/);
  assert.match(developmentGeneralMarkup, /<dt>Software<\/dt><dd>Botster Hub<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Version<\/dt><dd>0\.1\.0<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Build<\/dt><dd>8a60bd5<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Installation<\/dt><dd>development<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Provenance<\/dt><dd>development_build<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Host ID<\/dt><dd>production-host<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Name<\/dt><dd>Production Hub<\/dd>/);
  // Protocol, protocol version, conformance revision, features, and schema all render
  // their authoritative numeric values instead of regressing to a fallback.
  assert.match(developmentGeneralMarkup, /botster-hub-daemon-v1 · version 6/);
  assert.match(developmentGeneralMarkup, /<dt>Conformance revision<\/dt><dd>32<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>Features<\/dt><dd>sessions, terminal_streaming, resize, terminal_readback, plugin_surface_render, plugin_surface_action<\/dd>/);
  assert.match(developmentGeneralMarkup, /<dt>State schema<\/dt><dd>Version 3<\/dd>/);
  assert.doesNotMatch(developmentGeneralMarkup, /Version unknown|version unknown/);
  // Release channel and provider are absent for a development checkout.
  assert.doesNotMatch(developmentGeneralMarkup, /Release channel/);
  assert.doesNotMatch(developmentGeneralMarkup, /<dt>Provider<\/dt>/);
  // Internal state schema stays secondary to user-facing software status.
  assert.equal(
    developmentGeneralMarkup.indexOf('data-testid="hub-software-identity"') <
      developmentGeneralMarkup.indexOf('data-testid="hub-internal-state"'),
    true
  );
  assert.match(developmentGeneralMarkup, /class="hub-metadata-list hub-metadata-secondary" data-testid="hub-internal-state"/);

  // A managed release renders distinct, honest, non-destructive identity.
  const managedGeneralMarkup = renderHubGeneralSection({
    ...developmentHubStatus,
    software: { product_id: "botster-hub", product_name: "Botster Hub", version: "0.2.0" },
    installation: {
      mode: "managed",
      provenance: "managed_release",
      release_channel: "stable",
      provider: "homebrew"
    }
  }, undefined);
  assert.match(managedGeneralMarkup, /<dt>Installation<\/dt><dd>managed<\/dd>/);
  assert.match(managedGeneralMarkup, /<dt>Provenance<\/dt><dd>managed_release<\/dd>/);
  assert.match(managedGeneralMarkup, /<dt>Release channel<\/dt><dd>stable<\/dd>/);
  assert.match(managedGeneralMarkup, /<dt>Provider<\/dt><dd>homebrew<\/dd>/);
  assert.doesNotMatch(managedGeneralMarkup, /<dt>Build<\/dt>/);
  assert.notEqual(managedGeneralMarkup, developmentGeneralMarkup);

  // Nothing was reported: honest fallbacks, no fabricated version, no crash.
  const unreportedGeneralMarkup = renderHubGeneralSection(undefined, undefined);
  assert.match(unreportedGeneralMarkup, /<dt>Software<\/dt><dd>Not reported<\/dd>/);
  assert.match(unreportedGeneralMarkup, /<dt>Version<\/dt><dd>Not reported<\/dd>/);
  assert.match(unreportedGeneralMarkup, /<dt>State schema<\/dt><dd>Version Not reported<\/dd>/);
  assert.match(unreportedGeneralMarkup, /<dt>Name<\/dt><dd>Local Hub<\/dd>/);
  assert.doesNotMatch(unreportedGeneralMarkup, /data-hub-update-state/);

  // Hub-authored update outcomes: state drives the headline, reason and action render verbatim.
  const currentUpdateMarkup = renderHubGeneralSection(developmentHubStatus, hubUpdateOutcomeFromResult(hubUpdateCurrentResult));
  assert.match(currentUpdateMarkup, /data-hub-update-state="current"/);
  assert.match(currentUpdateMarkup, /Up to date: 0\.1\.0 — Development checkouts are updated with git\./);
  assert.match(currentUpdateMarkup, /<p data-testid="hub-update-action">git pull<\/p>/);

  const availableUpdateMarkup = renderHubGeneralSection(developmentHubStatus, hubUpdateOutcomeFromResult(hubUpdateAvailableResult));
  assert.match(availableUpdateMarkup, /data-hub-update-state="available"/);
  assert.match(availableUpdateMarkup, /Update available: 0\.2\.0 — A managed release is published\./);
  assert.match(availableUpdateMarkup, /<p data-testid="hub-update-action">Restart Hub to install 0\.2\.0<\/p>/);

  const unavailableUpdateMarkup = renderHubGeneralSection(developmentHubStatus, hubUpdateOutcomeFromResult(hubUpdateUnavailableResult));
  assert.match(unavailableUpdateMarkup, /data-hub-update-state="unavailable"/);
  assert.match(unavailableUpdateMarkup, /Updates unavailable — This installation is managed by the operating system package manager\./);
  assert.match(unavailableUpdateMarkup, /<p data-testid="hub-update-action">Use your package manager<\/p>/);

  // Offline: transport rejection. No DaemonHubUpdateState reaches the DOM.
  const offlineUpdateMarkup = renderHubGeneralSection(developmentHubStatus, hubUpdateOutcomeFromResult(hubUpdateOfflineResult));
  assert.match(offlineUpdateMarkup, /Update check failed: Local WebRTC data channel is closed/);
  assert.doesNotMatch(offlineUpdateMarkup, /data-hub-update-state/);
  assert.doesNotMatch(offlineUpdateMarkup, /data-testid="hub-update-action"/);
  for (const daemonHubUpdateState of ["current", "available", "unavailable"]) {
    assert.equal(offlineUpdateMarkup.includes(daemonHubUpdateState), false);
  }

  // Error: connected Hub, operator error. A different path from transport rejection,
  // rendered from the Hub's own message and still with no synthesized state.
  const errorUpdateMarkup = renderHubGeneralSection(developmentHubStatus, hubUpdateOutcomeFromResult(hubUpdateErrorResult));
  assert.match(errorUpdateMarkup, /Update check failed: Release metadata could not be read/);
  assert.doesNotMatch(errorUpdateMarkup, /data-hub-update-state/);
  for (const daemonHubUpdateState of ["current", "available", "unavailable"]) {
    assert.equal(errorUpdateMarkup.includes(daemonHubUpdateState), false);
  }
  assert.notEqual(errorUpdateMarkup, offlineUpdateMarkup);

  // Reconnect hydration is listener-driven per family. replayActivePulls() has no
  // production caller, so this listener is the sole mechanism and is asserted directly
  // rather than inferred from hub_status being replay-eligible.
  const lifecyclePulls = [];
  const lifecycleEntities = { async pull(request) { lifecyclePulls.push(request); } };
  assert.equal(replayHubStatusOnLifecycleEvent({ type: "data-channel-open" }, lifecycleEntities), true);
  assert.deepEqual(lifecyclePulls, [{ family: "botster-web.hub_status" }]);
  for (const ignoredLifecycle of [
    { type: "data-channel-closed" },
    { type: "data-channel-error" },
    { type: "encrypted-stream-ready", requestType: "status" }
  ]) {
    assert.equal(replayHubStatusOnLifecycleEvent(ignoredLifecycle, lifecycleEntities), false);
  }
  assert.deepEqual(lifecyclePulls, [{ family: "botster-web.hub_status" }]);
  assert.equal(replayHubStatusOnLifecycleEvent({ type: "data-channel-open" }, lifecycleEntities), true);
  assert.equal(lifecyclePulls.length, 2);

  const descriptorAppRoute = appRouteFromPathname("/packages/acme%20tools/surfaces/home%2Fmain");
  const fallbackAppRoute = appRouteFromPathname("/apps/acme%20tools/home%2Fmain");
  assert.deepEqual(descriptorAppRoute, {
    view: "apps",
    packageName: "acme tools",
    surfaceId: "home/main",
    settings: false
  });
  assert.deepEqual(fallbackAppRoute, descriptorAppRoute);
  assert.deepEqual(appRouteFromPathname("/packages/acme%20tools/settings"), {
    view: "apps",
    packageName: "acme tools",
    settings: true
  });
  assert.deepEqual(appRouteFromPathname("/packages/acme%20tools/entrypoints/web"), {
    view: "apps",
    packageName: "acme tools"
  });
  assert.deepEqual(appRouteFromPathname("/packages/acme%20tools/surfaces"), {
    view: "apps",
    packageName: "acme tools"
  });
  assert.deepEqual(appRouteFromPathname("/packages/acme%20tools/surfaces/home/extra"), {
    view: "apps",
    packageName: "acme tools",
    surfaceId: "home",
    settings: false
  });
  assert.deepEqual(appRouteFromPathname("/not-an-app-route"), { view: "dashboard" });
  assert.deepEqual(appRouteFromPathname("/settings/spawn-points"), {
    view: "hub-settings",
    section: "spawn-points"
  });
  assert.deepEqual(appRouteFromPathname("/settings"), {
    view: "hub-settings",
    section: "general"
  });
  assert.deepEqual(appRouteFromPathname("/sessions/session%2Fone"), {
    view: "session",
    sessionId: "session/one"
  });
  assert.deepEqual(appRouteFromPathname("/diagnostics"), {
    view: "hub-settings",
    section: "support"
  });
  const roundTripRoutes = [
    { view: "dashboard" },
    { view: "hub-settings", section: "general" },
    { view: "hub-settings", section: "extensions" },
    { view: "session", sessionId: "session/one" },
    { view: "apps" },
    { view: "apps", packageName: "acme tools", surfaceId: "home/main", settings: false },
    { view: "apps", packageName: "acme tools", surfaceId: "advanced", settings: true }
  ];
  for (const route of roundTripRoutes) {
    assert.deepEqual(appRouteFromPathname(appRoutePath(route)), route);
  }
  assert.deepEqual(terminalDescriptorForSessionId("session/one"), {
    sessionId: "session/one",
    renderer: "restty"
  });
  assert.equal(terminalDescriptorForSessionId(undefined), undefined);
  assert.deepEqual(
    terminalReleaseToast("web-prod", { state: "failed", message: "Terminal stream attach failed." }),
    { message: "Terminal stream attach failed.", color: "danger" }
  );
  assert.deepEqual(
    terminalReleaseToast("web-prod"),
    { message: "Session web-prod ended", color: "medium" }
  );
  assert.deepEqual(
    terminalReleaseToast("web-prod", { state: "exited", message: "Terminal process exited with 0." }),
    { message: "Session web-prod ended", color: "medium" }
  );
  const sessionRouteMarkup = renderToStaticMarkup(
    createElement(
      SessionRouteView,
      { sessionId: "session/one" },
      createElement("div", { "data-terminal-session-id": "session/one" }, "Mounted terminal")
    )
  );
  assert.match(sessionRouteMarkup, /aria-label="Terminal session session\/one"/);
  assert.match(sessionRouteMarkup, /data-testid="terminal-session-view"/);
  assert.match(sessionRouteMarkup, /data-terminal-session-id="session\/one"/);
  assert.equal(markupContainsTestId(sessionRouteMarkup, HOST_CHROME.terminalSessionViewTestId), true);

  // --- Default-path host-chrome inventory (shared constants + decision vs rendered markup) ---
  // Completeness is binding: ids are recorded only when an evaluation actually runs.
  const evaluatedHostChromeContractIds = new Set();
  const markHostChromeContract = (id) => {
    assert.equal(
      HOST_CHROME_CONTRACTS.some((entry) => entry.id === id),
      true,
      `evaluation recorded for unknown inventory id ${id}`
    );
    evaluatedHostChromeContractIds.add(id);
  };
  const hostChromeRenderSymbols = {
    TerminalViewHost,
    DashboardView,
    PluginSettingsRoutePage,
    ConnectionDiagnosticsPanel,
    SessionRouteView,
    HubGeneralSection,
    AppsView,
    WorkbenchNav,
    PluginSurfaceRoutePage,
    DiagnosticsView,
    HubSettingsSectionsNav,
    SessionTypesView,
    SessionTypesSurfaceNotices,
    SessionTypeListItem,
    SessionTypeSubmitButton,
    PluginSettingsPanel,
    RemoteAccessConfigurationItem,
    LocalHubFirstScreen
  };

  // terminal-mounted
  const mountedTerminalMarkup = renderToStaticMarkup(
    createElement(TerminalViewHost, {
      descriptor: { sessionId: "web-prod", renderer: "restty" },
      bridge: {
        mount: async () => ({ id: "mock-mount" }),
        unmount: async () => undefined,
        attach: async () => undefined,
        focus: async () => undefined,
        writeInput: async () => undefined,
        resize: async () => undefined
      },
      dataPlane: {
        sessionId: "web-prod",
        subscribeStatus: () => ({ unsubscribe() {} }),
        readScreen: async () => ({ text: "" }),
        captureSnapshot: async () => ({ rows: 24, cols: 80, payload_bytes: 0 })
      }
    })
  );
  assert.match(mountedTerminalMarkup, new RegExp(`class="${HOST_CHROME.terminalContainerClass}"`));
  assert.match(mountedTerminalMarkup, new RegExp(`${HOST_CHROME.terminalSessionIdAttr}="web-prod"`));
  assert.match(mountedTerminalMarkup, new RegExp(`class="${HOST_CHROME.terminalStatusClass}"`));
  assert.match(mountedTerminalMarkup, new RegExp(`${HOST_CHROME.terminalAttachStateAttr}="unknown"`));
  assert.deepEqual(extractTerminalSessionIdsFromMarkup(mountedTerminalMarkup), ["web-prod"]);
  assert.equal(extractAttachStateFromMarkup(mountedTerminalMarkup), "unknown");
  assert.equal(
    isTerminalDetached({
      sessionContainerIds: extractTerminalSessionIdsFromMarkup(mountedTerminalMarkup),
      dashboardPresent: false
    }, "web-prod"),
    false
  );
  markHostChromeContract("terminal-mounted");

  // terminal-detached + dashboard-view
  const dashboardMarkup = renderToStaticMarkup(
    createElement(DashboardView, {
      sessions: [{
        id: "web-prod",
        session_uuid: "web-prod",
        registry_state: "active",
        lifecycle: "running",
        lifecycle_class: "current"
      }],
      sessionLoadStatus: "loaded",
      onOpenSession: () => {},
      onNavigateToApps: () => {},
      onNavigateToSpawnPoints: () => {}
    })
  );
  assert.equal(extractDashboardPresentFromMarkup(dashboardMarkup), true);
  assert.equal(markupContainsTestId(dashboardMarkup, HOST_CHROME.dashboardTestId), true);
  assert.match(dashboardMarkup, new RegExp(`data-testid="${HOST_CHROME.dashboardTestId}"`));
  assert.match(dashboardMarkup, new RegExp(`>${HOST_CHROME.sessionsHeadingName}<`));
  assert.match(dashboardMarkup, new RegExp(`>${HOST_CHROME.openSessionButtonName}<`));
  assert.equal(
    isTerminalDetached({
      sessionContainerIds: extractTerminalSessionIdsFromMarkup(dashboardMarkup),
      dashboardPresent: extractDashboardPresentFromMarkup(dashboardMarkup)
    }, "web-prod"),
    true
  );
  assert.equal(
    isTerminalDetached({ sessionContainerIds: ["web-prod"], dashboardPresent: true }, "web-prod"),
    false
  );
  assert.equal(
    isTerminalDetached({
      sessionContainerIds: extractTerminalSessionIdsFromMarkup(mountedTerminalMarkup),
      dashboardPresent: true
    }, "web-prod"),
    false
  );
  markHostChromeContract("terminal-detached");
  markHostChromeContract("dashboard-view");

  // settings-back
  const settingsRouteMarkup = renderToStaticMarkup(
    createElement(PluginSettingsRoutePage, {
      packageName: "botster-web",
      packageRecord: { id: "botster-web", title: "Botster Web" },
      onAction: () => {},
      onBack: () => {},
      onOpenSurface: () => {},
      entities: createInMemoryEntityFrameStore()
    })
  );
  assert.equal(markupContainsTestId(settingsRouteMarkup, HOST_CHROME.pluginSettingsRouteTestId), true);
  assert.match(settingsRouteMarkup, new RegExp(`data-testid="${HOST_CHROME.pluginSettingsRouteTestId}"`));
  assert.match(settingsRouteMarkup, new RegExp(`>${HOST_CHROME.settingsBackButtonName}<`));
  markHostChromeContract("settings-back");

  // schema-presentation-neutral
  const schemaNeutralDiagnostic = {
    id: HOST_CHROME.schemaDiagnosticId,
    title: "Hub durable-state schema",
    detail: "Hub durable-state schema version 3. Client compatibility is reported by DaemonStatus.compatibility.",
    severity: "info",
    source: "server"
  };
  const schemaPresentationMarkup = renderToStaticMarkup(
    createElement(ConnectionDiagnosticsPanel, { diagnostics: [schemaNeutralDiagnostic] })
  );
  assert.equal(markupContainsDiagnosticId(schemaPresentationMarkup, HOST_CHROME.schemaDiagnosticId), true);
  assert.match(schemaPresentationMarkup, /Hub durable-state schema/);
  assert.match(schemaPresentationMarkup, /schema version 3/);
  assert.match(schemaPresentationMarkup, /Info \/ server/);
  assert.doesNotMatch(schemaPresentationMarkup, /Blocked|mismatch|expected schema/i);
  markHostChromeContract("schema-presentation-neutral");

  // schema-floor-in-harness
  assert.equal(HOST_CHROME.schemaFloorSourcePin, "status.schema_version < 3");
  assert.match(liveProtocolHarnessScript, /status\.schema_version < 3/);
  assert.doesNotMatch(liveProtocolHarnessScript, /status\.schema_version\s*!==\s*2/);
  assert.doesNotMatch(liveProtocolHarnessScript, /status\.schema_version\s*===\s*[23]/);
  markHostChromeContract("schema-floor-in-harness");

  // terminal-session-view (already rendered above; re-assert constants)
  assert.equal(markupContainsTestId(sessionRouteMarkup, HOST_CHROME.terminalSessionViewTestId), true);
  markHostChromeContract("terminal-session-view");

  // hub-general-chrome
  const hubGeneralChromeMarkup = renderToStaticMarkup(
    createElement(HubGeneralSection, {
      hubStatus: {
        title: "Production Hub",
        host_id: "production-host",
        schema_version: 3,
        software: { product_name: "Botster Hub", version: "0.1.0", build_revision: "8a60bd5" },
        installation: { mode: "development", provenance: "development_build" },
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 6,
          conformance_fixture_revision: 31,
          features: ["sessions", "terminal_streaming"]
        }
      },
      hubUpdate: undefined,
      onCheckForUpdates: () => {}
    })
  );
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubSettingsGeneralTestId), true);
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubSoftwareIdentityTestId), true);
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubHostIdentityTestId), true);
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubInternalStateTestId), true);
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubSoftwareUpdateTestId), true);
  assert.equal(markupContainsTestId(hubGeneralChromeMarkup, HOST_CHROME.hubUpdateOutcomeTestId), true);
  assert.match(hubGeneralChromeMarkup, new RegExp(`>${HOST_CHROME.checkForUpdatesButtonName}<`));
  markHostChromeContract("hub-general-chrome");

  // apps-view — empty + populated (Installed list) branches
  const appsViewEmptyMarkup = renderToStaticMarkup(
    createElement(AppsView, { installedRowCount: 0, onAddPackage: () => {} })
  );
  assert.equal(markupContainsTestId(appsViewEmptyMarkup, HOST_CHROME.appsViewTestId), true);
  assert.match(appsViewEmptyMarkup, new RegExp(`data-testid="${HOST_CHROME.appsViewTestId}"`));
  const appsViewPopulatedMarkup = renderToStaticMarkup(
    createElement(
      AppsView,
      { installedRowCount: 1, onAddPackage: () => {} },
      createElement("div", null, "row")
    )
  );
  assert.match(
    appsViewPopulatedMarkup,
    new RegExp(`aria-label="${HOST_CHROME.installedListLabel}"`)
  );
  markHostChromeContract("apps-view");

  // workbench-nav
  const workbenchNavMarkup = renderToStaticMarkup(
    createElement(WorkbenchNav, { activeView: "dashboard", onNavigate: () => {} })
  );
  assert.match(workbenchNavMarkup, new RegExp(`aria-label="${HOST_CHROME.workbenchNavLabel}"`));
  assert.match(workbenchNavMarkup, new RegExp(`>${HOST_CHROME.homeNavButtonName}<`));
  assert.match(workbenchNavMarkup, new RegExp(`>${HOST_CHROME.appsNavButtonName}<`));
  markHostChromeContract("workbench-nav");

  // selected-app-surface
  const selectedSurfaceMarkup = renderToStaticMarkup(
    createElement(PluginSurfaceRoutePage, {
      packageName: "botster-web",
      surfaceId: "web-client",
      localState: {},
      entities: createInMemoryEntityFrameStore(),
      onAction: () => {}
    })
  );
  assert.equal(markupContainsTestId(selectedSurfaceMarkup, HOST_CHROME.selectedAppSurfaceTestId), true);
  assert.match(selectedSurfaceMarkup, new RegExp(`data-testid="${HOST_CHROME.selectedAppSurfaceTestId}"`));
  markHostChromeContract("selected-app-surface");

  // diagnostics-view + developer-diagnostics (owned by DiagnosticsView)
  const diagnosticsViewMarkup = renderToStaticMarkup(
    createElement(
      DiagnosticsView,
      {
        diagnosticCount: 1,
        blocking: false,
        developerDetails: createElement("div", null, "dev body")
      },
      createElement("div", null, "status body")
    )
  );
  assert.equal(markupContainsTestId(diagnosticsViewMarkup, HOST_CHROME.diagnosticsViewTestId), true);
  assert.match(diagnosticsViewMarkup, new RegExp(`data-testid="${HOST_CHROME.diagnosticsViewTestId}"`));
  assert.match(diagnosticsViewMarkup, new RegExp(`class="${HOST_CHROME.developerDiagnosticsClass}"`));
  assert.match(diagnosticsViewMarkup, new RegExp(`>${HOST_CHROME.supportSectionLabel}<`));
  markHostChromeContract("diagnostics-view");

  // hub-settings-sections
  const hubSettingsNavMarkup = renderToStaticMarkup(
    createElement(HubSettingsSectionsNav, {
      activeSection: "support",
      onNavigate: () => {}
    })
  );
  assert.match(hubSettingsNavMarkup, new RegExp(`aria-label="${HOST_CHROME.hubSettingsSectionsLabel}"`));
  assert.match(hubSettingsNavMarkup, new RegExp(`>${HOST_CHROME.sessionTypesSectionLabel}<`));
  assert.match(hubSettingsNavMarkup, new RegExp(`>${HOST_CHROME.supportSectionLabel}<`));
  markHostChromeContract("hub-settings-sections");

  // session-types-chrome
  const sessionTypesViewMarkup = renderToStaticMarkup(
    createElement(SessionTypesView, { sessionTypeCount: 1 },
      createElement(SessionTypesSurfaceNotices, {
        supported: true,
        subscriptionError: undefined,
        onCreate: () => {}
      })
    )
  );
  assert.equal(markupContainsTestId(sessionTypesViewMarkup, HOST_CHROME.sessionTypesViewTestId), true);
  assert.equal(markupContainsTestId(sessionTypesViewMarkup, HOST_CHROME.createSessionTypeTestId), true);
  const sessionTypeListMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: {
        id: "device/web-authored-agent",
        label: "Web authored agent",
        source: "device",
        available: true,
        editable: true
      },
      onEdit: () => {},
      onDelete: () => {}
    })
  );
  assert.equal(
    markupContainsTestId(sessionTypeListMarkup, deleteSessionTypeTestId("device/web-authored-agent")),
    true
  );
  assert.equal(
    markupContainsTestId(sessionTypeListMarkup, editSessionTypeTestId("device/web-authored-agent")),
    true
  );
  const sessionTypeSubmitMarkup = renderToStaticMarkup(
    createElement(SessionTypeSubmitButton, {
      mode: "create",
      disabled: false,
      submitting: false,
      onClick: () => {}
    })
  );
  assert.equal(markupContainsTestId(sessionTypeSubmitMarkup, HOST_CHROME.submitSessionTypeTestId), true);
  assert.match(sessionTypeSubmitMarkup, />Create</);
  // Edit + pending are the real SessionTypeSubmitButton, not a synthetic button.
  const editSubmitMarkup = renderToStaticMarkup(
    createElement(SessionTypeSubmitButton, {
      mode: "edit",
      disabled: false,
      submitting: false,
      onClick: () => {}
    })
  );
  assert.match(editSubmitMarkup, />Save</);
  const pendingSubmitMarkup = renderToStaticMarkup(
    createElement(SessionTypeSubmitButton, {
      mode: "edit",
      disabled: true,
      submitting: true,
      onClick: () => {}
    })
  );
  assert.match(pendingSubmitMarkup, /Saving…/);
  assert.match(pendingSubmitMarkup, /disabled=""/);
  assert.equal(markupContainsTestId(pendingSubmitMarkup, HOST_CHROME.submitSessionTypeTestId), true);
  markHostChromeContract("session-types-chrome");

  // package-settings-chrome
  const packageSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: {
        id: "botster-web",
        configuration_fields: [{
          id: "remote_browser_rendezvous_enabled",
          value: false,
          errors: []
        }],
        configuration_submit: { id: "botster.package.configure", disabled: false }
      },
      onAction: () => {},
      onOpenSurface: () => {}
    })
  );
  assert.match(packageSettingsMarkup, new RegExp(`>${HOST_CHROME.packageConfigurationLabel}<`));
  assert.match(packageSettingsMarkup, new RegExp(`>${HOST_CHROME.remoteBrowserAccessHeading}<`));
  const remoteAccessMarkup = renderToStaticMarkup(
    createElement(RemoteAccessConfigurationItem, {
      field: { id: "remote_browser_rendezvous_enabled", value: false, errors: [] },
      submit: { id: "botster.package.configure", disabled: false },
      onAction: () => {}
    })
  );
  assert.match(remoteAccessMarkup, new RegExp(`>${HOST_CHROME.remoteBrowserAccessHeading}<`));
  markHostChromeContract("package-settings-chrome");

  // local-hub-first-screen (Hub heading used by schema presentation)
  const localHubFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected",
      diagnostics: [],
      packages: [],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: ""
    })
  );
  assert.match(localHubFirstScreenMarkup, new RegExp(`>${HOST_CHROME.hubHeadingName}<`));
  markHostChromeContract("local-hub-first-screen");

  // Binding completeness: every inventory id evaluated, no stale evaluations
  const inventoryIds = HOST_CHROME_CONTRACTS.map((entry) => entry.id).sort();
  const evaluatedIds = [...evaluatedHostChromeContractIds].sort();
  assert.deepEqual(
    evaluatedIds,
    inventoryIds,
    `host-chrome inventory/evaluation mismatch: inventory=${JSON.stringify(inventoryIds)} evaluated=${JSON.stringify(evaluatedIds)}`
  );
  // render field names a symbol imported into this suite (or a named pin)
  for (const entry of HOST_CHROME_CONTRACTS) {
    if (entry.render === "schemaFloorSourcePin") continue;
    const primaryRender = String(entry.render).split("+")[0].trim().split(/\s+/)[0];
    assert.equal(
      Object.hasOwn(hostChromeRenderSymbols, primaryRender) || hostChromeRenderSymbols[primaryRender] != null,
      true,
      `inventory ${entry.id} render "${entry.render}" is not imported (primary=${primaryRender})`
    );
  }

  // No DOM-parser dependency introduced for this mechanism
  const packageJsonText = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJsonText, /"jsdom"|"happy-dom"|"linkedom"|"cheerio"|"parse5"|"domino"/);

  // New session options come only from Hub list_session_types_for_target. Client-side
  // target_id equality filtering is gone; device Global rows appear when Hub returns them.
  const preparedSpawnForm = spawnSessionFormForTarget(
    { id: "project-main", label: "Project main" },
    1
  );
  assert.deepEqual(preparedSpawnForm, {
    targetId: "project-main",
    targetLabel: "Project main",
    sessionTypeId: "",
    prompt: "",
    submitting: false,
    listGeneration: 1,
    listStatus: "loading",
    options: []
  });
  assert.deepEqual(listSessionTypesForTargetAction("project-main"), {
    id: "botster.session_type.daemon_request",
    target: "project-main",
    label: "List session types for spawn point",
    params: {
      daemon_request: {
        request_type: "list_session_types_for_target",
        target_id: "project-main"
      }
    }
  });
  const hubListForTarget = [
    { session_type_id: "device/global-agent", id: "global-agent", label: "Global agent", available: true, target_id: "device:local" },
    { session_type_id: "device/claude", id: "claude", label: "Claude", available: false, target_id: "device:local" },
    { session_type_id: "project-main/shell", id: "shell", label: "Shell", available: true, target_id: "project-main" }
  ];
  assert.deepEqual(spawnSessionOptionsFromHubList(hubListForTarget), [
    { sessionTypeId: "device/global-agent", label: "Global agent", available: true },
    { sessionTypeId: "device/claude", label: "Claude", available: false },
    { sessionTypeId: "project-main/shell", label: "Shell", available: true }
  ]);
  // Multiple available options: no auto-select.
  const multiOptionForm = applySpawnSessionListResult(
    preparedSpawnForm,
    { targetId: "project-main", listGeneration: 1 },
    { accepted: true, sessionTypes: hubListForTarget }
  );
  assert.deepEqual(multiOptionForm, {
    ...preparedSpawnForm,
    listStatus: "ready",
    options: spawnSessionOptionsFromHubList(hubListForTarget),
    sessionTypeId: "",
    error: undefined
  });
  // Exactly one available option auto-selects presentation-only.
  const singleAvailableForm = applySpawnSessionListResult(
    preparedSpawnForm,
    { targetId: "project-main", listGeneration: 1 },
    {
      accepted: true,
      sessionTypes: [
        { session_type_id: "device/global-agent", label: "Global agent", available: true },
        { session_type_id: "device/claude", label: "Claude", available: false }
      ]
    }
  );
  assert.equal(singleAvailableForm?.sessionTypeId, "device/global-agent");
  assert.equal(singleAvailableForm?.listStatus, "ready");
  // Successful empty list is empty ready state, not loading or error.
  const emptyListForm = applySpawnSessionListResult(
    preparedSpawnForm,
    { targetId: "project-main", listGeneration: 1 },
    { accepted: true, sessionTypes: [] }
  );
  assert.deepEqual(emptyListForm, {
    ...preparedSpawnForm,
    listStatus: "ready",
    options: [],
    sessionTypeId: "",
    error: undefined
  });
  // Hub/transport failure is error, not empty success copy.
  const failedListForm = applySpawnSessionListResult(
    preparedSpawnForm,
    { targetId: "project-main", listGeneration: 1 },
    { accepted: false, reason: "target is not admitted" }
  );
  assert.equal(failedListForm?.listStatus, "error");
  assert.equal(failedListForm?.error, "target is not admitted");
  assert.deepEqual(failedListForm?.options, []);
  // Stale T1 response after T2 open must not replace T2 options.
  const t2Open = spawnSessionFormForTarget({ id: "other-project", label: "Other" }, 2);
  const t2Ready = applySpawnSessionListResult(
    t2Open,
    { targetId: "other-project", listGeneration: 2 },
    {
      accepted: true,
      sessionTypes: [{ session_type_id: "other-project/shell", label: "Other shell", available: true }]
    }
  );
  assert.equal(t2Ready?.options.length, 1);
  assert.equal(
    applySpawnSessionListResult(
      t2Ready,
      { targetId: "project-main", listGeneration: 1 },
      { accepted: true, sessionTypes: hubListForTarget }
    ),
    undefined
  );
  // Closed modal discards late responses.
  assert.equal(
    applySpawnSessionListResult(
      undefined,
      { targetId: "project-main", listGeneration: 1 },
      { accepted: true, sessionTypes: hubListForTarget }
    ),
    undefined
  );
  const selectedSpawnForm = {
    ...multiOptionForm,
    sessionTypeId: "device/global-agent",
    prompt: "  Review the changes  "
  };
  assert.deepEqual(spawnSessionAction(selectedSpawnForm, "spawned-session"), {
    id: "botster.spawn_point.spawn_session",
    target: "project-main",
    label: "Start session",
    params: {
      session_type_id: "device/global-agent",
      session_id: "spawned-session",
      prompt: "Review the changes"
    }
  });
  assert.deepEqual(rejectedSpawnSessionForm(
    { ...selectedSpawnForm, submitting: true },
    "Session type unavailable"
  ), {
    ...selectedSpawnForm,
    submitting: false,
    error: "Session type unavailable"
  });
  assert.equal(rejectedSpawnSessionForm(
    { ...selectedSpawnForm, submitting: true },
    undefined
  ).error, "Botster could not start this session.");

  // Grouping is by Hub's own source token, ordered by name only -- Hub already resolved
  // precedence, so display order must not imply it.
  assert.deepEqual(
    groupSessionTypesBySource([
      { id: "a", source: "repo" },
      { id: "b", source: "device" },
      { id: "c", source: "package" },
      { id: "d", source: "device" }
    ]).map((group) => [group.source, group.rows.map((row) => row.id)]),
    [["device", ["b", "d"]], ["package", ["c"]], ["repo", ["a"]]]
  );

  // Create availability comes from Hub-projected writable sources, never from a row-only
  // editable field. Disabled spawn targets are not offered.
  assert.deepEqual(
    writableSessionTypeSources([
      { id: "project-main", target_id: "project-main", label: "Project main", enabled: true },
      { id: "archived", target_id: "archived", label: "Archived", enabled: false }
    ]),
    [
      { source: "device", targetId: "", label: "This device" },
      { source: "repo", targetId: "project-main", label: "Project main" }
    ]
  );

  assert.deepEqual(
    sessionTypeMutationSource({ ...emptySessionTypeForm, source: "device" }),
    { source: "device" }
  );
  assert.deepEqual(
    sessionTypeMutationSource({ ...emptySessionTypeForm, source: "repo", sourceTargetId: "project-main" }),
    { source: "repo", target_id: "project-main" }
  );

  // Only structural emptiness gates submit. No token, namespace, uniqueness, or path rule
  // is re-implemented client-side; Hub owns all of it.
  const completeSessionTypeForm = {
    ...emptySessionTypeForm,
    id: "codex",
    label: "Codex",
    role: "acme.unknown_role",
    interaction: "interactive",
    lifecycle: "task",
    command: "codex"
  };
  assert.equal(sessionTypeFormIsStructurallyComplete(completeSessionTypeForm), true);
  assert.equal(sessionTypeFormIsStructurallyComplete({ ...completeSessionTypeForm, command: "  " }), false);
  assert.equal(
    sessionTypeFormIsStructurallyComplete({ ...completeSessionTypeForm, source: "repo", sourceTargetId: "" }),
    false
  );

  // Permissive ONLY before Hub status arrives. Once a record exists it is authoritative, so a
  // missing, malformed, or empty feature list all mean unsupported.
  assert.equal(sessionTypeManagementSupported(undefined), true);
  assert.equal(sessionTypeManagementSupported({}), false);
  assert.equal(sessionTypeManagementSupported({ compatibility: {} }), false);
  assert.equal(sessionTypeManagementSupported({ compatibility: { features: "nonsense" } }), false);
  assert.equal(sessionTypeManagementSupported({ compatibility: { features: [] } }), false);
  assert.equal(
    sessionTypeManagementSupported({ compatibility: { features: ["sessions", "resize"] } }),
    false
  );
  assert.equal(
    sessionTypeManagementSupported({
      compatibility: { features: ["sessions", "session_type_entity_subscriptions"] }
    }),
    true
  );

  // RENDERED proof, driven through the predicate itself so the wiring is covered too. Source
  // regexes could not fail if the wrong branch rendered or the two states overlapped.
  const unsupportedMarkup = renderToStaticMarkup(
    createElement(SessionTypesSurfaceNotices, {
      supported: sessionTypeManagementSupported({ compatibility: { features: [] } }),
      subscriptionError: undefined,
      onCreate: () => undefined
    })
  );
  assert.match(unsupportedMarkup, /data-testid="session-types-unsupported"/);
  assert.match(unsupportedMarkup, /does not provide session_type_entity_subscriptions/);
  // The create action must be GONE, not merely styled differently.
  assert.doesNotMatch(unsupportedMarkup, /data-testid="create-session-type"/);
  assert.doesNotMatch(unsupportedMarkup, /data-testid="session-types-subscription-error"/);

  const supportedMarkup = renderToStaticMarkup(
    createElement(SessionTypesSurfaceNotices, {
      supported: sessionTypeManagementSupported({
        compatibility: { features: ["session_type_entity_subscriptions"] }
      }),
      subscriptionError: undefined,
      onCreate: () => undefined
    })
  );
  assert.match(supportedMarkup, /data-testid="create-session-type"/);
  assert.doesNotMatch(supportedMarkup, /data-testid="session-types-unsupported"/);

  // The subscription error is a DISTINCT condition: it renders Hub's code and message
  // verbatim while capability support is unaffected, per acceptance check 15.
  const subscriptionErrorMarkup = renderToStaticMarkup(
    createElement(SessionTypesSurfaceNotices, {
      supported: sessionTypeManagementSupported({
        compatibility: { features: ["session_type_entity_subscriptions"] }
      }),
      subscriptionError: {
        family: "session_type",
        code: "entity_provider_frame_too_large",
        message: "session_type snapshot exceeded the frame budget"
      },
      onCreate: () => undefined
    })
  );
  assert.match(subscriptionErrorMarkup, /data-testid="session-types-subscription-error"/);
  assert.match(subscriptionErrorMarkup, /entity_provider_frame_too_large/);
  assert.match(subscriptionErrorMarkup, /session_type snapshot exceeded the frame budget/);
  assert.match(subscriptionErrorMarkup, /data-testid="create-session-type"/);
  assert.doesNotMatch(subscriptionErrorMarkup, /data-testid="session-types-unsupported"/);

  // Both conditions at once still render as two separate states.
  const bothMarkup = renderToStaticMarkup(
    createElement(SessionTypesSurfaceNotices, {
      supported: sessionTypeManagementSupported({ compatibility: { features: [] } }),
      subscriptionError: {
        family: "session_type",
        code: "entity_provider_frame_too_large",
        message: "session_type snapshot exceeded the frame budget"
      },
      onCreate: () => undefined
    })
  );
  assert.match(bothMarkup, /data-testid="session-types-unsupported"/);
  assert.match(bothMarkup, /data-testid="session-types-subscription-error"/);
  assert.doesNotMatch(bothMarkup, /data-testid="create-session-type"/);

  // The surface actually uses the predicate rather than an inline condition.
  assert.match(app, /sessionTypeManagementSupported\(hubStatus\)/);
  assert.match(app, /<SessionTypesSurfaceNotices/);

  // Delete addresses the row by Hub's own source, read from the row rather than
  // reconstructed through a form projection.
  assert.deepEqual(
    sessionTypeMutationSourceFromRecord(
      authoritativeSessionTypeItems.find((item) => item.session_type_id === "project-main/repo-codex")
    ),
    { source: "repo", target_id: "project-main" }
  );
  assert.deepEqual(
    sessionTypeMutationSourceFromRecord(
      authoritativeSessionTypeItems.find((item) => item.session_type_id === "device/codex")
    ),
    { source: "device" }
  );

  // Create authors a complete definition from the form; list fields split on commas or
  // whitespace and Hub owns every semantic rule beyond that.
  const createDefinition = sessionTypeDefinitionFromForm({
    ...completeSessionTypeForm,
    traits: "terminal, companion",
    args: "--interactive --json",
    contextKeys: "prompt"
  });
  assert.equal(createDefinition.id, "codex");
  assert.equal(createDefinition.role, "acme.unknown_role");
  assert.deepEqual(createDefinition.traits, ["terminal", "companion"]);
  assert.deepEqual(createDefinition.args, ["--interactive", "--json"]);
  assert.deepEqual(createDefinition.context, ["prompt"]);
  // Empty description/icon omit rather than forcing Some("").
  assert.equal(Object.hasOwn(createDefinition, "description"), false);
  assert.equal(Object.hasOwn(createDefinition, "icon"), false);
  assert.equal(Object.hasOwn(createDefinition, "target_id"), false);

  // The published row still cannot reconstruct an authoring definition: Hub exposes
  // working_directory_policy but not the authored path, and no environment at all. Edit
  // therefore seeds only from show_session_type_definition.
  const publishedRow = authoritativeSessionTypeItems.find((item) => item.session_type_id === "device/codex");
  assert.equal(Object.hasOwn(publishedRow, "working_directory_policy"), true);
  assert.equal(Object.hasOwn(publishedRow, "working_directory"), false);
  assert.equal(Object.hasOwn(publishedRow, "environment"), false);

  // Lossless field map: seed from authoring definition, change only label, re-emit preserves
  // relative path, environment, context, opaque definition target_id, and token fields that
  // cannot survive text projection (whitespace, commas, multi-line / padded env values).
  const authoringEditable = {
    session_type_id: "device/lossless-agent",
    source: { source: "device" },
    definition: {
      id: "lossless-agent",
      label: "Lossless agent",
      description: "Authored description",
      role: "botster.agent",
      interaction: "interactive",
      traits: ["terminal", "acme.custom trait"],
      lifecycle: "task",
      command: "sleep",
      args: ["--append-system-prompt", "You are a careful reviewer", "--fields", "a,b,c"],
      working_directory: { policy: "relative", path: "agents/live" },
      environment: {
        LIVE_KEY: "live-value",
        BANNER: "line1\nline2",
        PS1: "  prompt> "
      },
      allowed_environment_overrides: ["CODEX_TOKEN", "PATH,with,commas"],
      context: ["prompt", "workspace key"],
      target_id: "project-main"
    }
  };
  const seededForm = sessionTypeFormFromAuthoringDefinition(authoringEditable);
  assert.ok(seededForm);
  assert.equal(seededForm.mode, "edit");
  assert.equal(seededForm.id, "lossless-agent");
  assert.equal(seededForm.workingDirectoryPolicy, "relative");
  assert.equal(seededForm.workingDirectoryPath, "agents/live");
  assert.equal(seededForm.definitionTargetId, "project-main");
  assert.equal(seededForm.source, "device");
  assert.deepEqual(seededForm.seededArgs, authoringEditable.definition.args);
  assert.deepEqual(seededForm.seededEnvironment, authoringEditable.definition.environment);

  const updatedDefinition = sessionTypeDefinitionFromForm({
    ...seededForm,
    label: "Lossless agent renamed"
  });
  assert.equal(updatedDefinition.label, "Lossless agent renamed");
  assert.equal(updatedDefinition.id, "lossless-agent");
  assert.deepEqual(updatedDefinition.working_directory, { policy: "relative", path: "agents/live" });
  assert.deepEqual(updatedDefinition.environment, authoringEditable.definition.environment);
  assert.deepEqual(updatedDefinition.context, authoringEditable.definition.context);
  assert.deepEqual(updatedDefinition.args, authoringEditable.definition.args);
  assert.deepEqual(updatedDefinition.traits, authoringEditable.definition.traits);
  assert.deepEqual(
    updatedDefinition.allowed_environment_overrides,
    authoringEditable.definition.allowed_environment_overrides
  );
  assert.equal(updatedDefinition.target_id, "project-main");
  assert.equal(updatedDefinition.description, "Authored description");

  // Ablation: dropping definitionTargetId must fail the target_id oracle.
  const ablatedDefinition = sessionTypeDefinitionFromForm({
    ...seededForm,
    label: "Lossless agent renamed",
    definitionTargetId: ""
  });
  assert.equal(Object.hasOwn(ablatedDefinition, "target_id"), false);
  assert.notEqual(ablatedDefinition.target_id, "project-main");

  // Ablation: clearing seeded token/env carries must fail the lossless token oracle —
  // proves the carry is load-bearing, not incidental text projection luck.
  const ablatedTokens = sessionTypeDefinitionFromForm({
    ...seededForm,
    label: "Lossless agent renamed",
    seededArgs: undefined,
    seededTraits: undefined,
    seededContext: undefined,
    seededAllowedEnvironmentOverrides: undefined,
    seededEnvironment: undefined
  });
  assert.notDeepEqual(ablatedTokens.args, authoringEditable.definition.args);
  assert.notDeepEqual(ablatedTokens.environment, authoringEditable.definition.environment);
  // parseTokenList splits whitespace and commas — the multi-word prompt becomes many tokens.
  assert.ok(ablatedTokens.args.includes("You"));
  assert.ok(ablatedTokens.args.includes("careful"));
  // Multi-line env value is truncated at the first newline by parseMetadata.
  assert.equal(ablatedTokens.environment.BANNER, "line1");
  assert.equal(ablatedTokens.environment.PS1, "prompt>");

  // Relative empty path still emits path so Hub's Relative { path: String } can deserialize.
  assert.deepEqual(
    sessionTypeDefinitionFromForm({
      ...seededForm,
      workingDirectoryPolicy: "relative",
      workingDirectoryPath: ""
    }).working_directory,
    { policy: "relative", path: "" }
  );

  // Form promise: rejection keeps draft (pending Save/Saving… asserted via real
  // SessionTypeSubmitButton render in the host-chrome inventory block above).
  assert.deepEqual(
    rejectedSessionTypeForm(
      { ...seededForm, submitting: true },
      { reason: "invalid role", result: { error_kind: "invalid_session_type_role" } }
    ),
    {
      ...seededForm,
      submitting: false,
      error: "invalid_session_type_role: invalid role"
    }
  );

  // entity_error is surface-scoped, verbatim, and matched by family.
  assert.deepEqual(
    entitySubscriptionErrorFromFrame(
      {
        kind: "entity_error",
        payload: {
          family: "session_type",
          code: "entity_provider_frame_too_large",
          message: "session_type snapshot exceeded the frame budget"
        }
      },
      "session_type"
    ),
    {
      family: "session_type",
      code: "entity_provider_frame_too_large",
      message: "session_type snapshot exceeded the frame budget"
    }
  );
  assert.equal(
    entitySubscriptionErrorFromFrame(
      { kind: "entity_error", payload: { family: "session", code: "boom", message: "other family" } },
      "session_type"
    ),
    undefined
  );
  assert.equal(
    entitySubscriptionErrorFromFrame(
      { kind: "entity_snapshot", payload: { family: "session_type" } },
      "session_type"
    ),
    undefined
  );

  function findReactElement(node, predicate) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findReactElement(child, predicate);
        if (match) return match;
      }
      return undefined;
    }
    if (!node || typeof node !== "object") return undefined;
    if ("props" in node && predicate(node)) return node;
    const children = "props" in node ? node.props.children : undefined;
    const queue = Array.isArray(children) ? children : [children];
    for (const child of queue) {
      const match = findReactElement(child, predicate);
      if (match) return match;
    }
    return undefined;
  }

  let openedSessionId;
  const interactiveSessionItem = SessionListItem({
    session: runningTerminalSession,
    onOpen: (sessionId) => {
      openedSessionId = sessionId;
    }
  });
  const openSessionButton = findReactElement(
    interactiveSessionItem,
    (node) => node.props?.children === "Open"
  );
  assert.ok(openSessionButton);
  openSessionButton.props.onClick();
  assert.equal(openedSessionId, activeHubSessionId);

  const blockedPluginSurfaceShortcut = packageNavigationShortcut({
    id: "project-pipelines:blocked-home",
    label: "Blocked Home",
    target_kind: "plugin_surface",
    package_name: "project-pipelines",
    surface_id: "home",
    enabled: false,
    diagnostics_summary: "Package policy blocked this surface."
  });
  const blockedAppEntrypointShortcut = packageNavigationShortcut({
    id: "project-pipelines:web-client",
    label: "Blocked Web Client",
    target_kind: "app_entrypoint",
    package_name: "project-pipelines",
    enabled: false,
    diagnostics: ["Entrypoint is disabled by admission."]
  });
  const blockedFutureShortcut = packageNavigationShortcut({
    id: "project-pipelines:future",
    label: "Blocked Future Target",
    target_kind: "future_widget",
    blocked: true
  });
  const enabledUnsupportedShortcut = packageNavigationShortcut({
    id: "project-pipelines:enabled-entrypoint",
    label: "Enabled Web Client",
    target_kind: "app_entrypoint",
    package_name: "project-pipelines",
    route_path: "/packages/project-pipelines"
  });
  const supportedPluginSurfaceShortcut = packageNavigationShortcut({
    id: "project-pipelines:home",
    label: "Pipelines",
    target_kind: "plugin_surface",
    package_name: "project-pipelines",
    surface_id: "home",
    route_path: "/packages/project-pipelines/surfaces/home"
  });

  assert.equal(blockedPluginSurfaceShortcut.openable, false);
  assert.equal(blockedPluginSurfaceShortcut.diagnostic, "Package policy blocked this surface.");
  assert.equal(blockedAppEntrypointShortcut.openable, false);
  assert.equal(blockedAppEntrypointShortcut.diagnostic, "Entrypoint is disabled by admission.");
  assert.equal(blockedFutureShortcut.openable, false);
  assert.equal(blockedFutureShortcut.diagnostic, "Unavailable from hub navigation registry");
  assert.equal(enabledUnsupportedShortcut.openable, false);
  assert.equal(enabledUnsupportedShortcut.diagnostic, "Unsupported navigation target: app_entrypoint");
  assert.equal(supportedPluginSurfaceShortcut.openable, true);
  assert.equal(supportedPluginSurfaceShortcut.diagnostic, undefined);

  let navigationOpenCount = 0;
  const blockedPluginMarkup = renderToStaticMarkup(
    createElement(PackageNavigationShortcutButton, {
      shortcut: blockedPluginSurfaceShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    })
  );
  const blockedAppEntrypointMarkup = renderToStaticMarkup(
    createElement(PackageNavigationShortcutButton, {
      shortcut: blockedAppEntrypointShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    })
  );
  const blockedFutureMarkup = renderToStaticMarkup(
    createElement(PackageNavigationShortcutButton, {
      shortcut: blockedFutureShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    })
  );
  const enabledUnsupportedMarkup = renderToStaticMarkup(
    createElement(PackageNavigationShortcutButton, {
      shortcut: enabledUnsupportedShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    })
  );
  const supportedPluginMarkup = renderToStaticMarkup(
    createElement(PackageNavigationShortcutButton, {
      shortcut: supportedPluginSurfaceShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    })
  );

  assert.match(blockedPluginMarkup, /Blocked Home/);
  assert.match(blockedPluginMarkup, /Package policy blocked this surface\./);
  assert.match(blockedPluginMarkup, /aria-disabled="true"/);
  assert.match(blockedAppEntrypointMarkup, /Blocked Web Client/);
  assert.match(blockedAppEntrypointMarkup, /Entrypoint is disabled by admission\./);
  assert.match(blockedFutureMarkup, /Blocked Future Target/);
  assert.match(blockedFutureMarkup, /Unavailable from hub navigation registry/);
  assert.match(enabledUnsupportedMarkup, /Enabled Web Client/);
  assert.match(enabledUnsupportedMarkup, /Unsupported navigation target: app_entrypoint/);
  assert.doesNotMatch(enabledUnsupportedMarkup, /Package policy blocked this surface|Unavailable from hub navigation registry/);
  assert.match(supportedPluginMarkup, /Pipelines/);
  assert.doesNotMatch(supportedPluginMarkup, /aria-disabled="true"|Unsupported navigation target|Unavailable from hub navigation registry/);

  const disabledNavigationButton = findReactElement(
    PackageNavigationShortcutButton({
      shortcut: enabledUnsupportedShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    }),
    (node) => node.type === "button"
  );
  disabledNavigationButton.props.onClick();
  assert.equal(navigationOpenCount, 0);
  const enabledNavigationButton = findReactElement(
    PackageNavigationShortcutButton({
      shortcut: supportedPluginSurfaceShortcut,
      onOpen: () => { navigationOpenCount += 1; }
    }),
    (node) => node.type === "button"
  );
  enabledNavigationButton.props.onClick();
  assert.equal(navigationOpenCount, 1);

  const mixedNavigationRecords = [
    {
      id: "project-pipelines:web-client",
      label: "Blocked Web Client",
      target_kind: "app_entrypoint",
      package_name: "project-pipelines",
      enabled: false,
      diagnostics: ["Entrypoint is disabled by admission."]
    },
    {
      id: "project-pipelines:enabled-entrypoint",
      label: "Enabled Web Client",
      target_kind: "app_entrypoint",
      package_name: "project-pipelines",
      route_path: "/packages/project-pipelines"
    },
    {
      id: "project-pipelines:future",
      label: "Blocked Future Target",
      target_kind: "future_widget",
      blocked: true
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `project-pipelines:blocked-${index}`,
      label: `Blocked ${index + 1}`,
      target_kind: "future_widget",
      blocked: true
    })),
    {
      id: "project-pipelines:home",
      label: "Pipelines",
      target_kind: "plugin_surface",
      package_name: "project-pipelines",
      surface_id: "home",
      route_path: "/packages/project-pipelines/surfaces/home"
    }
  ];
  const mixedNavigationMarkup = renderToStaticMarkup(
    createElement(PluginNavigationShortcuts, {
      entries: mixedNavigationRecords,
      onOpen: () => undefined
    })
  );
  assert.equal(mixedNavigationRecords.length, 9);
  assert.match(mixedNavigationMarkup, /Blocked Web Client/);
  assert.match(mixedNavigationMarkup, /Enabled Web Client/);
  assert.match(mixedNavigationMarkup, /Blocked Future Target/);
  assert.match(mixedNavigationMarkup, /Blocked 5/);
  assert.match(mixedNavigationMarkup, /Pipelines/);
  assert.match(mixedNavigationMarkup, /class="sidebar-section-scroll"/);
  assert.match(mixedNavigationMarkup, /tabindex="0"/);
  assert.match(mixedNavigationMarkup, /aria-label="Scrollable plugin navigation"/);
  assert.match(mixedNavigationMarkup, /aria-describedby="plugin-navigation-overflow-hint"/);
  assert.match(mixedNavigationMarkup, /id="plugin-navigation-overflow-hint"/);
  assert.match(mixedNavigationMarkup, /Scroll for more plugin navigation\./);

  const boundedNavigationMarkup = renderToStaticMarkup(
    createElement(PluginNavigationShortcuts, {
      entries: mixedNavigationRecords.slice(0, 8),
      onOpen: () => undefined
    })
  );
  assert.match(boundedNavigationMarkup, /Blocked Web Client/);
  assert.match(boundedNavigationMarkup, /Blocked 5/);
  assert.doesNotMatch(boundedNavigationMarkup, /sidebar-section-scroll/);
  assert.doesNotMatch(boundedNavigationMarkup, /tabindex="0"/);
  assert.doesNotMatch(boundedNavigationMarkup, /Scrollable plugin navigation/);
  assert.doesNotMatch(boundedNavigationMarkup, /plugin-navigation-overflow-hint/);
  assert.doesNotMatch(boundedNavigationMarkup, /Scroll for more plugin navigation/);

  assert.equal(terminalDataPlaneLabel("webrtc"), "WebRTC DataChannel");

  const descriptorPackageAction = {
    id: "descriptor-only:disable_package",
    action_id: "disable_package",
    status: "available",
    reason: "",
    diagnostics: [],
    required_references: [],
    action: {
      id: "botster.package.daemon_request",
      target: "descriptor-only",
      label: "Disable Package",
      params: {
        package_name: "descriptor-only",
        action_id: "disable_package",
        action_status: "available",
        action_reason: "",
        daemon_request: {
          request_type: "disable_package",
          package_name: "descriptor-only"
        }
      }
    }
  };

  const dtoBackedWebApp = {
    id: "botster-web:production",
    title: "botster-web production",
    kind: "web_app",
    launch_target_kind: "web_app",
    lifecycle_state: "running",
    local_url: "http://127.0.0.1:41821",
    diagnostics: [],
    diagnostics_summary: "Lifecycle: running",
    open_action: {
      id: "botster.app.open_url",
      target: "botster-web:production",
      label: "Open app",
      disabled: false,
      params: { local_url: "http://127.0.0.1:41821" }
    }
  };
  const dtoBackedMissingUrlApp = {
    ...dtoBackedWebApp,
    id: "botster-web:missing-url",
    title: "Missing URL",
    local_url: "",
    diagnostics_summary: "Web app has no hub-provided local URL.",
    open_action: {
      ...dtoBackedWebApp.open_action,
      target: "botster-web:missing-url",
      disabled: true,
      params: { local_url: "" }
    }
  };
  const dtoBackedBlockedApp = {
    ...dtoBackedWebApp,
    id: "botster-web:blocked",
    title: "Blocked App",
    blocked_reasons: ["capability blocked"],
    diagnostics: ["capability blocked"],
    diagnostics_summary: "capability blocked",
    open_action: {
      ...dtoBackedWebApp.open_action,
      target: "botster-web:blocked",
      disabled: true
    }
  };
  const dtoBackedTerminalApp = {
    id: "project-pipelines:worker",
    title: "project-pipelines worker",
    kind: "terminal_app",
    launch_target_kind: "terminal_app",
    lifecycle_state: "installed",
    diagnostics: [],
    diagnostics_summary: "Requires local terminal launch.",
    open_action: {
      id: "botster.app.open_url",
      target: "project-pipelines:worker",
      label: "Launch in terminal",
      disabled: true,
      params: {}
    }
  };
  const dtoBackedUiSurfaceApp = {
    ...dtoBackedWebApp,
    id: "project-pipelines:web-client",
    title: "project-pipelines web client",
    package_name: "project-pipelines",
    local_url: ""
  };
  const matchedAppSurface = {
    surface_id: "home",
    title: "Pipelines",
    description: "Project Pipelines workbench",
    launch_action: {
      id: "botster.package.surface.render",
      target: "project-pipelines",
      label: "Pipelines",
      params: {
        package_name: "project-pipelines",
        surface_id: "home",
        surface_kind: "app",
        supports: ["render"]
      }
    }
  };
  const openedApps = [];
  const webAppMarkup = renderToStaticMarkup(
    createElement(AppListItem, {
      app: dtoBackedWebApp,
      onOpen: (appRecord) => openedApps.push(appRecord)
    })
  );
  assert.match(webAppMarkup, /botster web production/);
  assert.match(webAppMarkup, /web_app/);
  assert.match(webAppMarkup, /Open/);
  assert.doesNotMatch(webAppMarkup, /Descriptor Production|PackageSurfaces/);
  const webAppTree = AppListItem({
    app: dtoBackedWebApp,
    onOpen: (appRecord) => openedApps.push(appRecord)
  });
  const webAppItem = findReactElement(webAppTree, (element) => typeof element.props?.onClick === "function");
  assert.ok(webAppItem);
  webAppItem.props.onClick();
  assert.deepEqual(openedApps.map((appRecord) => appRecord.id), ["botster-web:production"]);
  const uiSurfaceMarkup = renderToStaticMarkup(
    createElement(AppListItem, {
      app: dtoBackedUiSurfaceApp,
      surface: matchedAppSurface,
      onOpen: (appRecord) => openedApps.push(appRecord)
    })
  );
  assert.match(uiSurfaceMarkup, /project pipelines web client/);
  assert.match(uiSurfaceMarkup, /Project Pipelines workbench/);
  assert.match(uiSurfaceMarkup, /Open UI/);
  assert.doesNotMatch(uiSurfaceMarkup, /has no hub-provided local URL/);

  const renderPluginSurfaceRoutePage = (selectedSurface) =>
    renderToStaticMarkup(
      createElement(PluginSurfaceRoutePage, {
        packageName: "botster-web",
        surfaceId: "production-app",
        selectedSurface,
        localState: {},
        entities: createInMemoryEntityFrameStore(),
        onAction: () => undefined
      })
    );
  const expectedProductionSurface = { packageName: "botster-web", surfaceId: "production-app" };
  const validatedProductionSnapshot = {
    kind: "ui_tree_snapshot",
    surface: "botster-web/production-app",
    version: "plugin-surface-hub-validated-v1",
    root: {
      id: "production-app-root",
      type: "panel",
      props: { title: "botster-web App" },
      children: [
        {
          id: "production-app-copy",
          type: "text",
          props: { text: "Workspaces rendered" }
        },
        {
          id: "production-app-action",
          type: "button",
          props: {
            label: "Run deterministic action",
            action: { id: "ticket.open" }
          }
        }
      ]
    }
  };
  const successfulValidatedSnapshotSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web",
    phase: "rendered",
    status: "botster-web: Workspaces rendered (botster-web/production-app)",
    snapshot: validatedProductionSnapshot
  });
  assert.match(successfulValidatedSnapshotSurfaceMarkup, /class="plugin-surface-page"/);
  assert.match(successfulValidatedSnapshotSurfaceMarkup, /Workspaces rendered/);
  assert.match(successfulValidatedSnapshotSurfaceMarkup, /botster-web App/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, /data-testid="plugin-route-status-badge"/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, />Rendered<\/ion-badge>/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, /Plugin surface/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, /Renderer registry/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, /botster-web\/production-app/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, /workflow-section/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, />Loading<\/ion-badge>/);
  const workspacesNamedSlotSurface = { packageName: "botster-workspaces", surfaceId: "workspaces" };
  // Synthetic named-slot renderer coverage deliberately exercises exhaustive slot shapes,
  // including list.empty. These fixture-only IDs must not be mined for production-package oracles.
  const workspacesNamedSlotState = renderedPluginSurfaceState(
    {
      accepted: true,
      result: {
        kind: "plugin_surface",
        plugin_surface: {
          package_name: workspacesNamedSlotSurface.packageName,
          surface_id: workspacesNamedSlotSurface.surfaceId,
          body: "Workspaces",
          ui_tree_snapshot: {
            package_name: workspacesNamedSlotSurface.packageName,
            surface_id: workspacesNamedSlotSurface.surfaceId,
            body: {
              id: "named-slot-fixture-app",
              type: "panel",
              props: { title: "Workspaces" },
              slots: {
                header: [
                  {
                    id: "named-slot-fixture-header",
                    type: "text",
                    props: { text: "Workspace application header" }
                  }
                ],
                toolbar: [
                  {
                    id: "named-slot-fixture-toolbar",
                    type: "toolbar",
                    props: { label: "Workspace actions" },
                    slots: {
                      commands: [
                        {
                          id: "named-slot-fixture-toolbar-command",
                          type: "button",
                          props: { label: "Create", action: "workspace.create" }
                        }
                      ],
                      filters: [
                        {
                          id: "named-slot-fixture-toolbar-filter",
                          type: "text",
                          props: { text: "Active workspaces" }
                        }
                      ],
                      search: [
                        {
                          id: "named-slot-fixture-toolbar-search",
                          type: "text",
                          props: { text: "Search workspaces" }
                        }
                      ],
                      actions: [
                        {
                          id: "named-slot-fixture-toolbar-action",
                          type: "button",
                          props: { label: "Refresh", action: "workspace.refresh" }
                        }
                      ]
                    }
                  }
                ],
                body: [
                  {
                    id: "named-slot-fixture-read-model",
                    type: "text",
                    props: { text: "Read model: named-slot-fixture.record" }
                  },
                  {
                    id: "named-slot-fixture-metrics",
                    type: "metric_grid",
                    props: { density: "compact" },
                    children: [
                      {
                        id: "named-slot-fixture-metric-count",
                        type: "metric",
                        props: { label: "Workspaces", value: 1 }
                      }
                    ]
                  },
                  {
                    id: "named-slot-fixture-index-section",
                    type: "section",
                    props: { title: "Workspace index" },
                    slots: {
                      header: [
                        {
                          id: "named-slot-fixture-index-header",
                          type: "text",
                          props: { text: "Workspace index header" }
                        }
                      ],
                      toolbar: [
                        {
                          id: "named-slot-fixture-index-toolbar",
                          type: "toolbar",
                          props: { label: "Index tools" }
                        }
                      ],
                      body: [
                        {
                          id: "named-slot-fixture-list",
                          type: "list",
                          props: { aria_label: "Workspaces" },
                          children: [
                            {
                              id: "workspace-row-alpha",
                              type: "list_item",
                              props: { value: "alpha" },
                              slots: {
                                title: [
                                  {
                                    id: "workspace-row-alpha-title",
                                    type: "text",
                                    props: { text: "Alpha workspace" }
                                  }
                                ],
                                subtitle: [
                                  {
                                    id: "workspace-row-alpha-purpose",
                                    type: "text",
                                    props: { text: "Synthetic named-slot renderer coverage" }
                                  }
                                ],
                                meta: [
                                  {
                                    id: "workspace-row-alpha-status",
                                    type: "status_badge",
                                    props: { label: "active", status: "active" }
                                  }
                                ]
                              }
                            }
                          ]
                        }
                      ],
                      footer: [
                        {
                          id: "named-slot-fixture-index-footer",
                          type: "text",
                          props: { text: "Workspace index footer" }
                        }
                      ],
                      actions: [
                        {
                          id: "named-slot-fixture-index-action",
                          type: "button",
                          props: { label: "Open index", action: "workspace.index.open" }
                        }
                      ]
                    }
                  },
                  {
                    id: "named-slot-fixture-create-form",
                    type: "form",
                    props: { action: "workspace.create" },
                    children: [
                      {
                        id: "named-slot-fixture-create-name",
                        type: "text_input",
                        props: { name: "name", label: "Workspace name" }
                      }
                    ]
                  },
                  {
                    id: "named-slot-fixture-spawn-form",
                    type: "form",
                    props: { action: "workspace.spawn" },
                    children: [
                      {
                        id: "named-slot-fixture-spawn-id",
                        type: "text_input",
                        props: { name: "workspace_id", label: "Workspace" }
                      }
                    ]
                  },
                  {
                    id: "named-slot-fixture-empty-section",
                    type: "section",
                    props: { title: "Empty workspace section" },
                    slots: {
                      empty: [
                        {
                          id: "named-slot-fixture-section-empty-state",
                          type: "empty_state",
                          props: { title: "No section rows" }
                        }
                      ]
                    }
                  },
                  {
                    id: "named-slot-fixture-empty-panel",
                    type: "panel",
                    slots: {
                      header: [
                        {
                          id: "named-slot-fixture-titleless-panel-header",
                          type: "text",
                          props: { text: "Titleless panel header" }
                        }
                      ],
                      empty: [
                        {
                          id: "named-slot-fixture-panel-empty-state",
                          type: "empty_state",
                          props: { title: "No panel rows" }
                        }
                      ]
                    }
                  }
                ],
                empty: [
                  {
                    id: "named-slot-fixture-populated-empty-state",
                    type: "empty_state",
                    props: { title: "Must stay hidden while body content exists" }
                  }
                ],
                footer: [
                  {
                    id: "named-slot-fixture-footer",
                    type: "text",
                    props: { text: "Workspace application footer" }
                  }
                ],
                actions: [
                  {
                    id: "named-slot-fixture-action",
                    type: "button",
                    props: { label: "Open workspace", action: "workspace.open" }
                  }
                ]
              }
            }
          }
        }
      }
    },
    "Workspaces",
    workspacesNamedSlotSurface,
    "botster-workspaces/workspaces"
  );
  const workspacesNamedSlotMarkup = renderPluginSurfaceRoutePage({
    ...workspacesNamedSlotState,
    title: "Workspaces"
  });
  for (const nodeId of [
    "named-slot-fixture-header",
    "named-slot-fixture-toolbar",
    "named-slot-fixture-toolbar-command",
    "named-slot-fixture-toolbar-filter",
    "named-slot-fixture-toolbar-search",
    "named-slot-fixture-toolbar-action",
    "named-slot-fixture-read-model",
    "named-slot-fixture-metrics",
    "named-slot-fixture-index-section",
    "named-slot-fixture-index-header",
    "named-slot-fixture-index-toolbar",
    "named-slot-fixture-list",
    "named-slot-fixture-index-footer",
    "named-slot-fixture-index-action",
    "named-slot-fixture-create-form",
    "named-slot-fixture-spawn-form",
    "named-slot-fixture-section-empty-state",
    "named-slot-fixture-panel-empty-state",
    "named-slot-fixture-titleless-panel-header",
    "named-slot-fixture-footer",
    "named-slot-fixture-action"
  ]) {
    assert.match(workspacesNamedSlotMarkup, new RegExp(`data-ui-node-id="${nodeId}"`));
  }
  assert.match(workspacesNamedSlotMarkup, /<ion-buttons slot="start">/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-slot="filters" slot="secondary"/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-slot="search" slot="primary"/);
  assert.match(workspacesNamedSlotMarkup, /<ion-buttons slot="end">/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-slot="empty" role="status"/);
  assert.doesNotMatch(workspacesNamedSlotMarkup, /named-slot-fixture-populated-empty-state/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-node-id="named-slot-fixture-toolbar"/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-node-id="named-slot-fixture-read-model"/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-node-id="named-slot-fixture-index-section"/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-node-id="named-slot-fixture-list"/);
  assert.match(workspacesNamedSlotMarkup, /Alpha workspace/);
  assert.match(workspacesNamedSlotMarkup, /Synthetic named-slot renderer coverage/);
  assert.match(workspacesNamedSlotMarkup, /data-ui-node-id="workspace-row-alpha-status"/);
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "production-app",
            body: "Workspaces rendered",
            ui_tree_snapshot: {
              package_name: "botster-web",
              surface_id: "production-app",
              body: {
                id: "production-app-root",
                type: "panel",
                props: { title: "botster-web App" },
                children: [
                  {
                    id: "production-app-copy",
                    type: "text",
                    props: { text: "Workspaces rendered" }
                  },
                  {
                    id: "production-app-action",
                    type: "button",
                    props: { label: "Run deterministic action", action: { id: "ticket.open" } }
                  }
                ]
              }
            }
          }
        }
      },
      "botster-web",
      expectedProductionSurface,
      "botster-web/production-app"
    ),
    {
      routeKey: "botster-web/production-app",
      title: "botster-web",
      phase: "rendered",
      status: "botster-web: Workspaces rendered (botster-web/production-app)",
      snapshot: validatedProductionSnapshot,
      packageName: "botster-web",
      surfaceId: "production-app"
    }
  );
  const applicationPrimitiveSurface = { packageName: "botster.plugin-contract-matrix", surfaceId: "contract.app" };
  const applicationPrimitiveHubBody = {
    id: "contract-app-panel",
    type: "panel",
    props: { title: "Plugin Contract Matrix", density: "regular", variant: "plain" },
    children: [
      {
        id: "contract-app-toolbar",
        type: "toolbar",
        props: { label: "Contract actions", density: "compact", variant: "plain" },
        slots: {
          actions: [
            {
              id: "contract-app-action",
              type: "button",
              props: {
                label: "Run contract action",
                action: { id: "contract.action", payload: { workspace_id: "workspace-toolbar" } }
              }
            }
          ]
        }
      },
      {
        id: "contract-app-metrics",
        type: "metric_grid",
        props: { density: "compact", variant: "subtle", compact: true },
        children: [
          {
            id: "contract-app-render-metric",
            type: "metric",
            props: {
              label: "Render path",
              value: "validated",
              caption: "plugin_surface_render",
              tone: "success",
              status: "healthy"
            }
          }
        ]
      },
      {
        id: "contract-app-section",
        type: "section",
        props: {
          title: "Application primitives",
          description: "Renderer-neutral UiNode application surface."
        },
        children: [
          {
            id: "contract-app-status",
            type: "status_badge",
            props: { label: "Validated", status: "supported", tone: "success" }
          },
          {
            id: "contract-app-table",
            type: "table",
            props: {
              columns: [{ id: "primitive", label: "Primitive" }, "status"],
              rows: [
                {
                  id: "contract-app-row-toolbar",
                  cells: {
                    type: "toolbar",
                    status: "supported"
                  },
                  action: { id: "contract.row.open", payload: { workspace_id: "workspace-alpha" } }
                }
              ],
              empty_state: {
                id: "contract-app-table-empty",
                type: "empty_state",
                props: {
                  title: "No primitives",
                  description: "The fixture did not publish primitive rows.",
                  primary_action: { id: "contract.table.empty.primary", payload: { workspace_id: "workspace-table-empty" } }
                }
              }
            }
          },
          {
            id: "contract-app-empty-state",
            type: "empty_state",
            props: {
              title: "No pending contracts",
              description: "All required application primitives validated.",
              primary_action: { id: "contract.empty.primary", payload: { workspace_id: "workspace-empty" } }
            }
          }
        ]
      }
    ]
  };
  const applicationPrimitiveState = renderedPluginSurfaceState(
    {
      accepted: true,
      result: {
        kind: "plugin_surface",
        plugin_surface: {
          package_name: applicationPrimitiveSurface.packageName,
          surface_id: applicationPrimitiveSurface.surfaceId,
          body: "UiNode payload delivered through plugin_surface_render.",
          ui_tree_snapshot: {
            package_name: applicationPrimitiveSurface.packageName,
            surface_id: applicationPrimitiveSurface.surfaceId,
            body: applicationPrimitiveHubBody
          }
        }
      }
    },
    "Contract App",
    applicationPrimitiveSurface,
    "botster.plugin-contract-matrix/contract.app"
  );
  const applicationPrimitiveMarkup = renderPluginSurfaceRoutePage({
    ...applicationPrimitiveState,
    title: "Contract App"
  });
  assert.equal(applicationPrimitiveState.snapshot.root.type, "panel");
  assert.equal(applicationPrimitiveState.snapshot.root.children[0].type, "toolbar");
  assert.equal(applicationPrimitiveState.snapshot.root.children[0].slots.actions[0].type, "button");
  assert.equal(applicationPrimitiveState.snapshot.root.children[0].slots.actions[0].props.action.params, undefined);
  assert.deepEqual(applicationPrimitiveState.snapshot.root.children[0].slots.actions[0].props.action.payload, {
    workspace_id: "workspace-toolbar"
  });
  const translatedTable = applicationPrimitiveState.snapshot.root.children[2].children[1];
  assert.equal(translatedTable.props.rows[0].action.params, undefined);
  assert.deepEqual(translatedTable.props.rows[0].action.payload, {
    workspace_id: "workspace-alpha"
  });
  assert.equal(translatedTable.props.empty_state.props.primary_action.params, undefined);
  assert.deepEqual(translatedTable.props.empty_state.props.primary_action.payload, {
    workspace_id: "workspace-table-empty"
  });
  const translatedEmptyState = applicationPrimitiveState.snapshot.root.children[2].children[2];
  assert.deepEqual(translatedEmptyState.props.primary_action.payload, {
    workspace_id: "workspace-empty"
  });
  assert.match(applicationPrimitiveMarkup, /<ion-card/);
  assert.match(applicationPrimitiveMarkup, /<ion-toolbar/);
  assert.match(applicationPrimitiveMarkup, /<ion-grid/);
  assert.match(applicationPrimitiveMarkup, /<ion-row/);
  assert.match(applicationPrimitiveMarkup, /<ion-col/);
  assert.match(applicationPrimitiveMarkup, /class="uinode-metric/);
  assert.match(applicationPrimitiveMarkup, /Render path/);
  assert.match(applicationPrimitiveMarkup, /validated/);
  assert.match(applicationPrimitiveMarkup, /plugin_surface_render/);
  assert.match(applicationPrimitiveMarkup, /data-ui-node-id="contract-app-status"/);
  assert.match(applicationPrimitiveMarkup, /Validated/);
  assert.match(applicationPrimitiveMarkup, /role="table"/);
  assert.match(applicationPrimitiveMarkup, /Primitive/);
  assert.match(applicationPrimitiveMarkup, /toolbar/);
  assert.match(applicationPrimitiveMarkup, /supported/);
  assert.match(applicationPrimitiveMarkup, /No pending contracts/);
  assert.match(applicationPrimitiveMarkup, /data-action-id="contract\.action"/);
  assert.doesNotMatch(applicationPrimitiveMarkup, /Unsupported primitive/);
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "production-app",
            body: { text: "Workspaces rendered from JSON body" }
          }
        }
      },
      "botster-web",
      expectedProductionSurface,
      "botster-web/production-app"
    ),
    {
      routeKey: "botster-web/production-app",
      title: "botster-web",
      phase: "error",
      status: "botster-web requires a hub validated UiTree snapshot for botster-web/production-app; this hub returned only an unvalidated plugin surface body."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "production-app",
            body: {}
          }
        }
      },
      "botster-web",
      expectedProductionSurface,
      "botster-web/production-app"
    ),
    {
      routeKey: "botster-web/production-app",
      title: "botster-web",
      phase: "error",
      status: "botster-web requires a hub validated UiTree snapshot for botster-web/production-app; this hub returned only an unvalidated plugin surface body."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      { accepted: true, result: { kind: "plugin_surface" } },
      "botster-web",
      expectedProductionSurface,
      "botster-web/production-app"
    ),
    {
      routeKey: "botster-web/production-app",
      title: "botster-web",
      phase: "error",
      status: "Render response did not include botster-web/production-app validated snapshot."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "other-package",
            surface_id: "other-surface",
            body: "Other rendered"
          }
        }
      },
      "botster-web",
      expectedProductionSurface,
      "botster-web/production-app"
    ),
    {
      routeKey: "botster-web/production-app",
      title: "botster-web",
      phase: "error",
      status: "Render response did not include botster-web/production-app validated snapshot."
    }
  );
  const structuredErrorSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web",
    phase: "error",
    status: "Surface render blocked by package policy."
  });
  assert.match(structuredErrorSurfaceMarkup, />Error<\/ion-badge>/);
  assert.match(structuredErrorSurfaceMarkup, /Surface render blocked by package policy/);
  assert.doesNotMatch(structuredErrorSurfaceMarkup, />Loading<\/ion-badge>/);
  const pendingSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web",
    phase: "rendering",
    status: "Rendering botster-web"
  });
  assert.match(pendingSurfaceMarkup, />Loading<\/ion-badge>/);

  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedMissingUrlApp, onOpen: () => undefined })),
    /Web app has no hub-provided local URL/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedBlockedApp, onOpen: () => undefined })),
    /capability blocked/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedTerminalApp, onOpen: () => undefined })),
    /Requires local terminal launch/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedTerminalApp, onOpen: () => undefined })),
    /Terminal/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: optionalDaemonAppRecord, onOpen: () => undefined })),
    /Web app has no hub-provided local URL/
  );

  const descriptorApp = {
    id: "descriptor-only",
    title: "Descriptor Only",
    version: "1.0.0",
    capability_summary: "PackageSurfaces:render",
    package_actions: [descriptorPackageAction],
    app_surfaces: [
      {
        surface_id: "production-app",
        title: "Descriptor App",
        description: "Descriptor-backed app surface",
        launch_action: {
          id: "botster.package.surface.render",
          target: "descriptor-only",
          label: "Descriptor App",
          params: {
            package_name: "descriptor-only",
            surface_id: "production-app",
            surface_kind: "app",
            supports: ["render"]
          }
        }
      }
    ],
    settings_surfaces: [
      {
        surface_id: "production-settings",
        title: "Descriptor Settings",
        description: "Descriptor-backed settings surface",
        launch_action: {
          id: "botster.package.surface.render",
          target: "descriptor-only",
          label: "Descriptor Settings",
          params: {
            package_name: "descriptor-only",
            surface_id: "production-settings",
            surface_kind: "settings",
            supports: ["render"]
          }
        }
      }
    ]
  };
  const legacyOnlyApp = {
    id: "legacy-only",
    title: "Legacy Only",
    version: "0.9.0",
    capability_summary: "PackageSurfaces:legacy",
    view_surface: { id: "legacy-view", title: "Legacy View" },
    settings_surface: { id: "legacy-settings", title: "Legacy Settings" }
  };
  const openedSettings = [];
  const descriptorListMarkup = renderToStaticMarkup(
    createElement(PluginListItem, {
      app: descriptorApp,
      onOpen: () => undefined,
      onSettings: (appRecord) => openedSettings.push(appRecord)
    })
  );
  assert.match(descriptorListMarkup, /Descriptor Only/);
  assert.match(descriptorListMarkup, /App/);
  assert.doesNotMatch(descriptorListMarkup, /Descriptor App|Disable Package|surface-action-row/);
  assert.equal(packageAppSurfaces(descriptorApp).length, 1);
  assert.equal(packageSettingsSurfaces(descriptorApp).length, 1);
  assert.equal(surfaceLaunchAction(packageAppSurfaces(descriptorApp)[0]).id, "botster.package.surface.render");

  const descriptorListTree = PluginListItem({
    app: descriptorApp,
    onOpen: () => undefined,
    onSettings: (appRecord) => openedSettings.push(appRecord)
  });
  const descriptorSettingsButton = findReactElement(
    descriptorListTree,
    (element) => element.props?.["aria-label"] === "Settings for Descriptor Only" && typeof element.props?.onClick === "function"
  );
  assert.ok(descriptorSettingsButton);
  descriptorSettingsButton.props.onClick({ stopPropagation() {} });
  assert.deepEqual(openedSettings.map((appRecord) => appRecord.id), ["descriptor-only"]);

  const descriptorSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: descriptorApp,
      onAction: () => undefined
    })
  );
  assert.match(descriptorSettingsMarkup, /Descriptor Settings/);
  assert.match(descriptorSettingsMarkup, /Descriptor-backed settings surface/);
  assert.match(descriptorSettingsMarkup, /Disable Package/);
  const configurableDescriptorApp = {
    ...descriptorApp,
    configuration_fields: [
      {
        id: "endpoint",
        label: "Endpoint",
        kind: "text_input",
        config_type: "url",
        value: "",
        required: true,
        helper: "Webhook receiver URL",
        errors: ["Required configuration is missing."]
      },
      {
        id: "mode",
        label: "Mode",
        kind: "select",
        config_type: "select",
        value: "read",
        options: [
          { value: "read", label: "Read" },
          { value: "write", label: "Write" }
        ],
        errors: []
      },
      {
        id: "enabled",
        label: "Enabled",
        kind: "checkbox",
        config_type: "boolean",
        value: true,
        errors: []
      },
      {
        id: "api_token",
        label: "API token",
        kind: "secret",
        config_type: "secret",
        value: "",
        secret_state: "redacted",
        placeholder: "Saved credential",
        helper: "Leave blank to keep the existing secret.",
        errors: []
      }
    ],
    configuration_submit: {
      id: "botster.package.configuration.save",
      target: "descriptor-only",
      label: "Save configuration",
      params: {
        package_name: "descriptor-only",
        daemon_request: {
          request_type: "set_package_configuration",
          package_name: "descriptor-only"
        }
      }
    }
  };
  const configurationSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: configurableDescriptorApp,
      onAction: () => undefined
    })
  );
  assert.match(configurationSettingsMarkup, /Package configuration/);
  assert.match(configurationSettingsMarkup, /ion-input/);
  assert.match(configurationSettingsMarkup, /ion-select/);
  assert.match(configurationSettingsMarkup, /ion-checkbox/);
  assert.match(configurationSettingsMarkup, /Required configuration is missing/);
  assert.match(configurationSettingsMarkup, /Secret saved/);
  assert.match(configurationSettingsMarkup, /Save configuration/);
  assert.equal(configurationFieldType({ kind: "checkbox", config_type: "boolean" }), "boolean");
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: "replacement-token"
    }),
    {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      mode: { type: "select", value: "write" },
      enabled: { type: "boolean", value: false },
      api_token: { type: "secret", state: "write_only" }
    }
  );
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: ""
    }),
    {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      mode: { type: "select", value: "write" },
      enabled: { type: "boolean", value: false }
    }
  );
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "",
      mode: "read",
      enabled: true,
      api_token: ""
    }),
    {
      endpoint: { type: "url", value: "" },
      mode: { type: "select", value: "read" },
      enabled: { type: "boolean", value: true }
    }
  );
  assert.deepEqual(
    configurationSaveAction(configurableDescriptorApp.configuration_submit, configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: ""
    }),
    {
      ...configurableDescriptorApp.configuration_submit,
      params: {
        ...configurableDescriptorApp.configuration_submit.params,
        values: {
          endpoint: { type: "url", value: "https://example.invalid/hook" },
          mode: { type: "select", value: "write" },
          enabled: { type: "boolean", value: false }
        }
      }
    }
  );
  const remoteAccessSettingsApp = {
    id: "botster-web",
    title: "botster-web",
    configuration_fields: [
      {
        id: "remote_browser_rendezvous_enabled",
        label: "Remote browser access",
        kind: "checkbox",
        config_type: "boolean",
        value: false,
        helper: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
        errors: ["Remote access configuration failed"]
      }
    ],
    configuration_submit: {
      id: "botster.package.configuration.save",
      target: "botster-web",
      label: "Configure",
      disabled: false,
      params: {
        package_name: "botster-web",
        daemon_request: { request_type: "set_package_configuration", package_name: "botster-web" }
      }
    },
    settings_surfaces: [],
    package_actions: []
  };
  const remoteAccessSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: remoteAccessSettingsApp,
      onAction: () => undefined
    })
  );
  const enabledRemoteAccessSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: {
        ...remoteAccessSettingsApp,
        configuration_fields: remoteAccessSettingsApp.configuration_fields.map((field) => ({
          ...field,
          value: true,
          errors: []
        }))
      },
      onAction: () => undefined
    })
  );
  assert.match(enabledRemoteAccessSettingsMarkup, /Remote browser rendezvous is opted in/);
  assert.match(enabledRemoteAccessSettingsMarkup, />Opt out</);
  assert.equal((remoteAccessSettingsMarkup.match(/Remote browser access/g) ?? []).length, 1);
  assert.match(remoteAccessSettingsMarkup, /Remote browser rendezvous is off/);
  assert.match(remoteAccessSettingsMarkup, /Remote access configuration failed/);
  assert.doesNotMatch(remoteAccessSettingsMarkup, /Remote browser access[\\s\\S]*boolean[\\s\\S]*Remote browser access/);
  const optionalSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: optionalDaemonPackageRecord,
      onAction: () => undefined
    })
  );
  assert.doesNotMatch(optionalSettingsMarkup, /No settings surface registered/);
  assert.doesNotMatch(optionalSettingsMarkup, /Package configuration|undefined|null/);

  const legacyListMarkup = renderToStaticMarkup(
    createElement(PluginListItem, {
      app: legacyOnlyApp,
      onOpen: () => undefined,
      onSettings: (appRecord) => openedSettings.push(appRecord)
    })
  );
  assert.match(legacyListMarkup, /Legacy Only/);
  assert.match(legacyListMarkup, /Extension/);
  assert.doesNotMatch(legacyListMarkup, /Legacy View|Legacy Settings|surface-action-row/);
  assert.equal(packageAppSurfaces(legacyOnlyApp).length, 0);
  assert.equal(packageSettingsSurfaces(legacyOnlyApp).length, 0);
  assert.deepEqual(
    [
      {
        id: "plugin-z",
        package_name: "plugin-z",
        title: "Zulu Plugin",
        app_surfaces: [],
      },
      {
        id: "app-b",
        package_name: "app-b",
        title: "Beta App",
        app_surfaces: [{ surface_id: "home" }],
      },
      {
        id: "plugin-a",
        package_name: "plugin-a",
        title: "Alpha Plugin",
        app_surfaces: [],
      },
      {
        id: "app-a",
        package_name: "app-a",
        title: "Alpha App",
        app_surfaces: [{ surface_id: "home" }],
      }
    ].sort(compareInstalledPackageRows).map((row) => row.package_name),
    ["app-a", "app-b", "plugin-a", "plugin-z"]
  );
  assert.deepEqual(
    [
      { id: "disabled-target", label: "Zulu target", enabled: false },
      { id: "enabled-target-b", label: "Beta target", enabled: true },
      { id: "enabled-target-a", label: "Alpha target", enabled: true }
    ].sort(compareSpawnTargetRows).map((row) => row.id),
    ["enabled-target-a", "enabled-target-b", "disabled-target"]
  );
  const spawnTargetMarkup = renderToStaticMarkup(
    createElement(SpawnTargetListItem, {
      target: {
        id: "project-main",
        target_id: "project-main",
        label: "Project main",
        root: "/tmp/project-main",
        enabled: true,
        kind: "directory"
      },
      onSpawn: () => undefined,
      onDelete: () => undefined
    })
  );
  assert.match(spawnTargetMarkup, /Project main/);
  assert.match(spawnTargetMarkup, /\/tmp\/project-main/);
  assert.match(spawnTargetMarkup, /Enabled/);
  assert.match(spawnTargetMarkup, /New session/);
  assert.match(spawnTargetMarkup, /Edit/);
  assert.match(spawnTargetMarkup, /Delete/);
  // Rendered proof: Hub descriptors verbatim, provenance, override chain, diagnostics,
  // unknown namespaced role/trait rendered literally, and editability gating controls.
  let editedSessionTypeId;
  const deviceAgentMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: { ...authoritativeSessionTypeItems[0], id: "device/codex" },
      onEdit: (sessionType) => { editedSessionTypeId = sessionType.id; },
      onDelete: () => undefined
    })
  );
  assert.match(deviceAgentMarkup, /Codex agent/);
  assert.match(deviceAgentMarkup, /botster\.agent · interactive · task/);
  assert.match(deviceAgentMarkup, /device · device · project-main/);
  assert.match(deviceAgentMarkup, /Available/);
  assert.match(deviceAgentMarkup, /Delete/);
  // Editable rows expose Edit; the withheld placeholder is gone.
  assert.match(deviceAgentMarkup, /data-testid="edit-session-type-device\/codex"/);
  assert.doesNotMatch(deviceAgentMarkup, /Editing not available yet/);
  assert.doesNotMatch(deviceAgentMarkup, /Read-only/);
  // The id is never humanised into a display name.
  assert.doesNotMatch(deviceAgentMarkup, /Device:codex|Codex<\/h2>/);

  const interactiveDeviceItem = SessionTypeListItem({
    sessionType: { ...authoritativeSessionTypeItems[0], id: "device/codex" },
    onEdit: (sessionType) => { editedSessionTypeId = sessionType.id; },
    onDelete: () => undefined
  });
  const editButton = findReactElement(
    interactiveDeviceItem,
    (node) => node.props?.["data-testid"] === "edit-session-type-device/codex"
  );
  assert.ok(editButton);
  editButton.props.onClick();
  assert.equal(editedSessionTypeId, "device/codex");

  const interactiveAccessoryMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: { ...authoritativeSessionTypeItems[1], id: "device/companion" },
      onEdit: () => undefined,
      onDelete: () => undefined
    })
  );
  assert.match(interactiveAccessoryMarkup, /botster\.accessory · interactive · persistent/);
  assert.match(interactiveAccessoryMarkup, /terminal, companion/);

  // A service accessory must not present as an agent.
  const serviceAccessoryMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: { ...authoritativeSessionTypeItems[2], id: "device/watcher" },
      onEdit: () => undefined,
      onDelete: () => undefined
    })
  );
  assert.match(serviceAccessoryMarkup, /botster\.accessory · service · persistent/);
  assert.match(serviceAccessoryMarkup, /Unavailable/);
  assert.doesNotMatch(serviceAccessoryMarkup, /botster\.agent/);

  // Package rows are read-only solely because Hub says editable === false.
  const packageRowMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: { ...authoritativeSessionTypeItems[3], id: "botster/reviewer" },
      onEdit: () => undefined,
      onDelete: () => undefined
    })
  );
  assert.match(packageRowMarkup, /Read-only/);
  assert.doesNotMatch(packageRowMarkup, />Delete</);
  // A read-only row is not offered Edit.
  assert.doesNotMatch(packageRowMarkup, /data-testid="edit-session-type-/);
  assert.doesNotMatch(packageRowMarkup, /Editing not available yet/);

  const overrideRowMarkup = renderToStaticMarkup(
    createElement(SessionTypeListItem, {
      sessionType: { ...authoritativeSessionTypeItems[4], id: "project-main/repo-codex" },
      onEdit: () => undefined,
      onDelete: () => undefined
    })
  );
  assert.match(overrideRowMarkup, /Overrides device:device, package:botster/);
  assert.match(overrideRowMarkup, /repo definition overrides device and package definitions/);
  // Unknown namespaced role and trait render as their literal tokens.
  assert.match(overrideRowMarkup, /acme\.custom_role · interactive · task/);
  assert.match(overrideRowMarkup, /acme\.custom_trait/);

  const spawnTargetFrames = daemonResponseFrames({
    kind: "spawn_targets",
    status: null,
    sessions: [],
    packages: [],
    package_decision: null,
    lifecycle: [],
    plugin_tools: [],
    plugin_tool_result: null,
    events: [],
    cleanup: null,
    coordination: null,
    error: null,
    spawn_targets: [
      {
        target_id: "project-main",
        label: "Project main",
        root: "/tmp/project-main",
        enabled: true,
        kind: "directory",
        metadata: { owner: "platform" }
      }
    ]
  }, 42);
  const spawnTargetSnapshot = spawnTargetFrames.find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.spawn_target");
  assert.equal(spawnTargetSnapshot.payload.records[0].id, "project-main");
  assert.equal(spawnTargetSnapshot.payload.records[0].metadata_summary, "owner: platform");
  // The response-kind projection is gone: a session_types daemon response no longer
  // produces any entity frame. Session types arrive only by held subscription.
  const sessionTypeResponseFrames = daemonResponseFrames({
    kind: "session_types",
    status: null,
    sessions: [],
    packages: [],
    package_decision: null,
    lifecycle: [],
    plugin_tools: [],
    plugin_tool_result: null,
    events: [],
    cleanup: null,
    coordination: null,
    error: null,
    session_types: [authoritativeSessionTypeItems[0]]
  }, 43);
  assert.equal(
    sessionTypeResponseFrames.some((frame) => frame.kind === "entity_snapshot"),
    false
  );

  // The held subscription projects Hub descriptors verbatim under the canonical family.
  const sessionTypeSnapshotFrame = daemonEntityFrame({
    type: "entity_snapshot",
    subscription_id: "unit-session-type-1",
    entity_type: "session_type",
    snapshot_seq: 7,
    items: authoritativeSessionTypeItems
  });
  assert.equal(sessionTypeSnapshotFrame.kind, "entity_snapshot");
  assert.equal(sessionTypeSnapshotFrame.payload.family, "session_type");
  assert.equal(sessionTypeSnapshotFrame.payload.sequence, 7);
  const projectedRepoCodex = sessionTypeSnapshotFrame.payload.records.find(
    (record) => record.id === "project-main/repo-codex"
  );
  assert.equal(projectedRepoCodex.label, "Repo Codex");
  assert.equal(projectedRepoCodex.role, "acme.custom_role");
  assert.deepEqual(projectedRepoCodex.traits, ["acme.custom_trait"]);
  assert.deepEqual(projectedRepoCodex.overridden_sources, [
    { kind: "device", name: "device" },
    { kind: "package", name: "botster" }
  ]);
  assert.deepEqual(projectedRepoCodex.diagnostics, [
    "repo definition overrides device and package definitions"
  ]);
  assert.equal(projectedRepoCodex.title, undefined);

  const sessionTypeUpsertFrame = daemonEntityFrame({
    type: "entity_upsert",
    subscription_id: "unit-session-type-1",
    entity_type: "session_type",
    snapshot_seq: 8,
    id: "device/codex",
    entity: authoritativeSessionTypeItems[0]
  });
  assert.equal(sessionTypeUpsertFrame.kind, "entity_upsert");
  assert.equal(sessionTypeUpsertFrame.payload.key.family, "session_type");
  assert.equal(sessionTypeUpsertFrame.payload.record.label, "Codex agent");

  const sessionTypeRemoveFrame = daemonEntityFrame({
    type: "entity_remove",
    subscription_id: "unit-session-type-1",
    entity_type: "session_type",
    snapshot_seq: 9,
    id: "device/codex"
  });
  assert.equal(sessionTypeRemoveFrame.kind, "entity_remove");
  assert.equal(sessionTypeRemoveFrame.payload.key.family, "session_type");

  const sessionTypeErrorFrame = daemonEntityFrame({
    type: "entity_error",
    subscription_id: "unit-session-type-1",
    entity_type: "session_type",
    code: "entity_provider_frame_too_large",
    message: "session_type snapshot exceeded the frame budget"
  });
  assert.equal(sessionTypeErrorFrame.kind, "entity_error");
  assert.deepEqual(sessionTypeErrorFrame.payload, {
    family: "session_type",
    code: "entity_provider_frame_too_large",
    message: "session_type snapshot exceeded the frame budget"
  });

  const collectedActions = [];
  const markup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      uiNodeConformanceSnapshot,
      createInMemoryEntityFrameStore(fixtureEntityFrames),
      {
        capabilities: {
          ionic_shell: true,
          ui_tree_snapshot: true,
          entity_frame_store: true,
          semantic_actions: true,
          terminal_view_bridge: true,
          plugin_surface_sandbox: true,
          isolated_plugin_asset: false
        },
        collectAction(dispatch) {
          collectedActions.push(dispatch);
        }
      }
    )
  );

  assert.equal(ionicUiNodeRendererRegistry.supports("stack"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("panel"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("toolbar"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("metric_grid"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("metric"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("status_badge"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("timeline"), false);
  assert.match(markup, /Universal primitives/);
  assert.match(markup, /Renderer registry/);
  assert.match(markup, /Capability fallback/);
  assert.match(markup, /data-ui-node-id="sess-alpha"/);
  assert.match(markup, /data-ui-node-id="sess-beta"/);
  assert.doesNotMatch(markup, /data-ui-node-id="sess-historic"/);
  assert.match(markup, /data-action-id="botster\.session\.select"/);
  assert.equal(collectedActions.some(({ action }) => action.id === "botster.session.select"), true);
  assert.deepEqual(
    collectedActions
      .filter(({ action }) => action.id === "contract.action")
      .map(({ action, node }) => ({ nodeId: node.id, payload: action.payload })),
    [
      {
        nodeId: realizeBindListDescendantId("sess-alpha", "select"),
        payload: { operation: "select_session", session_uuid: "sess-alpha" }
      },
      {
        nodeId: realizeBindListDescendantId("sess-beta", "select"),
        payload: { operation: "select_session", session_uuid: "sess-beta" }
      }
    ]
  );
  const boundRowDispatch = collectedActions.find(({ action, node }) =>
    action.id === "contract.action" && node.id === realizeBindListDescendantId("sess-alpha", "select")
  );
  assert.deepEqual(
    pluginSurfaceActionRequest("contract.sessions", boundRowDispatch),
    {
      surface_id: "contract.sessions",
      action_id: "contract.action",
      node_id: realizeBindListDescendantId("sess-alpha", "select"),
      kind: "submit",
      payload: { operation: "select_session", session_uuid: "sess-alpha" }
    }
  );
  assert.equal(fixtureProvenance.source, "@trybotster/ui-contract/conformance-fixtures");
  assert.equal(fixtureProvenance.contractVersion, hubTestSupportMetadata.ui_contract.package_version);
  const renderBoundRowIdentity = (records) => {
    const actions = [];
    const markup = renderToStaticMarkup(
      ionicUiNodeRendererRegistry.render(
        {
          kind: "ui_tree_snapshot",
          surface: "bound-row-identity-negative",
          version: "test",
          root: uiContractConformanceFixtures.fixtures.bound_row_identity
        },
        createInMemoryEntityFrameStore([
          { operation: "entity_snapshot", family: "session", records }
        ]),
        { collectAction: (dispatch) => actions.push(dispatch) }
      )
    );
    return { actions, markup };
  };
  for (const invalidRecords of [
    [{ id: "missing", lifecycle_class: "current" }],
    [{ id: "blank", session_uuid: " ", lifecycle_class: "current" }]
  ]) {
    const { actions, markup: invalidIdentityMarkup } = renderBoundRowIdentity([
      ...invalidRecords,
      { id: "valid", session_uuid: "sess-valid", lifecycle_class: "current" }
    ]);
    assert.match(invalidIdentityMarkup, /data-ui-node-id="sess-valid"/);
    assert.doesNotMatch(invalidIdentityMarkup, /data-ui-node-id=" "/);
    assert.deepEqual(actions.map(({ node }) => node.id), [realizeBindListDescendantId("sess-valid", "select")]);
  }
  const duplicateRowIdentity = renderBoundRowIdentity([
    { id: "duplicate-a", session_uuid: "sess-duplicate", lifecycle_class: "current" },
    { id: "duplicate-b", session_uuid: "sess-duplicate", lifecycle_class: "current" },
    { id: "valid", session_uuid: "sess-valid", lifecycle_class: "current" }
  ]);
  assert.match(duplicateRowIdentity.markup, /data-ui-identity-diagnostic="duplicate-realized-identity"/);
  assert.match(duplicateRowIdentity.markup, /sess-duplicate/);
  assert.doesNotMatch(duplicateRowIdentity.markup, /data-ui-node-id="sess-valid"/);
  assert.deepEqual(duplicateRowIdentity.actions, []);

  const renderIdentityCase = (root, records = []) => {
    const actions = [];
    const markup = renderToStaticMarkup(
      ionicUiNodeRendererRegistry.render(
        { kind: "ui_tree_snapshot", surface: "identity-validation.test", version: "test", root },
        createInMemoryEntityFrameStore([
          { operation: "entity_snapshot", family: "identity.row", records }
        ]),
        { collectAction: (dispatch) => actions.push(dispatch) }
      )
    );
    return { actions, markup };
  };
  const boundIdentityTemplate = (children) => ({
    id: "identity-root",
    type: "stack",
    children: [{
      $kind: "bind_list",
      source: "/identity.row",
      item_template: { id: { $bind: "@/row_identity" }, type: "inline", children }
    }]
  });

  for (const vector of uiContractConformanceFixtures.bind_list_descendant_identity_vectors) {
    const vectorProof = renderIdentityCase(
      boundIdentityTemplate([{
        id: { $kind: "bind_list_descendant_id", key: vector.key },
        type: "button",
        props: {
          label: "Dispatch vector",
          action: { id: "contract.vector", payload: { row: vector.row, key: vector.key } }
        }
      }]),
      [{ id: `vector-${vector.realized_id}`, row_identity: vector.row }]
    );
    assert.equal(vectorProof.markup.includes(`data-ui-node-id="${vector.realized_id}"`), true);
    assert.deepEqual(
      vectorProof.actions.map(({ action, node }) => ({ node_id: node.id, payload: action.payload })),
      [{ node_id: vector.realized_id, payload: { row: vector.row, key: vector.key } }]
    );
  }

  const duplicateKeyProof = renderIdentityCase(
    boundIdentityTemplate([
      {
        $kind: "when",
        condition: { width: "regular" },
        node: { id: { $kind: "bind_list_descendant_id", key: "shared" }, type: "text", props: { text: "Visible" } }
      },
      {
        $kind: "hidden",
        condition: { width: "regular" },
        node: { id: { $kind: "bind_list_descendant_id", key: "shared" }, type: "text", props: { text: "Hidden" } }
      }
    ]),
    [{ id: "duplicate-key", row_identity: "row-duplicate-key", secret: "must-not-leak" }]
  );
  assert.match(duplicateKeyProof.markup, /data-ui-identity-diagnostic="duplicate-descendant-key"/);
  assert.match(duplicateKeyProof.markup, /shared/);
  assert.doesNotMatch(duplicateKeyProof.markup, /must-not-leak/);
  assert.deepEqual(duplicateKeyProof.actions, []);

  for (const invalidDescendant of [
    { id: { $kind: "bind_list_descendant_id", key: " " }, type: "button", props: { label: "Blank", action: { id: "blank" } } },
    { id: { $bind: "@/row_identity" }, type: "button", props: { label: "Full id bind", action: { id: "full-bind" } } }
  ]) {
    const invalidDescendantProof = renderIdentityCase(
      boundIdentityTemplate([invalidDescendant]),
      [{ id: "invalid-descendant", row_identity: "row-invalid" }]
    );
    assert.match(invalidDescendantProof.markup, /data-ui-identity-diagnostic="invalid-descendant-identity"/);
    assert.deepEqual(invalidDescendantProof.actions, []);
  }
  const misplacedDescendantProof = renderIdentityCase({
    id: "misplaced-root",
    type: "stack",
    children: [{
      id: { $kind: "bind_list_descendant_id", key: "misplaced" },
      type: "button",
      props: { label: "Misplaced", action: { id: "misplaced" } }
    }]
  });
  assert.match(misplacedDescendantProof.markup, /data-ui-identity-diagnostic="invalid-descendant-identity"/);
  assert.deepEqual(misplacedDescendantProof.actions, []);

  for (const rootId of [{ $bind: "@/whatever" }, { nonsense: 1 }]) {
    const unresolvedRootProof = renderIdentityCase({ id: rootId, type: "stack", props: { direction: "vertical" } });
    assert.match(unresolvedRootProof.markup, /data-ui-identity-diagnostic="invalid-descendant-identity"/);
    assert.doesNotMatch(unresolvedRootProof.markup, /data-unsupported-identity=/);
    assert.deepEqual(unresolvedRootProof.actions, []);
  }

  const nestedEmptyDescendantProof = renderIdentityCase(
    boundIdentityTemplate([{
      $kind: "bind_list",
      source: "@/children",
      item_template: { id: { $bind: "@/id" }, type: "text", props: { text: "Nested item" } },
      empty_template: {
        id: { $kind: "bind_list_descendant_id", key: "nested-empty" },
        type: "text",
        props: { text: "Must not render" }
      }
    }]),
    [{ id: "nested-empty-row", row_identity: "row-nested-empty", children: [] }]
  );
  assert.match(nestedEmptyDescendantProof.markup, /data-ui-identity-diagnostic="invalid-descendant-identity"/);
  assert.deepEqual(nestedEmptyDescendantProof.actions, []);

  const separateEmptyNamespaceProof = renderIdentityCase(
    boundIdentityTemplate([
      { id: { $kind: "bind_list_descendant_id", key: "shared" }, type: "text", props: { text: "Outer descendant" } },
      {
        $kind: "bind_list",
        source: "@/children",
        item_template: { id: { $bind: "@/id" }, type: "text", props: { text: "Nested item" } },
        empty_template: { id: "shared", type: "text", props: { text: "Nested empty" } }
      }
    ]),
    [{ id: "separate-empty-row", row_identity: "row-separate-empty", children: [] }]
  );
  assert.match(separateEmptyNamespaceProof.markup, /Outer descendant/);
  assert.match(separateEmptyNamespaceProof.markup, /Nested empty/);
  assert.doesNotMatch(separateEmptyNamespaceProof.markup, /data-ui-identity-diagnostic=/);

  const listItemBoundIdentityProof = renderIdentityCase({
    id: "list-bound-id-root",
    type: "list",
    props: { items: [{ id: "item-a", label: "Alpha" }] },
    slots: {
      item: [{ id: { $bind: "@/id" }, type: "text", props: { text: { $bind: "@/label" } } }]
    }
  });
  assert.match(listItemBoundIdentityProof.markup, /data-ui-identity-diagnostic="invalid-descendant-identity"/);
  assert.deepEqual(listItemBoundIdentityProof.actions, []);

  const duplicateLiteralProof = renderIdentityCase({
    id: "literal-root",
    type: "stack",
    children: [
      { id: "repeated", type: "button", props: { label: "One", action: { id: "one" } } },
      { id: "repeated", type: "button", props: { label: "Two", action: { id: "two" } } }
    ]
  });
  assert.match(duplicateLiteralProof.markup, /data-ui-identity-diagnostic="duplicate-realized-identity"/);
  assert.deepEqual(duplicateLiteralProof.actions, []);

  const collisionNode = () => ({ id: "rendered-region-collision", type: "text", props: { text: "Collision" } });
  const renderedRegionCollisionCases = [
    ...["stack", "form_section", "inline", "metric_grid", "form"].map((type) => [
      `${type}.children`,
      { id: "rendered-region-collision", type, children: [collisionNode()] }
    ]),
    ...["section", "panel"].flatMap((type) => [
      ...["header", "toolbar", "body", "footer", "actions"].map((slot) => [
        `${type}.slots.${slot}`,
        { id: "rendered-region-collision", type, slots: { [slot]: [collisionNode()] } }
      ]),
      [`${type}.children`, { id: "rendered-region-collision", type, children: [collisionNode()] }],
      [`${type}.slots.empty`, { id: "rendered-region-collision", type, slots: { empty: [collisionNode()] } }]
    ]),
    ...["commands", "filters", "search", "actions"].map((slot) => [
      `toolbar.slots.${slot}`,
      { id: "rendered-region-collision", type: "toolbar", slots: { [slot]: [collisionNode()] } }
    ]),
    ["toolbar.children", { id: "rendered-region-collision", type: "toolbar", children: [collisionNode()] }],
    ["empty_state.slots.actions", {
      id: "rendered-region-collision",
      type: "empty_state",
      props: { title: "Empty" },
      slots: { actions: [collisionNode()] }
    }],
    ["list.slots.item", {
      id: "rendered-region-collision",
      type: "list",
      props: { items: [{ id: "item-a" }] },
      slots: { item: [collisionNode()] }
    }],
    ["list.children", {
      id: "rendered-region-collision",
      type: "list",
      props: { items: [] },
      children: [collisionNode()]
    }],
    ["list.slots.empty", {
      id: "rendered-region-collision",
      type: "list",
      props: { items: [] },
      slots: { empty: [collisionNode()] }
    }],
    ...["title", "subtitle", "meta", "actions"].map((slot) => [
      `list_item.slots.${slot}`,
      { id: "rendered-region-collision", type: "list_item", slots: { [slot]: [collisionNode()] } }
    ]),
    ["list_item.children", { id: "rendered-region-collision", type: "list_item", children: [collisionNode()] }],
    ["select.slots.options", {
      id: "rendered-region-collision",
      type: "select",
      slots: { options: [collisionNode()] }
    }],
    ["dialog.slots.body", {
      id: "rendered-region-collision",
      type: "dialog",
      slots: { body: [collisionNode()] }
    }],
    ["dialog.children", { id: "rendered-region-collision", type: "dialog", children: [collisionNode()] }],
    ["table.props.empty_state", {
      id: "rendered-region-collision",
      type: "table",
      props: { columns: [], rows: [], empty_state: collisionNode() }
    }]
  ];
  for (const [region, root] of renderedRegionCollisionCases) {
    const collisionProof = renderIdentityCase(root);
    assert.match(
      collisionProof.markup,
      /data-ui-identity-diagnostic="duplicate-realized-identity"/,
      `${region} must remain covered by fail-closed realized identity validation`
    );
    assert.deepEqual(collisionProof.actions, []);
  }

  const generatedCollisionId = realizeBindListDescendantId("row-collision", "control");
  const generatedStaticCollisionProof = renderIdentityCase({
    id: "generated-static-root",
    type: "stack",
    children: [
      { id: generatedCollisionId, type: "text", props: { text: "Static" } },
      {
        $kind: "bind_list",
        source: "/identity.row",
        item_template: {
          id: { $bind: "@/row_identity" },
          type: "inline",
          children: [{
            id: { $kind: "bind_list_descendant_id", key: "control" },
            type: "button",
            props: { label: "Generated", action: { id: "generated" } }
          }]
        }
      }
    ]
  }, [{ id: "collision", row_identity: "row-collision" }]);
  assert.match(generatedStaticCollisionProof.markup, /data-ui-identity-diagnostic="duplicate-realized-identity"/);
  assert.match(generatedStaticCollisionProof.markup, /botster-ui-descendant-v1/);
  assert.deepEqual(generatedStaticCollisionProof.actions, []);

  const mutuallyExclusiveProof = renderIdentityCase({
    id: "conditional-root",
    type: "stack",
    children: [
      {
        $kind: "when",
        condition: { width: "regular" },
        node: { id: "conditional-reuse", type: "text", props: { text: "Selected branch" } }
      },
      {
        $kind: "hidden",
        condition: { width: "regular" },
        node: { id: "conditional-reuse", type: "text", props: { text: "Suppressed branch" } }
      }
    ]
  });
  assert.doesNotMatch(mutuallyExclusiveProof.markup, /data-ui-identity-diagnostic/);
  assert.match(mutuallyExclusiveProof.markup, /Selected branch/);
  assert.doesNotMatch(mutuallyExclusiveProof.markup, /Suppressed branch/);
  assert.equal((mutuallyExclusiveProof.markup.match(/data-ui-node-id="conditional-reuse"/g) ?? []).length, 1);

  const surroundingCollisionProof = renderIdentityCase({
    id: "surrounding-root",
    type: "stack",
    children: [
      { id: "surrounding-reuse", type: "text", props: { text: "Always" } },
      {
        $kind: "when",
        condition: { width: "regular" },
        node: { id: "surrounding-reuse", type: "text", props: { text: "Selected" } }
      }
    ]
  });
  assert.match(surroundingCollisionProof.markup, /data-ui-identity-diagnostic="duplicate-realized-identity"/);
  assert.deepEqual(surroundingCollisionProof.actions, []);
  assert.equal(ionicUiNodeRendererRegistry.supports("iframe"), true);
  const missingCapabilityMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "fallback.capability",
        version: "test",
        root: {
          id: "capability-gated-node",
          type: "text",
          props: {
            text: "Must not render",
            requires: ["isolated_plugin_asset"]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {
        capabilities: {
          ionic_shell: true,
          ui_tree_snapshot: true,
          entity_frame_store: true,
          semantic_actions: true,
          terminal_view_bridge: true,
          plugin_surface_sandbox: true,
          isolated_plugin_asset: false
        }
      }
    )
  );
  assert.match(missingCapabilityMarkup, /data-missing-capability="isolated_plugin_asset"/);
  assert.match(missingCapabilityMarkup, /Unsupported capability: isolated_plugin_asset/);
  assert.doesNotMatch(missingCapabilityMarkup, /Must not render/);

  const unsupportedPrimitiveMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "fallback.primitive",
        version: "test",
        root: {
          id: "unsupported-timeline",
          type: "timeline"
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(unsupportedPrimitiveMarkup, /data-unsupported-primitive="timeline"/);
  assert.match(unsupportedPrimitiveMarkup, /Unsupported primitive: timeline/);

  const presentedFixtureMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      uiNodeConformanceSnapshot,
      createInMemoryEntityFrameStore(fixtureEntityFrames),
      {
        presentation: {
          "create-ticket-dialog": true,
          "selected-workspace": "workspace-alpha"
        }
      }
    )
  );
  assert.match(presentedFixtureMarkup, /data-ui-node-id="create-ticket-dialog"/);
  assert.match(presentedFixtureMarkup, /Create ticket/);
  assert.match(presentedFixtureMarkup, /Selected workspace/);

  const contractRequest = uiContractConformanceFixtures.fixtures.request;
  const acceptedContractResult = uiContractConformanceFixtures.fixtures.accepted;
  const rejectedContractResult = uiContractConformanceFixtures.fixtures.rejected;
  const rejectedFormMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: rejectedContractResult.surface_id,
        version: "test",
        root: uiContractConformanceFixtures.fixtures.form
      },
      createInMemoryEntityFrameStore(),
      { actionResult: rejectedContractResult }
    )
  );
  assert.match(
    rejectedFormMarkup,
    /<ion-item[^>]*data-ui-node-id="ticket-title"[^>]*>[\s\S]*?class="uinode-field-error"[\s\S]*?Title is required[\s\S]*?<\/ion-item>/
  );
  assert.match(
    rejectedFormMarkup,
    /class="uinode-form-error"[\s\S]*?Fix the highlighted fields/
  );

  const presentationScope = {
    hubId: "hub-alpha",
    packageName: "botster.plugin-contract-matrix",
    surfaceId: contractRequest.surface_id
  };
  const isolatedPresentationScope = {
    ...presentationScope,
    surfaceId: "tickets.other"
  };
  assert.equal(acceptedResultMatches(contractRequest, acceptedContractResult), true);
  assert.equal(acceptedResultMatches(contractRequest, { ...acceptedContractResult, request_id: "mismatch" }), false);
  const presentedState = applyAcceptedPresentation({}, presentationScope, contractRequest, acceptedContractResult);
  assert.deepEqual(presentationValues(presentedState, presentationScope), {
    notice: "created",
    details: true
  });
  assert.deepEqual(presentationValues(presentedState, isolatedPresentationScope), {});
  assert.equal(
    applyAcceptedPresentation(presentedState, presentationScope, contractRequest, rejectedContractResult),
    presentedState
  );
  const dialogSetState = applyAcceptedPresentation({}, presentationScope, contractRequest, {
    ...acceptedContractResult,
    presentation: [
      { kind: "set", key: "create-ticket-dialog", value: true },
      { kind: "set", key: "details", value: true }
    ]
  });
  const toggleOffState = applyAcceptedPresentation(dialogSetState, presentationScope, contractRequest, {
    ...acceptedContractResult,
    presentation: [{ kind: "toggle", key: "details" }]
  });
  assert.equal(presentationValues(toggleOffState, presentationScope).details, false);
  const toggleOnState = applyAcceptedPresentation(toggleOffState, presentationScope, contractRequest, {
    ...acceptedContractResult,
    presentation: [{ kind: "toggle", key: "details" }]
  });
  assert.equal(presentationValues(toggleOnState, presentationScope).details, true);
  const dialogClearedState = applyAcceptedPresentation(toggleOnState, presentationScope, contractRequest, {
    ...acceptedContractResult,
    presentation: [{ kind: "clear", key: "create-ticket-dialog" }]
  });
  assert.equal(Object.hasOwn(presentationValues(dialogClearedState, presentationScope), "create-ticket-dialog"), false);
  const dialogSetMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      uiNodeConformanceSnapshot,
      createInMemoryEntityFrameStore(fixtureEntityFrames),
      { presentation: presentationValues(dialogSetState, presentationScope) }
    )
  );
  const dialogClearedMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      uiNodeConformanceSnapshot,
      createInMemoryEntityFrameStore(fixtureEntityFrames),
      { presentation: presentationValues(dialogClearedState, presentationScope) }
    )
  );
  assert.match(dialogSetMarkup, /data-ui-node-id="create-ticket-dialog"/);
  assert.doesNotMatch(dialogClearedMarkup, /data-ui-node-id="create-ticket-dialog"/);

  const replacementRoot = {
    id: "replacement-root",
    type: "stack",
    children: [
      {
        id: "ticket-form",
        type: "form",
        props: {
          action: { id: "ticket.create" },
          submit_label: "Create ticket"
        }
      }
    ]
  };
  assert.equal(replaceAcceptedSurface(replacementRoot, acceptedContractResult).id, "ticket-created");
  assert.equal(replaceAcceptedSurface(replacementRoot, rejectedContractResult), replacementRoot);

  const bindListStore = createInMemoryEntityFrameStore([
    {
      operation: "entity_snapshot",
      family: "project-pipelines.ticket",
      records: [
        {
          id: "ticket-alpha",
          title: "Alpha ticket",
          comments: [{ id: "comment-alpha", body: "Nested alpha comment" }]
        },
        {
          id: "ticket-beta",
          title: "Beta ticket",
          comments: []
        }
      ]
    }
  ]);
  const bindListSnapshot = {
    kind: "ui_tree_snapshot",
    surface: "bind-list.test",
    version: "test",
    root: {
      id: "bind-list-root",
      type: "stack",
      children: [
        {
          $kind: "bind_list",
          source: "/project-pipelines.ticket",
          item_template: {
            id: { $bind: "@/id" },
            type: "section",
            children: [
              {
                id: { $kind: "bind_list_descendant_id", key: "title" },
                type: "text",
                props: { text: { $bind: "@/title" } }
              },
              {
                $kind: "bind_list",
                source: "@/comments",
                item_template: {
                  id: { $bind: "@/id" },
                  type: "text",
                  props: { text: { $bind: "@/body" } }
                },
                empty_template: {
                  id: "comment-empty",
                  type: "text",
                  props: { text: "No comments" }
                }
              }
            ]
          },
          empty_template: {
            id: "ticket-empty",
            type: "empty_state",
            props: { title: "No tickets" }
          }
        }
      ]
    }
  };
  const renderBindList = () => renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(bindListSnapshot, bindListStore, {})
  );
  assert.match(renderBindList(), /Alpha ticket/);
  assert.match(renderBindList(), /Nested alpha comment/);
  assert.match(renderBindList(), /Beta ticket/);
  assert.match(renderBindList(), /No comments/);
  bindListStore.apply({
    operation: "entity_upsert",
    key: { family: "project-pipelines.ticket", id: "ticket-gamma" },
    record: {
      id: "ticket-gamma",
      title: "Gamma ticket",
      comments: [{ id: "comment-gamma", body: "Nested gamma comment" }]
    }
  });
  assert.match(renderBindList(), /Gamma ticket/);
  bindListStore.apply({
    operation: "entity_patch",
    key: { family: "project-pipelines.ticket", id: "ticket-alpha" },
    record: { id: "ticket-alpha", title: "Alpha updated" }
  });
  assert.match(renderBindList(), /Alpha updated/);
  bindListStore.apply({
    operation: "entity_remove",
    key: { family: "project-pipelines.ticket", id: "ticket-beta" }
  });
  assert.doesNotMatch(renderBindList(), /Beta ticket/);
  bindListStore.apply({
    operation: "entity_snapshot",
    family: "project-pipelines.ticket",
    records: []
  });
  assert.match(renderBindList(), /No tickets/);

  const sessionBindingStore = createInMemoryEntityFrameStore();
  const sessionBindingSnapshot = {
    kind: "ui_tree_snapshot",
    surface: "contract.sessions",
    version: `hub-test-support-revision-${sessionPluginBindingFixture.conformance_fixture_revision}`,
    root: sessionPluginBindingFixture.surface
  };
  const renderSessionBindings = () => renderToStaticMarkup(
    createElement(UiNodeSurface, {
      snapshot: sessionBindingSnapshot,
      entities: sessionBindingStore
    })
  );
  const assertPublishedRowProof = (expectedRows) => {
    const actions = [];
    const markup = renderToStaticMarkup(
      ionicUiNodeRendererRegistry.render(sessionBindingSnapshot, sessionBindingStore, {
        collectAction: (dispatch) => actions.push(dispatch)
      })
    );
    assert.deepEqual(
      [...markup.matchAll(/data-ui-node-id="(session-[^"]+)"/g)].map((match) => match[1]),
      expectedRows.map((row) => row.node_id)
    );
    assert.deepEqual(
      actions.map(({ action, node }) => ({ node_id: node.id, action_payload: action.payload })),
      expectedRows.flatMap((row) => row.controls.map((control) => ({
        node_id: control.node_id,
        action_payload: control.action_payload
      })))
    );
    for (const row of expectedRows) {
      assert.match(markup, new RegExp(`data-ui-node-id="${row.node_id}"`));
      for (const control of row.controls) {
        assert.match(markup, new RegExp(`data-ui-node-id="${control.node_id}"`));
        assert.match(markup, new RegExp(`data-action-id="contract\\.action"[^>]*>${control.label}<`));
      }
    }
  };
  const renderedSessionBindingMap = () => Object.fromEntries(
    sessionPluginBindingFixture.surface.children
      .filter((child) => child.where?.session_uuid)
      .map((child) => {
        const markup = renderToStaticMarkup(
          createElement(UiNodeSurface, {
            snapshot: {
              ...sessionBindingSnapshot,
              root: {
                ...sessionPluginBindingFixture.surface,
                children: [child]
              }
            },
            entities: sessionBindingStore
          })
        );
        const lifecycleClass = markup.match(/>(current|ended|indeterminate)</)?.[1];
        return [
          child.where.session_uuid,
          lifecycleClass ?? (markup.includes("Session unavailable") ? "unavailable" : "unrecognized")
        ];
      })
  );
  const applyPublishedSessionFrame = (frame) => {
    const projected = daemonEntityFrame(frame);
    assert.ok(projected);
    sessionBindingStore.apply(projected.payload);
  };

  applyPublishedSessionFrame(sessionPluginBindingFixture.initial_snapshot);
  const initialSessionBindings = renderSessionBindings();
  assert.equal((initialSessionBindings.match(/>current</g) ?? []).length, 4);
  assert.equal((initialSessionBindings.match(/>ended</g) ?? []).length, 1);
  assert.equal((initialSessionBindings.match(/>indeterminate</g) ?? []).length, 1);
  assert.equal((initialSessionBindings.match(/Session unavailable/g) ?? []).length, 1);
  assert.doesNotMatch(initialSessionBindings, /data-unsupported-ui-node/);
  assert.deepEqual(renderedSessionBindingMap(), sessionPluginBindingFixture.expected.initial);
  assertPublishedRowProof(sessionPluginBindingFixture.row_expected.initial);

  const canonicalSessionRecord = sessionBindingStore.get("session", "session-transition");
  assert.deepEqual(
    Object.keys(canonicalSessionRecord).sort(),
    [...Object.keys(sessionPluginBindingFixture.initial_snapshot.items[0]), "id"].sort()
  );
  assert.equal(canonicalSessionRecord.session_uuid, "session-transition");
  assert.equal(canonicalSessionRecord.lifecycle, "running");
  assert.equal(canonicalSessionRecord.lifecycle_class, "current");
  for (const webOnlyField of [
    "title",
    "target",
    "last_result",
    "status",
    "attachable",
    "attach_status",
    "attach_action"
  ]) {
    assert.equal(webOnlyField in canonicalSessionRecord, false);
  }

  applyPublishedSessionFrame(sessionPluginBindingFixture.transition_frames[0]);
  assert.deepEqual(
    renderedSessionBindingMap(),
    sessionPluginBindingFixture.expected.after_ended_patch
  );
  assertPublishedRowProof(sessionPluginBindingFixture.row_expected.after_ended_patch);
  applyPublishedSessionFrame(sessionPluginBindingFixture.transition_frames[1]);
  assert.deepEqual(
    renderedSessionBindingMap(),
    sessionPluginBindingFixture.expected.after_indeterminate_patch
  );
  assertPublishedRowProof(sessionPluginBindingFixture.row_expected.after_indeterminate_patch);
  applyPublishedSessionFrame(sessionPluginBindingFixture.transition_frames[2]);
  assert.deepEqual(
    renderedSessionBindingMap(),
    sessionPluginBindingFixture.expected.after_remove
  );
  assertPublishedRowProof(sessionPluginBindingFixture.row_expected.after_remove);

  applyPublishedSessionFrame(sessionPluginBindingFixture.reconnect_snapshot);
  assert.deepEqual(
    renderedSessionBindingMap(),
    sessionPluginBindingFixture.expected.after_reconnect
  );
  assertPublishedRowProof(sessionPluginBindingFixture.row_expected.after_reconnect);
  assert.equal(sessionBindingStore.get("session", "session-transition"), undefined);
  assert.equal(
    Object.hasOwn(sessionBindingStore.get("session", "session-indeterminate"), "lifecycle"),
    false
  );
  assert.equal(
    sessionBindingStore.get("session", "session-indeterminate").lifecycle_class,
    "indeterminate"
  );

  const childVariantMarkup = renderToStaticMarkup(
    createElement(UiNodeSurface, {
      snapshot: sessionBindingVariantSnapshot,
      entities: sessionBindingStore
    })
  );
  assert.match(childVariantMarkup, /Conditional child/);
  assert.match(childVariantMarkup, />current</);
  assert.match(childVariantMarkup, /Nested bound child/);
  assert.doesNotMatch(childVariantMarkup, /data-unsupported-ui-node/);

  sessionBindingStore.apply({
    operation: "entity_patch",
    key: { family: "session", id: "session-stable-current" },
    record: { id: "session-stable-current", lifecycle: null }
  });
  const hiddenBoundChildrenMarkup = renderToStaticMarkup(
    createElement(UiNodeSurface, {
      snapshot: sessionBindingVariantSnapshot,
      entities: sessionBindingStore
    })
  );
  assert.match(hiddenBoundChildrenMarkup, /Conditional child/);
  assert.match(hiddenBoundChildrenMarkup, />current</);
  assert.doesNotMatch(hiddenBoundChildrenMarkup, /Nested bound child/);

  const toolbarMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "toolbar-order.test",
        version: "test",
        root: {
          id: "toolbar-order",
          type: "toolbar",
          slots: {
            actions: [
              { id: "toolbar-first", type: "button", props: { label: "First", overflow: "never", action: { id: "first" } } },
              { id: "toolbar-second", type: "button", props: { label: "Second", overflow: "auto", action: { id: "second" } } },
              { id: "toolbar-third", type: "button", props: { label: "Third", overflow: "always", action: { id: "third" } } }
            ]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.equal(toolbarMarkup.indexOf("First") < toolbarMarkup.indexOf("Second"), true);
  assert.equal(toolbarMarkup.indexOf("Second") < toolbarMarkup.indexOf("Third"), true);
  assert.match(toolbarMarkup, /data-overflow="never"/);
  assert.match(toolbarMarkup, /data-overflow="auto"/);
  assert.match(toolbarMarkup, /data-overflow="always"/);

  const schemaSelectMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "form-field.select-options",
        version: "test",
        root: {
          id: "spawn-form",
          type: "form",
          props: {
            action: { id: "spawn.submit" },
            submit_label: "Create"
          },
          slots: {
            children: [
              {
                id: "spawn-point-field",
                type: "form_field",
                props: {
                  schema: {
                    kind: "select",
                    name: "spawn_point_id",
                    label: "Spawn point",
                    options: [
                      { value: "target_codex_local", label: "Local Codex" },
                      { value: "target_cloud", label: "Cloud", disabled: true }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(schemaSelectMarkup, /ion-select/);
  assert.match(schemaSelectMarkup, /value="target_codex_local"/);
  assert.match(schemaSelectMarkup, /Local Codex/);
  assert.match(schemaSelectMarkup, /value="target_cloud"/);
  assert.match(schemaSelectMarkup, /Cloud/);

  const iframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.test",
        version: "test",
        root: {
          id: "preview-frame",
          type: "iframe",
          props: {
            src: "/packages/iframe.plugin/assets/preview.html",
            title: "Preview",
            html: "<script>window.__raw = true</script>",
            srcdoc: "<p>raw</p>",
            sandbox: ["allow-forms", "allow-scripts", "allow-top-navigation"]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(iframeMarkup, /<iframe/);
  assert.match(iframeMarkup, /src="\/packages\/iframe\.plugin\/assets\/preview\.html"/);
  assert.match(iframeMarkup, /title="Preview"/);
  assert.match(iframeMarkup, /sandbox="allow-forms allow-scripts"/);
  assert.doesNotMatch(iframeMarkup, /srcdoc|__raw|allow-top-navigation|dangerouslySetInnerHTML/);

  const invalidIframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.invalid",
        version: "test",
        root: {
          id: "bad-frame",
          type: "iframe",
          props: { src: "javascript:alert(1)", title: "Bad" }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(invalidIframeMarkup, /Iframe source unavailable/);
  assert.doesNotMatch(invalidIframeMarkup, /javascript:alert/);

  const protocolRelativeIframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.protocol-relative",
        version: "test",
        root: {
          id: "protocol-relative-frame",
          type: "iframe",
          props: { src: "//example.invalid/preview.html", title: "Protocol relative" }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(protocolRelativeIframeMarkup, /Iframe source unavailable/);
  assert.doesNotMatch(protocolRelativeIframeMarkup, /example\.invalid/);

  const directListItemMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "workspaces.test",
        version: "test",
        root: {
          id: "workspaces-root",
          type: "section",
          props: { title: "Workspaces" },
          slots: {
            children: [
              {
                id: "workspaces-list",
                type: "list",
                props: { aria_label: "Workspaces" },
                slots: {
                  children: [
                    {
                      id: "workspace-row-1",
                      type: "list_item",
                      slots: {
                        title: [{ id: "workspace-row-1-title", type: "text", props: { text: "Core renderer contract" } }],
                        subtitle: [{ id: "workspace-row-1-purpose", type: "text", props: { text: "Keep plugin UI generic" } }],
                        meta: [{ id: "workspace-row-1-status", type: "badge", props: { text: "active", tone: "success" } }],
                        actions: [
                          {
                            id: "workspace-row-1-open",
                            type: "button",
                            props: {
                              label: "Open",
                              action: { id: "workspace.open", target: "workspace-row-1", label: "Open workspace" }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(directListItemMarkup, /<ion-list/);
  assert.match(directListItemMarkup, /Core renderer contract/);
  assert.match(directListItemMarkup, /Keep plugin UI generic/);
  assert.match(directListItemMarkup, /active/);
  assert.match(directListItemMarkup, /color="success"/);
  assert.match(directListItemMarkup, /data-action-id="workspace\.open"/);
  assert.match(directListItemMarkup, /uinode-list-item-actions/);
  assert.doesNotMatch(directListItemMarkup, /aria-selected/);
  assert.doesNotMatch(directListItemMarkup, /Unsupported primitive: list_item/);

  const actionPrimitiveMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "action.primitive",
        version: "test",
        root: {
          id: "action-node-id",
          type: "button",
          props: { label: "Workspace action", action: { id: "workspace.action.intent" } }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(actionPrimitiveMarkup, />Workspace action<\/ion-button>/);
  assert.doesNotMatch(actionPrimitiveMarkup, />action-node-id<\/ion-button>/);

  const semanticActionId = WORKSPACES_SPAWN_OPENER_ACTION_ID;
  assert.equal(
    WORKSPACES_SPAWN_OPENER_SELECTOR,
    `ion-button[data-action-id='${semanticActionId}']`
  );
  const renderSpawnOpener = (label, actionId, payload) => renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "workspaces.spawn-opener",
        version: "test",
        root: {
          id: "opaque-producer-owned-spawn-opener",
          type: "button",
          props: { label, action: { id: actionId, payload } }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  const semanticOpenerMatchCount = (markup) => Array.from(
    markup.matchAll(/<ion-button\b[^>]*\bdata-action-id="([^"]+)"[^>]*>/g)
  ).filter((match) => match[1] === semanticActionId).length;
  const requireUniqueSemanticOpener = (markup) => {
    const count = semanticOpenerMatchCount(markup);
    if (count !== 1) throw new Error(`expected one semantic Spawn opener; count=${count}`);
  };
  const openerPayload = {
    selected_workspace: "workspace-opaque",
    dialog: "spawn-target:workspace-opaque"
  };
  const spawnOpenerMarkup = renderSpawnOpener(
    "Spawn",
    "botster_workspaces.open_spawn",
    openerPayload
  );
  const renamedSpawnOpenerMarkup = renderSpawnOpener(
    "Launch in workspace",
    "botster_workspaces.open_spawn",
    openerPayload
  );
  const genericSpawnOpenerMarkup = renderSpawnOpener(
    "Spawn",
    "botster_workspaces.open",
    openerPayload
  );
  for (const markup of [spawnOpenerMarkup, renamedSpawnOpenerMarkup]) {
    assert.doesNotThrow(() => requireUniqueSemanticOpener(markup));
    assert.match(markup, /data-action-id="botster_workspaces\.open_spawn"/);
    assert.match(markup, /data-ui-node-id="opaque-producer-owned-spawn-opener"/);
  }
  assert.throws(() => requireUniqueSemanticOpener(genericSpawnOpenerMarkup), /count=0/);
  assert.throws(
    () => requireUniqueSemanticOpener(`${spawnOpenerMarkup}${renamedSpawnOpenerMarkup}`),
    /count=2/
  );

  const interactionActions = [];
  const interactionTree = ionicUiNodeRendererRegistry.render(
    {
      kind: "ui_tree_snapshot",
      surface: "interaction-props.test",
      version: "test",
      root: {
        id: "interaction-root",
        type: "section",
        props: { title: "Interaction props" },
        slots: {
          children: [
            {
              id: "interaction-empty",
              type: "empty_state",
              props: {
                title: "No workspaces",
                primary_action: { id: "workspace.create", payload: { workspace_id: "new-workspace" } },
                secondary_action: { id: "workspace.import", payload: { workspace_id: "import-workspace" } }
              }
            },
            {
              id: "interaction-list",
              type: "list",
              props: {
                aria_label: "Selectable workspaces",
                selection: { mode: "single", selected: ["workspace-alpha"] }
              },
              slots: {
                children: [
                  {
                    id: "workspace-alpha-row",
                    type: "list_item",
                    props: {
                      value: "workspace-alpha",
                      activation: { id: "workspace.activate", payload: { workspace_id: "workspace-alpha" } },
                      action: { id: "workspace.open", payload: { workspace_id: "workspace-alpha" } }
                    },
                    slots: {
                      title: [{ id: "workspace-alpha-title", type: "text", props: { text: "Workspace alpha" } }]
                    }
                  },
                  {
                    id: "workspace-beta-row",
                    type: "list_item",
                    props: {
                      value: "workspace-beta",
                      activation: { id: "workspace.activate.beta", payload: { workspace_id: "workspace-beta" } }
                    },
                    slots: {
                      title: [{ id: "workspace-beta-title", type: "text", props: { text: "Workspace beta" } }]
                    }
                  },
                  {
                    id: "workspace-gamma-row",
                    type: "list_item",
                    props: {
                      value: "workspace-gamma",
                      activation: { id: "workspace.activate.gamma", payload: { workspace_id: "workspace-gamma" } },
                      action: { id: "workspace.disabled.open", disabled: true, payload: { workspace_id: "workspace-gamma" } }
                    },
                    slots: {
                      title: [{ id: "workspace-gamma-title", type: "text", props: { text: "Workspace gamma" } }]
                    }
                  }
                ]
              }
            },
            {
              id: "interaction-table",
              type: "table",
              props: {
                columns: [{ id: "workspace", label: "Workspace" }],
                selection: { mode: "single", selected: ["row-alpha"] },
                activation: { id: "workspace.row.activate", payload: { workspace_id: "row-activation" } },
                row_action: { id: "workspace.row.default", payload: { workspace_id: "row-default" } },
                rows: [
                  {
                    id: "row-alpha",
                    cells: { workspace: "Alpha" },
                    action: { id: "workspace.row.open", payload: { workspace_id: "workspace-alpha" } }
                  },
                  {
                    id: "row-beta",
                    cells: { workspace: "Beta" }
                  }
                ]
              }
            },
            {
              id: "interaction-empty-table",
              type: "table",
              props: {
                columns: [{ id: "workspace", label: "Workspace" }],
                rows: [],
                empty_state: {
                  id: "interaction-empty-table-state",
                  type: "empty_state",
                  props: {
                    title: "No table rows",
                    primary_action: { id: "workspace.table.empty", payload: { workspace_id: "empty-table" } }
                  }
                }
              }
            }
          ]
        }
      }
    },
    createInMemoryEntityFrameStore(),
    {
      collectAction: ({ action, node }) => interactionActions.push({ action, nodeId: node.id })
    }
  );
  const interactionMarkup = renderToStaticMarkup(interactionTree);
  assert.match(interactionMarkup, /data-action-id="workspace\.create"/);
  assert.match(interactionMarkup, /data-action-id="workspace\.import"/);
  assert.match(interactionMarkup, /Primary action/);
  assert.match(interactionMarkup, /Secondary action/);
  assert.doesNotMatch(interactionMarkup, /primary_action/);
  assert.match(interactionMarkup, /role="listbox"/);
  assert.match(interactionMarkup, /role="option"/);
  assert.match(interactionMarkup, /data-activation-action-id="workspace\.activate"/);
  assert.match(interactionMarkup, /data-activation-action-id="workspace\.activate\.beta"/);
  assert.match(interactionMarkup, /data-activation-action-id="workspace\.activate\.gamma"/);
  assert.doesNotMatch(interactionMarkup, /data-unsupported-interaction-props="activation"/);
  assert.match(interactionMarkup, /data-action-id="workspace\.open"/);
  assert.match(interactionMarkup, /data-action-id="workspace\.disabled\.open"[^>]*disabled=""/);
  assert.match(interactionMarkup, /aria-selected="true"/);
  assert.match(interactionMarkup, /aria-selected="false"/);
  assert.match(interactionMarkup, /data-selected="true"/);
  assert.match(interactionMarkup, /data-action-id="workspace\.row\.open"/);
  assert.match(interactionMarkup, /data-unsupported-interaction-props="activation,row_action"/);
  assert.doesNotMatch(interactionMarkup, /data-activation-action-id="workspace\.row\.activate"/);
  assert.doesNotMatch(interactionMarkup, /data-action-id="workspace\.row\.default"/);
  assert.match(interactionMarkup, /data-action-id="workspace\.table\.empty"/);
  assert.doesNotMatch(interactionMarkup, /Open alpha/);
  assert.doesNotMatch(interactionMarkup, /workspace\.row\.open<\/ion-button>/);
  assert.deepEqual(
    interactionActions
      .filter(({ action }) => action.id.startsWith("workspace."))
      .map(({ action }) => [action.id, action.payload]),
    [
      ["workspace.create", { workspace_id: "new-workspace" }],
      ["workspace.import", { workspace_id: "import-workspace" }],
      ["workspace.activate", { workspace_id: "workspace-alpha" }],
      ["workspace.open", { workspace_id: "workspace-alpha" }],
      ["workspace.activate.beta", { workspace_id: "workspace-beta" }],
      ["workspace.activate.gamma", { workspace_id: "workspace-gamma" }],
      ["workspace.disabled.open", { workspace_id: "workspace-gamma" }],
      ["workspace.row.open", { workspace_id: "workspace-alpha" }],
      ["workspace.table.empty", { workspace_id: "empty-table" }]
    ]
  );

  const inlineLayoutMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "inline.layout",
        version: "test",
        root: {
          id: "inline-root",
          type: "inline",
          props: { gap: "large", align: "center", justify: "end" },
          slots: {
            children: [
              { id: "inline-title", type: "text", props: { text: "Inline controls" } },
              { id: "inline-status", type: "badge", props: { text: "Blocked", tone: "danger" } }
            ]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(inlineLayoutMarkup, /class="uinode-inline"/);
  assert.match(inlineLayoutMarkup, /--uinode-gap:16px/);
  assert.match(inlineLayoutMarkup, /justify-content:flex-end/);
  assert.match(inlineLayoutMarkup, /color="danger"/);

  const emptyStateMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "empty-state.actions",
        version: "test",
        root: {
          id: "empty-root",
          type: "empty_state",
          props: { title: "No workspaces", body: "Create one to start routing sessions." },
          slots: {
            actions: [
              {
                id: "empty-create",
                type: "button",
                props: {
                  label: "Create",
                  action: { id: "workspace.create", label: "Create workspace" }
                }
              }
            ]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(emptyStateMarkup, /role="status"/);
  assert.match(emptyStateMarkup, /No workspaces/);
  assert.match(emptyStateMarkup, /Create one to start routing sessions/);
  assert.match(emptyStateMarkup, /uinode-empty-state-actions/);
  assert.match(emptyStateMarkup, /data-action-id="workspace\.create"/);

  const productionStore = createInMemoryEntityFrameStore();
  productionStore.apply({
    operation: "entity_snapshot",
    family: "botster-web.session_draft",
    records: [
      {
        id: "draft-1",
        fields: [
          {
            id: "session_name",
            label: "Session name",
            kind: "text_input",
            value: "",
            errors: ["Session name is required"]
          },
          {
            id: "target",
            label: "Target",
            kind: "text_input",
            value: "botster-web",
            errors: []
          }
        ]
      }
    ]
  });

  const productionMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(productionUiTreeSnapshot, productionStore, {
      capabilities: {
        ionic_shell: true,
        ui_tree_snapshot: true,
        entity_frame_store: true,
        semantic_actions: true,
        terminal_view_bridge: true,
        plugin_surface_sandbox: true
      },
      localState: {
        "production.action_status": "Accepted botster.session.select"
      }
    })
  );

  assert.match(productionMarkup, /Universal primitives/);
  assert.match(productionMarkup, /data-action-id="botster\.session\.select"/);

  const realHubStore = createInMemoryEntityFrameStore();
  for (const frame of daemonResponseFrames({
    kind: "packages",
    packages: [
      {
        package_name: "botster-web",
        version: "0.1.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [],
        surfaces: packageManifest.surfaces,
        runnable_entrypoints: [
          {
            id: "web-client",
            kind: "web",
            command: "node",
            args: ["scripts/local-package-server.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [{ surface: "network", scope: "localhost" }],
            may_supervise: true,
            process: {
              state: "running",
              pid: 41821,
              started_at: 1781112600,
              diagnostics: []
            },
            actions: entrypointActions("botster-web", "web-client")
          }
        ],
        configuration: botsterWebRemoteAccessConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [],
        feature_availability: [],
        actions: installedPackageActions("botster-web", true, true),
        provider_profile_admitted: false
      },
      {
        package_name: "project-pipelines",
        version: "0.8.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [{ surface: "SessionActions", scope: "project-pipelines" }],
        surfaces: [
          {
            id: "home",
            kind: "app",
            title: "Pipelines",
            description: "Project Pipelines workbench",
            order: 1,
            supports: ["render"]
          },
          {
            id: "settings",
            kind: "settings",
            title: "Pipeline Settings",
            order: 2,
            supports: ["render"]
          }
        ],
        view_surface: { id: "legacy-view", title: "Legacy View" },
        settings_surface: { id: "legacy-settings", title: "Legacy Settings" },
        runnable_entrypoints: [
          {
            id: "web-client",
            kind: "web",
            command: "node",
            args: ["scripts/local-package-server.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "running",
              pid: 4273,
              started_at: 1781112500,
              diagnostics: []
            },
            actions: entrypointActions("project-pipelines", "web-client")
          }
        ],
        configuration: configurablePackageConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [
          { id: "botster", package_name: "botster", state: "available", reasons: [] }
        ],
        feature_availability: [
          { id: "pipeline-runs", state: "available", reasons: [] }
        ],
        actions: installedPackageActions("project-pipelines", true, true),
        provider_profile_admitted: false
      },
      {
        package_name: "github-provider",
        version: "1.2.3",
        classification: "provider",
        state: "disabled",
        requested_capabilities: [{ surface: "ClientAdmission", scope: "github" }],
        runnable_entrypoints: [
          {
            id: "poller",
            kind: "provider",
            command: "node",
            args: ["scripts/poller.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "local",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "stopped",
              started_at: 1781112100,
              exited_at: 1781112200,
              exit_status: "signal:term",
              diagnostics: []
            },
            actions: entrypointActions("github-provider", "poller")
          }
        ],
        configuration: emptyPackageConfiguration,
        availability: blockedGithubAvailability,
        dependency_availability: [
          {
            id: "project-pipelines",
            package_name: "project-pipelines",
            state: "blocked",
            reasons: [{ reason: "dependency_disabled", action: "enable_package", package_name: "project-pipelines" }]
          }
        ],
        feature_availability: [
          {
            id: "github-prs",
            state: "blocked",
            reasons: [{ reason: "auth_required", action: "enable_package", requirement: "github" }]
          }
        ],
        actions: [
          daemonAction(
            "enable_package",
            "blocked",
            null,
            "auth_required",
            [{ kind: "auth_required", message: "GitHub auth is required" }]
          ),
          ...installedPackageActions("github-provider", false, false).filter((action) => action.action_id !== "enable_package")
        ],
        provider_profile_admitted: false
      },
      {
        package_name: "local-diagnostics",
        version: "0.1.0",
        classification: "plugin",
        state: "installed",
        requested_capabilities: [],
        runnable_entrypoints: [
          {
            id: "worker",
            kind: "daemon",
            command: "node",
            args: ["scripts/worker.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "failed",
              started_at: 1781112400,
              exited_at: 1781112460,
              exit_status: "exit:42",
              diagnostics: [{ kind: "stderr", message: "fixture failure" }]
            }
          }
        ],
        configuration: emptyPackageConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [],
        feature_availability: [],
        actions: installedPackageActions("local-diagnostics", false, false),
        provider_profile_admitted: false
      }
    ]
  }, 13)) {
    if (frame.kind === "entity_snapshot") {
      realHubStore.apply(frame.payload);
    }
  }
  realHubStore.apply(daemonEntityFrame({
    type: "entity_snapshot",
    subscription_id: "render-session-generation",
    entity_type: "session",
    snapshot_seq: 14,
    items: [{
      session_uuid: activeHubSessionId,
      registry_state: "active",
      lifecycle: "running",
      lifecycle_class: "current",
      rows: 24,
      cols: 80,
      updated_at: 1
    }]
  }).payload);
  for (const frame of daemonResponseFrames(generatedAppResponseFixture, 15)) {
    if (frame.kind === "entity_snapshot") {
      realHubStore.apply(frame.payload);
    }
  }

  const realHubMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(hubUiTreeSnapshot, realHubStore, {
      capabilities: {
        ionic_shell: true,
        ui_tree_snapshot: true,
        entity_frame_store: true,
        semantic_actions: true,
        terminal_view_bridge: true,
        plugin_surface_sandbox: true
      },
      localState: {
        "production.action_status": `Spawn requested for ${activeHubSessionId}; session state below confirms when it is running.`,
        "production.diagnostic_action_status": "Session not found",
        "production.plugin_surface_status": "botster-web: Deterministic app surface rendered by the botster-web validation package. (botster-web/production-app)"
      }
    })
  );
  assert.match(realHubMarkup, /Universal primitives/);
  assert.match(realHubMarkup, /data-action-id="botster\.session\.select"/);

  const healthyFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [schemaTwoInformation, compatibleDescriptorDiagnostic],
      packages: [
        {
          id: "botster-web",
          title: "botster-web",
          status: "enabled",
          entrypoint_process_summary: "web-client running"
        }
      ],
      packageLoadStatus: "loaded",
      sessions: [{ id: activeHubSessionId, lifecycle: "running", lifecycle_class: "current" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${activeHubSessionId}; session state below confirms when it is running.`
    })
  );
assert.match(healthyFirstScreenMarkup, /Local Botster health/);
assert.match(healthyFirstScreenMarkup, /Connection, extensions, sessions, and terminal availability/);
assert.doesNotMatch(healthyFirstScreenMarkup, /botster-web-production-ready/);
  assert.match(healthyFirstScreenMarkup, /Packages/);
  assert.match(healthyFirstScreenMarkup, /<h4>Hub<\/h4><ion-badge color="success">Healthy/);
  assert.doesNotMatch(healthyFirstScreenMarkup, /<h4>Hub<\/h4><ion-badge color="danger">Blocked/);
  assert.match(healthyFirstScreenMarkup, /Loaded/);
  assert.match(healthyFirstScreenMarkup, /Sessions/);
  assert.match(healthyFirstScreenMarkup, /Running/);
  assert.match(healthyFirstScreenMarkup, /Terminal output destination/);
  assert.doesNotMatch(healthyFirstScreenMarkup, /Ionic React renderer shell/);
  assert.doesNotMatch(healthyFirstScreenMarkup, /Spawn succeeded/);

  const hubDownFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [hubUnavailableDiagnostic(new Error("connect ECONNREFUSED"))],
      packages: [],
      packageLoadStatus: "not_loaded",
      sessions: [],
      sessionLoadStatus: "not_loaded",
      actionStatus: "connect ECONNREFUSED"
    })
  );
  assert.match(hubDownFirstScreenMarkup, /<h4>Hub<\/h4><ion-badge color="danger">Blocked/);
  assert.match(hubDownFirstScreenMarkup, /<h4>Transport<\/h4><ion-badge color="danger">Blocked/);
  assert.match(hubDownFirstScreenMarkup, /connect ECONNREFUSED/);
  assert.doesNotMatch(hubDownFirstScreenMarkup, /<h4>Hub<\/h4><ion-badge color="success">Connected/);

  const unloadedFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [],
      packages: [],
      packageLoadStatus: "not_loaded",
      sessions: [],
      sessionLoadStatus: "not_loaded",
      actionStatus: "Connected to local hub over WebRTC"
    })
  );
  assert.match(unloadedFirstScreenMarkup, /Not loaded/);
  assert.match(unloadedFirstScreenMarkup, /Package registry pull has not completed yet/);
  assert.match(unloadedFirstScreenMarkup, /Session pull has not completed yet/);
  assert.doesNotMatch(unloadedFirstScreenMarkup, /Loaded package registry returned zero package records/);

  const emptyFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [],
      packages: [],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Connected to local hub over WebRTC"
    })
  );
  assert.match(emptyFirstScreenMarkup, /Empty/);
  assert.match(emptyFirstScreenMarkup, /Loaded package registry returned zero package records/);
  assert.match(emptyFirstScreenMarkup, /No sessions are loaded yet/);

  const failedPackageFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [compatibleDescriptorDiagnostic],
      packages: [
        {
          id: "botster-web",
          status: "enabled",
          entrypoint_process_summary: "web-client running; worker failed (exit_status exit:42)"
        }
      ],
      packageLoadStatus: "loaded",
      sessions: [{ id: activeHubSessionId, lifecycle: "running", lifecycle_class: "current" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${activeHubSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(failedPackageFirstScreenMarkup, /<article class="local-hub-status-card danger"><div class="local-hub-status-title"><h4>Packages<\/h4><ion-badge color="danger">Error/);
  assert.match(failedPackageFirstScreenMarkup, /1 has failed entrypoint state/);

  const degradedTerminalFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [terminalUnavailableDiagnostic(new Error("terminal stream closed"))],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [{ id: activeHubSessionId, lifecycle: "running", lifecycle_class: "current" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${activeHubSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(degradedTerminalFirstScreenMarkup, /terminal stream closed/);
  assert.match(degradedTerminalFirstScreenMarkup, /Packages/);
  assert.match(degradedTerminalFirstScreenMarkup, /Sessions/);
  assert.match(degradedTerminalFirstScreenMarkup, /Running/);

  const spawnRequestedFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [compatibleDescriptorDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${activeHubSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(spawnRequestedFirstScreenMarkup, /<h4>Spawn action<\/h4><ion-badge color="medium">Requested/);
  assert.doesNotMatch(spawnRequestedFirstScreenMarkup, /Session botster-web-production-session is running/);

  const spawnFailedFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [spawnFailureOperatorDiagnostic, spawnFailureHubDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "runtime failed while handling Spawn: Runtime"
    })
  );
  assert.match(spawnFailedFirstScreenMarkup, /Spawn action/);
  assert.match(spawnFailedFirstScreenMarkup, /Blocked/);
  assert.match(spawnFailedFirstScreenMarkup, new RegExp(spawnFailureDiagnosticMessage));
  assert.doesNotMatch(spawnFailedFirstScreenMarkup, /Session botster-web-production-session is running/);
  assert.doesNotMatch(spawnFailedFirstScreenMarkup, /Spawn succeeded/);

  const missingSessionOperatorDiagnostic = operatorErrorDiagnostic({
    kind: "operator_error",
    payload: {
      operation: "shutdown_session",
      code: "session_not_found",
      message: "unknown session: missing-real-hub-session"
    }
  });
  const missingSessionActionDiagnostic = actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "unknown session: missing-real-hub-session" }
  );
  const missingSessionFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [missingSessionOperatorDiagnostic, missingSessionActionDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Connected to local hub over WebRTC"
    })
  );
  assert.match(missingSessionFirstScreenMarkup, /<h4>Spawn action<\/h4><ion-badge color="medium">Ready/);
  assert.match(missingSessionFirstScreenMarkup, /Creates a local hub session/);
  assert.doesNotMatch(missingSessionFirstScreenMarkup, /<h4>Spawn action<\/h4><ion-badge color="danger">Blocked/);
  assert.doesNotMatch(missingSessionFirstScreenMarkup, /unknown session: missing-real-hub-session/);

  const nonSpawnHubActionDiagnostic = hubConnectionDiagnosticFromFrame({
    kind: "connection_diagnostic",
    payload: {
      kind: "action_failure",
      operation: "rename",
      message: "unknown session: missing-real-hub-session"
    }
  });
  const nonSpawnHubActionFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [nonSpawnHubActionDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Connected to local hub over WebRTC"
    })
  );
  assert.match(nonSpawnHubActionFirstScreenMarkup, /<h4>Spawn action<\/h4><ion-badge color="medium">Ready/);
  assert.doesNotMatch(nonSpawnHubActionFirstScreenMarkup, /unknown session: missing-real-hub-session/);

  const primaryActionFailureDiagnostic = actionFailureDiagnostic(
    { id: "botster.session.select", target: activeHubSessionId },
    { accepted: false, reason: "spawn action rejected" }
  );
  const primaryActionFailedFirstScreenMarkup = renderToStaticMarkup(
    createElement(LocalHubFirstScreen, {
      mode: "webrtc",
      statusText: "Connected to local hub over WebRTC",
      diagnostics: [primaryActionFailureDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "spawn action rejected"
    })
  );
  assert.match(primaryActionFailedFirstScreenMarkup, /<h4>Spawn action<\/h4><ion-badge color="warning">Blocked/);
  assert.match(primaryActionFailedFirstScreenMarkup, /spawn action rejected/);

  const diagnosticsMarkup = renderToStaticMarkup(
    createElement(ConnectionDiagnosticsPanel, {
      diagnostics: [
        hubUnavailableDiagnostic(new Error("connect ECONNREFUSED")),
        schemaTwoInformation,
        ...runtimeDiagnostics,
        hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "compatibility_mismatch")),
        hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")),
        spawnFailureOperatorDiagnostic,
        spawnFailureHubDiagnostic,
        descriptorUnavailableDiagnostic,
        protocolMismatchDiagnostic,
        missingCapabilityDiagnostic,
        compatibleDescriptorDiagnostic,
        streamDisconnectedDiagnostic(new Error("WebRTC closed")),
        actionFailureDiagnostic(
          { id: "botster.session.rename", target: "missing-real-hub-session" },
          { accepted: false, reason: "Session not found" }
        ),
        terminalUnavailableDiagnostic(terminalAttachError)
      ]
    })
  );
  assert.match(diagnosticsMarkup, /Connection diagnostics/);
  assert.match(diagnosticsMarkup, /Local hub unavailable/);
  assert.match(diagnosticsMarkup, /Hub durable-state schema/);
  assert.match(diagnosticsMarkup, /Hub durable-state schema version 2/);
  assert.match(diagnosticsMarkup, /Hub connection established/);
  assert.match(diagnosticsMarkup, /Hub capability unsupported/);
  assert.match(diagnosticsMarkup, /Hub compatibility mismatch/);
  assert.match(diagnosticsMarkup, /Hub action failed/);
  assert.match(diagnosticsMarkup, new RegExp(spawnFailureDiagnosticMessage));
  assert.match(diagnosticsMarkup, /runtime failed while handling Spawn: Runtime/);
  assert.match(diagnosticsMarkup, /Capability: terminal_streaming/);
  assert.match(diagnosticsMarkup, /Operation: spawn/);
  assert.match(diagnosticsMarkup, /Hub compatibility descriptor compatible/);
  assert.match(diagnosticsMarkup, /Hub compatibility descriptor unavailable/);
  assert.match(diagnosticsMarkup, /Hub protocol mismatch/);
  assert.match(diagnosticsMarkup, /Hub capability missing/);
  assert.match(diagnosticsMarkup, /Control stream disconnected/);
  assert.match(diagnosticsMarkup, /Action failed/);
  assert.match(diagnosticsMarkup, /Terminal stream unavailable/);
  assert.match(diagnosticsMarkup, /data-diagnostic-id="terminal-unavailable"/);
  assert.match(diagnosticsMarkup, /Blocked \/ signaling/);
  assert.match(diagnosticsMarkup, /Warning \/ action/);
  assert.match(diagnosticsMarkup, /Healthy \/ compatibility/);
  assert.match(diagnosticsMarkup, /Info \/ server/);
  assert.doesNotMatch(diagnosticsMarkup, /Daemon schema mismatch|expected schema/);
  assert.ok(
    diagnosticsMarkup.indexOf("Local hub unavailable") < diagnosticsMarkup.indexOf("Hub action failed"),
    "danger diagnostics should render before warning diagnostics"
  );

  const transitionedDiagnosticsMarkup = renderToStaticMarkup(
    createElement(ConnectionDiagnosticsPanel, {
      diagnostics: transitionedCompatibilityDiagnostics
    })
  );
  assert.match(transitionedDiagnosticsMarkup, /Hub compatibility descriptor compatible/);
  assert.doesNotMatch(transitionedDiagnosticsMarkup, /Hub compatibility descriptor unavailable/);
  assert.equal((transitionedDiagnosticsMarkup.match(/data-diagnostic-id="hub-compatibility"/g) ?? []).length, 1);
} finally {
  await vite.close();
}

console.log("Renderer seam, runtime behavior, and registry fixture assertions passed.");

async function startPackageServerRuntime({
  launchResult = false,
  dynamicPort = false,
  occupiedPort = false,
  invalidBootstrapAt
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "botster-web-package-runtime-"));
  const socketPath = join(root, "botster-hub.sock");
  const launchResultPath = join(root, "launch-result.json");
  const port = dynamicPort ? undefined : await findAvailablePort();
  const daemonRequests = [];
  let bootstrapSequence = 0;
  await mkdir(join(root, "dist", "assets"), { recursive: true });
  await Promise.all([
    writeFile(
      join(root, "dist", "index.html"),
      '<!doctype html><html><head><title>botster package runtime</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>'
    ),
    writeFile(join(root, "dist", "assets", "app.js"), 'console.log("package asset");')
  ]);

  const daemon = createNetServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    let handshakeComplete = false;
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) {
          const frame = JSON.parse(line);
          if (!handshakeComplete) {
            assert.deepEqual(frame, { protocol: "botster-hub-daemon-v1" });
            handshakeComplete = true;
            socket.write(`${JSON.stringify({ protocol: "botster-hub-daemon-v1" })}\n`);
          } else {
            daemonRequests.push(frame);
            if (frame.type === "issue_local_webrtc_bootstrap") {
              bootstrapSequence += 1;
              const localWebrtcBootstrap = bootstrapSequence === invalidBootstrapAt
                ? null
                : {
                    grant_id: `package-server-grant-${bootstrapSequence}`,
                    grant_secret: String(bootstrapSequence).padStart(64, "0"),
                    package_name: frame.package_name,
                    entrypoint_id: frame.entrypoint_id,
                    expected_origin: frame.origin,
                    expires_at: 0,
                    signaling_transport: "daemon_request",
                    data_plane: "webrtc_data_channel",
                    ordered: true
                  };
              socket.write(
                `${JSON.stringify({
                  kind: "local_webrtc_bootstrap",
                  local_webrtc_bootstrap: localWebrtcBootstrap
                })}\n`
              );
            } else if (frame.type === "status") {
              socket.write(
                `${JSON.stringify({
                  kind: "status",
                  status: { lifecycle_state: "running", schema_version: 1 },
                  events: []
                })}\n`
              );
            } else {
              socket.write(`${JSON.stringify({ kind: "events", events: [] })}\n`);
            }
          }
        }
        newline = buffer.indexOf("\n");
      }
    });
  });

  await new Promise((resolve, reject) => {
    daemon.once("error", reject);
    daemon.listen(socketPath, () => {
      daemon.off("error", reject);
      resolve();
    });
  });

  let occupiedServer;
  if (occupiedPort) {
    occupiedServer = createNetServer();
    await new Promise((resolve, reject) => {
      occupiedServer.once("error", reject);
      occupiedServer.listen(port, hostForTests, () => {
        occupiedServer.off("error", reject);
        resolve();
      });
    });
  }

  const serverProcess = spawn(
    process.execPath,
    [new URL("../scripts/local-package-server.mjs", import.meta.url).pathname],
    {
      cwd: root,
      env: {
        ...process.env,
        BOTSTER_HUB_CONNECTION: JSON.stringify({
          transport: { type: "unix_socket", path: socketPath }
        }),
        ...(port === undefined ? {} : { BOTSTER_WEB_PACKAGE_SERVER_PORT: String(port) }),
        ...(launchResult ? { BOTSTER_ENTRYPOINT_LAUNCH_RESULT: launchResultPath } : {})
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stdout = "";
  let stderr = "";
  serverProcess.stdout.setEncoding("utf8");
  serverProcess.stderr.setEncoding("utf8");
  serverProcess.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  serverProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  if (occupiedPort) {
    const [code] = await once(serverProcess, "exit");
    occupiedServer.close();
    await once(occupiedServer, "close");
    daemon.close();
    await once(daemon, "close");
    const launchResultPublished = await readFile(launchResultPath, "utf8")
      .then(() => true)
      .catch((error) => {
        if (error?.code === "ENOENT") return false;
        throw error;
      });
    await rm(root, { recursive: true, force: true });
    return { code, stdout, stderr, launchResultPublished };
  }

  const origin = port === undefined
    ? (await readLaunchResult(launchResultPath)).local_url
    : `http://127.0.0.1:${port}`;
  await waitForHttpOk(`${origin}/health`, () => {
    if (serverProcess.exitCode !== null) {
      throw new Error(`package server exited before readiness: stdout=${stdout} stderr=${stderr}`);
    }
  });

  return {
    origin,
    launchResultPath: launchResult ? launchResultPath : undefined,
    daemonRequests,
    async stop() {
      serverProcess.kill("SIGTERM");
      await Promise.race([
        once(serverProcess, "exit"),
        new Promise((resolve) => setTimeout(resolve, 1_000))
      ]);
      daemon.close();
      await once(daemon, "close");
      await rm(root, { recursive: true, force: true });
    }
  };
}

async function readLaunchResult(path) {
  const deadline = Date.now() + 2_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError ?? new Error("timed out waiting for launch result");
}

async function findAvailablePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, hostForTests, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

async function waitForHttpOk(url, assertStillRunning) {
  const deadline = Date.now() + 5_000;
  let lastError;
  while (Date.now() < deadline) {
    assertStillRunning();
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError ?? new Error(`timed out waiting for ${url}`);
}

async function compileTsModule(sourcePath, outputPath) {
  const source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  });

  await writeFile(outputPath, result.outputText);
}

function deterministicIds(prefix) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForTestCondition(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("timed out waiting for test condition");
}

function createFakeDataChannel() {
  const listeners = new Map();
  return {
    readyState: "connecting",
    sent: [],
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((entry) => entry !== listener)
      );
    },
    send(data) {
      this.sent.push(data);
    },
    open() {
      this.readyState = "open";
      for (const listener of listeners.get("open") ?? []) listener({});
    },
    close() {
      if (this.readyState === "closed") return;
      this.readyState = "closed";
      for (const listener of listeners.get("close") ?? []) listener({});
    },
    emitMessage(data) {
      for (const listener of listeners.get("message") ?? []) listener({ data });
    }
  };
}

function createFakePeerConnection(dataChannel) {
  return {
    iceGatheringState: "complete",
    localDescription: { type: "offer", sdp: "offer-sdp", toJSON: () => ({ type: "offer", sdp: "offer-sdp" }) },
    createDataChannel() {
      return dataChannel;
    },
    async createOffer() {
      return this.localDescription;
    },
    async setLocalDescription(description) {
      this.localDescription = description;
    },
    async setRemoteDescription() {
      dataChannel.open();
    },
    close() {},
    addEventListener() {},
    removeEventListener() {}
  };
}

function createWebrtcTestClient(dataChannels, bootstrap, options = {}) {
  let nextDataChannel = 0;
  return createWebrtcDaemonClient({
    ...options,
    bootstrap,
    peerConnectionFactory: () => createFakePeerConnection(dataChannels[nextDataChannel++]),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        payload: {
          local_webrtc_answer: {
            grant_id: bootstrap.grant_id,
            answer: { type: "answer", sdp: "answer-sdp" }
          }
        }
      })
    })
  });
}

function repeatUtf8Pattern(pattern, totalBytes) {
  const patternBytes = Buffer.from(pattern);
  const output = Buffer.alloc(totalBytes);
  for (let offset = 0; offset < totalBytes; offset += patternBytes.length) {
    patternBytes.copy(output, offset, 0, Math.min(patternBytes.length, totalBytes - offset));
  }
  return output.toString("utf8");
}

function chunkUtf8Payload(payload, chunkPayloadBytes) {
  const bytes = Buffer.from(payload);
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += chunkPayloadBytes) {
    chunks.push(bytes.subarray(offset, offset + chunkPayloadBytes).toString("utf8"));
  }
  return chunks;
}

function reassembleFixtureChunks(chunks) {
  return chunks
    .toSorted((left, right) => left.chunk_index - right.chunk_index)
    .map((chunk) => chunk.payload)
    .join("");
}

async function emitChunkedTestResponse(dataChannel, secret, response, options = {}) {
  const chunks = await chunkedTestResponse(secret, response, options);
  const orderedChunks = options.reordered ? chunks.toReversed() : chunks;
  for (const chunk of orderedChunks) {
    dataChannel.emitMessage(JSON.stringify(chunk));
  }
  return chunks;
}

async function chunkedTestResponse(secret, response, options = {}) {
  const envelope = await encryptTestEnvelope(secret, response);
  const chunkPayloadBytes = options.chunkPayloadBytes ?? envelope.length;
  const payloads = chunkUtf8Payload(envelope, chunkPayloadBytes);
  return payloads.map((payload, chunkIndex) => ({
    version: 2,
    delivery_kind: options.deliveryKind ?? "daemon_response",
    message_id: options.messageId ?? `response-test-${++nextTestResponseMessageId}`,
    chunk_index: chunkIndex,
    chunk_count: payloads.length,
    total_bytes: Buffer.byteLength(envelope),
    payload
  }));
}

async function encryptTestEnvelope(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToArrayBuffer(secret.slice("secret-".length)),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return JSON.stringify({
    nonce: Buffer.from(nonce).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    version: 1
  });
}

async function decryptTestEnvelope(secret, envelopeJson) {
  const envelope = JSON.parse(envelopeJson);
  const key = await crypto.subtle.importKey(
    "raw",
    hexToArrayBuffer(secret.slice("secret-".length)),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(envelope.nonce) },
    key,
    base64ToArrayBuffer(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function waitForEncryptedRequest(dataChannel, secret, predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const envelope of dataChannel.sent) {
      const request = await decryptTestEnvelope(secret, envelope);
      if (predicate(request)) {
        return request;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("timed out waiting for encrypted WebRTC request");
}

function hexToArrayBuffer(encoded) {
  const bytes = new Uint8Array(encoded.length / 2);
  for (let index = 0; index < encoded.length; index += 2) {
    bytes[index / 2] = Number.parseInt(encoded.slice(index, index + 2), 16);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function base64ToArrayBuffer(encoded) {
  const bytes = Buffer.from(encoded, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function runNodeScript(scriptUrl, env = {}) {
  const child = spawn(process.execPath, [scriptUrl.pathname], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code, signal] = await once(child, "exit");
  return { code, signal, stdout, stderr };
}

function extractTopLevelCssRule(source, selector) {
  const ruleBodies = [];
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(source)) !== null) {
    const selectors = match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) {
      ruleBodies.push(match[2]);
    }
  }

  assert.ok(ruleBodies.length > 0, `expected CSS rule for ${selector}`);
  return ruleBodies.join("\n");
}

function extractCssAtRule(source, atRule) {
  const atRuleStart = source.indexOf(atRule);
  assert.notEqual(atRuleStart, -1, `expected CSS at-rule ${atRule}`);
  const blockStart = source.indexOf("{", atRuleStart);
  assert.notEqual(blockStart, -1, `expected CSS block for ${atRule}`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(blockStart + 1, index);
      }
    }
  }

  assert.fail(`expected closing brace for ${atRule}`);
}

function removeCssAtRules(source) {
  let remaining = source;
  let atRuleStart = remaining.indexOf("@");

  while (atRuleStart !== -1) {
    const blockStart = remaining.indexOf("{", atRuleStart);
    assert.notEqual(blockStart, -1, "expected CSS at-rule block");

    let depth = 0;
    let blockEnd = -1;
    for (let index = blockStart; index < remaining.length; index += 1) {
      if (remaining[index] === "{") {
        depth += 1;
      } else if (remaining[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blockEnd = index + 1;
          break;
        }
      }
    }

    assert.notEqual(blockEnd, -1, "expected closing brace for CSS at-rule");
    remaining = `${remaining.slice(0, atRuleStart)}${remaining.slice(blockEnd)}`;
    atRuleStart = remaining.indexOf("@");
  }

  return remaining;
}
