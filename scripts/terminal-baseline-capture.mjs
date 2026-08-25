import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { cpus, freemem, hostname, totalmem, type as osType, release as osRelease } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  candidateBinaryProvenance,
  candidateTargetDirectoryFromHubRealPath,
  HOST_CHROME,
  LOCKED_HUB_BUILD_COMMAND,
  LOCKED_SESSION_WORKER_BUILD_COMMAND,
  packageEnsureDecision
} from "./live-packaged-protocol-helpers.mjs";
import {
  ARM_IDS,
  CONTROL_OPERATIONS,
  FAMILY_CONTRACTS,
  FORMAT_VERSION,
  FROZEN_INPUTS,
  OBSERVATION_FAMILIES,
  PAINT_ORACLE,
  PINNED_REVISIONS,
  PRODUCT_BASELINE_STATEMENT,
  CONTROL_RESPONSE_TOLERANCE,
  INBOUND_BYTE_UNIT,
  countInboundControlBytes,
  equalizeControlResponses,
  wireRequestTypesForArm,
  assertValidObservationRecord,
  negotiateCaptureClock,
  notApplicableFamily,
  parseDispatcherLogLine,
  recordIsPublishableBaseline,
  statisticSet,
  validateObservationRecord
} from "./terminal-baseline-observation-format.mjs";
import {
  appendCostSamples,
  baselineObserverInitScript,
  calibrateWatcherDetection,
  createLogWatcher,
  dispatcherStartCommand,
  fileExists,
  fixtureRoot,
  handshakeCommand,
  hashFiles,
  parseWarmupLog,
  probeLine,
  readHandshakeFile,
  readLastEnterStamp,
  startScreencastOracle,
  substituteDispatcherSource,
  sustainedFrames,
  transformStable,
  uniqueMarker,
  waitForHashChange,
  waitForHashSettle,
  workspacePathHasColon
} from "./terminal-baseline-observer.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAEMON_PROTOCOL = "botster-hub-daemon-v1";
export const CONTROLLED_RUNNER_PROFILE = Object.freeze({
  label: "botster-ubuntu-24.04-16core",
  os: "Linux",
  distro_id: "ubuntu",
  distro_version_id: "24.04",
  arch: "x64",
  logical_cpu_count: 16
});
const PACKAGE_EVENT_BURST_ACTION = Object.freeze({
  package_name: "package-notice-reaction",
  request: Object.freeze({
    request_id: "terminal-baseline-package-burst",
    surface_id: "package-notice-reaction.events",
    action_id: "package-notice-reaction.emit_burst",
    node_id: "package-notice-reaction-emit-burst",
    kind: "submit",
    payload: Object.freeze({ count: FROZEN_INPUTS.package_event_burst_count })
  })
});
const RESTTY_RUNTIME_FILES = Object.freeze([
  "src/vendor/restty/internal.js",
  "src/vendor/restty/chunk-3mc71e83.js",
  "src/vendor/restty/restty.js",
  "src/vendor/restty/xterm.js"
]);

function usage() {
  return [
    "Usage:",
    "  node scripts/terminal-baseline-capture.mjs",
    "  node scripts/terminal-baseline-capture.mjs --validate <record.json>",
    "",
    "Required env for a two-arm capture:",
    "  BOTSTER_LEGACY_CHECKOUT  clean trybotster checkout at f598075e",
    "  BOTSTER_HUB_SOURCE       read-only botster-hub checkout used only as a clone source"
  ].join("\n");
}

