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

- Project Pipelines current context included the ticket, run, step, plan gate, dependencies, checklists, question, answer, plan artifact, and Plan Review findings. This revision addresses all six returned findings explicitly.
- Closed Hub dependency `ticket_1785295607_887142` owns the canonical `/session` projection and published test-support contract.
- Closed Web dependency `ticket_1785370604_722256` owns the Workspaces named-slot compatibility smoke already merged to current main.
- Human answer `question_1785433679_132882` selected the owner-neutral acceptance seam: this run proves the published Hub `contract.sessions` plugin-worker surface and production Web transport/store/reconnect path. The actual Workspaces lifecycle surface stays downstream in `ticket_1785296184_677408`, with final browser integration in `ticket_1785192726_335558`.
- `package-lock.json` resolves `@trybotster/hub-test-support@0.1.16`, conformance revision 24, and UI contract 0.1.1. A clean install exposes the published session-plugin-binding and session-lifecycle-subscription conformance fixtures plus the `contract.sessions` package surface.
- The published fixture binds one exact-filtered child per referenced UUID against `/session`, displays `@/lifecycle_class` for a matching entity, and selects `empty_template` only for an absent UUID. Its scenario covers current, ended, indeterminate, patch-to-ended, Some-to-None/indeterminate, remove, and reconnect snapshot omission.
- The separate published session-lifecycle-subscription fixture supplies the required empty snapshot, entity upsert, patch, remove, fresh-subscription snapshot-before-deltas, prior-generation discard, overflow resync, and later-delta ordering cases. The binding fixture does not contain an upsert and must not be mutated to invent one.
- The production plugin route already passes the Hub-validated canonical `UiChild` tree directly to `UiNodeSurface`; the prior compatibility conversion was removed.
- `IonicUiNodeRenderer.tsx` already contains generic `bind_list`, `$bind`, conditional, exact `where`, nested row-scope, and empty-template resolution against the entity store.
- The broken seam is the production session projection: `hubTransport.ts` subscribes to the sanctioned Hub `session` stream but rewrites it into private family `botster-web.session`, while canonical `/session` bindings resolve family `session`. The explicit record projection also omits canonical `lifecycle` and `lifecycle_class`, and injects Web-only presentation keys that must not become part of the plugin-visible canonical family.
- `entities.ts` already reconciles authoritative snapshots, upserts, shallow patches, removes, and reconnect replacement; the held WebRTC subscription path already creates a fresh generation, pulls an authoritative snapshot before deltas, detects sequence gaps, and rejects stale generations.

## Scope

1. Integrate current `origin/main` before implementation and resolve any overlap without discarding the merged Workspaces compatibility proof.
2. Cold-switch the browser session entity family from `botster-web.session` to canonical `session` everywhere in the production transport, application reads/pulls, tests, and harness expectations. Do not retain a parallel alias.
3. Materialize canonical family `session` with generic store `id` plus the unmodified `DaemonSessionEntity` fields, including `session_uuid`, nullable/optional `lifecycle`, and `lifecycle_class`. Do not place Web-derived `title`, `target`, `last_result`, `status`, `attachable`, `attach_status`, or `attach_action` keys in the canonical record.
4. Keep one sanctioned held subscription to raw Hub family `session`; route its snapshot/upsert/patch/remove frames into the generic entity store and existing reconnect replay path.
5. Exercise the published session binding fixture through the production `UiNodeSurface` and Ionic renderer registry, not through renderer internals or a local resolver.
6. Prove the published flat `bind_list`/`$bind` surface unchanged. Prove conditional, `bind_if`, and nested-child handling separately with small Web-authored trees typed directly as the published `@trybotster/ui-contract` `UiChild` union (`UiConditional | UiNode | UiBindList | UiBindIf`), including a negative assertion that typed children are not silently dropped. These trees exercise the production generic resolver; they do not define a second grammar or resolver.
7. Extend the real packaged browser harness to install the normal published contract-matrix fixture, render `contract.sessions` through `plugin_surface_render`, and observe canonical session frames through the actual React transport/entity store.
8. Derive existing home/terminal presentation at the read boundary from canonical `session_uuid`, `lifecycle`, and `registry_state`; keep browser-only labels and attach actions out of the entity store so plugins and the TUI observe the same canonical keys.
9. Update stable architecture or runbook claims only where the canonical family name or new live acceptance command needs documentation.

