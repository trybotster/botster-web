---
description: Plan for a deterministic production-browser driver that exercises Workspaces Spawn through a parent-owned shared Hub and emits correlated structured evidence
---

# Drive Workspaces Spawn through a caller-owned shared Hub

## Target repository and routing

- Ticket: `ticket_1785602852_464676`, "Web integration: drive Workspaces Spawn through a caller-owned shared Hub".
- Run: `run_1785604405_814135`, Plan step `botster_stack_plan`.
- Authoritative target repository: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- `project_pipelines_current_context` supplied the ticket target ID. The admitted spawn-target registry maps it to the registered Botster Web checkout and `repo_name=trybotster/botster-web`; its display name is misspelled `booster-web`, but registered target and Git identity are unambiguous. Routing was not inferred from this process's working directory.
- Assigned worktree: this ticket worktree on `project-pipelines/ticket_1785602852_464676`, based on `origin/main` commit `a618fcd5f060303e18350a6af68436347fb730de` when planned.

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. The targeted role, surface, and runtime notes below
5. [[project-pipelines-playbook]] for this run's artifact, checklist, gate, dependency, and advancement policy; Project Pipelines code is not in scope

Botster planning guidance:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[botster pipeline needs continuous product owner between agent steps]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]

Web and ticket-specific guidance:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[supervised web entrypoint tests use health for readiness and local url for later contract proof]]
- [[manifest required injections must be consumed by the launched runtime]]
- [[installed apps are daemon app rows projected from package runnable entrypoints]]
- [[runtime client acceptance must render delivered snapshots through real registry]]
- [[conformance helpers must dispatch the action id read from the rendered node]]
- [[conformance oracles assert action result frames not toast text]]
- [[conformance harnesses gate on deterministic invariants not timing]]
- [[plugin surface actions route by explicit metadata]]
- [[plugin surface requests require a declared id and operation]]
- [[acceptance readiness requires the exact expected entity not any authoritative snapshot]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[acceptance harness region oracles must key on node identity not concatenated text]]
- [[botster web dogfood bridge ownership modes are explicit]]
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]]
- [[plan review must verify baseline test execution and register blocking dependencies]]
- [[renderer state accepts only realized literal identity]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[a regression test must be shown to go red with the fix reverted]]

## Context loaded

- Project Pipelines current context supplied the authoritative ticket, run, active Plan step and gate, target ID, artifacts, checklists, dependency/question state, first Plan Review `review_1785605529_739903` with five resolved findings, and second Plan Review `review_1785606464_839040` with two returned acceptance-shape findings. This revision also makes the coordinator prove both cold and reused/non-empty entry paths and makes every allow-skip variable fail closed.
- Repository instructions and placement were taken from `README.md`, `docs/architecture.md`, `package.json`, `botster-package.json`, current mainline plans under `docs/plans/`, repository history, and the repository-owned npm gates. There is no repository `AGENTS.md` and no checked-in GitHub workflow; README/package scripts are the executable gate authority.
- The installed production entrypoint is already correct: `botster-package.json` declares the supervised `web-client`, injects required `BOTSTER_HUB_CONNECTION`, starts `scripts/local-package-server.mjs`, and publishes `local_url`; `scripts/local-package-server.mjs` decodes and uses the descriptor before serving.
- The existing live harness already honors `BOTSTER_LIVE_DATA_DIR`, installs only when needed, launches the Web app with `start_package_entrypoint`, discovers its `ListApps` `local_url`, and proves caller-owned state reuse in `scripts/live-caller-owned-repeatability.mjs`. That code is useful precedent, but its main mode still starts and stops a Hub and ensures packages; it cannot be the final shared-Hub driver unchanged.
- `scripts/live-packaged-protocol-harness.mjs` already contains production Playwright navigation, Workspaces create/select interaction, rendered action metadata extraction, structured daemon request/action-result observation, canonical session entity chronology, request counting, reconnect evidence, and bounded failure diagnostics. The new driver should extract/reuse the smallest generic portions rather than duplicate a second browser policy layer or rebuild transport plumbing.
- Current Workspaces lifecycle coverage deliberately owns a fresh Hub and seeds sessions with direct daemon requests. This ticket needs the inverse ownership mode: the parent Workspaces harness owns the one Hub, package state, admitted Git targets, sequencing, session creation consequences, and cleanup; Web owns only browser interaction and browser-consumer evidence.
- Production source already reconciles pushed `session` entity snapshots/deltas without `list_sessions`. The driver must prove the rendered path observes those updates without causing an extra `plugin_surface_render`, list refresh, or polling request.
- Baseline on exact Web base `a618fcd5f060303e18350a6af68436347fb730de`: `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` exit 0. Lint retains seven existing Fast Refresh warnings and build retains the existing large-chunk warning. `npm run smoke:browser-runtime` initially failed because the sandbox denied loopback bind, then passed unchanged with loopback permission.
- Live inputs are present at the registered `botster-hub` and `botster-workspaces` targets. Hub binaries were built from Hub commit `88d343870700994d310f090fd5b2c4dbabb07405`; the Workspaces package was at `723f4a357dec65a5a4200e46f402529e67e95cde`. With `BOTSTER_HUB_BIN=<botster-hub target>/target/debug/botster-hub` and `BOTSTER_SESSION_WORKER_BIN=<botster-hub target>/target/debug/botster-session-worker`, `npm run smoke:live-packaged-protocol` and `npm run smoke:live-packaged-protocol:caller-repeatability` both exit 0. Adding `BOTSTER_WORKSPACES_PACKAGE_PATH=<botster-workspaces target>`, both `npm run smoke:workspaces-compat` and `npm run smoke:workspaces-lifecycle` exit 0; lifecycle emits the complete initial/transitioned/removed/reconnected partitions and fresh authoritative subscription evidence. `npm run smoke:plugin-contract-matrix` also exits 0 when run serially. A concurrent first attempt overlapped it with Workspaces compatibility and timed out after an HTTP 503; the required acceptance commands are therefore recorded and run serially, with the standalone rerun as the authoritative baseline result.

