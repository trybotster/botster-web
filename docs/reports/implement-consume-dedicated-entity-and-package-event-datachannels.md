# Implement report: consume dedicated entity and package-event DataChannels

## Run identity

- Target repository: `trybotster/botster-web`
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Ticket: `ticket_1787600684_892051`
- Run: `run_1788371419_225012`
- Implement step: `run_step_1788406705_146720`
- Approved plan artifact: `artifact_1788406311_802077`
- Approved plan commit: `a0f7dbb85353b2b4d20a3504bd9c3481d769ed2a`
- Dedicated channel commit: `c5cff604298da4bbfd09cadc7ab4021604bdff59`
- Snapshot hold commit: `1fcba421b90b32db8c1a419709d6f7c7f8b69cd6`
- Reconnect and ordering commit: `4e9e0c8`
- Review repair commit: `c407dc3`
- Hub proof commit: `bb1a330543bc06888f894edd5f40a0f867753a12`
- Core lock revision: `48a437032791e678010254708259568ce4ad02bf`
- Contract fixture: `@trybotster/hub-test-support@0.1.43`

The pipeline uses direct merge. A pull request is not required.

## Guidance applied

The implementation used these playbooks:

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[project-pipelines-playbook]]
- [[botster runtime teardown lenses]]

The implementation used these architecture and code notes:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[botster subscriptions use dedicated ordered DataChannels]]
- [[the browser creates each subscription DataChannel after Hub reserves its label]]
- [[the pinned Rust WebRTC peer cannot open a DataChannel created after the SCTP handshake]]
- [[WebRTC terminal admission requires an encrypted DataChannel Hello]]
- [[WebRTC adapter admission uses a Hello feature string not a generated DTO token]]
- [[WebRTC input delivery chunks reassemble encrypted Core frames before decryption]]
- [[rejected channel isolation needs a surviving channel positive control]]
- [[saturation lanes must own a dedicated webrtc reader]]
- [[egress saturation and request saturation are different workloads]]
- [[Fair host-control writing selects already-admitted frames]]
- [[web event plane budgets are published numeric host limits]]
- [[hub client event queue max requires Botster test mode]]
- [[package event owners use admitted package names not repository names]]
- [[web package event notices are transient and entity state is durable]]
- [[current shared session client lanes do not prove package events]]
- [[event plane client proof uses library contract fixtures]]
- [[botster web hub frame entity snapshots omit subscription identity]]
- [[botster hub client state sync is entity frame only]]
- [[botster browser pull requests must retry after webrtc reconnect]]
- [[a page reload is not a reconnect]]
- [[reused browser transports replay the live hub mode]]
- [[in-flight cancel needs one Web Detach owner]]
- [[Hub ultimate WebRTC close failure sacrifices every peer on the dedicated runtime]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[adding harness event families changes every mixed family oracle]]
- [[Web detaches the mounted terminal when the session entity is exited]]

The last note states that `process_exit` is a valid first detach signal. The entity exit path must also detach without that signal.

The implementation used these workflow notes:

- [[implementation artifacts must match actual git state]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[implementation deviations must resync committed plan acceptance checks]]

## Files changed

The complete ticket changed these files:

- `README.md`
- `docs/architecture.md`
- `docs/plans/consume-dedicated-entity-and-package-event-datachannels.md`
- `docs/reports/implement-consume-dedicated-entity-and-package-event-datachannels.md`
- `scripts/live-packaged-protocol-harness.mjs`
- `scripts/live-packaged-protocol-helpers.mjs`
- `scripts/workspaces-shared-hub-browser-helpers.mjs`
- `src/App.test.mjs`
- `src/botster/connectionDiagnostics.ts`
- `src/botster/hubTerminalDataPlane.ts`
- `src/botster/hubTransport.ts`
- `src/botster/webrtcDaemonClient.ts`

`src/botster/realHubDaemonDto.ts` already exports `DaemonSubscriptionReservation`. It did not need a change.

## Implementation result

Web requests each entity or package-event subscription on the control channel. Web creates an ordered channel only after Hub admits the reservation.

Web uses the exact label and generation from Hub. Web sends the encrypted Hello before it accepts data.

Entity channels accept only `daemon_entity_frame`. Package-event channels accept only `daemon_event` with `package_event` or `event_gap`.

The control channel rejects both data classes. The implementation has no shared-channel fallback and no pre-created channel pool.

Each binding owns its reservation, label, peer generation, subscription identity, timer, assembly state, and completed message identifiers.

Web closes stale bindings by generation. Unsubscribe closes the local binding before Web sends the control request.

Attach request timeouts now reject only that Attach. They do not close the peer, entity channels, package-event channels, or sibling terminals.

Attach operator errors now reject only that Attach. The control peer remains available for the next request.

A late terminal reservation cannot consume a later control response. Web compares the exact session and subscription identity.

Web keeps a terminal listener after an admitted remote channel closes. Web removes it after `terminal_subscription_closed` arrives.

Mode-gated terminal input now waits for its matching `input_result`. A stale retry stays at the queue head.

The production entry point remains `hubTransport`. Its subscription methods now use the reserved channel path in `WebrtcDaemonTransport`.

## Ownership boundaries

All source changes are in `botster-web`. Web owns browser transport, browser lifecycle, browser diagnostics, Web tests, and browser harnesses.

No Hub, Core, TUI, Lua plugin, generated protocol, terminal renderer, or application route source changed.

