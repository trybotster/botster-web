# Restore mounted renderer keyboard input proof

## Context Loaded

- Project Pipelines context: ticket `ticket_1783007994_626227`, run `run_1783008197_142114`, active step `botster_plan`, run step `run_step_1783008198_727928`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, questions, or prior answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific notes loaded: [[browser terminal input proof must exercise renderer callbacks]], [[mounted browser terminal attach is idempotent by attachment identity]], [[botster web live attach tests separate history dto support from trigger support]].
- Repo context inspected: `package.json`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `src/App.test.mjs`, `docs/architecture.md`, and prior plans under `docs/plans/`.
- Current repo finding: the canonical live packaged protocol harness already proves real hub/WebRTC transport, session spawn, terminal attach, mounted renderer output, resize, process exit, and one `send_input` echo count, but the echo input is sent through `callTerminalControl(page, "writeInput", ...)`. That bypasses Restty/browser keyboard input callbacks and leaves the exact residual gap named by the ticket.
- Botster layers touched: React/Ionic SPA mounted terminal renderer path, Restty browser input path, live packaged Playwright harness, fast Node/source-regression tests, and minimal docs/test naming. Hub/core/session-worker changes are out of scope unless the browser path proves a missing registered dependency.
- Worktree/target assumptions: implementation agents must stay in this assigned project-pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Project Pipelines checklist evidence: `project_pipelines_checklist_instructions` was loaded. `project_pipelines_create_vault_checklist` timed out with `plugin worker invoke timeout`; per [[project pipelines checklist worker timeouts require artifact evidence fallback]], checklist provenance and evidence are preserved in this plan and should be copied into gate evidence.

## Scope

- Replace the live harness echo-input proof with a mounted browser keyboard path: wait for the `.terminal-view-container canvas`, focus the terminal through the visible mounted path, click the canvas/container as needed, then use Playwright `page.keyboard.insertText(`${probe}\n`)`.
- Keep the proof boundary on the mounted Restty renderer: keyboard/input event -> Restty `beforeInput` / renderer callback path -> `TerminalDataPlaneAttachment.writeInput` -> daemon `send_input` -> real session echo -> mounted renderer output.
- Preserve the exact one-request invariant for the keyboard probe: count matching daemon `send_input` requests before and after the keyboard input, and require exactly one new request for the probe payload.
- Preserve existing mounted-output evidence: after the keyboard probe, require both terminal output containing `botster-web-dogfood-echo:<probe>` and a mounted renderer write containing the same echo.
- Keep helper-based terminal controls only where they are not the keyboard acceptance proof, such as size and exit sentinels, unless implementation can safely route those through the same mounted keyboard path without destabilizing unrelated live checks.
- Update names or docs so the live smoke distinguishes helper-based protocol controls from the mounted keyboard input proof.
- Add fast deterministic coverage in `src/App.test.mjs` that guards the live harness against regressing back to direct `writeInput` for the echo probe and records that the harness uses a browser keyboard/input operation for the mounted proof.
- If the full live harness path is unstable because Restty cannot receive Playwright keyboard input in the packaged browser environment, add one adjacent focused browser/component smoke that mounts `TerminalViewHost` with a real `DefaultTerminalViewBridge`/Restty renderer and proves browser-like input through the mounted renderer. Stop for a human question only if satisfying the ticket would require waiving the browser keyboard/input requirement.

## Non-Scope

- No changes to production WebRTC transport, daemon DTOs, hub/core/session-worker behavior, or old HTTP bridge semantics as production proof.
- No fake-daemon-only acceptance for this ticket. Deterministic tests can guard implementation, but the acceptance proof must include the canonical live packaged smoke or a clearly named adjacent mounted browser proof.
- No Restty replacement, broad terminal bridge rewrite, UI redesign, state-store refactor, generated protocol changes, or package lifecycle cleanup.
- No revived monolith or Hotwire/Rails work.
- No weakening of existing live smoke checks for status/listing, package configuration, app surface rendering, spawn, refresh/attach, historical output, resize, process exit, exited-row behavior, browser failures, or cleanup.

## Assumptions And Unknowns

- Assumption: after `waitForTerminalCanvas(page)`, clicking/focusing the mounted Restty canvas or container and calling Playwright `keyboard.insertText()` will cross Restty's input path and produce the same full-line data currently sent by direct `writeInput`.
- Assumption: newline handling for `keyboard.insertText(`${probe}\n`)` is acceptable for the dogfood echo command. If Restty/browser input emits `\r` or separates Enter from text, implementation should adapt the assertion to the exact daemon `send_input` payload that the real keyboard path emits, while still requiring one request and one echo.
- Assumption: direct `callTerminalControl(..., "writeInput", ...)` remains acceptable for non-keyboard control probes such as size and exit because this ticket's residual proof gap is the mounted keyboard echo path.
- Unknown: whether Restty focuses a hidden input or the canvas itself in the vendored build. Implementation should inspect the live DOM and use the public user path first: visible container/canvas click plus Playwright keyboard input.
- Unknown: whether Playwright `insertText` is enough in Chromium for Restty's current beforeinput pipeline, or whether the stable path requires `keyboard.type()` / Enter key separation. Either is acceptable if the resulting input originates from browser keyboard/input events, not direct `writeInput`.
- Unknown: whether an adjacent focused browser proof will be needed for stability. Prefer extending the canonical live smoke first because the current smoke already covers real daemon/session/renderer output.

