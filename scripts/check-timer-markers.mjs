/**
 * Timer guard (event-driven rewrite brief): every timer call in production code and tests
 * carries a `// timer: <category> — <reason>` marker on the same or the previous line, and the
 * polling waits of the browser library are not used at all. Vendored third-party code is
 * excluded. Run: node scripts/check-timer-markers.mjs (exit 1 on any violation).
 *
 * Known exceptions are named and counted: a `// timer-exception: <id> — <reason>` marker is
 * accepted only for an id in KNOWN_EXCEPTIONS, and the repository must contain exactly the
 * recorded number of sites for it. Adding a site fails, and so does removing the last ones
 * without removing the exception (README "Known issues").
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TIMER_CATEGORIES = ["deadline", "backoff", "rate-limit", "ui-lifetime", "measurement-window", "os-no-event"];

/**
 * Orchestrator ruling 2026-09-25: the app-lifecycle polls (list_apps, health, HTML shell) wait
 * for the Hub app lifecycle entity. One follow-up commit switches them to it and removes this.
 */
export const KNOWN_EXCEPTIONS = { "app-lifecycle-entity": 5 };

/** A timer call: the global timer functions and the conventional sleep helper. */
const TIMER_CALL = /(?<![\w$.])(?:(?:globalThis|window)\.)?(setTimeout|setInterval|sleep)\s*\(/;
/** Library waits that poll; the shared helpers in scripts/harness-waits.mjs replace them. */
const POLLING_WAIT = /\.(waitForTimeout|waitForFunction|waitForURL)\s*\(|\.waitFor\s*\(|["']networkidle["']/;
const MARKER = new RegExp(`//\\s*timer:\\s*(${TIMER_CATEGORIES.join("|")})\\s+—\\s+\\S`);
const EXCEPTION = /\/\/\s*timer-exception:\s*([\w-]+)\s+—\s+\S/;

/**
 * Returns { violations, exceptions } for `source`. A violation is { line, kind, text }; an
 * exception is { line, id } for a timer that carries a known timer-exception marker.
 */
export function scanTimerSource(source, knownExceptions = KNOWN_EXCEPTIONS) {
  const lines = source.split("\n");
  const violations = [];
  const exceptions = [];
  lines.forEach((text, index) => {
    const code = text.replace(/\/\/.*$/, "");
    if (POLLING_WAIT.test(code)) {
      violations.push({ line: index + 1, kind: "polling-wait", text: text.trim() });
      return;
    }
    if (!TIMER_CALL.test(code)) return;
    const nearby = [text, index > 0 ? lines[index - 1] : ""];
    if (nearby.some((candidate) => MARKER.test(candidate))) return;
    const exception = nearby.map((candidate) => candidate.match(EXCEPTION)).find(Boolean);
    if (exception && Object.hasOwn(knownExceptions, exception[1])) {
      exceptions.push({ line: index + 1, id: exception[1] });
      return;
    }
    violations.push({ line: index + 1, kind: exception ? "unknown-exception" : "unmarked-timer", text: text.trim() });
  });
  return { violations, exceptions };
}

/** Violations only, for one source. */
export function findTimerViolations(source) {
  return scanTimerSource(source).violations;
}

/** Tracked JavaScript and TypeScript sources, without vendored code and this guard's fixtures. */
export function guardedFiles(root) {
  return execFileSync("git", ["ls-files", "*.js", "*.mjs", "*.ts", "*.tsx"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((path) => !path.startsWith("src/vendor/") && !path.startsWith("test-support/"))
    // The guard's own rule tests are its fixtures: they quote timer calls as test input.
    .filter((path) => path !== "scripts/check-timer-markers.test.mjs");
}

export function checkRepository(root, knownExceptions = KNOWN_EXCEPTIONS) {
  const violations = [];
  const exceptionCounts = Object.fromEntries(Object.keys(knownExceptions).map((id) => [id, 0]));
  for (const path of guardedFiles(root)) {
    const scan = scanTimerSource(readFileSync(`${root}/${path}`, "utf8"), knownExceptions);
    for (const violation of scan.violations) violations.push({ path, ...violation });
    for (const exception of scan.exceptions) exceptionCounts[exception.id] += 1;
  }
  for (const [id, expected] of Object.entries(knownExceptions)) {
    if (exceptionCounts[id] !== expected) {
      violations.push({
        path: "scripts/check-timer-markers.mjs",
        line: 0,
        kind: "exception-count",
        text: `known exception ${id} has ${exceptionCounts[id]} sites; recorded ${expected}`
      });
    }
  }
  return violations;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const violations = checkRepository(root);
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.kind}: ${violation.text}`);
  }
  if (violations.length > 0) {
    console.error(`timer guard: ${violations.length} violation(s). Mark each timer with // timer: <${TIMER_CATEGORIES.join("|")}> — <reason>, or replace it with an event.`);
    process.exit(1);
  }
  console.log("timer guard passed");
}
