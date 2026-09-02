import { chromium } from "playwright";
import { createServer } from "vite";
import { readLateAttachHistoryConformanceFixture } from "@trybotster/hub-test-support";

const host = "127.0.0.1";
const fixture = readLateAttachHistoryConformanceFixture();
const snapshots = fixture.history_then_live.filter((event) => event.type === "snapshot");
const readyPaintMarker = fixture.read_screen_text.trim();

if (snapshots.length < 3) {
  throw new Error(
    `Incremental attach proof requires READY, PAGE, and FINISH frames; observed ${snapshots.length} Snapshot events.`
  );
}
if (!readyPaintMarker) {
  throw new Error("Incremental attach proof requires a non-empty READY screen marker.");
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
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://${host}:${address.port}/incremental-ghostsnp-attach-smoke.html`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    () => Boolean(globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__),
    undefined,
    { timeout: 15_000 }
  );

  const deliverSnapshot = async (targetPage, event) => {
    const bytes = Array.from(Buffer.from(event.payload_base64, "base64"));
    await targetPage.evaluate(
      (frame) => globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverSnapshot(frame),
      bytes
    );
  };

  await page.evaluate(() => globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverAttaching());
  await deliverSnapshot(page, snapshots[0]);

  const readyState = await page.evaluate(() => ({
    grid: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRenderGrid(),
    rows: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows(),
    statuses: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getStatuses(),
    requests: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRequests(),
    frames: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames()
  }));
  if (!readyState.rows.some((row) => row.includes(readyPaintMarker))) {
    throw new Error(`READY did not paint before history delivery: ${JSON.stringify(readyState.rows)}`);
  }
  if (readyState.statuses.at(-1)?.state !== "attaching") {
    throw new Error(`READY did not keep attaching status: ${JSON.stringify(readyState.statuses)}`);
  }

  await page.evaluate(() => {
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("queued-input-one");
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("queued-input-two");
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(30, 100);
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(40, 120);
    return globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverOutput(
      Array.from(new TextEncoder().encode("LIVE-AFTER-BARRIER"))
    );
  });

  for (const pageFrame of snapshots.slice(1, -1)) {
    await deliverSnapshot(page, pageFrame);
    const frames = await page.evaluate(() =>
      globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames()
    );
    if (frames.length > 0) {
      throw new Error(`Web sent a binary frame before FINISH: ${JSON.stringify(frames)}`);
    }
  }

  const beforeFinishRows = await page.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows()
  );
  if (beforeFinishRows.some((row) => row.includes("LIVE-AFTER-BARRIER"))) {
    throw new Error("Web painted live output before attached.");
  }
  const beforeFinishGrid = await page.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRenderGrid()
  );
  if (JSON.stringify(beforeFinishGrid) !== JSON.stringify(readyState.grid)) {
    throw new Error(
      `Restty resized between READY and FINISH: ${JSON.stringify({ ready: readyState.grid, beforeFinish: beforeFinishGrid })}`
    );
  }

  await deliverSnapshot(page, snapshots.at(-1));
  const finishFrames = await page.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames()
  );
  if (finishFrames.length > 0) {
    throw new Error(`Web sent a binary frame before attached: ${JSON.stringify(finishFrames)}`);
  }

  await page.evaluate(() => globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverAttached());
  await page.evaluate(() => globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.attached());
  await page.waitForFunction(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames().some(
      (frame) => frame[1] === 3 && frame[4] === 0 && frame[5] === 40 && frame[6] === 0 && frame[7] === 120
    )
  );
  await page.waitForFunction(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames().filter(
      (frame) => frame[1] === 1
    ).length === 2
  );
  await page.waitForFunction(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows().some(
      (row) => row.includes("LIVE-AFTER-BARRIER")
    )
  );

  const finalState = await page.evaluate(() => ({
    rows: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows(),
    statuses: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getStatuses(),
    requests: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRequests(),
    frames: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames()
  }));
  const decoder = new TextDecoder();
  const inputs = finalState.frames.filter((frame) => frame[1] === 1);
  if (inputs.map((frame) => decoder.decode(Uint8Array.from(frame.slice(4)))).join("|") !== "queued-input-one|queued-input-two") {
    throw new Error(`Web changed queued input order: ${JSON.stringify(inputs)}`);
  }
  if (finalState.statuses.at(-1)?.state !== "attached") {
    throw new Error(`Web did not reach attached: ${JSON.stringify(finalState.statuses)}`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Incremental attach browser errors: ${JSON.stringify(pageErrors)}`);
  }

  const degradedPage = await browser.newPage();
  const degradedErrors = [];
  degradedPage.on("pageerror", (error) => degradedErrors.push(error.message));
  await degradedPage.goto(
    `http://${host}:${address.port}/incremental-ghostsnp-attach-smoke.html`,
    { waitUntil: "domcontentloaded" }
  );
  await degradedPage.waitForFunction(
    () => Boolean(globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__),
    undefined,
    { timeout: 15_000 }
  );
  await degradedPage.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverAttaching()
  );
  await deliverSnapshot(degradedPage, snapshots[0]);
  await deliverSnapshot(degradedPage, snapshots[1]);
  await degradedPage.evaluate(() => {
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.writeInput("degraded-input");
    void globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.resize(36, 110);
    return globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverOutput(
      Array.from(new TextEncoder().encode("DEGRADED-LIVE"))
    );
  });
  await degradedPage.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverHistoryIncomplete()
  );
  const degradedBeforeAttached = await degradedPage.evaluate(() => ({
    rows: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.readViewportRows(),
    statuses: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getStatuses(),
    requests: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getRequests(),
    frames: globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getSentFrames()
  }));
  if (degradedBeforeAttached.statuses.at(-1)?.state !== "attaching") {
    throw new Error(
      `Degraded history did not remain attaching before attached: ${JSON.stringify(degradedBeforeAttached.statuses)}`
    );
  }
  if (degradedBeforeAttached.frames.length > 0) {
    throw new Error(
      `Degraded history released a binary frame before attached: ${JSON.stringify(degradedBeforeAttached.frames)}`
    );
  }
  if (degradedBeforeAttached.rows.some((row) => row.includes("DEGRADED-LIVE"))) {
    throw new Error("Degraded history painted live output before attached.");
  }
  await degradedPage.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.deliverAttached()
  );
  await degradedPage.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.attached()
  );
  await degradedPage.waitForFunction(() => {
    const harness = globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__;
    return (
      harness.getSentFrames().some(
        (frame) => frame[1] === 3 && frame[4] === 0 && frame[5] === 36 && frame[6] === 0 && frame[7] === 110
      ) &&
      harness.getSentFrames().some((frame) => frame[1] === 1) &&
      harness.readViewportRows().some((row) => row.includes("DEGRADED-LIVE"))
    );
  });
  const degradedStatuses = await degradedPage.evaluate(() =>
    globalThis.__BOTSTER_INCREMENTAL_ATTACH_SMOKE__.getStatuses()
  );
  if (
    degradedStatuses.at(-1)?.state !== "attached" ||
    !degradedStatuses.at(-1)?.message.includes("incomplete snapshot history")
  ) {
    throw new Error(`Degraded history did not attach as usable: ${JSON.stringify(degradedStatuses)}`);
  }
  if (degradedErrors.length > 0) {
    throw new Error(`Degraded attach browser errors: ${JSON.stringify(degradedErrors)}`);
  }

  console.log(
    `Incremental attach browser proof passed with ${snapshots.length - 2} PAGE frames, READY paint before FINISH, and usable degraded history.`
  );
} finally {
  await browser?.close();
  await vite?.close();
}
