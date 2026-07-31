# Consume Hub plugin resource counter protocol

## Target and context loaded

- Target repository: `trybotster/botster-web`; target id `tgt_40abcf71ccf049f4ac0c99953a799869`. Project Pipelines resolved this target before repository inspection; the assigned ticket worktree is the only write scope.
- Pipeline context: run `run_1785529027_168661`, Plan step `botster_stack_plan`, ticket `ticket_1785515827_864108`, its gate, empty prior artifacts/reviews/findings, no registered blocking dependencies, and the answered scope question were loaded through Project Pipelines.
- Repository charter: [[botster-web-playbook]]. Role and surface context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], and [[project-pipelines-playbook]].
- Targeted vault authority: [[botster web dto field names must match authoritative rust serde structs]], [[generated typescript dtos must encode serde field optionality]], [[generated dto drift tests need symmetric field and type checks]], [[botster web generated protocol drift checks need explicit hub artifact paths]], [[hub test support npm releases need external consumer smoke]], [[closed dependency tickets signal merged source not a consumable release]], [[hub generated protocol changes are a four site release chain]], [[pipeline vault checklists must cite exact resolvable note titles]], and [[vault example paths are not repository placement conventions]]. The remaining mandatory Web and Botster planner notes were loaded and recorded in the run vault checklist.
- Repository authority inspected: `README.md`, `docs/architecture.md`, `package.json`, `package-lock.json`, `scripts/check-daemon-protocol-drift.mjs`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`, `src/botster/IonicUiNodeRenderer.tsx`, `src/App.test.mjs`, and prior protocol-consumption plans under `docs/plans/`.
- Upstream evidence: public `@trybotster/hub-test-support@0.1.18` was independently installed from the normal registry with integrity `sha512-llWRLNjFVKzi3CxII1waPO6u2w+TEAesiI8esVTEu8/rwuedeoZXXYTD0Sew76/8reysoZ1gy4P6LNoTptXsTA==`; its daemon protocol SHA-256 is `956b2ce7c07523af848da885006c21f944b580799551b208f59f96450a245c0b` and contains `plugin_resource_counters`. Published `0.1.17` is immutable but stale and must not be used.
- Botster layers touched: generated browser DTO/conformance consumption and the Ionic renderer's shared UI-contract adapter. No Hub, Core, Lua plugin, session worker, TUI, Rails relay, MCP, or Project Pipelines implementation changes.

## Scope

1. Cold-update the package graph to the coherent published consumer pair:
   - exact `@trybotster/hub-test-support@0.1.18` in `devDependencies`;
   - exact direct `@trybotster/ui-contract@0.2.0` in `dependencies`;
   - one resolved UI-contract version in `package-lock.json`, with no `0.1.1` copy, override, alias, local path, or dual-version compatibility path.
2. Replace `src/botster/generated/daemon-protocol.ts` byte-for-byte from the installed `0.1.18` support artifact. Against the current vendored file, the expected generated delta is only:
   - optional `DaemonResponse.plugin_resource_counters?: DaemonPluginResourceCounters | null`;
   - `DaemonPluginResourceCounters { active_timer_resources: number }`.
3. Extend the existing generated-protocol recognition seam narrowly: add a typed `satisfies DaemonResponse` fixture carrying `plugin_resource_counters` and assert its field/value through `src/App.test.mjs`. Do not duplicate generated declarations or invent browser-only counter semantics.
4. Adapt Web to the published UI contract `0.2.0` where the compiler or canonical fixture proves it is required. In particular, consume the package's `bound_row_identity` conformance fixture and ensure an item-relative `UiNode.id` binding is resolved from each `UiBindList` row after `where` filtering and before the node enters React keying, renderer identity, focus, form/action, or result-matching state. Realized ids must be non-blank literal strings; duplicate or unresolved identities fail through the existing renderer contract/error path. Root/static/empty-template ids and action request/result `node_id` remain literal-only.
5. Preserve the existing `src/App.test.mjs` invariant that Web's direct UI-contract pin equals `hub-test-support` metadata. Any actual `0.2.0` consumer failure gets the smallest Web-owned adapter/test correction necessary for the published contract; it is not grounds for weakening the invariant.

This ticket is intentionally scaffold-only for `plugin_resource_counters`: `src/botster/realHubDaemonDto.ts` already re-exports the generated protocol into production browser adapter types, but this ticket adds no request, display, polling, or counter policy. The runtime/user-path change required by the UI-contract dependency is separate and concrete: canonical bound row identities must render and dispatch through the production Ionic registry.

## Non-scope

- No Hub counter production, resource thresholds, four-package workload changes, debug-counter policy, or edits in `botster-hub`/`botster-core`.
- No Web counter panel, diagnostics copy, request invocation, polling, cache, entity family, action, or compatibility feature requirement.
- No hand-edited parallel DTO, fallback to `0.1.17`, sibling/path dependency, package override, dual UI-contract version, compatibility alias, or waiver of package metadata checks.
- No speculative renderer refactor, new abstraction layer, unrelated dependency upgrades, broad fixture rewrites, docs baseline claims, or adjacent cleanup.
- No changes to Project Pipelines package/plugin code or workflow definitions. Loading its playbook and maintaining checklists are pipeline discipline, not product scope.

## Ownership boundaries and cross-repository dependencies

- `botster-hub` owns `DaemonResponse` production, `DaemonPluginResourceCounters`, generated source bytes, support-package metadata/assets, publication, and `script/test-production-package-runtime`.
- `botster-web` owns the exact consumer pins, lock graph, vendored generated copy, TypeScript recognition, Ionic adapter compatibility, and browser-side tests.
- The publication prerequisite is satisfied, so this run has no blocking upstream dependency to register. The open Hub integration ticket `ticket_1785199716_875648` is the downstream/parent consumer of this Web revision: it remains responsible for the full seven-repository four-package runtime workload after this ticket closes. This run must hand back the Web commit and hash evidence; it must not broaden into that Hub-owned workload.
- If the installed public coordinate, release metadata, Hub source artifact, or vendored bytes disagree, stop and route the release/synchronization defect to target `tgt_7e208a0c76a44980a83b63af976b1f22` rather than repairing Hub-owned bytes here.

## Assumptions and unknowns

- Verified assumption: normal-registry `0.1.18`, not `0.1.17`, is the immutable corrected coordinate; its metadata reports protocol version 4, conformance fixture revision 25, UI contract `0.2.0`, and the recorded daemon-protocol SHA-256.
- Human decision: direct `@trybotster/ui-contract` must move to exact `0.2.0`; preserve one lockfile version and the unchanged direct-pin-equals-support-metadata assertion. Real consumer adaptations are within scope.
- The current checked-out `node_modules` is stale relative to the lockfile, so no result from it is acceptance evidence. All package conclusions must come from a clean registry-only install.
- Expected protocol delta is the five generated lines described above. Any other daemon DTO change in installed `0.1.18` is an unexplained release mismatch and blocks blind vendoring.
- UI contract `0.2.0` intentionally widens authored `UiNode.id` to `UiNodeId | UiBind` for bind-list item templates. The exact local type-narrowing/helper shape is implementation detail; the acceptance contract is resolution before renderer state plus fail-closed literal identity.
- Unknown until the clean install and compiler run: whether files beyond `IonicUiNodeRenderer.tsx` need a narrow type adaptation. Add only compiler- or conformance-proven consumers and record each in the implementation artifact.
- Convention conflicts: none after the human scope decision. Cold replacement, exact pins, generated-source authority, and framework-owned renderer paths all align with loaded conventions.

## Affected surfaces and files

- `package.json`, `package-lock.json`: exact `hub-test-support@0.1.18` and `ui-contract@0.2.0` graph.
- `src/botster/generated/daemon-protocol.ts`: byte-for-byte generated artifact replacement.
- `src/botster/__fixtures__/generatedDaemonProtocol.ts`: narrow typed counter-response recognition fixture.
- `src/App.test.mjs`: support metadata/revision/hash and token checks, typed counter fixture assertion, unchanged dependency-equality invariant, canonical `bound_row_identity` renderer/action proof, and negative identity cases.
- `src/botster/IonicUiNodeRenderer.tsx`: expected narrow `UiAuthoredNodeId` realization at bind-list expansion and literal-id enforcement before renderer state.
- `src/botster/uiNodes.ts` or another existing renderer type seam: conditional only if TypeScript requires a local realized-node type/export; do not change it speculatively.
- `src/botster/realHubDaemonDto.ts`: unchanged production re-export seam proving the generated field reaches browser client types.
- `scripts/check-daemon-protocol-drift.mjs`: expected unchanged; it already uses installed support bytes by default, fails asset drift, and accepts an explicit Hub source override.
- `README.md` and `docs/architecture.md`: expected unchanged because exact support-version claims are currently dormant and this ticket adds no counter UI/runtime policy.
- This plan document: reviewable Plan artifact only.

## Risks

- Registry collision/stale bytes: `0.1.17` advertises a release coordinate without the required protocol field. Pin and verify only `0.1.18`, including integrity and content hash.
- Split package authority: updating the support package without direct UI contract `0.2.0` makes the existing metadata invariant fail; retaining both UI versions would hide the mismatch.
- Stale installed dependencies: the ambient `node_modules` does not match the current lockfile and can produce false conclusions. Require a clean install.
- Unrelated generated churn: blindly copying a later or wrong artifact can import unrelated DTO changes. Require exact hash and source/package/vendored byte equality.
- Renderer identity leakage: merely widening TypeScript types can allow binding objects into React keys, DOM attributes, action identities, or form result lookup. Resolve before those consumers and test the real registry.
- Weak proof: source regexes prove field text but not TypeScript consumption; fixture-only bound-id assertions can prove a helper while bypassing the production renderer. Use typed `satisfies` fixtures and render/dispatch the canonical package fixture through `ionicUiNodeRendererRegistry`/`UiNodeSurface`.
- Scope creep from the parent resource project: Web is only a protocol/UI-contract consumer. Thread bounds, timers, reconnect churn, process cleanup, and the complete four-package run remain Hub-owned.

## Acceptance checks and downstream proof

1. From a clean registry-only install, prove `package.json` and `package-lock.json` resolve exactly one `@trybotster/ui-contract@0.2.0` and `@trybotster/hub-test-support@0.1.18`; no `0.1.1`, `0.1.17`, local path, override, or duplicate contract copy remains. Record the published support integrity.
2. Import the installed support package, require `metadata.package_version === "0.1.18"`, `metadata.conformance_fixture_revision === 25`, `metadata.ui_contract.package_version === "0.2.0"`, `verifyPackageAssets().ok === true`, and `readDaemonProtocolTypescript()` containing `plugin_resource_counters` and `DaemonPluginResourceCounters`.
3. Require SHA-256 `956b2ce7c07523af848da885006c21f944b580799551b208f59f96450a245c0b` for both installed and vendored daemon protocol. Compare the vendored file byte-for-byte with the installed package and the explicit Hub generated source artifact; a supplied `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` comparison may not skip.
4. Run `npm test`. It must exercise the default package-backed drift check, unchanged direct-pin metadata invariant, typed counter response, canonical UI-contract conformance fixtures, and existing renderer/dialog/form/BindList regressions.
5. Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm run smoke:browser-runtime`, and `git diff --check`. Typecheck/build are mandatory evidence that no authored binding object leaks into literal renderer identity consumers.
6. Run the applicable live production renderer path with exact Hub/session-worker binaries: `BOTSTER_HUB_BIN=... BOTSTER_SESSION_WORKER_BIN=... npm run smoke:plugin-contract-matrix`. Preserve structured action/result assertions; do not substitute toast text, snapshots, or source scanning.
7. Run the Hub-owned `production-package-runtime-evidence artifact-gate` against the exact Hub source, this Web worktree, and a fresh installed `0.1.18` package. Its declared, installed, metadata, source, vendored, and conformance-revision checks must all be true.
8. Handoff downstream proof to `ticket_1785199716_875648`: record the final Web commit plus package integrity/protocol hashes so its owner can run the full `script/test-production-package-runtime` and four-package resource workload. That full seven-repository run is required downstream proof but is not implemented or altered here.
9. Inspect the final diff. Every line must be an exact package/lock update, generated bytes, a compiler/conformance-required renderer adaptation, its focused tests, or this Plan artifact. Reject unexplained DTO, fixture, UI, docs, or dependency churn.

## Pipeline gates and artifacts

- Plan artifact: this document plus `botster_stack_plan_gate` evidence and the run vault checklist.
- Implement artifact: exact installed coordinates/integrity, metadata and SHA values, lock graph, changed files, byte comparisons, commands/results, and explicit scaffold-only counter disposition.
- Review: reject `0.1.17`, stale/ambient `node_modules` evidence, source-only drift proof, dual UI contracts, invariant weakening, untyped counter assertions, unresolved binding objects, unrelated generated churn, or any Hub/four-package scope expansion.
- Verify: repeat the clean package-backed and explicit-source comparisons, repository gates, real renderer path, and focused artifact gate from the implementation commit; reconcile every prior finding against live files.

## Vault gaps worth capturing

- Capture candidate after implementation proof: a published `hub-test-support` upgrade can force a direct `ui-contract` cold update because Web intentionally asserts its direct contract pin equals support metadata. Existing notes cover the protocol's four-site release chain and artifact availability, but not this coupled package-graph invariant and its renderer adaptation consequence.
- No vault note is created during Plan. If implementation confirms the pattern, capture it through the inbox-first vault pipeline with the package metadata, invariant, and `0.1.18`/`0.2.0` evidence; otherwise record why it was ticket-specific.