## Scope

1. Add one deterministic, executable production-browser driver for the parent-owned shared-Hub scenario. It must attach to the already running Hub selected by the required shared data-directory/socket input, discover the already launched `botster-web/web-client` app from authoritative app rows, wait for exact health and structured `local_url`, and never start, stop, install, enable, or clean Hub/package state.
2. Give the driver one narrow required case-assignment input from the parent containing correlation/case ID and the target-first Spawn facts needed for Web's assigned managed-Git cases. This is orchestration input, not optional product configurability. Keep the serialization at the script boundary and do not add it to React state, Hub protocol, package manifest policy, or Workspaces product semantics.
3. Launch Playwright against the Hub-launched installed package and navigate through real rendered package navigation controls to the admitted `botster-workspaces/workspaces` route. A direct URL may be retained only for diagnostic comparison; it cannot substitute for the control click.
4. Create a uniquely correlated workspace through whichever owner-authored create affordance the delivered tree actually renders: the empty-state create control when no workspace exists, or the toolbar new-workspace control when shared state already exists. The mandatory smoke must exercise both states. In either path, derive the control/action from the rendered tree, require the accepted presentation operation, use the real Ionic input callback and rendered form submit, select the created workspace through its rendered row/control, and require exact owner-authored workspace identity before Spawn. Read the realized literal `data-ui-node-id` from the rendered node and correlate it through structured action-result/entity identity; never parse, slice, synthesize, or reconstruct a `botster-workspaces-row-<id>` string shape.
5. For every assigned target-first case, drive the real rendered Spawn flow in the parent-provided order: select the target before template/branch/worktree fields, fill only controls actually authored by the delivered Workspaces tree, dispatch the action ID and realized node ID read from the rendered control/form, and wait on exact correlated structured action result plus canonical workspace/session entity evidence. The driver must not hand-author `UiActionRequest` or infer a sibling checkout. Open same-target sibling ticket `ticket_1785602848_609148` may change BindList descendant realization, so no harness oracle may couple to the authored row-ID prefix.
6. Cover the parent's managed-Git matrix cases assigned to Web (including existing managed worktree, existing branch requiring a managed worktree, and missing branch creation when assigned), while treating target admission, base-ref/template resolution, Git mutation, locking, and returned worktree facts as Hub-owned truth. The browser asserts the structured facts exposed by the owner workflow; it does not run Git.
7. Observe state created earlier by the TUI/shared sequence through the same rendered Workspaces surface and canonical entity store. Identify the expected workspace/session by correlation and exact entity identity rather than by count, first row, toast text, or elapsed time.
8. Emit one bounded machine-readable evidence record per action/case plus a final summary. Each case record should correlate at least: parent case ID, rendered package/surface/node/action identity, submitted rendered values, matching daemon action-request observation, accepted/rejected action result and request correlation, workspace/entity identity, session identity and lifecycle, Hub-returned target/template/branch/worktree/base facts available through the sanctioned result/entity contract, and surface/list request counts before and after reconciliation. The per-run summary must identify the exact supplied Hub and session-worker artifacts by path and SHA-256 digest measured before launch and verified unchanged at completion, and add Workspaces package path, manifest version/source kind, and Git commit. Without a build receipt, Hub/Core source commits and package versions remain explicitly unverified rather than being inferred from a mutable adjacent checkout. Human-readable diagnostics may accompany but not replace the structured record.
9. Prove lifecycle reconciliation after the sanctioned initial surface open/reconnect baseline. Capture the initial `plugin_surface_render` and `list_sessions` counts, then require the exact pushed lifecycle/entity change and rendered current/ended membership while both counts remain unchanged. Also fail on any polling/list-refresh request or synchronization surface rerender.
10. Add a repository-owned, test-only coordinator that reuses the setup shape from `scripts/live-caller-owned-repeatability.mjs`: create one fresh short data directory, start one Hub, install/enable Web and Workspaces once, create/admit real managed-Git targets/templates/base refs, and launch `botster-web/web-client` through current Hub commands. Invoke the lifecycle-free driver twice against that same Hub. The first cold invocation must use the rendered empty-state create path and leave a correlated workspace/session behind. The second reused invocation must observe that exact pre-existing state, use the rendered toolbar new-workspace path, drive its assigned cases, and prove lifecycle reconciliation. Assert a two-generation structured completion ledger, then own shutdown and fixture cleanup. This coordinator exists solely to prove the driver in this run; the final Workspaces parent replaces it downstream.
11. The driver and coordinator are required modes and must not inherit optional surface skips. Hard-reject `BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1` and every environment variable matching `BOTSTER_LIVE_ALLOW_*_SKIP` before browser launch; do not clear a flag silently and do not reuse a helper branch that can return early. Positive completion must require both surface navigations, both create paths, every assigned Spawn case, pre-existing-state observation, and lifecycle reconciliation before exit 0.
12. Reuse or extract pure helpers from the existing live harness only where both scenarios share mechanics. Keep the current standalone live, Workspaces compatibility/lifecycle, caller-repeatability, contract-matrix, and durable modes behaviorally unchanged.
13. Add deterministic script/helper tests, package-script wiring, and README documentation for both the direct driver contract and the mandatory repository-owned smoke command, cold/reused entry behavior, skip rejection, ownership boundary, structured evidence/provenance shape, and downstream proof command.