function execFile(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr, code });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed (code=${code}, signal=${signal ?? "none"}):\n${stdout}${stderr}`));
    });
  });
}

async function git(repo, args) {
  return execFile("git", ["-C", repo, ...args]);
}

async function inspectCheckout(repo) {
  const head = (await git(repo, ["rev-parse", "HEAD"])).stdout.trim();
  const porcelain = (await git(repo, ["status", "--porcelain"])).stdout;
  return {
    path: realpathSync(repo),
    head,
    porcelain,
    clean: porcelain.trim() === ""
  };
}

function assertCheckoutUnchanged(before, after, label) {
  if (before.head !== after.head || before.porcelain !== after.porcelain) {
    throw new Error(`${label} checkout changed during capture`);
  }
}

export async function collectResttyProvenance(armId, checkoutPath) {
  if (armId === "modular") {
    const files = RESTTY_RUNTIME_FILES.map((relative) => join(checkoutPath, relative));
    for (const file of files) {
      if (!existsSync(file)) {
        throw new Error(`modular Restty file is missing: ${file}`);
      }
    }
    const artifactSha256 = {};
    const hashed = await hashFiles(files);
    RESTTY_RUNTIME_FILES.forEach((relative, index) => {
      artifactSha256[relative] = hashed[files[index]];
    });
    return {
      declared_revision: PINNED_REVISIONS.modular_restty,
      declaration_source: PINNED_REVISIONS.modular_restty_declaration_source,
      artifact_sha256: artifactSha256,
      ghostty_pin: {
        commit: PINNED_REVISIONS.modular_ghostty
      }
    };
  }
  const vendorJs = join(checkoutPath, "app/frontend/vendor/chunk-02afddvq.js");
  if (!existsSync(vendorJs)) {
    throw new Error("legacy Restty vendor file is missing");
  }
  return {
    declared_revision: PINNED_REVISIONS.legacy_restty,
    declaration_source: PINNED_REVISIONS.legacy_restty_declaration_source,
    artifact_sha256: {
      "app/frontend/vendor/chunk-02afddvq.js": (await hashFiles([vendorJs]))[vendorJs]
    },
    ghostty_pin: null,
    ghostty_pin_reason: "legacy f598075e declares no Ghostty pin"
  };
}

export async function buildScratchHub(hubSource) {
  const source = await inspectCheckout(hubSource);
  const scratch = await mkdtemp(join(process.env.TMPDIR || "/tmp", "botster-baseline-hub."));
  if (workspacePathHasColon(scratch)) {
    throw new Error(`scratch Hub path contains a colon: ${scratch}`);
  }
  await execFile("git", ["clone", "--quiet", "--no-checkout", "--shared", hubSource, scratch]);
  await git(scratch, ["checkout", "--quiet", PINNED_REVISIONS.modular_hub]);
  const scratchState = await inspectCheckout(scratch);
  if (!scratchState.clean) {
    throw new Error("scratch Hub checkout is not clean");
  }
  if (scratchState.head !== PINNED_REVISIONS.modular_hub) {
    throw new Error(`scratch Hub HEAD ${scratchState.head} is not the pinned modular revision`);
  }
  const lock = await readFile(join(scratch, "Cargo.lock"), "utf8");
  if (!lock.includes(PINNED_REVISIONS.modular_core)) {
    throw new Error("scratch Hub Cargo.lock does not contain the pinned Core revision");
  }
  await execFile("cargo", ["build", "--locked", "--bin", "botster-hub"], { cwd: scratch });
  await execFile("cargo", ["build", "--locked", "-p", "botster-core-daemon", "--bin", "botster-session-worker"], {
    cwd: scratch
  });
  const hubBin = realpathSync(join(scratch, "target/debug/botster-hub"));
  const workerBin = realpathSync(join(scratch, "target/debug/botster-session-worker"));
  const provenance = candidateBinaryProvenance({
    hubRealPath: hubBin,
    workerRealPath: workerBin,
    targetDirRealPath: realpathSync(candidateTargetDirectoryFromHubRealPath(hubBin)),
    hubGitHead: scratchState.head,
    lockCoreRev: PINNED_REVISIONS.modular_core,
    checkoutClean: true
  });
  return {
    source,
    scratch,
    hubBin,
    workerBin,
    provenance,
    lock_contains_core: lock.includes(PINNED_REVISIONS.modular_core)
  };
}

function hostRecord(profile) {
  const cpu = cpus()[0];
  return {
    os: profile.os,
    kernel: osRelease(),
    cpu_model: cpu?.model ?? "unknown",
    logical_cpu_count: profile.logical_cpu_count,
    memory_bytes: totalmem(),
    runner_label: profile.label,
    distro_id: profile.distro_id,
    distro_version_id: profile.distro_version_id,
    arch: profile.arch,
    hostname_hash: createHash("sha256").update(hostname()).digest("hex").slice(0, 16),
    free_memory_bytes_at_start: freemem()
  };
}

export function readOsRelease(text) {
  const fields = {};
  for (const line of String(text).split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    fields[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return fields;
}

export function inspectHostProfile(overrides = {}) {
  const osReleaseText = overrides.osReleaseText
    ?? (existsSync("/etc/os-release") ? readFileSync("/etc/os-release", "utf8") : "");
  const fields = readOsRelease(osReleaseText);
  return {
    label: overrides.label ?? process.env.BOTSTER_BASELINE_RUNNER_LABEL ?? "local",
    os: overrides.os ?? osType(),
    arch: overrides.arch ?? process.arch,
    logical_cpu_count: overrides.logical_cpu_count ?? cpus().length,
    distro_id: overrides.distro_id ?? fields.ID ?? null,
    distro_version_id: overrides.distro_version_id ?? fields.VERSION_ID ?? null
  };
}

export function admitControlledHost(profile) {
  const errors = [];
  const expected = CONTROLLED_RUNNER_PROFILE;
  if (profile.label !== expected.label) errors.push("label");
  if (profile.os !== expected.os) errors.push("os");
  if (profile.distro_id !== expected.distro_id) errors.push("distro_id");
  if (profile.distro_version_id !== expected.distro_version_id) errors.push("distro_version_id");
  if (profile.arch !== expected.arch) errors.push("arch");
  if (profile.logical_cpu_count !== expected.logical_cpu_count) errors.push("logical_cpu_count");
  return {
    ok: errors.length === 0,
    errors,
    publication_class: errors.length === 0 ? "controlled" : "ineligible"
  };
}

export function admitRunner(profile) {
  if (profile.label === "local") {
    return {
      ok: true,
      publication_class: "local",
      errors: [],
      blocked: [{
        family: "controlled_runner",
        reason: "botster-ubuntu-24.04-16core is unregistered; repository runner list is empty"
      }]
    };
  }
  if (profile.label !== CONTROLLED_RUNNER_PROFILE.label) {
    return {
      ok: false,
      publication_class: "ineligible",
      errors: [`unknown runner label ${profile.label}`],
      blocked: []
    };
  }
  const admission = admitControlledHost(profile);
  return {
    ...admission,
    blocked: []
  };
}

export function assertCounterGrew(before, after, family) {
  if (!Number.isFinite(after) || after <= before) {
    throw new Error(`${family}: workload did not grow during the sample`);
  }
}

export function inboundGrew(before, after) {
  const beforeFrames = Number(before?.frames ?? before?.count ?? before?.bytes ?? 0);
  const afterFrames = Number(after?.frames ?? after?.count ?? after?.bytes ?? 0);
  const beforeBytes = Number(before?.bytes ?? 0);
  const afterBytes = Number(after?.bytes ?? 0);
  return afterFrames > beforeFrames || afterBytes > beforeBytes;
}

export function assertPreKeyProgress(before, atKey, family) {
  if (!inboundGrew(before, atKey)) {
    throw new Error(`${family}: no inbound progress before t_key`);
  }
}

export async function waitForProgress(observe, before, family, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await observe();
    const frameGrew = Number(snapshot?.frames ?? snapshot?.count ?? snapshot?.bytes ?? 0)
      > Number(before?.frames ?? before?.count ?? before?.bytes ?? 0);
    const byteGrew = Number(snapshot?.bytes ?? 0) > Number(before?.bytes ?? 0);
    if (frameGrew || byteGrew) {
      if (snapshot.frames != null) {
        assertCounterGrew(Number(before.frames ?? 0), Number(snapshot.frames), family);
      } else if (snapshot.count != null) {
        assertCounterGrew(Number(before.count ?? 0), Number(snapshot.count), family);
      } else {
        assertCounterGrew(Number(before.bytes ?? 0), Number(snapshot.bytes), family);
      }
      return snapshot;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`${family}: no inbound progress during the measured interval`);
}

export function createControlResponseBurst({
  issueRequest,
  observeInbound,
  names = FROZEN_INPUTS.control_request_names,
  requestCount = FROZEN_INPUTS.control_request_count
}) {
  const sequence = [];
  while (sequence.length < requestCount) {
    sequence.push(names[sequence.length % names.length]);
  }
  const stats = {
    active: false,
    produced_count: 0,
    requests: 0,
    responses: 0,
    response_bytes: 0,
    inbound_frame_count: 0,
    inbound_bytes: 0,
    issued: 0,
    in_flight: false,
    last_at: 0
  };
  if (typeof observeInbound !== "function") {
    throw new Error("control_response_saturation: observeInbound is required");
  }
  return {
    stats,
    names,
    async start() {
      stats.active = true;
      return stats;
    },
    async aroundProbe({ sendProbe, measured, progressTimeoutMs = 5_000 }) {
      if (typeof sendProbe !== "function") {
        throw new Error("control_response_saturation: sendProbe is required");
      }
      if (!measured) {
        return sendProbe();
      }
      if (stats.in_flight) {
        throw new Error("control_response_saturation: overlapping request callback");
      }
      if (stats.issued >= requestCount) {
        throw new Error("control_response_saturation: frozen request count already issued");
      }
      stats.in_flight = true;
      try {
        const name = sequence[stats.issued];
        const before = await observeInbound();
        const prePending = Promise.resolve().then(() => issueRequest(name));
        await Promise.all([
          waitForProgress(observeInbound, before, "control_response_saturation", progressTimeoutMs),
          prePending
        ]);
        const tKey = await sendProbe();
        const atKey = await observeInbound();
        assertPreKeyProgress(before, atKey, "control_response_saturation");
        const postPending = Promise.resolve().then(() => issueRequest(name));
        const progress = Promise.all([
          waitForProgress(observeInbound, atKey, "control_response_saturation", progressTimeoutMs),
          postPending
        ]).then(([after]) => {
          const frameDelta = after.frames - atKey.frames;
          const byteDelta = after.bytes - atKey.bytes;
          stats.issued += 1;
          stats.requests += 2;
          stats.responses += frameDelta;
          stats.produced_count += frameDelta;
          stats.response_bytes += byteDelta;
          stats.inbound_frame_count += frameDelta;
          stats.inbound_bytes += byteDelta;
          stats.last_at = Date.now();
          return after;
        }).finally(() => {
          stats.in_flight = false;
        });
        return { ...tKey, progress };
      } catch (error) {
        stats.in_flight = false;
        throw error;
      }
    },
    async stop() {
      stats.active = false;
    },
    metrics(elapsedMs) {
      const seconds = Math.max(elapsedMs / 1000, 0.001);
      return {
        request_names: names,
        request_rate: stats.requests / seconds,
        response_rate: stats.responses / seconds,
        response_bytes: stats.response_bytes,
        inbound_frame_count: stats.inbound_frame_count,
        inbound_bytes: stats.inbound_bytes,
        inbound_byte_unit: INBOUND_BYTE_UNIT,
        issued: stats.issued,
        tolerance: CONTROL_RESPONSE_TOLERANCE
      };
    }
  };
}

export function createPackageEventBurst({
  emitBurst,
  observeDelivery,
  count = FROZEN_INPUTS.package_event_burst_count,
  measuredRepetitions = FROZEN_INPUTS.measured_repetitions
}) {
  const perSample = count / measuredRepetitions;
  const stats = {
    active: false,
    produced_count: 0,
    burst_count: count,
    completed: false
  };
  if (typeof observeDelivery !== "function") {
    throw new Error("package_event_saturation: observeDelivery is required");
  }
  return {
    stats,
    async start() {
      stats.active = true;
      return stats;
    },
    async aroundProbe({ sendProbe, measured, progressTimeoutMs = 5_000 }) {
      if (typeof sendProbe !== "function") {
        throw new Error("package_event_saturation: sendProbe is required");
      }
      if (!measured) {
        return sendProbe();
      }
      if (stats.completed || stats.produced_count >= count) {
        throw new Error("package_event_saturation: burst already completed before the sample");
      }
      const half = perSample / 2;
      const before = await observeDelivery();
      const prePending = Promise.resolve().then(() => emitBurst(half));
      await Promise.all([
        waitForProgress(observeDelivery, before, "package_event_saturation", progressTimeoutMs),
        prePending
      ]);
      const tKey = await sendProbe();
      const atKey = await observeDelivery();
      assertPreKeyProgress(before, atKey, "package_event_saturation");
      const postPending = Promise.resolve().then(() => emitBurst(half));
      const progress = Promise.all([
        waitForProgress(observeDelivery, atKey, "package_event_saturation", progressTimeoutMs),
        postPending
      ]).then(([after]) => {
        stats.produced_count += Number(after.count ?? after.frames ?? 0) - Number(before.count ?? before.frames ?? 0);
        if (stats.produced_count >= count) {
          stats.completed = true;
        }
        return after;
      });
      return { ...tKey, progress };
    },
    async stop() {
      stats.active = false;
    }
  };
}

export function createSiblingFloodHandle({
  floodSessionId,
  probeSessionId,
  floodBytes = FROZEN_INPUTS.sibling_flood_bytes,
  observe
}) {
  const stats = {
    active: false,
    produced_count: 0,
    floodSessionId,
    probeSessionId,
    flood_bytes: floodBytes,
    terminal_a_subscribed: false
  };
  return {
    stats,
    async start() {
      if (!floodSessionId || !probeSessionId || floodBytes !== FROZEN_INPUTS.sibling_flood_bytes) {
        throw new Error("sibling_saturation: flood producer is not configured");
      }
      if (typeof observe !== "function") {
        throw new Error("sibling_saturation: observe callback is required");
      }
      stats.active = true;
      return stats;
    },
    async aroundProbe({ sendProbe, measured, progressTimeoutMs = 5_000 }) {
      if (typeof sendProbe !== "function") {
        throw new Error("sibling_saturation: sendProbe is required");
      }
      if (!measured) {
        return sendProbe();
      }
      const subscribed = await observe();
      if (!subscribed?.terminal_a_subscribed) {
        throw new Error("sibling_saturation: terminal A is not subscribed");
      }
      const readBytes = async () => {
        const next = await observe();
        if (!next?.terminal_a_subscribed) {
          throw new Error("sibling_saturation: terminal A is not subscribed");
        }
        return {
          bytes: Number(next.delivered_bytes ?? next.bytes ?? 0),
          count: Number(next.delivered_bytes ?? next.bytes ?? 0)
        };
      };
      const before = await readBytes();
      if (typeof subscribed.restartFlood === "function") {
        void subscribed.restartFlood();
      }
      await waitForProgress(readBytes, before, "sibling_saturation", progressTimeoutMs);
      const tKey = await sendProbe();
      const atKey = await readBytes();
      assertPreKeyProgress(before, atKey, "sibling_saturation");
      if (typeof subscribed.restartFlood === "function") {
        void subscribed.restartFlood();
      }
      const progress = waitForProgress(readBytes, atKey, "sibling_saturation", progressTimeoutMs).then((after) => {
        stats.terminal_a_subscribed = true;
        stats.produced_count = after.bytes;
        return after;
      });
      return { ...tKey, progress };
    },
    async stop() {
      stats.active = false;
    }
  };
}

export async function restoreProbeSession(page, arm, options = {}) {
  const reopen = options.reopen ?? defaultReopenProbe;
  if (typeof reopen !== "function") {
    throw new Error("saturation reopen is missing");
  }
  const probeSessionId = arm.probeSessionId;
  if (!probeSessionId) {
    throw new Error("probe session id is missing");
  }
  const mounted = await reopen(page, arm, probeSessionId);
  if (mounted !== probeSessionId) {
    throw new Error(`saturation probe is on ${mounted}, not ${probeSessionId}`);
  }
  return mounted;
}

async function defaultReopenProbe(page, arm, probeSessionId) {
  await goHome(page);
  await openSession(page, probeSessionId);
  await page.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
  return readMountedSessionId(page);
}

export function processGroupGone(pgid) {
  if (!pgid) return true;
  try {
    process.kill(-pgid, 0);
    return false;
  } catch {
    return pidGone(pgid);
  }
}

export function proveOwnedProcessesGone(arm) {
  const pids = [arm?.child?.pid, arm?.web?.pid].filter(Boolean);
  const livePids = pids.filter((pid) => !pidGone(pid));
  const liveGroups = pids.filter((pid) => !processGroupGone(pid));
  const socketGone = arm?.socketPath ? existsSync(arm.socketPath) === false : true;
  return {
    ok: livePids.length === 0 && liveGroups.length === 0 && socketGone,
    live_pids: livePids,
    live_groups: liveGroups,
    socket_gone: socketGone
  };
}

export { equalizeControlResponses, countInboundControlBytes, INBOUND_BYTE_UNIT };

export function publicationDecision({ record, teardownProof }) {
  if (!teardownProof?.ok) {
    return { publish: false, reason: "teardown_unproven" };
  }
  const validation = validateObservationRecord(record);
  if (!validation.ok) {
    return { publish: false, reason: "invalid_record", errors: validation.errors };
  }
  if (!recordIsPublishableBaseline(record)) {
    return { publish: false, reason: "not_publishable_baseline" };
  }
  return { publish: true };
}

export async function writeBaselineRecord(outputPath, record, teardownProof) {
  const decision = publicationDecision({ record, teardownProof });
  if (!decision.publish) {
    throw new Error(`refusing to publish baseline: ${decision.reason}`);
  }
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
  return outputPath;
}

async function sendDaemonRequest(socketPath, request) {
  const { createConnection } = await import("node:net");
  const socket = createConnection(socketPath);
  await once(socket, "connect");
  socket.setEncoding("utf8");
  socket.write(`${JSON.stringify({ protocol: DAEMON_PROTOCOL })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== DAEMON_PROTOCOL) {
    socket.end();
    throw new Error("daemon hello protocol mismatch");
  }
  socket.write(`${JSON.stringify(request)}\n`);
  const reply = JSON.parse(await readSocketLine(socket));
  socket.end();
  return reply;
}

