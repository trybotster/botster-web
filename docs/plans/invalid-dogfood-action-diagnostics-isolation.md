# botster-web invalid dogfood action diagnostics isolation plan

## Context loaded

- Pipeline context: `ticket_1781136512_937356`, `run_1781148767_789026`, returned step `botster_plan`, gate `botster_plan_gate`; Plan Review returned three open findings requiring a tighter allowlist for `Hub operator error`, explicit primary-vs-diagnostic status state, and coverage of all action-diagnostic producers.
- Required planner notes: [[planner-playbook]] and [[botster-planner-playbook]].
- Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Artifact/checklist notes: [[plan steps need reviewable plan artifacts]] and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `README.md`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodFirstScreen.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/connectionDiagnostics.ts`, `src/botster/ConnectionDiagnosticsPanel.tsx`, `scripts/packaged-browser-smoke.mjs`, and prior plans under `docs/plans/`.
- Project Pipelines checklist: `project_pipelines_checklist_instructions` was loaded. `project_pipelines_create_vault_checklist` timed out with `plugin worker invoke timeout`; per [[project pipelines checklist worker timeouts require artifact evidence fallback]], checklist-style evidence is preserved in this plan and the Plan gate evidence instead of retrying the worker.

## Scope

- Keep this change inside `botster-web`; do not edit hub/core/TUI or daemon protocol implementations.
- Identify the existing invalid diagnostic action in the packaged real-hub dogfood surface:
  - `src/botster/realHubDogfoodTransport.ts` currently exposes a form submit action `botster.session.rename` targeting `missing-real-hub-session` with the label `Trigger invalid action`.
  - `src/App.tsx` records all failed actions and hub operator errors as diagnostics.
  - `src/botster/dogfoodFirstScreen.tsx` currently treats any action diagnostic, including the diagnostic action, as the primary `Spawn action` card state.
- Isolate primary spawn state from diagnostic/debug action state:
  - primary spawn status must be driven by an allowlist of spawn-correlated evidence only: `botster.session.select` for `botster-web-dogfood-session`, daemon/operator diagnostics whose operation is `spawn`, and the session entity state;
  - uncorrelated action-source diagnostics must default to non-primary: visible in diagnostics, never used to block the `Spawn action` card;
  - this non-primary default includes danger-severity `Hub operator error` rows from diagnostic/debug actions such as `botster.session.rename` against `missing-real-hub-session`;
  - invalid/debug failures should remain visible in `ConnectionDiagnosticsPanel` and, if useful, a separate first-screen diagnostic/test summary;
  - invalid/debug failures must not make the first-screen primary action card or status-grid `Spawn action` card look blocked.
- Split primary spawn status from diagnostic/debug action status:
  - keep `dogfood.action_status` reserved for primary spawn flow copy;
  - introduce a separate diagnostic/debug local-state key, for example `dogfood.diagnostic_action_status`, for the invalid action result;
  - update the real-hub UI-tree binding around `real-hub-action-status` only if needed so primary spawn copy and diagnostic action copy render in their own regions.
- Relabel or move the invalid action in the dogfood UI tree so it is clearly a diagnostic/debug control, not a main spawn flow.
- Add focused client harness tests for primary spawn success/failure and invalid diagnostic failure isolation.
- Extend packaged browser smoke if practical so the fake daemon can click the invalid diagnostic action and prove the workbench still reads as understandable.

## Non-scope

- No new Botster daemon request types, hub diagnostic taxonomy, or core protocol changes.
- No broad redesign of the dogfood workbench, no replacement of Ionic React, and no new frontend state library.
- No package registry/session data model changes beyond what is necessary to separate primary and diagnostic action presentation.
- No cleanup of unrelated string-assertion tests or prior dogfood plans.

## Assumptions and unknowns

- Assumption: primary spawn is the action binding `id: "botster.session.select"` with `target: realHubDogfoodSessionId`.
- Assumption: the deliberately failing diagnostic path is the action binding `id: "botster.session.rename"` with `target: "missing-real-hub-session"`.
- Assumption: hub-shaped spawn failures with `operation: "spawn"` should still affect the primary spawn summary; the isolation applies to diagnostic/test actions, not real primary spawn failure.
- Assumption: adding minimal action identity/classification to client-side diagnostics is acceptable when it is derived from the local action binding or daemon operation, not invented hub protocol.
- Assumption: diagnostics without spawn correlation are safer for the primary card when treated as non-primary, because they remain visible in `ConnectionDiagnosticsPanel` while avoiding false `Spawn action` blocked state.
- Assumption: `operatorErrorDiagnostic` should preserve or expose daemon operation metadata when present so `operation: "spawn"` can still block the primary spawn card and non-spawn operations cannot.
- Unknown: exact operation value returned by the missing-session diagnostic action (`rename`, `shutdown`, or another daemon operation). The implementation must not depend on a single non-spawn operation string; any action-source diagnostic that is not positively spawn-correlated must stay non-primary.
- Unknown: whether the packaged smoke can click the invalid action without making the current fake daemon substantially more complex. If browser smoke is not practical, implementation must record why and rely on `npm test` coverage for the invalid diagnostic path.

## Affected surfaces/files

- `src/botster/dogfoodFirstScreen.tsx`: primary surface where action diagnostics currently poison the `Spawn action` summary. Replace broad `source === "action"` selection with spawn-correlated evidence only. Unknown or non-spawn action diagnostics fail open for the primary card and remain visible in diagnostics.
- `src/botster/connectionDiagnostics.ts`: add the smallest metadata needed for allowlisting across all three action-diagnostic producers:
  - `actionFailureDiagnostic` should expose action id/target or a primary/diagnostic category derived from the action binding;
  - `operatorErrorDiagnostic` should preserve daemon `operation` when present;
  - `hubConnectionDiagnosticFromFrame` for `kind: "action_failure"` should preserve daemon `operation`.
- `src/App.tsx`: production action dispatch entry point. Split primary spawn local-state writes from diagnostic/debug action local-state writes so diagnostic failure never overwrites `dogfood.action_status`.
- `src/botster/realHubDogfoodTransport.ts`: relabel/move the invalid action from generic `Error state` / `Trigger invalid action` wording to an explicit diagnostics/debug section such as `Diagnostic action failure` / `Run missing-session diagnostic`, and bind any diagnostic status text to the separate diagnostic local-state key.
- `src/App.test.mjs`: add assertions that diagnostic action failure does not mark primary spawn blocked or replace primary spawn copy, while real spawn failure still does.
- `scripts/packaged-browser-smoke.mjs`: preferred optional smoke path to click the invalid diagnostic action after initial page load and assert the primary spawn heading/card remains primary and runnable.
- `README.md`: update only if visible action labels or manual dogfood instructions change.

## Botster layers touched

- React SPA / Ionic shell only.
- Browser dogfood transport fixture/adapter only.
- Browser/package smoke harness if practical.
- No Rust hub, Lua core, TUI, Rails relay, MCP, or Project Pipelines plugin changes.

## Worktree and target assumptions

- This run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and workspace `botster-web isolate invalid dogfood diagnostics`.
- Implementer should work only in this ticket worktree and should not edit ambient Botster core/hub/TUI checkouts.

## Risks

- Over-filtering risk: a real primary spawn failure could be hidden if diagnostics are filtered only by title/source. Mitigation: classify by positive spawn correlation, including daemon operation `spawn`, and keep spawn failures visible on the primary card.
- Under-filtering risk: `Hub operator error` rows from the invalid action currently have `source: "action"`, danger severity, and no action id. Mitigation: make the `Spawn action` card use a spawn-correlated allowlist, so uncorrelated/non-spawn action diagnostics cannot win by severity.
- Producer-coverage risk: action diagnostics come from `actionFailureDiagnostic`, `operatorErrorDiagnostic`, and `hubConnectionDiagnosticFromFrame` `action_failure` rows. Mitigation: the metadata/allowlist plan must cover all three producers; unknown/uncorrelated rows default to diagnostic-only.
- State-shape risk: keeping a single `dogfood.action_status` lets diagnostic action results overwrite the primary-card copy even after card allowlisting. Mitigation: split primary spawn status from diagnostic/debug status with a separate local-state key.
- UI ambiguity risk: keeping `Trigger invalid action` in the main flow can still confuse users even if the primary status stays healthy. Mitigation: relabel or move it into an explicit diagnostics/debug section.
- Test false-positive risk: source-text assertions can prove strings exist without proving runtime behavior. Mitigation: use existing SSR/runtime helpers in `src/App.test.mjs` to render `DogfoodFirstScreen` and diagnostics with primary and diagnostic failure inputs.
- Smoke fragility risk: packaged browser smoke may become slower if it adds another scenario. Keep the smoke path narrow and reuse the existing fake daemon.

## Acceptance checks/tests

- `npm test`
  - proves a real primary spawn failure still marks `Spawn action` blocked and shows the spawn failure detail;
  - proves a failed diagnostic action for `botster.session.rename` / `missing-real-hub-session` remains visible in diagnostics but does not mark `Spawn action` blocked;
  - proves a non-spawn `Hub operator error` diagnostic for the missing-session diagnostic path does not mark `Spawn action` blocked and does not replace primary spawn copy;
  - proves a spawn-operation `Hub operator error` still marks `Spawn action` blocked, preserving real primary spawn failure behavior;
  - proves `hubConnectionDiagnosticFromFrame` `action_failure` rows block primary spawn only when operation is `spawn`;
  - proves diagnostic failure does not replace the primary card copy or primary `Spawn botster-web-dogfood-session` affordance;
  - proves diagnostic/debug status renders from the new diagnostic local-state key or equivalent separate state shape;
  - proves the invalid action label/section communicates diagnostic/debug intent;
  - preserves existing guards that terminal bytes stay out of `HubControlFrame` and that real-hub DTO field names match the current contract.
- `npm run build`
- Preferred if practical: `npm run smoke:packaged-browser` after extending the fake daemon flow to click the invalid diagnostic action and then assert:
  - primary spawn heading/action remains `Spawn botster-web-dogfood-session`;
  - the spawn summary is `Ready` or otherwise not `Blocked` before the real spawn action is clicked;
  - the diagnostic failure is visible as diagnostic/debug context.
- If packaged smoke is skipped, record the reason and do not present unit/SSR coverage as browser smoke evidence.
- PII scan before handoff: plan, README, tests, and smoke output should not include local absolute paths or user-identifying runtime details.

## Pipeline gates and artifacts

- Plan artifact: this file.
- Gate evidence should include the loaded context, checklist timeout fallback, assumptions above, and the production entry point path through `src/App.tsx` action dispatch into `DogfoodFirstScreen`.
- Implementation gate should include command results for `npm test` and `npm run build`, plus packaged smoke evidence or a precise skip reason.

## Vault gaps worth capturing

- Capture a new note if implementation establishes a reusable browser-side convention for classifying action diagnostics by primary workflow vs diagnostic/debug workflow.
- Capture a new note if packaged browser smoke gains a reusable pattern for intentional negative diagnostic controls.
- No vault capture is required from planning alone; existing notes cover the Botster SPA, dogfood bridge, diagnostics, plan artifact, and checklist-timeout boundaries.