## Non-scope

- No Hub lifecycle ownership in the production-browser driver: it must not start, restart, stop, or delete the shared Hub/data directory. The repository-owned smoke coordinator may own only its fresh test fixture so this run can execute the driver; that test-only ownership must not leak into the driver or parent contract.
- No package installation, enablement, reinstallation, path provenance replacement, or sibling-package discovery in the driver. The test-only coordinator receives explicit package paths, installs/enables once in its fresh fixture, and launches Web through current Hub package/app commands; the final parent owns those responsibilities downstream.
- No attach plumbing, terminal bridge, dogfood bridge, direct Core/session-worker path, or terminal data-plane proof.
- No direct or hand-authored `UiActionRequest`, synthetic click payload, forced click, programmatic form submission, or fixture-only replacement for rendered Ionic callbacks.
- No `list_sessions`, polling, list refresh, global hydration, synchronization `plugin_surface_render`, fixed sleep as readiness, or timing-only acceptance.
- No Web-owned Workspaces policy, product vocabulary branch in React, workspace/session/Git truth, managed-worktree algorithm, target/template eligibility logic, or browser-only protocol meaning.
- No new optional harness framework, generalized scenario DSL, transport abstraction, app launcher, or broad live-harness refactor. The case input and evidence output exist only to join this Web driver to the parent integration harness.
- No cold-start-only acceptance shortcut and no assumption that the empty-state create control exists. Reused shared state is a first-class required input shape.
- No `BOTSTER_LIVE_ALLOW_SURFACE_SKIP` or other allow-skip compatibility in the new required mode. Existing optional modes may retain their current policy, but none of their skip branches may be imported into the driver/coordinator.
- No changes to `botster-workspaces`, `botster-hub`, Core, Hub Client, TUI/TUI-kit, UI Contract, Project Pipelines code, or published package artifacts in this run.
- No adjacent renderer, routing, package, connection, test cleanup, or dependency bumps unless a focused real-path reproduction demonstrates a generic Web defect that blocks this ticket.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns:** installed-browser discovery from public app rows, real Playwright/Ionic interaction, stable plugin-route navigation, generic UiNode rendering assertions, realized action metadata extraction, canonical browser entity reconciliation, request/action/entity correlation, bounded diagnostics, exact runtime provenance, the executable browser-driver contract, and a test-only coordinator that executes that contract in this repository.
- **botster-workspaces owns:** workspace creation/selection/Spawn workflow, authored form/control identities, grouping, action results/replacement trees, session membership, and the parent integration harness. Final ticket `ticket_1785192726_335558` targets `tgt_71266a8d976d4535902ffed09c18a7ba` and must consume the merged Web driver, run the shared Web/TUI matrix, and retain the final evidence. This is a downstream dependency/proof obligation, not scope to implement here.
- **botster-hub owns:** the long-lived shared daemon, package install/enable/app launch, `BOTSTER_HUB_CONNECTION`, public app rows/local URL, admitted targets/templates/base refs, atomic managed-Git Spawn behavior, session/lifecycle truth, plugin-worker action execution, WebRTC transport, and typed result/entity frames. Existing Hub behavior is consumed unchanged. A newly demonstrated Hub defect must be routed to target `tgt_7e208a0c76a44980a83b63af976b1f22` rather than repaired here.
- **botster-tui owns:** its separate production-frame keyboard driver and evidence. TUI ticket `ticket_1785602853_851250` targets `tgt_c3d470bab78549df920a41e8fb0e58d8`; Web may observe TUI-produced shared state but must not copy or bypass its keyboard proof.
- **Project Pipelines owns:** this run's durable plan/checklists/artifact/gate/dependency state only. No package/plugin path is changed.
- Current run context contains no registered blocking dependency. The already delivered caller-owned connection, Hub spawn capability, Workspaces workflow, and Web lifecycle projection are premises of this ticket. If implementation disproves one, stop, record exact evidence, and register the prerequisite against its owning repository target instead of broadening this run.

