import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import {
  assertDurableStateOwnership,
  assertPackageReused,
  assertWorkspacesLifecycleStateOwnership,
  assertWorkspacesStateOwnership,
  classifyWorkspacesReference,
  convergeEntityFamily,
  durableSeedSessionIdsForDiagnosticsLimit,
  formatWorkspacesLifecycleFailure,
  harnessEventMatches,
  deleteSessionTypeTestId,
  editSessionTypeTestId,
  HOST_CHROME,
  htmlAssetUrls,
  isTerminalDetached,
  latestAcceptedWorkspacesUiTree,
  packageRuntimeNavigation,
  packageEnsureDecision,
  reconnectGenerationEvidence,
  workspacesLifecycleAbsenceResult,
  workspacesLifecycleDomResult,
  workspacesLifecycleMaterializationResult,
  workspacesLifecyclePartitionExpectations,
  workspacesLifecycleRegion
} from "./live-packaged-protocol-helpers.mjs";
import {
  assignmentDigest,
  assertNoRequiredSmokeSkip,
  assertReconciliationCounts,
  assertSharedHubSpawnResult,
  assertSharedHubSpawnSubmission,
  chooseCreateControl,
  parseWorkspacesSpawnAssignment,
  requiredProvenanceField,
  WORKSPACES_SPAWN_OPENER_SELECTOR
} from "./workspaces-shared-hub-browser-helpers.mjs";

const proofNotes = [];
function recordProofNote(kind, payload) {
  proofNotes.push({ kind, payload, at: Date.now() });
}


const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const durableStateMode = process.env.BOTSTER_LIVE_DURABLE_STATE === "1";
const suppliedDataDir = process.env.BOTSTER_LIVE_DATA_DIR;
const sharedHubDriverMode = process.env.BOTSTER_LIVE_SHARED_HUB_DRIVER === "1";
const sharedHubAssignment = sharedHubDriverMode
  ? parseWorkspacesSpawnAssignment(process.env.BOTSTER_WORKSPACES_SPAWN_CASES)
  : undefined;

if (sharedHubDriverMode) assertNoRequiredSmokeSkip();

assertDurableStateOwnership({
  durableStateMode,
  suppliedDataDir
});

const workspacesPackagePath = resolveOptionalPackagePath(
  [process.env.BOTSTER_WORKSPACES_PACKAGE_PATH, process.env.BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH],
  "botster-workspaces"
);
const requireWorkspacesMode = process.env.BOTSTER_LIVE_REQUIRE_WORKSPACES === "1";
const workspacesLifecycleMode = process.env.BOTSTER_LIVE_WORKSPACES_LIFECYCLE === "1";
const contractMatrixMode = process.env.BOTSTER_LIVE_CONTRACT_MATRIX === "1";
const contractMatrixPackageName = "botster.plugin-contract-matrix";
const contractMatrixSeedEndpoint = "https://example.invalid/plugin-contract-matrix/acceptance";
let contractMatrixFixtureTempDir;
const contractMatrixPackagePath = contractMatrixMode
  ? await resolveContractMatrixPackagePath()
  : undefined;
const payloadContractMode = process.env.BOTSTER_LIVE_PAYLOAD_CONTRACT === "1";
const payloadContractPackageName = "botster.plugin-payload-contract";
const payloadContractPackagePath = payloadContractMode
  ? resolvePayloadContractPackagePath()
  : undefined;
const entityOptionsMode = process.env.BOTSTER_LIVE_ENTITY_OPTIONS === "1";
const entityOptionsPackageName = "entity-options-reactive";
const entityOptionsPackagePath = entityOptionsMode
  ? resolveRequiredPackagePath(
      [
        process.env.BOTSTER_ENTITY_OPTIONS_PACKAGE_PATH,
        join(packageRoot, "fixtures/entity-options-reactive")
      ],
      entityOptionsPackageName,
      "BOTSTER_ENTITY_OPTIONS_PACKAGE_PATH"
    )
  : undefined;
const echoProbe = "keys";
const attachProbe = "botster-web-production-attach-probe";
const productionSessionId = "web-prod";

if (!sharedHubDriverMode && !process.env.BOTSTER_HUB_BIN) {
  throw new Error(
    "Live packaged protocol harness requires BOTSTER_HUB_BIN. " +
      "Use BOTSTER_HUB_BIN with BOTSTER_SESSION_WORKER_BIN for an isolated spawned hub."
  );
}

if ((requireWorkspacesMode || workspacesLifecycleMode) && !workspacesPackagePath) {
  throw new Error(
    "Workspaces compatibility and lifecycle modes require BOTSTER_WORKSPACES_PACKAGE_PATH or BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH."
  );
}

assertWorkspacesStateOwnership({
  requireWorkspacesMode,
  durableStateMode,
  suppliedDataDir
});
assertWorkspacesLifecycleStateOwnership({
  lifecycleMode: workspacesLifecycleMode,
  durableStateMode,
  suppliedDataDir
});

const {
  appRouteFromPathname,
  entityFamilyRecordLimit: diagnosticsEntityRecordLimit
} = await loadProductionAppRouteFromPathname();
const durableSeedSessionIds =
  durableSeedSessionIdsForDiagnosticsLimit(diagnosticsEntityRecordLimit);

if (!workspacesPackagePath) {
  console.log(
    "Workspaces package path not provided; live packaged protocol harness will fall back to generic first-party/production surface coverage. " +
      "Set BOTSTER_WORKSPACES_PACKAGE_PATH or BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH for named botster-workspaces/workspaces acceptance."
  );
}

let hubProcess;
let hubStdout = "";
let hubStderr = "";
const ownsWebrtcDataDir = suppliedDataDir === undefined;
const webrtcDataDir =
  suppliedDataDir ??
  await mkdtemp(join(process.platform === "win32" ? tmpdir() : "/tmp", "botster-web-webrtc-"));
let appUrl;

let browser;
let page;
const consoleEvents = [];
const pageErrors = [];
const responseErrors = [];
const responseAssemblyTelemetry = [];
const attachChronology = [];
let binaryProvenance;
let reusedWebPackageProvenance;
let workspacesCompatibilityProofCount = 0;
let workspacesCompatibilityState;

try {
  binaryProvenance = sharedHubDriverMode
    ? { hub: { path: null, source: "caller-owned" }, session_worker: { path: null, source: "caller-owned" } }
    : await loadBinaryProvenance();
  if (!sharedHubDriverMode) {
    console.log(`live packaged protocol binary provenance ${JSON.stringify(binaryProvenance)}`);
  }
  appUrl = await startWebrtcPackageRuntime();
  if (sharedHubDriverMode) {
    console.log(`live packaged protocol binary provenance ${JSON.stringify(binaryProvenance)}`);
  }

  browser = await chromium.launch({
    args: ["--disable-features=WebRtcHideLocalIpsWithMdns", "--force-webrtc-ip-handling-policy=default_public_and_private_interfaces"]
  });
  page = await browser.newPage();
  await installLiveHarnessPageHooks(page);

  page.on("console", (message) => {
    consoleEvents.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      responseErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openDiagnosticsView(page);
  await page.getByText("Local Botster health").waitFor();
  await waitForTransportLabel(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, "status request");
  const authoritativeHubStatus = await assertCurrentHubCompatibilityAndSchema(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_apps" }, "list_apps request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_packages" }, "list_packages request");
  const originalRemoteAccessValue = await waitForRemoteAccessPackageConfiguration(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: "session" },
    "session entity subscription request"
  );
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session" },
    "authoritative session snapshot"
  );
  await assertNoLegacySessionHydration(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: "session_type" },
    "session type entity subscription request"
  );
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session_type" },
    "authoritative session type snapshot"
  );
  await assertNoSessionTypeListHydration(page);
  await assertCurrentHubSchemaPresentation(page, authoritativeHubStatus);
  const initialHubIdentity = await assertAuthoritativeHubIdentity(page, authoritativeHubStatus, "initial connect");
  const liveHubUpdate = await assertHubUpdateCheck(page);
  await openDiagnosticsView(page);
  const hubUpdateSupportDiagnostics = await assertHubUpdateSupportDiagnostics(page);
  // Proven before any reload cycle, on the document that is already mounted.
  const inPageReconnect = await proveInPageReconnectReplaysHubStatus(page, initialHubIdentity);
  // Printed at capture time: page reloads in the reconnect cycles clear the recorded harness
  // events, so this evidence would otherwise be absent from a later failure dump.
  console.log(`live-hub-identity-evidence ${JSON.stringify({
    identity: initialHubIdentity,
    update: liveHubUpdate,
    support_diagnostics: hubUpdateSupportDiagnostics,
    in_page_reconnect: inPageReconnect
  })}`);
  if (sharedHubDriverMode) {
    const summary = await exerciseSharedHubWorkspaces(page, sharedHubAssignment);
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    await browser.close();
    browser = undefined;
    console.log(`workspaces-shared-hub-browser-summary ${JSON.stringify(summary)}`);
    await flushWritable(process.stdout);
    process.exit(0);
  }
  await openAppsView(page);
  await assertRemoteAccessSettingsDispatch(page, originalRemoteAccessValue);
  if (entityOptionsMode) {
    await exerciseEntityOptionsReactive(page);
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    assertRequiredWorkspacesProof();
    await requestDaemonShutdown();
    console.log("entity-options reactive live proof passed (webrtc)");
    process.exit(0);
  }
  if (contractMatrixMode) {
    await exercisePluginContractMatrix(page);
    if (payloadContractMode) {
      await exercisePayloadContract(page);
    }
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    assertRequiredWorkspacesProof();
    await requestDaemonShutdown();
    console.log(payloadContractMode
      ? "plugin payload contract smoke passed (webrtc)"
      : "plugin contract matrix smoke passed (webrtc)");
    process.exit(0);
  }
  if (workspacesPackagePath) {
    await openFirstPartyUiAppSurface(page, "webrtc");
    if (workspacesLifecycleMode) {
      await exerciseWorkspacesLifecycle(page);
      // Focused lifecycle smoke is complete: do not continue into session/terminal stages
      // (those are smoke:live-packaged-protocol). Mirrors entity-options reactive early exit.
      assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
      assertRequiredWorkspacesProof();
      await requestDaemonShutdown();
      console.log("workspaces lifecycle live proof passed (webrtc)");
      process.exit(0);
    }
  }
  if (process.env.BOTSTER_LIVE_SURFACE_ONLY === "1") {
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    assertRequiredWorkspacesProof();
    await requestDaemonShutdown();
    console.log("live packaged protocol surface proof passed");
    process.exit(0);
  }
  // Runs before any session is started: this stage takes several seconds of socket and UI
  // round-trips, and sitting it inside the session lifecycle window would outlive the
  // short-lived production session the terminal stages depend on.
  const sessionTypeProof = await exerciseSessionTypes(page);
  console.log(`session-type-live-proof ${JSON.stringify(sessionTypeProof)}`);
  const newSessionPickerProof = await exerciseNewSessionPickerListForTarget(page);
  console.log(`new-session-picker-live-proof ${JSON.stringify(newSessionPickerProof)}`);

  await openHomeView(page);
  if (durableStateMode) {
    await assertDurableSeededSessionsVisible(page);
  }
  await startProductionSession();
  await waitForSessionStatus(page, "running");
  await openSessionTerminal(page, productionSessionId);
  await waitForRunningSessionFrame(page);
  await waitForTerminalSession(page, productionSessionId);
  responseAssemblyTelemetry.push({ cycle: 0, ...await waitForAutomaticTerminalRestore(page) });
  await proveLiveTerminalAfterAttach(page, `${attachProbe}-0`);
  attachChronology.push({ cycle: 0, ...await assertTerminalAttachChronology(page, productionSessionId) });
  await proveExternalSessionLifecycle(page);

  const hubIdentityAcrossReconnects = [];
  let previousGrantId = await latestLocalWebrtcGrantId(page);
  let previousEntitySubscriptionId = await latestSessionEntitySubscriptionId(page);
  for (const cycle of [1, 2]) {
    const reconnect = await navigatePackageRuntimeAndAssertWebrtc(
      page,
      {
        label: `cycle ${cycle}`,
        mode: cycle === 1 ? "reload-current-route" : "revisit-package-root"
      },
      previousGrantId,
      previousEntitySubscriptionId
    );
    previousGrantId = reconnect.grantId;
    previousEntitySubscriptionId = reconnect.subscriptionId;
    if (await page.getByTestId(HOST_CHROME.terminalSessionViewTestId).count() === 0) {
      await openHomeView(page);
      await waitForSessionStatus(page, "running");
      await openSessionTerminal(page, productionSessionId);
    }
    await waitForSessionStatus(page, "running");
    await waitForRunningSessionFrame(page);
    await waitForTerminalSession(page, productionSessionId);
    responseAssemblyTelemetry.push({ cycle, ...await waitForAutomaticTerminalRestore(page) });
    await proveLiveTerminalAfterAttach(page, `${attachProbe}-${cycle}`);
    attachChronology.push({ cycle, ...await assertTerminalAttachChronology(page, productionSessionId) });
    // Reconnect-replay evidence in production shape, asserted structurally so the terminal
    // route is not disturbed: the new WebRTC generation must re-hydrate botster-web.hub_status
    // with the authoritative facts rather than leaving them unreported.
    hubIdentityAcrossReconnects.push({
      cycle,
      ...assertHubStatusRehydrated(
        await hubStatusRehydrationEvidence(page),
        initialHubIdentity,
        `reconnect cycle ${cycle}`
      )
    });
  }

  // Mounted keyboard must use ModeGatedInput (JSON-safe tokens from core#121).
  const modeGatedBeforeEcho = await daemonRequestCount(page, { type: "mode_gated_input" });
  await typeThroughMountedTerminal(page, `${echoProbe}\n`);
  await waitForTerminalOutput(page, `botster-web-production-echo:${echoProbe}`);
  await waitForTerminalRendererWrite(page, `botster-web-production-echo:${echoProbe}`);
  const modeGatedAfterEcho = await daemonRequestCount(page, { type: "mode_gated_input" });
  if (modeGatedAfterEcho <= modeGatedBeforeEcho) {
    throw new Error(
      `expected mode_gated_input for mounted echo ${echoProbe}, observed delta ${modeGatedAfterEcho - modeGatedBeforeEcho}`
    );
  }
  const fallbackSeen = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some(
      (entry) => entry.kind === "mode_gated_input_fallback"
    )
  );
  if (fallbackSeen) {
    throw new Error("mode_gated_input_fallback must not appear after JSON-safe token fix");
  }

  const readScreen = await callTerminalControl(page, "readScreen");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "read_screen" }, "read_screen request");
  if (
    readScreen?.session_id !== productionSessionId ||
    !readScreen.text?.includes(`botster-web-production-echo:${echoProbe}`)
  ) {
    throw new Error(`unexpected read_screen response: ${JSON.stringify(readScreen)}`);
  }

  const captureSnapshot = await callTerminalControl(page, "captureSnapshot");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "capture_snapshot" }, "capture_snapshot request");
  if (
    captureSnapshot?.session_id !== productionSessionId ||
    !Number.isInteger(captureSnapshot.rows) ||
    captureSnapshot.rows <= 0 ||
    !Number.isInteger(captureSnapshot.cols) ||
    captureSnapshot.cols <= 0 ||
    !Number.isInteger(captureSnapshot.payload_bytes) ||
    captureSnapshot.payload_bytes < 0 ||
    (captureSnapshot.payload_format != null && typeof captureSnapshot.payload_format !== "string")
  ) {
    throw new Error(`unexpected capture_snapshot response: ${JSON.stringify(captureSnapshot)}`);
  }
  await waitForTerminalAttachState(page, ["attached"]);

  const requestedResize = await latestTerminalResize(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "resize", rows: requestedResize.rows, cols: requestedResize.columns },
    "resize request"
  );
  await waitForResizeProof(page, requestedResize);

  // Production-path terminal oracles required by Review: mouse, palette, zero OSC replies,
  // retained history, and in-page DataChannel reconnect with surviving document + H0-H5.
  await proveMountedMouseModeGatedInput(page);
  await proveZeroBrowserOscColorReplies(page);
  await provePaletteProjectionAfterOsc(page, productionSessionId);
  await proveRetainedHistoryAfterEcho(page, echoProbe);
  await proveInPageTerminalDataChannelReconnect(page, productionSessionId);

  // Rendered-DOM re-check after two WebRTC generations and the full terminal exercise: the
  // General section must still show the authoritative identity, not "Not reported". Placed
  // before the terminal shutdown/detach steps, which fail on main for unrelated reasons.
  const finalHubStatus = await assertCurrentHubCompatibilityAndSchema(page);
  const finalHubIdentity = await assertAuthoritativeHubIdentity(page, finalHubStatus, "after reconnect cycles");
  for (const [field, value] of Object.entries(initialHubIdentity)) {
    if (String(finalHubIdentity[field]) !== String(value)) {
      throw new Error(
        `Hub identity changed across the reconnect cycles: ${field} ${String(value)} -> ${String(finalHubIdentity[field])}`
      );
    }
  }
  await openHomeView(page);
  await openSessionTerminal(page, productionSessionId);
  await waitForTerminalSession(page, productionSessionId);

  await callTerminalControl(page, "writeInput", "botster-web-production-exit\n");
  await waitForTerminalOutput(page, "botster-web-production-exiting");
  await shutdownProductionSession();
  await waitForTerminalDetached(page, productionSessionId);

  await assertNoUnknownSession(page);
  assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
  assertRequiredWorkspacesProof();
  await requestDaemonShutdown();
  console.log(
    "live packaged protocol harness passed (webrtc) " +
      JSON.stringify({
        binary_provenance: binaryProvenance,
        hub_identity: initialHubIdentity,
        hub_identity_in_page_reconnect: inPageReconnect,
        hub_identity_across_reconnects: hubIdentityAcrossReconnects,
        hub_update: liveHubUpdate,
        attach_chronology: attachChronology,
        response_assembly_telemetry: responseAssemblyTelemetry,
        terminal_proof_notes: typeof proofNotes !== "undefined" ? proofNotes : []
      })
  );
} catch (error) {
  if (sharedHubDriverMode) {
    error.compactLifecycleEvidence = true;
  }
  const harnessState = page
    ? await page.evaluate(() => {
        const state = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
        if (!state) return undefined;
        const redactEntry = (entry) => {
          const payload = entry?.payload;
          if (!payload || typeof payload !== "object") return entry;
          const redactedPayload = { ...payload };
          if (typeof redactedPayload.payload_base64 === "string") {
            redactedPayload.payload_base64 = `[redacted ${redactedPayload.payload_base64.length} base64 chars]`;
          }
          if (typeof redactedPayload.data === "string" && redactedPayload.data.length > 512) {
            redactedPayload.data = `${redactedPayload.data.slice(0, 160)}… [redacted ${redactedPayload.data.length - 160} chars]`;
          }
          return { ...entry, payload: redactedPayload };
        };
        return {
          events: (state.events ?? []).map(redactEntry),
          terminal: (state.terminal ?? []).map(redactEntry)
        };
      }).catch(() => undefined)
    : undefined;
  let diagnosticMessage = error.message;
  if (hubStdout || hubStderr) {
    if (!error.compactLifecycleEvidence) {
      diagnosticMessage += `\nhub stdout:\n${hubStdout}\nhub stderr:\n${hubStderr}`;
    }
  }
  if (harnessState && !error.compactLifecycleEvidence) {
    const terminalStreamEvents = harnessState.events?.filter((entry) => entry.kind.startsWith("terminal_stream_")) ?? [];
    if (terminalStreamEvents.length > 0) {
      diagnosticMessage += `\nterminal stream events:\n${JSON.stringify(terminalStreamEvents, null, 2)}`;
    }
    diagnosticMessage += `\nharness state:\n${JSON.stringify(harnessState, null, 2)}`;
  }
  const browserFailureMessage = browserFailureSummary({ consoleEvents, pageErrors, responseErrors });
  if (browserFailureMessage) {
    diagnosticMessage += `\n${browserFailureMessage}`;
  }
  error.message = diagnosticMessage;
  if (typeof error.stack === "string") {
    error.stack = `${diagnosticMessage}\n${error.stack}`;
  }
  throw error;
} finally {
  await browser?.close();
  if (hubProcess && hubProcess.exitCode === null) {
    hubProcess.kill("SIGTERM");
    await Promise.race([
      once(hubProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000))
    ]);
  }
  if (ownsWebrtcDataDir && webrtcDataDir) {
    await rm(webrtcDataDir, { recursive: true, force: true });
  }
  if (contractMatrixFixtureTempDir) {
    await rm(contractMatrixFixtureTempDir, { recursive: true, force: true });
  }
}

async function requestDaemonShutdown() {
  await runHubCommand(["shutdown", "--data-dir", webrtcDataDir]).catch((error) => {
    if (hubProcess?.exitCode === null) {
      throw error;
    }
  });
}

async function resolveContractMatrixPackagePath() {
  if (process.env.BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH) {
    return resolveRequiredPackagePath(
      [process.env.BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH],
      contractMatrixPackageName,
      "BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH"
    );
  }

  const {
    materializePluginContractMatrixFixture,
    metadata: hubTestSupportMetadata,
    verifyPackageAssets
  } = await loadHubTestSupport();
  const assetCheck = verifyPackageAssets();
  if (!assetCheck.ok) {
    throw new Error(
      [
        `live harness could not use ${hubTestSupportMetadata.package_name}@${hubTestSupportMetadata.package_version}`,
        `artifact: ${hubTestSupportMetadata.plugin_contract_matrix.artifact_path}`,
        `failures: ${assetCheck.failures.join(", ")}`,
        "Run npm install so the declared devDependency is present, or set BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH for a local override."
      ].join("\n")
    );
  }

  contractMatrixFixtureTempDir = await mkdtemp(join(tmpdir(), "botster-web-contract-matrix-"));
  return materializePluginContractMatrixFixture(contractMatrixFixtureTempDir);
}

function resolvePayloadContractPackagePath() {
  return resolveRequiredPackagePath(
    [
      process.env.BOTSTER_PLUGIN_PAYLOAD_CONTRACT_PACKAGE_PATH,
      join(packageRoot, "fixtures/plugin-payload-contract")
    ],
    payloadContractPackageName,
    "BOTSTER_PLUGIN_PAYLOAD_CONTRACT_PACKAGE_PATH"
  );
}

async function loadHubTestSupport() {
  try {
    return await import("@trybotster/hub-test-support");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        [
          "live harness contract matrix mode requires the declared @trybotster/hub-test-support devDependency.",
          "Run npm install so the artifact package is present, or set BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH for a local override."
        ].join("\n"),
        { cause: error }
      );
    }
    throw error;
  }
}

function resolveOptionalPackagePath(candidates, packageName) {
  return candidates
    .filter(Boolean)
    .find((candidate) => {
      if (!existsSync(join(candidate, "botster-package.json"))) return false;
      try {
        const manifest = JSON.parse(readFileSync(join(candidate, "botster-package.json"), "utf8"));
        return manifest.name === packageName;
      } catch {
        return false;
      }
    });
}

function resolveRequiredPackagePath(candidates, packageName, envName) {
  const packagePath = resolveOptionalPackagePath(candidates, packageName);
  if (!packagePath) {
    throw new Error(
      `live harness could not find ${packageName}; set ${envName}. Checked ${JSON.stringify(candidates.filter(Boolean))}`
    );
  }
  return packagePath;
}

async function refreshPackageRuntime(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function revisitPackageRuntime(page) {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
}

async function navigatePackageRuntimeAndAssertWebrtc(
  page,
  { inspectDiagnostics = true, label, mode },
  previousGrantId,
  previousEntitySubscriptionId
) {
  const beforeUrl = page.url();
  const navigation = packageRuntimeNavigation({ appUrl, currentUrl: beforeUrl, mode });

  if (navigation.action === "reload") {
    await refreshPackageRuntime(page);
  } else {
    await page.goto(navigation.expectedUrl, { waitUntil: "domcontentloaded" });
  }

  const afterUrl = page.url();
  if (afterUrl !== navigation.expectedUrl) {
    throw new Error(
      `package runtime navigation ${label} changed exact URL: ` +
      `mode=${mode} expected=${navigation.expectedUrl} before=${beforeUrl} after=${afterUrl} app=${appUrl}`
    );
  }

  if (inspectDiagnostics) {
    await openDiagnosticsView(page);
    await waitForTransportLabel(page);
  }
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "local_webrtc_signal" }, `${label} local_webrtc_signal request`);
  await waitForHarnessEvent(page, { kind: "webrtc_data_channel", state: "open" }, `${label} data channel open`);
  await waitForHarnessEvent(page, { kind: "webrtc_lifecycle", type: "data-channel-open" }, `${label} lifecycle data-channel-open`);
  await waitForHarnessEvent(page, { kind: "webrtc_lifecycle", type: "encrypted-stream-ready" }, `${label} encrypted stream ready`);
  await assertNoGrantSecretLeak(page, label);

  const grantId = await latestLocalWebrtcGrantId(page);
  if (!grantId) {
    throw new Error(`package runtime navigation ${label} did not expose a redacted local WebRTC grant_id`);
  }
  if (previousGrantId && grantId === previousGrantId) {
    throw new Error(`package runtime navigation ${label} reused local WebRTC grant_id ${grantId}`);
  }

  if (inspectDiagnostics) {
    await page.getByText("WebRTC DataChannel open").waitFor({ timeout: 15_000 });
    await page.getByText("Encrypted client stream ready").waitFor({ timeout: 15_000 });
  }
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, `${label} status request`);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_packages" }, `${label} list_packages request`);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: "session" },
    `${label} session entity subscription`
  );
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session" },
    `${label} authoritative session snapshot`
  );
  const subscriptionId = await latestSessionEntitySubscriptionId(page);
  if (!subscriptionId) {
    throw new Error(`package runtime navigation ${label} did not create a session entity subscription`);
  }
  if (previousEntitySubscriptionId && subscriptionId === previousEntitySubscriptionId) {
    throw new Error(`package runtime navigation ${label} reused session subscription_id ${subscriptionId}`);
  }
  await assertNoLegacySessionHydration(page);
  return { grantId, subscriptionId, beforeUrl, afterUrl, navigationMode: mode };
}

async function callTerminalControl(page, method, ...args) {
  await page.waitForFunction(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl));
  return page.evaluate(
    async ({ method: nextMethod, args: nextArgs }) => {
      return globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl[nextMethod](...nextArgs);
    },
    { method, args }
  );
}

async function typeThroughMountedTerminal(page, data) {
  await waitForTerminalCanvas(page);
  await callTerminalControl(page, "focus");
  const canvas = page.locator(".terminal-view-container canvas").first();
  await canvas.click();
  await new Promise((r) => setTimeout(r, 100));
  // Prefer key events so Restty key encoding + ModeGatedInput semantic path run.
  // insertText alone can skip keydown and leave a stale mouse semantic from click.
  await page.keyboard.type(data, { delay: 10 });
}

async function openAppsView(page) {
  await page
    .getByLabel(HOST_CHROME.workbenchNavLabel)
    .getByRole("button", { name: HOST_CHROME.appsNavButtonName, exact: true })
    .click();
  await page.getByTestId(HOST_CHROME.appsViewTestId).waitFor();
}

async function openHomeView(page) {
  await page
    .getByLabel(HOST_CHROME.workbenchNavLabel)
    .getByRole("button", { name: HOST_CHROME.homeNavButtonName, exact: true })
    .click();
  await page.getByTestId(HOST_CHROME.dashboardTestId).waitFor();
}

async function openSessionTerminal(page, sessionId) {
  const sessionRow = page.getByTestId(HOST_CHROME.dashboardTestId).locator("ion-item").filter({
    has: page.getByText(sessionId, { exact: true })
  });
  await sessionRow.getByRole("button", { name: HOST_CHROME.openSessionButtonName, exact: true }).click();
  await page.getByTestId(HOST_CHROME.terminalSessionViewTestId).waitFor();
}

async function openDiagnosticsView(page) {
  await page
    .locator("ion-menu.app-sidebar")
    .getByRole("button", { name: HOST_CHROME.hubSettingsNavButtonName, exact: true })
    .click();
  await page
    .getByLabel(HOST_CHROME.hubSettingsSectionsLabel)
    .getByRole("button", { name: new RegExp(HOST_CHROME.supportSectionLabel) })
    .click();
  await page.getByTestId(HOST_CHROME.diagnosticsViewTestId).waitFor();
  const developerDetails = page.locator(`details.${HOST_CHROME.developerDiagnosticsClass}`);
  if (!(await developerDetails.evaluate((details) => details.open))) {
    await developerDetails.locator("summary").click();
  }
}

function installedList(page) {
  return page.locator(`[aria-label='${HOST_CHROME.installedListLabel}']`);
}

async function openFirstPartyUiAppSurface(page, mode) {
  const installed = installedList(page);
  const target = mode === "webrtc" && (workspacesPackagePath || sharedHubDriverMode)
    ? {
        packageName: "botster-workspaces",
        surfaceId: "workspaces",
        visiblePattern: /botster[- ]workspaces|workspaces/i,
        packageNamePattern: "^botster-workspaces$"
      }
    : {
        packageName: mode === "webrtc" ? "botster-web" : undefined,
        surfaceId: mode === "webrtc" ? "production-app" : undefined,
        visiblePattern: mode === "webrtc" ? /botster[- ]web|Production/i : /project[- ]pipelines|botster[- ]workspaces|workspaces/i,
        packageNamePattern: mode === "webrtc" ? "^botster-web$" : "^(project-pipelines|botster-workspaces)$"
      };
  const candidate = installed.getByText(target.visiblePattern).first();
  const foundSurface = await candidate.waitFor({ timeout: 15_000 }).then(() => true).catch(async (error) => {
    const installedText = await installed.innerText().catch(() => "");
    const message = `no first-party UI surface row was visible; installed=${JSON.stringify(installedText)}: ${error.message}`;
    if (!requireWorkspacesMode && process.env.BOTSTER_LIVE_ALLOW_SURFACE_SKIP === "1") {
      console.log(`skipping first-party app surface proof; ${message}`);
      return false;
    }
    throw new Error(`timed out waiting for first-party app surface proof; ${message}`);
  });
  if (!foundSurface) return;
  await candidate.click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name_pattern: target.packageNamePattern },
    "first-party app plugin_surface_render request"
  );
  await assertSelectedAppSurfaceRendered(page, target);
  if (target.packageName && target.surfaceId) {
    if (!workspacesLifecycleMode && !sharedHubDriverMode) {
      await assertPluginSurfaceRouteReloadAndDirectLoad(page, target);
    }
  }
}

async function exercisePluginContractMatrix(page) {
  await assertContractMatrixPackageLoaded(page);
  await openContractAppFromNavigation(page);
  await assertContractSurfaceRoute(page, "contract.app", "plugin_surface_render");
  await openAppsView(page);
  const previousEventCount = await harnessEventCount(page);
  await openContractAppFromApps(page);
  await assertContractSurfaceRoute(page, "contract.app", "plugin_surface_render", previousEventCount);
  await assertContractSurfaceRouteReconnect(page, "contract.app", "plugin_surface_render");
  await assertContractSurfaceRouteReloadAndDirectLoad(page, "contract.app", "plugin_surface_render");

  await navigateToContractSurface(page, "contract.empty");
  await assertContractSurfaceRoute(page, "contract.empty", "No fixture rows are available.");

  await exerciseContractSessionBindings(page);

  await navigateToContractSurface(page, "contract.blocked");
  await assertContractBlockedSurface(page);
  await assertDaemonResponsiveAfterBlockedSurface(page);

  await exerciseContractMatrixSettings(page);
  await exerciseContractMatrixActions(page);
}

async function assertContractMatrixPackageLoaded(page) {
  await page.waitForFunction(
    ({ packageName }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const daemonPackages = [];
      const projectedPackages = [];
      const apps = [];
      for (const entry of events) {
        if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
          daemonPackages.push(...(entry.payload.packages ?? []));
        }
        if (entry.kind === "daemon_response" && entry.payload?.kind === "apps") {
          apps.push(...(entry.payload.apps ?? []));
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
          const payload = entry.payload.payload;
          if (payload?.family === "botster-web.package") projectedPackages.push(...(payload.records ?? []));
          if (payload?.family === "botster-web.app") apps.push(...(payload.records ?? []));
        }
      }
      const daemonPackage = daemonPackages.find((record) => record.package_name === packageName);
      const projectedPackage = projectedPackages.find((record) => record.id === packageName);
      const appRecord = apps.find((record) => record.package_name === packageName);
      const daemonSurfaces = daemonPackage?.surfaces ?? [];
      const projectedAppSurfaces = projectedPackage?.app_surfaces ?? [];
      const projectedSettingsSurfaces = projectedPackage?.settings_surfaces ?? [];
      return Boolean(daemonPackage) &&
        Boolean(projectedPackage) &&
        Boolean(appRecord || projectedAppSurfaces.length > 0) &&
        ["contract.app", "contract.empty", "contract.sessions", "contract.blocked", "contract.settings"]
          .every((surfaceId) => daemonSurfaces.some((surface) => surface.id === surfaceId)) &&
        ["contract.app", "contract.empty", "contract.sessions", "contract.blocked"]
          .every((surfaceId) => projectedAppSurfaces.some((surface) => surface.surface_id === surfaceId)) &&
        projectedSettingsSurfaces.some((surface) => surface.surface_id === "contract.settings");
    },
    { packageName: contractMatrixPackageName },
    { timeout: 45_000 }
  ).catch(async (error) => {
    const installedText = await installedList(page).innerText().catch(() => "");
    throw new Error(
      `contract matrix package/app descriptors were not visible; installed=${JSON.stringify(installedText)}: ${error.message}`
    );
  });
}

