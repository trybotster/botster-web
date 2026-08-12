# Web: Workspaces lifecycle harness must use entity_options select for Add session

## Plan revision

| Field | Value |
| --- | --- |
| Revision | `plan-review-round-2` (Hub pin filled; dependency closed; resume after human B) |
| Finding `finding_1786499707_665139` | **Resolved in plan:** Hub fanout dependency registered (`dependency_1786499770_901871`); Hub ticket closed; pin `35dd7d222d491b4203bc5251d44ca9b5ec6c5e42` |
| Finding `finding_1786499707_908929` | **Resolved in plan:** Concrete held-open Workspaces membership claim / invalidation / remove restoration sequence (preserved; not weakened) |

## Routing

| Field | Value |
| --- | --- |
| Ticket | `ticket_1786494437_647488` |
| Run | `run_1786498795_817883` |
| Target repository | `botster-web` |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target path | Botster spawn target `booster-web` → `trybotster/botster-web` |
| Repository playbook | [[botster-web-playbook]] |
| Pipeline | `botster_stack_delivery` / Plan (`botster_stack_plan`) |
| Runtime-teardown class | **Does not apply** (harness interaction + live smoke; no WebRTC/peer ownership, SessionIo teardown, or multi-peer lifecycle change) |

## Playbooks and notes loaded

### Role / repository
- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]

### Surface / harness / SPA
- [[spa-patterns]]
- [[botster web uses vanilla ionic primitives by default]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]]
- [[browser plugin entity consumers use generic selectors]]
- [[hub qualifies effective session type ids as source name slash id]] (related IonSelect harness pattern; not session-type eligibility parent)

### Process / artifact conventions
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]

### Explicitly not loaded
- [[project-pipelines-playbook]] — Project Pipelines package/plugin paths not in scope
- [[botster runtime teardown lenses]] — not runtime-teardown class
- [[botster-workspaces-playbook]] — producer package is an input pin, not this ticket’s ownership charter
- Hub session-type eligibility consumer pins — this ticket is **not** a session-type eligibility consumer

## Context loaded

### Ticket intent
Blocked consumer proof for Workspaces Available sessions picker (`ticket_1786474780_590414`).

On Web pin `6048e0bede71c0f90899aac7e61cdf55575f4119` with the Workspaces Available sessions package:

```text
npm run smoke:workspaces-lifecycle
```

fails inside `addWorkspacesLifecycleReference`:

```text
locator.fill Timeout waiting for form ... [data-ui-node-id='botster-workspaces-add-session-id'] input
```

Producer form shape (Workspaces branch `project-pipelines/ticket_1786474780_590414` @ `47b0aeb`):

- `botster-workspaces-add-session-id` is a `ui.select` with `options_source.$kind = entity_options` over Hub `/session`, value field `session_uuid`, exclude family `/botster-workspaces.membership`.
- Advanced historical text field: `botster-workspaces-add-session-id-advanced` (`session_id_advanced`).
- Submit action remains `botster_workspaces.add_session` with exact Hub `session_uuid` in form values.
- Membership removal production action: `botster_workspaces.remove_session` on the owned session row (not Hub `remove_session`).

Web already renders entity-backed selects and proves **generic** reactivity via `smoke:entity-options-reactive` on pin `6048e0`. That lane is **not** Workspaces-path proof. The lifecycle harness still treats Add session as a free-text `IonInput`.

### Why existing lifecycle stages are insufficient for ticket item 3
Current `BOTSTER_LIVE_WORKSPACES_LIFECYCLE` flow:

1. Seeds Hub sessions, adds them as workspace references via Add, then asserts row-region lifecycle oracles.
2. Transitions Hub lifecycle with daemon `shutdown_session` / `remove_session` (Hub canonical session remove), **not** workspace membership remove.
3. Successful `botster_workspaces.add_session` **closes** the Add dialog (`presentation` clear of `workspace-dialog`). It therefore cannot prove selection invalidation on a **held-open** picker while membership entities change.

Plan Review correctly rejected “assert option exclusion somehow during lifecycle” as vague. This revision specifies a dedicated Workspaces-path reactive subsequence.

