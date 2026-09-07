# botster-web architecture

`botster-web` is an Ionic React client over Botster Hub/Core contracts. It renders structured state and dispatches semantic actions; it does not own runtime, session, package, plugin, or terminal truth.

## Client layers

- `src/botster/client.ts` composes UI-tree, entity-store, action, and injected transport seams.
- `src/botster/hubRuntime.ts` composes the single production WebRTC runtime. A missing bootstrap grant fails closed into a rendered danger diagnostic.
- `src/botster/webrtcDaemonClient.ts` owns bootstrap refresh, signaling, encrypted ordered DataChannel delivery, reconnect generations, and browser-created subscription channels.
- `src/botster/hubTransport.ts` consumes canonical package-surface types from `@trybotster/ui-contract` and projects Hub-sanitized daemon package/navigation responses plus unmodified session DTO fields into canonical entity family `session`. Manifest parsing, admission, and lifecycle classification remain Hub-owned.
- `src/botster/hubTerminalDataPlane.ts` owns one terminal route: it decodes Core scheme 2 terminal bodies, orders the attach phases, bounds pending output, runs the in-flight input window, and reports every input outcome.
- `src/botster/terminalInputCapture.ts` and `terminalInputEvents.ts` observe keyboard, IME, pointer, wheel, focus, and paste at the terminal container and produce one Web semantic input record per gesture. `terminalInputEncoding.ts` maps those records onto the generated Core input encoders and key, modifier, and button tables.
- `src/botster/resttyRenderer.ts` and `botsterTerminalPtyTransport.ts` run Restty as a render-only terminal model. Restty's own key and mouse encoders still serve its local behavior; their bytes stop at the PTY transport sink.
- `src/botster/entities.ts`, `uiNodes.ts`, and `actions.ts` implement the canonical read, render, and semantic-dispatch seams. `uiNodes.ts` imports the Hub-owned declarations from `@trybotster/ui-contract`; it does not redeclare a browser wire grammar.
- `src/botster/uiPresentation.ts` owns the browser-local presentation projection, scoped by Hub/package/surface. Only correlated accepted `UiActionResult` operations mutate it.
- `src/botster/TerminalViewHost.tsx` mounts Restty, forwards attach, detach, resize, and readback operations, and shows the latest non-written input outcome.

## Production transport

Installed package runtime uses one ordered WebRTC control DataChannel and one ordered DataChannel for each terminal, entity, and package-event subscription. Every channel opens with an encrypted host-control v9 `ClientFrame` Hello and waits for the `ServerFrame` Hello ack. Control deliveries are JSON text chunks of one encrypted `ServerFrame`: a correlated response, a host event, an entity frame, or a typed close reason.

Host requests are `ClientFrame` requests with a client-chosen `request_id`: a decimal u64, strictly increasing per connection generation, starting at 1. Web keys pending work by connection generation and `request_id`; Hub may complete requests out of order. Web holds the 33rd outstanding request locally until a slot frees. A frame Web cannot correlate is a protocol error and closes the connection, which takes the ordinary reconnect path.

Web sends `Attach` on the control channel. Hub returns a terminal reservation with an opaque label, a subscription generation, and a peer generation. Web creates one ordered DataChannel with that exact label, sends its Hello, and waits for the ack. After admission the channel carries binary chunks only: a 33-byte header (`version`, `message_id`, `chunk_index`, `chunk_count`, `total_bytes`, the fixed attachment `generation`, and the Core `stream_epoch`) followed by one AES-GCM sealed slice of the plaintext body. Hub to Web the body is one Core scheme 2 terminal body; Web to Hub it is one Core input frame with `stream_epoch` 0. No JSON or base64 touches terminal bytes. A chunk whose generation differs from the reservation is stale data from a retired subscription and is discarded.

Session state uses a held entity subscription and canonical family `session`:

1. Each peer generation sends a fresh `subscribe_entities` request.
2. The matching authoritative snapshot establishes the family baseline, including an empty snapshot.
3. Ordered upsert, patch, and remove deltas update the entity store.
4. Stale-generation frames are discarded.
5. A delta before its snapshot or a sequence gap forces resubscription.

