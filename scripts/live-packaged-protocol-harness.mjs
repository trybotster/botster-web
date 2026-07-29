import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import {
  assertDurableStateOwnership,
  assertPackageReused,
  durableSeedSessionIdsForDiagnosticsLimit,
  harnessEventMatches,
  htmlAssetUrls,
  packageEnsureDecision
} from "./live-packaged-protocol-helpers.mjs";

const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const durableStateMode = process.env.BOTSTER_LIVE_DURABLE_STATE === "1";

assertDurableStateOwnership({
  durableStateMode,
  suppliedDataDir: process.env.BOTSTER_LIVE_DATA_DIR
});

const {
  appRouteFromPathname,
  entityFamilyRecordLimit: diagnosticsEntityRecordLimit
} = await loadProductionAppRouteFromPathname();
const durableSeedSessionIds =
  durableSeedSessionIdsForDiagnosticsLimit(diagnosticsEntityRecordLimit);

const workspacesPackagePath = resolveOptionalPackagePath(
  [process.env.BOTSTER_WORKSPACES_PACKAGE_PATH, process.env.BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH],
  "botster-workspaces"
);
const requireWorkspacesMode = process.env.BOTSTER_LIVE_REQUIRE_WORKSPACES === "1";
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
const echoProbe = "keys";
const attachProbe = "botster-web-production-attach-probe";
const productionSessionId = "web-prod";

if (!process.env.BOTSTER_HUB_BIN) {
  throw new Error(
    "Live packaged protocol harness requires BOTSTER_HUB_BIN. " +
      "Use BOTSTER_HUB_BIN with BOTSTER_SESSION_WORKER_BIN for an isolated spawned hub."
  );
}

if (requireWorkspacesMode && !workspacesPackagePath) {
  throw new Error(
    "Workspaces compatibility mode requires BOTSTER_WORKSPACES_PACKAGE_PATH or BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH."
  );
}

if (!workspacesPackagePath) {
  console.log(
    "Workspaces package path not provided; live packaged protocol harness will fall back to generic first-party/production surface coverage. " +
      "Set BOTSTER_WORKSPACES_PACKAGE_PATH or BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH for named botster-workspaces/workspaces acceptance."
  );
}

let hubProcess;
let hubStdout = "";
let hubStderr = "";
const ownsWebrtcDataDir = !process.env.BOTSTER_LIVE_DATA_DIR;
const webrtcDataDir =
  process.env.BOTSTER_LIVE_DATA_DIR ??
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

