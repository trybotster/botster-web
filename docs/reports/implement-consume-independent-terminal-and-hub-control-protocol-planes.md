# Implement report: Consume independent terminal and Hub control protocol planes

Ticket: `ticket_1786661008_897067`
Run: `run_1786722987_966285`
Step: `botster_stack_implement` / `run_step_1786744731_544720`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` |
| Branch | `project-pipelines/ticket_1786661008_897067` |
| Base | `origin/main` `e2c3192` |
| Teardown class | yes |

Routing was verified independently with `list_spawn_targets`. The ticket, run, and approved plan all bind `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`.

## Repository playbook and other playbooks/notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[project-pipelines-playbook]] — workflow overlay for durable dependencies and Implement-gate evidence
- [[botster runtime teardown lenses]]
- [[implement gate must verify committed work and pr link before review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[project pipelines mcp create calls can time out after committing]]
- [[WebRTC terminal admission requires an encrypted DataChannel Hello]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[public protocol versions host control and Core terminal planes independently]]
- [[incremental GHOSTSNP uses one decoder per subscription]]
- [[Unix Hello can reject terminal admission while host operations remain available]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[Web terminal drain awaits each event consumer]]
- [[a page reload is not a reconnect]]
- [[pre READY attach failed ends client hydration]]
- [[incomplete history status aborts the client decoder after READY]]
- [[GHOSTSNP READY terminal stays usable after a later history failure]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[botster web pinned hub test support claims span readme and architecture docs]]

Convention conflicts: none.

## Files changed

- `package.json`, `package-lock.json` — pin `@trybotster/terminal-protocol@0.1.0` and `@trybotster/hub-test-support@0.1.36`; keep `@trybotster/ui-contract@0.3.2`
- `src/botster/generated/daemon-protocol.ts` — copy published host artifact (delivery kinds, Hello terminal compatibility, `terminal_subscription_closed`)
- `src/botster/protocolPlanes.ts` — host Hello from published hub-test-support metadata plus feature literals; terminal Hello from `@trybotster/terminal-protocol`
- `src/botster/hubTestSupportMetadata.d.ts` — types for the metadata JSON export
- `src/botster/connectionDiagnostics.ts` — host required features no longer include Core terminal tokens; conformance floor 41
- `src/botster/webrtcDaemonClient.ts` — first encrypted send is Hello; assemble `daemon_terminal_frame` and `daemon_event`; stop terminal Drain
- `src/botster/hubTransport.ts` — stream handle is Attach + Core frames, not Drain
- `src/botster/hubTerminalDataPlane.ts` — consume Core `TerminalEvent`; generation-tagged close; lost-PAGE fresh attach
- `src/botster/incrementalGhostsnpAttachSmoke.ts` — Core snapshot phase on authentic Restty reader
- `src/App.test.mjs` — Hello literals, delivery kinds, sibling/close/timeout ablation, pin claims
- `scripts/live-packaged-protocol-harness.mjs` — production Hello + `daemon_terminal_frame` oracles, reconnect Hello, slow-client sibling
- `README.md`, `docs/architecture.md` — paired pin claims; production path is Hello + terminal frames
- `docs/plans/consume-independent-terminal-and-hub-control-protocol-planes.md` — approved plan
- `docs/reports/implement-consume-independent-terminal-and-hub-control-protocol-planes.md` — this report

## Ownership boundaries preserved

Web owns Hello composition, chunk assembly, Core JSON parse, one Restty decoder per subscription, hydration/reconnect, and browser proof. This run did not edit botster-core, botster-hub, botster-tui, botster-tui-kit, or botster-workspaces. Host DTOs were copied from the published artifact, not hand-authored. Terminal tokens come from `@trybotster/terminal-protocol`, not Hub feature lists.

## Cross-repo dependencies or separately routed work

All registered dependencies are closed. Implement consumed published registry artifacts:

- `@trybotster/terminal-protocol@0.1.0`
- `@trybotster/hub-test-support@0.1.36`
- live Hub binary from Hub main `279d828ca377d23e743ae3e724a1ac9ce81520e2`

Sibling TUI `ticket_1786661009_551067` and Hub cold-cut `ticket_1786661010_198387` were not edited. Web still accepts the one-frame transitional Attach `attaching` event.

## Deviations from plan

- Host metadata is imported from `@trybotster/hub-test-support/metadata` (JSON export), not the package root. The package root `index.js` uses Node `fs` and must not enter the browser bundle. Feature literals and protocol identity still match the published metadata.
- No Rust helper is imported.

No accepted scope change requires rewriting the committed plan contract.

## Runtime-teardown lenses

Every lens from [[botster runtime teardown lenses]] is implemented. None was waived.

| Lens | Implementation |
| --- | --- |
| Isolation | One subscription generation owns one Restty reader and one inbound listener. A Core close on A does not close B. Terminal mismatch does not take down host RPCs. |
| Bounds | Hello, Attach, and frame assembly use the existing 10s request/assembly timeout and `failPeerGeneration`. Timeout ablation skips that cleanup and stays unsettled. |
| Late-message matrix | Hello never creates a route. Attach after Hello accepts only transitional `attaching`. Terminal frames and close events drop on stale subscription/generation. Drain, if called, rejects terminal bodies. |
| Production-path proof | Packaged UI → `createWebrtcDaemonClient` Hello → Attach → `daemon_terminal_frame` → `HubTerminalDataPlane`. Live harness asserts Hello tokens, no Drain, frame assembly, reconnect Hello, and `core_adapter_closed` while a sibling stays live. |
| Ownership identity | Web tags `(session_id, subscription_id, coreGeneration)`. Close for generation N does not delete N+1. Lost-PAGE recovery mints a new subscription id. |
| Sibling fail-closed | Successful or Core write-budget close of A leaves B attached. Ultimate peer close recovers with a new Hello/Attach generation. |

## Tests and downstream proof run

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run smoke:incremental-ghostsnp-attach
npm run smoke:browser-runtime
BOTSTER_HUB_BIN=/Users/jasonconigliari/Projects/botster-hub/target/debug/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/Users/jasonconigliari/Projects/botster-hub/target/debug/botster-session-worker \
npm run smoke:live-packaged-protocol
```

