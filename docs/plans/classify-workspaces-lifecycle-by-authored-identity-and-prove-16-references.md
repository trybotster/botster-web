---
description: Plan to classify Workspaces lifecycle regions by authored UiNode identity and prove sixteen references through the real Web renderer and Hub transport
---

# Classify Workspaces lifecycle by authored identity and prove 16 references

## Target repository and routing

- Ticket: `ticket_1785565446_434468`, "Web acceptance: classify Workspaces lifecycle by authored identity and prove 16 references".
- Run: `run_1785565459_869750`, Plan step `botster_stack_plan`.
- Authoritative target repository: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- Project Pipelines current context and the admitted spawn-target registry resolve the ticket target to `trybotster/botster-web`; the repository remote confirms that mapping. The registry display name remains misspelled `booster-web`, but its path and `repo_name` are unambiguous. Routing was not inferred from the ambient checkout.
- Assigned worktree: the current ticket worktree on `project-pipelines/ticket_1785565446_434468`, based exactly on `origin/main` commit `85a34d69be2e21ff9ed9986d98e61d83cf716e2a` when planned.

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. The role, surface, and ticket-specific notes below
5. [[project-pipelines-playbook]] for durable questions, checklists, artifacts, gates, and cross-repository routing; Project Pipelines implementation is not in scope

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

Web and ticket-specific guidance:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[acceptance harness region oracles must key on node identity not concatenated text]]
- [[acceptance readiness requires the exact expected entity not any authoritative snapshot]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[runtime client acceptance must render delivered snapshots through real registry]]
- [[plugin conformance packages prove shared contracts while examples prove product behavior]]
- [[conformance helpers must dispatch the action id read from the rendered node]]
- [[conformance oracles assert action result frames not toast text]]
- [[conformance harnesses gate on deterministic invariants not timing]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[ui contract row ids can bind before template expansion]]

## Context loaded

- `project_pipelines_current_context` supplied the authoritative ticket, run, target ID, active Plan gate, empty findings/reviews/artifacts/dependencies, and question state.
- `README.md`, `package.json`, `docs/architecture.md`, the preceding Workspaces lifecycle plan, current helper/harness/tests, repository history, and repository-owned validation scripts were inspected. Existing mainline plans establish `docs/plans/` as the repository destination for this artifact.
- `scripts/live-packaged-protocol-helpers.mjs` currently classifies a row's lifecycle region by applying human-vocabulary regexes to concatenated ancestor `textContent`. The same ancestor evidence already records `data-ui-node-id`, which is the structural contract this ticket must consume.
- `scripts/live-packaged-protocol-harness.mjs` currently exercises four references: one current-to-ended transition, one stable-ended reference, one ended reference later removed from the canonical entity family, and one never-existing reference. It already preserves surface-render/list request counts, selected-route reload, fresh subscription evidence, authoritative snapshot evidence, structured actions, and compact lifecycle diagnostics.
- `src/App.test.mjs` currently locks the incorrect text-based classifier with an `Ended Friendly session label` example. It also contains the deterministic helper, negative-oracle, reconnect, action, and script-wiring coverage that should be extended rather than replaced.
- Workspaces PR #11 was inspected through the GitHub MCP surface and its exact acceptance input was verified locally: branch `project-pipelines/ticket_1785296184_677408` at `ee50c70da94608e3941f834db355cc4179b1a7cf`. That SHA authors clean `Current`, `Ended`, and `Unavailable / uncertain` headings, lifecycle section IDs shaped as `botster-workspaces-sessions-(current|ended|unavailable)-<workspace_id>`, a representative 16-reference tree containing exactly 64 canonical BindLists, and literal per-reference identities/actions. None of that lifecycle structure exists on Workspaces `origin/main`, so main is not a valid input for this ticket's real-package proof.
- Human answer `question_1785565796_709899` binds the 16-reference scenario to four equal cohorts and exact ID membership assertions: four current-to-ended transitions, four stable-ended references, four ended-to-entity-remove references, and four never-existing references. Counts alone are insufficient, and incidental DOM order must not become authoritative.
- Current-main baseline: `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` exit 0. Lint reports the existing seven Fast Refresh warnings; build reports the existing chunk-size warning. `npm run smoke:browser-runtime` initially hit the sandbox's loopback-bind restriction, then passed unchanged when rerun with loopback permission.
- The central live command now has pinned red-before evidence on Web base `85a34d69be2e21ff9ed9986d98e61d83cf716e2a`. Hub `88d343870700994d310f090fd5b2c4dbabb07405` was materialized in an isolated temporary checkout and built with `cargo build --locked --bin botster-hub` plus `cargo build --locked -p botster-core --bin botster-session-worker`; its lockfile resolved Core `5846fc77`. With those binaries and Workspaces `ee50c70`, `npm run smoke:workspaces-lifecycle` reached the real production surface and exited 1 at `stage=initial-owner-surface oracle=current-reference`, classifying the row `materialized-not-legible` with `reason=no-semantic-region`. The captured ancestor already had the correct `botster-workspaces-sessions-current-...` ID while its clean text was concatenated as `Current<uuid>Remove`, proving the exact text-boundary regression.

