import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { connect, createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

const host = "127.0.0.1";
const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const workspacesPackagePath = resolveOptionalPackagePath(
  [process.env.BOTSTER_WORKSPACES_PACKAGE_PATH, process.env.BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH],
  "botster-workspaces"
);
const contractMatrixMode = process.env.BOTSTER_LIVE_CONTRACT_MATRIX === "1";
const contractMatrixPackageName = "botster.plugin-contract-matrix";
const contractMatrixSeedEndpoint = "https://example.invalid/plugin-contract-matrix/acceptance";
let contractMatrixFixtureTempDir;
const contractMatrixPackagePath = contractMatrixMode
  ? await resolveContractMatrixPackagePath()
  : undefined;
let port = Number.parseInt(process.env.BOTSTER_WEB_DOGFOOD_BRIDGE_PORT ?? String(await findAvailablePort()), 10);
let bridgeUrl = `http://${host}:${port}`;
const echoProbe = "botster-web-dogfood-live-input";
const transportMode = process.env.BOTSTER_LIVE_PACKAGED_TRANSPORT ?? "webrtc";

if (!["webrtc", "bridge"].includes(transportMode)) {
  throw new Error("BOTSTER_LIVE_PACKAGED_TRANSPORT must be unset, webrtc, or bridge");
}

if (!process.env.BOTSTER_HUB_BIN && !process.env.BOTSTER_HUB_SOCKET && !process.env.BOTSTER_HUB_DATA_DIR) {
  throw new Error(
    "Live packaged protocol harness requires BOTSTER_HUB_BIN, BOTSTER_HUB_SOCKET, or BOTSTER_HUB_DATA_DIR. " +
      "Use BOTSTER_HUB_BIN with BOTSTER_SESSION_WORKER_BIN for an isolated spawned hub."
  );
}

if (!workspacesPackagePath) {
  console.log(
    "Workspaces package path not provided; live packaged protocol harness will fall back to generic first-party/dogfood surface coverage. " +
      "Set BOTSTER_WORKSPACES_PACKAGE_PATH or BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH for named botster-workspaces/workspaces acceptance."
  );
}

let bridgeProcess;
let bridgeStdout = "";
let bridgeStderr = "";
let hubProcess;
let hubStdout = "";
let hubStderr = "";
const ownsWebrtcDataDir = transportMode === "webrtc" && !process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR;
const webrtcDataDir = transportMode === "webrtc"
  ? process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR ?? await mkdtemp(join(tmpdir(), "botster-web-webrtc-dogfood-"))
  : undefined;
let appUrl = `${bridgeUrl}/?dogfood=real-hub`;

let browser;
let page;
const consoleEvents = [];
const pageErrors = [];
const responseErrors = [];

try {
  if (transportMode === "webrtc") {
    appUrl = await startWebrtcPackageRuntime();
  } else {
    bridgeProcess = startBridgeProcess();
    await waitForHttpOk(`${bridgeUrl}/health`, () => bridgeProcess?.exitCode !== null ? `bridge exited before readiness (code=${bridgeProcess.exitCode})` : undefined);
    await waitForHtmlShell(`${bridgeUrl}/?dogfood=real-hub`);
    if (contractMatrixMode) {
      await prepareContractMatrixPackageThroughBridge();
    } else {
      await prepareProjectPipelinesPackage();
    }
  }

  browser = await chromium.launch({
    args: transportMode === "webrtc"
      ? ["--disable-features=WebRtcHideLocalIpsWithMdns", "--force-webrtc-ip-handling-policy=default_public_and_private_interfaces"]
      : []
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

  await page.goto(withDogfoodMode(appUrl), { waitUntil: "domcontentloaded" });
  await openDiagnosticsView(page);
  await page.getByText("Local hub workbench").waitFor();
  await waitForTransportLabel(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, "status request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_apps" }, "list_apps request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_packages" }, "list_packages request");
  if (transportMode === "webrtc") {
    await waitForRemoteAccessPackageConfiguration(page);
  }
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_sessions" }, "list_sessions request");
  await openAppsView(page);
  if (transportMode === "webrtc") {
    await assertRemoteAccessSettingsDispatch(page);
  }
  if (contractMatrixMode) {
    await exercisePluginContractMatrix(page);
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    await requestDaemonShutdown();
    console.log(`plugin contract matrix smoke passed (${transportMode})`);
    process.exit(0);
  }
  if (transportMode === "bridge") {
    await exerciseFirstPartyPackageConfiguration(page);
    await openAppsView(page);
  }
  await openFirstPartyUiAppSurface(page, transportMode);
  if (process.env.BOTSTER_LIVE_SURFACE_ONLY === "1") {
    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    await requestDaemonShutdown();
    console.log("live packaged protocol surface proof passed");
    process.exit(0);
  }
  await openDiagnosticsView(page);

  await page.getByRole("button", { name: "Spawn botster-web-dogfood-session to terminal" }).click();
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "spawn" }, "spawn request");
  await waitForSessionStatus(page, "running");
  await waitForSessionAttachable(page, true);
  await page.getByText("Attachable").waitFor();
  await waitForTerminalSession(page, "botster-web-dogfood-session");
  await waitForTerminalOutput(page, "botster-web-dogfood-ready");

  let previousGrantId = await latestLocalWebrtcGrantId(page);
  for (const cycle of [1, 2]) {
    previousGrantId = await reloadSamePackageUrlAndAssertWebrtc(page, cycle, previousGrantId);
    await openDiagnosticsView(page);
    await waitForSessionStatus(page, "running");
    await waitForSessionAttachable(page, true);
    await page.getByRole("button", { name: "Attach botster-web-dogfood-session" }).click();
    await waitForTerminalSession(page, "botster-web-dogfood-session");
    await waitForHistoricalTerminalRestore(page);
    await waitForTerminalOutput(page, "botster-web-dogfood-ready");
    await waitForTerminalRendererWrite(page, "botster-web-dogfood-ready");
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
  await waitForTerminalOutput(page, `botster-web-dogfood-echo:${echoProbe}`);
  await waitForTerminalRendererWrite(page, `botster-web-dogfood-echo:${echoProbe}`);
  const sendInputRequestsAfterEcho = await daemonRequestCount(page, {
    type: "send_input",
    data: `${echoProbe}\n`
  });
  if (sendInputRequestsAfterEcho !== sendInputRequestsBeforeEcho + 1) {
    throw new Error(
      `expected one send_input for ${echoProbe}, observed ${sendInputRequestsAfterEcho - sendInputRequestsBeforeEcho}`
    );
  }
  await waitForTerminalAttachState(page, ["attached"]);

  const requestedResize = await latestTerminalResize(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "resize", rows: requestedResize.rows, cols: requestedResize.columns },
    "resize request"
  );
  await waitForResizeProof(page, requestedResize);

  await callTerminalControl(page, "writeInput", "botster-web-dogfood-exit\n");
  await waitForTerminalOutput(page, "botster-web-dogfood-exiting");
  await waitForProcessExitProof(page);
  await waitForSessionStatus(page, "exited");
  await page.getByText("Exited sessions cannot attach").waitFor();
  await waitForTerminalDetached(page);

  await assertNoUnknownSession(page);
  assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
  await requestDaemonShutdown();
  console.log(`live packaged protocol harness passed (${transportMode})`);
} catch (error) {
  const harnessState = page
    ? await page.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__).catch(() => undefined)
    : undefined;
  let diagnosticMessage = `${error.message}\nbridge stdout:\n${bridgeStdout}\nbridge stderr:\n${bridgeStderr}`;
  if (hubStdout || hubStderr) {
    diagnosticMessage += `\nhub stdout:\n${hubStdout}\nhub stderr:\n${hubStderr}`;
  }
  if (harnessState) {
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
  if (bridgeProcess && bridgeProcess.exitCode === null) {
    bridgeProcess.kill("SIGTERM");
    await Promise.race([
      once(bridgeProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000))
    ]);
  }
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
  if (transportMode === "webrtc") {
    if (webrtcDataDir) {
      await runHubCommand(["shutdown", "--data-dir", webrtcDataDir]).catch((error) => {
        if (hubProcess?.exitCode === null) {
          throw error;
        }
      });
    }
    return;
  }

  const requestUrl = new URL("/request", appUrl).toString();
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "daemon_request",
      request_id: "live-packaged-protocol-shutdown",
      payload: { type: "daemon_shutdown" }
    })
  });
  if (!response.ok) {
    throw new Error(`daemon shutdown request failed with HTTP ${response.status}`);
  }
}

