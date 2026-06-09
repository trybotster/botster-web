# botster-web architecture

`botster-web` is an Ionic React client shell over Botster hub/core contracts. It renders structured state; it does not own runtime truth, terminal truth, plugin policy, workflow orchestration, or cloud hosting policy.

## Client Layers

- `src/botster/client.ts` composes the browser-side contract, exports `botsterWebClientContract`, and provides `createBotsterWebClient()` for runtime UiNode/entity/action ingestion through an injected hub transport.
- `src/botster/dogfoodMode.ts` selects fixture mode by default and real-hub mode only when both `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub` are present.
- `src/botster/localDogfoodTransport.ts` is the deterministic fixture adapter. It emits `ui_tree_snapshot` plus entity frames, accepts semantic `action_request` frames, and returns success or validation-error `action_result` frames.
- `src/botster/realHubDogfoodTransport.ts` is the browser adapter for the local real-hub dogfood bridge. It sends verbatim `botster-hub-client` `DaemonRequest` JSON payloads through a transport-only HTTP envelope, receives verbatim `DaemonResponse` JSON payloads, and only then normalizes into existing `ui_tree_snapshot`, entity, action, and operator-error seams.
- `src/botster/realHubTerminalDataPlane.ts` adapts daemon attach, drain, input, resize, and detach DTOs into `TerminalDataPlaneAttachment` callbacks for Restty.
- `src/botster/protocol.ts` names control-plane hub frames, lifecycle ingress, injected transport, and replayable surface subscription placeholders. These are adapter placeholders, not a replacement for the external botster-core wire contract.
- `src/botster/entities.ts` implements the in-memory entity frame store seam. It is pull-hydrated by view demand, with active pulls replayed after reconnect.
- `src/botster/uiNodes.ts` names the `ui_tree_snapshot` renderer registry seam. Renderers receive structural UI snapshots plus live entity stores.
- `src/botster/actions.ts` implements semantic action dispatch with `action_request` / `action_result` correlation. Action ids are Botster intents, not DOM events.
- `src/botster/terminal.ts` names the Restty-backed `terminal_view` bridge. Restty is a renderer only.
- `src/botster/pluginSurfaces.ts` names the host-owned sandbox seam for plugin surfaces.

## Protocol Boundaries

Control-plane hub frames enter through `protocol.ts`. This scaffold names the canonical frame families the web client must handle, including `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `action_request`, and `action_result`, while keeping adapter payloads narrow until an integration ticket reconciles them against external botster-core and wire-v2 sources.

Entity stores are the canonical read-model channel. Subscribe establishes the transport only; opened routes and surface bindings request the route registry, UI tree snapshots, and entity families they need. Reconnect handling replays the mounted view's active pulls and surface subscriptions instead of assuming subscribe globally hydrates state. Full `entity_snapshot` frames reset the family baseline even when their sequence is lower than a prior delta; delta frames obey the family sequence gate.

The current client factory still requires an injected transport. The production app uses `createDogfoodRuntimeConfig()` so node tests exercise the same fixture-vs-real selection branch that `src/App.tsx` uses. Fixture mode is the default; real-hub mode requires the build-time environment opt-in plus the runtime query parameter.

The real-hub bridge is a same-device dev/test harness over `botster-hub-client`, not a new product protocol and not the authoritative production browser transport. Browsers cannot speak Unix sockets directly, so `scripts/real-hub-dogfood-bridge.mjs` owns only browser reachability and request correlation. The embedded payload stays the daemon DTO shape from `botster-hub-client`: `DaemonRequest`, `DaemonResponse`, and daemon terminal events. Production WebRTC browser/TUI parity remains future work.

Terminal data-plane traffic stays out of the hub control-plane envelope. PTY bytes, scrollback, snapshots, and terminal egress belong to session/client actor data-plane adapters in Botster core. The web seam declares a Restty-backed `terminal_view` bridge plus a mock subscription-style data-plane adapter for this scaffold; it does not add terminal byte frames to `HubControlFrame`.

The Restty bridge is mounted by the production app path through `src/botster/TerminalViewHost.tsx`. The host measures its bounded Ionic panel with `ResizeObserver`, forwards rows/columns through the bridge, and unmounts by detaching subscriptions before destroying the renderer instance. In real-hub mode those resize, input, attach, and drain operations go through `TerminalDataPlaneAttachment`, not hub control frames. The vendored Restty bundle lives under `src/vendor/restty/` and is built from the `trybotster/restty` fork.

## Renderer Boundaries

Ionic owns the app shell, navigation, toolbar, and layout containers. Botster UI primitives remain cross-client semantic nodes rendered by browser-specific adapters, with TUI parity preserved by shared primitive and action vocabulary.

`ui_tree_snapshot` carries structure. Plugin-owned dynamic model state remains in entity frames and can be referenced by `ui.bind` or `ui.bind_list`-style bindings. The renderer threads entity stores into composite rendering rather than treating UI snapshots as data payloads. `src/App.tsx` now constructs the runtime client from the tested dogfood mode helper, subscribes to `botster-web.dogfood.session`, renders the received snapshot with `UiNodeSurface`, and dispatches semantic UiNode actions back through the client.

Actions are semantic Botster events such as `botster.session.select` and `botster.session.stop`. React clicks or keyboard handlers can trigger those actions, but DOM event names are not the shared action contract.

`terminal_view` remains separate from the `UiNodeRendererRegistry`. Restty renders terminal panes only; UiNode/action/entity frames remain the dynamic product UI contract.

## Plugin Surface Sandboxing

Plugin surfaces are mounted through a host-owned sandbox seam. The current descriptor distinguishes host-rendered surfaces from isolated plugin assets without choosing an iframe, worker, or asset bridge implementation prematurely. Plugin-owned execution and product policy remain outside this client shell.

## Hosting

The client can be served as a static web app by local Botster tooling. Future Rails or cloud hosting may serve the same bundle and provide relay or signaling configuration, but the web client architecture does not require cloud to be present. Rails should remain a hosting or relay layer, not the owner of client runtime state.

## Assumptions

- Real-hub dogfood requires a compatible `BOTSTER_HUB_BIN` and, where needed, `BOTSTER_SESSION_WORKER_BIN`.
- The bridge uses an explicit temporary data directory and neutral ids, then shuts the daemon down on exit.
- The exact botster-core exported schema remains external to this repo; daemon DTO typing is structural here and must stay aligned with `botster-hub-client`.
- Future production browser integration must use the WebRTC browser data plane instead of promoting this same-device bridge into product transport.
