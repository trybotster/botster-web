# Web: consume dedicated entity and package-event DataChannels

Ticket: `ticket_1787600684_892051`
Run: `run_1788371419_225012`
Target repository: `botster-web` (`trybotster/botster-web`)
Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`
Base ref: `main` at `6dc32b3` (clean tracked worktree, `.gitignore` intact, no colon in the worktree path).

Plan revision 1 (2026-09-02).

## 1. Repository routing and context loaded

Target resolution: the run and ticket carry `tgt_40abcf71ccf049f4ac0c99953a799869`. The Hub spawn-target list maps that id to `/Users/jasonconigliari/Projects/botster-web`, repository `trybotster/botster-web`. The ambient worktree is a checkout of that repository, so the routing is consistent, but the target id is the authority.

Repository charter: [[botster-web-playbook]].

Role playbooks: [[planner-playbook]], [[botster-planner-playbook]].

Mandatory Botster maps: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]]. [[project-pipelines-playbook]] is not loaded; this ticket changes no Project Pipelines package or plugin path and no workflow policy.

Class overlay: [[botster runtime teardown lenses]]. This ticket is runtime-teardown class because it creates per-subscription WebRTC channels with their own admission, close, and retirement, and it moves durable subscription delivery onto those channels. Section 9 answers every required field.

Targeted atomic notes (each title verified against the vault filename):

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

Repository context read in `botster-web` at `6dc32b3`: `README.md`, `docs/architecture.md`, `docs/plans/one-binary-datachannel-per-terminal-subscription.md`, `docs/reports/implement-one-binary-datachannel-per-terminal-subscription.md`, `package.json`, `src/botster/webrtcDaemonClient.ts`, `src/botster/hubTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/app/hubLifecycle.ts`, `src/App.test.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/check-daemon-protocol-drift.mjs`, `fixtures/package-notice-reaction/plugin.lua`, `.github/workflows/terminal-regression-baseline.yml`.

Authoritative producer context read outside the target repository, for contract facts only: `botster-hub` `main` at `080ca9a` (`docs/client-protocol.md` section "Dedicated entity and package-event channels", `docs/plans/give-entity-and-package-event-subscriptions-dedicated-datachannels.md`, `src/admission/reservations.rs`, `src/admission/connection_budget.rs`, `src/daemon/control/entities.rs`, `src/daemon/control/events.rs`, `src/daemon/control/connection.rs`, `src/daemon/owner_loop.rs`, `src/transport/webrtc/subscription_channel.rs`, `src/transport/webrtc/peer.rs` tests) and the installed package `@trybotster/hub-test-support@0.1.43` (`metadata.json`: protocol 8, conformance revision 48, `daemon-protocol.ts` sha256 `33c0c27941c0e9751342cfdbeb53d27bb4a1225e5ce7f4be280d9f0dc11ad7f3`).

Open sibling tickets checked. The only open `botster-web` ticket in the project is this one. Open Hub siblings (`ticket_1788313897_932611`, `ticket_1788206393_323469`, `ticket_1787600679_990088`, `ticket_1787600691_401181`), Core siblings (`ticket_1788112223_631570`, `ticket_1787894967_973951`), and the TUI consumer (`ticket_1787603674_865638`) do not change the subscription reservation contract this plan consumes. Prior terminal work in this repository (`ticket_1787600676_914408`, merged at `fa074f8` through `6dc32b3`) is the binding scheme this plan follows.

Dependencies on this ticket, all closed: `ticket_1787600682_233928` (Hub source), `ticket_1787600676_914408` (Web terminal channel), `ticket_1788282899_502914` (published 0.1.43). No new dependency is required.

## 2. Producer contract this plan consumes

These are measured facts from `botster-hub` `main` at `080ca9a` and the installed 0.1.43 artifact, not assumptions.

### 2.1 Reservation

On an admitted WebRTC peer:

- `DaemonRequest::SubscribeEntities { entity_type, subscription_id }` answers `DaemonResponse { kind: "entity_subscribed", subscription_reservation: DaemonSubscriptionReservation }`.
- `DaemonRequest::SubscribeEvents { subscription_id, owner, name, subjects }` answers `DaemonResponse { kind: "event_subscribed", subscription_reservation: DaemonSubscriptionReservation }`.

`DaemonSubscriptionReservation` fields: `kind` (`"entity"` or `"package_event"`), `subscription_id`, `generation` (Hub-minted, monotonic per admission), `peer_generation`, `label` (opaque `r-<32 hex>`), `expires_in_seconds` (30 by default; `BOTSTER_HUB_TEST_RESERVATION_EXPIRES_IN_SECONDS` overrides it only when the Hub child has `BOTSTER_ENV=test`).

The field is absent on Unix responses. Failure forms: entity `entity_error` codes `connection_channel_limit`, `reservation_label_conflict`, `local_webrtc_peer_gone`; package events typed operator errors for connection capacity, duplicate subscription, and not-negotiated.

Budget: one control channel plus at most 32 subscription channels per connection, one limit table for terminal, entity, and event classes (`MAX_SUBSCRIPTION_CHANNELS = 32`).

### 2.2 Channel creation and admission

The browser creates one reliable ordered `RTCDataChannel` with the exact reserved `label`. Hub's `admit_reserved_subscription_channel` inspects the reservation (`Unknown`, `Stale`, `Bound`, `OverLimit`, `Expired` are closed under the peer close bound and reported as control-channel `runtime_observation` events `subscription_channel_rejected:<reason>:<label>`), then waits for exactly one encrypted `DaemonHello` as a bare `AesGcmEnvelope` JSON message. Hub requires `hello.protocol == "botster-hub-daemon-v1"`; if `hello.terminal_compatibility` is present it must satisfy Core's current terminal compatibility. Hub does not re-check host required features on the subscription channel. Hub replies `DaemonHelloAck` as chunked delivery frames, then binds by class: entity binds the per-subscription frame receiver (bounded queue of 64 frames that already holds the authoritative snapshot produced at subscribe time); package event binds the per-subscription mailbox.

### 2.3 Wire shapes on a bound subscription channel

- Entity channel, Hub to browser only: chunked `DaemonLocalWebrtcDeliveryChunk` with `delivery_kind: "daemon_entity_frame"`, reassembled payload a `DaemonEntityFrame` (`entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `entity_error`) carrying the reservation's `subscription_id`.
- Package-event channel, Hub to browser only: chunked deliveries with `delivery_kind: "daemon_event"`, payload `DaemonEvent` of type `package_event` or `event_gap` carrying the reservation's `subscription_id`.
- The browser sends nothing on a bound entity or event channel after the Hello. Hub ignores inbound messages there.
- Hub sends entity frames only on the entity channel and package events and gaps only on the package-event channel. The control channel keeps requests, responses, and small lifecycle events (`runtime_observation`, `terminal_subscription_closed`, `worktree_lifecycle`, `session_lifecycle`). `framed_daemon_entity_frame` has no control-channel call site.