## Assumptions and unknowns

- Assumption: the final parent supplies a live shared data directory/socket and launches the installed `botster-web/web-client` before invoking the browser driver. For this ticket's mandatory in-run proof, the new repository-owned smoke coordinator supplies the same contract and validates that the driver remains lifecycle-free.
- Assumption: the parent supplies a finite ordered assignment with stable case correlation IDs and expected target/branch/template facts. The implementation should choose the smallest single required serialization supported by both scripts (for example one JSON value), document it, and reject malformed or missing input. It must not invent defaults or auto-discover cases.
- Assumption: the real parent invokes Web after shared work has begun, so the driver must treat a non-empty workspace/session surface as normal. The repository smoke establishes this by retaining the first invocation's state and requiring the second invocation to observe it before creating another workspace.
- Assumption: structured action results and/or canonical owner entities expose enough target/branch/worktree/base facts to correlate each case. If the browser can only observe user-facing text for a required fact, that is an owner-contract gap; ask the Workspaces/Hub owner instead of parsing prose.
- Assumption: existing `window.__BOTSTER_LIVE_PROTOCOL_HARNESS__` event capture and helper patterns can provide daemon request/action/entity chronology without production behavior changes. If instrumentation is insufficient, add generic test-only observation at the existing harness boundary, not a Workspaces branch in production React.
- Assumption: one initial/reconnect surface pull is sanctioned for baseline/recovery. Lifecycle proof begins only after recording that count and must keep it fixed.
- Assumption: the parent defines which client owns each matrix case and sequences TUI/Web so Web can observe shared state deterministically. The Web driver must not race or coordinate the TUI process itself.
- Unknown: the exact published Workspaces control IDs and accepted Spawn result fields at implementation time. Resolve them from the installed owner-authored tree and authoritative contract artifact; derive action identity from rendered controls and fail with bounded delivered-tree diagnostics when required structured facts are absent.
- Resolved identity constraint: do not infer workspace identity by slicing authored node-ID prefixes. Consume the realized literal DOM identity and correlate it with structured results/entities. Sibling `ticket_1785602848_609148` is relevant drift context but not a dependency because current Workspaces roots are literal and this driver does not require descendant-ID encoding policy.
- Unknown: whether a small shared helper extraction from `live-packaged-protocol-harness.mjs` is cleaner than exporting its existing functions. Prefer the least change that avoids duplicated browser semantics and keeps all current modes green.
- Unknown: the final parent command name and case split until the Workspaces parent harness consumes this driver. The Web README must document its own executable contract; final matrix ownership and aggregate reporting remain downstream.
- No convention conflict is currently identified. The plan narrows ownership compared with the existing Hub-owning harness and preserves Hub/plugin authority, rendered Ionic interaction, structured evidence, deterministic readiness, and no-refresh lifecycle rules.

