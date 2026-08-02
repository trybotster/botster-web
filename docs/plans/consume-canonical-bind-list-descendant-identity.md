# Consume canonical BindList descendant identity and prove row/control dispatch

## Target and context loaded

- Target repository: `botster-web` (`trybotster/botster-web`).
- Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Pipeline ticket: `ticket_1785602848_609148`; run
  `run_1785644936_833284`.
- The target was resolved from the admitted Botster spawn-target registry. Its
  display name is currently misspelled `booster-web`, but its authoritative path
  and GitHub repository both resolve unambiguously to `trybotster/botster-web`.
  The assigned run worktree, not the ambient target checkout, is the only edit
  location for this run. The Plan base is
  `99fff571b022e5e06535759c6ffe61926600d07a` on
  `project-pipelines/ticket_1785602848_609148`; Plan Review must fetch and renew
  the declared-base/current-`origin/main` comparison before approval.
- Repository routing and role guidance loaded in order: [[planner-playbook]],
  [[botster-planner-playbook]], and [[botster-web-playbook]].
- Required architecture/surface guidance loaded: [[botster-architecture]],
  [[cli-patterns]], [[spa-patterns]],
  [[project pipeline orchestration belongs in a device-level botster plugin]],
  [[project pipelines needs an operator workbench not more primitives]],
  [[project pipelines ui contract belongs in the plugin readme]],
  [[botster orchestration should spawn agents with explicit target ids]],
  [[botster orchestration prompts must bind agents to explicit worktrees]],
  [[botster web uses vanilla ionic primitives by default]],
  [[botster web dto field names must match authoritative rust serde structs]],
  [[botster web adapts hub validated snapshot grammar only on ui tree path]],
  [[botster web plugin app routes are stable host routes]],
  [[botster web request caches belong in react query not zustand or hub session getters]],
  [[botster toolbar actions use declaration order plus fixed overflow intent]],
  [[ui presentation operations are authored by accepted action results]], and
  [[botster-web ionic supersedes catalyst for client shell]].
- Targeted contract and verification notes loaded:
  [[ui contract row ids can bind before template expansion]],
  [[renderer state accepts only realized literal identity]],
  [[post expansion identity uniqueness is scoped to one render not one tree]],
  [[ui bind list typed templates are narrower than the runtime wire grammar]],
  [[plugin dynamic ui lists bind to plugin-owned entities]],
  [[ui bind list where filters plugin entity rows before template expansion]],
  [[hub support metadata can force a web ui contract cold update]],
  [[required bindable fields have authored and realized validation phases]],
  [[mutual exclusion render guards need fixtures containing both branches]],
  [[runtime client acceptance must render delivered snapshots through real registry]],
  [[conformance helpers must dispatch the action id read from the rendered node]],
  [[conformance oracles assert action result frames not toast text]],
  [[hub test support npm releases need external consumer smoke]],
  [[plugin conformance packages prove shared contracts while examples prove product behavior]],
  and [[a regression test must be shown to go red with the fix reverted]].
- [[project-pipelines-playbook]] was loaded last because this step changes no
  Project Pipelines package source but does exercise its workflow policy: routed
  dependencies, a durable plan artifact, checklists, gate evidence, and step
  advancement.
- Repository evidence inspected: `README.md`, `docs/architecture.md`,
  `package.json`, `package-lock.json`, `src/botster/IonicUiNodeRenderer.tsx`,
  `src/botster/UiNodeSurface.tsx`, `src/botster/uiNodes.ts`,
  `src/botster/__fixtures__/uiNodeConformance.ts`, the production action/result
  path in `src/App.tsx`, deterministic coverage in `src/App.test.mjs`, the live
  `contract.sessions` path in `scripts/live-packaged-protocol-harness.mjs`, and
  the protocol drift check.
