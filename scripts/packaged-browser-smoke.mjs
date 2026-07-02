import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const host = "127.0.0.1";
const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const spawnFailureMessage = "Spawn failed before terminal attach; the requested session already exists.";
const spawnRuntimeError = "runtime failed while handling Spawn: Runtime";

await runPackagedBrowserSmoke({
  name: "successful spawn",
  spawnFails: false
});
await runPackagedBrowserSmoke({
  name: "spawn failure diagnostics",
  spawnFails: true
});

console.log("packaged browser smoke passed");

async function runPackagedBrowserSmoke(scenario) {
  const root = await mkdtemp(join(tmpdir(), "botster-web-browser-smoke-"));
  const socketPath = join(root, "hub.sock");
  const port = await findAvailablePort();
  const consoleEvents = [];
  const pageErrors = [];
  const responseErrors = [];
  const daemonRequests = [];
  await mkdir(root, { recursive: true });
  const daemon = createFakeDaemon(socketPath, daemonRequests, scenario);
  await listen(daemon, socketPath);

  const bridgeProcess = spawn(
    process.execPath,
    [new URL("./real-hub-dogfood-bridge.mjs", import.meta.url).pathname],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        BOTSTER_HUB_SOCKET: socketPath,
        BOTSTER_WEB_DOGFOOD_BRIDGE_PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let bridgeStdout = "";
  let bridgeStderr = "";
  bridgeProcess.stdout.setEncoding("utf8");
  bridgeProcess.stderr.setEncoding("utf8");
  bridgeProcess.stdout.on("data", (chunk) => {
    bridgeStdout += chunk;
  });
  bridgeProcess.stderr.on("data", (chunk) => {
    bridgeStderr += chunk;
  });

  let browser;
  let page;

  try {
    await waitForHttpOk(`http://${host}:${port}/health`, {
      bridgeProcess,
      bridgeStdout: () => bridgeStdout,
      bridgeStderr: () => bridgeStderr
    });
    browser = await chromium.launch();
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

    await page.goto(`http://${host}:${port}/?dogfood=real-hub`, {
      waitUntil: "domcontentloaded"
    });
    await openDiagnosticsView(page);
    try {
      await page.getByText("Local hub workbench").waitFor();
    } catch (error) {
      assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
      const bodyText = await page.locator("body").innerText().catch(() => "");
      throw new Error(
        `packaged browser smoke did not render the local hub workbench; body=${JSON.stringify(bodyText.slice(0, 500))}`,
        { cause: error }
      );
    }
    await page.getByRole("heading", { name: "Spawn botster-web-dogfood-session" }).waitFor();
    await page.getByText("botster-web-dogfood-ready").first().waitFor();
    await page.getByText("Output appears in the terminal panel").first().waitFor();
    await page.getByText("Terminal output destination: botster-web-dogfood-session").waitFor();
    const staleOverviewCount = await page.getByText("Ionic React renderer shell").count();
    if (staleOverviewCount > 0) {
      throw new Error("packaged browser smoke rendered the stale renderer-shell overview");
    }

    await openAppsView(page);
    await page.getByRole("heading", { name: "Apps", exact: true }).waitFor();
    const installedAppsList = page.locator("[aria-label='Installed apps']");
    const installedPackagesList = page.locator("[aria-label='Installed packages']");
    await installedAppsList.getByText("botster web dogfood app").waitFor();
    await installedPackagesList.getByText("botster web").first().waitFor();
    await page.getByRole("button", { name: "Settings for botster web", exact: true }).click();
    await page.getByText("Package configuration").waitFor();
    await page.getByText("Remote browser access").first().waitFor();
    const remoteAccessLabelCount = await page.getByText("Remote browser access").count();
    if (remoteAccessLabelCount !== 1) {
      throw new Error(`packaged browser smoke expected one Remote browser access label, observed ${remoteAccessLabelCount}`);
    }
    await page.getByText("Remote browser rendezvous is off.").waitFor();
    await page.getByText("Local installed access stays available. Remote access requires opt-in, pairing, and device approval.").waitFor();
    await page.getByText("Webhook endpoint *").waitFor();
    await page.getByText("API token *").waitFor();
    await page.getByText("Required configuration is missing.").waitFor();
    await page.getByText("Secret saved").waitFor();
    await page.locator("ion-input[data-configuration-field='endpoint'] input").fill("https://example.invalid/hook");
    await page.locator("[data-testid='package-configuration-save']").click();
    await page.getByText("Required configuration is missing.").waitFor({ state: "detached" });
    await page.locator("ion-input[data-configuration-field='endpoint'] input").fill("");
    await page.locator("[data-testid='package-configuration-save']").click();
    await page.getByText("Required configuration is missing.").waitFor();
    await page.getByRole("button", { name: "Opt in" }).click();
    await page.getByText("Package action accepted").waitFor();
    await page.getByText("Remote browser rendezvous is opted in.").waitFor();
    await page.getByRole("button", { name: "Opt out" }).click();
    await page.getByText("Remote browser rendezvous is off.").waitFor();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByText("Package configuration").waitFor({ state: "detached" });

    await installedAppsList.getByText("botster web dogfood app").click();
    await page.getByText("botster-web Dogfood").waitFor();
    await page.getByText("botster-web Dogfood: Deterministic app surface rendered by the botster-web dogfood package. (botster-web/dogfood-app)").waitFor();
    const installedAppSurfaceRequest = await page.evaluate(() =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).find((entry) =>
        entry.kind === "daemon_request" &&
        entry.payload?.type === "plugin_surface_render" &&
        entry.payload?.package_name === "botster-web" &&
        entry.payload?.surface_id === "dogfood-app"
      )
    );
    if (!installedAppSurfaceRequest) {
      throw new Error("packaged browser smoke did not send plugin_surface_render for botster-web/dogfood-app from the installed app row");
    }

    await page.getByRole("button", { name: "Settings for botster web", exact: true }).click();
    await page.getByRole("button", { name: "Disable Package" }).click();
    await page.getByText("botster-web: Disable Package (disabled)").waitFor();
    await page.getByRole("button", { name: "Close" }).click();

    await openDiagnosticsView(page);
    await page.getByRole("button", { name: "Spawn botster-web-dogfood-session to terminal" }).click();

    if (scenario.spawnFails) {
      await page.getByText("Hub action failed").waitFor();
      await page.getByText(spawnFailureMessage).first().waitFor();
      await page.getByText("Operation: spawn").first().waitFor();
      const genericRuntimeErrorCount = await page.getByText(spawnRuntimeError).count();
      if (genericRuntimeErrorCount === 0) {
        throw new Error("spawn failure smoke did not render the generic runtime error");
      }
    } else {
      await page.getByText("Session botster-web-dogfood-session is running").waitFor();
      await page.locator("[data-terminal-renderer='restty']").waitFor({ state: "attached" });
      await page.locator("[data-terminal-session-id='botster-web-dogfood-session']").waitFor({
        state: "attached"
      });
      await waitForTerminalRendererWrite(page, "browser-smoke-snapshot");
      await waitForTerminalRendererWrite(page, "browser-smoke-scrollback");
      await waitForTerminalCanvas(page);

      await page.reload({ waitUntil: "domcontentloaded" });
      await openDiagnosticsView(page);
      await page.getByText("Local hub workbench").waitFor();
      await page.getByRole("button", { name: "Attach botster-web-dogfood-session" }).click();
      await page.locator("[data-terminal-session-id='botster-web-dogfood-session']").waitFor({
        state: "attached"
      });
      await waitForTerminalRendererWrite(page, "browser-smoke-snapshot");
      await waitForTerminalRendererWrite(page, "browser-smoke-scrollback");
      await waitForTerminalCanvas(page);

      await page.waitForTimeout(500);
      const mountFailureCount = await page.locator("[data-terminal-diagnostic='mount-failed']").count();
      if (mountFailureCount > 0) {
        throw new Error("terminal renderer rendered a mount-failed diagnostic in packaged browser smoke");
      }
    }

    assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
    if (!daemonRequests.some((request) => request.type === "spawn")) {
      throw new Error(`packaged browser smoke ${scenario.name} did not dispatch the spawn action through the bridge`);
    }
    for (const requiredRequest of ["list_apps", "list_packages", "disable_package"]) {
      if (!daemonRequests.some((request) => request.type === requiredRequest)) {
        throw new Error(`packaged browser smoke ${scenario.name} did not dispatch ${requiredRequest} through the bridge`);
      }
    }
    const configurationRequests = daemonRequests.filter((request) => request.type === "set_package_configuration");
    if (configurationRequests.length < 2) {
      throw new Error(`packaged browser smoke ${scenario.name} did not dispatch success and validation package configuration saves through the bridge`);
    }
    const successfulConfigurationRequest = configurationRequests.find(
      (request) => request.values?.endpoint?.value === "https://example.invalid/hook"
    );
    if (!successfulConfigurationRequest) {
      throw new Error(`packaged browser smoke ${scenario.name} did not submit the edited endpoint value through set_package_configuration`);
    }
    const invalidConfigurationRequest = configurationRequests.find(
      (request) => request.values && !request.values.endpoint?.value
    );
    if (!invalidConfigurationRequest) {
      throw new Error(`packaged browser smoke ${scenario.name} did not submit an invalid package configuration round trip`);
    }
    const remoteAccessRequests = daemonRequests.filter((request) =>
      request.type === "set_package_configuration" &&
      request.package_name === "botster-web" &&
      Object.hasOwn(request.values ?? {}, "remote_browser_rendezvous_enabled")
    );
    if (remoteAccessRequests.length !== 2) {
      throw new Error(`packaged browser smoke expected two remote access configuration dispatches, observed ${remoteAccessRequests.length}`);
    }
    if (
      remoteAccessRequests[0].values.remote_browser_rendezvous_enabled.value !== true ||
      remoteAccessRequests[1].values.remote_browser_rendezvous_enabled.value !== false
    ) {
      throw new Error(`packaged browser smoke sent unexpected remote access values: ${JSON.stringify(remoteAccessRequests)}`);
    }
    const secretLeak = JSON.stringify({
      daemonRequests,
      consoleEvents
    });
    if (/super-secret-token|write_only/.test(secretLeak)) {
      throw new Error("packaged browser smoke leaked secret material or write-only markers before secret replacement");
    }
  } catch (error) {
    const harnessState = page
      ? await page.evaluate(() => ({
        harness: globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__,
        activeElement: globalThis.document.activeElement
          ? {
            tagName: globalThis.document.activeElement.tagName,
            className: globalThis.document.activeElement.className,
            role: globalThis.document.activeElement.getAttribute("role")
          }
          : null,
        terminalHtml: globalThis.document.querySelector(".terminal-view-container")?.innerHTML,
        bodyText: globalThis.document.body?.innerText,
        appsViewHtml: globalThis.document.querySelector("[data-testid='apps-view']")?.innerHTML
      })).catch(() => undefined)
      : undefined;
    throw new Error(`${scenario.name}: ${error.message}\nbridge stdout:\n${bridgeStdout}\nbridge stderr:\n${bridgeStderr}\ndaemon requests:\n${JSON.stringify(daemonRequests, null, 2)}\nharness state:\n${JSON.stringify(harnessState, null, 2)}`, { cause: error });
  } finally {
    await browser?.close();
    bridgeProcess.kill("SIGTERM");
    await Promise.race([
      once(bridgeProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 1_000))
    ]);
    daemon.close();
    await once(daemon, "close").catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}