There is no HTTP daemon client, SSE terminal stream, polling, `list_sessions` hydration, or lifecycle-event projection fallback.

Terminal data stays outside `HubControlFrame` and outside the shared control DataChannel. One route delivers, in order: ATTACH_STATE attached, MODES, SNAPSHOT_READY, live OUTPUT interleaved with SNAPSHOT_HISTORY, SNAPSHOT_FINISH, then OUTPUT, and PROCESS_EXIT last. The data plane feeds READY and history frames to Restty's incremental GHOSTSNP reader, holds live OUTPUT until FINISH within the client pending bound (256 frames or 8 MiB), and then applies output in arrival order. The GHOSTSNP finish record is the last history page; the empty SNAPSHOT_FINISH closes the boundary. HISTORY_UNAVAILABLE arrives only after READY: the visible screen stays, the history decoder is released, and the attach completes with incomplete history at SNAPSHOT_FINISH. A capture failure before READY arrives as ATTACH_STATE failed and earns one fresh attach with a new subscription id, then a visible failure. Continuity within one attachment is a stream epoch: the accepted epoch is 0 from ATTACH_STATE attached, a ROUTE_RESYNC (`from_epoch`, `to_epoch`) is accepted only when `from_epoch` equals the accepted epoch and its envelope epoch equals `to_epoch`, stream-state frames with any other epoch are dropped, and INPUT_RESULT is correlated by operation id regardless of epoch. A lost snapshot page or a pending-bound overflow re-attaches this route once with a new subscription id. ReadScreen and paged CaptureSnapshot are host-control readback only.

Input is semantic. The container capture reports key press, release, and repeat with the W3C `code`, modifiers, committed text, and IME composition state; pointer press, release, and motion with cell and backing-store pixel position; wheel steps as wheel-button presses; focus changes; and resize with pixel size. Authoritative MODES decide whether pointer and wheel gestures are captured for the application or left to Restty's local selection and scrollback. The data plane assigns operation ids from 1 per attach, keeps at most 32 operations in flight per route, queues up to 2 MiB locally, and reports every INPUT_RESULT outcome; nothing waits on an acknowledgement and nothing is retried. Clipboard paste is one operation (PASTE_BEGIN, chunks, PASTE_COMMIT) with one assembling paste per route. Restty mounts as a pure renderer (`readOnly`) and does not answer OSC color queries. `terminal_subscription_closed` arrives only as a control-channel `ServerFrame` event.

Package-event commands stay on the Hub control channel. Hello requires `package_event_subscriptions`. The route-owned connection holds one `subscribe_events` per admitted `DaemonPackage.notice_reactions` descriptor. Owner and name come from the descriptor. A session-scoped descriptor subscribes with the viewed session subject and sends no subscription when no session is viewed. Hub returns a reservation after admission. Web creates the exact ordered channel, sends an encrypted Hello, and accepts only `package_event` or `event_gap` deliveries on that channel. Web calls `resolveNoticeText` from `@trybotster/ui-contract@0.3.3` and maps declared severity onto Ionic toast colour (`info` to `medium`, `warning` to `warning`, `error` to `danger`). Declared `ttl_ms` is clamped to 1,000 through 60,000 milliseconds. `event_gap` records a connection diagnostic and leaves entity state unchanged. Durable package state remains package-entity driven. Reconnect issues a fresh subscription id and does not replay notices.

Published Web event-plane budgets:

| Budget | Value | Source |
| --- | --- | --- |
| Outstanding host requests | 32 per connection | `hostControlRequestLimits.maxOutstandingRequests` |
| Terminal delivery assembly | 1 message per terminal channel | `TerminalChannelBinding.assembly` |
| Pending terminal output during snapshot history | 256 frames or 8 MiB per route | `MAX_PENDING_TERMINAL_ITEMS`, `MAX_PENDING_TERMINAL_BYTES` |
| In-flight input operations | 32 per route, 2 MiB queued locally | `MAX_INFLIGHT_INPUT_OPERATIONS`, `MAX_QUEUED_INPUT_BYTES` |
| Reconnect delay | 250 ms to 8 s, capped exponential, cancelled by disconnect | `localWebrtcReconnectPolicy` |
| Entity delivery assembly | 1 message per entity channel | `SubscriptionChannelBinding.assembly` |
| Package-event delivery assembly | 1 message per package-event channel | `SubscriptionChannelBinding.assembly` |
| Host request round-trip | 10,000 ms | `localWebrtcResponseChunkLimits.requestTimeoutMs` |
| Entity reconciliation deadline | 15,000 ms | live packaged harness standing wait ceiling |
| Terminal echo round-trip deadline | 15,000 ms | live packaged harness standing wait ceiling |