async function exerciseContractSessionBindings(page) {
  if (!webrtcDataDir) throw new Error("contract.sessions proof requires a WebRTC hub data directory");

  const { readSessionPluginBindingConformanceFixture } = await loadHubTestSupport();
  const publishedBindingFixture = readSessionPluginBindingConformanceFixture();
  const expectedRows = publishedBindingFixture.row_expected.initial;

  const references = [
    "session-transition",
    "session-stable-current",
    "session-ended",
    "session-indeterminate",
    "session-missing"
  ];
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  for (const sessionId of references.slice(0, 4)) {
    const response = await sendDaemonRequest(socketPath, {
      type: "spawn",
      session_id: sessionId,
      command: "sleep 300"
    });
    if (response.error) {
      throw new Error(`contract.sessions spawn failed for ${sessionId}: ${JSON.stringify(response.error)}`);
    }
    await waitForHarnessEvent(
      page,
      { kind: "hub_frame", family: "session", id: sessionId, lifecycle_class: "current" },
      `contract.sessions current row ${sessionId}`
    );
  }

  const endedResponse = await sendDaemonRequest(socketPath, {
    type: "shutdown_session",
    session_id: "session-ended"
  });
  if (endedResponse.error) {
    throw new Error(`contract.sessions ended transition failed: ${JSON.stringify(endedResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session", id: "session-ended", lifecycle_class: "ended" },
    "contract.sessions ended row"
  );

  await navigateToContractSurface(page, "contract.sessions");
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session" },
    "contract.sessions authoritative session snapshot"
  );
  await assertContractSurfaceRoute(page, "contract.sessions", "Session lifecycle projection");
  await page.waitForFunction(() =>
    typeof globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.dispatchAction === "function"
  );
  await dispatchContractSessionsSurface(page, references);
  await assertContractSessionBindingText(page);
  await assertContractSessionRows(page, expectedRows);
  await activateContractSessionControl(page, expectedRows[0].controls[0], "click");
  await activateContractSessionControl(page, expectedRows[1].controls[1], "keyboard");

  const previousSubscriptionId = await latestSessionEntitySubscriptionId(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session" },
    "contract.sessions reconnect authoritative snapshot"
  );
  await page.waitForFunction(
    (priorId) => {
      const ids = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "subscribe_entities")
        .map((entry) => entry.payload?.subscription_id);
      return ids.some((id) => typeof id === "string" && id !== priorId);
    },
    previousSubscriptionId
  );
  await assertContractSurfaceRoute(page, "contract.sessions", "Session lifecycle projection");
  await page.waitForFunction(() =>
    typeof globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.dispatchAction === "function"
  );
  await dispatchContractSessionsSurface(page, references);
  await assertContractSessionBindingText(page);
  await assertContractSessionRows(page, expectedRows);
  await activateContractSessionControl(page, expectedRows[0].controls[1], "keyboard");
}

async function dispatchContractSessionsSurface(page, references) {
  const eventCount = await harnessEventCount(page);
  await page.evaluate(
    ({ packageName, sessionUuids }) => {
      return globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.dispatchAction(
        {
          id: "botster.package.surface.render",
          target: packageName,
          label: "Session Lifecycle Projection",
          params: {
            package_name: packageName,
            surface_id: "contract.sessions",
            payload: { session_uuids: sessionUuids }
          }
        },
        {
          expectedSurface: {
            packageName,
            surfaceId: "contract.sessions"
          },
          routeKey: `${packageName}/contract.sessions`
        }
      );
    },
    { packageName: contractMatrixPackageName, sessionUuids: references }
  );
  await page.waitForFunction(
    ({ packageName, sessionUuids, sinceIndex }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .slice(sinceIndex)
        .some((entry) =>
          entry.kind === "daemon_request" &&
          entry.payload?.type === "plugin_surface_render" &&
          entry.payload?.package_name === packageName &&
          entry.payload?.surface_id === "contract.sessions" &&
          JSON.stringify(entry.payload?.payload?.session_uuids) === JSON.stringify(sessionUuids)
        ),
    { packageName: contractMatrixPackageName, sessionUuids: references, sinceIndex: eventCount }
  );
}

async function assertContractSessionBindingText(page) {
  const selectedSurface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  await selectedSurface.getByText("current", { exact: true }).first().waitFor({ timeout: 45_000 });
  await selectedSurface.getByText("ended", { exact: true }).waitFor({ timeout: 45_000 });
  const unavailableCount = await selectedSurface.getByText("Session unavailable", { exact: true }).count();
  if (unavailableCount !== 1) {
    throw new Error(`contract.sessions expected one absent reference, observed ${unavailableCount}`);
  }
}

async function assertContractSessionRows(page, expectedRows) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  for (const row of expectedRows) {
    const renderedRow = surface.locator(`[data-ui-node-id='${row.node_id}']`);
    await renderedRow.waitFor({ timeout: 45_000 });
    for (const control of row.controls) {
      const renderedControl = renderedRow.locator(`[data-ui-node-id='${control.node_id}']`);
      await renderedControl.waitFor({ timeout: 45_000 });
      const actionId = await renderedControl.getAttribute("data-action-id");
      if (actionId !== "contract.action") {
        throw new Error(
          `contract.sessions rendered action mismatch for ${control.node_id}: ${JSON.stringify({ actionId, control })}`
        );
      }
      const renderedLabel = (await renderedControl.textContent())?.trim() ?? "";
      if (renderedLabel !== control.label) {
        throw new Error(
          `contract.sessions rendered label mismatch for ${control.node_id}: ${JSON.stringify({ expected: control.label, actual: renderedLabel })}`
        );
      }
    }
  }
}

async function activateContractSessionControl(page, expectedControl, activation) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const control = surface.locator(`[data-ui-node-id='${expectedControl.node_id}']`);
  const actionId = await control.getAttribute("data-action-id");
  const nodeId = await control.getAttribute("data-ui-node-id");
  const sinceIndex = await harnessEventCount(page);

  if (activation === "keyboard") {
    const keyboardTarget = control.locator("button").first();
    await keyboardTarget.focus();
    await keyboardTarget.press("Enter");
  } else {
    await control.click();
  }

  await page.waitForFunction(
    ({ sinceIndex, packageName, actionId, nodeId, actionPayload }) => {
      const events = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(sinceIndex);
      const requests = events.filter((entry) => {
        const request = entry.payload?.request;
        return entry.kind === "daemon_request" &&
          entry.payload?.type === "plugin_surface_action" &&
          entry.payload?.package_name === packageName &&
          request?.surface_id === "contract.sessions" &&
          request?.action_id === actionId &&
          request?.node_id === nodeId &&
          JSON.stringify(request?.payload) === JSON.stringify(actionPayload);
      });
      const acceptedResult = events.some((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload?.payload ?? {};
        const result = payload.result ?? {};
        const plugin = result.plugin_action_result ?? {};
        return payload.accepted === true &&
          result.package_name === packageName &&
          result.surface_id === "contract.sessions" &&
          result.action_id === actionId &&
          plugin.state === "accepted" &&
          plugin.action_id === actionId &&
          plugin.node_id === nodeId &&
          JSON.stringify(plugin.payload) === JSON.stringify(actionPayload);
      });
      return requests.length === 1 && acceptedResult;
    },
    {
      sinceIndex,
      packageName: contractMatrixPackageName,
      actionId,
      nodeId,
      actionPayload: expectedControl.action_payload
    },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observed = await page.evaluate((since) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(since),
    sinceIndex);
    throw new Error(
      `contract.sessions ${activation} dispatch did not correlate one rendered request/result for ${nodeId}: ${JSON.stringify(observed, null, 2)}: ${error.message}`
    );
  });
}

async function openContractAppFromNavigation(page) {
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "list_package_navigation" },
    "list_package_navigation request"
  );
  await page.waitForFunction(
    ({ packageName }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const daemonNavigation = events
        .filter((entry) => entry.kind === "daemon_response" && entry.payload?.kind === "package_navigation")
        .flatMap((entry) => entry.payload.package_navigation ?? []);
      const projectedNavigation = events
        .filter(
          (entry) =>
            entry.kind === "hub_frame" &&
            entry.payload?.kind === "entity_snapshot" &&
            entry.payload.payload?.family === "botster-web.package_navigation"
        )
        .flatMap((entry) => entry.payload.payload.records ?? []);
      return daemonNavigation.some(
        (entry) => entry.package_name === packageName && entry.item_id === "contract.app"
      ) && projectedNavigation.some(
        (entry) =>
          entry.package_name === packageName &&
          entry.item_id === "contract.app" &&
          entry.route_path === `/packages/${packageName}/surfaces/contract.app`
      );
    },
    { packageName: contractMatrixPackageName },
    { timeout: 45_000 }
  );
  const shortcut = page
    .getByLabel("Admitted plugin navigation")
    .getByRole("button", { name: "Contract App", exact: true });
  await shortcut.waitFor({ timeout: 15_000 });
  await shortcut.click();
}

async function openContractAppFromApps(page) {
  const installed = installedList(page);
  const row = installed.getByText(/Contract App|plugin contract matrix|botster\.plugin-contract-matrix/i).first();
  await row.waitFor({ timeout: 15_000 }).catch(async (error) => {
    const installedText = await installed.innerText().catch(() => "");
    throw new Error(
      `timed out waiting for contract matrix app/package row; installed=${JSON.stringify(installedText)}: ${error.message}`
    );
  });
  await row.click();
}

function contractSurfaceRoutePath(surfaceId) {
  return `/packages/${contractMatrixPackageName}/surfaces/${surfaceId}`;
}

function escapedRoutePathPattern(routePath) {
  return routePath.replaceAll(".", "\\.").replaceAll("/", "\\/");
}

async function navigateToContractSurface(page, surfaceId) {
  await page.goto(new URL(contractSurfaceRoutePath(surfaceId), appUrl).toString(), {
    waitUntil: "domcontentloaded"
  });
}

async function assertContractSurfaceRoute(page, surfaceId, visibleText, sinceIndex = 0) {
  await page.waitForURL(new RegExp(escapedRoutePathPattern(contractSurfaceRoutePath(surfaceId))), { timeout: 15_000 });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: contractMatrixPackageName, surface_id: surfaceId },
    `${surfaceId} plugin_surface_render request`,
    sinceIndex
  );
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).waitFor({ timeout: 15_000 });
  await page.getByText(visibleText).waitFor({ timeout: 45_000 });
  await assertSelectedSurfaceNotLoading(page, surfaceId);
}

async function assertContractSurfaceRouteReloadAndDirectLoad(page, surfaceId, visibleText) {
  const routePath = contractSurfaceRoutePath(surfaceId);
  const routeUrl = new URL(routePath, appUrl).toString();

  await page.waitForURL(new RegExp(escapedRoutePathPattern(routePath)), { timeout: 15_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertContractSurfaceRoute(page, surfaceId, visibleText);

  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await assertContractSurfaceRoute(page, surfaceId, visibleText);
}

async function assertContractSurfaceRouteReconnect(page, surfaceId, visibleText) {
  const criteria = {
    type: "plugin_surface_render",
    package_name: contractMatrixPackageName,
    surface_id: surfaceId
  };
  const expectedUrl = page.url();
  const previousGrantId = await latestLocalWebrtcGrantId(page);
  const previousSubscriptionId = await latestSessionEntitySubscriptionId(page);
  const priorGenerationRenderCount = await daemonRequestCount(page, criteria);

  const reconnect = await navigatePackageRuntimeAndAssertWebrtc(
    page,
    {
      inspectDiagnostics: false,
      label: `${surfaceId} selected route reconnect`,
      mode: "reload-current-route"
    },
    previousGrantId,
    previousSubscriptionId
  );
  if (reconnect.beforeUrl !== expectedUrl || reconnect.afterUrl !== expectedUrl) {
    throw new Error(`selected contract route changed across reconnect: ${JSON.stringify({ expectedUrl, reconnect })}`);
  }
  await assertContractSurfaceRoute(page, surfaceId, visibleText);
  const renderCount = await daemonRequestCount(page, criteria);
  if (renderCount !== 1) {
    throw new Error(
      `${surfaceId} reconnect expected exactly one new plugin_surface_render: ` +
      `${JSON.stringify({ priorGenerationRenderCount, renderCount, reconnect })}`
    );
  }
}

async function assertSelectedSurfaceNotLoading(page, surfaceId) {
  await page.waitForFunction(
    ({ testId }) => {
      const text = globalThis.document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
      return !/Loading package surfaces from the hub|Rendering plugin surface from the hub|Rendering Contract/i.test(text);
    },
    { testId: HOST_CHROME.selectedAppSurfaceTestId },
    { timeout: 45_000 }
  ).catch(async (error) => {
    const selectedText = await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).innerText().catch(() => "");
    throw new Error(`${surfaceId} remained in a loading/rendering state; text=${JSON.stringify(selectedText)}: ${error.message}`);
  });
}

async function assertContractBlockedSurface(page) {
  await page.waitForURL(new RegExp(escapedRoutePathPattern(contractSurfaceRoutePath("contract.blocked"))), { timeout: 15_000 });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: contractMatrixPackageName, surface_id: "contract.blocked" },
    "contract.blocked plugin_surface_render request"
  );
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).waitFor({ timeout: 15_000 });
  await waitForVisibleContractMatrixText(
    page,
    ["contract matrix blocked render", "Plugin surface render was rejected", "Hub action failed"],
    "contract.blocked deterministic rejection text"
  );
  await assertSelectedSurfaceNotLoading(page, "contract.blocked");
}

async function assertDaemonResponsiveAfterBlockedSurface(page) {
  await revisitPackageRuntime(page);
  await openAppsView(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "list_packages" },
    "post-blocked-surface list_packages request"
  );
}

async function exerciseContractMatrixSettings(page) {
  const endpoint = "https://example.invalid/contract-matrix-web-smoke";
  await openPackageSettings(page, contractMatrixPackageName);
  await page.waitForURL(new RegExp(`/apps/${contractMatrixPackageName.replaceAll(".", "\\.")}/settings`));
  await page.getByTestId(HOST_CHROME.pluginSettingsRouteTestId).getByText(HOST_CHROME.packageConfigurationLabel, { exact: true }).waitFor();
  await page.getByText("Endpoint").waitFor();
  await page.getByText("Mode").waitFor();
  await page.getByText("API token").waitFor();
  await page.getByTestId(HOST_CHROME.pluginSettingsRouteTestId).getByText("Contract Settings", { exact: true }).click();
  await page.waitForURL(new RegExp(`/apps/${contractMatrixPackageName.replaceAll(".", "\\.")}/settings/contract\\.settings`));
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: contractMatrixPackageName, surface_id: "contract.settings" },
    "contract.settings plugin_surface_render request"
  );
  await assertContractSettingsSummary(page, [
    `endpoint=${contractMatrixSeedEndpoint} mode=write api_token_state=redacted`,
    "endpoint=https://example.invalid/plugin-contract-matrix mode=read api_token_state="
  ]);
  await assertRawSecretNotVisible(page);

  await openPackageSettings(page, contractMatrixPackageName);
  await page.locator("ion-input[data-configuration-field='endpoint'] input").fill(endpoint);
  await setIonicSelectValue(page, "mode", "write");
  await page.locator("ion-input[data-configuration-field='api_token'] input").fill("contract-matrix-secret");
  const configActionResultCountBeforeSave = await packageConfigurationActionResultCount(page, contractMatrixPackageName);
  await page.locator("[data-testid='package-configuration-save']").click();
  await waitForPackageConfigurationRequest(page, {
    packageName: contractMatrixPackageName,
    values: {
      endpoint: { type: "url", value: endpoint },
      mode: { type: "select", value: "write" },
      api_token: { type: "secret", state: "write_only" }
    }
  });
  await waitForPackageConfigurationActionResultCount(page, contractMatrixPackageName, true, configActionResultCountBeforeSave + 1);
  await waitForPackageEffectiveConfiguration(page, contractMatrixPackageName, {
    endpoint: { type: "url", value: endpoint },
    mode: { type: "select", value: "write" },
    api_token: { type: "secret", state: "redacted" }
  });

  await openPackageSettings(page, contractMatrixPackageName);
  const requestCountBeforeInvalidSave = await daemonRequestCount(page, { type: "set_package_configuration" });
  await setIonicSelectValue(page, "mode", "invalid-mode");
  await page.locator("[data-testid='package-configuration-save']").click();
  await waitForDaemonRequestCount(
    page,
    { type: "set_package_configuration" },
    requestCountBeforeInvalidSave + 1,
    "contract matrix invalid package configuration save request"
  );
  await waitForPackageConfigurationRequest(page, {
    packageName: contractMatrixPackageName,
    values: {
      mode: { type: "select", value: "invalid-mode" }
    }
  });
  await closePackageSettingsRoute(page);
  await openDiagnosticsView(page);
  await page.getByText(/select_option_unknown|invalid-mode/).first().waitFor({ timeout: 15_000 });
}

async function exerciseContractMatrixActions(page) {
  await navigateToContractSurface(page, "contract.app");
  await assertContractSurfaceRoute(page, "contract.app", "plugin_surface_render");
  await page.getByRole("button", { name: "Toggle contract state" }).click();
  await page.getByText("Contract toggle active", { exact: true }).waitFor({ timeout: 15_000 });

  await page.getByRole("button", { name: "Open contract dialog" }).click();
  await waitForHarnessEvent(
    page,
    {
      kind: "daemon_request",
      type: "plugin_surface_action",
      package_name: contractMatrixPackageName,
      surface_id: "contract.app",
      action_id: "contract.action"
    },
    "contract.action open plugin_surface_action request"
  );
  await waitForContractActionResult(
    page,
    {
      accepted: true,
      expectedStates: ["accepted"],
      expectedPresentationKinds: ["set"],
      label: "contract.action accepted presentation set result"
    }
  );
  await page.locator("[data-ui-node-id='contract-dialog']").waitFor({ timeout: 15_000 });
  await page.getByText("Workspace alpha selected", { exact: true }).waitFor({ timeout: 15_000 });

  const form = page.locator("form[data-ui-node-id='contract-app-form']");
  const input = form.locator("[data-ui-node-id='contract-app-message'] input");
  const submit = form.locator(":scope > ion-button[data-action-id='contract.action']:not([data-ui-node-id])");
  await input.fill("   ");
  await submit.click();
  await waitForHarnessEvent(
    page,
    {
      kind: "daemon_request",
      type: "plugin_surface_action",
      package_name: contractMatrixPackageName,
      surface_id: "contract.app",
      action_id: "contract.action"
    },
    "contract.action rejected form plugin_surface_action request"
  );
  await waitForContractActionResult(
    page,
    {
      accepted: false,
      expectedStates: ["rejected"],
      expectedTexts: ["message is required", "Message is required"],
      label: "contract.action rejected form result"
    }
  );
  await page.locator("[data-ui-node-id='contract-dialog']").waitFor({ timeout: 15_000 });
  await form.locator("[data-ui-node-id='contract-app-message'] .uinode-field-error").getByText("Message is required", { exact: true }).waitFor({ timeout: 15_000 });
  await form.locator(".uinode-form-error").getByText("Message is required", { exact: true }).waitFor({ timeout: 15_000 });
  await input.waitFor({ state: "visible" });
  if (await input.inputValue() !== "   ") {
    throw new Error("rejected contract action discarded the typed form draft");
  }

  await input.fill("Ship canonical values");
  await submit.click();
  await waitForPluginSurfaceRequest(page, {
    packageName: contractMatrixPackageName,
    surfaceId: "contract.app",
    actionId: "contract.action",
    nodeId: "contract-app-form",
    values: { message: "Ship canonical values" },
    payload: { operation: "submit" }
  });
  await waitForContractActionResult(
    page,
    {
      accepted: true,
      expectedStates: ["accepted"],
      expectedPresentationKinds: ["clear"],
      expectedTexts: ["Ship canonical values", "contract action accepted"],
      label: "contract.action accepted replacement and clear result"
    }
  );
  await page.getByText("Contract action accepted", { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !globalThis.document.querySelector("[data-ui-node-id='contract-dialog']"), null, { timeout: 15_000 });
}

async function waitForPluginSurfaceRequest(page, { packageName, surfaceId, actionId, nodeId, values, payload }) {
  await page.waitForFunction(
    (expected) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).some((entry) => {
      const request = entry.payload?.request;
      return entry.kind === "daemon_request" &&
        entry.payload?.type === "plugin_surface_action" &&
        entry.payload?.package_name === expected.packageName &&
        request?.surface_id === expected.surfaceId &&
        request?.action_id === expected.actionId &&
        request?.node_id === expected.nodeId &&
        request?.kind === "submit" &&
        JSON.stringify(request?.values) === JSON.stringify(expected.values) &&
        JSON.stringify(request?.payload) === JSON.stringify(expected.payload);
    }),
    { packageName, surfaceId, actionId, nodeId, values, payload },
    { timeout: 15_000 }
  );
}

async function exerciseEntityOptionsReactive(page) {
  const packageName = entityOptionsPackageName;
  const surfaceId = "entity-options-reactive.picker";
  const itemFamily = "entity-options-reactive.item";
  const excludeFamily = "entity-options-reactive.exclude";

  await page.goto(new URL(`/packages/${packageName}/surfaces/${surfaceId}`, appUrl).toString(), {
    waitUntil: "domcontentloaded"
  });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: packageName, surface_id: surfaceId },
    "entity-options plugin_surface_render request"
  );
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).waitFor({ timeout: 30_000 });
  await page.locator("[data-ui-node-id='entity-options-select']").waitFor({ timeout: 30_000 });

  // Demand path must subscribe both source and exclude families (held subscribe_entities).
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: itemFamily },
    "entity-options source family subscribe_entities"
  );
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: excludeFamily },
    "entity-options exclude family subscribe_entities"
  );

  const select = page.locator("[data-ui-node-id='entity-options-select'] ion-select");
  await page.waitForFunction(() => {
    const options = [...globalThis.document.querySelectorAll("[data-ui-node-id='entity-options-select'] ion-select-option")];
    return options.some((option) => (option.value ?? option.getAttribute("value")) === "opt-alpha");
  }, undefined, { timeout: 30_000 }).catch((error) => {
    throw new Error(`entity-options options never projected from snapshots: ${error.message}`);
  });

  const initialOptions = await readUiNodeSelectOptionValues(select);
  if (!initialOptions.includes("opt-alpha") || !initialOptions.includes("opt-bravo")) {
    throw new Error(`entity-options missing expected options: ${JSON.stringify(initialOptions)}`);
  }

  // Select a concrete option value in the real Ionic control.
  await setUiNodeSelectValue(select, "opt-alpha");

  // While the form remains open, remove that value via package action + held-subscribe reconnect.
  const openEventsBeforeRemove = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open").length
  );
  await page.locator("[data-action-id='entity-options.remove']").click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_action", package_name: packageName, surface_id: surfaceId },
    "entity-options.remove plugin_surface_action request"
  );

  const closed = await page.evaluate(
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.closeDataChannel?.() ?? false
  );
  if (!closed) {
    throw new Error("entity-options live proof could not close the live WebRTC data channel for resubscribe");
  }
  await page.waitForFunction(
    ({ before }) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open").length > before,
    { before: openEventsBeforeRemove },
    { timeout: 20_000 }
  ).catch((error) => {
    throw new Error(`entity-options reconnect never reopened the data channel: ${error.message}`);
  });

  // Fresh snapshot must drop opt-alpha and mark the draft selection invalid without surface re-render.
  await page.waitForFunction(() => {
    const form = globalThis.document.querySelector("[data-ui-node-id='entity-options-form']");
    const field = globalThis.document.querySelector("[data-ui-node-id='entity-options-select']");
    return form?.getAttribute("data-form-invalid") === "true"
      || field?.getAttribute("data-selection-invalid") === "true"
      || !!globalThis.document.querySelector("[data-testid='entity-options-invalid']");
  }, undefined, { timeout: 30_000 }).catch((error) => {
    throw new Error(`entity-options invalid selection UI never appeared after remove+reconnect: ${error.message}`);
  });

  const optionsAfterRemove = await readUiNodeSelectOptionValues(select);
  if (optionsAfterRemove.includes("opt-alpha")) {
    throw new Error(`entity-options still lists removed value: ${JSON.stringify(optionsAfterRemove)}`);
  }

  // Stale submit must not produce a successful plugin_surface_action with the dead value.
  // Normal rendered click only — no force:true (ticket_1786518263_839128).
  const eventsBeforeStale = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).length
  );
  const clickSeqBeforeEntityOptions = await page.evaluate(() =>
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.formSubmitClickSeq ?? 0
  );
  const staleSubmitButton = page.locator("[data-action-id='entity-options.submit']");
  await staleSubmitButton.click({ timeout: 3_000 }).catch(() => {});
  await page.evaluate(() => new Promise((resolve) => {
    queueMicrotask(() => queueMicrotask(resolve));
  }));
  const entityOptionsClick = await page.waitForFunction(({ before }) => {
    const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    const attempt = harness?.lastFormSubmitClick;
    if (
      attempt
      && attempt.seq > before
      && attempt.actionId === "entity-options.submit"
      && (attempt.phase === "dispatched" || attempt.phase === "blocked_disabled" || attempt.phase === "blocked_invalid")
    ) {
      return attempt;
    }
    const form = globalThis.document.querySelector("[data-ui-node-id='entity-options-form']");
    const btn = globalThis.document.querySelector("[data-action-id='entity-options.submit']");
    const native = btn?.shadowRoot?.querySelector("button") ?? btn?.querySelector("button") ?? btn;
    const disabled = Boolean(
      btn?.hasAttribute("disabled")
      || native?.disabled
      || native?.hasAttribute?.("disabled")
    );
    const invalid = form?.getAttribute("data-form-invalid") === "true"
      || !!globalThis.document.querySelector("[data-selection-invalid='true']")
      || !!globalThis.document.querySelector("[data-testid='entity-options-invalid']");
    if (disabled && invalid) {
      return { phase: "blocked_gate", actionId: "entity-options.submit", settled: true };
    }
    return null;
  }, { before: clickSeqBeforeEntityOptions }, { timeout: 10_000 })
    .then((handle) => handle.jsonValue())
    .catch((error) => {
      throw new Error(`entity-options stale submit path never settled: ${error.message}`);
    });
  void entityOptionsClick;
  const staleSubmit = await page.evaluate(({ before, packageName }) => {
    const entries = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(before);
    return entries.filter((entry) =>
      entry.kind === "daemon_request"
      && entry.payload?.type === "plugin_surface_action"
      && entry.payload?.package_name === packageName
      && entry.payload?.request?.action_id === "entity-options.submit"
      && entry.payload?.request?.values?.option === "opt-alpha"
    );
  }, { before: eventsBeforeStale, packageName });
  if (staleSubmit.length > 0) {
    throw new Error(`entity-options dispatched stale submit with dead value: ${JSON.stringify(staleSubmit)}`);
  }

  // Choose a valid replacement and submit exact value.
  await setUiNodeSelectValue(select, "opt-charlie");
  await page.waitForFunction(() => {
    const form = globalThis.document.querySelector("[data-ui-node-id='entity-options-form']");
    return form?.getAttribute("data-form-invalid") !== "true";
  }, undefined, { timeout: 10_000 });

  const eventsBeforeValid = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).length
  );
  await page.locator("[data-action-id='entity-options.submit']").click();
  const validSubmit = await page.waitForFunction(({ before, packageName }) => {
    const entries = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(before);
    return entries.find((entry) =>
      entry.kind === "daemon_request"
      && entry.payload?.type === "plugin_surface_action"
      && entry.payload?.package_name === packageName
      && entry.payload?.request?.action_id === "entity-options.submit"
      && entry.payload?.request?.values?.option === "opt-charlie"
    ) ?? null;
  }, { before: eventsBeforeValid, packageName }, { timeout: 15_000 }).then((handle) => handle.jsonValue());

  const requestValues = validSubmit?.payload?.request?.values;
  if (requestValues?.option !== "opt-charlie") {
    throw new Error(
      `entity-options valid submit missing exact values.option=opt-charlie: ${JSON.stringify(validSubmit)}`
    );
  }

  console.log(`entity-options-live-proof ${JSON.stringify({
    package_name: packageName,
    surface_id: surfaceId,
    subscribed_families: [itemFamily, excludeFamily],
    initial_options: initialOptions,
    options_after_remove: optionsAfterRemove,
    stale_submit_blocked: true,
    submitted_value: requestValues.option
  })}`);
}

async function exercisePayloadContract(page) {
  await navigateToPayloadContractSurface(page, "payload.app");
  await page.locator("[data-ui-node-id='payload-contract-list-alpha']").click({ position: { x: 12, y: 12 } });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_action", package_name: payloadContractPackageName, surface_id: "payload.app" },
    "payload.list.activate click plugin_surface_action request"
  );
  await waitForPayloadContractActionResultCount(
    page,
    {
      actionId: "payload.list.activate",
      expectedPayload: { workspace_id: "workspace-alpha" },
      expectedCount: 1,
      label: "payload.list.activate click handler payload"
    }
  );

  await page.locator("[data-ui-node-id='payload-contract-list-alpha']").focus();
  await page.keyboard.press("Enter");
  await waitForPayloadContractActionResultCount(
    page,
    {
      actionId: "payload.list.activate",
      expectedPayload: { workspace_id: "workspace-alpha" },
      expectedCount: 2,
      label: "payload.list.activate Enter handler payload"
    }
  );

  await page.locator("[data-action-id='payload.row.open']").click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_action", package_name: payloadContractPackageName, surface_id: "payload.app" },
    "payload.row.open plugin_surface_action request"
  );
  await waitForPayloadContractActionResult(
    page,
    {
      actionId: "payload.row.open",
      expectedPayload: { workspace_id: "workspace-alpha" },
      label: "payload.row.open handler payload"
    }
  );

  await page.waitForFunction(() => {
    const table = globalThis.document.querySelector("[data-ui-node-id='payload-contract-table']");
    return table?.getAttribute("data-unsupported-interaction-props") === "activation,row_action";
  }, null, { timeout: 15_000 });
}

async function waitForContractActionResult(
  page,
  { accepted, expectedTexts = [], expectedStates = [], expectedPresentationKinds = [], label }
) {
  await page.waitForFunction(
    ({ nextAccepted, texts, states, presentationKinds }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        const pluginActionResult = result.plugin_action_result ?? {};
        if (payload.accepted !== nextAccepted) return false;
        if (result.package_name !== "botster.plugin-contract-matrix") return false;
        if (result.surface_id !== "contract.app") return false;
        if (result.action_id !== "contract.action") return false;
        const resultText = [
          payload.reason,
          pluginActionResult.message,
          pluginActionResult.error,
          pluginActionResult.payload?.message,
          pluginActionResult.payload?.error,
          pluginActionResult.normalized_values?.message,
          pluginActionResult.normalized_values?.error,
          pluginActionResult.state
        ].filter((value) => typeof value === "string").join("\n");
        const stateMatches = states.length === 0 || states.includes(pluginActionResult.state);
        const textMatches = texts.length === 0 || texts.some((text) => resultText.includes(text));
        const observedPresentationKinds = (pluginActionResult.presentation ?? []).map((operation) => operation.kind);
        const presentationMatches = presentationKinds.every((kind) => observedPresentationKinds.includes(kind));
        return stateMatches && textMatches && presentationMatches;
      });
    },
    {
      nextAccepted: accepted,
      texts: expectedTexts,
      states: expectedStates,
      presentationKinds: expectedPresentationKinds
    },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedResults = await page.evaluate(() =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "hub_frame" && entry.payload?.kind === "action_result")
        .map((entry) => entry.payload?.payload)
        .filter((payload) => payload?.result?.package_name === "botster.plugin-contract-matrix")
    );
    throw new Error(`timed out waiting for ${label}; expected=${JSON.stringify(expectedTexts)} observed=${JSON.stringify(observedResults, null, 2)}: ${error.message}`);
  });
}

async function navigateToPayloadContractSurface(page, surfaceId) {
  await page.goto(new URL(`/packages/${payloadContractPackageName}/surfaces/${surfaceId}`, appUrl).toString(), {
    waitUntil: "domcontentloaded"
  });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: payloadContractPackageName, surface_id: surfaceId },
    `${surfaceId} plugin_surface_render request`
  );
}

async function waitForPayloadContractActionResult(page, { actionId, expectedPayload, label }) {
  await page.waitForFunction(
    ({ packageName, nextActionId, nextPayload }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        const pluginActionResult = result.plugin_action_result ?? {};
        return payload.accepted === true &&
          result.package_name === packageName &&
          result.surface_id === "payload.app" &&
          result.action_id === nextActionId &&
          JSON.stringify(pluginActionResult.payload) === JSON.stringify(nextPayload);
      });
    },
    { packageName: payloadContractPackageName, nextActionId: actionId, nextPayload: expectedPayload },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedResults = await page.evaluate((packageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "hub_frame" && entry.payload?.kind === "action_result")
        .map((entry) => entry.payload?.payload)
        .filter((payload) => payload?.result?.package_name === packageName)
    , payloadContractPackageName);
    throw new Error(`timed out waiting for ${label}; expected=${JSON.stringify(expectedPayload)} observed=${JSON.stringify(observedResults, null, 2)}: ${error.message}`);
  });
}

async function waitForPayloadContractActionResultCount(page, { actionId, expectedPayload, expectedCount, label }) {
  await page.waitForFunction(
    ({ packageName, nextActionId, nextPayload, count }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const matching = events.filter((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        const pluginActionResult = result.plugin_action_result ?? {};
        return payload.accepted === true &&
          result.package_name === packageName &&
          result.surface_id === "payload.app" &&
          result.action_id === nextActionId &&
          JSON.stringify(pluginActionResult.payload) === JSON.stringify(nextPayload);
      });
      return matching.length === count;
    },
    { packageName: payloadContractPackageName, nextActionId: actionId, nextPayload: expectedPayload, count: expectedCount },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedResults = await page.evaluate((packageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "hub_frame" && entry.payload?.kind === "action_result")
        .map((entry) => entry.payload?.payload)
        .filter((payload) => payload?.result?.package_name === packageName)
    , payloadContractPackageName);
    throw new Error(`timed out waiting for ${label}; expected_count=${expectedCount} expected=${JSON.stringify(expectedPayload)} observed=${JSON.stringify(observedResults, null, 2)}: ${error.message}`);
  });
}

async function waitForVisibleContractMatrixText(page, expectedTexts, label) {
  await page.waitForFunction(
    (texts) => {
      const bodyText = globalThis.document.body?.textContent ?? "";
      return texts.some((text) => bodyText.includes(text));
    },
    expectedTexts,
    { timeout: 15_000 }
  ).catch(async (error) => {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    throw new Error(`timed out waiting for ${label}; expected=${JSON.stringify(expectedTexts)} observed=${JSON.stringify(bodyText)}: ${error.message}`);
  });
}

async function assertRawSecretNotVisible(page) {
  const secretVisible = await page.locator("body").innerText().then((text) => text.includes("contract-matrix-secret"));
  if (secretVisible) {
    throw new Error("contract matrix smoke rendered the raw api_token secret");
  }
}

async function assertPluginSurfaceRouteReloadAndDirectLoad(page, target) {
  const routeDescriptor = await pluginSurfaceRouteDescriptor(page, target);
  const fallbackPath = `/apps/${encodeURIComponent(target.packageName)}/${encodeURIComponent(target.surfaceId)}`;
  const descriptorRoute = routeDescriptor.routePath
    ? appRouteFromPathname(routeDescriptor.routePath)
    : undefined;
  const acceptedRoutePath = descriptorRoute?.view === "apps" && descriptorRoute.packageName
    ? routeDescriptor.routePath
    : fallbackPath;
  const expectedPathname = new URL(acceptedRoutePath, appUrl).pathname;

  await page.waitForURL((url) => url.pathname === expectedPathname, { timeout: 15_000 }).catch((error) => {
    throw new Error(
      `first-party app route mismatch; observed=${JSON.stringify(page.url())} expected_pathname=${JSON.stringify(expectedPathname)} descriptor=${JSON.stringify(routeDescriptor, null, 2)}: ${error.message}`
    );
  });
  const capturedUrl = page.url();
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: target.packageName, surface_id: target.surfaceId },
    "reloaded first-party app plugin_surface_render request"
  );
  await assertSelectedAppSurfaceRendered(page, target);

  await page.goto(capturedUrl, { waitUntil: "domcontentloaded" });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: target.packageName, surface_id: target.surfaceId },
    "direct-loaded first-party app plugin_surface_render request"
  );
  await assertSelectedAppSurfaceRendered(page, target);
}

async function pluginSurfaceRouteDescriptor(page, target) {
  return page.evaluate(({ packageName, surfaceId }) => {
    const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
    const daemonPackages = [];
    const projectedPackages = [];
    for (const entry of events) {
      if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
        daemonPackages.push(...(entry.payload.packages ?? []));
      }
      if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
        const payload = entry.payload.payload;
        if (payload?.family === "botster-web.package") {
          projectedPackages.push(...(payload.records ?? []));
        }
      }
    }
    const daemonPackage = daemonPackages.find((record) => record.package_name === packageName);
    const projectedPackage = projectedPackages.find((record) => record.id === packageName);
    const surfaces = projectedPackage?.app_surfaces ?? [];
    const surfaceRecord = surfaces.find((record) => record.surface_id === surfaceId);
    return {
      routePath: typeof surfaceRecord?.route_path === "string" && surfaceRecord.route_path.length > 0
        ? surfaceRecord.route_path
        : undefined,
      daemonPackage,
      projectedPackage,
      surfaceRecord
    };
  }, target);
}

async function loadProductionAppRouteFromPathname() {
  const vite = await createViteServer({
    configFile: false,
    resolve: {
      alias: {
        "@ionic/react": resolve(packageRoot, "src/botster/__fixtures__/IonicReactSsrMock.tsx")
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
    const [routingModule, hubLifecycleModule] = await Promise.all([
      vite.ssrLoadModule("/src/app/routing.ts"),
      vite.ssrLoadModule("/src/app/hubLifecycle.ts")
    ]);
    return {
      appRouteFromPathname: routingModule.appRouteFromPathname,
      entityFamilyRecordLimit: hubLifecycleModule.entityFamilyRecordLimit
    };
  } finally {
    await vite.close();
  }
}

async function assertSelectedAppSurfaceRendered(page, target) {
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).waitFor({ timeout: 15_000 });
  if (target.packageName === "botster-workspaces" && target.surfaceId === "workspaces") {
    if (sharedHubDriverMode) {
      await assertWorkspacesNodeIds(page, [
        "botster-workspaces-app",
        "botster-workspaces-toolbar",
        "botster-workspaces-list"
      ], "shared-Hub driver");
      await assertNoUnsupportedWorkspacesNodes(page);
      return;
    }
    let stage = workspacesCompatibilityProofCount === 0
      ? "initial"
      : workspacesCompatibilityProofCount === 1
        ? "reload"
        : "direct-load";
    await assertWorkspacesNodeIds(page, [
      "botster-workspaces-app",
      "botster-workspaces-toolbar",
      "botster-workspaces-list"
    ], stage);
    await assertNoUnsupportedWorkspacesNodes(page);

    if (stage === "initial") {
      const retainedState = ownsWebrtcDataDir
        ? null
        : await readRetainedWorkspacesCompatibilityWorkspace(page);
      if (retainedState) {
        stage = "initial-retained";
        workspacesCompatibilityState = retainedState;
        await assertWorkspacesCompatibilityRow(page, retainedState, stage);
      } else {
        await assertWorkspacesNodeIds(page, [
          "botster-workspaces-new",
          "botster-workspaces-empty",
          "botster-workspaces-empty-create"
        ], "initial cold start");
        workspacesCompatibilityState = await createWorkspacesCompatibilityWorkspace(page);
      }
    } else {
      if (!workspacesCompatibilityState) {
        throw new Error(`Workspaces ${stage} proof has no persisted workspace identity`);
      }
      await assertWorkspacesCompatibilityRow(page, workspacesCompatibilityState, stage);
    }

    await assertNoUnsupportedWorkspacesNodes(page);
    workspacesCompatibilityProofCount += 1;
    console.log(
      `Workspaces compatibility ${stage} proof passed ${JSON.stringify(workspacesCompatibilityState)}`
    );
    return;
  }

  await page.waitForFunction(
    ({ packageName, surfaceId, testId }) => {
      const text = globalThis.document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
      const expectedRoute = packageName && surfaceId ? `${packageName}/${surfaceId}` : "";
      return /project-pipelines|botster-workspaces|Pipelines|Workspaces|botster-web|Production/i.test(text) &&
        /rendered|\//i.test(text) &&
        !/Render response did not include/i.test(text) &&
        (!expectedRoute || text.includes(expectedRoute));
    },
    { ...target, testId: HOST_CHROME.selectedAppSurfaceTestId },
    { timeout: 45_000 }
  ).catch(async (error) => {
    const selectedText = await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).innerText().catch(() => "");
    throw new Error(`selected app surface did not render visible first-party content; text=${JSON.stringify(selectedText)}: ${error.message}`);
  });
}

async function assertWorkspacesNodeIds(page, expectedNodeIds, stage) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  await Promise.all(
    expectedNodeIds.map((nodeId) =>
      surface.locator(`[data-ui-node-id='${nodeId}']`).waitFor({ timeout: 45_000 })
    )
  ).catch(async (error) => {
    const selectedText = await surface.innerText().catch(() => "");
    throw new Error(
      `Workspaces ${stage} surface omitted plugin-owned UiNodes; expected=${JSON.stringify(expectedNodeIds)} text=${JSON.stringify(selectedText)}: ${error.message}`
    );
  });
}

async function assertNoUnsupportedWorkspacesNodes(page) {
  const unsupportedNodes = page.locator(
    `[data-testid="${HOST_CHROME.selectedAppSurfaceTestId}"] [data-unsupported-primitive], [data-testid="${HOST_CHROME.selectedAppSurfaceTestId}"] [data-missing-capability]`
  );
  if (await unsupportedNodes.count() > 0) {
    throw new Error(
      `Workspaces surface rendered unsupported UiNodes: ${JSON.stringify(await unsupportedNodes.allTextContents())}`
    );
  }
}

async function exerciseSharedHubWorkspaces(page, assignment) {
  await openAppsView(page);
  await openFirstPartyUiAppSurface(page, "webrtc");
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const baselineCounts = await sharedHubRequestCounts(page);
  const renderedNodeIds = await surface.locator("[data-ui-node-id]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-ui-node-id")).filter(Boolean)
  );
  const createControlId = chooseCreateControl(assignment.entry_state, renderedNodeIds);
  const observedPrior = assignment.observe
    ? await observeSharedHubPriorState(page, assignment.observe)
    : null;
  const workspace = await createSharedHubWorkspace(page, assignment.workspace_name, createControlId);
  const cases = [];
  for (const spawnCase of assignment.cases) {
    cases.push(await driveSharedHubSpawnCase(page, workspace, spawnCase, baselineCounts));
  }
  const finalCounts = await sharedHubRequestCounts(page);
  assertReconciliationCounts(baselineCounts, finalCounts);
  return {
    kind: "workspaces_shared_hub_browser",
    generation: assignment.generation,
    entry_state: assignment.entry_state,
    create_control: createControlId,
    assignment_digest: assignmentDigest(assignment),
    observed_prior: observedPrior,
    workspace,
    cases,
    case_count: assignment.cases.length,
    request_counts: { before: baselineCounts, after: finalCounts },
    lifecycle_reconciliation: cases.every((entry) =>
      entry.reconciliation.request_counts_unchanged && entry.session.lifecycle === "ended"
    ),
    binary_provenance: binaryProvenance,
    app_url: appUrl,
    completed: true
  };
}

async function observeSharedHubPriorState(page, expected) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const workspaceTitle = surface.getByText(expected.workspace_name, { exact: true }).first();
  await workspaceTitle.waitFor({ timeout: 20_000 });
  const workspaceNodeId = await workspaceTitle.evaluate((node) =>
    node.closest("ion-item[data-ui-node-id]")?.getAttribute("data-ui-node-id") ?? null
  );
  if (!workspaceNodeId) throw new Error("retained workspace title did not materialize inside a realized list row");
  await selectSharedHubWorkspace(page, {
    workspace_id: expected.workspace_id,
    rendered_row_node_id: workspaceNodeId
  });
  const record = await waitForExactSessionLifecycle(page, expected.session_id, expected.lifecycle);
  const rendered = await waitForRenderedSessionLifecycle(page, expected.session_id, expected.lifecycle);
  return {
    workspace_id: expected.workspace_id,
    workspace_node_id: workspaceNodeId,
    workspace_name: expected.workspace_name,
    session_id: expected.session_id,
    lifecycle: record.lifecycle_class,
    rendered_node_id: rendered.node_id,
    rendered_region_id: rendered.region_id
  };
}

async function createSharedHubWorkspace(page, workspaceName, createControlId) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const openButton = surface.locator(`[data-ui-node-id='${createControlId}']`);
  await openButton.waitFor({ timeout: 15_000 });
  const openActionId = await openButton.getAttribute("data-action-id");
  const openNodeId = await openButton.getAttribute("data-ui-node-id");
  if (!openActionId || !openNodeId) throw new Error("rendered workspace create control omitted action metadata");
  const openSince = await harnessEventCount(page);
  await openButton.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    kind: "submit",
    payload: { dialog: "create" },
    sinceIndex: openSince,
    label: "shared-Hub rendered create-dialog action"
  });
  await waitForWorkspacesActionResult(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    presentation: { kind: "set", key: "workspace-dialog", value: "create" },
    sinceIndex: openSince,
    label: "shared-Hub accepted create-dialog presentation"
  });

  const form = page.locator("form[data-ui-node-id='botster-workspaces-create-form']");
  await form.waitFor({ timeout: 15_000 });
  await form.locator("[data-ui-node-id='botster-workspaces-create-name'] input").fill(workspaceName);
  const submit = form.locator(":scope > ion-button[data-action-id]");
  const actionId = await submit.getAttribute("data-action-id");
  const nodeId = await form.getAttribute("data-ui-node-id");
  const sinceIndex = await harnessEventCount(page);
  await submit.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId,
    nodeId,
    kind: "submit",
    values: { name: workspaceName },
    sinceIndex,
    label: "shared-Hub renderer-collected create values"
  });
  await waitForWorkspacesActionResult(page, {
    actionId,
    nodeId,
    presentation: { kind: "clear", key: "workspace-dialog" },
    normalizedName: workspaceName,
    replacementRootId: "botster-workspaces-app",
    sinceIndex,
    label: "shared-Hub accepted create result"
  });
  const result = await latestWorkspacesActionResult(page, sinceIndex, actionId, nodeId);
  const workspaceId = result.plugin_action_result?.payload?.workspace?.id;
  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    throw new Error(`workspace create result omitted structured identity: ${JSON.stringify(result)}`);
  }
  const title = surface.getByText(workspaceName, { exact: true }).first();
  await title.waitFor({ timeout: 15_000 });
  const rowNodeId = await title.evaluate((node) =>
    node.closest("ion-item[data-ui-node-id]")?.getAttribute("data-ui-node-id") ?? null
  );
  if (!rowNodeId) throw new Error("created workspace title did not materialize inside a realized list row");
  return {
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    rendered_row_node_id: rowNodeId,
    create_request_id: result.request_id
  };
}

async function driveSharedHubSpawnCase(page, workspace, spawnCase, baselineCounts) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  await selectSharedHubWorkspace(page, workspace);
  const spawnButtons = surface.locator(WORKSPACES_SPAWN_OPENER_SELECTOR);
  await spawnButtons.first().waitFor({ timeout: 15_000 }).catch(async (error) => {
    throw new Error(
      `${spawnCase.case_id} did not render a semantic Spawn opener; ` +
      `candidates=${JSON.stringify(await renderedActionDiagnostics(surface))}: ${error.message}`
    );
  });
  const spawnButtonCount = await spawnButtons.count();
  if (spawnButtonCount !== 1) {
    throw new Error(
      `${spawnCase.case_id} expected one semantic Spawn opener; count=${spawnButtonCount} ` +
      `candidates=${JSON.stringify(await renderedActionDiagnostics(surface))}`
    );
  }
  const spawnButton = spawnButtons.first();
  const openActionId = await spawnButton.getAttribute("data-action-id");
  const openNodeId = await spawnButton.getAttribute("data-ui-node-id");
  if (!openNodeId) {
    throw new Error(`${spawnCase.case_id} semantic Spawn opener omitted rendered node identity`);
  }
  const openPayload = {
    selected_workspace: workspace.workspace_id,
    dialog: `spawn-target:${workspace.workspace_id}`
  };
  const openSince = await harnessEventCount(page);
  await spawnButton.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    kind: "submit",
    payload: openPayload,
    sinceIndex: openSince,
    label: `${spawnCase.case_id} rendered semantic Spawn action`
  });
  await waitForWorkspacesActionResult(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    presentation: { kind: "set", key: "workspace-dialog", value: `spawn-target:${workspace.workspace_id}` },
    sinceIndex: openSince,
    label: `${spawnCase.case_id} accepted target-first presentation`
  });
  const openRequest = await latestWorkspacesActionRequest(page, openSince, openActionId, openNodeId);
  const openResult = await latestWorkspacesActionResult(page, openSince, openActionId, openNodeId);
  if (!openRequest || !openResult) {
    throw new Error(`${spawnCase.case_id} semantic Spawn opener omitted captured request/result evidence`);
  }

  const targetForm = page.locator("ion-modal.show-modal form:has([data-ui-node-id='botster-workspaces-spawn-target'])").first();
  await targetForm.waitFor({ timeout: 15_000 });
  await setUiNodeSelectValue(targetForm.locator("[data-ui-node-id='botster-workspaces-spawn-target'] ion-select"), spawnCase.target_id);
  const targetSubmitMetadata = targetForm.locator(":scope > ion-button[data-action-id]");
  const targetActionId = await targetSubmitMetadata.getAttribute("data-action-id");
  const targetNodeId = await targetForm.getAttribute("data-ui-node-id");
  const targetSince = await harnessEventCount(page);
  await targetSubmitMetadata.evaluate((button) => button.click());
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: targetActionId,
    nodeId: targetNodeId,
    kind: "submit",
    values: { workspace_id: workspace.workspace_id, target_id: spawnCase.target_id },
    sinceIndex: targetSince,
    label: `${spawnCase.case_id} target-first form request`
  });
  await waitForWorkspacesActionResult(page, {
    actionId: targetActionId,
    nodeId: targetNodeId,
    presentation: { kind: "set", key: "workspace-dialog", value: `spawn:${workspace.workspace_id}:${spawnCase.target_id}` },
    replacementRootId: "botster-workspaces-app",
    sinceIndex: targetSince,
    label: `${spawnCase.case_id} accepted target selection`
  });

  const spawnForm = page.locator("ion-modal.show-modal form:has([data-ui-node-id='botster-workspaces-spawn-branch'])").first();
  await spawnForm.waitFor({ timeout: 15_000 });
  await spawnForm.locator("[data-ui-node-id='botster-workspaces-spawn-branch'] input").fill(spawnCase.branch);
  const sessionTypeSelect = spawnForm.locator("[data-ui-node-id='botster-workspaces-spawn-template'] ion-select");
  // Observe what Hub and Workspaces actually published BEFORE injecting anything.
  // setUiNodeSelectValue assigns select.value without checking membership, so a value
  // that exists among the rendered options is only provable upstream of the injection.
  const renderedSessionTypeOptions = await readUiNodeSelectOptionValues(sessionTypeSelect);
  if (!renderedSessionTypeOptions.includes(spawnCase.session_type_id)) {
    throw new Error(
      `${spawnCase.case_id} session_type_id ${JSON.stringify(spawnCase.session_type_id)} is not among the ` +
      `rendered Workspaces session-type options; rendered=${JSON.stringify(renderedSessionTypeOptions)}`
    );
  }
  await setUiNodeSelectValue(sessionTypeSelect, spawnCase.session_type_id);
  if (spawnCase.prompt) await spawnForm.locator("[data-ui-node-id='botster-workspaces-spawn-prompt'] input").fill(spawnCase.prompt);
  if (spawnCase.ticket_id) await spawnForm.locator("[data-ui-node-id='botster-workspaces-spawn-ticket'] input").fill(spawnCase.ticket_id);
  const submitMetadata = spawnForm.locator(":scope > ion-button[data-action-id]");
  const actionId = await submitMetadata.getAttribute("data-action-id");
  const nodeId = await spawnForm.getAttribute("data-ui-node-id");
  const sinceIndex = await harnessEventCount(page);
  await submitMetadata.evaluate((button) => button.click());
  // Correlate the submitted request by rendered action/node identity and sequence
  // position only. Passing the expected values map here would make it the admission
  // predicate, so the session_type_id check below would be a selection criterion rather
  // than an assertion that can fail against live output.
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId,
    nodeId,
    kind: "submit",
    sinceIndex,
    label: `${spawnCase.case_id} renderer-collected Spawn request`
  });
  await waitForWorkspacesActionResult(page, {
    actionId,
    nodeId,
    presentation: { kind: "clear", key: "workspace-dialog" },
    replacementRootId: "botster-workspaces-app",
    sinceIndex,
    label: `${spawnCase.case_id} accepted Spawn result`
  });
  const result = await latestWorkspacesActionResult(page, sinceIndex, actionId, nodeId);
  const request = await latestWorkspacesActionRequest(page, sinceIndex, actionId, nodeId);
  const submission = assertSharedHubSpawnSubmission(spawnCase, workspace, request);
  if (submission.request_id !== result.request_id) {
    throw new Error(
      `${spawnCase.case_id} submit request_id ${submission.request_id} did not correlate with the ` +
      `accepted action result request_id ${result.request_id}`
    );
  }
  const payload = result.plugin_action_result?.payload;
  const sessionId = payload?.session_id;
  const hubResult = payload?.hub_result;
  if (typeof sessionId !== "string" || !hubResult || hubResult.session_id !== sessionId) {
    throw new Error(`${spawnCase.case_id} Spawn result omitted correlated Hub/session identity: ${JSON.stringify(result)}`);
  }
  assertSharedHubSpawnResult(spawnCase, hubResult);
  await waitForExactSessionLifecycle(page, sessionId, "current");
  const currentRendered = await waitForRenderedSessionLifecycle(page, sessionId, "current");
  const terminalRecord = await waitForExactSessionLifecycle(page, sessionId, "ended");
  const terminalRendered = await waitForRenderedSessionLifecycle(page, sessionId, "ended");
  const finalCounts = await sharedHubRequestCounts(page);
  const reconciliation = assertReconciliationCounts(baselineCounts, finalCounts);
  const accepted = result.accepted === true && result.plugin_action_result?.state === "accepted";
  return {
    case_id: spawnCase.case_id,
    spawn_opener: {
      dom: { node_id: openNodeId, action_id: openActionId },
      request: {
        node_id: openRequest.request?.node_id,
        action_id: openRequest.request?.action_id,
        payload: openRequest.request?.payload
      },
      result: {
        accepted: openResult.accepted === true,
        request_id: openResult.request_id,
        state: openResult.plugin_action_result?.state,
        node_id: openResult.plugin_action_result?.node_id,
        action_id: openResult.plugin_action_result?.action_id
      }
    },
    rendered: {
      package_name: "botster-workspaces",
      surface_id: "workspaces",
      node_id: nodeId,
      action_id: actionId,
      session_type_options: renderedSessionTypeOptions,
      selected_session_type_id: spawnCase.session_type_id
    },
    submitted_values: request.request?.values,
    action_request: {
      request_id: request.request?.request_id,
      result_request_id: result.request_id,
      node_id: request.request?.node_id,
      action_id: request.request?.action_id
    },
    action_result: { accepted, request_id: result.request_id, state: result.plugin_action_result?.state },
    workspace: { workspace_id: workspace.workspace_id, rendered_row_node_id: workspace.rendered_row_node_id },
    session: {
      session_id: sessionId,
      lifecycle: terminalRecord.lifecycle_class,
      current_rendered_node_id: currentRendered.node_id,
      terminal_rendered_node_id: terminalRendered.node_id,
      terminal_region_id: terminalRendered.region_id
    },
    hub_result: hubResult,
    reconciliation
  };
}

async function renderedActionDiagnostics(surface) {
  return surface.locator("ion-button[data-action-id]").evaluateAll((buttons) =>
    buttons.slice(0, 10).map((button) => ({
      action_id: button.getAttribute("data-action-id"),
      node_id: button.getAttribute("data-ui-node-id")
    }))
  );
}

async function selectSharedHubWorkspace(page, workspace) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const row = surface.locator(`[data-ui-node-id='${workspace.rendered_row_node_id}']`);
  const action = row.locator("ion-button[data-action-id]");
  await action.waitFor({ timeout: 15_000 });
  const actionId = await action.getAttribute("data-action-id");
  const nodeId = await row.getAttribute("data-ui-node-id");
  const sinceIndex = await harnessEventCount(page);
  await action.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId, nodeId, kind: "submit", sinceIndex,
    label: "shared-Hub rendered workspace selection"
  });
  await waitForWorkspacesActionResult(page, {
    actionId, nodeId,
    presentation: { kind: "set", key: "selected-workspace", value: workspace.workspace_id },
    sinceIndex,
    label: "shared-Hub accepted workspace selection"
  });
}

// Reads the option values Workspaces actually published, from the rendered
// ion-select-option elements the UiNode renderer emits.
async function readUiNodeSelectOptionValues(locator) {
  return locator.locator("ion-select-option").evaluateAll((options) =>
    options.map((option) => option.value ?? option.getAttribute("value"))
  );
}

async function setUiNodeSelectValue(locator, value) {
  await locator.evaluate((select, nextValue) => {
    select.value = nextValue;
    select.dispatchEvent(new CustomEvent("ionChange", { bubbles: true, detail: { value: nextValue } }));
  }, value);
}

async function latestWorkspacesActionResult(page, sinceIndex, actionId, nodeId) {
  return page.evaluate(({ sinceIndex, actionId, nodeId }) => {
    const entries = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(sinceIndex);
    for (const entry of entries) {
      const payload = entry.payload?.payload;
      const plugin = payload?.result?.plugin_action_result;
      if (entry.kind === "hub_frame" && entry.payload?.kind === "action_result" &&
          payload?.result?.package_name === "botster-workspaces" &&
          payload?.result?.surface_id === "workspaces" &&
          plugin?.action_id === actionId && plugin?.node_id === nodeId) {
        return { ...payload, plugin_action_result: plugin };
      }
    }
    return null;
  }, { sinceIndex, actionId, nodeId });
}

async function latestWorkspacesActionRequest(page, sinceIndex, actionId, nodeId) {
  return page.evaluate(({ sinceIndex, actionId, nodeId }) =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(sinceIndex).find((entry) =>
      entry.kind === "daemon_request" && entry.payload?.type === "plugin_surface_action" &&
      entry.payload?.request?.action_id === actionId && entry.payload?.request?.node_id === nodeId
    )?.payload ?? null,
  { sinceIndex, actionId, nodeId });
}

async function waitForExactSessionLifecycle(page, sessionId, lifecycleClass) {
  await page.waitForFunction(({ sessionId, lifecycleClass }) => {
    const records = new Map();
    for (const entry of globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []) {
      if (entry.kind !== "hub_frame") continue;
      const frame = entry.payload ?? {};
      const payload = frame.payload ?? {};
      if ((payload.family ?? payload.key?.family) !== "session") continue;
      if (frame.kind === "entity_snapshot") {
        records.clear();
        for (const record of payload.records ?? []) records.set(record.session_uuid ?? record.session_id ?? record.id, record);
      } else {
        const id = payload.key?.id ?? payload.record?.session_uuid ?? payload.record?.session_id ?? payload.record?.id;
        if (!id) continue;
        if (frame.kind === "entity_remove") records.delete(id);
        else records.set(id, { ...(records.get(id) ?? {}), ...(payload.record ?? payload.patch ?? {}) });
      }
    }
    return records.get(sessionId)?.lifecycle_class === lifecycleClass;
  }, { sessionId, lifecycleClass }, { timeout: 30_000 });
  const events = await page.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []);
  return convergeEntityFamily(events, "session").records.find((record) =>
    (record.session_uuid ?? record.session_id ?? record.id) === sessionId
  );
}

async function waitForRenderedSessionLifecycle(page, sessionId, lifecycleClass) {
  const exactText = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).getByText(sessionId, { exact: true });
  await exactText.waitFor({ timeout: 30_000 });
  await page.waitForFunction(({ sessionId, lifecycleClass, testId }) => {
    const nodes = [...globalThis.document.querySelectorAll(`[data-testid="${testId}"] [data-ui-node-id]`)];
    return nodes.some((node) => {
      if (node.textContent?.trim() !== sessionId) return false;
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const classes = [...(ancestor.getAttribute("data-ui-node-id") ?? "")
          .matchAll(/-sessions-(current|ended|unavailable)-/g)]
          .map((match) => match[1]);
        if (classes.length === 1 && classes[0] === lifecycleClass) return true;
      }
      return false;
    });
  }, { sessionId, lifecycleClass, testId: HOST_CHROME.selectedAppSurfaceTestId }, { timeout: 30_000 });
  const rendered = await exactText.evaluate((node) => {
    const ancestors = [];
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const id = ancestor.getAttribute("data-ui-node-id");
      if (id) ancestors.push({ id, text: ancestor.textContent ?? "" });
    }
    return {
      node_id: node.closest("[data-ui-node-id]")?.getAttribute("data-ui-node-id") ?? null,
      ancestors
    };
  });
  const region = workspacesLifecycleRegion(rendered.ancestors, lifecycleClass);
  if (!region) {
    throw new Error(`session ${sessionId} did not resolve to one ${lifecycleClass} lifecycle region`);
  }
  return { node_id: rendered.node_id, region_id: region.id };
}

async function sharedHubRequestCounts(page) {
  return {
    plugin_surface_render: await daemonRequestCount(page, { type: "plugin_surface_render" }),
    list_sessions: await daemonRequestCount(page, { type: "list_sessions" })
  };
}

async function createWorkspacesCompatibilityWorkspace(page) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const openButton = surface.locator("[data-ui-node-id='botster-workspaces-empty-create']");
  const openActionId = await openButton.getAttribute("data-action-id");
  if (openActionId !== "botster_workspaces.open") {
    throw new Error(
      `Workspaces empty-create rendered unexpected action id ${JSON.stringify(openActionId)}`
    );
  }

  const openEventCount = await harnessEventCount(page);
  await openButton.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: openActionId,
    nodeId: "botster-workspaces-empty-create",
    kind: "submit",
    payload: { dialog: "create" },
    sinceIndex: openEventCount,
    label: "Workspaces empty-create rendered action request"
  });
  await waitForWorkspacesActionResult(page, {
    actionId: openActionId,
    nodeId: "botster-workspaces-empty-create",
    presentation: { kind: "set", key: "workspace-dialog", value: "create" },
    sinceIndex: openEventCount,
    label: "Workspaces accepted create-dialog presentation set"
  });

  const form = page.locator("form[data-ui-node-id='botster-workspaces-create-form']");
  await form.waitFor({ timeout: 15_000 });
  const input = form.locator("[data-ui-node-id='botster-workspaces-create-name'] input");
  const submit = form.locator(
    ":scope > ion-button[data-action-id='botster_workspaces.create']:not([data-ui-node-id])"
  );
  const workspaceName = `Named slot smoke ${process.pid}-${Date.now()}`;
  await input.fill(workspaceName);

  const createEventCount = await harnessEventCount(page);
  await submit.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: "botster_workspaces.create",
    nodeId: "botster-workspaces-create-form",
    kind: "submit",
    values: { name: workspaceName },
    sinceIndex: createEventCount,
    label: "Workspaces create form worker-visible values"
  });
  await waitForWorkspacesActionResult(page, {
    actionId: "botster_workspaces.create",
    nodeId: "botster-workspaces-create-form",
    presentation: { kind: "clear", key: "workspace-dialog" },
    normalizedName: workspaceName,
    replacementRootId: "botster-workspaces-app",
    sinceIndex: createEventCount,
    label: "Workspaces accepted create replacement and presentation clear"
  });
  await page.waitForFunction(
    () => !globalThis.document.querySelector("[data-ui-node-id='botster-workspaces-create-form']"),
    null,
    { timeout: 15_000 }
  );

  const row = surface.locator(
    "ion-item.uinode-list-item[data-ui-node-id^='botster-workspaces-row-']"
  );
  await row.waitFor({ timeout: 15_000 });
  const rowCount = await row.count();
  if (rowCount !== 1) {
    throw new Error(`Workspaces fresh create expected one rendered row; count=${rowCount}`);
  }
  const rowNodeId = await row.getAttribute("data-ui-node-id");
  const workspaceId = rowNodeId?.slice("botster-workspaces-row-".length);
  if (!workspaceId || rowNodeId !== `botster-workspaces-row-${workspaceId}`) {
    throw new Error(`Workspaces create returned an invalid row identity ${JSON.stringify(rowNodeId)}`);
  }
  const state = { workspaceId, workspaceName };
  await assertWorkspacesCompatibilityRow(page, state, "initial replacement");
  return state;
}

async function readRetainedWorkspacesCompatibilityWorkspace(page) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const rows = surface.locator(
    "ion-item.uinode-list-item[data-ui-node-id^='botster-workspaces-row-']"
  );
  const rowCount = await rows.count();
  if (rowCount === 0) return null;
  if (rowCount !== 1) {
    throw new Error(`caller-owned Workspaces proof expected one retained workspace; count=${rowCount}`);
  }
  const row = rows.first();
  const rowNodeId = await row.getAttribute("data-ui-node-id");
  const workspaceId = rowNodeId?.slice("botster-workspaces-row-".length);
  if (!workspaceId || rowNodeId !== `botster-workspaces-row-${workspaceId}`) {
    throw new Error(`caller-owned Workspaces proof found invalid retained row ${JSON.stringify(rowNodeId)}`);
  }
  const titles = row.locator("[data-ui-node-id^='botster-workspaces-row-title-']");
  if (await titles.count() !== 1) {
    throw new Error(`caller-owned Workspaces retained row ${workspaceId} omitted one title slot`);
  }
  const workspaceName = (await titles.first().innerText()).trim();
  if (!workspaceName) {
    throw new Error(`caller-owned Workspaces retained row ${workspaceId} had an empty title`);
  }
  return { workspaceId, workspaceName };
}

async function waitForWorkspacesPluginSurfaceRequest(
  page,
  { actionId, nodeId, kind, values, payload, sinceIndex, label }
) {
  await page.waitForFunction(
    (expected) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(expected.sinceIndex)
      .some((entry) => {
        const request = entry.payload?.request;
        if (
          entry.kind !== "daemon_request" ||
          entry.payload?.type !== "plugin_surface_action" ||
          entry.payload?.package_name !== "botster-workspaces" ||
          request?.surface_id !== "workspaces" ||
          request?.action_id !== expected.actionId ||
          request?.node_id !== expected.nodeId ||
          request?.kind !== expected.kind
        ) return false;
        const stableJson = (value) => JSON.stringify(value, (_key, nested) =>
          nested && typeof nested === "object" && !Array.isArray(nested)
            ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)))
            : nested
        );
        if (expected.values !== undefined && stableJson(request.values) !== stableJson(expected.values)) return false;
        return expected.payload === undefined || stableJson(request.payload) === stableJson(expected.payload);
      }),
    { actionId, nodeId, kind, values, payload, sinceIndex },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observed = await page.evaluate((start) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .slice(start)
        .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "plugin_surface_action")
        .map((entry) => entry.payload),
      sinceIndex
    );
    const message = `${label} not observed; events=${JSON.stringify(observed, null, 2)}: ${error.message}`;
    throw workspacesLifecycleMode ? lifecycleOracleError(message) : new Error(message);
  });
  // Return the exact observed request_id so action_result oracles correlate 1:1.
  const matched = await page.evaluate((expected) => {
    const stableJson = (value) => JSON.stringify(value, (_key, nested) =>
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)))
        : nested
    );
    const entry = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(expected.sinceIndex)
      .find((candidate) => {
        const request = candidate.payload?.request;
        if (
          candidate.kind !== "daemon_request" ||
          candidate.payload?.type !== "plugin_surface_action" ||
          candidate.payload?.package_name !== "botster-workspaces" ||
          request?.surface_id !== "workspaces" ||
          request?.action_id !== expected.actionId ||
          request?.node_id !== expected.nodeId ||
          request?.kind !== expected.kind
        ) return false;
        if (expected.values !== undefined && stableJson(request.values) !== stableJson(expected.values)) return false;
        return expected.payload === undefined || stableJson(request.payload) === stableJson(expected.payload);
      });
    const request = entry?.payload?.request ?? {};
    return {
      requestId: request.request_id ?? null,
      request
    };
  }, { actionId, nodeId, kind, values, payload, sinceIndex });
  if (!matched?.requestId) {
    throw new Error(`${label} matched without request_id: ${JSON.stringify(matched)}`);
  }
  return matched;
}

async function waitForWorkspacesActionResult(
  page,
  { actionId, nodeId, presentation, normalizedName, replacementRootId, sinceIndex, label, requestId }
) {
  await page.waitForFunction(
    (expected) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(expected.sinceIndex)
      .some((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        const pluginActionResult = result.plugin_action_result ?? {};
        if (
          payload.accepted !== true ||
          result.package_name !== "botster-workspaces" ||
          result.surface_id !== "workspaces" ||
          result.action_id !== expected.actionId ||
          pluginActionResult.state !== "accepted" ||
          pluginActionResult.action_id !== expected.actionId ||
          pluginActionResult.node_id !== expected.nodeId ||
          !pluginActionResult.request_id ||
          pluginActionResult.request_id !== payload.request_id
        ) return false;
        if (expected.requestId && pluginActionResult.request_id !== expected.requestId) return false;
        if (expected.presentation) {
          const presentationMatches = (pluginActionResult.presentation ?? []).some((operation) =>
            operation.kind === expected.presentation.kind &&
            operation.key === expected.presentation.key &&
            (
              !Object.hasOwn(expected.presentation, "value") ||
              operation.value === expected.presentation.value
            )
          );
          if (!presentationMatches) return false;
        }
        if (
          expected.normalizedName !== undefined &&
          pluginActionResult.normalized_values?.name !== expected.normalizedName
        ) return false;
        return expected.replacementRootId === undefined ||
          pluginActionResult.replacement?.id === expected.replacementRootId;
      }),
    { actionId, nodeId, presentation, normalizedName, replacementRootId, sinceIndex, requestId },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observed = await page.evaluate((start) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .slice(start)
        .filter((entry) => entry.kind === "hub_frame" && entry.payload?.kind === "action_result")
        .map((entry) => entry.payload?.payload)
        .filter((payload) => payload?.result?.package_name === "botster-workspaces"),
      sinceIndex
    );
    throw new Error(`${label} not observed; results=${JSON.stringify(observed, null, 2)}: ${error.message}`);
  });
}

async function assertWorkspacesCompatibilityRow(page, state, stage, expectedSessionCount = 0) {
  const expectedNodeIds = [
    `botster-workspaces-row-${state.workspaceId}`,
    `botster-workspaces-row-title-${state.workspaceId}`,
    `botster-workspaces-row-count-${state.workspaceId}`
  ];
  await assertWorkspacesNodeIds(page, expectedNodeIds, stage);
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const titleText = await surface
    .locator(`[data-ui-node-id='botster-workspaces-row-title-${state.workspaceId}']`)
    .innerText();
  const metaText = await surface
    .locator(`[data-ui-node-id='botster-workspaces-row-count-${state.workspaceId}']`)
    .innerText();
  const expectedMeta = `${expectedSessionCount} sessions`;
  if (titleText.trim() !== state.workspaceName || metaText.trim() !== expectedMeta) {
    throw new Error(
      `Workspaces ${stage} row slot text mismatch; title=${JSON.stringify(titleText)} ` +
      `meta=${JSON.stringify(metaText)} expected_meta=${JSON.stringify(expectedMeta)}`
    );
  }
}

async function exerciseWorkspacesLifecycle(page) {
  if (!workspacesCompatibilityState) {
    throw new Error("Workspaces lifecycle mode requires the production create/route proof first");
  }
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  const scenario = {
    transitions: Array.from({ length: 4 }, () => randomUUID()),
    stableEnded: Array.from({ length: 4 }, () => randomUUID()),
    removals: Array.from({ length: 4 }, () => randomUUID()),
    neverExisting: Array.from({ length: 4 }, () => randomUUID())
  };
  const allReferences = Object.values(scenario).flat();
  const cohortByReference = new Map(Object.entries(scenario).flatMap(([cohort, referenceIds]) =>
    referenceIds.map((referenceId) => [referenceId, cohort])
  ));
  const stageExpectations = (partition) => {
    const result = workspacesLifecyclePartitionExpectations(partition);
    return {
      expectations: result.expectations.map((expectation) => ({
        ...expectation,
        oracle: `${cohortByReference.get(expectation.referenceId)}-${expectation.lifecycleClass}-reference`
      })),
      absentExpectations: result.absentExpectations.map((expectation) => ({
        ...expectation,
        oracle: `${cohortByReference.get(expectation.referenceId)}-not-${expectation.lifecycleClass}-reference`
      }))
    };
  };
  const initialPartition = {
    current: scenario.transitions,
    ended: [...scenario.stableEnded, ...scenario.removals],
    unavailable: scenario.neverExisting
  };
  const transitionedPartition = {
    current: [],
    ended: [...scenario.transitions, ...scenario.stableEnded, ...scenario.removals],
    unavailable: scenario.neverExisting
  };
  const removedPartition = {
    current: [],
    ended: [...scenario.transitions, ...scenario.stableEnded],
    unavailable: [...scenario.removals, ...scenario.neverExisting]
  };

  for (const sessionId of [...scenario.transitions, ...scenario.stableEnded, ...scenario.removals]) {
    const response = await sendDaemonRequest(socketPath, {
      type: "spawn",
      session_id: sessionId,
      command: "sleep 300"
    });
    if (response.error) {
      throw new Error(`Workspaces lifecycle seed spawn failed for ${sessionId}: ${JSON.stringify(response.error)}`);
    }
    await waitForHarnessEvent(page, {
      kind: "hub_frame",
      family: "session",
      id: sessionId,
      lifecycle_class: "current"
    }, `Workspaces lifecycle current seed ${sessionId}`);
  }
  for (const sessionId of [...scenario.stableEnded, ...scenario.removals]) {
    const response = await sendDaemonRequest(socketPath, {
      type: "shutdown_session",
      session_id: sessionId
    });
    if (response.error) {
      throw new Error(`Workspaces lifecycle seed shutdown failed for ${sessionId}: ${JSON.stringify(response.error)}`);
    }
    await waitForHarnessEvent(page, {
      kind: "hub_frame",
      family: "session",
      id: sessionId,
      lifecycle_class: "ended"
    }, `Workspaces lifecycle ended seed ${sessionId}`);
  }

  await selectWorkspacesLifecycleWorkspace(page, workspacesCompatibilityState);
  await exerciseWorkspacesEntityOptionsMembershipReactive(
    page,
    browser,
    workspacesCompatibilityState,
    socketPath
  );
  const historicalReferences = new Set(scenario.neverExisting);
  for (const sessionId of allReferences) {
    await addWorkspacesLifecycleReference(page, workspacesCompatibilityState, sessionId, {
      historical: historicalReferences.has(sessionId)
    });
  }

  const initial = await assertWorkspacesLifecycleOracles(page, {
    stage: "initial-owner-surface",
    ...stageExpectations(initialPartition)
  });
  const renderCountBeforeTransition = initial.requestCounts.plugin_surface_render;
  const listCountBeforeTransition = initial.requestCounts.list_sessions;

  for (const sessionId of scenario.transitions) {
    const transitionResponse = await sendDaemonRequest(socketPath, {
      type: "shutdown_session",
      session_id: sessionId
    });
    if (transitionResponse.error) {
      throw new Error(
        `Workspaces lifecycle transition shutdown failed for ${sessionId}: ${JSON.stringify(transitionResponse.error)}`
      );
    }
    await waitForHarnessEvent(page, {
      kind: "hub_frame",
      family: "session",
      id: sessionId,
      lifecycle_class: "ended"
    }, `Workspaces lifecycle current-to-ended entity transition ${sessionId}`);
  }
  const transitioned = await assertWorkspacesLifecycleOracles(page, {
    stage: "current-to-ended-without-refresh",
    ...stageExpectations(transitionedPartition),
    priorEvidence: initial
  });
  assertLifecycleRequestCountsUnchanged(
    transitioned.requestCounts,
    renderCountBeforeTransition,
    listCountBeforeTransition,
    "current-to-ended"
  );

  for (const sessionId of scenario.removals) {
    const removeResponse = await sendDaemonRequest(socketPath, {
      type: "remove_session",
      session_id: sessionId
    });
    if (removeResponse.error) {
      throw new Error(
        `Workspaces lifecycle canonical remove failed for ${sessionId}: ${JSON.stringify(removeResponse.error)}`
      );
    }
    await waitForHarnessEvent(page, {
      kind: "hub_frame",
      frameKind: "entity_remove",
      family: "session",
      id: sessionId
    }, `Workspaces lifecycle canonical entity removal ${sessionId}`);
  }
  const removed = await assertWorkspacesLifecycleOracles(page, {
    stage: "removed-reference",
    ...stageExpectations(removedPartition),
    priorEvidence: transitioned
  });
  assertLifecycleRequestCountsUnchanged(
    removed.requestCounts,
    renderCountBeforeTransition,
    listCountBeforeTransition,
    "entity-remove"
  );

  const previousGrantId = await latestLocalWebrtcGrantId(page);
  const previousSubscriptionId = await latestSessionEntitySubscriptionId(page);
  const selectedRouteUrl = page.url();
  const renderCriteria = {
    type: "plugin_surface_render",
    package_name: "botster-workspaces",
    surface_id: "workspaces"
  };
  const priorGenerationRenderCount = await daemonRequestCount(page, renderCriteria);
  const reconnect = await navigatePackageRuntimeAndAssertWebrtc(
    page,
    {
      inspectDiagnostics: false,
      label: "workspaces lifecycle selected route reconnect",
      mode: "reload-current-route"
    },
    previousGrantId,
    previousSubscriptionId
  );
  if (reconnect.beforeUrl !== selectedRouteUrl || reconnect.afterUrl !== selectedRouteUrl) {
    throw new Error(`Workspaces selected route changed across reconnect: ${JSON.stringify({ selectedRouteUrl, reconnect })}`);
  }
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId).waitFor({ timeout: 15_000 });
  await assertWorkspacesNodeIds(page, [
    "botster-workspaces-app",
    "botster-workspaces-toolbar",
    "botster-workspaces-list"
  ], "lifecycle reconnect");
  await assertNoUnsupportedWorkspacesNodes(page);
  await assertWorkspacesCompatibilityRow(
    page,
    workspacesCompatibilityState,
    "lifecycle reconnect",
    allReferences.length
  );
  const reconnectedRenderCount = await daemonRequestCount(page, renderCriteria);
  if (reconnectedRenderCount !== 1) {
    throw new Error(
      `Workspaces reconnect expected exactly one new selected surface pull: ` +
      `${JSON.stringify({ priorGenerationRenderCount, reconnectedRenderCount, reconnect })}`
    );
  }
  await selectWorkspacesLifecycleWorkspace(page, workspacesCompatibilityState);
  const reconnected = await assertWorkspacesLifecycleOracles(page, {
    stage: "reconnect-authoritative-history",
    ...stageExpectations(removedPartition),
    priorEvidence: [initial, removed]
  });
  const reconnectEvidence = reconnectGenerationEvidence(reconnected.events, previousSubscriptionId);
  if (!reconnectEvidence.fresh || !reconnectEvidence.authoritativeSnapshot) {
    throw lifecycleOracleError(formatWorkspacesLifecycleFailure({
      ...reconnected,
      stage: "reconnect-generation",
      oracle: "fresh-subscription-authoritative-snapshot",
      classifications: reconnected.classifications,
      requestCounts: { ...reconnected.requestCounts, reconnect: reconnectEvidence }
    }));
  }
  for (const sessionId of scenario.transitions) {
    assertStableLifecycleIdentity(transitioned, reconnected, sessionId, "ended");
  }
  for (const sessionId of scenario.stableEnded) {
    assertStableLifecycleIdentity(initial, reconnected, sessionId, "ended");
  }
  for (const sessionId of scenario.removals) {
    assertStableLifecycleIdentity(removed, reconnected, sessionId, "unavailable");
  }
  for (const sessionId of scenario.neverExisting) {
    assertStableLifecycleIdentity(initial, reconnected, sessionId, "unavailable");
  }
  console.log(`Workspaces lifecycle acceptance passed ${JSON.stringify({
    scenario,
    partitions: {
      initial: observedWorkspacesLifecyclePartition(initial.classifications),
      transitioned: observedWorkspacesLifecyclePartition(transitioned.classifications),
      removed: observedWorkspacesLifecyclePartition(removed.classifications),
      reconnected: observedWorkspacesLifecyclePartition(reconnected.classifications)
    },
    reconnect,
    reconnectEvidence
  })}`);
}

async function selectWorkspacesLifecycleWorkspace(page, state) {
  const row = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId)
    .locator(`[data-ui-node-id='botster-workspaces-row-${state.workspaceId}']`);
  await row.waitFor({ timeout: 15_000 });
  const openButton = row.locator("ion-button[data-action-id]");
  await openButton.waitFor({ timeout: 15_000 });
  const actionId = await openButton.getAttribute("data-action-id");
  const sinceIndex = await harnessEventCount(page);
  await openButton.click();
  await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId,
    nodeId: `botster-workspaces-row-${state.workspaceId}`,
    kind: "submit",
    payload: { selected_workspace: state.workspaceId },
    sinceIndex,
    label: "Workspaces rendered workspace selection request"
  });
  await waitForWorkspacesActionResult(page, {
    actionId,
    nodeId: `botster-workspaces-row-${state.workspaceId}`,
    presentation: { kind: "set", key: "selected-workspace", value: state.workspaceId },
    sinceIndex,
    label: "Workspaces accepted workspace selection"
  });
  await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId)
    .getByRole("button", { name: "Add existing session", exact: true })
    .waitFor({ timeout: 15_000 });
}

async function openWorkspacesAddSessionDialog(page, state, labelSuffix) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const openButton = surface
    .locator("ion-button[data-action-id='botster_workspaces.open']")
    .filter({ hasText: "Add existing session" });
  const openActionId = await openButton.getAttribute("data-action-id");
  const openNodeId = await openButton.getAttribute("data-ui-node-id");
  const openEventCount = await harnessEventCount(page);
  await openButton.click();
  const openRequest = await waitForWorkspacesPluginSurfaceRequest(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    kind: "submit",
    sinceIndex: openEventCount,
    label: `Workspaces Add-session presentation request for ${labelSuffix}`
  });
  await waitForWorkspacesActionResult(page, {
    actionId: openActionId,
    nodeId: openNodeId,
    presentation: { kind: "set", key: "workspace-dialog", value: `add:${state.workspaceId}` },
    sinceIndex: openEventCount,
    requestId: openRequest.requestId,
    label: `Workspaces accepted Add-session dialog for ${labelSuffix}`
  });
  const form = page.locator(`form[data-ui-node-id='botster-workspaces-add-form-${state.workspaceId}']`);
  await form.waitFor({ timeout: 15_000 });
  return form;
}

async function waitForWorkspacesAddSessionOption(page, state, sessionId, timeoutMs = 30_000) {
  const select = page.locator(
    `form[data-ui-node-id='botster-workspaces-add-form-${state.workspaceId}'] ` +
    "[data-ui-node-id='botster-workspaces-add-session-id'] ion-select"
  );
  await select.waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    ({ formId, expected }) => {
      const options = [...globalThis.document.querySelectorAll(
        `form[data-ui-node-id='${formId}'] [data-ui-node-id='botster-workspaces-add-session-id'] ion-select-option`
      )];
      return options.some((option) => (option.value ?? option.getAttribute("value")) === expected);
    },
    { formId: `botster-workspaces-add-form-${state.workspaceId}`, expected: sessionId },
    { timeout: timeoutMs }
  ).catch(async (error) => {
    const options = await readUiNodeSelectOptionValues(select);
    throw new Error(
      `Workspaces Available sessions never projected ${sessionId}; options=${JSON.stringify(options)}: ${error.message}`
    );
  });
  return select;
}

/**
 * Prefer the entity_options Available sessions select when the Hub session is projected.
 * Use Historical session UUID only with explicit historical intent (neverExisting cohort).
 * Never fill the hidden IonSelect aux input.
 */
async function chooseWorkspacesAddSessionControl(page, form, sessionId, { historical = false } = {}) {
  const select = form.locator("[data-ui-node-id='botster-workspaces-add-session-id'] ion-select");
  await select.waitFor({ timeout: 15_000 });
  const formId = await form.getAttribute("data-ui-node-id");

  if (historical) {
    // Explicit historical absence only — do not treat a short option timeout as absence.
    await page.waitForTimeout(1_000);
    const options = await readUiNodeSelectOptionValues(select);
    if (options.includes(sessionId)) {
      throw new Error(
        `Workspaces historical Add expected ${sessionId} absent from entity_options; rendered=${JSON.stringify(options)}`
      );
    }
    const advanced = form.locator("[data-ui-node-id='botster-workspaces-add-session-id-advanced'] input");
    await advanced.waitFor({ timeout: 15_000 });
    await advanced.fill(sessionId);
    return { path: "historical_advanced", options };
  }

  await page.waitForFunction(
    ({ nextFormId, expected }) => {
      const options = [...globalThis.document.querySelectorAll(
        `form[data-ui-node-id='${nextFormId}'] [data-ui-node-id='botster-workspaces-add-session-id'] ion-select-option`
      )];
      return options.some((option) => (option.value ?? option.getAttribute("value")) === expected);
    },
    { nextFormId: formId, expected: sessionId },
    { timeout: 30_000 }
  ).catch(async (error) => {
    const options = await readUiNodeSelectOptionValues(select);
    throw new Error(
      `Workspaces Add requires entity_options option ${sessionId}; rendered=${JSON.stringify(options)}: ${error.message}`
    );
  });
  await setUiNodeSelectValue(select, sessionId);
  return { path: "entity_options_select", options: await readUiNodeSelectOptionValues(select) };
}

async function submitWorkspacesAddSession(page, form, state, sessionId, label) {
  const formNodeId = await form.getAttribute("data-ui-node-id");
  const submit = form.locator(":scope > ion-button[data-action-id='botster_workspaces.add_session']");
  const eventCount = await harnessEventCount(page);
  await submit.click();
  // Prefer exact session_id; advanced historical claims may only send session_id_advanced.
  // Draft may also carry empty optional fields — require identity fields, not exact object equality.
  const matched = await page.waitForFunction(
    ({ sinceIndex, nodeId, workspaceId, sessionId: expectedSession }) => {
      const entry = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(sinceIndex).find((candidate) => {
        const request = candidate.payload?.request;
        if (
          candidate.kind !== "daemon_request"
          || candidate.payload?.type !== "plugin_surface_action"
          || candidate.payload?.package_name !== "botster-workspaces"
          || request?.surface_id !== "workspaces"
          || request?.action_id !== "botster_workspaces.add_session"
          || request?.node_id !== nodeId
          || request?.kind !== "submit"
        ) return false;
        const values = request.values ?? {};
        if (values.workspace_id !== workspaceId) return false;
        const resolved = values.session_id || values.session_id_advanced;
        if (resolved !== expectedSession) return false;
        if (request.payload !== undefined && request.payload?.workspace_id !== workspaceId) return false;
        return Boolean(request.request_id);
      });
      return entry?.payload?.request?.request_id ?? null;
    },
    {
      sinceIndex: eventCount,
      nodeId: formNodeId,
      workspaceId: state.workspaceId,
      sessionId
    },
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch(async (error) => {
    const observed = await page.evaluate((start) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .slice(start)
        .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "plugin_surface_action")
        .map((entry) => entry.payload),
      eventCount
    );
    throw new Error(
      `Workspaces renderer-collected Add-session form values for ${label} not observed; ` +
      `events=${JSON.stringify(observed, null, 2)}: ${error.message}`
    );
  });
  await waitForWorkspacesActionResult(page, {
    actionId: "botster_workspaces.add_session",
    nodeId: formNodeId,
    presentation: { kind: "clear", key: "workspace-dialog" },
    replacementRootId: "botster-workspaces-app",
    sinceIndex: eventCount,
    requestId: matched,
    label: `Workspaces accepted Add-session action for ${label}`
  });
  return { requestId: matched };
}

async function addWorkspacesLifecycleReference(page, state, sessionId, { historical = false } = {}) {
  const form = await openWorkspacesAddSessionDialog(page, state, sessionId);
  const choice = await chooseWorkspacesAddSessionControl(page, form, sessionId, { historical });
  await submitWorkspacesAddSession(page, form, state, sessionId, `${sessionId} via ${choice.path}`);
}

function installLiveHarnessPageHooks(targetPage) {
  return targetPage.addInitScript(() => {
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
      events: [],
      terminal: []
    };
    globalThis.window.addEventListener("botster:webrtc-daemon-lifecycle", (event) => {
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events?.push({
        kind: "webrtc_lifecycle",
        payload: event.detail
      });
    });
  });
}

async function openSecondaryWorkspacesProductionClient(state) {
  if (!browser) {
    throw new Error("Workspaces membership reactive stage requires the shared Playwright browser");
  }
  if (!appUrl) {
    throw new Error("Workspaces membership reactive stage requires the live app URL");
  }
  const secondary = await browser.newPage();
  await installLiveHarnessPageHooks(secondary);
  await secondary.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openDiagnosticsView(secondary);
  await secondary.getByText("Local Botster health").waitFor({ timeout: 30_000 });
  await waitForTransportLabel(secondary);
  await waitForHarnessEvent(secondary, { kind: "daemon_request", type: "status" }, "secondary client status request");
  await waitForHarnessEvent(secondary, { kind: "daemon_request", type: "list_apps" }, "secondary client list_apps request");
  await openAppsView(secondary);
  await openFirstPartyUiAppSurface(secondary, "webrtc");
  await selectWorkspacesLifecycleWorkspace(secondary, state);
  return secondary;
}

async function workspacesPluginSurfaceRenderCount(page) {
  return daemonRequestCount(page, {
    type: "plugin_surface_render",
    package_name: "botster-workspaces",
    surface_id: "workspaces"
  });
}

async function assertWorkspacesAddSelectionInvalid(page, state, label) {
  await page.waitForFunction(
    ({ formId }) => {
      const form = globalThis.document.querySelector(`form[data-ui-node-id='${formId}']`);
      const field = globalThis.document.querySelector(
        `form[data-ui-node-id='${formId}'] [data-ui-node-id='botster-workspaces-add-session-id']`
      );
      return form?.getAttribute("data-form-invalid") === "true"
        || field?.getAttribute("data-selection-invalid") === "true";
    },
    { formId: `botster-workspaces-add-form-${state.workspaceId}` },
    { timeout: 30_000 }
  ).catch((error) => {
    throw new Error(`${label}: invalid selection UI never appeared: ${error.message}`);
  });
}

/**
 * Workspaces-path held-open entity_options membership proof with ordered sequence_gap.
 *
 * A/B/C chronology (ticket_1786518263_839128):
 *   seed A + B + C → P1 holds Add with A selected →
 *   P2 warmup claim A (may package_entity_resync; settles dual-client floor; A is stale) →
 *   arm membership drop → P2 claim B (D1 harness-dropped) →
 *   P2 claim C (D2 triggers production sequence_gap) →
 *   replacement snapshot excludes A/B/C → force-free stale submit blocked (SPA state unchanged) →
 *   cleanup A, B, and C (production remove + hub remove + listEntities absence).
 *
 * Dual production clients: P1 holds Add dialog; P2 claims membership via normal UI only.
 * closeDataChannel remains reconnect-only and is not used as the gap trigger.
 */
async function exerciseWorkspacesEntityOptionsMembershipReactive(page, sharedBrowser, state, socketPath) {
  void sharedBrowser;
  const stage = "workspaces-entity-options-membership-reactive";
  // A = stale selection under test (warmup claim may resync P1 after dual-client floor advance).
  // B = harness-dropped delta (first ordered delta after applied floor is stable).
  // C = second real delta that triggers production sequence_gap.
  // Hub package-entity fanout: a second membership subscriber advances the provider sequence
  // without updating P1's package_last_applied_seq, so the first claim after P2 dialog open is
  // often package_entity_resync rather than an ordered delta. Warmup claim A settles that floor
  // so claim B/C can be real deltas for the drop → gap chronology.
  const sessionA = randomUUID();
  const sessionB = randomUUID();
  const sessionC = randomUUID();
  if (new Set([sessionA, sessionB, sessionC]).size !== 3) {
    throw new Error(`${stage}: seeded session ids collided`);
  }
  const seededSessions = [];
  let page2;
  let formP1;
  let selectP1;
  let renderBaseline = 0;
  let orderedGapEvidence = null;

  const seedSession = async (sessionId, label) => {
    const spawnResponse = await sendDaemonRequest(socketPath, {
      type: "spawn",
      session_id: sessionId,
      command: "sleep 300"
    });
    if (spawnResponse.error) {
      throw new Error(
        `${stage} seed spawn failed for ${label} ${sessionId}: ${JSON.stringify(spawnResponse.error)}`
      );
    }
    seededSessions.push(sessionId);
    await waitForHarnessEvent(page, {
      kind: "hub_frame",
      family: "session",
      id: sessionId,
      lifecycle_class: "current"
    }, `${stage} current seed ${label} ${sessionId}`);
  };

  const cleanupSeededSessions = async ({ page2: cleanupPage2, preferProductionRemove = true } = {}) => {
    const cleanupResults = {
      sessions_removed: [],
      membership_remove: {},
      hub_shutdown: {},
      hub_remove: {},
      membership_ids_remaining: [],
      session_ids_remaining: [],
      membership_left_cleared: false,
      sessions_absent: false
    };
    // Dismiss P1 held dialog if still open so later lifecycle stages are not blocked.
    if (formP1) {
      const stillOpen = await formP1.isVisible().catch(() => false);
      if (stillOpen) {
        await page.keyboard.press("Escape").catch(() => {});
        await formP1.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
      }
    }

    for (const sessionId of seededSessions) {
      if (preferProductionRemove && cleanupPage2 && !(typeof cleanupPage2.isClosed === "function" && cleanupPage2.isClosed())) {
        try {
          const removeButton = cleanupPage2.getByTestId(HOST_CHROME.selectedAppSurfaceTestId)
            .locator(
              `ion-button[data-action-id='botster_workspaces.remove_session'][data-ui-node-id*='${sessionId}']`
            )
            .first();
          const visible = await removeButton.isVisible().catch(() => false);
          if (visible) {
            const removeNodeId = await removeButton.getAttribute("data-ui-node-id");
            const removeSince = await harnessEventCount(cleanupPage2);
            await removeButton.click();
            const removeRequest = await waitForWorkspacesPluginSurfaceRequest(cleanupPage2, {
              actionId: "botster_workspaces.remove_session",
              nodeId: removeNodeId,
              kind: "submit",
              payload: { workspace_id: state.workspaceId, session_id: sessionId },
              sinceIndex: removeSince,
              label: `${stage} cleanup remove_session ${sessionId}`
            });
            await waitForWorkspacesActionResult(cleanupPage2, {
              actionId: "botster_workspaces.remove_session",
              nodeId: removeNodeId,
              sinceIndex: removeSince,
              requestId: removeRequest.requestId,
              label: `${stage} cleanup remove_session accepted ${sessionId}`
            });
            cleanupResults.membership_remove[sessionId] = "production_remove";
          } else {
            cleanupResults.membership_remove[sessionId] = "no_row";
          }
        } catch (error) {
          cleanupResults.membership_remove[sessionId] = `error:${error.message}`;
        }
      }

      const shutdown = await sendDaemonRequest(socketPath, {
        type: "shutdown_session",
        session_id: sessionId
      });
      cleanupResults.hub_shutdown[sessionId] = shutdown.error
        ? `error:${JSON.stringify(shutdown.error)}`
        : "ok";
      const remove = await sendDaemonRequest(socketPath, {
        type: "remove_session",
        session_id: sessionId
      });
      cleanupResults.hub_remove[sessionId] = remove.error
        ? `error:${JSON.stringify(remove.error)}`
        : "ok";
      if (!remove.error) {
        cleanupResults.sessions_removed.push(sessionId);
      }
    }

    // Fail closed on production membership remove errors (no_row is allowed when already gone).
    const membershipRemoveErrors = Object.entries(cleanupResults.membership_remove)
      .filter(([, value]) => typeof value === "string" && value.startsWith("error:"));
    if (membershipRemoveErrors.length > 0) {
      throw new Error(
        `${stage}: production membership remove failed: ${JSON.stringify(membershipRemoveErrors)}`
      );
    }

    // Authoritative membership baseline via production entity store (not session removal alone).
    // Poll briefly so late entity_remove frames apply after production remove.
    const membershipIds = await page.waitForFunction(({ ids }) => {
      const list = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.listEntities;
      if (typeof list !== "function") return null;
      const remaining = list("botster-workspaces.membership")
        .map((record) => record.id)
        .filter((id) => ids.includes(id));
      return remaining.length === 0 ? [] : null;
    }, { ids: seededSessions }, { timeout: 15_000 })
      .then((handle) => handle.jsonValue())
      .catch(async () => {
        const list = await page.evaluate(() => {
          const fn = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.listEntities;
          return typeof fn === "function" ? fn("botster-workspaces.membership").map((r) => r.id) : null;
        });
        return list;
      });
    if (!Array.isArray(membershipIds)) {
      throw new Error(`${stage}: missing live harness listEntities for membership cleanup proof`);
    }
    cleanupResults.membership_ids_remaining = membershipIds.filter((id) => seededSessions.includes(id));
    cleanupResults.membership_left_cleared = cleanupResults.membership_ids_remaining.length === 0;

    // Authoritative session absence via production entity store (not last hub_frame kind race).
    const sessionIdsLive = await page.waitForFunction(({ ids }) => {
      const list = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.listEntities;
      if (typeof list !== "function") return null;
      const remaining = list("session")
        .map((record) => record.id ?? record.session_uuid)
        .filter((id) => ids.includes(id));
      return remaining.length === 0 ? [] : null;
    }, { ids: seededSessions }, { timeout: 15_000 })
      .then((handle) => handle.jsonValue())
      .catch(async () => page.evaluate(({ ids }) => {
        const list = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.listEntities;
        if (typeof list !== "function") return null;
        return list("session")
          .map((record) => record.id ?? record.session_uuid)
          .filter((id) => ids.includes(id));
      }, { ids: seededSessions }));
    if (!Array.isArray(sessionIdsLive)) {
      throw new Error(`${stage}: missing live harness listEntities for session cleanup proof`);
    }
    cleanupResults.session_ids_remaining = sessionIdsLive;
    // Require hub remove succeeded for every seed AND store has no residual rows.
    cleanupResults.sessions_absent =
      cleanupResults.sessions_removed.length === seededSessions.length
      && cleanupResults.session_ids_remaining.length === 0;

    return cleanupResults;
  };

  try {
    await seedSession(sessionA, "A");
    await seedSession(sessionB, "B");
    await seedSession(sessionC, "C");

    formP1 = await openWorkspacesAddSessionDialog(page, state, `${stage}-hold`);
    // Entity-options demand must hold both /session and membership exclude family.
    {
      const demandDeadline = Date.now() + 45_000;
      let demandEvidence = null;
      while (Date.now() < demandDeadline) {
        demandEvidence = await page.evaluate(() => {
          const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
          const subscriptions = events
            .filter((entry) =>
              (entry.kind === "daemon_request" && entry.payload?.type === "subscribe_entities")
              || entry.kind === "webrtc_entity_subscription"
            )
            .map((entry) => ({
              kind: entry.kind,
              entity_type: entry.payload?.entity_type,
              state: entry.payload?.state,
              subscription_id: entry.payload?.subscription_id
            }));
          const membershipFrames = events
            .filter((entry) => entry.kind === "hub_frame")
            .map((entry) => {
              const frame = entry.payload ?? {};
              const body = frame.payload ?? {};
              return {
                kind: frame.kind,
                family: body.key?.family ?? body.family ?? null
              };
            })
            .filter((entry) => entry.family === "botster-workspaces.membership");
          return {
            subscriptions,
            membership_frames: membershipFrames,
            demanded: subscriptions.some((entry) => entry.entity_type === "botster-workspaces.membership"),
            framed: membershipFrames.length > 0
          };
        });
        if (demandEvidence.demanded && demandEvidence.framed) break;
        await page.waitForTimeout(150);
      }
      console.log(`${stage} membership-demand-evidence ${JSON.stringify(demandEvidence)}`);
      if (!demandEvidence?.demanded) {
        throw new Error(
          `${stage}: P1 never demanded botster-workspaces.membership; evidence=${JSON.stringify(demandEvidence)}`
        );
      }
      if (!demandEvidence?.framed) {
        throw new Error(
          `${stage}: P1 demanded membership but received no membership entity frames; evidence=${JSON.stringify(demandEvidence)}`
        );
      }
    }

    selectP1 = await waitForWorkspacesAddSessionOption(page, state, sessionA);
    // B and C must be available so drop/gap claims are real option paths.
    await waitForWorkspacesAddSessionOption(page, state, sessionB);
    await waitForWorkspacesAddSessionOption(page, state, sessionC);
    await setUiNodeSelectValue(selectP1, sessionA);
    if (!(await formP1.isVisible())) {
      throw new Error(`${stage}: P1 Add dialog closed before membership mutation`);
    }
    renderBaseline = await workspacesPluginSurfaceRenderCount(page);

    const baselineSeqEvidence = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const ready = [...events].reverse().find((entry) =>
        entry.kind === "webrtc_entity_subscription"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.state === "ready"
        && typeof entry.payload?.snapshot_seq === "number"
      );
      return {
        client_baseline_n: ready?.payload?.snapshot_seq ?? null,
        subscription_id: ready?.payload?.subscription_id ?? null,
        generation: ready?.payload?.generation ?? null
      };
    });
    console.log(`${stage} membership-baseline ${JSON.stringify(baselineSeqEvidence)}`);

    page2 = await openSecondaryWorkspacesProductionClient(state);

    // Arm immediately before the drop claim so peer_reset cannot leave us disarmed.
    const armMembershipDrop = async (label) => {
      const armResult = await page.evaluate(() => {
        const control = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl;
        if (!control || typeof control.armDropNextInboundEntityFrame !== "function") {
          return { ok: false, state: "not_armed", reason: "no_control" };
        }
        // Clear a prior armed/disarmed state so re-arm is allowed after peer_reset.
        if (typeof control.disarmDropNextInboundEntityFrame === "function") {
          control.disarmDropNextInboundEntityFrame();
        }
        return control.armDropNextInboundEntityFrame({
          entity_type: "botster-workspaces.membership"
        });
      });
      console.log(`${stage} arm-${label} ${JSON.stringify(armResult)}`);
      if (!armResult?.ok) {
        throw new Error(
          `${stage}: armDropNextInboundEntityFrame failed (${label}): ${JSON.stringify(armResult)}`
        );
      }
      return armResult;
    };

    const membershipWireEvidence = async () => page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const control = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl;
      return {
        drop_state: control?.getDropNextInboundEntityFrameState?.() ?? null,
        harness_drops: events.filter((e) => e.kind === "webrtc_entity_frame_harness_drop").slice(-5),
        assemblies: events.filter((e) => e.kind === "webrtc_entity_frame_assembly").length,
        membership_hub_frames: events.filter((entry) => {
          if (entry.kind !== "hub_frame") return false;
          const body = entry.payload?.payload ?? {};
          return (body.key?.family ?? body.family) === "botster-workspaces.membership";
        }).map((entry) => ({
          kind: entry.payload?.kind,
          id: entry.payload?.payload?.key?.id ?? entry.payload?.payload?.id ?? null
        })).slice(-10),
        discards: events.filter((e) => e.kind === "webrtc_entity_frame_discarded").slice(-8),
        membership_subs: events.filter((e) =>
          e.kind === "webrtc_entity_subscription"
          && e.payload?.entity_type === "botster-workspaces.membership"
        ).slice(-8)
      };
    });

    // Warmup claim A without arm: settles dual-client package-entity floor (often via
    // package_entity_resync) and leaves A as the held stale selection under test.
    {
      const formP2Warm = await openWorkspacesAddSessionDialog(page2, state, `${stage}-warmup-a`);
      await waitForWorkspacesAddSessionOption(page2, state, sessionA);
      await chooseWorkspacesAddSessionControl(page2, formP2Warm, sessionA);
      await submitWorkspacesAddSession(page2, formP2Warm, state, sessionA, `${stage} P2 warmup claim A`);
    }
    await page.waitForFunction(({ formId, expected }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const ready = [...events].reverse().find((entry) =>
        entry.kind === "webrtc_entity_subscription"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.state === "ready"
        && typeof entry.payload?.snapshot_seq === "number"
      );
      const options = [...globalThis.document.querySelectorAll(
        `form[data-ui-node-id='${formId}'] [data-ui-node-id='botster-workspaces-add-session-id'] ion-select-option`
      )];
      const optionGone = !options.some((option) =>
        (option.value ?? option.getAttribute("value")) === expected
      );
      return Boolean(ready && optionGone);
    }, {
      formId: `botster-workspaces-add-form-${state.workspaceId}`,
      expected: sessionA
    }, { timeout: 45_000 }).catch(async (error) => {
      const wire = await membershipWireEvidence();
      throw new Error(
        `${stage}: warmup claim A never settled P1 membership/exclusion; wire=${JSON.stringify(wire)}: ${error.message}`
      );
    });
    await assertWorkspacesAddSelectionInvalid(page, state, `${stage} after warmup claim A`);
    const activeBaseline = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const ready = [...events].reverse().find((entry) =>
        entry.kind === "webrtc_entity_subscription"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.state === "ready"
        && typeof entry.payload?.snapshot_seq === "number"
      );
      return {
        client_baseline_n: ready?.payload?.snapshot_seq ?? null,
        subscription_id: ready?.payload?.subscription_id ?? null,
        generation: ready?.payload?.generation ?? null,
        resync_reason: ready?.payload?.resync_reason ?? null
      };
    });
    console.log(`${stage} membership-baseline-after-warmup-a ${JSON.stringify({
      pre: baselineSeqEvidence,
      post: activeBaseline
    })}`);
    if (!(await formP1.isVisible())) {
      throw new Error(`${stage}: P1 Add dialog closed during warmup claim A`);
    }

    // Mutation 1 (ordered delta) — claim B; harness drops D1 before receiveEntityFrame.
    await page2.keyboard.press("Escape").catch(() => {});
    const formP2ClaimB = await openWorkspacesAddSessionDialog(page2, state, `${stage}-claim-b`);
    await waitForWorkspacesAddSessionOption(page2, state, sessionB);
    await chooseWorkspacesAddSessionControl(page2, formP2ClaimB, sessionB);
    await armMembershipDrop("pre-submit-b");
    const wireBeforeClaimB = await membershipWireEvidence();
    console.log(`${stage} wire-before-claim-b ${JSON.stringify(wireBeforeClaimB)}`);
    await submitWorkspacesAddSession(page2, formP2ClaimB, state, sessionB, `${stage} P2 claim B`);

    const harnessDrop = await page.waitForFunction(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const drop = [...events].reverse().find((entry) =>
        entry.kind === "webrtc_entity_frame_harness_drop"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.reason === "harness_armed_drop"
      );
      const state = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl
        ?.getDropNextInboundEntityFrameState?.();
      if (!drop || state?.state !== "dropped") return null;
      return {
        dropped_snapshot_seq: drop.payload.snapshot_seq,
        subscription_id: drop.payload.subscription_id,
        frame_type: drop.payload.frame_type,
        generation: drop.payload.generation,
        drop_state: state
      };
    }, undefined, { timeout: 30_000 }).then((handle) => handle.jsonValue()).catch(async (error) => {
      const wire = await membershipWireEvidence();
      throw new Error(
        `${stage}: harness never dropped claim-B membership delta; wire=${JSON.stringify(wire)}: ${error.message}`
      );
    });
    console.log(`${stage} harness-drop ${JSON.stringify(harnessDrop)}`);

    // After D1 drop alone, B must still be listed (client sequence parked at post-warmup baseline).
    {
      const optionsAfterDrop = await readUiNodeSelectOptionValues(selectP1);
      if (!optionsAfterDrop.includes(sessionB)) {
        throw new Error(
          `${stage}: option B disappeared after harness drop alone before sequence_gap; ` +
          `options=${JSON.stringify(optionsAfterDrop)}`
        );
      }
      // Stale A remains excluded from the warmup claim.
      if (optionsAfterDrop.includes(sessionA)) {
        throw new Error(
          `${stage}: option A reappeared after drop of B; options=${JSON.stringify(optionsAfterDrop)}`
        );
      }
    }

    // Mutation 2 — claim C via separate production UI path; D2 triggers sequence_gap.
    {
      await page2.keyboard.press("Escape").catch(() => {});
      const formP2c = await openWorkspacesAddSessionDialog(page2, state, `${stage}-claim-c`);
      await waitForWorkspacesAddSessionOption(page2, state, sessionC);
      await chooseWorkspacesAddSessionControl(page2, formP2c, sessionC);
      await submitWorkspacesAddSession(page2, formP2c, state, sessionC, `${stage} P2 claim C`);
    }

    orderedGapEvidence = await page.waitForFunction(({
      sessionA: staleA,
      sessionB: droppedB,
      sessionC: gapC,
      baselineN,
      droppedSeq,
      dropSubscriptionId
    }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const gapDiscard = [...events].reverse().find((entry) =>
        entry.kind === "webrtc_entity_frame_discarded"
        && entry.payload?.reason === "sequence_gap"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.subscription_id === dropSubscriptionId
      );
      if (!gapDiscard) return null;

      const gapTriggerSeq = gapDiscard.payload.rejected_snapshot_seq;
      // D2 must differ from dropped D1 and must not be client_baseline+1 alone.
      if (
        typeof gapTriggerSeq !== "number"
        || typeof droppedSeq !== "number"
        || gapTriggerSeq === droppedSeq
        || (typeof baselineN === "number" && gapTriggerSeq === baselineN + 1)
      ) {
        return null;
      }

      // Resubscribe after the gap discard: unsubscribe of the dropped subscription, then a
      // fresh membership subscribe (new subscription_id), then ready on that new id.
      const dropIndex = events.findIndex((entry) =>
        entry.kind === "webrtc_entity_frame_harness_drop"
        && entry.payload?.snapshot_seq === droppedSeq
      );
      const afterDrop = dropIndex >= 0 ? events.slice(dropIndex) : events;
      const unsubAfter = afterDrop.find((entry) =>
        entry.kind === "daemon_request"
        && entry.payload?.type === "unsubscribe_entities"
        && entry.payload?.subscription_id === dropSubscriptionId
      );
      if (!unsubAfter) return null;
      const resub = afterDrop.find((entry) =>
        entry.kind === "daemon_request"
        && entry.payload?.type === "subscribe_entities"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.subscription_id
        && entry.payload.subscription_id !== dropSubscriptionId
      );
      if (!resub) return null;
      const readyAfter = afterDrop.find((entry) =>
        entry.kind === "webrtc_entity_subscription"
        && entry.payload?.entity_type === "botster-workspaces.membership"
        && entry.payload?.state === "ready"
        && entry.payload?.subscription_id === resub.payload.subscription_id
        && typeof entry.payload?.snapshot_seq === "number"
      );
      if (!readyAfter) return null;

      const formId = [...globalThis.document.querySelectorAll("form[data-ui-node-id^='botster-workspaces-add-form-']")]
        .map((el) => el.getAttribute("data-ui-node-id"))
        .find(Boolean);
      if (!formId) return null;
      const options = [...globalThis.document.querySelectorAll(
        `form[data-ui-node-id='${formId}'] [data-ui-node-id='botster-workspaces-add-session-id'] ion-select-option`
      )].map((option) => option.value ?? option.getAttribute("value"));
      // After replacement snapshot: A (warmup), B (dropped claim), and C (gap trigger) are claimed.
      const optionAGone = !options.includes(staleA);
      const optionBGone = !options.includes(droppedB);
      const optionCGone = !options.includes(gapC);
      if (!optionAGone || !optionBGone || !optionCGone) return null;

      return {
        gap_reason: gapDiscard.payload.reason,
        gap_subscription_id: gapDiscard.payload.subscription_id,
        gap_generation: gapDiscard.payload.generation,
        gap_trigger_snapshot_seq: gapTriggerSeq,
        rejected_frame_type: gapDiscard.payload.rejected_frame_type ?? null,
        current_snapshot_seq_at_gap: gapDiscard.payload.current_snapshot_seq ?? null,
        replacement_snapshot_seq: readyAfter.payload.snapshot_seq,
        replacement_subscription_id: readyAfter.payload.subscription_id,
        client_baseline_n: baselineN,
        dropped_snapshot_seq: droppedSeq,
        option_a_excluded: true,
        option_b_excluded: true,
        option_c_excluded: true
      };
    }, {
      sessionA,
      sessionB,
      sessionC,
      baselineN: activeBaseline.client_baseline_n,
      droppedSeq: harnessDrop.dropped_snapshot_seq,
      dropSubscriptionId: harnessDrop.subscription_id
    }, { timeout: 45_000 }).then((handle) => handle.jsonValue()).catch(async (error) => {
      const diagnostics = await page.evaluate(() => {
        const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
        return {
          discards: events.filter((e) => e.kind === "webrtc_entity_frame_discarded").slice(-5),
          harness_drops: events.filter((e) => e.kind === "webrtc_entity_frame_harness_drop").slice(-3),
          membership_subs: events.filter((e) =>
            e.kind === "webrtc_entity_subscription"
            && e.payload?.entity_type === "botster-workspaces.membership"
          ).slice(-8)
        };
      });
      throw new Error(
        `${stage}: production sequence_gap resubscribe/replacement never completed after claim B; ` +
        `diag=${JSON.stringify(diagnostics)}: ${error.message}`
      );
    });

    // Correlate gap trigger: D1 harness drop + D2 rejected_snapshot_seq + replacement snapshot.
    if (
      orderedGapEvidence.dropped_snapshot_seq == null
      || orderedGapEvidence.gap_trigger_snapshot_seq == null
      || orderedGapEvidence.replacement_snapshot_seq == null
    ) {
      throw new Error(
        `${stage}: missing sequence correlation fields: ${JSON.stringify(orderedGapEvidence)}`
      );
    }
    if (orderedGapEvidence.gap_trigger_snapshot_seq === orderedGapEvidence.dropped_snapshot_seq) {
      throw new Error(
        `${stage}: gap trigger seq must differ from dropped D1 seq: ${JSON.stringify(orderedGapEvidence)}`
      );
    }
    orderedGapEvidence.stale_session_id = sessionA;
    orderedGapEvidence.dropped_session_id = sessionB;
    orderedGapEvidence.second_delta_session_id = sessionC;
    orderedGapEvidence.warmup_session_id = sessionA;
    console.log(`${stage} ordered-gap ${JSON.stringify(orderedGapEvidence)}`);

    await assertWorkspacesAddSelectionInvalid(page, state, `${stage} after sequence_gap`);
    if (!(await formP1.isVisible())) {
      throw new Error(`${stage}: P1 Add dialog was dismissed during ordered-gap proof`);
    }
    const renderAfterGap = await workspacesPluginSurfaceRenderCount(page);
    if (renderAfterGap > renderBaseline) {
      throw new Error(
        `${stage}: P1 plugin_surface_render rose during ordered-gap proof ` +
        `(baseline=${renderBaseline}, after=${renderAfterGap})`
      );
    }

    // Stale-submit negative for session A under normal controls (no force:true).
    // Ablation: BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1 restores valid control so the request oracle fails first.
    const formId = `botster-workspaces-add-form-${state.workspaceId}`;
    const addActionId = "botster_workspaces.add_session";
    const ablateStaleSubmit = process.env.BOTSTER_LIVE_ABLATE_STALE_SUBMIT === "1";
    const eventsBeforeStale = await harnessEventCount(page);
    const clickSeqBefore = await page.evaluate(() =>
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.formSubmitClickSeq ?? 0
    );
    const readActionRequestState = () => page.evaluate(() => {
      const getState = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.getActionRequestState;
      if (typeof getState !== "function") {
        return { missing: true, pending_count: null, pending_request_ids: [], recent_results: [] };
      }
      return getState();
    });
    const spaActionStateBefore = await readActionRequestState();
    if (spaActionStateBefore.missing) {
      throw new Error(`${stage}: missing live harness getActionRequestState for SPA pending/result proof`);
    }
    const outboundAddSessionIdsBefore = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events
        .filter((entry) =>
          entry.kind === "daemon_request"
          && entry.payload?.type === "plugin_surface_action"
          && entry.payload?.request?.action_id === "botster_workspaces.add_session"
        )
        .map((entry) => entry.payload?.request?.request_id)
        .filter(Boolean);
    });

    if (ablateStaleSubmit) {
      await page.evaluate(({ sessionId: expectedSession }) => {
        const apply = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.applyEntityFrame;
        if (typeof apply !== "function") {
          throw new Error("missing live harness applyEntityFrame for stale-submit ablation");
        }
        apply({
          operation: "entity_remove",
          key: { family: "botster-workspaces.membership", id: expectedSession },
          sequence: 1_000_000_000
        });
      }, { sessionId: sessionA });
      await page.waitForFunction(({ formId: id, actionId }) => {
        const formEl = globalThis.document.querySelector(`form[data-ui-node-id='${id}']`);
        const btn = formEl?.querySelector(`ion-button[data-action-id='${actionId}']`);
        if (!formEl || !btn) return false;
        const native = btn.shadowRoot?.querySelector("button") ?? btn.querySelector("button") ?? btn;
        return formEl.getAttribute("data-form-invalid") !== "true"
          && !btn.hasAttribute("disabled")
          && !native?.disabled
          && !native?.hasAttribute?.("disabled");
      }, { formId, actionId: addActionId }, { timeout: 10_000 }).catch((error) => {
        throw new Error(`${stage}: ablation did not restore valid Add control state: ${error.message}`);
      });
      await formP1.locator(`:scope > ion-button[data-action-id='${addActionId}']`).click();
    } else {
      // Normal rendered click only — no force. Disabled controls may suppress onClick;
      // settle via production telemetry or blocked_gate after the non-forced attempt.
      const submitBtn = formP1.locator(`:scope > ion-button[data-action-id='${addActionId}']`);
      await submitBtn.click({ timeout: 3_000 }).catch(() => {
        // Playwright may refuse disabled targets; zero outbound + blocked_gate still prove fail-closed.
      });
      await page.evaluate(() => new Promise((resolve) => {
        queueMicrotask(() => queueMicrotask(resolve));
      }));
    }

    const clickCompletion = await page.waitForFunction(({ before, actionId, formId: id, ablate }) => {
      const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
      const attempt = harness?.lastFormSubmitClick;
      if (attempt && attempt.seq > before && attempt.actionId === actionId) {
        if (
          attempt.phase === "dispatched"
          || attempt.phase === "blocked_disabled"
          || attempt.phase === "blocked_invalid"
        ) {
          return attempt;
        }
      }
      if (ablate) return null;
      const formEl = globalThis.document.querySelector(`form[data-ui-node-id='${id}']`);
      const btn = formEl?.querySelector(`ion-button[data-action-id='${actionId}']`);
      const native = btn?.shadowRoot?.querySelector("button") ?? btn?.querySelector("button") ?? btn;
      const disabled = Boolean(
        btn?.hasAttribute("disabled")
        || native?.disabled
        || native?.hasAttribute?.("disabled")
      );
      const invalid = formEl?.getAttribute("data-form-invalid") === "true"
        || formEl?.querySelector("[data-selection-invalid='true']") != null;
      if (disabled && invalid) {
        return { phase: "blocked_gate", actionId, gated: true, settled: true, seq: before };
      }
      return null;
    }, {
      before: clickSeqBefore,
      actionId: addActionId,
      formId,
      ablate: ablateStaleSubmit
    }, { timeout: 10_000 }).then((handle) => handle.jsonValue()).catch((error) => {
      throw new Error(`${stage}: production Add click/dispatch path never completed: ${error.message}`);
    });

    const staleAddSessionArgs = {
      before: eventsBeforeStale,
      workspaceId: state.workspaceId,
      sessionId: sessionA
    };
    const collectStaleAddSession = ({ before, workspaceId, sessionId: expectedSession }) => {
      const entries = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(before);
      return entries.filter((entry) => {
        if (
          entry.kind !== "daemon_request"
          || entry.payload?.type !== "plugin_surface_action"
          || entry.payload?.package_name !== "botster-workspaces"
          || entry.payload?.request?.action_id !== "botster_workspaces.add_session"
        ) return false;
        const values = entry.payload?.request?.values ?? {};
        if (values.workspace_id !== workspaceId) return false;
        return values.session_id === expectedSession
          || values.session_id_advanced === expectedSession
          || values["botster-workspaces-add-session-id"] === expectedSession
          || values["botster-workspaces-add-session-id-advanced"] === expectedSession;
      });
    };

    let staleSubmit = [];
    if (ablateStaleSubmit || clickCompletion.phase === "dispatched") {
      staleSubmit = await page.waitForFunction((args) => {
        const entries = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(args.before);
        const found = entries.filter((entry) => {
          if (
            entry.kind !== "daemon_request"
            || entry.payload?.type !== "plugin_surface_action"
            || entry.payload?.package_name !== "botster-workspaces"
            || entry.payload?.request?.action_id !== "botster_workspaces.add_session"
          ) return false;
          const values = entry.payload?.request?.values ?? {};
          if (values.workspace_id !== args.workspaceId) return false;
          return values.session_id === args.sessionId
            || values.session_id_advanced === args.sessionId
            || values["botster-workspaces-add-session-id"] === args.sessionId
            || values["botster-workspaces-add-session-id-advanced"] === args.sessionId;
        });
        return found.length > 0 ? found : null;
      }, staleAddSessionArgs, { timeout: 15_000 }).then((handle) => handle.jsonValue()).catch((error) => {
        if (ablateStaleSubmit) {
          throw new Error(
            `${stage}: ablation restored stale dispatch but real action collector emitted no add_session: ${error.message}`
          );
        }
        return [];
      });
    } else {
      staleSubmit = await page.evaluate(collectStaleAddSession, staleAddSessionArgs);
    }

    if (staleSubmit.length > 0) {
      throw new Error(
        `${stage}: held-open P1 dispatched stale add_session for session A: ${JSON.stringify(staleSubmit)}`
      );
    }

    const spaActionStateAfter = await readActionRequestState();
    const outboundAddSessionIdsAfter = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events
        .filter((entry) =>
          entry.kind === "daemon_request"
          && entry.payload?.type === "plugin_surface_action"
          && entry.payload?.request?.action_id === "botster_workspaces.add_session"
        )
        .map((entry) => entry.payload?.request?.request_id)
        .filter(Boolean);
    });
    const newOutboundAddSessionIds = outboundAddSessionIdsAfter.filter(
      (id) => !outboundAddSessionIdsBefore.includes(id)
    );
    const newStaleOutbound = await page.evaluate(({ ids, sessionId, workspaceId }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.filter((entry) => {
        if (entry.kind !== "daemon_request" || entry.payload?.type !== "plugin_surface_action") {
          return false;
        }
        const request = entry.payload?.request;
        if (!ids.includes(request?.request_id)) return false;
        if (request?.action_id !== "botster_workspaces.add_session") return false;
        const values = request?.values ?? {};
        if (values.workspace_id !== workspaceId) return false;
        return values.session_id === sessionId
          || values.session_id_advanced === sessionId
          || values["botster-workspaces-add-session-id"] === sessionId
          || values["botster-workspaces-add-session-id-advanced"] === sessionId;
      });
    }, { ids: newOutboundAddSessionIds, sessionId: sessionA, workspaceId: state.workspaceId });

    // SPA correlated pending/result state (production ActionDispatcher ledger).
    const pendingUnchanged =
      spaActionStateAfter.pending_count === spaActionStateBefore.pending_count
      && JSON.stringify(spaActionStateAfter.pending_request_ids) === JSON.stringify(spaActionStateBefore.pending_request_ids);
    const beforeResultIds = new Set(
      (spaActionStateBefore.recent_results ?? []).map((entry) => entry.request_id)
    );
    const newActionResults = (spaActionStateAfter.recent_results ?? []).filter(
      (entry) => !beforeResultIds.has(entry.request_id)
    );
    const newStaleActionResults = newActionResults.filter(
      (entry) => entry.action_id === "botster_workspaces.add_session"
    );

    if (ablateStaleSubmit) {
      // Ablation must fail first at request-state or outbound oracle (not a later cleanup assert).
      if (newStaleOutbound.length === 0 && newStaleActionResults.length === 0) {
        throw new Error(
          `${stage}: ablation expected stale add_session to appear in outbound or SPA action results first; ` +
          `spa_before=${JSON.stringify(spaActionStateBefore)}; spa_after=${JSON.stringify(spaActionStateAfter)}`
        );
      }
      throw new Error(
        `${stage}: ablation expected stale-request oracle to fail first: ` +
        `outbound=${JSON.stringify(newStaleOutbound)}; spa_results=${JSON.stringify(newStaleActionResults)}`
      );
    }

    if (newStaleOutbound.length > 0) {
      throw new Error(
        `${stage}: SPA outbound ledger gained stale A add_session request_ids: ${JSON.stringify(newStaleOutbound)}`
      );
    }
    if (!pendingUnchanged || newStaleActionResults.length > 0) {
      throw new Error(
        `${stage}: SPA action pending/result state changed for stale A submit; ` +
        `before=${JSON.stringify(spaActionStateBefore)}; after=${JSON.stringify(spaActionStateAfter)}; ` +
        `new_stale_results=${JSON.stringify(newStaleActionResults)}`
      );
    }

    // Mandatory cleanup for A/B/C after assertions (not used as gap trigger).
    const cleanup = await cleanupSeededSessions({ page2, preferProductionRemove: true });
    if (
      !cleanup.membership_left_cleared
      || !cleanup.sessions_absent
      || cleanup.sessions_removed.length !== seededSessions.length
    ) {
      throw new Error(
        `${stage}: mandatory A/B/C cleanup incomplete: ${JSON.stringify(cleanup)}`
      );
    }

    console.log(`${stage} passed ${JSON.stringify({
      stage,
      stale_session_id: sessionA,
      warmup_session_id: sessionA,
      dropped_session_id: sessionB,
      second_delta_session_id: sessionC,
      workspace_id: state.workspaceId,
      render_baseline: renderBaseline,
      dual_client: true,
      ordered_gap: true,
      dropped_snapshot_seq: orderedGapEvidence.dropped_snapshot_seq,
      gap_trigger_snapshot_seq: orderedGapEvidence.gap_trigger_snapshot_seq,
      client_baseline_n: orderedGapEvidence.client_baseline_n,
      claim_exclusion_after_gap: true,
      stale_submit_blocked: true,
      click_completion_phase: clickCompletion.phase,
      zero_stale_add_session: true,
      spa_pending_unchanged: true,
      spa_no_new_stale_results: true,
      membership_left_cleared: cleanup.membership_left_cleared,
      sessions_absent: cleanup.sessions_absent,
      sessions_removed: cleanup.sessions_removed,
      membership_ids_remaining: cleanup.membership_ids_remaining,
      cleanup_a: {
        membership: cleanup.membership_remove[sessionA],
        hub_shutdown: cleanup.hub_shutdown[sessionA],
        hub_remove: cleanup.hub_remove[sessionA]
      },
      cleanup_b: {
        membership: cleanup.membership_remove[sessionB],
        hub_shutdown: cleanup.hub_shutdown[sessionB],
        hub_remove: cleanup.hub_remove[sessionB]
      },
      cleanup_c: {
        membership: cleanup.membership_remove[sessionC],
        hub_shutdown: cleanup.hub_shutdown[sessionC],
        hub_remove: cleanup.hub_remove[sessionC]
      }
    })}`);
  } catch (error) {
    // finally-safe: still attempt A/B/C cleanup on early failure so later lifecycle stages
    // are not poisoned by residual claimed/running seeds.
    const cleanup = await cleanupSeededSessions({ page2, preferProductionRemove: true }).catch((cleanupError) => ({
      cleanup_error: cleanupError.message
    }));
    console.log(`${stage} cleanup-after-failure ${JSON.stringify(cleanup)}`);
    throw error;
  } finally {
    if (page2) {
      await page2.close().catch(() => {});
    }
  }
}

async function assertWorkspacesLifecycleOracles(page, {
  stage,
  expectations,
  absentExpectations = [],
  priorEvidence
}) {
  const evidence = await workspacesLifecycleEvidence(page);
  const recordsById = new Map(evidence.canonicalRecords.map((record) => [
    record.session_uuid ?? record.session_id ?? record.id,
    record
  ]));
  const classifications = expectations.map((expectation) => ({
    oracle: expectation.oracle,
    ...classifyWorkspacesReference({
      uiTree: evidence.uiTree,
      referenceId: expectation.referenceId,
      lifecycleClass: expectation.lifecycleClass,
      canonicalRecord: recordsById.get(expectation.referenceId),
      canonicalRecords: evidence.canonicalRecords,
      renderedNodeIds: evidence.renderedRows.map((row) => row.id)
    })
  }));
  for (let index = 0; index < classifications.length; index += 1) {
    const classification = classifications[index];
    if (classification.outcome === "materialized") {
      const dom = await workspacesLifecycleDomEvidence(page, classification);
      classifications[index] = workspacesLifecycleMaterializationResult(classification, dom);
    }
  }
  const negativeClassifications = [];
  for (const expectation of absentExpectations) {
    const current = classifyWorkspacesReference({
      uiTree: evidence.uiTree,
      referenceId: expectation.referenceId,
      lifecycleClass: expectation.lifecycleClass,
      canonicalRecord: recordsById.get(expectation.referenceId),
      canonicalRecords: evidence.canonicalRecords,
      renderedNodeIds: evidence.renderedRows.map((row) => row.id)
    });
    const prior = (Array.isArray(priorEvidence) ? priorEvidence : [priorEvidence])
      .filter(Boolean)
      .flatMap((entry) => entry.classifications)
      .find((classification) =>
        classification.referenceId === expectation.referenceId &&
        classification.lifecycleClass === expectation.lifecycleClass
      );
    const candidateIds = [...new Set([current.resolvedValue, prior?.resolvedValue].filter(Boolean))];
    const regions = [];
    for (const id of candidateIds) {
      if (!evidence.renderedRows.some((row) => row.id === id)) continue;
      const details = await workspacesLifecycleNodeDetails(page, id);
      regions.push({
        id,
        region: workspacesLifecycleRegion(details.ancestors, expectation.lifecycleClass)
      });
    }
    const absence = workspacesLifecycleAbsenceResult({
      currentResolvedValue: current.resolvedValue,
      priorResolvedValue: prior?.resolvedValue,
      renderedNodeIds: evidence.renderedRows.map((row) => row.id),
      regions
    });
    negativeClassifications.push({
      ...expectation,
      outcome: absence.valid ? "absent" : "unexpected-materialized",
      identity: current,
      ...absence
    });
  }
  const unresolvedIds = evidence.renderedRows.filter((row) => row.id.includes("$bind") || row.id.includes("@/"));
  const duplicateIds = duplicateValues(evidence.renderedRows.map((row) => row.id));
  const identityCollisions = duplicateValues(classifications.map((entry) => entry.resolvedValue));
  const failed = classifications.find((classification) =>
    classification.outcome !== "materialized" || classification.dom?.valid !== true
  );
  const negativeFailure = negativeClassifications.find((classification) => !classification.valid);
  if (failed || negativeFailure || unresolvedIds.length > 0 || duplicateIds.length > 0 || identityCollisions.length > 0) {
    throw lifecycleOracleError(formatWorkspacesLifecycleFailure({
      ...evidence,
      stage,
      oracle: failed?.oracle ?? negativeFailure?.oracle ?? "unique-stable-literal-identity",
      classifications: [...classifications, ...negativeClassifications],
      renderedRows: evidence.renderedRows,
      requestCounts: {
        ...evidence.requestCounts,
        unresolved_ids: unresolvedIds,
        duplicate_ids: duplicateIds,
        identity_collisions: identityCollisions
      }
    }));
  }
  return { ...evidence, stage, classifications };
}

async function workspacesLifecycleDomEvidence(page, classification) {
  const details = await workspacesLifecycleNodeDetails(page, classification.resolvedValue);
  const region = workspacesLifecycleRegion(details.ancestors, classification.lifecycleClass);
  const result = workspacesLifecycleDomResult({
    ...details,
    region,
    branch: classification.branch
  });
  return {
    ...details,
    region,
    ...result
  };
}

async function workspacesLifecycleNodeDetails(page, nodeId) {
  const surface = page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId);
  const row = surface.locator(`[data-ui-node-id='${nodeId}']`);
  const count = await row.count();
  if (count !== 1) return { count, visible: false, text: "", actions: [], ancestors: [] };
  const visible = await row.isVisible();
  const details = await row.evaluate((node, testId) => {
    const surfaceRoot = node.closest(`[data-testid="${testId}"]`);
    const ancestors = [];
    for (let candidate = node; candidate && candidate !== surfaceRoot; candidate = candidate.parentElement) {
      ancestors.push({
        id: candidate.getAttribute("data-ui-node-id"),
        text: (candidate.textContent ?? "").trim().replace(/\s+/g, " ")
      });
    }
    return {
      text: (node.textContent ?? "").trim().replace(/\s+/g, " "),
      actions: [...node.querySelectorAll("[data-action-id]")].map((action) => ({
        actionId: action.getAttribute("data-action-id"),
        nodeId: action.getAttribute("data-ui-node-id"),
        label: (action.textContent ?? "").trim().replace(/\s+/g, " ")
      })),
      ancestors
    };
  }, HOST_CHROME.selectedAppSurfaceTestId);
  return { count, visible, ...details };
}

async function workspacesLifecycleEvidence(page) {
  const events = await page.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []);
  const { records, chronology } = convergeEntityFamily(events, "session");
  const uiTree = latestAcceptedWorkspacesUiTree(events);
  const renderedRows = await page.getByTestId(HOST_CHROME.selectedAppSurfaceTestId)
    .locator("[data-ui-node-id]")
    .evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-ui-node-id") ?? "",
      actionId: node.getAttribute("data-action-id"),
      text: (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 240)
    })));
  return {
    events,
    uiTree,
    renderedRows,
    canonicalRecords: records,
    frameChronology: chronology,
    subscriptionId: await latestSessionEntitySubscriptionId(page),
    requestCounts: {
      plugin_surface_render: await daemonRequestCount(page, { type: "plugin_surface_render" }),
      list_sessions: await daemonRequestCount(page, { type: "list_sessions" })
    }
  };
}

function assertLifecycleRequestCountsUnchanged(actual, renderCount, listCount, stage) {
  if (actual.plugin_surface_render !== renderCount || actual.list_sessions !== listCount) {
    throw new Error(
      `Workspaces ${stage} used a refresh path: expected plugin_surface_render=${renderCount} list_sessions=${listCount}; ` +
      `observed=${JSON.stringify(actual)}`
    );
  }
}

function assertStableLifecycleIdentity(before, after, referenceId, lifecycleClass) {
  const previous = before.classifications.find((entry) =>
    entry.referenceId === referenceId && entry.lifecycleClass === lifecycleClass
  );
  const current = after.classifications.find((entry) =>
    entry.referenceId === referenceId && entry.lifecycleClass === lifecycleClass
  );
  if (!previous?.resolvedValue || previous.resolvedValue !== current?.resolvedValue) {
    throw new Error(
      `Workspaces lifecycle identity changed across reconnect for ${referenceId}/${lifecycleClass}: ` +
      `${JSON.stringify({ previous, current })}`
    );
  }
}

function observedWorkspacesLifecyclePartition(classifications) {
  return Object.fromEntries(["current", "ended", "unavailable"].map((lifecycleClass) => [
    lifecycleClass,
    classifications
      .filter((entry) => entry.lifecycleClass === lifecycleClass)
      .map((entry) => entry.referenceId)
  ]));
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([value, count]) => value && count > 1)
    .map(([value]) => value);
}

function lifecycleOracleError(message) {
  const error = new Error(message);
  error.compactLifecycleEvidence = true;
  return error;
}

function assertRequiredWorkspacesProof() {
  if (!requireWorkspacesMode) return;
  if (workspacesCompatibilityProofCount !== 3) {
    throw new Error(
      `Workspaces compatibility mode expected initial, reload, and direct-load proofs; completed=${workspacesCompatibilityProofCount}`
    );
  }
}

async function openPackageSettings(page, packageName) {
  await openAppsView(page);
  const installed = installedList(page);
  const packageLabel = packageName.replace(/[-_]+/g, " ");
  const settingsButton = installed.getByRole("button", {
    name: `Settings for ${packageLabel}`,
    exact: true
  });
  await settingsButton.waitFor({ timeout: 15_000 }).catch(async (error) => {
    const installedText = await installed.innerText().catch(() => "");
    throw new Error(
      `timed out waiting for ${packageName} settings button; installed=${JSON.stringify(installedText)}: ${error.message}`
    );
  });
  await settingsButton.click();
  await page.waitForURL(new RegExp(`/apps/${packageName}/settings`));
  await page.getByTestId(HOST_CHROME.pluginSettingsRouteTestId).waitFor();
}

async function closePackageSettingsRoute(page) {
  // 9753297 relabelled this control from "Apps" to "Back" (App.tsx PluginSettingsRoutePage)
  // without updating the harness, so smoke:live-packaged-protocol has been failing here on
  // main. Repaired only because this ticket's required WebRTC reconnect proof runs after it.
  await page
    .getByTestId(HOST_CHROME.pluginSettingsRouteTestId)
    .getByRole("button", { name: HOST_CHROME.settingsBackButtonName, exact: true })
    .click();
  await page.waitForURL(/\/apps(?:[?#]|$)/);
}

async function setIonicSelectValue(page, fieldId, value) {
  await page.locator(`ion-select[data-configuration-field='${fieldId}']`).evaluate(
    (select, nextValue) => {
      select.value = nextValue;
      select.dispatchEvent(new CustomEvent("ionChange", { bubbles: true, detail: { value: nextValue } }));
    },
    value
  );
}

async function waitForPackageConfigurationRequest(page, { packageName, values, omittedKeys = [] }) {
  await page.waitForFunction(
    ({ nextPackageName, expectedValues, expectedOmittedKeys }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).some((entry) => {
        if (entry.kind !== "daemon_request") return false;
        const payload = entry.payload ?? {};
        if (payload.type !== "set_package_configuration" || payload.package_name !== nextPackageName) return false;
        const payloadValues = payload.values ?? {};
        for (const [key, expectedValue] of Object.entries(expectedValues)) {
          if (JSON.stringify(payloadValues[key]) !== JSON.stringify(expectedValue)) return false;
        }
        return expectedOmittedKeys.every((key) => !(key in payloadValues));
      }),
    { nextPackageName: packageName, expectedValues: values, expectedOmittedKeys: omittedKeys },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedRequests = await page.evaluate((nextPackageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "set_package_configuration")
        .filter((entry) => !nextPackageName || entry.payload?.package_name === nextPackageName)
        .map((entry) => entry.payload),
      packageName
    );
    throw new Error(
      `timed out waiting for ${packageName} configuration request values=${JSON.stringify(values)} omitted=${JSON.stringify(omittedKeys)}; observed=${JSON.stringify(observedRequests, null, 2)}: ${error.message}`
    );
  });
}

async function assertContractSettingsSummary(page, expectedText) {
  await page.getByText(/endpoint=.* mode=.* api_token_state=.*/).waitFor({ timeout: 45_000 });
  const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
  const summaries = await page.locator("text=/endpoint=.* mode=.* api_token_state=.*/").allTextContents();
  if (!expectedTexts.some((expected) => summaries.includes(expected))) {
    const relevantEvents = await page.evaluate((nextPackageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) => {
        const payload = entry.payload ?? {};
        if (entry.kind === "daemon_request") {
          return payload.package_name === nextPackageName && (
            payload.type === "set_package_configuration" ||
            payload.type === "plugin_surface_render"
          );
        }
        if (entry.kind === "daemon_response") {
          return payload.packages?.some?.((record) => record.name === nextPackageName) ||
            payload.plugin_surface?.package_name === nextPackageName;
        }
        if (entry.kind === "hub_frame" && payload.kind === "action_result") {
          return payload.payload?.result?.package_name === nextPackageName;
        }
        return false;
      }),
      contractMatrixPackageName
    );
    throw new Error(`contract settings summary mismatch; expected=${JSON.stringify(expectedTexts)} actual=${JSON.stringify(summaries)} relevant=${JSON.stringify(relevantEvents, null, 2)}`);
  }
}

async function waitForPackageEffectiveConfiguration(page, packageName, expectedValues) {
  await page.waitForFunction(
    ({ nextPackageName, nextExpectedValues }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const daemonPackages = events
        .filter((entry) => entry.kind === "daemon_response" && entry.payload?.kind === "packages")
        .flatMap((entry) => entry.payload.packages ?? []);
      const projectedPackages = events
        .filter(
          (entry) =>
            entry.kind === "hub_frame" &&
            entry.payload?.kind === "entity_snapshot" &&
            entry.payload.payload?.family === "botster-web.package"
        )
        .flatMap((entry) => entry.payload.payload.records ?? []);
      const daemonMatches = daemonPackages.some((record) =>
        record.package_name === nextPackageName &&
        configurationMatches(record.configuration?.effective_values ?? {}, nextExpectedValues)
      );
      const projectedMatches = projectedPackages.some((record) => {
        if (record.id !== nextPackageName) return false;
        const effectiveValues = Object.fromEntries(
          (record.configuration_fields ?? []).map((field) => [
            field.id,
            field.secret_state
              ? { type: field.config_type, state: field.secret_state }
              : { type: field.config_type, value: field.value }
          ])
        );
        return configurationMatches(effectiveValues, nextExpectedValues);
      });
      return daemonMatches && projectedMatches;

      function configurationMatches(effectiveValues, expected) {
        return Object.entries(expected).every(([key, expectedValue]) =>
          JSON.stringify(normalizeJson(effectiveValues[key])) === JSON.stringify(normalizeJson(expectedValue))
        );
      }

      function normalizeJson(value) {
        if (Array.isArray(value)) return value.map(normalizeJson);
        if (value && typeof value === "object") {
          return Object.fromEntries(
            Object.keys(value).sort().map((key) => [key, normalizeJson(value[key])])
          );
        }
        return value;
      }
    },
    { nextPackageName: packageName, nextExpectedValues: expectedValues },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedConfigurations = await page.evaluate((nextPackageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .flatMap((entry) => {
          const packages = entry.kind === "daemon_response"
            ? entry.payload?.packages
            : entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot" && entry.payload.payload?.family === "botster-web.package"
              ? entry.payload.payload.records
              : [];
          return Array.isArray(packages) ? packages : [];
        })
        .filter((record) => record?.package_name === nextPackageName || record?.id === nextPackageName)
        .map((record) => ({
          family: record.package_name ? "daemon" : "projected",
          name: record.package_name ?? record.id,
          effective_values: record.configuration?.effective_values,
          fields: record.configuration_fields
        })),
      packageName
    );
    throw new Error(`timed out waiting for ${packageName} effective configuration ${JSON.stringify(expectedValues)}; observed=${JSON.stringify(observedConfigurations, null, 2)}: ${error.message}`);
  });
}

async function packageConfigurationActionResultCount(page, packageName, accepted = undefined) {
  return page.evaluate(
    ({ nextPackageName, nextAccepted }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        if (result.package_name !== nextPackageName) return false;
        return nextAccepted === undefined || payload.accepted === nextAccepted;
      }).length,
    { nextPackageName: packageName, nextAccepted: accepted }
  );
}

async function waitForPackageConfigurationActionResultCount(page, packageName, accepted, expectedCount) {
  await page.waitForFunction(
    ({ nextPackageName, nextAccepted, nextExpectedCount }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") return false;
        const payload = entry.payload.payload ?? {};
        const result = payload.result ?? {};
        return payload.accepted === nextAccepted && result.package_name === nextPackageName;
      }).length >= nextExpectedCount,
    { nextPackageName: packageName, nextAccepted: accepted, nextExpectedCount: expectedCount },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const observedResults = await page.evaluate((nextPackageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "hub_frame" && entry.payload?.kind === "action_result")
        .map((entry) => entry.payload?.payload)
        .filter((payload) => !nextPackageName || payload?.result?.package_name === nextPackageName),
      packageName
    );
    throw new Error(`timed out waiting for ${packageName} configuration action_result accepted=${accepted} count>=${expectedCount}; observed=${JSON.stringify(observedResults, null, 2)}: ${error.message}`);
  });
}

async function harnessEventCount(page) {
  return page.evaluate(
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events?.length ?? 0
  );
}

async function waitForHarnessEvent(page, criteria, label, sinceIndex = 0) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const events = await page.evaluate(
      () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []
    );
    if (events.slice(sinceIndex).some((entry) => harnessEventMatches(entry, criteria))) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function latestLocalWebrtcGrantId(page) {
  return page.evaluate(() => {
    const requests = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "local_webrtc_signal")
      .map((entry) => entry.payload?.grant_id)
      .filter((grantId) => typeof grantId === "string");
    return requests.at(-1) ?? null;
  });
}

async function latestSessionEntitySubscriptionId(page) {
  return page.evaluate(() => {
    const requests = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter(
        (entry) =>
          entry.kind === "daemon_request" &&
          entry.payload?.type === "subscribe_entities" &&
          entry.payload?.entity_type === "session"
      )
      .map((entry) => entry.payload?.subscription_id)
      .filter((subscriptionId) => typeof subscriptionId === "string");
    return requests.at(-1) ?? null;
  });
}

async function assertNoLegacySessionHydration(page) {
  const legacyRequests = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "list_sessions")
      .map((entry) => entry.payload)
  );
  if (legacyRequests.length > 0) {
    throw new Error(`session lifecycle used legacy list_sessions hydration: ${JSON.stringify(legacyRequests)}`);
  }
}

/**
 * Session types must reach the browser only through the held `session_type` subscription.
 * This asserts zero list_session_types requests across the entire span -- from before the
 * surface mounts through every mutation -- so a mount-time or pre-subscribe legacy request
 * could not hide behind an "after the initial subscribe" window.
 * Target-scoped `list_session_types_for_target` (New session picker) is intentionally allowed.
 */
async function assertNoSessionTypeListHydration(page) {
  const legacyRequests = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) =>
        entry.kind === "daemon_request" &&
        (entry.payload?.type === "list_session_types" || entry.payload?.type === "list_session_templates"))
      .map((entry) => entry.payload)
  );
  if (legacyRequests.length > 0) {
    throw new Error(`session types used legacy list hydration: ${JSON.stringify(legacyRequests)}`);
  }
}

/**
 * Production New session path: Spawn points → New session → list_session_types_for_target
 * → option render → spawn_session_type. Hub owns eligibility; Web only presents and submits.
 */
async function exerciseNewSessionPickerListForTarget(page) {
  if (!webrtcDataDir) throw new Error("new session picker proof requires a WebRTC hub data directory");
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  const pickerTargetId = "web-picker-target";
  const pickerTargetRoot = join(webrtcDataDir, "web-picker-root");
  await mkdir(pickerTargetRoot, { recursive: true });
  await writeFile(join(pickerTargetRoot, ".keep"), "");

  // Device session-type commands resolve under Hub's device session-types root
  // (`<data-dir>/session-types`), not PATH and not absolute paths (those are rejected).
  const deviceSessionTypesRoot = join(webrtcDataDir, "session-types");
  const deviceBinDir = join(deviceSessionTypesRoot, "bin");
  await mkdir(deviceBinDir, { recursive: true });
  const pickerScript = join(deviceBinDir, "picker-agent.sh");
  await writeFile(
    pickerScript,
    "#!/bin/sh\nprintf 'picker-spawned:%s\\n' \"$BOTSTER_SESSION_ID\"\nsleep 30\n"
  );
  await chmod(pickerScript, 0o755);
  const pickerDefinition = {
    id: "web-picker-agent",
    label: "Web picker agent",
    role: "botster.agent",
    interaction: "interactive",
    traits: ["terminal"],
    lifecycle: "task",
    command: "bin/picker-agent.sh",
    args: [],
    working_directory: { policy: "package_root" },
    context: ["prompt"]
  };
  const createTypeResponse = await sendDaemonRequest(socketPath, {
    type: "create_session_type",
    source: { source: "device" },
    definition: pickerDefinition
  });
  if (createTypeResponse.error) {
    throw new Error(`picker fixture create failed: ${JSON.stringify(createTypeResponse.error)}`);
  }

  // Fresh hub data dirs have no admitted spawn points. Create one through the production UI
  // so the pull-family entity snapshot updates (socket-only create would not re-pull the list).
  await page.locator("ion-menu.app-sidebar")
    .getByRole("button", { name: HOST_CHROME.hubSettingsNavButtonName, exact: true })
    .click();
  await page.getByLabel(HOST_CHROME.hubSettingsSectionsLabel)
    .getByRole("button", { name: new RegExp(HOST_CHROME.spawnPointsSectionLabel) })
    .click();
  const spawnPointsView = page.getByTestId(HOST_CHROME.spawnPointsViewTestId);
  await spawnPointsView.waitFor();

  const createTargetSince = await harnessEventCount(page);
  await spawnPointsView.getByRole("button", { name: /Add spawn point/ }).click();
  const spawnTargetModal = page.locator("ion-modal.show-modal").filter({ hasText: "Add spawn point" }).first();
  await spawnTargetModal.waitFor();
  await spawnTargetModal.locator('ion-input:has-text("Spawn point name") input').first().fill("Web picker spawn point");
  await spawnTargetModal.locator('ion-input:has-text("Folder") input').first().fill(pickerTargetRoot);
  // Set deterministic identifier in advanced options when present.
  const advanced = spawnTargetModal.locator("details.advanced-spawn-target-options");
  if (await advanced.count() > 0) {
    await advanced.locator("summary").click();
    const idInput = spawnTargetModal.locator('ion-input:has-text("Identifier") input').first();
    if (await idInput.count() > 0) {
      await idInput.fill(pickerTargetId);
    }
  }
  await spawnTargetModal.getByRole("button", { name: "Create", exact: true }).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "create_spawn_target" },
    "web-produced create_spawn_target for picker fixture",
    createTargetSince
  );
  await spawnPointsView.getByText("Web picker spawn point").waitFor({ timeout: 15_000 });

  const newSessionButton = spawnPointsView.getByRole("button", { name: /New session/ }).first();
  await newSessionButton.waitFor();
  const listSince = await harnessEventCount(page);
  await newSessionButton.click();

  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "list_session_types_for_target" },
    "web-produced list_session_types_for_target request on New session open",
    listSince
  );
  const listRequest = await latestHarnessRequest(page, "list_session_types_for_target", listSince);
  if (typeof listRequest?.target_id !== "string" || listRequest.target_id.length === 0) {
    throw new Error(`list_session_types_for_target missing target_id: ${JSON.stringify(listRequest)}`);
  }
  // Management bare list must not ride along.
  await assertNoSessionTypeListHydration(page);

  const modal = page.locator("ion-modal.show-modal").filter({ hasText: HOST_CHROME.newSessionModalTitle }).first();
  await modal.waitFor();
  // Wait until loading settles into the select form (Hub list ready with options).
  const sessionTypeSelect = modal.locator("ion-select").first();
  try {
    await sessionTypeSelect.waitFor({ timeout: 15_000 });
  } catch {
    const modalText = await modal.innerText();
    throw new Error(`New session list failed or empty after Hub fixture: ${modalText}`);
  }
  const optionValues = await sessionTypeSelect.locator("ion-select-option").evaluateAll((options) =>
    options.map((option) => ({
      value: option.value ?? option.getAttribute("value"),
      disabled: option.disabled === true || option.getAttribute("disabled") != null,
      label: (option.textContent ?? "").trim()
    }))
  );
  if (optionValues.length === 0) {
    throw new Error("New session modal rendered no Hub list options");
  }
  // Device fixture must appear by effective id when Hub admits it for the spawn point.
  const expectedEffectiveId = `device/${pickerDefinition.id}`;
  const deviceOption = optionValues.find((option) => option.value === expectedEffectiveId);
  if (!deviceOption) {
    throw new Error(
      `Hub list for target ${listRequest.target_id} missing device option ${expectedEffectiveId}: ${JSON.stringify(optionValues)}`
    );
  }
  if (deviceOption.disabled) {
    throw new Error(`device option ${expectedEffectiveId} rendered unavailable: ${JSON.stringify(deviceOption)}`);
  }

  await setUiNodeSelectValue(sessionTypeSelect, expectedEffectiveId);
  const spawnSince = await harnessEventCount(page);
  await modal.getByRole("button", { name: HOST_CHROME.newSessionSubmitName, exact: true }).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "spawn_session_type" },
    "web-produced spawn_session_type from New session modal",
    spawnSince
  );
  const spawnRequest = await latestHarnessRequest(page, "spawn_session_type", spawnSince);
  if (spawnRequest?.session_type_id !== expectedEffectiveId) {
    throw new Error(
      `spawn_session_type session_type_id was ${JSON.stringify(spawnRequest?.session_type_id)}, expected ${expectedEffectiveId}`
    );
  }
  if (spawnRequest?.request?.target_id !== listRequest.target_id) {
    throw new Error(
      `spawn_session_type target was ${JSON.stringify(spawnRequest?.request?.target_id)}, expected ${listRequest.target_id}`
    );
  }

  // Ticket success requires Hub acceptance, not only request emission.
  const acceptedSpawn = await page.waitForFunction(
    ({ since, sessionTypeId, targetId }) => {
      const events = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(since);
      for (const entry of events) {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") continue;
        const payload = entry.payload?.payload ?? {};
        const result = payload.result ?? {};
        if (
          payload.accepted === true &&
          result.request_type === "spawn_session_type" &&
          result.session_type_id === sessionTypeId &&
          result.target_id === targetId &&
          typeof result.session_id === "string" &&
          result.session_id.length > 0
        ) {
          return { session_id: result.session_id, request_id: payload.request_id ?? null };
        }
      }
      return null;
    },
    {
      since: spawnSince,
      sessionTypeId: expectedEffectiveId,
      targetId: listRequest.target_id
    },
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch(async (error) => {
    const observed = await page.evaluate((since) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(since)
        .filter((entry) =>
          entry.kind === "hub_frame" && entry.payload?.kind === "action_result"),
    spawnSince);
    throw new Error(
      `New session spawn was not accepted by Hub: ${JSON.stringify(observed)}: ${error.message}`
    );
  });
  if (!acceptedSpawn?.session_id) {
    throw new Error(`accepted spawn missing session_id: ${JSON.stringify(acceptedSpawn)}`);
  }

  // Observe the authoritative session entity for the spawned id before cleanup.
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session", id: acceptedSpawn.session_id },
    `session entity for accepted spawn ${acceptedSpawn.session_id}`,
    spawnSince
  ).catch(async () => {
    // Some paths publish the session only on the sessions array of the daemon response;
    // require at least one daemon response carrying the spawned session id.
    const daemonHasSession = await page.evaluate(({ since, sessionId }) => {
      return (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(since).some((entry) => {
        if (entry.kind !== "daemon_response") return false;
        const sessions = entry.payload?.sessions ?? [];
        return sessions.some((session) => session?.session_id === sessionId);
      });
    }, { since: spawnSince, sessionId: acceptedSpawn.session_id });
    if (!daemonHasSession) {
      throw new Error(
        `accepted spawn ${acceptedSpawn.session_id} never appeared as a session entity or daemon sessions row`
      );
    }
  });

  // Clean up the fixture definition so later stages are not polluted.
  await sendDaemonRequest(socketPath, {
    type: "delete_session_type",
    source: { source: "device" },
    session_type_id: pickerDefinition.id
  });

  // Production submitSpawnSession clears spawnSessionForm on accepted spawn, which closes
  // IonModal. Treat auto-dismiss as success; never require a stable Close click on a
  // detaching overlay (that races and fails Verify's live smoke).
  const openModals = page.locator("ion-modal.show-modal");
  try {
    await openModals.first().waitFor({ state: "detached", timeout: 10_000 });
  } catch {
    // If a modal remains (spawn-point form leftover), Escape is best-effort only.
    await page.keyboard.press("Escape").catch(() => {});
    await openModals.first().waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  }

  return {
    list_target_id: listRequest.target_id,
    list_option_count: optionValues.length,
    device_option_id: expectedEffectiveId,
    spawn_session_type_id: spawnRequest.session_type_id,
    spawn_target_id: spawnRequest.request.target_id,
    spawn_accepted: true,
    spawned_session_id: acceptedSpawn.session_id
  };
}

/**
 * Drives the authoritative session-type contract against the real Hub: Hub-owned CRUD
 * arrives as pushed deltas on the held subscription, the surface renders Hub descriptors
 * verbatim, package rows are read-only, and no list request is ever issued.
 */
async function setSessionTypeFormField(page, label, value) {
  const input = page.locator(`ion-input:has-text("${label}") input`).first();
  await input.waitFor();
  await input.fill(value);
}

async function setSessionTypeFormTextarea(page, label, value) {
  const textarea = page.locator(`ion-textarea:has-text("${label}") textarea`).first();
  await textarea.waitFor();
  await textarea.fill(value);
}

async function setSessionTypeFormSelect(page, testId, optionLabel) {
  const select = page.getByTestId(testId);
  await select.waitFor();
  await select.click();
  // interface="popover" presents options in an ion-popover overlay.
  const popover = page.locator("ion-popover").filter({ hasText: optionLabel }).last();
  await popover.waitFor({ state: "visible" });
  await popover.getByText(optionLabel, { exact: true }).click();
}

async function openSessionTypesView(page) {
  await page.locator("ion-menu.app-sidebar")
    .getByRole("button", { name: HOST_CHROME.hubSettingsNavButtonName, exact: true })
    .click();
  await page.getByLabel(HOST_CHROME.hubSettingsSectionsLabel)
    .getByRole("button", { name: new RegExp(HOST_CHROME.sessionTypesSectionLabel) })
    .click();
  await page.getByTestId(HOST_CHROME.sessionTypesViewTestId).waitFor();
}

async function latestHarnessRequest(page, type, sinceIndex) {
  return page.evaluate(({ since, requestType }) =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(since)
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === requestType)
      .map((entry) => entry.payload)
      .at(-1), { since: sinceIndex, requestType: type });
}

async function latestHarnessActionResult(page, requestType, sinceIndex) {
  return page.evaluate(({ since, expectedType }) => {
    const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
    for (let index = events.length - 1; index >= since; index -= 1) {
      const entry = events[index];
      if (entry.kind !== "hub_frame" || entry.payload?.kind !== "action_result") continue;
      const result = entry.payload?.payload?.result;
      if (result?.request_type === expectedType) {
        return entry.payload.payload;
      }
    }
    return undefined;
  }, { since: sinceIndex, expectedType: requestType });
}

/**
 * Drives create through the RENDERED Ionic controls with the ticket-critical authored
 * fields (relative path, environment, context), then edit/read-back and delete.
 * Socket-direct create would leave client request-shape bugs invisible.
 */
async function createSessionTypeThroughRenderedForm(page) {
  await openSessionTypesView(page);

  const sinceIndex = await harnessEventCount(page);
  await page.getByTestId(HOST_CHROME.createSessionTypeTestId).click();
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor();
  // Create defaults to Agent preset. Name derives id (web-authored-agent).
  await setSessionTypeFormField(page, "Name", "web-authored-agent");
  // Execution is independent from the semantic Agent preset and command text.
  await setSessionTypeFormSelect(page, "session-type-execution", "Shell command");
  await setSessionTypeFormField(page, "Command", "sleep");
  // Ticket-critical fields: relative path + environment + context must survive edit.
  // Advanced is closed on Agent create; open it for path/env/context.
  const advancedCreate = page.locator("details.advanced-session-type-options");
  if (!(await advancedCreate.evaluate((details) => details.open))) {
    await advancedCreate.locator("summary").click();
  }
  await setSessionTypeFormSelect(page, "session-type-working-directory-policy", "Relative path under source root");
  await setSessionTypeFormField(page, "Working directory path", "agents/live");
  await setSessionTypeFormField(page, "Arguments", "30 --verbose");
  await setSessionTypeFormTextarea(page, "Environment", "LIVE_KEY=live-value");
  await setSessionTypeFormField(page, "Context keys", "prompt");
  await page.getByTestId(HOST_CHROME.submitSessionTypeTestId).click();

  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "create_session_type" },
    "web-produced create_session_type request",
    sinceIndex
  );
  const createRequests = await page.evaluate((since) =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(since)
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "create_session_type")
      .map((entry) => entry.payload), sinceIndex);
  if (createRequests.length !== 1) {
    throw new Error(`expected exactly one web-produced create_session_type, got ${createRequests.length}`);
  }
  const [createRequest] = createRequests;
  if (createRequest.definition?.id !== "web-authored-agent") {
    throw new Error(`web create sent the wrong definition id: ${JSON.stringify(createRequest.definition?.id)}`);
  }
  if (createRequest.source?.source !== "device") {
    throw new Error(`web create sent the wrong source: ${JSON.stringify(createRequest.source)}`);
  }
  if (createRequest.definition?.execution?.mode !== "shell_command") {
    throw new Error(
      `web create must author shell_command execution, sent ${JSON.stringify(createRequest.definition?.execution)}`
    );
  }
  if (JSON.stringify(createRequest.definition?.args) !== JSON.stringify(["30", "--verbose"])) {
    throw new Error(`web create must preserve args separately, sent ${JSON.stringify(createRequest.definition?.args)}`);
  }
  if (createRequest.definition?.working_directory?.policy !== "relative"
    || createRequest.definition?.working_directory?.path !== "agents/live") {
    throw new Error(
      `web create must author relative path, sent ${JSON.stringify(createRequest.definition?.working_directory)}`
    );
  }
  if (createRequest.definition?.environment?.LIVE_KEY !== "live-value") {
    throw new Error(
      `web create must author environment, sent ${JSON.stringify(createRequest.definition?.environment)}`
    );
  }
  if (!Array.isArray(createRequest.definition?.context) || !createRequest.definition.context.includes("prompt")) {
    throw new Error(
      `web create must author context, sent ${JSON.stringify(createRequest.definition?.context)}`
    );
  }

  // Accepted -> the form closes and the row arrives as a pushed delta, not a refetch.
  const row = page.getByTestId("session-type-device/web-authored-agent");
  await row.waitFor();
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor({ state: "detached" });
  await assertNoSessionTypeListHydration(page);

  // --- Primary edit path: change only label; prove path/env/context survive ---
  const editSince = await harnessEventCount(page);
  await page.getByTestId(editSessionTypeTestId("device/web-authored-agent")).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "show_session_type_definition" },
    "web-produced show_session_type_definition request",
    editSince
  );
  const showRequest = await latestHarnessRequest(page, "show_session_type_definition", editSince);
  if (showRequest?.session_type_id !== "device/web-authored-agent") {
    throw new Error(
      `web show must use composite session_type_id, sent ${JSON.stringify(showRequest?.session_type_id)}`
    );
  }
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor();
  // Edit opens Advanced by default so Role remains reachable.
  // Form promise pending/rejection: force Hub rejection with an invalid role, keep draft.
  await setSessionTypeFormField(page, "Role", "not a namespaced role");
  await page.getByTestId(HOST_CHROME.submitSessionTypeTestId).click();
  await page.getByTestId(HOST_CHROME.sessionTypeFormErrorTestId).waitFor();
  const formStillOpen = await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).count();
  if (formStillOpen < 1) {
    throw new Error("form closed after Hub rejection; draft must stay open");
  }
  // Restore valid role and change only label (unrelated field).
  await setSessionTypeFormField(page, "Role", "botster.agent");
  await setSessionTypeFormField(page, "Name", "Web authored agent renamed");
  const updateSince = await harnessEventCount(page);
  await page.getByTestId(HOST_CHROME.submitSessionTypeTestId).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "update_session_type" },
    "web-produced update_session_type request",
    updateSince
  );
  const updateRequest = await latestHarnessRequest(page, "update_session_type", updateSince);
  if (updateRequest?.definition?.id !== "web-authored-agent") {
    throw new Error(
      `web update must send bare definition.id, sent ${JSON.stringify(updateRequest?.definition?.id)}`
    );
  }
  if (updateRequest?.definition?.label !== "Web authored agent renamed") {
    throw new Error(`web update missing renamed label: ${JSON.stringify(updateRequest?.definition?.label)}`);
  }
  if (updateRequest?.definition?.execution?.mode !== "shell_command") {
    throw new Error(
      `web update dropped execution mode: ${JSON.stringify(updateRequest?.definition?.execution)}`
    );
  }
  if (JSON.stringify(updateRequest?.definition?.args) !== JSON.stringify(["30", "--verbose"])) {
    throw new Error(`web update merged or dropped args: ${JSON.stringify(updateRequest?.definition?.args)}`);
  }
  if (updateRequest?.definition?.working_directory?.policy !== "relative"
    || updateRequest?.definition?.working_directory?.path !== "agents/live") {
    throw new Error(
      `web update dropped working_directory: ${JSON.stringify(updateRequest?.definition?.working_directory)}`
    );
  }
  if (updateRequest?.definition?.environment?.LIVE_KEY !== "live-value") {
    throw new Error(
      `web update dropped environment: ${JSON.stringify(updateRequest?.definition?.environment)}`
    );
  }
  if (!Array.isArray(updateRequest?.definition?.context) || !updateRequest.definition.context.includes("prompt")) {
    throw new Error(
      `web update dropped context: ${JSON.stringify(updateRequest?.definition?.context)}`
    );
  }
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor({ state: "detached" });
  await page.getByText("Web authored agent renamed").waitFor();

  // Read-back: re-open Edit and assert fresh show still carries path/env/context.
  const readbackSince = await harnessEventCount(page);
  await page.getByTestId(editSessionTypeTestId("device/web-authored-agent")).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "show_session_type_definition" },
    "read-back show_session_type_definition",
    readbackSince
  );
  const readbackResult = await latestHarnessActionResult(page, "show_session_type_definition", readbackSince);
  const readbackDefinition = readbackResult?.result?.session_type_definition?.definition;
  if (!readbackDefinition) {
    throw new Error(`read-back missing session_type_definition: ${JSON.stringify(readbackResult)}`);
  }
  if (readbackDefinition.working_directory?.policy !== "relative"
    || readbackDefinition.working_directory?.path !== "agents/live") {
    throw new Error(
      `read-back dropped working_directory: ${JSON.stringify(readbackDefinition.working_directory)}`
    );
  }
  if (readbackDefinition.environment?.LIVE_KEY !== "live-value") {
    throw new Error(
      `read-back dropped environment: ${JSON.stringify(readbackDefinition.environment)}`
    );
  }
  if (!Array.isArray(readbackDefinition.context) || !readbackDefinition.context.includes("prompt")) {
    throw new Error(
      `read-back dropped context: ${JSON.stringify(readbackDefinition.context)}`
    );
  }
  if (readbackDefinition.label !== "Web authored agent renamed") {
    throw new Error(`read-back label mismatch: ${JSON.stringify(readbackDefinition.label)}`);
  }
  if (readbackDefinition.execution?.mode !== "shell_command") {
    throw new Error(`read-back execution mismatch: ${JSON.stringify(readbackDefinition.execution)}`);
  }
  if (JSON.stringify(readbackDefinition.args) !== JSON.stringify(["30", "--verbose"])) {
    throw new Error(`read-back args mismatch: ${JSON.stringify(readbackDefinition.args)}`);
  }
  // Close form without further mutation.
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor({ state: "detached" });
  await assertNoSessionTypeListHydration(page);

  // Delete through the rendered control must address the BARE authoring id.
  const deleteSince = await harnessEventCount(page);
  await page.getByTestId(deleteSessionTypeTestId("device/web-authored-agent")).click();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "delete_session_type" },
    "web-produced delete_session_type request",
    deleteSince
  );
  const deleteRequest = await page.evaluate((since) =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .slice(since)
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "delete_session_type")
      .map((entry) => entry.payload)[0], deleteSince);
  if (deleteRequest?.session_type_id !== "web-authored-agent") {
    throw new Error(
      `web delete must send the bare authoring id, sent ${JSON.stringify(deleteRequest?.session_type_id)}`
    );
  }
  await row.waitFor({ state: "detached" });
  await assertNoSessionTypeListHydration(page);

  return {
    web_create_definition_id: createRequest.definition.id,
    web_delete_session_type_id: deleteRequest.session_type_id,
    web_show_session_type_id: showRequest.session_type_id,
    web_update_definition_id: updateRequest.definition.id,
    web_update_execution: updateRequest.definition.execution,
    web_update_args: updateRequest.definition.args,
    web_update_preserved_path: updateRequest.definition.working_directory.path,
    web_update_preserved_environment: updateRequest.definition.environment,
    web_update_preserved_context: updateRequest.definition.context,
    web_readback_path: readbackDefinition.working_directory.path,
    web_readback_environment: readbackDefinition.environment,
    web_readback_execution: readbackDefinition.execution,
    form_rejection_kept_draft: true
  };
}

/**
 * Oracle B: authored definition.target_id survives an unrelated-field edit through the
 * rendered Edit control, including authoritative read-back. Fixture may be socket-created
 * because create form does not expose definition target_id.
 */
async function proveSessionTypeTargetIdSurvival(page, socketPath) {
  const definition = {
    id: "target-id-agent",
    label: "Target id agent",
    role: "botster.agent",
    interaction: "interactive",
    lifecycle: "task",
    command: "sleep",
    args: ["30"],
    working_directory: { policy: "relative", path: "agents/target" },
    environment: { TARGET_ENV: "kept" },
    context: ["prompt"],
    target_id: "project-main"
  };

  const createSince = await harnessEventCount(page);
  const createResponse = await sendDaemonRequest(socketPath, {
    type: "create_session_type",
    source: { source: "device" },
    definition
  });
  if (createResponse.error) {
    throw new Error(`target_id fixture create failed: ${JSON.stringify(createResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session_type" },
    "pushed session_type delta after target_id fixture create",
    createSince
  );

  await openSessionTypesView(page);
  const row = page.getByTestId("session-type-device/target-id-agent");
  await row.waitFor();

  const editSince = await harnessEventCount(page);
  await page.getByTestId(editSessionTypeTestId("device/target-id-agent")).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "show_session_type_definition" },
    "target_id show_session_type_definition",
    editSince
  );
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor();
  await setSessionTypeFormField(page, "Name", "Target id agent renamed");
  const updateSince = await harnessEventCount(page);
  await page.getByTestId(HOST_CHROME.submitSessionTypeTestId).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "update_session_type" },
    "target_id update_session_type",
    updateSince
  );
  const updateRequest = await latestHarnessRequest(page, "update_session_type", updateSince);
  if (updateRequest?.definition?.target_id !== "project-main") {
    throw new Error(
      `web update dropped definition.target_id: ${JSON.stringify(updateRequest?.definition?.target_id)}`
    );
  }
  if (updateRequest?.definition?.working_directory?.path !== "agents/target") {
    throw new Error(
      `target_id path oracle failed: ${JSON.stringify(updateRequest?.definition?.working_directory)}`
    );
  }
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor({ state: "detached" });

  const readbackSince = await harnessEventCount(page);
  await page.getByTestId(editSessionTypeTestId("device/target-id-agent")).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "show_session_type_definition" },
    "target_id read-back show",
    readbackSince
  );
  const readbackResult = await latestHarnessActionResult(page, "show_session_type_definition", readbackSince);
  const readbackDefinition = readbackResult?.result?.session_type_definition?.definition;
  if (readbackDefinition?.target_id !== "project-main") {
    throw new Error(
      `read-back dropped definition.target_id: ${JSON.stringify(readbackDefinition?.target_id)}`
    );
  }
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByTestId(HOST_CHROME.sessionTypeFormTestId).waitFor({ state: "detached" });

  const deleteResponse = await sendDaemonRequest(socketPath, {
    type: "delete_session_type",
    source: { source: "device" },
    session_type_id: definition.id
  });
  if (deleteResponse.error) {
    throw new Error(`target_id fixture delete failed: ${JSON.stringify(deleteResponse.error)}`);
  }
  await row.waitFor({ state: "detached" });
  await assertNoSessionTypeListHydration(page);

  return {
    target_id_update_preserved: updateRequest.definition.target_id,
    target_id_readback_preserved: readbackDefinition.target_id
  };
}

