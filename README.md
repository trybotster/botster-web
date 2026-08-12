# botster-web

`botster-web` is the first-party Ionic React client for Botster. Hub and core remain authoritative for sessions, packages, plugins, and terminal state.

## Runtime architecture

- Local development uses the deterministic fixture transport.
- Installed package runtime requires a hub-issued local WebRTC bootstrap grant.
- Encrypted daemon requests, responses, terminal traffic, and pushed session entity frames travel over the ordered WebRTC data channel.
- Session state materializes in canonical entity family `session`, beginning with an authoritative subscription snapshot and continuing through ordered pushed deltas. The client does not poll or call `list_sessions`.
- `@trybotster/ui-contract@0.3.2` is the sole `UiNode`, action request/result, package-surface descriptor, supported-operation, entity-options projection, and manifest-navigation vocabulary source. Hub owns package admission and projects sanitized package/navigation rows; the generated daemon declarations and revision-35 shared conformance fixtures come from `@trybotster/hub-test-support@0.1.30`.
- A `bind_list` first resolves its direct row-root `$bind`, then realizes each keyed descendant through the UI-contract runtime helper. The resulting literal identity is the single value used for React keys, `data-ui-node-id`, collected action state, requests, and correlated results. Invalid descendant identity or a collision among nodes that coexist in one render replaces the whole surface with a bounded diagnostic and publishes no actions; a missing or blank direct row root still omits only that unresolved row.
- Plugin form drafts travel in canonical `UiActionRequest.values`; optional action metadata remains in `payload`. Accepted correlated results may replace the owning subtree and mutate Hub/package/surface-scoped presentation state, while rejected results retain the tree, dialog, values, and actionable errors.
- After binding, the loopback package server requests an origin-bound initial WebRTC grant from Hub and injects it into each HTML load. It handles later bootstrap refresh and signaling at `/request`; it is not a daemon control or terminal-data fallback.
- Restty is the terminal renderer only. It imports GHOSTSNP snapshots, receives live bytes through `TerminalViewHost` and the WebRTC-backed data-plane adapter, and does not own terminal truth or answer OSC color queries (`readOnly`).

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

To exercise restored durable state, use the Web-owned seeded regression:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol:durable
```

This mode creates its own temporary data directory, installs and enables the package through Hub, seeds five exited sessions through daemon requests, restarts Hub on the same directory, and then runs the normal browser proof. It cannot be combined with `BOTSTER_LIVE_DATA_DIR`, because seeded mode owns the directory it populates.

When `BOTSTER_LIVE_DATA_DIR` is supplied directly without seeded mode, the harness owns only its spawned Hub process: it reuses installed enabled packages, records the Web package version and working-directory provenance available through public Hub contracts, compares the served hashed assets with the local `dist` build, never removes packages or sessions, never edits persistence files, and never deletes the caller-owned directory. The Settings proof toggles remote browser access through the real package action and restores the caller's original boolean value before continuing. Current Hub `resolve_app_launch` supports terminal apps only, so Web package reuse is explicitly classified as having no publicly exposed resolved working directory rather than being reported as an exact path match.

Run `npm run smoke:live-packaged-protocol:caller-repeatability` with the same Hub and worker variables to execute the caller-owned path twice against one generated data directory and assert package reuse plus configuration restoration. When a Workspaces package path is supplied, the second generation also adopts and proves the single workspace retained by the first generation instead of applying a cold empty-state oracle to reused caller state.

The plugin contract checks use the same production WebRTC harness. They prove
Hub-projected package navigation through a visible sidebar control and route
click, then exercise package list/detail, launch/render, canonical `/session`
bindings with reconnect hydration, and structured action results through the
production transport and React components. The `contract.sessions` proof reads
the published row/control identities and action ids from the rendered Ionic DOM,
uses mouse and keyboard activation on different row/control pairs, requires one
exact `plugin_surface_action` per activation, and correlates each accepted result
before repeating identity checks under a fresh subscription generation:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:plugin-contract-matrix
```

The first-party Workspaces compatibility check requires the real package and an
admitted Installed row. It fails closed when either is unavailable and asserts
plugin-owned UiNodes rather than accepting route or shell text as proof. Because
the proof creates one workspace, it also requires a fresh harness-owned data
directory and rejects `BOTSTER_LIVE_DATA_DIR` or
`BOTSTER_LIVE_DURABLE_STATE=1`:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
BOTSTER_WORKSPACES_PACKAGE_PATH=/path/to/botster-workspaces \
npm run smoke:workspaces-compat
```

That smoke drives the production Workspaces surface through the real adapter.
It proves the cold-start panel toolbar/body slots, clicks the rendered empty
state action, requires the accepted presentation `set`, submits a unique name
through the owner-authored create form, and verifies worker-visible values plus
the accepted presentation `clear` and whole-surface replacement. The replacement,
reload, and direct-load stages must all render the same package-authored
list-item title and `0 sessions` meta slots. Assertions use structured
requests/results rather than toast timing.

The opt-in Workspaces lifecycle acceptance uses the same production browser,
Hub, plugin worker, route, renderer, entity store, and rendered action path:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
BOTSTER_WORKSPACES_PACKAGE_PATH=/path/to/botster-workspaces \
npm run smoke:workspaces-lifecycle
```

