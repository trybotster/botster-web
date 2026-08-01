---
description: Plan for a production-shaped Web acceptance mode covering the Workspaces current, ended, and unavailable session lifecycle surface
---

# Exercise the Workspaces current and ended lifecycle surface

## Target repository and routing

- Ticket: `ticket_1785545085_392193`, "Web acceptance: exercise Workspaces current and ended lifecycle surface".
- Run: `run_1785545100_548796`, Plan step `botster_stack_plan`.
- Authoritative target: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- The target was resolved from Project Pipelines current context through the Botster spawn-target registry, then confirmed against this worktree's `origin`; it was not inferred from the ambient directory. The registry's display name is currently misspelled `booster-web`, but its path and `repo_name` resolve unambiguously to `trybotster/botster-web`.
- Assigned worktree: the current Project Pipelines ticket worktree on branch `project-pipelines/ticket_1785545085_392193`, at current `origin/main` commit `ebc72e5808ea8c8ce7c409936c257a3e02eaa5ef` when planned.

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. Targeted role, surface, and atomic guidance below
5. [[project-pipelines-playbook]] for the durable question, checklist, artifact, gate, and cross-repository dependency workflow used by this run; no Project Pipelines implementation is in scope

Additional repository/surface charter:

- [[botster-workspaces-playbook]] to define the downstream producer boundary without broadening this Web run into package semantics.

Botster planning and repository guidance:

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

Web and lifecycle constraints:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[plugin-owned dynamic state uses plugin-namespaced entity frames]]
- [[botster hub client state sync is entity frame only]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[botster web dogfood session readiness can arrive as entity snapshot]]
- [[browser plugin entity consumers use generic selectors]]
- [[runtime client acceptance must render delivered snapshots through real registry]]
- [[plugin surface actions route by explicit metadata]]
- [[conformance oracles assert action result frames not toast text]]
- [[ui contract row ids can bind before template expansion]]
- [[cold turkey migrations eliminate dual code paths and version suffixes]]

## Context loaded