- Current renderer behavior is narrower than the ticket's required realized-tree
  validator, but it is not absent: `resolveChild` currently detects duplicate
  direct bound row-root identities with `identityCounts` and silently drops every
  colliding row while leaving the rest of the surface interactive
  (`IonicUiNodeRenderer.tsx:316-327`). The current shared negative loop in
  `App.test.mjs:6891-6907` locks that behavior together with missing/blank root
  handling by still collecting the valid sibling action. The new whole-render
  collision policy must deliberately supersede only the duplicate-row part of
  this behavior.
- Baseline commands are executable on the declared base: `npm test` passed and
  `npm run typecheck` passed before planning changes.
- No other open ticket in project `project_1785192644_645154` targets
  `botster-web`; no same-target scope needs folding or cancellation.

## Published prerequisite

- Registered dependency `dependency_1785602872_455279` points to Hub ticket
  `ticket_1785443253_376782` on Hub target
  `tgt_7e208a0c76a44980a83b63af976b1f22`. It is closed and merged as
  `trybotster/botster-hub#188` at
  `1955c9e0713281093f609d09f6597a1dcfaf07d3`.
- Registry preflight on 2026-08-01 resolves immutable
  `@trybotster/ui-contract@0.3.1` with integrity
  `sha512-f88kS2oaG9s5pRq3RS3aLNaIx3YvT3JDTv2ej/x4h6Ui7vuiO33C+ZlC3iBFLSNYmT8gAYwKY7vLpdiJUSK/jA==`
  and `@trybotster/hub-test-support@0.1.20` with integrity
  `sha512-boWbtFjL0Bbu5fybPanAjwm+BuWH0EG+ZzM7uRE2aGrpG/fJh9jjhBbwY8EH6/vUwg0sJPZZn+v2BcGAvxGsqQ==`.
- Published Hub support metadata is package `0.1.20`, daemon protocol `4`,
  conformance fixture revision `27`, and UI contract `0.3.1`. Its declared npm
  dependency is exactly `@trybotster/ui-contract@0.3.1`.
- The published UI runtime exports
  `realizeBindListDescendantId(rowId, key)`. Rust-generated golden vectors cover
  ASCII, delimiter-like, whitespace, accented/CJK/emoji, and prefix-like input.
  The published `session-plugin-binding-conformance-fixture` contains a bound
  direct row root plus keyed Spawn, Rename, and Remove descendants, exact
  materialized IDs/payloads, lifecycle transitions, removal, and reconnect
  expectations.
- These artifacts satisfy the dependency premise. Implementation must cold-repin
  to these exact versions and registry tarballs, with no `file:`, sibling
  checkout, override, or compatibility path. If registry bytes or metadata no
  longer match this evidence, stop rather than silently selecting another
  coordinate.

## Contract-preserving implementation plan

1. **Cold-repin the published contract pair.** Update `package.json` and
   `package-lock.json` so direct `@trybotster/ui-contract` is exactly `0.3.1`
   and dev `@trybotster/hub-test-support` is exactly `0.1.20`. Preserve the
   existing equality assertion between Web's direct UI pin and support metadata,
   update the expected conformance revision from 25 to 27, and require one
   resolved UI-contract version in `npm ls`.

2. **Make Web's materialization boundary understand the new authored identity.**
   In `IonicUiNodeRenderer.tsx`, retain the direct `item_template.id =
   { "$bind": "@/..." }` behavior unchanged. Carry the nearest successfully
   realized bound item-root identity while recursively visiting its descendants.
   When a descendant id is
   `{ "$kind": "bind_list_descendant_id", "key": "..." }`, call the imported
   `realizeBindListDescendantId` runtime helper and pass its literal result onward.
   Nested BindLists establish their own row-root context. Static/literal ids stay
   byte-for-byte unchanged; descendant full-ID `$bind`, misplaced keyed forms,
   blank/unresolved descendant keys, and unresolved descendant identity sentinels
   fail the surface closed. Preserve the existing direct-root behavior for a
   missing, non-string, or blank `$bind` result: omit that unresolved row without
   fabricating identity, while valid sibling rows remain interactive.
   Do not add an encoder, parse the returned id, synthesize/index ids, normalize
   Unicode, or retain a 0.2 compatibility branch.

