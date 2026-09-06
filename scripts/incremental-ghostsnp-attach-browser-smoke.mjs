import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Browser proof of the scheme 2 incremental attach on one real data plane and one real
 * Restty renderer. The GHOSTSNP pages come from `fixtures/ghostsnp/ready-then-history`;
 * the driver wraps them in scheme 2 frames in the route order
 * ATTACH_STATE attached, MODES, SNAPSHOT_READY, OUTPUT and SNAPSHOT_HISTORY, SNAPSHOT_FINISH.
 */
const host = "127.0.0.1";
const fixtureDir = new URL("../fixtures/ghostsnp/ready-then-history/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", fixtureDir), "utf8"));
const pages = await Promise.all(
  index.pages.map(async (name) => Array.from(await readFile(new URL(name, fixtureDir))))
);
const readyPaintMarker = String(index.ready_screen_text ?? "").trim();
const [readyPage, ...historyPages] = pages;

if (!readyPage || historyPages.length < 1) {
  throw new Error(
    `Incremental attach proof requires one READY page and at least one history page; observed ${pages.length} pages.`
  );
}
if (!readyPaintMarker) {
  throw new Error("Incremental attach proof requires a non-empty READY screen marker.");
}

const TERMINAL_INPUT_KIND_RAW_BYTES = 1;
const TERMINAL_INPUT_KIND_RESIZE = 5;
const INPUT_HEADER_BYTES = 12;
const inputKind = (frame) => frame[1];
const inputOperationId = (frame) => Number(new DataView(Uint8Array.from(frame).buffer).getBigUint64(4, false));
const resizeOf = (frame) => {
  const view = new DataView(Uint8Array.from(frame).buffer);
  return { rows: view.getUint16(INPUT_HEADER_BYTES, false), cols: view.getUint16(INPUT_HEADER_BYTES + 2, false) };
};
const rawTextOf = (frame) => new TextDecoder().decode(Uint8Array.from(frame.slice(INPUT_HEADER_BYTES)));

const smoke = (page) => ({
  call: (method, ...args) =>
    page.evaluate(
      ({ name, values }) => globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__[name](...values),
      { name: method, values: args }
    ),
  state: () =>
    page.evaluate(() => ({
      grid: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRenderGrid(),
      rows: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows(),
      statuses: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getStatuses(),
      requests: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRequests(),
      frames: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames(),
      outcomes: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getOutcomes()
    }))
});

async function openSmokePage(browser, address) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://${host}:${address.port}/incremental-ghostsnp-attach-smoke.html`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    () => Boolean(globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__),
    undefined,
    { timeout: 15_000 }
  );
  return { page, errors, api: smoke(page) };
}

function assertNoInputFrames(frames, stage) {
  if (frames.length > 0) {
    throw new Error(`Web sent a binary input frame ${stage}: ${JSON.stringify(frames.map((frame) => frame.slice(0, 12)))}`);
  }
}

let vite;
let browser;

