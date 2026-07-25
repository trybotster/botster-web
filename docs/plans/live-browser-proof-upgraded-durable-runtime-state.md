# Live Browser Proof for Upgraded Durable Runtime State

## Target Repository

- Repository: `trybotster/botster-web`
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Planned revision: `5b1bbdb17fc835580c9c7a6a88e09ffebdacf5a9`
- Assigned branch: `project-pipelines/ticket_1784938737_759157`
- Repository charter: [[botster-web-playbook]]

The target was resolved from the Project Pipelines ticket and Botster spawn-target registry. The spawn-target display name is misspelled `booster-web`, but its path and Git repository are authoritatively `trybotster/botster-web`.

## Context Loaded

- Pipeline run `run_1784938749_848562`, Plan step `botster_stack_plan`, and gate `botster_stack_plan_gate`.
- Parent integration run `run_1784928695_310519`, especially evidence artifact `artifact_1784938794_298581`.
- Parent evidence at exact Web revision `5b1bbdb`:
  - a real upgraded durable Hub data directory started successfully;
  - WebRTC connected and terminal attach/readback worked;
  - five pre-existing exited sessions rendered;
  - externally spawned `botster-web-external-session` arrived as a running `botster-web.session` upsert;
  - the harness timed out waiting for that session text while the active route was Diagnostics;
  - unconditional package install separately failed with `AlreadyInstalled`.
- Ordered role/repository guidance:
  - [[planner-playbook]]
  - [[botster-planner-playbook]]
  - [[botster-web-playbook]]
- Required Botster maps and planning notes:
  - [[botster-architecture]]
  - [[cli-patterns]]
  - [[spa-patterns]]
  - [[project pipeline orchestration belongs in a device-level botster plugin]]
  - [[project pipelines needs an operator workbench not more primitives]]
  - [[project pipelines ui contract belongs in the plugin readme]]
  - [[botster orchestration should spawn agents with explicit target ids]]
  - [[botster orchestration prompts must bind agents to explicit worktrees]]
  - [[botster pipeline needs continuous product owner between agent steps]]
- Targeted runtime/browser notes:
  - [[botster web dogfood bridge ownership modes are explicit]]
  - [[botster web dogfood session readiness can arrive as entity snapshot]]
  - [[botster entity snapshots are authoritative reconnect baselines]]
  - [[botster browser pull requests must retry after webrtc reconnect]]
  - [[packaged botster web reloads need fresh webrtc grants]]
  - [[restty live harnesses use inserttext through mounted terminal focus]]
  - [[browser terminal input proof must exercise renderer callbacks]]
  - [[active workspace entity snapshots derive from live sessions before persisted manifests]]
  - [[botster package registry persists through hub state json]]
  - [[durable package snapshots must reconstruct admission through live helpers]]
  - [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]]
  - [[live harness route expectations must mirror production route gating]]
  - [[a regression test must be shown to go red with the fix reverted]]
- Repository guidance and prior art:
  - `README.md`
  - `docs/architecture.md`
  - `docs/plans/live-packaged-web-protocol-harness.md`
  - `docs/plans/existing-hub-dogfood-bridge-mode.md`
  - `package.json`
  - `botster-package.json`
- Current implementation inspected:
  - `scripts/live-packaged-protocol-harness.mjs`
  - `scripts/local-package-server.mjs`
  - `src/App.tsx`
  - `src/App.test.mjs`
  - `src/botster/LocalHubFirstScreen.tsx`
  - `src/botster/terminalSession.ts`
- Cross-repository seam inspected read-only at current Hub main:
  - `packages show/list/install/enable` use the running daemon's structured registry.
  - duplicate local install intentionally returns `AlreadyInstalled`.
  - Hub already exposes the package/session requests required by this ticket.

[[project-pipelines-playbook]] was not loaded because this ticket does not change Project Pipelines package/plugin code or workflow policy. Project Pipelines is only the delivery mechanism.

## Observed Failure Mechanisms

