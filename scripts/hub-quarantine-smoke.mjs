import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { harnessWaitSupportScript, waitForDom } from "./harness-waits.mjs";

/**
 * Resolve feedback through the UI dispatch path: the fixture page mounts the production Hub
 * transport, Web client, useHubActions, and HubGeneralSection over a scripted bridge that holds
 * each resolve_quarantine answer and, on request, each status read. This driver clicks the real
 * Resolve buttons and releases the answers: pending, refused, a confirmed resolve whose status
 * read is held across the production action deadline (10 s) and then fails, two overlapping
 * Resolve operations on one target, clean resolve, dispatch failure, and a retry.
 */
const host = "127.0.0.1";
const deadlineMs = 15_000;
// Longer than the production action deadline (10 s), which the sentinel row waits out.
const actionExpiryDeadlineMs = 20_000;

let vite;
let browser;
try {
  // No file watching and no HMR: a source write during a run must not re-execute the fixture
  // module (a second root with fresh state) in the middle of the scripted sequence.
  vite = await createServer({ server: { host, port: 0, hmr: false, watch: null } });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("hub quarantine smoke could not resolve the Vite address");

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await page.addInitScript({ content: harnessWaitSupportScript });
  await page.goto(`http://${host}:${address.port}/hub-quarantine-smoke.html`, { waitUntil: "domcontentloaded" });

  const row = (key) => page.locator(`[data-testid='hub-quarantine'][data-quarantine-key='${key}']`);
  const resolveButton = (key) => row(key).getByTestId("hub-quarantine-resolve");
  const toast = page.getByTestId("smoke-toast");
  const outcomeOf = (key) => row(key).getAttribute("data-quarantine-outcome");
  const held = () => page.evaluate(() => globalThis.__BOTSTER_QUARANTINE_SMOKE__.held());
  const smoke = (name, ...args) => page.evaluate(([n, a]) => globalThis.__BOTSTER_QUARANTINE_SMOKE__[n](...a), [name, args]);
  const release = (key, mode) => page.evaluate(([k, m]) => globalThis.__BOTSTER_QUARANTINE_SMOKE__.release(k, m), [key, mode]);
  const waitOutcome = (key, state) => waitForDom(page, async () => (await outcomeOf(key)) === state, { label: `${key} outcome ${state}`, deadlineMs });
  const waitHeld = (key) => waitForDom(page, async () => (await held()).includes(key), { label: `${key} resolve held at the bridge`, deadlineMs });
  const waitToast = (color, text) => waitForDom(page, async () =>
    (await toast.count()) === 1 && (await toast.getAttribute("data-color")) === color && (await toast.innerText()).includes(text),
  { label: `toast ${color} ${text}`, deadlineMs });

  const click = async (key) => {
    const target = resolveButton(key);
    await waitForDom(page, { locator: target, state: "actionable" }, { label: `${key} Resolve before click` });
    await target.click();
    await waitHeld(key);
    await waitOutcome(key, "pending");
    assert.equal(await resolveButton(key).innerText(), "Resolving…", `${key} pending label`);
    assert.equal(await resolveButton(key).evaluate((node) => node.disabled === true || node.hasAttribute("disabled")), true, `${key} Resolve disabled while pending`);
  };

  const refused = "package:acme.refused";
  const stale = "repository_session_types:/work/stale";
  const clean = "package:acme.clean";
  const thrown = "package:acme.throw";
  const sentinel = "package:acme.sentinel";
  const overlap = "package:acme.overlap";

  await waitForDom(page, async () => (await page.getByTestId("hub-quarantine").count()) === 6, { label: "six quarantine rows", deadlineMs });

  // Refused: the reason is on the row and Resolve is offered again.
  await click(refused);
  await release(refused, "refused");
  await waitOutcome(refused, "refused");
  assert.match(await row(refused).getByTestId("hub-quarantine-outcome").innerText(), /Resolve failed: package is still unloading/);
  await waitForDom(page, { locator: resolveButton(refused), state: "actionable" }, { label: "refused row offers Resolve again" });
  assert.equal(await resolveButton(refused).innerText(), "Resolve");
  await waitToast("danger", "package is still unloading");

  // Confirmed resolve with a slow status read. The Hub answers at once; the status read is held.
  // The row says it is resolved and reading status, and withdraws Resolve.
  await smoke("setHoldStatus", true);
  await click(stale);
  await release(stale, "resolved");
  await waitOutcome(stale, "refreshing");
  assert.equal(await row(stale).getByTestId("hub-quarantine-outcome").innerText(), "Resolved. Reading the Hub status again…");
  assert.equal(await resolveButton(stale).count(), 0, "a confirmed resolve must not offer Resolve");
  await waitToast("success", "Quarantine resolved");
  // The sentinel's resolve is never answered: its row fails when the production action deadline
  // expires. That expiry proves the deadline passed while the status read was still held.
  await click(sentinel);
  await waitForDom(page, async () => (await outcomeOf(sentinel)) === "failed", { label: "sentinel action deadline expiry", deadlineMs: actionExpiryDeadlineMs });
  assert.match(await row(sentinel).getByTestId("hub-quarantine-outcome").innerText(), /Resolve failed: action_result timeout/);
  assert.equal(await smoke("heldStatusCount"), 1, "the status read is still held after the action deadline");
  assert.equal(await outcomeOf(stale), "refreshing", "the confirmed resolve outlives the action deadline");
  assert.equal(await resolveButton(stale).count(), 0, "Resolve stays withdrawn after the action deadline");
  // The held status read fails: resolved_stale, still listed, still without Resolve.
  await smoke("setHoldStatus", false);
  await smoke("releaseStatus", "error");
  await waitOutcome(stale, "resolved_stale");
  assert.match(await row(stale).getByTestId("hub-quarantine-outcome").innerText(), /Quarantine resolved, but the Hub status could not be read again \(status unavailable\)/);
  assert.equal(await resolveButton(stale).count(), 0, "resolved_stale row must not offer Resolve");
  await waitToast("warning", "The list may be out of date");

  // Overlapping operations on one target. Resolve #1 of overlap is confirmed and its status read
  // is held. The Hub quarantines the target again at a new time; the clean resolve's status read
  // shows that listing, which offers Resolve again. Resolve #2 starts. Then #1's held read fails:
  // #2 must stay pending, and its refusal must show with Resolve offered again.
  await smoke("setHoldStatus", true);
  await click(overlap);
  await release(overlap, "resolved");
  await waitOutcome(overlap, "refreshing");
  assert.equal(await smoke("heldStatusCount"), 1, "resolve #1 status read is held");
  await smoke("setHoldStatus", false);
  await smoke("requarantine", overlap, 1_790_000_600_000);

  // Clean resolve: the refreshed status drops the row (and the stale row, whose resolve landed)
  // and lists overlap again at its new time, without an outcome.
  await click(clean);
  await release(clean, "resolved");
  await waitForDom(page, { locator: row(clean), state: "detached" }, { label: "clean row leaves the list", deadlineMs });
  await waitForDom(page, { locator: row(stale), state: "detached" }, { label: "stale row leaves with the next good status", deadlineMs });
  await waitToast("success", "Quarantine resolved");
  await waitForDom(page, { locator: resolveButton(overlap), state: "actionable" }, { label: "re-quarantined overlap offers Resolve" });
  assert.equal(await outcomeOf(overlap), null, "the new listing has no outcome of resolve #1");

  await click(overlap);
  await smoke("releaseStatus", "error");
  // The late refresh of resolve #1 is handled when its warning toast shows.
  await waitToast("warning", "The list may be out of date");
  assert.equal(await outcomeOf(overlap), "pending", "an old refresh does not settle resolve #2");
  assert.equal(await resolveButton(overlap).innerText(), "Resolving…");
  await release(overlap, "refused");
  await waitOutcome(overlap, "refused");
  assert.match(await row(overlap).getByTestId("hub-quarantine-outcome").innerText(), /Resolve failed: package is still unloading/);
  await waitForDom(page, { locator: resolveButton(overlap), state: "actionable" }, { label: "refused resolve #2 offers Resolve again" });

  // Dispatch failure before any Hub answer: the error is on the row and Resolve is offered again.
  await click(thrown);
  await release(thrown, "throw");
  await waitOutcome(thrown, "failed");
  assert.match(await row(thrown).getByTestId("hub-quarantine-outcome").innerText(), /Resolve failed: control channel closed/);
  await waitForDom(page, { locator: resolveButton(thrown), state: "actionable" }, { label: "failed row offers Resolve again" });

  // Retry after the refusal succeeds.
  await click(refused);
  await release(refused, "resolved");
  await waitForDom(page, { locator: row(refused), state: "detached" }, { label: "retried row leaves the list", deadlineMs });

  const requests = await page.evaluate(() => globalThis.__BOTSTER_QUARANTINE_SMOKE__.requests);
  const resolves = requests.filter((request) => request.type === "resolve_quarantine");
  assert.deepEqual(resolves, [
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.refused" } },
    { type: "resolve_quarantine", target: { kind: "repository_session_types", root: "/work/stale" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.sentinel" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.overlap" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.clean" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.overlap" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.throw" } },
    { type: "resolve_quarantine", target: { kind: "package", package_name: "acme.refused" } }
  ], "the Hub receives only the target");
  // One connect read, then one re-read after each Hub-confirmed resolve (stale, overlap #1,
  // clean, retry).
  assert.equal(requests.filter((request) => request.type === "status").length, 5, "status reads");
  assert.deepEqual(await page.getByTestId("hub-quarantine").evaluateAll((nodes) => nodes.map((node) => node.dataset.quarantineKey)), [thrown, sentinel, overlap]);
  console.log("hub quarantine smoke passed");
} finally {
  await browser?.close();
  await vite?.close();
}
