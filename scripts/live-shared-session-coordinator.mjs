import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_SHARED_SESSION_ID,
  productionSessionScriptSource
} from "./live-packaged-protocol-helpers.mjs";

const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const hubBinary = requiredPath("BOTSTER_HUB_BIN");
const sessionWorkerBinary = requiredPath("BOTSTER_SESSION_WORKER_BIN");
const sessionId = typeof process.env.BOTSTER_SHARED_SESSION_ID === "string"
  && process.env.BOTSTER_SHARED_SESSION_ID.trim() !== ""
  ? process.env.BOTSTER_SHARED_SESSION_ID.trim()
  : DEFAULT_SHARED_SESSION_ID;

const dataDir = await mkdtemp(join(process.platform === "win32" ? tmpdir() : "/tmp", "botster-web-shared-session-"));
const socketPath = join(dataDir, "botster-hub.sock");
let hub;

try {
  hub = spawn(hubBinary, [
    "start",
    "--data-dir",
    dataDir,
    "--session-worker-bin",
    sessionWorkerBinary
  ], { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] });
  hub.stdout.pipe(process.stdout);
  hub.stderr.pipe(process.stderr);
  await waitForSocket(socketPath, hub);

  await runHub(["packages", "install", "--data-dir", dataDir, "--path", packageRoot]);
  await runHub(["packages", "enable", "--data-dir", dataDir, "botster-web"]);
  const launch = await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  if (launch.error) {
    throw new Error(`could not launch botster-web/web-client: ${JSON.stringify(launch)}`);
  }
  const appUrl = await waitForPackageAppUrl(socketPath);
  await waitForHttpOk(appUrl);

  const scriptPath = join(dataDir, "botster-web-production-session.sh");
  await writeFile(scriptPath, productionSessionScriptSource());
  const spawnResponse = await sendDaemonRequest(socketPath, {
    type: "spawn",
    session_id: sessionId,
    command: `sh ${scriptPath}`
  });
  if (spawnResponse.error) {
    throw new Error(`shared-session spawn failed: ${JSON.stringify(spawnResponse.error)}`);
  }
  await waitForSessionLifecycle(sessionId, "running");

  const first = await runDriver();
  assertKeepAlivePass(first, "first");
  await waitForSessionLifecycle(sessionId, "running");
  const second = await runDriver();
  assertKeepAlivePass(second, "second");
  await waitForSessionLifecycle(sessionId, "running");

  const exitPass = await runDriver({ BOTSTER_SHARED_SESSION_PROVE_EXIT: "1" });
  assertExitPass(exitPass);
  await waitForSessionLifecycle(sessionId, ["exited", "failed"]);

  console.log(`live-shared-session-coordinator-passed ${JSON.stringify({
    session_id: sessionId,
    keep_alive_runs: 2,
    exit_pass: true
  })}`);
} finally {
  if (hub) {
    await runHub(["shutdown", "--data-dir", dataDir]).catch((error) => {
      if (hub.exitCode === null) throw error;
    });
    if (hub.exitCode === null) {
      await Promise.race([
        once(hub, "exit"),
        new Promise((resolveWait) => setTimeout(resolveWait, 5_000))
      ]);
    }
    if (hub.exitCode === null) hub.kill("SIGTERM");
  }
  await rm(dataDir, { recursive: true, force: true });
}

function assertKeepAlivePass(result, label) {
  assertSharedSessionDriverSuccess(result, label);
  if (!result.output.includes("live-shared-session-terminal-lane ")) {
    throw new Error(`${label} keep-alive omitted live-shared-session-terminal-lane`);
  }
  if (!result.output.includes(`live-shared-session-keep-alive-passed {"session_id":"${sessionId}"`)) {
    throw new Error(`${label} keep-alive omitted keep-alive marker for ${sessionId}`);
  }
  if (!result.output.includes("live-shared-session-cancel-passed ")) {
    throw new Error(`${label} keep-alive omitted live-shared-session-cancel-passed`);
  }
  if (result.output.includes("live-shared-session-exit-passed ")) {
    throw new Error(`${label} keep-alive ran the opt-in exit pass`);
  }
}

function assertExitPass(result) {
  assertSharedSessionDriverSuccess(result, "exit");
  if (!result.output.includes("live-shared-session-exit-passed ")) {
    throw new Error("exit pass omitted live-shared-session-exit-passed");
  }
  if (result.output.includes("live-shared-session-keep-alive-passed ")) {
    throw new Error("exit pass printed the keep-alive completion marker");
  }
}