## Affected surfaces and files

- `scripts/workspaces-shared-hub-browser-driver.mjs` (new): narrow lifecycle-free executable boundary that validates caller inputs, rejects inherited skip flags, and enters the guarded shared-Hub mode in the existing live harness.
- `scripts/workspaces-shared-hub-browser-helpers.mjs` (new): pure assignment, completion-ledger, expected managed-Git outcome, and measured request-count helpers shared by deterministic tests and the coordinator.
- `scripts/workspaces-shared-hub-browser-smoke.mjs` (new): repository-owned test-only coordinator that materializes one real fresh shared-Hub/Git/package fixture, invokes the lifecycle-free driver, validates structured completion, and owns only its fixture cleanup.
- `scripts/live-packaged-protocol-harness.mjs`: guarded shared-Hub driver mode containing app discovery, Playwright flow, case/value/result correlation, lifecycle reconciliation, observable caller-owned provenance, and structured output so existing browser mechanics and instrumentation remain single-sourced. Hub-owning modes and semantics remain unchanged.
- `src/App.test.mjs`: deterministic tests for ownership rejection, required case parsing, rendered-control/action derivation, evidence correlation, no-refresh/list counts, exact-entity readiness, and package-script/README wiring.
- `package.json`: one direct driver script plus mandatory `smoke:workspaces-shared-hub-browser`; no dependency addition expected.
- `README.md`: invocation inputs, parent/driver ownership, structured evidence schema, readiness/reconciliation invariants, and downstream proof.
- `docs/plans/drive-workspaces-spawn-through-caller-owned-shared-hub.md`: this durable routed plan artifact.
- `botster-package.json`, `scripts/local-package-server.mjs`, production React/UI/entity/transport files, generated DTOs, and dependencies are expected unchanged. Touch production code only after a focused generic reproduction proves a Web-owned defect.

## Implementation sequence

1. Lock deterministic failing tests around the missing caller-owned driver contract and in-run executor: the driver must reject absent shared Hub/app/case inputs and all `BOTSTER_LIVE_ALLOW_*_SKIP` variables, expose no Hub start/shutdown/package install/enable path, and distinguish delivered empty versus non-empty create affordances. The smoke must fail unless the real two-invocation completion ledger proves both create paths, every assigned case, pre-existing-state observation, and lifecycle reconciliation executed.
2. Add the minimum pure assignment/ledger/count helpers beside the new driver and retain the existing live harness mechanics in place. Run deterministic tests immediately so the new mode cannot change current live modes silently.
3. Implement the new driver boundary as a validated entry into a guarded `BOTSTER_LIVE_SHARED_HUB_DRIVER` harness mode: require `BOTSTER_LIVE_DATA_DIR` and `BOTSTER_WORKSPACES_SPAWN_CASES`, protocol-handshake the exact socket, read the already running app and package rows, require health and the structured local URL, launch Chromium, and install bounded event capture.
4. In that guarded harness mode, reuse only production navigation mechanics that cannot skip. Click through package controls, require the admitted Workspaces surface, choose the rendered empty-state or toolbar create affordance without assuming either one, create/select the correlated workspace via rendered Ionic callbacks, and capture matching request/result/replacement evidence.
5. For each assigned case, locate controls inside the delivered owner tree, read realized action/node IDs from DOM metadata without parsing an authored prefix, drive target-first field order and real callbacks, assert the exact collected values reach the daemon request, wait for the exact accepted result and session/workspace entity, enforce assigned managed-Git outcomes when present, and emit the per-case record. Add rejected-case handling only when the parent assigns an expected rejection; do not generalize a policy DSL.
6. Record the sanctioned surface/list baseline. Apply/observe the parent-arranged lifecycle change and require exact rendered reconciliation through pushed entities with unchanged `plugin_surface_render` and zero `list_sessions` growth.
7. Observe the parent/TUI-produced workspace/session by exact case correlation and emit the cross-client observation without dispatching TUI actions or attaching to its session.
8. Implement `scripts/workspaces-shared-hub-browser-smoke.mjs` by reusing the caller-repeatability setup primitives: create one short fixture, start one Hub, install/enable once, create and admit the three deterministic managed-Git resolution cases, and launch Web. Invoke `node scripts/workspaces-shared-hub-browser-driver.mjs` first with cold assignments, retain its workspace/session, then invoke it again with reused-state expectations plus remaining assignments. Both children receive the same `BOTSTER_LIVE_DATA_DIR` and separately digested `BOTSTER_WORKSPACES_SPAWN_CASES`. Require the exact two-generation completion ledger before cleanup.
9. Add deterministic positive/negative tests and README/package wiring. Include old-path negative controls for direct action payloads, authored-ID prefix slicing, list/poll refresh, driver-owned Hub lifecycle commands, package mutations, dogfood/sibling discovery, timing sleeps, cold-only execution, and a smoke completion check shown to fail when either driver invocation or its completion assertion is ablated. Set `BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1` and a representative alternate `BOTSTER_LIVE_ALLOW_*_SKIP=1` in negative controls and require fail-closed nonzero exit before browser launch.
10. Run all repository gates, all existing live regression modes serially, and mandatory `smoke:workspaces-shared-hub-browser` against the real coordinator fixture. Then hand the merged driver to the Workspaces parent for the full shared Web/TUI managed-Git matrix.

