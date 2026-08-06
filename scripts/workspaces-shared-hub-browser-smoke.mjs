import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertBinaryProvenanceStable,
  assertNoRequiredSmokeSkip,
  assertTwoGenerationLedger
} from "./workspaces-shared-hub-browser-helpers.mjs";

const protocol = "botster-hub-daemon-v1";
const packageRoot = process.cwd();
const hubBinary = requiredPath("BOTSTER_HUB_BIN");
const sessionWorkerBinary = requiredPath("BOTSTER_SESSION_WORKER_BIN");
const workspacesPackagePath = requiredPath("BOTSTER_WORKSPACES_PACKAGE_PATH");

assertNoRequiredSmokeSkip();

const fixtureRoot = await mkdtemp(join(process.platform === "win32" ? tmpdir() : "/tmp", "bwsh-"));
const dataDir = join(fixtureRoot, "hub");
const repository = join(fixtureRoot, "repo");
const socketPath = join(dataDir, "botster-hub.sock");
let hub;
let launchedBinaryProvenance;

try {
  await mkdir(dataDir);
  await createManagedGitFixture(repository);
  const coldAssignment = assignment("cold-1", "cold", "Shared Hub cold", [
    spawnCase("missing-then-reuse", "shared-reuse", {
      expect_created_branch: true,
      expect_created_worktree: true,
      expect_reused_worktree: false
    })
  ]);
  await proveSkipRejection(dataDir, coldAssignment);

  launchedBinaryProvenance = {
    hub: await binaryProvenance(hubBinary),
    session_worker: await binaryProvenance(sessionWorkerBinary)
  };
  hub = spawn(hubBinary, [
    "start", "--data-dir", dataDir, "--session-worker-bin", sessionWorkerBinary
  ], { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] });
  hub.stdout.pipe(process.stdout);
  hub.stderr.pipe(process.stderr);
  await waitForSocket(socketPath, hub);

  await runHub([
    "spawn-targets", "create", "--data-dir", dataDir,
    "--root", repository, "--id", "shared-git", "--label", "Shared Git",
    "--kind", "git", "--base-ref", "main"
  ]);
  await runHub(["packages", "install", "--data-dir", dataDir, "--path", packageRoot]);
  await runHub(["packages", "enable", "--data-dir", dataDir, "botster-web"]);
  await runHub(["packages", "install", "--data-dir", dataDir, "--path", workspacesPackagePath]);
  await runHub(["packages", "enable", "--data-dir", dataDir, "botster-workspaces"]);
  await runHub(["packages", "reload", "--data-dir", dataDir, "botster-workspaces"]);
  const launch = await sendDaemonRequest(socketPath, {
    type: "start_package_entrypoint",
    package_name: "botster-web",
    entrypoint_id: "web-client"
  });
  if (launch.error) throw new Error(`could not launch botster-web/web-client: ${JSON.stringify(launch)}`);

  const cold = await runDriver(coldAssignment);
  const retained = cold.cases[0];
  const reusedAssignment = assignment("reused-2", "reused", "Shared Hub reused", [
    spawnCase("existing-managed-worktree", "shared-reuse", {
      expect_created_branch: false,
      expect_created_worktree: false,
      expect_reused_worktree: true
    }),
    spawnCase("existing-branch-new-worktree", "existing-branch", {
      expect_created_branch: false,
      expect_created_worktree: true,
      expect_reused_worktree: false
    }),
    spawnCase("missing-branch-create", "shared-missing", {
      expect_created_branch: true,
      expect_created_worktree: true,
      expect_reused_worktree: false
    }, { include_optional_values: false })
  ], {
    workspace_id: cold.workspace.workspace_id,
    workspace_name: cold.workspace.workspace_name,
    session_id: retained.session.session_id,
    lifecycle: retained.session.lifecycle
  });
  const reused = await runDriver(reusedAssignment);
  const ledger = assertTwoGenerationLedger([cold, reused]);
  const provenance = await loadProvenance();
  console.log(`workspaces-shared-hub-browser-smoke-summary ${JSON.stringify({
    kind: "workspaces_shared_hub_browser_smoke",
    ledger,
    generations: [cold, reused],
    provenance,
    completed: true
  })}`);
} finally {
  if (hub) {
    await runHub(["shutdown", "--data-dir", dataDir]).catch((error) => {
      if (hub.exitCode === null) throw error;
    });
    if (hub.exitCode === null) {
      await Promise.race([
        once(hub, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5_000))
      ]);
    }
    if (hub.exitCode === null) hub.kill("SIGTERM");
  }
  await rm(fixtureRoot, { recursive: true, force: true });
}