try {
  binaryProvenance = await loadBinaryProvenance();
  console.log(`live packaged protocol binary provenance ${JSON.stringify(binaryProvenance)}`);
  appUrl = await startWebrtcPackageRuntime();

  browser = await chromium.launch({
    args: ["--disable-features=WebRtcHideLocalIpsWithMdns", "--force-webrtc-ip-handling-policy=default_public_and_private_interfaces"]
  });
  page = await browser.newPage();
  await page.addInitScript(() => {
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
  await assertMinimumHubCompatibility(page);
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
    { kind: "hub_frame", family: "botster-web.session" },
    "authoritative session snapshot"
  );
  await assertNoLegacySessionHydration(page);
  await openAppsView(page);
  await assertRemoteAccessSettingsDispatch(page, originalRemoteAccessValue);
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
  }
  if (process.env.BOTSTER_LIVE_SURFACE_ONLY === "1") {
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    assertRequiredWorkspacesProof();
    await requestDaemonShutdown();
    console.log("live packaged protocol surface proof passed");
    process.exit(0);
  }
  await openHomeView(page);
  if (durableStateMode) {
    await assertDurableSeededSessionsVisible(page);
  }
  await startProductionSession();
  await waitForSessionStatus(page, "running");
  await openDiagnosticsView(page);
  await waitForSessionAttachable(page, true);
  await waitForTerminalSession(page, productionSessionId);
  responseAssemblyTelemetry.push({ cycle: 0, ...await waitForAutomaticTerminalRestore(page) });
  await proveLiveTerminalAfterAttach(page, `${attachProbe}-0`);
  attachChronology.push({ cycle: 0, ...await assertTerminalAttachChronology(page, productionSessionId) });
  await proveExternalSessionLifecycle(page);

  let previousGrantId = await latestLocalWebrtcGrantId(page);
  let previousEntitySubscriptionId = await latestSessionEntitySubscriptionId(page);
  for (const cycle of [1, 2]) {
    const reconnect = await reloadSamePackageUrlAndAssertWebrtc(
      page,
      cycle,
      previousGrantId,
      previousEntitySubscriptionId
    );
    previousGrantId = reconnect.grantId;
    previousEntitySubscriptionId = reconnect.subscriptionId;
    await openDiagnosticsView(page);
    await waitForSessionStatus(page, "running");
    await waitForSessionAttachable(page, true);
    await waitForTerminalSession(page, productionSessionId);
    responseAssemblyTelemetry.push({ cycle, ...await waitForAutomaticTerminalRestore(page) });
    await proveLiveTerminalAfterAttach(page, `${attachProbe}-${cycle}`);
    attachChronology.push({ cycle, ...await assertTerminalAttachChronology(page, productionSessionId) });
  }

  const sendInputRequestsBeforeEcho = await daemonRequestCount(page, {
    type: "send_input",
    data: `${echoProbe}\n`
  });
  await typeThroughMountedTerminal(page, `${echoProbe}\n`);
  await waitForDaemonRequestCount(
    page,
    { type: "send_input", data: `${echoProbe}\n` },
    sendInputRequestsBeforeEcho + 1,
    "single echo send_input request"
  );
  await waitForTerminalOutput(page, `botster-web-production-echo:${echoProbe}`);
  await waitForTerminalRendererWrite(page, `botster-web-production-echo:${echoProbe}`);
  const sendInputRequestsAfterEcho = await daemonRequestCount(page, {
    type: "send_input",
    data: `${echoProbe}\n`
  });
  if (sendInputRequestsAfterEcho !== sendInputRequestsBeforeEcho + 1) {
    throw new Error(
      `expected one send_input for ${echoProbe}, observed ${sendInputRequestsAfterEcho - sendInputRequestsBeforeEcho}`
    );
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

  await callTerminalControl(page, "writeInput", "botster-web-production-exit\n");
  await waitForTerminalOutput(page, "botster-web-production-exiting");
  await shutdownProductionSession();
  await waitForTerminalDetached(page);

  await assertNoUnknownSession(page);
  assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
  assertRequiredWorkspacesProof();
  await requestDaemonShutdown();
  console.log(
    "live packaged protocol harness passed (webrtc) " +
      JSON.stringify({
        binary_provenance: binaryProvenance,
        attach_chronology: attachChronology,
        response_assembly_telemetry: responseAssemblyTelemetry
      })
  );
} catch (error) {
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
    diagnosticMessage += `\nhub stdout:\n${hubStdout}\nhub stderr:\n${hubStderr}`;
  }
  if (harnessState) {
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

async function reloadSamePackageUrlAndAssertWebrtc(page, cycle, previousGrantId, previousEntitySubscriptionId) {
  const expectedUrl = appUrl;
  const beforeUrl = page.url();
  if (new URL(beforeUrl).origin !== new URL(expectedUrl).origin) {
    throw new Error(`same-URL reload cycle ${cycle} started on unexpected origin: page=${beforeUrl} app=${expectedUrl}`);
  }

  if (cycle === 1) {
    await refreshPackageRuntime(page);
  } else {
    await revisitPackageRuntime(page);
  }

  const afterUrl = page.url();
  if (new URL(afterUrl).origin !== new URL(expectedUrl).origin) {
    throw new Error(`same-URL reload cycle ${cycle} changed package origin: before=${beforeUrl} after=${afterUrl} app=${expectedUrl}`);
  }

  await openDiagnosticsView(page);
  await waitForTransportLabel(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "local_webrtc_signal" }, `reload ${cycle} local_webrtc_signal request`);
  await waitForHarnessEvent(page, { kind: "webrtc_data_channel", state: "open" }, `reload ${cycle} data channel open`);
  await waitForHarnessEvent(page, { kind: "webrtc_lifecycle", type: "data-channel-open" }, `reload ${cycle} lifecycle data-channel-open`);
  await waitForHarnessEvent(page, { kind: "webrtc_lifecycle", type: "encrypted-stream-ready" }, `reload ${cycle} encrypted stream ready`);
  await assertNoGrantSecretLeak(page, cycle);

  const grantId = await latestLocalWebrtcGrantId(page);
  if (!grantId) {
    throw new Error(`same-URL reload cycle ${cycle} did not expose a redacted local WebRTC grant_id`);
  }
  if (previousGrantId && grantId === previousGrantId) {
    throw new Error(`same-URL reload cycle ${cycle} reused local WebRTC grant_id ${grantId}`);
  }

  await page.getByText("WebRTC DataChannel open").waitFor({ timeout: 15_000 });
  await page.getByText("Encrypted client stream ready").waitFor({ timeout: 15_000 });
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, `reload ${cycle} status request`);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_packages" }, `reload ${cycle} list_packages request`);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "subscribe_entities", entity_type: "session" },
    `reload ${cycle} session entity subscription`
  );
  await waitForHarnessEvent(
    page,
    { kind: "hub_frame", family: "botster-web.session" },
    `reload ${cycle} authoritative session snapshot`
  );
  const subscriptionId = await latestSessionEntitySubscriptionId(page);
  if (!subscriptionId) {
    throw new Error(`same-URL reload cycle ${cycle} did not create a session entity subscription`);
  }
  if (previousEntitySubscriptionId && subscriptionId === previousEntitySubscriptionId) {
    throw new Error(`same-URL reload cycle ${cycle} reused session subscription_id ${subscriptionId}`);
  }
  await assertNoLegacySessionHydration(page);
  return { grantId, subscriptionId };
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
  await page.waitForTimeout(100);
  await page.keyboard.insertText(data);
}