This mode also requires a fresh harness-owned data directory. It creates a
workspace through rendered Ionic controls, seeds canonical UUID sessions only
through public daemon requests, and adds sixteen references through the owner-
authored Add-session form: four current-to-ended transitions, four stable-ended
references, four ended-to-removed references, and four never-existing
references.

### Ordered sequence_gap control (live harness)

Parent claim-stack acceptance (`ticket_1786474783_285888`) must use the
family-bound drop control as the **sole ordered-gap trigger** on Web ≥ this
change. Do **not** use `closeDataChannel` for ordered gap — that remains the
in-place reconnect proof only.

When `window.__BOTSTER_LIVE_PROTOCOL_HARNESS__` is installed, transport control
exposes:

| Method | Role |
|--------|------|
| `armDropNextInboundEntityFrame({ entity_type, frame_types?, subscription_id? })` | Arms a one-shot drop of the next matching inbound entity **delta** after decrypt/assembly and before production `receiveEntityFrame`. Returns arm result only (`ok` / `not_armed` reasons). Default `frame_types` are `entity_upsert` \| `entity_patch` \| `entity_remove` (never snapshot/error). |
| `getDropNextInboundEntityFrameState()` | Polls `idle` \| `armed` \| `dropped` \| `timed_out` \| `disarmed`. Dropped state includes `snapshot_seq`, `subscription_id`, `generation`. Armed arms time out after 30s (`timed_out`) unless dropped/disarmed/peer-reset first. |
| `disarmDropNextInboundEntityFrame()` | Clears an arm without dropping. |
| `closeDataChannel()` | Closes the real data channel for **reconnect** proof on a surviving document. |

Live Workspaces held-open chronology (mandatory in `smoke:workspaces-lifecycle`):

1. Seed sessions **A** (stale selection / warmup), **B** (harness-dropped delta), and **C** (gap-trigger delta).
2. P1 holds Add dialog with **A** selected (membership subscription ready).
3. P2 opens Add dialog and claims **A** as a **warmup** production mutation (no arm). Dual-client membership subscribe often advances the Hub package-entity floor; the first claim may arrive as `package_entity_resync` rather than an ordered delta. After warmup, P1 baseline is stable and **A** is excluded (stale selection under test).
4. `armDropNextInboundEntityFrame({ entity_type: "botster-workspaces.membership" })`.
5. P2 claims **B** → harness records `webrtc_entity_frame_harness_drop` (D1); client sequence stays at post-warmup baseline `N`.
6. P2 claims **C** → production `webrtc_entity_frame_discarded` reason `sequence_gap` (D2) → unsubscribe/subscribe → replacement membership snapshot excluding A/B/C.
7. Held selection of **A** is invalid; normal (non-forced) stale submit emits zero outbound `botster_workspaces.add_session` for A and leaves SPA action pending/result state unchanged.
8. Mandatory cleanup removes membership and Hub sessions for **A, B, and C** (production remove when possible + hub shutdown/remove) and asserts authoritative membership/session absence before later lifecycle stages.

Pins for that lane:

```bash
BOTSTER_HUB_BIN=<hub built from ≥ de6b09982e72fd5efd04a5258f5fc645f611adbc> \
BOTSTER_SESSION_WORKER_BIN=<worker from same hub pin> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<workspaces checkout ≥ 7ab4d1334214b3ea3c8b02e9ea665a27e70c0916> \
npm run smoke:workspaces-lifecycle
```

Ablation: `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` restores valid stale control via
store membership remove so the zero-request oracle fails first. Exact ID membership is checked at the initial, transitioned,
removed, and authoritative-reconnect stages without `list_sessions` or an extra
surface render. Lifecycle regions are classified from the authored
`-sessions-(current|ended|unavailable)-` section identity, never from visible
heading or row text. Row controls are resolved by containment and their rendered
semantic action; the runner accepts a producer-authored literal direct template-
root id or the contract-admitted bound root id, but never requires bound
descendant ids.

Failures are non-zero and retain the cohort plus expected lifecycle class in
each oracle name, distinguishing never-existing references from removed ones.
Their compact evidence includes the delivered UiNode tree,
rendered row-root ids/text, canonical session chronology, subscription id,
render/list request counts, and one identity outcome per expected reference:
`materialized`, `materialized-not-legible`, `authored-not-materialized`,
`dropped-empty`, `dropped-collision`, or `not-authored`.
`materialized-not-legible` names the exact DOM reason (`not-visible`,
`empty-text`, `no-semantic-region`, `no-contained-action`, or `row-count`);
contained actions are required for realized item rows, while unavailable
`empty_template` placeholders need only be visible, non-empty, and in their
semantic region.
`dropped-empty` and `dropped-collision` identify Web-owned generic renderer
failures. `authored-not-materialized` identifies a producer-authored branch
whose filter/branch did not realize, while `not-authored` identifies a missing
producer branch; both are package-owned lifecycle evidence.

