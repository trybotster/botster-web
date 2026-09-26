import assert from "node:assert/strict";
import { chromium } from "playwright";
import { harnessWaitSupportScript, waitForDom, waitForHarnessEvent } from "./harness-waits.mjs";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript({ content: harnessWaitSupportScript });
  await page.addInitScript(() => {
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { events: globalThis.__botsterWaits.observe([]) };
  });
  await page.goto("data:text/html,<body><div id=root></div></body>");
  // visible after a later insert
  await page.evaluate(() => setTimeout(() => { globalThis.document.getElementById("root").innerHTML = "<p data-testid=x>hello</p>"; }, 50));
  await waitForDom(page, page.getByTestId("x"), { label: "x visible", deadlineMs: 2000 });
  // detached
  await page.evaluate(() => setTimeout(() => globalThis.document.querySelector("[data-testid=x]").remove(), 50));
  await waitForDom(page, { locator: page.getByTestId("x"), state: "detached" }, { label: "x detached", deadlineMs: 2000 });
  // shadow DOM text
  await page.evaluate(() => setTimeout(() => {
    const host = globalThis.document.createElement("div"); globalThis.document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    setTimeout(() => { root.innerHTML = "<span>shadow text</span>"; }, 30);
  }, 30));
  await waitForDom(page, page.getByText("shadow text"), { label: "shadow text", deadlineMs: 2000 });
  // URL via pushState
  await page.evaluate(() => setTimeout(() => globalThis.history.pushState({}, "", "#/apps/x"), 50));
  await waitForDom(page, async () => /\/apps\/x/.test(await page.evaluate(() => globalThis.location.href)), { label: "url", deadlineMs: 2000 });
  // harness event by criteria and by predicate
  await page.evaluate(() => setTimeout(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.push({ kind: "k", payload: { type: "t" } }), 50));
  const entry = await waitForHarnessEvent(page, { kind: "k" }, undefined, { label: "k event", deadlineMs: 2000 });
  assert.equal(entry.payload.type, "t");
  const count = await waitForHarnessEvent(page, (n) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.length >= n ? globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.length : false), 1, { label: "count" });
  assert.equal(count, 1);
  // deadlines fail with the label
  await assert.rejects(waitForDom(page, page.getByTestId("never"), { label: "never-dom", deadlineMs: 200 }), /never-dom/);
  await assert.rejects(waitForHarnessEvent(page, { kind: "never" }, undefined, { label: "never-event", deadlineMs: 200 }), /never-event/);
  console.log("harness-waits self-test passed");
} finally {
  await browser.close();
}