async function exerciseSessionTypes(page) {
  if (!webrtcDataDir) throw new Error("session type proof requires a WebRTC hub data directory");
  const socketPath = join(webrtcDataDir, "botster-hub.sock");

  await assertNoSessionTypeListHydration(page);
  const subscribesBefore = await recordSessionTypeSubscribeCount(page);

  const webAuthored = await createSessionTypeThroughRenderedForm(page);
  const targetIdProof = await proveSessionTypeTargetIdSurvival(page, socketPath);

  const definition = {
    id: "live-harness-agent",
    label: "Live harness agent",
    description: "Created by the botster-web live protocol harness",
    role: "botster.agent",
    interaction: "interactive",
    traits: ["terminal"],
    lifecycle: "task",
    command: "sleep",
    args: ["30"],
    context: ["prompt"]
  };

  // Hub owns creation. The browser must learn about it as a pushed delta, never a refetch.
  // Anchor the wait past the initial snapshot so a stale frame cannot satisfy it.
  const createSince = await harnessEventCount(page);
  const createResponse = await sendDaemonRequest(socketPath, {
    type: "create_session_type",
    source: { source: "device" },
    definition
  });
  if (createResponse.error) {
    throw new Error(`live session type create failed: ${JSON.stringify(createResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session_type" },
    "pushed session_type delta after create",
    createSince
  );

  const createdRow = await page.evaluate(() => {
    const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const frame = events[index];
      if (frame.kind !== "hub_frame") continue;
      const payload = frame.payload?.payload;
      if (!payload) continue;
      if (payload.family === "session_type" && Array.isArray(payload.records)) {
        const match = payload.records.find((record) => record.id?.includes("live-harness-agent"));
        if (match) return match;
      }
      if (payload.key?.family === "session_type" && payload.record?.id?.includes("live-harness-agent")) {
        return payload.record;
      }
    }
    return undefined;
  });
  if (!createdRow) {
    throw new Error("live session type create produced no session_type entity record in the browser");
  }
  // Hub descriptors are carried verbatim: no synthesised title/subtitle, provenance intact.
  for (const [field, expected] of [
    ["label", "Live harness agent"],
    ["role", "botster.agent"],
    ["interaction", "interactive"],
    ["lifecycle", "task"],
    ["source", "device"]
  ]) {
    if (createdRow[field] !== expected) {
      throw new Error(`session_type row ${field} was ${JSON.stringify(createdRow[field])}, expected ${expected}`);
    }
  }
  if (createdRow.title !== undefined || createdRow.subtitle !== undefined) {
    throw new Error(`session_type row carried inferred presentation fields: ${JSON.stringify(createdRow)}`);
  }
  if (createdRow.editable !== true) {
    throw new Error(`device-sourced session type should be editable, got ${JSON.stringify(createdRow.editable)}`);
  }

  // The surface renders from the subscription, not a refetch.
  await page.locator("ion-menu.app-sidebar").getByRole("button", { name: HOST_CHROME.hubSettingsNavButtonName, exact: true }).click();
  await page.getByLabel(HOST_CHROME.hubSettingsSectionsLabel).getByRole("button", { name: new RegExp(HOST_CHROME.sessionTypesSectionLabel) }).click();
  const sessionTypesView = page.getByTestId(HOST_CHROME.sessionTypesViewTestId);
  await sessionTypesView.waitFor();
  const renderedRow = sessionTypesView.getByTestId(`session-type-${createdRow.id}`);
  await renderedRow.waitFor();
  const renderedText = await renderedRow.innerText();
  for (const expected of ["Live harness agent", "botster.agent", "interactive", "task", "device"]) {
    if (!renderedText.includes(expected)) {
      throw new Error(`rendered session type row missing ${expected}: ${renderedText}`);
    }
  }
  await assertNoSessionTypeListHydration(page);

  // Hub rejects a semantically invalid definition; Web must not pre-empt that judgement.
  const invalidResponse = await sendDaemonRequest(socketPath, {
    type: "create_session_type",
    source: { source: "device" },
    definition: { ...definition, id: "live-harness-invalid", role: "not a namespaced role" }
  });
  if (!invalidResponse.error) {
    throw new Error("Hub accepted an invalid session-type role; the validation oracle is wrong");
  }

  // Package-sourced mutation is rejected outright by Hub. The exact kind is recorded rather
  // than asserted, because this probe names a definition that does not exist in that package,
  // so Hub may legitimately answer unknown_session_type before it reaches the read-only rule.
  const readOnlyResponse = await sendDaemonRequest(socketPath, {
    type: "delete_session_type",
    source: { source: "package", package_name: "botster" },
    definition_id: definition.id,
    session_type_id: definition.id
  });
  if (!readOnlyResponse.error) {
    throw new Error("Hub accepted a package-sourced session-type mutation; it must be read-only");
  }

  // Update yields a pushed upsert.
  const updateResponse = await sendDaemonRequest(socketPath, {
    type: "update_session_type",
    source: { source: "device" },
    definition: { ...definition, label: "Live harness agent renamed" }
  });
  if (updateResponse.error) {
    throw new Error(`live session type update failed: ${JSON.stringify(updateResponse.error)}`);
  }
  await page.getByText("Live harness agent renamed").waitFor();

  // Delete yields a pushed remove and the row leaves the surface.
  // Scoped by source, Hub addresses the row by its definition id.
  const deleteResponse = await sendDaemonRequest(socketPath, {
    type: "delete_session_type",
    source: { source: "device" },
    session_type_id: definition.id
  });
  if (deleteResponse.error) {
    throw new Error(`live session type delete failed: ${JSON.stringify(deleteResponse.error)}`);
  }
  await renderedRow.waitFor({ state: "detached" });

  await assertNoSessionTypeListHydration(page);

  // Snapshot/upsert/remove all flowed without the client ever resubscribing.
  const subscribesAfter = await recordSessionTypeSubscribeCount(page);
  if (subscribesAfter !== subscribesBefore) {
    throw new Error(
      `session_type CRUD triggered a resubscribe: ${subscribesBefore} -> ${subscribesAfter}`
    );
  }

  // Restore the view this stage borrowed so later terminal stages start where they expect.
  await openHomeView(page);

  return {
    // This stage runs after proveInPageReconnectReplaysHubStatus forces a fresh WebRTC
    // generation, so a count above 1 here is the reconnect re-establishing the held
    // subscription -- evidence that it survives a transport generation, not a loop. The
    // loop check is the before/after comparison across CRUD immediately above.
    session_type_subscribes_before_crud: subscribesBefore,
    created_session_type_id: createdRow.session_type_id ?? createdRow.id,
    invalid_error_kind: invalidResponse.error?.code ?? null,
    read_only_error_kind: readOnlyResponse.error?.code ?? null,
    session_type_subscribes: subscribesAfter,
    ...webAuthored,
    ...targetIdProof,
    entity_error_terminal_state: "covered_in_unit_suite_not_live_see_report"
  };
}

/**
 * Records how many session_type subscribes the live run issued. A resubscribe loop -- the
 * failure mode the webrtcDaemonClient entity_error edit prevents -- would show up here as
 * a climbing count across the whole CRUD span.
 *
 * The terminal entity_error path itself is NOT exercised live: Hub only emits it on
 * genuine provider overflow (entity_provider_frame_too_large), and there is no injection
 * seam on the live transport. Adding one would mean putting a test-only frame entry point
 * into production code, which this ticket does not warrant. That behaviour is instead
 * proved against the real WebrtcDaemonClient in src/App.test.mjs, which delivers a real
 * chunked entity_error envelope and asserts the channel issues no further frames.
 */
async function recordSessionTypeSubscribeCount(page) {
  return page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) =>
        entry.kind === "daemon_request" &&
        entry.payload?.type === "subscribe_entities" &&
        entry.payload?.entity_type === "session_type").length
  );
}

async function proveExternalSessionLifecycle(page) {
  if (!webrtcDataDir) throw new Error("external session proof requires a WebRTC hub data directory");
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  const sessionId = "botster-web-external-session";
  const spawnResponse = await sendDaemonRequest(socketPath, {
    type: "spawn",
    session_id: sessionId,
    command: "sleep 30"
  });
  if (spawnResponse.error) {
    throw new Error(`external session spawn failed: ${JSON.stringify(spawnResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "session",
      id: sessionId,
      lifecycle: "running"
    },
    "externally spawned session upsert"
  );
  if (durableStateMode) {
    const diagnostics = page.getByTestId(HOST_CHROME.diagnosticsViewTestId);
    await diagnostics.waitFor();
    const sessionsPanel = diagnostics.locator(".entity-family-panel").filter({
      has: page.getByRole("heading", { name: HOST_CHROME.sessionsHeadingName, exact: true })
    });
    await sessionsPanel.getByText(/\d+ more records loaded\./).waitFor();
    if (await sessionsPanel.getByText(sessionId, { exact: true }).count() !== 0) {
      throw new Error("durable external session unexpectedly appeared inside the capped Diagnostics summary");
    }
  }
  await openHomeView(page);
  const sessionRow = page.getByTestId(HOST_CHROME.dashboardTestId).getByText(sessionId, { exact: true });
  await sessionRow.waitFor({ state: "visible" });
  const shutdownResponse = await sendDaemonRequest(socketPath, {
    type: "shutdown_session",
    session_id: sessionId
  });
  if (shutdownResponse.error) {
    throw new Error(`external session shutdown failed: ${JSON.stringify(shutdownResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "session", id: sessionId, lifecycle: "exited" },
    "external session exit patch"
  );
  const removeResponse = await sendDaemonRequest(socketPath, {
    type: "remove_session",
    session_id: sessionId
  });
  if (removeResponse.error) {
    throw new Error(`external session removal failed: ${JSON.stringify(removeResponse.error)}`);
  }
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", frameKind: "entity_remove", family: "session", id: sessionId },
    "external session removal"
  );
  await sessionRow.waitFor({ state: "detached" });
}

async function assertDurableSeededSessionsVisible(page) {
  const dashboard = page.getByTestId(HOST_CHROME.dashboardTestId);
  for (const sessionId of durableSeedSessionIds) {
    await dashboard.getByText(sessionId, { exact: true }).waitFor({ state: "visible" });
  }
}

async function startProductionSession() {
  if (!webrtcDataDir) throw new Error("production session proof requires a WebRTC hub data directory");
  const scriptPath = join(webrtcDataDir, "botster-web-production-session.sh");
  await writeFile(
    scriptPath,
    [
      "echo botster-web-production-ready",
      "while IFS= read -r line; do",
      "  case \"$line\" in",
      "    botster-web-production-size) set -- $(stty size); echo botster-web-production-size:${1}x${2} ;;",
      "    botster-web-production-exit) echo botster-web-production-exiting; exit 0 ;;",
      "    *) echo botster-web-production-echo:$line ;;",
      "  esac",
      "done"
    ].join("\n")
  );
  const response = await sendDaemonRequest(join(webrtcDataDir, "botster-hub.sock"), {
    type: "spawn",
    session_id: productionSessionId,
    command: `sh ${scriptPath}`
  });
  if (response.error) {
    throw new Error(`production session spawn failed: ${JSON.stringify(response.error)}`);
  }
}

async function shutdownProductionSession() {
  if (!webrtcDataDir) throw new Error("session shutdown proof requires a WebRTC hub data directory");
  const response = await sendDaemonRequest(join(webrtcDataDir, "botster-hub.sock"), {
    type: "shutdown_session",
    session_id: productionSessionId
  });
  if (response.error) {
    throw new Error(`production session shutdown failed: ${JSON.stringify(response.error)}`);
  }
}

async function assertNoGrantSecretLeak(page, cycle) {
  const leakedRequests = await page.evaluate(() => {
    const leakedValues = [];
    const visit = (value, path) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
        return;
      }
      for (const [key, nextValue] of Object.entries(value)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (key === "grant_secret" && nextValue !== "[redacted]") {
          leakedValues.push({ path: nextPath, value: nextValue });
        }
        visit(nextValue, nextPath);
      }
    };
    visit(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [], "events");
    return leakedValues;
  });

  if (leakedRequests.length > 0) {
    throw new Error(`same-URL reload cycle ${cycle} leaked local WebRTC grant_secret in harness events`);
  }
}

async function waitForTransportLabel(page) {
  const expectedDataPlane = "WebRTC DataChannel";
  const expectedLayer = "Local WebRTC signaling ready";
  await page.waitForFunction(
    ({ expectedDataPlane, expectedLayer }) => {
      const text = globalThis.document.body?.innerText ?? "";
      return text.includes(expectedDataPlane) && text.includes(expectedLayer);
    },
    { expectedDataPlane, expectedLayer },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for visible ${expectedDataPlane} transport label: ${error.message}`);
  });
}

async function assertCurrentHubCompatibilityAndSchema(page) {
  // Collect both shapes: the authoritative DaemonStatus response and the
  // botster-web.hub_status projection of it. The projection renames host_display_name to
  // title, so asserting identity needs the raw record, while proving statusRecord() carries
  // software/installation needs the projected one.
  const observed = await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      let raw;
      let projected;
      for (const entry of events) {
        if (entry.kind === "daemon_response" && entry.payload?.kind === "status" && entry.payload?.status) {
          raw = entry.payload.status;
        }
        if (
          entry.kind === "hub_frame" &&
          entry.payload?.kind === "entity_snapshot" &&
          entry.payload?.payload?.family === "botster-web.hub_status"
        ) {
          const record = entry.payload.payload.records?.find((candidate) => candidate?.id === "local-hub");
          if (record) projected = record;
        }
      }
      return raw ? { raw, projected: projected ?? null } : false;
    },
    undefined,
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for structured hub status: ${error.message}`);
  });

  const status = observed.raw;
  // statusRecord() must carry software and installation through the projection, and must
  // still merge diagnostics after that addition.
  const projected = observed.projected;
  if (!projected) {
    throw new Error("botster-web.hub_status was never projected from the DaemonStatus response");
  }
  for (const field of ["software", "installation"]) {
    if (!projected[field] || typeof projected[field] !== "object") {
      throw new Error(
        `botster-web.hub_status projection dropped ${field}: ${JSON.stringify(projected)}`
      );
    }
    if (JSON.stringify(projected[field]) !== JSON.stringify(status[field])) {
      throw new Error(
        `botster-web.hub_status ${field} does not match DaemonStatus: ` +
        `${JSON.stringify({ projected: projected[field], status: status[field] })}`
      );
    }
  }
  if (!Array.isArray(projected.diagnostics)) {
    throw new Error(`botster-web.hub_status lost its merged diagnostics: ${JSON.stringify(projected)}`);
  }

  const compatibility = status?.compatibility;
  const protocol = compatibility?.protocol;
  const protocolVersion = compatibility?.protocol_version;
  const revision = compatibility?.conformance_fixture_revision;
  const features = Array.isArray(compatibility?.features) ? compatibility.features : [];
  const requiredFeatures = [
    "sessions",
    "terminal_streaming",
    "resize",
    "terminal_readback",
    "plugin_surface_render",
    "plugin_surface_action"
  ];
  const missingFeatures = requiredFeatures.filter((feature) => !features.includes(feature));
  // Schema is a floor, not an equality. The previous `!== 2` assertion failed against a
  // protocol-6 Hub reporting schema 3; pinning it to 3 would only relocate that failure to
  // the next Hub schema bump. Protocol and conformance already used floors.
  if (
    !Number.isInteger(status?.schema_version) ||
    status.schema_version < 3 ||
    protocol !== "botster-hub-daemon-v1" ||
    !Number.isInteger(protocolVersion) ||
    protocolVersion < 6 ||
    !Number.isInteger(revision) ||
    revision < 31 ||
    missingFeatures.length > 0
  ) {
    throw new Error(
      `unexpected current Hub status: schema=${String(status?.schema_version)}, protocol=${String(protocol)}, ` +
      `protocol_version=${String(protocolVersion)}, conformance_fixture_revision=${String(revision)}, ` +
      `missing_features=${missingFeatures.join(",") || "none"}`
    );
  }
  return status;
}

async function assertCurrentHubSchemaPresentation(page, status) {
  const reportedSchemaVersion = requiredProvenanceField(status, "schema_version", "status");
  const schemaRow = page.locator(`[data-diagnostic-id="${HOST_CHROME.schemaDiagnosticId}"]`);
  await schemaRow.waitFor();
  const schemaText = await schemaRow.innerText();
  // The point of this assertion is neutrality -- Hub's durable-state schema is reported as
  // server context and never blocks the client (botster-web commit 2246678). Pinning the
  // literal version made it fail on any Hub newer than schema 2, which is the same
  // pre-2246678 survivor as the compatibility floor above. Assert the neutrality, not the number.
  if (
    !schemaText.includes("Hub durable-state schema") ||
    !schemaText.includes(`schema version ${reportedSchemaVersion}`) ||
    !schemaText.includes("Info / server") ||
    /Blocked|mismatch|expected schema/i.test(schemaText)
  ) {
    throw new Error(
      `schema diagnostic is not neutral schema-${String(reportedSchemaVersion)} context: ${schemaText}`
    );
  }

  const hubCard = page.getByRole("heading", { name: HOST_CHROME.hubHeadingName, exact: true }).locator("xpath=ancestor::article[1]");
  const hubCardText = await hubCard.innerText();
  if (!hubCardText.includes("Healthy") || hubCardText.includes("Blocked")) {
    throw new Error(
      `schema ${String(reportedSchemaVersion)} incorrectly blocked the Local Hub first-screen row: ${hubCardText}`
    );
  }
}

/**
 * Reconnect proof on a SURVIVING document.
 *
 * The two reload cycles elsewhere in this harness navigate, which remounts App and re-runs
 * the initial pullProductionEntity("hubStatus") chain — so a fresh status projection there
 * cannot show the data-channel-open listener is load-bearing. This closes the real live data
 * channel in place, lets the client take its ordinary transport-loss path, and proves the
 * listener re-pulls hub_status on the same document.
 */
async function proveInPageReconnectReplaysHubStatus(page, expectedIdentity) {
  // Stamp the live document so a navigation would be detectable rather than assumed.
  await page.evaluate(() => {
    globalThis.__BOTSTER_RECONNECT_DOCUMENT_SENTINEL__ = "in-page-reconnect";
  });

  const statusRequestsBefore = await daemonRequestCount(page, { type: "status" });
  const openEventsBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open").length
  );
  const hubStatusFramesBefore = await hubStatusProjectionCount(page);

  const closed = await page.evaluate(
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.closeDataChannel?.() ?? false
  );
  if (!closed) {
    throw new Error("in-page reconnect proof could not close the live WebRTC data channel");
  }

  // The channel must actually be observed closed, then reopened by the client itself.
  await page.waitForFunction(
    () => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .some((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "closed"),
    undefined,
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`in-page reconnect never observed a data-channel close: ${error.message}`);
  });
  await page.waitForFunction(
    ({ before }) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open").length > before,
    { before: openEventsBefore },
    { timeout: 20_000 }
  ).catch((error) => {
    throw new Error(`in-page reconnect never reopened the data channel: ${error.message}`);
  });

  // The listener must issue a fresh status request and a fresh hub_status projection.
  await page.waitForFunction(
    ({ before }) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "daemon_request" && entry.payload?.type === "status").length > before,
    { before: statusRequestsBefore },
    { timeout: 20_000 }
  ).catch((error) => {
    throw new Error(
      `data-channel-open did not re-pull botster-web.hub_status on the surviving document: ${error.message}`
    );
  });
  await page.waitForFunction(
    ({ before }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.filter((entry) =>
        entry.kind === "hub_frame" &&
        entry.payload?.kind === "entity_snapshot" &&
        entry.payload?.payload?.family === "botster-web.hub_status").length > before;
    },
    { before: hubStatusFramesBefore },
    { timeout: 20_000 }
  ).catch((error) => {
    throw new Error(`reconnect produced no fresh botster-web.hub_status projection: ${error.message}`);
  });

  // The document was never replaced, so this is genuinely the in-page path.
  const sentinel = await page.evaluate(() => globalThis.__BOTSTER_RECONNECT_DOCUMENT_SENTINEL__);
  if (sentinel !== "in-page-reconnect") {
    throw new Error("in-page reconnect proof navigated; the document was replaced");
  }

  const evidence = assertHubStatusRehydrated(
    await hubStatusRehydrationEvidence(page),
    expectedIdentity,
    "in-page data-channel reconnect"
  );
  // And the rendered General section still shows the authoritative values.
  const rendered = await assertAuthoritativeHubIdentity(page, {
    software: { product_name: expectedIdentity.product_name, version: expectedIdentity.version },
    installation: { mode: expectedIdentity.mode, provenance: expectedIdentity.provenance },
    compatibility: {
      protocol: expectedIdentity.protocol,
      protocol_version: expectedIdentity.protocol_version,
      conformance_fixture_revision: expectedIdentity.conformance_fixture_revision
    },
    host_display_name: expectedIdentity.host_display_name,
    host_id: expectedIdentity.host_id,
    schema_version: expectedIdentity.schema_version
  }, "in-page data-channel reconnect");
  return { ...evidence, rendered_after_reconnect: rendered };
}

async function hubStatusProjectionCount(page) {
  return page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) =>
      entry.kind === "hub_frame" &&
      entry.payload?.kind === "entity_snapshot" &&
      entry.payload?.payload?.family === "botster-web.hub_status").length);
}

/**
 * Per-generation hub_status hydration evidence. A reconnect that failed to re-hydrate would
 * leave the newest generation without its own status response and hub_status projection.
 */
async function hubStatusRehydrationEvidence(page) {
  return page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      let generation = 0;
      let statusRequests = 0;
      let latestRecord;
      for (const entry of events) {
        if (entry.kind === "webrtc_response_assembly" && Number.isInteger(entry.payload?.generation)) {
          generation = Math.max(generation, entry.payload.generation);
        }
        if (entry.kind === "daemon_request" && entry.payload?.type === "status") statusRequests += 1;
        if (
          entry.kind === "hub_frame" &&
          entry.payload?.kind === "entity_snapshot" &&
          entry.payload?.payload?.family === "botster-web.hub_status"
        ) {
          const record = entry.payload.payload.records?.find((candidate) => candidate?.id === "local-hub");
          if (record) latestRecord = record;
        }
      }
      return latestRecord ? { generation, statusRequests, record: latestRecord } : false;
    },
    undefined,
    { timeout: 20_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for hub_status rehydration evidence: ${error.message}`);
  });
}

