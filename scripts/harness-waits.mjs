/**
 * The two shared browser-harness waits. Neither polls:
 *
 * - waitForHarnessEvent re-checks its condition only when the page harness records an entry
 *   (every push to an observed harness log notifies the page's own listeners).
 * - waitForDom re-checks its condition only on a DOM mutation, a navigation, a focus change,
 *   or a recorded harness entry.
 *
 * Each wait checks once at once, so a condition that is already true resolves without an
 * event, and subscribes before that check, so no event between the check and the
 * subscription is missed. Each has exactly one outer deadline.
 */

import { harnessEventMatches } from "./live-packaged-protocol-helpers.mjs";

/**
 * Page-side support, installed with addInitScript before any page script runs. It must be
 * self-contained: Playwright serializes it into the page.
 */
export function installHarnessWaitSupport() {
  if (globalThis.__botsterWaits) return;
  const listeners = new Set();
  let scheduled = false;
  // Page state version: bumped by every DOM mutation (document and every shadow root), history
  // navigation, focus change, and recorded harness entry. DOM waiters resolve once the version
  // passes the one they read.
  let domVersion = 0;
  const domWaiters = new Set();
  const bumpDom = () => {
    domVersion += 1;
    for (const waiter of [...domWaiters]) waiter();
  };
  // Coalesce a burst of pushes into one re-check per listener: a microtask is an ordering
  // boundary after the pushes already in progress, not a timer.
  const notify = () => {
    // A recorded harness entry is also a page state change for waitForDom.
    bumpDom();
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      for (const listener of [...listeners]) listener();
    });
  };
  const observe = (log) => {
    if (!log || typeof log.push !== "function" || log.__botsterObserved) return log;
    const push = log.push;
    Object.defineProperty(log, "push", {
      configurable: true,
      enumerable: false,
      writable: true,
      value(...entries) {
        const result = push.apply(this, entries);
        notify();
        return result;
      }
    });
    Object.defineProperty(log, "__botsterObserved", { enumerable: false, value: true });
    return log;
  };
  const domObserver = new globalThis.MutationObserver(bumpDom);
  const observeRoot = (root) => domObserver.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  observeRoot(globalThis.document);
  const attachShadow = globalThis.Element.prototype.attachShadow;
  globalThis.Element.prototype.attachShadow = function attachObservedShadow(init) {
    const shadowRoot = attachShadow.call(this, init);
    observeRoot(shadowRoot);
    return shadowRoot;
  };
  for (const method of ["pushState", "replaceState"]) {
    const original = globalThis.history[method];
    globalThis.history[method] = function observedHistoryChange(...args) {
      const result = original.apply(this, args);
      bumpDom();
      return result;
    };
  }
  globalThis.addEventListener("popstate", bumpDom);
  globalThis.addEventListener("hashchange", bumpDom);
  globalThis.document.addEventListener("focusin", bumpDom, true);
  globalThis.document.addEventListener("focusout", bumpDom, true);
  globalThis.__botsterWaits = {
    observe,
    notify,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    domVersion: () => domVersion,
    /** Resolves true once the DOM version passes `version`, or false when `release` is called. */
    domChangedSince(version, token) {
      if (domVersion > version) return Promise.resolve(true);
      return new Promise((resolve) => {
        const waiter = () => {
          if (domVersion <= version) return;
          domWaiters.delete(waiter);
          resolve(true);
        };
        waiter.release = () => {
          domWaiters.delete(waiter);
          resolve(false);
        };
        waiter.token = token;
        domWaiters.add(waiter);
      });
    },
    releaseDomWaiters(token) {
      for (const waiter of [...domWaiters]) if (waiter.token === token) waiter.release();
    }
  };
}

export const harnessWaitSupportScript = `(${installHarnessWaitSupport.toString()})();`;

function predicateSource(condition) {
  if (typeof condition === "function") return condition.toString();
  throw new TypeError("a harness wait condition must be a function");
}

/**
 * Wait until `condition(arg)` returns a truthy, serializable value in the page, re-checking on
 * each recorded harness entry. `condition` may also be a criteria object, which matches any
 * entry of `harness.events` from `sinceIndex` on. Returns the condition's value.
 */
