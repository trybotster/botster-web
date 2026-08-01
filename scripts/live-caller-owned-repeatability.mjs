import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const protocol = "botster-hub-daemon-v1";

if (!process.env.BOTSTER_HUB_BIN || !process.env.BOTSTER_SESSION_WORKER_BIN) {
  throw new Error(
    "Caller-owned repeatability requires BOTSTER_HUB_BIN and BOTSTER_SESSION_WORKER_BIN"
  );
}

const dataDir = await mkdtemp(join(tmpdir(), "botster-web-caller-repeat-"));

try {
  const first = await runHarness(dataDir);
  await setRemoteAccessValue(dataDir, true);
  const second = await runHarness(dataDir);
  assertRestoredConfiguration(first, "first", false);
  assertRestoredConfiguration(second, "second", true);
  if (process.env.BOTSTER_WORKSPACES_PACKAGE_PATH || process.env.BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH) {
    assertWorkspacesGeneration(first, "initial");
    assertWorkspacesGeneration(second, "initial-retained");
  }
  if (!second.includes('"install":false') || !second.includes('"enable":false')) {
    throw new Error("second caller-owned run did not reuse the restored enabled package");
  }
  const persistedValue = await readRemoteAccessValue(dataDir);
  if (persistedValue !== true) {
    throw new Error(`second caller-owned run did not preserve true configuration: ${persistedValue}`);
  }
  console.log("caller-owned live packaged protocol repeatability passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

async function runHarness(dataDir) {
  const child = spawn(process.execPath, ["scripts/live-packaged-protocol-harness.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BOTSTER_LIVE_DATA_DIR: dataDir,
      BOTSTER_LIVE_DURABLE_STATE: "0"
    },
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
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(
      `caller-owned harness failed (code=${code}, signal=${signal ?? "none"})`
    );
  }
  return output;
}

function assertRestoredConfiguration(output, runLabel, expectedValue) {
  const line = output
    .split("\n")
    .find((candidate) =>
      candidate.startsWith("live caller-owned remote access configuration restored ")
    );
  if (!line) {
    throw new Error(`${runLabel} caller-owned run did not report configuration restoration`);
  }
  const evidence = JSON.parse(line.slice(line.indexOf("{")));
  if (
    evidence.original_value !== expectedValue ||
    evidence.restored_value !== evidence.original_value
  ) {
    throw new Error(
      `${runLabel} caller-owned run did not preserve its original configuration: ${line}`
    );
  }
}

function assertWorkspacesGeneration(output, expectedStage) {
  if (!output.includes(`Workspaces compatibility ${expectedStage} proof passed`)) {
    throw new Error(`caller-owned run omitted Workspaces ${expectedStage} proof`);
  }
}

async function setRemoteAccessValue(dataDir, value) {
  await withHub(dataDir, async (socketPath) => {
    const response = await sendDaemonRequest(socketPath, {
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
      throw new Error(`could not seed caller-owned configuration: ${JSON.stringify(response)}`);
    }
  });
}

async function readRemoteAccessValue(dataDir) {
  return withHub(dataDir, async (socketPath) => {
    const response = await sendDaemonRequest(socketPath, { type: "list_packages" });
    if (response.error) {
      throw new Error(`could not inspect caller-owned configuration: ${JSON.stringify(response)}`);
    }
    return response.packages
      ?.find((candidate) => candidate.package_name === "botster-web")
      ?.configuration
      ?.effective_values
      ?.remote_browser_rendezvous_enabled
      ?.value;
  });
}

async function withHub(dataDir, callback) {
  const socketPath = join(dataDir, "botster-hub.sock");
  const hub = spawn(
    process.env.BOTSTER_HUB_BIN,
    [
      "start",
      "--data-dir",
      dataDir,
      "--session-worker-bin",
      process.env.BOTSTER_SESSION_WORKER_BIN
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  hub.stdout.pipe(process.stdout);
  hub.stderr.pipe(process.stderr);
  try {
    await waitForSocket(socketPath, hub);
    return await callback(socketPath);
  } finally {
    const shutdown = spawn(
      process.env.BOTSTER_HUB_BIN,
      ["shutdown", "--data-dir", dataDir],
      { stdio: "inherit" }
    );
    await once(shutdown, "exit");
    if (hub.exitCode === null) {
      await once(hub, "exit");
    }
  }
}

async function waitForSocket(socketPath, hub) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (hub.exitCode !== null) {
      throw new Error(`Hub exited before caller-owned setup (code=${hub.exitCode})`);
    }
    const socket = connect(socketPath);
    const connected = await new Promise((resolve) => {
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for caller-owned Hub socket ${socketPath}`);
}

async function sendDaemonRequest(socketPath, request) {
  const socket = connect(socketPath);
  await once(socket, "connect");
  socket.setEncoding("utf8");
  socket.write(`${JSON.stringify({ protocol })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== protocol) {
    socket.end();
    throw new Error("caller-owned setup daemon protocol mismatch");
  }
  socket.write(`${JSON.stringify(request)}\n`);
  const response = JSON.parse(await readSocketLine(socket));
  socket.end();
  return response;
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
      if (newline < 0) return;
      cleanup();
      resolve(buffer.slice(0, newline));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("caller-owned setup daemon socket closed before reply"));
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}