function assignment(generation, entryState, workspaceName, cases, observe) {
  return {
    generation,
    entry_state: entryState,
    workspace_name: workspaceName,
    observe,
    cases
  };
}

function spawnCase(caseId, branch, expectedHubResult, { include_optional_values = true } = {}) {
  const value = {
    case_id: caseId,
    target_id: "shared-git",
    branch,
    // Hub qualifies effective session-type ids as `<source name>/<id>`, and for a repo
    // source the source name is the spawn target id. The fixture repo is admitted as
    // spawn target `shared-git` and seeds session type `shared-browser`, so the value
    // Workspaces renders as the select option is `shared-git/shared-browser`. The bare
    // authored id is not among the rendered options and cannot spawn.
    session_type_id: "shared-git/shared-browser",
    expected_lifecycle: "ended",
    ...expectedHubResult
  };
  if (include_optional_values) {
    value.prompt = `shared-Hub browser ${caseId}`;
    value.ticket_id = caseId;
  }
  return value;
}

async function createManagedGitFixture(repository) {
  await mkdir(join(repository, ".botster"), { recursive: true });
  await mkdir(join(repository, "bin"), { recursive: true });
  const script = join(repository, "bin", "shared-browser-session.sh");
  await writeFile(script, "#!/bin/sh\nprintf 'shared-hub-browser:%s\\n' \"$BOTSTER_SESSION_ID\"\nsleep 3\n");
  await chmod(script, 0o755);
  // Hub reads .botster/session-types.json (REPO_SESSION_TYPES_FILE) and its
  // PackageSessionType requires role, interaction, and lifecycle. The superseded template
  // fixture wrote a file the authoritative Hub never reads, so the admitted repo exposed
  // no `shared-browser` session type at all and this smoke's spawn path was unexercisable.
  await writeFile(join(repository, ".botster", "session-types.json"), JSON.stringify({
    session_types: [{
      id: "shared-browser",
      label: "Shared browser",
      role: "botster.agent",
      interaction: "interactive",
      traits: ["terminal"],
      lifecycle: "task",
      command: "bin/shared-browser-session.sh"
    }]
  }, null, 2));
  await writeFile(join(repository, "README.md"), "shared-Hub browser fixture\n");
  await runProcess("git", ["init", "--initial-branch", "main", repository]);
  await runProcess("git", ["-C", repository, "config", "user.email", "shared-hub-browser@example.invalid"]);
  await runProcess("git", ["-C", repository, "config", "user.name", "Shared Hub Browser"]);
  await runProcess("git", ["-C", repository, "add", "."]);
  await runProcess("git", ["-C", repository, "commit", "-m", "Seed shared Hub browser fixture"]);
  await runProcess("git", ["-C", repository, "branch", "existing-branch"]);
}

async function proveSkipRejection(sharedDataDir, validAssignment) {
  for (const name of ["BOTSTER_LIVE_ALLOW_SURFACE_SKIP", "BOTSTER_LIVE_ALLOW_BROWSER_SKIP"]) {
    const result = await runDriverProcess(validAssignment, { [name]: "1", BOTSTER_LIVE_DATA_DIR: sharedDataDir });
    if (result.code === 0 || !result.output.includes("rejects allow-skip inputs")) {
      throw new Error(`shared-Hub driver did not fail closed for ${name}: ${result.output}`);
    }
  }
}

async function runDriver(assignmentValue) {
  const result = await runDriverProcess(assignmentValue);
  if (result.code !== 0) throw new Error(`shared-Hub browser driver failed: ${result.output}`);
  const line = result.output.split("\n").find((candidate) => candidate.startsWith("workspaces-shared-hub-browser-summary "));
  if (!line) throw new Error(`shared-Hub browser driver omitted structured summary: ${result.output}`);
  return JSON.parse(line.slice("workspaces-shared-hub-browser-summary ".length));
}

