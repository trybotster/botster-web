# Implement report: consume dedicated entity and package-event DataChannels

## Run identity

- Target repository: `trybotster/botster-web`
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Ticket: `ticket_1787600684_892051`
- Run: `run_1788371419_225012`
- Implement step: `run_step_1788372638_857183`
- Approved plan: `docs/plans/consume-dedicated-entity-and-package-event-datachannels.md`
- Initial producer used for live proof: `botster-hub` commit `080ca9ae31ffc7b3dfd2a255b6eaa08c15bfc4fe`
- Resumed producer used for live proof: `botster-hub` commit `bb1a330543bc06888f894edd5f40a0f867753a12`
- Installed contract fixture: `@trybotster/hub-test-support@0.1.43`, protocol 8, conformance revision 48, DTO SHA-256 `33c0c27941c0e9751342cfdbeb53d27bb4a1225e5ce7f4be280d9f0dc11ad7f3`

## Guidance applied

Repository and workflow playbooks:

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[project-pipelines-playbook]]
- [[botster runtime teardown lenses]]

Architecture and code notes:

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
- [[a ui contract import line change costs one test line in each generic client]]
- [[adding harness event families changes every mixed family oracle]]

Workflow notes:

- [[implementation artifacts must match actual git state]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[implementation deviations must resync committed plan acceptance checks]]

## Files changed

- `src/botster/webrtcDaemonClient.ts`
- `src/botster/connectionDiagnostics.ts`
- `src/botster/hubTransport.ts`
- `src/App.test.mjs`
- `scripts/live-packaged-protocol-harness.mjs`
- `docs/architecture.md`
- `README.md`
- `docs/reports/implement-consume-dedicated-entity-and-package-event-datachannels.md`

`src/botster/realHubDaemonDto.ts` did not need a change. Its existing wildcard export exposes `DaemonSubscriptionReservation`. `scripts/live-packaged-protocol-helpers.mjs` did not need a change because the new reconnect and saturation oracles use existing page-harness data.

## Implementation result

Web now reads the entity or package-event reservation from the control response. It then creates one ordered DataChannel with the exact Hub label. It sends an encrypted host Hello and waits for `DaemonHelloAck` before it accepts data.

Each binding owns its label, Hub reservation generation, peer generation, subscription ID, expiry timer, assembly state, and completed message IDs. Entity channels accept only `daemon_entity_frame`. Package-event channels accept only `daemon_event` with `package_event` or `event_gap`. The control channel rejects both data-plane classes.

Unsubscribe closes and forgets the local channel before it sends the control request. Admission failure, expiry, peer loss, and remote close also retire the binding. A current admitted remote close starts one fresh subscription with a new ID and reservation. A stale close cannot affect the replacement. Peer reset closes terminal, entity, and event bindings for that peer generation.

The production entry point is unchanged. `hubTransport` still calls `subscribeEntityFrames` and `subscribePackageEvents`. Those methods now use the reservation, admission, and class-specific channel paths in `WebrtcDaemonTransport`.

## Ownership boundaries

All changes are in `botster-web`. They cover the browser transport, browser diagnostics, repository-owned tests, the packaged browser harness, and Web documentation. No Hub, Core, TUI, plugin, Lua, generated protocol, terminal renderer, or application-route source changed.

The implementation used the Hub repository only to build the approved producer commit in `/private/tmp` for read-only contract proof. It did not edit that repository.

## Cross-repository dependency

The closed pipeline dependency is `dependency_1788375748_957592`: this ticket depends on Hub ticket `ticket_1788313897_932611`.

Human answer `question_1788375688_896668` requires this dependency. The answer says that Hub `080ca9a` predates inbound reassembly for the mandatory version 2 `daemon_terminal_frame` chunks that Web main sends. It forbids a raw-envelope fallback and forbids a waiver for either terminal echo assertion.

Hub ticket `ticket_1788313897_932611` merged at `bb1a330543bc06888f894edd5f40a0f867753a12`. The resumed full lane exposed a later Web terminal reconnect failure. Agent answer `question_1788396042_879149` assigns that failure to `botster-web` and requires a separate ticket. This ticket now depends on Web ticket `ticket_1788396308_856047` through dependency `dependency_1788396319_338718`. Its run is `run_1788396326_651208`.

## Deviations from the approved plan

- The terminal reserved-channel opener remains unchanged. A temporary mechanical generalization was reverted. The entity and package-event classes share their own reserved-channel helper. This keeps the terminal path outside the surgical change.
- `src/botster/realHubDaemonDto.ts` and `scripts/live-packaged-protocol-helpers.mjs` did not need changes for the reasons in the file list.
- The live harness now waits for an attached terminal before it starts the intentional reconnect. This avoids changing the test target during an in-flight attach.
- The harness terminal-frame oracle now reads the existing `terminal_data_channel_receive` event. The old `webrtc_terminal_frame_assembly` name had no producer.
- The resumed harness removes an impossible wait for `attach_state=attached` while it holds a READY snapshot on the same ordered terminal DataChannel. Core queues input until attach completes. The later attached event cannot pass the held snapshot.
- Review and gate submission are deferred. Agent answer `question_1788396042_879149` requires the Implement step to remain parked until the Web recovery ticket merges.

