# Web: render reactive entity-backed select options

## Plan revision

| Field | Value |
| --- | --- |
| Revision | **2** — addresses Plan Review `review_1786481471_457204` |
| Closed in rev 2 | `finding_1786481471_113608` (route-owned demand + races), `finding_1786481471_940806` (base `6efb3b6` componentization), `finding_1786481471_529153` (mandatory live invalidation) |
| Kept explicit | `finding_1786481471_802371` (ui-contract `0.3.2` unpublished — hard Implement gate, not a soft residual) |
| Process / infra | Duplicate vault checklists skipped; `.gitignore` re-verified after Review restore |
| Pipeline ticket | `ticket_1786474780_865627` |
| Pipeline run | `run_1786480497_920164` |
| Step visit | Plan sequence 3 (`run_step_1786481488_773848`) |
| Runtime-teardown class | **Does not apply** |
| Session-type eligibility consumer | **Does not apply** |

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` (registry label; repo is `botster-web`) |
| Base pin for this Plan visit | `origin/main` @ **`6efb3b676b4fd0949618dcd41549213b30ca5b75`** (“Finish application componentization”) |
| Worktree | Merged to that SHA for planning; Implement must not plan against pre-componentization `App.tsx` |

Repository routing: `project_pipelines_current_context` → ticket/run `target_id` → `list_spawn_targets` (`id: tgt_40abcf71ccf049f4ac0c99953a799869`, `repo_name: trybotster/botster-web`). Not ambient cwd.

## Repository playbook loaded

- [[botster-web-playbook]]

## Other role / surface playbooks and atomic notes loaded

### Role entrypoints

- [[planner-playbook]]
- [[botster-planner-playbook]]

### Intentionally not loaded

- [[project-pipelines-playbook]] — no PP package/plugin path change
- [[botster runtime teardown lenses]] — not teardown class
- Hub/TUI ownership charters as implement owners

### Architecture / SPA

- [[spa-patterns]]
- [[botster web frontend is react catalyst and new wire entity store first]]
- [[botster wire v2 clients must consume ui tree snapshots and render composites with entity stores]]
- [[botster web uses vanilla ionic primitives by default]]
- [[botster-web ionic supersedes catalyst for client shell]]

### Charter must-load (web)

- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[hub qualifies effective session type ids as source name slash id]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]

### Entity / select / demand / race notes

- [[botster hub client state sync is entity frame only]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[botster client subscriptions should not hydrate global state]]
- [[botster browser pull requests must retry after webrtc reconnect]]
- [[plugin surfaces request model state through ui bindings not hub subscribe]]
- [[plugin-owned dynamic state uses plugin-namespaced entity frames]]
- [[browser plugin entity consumers use generic selectors]]
- [[plugin dynamic ui lists bind to plugin-owned entities]]
- [[plugin entity families publish filterable record supersets]]
- [[botster shared form primitive v1 is intentionally narrow and catalyst first]]
- [[cross-client ui should share semantic primitives and actions with renderer-specific adapters]]
- [[botster package surface semantics live in ui contract while hub owns admission]]
- [[runtime client acceptance must render delivered snapshots through real registry]]
- [[react component launcher proofs must render and interact with the real component]]
- [[conformance oracles assert action result frames not toast text]]
- [[botster web form actions must preserve collected values into transport payloads]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[hub test support npm releases need external consumer smoke]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[hub support metadata can force a web ui contract cold update]]
- [[cold turkey migrations eliminate dual code paths and version suffixes]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]

## Context loaded

### Ticket intent

Adopt merged `botster-ui-contract` entity-options and render reactive entity-backed `ui.select` options through the **existing** generic entity store. Contract-defined projection, ordering, exclusion, metadata, selection invalidation, exact value submit. Options update from snapshots/ordered entity changes **without** surface refresh. Shared fixture + production browser proof on real Hub transport and owner package surface.

### Base / componentization (finding 940806)

Worktree Plan visit is aligned to **`6efb3b6`**. Plugin surface production path is no longer an undifferentiated `App.tsx` blob:

| Piece | Role |
| --- | --- |
| `src/app/usePluginRouteState.ts` | Claims app/settings route keys, starts Hub render, **accepts completion only if claim still current** via `applyPluginRouteCompletionIfCurrent` |
| `src/app/pluginRouteState.ts` | Pure claim/completion helpers (`claimPluginRouteRender`, `isPluginRouteCompletionCurrent`, `pluginRouteRenderCompleted`) |
| `src/app/pluginRoutes.tsx` | `PluginSurfaceRoutePage` / settings page: mounts `UiNodeSurface` with `entities` + `selectedSurface.snapshot` |
| `src/app/usePluginSurfaceDispatch.ts` | Canonical plugin action dispatch, presentation, whole-surface replacement |
| `src/app/pluginSurfaceState.ts` | `SelectedPluginSurface` phase/snapshot/result |
| `src/app/AppsRouteView.tsx` / `WorkbenchShell.tsx` | Shell placement only |

### Dependency / artifact facts

| Fact | Evidence |
| --- | --- |
| Hub dependency | Closed `ticket_1786474779_865884`; PR #205 merge `891cc79` on hub main |
| Contract on hub main | `@trybotster/ui-contract` **0.3.2** with `projectEntityOptions`, `collectEntityOptionFamilies`, `entity_options_reactive_timeline` |
| Registry at Plan rev 2 | **Still 404** for `0.3.2` (re-verified). Latest public `0.3.1` lacks helpers |
| Parent residual | Operator: `cd packages/ui-contract && npm publish --access public` |

[[closed dependency tickets signal merged source not a consumable release]]: **Implement must not start** until `npm view @trybotster/ui-contract@0.3.2` succeeds and installed package exports + fixture content are verified. No `file:` / sibling default.

### Current production gaps (web @ `6efb3b6`)

1. `ui.select` is static (`props.options` / `slots.options` only) in `IonicUiNodeRenderer.tsx`.
2. `daemonEntityFrame` / `canonicalEntityProjection` only keep `session` and `session_type`; package families are dropped.
3. `entity_pull` only special-cases a fixed family set; held `subscribeEntityFrames` is only ensured for session/session_type.
4. **No** `collectEntityOptionFamilies` after surface accept.
5. Reconnect: held entity subscriptions reconnect via `webrtcDaemonClient.reconnectEntitySubscriptions()`; `EntityFrameStore.replayActivePulls()` has **no production caller** (`hubLifecycle.ts` documents this). Plan must not assume pull-registry replay for options families.

### Authoritative contract shape (hub 0.3.2)

```json
{
  "type": "select",
  "props": {
    "name": "session",
    "label": "Session",
    "options_source": {
      "$kind": "entity_options",
      "source": "/session",
      "value_field": "session_uuid",
      "display_fields": ["label", "lifecycle_class", "session_type", "spawn_point"],
      "order": ["label", "session_uuid"],
      "where": { "lifecycle_class": "current" },
      "exclude": {
        "source": "/project-pipelines.run",
        "value_field": "session_uuid",
        "where": { "status": "active" }
      }
    }
  }
}
```

- Static options **xor** `options_source` (`entity_options`).
- Values are JSON strings; submit exact projected `value`.
- Projection is **only** via shared `projectEntityOptions`.
- Demand: `collectEntityOptionFamilies(body)` → slash-stripped `SubscribeEntities.entity_type`.
- Fixture: `entity_options_reactive_timeline` (11 steps including selection_invalid).

## Scope

### 1. Cold pin consumable contract

1. When registry publishes `0.3.2`, pin `dependencies` + lockfile.
2. Assert exports `projectEntityOptions`, `collectEntityOptionFamilies`, and fixture `entity_options_reactive_timeline`.
3. Update README / architecture pin strings as needed.
4. **Hard gate:** if still unpublished, stop and ask human / wait — do not implement a local projector.

### 2. Project entity-backed select in Ionic renderer

In `IonicUiNodeRenderer.tsx` (production path used by `PluginSurfaceRoutePage` → `UiNodeSurface`):

1. On `select` + `options_source.$kind === "entity_options"`:
   - Build source/exclude record maps from the **existing** `EntityFrameStore`.
   - Call `projectEntityOptions(descriptor, sourceRecords, excludeRecords, selection)`.
   - Render `IonSelect` / `IonSelectOption` with exact `value`, primary `label`, and useful metadata (lifecycle / session type / spawn point when present) via vanilla Ionic notes/secondary text.
2. Keep static options path for non-entity selects (xor; no merge invention).
3. Form draft + submit: exact string value through existing `UiActionRequest.values` (`usePluginSurfaceDispatch`).
4. **Selection invalidation (mandatory product + live proof):**
   - If draft selection is a string and `selection_valid === false`: clear invalid UI state (field error / helper: selected option no longer available); **do not auto-pick**.
   - **Block dispatch** of form submit while that control is invalid (fail closed before `usePluginSurfaceDispatch` / worker request).
   - After a valid replacement is chosen, allow submit with that exact value.

### 3. Route-owned family demand + request-race lifecycle (finding 113608)

**Owner of demand:** the same claim-scoped completion path that owns accepted plugin surface state — **`usePluginRouteState`** (not a free-floating App effect).

#### Production topology (locked)

1. User navigates to stable plugin app/settings route → `usePluginRouteState` claims `routeKey` (`package/surface`).
2. Hub `plugin_surface_render` / launch action returns accepted surface → `pluginRouteRenderCompleted` only if claim still current.
3. **On current accepted `SelectedPluginSurface` with snapshot root** (same claim key):
   - `collectEntityOptionFamilies(snapshot.root)` (union any future bind_list family collectors if already present; do not invent a second store).
   - Diff against **families already demanded for this claim**.
   - For each new family: explicit demand:
     - `session` / `session_type` → existing ensure-subscribe paths.
     - Other families → **generic** held `subscribeEntityFrames(entityType)` + project frames into generic store (extend `daemonEntityFrame`).
4. **Stale completion rejection:** if route A’s render completes after route B claimed, do **not** set surface state, do **not** start A’s family demand, do **not** replace B’s subscriptions. Reuse `applyPluginRouteCompletionIfCurrent(claimedPluginRouteKey, routeKey, …)` for demand start (same pattern as render completion).
5. **Route exit / claim change cleanup:**
   - When claim clears or moves A → B: stop tracking A’s demanded family set; release held subscriptions that are no longer required by the **current** claim (do not unsubscribe families still needed by B or global session chrome if intentionally shared — document shared vs surface-scoped).
   - Prefer: surface-scoped demand registry keyed by `routeKey`; only the current key’s demanded set is live for package exclude families; session may remain process-wide if already held by chrome.
6. **Duplicate demand:** second collect for the same claim + family is a no-op (idempotent ensure).
7. **Reconnect (current-family only):**
   - Held `subscribeEntityFrames` already re-issues subscribe after DataChannel open (`reconnectEntitySubscriptions`). Implement must **keep entity-options families on that held path**, not on one-shot `entity_pull` that relies on dead `replayActivePulls`.
   - Acceptance: after reconnect, current claim’s families receive a new authoritative snapshot and options re-project **without** surface re-render action / refresh.
8. **No surface refresh** as the options update mechanism: store apply → React re-render of the same mounted `UiNodeSurface`.

#### Request-race / SPA request-state tests (required)

| Case | Required proof |
| --- | --- |
| A then B late completion | Start render A, navigate B, A completes late → selected surface is B; only B’s families demanded; A’s demand not applied |
| Route exit cleanup | Leave B → package exclude family unsubscribed (or no longer held) if unused; no orphaned listeners for abandoned claim |
| Duplicate demand | Double collect on same claim → single subscribe per family |
| Reconnect | With B mounted and entity_options select live, force DataChannel reconnect → new snapshot for B’s families; options update without plugin_surface_render redo |
| No surface refresh | Options change after upsert/patch/remove with zero second launch action |

Prefer extending `src/app/__fixtures__/pluginRouteStateHarness.tsx` + unit tests around pure claim helpers + a thin demand helper with injectable subscribe.

### 4. Generic plugin entity frames into the store

Extend `daemonEntityFrame` / `canonicalEntityProjection` so non-session entity types land as generic records (`family = entity_type`, `id` from frame/item, fields pass-through). Keep specialized session/session_type projections. Flip tests that assert package frames are dropped when those families are required for options.

### 5. Deterministic tests

1. Full `entity_options_reactive_timeline` against real store + production select rendering path.
2. Collector oracle (slash-stripped families).
3. Exact value submit via production dispatch path.
4. Invalid selection UI + blocked dispatch (deterministic).
5. Route demand race matrix above.

### 6. Live Hub browser proof (charter) — mandatory invalidation (finding 529153)

Owner-authored package surface (prefer `fixtures/` under botster-web, dual-family shape matching hub admission tests) on real Hub ≥ `891cc79` + session-worker.

**Mandatory live sequence (no soft residual):**

1. Open stable host route for the owner package surface (production `usePluginRouteState` path).
2. Assert `subscribe_entities` for collected source + exclude families.
3. Options appear from authoritative snapshots without surface refresh.
4. **Select a concrete option value** in the real Ionic control.
5. **While the dialog/form remains open**, remove or exclude that value (entity remove / exclude family change / provider mutation that the live package can drive).
6. Assert **invalid state is visible** and **stale submit does not produce a successful plugin_surface_action with the dead value** (request blocked client-side or rejected with structured evidence — prefer client block + no worker values for dead option).
7. Choose a **valid replacement** option; submit; assert `request.values[name]` equals that exact string.
8. Fail loudly if pin/fixture/package/live lane missing — no skip-to-green.

Also: ordered upsert/patch/remove or reconnect convergence live where feasible; timeline fixture remains complementary deterministic coverage, not a substitute for steps 4–7.

### 7. Docs

Pin/contract notes in README / architecture only as needed.

## Non-scope

- No hub/core/ui-contract source edits (consume published 0.3.2 only).
- No botster-workspaces product logic, `/session` policy, atomic-spawn ownership.
- No `list_sessions`, list refresh, second entity store, forked projector.
- No Catalyst / non-Ionic select framework.
- No TUI / TUI-kit / PP plugin path work.
- No runtime-teardown class work.
- No broad App re-componentization beyond wiring demand into existing hooks.

## Repository ownership boundaries and cross-repo dependencies

| Layer | Owns | Does not own |
| --- | --- | --- |
| ui-contract 0.3.2 | Projector, collector, fixture | Transport |
| Hub ≥ 891cc79 | Admission, entity serve | Web UI |
| **botster-web** | Ionic options render; route-owned demand; generic store projection; invalidation; live proof | Package product policy |

| Dependency | Status | Action |
| --- | --- | --- |
| `ticket_1786474779_865884` | Closed | Registered |
| npm `@trybotster/ui-contract@0.3.2` | **Unavailable** | Hard Implement gate; operator publish |

## Assumptions and unknowns

1. Implement blocked until registry `0.3.2` install verifies exports + fixture.
2. Generic plugin entity frames are in-scope (required for exclude families + live dual-family).
3. Session family may remain process-wide; package exclude families are claim/surface-scoped.
4. Vanilla IonSelect can express metadata + invalid state without a custom picker.
5. Owner live fixture packaging: web `fixtures/` package preferred.
6. hub-test-support pin may stay until a published support package is required for drift reasons; entity-options content ships in ui-contract.

## Affected surfaces / files

| Area | Files (post-`6efb3b6`) |
| --- | --- |
| Pins | `package.json`, `package-lock.json` |
| Renderer | `src/botster/IonicUiNodeRenderer.tsx` |
| Entity projection / subscribe | `src/botster/hubTransport.ts`, `src/botster/webrtcDaemonClient.ts` (only if held-subscribe API needs wiring), `src/botster/entities.ts` only if thin adapter needed |
| **Route-owned demand** | **`src/app/usePluginRouteState.ts`** (primary), optional small pure helper e.g. `src/app/entityOptionsDemand.ts` for collect/diff/cleanup |
| Dispatch / invalid submit | `src/app/usePluginSurfaceDispatch.ts` and/or form submit path in renderer |
| Render mount | `src/app/pluginRoutes.tsx` (consume store; likely minimal change) |
| Tests | `src/App.test.mjs`, `src/app/__fixtures__/pluginRouteStateHarness.tsx`, focused demand/race tests |
| Live | harness scripts + `fixtures/…` owner package |
| Docs | `README.md`, `docs/architecture.md`, this plan |

## Risks

| Risk | Mitigation |
| --- | --- |
| Unpublished 0.3.2 | Hard gate |
| Stale route demand | Claim-scoped demand + late completion tests |
| Orphan package subscriptions | Cleanup on claim change |
| Reconnect empty options | Held subscribe path, not dead pull replay |
| Soft live invalidation | Acceptance forbids residual; live steps 4–7 mandatory |
| Projector drift | Call shared helpers only |

## Acceptance checks / tests

### Install

1. `npm view @trybotster/ui-contract@0.3.2` succeeds; no `file:` override.
2. Installed exports + `entity_options_reactive_timeline` present.
3. `npm test`, `typecheck`, `lint`, `build` pass on base ≥ `6efb3b6`.

### Deterministic / renderer

4. Timeline fixture equality through real store + select path.
5. Options update on entity frames without surface re-render action.
6. Label + metadata visible when present.
7. Exact value in `UiActionRequest.values`.
8. Invalid selection UI + blocked dispatch (deterministic).
9. Collector oracle.

### Request-race / route ownership

10. A-then-B late completion: surface + demand owned by B only.
11. Route exit cleanup for abandoned claim families.
12. Idempotent re-collect.
13. Reconnect re-snapshots current claim families; options repopulate without second launch action.

### Live Hub (mandatory invalidation)

14. `npm run smoke:browser-runtime` green.
15. Live owner package surface on Hub ≥ `891cc79`:
    - subscribe source + exclude;
    - select value;
    - remove/exclude while open → invalid UI + no successful stale value submit;
    - select valid replacement → exact value submit with structured request evidence.
16. Fail loud on missing pin/fixture/package — no skip.

## Vault gaps

1. Generic plugin entity frames must reach the browser store (today dropped).
2. Entity-options demand is route-claim-scoped and mirrors bind_list’s explicit subscribe model.
3. Selection invalidation is fail-closed UX + mandatory live proof.
4. Do not treat `replayActivePulls` as production reconnect for options families.

## Worktree hygiene

- `.gitignore` restored from HEAD (14 lines); re-verified this visit.
- No colon in worktree path.
- Vault checklist: **reuse** `checklist_1786480913_413123` only; **do not create** another (duplicates `checklist_1786480926_172325` / `checklist_1786480941_270055` already recorded).

## Plan Review findings disposition

| Finding | Disposition in rev 2 |
| --- | --- |
| 113608 route demand races | Spec §3 + acceptance 10–13 |
| 940806 componentized main | Base `6efb3b6`; named hooks/files |
| 529153 live invalidation | Acceptance 15 mandatory; soft residual removed |
| 802371 unpublished artifact | Kept hard gate |
| 493951 duplicate checklists | Skip; reuse canonical |
| 463399 gitignore | Re-verified restored |

## Implement readiness

| Gate | State |
| --- | --- |
| Product plan | Ready for re-review |
| npm `0.3.2` | **Blocked** until publish |
| Hub source | Ready |
| Base code | `6efb3b6` |

---

Topics: [[botster-web-playbook]] · [[spa-patterns]] · [[planner-playbook]] · [[botster-planner-playbook]] · [[botster browser pull requests must retry after webrtc reconnect]]
