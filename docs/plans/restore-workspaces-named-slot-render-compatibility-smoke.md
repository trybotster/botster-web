# Restore Workspaces named-slot render compatibility smoke

## Target repository and target

- Repository: `trybotster/botster-web`
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Ticket: `ticket_1785370604_722256`
- Run: `run_1785384357_911050`
- Assigned checkout: the Project Pipelines worktree for this ticket, not the ambient target checkout.
- Repository playbook: [[botster-web-playbook]]
- Botster layer: packaged browser acceptance harness over the production React/Ionic UiNode registry and stable plugin app route.

## Context loaded

- Role and architecture guidance: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], and [[spa-patterns]].
- Web charter guidance: [[botster web uses vanilla ionic primitives by default]], [[botster web dto field names must match authoritative rust serde structs]], [[botster web adapts hub validated snapshot grammar only on ui tree path]], [[botster web plugin app routes are stable host routes]], [[botster web request caches belong in react query not zustand or hub session getters]], [[botster toolbar actions use declaration order plus fixed overflow intent]], and [[ui presentation operations are authored by accepted action results]].
- Targeted runtime and smoke notes: [[plugin owned surface route renders run in plugin worker vms]], [[plugin surface handlers must validate against hub locked uinode contract]], [[plugin surface route completion needs explicit render phase]], [[runtime client acceptance must render delivered snapshots through real registry]], [[use slots not positional children for compound components with semantic regions]], [[required smoke modes must disable skips and prove execution positively]], and [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]].
- Pipeline routing guidance: [[project-pipelines-playbook]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]]. Project Pipelines implementation paths are not in scope; this overlay constrains durable plan/gate/checklist evidence only.
- Repository sources inspected: `README.md`, `package.json`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/UiNodeSurface.tsx`, `src/botster/IonicUiNodeRenderer.tsx`, and recent mainline plans/commits.
- Cross-repository producer inspected read-only: current `trybotster/botster-workspaces` `plugin.lua`, its runtime tests, and its Hub acceptance smoke.
- Pipeline context contains no prior reviews, findings, artifacts, dependencies, questions, or answers. Required gate: `botster_stack_plan_gate`.
- Vault workflow checklist: `checklist_1785384596_392169`.
- Repository-routed workflow checklist: `checklist_1785384782_182581`.

## Diagnosis and measured baseline

- `botster-web` main already contains the named-slot renderer change from commit `c5c8f3b` and a deterministic producer-shaped registry test in `src/App.test.mjs`. The production renderer walks:
  - a root `panel`'s `toolbar` and `body` slots;
  - a `toolbar`'s `actions` slot;
  - a `list_item`'s `title` and `meta` slots.
- Current `botster-workspaces` main emits `botster-workspaces-app`, with `botster-workspaces-toolbar` in `slots.toolbar` and `botster-workspaces-list` plus contextual dialogs in `slots.body`. In a fresh Hub/plugin database, the visible initial tree includes `botster-workspaces-new`, `botster-workspaces-empty`, and `botster-workspaces-empty-create`.
- The Web smoke instead requires `botster-workspaces-read-model`, `botster-workspaces-metrics`, `botster-workspaces-index-section`, `botster-workspaces-create-form`, and `botster-workspaces-spawn-form`. Those nodes are not emitted by the current production package. The forms are deliberately hidden until accepted presentation actions, and a spawn form additionally requires selected workspace/target state.
- Therefore the first missing `botster-workspaces-read-model` is a stale Web-owned acceptance oracle, not evidence that Workspaces failed to author named slots or that the production Ionic registry dropped them.
- The first local rerun was blocked by stale ignored dependencies (`@trybotster/ui-contract` 0.1.0 and `@trybotster/hub-test-support` 0.1.14); `npm install` restored the checked-in 0.1.1/0.1.16 pins without a tracked diff. A sandboxed rerun then failed because the isolated Hub/browser could not bind local sockets.
- The normal unsandboxed command reproduced the ticket exactly against Hub protocol 4/conformance revision 22 and current Workspaces main: the production DOM visibly contained `botster-workspaces/workspaces`, `Workspaces`, `Workspace actions`, `NEW WORKSPACE`, and `No workspaces`, then the harness timed out first on absent `botster-workspaces-read-model`. Hub installed and enabled the real Workspaces package in a fresh isolated data directory, so this is direct stale-oracle evidence rather than source inference.

## Scope

1. Update only the Workspaces branch of `assertSelectedAppSurfaceRendered` in `scripts/live-packaged-protocol-harness.mjs`.
2. Replace the stale synthetic/obsolete expected IDs with stable UiNodes actually emitted and visible from a fresh current Workspaces package:
   - root `botster-workspaces-app`;
   - named `toolbar` region `botster-workspaces-toolbar`;
   - toolbar action `botster-workspaces-new`;
   - named `body` region `botster-workspaces-list`;
   - cold-start empty state `botster-workspaces-empty`;
   - its visible create action `botster-workspaces-empty-create`.
3. Keep the existing unsupported-primitive and missing-capability rejection so DOM presence cannot hide a renderer fallback.
4. Keep the existing correlated three-stage completion counter and route assertions for initial navigation, reload, and direct load.
5. Preserve the raw daemon package versus projected package-family route-descriptor oracles introduced by ticket `ticket_1785295078_550933`; do not edit their readers, fallback rules, DTOs, dependencies, or assertions.
6. Update the Workspaces smoke documentation only if its claimed behavior no longer matches the executable acceptance path after the focused oracle correction.

## Non-scope

- No changes to `IonicUiNodeRenderer.tsx`, `UiNodeSurface.tsx`, `App.tsx`, UiNode adaptation, presentation state, entity binding, routes, or transport unless the corrected real-package smoke still proves an independent Web defect.
- No changes to `botster-workspaces`, Hub, session-worker, UI contract, hub-test-support, package manifests, generated DTOs, package-family projections, or npm versions.
- No fixture copied from Workspaces into Web and no second Workspaces model or browser-only product branch.
- No requirement that contextual create/spawn forms render before their owner-authored accepted presentation actions.
- No broad smoke refactor, optional configurability, adjacent cleanup, or weakening/skipping of the required runtime path.
- No Project Pipelines package/plugin or workflow-policy implementation change.

## Repository ownership boundaries and cross-repository dependencies

- `botster-web` owns the packaged browser harness, stable `/apps/:package/:surface` route, production Ionic registry invocation, DOM/runtime assertions, and three-stage proof ledger.
- `botster-workspaces` owns its product UiNode tree, stable node identities, contextual visibility, plugin database state, and action semantics. Its current main package is an acceptance input, not an edit target.
- `botster-hub` owns package admission, plugin-worker surface execution/validation, WebRTC delivery, and Hub/session-worker binaries.
- No cross-repository implementation prerequisite is currently indicated: the current Workspaces producer already authors valid named slots, and Web already renders a producer-shaped named-slot fixture. If the corrected oracle still receives the expected snapshot but the DOM drops a visible node, keep the fix in Web. If Hub rejects or omits the current Workspaces tree before delivery, stop and register a dependency against the owning Hub or Workspaces target rather than broadening this run.

## Assumptions and unknowns

- Assumption: acceptance runs against a clean isolated Hub data directory, so Workspaces begins with an empty plugin database and its cold-start nodes are visible.
- Assumption: `botster-workspaces-app`, `botster-workspaces-toolbar`, `botster-workspaces-new`, `botster-workspaces-list`, `botster-workspaces-empty`, and `botster-workspaces-empty-create` are intentional production node IDs, supported by current package source and package-owned runtime tests.
- Assumption: the existing renderer cases and deterministic named-slot test remain unchanged; this ticket repairs the live oracle rather than reimplementing named-slot rendering.
- Unknown: implementation must retain the exact Hub/worker/package commit or hash provenance for its final green run. The Plan baseline recorded paths and protocol/conformance versions, but the binaries themselves were not rebuilt or hash-pinned in this step.
- Ask-human threshold: if current merged Workspaces intentionally changed its cold-start surface again, or if satisfying the ticket would require asserting hidden contextual forms without driving their actions, ask rather than choose a new product contract silently.

## Affected surfaces and files

- `scripts/live-packaged-protocol-harness.mjs`: expected implementation change; focused Workspaces production DOM oracle only.
- `README.md`: conditional documentation correction if the paragraph claims the Workspaces compatibility mode performs action/form flows that it does not execute.
- `src/App.test.mjs`: expected unchanged; retains deterministic named-slot renderer and raw-versus-projected package-family coverage.
- `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, and `src/App.tsx`: expected unchanged production path, verified by tests and live smoke.
- `docs/plans/restore-workspaces-named-slot-render-compatibility-smoke.md`: this reviewable plan artifact.

