# Web reattach scrollback rendering and duplicate input

## Context Loaded

- Project Pipelines context: ticket `ticket_1782240397_367526`, run `run_1782240404_462265`, active step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, open questions, or prior answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific notes loaded: [[plan agents must author vault context as wikilinks not home paths]], [[project pipelines checklist worker timeouts require artifact evidence fallback]], [[botster web renderable history payload is data not bytes]], [[browser-terminal-initial-snapshot-can-arrive-before-transport-listeners]], [[terminal subscribe replay reconciles duplicate peer session requests without teardown]], [[initial terminal snapshots must precede live output activation]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.test.mjs`, and prior related plans in `docs/plans/`.
- Current repo finding: the previous "DTO missing `data`" assumption is stale. `DaemonEvent` already permits `snapshot.data` and `scrollback.data`; `RealHubTerminalDataPlane` already writes those payloads to terminal output listeners and records source `"snapshot"` / `"scrollback"` in the live harness. The failure must therefore be proven in the actual browser mount, stream timing, listener lifecycle, Restty write path, or manual packaged path.
- Current suspicious runtime shape: `TerminalViewHost` subscribes status before `bridge.attach()`, `bridge.attach()` always calls `detach()` on the existing mount before reattaching, and real-hub auto-attach can select the dogfood session while explicit Attach can also select the same session. This is a plausible duplicate attach/listener path that must be verified rather than assumed.
- Botster layers touched: React/Ionic SPA terminal host, browser terminal bridge/data-plane adapter, real-hub dogfood transport/session selection, live packaged browser harness, and fast Node tests. Hub/core/session-worker changes are out of scope unless browser evidence proves current hub events do not arrive.
- Worktree/target assumptions: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869`; implementation must stay in this assigned project-pipeline worktree.
- Project Pipelines checklist evidence: `project_pipelines_create_vault_checklist` timed out with `plugin worker invoke timeout`. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], checklist provenance is preserved in this plan and should also be copied into gate evidence.

## Scope

- Reproduce the manual-shaped packaged browser path first: spawn output, browser refresh, explicit Attach on the existing running session, inspect terminal harness events, DOM attach state, Restty-visible output, daemon events, and input echo count.
- Determine whether `snapshot.data` / `scrollback.data` events arrive after explicit Attach and whether they are dropped before `renderer.write()`, written but not visible in Restty, overwritten by remount, or hidden by test harness assumptions.
- Make terminal attach idempotent for the same mounted session and data-plane identity so refresh, auto-attach, explicit Attach, detach, and reattach do not accumulate duplicate renderer input subscriptions, output subscriptions, terminal streams, or status listeners.
- Ensure explicit Attach to the currently selected/running session reconciles with any existing auto-attached session instead of forcing unnecessary detach/reattach cycles that can duplicate input or lose initial history.
- Preserve older-hub fallback behavior: byte-count-only snapshot/scrollback events remain live-only or historical-unavailable evidence, not fake restored output.
- Extend deterministic tests for listener cleanup/idempotency and renderable history delivery into a mounted terminal bridge, not just DTO parsing or source-string assertions.
- Extend or harden the live packaged browser harness so it proves the actual UI path: refresh -> explicit Attach -> restored historical output visible/recorded -> one input request and one echo.

## Non-Scope

- No new private terminal protocol or web-only terminal byte frames.
- No guessed daemon DTO fields; `data` and `bytes` must continue to mirror current hub-client serde JSON.
- No botster-hub, botster-core, session-worker, TUI, WebRTC, or daemon protocol changes unless the browser evidence shows current hub events truly do not arrive.
- No Restty replacement, renderer rewrite, broad UI redesign, state-library change, or unrelated dogfood cleanup.
- No weakening of spawn, resize, process-exit, exited-row non-attachability, or old-hub byte-count fallback checks.

## Assumptions And Unknowns

- Assumption: current hub emits renderable history as `snapshot.data` or `scrollback.data` on the held terminal stream for at least some refresh/attach cases.
- Assumption: Restty's xterm-compatible `write(data)` path is sufficient for renderable `data` strings; if data reaches `ResttyTerminalRenderer.write()` and remains invisible, implementation must capture exact payload/order evidence before changing renderer APIs.
- Assumption: duplicate keyboard input is more likely caused by duplicate browser-side `onData` subscriptions or multiple active terminal streams than by the hub echoing a single `send_input` twice.
- Unknown: whether manual refresh starts with an auto-attached dogfood session before the user clicks explicit Attach, causing two attachment paths for the same session.
- Unknown: whether `bridge.attach()` calling `detach()` on every attach is racing against pending initial history delivery and clearing the stream before snapshot/scrollback is rendered.
- Unknown: whether `TerminalViewHost` status subscription before output subscription is sufficient to trigger terminal stream attach earlier than the renderer/output listener wiring expects.
- Unknown: whether the live harness currently verifies only harness output arrays or also browser-visible Restty rendering after refresh; the ticket requires the actual terminal UI path.