function assertHubStatusRehydrated(evidence, expectedIdentity, label) {
  const record = evidence.record;
  const compatibility = record.compatibility ?? {};
  const observed = {
    product_name: record.software?.product_name,
    version: record.software?.version,
    mode: record.installation?.mode,
    provenance: record.installation?.provenance,
    protocol: compatibility.protocol,
    protocol_version: compatibility.protocol_version,
    conformance_fixture_revision: compatibility.conformance_fixture_revision,
    schema_version: record.schema_version,
    host_id: record.host_id
  };
  for (const [field, value] of Object.entries(observed)) {
    if (value === undefined || value === null || value === "") {
      throw new Error(`hub_status regressed to unreported ${field} (${label}): ${JSON.stringify(record)}`);
    }
    if (String(expectedIdentity[field]) !== String(value)) {
      throw new Error(
        `hub_status ${field} changed (${label}): ${String(expectedIdentity[field])} -> ${String(value)}`
      );
    }
  }
  if (evidence.statusRequests < 2) {
    throw new Error(
      `reconnect did not issue a fresh status request (${label}): ${JSON.stringify(evidence)}`
    );
  }
  return { generation: evidence.generation, status_requests: evidence.statusRequests, ...observed };
}

async function openHubGeneralView(page) {
  await page.locator("ion-menu.app-sidebar").getByRole("button", { name: HOST_CHROME.hubSettingsNavButtonName, exact: true }).click();
  await page.getByLabel(HOST_CHROME.hubSettingsSectionsLabel).getByRole("button", { name: /^General/ }).click();
  const general = page.getByTestId(HOST_CHROME.hubSettingsGeneralTestId);
  await general.waitFor();
  return general;
}

