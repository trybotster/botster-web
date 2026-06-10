# Existing Hub Dogfood Bridge Mode Plan

## Context Loaded

- Pipeline context: ticket `ticket_1781065270_771132`, run `run_1781065294_701178`, step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, questions, or answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster vault context: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan steps need reviewable plan artifacts]].
- Repo context inspected: `package.json`, `scripts/real-hub-dogfood-bridge.mjs`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/connectionDiagnostics.ts`, `README.md`, `docs/architecture.md`, and prior `docs/plans/*`.
- Existing runtime path: `npm run dogfood:hub` runs `node scripts/real-hub-dogfood-bridge.mjs`. That script currently requires `BOTSTER_HUB_BIN`, creates or uses `BOTSTER_WEB_DOGFOOD_DATA_DIR`, derives `<dataDir>/botster-hub.sock`, spawns `botster-hub start --data-dir`, waits for the socket, then proxies browser HTTP/SSE requests to daemon DTOs.
- Existing browser path: `src/App.tsx` selects real-hub mode through `createDogfoodRuntimeConfig()` only when `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub` are present. The bridge payload path already preserves `DaemonRequest`, `DaemonResponse`, and terminal daemon events rather than inventing a private browser protocol.
- Checklist evidence: run checklist `checklist_1781065357_803182` was created after an initial plugin timeout. Item 1 was marked in progress with the vault notes above.

## Scope

- Add an existing-hub mode to `scripts/real-hub-dogfood-bridge.mjs`.
- Existing-hub mode should accept `BOTSTER_HUB_SOCKET` and/or `BOTSTER_HUB_DATA_DIR`.
- When `BOTSTER_HUB_SOCKET` is present, use that socket path directly.
- When only `BOTSTER_HUB_DATA_DIR` is present, derive the socket path from that data directory using the same `botster-hub.sock` convention the bridge already uses for spawned hubs.
- In existing-hub mode, do not require `BOTSTER_HUB_BIN`, do not require `BOTSTER_SESSION_WORKER_BIN`, do not create a temp data dir, do not spawn `botster-hub`, and do not send daemon shutdown or remove the hub data dir during bridge shutdown.
- Preserve current self-spawn isolated mode for standalone web testing.
- Make bridge diagnostics and startup output distinguish spawned isolated mode from existing-hub mode.
- Keep daemon DTO passthrough unchanged: request/response and terminal stream operations continue to send the same daemon DTO payloads through the same HTTP/SSE envelopes.
- Add deterministic Node tests around mode selection, env validation, and no-spawn behavior in existing-hub mode.
- Update README with existing-hub commands that use a printed `botster-hub dogfood` data dir/socket.

## Non-Scope

- No frontend protocol redesign, no new private web protocol, and no changes to daemon DTO shapes.
- No changes to `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, or terminal data-plane mapping unless tests reveal existing-hub mode requires a tiny label/diagnostic update.
- No changes to botster-hub, botster-core, session-worker, TUI, Rails relay, Project Pipelines plugin policy, or WebRTC production transport.
- No new package manager, build step, framework, or broad test runner replacement.
- No migration from the existing `BOTSTER_WEB_DOGFOOD_DATA_DIR` spawned-mode env unless needed for compatibility with `BOTSTER_HUB_DATA_DIR`.

## Assumptions And Unknowns

- Assumption: a running dogfood hub exposes the same daemon socket protocol and handshake as the isolated hub spawned by the bridge.
- Assumption: `BOTSTER_HUB_DATA_DIR` should mean an already-running hub data dir for this ticket, while `BOTSTER_WEB_DOGFOOD_DATA_DIR` remains the existing self-spawn isolated bridge data-dir override.
- Assumption: if both `BOTSTER_HUB_SOCKET` and `BOTSTER_HUB_DATA_DIR` are present, `BOTSTER_HUB_SOCKET` should win because it is the most explicit endpoint.
- Assumption: if neither existing-hub env var is present, current spawned isolated behavior remains the default.
- Assumption: `BOTSTER_HUB_BIN` should only be required for spawned isolated mode.
- Unknown: the exact output wording from the hub/package entrypoint that prints the dogfood socket/data dir. README should phrase commands around `BOTSTER_HUB_SOCKET=/printed/socket` or `BOTSTER_HUB_DATA_DIR=/printed/data-dir` without coupling to unstable prose.
- Unknown: whether users may set both existing-hub env vars and `BOTSTER_WEB_DOGFOOD_DATA_DIR`. Implementation should fail fast or clearly document precedence rather than silently mixing an existing socket with spawned-mode cleanup semantics.
- Unknown: whether `BOTSTER_WEB_DOGFOOD_KEEP_DATA` has meaning in existing-hub mode. Plan assumption is no: existing-hub mode never owns that data and therefore never removes it.

## Botster Layers Touched

- Botster web bridge harness: Node same-device dev/test bridge.
- Browser SPA docs/tests: existing real-hub mode remains the production entry point from `src/App.tsx`; tests should prove the bridge mode selection underneath it.
- Docs: README real-hub dogfood bridge commands and diagnostics.

## Affected Surfaces And Files

- `scripts/real-hub-dogfood-bridge.mjs`: introduce a small mode resolver, use resolved `socketPath` everywhere, gate hub spawn/cleanup/shutdown behind spawned mode, and emit mode-specific health/startup diagnostics.
- `src/App.test.mjs` or a new narrow bridge test module imported by it: add executable assertions for:
  - no existing-hub env selects spawned mode and still requires `BOTSTER_HUB_BIN`;
  - `BOTSTER_HUB_SOCKET` selects existing-hub mode and does not spawn;
  - `BOTSTER_HUB_DATA_DIR` selects existing-hub mode and derives `botster-hub.sock`;
  - socket env wins over data-dir env;
  - existing-hub shutdown does not send `daemon_shutdown` or remove the external data dir;
  - bridge source still preserves daemon DTO envelopes and terminal SSE behavior.
- `package.json`: keep `npm run dogfood:hub` unless a helper test script is needed. Prefer reusing `npm test` for deterministic bridge tests.
- `README.md`: split Real Hub Dogfood Bridge docs into spawned isolated mode and existing-hub attach mode; include commands using `BOTSTER_HUB_SOCKET` and `BOTSTER_HUB_DATA_DIR`.
- Optional `docs/architecture.md`: update only if current architecture wording says the bridge is isolated-only in a way that becomes false.
- `docs/plans/existing-hub-dogfood-bridge-mode.md`: this plan artifact.

## Implementation Shape

- Extract pure mode calculation inside the bridge script, for example:
  - `existing_socket`: socket from `BOTSTER_HUB_SOCKET`, no spawned hub ownership.
  - `existing_data_dir`: socket from `BOTSTER_HUB_DATA_DIR/botster-hub.sock`, no spawned hub ownership.
  - `spawned_isolated`: current behavior using `BOTSTER_HUB_BIN`, optional `BOTSTER_SESSION_WORKER_BIN`, and temp or `BOTSTER_WEB_DOGFOOD_DATA_DIR`.
- Keep the resolver data-oriented so tests can assert decisions without starting a real hub.
- For spawned mode, preserve current behavior: build args, spawn hub, wait for socket, route requests, send `daemon_shutdown` on shutdown, and remove temp data unless configured otherwise.
- For existing-hub mode, only wait for the chosen socket and start the HTTP/SSE bridge. On process shutdown, close the bridge server and end held sockets, but do not terminate or mutate the hub.
- Return `/health` JSON with scrubbed fields such as `{ ok: true, mode: "existing_hub", socket: "configured" }` or `{ ok: true, mode: "spawned_hub", data_dir: "<isolated-temp-dir>" }`. Do not expose raw user paths in normal health output.
- Ensure request handling and `streamTerminal()` continue to call `sendDaemonRequest(socketPath, ...)` / `openDaemonSocket(socketPath)` with the resolved path, preserving daemon DTO passthrough unchanged.
- Diagnostics should use clear operator language in console output: `existing hub socket`, `existing hub data dir`, or `spawned isolated hub`.

## Risks

- Accidentally spawning a second hub in existing-hub mode would violate the main ticket intent. Tests must assert no spawn path is taken.
- Accidentally shutting down a user-owned dogfood hub from bridge teardown would be a serious workflow regression. Existing-hub teardown must avoid `daemon_shutdown`.
- Env var ambiguity can make the bridge attach to one hub while cleaning up another. Resolve precedence explicitly and document it.
- Over-normalizing responses would violate the existing public daemon DTO boundary. Keep bridge payload handling unchanged except for socket ownership.
- Existing tests are partly source-shape assertions. Add behavior-level tests for mode resolution and spawn/no-spawn decisions, not only regex checks.
- A live hub socket can exist but be incompatible. Keep the existing daemon handshake and compatibility diagnostics; do not replace them with path existence checks.
- README examples can leak local paths if copied from a run. Use placeholders and describe "printed socket/data dir" generically.

## Acceptance Checks And Tests

- `npm test`
  - proves bridge mode selection from env;
  - proves `BOTSTER_HUB_SOCKET` / `BOTSTER_HUB_DATA_DIR` existing-hub modes do not require `BOTSTER_HUB_BIN`;
  - proves spawned mode still requires `BOTSTER_HUB_BIN`;
  - proves no-spawn/no-shutdown/no-cleanup behavior for existing-hub mode through injected fakes or pure resolver checks;
  - preserves existing assertions that daemon DTO envelopes and terminal SSE paths remain intact.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Manual/live dogfood verification when a compatible hub is available:
  - Start or identify an already-running dogfood hub and copy its printed socket or data dir.
  - Run `BOTSTER_HUB_SOCKET=/printed/botster-hub.sock npm run dogfood:hub` or `BOTSTER_HUB_DATA_DIR=/printed/data-dir npm run dogfood:hub`.
  - Run `VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev`.
  - Open `http://127.0.0.1:5173/?dogfood=real-hub`.
  - Confirm status/package/session rows come from the existing hub, the bridge logs existing-hub mode, and stopping the bridge does not stop the hub.
- Regression check:
  - Existing `BOTSTER_HUB_BIN=/path/to/botster-hub BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker npm run dogfood:hub` still starts a spawned isolated bridge and cleans up owned temp data as before.

## Pipeline Gates And Artifacts

- Plan gate evidence should point to this file and list the vault notes loaded.
- Plan Review should check the plan does not silently reinterpret `BOTSTER_HUB_DATA_DIR` as spawned mode or allow existing-hub teardown to own external data.
- Implement should attach exact evidence that tests cover no-spawn behavior and that the production script path uses the resolved existing socket.
- Verify should rerun deterministic npm checks and, when possible, a live existing-hub attach command.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation confirms a stable convention for `botster-web` bridge ownership modes and env var precedence.
- Capture a note if the hub/package entrypoint standardizes printed dogfood socket/data-dir output that future web/TUI clients should consume.
- No vault gap from planning itself: existing notes covered the main boundaries around public daemon DTOs, diagnostics, and Project Pipelines artifact discipline.
