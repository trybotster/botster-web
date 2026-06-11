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

Packaged browser smoke:

```bash
npm run smoke:packaged-browser
```

The smoke command builds the app, serves the compiled package runtime through the dogfood bridge, opens `/?dogfood=real-hub` in Playwright Chromium, clicks the real-hub spawn action, and fails on unexpected browser console/page errors, unexpected 404s, fatal Restty font loading, missing mounted terminal errors, and focus stack overflows. If Chromium is not installed for Playwright, run `npx playwright install chromium` once.

Live packaged protocol harness:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

This command builds the app, starts the package bridge in real-hub mode, starts an isolated local hub when `BOTSTER_HUB_BIN` is supplied, opens the compiled packaged UI in Playwright Chromium, and drives the mounted terminal data-plane path. It proves status/schema compatibility, package listing, session listing, spawn of `botster-web-dogfood-session`, terminal attach output containing `botster-web-dogfood-ready`, input echo output containing `botster-web-dogfood-echo:<input>`, resize output containing `botster-web-dogfood-size:<rows>x<cols>`, deterministic exit through `botster-web-dogfood-exit`, observed `process_exit`, and clean shutdown.

The live harness can also attach to an explicitly isolated existing hub with `BOTSTER_HUB_SOCKET` or `BOTSTER_HUB_DATA_DIR`. Existing-hub mode does not shut down or remove the attached hub. The harness must not use fake daemon responses, and it fails on browser console/page errors, packaged asset 404s, terminal mount failure, stack overflow, unhandled promise rejection, missing Playwright Chromium, missing hub binaries, or missing live resize/process-exit evidence. It proves the packaged UI + real hub control loop + dogfood bridge terminal egress; it does not prove the production WebRTC data plane.

The harness reloads the packaged UI after the browser-dispatched spawn before asserting terminal output. That keeps this smoke focused on proving the live protocol loop against an existing real session while a separate follow-up tracks the product race where immediate terminal attach after spawn can briefly hit `UnknownSession`.

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

Real-hub mode is opt-in and uses a same-device bridge. The browser sends verbatim `botster-hub-client` daemon DTO payloads (`DaemonRequest`) to the bridge, and the bridge returns verbatim daemon DTO payloads (`DaemonResponse`). The HTTP envelope only carries transport metadata; Botster semantics stay in the daemon DTO payload. Terminal output uses a held `/terminal` SSE stream so daemon attach and drain run on one persistent daemon socket until the browser disconnects.

`npm run smoke:packaged-browser` uses a fake daemon socket to prove the compiled browser/package path and console hygiene without requiring a live hub binary. It does not prove live-hub compatibility; use `npm run dogfood:hub` against a spawned or existing hub for that evidence.

### Spawned isolated hub

