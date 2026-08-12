---
description: Plan (Plan Review round-2) for a family-bound live-harness control that drops one real inbound entity frame so production sequence_gap resubscribe is proven on current Web main, with mandatory Workspaces held-open proof and normal-control SPA request-state oracles
---

# Live harness must drop real entity frames to prove sequence_gap resubscribe

## Plan Review disposition

### Visit 1 (`review_1786522688_298315`) — resolved

| Finding | Severity | Fix |
|---------|----------|-----|
| `finding_1786522688_955998` Stale base | high | Base **`aa19ffb`** (≥ `2a41220`) |
| `finding_1786522688_525321` Conditional Workspaces proof | high | Mandatory `smoke:workspaces-lifecycle` + exact pins |
| `finding_1786522688_691906` Drop contract | high | Filter-bound arm/state contract |
| `finding_1786522688_966081` Force-click / SPA request-state | high | Named force paths; normal-control + SPA oracles |

### Visit 2 (`review_1786523105_798457`) — resolved

| Finding | Severity | Fix |
|---------|----------|-----|
| `finding_1786523105_998789` Missing second real membership frame | high | Two-mutation chronology: drop claim **A**, claim **B** triggers `sequence_gap` |

### Visit 3 (`review_1786523403_346173`) — this revision

| Finding | Severity | Fix in this plan |
|---------|----------|------------------|
| `finding_1786523403_317329` Second-delta session B lacks mandatory lifecycle cleanup | medium | **Mandatory cleanup for both A and B** after D1/D2/gap/stale/ablation assertions: production membership remove when possible, then Hub `shutdown_session` + `remove_session` for both seeds; `finally`-safe path on early failure; assert neither membership nor session remains before later lifecycle stages. |

## Target repository and routing

| Field | Value |
|-------|-------|
| Ticket | `ticket_1786518263_839128` — Web: live harness must drop real entity frames to prove sequence_gap resubscribe |
| Run | `run_1786522059_661378` |
| Plan step (this visit) | `run_step_1786522706_236116` / `botster_stack_plan` (sequence 3) |
| Pipeline | `botster_stack_delivery` |
| Target ID | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Target repository | `trybotster/botster-web` (spawn name `booster-web`) |
| Worktree branch | `project-pipelines/ticket_1786518263_839128` |
| **Implementation base (authoritative)** | **`aa19ffbbc07a2e2e60fe8e412185961719d7c526`** (`origin/main` at Plan revisit; fast-forwarded from prior `6efb3b6`) |
| Ticket minimum Web pin | ≥ `2a412208bc9508f24a57688ec5db94a5519d2573` — **satisfied** by base (`2a41220` is ancestor of `aa19ffb`) |
| Parent consumer | `ticket_1786474783_285888` (available-session claim campaign) |

Resolved via `list_spawn_targets` + ticket `target_id`. Ambient directory is not authority.

## Exact consumed pins (mandatory — not “choose later”)

These pins are **acceptance prerequisites**. Implement must record binary/package provenance in live evidence. Missing pins block acceptance; they are **not** silent skip paths.

| Pin | Exact requirement | Owner target | Role |
|-----|-------------------|--------------|------|
| **Web** | Implement + live proof on **`aa19ffb` or newer main containing ≥ `2a41220`** | `tgt_40abcf71ccf049f4ac0c99953a799869` | This run |
| **Hub binaries** | `BOTSTER_HUB_BIN` + `BOTSTER_SESSION_WORKER_BIN` built from Hub **≥ `de6b09982e72fd5efd04a5258f5fc645f611adbc`** (parent claim-stack pin; also ≥ fanout repair `35dd7d22` already in that ancestry for membership empty arrays) | `tgt_7e208a0c76a44980a83b63af976b1f22` | Consumed artifact only — no Hub code |
| **Workspaces package** | `BOTSTER_WORKSPACES_PACKAGE_PATH` → checkout of Workspaces **≥ `7ab4d1334214b3ea3c8b02e9ea665a27e70c0916`** (parent pin; includes Available sessions + membership publish rebased at `df14369`) | `tgt_71266a8d976d4535902ffed09c18a7ba` | Input package only — no Workspaces product edits |
| **Support packages (already on base)** | `@trybotster/hub-test-support@0.1.30`, `@trybotster/ui-contract@0.3.2` | n/a | Locked by current `package.json` on `aa19ffb` |

**Note on Workspaces main:** device checkout `main` at `3ec366a` is **behind** `7ab4d13` (Available sessions / membership branch). Live acceptance must use a package path at **`7ab4d13` or later combined revision**, not bare Workspaces main. If that package path is unavailable in the Implement environment, **register a blocking dependency** against Workspaces target `tgt_71266a8d976d4535902ffed09c18a7ba` before claiming green — do not waive ticket item 4.

