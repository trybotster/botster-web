# Implement report: show Hub-authored ended sessions and complete caller-owned alt-exited keep-alive

Ticket: `ticket_1788477497_716720`
Run: `run_1788477522_704573`
Step: `botster_stack_implement` / `run_step_1788478741_401685`
Plan: `docs/plans/show-hub-authored-ended-sessions-and-complete-caller-owned-alt-exited-keep-alive.md` revision 1, plus the two accepted harness deviations below
Parent integration ticket: `ticket_1787600679_990088`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1788477497_716720` |
| Web base | `062e314` |
| Live result commit | `c19229b` |
| Hub at live proof | parent integration worktree at `d7bd2c7` (includes `4d558e9`) |
| Core lock | `72d1c75` |
| Teardown class | no |
| Merge policy | direct into `main`; no pull request |

Independent `project_pipelines_current_context` maps `target_id` to `trybotster/botster-web`. The approved plan used the same routing. This run edited only the pipeline-provided ticket worktree.

## Repository playbook and other playbooks/notes applied

Role and charter:

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[pipeline artifacts should use path neutral worktree references]]
- [[identity]]
- [[goals]]

Not loaded: [[project-pipelines-playbook]]. This ticket does not touch Project Pipelines package or plugin paths. Not loaded: [[botster runtime teardown lenses]]. The plan states teardown class does not apply.

Targeted notes:

- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[web shared session keep alive leaves the producer on the alternate screen]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[botster web uses vanilla ionic primitives by default]]
- [[live lane evidence must postdate the last relevant source commit]]
- [[live lane arms need recorded host load and orphan cleanup]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[cross-client acceptance uses one live session identity]]
- [[an ablation that skips teardown can satisfy the oracle from a later owner]]
- [[in-flight cancel needs one Web Detach owner]]
- [[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]]
- [[spa-patterns]]

Vault checklist: `checklist_1788479195_331157`.

## Files changed

Feature:

- `src/app/dashboardSessions.ts` — add `endedDashboardSessions`; keep `currentDashboardSessions` unchanged; neither helper reads `lifecycle` or `registry_state`
- `src/App.tsx` — compute current and ended projections from one session entity list; pass ended rows to Home; pass the unfiltered list to Hub settings / Diagnostics
- `src/app/dashboard.tsx` — Ended sessions section (`data-testid="dashboard-ended-sessions"`), Ionic list and badge, `SessionListItem` `showActions={false}` on ended rows
- `scripts/live-packaged-protocol-helpers.mjs` — `HOST_CHROME` ended constants, dashboard-view contract entry, `classifyAltExitRendererWrites`
- `scripts/live-packaged-protocol-harness.mjs` — durable ended-section waits; alt-exit classified poll; open Diagnostics before the durable cap check
- `src/App.test.mjs` — unit, render, anti-drift, host-chrome, helper classification, harness source guards
- `README.md` — ended-row Home presentation; caller-owned producer command contract

Handoff:

- `docs/plans/show-hub-authored-ended-sessions-and-complete-caller-owned-alt-exited-keep-alive.md` — accepted Diagnostics wiring and Diagnostics navigation
- `docs/reports/show-hub-authored-ended-sessions-and-complete-caller-owned-alt-exited-keep-alive-implement.md` — this report

`docs/architecture.md` is unchanged. It does not describe Home session rendering.

## Ownership boundaries preserved

This run stayed in `botster-web`. It did not edit Hub, Core, TUI, or `botster-hub-client`.

Web owns `lifecycle_class` presentation, Home layout, the packaged harness, `productionSessionScriptSource`, and the producer command contract documentation.

Hub still authors `lifecycle_class` and session persistence. TUI still owns `ghostty-shared` and `NORTH_STAR_HISTORY`. Ended Home rows stay non-attachable through the existing `isAttachableSession` rule. Web does not infer lifecycle from `lifecycle` or `registry_state`.

## Cross-repo dependencies or separately routed work

None opened. The human declined a new Hub ticket and a reverse dependency. The integration ticket `ticket_1787600679_990088` already depends on this ticket. It owns the north-star `PRODUCER_SCRIPT` repair and the complete north-star rerun after merge.

Hub pin stays `@trybotster/hub-test-support` `0.1.43`, `@trybotster/ui-contract` `0.3.3`, `@trybotster/terminal-protocol` `0.3.0`. No DTO change.

## Deviations from plan

1. `proveExternalSessionLifecycle` now calls `openDiagnosticsView` before the durable cap check. The function runs after terminal attach, so Diagnostics is not already visible. The cap check itself is unchanged. The plan file records this.

2. `HubSettingsRouteView` receives the unfiltered session entity list. Home still splits current and ended rows. Diagnostics "Loaded hub state" must include Hub-authored ended rows, or the durable overflow copy never appears after the current-only Home filter. The plan file records this.

3. No `docs/architecture.md` line. That file does not describe Home session rendering.

## Tests and downstream proof run

Repository gates at `c19229b`:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 0 errors, 5 pre-existing `react-refresh` warnings |
| `npm test` | 0 | drift check plus `src/App.test.mjs` pass |
| `npm run smoke:react-singleton` | 0 | `react-singleton-bundle-passed {"file":"index-BgMJFlyi.js","useMemoWrappers":1}` |

Red-on-revert:

- Restored the bare `waitForTerminalRendererWrite` in `proveAlternateScreenExit`. `npm test` exited 1 on `/producer contract mismatch/`. The classified wait was restored before live proof.
- First durable attempt without Diagnostics navigation timed out on `diagnostics-view` after terminal attach.
- Second durable attempt with current-only Diagnostics rows timed out on `\d+ more records loaded\.`

Live lanes at `c19229b` with Hub `d7bd2c7` and Core lock `72d1c75`. Host load before: `2.39 3.83 17.75`. After durable: `5.51 4.20 16.48`. After shared-session: `5.51 6.75 13.68`. After IsolatedHub: `7.28 6.93 13.01`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run smoke:live-packaged-protocol:durable` | 0 | `live packaged protocol harness passed (webrtc)`; post-detach siblings include `botster-web-durable-exited-1` through `-5`; production session `web-prod` |
| `npm run smoke:live-packaged-protocol:shared-session` | 0 | cancel ablation first failure at the Detach oracle (`got 0`); two `live-shared-session-keep-alive-passed`; `alternate_screen_exit` notes with `before_alt_screen: true` and `after_alt_screen: false`; `live-shared-session-exit-passed`; `live-shared-session-coordinator-passed {"keep_alive_runs":2,"cancel_ablation":true,"exit_pass":true}` |
| `npm run smoke:live-packaged-protocol` | 0 | IsolatedHub `web-prod` `live packaged protocol harness passed (webrtc)` |

