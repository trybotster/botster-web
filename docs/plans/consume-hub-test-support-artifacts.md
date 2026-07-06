---
description: Plan for consuming botster-hub test-support artifacts in botster-web test and live smoke harnesses
---

# Consume botster-hub test-support artifacts

## Context Loaded

- Ticket: `ticket_1783308847_124919`, "Consume botster-hub test-support artifacts instead of sibling checkout paths".
- Run: `run_1783310736_492947`, step `botster_plan`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, worktree `/Users/jasonconigliari/botster-sessions/git@github.com:trybotster-botster-web-project-pipelines-ticket_1783308847_124919`.
- Dependency: closed ticket `ticket_1783308847_286503`, "Publish reusable plugin contract matrix test assets from botster-hub-test-support".
- Pipeline context had no prior artifacts, findings, reviews, questions, or answers for this run.
- Playbooks and vault notes loaded: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo inspection found the current default protocol artifact path in `scripts/check-daemon-protocol-drift.mjs` points at `../botster-hub/crates/botster-hub-client/generated/daemon-protocol.ts`.
- Repo inspection found contract matrix fixture lookup in `scripts/live-packaged-protocol-harness.mjs` accepts `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH` or derives `fixtures/plugins/plugin-contract-matrix` from `BOTSTER_HUB_SOURCE_DIR`.
- Baseline verification: `npm test` currently fails before app tests because the authoritative protocol artifact is missing and the diagnostic instructs users to set `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` or check out `../botster-hub`. `node src/App.test.mjs` passes.

## Botster Layers Touched

- `botster-web` test and smoke harness scripts.
- Generated daemon protocol drift-check plumbing for the hub-client boundary.
- Live packaged protocol harness setup for hub-owned plugin fixture installation.
- README/docs for local override behavior and normal artifact-backed test paths.

No Rust hub, TUI, Lua plugin runtime, Rails relay, production browser transport, or generated DTO schema changes are planned unless the declared artifact proves the checked-in generated protocol is stale.

## Scope

1. Introduce a small local artifact resolver for hub test-support assets, or equivalent narrow helpers inside the existing scripts, that resolves the declared hub test-support dependency before any sibling checkout path.
2. Keep existing environment variables as explicit overrides:
   - `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL`
   - `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH`
   - `BOTSTER_HUB_SOURCE_DIR`, only if retained as a local development fallback and not the normal path.
3. Update `scripts/check-daemon-protocol-drift.mjs` so the normal path reads the authoritative daemon protocol artifact from the declared hub test-support dependency/artifact.
4. Update `scripts/live-packaged-protocol-harness.mjs` so `smoke:plugin-contract-matrix` installs the contract matrix fixture from the declared test-support artifact when no explicit local override is supplied.
5. Replace diagnostics that tell users to check out `../botster-hub` with diagnostics naming the declared artifact and the override variables.
6. Update README smoke/test instructions to describe the artifact-backed default path and env-var override path.
7. Add focused deterministic tests in `src/App.test.mjs` or a small Node test module for resolver priority and missing-artifact diagnostics.

## Non-Scope

- Do not add a new package manager, build step, or broad dependency strategy.
- Do not make Project Pipelines worktree paths or `../trybotster-botster-hub-project-pipelines-*` paths part of the normal resolver.
- Do not edit botster-hub, botster-core, session-worker, TUI, or plugin fixture source in this repo.
- Do not change runtime browser behavior, app routes, entity rendering, package lifecycle semantics, or daemon DTO fields unless a real protocol drift check reports a mismatch.
- Do not hand-maintain generated protocol fields.

## Assumptions And Unknowns

- Assumption: the closed dependency publishes a stable test-support artifact that can be installed or otherwise made available inside `botster-web` without a sibling checkout.
- Assumption: that artifact contains at least:
  - the generated `botster-hub-client` daemon protocol TypeScript artifact;
  - the `botster.plugin-contract-matrix` package fixture directory or an installable/copyable equivalent.
- Unknown: the exact artifact coordinate, package name, directory layout, and whether it appears under `node_modules`, a tarball path, or another pipeline artifact path. The implementer must inspect the closed dependency's published artifact before choosing resolver paths. If the artifact is not present in this run or install context, ask a human or block with a precise missing-artifact question.
- Unknown: whether `package.json` / `package-lock.json` should gain a declared dependency on the artifact package. If the artifact is distributed as an npm package, prefer a normal dev dependency over ad hoc path scanning.
- Assumption: env vars remain higher priority than installed artifacts because they are explicit local overrides for development and CI debugging.
- Worktree/target assumption: all edits and verification run in this assigned botster-web worktree and target, not a sibling hub worktree.

