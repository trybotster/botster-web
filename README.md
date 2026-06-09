# botster-web

`botster-web` is the first-party Botster web client shell. It is a renderer/client over hub and core APIs; it does not own runtime state, plugin policy, session truth, terminal truth, or workflow orchestration.

## Architecture Boundaries

- Ionic React is the renderer shell and layout layer for this standalone client.
- Hub/core contracts enter through the lightweight adapter seams under `src/botster/`.
- UiNode, action, and entity frames are the product contract for dynamic Botster UI. The first screen now dogfoods canonical frame families such as `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `action_request`, and `action_result` through the runtime client and a local injected transport.
- Hub subscribe establishes the control channel only. Routes and surfaces explicitly pull entity state, and active pulls plus surface subscriptions can be replayed after reconnect.
- Restty is mounted through the `terminal_view` bridge using a vendored build from the trybotster/restty fork. The bridge is renderer-only and uses a mock terminal data-plane boundary in this local dogfood path.
- Hub/core remain authoritative for runtime, session, plugin, and terminal state.
- Browser-owned state in this scaffold is presentation-only placeholder data.
- Future Rails or cloud hosting can serve the same static client and relay configuration, but cloud is not required for the local client architecture.

See [docs/architecture.md](docs/architecture.md) for the client module boundaries and protocol seams.

## Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Lint:

```bash
npm run lint
```

Typecheck:

```bash
npm run typecheck
```

## Local Dogfood Surface

Run the local dogfood surface:

```bash
npm install
npm run dev
```

Open the Vite URL printed by `npm run dev`. The first screen creates `createBotsterWebClient()` in `src/App.tsx`, connects it to `createLocalDogfoodTransport()`, subscribes to `botster-web.dogfood.session`, and renders the received `ui_tree_snapshot` through `UiNodeSurface`.

Use the surface controls to exercise the contract:

- `Spawn local session` dispatches `action_request` with `botster.session.select`; the local adapter replies with `action_result` success and patches the session entity to `running`.
- `Submit invalid draft` dispatches `botster.session.rename`; the local adapter replies with a failed `action_result` and patches entity-backed form errors.
- The terminal panel mounts through `TerminalViewHost` and the `terminal_view` bridge. Terminal output is intentionally local mock data-plane output, not hub control-frame bytes.

This repo still has no live browser-to-local-daemon WebRTC, WebSocket, ActionCable, or Unix-socket transport. The dogfood surface is local-only and proves the browser runtime path over the injected hub-client contract until the live hub transport is added.

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