## Scope

1. Replace the lifecycle-region text regex with a small structural matcher over ancestor `data-ui-node-id`. Recognize only the authored `-sessions-(current|ended|unavailable)-` segment and require the segment to match the expected lifecycle class. Do not classify from heading text, row copy, aria labels, or UUID text.
2. Keep heading/row text only as bounded failure context. Successful classification should be driven entirely by the matched ancestor ID; diagnostics may retain the already bounded text excerpt so a failed real-package run remains understandable without making prose contractual.
3. Replace the four scalar lifecycle scenario IDs with four explicitly named cohorts of four canonical UUIDs. Add all sixteen references through the real owner-authored Add-session form and preserve rendered action/request/result proof for each addition.
4. Assert exact lifecycle membership by session ID at every stage using the existing per-reference expectation architecture, not a scan of all descendants in each section. For each stored reference, `classifyWorkspacesReference` resolves the row root from the delivered tree plus the canonical record; the DOM oracle then classifies only that resolved row by its `-sessions-<class>-` ancestor. Build the stage partition from those per-reference results and require every expected ID in exactly its expected class, with negative expectations for its prior/other realized lifecycle row where applicable:
   - Initial authoritative state: current is the four transition IDs; ended is the eight stable-ended plus removal IDs; unavailable is the four never-existing IDs.
   - After canonical shutdown transitions: current is empty; ended is the twelve transition plus stable-ended plus removal IDs; unavailable remains the four never-existing IDs.
   - After canonical entity removal: current is empty; ended is the eight transition plus stable-ended IDs; unavailable is the eight removal plus never-existing IDs.
   - After selected-route reconnect: a fresh subscription and authoritative snapshot reproduce that exact final partition.
5. Tolerate structurally co-located non-selected nodes without learning Workspaces row vocabulary. The producer authors an inert materialized present-branch stack under the unavailable section for every existing reference and an indeterminate alternative beside absence handling. Those nodes must not become lifecycle membership merely because they descend from that section. Unexpected-ID diagnostics remain bounded to the sixteen expected references and current/prior resolved row identities; do not filter or classify by product-specific `present`, `absent`, or `indeterminate` substrings.
6. Preserve the existing ordered runtime path: public spawn/readiness, owner-authored reference addition, initial partition, current-to-ended updates, deliberate canonical removals, selected-route replay, fresh subscription, authoritative snapshot, and final action/identity checks. Do not collapse those stages into a final-count assertion.
7. Prove every stored reference remains unique, realized, legible, correctly grouped, and action-bearing where the owner tree authors an action. Continue deriving action IDs from rendered nodes and matching structured requests/results rather than constructing package action envelopes.
8. Update deterministic tests and README lifecycle documentation to state the node-identity classifier and exact sixteen-reference proof.

## Non-scope