## Non-scope

- No changes to Hub session lifecycle derivation, DTO validation, entity subscription protocol, or plugin-worker capabilities.
- No changes to botster-workspaces in this run.
- No Workspaces-specific React state, imperative list refresh, special-case renderer branch, force-click proof, copied fixture, or Web-local binding/entity resolution engine. Small canonical test trees typed against the published `UiChild` union are allowed only to cover variants absent from the published surface.
- No compatibility binding grammar, private `bindings[]` conversion, dual `session`/`botster-web.session` store, versioned replacement family, or fallback primitive vocabulary.
- No renaming or migration of unrelated private families, including test-only `botster-web.session_draft` and production `botster-web.app`, `.package`, `.package_navigation`, `.available_package`, and `.spawn_target`.
- No broad renderer refactor, entity-store rewrite, transport redesign, adjacent cleanup, or optional binding configurability.
- No Project Pipelines package/plugin or workflow-policy changes.

## Repository ownership boundaries and dependencies

- Botster Web owns the React/Ionic renderer, browser entity store, WebRTC client consumption, production routes, and browser/runtime proof. Those are the only implementation surfaces in this run.
- Botster Hub owns lifecycle truth, the canonical `/session` family, sequence/snapshot semantics, validated `UiChild` grammar, plugin isolation, and the published conformance artifact. Web consumes these contracts without redefining them.
- The canonical browser `session` record is parity-sensitive with TUI ticket `ticket_1785298229_854008`: both consumers must expose Hub-authored session meanings. Web-only home/attach presentation is derived after store reads and is never available to plugin `$bind` or `where`.
- Botster Workspaces owns the eventual workspace lifecycle presentation. Its `ticket_1785296184_677408` depends on this Web capability and must prove the real Workspaces-authored surface after this ticket merges.
- Final cross-repository browser integration remains `ticket_1785192726_335558`.
- Both registered prerequisites for this run are closed. The downstream Workspaces tickets are acceptance consumers, not prerequisites; dependency ordering must not be reversed or made cyclic.
- Any defect discovered in lifecycle classification or the published fixture belongs in a Hub-targeted dependency/follow-up rather than being patched privately in Web.

## Assumptions and unknowns

- Assumption: the human answer supersedes the ticket phrase "real owner-authored workspace surface rendering" for this run; `contract.sessions` is the required real owner-neutral plugin-worker surface, while the Workspaces-owned surface is downstream.
- Assumption: `@trybotster/hub-test-support@0.1.16` and revision 24 remain the locked normal published artifact for implementation. No registry upgrade is planned.
- Assumption: Web-only `title`, status text, attachability, and attach action are derived in home/terminal consumers and never coexist as keys in canonical family `session`. The only added record key is generic store identity `id`, equal to `session_uuid`.
- Assumption: Web never derives `lifecycle_class`. The Some-to-None assertion observes canonical `lifecycle` becoming absent when the authoritative reconnect snapshot omits it while `lifecycle_class` remains Hub-authored `indeterminate`.
- Resolved contract: the live harness passes `arguments.session_uuids` through the real `plugin_surface_render` request. The array contains the binding fixture references `session-transition`, `session-stable-current`, `session-ended`, `session-indeterminate`, and `session-missing`; entries must be non-empty strings and the published surface rejects more than 16 references.
- Unknown: whether current main adds overlapping session-family assertions through the merged Workspaces smoke. Resolve these during baseline integration and keep the proof generic.
- If the published fixture, daemon response, and generated types disagree, stop and register the producer mismatch rather than adding a browser compatibility shim.

## Affected surfaces and files

