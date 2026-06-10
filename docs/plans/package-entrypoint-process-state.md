# botster-web package entrypoint process state plan

## Context Loaded

- Pipeline context: ticket `ticket_1781065271_938851`, run `run_1781111327_585139`, current step `hotwire_plan`, gate `hotwire_plan_gate`. Dependency `ticket_1781065270_520493` is closed. Plan review `review_1781111939_348582` returned changes required; this revision incorporates its authoritative DTO audit and the human answer to `question_1781111981_697247`.
- Ticket intent: show which package entrypoints are available, running, failed, and stopped in the botster-web package registry UI, using existing hub package DTOs/bridge paths.
- Vault/playbook context: [[planner-playbook]], [[hotwire-app-planner-playbook]], [[rails-conventions]], [[hotwire-patterns]], [[fat models over service objects]], [[controllers prepare data views render only]], [[styles and html live in html not javascript]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Stack packet: this checkout is the standalone `botster-web` Vite/React/Ionic SPA, not a Rails/Hotwire app. The Hotwire pipeline/playbook was loaded because the run uses that pipeline, but the applicable implementation authority is the Botster SPA/entity-frame guidance.
- Repo context inspected: `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.tsx`, `src/App.test.mjs`, `docs/plans/package-registry-display.md`, `docs/architecture.md`, `README.md`, and `package.json`.
- Current production path: `App.tsx` already pulls `botster-web.package`; `realHubDogfoodTransport.ts` already sends `DaemonRequest` `{ type: "list_packages" }`, maps `DaemonResponse.packages` into `botster-web.package` entity rows, and renders the `Installed packages` list from the real `realHubDogfoodUiTreeSnapshot`.
- Authoritative DTO from plan review: `DaemonPackage.runnable_entrypoints: DaemonPackageRunnableEntrypoint[]`, with each entrypoint carrying `{ id, kind, command, args, working_directory, environment, mode, capabilities, may_supervise, process }`; `process` carries `{ state: string, pid?: number, started_at?: number, exited_at?: number, exit_status?: string, diagnostics: DaemonPackageDiagnostic[] }`; `DaemonPackageDiagnostic` carries exactly `{ kind, message }`.
- Human answer: drop URL/missing-URL rendering for this ticket. Do not invent or infer a URL from another source; a launch URL can be added later only if the hub contract grows one.
- Checklist context: Project Pipelines checklist creation initially timed out in the plugin worker, then created `checklist_1781111390_583169`. Evidence is recorded there and in this plan.

## Scope

- Extend the existing package DTO subset in `src/botster/realHubDaemonDto.ts` to include `DaemonPackage.runnable_entrypoints`, `DaemonPackageRunnableEntrypoint`, `DaemonPackageProcess`, and a dedicated `DaemonPackageDiagnostic` matching the authoritative `botster-hub-client` serde JSON.
- Extend `packageRecord()` in `src/botster/realHubDogfoodTransport.ts` so each package row exposes display fields for runnable entrypoint id, kind, process state, pid, started/exited timestamps when useful, exit status, and diagnostics.
- Update `realHubDogfoodUiTreeSnapshot` in `src/botster/realHubDogfoodTransport.ts` to render entrypoint/process state inside the existing `Installed packages` package registry section.
- Preserve the current read-only package registry behavior and existing `App.tsx` pull path; change it only if the new hub DTO requires a different existing entity pull/request path.
- Add focused tests in `src/App.test.mjs` for DTO-backed running, failed, stopped/exited, and diagnostics states using hub-shaped package DTOs and real rendered `UiNodeSurface`/Ionic output.
- Update `README.md` and/or `docs/architecture.md` only if the operator-facing package registry description or DTO boundary documentation is now incomplete.

## Non-Scope

- No botster-hub, Rust, TUI, or plugin runtime changes in this repo.
- No private web-only protocol or inferred entrypoint schema. If the dependency did not expose a stable DTO shape, stop and ask a human question.
- No package lifecycle mutation actions such as install, enable, disable, remove, start, stop, restart, or retry.
- No URL, launch endpoint, or missing-URL rendering. The authoritative DTO has no URL field, and the human answer explicitly moved URL out of scope for this ticket.
- No new state store, request cache, renderer registry, or broad UI refactor.
- No terminal/Restty changes.
- No Rails, Hotwire, Stimulus, Turbo, or server-rendered implementation work; those playbooks do not match this checkout's runtime.

## Assumptions And Unknowns

- Assumption: closed dependency `ticket_1781065270_520493` means `list_packages` now includes `runnable_entrypoints` on package records. If it is exposed through a different existing package DTO path, use that path without inventing web-only protocol fields.
- Assumption: a package may expose zero, one, or multiple runnable entrypoints; the authoritative field is plural, so the UI must support multiple entrypoints per package.
- Assumption: "available" means an entrypoint is present in `runnable_entrypoints`. Process availability/running state must be rendered from `process.state` and related process fields, not inferred from package enablement or a URL.
- Unknown: exact process state string values emitted by the hub supervisor beyond the reviewed fixture's `"running"`. Implementer must inspect the hub producer for `DaemonPackageProcess.state` and use real emitted values in tests. The client should render `process.state` verbatim, with `exit_status` and diagnostics providing failure/stop detail.
- Resolved ticket ambiguity: URL/missing-URL is not part of this ticket after human answer `question_1781111981_697247`.
- Worktree/target assumption: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and workspace `botster-web entrypoint process state`.
- Convention conflicts: none. The plan follows Botster SPA/entity-frame conventions and explicitly avoids forcing Rails/Hotwire architecture onto a React checkout.

## Affected Surfaces And Files

- Botster layers touched: React/Ionic SPA, browser real-hub bridge adapter, entity-frame package read model, tests, and possibly docs.
- `src/botster/realHubDaemonDto.ts`: authoritative browser-side structural DTO subset for `DaemonPackage` and any nested entrypoint/process structs.
- `src/botster/realHubDogfoodTransport.ts`: package entity mapping and package registry UI tree.
- `src/App.test.mjs`: hub-shaped DTO fixtures, entity assertions, rendered markup assertions, and source-guard updates.
- `src/App.tsx`: likely no change because the production path already pulls `botster-web.package`; touch only if the existing pull no longer proves the user path.
- `README.md`: optional operator docs for entrypoint process state visibility.
- `docs/architecture.md`: optional update if the package entity row contract changes materially.

## Implementation Outline

1. Confirm the hub producer values for `DaemonPackageProcess.state` on current botster-hub `origin/main` or the dependency run worktree before writing test fixtures. Keep the reviewed DTO field list as the TypeScript contract.
2. Add narrow TypeScript structural types matching the real serde names: `runnable_entrypoints`, `process`, `state`, `pid`, `started_at`, `exited_at`, `exit_status`, and `diagnostics`. Add a dedicated `DaemonPackageDiagnostic { kind: string; message: string }`; do not reuse daemon-level `DaemonDiagnostic`.
3. Map entrypoint process fields in `packageRecord()` into stable, display-oriented properties. Preserve plural entrypoints; include id, kind, process state, pid when present, exit status when present, started/exited timestamps when useful, and diagnostics text.
4. Render those fields under each package row in `realHubDogfoodUiTreeSnapshot`, using existing primitives (`list`, `row`, `badge`, `text`, `empty_state`) before touching the renderer.
5. For packages with no runnable entrypoints, render an explicit empty entrypoint state such as "No runnable entrypoints" if the current UI pattern supports row-local empty text.
6. Add tests for running, failed, stopped/exited, and diagnostics states using real hub-emitted process state strings plus `exit_status`/diagnostics to distinguish failed from stopped. Assert both entity row data and rendered markup through the real renderer path.
7. Preserve existing source guards proving no package mutation operations are introduced.
8. Update docs if the current package registry text no longer describes what the UI shows.

## Risks

- Private protocol risk: guessing entrypoint field names would violate [[botster web dto field names must match authoritative rust serde structs]]. Mitigation: use the reviewed authoritative DTO exactly and reject URL work in this ticket.
- Multiplicity risk: rendering a single entrypoint when the hub exposes multiple entrypoints per package would hide state. Mitigation: model the display after the actual DTO cardinality.
- User-path risk: tests that call `packageRecord()` directly could pass while the real app never pulls or renders the data. Mitigation: keep/verify the existing `App.tsx` `botster-web.package` pull and render through `UiNodeSurface`.
- State-label risk: `process.state` is a free-form string, so assumed literals can create false coverage. Mitigation: pin real hub-emitted strings before writing fixtures and render state verbatim.
- Failed-vs-stopped risk: state alone may not distinguish failure from clean stop. Mitigation: render and test `exit_status`, `exited_at`, and diagnostics where present.
- Diagnostic shape risk: entrypoint diagnostics use `DaemonPackageDiagnostic { kind, message }`, not daemon-level `DaemonDiagnostic`. Mitigation: add a separate TypeScript interface and mapping path.
- PII/path risk: diagnostics or commands could include local paths. Mitigation: render only hub-sanitized package DTO fields needed for process observability; avoid raw working-directory/provenance output unless already scrubbed and explicitly useful.
- Pipeline mismatch risk: Rails/Hotwire reviewers may expect Rails files. Mitigation: plan artifact states this repo is a SPA and identifies the applicable Botster layers.

## Acceptance Checks And Tests

- `npm test` must cover:
  - hub-shaped package DTOs with running entrypoint process state render id, kind, and state;
  - failed entrypoint process state renders `exit_status` and/or `DaemonPackageDiagnostic { kind, message }` text from real DTO fields;
  - stopped/exited entrypoint process state renders distinctly from running and failed using real state strings plus `exit_status`/`exited_at` where the hub provides them;
  - package records with no runnable entrypoints render an explicit no-entrypoints state, if supported by the existing row UI;
  - package rows still render existing package name/version/classification/capability summaries;
  - no private install/enable/disable/remove/start/stop/retry package operations are introduced.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- Manual runtime check when a compatible hub binary is available:
  - start the real dogfood bridge with the hub that includes entrypoint process DTOs;
  - run `VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev`;
  - open `http://127.0.0.1:5173/?dogfood=real-hub`;
  - confirm the existing `Installed packages` section shows package entrypoint id/kind/process state and exit status or diagnostics where provided.

## Vault Gaps Worth Capturing

- Capture the exact package entrypoint/process daemon DTO shape and the no-URL human decision after implementation confirms the hub producer state strings, if no current vault note already records them.
- Capture a botster-web note if the package registry establishes a reusable nested-entrypoint row rendering pattern.
- No vault note was written during re-planning; the review-provided DTO and no-URL decision are recorded in this plan and should become durable vault knowledge after implementation confirms the hub producer state strings.