### Repository state
| Item | Evidence |
| --- | --- |
| Authoritative Web pin | `6048e0bede71c0f90899aac7e61cdf55575f4119` |
| Entity-options feature commit | `2b4c91dedc1f018dc1471272283403aaffb0522b` |
| Broken harness function | `addWorkspacesLifecycleReference` still `input.fill`s `botster-workspaces-add-session-id` |
| Existing IonSelect helpers | `readUiNodeSelectOptionValues`, `setUiNodeSelectValue` |
| Workspaces package pin | `47b0aeb5dd2014da192378be515cbbfe4adf6bd8` (`tgt_71266a8d976d4535902ffed09c18a7ba`) |
| Hub fanout dependency | **Registered and closed** `dependency_1786499770_901871`: this ticket → `ticket_1786494180_266672` (`tgt_7e208a0c76a44980a83b63af976b1f22`) |
| Hub merge pin (fanout repair) | **`35dd7d222d491b4203bc5251d44ca9b5ec6c5e42`** — required `BOTSTER_HUB_BIN` / `BOTSTER_SESSION_WORKER_BIN` build source for full lifecycle smoke |
| Tracked `.gitignore` | Intact (160 bytes) at Plan-revision time |

### Prior art
- `docs/plans/` active for botster-web plans.
- Generic reactive select live proof: `exerciseEntityOptionsReactive` in the same harness (held form, mutate exclude source, invalid selection, stale submit blocked, reselect + valid submit). **Mirror the assertion style, not the fixture package, on the Workspaces production surface.**

## Scope

### In scope (surgical)
1. Rebase / implement on Web pin ≥ `6048e0`.
2. Fix `addWorkspacesLifecycleReference` (and any sibling fills of the same control):
   - **Preferred:** `[data-ui-node-id='botster-workspaces-add-session-id'] ion-select` → require exact Hub `sessionId` among rendered option values → `setUiNodeSelectValue` → submit.
   - **Fallback only when intentionally absent from current `/session` projection:** fill `botster-workspaces-add-session-id-advanced`.
   - Correlate `botster_workspaces.add_session` request **values** `{ workspace_id, session_id: <exact uuid> }` and accepted action_result independently.
3. Add a **Workspaces-path held-open reactive proof** inside the lifecycle mode (same `smoke:workspaces-lifecycle` gate; may be a named stage before/after existing reference oracles). Do **not** invent a new npm script unless the mode branch cannot host it cleanly.
4. Require **Hub pin ≥ fanout repair** from `ticket_1786494180_266672` for the full green lifecycle smoke. Keep Hub implementation out of this Web ticket.
5. Pin Workspaces package ≥ Available sessions `47b0aeb` via `BOTSTER_WORKSPACES_PACKAGE_PATH`.

### Non-scope
- Workspaces package Lua/UI (producer ticket).
- Hub fanout / empty-array ABI implementation (Hub ticket owns it; this ticket only consumes a Hub pin that contains it).
- Replacing or re-running generic `smoke:entity-options-reactive` as a substitute for Workspaces-path proof.
- Session-type eligibility parent pins, teardown class, Catalyst redesign, broad harness cleanup.

## Repository ownership boundaries and cross-repo dependencies

| Layer | Owner | This ticket |
| --- | --- | --- |
| Ionic shell, entity-options rendering, live packaged harness | **botster-web** | Yes — harness interaction + Workspaces-path reactive assertions |
| Available sessions form, membership entity, claim/remove actions | **botster-workspaces** | Input package pin only |
| Held-open package entity fanout; empty membership `items == []` encoding | **botster-hub** | **Required dependency pin** — no Hub code in this ticket |
| Session runtime / PTY | hub/core | Out of scope |

### Cross-repo dependencies (registered / required)