- No Workspaces headings, aria labels, grouping rules, identity grammar, persistence, actions, or Lua surface changes.
- No changes to `botster-workspaces`, Hub/Core, TUI/TUI-kit, UI Contract, generated daemon DTOs, or hub-test-support artifacts.
- No hard-coded product copy or heading vocabulary in Web; no fallback to concatenated `textContent` or aria-label parsing.
- No browser-owned workspace/session lifecycle model, list refresh, global hydration, polling, `list_sessions`, surface rerender synchronization, or timing retry.
- No fixture-only substitute for the supplied real Workspaces package, production renderer, WebRTC transport, plugin worker, and canonical Hub entity frames.
- No weakening of identity, uniqueness, legibility, action, transition, removal, reconnect, selected-route, or no-refresh assertions to accommodate the larger scenario.
- No incidental DOM ordering contract. Preserve deterministic cohort/reference order only where Workspaces' authored stored-reference contract promises it; exact membership is the required lifecycle oracle.
- No renderer refactor or adjacent cleanup unless the expanded real-package proof exposes a separately reproducible generic Web defect required for this ticket.
- No Project Pipelines package/plugin change; its tools are used only for this run's durable workflow evidence.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns:** structural DOM-region classification from realized UiNode IDs, live Playwright/Hub orchestration, production Ionic renderer assertions, generic entity-store reconciliation evidence, selected-route replay, structured action observation, bounded diagnostics, and deterministic helper tests.
- **botster-workspaces owns:** stored reference ordering, lifecycle presentation semantics and copy, authored section/row/action identities, the 16-reference/64-binding surface, and explicit accessible labels. Open downstream ticket `ticket_1785296184_677408` on target `tgt_71266a8d976d4535902ffed09c18a7ba` must consume the merged Web change, restore clean owner copy and aria labels, export its 16-reference tree through locked UiNode validation, and rerun both consumers.
- **botster-hub and its public contracts own:** canonical session existence, lifecycle class, snapshot/upsert/patch/remove ordering, package admission, plugin-worker execution, WebRTC transport, and renderer-neutral UiNode/action grammar. Web consumes those public paths without adding meanings.
- **Hub descendant identity is not a prerequisite:** open Hub ticket `ticket_1785443253_376782` on target `tgt_7e208a0c76a44980a83b63af976b1f22` owns bound identity for BindList descendants. This harness accepts only producer-authored literal roots or contract-admitted bound direct template roots and never requires bound descendant IDs, so scaling to sixteen references does not depend on that ticket.
- **botster-tui owns:** its separate real renderer and keyboard proof; this ticket must not copy terminal-client behavior into Web.
- Current Project Pipelines context contains no blocking dependency for this Web implementation by deliberate Web-before-Workspaces ordering: the unmerged Workspaces `ee50c70` tree is the pinned real-package acceptance input, while downstream ticket `ticket_1785296184_677408` cannot close until it consumes merged Web and reruns the same command. Any live failure attributable to that authored tree is routed to that ticket on `tgt_71266a8d976d4535902ffed09c18a7ba`, never absorbed into Web. If implementation instead discovers an upstream Hub/contract prerequisite, register it against the owning target before broadening this plan.

## Assumptions and unknowns

- Binding human decision: use four equal cohorts and assert exact session-ID partitions at all four stages; do not accept counts as a substitute.
- Assumption: the existing fresh harness-owned data restriction remains sufficient for sixteen references and twelve spawned sessions; implementation should retain cleanup and fail before mutation when caller-owned/durable modes are selected.
- Assumption: Workspaces preserves stored reference order within its authored groups, but this ticket only asserts that order if the delivered owner tree contract explicitly exposes it. Lifecycle membership and the current-to-ended stage sequence are always authoritative.
- Assumption: the existing per-reference compact tree/DOM evidence remains bounded at sixteen references. If output becomes unwieldy, tighten filtering/field projection without dropping the failing IDs, matched section IDs, last canonical state, subscription identity, or request counts.
- Required live provenance: Hub `88d343870700994d310f090fd5b2c4dbabb07405` built from its locked source with the documented Cargo commands, its resulting `botster-hub` and `botster-session-worker` binaries, and Workspaces `ee50c70da94608e3941f834db355cc4179b1a7cf`. Workspaces main is not an acceptable substitute.
- Unknown: whether scaling from four to sixteen exposes a generic timeout or cleanup cost. Do not increase sleeps or retry counts preemptively; measure the real command and repair only a demonstrated deterministic readiness/setup defect.
- Resolved fact: the pinned Workspaces SHA already carries the clean headings `Current`, `Ended`, and `Unavailable / uncertain`; the observed base failure is therefore the exact no-separator regression, not an uncertain copy state.

## Affected surfaces and files

- `scripts/live-packaged-protocol-helpers.mjs`: swap the existing classifier from text vocabulary to the already captured authored ancestor section ID and bound its diagnostic text; preserve per-reference binding/identity resolution rather than adding a section-descendant scanner.
- `scripts/live-packaged-protocol-harness.mjs`: build four cohorts of four IDs, seed and mutate them through public daemon requests, add all sixteen via rendered forms, and assert per-reference exact partitions through transition/removal/reconnect while preserving request/action evidence. Ancestor ID capture already exists and needs no new plumbing.
- `src/App.test.mjs`: replace the text-coupled region test with exact-ID positive/negative controls, prove clean/conflicting human copy cannot change classification, cover exact cohort partitions, and add a tree/DOM case where an ended row coexists with a materialized present-branch stack under the unavailable section but still partitions only to ended.
- `README.md`: update lifecycle smoke documentation from four representative references to the exact sixteen-reference staged proof and state that section identity, not visible copy, drives harness classification.
- `docs/plans/classify-workspaces-lifecycle-by-authored-identity-and-prove-16-references.md`: this durable Plan artifact.
- `src/botster/IonicUiNodeRenderer.tsx` and transport/entity-store modules are expected unchanged. Touch one only after a focused generic reproduction proves the sixteen-reference production path exposes a Web-owned defect.

