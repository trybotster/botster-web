/**
 * Receiver-only proof for the production session script's exact paste receiver.
 *
 * Runs the exact generated session script (productionSessionScriptSource) under a real PTY
 * through script(1), with no Hub, no browser, and no build. Every case parses complete
 * lines with the same patterns the live harness uses. The proof group stops at the first
 * unexpected failure, preserves its transcript and results, and tears down only the
 * processes it owns: the script(1) PTY supervisor, the session shell, and the reader,
 * watchdog, and sleep descendants it snapshots while a receive is active.
 *
 * Evidence: <dir>/session-script.sh, transcript.bin, results.json, proof.log, SHA256SUMS,
 * where <dir> defaults to node_modules/.botster-foundation-evidence/web-paste/receiver-proof.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  matchCompleteLine,
  productionSessionScriptSource,
  RECEIVER_MAX_WIRE_BYTES,
  receiverErrorPattern,
  receiverReadyOrErrorPattern,
  receiverReceiptPattern
} from "./live-packaged-protocol-helpers.mjs";

const SUPERVISOR_MS = 150_000;
const IDLE_RECEIPT_BOUND_MS = 20_000;
const WALL_CLOCK_RECEIPT_BOUND_MS = 45_000;
const evidenceDir = resolve(
  process.cwd(),
  process.env.BOTSTER_RECEIVER_PROOF_DIR ?? "node_modules/.botster-foundation-evidence/web-paste/receiver-proof"
);
const scriptPath = join(evidenceDir, "session-script.sh");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escapeText = (text) => JSON.stringify(text);

const logLines = [];
function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  logLines.push(line);
  console.log(line);
}

const results = { started_at: new Date().toISOString(), cases: [], owned_pids: [], failure: null };
const ownedPids = new Set();
let child;
let childExit;
let transcript = Buffer.alloc(0);
let text = "";

function childPidsOf(pid) {
  try {
    return execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" })
      .split("\n")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
}

function descendantsOf(pid) {
  const found = [];
  const queue = [pid];
  while (queue.length > 0) {
    const next = queue.shift();
    for (const kid of childPidsOf(next)) {
      found.push(kid);
      queue.push(kid);
    }
  }
  return found;
}

function commandOf(pid) {
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForLine(since, pattern, boundMs, label) {
  const startedAt = Date.now();
  for (;;) {
    const match = matchCompleteLine(text.slice(since), pattern);
    if (match) return { match, elapsedMs: Date.now() - startedAt };
    if (childExit !== undefined) {
      throw new Error(`${label}: session shell exited (${JSON.stringify(childExit)}) before /${pattern.source}/; tail=${escapeText(text.slice(-300))}`);
    }
    if (Date.now() - startedAt > boundMs) {
      throw new Error(`${label}: /${pattern.source}/ not observed within ${boundMs} ms; tail=${escapeText(text.slice(-300))}`);
    }
    await sleep(25);
  }
}

function send(bytes) {
  const buffer = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : bytes;
  child.stdin.write(buffer);
}

async function askLine(command, pattern, label, boundMs = 10_000) {
  const since = text.length;
  send(`${command}\n`);
  return waitForLine(since, pattern, boundMs, label);
}

async function readTtyState(label) {
  const { match } = await askLine("botster-web-production-tty", /botster-web-production-tty:(\S+)\r?\n/, `${label} tty state`);
  return match[1];
}

async function waitForAllDead(pids, boundMs) {
  const startedAt = Date.now();
  for (;;) {
    const alive = pids.filter(isAlive);
    if (alive.length === 0) return [];
    if (Date.now() - startedAt > boundMs) return alive;
    await sleep(50);
  }
}

function recordCase(entry) {
  results.cases.push(entry);
  log(`case ${entry.name}: ${entry.ok ? "ok" : "FAILED"} ${JSON.stringify({ ...entry, name: undefined, ok: undefined })}`);
}

/**
 * Arms the receiver for wireLength, snapshots the descendants that appear while it is armed
 * (reader, watchdog, sleep), delivers the bytes through `deliver`, and returns the parsed
 * receipt with timing and process observations.
 */
