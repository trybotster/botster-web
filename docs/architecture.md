# botster-web architecture

`botster-web` is an Ionic React client over Botster Hub/Core contracts. It renders structured state and dispatches semantic actions; it does not own runtime, session, package, plugin, or terminal truth.

## Client layers

- `src/botster/client.ts` composes UI-tree, entity-store, action, and injected transport seams.
- `src/botster/hubRuntime.ts` composes the single production WebRTC runtime. A missing bootstrap grant fails closed into a rendered danger diagnostic.
- `src/botster/webrtcDaemonClient.ts` owns bootstrap refresh, signaling, encrypted ordered data-channel delivery, reconnect generations, and session entity subscriptions.
- `src/botster/hubTransport.ts` projects daemon DTO responses and pushed entity frames into the web client’s UI/action/entity seams.
- `src/botster/hubTerminalDataPlane.ts` adapts WebRTC daemon requests and drained terminal events into `TerminalDataPlaneAttachment`.
- `src/botster/entities.ts`, `uiNodes.ts`, and `actions.ts` implement the canonical read, render, and semantic-dispatch seams.
- `src/botster/TerminalViewHost.tsx` mounts Restty and forwards measured input, resize, attach, detach, and readback operations.

## Production transport

Installed package runtime uses one ordered WebRTC data channel. Generated `DaemonLocalWebrtcDeliveryChunk` frames multiplex correlated daemon responses and unsolicited entity frames. Encrypted payloads remain generated `DaemonRequest`, `DaemonResponse`, or `DaemonEntityFrame` DTOs.

Session state uses a held entity subscription:

1. Each peer generation sends a fresh `subscribe_entities` request.
2. The matching authoritative snapshot establishes the family baseline, including an empty snapshot.
3. Ordered upsert, patch, and remove deltas update the entity store.
4. Stale-generation frames are discarded.
5. A delta before its snapshot or a sequence gap forces resubscription.

There is no HTTP daemon client, SSE terminal stream, polling, `list_sessions` hydration, or lifecycle-event projection fallback.

Terminal data stays outside `HubControlFrame`. The WebRTC client attaches and drains terminal events, while the Hub terminal data plane restores visible `read_screen` text before buffered live output. Snapshot/scrollback payloads remain opaque metadata and are never rendered as terminal text.

## Local package server

`scripts/local-package-server.mjs` serves the compiled SPA, injects package-runtime/bootstrap metadata, reports readiness, and forwards only:

- `issue_local_webrtc_bootstrap`
- `local_webrtc_signal`

All other POST requests are rejected. The server has no terminal endpoint and is not a control-plane fallback.

## Renderer boundaries

Ionic owns the shell and layout. UiNode snapshots carry structure, entity frames carry dynamic model state, and semantic action bindings carry intent. Plugin surfaces remain host-rendered or isolated assets according to hub-provided descriptors.

Restty is a terminal renderer only. It does not receive UI/entity frames or own session lifecycle.

## Hosting

Cloud or Rails hosting may serve the same bundle and relay signaling configuration, but it must not become the owner of Botster runtime state.
