# botster-web architecture

`botster-web` is an Ionic React client shell over Botster hub/core contracts. It renders structured state; it does not own runtime truth, terminal truth, plugin policy, workflow orchestration, or cloud hosting policy.

## Client Layers

- `src/botster/client.ts` composes the browser-side contract, exports `botsterWebClientContract`, and provides `createBotsterWebClient()` for runtime UiNode/entity/action ingestion through an injected hub transport.
- `src/botster/dogfoodMode.ts` selects fixture mode by default and real-hub mode only when both `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub` are present.
- `src/botster/localDogfoodTransport.ts` is the deterministic fixture adapter. It emits `ui_tree_snapshot` plus entity frames, accepts semantic `action_request` frames, and returns success or validation-error `action_result` frames.
- `src/botster/realHubDogfoodTransport.ts` is the browser adapter for the local real-hub dogfood bridge. It sends verbatim `botster-hub-client` `DaemonRequest` JSON payloads through a transport-only HTTP envelope, receives verbatim `DaemonResponse` JSON payloads, and only then normalizes into existing `ui_tree_snapshot`, entity, action, and operator-error seams. Real-hub app rows from `DaemonRequest::ListApps` are normalized into `botster-web.app` for launcher UI, including structured launch targets, lifecycle state, blocked reasons, diagnostics, and app action descriptors. Real-hub package registry records from `DaemonRequest::ListPackages` are normalized into `botster-web.package`, including hub-provided dependency/feature gates and package action descriptors. Hub-returned marketplace rows are normalized into `botster-web.available_package`; botster-web does not infer app or package lifecycle, dependency, auth, install, update, or launch policy from browser-local state.
- `src/botster/realHubTerminalDataPlane.ts` adapts a held daemon attach stream plus input, resize, and detach DTOs into `TerminalDataPlaneAttachment` callbacks for Restty. It also owns explicit typed `read_screen` and `capture_snapshot` request helpers whose results never enter Restty or `TerminalOutput`.
- `src/botster/protocol.ts` names control-plane hub frames, lifecycle ingress, injected transport, and replayable surface subscription placeholders. These are adapter placeholders, not a replacement for the external botster-core wire contract.
- `src/botster/entities.ts` implements the in-memory entity frame store seam. It is pull-hydrated by view demand, with active pulls replayed after reconnect.
- `src/botster/uiNodes.ts` names the `ui_tree_snapshot` renderer registry seam. Renderers receive structural UI snapshots plus live entity stores.
- `src/botster/actions.ts` implements semantic action dispatch with `action_request` / `action_result` correlation. Action ids are Botster intents, not DOM events.
- `src/botster/terminal.ts` names the Restty-backed `terminal_view` bridge. Restty is a renderer only.
- `src/botster/pluginSurfaces.ts` names the host-owned sandbox seam for plugin surfaces.

## Protocol Boundaries

