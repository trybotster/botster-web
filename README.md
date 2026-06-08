# botster-web

`botster-web` is the first-party Botster web client shell. It is a renderer/client over hub and core APIs; it does not own runtime state, plugin policy, session truth, terminal truth, or workflow orchestration.

## Architecture Boundaries

- Ionic React is the renderer shell and layout layer for this standalone client.
- UiNode, action, and entity frames are the product contract for dynamic Botster UI.
- Restty is the terminal renderer selected for future terminal integration, but this scaffold does not import, instantiate, or manage Restty.
- Hub/core remain authoritative for runtime, session, plugin, and terminal state.
- Browser-owned state in this scaffold is presentation-only placeholder data.

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