## Affected Surfaces And Files

- `scripts/live-packaged-protocol-harness.mjs`: primary change. Add a helper such as `typeThroughMountedTerminal(page, data)`, drive Playwright keyboard/input through the mounted terminal for the echo probe, and keep request-count/rendered-echo assertions around that path.
- `src/App.test.mjs`: add or adjust source-level regression assertions so the harness includes the mounted keyboard proof (`keyboard.insertText` or equivalent) and the echo probe no longer uses direct `callTerminalControl(..., "writeInput", ...)`.
- `README.md`: likely small update if command/test descriptions currently imply only helper-based protocol input; name the mounted keyboard proof in the live smoke description.
- `docs/architecture.md`: touch only if the implementation clarifies a durable terminal-proof boundary that belongs in repo architecture docs.
- `src/botster/TerminalViewHost.tsx`, `src/botster/resttyRenderer.ts`, `src/botster/terminal.ts`: touch only if live evidence shows the mounted browser input path lacks a stable focus/input surface. Any such change must be narrow and wired through the production `TerminalViewHost` -> `DefaultTerminalViewBridge` -> Restty renderer entry point.

## Risks

- A direct harness hook such as `terminalControl.writeInput` or `terminalRendererInput` can make tests pass while still bypassing the browser keyboard callback path. Plan Review should reject that as acceptance evidence for the echo probe.
- Browser focus/input behavior can be flaky. The implementation should wait for attach state, rendered output, and nonzero canvas bounds before typing, and report focused element/terminal harness state on failure.
- Counting only daemon requests is insufficient if output rendering regresses. The proof must retain mounted renderer write evidence for the echoed line.
- Making app or bridge changes to support the test could accidentally change production WebRTC behavior. Keep production transport code unchanged unless live evidence proves a real missing focus/input affordance in the mounted terminal.
- The existing live harness is already broad and may fail from unrelated hub binary or Playwright availability issues. Implementation evidence must separate environment failures from changed-path failures.
- New docs/test names could overclaim that all terminal input paths are proven. The claim should be precise: mounted renderer keyboard path for the canonical full-line echo probe.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- Prefer `npm run typecheck` and `npm run lint` if TypeScript/React files beyond the harness/test docs are touched.
- `npm run smoke:live-packaged-protocol` against the current compatible hub/session-worker setup.
- Live smoke success criteria:
  - compiled packaged UI runs in WebRTC real-hub mode;
  - the terminal session is spawned/running/attachable and mounted through `TerminalViewHost`;
  - Restty canvas is present with nonzero bounds;
  - the echo probe is sent by a browser keyboard/input operation against the mounted terminal, not `callTerminalControl(..., "writeInput", ...)`;
  - exactly one daemon `send_input` request is observed for the keyboard probe payload;
  - exactly one echoed line appears in terminal output and mounted renderer write evidence;
  - existing canonical live smoke checks for WebRTC transport, package/app requests, refresh attach, historical output, resize proof, process exit, exited-row behavior, browser failures, and cleanup still pass.
- Fast regression tests should prove the live harness contains the browser keyboard proof and should fail if the echo proof is changed back to direct `writeInput`.
- If the canonical live smoke cannot stably carry the mounted keyboard path, the adjacent focused smoke must be clearly named and must still mount the real renderer path and use browser-like keyboard/input events. The canonical live smoke must continue to pass unchanged for WebRTC transport behavior.

## Pipeline Gates And Artifacts

- Plan artifact: `docs/plans/restore-mounted-renderer-keyboard-input-proof.md`.
- Plan gate evidence should include this artifact path, loaded vault note titles, checklist timeout fallback, no convention conflicts, current repo finding, assumptions, and affected surfaces.
- Implement gate should include committed diff evidence, production-entrypoint explanation from `App.tsx`/`TerminalViewHost.tsx` into `DefaultTerminalViewBridge` and Restty, command results, and live smoke evidence showing the keyboard probe path and exact `send_input` count.
- Plan Review should reject helper-only input proof, fixture-only proof, source-only proof, private terminal protocol additions, revived HTTP bridge production claims, or any implementation that cannot show the runtime path from mounted browser input to rendered echo.

## Vault Gaps Worth Capturing

- Capture a durable note if Playwright + Restty requires a specific stable focus/input sequence beyond the existing [[restty live harnesses use inserttext through mounted terminal focus]] guidance.
- Capture a durable note if newline/Enter handling for Restty browser input differs from direct `writeInput` in a way future live harnesses must remember.
- Capture a durable note if the implementation discovers that an adjacent focused browser proof is more reliable than the canonical live smoke for mounted keyboard input.
- No convention conflict was found during planning; this plan follows the loaded Botster SPA/data-plane notes and keeps every changed line tied to the residual mounted keyboard proof gap.