function readSocketLine(socket) {
  return new Promise((resolvePromise, reject) => {
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
        resolvePromise(buffer.slice(0, newline));
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

async function waitForPath(path, timeoutMs, exitMessage) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    const extra = exitMessage?.();
    if (extra) throw new Error(extra);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`timed out waiting for ${path}`);
}

function signalProcessTree(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

async function stopProcess(child, budgetMs = FROZEN_INPUTS.teardown_budget_ms) {
  if (!child?.pid) {
    return { teardown: "absent", pid: null, process_group_gone: true };
  }
  const pid = child.pid;
  signalProcessTree(pid, "SIGTERM");
  const finished = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolvePromise) => setTimeout(() => resolvePromise(false), budgetMs))
  ]);
  if (finished && processGroupGone(pid)) {
    return { teardown: "stopped", pid, process_group_gone: true };
  }
  signalProcessTree(pid, "SIGKILL");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolvePromise) => setTimeout(resolvePromise, FROZEN_INPUTS.teardown_escalate_ms))
  ]);
  return {
    teardown: "escalated",
    pid,
    process_group_gone: processGroupGone(pid)
  };
}

function pidGone(pid) {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

async function materializeDispatcher(ptyClock, logPath) {
  const fixtures = fixtureRoot(packageRoot);
  const sourceName = ptyClock === "shell_epochrealtime" ? "seed-shell-clock.bash" : "seed-posix.sh";
  const source = await readFile(join(fixtures, sourceName), "utf8");
  const workDir = await mkdtemp(join(process.env.TMPDIR || "/tmp", "botster-baseline-seed."));
  const seedPath = join(workDir, sourceName);
  await writeFile(seedPath, substituteDispatcherSource(source, logPath));
  return { workDir, seedPath };
}

async function typeLine(page, text) {
  await page.locator(".terminal-view-container canvas").first().click({ position: { x: 10, y: 10 } });
  await page.keyboard.type(text, { delay: 10 });
}

async function typeEnter(page) {
  await page.keyboard.press("Enter");
}

async function waitForPaintMarker(page, marker, timeoutMs = 10_000) {
  await page.waitForFunction(
    ({ expected }) => globalThis.document.body?.innerText?.includes(expected) === true,
    { expected: `${FROZEN_INPUTS.paint_prefix}${marker}` },
    { timeout: timeoutMs }
  ).catch(() => null);
}

async function measureTerminalBox(page) {
  const box = await page.locator(".terminal-view-container canvas").first().boundingBox();
  if (!box) {
    throw new Error("terminal bounding box is unavailable");
  }
  return box;
}

async function startModularArm({ captureId, hubBuild, restty }) {
  const dataDir = await mkdtemp(join(process.env.TMPDIR || "/tmp", "botster-baseline-modular."));
  const env = {
    ...process.env,
    BOTSTER_HUB_BIN: hubBuild.hubBin,
    BOTSTER_SESSION_WORKER_BIN: hubBuild.workerBin
  };
  const child = spawn(hubBuild.hubBin, ["start", "--data-dir", dataDir, "--session-worker-bin", hubBuild.workerBin], {
    cwd: packageRoot,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const socketPath = join(dataDir, "botster-hub.sock");
  await waitForPath(socketPath, 20_000, () =>
    child.exitCode != null ? `modular Hub exited before socket readiness (code=${child.exitCode})` : undefined
  );
  await execFile(hubBuild.hubBin, ["packages", "install", "--data-dir", dataDir, "--path", packageRoot], { env });
  await execFile(hubBuild.hubBin, ["packages", "enable", "--data-dir", dataDir, "botster-web"], { env });
  const packageEventsPath = join(packageRoot, "fixtures/package-notice-reaction");
  await execFile(hubBuild.hubBin, ["packages", "install", "--data-dir", dataDir, "--path", packageEventsPath], { env });
  await execFile(hubBuild.hubBin, ["packages", "enable", "--data-dir", dataDir, "package-notice-reaction"], { env });
  const packages = (await sendDaemonRequest(socketPath, { type: "list_packages" })).packages ?? [];
  const webDecision = packageEnsureDecision(packages, "botster-web");
  if (webDecision.install || webDecision.enable) {
    throw new Error(`modular botster-web was not enabled: ${JSON.stringify(webDecision)}`);
  }
  await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  const deadline = Date.now() + 20_000;
  let appUrl;
  while (Date.now() < deadline) {
    const apps = await sendDaemonRequest(socketPath, { type: "list_apps" });
    appUrl = apps.apps?.find((app) => app.package_name === "botster-web")?.launch_target?.local_url;
    if (appUrl) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  if (!appUrl) {
    throw new Error("modular arm never published a local_url");
  }
  return {
    arm_id: "modular",
    dataDir,
    socketPath,
    child,
    workerPid: null,
    appUrl,
    env,
    restty,
    captureId,
    sessionIds: [],
    launch_command: `${hubBuild.hubBin} start --data-dir <isolated> --session-worker-bin ${hubBuild.workerBin}`
  };
}

async function startLegacyArm({ captureId, checkout, restty }) {
  const dataDir = await mkdtemp(join(process.env.TMPDIR || "/tmp", "botster-baseline-legacy."));
  const child = spawn("mise", ["r", "run_hub_debug"], {
    cwd: checkout.path,
    env: { ...process.env, BOTSTER_BASELINE_CAPTURE: "1" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const web = spawn("bin/dev", [], {
    cwd: checkout.path,
    env: { ...process.env, BOTSTER_BASELINE_CAPTURE: "1" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const appUrl = process.env.BOTSTER_LEGACY_URL ?? "http://127.0.0.1:3000";
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appUrl, { redirect: "manual" });
      if (response.status > 0) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  if (!ready) {
    await stopProcess(child);
    await stopProcess(web);
    throw new Error("legacy arm did not become reachable at BOTSTER_LEGACY_URL");
  }
  return {
    arm_id: "legacy",
    dataDir,
    socketPath: null,
    child,
    web,
    appUrl,
    restty,
    captureId,
    sessionIds: [],
    launch_command: "mise r run_hub_debug + bin/dev"
  };
}

async function openArmPage(browser, arm) {
  const context = await browser.newContext({
    viewport: {
      width: FROZEN_INPUTS.viewport.width,
      height: FROZEN_INPUTS.viewport.height
    },
    deviceScaleFactor: FROZEN_INPUTS.viewport.device_scale_factor
  });
  const page = await context.newPage();
  await page.addInitScript(baselineObserverInitScript());
  await page.goto(arm.appUrl, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function spawnOrdinaryShell(arm, sessionId) {
  if (arm.arm_id === "modular") {
    const response = await sendDaemonRequest(arm.socketPath, {
      type: "spawn",
      session_id: sessionId,
      command: "sh"
    });
    if (response.error) {
      throw new Error(`modular spawn failed: ${JSON.stringify(response.error)}`);
    }
    arm.sessionIds.push(sessionId);
    return sessionId;
  }
  throw new Error("legacy spawn uses the browser session-type name, not a command line");
}

async function openSession(page, sessionId) {
  const dashboard = page.getByTestId(HOST_CHROME.dashboardTestId);
  await dashboard.waitFor({ timeout: 30_000 });
  const row = dashboard.getByText(sessionId, { exact: true });
  await row.waitFor({ timeout: 30_000 });
  await row.click();
  await page.getByTestId(HOST_CHROME.terminalSessionViewTestId).waitFor({ timeout: 30_000 });
}

async function goHome(page) {
  await page.getByLabel(HOST_CHROME.workbenchNavLabel).getByRole("button", { name: HOST_CHROME.homeNavButtonName, exact: true }).click().catch(() => null);
  await page.getByTestId(HOST_CHROME.dashboardTestId).waitFor({ timeout: 30_000 }).catch(() => null);
}

async function readMountedSessionId(page) {
  const id = await page.locator(`[${HOST_CHROME.terminalSessionIdAttr}]`).first().getAttribute(HOST_CHROME.terminalSessionIdAttr);
  if (!id) {
    throw new Error("mounted terminal has no session id");
  }
  return id;
}

async function completeLegacyNewSession(page) {
  const button = page.getByTestId("new-session-button");
  const signIn = page.getByRole("link", { name: "Sign in with GitHub", exact: true });
  const appeared = await Promise.race([
    button.waitFor({ timeout: 30_000 }).then(() => "new-session"),
    signIn.waitFor({ timeout: 30_000 }).then(() => "github-sign-in")
  ]).catch(() => "missing");
  if (appeared === "github-sign-in") {
    throw new Error(
      `legacy arm requires a signed-in GitHub session before new-session-button; url=${page.url()}`
    );
  }
  if (appeared !== "new-session") {
    throw new Error(
      `legacy remount: new-session-button is not available; url=${page.url()}`
    );
  }
  await button.click();
  const start = page.getByRole("button", { name: HOST_CHROME.newSessionSubmitName, exact: true });
  if (await start.count() > 0) {
    await start.first().click();
  }
  await page.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
  return readMountedSessionId(page);
}

export async function remountForPaintFamily(page, arm, options = {}) {
  const remount = options.remountAction ?? defaultRemountAction;
  if (typeof remount !== "function") {
    throw new Error(`${arm.arm_id} remount: remount action is missing`);
  }
  const result = await remount(page, arm, options);
  if (!result?.didRemount) {
    throw new Error(`${arm.arm_id} remount: action did not remount a session`);
  }
  return result;
}

async function defaultRemountAction(page, arm, options = {}) {
  if (arm.arm_id === "modular") {
    return remountModularSession(page, arm, options);
  }
  return remountLegacySession(page, arm, options);
}

async function remountModularSession(page, arm, options = {}) {
  if (!arm.socketPath) {
    throw new Error("modular remount: daemon socket is missing");
  }
  const previousId = arm.sessionIds.at(-1);
  if (previousId && previousId !== arm.probeSessionId) {
    await sendDaemonRequest(arm.socketPath, { type: "shutdown_session", session_id: previousId }).catch(() => null);
    await sendDaemonRequest(arm.socketPath, { type: "remove_session", session_id: previousId }).catch(() => null);
  }
  const sessionId = `${arm.captureId}-modular-${options.seedHistory ? "history" : "attach"}-${Date.now()}`;
  const command = options.seedHistory
    ? `sh ${join(fixtureRoot(packageRoot), "history-seed.sh")}`
    : "sh";
  const response = await sendDaemonRequest(arm.socketPath, {
    type: "spawn",
    session_id: sessionId,
    command
  });
  if (response.error) {
    throw new Error(`modular remount spawn failed: ${JSON.stringify(response.error)}`);
  }
  arm.sessionIds.push(sessionId);
  const previousHash = page.__baselineOracle?.frames.at(-1)?.hash;
  const at = Date.now();
  await goHome(page);
  await openSession(page, sessionId);
  await page.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
  return { at, previousHash, didRemount: true, sessionId };
}

async function remountLegacySession(page, arm, options = {}) {
  if (options.seedHistory) {
    const seededId = await completeLegacyNewSession(page);
    arm.sessionIds.push(seededId);
    await typeLine(page, `sh ${join(fixtureRoot(packageRoot), "history-seed.sh")}`);
    await typeEnter(page);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    await goHome(page);
    const previousHash = page.__baselineOracle?.frames.at(-1)?.hash;
    const at = Date.now();
    await openSession(page, seededId);
    await page.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
    return { at, previousHash, didRemount: true, sessionId: seededId };
  }
  const previousHash = page.__baselineOracle?.frames.at(-1)?.hash;
  const at = Date.now();
  const sessionId = await completeLegacyNewSession(page);
  arm.sessionIds.push(sessionId);
  return { at, previousHash, didRemount: true, sessionId };
}

export async function waitForBrowserControl(page, armId) {
  await page.waitForFunction((id) => {
    if (id === "modular") {
      return typeof globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.request === "function";
    }
    return Object.keys(globalThis._botsterTestTerminal ?? {}).length > 0;
  }, armId, { timeout: 30_000 });
  if (armId === "legacy") {
    await installLegacyInboundObserver(page);
  }
}

export async function installLegacyInboundObserver(page) {
  await page.evaluate(() => {
    const entry = Object.values(globalThis._botsterTestTerminal ?? {})[0];
    const transport = entry?.transport;
    if (!transport || transport.__baselineInboundWrapped) {
      return;
    }
    globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__ = globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__ ?? [];
    globalThis.__BOTSTER_BASELINE_TERMINAL_INBOUND__ = globalThis.__BOTSTER_BASELINE_TERMINAL_INBOUND__ ?? [];
    const original = transport.handleMessage?.bind(transport);
    if (typeof original !== "function") {
      throw new Error("legacy transport handleMessage is not available");
    }
    transport.handleMessage = (message) => {
      if (message?.type === "raw_output" && message.data?.length > 0) {
        const prefix = message.data[0];
        const payload = Array.from(message.data);
        if (prefix === 0x02) {
          globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__.push({ type: "snapshot", payload, at: Date.now() });
        } else if (prefix === 0x01) {
          globalThis.__BOTSTER_BASELINE_TERMINAL_INBOUND__.push({ type: "pty", payload, at: Date.now() });
        }
      } else if (message?.type && message.type !== "raw_output") {
        globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__.push({
          type: message.type,
          payload: message,
          at: Date.now()
        });
      }
      return original(message);
    };
    transport.__baselineInboundWrapped = true;
  });
}

export async function observeControlInbound(page, arm) {
  if (arm.arm_id === "modular") {
    const frames = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events.filter((entry) =>
        entry.kind === "webrtc_response_assembly"
        && (entry.payload?.request_type === "resize" || entry.payload?.request_type === "read_screen")
      ).length;
    });
    const bytes = (arm.inboundDecodedPayloads ?? []).reduce(
      (sum, payload) => sum + countInboundControlBytes(payload),
      0
    );
    return { frames, bytes, unit: INBOUND_BYTE_UNIT };
  }
  const raw = await page.evaluate(() => globalThis.__BOTSTER_BASELINE_CONTROL_INBOUND__ ?? []);
  return {
    frames: raw.length,
    bytes: raw.reduce((sum, entry) => sum + countInboundControlBytes(entry.payload), 0),
    unit: INBOUND_BYTE_UNIT
  };
}

export async function observePackageDelivery(page) {
  return page.evaluate(() => {
    const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
    const notices = events.filter((entry) =>
      entry.kind === "daemon_event"
      && (entry.payload?.type === "package_event" || entry.payload?.name === "sample.notice")
    );
    return {
      count: notices.length,
      frames: notices.length,
      bytes: notices.reduce((sum, entry) => sum + JSON.stringify(entry.payload ?? {}).length, 0)
    };
  });
}

export async function observeSiblingDelivery(page, armId) {
  if (armId === "modular") {
    const payloads = await page.evaluate(() => {
      const events = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? [];
      return events
        .filter((entry) => entry.kind === "daemon_terminal_event")
        .map((entry) => entry.payload);
    });
    const bytes = payloads.reduce((sum, payload) => sum + countInboundControlBytes(payload), 0);
    return { delivered_bytes: bytes, bytes, frames: payloads.length };
  }
  const raw = await page.evaluate(() => globalThis.__BOTSTER_BASELINE_TERMINAL_INBOUND__ ?? []);
  const bytes = raw.reduce((sum, entry) => sum + countInboundControlBytes(entry.payload), 0);
  return { delivered_bytes: bytes, bytes, frames: raw.length };
}

export async function issueControlRequest(arm, semanticName) {
  const spec = CONTROL_OPERATIONS[semanticName];
  if (!spec) {
    throw new Error(`unknown control operation ${semanticName}`);
  }
  if (!arm.page) {
    throw new Error("browser page is required for control requests");
  }
  const wireType = arm.arm_id === "modular" ? spec.modular_wire : spec.legacy_wire;
  await waitForBrowserControl(arm.page, arm.arm_id);
  const reply = await arm.page.evaluate(async ({ armId, wireType: nextType, sessionId, rows, cols }) => {
    if (armId === "modular") {
      const request = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl?.request;
      if (typeof request !== "function") {
        throw new Error("modular browser control connection is not available");
      }
      const payload = nextType === "resize"
        ? { type: "resize", session_id: sessionId, rows, cols }
        : { type: "read_screen", session_id: sessionId };
      return request(payload);
    }
    const entry = Object.values(globalThis._botsterTestTerminal ?? {})[0];
    const transport = entry?.transport;
    if (!transport) {
      throw new Error("legacy browser terminal connection is not available");
    }
    if (nextType === "resize" && typeof transport.sendResize === "function") {
      return transport.sendResize(cols, rows);
    }
    if (nextType === "request_snapshot" && typeof transport.requestSnapshot === "function") {
      return transport.requestSnapshot({ rows, cols });
    }
    throw new Error(`legacy cannot issue ${nextType}`);
  }, {
    armId: arm.arm_id,
    wireType,
    sessionId: arm.probeSessionId,
    rows: FROZEN_INPUTS.terminal_geometry.rows,
    cols: FROZEN_INPUTS.terminal_geometry.cols
  });
  arm.inboundDecodedPayloads = arm.inboundDecodedPayloads ?? [];
  if (reply != null) {
    arm.inboundDecodedPayloads.push(reply);
  }
  return {
    semantic: semanticName,
    wire_type: wireType,
    reply
  };
}

async function startSiblingFlood(page, arm) {
  const floodScript = join(fixtureRoot(packageRoot), "sibling-flood.sh");
  const probeSessionId = arm.probeSessionId ?? arm.sessionIds[0];
  if (!probeSessionId) {
    throw new Error("sibling_saturation: probe terminal B is missing");
  }
  let floodSessionId;
  if (arm.arm_id === "modular") {
    floodSessionId = `${arm.captureId}-modular-flood-${Date.now()}`;
    const response = await sendDaemonRequest(arm.socketPath, {
      type: "spawn",
      session_id: floodSessionId,
      command: "sh"
    });
    if (response.error) {
      throw new Error(`sibling flood spawn failed: ${JSON.stringify(response.error)}`);
    }
    arm.sessionIds.push(floodSessionId);
  } else {
    floodSessionId = await completeLegacyNewSession(page);
    arm.sessionIds.push(floodSessionId);
  }
  if (!arm.context) {
    throw new Error("sibling_saturation: a second mounted page is required for terminal A");
  }
  const floodPage = await arm.context.newPage();
  await floodPage.addInitScript(baselineObserverInitScript());
  await floodPage.goto(arm.appUrl, { waitUntil: "domcontentloaded" });
  await openSession(floodPage, floodSessionId);
  await floodPage.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
  await typeLine(floodPage, `sh ${floodScript}`);
  await typeEnter(floodPage);
  if (arm.arm_id === "legacy") {
    await installLegacyInboundObserver(floodPage);
  }
  const handle = createSiblingFloodHandle({
    floodSessionId,
    probeSessionId,
    observe: async () => ({
      terminal_a_subscribed: (await readMountedSessionId(floodPage)) === floodSessionId,
      ...(await observeSiblingDelivery(floodPage, arm.arm_id)),
      restartFlood: async () => {
        await typeLine(floodPage, `sh ${floodScript}`);
        await typeEnter(floodPage);
      }
    })
  });
  await handle.start();
  return handle;
}

export async function emitPackageEventBurst(arm, count = FROZEN_INPUTS.package_event_burst_count) {
  if (arm.arm_id !== "modular") {
    throw new Error("package_event_saturation is modular-only");
  }
  const response = await sendDaemonRequest(arm.socketPath, {
    type: "plugin_surface_action",
    package_name: PACKAGE_EVENT_BURST_ACTION.package_name,
    request: {
      ...PACKAGE_EVENT_BURST_ACTION.request,
      payload: { count }
    }
  });
  if (response.error) {
    throw new Error(`package-event burst failed: ${JSON.stringify(response.error)}`);
  }
  return count;
}

async function armLocalSemantics(page, armId) {
  if (armId !== "modular") {
    return null;
  }
  return page.evaluate(() => {
    const terminal = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminal ?? [];
    return {
      attach: terminal.filter((entry) => entry.kind === "attach").length,
      ghostsnp_ready: terminal.some((entry) =>
        entry.kind === "ghostsnp_install" && String(entry.payload?.phase ?? "").toLowerCase() === "ready"
      ),
      ghostsnp_finish: terminal.some((entry) =>
        entry.kind === "ghostsnp_install" && String(entry.payload?.phase ?? "").toLowerCase() === "finish"
      )
    };
  });
}

async function runHandshake(page, handshakePath) {
  const hostDateNow = Date.now();
  await typeLine(page, handshakeCommand(handshakePath));
  await typeEnter(page);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await fileExists(handshakePath)) {
      const result = await readHandshakeFile(handshakePath, hostDateNow);
      return result;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  return readHandshakeFile(handshakePath, hostDateNow);
}

async function startDispatcher(page, ptyClock, seedPath) {
  await typeLine(page, dispatcherStartCommand(ptyClock, seedPath));
  await typeEnter(page);
}

async function sendProbe(page, marker) {
  await waitForHashSettle(page.__baselineOracle, FROZEN_INPUTS.settle_window_ms).catch(() => null);
  await typeLine(page, probeLine(marker));
  await typeEnter(page);
  return readLastEnterStamp(page);
}

function familyStats(samples, name) {
  const contract = FAMILY_CONTRACTS[name];
  return {
    endpoint_start: contract.endpoint_start,
    endpoint_end: contract.endpoint_end,
    oracle: contract.oracle,
    unit: "ms",
    warmup_discarded: FROZEN_INPUTS.warmup_repetitions,
    ...statisticSet(samples)
  };
}

export async function captureKeyToPty({ page, arm, ptyClock, logWatcher, family, repetitions, aroundProbe }) {
  const samples = [];
  const ptyToPaint = [];
  const keyToPaint = [];
  const discardedNegative = false;
  for (let index = 0; index < FROZEN_INPUTS.warmup_repetitions + repetitions; index += 1) {
    const measured = index >= FROZEN_INPUTS.warmup_repetitions;
    if (arm.probeSessionId && ["control_response_saturation", "package_event_saturation", "sibling_saturation"].includes(family)) {
      const mounted = await readMountedSessionId(page);
      if (mounted !== arm.probeSessionId) {
        throw new Error(`${family}: mounted session ${mounted} is not probe session ${arm.probeSessionId}`);
      }
    }
    const marker = uniqueMarker(arm.captureId, arm.arm_id, family, index);
    const previousHash = page.__baselineOracle.frames.at(-1)?.hash;
    const send = () => sendProbe(page, marker);
    const tKey = typeof aroundProbe === "function"
      ? await aroundProbe({ index, family, measured, sendProbe: send })
      : await send();
    const logWait = logWatcher.waitForLine((line) => {
      const parsed = parseDispatcherLogLine(line, ptyClock);
      return parsed.ok && parsed.marker === marker && parsed.post !== true;
    });
    const [logEntry] = await Promise.all([
      logWait,
      Promise.resolve(tKey?.progress)
    ]);
    const parsed = parseDispatcherLogLine(logEntry.line, ptyClock);
    const tPty = ptyClock === "shell_epochrealtime" ? parsed.t_pty_ms : logEntry.at;
    const paint = await waitForHashChange(page.__baselineOracle, previousHash).catch(() => null);
    if (index < FROZEN_INPUTS.warmup_repetitions) {
      continue;
    }
    if (!tKey?.at) {
      throw new Error(`${family}: missing t_key`);
    }
    if (tPty < tKey.at) {
      throw new Error(`${family}: t_pty preceded t_key`);
    }
    if (paint && paint.at < tKey.at) {
      throw new Error(`${family}: paint change preceded t_key`);
    }
    samples.push(tPty - tKey.at);
    if (paint) {
      ptyToPaint.push(paint.at - tPty);
      keyToPaint.push(paint.at - tKey.at);
    }
  }
  return {
    ...familyStats(samples, family),
    decomposition_valid: ptyClock === "shell_epochrealtime",
    discarded_negative_pty_to_paint: discardedNegative,
    pty_to_paint_ms: statisticSet(ptyToPaint),
    key_to_paint_ms: statisticSet(keyToPaint)
  };
}

async function capturePaintWindow({ page, name, startFactory, repetitions }) {
  const samples = [];
  for (let index = 0; index < FROZEN_INPUTS.warmup_repetitions + repetitions; index += 1) {
    const started = await startFactory(page, index);
    const first = await waitForHashChange(page.__baselineOracle, started.previousHash);
    const settled = name === "attach_ready" ? first : await waitForHashSettle(page.__baselineOracle);
    if (first.at < started.at) {
      throw new Error(`${name}: paint-ready preceded attach start`);
    }
    if (settled.at < first.at) {
      throw new Error(`${name}: paint-settled preceded paint-ready`);
    }
    if (index < FROZEN_INPUTS.warmup_repetitions) {
      continue;
    }
    samples.push((name === "attach_ready" ? first.at : settled.at) - (name === "history_finish" ? first.at : started.at));
  }
  return familyStats(samples, name);
}

async function proveWarmup(page, arm, ptyClock, logPath) {
  const marker = uniqueMarker(arm.captureId, arm.arm_id, "warmup", 0);
  const previousHash = page.__baselineOracle.frames.at(-1)?.hash;
  const warmupStarted = Date.now();
  await sendProbe(page, marker);
  const text = await readFile(logPath, "utf8");
  const log = parseWarmupLog(text, ptyClock, marker);
  if (!log.ok) {
    return { pty: log, paint: { ok: false, reason: "warmup_blocked_by_log" } };
  }
  const paint = await waitForHashChange(page.__baselineOracle, previousHash)
    .then(async (frame) => {
      await waitForPaintMarker(page, marker);
      return { ok: true, frame, sustained: sustainedFrames(page.__baselineOracle.frames, warmupStarted, Date.now()) };
    })
    .catch(() => ({ ok: false, reason: "warmup_paint_missing" }));
  return { pty: log, paint };
}

async function runArmFamilies({ page, arm, ptyClock, logPath, logWatcher }) {
  const blocked = [];
  const observations = {};
  const warmup = await proveWarmup(page, arm, ptyClock, logPath);
  if (!warmup.pty.ok) {
    for (const name of OBSERVATION_FAMILIES.filter((family) => FAMILY_CONTRACTS[family].oracle === "pty")) {
      observations[name] = { status: "blocked", reason: warmup.pty.reason };
      blocked.push({ family: name, arm_id: arm.arm_id, reason: warmup.pty.reason });
    }
  }
  if (!warmup.paint.ok) {
    for (const name of OBSERVATION_FAMILIES.filter((family) => FAMILY_CONTRACTS[family].oracle === "paint")) {
      observations[name] = { status: "blocked", reason: warmup.paint.reason };
      blocked.push({ family: name, arm_id: arm.arm_id, reason: warmup.paint.reason });
    }
  }
  if (warmup.pty.ok && observations.key_to_pty == null) {
    observations.key_to_pty = await captureKeyToPty({
      page,
      arm,
      ptyClock,
      logWatcher,
      family: "key_to_pty",
      repetitions: FROZEN_INPUTS.measured_repetitions
    });
  }
  if (warmup.paint.ok) {
    observations.attach_ready = await capturePaintWindow({
      page,
      name: "attach_ready",
      repetitions: FROZEN_INPUTS.measured_repetitions,
      startFactory: async () => remountForPaintFamily(page, arm)
    });
    observations.history_finish = {
      ...(await capturePaintWindow({
        page,
        name: "history_finish",
        repetitions: FROZEN_INPUTS.measured_repetitions,
        startFactory: async () => remountForPaintFamily(page, arm)
      })),
      arm_local_semantics: await armLocalSemantics(page, arm.arm_id)
    };
    observations.scrollback = await capturePaintWindow({
      page,
      name: "scrollback",
      repetitions: FROZEN_INPUTS.measured_repetitions,
      startFactory: async () => {
        const previousHash = page.__baselineOracle.frames.at(-1)?.hash;
        const at = Date.now();
        const box = await measureTerminalBox(page);
        for (let index = 0; index < FROZEN_INPUTS.scroll_event_count; index += 1) {
          await page.mouse.wheel(0, FROZEN_INPUTS.scroll_delta_y);
          await page.mouse.move(box.x + 8, box.y + 8);
          await new Promise((resolvePromise) => setTimeout(resolvePromise, FROZEN_INPUTS.scroll_pacing_ms));
        }
        return { at, previousHash };
      }
    });
    observations.large_history = await capturePaintWindow({
      page,
      name: "large_history",
      repetitions: FROZEN_INPUTS.measured_repetitions,
      startFactory: async () => remountForPaintFamily(page, arm, { seedHistory: true })
    });
    await restoreProbeSession(page, arm);
  }
  if (observations.control_response_saturation == null && warmup.pty.ok) {
    if (warmup.paint.ok) {
      await restoreProbeSession(page, arm);
    }
    const burst = createControlResponseBurst({
      issueRequest: (name) => issueControlRequest(arm, name),
      observeInbound: () => observeControlInbound(arm.page, arm)
    });
    const started = Date.now();
    await burst.start();
    try {
      observations.control_response_saturation = await captureKeyToPty({
        page,
        arm,
        ptyClock,
        logWatcher,
        family: "control_response_saturation",
        repetitions: FROZEN_INPUTS.measured_repetitions,
        aroundProbe: (args) => burst.aroundProbe(args)
      });
      Object.assign(observations.control_response_saturation, burst.metrics(Date.now() - started), {
        producer: "browser_control_connection",
        wire_request_types: wireRequestTypesForArm(arm.arm_id)
      });
    } finally {
      await burst.stop();
    }
  }
  if (arm.arm_id === "legacy") {
    observations.package_event_saturation = notApplicableFamily(
      "legacy f598075e has no harness-drivable package-event plane"
    );
  } else if (warmup.pty.ok) {
    if (warmup.paint.ok) {
      await restoreProbeSession(page, arm);
    }
    const burst = createPackageEventBurst({
      emitBurst: (count) => emitPackageEventBurst(arm, count),
      observeDelivery: () => observePackageDelivery(arm.page)
    });
    await burst.start();
    try {
      observations.package_event_saturation = await captureKeyToPty({
        page,
        arm,
        ptyClock,
        logWatcher,
        family: "package_event_saturation",
        repetitions: FROZEN_INPUTS.measured_repetitions,
        aroundProbe: (args) => burst.aroundProbe(args)
      });
      observations.package_event_saturation.burst_count = FROZEN_INPUTS.package_event_burst_count;
    } finally {
      await burst.stop();
    }
  }
  if (warmup.pty.ok && observations.sibling_saturation == null) {
    if (warmup.paint.ok) {
      await restoreProbeSession(page, arm);
    }
    const flood = await startSiblingFlood(page, arm);
    await restoreProbeSession(page, arm);
    try {
      observations.sibling_saturation = await captureKeyToPty({
        page,
        arm,
        ptyClock,
        logWatcher,
        family: "sibling_saturation",
        repetitions: FROZEN_INPUTS.measured_repetitions,
        aroundProbe: (args) => flood.aroundProbe(args)
      });
      observations.sibling_saturation.flood_bytes = FROZEN_INPUTS.sibling_flood_bytes;
      observations.sibling_saturation.terminal_a = flood.stats.floodSessionId;
      observations.sibling_saturation.terminal_b = flood.stats.probeSessionId;
    } finally {
      await flood.stop();
    }
  }
  return { observations, blocked, warmup };
}

async function teardownArm(arm) {
  const results = [];
  if (arm.socketPath) {
    for (const sessionId of arm.sessionIds) {
      await sendDaemonRequest(arm.socketPath, { type: "shutdown_session", session_id: sessionId }).catch(() => null);
    }
  }
  if (arm.oracle) {
    await arm.oracle.stop();
  }
  if (arm.context) {
    await arm.context.close();
  }
  results.push(await stopProcess(arm.child));
  if (arm.web) {
    results.push(await stopProcess(arm.web));
  }
  const proof = proveOwnedProcessesGone(arm);
  if (arm.dataDir) {
    await rm(arm.dataDir, { recursive: true, force: true });
  }
  return {
    results,
    hub_pid_gone: !arm.child?.pid || pidGone(arm.child.pid),
    web_pid_gone: !arm.web?.pid || pidGone(arm.web.pid),
    process_groups_gone: proof.live_groups.length === 0,
    socket_gone: proof.socket_gone,
    proof,
    teardown: results.some((entry) => entry.teardown === "escalated") ? "escalated" : "stopped"
  };
}

function emptyFamily(name, reason) {
  return { status: "blocked", reason };
}

function blockedRecordSkeleton(reason) {
  const observations = {};
  for (const armId of ARM_IDS) {
    observations[armId] = Object.fromEntries(
      OBSERVATION_FAMILIES.map((name) => [name, emptyFamily(name, reason)])
    );
  }
  return observations;
}

async function validateMode(recordPath) {
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  const result = validateObservationRecord(record);
  if (!result.ok) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`valid ${record.capture_id} format_version=${record.format_version}\n`);
}

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const validateIndex = argv.indexOf("--validate");
  if (validateIndex >= 0) {
    const recordPath = argv[validateIndex + 1];
    if (!recordPath) {
      throw new Error("--validate requires a record path");
    }
    await validateMode(recordPath);
    return;
  }

  const captureId = `termbase-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${randomUUID().slice(0, 8)}`;
  const legacyCheckout = process.env.BOTSTER_LEGACY_CHECKOUT;
  const hubSource = process.env.BOTSTER_HUB_SOURCE;
  const blocked = [];
  let ptyClock = "host_watcher";
  const hostProfile = inspectHostProfile();
  const runnerAdmission = admitRunner(hostProfile);
  if (!runnerAdmission.ok) {
    throw new Error(`runner admission failed: ${runnerAdmission.errors.join(", ")}`);
  }
  blocked.push(...runnerAdmission.blocked);
  const host = hostRecord(hostProfile);

  if (!legacyCheckout || !hubSource) {
    throw new Error(`two-arm capture requires BOTSTER_LEGACY_CHECKOUT and BOTSTER_HUB_SOURCE\n${usage()}`);
  }
  const legacyBefore = await inspectCheckout(legacyCheckout);
  const hubBefore = await inspectCheckout(hubSource);
  if (legacyBefore.head !== PINNED_REVISIONS.legacy_monorepo || !legacyBefore.clean) {
    throw new Error(
      `legacy checkout must be clean at ${PINNED_REVISIONS.legacy_monorepo}; ` +
      `observed head=${legacyBefore.head} clean=${legacyBefore.clean}`
    );
  }

  const modularRestty = await collectResttyProvenance("modular", packageRoot);
  const legacyRestty = await collectResttyProvenance("legacy", legacyCheckout);
  const hubBuild = await buildScratchHub(hubSource);
  let browser;
  const arms = {
    legacy: null,
    modular: null
  };
  const observations = blockedRecordSkeleton("arm_not_started");
  const correctness = { legacy: {}, modular: {} };
  let candidate = null;
  try {
    browser = await chromium.launch();
    const browserVersion = browser.version();
    const handshakeResults = {};
    for (const armId of ARM_IDS) {
      const arm = armId === "modular"
        ? await startModularArm({ captureId, hubBuild, restty: modularRestty })
        : await startLegacyArm({ captureId, checkout: legacyBefore, restty: legacyRestty });
      const opened = await openArmPage(browser, arm);
      arm.context = opened.context;
      arm.page = opened.page;
      if (armId === "modular") {
        const sessionId = `${captureId}-modular-shell`;
        await spawnOrdinaryShell(arm, sessionId);
        await openSession(opened.page, sessionId);
        arm.probeSessionId = sessionId;
      } else {
        const sessionId = await completeLegacyNewSession(opened.page);
        arm.sessionIds.push(sessionId);
        arm.probeSessionId = sessionId;
      }
      await opened.page.locator(".terminal-view-container canvas").first().waitFor({ timeout: 30_000 });
      await waitForBrowserControl(opened.page, armId);
      arm.terminal_bounding_box = await measureTerminalBox(opened.page);
      const handshakePath = join(arm.dataDir, "handshake.txt");
      handshakeResults[armId] = await runHandshake(opened.page, handshakePath);
      arms[armId] = arm;
    }
    ptyClock = negotiateCaptureClock(handshakeResults.legacy, handshakeResults.modular);
    for (const armId of ARM_IDS) {
      const arm = arms[armId];
      const logPath = join(arm.dataDir, "baseline.log");
      const dispatcher = await materializeDispatcher(ptyClock, logPath);
      arm.logPath = logPath;
      await startDispatcher(arm.page, ptyClock, dispatcher.seedPath);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      const readyText = await readFile(logPath, "utf8").catch(() => "");
      void readyText;
      const readyVisible = await arm.page.waitForFunction(
        ({ token }) => globalThis.document.body?.innerText?.includes(token) === true,
        { token: FROZEN_INPUTS.ready_token },
        { timeout: 10_000 }
      ).then(() => true).catch(() => false);
      if (!readyVisible) {
        blocked.push({ family: "dispatcher_ready", arm_id: armId, reason: "dispatcher_ready_missing" });
      }
      const oracle = await startScreencastOracle(arm.page, arm.terminal_bounding_box);
      arm.oracle = oracle;
      arm.page.__baselineOracle = oracle;
      const watcher = await createLogWatcher(logPath);
      arm.logWatcher = watcher;
      const watcherCal = ptyClock === "host_watcher"
        ? await calibrateWatcherDetection(join(arm.dataDir, "watcher-cal.log"))
        : null;
      const familyResult = await runArmFamilies({
        page: arm.page,
        arm,
        ptyClock,
        logPath,
        logWatcher: watcher
      });
      observations[armId] = familyResult.observations;
      if (observations[armId].key_to_pty && observations[armId].key_to_pty.status == null) {
        const dispatcherCal = [];
        for (let index = 0; index < FROZEN_INPUTS.measured_repetitions; index += 1) {
          const marker = `dispatcher-cal-${index}`;
          const started = Date.now();
          if (ptyClock === "shell_epochrealtime") {
            await execFile("bash", ["-c", `printf '%s %s\\n' "$EPOCHREALTIME" "${marker}" >> ${JSON.stringify(logPath).slice(1, -1)}`]);
          } else {
            await execFile("sh", ["-c", `printf '%s\\n' "${marker}" >> ${JSON.stringify(logPath).slice(1, -1)}`]);
          }
          dispatcherCal.push(Date.now() - started);
        }
        observations[armId].key_to_pty.dispatcher_append_calibration_ms = statisticSet(dispatcherCal);
        if (watcherCal) {
          observations[armId].key_to_pty.watcher_detection_calibration_ms = watcherCal;
        }
        if (ptyClock === "shell_epochrealtime") {
          const parsed = (await readFile(logPath, "utf8"))
            .split("\n")
            .filter(Boolean)
            .map((line) => parseDispatcherLogLine(line, ptyClock));
          observations[armId].key_to_pty.append_cost_calibration_ms = appendCostSamples(parsed);
          observations[armId].key_to_pty.shell_clock_handshake = handshakeResults[armId];
        }
      }
      correctness[armId] = {
        dispatcher_ready: readyVisible,
        handshake: handshakeResults[armId],
        warmup: familyResult.warmup,
        screencast_scale: oracle.scale,
        discarded_frame_count: oracle.discardedTimestampCount,
        transform_stable: transformStable(oracle.transformSamples)
      };
      blocked.push(...familyResult.blocked);
      watcher.close();
    }
    correctness.control_response_equalization = equalizeControlResponses(
      observations.legacy?.control_response_saturation,
      observations.modular?.control_response_saturation
    );
    const browserInfo = {
      playwright_channel: "chromium",
      chromium_revision: browserVersion,
      viewport: FROZEN_INPUTS.viewport,
      device_scale_factor: FROZEN_INPUTS.viewport.device_scale_factor
    };
    const record = {
      format_version: FORMAT_VERSION,
      capture_id: captureId,
      product_baseline_only: true,
      product_baseline_statement: PRODUCT_BASELINE_STATEMENT,
      same_host: true,
      paint_oracle: PAINT_ORACLE,
      pty_clock: ptyClock,
      host,
      browser: browserInfo,
      arms: {
        legacy: {
          arm_id: "legacy",
          revisions: {
            repository: "trybotster/trybotster",
            commit: PINNED_REVISIONS.legacy_monorepo
          },
          build_commands: ["mise r run_hub_debug"],
          launch_command: arms.legacy.launch_command,
          binary_real_paths: {},
          client: "rails_app_frontend",
          restty: legacyRestty,
          env: { launch: "mise r run_hub_debug" },
          terminal_bounding_box: arms.legacy.terminal_bounding_box,
          frame_scale: arms.legacy.oracle?.scale ?? null,
          discarded_frame_count: arms.legacy.oracle?.discardedTimestampCount ?? 0,
          hub_pid: arms.legacy.child?.pid ?? null,
          data_directory: arms.legacy.dataDir,
          session_ids: arms.legacy.sessionIds,
          shell_clock_handshake: handshakeResults.legacy
        },
        modular: {
          arm_id: "modular",
          revisions: {
            repository: "trybotster/botster-hub",
            commit: PINNED_REVISIONS.modular_hub,
            locked_core: PINNED_REVISIONS.modular_core,
            web: PINNED_REVISIONS.modular_web
          },
          build_commands: [LOCKED_HUB_BUILD_COMMAND, LOCKED_SESSION_WORKER_BUILD_COMMAND],
          launch_command: arms.modular.launch_command,
          binary_real_paths: {
            hub: hubBuild.hubBin,
            session_worker: hubBuild.workerBin
          },
          client: "ionic_react_packaged",
          restty: modularRestty,
          env: {
            BOTSTER_HUB_BIN: hubBuild.hubBin,
            BOTSTER_SESSION_WORKER_BIN: hubBuild.workerBin
          },
          terminal_bounding_box: arms.modular.terminal_bounding_box,
          frame_scale: arms.modular.oracle?.scale ?? null,
          discarded_frame_count: arms.modular.oracle?.discardedTimestampCount ?? 0,
          hub_pid: arms.modular.child?.pid ?? null,
          data_directory: arms.modular.dataDir,
          session_ids: arms.modular.sessionIds,
          shell_clock_handshake: handshakeResults.modular
        }
      },
      frozen_inputs: FROZEN_INPUTS,
      observations,
      correctness,
      blocked
    };
    candidate = record;
  } finally {
    const teardownFailures = [];
    for (const armId of ARM_IDS) {
      if (arms[armId]) {
        const teardown = await teardownArm(arms[armId]);
        if (!teardown.proof?.ok) {
          teardownFailures.push(`${armId} teardown did not prove live stop`);
        }
      }
    }
    if (browser) {
      await browser.close();
    }
    const legacyAfter = await inspectCheckout(legacyCheckout);
    const hubAfter = await inspectCheckout(hubSource);
    assertCheckoutUnchanged(legacyBefore, legacyAfter, "legacy");
    assertCheckoutUnchanged(hubBefore, hubAfter, "hub source");
    await rm(hubBuild.scratch, { recursive: true, force: true }).catch(() => null);
    const teardownProof = { ok: teardownFailures.length === 0 };
    if (!teardownProof.ok) {
      process.stderr.write(`${teardownFailures.join("\n")}\n`);
      process.exitCode = 1;
    } else if (candidate) {
      assertValidObservationRecord(candidate);
      const outputPath = join(packageRoot, "docs/reports", `terminal-baseline-observation-local-${captureId}.json`);
      await writeBaselineRecord(outputPath, candidate, teardownProof);
      process.stdout.write(`wrote ${outputPath}\n`);
    }
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  inspectCheckout,
  RESTTY_RUNTIME_FILES
};