async function prepareProjectPipelinesPackage() {
  const packagePath = resolveProjectPipelinesPackagePath();
  const installPayload = await sendBridgeDaemonRequest("install-project-pipelines-package", {
    type: "install_package_local_path",
    path: packagePath
  });
  if (daemonPackageHasConfigurationField(installPayload, "project-pipelines", "api_token")) {
    await sendBridgeDaemonRequest("seed-project-pipelines-configuration", {
      type: "set_package_configuration",
      package_name: "project-pipelines",
      values: {
        api_token: { type: "secret", state: "write_only" }
      }
    });
  }
  await sendBridgeDaemonRequest("enable-project-pipelines-package", {
    type: "enable_package",
    package_name: "project-pipelines"
  });
  await prepareWorkspacesPackageThroughBridge();
}

async function prepareWorkspacesPackageThroughBridge() {
  if (!workspacesPackagePath) return;

  await sendBridgeDaemonRequest("install-workspaces-package", {
    type: "install_package_local_path",
    path: workspacesPackagePath
  });
  await sendBridgeDaemonRequest("enable-workspaces-package", {
    type: "enable_package",
    package_name: "botster-workspaces"
  });
}

async function prepareContractMatrixPackageThroughBridge() {
  if (!contractMatrixMode || !contractMatrixPackagePath) return;

  await sendBridgeDaemonRequest("install-plugin-contract-matrix-package", {
    type: "install_package_local_path",
    path: contractMatrixPackagePath
  });
  await sendBridgeDaemonRequest("configure-plugin-contract-matrix-package", {
    type: "set_package_configuration",
    package_name: contractMatrixPackageName,
    values: {
      endpoint: { type: "url", value: contractMatrixSeedEndpoint },
      mode: { type: "select", value: "write" },
      api_token: { type: "secret", state: "write_only" }
    }
  });
  await sendBridgeDaemonRequest("enable-plugin-contract-matrix-package", {
    type: "enable_package",
    package_name: contractMatrixPackageName
  });
}

