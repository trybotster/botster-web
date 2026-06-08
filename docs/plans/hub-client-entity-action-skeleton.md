# Hub Client Entity Action Skeleton Plan

## Context Loaded

- Pipeline context: ticket `ticket_1780941198_256150`, run `run_1780957210_691578`, Plan step, Plan Review changes-requested findings, closed dependencies, gate prompt, checklist evidence, and prior review.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Botster architecture context: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]].
- Planning constraints: [[plan steps need reviewable plan artifacts]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]].
- SPA and entity constraints: [[botster hub client state sync is entity frame only]], [[botster client subscriptions should not hydrate global state]], [[botster browser pull requests must retry after webrtc reconnect]], [[botster entity snapshots are authoritative reconnect baselines]], [[scoped entity snapshots preserve whole-family sequence gates]], [[botster spa has one route owned hub control plane connection]], [[botster webrtc request consumers should use operation gates not connection checks]].
- Orchestration constraints: [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Repo context: `botster-web` is a Vite/Ionic React shell with existing protocol/client/entity/action seams in `src/botster/*` and current string-level assertions in `src/App.test.mjs`.

## Scope

- Add a transport-neutral hub connection skeleton that connects, disconnects, subscribes, sends outbound frames through an injected transport, and receives inbound hub control frames.
- Extend the protocol seam with an outbound `action_request` frame and typed local `UiActionRequest` / `UiActionResult` envelope aliases or adapters. If the dependency-provided botster-core envelope types are present, consume or mirror their field names instead of inventing incompatible names.
- Implement an in-memory entity frame store/reducer for `entity_snapshot`, `entity_upsert`, `entity_patch`, and `entity_remove`.
- Add selector/read helpers needed by tests and later UI binding work, without adding a global app state library.
- Keep `subscribe()` transport-only. Entity, route, and surface hydration must be explicit pulls.
- Add active pull tracking and `replayActivePulls()` so reconnect can re-issue view-scoped pulls lost while the transport was down.
- Add a surface subscription placeholder hook that records requested surfaces and can replay them after reconnect, without implementing plugin rendering or iframe transport.
- Implement semantic `UiActionRequest` dispatch with deterministic request id generation in tests, pending request correlation, inbound `UiActionResult` handling from `action_result`, and cleanup on success, failure, timeout, or disconnect rejection.
- Prove behavior with deterministic fake-transport tests that instantiate the runtime skeleton, not just string-scan source files.
- Update `docs/architecture.md` and `README.md` only if needed to describe the concrete skeleton and deferred live transport boundary.

## Non-Scope

- No live WebRTC, WebSocket, ActionCable, cloud, Rails, or local daemon socket implementation.
- No hardcoded local daemon paths, absolute worktree paths, user home paths, cloud endpoints, or PII fixtures.
- No Restty terminal data-plane implementation.
- No plugin iframe or isolated asset bridge implementation beyond existing placeholders.
- No new npm dependencies, query/state libraries, app-wide singleton store, or UI redesign.
- No scoped plugin snapshot implementation. `entity_scoped_snapshot` remains out of scope; this plan must not treat scoped snapshots as full-family baselines.
- No broad botster-core schema duplication. The implementation should keep adapter boundaries narrow and replace local envelope shapes when canonical package types become available.

## Assumptions And Unknowns

- This ticket is scaffold-first: exact live hub transport is intentionally deferred, but the local runtime path must be executable through injected/fake transport.
- The production entry point should expose or instantiate the skeleton through the existing `botsterWebClientContract` / client factory path. If live connection remains intentionally disabled, the code and docs must say so and tests must still prove the runtime skeleton behavior.
- `subscribe()` establishes the hub control channel only. It must not hydrate entity families, route registries, or surface trees.
- Reconnect replay means re-sending active pulls and surface subscriptions after a simulated reconnect, following [[botster browser pull requests must retry after webrtc reconnect]].
- Full `entity_snapshot` frames are authoritative reconnect baselines and bypass stale-delta sequence gating. Delta frames (`entity_upsert`, `entity_patch`, `entity_remove`) obey sequence gating if sequence metadata is present.
- `entity_patch` should be a shallow object merge for object records in this scaffold. If either existing record or patch payload is non-object, replace with the patch payload and document that as scaffold behavior.
- UiAction request ids should be transport-correlation ids, not DOM event ids. Tests should inject a deterministic id generator, for example `ui-action-1`.
- Unknown: exact botster-core exported TypeScript names for the dependency ticket's UiAction envelopes are not visible in this repo. Implementer should search package/API context first; if unavailable, use local names that preserve the round-trip shape and isolate them in `protocol.ts` or `actions.ts`.

## Affected Surfaces And Files

- `src/botster/protocol.ts`: add outbound frame typing, `action_request`, inbound `action_result` payload typing, connection transport interface, and any narrow envelope aliases.
- `src/botster/entities.ts`: implement entity store reducer, selectors, active pull tracking, replay hooks, and sequence baseline behavior.
- `src/botster/actions.ts`: implement UiAction dispatcher, request id correlation, pending map cleanup, timeout/reject behavior, and `action_result` ingestion.
- `src/botster/client.ts`: compose the connection, entity store, and action dispatcher into an exported factory or contract object used by the app scaffold.
- `src/botster/uiNodes.ts` or a new nearby module: add a surface subscription placeholder only if it belongs outside the connection class.
- `src/App.tsx` / `src/botster/UiFrameHost.tsx`: touch only if needed to prove the production scaffold consumes the new client skeleton. Keep UI changes minimal.
- `src/App.test.mjs` and optionally new `src/botster/*.test.mjs`: replace or supplement string assertions with deterministic fake-transport behavior tests.
- `docs/architecture.md` and `README.md`: update only for concrete skeleton behavior and deferred live-transport boundaries.

## Action Correlation Design

- Add outbound `action_request` as a hub control frame kind or as a distinct outbound frame union beside inbound `HubControlFrame`.
- Outbound request shape:
  - `request_id`: generated or caller-provided correlation id.
  - `action`: existing semantic `ActionBinding`.
  - `origin`: existing dispatch origin.
  - `params` or envelope fields aligned with botster-core typed UiActionRequest if available.
- Inbound result shape:
  - `request_id`: correlation id matching a pending request.
  - `accepted` / `ok` plus optional result payload or error reason, aligned with botster-core typed UiActionResult if available.
- `ActionDispatcher.dispatch()` should resolve from the matching `action_result`, not from local send acceptance alone.
- A transport send failure, disconnect rejection, timeout, or explicit negative result must reject or resolve with a failed result and remove the pending entry.
- Unknown or duplicate `action_result` frames should not crash the client. Tests should cover at least unknown-result ignore or failed-result handling.

## Reconnect And Entity Semantics

- `connect()` establishes the injected transport and registers ingress callbacks.
- `subscribe()` sends only the hub-channel subscription frame and records subscription state. It must not call entity pulls or hydrate all families.
- `pull(request)` records an active entity pull and sends a pull frame/request through the connection.
- `replayActivePulls()` resends active entity pulls after reconnect. It should be deterministic and idempotent for the same active pull key.
- Surface subscription placeholder records active surface requests separately from entity pulls and replays them after reconnect.
- Full `entity_snapshot` replaces the relevant family/id baseline and bypasses stale-delta sequence checks.
- Delta frames mutate the current store only if they are not stale when sequence metadata exists.
- Scoped snapshots are out of scope and must not be modeled as whole-family baselines in this ticket.

## Risks

- Overbuilding live transport would violate the ticket. Keep the transport injected, fakeable, and path-neutral.
- Local envelope names may drift from botster-core. Search for dependency-provided types first and isolate any local fallback.
- String-only tests would miss the behavior required by acceptance. Tests must instantiate the fake transport and runtime skeleton.
- Subscribe can accidentally become global hydration. Add an explicit no-hydration test.
- Reconnect replay can duplicate pulls or forget surface subscriptions. Use deterministic active-pull keys and tests for replay counts.
- Pending actions can leak after failed sends, timeouts, or disconnects. Test cleanup.
- Sequence logic can reject authoritative reconnect snapshots. Tests must prove full snapshots reset baselines while stale deltas are ignored.

## Acceptance Checks And Tests

Run after implementation:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Deterministic test mapping:

- Entity frames:
  - Apply `entity_snapshot` for a family and assert the store contains exactly the snapshot records.
  - Apply `entity_upsert` and assert insert/update by family/id.
  - Apply `entity_patch` and assert shallow object merge behavior.
  - Apply `entity_remove` and assert deletion.
  - Apply a lower-sequence full `entity_snapshot` after a higher-sequence delta and assert the snapshot is accepted as the authoritative reconnect baseline.
  - Apply a stale lower-sequence delta and assert it is ignored.
- Action request/result correlation:
  - Dispatch an action with deterministic id generation and assert fake transport receives `action_request` with that id.
  - Inject matching `action_result` and assert `dispatch()` resolves to the result and clears pending state.
  - Inject non-matching `action_result` and assert no pending request resolves incorrectly.
  - Simulate send failure or timeout and assert pending cleanup.
- Reconnect-safe replay:
  - Record active entity pulls and surface subscriptions.
  - Simulate disconnect/reconnect.
  - Assert `replayActivePulls()` and surface replay re-send only the active requests.
- No global hydration:
  - Call `connect()` and `subscribe()` on fake transport.
  - Assert no entity records exist and no entity pull frames were sent until an explicit pull request occurs.
- Path/PII/cloud/Rails:
  - Test fixtures should use neutral ids such as `hub-test`, `session-1`, and `workspace-1`.
  - No test or doc should include local daemon paths, home-directory paths, cloud-only URLs, Rails dependencies, or personal data.

## Vault Gaps Worth Capturing

- No new durable vault note is needed from planning. Existing notes cover the architecture constraints.
- Capture later if implementation discovers the exact botster-core TypeScript UiAction envelope names and how `botster-web` maps to them.
- Capture later if implementation uncovers a durable entity sequence rule not covered by [[botster entity snapshots are authoritative reconnect baselines]] or [[scoped entity snapshots preserve whole-family sequence gates]].
