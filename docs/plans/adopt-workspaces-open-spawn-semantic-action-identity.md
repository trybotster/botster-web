---
description: Plan to adopt the Workspaces semantic Spawn opener identity in the real shared-Hub browser driver without copy or node-shape coupling
---

# Adopt Workspaces open_spawn semantic action identity

## Target repository and target

- Ticket: `ticket_1785612604_234437`, “Web: adopt Workspaces open_spawn semantic action identity”.
- Run: `run_1785617734_802116`, Plan step `botster_stack_plan`.
- Authoritative target repository: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- `project_pipelines_current_context` supplied the target ID. The admitted spawn-target registry maps it to `/Projects/botster-web` and `repo_name=trybotster/botster-web`; the registry display name is misspelled `booster-web`, but target ID, path, and Git identity are unambiguous. Routing was not inferred from the pipeline worktree.
- Assigned worktree: this ticket worktree on `project-pipelines/ticket_1785612604_234437`, based on Web `origin/main`/HEAD `276979718f094c6b82e21d0c4ab3971a01eac570`.

## Repository playbook and context loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. Targeted role, runtime, renderer, identity, and Workspaces ownership notes below
5. [[project-pipelines-playbook]] for checklist, artifact, gate, dependency, and advancement discipline; Project Pipelines package/plugin code and workflow policy are not changed

Botster planning context:

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

Web charter and ticket-specific context:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web drops core uiaction payload and ignores interaction props]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[phase one action ids are semantic botster events not DOM event names]]
- [[conformance helpers must dispatch the action id read from the rendered node]]
- [[plugin authored tui surfaces dispatch via action props not node id literals]]
- [[runtime client acceptance must render delivered snapshots through real registry]]
- [[acceptance harness region oracles must key on node identity not concatenated text]]
- [[botster workspace records are plugin owned references not hub authority]]
- [[botster-workspaces-playbook]]

Repository context inspected:

- `README.md`, `package.json`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/workspaces-shared-hub-browser-driver.mjs`, `scripts/workspaces-shared-hub-browser-helpers.mjs`, `scripts/workspaces-shared-hub-browser-smoke.mjs`, `scripts/live-caller-owned-repeatability.mjs`, `src/App.test.mjs`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/uiNodes.ts`, and the existing plan `docs/plans/drive-workspaces-spawn-through-caller-owned-shared-hub.md`.
- Workspaces producer main `737ec8133c5f985f4c2bd5a369365049558afa56`, including semantic action change `5ede42462772443cb5007e62841793257a615292`, its README contract, package/runtime tests, and real-Hub smoke.
- Pipeline dependencies and sibling ownership: producer `ticket_1785611316_167898` and Web driver `ticket_1785602852_464676` are closed; TUI adoption `ticket_1785612604_598776` and final integration `ticket_1785192726_335558` remain separate owner runs. Open same-target BindList ticket `ticket_1785602848_609148` owns production descendant-ID realization and collision semantics; its scope is separable, but `src/App.test.mjs` is a shared edit surface that Implement must preserve and rebase around if it lands first.
- Initial pipeline context contained no findings, reviews, questions, answers, or prior artifacts. Plan Review `review_1785618794_764708` returned five findings; the revised test seam, negative-proof placement, code anchors, sibling survey, README scope, and tautology risk below resolve them without changing repository routing or implementation ownership.

## Baseline and observed gap

- `npm test`: passes.
- `npm run typecheck`: passes.
- `npm run lint`: exits 0 with the seven established Fast Refresh warnings and no errors.
- `npm run build`: passes; Vite reports the established large-chunk warning.
- The mandatory live command passes against Workspaces `737ec81` and Web `2769797`, proving the caller-owned Hub, cold/reused generations, three managed-Git cases, lifecycle transitions, and zero `list_sessions`/surface-rerender counts remain healthy.
- That live green is not semantic-action proof: `driveSharedHubSpawnCase` still selects `ion-button[data-action-id]` by visible `/^Spawn$/` text. It succeeds only because producer copy remains `Spawn`, even though the rendered action is now `botster_workspaces.open_spawn`. This is the exact false-green the ticket must remove.

## Scope and non-scope

In scope:

- Replace only the shared-Hub Workspaces detail Spawn opener’s visible-copy locator with exact delivered semantic action identity `botster_workspaces.open_spawn`.
- Read the selected opener’s realized `data-action-id` and opaque `data-ui-node-id` from the production DOM, require a unique exact semantic match, and click it through the existing Ionic callback.
- Correlate that exact read-back identity through the normal `plugin_surface_action` request and accepted action result. Preserve and assert the producer-authored payload that arrives through the renderer callback; do not construct the request.
- Extend structured per-case evidence and the two-generation ledger so every case proves the opener action/node/request/result identity before the target-first and final Spawn form flow.
- Add deterministic negative proof through the same exported selector used by the live harness: production-rendered buttons with changed copy still match, while a Spawn-shaped button carrying generic `botster_workspaces.open` plus the old dialog payload does not. Add deterministic guards for the emitted opener evidence and deletion of the `/^Spawn$/` path; treat ledger validation as evidence-schema consistency, not independent generic-action rejection.
- Update the README’s now-stale temporary copy-selector explanation and its pointer to subsumed duplicate `ticket_1785611385_764864`; cite delivered producer `ticket_1785611316_167898` at Workspaces `737ec81`, then commit this routed plan in the repository’s established `docs/plans/` hierarchy.

Non-scope:

- Changes to production React/Ionic rendering, `UiNode` adaptation, Hub transport, action envelope construction, generated DTOs, package manifest, or browser state policy.
- Workspaces producer changes, action registration, payload/dialog semantics, dynamic node-ID shape, visible product copy, lifecycle grouping, workspace records, or managed-Git behavior.
- TUI adoption or the final cross-client integration matrix.
- A compatibility fallback to label parsing or generic `botster_workspaces.open`, a browser-authored `UiActionRequest`, direct payload dispatch, Workspaces-specific React branches, sibling checkout overrides, optional configuration, broad helper refactors, or adjacent cleanup.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns** the production browser DOM/renderer integration, Playwright driver, caller-owned shared-Hub browser evidence, and generic read-back/callback/transport assertions. All planned edits stay in this repository.
- **botster-workspaces owns** the semantic `botster_workspaces.open_spawn` vocabulary, authored node/action/payload, registered handler, target-first presentation, workspace semantics, and package tests. Closed dependency `ticket_1785611316_167898` delivered that contract at Workspaces main `737ec81`; Web consumes it without fallback or local policy.
- **botster-hub owns** UiNode validation, plugin-worker routing, accepted action results, session/target/template/Git authority, and shared daemon lifecycle. No Hub change is indicated; the existing binary path proves the flow today.
- **botster-tui owns** its separate production frame/HitMap/keyboard adoption in open ticket `ticket_1785612604_598776`. This Web run must not edit or block on the TUI worktree.
- **Same-target BindList work stays separate:** open Web ticket `ticket_1785602848_609148` owns renderer descendant realization and duplicate-ID collision handling, not semantic Spawn selection. It is not a dependency, but both tickets touch `src/App.test.mjs`; preserve its work if it merges before implementation.
- **Final Workspaces integration** remains `ticket_1785192726_335558` on target `tgt_71266a8d976d4535902ffed09c18a7ba`. It consumes merged producer, Web, and TUI artifacts and owns the combined clean-Hub downstream gate.
- Current ticket dependencies are correctly registered against their owner targets and are closed. No new blocking dependency is required. A newly demonstrated producer, Hub, or TUI defect must be routed to its authoritative target rather than repaired here.

## Assumptions and unknowns