function daemonPackageHasConfigurationField(payload, packageName, fieldId) {
  const packages = payload?.packages ?? [];
  return packages.some((packageRecord) => {
    const recordName = packageRecord?.package_name ?? packageRecord?.name ?? packageRecord?.id;
    if (recordName !== packageName) return false;
    return (packageRecord?.configuration?.fields ?? []).some((field) => field?.key === fieldId || field?.id === fieldId);
  });
}

async function sendBridgeDaemonRequest(requestId, payload) {
  const response = await fetch(`${bridgeUrl}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "daemon_request",
      request_id: requestId,
      payload
    })
  });
  const envelope = await response.json().catch(() => undefined);
  const daemonPayload = envelope?.payload;
  if (!response.ok || daemonPayload?.error) {
    throw new Error(
      `live harness daemon request ${requestId} failed: http=${response.status} payload=${JSON.stringify(daemonPayload)}`
    );
  }
  return daemonPayload;
}

function resolveProjectPipelinesPackagePath() {
  const configuredPath =
    process.env.BOTSTER_PROJECT_PIPELINES_PACKAGE_PATH ?? process.env.BOTSTER_LIVE_PROJECT_PIPELINES_PACKAGE_PATH;
  const candidates = [
    configuredPath,
    process.env.BOTSTER_HUB_SOURCE_DIR ? join(process.env.BOTSTER_HUB_SOURCE_DIR, "examples/project-pipelines") : undefined,
    process.env.BOTSTER_HUB_BIN ? resolve(dirname(process.env.BOTSTER_HUB_BIN), "../..", "examples/project-pipelines") : undefined
  ].filter(Boolean);
  const packagePath = candidates.find((candidate) => existsSync(join(candidate, "botster-package.json")));
  if (!packagePath) {
    throw new Error(
      `live harness could not find examples/project-pipelines package; checked ${JSON.stringify(candidates)}`
    );
  }
  return packagePath;
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
  if (transportMode !== "webrtc") {
    await page.reload({ waitUntil: "domcontentloaded" });
    return;
  }

  await page.reload({ waitUntil: "domcontentloaded" });
}

async function revisitPackageRuntime(page) {
  await page.goto(withDogfoodMode(appUrl), { waitUntil: "domcontentloaded" });
}

async function reloadSamePackageUrlAndAssertWebrtc(page, cycle, previousGrantId) {
  const expectedUrl = withDogfoodMode(appUrl);
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
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_sessions" }, `reload ${cycle} list_sessions request`);
  return grantId;
}

async function callTerminalControl(page, method, ...args) {
  await page.waitForFunction(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl));
  await page.evaluate(
    async ({ method: nextMethod, args: nextArgs }) => {
      await globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl[nextMethod](...nextArgs);
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

async function openDiagnosticsView(page) {
  await page.getByLabel("Botster workbench").getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByTestId("diagnostics-view").waitFor();
}

async function openFirstPartyUiAppSurface(page, mode) {
  const installedAppsList = page.locator("[aria-label='Installed apps']");
  const installedPackagesList = page.locator("[aria-label='Installed packages']");
  const target = mode === "webrtc" && workspacesPackagePath
    ? {
        packageName: "botster-workspaces",
        surfaceId: "workspaces",
        visiblePattern: /botster[- ]workspaces|workspaces/i,
        packageNamePattern: "^botster-workspaces$"
      }
    : {
        packageName: mode === "webrtc" ? "botster-web" : undefined,
        surfaceId: mode === "webrtc" ? "dogfood-app" : undefined,
        visiblePattern: mode === "webrtc" ? /botster[- ]web|Dogfood/i : /project[- ]pipelines|botster[- ]workspaces|workspaces/i,
        packageNamePattern: mode === "webrtc" ? "^botster-web$" : "^(project-pipelines|botster-workspaces)$"
      };
  let candidate = installedAppsList.getByText(target.visiblePattern).first();
  const appRowCount = await candidate.count();
  if (appRowCount === 0) {
    candidate = installedPackagesList.getByText(target.visiblePattern).first();
  }
  const foundSurface = await candidate.waitFor({ timeout: 15_000 }).then(() => true).catch(async (error) => {
    const installedAppsText = await installedAppsList.innerText().catch(() => "");
    const installedPackagesText = await installedPackagesList.innerText().catch(() => "");
    const message = `no first-party UI surface row was visible; installed apps=${JSON.stringify(installedAppsText)} installed packages=${JSON.stringify(installedPackagesText)}: ${error.message}`;
    if (process.env.BOTSTER_LIVE_ALLOW_SURFACE_SKIP === "1") {
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
  await assertContractSurfaceRoute(page, "contract.app", "UiNode payload delivered through plugin_surface_render.");
  await assertContractSurfaceRouteReloadAndDirectLoad(page, "contract.app", "UiNode payload delivered through plugin_surface_render.");

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
    const installedPackagesText = await page.locator("[aria-label='Installed packages']").innerText().catch(() => "");
    const installedAppsText = await page.locator("[aria-label='Installed apps']").innerText().catch(() => "");
    throw new Error(
      `contract matrix package/app descriptors were not visible; installed packages=${JSON.stringify(installedPackagesText)} installed apps=${JSON.stringify(installedAppsText)}: ${error.message}`
    );
  });
}

async function openContractAppFromApps(page) {
  const installedAppsList = page.locator("[aria-label='Installed apps']");
  const installedPackagesList = page.locator("[aria-label='Installed packages']");
  let row = installedAppsList.getByText(/Contract App|plugin contract matrix|botster\.plugin-contract-matrix/i).first();
  if (await row.count() === 0) {
    row = installedPackagesList.getByText(/botster\.plugin-contract-matrix|plugin contract matrix/i).first();
  }
  await row.waitFor({ timeout: 15_000 }).catch(async (error) => {
    const installedAppsText = await installedAppsList.innerText().catch(() => "");
    const installedPackagesText = await installedPackagesList.innerText().catch(() => "");
    throw new Error(
      `timed out waiting for contract matrix app/package row; installed apps=${JSON.stringify(installedAppsText)} installed packages=${JSON.stringify(installedPackagesText)}: ${error.message}`
    );
  });
  await row.click();
}

async function navigateToContractSurface(page, surfaceId) {
  await page.goto(withDogfoodMode(new URL(`/apps/${contractMatrixPackageName}/${surfaceId}`, appUrl)), {
    waitUntil: "domcontentloaded"
  });
}

async function assertContractSurfaceRoute(page, surfaceId, visibleText) {
  await page.waitForURL(new RegExp(`/apps/${contractMatrixPackageName.replaceAll(".", "\\.")}/${surfaceId.replaceAll(".", "\\.")}`), { timeout: 15_000 });
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name: contractMatrixPackageName, surface_id: surfaceId },
    `${surfaceId} plugin_surface_render request`
  );
  if (transportMode === "bridge") {
    await waitForValidatedPluginSurfaceSnapshot(page, surfaceId);
  }
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
  await page.getByText(visibleText).waitFor({ timeout: 45_000 });
  await assertSelectedSurfaceNotLoading(page, surfaceId);
}

async function assertContractSurfaceRouteReloadAndDirectLoad(page, surfaceId, visibleText) {
  const routePath = `/apps/${contractMatrixPackageName}/${surfaceId}`;
  const routeUrl = withDogfoodMode(new URL(routePath, appUrl));

  await page.waitForURL(new RegExp(`${routePath.replaceAll(".", "\\.").replaceAll("/", "\\/")}`), { timeout: 15_000 });
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

async function waitForValidatedPluginSurfaceSnapshot(page, surfaceId) {
  await page.waitForFunction(
    ({ nextPackageName, nextSurfaceId }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).some((entry) => {
        const pluginSurface = entry.kind === "daemon_response"
          ? entry.payload?.plugin_surface ?? {}
          : entry.kind === "hub_frame" && entry.payload?.kind === "action_result"
            ? entry.payload?.payload?.result?.plugin_surface ?? {}
            : {};
        const snapshot = pluginSurface.ui_tree_snapshot ?? {};
        return pluginSurface.package_name === nextPackageName &&
          pluginSurface.surface_id === nextSurfaceId &&
          snapshot.package_name === nextPackageName &&
          snapshot.surface_id === nextSurfaceId &&
          Boolean(snapshot.body);
      }),
    { nextPackageName: contractMatrixPackageName, nextSurfaceId: surfaceId },
    { timeout: 45_000 }
  ).catch(async (error) => {
    const observedResponses = await page.evaluate((nextPackageName) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .map((entry) => entry.kind === "daemon_response"
          ? entry.payload?.plugin_surface
          : entry.kind === "hub_frame" && entry.payload?.kind === "action_result"
            ? entry.payload?.payload?.result?.plugin_surface
            : undefined)
        .filter((pluginSurface) => pluginSurface?.package_name === nextPackageName),
      contractMatrixPackageName
    );
    throw new Error(`${surfaceId} did not receive a hub validated plugin_surface.ui_tree_snapshot; observed=${JSON.stringify(observedResponses, null, 2)}: ${error.message}`);
  });
}

async function assertContractBlockedSurface(page) {
  await page.waitForURL(new RegExp(`/apps/${contractMatrixPackageName.replaceAll(".", "\\.")}/contract\\.blocked`), { timeout: 15_000 });
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
  if (transportMode === "bridge") {
    await waitForValidatedPluginSurfaceSnapshot(page, "contract.settings");
  }
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
  await assertContractSurfaceRoute(page, "contract.app", "UiNode payload delivered through plugin_surface_render.");
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
        action_id: "contract.action",
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
  const routePath = `/apps/${target.packageName}/${target.surfaceId}`;
  const routeUrl = new URL(routePath, appUrl);
  const expectedUrl = withDogfoodMode(routeUrl);

  await page.waitForURL(new RegExp(`${routePath.replaceAll("/", "\\/")}`), { timeout: 15_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertSelectedAppSurfaceRendered(page, target);

  await page.goto(expectedUrl, { waitUntil: "domcontentloaded" });
  await assertSelectedAppSurfaceRendered(page, target);
}

async function assertSelectedAppSurfaceRendered(page, target) {
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    ({ packageName, surfaceId }) => {
      const text = globalThis.document.querySelector("[data-testid='selected-app-surface']")?.textContent ?? "";
      const expectedRoute = packageName && surfaceId ? `${packageName}/${surfaceId}` : "";
      return /project-pipelines|botster-workspaces|Pipelines|Workspaces|botster-web|Dogfood/i.test(text) &&
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

async function exerciseFirstPartyPackageConfiguration(page) {
  const endpoint = "https://example.invalid/live-web-configuration";

  if (!await pagePackageHasConfigurationFields(page, "project-pipelines", ["operator_endpoint", "pipeline_mode", "api_token"])) {
    await openPackageSettings(page, "project-pipelines");
    await page.getByTestId("plugin-settings-route").waitFor();
    await page.getByText(/Project Pipelines Settings|No settings surface registered/).first().waitFor();
    await closePackageSettingsRoute(page);
    return;
  }

  await openPackageSettings(page, "project-pipelines");
  await page.getByText("Package configuration").waitFor();
  await page.getByText("Operator endpoint").waitFor();
  await page.getByText("Pipeline mode").waitFor();
  await page.getByText("API token").waitFor();
  await page.locator("ion-input[data-configuration-field='operator_endpoint'] input").fill(endpoint);
  await setIonicSelectValue(page, "pipeline_mode", "github");
  const listPackagesBeforeSave = await daemonRequestCount(page, { type: "list_packages" });
  await page.locator("[data-testid='package-configuration-save']").click();
  await waitForPackageConfigurationRequest(page, {
    packageName: "project-pipelines",
    values: {
      operator_endpoint: { type: "url", value: endpoint },
      pipeline_mode: { type: "select", value: "github" }
    },
    omittedKeys: ["api_token"]
  });
  await waitForDaemonRequestCount(
    page,
    { type: "list_packages" },
    listPackagesBeforeSave + 1,
    "post-save package refresh request"
  );

  await closePackageSettingsRoute(page);
  await page.getByText("Package configuration").waitFor({ state: "detached" });
  await openPackageSettings(page, "project-pipelines");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("plugin-settings-route").waitFor();
  await expectIonicTextInputValue(page, "operator_endpoint", endpoint);
  await expectIonicSelectValue(page, "pipeline_mode", "github");

  const requestCountBeforeInvalidSave = await daemonRequestCount(page, { type: "set_package_configuration" });
  await setIonicSelectValue(page, "pipeline_mode", "invalid-mode");
  await page.locator("[data-testid='package-configuration-save']").click();
  await waitForDaemonRequestCount(
    page,
    { type: "set_package_configuration" },
    requestCountBeforeInvalidSave + 1,
    "invalid package configuration save request"
  );
  await waitForPackageConfigurationRequest(page, {
    packageName: "project-pipelines",
    values: {
      pipeline_mode: { type: "select", value: "invalid-mode" }
    }
  });
  await closePackageSettingsRoute(page);
  await page.getByText("Package configuration").waitFor({ state: "detached" });
  await openDiagnosticsView(page);
  await page.getByText("select_option_unknown").first().waitFor({ timeout: 15_000 });
  await page.getByText("invalid-mode").first().waitFor({ timeout: 15_000 });
}

async function pagePackageHasConfigurationFields(page, packageName, fieldIds) {
  return await page.evaluate(({ packageName, fieldIds }) => {
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
    if (!packageRecord) return false;
    const rawFields = packageRecord.configuration?.fields ?? packageRecord.configuration?.schema?.fields ?? [];
    const projectedFields = packageRecord.configuration_fields ?? [];
    const availableFieldIds = new Set([...rawFields, ...projectedFields].map((field) => field.key ?? field.id));
    return fieldIds.every((fieldId) => availableFieldIds.has(fieldId));
  }, { packageName, fieldIds });
}

async function openPackageSettings(page, packageName) {
  await openAppsView(page);
  const installedPackagesList = page.locator("[aria-label='Installed packages']");
  const packageLabel = packageName.replace(/[-_]+/g, " ");
  const settingsButton = installedPackagesList.getByRole("button", {
    name: `Settings for ${packageLabel}`,
    exact: true
  });
  await settingsButton.waitFor({ timeout: 15_000 }).catch(async (error) => {
    const installedPackagesText = await installedPackagesList.innerText().catch(() => "");
    throw new Error(
      `timed out waiting for ${packageName} settings button; installed packages=${JSON.stringify(installedPackagesText)}: ${error.message}`
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

async function expectIonicSelectValue(page, fieldId, value) {
  await page.waitForFunction(
    ({ nextFieldId, nextValue }) =>
      globalThis.document.querySelector(`ion-select[data-configuration-field='${nextFieldId}']`)?.value === nextValue,
    { nextFieldId: fieldId, nextValue: value },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const actualValue = await page.locator(`ion-select[data-configuration-field='${fieldId}']`).evaluate((select) => select.value).catch(() => undefined);
    throw new Error(`timed out waiting for ${fieldId} select value ${value}; actual=${JSON.stringify(actualValue)}: ${error.message}`);
  });
}

async function expectIonicTextInputValue(page, fieldId, value) {
  await page.waitForFunction(
    ({ nextFieldId, nextValue }) =>
      globalThis.document.querySelector(`ion-input[data-configuration-field='${nextFieldId}'] input`)?.value === nextValue,
    { nextFieldId: fieldId, nextValue: value },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const actualValue = await page.locator(`ion-input[data-configuration-field='${fieldId}'] input`).inputValue().catch(() => undefined);
    throw new Error(`timed out waiting for ${fieldId} input value ${value}; actual=${JSON.stringify(actualValue)}: ${error.message}`);
  });
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
  await page.waitForFunction(
    ({ criteria: expectedCriteria }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== expectedCriteria.kind) return false;
        const payload = entry.payload ?? {};
        if (expectedCriteria.frameKind && payload.kind !== expectedCriteria.frameKind) return false;
        const framePayload = payload.payload ?? {};
        if (
          expectedCriteria.family &&
          framePayload.key?.family !== expectedCriteria.family &&
          framePayload.family !== expectedCriteria.family
        ) return false;
        if (
          expectedCriteria.id &&
          framePayload.key?.id !== expectedCriteria.id &&
          !framePayload.records?.some((record) => record.id === expectedCriteria.id)
        ) return false;
        if (
          expectedCriteria.status &&
          framePayload.record?.status !== expectedCriteria.status &&
          !framePayload.records?.some((record) => record.status === expectedCriteria.status)
        ) return false;
        if (expectedCriteria.type && payload.type !== expectedCriteria.type) return false;
        if (expectedCriteria.package_name && payload.package_name !== expectedCriteria.package_name) return false;
        if (expectedCriteria.package_name_pattern && !new RegExp(expectedCriteria.package_name_pattern).test(payload.package_name)) return false;
        if (expectedCriteria.surface_id && payload.surface_id !== expectedCriteria.surface_id) return false;
        if (typeof expectedCriteria.rows === "number" && payload.rows !== expectedCriteria.rows) return false;
        if (typeof expectedCriteria.cols === "number" && payload.cols !== expectedCriteria.cols) return false;
        if (expectedCriteria.state && payload.state !== expectedCriteria.state) return false;
        if (expectedCriteria.requestType && payload.requestType !== expectedCriteria.requestType) return false;
        return true;
      });
    },
    { criteria },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for ${label}: ${error.message}`);
  });
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
  const expectedDataPlane = transportMode === "webrtc" ? "WebRTC DataChannel" : "Bridge/SSE";
  const expectedLayer = transportMode === "webrtc" ? "Local WebRTC signaling via bridge" : "Bridge/SSE terminal transport active";
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

