# Consume Wrapped Plugin Surface Render Responses

## Context Loaded

- Pipeline context: ticket `ticket_1783279301_435463`, run `run_1783281932_272814`, current step `botster_plan`, gate `botster_plan_gate`.
- Dependency: hub ticket `ticket_1783279289_147399` is registered and closed.
- Plan Review returned changes required because the first plan had no durable repo artifact and did not prove the authoritative hub DTO source.
- Playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Vault architecture notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan steps need reviewable plan artifacts]], [[botster web generated protocol drift checks need explicit hub artifact paths]], [[botster web dto field names must match authoritative rust serde structs]], [[plugin surface route completion needs explicit render phase]].
- Repo inspection: `src/App.tsx`, `src/botster/generated/daemon-protocol.ts`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/check-daemon-protocol-drift.mjs`, and `package.json`.
- Authoritative hub artifact checked for this run: `../trybotster-botster-hub-project-pipelines-ticket_1783279289_147399/crates/botster-hub-client/generated/daemon-protocol.ts`.

## Authoritative Shape

The current botster-web artifact still has:

```ts
plugin_surface?: JsonValue;
```

The dependency hub artifact has:

```ts
plugin_surface?: DaemonPluginSurface | null;

export interface DaemonPluginSurface {
  package_name: string;
  surface_id: string;
  body: JsonValue;
}
```

That is the important distinction for implementation. The current web fixtures and deterministic bridge use a richer local shape with fields such as `title` and string `body`; that is fixture behavior, not the authoritative hub DTO contract. The implementation should refresh the generated protocol artifact from the hub source above, then make the browser consume `DaemonPluginSurface.package_name`, `DaemonPluginSurface.surface_id`, and `DaemonPluginSurface.body` without requiring fixture-only `title` or string-body assumptions.

## Scope

- Refresh `src/botster/generated/daemon-protocol.ts` from the explicit hub artifact path above.
- Refresh or remove stale generated request/response fixtures in `src/botster/__fixtures__/generatedDaemonProtocol.ts` so tests no longer prove the old `JsonValue` plugin surface shape.
- Update `src/App.tsx` helpers:
  - `pluginSurfaceStatus`
  - `pluginSurfaceMatches`
  - `pluginSurfaceSnapshot`
  - `renderedPluginSurfaceState`
- Preserve stable plugin routes under `/apps/:package/:surface` by using route render phase state (`rendering`, `rendered`, `error`) and accepting either a `ui_tree_snapshot` or matching authoritative `plugin_surface` payload as terminal success.
- Treat accepted responses with no matching `plugin_surface` and no `ui_tree_snapshot` as terminal error, not indefinite Loading.
- Update `src/botster/realHubDogfoodTransport.ts`, `scripts/real-hub-dogfood-bridge.mjs`, and `scripts/packaged-browser-smoke.mjs` only as needed so deterministic responses mimic the authoritative `DaemonPluginSurface` shape.
- Update `src/App.test.mjs` and `scripts/live-packaged-protocol-harness.mjs` so Workspaces or another first-party real plugin route renders visible content, leaves Error/Loading, and survives refresh/direct-load.

## Non-Scope

- No hub implementation work; the hub dependency is already closed.
- No Rails, Hotwire, or old monolith edits.
- No new workflow primitives, optional configuration, app shell redesign, or broad cleanup.
- No change to WebRTC, settings, terminal, or package lifecycle behavior except preserving existing smoke coverage.
- No PII or local absolute path data in committed artifacts.

## Implementation Plan

1. Refresh generated protocol:
   - Copy the authoritative hub artifact into `src/botster/generated/daemon-protocol.ts`.
   - Run the drift check with:

     ```sh
     BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=../trybotster-botster-hub-project-pipelines-ticket_1783279289_147399/crates/botster-hub-client/generated/daemon-protocol.ts node scripts/check-daemon-protocol-drift.mjs
     ```

   - Do not accept a skipped drift check as protocol evidence.

2. Update browser plugin surface parsing:
   - Read `result.plugin_surface` as the authoritative surface object.
   - Match on `package_name` and `surface_id`.
   - Interpret `body` as `JsonValue`, not necessarily a string.
   - If `body` contains a renderable text field or primitive payload, use it for the status/rendered content path; otherwise still allow route success when package/surface match and body is present.
   - Keep `ui_tree_snapshot` handling as an independent success path when present.

3. Update route completion:
   - Keep a route-level render phase for `/apps/:package/:surface`.
   - On dispatch start, set `phase: "rendering"`.
   - On accepted matching `plugin_surface` or `ui_tree_snapshot`, set `phase: "rendered"`.
   - On rejected, missing payload, or mismatched package/surface response, set `phase: "error"` with a visible diagnostic.
   - Guard route dispatch by route key so refresh/direct-load works without duplicate render loops.

4. Update tests and fixtures:
   - Replace deterministic plugin-surface responses that rely on `title` with authoritative `DaemonPluginSurface` data.
   - Add/keep focused tests for:
     - matching `package_name` and `surface_id` succeeds without a snapshot;
     - mismatched package/surface errors;
     - accepted response missing both `ui_tree_snapshot` and matching `plugin_surface` errors;
     - `body` is handled as JSON, not only a string.
   - Ensure `src/App.test.mjs` proves the production route component leaves Loading and renders visible success content.

5. Update live and packaged harnesses:
   - `scripts/live-packaged-protocol-harness.mjs` must click a first-party plugin app route, observe `plugin_surface_render`, wait for selected surface content, and verify refresh/direct-load of the same route.
   - `scripts/packaged-browser-smoke.mjs` must continue proving the deterministic package surface path and should use the refreshed shape.

6. Audit all plugin surface consumers:
   - `src/App.tsx`
   - `src/botster/realHubDogfoodTransport.ts`
   - `scripts/real-hub-dogfood-bridge.mjs`
   - `scripts/packaged-browser-smoke.mjs`
   - `scripts/live-packaged-protocol-harness.mjs`
   - `src/App.test.mjs`

## Assumptions And Unknowns

- Assumption: `../trybotster-botster-hub-project-pipelines-ticket_1783279289_147399/crates/botster-hub-client/generated/daemon-protocol.ts` is the correct dependency artifact for the closed hub ticket in this run.
- Assumption: `DaemonPluginSurface.body` is the stable rendered payload field for real Workspaces responses.
- Assumption: a matching `package_name` and `surface_id` plus present `body` is enough to move the route to rendered state even when no `ui_tree_snapshot` exists.
- Unknown: exact `body` JSON structure for real `botster-workspaces/workspaces`; implementer must verify from live harness output or authoritative hub fixtures before assuming a text-only shape.
- Unknown: whether existing `src/App.tsx` render-phase code is already a partial implementation from a prior attempt; implementation should compare against `origin/main` and keep only changes that trace to this ticket.

## Affected Surfaces And Files

- Botster layer: React SPA route/rendering and hub daemon DTO consumption.
- Botster layer: generated daemon protocol artifact.
- Botster layer: deterministic and live packaged protocol harnesses.
- Files:
  - `src/botster/generated/daemon-protocol.ts`
  - `src/botster/__fixtures__/generatedDaemonProtocol.ts`
  - `src/App.tsx`
  - `src/App.test.mjs`
  - `src/botster/realHubDogfoodTransport.ts`
  - `scripts/real-hub-dogfood-bridge.mjs`
  - `scripts/packaged-browser-smoke.mjs`
  - `scripts/live-packaged-protocol-harness.mjs`
  - `scripts/check-daemon-protocol-drift.mjs` only if explicit-path behavior needs tightening for this acceptance path.

## Risks

- Fixture self-reference: deterministic tests can keep passing with `title` and string `body` while real hub responses only provide `package_name`, `surface_id`, and JSON `body`.
- Protocol refresh blast radius: replacing `plugin_surface?: JsonValue` with `DaemonPluginSurface | null` can reveal TypeScript assumptions in all plugin-surface consumers.
- Route false positive: accepting any successful action result would hide mismatched package/surface responses. Matching must be explicit.
- Route false negative: requiring only `ui_tree_snapshot` would keep placeholder or body-only surfaces stuck on Loading.
- Live harness flake: package availability and hub runtime setup can fail for reasons unrelated to this ticket. Any waiver needs exact evidence and cannot replace deterministic DTO-shape tests.
- Drift check skip: `npm test` alone is insufficient if the authoritative hub artifact path is missing. Acceptance evidence must include the explicit `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` run.

## Acceptance Checks

- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=../trybotster-botster-hub-project-pipelines-ticket_1783279289_147399/crates/botster-hub-client/generated/daemon-protocol.ts node scripts/check-daemon-protocol-drift.mjs`
- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=../trybotster-botster-hub-project-pipelines-ticket_1783279289_147399/crates/botster-hub-client/generated/daemon-protocol.ts npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run smoke:packaged-browser`
- `npm run smoke:live-packaged-protocol` with real hub setup available.
- Manual acceptance: opening Workspaces from Apps no longer shows `Render response did not include botster-workspaces/workspaces payload.`
- Manual acceptance: Workspaces route reaches rendered/success state and displays actual surface content.
- Manual acceptance: refresh/direct-load of the Workspaces route works.
- Regression acceptance: existing WebRTC, settings, and terminal smoke coverage remains green or failures are attributed exactly as unrelated.

## Vault Gaps

- No new durable vault note is needed. The key planning failure is covered by [[plan steps need reviewable plan artifacts]], the protocol-source issue is covered by [[botster web generated protocol drift checks need explicit hub artifact paths]], and route completion is covered by [[plugin surface route completion needs explicit render phase]].
