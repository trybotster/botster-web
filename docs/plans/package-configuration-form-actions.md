# Fix package configuration form actions

## Context loaded

- Pipeline context: ticket `ticket_1782795779_951297`, run `run_1782795791_997993`, active step `botster_plan`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, answers, or dependencies were present in `project_pipelines_current_context`.
- Ticket intent: make configuring an installed app/package work from the web UI by rendering the hub-provided package configuration schema, preserving form draft values, submitting through the real hub package configuration action, showing hub validation errors, and refreshing persisted config state after success.
- Vault context loaded: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], and [[plan steps need reviewable plan artifacts]].
- Repo context inspected: `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `botster-package.json`, and existing `docs/plans/wire-botster-web-dev-stack-package-app-settings-surfaces.md`.
- Current baseline: generated hub DTOs already include `set_package_configuration`; `realHubDogfoodTransport.ts` already projects `configuration_fields`, exposes `configuration_submit`, dispatches `botster.package.configuration.save`, emits response frames, and refreshes package entities when a packages response comes back. The visible UI path in `src/App.tsx` still renders configuration as metadata rows, not editable form controls with draft preservation and submit/error behavior.
- Botster layers touched: React/Ionic SPA, browser real-hub adapter only if a narrow request/response gap is found, packaged browser smoke, live packaged harness, and tests. No Rust hub or core change is planned unless the authoritative hub DTO lacks the required read/write behavior.
- Worktree/target assumption: implementation remains in this pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`; artifacts use repo-relative paths and wiki-link vault citations.

## Scope

- Replace the settings modal's package configuration metadata-only rows with an actual editable form driven by projected hub `configuration_fields`.
- Support field kinds already projected by the hub DTO path: text input, textarea, checkbox, select, and secret/redacted values.
- Preserve in-modal draft state while the package settings modal stays open, including edits that differ from the last hub-provided `effective_values`.
- Submit configuration through the existing hub-backed action path: `configuration_submit` -> `botster.package.configuration.save` -> `set_package_configuration` with submitted values.
- Show hub-returned validation feedback visibly in the settings modal after a failed save, using projected field errors, package diagnostics, operator errors, or action result reason depending on the authoritative response shape.
- Refresh persisted configuration state after success by pulling or otherwise updating the `botster-web.package` entity family from the real hub response, then reset the draft baseline to the returned effective values.
- Extend deterministic and live acceptance so they prove the actual user path: compiled web UI opens package settings, edits a real schema field, saves successfully through the bridge/hub action, sees visible persisted values, then submits invalid values and sees the hub validation error round trip.

## Non-scope

- No broad settings redesign, dashboard redesign, app launcher redesign, or Project Pipelines operator workbench changes.
- No hand-maintained DTO guesses. If `src/botster/generated/daemon-protocol.ts` is stale, refresh/check it from the authoritative `botster-hub-client` generated artifact instead of editing protocol fields manually.
- No browser-only configuration API, local fixture-only proof, inferred package names, hard-coded first-party package behavior, or synthetic validation shape as the production contract.
- No Rust hub/core implementation unless the authoritative hub lacks the needed config read/write request. If that happens, create/register a hub dependency instead of bypassing policy in botster-web.
- No new dependencies or state-management library; use existing React state/action dispatch patterns.
- No PII, local usernames, socket paths, data dirs, or real user package values in committed fixtures, logs, or docs.

## Assumptions and unknowns

- Assumption: `DaemonRequest` with `type: "set_package_configuration"` and `DaemonPackage.configuration` are authoritative enough for this ticket because they are generated from `botster-hub-client` and already present in this repo.
- Assumption: form draft state can live in `PluginSettingsPanel` or adjacent React component state keyed by package id and field id; it does not need durable storage.
- Assumption: successful saves should refresh package state via the existing `list_packages`/package entity path rather than manually patching form fields from submitted values.
- Assumption: secret fields with redacted values should preserve the "leave blank to keep existing secret" behavior and avoid echoing secret material into UI or test logs.
- Unknown: exact hub validation failure shape in the live dev-stack package. It may return field-level diagnostics through `DaemonPackageConfiguration.diagnostics`, `missing_required`, top-level diagnostics, a package decision, or an operator error. The implementation should render the authoritative shape returned by hub rather than inventing a separate form API.
- Unknown: whether the local pipeline environment has compatible `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` for live acceptance. If unavailable, implementation must record exact blocker evidence and still provide deterministic browser/transport tests.
- Convention conflicts: none found. The plan follows generated DTO authority, Botster SPA/entity-frame contracts, descriptor-driven actions, plugin-owned policy boundaries, path-neutral plan artifacts, and real-runtime acceptance requirements.

