import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createServer } from "vite";

const host = "127.0.0.1";
const fixturePath = new URL("../fixtures/ghostsnp/rich-matrix-v1.bin", import.meta.url);
const fixture = await readFile(fixturePath);
const fixtureSha256 = createHash("sha256").update(fixture).digest("hex");

if (fixture.subarray(0, 8).toString("ascii") !== "GHOSTSNP") {
  throw new Error("retained scrollback fixture does not have GHOSTSNP magic");
}
if (fixtureSha256 !== "7aba861353b9d45cf28a128ba48e6e3ab0b0b87610d53e7136a591363cc4fd28") {
  throw new Error(`retained scrollback fixture has an unknown digest: ${fixtureSha256}`);
}

let vite;
let browser;

try {
  vite = await createServer({ server: { host, port: 0 } });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("GHOSTSNP grid smoke could not resolve the Vite address");
  }

  browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://${host}:${address.port}/ghostsnp-grid-smoke.html`, {
    waitUntil: "domcontentloaded"
  });

  await page.waitForFunction(
    () => Boolean(globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__),
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    () => {
      const mounted = globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getMountedGrid();
      const rendered = globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getRenderGrid();
      return Boolean(
        mounted &&
        rendered &&
        mounted.columns === rendered.columns &&
        mounted.rows === rendered.rows
      );
    },
    undefined,
    { timeout: 15_000 }
  ).catch(async (error) => {
    const state = await page.evaluate(() => ({
      mounted: globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getMountedGrid(),
      rendered: globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getRenderGrid()
    }));
    throw new Error(`${error.message}\nfresh Restty grid state: ${JSON.stringify(state)}`);
  });

  const browserGrid = await page.evaluate(() =>
    globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getMountedGrid()
  );
  if (!browserGrid || browserGrid.columns <= 0 || browserGrid.rows <= 0) {
    throw new Error(`fresh Restty runtime did not report a browser grid: ${JSON.stringify(browserGrid)}`);
  }
  if (browserGrid.columns === 40 && browserGrid.rows === 12) {
    throw new Error("browser grid unexpectedly matches the snapshot-native 40x12 grid");
  }

  const imported = await page.evaluate((bytes) => {
    const snapshot = Uint8Array.from(bytes);
    return globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.importSnapshot(snapshot);
  }, Array.from(fixture));
  if (!imported) throw new Error("fresh Restty runtime rejected the authentic GHOSTSNP fixture");

  const restoredGrid = await page.evaluate(() =>
    globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.getRenderGrid()
  );
  await page.evaluate(() => globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.scrollToOldest());
  const retainedHistory = await page.evaluate(() =>
    globalThis.__BOTSTER_GHOSTSNP_GRID_SMOKE__.readViewportRows()
  );
  if (!retainedHistory.some((row) => row.includes("SCROLLBACK-LINE-000"))) {
    throw new Error(`retained scrollback was not reachable: ${JSON.stringify(retainedHistory)}`);
  }
  if (
    !restoredGrid ||
    restoredGrid.columns !== browserGrid.columns ||
    restoredGrid.rows !== browserGrid.rows
  ) {
    throw new Error(
      `GHOSTSNP import did not retain the browser grid without a resize: ${JSON.stringify({ browserGrid, restoredGrid })}`
    );
  }
  if (pageErrors.length > 0) {
    throw new Error(`GHOSTSNP grid browser errors: ${JSON.stringify(pageErrors)}`);
  }

  console.log(
    `GHOSTSNP retained scrollback and browser grid smoke passed: ${browserGrid.columns}x${browserGrid.rows}`
  );
} finally {
  await browser?.close();
  await vite?.close();
}