async function openAppsView(page) {
  await page.getByLabel("Botster workbench").getByRole("button", { name: "Apps", exact: true }).click();
  await page.getByTestId("apps-view").waitFor();
}

async function openHomeView(page) {
  await page.getByLabel("Botster workbench").getByRole("button", { name: "Home", exact: true }).click();
  await page.getByTestId("dashboard-view").waitFor();
}

async function openDiagnosticsView(page) {
  await page.getByLabel("Botster workbench").getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByTestId("diagnostics-view").waitFor();
  const developerDetails = page.locator("details.developer-diagnostics");
  if (!(await developerDetails.evaluate((details) => details.open))) {
    await developerDetails.locator("summary").click();
  }
}

function installedList(page) {
  return page.locator("[aria-label='Installed']");
}

async function openFirstPartyUiAppSurface(page, mode) {
  const installed = installedList(page);
  const target = mode === "webrtc" && workspacesPackagePath
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
    await assertPluginSurfaceRouteReloadAndDirectLoad(page, target);
  }
}

async function exercisePluginContractMatrix(page) {
  await assertContractMatrixPackageLoaded(page);
  await openContractAppFromApps(page);
  await assertContractSurfaceRoute(page, "contract.app", "plugin_surface_render");
  await assertContractSurfaceRouteReloadAndDirectLoad(page, "contract.app", "plugin_surface_render");

  await navigateToContractSurface(page, "contract.empty");
  await assertContractSurfaceRoute(page, "contract.empty", "No fixture rows are available.");

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
      const packages = [];
      const apps = [];
      for (const entry of events) {
        if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
          packages.push(...(entry.payload.packages ?? []));
        }
        if (entry.kind === "daemon_response" && entry.payload?.kind === "apps") {
          apps.push(...(entry.payload.apps ?? []));
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
          const payload = entry.payload.payload;
          if (payload?.family === "botster-web.package") packages.push(...(payload.records ?? []));
          if (payload?.family === "botster-web.app") apps.push(...(payload.records ?? []));
        }
      }
      const packageRecord = packages.find((record) => (record.package_name ?? record.name ?? record.id) === packageName);
      const appRecord = apps.find((record) => record.package_name === packageName);
      const surfaces = packageRecord?.surfaces ?? packageRecord?.app_surfaces ?? [];
      return Boolean(packageRecord) &&
        Boolean(appRecord || surfaces.length > 0) &&
        JSON.stringify(packageRecord).includes("contract.app") &&
        JSON.stringify(packageRecord).includes("contract.empty") &&
        JSON.stringify(packageRecord).includes("contract.blocked") &&
        JSON.stringify(packageRecord).includes("contract.settings");
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

