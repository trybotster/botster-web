# botster-web package registry display plan

## Context Loaded

- Pipeline context: ticket `ticket_1781054950_489327`, run `run_1781061910_177844`, step `botster_plan`, gate `botster_plan_gate`; no prior findings, artifacts, questions, or answers. Dependency `ticket_1781054950_975598` is closed.
- Vault/playbook context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], plus identity/goals context.
- Constraining notes from the loaded context: [[botster package registry persists through hub state json]], [[botster package records persist trust compatibility and admitted capability lock metadata]], [[serve daemon package reads must refresh registry after mutations]], [[botster hub diagnostics use daemon diagnostic rows in client dtos]], [[botster web dto field names must match authoritative rust serde structs]], [[botster-web ionic supersedes catalyst for client shell]], [[botster hub client state sync is entity frame only]], and [[botster web request caches belong in react query not zustand or hub session getters]].
- Repo context inspected: `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.tsx`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/connectionDiagnostics.ts`, `src/App.test.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `README.md`, `docs/architecture.md`, and prior plans under `docs/plans/`.
- Checklist evidence fallback: `project_pipelines_create_vault_checklist` timed out in the Project Pipelines plugin worker. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], vault notes read, convention conflicts, verification plan, and capture decision are recorded here and should also be attached to the gate evidence.

## Scope

- Add the current hub package registry/status DTO subset to `src/botster/realHubDaemonDto.ts` only after checking the authoritative `botster-hub-client` serde JSON shape. Field names must match Rust serde names.
- Extend `src/botster/realHubDogfoodTransport.ts` so real-hub daemon responses that include installed package registry records become a new entity family, likely `botster-web.package`, emitted from the existing `DaemonResponse` normalization path.
- Render package registry state in the existing real-hub dogfood surface by adding a package list/table region to `realHubDogfoodUiTreeSnapshot`. Rows should show installed package identity, enabled/disabled/error state, and capability/compatibility diagnostics exposed by the hub DTO.
- Keep daemon diagnostic rows flowing through the existing connection diagnostics path, but add package-row rendering for package-specific diagnostics rather than turning all package diagnostics into global connection rows.
- Pull the package entity family from the production app path in `src/App.tsx` alongside existing hub status/session/draft pulls so the UI proves the runtime path changed.
- Update `README.md` real-hub dogfood instructions, and `docs/architecture.md` if the entity family or DTO boundary needs an architecture note.
- Add focused tests in `src/App.test.mjs` that drive hub-shaped package DTOs through `createRealHubDogfoodTransport()` / `createBotsterWebClient()` and render the real `UiNodeSurface`/Ionic renderer output.

## Non-Scope

- No hub/core/TUI/Rust implementation changes in this repo.
- No install, enable, disable, remove, trust, or other mutation actions unless the current hub DTO contract already exposes stable actions and the ticket explicitly permits them. Default stance for this slice is read-only.
- No private web-only package operations, protocol fields, or synthetic capability taxonomy.
- No new state-management library, request cache layer, or broad renderer refactor.
- No dependency upgrades or package installs unless an existing dependency is genuinely insufficient; none appear necessary from planning.
- No changes to terminal streaming, Restty ownership, or existing connection diagnostics behavior except where tests need to prove no regression.

## Assumptions And Unknowns

