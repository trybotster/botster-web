# Real Hub Dogfood Path Plan

## Context Loaded

- Pipeline context: ticket `ticket_1781026823_669113`, run `run_1781026833_311855`, step `botster_plan`, gate `botster_plan_gate`, no prior artifacts, findings, questions, or answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Vault architecture context: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[plan steps need reviewable plan artifacts]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[botster hub client crate is the external client boundary]], [[botster dev harnesses must drive real engine types]].
- Runtime constraints from vault: browser and TUI are equal clients; same-device clients consume the hub-owned client protocol; terminal attach uses hub/client-worker/session-io subscription paths, not private session-worker frames; Restty is renderer-only; entity frames and semantic actions are the shared dynamic UI model.
- Repo context inspected: `src/App.tsx`, `src/botster/client.ts`, `src/botster/protocol.ts`, `src/botster/localDogfoodTransport.ts`, `src/botster/entities.ts`, `src/botster/actions.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `src/App.test.mjs`, `README.md`, `docs/architecture.md`, existing `docs/plans/*`, `package.json`, and `vite.config.ts`.
- Existing state: the visible production path constructs `createBotsterWebClient()` in `src/App.tsx`, but it connects to `createLocalDogfoodTransport()` and `TerminalViewHost` defaults to `MockTerminalDataPlane`. README and architecture docs explicitly say there is no live browser-to-local-daemon transport.
- Hub-side context sampled from current Botster hub worktrees: `HubClientApi` and `hub_local_dogfood_test.rs` already prove status/list, package lifecycle, spawn, attach, terminal output drain, input, resize, shutdown, and isolated data-dir startup through authoritative hub client APIs.
- Checklist evidence: `project_pipelines_create_vault_checklist` timed out twice. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], this plan and the gate evidence carry the vault notes read, conflict check, verification plan, and capture decision.

## Scope

- Replace the current first-screen default from local-only fixture dogfood to an opt-in real isolated hub dogfood path for tests/dev, while keeping the fixture transport only as a deterministic fallback for unit-level renderer tests.
- Add a narrow `botster-web` same-device dev/test hub bridge that uses the authoritative local hub client shape exposed by `botster-hub-client` rather than creating browser-only frame names.
- The bridge must carry `botster-hub-client` daemon DTOs verbatim as JSON, specifically `DaemonRequest`, `DaemonResponse`, and streamed `DaemonEvent` shapes. Any browser-reachable wrapper may only add transport metadata such as request correlation or WebSocket message type; it must not rename, reinterpret, or replace the daemon DTO payload.
- Keep the browser transport injected through `createBotsterWebClient()` so the production entry point proves the same path the tests exercise: connect, subscribe/status, list/session state, spawn/action, attach/drain terminal output, input where supported, error state, and teardown.
- Map hub client responses/events into the existing shared `ui_tree_snapshot`, entity frame store, semantic `action_request` / `action_result`, and `TerminalDataPlaneAttachment` seams.
- Surface real validation/operator errors as UI state through entity frames or action results, not ad hoc DOM-only state.
- Add reproducible docs and scripts for an isolated local hub run using explicit temporary data dirs and neutral ids.
- Preserve Ionic shell and desktop layout, and continue to use Restty through `TerminalViewHost` / `TerminalViewBridge`.

## Non-Scope

- No edits to botster-hub, botster-core, botster-tui, or session-worker code from this branch.
- No private terminal byte frames in `HubControlFrame`; terminal bytes stay behind a terminal data-plane adapter.
- No cloud, Rails, ActionCable, WebRTC signaling, device identity mutation, or real user Botster home state.
- The same-device dev/test bridge is not the authoritative production browser transport. Production browser/TUI parity over the WebRTC browser data plane remains future work; this ticket dogfoods the shared hub client contract against an isolated local hub without claiming to ship production WebRTC.
- No broad redesign of UiNode, entity store, action dispatcher, or terminal bridge.
- No replacing Ionic or Restty.
- No new global state library, speculative protocol abstraction layer, or dependency upgrade unless the existing stack cannot run the bridge. If a dependency changes, verify the latest version first.

## Assumptions And Unknowns

- Assumption: the authoritative local hub client path is available to the implementer as an installed `botster-hub` binary or via a sibling checkout built before running dogfood commands.
- Assumption: because browsers cannot speak Unix sockets directly, a dev/test bridge process is acceptable if it is documented as a local harness and translates only to the authoritative hub client API.
- Assumption: local hub state must use explicit temp data dirs and neutral fixture ids; it must not read or mutate the user's real Botster identity or durable home state.
- Assumption: current UI concepts are sufficient: sessions can be represented as entity records, spawn/rename/error flows as semantic actions/results, and terminal output through `TerminalDataPlaneAttachment`.
- Assumption: the bridge runtime can be a local Node/Vite middleware or sidecar process, but its payload contract is fixed: pass through `botster-hub-client` `DaemonRequest` / `DaemonResponse` / `DaemonEvent` JSON and translate only at the existing browser adapter seam where those daemon DTOs become entity frames, action results, and terminal data-plane events.
- Assumption: real mode is explicitly enabled by both a dev environment variable and a URL opt-in: `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` makes the real-hub branch available in the dev bundle, and `?dogfood=real-hub` selects it at runtime. Without both, `src/App.tsx` must stay on the local fixture path to avoid accidental hub mutation.
- Unknown: exact CLI or daemon transport command names available in the Botster hub version used by this run. This uncertainty is limited to how the bridge obtains/sends authoritative daemon DTOs, not what the browser-facing payload shape is.
- Unknown: whether real terminal input can be supported in browser automation through the bridge without flakiness. If not, document input as a reproducible local command and keep automated coverage for bridge-level `writeInput`.
- Unknown: whether full browser automation is available in this repo without adding a test runner. If not, executable node-level tests must still drive the real-mode transport/data-plane selection helper, and the full browser round trip must be documented as a reproducible local command.

## Affected Surfaces And Files

- `src/App.tsx`: select real mode only when `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub` are both present; otherwise retain deterministic local fixture fallback for ordinary dev/test.
- New `src/botster/dogfoodMode.ts` or similar: pure selection helper that chooses fixture vs real-hub transport and terminal data-plane descriptors. This helper must be executable from `src/App.test.mjs` so real-mode wiring is not proven by source inspection alone.
- `src/botster/client.ts` and `src/botster/protocol.ts`: keep existing Botster web ingestion frames narrow. Do not add a second web-only daemon protocol; daemon DTO typing belongs in the bridge/client adapter module.
- New `src/botster/realHubDogfoodTransport.ts` or similar: browser-side adapter that sends and receives verbatim `DaemonRequest`, `DaemonResponse`, and `DaemonEvent` JSON through the bridge, then maps authoritative daemon responses into existing entity/action/UI seams.
- New `src/botster/realHubTerminalDataPlane.ts` or similar: `TerminalDataPlaneAttachment` adapter backed by authoritative attach, drain, input, and resize daemon DTOs.
- `src/botster/localDogfoodTransport.ts`: keep as fixture fallback; do not let it masquerade as real hub evidence.
- `src/botster/TerminalViewHost.tsx`: accept a real session descriptor/data-plane from app state instead of always using `MockTerminalDataPlane`.
- `src/App.test.mjs`: add behavior assertions for real-hub transport mapping and keep existing deterministic fixture/renderer checks.
- New `scripts/` or `test/` harness file: isolated local hub dogfood runner/bridge using explicit data dir, neutral session ids, startup/teardown, no HOME/XDG mutation, and real `botster-hub-client` daemon DTOs at the process boundary.
- `package.json`: add narrowly named scripts such as `dogfood:hub` or `test:hub-dogfood` if useful.
- `README.md` and `docs/architecture.md`: replace "no live local daemon transport" language with exact real-vs-fixture mode documentation and reproducible commands.
- `docs/plans/real-hub-dogfood-path.md`: this plan artifact.

## Implementation Shape

- First inspect the current hub client command/protocol source before coding. Use the `botster-hub-client` crate as the source of truth for `DaemonRequest`, `DaemonResponse`, `DaemonEvent`, handshake helpers, one-shot request helpers, and `stream_attach`.
- The bridge payload rule is strict: browser-to-bridge sends a JSON serialization of a `DaemonRequest`; bridge-to-browser returns JSON serialization of `DaemonResponse` for request/response operations or `DaemonEvent` for stream/drain operations. A wrapper may identify message kind for WebSocket/HTTP delivery, but the embedded daemon DTO must remain authoritative and verbatim.
- Build an isolated harness around the same operations proven by hub dogfood tests:
  - start hub with explicit data dir and no ambient identity mutation;
  - status/list;
  - spawn a neutral shell command that prints a ready marker and echoes input;
  - attach a subscription;
  - drain terminal output until marker;
  - send input if supported by the selected transport;
  - surface a deliberate invalid action/operator error;
  - resize;
  - shutdown and remove temp runtime state.
- Have the browser-side transport call the bridge with daemon DTOs and normalize responses into existing `HubControlFrame` ingestion only after the authoritative daemon response has crossed the bridge. The normalizer is a browser adapter, not a protocol definition.
- Have terminal output flow into `TerminalViewHost` by constructing a real `TerminalDataPlaneAttachment` for the spawned session. Restty remains renderer-only.
- Extract real-mode selection from `src/App.tsx` into a pure function so `src/App.test.mjs` can instantiate both branches and assert that real mode uses the real hub transport plus real terminal data-plane descriptor when `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub` are present.
- Keep UI changes minimal: the first viewport should show a clear desktop workbench with status/list, active session row, action/result/error state, and terminal panel.

## Risks

- Accidentally continuing to prove only `createLocalDogfoodTransport()` would miss the ticket. Tests and docs must name the real isolated hub evidence separately from fixture tests.
- A bridge can become a private protocol if it invents durable Botster semantics. Prevent that by passing `DaemonRequest` / `DaemonResponse` / `DaemonEvent` payloads verbatim and keeping wrapper metadata transport-only.
- The dev/test bridge can be mistaken for production browser transport. Docs and architecture text must state that WebRTC production browser transport remains out of scope.
- Browser terminal bytes can leak into control frames. Tests should keep `terminal_input`, `terminal_output`, `pty_bytes`, and similar names out of `protocol.ts`.
- Hub process cleanup can be flaky. Harness must always attempt shutdown/teardown and use unique temp dirs.
- Bridge and hub process concurrency can be flaky. Harness startup must use deterministic port/path allocation, fail fast when the bridge is unavailable, and clean up any child process it starts.
- Real hub commands may be unavailable in a clean botster-web checkout. Docs must state the required `BOTSTER_HUB_BIN` or sibling checkout setup.
- Path or identity leaks in docs/test output. Use neutral ids and scrub absolute user paths from assertions and plan docs.

## Acceptance Checks And Tests

- `npm test`: keep current runtime/entity/action/renderer tests and add node-executable tests for:
  - real-mode selection: with `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub`, the app wiring helper returns the real hub transport and real terminal data-plane descriptor;
  - fixture fallback: without both opt-ins, the helper returns `createLocalDogfoodTransport()` and mock terminal data;
  - bridge mapping: adapter input/output fixtures use verbatim `DaemonRequest`, `DaemonResponse`, and `DaemonEvent` JSON shapes, then map into entity frames, action results, and terminal data-plane callbacks;
  - boundary protection: no terminal byte frame names are added to `protocol.ts`.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Real isolated hub command, automated when the required hub binary is available and otherwise documented/manual with exact prerequisites:
  - run a hub dogfood script with explicit temp data dir and neutral ids;
  - prove status/list returns hub state;
  - spawn a shell session;
  - attach and drain output containing a known marker;
  - send input and observe echoed marker where supported;
  - trigger and display an invalid action/operator error;
  - resize and teardown/shutdown.
- Runtime path proof:
  - automated node tests must drive the extracted app wiring helper for both fixture and real modes;
  - `src/App.tsx` must use that helper to construct `createBotsterWebClient()` with the real hub dogfood transport when both opt-ins are present;
  - `TerminalViewHost` must receive the spawned session data-plane from that helper instead of the mock path in real mode;
  - the full browser round trip may be documented-manual if the repo still lacks browser automation, but it must include exact commands and expected markers so Verify can rerun it;
  - fixture-only mode remains explicitly labeled as fallback and is not used as acceptance evidence.
- Boundary checks:
  - web code consumes entity frames, semantic action results, and terminal data-plane adapters;
  - no hardcoded one-off demo state in the real mode;
  - no private hub/core protocol copy, PII, cloud dependency, or mutation of real Botster identity.

## Pipeline Gates And Artifacts

- Gate evidence should point to this plan document and include the checklist timeout fallback.
- Plan Review should check that the implementer did not choose a silent fixture fallback for any required real hub acceptance item.
- Implement should attach exact command output for the real isolated hub round trip, not just source-code assertions.
- Verify should rerun the real hub command or document the exact missing external binary if the environment cannot provide it.

## Plan Review Response

- `finding_1781027272_854337`: addressed by making `botster-hub-client` `DaemonRequest` / `DaemonResponse` / `DaemonEvent` JSON passthrough mandatory for the browser bridge and citing [[botster hub client crate is the external client boundary]] plus [[botster dev harnesses must drive real engine types]].
- `finding_1781027272_281429`: addressed by requiring a node-executable app wiring helper test for real-mode transport and terminal data-plane selection, with the full browser round trip explicitly documented-manual unless browser automation is added.
- `finding_1781027272_658443`: addressed by choosing the explicit opt-in mechanism: `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` plus `?dogfood=real-hub`, defaulting off.
- `finding_1781027272_717548`: addressed by stating the bridge is a same-device dev/test harness and not the production WebRTC browser transport.

## Vault Gaps Worth Capturing

- Capture a new vault note if implementation discovers the stable `botster-web` convention for browser-to-local-hub dev harnesses.
- Capture a note if the hub client API exposes a browser-consumable transport rule that should constrain future web/TUI parity work.
- No new durable convention is needed from planning itself; existing vault notes covered the main boundaries.