async function waitForTerminalRendererWrite(page, text) {
  await page.waitForFunction(
    ({ expectedText }) =>
      (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? []).some(
        (entry) => entry.kind === "renderer_write" && String(entry.payload?.data ?? "").includes(expectedText)
      ),
    { expectedText: text },
    { timeout: 15_000 }
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

async function openDiagnosticsView(page) {
  await page.getByRole("button", { name: "Diagnostics" }).click();
  await page.getByTestId("diagnostics-view").waitFor();
}

async function openAppsView(page) {
  await page.getByRole("button", { name: "Apps" }).click();
  await page.getByTestId("apps-view").waitFor();
}

function assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors }) {
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
    throw new Error(`packaged browser smoke failed:\n${failures.join("\n")}`);
  }
}

function createFakeDaemon(path, requests, scenario) {
  const state = {
    inputBuffers: new Map(),
    latestSubscriptions: new Map(),
    terminalQueues: new Map(),
    packageConfigured: false,
    remoteAccessEnabled: false
  };

  return createNetServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        handleDaemonLine(socket, line, requests, scenario, state);
        newline = buffer.indexOf("\n");
      }
    });
  });
}

function handleDaemonLine(socket, line, requests, scenario, state) {
  if (!line.trim()) return;
  const request = JSON.parse(line);
  if (request.protocol === protocol) {
    socket.write(`${JSON.stringify({ protocol })}\n`);
    return;
  }

  requests.push(request);
  socket.write(`${JSON.stringify(daemonResponse(request, scenario, state))}\n`);
}