/**
 * Rendered-DOM proof that Hub identity comes from DaemonStatus. requiredProvenanceField
 * throws on undefined/null/"" and is therefore the "must never regress to unknown"
 * invariant applied to the structured facts; each fact is then matched against the text
 * the user actually sees in the General section.
 */
async function assertAuthoritativeHubIdentity(page, status, label) {
  const software = requiredProvenanceField(status, "software", "status");
  const installation = requiredProvenanceField(status, "installation", "status");
  const compatibility = requiredProvenanceField(status, "compatibility", "status");
  const expected = {
    product_name: requiredProvenanceField(software, "product_name", "status.software"),
    version: requiredProvenanceField(software, "version", "status.software"),
    mode: requiredProvenanceField(installation, "mode", "status.installation"),
    provenance: requiredProvenanceField(installation, "provenance", "status.installation"),
    host_display_name: requiredProvenanceField(status, "host_display_name", "status"),
    host_id: requiredProvenanceField(status, "host_id", "status"),
    protocol: requiredProvenanceField(compatibility, "protocol", "status.compatibility"),
    protocol_version: requiredProvenanceField(compatibility, "protocol_version", "status.compatibility"),
    conformance_fixture_revision: requiredProvenanceField(compatibility, "conformance_fixture_revision", "status.compatibility"),
    schema_version: requiredProvenanceField(status, "schema_version", "status")
  };

  const general = await openHubGeneralView(page);
  const softwareText = await general.getByTestId(HOST_CHROME.hubSoftwareIdentityTestId).innerText();
  const hostText = await general.getByTestId(HOST_CHROME.hubHostIdentityTestId).innerText();
  const internalText = await general.getByTestId(HOST_CHROME.hubInternalStateTestId).innerText();
  const renderedText = `${softwareText}\n${hostText}\n${internalText}`;

  const missing = [];
  for (const [field, value] of Object.entries(expected)) {
    if (!renderedText.includes(String(value))) missing.push(`${field}=${String(value)}`);
  }
  // Optional facts are proven only when the Hub reports them.
  for (const [field, value] of [
    ["build_revision", software.build_revision],
    ["release_channel", installation.release_channel],
    ["provider", installation.provider]
  ]) {
    if (typeof value === "string" && value !== "" && !renderedText.includes(value)) {
      missing.push(`${field}=${value}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Hub General (${label}) did not render authoritative identity: missing ${missing.join(", ")} in ${renderedText}`
    );
  }
  if (/Not reported|unknown/i.test(renderedText)) {
    throw new Error(`Hub General (${label}) regressed to an unreported value: ${renderedText}`);
  }

  // State schema is rendered but stays secondary to user-facing software status.
  const ordering = await general.evaluate((section) =>
    Array.from(section.querySelectorAll("[data-testid]"), (node) => node.getAttribute("data-testid"))
  );
  if (ordering.indexOf("hub-software-identity") > ordering.indexOf("hub-internal-state")) {
    throw new Error(`Hub General (${label}) state schema is not secondary: ${ordering.join(", ")}`);
  }
  if (!/State schema/.test(internalText)) {
    throw new Error(`Hub General (${label}) does not render the state schema at all: ${internalText}`);
  }
  const secondaryClass = await general.getByTestId(HOST_CHROME.hubInternalStateTestId).getAttribute("class");
  if (!String(secondaryClass).includes("hub-metadata-secondary")) {
    throw new Error(`Hub General (${label}) internal-state block is not marked secondary: ${String(secondaryClass)}`);
  }
  // Visibly secondary, not merely class-tagged: the internal-state labels must render
  // smaller than the software-status labels.
  const emphasis = await general.evaluate((section) => {
    const labelSize = (testId) => {
      const term = section.querySelector(`[data-testid="${testId}"] dt`);
      return term ? Number.parseFloat(globalThis.getComputedStyle(term).fontSize) : Number.NaN;
    };
    return { software: labelSize("hub-software-identity"), internal: labelSize("hub-internal-state") };
  });
  if (!(emphasis.internal < emphasis.software)) {
    throw new Error(
      `Hub General (${label}) internal state is not visually secondary: ${JSON.stringify(emphasis)}`
    );
  }
  return expected;
}

/**
 * Clicks the real Check for updates control against the live Hub and asserts the rendered
 * outcome against the Hub's own state/reason/action. Nothing is invented client-side, so
 * whatever a development checkout actually returns is what must appear.
 */
async function assertHubUpdateCheck(page) {
  const general = await openHubGeneralView(page);
  await general.getByTestId(HOST_CHROME.hubSoftwareUpdateTestId)
    .getByRole("button", { name: HOST_CHROME.checkForUpdatesButtonName, exact: true })
    .click();
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "check_hub_update" }, "check_hub_update request");
  const hubUpdate = await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const entry = events[index];
        if (entry.kind === "action_result" && entry.payload?.result?.request_type === "check_hub_update") {
          return { accepted: entry.payload.accepted === true, reason: entry.payload.reason ?? null, update: entry.payload.result.hub_update ?? null };
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "action_result" &&
            entry.payload?.payload?.result?.request_type === "check_hub_update") {
          const payload = entry.payload.payload;
          return { accepted: payload.accepted === true, reason: payload.reason ?? null, update: payload.result.hub_update ?? null };
        }
        if (entry.kind === "daemon_response" && entry.payload?.kind === "hub_update") {
          return { accepted: !entry.payload.error, reason: entry.payload.error?.message ?? null, update: entry.payload.hub_update ?? null };
        }
      }
      return null;
    },
    undefined,
    { timeout: 20_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for a structured check_hub_update result: ${error.message}`);
  });

  const updateRegion = general.getByTestId(HOST_CHROME.hubSoftwareUpdateTestId);
  const outcomeText = await general.getByTestId(HOST_CHROME.hubUpdateOutcomeTestId).innerText();
  const renderedState = await updateRegion.getAttribute("data-hub-update-state");
  const evidence = JSON.stringify({ hubUpdate, outcomeText, renderedState });

  if (!hubUpdate.accepted || !hubUpdate.update) {
    // A rejected check must render from the rejection and must not invent an update state.
    if (renderedState !== null) {
      throw new Error(`rejected check_hub_update synthesized a DaemonHubUpdateState: ${evidence}`);
    }
    if (!/Update check failed/.test(outcomeText)) {
      throw new Error(`rejected check_hub_update did not render a failure outcome: ${evidence}`);
    }
    return { ...hubUpdate, outcomeText, renderedState };
  }

  const state = requiredProvenanceField(hubUpdate.update, "state", "hub_update");
  if (!["current", "available", "unavailable"].includes(state)) {
    throw new Error(`Hub reported an unknown DaemonHubUpdateState: ${evidence}`);
  }
  if (renderedState !== state) {
    throw new Error(`rendered update state does not match the Hub-reported state: ${evidence}`);
  }
  requiredProvenanceField(hubUpdate.update, "current_version", "hub_update");
  // Hub-provided reason and action render verbatim, never remapped to client copy.
  for (const [field, testId] of [["reason", "hub-update-outcome"], ["action", "hub-update-action"]]) {
    const value = hubUpdate.update[field];
    if (typeof value !== "string" || value === "") continue;
    const rendered = await general.getByTestId(testId).innerText();
    if (!rendered.includes(value)) {
      throw new Error(`Hub-provided ${field} was not rendered verbatim: ${evidence}`);
    }
  }
  if (state === "available") {
    const availableVersion = requiredProvenanceField(hubUpdate.update, "available_version", "hub_update");
    if (!outcomeText.includes(String(availableVersion))) {
      throw new Error(`available update did not render the Hub-reported version: ${evidence}`);
    }
  }
  return { ...hubUpdate, outcomeText, renderedState };
}

/**
 * The ticket requires diagnostics stay usable for support, and this change edits both
 * statusRecord() and the action-result projection, so both are asserted rather than assumed.
 */
async function assertHubUpdateSupportDiagnostics(page) {
  const projected = await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      let statusDiagnostics;
      let updateDiagnostics;
      for (const entry of events) {
        if (
          entry.kind === "hub_frame" &&
          entry.payload?.kind === "entity_snapshot" &&
          entry.payload?.payload?.family === "botster-web.hub_status"
        ) {
          const record = entry.payload.payload.records?.find((candidate) => candidate?.id === "local-hub");
          if (record && Array.isArray(record.diagnostics)) statusDiagnostics = record.diagnostics;
        }
        const actionResult = entry.kind === "action_result"
          ? entry.payload
          : entry.kind === "hub_frame" && entry.payload?.kind === "action_result"
            ? entry.payload.payload
            : undefined;
        if (actionResult?.result?.request_type === "check_hub_update") {
          updateDiagnostics = actionResult.result.diagnostics ?? null;
        }
      }
      return statusDiagnostics === undefined || updateDiagnostics === undefined
        ? false
        : { statusDiagnostics, updateDiagnostics };
    },
    undefined,
    { timeout: 20_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for hub_status and check_hub_update diagnostics: ${error.message}`);
  });

  // statusRecord() still merges status.diagnostics with response diagnostics after
  // software/installation were added to the projection.
  if (!Array.isArray(projected.statusDiagnostics)) {
    throw new Error(`hub_status lost its diagnostics array: ${JSON.stringify(projected)}`);
  }
  // The check_hub_update action result carries Hub response diagnostics in the same shape
  // as the botster.spawn_target.daemon_request branch.
  if (!Array.isArray(projected.updateDiagnostics)) {
    throw new Error(`check_hub_update result did not carry a diagnostics array: ${JSON.stringify(projected)}`);
  }
  const supportView = page.getByTestId(HOST_CHROME.diagnosticsViewTestId);
  await supportView.waitFor();
  return projected;
}

