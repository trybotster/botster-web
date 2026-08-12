# Implement report: Workspaces lifecycle harness entity_options select

## Target

| Field | Value |
| --- | --- |
| Ticket | `ticket_1786494437_647488` |
| Run | `run_1786498795_817883` |
| Target repository | `botster-web` |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| PR | https://github.com/trybotster/botster-web/pull/89 (`pr_1786507187_760694`) |
| Web feature commit | `676e7aaf0526617bc02c38e58a659fbfc3292463` |

## Playbooks and notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[spa-patterns]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[narrow ablation at the enforcement point is the cleanest regression negative control]]
- [[an ablation that reddens at the first assertion does not vouch for later ones]]

## Final behavior

1. **`addWorkspacesLifecycleReference`** drives Available sessions via entity_options `ion-select` and exact Hub `session_uuid`. Advanced historical UUID is used only when the caller passes `historical: true` (`scenario.neverExisting` cohort only).
2. **Stage `workspaces-entity-options-membership-reactive`** uses dual production browser pages:
   - P1 opens Add, selects `S`, holds the dialog.
   - P2 claims `S` via production Add; P1 observes option exclusion + invalid UI + stale-submit block from the **held membership subscription** (no DataChannel resubscribe, no dialog reopen, no extra P1 `plugin_surface_render`).
   - P2 production `botster_workspaces.remove_session`; P1 option restoration on the held dialog.
3. **Request correlation**: `waitForWorkspacesPluginSurfaceRequest` returns `requestId`; action_result oracles require that exact id for Add open/submit, P2 claim, and P2 remove.
4. **Stale-submit oracle**: force-click while invalid, then settle on production click completion (read-only `lastFormSubmitClick` telemetry when onClick runs, otherwise native disabled + `data-form-invalid` after the Playwright click — not a wall-clock deadline). Rejects dead UUID in every supported Add value field. Ablation: `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` restores stale control state by removing the local membership entity through the production entity store (`applyEntityFrame`); the form re-validates via normal projection and the real action collector emits the stale `add_session` that fails this oracle first. No form-validation bypass flag ships in the renderer.

## Ownership boundaries

- **botster-web** owns harness interaction and consumer assertions only.
- **botster-workspaces** producer ticket `ticket_1786507221_760227` @ `c0699007f0cb946d1cbe12f4bc3b718bfcfa4f18` provides membership `entity_publish` after committed claim/remove.
- Available sessions entity_options form is rebased onto that publish base at combined Workspaces revision `df14369c855a4e7dfee707d72df4b131d8d69510` (`origin/project-pipelines/ticket_1786474780_590414`).
- Hub pin ≥ `35dd7d22` for empty membership arrays + fanout admission.

## Cross-repo dependencies

| Dependency | Ticket | Status |
| --- | --- | --- |
| Hub fanout + empty arrays | `ticket_1786494180_266672` | closed (`dependency_1786499770_901871`) |
| Membership entity_publish | `ticket_1786507221_760227` | closed (`dependency_1786507231_459363`) |

## Files changed

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-harness.mjs` | Select/advanced Add path; dual-client held-open reactive stage; request_id correlation; production click-completion stale-submit oracle + membership restore ablation |
| `src/botster/IonicUiNodeRenderer.tsx` | Read-only form submit telemetry for live harness; native disabled + click-time fail-closed unchanged |
| `src/app/useProductionHubConnection.ts` | Harness-only `applyEntityFrame` mirrors production entity store apply + frame version bump |
| `src/App.test.mjs` | Interactive proof that invalid entity-select forms cannot dispatch even with a hostile harness global |
| `docs/plans/workspaces-lifecycle-harness-entity-options-select.md` | Plan + human A routing |
| `docs/reports/implement-workspaces-lifecycle-harness-entity-options-select.md` | This report |

## Deviations from plan

None for held-open: forced resubscribe was rejected (human A) and removed.

### Resolvable Workspaces pins

| Role | Revision |
| --- | --- |
| Membership publish (merged producer) | `c0699007f0cb946d1cbe12f4bc3b718bfcfa4f18` |
| Available sessions form (pre-rebase) | `47b0aeb5dd2014da192378be515cbbfe4adf6bd8` |
| **Consumer smoke package (authoritative)** | `df14369c855a4e7dfee707d72df4b131d8d69510` — Available sessions rebased onto membership publish main (resolvable on `origin/project-pipelines/ticket_1786474780_590414`) |

## Tests and downstream proof

```bash
BOTSTER_HUB_BIN=<hub debug botster-hub, rebuild after 35dd7d22> \
BOTSTER_SESSION_WORKER_BIN=<hub debug botster-session-worker> \
BOTSTER_WORKSPACES_PACKAGE_PATH=<checkout of df14369c855a4e7dfee707d72df4b131d8d69510> \
npm run smoke:workspaces-lifecycle
# exit 0
# workspaces-entity-options-membership-reactive passed (no resubscribe)
# Workspaces lifecycle acceptance passed
# live packaged protocol harness passed (webrtc)

npm run lint
# exit 0 (0 errors)

# Ablation (must fail at stale-submit oracle first):
BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1 \
BOTSTER_HUB_BIN=… BOTSTER_SESSION_WORKER_BIN=… \
BOTSTER_WORKSPACES_PACKAGE_PATH=<df14369 checkout> \
npm run smoke:workspaces-lifecycle
# nonzero exit 1; first error is held-open P1 dispatched stale add_session
# request_id is real production ui-action-* (not synthetic ablation-stale-submit)
```

## Residual risk

- Workspaces **main** alone (`c069900`) still lacks Available sessions entity_options until `df14369` (or successor) merges. Consumer proof must use `df14369` (or later combined revision), not bare main.
- Pure `c069900` without the picker form cannot exercise entity_options select demand.

## Missing vault guidance

- Consumer lifecycle smoke needs a Workspaces revision that includes both entity_options Available sessions and membership `entity_publish` (currently `df14369`).
- Harness must select entity_options by option value, never fill hidden IonSelect aux inputs.
- Held-open membership exclude needs package `entity_publish` after commit, not transport resubscribe.