Control-plane hub frames enter through `protocol.ts`. This scaffold names the canonical frame families the web client must handle, including `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `action_request`, and `action_result`, while keeping adapter payloads narrow until an integration ticket reconciles them against external botster-core and wire-v2 sources.

Entity stores are the canonical read-model channel. Subscribe establishes the transport only; opened routes and surface bindings request the route registry, UI tree snapshots, and entity families they need. Reconnect handling replays the mounted view's active pulls and surface subscriptions instead of assuming subscribe globally hydrates state. Full `entity_snapshot` frames reset the family baseline even when their sequence is lower than a prior delta; delta frames obey the family sequence gate.

The current client factory still requires an injected transport. The production app uses `createDogfoodRuntimeConfig()` so node tests exercise the same fixture-vs-real selection branch that `src/App.tsx` uses. Fixture mode is the default; package runtime selects local WebRTC when the hub injects a bootstrap grant, and falls back to the real-hub bridge harness only when that grant is absent. Vite real-hub bridge mode still requires the build-time environment opt-in plus the runtime query parameter.

The real-hub bridge is a same-device dev/test harness over `botster-hub-client`, not a new product protocol and not the authoritative production browser data plane. Browsers cannot speak Unix sockets directly, so `scripts/real-hub-dogfood-bridge.mjs` owns browser reachability, harness fallback request correlation, and the local `local_webrtc_signal` request used during bootstrap. Request/response operations use a transport-only HTTP envelope around daemon DTOs, and terminal output uses `/terminal` Server-Sent Events backed by one held daemon socket so attach and drain share the same subscription lifecycle. The embedded payload stays the daemon DTO shape from `botster-hub-client`: `DaemonRequest`, `DaemonResponse`, and daemon terminal events.

The production package transport is `src/botster/webrtcDaemonClient.ts`. It consumes the generated `DaemonLocalWebrtcBootstrap`, sends a generated `local_webrtc_signal` daemon request with the browser SDP offer, opens an ordered `RTCDataChannel`, and carries JSON `AesGcmEnvelope` values over the channel. The encrypted plaintext is the existing generated `DaemonRequest` / `DaemonResponse` protocol, including terminal attach, drain, resize, input, process-exit, and shutdown frames. The checked TypeScript DTO artifact in `src/botster/generated/daemon-protocol.ts` is copied from the authoritative hub-client generated artifact; WebRTC DTOs are not maintained by hand in botster-web.

The packaged live protocol harness defaults to WebRTC. After a same-URL browser reload renews the WebRTC bootstrap, it explicitly attaches to the existing session and requires renderable `snapshot.data` or `scrollback.data` to reach Restty before it checks continued live output, input, resize, and exit behavior. It also invokes explicit mounted `read_screen` and `capture_snapshot` controls injected by Playwright and validates their response identity and metadata. The reattach-history path is shipped behavior; the readback controls are conformance-readiness scaffolding with no production invocation. The bridge only serves the package and local signaling on this path.

Terminal data-plane traffic stays out of the hub control-plane envelope. PTY bytes, scrollback, snapshots, and terminal egress belong to session/client actor data-plane adapters in Botster core. The web seam declares a Restty-backed `terminal_view` bridge plus a mock subscription-style data-plane adapter for this scaffold; it does not add terminal byte frames to `HubControlFrame`.

Compatibility diagnostics keep the current five functional daemon features required. The published `@trybotster/hub-test-support@0.1.3` artifact now provides the generated typed `read_screen` and `capture_snapshot` contracts plus the late-attach fixture, and botster-web exercises them through Playwright-only mounted harness controls. Because shipped browser behavior does not invoke either operation, `terminal_readback` remains optional: a compatible descriptor without it receives a warning alongside the compatible-success row, while a hub-emitted `unsupported_feature` or `compatibility_mismatch` diagnostic carried on the hub-status record takes precedence and suppresses the locally synthesized compatibility rows. The hand-owned minimum conformance fixture revision remains 1 even though the package fixture provenance is revision 10.

The Restty bridge is mounted by the production app path through `src/botster/TerminalViewHost.tsx`. The host measures its bounded Ionic panel with `ResizeObserver`, forwards rows/columns through the bridge, and unmounts by detaching subscriptions before destroying the renderer instance. In real-hub mode those resize, input, attach, and drain operations go through `TerminalDataPlaneAttachment`, not hub control frames. The vendored Restty bundle lives under `src/vendor/restty/` and is built from the `trybotster/restty` fork.

## Renderer Boundaries

Ionic owns the app shell, navigation, toolbar, and layout containers. Botster UI primitives remain cross-client semantic nodes rendered by browser-specific adapters, with TUI parity preserved by shared primitive and action vocabulary.

`ui_tree_snapshot` carries structure. Plugin-owned dynamic model state remains in entity frames and can be referenced by `ui.bind` or `ui.bind_list`-style bindings. The renderer threads entity stores into composite rendering rather than treating UI snapshots as data payloads. `src/App.tsx` now constructs the runtime client from the tested dogfood mode helper, subscribes to `botster-web.dogfood.session`, renders the received snapshot with `UiNodeSurface`, and dispatches semantic UiNode actions back through the client.

Actions are semantic Botster events such as `botster.session.select` and `botster.session.stop`. React clicks or keyboard handlers can trigger those actions, but DOM event names are not the shared action contract.

`terminal_view` remains separate from the `UiNodeRendererRegistry`. Restty renders terminal panes only; UiNode/action/entity frames remain the dynamic product UI contract.

## Plugin Surface Sandboxing

Plugin surfaces are mounted through a host-owned sandbox seam. The current descriptor distinguishes host-rendered surfaces from isolated plugin assets without choosing an iframe, worker, or asset bridge implementation prematurely. Plugin-owned execution and product policy remain outside this client shell.

Host-rendered plugin surfaces dispatch `UiAction.payload` through `plugin_surface_action` while keeping package, surface, and action ids as route metadata. For table rows, botster-web renders row-specific `UiTableRow.action` as the operable per-row action. Table-level `row_action` and `activation` are intentionally not wired as per-row controls because the current daemon request carries no row identity; plugins that need row-specific behavior must put the row id in each row's own `action.payload` until the shared core dispatch contract grows an explicit row or node identity field.

## Hosting

The client can be served as a static web app by local Botster tooling. Future Rails or cloud hosting may serve the same bundle and provide relay or signaling configuration, but the web client architecture does not require cloud to be present. Rails should remain a hosting or relay layer, not the owner of client runtime state.

## Assumptions

- Real-hub dogfood can either spawn an isolated hub from a compatible `BOTSTER_HUB_BIN` and, where needed, `BOTSTER_SESSION_WORKER_BIN`, or attach to an already-running hub through `BOTSTER_HUB_SOCKET` / `BOTSTER_HUB_DATA_DIR`.
- In spawned isolated mode, the bridge uses an explicit temporary data directory and neutral ids, then shuts the daemon down on exit. In existing-hub attach mode, the bridge only proxies to the configured socket and does not shut down or clean up the attached hub.
- The exact botster-core exported schema remains external to this repo; daemon DTO typing is structural here and must stay aligned with `botster-hub-client`.
- Production browser integration uses the WebRTC browser data plane when the installed package receives a local bootstrap grant. The same-device bridge remains a harness fallback and signaling helper, not the promoted product data plane.