async function waitForRemoteAccessPackageConfiguration(page) {
  return page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const daemonPackages = [];
      const projectedPackages = [];
      for (const entry of events) {
        if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
          daemonPackages.push(...(entry.payload.packages ?? []));
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
          const payload = entry.payload.payload;
          if (payload?.family === "botster-web.package") {
            projectedPackages.push(...(payload.records ?? []));
          }
        }
      }
      const daemonPackage = daemonPackages.find((record) => record.package_name === "botster-web");
      const projectedPackage = projectedPackages.find((record) => record.id === "botster-web");
      const rawField = (daemonPackage?.configuration?.schema?.fields ?? []).find(
        (field) => field.key === "remote_browser_rendezvous_enabled"
      );
      const projectedField = (projectedPackage?.configuration_fields ?? []).find(
        (field) => field.id === "remote_browser_rendezvous_enabled"
      );
      const rawAction = (daemonPackage?.actions ?? []).find(
        (action) => action.action_id === "set_package_configuration"
      );
      const rawEffectiveValue =
        daemonPackage?.configuration?.effective_values?.remote_browser_rendezvous_enabled?.value;
      const projectedEffectiveValue = projectedField?.value;
      const rawReady =
        rawField?.type === "boolean" &&
        (rawField?.default?.value ?? rawField?.default) === false &&
        typeof rawEffectiveValue === "boolean" &&
        rawAction?.status === "available" &&
        rawAction?.request?.request_type === "set_package_configuration";
      const projectedReady =
        projectedField?.config_type === "boolean" &&
        projectedField?.kind === "checkbox" &&
        typeof projectedEffectiveValue === "boolean" &&
        projectedPackage?.configuration_submit?.disabled === false &&
        projectedPackage?.configuration_submit?.params?.daemon_request?.request_type === "set_package_configuration";
      return rawReady && projectedReady && rawEffectiveValue === projectedEffectiveValue
        ? { effectiveValue: projectedEffectiveValue }
        : false;
    },
    undefined,
    { timeout: 45_000 }
  ).then((handle) => handle.jsonValue())
    .then((result) => result.effectiveValue)
    .catch((error) => {
      throw new Error(`timed out waiting for manifest-sourced botster-web remote access configuration: ${error.message}`);
    });
}