Hub ≥ `de6b099` package-entity gap `mutation_action` fixtures remain **forbidden** as product interaction for this ticket; they only document why Web harness intercept is required.

## Repository playbook loaded

- [[botster-web-playbook]]

## Other role / surface playbooks and atomic notes loaded

### Role playbooks (order)

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]

### Map notes

- [[botster-architecture]]
- [[spa-patterns]]
- [[cli-patterns]]

### Targeted atomic notes

- [[botster hub client state sync is entity frame only]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[scoped entity snapshots preserve whole-family sequence gates]]
- [[botster client subscriptions should not hydrate global state]]
- [[a page reload is not a reconnect]]
- [[botster browser pull requests must retry after webrtc reconnect]]
- [[live harness route expectations must mirror production route gating]]
- [[adding harness event families changes every mixed family oracle]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[plugin-owned dynamic state uses plugin-namespaced entity frames]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[vault example paths are not repository placement conventions]]
- [[plan steps need reviewable plan artifacts]]

### Explicitly not loaded

- [[project-pipelines-playbook]] — no Project Pipelines package/plugin path edits.
- [[botster runtime teardown lenses]] — **does not apply** (see teardown table).
- Workspaces/Hub ownership charters as implementation authority — pins only.

### Teardown class (N/A)

| Field | Answer |
|-------|--------|
| `teardown_class_applies` | **false** |
| Rationale | Harness-only inbound frame drop on a **surviving** peer/document to prove ordered `sequence_gap` resubscribe. Not peer lifecycle teardown, SessionIo/ClientWorker teardown, multi-peer ownership, CPU/battery/FD spin, or terminal-state vs live-runtime divergence. |
| `teardown_isolation` | N/A |
| `teardown_bounds` | N/A |
| `late_message_matrix` | N/A for peer death. Post-drop late frames on the **same** peer generation must hit production `receiveEntityFrame` sequence gating. Non-matching families while armed pass through. |
| `production_path_proof` | Live chronology on held-open Workspaces membership family: intentional harness drop → production `webrtc_entity_frame_discarded` reason `sequence_gap` → unsubscribe + subscribe → replacement `entity_snapshot` → selection reconcile → normal-control stale claim blocked with SPA request-state evidence |
| `ownership_identity` | Drop filter binds `entity_type` (+ optional `subscription_id`); production match remains `subscription_id` + `entity_type` + peer generation |
| `sibling_fail_closed_policy` | Control fail-closed without harness global / peer / valid filter / armed state. Stale submit fail-closed via production disabled/invalid gate, not force-click |

## Context loaded

### Pipeline

- `project_pipelines_current_context` for `run_1786522059_661378` sequence-3 Plan after Plan Review `changes_required`.
- Prior plan artifact `artifact_1786522219_745204` superseded by this revision of the same URI.
- Open findings listed above; this plan is the product response.

### Repo evidence on base `aa19ffb` (re-inspected)

**Production sequence gate (unchanged policy, new line anchors):**

- `src/botster/webrtcDaemonClient.ts`
  - `closeDataChannelForLiveHarness` ~395–401 — reconnect-only harness seam.
  - Post-decrypt entity path ~637–646: after `daemon_entity_frame` assembly/decrypt, calls `this.receiveEntityFrame(...)` — **drop intercept site**.
  - `receiveEntityFrame` ~847–902: `entity_error` early return; `entity_snapshot` sets baseline; deltas with `snapshot_seq !== currentSequence + 1` → `resubscribeEntity(..., "sequence_gap")`.
  - `resubscribeEntity` ~904+: records `webrtc_entity_frame_discarded` with reason, unsubscribe, clear sequence, fresh subscribe.
  - `installLiveHarnessTransportControl` ~1063–1075: currently only `transportControl.closeDataChannel`.

**Current live harness (now includes held-open Workspaces + entity_options):**