## Implementation sequence

1. Reproduce the baseline with checked-in npm pins, current Workspaces main, and fresh Hub/session-worker binaries in an environment allowed to bind the isolated local sockets. Capture binary/package provenance, the selected route, delivered surface identity, visible text, and the first stale missing ID.
2. Narrow the Workspaces DOM oracle to the six visible production IDs above. Preserve scoping beneath `selected-app-surface`, unsupported/missing-capability checks, and the three-proof counter.
3. Do not touch renderer or package-family code unless the corrected live proof exposes a separate failure with delivered-snapshot-versus-DOM evidence.
4. Run deterministic Web gates, inspect the diff for the strict path allowlist, then run the required smoke with required mode and legacy skip enabled together to prove the user path still cannot be skipped.
5. Revert only the focused oracle correction as a negative control and confirm the live smoke returns to the stale missing-node failure; restore the fix and rerun green.

## Risks

- Replacing six stale IDs with one generic text check would weaken production registry proof. Mitigation: require the root plus descendants crossing `panel.toolbar`, `toolbar.actions`, and `panel.body`, all scoped to the selected app surface.
- Hard-coded product IDs can drift again. Mitigation: keep the set small and limited to package-owned stable cold-start nodes already asserted by Workspaces; do not mirror the full tree.
- A reused data directory could hide the empty-state nodes. Mitigation: retain the harness-owned isolated data directory and record ownership/provenance.
- A required smoke could pass through the legacy skip flag or after only one route. Mitigation: retain required-mode skip neutralization and the exact three-stage proof count.
- A renderer regression could be mislabeled as fixture drift. Mitigation: require delivered snapshot identity, no unsupported/missing-capability fallbacks, six real DOM node IDs, and initial/reload/direct-load completion.
- Adjacent package-family tests from PR #71 could be weakened accidentally. Mitigation: path-limit the implementation and rerun `npm test`; review must reject edits to raw/projected family selection or fallback semantics.

