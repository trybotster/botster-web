# botster-web marketplace package lifecycle and dependency gates plan

## Context Loaded

- Pipeline context: ticket `ticket_1782338823_901343`, run `run_1782348876_930018`, step `botster_plan`, gate `botster_plan_gate`. Plan Review returned changes required in `review_1782349367_329958` with four open findings: the generated DTO premise was unverified and contradicted by the vendored protocol, the drift check can silently skip, no marketplace/available-catalog DTO is visible in the current mirror, and the plan needed an explicit dependency-availability risk plus browser/TUI scope boundary. Blocking dependencies are registered as closed: `ticket_1782338822_491979` ("Resolve hub package dependency and feature availability matrices") and `ticket_1782338822_458421` ("Complete hub package lifecycle actions for marketplace v1"), but closed dependency status is not evidence that the consumable generated hub-client artifact has landed in this worktree.
- Run identity: base ref `main`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, workspace `botster-web-marketplace-lifecycle-ui`, assigned worktree is this repository checkout.
- Vault/playbook context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], plus identity/goals context.
- Constraining notes from loaded context: [[botster web dto field names must match authoritative rust serde structs]], [[generated typescript dtos must encode serde field optionality]], [[botster web generated protocol drift checks need explicit hub artifact paths]], [[botster package daemon dto exposes sanitized package rows]], [[package resolution matrix should be computed once per package projection]], [[package resolution config auth keys are a global namespace]], [[package mutations require the running daemon owner]], [[serve daemon package reads must refresh registry after mutations]], and [[botster hub diagnostics use daemon diagnostic rows in client dtos]].
- Repo context inspected: `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`, `scripts/check-daemon-protocol-drift.mjs`, `README.md`, `docs/architecture.md`, and existing package-registry/lifecycle plans under `docs/plans/`.
- Checklist evidence: created run checklist `checklist_1782349006_366720`; item evidence records notes loaded, no convention conflicts, repo inspection commands, verification plan, and no new vault capture. The initial checklist create call timed out at the plugin worker boundary but the checklist persisted and was updated successfully.

## Scope

- Make authoritative hub-client protocol availability the first hard go/no-go implementation step. The implementer must obtain the generated hub-client artifact, regenerate or copy it into `src/botster/generated/daemon-protocol.ts`, and record evidence that the artifact contains marketplace/available-catalog DTOs, hub-provided lifecycle action state, feature availability matrices, dependency/config/auth blocked reasons, update state, and config validation round-trip fields before touching UI projection code.
- Update `src/botster/__fixtures__/generatedDaemonProtocol.ts` with generated protocol fixtures that include Project Pipelines and GitHub provider package rows showing lifecycle actions, available/blocked feature matrices, blocked reasons, dependency/config/auth gates, update state, and configuration schema/validation results.
- Replace the current browser-inferred package action projection in `src/botster/realHubDogfoodTransport.ts`. Package rows must render action descriptors and disabled/blocked reasons from hub-provided action state, not from package `state`, entrypoint `process.state`, local capability guesses, or hard-coded unsupported actions.
- Render both available marketplace packages and installed packages in the Apps/Marketplace view path. Use existing entity-frame/UI-node binding patterns and bounded Ionic/React components already present in this app.
- Surface feature availability matrices and blocked reasons from hub DTOs for local Project Pipelines features and GitHub provider features.
- Keep configuration schema rendering and `set_package_configuration` round trips, but add validation-result rendering from hub responses so failed config saves update row/form diagnostics from the daemon payload.
- Refresh package/marketplace entity frames after lifecycle/configuration actions by consuming the hub response and/or issuing the existing package list request, so the UI reflects daemon-owned post-mutation state.
- Update `README.md` and `docs/architecture.md` only where needed to document that botster-web renders hub-provided marketplace/lifecycle/action-state DTOs and does not infer dependency/auth/update semantics.

## Non-Scope

- No hub/core/Rust implementation in this repo. If the generated hub-client protocol does not expose the required DTOs, stop and ask a human rather than filling the gap in botster-web.
- No browser-only dependency resolver, auth-state checker, update detector, lifecycle state machine, or package compatibility policy.
- No TUI parity work in this ticket. This is scoped to botster-web's Apps/Marketplace browser path; TUI rendering should consume the same hub-owned DTOs in a separate ticket if needed.
- No speculative new state library, broad app-shell redesign, terminal/Restty changes, or unrelated connection diagnostics cleanup.
- No raw local paths, tokens, secrets, or PII in fixtures, docs, rendered rows, or gate evidence.
- No handwritten DTO compatibility shim for old hub shapes unless the generated protocol itself marks fields optional.

## Assumptions And Unknowns

