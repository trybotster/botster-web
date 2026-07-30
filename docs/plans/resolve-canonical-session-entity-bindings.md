---
description: Plan for resolving canonical session entity bindings in botster-web plugin surfaces
---

# Resolve canonical session entity bindings in plugin surfaces

## Target repository and routing

- Ticket: `ticket_1785298229_125024`, "Web: resolve canonical session entity bindings in plugin surfaces".
- Run: `run_1785433255_769214`, step `botster_stack_plan`.
- Authoritative target: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- The target was resolved through the Project Pipelines ticket and Botster spawn-target registry, then confirmed against the repository remote. It was not inferred from the ambient directory.
- The assigned branch is five commits behind `origin/main`; implementation must integrate current main before changing runtime code so the already-merged Workspaces compatibility smoke remains part of the baseline.

## Playbooks and notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. Targeted architecture, surface, and atomic notes listed below

Additional role and surface guidance:

- [[botster-workspaces-playbook]] for the downstream owner-authored consumer boundary.
- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[continuous product owner should audit project pipelines and maintain the backlog]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[repository placement authority belongs to the target registry]]
- [[botster web should stay a vanilla ionic react spa]]
- [[botster web dto keys must match serde names exactly]]
- [[botster web consumes the hub validated ui snapshot grammar]]
- [[botster web plugin surfaces need stable routes]]
- [[react query owns server state while local state owns interaction]]
- [[toolbars should match editor and browser semantics]]
- [[package render results should own plugin presentation]]
- [[entity frames are the only live sync path]]
- [[reconnect snapshots are authoritative]]
- [[reconnect pull retries must survive transport generations]]
- [[session uuid is the sole session identity]]
- [[ui bindings drive entity hydration]]
- [[generic entity selectors should resolve canonical families]]
- [[dynamic ui lists bind entity rows]]
- [[real registry runtime acceptance proves client support]]
- [[typed bind list children must not be silently dropped]]
- [[bind list where filters use exact entity fields]]
- [[bind list empty templates represent absent rows]]
- [[entity subscriptions publish filterable supersets]]
- [[entity delta sequence gates are scoped per subscription]]
- [[entity hydration contracts require snapshot and delta proof]]
- [[cold turkey migrations eliminate dual code paths and version suffixes]]

[[project-pipelines-playbook]] was not loaded because this implementation does not touch Project Pipelines package/plugin paths or workflow policy; Project Pipelines is only the delivery mechanism for this run.

## Context loaded

- Project Pipelines current context included the ticket, run, step, plan gate, dependencies, checklists, question, and answer. There are no prior artifacts, reviews, or findings.
- Closed Hub dependency `ticket_1785295607_887142` owns the canonical `/session` projection and published test-support contract.
- Closed Web dependency `ticket_1785370604_722256` owns the Workspaces named-slot compatibility smoke already merged to current main.
- Human answer `question_1785433679_132882` selected the owner-neutral acceptance seam: this run proves the published Hub `contract.sessions` plugin-worker surface and production Web transport/store/reconnect path. The actual Workspaces lifecycle surface stays downstream in `ticket_1785296184_677408`, with final browser integration in `ticket_1785192726_335558`.
- `package-lock.json` resolves `@trybotster/hub-test-support@0.1.16`, conformance revision 24, and UI contract 0.1.1. A clean install exposes the published session-plugin-binding conformance fixture and `contract.sessions` package surface.
- The published fixture binds one exact-filtered child per referenced UUID against `/session`, displays `@/lifecycle_class` for a matching entity, and selects `empty_template` only for an absent UUID. Its scenario covers current, ended, indeterminate, patch-to-ended, Some-to-None/indeterminate, remove, and reconnect snapshot omission.
- The production plugin route already passes the Hub-validated canonical `UiChild` tree directly to `UiNodeSurface`; the prior compatibility conversion was removed.
- `IonicUiNodeRenderer.tsx` already contains generic `bind_list`, `$bind`, conditional, exact `where`, nested row-scope, and empty-template resolution against the entity store.
- The broken seam is the production session projection: `hubTransport.ts` subscribes to the sanctioned Hub `session` stream but rewrites it into private family `botster-web.session`, while canonical `/session` bindings resolve family `session`. The explicit record projection also omits `lifecycle_class`.
- `entities.ts` already reconciles authoritative snapshots, upserts, shallow patches, removes, and reconnect replacement; the held WebRTC subscription path already creates a fresh generation, pulls an authoritative snapshot before deltas, detects sequence gaps, and rejects stale generations.