## Affected Surfaces And Files

- `src/botster/terminal.ts`: likely place to make `DefaultTerminalViewBridge.attach()` idempotent, guard duplicate input/output subscriptions, and expose testable cleanup behavior.
- `src/botster/TerminalViewHost.tsx`: likely place to control attach sequencing, cleanup of live harness terminal controls, and same-session reattach behavior.
- `src/botster/realHubTerminalDataPlane.ts`: likely place to guard duplicate `ensureAttached()` / stream creation, expose active stream evidence, and distinguish listener close from explicit detach if needed.
- `src/App.tsx`: likely place to reconcile auto-selected dogfood session with explicit Attach state so the same session is not reattached unnecessarily.
- `src/botster/realHubDogfoodTransport.ts`: only touch if explicit attach action semantics or session attachability projection need a minimal adjustment.
- `src/botster/resttyRenderer.ts`: touch only if instrumentation proves data reaches the adapter but not the renderer-visible terminal.
- `src/App.test.mjs`: add focused behavior tests for mounted bridge history rendering, repeated attach/detach/listener cleanup, and single `send_input` after refresh/attach.
- `scripts/live-packaged-protocol-harness.mjs`: assert actual refresh + explicit Attach UI path, restored history output source, and exactly one `send_input`/echo for a probe.
- `README.md` or `docs/architecture.md`: update only if implementation changes documented dogfood behavior or captures a durable limitation.

## Risks

- Fixing only the DTO/data-plane branch would miss the reported regression because the repo already contains that support.
- Tests can pass by inspecting harness arrays while Restty still does not render visible scrollback. Acceptance must include browser UI-path evidence, preferably a visible output assertion from the mounted terminal path.
- Making attach idempotent too aggressively could prevent legitimate session switches or explicit detach from closing old streams. Tests need same-session and different-session cases.
- Detach semantics are overloaded: listener unsubscribe, explicit user detach, React unmount, session switch, and process exit may need different cleanup behavior. Keep changes surgical and prove each touched path.
- Live real-hub smoke can be nondeterministic if the current hub emits pre-attach history as `terminal_output` rather than `snapshot`/`scrollback`. The harness should record exact daemon-event evidence and still require visible historical output after refresh.
- Checklist persistence already failed once in this Plan step; gate artifacts must carry the workflow evidence instead of relying on checklist rows.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- Prefer `npm run lint` and `npm run typecheck` for touched TypeScript/React files if time allows.
- `npm run smoke:live-packaged-protocol` with current compatible hub/session-worker configuration.
- Deterministic tests should prove:
  - `snapshot.data` and `scrollback.data` flow through a mounted `DefaultTerminalViewBridge` into the renderer write path.
  - repeated `attach()` for the same session does not leave more than one active renderer input listener, output listener, or terminal data-plane stream.
  - explicit detach/unmount clears listeners exactly once and does not block later reattach.
  - same-session explicit Attach after auto-attach is idempotent or otherwise produces one active binding.
  - one keyboard probe after attach generates exactly one `send_input` request and one rendered echo from the browser path.
  - byte-count-only history events continue to report historical-unavailable/live-only fallback without fake output.
- Live harness success criteria:
  - packaged UI starts against real hub mode;
  - spawn produces terminal output;
  - browser refresh followed by explicit Attach targets the existing running session;
  - restored historical output is visible through the mounted terminal path after Attach;
  - the harness records the history source (`snapshot`, `scrollback`, or exact terminal-output fallback evidence);
  - a single input probe after attach produces exactly one daemon `send_input` and no duplicated echo caused by client listeners;
  - repeated attach/detach/refresh cycles do not increase active stream/listener counts or duplicate output.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should include this artifact path, loaded vault note titles, no convention conflicts, checklist timeout fallback, and the current repo finding that DTO/data support already exists.
- Implement gate should include the committed diff, production-entrypoint explanation from `App`/`TerminalViewHost` through `DefaultTerminalViewBridge` and `RealHubTerminalDataPlane`, command results, and live packaged UI evidence.
- Plan Review should reject source-only evidence, fixture-only DTO proof, private protocol additions, guessed DTO fields, or any fix that cannot explain why duplicate input is eliminated in the actual mounted browser path.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation establishes a reusable browser-side terminal attach idempotency rule for same session/data-plane identity.
- Capture a durable note if explicit user detach, listener close, React unmount, and session switch require distinct daemon detach semantics.
- Capture a durable note if live manual attach regularly delivers history as `terminal_output` rather than `snapshot`/`scrollback`, because future acceptance should name that trigger distinction.
- Capture a durable note if Restty `write(data)` is insufficient for restored history despite receiving renderable daemon data.
- No convention conflict was found during planning; the plan follows the loaded Botster SPA/data-plane notes and keeps changes scoped to botster-web.
