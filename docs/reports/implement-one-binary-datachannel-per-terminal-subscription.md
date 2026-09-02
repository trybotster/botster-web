# Implement report: one binary DataChannel for each terminal subscription

## Target

- Repository: `botster-web`
- Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Ticket: `ticket_1787600676_914408`
- Run: `run_1788280072_109337`
- Base: rebased onto `origin/main` commit `9045c65`

The approved plan uses the same repository and target id.

## Guidance applied

The implementation used these playbooks and maps:

- `[[implementer-playbook]]`
- `[[botster-implementer-playbook]]`
- `[[botster-web-playbook]]`
- `[[project-pipelines-playbook]]`
- `[[botster-architecture]]`
- `[[cli-patterns]]`
- `[[spa-patterns]]`
- `[[botster runtime teardown lenses]]`

The implementation also used the targeted atomic notes listed in the approved plan. Checklist `checklist_1788365709_640474` records the vault evidence.

## Implementation

Web sends `Attach` on the control DataChannel. Web creates no terminal DataChannel before Hub returns a reservation. Web creates one ordered DataChannel with the exact opaque reservation label.

Web sends an encrypted Hello on the reserved channel. Web waits for the Hello acknowledgement before it sends terminal frames.

Web encodes input, mode-gated input, resize, and paste with `@trybotster/terminal-protocol@0.3.0`. Web encrypts each complete Core frame. Web sends each encrypted envelope as sequential version 2 `daemon_terminal_frame` chunks.

Web receives terminal events on the reserved channel. Web assembles one message at a time on each channel. Web rejects invalid order, invalid metadata, duplicate completed identifiers, oversized data, and timed-out assemblies.

Web removed the control request paths for `send_input`, `mode_gated_input`, and terminal `resize`. Web also removed `terminalInputQueue` and its response pacing.

## Files changed

- `README.md`
- `docs/architecture.md`
- `docs/plans/one-binary-datachannel-per-terminal-subscription.md`
- `docs/reports/implement-one-binary-datachannel-per-terminal-subscription.md`
- `package.json`
- `package-lock.json`
- `scripts/incremental-ghostsnp-attach-browser-smoke.mjs`
- `scripts/live-packaged-protocol-harness.mjs`
- `src/App.test.mjs`
- `src/botster/connectionDiagnostics.ts`
- `src/botster/generated/daemon-protocol.ts`
- `src/botster/hubTerminalDataPlane.ts`
- `src/botster/hubTransport.ts`
- `src/botster/incrementalGhostsnpAttachSmoke.ts`
- `src/botster/protocolPlanes.ts`
- `src/botster/webrtcDaemonClient.ts`

## Ownership boundaries

The change stays in `botster-web`. Web owns browser channel creation, encryption, chunk assembly, terminal integration, and local lifecycle handling.

Web treats the reservation label as opaque. Web does not implement Hub admission. Web uses Core encoders and does not define Core frame bodies.

No file changed in `botster-hub` or `botster-core`.

## Cross-repository dependencies

The implementation consumes these published packages:

- `@trybotster/hub-test-support@0.1.43`
- `@trybotster/terminal-protocol@0.3.0`

All registered publication dependencies are closed. Hub ticket `ticket_1788313897_932611` depends on this Web ticket.

The live attempt used Hub worktree commit `ea88e74f8bfe4a14d2fd1a071977ab06c043d530`. This commit contains approved candidate commit `0417317412804ee172c6abe29cf03b80e195554a`. Its lock file pins Core commit `48a437032791e678010254708259568ce4ad02bf`.

## Plan deviations

The user approved removal of legacy code and tests. The implementation removed old tests that required the deleted control request paths. The implementation kept focused binary transport, hydration, paste, stale-mode, and sibling isolation tests.

The implementation added an assembly timeout and a bounded completed-message set. These changes implement the approved teardown bounds.

No ownership or protocol deviation occurred.

## Runtime teardown lenses

- Isolation: one terminal channel owns one session, subscription, and generation. A terminal channel failure does not close a sibling channel.
- Bounds: reservation admission and message assembly have timers. Local close does not wait for Hub.
- Late messages: closed bindings leave the listener and channel sets. Late channel messages cannot revive a binding.
- Ownership identity: each binding stores the session id, subscription id, Core generation, Hub peer generation, local transport generation, and opaque label.
- Sibling policy: a terminal channel closes alone. Peer loss closes all channels owned by that peer.
- Production path: `createHubTerminalDataPlane` uses `streamTerminal().sendFrame()`. `createWebrtcDaemonClient` implements that sender on the reserved channel.

## Verification

These commands passed:

- `npm test`
- `npm run typecheck`
- `npm run lint` with five existing Fast Refresh warnings and no errors
- `npm run build`
- `npm run smoke:browser-runtime`
- `npm run smoke:mounted-terminal-keyboard`
- `npm run smoke:ghostsnp-grid`
- `npm run smoke:incremental-ghostsnp-attach`
- `git diff --check`

The tests prove exact reservation labels, ordered channel creation, encrypted Hello admission, binary frame kinds, large input chunking, paste framing, stale-mode retry, hydration order, terminal output, and sibling channel isolation.

## Unverified behavior and residual risk

The isolated live packaged protocol lane did not reach terminal Attach. It completed protocol 8 Hello against the candidate Hub. It then stopped on the existing `list_apps` startup oracle. Current Web did not send that obsolete startup request.

Thus, the live lane did not prove byte-exact input, paste, reconnect, or exit against the real Hub. The repository tests and browser smoke tests prove those Web paths with test bridges.

The generated protocol drift check passed. The generated file uses protocol 8 and conformance revision 48.

## Missing vault guidance

The approved plan identified three durable rules that need direct vault notes:

- The subscription Hello is a bare encrypted envelope, but bound terminal traffic uses version 2 chunks.
- `input_result` on the terminal channel is the only mode-gated result path.
- Web and Hub use a 12,288-byte terminal delivery payload size.

The implementation did not write outside this repository worktree. The plan remains the durable source for this run.

## Assumptions

- The reservation label is opaque and unique for its Hub peer generation.
- The Hub candidate remains compatible with the published protocol 8 DTO.
- Core owns paste transaction framing and limits.
