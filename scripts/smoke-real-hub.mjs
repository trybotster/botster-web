/**
 * Real-Hub smoke. Chromium mounts the packaged Web client over local WebRTC against an
 * isolated candidate Hub. This file does not build the Web package or Hub binaries.
 */
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { productionSessionScriptSource } from "./live-packaged-protocol-helpers.mjs";
import {
  dispatchMountedPaste, ensurePackageEnabled, formatLaneFailure, installLiveHarnessPageHooks,
  openHomeView, openSessionTerminal, readBoundedTerminalObserver, readDirectTerminalModeFlags,
  registerTerminalMarker, requestDaemonShutdown, sendDaemonRequest, spawnHubProcess,
  takePasteOutcomes, takeTerminalResults, typeThroughMountedTerminal, verifyCandidateManifest,
  waitForHtmlShell, waitForHttpOk, waitForPackageAppUrl, waitForRenderedTerminalText,
  waitForSocket, waitForTerminalAttachState, waitForTerminalCanvas, waitForTerminalMarker,
  waitForTerminalSession
} from "./live-hub-lane.mjs";

const packageRoot = process.cwd();
const hubBin = process.env.BOTSTER_HUB_BIN;
const workerBin = process.env.BOTSTER_SESSION_WORKER_BIN;
const manifestPath = process.env.BOTSTER_CANDIDATE_MANIFEST;
const sessionId = "web-smoke";
const STEP_MS = 30_000;
const PASTE_MS = 45_000;
const PASTE_BYTES = 65_536;

class LaneFailure extends Error {
  constructor(fields) {
    super(fields.cause instanceof Error ? fields.cause.message : String(fields.cause));
    this.fields = fields;
  }
}

async function step(name, context, body, deadlineMs = STEP_MS) {
  const startedAt = Date.now();
  let timer;
  try {
    return await Promise.race([
      body(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`deadline ${deadlineMs} ms exceeded`)), deadlineMs);
      })
    ]);
  } catch (cause) {
    const observed = context.page
      ? await readBoundedTerminalObserver(context.page).catch(() => null)
      : null;
    throw new LaneFailure({
      layer: "web", step: name, session_id: sessionId,
      subscription_id: observed?.subscription_id ?? context.subscriptionId ?? null,
      generation: observed?.generation ?? context.generation ?? null,
      stream_epoch: observed?.stream_epoch ?? context.streamEpoch ?? null,
      deadline_ms: deadlineMs, elapsed_ms: Date.now() - startedAt,
      last_kinds: observed?.last_kinds ?? [], cause
    });
  } finally {
    clearTimeout(timer);
  }
}