- `scripts/live-packaged-protocol-harness.mjs`
  - Modes: `BOTSTER_LIVE_REQUIRE_WORKSPACES`, `BOTSTER_LIVE_WORKSPACES_LIFECYCLE`, `BOTSTER_LIVE_ENTITY_OPTIONS`, etc.
  - Stage **`workspaces-entity-options-membership-reactive`** (`exerciseWorkspacesEntityOptionsMembershipReactive`, ~3150+), invoked from lifecycle path (~2731): dual production clients; P1 holds Add dialog; P2 claims membership; P1 proves held-open option exclusion **without** DataChannel resubscribe today.
  - **Stale-submit paths that use force interaction (must change for this ticket):**
    1. ~1497 — `exerciseEntityOptionsReactive`: `entity-options.submit` `.click({ force: true })`.
    2. ~3346 — membership stage: `botster_workspaces.add_session` `.click({ force: true })` on green path (ablation path already uses normal click after membership restore).
  - Existing production click telemetry: `formSubmitClickSeq` / `lastFormSubmitClick` phases `dispatched` | `blocked_disabled` | `blocked_invalid` | settled `blocked_gate`.
  - Existing ablation: `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` restores valid control via harness `applyEntityFrame` membership remove so the **request oracle fails first**.
  - Reconnect still uses `transportControl.closeDataChannel` (~1463 entity-options path; main reconnect stages elsewhere) — remains **reconnect proof only**, not ordered-gap proof.

**Scripts on base:**

- `smoke:live-packaged-protocol` — default packaged proof (session family etc.).
- `smoke:workspaces-compat` — require Workspaces package.
- **`smoke:workspaces-lifecycle`** — lifecycle + **membership reactive stage** (mandatory for ticket item 4).
- `smoke:entity-options-reactive` — fixture package entity_options (secondary; also has force-click to fix).

**Docs:** `docs/architecture.md` already states sequence-gap resubscribe policy. Prior plans/reports under `docs/plans/workspaces-lifecycle-harness-entity-options-select.md` and implement report document Workspaces/Hub pins and held-open semantics.

**Hygiene:** tracked `.gitignore` restored (14 lines). Worktree path has no `:`.

## Botster layers touched

- React SPA / WebRTC client harness seams (`webrtcDaemonClient.ts`).
- Packaged live protocol harness (membership stage + entity-options stage + oracles).
- Deterministic tests (`App.test.mjs`) and README control docs.
- **Not touched as product:** Hub, Workspaces package, MCP, TUI, Project Pipelines plugin.

## Public drop-control contract (pinned)

Consumer-facing surface on `window.__BOTSTER_LIVE_PROTOCOL_HARNESS__.transportControl` (only when harness global is installed).

### Filter

```ts
type DropNextInboundEntityFrameFilter = {
  entity_type: string; // required, e.g. "botster-workspaces.membership"
  frame_types?: Array<"entity_upsert" | "entity_patch" | "entity_remove">;
  // default: all three delta types above
  // NEVER matches entity_snapshot or entity_error
  subscription_id?: string; // optional tighter bind when known
};
```

### API (exact names)

| Method | Sync result | Meaning |
|--------|-------------|---------|
| `armDropNextInboundEntityFrame(filter)` | `{ ok: true, state: "armed", filter }` **or** `{ ok: false, state: "not_armed", reason }` | Arms one-shot drop. **Does not** claim a frame was dropped. Reasons: `no_harness` \| `no_peer` \| `already_armed` \| `invalid_filter`. |
| `getDropNextInboundEntityFrameState()` | See state machine | Poll arm/drop/timeout/disarm. |
| `disarmDropNextInboundEntityFrame()` | `boolean` | Clears arm without dropping; true if was armed. |
| `closeDataChannel()` | existing | Unchanged reconnect control — **not** ordered-gap. |

**Deprecated for parent citation:** bare no-arg `dropNextInboundEntityFrame()`. Do not ship an ambiguous no-arg arm.

### State machine

```text
idle ──arm(valid)──► armed ──matching delta assembled──► dropped
                        │                                    │
                        ├──timeout (optional harness wait)──► timed_out
                        ├──disarm() / peer reset────────────► idle / disarmed
                        └──non-matching frames──────────────► stay armed (frames apply normally)
```

`getDropNextInboundEntityFrameState()` returns one of:

- `{ state: "idle" }`
- `{ state: "armed", filter, armed_at }`
- `{ state: "dropped", filter, entity_type, subscription_id, frame_type, snapshot_seq, generation, dropped_at }`
- `{ state: "timed_out", filter, armed_at, timed_out_at }` (only if implement adds optional client timer; live stages may instead fail Playwright wait while state stays `armed`)
- `{ state: "disarmed", reason: "manual" | "peer_reset" }`

### Drop placement and matching rules

1. After full multi-chunk assembly + decrypt of `deliveryKind === "daemon_entity_frame"`, **before** `receiveEntityFrame`.
2. Match only if armed and:
   - `frame.entity_type === filter.entity_type`
   - `frame.type` ∈ filter.frame_types (default deltas only)
   - if `filter.subscription_id` set, must equal `frame.subscription_id`
