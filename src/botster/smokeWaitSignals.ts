import { ResttyWasm } from "../vendor/restty/internal.js";

/**
 * Wake signals for the browser smoke drivers' waits (scripts/harness-waits.mjs). A smoke
 * driver re-checks its condition only when the page reports a change, so each fixture reports
 * the changes its conditions read. Without the page support installed, these do nothing.
 */
type HarnessWaits = { observe<L>(log: L): L; notify(): void };

function harnessWaits(): HarnessWaits | undefined {
  return (globalThis as typeof globalThis & { __botsterWaits?: HarnessWaits }).__botsterWaits;
}

/** Every push to the returned log wakes the waits. */
export function observeLog<T>(log: T[]): T[] {
  return harnessWaits()?.observe(log) ?? log;
}

export function notifyWaits(): void {
  harnessWaits()?.notify();
}

// create: Restty sets wasmReady and its handle in the same task, so the terminal is ready then.
const resttyChangeMethods = ["create", "write", "writeBytes", "resize", "loadBinarySnapshot"] as const;
let resttySignalsInstalled = false;

/**
 * The Restty screen and grid change only in these calls; Restty updates its render state in the
 * same task, so a wake after the call sees the new state. The render loop's per-frame
 * renderUpdate is not a change and does not wake the waits.
 */
export function signalResttyChanges(): void {
  if (resttySignalsInstalled) return;
  resttySignalsInstalled = true;
  const prototype = ResttyWasm.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const name of resttyChangeMethods) {
    const original = prototype[name];
    prototype[name] = function signalledResttyChange(this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      notifyWaits();
      return result;
    };
  }
}