- Verified against the real code path: `actionFromValue` in `src/botster/IonicUiNodeRenderer.tsx` reads `UiAction.payload`; the button primitive at the same file's production renderer emits `data-ui-node-id`/`data-action-id` and calls `options.dispatchAction(dispatch)`; `dispatchPluginSurfaceAction` in `src/App.tsx` calls `pluginSurfaceActionRequest(surfaceId, dispatch)` and forwards `dispatch.action.payload` into the normal Hub action binding. There is no `uiActionRequestFromDispatch` symbol in this repository.
- Verified: Workspaces intentionally preserved the Spawn payload `{ selected_workspace, dialog: "spawn-target:<workspace>" }`; “deprecated generic open plus dialog payload path” means generic action-plus-payload discrimination is no longer the selection identity, not that the producer payload should be dropped.
- Required: the driver must require exactly one visible semantic opener in selected detail. Zero or duplicate matches fail with bounded realized action/node diagnostics rather than falling back to copy or node shape.
- Required: opaque identity means read back and compare the literal `data-ui-node-id`; never concatenate, slice, regex, or otherwise reconstruct `botster-workspaces-spawn-<workspace_id>`.
- Required test seam: export one selector constant, `WORKSPACES_SPAWN_OPENER_SELECTOR = "ion-button[data-action-id='botster_workspaces.open_spawn']"`, from `scripts/workspaces-shared-hub-browser-helpers.mjs`. `driveSharedHubSpawnCase` and the production-renderer test must consume that exact constant so the tested selector and live selector cannot drift.
- Required negative-proof placement: generic-action rejection belongs where it can go red—before semantic selection on a production-rendered generic-action fixture. The live request/result capture helpers are keyed by selector-derived action/node values, so downstream ledger validation inherits that pinning and is credited only for evidence presence and internal consistency, not as independent generic-action proof.
- No convention conflict was found. The plan uses the delivered generic action contract, preserves producer/runtime ownership, and follows the cold-turkey no-fallback requirement.

## Affected surfaces and files

- `scripts/live-packaged-protocol-harness.mjs`: semantic opener selection, unique DOM identity read-back, normal click, exact opener request/result/payload correlation, bounded failure diagnostics, and per-case structured evidence.
- `scripts/workspaces-shared-hub-browser-helpers.mjs`: one exported semantic selector constant plus strengthened ledger assertions over captured opener evidence; no UI abstraction or product-specific React policy.
- `src/App.test.mjs`: render the real Ionic button primitive twice with identical opaque node/action/payload and different visible labels; prove both match the exact exported selector contract, a generic-action/old-dialog fixture does not, the ledger schema rejects inconsistent evidence, and source guards preserve `spawn_opener` emission while deleting the `/^Spawn$/` path.
- `README.md`: replace the obsolete visible-label explanation and stale subsumed-ticket pointer with the delivered producer revision, semantic read-back contract, and negative guarantees.
- `docs/plans/adopt-workspaces-open-spawn-semantic-action-identity.md`: this reviewable plan artifact.