async function assertRemoteAccessSettingsDispatch(page, originalValue) {
  const nextValue = !originalValue;
  let dispatchError;
  let restorationError;
  try {
    await page.getByRole("button", { name: "Settings for botster web", exact: true }).click();
    await page.getByText(HOST_CHROME.packageConfigurationLabel).waitFor();
    await page.getByText(HOST_CHROME.remoteBrowserAccessHeading).first().waitFor();
    const remoteAccessLabelCount = await page.getByText(HOST_CHROME.remoteBrowserAccessHeading).count();
    if (remoteAccessLabelCount !== 1) {
      throw new Error(`live packaged protocol expected one Remote browser access label, observed ${remoteAccessLabelCount}`);
    }
    await page.getByText(
      originalValue
        ? "Remote browser rendezvous is opted in."
        : "Remote browser rendezvous is off."
    ).waitFor();
    await page.getByText("Local installed access stays available. Remote access requires opt-in, pairing, and device approval.").waitFor();
    await page.getByRole("button", { name: originalValue ? "Opt out" : "Opt in" }).click();
    await waitForRemoteAccessConfigRequest(page, nextValue);
    await page.getByText("Package action accepted").waitFor();
    await closePackageSettingsRoute(page);
    await page.getByText(HOST_CHROME.packageConfigurationLabel).waitFor({ state: "detached" });
  } catch (error) {
    dispatchError = error;
  } finally {
    if (!ownsWebrtcDataDir) {
      try {
        await restoreRemoteAccessConfiguration(originalValue);
      } catch (error) {
        console.error(`live caller-owned remote access configuration restoration failed ${JSON.stringify({
          attempted_value: originalValue,
          error: error instanceof Error ? error.message : String(error)
        })}`);
        restorationError = error;
      }
    }
  }
  if (dispatchError) throw dispatchError;
  if (restorationError) throw restorationError;
}

async function restoreRemoteAccessConfiguration(value) {
  const response = await sendDaemonRequest(join(webrtcDataDir, "botster-hub.sock"), {
    type: "set_package_configuration",
    package_name: "botster-web",
    values: {
      remote_browser_rendezvous_enabled: {
        type: "boolean",
        value
      }
    }
  });
  if (response.error) {
    throw new Error(`could not restore caller-owned remote access configuration: ${JSON.stringify(response)}`);
  }
  console.log(`live caller-owned remote access configuration restored ${JSON.stringify({
    original_value: value,
    restored_value: value
  })}`);
}

async function waitForRemoteAccessConfigRequest(page, value) {
  await page.waitForFunction(
    ({ expectedValue }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        const payload = entry.payload ?? {};
        return (
          entry.kind === "daemon_request" &&
          payload.type === "set_package_configuration" &&
          payload.package_name === "botster-web" &&
          payload.values?.remote_browser_rendezvous_enabled?.type === "boolean" &&
          payload.values?.remote_browser_rendezvous_enabled?.value === expectedValue
        );
      });
    },
    { expectedValue: value },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for remote access set_package_configuration=${value}: ${error.message}`);
  });
}

async function waitForTerminalOutput(page, text) {
  await page.waitForFunction(
    ({ expectedText }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some(
        (entry) => entry.kind === "output" && String(entry.payload?.data ?? "").includes(expectedText)
      ),
    { expectedText: text },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal output ${text}: ${error.message}`);
  });
}

async function waitForTerminalRendererWrite(page, text) {
  await page.waitForFunction(
    ({ expectedText }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some(
        (entry) => entry.kind === "renderer_write" && String(entry.payload?.data ?? "").includes(expectedText)
      ),
    { expectedText: text },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for mounted terminal renderer write ${text}: ${error.message}`);
  });
}

async function proveLiveTerminalAfterAttach(page, probe) {
  await waitForTerminalAttachState(page, ["attached"]);
  await callTerminalControl(page, "writeInput", `${probe}\n`);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "send_input", data: `${probe}\n` },
    `post-attach live input ${probe}`
  );
  await waitForTerminalOutput(page, `botster-web-production-echo:${probe}`);
  await waitForTerminalRendererWrite(page, `botster-web-production-echo:${probe}`);
}

async function waitForTerminalCanvas(page) {
  await page.waitForFunction(
    () => {
      const canvas = globalThis.document.querySelector(".terminal-view-container canvas");
      if (canvas?.tagName !== "CANVAS") return false;
      const bounds = canvas.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    },
    undefined,
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for mounted Restty canvas: ${error.message}`);
  });
}


async function proveMountedMouseModeGatedInput(page) {
  // Enable normal + SGR mouse tracking in the session, then require ModeGatedInput
  // for a real pointer event (proves cache refresh after mouse_mode 0 → 9).
  await callTerminalControl(page, "writeInput", "printf '\\033[?1000h\\033[?1006h'\n");
  await new Promise((r) => setTimeout(r, 400));
  // Confirm authoritative modes see mouse tracking when ReadModeFlags is available.
  const modes = await page.evaluate(() => {
    // Mode flags land via attach hydration telemetry when available.
    const modeEntry = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [])
      .filter((entry) => entry.kind === "mode_flags")
      .at(-1);
    return modeEntry?.payload ?? null;
  });
  const before = await daemonRequestCount(page, { type: "mode_gated_input" });
  // Real Playwright pointer path (synthetic PointerEvent trips setPointerCapture).
  const canvas = page.locator(".terminal-view-container canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 10_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("mouse path: terminal canvas has no bounding box");
  const x = box.x + Math.min(40, Math.max(4, box.width / 4));
  const y = box.y + Math.min(40, Math.max(4, box.height / 4));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(
    ({ beforeCount }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter(
        (entry) => entry.kind === "daemon_request" && entry.payload?.type === "mode_gated_input"
      ).length > beforeCount,
    { beforeCount: before },
    { timeout: 8_000 }
  ).catch(async (error) => {
    const after = await daemonRequestCount(page, { type: "mode_gated_input" });
    const telemetry = await page.evaluate(() =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).slice(-12)
    );
    throw new Error(
      `mouse DECSET 1000/1006 path did not produce mode_gated_input (before=${before} after=${after} modes=${JSON.stringify(modes)}): ${error.message}; telemetry=${JSON.stringify(telemetry)}`
    );
  });
  const after = await daemonRequestCount(page, { type: "mode_gated_input" });
  if (after <= before) {
    throw new Error(`expected mode_gated_input after enabled mouse; delta=${after - before}`);
  }
  recordProofNote("mouse_path", {
    mode_gated_delta: after - before,
    modes,
    decset: ["1000", "1006"]
  });
}

async function proveZeroBrowserOscColorReplies(page) {
  const replies = await page.evaluate(() => {
    const terminal = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    const inputs = terminal
      .filter((entry) => entry.kind === "pty_send_input" || entry.kind === "input" || entry.kind === "mode_gated_input")
      .map((entry) => String(entry.payload?.data ?? entry.payload?.bytes ?? ""));
    // OSC color replies look like ESC ] 10/11/12 ; ... BEL or ST
    const oscColor = inputs.filter((data) => data.includes("]10;") || data.includes("]11;") || data.includes("]12;"));
    return { total_inputs: inputs.length, osc_color_replies: oscColor };
  });
  if (replies.osc_color_replies.length > 0) {
    throw new Error(`browser emitted OSC color replies: ${JSON.stringify(replies.osc_color_replies)}`);
  }

  // Stimulus: feed OSC color queries through the renderer write path (as PTY output).
  // readOnly + suppressQueryReplies must keep replies off the PTY input sink.
  const before = await daemonRequestCount(page, { type: "mode_gated_input" });
  const beforeSend = await daemonRequestCount(page, { type: "send_input" });
  await page.evaluate(() => {
    const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    // Directly exercise Restty write path if exposed via last renderer write sink.
    const container = globalThis.document.querySelector(".terminal-view-container");
    if (!container) throw new Error("terminal container missing for OSC stimulus");
    // Inject as if PTY produced queries by using terminal control if available.
    harness?.terminal?.push({ kind: "osc_stimulus", payload: { queries: ["10", "11", "12"] } });
  });
  // Write OSC queries into the live session via shell printf if the session is a shell,
  // otherwise rely on the absence of prior replies. Production sessions echo markers.
  await callTerminalControl(page, "writeInput", "printf '\\033]10;?\\007\\033]11;?\\007\\033]12;?\\007'\n").catch(() => undefined);
  await new Promise((r) => setTimeout(r, 400));
  const afterInputs = await page.evaluate(() => {
    const terminal = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    return terminal
      .filter((entry) => entry.kind === "pty_send_input" || entry.kind === "input" || entry.kind === "mode_gated_input")
      .map((entry) => String(entry.payload?.data ?? entry.payload?.bytes ?? ""))
      .filter((data) => (data.includes("]10;") || data.includes("]11;") || data.includes("]12;")) && (data.includes("rgb:") || data.includes("#")));
  });
  if (afterInputs.length > 0) {
    throw new Error(`OSC color query stimulus produced browser replies: ${JSON.stringify(afterInputs)}`);
  }
  recordProofNote("osc_color_mute", { before_mode_gated: before, before_send: beforeSend, replies: 0 });
}

async function provePaletteProjectionAfterOsc(page, sessionId) {
  // Drive an OSC palette change through the live session and require the mounted
  // Restty palette probe to report the exact expected color for index 1.
  const expectedColor = 0x00ff0000; // rgb:ffff/0000/0000 → 0x00RRGGBB
  const beforeColor = await page.evaluate(() => {
    const probe = globalThis.__BOTSTER_RESTTY_DEBUG__;
    const get = probe?.getPaletteColor ?? probe?.active?.getPaletteColor;
    if (typeof get !== "function") return null;
    return get(1);
  });
  if (beforeColor === null || beforeColor === undefined) {
    throw new Error("palette probe unavailable on mounted Restty renderer (__BOTSTER_RESTTY_DEBUG__.getPaletteColor)");
  }
  await callTerminalControl(page, "writeInput", "printf '\\033]4;1;rgb:ffff/0000/0000\\007'\n");
  await page.waitForFunction(
    ({ expected }) => {
      const probe = globalThis.__BOTSTER_RESTTY_DEBUG__;
      const get = probe?.getPaletteColor ?? probe?.active?.getPaletteColor;
      if (typeof get !== "function") return false;
      const color = get(1);
      return color === expected;
    },
    { expected: expectedColor },
    { timeout: 10_000 }
  ).catch(async (error) => {
    const after = await page.evaluate(() => {
      const probe = globalThis.__BOTSTER_RESTTY_DEBUG__;
      const get = probe?.getPaletteColor ?? probe?.active?.getPaletteColor;
      return typeof get === "function" ? get(1) : null;
    });
    throw new Error(
      `palette index 1 did not become 0x${expectedColor.toString(16)} after OSC: before=${beforeColor} after=${after}: ${error.message}`
    );
  });
  const capture = await callTerminalControl(page, "captureSnapshot");
  if (!capture || capture.session_id !== sessionId) {
    throw new Error(`palette path missing capture_snapshot for ${sessionId}: ${JSON.stringify(capture)}`);
  }
  const afterColor = await page.evaluate(() => globalThis.__BOTSTER_RESTTY_DEBUG__?.getPaletteColor?.(1) ?? null);
  recordProofNote("palette_projection", {
    capture_bytes: capture.payload_bytes,
    probe: { source: "restty", before: beforeColor, after: afterColor, expected: expectedColor }
  });
}

async function proveRetainedHistoryAfterEcho(page, echoProbe) {
  const readScreen = await callTerminalControl(page, "readScreen");
  if (!readScreen?.text?.includes(`botster-web-production-echo:${echoProbe}`)) {
    throw new Error(`history not retained in read_screen after echo: ${JSON.stringify(readScreen)}`);
  }
  // GHOSTSNP restore path must have installed before live flush for current subscription.
  const install = await page.evaluate(() => {
    const terminal = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    return terminal.findLast((entry) => entry.kind === "ghostsnp_install" || entry.kind === "restty_load_binary_snapshot");
  });
  if (!install) {
    throw new Error("missing GHOSTSNP install telemetry for retained history proof");
  }
  recordProofNote("retained_history", { echoProbe, install_bytes: install.payload?.bytes ?? null });
}

