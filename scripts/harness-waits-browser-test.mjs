import assert from "node:assert/strict";
import { chromium } from "playwright";
import { harnessWaitSupportScript, waitForDom, waitForHarnessEvent } from "./harness-waits.mjs";

/**
 * Browser self-test of the two shared waits: each condition is false when the wait starts, the
 * page then changes, and the wait resolves on that change. Deadlines fail with their labels.
 */
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript({ content: harnessWaitSupportScript });
  await page.addInitScript(() => {
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { events: globalThis.__botsterWaits.observe([]) };
  });
  await page.goto("data:text/html,<body><div id=root></div></body>");

  const afterChange = async (wait, change) => {
    const pending = wait();
    await page.evaluate(change);
    return pending;
  };

  assert.equal(await page.getByTestId("x").count(), 0);
  await afterChange(
    () => waitForDom(page, page.getByTestId("x"), { label: "x visible", deadlineMs: 2_000 }),
    () => { globalThis.document.getElementById("root").innerHTML = "<p data-testid=x>hello</p>"; }
  );
  await afterChange(
    () => waitForDom(page, { locator: page.getByTestId("x"), state: "detached" }, { label: "x detached", deadlineMs: 2_000 }),
    () => globalThis.document.querySelector("[data-testid=x]").remove()
  );
  // A shadow root created before the wait; its content changes after the wait starts.
  await page.evaluate(() => {
    const host = globalThis.document.createElement("div");
    host.id = "shadow-host";
    globalThis.document.body.append(host);
    host.attachShadow({ mode: "open" });
  });
  await afterChange(
    () => waitForDom(page, page.getByText("shadow text"), { label: "shadow text", deadlineMs: 2_000 }),
    () => { globalThis.document.getElementById("shadow-host").shadowRoot.innerHTML = "<span>shadow text</span>"; }
  );
  await afterChange(
    () => waitForDom(page, async () => /\/apps\/x/.test(await page.evaluate(() => globalThis.location.href)), { label: "url", deadlineMs: 2_000 }),
    () => globalThis.history.pushState({}, "", "#/apps/x")
  );
  const entry = await afterChange(
    () => waitForHarnessEvent(page, { kind: "k" }, undefined, { label: "k event", deadlineMs: 2_000 }),
    () => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.push({ kind: "k", payload: { type: "t" } })
  );
  assert.equal(entry.payload.type, "t");
  const count = await waitForHarnessEvent(
    page,
    (n) => (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.length >= n ? globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.events.length : false),
    1,
    { label: "count" }
  );
  assert.equal(count, 1);
  await assert.rejects(waitForDom(page, page.getByTestId("never"), { label: "never-dom", deadlineMs: 200 }), /never-dom/);
  await assert.rejects(waitForHarnessEvent(page, { kind: "never" }, undefined, { label: "never-event", deadlineMs: 200 }), /never-event/);
  console.log("harness-waits self-test passed");
} finally {
  await browser.close();
}