async function receive({ label, wireLength, deliver, receiptBoundMs, shPid }) {
  const readySince = text.length;
  send(`botster-web-production-receive:${wireLength}\n`);
  const ready = await waitForLine(readySince, receiverReadyOrErrorPattern(wireLength), 10_000, `${label} ready`);
  if (ready.match[1] !== undefined) {
    throw new Error(`${label}: receiver failed closed: ${ready.match[1]}${ready.match[2] !== undefined ? `:${ready.match[2]}` : ""}`);
  }
  // Ready is printed after the reader and watchdog start. The watchdog forks its sleep child a
  // moment later, so snapshot twice and keep the union.
  const armedPids = new Set(descendantsOf(shPid));
  await sleep(200);
  for (const pid of descendantsOf(shPid)) armedPids.add(pid);
  const armed = [...armedPids].map((pid) => ({ pid, command: commandOf(pid) }));
  for (const entry of armed) ownedPids.add(entry.pid);
  const receiptSince = text.length;
  const startedAt = Date.now();
  await deliver();
  const receipt = await waitForLine(receiptSince, receiverReceiptPattern(wireLength), receiptBoundMs, `${label} receipt`);
  const survivors = await waitForAllDead(armed.map((entry) => entry.pid), 5_000);
  const remaining = descendantsOf(shPid);
  return {
    count: Number.parseInt(receipt.match[1], 10),
    digest: receipt.match[2],
    elapsedMs: Date.now() - startedAt,
    armedProcesses: armed,
    survivors,
    remainingDescendants: remaining,
    receiptStart: receiptSince,
    receiptEnd: receiptSince + receipt.match.index + receipt.match[0].length
  };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const scriptSource = productionSessionScriptSource();
  await writeFile(scriptPath, scriptSource);
  results.session_script_sha256 = sha256(scriptSource);
  log(`session script written to ${scriptPath} (${scriptSource.length} bytes, sha256 ${results.session_script_sha256})`);

  // Node's "pipe" stdio is a Unix socket, and macOS script(1) fails its terminal ioctl on a
  // socket. Two cat processes give script(1) real pipes on both ends. The wrapper shell, both
  // cats, and script(1) itself are owned processes.
  child = spawn("sh", ["-c", 'cat | /usr/bin/script -q -F /dev/null sh "$1" | cat', "sh", scriptPath], {
    cwd: evidenceDir,
    stdio: ["pipe", "pipe", "pipe"]
  });
  ownedPids.add(child.pid);
  child.stdout.on("data", (chunk) => {
    transcript = Buffer.concat([transcript, chunk]);
    text += chunk.toString("latin1");
  });
  child.stderr.on("data", (chunk) => log(`script(1) stderr: ${escapeText(chunk.toString("latin1"))}`));
  child.on("exit", (code, signal) => {
    childExit = { code, signal };
    log(`script(1) exited ${JSON.stringify(childExit)}`);
  });

  await waitForLine(0, /botster-web-production-ready\r?\n/, 10_000, "session ready");
  const pidLine = await askLine("botster-web-production-pid", /botster-web-production-pid:(\d+)\r?\n/, "session pid");
  const shPid = Number.parseInt(pidLine.match[1], 10);
  ownedPids.add(shPid);
  for (const pid of descendantsOf(child.pid)) ownedPids.add(pid);
  results.wrapper_processes = descendantsOf(child.pid).map((pid) => ({ pid, command: commandOf(pid) }));
  results.script_pid = child.pid;
  results.shell_pid = shPid;
  const baselineTty = await readTtyState("baseline");
  results.baseline_tty = baselineTty;
  log(`session shell pid ${shPid}; baseline stty -g ${baselineTty}`);

  // a. Normal input: CR, LF, both bracket markers, 0x03, and every byte value 0x01-0xFF.
  {
    const parts = [Buffer.from("[200~", "latin1"), Buffer.from("line1\r\nline2\r\n", "latin1")];
    const cycle = Buffer.alloc(255);
    for (let index = 0; index < 255; index += 1) cycle[index] = index + 1;
    for (let repeat = 0; repeat < 15; repeat += 1) parts.push(cycle);
    parts.push(Buffer.from("[201~", "latin1"));
    const payload = Buffer.concat(parts);
    const outcome = await receive({
      label: "normal",
      wireLength: payload.length,
      deliver: async () => send(payload),
      receiptBoundMs: IDLE_RECEIPT_BOUND_MS,
      shPid
    });
    const ttyAfter = await readTtyState("normal");
    const echo = await askLine("hello-after-normal", /botster-web-production-echo:hello-after-normal\r?\n/, "normal echo after receive");
    const entry = {
      name: "normal",
      wire_bytes: payload.length,
      wire_sha256: sha256(payload),
      received_count: outcome.count,
      received_sha256: outcome.digest,
      elapsed_ms: outcome.elapsedMs,
      armed_processes: outcome.armedProcesses,
      survivors: outcome.survivors,
      remaining_descendants: outcome.remainingDescendants,
      tty_equal: ttyAfter === baselineTty,
      echo_after_ms: echo.elapsedMs,
      receipt_region: [outcome.receiptStart, outcome.receiptEnd]
    };
    entry.ok =
      outcome.count === payload.length &&
      outcome.digest === sha256(payload) &&
      outcome.survivors.length === 0 &&
      outcome.remainingDescendants.length === 0 &&
      outcome.armedProcesses.length >= 2 &&
      entry.tty_equal;
    recordCase(entry);
    expect(entry.ok, "normal receive failed");
    results.normal_receipt_region = entry.receipt_region;
  }

  // b. Fragmented receipt: feed the captured receipt bytes to the shared parser in 1-byte and
  //    7-byte chunks; the pattern must not match before the terminator arrives.
  {
    const [start, end] = results.normal_receipt_region;
    const region = text.slice(start, end);
    const terminatorIndex = region.length; // the pattern includes the terminator, so a match needs the whole region
    const pattern = receiverReceiptPattern(results.cases[0].wire_bytes);
    const check = (chunkSize) => {
      let fed = "";
      let firstMatchAt = null;
      for (let offset = 0; offset < region.length; offset += chunkSize) {
        fed += region.slice(offset, offset + chunkSize);
        if (matchCompleteLine(fed, pattern)) {
          firstMatchAt = fed.length;
          break;
        }
      }
      return firstMatchAt;
    };
    const oneByte = check(1);
    const sevenByte = check(7);
    const entry = {
      name: "fragmented-receipt",
      region_length: region.length,
      first_match_at_1_byte_chunks: oneByte,
      first_match_at_7_byte_chunks: sevenByte,
      terminator_index: terminatorIndex
    };
    entry.ok = oneByte === terminatorIndex && sevenByte !== null && sevenByte >= terminatorIndex && sevenByte < terminatorIndex + 7;
    recordCase(entry);
    expect(entry.ok, "fragmented receipt parsing failed");
  }

  // c. Idle timeout: announce 4096, deliver 100 bytes, deliver nothing more.
  {
    const partial = Buffer.alloc(100, "y".charCodeAt(0));
    const outcome = await receive({
      label: "idle-timeout",
      wireLength: 4096,
      deliver: async () => send(partial),
      receiptBoundMs: IDLE_RECEIPT_BOUND_MS,
      shPid
    });
    const ttyAfter = await readTtyState("idle-timeout");
    const entry = {
      name: "idle-timeout",
      announced: 4096,
      delivered: partial.length,
      received_count: outcome.count,
      received_sha256: outcome.digest,
      expected_sha256: sha256(partial),
      elapsed_ms: outcome.elapsedMs,
      survivors: outcome.survivors,
      remaining_descendants: outcome.remainingDescendants,
      tty_equal: ttyAfter === baselineTty
    };
    entry.ok =
      outcome.count === partial.length &&
      outcome.digest === sha256(partial) &&
      outcome.elapsedMs >= 9_000 &&
      outcome.elapsedMs <= 15_000 &&
      outcome.survivors.length === 0 &&
      outcome.remainingDescendants.length === 0 &&
      entry.tty_equal;
    recordCase(entry);
    expect(entry.ok, "idle timeout receive failed");
  }

  // f. Fail closed: zero, non-digit, above bound, and an oversized digit string. No ready line.
  {
    const inputs = [
      { value: "0", kind: "bounds" },
      { value: "abc", kind: "invalid" },
      { value: String(RECEIVER_MAX_WIRE_BYTES + 1), kind: "bounds" },
      { value: "99999999999999999999", kind: "width" }
    ];
    const observed = [];
    for (const input of inputs) {
      const since = text.length;
      send(`botster-web-production-receive:${input.value}\n`);
      const { match } = await waitForLine(since, receiverErrorPattern, 10_000, `fail-closed ${input.value}`);
      const readySeen = /botster-web-production-receive-ready:/.test(text.slice(since));
      observed.push({ value: input.value, expected_kind: input.kind, kind: match[1], number: match[2] ?? null, ready_seen: readySeen });
    }
    const echo = await askLine("still-alive", /botster-web-production-echo:still-alive\r?\n/, "fail-closed echo");
    const ttyAfter = await readTtyState("fail-closed");
    const entry = {
      name: "fail-closed",
      observed,
      echo_after_ms: echo.elapsedMs,
      tty_equal: ttyAfter === baselineTty,
      descendants: descendantsOf(shPid)
    };
    entry.ok = observed.every((item) => item.kind === item.expected_kind && !item.ready_seen) && entry.tty_equal && entry.descendants.length === 0;
    recordCase(entry);
    expect(entry.ok, "fail-closed inputs did not fail closed");
  }

  // d. Wall-clock timeout: trickle one byte every 5 s so the idle bound never fires.
  {
    let ticks = 0;
    let timer;
    const outcome = await receive({
      label: "wall-clock-timeout",
      wireLength: 4096,
      deliver: async () => {
        send("z");
        ticks = 1;
        timer = setInterval(() => {
          send("z");
          ticks += 1;
        }, 5_000);
      },
      receiptBoundMs: WALL_CLOCK_RECEIPT_BOUND_MS,
      shPid
    });
    clearInterval(timer);
    // Bytes trickled after the reader stopped sit in the line reader; flush them as one line.
    const flush = await askLine("", /botster-web-production-echo:z*\r?\n/, "wall-clock flush");
    const ttyAfter = await readTtyState("wall-clock-timeout");
    const entry = {
      name: "wall-clock-timeout",
      announced: 4096,
      ticks_sent: ticks,
      received_count: outcome.count,
      received_sha256: outcome.digest,
      expected_sha256_for_count: sha256(Buffer.alloc(outcome.count, "z".charCodeAt(0))),
      elapsed_ms: outcome.elapsedMs,
      armed_processes: outcome.armedProcesses,
      survivors: outcome.survivors,
      remaining_descendants: outcome.remainingDescendants,
      flushed_line_ms: flush.elapsedMs,
      tty_equal: ttyAfter === baselineTty
    };
    entry.ok =
      outcome.count >= 5 &&
      outcome.count <= 7 &&
      outcome.digest === entry.expected_sha256_for_count &&
      // The watchdog starts before the ready line and the 200 ms snapshot delay, so the
      // receipt arrives a little under 30 s after delivery starts.
      outcome.elapsedMs >= 27_000 &&
      outcome.elapsedMs <= 36_000 &&
      outcome.survivors.length === 0 &&
      outcome.remainingDescendants.length === 0 &&
      entry.tty_equal;
    recordCase(entry);
    expect(entry.ok, "wall-clock timeout receive failed");
  }

  // e. Cleanup on signal: arm a receive, snapshot descendants, TERM the session shell.
  {
    const readySince = text.length;
    send("botster-web-production-receive:4096\n");
    await waitForLine(readySince, receiverReadyOrErrorPattern(4096), 10_000, "signal-cleanup ready");
    const armedPids = new Set(descendantsOf(shPid));
    await sleep(200);
    for (const pid of descendantsOf(shPid)) armedPids.add(pid);
    const armed = [...armedPids].map((pid) => ({ pid, command: commandOf(pid) }));
    for (const entry of armed) ownedPids.add(entry.pid);
    const receiveFile = join(evidenceDir, `botster-web-production-receive.${shPid}`);
    const fileExistedWhileArmed = existsSync(receiveFile);
    process.kill(shPid, "SIGTERM");
    const killedAt = Date.now();
    // The session shell's TERM trap must stop the reader and watchdog, remove the file, and
    // exit. script(1) itself stays alive until its stdin closes, so the wrapper's exit is
    // informational only; the shell's death and its descendants' deaths are the assertion.
    const survivors = await waitForAllDead([shPid, ...armed.map((entry) => entry.pid)], 10_000);
    const shellDeadAfterMs = Date.now() - killedAt;
    const entry = {
      name: "signal-cleanup",
      armed_processes: armed,
      file_existed_while_armed: fileExistedWhileArmed,
      file_exists_after: existsSync(receiveFile),
      shell_dead: !isAlive(shPid),
      shell_dead_after_ms: shellDeadAfterMs,
      wrapper_exit_informational: childExit ?? null,
      survivors
    };
    entry.ok =
      armed.length >= 2 &&
      fileExistedWhileArmed &&
      !entry.file_exists_after &&
      entry.shell_dead &&
      survivors.length === 0;
    recordCase(entry);
    expect(entry.ok, "signal cleanup failed");
  }
}

