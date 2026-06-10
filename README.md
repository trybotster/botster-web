# botster-web

`botster-web` is the first-party Botster web client shell. It is a renderer/client over hub and core APIs; it does not own runtime state, plugin policy, session truth, terminal truth, or workflow orchestration.

## Architecture Boundaries

- Ionic React is the renderer shell and layout layer for this standalone client.
- Hub/core contracts enter through the lightweight adapter seams under `src/botster/`.
- UiNode, action, and entity frames are the product contract for dynamic Botster UI. The first screen now dogfoods canonical frame families such as `ui_tree_snapshot`, `entity_snapshot`, `entity_upsert`, `entity_patch`, `entity_remove`, `action_request`, and `action_result` through the runtime client and a local injected transport.
- Hub subscribe establishes the control channel only. Routes and surfaces explicitly pull entity state, and active pulls plus surface subscriptions can be replayed after reconnect.
- Restty is mounted through the `terminal_view` bridge using a vendored build from the trybotster/restty fork. The bridge is renderer-only; fixture mode uses a mock data plane and real-hub mode uses a daemon-backed terminal data plane.
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

Fixture mode is the default because it is deterministic and cannot touch a real Botster identity.

## Real Hub Dogfood Bridge

Real-hub mode is opt-in and uses an isolated same-device bridge. The browser sends verbatim `botster-hub-client` daemon DTO payloads (`DaemonRequest`) to the bridge, and the bridge returns verbatim daemon DTO payloads (`DaemonResponse`). The HTTP envelope only carries transport metadata; Botster semantics stay in the daemon DTO payload. Terminal output uses a held `/terminal` SSE stream so daemon attach and drain run on one persistent daemon socket until the browser disconnects.

Start the local bridge in one terminal:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run dogfood:hub
```

Start Vite in another terminal with the build-time opt-in:

```bash
VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev
```

Open:

```text
http://127.0.0.1:5173/?dogfood=real-hub
```

Expected proof markers:

- The toolbar mode chip reads `real-hub`.
- The status list shows the isolated daemon host returned by `DaemonRequest::Status`.
- The connection diagnostics panel starts with the selected bridge mode and adds targeted rows when the bridge is unavailable, the control stream fails, the daemon schema or compatibility descriptor is incompatible, an operator/action error is returned, or terminal streaming cannot attach.
- Hub-provided `DaemonDiagnostic` rows from the public hub-client response/status path render as connection diagnostics with the daemon's `kind`, optional `message`, optional `feature`, and optional `operation` detail. Hub-provided compatibility or feature diagnostics suppress the matching web-inferred compatibility row for the same status response.
- `Daemon schema mismatch` means the bridge returned `DaemonStatus.schema_version` that does not match the schema expected by this web build. Use a matching botster-hub binary before treating UI behavior as a product bug.
- `Hub protocol mismatch` or `Hub capability missing` means the bridge returned `DaemonStatus.compatibility` and the descriptor does not satisfy this web build's public hub-client requirements.
- `Hub compatibility descriptor unavailable` means the status response predates or omits `DaemonStatus.compatibility`; botster-web does not infer protocol or capability problems from that missing field.
- `Local hub bridge unavailable` or `Control stream disconnected` means the browser could not complete a bridge request or the bridge stopped while the dogfood surface was loading. Check that `npm run dogfood:hub` is still running and that Vite was opened with `?dogfood=real-hub`.
- `Terminal stream unavailable` is scoped to the terminal data-plane seam. The control-plane surface can still render status, sessions, and action errors when the held terminal SSE stream is missing or rejected.
- `Spawn isolated session` sends `DaemonRequest::Spawn` and updates entity-backed session rows.
- A compatible current hub build should stream `botster-web-dogfood-ready` through the terminal SSE path; typing in the terminal sends `DaemonRequest::SendInput` while the held stream receives live terminal output.
- `Trigger invalid action` sends a deliberately invalid daemon request and surfaces an operator error through action/error state.
- Closing the bridge sends `DaemonRequest::DaemonShutdown` and removes the temporary data directory unless `BOTSTER_WEB_DOGFOOD_KEEP_DATA=1` is set.

Known limitation: the control-plane round trip (status/list/spawn/input/resize/operator-error/teardown) has been verified end-to-end through this bridge. Terminal output depends on the hub's streaming attach path; older local hub binaries may not emit the ready marker even though control-plane daemon DTOs succeed.

The bridge is a dev/test harness, not the production browser transport. Production browser parity over WebRTC remains outside this repo. The harness uses an explicit temporary data directory and neutral ids; it must not use or mutate the user's real Botster home state.

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
