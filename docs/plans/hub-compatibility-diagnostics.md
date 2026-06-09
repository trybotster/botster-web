# botster-web hub compatibility diagnostics plan

## Context loaded

- Pipeline context: `ticket_1781046396_204094`, `run_1781046402_128628`, returned to step `botster_plan` after Plan Review `review_1781046794_468804`; four open findings were loaded and addressed in this revision.
- Required planner notes: [[planner-playbook]] and [[botster-planner-playbook]].
- Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Compatibility and diagnostics notes: [[botster hub client crate is the external client boundary]], [[botster hub client compatibility descriptors belong in client crate]], [[connection diagnostics derive from distinguishable runtime signals]], [[per request http sockets cause immediate terminal subscription detach]], [[runtime client acceptance must render delivered snapshots through real registry]], [[botster-web ionic supersedes catalyst for client shell]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/connectionDiagnostics.ts`, `src/botster/ConnectionDiagnosticsPanel.tsx`, `scripts/real-hub-dogfood-bridge.mjs`, and prior plans under `docs/plans/`.
- Project Pipelines checklist: `checklist_1781046454_153988`. Creation returned a plugin worker timeout, but the checklist persisted and was updated.
- Plan Review changes addressed: reachable-signal gate before rendering mismatch/capability states, NotRunning/absent-hub negative test, capability ownership rule, and exact App.tsx runtime invocation/test requirement.

## Scope

- Make the first implementation step a reachable-signal audit:
  - inspect current `botster-hub-client` daemon DTO/docs or real bridge status output available to this repo;
  - enumerate which compatibility signals are actually reachable today through botster-web's same-device bridge path;
  - treat `DaemonStatus.schema_version` as currently reachable;
  - only treat protocol-version descriptors or daemon-advertised capability descriptors as live diagnostics if the audit proves they are emitted by the current hub/client contract.
- Update botster-web's real-hub bridge/client DTO subset to accept hub compatibility/status diagnostics emitted by the real daemon where available, especially descriptor fields exposed through hello/status by the public `botster-hub-client` contract.
- Convert reachable real hub status/compatibility data into visible connection diagnostics for:
  - compatible daemon descriptor/status;
  - schema mismatch from `DaemonStatus.schema_version`;
  - protocol or descriptor mismatch only when a real descriptor field is observed;
  - missing required capability only when a real daemon-advertised capability field is observed;
  - terminal unavailable;
  - bridge unavailable;
  - disconnected control or terminal stream.
- For protocol/capability states without a reachable current signal, render only an honest descriptor-unavailable warning or document the exact missing field; do not ship those states as live mismatch/capability diagnostics. If keeping a parser/branch for a future field, label it forward-compat and test that current NotRunning/absent-hub paths do not trigger it.
- Preserve the existing diagnostics panel as the display surface, but make rows actionable: the detail text should name the mismatched protocol/version/capability or the missing descriptor field when hub data is insufficient.
- Preserve current ownership boundaries:
  - Ionic remains the app shell.
  - UiNode/entity/action frames remain the structured UI path.
  - Restty remains terminal renderer only.
  - Terminal stream lifecycle stays in `RealHubTerminalDataPlane` and held-open `/terminal` bridge behavior.
- Extend tests with mocked bridge responses that prove compatibility success and mismatch rendering through the production `ConnectionDiagnosticsPanel`/runtime path, not only string presence in source.
- Add or update docs only where the new user-visible real-hub compatibility diagnostics need local operator guidance.

## Non-scope

- No edits to `botster-hub`, `botster-core`, TUI, Rust client crates, or daemon protocol implementation in this branch.
- No invented private web-only compatibility protocol. If the hub response lacks a field botster-web needs, document the exact missing field in the plan/README/test fixture comments and render an honest "descriptor unavailable" diagnostic rather than fabricating compatibility certainty.
- No live UI arm for protocol mismatch or missing capability unless the reachability audit proves a current hub signal can produce it. Unreachable states may only be documented as missing fields or explicitly labeled forward-compat code paths.
- No broad UI redesign, state-library change, dependency churn, Ionic replacement, Restty replacement, or terminal ownership change.
- No mutation of the user's real Botster identity or real Botster home state; live dogfood must stay isolated through the existing explicit bridge/temp data-dir flow.

## Assumptions and unknowns

- Assumption: the current `scripts/real-hub-dogfood-bridge.mjs` remains the intended same-device local dogfood bridge for botster-web and should pass through authoritative daemon DTO fields rather than normalize them away.
- Assumption: compatibility descriptor data, if present in the running hub version, will appear on daemon hello/status surfaces controlled by `botster-hub-client`; botster-web should consume those fields additively in `DaemonStatus` or an adjacent status field only after proving their serialized shape.
- Assumption: `DaemonStatus.schema_version` is the only compatibility signal already proven reachable from this repo's current DTO subset.
- Assumption: required capabilities, for this ticket, are daemon-advertised descriptor/status fields. botster-web must not invent a client-owned capability taxonomy from `connect(...capabilities: [])`; if the daemon does not advertise capabilities, the implementation records the missing field and renders descriptor-unavailable instead of missing-capability.
- Unknown: the exact serialized descriptor field names available in the current hub binary. Implementer must inspect real bridge/status output or existing DTO docs before naming fields. If unavailable, record the exact missing field instead of silently falling back to placeholder demo data.
- Unknown: whether current incompatible-hub/protocol errors still collapse to NotRunning/bridge-unavailable in the available hub-client path. If they do, compatibility mismatch must remain absent for that path.
- Unknown: whether live hub binaries are available in the implementer/verify environment. Mocked bridge tests are required either way; live dogfood evidence is required when binaries are present, otherwise record the exact missing prerequisite.

## Affected surfaces/files

- React SPA / app entry: in `src/App.tsx`, the existing `runtimeClient.hub.onFrame((frame) => { ... })` diagnostics subscriber inside the mount `useEffect` is the production invocation point for compatibility derivation. New compatibility diagnostics must be invoked from that frame-processing path, alongside `operatorErrorDiagnostic(frame)` and the current schema diagnostic call, so real-hub status frames drive visible UI.
- Diagnostics model/UI: `src/botster/connectionDiagnostics.ts`, `src/botster/ConnectionDiagnosticsPanel.tsx`.
- Real hub DTO/adapter seam: `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, and possibly `src/botster/dogfoodMode.ts`.
- Terminal stream diagnostics seam: `src/botster/realHubTerminalDataPlane.ts` only if terminal-unavailable/disconnected state needs a more specific runtime signal; keep stream cleanup behavior intact.
- Local bridge harness: `scripts/real-hub-dogfood-bridge.mjs` only if it currently drops compatibility/status fields returned by the daemon.
- Tests: `src/App.test.mjs`.
- Docs: `README.md` or `docs/architecture.md` only if operator-facing diagnostic behavior or architecture boundaries need updating.

## Botster layers touched

- React SPA / Ionic shell.
- Browser same-device bridge adapter.
- Browser terminal data-plane seam for diagnostics only.
- Tests/docs.

## Worktree and target assumptions

- This run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and workspace `botster-web hub compatibility diagnostics`.
- Implementer should work only in this ticket worktree and should not edit ambient Botster core/hub/TUI checkouts.

## Risks

- False compatibility diagnostics if implementation infers mismatch from generic request failures instead of descriptor/status evidence.
- Forward-compat branches for protocol/capability fields could become unreachable UI arms. Mitigation: reachability audit first; absent/NotRunning paths must assert mismatch rows are absent; unreachable fields are documented rather than rendered as live states.
- A fake compatibility fixture could make tests pass while real mode still renders placeholder demo diagnostics. Tests must drive `createDogfoodRuntimeConfig()` / `createBotsterWebClient()` with mocked real bridge responses and render the diagnostics panel output.
- Adding compatibility state to `HubControlFrame` as a private terminal or daemon protocol would violate the client boundary. Keep daemon DTO typing in the bridge/client adapter seam and map into existing entity/diagnostic UI state.
- Terminal diagnostics can regress stream lifetime if handled through per-request attach/drain calls. Preserve the held-open `streamTerminal()`/EventSource path and explicit cleanup assertions.
- Live hub output may lack the descriptor fields this ticket wants. The correct outcome is precise documentation of the missing field, not a fabricated private schema.

## Acceptance checks/tests

- `npm test`
  - starts with a reachable-signal assertion or fixture comment enumerating which current status fields are live; at minimum `schema_version` is live, and protocol/capability fields are live only if observed in the current hub-client contract;
  - mocked real bridge status with a compatible reachable status/descriptor renders a success compatibility diagnostic through the runtime path;
  - mocked real bridge status with reachable schema mismatch renders a danger diagnostic naming the actual mismatch;
  - mocked protocol descriptor mismatch renders a live mismatch diagnostic only if the reachability audit proves the field exists; otherwise the test asserts descriptor-unavailable/missing-field behavior instead;
  - mocked missing capability renders an actionable missing-capability diagnostic only if a daemon-advertised capability field exists; otherwise the test asserts descriptor-unavailable/missing-field behavior instead;
  - missing descriptor data renders an honest descriptor-unavailable warning, not a hardcoded demo-only success;
  - mocked bridge unavailable or NotRunning/absent-hub path asserts bridge-unavailable is present and compatibility-mismatch is absent;
  - bridge-unavailable, disconnected, terminal-unavailable, and action/operator-error tests remain distinct and do not co-fire from one catch path;
  - at least one compatibility diagnostic test pushes mocked real bridge status through `createDogfoodRuntimeConfig()` plus `createBotsterWebClient()`, lets the resulting frame flow through the same diagnostic function that `App.tsx` calls in its `runtimeClient.hub.onFrame` subscriber, and asserts rendered `ConnectionDiagnosticsPanel` output;
  - rendered diagnostics are asserted through `ConnectionDiagnosticsPanel` or the compiled runtime path, not direct diagnostic-function calls or source-string checks for the new behavior;
  - real-hub mode does not expose fixture-only session ids or mock terminal data.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Boundary guard: `src/botster/protocol.ts`, `src/botster/localDogfoodTransport.ts`, and `src/botster/realHubDogfoodTransport.ts` must still avoid private terminal byte frame names such as `terminal_input`, `terminal_output`, and `pty_bytes`.
- Live dogfood, when binaries are available:
  - run `npm run dogfood:hub` with explicit `BOTSTER_HUB_BIN` and, when needed, `BOTSTER_SESSION_WORKER_BIN`;
  - run `VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev`;
  - open `http://127.0.0.1:5173/?dogfood=real-hub`;
  - verify compatibility/capability diagnostics come from real hub status/descriptor data, terminal attach still uses the held stream, and no fixture-only diagnostics appear in real mode.

## Pipeline gates and artifacts

- Plan artifact: this file.
- Plan gate evidence should include this file, checklist evidence, loaded vault notes, assumptions above, and the production entry path through `src/App.tsx`.
- Implementation gate should include command outputs for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, plus live dogfood evidence or exact unavailable-binary evidence.
- Implementation handoff must include the reachable-signal audit result: fields observed, fields missing, and whether protocol mismatch/missing capability shipped as live diagnostics or documented missing fields.

## Vault gaps worth capturing

- Capture if implementation discovers the exact current serialized compatibility descriptor shape for same-device daemon status/hello in a way not already covered by [[botster hub client compatibility descriptors belong in client crate]].
- Capture if botster-web needs a reusable diagnostic taxonomy for missing capability versus protocol mismatch versus descriptor unavailable.
- Capture if the bridge currently drops descriptor fields, because that is a durable same-device client harness gotcha.