async function assertContractSurfaceRoute(page, surfaceId, visibleText) {
  await page.waitForURL(new RegExp(escapedRoutePathPattern(contractSurfaceRoutePath(surfaceId))), { timeout: 15_000 });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: contractMatrixPackageName, surface_id: surfaceId },
    `${surfaceId} plugin_surface_render request`
  );
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
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

async function assertSelectedSurfaceNotLoading(page, surfaceId) {
  await page.waitForFunction(
    () => {
      const text = globalThis.document.querySelector("[data-testid='selected-app-surface']")?.textContent ?? "";
      return !/Loading package surfaces from the hub|Rendering plugin surface from the hub|Rendering Contract/i.test(text);
    },
    undefined,
    { timeout: 45_000 }
  ).catch(async (error) => {
    const selectedText = await page.getByTestId("selected-app-surface").innerText().catch(() => "");
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
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
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
  await page.getByTestId("plugin-settings-route").getByText("Package configuration", { exact: true }).waitFor();
  await page.getByText("Endpoint").waitFor();
  await page.getByText("Mode").waitFor();
  await page.getByText("API token").waitFor();
  await page.getByText("Contract Settings").click();
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
  await page.getByRole("button", { name: "Run contract action" }).click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_action", package_name: contractMatrixPackageName, surface_id: "contract.app" },
    "contract.action plugin_surface_action request"
  );
  await waitForContractActionResult(
    page,
    {
      accepted: true,
      expectedTexts: ["Accepted contract.action", "Contract action accepted", "contract action accepted"],
      label: "contract.action deterministic success result"
    }
  );

  await page.waitForFunction(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.dispatchAction));
  await page.evaluate(({ packageName }) => {
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.dispatchAction({
      id: "contract.action",
      label: "Run contract action",
      params: {
        package_name: packageName,
        surface_id: "contract.app",
        action_id: "contract.action"
      },
      payload: {
        fail: true
      }
    });
  }, { packageName: contractMatrixPackageName });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_action", package_name: contractMatrixPackageName, surface_id: "contract.app" },
    "contract.action error plugin_surface_action request"
  );
  await waitForContractActionResult(
    page,
    {
      accepted: false,
      expectedTexts: ["contract action failed by request", "Rejected contract.action"],
      label: "contract.action deterministic failure result"
    }
  );
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

async function waitForContractActionResult(page, { accepted, expectedTexts, label }) {
  await page.waitForFunction(
    ({ nextAccepted, texts }) => {
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
        return texts.some((text) => resultText.includes(text));
      });
    },
    { nextAccepted: accepted, texts: expectedTexts },
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
    const packages = [];
    for (const entry of events) {
      if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
        packages.push(...(entry.payload.packages ?? []));
      }
      if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
        const payload = entry.payload.payload;
        if (payload?.family === "botster-web.package") {
          packages.push(...(payload.records ?? []));
        }
      }
    }
    const packageRecord = packages.find((record) =>
      (record.package_name ?? record.name ?? record.id) === packageName
    );
    const surfaces = packageRecord?.app_surfaces ?? [];
    const surfaceRecord = surfaces.find((record) => (record.surface_id ?? record.id) === surfaceId);
    return {
      routePath: typeof surfaceRecord?.route_path === "string" && surfaceRecord.route_path.length > 0
        ? surfaceRecord.route_path
        : undefined,
      packageRecord,
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
    const appModule = await vite.ssrLoadModule("/src/App.tsx");
    return {
      appRouteFromPathname: appModule.appRouteFromPathname,
      entityFamilyRecordLimit: appModule.entityFamilyRecordLimit
    };
  } finally {
    await vite.close();
  }
}