- Assumption to verify before implementation: the authoritative hub-client generated protocol, not merely the closed dependency tickets, includes lifecycle action state, dependency/feature availability matrices, marketplace availability, update/config/auth blocking reasons, and config validation response fields.
- Assumption: botster-web should continue using `botster-web.package` or a closely adjacent entity family for installed packages, with a new family only if the generated DTO clearly separates marketplace availability from installed registry rows.
- Assumption: "Apps/Marketplace views" maps to the current Apps route and real-hub package sections in `src/App.tsx` plus `realHubDogfoodUiTreeSnapshot`; do not create a new route unless the existing route cannot express both available and installed sections.
- Unknown and blocking until proven: whether any available/marketplace catalog request or DTO exists. The current vendored protocol only exposes `list_packages` for installed/registered rows, so rendering installed rows as "available" would violate the ticket.
- Unknown: exact generated field names for hub-provided actions, feature matrices, blocked reasons, dependency gates, auth gates, config validation, and update state. The implementer must inspect the generated hub artifact first.
- Unknown: whether install action state is returned as a package-level action in marketplace rows, as a lifecycle action collection, or as a separate response. The UI should mirror the generated shape instead of normalizing into invented semantics.
- Unknown: whether update/reload/hub-restart are still valid package actions. Render only actions present in the hub DTO; absence is not an error and must not be replaced with browser-made disabled buttons.
- Convention conflicts: none. The plan follows Botster SPA/entity-frame conventions and the generated DTO boundary.

## Affected Surfaces And Files

- Botster layers touched: React/Ionic SPA, browser real-hub bridge adapter, generated hub-client protocol mirror, generated protocol fixtures, package/marketplace UI, package action handling, fast Node tests, docs.
- DTO boundary and verification: `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts` only as the export/envelope wrapper, and `scripts/check-daemon-protocol-drift.mjs`. The drift check must be hardened or invoked in a way that treats a missing source artifact/skipped comparison as a failed verification.
- Generated fixtures: `src/botster/__fixtures__/generatedDaemonProtocol.ts`.
- Real-hub adapter and UI-node snapshot: `src/botster/realHubDogfoodTransport.ts`.
- Production Apps/Marketplace route: `src/App.tsx`; only touch renderer helpers if existing package cards/lists cannot render the hub-provided fields cleanly.
- Tests: `src/App.test.mjs`.
- Docs and plan artifacts: `README.md`, `docs/architecture.md`, this plan.

## Implementation Outline

1. Obtain the authoritative `botster-hub-client` generated daemon protocol artifact and make the drift check non-skipping for this ticket. Acceptable evidence is a real comparison against an explicit `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` path or a code change/test that makes `scripts/check-daemon-protocol-drift.mjs` fail when the source artifact is absent. A warning plus exit 0 is not acceptable evidence.
2. Perform a DTO-presence audit before UI implementation. Record the generated request/response/type names for installed package rows, available marketplace rows, action state, feature availability, dependency/config/auth blocked reasons, update state, and config validation diagnostics.
3. If any required DTO group is absent in the authoritative generated artifact, stop implementation as dependency-not-landed and raise a human routing question with the exact missing generated fields. Do not proceed to browser projection, fixture invention, or installed-row fallback.
4. Only after the DTO audit passes, copy/regenerate the protocol into `src/botster/generated/daemon-protocol.ts`.
5. Refactor package projection in `realHubDogfoodTransport.ts` so display rows are pass-through projections of daemon-owned state. Accept label/disabled/reason/action ids from the DTO; browser code may format summaries but may not decide whether install/enable/disable/remove/start/stop/restart/update is allowed.
6. Replace `unsupportedPackageAction()` and hard-coded action availability with a generic action-state mapper that emits only hub-provided actions and their blocked/disabled reasons.
7. Add marketplace/available package entity frames only when the generated DTO provides a distinct available/marketplace catalog surface. Render available and installed sections in the existing Apps/Marketplace path with compact rows, actions, feature matrix, and blocked reason text.
8. Keep `set_package_configuration` payload construction scrubbed: submit user-entered form values only, omit redacted/write-only secrets unless replaced, and render validation results returned by the daemon after save.
9. After package lifecycle/configuration actions, apply returned daemon package state or re-pull package rows so entity frames and rendered actions update from the live daemon owner.
10. Extend generated fixtures and tests around Project Pipelines plus GitHub provider: Project Pipelines local features available; GitHub provider features blocked until dependency/config/auth gates are satisfied; no secrets/PII; no browser-only inferred action state.
11. Update docs only for the changed operator-visible path and generated DTO boundary.

## Risks