Production path: `App.tsx` lists session entities, `endedDashboardSessions` feeds `DashboardView`, and the durable harness waits inside `dashboard-ended-sessions`. `proveAlternateScreenExit` classifies renderer writes before keep-alive continues.

Lane-owned Hub and shared-session directories from this run were gone after the suite. Foreign producers from other worktrees were left running.

Downstream north-star `script/prove-north-star-shared-session` remains with `ticket_1787600679_990088`.

## Unverified behavior or residual risk

- This Web ticket did not rerun Hub `script/prove-north-star-shared-session` or TUI `ghostty-shared`. Those lanes belong to the integration ticket after merge.
- A third live red that restores Home to current-only rendering after the green durable pass was not rerun. The durable harness now waits on `dashboard-ended-sessions`, and the earlier current-only Diagnostics run already failed closed.
- `indeterminate` rows stay hidden from both Home sections, as assumed.
- Ended rows hide Stop. Review can restore the menu with the `showActions` prop.

## Missing vault guidance discovered

- Gotcha candidate, deferred: a copied caller-owned producer script drifts from the owning client's producer contract. Capture after the integration ticket confirms the Hub producer repair shape.
- Convention candidate, deferred to Review: Web Home renders Hub-authored `ended` rows in a separate non-attachable section and never infers lifecycle. Capture after Review accepts the section shape.