async function bounded(name, body, deadlineMs = 10_000) {
  let timer;
  try {
    return await Promise.race([
      body(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} exceeded ${deadlineMs} ms`)), deadlineMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForObserver(page, predicate, timeout = STEP_MS) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const observed = await readBoundedTerminalObserver(page);
    const value = predicate(observed);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`bounded terminal observer condition exceeded ${timeout} ms`);
}

async function waitForMountedResizeSettlement(page, beforeCount) {
  const deadline = Date.now() + STEP_MS;
  while (Date.now() < deadline) {
    const observed = await readBoundedTerminalObserver(page);
    const resize = observed.latest_resize;
    if ((observed.counts.resize ?? 0) > beforeCount && resize?.rows > 0 && resize?.cols > 0) {
      const modes = await readDirectTerminalModeFlags(page, sessionId);
      if (modes.rows === resize.rows && modes.cols === resize.cols) return { resize, modes };
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`mounted resize did not settle within ${STEP_MS} ms`);
}

async function mountedAttachment(page) {
  await waitForTerminalSession(page, sessionId);
  await waitForTerminalCanvas(page);
  await waitForTerminalAttachState(page, "attached");
  return waitForObserver(page, (observed) =>
    observed.subscription_id && observed.attach_state === "attached" && observed.snapshot.finish_seen
      ? observed : null
  );
}

function printablePasteText(length) {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(0x20 + (index % 0x5f));
  }
  return text;
}

function multilinePasteText(length) {
  const beforeNewline = Math.floor((length - 1) / 2);
  return `${"u".repeat(beforeNewline)}\n${"u".repeat(length - beforeNewline - 1)}`;
}

function oneRow(rows, label, kind) {
  if (rows.length !== 1) {
    throw new Error(`${label}: expected one ${kind}, observed ${rows.length}: ${JSON.stringify(rows)}`);
  }
  return rows[0];
}

let hubProcess;
let browser;
let dataDir;
let peerA;
let peerB;
const hubOutput = { stdout: "", stderr: "" };

try {
  for (const [name, value] of Object.entries({
    BOTSTER_HUB_BIN: hubBin,
    BOTSTER_SESSION_WORKER_BIN: workerBin,
    BOTSTER_CANDIDATE_MANIFEST: manifestPath
  })) {
    if (!value) throw new LaneFailure({ layer: "web", step: "inputs", cause: new Error(`${name} is required`) });
  }
  if (!existsSync(join(packageRoot, "dist", "index.html"))) {
    throw new LaneFailure({ layer: "web", step: "prebuild", cause: new Error("dist/index.html is missing: run npm run build first") });
  }

  // This check must complete before Chromium starts.
  const manifest = await step("candidate-manifest", {}, () =>
    verifyCandidateManifest({ manifestPath, hubBin, workerBin })
  );
  console.log(`real-hub-smoke provenance ${JSON.stringify(manifest)}`);

  dataDir = await mkdtemp(join(tmpdir(), "botster-web-real-hub-"));
  const laneContext = { hubBin, workerBin, cwd: packageRoot };
  hubProcess = spawnHubProcess(dataDir, {
    ...laneContext,
    onStdout: (chunk) => { hubOutput.stdout += chunk; },
    onStderr: (chunk) => { hubOutput.stderr += chunk; }
  });
  const socketPath = join(dataDir, "botster-hub.sock");
  await step("hub-socket", {}, () => waitForSocket(socketPath, () =>
    hubProcess?.exitCode !== null ? `hub exited before socket readiness (code=${hubProcess.exitCode})` : undefined
  ));
  await step("web-package", {}, () => ensurePackageEnabled("botster-web", packageRoot, { ...laneContext, dataDir }));
  const started = await step("web-entrypoint", {}, () => sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint", package_name: "botster-web", entrypoint_id: "web-client"
  }));
  if (started.error) throw new Error(`Web entrypoint failed: ${JSON.stringify(started.error)}`);
  const appUrl = await step("web-url", {}, () => waitForPackageAppUrl(socketPath));
  await step("web-health", {}, () => waitForHttpOk(new URL("/health", appUrl).toString()));
  await step("web-shell", {}, () => waitForHtmlShell(appUrl));

  const scriptPath = join(dataDir, "botster-web-smoke-session.sh");
  await writeFile(scriptPath, productionSessionScriptSource({ receiverWatchdogSeconds: 60 }));
  const spawned = await step("session-spawn", {}, () => sendDaemonRequest(socketPath, {
    type: "spawn", session_id: sessionId, command: `sh ${scriptPath}`
  }));
  if (spawned.error) throw new Error(`session spawn failed: ${JSON.stringify(spawned.error)}`);

  browser = await chromium.launch({
    args: ["--disable-features=WebRtcHideLocalIpsWithMdns", "--force-webrtc-ip-handling-policy=default_public_and_private_interfaces"]
  });
  const openPeer = async (name) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await installLiveHarnessPageHooks(page, { boundedTerminalObserver: true });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await step(`${name}-transport`, { page }, () => page.waitForFunction(
      () => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.transportControl),
      undefined, { timeout: STEP_MS }
    ));
    await step(`${name}-open-session`, { page }, async () => {
      await openSessionTerminal(page, sessionId);
      return mountedAttachment(page);
    });
    return page;
  };

  // W-S1 uses the mounted Restty client for attach, keyboard input, and resize.
  peerA = await openPeer("peer-a");
  let attachedA = await readBoundedTerminalObserver(peerA);
  const contextA = () => ({
    page: peerA, subscriptionId: attachedA.subscription_id,
    generation: attachedA.generation, streamEpoch: attachedA.stream_epoch
  });
  await step("ws1-key-echo", contextA(), async () => {
    await typeThroughMountedTerminal(peerA, "ws1-echo\n");
    await waitForRenderedTerminalText(peerA, "botster-web-production-echo:ws1-echo");
  });
  await step("ws1-resize", contextA(), async () => {
    const before = await readBoundedTerminalObserver(peerA);
    await peerA.setViewportSize({ width: 1024, height: 700 });
    const { resize: resized, modes } = await waitForMountedResizeSettlement(peerA, before.counts.resize ?? 0);
    if (modes.rows !== resized.rows || modes.cols !== resized.cols) {
      throw new Error(`worker size ${modes.rows}x${modes.cols} differs from mounted resize ${resized.rows}x${resized.cols}`);
    }
    if (modes.bracketed_paste !== false) throw new Error(`bracketed_paste=${String(modes.bracketed_paste)}, expected false`);
    const marker = `botster-web-production-size:${resized.rows}x${resized.cols}`;
    await typeThroughMountedTerminal(peerA, "botster-web-production-size\n");
    await waitForRenderedTerminalText(peerA, marker);
  });
  console.log(`real-hub-smoke W-S1 passed ${JSON.stringify({ subscription_id: attachedA.subscription_id, generation: attachedA.generation })}`);

  // W-S2 sends input through mounted peer B and reads Restty cells on both peers.
  peerB = await openPeer("peer-b");
  const attachedB = await readBoundedTerminalObserver(peerB);
  await step("ws2-echo-on-both", { page: peerB, subscriptionId: attachedB.subscription_id }, async () => {
    const value = `ws2-${Date.now().toString(36)}`;
    const marker = `botster-web-production-echo:${value}`;
    await typeThroughMountedTerminal(peerB, `${value}\n`);
    await Promise.all([waitForRenderedTerminalText(peerA, marker), waitForRenderedTerminalText(peerB, marker)]);
  });
  console.log(`real-hub-smoke W-S2 passed ${JSON.stringify({ peer_a: attachedA.subscription_id, peer_b: attachedB.subscription_id })}`);

  // W-S3 uses the mounted clipboard path. The client always requests allowUnsafe=false.
  await step("ws3-printable-safe", contextA(), async () => {
    await takePasteOutcomes(peerA);
    await takeTerminalResults(peerA);
    const text = printablePasteText(PASTE_BYTES);
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    await registerTerminalMarker(peerA, "ws3-ready", `botster-web-production-receive-ready:${PASTE_BYTES}\n`);
    await typeThroughMountedTerminal(peerA, `botster-web-production-receive:${PASTE_BYTES}\n`);
    await waitForTerminalMarker(peerA, "ws3-ready", PASTE_MS);
    const receipt = `botster-web-production-received:${PASTE_BYTES}:${PASTE_BYTES}:${digest}`;
    await registerTerminalMarker(peerA, "ws3-receipt", receipt);
    const dispatched = await dispatchMountedPaste(peerA, text);
    if (!dispatched.defaultPrevented) throw new Error("mounted printable paste was not consumed");
    await waitForObserver(peerA, (observed) => observed.paste_outcome_count === 1 && observed.result_count === 1, PASTE_MS);
    const outcome = oneRow(await takePasteOutcomes(peerA), "printable paste", "paste outcome");
    const result = oneRow(await takeTerminalResults(peerA), "printable paste", "INPUT_RESULT");
    if (!Number.isSafeInteger(outcome.operationId) || outcome.operationId !== result.operation_id) {
      throw new Error(`printable paste operation IDs differ: outcome=${JSON.stringify(outcome)} result=${JSON.stringify(result)}`);
    }
    if (outcome.outcome !== "written" || result.outcome !== "written") {
      throw new Error(`printable paste outcome=${String(outcome.outcome)} result=${String(result.outcome)}`);
    }
    if (outcome.requestedBytes !== PASTE_BYTES || outcome.acceptedPayloadBytes !== PASTE_BYTES || outcome.writtenPtyBytes !== PASTE_BYTES) {
      throw new Error(`printable paste outcome counts are invalid: ${JSON.stringify(outcome)}`);
    }
    if (result.accepted_payload_bytes !== PASTE_BYTES || result.written_pty_bytes !== PASTE_BYTES) {
      throw new Error(`printable paste INPUT_RESULT counts are invalid: ${JSON.stringify(result)}`);
    }
    const modes = await readDirectTerminalModeFlags(peerA, sessionId);
    if (modes.bracketed_paste !== false) throw new Error(`printable paste observed bracketed_paste=${String(modes.bracketed_paste)}`);
    await waitForTerminalMarker(peerA, "ws3-receipt", PASTE_MS);
  }, PASTE_MS);

  await step("ws3-multiline-rejected", contextA(), async () => {
    await takePasteOutcomes(peerA);
    await takeTerminalResults(peerA);
    const dispatched = await dispatchMountedPaste(peerA, multilinePasteText(PASTE_BYTES));
    if (!dispatched.defaultPrevented) throw new Error("mounted multiline paste was not consumed");
    await waitForObserver(peerA, (observed) => observed.paste_outcome_count === 1 && observed.result_count === 1, PASTE_MS);
    const outcome = oneRow(await takePasteOutcomes(peerA), "multiline paste", "paste outcome");
    const result = oneRow(await takeTerminalResults(peerA), "multiline paste", "INPUT_RESULT");
    if (!Number.isSafeInteger(outcome.operationId) || outcome.operationId !== result.operation_id) {
      throw new Error(`multiline paste operation IDs differ: outcome=${JSON.stringify(outcome)} result=${JSON.stringify(result)}`);
    }
    if (outcome.outcome !== "rejected_unsafe_paste" || result.outcome !== "rejected_unsafe_paste") {
      throw new Error(`multiline paste outcome=${String(outcome.outcome)} result=${String(result.outcome)}`);
    }
    if (outcome.requestedBytes !== PASTE_BYTES) {
      throw new Error(`multiline paste counts are invalid: outcome=${JSON.stringify(outcome)} result=${JSON.stringify(result)}`);
    }
    // A partial PTY write would prefix the next line and make this exact echo fail.
    const value = `ws3-after-rejection-${Date.now().toString(36)}`;
    await typeThroughMountedTerminal(peerA, `${value}\n`);
    await waitForRenderedTerminalText(peerA, `botster-web-production-echo:${value}`);
  }, PASTE_MS);
  console.log(`real-hub-smoke W-S3 policy observed ${JSON.stringify({ printable_bytes: PASTE_BYTES, multiline_rejected_bytes: PASTE_BYTES, post_rejection_input: "verified", multiline_support: "unresolved-product-requirement", consent_followup: "required" })}`);

  // W-S4 proves restored history and new live output through the re-mounted Restty client.
  const historyValue = `ws4-history-${Date.now().toString(36)}`;
  const historyMarker = `botster-web-production-echo:${historyValue}`;
  await step("ws4-history-before-detach", contextA(), async () => {
    await typeThroughMountedTerminal(peerA, `${historyValue}\n`);
    await waitForRenderedTerminalText(peerA, historyMarker);
  });
  const firstSubscription = attachedA.subscription_id;
  await step("ws4-detach", contextA(), () => openHomeView(peerA));
  await step("ws4-reattach", contextA(), async () => {
    await openSessionTerminal(peerA, sessionId);
    const next = await mountedAttachment(peerA);
    if (next.subscription_id === firstSubscription) throw new Error(`reattach reused subscription ${firstSubscription}`);
    attachedA = next;
    await waitForRenderedTerminalText(peerA, historyMarker);
  });
  await step("ws4-live-after-restore", contextA(), async () => {
    const value = `ws4-live-${Date.now().toString(36)}`;
    await typeThroughMountedTerminal(peerA, `${value}\n`);
    await waitForRenderedTerminalText(peerA, `botster-web-production-echo:${value}`);
  });
  console.log(`real-hub-smoke W-S4 passed ${JSON.stringify({ detached: firstSubscription, reattached: attachedA.subscription_id, abandoned_outstanding_count: attachedA.abandoned_outstanding_count })}`);

  await step("final-detach-peer-a", contextA(), () => openHomeView(peerA));
  await step("final-detach-peer-b", { page: peerB, subscriptionId: attachedB.subscription_id }, () => openHomeView(peerB));
  console.log(`real-hub-smoke passed ${JSON.stringify({ session_id: sessionId, post_rejection_input: "verified", paste_policy: "multiline-rejected-consent-followup", multiline_support: "unresolved-product-requirement", source_revisions: manifest.source_revisions })}`);
} catch (error) {
  const fields = error instanceof LaneFailure ? error.fields : { layer: "web", step: "unclassified", session_id: sessionId, cause: error };
  console.error(formatLaneFailure(fields));
  if (hubOutput.stderr) console.error(`[botster-hub stderr tail] ${hubOutput.stderr.slice(-2_000)}`);
  process.exitCode = 1;
} finally {
  await bounded("browser close", () => browser?.close() ?? Promise.resolve()).catch(() => undefined);
  if (hubProcess && hubProcess.exitCode === null) {
    await bounded("Hub shutdown", () => requestDaemonShutdown({ hubBin, cwd: packageRoot, dataDir, hubProcess })).catch(() => undefined);
    if (hubProcess.exitCode === null) {
      hubProcess.kill("SIGTERM");
      await bounded("Hub exit", () => once(hubProcess, "exit"), 2_000).catch(() => undefined);
    }
  }
  if (dataDir) await bounded("temporary data removal", () => rm(dataDir, { recursive: true, force: true })).catch(() => undefined);
}