## Implementation sequence

1. Preserve the recorded real red-before result on Web base `85a34d6` with Hub `88d3438`/locked Core `5846fc77` and Workspaces `ee50c70`: exit 1 at initial `current-reference`, `materialized-not-legible`, `no-semantic-region`. This is the live ablation half required by [[a regression test must be shown to go red with the fix reverted]].
2. Add deterministic red/green controls for lifecycle-region classification: correct authored section ID with clean/non-lifecycle/conflicting visible copy passes by ID; text alone, wrong class ID, malformed ID, and unrelated ancestors do not classify. Include the ended-row-plus-unavailable-present-stack case so per-reference selection, not descendant scanning, is load-bearing.
3. Implement the ID-only matcher and preserve only bounded text in failure evidence.
4. Introduce four named four-ID cohorts and central expected partitions so setup and assertions cannot drift into parallel lists.
5. Extend the existing real scenario to spawn twelve canonical sessions, end the eight stable/removal sessions, select the real workspace, and add all sixteen references through rendered owner controls with correlated structured action evidence.
6. Assert initial exact membership through per-reference classifications; transition all four current IDs and assert the second exact partition without an extra surface render or `list_sessions`; remove all four removal IDs and assert the third exact partition under the same no-refresh constraint.
7. Reload the selected route, require a new grant/subscription and authoritative session snapshot, reselect through the rendered route flow, and assert the final exact partition plus stable identities/actions for all sixteen references.
8. Keep diagnostics compact and secret-free, update README/plan evidence, and run repository gates.
9. Rerun the identical live command against the same Hub/worker/Workspaces SHAs and require exit 0. The red-before and green-after pair must differ only in the Web implementation under test; if the input SHAs change, rerun both halves.

## Risks and mitigations

- **Copy remains a hidden contract:** a new matcher could still inspect text as fallback. Mitigation: negative tests use correct/misleading/absent lifecycle words and require identical classification from the same section ID; source-level coverage rejects the old vocabulary regex table.
- **Counts hide swapped references:** 4/8/4 group counts can pass with wrong rows. Mitigation: compare exact ID sets at every stage and print missing/unexpected IDs on failure.
- **Section descendant scans misclassify inert placeholders:** the unavailable section contains a materialized present stack for every existing reference. Mitigation: partition only the row root resolved for each reference expectation and bound unexpected evidence to expected/current/prior identities; never filter on Workspaces row-name vocabulary.
- **Scale masks reconciliation with rerenders:** repeated additions or transitions could trigger a fresh surface pull. Mitigation: retain the render/list request baseline and require all lifecycle mutations after setup to reconcile from entity frames only.
- **Incidental order becomes brittle:** Playwright DOM traversal can make a stable-looking order appear contractual. Mitigation: assert exact set membership unless the producer's stored-reference ordering contract explicitly applies, while preserving the required stage chronology.
- **Fixture false positive:** helper tests could pass without the real package. Mitigation: the required live command installs the supplied package and exercises its delivered tree through Hub, plugin worker, WebRTC, production registry/entity store, and real rendered actions.
- **Action proof thins at sixteen rows:** only checking one form/action could leave most rows unwired. Mitigation: correlate every add action and require the expected contained rendered action metadata on every owner-authored actionable row.
- **Reconnect shows retained stale DOM:** final rows could survive without new authority. Mitigation: require a fresh subscription ID and authoritative snapshot for that generation before accepting the exact final partition.
- **Longer setup invites timing changes:** twelve spawned sessions and sixteen forms cost more. Mitigation: continue waiting on exact entity/action invariants, not sleeps; retain bounded timeouts unless real evidence proves the producer lacks an opportunity within them.
- **Cross-repository ownership drifts:** Web could be made to understand Workspaces labels or rewrite owner IDs. Mitigation: accept only the generic authored ID segment and route copy/identity/tree changes to `ticket_1785296184_677408`.

## Acceptance checks and tests

Repository gates:

- `npm test` passes, including protocol drift and deterministic ID-only lifecycle-region/cohort/diagnostic coverage.
- `npm run typecheck` passes.
- `npm run lint` exits 0 with no new warnings beyond the seven recorded Fast Refresh warnings.
- `npm run build` passes with no new warning beyond the recorded chunk-size warning.
- `npm run smoke:browser-runtime` passes against the compiled production UI.
- Existing applicable `npm run smoke:workspaces-compat` and `npm run smoke:plugin-contract-matrix` remain green against explicit current package/binary inputs.

Focused structural proof:

- A correct `-sessions-current-`, `-sessions-ended-`, or `-sessions-unavailable-` ancestor ID classifies only its matching expected lifecycle class.
- The human-visible headings `Current`, `Ended`, and `Unavailable / uncertain` work unchanged and punctuation-free; removing or replacing those words does not alter classification, while text containing a lifecycle word under the wrong ID cannot spoof membership.
- Heading/row text appears only in bounded failure diagnostics; successful classification and partition comparison consume node/session identity.

Real sixteen-reference proof:

- Materialize Hub `88d343870700994d310f090fd5b2c4dbabb07405`, run `cargo build --locked --bin botster-hub` and `cargo build --locked -p botster-core --bin botster-session-worker`, and point `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` at those resulting binaries. Point `BOTSTER_WORKSPACES_PACKAGE_PATH` at an isolated checkout/archive of Workspaces `ee50c70da94608e3941f834db355cc4179b1a7cf`, then run `npm run smoke:workspaces-lifecycle`.
- Preserve the measured pre-change result on Web `85a34d6`: exit 1, `initial-owner-surface/current-reference`, `materialized-not-legible`, `no-semantic-region`, with the correct `-sessions-current-` ancestor and concatenated clean text `Current<uuid>Remove`. After the implementation, the identical pinned command must exit 0. This red-before/green-after pair is gate-bearing evidence, not an optional observation.
- The real owner surface stores exactly sixteen distinct canonical UUID references added through rendered controls, divided into the four human-approved cohorts.
- Initial, transitioned, removed, and reconnect stages match the exact ID partitions recorded in Scope through per-reference resolved-row classifications. No stage may pass from counts alone or from scanning all descendants of a section.
- The four transition IDs move current to ended after canonical shutdown; the four removal IDs move ended to unavailable only after canonical entity removal; stable-ended and never-existing cohorts retain their meanings.
- No lifecycle mutation causes an extra `plugin_surface_render`, `list_sessions`, global hydration, imperative refresh, or local synthetic row.
- Every realized reference has unique stable literal/bound root identity, belongs to the correct authored section ID, remains legible, and retains its owner-authored rendered action behavior where applicable.
- Reload preserves the selected app route, performs exactly one selected-surface replay for the new generation, obtains a fresh entity subscription and authoritative snapshot, and reproduces the exact final 0-current/8-ended/8-unavailable ID partition.
- Failures are non-zero and bounded, naming stage, expected/missing/unexpected IDs, matched section IDs, identity classifications, relevant rendered rows/tree nodes, canonical session chronology, latest subscription ID, and render/list/reconnect counts without secrets.

Required downstream proof:

- After this Web change merges, `ticket_1785296184_677408` must restore the clean Workspaces headings and explicit aria labels, export/validate its 16-reference/64-binding tree, and rerun the identical merged Web lifecycle command against the real owner package with exit 0. Code existence or fixture-only tree validation does not replace that production renderer/Hub transport result.
- Record the same Web/Hub/session-worker/Workspaces SHAs in both this run's live evidence and the downstream rerun so failures are attributable to tested ancestry rather than branch labels.

## Pipeline artifacts and gates

- Attach this repo-local plan as the durable Plan artifact.
- Preserve `question_1785565796_709899` and its four-cohort answer as a binding assumption in gate and handoff evidence.
- The run vault checklist records exact resolvable note titles, convention fit, baseline commands/results, and durable-knowledge disposition.
- Implement handoff must attach focused test output, repository gate output, the exact real Workspaces lifecycle invocation/provenance, its structured 16-reference stage evidence, and any cross-repository finding routed to its owner.
- Implement handoff must also attach the pinned base red and fixed green exit codes/oracles. If Hub or Workspaces provenance changes, both halves must be rerun against the new identical input pair.

## Vault gaps worth capturing

- No new vault note is required at Plan time: [[acceptance harness region oracles must key on node identity not concatenated text]] is the exact durable lesson that motivated this ticket.
- Candidate only if implementation reveals a reusable additional rule: large real-package lifecycle scenarios should express expected partitions once as per-reference resolved identity expectations so setup, transition, reconnect, and failure diagnostics cannot drift into parallel count-based or section-descendant oracles.
- Do not capture ticket-specific cohort UUIDs, Workspaces section ID prefixes, or one-time package SHA evidence as general knowledge.

## Convention check

- No convention conflict. The plan keeps product semantics and authored copy in Workspaces, canonical lifecycle truth in Hub, and generic structural rendering/acceptance in Web. It extends the existing live harness and pure helpers without a new abstraction, fallback grammar, compatibility path, refresh mechanism, or speculative renderer refactor.