Hub identity is a `DaemonStatus` projection on family `botster-web.hub_status`, never a package row. `software`, `installation`, `host_id`, `schema_version`, and `compatibility` all come from the status response, and `check_hub_update` is the only Hub self-update read. The family is registered as an active pull and replayed when the data channel reopens, so protocol, conformance, and schema facts do not regress after reconnect. `DaemonHubUpdate` has exactly three states — `current`, `available`, `unavailable`. Offline and error are rejected-action-result outcomes, never a fourth state.

## Local package server

`scripts/local-package-server.mjs` reports readiness only after binding. For each HTML load it requests a fresh initial WebRTC grant from Hub using the actual bound origin, validates the returned transport contract, and injects package-runtime/bootstrap metadata. The browser uses the same server to forward only:

- `issue_local_webrtc_bootstrap`
- `local_webrtc_signal`

All other POST requests are rejected. The server has no terminal endpoint and is not a control-plane fallback.

## Renderer boundaries

Ionic owns the shell and layout. Canonical `UiNode` snapshots carry structure,
entity frames carry dynamic model state, and `UiActionRequest` carries intent.
The identity-matched Hub-validated `ui_tree_snapshot.body` passes to the
renderer without translation into a second browser vocabulary. `bind_list`
reads the generic entity store, including nested row context, while
`presentation_if` reads the scoped local presentation projection.

Bind-list identity has one materialization order. The direct item-template root
retains its item-relative `$bind`; after that root becomes a nonblank literal,
`bind_list_descendant_id` children call the runtime helper exported by
`@trybotster/ui-contract@0.3.3`. Test assets come from `@trybotster/hub-test-support@0.1.45` (host protocol 9, conformance revision-49), vendored verbatim from Hub 3fd9905 into `test-support/hub-test-support` as a `file:` dev dependency until Hub publishes it. Host DTOs come from the Hub-generated `daemon-protocol.ts` and Core terminal
codecs, key tables, and feature tokens from the Core-generated `terminal-protocol.ts`, both
copied verbatim into `src/botster/generated/`. Web never hand-maintains a protocol definition.
Nested bind lists establish a new nearest-row context. Web never encodes,
parses, normalizes, indexes, or repairs those identities.

Before React rendering or action collection, the renderer checks authored
descendant keys across each complete item template and checks literal ids across
the nodes that actually coexist after binding and conditional evaluation.
Mutually exclusive alternatives may reuse a final literal id; coexisting roots,
rows, descendants, static nodes, and slots may not. A malformed descendant or
collision produces one bounded surface diagnostic and zero action callbacks.
Direct rows whose root `$bind` is missing, non-string, or blank remain omitted
individually because they never enter the realized identity set.

Every rendered plugin action crosses the daemon boundary as
`{ package_name, request }`. Form controls place drafts in `request.values`;
`request.payload` retains only the authored non-form metadata. Rejected,
deferred, and error results preserve the current tree and presentation state.
Rejected normalized values and field/form errors return to the owning Ionic
form. An accepted result may apply presentation `set`/`clear`/`toggle` and
replace the whole surface root. `node_id` correlates the request and result
only; it never defines an inline patch target. Clients never infer these
effects from toast copy or refetch the surface.

Plugin surfaces remain host-rendered or isolated assets according to
Hub-provided descriptors. Renderer-neutral surface and manifest-navigation
vocabulary comes from `@trybotster/ui-contract`; Hub-projected navigation rows
carry admitted route/diagnostic state, while the Ionic shell owns placement and
click routing.

Restty is a terminal renderer only. It does not receive UI/entity frames or own session lifecycle.

## Hosting

Cloud or Rails hosting may serve the same bundle and relay signaling configuration, but it must not become the owner of Botster runtime state.