- `project_pipelines_current_context` supplied the ticket, active run/step, gate schema, empty findings/reviews/artifacts, dependency state, and question state.
- Spawn-target resolution maps the ticket target to `trybotster/botster-web`; the repository remote and clean current-main worktree confirm that mapping.
- `README.md`, `docs/architecture.md`, `package.json`, current source/tests, CI-equivalent npm scripts, and prior repo-local plans were inspected. `docs/plans/` is established mainline placement authority for this artifact.
- The existing production-shaped `scripts/live-packaged-protocol-harness.mjs` already installs/enables a supplied real Workspaces package, opens its stable app route, drives create through rendered Ionic controls, observes structured `plugin_surface_action`/`action_result` frames, and proves reload/direct-load persistence. Its `contract.sessions` mode already proves canonical `session` snapshot/delta/reconnect materialization through the real WebRTC transport and renderer.
- The current Web compatibility command is `npm run smoke:workspaces-compat`; it proves the current Workspaces index/create/list route but not owner-authored current/ended detail grouping.
- Authoritative `botster-workspaces` main was inspected at `c78f3bfa80a88e89645ba8dbba892f18d6d041c7`. Its README and `plugin.lua` deliberately preserve raw `session_refs` and state that lifecycle grouping is deferred. The package nevertheless already exposes rendered workspace selection, detail, Add session, and remove-membership actions needed to exercise the generic Web path.
- The installed `@trybotster/ui-contract@0.2.0` admits literal UiNode ids on roots and descendants, while the bound form is admitted only on the direct `UiBindList.item_template` root where row context exists. `IonicUiNodeRenderer.tsx` realizes a bound root identity, drops empty/non-string identities, and filters colliding realized identities. Distinct bound ids on descendants are not part of the current contract.
- Cross-repository ticket `ticket_1785296184_677408` owns Workspaces lifecycle meanings and already has explicit dependency `dependency_1785545092_175214` on this Web ticket (plus the parallel TUI acceptance dependency). No dependency mutation is needed here.
- Human answer `question_1785545318_550751` chose a green Web-owned runner with a deliberate real-package red oracle: land the production-shaped mode first, prove its mechanics independently, then run that exact mode against Workspaces main `c78f3bf` and capture the precise package-owned lifecycle assertion failure. Do not commit a failing default test, xfail/skip, weakened assertion, or simulated Workspaces lifecycle state. The downstream Workspaces ticket must run the same merged command to green before it can close.
- Planning baseline on `ebc72e5`: `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0. Lint reports the existing seven `react-refresh/only-export-components` warnings and no errors; build reports the existing large-chunk warning.

## Scope

1. Add one explicit, opt-in Workspaces lifecycle acceptance command/mode alongside the existing compatibility smoke. It must require a supplied real `botster-workspaces` package and fresh harness-owned Hub data, then install/enable/open that package through the normal Hub, plugin-worker, WebRTC, route, production renderer, and entity-store path.
2. Reuse the existing live harness instead of creating a parallel browser or transport runner. Keep current Workspaces compatibility coverage green and compose the lifecycle scenario after the existing create/route proof.
3. Seed canonical UUID sessions only through public daemon requests: a session that will transition, a stable ended session, and a session that will later be removed; retain an additional never-existing canonical UUID as the unknown reference.
4. Create and select a workspace through rendered controls. Add every session reference through the owner-authored Add-session button/dialog/form, sourcing action metadata from rendered nodes and submitting actual form values. Assert the corresponding structured request and accepted result for generic form/action dispatch; never call package tools directly or hand-author `plugin_surface_action` payloads.
5. Assert the delivered owner-authored detail tree through the production `UiNodeSurface` DOM: current references appear in the package-authored current region, ended references remain legible in its ended/history region, and never-existing or subsequently removed references remain visibly unavailable rather than disappearing. Under UI Contract 0.2.0, identify each materialized repeated session-reference row by its direct `item_template` root, accepting either a producer-authored literal id or the contract-admitted bound root id; identify an absent-reference row by the exact-reference BindList's direct literal `empty_template` root. Scope labels, lifecycle badges, unavailable text, and actions by DOM containment and generic semantic role/action inside that row root; a static region-container node id may identify a current/ended/unavailable section. Never require bound ids on row descendants or invent a Web-owned descendant-id grammar.
6. Shut down the transition session through the public daemon API and wait for canonical family `session` entity convergence. Prove the rendered reference moves current -> ended without another surface render, legacy list request, or imperative refresh.
7. Remove the designated historical session through the public daemon API and prove its workspace reference remains visibly unavailable after the canonical `entity_remove`; do not click Workspaces remove-membership, because deliberate history is the behavior under test. Report this `removed-reference` oracle independently from the `never-existing-reference` oracle.
8. Reload the same stable app URL, prove a fresh `subscribe_entities` generation and authoritative snapshot precede later deltas, reselect the workspace through its rendered row, and reassert ended plus unavailable history. Reject stale-generation, list-refresh, or browser-authored lifecycle shortcuts.
9. Make unmet assertions fail non-zero with compact last-state evidence: stage, the delivered UiNode tree relevant to the surface, rendered row-root ids/text, canonical session records/frame chronology, latest subscription id, and any unexpected surface-render/list requests. For every expected reference row, include its direct `item_template` identity kind (`literal` or `bound`), source, resolved value, its literal `empty_template` identity when absence materializes that branch, and one outcome: `materialized`, `dropped-empty`, `dropped-collision`, or `not-authored`. A failure must say whether the producer never authored the row, Web dropped it because identity was empty/unresolvable, or Web dropped it because realized identity collided. Materialized literal ids must be non-empty, stable for the same stored reference, unique across references/actions, and contain no unresolved binding sentinel. Only `not-authored` is producer-red evidence for `ticket_1785296184_677408`; either drop classification is a Web-owned generic renderer defect to repair in this ticket with focused coverage. Diagnostics must not dump broad logs or secrets.
10. Add Web-owned deterministic tests for mode/state ownership, lifecycle scenario stage/oracle helpers, converged snapshot/upsert/patch/remove matching, reconnect-generation evidence, user-interaction request/result matching, and failure diagnostic formatting. Cover `materialized`/producer-`not-authored`, `dropped-empty`, and `dropped-collision` classification separately, plus separately labeled `never-existing-reference` and `removed-reference` failures. Use existing green real package/Hub paths to prove runner mechanics; do not encode fake Workspaces lifecycle truth to make the end assertion green.
11. Run the exact opt-in command against authoritative Workspaces main `c78f3bf` and attach its expected non-zero lifecycle assertion plus last-state output as downstream pre-fix evidence. After this ticket merges, `ticket_1785296184_677408` must use the identical merged command and its real package path as the green consumer proof.
12. Document the new command, ownership rules, current pre-fix-red/downstream-green contract, and fresh-data requirement in `README.md`.

## Non-scope

- No Workspaces lifecycle grouping, labels, policy, entity hydration, persisted lifecycle truth, or package surface changes in this repository.
- No changes to `botster-workspaces`, Hub/Core, TUI/TUI-kit, published UI contracts, generated daemon DTOs, or test-support packages.
- No browser-only workspace/session model, Workspaces-specific React state, renderer-specific prop, local lifecycle classifier, fixture resolver, imperative list refresh, polling, `list_sessions`, or compatibility alias.
- No hand-authored package action requests, direct package tool/database mutation, force-click, DOM event injection, or sibling-worktree/package override. The package path is an explicit operator input and is installed by Hub normally.
- No descendant-id synthesis, client-local id rewriting, or assertion that requires distinct bound `item_template` descendant ids. Producer-authored literal descendant and action ids are valid when the producer expands one exact-reference BindList per stored UUID and keeps those ids unique; the Web oracle locates controls by row containment and semantic role/action instead of hard-coding a client-owned descendant grammar.
- No failing default `npm test`, skipped/xfail lifecycle test, optional weak assertion, or simulated green result against the currently incomplete producer.
- No broad live-harness split, renderer/entity-store refactor, adjacent cleanup, dependency bump, package publication, or new abstraction beyond a small test helper justified by deterministic self-tests.
- No change to the existing `smoke:workspaces-compat` contract except minimal shared helper extraction needed by the new mode.
- No Project Pipelines package/plugin implementation changes; its tools are used only to persist this run's evidence.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns:** the opt-in command, Playwright/live-Hub orchestration, real Ionic route/component interaction, generic action dispatch observation, WebRTC subscription/reconnect observation, entity-store/DOM assertions, failure diagnostics, and Web-owned deterministic coverage.
- **botster-workspaces owns:** workspace records and membership, current/ended/unavailable presentation semantics, owner-authored UiNode identity and detail layout, retention of historical references, and the eventual green real-package result. `ticket_1785296184_677408` is the owning downstream ticket and already depends on this ticket.
- **botster-hub / hub-client / UI contract own:** canonical session UUID and lifecycle truth, entity snapshot/upsert/patch/remove/subscription semantics, package admission/plugin-worker action routing, and renderer-neutral UiNode/action contracts. The Web harness consumes their public interfaces without patching producer behavior.
- **Hub descendant identity constraint:** open Hub ticket `ticket_1785443253_376782` on target `tgt_7e208a0c76a44980a83b63af976b1f22` owns any contract expansion for distinct bound identities on `BindList` descendants. This plan accepts a literal or bound direct row-root identity and deliberately needs no bound descendant identity, so that ticket is not a blocker. If implementation proves bound descendant identity is necessary, stop and register the prerequisite against the Hub target rather than inventing a Web or Workspaces workaround.
- **botster-tui owns:** its parallel terminal-client acceptance mode in `ticket_1785545086_939840`; this run neither copies nor waits on TUI implementation.
- **final integration owns:** `ticket_1785192726_335558` remains the clean-data end-to-end workspace/browser/TUI/Hub spawn proof after producer and both consumer modes land.
- If the harness exposes a genuinely generic Web renderer/reconnect defect, this ticket may repair it narrowly with regression coverage. If it exposes package lifecycle semantics, Hub lifecycle truth, or contract grammar defects, stop and route evidence to the owning target rather than broadening this run.

## Assumptions and unknowns

- Binding human decision: Web's repository remains green while the opt-in command is expected to return non-zero against Workspaces `c78f3bf`; that exact red is required evidence, not a Web regression or waiver.
- Assumption: a new explicit script such as `smoke:workspaces-lifecycle` is clearer than overloading `smoke:workspaces-compat`; settle the final env flag/name by following existing script naming, with one canonical path and no alias.
- Assumption: canonical UUIDs are accepted by current Workspaces Add-session validation even when absent from Hub, and daemon `spawn`, `shutdown_session`, and `remove_session` provide the sanctioned setup/transitions already used by the live harness.
- Corrected contract constraint from human answer `question_1785546638_867097`: repeated session rows expose stable identity on the direct `item_template` root, using either a producer-authored literal id or the contract-admitted bound form. The Web runner may use static region-container ids and must find row labels/badges/actions by containment and semantic action; bound descendant ids are neither assumed nor accepted as a prerequisite.
- Assumption: reload clears client-local selected-workspace presentation, so the scenario must reselect the workspace through its rendered row after authoritative reconnect hydration rather than mutating local presentation state.
- Unknown: the exact owner-authored current/ended/unavailable node ids and wording do not exist on `c78f3bf`. The runner should express semantic expectations once, with diagnostics precise enough for the downstream implementer; it must not guess production props or accept generic raw UUID rows as lifecycle proof.
- Unknown: whether the current package publishes its own workspace entity snapshot before surface render or returns replacement trees after every Add action. The harness should observe the actual public action/surface flow and avoid requiring a specific plugin-internal refresh mechanism unless it is part of the shared contract.
- Unknown: whether a generic renderer defect is exposed by nested lifecycle BindLists on the future package. No renderer file is pre-authorized by this plan; any such change requires a failing generic reproduction and remains limited to the ticket's real surface.

## Affected surfaces and files

- `package.json`: add the one opt-in lifecycle smoke command/env mode.
- `scripts/live-packaged-protocol-harness.mjs`: compose the real Workspaces create/select/add/current->ended/remove/reconnect scenario; preserve existing compatibility behavior; emit precise non-zero last-state evidence.
- `scripts/live-packaged-protocol-helpers.mjs`: only small pure state/oracle/diagnostic helpers needed for deterministic Web-owned tests.
- `src/App.test.mjs`: deterministic tests for lifecycle-mode ownership, helper behavior, entity/reconnect/action chronology, and failure diagnostics; reuse the production renderer/store fixtures where appropriate without simulating a green Workspaces product surface.
- `src/botster/IonicUiNodeRenderer.tsx`: expected unchanged unless the live oracle classifies a missing row as `dropped-empty` or `dropped-collision`; in that case this ticket owns the narrow generic renderer repair and focused tests.
- `README.md`: command, required Hub/worker/package inputs, fresh-data ownership, current producer-red evidence, and downstream same-command green requirement.
- `docs/plans/workspaces-current-ended-lifecycle-acceptance.md`: this durable Plan artifact and later evidence clarifications if Plan Review changes the contract.
- `src/botster/entities.ts` or WebRTC transport files: expected unchanged; touch only for a reproduced generic Web defect with focused regression proof.

## Implementation sequence

1. Keep the current-main green baseline and inspect the final package surface delivered by the explicit package path; do not use any sibling worktree.
2. Add a single lifecycle-mode flag/script and strengthen fresh-data/package-path validation without changing the default or existing compatibility mode.
3. Extract only deterministic helper logic that must be unit-tested: scenario identity/state, event chronology/oracles, direct row-root identity resolution/classification, and compact last-state diagnostics.
4. Extend the existing Playwright flow to create/select the workspace and add canonical references via rendered controls, asserting exact structured requests/results from those interactions.
5. Add current/ended/unavailable DOM oracles, then drive shutdown/remove and assert entity-driven re-render with no surface/list refresh.
6. Reload, prove a new subscription plus authoritative snapshot, reselect through the UI, and reassert retained history.
7. Add deterministic tests and README guidance, then run all green Web gates.
8. Run the exact new command against Workspaces main `c78f3bf`, retain the expected non-zero owner assertion and compact last-state evidence, and attach it to the pipeline artifact/gate for downstream consumption.

## Risks and mitigations

- **Dependency inversion:** requiring green against current Workspaces would force producer changes into Web. Mitigation: preserve the answered red-oracle/green-Web split and the existing downstream dependency edge.
- **False product green:** a synthetic tree or Web-authored lifecycle state could make the harness pass without the package behavior. Mitigation: install the supplied real package, render its delivered tree, drive its controls, and never synthesize owner state.
- **Hand-authored action false positive:** calling package tools or constructing `plugin_surface_action` bypasses the renderer. Mitigation: read metadata from rendered nodes, click/fill/submit real controls, and assert request/result frames.
- **Refresh masks reconciliation:** rerendering the surface after shutdown could hide a broken entity binding. Mitigation: capture render/list request counts before transition and require the DOM to change from canonical entity frames alone.
- **Snapshot-versus-patch brittleness:** a valid state may arrive in a snapshot, upsert, or patch. Mitigation: assert converged canonical entity-store state and chronology constraints, not one arbitrary frame variant.
- **Reconnect false positive:** an old store could remain visible after reload. Mitigation: require a different subscription id, an authoritative snapshot for that generation, UI reselection, and expected post-snapshot DOM.
- **Historical-reference loss:** `entity_remove` could remove the UI row entirely. Mitigation: keep the Workspaces membership untouched and require an unavailable row in the owner surface after removal and reconnect.
- **Identity-grammar overreach:** future producer work could be asked for distinct bound descendant ids that UI Contract 0.2.0 forbids. Mitigation: select the literal or bound direct row root, scope descendants by containment and semantic action, and route any proven need for bound descendant identity to Hub ticket `ticket_1785443253_376782`.
- **Renderer drop misattribution:** an empty or colliding bound identity can make Web omit a producer-authored row and falsely blame Workspaces. Mitigation: classify per-row identity resolution from the delivered tree and entity state, test all three failure causes, and treat Web drop classifications as in-scope generic defects.
- **Noisy expected red:** broad logs can obscure the owner gap. Mitigation: fail at the first semantic mismatch with scenario stage, expected/observed rows, canonical entity state, subscription/render/list chronology, and no secrets.
- **Existing lint/build warnings:** seven Fast Refresh warnings and Vite's chunk-size warning predate the ticket. Mitigation: preserve the exact baseline and require no new warning/error attributable to changed files.

## Acceptance checks and tests

Green Web repository gates:

- `npm test` passes, including daemon protocol drift and new deterministic lifecycle-runner/helper diagnostics tests.
- `npm run typecheck` passes.
- `npm run lint` exits 0 with no new warnings beyond the seven recorded baseline Fast Refresh warnings.
- `npm run build` passes with no new build warning beyond the recorded chunk-size warning.
- `npm run smoke:browser-runtime` passes to prove the compiled production UI remains healthy.
- Existing `npm run smoke:workspaces-compat` passes against a supplied real current Workspaces package, preserving create/list/reload/direct-load proof.
- Applicable `npm run smoke:plugin-contract-matrix` remains green, proving canonical session binding/reconnect and generic actions were not regressed.

New opt-in lifecycle command against the Web-owned runner:

- Requires `BOTSTER_HUB_BIN`, `BOTSTER_SESSION_WORKER_BIN`, and an explicit real Workspaces package path; rejects caller-owned/durable data modes before mutation.
- Installs/enables and opens the real package through Hub; no local fixture package or sibling override appears in package provenance.
- Drives create, row selection, and Add-session forms through real rendered controls; each request contains renderer-collected `values` and each accepted structured result correlates package/surface/action/node/request identity.
- Renders canonical current and ended references through the delivered owner tree and production registry/store, identifying each repeated row by its literal or bound direct `item_template` root and scoping labels/badges/actions by containment and semantic action.
- Reports and asserts the never-existing UUID and the later-removed UUID as separate unavailable oracles with distinct stage names.
- A public shutdown transitions one referenced session current -> ended in the DOM without a new `plugin_surface_render`, `list_sessions`, or imperative refresh.
- A public remove produces canonical absence while the deliberate Workspaces reference stays visibly unavailable; failure output distinguishes producer omission from Web `dropped-empty` and `dropped-collision`.
- Reload establishes a fresh subscription id and authoritative snapshot, then UI reselection restores ended/unavailable history with no stale-generation acceptance.
- Browser console/page/404 checks stay clean and the harness performs normal Hub/browser/data-dir cleanup on success and semantic failure.

Required staged downstream proof:

- Against authoritative Workspaces main `c78f3bf`, the exact command returns non-zero at the first missing package-owned lifecycle assertion after its generic setup/action/reconnect mechanics have been proven; the pipeline artifact records exact command, package SHA/provenance, exit code, stage, and compact last-state evidence.
- After this Web change merges, `ticket_1785296184_677408` runs the identical command against its real package checkout and must obtain exit 0. That green result is required downstream proof of Workspaces ownership and is not waived by this ticket's expected pre-fix red.
- If the current real-package invocation instead fails before reaching an owner assertion, this ticket is not complete: repair the Web-owned harness/setup issue or route a precise external blocker before gate submission.

## Pipeline artifacts and gates

- Attach this committed repo-local plan as the Plan artifact.
- Preserve `question_1785545318_550751` and identity correction `question_1785546638_867097` with their answers as binding assumptions in Plan, gate evidence, and downstream handoff.
- Vault checklist records exact note titles, no convention conflict, baseline commands/results, and capture disposition.
- Implement handoff must attach green Web command evidence plus the exact current-package non-zero producer oracle; the red result is never represented as a waived Web test.
- Plan gate evidence must use the ticket target id/repository above and name existing downstream dependency `dependency_1785545092_175214`.

## Vault gaps worth capturing

- Candidate after implementation: a durable cross-repository acceptance pattern may be worth capturing if this staged contract proves reusable -- consumer-owned runner lands green, current producer supplies a precise red oracle, and the downstream producer must run the identical merged command to green.
- Candidate only if observed: package acceptance selectors should be owner-authored stable node identities/accessibility labels when consumer harnesses must predate producer behavior.
- No new descendant-identity note is needed: [[ui contract row ids can bind before template expansion]] captures the current row-root contract, while Hub ticket `ticket_1785443253_376782` owns the not-yet-admitted descendant grammar.
- Do not capture ticket-specific node ids, UUIDs, commands, or the expected one-time pre-fix failure as general conventions.
- At Plan time no new vault note is written: the sequencing decision is preserved in the durable Project Pipelines question and this repo plan until implementation supplies evidence that it generalizes.

## Convention check

- No convention conflict. The plan keeps runtime and product truth in Hub/Workspaces, uses Web's existing production harness and Ionic renderer, exercises entity frames and structured action results, avoids dual paths and speculative abstractions, and preserves a green default repository.
- The only apparent tension -- a prerequisite acceptance runner whose producer-specific assertion is red before the downstream package work -- was resolved explicitly by `question_1785545318_550751`; it is staged cross-repository proof, not a verification waiver.
