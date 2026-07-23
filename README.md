# botster-web

`botster-web` is the first-party Ionic React client for Botster. Hub and core remain authoritative for sessions, packages, plugins, and terminal state.

## Runtime architecture

- Local development uses the deterministic fixture transport.
- Installed package runtime requires a hub-issued local WebRTC bootstrap grant.
- Encrypted daemon requests, responses, terminal traffic, and pushed session entity frames travel over the ordered WebRTC data channel.
- Session state begins with an authoritative subscription snapshot and continues through ordered pushed deltas. The client does not poll or call `list_sessions`.
- The loopback package server serves compiled assets and handles only WebRTC bootstrap refresh and signaling at `/request`. It is not a daemon control or terminal-data fallback.
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

The live acceptance builds and installs the package into an isolated Hub, launches Chromium, starts a session through the production Home control, verifies immediate UI feedback, receives authoritative session snapshots and deltas, attaches Restty, exercises input/resize/readback/exit, and proves two fresh WebRTC subscription generations across reloads. It fails if any legacy `list_sessions` hydration occurs.

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
injections: hub_connection, data_dir, hub_socket
readiness: local_url
```

Build before starting it:

```bash
npm run build
BOTSTER_HUB_SOCKET=/path/to/botster-hub.sock npm run serve:package
```

The server exposes:

```text
web:       http://127.0.0.1:41739/
signaling: http://127.0.0.1:41739/request
health:    http://127.0.0.1:41739/health
```

Package runtime fails closed when no WebRTC bootstrap grant is injected: the app remains rendered, exposes a danger diagnostic, and disables session start. `/request` rejects daemon operations other than `issue_local_webrtc_bootstrap` and `local_webrtc_signal`.

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