## Affected Surfaces And Files

- `scripts/check-daemon-protocol-drift.mjs`: replace sibling default lookup with artifact-backed lookup; improve missing/stale diagnostics.
- `scripts/live-packaged-protocol-harness.mjs`: resolve contract matrix package fixture from artifact-backed lookup before local source-dir fallback.
- `src/App.test.mjs` or a new script test: assert resolver priority and diagnostics without requiring a live hub.
- `package.json` / `package-lock.json`: only if the hub test-support artifact is an npm dependency.
- `README.md`: update test and smoke instructions.
- `docs/plans/consume-hub-test-support-artifacts.md`: this handoff artifact.

## Risks

- The dependency ticket is closed but no artifact is attached to this pipeline context; choosing a guessed coordinate would recreate path fragility under a different name.
- If the artifact layout is copied as raw string paths in multiple scripts, later hub artifact reshaping will break tests in two places. Keep resolution centralized but small.
- If missing-artifact behavior falls back silently to sibling checkout, CI can keep passing while the normal test path remains broken.
- If diagnostics are too generic, developers will not know whether they need to install dependencies, refresh the artifact, or set an explicit override.
- If a generated protocol artifact is refreshed by hand instead of copied from the hub artifact, the change can hide DTO drift.

## Acceptance Checks And Tests

1. `npm test` passes in a checkout without `../botster-hub` when the declared hub test-support artifact is installed/available.
2. `node scripts/check-daemon-protocol-drift.mjs` compares against the artifact-backed daemon protocol by default and fails with a clear missing-artifact diagnostic when the artifact is absent.
3. `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<explicit path> node scripts/check-daemon-protocol-drift.mjs` still works as a local override.
4. `npm run smoke:plugin-contract-matrix` can locate/install the contract matrix fixture through the declared artifact when no `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH` or `BOTSTER_HUB_SOURCE_DIR` is set.
5. `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH=<explicit fixture path> npm run smoke:plugin-contract-matrix` still works as a local override.
6. Deterministic tests cover resolver priority and missing-artifact diagnostics without requiring a live hub.
7. Existing deterministic checks stay green: `node src/App.test.mjs`, `npm run typecheck`, and `npm run lint`.
8. Live smoke remains green with compatible hub binaries or existing hub attach: `npm run smoke:plugin-contract-matrix` and existing packaged/live smokes using the artifact-backed fixture path.
9. No PII and no committed local absolute paths, sibling checkout paths, or Project Pipelines ticket worktree paths in source, tests, docs, or generated artifacts.

## Runtime Path Proof

- The production user path is intentionally unchanged.
- The test/runtime proof must show `package.json`'s `test` entry invokes `scripts/check-daemon-protocol-drift.mjs`, and that script now resolves the hub daemon protocol through the artifact-backed resolver by default.
- The live smoke proof must show `package.json`'s `smoke:plugin-contract-matrix` sets `BOTSTER_LIVE_CONTRACT_MATRIX=1` and invokes `scripts/live-packaged-protocol-harness.mjs`, and that harness installs/enables `botster.plugin-contract-matrix` using the artifact-backed fixture path by default.

## Pipeline Gates And Artifacts

- Plan gate evidence should include this file, loaded vault notes, baseline command evidence, and the checklist id `checklist_1783310791_520049`.
- Implement gate should include the exact artifact coordinate/layout discovered from the dependency, changed files, command outputs, and proof that no sibling checkout is required.
- Review/Verify should reject any implementation that only succeeds because `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL`, `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH`, `BOTSTER_HUB_SOURCE_DIR`, `../botster-hub`, or Project Pipelines ticket worktree paths were supplied.

## Vault Gaps Worth Capturing

- Capture a durable note after implementation if the hub test-support artifact establishes a standard downstream consumption contract: package name, exported paths, and resolver priority.
- Capture a note if Project Pipelines dependency context should expose closed dependency artifacts directly in `project_pipelines_current_context`; this run lists the dependency but not its artifact coordinate.