function assertSharedSessionDriverSuccess(result, label) {
  if (result.code !== 0) {
    throw new Error(`${label} shared-session driver failed (code=${result.code})`);
  }
  if (result.output.includes("workspaces-shared-hub-browser-summary ")) {
    throw new Error(`${label} shared-session driver took the Workspaces early-exit path`);
  }
  if (result.output.includes("live packaged protocol harness passed (webrtc)")) {
    throw new Error(`${label} shared-session driver took the IsolatedHub completion path`);
  }
  if (result.output.includes(`"type":"shutdown_session"`) && result.output.includes(sessionId)) {
    throw new Error(`${label} shared-session driver output mentions shutdown_session for ${sessionId}`);
  }
}

async function runDriver(overrides = {}) {
  const env = { ...process.env };
  for (const name of [
    "BOTSTER_HUB_BIN",
    "BOTSTER_SESSION_WORKER_BIN",
    "BOTSTER_LIVE_SHARED_HUB_DRIVER",
    "BOTSTER_SHARED_SESSION_PROVE_EXIT",
    "BOTSTER_LIVE_ALLOW_SURFACE_SKIP",
    "BOTSTER_LIVE_ALLOW_BROWSER_SKIP"
  ]) {
    delete env[name];
  }
  Object.assign(env, {
    BOTSTER_LIVE_DATA_DIR: dataDir,
    BOTSTER_SHARED_SESSION_ID: sessionId,
    ...overrides
  });
  const child = spawn(process.execPath, ["scripts/live-shared-session-browser-driver.mjs"], {
    cwd: packageRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  const [code] = await once(child, "exit");
  return { code, output };
}

async function waitForSessionLifecycle(expectedSessionId, expected) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  const deadline = Date.now() + 15_000;
  let lastSessions = [];
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(socketPath, { type: "list_sessions" });
    lastSessions = response.sessions ?? [];
    const row = lastSessions.find((session) => session.session_id === expectedSessionId);
    if (row && accepted.includes(row.lifecycle)) return row;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(
    `timed out waiting for ${expectedSessionId} lifecycle ${accepted.join("|")}; observed=${JSON.stringify(lastSessions)}`
  );
}

async function runHub(args) {
  const child = spawn(hubBinary, args, { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
    process.stderr.write(chunk);
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`botster-hub ${args.join(" ")} failed (code=${code}, signal=${signal ?? "none"}): ${output}`);
  }
  return output;
}

async function waitForSocket(path, processHandle) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Hub exited before socket readiness (code=${processHandle.exitCode})`);
    }
    const socket = connect(path);
    const connected = await new Promise((resolveConnected) => {
      socket.once("connect", () => {
        socket.end();
        resolveConnected(true);
      });
      socket.once("error", () => resolveConnected(false));
    });
    if (connected) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for shared-session Hub socket ${path}`);
}

async function sendDaemonRequest(path, request) {
  const socket = connect(path);
  await once(socket, "connect");
  socket.setEncoding("utf8");
  socket.write(`${JSON.stringify({ protocol })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== protocol) {
    socket.end();
    throw new Error("shared-session coordinator daemon protocol mismatch");
  }
  socket.write(`${JSON.stringify(request)}\n`);
  const response = JSON.parse(await readSocketLine(socket));
  socket.end();
  return response;
}

async function readSocketLine(socket) {
  return new Promise((resolveLine, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      cleanup();
      resolveLine(buffer.slice(0, newline));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("shared-session coordinator socket closed before reply"));
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

function requiredPath(name) {
  const value = process.env[name];
  if (!value) throw new Error(`shared-session coordinator requires ${name}`);
  const path = resolve(value);
  if (!existsSync(path)) throw new Error(`${name} does not exist: ${path}`);
  return path;
}

async function waitForPackageAppUrl(path) {
  const deadline = Date.now() + 15_000;
  let lastApp;
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(path, { type: "list_apps" });
    const app = response.apps?.find((candidate) =>
      candidate.package_name === "botster-web" && candidate.entrypoint_id === "web-client"
    );
    lastApp = app;
    if (app?.launch_target?.local_url) return app.launch_target.local_url;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for botster-web/web-client local_url; app=${JSON.stringify(lastApp)}`);
}

async function waitForHttpOk(appUrl) {
  const health = new URL("/health", appUrl).toString();
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(health);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw lastError ?? new Error(`timed out waiting for ${health}`);
}
