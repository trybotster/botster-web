# Real web session attach and input flow plan

## Context Loaded

- Pipeline context: ticket `ticket_1781136782_390466`, run `run_1781148766_662582`, active step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, reviews, findings, open questions, or answers.
- Dependency context: closed dependency `ticket_1781136752_984129` added the live packaged protocol harness and command `npm run smoke:live-packaged-protocol`.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan agents must author vault context as wikilinks not home paths]].
- Ticket-specific constraints from the loaded vault context: browser and TUI are equal clients; same-device web must use the hub/client daemon DTO boundary; terminal egress stays in the shared SessionIo/ClientWorker data plane exposed through the bridge; Restty is renderer-only; web must not invent private terminal control frames.
- Repo context inspected: `package.json`, `README.md`, `docs/plans/live-packaged-web-protocol-harness.md`, `docs/plans/botster-web-conformance-regression-suite.md`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `scripts/real-hub-dogfood-bridge.mjs`, and `scripts/live-packaged-protocol-harness.mjs`.
- Current runtime finding: real-hub mode has a session list and a terminal panel, but rows only render title/status/result. `TerminalViewHost` is mounted immediately against the fixed `botster-web-dogfood-session` descriptor, and the live harness reloads after spawn to avoid the immediate attach race. That matches the ticket gap.
- Botster layers touched by the intended implementation: React/Ionic SPA runtime path, UiNode snapshot/action metadata, browser entity mapping, terminal data-plane adapter selection, packaged browser/live harness, docs/tests. Hub/core ownership should remain unchanged.
- Worktree/target assumptions: this run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and this assigned worktree. Implementation agents must operate in the assigned run worktree, not an ambient checkout.

## Scope

- Add an explicit real-hub session attach path from the session list to the terminal panel. Running rows should show an attach/select affordance; exited rows should be visibly non-attachable.
- Add a conservative auto-attach policy for the primary dogfood path: after spawning or observing a running `botster-web-dogfood-session`, bind the terminal panel to that running session without requiring a page reload. This can coexist with the row-level attach action.
- Move real-hub terminal selection into `src/App.tsx` state instead of always mounting `TerminalViewHost` with the fixed dogfood descriptor before the session is known to be attachable.
- Keep `RealHubTerminalDataPlane` as the only browser terminal data-plane adapter for real-hub mode. Selecting a session should create/use a data-plane attachment for that session id and let `TerminalViewHost`/`DefaultTerminalViewBridge` handle attach, input, resize, detach, and remount through existing interfaces.
- Extend `sessionRecord()` and `realHubDogfoodUiTreeSnapshot` so rows carry attach state from daemon lifecycle: running means attachable, exited means disabled/not attachable, and unknown/non-running states avoid terminal attach attempts.
- Route attach actions through the existing `action_request` path, likely `botster.session.attach` or a narrowly named equivalent handled inside `createRealHubDogfoodTransport()`. The action should update local/app attach state; it must not create private terminal byte frames in `protocol.ts`.
- Update the live packaged protocol harness so the primary proof is spawn -> attach without reload -> terminal output `botster-web-dogfood-ready` -> input echo -> resize proof -> exit -> exited row/non-attachable state -> cleanup.
- Keep the existing fake/deterministic unit path for fast coverage, but the acceptance proof must use the live packaged protocol harness or document an exact missing hub prerequisite.

## Non-Scope

- No botster-hub, botster-core, session-worker, TUI, WebRTC production transport, or daemon protocol redesign unless implementation proves a precise upstream mismatch.
- No private web-only terminal protocol, terminal byte frames in `src/botster/protocol.ts`, or direct session-worker frame constants.
- No broad UI redesign, Ionic replacement, Restty replacement, state-library change, package registry refactor, or adjacent cleanup.
- No attaching exited sessions, retry loops against unknown sessions, or fake success state that claims a terminal is attached before the held terminal stream is established.
- No mutation of the user's real Botster home, identity, default data dir, or unrelated persistent sessions. Live checks must keep isolated/explicit hub ownership semantics.

## Assumptions And Unknowns

- Assumption: daemon session lifecycle values exposed in `DaemonSession.lifecycle` and `DaemonEvent` are sufficient to distinguish running from exited for attach gating.
- Assumption: the existing renderer can support row-level attach actions through entity-bound action props; if current binding support is too narrow, make the smallest renderer extension needed for action `target`, `label`, and `disabled` bindings.
- Assumption: switching terminal sessions can be handled by changing the `TerminalViewDescriptor.sessionId` and `TerminalDataPlaneAttachment` in React state, allowing `TerminalViewHost` cleanup to detach the old stream through the existing bridge.
- Assumption: the dogfood path can auto-attach only the known `botster-web-dogfood-session`; generic multi-session selection should remain explicit.
- Unknown: whether current real hub emits a running lifecycle patch soon enough after spawn to attach without polling. If not, implementation should use bounded list-session refresh/event handling through daemon DTOs, not a repeated terminal attach loop.
- Unknown: whether an already-running dogfood session present on initial page load should auto-attach immediately. Preferred behavior: yes for `botster-web-dogfood-session` when lifecycle is running, because that is the primary packaged dogfood path.
- Unknown: whether `detach()` on session switch should send daemon detach before new attach or only close the held stream. Use current `DefaultTerminalViewBridge.detach()` semantics unless a test proves duplicate detach creates hub errors.

## Affected Surfaces And Files