3. **Validate identity before React or action state.** Add a renderer-internal
   prepass over the same entity store, presentation state, and conditional rules
   used by the production render. It has two distinct checks:

   - authored descendant keys are nonblank and unique across the complete item
     template, including children, slots, conditionals, and bind-if branches;
   - after row filtering/expansion and conditional evaluation, every literal
     node id is unique among nodes that actually coexist in that render.

   Cold-remove the existing `boundIdentity`/`identityCounts` duplicate-row drop
   filter from `resolveChild`; do not preserve it as an earlier cleanup pass or
   compatibility path. The prepass must receive the unfiltered set of all
   successfully realized row roots so duplicate direct row ids become an
   observable whole-render collision and cannot disappear before diagnostics.
   Missing/blank/unresolved row roots remain omitted before the collision set
   because they never become literal renderer identity; duplicate literal row
   roots do become members and invalidate the surface.

   The final collision set includes roots, static siblings, direct row roots,
   generated descendants, literal descendants, nested list expansions, and
   every slot. `when`/`hidden` and presentation alternatives that cannot coexist
   may reuse a final id; unconditional content plus the selected alternative may
   not. Reuse the same resolver/branch predicates for validation and rendering
   so the two paths cannot disagree. No identity may reach a React key,
   `data-ui-node-id`, form/result lookup, `collectAction`, `dispatchAction`, or
   `UiActionRequest.node_id` until the prepass succeeds.

4. **Fail closed with actionable, bounded diagnostics.** A malformed authored
   descendant key/context and a duplicate realized id are separate diagnostic
   kinds. Render one surface-level fallback instead of a partially interactive
   ambiguous tree, publish no action callbacks, and identify the surface,
   offending key or exact realized id, and the two bounded structural
   locations/row identities that conflict. This whole-surface policy includes
   duplicate direct row roots and intentionally replaces their current silent
   drop-plus-partial-interactivity behavior. It does not change the existing
   per-row omission of a direct root whose `$bind` is missing, non-string, or
   blank; those rows never realize an identity, and valid siblings continue to
   render and collect actions. Do not dump entity records, action payloads, broad
   trees, or secrets, and do not repair either identity. Preserve the existing
   unsupported primitive, capability, and unresolved-root behavior outside this
   collision boundary.

5. **Adapt deterministic production-renderer proof.** Update the canonical
   fixture assertions in `src/App.test.mjs` (and the fixture adapter only if the
   new published type shape requires it) to render through
   `ionicUiNodeRendererRegistry`/`UiNodeSurface` and the real entity store. Assert:

   - at least two rows times Spawn/Rename/Remove yield the exact published
     row/control IDs and payloads in producer order;
   - `collectAction`, rendered `data-ui-node-id`, `pluginSurfaceActionRequest`, and
     correlated `UiActionResult.node_id` all carry the same exact literal;
   - every published golden vector, including delimiter-like and Unicode values,
     reaches the DOM and dispatch boundary through the package helper;
   - snapshot/upsert/patch/remove and an authoritative reconnect snapshot preserve
     stable identities for surviving rows and remove departed rows;
   - duplicate authored keys, unresolved/misplaced keyed identities, repeated
     literal descendants, duplicate row roots, generated-vs-static collisions,
     and cross-row final collisions produce the intended diagnostic and zero
     actions;
   - a fixture containing both responsive alternatives proves only the active
     mutually exclusive branch participates, while duplicate coexisting siblings
     and an unconditional surrounding node still fail.

   Render and interact with the real component/registry; source regexes and
   serialized fixture inspection are supporting guards only. Demonstrate the new
   regression assertions go red when helper-based descendant realization or the
   collision prepass is narrowly ablated, then restore green.

   Split the currently shared `App.test.mjs:6891-6907` negative loop. Preserve
   its existing missing and blank direct-root cases, including the assertion that
   the valid `sess-valid` sibling still renders and contributes one action. Move
   the duplicate `sess-duplicate` rows into a separate expectation for the new
   surface-level realized-collision diagnostic and zero collected actions. This
   assertion change is an intentional cold replacement of the narrow duplicate
   drop policy, not incidental test cleanup.

