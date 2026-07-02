import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { connect, createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

const host = "127.0.0.1";
const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
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
    await prepareProjectPipelinesPackage();
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
  await waitForRemoteAccessPackageConfiguration(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_sessions" }, "list_sessions request");
  await openAppsView(page);
  await assertRemoteAccessSettingsDispatch(page);
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

  await refreshPackageRuntime(page);
  await waitForTransportLabel(page);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, "post-refresh status request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_sessions" }, "post-refresh list_sessions request");
  await openDiagnosticsView(page);
  await waitForSessionStatus(page, "running");
  await waitForSessionAttachable(page, true);
  await page.getByRole("button", { name: "Attach botster-web-dogfood-session" }).click();
  await waitForTerminalSession(page, "botster-web-dogfood-session");
  await waitForHistoricalTerminalRestore(page);
  await waitForTerminalOutput(page, "botster-web-dogfood-ready");
  await waitForTerminalRendererWrite(page, "botster-web-dogfood-ready");

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
  await sendBridgeDaemonRequest("install-project-pipelines-package", {
    type: "install_package_local_path",
    path: packagePath
  });
  await sendBridgeDaemonRequest("seed-project-pipelines-configuration", {
    type: "set_package_configuration",
    package_name: "project-pipelines",
    values: {
      api_token: { type: "secret", state: "write_only" }
    }
  });
  await sendBridgeDaemonRequest("enable-project-pipelines-package", {
    type: "enable_package",
    package_name: "project-pipelines"
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

async function refreshPackageRuntime(page) {
  if (transportMode !== "webrtc") {
    await page.reload({ waitUntil: "domcontentloaded" });
    return;
  }

  if (!webrtcDataDir) {
    throw new Error("WebRTC package refresh requires the isolated data dir");
  }
  const socketPath = join(webrtcDataDir, "botster-hub.sock");
  await sendDaemonRequest(socketPath, {
    type: "stop_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  port = await findAvailablePort();
  bridgeUrl = `http://${host}:${port}`;
  await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client",
    environment_overrides: {
      BOTSTER_WEB_DOGFOOD_BRIDGE_PORT: String(port)
    }
  });
  appUrl = await waitForPackageAppUrl(socketPath);
  await waitForHttpOk(new URL("/health", appUrl).toString(), () =>
    hubProcess?.exitCode !== null ? `hub exited before package runtime refresh (code=${hubProcess.exitCode})` : undefined
  );
  await waitForHtmlShell(withDogfoodMode(appUrl));
  await page.goto(withDogfoodMode(appUrl), { waitUntil: "domcontentloaded" });
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
  await canvas.click({ position: { x: 10, y: 10 } });
  await page.keyboard.insertText(data);
}

async function openAppsView(page) {
  await page.getByRole("button", { name: "Apps", exact: true }).click();
  await page.getByTestId("apps-view").waitFor();
}

async function openDiagnosticsView(page) {
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByTestId("diagnostics-view").waitFor();
}

async function openFirstPartyUiAppSurface(page, mode) {
  const installedAppsList = page.locator("[aria-label='Installed apps']");
  const installedPackagesList = page.locator("[aria-label='Installed packages']");
  const firstPartyPattern = mode === "webrtc" ? /botster[- ]web|Dogfood/i : /project[- ]pipelines|botster[- ]workspaces|workspaces/i;
  const packageNamePattern = mode === "webrtc" ? "^botster-web$" : "^(project-pipelines|botster-workspaces)$";
  let candidate = installedAppsList.getByText(firstPartyPattern).first();
  const appRowCount = await candidate.count();
  if (appRowCount === 0) {
    candidate = installedPackagesList.getByText(firstPartyPattern).first();
  }
  const foundSurface = await candidate.waitFor({ timeout: 15_000 }).then(() => true).catch(async (error) => {
    const installedAppsText = await installedAppsList.innerText().catch(() => "");
    const installedPackagesText = await installedPackagesList.innerText().catch(() => "");
    console.log(
      `skipping first-party app surface proof; no first-party UI surface row was visible; installed apps=${JSON.stringify(installedAppsText)} installed packages=${JSON.stringify(installedPackagesText)}: ${error.message}`
    );
    return false;
  });
  if (!foundSurface) return;
  await candidate.click();
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "plugin_surface_render", package_name_pattern: packageNamePattern },
    "first-party app plugin_surface_render request"
  );
  await page.getByTestId("selected-app-surface").waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const text = globalThis.document.querySelector("[data-testid='selected-app-surface']")?.textContent ?? "";
      return /project-pipelines|botster-workspaces|Pipelines|Workspaces|botster-web|Dogfood/i.test(text) && /rendered|\//i.test(text);
    },
    undefined,
    { timeout: 45_000 }
  ).catch(async (error) => {
    const selectedText = await page.getByTestId("selected-app-surface").innerText().catch(() => "");
    throw new Error(`selected app surface did not render visible first-party content; text=${JSON.stringify(selectedText)}: ${error.message}`);
  });
}

async function exerciseFirstPartyPackageConfiguration(page) {
  const endpoint = "https://example.invalid/live-web-configuration";

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

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByText("Package configuration").waitFor({ state: "detached" });
  await openPackageSettings(page, "project-pipelines");
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
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByText("Package configuration").waitFor({ state: "detached" });
  await openDiagnosticsView(page);
  await page.getByText("select_option_unknown").first().waitFor({ timeout: 15_000 });
  await page.getByText("invalid-mode").first().waitFor({ timeout: 15_000 });
}

async function openPackageSettings(page, packageName) {
  const installedPackagesList = page.locator("[aria-label='Installed packages']");
  const packageLabel = packageName.replace(/[-_]+/g, " ");
  const settingsButton = installedPackagesList.getByRole("button", {
    name: new RegExp(`Settings for ${packageLabel}`, "i")
  });
  await settingsButton.waitFor({ timeout: 15_000 }).catch(async (error) => {
    const installedPackagesText = await installedPackagesList.innerText().catch(() => "");
    throw new Error(
      `timed out waiting for ${packageName} settings button; installed packages=${JSON.stringify(installedPackagesText)}: ${error.message}`
    );
  });
  await settingsButton.click();
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
        return true;
      });
    },
    { criteria },
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for ${label}: ${error.message}`);
  });
}

async function waitForTransportLabel(page) {
  await page.waitForFunction(
    () => {
      const text = globalThis.document.body?.innerText ?? "";
      return /\bwebrtc\b|\breal-hub\b/.test(text);
    },
    undefined,
    { timeout: 45_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for visible transport label: ${error.message}`);
  });
}

async function waitForRemoteAccessPackageConfiguration(page) {
  await page.waitForFunction(
    () => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== "daemon_response" || entry.payload?.kind !== "packages") return false;
        const packageRecord = entry.payload.packages?.find((candidate) => candidate.package_name === "botster-web");
        const fields = packageRecord?.configuration?.schema?.fields ?? [];
        const remoteAccessField = fields.find((field) => field.key === "remote_browser_rendezvous_enabled");
        const action = packageRecord?.actions?.find((candidate) => candidate.action_id === "set_package_configuration");
        return (
          remoteAccessField?.type === "boolean" &&
          remoteAccessField?.default?.value === false &&
          packageRecord?.configuration?.effective_values?.remote_browser_rendezvous_enabled?.value === false &&
          action?.status === "available" &&
          action?.request?.request_type === "set_package_configuration"
        );
      });
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
  await page.getByRole("button", { name: "Close" }).click();
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
    { timeout: 15_000 }
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