function daemonResponse(request, scenario, state) {
  if (request.type === "status") {
    return {
      kind: "status",
      status: {
        running: true,
        version: "browser-smoke",
        schema_version: 1,
        terminal_view_bridge: true
      },
      sessions: [],
      packages: [],
      events: []
    };
  }

  if (request.type === "list_sessions") {
    return {
      kind: "sessions",
      sessions: [{ session_id: "botster-web-dogfood-session", lifecycle: "running" }],
      events: []
    };
  }

  if (request.type === "list_apps") {
    return {
      kind: "apps",
      apps: [
        {
          app_id: "dogfood-app",
          package_name: "botster-web",
          entrypoint_id: "web-client",
          kind: "web_app",
          launch_mode: "browser",
          lifecycle_state: "running",
          launch_target: {
            kind: "web_app",
            local_url: "http://127.0.0.1:41739/"
          },
          blocked_reasons: [],
          actions: [],
          diagnostics: []
        }
      ],
      events: []
    };
  }

  if (request.type === "list_packages") {
    return {
      kind: "packages",
      packages: [configurableSmokePackage(state.packageConfigured, state.remoteAccessEnabled)],
      events: []
    };
  }

  if (request.type === "set_package_configuration") {
    const endpoint = request.values?.endpoint;
    if (endpoint && typeof endpoint === "object" && "value" in endpoint) {
      state.packageConfigured = Boolean(endpoint.value);
    }
    if (Object.hasOwn(request.values ?? {}, "remote_browser_rendezvous_enabled")) {
      state.remoteAccessEnabled = request.values?.remote_browser_rendezvous_enabled?.value === true;
    }
    return {
      kind: "packages",
      packages: [configurableSmokePackage(state.packageConfigured, state.remoteAccessEnabled)],
      events: []
    };
  }

  if (request.type === "plugin_surface_render") {
    return {
      kind: "plugin_surface",
      plugin_surface: {
        package_name: request.package_name,
        surface_id: request.surface_id,
        title: "Smoke package app",
        body: "Smoke package surface rendered"
      },
      events: []
    };
  }

  if (request.type === "disable_package") {
    return {
      kind: "package_decision",
      package_decision: {
        package_name: request.package_name,
        action: "disable_package",
        state: "disabled"
      },
      diagnostics: [
        {
          kind: "action",
          operation: "disable_package",
          feature: "package_registry",
          message: "botster-web package disabled"
        }
      ],
      packages: [configurableSmokePackage(state.packageConfigured, state.remoteAccessEnabled)],
      events: []
    };
  }

  if (request.type === "spawn") {
    if (scenario.spawnFails) {
      return {
        kind: "operator_error",
        sessions: [],
        packages: [],
        events: [],
        error: {
          code: "session_already_exists",
          request_id: "browser-smoke-spawn-failure",
          operation: "spawn",
          message: spawnRuntimeError
        },
        diagnostics: [
          {
            kind: "action_failure",
            operation: "spawn",
            feature: null,
            message: spawnFailureMessage
          }
        ]
      };
    }

    return {
      kind: "spawned",
      sessions: [{ session_id: request.session_id, lifecycle: "running" }],
      events: [
        { type: "session_lifecycle", session_id: request.session_id, state: "running" }
      ]
    };
  }

  if (request.type === "attach") {
    state.latestSubscriptions.set(request.session_id, request.subscription_id);
    return {
      events: [
        {
          type: "attach_state",
          session_id: request.session_id,
          subscription_id: request.subscription_id,
          state: "attached"
        },
        {
          type: "snapshot",
          session_id: request.session_id,
          subscription_id: request.subscription_id,
          data: "browser-smoke-snapshot\r\n",
          bytes: 24
        },
        {
          type: "scrollback",
          session_id: request.session_id,
          subscription_id: request.subscription_id,
          data: "browser-smoke-scrollback\r\n",
          bytes: 26
        },
        {
          type: "terminal_output",
          session_id: request.session_id,
          subscription_id: request.subscription_id,
          data: "browser-smoke-ready\r\n"
        }
      ]
    };
  }

  if (request.type === "drain") {
    const queue = state.terminalQueues.get(request.session_id) ?? [];
    state.terminalQueues.set(request.session_id, []);
    return { events: queue };
  }

  if (request.type === "detach") {
    return { events: [] };
  }

  if (request.type === "send_input") {
    const currentBuffer = state.inputBuffers.get(request.session_id) ?? "";
    const nextBuffer = currentBuffer + request.data;
    if (nextBuffer.includes("\n") || nextBuffer.includes("\r")) {
      const line = nextBuffer.replace(/[\r\n]/g, "");
      const subscriptionId = state.latestSubscriptions.get(request.session_id);
      const queue = state.terminalQueues.get(request.session_id) ?? [];
      queue.push({
        type: "terminal_output",
        session_id: request.session_id,
        subscription_id: subscriptionId,
        data: `browser-smoke-echo:${line}\r\n`
      });
      state.terminalQueues.set(request.session_id, queue);
      state.inputBuffers.set(request.session_id, "");
    } else {
      state.inputBuffers.set(request.session_id, nextBuffer);
    }

    return {
      kind: "terminal_ack",
      events: []
    };
  }

  if (request.type === "resize") {
    return {
      kind: "terminal_ack",
      events: []
    };
  }

  return {
    kind: "operator_error",
    sessions: [],
    packages: [],
    events: [],
    error: {
      code: "unsupported_request",
      request_id: "browser-smoke",
      operation: request.type,
      message: `Unsupported smoke request: ${request.type}`
    }
  };
}

