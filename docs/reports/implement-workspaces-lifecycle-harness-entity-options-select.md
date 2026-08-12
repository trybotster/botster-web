# Implement report: Workspaces lifecycle harness entity_options select

## Target

| Field | Value |
| --- | --- |
| Ticket | `ticket_1786494437_647488` |
| Run | `run_1786498795_817883` |
| Target repository | `botster-web` |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Web pin | `6048e0bede71c0f90899aac7e61cdf55575f4119` |
| Hub pin | `35dd7d222d491b4203bc5251d44ca9b5ec6c5e42` (rebuilt local debug bins) |
| Workspaces package pin | `47b0aeb5dd2014da192378be515cbbfe4adf6bd8` |

## Playbooks and notes applied

### Role / repository
- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]

### Surface / harness
- [[spa-patterns]]
- [[botster web uses vanilla ionic primitives by default]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]]
- [[browser plugin entity consumers use generic selectors]]
- [[hub qualifies effective session type ids as source name slash id]] (related IonSelect harness pattern)

### Explicitly not loaded
- [[project-pipelines-playbook]] — package/plugin paths not in scope
- [[botster runtime teardown lenses]] — not runtime-teardown class
- [[botster-workspaces-playbook]] — producer pin only

## Files changed

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-harness.mjs` | Select/advanced Add path; dual-client held-open reactive stage; resubscribe helper |
| `docs/plans/workspaces-lifecycle-harness-entity-options-select.md` | Plan + implement deviation for resubscribe proof |
| `docs/reports/implement-workspaces-lifecycle-harness-entity-options-select.md` | This report |

No `src/**` product changes.

## Ownership boundaries preserved

- **botster-web only**: live packaged harness interaction + Workspaces-path consumer assertions.
- No Hub ABI or Workspaces package Lua edits.
- Hub fanout consumed as a rebuilt binary pin; Workspaces Available sessions form consumed as package path pin.

## Cross-repo dependencies / separately routed work

| Dependency | Status |
| --- | --- |
| Hub `ticket_1786494180_266672` fanout + empty membership arrays | Closed; pin `35dd7d22` required for empty membership subscribe |
| Workspaces Available sessions `ticket_1786474780_590414` pin `47b0aeb` | Input pin; consumer proof unblocks Workspaces acceptance |
| Workspaces `botster.entity_publish` after claim/remove | **Not present on pin**; residual for pure live-delta fanout (out of Web charter) |

## Deviations from plan

1. **Held-open membership delta fanout** — Plan assumed Hub pin alone delivers live membership upserts while P1 holds the dialog. Measured: Workspaces pin persists membership via `plugin_db.batch` without `botster.entity_publish`, so no live upsert arrives on P1 after P2 claim/remove.
2. **Proof substitution** — After P2 production claim/remove, P1 closes the real WebRTC data channel and reconnects in place (same as `exerciseEntityOptionsReactive`). Claim-scoped demand resubscribes; membership `entity_provider` snapshot excludes/restores `S` with the Add dialog still mounted and no extra P1 `plugin_surface_render`.
3. **Close-out** — After restore, reselect proves form validity; membership left cleared (and reactive seed hub-removed) so bulk lifecycle row counts stay 16.

Committed plan section **Implement deviation (accepted)** records this.

## Tests and downstream proof run

```bash
# Hub bins rebuilt from 35dd7d22 (stale pre-fanout binary rejected empty membership)
BOTSTER_HUB_BIN=<hub@35dd7d22 debug botster-hub> \
BOTSTER_SESSION_WORKER_BIN=<hub debug botster-session-worker> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<workspaces@47b0aeb> \
npm run smoke:workspaces-lifecycle
```

**Result:** exit 0

Positive markers:
- `workspaces-entity-options-membership-reactive membership-demand-evidence … demanded:true framed:true`
- `workspaces-entity-options-membership-reactive passed` with claim_exclusion, stale_submit_blocked, membership_restore
- `Workspaces lifecycle acceptance passed`
- `live packaged protocol harness passed (webrtc)`

Entry point: `BOTSTER_LIVE_WORKSPACES_LIFECYCLE=1` → `exerciseWorkspacesLifecycle` → `addWorkspacesLifecycleReference` (select/advanced) + reactive stage before bulk reference seeding.

## Unverified behavior / residual risk

- Pure live-delta membership fanout without reconnect (requires Workspaces `entity_publish`).
- Dual full browser contexts not used; dual `browser.newPage()` on one browser was sufficient.
- Session-worker binary mtime older than hub rebuild; smoke still green.
- Text fill regression control (plan item 7) not ablated in this run; interaction path no longer uses fill.

## Missing vault guidance discovered

| Candidate | Why |
| --- | --- |
| Harness must select entity_options by option value, never fill hidden aux inputs | Confirmed recurring after text→select migration |
| Consumer Workspaces lifecycle smoke requires Hub empty-array pin for membership subscribe | Confirmed: stale hub binary left membership subscribe at `requested` forever |
| Held-open membership reactivity needs package `entity_publish`, not only Hub fanout admission | Hub admits/publishes frames; Workspaces pin does not call publish after claim/remove |

Capture deferred to Review/Verify unless product owner wants immediate inbox notes.
