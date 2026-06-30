# Live packaged protocol terminal echo timeout

## Context Loaded

- Project Pipelines context: ticket `ticket_1782847895_361795`, run `run_1782847905_720885`, active step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, open questions, or prior answers.
- Ticket intent: fix the canonical `botster-web` live packaged protocol smoke so terminal/session echo coverage either passes for real or is explicitly split with a product-owned reason. The prior failure timed out waiting for one `send_input` after dispatching terminal input; surface-only mode passed.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific vault constraints: [[browser terminal input proof must exercise renderer callbacks]], [[mounted browser terminal attach is idempotent by attachment identity]], [[botster terminal clients share one sessionio data plane subscription path]], [[botster terminal egress is session backed only]], [[browser terminal control commands carry session uuid for worker routing]], [[per request http sockets cause immediate terminal subscription detach]], [[botster web dto field names must match authoritative rust serde structs]], [[botster web generated protocol drift checks need explicit hub artifact paths]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `README.md`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `src/App.test.mjs`, and prior related plans in `docs/plans/`.
- Current repo finding: the live harness already dispatches the echo through `globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalRendererInput(...)`, which calls `Restty.sendInput(data, "key")`; Restty then routes through `BotsterTerminalPtyTransport.sendInput()` into `RealHubTerminalDataPlane.writeInput()`, which should issue daemon request `{ type: "send_input", session_id, data }`. The failure point should be localized along that exact runtime chain before changing behavior.
- Botster layers touched: React/Ionic SPA terminal mount and renderer adapter, browser terminal data-plane adapter, dogfood bridge/live protocol harness, daemon DTO usage, tests/docs. Hub/core/session-worker changes are out of scope unless web evidence proves the request reaches the bridge/hub and the owning runtime fails to echo.
- Worktree/target assumptions: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869`; implementation must operate in this assigned project-pipeline worktree, not an ambient checkout.
- Project Pipelines checklist evidence: `project_pipelines_create_vault_checklist` timed out with `plugin worker invoke timeout`. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], this plan and gate evidence preserve vault-note provenance, convention conflicts, verification intent, and capture disposition.

## Scope

- Reproduce or localize the timeout in the canonical command path:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

- Instrument or assert the browser-side runtime chain with minimal, removable-or-useful evidence: harness `dispatchResttyInput` -> `terminalRendererInput` -> Restty key input -> `BotsterTerminalPtyTransport.sendInput()` -> `RealHubTerminalDataPlane.writeInput()` -> bridge daemon request `send_input`.
- Preserve the requirement that browser/harness tests exercise the mounted terminal/renderer callback path. Do not replace it with direct `writeInput()` helper proof as the primary acceptance path.
- If browser-side routing is broken, make the smallest fix in the mounted terminal bridge, Restty adapter, data-plane attach state, or live harness sequencing needed to produce exactly one daemon `send_input` and one echoed output.
- If the request reaches the bridge/hub but echo still times out due to botster-hub or botster-core runtime behavior, file/register a dependency ticket for the owning repo with exact evidence instead of patching around the runtime in `botster-web`.
- If the correct product decision is to split surface configuration proof from terminal/session proof, split the npm targets with precise names and docs, keeping one target that still proves terminal echo end-to-end. The canonical smoke must not silently waive echo.
- Keep all changes surgical and traceable to this ticket: no adjacent UI redesign, no new transport protocol, no speculative abstractions.

## Non-Scope

- No edits to the old `Tonksthebear/trybotster` monolith or any Rails/Hotwire pipeline.
- No botster-hub, botster-core, session-worker, TUI, or production WebRTC changes inside this repo. Escalate those as registered dependencies if evidence points there.
- No private web-only terminal byte frames in `src/botster/protocol.ts`, no direct session-worker protocol constants, and no guessed daemon DTO fields.
- No fake-daemon-only pass, no helper-only direct data-plane proof, and no source-string-only proof.
- No weakening of resize, process-exit, historical output, attach-state, browser console/page error, or package configuration checks unless an explicit split is documented and separately named.
- No mutation of the user's real Botster home, identity, default data dir, unrelated persistent sessions, or PII-bearing artifacts.

## Assumptions And Unknowns

- Assumption: current local hub/core binaries are intended to support daemon `send_input` for the dogfood session once the held terminal stream is attached.
- Assumption: the live harness's `terminalRendererInput` path is a valid proxy for user typing through the mounted Restty renderer because it enters Restty as `source: "key"` and should flow through the renderer's PTY transport.
- Assumption: a successful fix should keep exactly one active mounted terminal data-plane binding for the selected session after refresh and explicit Attach.
- Assumption: the bridge should record `daemon_request` events for real `send_input` requests, so absence of that event after renderer input points to browser-side attach/input routing, not hub echo behavior.
- Unknown: whether `Restty.sendInput(data, "key")` invokes the same input path after reconnect/reattach as a real keyboard event. If not, the harness should switch to a Playwright keyboard/user-event path or expose a renderer API that exercises the same mounted callback path more faithfully.
- Unknown: whether `DefaultTerminalViewBridge.attach()` idempotency or `RealHubTerminalDataPlane.ensureAttached()` state can leave Restty connected while `dataPlane` is absent after refresh/Attach.
- Unknown: whether the held `/terminal` stream can be closed or detached by listener cleanup before the echo probe, causing `send_input` to hang or be dropped.
- Unknown: whether the prior Verify failure's hub/core binaries were stale relative to the web DTOs. Implementation should capture `status` compatibility/schema diagnostics before assigning ownership.

## Affected Surfaces And Files

- `scripts/live-packaged-protocol-harness.mjs`: primary reproduction and acceptance path; likely place for sharper diagnostics around renderer input, daemon request count, harness terminal events, and any target split.
- `src/botster/resttyRenderer.ts`: renderer callback path from harness/Restty key input into `BotsterTerminalPtyTransport.sendInput()`; likely touch if mounted renderer input is not reaching the data plane.
- `src/botster/terminal.ts`: `DefaultTerminalViewBridge.attach()` / `detach()` idempotency and listener lifecycle; likely touch if same-session refresh/Attach drops or duplicates input subscriptions.
- `src/botster/realHubTerminalDataPlane.ts`: daemon `send_input`, attach state, stream lifecycle, and detach behavior; likely touch if `writeInput()` sees no active stream/data-plane after attach or if detach semantics are over-eager.
- `src/botster/TerminalViewHost.tsx` and `src/App.tsx`: only touch if the production entry point is mounting, selecting, or reattaching the terminal in a way that unwires the data plane before echo.
- `scripts/real-hub-dogfood-bridge.mjs` and `src/botster/realHubDogfoodTransport.ts`: only touch if evidence shows request/event recording, held stream behavior, or dogfood command echo handling is the actual failure point.
- `src/App.test.mjs`: add or update deterministic tests that exercise the mounted renderer callback path and prove one `send_input`, not just direct DTO/helper calls.
- `README.md` and possibly `docs/architecture.md`: update only if command semantics are deliberately split or diagnostics/ownership guidance changes.

## Risks

- The implementation could make a direct `writeInput()` helper pass while the mounted Restty callback path still times out. Tests and live evidence must enter through the renderer path.
- The fix could hide a hub/core runtime regression by retrying, swallowing errors, or treating missing echo as surface-only success. If bridge/hub receives `send_input`, ownership must be decided from runtime evidence.
- Same-session attach idempotency can accidentally suppress legitimate detach/session-switch cleanup. Any lifecycle change needs same-session and different-session coverage.
- Extra instrumentation can become permanent noise in the harness state. Keep durable diagnostics focused on failure localization and useful for future live-smoke failures.
- Live smoke can fail from missing Playwright Chromium, missing hub/session-worker binaries, stale hub-client schema, or incompatible local binaries. The final evidence must classify those separately from the terminal echo regression.
- Checklist persistence is currently unreliable; gate artifacts must include the workflow checklist evidence fallback directly.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- `npm run lint` and `npm run typecheck` if implementation touches TypeScript/React behavior beyond harness-only diagnostics.
- Canonical live command with current compatible local binaries:

```sh
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

- Live proof must show the compiled packaged UI path reaches real hub mode, lists packages/sessions, spawns or attaches `botster-web-dogfood-session`, renders `botster-web-dogfood-ready`, dispatches the echo probe through the mounted renderer callback path, records exactly one daemon `send_input` for that probe, renders `botster-web-dogfood-echo:<probe>`, then continues through resize, process-exit, exited row, and cleanup.
- Deterministic tests should prove:
  - renderer callback input reaches the attached real-hub data-plane abstraction;
  - repeated same-session attach/refresh does not create duplicate input subscriptions or drop the active data plane;
  - one renderer-input probe creates one daemon `send_input` request;
  - direct `writeInput()` helper coverage remains secondary and cannot be the only echo proof;
  - boundary guards still reject private terminal frame names in web protocol files.
- If split targets are chosen, acceptance requires precise target names, README documentation, and one live target that still proves terminal echo end-to-end. Surface-only success alone is not acceptable.
- If hub/core ownership is proven, acceptance for this repo becomes a registered dependency ticket with exact localization evidence: last successful browser/bridge event, daemon request payload, hub response/event status, compatibility/schema details, and why web should not patch around it.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should include this artifact path, loaded vault note titles, no convention conflicts, checklist timeout fallback, and the current runtime-chain finding.
- Implement gate should include the committed diff, production-entrypoint explanation from `App`/`TerminalViewHost` through `ResttyTerminalRenderer` and `RealHubTerminalDataPlane`, command results, live smoke evidence, and any dependency ticket if ownership leaves `botster-web`.
- Plan Review should reject fixture-only echo proof, direct-helper-only input proof, source-only evidence, private protocol additions, silent smoke waivers, or any plan that cannot identify where the actual runtime/user path changes.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation establishes a reusable rule for exercising Restty mounted input from Playwright in live browser harnesses.
- Capture a durable note if same-session attach/input idempotency needs a cross-client convention distinct from explicit detach and session switch.
- Capture a durable note if hub/core accepts `send_input` but lacks deterministic shell echo behavior for packaged terminal smoke.
- No convention conflict was found during planning; the plan follows the loaded Botster SPA/data-plane notes and keeps changes scoped to `botster-web` unless evidence proves an owning-runtime dependency.