async function waitForRemoteAccessPackageConfiguration(page) {
  await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        const packageRecords = [];
        if (entry.kind === "daemon_response" && entry.payload?.kind === "packages") {
          packageRecords.push(...(entry.payload.packages ?? []));
        }
        if (entry.kind === "hub_frame" && entry.payload?.kind === "entity_snapshot") {
          const payload = entry.payload.payload;
          if (payload?.family === "botster-web.package") {
            packageRecords.push(...(payload.records ?? []));
          }
        }

        return packageRecords.some((packageRecord) =>
          (packageRecord?.package_name === "botster-web" || packageRecord?.id === "botster-web") &&
            hasRemoteAccessConfiguration(packageRecord)
        );
      });

      function hasRemoteAccessConfiguration(packageRecord) {
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

        return (
          (remoteAccessField?.type === "boolean" || remoteAccessField?.config_type === "boolean" || remoteAccessField?.kind === "checkbox") &&
          defaultValue === false &&
          effectiveValue === false &&
          (action?.status === "available" || packageRecord?.configuration_submit?.disabled === false) &&
          request?.request_type === "set_package_configuration"
        );
      }
    },
    undefined,
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for manifest-sourced botster-web remote access configuration: ${error.message}`);
  });
}

async function assertRemoteAccessSettingsDispatch(page) {
  await page.getByRole("button", { name: "Settings for botster web", exact: true }).click();
  await page.getByText("Package configuration").waitFor();
  await page.getByText("Remote browser access").first().waitFor();
  const remoteAccessLabelCount = await page.getByText("Remote browser access").count();
  if (remoteAccessLabelCount !== 1) {
    throw new Error(`live packaged protocol expected one Remote browser access label, observed ${remoteAccessLabelCount}`);
  }
  await page.getByText("Remote browser rendezvous is off.").waitFor();
  await page.getByText("Local installed access stays available. Remote access requires opt-in, pairing, and device approval.").waitFor();
  await page.getByRole("button", { name: "Opt in" }).click();
  await waitForRemoteAccessConfigRequest(page, true);
  await page.getByText("Package action accepted").waitFor();
  await closePackageSettingsRoute(page);
  await page.getByText("Package configuration").waitFor({ state: "detached" });
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

async function waitForHistoricalTerminalRestore(page) {
  const historyPayload = await page.waitForFunction(
    () => {
      const entry = (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).find(
        (entry) =>
          entry.kind === "output" &&
          (entry.payload?.source === "snapshot" || entry.payload?.source === "scrollback") &&
          typeof entry.payload?.data === "string"
      );
      return entry?.payload?.data ?? null;
    },
    undefined,
    { timeout: 15_000 }
  ).then((handle) => handle.jsonValue()).catch(async (error) => {
    const observedHistoryEvents = await page.evaluate(() =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [])
        .filter((entry) => entry.kind === "daemon_event")
        .map((entry) => entry.payload)
        .filter((payload) => payload?.type === "snapshot" || payload?.type === "scrollback")
    );

    if (observedHistoryEvents.length === 0) {
      throw new Error(
        `timed out waiting for snapshot.data/scrollback.data after refresh Attach; no snapshot or scrollback daemon events were observed: ${error.message}`
      );
    }

    throw new Error(
      `timed out waiting for renderable snapshot.data/scrollback.data after refresh Attach; observed history events: ${JSON.stringify(observedHistoryEvents, null, 2)}`
    );
  });
  await waitForTerminalRendererWrite(page, historyPayload);
}

async function waitForResizeProof(page, requestedResize) {
  const deadline = Date.now() + 20_000;
  let lastObservedSize = "none";

  while (Date.now() < deadline) {
    const outputCount = await terminalOutputCount(page);
    await callTerminalControl(page, "writeInput", "botster-web-dogfood-size\n");
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

async function waitForProcessExitProof(page) {
  await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind === "daemon_event" && entry.payload?.type === "process_exit") {
          return true;
        }
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "entity_snapshot") {
          return false;
        }
        const payload = entry.payload.payload;
        return (
          payload?.family === "botster-web.session" &&
          payload.records?.some((record) => record.id === "botster-web-dogfood-session" && record.status === "exited")
        );
      });
    },
    undefined,
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for process exit proof: ${error.message}`);
  });
}

