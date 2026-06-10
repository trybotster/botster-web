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
const root = await mkdtemp(join(tmpdir(), "botster-web-browser-smoke-"));
const socketPath = join(root, "hub.sock");
const port = await findAvailablePort();
const consoleEvents = [];
const pageErrors = [];
const responseErrors = [];
const daemonRequests = [];

await mkdir(root, { recursive: true });
const daemon = createFakeDaemon(socketPath, daemonRequests);
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

try {
  await waitForHttpOk(`http://${host}:${port}/health`);
  browser = await chromium.launch();
  const page = await browser.newPage();

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
  await page.getByText("Isolated local hub dogfood").waitFor();
  await page.getByRole("button", { name: "Spawn isolated session" }).click();
  await page.locator("[data-terminal-renderer='restty']").waitFor({ state: "attached" });
  await page.locator("[data-terminal-session-id='botster-web-dogfood-session']").waitFor({
    state: "attached"
  });
  await page.waitForTimeout(500);
  const mountFailureCount = await page.locator("[data-terminal-diagnostic='mount-failed']").count();
  if (mountFailureCount > 0) {
    throw new Error("terminal renderer rendered a mount-failed diagnostic in packaged browser smoke");
  }

  assertNoBrowserFailures({ consoleEvents, pageErrors, responseErrors });
  if (!daemonRequests.some((request) => request.type === "spawn")) {
    throw new Error("packaged browser smoke did not dispatch the spawn action through the bridge");
  }

  console.log("packaged browser smoke passed");
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

function createFakeDaemon(path, requests) {
  return createNetServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        handleDaemonLine(socket, line, requests);
        newline = buffer.indexOf("\n");
      }
    });
  });
}

function handleDaemonLine(socket, line, requests) {
  if (!line.trim()) return;
  const request = JSON.parse(line);
  if (request.protocol === protocol) {
    socket.write(`${JSON.stringify({ protocol })}\n`);
    return;
  }

  requests.push(request);
  socket.write(`${JSON.stringify(daemonResponse(request))}\n`);
}

function daemonResponse(request) {
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

  if (request.type === "list_packages") {
    return {
      kind: "packages",
      packages: [],
      events: []
    };
  }

  if (request.type === "spawn") {
    return {
      kind: "spawned",
      sessions: [{ session_id: request.session_id, lifecycle: "running" }],
      events: [
        { type: "session_lifecycle", session_id: request.session_id, state: "running" }
      ]
    };
  }

  if (request.type === "attach") {
    return {
      events: [
        {
          type: "terminal_output",
          session_id: request.session_id,
          data: "browser-smoke-ready\r\n"
        }
      ]
    };
  }

  if (request.type === "drain") {
    return { events: [] };
  }

  if (request.type === "detach") {
    return { events: [] };
  }

  if (request.type === "resize" || request.type === "send_input") {
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

async function waitForHttpOk(url) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    if (bridgeProcess.exitCode !== null) {
      throw new Error(
        `bridge exited before readiness: stdout=${bridgeStdout} stderr=${bridgeStderr}`
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
