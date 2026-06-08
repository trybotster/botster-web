# botster-web

`botster-web` is the first-party Botster web client shell. It is a renderer/client over hub and core APIs; it does not own runtime state, plugin policy, session truth, terminal truth, or workflow orchestration.

## Architecture Boundaries

- Ionic React is the renderer shell and layout layer for this standalone client.
- Hub/core contracts enter through the lightweight adapter seams under `src/botster/`.
- UiNode, action, and entity frames are the product contract for dynamic Botster UI. The scaffold handles canonical frame families such as `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `action_request`, and `action_result` through an injected transport, without implementing a live transport.
- Hub subscribe establishes the control channel only. Routes and surfaces explicitly pull entity state, and active pulls plus surface subscriptions can be replayed after reconnect.
- Restty is the terminal renderer selected for future terminal integration, but this scaffold does not import, instantiate, or manage Restty.
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

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
