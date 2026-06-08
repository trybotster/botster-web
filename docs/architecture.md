# botster-web architecture

`botster-web` is an Ionic React client shell over Botster hub/core contracts. It renders structured state; it does not own runtime truth, terminal truth, plugin policy, workflow orchestration, or cloud hosting policy.

## Client Layers

- `src/botster/client.ts` composes the browser-side contract and exports `botsterWebClientContract`, a runtime descriptor consumed by `src/App.tsx` so the scaffold is part of the production entry path.
- `src/botster/protocol.ts` names control-plane hub frames and lifecycle ingress. These are adapter placeholders, not a replacement for the external botster-core wire contract.
- `src/botster/entities.ts` names the entity frame store seam. It is pull-hydrated by view demand, with active pulls replayed after reconnect.
- `src/botster/uiNodes.ts` names the `ui_tree_snapshot` renderer registry seam. Renderers receive structural UI snapshots plus live entity stores.
- `src/botster/actions.ts` names semantic action dispatch. Action ids are Botster intents, not DOM events.
- `src/botster/terminal.ts` names the future Restty bridge. Restty is a renderer only.
- `src/botster/pluginSurfaces.ts` names the host-owned sandbox seam for plugin surfaces.

## Protocol Boundaries

Control-plane hub frames enter through `protocol.ts`. This scaffold names the canonical frame families the web client must handle, including `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, and `entity_remove`, while keeping payload internals `unknown` until an integration ticket reconciles them against external botster-core and wire-v2 sources.

Entity stores are the canonical read-model channel. Subscribe establishes the transport only; opened routes and surface bindings request the route registry, UI tree snapshots, and entity families they need. Reconnect handling must replay the mounted view's active pulls instead of assuming subscribe globally hydrates state.

Terminal data-plane traffic stays out of the hub control-plane envelope. PTY bytes, scrollback, snapshots, and terminal egress belong to session/client actor data-plane adapters in Botster core. The web seam only declares a `terminal_view` bridge for a future Restty-backed renderer.

## Renderer Boundaries

Ionic owns the app shell, navigation, toolbar, and layout containers. Botster UI primitives remain cross-client semantic nodes rendered by browser-specific adapters, with TUI parity preserved by shared primitive and action vocabulary.

`ui_tree_snapshot` carries structure. Plugin-owned dynamic model state remains in entity frames and can be referenced by `ui.bind` or `ui.bind_list`-style bindings. The renderer must thread entity stores into composite rendering rather than treating UI snapshots as data payloads.

Actions are semantic Botster events such as `botster.session.select` and `botster.session.stop`. React clicks or keyboard handlers can trigger those actions, but DOM event names are not the shared action contract.

## Plugin Surface Sandboxing

Plugin surfaces are mounted through a host-owned sandbox seam. The current descriptor distinguishes host-rendered surfaces from isolated plugin assets without choosing an iframe, worker, or asset bridge implementation prematurely. Plugin-owned execution and product policy remain outside this client shell.

## Hosting

The client can be served as a static web app by local Botster tooling. Future Rails or cloud hosting may serve the same bundle and provide relay or signaling configuration, but the web client architecture does not require cloud to be present. Rails should remain a hosting or relay layer, not the owner of client runtime state.

## Assumptions

- This ticket is intentionally scaffold-only.
- The exact botster-core exported schema is external to this repo, so payload fields remain opaque here.
- Future integration work must reconcile these TypeScript seams against the canonical botster-core and wire-v2 contracts before adding live transport behavior.