- `src/App.tsx`: own selected/attached terminal session state; derive attachable dogfood session from entity store; dispatch attach actions; mount `TerminalViewHost` only when a running session is selected or render a non-attached placeholder/status otherwise.
- `src/botster/dogfoodMode.ts`: may need to expose a real-hub data-plane factory or runtime metadata instead of one fixed `terminalDescriptor`/`terminalDataPlane`.
- `src/botster/realHubDogfoodTransport.ts`: add attach state fields to session records, add row-level attach action nodes to `realHubDogfoodUiTreeSnapshot`, handle attach action results, keep spawn action as spawn-only or spawn-plus-select only if the app state wiring proves it.
- `src/botster/IonicUiNodeRenderer.tsx`: only touch if action props cannot currently bind `target`, `label`, or `disabled` from the row context.
- `src/botster/TerminalViewHost.tsx` and `src/botster/terminal.ts`: only touch if session switching exposes a real cleanup bug; otherwise reuse existing mount/unmount/attach/detach behavior.
- `src/botster/realHubTerminalDataPlane.ts`: only touch if attach/detach cleanup or per-session construction needs a small public helper. Do not change daemon DTO semantics.
- `src/App.test.mjs`: add behavior coverage for running attachability, exited non-attachability, row attach actions, auto-attach after spawn/session patch, terminal output/input/resize through the selected real-hub data plane, detach cleanup, and recovery after process exit.
- `scripts/live-packaged-protocol-harness.mjs`: remove the reload dependency from the primary path and assert visible attach state plus no repeated unknown-session loop; keep browser failure diagnostics.
- `README.md` and possibly `docs/architecture.md`: update dogfood instructions and remove or revise the known limitation that a separate follow-up tracks immediate attach after spawn.

## Risks

- The implementation could only add an attach-looking button while the production entry point still mounts the fixed terminal descriptor. Tests must prove `App` changes the live `TerminalViewHost` descriptor/data-plane.
- Immediate attach after spawn can race session registration and produce repeated unknown-session errors. Gate terminal attach on running session state and use bounded refresh/event handling.
- Exited rows could still carry enabled stale attach actions if status mapping is not centralized in `sessionRecord()`. The row model should carry explicit attachability derived from lifecycle.
- Fake bridge tests can pass while the packaged UI still relies on reload. The live harness must remove the reload workaround from the main path.
- Per-listener unsubscribe and explicit daemon detach can be conflated. Tests should prove detach/cleanup on session switch/unmount without introducing duplicate detach noise.
- DTO drift is possible if browser code invents synthetic daemon fields. Any changed DTO fields must match authoritative hub-client serde names or remain browser-only entity projection fields after daemon mapping.
- Terminal input and resize can be accidentally tested against `MockTerminalDataPlane`. Assertions must check `terminalDataPlaneKind: "real-hub"` and observed daemon requests/terminal output.

## Acceptance Checks And Tests

- `npm test`
- `npm run build`
- `npm run smoke:live-packaged-protocol` with compatible `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN`, or exact documented unavailable-binary evidence if the environment cannot run it.
- Unit/runtime coverage should prove:
  - running daemon sessions project to attachable rows with an attach action;
  - exited daemon sessions project to visible non-attachable rows with disabled/no attach action;
  - selecting/attaching a running row updates the terminal descriptor/session id used by `TerminalViewHost`;
  - spawning `botster-web-dogfood-session` auto-attaches once the session is running, without a page reload;
  - terminal output arrives through `RealHubTerminalDataPlane`, not fixture mode;
  - terminal input dispatch sends daemon `send_input` and echo output appears;
  - resize dispatch sends daemon `resize` and live size proof still appears in the harness;
  - unmount/session switch/process exit detaches or closes the stream cleanly and does not produce repeated unknown-session diagnostics;
  - process exit patches the session row to `exited` and removes/disables attachment.
- Boundary guards should continue to assert that `src/botster/protocol.ts`, `src/botster/localDogfoodTransport.ts`, and `src/botster/realHubDogfoodTransport.ts` do not add terminal byte/control frame names such as `terminal_input`, `terminal_output`, or `pty_bytes`.
- Live harness success criteria: packaged UI starts, status/list/package requests happen, spawn action creates `botster-web-dogfood-session`, attach occurs from the running session state without reload, terminal renders `botster-web-dogfood-ready`, input renders `botster-web-dogfood-echo:<input>`, resize renders `botster-web-dogfood-size:<rows>x<cols>`, exit renders `botster-web-dogfood-exiting`, `process_exit` is observed, the row becomes exited/non-attachable, and cleanup completes.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should reference this file and the loaded vault notes by wiki link titles, not local filesystem paths.
- Implement gate should include the committed diff, a short production-entrypoint explanation showing how `src/App.tsx` now selects the real session data plane, command output for `npm test`, `npm run build`, and live harness evidence.
- Plan Review should reject fixture-only attach proof, source-only attach proof, private terminal frame additions, or row UI changes that are not wired to `TerminalViewHost`.

## Vault Gaps Worth Capturing

- Capture if implementation discovers a durable rule for Botster web terminal attach readiness after spawn, especially if running lifecycle events are not sufficient and bounded refresh is required.
- Capture if row-level `ui_contract` action bindings need a reusable convention for disabled/target/label values derived from entity rows.
- Capture if terminal detach semantics need a cross-client rule distinguishing final listener close, explicit user detach, session switch, and process exit.
- No new durable knowledge was discovered during planning alone; current vault notes cover the main architecture and workflow constraints.