async function assertSelectedAppSurfaceRendered(page, target) {
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
  if (target.packageName === "botster-workspaces" && target.surfaceId === "workspaces") {
    const expectedNodeIds = [
      "botster-workspaces-toolbar",
      "botster-workspaces-read-model",
      "botster-workspaces-metrics",
      "botster-workspaces-index-section",
      "botster-workspaces-create-form",
      "botster-workspaces-spawn-form"
    ];
    await Promise.all(
      expectedNodeIds.map((nodeId) =>
        page.locator(`[data-testid='selected-app-surface'] [data-ui-node-id='${nodeId}']`).waitFor({ timeout: 45_000 })
      )
    ).catch(async (error) => {
      const selectedText = await page.getByTestId("selected-app-surface").innerText().catch(() => "");
      throw new Error(
        `Workspaces surface omitted plugin-owned UiNodes; expected=${JSON.stringify(expectedNodeIds)} text=${JSON.stringify(selectedText)}: ${error.message}`
      );
    });
    const unsupportedNodes = page.locator(
      "[data-testid='selected-app-surface'] [data-unsupported-primitive], " +
      "[data-testid='selected-app-surface'] [data-missing-capability]"
    );
    if (await unsupportedNodes.count() > 0) {
      throw new Error(
        `Workspaces surface rendered unsupported UiNodes: ${JSON.stringify(await unsupportedNodes.allTextContents())}`
      );
    }
    workspacesCompatibilityProofCount += 1;
    return;
  }

  await page.waitForFunction(
    ({ packageName, surfaceId }) => {
      const text = globalThis.document.querySelector("[data-testid='selected-app-surface']")?.textContent ?? "";
      const expectedRoute = packageName && surfaceId ? `${packageName}/${surfaceId}` : "";
      return /project-pipelines|botster-workspaces|Pipelines|Workspaces|botster-web|Production/i.test(text) &&
        /rendered|\//i.test(text) &&
        !/Render response did not include/i.test(text) &&
        (!expectedRoute || text.includes(expectedRoute));
    },
    target,
    { timeout: 45_000 }
  ).catch(async (error) => {
    const selectedText = await page.getByTestId("selected-app-surface").innerText().catch(() => "");
    throw new Error(`selected app surface did not render visible first-party content; text=${JSON.stringify(selectedText)}: ${error.message}`);
  });
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
  await page.getByTestId("plugin-settings-route").waitFor();
}

async function closePackageSettingsRoute(page) {
  await page.getByTestId("plugin-settings-route").getByRole("button", { name: "Apps", exact: true }).click();
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
    ({ nextPackageName, nextExpectedValues }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).some((entry) => {
        if (entry.kind !== "daemon_response" && entry.kind !== "hub_frame") return false;
        const packages = entry.kind === "daemon_response"
          ? entry.payload?.packages
          : entry.payload?.kind === "entity_snapshot" && entry.payload.payload?.family === "botster-web.package"
            ? entry.payload.payload.records
            : undefined;
        if (!Array.isArray(packages)) return false;
        const record = packages.find((candidate) => candidate.name === nextPackageName || candidate.id === nextPackageName);
        const effectiveValues = record?.configuration?.effective_values ?? Object.fromEntries(
          (record?.configuration_fields ?? []).map((field) => [field.id, field.secret_state ? { type: field.config_type, state: field.secret_state } : { type: field.config_type, value: field.value }])
        );
        return Object.entries(nextExpectedValues).every(([key, expectedValue]) =>
          JSON.stringify(effectiveValues[key]) === JSON.stringify(expectedValue)
        );
      }),
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
        .filter((record) => record?.name === nextPackageName || record?.id === nextPackageName)
        .map((record) => ({
          name: record.name ?? record.id,
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

async function waitForHarnessEvent(page, criteria, label) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const events = await page.evaluate(
      () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []
    );
    if (events.some((entry) => harnessEventMatches(entry, criteria))) return;
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
      family: "botster-web.session",
      id: sessionId,
      status: "running",
      attachable: true
    },
    "externally spawned session upsert"
  );
  if (durableStateMode) {
    const diagnostics = page.getByTestId("diagnostics-view");
    await diagnostics.waitFor();
    const sessionsPanel = diagnostics.locator(".entity-family-panel").filter({
      has: page.getByRole("heading", { name: "Sessions", exact: true })
    });
    await sessionsPanel.getByText(/\d+ more records loaded\./).waitFor();
    if (await sessionsPanel.getByText(sessionId, { exact: true }).count() !== 0) {
      throw new Error("durable external session unexpectedly appeared inside the capped Diagnostics summary");
    }
  }
  await openHomeView(page);
  const sessionRow = page.getByTestId("dashboard-view").getByText(sessionId, { exact: true });
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
    { kind: "hub_frame", family: "botster-web.session", id: sessionId, status: "exited" },
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
    { kind: "hub_frame", frameKind: "entity_remove", family: "botster-web.session", id: sessionId },
    "external session removal"
  );
  await sessionRow.waitFor({ state: "detached" });
}