## Acceptance checks and downstream proof

1. Dependency/worktree hygiene:
   - installed packages match `package.json`/`package-lock.json`;
   - `git status --short` contains only the focused harness/documentation change plus this plan;
   - no local package override, sibling dependency, or generated DTO change appears.
2. Deterministic Web gates:
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - Existing `src/App.test.mjs` named-slot registry assertions remain green, including panel/section/toolbar/list-item slots and the raw-versus-projected package-family route descriptor controls.
3. Required downstream runtime proof:
   - `BOTSTER_HUB_BIN=<fresh exact Hub binary> BOTSTER_SESSION_WORKER_BIN=<matching fresh worker binary> BOTSTER_WORKSPACES_PACKAGE_PATH=<clean current Workspaces checkout> BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1 npm run smoke:workspaces-compat`
   - Record binary provenance, installed/enabled Workspaces package provenance, structured `plugin_surface_render` requests, matching delivered snapshot identity, and DOM presence of all six production nodes with no unsupported/missing-capability markers.
   - Require exactly three completed proofs: initial route navigation, browser reload, and direct `/apps/botster-workspaces/workspaces` load.
   - The command must exit nonzero if the Workspaces package is absent, the surface is rejected, any required production node is omitted, a fallback marker appears, any route phase is skipped, or the completion count is not three.
4. Regression negative control:
   - Temporarily restore the stale expected IDs (or revert the focused implementation commit) and show the same real-package smoke fails at the obsolete first missing node.
   - Restore the correction and rerun the exact command green.
5. Documentation audit:
   - README claims must describe only behavior the Workspaces compatibility mode actually performs; action/rejection/replacement claims remain attached to the contract-matrix proof unless the Workspaces smoke genuinely drives those interactions.

## Runtime path proof

`npm run smoke:workspaces-compat` builds the production Web bundle, starts an isolated supplied Hub/session-worker pair, installs and enables the current Web and Workspaces packages, launches Web through its packaged entrypoint, and opens the real browser app. The browser route dispatches `plugin_surface_render`; Hub executes the Workspaces `surface_route` in its plugin worker, validates and returns the UiNode snapshot; `App.tsx` passes it through `UiNodeSurface` to `ionicUiNodeRendererRegistry`; the harness then checks the real DOM beneath `selected-app-surface`. Reload and direct load repeat the same production route/transport/registry path.

## Pipeline gates and artifacts

- Plan artifact: this document.
- Plan gate: attach repository routing, loaded playbooks/notes, diagnosis, scope/non-scope, ownership/dependencies, assumptions, affected files, risks, acceptance/runtime proof, checklist evidence, and vault capture decision.
- Implement evidence: focused diff, baseline and negative-control failures, all deterministic commands, exact live command, binary/package provenance, structured route/snapshot evidence, six rendered production node IDs, no fallback markers, and proof count `3`.
- Review/Verify must reject text-only success, skipped Workspaces mode, reused state without ownership evidence, hidden-form expectations without action driving, renderer/package-family broadening without new evidence, or a green smoke lacking initial/reload/direct-load correlation.

## Vault gaps worth capturing

- Candidate durable note: first-party cross-repository browser smokes should assert the producer's stable visible cold-start nodes and semantic slot crossings, not synthetic nodes from a renderer conformance fixture or contextually hidden forms.
- Capture only after implementation confirms the corrected oracle and red/green live proof. Until then, preserve this as a candidate rather than documenting an unverified convention.