1. `startWebrtcPackageRuntime()` always runs `packages install` and `packages enable` for every required package. `BOTSTER_LIVE_DATA_DIR` only changes directory ownership, so an already-installed durable package fails before browser proof.
2. `proveExternalSessionLifecycle()` receives the correct running session frame while the page is on Diagnostics, whose `EntityFamilyPanel` renders session IDs but caps the summary at `records.slice(0, 4)`. Fresh state fits under that cap; five restored exited sessions plus the production and external sessions push the newly created external row outside it. Home renders every session without that summary cap.
3. `waitForHarnessEvent()` checks ID and status independently across snapshot records. With several persisted sessions, one record can satisfy the ID check while another satisfies the status check. Durable-state proof needs one coherent entity record, not cross-record coincidence.
4. Existing unit coverage largely asserts harness source shape. It does not seed Hub state through supported APIs, restart the Hub, and exercise `BOTSTER_LIVE_DATA_DIR` with installed package state plus exited sessions.

## Scope

- Make package preparation in the live packaged-protocol harness state-aware:
  - query the running daemon's structured package registry;
  - install a required package only when absent;
  - enable it only when not already enabled;
  - reuse an already-enabled `botster-web` package without remove/reinstall or persisted-state edits;
  - apply the same helper to optional packages selected by the harness so durable contract modes do not fail for the same reason.
- Preserve the existing fresh-directory path: an empty generated directory still installs and enables required packages before launching `botster-web/web-client`.
- Make session lifecycle waits correlate family, ID, status, and attachability on one entity record/key, whether state arrived through snapshot, upsert, or patch.
- Navigate through the production Home route before asserting that the externally spawned session is visible. Assert `data-testid="dashboard-view"` is active, anchor one exact row locator by observing it attached/visible, then prove its exited transition, removal, and transition to detached through the real React/Ionic entity-store rendering path. A detached wait must not pass for a row that was never rendered.
- Add a Web-owned live regression command or narrowly integrated harness mode that:
  - creates an isolated temporary Hub data directory;
  - installs/enables the current `botster-web` package through public Hub commands;
  - creates at least five sessions and drives them to `exited`;
  - shuts down and restarts Hub on the same directory so the seed is genuinely durable;
  - invokes the normal live browser proof through the `BOTSTER_LIVE_DATA_DIR` path;
  - verifies package reuse, existing exited-session rendering, external session lifecycle, same-URL reload/revisit with fresh WebRTC generations, terminal restore/input/readback/resize/exit, and clean shutdown;
  - removes only its generated temporary directory.
- Document the durable-data command, ownership semantics, prerequisites, and the fact that caller-owned `BOTSTER_LIVE_DATA_DIR` contents are never pruned or rewritten directly.
- Add focused deterministic tests for state-aware package decisions and coherent entity-record matching where those helpers can be tested without launching a browser. These are supplementary checks; they cannot prove that the live harness follows production route gating. The binding regression is the seeded browser command with pinned binaries and its live ablations.

Botster layers touched: Web-owned Node/Playwright live-hub harness, Ionic/React browser acceptance path, package script/docs, and focused JavaScript tests.

## Non-Scope

- No changes to Hub/Core package, session, terminal, persistence, or upgrade policy.
- No browser-only protocol fields, fixture-only action branches, `list_sessions` fallback, polling, HTTP terminal fallback, or compatibility alias.
- No removal/reinstall of caller-owned packages, session pruning, direct `hub-state.json` or session-manifest edits, or replacement of the caller's enabled package source.
- No UI redesign or broad `App.tsx` refactor. Current Home already renders every session and current terminal selection already ignores exited sessions.
- No change to production package server signaling, fresh-grant issuance, entity pull replay, or Restty mechanics unless the seeded live proof exposes a separate reproducible Web defect.
- No Project Pipelines plugin/package changes.
- No adjacent cleanup of historical plan terminology.
- No Hub persistence-migration test is added here. Web owns durable restart/reuse proof against the supplied binaries; the parent `mode=upgrade` campaign owns cross-version upgrade proof.

## Repository Ownership Boundaries and Cross-Repository Dependencies

- Web owns the Playwright harness, route navigation, entity-store rendering assertions, Restty interaction proof, and regression command.
- Hub remains authoritative for package state, package mutation decisions, session lifecycle, durable persistence, entrypoint supervision, WebRTC grants, and terminal truth.
- The harness may inspect and invoke Hub's public daemon/CLI contracts; it must not interpret or edit Hub persistence files.
- Core and hub-client generated DTO meanings remain unchanged.
- No new blocking cross-repository dependency is currently required. Current Hub main already supplies structured package listing, install/enable, session spawn/shutdown/remove, durable reload, WebRTC bootstrap, and terminal operations.
- Parent run `run_1784928695_310519` depends on this Web ticket and must rerun its upgraded durable-runtime campaign after the Web change lands. That downstream dependency does not broaden this run into Hub implementation.
- The Web-owned regression deliberately proves restart of current durable state with pre-existing exited sessions, not persistence migration between Hub versions. Cross-version proof remains the parent Hub `mode=upgrade` campaign; any migration failure there routes to Hub target `tgt_7e208a0c76a44980a83b63af976b1f22`.
- If implementation finds that the public Hub response cannot distinguish absent, disabled, and enabled package states, or cannot seed/reload exited sessions through supported APIs, stop and register a dependency against Hub target `tgt_7e208a0c76a44980a83b63af976b1f22` rather than parsing persisted state or adding a Web-private contract.

