# Plan: show Hub-authored ended sessions and complete caller-owned alt-exited keep-alive

Ticket: `ticket_1788477497_716720`
Run: `run_1788477522_704573`
Parent integration ticket: `ticket_1787600679_990088` (botster-hub, depends on this ticket)
Base: `origin/main` at `062e314` (`Record the cancel-detach ablation verification report.`), fetched 2026-09-03
Plan revision: 1

## Human decision that shapes this plan

Question `question_1788478164_365550` asked how to treat requirement 2, because its root cause is a Hub-owned producer script. The human chose option D:

- This Web run owns the ended-session presentation repair, a fast producer-contract diagnostic, and README documentation of the required `botster-web-production-alt-exit` command.
- This Web run proves `smoke:live-packaged-protocol:durable` and the Web-owned `smoke:live-packaged-protocol:shared-session` lane.
- The integration ticket `ticket_1787600679_990088` owns `script/prove-north-star-shared-session`. It adds the missing alternate-screen exit case to its `PRODUCER_SCRIPT`, or sources one canonical producer definition. It then proves the complete north-star lane with the merged Web revision.
- No new Hub ticket. No new dependency on this Web ticket. The integration ticket already depends on this ticket, so a reverse dependency would form a cycle.
- No compatibility behavior. Do not skip the alternate-screen assertions.

## 1. Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Worktree | this run worktree; branch `project-pipelines/ticket_1788477497_716720` on `062e314` |
| Repository playbook | [[botster-web-playbook]] |
| Merge policy | direct into `main` |
| Teardown class | no (section 11) |
| Session-type eligibility consumer | yes; keep the parent pins and the Option A picker path unchanged |

