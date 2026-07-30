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
- Plan Review `review_1785385252_248767` returned changes required with one high, two medium, and one informational finding. This revision adopts the stronger live `list_item` slot proof, removes the synthetic fixture naming trap, makes provenance fail closed, and corrects the negative-control interpretation. There are still no dependencies, questions, or answers. Required gate: `botster_stack_plan_gate`.
- Vault workflow checklist: `checklist_1785384596_392169`.
- Repository-routed workflow checklist: `checklist_1785384782_182581`.

## Diagnosis and measured baseline

- `botster-web` main already contains the named-slot renderer change from commit `c5c8f3b` and a deterministic synthetic registry test in `src/App.test.mjs`. The production renderer walks:
  - a root `panel`'s `toolbar` and `body` slots;
  - a `toolbar`'s `actions` slot;
  - a `list_item`'s `title` and `meta` slots.
- Current `botster-workspaces` main emits `botster-workspaces-app`, with `botster-workspaces-toolbar` in `slots.toolbar` and `botster-workspaces-list` plus contextual dialogs in `slots.body`. In a fresh Hub/plugin database, the visible initial tree includes `botster-workspaces-new`, `botster-workspaces-empty`, and `botster-workspaces-empty-create`.
- The Web smoke instead requires `botster-workspaces-read-model`, `botster-workspaces-metrics`, `botster-workspaces-index-section`, `botster-workspaces-create-form`, and `botster-workspaces-spawn-form`. Those nodes are not emitted by the current production package. The forms are deliberately hidden until accepted presentation actions, and a spawn form additionally requires selected workspace/target state.
- The oracle was never satisfiable against the producer rather than becoming stale after a previously green state. Workspaces commit `20ad824` removed the read-model/metrics/index-section nodes on July 28 before Web commit `c5c8f3b` added the incompatible oracle on July 29; the unsuffixed spawn-form ID never existed, and the create form was already presentation-gated.
- Therefore the first missing `botster-workspaces-read-model` is a Web-owned, never-satisfiable acceptance oracle, not evidence that Workspaces failed to author named slots or that the production Ionic registry dropped them.
- The first local rerun was blocked by stale ignored dependencies (`@trybotster/ui-contract` 0.1.0 and `@trybotster/hub-test-support` 0.1.14); `npm install` restored the checked-in 0.1.1/0.1.16 pins without a tracked diff. A sandboxed rerun then failed because the isolated Hub/browser could not bind local sockets.
- The normal unsandboxed command reproduced the ticket exactly against Hub protocol 4/conformance revision 22 and current Workspaces main: the production DOM visibly contained `botster-workspaces/workspaces`, `Workspaces`, `Workspace actions`, `NEW WORKSPACE`, and `No workspaces`, then the harness timed out first on absent `botster-workspaces-read-model`. Hub installed and enabled the real Workspaces package in a fresh isolated data directory, so this is direct never-satisfiable-oracle evidence rather than source inference.
- Plan-time provenance inspection resolved clean Hub main/origin to `527ba0a58215531bf5b777a438887bd61f77b6fc` and clean Workspaces main/origin to `c78f3bfa80a88e89645ba8dbba892f18d6d041c7`. The binaries used for the Plan reproduction hashed to Hub `05afa625...` and worker `b9cece08...` but predated the resolved Hub commit, so that run corroborates the symptom only. Implement must rebuild exact binaries from clean Hub `527ba0a...` and use that one hash-pinned pair for both the original-oracle red run and corrected-oracle green run.

## Scope

1. Update the Workspaces production-proof path in `scripts/live-packaged-protocol-harness.mjs`.
2. Replace the never-satisfiable expected IDs with stable UiNodes actually emitted and visible from a fresh current Workspaces package:
   - root `botster-workspaces-app`;
   - named `toolbar` region `botster-workspaces-toolbar`;
   - toolbar action `botster-workspaces-new`;
   - named `body` region `botster-workspaces-list`;
   - cold-start empty state `botster-workspaces-empty`;
   - its visible create action `botster-workspaces-empty-create`.
3. During the initial route proof, drive the production owner-authored flow rather than asserting a hidden form:
   - click `botster-workspaces-empty-create` and assert the rendered action ID is the one dispatched;
   - require a correlated accepted `plugin_surface_action` result carrying presentation `set`;
   - wait for `botster-workspaces-create-form`, type a unique smoke-owned workspace name, and submit through the real Ionic form;
   - assert worker-visible `UiActionRequest.values.name`, an accepted presentation `clear`, and the owner-authored whole-surface replacement;
   - discover the resulting `botster-workspaces-row-<workspace-id>` from the rendered replacement and assert its `slots.title` node/text and `slots.meta` session-count node/text.
