import { createServer } from "node:http";
import { connect } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const protocol = "botster-hub-daemon-v1";
const port = Number.parseInt(process.env.BOTSTER_WEB_DOGFOOD_BRIDGE_PORT ?? "41739", 10);
const host = "127.0.0.1";
const hubBin = resolvePath(process.env.BOTSTER_HUB_BIN);
const sessionWorkerBin = resolvePath(process.env.BOTSTER_SESSION_WORKER_BIN);
const keepData = process.env.BOTSTER_WEB_DOGFOOD_KEEP_DATA === "1";

if (!hubBin) {
  console.error("BOTSTER_HUB_BIN must point to a botster-hub binary.");
  process.exit(1);
}

const dataDir = process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR ?? (await mkdtemp(join(tmpdir(), "botster-web-dogfood-")));
const socketPath = join(dataDir, "botster-hub.sock");
const hubArgs = ["start", "--data-dir", dataDir];

if (sessionWorkerBin) {
  hubArgs.push("--session-worker-bin", sessionWorkerBin);
}

const hub = spawn(hubBin, hubArgs, {
  stdio: ["ignore", "pipe", "pipe"]
});
let hubExit;

hub.stdout.setEncoding("utf8");
hub.stderr.setEncoding("utf8");
hub.stdout.on("data", (chunk) => process.stdout.write(`[botster-hub] ${chunk}`));
hub.stderr.on("data", (chunk) => process.stderr.write(`[botster-hub] ${chunk}`));
hub.on("error", (error) => {
  console.error(`botster-hub spawn failed: ${error.message}`);
  process.exit(1);
});
hub.on("exit", (code, signal) => {
  hubExit = { code, signal };
});

await waitForSocket(socketPath, () => hubExit);

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { ok: true, data_dir: "<isolated-temp-dir>" });
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/terminal")) {
    await streamTerminal(request, response);
    return;
  }

  if (request.method !== "POST" || request.url !== "/request") {
    writeJson(response, 404, { error: "not_found" });
    return;
  }

  try {
    const envelope = JSON.parse(await readRequestBody(request));
    if (envelope.kind !== "daemon_request" || !envelope.payload || typeof envelope.payload.type !== "string") {
      writeJson(response, 400, {
        kind: "daemon_response",
        request_id: envelope.request_id ?? "invalid",
        payload: operatorError("invalid_bridge_payload", "bridge", "Expected daemon_request envelope with DaemonRequest payload")
      });
      return;
    }

    const payload = await sendDaemonRequest(socketPath, envelope.payload);
    writeJson(response, 200, {
      kind: "daemon_response",
      request_id: envelope.request_id,
      payload
    });
    if (envelope.payload.type === "daemon_shutdown") {
      server.close();
      if (!keepData && !process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR) {
        await rm(dataDir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    writeJson(response, 500, {
      kind: "daemon_response",
      request_id: "bridge-error",
      payload: operatorError(
        "bridge_request_failed",
        "bridge",
        error instanceof Error ? error.message : "Bridge request failed"
      )
    });
  }
});

server.listen(port, host, () => {
  console.log(`botster-web real hub dogfood bridge listening at http://${host}:${port}/request`);
  console.log(`isolated data dir: ${dataDir}`);
});

const shutdown = async () => {
  server.close();
  try {
    await sendDaemonRequest(socketPath, { type: "daemon_shutdown" });
  } catch {
    hub.kill("SIGTERM");
  }

  if (!keepData && !process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR) {
    await rm(dataDir, { recursive: true, force: true });
  }
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(130));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(143));
});

async function sendDaemonRequest(path, daemonRequest) {
  const socket = await openDaemonSocket(path);
  socket.write(`${JSON.stringify(daemonRequest)}\n`);
  const reply = JSON.parse(await readSocketLine(socket));
  socket.end();
  return reply;
}

async function streamTerminal(request, response) {
  const url = new URL(request.url, `http://${host}:${port}`);
  const sessionId = url.searchParams.get("session_id");
  const subscriptionId = url.searchParams.get("subscription_id");

  if (!sessionId || !subscriptionId) {
    writeJson(response, 400, { error: "missing terminal stream identifiers" });
    return;
  }

  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive"
  });

  let socket;
  let closed = false;
  let draining = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (socket) {
      try {
        socket.write(`${JSON.stringify({ type: "detach", session_id: sessionId, subscription_id: subscriptionId })}\n`);
        await readSocketLine(socket);
      } catch {
        // Best effort cleanup; daemon also detaches subscriptions on socket disconnect.
      }
      socket.end();
    }
  };

  request.on("close", () => {
    void cleanup();
  });

  try {
    socket = await openDaemonSocket(socketPath);
    socket.write(`${JSON.stringify({ type: "attach", session_id: sessionId, subscription_id: subscriptionId })}\n`);
    emitDaemonEvents(response, JSON.parse(await readSocketLine(socket)).events ?? []);

    const drain = async () => {
      if (closed || draining) return;
      draining = true;
      try {
        socket.write(`${JSON.stringify({ type: "drain", session_id: sessionId })}\n`);
        const reply = JSON.parse(await readSocketLine(socket));
        emitDaemonEvents(response, reply.events ?? []);
        if ((reply.events ?? []).some((event) => event.type === "process_exit")) {
          await cleanup();
          response.end();
        }
      } catch (error) {
        sendSseEvent(response, "daemon_error", {
          message: error instanceof Error ? error.message : "terminal stream drain failed"
        });
        await cleanup();
        response.end();
      } finally {
        draining = false;
        if (!closed) {
          setTimeout(drain, 25);
        }
      }
    };

    void drain();
  } catch (error) {
    sendSseEvent(response, "daemon_error", {
      message: error instanceof Error ? error.message : "terminal stream attach failed"
    });
    await cleanup();
    response.end();
  }
}

async function openDaemonSocket(path) {
  const socket = connect(path);
  await once(socket, "connect");
  socket.setEncoding("utf8");

  socket.write(`${JSON.stringify({ protocol })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== protocol) {
    socket.end();
    throw new Error("daemon hello protocol mismatch");
  }

  return socket;
}

function emitDaemonEvents(response, events) {
  for (const event of events) {
    sendSseEvent(response, "daemon_event", event);
  }
}

function sendSseEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
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
      reject(new Error("daemon socket closed before a JSON frame was read"));
    };

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

async function waitForSocket(path, exitStatus) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    const exited = exitStatus();
    if (exited) {
      throw new Error(`botster-hub exited before socket startup (code=${exited.code ?? "null"}, signal=${exited.signal ?? "null"})`);
    }

    try {
      const socket = connect(path);
      await once(socket, "connect");
      socket.end();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError ?? new Error("timed out waiting for botster-hub socket");
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function operatorError(code, operation, message) {
  return {
    kind: "operator_error",
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
    error: {
      code,
      request_id: "botster-web-dogfood-bridge",
      operation,
      message
    }
  };
}

function resolvePath(path) {
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