3. On match: consume arm → state `dropped` → record harness event → **return without** calling `receiveEntityFrame` / store apply / channel close / reload.
4. On non-match: call production `receiveEntityFrame` unchanged; remain armed.
5. Gate all control methods with `liveHarnessInstalled()` (same as `closeDataChannelForLiveHarness`).

### Harness event (distinct family)

Kind: **`webrtc_entity_frame_harness_drop`** (intentional drop — not production discard).

Payload (minimum):

```json
{
  "reason": "harness_armed_drop",
  "entity_type": "botster-workspaces.membership",
  "subscription_id": "…",
  "frame_type": "entity_upsert",
  "snapshot_seq": 12,
  "generation": 1,
  "filter": { "entity_type": "botster-workspaces.membership" }
}
```

Production gap event remains **`webrtc_entity_frame_discarded`** with `reason: "sequence_gap"` (existing). Readers must filter by kind/reason separately ([[adding harness event families changes every mixed family oracle]]).

### Correlation required in live oracles

**Two real membership deltas are mandatory.** Dropping one frame does not by itself call `receiveEntityFrame` with a gap: production `sequence_gap` runs only when a **later** real delta for the same subscription arrives with non-contiguous `snapshot_seq`. A single P2 claim that is dropped leaves the client parked on the pre-drop baseline until another real frame arrives. On current main, P2 `remove_session` for the claimed session runs **after** the stale-submit block, so it cannot supply that next frame in the planned order.

Chronology on **same document** (sentinel survives), family `botster-workspaces.membership`:

| Step | Actor | What must happen | Evidence |
|------|-------|------------------|----------|
| 0 | Harness | Seed **two** distinct Hub sessions **A** (stale selection under test) and **B** (second-delta carrier). Both lifecycle `current`, neither claimed yet. | `spawn` + `hub_frame` session current for A and B |
| 1 | P1 | Open Add dialog; hold it; select **A** via entity_options. Demand holds membership subscription with baseline snapshot seq `N`. | form open; option A selected; membership `subscribe_entities` ready with `snapshot_seq = N` |
| 2 | Harness | `armDropNextInboundEntityFrame({ entity_type: "botster-workspaces.membership" })` | state `armed` |
| 3 | P2 | **Mutation 1 — claim A** via normal production Add UI (`botster_workspaces.add_session`). Hub publishes membership delta **D1** with `snapshot_seq = N+1` (or next Hub seq). | P2 accepted claim for A |
| 4 | P1 client | Control **drops D1** before `receiveEntityFrame`. Client sequence remains **N**. | `webrtc_entity_frame_harness_drop` with `entity_type`, `subscription_id`, `frame_type`, **`snapshot_seq` of D1**, `generation`; state `dropped`. **No** production apply of A membership yet. |
| 5 | P2 | **Mutation 2 — claim B** via normal production Add UI on a **separate** seeded session B (not A). Hub publishes membership delta **D2** with `snapshot_seq > N+1` (typically `N+2`). Do **not** use store injection, direct action payload construction, `closeDataChannel`, page reload, or Hub test-only `mutation_action`. | P2 accepted claim for B; real wire frame for membership |
| 6 | P1 client | D2 reaches `receiveEntityFrame` with non-contiguous seq → production **`sequence_gap`**. | `webrtc_entity_frame_discarded` reason `sequence_gap` correlating same `entity_type` / subscription generation; D2’s delivered `snapshot_seq` correlated to dropped D1 seq (gap, not `current+1`) |
| 7 | P1 client | Resubscribe + authoritative replacement snapshot for membership. | `unsubscribe_entities` + `subscribe_entities`; replacement `entity_snapshot` baseline; membership includes A (claimed) and B |
| 8 | P1 UI | Options/selection reconcile to post-gap baseline: **A is excluded**; held selection of A is invalid. Dialog still open; no forced `plugin_surface_render` rise beyond existing stage invariants. | option A gone; `data-form-invalid` / `data-selection-invalid` |
| 9 | P1 UI | Stale pre-gap selection of **A** cannot produce successful outbound claim via **normal** rendered controls (see force-click removal). | zero stale `botster_workspaces.add_session` with session A; click phase blocked_*; request_id ledger unchanged |
| 10 | **Mandatory cleanup (A and B)** | **After** steps 6–9 (and ablation path when enabled), clear residual state so later Workspaces lifecycle row/reference counts stay correct. Never use cleanup as the sole gap trigger. | See cleanup contract below |

**Correlation invariants (must log in stage evidence JSON):**

