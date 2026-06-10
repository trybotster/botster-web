# botster-web Spawn diagnostic rendering verification plan

## Context loaded

- Pipeline context: `ticket_1781126299_733933`, `run_1781131041_906541`, current step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, findings, questions, or answers were present.
- Required playbooks: [[planner-playbook]] and [[botster-planner-playbook]].
- Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific notes: [[botster hub diagnostics use daemon diagnostic rows in client dtos]], [[botster web dto field names must match authoritative rust serde structs]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/connectionDiagnostics.ts`, `src/botster/ConnectionDiagnosticsPanel.tsx`, `scripts/packaged-browser-smoke.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, and prior plans under `docs/plans/`.
- Project Pipelines checklist: `checklist_1781131115_189545`. Creation first returned a plugin-worker timeout, then `project_pipelines_list_checklists` showed it persisted; checklist evidence should still be updated if the item ids are available.

## Scope

- Verify and, if needed, tighten only `botster-web` behavior for real-hub dogfood Spawn failures.
- Keep the production path centered on the existing real-hub dogfood flow:
  - `src/App.tsx` constructs `createDogfoodRuntimeConfig()` and `createBotsterWebClient()`.
  - `App.tsx` subscribes to hub frames and records `operatorErrorDiagnostic(frame)` plus `hubConnectionDiagnosticFromFrame(frame)`.
  - `src/botster/realHubDogfoodTransport.ts` dispatches `botster.session.select` as daemon request `{ type: "spawn" }`, maps `DaemonResponse.error` to an `operator_error` frame, and maps `DaemonResponse.diagnostics` plus `DaemonStatus.diagnostics` to `connection_diagnostic` frames.
  - `src/botster/connectionDiagnostics.ts` reads diagnostic fields by exact Rust serde names: `kind`, `operation`, `feature`, and `message`.
  - `src/botster/ConnectionDiagnosticsPanel.tsx` renders the resulting rows.
- Add or update verification so a hub-shaped Spawn failure with `DaemonResponse.kind = "operator_error"`, `error.code = "spawn_failed"` or `"session_already_exists"`, `error.operation = "spawn"`, and `diagnostics[{ kind: "action_failure", operation: "spawn", feature: null, message: ... }]` renders both the operator error and the richer diagnostic row.
- Exercise the packaged real-hub dogfood Spawn user path, preferably by extending `scripts/packaged-browser-smoke.mjs` or an adjacent smoke fixture so clicking "Spawn isolated session" receives a failing daemon response and the browser assertion proves the diagnostic row is visible.

## Non-scope

- No edits to `botster-hub`, `botster-core`, Rust daemon DTOs, TUI, or session-worker code.
- No broad redesign of the Ionic shell, shared UI primitives, entity store, terminal data plane, or package registry display.
- No invented browser-local diagnostic fields such as `capability`; web DTOs must mirror the authoritative Rust serde names.
- No pathful or unsanitized local runtime details in rendered diagnostics beyond hub-provided bounded, path-neutral messages.
- No dependency churn unless a currently configured test script already requires it.

## Assumptions and unknowns

- Assumption: `botster-hub-client` authoritative field names for `DaemonDiagnostic` remain exactly `kind`, `operation`, `feature`, and `message`, per the ticket and vault notes.
- Assumption: the existing `ConnectionDiagnosticsPanel` is the intended visible surface for daemon diagnostic rows, and the operator-error row can remain a separate row.
- Assumption: current unit tests already prove generic diagnostic mapping, but packaged-browser smoke currently proves successful Spawn only; it does not prove the failure path this ticket requires.
- Unknown: whether a live hub binary that emits the new Spawn diagnostic contract is available in this worktree environment. If unavailable, record the exact missing `BOTSTER_HUB_BIN` / worker prerequisite and rely on a hub-shaped packaged fake-daemon smoke plus unit coverage.
- Unknown: whether current rendered details include the diagnostic `message` text from a real failing Spawn. Implementation must assert the specific bounded message appears, not only "Operation: spawn".

## Affected surfaces/files

- `src/botster/realHubDaemonDto.ts`: confirm `DaemonDiagnostic` stays `kind`, `operation`, `feature`, `message`.
- `src/botster/realHubDogfoodTransport.ts`: production Spawn dispatch and `DaemonResponse` frame mapping.
- `src/botster/connectionDiagnostics.ts`: `connection_diagnostic` frame to visible diagnostic model, including `feature` and `operation`.
- `src/botster/ConnectionDiagnosticsPanel.tsx`: visible row renderer.
- `src/App.tsx`: production entry point that records real-hub frames into diagnostics state.
- `src/App.test.mjs`: focused runtime/render assertions for hub-shaped Spawn diagnostic responses.
- `scripts/packaged-browser-smoke.mjs`: preferred packaged user-path proof for clicking Spawn and seeing the richer diagnostic row.
- `README.md` only if operator instructions for running the failure-path smoke need a durable note.

## Botster layers touched

- React/Ionic SPA.
- Browser same-device real-hub dogfood bridge adapter.
- Packaged browser smoke harness.
- Tests/docs only; no hub/core runtime layer.

## Worktree and target assumptions

- Run target: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Worktree: this pipeline checkout for `botster-web spawn diagnostic rendering verification`.
- Implementer must not edit ambient Botster hub/core checkouts or rely on a different worktree for source changes.

## Risks

- Fixture-shape risk: tests can pass with browser-invented fields while real hub JSON uses `feature`. Mitigation: use the exact Rust serde names in fixtures and assertions.
- Runtime-path risk: direct helper tests can pass while `App.tsx` never records the row. Mitigation: at least one assertion must drive the `createDogfoodRuntimeConfig()` / `createBotsterWebClient()` path or packaged browser click path.
- Smoke false-positive risk: the existing packaged smoke succeeds Spawn and only checks that a spawn request was sent. Mitigation: add a failure-mode smoke or explicit browser assertion for "Hub action failed", `Operation: spawn`, and the hub diagnostic message.
- Duplicate/noise risk: generic action rejection, operator error, and daemon diagnostic rows can co-fire. That is acceptable only if the daemon diagnostic row surfaces more than the generic runtime error; tests should prove `runtime failed while handling Spawn: Runtime` is not the only visible error.
- Live-binary risk: current environment may lack a matching hub binary. Mitigation: record exact unavailable prerequisite and still run package fake-daemon smoke plus unit tests.

## Acceptance checks/tests

- `npm test`
  - includes a hub-shaped `DaemonResponse` fixture for failing Spawn using `error.code = "spawn_failed"` or `"session_already_exists"`, `error.operation = "spawn"`, and `diagnostics` with `kind`, `operation`, `feature`, `message`;
  - proves `daemonResponseFrames()` emits both `operator_error` and `connection_diagnostic` frames;
  - proves `hubConnectionDiagnosticFromFrame()` renders `Hub action failed`, `Operation: spawn`, optional `Capability: ...` only when `feature` is non-null, and the hub-provided `message`;
  - proves `ConnectionDiagnosticsPanel` visible markup includes the specific diagnostic message, not only the generic action failure or operator-error text;
  - includes production-path coverage through `createDogfoodRuntimeConfig()` / `createBotsterWebClient()` or an equivalent app-runtime harness, not only direct helper calls.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run smoke:packaged-browser`
  - extend the smoke or add a mode so clicking "Spawn isolated session" can receive a failing hub-shaped Spawn response;
  - assert the page shows the richer daemon diagnostic row and not only a generic `runtime failed while handling Spawn: Runtime` error.
- Live dogfood evidence, when binaries are available:
  - run `npm run dogfood:hub` with explicit `BOTSTER_HUB_BIN` and worker env if required;
  - open or automate `/?dogfood=real-hub`;
  - click "Spawn isolated session" in the failure condition;
  - record visible evidence for the Spawn diagnostic row, or record the exact reason the live failure condition could not be reproduced.

## Pipeline gates and artifacts

- Plan artifact: this file.
- Gate evidence should include the loaded context, plan scope, assumptions, affected files, risks, acceptance checks, and vault gaps.
- Checklist evidence should record the vault notes above, convention conflicts as `none`, planned verification commands, and capture decision. If checklist item update times out, preserve the same evidence in the gate and artifact.

## Vault gaps worth capturing

- Capture a note if packaged browser smoke gains a reusable failure-mode pattern for daemon action diagnostics.
- Capture a note if live hub Spawn diagnostics expose an additional stable failure code or row taxonomy not already covered by [[botster hub diagnostics use daemon diagnostic rows in client dtos]].
- No capture needed if implementation only verifies the existing `DaemonDiagnostic` row contract without discovering a new reusable project rule.