4. Persist the created workspace identity in the harness proof ledger. On reload and direct load, assert the same row, title, and meta nodes render from the package's durable state, alongside the root/toolbar/list nodes. Do not attempt a second create.
5. Keep the existing unsupported-primitive and missing-capability rejection so DOM presence cannot hide a renderer fallback.
6. Keep the existing correlated three-stage completion counter and route assertions for initial navigation, reload, and direct load, but increment each stage only after its expected live slot assertions complete.
7. In `src/App.test.mjs`, rename the deterministic named-slot fixture's `botster-workspaces-*` node IDs to an unmistakable `named-slot-fixture-*` namespace, change “Producer-shaped named-slot coverage” to “Synthetic named-slot renderer coverage,” and add an adjacent warning that its intentionally exhaustive slot shapes (including `list.empty`) are renderer conformance data, not a production-package oracle. Keep the renderer behavior and assertions equivalent.
8. Preserve the separate generic deterministic `list_item.actions` coverage already asserted by `directListItemMarkup`. Live owner-authored `list_item.actions` requires session membership and is intentionally left to the integration ticket `ticket_1785192726_335558`; this smoke proves the production list-item renderer branch through Workspaces-authored `title` and `meta`.
9. Preserve the raw daemon package versus projected package-family route-descriptor oracles introduced by ticket `ticket_1785295078_550933`; do not edit their readers, fallback rules, DTOs, dependencies, or assertions.
10. Correct the README so Workspaces compatibility claims match the now-executed accepted create/replacement behavior and remain distinct from the broader contract-matrix rejection flow.

## Non-scope

- No changes to `IonicUiNodeRenderer.tsx`, `UiNodeSurface.tsx`, `App.tsx`, UiNode adaptation, presentation state, entity binding, routes, or transport unless the corrected real-package smoke still proves an independent Web defect.
- No changes to `botster-workspaces`, Hub, session-worker, UI contract, hub-test-support, package manifests, generated DTOs, package-family projections, or npm versions.
- No fixture copied from Workspaces into Web and no second Workspaces model or browser-only product branch.
- No assertion that contextual forms render before their owner-authored accepted presentation actions; the create form is exercised only after the accepted `set`.
- No spawn flow, target/template setup, session membership, workspace detail action, or live `list_item.actions` proof. Those would broaden this renderer compatibility smoke into the separately owned end-to-end integration ticket.
- No broad smoke refactor, optional configurability, adjacent cleanup, or weakening/skipping of the required runtime path.
- No Project Pipelines package/plugin or workflow-policy implementation change.

## Repository ownership boundaries and cross-repository dependencies

- `botster-web` owns the packaged browser harness, stable `/apps/:package/:surface` route, production Ionic registry invocation, DOM/runtime assertions, and three-stage proof ledger.
- `botster-workspaces` owns its product UiNode tree, stable node identities, contextual visibility, plugin database state, and action semantics. Its current main package is an acceptance input, not an edit target.
- `botster-hub` owns package admission, plugin-worker surface execution/validation, WebRTC delivery, and Hub/session-worker binaries.
- No cross-repository implementation prerequisite is currently indicated: the current Workspaces producer already authors valid named slots, and Web already renders a producer-shaped named-slot fixture. If the corrected oracle still receives the expected snapshot but the DOM drops a visible node, keep the fix in Web. If Hub rejects or omits the current Workspaces tree before delivery, stop and register a dependency against the owning Hub or Workspaces target rather than broadening this run.

## Assumptions and unknowns

- Assumption: acceptance runs against a clean isolated Hub data directory, so Workspaces begins empty; the smoke may create exactly one harness-owned workspace inside that disposable state.
- Assumption: the cold-start IDs plus dynamic row/title/meta ID prefixes are intentional production identities supported by Workspaces `c78f3bf` source and package-owned runtime tests.
- Assumption: existing renderer cases remain unchanged; this ticket repairs the live proof and fixture labeling rather than reimplementing named-slot rendering.
- Provenance precondition: Hub and worker must be rebuilt with locked dependencies from clean Hub `527ba0a...`, then hashed; Workspaces must be clean at `c78f3bf...` with `HEAD == origin/main`. The same exact binary hashes and producer commit must run the original-oracle red control and corrected green proof, and Hub must report protocol version 4 matching pinned `@trybotster/hub-test-support@0.1.16`.
- Unknown: the created workspace UUID is runtime-assigned. The harness must discover it from the accepted replacement/rendered row and retain it; it must not assume a fixed UUID or parse arbitrary visible text.
- Ask-human threshold: if exact clean producer/binary provenance cannot be established, or current merged Workspaces changes the action/result/row contract from `c78f3bf`, stop rather than silently relax the proof.