## Assumptions and Unknowns

- Assumption: `BOTSTER_LIVE_DATA_DIR` means the harness owns the spawned Hub process for the duration of proof but does not own or delete the supplied directory.
- Assumption: the integration caller has already refreshed the durable runtime to the intended current package sources. Reusing an enabled package is correct; silently replacing it would invalidate upgrade evidence.
- Assumption: Hub package rows expose a stable package name and enabled/disabled state sufficient for an idempotent ensure step.
- Assumption: the current Home session list intentionally includes exited sessions and does not cap the list. Source inspection confirms `sessions.map(...)` with no five-row slice.
- Assumption: the current terminal-session resolver selects only `running && attachable` records, so existing exited rows must remain visible without becoming the automatic terminal target.
- Assumption: seeded regression state must be produced through public Hub commands and then reloaded after process restart; a checked-in Web-owned copy of Hub persistence would violate ownership.
- Unknown: the cleanest implementation location for reusable package/entity matching helpers. Prefer a small module only if it enables behavior tests without exporting harness internals; otherwise keep the change local to the harness.
- Unknown: whether Hub returns an already-running entrypoint result when restored package supervision starts before the explicit start request. Preserve the current structured `list_apps`/`local_url` proof and make start handling idempotent only if the seeded regression demonstrates that exact case.

## Affected Surfaces and Files

- `scripts/live-packaged-protocol-harness.mjs`
  - primary package-state, coherent entity wait, Home visibility, lifecycle, reload, and terminal proof changes.
- `package.json`
  - add a named seeded durable live-regression command if a separate command is used.
- `src/App.test.mjs`
  - replace or supplement source-regex assertions with focused behavior coverage for extracted pure helpers and command wiring.
- New small helper under `scripts/` only if needed to keep package-state resolution or durable seeding testable and single-purpose.
- `README.md`
  - document the caller-supplied durable path and seeded regression command.
- `docs/architecture.md`
  - update only if needed to state live-harness ownership/reuse semantics; production architecture should remain unchanged.
- This plan artifact.

`src/App.tsx`, `src/botster/LocalHubFirstScreen.tsx`, and `src/botster/terminalSession.ts` are evidence surfaces, not expected change targets. Modify them only if the seeded real-browser regression proves a production rendering defect after the route-aware harness fix.

## Implementation Sequence

1. Introduce one structured package-ensure path after Hub socket readiness. Read package state once, install only missing packages, enable only non-enabled packages, then re-read/assert the required state before starting the Web entrypoint.
2. Replace independent event-field matching for session lifecycle with a helper that selects one matching record/key and accepts authoritative snapshot, upsert, or patch delivery.
3. In external lifecycle proof, navigate to Home through the production route control, assert `dashboard-view`, wait for one exact target-row locator to become attached/visible, then use that same anchored locator to prove exited/remove/detached transitions before continuing reload and terminal proof.
4. Add the seeded durable regression using public Hub operations and a real restart. Reuse the normal live harness rather than creating a parallel browser oracle.
5. Add focused behavior tests and docs, then run the full Web gates plus isolated and seeded-durable live commands.
6. Demonstrate regression strength with narrow ablations:
   - bypass package reuse and confirm the seeded command fails with duplicate install;
   - remove Home navigation/coherent matching and confirm the seeded command fails on external-session visibility. Keep this control deterministic by creating more restored sessions before the browser/external session than Diagnostics can display, verifying the Diagnostics overflow is active and the target is absent there, and requiring the visibility assertion itself to run under `dashboard-view`;
   - restore the fixes and confirm both fresh and seeded modes pass.

## Risks