### Caller-owned shared-Hub Workspaces driver

The direct integration driver attaches to an already running Hub and an already
launched `botster-web/web-client`. The caller owns Hub/package/Git lifecycle and
passes one ordered assignment; the driver owns only real browser interaction and
structured consumer evidence:

```bash
BOTSTER_LIVE_DATA_DIR=/path/to/running-hub-data \
BOTSTER_WORKSPACES_SPAWN_CASES='{"generation":"web-1","entry_state":"reused","workspace_name":"Web cases","observe":{"workspace_id":"...","workspace_name":"Earlier stage","session_id":"...","lifecycle":"ended"},"cases":[{"case_id":"existing-worktree","target_id":"repo","branch":"feature/shared","session_type_id":"repo/implement","expected_lifecycle":"ended"}]}' \
npm run drive:workspaces-shared-hub-browser
```

The assignment is required and has no discovery defaults. `entry_state` is
`cold` or `reused`; reused invocations must identify the exact prior workspace
and session to observe. Every case supplies `case_id`, `target_id`, `branch`, and
`session_type_id`, with optional `prompt` and `ticket_id`; `expected_lifecycle`,
when present, must be `ended`. `session_type_id` is the Hub-qualified effective
session-type id (`<source name>/<id>`, where a repo source's name is the spawn
target id), matching the option value Workspaces renders — the driver rejects an
assignment whose `session_type_id` is absent from the rendered options. Test coordinators may also supply
`expect_created_branch`, `expect_created_worktree`, and
`expect_reused_worktree` outcomes so named
managed-Git cases are enforced rather than merely recorded. The repository
smoke intentionally leaves `prompt` and `ticket_id` unset for one case so the
renderer-collected empty optional values remain covered by the required gate.
The driver discovers the structured app row and `local_url`, clicks the rendered
Apps/Workspaces navigation, reads realized node/action identities, uses Ionic
input callbacks, and emits one `workspaces-shared-hub-browser-summary` JSON
record. It never starts or stops Hub, installs or enables packages, discovers a
sibling checkout, runs Git, hand-authors a `UiActionRequest`, or deletes caller
state.

Spawn evidence correlates the rendered action and collected form values with
the daemon request, accepted action result, workspace/session identities,
Hub-returned target/template/branch/worktree/base facts, canonical lifecycle,
and before/after `plugin_surface_render` and `list_sessions` counts. Lifecycle
must reconcile from pushed entity frames while both request counts remain
unchanged. The summary identifies observable caller-owned Hub protocol/status,
installed Web and Workspaces package rows, and the served Web asset digest; any
binary path, worker version, or build commit absent from the installed-app
contract is explicitly marked unexposed. All `BOTSTER_LIVE_ALLOW_*_SKIP` inputs
fail closed before Chromium launches.

The repository-owned mandatory proof supplies the parent contract with one
fresh test fixture, invokes the driver cold and then reused against the same Hub,
and validates a two-generation completion ledger:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
BOTSTER_WORKSPACES_PACKAGE_PATH=/path/to/botster-workspaces \
npm run smoke:workspaces-shared-hub-browser
```

That coordinator alone installs/enables Web and Workspaces once, admits the real
managed-Git fixture, launches the Web entrypoint, and cleans up. It covers the
cold empty-state create control, reused toolbar create control, prior-state
observation, existing managed worktree reuse, existing-branch materialization,
missing-branch creation, immutable SHA-256 identity measured before launch and
verified unchanged at completion for the exact supplied Hub and session-worker
binaries, and exact package/Git provenance. Without build
receipts, the coordinator marks Hub/Core source commits and binary package
versions unverified instead of attributing mutable adjacent checkout metadata
to already-built executables. The downstream
Workspaces parent replaces this coordinator when it combines the merged Web
driver with the separately owned TUI sequence.

The rendered workspace-detail Spawn control is selected by the semantic action
identity `botster_workspaces.open_spawn` delivered by Workspaces
`ticket_1785611316_167898` at `737ec81`. The driver requires one exact semantic
match, reads the realized opaque node/action identity from that production DOM
element, and correlates the normal Ionic callback through the Hub request and
accepted result. It does not parse visible copy, reconstruct the owner-authored
dynamic node id, or fall back to generic `botster_workspaces.open` plus dialog
payload discrimination.

The command must exit 0 against the delivered Workspaces checkout and emit a
two-generation structured ledger whose per-case `spawn_opener` records carry
the same semantic action and opaque node identity through DOM, request, and
accepted result evidence while preserving the producer-authored payload.

The broader contract-matrix smoke separately covers rejected form submissions,
draft retention, and presentation operations. Deterministic tests cover every
published UTF-8 identity vector, multiple rows with Spawn/Rename/Remove controls,
authored-key and realized-id diagnostics, mutually exclusive branches,
nested/empty `bind_list`, toolbar order/overflow intent, and entity
snapshot/upsert/patch/remove/reconnect convergence.

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
