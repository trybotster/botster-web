# Renderable terminal scrollback after refresh attach

## Context Loaded

- Project Pipelines context: ticket `ticket_1781156844_743531`, run `run_1781190539_293888`, active step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, open questions, or prior answers.
- Dependency context: closed dependency `ticket_1781152255_334155` ("Make web Attach work for existing sessions after browser refresh").
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific vault constraints: [[botster web dto field names must match authoritative rust serde structs]], [[botster initial terminal scrollback is delivered by sessionio directly to clientworker]], [[browser-terminal-initial-snapshot-can-arrive-before-transport-listeners]], [[terminal subscribe readiness gates on sessionio initial snapshot delivery]], [[initial terminal snapshots must precede live output activation]], [[per request http sockets cause immediate terminal subscription detach]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `scripts/real-hub-dogfood-bridge.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.test.mjs`, and prior `docs/plans/*`.
- Current runtime shape: the packaged bridge has a held `/terminal` SSE stream that sends daemon `attach`, repeated `drain`, and SSE `daemon_event` frames. The browser data plane currently renders only `terminal_output` events and ignores `snapshot`, `scrollback`, and `attach_state` except as live harness events. The checked-in DTO represents `snapshot` and `scrollback` as byte-count-only events.
- Checklist evidence: `project_pipelines_create_vault_checklist` timed out with `plugin worker invoke timeout`; per [[project pipelines checklist worker timeouts require artifact evidence fallback]], checklist provenance is preserved in this plan and gate evidence instead.

## Scope

- Work in `botster-web` only unless authoritative protocol evidence proves the real hub/client contract lacks a browser-renderable scrollback payload.
- First prove the current daemon/hub terminal event shape from the actual protocol source or live real-hub JSON. Do not infer DTO fields from names, byte counts, or desired UI behavior.
- If a renderable scrollback/snapshot payload exists, thread that exact payload through the bridge/browser DTO and into the terminal renderer path so refresh -> Attach on an existing running session restores historical terminal output before continuing live output.
- If the protocol exposes only byte counts today, implement an honest browser-side fallback that clearly records/reports historical scrollback unavailable while continuing live `terminal_output` rendering, and file a dependency ticket for the owning hub/core protocol change.
- Extend tests and live harness proof for refresh -> attach existing session -> historical scrollback behavior when supported, or for the live-only fallback plus dependency-ticket evidence when unsupported.

## Non-Scope

- No guessed browser DTO fields, synthetic payload names, or fixture-only protocol shape.
- No hub/core/session-worker edits in this repo. If protocol support is missing, stop at dependency-ticket evidence.
- No private web-only terminal byte frames in `src/botster/protocol.ts`.
- No Restty replacement, terminal architecture rewrite, broad UI redesign, package registry cleanup, or unrelated connection-diagnostics work.
- No weakening of existing spawn/attach/input/resize/live-output behavior.

## Botster Layers Touched

- React/Ionic SPA terminal path.
- Browser terminal data plane: `RealHubTerminalDataPlane`.
- Browser daemon DTO mirror: `realHubDaemonDto.ts`.
- Packaged real-hub dogfood bridge `/terminal` SSE adapter only if it already receives a renderable payload and is currently dropping it.
- Live packaged protocol harness and fast Node tests.
- Upstream hub/core protocol only as a dependency ticket if this repo cannot satisfy the expected behavior honestly.

## Assumptions And Unknowns

- Assumption: this run is correctly bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and the current assigned worktree.
- Assumption: the production path to prove is packaged real-hub dogfood, not local mock dogfood mode.
- Assumption: Restty can render restored history either through normal PTY text writes or an existing snapshot import API, but the import path must be compatible with browser runtime and current vendored Restty APIs.
- Unknown: whether current `botster-hub-client` `DaemonEvent` carries renderable scrollback bytes, binary snapshot data, an encoded payload, or only `{ bytes }` metadata for `snapshot`/`scrollback`.
- Unknown: whether the bridge receives a richer frame and collapses it before the browser, or whether the daemon socket itself only emits byte counts.
- Unknown: if binary snapshot support exists, whether it is intended to be delivered over SSE as encoded data or via a separate browser-safe import path.

## Affected Surfaces And Files

- `src/botster/realHubDaemonDto.ts`: update only to match authoritative serde JSON fields for any proven renderable snapshot/scrollback payload, or keep byte-count DTO and add explicit fallback types/status if no payload exists.
- `src/botster/realHubTerminalDataPlane.ts`: consume renderable historical data before/with live `terminal_output`, or emit/report historical-unavailable state while preserving live output.
- `src/botster/resttyRenderer.ts` and `src/botster/terminal.ts`: touch only if proven Restty snapshot import requires a renderer API beyond `write(data)`.
- `scripts/real-hub-dogfood-bridge.mjs`: preserve/pass through renderable daemon event payloads if current bridge parsing or SSE serialization drops them.
- `scripts/live-packaged-protocol-harness.mjs`: add refresh-after-output attach proof and assert historical scrollback render or honest unavailable status.
- `src/App.test.mjs`: add DTO/source guard and behavioral assertions for supported import or fallback.
- `README.md` / `docs/architecture.md`: update only if user-facing dogfood limitation or dependency-ticket status must be documented.

## Implementation Plan

1. Inspect the authoritative hub/client protocol for `DaemonRequest::Attach`, `Drain`, and terminal `DaemonEvent`/stream structs. Record the exact source path/commit or live JSON sample in the implementation report.
2. Run the packaged real-hub dogfood path to capture current refresh -> Attach event ordering: spawn session, produce output, refresh browser, click Attach, collect `attach_state`, `snapshot`, `scrollback`, `terminal_output`, and renderer-visible output.
3. Choose the narrow branch based on evidence:
   - Renderable payload branch: mirror the exact DTO fields, pass them through the bridge, and feed the browser renderer using the documented Restty/browser-compatible import path or PTY text write path.
   - Byte-count-only branch: do not fabricate fields; add an explicit live-only/historical-unavailable status/diagnostic and file a dependency ticket for hub/core protocol support.
4. Preserve terminal ordering: historical snapshot/scrollback must be applied before later live bytes can overwrite or duplicate state, and existing live output rendering must continue.
5. Extend fast tests for DTO mapping and data-plane behavior, then extend the live harness to prove the production entry point after browser refresh.

## Risks

- The largest risk is DTO drift: browser fixtures could pass while production JSON has different field names. All new fields must be checked against authoritative Rust serde structs or observed real JSON.
- SSE may be the wrong carrier for large/binary snapshots if the real protocol expects another import path. Do not invent chunking or encoding if the protocol does not define it.
- Applying historical bytes after live output can duplicate or scramble terminal state. Tests should assert ordering around snapshot/scrollback before live continuation.
- A fallback status can become a permanent product dodge if no dependency ticket is filed when protocol support is missing.
- Live dogfood verification depends on compatible local hub/session-worker binaries; if unavailable, implementer must document the exact missing prerequisite and still run deterministic tests.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- Prefer also `npm run typecheck` and `npm run lint` because this repo exposes them and the touched files are TypeScript.
- `npm run smoke:live-packaged-protocol` with real hub configuration extended to cover: spawn output, browser refresh, Attach existing running session, historical scrollback render if supported, continued live `terminal_output`, input echo, resize proof, and clean exit.
- If byte-count-only is the real protocol state, acceptance requires: visible/recorded live-only fallback, continued live output after attach, dependency ticket id/link in the implementation report, and tests proving no guessed renderable DTO fields were added.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should reference this file and the loaded vault notes by wiki link titles.
- Implement gate must include the authoritative protocol evidence, changed production entry path, command results, and either live historical render proof or dependency-ticket fallback proof.
- Plan Review should reject fixture-only scrollback proof, source-only evidence, private terminal frame additions, guessed DTO fields, or any implementation that renders live output while silently dropping known-unavailable history.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation establishes the browser-renderable terminal snapshot/scrollback contract and import path.
- Capture a note if the current hub protocol only exposes byte counts so future botster-web tickets do not rediscover the same boundary.
- Capture a note if SSE is confirmed unsuitable for renderable snapshot delivery and a separate browser import path is required.
- No new durable convention was discovered during planning beyond the already-loaded DTO/protocol and checklist-timeout rules.