| Dependency | Ticket | Target | Status for this plan |
| --- | --- | --- | --- |
| Hub package entity mutation fanout + empty snapshot arrays | `ticket_1786494180_266672` | `tgt_7e208a0c76a44980a83b63af976b1f22` | **Required and closed.** Pipeline row `dependency_1786499770_901871` remains registered. Full lifecycle smoke must use Hub binaries built from merge pin **`35dd7d222d491b4203bc5251d44ca9b5ec6c5e42`** (or a later main that contains it). |
| Workspaces Available sessions form | `ticket_1786474780_590414` | `tgt_71266a8d976d4535902ffed09c18a7ba` | **Required input pin** `47b0aeb+` via `BOTSTER_WORKSPACES_PACKAGE_PATH`. This ticket is Workspaces’ consumer harness dependency (`dependency_1786494487_814897`); do not formal-block Implement on Workspaces close when proving against the package path pin. |
| Hub session-type eligibility parent | n/a | n/a | **Not applicable** |

Do not invent browser-side membership caches, poll `list_sessions`, or fake membership UUIDs to bypass the Hub dependency.

## Assumptions and unknowns

### Assumptions
- Web ≥ `6048e0`; Implement must not ship on pre-entity-options base.
- Live unclaimed Hub sessions appear as option values equal to exact `session_uuid`.
- Advanced field is historical/absent-only; normal adds use the select.
- Held-open membership updates require Hub fanout (not query-on-subscribe alone).
- A **second production browser context** (same app origin, same isolated Hub) is an acceptable “separate production client” for claiming/removing membership while the first context holds the Add dialog open. Daemon/MCP shortcuts for membership mutation are **not** substitutes for production UI claim/remove.
- Closing the Add dialog via `add_session` on the same page cannot prove held-open invalidation; that is why dual-client (or equivalent multi-page) production path is required.
- `smoke:entity-options-reactive` green does not waive lifecycle mode.

### Unknowns (Implement resolves with evidence)
- ~~Exact Hub commit SHA once fanout lands~~ → **resolved:** `35dd7d222d491b4203bc5251d44ca9b5ec6c5e42`.
- Whether dual `browser.newPage()` on one browser shares enough isolation vs two full contexts; either is fine if both exercise production UI against the same Hub.
- Sibling fill sites of the old text control on rebased tree (grep).