### 2.4 Close and retirement

- Hub closes the entity channel and emits control-channel `runtime_observation` `entity_subscription_closed:<subscription_id>:<generation>:entity_subscription_overflow` when the aggregate send budget refuses a frame. Package-event overflow emits `package_event_subscription_closed:<subscription_id>:<generation>:aggregate_overflow` and sets the gap bit.
- A reservation that never opens within `expires_in_seconds` is expired by the owner-loop sweep or at a late open. Hub retires the route owner (removes the entity subscription, or cleans the event subscription), releases the budget slot, and emits `entity_subscription_closed:...:reservation_expired` or `package_event_subscription_closed:...:reservation_expired` on the control channel.
- `UnsubscribeEntities` and `UnsubscribeEvents` remove the subscription, retire the reservation, and close the bound channel. Peer loss retires every reservation of that peer generation.
- After any bound channel closes, Hub sends `RetireReservedSubscription`, which removes the entity subscription or cleans the event subscription. A closed channel therefore means the subscription is gone on Hub; a fresh `subscribe_entities` or `subscribe_events` is the only recovery.

### 2.5 Current Web state against this contract

`main` of `botster-web` at `6dc32b3` sends `subscribe_entities` and `subscribe_events`, ignores `subscription_reservation`, and waits for `daemon_entity_frame` and `daemon_event` deliveries on the shared control channel. Against Hub `080ca9a` those deliveries never arrive, so every entity `ready` promise waits forever and every package-event notice is lost. This is a live cold-cut incompatibility for the session list, session types, entity-options selects, and package notices, not a future risk.

## 3. Scope

In scope, in `botster-web` only:

1. Read `subscription_reservation` from `entity_subscribed` and `event_subscribed` responses on the WebRTC bridge. Reject a WebRTC response that omits the reservation or whose `kind` or `subscription_id` does not match the request as a failed subscription with a connection diagnostic. Do not create any channel before the response resolves.
2. Create exactly one reliable ordered `RTCDataChannel` with the exact reserved label for each admitted entity and package-event subscription, after the response arrives and only while the reserving control peer generation is still current.
3. Send one encrypted `DaemonHello` on the new channel and await `DaemonHelloAck` before the binding is usable. The Hello carries `protocol` and the host `compatibility` requirement; it omits `terminal_compatibility` (assumption 5.1).
4. Assemble `daemon_entity_frame` deliveries per entity channel and route them into the existing `receiveEntityFrame` path with the binding identity check added (subscription id must equal the reservation's). Assemble `daemon_event` deliveries per package-event channel and route `package_event` and `event_gap` into the existing holder dispatch with the same identity check. Any other delivery kind or event type on a bound channel fails that channel closed.
5. Remove the shared-channel fallbacks: the control channel rejects `daemon_entity_frame` deliveries the same way it rejects `daemon_terminal_frame`, and a `package_event` or `event_gap` host event arriving on the control channel is a data-plane violation with the same failure path. No code path reads entity frames or package events from the control channel.
6. Close and forget a channel by generation for rejected, expired (Web-armed bound from `expires_in_seconds`), stale (peer generation advanced, owner closed, or binding replaced), unsubscribed, cancelled, and retired reservations, and on peer loss. `resetPeerState` closes entity and event bindings together with terminal bindings.
7. Recovery after admission: a remote close of a bound entity channel in the current peer generation runs the existing `resubscribeEntity` path once (fresh subscription id, fresh reservation, fresh channel) guarded by the existing `resubscribing` flag, mirroring the sequence-gap path. A remote close of a bound package-event channel in the current peer generation re-runs `startPackageEventSubscription` once with a fresh subscription id and no notice replay. Failure before admission (reservation rejected, expiry bound fired, Hello rejected) rejects `ready`, records a diagnostic, forgets the channel, and does not retry that reservation; the next reconnect or demand subscribes afresh (assumption 5.2).
8. Preserve route-owned pulls and reconnect replay unchanged: `replayHubStatusOnLifecycleEvent` still fires on control-channel `data-channel-open`; held entity and event subscriptions are re-requested per peer generation as today, and each now yields a new reservation and channel.
9. Keep `subscribe_entities`, `unsubscribe_entities`, `subscribe_events`, `unsubscribe_events`, and every other Hub command on the control channel. On unsubscribe, close and forget the local channel first, then send the unsubscribe request.
10. Live-harness seams: record `subscription_data_channel` (`class`, `state`, `label`, `generation`, `peer_generation`, `subscription_id`, `remote`) and `subscription_data_channel_receive` events; keep recording `webrtc_entity_frame_assembly`, `webrtc_daemon_event_assembly`, `webrtc_entity_subscription`, `webrtc_package_event_subscription`, and `daemon_event` so existing oracles stay valid; keep `armDropNextInboundEntityFrame` on the channel path before `receiveEntityFrame`.
11. Migrate `src/App.test.mjs` fixtures that emit entity frames and package events on the fake control channel to emit them on the created entity and event channels, and add the checks in section 8.
12. Extend the live packaged harness: reservation and label fidelity for entity and event channels, one-document reconnect for entity and event subscriptions, and the saturation lane in section 8.
13. Update `docs/architecture.md` and `README.md` transport descriptions. Package and revision claims stay at 0.1.43 / protocol 8 / revision 48; the vendored `daemon-protocol.ts` already matches (drift check passes against the installed 0.1.43).

Explicitly out of scope:

- Any fallback that carries entity frames or package events on the control channel. The cut is cold.
- Per-subscription SDP renegotiation and any pre-created channel pool.
- Terminal channel behavior; it landed in `ticket_1787600676_914408` and is reused, not changed.
- Any change in `botster-hub` or `botster-core`, and any package pin change. Both coordinates this ticket needs are already installed.
- Product reactions, package owners, event names, or entity families in generic Web code.
- Unix transport, TUI, or Hub official gate changes. Hub open siblings own those.

## 4. Ownership boundaries and cross-repository dependencies

Ownership stays as the charter defines. `botster-web` owns browser connection lifecycle, channel creation, generated DTO consumption, entity-store reconciliation, and browser diagnostics. Hub owns reservation, admission, per-class binding, queue and aggregate bounds, overflow close, and retirement. Web must not decode a label, must not invent delivery shapes, must not filter package events by run, ticket, or step, and must not add retry policy beyond the one-shot resubscribe already in production for sequence gaps.

Dependencies, all closed and satisfied at plan time:

- `ticket_1787600682_233928` (Hub source; merged on Hub `main`, `30f6a9e` through `080ca9a`).
- `ticket_1788282899_502914` (`@trybotster/hub-test-support@0.1.43` published; installed here after `npm install`, metadata protocol 8 / revision 48).
- `ticket_1787600676_914408` (Web terminal channel binding scheme; merged at `fa074f8` through `6dc32b3`).

No dependency is added. Web verifies against `botster-hub` built from `main` at `080ca9a` and records that commit in the Implement report. The Hub official gate against merged Web belongs to Hub's open integration ticket, not to this run.

## 5. Assumptions and unknowns

Assumptions, stated explicitly:

1. **Subscription-channel Hello shape.** Web sends `{ protocol, compatibility }` on entity and event channels and omits `terminal_compatibility`. Hub checks only `protocol` and an optional terminal requirement, so this is admissible and does not couple non-terminal channels to Core terminal features. Plan Review may require the terminal shape instead; either passes Hub admission.
2. **Recovery policy after admitted close.** One-shot resubscribe with a fresh id after a remote close of an admitted channel is the existing production behavior class for entity sequence gaps and matches Hub's `subscriber_overflow` resync expectation. Pre-admission failures do not retry the same reservation. If Plan Review wants pre-admission failures to also resubscribe once, that is a one-line policy change in the same owner.
3. **Expiry bound arming.** Web arms the `expires_in_seconds` bound from response arrival, the conservative choice recorded for the terminal channel.
4. **Budget fit.** Web's steady-state subscription channels are session, session type, one package-event channel per admitted notice-reaction descriptor, transient entity-options families, and mounted terminals. That stays well under 32; a `connection_channel_limit` or capacity error is surfaced as a connection diagnostic, not retried.
5. **Reconnect replay semantics.** Reconnect issues fresh subscribe requests per peer generation, so every reconnect produces fresh reservations, labels, and generations. Web never reuses a label.
6. **No DTO regeneration.** The vendored `daemon-protocol.ts` already equals the installed 0.1.43 artifact (`npm test` drift check passes at base). If Implement finds drift, it records the exact installed sha256 and re-vendors from the installed package, not from a Hub checkout.

Unknowns for Implement to resolve against the code, not to invent:

- Whether the per-channel assembly should allow more than one in-flight `message_id`. Hub's entity and event loops send one frame at a time on an ordered channel, so a single assembly per binding, as the terminal binding does, is the expected shape; Implement confirms with the fixture and live traces.
- Whether `subscription.ready` rejection on a pre-admission failure needs an `entity_error`-shaped surface frame in addition to the connection diagnostic. Implement keeps whatever the session route already renders for a rejected `ready` and records the choice.

## 6. Affected surfaces and files

Botster layers touched: React SPA transport (`src/botster`), browser diagnostics, unit tests, live packaged harness, docs. No plugin, Lua, Hub, Core, or TUI change.

Changed:

- `src/botster/webrtcDaemonClient.ts` — reservation read in `startEntitySubscription` and `startPackageEventSubscription`; a shared reserved-channel opener generalized from `openTerminalChannel` (label, ordered, Hello, ack, expiry bound, stale checks, per-binding assembly); entity and event bindings with class-specific delivery routing; close and forget by generation; control-channel rejection of entity and package-event deliveries; `resetPeerState` closing all classes; harness events and transport control.
- `src/botster/connectionDiagnostics.ts` — diagnostic kinds for reservation missing, channel rejected, channel expired, channel closed.
- `src/botster/hubTransport.ts` — contract comments; no projection change.
- `src/botster/realHubDaemonDto.ts` — `DaemonSubscriptionReservation` re-export if the existing pattern requires it.
- `src/App.test.mjs` — fake peer and channel helpers already auto-ack Hellos on created channels; entity and event fixtures move to created channels; new checks in section 8.
- `scripts/live-packaged-protocol-harness.mjs`, `scripts/live-packaged-protocol-helpers.mjs` — reservation, label fidelity, one-document reconnect, and saturation oracles.
- `docs/architecture.md`, `README.md` — transport description; budgets table gains the per-channel entity and event assembly rows.
- `docs/plans/consume-dedicated-entity-and-package-event-datachannels.md` (this plan), `docs/reports/implement-consume-dedicated-entity-and-package-event-datachannels.md` (Implement report).

Not changed: `src/botster/hubTerminalDataPlane.ts`, `src/botster/TerminalViewHost.tsx`, `src/vendor/restty/**`, `src/app/**` routing and chrome, `src/botster/generated/daemon-protocol.ts`, `package.json`, `package-lock.json`, the local package server.

## 7. Risks

1. **Cold-cut breakage window.** Web `main` is already incompatible with Hub `main` for entities and events. A partial landing leaves the session list empty. Mitigation: land reservation read, channel creation, admission, delivery routing, control-channel rejection, and close-by-generation in one branch; gate advance on the live packaged harness against Hub `080ca9a`.
2. **Reservation expiry race.** A slow browser can open after 30 seconds and Hub closes it silently, with only a control-channel observation. Mitigation: Web arms its own bound, rejects `ready`, records a diagnostic, and never retries the same label.
3. **Resubscribe loop under overflow.** Hub closes an entity channel on aggregate overflow; a naive reconnect could loop. Mitigation: the one-shot `resubscribing` guard, and the flood lane asserts no more than one resubscribe per close observation.
4. **Test fixture drift.** Twenty-one fixture sites emit entity frames or events on the fake control channel today; leaving any of them would keep a dead path green. Mitigation: acceptance check 12 requires the control channel to reject those deliveries, so a stale fixture fails.
5. **Harness oracle drift.** Reconnect, membership-gap, and flood lanes read `webrtc_entity_subscription`, `webrtc_entity_frame_assembly`, and `daemon_event` events. Mitigation: those event families keep their names and payloads and gain a `label`; new `subscription_data_channel` events are separate families per [[adding harness event families changes every mixed family oracle]].
6. **Saturation lane workload identity.** The existing flood lane sends its mid-flood control request over the Unix socket, which proves Hub progress but not the browser control DataChannel. Mitigation: section 8 requires the control probe through the browser's control channel and keeps the Unix probe as a second observation.
7. **Channel budget.** Entity-options demand and multiple notice descriptors could approach 32 channels on busy routes. Mitigation: refcounted holders already collapse duplicates; a capacity error is a visible diagnostic, and Implement records the peak channel count from the harness.

## 8. Acceptance checks and tests

Repository gates, all required: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run smoke:browser-runtime`, and the three Hub-free terminal smokes (`smoke:mounted-terminal-keyboard`, `smoke:ghostsnp-grid`, `smoke:incremental-ghostsnp-attach`) to prove the terminal path is untouched.

Unit and component checks in `src/App.test.mjs`:

1. `subscribe_entities` on the WebRTC bridge creates no channel before the response resolves, and the response without `subscription_reservation` rejects `ready` with a diagnostic and creates no channel.
2. The created entity channel label equals the reserved label byte for byte, the channel is `{ ordered: true }`, exactly one channel exists per subscription, and Web never parses the label.
3. The same two checks for `subscribe_events` and its package-event channel.
4. The subscription Hello is one encrypted envelope with `protocol` and host `compatibility`; the binding is unusable until `DaemonHelloAck`; `ready` still resolves only on the authoritative `entity_snapshot` delivered on the entity channel.
5. Entity deltas delivered on the entity channel apply in order; a sequence gap on the channel still triggers exactly one resubscribe with a fresh id and a fresh reservation.
6. `package_event` and `event_gap` delivered on the package-event channel reach the holder; a delivery for a stale generation, a different subscription id, or a mismatched owner and name is discarded with the existing discard event.
7. Open timeout: a channel that never opens or never receives an ack within `expires_in_seconds` is closed and forgotten, `ready` rejects, and no second channel is created for that reservation.
8. Stale open: a reservation whose response lands after the peer generation advanced, after the owner unsubscribed, or after a replacement subscription started creates no channel or closes it immediately, and any late ack is ignored.
9. Remote close after admission: entity close runs one resubscribe (fresh id, new reservation, new channel); event close runs one fresh `subscribe_events`; neither replays notices.
10. Unsubscribe closes and forgets the channel and then sends `unsubscribe_entities` or `unsubscribe_events`; a frame arriving after that is ignored.
11. Peer loss closes every entity, event, and terminal binding together; reconnect issues fresh subscribes, reservations, and channels, and `replayHubStatusOnLifecycleEvent` still fires on the new control channel.
12. The control channel fails closed on a `daemon_entity_frame` delivery and on a `package_event` or `event_gap` host event, and no production code path in `src/` consumes entity frames or package events from the control channel.
13. Delivery kind fidelity: a bound entity channel rejects non-entity deliveries; a bound event channel rejects non-event deliveries and non-package event types.
14. `armDropNextInboundEntityFrame` still drops exactly one matching delta on the channel path and records `webrtc_entity_frame_harness_drop`.
15. Two sibling entity subscriptions keep independent channels; closing one leaves the other delivering, and a terminal binding is unaffected by either.

Live production-path proof, against a real Hub built from `main` at `080ca9a`:

- `npm run smoke:live-packaged-protocol` proves, through the compiled production bundle, that the session entity subscription returns a reservation, Web creates the labeled channel, Hub admits it, and the authoritative snapshot and deltas arrive on that channel while the control channel carries no entity frames.
- `npm run smoke:package-events` proves the package-event reservation and channel, `subjects: [viewedSessionId]`, notice delivery, and `npm run smoke:package-events:gap` proves `event_gap` on the event channel with the isolated Hub child in test mode.
- `npm run smoke:entity-options-reactive` and `npm run smoke:workspaces-lifecycle` prove demand-scoped entity families each get their own channel and release it.
- One-document reconnect: extend `proveInPageReconnectReplaysHubStatus` (which closes the real control channel in place and keeps the document sentinel) to require, in the new peer generation, a fresh `subscribe_entities` for `session`, a fresh reservation with a different label, a new entity channel `open`, a fresh `entity_snapshot` on that channel, and the same for the package-event subscription, with the old bindings observed `closed`. Page reload is not reconnect proof.
- Saturation: extend the package-events flood lane so that during the 200-event burst (which also upserts entity items on the entity channel) the lane proves, separately and with the published limits, that a `status` request sent through the browser control channel round-trips within 10,000 ms, that terminal input echo completes within 15,000 ms, that terminal output progress is observed in the same window through a sustained-output marker on the terminal channel (positive control per [[rejected channel isolation needs a surviving channel positive control]]), that entity reconciliation completes within 15,000 ms, that received events and notices never exceed emitted events, that no terminal channel closes, and that at most one entity resubscribe follows any Hub overflow close. Keep the Unix-socket control probe as a second observation; do not use the retired term `event_saturation`.
- Red-on-revert controls: removing the entity-channel delivery routing must fail the live snapshot assertion; restoring control-channel entity delivery in a fixture must fail check 12; removing the reconnect resubscribe must move the first failure to the reconnect assertion.

Downstream proof required by the charter: the packaged-browser and live-hub lanes above are the browser-consumer conformance evidence. Record the exact `botster-hub` commit, the installed `@trybotster/hub-test-support` metadata, and the peak subscription channel count in the Implement report.

## 9. Runtime-teardown lenses

`teardown_class_applies`: yes. The ticket creates per-subscription WebRTC channels for entity and package-event routes, each with its own admission, expiry, close, and retirement, and it moves durable subscription delivery onto those channels.

`teardown_isolation`: the ownership set that dies with one entity or event channel is exactly one reservation, one Hub-minted generation, one local binding with its assembly state, and one `ready` promise. A failed, rejected, or overflowed channel must not close the control channel, the peer connection, any terminal channel, or any sibling subscription channel. Peer loss closes every binding of that peer generation, which is correct because the peer owns them.

`teardown_bounds`: every close path is bounded. The open and admission bound is `expires_in_seconds` armed from the reservation response. Channel close is `RTCDataChannel.close()`, which does not block, and Web never awaits a Hub response to complete local teardown. Unsubscribe requests keep the existing request bound (`requestTimeoutMs`) and their failure never blocks forgetting the channel. Per-binding assembly has the existing `requestTimeoutMs` bound. No teardown path waits without a bound.

`late_message_matrix`:

| Message | Direction | Owner tag | Reject after terminal failure | Sweep on race |
|---|---|---|---|---|
| `subscribe_entities` / `subscribe_events` | Web to Hub, control | subscription id, peer generation | Response for a superseded peer generation or closed owner is dropped and its reservation is never opened | Dropped reservations expire on Hub and are retired there; Web holds nothing |
| Reservation response | Hub to Web, control | label, generation, peer generation, subscription id | Ignored when the peer generation advanced, the owner closed, or a replacement subscription started | If it lands after unsubscribe, Web opens no channel and sends no second unsubscribe |
| Subscription channel open | Web to Hub | label | Hub closes `Unknown`, `Stale`, `Bound`, `OverLimit`, `Expired`; Web closes on its own expiry bound | Web forgets the label on close and never reuses it |
| `DaemonHelloAck` | Hub to Web, subscription | binding identity | Ignored on a forgotten binding | Forgotten binding is closed, not revived |
| `daemon_entity_frame` | Hub to Web, entity channel | binding identity, subscription id, peer generation | Frames for a non-current generation or mismatched subscription id are discarded | Per-binding assembly state dies with the binding |
| `daemon_event` (`package_event`, `event_gap`) | Hub to Web, event channel | binding identity, subscription id, owner, name | Discarded for a closed holder, stale generation, or mismatched identity | Holder state dies with the binding |
| `unsubscribe_entities` / `unsubscribe_events` | Web to Hub, control | subscription id | Sent once after local close; failure is logged, never retried | Existing fire-and-forget bookkeeping is preserved |
| `runtime_observation` close and reject kinds | Hub to Web, control | free text | Recorded as diagnostics only; never drives state | None needed |
| Remote channel close | Hub to Web | binding identity | Bound-and-current bindings run the one-shot resubscribe; stale bindings are only forgotten | A close for an earlier generation must not touch a binding owned by a later generation |

`production_path_proof`: the exact path is `hubTransport.ensureSessionEntitySubscription` to `subscribeEntityFrames` to `startEntitySubscription` to control `subscribe_entities` to reservation response to `RTCPeerConnection.createDataChannel(label)` to encrypted Hello to `DaemonHelloAck` to chunked `daemon_entity_frame` assembly to `receiveEntityFrame`, and the parallel `subscribePackageEvents` path to `daemon_event` assembly to holder dispatch; on teardown, unsubscribe, peer loss, expiry, or remote close to per-binding close to forget to idle. Live oracles are the packaged and package-event harness lanes in section 8, driven through the compiled production bundle, plus the red-on-revert controls. A fixture-only assertion is not accepted as proof.

`ownership_identity`: every durable row is keyed by subscription id, Hub-minted generation, and peer generation; the reserved label is the channel identity. A reused subscription id under a later generation or peer generation never matches an older binding. A delayed close for one binding must never close or resubscribe a binding owned by a later generation or peer. Owner sweeps cover both close-first and message-first orders.

`sibling_fail_closed_policy`: on successful close of one subscription channel, the peer, the control channel, terminal channels, and sibling subscription channels keep working. On ultimate close failure of one channel, Web forgets it locally and continues; it must not tear down the peer. Peer-level failure remains Hub's bounded policy per [[Hub ultimate WebRTC close failure sacrifices every peer on the dedicated runtime]]. Unit check 15 covers sibling survival; the flood lane covers overflow close isolation.

## 10. Vault gaps worth capturing

Candidates, to capture at Implement or Verify, not now:

1. That a closed entity or package-event channel means the Hub subscription is retired, so the only browser recovery is a fresh subscribe with a fresh id. This extends [[botster subscriptions use dedicated ordered DataChannels]] with the consumer-side recovery rule.
2. That the subscription-channel Hello on non-terminal channels carries only `protocol` and host `compatibility`, and that Hub checks nothing else there. This refines [[WebRTC terminal admission requires an encrypted DataChannel Hello]] for entity and event classes.
3. That Hub reports subscription-channel rejections and expiries only as control-channel `runtime_observation` strings (`subscription_channel_rejected:<reason>:<label>`, `entity_subscription_closed:<id>:<gen>:<reason>`, `package_event_subscription_closed:<id>:<gen>:<reason>`), which are diagnostics and not typed client state.
4. That the Web flood lane's control probe must travel the browser control DataChannel to prove browser control progress; a Unix-socket probe proves Hub progress only. This refines [[egress saturation and request saturation are different workloads]].
5. That the Web `main` between the Hub cold cut and this ticket was silently broken for entities because `ready` waits forever without a timeout on the control-channel snapshot; a subscription readiness bound may deserve its own note.
