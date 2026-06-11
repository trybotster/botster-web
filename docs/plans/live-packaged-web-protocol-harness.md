# Live packaged web protocol harness plan

## Context Loaded

- Pipeline context: ticket `ticket_1781136752_984129`, run `run_1781136805_122029`, step `botster_plan`, gate `botster_plan_gate`.
- Gate requirement: attach plan with context loaded, scope/non-scope, assumptions/unknowns, affected files, risks, acceptance checks, and vault gaps.
- Prior artifacts/questions: plan artifact `artifact_1781136963_151665`; no open questions.
- Plan Review returned changes required in `review_1781137210_147654`: tighten resize evidence, define a deterministic process-exit trigger, keep the dogfood bridge vs production WebRTC boundary explicit in docs, and add Playwright browser-binary availability as a precondition.
- Vault/playbooks: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[botster data plane bypasses the hub through session and client actors]], [[adoption restart evidence must come from real protocol primitives not defaults]].
- Repo context inspected: `package.json`, `README.md`, `docs/architecture.md`, `scripts/packaged-browser-smoke.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `scripts/dogfoodBridgeMode.mjs`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, and `src/botster/realHubTerminalDataPlane.ts`.
- Botster layers touched by the intended implementation: React/Ionic SPA runtime path, packaged browser smoke harness, local package bridge, daemon socket protocol DTOs, terminal data plane, docs/tests.
- Worktree/target assumptions: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and this assigned worktree. Implementation agents must operate in the assigned run worktree, not an ambient checkout.

## Scope

- Add a new documented command that builds/packages `botster-web`, starts the existing package bridge in real-hub mode, starts or attaches to an isolated real `botster-hub`, opens the compiled package UI in Playwright Chromium, and fails on protocol/runtime browser errors.
- Reuse `scripts/real-hub-dogfood-bridge.mjs` and the current `/?dogfood=real-hub` Ionic app entry point. The proof must go through the same packaged UI and bridge path users run manually.
- Exercise the real daemon protocol path: `status`, `list_packages`, `list_sessions`, `spawn` of `botster-web-dogfood-session`, terminal attach/output containing `botster-web-dogfood-ready`, `send_input` with `botster-web-dogfood-echo:<input>`, resize proven by a real observed signal, process-exit/lifecycle proven by a deterministic exit trigger, and clean shutdown.
- Resize proof must not pass on send-only evidence. Prefer a PTY-visible size probe through the dogfood session command after sending `DaemonRequest::Resize`: resize to known dimensions, send a sentinel input such as `botster-web-dogfood-size`, have the session print `botster-web-dogfood-size:<rows>x<cols>` from the live PTY state, and assert the terminal stream/UI receives the expected dimensions. If the real hub cannot surface PTY size/state after resize, stop with an upstream botster-hub dependency naming the missing resize observation surface.
- Process-exit proof must be separate from clean daemon shutdown. Add a deterministic sentinel input such as `botster-web-dogfood-exit` to the dogfood session command, have it print an exit marker and exit `0`, and assert the real hub emits `process_exit` and the UI/session row reaches `exited`.
- Keep hub state isolated. Spawned mode should use a generated short temp data dir or a caller-provided isolated `BOTSTER_WEB_DOGFOOD_DATA_DIR`; existing-hub attach mode must not claim ownership or mutate persistent user identity beyond the explicit attached test hub.
- Update README/docs so the command, required environment variables, isolation semantics, and failure behavior are clear.
- Extend tests around harness mode resolution and script behavior where deterministic unit coverage is useful.

## Non-Scope

- No new browser-to-hub product protocol. The HTTP/SSE bridge remains a local same-device dogfood harness over the authoritative daemon DTOs.
- No claim that this proves the production WebRTC data plane. The docs must state that the live harness proves packaged UI + real hub control loop + dogfood bridge terminal egress only.
- No fake-daemon-only pass condition for this ticket. Existing fake packaged smoke can remain as fast coverage, but the new acceptance command must fail if it cannot reach a real hub.
- No broad UI redesign, package registry refactor, WebRTC production transport work, or Botster hub core changes unless implementation proves an exact missing upstream hook.
- No mutation of the user's real Botster home, identity, default data dir, or unrelated persistent sessions.

## Assumptions And Unknowns

- Assumption: compatible `botster-hub` and `botster-session-worker` binaries can be supplied through `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN`, or the harness can attach to an explicitly isolated existing hub through `BOTSTER_HUB_SOCKET` / `BOTSTER_HUB_DATA_DIR`.
- Assumption: the current daemon protocol supports the needed request/response and terminal events (`status`, `list_packages`, `list_sessions`, `spawn`, `attach`, `send_input`, `resize`, `drain`, `detach`, `daemon_shutdown`, lifecycle/process-exit events).
- Assumption: the default dogfood command in `src/botster/realHubDogfoodTransport.ts` can be narrowly extended to support readiness, echo proof, PTY size probe, and deterministic exit without creating a parallel synthetic protocol.
- Assumption: Playwright Chromium is installed or can be installed before running the browser harness. If the browser binary is missing, the harness should fail with a clear diagnostic that points to `npx playwright install chromium`.
- Unknown: whether `botster-hub` currently exposes `process_exit` quickly enough after the sentinel exit command for a browser harness. If not, implementation should stop and raise a precise upstream botster-hub dependency instead of inventing a fake proof.
- Unknown: whether the current real hub updates PTY dimensions synchronously enough for `stty size` or an equivalent session-side probe to observe the requested resize. If not, implementation should stop with a precise missing resize-observation dependency.

## Affected Surfaces And Files

- `package.json`: add a live harness script, likely separate from existing `smoke:packaged-browser`.
- `scripts/packaged-browser-smoke.mjs`: keep fake-daemon coverage or factor shared Playwright console/error assertions if useful.
- New script, likely `scripts/live-packaged-protocol-harness.mjs`: orchestrate build output, bridge process, hub mode, Playwright browser, protocol assertions, and cleanup.
- `scripts/real-hub-dogfood-bridge.mjs`: only touch if the live harness exposes missing real-hub semantics such as resize acknowledgement visibility, process-exit propagation, robust shutdown, or HTML readiness checks.
- `scripts/dogfoodBridgeMode.mjs`: only touch if spawned/attached ownership inputs need a narrowly scoped option for the harness.
- `src/botster/realHubDogfoodTransport.ts`: likely touch the dogfood command only if needed to add size-probe and exit sentinels used by the live harness.
- `src/botster/realHubTerminalDataPlane.ts`, `src/botster/realHubDaemonDto.ts`: only touch if DTO shape, stream behavior, or request dispatch is out of sync with the real hub.
- `src/App.test.mjs`: add focused tests for new command/script wiring and any changed bridge semantics.
- `README.md` and possibly `docs/architecture.md`: document the live command and distinguish it from fake packaged smoke.

## Risks

- A fake-daemon smoke could be mistaken for live proof. Acceptance must name and run the new live command, not only `npm run smoke:packaged-browser`.
- Real hub binaries may be missing or stale in an implementer environment. The harness should fail with exact missing binary/protocol diagnostics, and the pipeline should stop with an upstream dependency only if the hub lacks required protocol surface.
- Playwright Chromium may be missing even when the npm package is installed. Treat this as a precondition failure with clear install guidance, not as a hub/protocol failure.
- Process cleanup is load-bearing. On readiness failure, spawned bridge/hub/browser children must be killed and waited; generated data dirs should be removed unless explicitly preserved.
- Terminal stream assertions can race real PTY output. The harness should wait on observed UI text and/or stream events rather than sleeping as proof.
- Resize and lifecycle checks are vulnerable to fabricated evidence. They must be backed by live terminal output or daemon events, not only by a sent request or local state mutation.
- DTO drift between TypeScript mirrors and `botster-hub-client` can silently break the browser path. Any DTO changes must trace to authoritative Rust serde field names.
- Browser console filtering must catch real runtime failures without hiding expected operator diagnostics.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- New documented live command, for example:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

- The live command must prove, through the compiled packaged UI in a real browser: status/schema compatibility, package list request, session list request, spawn of `botster-web-dogfood-session`, terminal attach receiving `botster-web-dogfood-ready`, input receiving `botster-web-dogfood-echo:<input>`, resize observed through a real PTY/session-side size signal, lifecycle/process-exit observed after a deterministic exit sentinel, and clean shutdown.
- Resize success requires a concrete observed value after `DaemonRequest::Resize`, such as terminal output `botster-web-dogfood-size:<rows>x<cols>` from the live session matching the requested dimensions. Merely dispatching a resize request is not passing evidence.
- Lifecycle success requires the harness to send the exit sentinel, observe `process_exit`, and observe the UI/session entity reach `exited`; daemon shutdown alone is not passing lifecycle evidence.
- The live command must fail on unhandled promise rejection, page error, terminal mount failure, stack overflow, HTTP 404 for packaged assets, bridge/operator error for the primary spawn path, and any fake-daemon-only pass path.
- If real hub support is missing for resize observation or deterministic process-exit observation, stop with a dependency artifact naming the exact missing daemon request/event/CLI hook.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should reference this file and the loaded vault notes by wiki link titles, not absolute home paths.
- Implementation gate should include committed diff evidence, command output for `npm test`, `npm run build`, and the new live harness command, plus any upstream dependency details if blocked.

## Vault Gaps Worth Capturing

- Capture if the live harness discovers a durable hub protocol gap, especially around browser package bridge resize observation or process-exit observation.
- Capture if Playwright live-hub harnesses need a reusable Botster cleanup pattern beyond the existing subprocess notes.
- No new durable knowledge from planning alone; current vault notes already cover the main constraints.