- Assumption: the closed dependency ticket means the running hub now returns package registry/list/status data through `botster-hub-client` daemon DTOs, but this botster-web repo does not currently contain the authoritative package record shape.
- Assumption: package records are read-oriented status/list payloads with installed/enabled/error fields plus compatibility/capability diagnostics, consistent with the vault notes about `PackageRecord`.
- Unknown: the exact serialized field names and nesting for package records, compatibility results, admitted capability locks, trust/provenance, and diagnostics. The implementer must inspect the current authoritative Rust serde structs or a live daemon response before editing TypeScript DTOs. If no package records are reachable from the current daemon API, ask a human rather than fabricating a web-only shape.
- Unknown: whether package registry records arrive on `DaemonStatus`, top-level `DaemonResponse.packages`, a specific request type, or both. Plan for additive support of the real shape only.
- Assumption: real-hub mode remains opt-in via `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub`; fixture mode can remain deterministic and does not need package registry parity unless tests require a stable empty state.
- Worktree/target assumption: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869`, workspace `botster-web package registry display`, and branch `project-pipelines/ticket_1781054950_489327`.
- Convention conflicts: none. The plan follows the Botster SPA/entity-frame path and avoids protocol invention.

## Affected Surfaces And Files

- Botster layers touched: React/Ionic SPA, browser real-hub bridge adapter, same-device dogfood bridge docs, tests.
- DTO boundary: `src/botster/realHubDaemonDto.ts`.
- Real-hub adapter and UI snapshot: `src/botster/realHubDogfoodTransport.ts`.
- Production runtime pull path: `src/App.tsx`.
- Renderer only if current primitives cannot display diagnostics clearly: `src/botster/IonicUiNodeRenderer.tsx`. Prefer existing `list`, `row`, `badge`, `text`, or `table` primitives first.
- Optional diagnostic helper touchpoint: `src/botster/connectionDiagnostics.ts` only if hub package diagnostics need a narrowly mapped global connection row. Prefer row-local package diagnostics.
- Tests: `src/App.test.mjs`.
- Docs: `README.md`; possibly `docs/architecture.md`.
- Plan artifact: `docs/plans/package-registry-display.md`.

## Implementation Outline

1. Audit the authoritative hub-client package DTO shape. Record whether package records are emitted by status, a list request, or another existing daemon request. If the shape is absent, stop and ask a human question.
2. Add structural TypeScript DTO types matching the audited serde field names. Keep optional fields optional when older hubs omit them.
3. Add a `packageFamily` entity family in `realHubDogfoodTransport.ts`. Map each daemon package record to a stable row id and display fields for name/id, installed/enabled/error state, compatibility summary, capability summary, and diagnostics summary.
4. Update `daemonResponseFrames()` so package records in the real daemon response produce `entity_snapshot` frames. Keep status counts in the existing hub status record.
5. Update `realHubDogfoodUiTreeSnapshot` with a bounded package section/list/table under the real-hub surface. Include an empty state when the hub returns no packages.
6. Update `App.tsx` to pull the package family after the dogfood surface subscribes, proving the production user path requests the new family.
7. Update tests with a mocked real bridge status/list response containing at least enabled, disabled, and error/diagnostic package records. Assert entity rows and rendered markup, not just source text.
8. Update real-hub docs to tell operators where package state appears and how diagnostics are shown.

## Risks

- Private protocol risk: adding TypeScript fields from guesses would violate [[botster web dto field names must match authoritative rust serde structs]]. Mitigation: audit current hub-client serde or live response first.
- Hidden API absence: the dependency is closed, but this repo has no package DTO evidence beyond counts and bridge error placeholders. Mitigation: ask a human if no stable package records are reachable.
- Unwired implementation risk: mapping package rows without `App.tsx` pulling the package family would leave tests passing through direct functions but not the user path. Mitigation: test through `createBotsterWebClient()` and rendered `UiNodeSurface`.
- Diagnostic co-fire risk: package diagnostics could duplicate global connection diagnostics. Mitigation: use package row-local text/badges for package-specific diagnostics; keep daemon-level diagnostics in `ConnectionDiagnosticsPanel`.
- UI density risk: package diagnostics can be verbose. Mitigation: render compact summaries in rows and only include fields the hub DTO actually provides.
- Stale hub compatibility risk: older hubs may omit package fields. Mitigation: optional DTO fields plus empty state, no inferred errors for absent package registry data unless daemon diagnostics explicitly report it.
- PII/path risk: package paths/provenance might include local paths. Mitigation: do not render raw local install paths unless the hub DTO has an explicit scrubbed display field; tests should scan fixtures/docs for home paths.

## Acceptance Checks And Tests

- `npm test` covers:
  - package DTOs from a mocked real-hub bridge become `botster-web.package` entity rows;
  - enabled, disabled, and error package states render in the real UiNode/Ionic output;
  - package capability/compatibility diagnostics render from hub-shaped DTO fields;
  - no private web-only install/enable/remove action appears;
  - real-hub mode still renders status/session rows and connection diagnostics from existing DTOs.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- Manual/documented user-path check when a compatible hub binary is available:
  - run `npm run dogfood:hub` with `BOTSTER_HUB_BIN` and worker env;
  - run `VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev`;
  - open `http://127.0.0.1:5173/?dogfood=real-hub`;
  - verify the package registry section shows installed/enabled/disabled/error rows and diagnostics from the local daemon, while terminal and connection diagnostics still work.

## Pipeline Gates And Artifacts

- Gate evidence should attach this plan plus the checklist fallback evidence because checklist creation timed out.
- Plan Review should verify the package DTO audit requirement is explicit enough and that no implementation step asks botster-web to invent hub operations.
- Implement gate should require a committed diff and test output from the commands above.
- Review/Verify should reject source-only tests; at least one test must exercise the production runtime path from bridge response to rendered UI.

## Vault Gaps Worth Capturing

- Capture the exact package registry daemon DTO shape once implementation audits it, if not already covered by existing package-registry notes.
- Capture a botster-web-specific note if package diagnostics need a reusable row-local rendering taxonomy distinct from global daemon diagnostics.
- No durable knowledge was captured during planning because the new durable fact is the not-yet-audited hub DTO shape.
