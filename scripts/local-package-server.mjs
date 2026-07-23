import { createServer } from "node:http";
import { connect } from "node:net";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, relative, sep } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { localPackageServerShutdownPlan, resolveLocalPackageServerMode } from "./localPackageServerMode.mjs";

const protocol = "botster-hub-daemon-v1";
const signalingRequestTypes = new Set(["issue_local_webrtc_bootstrap", "local_webrtc_signal"]);
const port = Number.parseInt(process.env.BOTSTER_WEB_PACKAGE_SERVER_PORT ?? "41739", 10);
const host = "127.0.0.1";
const packageRoot = process.cwd();
const distRoot = join(packageRoot, "dist");
const indexPath = join(distRoot, "index.html");
const launchResultPath = process.env.BOTSTER_ENTRYPOINT_LAUNCH_RESULT;
const existingHubConfigured = Boolean(process.env.BOTSTER_HUB_SOCKET || process.env.BOTSTER_HUB_DATA_DIR);
const generatedDataDir = existingHubConfigured || process.env.BOTSTER_WEB_DOGFOOD_DATA_DIR
  ? undefined
  : await mkdtemp(join(tmpdir(), "botster-web-dogfood-"));
const serverMode = resolveLocalPackageServerMode(process.env, { generatedDataDir });

if (!serverMode.ok) {
  if (generatedDataDir) {
    await rm(generatedDataDir, { recursive: true, force: true });
  }
  console.error(serverMode.error);
  process.exit(1);
}

let hubExit;
let hub;

if (serverMode.ownsHub) {
  hub = spawn(serverMode.hubBin, serverMode.hubArgs, {
    stdio: ["ignore", "pipe", "pipe"]
  });

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
}

await waitForSocket(serverMode.socketPath, () => hubExit, serverMode.diagnosticLabel);

let localUrl;

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
    writeJson(response, 200, { ...serverMode.health, local_url: localUrl });
    return;
  }

  if (request.method === "GET" && request.url === "/favicon.ico") {
    response.writeHead(204, {
      "cache-control": "public, max-age=86400"
    });
    response.end();
    return;
  }

  if (request.method === "GET") {
    await serveStaticUi(request, response);
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
        payload: operatorError("invalid_package_server_payload", "server", "Expected daemon_request envelope with DaemonRequest payload")
      });
      return;
    }

    if (!signalingRequestTypes.has(envelope.payload.type)) {
      writeJson(response, 400, {
        kind: "daemon_response",
        request_id: envelope.request_id,
        payload: operatorError(
          "unsupported_package_server_request",
          envelope.payload.type,
          "The package server only accepts WebRTC bootstrap and signaling requests."
        )
      });
      return;
    }

    const payload = await sendDaemonRequest(serverMode.socketPath, envelope.payload);
    writeJson(response, 200, {
      kind: "daemon_response",
      request_id: envelope.request_id,
      payload
    });
  } catch (error) {
    writeJson(response, 500, {
      kind: "daemon_response",
      request_id: "package-server-error",
      payload: operatorError(
        "package_server_request_failed",
        "package_server",
        error instanceof Error ? error.message : "Package server request failed"
      )
    });
  }
});

server.listen(port, host, () => {
  localUrl = boundServerOrigin(server);
  void publishReadyLaunchResult(localUrl)
    .then(() => {
      console.log(`botster-web local package server listening at ${localUrl}/request`);
      console.log(`botster-web package UI available at ${localUrl}/`);
      console.log(`mode: ${serverMode.diagnosticLabel}`);
      if (serverMode.mode === "spawned_hub") {
        console.log(`isolated data dir: ${serverMode.dataDir}`);
      } else {
        console.log(`attached socket: configured ${serverMode.source}`);
      }
    })
    .catch(() => {
      console.error("botster-web launch result write failed");
      server.close(() => process.exit(1));
    });
});

function boundServerOrigin(httpServer) {
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    return `http://${host}:${port}`;
  }

  return `http://${address.address}:${address.port}`;
}

async function publishReadyLaunchResult(url) {
  if (!launchResultPath) {
    return;
  }

  await writeFile(
    launchResultPath,
    `${JSON.stringify({
      entrypoint_id: "web-client",
      process_state: "running",
      local_url: url
    })}\n`
  );
}