async function waitForSessionStatus(page, status) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      family: "botster-web.session",
      id: "botster-web-dogfood-session",
      status
    },
    `session entity status ${status}`
  );
}

async function waitForSessionAttachable(page, attachable) {
  await page.waitForFunction(
    ({ expectedAttachable }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== "hub_frame" || entry.payload?.kind !== "entity_snapshot") return false;
        const payload = entry.payload.payload;
        return (
          payload?.family === "botster-web.session" &&
          payload.records?.some(
            (record) =>
              record.id === "botster-web-dogfood-session" &&
              record.status === "running" &&
              record.attachable === expectedAttachable
          )
        );
      });
    },
    { expectedAttachable: attachable },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for restored session attachable=${attachable}: ${error.message}`);
  });
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
        .map((entry) => String(entry.payload?.data ?? "").match(/botster-web-dogfood-size:(\d+x\d+)/)?.[1])
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

function startBridgeProcess() {
  const child = spawn(
    process.execPath,
    [new URL("./real-hub-dogfood-bridge.mjs", import.meta.url).pathname],
    {
      cwd: packageRoot,
      env: bridgeEnvironment(),
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    bridgeStdout += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    bridgeStderr += chunk;
    process.stderr.write(chunk);
  });
  return child;
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

  await runHubCommand(["packages", "install", "--data-dir", webrtcDataDir, "--path", packageRoot]);
  await runHubCommand(["packages", "enable", "--data-dir", webrtcDataDir, "botster-web"]);
  if (workspacesPackagePath) {
    await runHubCommand(["packages", "install", "--data-dir", webrtcDataDir, "--path", workspacesPackagePath]);
    await runHubCommand(["packages", "enable", "--data-dir", webrtcDataDir, "botster-workspaces"]);
  }
  if (contractMatrixMode && contractMatrixPackagePath) {
    await runHubCommand(["packages", "install", "--data-dir", webrtcDataDir, "--path", contractMatrixPackagePath]);
    await runHubCommand(["packages", "enable", "--data-dir", webrtcDataDir, contractMatrixPackageName]);
  }
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client",
    environment_overrides: {
      BOTSTER_WEB_DOGFOOD_BRIDGE_PORT: String(port)
    }
  });
  const url = await waitForPackageAppUrl(socketPath);

  await waitForHttpOk(new URL("/health", url).toString(), () =>
    hubProcess?.exitCode !== null ? `hub exited before package runtime readiness (code=${hubProcess.exitCode})` : undefined
  );
  await waitForHtmlShell(withDogfoodMode(url));
  return url;
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
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(socketPath, { type: "list_apps" });
    const app = response.apps?.find((candidate) => candidate.package_name === "botster-web" && candidate.entrypoint_id === "web-client");
    if (app?.lifecycle_state) {
      lastState = app.lifecycle_state;
    }
    if (app?.launch_target?.local_url) {
      return app.launch_target.local_url;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for botster-web/web-client local_url; lifecycle_state=${lastState}`);
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

function withDogfoodMode(url) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("dogfood", "real-hub");
  return nextUrl.toString();
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

function bridgeEnvironment() {
  const env = {
    ...process.env,
    BOTSTER_WEB_DOGFOOD_BRIDGE_PORT: String(port)
  };

  if (env.BOTSTER_HUB_BIN) {
    delete env.BOTSTER_HUB_SOCKET;
    delete env.BOTSTER_HUB_DATA_DIR;
  }

  return env;
}

async function findAvailablePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  const assignedPort = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return assignedPort;
}
