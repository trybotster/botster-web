import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

const host = "127.0.0.1";
const packageRoot = process.cwd();
const port = Number.parseInt(process.env.BOTSTER_WEB_DOGFOOD_BRIDGE_PORT ?? String(await findAvailablePort()), 10);
const bridgeUrl = `http://${host}:${port}`;
const echoProbe = "botster-web-dogfood-live-input";

if (!process.env.BOTSTER_HUB_BIN && !process.env.BOTSTER_HUB_SOCKET && !process.env.BOTSTER_HUB_DATA_DIR) {
  throw new Error(
    "Live packaged protocol harness requires BOTSTER_HUB_BIN, BOTSTER_HUB_SOCKET, or BOTSTER_HUB_DATA_DIR. " +
      "Use BOTSTER_HUB_BIN with BOTSTER_SESSION_WORKER_BIN for an isolated spawned hub."
  );
}

const bridgeProcess = spawn(
  process.execPath,
  [new URL("./real-hub-dogfood-bridge.mjs", import.meta.url).pathname],
  {
    cwd: packageRoot,
    env: bridgeEnvironment(),
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let bridgeStdout = "";
let bridgeStderr = "";
bridgeProcess.stdout.setEncoding("utf8");
bridgeProcess.stderr.setEncoding("utf8");
bridgeProcess.stdout.on("data", (chunk) => {
  bridgeStdout += chunk;
  process.stdout.write(chunk);
});
bridgeProcess.stderr.on("data", (chunk) => {
  bridgeStderr += chunk;
  process.stderr.write(chunk);
});

let browser;
let page;
const consoleEvents = [];
const pageErrors = [];
const responseErrors = [];

try {
  await waitForHttpOk(`${bridgeUrl}/health`);
  await waitForHtmlShell(`${bridgeUrl}/?dogfood=real-hub`);

  browser = await chromium.launch();
  page = await browser.newPage();
  await page.addInitScript(() => {
    window.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
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

  await page.goto(`${bridgeUrl}/?dogfood=real-hub`, { waitUntil: "domcontentloaded" });
  await page.getByText("Local hub workbench").waitFor();
  await page.getByText("real-hub").waitFor();
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "status" }, "status request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_packages" }, "list_packages request");
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "list_sessions" }, "list_sessions request");

  await page.getByRole("button", { name: "Spawn botster-web-dogfood-session to terminal" }).click();
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "spawn" }, "spawn request");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Local hub workbench").waitFor();
  await page.getByText("real-hub").waitFor();
  await waitForTerminalOutput(page, "botster-web-dogfood-ready");

  await callTerminalControl(page, "writeInput", `${echoProbe}\n`);
  await waitForHarnessEvent(page, { kind: "daemon_request", type: "send_input" }, "send_input request");
  await waitForTerminalOutput(page, `botster-web-dogfood-echo:${echoProbe}`);

  const requestedResize = await latestTerminalResize(page);
  await waitForHarnessEvent(
    page,
    { kind: "daemon_request", type: "resize", rows: requestedResize.rows, cols: requestedResize.columns },
    "resize request"
  );
  await waitForResizeProof(page, requestedResize);

  await callTerminalControl(page, "writeInput", "botster-web-dogfood-exit\n");
  await waitForTerminalOutput(page, "botster-web-dogfood-exiting");
  await waitForHarnessEvent(page, { kind: "daemon_event", type: "process_exit" }, "process_exit event");
  await waitForSessionStatus(page, "exited");

  assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
  await requestDaemonShutdown();
  console.log("live packaged protocol harness passed");
} catch (error) {
  const harnessState = page
    ? await page.evaluate(() => window.__BOTSTER_LIVE_PROTOCOL_HARNESS__).catch(() => undefined)
    : undefined;
  let diagnosticMessage = `${error.message}\nbridge stdout:\n${bridgeStdout}\nbridge stderr:\n${bridgeStderr}`;
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
  if (bridgeProcess.exitCode === null) {
    bridgeProcess.kill("SIGTERM");
  }
  await Promise.race([
    once(bridgeProcess, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
}

async function requestDaemonShutdown() {
  const response = await fetch(`${bridgeUrl}/request`, {
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

async function callTerminalControl(page, method, ...args) {
  await page.waitForFunction(() => Boolean(window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl));
  await page.evaluate(
    async ({ method: nextMethod, args: nextArgs }) => {
      await window.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl[nextMethod](...nextArgs);
    },
    { method, args }
  );
}

async function waitForHarnessEvent(page, criteria, label) {
  await page.waitForFunction(
    ({ criteria: expectedCriteria }) => {
      const events = window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.some((entry) => {
        if (entry.kind !== expectedCriteria.kind) return false;
        const payload = entry.payload ?? {};
        if (expectedCriteria.frameKind && payload.kind !== expectedCriteria.frameKind) return false;
        if (expectedCriteria.family && payload.payload?.key?.family !== expectedCriteria.family) return false;
        if (expectedCriteria.id && payload.payload?.key?.id !== expectedCriteria.id) return false;
        if (expectedCriteria.status && payload.payload?.record?.status !== expectedCriteria.status) return false;
        if (expectedCriteria.type && payload.type !== expectedCriteria.type) return false;
        if (typeof expectedCriteria.rows === "number" && payload.rows !== expectedCriteria.rows) return false;
        if (typeof expectedCriteria.cols === "number" && payload.cols !== expectedCriteria.cols) return false;
        return true;
      });
    },
    { criteria },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for ${label}: ${error.message}`);
  });
}

async function waitForTerminalOutput(page, text) {
  await page.waitForFunction(
    ({ expectedText }) =>
      (window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some(
        (entry) => entry.kind === "output" && String(entry.payload?.data ?? "").includes(expectedText)
      ),
    { expectedText: text },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal output ${text}: ${error.message}`);
  });
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

async function waitForSessionStatus(page, status) {
  await waitForHarnessEvent(
    page,
    {
      kind: "hub_frame",
      frameKind: "entity_patch",
      family: "botster-web.session",
      id: "botster-web-dogfood-session",
      status
    },
    `session entity status ${status}`
  );
}

async function terminalOutputCount(page) {
  return page.evaluate(
    () => (window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).filter((entry) => entry.kind === "output").length
  );
}

async function waitForNextSizeProbe(page, outputCount) {
  return page.waitForFunction(
    ({ previousOutputCount }) => {
      const outputs = (window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [])
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
    () => (window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some((entry) => entry.kind === "resize"),
    undefined,
    { timeout: 15_000 }
  );

  const resize = await page.evaluate(() => {
    const terminalEvents = window.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    const resizeEvents = terminalEvents.filter((entry) => entry.kind === "resize");
    return resizeEvents.at(-1)?.payload;
  });

  if (!resize || typeof resize.rows !== "number" || typeof resize.columns !== "number") {
    throw new Error("live harness could not read the latest terminal resize request");
  }

  return resize;
}

async function waitForHttpOk(url) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (bridgeProcess.exitCode !== null) {
      throw new Error(`bridge exited before readiness (code=${bridgeProcess.exitCode})`);
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