async function assertDurableSeededSessionsVisible(page) {
  const dashboard = page.getByTestId("dashboard-view");
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

async function assertMinimumHubCompatibility(page) {
  const compatibility = await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const entry = events[index];
        if (entry.kind === "daemon_response" && entry.payload?.kind === "status") {
          return entry.payload?.status?.compatibility ?? null;
        }
        if (
          entry.kind === "hub_frame" &&
          entry.payload?.kind === "entity_snapshot" &&
          entry.payload?.payload?.family === "botster-web.hub_status"
        ) {
          return entry.payload.payload.records?.find((record) => record?.id === "local-hub")?.compatibility ?? null;
        }
      }
      return null;
    },
    undefined,
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for hub compatibility descriptor: ${error.message}`);
  });

  const revision = compatibility?.conformance_fixture_revision;
  const features = Array.isArray(compatibility?.features) ? compatibility.features : [];
  if (!Number.isInteger(revision) || revision < 14 || !features.includes("terminal_readback")) {
    throw new Error(
      `incompatible hub for revision-14 terminal history: observed revision ${String(revision)}, ` +
      `required revision 14 with terminal_readback`
    );
  }
}

async function waitForRemoteAccessPackageConfiguration(page) {
  return page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      for (const entry of events) {
        const packageRecords = [];
        if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
          packageRecords.push(...(entry.payload.packages ?? []).map((record) => ({
            identity: record.package_name,
            record
          })));
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
          const payload = entry.payload.payload;
          if (payload?.family === "botster-web.package") {
            packageRecords.push(...(payload.records ?? []).map((record) => ({
              identity: record.id,
              record
            })));
          }
        }

        for (const { identity, record: packageRecord } of packageRecords) {
          if (identity !== "botster-web") continue;
          const effectiveValue = remoteAccessConfigurationValue(packageRecord);
          if (effectiveValue !== undefined) return { effectiveValue };
        }
      }
      return false;

      function remoteAccessConfigurationValue(packageRecord) {
        const rawFields = packageRecord?.configuration?.schema?.fields ?? [];
        const projectedFields = packageRecord?.configuration_fields ?? [];
        const remoteAccessField = [...rawFields, ...projectedFields].find(
          (field) => field.key === "remote_browser_rendezvous_enabled" || field.id === "remote_browser_rendezvous_enabled"
        );
        const action = [...(packageRecord?.actions ?? []), ...(packageRecord?.package_actions ?? [])].find(
          (candidate) => candidate.action_id === "set_package_configuration"
        );
        const effectiveValue = packageRecord?.configuration?.effective_values?.remote_browser_rendezvous_enabled?.value ??
          remoteAccessField?.value;
        const defaultValue = remoteAccessField?.default?.value ?? remoteAccessField?.default ?? false;
        const request = action?.request ?? action?.action?.params?.daemon_request ?? packageRecord?.configuration_submit?.params?.daemon_request;

        const ready = (
          (remoteAccessField?.type === "boolean" || remoteAccessField?.config_type === "boolean" || remoteAccessField?.kind === "checkbox") &&
          defaultValue === false &&
          typeof effectiveValue === "boolean" &&
          (action?.status === "available" || packageRecord?.configuration_submit?.disabled === false) &&
          request?.request_type === "set_package_configuration"
        );
        return ready ? effectiveValue : undefined;
      }
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
    await page.getByText("Package configuration").waitFor();
    await page.getByText("Remote browser access").first().waitFor();
    const remoteAccessLabelCount = await page.getByText("Remote browser access").count();
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
    await page.getByText("Package configuration").waitFor({ state: "detached" });
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

async function waitForAutomaticTerminalRestore(page) {
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "read_screen" }, "automatic read_screen request");
  const restoration = await page.waitForFunction(
    () => {
      const entry = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).findLast(
        (entry) =>
          entry.kind === "output" &&
          entry.payload?.source === "read_screen" &&
          typeof entry.payload?.data === "string" &&
          entry.payload.data.length > 0
      );
      return entry ? { text: entry.payload.data, chars: entry.payload.data.length } : null;
    },
    undefined,
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for automatic ReadScreen restoration: ${error.message}`);
  });
  await waitForTerminalRendererWrite(page, restoration.text);

  const telemetry = await page.evaluate(() => {
    const assemblies = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
      .filter((entry) => entry.kind === "webrtc_response_assembly")
      .map((entry) => entry.payload)
      .filter((payload) =>
        payload?.request_type === "read_screen" &&
        Number.isInteger(payload?.total_bytes) &&
        Number.isInteger(payload?.chunk_count) &&
        Number.isFinite(payload?.duration_ms)
      );
    return assemblies.toSorted((left, right) => right.total_bytes - left.total_bytes)[0] ?? null;
  });
  if (!telemetry || telemetry.total_bytes <= 0 || telemetry.chunk_count < 1) {
    throw new Error(`ReadScreen restoration did not traverse WebRTC response chunk framing: ${JSON.stringify(telemetry)}`);
  }
  if (telemetry.duration_ms >= 10_000) {
    throw new Error(`historical terminal response assembly exceeded its request deadline: ${JSON.stringify(telemetry)}`);
  }
  if (telemetry.duration_ms > 8_000) {
    throw new Error(`historical terminal response assembly lacks 2,000 ms timeout headroom: ${JSON.stringify(telemetry)}`);
  }
  return { restored_chars: restoration.chars, response_assembly: telemetry };
}