## Affected surfaces/files

- `src/App.tsx`: package settings modal, `PluginSettingsPanel`, configuration field rendering, draft state, save button, submit status, validation display, and post-save refresh hook.
- `src/botster/realHubDogfoodTransport.ts`: only if needed to include submitted values in action payloads or to surface hub validation diagnostics more faithfully from existing daemon responses. Keep the authoritative request shape.
- `src/App.test.mjs`: add user-path tests or executable assertions that cover editable form rendering, draft preservation, save dispatch payload, success refresh, and validation error display.
- `scripts/packaged-browser-smoke.mjs`: deterministic packaged browser proof for successful save and invalid save through the same UI controls users click.
- `scripts/live-packaged-protocol-harness.mjs`: real local hub proof with a dev-stack package that has a configuration schema; assert both success and validation-error round trips and visible UI changes.
- `scripts/real-hub-dogfood-bridge.mjs`: only if the package runtime bridge needs a narrow deterministic package fixture mirror for the packaged smoke. It must remain a harness mirror, not the production contract.
- `README.md` or `docs/architecture.md`: update only if the verified command or runtime behavior changes.

## Risks

- Unwired form risk: tests could prove helper functions but not the modal path. Acceptance must open the settings UI and dispatch through the production action dispatcher.
- DTO drift risk: generated TypeScript may be behind the hub crate. Run the protocol drift check with an explicit authoritative artifact when available.
- Validation-shape risk: hub errors may not be field-specific. The UI should display field errors when present and fall back to visible package/action diagnostics when hub returns broader diagnostics.
- Draft overwrite risk: entity refreshes can clobber in-progress edits while the modal is open. Draft state should initialize from hub values and reset after successful save, but avoid replacing dirty user edits during ordinary rerenders.
- Secret handling risk: redacted secret placeholders must not become submitted values and real secret values must not be logged or committed.
- Live smoke fragility risk: the package with configuration schema and invalid-value behavior must come from the real dev-stack hub path, not only the fake bridge.
- PII risk: live harness events may include paths or local values; committed assertions should use scrubbed package names and values.

## Acceptance checks/tests

- `npm test`
  - Proves generated DTO coverage still includes `set_package_configuration`.
  - Proves the settings modal renders real form controls from package `configuration_fields`.
  - Proves draft edits are preserved until save/cancel/modal close semantics chosen by implementation.
  - Proves save dispatch includes the edited values in the hub-backed `botster.package.configuration.save` action.
  - Proves successful hub response refreshes visible package configuration state.
  - Proves hub validation errors are visible in the web UI.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run smoke:packaged-browser`
  - Must click through the compiled package UI, open package settings, perform one successful config save, perform one invalid save, and assert the visible UI changes for both.
- Real hub acceptance with a local dev-stack package that has a configuration schema:
  - Run `BOTSTER_HUB_BIN=/path/to/botster-hub BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker npm run smoke:live-packaged-protocol`, or the existing-hub equivalent with `BOTSTER_HUB_SOCKET`/`BOTSTER_HUB_DATA_DIR`.
  - Must prove real local hub DTO requests include `list_packages` and `set_package_configuration`.
  - Must prove a successful save persists and is visible after state refresh.
  - Must prove an invalid value produces a hub validation error visible in the UI.
  - Must fail if it can only pass through local-only fixtures.
- Optional protocol drift check when the authoritative artifact is available:
  - `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=/path/to/generated/daemon-protocol.ts npm test`

## Pipeline gates and artifacts

- Plan artifact: `docs/plans/package-configuration-form-actions.md`.
- Plan gate evidence should include the context loaded above, scope/non-scope, assumptions/unknowns, affected files, risks, acceptance checks, and vault gaps.
- Implement gate should include command evidence for the test/build/smoke commands actually run, exact skipped live-hub reason if blocked, and proof that changed code is wired into the runtime entry point.
- Review/verify should reject source-only evidence if there is no user-path proof for both successful save and validation error round trip.

## Vault gaps worth capturing

- Capture a Botster-web note if implementation discovers the stable live hub validation DTO shape for package configuration errors.
- Capture a Botster-web note if a durable pattern emerges for preserving React form drafts across entity-frame refreshes in the first-party web shell.
- Capture a harness note if live package configuration acceptance needs a standard dev-stack package fixture or binary discovery convention.
- No new note is needed for checklist timeout fallback; [[project pipelines checklist worker timeouts require artifact evidence fallback]] already covers that operational response.
