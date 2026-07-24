import { createServer } from "node:http";
import { connect } from "node:net";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative, sep } from "node:path";
import { once } from "node:events";
import { decodeHubConnection, HubConnectionError } from "./hubConnection.mjs";

const protocol = "botster-hub-daemon-v1";
const signalingRequestTypes = new Set(["issue_local_webrtc_bootstrap", "local_webrtc_signal"]);
const host = "127.0.0.1";
const packageRoot = process.cwd();
const distRoot = join(packageRoot, "dist");
const indexPath = join(distRoot, "index.html");
const launchResultPath = process.env.BOTSTER_ENTRYPOINT_LAUNCH_RESULT;
let port;
try {
  port = configuredPort(process.env.BOTSTER_WEB_PACKAGE_SERVER_PORT);
} catch (error) {
  console.error(JSON.stringify({
    kind: "operator_error",
    error: {
      code: "invalid_package_server_port",
      operation: "configure_listener",
      message: error instanceof Error ? error.message : String(error)
    }
  }));
  process.exit(1);
}
let hubConnection;
try {
  hubConnection = decodeHubConnection(process.env.BOTSTER_HUB_CONNECTION);
} catch (error) {
  const diagnostic = error instanceof HubConnectionError
    ? { code: error.code, operation: "decode_hub_connection", message: error.message }
    : { code: "invalid_hub_connection", operation: "decode_hub_connection", message: String(error) };
  console.error(JSON.stringify({ kind: "operator_error", error: diagnostic }));
  process.exit(1);
}
const socketPath = hubConnection.transport.path;
try {
  await waitForSocket(socketPath);
} catch (error) {
  console.error(JSON.stringify({
    kind: "operator_error",
    error: {
      code: "hub_connection_unavailable",
      operation: "connect_hub",
      message: error instanceof Error ? error.message : String(error)
    }
  }));
  process.exit(1);
}

let localUrl;

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { ok: true, connection: "hub", transport: "unix_socket", local_url: localUrl });
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
    try {
      await serveStaticUi(request, response);
    } catch (error) {
      writeJson(response, 503, {
        error: "local_webrtc_bootstrap_unavailable",
        message: error instanceof Error ? error.message : "Local WebRTC bootstrap unavailable"
      });
    }
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

    const payload = await sendDaemonRequest(socketPath, envelope.payload);
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

server.once("error", (error) => {
  console.error(JSON.stringify({
    kind: "operator_error",
    error: {
      code: "package_server_listen_failed",
      operation: "listen",
      message: error instanceof Error ? error.message : String(error)
    }
  }));
  process.exitCode = 1;
});

server.listen(port, host, () => {
  localUrl = boundServerOrigin(server);
  void publishReadyLaunchResult(localUrl)
    .then(() => {
      console.log(`botster-web local package server listening at ${localUrl}/request`);
      console.log(`botster-web package UI available at ${localUrl}/`);
      console.log("hub connection: injected unix_socket descriptor");
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
    const body = isHtml
      ? await injectPackageRuntimeMarker(await readFile(filePath, "utf8"))
      : await readFile(filePath);
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
  response.end(await injectPackageRuntimeMarker(await readFile(indexPath, "utf8")));
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

async function injectPackageRuntimeMarker(html) {
  if (html.includes("__BOTSTER_PACKAGE_RUNTIME__")) {
    return html;
  }
  const bootstrap = await issueLocalWebrtcBootstrap();
  const marker = `<script>window.__BOTSTER_PACKAGE_RUNTIME__ = true;${localWebrtcBootstrapScript(bootstrap)}</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${marker}</head>`);
  }
  return `${marker}${html}`;
}

async function issueLocalWebrtcBootstrap() {
  if (!localUrl) {
    throw new Error("Package server origin is unavailable before listen readiness.");
  }

  const response = await sendDaemonRequest(socketPath, {
    type: "issue_local_webrtc_bootstrap",
    package_name: "botster-web",
    entrypoint_id: "web-client",
    origin: localUrl
  });
  const bootstrap = response?.local_webrtc_bootstrap;
  if (
    !bootstrap ||
    typeof bootstrap.grant_id !== "string" ||
    bootstrap.grant_id.length === 0 ||
    typeof bootstrap.grant_secret !== "string" ||
    bootstrap.grant_secret.length === 0 ||
    bootstrap.package_name !== "botster-web" ||
    bootstrap.entrypoint_id !== "web-client" ||
    bootstrap.expected_origin !== localUrl ||
    !Number.isFinite(bootstrap.expires_at) ||
    bootstrap.signaling_transport !== "daemon_request" ||
    bootstrap.data_plane !== "webrtc_data_channel" ||
    bootstrap.ordered !== true
  ) {
    throw new Error("Hub returned an invalid local WebRTC bootstrap grant.");
  }
  return bootstrap;
}

function localWebrtcBootstrapScript(bootstrap) {
  const serialized = JSON.stringify({
    ...bootstrap,
    signaling_url: "/request"
  }).replaceAll("<", "\\u003c");
  return `window.__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__ = ${serialized};`;
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

async function waitForSocket(path) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
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
  throw lastError ?? new Error("timed out waiting for injected hub socket");
}

function configuredPort(value) {
  if (value === undefined) return 0;
  if (!/^\d+$/.test(value)) throw new Error("BOTSTER_WEB_PACKAGE_SERVER_PORT must be an integer from 0 through 65535.");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error("BOTSTER_WEB_PACKAGE_SERVER_PORT must be an integer from 0 through 65535.");
  }
  return parsed;
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