async function runDriverProcess(assignmentValue, overrides = {}) {
  const env = { ...process.env };
  for (const name of ["BOTSTER_HUB_BIN", "BOTSTER_SESSION_WORKER_BIN", "BOTSTER_WORKSPACES_PACKAGE_PATH", "BOTSTER_LIVE_WORKSPACES_PACKAGE_PATH"]) {
    delete env[name];
  }
  Object.assign(env, {
    BOTSTER_LIVE_DATA_DIR: dataDir,
    BOTSTER_WORKSPACES_SPAWN_CASES: JSON.stringify(assignmentValue),
    ...overrides
  });
  const child = spawn(process.execPath, ["scripts/workspaces-shared-hub-browser-driver.mjs"], {
    cwd: packageRoot, env, stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  const [code] = await once(child, "exit");
  return { code, output };
}

async function runHub(args) {
  return runProcess(hubBinary, args, { cwd: packageRoot });
}

async function runProcess(command, args, options = {}) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { output += chunk; process.stderr.write(chunk); });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) throw new Error(`${command} ${args.join(" ")} failed (code=${code}, signal=${signal ?? "none"}): ${output}`);
  return output;
}

async function waitForSocket(path, processHandle) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Hub exited before socket readiness (code=${processHandle.exitCode})`);
    const socket = connect(path);
    const connected = await new Promise((resolveConnected) => {
      socket.once("connect", () => { socket.end(); resolveConnected(true); });
      socket.once("error", () => resolveConnected(false));
    });
    if (connected) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for shared Hub socket ${path}`);
}

async function sendDaemonRequest(path, request) {
  const socket = connect(path);
  await once(socket, "connect");
  socket.setEncoding("utf8");
  socket.write(`${JSON.stringify({ protocol })}\n`);
  const hello = JSON.parse(await readSocketLine(socket));
  if (hello.protocol !== protocol) throw new Error("shared-Hub coordinator daemon protocol mismatch");
  socket.write(`${JSON.stringify(request)}\n`);
  const response = JSON.parse(await readSocketLine(socket));
  socket.end();
  return response;
}

async function readSocketLine(socket) {
  return new Promise((resolveLine, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      cleanup();
      resolveLine(buffer.slice(0, newline));
    };
    const onError = (error) => { cleanup(); reject(error); };
    const onEnd = () => { cleanup(); reject(new Error("shared-Hub socket closed before reply")); };
    const cleanup = () => {
      socket.off("data", onData); socket.off("error", onError); socket.off("end", onEnd);
    };
    socket.on("data", onData); socket.on("error", onError); socket.on("end", onEnd);
  });
}

async function loadProvenance() {
  const workspacesManifest = JSON.parse(readFileSync(join(workspacesPackagePath, "botster-package.json"), "utf8"));
  const finalBinaryProvenance = {
    hub: await binaryProvenance(hubBinary),
    session_worker: await binaryProvenance(sessionWorkerBinary)
  };
  const stableBinaryProvenance = assertBinaryProvenanceStable(
    launchedBinaryProvenance,
    finalBinaryProvenance
  );
  return {
    ...stableBinaryProvenance,
    workspaces: {
      path: workspacesPackagePath,
      manifest_version: workspacesManifest.version,
      source_kind: "local_path",
      git_commit: (await runProcess("git", ["-C", workspacesPackagePath, "rev-parse", "HEAD"])).trim()
    },
    web: {
      git_commit: (await runProcess("git", ["rev-parse", "HEAD"], { cwd: packageRoot })).trim(),
      build: "dist"
    }
  };
}

async function binaryProvenance(path) {
  return {
    path,
    sha256: await fileSha256(path),
    source_commit: null,
    source_commit_disposition: "not_verified_without_build_receipt",
    package_version: null,
    package_version_disposition: "not_verified_without_build_receipt"
  };
}

async function fileSha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function requiredPath(name) {
  const value = process.env[name];
  if (!value) throw new Error(`shared-Hub browser smoke requires ${name}`);
  const path = resolve(value);
  if (!existsSync(path)) throw new Error(`${name} does not exist: ${path}`);
  return path;
}
