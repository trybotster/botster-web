# Explicit WebRTC Transport Diagnostics

## Context Loaded

- Pipeline context for `ticket_1783032084_568278`, run `run_1783032104_674442`, current step `botster_plan`, gate `botster_plan_gate`, with no prior artifacts, findings, questions, reviews, or dependencies.
- Role playbooks: [[planner-playbook]] and [[botster-planner-playbook]].
- Botster/SPAs notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[botster data plane bypasses the hub through session and client actors]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Relevant local architecture: `botster-web` is an Ionic React SPA; the bridge serves packaged UI and same-device daemon request/signaling, while package runtime prefers `src/botster/webrtcDaemonClient.ts` for encrypted WebRTC `RTCDataChannel` request/response traffic.
- Review context loaded after Plan Review returned changes: reuse `terminalDataPlaneKind`, reuse existing `WebrtcDaemonFailureStage` / `webRtcFailureDiagnostic()`, include `src/botster/realHubTerminalDataPlane.ts` and `src/botster/realHubDogfoodTransport.ts`, and distinguish WebRTC mode from real-hub bridge/SSE mode.
- Workflow note: the run vault checklist now exists as `checklist_1783032174_148325` and records notes read, no convention conflicts, planned verification, and no capture yet.

## Scope

- Add visible diagnostic state separation for:
  - packaged UI bridge / static package serving;
  - local bootstrap grant presence and validity;
  - local WebRTC signaling over the bridge request endpoint;
  - `RTCDataChannel` opening/closing/error state;
  - encrypted daemon stream readiness after successful request/response encryption;
  - fallback bridge/SSE terminal transport when WebRTC bootstrap is absent.
- Prefer additive browser-side diagnostics using existing Ionic rows/cards and existing `ConnectionDiagnostic` structures.
- Use `DogfoodRuntimeConfig.terminalDataPlaneKind` as the existing source of truth for the headline data-plane label:
  - `webrtc` must render as `WebRTC DataChannel` or equivalent;
  - `real-hub` must render as bridge/SSE data transport, because in this fallback/dev mode the HTTP bridge is the terminal data transport via `bridge.streamTerminal`;
  - `mock` must remain fixture/mock data plane.
- Reuse the existing `WebrtcDaemonFailureStage` and `webRtcFailureDiagnostic()` failure vocabulary; add only success-side lifecycle diagnostics that are not already represented.
- Thread missing WebRTC lifecycle success evidence through the existing production data-plane path without inventing a second daemon transport.
- Update fast Node assertions and live harness assertions so the visible UI says `WebRTC DataChannel` or equivalent on successful WebRTC and labels bridge-only responsibilities as bridge/bootstrap/signaling, not data transport.
- Include package build/version/build timestamp or asset revision when available. The smallest likely implementation is to render package/runtime version data already present in `package.json`, `botster-package.json`, Vite/build metadata, or hub package rows; only add a generated build constant if no existing runtime field is available.

## Non-Scope

- No Rails, Hotwire, Turbo, or server-rendered UI.
- No hub/core protocol changes unless implementation proves the current browser cannot observe a required state.
- No WebRTC reconnect, fallback policy, ICE candidate, or DataChannel reliability changes.
- No Restty terminal renderer refactor.
- No broad visual redesign of the Ionic diagnostics view or dashboard.
- No new state library, optional configurability, or speculative abstraction.

## Assumptions and Unknowns

- Assumption: `local_webrtc_bootstrap` is already available in package runtime and can identify bootstrap/signaling configuration without hub changes.
- Assumption: the production success path is `createDogfoodRuntimeConfig()` selecting `mode: "webrtc"` when `packageRuntime && localWebrtcBootstrap`, then `createWebrtcDaemonClient()` opening the `RTCDataChannel`.
- Assumption: the confusing screenshot/manual case is caused by visible labels such as `Real hub` / `Connected to isolated real hub dogfood bridge` and insufficient per-layer rows, not by an actual transport routing bug.
- Assumption: `terminalDataPlaneKind` is already the direct top-line source of truth for whether terminal data is using WebRTC, bridge/SSE, or mock fixture transport; implementation should render from it before adding new state.
- Assumption: in WebRTC mode the bridge should be labeled as packaged UI/bootstrap/signaling only, while in real-hub fallback mode the bridge/SSE path should be labeled as the data transport.
- Unknown: whether runtime-visible package asset revision/build timestamp already exists in injected package metadata. Implementer should inspect package runtime globals and app/package entity rows before adding a build-time constant.
- Unknown: whether success-side DataChannel/open/encrypted-ready diagnostics can be derived from `realHubTerminalDataPlane` / bridge request lifecycle, or require a narrow diagnostic callback in `WebrtcDaemonClientOptions`.
- Unknown: whether live harness WebRTC success can assert text from the packaged diagnostics view without increasing flake; if not, assert against both visible UI text and existing `__BOTSTER_LIVE_PROTOCOL_HARNESS__` events.

## Affected Surfaces / Files

