# botster-web

`botster-web` is the first-party Ionic React client for Botster. Hub and core remain authoritative for sessions, packages, plugins, and terminal state.

## Runtime architecture

- Local development uses the deterministic fixture transport.
- Installed package runtime requires a hub-issued local WebRTC bootstrap grant.
- Encrypted daemon requests, responses, terminal traffic, and pushed session entity frames travel over the ordered WebRTC data channel.
- Session state begins with an authoritative subscription snapshot and continues through ordered pushed deltas. The client does not poll or call `list_sessions`.
- After binding, the loopback package server requests an origin-bound initial WebRTC grant from Hub and injects it into each HTML load. It handles later bootstrap refresh and signaling at `/request`; it is not a daemon control or terminal-data fallback.
- Restty is the terminal renderer. It receives terminal data through `TerminalViewHost` and the WebRTC-backed data-plane adapter.

See [docs/architecture.md](docs/architecture.md) for module boundaries.

## Development

```bash
npm install
npm run dev
```

The Vite app uses fixture mode and cannot touch a real Botster identity.

Validation:

```bash
npm test
npm run build
npm run lint
npm run typecheck
npm run smoke:browser-runtime
```

The focused mounted-terminal browser check does not require Hub binaries:

```bash
npm run smoke:mounted-terminal-keyboard
```

## Live WebRTC acceptance

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

`smoke:browser-runtime` exercises the real compiled React UI in fixture mode and in package mode without a bootstrap grant. It verifies Start Session feedback, fixture session rendering, a visible bootstrap diagnostic, and blocked actions during connection failure.

The live acceptance builds and installs the package into an isolated Hub, launches Chromium, starts a test-owned session through Hub's generic API, receives authoritative session snapshots and deltas, attaches Restty, exercises input/resize/readback/exit, and proves two fresh WebRTC subscription generations across reloads. It fails if any legacy `list_sessions` hydration occurs.

The plugin contract checks use the same production WebRTC harness:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:plugin-contract-matrix
```

## Local package server

The package manifest starts:

```text
kind: web_app
launch_mode: background
command: node
args: scripts/local-package-server.mjs
injections: hub_connection
readiness: local_url
```

Build before starting it:

```bash
npm run build
BOTSTER_HUB_CONNECTION='{"transport":{"type":"unix_socket","path":"/path/to/botster-hub.sock"}}' npm run serve:package
```

The server exposes:

```text
web:       the `local_url` written to `BOTSTER_ENTRYPOINT_LAUNCH_RESULT`
signaling: `${local_url}/request`
health:    `${local_url}/health`
```

The package server binds an ephemeral loopback port by default. Set `BOTSTER_WEB_PACKAGE_SERVER_PORT` for an explicit generic override. Once the actual `local_url` is known, it requests an initial grant from the injected Hub connection and requires Hub to bind that grant to the exact origin before serving HTML. It fails closed when the descriptor or grant is missing or malformed, and `/request` rejects daemon operations other than `issue_local_webrtc_bootstrap` and `local_webrtc_signal`.

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