## Risks

- **Ownership regression:** reusing the current harness naively could start/stop the parent Hub or reinstall packages. The driver must fail closed if required shared state is absent and tests must prove no lifecycle/mutation commands are issued.
- **False UI proof:** hardcoded IDs, direct daemon actions, forced clicks, or programmatic submissions could pass without exercising Ionic callbacks. Derive metadata from rendered controls and correlate the resulting wire evidence.
- **False readiness:** accepting any app row, snapshot, or workspace count can race restored state. Require the exact package/entrypoint URL, health, case/workspace/session identity, and lifecycle state.
- **Timing flake:** Git/session creation duration varies. Poll only exact structured conditions with a bounded deadline and retain the last structured state; do not sleep to infer readiness.
- **Surface-refresh camouflage:** a rerender request can make lifecycle state appear correct while push reconciliation is broken. Freeze request counts after the sanctioned initial/reconnect surface pull.
- **Cross-client race:** Web may observe shared state before the parent/TUI stage is complete. The parent must sequence stages and pass a correlation ID; Web waits on that exact entity rather than coordinating TUI.
- **Cold-fixture false green:** a driver that only sees the empty state can depend on an affordance absent from the real reused Hub. The same-Hub second invocation must prove the non-empty toolbar path and exact prior-state observation.
- **Inherited skip false green:** optional live-harness allow-skip flags can bypass package navigation. The new required mode hard-rejects the entire allow-skip environment family and validates positive per-stage completion.
- **Product leakage:** parsing labels/headings or adding Workspaces branches to React creates consumer-owned product policy. Use realized identities and structured contract fields; route missing semantics to Workspaces.
- **Identity-shape coupling:** prefix slicing can survive current literal roots but break when descendant realization changes. Treat `data-ui-node-id` as an opaque realized literal and use structured entity/result correlation.
- **Evidence bloat or secrets:** raw event streams may contain grants or excessive trees. Emit a bounded allowlisted evidence shape and redact bootstrap credentials while retaining actionable last-state diagnostics.
- **Upstream drift:** Workspaces/Hub contract revisions could change authored control/result fields. Pin downstream proof provenance and treat missing authoritative fields as an owned dependency, not permission for compatibility aliases.
- **Existing harness regression:** helper extraction can subtly change durable/lifecycle/contract modes. Source/deterministic gates plus the applicable live modes must remain green.

## Acceptance checks and tests

Repository gates:

- `npm test` passes protocol drift and deterministic driver/helper tests.
- `npm run typecheck`.
- `npm run lint` with no new errors or warnings attributable to this ticket; the seven baseline Fast Refresh warnings are recorded, not silently waived for new code.
- `npm run build`.
- `npm run smoke:browser-runtime` passes with loopback permission.
- `BOTSTER_HUB_BIN=<botster-hub target>/target/debug/botster-hub BOTSTER_SESSION_WORKER_BIN=<botster-hub target>/target/debug/botster-session-worker npm run smoke:live-packaged-protocol` exits 0 and records Hub/worker provenance.
- With the same binaries, `npm run smoke:live-packaged-protocol:caller-repeatability` exits 0 twice and proves restored enabled-package reuse. When Workspaces is supplied, its first child proves the cold create/reload/direct-load sequence and its second child proves the exact retained workspace across initial-retained/reload/direct-load without recreating it.
- With the same binaries plus `BOTSTER_WORKSPACES_PACKAGE_PATH=<botster-workspaces target>`, `npm run smoke:workspaces-compat` and `npm run smoke:workspaces-lifecycle` both exit 0 with their positive completion evidence.
- With the same binaries, `npm run smoke:plugin-contract-matrix` exits 0. Run these live modes serially. All five are unconditional because the inputs are present; any red result requires exact base-versus-branch evidence and first-failure ownership rather than a conditional skip or blanket waiver.
- `BOTSTER_HUB_BIN=<botster-hub target>/target/debug/botster-hub BOTSTER_SESSION_WORKER_BIN=<botster-hub target>/target/debug/botster-session-worker BOTSTER_WORKSPACES_PACKAGE_PATH=<botster-workspaces target> npm run smoke:workspaces-shared-hub-browser` is the mandatory in-run gate. It must invoke the real driver twice against the same Hub with generated `BOTSTER_LIVE_DATA_DIR` and serialized `BOTSTER_WORKSPACES_SPAWN_CASES`, exercise the Hub-launched installed Web package first cold and then reused/non-empty, print both exact child contracts in bounded diagnostics, validate both completion generations, and exit 0. This ticket cannot pass on deterministic/file-existence or cold-only tests.

Focused caller-owned production-browser proof:

- `scripts/workspaces-shared-hub-browser-smoke.mjs` creates one fresh short Hub data directory, starts one Hub, installs/enables Workspaces and Web once, admits the real Git targets/templates/base refs, and launches `botster-web/web-client` through Hub commands before invoking the new driver twice. It is the explicit in-run executor; the driver itself remains lifecycle-free.
- The direct child contract is `BOTSTER_LIVE_DATA_DIR=<coordinator-owned shared dir> BOTSTER_WORKSPACES_SPAWN_CASES='<coordinator-generated ordered case JSON>' node scripts/workspaces-shared-hub-browser-driver.mjs`. Missing or malformed inputs and every `BOTSTER_LIVE_ALLOW_*_SKIP` variable fail closed before browser launch; there is no discovery or skip fallback.
- First invocation evidence requires the empty-state create path. The coordinator retains its correlated workspace/session and transitions the shared state as assigned. Second invocation evidence requires that prior workspace/session to be visible, uses the toolbar new-workspace path, and completes the reused-state cases without reinstall or Hub restart.
- The driver attaches to that same Hub, discovers the already running app, receives no Hub binary/package path, and exits without shutdown, package mutation, session cleanup, Git cleanup, or data-dir deletion.
- Playwright clicks admitted package navigation, renders the real Workspaces tree through production React/Ionic/WebRTC, creates and selects the exact workspace via Ionic callbacks, and drives every assigned target-first Spawn case.
- Each action record contains opaque realized node/action identity and matching structured request/result/entity evidence. No record parses or reconstructs owner-authored row IDs. The accepted Spawn cases report exact session ID and authoritative target/template/branch/worktree/base facts; expected rejections remain typed and non-destructive when assigned.
- The browser observes the exact state produced by the TUI/shared stage by correlation ID, not count or text.
- After the sanctioned initial/reconnect surface request, an exact session lifecycle/entity transition changes the rendered current/ended membership with unchanged `plugin_surface_render` count and no `list_sessions`, polling, list refresh, or synchronization rerender.
- No attach, dogfood bridge, sibling discovery, direct payload, forced click, fixed-sleep readiness, unexpected console/page/404 failure, or browser-authored Workspaces policy occurs.
- Each driver summary is parseable structured output and cross-references every assigned case exactly once. The coordinator summary correlates both generations, including entry state, chosen rendered create control, prior-state observation, and case-assignment digest. Direct-driver provenance identifies caller-owned Hub protocol/status, installed Workspaces/Web package name/version/source/state, and the served Web asset digest; binary path, worker version, package Git commit, and Web build commit are explicitly marked unexposed when the public installed-app contract does not provide them. The repository-owned coordinator additionally pins exact local Hub/worker paths and immutable SHA-256 digests, Workspaces Git commit, and Web commit; without build receipts it marks Hub/Core source commits and binary package versions unverified. Failure output retains the failing generation/case, last action/result/entity chronology, surface/list counts, route, provenance, and bounded realized node identities.