export async function waitForHarnessEvent(page, condition, arg, { label, deadlineMs = 45_000, sinceIndex = 0 } = {}) {
  const criteria = typeof condition === "function" ? undefined : condition;
  const source = criteria
    ? `((matches) => ({ criteria, sinceIndex }) =>
        (globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.events ?? []).slice(sinceIndex)
          .find((entry) => matches(entry, criteria)) ?? false)(${harnessEventMatches.toString()})`
    : predicateSource(condition);
  const waitArg = criteria ? { criteria, sinceIndex } : arg;
  return page.evaluate(
    ({ source: conditionSource, waitArg: value, waitLabel, deadline }) =>
      new Promise((resolve, reject) => {
        const waits = globalThis.__botsterWaits;
        if (!waits) {
          reject(new Error(`harness wait support is not installed (${waitLabel})`));
          return;
        }
        // Indirect eval builds the serialized condition in the page's global scope.
        const check = (0, eval)(conditionSource);
        let stop = () => undefined;
        let timer;
        const finish = () => {
          stop();
          clearTimeout(timer);
        };
        const evaluate = () => {
          let result;
          try {
            result = check(value);
          } catch (error) {
            finish();
            reject(error);
            return;
          }
          if (result) {
            finish();
            resolve(result);
          }
        };
        stop = waits.onChange(evaluate);
        // timer: deadline — bounds one harness wait; expiry fails the wait with its label.
        timer = setTimeout(() => {
          finish();
          reject(new Error(`timed out after ${deadline} ms waiting for ${waitLabel}`));
        }, deadline);
        evaluate();
      }),
    { source, waitArg, waitLabel: label ?? "harness event", deadline: deadlineMs }
  );
}

/**
 * Wait until `check` holds, re-checking only after the page's DOM changes. `check` is one of:
 * - an async function that uses only non-waiting queries (locator.isVisible(), count(),
 *   page.evaluate) and returns a truthy value when the condition holds;
 * - a Locator, which must become visible;
 * - `{ locator, state }` with state "visible", "actionable" (visible and enabled), "hidden",
 *   "attached", or "detached".
 * Returns the check's value. Playwright actions on the target come after this wait, so their
 * own auto-wait is never the synchronization.
 */
export async function waitForDom(page, check, { label, deadlineMs = 15_000 } = {}) {
  const condition = domCondition(check);
  // A locator carries its own page; its DOM changes are the ones to wait on.
  const target = typeof check === "function" ? undefined : check?.locator ?? check;
  if (typeof target?.page === "function") page = target.page();
  const token = `wait-${(waitTokens += 1)}`;
  let timer;
  const expired = new Promise((_, reject) => {
    // timer: deadline — bounds one DOM wait; expiry fails the wait with its label.
    timer = setTimeout(
      () => reject(new Error(`timed out after ${deadlineMs} ms waiting for ${label ?? "DOM condition"}`)),
      deadlineMs
    );
  });
  try {
    for (;;) {
      // Read the version before the check: a change during the check moves it on.
      const version = await Promise.race([page.evaluate(() => globalThis.__botsterWaits.domVersion()), expired]);
      const result = await Promise.race([condition(), expired]);
      if (result) return result;
      await Promise.race([
        page.evaluate(([since, id]) => globalThis.__botsterWaits.domChangedSince(since, id), [version, token]),
        expired
      ]);
    }
  } finally {
    clearTimeout(timer);
    await page.evaluate((id) => globalThis.__botsterWaits?.releaseDomWaiters(id), token).catch(() => undefined);
  }
}

let waitTokens = 0;

function domCondition(check) {
  if (typeof check === "function") return check;
  const { locator, state = "visible" } = typeof check?.isVisible === "function" ? { locator: check } : check ?? {};
  if (!locator) throw new TypeError("waitForDom needs a function, a Locator, or { locator, state }");
  if (state === "visible") return () => locator.first().isVisible();
  // Before a Playwright action: the target is visible and enabled, so the action's own
  // auto-wait never synchronizes anything.
  if (state === "actionable") return async () => (await locator.first().isVisible()) && locator.first().isEnabled();
  if (state === "hidden") return async () => !(await locator.first().isVisible());
  if (state === "attached") return async () => (await locator.count()) > 0;
  if (state === "detached") return async () => (await locator.count()) === 0;
  throw new TypeError(`waitForDom state ${state} is not supported`);
}