- `src/botster/dogfoodMode.ts`: already exposes `terminalDataPlaneKind`; do not replace it with broader transport metadata unless a genuinely missing lifecycle sub-state requires it.
- `src/App.tsx`: update workflow summary and diagnostics view so `Connection` / data-plane labels render from `terminalDataPlaneKind` instead of collapsing through `mode`.
- `src/botster/connectionDiagnostics.ts`: add success-side diagnostic row builders for bridge/bootstrap/signaling/DataChannel/encrypted stream/fallback state while preserving existing `webRtcFailureDiagnostic()` failure mappings and hub-provided diagnostic preference.
- `src/botster/webrtcDaemonClient.ts`: only add a narrow diagnostic observer/callback if success-side DataChannel/encryption readiness cannot be observed at the shared data-plane wrapper.
- `src/botster/realHubTerminalDataPlane.ts`: include in implementation analysis because both WebRTC and real-hub modes attach terminal streams through `createRealHubTerminalDataPlane({ bridge })`; stream attach/status may be the correct place to surface data-plane readiness.
- `src/botster/realHubDogfoodTransport.ts`: include in implementation analysis because bridge request, EventSource terminal stream, and daemon response frame adaptation define the real-hub fallback transport behavior.
- `src/botster/ConnectionDiagnosticsPanel.tsx`: render the new rows with existing Ionic badge/list conventions; no redesign required.
- `src/App.test.mjs`: add/adjust assertions for WebRTC success labels, signaling failure diagnostics, lifecycle callback/state, and bridge fallback labeling.
- `scripts/live-packaged-protocol-harness.mjs`: tighten `waitForTransportLabel()` and/or add assertions that packaged WebRTC success visibly says `WebRTC DataChannel` and bridge/signaling labels are distinct.
- `README.md` and/or `docs/architecture.md`: update only if implementation adds user-facing diagnostic semantics or asset revision behavior that future agents need.
- Possible build metadata files: `package.json`, `botster-package.json`, `vite.config.ts`, or a small source constant if existing package metadata is not runtime-visible.

## Risks

- Collapsing lifecycle observations into one status string would repeat the existing ambiguity; each diagnostic badge/row should have one source of truth.
- Ignoring `terminalDataPlaneKind` would overbuild around the direct enum already returned by `createDogfoodRuntimeConfig()`.
- Duplicating `WebrtcDaemonFailureStage` or `webRtcFailureDiagnostic()` would create parallel failure diagnostics; success-side additions should compose with the existing failure path.
- Labeling real-hub mode as "bridge only serving/signaling" would be false because bridge/SSE is the fallback terminal data transport there; reserve "bridge is bootstrap/signaling only" for WebRTC mode.
- A callback from `webrtcDaemonClient` can become a parallel transport API if it exposes daemon payloads; keep it to diagnostic events only and prefer the shared data-plane wrapper if sufficient.
- Adding asset revision metadata at build time can create noisy rebuild diffs or stale values if generated incorrectly; prefer existing static package/version fields first.
- WebRTC lifecycle events are asynchronous; tests should drive fake DataChannel state transitions deterministically instead of timing on browser internals.
- The live harness can become flaky if it waits only on body text before the diagnostics view renders; use existing `data-testid="diagnostics-view"` and harness events as stabilizers.
- If hub does not inject enough package/build metadata, do not silently fake freshness claims; surface `unknown` or document the hub dependency.

## Acceptance Checks / Tests

- `npm test`: must cover fast protocol/drift checks plus `src/App.test.mjs` assertions for:
  - package runtime WebRTC success renders `terminalDataPlaneKind === "webrtc"` as `WebRTC DataChannel` or equivalent in the visible data-plane label;
  - WebRTC mode labels bridge/static serving and local signaling separately from terminal data transport;
  - real-hub fallback mode labels bridge/SSE as the terminal data transport instead of implying the bridge is non-data-carrying;
  - existing signaling failure diagnostics still flow through `WebrtcDaemonFailureStage` / `webRtcFailureDiagnostic()` as `webrtc-signaling-failed`;
  - fallback bridge mode remains explicit as bridge/SSE or bridge transport when WebRTC bootstrap is absent;
  - package version/build/asset revision renders as available or explicitly unknown.
- `npm run typecheck`: required because the likely change touches TypeScript interfaces across `dogfoodMode`, diagnostics, and app rendering.
- `npm run lint`: required for React/Ionic surface changes.
- `npm run smoke:live-packaged-protocol`: preferred live acceptance. It should assert visible text for WebRTC success and separate bridge/signaling responsibilities. If a compatible hub/session-worker pair is unavailable in the implementation environment, record that exact blocker and run `npm run smoke:packaged-browser` plus the fast fake WebRTC/DataChannel assertions instead.
- Manual verification target: packaged diagnostics page must show `WebRTC DataChannel` (or equivalent) for WebRTC data-plane success; WebRTC mode must not imply the bridge is carrying terminal traffic when it is only serving/signaling; real-hub fallback mode must honestly label bridge/SSE as the data transport.

## Pipeline Gates and Artifacts

- Submit this plan as `botster_plan_gate` evidence with explicit assumptions, affected files, risks, tests, and vault gaps.
- Worktree/target assumptions: run target is `tgt_40abcf71ccf049f4ac0c99953a799869`; assigned worktree is the current pipeline checkout for `trybotster/botster-web`.
- Checklist discipline: `checklist_1783032174_148325` records notes read, convention conflicts as none, planned verification commands, and capture disposition.

## Vault Gaps Worth Capturing

- Capture if implementation proves a durable rule such as "botster-web WebRTC diagnostics must report bridge/bootstrap/signaling/data-plane as separate rows sourced from `terminalDataPlaneKind`, `WebrtcDaemonFailureStage`, and terminal data-plane wrapper events" or "package asset revision must be sourced from hub package runtime metadata."
- Do not capture a vault note merely for this ticket title until implementation confirms the reusable project rule and exact source of truth.