- `dropped_snapshot_seq` from harness_drop (D1 / claim A)
- `gap_trigger_snapshot_seq` from the frame that caused sequence_gap discard (D2 / claim B), with `gap_trigger_snapshot_seq !== dropped_snapshot_seq` and `gap_trigger_snapshot_seq !== client_baseline_N + 1` as observed by production
- `stale_session_id = A`, `second_delta_session_id = B`, `B !== A`
- peer `generation` before gap and subscription ids across resubscribe
- `cleanup_a` / `cleanup_b` results (membership removed, hub shutdown, hub remove)

### Mandatory cleanup contract (sessions A and B)

Current main only cleans the single reactive seed (remove membership via P2 production UI → dismiss P1 dialog → Hub `shutdown_session` + `remove_session` for that id). With session **B** added for D2, **both** seeds must be cleaned; leaving B claimed/running can poison later lifecycle oracles.

**Order (after all D1/D2, resubscribe, selection, stale-submit, and ablation assertions complete):**

1. Dismiss P1 held Add dialog if still open (Escape / detach), without claiming.
2. For each of **{A, B}** still in workspace membership: remove via **production** `botster_workspaces.remove_session` on a live production client (prefer P2) when the row is visible; if membership was never applied client-side but Hub/server membership exists, still remove via production UI once the post-gap snapshot shows the row, or via the same production remove path the stage already uses for A.
3. For each of **{A, B}**: Hub daemon `shutdown_session` then `remove_session` (same pattern as current reactive seed close-out) so Available sessions / lifecycle counts are not inflated.
4. Close secondary page (existing `finally` closes `page2`).
5. **Assert** before returning to later lifecycle stages:
   - no membership entity for A or B on the workspace;
   - no live Hub session entity for A or B (removed);
   - stage evidence includes `membership_left_cleared: true`, `sessions_removed: [A, B]`.

**`finally`-safe path:** wrap the ordered-gap body so that on early failure (arm fail, claim fail, gap timeout, etc.) cleanup still attempts membership remove + hub shutdown/remove for every session id that was successfully spawned (A and/or B), and always closes `page2`. Cleanup failures after a primary assertion failure should be logged and attached; they must not silently leave B running when the stage otherwise “passed.”

Cleanup **must not**:
- substitute for mutation 2 / sequence_gap proof;
- use store injection except the existing ablation-only path for stale-submit red-first;
- skip B because “optional.”

## Scope

1. **Implement family-bound arm/drop/state control** per contract above on `WebrtcDaemonClient` + `installLiveHarnessTransportControl`.
2. **Deterministic unit tests** on base `aa19ffb`:
   - no control without harness global;
   - arm returns arm result only;
   - non-matching family/type passes through and keeps armed;
   - matching delta drops once; second matching frame is not auto-dropped;
   - **two-frame chronology in unit form:** drop seq `N+1`, deliver seq `N+2` → production `sequence_gap` (not after a single dropped frame alone);
   - `entity_error` / `entity_snapshot` never match default filter;
   - `closeDataChannel` remains separate;
   - source-guard harness for `armDropNextInboundEntityFrame` + sequence_gap oracle (not channel-close as gap stage).
3. **Mandatory live Workspaces ordered-gap stage** (extend `exerciseWorkspacesEntityOptionsMembershipReactive` / lifecycle path):
   - Pins: Web base, Hub ≥ `de6b099`, Workspaces package ≥ `7ab4d13`.
   - Command: **`npm run smoke:workspaces-lifecycle`** with those env pins. **No skip** for ticket item 4.
   - Implement the **two-mutation chronology table above** end-to-end on held-open P1 Add dialog.
   - Seed A and B before arming; P2 claims A (dropped) then claims B (gap trigger); stale checks only after replacement snapshot excludes A.
   - Forbid using post-stale-check `remove_session` of A as the only gap trigger.
   - **Mandatory cleanup of A and B** per cleanup contract (production membership remove when possible + Hub shutdown/remove; finally-safe; assert clear before later lifecycle stages).
4. **Replace force-click stale-submit paths** (named current code):
   - `exerciseEntityOptionsReactive` ~1497 `entity-options.submit` `click({ force: true })`.
   - membership stage ~3346 `botster_workspaces.add_session` `click({ force: true })` on non-ablation path.
   - **Required green-path proof instead:**
     - selection invalid (`data-form-invalid` / `data-selection-invalid`);
     - submit control disabled or production-blocked;
     - **normal** Playwright click (no `force: true`) settles via production click telemetry (`lastFormSubmitClick` phase `blocked_disabled` \| `blocked_invalid`) **or** settled native disabled+invalid `blocked_gate` after a non-forced click attempt that does not bypass disabled;
     - **zero** outbound stale `plugin_surface_action` for `botster_workspaces.add_session` (or fixture `entity-options.submit`) carrying the dead session/option value;
     - correlated SPA request state unchanged: no new stale `request_id`, no misattributed pending/result for that action.
   - **Ablation remains mandatory:** `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` restores valid control via membership entity remove; normal click must emit the stale add_session and make the zero-request oracle fail first ([[a regression test must be shown to go red with the fix reverted]]).