Start the bridge with a hub owned by the bridge in one terminal:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run dogfood:hub
```

This mode prints `mode: spawned isolated hub`, starts `botster-hub start --data-dir`, sends `DaemonRequest::DaemonShutdown` when the bridge stops, and removes the temporary data directory unless `BOTSTER_WEB_DOGFOOD_KEEP_DATA=1` is set.

### Existing hub attach

If a hub/package entrypoint has already started a dogfood hub and printed its socket, attach the bridge to that socket:

```bash
BOTSTER_HUB_SOCKET=/printed/botster-hub.sock npm run dogfood:hub
```

If the entrypoint printed a data directory instead, attach by data dir and let the bridge derive `botster-hub.sock`:

```bash
BOTSTER_HUB_DATA_DIR=/printed/data-dir npm run dogfood:hub
```

This mode prints either `mode: existing hub socket` or `mode: existing hub data dir`. It does not require `BOTSTER_HUB_BIN`, does not spawn a hub, does not send `DaemonRequest::DaemonShutdown`, and does not remove the existing hub data directory. `BOTSTER_HUB_SOCKET` is the most explicit endpoint and wins when both existing-hub variables are set. Do not combine `BOTSTER_HUB_SOCKET` or `BOTSTER_HUB_DATA_DIR` with `BOTSTER_WEB_DOGFOOD_DATA_DIR`; the bridge treats that mixed ownership configuration as an operator error.

For local Vite development, start Vite in another terminal with the build-time opt-in:

```bash
VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev
```

Open:

```text
http://127.0.0.1:5173/?dogfood=real-hub
```

Vite remains a development server only. Without `VITE_BOTSTER_REAL_HUB_DOGFOOD=1`, Vite keeps fixture mode even when `?dogfood=real-hub` is present.

Expected proof markers:

- The toolbar mode chip reads `real-hub`.
- The status list shows the isolated daemon host returned by `DaemonRequest::Status`.
- The installed packages list is populated by `DaemonRequest::ListPackages` and shows the package name, version, enabled/disabled/installed state, classification, requested capability summary, provider-profile admission status, and runnable entrypoint process state/diagnostics when the current hub exposes package registry records.
- The connection diagnostics panel starts with the selected bridge mode and adds targeted rows when the bridge is unavailable, the control stream fails, the daemon schema or compatibility descriptor is incompatible, an operator/action error is returned, or terminal streaming cannot attach.
- Hub-provided `DaemonDiagnostic` rows from the public hub-client response/status path render as connection diagnostics with the daemon's `kind`, optional `message`, optional `feature`, and optional `operation` detail. Hub-provided compatibility or feature diagnostics suppress the matching web-inferred compatibility row for the same status response.
- `Daemon schema mismatch` means the bridge returned `DaemonStatus.schema_version` that does not match the schema expected by this web build. Use a matching botster-hub binary before treating UI behavior as a product bug.
- `Hub protocol mismatch` or `Hub capability missing` means the bridge returned `DaemonStatus.compatibility` and the descriptor does not satisfy this web build's public hub-client requirements.
- `Hub compatibility descriptor unavailable` means the status response predates or omits `DaemonStatus.compatibility`; botster-web does not infer protocol or capability problems from that missing field.
- `Local hub bridge unavailable` or `Control stream disconnected` means the browser could not complete a bridge request or the bridge stopped while the dogfood surface was loading. Check that `npm run dogfood:hub` is still running and that Vite was opened with `?dogfood=real-hub`.
- `Terminal stream unavailable` is scoped to the terminal data-plane seam. The control-plane surface can still render status, sessions, and action errors when the held terminal SSE stream is missing or rejected.
- `Spawn isolated session` sends `DaemonRequest::Spawn` and updates entity-backed session rows. Package rows are read-only in this slice; botster-web does not expose install, enable, disable, or remove actions.
- A compatible current hub build should stream `botster-web-dogfood-ready` through the terminal SSE path; typing in the terminal sends `DaemonRequest::SendInput` while the held stream receives live terminal output.
- `Trigger invalid action` sends a deliberately invalid daemon request and surfaces an operator error through action/error state.
- Closing the bridge sends `DaemonRequest::DaemonShutdown` only in spawned isolated hub mode. Existing hub attach mode leaves the already-running hub and its data directory alone.

Known limitation: the control-plane round trip (status/list/spawn/input/resize/operator-error/teardown) has been verified end-to-end through this bridge. Terminal output depends on the hub's streaming attach path; older local hub binaries may not emit the ready marker even though control-plane daemon DTOs succeed.

The bridge is a dev/test harness, not the production browser transport. Production browser parity over WebRTC remains outside this repo. The harness uses an explicit temporary data directory and neutral ids; it must not use or mutate the user's real Botster home state.

## Local Botster Package

This repo includes `botster-package.json` so the current local hub can install `botster-web` from a checked-out path. The manifest uses package `kind: "plugin"` because package classification is still plugin/provider. The root `plugin.lua` is an inert package entrypoint required by local package enable/prepare, while the web-client behavior is declared as a hub-owned `runnable_entrypoints` row named `web-client`.

From the `botster-hub` checkout, install, inspect, and enable this package against a selected hub data directory:

```bash
cargo run -- packages install --data-dir target/botster-hub-dogfood-data \
  --path /path/to/botster-web
cargo run -- packages show --data-dir target/botster-hub-dogfood-data botster-web
cargo run -- packages enable --data-dir target/botster-hub-dogfood-data botster-web
```

`packages enable --path` remains a compatibility shortcut, but the explicit install/show/enable flow is preferred when proving admission and registry state:

```bash
cargo run -- packages enable --data-dir target/botster-hub-dogfood-data \
  --path /path/to/botster-web
```

Local path installs are recorded by the hub as `local_development` trust. The manifest is first-party-ready for future hub bundling, but a manifest cannot declare genuine `first_party` trust by itself.

The runnable entrypoint launches the existing bridge with:

```text
command: node
args: scripts/real-hub-dogfood-bridge.mjs
```

Build before starting the package runtime:

```bash
npm run build
```

Then run the same package entrypoint against an existing hub:

```bash
BOTSTER_HUB_SOCKET=/printed/botster-hub.sock npm run dogfood:hub
```

or:

```bash
BOTSTER_HUB_DATA_DIR=/printed/data-dir npm run dogfood:hub
```

The package runtime serves the compiled Ionic UI and bridge APIs from one loopback server:

```text
web:    http://127.0.0.1:41739/
bridge: http://127.0.0.1:41739/request
health: http://127.0.0.1:41739/health
```

`GET /`, `GET /?dogfood=real-hub`, and SPA fallback routes return the built `dist/index.html`. The bridge injects a package-runtime marker into served HTML so the app uses real-hub mode from the package server without a Vite build-time flag, and `src/App.tsx` derives the bridge URL from the page origin so non-default package ports still post to the same server. Static assets are served from `dist` without marker injection.

When the hub supervises this entrypoint, it should provide `BOTSTER_HUB_SOCKET` or `BOTSTER_HUB_DATA_DIR`. Either value selects existing-hub attach mode, so the bridge does not require `BOTSTER_HUB_BIN`, does not spawn a second hub, does not shut down the attached hub, and does not remove the attached hub data directory.

## License

botster-web is distributed under the [O'Saasy License Agreement](LICENSE).