`list_spawn_targets` maps `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. `project_pipelines_search_tickets` found no other open ticket for the north-star producer.

## 2. Repository playbook loaded

[[botster-web-playbook]]. Web owns the Ionic shell, UiNode and entity rendering, the live packaged harness, its producer script, and browser-consumer conformance. Web renders Hub-authored `lifecycle_class` and does not infer lifecycle. Web does not own session truth, the Hub north-star coordinator, or the TUI `NORTH_STAR_HISTORY` oracle.

## 3. Other role and surface playbooks and atomic notes loaded

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[web shared session keep alive leaves the producer on the alternate screen]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[an ablation that skips teardown can satisfy the oracle from a later owner]]
- [[in-flight cancel needs one Web Detach owner]]
- [[live lane evidence must postdate the last relevant source commit]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[botster web uses vanilla ionic primitives by default]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[cross-client acceptance uses one live session identity]]

Not loaded: [[project-pipelines-playbook]] (no Project Pipelines path). Not loaded: [[botster runtime teardown lenses]] (section 11 explains why).

## 4. Context loaded (base `062e314`)

Requirement 1 (ended rows):

- `src/app/dashboardSessions.ts`: `currentDashboardSessions` keeps `lifecycle_class === "current"` only. The comment states that Web does not infer lifecycle from `registry_state`.
- `src/App.tsx` line 217: `const sessions = currentDashboardSessions(runtimeClient.entities.list("session"))`. Line 362 passes `sessions` to `DashboardView`.
- `src/app/dashboard.tsx`: `DashboardView` renders one `Sessions` section (`IonList`, `IonBadge` count, empty state). `SessionListItem` sets `button={attachable}` from `isAttachableSession` and shows `sessionDisplayStatus`, which is the raw `lifecycle_class`. `SessionActionsMenu` offers Stop on every row.
- `src/botster/terminalSession.ts`: `isAttachableSession` requires `lifecycle === "running"` and `lifecycle_class === "current"`. `sessionEntityRequiresDetach` uses `lifecycle`.
- `src/botster/generated/daemon-protocol.ts` line 984: `DaemonSessionEntity.lifecycle_class: string` is required.
- botster-hub `README.md` line 171: `starting|running|stopping` map to `current`, `exited|failed` map to `ended`, missing lifecycle maps to `indeterminate`, `registry_state: stale` maps to `indeterminate`.
- `src/App.test.mjs` line 1106: anti-drift assertion `lifecycle_class === "current"`. Lines 9836 to 9848: `currentDashboardSessions` unit expectations, including `ended-only` giving zero rows. Line 10700: `markHostChromeContract("dashboard-view")`.
- `scripts/live-packaged-protocol-harness.mjs`: durable mode seeds five sessions with `spawn` plus `shutdown_session` (`seedDurableExitedSessions`, line 9635), restarts Hub (`restartHubWithDurableState`, line 9675), then `assertDurableSeededSessionsVisible` (line 6161) waits for each `botster-web-durable-exited-N` text inside `dashboard-view`. `proveExternalSessionLifecycle` (line 6100) anchors one `getByText(sessionId)` row inside `dashboard-view` and waits for `exited` then `entity_remove` then `detached`.
- `scripts/live-packaged-protocol-helpers.mjs`: `HOST_CHROME` (`dashboardTestId`, `sessionsHeadingName`), the host-chrome contract entries (line 296 onward), `durableSeedSessionIdsForDiagnosticsLimit` (line 943), `harnessEventMatches` accepts `lifecycle_class` criteria (line 999).
- History: `044ba6e` added the durable proof when Home rendered every session row. `dad9eb7` moved the current-only filter into `dashboardSessions.ts`. Hub candidate `4d558e9` (`Project exited registry rows after daemon restart`) now lists persisted exited rows with `lifecycle_class=ended`, so the durable lane waits for rows that Web filters out.

Requirement 2 (alt-exited keep-alive):

- `scripts/live-packaged-protocol-helpers.mjs` `productionSessionScriptSource()` line 550: `*botster-web-production-alt-exit*) printf '\033[?1049l'; echo botster-web-production-alt-exited`. Added in `85ed927` on 2026-09-03. The fallthrough arm echoes `botster-web-production-echo:$line`.
- `scripts/live-packaged-protocol-harness.mjs` `proveAlternateScreenExit` (line 8095): requires `alt_screen: true` before, writes `\nbotster-web-production-alt-exit\n`, then `waitForTerminalRendererWrite(page, "botster-web-production-alt-exited")` (line 6974, 45 s timeout, generic message `timed out waiting for mounted terminal renderer write ...`). It then requires `alt_screen: false` and the primary-screen echo. It runs on every lane at line 509, before `proveInFlightAttachCancellation` and the keep-alive marker at line 535.
- botster-hub `script/prove-north-star-shared-session`: `PRODUCER_SCRIPT` copied on 2026-08-16 (`7c055f5`). It has `alt-redraw` but no `alt-exit` arm. Hub candidate `4d558e9` still lacks it. Hub's `run_web_driver` labels are `web keep-alive 1`, `web keep-alive 2`, `web exit`.
- `scripts/live-shared-session-coordinator.mjs`: Web-owned coordinator spawns the session with `productionSessionScriptSource()`, runs the cancel ablation, two keep-alive passes, and the exit pass. This lane passed at `062e314` (verify report `docs/reports/make-cancel-detach-ablation-fail-at-the-cancel-oracle-verify.md`).
- `README.md` lines 91 to 107 describe the caller-owned lane and the keep-alive markers, but do not list the producer commands that a caller-owned producer must implement.

## 5. Root causes on the current base

Requirement 1. Hub now persists and lists exited rows after restart, with `lifecycle_class=ended`. Web keeps only `current` rows on Home. The durable lane waits 45 s for `botster-web-durable-exited-1` on Home and times out. The classification is correct on both sides. Web lacks a presentation path for `ended` rows.

Requirement 2. The Hub north-star producer does not implement `botster-web-production-alt-exit`. It stays on the alternate screen and echoes `botster-web-production-echo:botster-web-production-alt-exit`. Web waits 45 s for `botster-web-production-alt-exited` and reports a generic timeout. Web cannot make a producer leave the alternate screen through input alone. The Hub producer repair belongs to the integration ticket (human decision). Web owns the diagnostic and the documented producer contract, so the next drift fails in seconds with a named cause.

## 6. Scope

In scope:

1. Ended-session presentation path.
   - `src/app/dashboardSessions.ts`: add `endedDashboardSessions(sessions)` that keeps `lifecycle_class === "ended"` only. Keep `currentDashboardSessions` unchanged. Neither helper reads `lifecycle` or `registry_state`.
   - `src/App.tsx`: compute `endedSessions` from the same session entity list and pass it to `DashboardView`.
   - `src/app/dashboard.tsx`: `DashboardView` accepts `endedSessions`. Render a separate `Ended sessions` section below the current `Sessions` section, with its own heading id, `IonBadge` count, `IonList aria-label="Ended sessions"`, and `data-testid="dashboard-ended-sessions"`. Render the section only when at least one ended row exists. Reuse `SessionListItem`; ended rows already render `button={false}` and show the Hub-authored `ended` status. Hide `SessionActionsMenu` on ended rows, because Stop targets a running session (small prop on `SessionListItem`, `showActions`).
   - The current `Sessions` section keeps its rows, count, empty state, and load-error copy unchanged. Rows with `lifecycle_class=indeterminate` stay hidden from both sections (see assumptions).
   - `scripts/live-packaged-protocol-helpers.mjs`: add `HOST_CHROME.endedSessionsTestId = "dashboard-ended-sessions"` and `endedSessionsHeadingName = "Ended sessions"`. Add them to the `dashboard-view` host-chrome contract entry so the App test marks them.
   - `scripts/live-packaged-protocol-harness.mjs` `assertDurableSeededSessionsVisible`: for each seeded id, require a `hub_frame` session record with `lifecycle_class: "ended"` through `waitForHarnessEvent`, then require the row inside `dashboard-ended-sessions`, and require zero matches inside the current `Sessions` list. `proveExternalSessionLifecycle` in durable mode: after the `exited` patch, require the external row inside `dashboard-ended-sessions` before `remove_session`, and keep the existing `detached` wait.
2. Producer-contract diagnostic for the caller-owned lane.
   - `scripts/live-packaged-protocol-helpers.mjs`: add an exported pure helper, `classifyAltExitRendererWrites(decodedWrites)`, that returns `exited` when `botster-web-production-alt-exited` is present, `producer_lacks_alt_exit` when only the fallthrough `botster-web-production-echo:botster-web-production-alt-exit` is present, and `pending` otherwise.
   - `scripts/live-packaged-protocol-harness.mjs` `proveAlternateScreenExit`: replace the bare `waitForTerminalRendererWrite` with a bounded poll that uses the helper. On `producer_lacks_alt_exit`, throw `alternate-screen exit producer contract mismatch: the supplied session producer answered botster-web-production-alt-exit with the fallthrough echo and did not leave the alternate screen; caller-owned producers must implement the README producer command contract`. Keep the 45 s bound for `pending`. Keep every later assertion (`alt_screen: false`, final-row marker gone, primary-screen echo) unchanged.
   - `recordProofNote("alternate_screen_exit", ...)` unchanged.
3. Documentation.
   - `README.md`: add a producer command contract list under the caller-owned lane section: `botster-web-production-size`, `botster-web-production-exit`, `botster-web-production-bytes-lead|rest|ctrl|hold|ablate`, `botster-web-production-mouse-on`, `botster-web-production-alt-redraw:<marker>`, `botster-web-production-alt-exit`, and the fallthrough echo. State that a caller-owned coordinator must supply a producer that implements this contract, and show how to print the canonical script from `productionSessionScriptSource`. State that Home shows Hub-authored `ended` rows in a separate section, that Web does not infer lifecycle, and that the durable lane asserts ended rows there.
   - `docs/architecture.md`: one line if it describes Home session rendering; otherwise no change.
4. Tests in `src/App.test.mjs` (section 12).
5. Implementation and verification reports under `docs/reports/` with the same basename, following prior art.

Non-scope (ticket and human decision):

- Relabeling `ended` rows as `current`. Inferring lifecycle from `lifecycle`, `registry_state`, or exit codes.
- Compatibility paths, legacy classifications, or a producer fallback that skips the alternate-screen assertions.
- Hub source changes, including `script/prove-north-star-shared-session`. The integration ticket owns that repair.
- A second TUI ticket. Changes to `ghostty-shared`.
- Diagnostics view, session detail view, or terminal attach behavior for ended rows. Ended rows stay non-attachable through the existing `isAttachableSession` rule.
- Sorting, pagination, or a cap on the ended list.
- Changes to the cancel ablation, the Detach owner, hydration recovery, or the exit pass.

## 7. Repository ownership boundaries and cross-repo dependencies

- Web owns: `lifecycle_class` presentation, Home layout, the packaged harness, `productionSessionScriptSource`, the producer command contract documentation, and Web-owned live lanes.
- Hub owns: session persistence, `lifecycle_class` authoring, the north-star coordinator, and its `PRODUCER_SCRIPT`. Hub candidate `4d558e9` is the authoritative producer of `ended` rows after restart.
- TUI owns: `ghostty-shared` and its `NORTH_STAR_HISTORY` oracle. Unchanged.
- Dependencies registered: none. The human declined a new Hub ticket and a reverse dependency. The integration ticket `ticket_1787600679_990088` already depends on this ticket and owns the north-star producer repair plus the complete north-star rerun after merge.
- Hub pin: `@trybotster/hub-test-support` `0.1.43`, `@trybotster/ui-contract` `0.3.3`, `@trybotster/terminal-protocol` `0.3.0` stay pinned. No DTO change; `lifecycle_class` is already required in the generated DTO.
- Session-type consumer rules stay intact: live lanes run `exerciseSessionTypes` and the Option A picker before the terminal lane. No filtering by client `target_id` equality.

## 8. Assumptions and unknowns

- Assumption: Hub candidate `4d558e9` or later is the Hub binary for live proof. Hub `main` before that commit does not list exited rows after restart, so the durable ended assertion would fail for a Hub reason. The Implementer records the exact Hub and Core commits with every live result.
- Assumption: `indeterminate` rows stay hidden from both Home sections. The ticket names only `ended`. The Implementer must not widen this.
- Assumption: ended rows show no Stop action. Stop sends `shutdown_session`, which targets a running session. If Review wants Stop kept for parity, that is a one-prop change.
- Assumption: rendering the ended section only when non-empty keeps the existing empty-state proof and copy unchanged.
- Unknown: whether `seedDurableExitedSessions` still observes `lifecycle=exited` through `list_sessions` on Hub `4d558e9` before restart. The existing 15 s wait covers it. If Hub omits the rows before restart, stop and report a Hub finding to the integration ticket instead of editing persisted state.
- Unknown: whether the alternate-screen fallthrough echo is visible in `renderer_write` bytes while the producer stays on the alternate screen. The producer echoes through the PTY, so Restty receives the bytes regardless of screen. The unit test for the helper covers the classification; the live check under the Hub producer belongs to the integration ticket.

## 9. Affected surfaces and files

| File | Change |
| --- | --- |
| `src/app/dashboardSessions.ts` | add `endedDashboardSessions` |
| `src/App.tsx` | compute and pass `endedSessions` |
| `src/app/dashboard.tsx` | ended section; `SessionListItem` `showActions` prop |
| `scripts/live-packaged-protocol-helpers.mjs` | `HOST_CHROME` ended constants, contract entry, `classifyAltExitRendererWrites` |
| `scripts/live-packaged-protocol-harness.mjs` | durable ended assertions; alt-exit producer diagnostic |
| `src/App.test.mjs` | unit, render, anti-drift, host-chrome contract, helper classification tests |
| `README.md` | ended-row presentation; producer command contract |
| `docs/architecture.md` | one line if Home rendering is described |
| `docs/plans/...`, `docs/reports/...` | this plan, implement and verify reports |

## 10. Risks

- Strict-mode locator collisions: `getByText(sessionId, { exact: true })` inside `dashboard-view` must match exactly one element after the ended section exists. A session is either `current` or `ended`, so at most one row renders. The Implementer scopes durable assertions to the section test ids to make the intent explicit.
- Anti-drift assertions: `src/App.test.mjs` line 1106 asserts the `current` filter string. Add the `ended` filter assertion. Do not loosen the existing one.
- The alt-exit diagnostic must not change the pass path. Under the Web producer, the helper returns `exited` on the same renderer write the current code waits for. The shared-session lane must still print all markers and the cancel ablation must still fail first at the cancel oracle.
- The durable lane runs `proveExternalSessionLifecycle` while the page is on Diagnostics. The new ended assertion runs after `openHomeView`, so the Diagnostics cap check stays unchanged.
- Live evidence must run at the final commit ([[live lane evidence must postdate the last relevant source commit]]). Harness edits count as relevant source.
- Host load and orphan cleanup: record host load and clean lane-owned Hub processes on failure ([[live lane arms need recorded host load and orphan cleanup]]).

## 11. Runtime-teardown class

Does not apply. This ticket changes a dashboard projection, harness assertions, a harness diagnostic, and docs. It does not change WebRTC peer lifecycle, `HubTerminalDataPlane` teardown, Detach ownership, hydration recovery, or process ownership. The alt-exit change only replaces a wait with a classified wait inside the same proof function.

## 12. Acceptance checks and tests

Unit and render (`npm test`):

1. `endedDashboardSessions` returns only `lifecycle_class === "ended"` rows and preserves order. A row with `lifecycle: "exited"` and `lifecycle_class: "current"` is not ended. A row with `registry_state: "exited"` and no `lifecycle_class` is not ended. `currentDashboardSessions` expectations unchanged.
2. Anti-drift: `appFeatureSources` match `lifecycle_class === "ended"` and `export function endedDashboardSessions`; `appShell` matches `endedDashboardSessions(`.
3. Rendered `DashboardView` markup through the existing minimal-DOM or `renderToStaticMarkup` path: with one current and two ended rows, the `Sessions` badge reads `1`, `data-testid="dashboard-ended-sessions"` contains both ended titles with status `ended`, ended rows are not `button` items, and no session options menu renders for ended rows. With zero ended rows, the ended section is absent and the existing empty-state copy renders.
4. `markHostChromeContract("dashboard-view")` covers `endedSessionsTestId` and `endedSessionsHeadingName`.
5. `classifyAltExitRendererWrites`: `exited` when the alt-exited echo is present, `producer_lacks_alt_exit` when only the fallthrough echo is present, `pending` for neither, and `exited` when both are present.
6. Harness source guard: `proveAlternateScreenExit` calls `classifyAltExitRendererWrites` and throws the producer contract mismatch message on `producer_lacks_alt_exit`; `proveAlternateScreenExit` still runs before the keep-alive marker.

Repository gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run smoke:react-singleton`.

Live proof (each at the final commit, with Hub and Core commits and host load recorded):

7. `smoke:live-packaged-protocol:durable` with Hub `4d558e9` or later and Core `72d1c75` or later. Required output: five `botster-web-durable-exited-N` records with `lifecycle_class: "ended"` observed as `hub_frame` events, each row inside `dashboard-ended-sessions`, none inside the current `Sessions` list, the external session row moving to the ended section after the exit patch, then removal and `detached`, and the normal terminal proof against `web-prod`.
8. `smoke:live-packaged-protocol:shared-session` (Web-owned coordinator). Required output: `live-shared-session-cancel-ablation-passed` with first failure at the cancel detach oracle, two `live-shared-session-keep-alive-passed` markers with `alternate_screen_exit` proof notes showing `before_alt_screen: true` and `after_alt_screen: false`, `live-shared-session-exit-passed`, and `live-shared-session-coordinator-passed {"keep_alive_runs":2,"cancel_ablation":true,"exit_pass":true}`.
9. `smoke:live-packaged-protocol` (IsolatedHub `web-prod`) once, to prove the Home change does not regress the default lane.
10. Red-on-revert: restore `currentDashboardSessions`-only rendering and show the durable lane failing at the ended-section wait; restore the bare `waitForTerminalRendererWrite` and show test 6 red.

Downstream proof (owned by the integration ticket after merge): the complete `script/prove-north-star-shared-session` lane with the repaired Hub producer, `botster-web-production-alt-exited` before TUI attach, and `ghostty-shared` history. This Web ticket records that hand-off in its verify report and does not claim it.

## 13. Vault gaps worth capturing

- Gotcha candidate: a client harness that hardcodes a copied producer script drifts from the owning client's producer contract; caller-owned coordinators should source or pin the canonical producer. Capture after the integration ticket confirms the repair shape.
- Convention candidate: Web Home renders Hub-authored `ended` rows in a separate non-attachable section and never infers lifecycle. Capture at Implement if the section shape holds through Review.