## Tests and downstream proof

Passed:

- `npm test`
- `npm run lint` with five existing Fast Refresh warnings and no errors
- `npm run typecheck`
- `npm run build` with the existing bundle-size warning
- `npm run smoke:browser-runtime`
- `npm run smoke:mounted-terminal-keyboard`
- `npm run smoke:ghostsnp-grid`
- `npm run smoke:incremental-ghostsnp-attach`
- `npm run smoke:package-events:gap` against Hub `080ca9a`
- `npm run smoke:entity-options-reactive` against Hub `080ca9a`
- Resumed `npm test`
- Resumed `npm run smoke:package-events` against Hub `bb1a330543bc06888f894edd5f40a0f867753a12`; terminal controls pass and `peak_subscription_channels` is 4
- `node --check scripts/live-packaged-protocol-harness.mjs`
- `git diff --check`

The unit suite proves no channel before the reservation response, exact label use, ordered creation, encrypted Hello admission, missing-reservation failure, expiry, late release, class and identity checks, remote close resubscribe on the same peer, unsubscribe ordering, peer reconnect, and control-channel rejection.

The live gap lane proves `event_gap` delivery on the dedicated package-event channel. The live entity-options lane proves two demand-scoped entity families on dedicated channels and proves release. The reconnect evidence shows fresh labels and fresh subscription IDs for `session` and `session_type` on the surviving document.

The merged Hub commit resolves the original version 2 terminal input failure. The full lane reaches later terminal reconnect checks.

Blocked on Web recovery ticket `ticket_1788396308_856047`:

- Before the harness repair, two `npm run smoke:live-packaged-protocol` runs timed out at the impossible attached-state wait during the held READY snapshot.
- After the harness repair, full live runs progressed beyond that wait but timed out at rotating later terminal echo probes. The observed probes include `botster-web-production-attach-probe-1` and `keys`.
- `npm run smoke:workspaces-lifecycle` cannot run because no `BOTSTER_WORKSPACES_PACKAGE_PATH` is available in this run.

The package-event lane now reaches its final peak-channel log. It reports `peak_subscription_channels: 4`.

## Runtime teardown lenses

- Isolation: one entity or event binding owns one reservation and one assembly. Local or remote retirement does not close a sibling channel, terminal channel, control channel, or peer.
- Bounds: reservation expiry and message assembly use finite timers. Local close does not wait for a Hub response. Control unsubscribe uses the existing request timeout.
- Late messages: stale reservation responses do not create a channel. Late acks cannot revive a forgotten binding. Stale peer generations, subscription IDs, entity types, owner/name pairs, and delivery kinds are rejected or discarded.
- Sweep: peer reset closes all bindings for that peer generation and clears their assembly state. A current remote close can start only one guarded replacement.
- Production path: the packaged browser proof uses `hubTransport` through the compiled bundle and a real Hub. The passing gap and entity-options lanes prove the new channel path. The two required terminal positive controls remain mandatory after the Hub dependency merges.

## Unverified behavior and residual risk

- The full live lane does not pass all later terminal reconnect echo checks with Hub `bb1a330543bc06888f894edd5f40a0f867753a12`.
- The separate Web recovery ticket owns the production terminal reconnect diagnosis and repair. This ticket must not change production terminal-channel behavior.
- The named workspaces lifecycle lane needs a routed `botster-workspaces` package path.
- After Web ticket `ticket_1788396308_856047` merges, this branch must rebase on current Web main. Both exact live lanes must pass against Hub `bb1a330543bc06888f894edd5f40a0f867753a12` before Review.

## Missing vault guidance and durable capture

The implementation found these durable guidance candidates:

- A browser must wait for a stable terminal attachment before a harness intentionally closes the control peer.
- A package-event saturation proof must use the browser control channel and the Unix socket as separate observations.
- Subscription-channel telemetry needs a peak-count oracle before later positive controls can fail.
- Same-peer remote close proof must acknowledge the old unsubscribe before it expects the replacement subscribe.
- Harness assertions must name an event that production code emits.
- A harness must not wait for a later event while it holds an earlier message handler on the same ordered DataChannel.

No vault note was written during this parked Implement step. Existing notes already constrain the channel, reconnect, saturation, and teardown behavior. Verify should capture only guidance that remains true after the merged Hub proof.

## Assumptions

- Hub commit `bb1a330543bc06888f894edd5f40a0f867753a12` and `@trybotster/hub-test-support@0.1.43` are the current producer and fixture pins.
- Merge policy is direct, so a PR link is not required before the parked state.
- No acceptance check is waived. The run resumes only after the registered Web recovery dependency merges.