Results:

- `npm test` passed (includes `scripts/check-daemon-protocol-drift.mjs` against published hub-test-support 0.1.36).
- Typecheck passed.
- Lint passed (pre-existing `IonicUiNodeRenderer` fast-refresh warning only).
- Production build passed.
- Incremental GHOSTSNP attach smoke passed: READY before FINISH, PAGE order, degraded history, authentic Restty reader.
- Browser runtime smoke passed.
- Live packaged protocol harness exited 0 against Hub `279d828ca377d23e743ae3e724a1ac9ce81520e2`.

Production entry points: `createWebrtcDaemonClient` sends Hello as the first encrypted send; `HubTerminalDataPlane` consumes `daemon_terminal_frame` through `streamTerminal`. Incremental smoke and the live harness drive those paths.

## Unverified behavior or residual risk

- Live timeout hang against a real Hub sender was not induced; the production timeout handler and its ablation were proven on the real `WebrtcDaemonTransport` assembly path with incomplete chunks.
- `yes write-budget-stall` live close depends on Core write-budget timing. The live harness waits up to 20s for `core_adapter_closed`.
- Hub cold-cut of the transitional Attach `attaching` frame remains ticket `ticket_1786661010_198387`.

## Missing vault guidance discovered

None blocked implementation. Optional later capture: WebRTC close is a negotiated host `daemon_event`, and Web builds host Hello from published metadata plus feature literals because hub-test-support does not export Rust helpers.

## Merge policy

Direct merge. No PR.