Expected unchanged: `scripts/workspaces-shared-hub-browser-driver.mjs`, `scripts/workspaces-shared-hub-browser-smoke.mjs`, `package.json`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/uiNodes.ts`, generated protocol files, package manifest, production React application code, and dependencies. Touch one only if a focused failing test proves the ticket cannot be satisfied through the existing harness seam and return that scope change to Plan Review.

## Implementation sequence

1. Export `WORKSPACES_SPAWN_OPENER_SELECTOR` from the existing shared-Hub helper module. In `src/App.test.mjs`, render the production `button` primitive twice through `ionicUiNodeRendererRegistry`/`renderToStaticMarkup` with the same opaque node ID, `botster_workspaces.open_spawn`, and producer payload but two different labels. Require both realized outputs to carry the same `data-action-id`/`data-ui-node-id` and satisfy that same exported selector contract. Render a third Spawn-shaped fixture with `botster_workspaces.open` plus the old dialog payload and require the selector contract not to match it. Missing/duplicate semantic matches must also fail.
2. In `driveSharedHubSpawnCase`, import that exact selector constant, scope it to the selected app surface, require exactly one match, and read both DOM attributes. Retain the node ID as an opaque literal and click that same element. Do not inspect `textContent`, duplicate the selector string, or derive a selector from workspace identity.
3. Correlate the click to the captured `plugin_surface_action` and accepted result using the read-back action/node values. Assert the normal renderer callback carried the producer payload for the selected workspace/target-first dialog; never send or hand-author the request. Do not place a generic-action negative assertion here because the selector already pins `open_spawn` and would make it dead code.
4. Add a bounded `spawn_opener` record to each case summary containing DOM read-back identity, the captured request action/node/payload, and matching accepted result. Strengthen `assertTwoGenerationLedger` so all cold/reused cases require well-formed, internally consistent opener evidence, the existing payload shape, and existing reconciliation evidence. Because request/result capture is keyed by the selector-derived identity, this ledger validates emitted evidence shape; it is not an independent negative oracle for generic action identity.
5. Delete the visible-copy selector and add source guards proving `filter({ hasText: /^Spawn$/ })` is absent and each case still emits captured `spawn_opener` request/result evidence. Keep these as backstops to the production-renderer/selector execution, not substitutes. Record two ablations: restoring the copy filter must fail the source guard, and swapping the rendered semantic identity to generic open must fail the production-renderer selector fixture. Renaming/removing `spawn_opener` emission must fail the deterministic source guard.
6. Update README wording and replace its stale `ticket_1785611385_764864` pointer with delivered producer `ticket_1785611316_167898` / Workspaces `737ec81`, then run focused tests, repository gates, and the mandatory real shared-Hub browser smoke. Confirm all existing summary fields and managed-Git/lifecycle/count assertions remain present.

## Risks

- **False semantic proof:** replacing the selector but dispatching a constant or handcrafted request would not prove the rendered control. Mitigation: read both attributes from the exact DOM element, click it, and correlate captured request/result identity.
- **Copy coupling hidden by unchanged producer text:** the live smoke is green today because the copy remains `Spawn`. Mitigation: deterministic changed-copy ablation plus a source guard prohibiting the text selector.
- **Deprecated-path compatibility leak:** allowing `botster_workspaces.open` with dialog payload would preserve ambiguity. Mitigation: require exact semantic selection and reject the production-rendered generic-action fixture; retain no fallback.
- **Tautological negative assertion:** checking `!= botster_workspaces.open` anywhere downstream of selector-keyed waits or capture cannot fail against live data and repeats a defect caught in producer review. Mitigation: credit generic rejection only to the pre-selection production-renderer fixture; use the ledger only for emitted-evidence consistency.
- **Payload misunderstanding:** deleting the producer-authored dialog payload would break accepted presentation behavior. Mitigation: assert it arrived through the normal callback while rejecting it as a selector discriminator.
- **Opaque-ID regression:** reconstructing the current dynamic ID would couple Web to Workspaces internals. Mitigation: treat DOM read-back as a literal and compare only request/result echo.
- **Duplicate-action ambiguity:** `.first()` can hide a producer regression with two Spawn openers. Mitigation: require exactly one semantic match and emit bounded action/node diagnostics.
- **Evidence regression:** changing the per-case schema could accidentally drop current session/Git/lifecycle/count proof. Mitigation: additive `spawn_opener` evidence and strengthened existing ledger, with unchanged downstream fields.
- **Ownership expansion:** editing React or Workspaces to make the harness easy would introduce client-specific policy. Mitigation: keep changes in the acceptance driver/helper/docs unless a focused production defect is independently proven and routed.
- **Live-environment attribution:** Hub and worker binaries may not have build receipts even when paths/digests are stable. Mitigation: retain the existing explicit unverified dispositions and exact Workspaces/Web commits; do not infer binary source commits from adjacent checkouts.

## Acceptance checks and tests

Focused deterministic proof:

- `npm test` imports the exact selector used by the live harness, renders the production Ionic button primitive twice with altered labels, and proves both realized outputs retain the same semantic action and opaque node identity under that selector.
- A production-rendered Spawn-shaped fixture carrying `botster_workspaces.open` plus the old dialog payload is not selected; missing/duplicate `open_spawn` also fail.
- `assertTwoGenerationLedger` rejects missing or internally inconsistent opener evidence, mismatched opaque node identity, or missing producer payload correlation. A hand-mutated generic identity exercises this schema branch but is not credited as production generic-action rejection.
- Source guards prove the live harness imports the shared selector and the old `filter({ hasText: /^Spawn$/ })` path is absent.
- Ablations are explicit: restoring the old copy filter fails the source guard; changing the rendered semantic identity to generic open fails the production-renderer selector fixture; removing `spawn_opener` emission fails the deterministic source guard. No negative identity assertion downstream of selector-keyed capture is credited as independent proof.

Repository gates required by [[botster-web-playbook]]:

- `npm test`.
- `npm run typecheck`.
- `npm run lint`; no new errors or warnings, with the seven current Fast Refresh warnings recorded as baseline.
- `npm run build`; no new build warnings attributable to this ticket.
- `npm run smoke:browser-runtime` to keep the packaged production renderer/browser path healthy.
- Protocol drift remains checked by `npm test` against `@trybotster/hub-test-support`; generated DTOs are expected unchanged, so no separate artifact regeneration is planned.

Mandatory runtime/user-path proof:

- Run `BOTSTER_HUB_BIN=<exact hub binary> BOTSTER_SESSION_WORKER_BIN=<exact matching worker> BOTSTER_WORKSPACES_PACKAGE_PATH=<merged Workspaces checkout> npm run smoke:workspaces-shared-hub-browser` with local socket/Chromium permission.
- Require installed Hub-launched botster-web and merged Workspaces, production React/Ionic rendering, exact semantic DOM selection, normal click callback, WebRTC/Hub `plugin_surface_action`, accepted `open_spawn` result, target-first dialog, final `botster_workspaces.spawn`, and correlated canonical session/Git evidence.
- Every cold/reused case summary must include exact read-back opener action/node identity and matching request/result; no opener request may use generic `botster_workspaces.open`.
- Preserve both generations, cold empty-state and reused toolbar create paths, prior-state observation, all three managed-Git outcomes, optional-empty field case, current-to-ended lifecycle rendering, unchanged `plugin_surface_render`, zero `list_sessions`, skip rejection, immutable binary digests, and structured provenance/ledger completion.
- Failure to run the live command is an unmet gate, not replaceable by source regexes, snapshots, or helper unit tests.

Applicable regression smokes:

- Run serially with explicit Hub/worker/Workspaces inputs: `npm run smoke:workspaces-compat`, `npm run smoke:workspaces-lifecycle`, `npm run smoke:live-packaged-protocol:caller-repeatability`, and `npm run smoke:plugin-contract-matrix`. Exact base-versus-branch evidence is required for any failure; pre-existing failures are not blanket waivers.

Downstream proof required by the charter:

- After this Web ticket and TUI adoption `ticket_1785612604_598776` merge, final integration `ticket_1785192726_335558` must consume published/merged producer and consumer artifacts on a clean Hub and run the combined browser/TUI managed-Git, lifecycle, collision, history, and non-destructive cleanup scenario.
- This Web run supplies the browser `spawn_opener` records to that aggregate evidence but does not implement or waive the TUI/final integration path.

## Plan Review finding resolution

- `finding_1785618794_563466` (high): removed the dead post-selector generic-action assertion. After Verify traced the full operand provenance, generic rejection is credited only to the pre-selection production-renderer fixture; the selector-keyed two-generation ledger validates evidence presence and consistency without claiming independent rejection.
- `finding_1785618794_814808` (high): removed Implement discretion over the proof seam. One exported `WORKSPACES_SPAWN_OPENER_SELECTOR` must be consumed by both the live Playwright path and production-renderer tests with changed-copy and generic-action fixtures; the source guard is only a backstop.
- `finding_1785618794_153420` (medium): replaced the nonexistent `uiActionRequestFromDispatch` citation with the verified `actionFromValue`/button dispatch path in `src/botster/IonicUiNodeRenderer.tsx` and `dispatchPluginSurfaceAction`/`pluginSurfaceActionRequest` payload forwarding in `src/App.tsx`.
- `finding_1785618794_465183` (low): recorded same-target BindList ticket `ticket_1785602848_609148` as separable scope with `src/App.test.mjs` overlap, not a dependency.
- `finding_1785618794_787930` (low): expanded the README edit to remove the subsumed duplicate pointer and cite delivered producer `ticket_1785611316_167898` / Workspaces `737ec81` with the final negative guarantees.

## Pipeline artifacts, gates, and checklists

- Attach this file as the durable Plan artifact for `run_1785617734_802116` / `run_step_1785617734_343868`.
- Workflow checklist evidence records authoritative target routing, code/README/CI inspection, dependency and sibling ownership, baseline commands, and Plan artifact/gate submission.
- Vault checklist evidence cites exact resolvable note titles, records no convention conflict, records baseline and required verification, and records whether implementation yields durable knowledge.
- Submit `botster_stack_plan_gate` with all required fields from this artifact, then request advancement to `botster_stack_plan_review` without waiver.

## Vault gaps worth capturing

- No durable vault note is required during Plan. Existing [[conformance helpers must dispatch the action id read from the rendered node]], [[phase one action ids are semantic botster events not DOM event names]], and [[acceptance harness region oracles must key on node identity not concatenated text]] already cover the rule.
- Reconsider capture after implementation only if the copy-change ablation establishes a reusable cross-client harness pattern not already expressed by those notes. The spawn-target display typo `booster-web` is workflow metadata drift, but it did not create routing ambiguity in this run and should not trigger a duplicate capture by itself.