- `src/botster/hubTransport.ts`: canonical session family, canonical record preservation, held-subscription frame projection.
- `src/App.tsx`: canonical session reads/pull plus read-boundary home presentation.
- `src/botster/terminalSession.ts`: derive attachability and retained-session selection from canonical lifecycle fields rather than store-injected presentation keys.
- `src/botster/LocalHubFirstScreen.tsx`: derive diagnostics session summary state from canonical lifecycle fields at the read boundary.
- `src/botster/entities.ts`: expected to remain unchanged; touch only if a fixture exposes a ticket-required generic reconciliation defect.
- `src/botster/IonicUiNodeRenderer.tsx`: expected to remain structurally generic; touch only for a proven owner-neutral `UiChild` materialization defect or silent-child-drop bug.
- `src/botster/uiNodes.ts`: expected to remain a direct `@trybotster/ui-contract` consumer; no local grammar.
- `src/botster/__fixtures__/sessionBindingUiChildren.ts`: small Web-authored `UiChild[]` fixture for conditional, `bind_if`, and nested-child variants absent from the published surface.
- `src/App.test.mjs`: published-fixture import, canonical-family assertions, deterministic materialization and reconciliation proof.
- `scripts/live-packaged-protocol-harness.mjs`: real `contract.sessions` plugin-worker/browser/reconnect proof and canonical family expectations.
- `scripts/check-daemon-protocol-drift.mjs`: include the published session fixture/metadata in drift checks only if it is not already protected by the package verification path.
- `scripts/live-packaged-protocol-helpers.mjs`: extend the owner-neutral entity-frame matcher with canonical session lifecycle fields.
- `README.md` and `docs/architecture.md`: document canonical family `session` and the live contract-matrix `/session` binding proof.

## Implementation sequence

1. Integrate current main, install from the lockfile, and rerun the deterministic baseline before edits. Record exact unrelated failures rather than accepting a blanket pre-existing-failure claim.
2. Add or strengthen drift assertions that identify the locked Hub test-support revision and both published session fixtures used by the tests.
3. Replace the private browser session family with canonical `session` across the production transport and consumers. Snapshot/upsert records contain `id: session_uuid` plus every unmodified `DaemonSessionEntity` field; patches contain `id` plus only the Hub patch keys. Assert that no Web-derived key shadows, overwrites, or augments the canonical contract.
4. Move existing home/terminal display derivation to the read boundary: UUID supplies the title/attach target, canonical lifecycle supplies running status/attachability, and registry state supplies only the existing local display fallback. Do not write those derived values back to the entity store.
5. Drive the published session-plugin-binding fixture through `UiNodeSurface` with the production Ionic registry and generic entity store:
   - authoritative snapshot with matching current, ended, and indeterminate rows plus an absent reference;
   - patch to ended;
   - patch/transition to Hub-authored indeterminate classification;
   - remove returning only that reference to unavailable;
   - authoritative reconnect snapshot omission of `lifecycle`, proving Some-to-None and stale-row replacement.
6. Drive the separate published session-lifecycle-subscription fixture through the production transport/store for its empty snapshot, entity upsert, patches, remove, fresh-subscription snapshot-before-deltas, prior-generation discard, overflow/resync snapshot, and later-delta ordering. Do not add an upsert to the binding fixture or alter either fixture's expected maps.
7. Add small Web-authored, published-type `UiChild` trees for conditional, `bind_if`, and nested `$bind` coverage that the published flat surface does not contain. Render them through `UiNodeSurface` and the production registry/store; assert every typed child either renders or produces the explicit unsupported marker, never silent omission.
8. Assert exact negative controls: a present matching UUID never renders unavailable, an absent UUID does, unrelated rows do not satisfy `where`, and canonical record keys contain no browser presentation meanings.
9. Extend contract-matrix live mode to render `contract.sessions` with `arguments.session_uuids` set to the published five-reference array, verify `plugin_surface_render`, sanctioned `session` subscription, canonical store frames, visible lifecycle values, absent-reference state, and reconnect rehydration.
10. Update only documentation needed to state the canonical family and reproducible acceptance command.

## Risks