## Affected surfaces and files

- `scripts/live-packaged-protocol-harness.mjs`: Workspaces initial-create, structured action/result, dynamic row-slot, reload, direct-load, and proof-ledger assertions.
- `README.md`: correct the Workspaces compatibility description to the executable live flow and its boundary.
- `src/App.test.mjs`: fixture-only node namespace/comment/text correction; renderer assertions and raw-versus-projected package-family coverage remain behaviorally unchanged.
- `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, and `src/App.tsx`: expected unchanged production path, verified by tests and live smoke.
- `docs/plans/restore-workspaces-named-slot-render-compatibility-smoke.md`: this reviewable plan artifact.

## Implementation sequence

1. Fetch and verify exact producer sources. Require clean Hub `527ba0a...` and Workspaces `c78f3bf...`, with each `HEAD == origin/main`.
2. Build `cargo build --locked --bin botster-hub -p botster-hub` and `cargo build --locked --bin botster-session-worker -p botster-core` in that Hub checkout; record SHA-256 for both binaries and require Hub protocol version 4.
3. With those exact hashes and producer commit, reproduce the original never-satisfiable oracle failure and capture the selected route, delivered identity, cold-start DOM, and first absent `read-model`.
4. Implement the cold-start assertions, one-time production create action/form/result/replacement flow, dynamic row/title/meta assertions, and reload/direct-load persistence assertions. Preserve unsupported/missing-capability checks and the three-proof ledger.
5. Rename/comment only the synthetic named-slot fixture namespace in `src/App.test.mjs`; keep its exhaustive renderer coverage and separate generic `list_item.actions` test behavior unchanged.
6. Do not touch renderer or package-family code unless the corrected exact-provenance proof exposes a separate delivered-snapshot-versus-DOM failure.
7. Run deterministic Web gates, inspect the diff for the strict path allowlist, then run required mode with the legacy skip flag enabled to prove it still cannot skip.
8. Revert only the oracle/flow correction and confirm the exact-provenance smoke reproduces the original never-satisfiable failure; restore the change and rerun green with identical binary hashes and producer commit.

## Risks

- Replacing six invalid IDs with one generic text check would weaken production registry proof. Mitigation: require root descendants crossing `panel.toolbar`, `toolbar.actions`, `panel.body`, and after real creation `list_item.title` and `list_item.meta`, all scoped to the selected app surface.
- A cold-start-only proof would still omit the Workspaces producer's list-item named slots. Mitigation: create one workspace through the accepted presentation/form path, discover its row identity, and require its title/meta slots before counting initial, reload, or direct-load stages.
- Live `list_item.actions` remains outside this narrow flow because Workspaces only emits it for session membership. Mitigation: disclose the gap, retain the generic deterministic actions-slot test, and reserve owner-authored session-action proof for `ticket_1785192726_335558`.
- Hard-coded product IDs can drift again. Mitigation: keep the set small and limited to package-owned stable cold-start nodes already asserted by Workspaces; do not mirror the full tree.
- Synthetic fixture IDs can be mistaken for product nodes again. Mitigation: use a fixture-only namespace and explicit warning while preserving the exhaustive slot grammar.
- A reused data directory could hide the empty-state nodes. Mitigation: retain the harness-owned isolated data directory and record ownership/provenance.
- A required smoke could pass through the legacy skip flag or after only one route. Mitigation: retain required-mode skip neutralization and the exact three-stage proof count.
- A renderer regression could be mislabeled as fixture drift. Mitigation: require delivered snapshot identity, no unsupported/missing-capability fallbacks, cold-start plus dynamic list-item DOM nodes, and initial/reload/direct-load completion.
- Stale binaries can make branch attribution meaningless. Mitigation: locked rebuild from clean exact Hub source, binary hashes, clean exact Workspaces commit, protocol/artifact parity, and identical provenance across red and green runs are preconditions.
- Adjacent package-family tests from PR #71 could be weakened accidentally. Mitigation: path-limit the implementation and rerun `npm test`; review must reject edits to raw/projected family selection or fallback semantics.

## Acceptance checks and downstream proof

1. Dependency/worktree hygiene:
   - installed packages match `package.json`/`package-lock.json`;
   - `git status --short` contains only the focused harness/test-fixture/documentation change plus this plan;
   - no local package override, sibling dependency, or generated DTO change appears.
2. Deterministic Web gates:
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - `src/App.test.mjs` named-slot registry assertions remain green under the fixture-only namespace, including panel/section/toolbar/list-item slots and the raw-versus-projected package-family route descriptor controls.
   - The separate `directListItemMarkup` test still proves `list_item.actions`.
3. Fail-closed runtime provenance:
   - Hub checkout is clean at `527ba0a58215531bf5b777a438887bd61f77b6fc` with `HEAD == origin/main`.
   - Workspaces checkout is clean at `c78f3bfa80a88e89645ba8dbba892f18d6d041c7` with `HEAD == origin/main`.
   - Locked Hub and session-worker build commands succeed; record SHA-256 and require the same hashes for red and green runs.
   - Running Hub reports protocol version 4, matching the protocol version validated from pinned `@trybotster/hub-test-support@0.1.16`.
4. Required downstream runtime proof:
   - `BOTSTER_HUB_BIN=<fresh exact Hub binary> BOTSTER_SESSION_WORKER_BIN=<matching fresh worker binary> BOTSTER_WORKSPACES_PACKAGE_PATH=<clean current Workspaces checkout> BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1 npm run smoke:workspaces-compat`
   - Record installed/enabled Workspaces provenance, structured render/action requests and action results, matching delivered snapshot identity, and no unsupported/missing-capability markers.
   - Initial route: require the six cold-start nodes; click the rendered empty-create action; require accepted `set`; type/submit a unique name; require worker-visible `values.name`, accepted `clear`, replacement, dynamic row, title text, and `0 sessions` meta text.
   - Reload and direct `/apps/botster-workspaces/workspaces` load: require the same discovered row/title/meta plus root/toolbar/list nodes from durable plugin state, without creating another workspace.
   - Require exactly three completed proofs, each incremented after its stage-specific slot assertions.
   - The command must exit nonzero if provenance differs, Workspaces is absent, a request/result is rejected or mismatched, a required node is omitted, a fallback marker appears, the workspace identity changes/disappears, any route phase is skipped, or the completion count is not three.
5. Original-oracle negative control:
   - Temporarily restore the never-satisfiable expected IDs (or revert the focused implementation commit) and show the same exact-provenance package smoke fails at the original first missing node.
   - Restore the correction and rerun the exact command green.
6. Documentation audit:
   - README claims must distinguish the Workspaces create-and-slot compatibility path from the broader contract-matrix rejection/conformance path and describe only executed behavior.

## Runtime path proof

`npm run smoke:workspaces-compat` builds the production Web bundle, starts an isolated supplied Hub/session-worker pair, installs and enables exact Workspaces `c78f3bf`, launches Web through its packaged entrypoint, and opens the real browser app. The browser route dispatches `plugin_surface_render`; Hub executes the Workspaces `surface_route` in its plugin worker, validates and returns the UiNode snapshot; `App.tsx` passes it through `UiNodeSurface` to `ionicUiNodeRendererRegistry`. The harness checks cold-start panel/toolbar/body slots, dispatches the rendered create action through the real worker, applies its accepted presentation result, submits real form values, applies the accepted replacement, and checks the Workspaces-authored list-item title/meta slots. Reload and direct load then repeat the route/transport/registry path and prove the same row from durable plugin state.

## Pipeline gates and artifacts

- Plan artifact: this document.
- Plan gate: attach repository routing, loaded playbooks/notes, diagnosis, scope/non-scope, ownership/dependencies, assumptions, affected files, risks, acceptance/runtime proof, checklist evidence, and vault capture decision.
- Implement evidence: focused diff, original-oracle failure, all deterministic commands, exact commits/build commands/binary hashes, exact live command, structured render/action/result evidence, cold-start and dynamic row/title/meta node IDs, no fallback markers, and proof count `3`.
- Review/Verify must reject text-only success, skipped Workspaces mode, non-identical red/green provenance, hidden-form assertions without an accepted `set`, fixed/fabricated workspace identity, synthetic fixture IDs presented as producer proof, renderer/package-family broadening without new evidence, or a green smoke lacking initial/reload/direct-load correlation.

## Vault gaps worth capturing

- Candidate durable note: first-party cross-repository browser smokes must not mine product-looking IDs from synthetic renderer fixtures; they should use exact producer provenance, drive owner-authored state transitions needed to reach named branches, and assert the producer's stable visible nodes.
- Capture only after implementation confirms the corrected oracle and red/green live proof. Until then, preserve this as a candidate rather than documenting an unverified convention.