function configurableSmokePackage(packageConfigured, remoteAccessEnabled) {
  return {
    package_name: "botster-web",
    version: "0.1.0",
    classification: "plugin",
    state: "enabled",
    requested_capabilities: [],
    runnable_entrypoints: [],
    surfaces: [
      {
        id: "dogfood-app",
        kind: "app",
        title: "Dogfood app",
        description: "Smoke package app surface",
        supports: ["web"],
        order: 1
      },
      {
        id: "dogfood-settings",
        kind: "settings",
        title: "Dogfood settings",
        description: "Smoke package settings surface",
        supports: ["settings"],
        order: 2
      }
    ],
    configuration: {
      schema: {
        fields: [
          {
            key: "endpoint",
            type: "url",
            label: "Webhook endpoint",
            description: "Endpoint for package callbacks.",
            required: true
          },
          {
            key: "api_token",
            type: "secret",
            label: "API token",
            description: "Token used by the package.",
            required: true
          },
          {
            key: "remote_browser_rendezvous_enabled",
            type: "boolean",
            label: "Remote browser access",
            description: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
            default: { type: "boolean", value: false }
          }
        ]
      },
      effective_values: {
        ...(packageConfigured ? { endpoint: { type: "string", value: "https://example.invalid/hook" } } : {}),
        api_token: { type: "secret", state: "redacted" },
        remote_browser_rendezvous_enabled: { type: "boolean", value: remoteAccessEnabled }
      },
      missing_required: packageConfigured ? [] : ["endpoint"],
      diagnostics: []
    },
    actions: [
      {
        action_id: "disable_package",
        status: "available",
        reason: null,
        diagnostics: [],
        required_references: [],
        request: { request_type: "disable_package", package_name: "botster-web" }
      },
      {
        action_id: "set_package_configuration",
        status: "available",
        reason: null,
        diagnostics: [],
        required_references: [],
        request: { request_type: "set_package_configuration", package_name: "botster-web" }
      }
    ],
    provider_profile_admitted: false
  };
}

async function findAvailablePort() {
  const server = createNetServer();
  await listen(server, 0);
  const address = server.address();
  const assignedPort = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return assignedPort;
}

function listen(server, pathOrPort) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    const onListening = () => {
      server.off("error", reject);
      resolve();
    };
    if (typeof pathOrPort === "number") {
      server.listen(pathOrPort, host, onListening);
    } else {
      server.listen(pathOrPort, onListening);
    }
  });
}

async function waitForHttpOk(url, bridge) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    if (bridge.bridgeProcess.exitCode !== null) {
      throw new Error(
        `bridge exited before readiness: stdout=${bridge.bridgeStdout()} stderr=${bridge.bridgeStderr()}`
      );
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