## Scope

1. Integrate current `origin/main` before implementation and resolve any overlap without discarding the merged Workspaces compatibility proof.
2. Cold-switch the browser session entity family from `botster-web.session` to canonical `session` everywhere in the production transport, application reads/pulls, tests, and harness expectations. Do not retain a parallel alias.
3. Preserve the canonical Hub session record fields, especially `session_uuid` and `lifecycle_class`, while retaining only Web-owned presentation enrichment needed by existing home/attach behavior.
4. Keep one sanctioned held subscription to raw Hub family `session`; route its snapshot/upsert/patch/remove frames into the generic entity store and existing reconnect replay path.
5. Exercise the published session binding fixture through the production `UiNodeSurface` and Ionic renderer registry, not through renderer internals or a local resolver.
6. Prove owner-neutral `UiChild` materialization for `bind_list`, `$bind`, and conditional children, including nested children and a negative assertion that typed children are not silently dropped.
7. Extend the real packaged browser harness to install the normal published contract-matrix fixture, render `contract.sessions` through `plugin_surface_render`, and observe canonical session frames through the actual React transport/entity store.
8. Update stable architecture or runbook claims only where the canonical family name or new live acceptance command needs documentation.

## Non-scope

- No changes to Hub session lifecycle derivation, DTO validation, entity subscription protocol, or plugin-worker capabilities.
- No changes to botster-workspaces in this run.
- No Workspaces-specific React state, imperative list refresh, special-case renderer branch, force-click proof, or copied/local fixture resolver.
- No compatibility binding grammar, private `bindings[]` conversion, dual `session`/`botster-web.session` store, versioned replacement family, or fallback primitive vocabulary.
- No broad renderer refactor, entity-store rewrite, transport redesign, adjacent cleanup, or optional binding configurability.
- No Project Pipelines package/plugin or workflow-policy changes.

## Repository ownership boundaries and dependencies

- Botster Web owns the React/Ionic renderer, browser entity store, WebRTC client consumption, production routes, and browser/runtime proof. Those are the only implementation surfaces in this run.
- Botster Hub owns lifecycle truth, the canonical `/session` family, sequence/snapshot semantics, validated `UiChild` grammar, plugin isolation, and the published conformance artifact. Web consumes these contracts without redefining them.
- Botster Workspaces owns the eventual workspace lifecycle presentation. Its `ticket_1785296184_677408` depends on this Web capability and must prove the real Workspaces-authored surface after this ticket merges.
- Final cross-repository browser integration remains `ticket_1785192726_335558`.
- Both registered prerequisites for this run are closed. The downstream Workspaces tickets are acceptance consumers, not prerequisites; dependency ordering must not be reversed or made cyclic.
- Any defect discovered in lifecycle classification or the published fixture belongs in a Hub-targeted dependency/follow-up rather than being patched privately in Web.

## Assumptions and unknowns