- **Dual-family regression:** leaving one `botster-web.session` read or projection would split home UI and plugin binding state. Mitigate with repository-wide assertions and a cold switch.
- **Canonical-field loss:** the current explicit mapper can discard `lifecycle_class` or future canonical fields. Mitigate with fixture-derived record assertions on snapshot and patch paths.
- **Protocol-meaning pollution:** moving Web-only title/status/attach fields into canonical `session` would expose meanings that TUI and Hub do not own. Mitigate by keeping the store record canonical and deriving home/terminal presentation after reads.
- **Incorrect patch semantics:** shallow patching can leave a stale lifecycle field if the producer represents Some-to-None by omission rather than an explicit canonical transition. Mitigate by following the published frame scenario exactly and treating reconnect snapshots as authoritative replacement.
- **False runtime proof:** direct SSR or hand-authored trees can bypass plugin rendering, transport, or the production registry. Mitigate by using the published `contract.sessions` route for live proof; narrowly typed Web-authored trees cover only missing `UiChild` variants and still pass through `UiNodeSurface`, the production registry, and store.
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
5. An exact string-token search confirms no production or active-test family equal to `"botster-web.session"` remains; it must not match or rename `botster-web.session_draft`, and all other unrelated private families remain unchanged. Historical plan prose may remain unchanged.
6. Package verification proves the normal locked `@trybotster/hub-test-support` artifact supplies both session fixtures; no sibling checkout, copied fixture, or mutated expected map is used.
7. Tests render the published surface through `UiNodeSurface` and `ionicUiNodeRendererRegistry`, proving the same registry mounted by `App.tsx` handles the canonical tree.
8. Binding-fixture tests prove current/ended/indeterminate, canonical `lifecycle` Some-to-None on reconnect, matching-versus-absent, unrelated-row negative control, patch/remove, and empty-template recovery without changing the fixture's permanently missing reference.
9. Lifecycle-subscription-fixture tests prove snapshot/upsert/patch/remove, overflow resync, fresh-generation authoritative snapshot before deltas, prior-generation discard, stale-row removal, and later-delta ordering.
10. Published-type Web-authored trees prove nested `$bind`, conditional, and `bind_if` updates plus no silent child dropping through the production resolver path; they introduce no local grammar or resolver.
11. Canonical record assertions allow only generic `id` plus `DaemonSessionEntity` fields and prove `lifecycle`, `lifecycle_class`, and `session_uuid` survive; Web-derived `title`, `target`, `last_result`, `status`, `attachable`, `attach_status`, and `attach_action` are absent. Home/terminal behavior still derives the expected display and attachability after reads.
12. Transport tests prove one sanctioned raw `session` subscription feeds canonical family `session`; no dual family remains.

Live downstream proof required by the Web charter:

13. `npm run smoke:plugin-contract-matrix` (or its documented focused equivalent) installs and enables the published fixture against a real Hub, passes the five published references through `arguments.session_uuids`, renders `contract.sessions` via the production app route and `plugin_surface_render`, and observes visible lifecycle/unavailable states from real entity frames.
14. The live harness proves WebRTC reconnect pull/replay changes the mounted surface, not merely an event log or store helper.
15. Existing Workspaces compatibility smoke still passes after current-main integration, demonstrating this generic change does not regress named-slot rendering. It is not substituted for downstream lifecycle proof.
16. The implementation artifact records the canonical-field parity boundary with TUI ticket `ticket_1785298229_854008`, the actual Workspaces-authored lifecycle surface in `ticket_1785296184_677408`, and final browser integration in `ticket_1785192726_335558`.
17. No changed source, tests, docs, logs, or artifacts contain local absolute paths or private machine data.

## Vault and workflow checklists

- Vault checklist `checklist_1785433693_344876` records the exact vault/project notes constraining the plan, convention conflicts, verification evidence, and durable-capture decision.
- Workflow checklist `checklist_1785433698_865987` records authoritative routing, ordered playbook loading, repository/artifact inspection, explicit ambiguity resolution, and plan/gate completion.
- Convention result: no engineering convention conflicts. The plan follows the established cold-turkey migration, published-artifact, canonical DTO, generic binding, and runtime-proof decisions.

## Vault gaps worth capturing

- Candidate durable note: when a downstream owner-authored consumer ticket depends on a generic client capability, the capability ticket should prove the producer-owned conformance surface and explicitly assign the real product surface to the downstream ticket; acceptance wording must not imply reversing the dependency into a cycle.
- No vault write is required during Plan. Capture that note through the normal vault inbox only if implementation/review confirms this ordering pattern is reusable beyond this ticket.
- Capture a separate note only if implementation discovers a new stable contract not already represented by the loaded session-binding, reconnect, or hydration notes.