async function proveInPageTerminalDataChannelReconnect(page, sessionId) {
  // Surviving-document DataChannel recovery must mint a fresh terminal subscription
  // and re-run H0-H5 on the still-mounted view (no navigation).
  await page.evaluate(() => {
    globalThis.__BOTSTER_TERMINAL_RECONNECT_DOCUMENT_SENTINEL__ = "in-page-terminal-reconnect";
  });
  const openEventsBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open").length
  );
  const attachTelemetryBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "attach").length
  );
  const ghostsnpBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter(
      (entry) => entry.kind === "ghostsnp_install" || entry.kind === "restty_load_binary_snapshot"
    ).length
  );
  const subscriptionBefore = await page.evaluate(() => {
    const attaches = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter(
      (entry) => entry.kind === "attach" && entry.payload?.subscription_id
    );
    return attaches.at(-1)?.payload?.subscription_id ?? null;
  });
  const chronologyBefore = await assertTerminalAttachChronology(page, sessionId);
  if (!chronologyBefore.sequence?.includes("snapshot")) {
    throw new Error(`pre-reconnect chronology missing GHOSTSNP snapshot: ${JSON.stringify(chronologyBefore)}`);
  }
  const historyMarker = `botster-web-inpage-history:${Date.now().toString(36)}`;
  await typeThroughMountedTerminal(page, `echo ${historyMarker}\n`);
  await waitForTerminalOutput(page, historyMarker);

  const closed = await page.evaluate(
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.closeDataChannel?.() ?? false
  );
  if (!closed) {
    throw new Error("in-page terminal reconnect could not close the WebRTC data channel");
  }
  await page.waitForFunction(
    () =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).some(
        (entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "closed"
      ),
    undefined,
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`in-page terminal reconnect never observed a data-channel close: ${error.message}`);
  });
  await page.waitForFunction(
    ({ before }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter(
        (entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open"
      ).length > before,
    { before: openEventsBefore },
    { timeout: 30_000 }
  ).catch((error) => {
    throw new Error(`in-page terminal reconnect never reopened the data channel: ${error.message}`);
  });

  // Fresh terminal attach after transport recovery (new subscription + H0-H5).
  await page.waitForFunction(
    ({ before }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "attach")
        .length > before,
    { before: attachTelemetryBefore },
    { timeout: 30_000 }
  ).catch((error) => {
    throw new Error(`in-page terminal reconnect never reattached the terminal stream: ${error.message}`);
  });
  await page.waitForFunction(
    ({ before }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter(
        (entry) => entry.kind === "ghostsnp_install" || entry.kind === "restty_load_binary_snapshot"
      ).length > before,
    { before: ghostsnpBefore },
    { timeout: 30_000 }
  ).catch((error) => {
    throw new Error(`in-page terminal reconnect never reinstalled GHOSTSNP: ${error.message}`);
  });

  const subscriptionAfter = await page.evaluate(() => {
    const attaches = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter(
      (entry) => entry.kind === "attach" && entry.payload?.subscription_id
    );
    return attaches.at(-1)?.payload?.subscription_id ?? null;
  });
  if (!subscriptionAfter) {
    throw new Error("in-page terminal reconnect missing post-recovery subscription_id");
  }
  if (subscriptionBefore && subscriptionAfter === subscriptionBefore) {
    throw new Error(
      `in-page terminal reconnect reused subscription_id ${subscriptionAfter}; expected a fresh subscription`
    );
  }

  // Force terminal_output on the new subscription so H0–H5 chronology can complete.
  const liveKick = `botster-web-inpage-livekick:${Date.now().toString(36)}`;
  await typeThroughMountedTerminal(page, `echo ${liveKick}\n`);
  await waitForTerminalOutput(page, liveKick);

  const chronologyAfter = await assertTerminalAttachChronology(page, sessionId, subscriptionAfter);
  if (chronologyAfter.subscription_id !== subscriptionAfter) {
    throw new Error(
      `post-reconnect chronology subscription mismatch: expected ${subscriptionAfter}, got ${chronologyAfter.subscription_id}`
    );
  }
  if (!chronologyAfter.sequence?.includes("snapshot")) {
    throw new Error(`post-reconnect chronology missing GHOSTSNP snapshot: ${JSON.stringify(chronologyAfter)}`);
  }
  const snapshotIdx = chronologyAfter.sequence.indexOf("snapshot");
  const liveOutputIdx = chronologyAfter.sequence.indexOf("terminal_output");
  if (liveOutputIdx >= 0 && snapshotIdx > liveOutputIdx) {
    throw new Error(`post-reconnect snapshot-before-live violated: ${JSON.stringify(chronologyAfter.sequence)}`);
  }

  const sentinel = await page.evaluate(() => globalThis.__BOTSTER_TERMINAL_RECONNECT_DOCUMENT_SENTINEL__);
  if (sentinel !== "in-page-terminal-reconnect") {
    throw new Error("in-page terminal reconnect navigated; the document was replaced");
  }

  // Retained history AND post-reconnect output are both required (not either/or).
  const postProbe = `botster-web-inpage-post:${Date.now().toString(36)}`;
  await typeThroughMountedTerminal(page, `echo ${postProbe}\n`);
  await waitForTerminalOutput(page, postProbe);
  const readScreen = await callTerminalControl(page, "readScreen");
  if (!readScreen?.text?.includes(historyMarker)) {
    throw new Error(
      `in-page reconnect lost pre-reconnect history marker ${historyMarker}: ${JSON.stringify(readScreen)}`
    );
  }
  if (!readScreen?.text?.includes(postProbe)) {
    throw new Error(
      `in-page reconnect missing post-reconnect probe ${postProbe}: ${JSON.stringify(readScreen)}`
    );
  }

  // Ablation: with the recovery listener removed, DataChannel recovery must not mint a fresh attach.
  await proveTerminalReconnectListenerAblation(page, subscriptionAfter);

  recordProofNote("in_page_terminal_reconnect", {
    openEventsBefore,
    attachTelemetryBefore,
    ghostsnpBefore,
    subscriptionBefore,
    subscriptionAfter,
    chronologyBefore,
    chronologyAfter,
    historyMarker,
    postProbe,
    document_sentinel: sentinel,
    ablation: true
  });
}

async function proveTerminalReconnectListenerAblation(page, subscriptionAfterRecovery) {
  const attachBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "attach").length
  );
  const ablated = await page.evaluate(() => {
    const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    if (typeof harness?.disableTerminalTransportRecovery === "function") {
      harness.disableTerminalTransportRecovery();
      return true;
    }
    return false;
  });
  if (!ablated) {
    throw new Error(
      "reconnect-listener ablation unavailable: expose __BOTSTER_LIVE_PROTOCOL_HARNESS__.disableTerminalTransportRecovery"
    );
  }

  const openBefore = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter(
      (entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open"
    ).length
  );
  const closed = await page.evaluate(
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.closeDataChannel?.() ?? false
  );
  if (!closed) {
    throw new Error("ablation reconnect could not close the WebRTC data channel");
  }
  await page.waitForFunction(
    ({ before }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter(
        (entry) => entry.kind === "webrtc_data_channel" && entry.payload?.state === "open"
      ).length > before,
    { before: openBefore },
    { timeout: 30_000 }
  ).catch((error) => {
    throw new Error(`ablation reconnect never reopened the data channel: ${error.message}`);
  });
  // Allow time for a non-ablated path to reattach if the listener were still live.
  await new Promise((r) => setTimeout(r, 1500));
  const attachAfter = await page.evaluate(() =>
    (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "attach").length
  );
  if (attachAfter > attachBefore) {
    throw new Error(
      `ablation failed: fresh attach still occurred after recovery listener removal (before=${attachBefore} after=${attachAfter} lastSub=${subscriptionAfterRecovery})`
    );
  }
  recordProofNote("reconnect_listener_ablation", {
    attachBefore,
    attachAfter,
    subscriptionAfterRecovery
  });
}

async function waitForAutomaticTerminalRestore(page) {
  // GHOSTSNP-first hydrate: Snapshot install + ReadModeFlags (ReadScreen is optional supplement).
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "read_mode_flags" }, "automatic read_mode_flags request");
  const restoration = await page.waitForFunction(
    () => {
      const terminal = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
      const install = terminal.findLast((entry) => entry.kind === "ghostsnp_install" || entry.kind === "restty_load_binary_snapshot");
      const modeFlags = terminal.findLast((entry) => entry.kind === "mode_flags");
      const status = terminal.findLast(
        (entry) =>
          entry.kind === "status" &&
          entry.payload?.state === "attached" &&
          typeof entry.payload?.message === "string" &&
          entry.payload.message.includes("GHOSTSNP")
      );
      if (!install || !modeFlags || !status) return null;
      return {
        bytes: install.payload?.bytes ?? null,
        mode_generation: modeFlags.payload?.mode_generation ?? null,
        mode_revision: modeFlags.payload?.mode_revision ?? null,
        message: status.payload.message
      };
    },
    undefined,
    { timeout: 20_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for automatic GHOSTSNP restoration: ${error.message}`);
  });

  // Snapshot event should carry GHOSTSNP magic on the daemon event plane.
  const snapshotProof = await page.evaluate(() => {
    const events = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "daemon_event")
      .map((entry) => entry.payload)
      .filter((event) => event?.type === "snapshot" && typeof event.payload_base64 === "string");
    const latest = events.at(-1);
    if (!latest) return null;
    try {
      const raw = globalThis.atob(latest.payload_base64);
      return {
        bytes: latest.bytes,
        magic: raw.slice(0, 8),
        payload_encoding: latest.payload_encoding
      };
    } catch {
      return { error: "base64_decode_failed" };
    }
  });
  if (!snapshotProof || snapshotProof.magic !== "GHOSTSNP") {
    throw new Error(`automatic restore missing GHOSTSNP Snapshot event: ${JSON.stringify(snapshotProof)}`);
  }

  return {
    restored_chars: snapshotProof.bytes,
    ghostsnp_install: restoration,
    snapshot: snapshotProof
  };
}

async function assertTerminalAttachChronology(page, sessionId, requiredSubscriptionId) {
  const chronology = await page.waitForFunction(
    ({ expectedSessionId, requiredSubscriptionId: requiredSub }) => {
      const events = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "daemon_event")
        .map((entry) => entry.payload)
        .filter((event) =>
          event?.session_id === expectedSessionId &&
          typeof event.subscription_id === "string" &&
          ["attach_state", "snapshot", "scrollback", "terminal_output"].includes(event.type) &&
          (!requiredSub || event.subscription_id === requiredSub)
        );
      const subscriptionIds = [...new Set(events.map((event) => event.subscription_id))];
      if (requiredSub && !subscriptionIds.includes(requiredSub)) {
        return null;
      }

      for (const subscriptionId of subscriptionIds) {
        const subscriptionEvents = events.filter((event) => event.subscription_id === subscriptionId);
        for (let attachingIndex = 0; attachingIndex < subscriptionEvents.length; attachingIndex += 1) {
          const attaching = subscriptionEvents[attachingIndex];
          if (attaching.type !== "attach_state" || attaching.state !== "attaching") continue;

          const attachedIndex = subscriptionEvents.findIndex(
            (event, index) =>
              index > attachingIndex && event.type === "attach_state" && event.state === "attached"
          );
          if (attachedIndex < 0) continue;

          const liveIndex = subscriptionEvents.findIndex(
            (event, index) =>
              index > attachedIndex && event.type === "terminal_output" &&
              typeof event.data === "string" && event.data.length > 0
          );
          if (liveIndex < 0) continue;

          const initialEvents = subscriptionEvents.slice(attachingIndex, liveIndex + 1);
          const attachedOffset = attachedIndex - attachingIndex;
          const earlyLive = initialEvents.findIndex(
            (event, index) => index < attachedOffset && event.type === "terminal_output"
          );
          if (earlyLive >= 0) {
            return {
              error: "terminal output arrived before attached",
              subscription_id: subscriptionId,
              observed: initialEvents
            };
          }
          const lateHistory = initialEvents.findIndex(
            (event, index) => index > attachedOffset &&
              (event.type === "snapshot" || event.type === "scrollback")
          );
          if (lateHistory >= 0) {
            return {
              error: "snapshot/scrollback arrived after attached and before live output",
              subscription_id: subscriptionId,
              observed: initialEvents
            };
          }
          const invalidHistory = initialEvents.find((event) => {
            if (event.type !== "snapshot" && event.type !== "scrollback") return false;
            if (event.payload_encoding !== "base64" || typeof event.payload_base64 !== "string") return true;
            try {
              const raw = globalThis.atob(event.payload_base64);
              if (raw.length !== event.bytes) return true;
              if (event.type === "snapshot" && raw.slice(0, 8) !== "GHOSTSNP") return true;
              return false;
            } catch {
              return true;
            }
          });
          if (invalidHistory) {
            return {
              error: "snapshot/scrollback payload is not valid binary-safe GHOSTSNP metadata",
              subscription_id: subscriptionId,
              observed: initialEvents.map((event) => ({ type: event.type, state: event.state, bytes: event.bytes }))
            };
          }

          return {
            subscription_id: subscriptionId,
            sequence: initialEvents.map((event) =>
              event.type === "attach_state" ? `${event.type}:${event.state}` : event.type
            ),
            history: initialEvents
              .filter((event) => event.type === "snapshot" || event.type === "scrollback")
              .map((event) => ({
                type: event.type,
                bytes: event.bytes ?? null,
                payload_encoding: event.payload_encoding
              }))
          };
        }
      }

      return null;
    },
    { expectedSessionId: sessionId, requiredSubscriptionId: requiredSubscriptionId ?? null },
    { timeout: 45_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(
      `timed out waiting for subscription-scoped attach chronology${
        requiredSubscriptionId ? ` for ${requiredSubscriptionId}` : ""
      }: ${error.message}`
    );
  });

  if (chronology.error) {
    throw new Error(`invalid subscription-scoped attach chronology: ${JSON.stringify(chronology)}`);
  }
  return chronology;
}

async function waitForResizeProof(page, requestedResize) {
  const deadline = Date.now() + 20_000;
  let lastObservedSize = "none";

  while (Date.now() < deadline) {
    const outputCount = await terminalOutputCount(page);
    await callTerminalControl(page, "writeInput", "botster-web-production-size\n");
    const observedSize = await waitForNextSizeProbe(page, outputCount).catch(() => undefined);
    lastObservedSize = observedSize ?? lastObservedSize;

    if (observedSize === `${requestedResize.rows}x${requestedResize.columns}`) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `timed out waiting for PTY resize ${requestedResize.rows}x${requestedResize.columns}; last observed ${lastObservedSize}`
  );
}

async function waitForSessionStatus(page, lifecycle) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "session",
      id: productionSessionId,
      lifecycle
    },
    `session entity lifecycle ${lifecycle}`
  );
}

async function waitForRunningSessionFrame(page) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "session",
      id: productionSessionId,
      lifecycle: "running"
    },
    "restored running session used by the terminal attachment path"
  );
}

async function waitForTerminalAttachState(page, states) {
  const expectedStates = Array.isArray(states) ? states : [states];
  await page.waitForFunction(
    ({ expectedStates: nextExpectedStates, statusClass, attachStateAttr }) => {
      const status = globalThis.document
        .querySelector(`.${statusClass}`)
        ?.getAttribute(attachStateAttr);
      return nextExpectedStates.includes(status);
    },
    {
      expectedStates,
      statusClass: HOST_CHROME.terminalStatusClass,
      attachStateAttr: HOST_CHROME.terminalAttachStateAttr
    },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal attach state ${expectedStates.join(" or ")}: ${error.message}`);
  });
}

async function waitForTerminalSession(page, sessionId) {
  await page.waitForFunction(
    ({ expectedSessionId, containerClass, sessionIdAttr }) =>
      globalThis.document
        .querySelector(`.${containerClass}`)
        ?.getAttribute(sessionIdAttr) === expectedSessionId,
    {
      expectedSessionId: sessionId,
      containerClass: HOST_CHROME.terminalContainerClass,
      sessionIdAttr: HOST_CHROME.terminalSessionIdAttr
    },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal session ${sessionId}: ${error.message}`);
  });
}

/**
 * Wait until production release has unmounted the session terminal host and shown dashboard.
 * Uses shared HOST_CHROME constants for DOM extraction and shared isTerminalDetached decision.
 * Timeout diagnostics distinguish "exited never arrived" from "exited but destination missing".
 */
async function waitForTerminalDetached(page, sessionId, { timeoutMs = 15_000 } = {}) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("waitForTerminalDetached requires an explicit sessionId");
  }

  const deadline = Date.now() + timeoutMs;
  let exitedObserved = false;
  let lastObservedAttachState = null;
  let lastSessionContainerIds = [];
  let lastDashboardPresent = false;

  while (Date.now() < deadline) {
    const snapshot = await page.evaluate((chrome) => {
      const containers = [
        ...globalThis.document.querySelectorAll(`.${chrome.terminalContainerClass}`)
      ];
      const sessionContainerIds = containers
        .map((node) => node.getAttribute(chrome.terminalSessionIdAttr))
        .filter((id) => typeof id === "string" && id.length > 0);
      const dashboardPresent =
        globalThis.document.querySelector(`[data-testid="${chrome.dashboardTestId}"]`) != null;
      const statusNode = globalThis.document.querySelector(`.${chrome.terminalStatusClass}`);
      const attachState = statusNode?.getAttribute(chrome.terminalAttachStateAttr) ?? null;
      return { sessionContainerIds, dashboardPresent, attachState };
    }, {
      terminalContainerClass: HOST_CHROME.terminalContainerClass,
      terminalSessionIdAttr: HOST_CHROME.terminalSessionIdAttr,
      terminalStatusClass: HOST_CHROME.terminalStatusClass,
      terminalAttachStateAttr: HOST_CHROME.terminalAttachStateAttr,
      dashboardTestId: HOST_CHROME.dashboardTestId
    });

    lastSessionContainerIds = snapshot.sessionContainerIds;
    lastDashboardPresent = snapshot.dashboardPresent;
    lastObservedAttachState = snapshot.attachState;
    if (snapshot.attachState === "exited") {
      exitedObserved = true;
    }

    if (isTerminalDetached({
      sessionContainerIds: snapshot.sessionContainerIds,
      dashboardPresent: snapshot.dashboardPresent
    }, sessionId)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const sessionContainerPresent = lastSessionContainerIds.includes(sessionId);
  throw new Error(
    `timed out waiting for terminal detach: sessionId=${sessionId}` +
      ` exitedObserved=${exitedObserved}` +
      ` lastObservedAttachState=${String(lastObservedAttachState)}` +
      ` sessionContainerPresent=${sessionContainerPresent}` +
      ` dashboardPresent=${lastDashboardPresent}` +
      ` sessionContainerIds=${JSON.stringify(lastSessionContainerIds)}`
  );
}

async function terminalOutputCount(page) {
  return page.evaluate(
    () => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "output").length
  );
}

async function daemonRequestCount(page, criteria) {
  return page.evaluate(
    ({ expectedCriteria }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) => {
        if (entry.kind !== "daemon_request") return false;
        const payload = entry.payload ?? {};
        if (expectedCriteria.type && payload.type !== expectedCriteria.type) return false;
        if (expectedCriteria.data && payload.data !== expectedCriteria.data) return false;
        if (expectedCriteria.package_name && payload.package_name !== expectedCriteria.package_name) return false;
        if (expectedCriteria.surface_id && payload.surface_id !== expectedCriteria.surface_id) return false;
        return true;
      }).length,
    { expectedCriteria: criteria }
  );
}

async function waitForDaemonRequestCount(page, criteria, expectedCount, label) {
  await page.waitForFunction(
    ({ expectedCriteria, nextExpectedCount }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).filter((entry) => {
        if (entry.kind !== "daemon_request") return false;
        const payload = entry.payload ?? {};
        if (expectedCriteria.type && payload.type !== expectedCriteria.type) return false;
        if (expectedCriteria.data && payload.data !== expectedCriteria.data) return false;
        return true;
      }).length === nextExpectedCount,
    { expectedCriteria: criteria, nextExpectedCount: expectedCount },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for ${label}: ${error.message}`);
  });
}

async function waitForNextSizeProbe(page, outputCount) {
  return page.waitForFunction(
    ({ previousOutputCount }) => {
      const outputs = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [])
        .filter((entry) => entry.kind === "output")
        .slice(previousOutputCount);
      return outputs
        .map((entry) => String(entry.payload?.data ?? "").match(/botster-web-production-size:(\d+x\d+)/)?.[1])
        .find((size) => typeof size === "string") ?? null;
    },
    { previousOutputCount: outputCount },
    { timeout: 5_000 }
  ).then((handle) => handle.jsonValue());
}

async function latestTerminalResize(page) {
  await page.waitForFunction(
    () => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some((entry) => entry.kind === "resize"),
    undefined,
    { timeout: 15_000 }
  );

  const resize = await page.evaluate(() => {
    const terminalEvents = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    const resizeEvents = terminalEvents.filter((entry) => entry.kind === "resize");
    return resizeEvents.at(-1)?.payload;
  });

  if (!resize || typeof resize.rows !== "number" || typeof resize.columns !== "number") {
    throw new Error("live harness could not read the latest terminal resize request");
  }

  return resize;
}

async function assertNoUnknownSession(page) {
  const failures = await page.evaluate(() => {
    const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    const entries = [...(harness?.events ?? []), ...(harness?.terminal ?? [])];

    return entries
      .map((entry) => entry.payload)
      .filter((payload) => {
        const error = payload?.error ?? payload;
        return (
          error?.code === "unknown_session" &&
          ["attach", "resize", "send_input"].includes(String(error.operation ?? ""))
        );
      });
  });

  if (failures.length > 0) {
    throw new Error(`unexpected unknown_session terminal failure: ${JSON.stringify(failures, null, 2)}`);
  }
}

async function startWebrtcPackageRuntime() {
  if (sharedHubDriverMode) {
    if (!webrtcDataDir) throw new Error("shared-Hub browser driver requires BOTSTER_LIVE_DATA_DIR");
    const socketPath = join(webrtcDataDir, "botster-hub.sock");
    await waitForSocket(socketPath);
    const status = await sendDaemonRequest(socketPath, { type: "status" });
    if (status.error) {
      throw new Error(`shared-Hub browser driver could not handshake with caller-owned Hub: ${JSON.stringify(status)}`);
    }
    const packages = await listPackages(socketPath);
    const url = await waitForPackageAppUrl(socketPath);
    await waitForHttpOk(new URL("/health", url).toString());
    const servedHtml = await waitForHtmlShell(url);
    binaryProvenance = callerOwnedRuntimeProvenance(status, packages, servedHtml);
    return url;
  }
  if (!process.env.BOTSTER_HUB_BIN) {
    throw new Error("WebRTC live packaged protocol harness requires BOTSTER_HUB_BIN so it can own an isolated hub.");
  }
  if (!webrtcDataDir) {
    throw new Error("WebRTC live packaged protocol harness requires an isolated data dir.");
  }

  hubProcess = spawnHubProcess(webrtcDataDir);
  await waitForSocket(join(webrtcDataDir, "botster-hub.sock"), () =>
    hubProcess?.exitCode !== null ? `hub exited before socket readiness (code=${hubProcess.exitCode})` : undefined
  );

  await ensurePackageEnabled("botster-web", packageRoot);
  if (workspacesPackagePath) {
    await ensurePackageEnabled("botster-workspaces", workspacesPackagePath);
  }
  if (contractMatrixMode && contractMatrixPackagePath) {
    await ensurePackageEnabled(contractMatrixPackageName, contractMatrixPackagePath);
  }
  if (payloadContractMode && payloadContractPackagePath) {
    await ensurePackageEnabled(payloadContractPackageName, payloadContractPackagePath);
  }
  if (entityOptionsMode && entityOptionsPackagePath) {
    await ensurePackageEnabled(entityOptionsPackageName, entityOptionsPackagePath);
  }
  if (durableStateMode) {
    await seedDurableExitedSessions();
    await restartHubWithDurableState();
  }
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  const url = await waitForPackageAppUrl(socketPath);

  await waitForHttpOk(new URL("/health", url).toString(), () =>
    hubProcess?.exitCode !== null ? `hub exited before package runtime readiness (code=${hubProcess.exitCode})` : undefined
  );
  const servedHtml = await waitForHtmlShell(url);
  if (reusedWebPackageProvenance) {
    recordServedWebBuildProvenance(servedHtml, reusedWebPackageProvenance);
  }
  return url;
}

function callerOwnedRuntimeProvenance(status, packages, servedHtml) {
  const daemonStatus = status.status ?? {};
  const compatibility = daemonStatus.compatibility ?? {};
  const packageEvidence = (packageName) => {
    const record = packages.find((candidate) => candidate.package_name === packageName);
    if (!record) throw new Error(`caller-owned Hub omitted installed package ${packageName}`);
    return {
      package_name: record.package_name,
      version: record.version,
      source_kind: record.source_kind,
      classification: record.classification,
      state: record.state
    };
  };
  const servedAssetUrls = htmlAssetUrls(servedHtml);
  return {
    hub: {
      source: "caller-owned",
      path: null,
      protocol: requiredProvenanceField(compatibility, "protocol", "status.compatibility"),
      protocol_version: requiredProvenanceField(compatibility, "protocol_version", "status.compatibility"),
      conformance_fixture_revision: requiredProvenanceField(compatibility, "conformance_fixture_revision", "status.compatibility"),
      schema_version: requiredProvenanceField(daemonStatus, "schema_version", "status"),
      host_id: requiredProvenanceField(daemonStatus, "host_id", "status")
    },
    session_worker: {
      source: "caller-owned",
      path: null,
      version: null,
      disposition: "not_exposed_by_daemon_status"
    },
    workspaces: packageEvidence("botster-workspaces"),
    web: {
      ...packageEvidence("botster-web"),
      build_commit: null,
      build_commit_disposition: "not_exposed_by_installed_app_contract",
      served_asset_urls: servedAssetUrls,
      served_asset_digest: createHash("sha256").update(JSON.stringify(servedAssetUrls)).digest("hex")
    }
  };
}

async function ensurePackageEnabled(packageName, packagePath) {
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  let packages = await listPackages(socketPath);
  const initialDecision = packageEnsureDecision(packages, packageName);
  console.log(`live package ensure ${JSON.stringify({ package_name: packageName, ...initialDecision })}`);

  if (initialDecision.install) {
    await runHubCommand(["packages", "install", "--data-dir", webrtcDataDir, "--path", packagePath]);
    packages = await listPackages(socketPath);
  }

  const enableDecision = packageEnsureDecision(packages, packageName);
  if (enableDecision.enable) {
    await runHubCommand(["packages", "enable", "--data-dir", webrtcDataDir, packageName]);
    packages = await listPackages(socketPath);
  }

  const finalDecision = packageEnsureDecision(packages, packageName);
  if (finalDecision.install || finalDecision.enable) {
    throw new Error(
      `package ensure did not reach enabled state for ${packageName}: ${JSON.stringify(finalDecision)}`
    );
  }
  if (!initialDecision.install && packageName === "botster-web") {
    reusedWebPackageProvenance = await resolveReusedWebPackageProvenance(
      socketPath,
      packages.find((candidate) => candidate.package_name === packageName),
      packagePath
    );
  }
  return { initialDecision, finalDecision };
}

async function resolveReusedWebPackageProvenance(socketPath, packageRecord, expectedPackageRoot) {
  if (!packageRecord || typeof packageRecord.version !== "string") {
    throw new Error("reused botster-web package did not expose authoritative package provenance");
  }
  const entrypoint = packageRecord.runnable_entrypoints?.find(
    (candidate) => candidate.id === "web-client"
  );
  if (!entrypoint) {
    throw new Error("reused botster-web package did not expose the web-client entrypoint");
  }

  const response = await sendDaemonRequest(socketPath, {
    type: "resolve_app_launch",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  if (response.error && response.error.code !== "unsupported_app_kind") {
    throw new Error(`could not resolve reused botster-web launch provenance: ${JSON.stringify(response)}`);
  }
  if (!response.error && !response.resolved_app_launch) {
    throw new Error(`reused botster-web launch provenance was empty: ${JSON.stringify(response)}`);
  }

  const expectedWorkingDirectory = resolve(expectedPackageRoot);
  const resolvedWorkingDirectory = response.resolved_app_launch?.working_directory;
  const workingDirectory = resolvedWorkingDirectory
    ? resolve(resolvedWorkingDirectory)
    : null;
  return {
    package_name: packageRecord?.package_name,
    package_version: packageRecord?.version,
    source_kind: packageRecord?.source_kind,
    working_directory: workingDirectory,
    working_directory_policy: entrypoint?.working_directory?.policy,
    working_directory_path: entrypoint?.working_directory?.path,
    expected_working_directory: expectedWorkingDirectory,
    matches_expected_working_directory: workingDirectory == null
      ? null
      : workingDirectory === expectedWorkingDirectory,
    classification: workingDirectory == null
      ? "web_launch_working_directory_not_exposed"
      : workingDirectory === expectedWorkingDirectory
        ? "expected_package_root"
        : "resolved_working_directory_mismatch",
    resolve_app_launch_error: response.error?.code ?? null
  };
}

function recordServedWebBuildProvenance(servedHtml, packageProvenance) {
  const localHtml = readFileSync(join(packageRoot, "dist", "index.html"), "utf8");
  const localAssetUrls = htmlAssetUrls(localHtml);
  const servedAssetUrls = htmlAssetUrls(servedHtml);
  const servedAssetsMatchLocalBuild =
    localAssetUrls.length > 0 &&
    JSON.stringify(servedAssetUrls) === JSON.stringify(localAssetUrls);
  console.log(`live package reuse provenance ${JSON.stringify({
    ...packageProvenance,
    local_asset_urls: localAssetUrls,
    served_asset_urls: servedAssetUrls,
    served_assets_match_local_build: servedAssetsMatchLocalBuild,
    build_classification: servedAssetsMatchLocalBuild
      ? "served_assets_match_local_build"
      : "served_assets_do_not_match_local_build"
  })}`);
}

async function listPackages(socketPath) {
  const response = await sendDaemonRequest(socketPath, { type: "list_packages" });
  if (response.error || !Array.isArray(response.packages)) {
    throw new Error(`structured package list failed: ${JSON.stringify(response)}`);
  }
  return response.packages;
}

async function seedDurableExitedSessions() {
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  for (const sessionId of durableSeedSessionIds) {
    const response = await sendDaemonRequest(socketPath, {
      type: "spawn",
      session_id: sessionId,
      command: "sleep 30"
    });
    if (response.error) {
      throw new Error(`durable session seed failed for ${sessionId}: ${JSON.stringify(response.error)}`);
    }
    const shutdownResponse = await sendDaemonRequest(socketPath, {
      type: "shutdown_session",
      session_id: sessionId
    });
    if (shutdownResponse.error) {
      throw new Error(
        `durable session seed shutdown failed for ${sessionId}: ${JSON.stringify(shutdownResponse.error)}`
      );
    }
  }

  const deadline = Date.now() + 15_000;
  let lastSessions = [];
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(socketPath, { type: "list_sessions" });
    lastSessions = response.sessions ?? [];
    const exitedIds = new Set(
      lastSessions
        .filter((session) => session.lifecycle === "exited")
        .map((session) => session.session_id)
    );
    if (durableSeedSessionIds.every((sessionId) => exitedIds.has(sessionId))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `durable sessions did not all exit: ${durableSeedSessionIds.join(", ")}; observed=${JSON.stringify(lastSessions)}`
  );
}

async function restartHubWithDurableState() {
  await runHubCommand(["shutdown", "--data-dir", webrtcDataDir]);
  if (hubProcess?.exitCode === null) {
    await Promise.race([
      once(hubProcess, "exit"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("hub did not exit for durable-state restart")), 5_000)
      )
    ]);
  }

  hubProcess = spawnHubProcess(webrtcDataDir);
  await waitForSocket(join(webrtcDataDir, "botster-hub.sock"), () =>
    hubProcess?.exitCode !== null
      ? `hub exited before durable-state restart readiness (code=${hubProcess.exitCode})`
      : undefined
  );

  const { initialDecision } = await ensurePackageEnabled("botster-web", packageRoot);
  assertPackageReused(initialDecision, "botster-web");
}

async function loadBinaryProvenance() {
  if (!process.env.BOTSTER_HUB_BIN) {
    throw new Error("WebRTC live packaged protocol harness requires BOTSTER_HUB_BIN so it can own an isolated hub.");
  }
  if (!process.env.BOTSTER_SESSION_WORKER_BIN) {
    throw new Error(
      "WebRTC live packaged protocol harness requires BOTSTER_SESSION_WORKER_BIN so readiness evidence identifies the exact worker binary."
    );
  }

  return {
    hub: await binaryProvenanceFor(process.env.BOTSTER_HUB_BIN, "botster-hub"),
    session_worker: await binaryProvenanceFor(process.env.BOTSTER_SESSION_WORKER_BIN, "botster-session-worker")
  };
}

async function binaryProvenanceFor(binaryPath, label) {
  const resolvedPath = resolve(binaryPath);
  const manifestPath = resolve(dirname(resolvedPath), "../..", "Cargo.toml");
  if (!existsSync(resolvedPath)) {
    throw new Error(`${label} provenance binary does not exist: path=${resolvedPath}`);
  }
  if (!existsSync(manifestPath)) {
    return { path: resolvedPath, package_version: null, package_version_source: null };
  }
  const manifest = readFileSync(manifestPath, "utf8");
  const packageVersion = manifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
  return {
    path: resolvedPath,
    package_version: packageVersion,
    package_version_source: packageVersion ? manifestPath : null
  };
}

function spawnHubProcess(dataDir) {
  const args = ["start", "--data-dir", dataDir];
  if (process.env.BOTSTER_SESSION_WORKER_BIN) {
    args.push("--session-worker-bin", process.env.BOTSTER_SESSION_WORKER_BIN);
  }

  const child = spawn(process.env.BOTSTER_HUB_BIN, args, {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    hubStdout += chunk;
    process.stdout.write(`[botster-hub] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    hubStderr += chunk;
    process.stderr.write(`[botster-hub] ${chunk}`);
  });
  return child;
}

async function runHubCommand(args) {
  const child = spawn(process.env.BOTSTER_HUB_BIN, args, {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    process.stdout.write(`[botster-hub-cli] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    process.stderr.write(`[botster-hub-cli] ${chunk}`);
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`botster-hub ${args.join(" ")} failed (code=${code}, signal=${signal ?? "none"}):\n${stdout}${stderr}`);
  }
  return stdout;
}

async function waitForPackageAppUrl(socketPath) {
  const deadline = Date.now() + 15_000;
  let lastState = "missing";
  let lastApp;
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(socketPath, { type: "list_apps" });
    const app = response.apps?.find((candidate) => candidate.package_name === "botster-web" && candidate.entrypoint_id === "web-client");
    lastApp = app;
    if (app?.lifecycle_state) {
      lastState = app.lifecycle_state;
    }
    if (app?.launch_target?.local_url) {
      return app.launch_target.local_url;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `timed out waiting for botster-web/web-client local_url; lifecycle_state=${lastState}; app=${JSON.stringify(lastApp)}`
  );
}

async function sendDaemonRequest(socketPath, request) {
  const socket = connect(socketPath);
  await once(socket, "connect");
  socket.setEncoding("utf8");
  socket.write(`${JSON.stringify({ protocol })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== protocol) {
    socket.end();
    throw new Error("daemon hello protocol mismatch");
  }
  socket.write(`${JSON.stringify(request)}\n`);
  const reply = JSON.parse(await readSocketLine(socket));
  socket.end();
  return reply;
}

async function readSocketLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    };
    const onData = (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline >= 0) {
        cleanup();
        resolve(buffer.slice(0, newline));
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("daemon socket closed before reply"));
    };

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

async function waitForSocket(socketPath, exitMessage) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    const earlyExit = exitMessage?.();
    if (earlyExit) {
      throw new Error(earlyExit);
    }

    const connected = await new Promise((resolve) => {
      const socket = connect(socketPath);
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", (error) => {
        lastError = error;
        resolve(false);
      });
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error(`timed out waiting for hub socket ${socketPath}`);
}

async function waitForHttpOk(url, exitMessage) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    const earlyExit = exitMessage?.();
    if (earlyExit) {
      throw new Error(earlyExit);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error(`timed out waiting for ${url}`);
}

async function waitForHtmlShell(url) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok || !body.includes("<div id=\"root\"></div>") || !body.includes("__BOTSTER_PACKAGE_RUNTIME__")) {
    throw new Error(`packaged UI shell was not served from ${url}`);
  }
  return body;
}

function assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors }) {
  const message = browserFailureSummary({ consoleEvents, pageErrors, responseErrors });
  if (message) {
    throw new Error(message);
  }
}

function browserFailureSummary({ consoleEvents, pageErrors, responseErrors }) {
  const fatalConsole = consoleEvents.filter((event) => {
    const text = event.text.toLowerCase();
    if (text.includes("err_incomplete_chunked_encoding")) return false;
    return (
      event.type === "error" ||
      text.includes("font load error") ||
      text.includes("unable to load any configured font source") ||
      text.includes("terminal_view is not mounted") ||
      text.includes("maximum call stack size exceeded") ||
      text.includes("unhandled")
    );
  });
  const failures = [
    ...fatalConsole.map((event) => `console ${event.type}: ${event.text}`),
    ...pageErrors.map((message) => `pageerror: ${message}`),
    ...responseErrors.map((message) => `response: ${message}`)
  ];
  if (failures.length > 0) {
    return `live packaged protocol harness failed:\n${failures.join("\n")}`;
  }
  return undefined;
}

function flushWritable(stream) {
  return new Promise((resolve) => stream.write("", resolve));
}