- Assumption: the human answer supersedes the ticket phrase "real owner-authored workspace surface rendering" for this run; `contract.sessions` is the required real owner-neutral plugin-worker surface, while the Workspaces-owned surface is downstream.
- Assumption: `@trybotster/hub-test-support@0.1.16` and revision 24 remain the locked normal published artifact for implementation. No registry upgrade is planned.
- Assumption: existing Web-only derived fields such as `title`, `status`, and `attachable` may coexist with canonical fields as presentation enrichment, but they must not replace or rename canonical session fields.
- Assumption: a patch that omits or clears lifecycle source data must result in the Hub-authored `lifecycle_class` transition supplied by canonical frames; Web must not derive lifecycle truth independently.
- Unknown: the exact minimal live-harness mechanism for supplying the referenced UUID arguments to `contract.sessions`. The implementer must use the fixture's public surface arguments and real daemon request path.
- Unknown: whether current main adds overlapping session-family assertions through the merged Workspaces smoke. Resolve these during baseline integration and keep the proof generic.
- If the published fixture, daemon response, and generated types disagree, stop and register the producer mismatch rather than adding a browser compatibility shim.

## Affected surfaces and files

- `src/botster/hubTransport.ts`: canonical session family, canonical record preservation, held-subscription frame projection.
- `src/App.tsx`: home/session reads and explicit entity pull family.
- `src/botster/entities.ts`: expected to remain unchanged; touch only if a fixture exposes a ticket-required generic reconciliation defect.
- `src/botster/IonicUiNodeRenderer.tsx`: expected to remain structurally generic; touch only for a proven owner-neutral `UiChild` materialization defect or silent-child-drop bug.
- `src/botster/uiNodes.ts`: expected to remain a direct `@trybotster/ui-contract` consumer; no local grammar.
- `src/App.test.mjs`: published-fixture import, canonical-family assertions, deterministic materialization and reconciliation proof.
- `scripts/live-packaged-protocol-harness.mjs`: real `contract.sessions` plugin-worker/browser/reconnect proof and canonical family expectations.
- `scripts/check-daemon-protocol-drift.mjs`: include the published session fixture/metadata in drift checks only if it is not already protected by the package verification path.
- `scripts/live-packaged-protocol-helpers.mjs`: only if a small owner-neutral harness matcher is required.
- `README.md` and `docs/architecture.md`: bounded contract/run-command updates if implementation changes a stable documented claim.

## Implementation sequence

1. Integrate current main, install from the lockfile, and rerun the deterministic baseline before edits. Record exact unrelated failures rather than accepting a blanket pre-existing-failure claim.
2. Add or strengthen drift assertions that identify the locked Hub test-support revision and published session binding fixture used by the tests.
3. Replace the private browser session family with canonical `session` across the production transport and consumers. Preserve canonical fields from snapshots and deltas, then layer only existing Web presentation fields.
4. Drive the published fixture through `UiNodeSurface` with the production Ionic registry and generic entity store:
   - authoritative snapshot with matching current, ended, and indeterminate rows plus an absent reference;
   - upsert of an initially absent row;
   - patch to ended;
   - patch/transition to indeterminate representing Some-to-None;
   - remove returning only that reference to unavailable;
   - conditional and `$bind` children updating from the same store;
   - snapshot replacement on reconnect, proving omitted stale rows disappear.
5. Assert exact negative controls: a present matching UUID never renders unavailable, an absent UUID does, unrelated rows do not satisfy `where`, and no canonical typed child is silently omitted or rendered as unsupported.
6. Extend contract-matrix live mode to render `contract.sessions` from the installed published package with real UUID arguments, verify `plugin_surface_render`, sanctioned `session` subscription, canonical store frames, visible lifecycle values, absent-reference state, and reconnect rehydration.
7. Update only documentation needed to state the canonical family and reproducible acceptance command.

## Risks

