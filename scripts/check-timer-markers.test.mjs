import assert from "node:assert/strict";
import { scanTimerSource, TIMER_CATEGORIES } from "./check-timer-markers.mjs";

// Timer guard: a timer call needs a known-category marker on its line or the previous line;
// library polling waits are refused outright; only a known, named exception is accepted.
const marker = (category) => `// timer: ${category} — reason`;
for (const category of TIMER_CATEGORIES) {
  assert.deepEqual(scanTimerSource(`${marker(category)}\nsetTimeout(done, 10);`).violations, [], `${category} marker accepted`);
}
assert.deepEqual(scanTimerSource("const t = setTimeout(done, 10); // timer: deadline — same line").violations, []);
const kinds = (source, known) => scanTimerSource(source, known).violations.map((violation) => violation.kind);
assert.deepEqual(kinds("await new Promise((resolve) => setTimeout(resolve, 100));"), ["unmarked-timer"]);
assert.deepEqual(kinds("// timer: deadline — too far\n\nsetTimeout(done, 10);"), ["unmarked-timer"], "the marker must be on the previous line");
assert.deepEqual(kinds("// timer: whenever — unknown category\nsetTimeout(done, 10);"), ["unmarked-timer"]);
assert.deepEqual(kinds("// timer: deadline\nsetTimeout(done, 10);"), ["unmarked-timer"], "a marker needs a reason");
assert.deepEqual(kinds("setInterval(tick, 5);\nawait sleep(25);\nwindow.setTimeout(done, 1);"), ["unmarked-timer", "unmarked-timer", "unmarked-timer"]);
assert.deepEqual(kinds("const realSetTimeout = setTimeout;\nglobalThis.setTimeout = (callback) => callback();"), [], "a capture or a fake definition is not a call");
assert.deepEqual(kinds("const realSetTimeout = setTimeout;\nrealSetTimeout(done, 5);"), ["unmarked-timer"], "a call through a captured timer is a timer call");
assert.deepEqual(kinds("const windowSetTimeout = globalThis.window.setTimeout;\nreturn windowSetTimeout(callback, delay);"), ["unmarked-timer"]);
assert.deepEqual(kinds("const tick = setInterval;\ntick(poll, 10);"), ["unmarked-timer"]);
assert.deepEqual(kinds("const realSetTimeout = setTimeout;\n// timer: deadline — bounds one scenario\nrealSetTimeout(fail, 5);"), [], "a marked alias call is accepted");
for (const polling of [
  "await page.waitForTimeout(500);",
  "await page.waitForFunction(() => true);",
  "await row.waitFor();",
  "await page.waitForURL(/x/);",
  'await page.goto(url, { waitUntil: "networkidle" });',
  "await expect.poll(() => count()).toBe(3);",
  "await expect(async () => check()).toPass();"
]) {
  assert.deepEqual(kinds(polling), ["polling-wait"], polling);
}
const exception = "// timer-exception: app-lifecycle-entity — waits for the entity\nsetTimeout(done, 100);";
assert.deepEqual(scanTimerSource(exception).exceptions, [{ line: 2, id: "app-lifecycle-entity" }]);
assert.deepEqual(kinds(exception, {}), ["unknown-exception"], "an unrecorded exception id is refused");

console.log("timer guard rules passed");