async function teardown() {
  if (child && childExit === undefined) {
    try { child.stdin.end(); } catch { /* ignored */ }
  }
  const deadline = Date.now() + 5_000;
  while (child && childExit === undefined && Date.now() < deadline) await sleep(50);
  const owned = [...ownedPids];
  const aliveBefore = owned.filter(isAlive);
  for (const pid of aliveBefore) {
    try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
  }
  const aliveAfter = await waitForAllDead(aliveBefore, 3_000);
  results.owned_pids = owned;
  results.owned_alive_at_teardown = aliveBefore;
  results.owned_survivors_after_teardown = aliveAfter;
  results.finished_at = new Date().toISOString();
  await writeFile(join(evidenceDir, "transcript.bin"), transcript);
  await writeFile(join(evidenceDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(join(evidenceDir, "proof.log"), `${logLines.join("\n")}\n`);
  const names = ["session-script.sh", "transcript.bin", "results.json", "proof.log"];
  const sums = [];
  for (const name of names) sums.push(`${sha256(await readFile(join(evidenceDir, name)))}  ${name}`);
  await writeFile(join(evidenceDir, "SHA256SUMS"), `${sums.join("\n")}\n`);
  log(`evidence written under ${evidenceDir}`);
  return aliveAfter;
}

const supervisor = setTimeout(() => {
  results.failure = `supervisor bound ${SUPERVISOR_MS} ms exceeded`;
  log(results.failure);
  teardown().finally(() => process.exit(2));
}, SUPERVISOR_MS);

try {
  await main();
  results.ok = results.cases.every((entry) => entry.ok);
} catch (error) {
  results.ok = false;
  results.failure = error instanceof Error ? error.message : String(error);
  log(`FAILED: ${results.failure}`);
} finally {
  clearTimeout(supervisor);
  const survivors = await teardown();
  if (survivors.length > 0) {
    log(`owned processes survived teardown: ${JSON.stringify(survivors)}`);
    results.ok = false;
  }
  log(`receiver proof ${results.ok ? "passed" : "FAILED"}: ${results.cases.length} cases`);
  process.exit(results.ok ? 0 : 1);
}