async function assertTerminalAttachChronology(page, sessionId) {
  const chronology = await page.waitForFunction(
    ({ expectedSessionId }) => {
      const events = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "daemon_event")
        .map((entry) => entry.payload)
        .filter((event) =>
          event?.session_id === expectedSessionId &&
          typeof event.subscription_id === "string" &&
          ["attach_state", "snapshot", "scrollback", "terminal_output"].includes(event.type)
        );
      const subscriptionIds = [...new Set(events.map((event) => event.subscription_id))];

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
              return globalThis.atob(event.payload_base64).length !== event.bytes;
            } catch {
              return true;
            }
          });
          if (invalidHistory) {
            return {
              error: "snapshot/scrollback payload is not valid binary-safe revision-14 metadata",
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
    { expectedSessionId: sessionId },
    { timeout: 45_000 }
  ).then((handle) => handle.jsonValue()).catch((error) => {
    throw new Error(`timed out waiting for subscription-scoped attach chronology: ${error.message}`);
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

async function waitForSessionStatus(page, status) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "botster-web.session",
      id: productionSessionId,
      status
    },
    `session entity status ${status}`
  );
}

async function waitForSessionAttachable(page, attachable) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "botster-web.session",
      id: productionSessionId,
      status: "running",
      attachable
    },
    `restored session attachable=${attachable}`
  );
}

async function waitForTerminalAttachState(page, states) {
  const expectedStates = Array.isArray(states) ? states : [states];
  await page.waitForFunction(
    ({ expectedStates: nextExpectedStates }) => {
      const status = globalThis.document
        .querySelector(".terminal-status")
        ?.getAttribute("data-terminal-attach-state");
      return nextExpectedStates.includes(status);
    },
    { expectedStates },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal attach state ${expectedStates.join(" or ")}: ${error.message}`);
  });
}

async function waitForTerminalSession(page, sessionId) {
  await page.waitForFunction(
    ({ expectedSessionId }) =>
      globalThis.document.querySelector(".terminal-view-container")?.getAttribute("data-terminal-session-id") === expectedSessionId,
    { expectedSessionId: sessionId },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal session ${sessionId}: ${error.message}`);
  });
}

async function waitForTerminalDetached(page) {
  await page.waitForFunction(
    () => globalThis.document.querySelector("[data-terminal-session-id='none']") !== null,
    undefined,
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal detach placeholder: ${error.message}`);
  });
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