The proof used a clean Hub checkout in `/private/tmp`. The proof did not edit Hub or Core.

The workspaces proof used clean upstream commit `4903ed00c7fb5b9715657f798c0b04f26fb75781`. The proof did not edit Workspaces.

## Cross-repository dependencies

All registered dependencies are closed. Hub ticket `ticket_1788313897_932611` supplied Hub commit `bb1a330` and Core revision `48a437`.

The parent run absorbed Web child ticket `ticket_1788396308_856047`. The pipeline cancelled that child before this implementation resumed.

No new Hub or Workspaces child ticket was created. Human answer `question_1788411367_609003` forbids those child tickets in this run.

## Deviations from the approved plan

The ticket received a consolidation revision after Plan Review. The revision absorbed `ticket_1788405063_986655`.

The fake responder now answers the first unanswered decrypted request with the required type. Production FIFO behavior did not change.

The reconnect repair changed terminal Attach isolation and mode-gated input ordering. It did not add a fallback or increase a timeout.

The detach oracle now accepts `process_exit` before the entity exit. This change follows the exact vault note.

The live harness now stops the stress session after the slow-client proof. This change bounds CPU and output work.

The workspaces smoke assertions now match the renderer contract. Dynamic fields stay in `values`. Static identity stays in `payload`.

Human answer `question_1788411367_609003` made a gate scope correction. The final integration ticket owns the full cross-repository smoke matrix.

The same answer removed `smoke:live-packaged-protocol:durable` from this intermediate Web gate. The durable assertion was not changed.

## Tests and downstream proof

These repository checks pass on the final source:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `node --check scripts/live-packaged-protocol-harness.mjs`
- `node --check scripts/workspaces-shared-hub-browser-helpers.mjs`
- `git diff --check`

Lint reports five existing Fast Refresh warnings. Build reports the existing bundle size warning.

These Hub-free browser smokes pass:

- `npm run smoke:browser-runtime`
- `npm run smoke:mounted-terminal-keyboard`
- `npm run smoke:mounted-terminal-wheel-scrollback`
- `npm run smoke:ghostsnp-grid`
- `npm run smoke:incremental-ghostsnp-attach`

These pinned Hub browser smokes pass:

- `npm run smoke:live-packaged-protocol`, three consecutive times
- `npm run smoke:package-events`
- `npm run smoke:package-events:gap`
- `npm run smoke:entity-options-reactive`
- `npm run smoke:plugin-contract-matrix`
- `npm run smoke:workspaces-lifecycle`
- `npm run smoke:workspaces-shared-hub-browser`

The three full live runs passed after the stress session gained bounded cleanup. Later edits only corrected workspaces assertions.

The package-event lane reported `peak_subscription_channels: 4`. It kept terminal, control, entity, event, and saturation checks.

The unit suite proves reservation order, exact labels, class checks, reconnect, stale open, open timeout, and control rejection.

The unit suite proves Attach timeout isolation. The peer, sibling terminal, entity subscription, and package-event subscription survive.

The crossed-ack test starts two package-event requests. The fake responder returns reservations by request type and request order.

The ordered input test proves that a second key waits until the first stale retry is admitted.

The Attach operator-error test proves that the same control peer serves a status request after the terminal rejection.

Red-on-revert proof produced these failures:

- The old Attach failure path closed the control peer during the direct Attach timeout test.
- The old mode-gated input path failed the ordered retry condition.
- The old latest-request fake responder failed the automatic reservation wait.
- Without the review repair, the Attach operator-error test fails with `daemon response assembly lost its pending request`.

## Runtime teardown lenses

- Isolation: An Attach failure does not close a sibling channel or the control peer.
- Bounds: Reservation expiry and assembly use finite timers. Stress sessions stop after their proof.
- Late messages: Exact identity rejects stale Attach responses. Stale generations cannot revive a binding.
- Ownership: One listener owns each exact terminal subscription. Web removes it after the ordered close reason.
- Sweep: Peer reset clears the bindings and assembly state for that peer generation.
- Sibling policy: A channel failure does not sacrifice siblings unless the full peer fails.
- Production proof: The compiled browser bundle passed the pinned live lanes through `hubTransport`.

## Unverified behavior and residual risk

`smoke:live-packaged-protocol:durable` fails against Hub `bb1a330`. Hub reloads with `state_source=loaded` and `session_count=0`.

Human answer `question_1788411367_609003` assigned that Hub persistence contract to the final integration ticket. This Web run did not change the assertion.

`smoke:plugin-payload-contract` returns a rejected fixture action on Hub `bb1a330`. The corrected Web gate does not require that external lane.

Two `smoke:workspaces-compat` runs passed all workspaces checks, then failed at different later terminal stages. The corrected gate requires lifecycle proof.

The Hub provenance reports a clean checkout and the exact lock revision. It does not contain a build receipt.

## Missing vault guidance and durable capture

No required vault guidance was missing for the implemented path.

The exact detach note resolved the only convention conflict. It permits `process_exit` as the first detach signal.

No new vault note was necessary. This report records the temporary smoke findings and the human gate correction.

## Assumptions

The Hub and Core hashes are the required producer pins for this Web run.

Upstream Workspaces commit `4903ed0` is the stable package input. Remote `main` resolved to that commit during verification.

The final integration ticket will decide the Hub durability contract and the complete cross-repository matrix.