5. **README** documents exact control names (`armDropNextInboundEntityFrame`, `getDropNextInboundEntityFrameState`), filter fields, reconnect vs ordered-gap distinction, **two-mutation live chronology**, parent usage for `ticket_1786474783_285888`, and required live command + pins.
6. Optional secondary: `smoke:entity-options-reactive` can use arm+drop on fixture family instead of `closeDataChannel` for gap-style invalidate — **not** a substitute for Workspaces mandatory proof.

## Non-scope

- Workspaces package product changes (picker, membership Lua, action ids).
- Hub fanout ABI / test-only `mutation_action` frame-skip.
- Using `closeDataChannel` as ordered-gap proof.
- Client-store injection as gap trigger (ablation-only exception for **stale-submit** restore, already present).
- Page reload as gap/reconnect substitute.
- Broad transport refactors, new harness frameworks, optional configurability beyond the filter/state contract.
- Changing production sequence-gap policy.

## Repository ownership boundaries and cross-repo dependencies

| Surface | Owner | This run |
|---------|-------|----------|
| Drop control + WebRTC client sequence gate + harness oracles | **botster-web** | **In scope** |
| Membership entity publish / Available sessions UI | botster-workspaces | **Pin ≥ `7ab4d13` only** |
| Entity fanout / empty membership arrays | botster-hub | **Pin ≥ `de6b099` only** |
| Project Pipelines / core / TUI | other targets | Out of scope |

**Register if missing at Implement:**

- Dependency on Workspaces target `tgt_71266a8d976d4535902ffed09c18a7ba` when package path at ≥ `7ab4d13` cannot be supplied.
- Dependency on Hub target `tgt_7e208a0c76a44980a83b63af976b1f22` when binaries < `de6b099` (or fanout-incapable).

Do not broaden this run into Hub/Workspaces product code. Not a Hub session-type eligibility consumer (no list_session_types_for_target pin injection).

## Assumptions and unknowns

### Assumptions

- Production `sequence_gap` branch on `aa19ffb` is correct; defect is missing deterministic live trigger + incomplete force-free SPA proof.
- Post-decrypt intercept of a filter-matched real frame satisfies “real Hub-produced entity frame on the WebRTC data channel path.”
- Workspaces lifecycle membership stage is the correct held-open **entity_options** product surface for ticket item 4 (Available sessions Add form).
- Parent pins Hub `de6b099` / Workspaces `7ab4d13` / Web ≥ `2a41220` are the claim-stack contracts this ticket must satisfy.
- **A dropped claim for A does not update client membership; only the post-gap replacement snapshot (driven by a later real delta such as claim B) reconciles P1 to authoritative “A claimed” state.** Waiting after a single dropped frame is not a valid sequence_gap proof.
- Second mutation is a **distinct** production membership claim for session **B**, not re-claim of A, not store injection, not channel close.

### Unknowns (resolve in Implement with evidence — not silent waivers)

1. Exact membership delta `frame_type` produced on P2 claim under Hub ≥ `de6b099` (`entity_upsert` vs `entity_patch`) — filter default includes all deltas.
2. Whether membership sequence_gap resubscribe keeps the Add dialog open without extra `plugin_surface_render` (existing stage forbids render rise during claim exclusion; preserve after gap path).
3. Whether non-forced click on a truly disabled Ionic button always yields settled `blocked_gate` without `force` — if Playwright cannot deliver a click to disabled controls, settle oracle must use production telemetry after a **non-forced** attempt and still prove zero outbound request (document the exact settled path used).
4. Whether P2 can claim B while still holding UI state after claiming A without dismissing dialogs — Implement may open a fresh Add dialog on P2 for B; still production UI only.

## Affected surfaces / files

| Path | Change |
|------|--------|
| `src/botster/webrtcDaemonClient.ts` | Filter-bound arm/drop/state; intercept before `receiveEntityFrame`; transportControl surface; harness_drop event |
| `scripts/live-packaged-protocol-harness.mjs` | Membership ordered-gap stage using arm+drop; remove force-click stale paths; SPA request-state oracles; keep reconnect stage separate |
| `src/App.test.mjs` | Contract unit tests + source guards |
| `README.md` | Control contract, pins, parent citation, commands |
| `docs/architecture.md` | Only if one-line harness control pointer needed |
| `docs/plans/live-harness-drop-entity-frame-sequence-gap.md` | This plan |