- **Dual-family regression:** leaving one `botster-web.session` read or projection would split home UI and plugin binding state. Mitigate with repository-wide assertions and a cold switch.
- **Canonical-field loss:** the current explicit mapper can discard `lifecycle_class` or future canonical fields. Mitigate with fixture-derived record assertions on snapshot and patch paths.
- **Incorrect patch semantics:** shallow patching can leave a stale lifecycle field if the producer represents Some-to-None by omission rather than an explicit canonical transition. Mitigate by following the published frame scenario exactly and treating reconnect snapshots as authoritative replacement.
- **False runtime proof:** direct SSR or hand-authored trees can bypass plugin rendering, transport, or the production registry. Mitigate with both `UiNodeSurface` tests and the real packaged `contract.sessions` route.
- **Silent child loss:** discriminated `UiChild` variants can be accepted by types but skipped at runtime. Mitigate with explicit nested bind/conditional assertions and unsupported-marker checks.
- **Reconnect race:** stale deltas from an old WebRTC generation could overwrite the new snapshot. Mitigate by retaining generation/sequence gates and proving the observable post-reconnect rows.
- **Downstream ownership drift:** pulling Workspaces changes into this branch would create a dependency cycle and hide the generic boundary. Mitigate by keeping both downstream ticket IDs explicit.
- **Stale baseline:** implementing from the current five-commit-behind branch can regress merged Workspaces smoke. Mitigate by integrating current main first.

## Acceptance checks and runtime proof

Deterministic checks:

1. `npm test`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. Repository-wide search confirms no production or active-test reference to `botster-web.session` remains; historical plan prose may remain unchanged.
6. Package verification proves the normal locked `@trybotster/hub-test-support` artifact supplies the session binding fixture; no sibling checkout or copied fixture is used.
7. Tests render the published surface through `UiNodeSurface` and `ionicUiNodeRendererRegistry`, proving the same registry mounted by `App.tsx` handles the canonical tree.
8. Tests prove snapshot/upsert/patch/remove, current/ended/indeterminate, Some-to-None, matching-versus-absent, unrelated-row negative control, nested `$bind`/conditional updates, empty-template recovery, and no silent child dropping.
9. Transport tests prove one sanctioned raw `session` subscription feeds canonical family `session`, reconnect creates a fresh subscription/snapshot, stale rows are removed, and stale-generation deltas do not win.

Live downstream proof required by the Web charter:

10. `npm run smoke:plugin-contract-matrix` (or its documented focused equivalent) installs and enables the published fixture against a real Hub, renders `contract.sessions` via the production app route and `plugin_surface_render`, and observes visible lifecycle/unavailable states from real entity frames.
11. The live harness proves WebRTC reconnect pull/replay changes the mounted surface, not merely an event log or store helper.
12. Existing Workspaces compatibility smoke still passes after current-main integration, demonstrating this generic change does not regress named-slot rendering. It is not substituted for downstream lifecycle proof.
13. The implementation artifact records that the actual Workspaces-authored lifecycle surface remains required in `ticket_1785296184_677408` and final browser integration in `ticket_1785192726_335558`.
14. No changed source, tests, docs, logs, or artifacts contain local absolute paths or private machine data.

## Vault and workflow checklists

- Vault checklist `checklist_1785433693_344876` records the exact vault/project notes constraining the plan, convention conflicts, verification evidence, and durable-capture decision.
- Workflow checklist `checklist_1785433698_865987` records authoritative routing, ordered playbook loading, repository/artifact inspection, explicit ambiguity resolution, and plan/gate completion.
- Convention result: no engineering convention conflicts. The plan follows the established cold-turkey migration, published-artifact, canonical DTO, generic binding, and runtime-proof decisions.

## Vault gaps worth capturing

- Candidate durable note: when a downstream owner-authored consumer ticket depends on a generic client capability, the capability ticket should prove the producer-owned conformance surface and explicitly assign the real product surface to the downstream ticket; acceptance wording must not imply reversing the dependency into a cycle.
- No vault write is required during Plan. Capture that note through the normal vault inbox only if implementation/review confirms this ordering pattern is reusable beyond this ticket.
- Capture a separate note only if implementation discovers a new stable contract not already represented by the loaded session-binding, reconnect, or hydration notes.