## Affected surfaces / files

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-harness.mjs` | `addWorkspacesLifecycleReference`; Workspaces-path held-open reactive stage; reuse select helpers; optional second page/context helpers local to lifecycle mode |
| `package.json` | Expect no new script; `smoke:workspaces-lifecycle` remains the primary gate |
| `src/**` | Expect no product change |
| `docs/plans/workspaces-lifecycle-harness-entity-options-select.md` | This plan |

## Implementation sketch

### A. Add-session control (seed path and normal claim)

```javascript
const select = form.locator("[data-ui-node-id='botster-workspaces-add-session-id'] ion-select");
await select.waitFor({ timeout: 15_000 });
const options = await readUiNodeSelectOptionValues(select);
if (!options.includes(sessionId)) {
  // intentional historical absence only → advanced field; otherwise fail with rendered options
}
await setUiNodeSelectValue(select, sessionId);
// submit + correlate request values.session_id === sessionId and accepted action_result
```

Never `fill` the aux/hidden select input.

### B. Workspaces-path held-open reactive sequence (required acceptance stage)

Named stage suggestion: `workspaces-entity-options-membership-reactive`.

**Preconditions**

- Isolated Hub/worker bins from Hub pin containing fanout repair.
- `BOTSTER_WORKSPACES_PACKAGE_PATH` → Workspaces Available sessions ≥ `47b0aeb`.
- Workspace `W` selected on production surface.
- Hub session `S` exists with lifecycle current and is **not** in any workspace membership.
- Primary page `P1` is on Workspaces app route for `W`.

**Exact production sequence**

1. **Open Add dialog on `P1`**
   Click production “Add existing session” (`botster_workspaces.open` presentation set `workspace-dialog=add:<W>`).
   Wait for form `botster-workspaces-add-form-<W>`.
   Record `plugin_surface_render` count for package `botster-workspaces` / surface `workspaces` as `renderBaseline`.

2. **Project options**
   Wait until `ion-select-option` values under `botster-workspaces-add-session-id` include exact `S`.
   Optionally assert held `subscribe_entities` (or equivalent demand) for session + membership families when those events are harness-visible (same spirit as entity-options reactive lane).

3. **Select without submit on `P1`**
   `setUiNodeSelectValue(select, S)`.
   Do **not** click Add session on `P1`. Dialog remains open.

4. **Claim membership via separate production client `P2`**
   Open second page/context against the same app origin and Hub.
   Navigate to Workspaces → select same workspace `W` → open Add → wait for option `S` → select `S` → submit `botster_workspaces.add_session`.
   On `P2`, correlate independently:
   - daemon `plugin_surface_action` request: `action_id=botster_workspaces.add_session`, `values.session_id === S`, `values.workspace_id === W`;
   - accepted `action_result` for that request_id.
   `P1` Add dialog **must remain mounted** (do not close/reopen it).

5. **Claim exclusion + selection invalidation on held-open `P1` (no surface refresh)**
   On `P1`, without page reload and without a new `plugin_surface_render` for workspaces above `renderBaseline` driven by `P1`:
   - assert option values **no longer include** `S`;
   - assert selection invalid / form invalid affordance used by production entity-options UI (same attributes the entity-options reactive proof already recognizes: e.g. `data-selection-invalid` / `data-form-invalid` or equivalent production signal);
   - force-click Add session on `P1` and assert **no** accepted submit carrying dead `session_id=S` (stale-submit prevention). Correlate by scanning harness events after the force-click.

6. **Membership removal restoration via production surface**
   On `P2` (or `P1` chrome outside the still-open modal if reachable without dismissing the held dialog’s demand path—prefer `P2`): execute production **Remove** for session `S` on workspace `W` (`botster_workspaces.remove_session` row action).
   Correlate independently:
   - request `action_id=botster_workspaces.remove_session` with workspace/session identity;
   - accepted `action_result`.
   On held-open `P1` dialog: wait until option values **again include** exact `S`, still without `P1` surface re-render / full reload.

7. **Optional close-out**
   On `P1`, select `S` again and submit a valid Add, correlating exact `values.session_id === S` (proves recovery path after restore). Or leave membership cleared if later lifecycle seeding needs `S` free—document choice in evidence.

**Hard fail conditions**

- Using advanced text field for this reactive stage when `S` is a live unclaimed Hub session.
- Using Hub daemon `remove_session` as a substitute for `botster_workspaces.remove_session` in steps 6.
- Reopening the Add dialog on `P1` between steps 3–6 and calling that “without surface refresh.”
- Accepting green solely from `smoke:entity-options-reactive` or from row-oracle lifecycle stages that only Hub-shutdown sessions.

## Risks

| Risk | Mitigation |
| --- | --- |
| Hub fanout not merged | Full smoke blocked until Hub pin recorded; dependency already registered |
| Dual-page flakiness / modal stacking | Prefer second browser context; keep `P1` dialog open; correlate by action/request ids |
| Advanced path masks select bugs | Prefer select; advanced only for intentional absence |
| Wrong mode branch green | Lifecycle mode ledger + named reactive stage marker required |
| Confusing Hub session remove with membership remove | Explicit oracles on `botster_workspaces.remove_session` |
| Over-scope into Hub/package | Web harness only |

## Acceptance checks / tests

### Pins (all required for full green)

```bash
# Web worktree ≥ 6048e0
# Hub bins built from 35dd7d222d491b4203bc5251d44ca9b5ec6c5e42 (fanout repair merge) or later containing it
# Workspaces package path ≥ 47b0aeb Available sessions

BOTSTER_HUB_BIN=<hub@35dd7d22… debug botster-hub> \
BOTSTER_SESSION_WORKER_BIN=<hub@35dd7d22… debug botster-session-worker> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<workspaces 47b0aeb+> \
npm run smoke:workspaces-lifecycle
```

Exit 0 with positive lifecycle mode markers **and** completion of stage `workspaces-entity-options-membership-reactive` (or the Implement-chosen exact stage name recorded in evidence).

### Must prove (checklist)

| # | Proof | How |
| --- | --- | --- |
| 1 | Production Add uses entity_options select (or intentional advanced) | `addWorkspacesLifecycleReference` path |
| 2 | Exact `session_uuid` submission | Request `values.session_id` oracle |
| 3 | Claim exclusion without surface refresh | Held-open `P1` loses option `S` after `P2` production claim |
| 4 | Selection invalidation + stale-submit prevention | Held-open `P1` invalid UI + no accepted dead submit |
| 5 | Membership removal restoration without surface refresh | Production `botster_workspaces.remove_session` on `P2`; `S` returns on `P1` options |
| 6 | Independent request/result correlation | Each claim/remove/submit checked by action_id + request_id, not toast text |
| 7 | Regression control | Restored text `fill` fails Add again |
| 8 | Non-waiver | `smoke:entity-options-reactive` alone insufficient |

### Supporting
- `npm run typecheck` if TS touched; harness-only JS still must not introduce broken imports.
- Existing lifecycle reference oracles remain; they do not replace rows 3–5.

### Downstream
Closing this ticket unblocks Workspaces `ticket_1786474780_590414` consumer proof. Workspaces re-runs acceptance against Web pin containing this harness fix **and** Hub pin containing fanout.

## Vault gaps worth capturing

| Candidate | Why |
| --- | --- |
| Harness must select entity_options by option value, never fill hidden aux inputs | Recurring after text→select migrations |
| Held-open membership reactivity needs dual production client when claim closes the dialog | Workspaces Add clears `workspace-dialog` on success |
| Consumer Workspaces lifecycle smoke requires Hub fanout pin, not only Web pin | Membership exclude family is package-entity fanout |

Capture only if Implement confirms a durable rule not already covered by existing harness-mode notes.

## Product decision ledger

| Decision | Choice |
| --- | --- |
| Preferred interaction | Entity_options select by exact `session_uuid` |
| Advanced field | Historical/absent only |
| Web pin | ≥ `6048e0` |
| Workspaces pin | ≥ `47b0aeb` |
| Hub pin | **`35dd7d222d491b4203bc5251d44ca9b5ec6c5e42`** (closed `ticket_1786494180_266672`) |
| Reactive proof | Held-open dual production client sequence above |
| Non-goal | Hub ABI, package UI, generic fixture-only proof as waiver |
| Ask-human threshold | Cannot drive dual production client in harness without new infrastructure; or producer field IDs diverge from pin |

## Plan completion hygiene
- Hub dependency registered: `dependency_1786499770_901871`.
- Tracked `.gitignore` intact.
- One vault checklist for this Plan visit (revision).
- Gate evidence includes `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, `target_repository`, and addresses both open Plan Review findings.

## Advancement resume (human decision B completed)

| Field | Value |
| --- | --- |
| Question | `question_1786499953_965456` |
| Decision | **B** — kept formal dependency; did not remove/restore |
| Hub ticket | `ticket_1786494180_266672` **closed**; dependency `depends_on_status=closed` |
| Hub pin | `35dd7d222d491b4203bc5251d44ca9b5ec6c5e42` |
| Held-open sequence | **Preserved** (stage `workspaces-entity-options-membership-reactive`; claim exclusion, stale-submit prevention, membership removal, option restoration) |
| Resume | Advance Plan → Plan Review immediately (orchestrator task); cancel dependency poll scheduler |

## Implement deviation (accepted)

| Field | Value |
| --- | --- |
| Deviation | Held-open membership **delta fanout** is not exercised end-to-end on Workspaces pin `47b0aeb`. That package persists membership with `plugin_db.batch` and does **not** call `botster.entity_publish`, so Hub fanout admits no live upsert after claim/remove. |
| Proof used instead | After P2 production claim/remove, P1 force-closes the real WebRTC data channel and reconnects in place (same pattern as `exerciseEntityOptionsReactive`). Claim-scoped demand resubscribes; membership `entity_provider` snapshot excludes/restores `S` while the Add dialog stays mounted and P1 `plugin_surface_render` count is unchanged. |
| Still proved | Entity_options select Add path; exact `session_id` request correlation; dual production client claim/remove; invalid selection + stale-submit block; option exclusion and restoration without reopening dialog or P1 surface re-render. |
| Residual | Pure live-delta fanout without reconnect requires a Workspaces package change to publish membership frames after claim/remove (out of botster-web charter). |