Likely touch points already on base (minimal, only as required by harness oracles): form-submit click telemetry hooks if needed to prove non-forced blocked path without new product policy.

## Implementation sequence

1. Confirm worktree at ≥ `aa19ffb`; restore `.gitignore` if wiped.
2. Implement arm/drop/state + intercept + events in `webrtcDaemonClient.ts`.
3. Deterministic tests for filter matching, arm vs drop results, sequence_gap chronology, no-harness fail-closed.
4. Extend membership reactive stage: arm membership filter → P2 claim → harness_drop → sequence_gap → snapshot → selection reconcile.
5. Replace both `force: true` stale-submit clicks; wire SPA request-state + ablation red-first proof.
6. README pins + control docs for parent ticket.
7. Run gates: `npm test`, `typecheck`, `build`, **`smoke:workspaces-lifecycle`** with exact pins (mandatory), plus default `smoke:live-packaged-protocol` if still green for non-Workspaces regressions.

## Risks

| Risk | Mitigation |
|------|------------|
| Wrong-family drop on shared channel | Required `entity_type` filter; non-match pass-through |
| Arm/drop result confusion | Arm returns arm only; drop only via state/events |
| Force-click false green | Delete force on stale paths; require request count 0 + click phase |
| **Single dropped claim never reaches sequence_gap** | **Mandatory mutation 2 (claim B) before gap oracles**; unit two-frame chronology; forbid using later remove_session-of-A as sole trigger |
| Residual B poisons later lifecycle counts | **Mandatory A+B cleanup** after assertions; finally-safe; assert neither membership nor session remains |
| Using reconnect as gap | Separate oracles; forbid closeDataChannel in gap chronology |
| Mixed event family breakage | Distinct `webrtc_entity_frame_harness_drop` kind; filter-kind readers |
| Workspaces pin unavailable | Blocking dependency on Workspaces target — no skip |
| Stale base reintroduced | Implement starts from `aa19ffb+`; refuse pre-`2a41220` |

## Production / runtime path proof

**Production path already shipped:**

`handleMessage` → decrypt `daemon_entity_frame` → `receiveEntityFrame` → gap → `resubscribeEntity("sequence_gap")` → unsubscribe/subscribe → snapshot → store/listeners → entity_options projection.

**This ticket adds:** harness arm/filter/drop of **one** real membership delta (claim A), then a **second** real membership delta (claim B) so production sees non-contiguous `snapshot_seq` and takes `sequence_gap`, plus force-free stale claim SPA proof for A after replacement snapshot.

**Not enough:** “function exists” or “one frame was dropped.” Live evidence must show **D1 drop + D2 gap trigger** correlated chronology + zero stale outbound request under normal controls.

## Acceptance checks / tests

### Deterministic (base `aa19ffb+`)

1. `npm test` — contract tests listed in Scope §2.
2. `npm run typecheck`
3. `npm run build`

### Live — mandatory Workspaces ordered-gap + stale SPA proof

4. **`npm run smoke:workspaces-lifecycle`** with:

```bash
BOTSTER_HUB_BIN=<hub built from ≥ de6b099> \
BOTSTER_SESSION_WORKER_BIN=<worker from same hub pin> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<workspaces checkout ≥ 7ab4d13> \
npm run smoke:workspaces-lifecycle
```

Must exit 0 and emit positive stage evidence for:

- `workspaces-entity-options-membership-reactive` **with two-mutation ordered-gap chronology**:
  - seed A + B;
  - arm → P2 claim A → `webrtc_entity_frame_harness_drop` (D1 seq) → state `dropped`;
  - P2 claim B → `webrtc_entity_frame_discarded` reason `sequence_gap` (D2 seq correlated to D1) → unsubscribe/subscribe → replacement membership snapshot;
- selection reconcile after gap excludes **A** (stale selection under test);
- stale add_session for **A** blocked under **normal** controls;
- **zero** outbound stale `botster_workspaces.add_session` with session A;
- click completion phase recorded;
- evidence fields `stale_session_id`, `second_delta_session_id`, `dropped_snapshot_seq`, `gap_trigger_snapshot_seq`;
- **mandatory cleanup** evidence: both A and B memberships cleared; both Hub sessions shutdown+removed; `membership_left_cleared: true`, `sessions_removed: [A, B]`; later lifecycle stages see no residual B;
- document/page sentinel survives (no reload for gap path).