- Treating every failed install as "already installed" could hide compatibility, admission, or path errors. Avoid error-string suppression; inspect state before mutating and fail normally on real mutation errors.
- Reinstalling or reloading an existing enabled package would mutate the evidence under test and can replace an upgraded caller's package source. Reuse it unchanged.
- Independent ID/status checks across a multi-record snapshot can false-green. Match one record atomically.
- A DOM wait on the wrong route can false-red even when entity state is correct. Navigate through production UI before visibility assertions.
- A detached DOM wait succeeds when no element ever matched. First observe the exact target row attached/visible, retain that locator, and only then require its removal transition.
- A fixture copied from Hub persistence would couple Web to foreign schema. Seed only through public commands and prove restart.
- Existing exited sessions must not become terminal targets. Preserve `running && attachable` selection and prove the production session remains the mounted terminal.
- Same-URL reload can pass transport setup but lose view hydration. Keep fresh grant IDs, fresh subscription IDs, entity pulls, terminal restoration, and renderer-path input assertions.
- Subprocess cleanup is load-bearing. Every failed seed/readiness/browser path must stop and wait for owned Hub/browser children while preserving caller-owned directories.
- Live evidence is binary-sensitive. Record exact Hub and session-worker provenance and fail clearly when Playwright Chromium or binaries are absent.

## Acceptance Checks and Tests

Repository gates:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run smoke:browser-runtime
npm run smoke:mounted-terminal-keyboard
```

Optional-package live modes whose shared package-ensure path changes:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:plugin-contract-matrix

BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:plugin-payload-contract
```

Both commands must have their exact binary provenance and zero exit status recorded.

Fresh isolated live proof:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

Seeded durable regression, exposed as a documented Web-owned command or equivalent explicit mode:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol:durable
```

The seeded command must prove:

- a restarted Hub loads an already-installed, already-enabled `botster-web` package without remove/reinstall;
- at least five pre-existing exited sessions remain visible;
- `botster-web-external-session` becomes one coherently matched running entity and visible Home row, then becomes exited, is removed, and disappears;
- the external row is first observed attached/visible under `dashboard-view`, and its later detached state is proved with that same locator rather than a fresh zero-match query;
- the production `web-prod` session, not an exited row, is selected for terminal attach;
- reload and revisit use the same package origin but new grant/subscription generations;
- restored terminal output, mounted-renderer input, one outbound `send_input`, read-screen, capture-snapshot, observed PTY resize, deterministic exit, detach, and no `unknown_session` failures still pass;
- no legacy `list_sessions` hydration occurs;
- caller-owned durable state is not pruned or directly edited.

Regression negative controls must return nonzero when package reuse or route-aware visibility is ablated, then return zero with the fix restored. For the route control, seed more than the Diagnostics four-row cap before creating the browser/external sessions, assert Diagnostics overflow plus target absence before Home navigation, and require the positive visibility wait to execute under `dashboard-view`; this makes the ablation depend on an observed capped state rather than an assumed record order.

Downstream proof required by the Web charter and parent integration:

- rerun the parent Hub production-runtime campaign in upgraded durable mode with exact current Hub/Core/worker artifacts and the candidate Web revision;
- require `mode=upgrade` to exit zero through Web readiness, external lifecycle visibility, reload/reconnect, terminal proof, status/doctor/smoke/down;
- record exact repository revisions and commands in the parent evidence artifact.

## Pipeline Gates and Artifacts

- Plan artifact: this file.
- Plan gate: attach the repository-routed fields required by `botster_stack_plan_gate`.
- Implement gate: committed diff, linked PR, files-changed report, package-state decision evidence, seeded-state summary, regression negative controls, and exact command exit statuses.
- Review/Verify: inspect the real route/package entry points, rerun repository gates, fresh and seeded durable live proof, plus both optional-package live modes, verify no persisted-state editing or reinstall workaround, and carry the parent upgraded campaign as downstream proof.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation establishes a general Botster client-harness convention for idempotently attaching to preinstalled packages without taking package mutation ownership.
- Capture a note if multi-record entity harness matching repeatedly causes false positives; the reusable claim would be that entity acceptance must correlate ID and state on one record.
- Capture a note if seeded durable browser regressions need a shared Hub test-support primitive beyond this Web-specific harness.
- [[live harness route expectations must mirror production route gating]] constrains the fix: helper-level tests are supplementary, while pinned live browser proof and its negative control are the route-oracle evidence.
- Planning alone found no convention conflict and no new durable fact beyond those candidates; do not write a vault note until implementation evidence confirms reuse beyond this ticket.