- DTO drift risk: this ticket is specifically about generated lifecycle/dependency DTOs, so hand-editing TypeScript types or fixtures would produce false confidence. Mitigation: use generated protocol artifact and drift check.
- Dependency-not-landed risk: the closed dependency tickets may not have produced consumable hub-client DTOs in the artifact botster-web can regenerate from. The current vendored mirror does not expose marketplace availability, action state, feature matrices, dependency/auth/update gates, or config-validation response fields. Mitigation: make DTO-presence audit a hard go/no-go gate and ask a human if missing.
- Marketplace fallback risk: the current `list_packages` request returns installed/registered rows only. Mitigation: require a real generated available/marketplace catalog request or DTO before rendering an "available packages" section.
- Inference regression risk: existing code creates enable/disable/remove/start/stop/restart actions and disabled update/reload/hub-restart actions locally. Mitigation: delete that inference path and test absence of browser-created action decisions.
- Unwired UI risk: tests could exercise projection helpers while the Apps view still renders old fields. Mitigation: test through `createBotsterWebClient()`, entity pulls, `UiNodeSurface`/Ionic rendering, and `App.tsx` package route helpers.
- Fixture realism risk: generated fixtures can still be narrowed too much. Mitigation: fixtures must include available and installed package rows, available and blocked features, dependency/config/auth blocked reasons, update state, lifecycle actions, and config validation results.
- Post-action stale state risk: lifecycle/config saves could return success while UI keeps old action gates. Mitigation: require response-driven entity update or package re-pull after each mutation.
- PII/secret risk: config/auth fixtures can accidentally include tokens or local paths. Mitigation: use `.invalid` hosts, synthetic ids, redacted secret sentinels, and explicit tests that serialized requests/markup omit secrets and home paths.
- Compatibility risk: older hubs may omit new optional fields. Mitigation: optionality must come from generated serde optional fields; absent fields render as absent/empty state, not inferred blocked state.

## Acceptance Checks And Tests

- `npm test` must prove:
  - generated protocol fixtures are used for package lifecycle/dependency scenarios;
  - Project Pipelines package row renders local features as available from hub DTO state;
  - GitHub provider row renders features blocked by dependency/config/auth gates with hub-provided blocked reasons;
  - install/enable/disable/remove/start/stop/restart/update/config actions render only from hub-provided action state, including disabled/blocked reasons;
  - config save sends scrubbed form values only and renders hub-returned validation diagnostics;
  - rendered markup and serialized requests contain no raw secrets, write-only secret payloads, home paths, or PII;
  - no browser-created `unsupportedPackageAction`, dependency resolver, auth checker, update detector, or lifecycle inference path remains.
- `node scripts/check-daemon-protocol-drift.mjs` with `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` set to the authoritative hub-client generated artifact, with evidence that the comparison actually ran. A missing artifact, warning-only skip, or exit 0 without comparison fails acceptance.
- DTO-presence audit evidence listing the generated request/response/type names for marketplace/available catalog, package action state, feature matrices, dependency/config/auth blocked reasons, update state, and config validation. If any are absent, acceptance changes to dependency-not-landed with a human routing question, not partial implementation.
- `npm run build`.
- `npm run smoke:packaged-browser` for packaged browser smoke.
- `npm run smoke:live-packaged-protocol` when compatible `BOTSTER_HUB_BIN` and session worker binaries are available; if unavailable, record exact missing-binary evidence rather than treating the smoke as passed.
- Manual user-path proof if live hub is available: open `/?dogfood=real-hub`, visit Apps/Marketplace, verify available and installed package sections, click one enabled lifecycle action and one blocked action, save invalid config, and confirm the displayed state/validation comes back from hub responses.

## Pipeline Gates And Artifacts

- Plan gate should attach this plan, checklist id `checklist_1782349006_366720`, the Plan Review findings it resolves, and the explicit hard go/no-go rule that missing generated DTO fields require dependency-not-landed escalation plus a human question before implementation proceeds.
- Plan Review should reject the plan if it permits botster-web to infer dependencies, auth state, update availability, lifecycle legality, or action availability.
- Implement gate should first require DTO-presence audit evidence and a non-skipped generated protocol drift comparison. If those pass, require committed code, generated fixture provenance, production-entrypoint explanation, and test outputs.
- Review/Verify should inspect the diff for handwritten DTO drift, browser-only lifecycle policy, PII, unwired UI, and tests that only scan source instead of exercising the runtime path.

## Vault Gaps Worth Capturing

- Capture the exact generated marketplace/package lifecycle DTO vocabulary after implementation if the hub artifact introduces durable names for action state, blocked reasons, or feature matrices that are not already in the vault.
- Capture a botster-web-specific convention if the implementation establishes a reusable action-state projection shape for hub-owned package actions.
- No durable knowledge was captured during planning because the current reusable rules already exist in the loaded notes; the unknowns are concrete generated DTO field names.