const shutdown = async () => {
  server.close();
  const shutdownPlan = localPackageServerShutdownPlan(serverMode);
  if (shutdownPlan.sendDaemonShutdown) {
    try {
      await sendDaemonRequest(serverMode.socketPath, { type: "daemon_shutdown" });
    } catch {
      if (shutdownPlan.terminateHubProcess) {
        hub?.kill("SIGTERM");
      }
    }
  }

  if (shutdownPlan.removeDataDir) {
    await rm(serverMode.dataDir, { recursive: true, force: true });
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

async function serveStaticUi(request, response) {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const rawPathname = (request.url ?? "/").split(/[?#]/, 1)[0] || "/";
  const safePath = safeDistPath(url.pathname, rawPathname);

  if (!safePath.ok) {
    writeJson(response, 404, { error: "not_found" });
    return;
  }

  const filePath = url.pathname === "/" ? indexPath : safePath.path;
  const file = await readExistingFile(filePath);
  if (file.ok && file.stats.isFile()) {
    const isHtml = filePath === indexPath || extname(filePath) === ".html";
    const body = isHtml ? injectPackageRuntimeMarker(await readFile(filePath, "utf8")) : await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypeFor(filePath),
      "cache-control": isHtml ? "no-store" : "public, max-age=31536000, immutable"
    });
    response.end(body);
    return;
  }

  if (!isSpaRoutePath(url.pathname) && hasFileExtension(url.pathname)) {
    writeJson(response, 404, { error: "not_found" });
    return;
  }

  const index = await readExistingFile(indexPath);
  if (!index.ok) {
    writeJson(response, 503, {
      error: "compiled_ui_missing",
      message: "Run npm run build before starting the botster-web package entrypoint."
    });
    return;
  }

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(injectPackageRuntimeMarker(await readFile(indexPath, "utf8")));
}

async function readExistingFile(filePath) {
  try {
    return { ok: true, stats: await stat(filePath) };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false };
    }
    throw error;
  }
}

function safeDistPath(pathname, rawPathname = pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return { ok: false };
  }

  if (/(^|[/\\])\.\.([/\\]|$)/.test(decoded)) {
    return { ok: false };
  }

  const normalized = normalize(pathname).replace(/^(\.\.(?:\/|\\|$))+/, "");
  const relativePath = normalized.replace(/^[/\\]+/, "");
  const filePath = join(distRoot, relativePath);
  const distRelative = relative(distRoot, filePath);

  if (distRelative.startsWith("..") || distRelative.includes(`..${sep}`)) {
    return { ok: false };
  }

  return { ok: true, path: filePath };
}

function hasFileExtension(pathname) {
  return extname(new URL(pathname, `http://${host}:${port}`).pathname) !== "";
}

function isSpaRoutePath(pathname) {
  return pathname.startsWith("/apps/") || pathname.startsWith("/packages/");
}

function injectPackageRuntimeMarker(html) {
  const marker = `<script>window.__BOTSTER_PACKAGE_RUNTIME__ = true;${localWebrtcBootstrapScript()}</script>`;
  if (html.includes("__BOTSTER_PACKAGE_RUNTIME__")) {
    return html;
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", `${marker}</head>`);
  }
  return `${marker}${html}`;
}

function localWebrtcBootstrapScript() {
  const grantId = process.env.BOTSTER_LOCAL_WEBRTC_GRANT_ID;
  const grantSecret = process.env.BOTSTER_LOCAL_WEBRTC_GRANT_SECRET;
  const signalingTransport = process.env.BOTSTER_LOCAL_WEBRTC_SIGNALING_TRANSPORT;
  const expectedOrigin = process.env.BOTSTER_LOCAL_WEBRTC_EXPECTED_ORIGIN;
  if (!grantId || !grantSecret || signalingTransport !== "daemon_request" || !expectedOrigin) {
    return "";
  }

  return `window.__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__ = ${JSON.stringify({
    grant_id: grantId,
    grant_secret: grantSecret,
    package_name: "botster-web",
    entrypoint_id: "web-client",
    expected_origin: expectedOrigin,
    expires_at: 0,
    signaling_transport: signalingTransport,
    data_plane: "webrtc_data_channel",
    ordered: true,
    signaling_url: "/request"
  })};`;
}

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".wasm":
      return "application/wasm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
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

async function waitForSocket(path, exitStatus, label = "botster-hub") {
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
  throw lastError ?? new Error(`timed out waiting for ${label} socket`);
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
      request_id: "botster-web-package-server",
      operation,
      message
    }
  };
}