6. **Extend the real Web/Hub transport proof.** In
   `scripts/live-packaged-protocol-harness.mjs`, keep using the published
   `contract.sessions` producer installed by the existing
   `smoke:plugin-contract-matrix` path. After the production route delivers the
   Hub-validated snapshot and entity frames, locate controls by the rendered
   row/control `data-ui-node-id` and read their rendered `data-action-id`; never
   reconstruct ids or dispatch a parallel hardcoded request. Exercise at least
   one mouse click and one keyboard activation on different row/control pairs.
   For each, assert the normal Web callback emits exactly one
   `plugin_surface_action` whose `node_id`, action id, operation, and session UUID
   identify the selected row/control, and assert the structured accepted result
   echoes the same identity. Repeat identity/read-back assertions after a fresh
   WebRTC subscription generation and authoritative reconnect snapshot. Toast or
   visible copy is not the action oracle.

7. **Update current operational documentation only.** Update `README.md` and
   `docs/architecture.md` to describe the canonical direct-row plus descendant-key
   realization order, render-scoped failure behavior, and the strengthened live
   contract-matrix proof. Do not retrofit historical `docs/plans/**` files or
   change Workspaces/package/Hub policy. This plan is the repository's durable
   implementation artifact.

## Scope

- Exact npm repin and lockfile convergence for the published Hub-owned contract
  and support artifacts.
- Web-owned entity-aware materialization of canonical descendant identity through
  the published helper.
- Web-owned authored-key and realized-render identity validation/diagnostics.
- Production Ionic renderer, action-state, request/result, reconnect, and real
  Web/Hub transport proof using the canonical producer fixture.
- Minimal current README/architecture updates made stale by the new shipped Web
  behavior.

## Non-scope

- No edits to botster-hub, botster-core, botster-tui-kit, botster-tui,
  botster-workspaces, or Project Pipelines package/plugin source.
- No local encoder, copied prefix/byte-length algorithm, decoder, string
  interpolation, hashing, delimiter joining, normalization, row index, synthetic
  fallback, collision repair, or alternate identity source.
- No descendant complete-ID `$bind`, action request/result grammar change,
  rewrite of the direct-root `$bind` realization semantics, compatibility alias,
  dual old/new code path, feature flag, or optional configuration. Removing the
  superseded duplicate-row `identityCounts` drop filter is required collision
  migration work and is not a rewrite of how a valid direct root resolves.
- No daemon protocol/feature/revision policy, package admission, producer fixture,
  Lua action policy, entity schema, or Hub publication change.
- No broad UiNode renderer refactor, new primitive, custom Ionic component,
  adjacent cleanup, or bulk rewrite of historical plans.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns** browser entity materialization, production Ionic/React
  keys and DOM identity, browser-local action/form/result state, diagnostic
  presentation, reconnect behavior, and downstream browser conformance.
- **botster-ui-contract in botster-hub owns** the authored wire grammar, placement
  rules, versioned UTF-8 encoding, JavaScript runtime helper, declarations,
  schema, and golden vectors. Web imports those artifacts and does not restate
  their semantics in a second implementation.
- **botster-hub runtime owns** authored-tree admission, package/plugin-worker
  transport, daemon requests/results, and publication policy. This run consumes
  its merged immutable release and does not broaden Hub policy.
- **botster-hub-test-support owns** the canonical `contract.sessions` producer,
  strict reference materialization, metadata/revision, and published fixture.
  Web compares production output to it rather than mirroring it.
- **TUI-kit and TUI are peer consumer tickets**, not hidden scope. Their exact
  string/hit-map/input proof is separately routed; final project integration may
  compare their merged evidence with Web.
- The only registered prerequisite is already satisfied. If implementation
  reveals a producer/helper/schema defect, stop and register a new dependency
  against Hub target `tgt_7e208a0c76a44980a83b63af976b1f22`
  rather than patching around it in Web.