Downstream proof required by the repository charter:

- After this Web change merges, Workspaces integration ticket `ticket_1785192726_335558` must consume the merged repository/package artifact and run its parent-owned one-Hub scenario with both the Web driver and the separately merged TUI keyboard driver.
- That downstream run owns the complete existing-worktree/existing-branch/missing-branch matrix, shared sequencing, Git fixture integrity, ended-history behavior, non-destructive collision rejection, and final cleanup assertions. It must attach the Web per-case records to the aggregate evidence and exit 0.
- A fixture-only driver test or evidence that the driver file exists is insufficient. Acceptance requires the Hub-launched installed Web package, real rendered controls/Ionic callbacks, real Workspaces worker, real managed Git targets, canonical session entities, and the shared TUI/Web runtime sequence.

## Plan Review finding resolution

- `finding_1785606464_436386` (medium): coordinator now invokes the driver twice against one Hub, requiring the cold empty-state create path first and the reused/non-empty toolbar path plus exact pre-existing workspace/session observation second.
- `finding_1785606464_142160` (medium): driver/coordinator hard-reject `BOTSTER_LIVE_ALLOW_SURFACE_SKIP` and every `BOTSTER_LIVE_ALLOW_*_SKIP` variable before browser launch; negative controls set both the known and a representative alternate flag and require nonzero exit.
- `finding_1785605529_965004` (blocker): removed the false unavailable-live-input premise; recorded all serial live baselines on exact Web/Hub/Workspaces commits and made the new real driver smoke an unconditional gate for this ticket.
- `finding_1785605529_254479` (high): assigned `scripts/workspaces-shared-hub-browser-smoke.mjs` as the repository-owned test-only coordinator, with explicit fixture lifecycle, package/app launch, managed-Git setup, driver invocation, completion proof, and cleanup ownership.
- `finding_1785605529_367470` (medium): made live protocol, caller repeatability, Workspaces compatibility, Workspaces lifecycle, and plugin contract matrix serial, unconditional acceptance commands with explicit inputs and provenance.
- `finding_1785605530_630314` (low): added Hub binary, session-worker binary, Workspaces package, Web build, and assignment-digest provenance to the per-run summary.
- `finding_1785605529_752020` (low): prohibited parsing/reconstructing authored row-ID prefixes, required opaque realized DOM identity plus structured entity/result correlation, and recorded sibling `ticket_1785602848_609148` as drift context rather than a dependency.

## Pipeline artifacts, gates, and checklists

- Commit this plan under the repository's established `docs/plans/` hierarchy and attach it to the active Plan step.
- The workflow checklist must record authoritative target resolution, repository-owned placement/code/CI inspection, explicit cross-repository ownership, baseline commands/results, and artifact/gate submission.
- The vault checklist must cite exact resolvable note titles, record no convention conflict, attach baseline verification evidence, and record whether implementation reveals a durable capture candidate.
- Submit the `botster_stack_plan_gate` only with all required fields populated from this artifact, then request advancement to `botster_stack_plan_review` without waiver.

## Vault gaps worth capturing

- Candidate after implementation: caller-owned client integration drivers must separate runtime observation/control from parent-owned Hub/package/Git lifecycle. Capture only if the same boundary recurs beyond Web/TUI and the final implementation provides a stable reusable rule.
- Candidate after downstream proof: cross-client acceptance evidence should share a correlation vocabulary while allowing renderer-native input drivers. Capture only after the Web and TUI outputs prove the shape in practice.
- Existing notes already cover explicit lifecycle ownership, real rendered interaction, structured action-result evidence, exact-entity readiness, deterministic invariants, stable routes, and no-refresh reconciliation. No new vault note is warranted at Plan time.

## Convention check

- No conflict found. This is a React/Ionic/browser harness change, so the Rails-specific fat-model/importmap conventions do not apply to implementation structure. The controlling Botster conventions require vanilla Ionic interaction, Hub/plugin authority, narrow production-path adaptation, deterministic structured evidence, explicit lifecycle ownership, and a downstream real consumer proof; the plan preserves all of them.