5. Ablation: same command with `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` must fail first at the stale-request oracle (not a later unrelated assertion).

6. Provenance log: Web commit, hub/worker paths+versions, Workspaces package path+`git rev-parse HEAD`.

### Live — secondary (not a substitute for §4)

7. `npm run smoke:live-packaged-protocol` remains green for reconnect (`closeDataChannel`) and non-Workspaces paths.
8. Optional: `smoke:entity-options-reactive` force-free stale submit (and optional arm+drop on fixture family).

### Docs / parent

9. README names `armDropNextInboundEntityFrame` + `getDropNextInboundEntityFrameState` as the sole ordered-gap trigger for parent `ticket_1786474783_285888`.
10. Explicit distinction: `closeDataChannel` = reconnect; arm+drop = ordered gap.

## Vault gaps worth capturing

1. **Reconnect control vs ordered-gap control** — `closeDataChannel` ≠ sequence_gap; capture after implement if not covered by [[a page reload is not a reconnect]].
2. **Intentional harness drop event family** — extend [[adding harness event families changes every mixed family oracle]] if mixed readers break.
3. **Force-click is not a production fail-closed proof** — optional capture after removing force paths.

No Plan-time vault capture required beyond this artifact.

## Convention conflicts

**None.** Entity-frame-only state; harness-only seams; no Hub ABI invention; no Workspaces product edits; mandatory live pins; plan in repo `docs/plans/`.

## Product decision ledger

| Item | Decision |
|------|----------|
| Implementation base | `aa19ffb` (current origin/main) |
| Control names | `armDropNextInboundEntityFrame` + `getDropNextInboundEntityFrameState` (+ `disarm…`) |
| Primary live family | `botster-workspaces.membership` |
| Gap-trigger design | Drop claim **A**; second production claim **B** triggers sequence_gap |
| Cleanup | **Mandatory** for A and B after assertions; finally-safe |
| Mandatory live command | `smoke:workspaces-lifecycle` with pins |
| Force-click on stale submit | Forbidden on green path; remove existing two sites |
| Hub/Workspaces product code | Out of scope; pin or register dependency |
| Teardown class | false |

## Implement deviations (accepted)

| Item | Decision |
|------|----------|
| Dual-client package-entity floor | Opening P2's Add dialog advances membership provider sequence without updating P1's `package_last_applied_seq`. The first claim after dual-client dialog open is often delivered as `package_entity_resync` (entity_snapshot), not an ordered delta. |
| Live chronology | **Warmup claim A** (may resync; establishes applied floor + excludes A as stale selection) → **arm → claim B harness-drop** → **claim C sequence_gap**. Stale selection under test remains **A**. Seeds A+B+C; mandatory cleanup for all three. |
| Lifecycle smoke exit | `BOTSTER_LIVE_WORKSPACES_LIFECYCLE=1` exits after lifecycle proof (mirrors entity-options reactive), and does not continue into session/terminal GHOSTSNP stages. |
| Arm timeout | Bounded default arm timeout **30s** produces documented `timed_out` (cleared on drop/disarm/peer_reset). Optional `{ timeout_ms }` for tests. |
| SPA request-state | Live stale-submit compares production `getActionRequestState()` pending + recent results before/after normal click, plus zero outbound daemon request. |
| Cleanup proof | Fail on production membership remove errors; `listEntities("botster-workspaces.membership")` proves A/B/C absent; hub remove + session presence prove sessions absent. |

## Pipeline gates and artifacts

- Plan URI: `docs/plans/live-harness-drop-entity-frame-sequence-gap.md`
- Supersedes prior Plan content for artifact URI on this run
- Implement gate must include: base SHA ≥ `aa19ffb`, control contract, deterministic evidence, **mandatory lifecycle smoke provenance**, force-free SPA request-state evidence, ablation red-first note

## Required gate field map

| Gate field | Section |
|------------|---------|
| `target_repository` / `target_id` | Target repository and routing |
| `repository_playbook` | Repository playbook loaded |
| `playbooks_notes_loaded` | Other role / surface playbooks… |
| `context_loaded` | Context loaded |
| `scope` | Scope + Non-scope |
| `ownership_boundaries_dependencies` | Ownership + Exact consumed pins |
| `assumptions_unknowns` | Assumptions and unknowns |
| `affected_surfaces_files` | Affected surfaces / files |
| `risks` | Risks |
| `acceptance_checks_tests` | Acceptance checks / tests (+ teardown N/A) |
| `vault_gaps` | Vault gaps |
