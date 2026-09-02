# botster-web architecture

`botster-web` is an Ionic React client over Botster Hub/Core contracts. It renders structured state and dispatches semantic actions; it does not own runtime, session, package, plugin, or terminal truth.

## Client layers

- `src/botster/client.ts` composes UI-tree, entity-store, action, and injected transport seams.
- `src/botster/hubRuntime.ts` composes the single production WebRTC runtime. A missing bootstrap grant fails closed into a rendered danger diagnostic.
- `src/botster/webrtcDaemonClient.ts` owns bootstrap refresh, signaling, encrypted ordered DataChannel delivery, reconnect generations, and browser-created subscription channels.
- `src/botster/hubTransport.ts` consumes canonical package-surface types from `@trybotster/ui-contract` and projects Hub-sanitized daemon package/navigation responses plus unmodified session DTO fields into canonical entity family `session`. Manifest parsing, admission, and lifecycle classification remain Hub-owned.
- `src/botster/hubTerminalDataPlane.ts` adapts WebRTC daemon requests and Core `TerminalEvent`s from `daemon_terminal_frame` into `TerminalDataPlaneAttachment`.
- `src/botster/entities.ts`, `uiNodes.ts`, and `actions.ts` implement the canonical read, render, and semantic-dispatch seams. `uiNodes.ts` imports the Hub-owned declarations from `@trybotster/ui-contract`; it does not redeclare a browser wire grammar.
- `src/botster/uiPresentation.ts` owns the browser-local presentation projection, scoped by Hub/package/surface. Only correlated accepted `UiActionResult` operations mutate it.
- `src/botster/TerminalViewHost.tsx` mounts Restty and forwards measured input, resize, attach, detach, and readback operations.

## Production transport

Installed package runtime uses one ordered WebRTC control DataChannel and one ordered DataChannel for each terminal, entity, and package-event subscription. The first encrypted control-channel send after AES-GCM is `DaemonHello` with independent host and Core terminal compatibility. Control-channel `DaemonLocalWebrtcDeliveryChunk` frames carry correlated daemon responses and small lifecycle `daemon_event`s. The control channel rejects terminal, entity, and package-event data-plane deliveries.

Web sends `Attach` on the control channel. Hub returns a terminal reservation with an opaque label, a subscription generation, and a peer generation. Web then creates one ordered DataChannel with that exact label. Web sends an encrypted `DaemonHello` on the new channel and waits for `DaemonHelloAck`. The admitted channel carries only Core binary input frames and version 2 `daemon_terminal_frame` delivery chunks. Each chunk records `message_id`, `chunk_index`, `chunk_count`, and `total_bytes`. Web encrypts each complete Core frame before it splits the envelope into chunks.

Encrypted payloads remain generated `DaemonRequest`, `DaemonResponse`, `DaemonHello`/`DaemonHelloAck`, `DaemonEntityFrame`, Core `TerminalEvent`, or host `DaemonEvent` DTOs.

Session state uses a held entity subscription and canonical family `session`:

1. Each peer generation sends a fresh `subscribe_entities` request.
2. The matching authoritative snapshot establishes the family baseline, including an empty snapshot.
3. Ordered upsert, patch, and remove deltas update the entity store.
4. Stale-generation frames are discarded.
5. A delta before its snapshot or a sequence gap forces resubscription.

There is no HTTP daemon client, SSE terminal stream, polling, `list_sessions` hydration, or lifecycle-event projection fallback.

Terminal data stays outside `HubControlFrame` and outside the shared control DataChannel. After terminal-channel admission, the Hub terminal data plane imports authoritative GHOSTSNP Snapshot bytes into Restty (H0–H5), buffers live output across install, reads mode flags for ModeGatedInput, and never imports Scrollback as renderer state. ReadScreen is an optional supplement only. Restty mounts as a pure renderer (`readOnly`) and does not answer OSC color queries in the browser. A lost PAGE starts a fresh Attach with a new reservation and decoder. `terminal_subscription_closed` arrives only as a control-channel `daemon_event`.

Package-event commands stay on the Hub control channel. Hello requires `package_event_subscriptions`. The route-owned connection holds one `subscribe_events` per admitted `DaemonPackage.notice_reactions` descriptor. Owner and name come from the descriptor. A session-scoped descriptor subscribes with the viewed session subject and sends no subscription when no session is viewed. Hub returns a reservation after admission. Web creates the exact ordered channel, sends an encrypted Hello, and accepts only `package_event` or `event_gap` deliveries on that channel. Web calls `resolveNoticeText` from `@trybotster/ui-contract@0.3.3` and maps declared severity onto Ionic toast colour (`info` to `medium`, `warning` to `warning`, `error` to `danger`). Declared `ttl_ms` is clamped to 1,000 through 60,000 milliseconds. `event_gap` records a connection diagnostic and leaves entity state unchanged. Durable package state remains package-entity driven. Reconnect issues a fresh subscription id and does not replay notices.

Published Web event-plane budgets:

| Budget | Value | Source |
| --- | --- | --- |
| Terminal delivery assembly | 1 message per terminal channel | `TerminalChannelBinding.assembly` |
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
`@trybotster/ui-contract@0.3.3`. Host DTOs and revision-48 shared conformance
fixtures come from `@trybotster/hub-test-support@0.1.43`. Core terminal types,
binary input encoders, and feature tokens come from `@trybotster/terminal-protocol@0.3.0`. Web does
not pin a Hub Git revision for terminal compatibility.
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