try {
  vite = await createServer({ server: { host, port: 0 } });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Incremental attach proof could not resolve the Vite address.");
  }

  browser = await chromium.launch();

  // Complete attach: READY paints before history, live output waits for FINISH, queued
  // input and coalesced resize are released only after the attach completes.
  const { page, errors: pageErrors, api } = await openSmokePage(browser, address);
  await api.call("deliverAttaching");
  await page.evaluate(() => {
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("queued-input-one");
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("queued-input-two");
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(30, 100);
    return globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(40, 120);
  });
  assertNoInputFrames((await api.state()).frames, "before ATTACH_STATE attached");
  await api.call("deliverAttached");
  await api.call("deliverModes", 0, 40, 120);
  await api.call("deliverSnapshotReady", readyPage);

  const readyState = await api.state();
  if (!readyState.rows.some((row) => row.includes(readyPaintMarker))) {
    throw new Error(`READY did not paint before history delivery: ${JSON.stringify(readyState.rows)}`);
  }
  if (readyState.statuses.at(-1)?.state !== "attaching") {
    throw new Error(`READY did not keep attaching status: ${JSON.stringify(readyState.statuses)}`);
  }
  assertNoInputFrames(readyState.frames, "before SNAPSHOT_FINISH");

  await api.call("deliverOutput", Array.from(new TextEncoder().encode("LIVE-AFTER-BARRIER")));
  for (const historyPage of historyPages) {
    await api.call("deliverSnapshotHistory", historyPage);
    assertNoInputFrames((await api.state()).frames, "before SNAPSHOT_FINISH");
  }

  const beforeFinish = await api.state();
  if (beforeFinish.rows.some((row) => row.includes("LIVE-AFTER-BARRIER"))) {
    throw new Error("Web painted live output before SNAPSHOT_FINISH.");
  }
  if (JSON.stringify(beforeFinish.grid) !== JSON.stringify(readyState.grid)) {
    throw new Error(
      `Restty resized between READY and FINISH: ${JSON.stringify({ ready: readyState.grid, beforeFinish: beforeFinish.grid })}`
    );
  }

  await api.call("deliverSnapshotFinish");
  await api.call("attached");
  await page.waitForFunction(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames().length >= 3 &&
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows().some((row) => row.includes("LIVE-AFTER-BARRIER"))
  );

  const finalState = await api.state();
  const resizes = finalState.frames.filter((frame) => inputKind(frame) === TERMINAL_INPUT_KIND_RESIZE);
  const inputs = finalState.frames.filter((frame) => inputKind(frame) === TERMINAL_INPUT_KIND_RAW_BYTES);
  if (resizes.length !== 1 || resizes[0] !== finalState.frames[0]) {
    throw new Error(`Web did not send one coalesced RESIZE ahead of queued input: ${JSON.stringify(finalState.frames.map((frame) => frame.slice(0, 12)))}`);
  }
  const resize = resizeOf(resizes[0]);
  if (resize.rows !== 40 || resize.cols !== 120) {
    throw new Error(`Web sent a stale RESIZE: ${JSON.stringify(resize)}`);
  }
  if (inputs.map(rawTextOf).join("|") !== "queued-input-one|queued-input-two") {
    throw new Error(`Web changed queued input order: ${JSON.stringify(inputs.map(rawTextOf))}`);
  }
  const operationIds = finalState.frames.map(inputOperationId);
  if (operationIds.join(",") !== "1,2,3") {
    throw new Error(`Operation ids are not 1, 2, 3 in send order: ${JSON.stringify(operationIds)}`);
  }
  if (finalState.statuses.at(-1)?.state !== "attached") {
    throw new Error(`Web did not reach attached: ${JSON.stringify(finalState.statuses)}`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Incremental attach browser errors: ${JSON.stringify(pageErrors)}`);
  }

  // Degraded attach: HISTORY_UNAVAILABLE after READY keeps the READY screen, ignores later
  // history pages, and attaches with incomplete history once FINISH arrives.
  const degraded = await openSmokePage(browser, address);
  await degraded.api.call("deliverAttaching");
  await degraded.api.call("deliverAttached");
  await degraded.api.call("deliverModes", 0, 36, 110);
  await degraded.api.call("deliverSnapshotReady", readyPage);
  await degraded.page.evaluate(() => {
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("degraded-input");
    return globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(36, 110);
  });
  await degraded.api.call("deliverOutput", Array.from(new TextEncoder().encode("DEGRADED-LIVE")));
  await degraded.api.call("deliverHistoryUnavailable", "capture_failed");
  await degraded.api.call("deliverSnapshotHistory", historyPages[0]);
  const degradedBeforeFinish = await degraded.api.state();
  if (degradedBeforeFinish.statuses.at(-1)?.state !== "attaching") {
    throw new Error(`Degraded history did not remain attaching before FINISH: ${JSON.stringify(degradedBeforeFinish.statuses)}`);
  }
  assertNoInputFrames(degradedBeforeFinish.frames, "before SNAPSHOT_FINISH on the degraded attach");
  if (degradedBeforeFinish.rows.some((row) => row.includes("DEGRADED-LIVE"))) {
    throw new Error("Degraded history painted live output before SNAPSHOT_FINISH.");
  }
  if (!degradedBeforeFinish.rows.some((row) => row.includes(readyPaintMarker))) {
    throw new Error(`Degraded history lost the READY screen: ${JSON.stringify(degradedBeforeFinish.rows)}`);
  }
  await degraded.api.call("deliverSnapshotFinish");
  await degraded.api.call("attached");
  await degraded.page.waitForFunction(() => {
    const harness = globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__;
    return harness.getSentFrames().length >= 2 && harness.readViewportRows().some((row) => row.includes("DEGRADED-LIVE"));
  });
  const degradedFinal = await degraded.api.state();
  const degradedResize = degradedFinal.frames.find((frame) => inputKind(frame) === TERMINAL_INPUT_KIND_RESIZE);
  if (!degradedResize || JSON.stringify(resizeOf(degradedResize)) !== JSON.stringify({ rows: 36, cols: 110 })) {
    throw new Error(`Degraded attach did not send the queued RESIZE: ${JSON.stringify(degradedFinal.frames.map((frame) => frame.slice(0, 12)))}`);
  }
  if (!degradedFinal.frames.some((frame) => inputKind(frame) === TERMINAL_INPUT_KIND_RAW_BYTES && rawTextOf(frame) === "degraded-input")) {
    throw new Error("Degraded attach did not send the queued input.");
  }
  if (
    degradedFinal.statuses.at(-1)?.state !== "attached" ||
    !degradedFinal.statuses.at(-1)?.message.includes("incomplete snapshot history")
  ) {
    throw new Error(`Degraded history did not attach as usable: ${JSON.stringify(degradedFinal.statuses)}`);
  }
  if (degraded.errors.length > 0) {
    throw new Error(`Degraded attach browser errors: ${JSON.stringify(degraded.errors)}`);
  }

  console.log(
    `Incremental attach browser proof passed with ${historyPages.length} history pages, READY paint before FINISH, and usable degraded history.`
  );
} finally {
  await browser?.close();
  await vite?.close();
}
