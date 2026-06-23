# Renderable snapshot and scrollback payloads plan

## Context Loaded

- Pipeline context: ticket `ticket_1781288588_787592`, run `run_1781288598_758676`, active step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, open questions, or answers.
- Ticket dependency context: follow-up to merged botster-hub ticket `ticket_1781191117_149624`; the hub daemon/client protocol now exposes renderable terminal history payloads for `Snapshot` and `Scrollback` events as `data`, matching `terminal_output.data`.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Botster overlay notes loaded: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific notes loaded: [[botster web dto field names must match authoritative rust serde structs]], [[botster terminal clients share one sessionio data plane subscription path]], [[botster hub smoke cli entrypoints stay thin explicit and facade backed]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `README.md`, `docs/plans/real-web-session-attach-input-flow.md`, `docs/plans/botster-web-conformance-regression-suite.md`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `scripts/real-hub-dogfood-bridge.mjs`, and `scripts/live-packaged-protocol-harness.mjs`.
- Current repo finding: `DaemonEvent` models `snapshot` and `scrollback` as byte-count-only events, while `RealHubTerminalDataPlane.emitTerminalEvent()` renders only `terminal_output.data`. This exactly matches the ticket gap.
- Botster layers touched: React/Ionic SPA terminal data-plane adapter, browser DTO mirror for real-hub daemon events, deterministic frontend tests, packaged real-hub protocol harness. Hub/core/session-worker code should remain unchanged unless the merged hub contract cannot be observed.
- Worktree/target assumptions: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and the assigned run worktree. Implementation must stay in this botster-web worktree, not an ambient Botster checkout.

## Scope

- Update the browser daemon DTO mirror so `snapshot` and `scrollback` events accept optional renderable `data` in addition to legacy `bytes`.
- Update `RealHubTerminalDataPlane` so `snapshot.data` and `scrollback.data` are emitted to terminal listeners through the same `TerminalDataPlaneAttachment` output path as live `terminal_output.data`.
- Preserve data-plane ordering exactly as delivered by the held terminal stream: historical `snapshot`/`scrollback` payloads from attach/drain must be rendered before later live `terminal_output` events when the stream delivers them in that order.
- Keep honest fallback behavior for older hubs: byte-count-only or no-data snapshot/scrollback events should not crash and should continue to rely on existing live-only / terminal-unavailable diagnostics rather than pretending history was restored.
- Extend deterministic tests to cover DTO parsing/shape, historical payload import/rendering, event ordering, byte-count-only fallback, and the post-refresh explicit Attach path.
- Extend the live packaged protocol harness so it proves refresh -> explicit Attach to an existing `botster-web-dogfood-session` -> historical output render from `snapshot.data` or `scrollback.data` when the merged hub provides it, then live input echo.
- Keep existing spawn -> attach behavior and post-refresh explicit Attach wiring intact.

## Non-Scope

- No botster-hub, botster-core, session-worker, TUI, WebRTC, or daemon protocol redesign unless the implementation proves a concrete mismatch with the merged hub serde shape.
- No private web-only terminal byte/control frames in `src/botster/protocol.ts`; terminal history stays behind `TerminalDataPlaneAttachment`.
- No Restty renderer replacement, terminal cache redesign, UI redesign, package registry change, or adjacent cleanup.
- No invented DTO fields. New browser DTO names must match the merged hub protocol shape: `snapshot.data` and `scrollback.data`.
- No removal of byte-count-only compatibility for older hubs.

## Assumptions And Unknowns

- Assumption: the merged hub serializes history events as `type: "snapshot" | "scrollback"`, `session_id`, `subscription_id`, optional `bytes`, and optional `data`.
- Assumption: renderable history `data` is already VT/string-compatible with the existing Restty `write(data)` path used for `terminal_output.data`; if the hub emits a different encoding, implementation must surface the exact mismatch instead of adapting blindly.
- Assumption: the bridge SSE path in `scripts/real-hub-dogfood-bridge.mjs` already forwards daemon events verbatim, so no bridge change is required beyond harness assertions.
- Unknown: whether the current local live hub binary available to implement/verify emits `snapshot.data` or `scrollback.data` deterministically after refresh/Attach. If it does not, deterministic tests must still prove the browser behavior and the live harness must record exact no-data fallback evidence.
- Unknown: whether attach/drain can force `snapshot`/`scrollback` variants in the merged hub. Existing vault context says older public Attach/Drain did not reliably force those variants; the harness should accept either snapshot or scrollback with `data` as historical proof, and document byte-count-only fallback when necessary.

## Affected Surfaces And Files

- `src/botster/realHubDaemonDto.ts`: add optional `data?: string` to `snapshot`/`scrollback` event DTOs while preserving optional or existing `bytes` compatibility.
- `src/botster/realHubTerminalDataPlane.ts`: route matching `snapshot.data` and `scrollback.data` through the terminal output listener path; keep session/subscription filtering; record harness terminal output in a way that can distinguish historical source if useful for tests.
- `src/App.test.mjs`: add deterministic coverage for snapshot/scrollback `data`, ordering before live output, byte-count-only fallback, and no terminal byte frames in control-plane protocol files.
- `scripts/live-packaged-protocol-harness.mjs`: add the refresh + explicit Attach historical-output assertion before the live echo assertion; retain spawn -> attach and send-input echo checks.
- `scripts/real-hub-dogfood-bridge.mjs`: expected unchanged unless implementation finds the bridge parses or drops new event fields. Current code forwards event JSON verbatim.
- `README.md` or `docs/architecture.md`: only update if implementation changes documented live-hub dogfood behavior or diagnostics text.

## Risks

- DTO drift: tests can pass against synthetic browser fixtures while production reads undefined. Mitigation: mirror the merged hub field names exactly and, if possible, use observed live protocol JSON in harness evidence.
- Ordering regression: historical payloads could be rendered after live output if the data plane buffers or filters event types separately. Mitigation: one ordered `emitTerminalEvent()` path and a test that sends `snapshot`/`scrollback` before `terminal_output`.
- False historical success: byte-count-only events could be treated as restored history. Mitigation: tests must assert no output is emitted for snapshot/scrollback events without `data`.
- Spawn path regression: changing terminal event handling could accidentally break live `terminal_output`, input, resize, or detach. Mitigation: preserve existing tests and harness assertions for live output, echo, resize, process exit, and cleanup.
- Live harness nondeterminism: real hubs may deliver history as `terminal_output`, `snapshot`, `scrollback`, or byte-count-only depending on the session state and hub version. Mitigation: harness should prove the new payload when available and report exact fallback evidence when not.
- Pipeline checklist risk: `project_pipelines_create_vault_checklist` timed out during planning. Following [[project pipelines checklist worker timeouts require artifact evidence fallback]], checklist provenance is preserved in this plan, the artifact, and gate evidence.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- `npm run smoke:live-packaged-protocol` with compatible merged `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN`, or exact documented unavailable-binary / no-data fallback evidence.
- Deterministic coverage should prove:
  - `DaemonEvent` accepts `snapshot.data` and `scrollback.data`;
  - matching snapshot/scrollback data emits to terminal listeners;
  - historical snapshot/scrollback data renders before later live `terminal_output` data when delivered first;
  - byte-count-only snapshot/scrollback events emit no fake restored output and do not crash;
  - session/subscription mismatches are still ignored;
  - existing spawn -> attach, input, resize, detach, and terminal-unavailable paths still pass.
- Live harness success criteria:
  - packaged UI starts against real hub mode;
  - spawn -> attach still renders `botster-web-dogfood-ready`;
  - browser refresh followed by explicit Attach to existing `botster-web-dogfood-session` renders historical output from `snapshot.data` or `scrollback.data` when available;
  - sending input after attach reaches the session and renders the echo;
  - older/no-data history events produce honest fallback evidence without crashing.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should include the loaded context, scope/non-scope, assumptions/unknowns, affected files, risks, checks, vault gaps, and the checklist timeout fallback.
- Implement gate should include the committed diff, production-entrypoint explanation showing `RealHubTerminalDataPlane` consumes snapshot/scrollback data from the live stream, `npm test`, `npm run build`, and live packaged protocol evidence or exact fallback evidence.
- Plan Review should reject fixture-only proof, invented DTO fields, any terminal byte frames added to `protocol.ts`, or a change that handles DTOs without wiring them into the `TerminalViewHost` runtime path.

## Vault Gaps Worth Capturing

- Capture if the merged hub history payload has a durable encoding rule beyond plain renderable string `data`.
- Capture if live attach/drain cannot deterministically produce `snapshot.data` or `scrollback.data`, because future browser/hub conformance needs a stable history-trigger fixture.
- Capture if botster-web needs a reusable diagnostic distinction between "hub sent history metadata only" and "hub sent renderable history data."
- No new durable knowledge was discovered during planning alone beyond the current ticket-specific application of existing DTO/data-plane rules.