## Assumptions and unknowns

- Package coordinates `0.3.1` and `0.1.20`, revision `27`, protocol `4`, and the
  recorded registry integrities are the exact immutable artifacts intended by
  the ticket. This is verified registry state, not inferred from the closed
  ticket alone.
- The new authored tag is exactly `bind_list_descendant_id`; `key` is the only
  field; the direct bound root remains the nearest row identity; nested BindLists
  reset that context.
- Template-global duplicate-key rejection is intentionally stricter than final
  render-scoped collision validation. Mutually exclusive branches may reuse a
  literal final id, but may not author the same descendant key in one template.
- The Web failure policy is fail-closed at the rendered surface: an ambiguous
  tree is not partially interactive, and diagnostics expose only bounded
  identity/location facts. Plan Review should challenge this before approval if
  a different consumer policy is required.
- This policy cold-replaces the current duplicate-bound-row silent drop filter.
  Missing/blank direct row roots retain their current per-row omission behavior;
  the plan does not reclassify an unresolved identity as a realized collision.
- Ionic's native Button activation should route both pointer click and keyboard
  activation through the existing `onClick` callback. The live smoke must prove
  this rather than assuming browser semantics.
- The daemon protocol declaration should remain byte-identical because protocol
  version stays 4; support metadata and fixtures still change. If drift check
  proves otherwise, implementation must explain the authoritative artifact
  difference rather than accepting or hand-editing it blindly.
- No ticket requirement is waived. A need for a local encoder, compatibility
  grammar, new producer behavior, or alternate collision policy is a blocking
  human/dependency question, not implementation discretion.

## Affected surfaces and files

- `package.json`, `package-lock.json` — exact cold pins and one resolved contract.
- `src/botster/IonicUiNodeRenderer.tsx` — descendant helper consumption,
  nearest-row context, pre-render validation, collision diagnostics, and the
  production key/DOM/action path.
- `src/botster/uiNodes.ts` — expected unchanged unless the published union needs
  a narrow realized-only type refinement; it must not redeclare the contract.
- `src/botster/UiNodeSurface.tsx` — expected unchanged unless the bounded
  surface-level diagnostic needs a narrow renderer result seam.
- `src/botster/__fixtures__/uiNodeConformance.ts` — expected fixture-shape-only
  adaptation, if required; canonical bytes remain imported from the package.
- `src/App.test.mjs` — metadata revision, golden vectors, production renderer,
  collision, action/request/result, and reconciliation/reconnect proof; split the
  existing lines 6891-6907 so missing/blank roots retain partial interactivity
  while duplicate realized row roots switch to fail-closed diagnostics.
- `scripts/live-packaged-protocol-harness.mjs` — real rendered click/keyboard and
  structured request/result/reconnect proof.
- `scripts/check-daemon-protocol-drift.mjs` and
  `src/botster/generated/daemon-protocol.ts` — expected behavior/bytes unchanged;
  touch only if the authoritative published artifact proves a necessary update.
- `README.md`, `docs/architecture.md` — current contract and live-proof docs.
- `docs/plans/consume-canonical-bind-list-descendant-identity.md` — this plan.

Every changed line must trace to the exact package update, canonical identity
materialization, collision safety/diagnostics, production dispatch proof, or
documentation made stale by those changes.

## Risks and controls

- **JavaScript UTF-16 drift:** never compute lengths in Web; call the package
  helper and compare rendered results with Rust-generated vectors.
- **Identity enters state too early:** preflight the actual visible materialized
  tree before React keys, DOM attributes, form/result state, or action collection.
- **Over-strict global flattening:** evaluate the same conditional/presentation
  branches as render and test competing alternatives together.
- **Under-strict local checks:** collect across the whole coexisting surface so
  root/static/row/descendant/slot/nested-list collisions cannot hide in separate
  recursive calls.
- **First duplicate remains interactive:** validate before render; fail the whole
  surface and collect zero actions instead of discovering the second id late.
- **Superseded drop filter hides collisions:** remove the existing bound-row
  `identityCounts` filter cold-turkey and ablate the new prepass to prove duplicate
  row roots no longer disappear silently.
