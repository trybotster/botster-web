# Implement report: Workspaces lifecycle harness entity_options select

## Target

| Field | Value |
| --- | --- |
| Ticket | `ticket_1786494437_647488` |
| Run | `run_1786498795_817883` |
| Target repository | `botster-web` |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| PR | https://github.com/trybotster/botster-web/pull/89 (`pr_1786507187_760694`) |
| Branch commit | current `project-pipelines/ticket_1786494437_647488` HEAD |

## Playbooks and notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[spa-patterns]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[required smoke modes must disable skips and prove execution positively]]

## Final behavior

1. **`addWorkspacesLifecycleReference`** drives Available sessions via entity_options `ion-select` and exact Hub `session_uuid`. Advanced historical UUID is used only when the caller passes `historical: true` (`scenario.neverExisting` cohort only).
2. **Stage `workspaces-entity-options-membership-reactive`** uses dual production browser pages:
   - P1 opens Add, selects `S`, holds the dialog.
   - P2 claims `S` via production Add; P1 observes option exclusion + invalid UI + stale-submit block from the **held membership subscription** (no DataChannel resubscribe, no dialog reopen, no extra P1 `plugin_surface_render`).
   - P2 production `botster_workspaces.remove_session`; P1 option restoration on the held dialog.
3. **Request correlation**: `waitForWorkspacesPluginSurfaceRequest` returns `requestId`; action_result oracles require that exact id for Add open/submit, P2 claim, and P2 remove.
4. **Stale-submit oracle**: 2s settle loop after force-click; rejects dead UUID in every supported Add value field. Ablation: `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` injects a synthetic stale dispatch so the oracle fails first.

## Ownership boundaries

- **botster-web** owns harness interaction and consumer assertions only.
- **botster-workspaces** producer ticket `ticket_1786507221_760227` @ `c0699007f0cb946d1cbe12f4bc3b718bfcfa4f18` provides membership `entity_publish` after committed claim/remove.
- Available sessions entity_options form still lives on picker pin `47b0aeb5dd2014da192378be515cbbfe4adf6bd8` (not yet on Workspaces main alone).
- Hub pin ≥ `35dd7d22` for empty membership arrays + fanout admission.

## Cross-repo dependencies

| Dependency | Ticket | Status |
| --- | --- | --- |
| Hub fanout + empty arrays | `ticket_1786494180_266672` | closed (`dependency_1786499770_901871`) |
| Membership entity_publish | `ticket_1786507221_760227` | closed (`dependency_1786507231_459363`) |

## Files changed

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-harness.mjs` | Select/advanced Add path; dual-client held-open reactive stage; request_id correlation; stale-submit settle + ablation |
| `docs/plans/workspaces-lifecycle-harness-entity-options-select.md` | Plan + human A routing |
| `docs/reports/implement-workspaces-lifecycle-harness-entity-options-select.md` | This report |

## Deviations from plan

None for held-open: forced resubscribe was rejected (human A) and removed. Consumer smoke uses a **combined Workspaces package** because no single main revision yet contains both:

- publish pin `c0699007f0cb946d1cbe12f4bc3b718bfcfa4f18`
- picker pin `47b0aeb5dd2014da192378be515cbbfe4adf6bd8`
- combined smoke revision `5d5b94f672600448438af7e27c13273e36cedaa0` (c069900 base + entity_options Add form)

## Tests and downstream proof

```bash
BOTSTER_HUB_BIN=<hub debug botster-hub, rebuild after 35dd7d22> \
BOTSTER_SESSION_WORKER_BIN=<hub debug botster-session-worker> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<combined 5d5b94f: c069900 + 47b0aeb entity_options> \
npm run smoke:workspaces-lifecycle
# exit 0
# workspaces-entity-options-membership-reactive passed (no resubscribe)
# Workspaces lifecycle acceptance passed
# live packaged protocol harness passed (webrtc)

npm run lint
# exit 0

# Ablation (must fail at stale-submit oracle first):
BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1 \
BOTSTER_HUB_BIN=… BOTSTER_SESSION_WORKER_BIN=… \
BOTSTER_WORKSPACES_PACKAGE_PATH=… \
npm run smoke:workspaces-lifecycle
# nonzero; message includes held-open P1 dispatched stale add_session
```

## Residual risk

- Workspaces main alone (`c069900`) still lacks Available sessions entity_options until picker merges onto publish base. Downstream should pin a single revision with both seams.
- Pure `c069900` without the picker form cannot exercise entity_options select demand.

## Missing vault guidance

- Consumer lifecycle smoke may need dual Workspaces pins (picker + publish) until both land on one main revision.
- Harness must select entity_options by option value, never fill hidden IonSelect aux inputs.
- Held-open membership exclude needs package `entity_publish` after commit, not transport resubscribe.
