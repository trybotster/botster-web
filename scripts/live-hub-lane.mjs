/**
 * Live Hub lane: the functions a real-Hub smoke needs, moved from the live packaged
 * protocol harness. Nothing here reads harness module state; every binary path, working
 * directory, data directory, and process handle is a parameter. Importing this module reads
 * and transpiles vendored protocol metadata, but it starts no process or connection.
 */

import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import {
  metadata as hubTestSupportMetadata,
  readFirstPartyClientSupportMatrix
} from "@trybotster/hub-test-support";
import {
  candidateBinaryProvenance,
  candidateTargetDirectoryFromHubRealPath,
  HOST_CHROME,
  packageEnsureDecision
} from "./live-packaged-protocol-helpers.mjs";
import { sendDaemonUnixRequest } from "./daemon-unix-client.mjs";

const daemonProtocolModule = await (async () => {
  const source = readFileSync(new URL("../src/botster/generated/daemon-protocol.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
})();
const {
  MAX_UNIX_FRAME_BYTES,
  MAX_UNIX_TERMINAL_ROUTE_BYTES,
  PROTOCOL,
  UNIX_CONTAINER_CONTROL,
  UNIX_CONTAINER_TERMINAL,
  UNIX_FRAME_LENGTH_PREFIX_BYTES
} = daemonProtocolModule;

export const daemonProtocol = PROTOCOL;

/**
 * Verifies the candidate binaries against Hub's install-manifest.json (artifacts by name
 * with size and sha256, plus source_revisions). Returns the recorded revisions and the
 * verified artifacts; throws on any mismatch so a caller can refuse to launch anything.
 */
export function verifyCandidateManifest({ manifestPath, hubBin, workerBin }) {
  if (!manifestPath) throw new Error("candidate manifest verification requires manifestPath");
  if (!existsSync(manifestPath)) throw new Error(`candidate manifest does not exist: path=${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const sourceRevisions = manifest.source_revisions;
  if (!sourceRevisions || typeof sourceRevisions !== "object") {
    throw new Error("candidate manifest omits source_revisions");
  }
  for (const name of ["botster_hub", "botster_core"]) {
    if (typeof sourceRevisions[name] !== "string" || sourceRevisions[name].trim().length === 0) {
      throw new Error(`candidate manifest has invalid source_revisions.${name}`);
    }
  }
  const verified = [];
  for (const [name, path] of [["botster-hub", hubBin], ["botster-session-worker", workerBin]]) {
    const matches = artifacts.filter((candidate) => candidate?.name === name);
    if (matches.length !== 1) {
      throw new Error(`candidate manifest must contain exactly one ${name} artifact`);
    }
    const [artifact] = matches;
    if (!Number.isSafeInteger(artifact.size) || artifact.size < 1) {
      throw new Error(`candidate manifest has invalid size for artifact ${name}`);
    }
    if (typeof artifact.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
      throw new Error(`candidate manifest has invalid sha256 for artifact ${name}`);
    }
    if (!path || !existsSync(path)) throw new Error(`candidate binary does not exist: ${name} path=${String(path)}`);
    const size = statSync(path).size;
    const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (size !== artifact.size || sha256 !== artifact.sha256) {
      throw new Error(
        `candidate binary does not match the manifest: ${name} path=${path} size=${size} sha256=${sha256} manifest_size=${artifact.size} manifest_sha256=${artifact.sha256}`
      );
    }
    verified.push({ name, path, size, sha256 });
  }
  return { source_revisions: sourceRevisions, artifacts: verified };
}

/**
 * The agreed one-line failure record shared across layers: layer, step, session_id,
 * subscription_id, generation, stream_epoch, deadline_ms, elapsed_ms, last_kinds, cause.
 */
export function formatLaneFailure(fields) {
  const record = {
    layer: fields.layer ?? "web",
    step: fields.step ?? null,
    session_id: fields.session_id ?? null,
    subscription_id: fields.subscription_id ?? null,
    generation: fields.generation ?? null,
    stream_epoch: fields.stream_epoch ?? null,
    deadline_ms: fields.deadline_ms ?? null,
    elapsed_ms: fields.elapsed_ms ?? null,
    last_kinds: Array.isArray(fields.last_kinds) ? fields.last_kinds.slice(-16) : [],
    cause: fields.cause instanceof Error ? fields.cause.message : String(fields.cause ?? "")
  };
  return `lane-failure ${JSON.stringify(record)}`;
}

export async function sendDaemonRequest(socketPath, request) {
  return sendDaemonUnixRequest({
    socketPath,
    request,
    protocol: daemonProtocol,
    compatibilityRequirement: loadDaemonCompatibilityRequirement(),
    framing: {
      lengthPrefixBytes: UNIX_FRAME_LENGTH_PREFIX_BYTES,
      controlContainer: UNIX_CONTAINER_CONTROL,
      terminalContainer: UNIX_CONTAINER_TERMINAL,
      maxTerminalRouteBytes: MAX_UNIX_TERMINAL_ROUTE_BYTES,
      maxFrameBytes: MAX_UNIX_FRAME_BYTES
    }
  });
}

function loadDaemonCompatibilityRequirement() {
  const daemonSupportMatrix = readFirstPartyClientSupportMatrix();
  if (
    hubTestSupportMetadata.protocol !== daemonProtocol ||
    daemonSupportMatrix.protocol !== daemonProtocol ||
    daemonSupportMatrix.protocol_version !== hubTestSupportMetadata.protocol_version ||
    daemonSupportMatrix.conformance_fixture_revision !== hubTestSupportMetadata.conformance_fixture_revision ||
    !Array.isArray(daemonSupportMatrix.required_features) ||
    daemonSupportMatrix.required_features.some((feature) => typeof feature !== "string")
  ) {
    throw new Error("vendored Hub support metadata is inconsistent");
  }
  return {
    protocol: daemonProtocol,
    protocol_version: hubTestSupportMetadata.protocol_version,
    required_features: daemonSupportMatrix.required_features,
    minimum_conformance_fixture_revision: hubTestSupportMetadata.conformance_fixture_revision,
    client_name: "botster-web-live-harness"
  };
}

export async function waitForSocket(socketPath, exitMessage) {
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

export async function waitForHttpOk(url, exitMessage) {
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

export async function waitForHtmlShell(url) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes("<div id=\"root\"></div>") && body.includes("__BOTSTER_PACKAGE_RUNTIME__")) {
        return body;
      }
      lastError = new Error(`packaged UI shell was not served from ${url}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw lastError ?? new Error(`timed out waiting for packaged UI shell from ${url}`);
}

export async function waitForPackageAppUrl(socketPath) {
  const deadline = Date.now() + 15_000;
  let lastState = "missing";
  let lastApp;
  while (Date.now() < deadline) {
    const response = await sendDaemonRequest(socketPath, { type: "list_apps" });
    const app = response.apps?.find((candidate) => candidate.package_name === "botster-web" && candidate.entrypoint_id === "web-client");
    lastApp = app;
    if (app?.lifecycle_state) {
      lastState = app.lifecycle_state;
    }
    if (app?.launch_target?.local_url) {
      return app.launch_target.local_url;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `timed out waiting for botster-web/web-client local_url; lifecycle_state=${lastState}; app=${JSON.stringify(lastApp)}`
  );
}

export async function listPackages(socketPath) {
  const response = await sendDaemonRequest(socketPath, { type: "list_packages" });
  if (response.error || !Array.isArray(response.packages)) {
    throw new Error(`structured package list failed: ${JSON.stringify(response)}`);
  }
  return response.packages;
}

/**
 * Spawns one isolated Hub on `dataDir`. Every input is explicit: the binaries, the working
 * directory, the environment, and where stdout and stderr go besides this process's streams.
 */
export function spawnHubProcess(dataDir, { hubBin, workerBin, cwd, env = process.env, onStdout, onStderr }) {
  if (!hubBin) throw new Error("spawnHubProcess requires hubBin");
  const args = ["start", "--data-dir", dataDir];
  if (workerBin) {
    args.push("--session-worker-bin", workerBin);
  }

  const child = spawn(hubBin, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    onStdout?.(chunk);
    process.stdout.write(`[botster-hub] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    onStderr?.(chunk);
    process.stderr.write(`[botster-hub] ${chunk}`);
  });
  return child;
}

/** Runs one botster-hub CLI command to completion and returns its stdout. */
export async function runHubCommand(args, { hubBin, cwd }) {
  if (!hubBin) throw new Error("runHubCommand requires hubBin");
  const child = spawn(hubBin, args, {
    cwd,
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

/**
 * Asks the Hub to shut down through its CLI. A CLI failure is ignored when the Hub process
 * has already exited, because the shutdown then already happened.
 */
export async function requestDaemonShutdown({ hubBin, cwd, dataDir, hubProcess }) {
  await runHubCommand(["shutdown", "--data-dir", dataDir], { hubBin, cwd }).catch((error) => {
    if (hubProcess?.exitCode === null) {
      throw error;
    }
  });
}

/**
 * Installs and enables one package on the Hub at `dataDir` when needed, and returns the
 * decisions plus the final package list.
 */
export async function ensurePackageEnabled(packageName, packagePath, { dataDir, hubBin, cwd }) {
  const socketPath = join(dataDir, "botster-hub.sock");
  let packages = await listPackages(socketPath);
  const initialDecision = packageEnsureDecision(packages, packageName);
  console.log(`live package ensure ${JSON.stringify({ package_name: packageName, ...initialDecision })}`);

  if (initialDecision.install) {
    await runHubCommand(["packages", "install", "--data-dir", dataDir, "--path", packagePath], { hubBin, cwd });
    packages = await listPackages(socketPath);
  }

  const enableDecision = packageEnsureDecision(packages, packageName);
  if (enableDecision.enable) {
    await runHubCommand(["packages", "enable", "--data-dir", dataDir, packageName], { hubBin, cwd });
    packages = await listPackages(socketPath);
  }

  const finalDecision = packageEnsureDecision(packages, packageName);
  if (finalDecision.install || finalDecision.enable) {
    throw new Error(
      `package ensure did not reach enabled state for ${packageName}: ${JSON.stringify(finalDecision)}`
    );
  }
  return { initialDecision, finalDecision, packages };
}

/**
 * Provenance of the exact Hub and worker binaries: real paths, the Hub checkout revision
 * and cleanliness, the locked Core revision, and an optional build receipt.
 */
export async function loadBinaryProvenance({ hubBin, workerBin, buildReceiptPath }) {
  if (!hubBin) {
    throw new Error("WebRTC live packaged protocol harness requires BOTSTER_HUB_BIN so it can own an isolated hub.");
  }
  if (!workerBin) {
    throw new Error(
      "WebRTC live packaged protocol harness requires BOTSTER_SESSION_WORKER_BIN so readiness evidence identifies the exact worker binary."
    );
  }

  const suppliedHub = hubBin;
  const suppliedWorker = workerBin;
  if (!existsSync(suppliedHub)) {
    throw new Error(`botster-hub provenance binary does not exist: path=${suppliedHub}`);
  }
  if (!existsSync(suppliedWorker)) {
    throw new Error(`botster-session-worker provenance binary does not exist: path=${suppliedWorker}`);
  }

  const hubPath = realpathSync(suppliedHub);
  const workerPath = realpathSync(suppliedWorker);
  const targetDir = realpathSync(candidateTargetDirectoryFromHubRealPath(hubPath));
  const checkoutRoot = dirname(targetDir);
  const lockCoreRev = lockPackageRevision(join(checkoutRoot, "Cargo.lock"), "botster-core");
  return candidateBinaryProvenance({
    hubRealPath: hubPath,
    workerRealPath: workerPath,
    targetDirRealPath: targetDir,
    hubGitHead: gitHeadForCargoRoot(checkoutRoot),
    lockCoreRev,
    checkoutClean: gitCheckoutIsClean(checkoutRoot),
    buildReceipt: loadOptionalBuildReceipt(buildReceiptPath)
  });
}

function gitCheckoutIsClean(repoRoot) {
  try {
    const output = execFileSync("git", ["-C", repoRoot, "status", "--porcelain"], {
      encoding: "utf8"
    });
    return output.trim() === "";
  } catch {
    return false;
  }
}

function loadOptionalBuildReceipt(receiptPath) {
  if (!receiptPath) {
    return null;
  }
  if (!existsSync(receiptPath)) {
    throw new Error(`binary build receipt does not exist: path=${receiptPath}`);
  }
  return JSON.parse(readFileSync(receiptPath, "utf8"));
}

function lockPackageRevision(lockPath, packageName) {
  if (!existsSync(lockPath)) return null;
  const text = readFileSync(lockPath, "utf8");
  const pattern = new RegExp(
    `name = "${packageName}"[\\s\\S]*?source = "git\\+[^"]*[?&]rev=([0-9a-f]+)`,
    "m"
  );
  return text.match(pattern)?.[1] ?? null;
}

function gitHeadForCargoRoot(repoRoot) {
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8"
    }).trim();
  } catch {
    return null;
  }
}

export function installLiveHarnessPageHooks(targetPage, { boundedTerminalObserver = false } = {}) {
  return targetPage.addInitScript(({ bounded }) => {
    const createBoundedObserver = () => {
      const outstanding = new Map();
      const results = [];
      const pasteOutcomes = [];
      const markers = new Map();
      const lastKinds = [];
      const errors = [];
      const counts = new Map();
      let attachmentGeneration = null;
      let routeGeneration = null;
      let subscriptionId = null;
      let streamEpoch = null;
      let attachState = null;
      let modes = null;
      let latestResize = null;
      let processExit = null;
      let processExitSeen = false;
      let readySeen = false;
      let finishSeen = false;
      let abandonedOutstandingCount = 0;

      const remember = (list, value, limit) => {
        list.push(value);
        if (list.length > limit) list.splice(0, list.length - limit);
      };
      const fail = (message) => remember(errors, message, 16);
      const recordKind = (kind) => {
        remember(lastKinds, kind, 16);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      };
      const decodeBase64 = (encoded) => {
        const raw = globalThis.atob(encoded);
        return Uint8Array.from(raw, (char) => char.charCodeAt(0));
      };
      const containsBytes = (haystack, needle) => {
        if (needle.length === 0) return true;
        for (let start = 0; start + needle.length <= haystack.length; start += 1) {
          let matches = true;
          for (let index = 0; index < needle.length; index += 1) {
            if (haystack[start + index] !== needle[index]) {
              matches = false;
              break;
            }
          }
          if (matches) return true;
        }
        return false;
      };
      const feedMarkers = (source, encoded) => {
        if (typeof encoded !== "string") return;
        if (![...markers.values()].some((marker) => !marker.matched && marker.source === source)) return;
        const bytes = decodeBase64(encoded);
        for (const marker of markers.values()) {
          if (marker.matched || marker.source !== source) continue;
          const joined = new Uint8Array(marker.carry.length + bytes.length);
          joined.set(marker.carry);
          joined.set(bytes, marker.carry.length);
          if (containsBytes(joined, marker.needle)) marker.matched = true;
          const carryLength = Math.min(Math.max(0, marker.needle.length - 1), joined.length);
          marker.carry = joined.slice(joined.length - carryLength);
        }
      };
      const terminalPush = (...entries) => {
        for (const entry of entries) {
          const kind = String(entry?.kind ?? "unknown");
          const payload = entry?.payload ?? {};
          recordKind(kind);
          if (kind === "attach") {
            abandonedOutstandingCount = Math.min(
              Number.MAX_SAFE_INTEGER,
              abandonedOutstandingCount + outstanding.size
            );
            outstanding.clear();
            attachmentGeneration = payload.generation ?? attachmentGeneration;
            subscriptionId = payload.subscription_id ?? subscriptionId;
            routeGeneration = null;
            streamEpoch = null;
            attachState = null;
            readySeen = false;
            finishSeen = false;
            processExit = null;
            processExitSeen = false;
          } else if (kind === "attach_state") {
            attachState = payload.state ?? attachState;
            if (attachState === "attached" && streamEpoch === null) streamEpoch = 0;
          } else if (kind === "route_resync") {
            streamEpoch = payload.to_epoch ?? streamEpoch;
            readySeen = false;
            finishSeen = false;
          } else if (kind === "snapshot") {
            if (payload.phase === "ready") readySeen = true;
            if (payload.phase === "finish") finishSeen = true;
          } else if (kind === "modes") {
            modes = { ...payload };
          } else if (kind === "resize") {
            latestResize = { ...payload };
          } else if (kind === "process_exit") {
            processExit = payload.code ?? null;
            processExitSeen = true;
          } else if (kind === "input_sent") {
            const operationId = Number(payload.operation_id);
            if (!Number.isSafeInteger(operationId) || operationId < 1) {
              fail(`invalid sent operation id ${String(payload.operation_id)}`);
            } else if (outstanding.has(operationId)) {
              fail(`operation id ${operationId} was sent twice`);
            } else if (outstanding.size >= 32) {
              fail("more than 32 terminal operations are outstanding");
            } else {
              outstanding.set(operationId, payload.kind ?? null);
            }
          } else if (kind === "input_result") {
            const operationId = Number(payload.operation_id);
            if (!outstanding.has(operationId)) {
              fail(`unexpected or duplicate INPUT_RESULT for operation ${operationId}`);
            } else {
              const inputKind = outstanding.get(operationId);
              outstanding.delete(operationId);
              if (inputKind === "paste") {
                remember(results, { input_kind: inputKind, ...payload }, 32);
              }
            }
          } else if (kind === "input_result_unmatched") {
            fail(`product reported unmatched INPUT_RESULT for operation ${String(payload.operation_id)}`);
          } else if (kind === "paste_outcome") {
            remember(pasteOutcomes, { ...payload }, 32);
          } else if (kind === "output") {
            feedMarkers("output", payload.payload_bytes_base64);
          } else if (kind === "renderer_write") {
            feedMarkers("renderer", payload.payload_bytes_base64);
          }
        }
        return [...counts.values()].reduce((total, count) => total + count, 0);
      };
      const eventPush = (...entries) => {
        for (const entry of entries) {
          if (entry?.kind !== "terminal_route_frame") continue;
          const payload = entry.payload ?? {};
          routeGeneration = payload.generation ?? routeGeneration;
          streamEpoch = payload.stream_epoch ?? streamEpoch;
          const frameKind = payload.frame?.kind;
          if (frameKind === "snapshot_ready") readySeen = true;
          if (frameKind === "snapshot_finish") finishSeen = true;
        }
        return 0;
      };
      const api = {
        registerMarker(id, text, source = "output") {
          if (markers.size >= 16 && !markers.has(id)) throw new Error("more than 16 terminal markers are registered");
          const needle = new TextEncoder().encode(text);
          if (needle.length === 0) throw new Error("terminal marker text is empty");
          markers.set(id, { source, needle, carry: new Uint8Array(0), matched: false });
        },
        markerMatched(id) {
          return markers.get(id)?.matched === true;
        },
        removeMarker(id) {
          markers.delete(id);
        },
        takePasteOutcomes() {
          return pasteOutcomes.splice(0);
        },
        takeResults() {
          return results.splice(0);
        },
        snapshot() {
          return {
            subscription_id: subscriptionId,
            generation: routeGeneration ?? attachmentGeneration,
            stream_epoch: streamEpoch,
            attach_state: attachState,
            snapshot: { ready_seen: readySeen, finish_seen: finishSeen },
            process_exit: { seen: processExitSeen, code: processExit },
            modes,
            latest_resize: latestResize,
            outstanding_ids: [...outstanding.keys()],
            abandoned_outstanding_count: abandonedOutstandingCount,
            last_kinds: [...lastKinds],
            errors: [...errors],
            counts: Object.fromEntries(counts),
            paste_outcome_count: pasteOutcomes.length,
            result_count: results.length
          };
        }
      };
      return {
        api,
        events: { push: eventPush },
        terminal: { push: terminalPush }
      };
    };

    const boundedObserver = bounded ? createBoundedObserver() : null;
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
      events: boundedObserver?.events ?? [],
      terminal: boundedObserver?.terminal ?? [],
      ...(boundedObserver ? { boundedTerminalObserver: boundedObserver.api } : {})
    };
    globalThis.window.addEventListener("botster:webrtc-daemon-lifecycle", (event) => {
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events?.push({
        kind: "webrtc_lifecycle",
        payload: event.detail
      });
    });
  }, { bounded: boundedTerminalObserver });
}

export async function openDirectTerminalStream(page, sessionId, subscriptionId, cycle) {
  return page.evaluate(async ({ expectedSessionId, expectedSubscriptionId, cycleName }) => {
    const harness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
    const control = harness?.transportControl;
    if (!harness || !control?.streamTerminal) {
      throw new Error("live harness transport control does not expose terminal streaming");
    }
    harness.directTerminalEvents = [];
    const decode = harness.decodeTerminalBody;
    if (typeof decode !== "function") throw new Error("live harness decodeTerminalBody is unavailable");
    const stream = control.streamTerminal(expectedSessionId, expectedSubscriptionId, (event) => {
      if ("body" in event) {
        harness.directTerminalEvents.push({ ...decode(event.body), route: event.route, generation: event.generation, stream_epoch: event.streamEpoch });
      } else {
        harness.directTerminalEvents.push(event);
      }
    });
    harness.directTerminalStream = stream;
    await stream.ready;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (harness.directTerminalEvents.some((event) =>
        event?.kind === "attach_state" && event.state === "attached"
      )) {
        return {
          cycle: cycleName,
          label: stream.label,
          generation: stream.generation,
          peer_generation: stream.peerGeneration
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`direct terminal ${cycleName} attach did not reach attached state`);
  }, {
    expectedSessionId: sessionId,
    expectedSubscriptionId: subscriptionId,
    cycleName: cycle
  });
}

export async function readDirectTerminalModeFlags(page, sessionId) {
  const response = await page.evaluate(async ({ expectedSessionId }) => {
    const control = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl;
    if (!control?.request) throw new Error("live harness transport control is unavailable");
    return control.request({ type: "read_mode_flags", session_id: expectedSessionId });
  }, { expectedSessionId: sessionId });
  if (
    response.kind !== "read_mode_flags" ||
    typeof response.mode_flags?.bracketed_paste !== "boolean" ||
    !Number.isSafeInteger(response.mode_flags?.rows) ||
    !Number.isSafeInteger(response.mode_flags?.cols)
  ) {
    throw new Error(`direct terminal mode flags are invalid: ${JSON.stringify(response)}`);
  }
  return response.mode_flags;
}

export async function waitForDirectTerminalChannelClosed(page, label, subscriptionId) {
  await page.waitForFunction(
    ({ expectedLabel, expectedSubscriptionId }) => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      const localClose = events.some((entry) =>
        entry.kind === "terminal_data_channel" &&
        entry.payload?.state === "closed" &&
        entry.payload?.label === expectedLabel
      );
      const detachSent = events.some((entry) =>
        entry.kind === "daemon_request" &&
        entry.payload?.type === "detach" &&
        entry.payload?.subscription_id === expectedSubscriptionId
      );
      const adapterClosed = events.some((entry) =>
        entry.kind === "daemon_event" &&
        entry.payload?.type === "terminal_subscription_closed" &&
        entry.payload?.subscription_id === expectedSubscriptionId
      );
      return localClose || (detachSent && adapterClosed);
    },
    { expectedLabel: label, expectedSubscriptionId: subscriptionId },
    { timeout: 10_000 }
  );
}

export async function callTerminalControl(page, method, ...args) {
  await page.waitForFunction(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl));
  return page.evaluate(
    async ({ method: nextMethod, args: nextArgs }) =>
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl[nextMethod](...nextArgs),
    { method, args }
  );
}

export async function waitForTerminalCanvas(page) {
  await page.waitForFunction(
    ({ containerClass }) => {
      const canvas = globalThis.document.querySelector(`.${containerClass} canvas`);
      if (canvas?.tagName !== "CANVAS") return false;
      const bounds = canvas.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    },
    { containerClass: HOST_CHROME.terminalContainerClass },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for mounted Restty canvas: ${error.message}`);
  });
}

export async function focusMountedTerminal(page) {
  await waitForTerminalCanvas(page);
  await callTerminalControl(page, "focus");
  await page.locator(`.${HOST_CHROME.terminalContainerClass} canvas`).first().click();
  await page.waitForFunction(
    () => globalThis.document.activeElement instanceof globalThis.HTMLTextAreaElement,
    undefined,
    { timeout: 5_000 }
  ).catch((error) => {
    throw new Error(`mounted terminal did not focus the Restty textarea: ${error.message}`);
  });
}

export async function typeThroughMountedTerminal(page, data) {
  await focusMountedTerminal(page);
  await page.keyboard.type(data, { delay: 10 });
}

export async function dispatchMountedPaste(page, text) {
  await focusMountedTerminal(page);
  return page.evaluate((data) => {
    const target = globalThis.document.activeElement;
    if (!(target instanceof globalThis.HTMLTextAreaElement)) {
      throw new Error("mounted paste requires the Restty textarea focus");
    }
    const transfer = new globalThis.DataTransfer();
    transfer.setData("text/plain", data);
    const event = new globalThis.ClipboardEvent("paste", {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true
    });
    target.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented };
  }, text);
}

export async function openHomeView(page) {
  await page
    .getByLabel(HOST_CHROME.workbenchNavLabel)
    .getByRole("button", { name: HOST_CHROME.homeNavButtonName, exact: true })
    .click();
  await page.getByTestId(HOST_CHROME.dashboardTestId).waitFor();
}

export async function openSessionTerminal(page, sessionId) {
  const sessionRow = page.getByTestId(HOST_CHROME.dashboardTestId).locator("ion-item").filter({
    has: page.getByText(sessionId, { exact: true })
  });
  await sessionRow.click();
  await page.getByTestId(HOST_CHROME.terminalSessionViewTestId).waitFor();
}

export async function waitForTerminalAttachState(page, states) {
  const expectedStates = Array.isArray(states) ? states : [states];
  await page.waitForFunction(
    ({ nextStates, statusClass, attachStateAttr }) => {
      const status = globalThis.document.querySelector(`.${statusClass}`)?.getAttribute(attachStateAttr);
      return nextStates.includes(status);
    },
    {
      nextStates: expectedStates,
      statusClass: HOST_CHROME.terminalStatusClass,
      attachStateAttr: HOST_CHROME.terminalAttachStateAttr
    },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal attach state ${expectedStates.join(" or ")}: ${error.message}`);
  });
}

export async function waitForTerminalSession(page, sessionId) {
  await page.waitForFunction(
    ({ expectedSessionId, containerClass, sessionIdAttr }) =>
      globalThis.document.querySelector(`.${containerClass}`)?.getAttribute(sessionIdAttr) === expectedSessionId,
    {
      expectedSessionId: sessionId,
      containerClass: HOST_CHROME.terminalContainerClass,
      sessionIdAttr: HOST_CHROME.terminalSessionIdAttr
    },
    { timeout: 15_000 }
  ).catch((error) => {
    throw new Error(`timed out waiting for terminal session ${sessionId}: ${error.message}`);
  });
}

export async function waitForRenderedTerminalText(page, text, timeout = 30_000) {
  await page.waitForFunction(
    ({ containerClass, expectedText }) => {
      const root = globalThis.document.querySelector(`.${containerClass}`);
      const cellReadout = root?.querySelector("pre.pane-term-debug")?.textContent ?? "";
      return cellReadout.includes(expectedText);
    },
    { containerClass: HOST_CHROME.terminalContainerClass, expectedText: text },
    { timeout }
  ).catch((error) => {
    throw new Error(`rendered terminal cells omitted ${JSON.stringify(text)}: ${error.message}`);
  });
}

export async function readBoundedTerminalObserver(page) {
  const state = await page.evaluate(() =>
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver?.snapshot?.() ?? null
  );
  if (!state) throw new Error("bounded terminal observer is unavailable");
  if (state.errors.length > 0) {
    throw new Error(`bounded terminal observer failed: ${state.errors.join("; ")}`);
  }
  return state;
}

export async function registerTerminalMarker(page, id, text, source = "output") {
  await page.evaluate(
    ({ markerId, markerText, markerSource }) => {
      const observer = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver;
      if (!observer?.registerMarker) throw new Error("bounded terminal observer is unavailable");
      observer.registerMarker(markerId, markerText, markerSource);
    },
    { markerId: id, markerText: text, markerSource: source }
  );
}

export async function waitForTerminalMarker(page, id, timeout = 30_000) {
  await page.waitForFunction(
    ({ markerId }) =>
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver?.markerMatched?.(markerId) === true,
    { markerId: id },
    { timeout }
  ).finally(async () => {
    await page.evaluate(({ markerId }) => {
      globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver?.removeMarker?.(markerId);
    }, { markerId: id }).catch(() => undefined);
  });
}

export async function takePasteOutcomes(page) {
  return page.evaluate(() =>
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver?.takePasteOutcomes?.() ?? []
  );
}

export async function takeTerminalResults(page) {
  return page.evaluate(() =>
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.boundedTerminalObserver?.takeResults?.() ?? []
  );
}
