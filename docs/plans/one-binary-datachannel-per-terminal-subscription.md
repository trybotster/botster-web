# Web: use one binary DataChannel for each terminal subscription

Ticket: `ticket_1787600676_914408`
Run: `run_1788280072_109337`
Target repository: `botster-web` (`trybotster/botster-web`)
Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`
Base ref: `main` at `1ba0892` (revision 1). Revision 2 requires rebase onto `origin/main` head `9045c65` or later before Implement.

Plan **revision 2** (2026-09-02). Human answer `question_1788360464_355242` (Option A) folded ticket `ticket_1788332653_879489` ("Web: send every WebRTC terminal input as version 2 delivery chunks") into this ticket and requires a renewed Plan Review. The folded ticket's run `run_1788360181_843411` and this revision share one Plan -> Implement path.

## 0. Revision 2 corrections

| Revision 1 statement | Revision 2 correction |
| --- | --- |
| Section 2.3: browser to Hub sends one bare `AesGcmEnvelope` per message with no chunk wrapper. | Obsolete. Hub candidate `0417317412804ee172c6abe29cf03b80e195554a` (`src/transport/webrtc/subscription_channel.rs::run_bound_terminal_channel`, `src/transport/webrtc/delivery.rs::InboundTerminalEnvelopeAssembly`) accepts only version 2 `DaemonLocalWebrtcDeliveryChunk` frames with `delivery_kind: "daemon_terminal_frame"` on a bound terminal channel. A bare envelope fails chunk parsing and closes the route. Web encrypts one complete Core input frame, then sends the serialized envelope as version 2 chunks. A small envelope uses `chunk_count=1`. There is no size-based raw fallback. Rule: [[WebRTC input delivery chunks reassemble encrypted Core frames before decryption]]. |
| Section 5 unknown, risk 3, vault gap 3: Web picks a body cap and splits a large paste into ordered input frames. | Obsolete. Core owns multi-frame input transactions. Web calls `encodePaste` from `@trybotster/terminal-protocol@0.3.0` and defines no client split policy. Rule: [[core owns bounded atomic terminal input transactions across clients]]. The transport-size problem is solved by delivery chunks, not by shrinking Core frames. |
| Section 4: dependencies on `@trybotster/hub-test-support@0.1.42` and `@trybotster/terminal-protocol@0.2.0`. | Superseded by published `@trybotster/hub-test-support@0.1.43` (protocol 8, conformance revision 48, `daemon-protocol.ts` sha256 `33c0c27941c0e9751342cfdbeb53d27bb4a1225e5ce7f4be280d9f0dc11ad7f3`) and `@trybotster/terminal-protocol@0.3.0` (conformance revision 2, `transport=duplex_binary`, `encodePaste`, `encodePasteAbort`, `MAX_PASTE_BYTES = 1048576`, `MAX_PASTE_CHUNKS = 17`). Both coordinates resolve on npm (`npm view` on 2026-09-02). Their publish tickets are closed. |
| Section 4: this ticket waits on Hub `ticket_1788313897_932611`. | Reversed. Dependency `dependency_1788313923_570971` was removed. Hub `ticket_1788313897_932611` now depends on this ticket. Web merges first, verified against Hub candidate `0417317412804ee172c6abe29cf03b80e195554a`. Hub then runs its official gate against merged Web. The cross-repository incompatibility until Hub merges is the accepted cold-cut window. |
| Section 2.4: `mode_gated_input` result on the control plane. | `DaemonModeGatedInputResult` no longer exists in 0.1.43. Mode freshness comes only from `input_result` frames on the terminal channel. |

Everything below is revision 1 text with revision 2 edits applied inline where the table above requires them.

## 1. Repository routing and context loaded

Repository charter: [[botster-web-playbook]].

Role playbooks: [[planner-playbook]], [[botster-planner-playbook]].

Mandatory Botster maps (revision 2, added after Plan Review finding `finding_1788361738_358186`): [[botster-architecture]], [[cli-patterns]], [[spa-patterns]]. Also loaded: [[project-pipelines-playbook]], because this revision changes cross-repository dependency edges and artifact policy.

Reconciliation against those maps:
- [[botster-architecture]] confirms the frozen split this plan follows: [[core owns duplex terminal transport while Hub stays content blind]], [[core owns bounded atomic terminal input transactions across clients]], [[botster subscriptions use dedicated ordered DataChannels]], and [[the browser creates each subscription DataChannel after Hub reserves its label]]. No conflict. It also confirms `encodePaste` ownership sits in Core, which is why section 5 withdraws the client split.
- [[cli-patterns]] is a mixed-generation index and is not ownership authority here; its current-generation entries ([[tui and browser are equal clients]], [[botster data plane bypasses the hub through session and client actors]], [[botster web dto field names must match authoritative rust serde structs]]) agree with this plan. TUI consumes the same Core duplex contract through `ticket_1787603674_865638`, so the Web sender must not encode client-specific semantics.
- [[spa-patterns]] supplies the reconnect and hydration constraints this plan preserves: [[a page reload is not a reconnect]] governs acceptance, and [[botster browser pull requests must retry after webrtc reconnect]] plus [[botster hub client state sync is entity frame only]] keep terminal recovery separate from entity hydration. No conflict.
- [[project-pipelines-playbook]] governs the dependency and artifact hygiene applied in section 4 and in the gate evidence for this revision.

Class overlay: [[botster runtime teardown lenses]]. This ticket is runtime-teardown class. Section 9 answers every required field.

Targeted atomic notes:

- [[botster subscriptions use dedicated ordered DataChannels]]
- [[the browser creates each subscription DataChannel after Hub reserves its label]]
- [[the pinned Rust WebRTC peer cannot open a DataChannel created after the SCTP handshake]]
- [[WebRTC terminal admission requires an encrypted DataChannel Hello]]
- [[WebRTC adapter admission uses a Hello feature string not a generated DTO token]]
- [[core owns duplex terminal transport while Hub stays content blind]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[public protocol versions host control and Core terminal planes independently]]
- [[botster Web serializes terminal input behind Hub responses]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[in-flight cancel needs one Web Detach owner]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[reused browser transports replay the live hub mode]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[a ui contract import line change costs one test line in each generic client]]
- [[Web vendors a complete Restty build from the approved commit]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[production incremental reader tests must cover the public handle swap path]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[rejected channel isolation needs a surviving channel positive control]]
- [[a ready WebRTC send must win over a queued DataChannel close]]
- [[WebRTC DataChannel local close uses the peer close bound before cleanup]]
- [[Core terminal subscription ownership is session, subscription, and generation]]

Repository context read in `botster-web`: `src/botster/webrtcDaemonClient.ts`, `src/botster/hubTerminalDataPlane.ts`, `src/botster/hubTransport.ts`, `src/botster/protocolPlanes.ts`, `src/botster/generated/daemon-protocol.ts`, `scripts/check-daemon-protocol-drift.mjs`, `package.json`, `README.md`, `docs/plans/`.

Authoritative producer context read outside the target repository, for contract facts only:

- `botster-hub` at `b4020a9`: `crates/botster-hub-client/src/lib.rs`, `src/admission/reservations.rs`, `src/transport/webrtc/subscription_channel.rs`, `src/transport/webrtc/peer.rs`, `src/transport/webrtc/delivery.rs`, `src/daemon/control/sessions.rs`, `packages/hub-test-support/metadata.json`.
- `botster-core` at `e5a927c`: `crates/botster-terminal-protocol/src/input_frame.rs`, `crates/botster-terminal-protocol/src/frame.rs`, `crates/botster-core/src/contract/terminal_adapter.rs`, `packages/terminal-protocol/terminal-protocol.ts`, `packages/terminal-protocol/metadata.json`.
- (revision 2) Re-read for the corrections in section 0: `botster-hub` candidate `0417317412804ee172c6abe29cf03b80e195554a` (`src/transport/webrtc/subscription_channel.rs::run_bound_terminal_channel`, `src/transport/webrtc/delivery.rs::InboundTerminalEnvelopeAssembly`) and the published packages `@trybotster/hub-test-support@0.1.43` and `@trybotster/terminal-protocol@0.3.0`. The revision-1 commits above stay recorded as the provenance of the revision-1 statements; where section 0 marks a statement obsolete, the candidate is authority.

## 2. Producer contract this plan consumes

These are measured facts from the two producer repositories, not assumptions.

### 2.1 Reservation

`DaemonRequest::Attach { session_id, subscription_id }` stays a Hub control request. On an admitted WebRTC peer, Hub no longer returns attach events. It returns
`DaemonResponse { kind: "terminal_reservation", terminal_reservation: DaemonTerminalReservation }`.

`DaemonTerminalReservation` fields: `session_id`, `subscription_id`, `generation` (Core-minted), `peer_generation` (Hub peer), `label` (opaque, exact), `expires_in_seconds` (30 by default).

Failure form is `attach_bind_operator_error` with code `reservation_label_conflict` or `invalid_request`.

### 2.2 Channel creation and admission

The browser creates one reliable ordered `RTCDataChannel` with the exact reserved `label`. Hub's `on_data_channel` routes every non-first channel to `admit_reserved_subscription_channel`, which:

1. Inspects the reservation. `Unknown`, `Bound`, or `Expired` closes the channel with the bounded peer close.
2. Waits for one encrypted `DaemonHello`. The Hello arrives as a bare `AesGcmEnvelope` JSON message, with no delivery-chunk wrapper.
3. Requires `hello.protocol == "botster-hub-daemon-v1"`. When `hello.terminal_compatibility` is present, Hub checks it against Core's `TerminalCompatibility::current()`. Hub does **not** re-check `webrtc_terminal_adapter` on the subscription channel; that feature stays a control-channel Hello requirement.
4. Replies with `DaemonHelloAck`, framed as chunked delivery frames.
5. Binds the reservation to a Core adapter. Any bind failure closes the channel.

### 2.3 Wire shapes on a bound subscription channel

- Hub to browser: chunked `DaemonLocalWebrtcDeliveryChunk` with `delivery_kind: "daemon_terminal_frame"`, each chunk an AES-GCM envelope. The reassembled payload is a Core `TerminalFrame`: JSON with `type` in `snapshot`, `terminal_output`, `process_exit`, `attach_state`, `input_result`.
- Browser to Hub (revision 2): Web encodes one compact-binary `TerminalInputFrame` with the Core package, encrypts it as one `AesGcmEnvelope`, serializes the envelope to JSON, and sends that serialized text as version 2 `DaemonLocalWebrtcDeliveryChunk` frames with `delivery_kind: "daemon_terminal_frame"`. Hub (candidate `0417317`) validates each chunk before assembly: `version == 2`, kind `daemon_terminal_frame`, non-empty `message_id` of at most 256 bytes, `chunk_count >= 1`, `total_bytes >= 1` and at most 16,777,216, `chunk_count <= total_bytes`, non-empty payload, `chunk_index` strictly sequential from 0 for one `message_id` at a time on the route, each serialized chunk strictly below 65,536 bytes, and the concatenated payload length exactly `total_bytes`. A completed `message_id` cannot be reused on the route. Any violation, interleaving of two message ids, or duplicate chunk closes the terminal channel (fail closed). Hub decrypts only the complete envelope and pushes the plaintext Core frame to Core ingress without decoding it.
- The subscription-channel `DaemonHello` from the browser is still one bare `AesGcmEnvelope`; only bound terminal traffic is chunked. The asymmetry is Hello versus bound traffic, not egress versus ingress.
- Chunk sizing: the Hub producer uses 12,288 payload bytes per chunk (`LOCAL_WEBRTC_CHUNK_PAYLOAD_BYTES`, mirrored in the published `local-webrtc-delivery-chunk-conformance-fixture.json` as `chunk_payload_bytes`). Web uses the same payload size so the fixture's `large_generated` scenario (262,145 bytes -> 22 chunks) is a direct oracle. A keystroke envelope (about 100 bytes serialized) is one chunk. A maximum input frame (65,535-byte body, about 87 KiB serialized after base64 and JSON) is 8 chunks. `message_id` is unique per subscription channel and per generation (a monotonic counter with the channel identity prefix, never derived from terminal content).

`TerminalInputFrame` layout: `byte0 = 1` scheme, `byte1 = kind` (1 `input`, 2 `mode_gated_input`, 3 `resize`), `bytes 2..4 = u16 big-endian body length`, then body. Mode-gated body is `u64` big-endian `mode_generation`, `u64` big-endian `mode_revision`, then data. Resize body is `u16` big-endian rows then `u16` big-endian cols.

`@trybotster/terminal-protocol@0.3.0` publishes `encodeTerminalInput`, `encodeModeGatedInput`, `encodeResize`, `encodePaste(operationId, modeGeneration, modeRevision, data)` (returns Begin, ordered Chunk frames, Commit), `encodePasteAbort(operationId)`, `TERMINAL_INPUT_SCHEME_VERSION`, `MAX_INPUT_DATA_BYTES = 65535`, `MAX_MODE_GATED_DATA_BYTES = 65519`, `MAX_PASTE_CHUNK_DATA_BYTES = 65527`, `MAX_PASTE_BYTES = 1048576`, `MAX_PASTE_CHUNKS = 17`, `FEATURE_TRANSPORT_DUPLEX_BINARY`, `TerminalInputKind`, `TerminalInputRejection`, and the `TerminalInputResult` event type (`kind`, optional `operation_id`, `admitted`, `bytes_written`, `mode_generation`, `mode_revision`, `mode_flags`, optional `rejection`). Web must not hand-write these encoders or a paste split. Paste operation ids strictly increase per terminal subscription generation. Each paste frame is its own encrypted envelope and its own chunked delivery; the frames are sent in encoder order on the ordered channel.

### 2.4 Removed Hub surface

`DaemonRequest::SendInput`, `DaemonRequest::ModeGatedInput`, and `DaemonRequest::Resize` no longer exist in `botster-hub-client`. The `mode_gated_input` feature token no longer exists in `DaemonCompatibility::current()`.

Current `main` of `botster-web` therefore cannot complete a Hello against current `botster-hub`: `src/botster/protocolPlanes.ts` still lists `mode_gated_input` in `requiredHostFeatures`. This is a live incompatibility, not a future risk.

`ReadScreen`, `ReadModeFlags`, `CaptureSnapshot`, `Detach`, `Drain`, and `terminal_subscription_closed` all remain on the Hub control plane and stay there.

## 3. Scope

In scope, in `botster-web` only:

1. Consume the reservation response. Replace the attach-events read in `webrtcDaemonClient.ts` `streamTerminal` with a `terminal_reservation` read that records `label`, `generation`, `peer_generation`, and `expires_in_seconds`.
2. Create exactly one reliable ordered `RTCDataChannel` per admitted terminal subscription, with the exact reserved label, only after the reservation response arrives.
3. Send the encrypted `DaemonHello` on that channel and await `DaemonHelloAck` before the channel is usable.
4. Assemble `daemon_terminal_frame` deliveries per subscription channel and decode Core terminal frames straight into the existing Restty hydration and live-output path.
5. Send input, mode-gated input, resize, and paste (`encodePaste`, `encodePasteAbort`) as Core binary `TerminalInputFrame` messages on that channel, with no Hub request/response pacing.
5a. (revision 2) Send every encrypted Core input frame through one shared sender that serializes the envelope and emits version 2 `daemon_terminal_frame` delivery chunks with exact `message_id`, `chunk_index`, `chunk_count`, `total_bytes`, and per-chunk size below 65,536 serialized bytes. `chunk_count=1` for small envelopes. No bare-envelope or size-based fallback.
6. Delete the `terminalInputQueue` response-serialized path and every Web use of `send_input`, `mode_gated_input`, and `resize` daemon requests.
7. Remove `mode_gated_input` from `requiredHostFeatures` and add `transport=duplex_binary` to `requiredTerminalFeatures`.
8. Track mode freshness and stale-mode rejection from `input_result` frames instead of request responses. Keep `read_mode_flags` on the control channel as the pre-input seed.
9. Close and forget a channel for a rejected, timed-out, stale, replaced, or retired reservation, and for detach, exit, cancel, and peer loss.
10. Bump the vendored `src/botster/generated/daemon-protocol.ts` to the `@trybotster/hub-test-support@0.1.43` artifact, pin `@trybotster/hub-test-support@0.1.43` and `@trybotster/terminal-protocol@0.3.0`, and update the exact package, protocol 8, revision-48, and terminal revision-2 literals in `src/App.test.mjs`. Update `README.md` and `docs/architecture.md` package and revision claims to match installed metadata.
11. Extend `src/App.test.mjs` and the browser and live harnesses with the acceptance checks in section 8.

Explicitly out of scope:

- Any fallback that carries terminal bytes on the shared control channel. The cut is cold.
- Per-subscription SDP renegotiation. `createDataChannel` after the SCTP handshake is a browser-side capability; the browser is the creating peer for exactly this reason.
- Entity and package-event dedicated channels. Those belong to `ticket_1787600684_892051` (Web) and `ticket_1787600682_233928` (Hub).
- Any change in `botster-hub` or `botster-core`, except the two package publications registered as dependencies in section 4.
- Restty vendoring changes. `ticket_1787600689_646958` closed that work.
- Renderer, layout, or terminal-chrome behavior changes.

## 4. Ownership boundaries and cross-repository dependencies

Ownership stays as the charter defines. `botster-web` owns browser connection lifecycle, channel creation, generated DTO consumption, and Restty integration. Hub owns reservation, admission, and binding. Core owns terminal generations, snapshot phases, input admission, and every frame body. Web must not decode a reservation label, must not invent terminal event shapes, and must not apply retry policy to terminal bytes.

Existing closed dependencies, already satisfied:

- `ticket_1787894427_525056` — Hub: cold-cut wake-driven duplex terminal transports. Closed. It landed the reservation registry, the subscription channel, and the removal of the three daemon requests.
- `ticket_1787600689_646958` — Web: vendor the current Restty revision. Closed.

Stale lockstep reference in the ticket body: `ticket_1787600674_500120` is closed as *Superseded: Hub terminal DataChannel work absorbed by direct cold cut*. Its coordinated merge window, DTO-renewal clause, and run-branch artifact clause no longer have a live counterpart. The equivalent obligation transfers to the two package publications below, and to recording the exact `botster-hub` and `botster-core` commits consumed.

Revision 2 package state: `@trybotster/hub-test-support@0.1.43` (ticket `ticket_1788282899_502914`, closed, registered as dependency `dependency_1788361894_603499` against `tgt_7e208a0c76a44980a83b63af976b1f22` after Plan Review finding `finding_1788361738_106185`) and `@trybotster/terminal-protocol@0.3.0` (ticket `ticket_1788313903_124535`, closed) are published. The 0.1.42 and 0.2.0 dependency edges are satisfied and superseded. No local artifact substitution is needed or allowed.

Revision 2 ordering: Hub `ticket_1788313897_932611` depends on this ticket. Web verifies against Hub candidate `0417317412804ee172c6abe29cf03b80e195554a` built from source and records that exact commit. Web merges first. Hub then runs its official gate against merged Web. Until Hub merges, current Hub `main` and merged Web are incompatible; that is the accepted cold-cut window (human answer `question_1788360464_355242`).

## 5. Assumptions and unknowns

Assumptions, stated explicitly:

1. "Binary DataChannel" in the ticket title means the Core binary `TerminalInputFrame` ingress path, not an `RTCDataChannel` in `binaryType` mode. The producer wire is AES-GCM envelope JSON text in both directions; the browser-to-Hub plaintext is binary. Encryption and chunking follow the producer exactly.
2. Core terminal *output* frames stay JSON `TerminalFrame` bodies. The ticket phrase "Core binary terminal output frames" refers to the byte-faithful `payload_base64` output the browser decodes; it does not ask Web to invent a binary egress codec that no producer emits.
3. "The Core contract declares the subscription ready" means an `attach_state` frame with `state: "attached"` on the subscription channel. The existing GHOSTSNP hydration barrier stays in front of it, per [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]].
4. Mode-flag seeding before the first input keeps using the `read_mode_flags` control request. That request still exists on Hub. After the first input, `input_result.mode_generation`, `input_result.mode_revision`, and `input_result.mode_flags` are the freshness source.
5. One terminal subscription per mounted terminal remains the product shape. `hubTerminalSubscriptionId` stays the identity seed.

Unknowns for Implement to resolve against the code, not to invent:

- (revision 2) Resolved: a maximum Core frame exceeds the 65,536-byte WebRTC frame ceiling after encryption, so the sender chunks the serialized envelope (section 2.3). Web does not cap the Core body below `MAX_INPUT_DATA_BYTES` and does not split paste; `encodePaste` owns paste framing.
- Whether the reservation `expires_in_seconds` timer should be armed from response arrival or from a monotonic clock read taken before the request. Implement must choose the conservative one and record it.
- (revision 2) Resolved: **a queued resize is sent before the first queued input.** Evidence in current `src/botster/hubTerminalDataPlane.ts`: hydration completion fires `void this.flushPendingResizeBestEffort(attachmentGeneration)` un-awaited (line ~1020) while input waits on `hydration.barrier` inside `enqueueTerminalInput` (line ~614). Both release at the same completion point, so today the order is decided by microtask luck. Under revision 2 both become frames on one ordered channel, so send order becomes the observable contract and the race becomes a real defect. Core applies ingress frames in arrival order, so an input admitted before the resize is interpreted at the pre-resize geometry and echoes at the wrong width. Rule: Implement moves the pending-resize flush onto the same ordered queue as input, ahead of any queued input, instead of firing it with `void`. Acceptance item 10a proves it.

## 6. Affected surfaces and files

Changed:

- `src/botster/webrtcDaemonClient.ts` — reservation read, per-subscription channel creation, subscription Hello and ack, per-channel delivery assembly, binary ingress send, per-channel close and forget.
- `src/botster/hubTerminalDataPlane.ts` — delete `terminalInputQueue` and the three daemon request paths; send through the subscription channel; consume `input_result`; keep the hydration barrier, the serial terminal event queue, and the single Detach owner.
- `src/botster/hubTransport.ts` — `DaemonTerminalStreamSubscription` gains the channel identity it must abandon; `streamTerminal` contract comment updated.
- `src/botster/protocolPlanes.ts` — drop `mode_gated_input`; add `FEATURE_TRANSPORT_DUPLEX_BINARY`.
- `src/botster/generated/daemon-protocol.ts` — regenerated from the recorded Hub commit.
- `src/botster/realHubDaemonDto.ts` — `DaemonTerminalReservation` re-export; drop the removed request and `mode_gated_input` result types.
- `src/botster/terminal.ts`, `src/botster/botsterTerminalPtyTransport.ts` — input and resize call shapes if the encoder signature requires it.
- `package.json`, `package-lock.json` — the two package pins.
- `src/App.test.mjs` — unit and component coverage for section 8.
- `src/botster/incrementalGhostsnpAttachSmoke.ts`, `scripts/incremental-ghostsnp-attach-browser-smoke.mjs`, `scripts/mounted-terminal-keyboard-smoke.mjs` — fake bridges that still answer `read_mode_flags` and now must answer a reservation and a channel.
- `scripts/live-packaged-protocol-harness.mjs`, `scripts/live-packaged-protocol-helpers.mjs`, `scripts/live-shared-session-browser-driver.mjs` — live oracles for reservation, label fidelity, isolation, and stale closure.
- `README.md`, `docs/architecture.md` — package and revision claims, and the terminal transport description.

Not changed: `src/vendor/restty/**`, `src/botster/resttyRenderer.ts`, `src/botster/terminalGrid.ts`, `src/app/**` routing and chrome, entity and package-event paths.

## 7. Risks

1. **Cold-cut breakage window.** `main` of `botster-web` is already incompatible with current `botster-hub`. Any partial landing leaves the terminal dead. Mitigation: land reservation, channel, admission, egress decode, binary ingress, and the version 2 chunk sender in one branch, and gate advance on the live packaged harness against Hub candidate `0417317`. Web merges first; the Hub window in section 4 is the accepted asymmetry.
2. **Reservation expiry race.** A slow browser can open the labeled channel after 30 seconds. Hub then closes it silently. Mitigation: Web arms its own bound, treats expiry as attach failure with a visible diagnostic, and does not retry on the same reservation.
3. **Message-size ceiling.** Any Core frame above roughly 48 KiB exceeds the 65,536-byte WebRTC frame ceiling once encrypted and serialized. Mitigation: the version 2 chunk sender in section 2.3, proven by the fixture oracle and a live paste above 65,535 bytes. A chunk-metadata defect closes the terminal channel on the Hub side, so the live proof must assert the channel survives the paste.
4. **Lost input-result correlation.** Input no longer has a response. A dropped or reordered `input_result` must not deadlock typing. Mitigation: input is fire-and-forget on an ordered channel; `input_result` updates freshness and drives stale-mode retry only, and never gates the next keystroke.
5. **Channel leak on rapid remount.** Session switching, reload, and replacement can strand channels. Mitigation is the ownership identity and sweep in section 9.
6. **Cross-repository package and pin state (revision 2).** Every consumed package is published and every publication ticket is closed: `@trybotster/hub-test-support@0.1.43` (`ticket_1788282899_502914`) and `@trybotster/terminal-protocol@0.3.0` (`ticket_1788313903_124535`). No dependency edge holds this run. The residual risk is pin drift, not availability: Implement must verify the installed metadata still reports protocol 8 / conformance 48 and terminal conformance 2 at the moment it vendors `daemon-protocol.ts`, because Hub candidate `0417317` is a source build and can move before it merges.
7. **Harness drift.** Fixture bridges that never create a channel will pass while production fails. Mitigation: the acceptance checks in section 8 require production-path proof, and the isolation check requires a positive control per [[rejected channel isolation needs a surviving channel positive control]].

## 8. Acceptance checks and tests

Repository gates, all required:

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- `npm run smoke:browser-runtime`.
- `npm run smoke:mounted-terminal-keyboard`, `npm run smoke:ghostsnp-grid`, `npm run smoke:incremental-ghostsnp-attach`.

Unit and component checks in `src/App.test.mjs`:

1. Attach consumes `terminal_reservation` and creates no channel before the response resolves.
2. The created channel label equals the reserved label byte for byte, and Web never parses or derives meaning from it.
3. The channel is reliable and ordered, created once per subscription, and never reused across generations.
4. The subscription Hello is a single encrypted envelope carrying `protocol` and `terminal_compatibility`, and the channel stays unusable until `DaemonHelloAck` arrives.
5. Typing sends kind-1 frames with correct scheme, kind, and big-endian length, with no daemon request in flight.
6. Mode-gated input sends kind-2 frames with big-endian `u64` generation and revision.
7. Resize sends kind-3 frames with big-endian rows and cols.
8. A paste above 65,535 bytes produces exactly the `encodePaste` frame sequence (Begin, ordered Chunk frames, Commit) with one strictly increasing operation id per subscription generation, and `encodePasteAbort` is sent for an abort before Commit.
8a. (revision 2) Chunk sender unit and fixture proof: for a keystroke envelope the sender emits one chunk with `chunk_index 0`, `chunk_count 1`, `total_bytes` equal to the serialized envelope byte length, `version 2`, `delivery_kind daemon_terminal_frame`; for a maximum input frame it emits more than one chunk with sequential indexes, a shared `message_id`, equal `chunk_count` and `total_bytes`, every serialized chunk strictly below 65,536 bytes, and concatenated payloads equal to the serialized envelope; reassembling those payloads and decrypting yields the exact Core frame bytes; the published fixture `large_generated` scenario (12,288 payload bytes, 262,145 total, 22 chunks, sha256 `06d24e206edb54bed524319b1127725b46e20ea4aae5934688599abd42fa4317`) reproduces through the same sender chunker; `message_id` values never repeat on one channel; no bare-envelope send path exists in `src/`.
9. `input_result` with `rejection: "stale_mode"` refreshes modes and re-sends exactly once; it never re-sends through an ungated path.
10. Input before `attach_state: "attached"` stays queued behind the barrier; input after it goes straight out.
10a. (revision 2) Queue a resize and then an input while the hydration barrier is still closed. When the barrier opens, the production sender emits the kind-3 resize frame strictly before the kind-1 input frame on the same ordered channel, observed at the chunk sender rather than at the caller. Assert the same order when the resize is queued after the input call but before the barrier opens, because geometry must settle before content either way. A red control that restores the un-awaited `void this.flushPendingResizeBestEffort(...)` flush must fail this check.
11. Chunked `daemon_terminal_frame` deliveries reassemble per channel and decode into the existing Restty path, with the GHOSTSNP install still preceding buffered live bytes.
12. Rejected, expired, stale, replaced, and retired reservations each close the channel and forget it, with no retry on the same label.
13. Two sibling terminal subscriptions keep independent channels; closing one leaves the other delivering.
14. Public cancel still produces exactly one `Detach` for the held subscription.
15. `send_input`, `mode_gated_input`, and `resize` do not appear as daemon request types anywhere in `src/`, and `terminalInputQueue` is gone.
16. `requiredHostFeatures` omits `mode_gated_input`; `requiredTerminalFeatures` includes `transport=duplex_binary`; the generated import assertion line is updated once.

Live production-path proof, against a real Hub at the recorded commit:

- `npm run smoke:live-packaged-protocol` (isolated packaged Hub built from candidate `0417317412804ee172c6abe29cf03b80e195554a`) proves reservation, channel creation, admission, typing, resize, sustained output, large history, and process exit through the production transport, and proves one paste above 65,535 bytes arrives byte-exact with a single admitted `input_result` of kind `paste` while the terminal channel stays open.
- The caller-owned shared-session lane (`npm run smoke:live-packaged-protocol:shared-session`) proves the same typing and paste path through the production sender. These are the two smoke paths the folded ticket names.
- Reconnect proof closes the DataChannel on the surviving document and requires a fresh reservation, a fresh label, and a fresh generation. Page reload is not reconnect on this lane.
- `npm run smoke:live-packaged-protocol:shared-session` keep-alive and exit passes stay green, including `live-shared-session-cancel-passed`.
- Isolation proof: while a terminal channel carries output, a second rejected-label channel receives nothing, and the surviving channel receives a same-window payload marker as the positive control.
- Negative control: reverting the binary ingress send must fail the typing oracle, not merely change a log line.

Downstream proof required by the charter: the packaged-browser and live-hub lanes above are the browser-consumer conformance evidence. Record the exact `botster-hub` commit, `botster-core` commit, and both package coordinates in the Implement report.

## 9. Runtime-teardown lenses

`teardown_class_applies`: yes. The ticket creates a new per-subscription WebRTC channel with its own lifecycle, admission, and closure, and it moves durable terminal ownership onto that channel.

`teardown_isolation`: the ownership set that dies with one subscription channel is exactly one reservation, one Core-minted generation, one Restty hydration, and one pending resize. A failed or rejected channel must not close the Hub control channel, the peer connection, or any sibling subscription channel. Sibling terminals keep delivering. Peer loss closes every subscription channel, which is correct because the peer owns them.

`teardown_bounds`: every close path is bounded. The reservation open bound is `expires_in_seconds` from the reservation response. The Detach request keeps the existing `DETACH_REQUEST_BOUND_MS` bound, equal to `requestTimeoutMs`. Channel close is `RTCDataChannel.close()`, which does not block; Web must never await a Hub response to complete local teardown. If a Hello ack never arrives, the arming bound fires, Web closes and forgets the channel, and attach fails with a visible diagnostic. No teardown path waits without a bound.

`late_message_matrix`:

| Message | Direction | Owner tag | Reject after terminal failure | Sweep on race |
|---|---|---|---|---|
| `Attach` | Web to Hub, control | session id, subscription id, attachment generation | Response for a superseded generation is dropped and its reservation is never opened | Stale attach abort routes through the single Detach owner |
| Reservation response | Hub to Web, control | label, generation, peer generation | Dropped when the plane detached, the generation advanced, or the transport was lost | If it lands after detach, Web opens no channel and sends no Detach for a route it never bound |
| Subscription channel open | Web to Hub | label | Hub closes `Unknown`, `Bound`, `Expired`; Web closes on its own expiry bound | Web forgets the label on close and never reuses it |
| `DaemonHelloAck` | Hub to Web, subscription | channel identity | Ignored on a channel Web already forgot | Forgotten channel is closed, not revived |
| `daemon_terminal_frame` | Hub to Web, subscription | channel identity, subscription id, generation | Frames for a non-current generation are dropped, not rendered | Per-channel assembly state is discarded with the channel |
| `TerminalInputFrame` | Web to Hub, subscription | channel identity | Not sent after close or before ack | Encoder result is discarded if the channel closed while encoding |
| `input_result` | Hub to Web, subscription | subscription id | Ignored for a non-current generation | Freshness state dies with the channel |
| `Detach` | Web to Hub, control | session id, subscription id | Sent exactly once by the single Detach owner | Existing abandoned-detach bookkeeping is preserved |
| `terminal_subscription_closed` | Hub to Web, control | session id, subscription id, generation | Surfaced verbatim, never refetched | Closes and forgets the matching channel |

`production_path_proof`: the exact path is `HubTerminalDataPlane.attach` to `bridge.streamTerminal` to control `Attach` to reservation response to `RTCPeerConnection.createDataChannel(label)` to encrypted Hello to `DaemonHelloAck` to bound duplex traffic; and on teardown, terminal signal to per-channel close to reservation forget to idle. The live oracles are the packaged and shared-session harnesses in section 8, driven through the compiled production bundle, plus a red-on-revert control. A fixture bridge assertion alone is not accepted as proof.

`ownership_identity`: every durable row is keyed by session id, subscription id, and Core-minted generation, per [[Core terminal subscription ownership is session, subscription, and generation]]. Web adds `peer_generation` and the reserved label as the channel identity. A delayed close for one identity must never close a channel now owned by a later generation or a later peer. Reused subscription ids are disambiguated by generation and peer generation together, never by subscription id alone.

`sibling_fail_closed_policy`: on successful close of one subscription channel, the peer, the control channel, and all sibling channels keep working. On ultimate close failure of one channel, Web forgets it locally and continues; it must not tear down the peer. Peer-level failure remains Hub's existing bounded policy per [[Hub ultimate WebRTC close failure sacrifices every peer on the dedicated runtime]]. A test covers the sibling-survival case and the forget-on-failed-close case.

## 10. Vault gaps worth capturing

Candidates, to capture at Implement or Verify, not now:

1. (revision 2) The subscription-channel Hello is one bare `AesGcmEnvelope`, while every bound terminal message in both directions is version 2 delivery chunks. [[WebRTC input delivery chunks reassemble encrypted Core frames before decryption]] records the bound-traffic rule; the Hello exception is not yet recorded.
2. That the subscription-channel Hello checks `protocol` and optional terminal compatibility only, and does not repeat the `webrtc_terminal_adapter` feature check. This refines [[WebRTC terminal admission requires an encrypted DataChannel Hello]] for the dedicated-channel case.
3. (revision 2) Withdrawn. The client does not split paste; delivery chunks carry maximum Core frames.
4. That Hub `Attach` now answers with a reservation rather than attach events on the WebRTC plane, which supersedes the Web attach-events read.
5. That `input_result` replaces request-response mode freshness for browser clients, superseding [[botster Web serializes terminal input behind Hub responses]] once this ticket lands.
6. (revision 2) Web sender chunk payload size equals the Hub producer's 12,288 bytes so one published fixture is the oracle for both directions.
7. (revision 2) A Web ticket premise that names a component absent from every branch must be checked against `origin/main` and open sibling plans before planning; this fold is the example.