- **Authored-key and final-id rules get conflated:** keep separate diagnostic
  kinds and tests for template-global duplicate keys versus render-scoped final
  collisions.
- **Row/control misdispatch:** read both identities and action metadata from the
  rendered DOM, correlate exactly one daemon request and structured result, and
  use different rows/controls for click and keyboard proof.
- **Fixture-only false confidence:** run the published producer through the real
  Hub/package/plugin-worker/WebRTC/React path and render the delivered snapshot.
- **Reconnect looks green on stale DOM:** require a fresh subscription id and
  authoritative entity snapshot before comparing post-reconnect identities and
  dispatch.
- **Package graph drifts or duplicates:** exact pins, lockfile integrities,
  metadata equality, `npm ls`, and clean install/build/test gates.
- **Diagnostic leaks:** include only bounded surface/id/key/path/row facts; add a
  negative assertion against entity/action payload dumps.
- **Historical-plan churn:** update only current README/architecture and the new
  plan; old plans remain historical evidence.

## Acceptance checks and tests

1. **Dependency and artifact identity**

   ```sh
   npm view @trybotster/ui-contract@0.3.1 version dist.integrity
   npm view @trybotster/hub-test-support@0.1.20 version dist.integrity dependencies
   npm ci
   npm ls @trybotster/ui-contract @trybotster/hub-test-support
   ```

   Require exact pins, recorded integrities, support metadata revision 27/UI
   contract 0.3.1/protocol 4, one resolved UI package, and no local/sibling
   override.

2. **Focused deterministic renderer and regression proof**

   ```sh
   npm test
   npm run typecheck
   ```

   Require multiple rows times multiple controls, every published golden vector,
   exact DOM/action/request/result identity, entity snapshot/upsert/patch/remove,
   authoritative reconnect, duplicate-key and final-collision diagnostics,
   mutually exclusive branch reuse, zero action collection on invalid trees, and
   a recorded narrow red/green ablation of helper use and collision enforcement.

3. **Repository Web gates**

   ```sh
   npm run lint
   npm run build
   npm run smoke:browser-runtime
   git diff --check
   ```

   Typecheck, unit/component tests, production build, lint, and the compiled real
   React browser smoke must all pass. Source presence or snapshots alone do not
   satisfy the Web charter.

4. **Real published producer through Web/Hub transport**

   ```sh
   BOTSTER_HUB_BIN=/path/to/merged/botster-hub \
   BOTSTER_SESSION_WORKER_BIN=/path/to/locked/botster-session-worker \
   npm run smoke:plugin-contract-matrix
   ```

   Require the exact installed support fixture, Hub-validated delivered snapshot,
   production entity store/registry/Ionic DOM, two or more current rows with all
   three controls, representative click and keyboard activation on different
   row/control pairs, exactly one request per interaction, exact structured
   request/result node/action/payload correlation, and stable post-reconnect
   identity under a fresh subscription generation. Record Hub/worker binary
   provenance; no fixture transport or direct browser-authored request can replace
   this gate.

5. **Final discipline**

   - Inspect the complete diff for local encoders, compatibility grammar,
     hand-authored producer mirrors, broad refactors, stale docs, and secret/PII
     leakage.
   - Re-run all commands from a clean install/worktree state in Verify, reconcile
     review findings against live files, and attach exact command evidence.

## Vault gaps worth capturing

- Existing notes already define the two-phase identity boundary, template-global
  descendant-key rule, render-scoped final uniqueness, cold metadata coupling,
  real-registry proof, and render-then-dispatch discipline. No new vault capture
  is justified at Plan time.
- After implementation and live verification, capture one durable cross-client
  convention only if Web and TUI evidence establishes a reusable diagnostic/fail-
  closed pattern not already covered by [[post expansion identity uniqueness is scoped to one render not one tree]].
- The spawn-target display typo is operational metadata drift but did not create
  routing ambiguity; do not create a duplicate vault note for it from this run.
