# Plan: make the cancel-detach ablation fail at the cancel oracle

Ticket: `ticket_1788467459_333288`
Run: `run_1788467924_677099`
Parent integration ticket: `ticket_1787600679_990088` (botster-hub, depends on this ticket)
Base: `origin/main` at `e5573a2` (`Record mixed fixture repair`), fetched 2026-09-03
Plan revision: 2 (addresses `review_1788468768_864558`; revision 1 used stale base `6dc32b3`)

## Plan Review return

Review `review_1788468768_864558` returned three findings.

| Finding | Class | Revision 2 response |
| --- | --- | --- |
| `finding_1788468768_812636` Rebase and renew the plan against current botster-web main | product | Branch rebased onto `e5573a2`. Sections 4 to 8 re-derived from the new base. The root cause changed (section 5). |
| `finding_1788468768_264942` Provide a reachable ordered root-cause evidence path | product | Section 5 names the emitter from the new base code. Section 8 adds a deterministic unit reproduction that is red on base and green after the fix, and a harness chronology field so the live marker and the live failure message both print the ordered records. |
| `finding_1788468768_173149` Repair Plan completion evidence and add the Plan vault checklist | process | Vault checklist `checklist_1788468325_463153` (owner `run_1788467924_677099`) already exists for this run. `project_pipelines_current_context` lists it under neither `run_checklists` nor `ticket_checklists` because the engine stored it with `scope: ticket` and a run owner. This visit updates that checklist and cites it. No duplicate is created. Gate evidence names `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, and `target_repository`. |

Ticket revision 2026-09-03 (`question_1788468513_479819`) folded the TUI `ghostty-shared` late-history failure into this ticket as a Web harness defect. Section 6 adds that scope.

## 1. Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Worktree | this run worktree; branch `project-pipelines/ticket_1788467459_333288` rebased on `e5573a2` |
| Repository playbook | [[botster-web-playbook]] |
| Merge policy | direct into `main` |
| Teardown class | yes, narrow (section 11) |
| Session-type eligibility consumer | yes; keep the parent pins and Option A picker path unchanged |

`list_spawn_targets` maps `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. `project_pipelines_search_tickets` (Plan Review) found no other open botster-web sibling.

## 2. Repository playbook loaded

[[botster-web-playbook]]. Web owns browser connection lifecycle, Restty teardown, the live packaged harness and its producer script, and browser-consumer conformance. Web does not own Hub Detach idempotency, Core subscription teardown, host session policy, or the TUI `NORTH_STAR_HISTORY` oracle.

## 3. Other role and surface playbooks and atomic notes loaded

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster runtime teardown lenses]]
- [[in-flight cancel needs one Web Detach owner]]
- [[bound terminal hydration progress and retry once]]
- [[web shared session keep alive leaves the producer on the alternate screen]]
- [[narrow ablation at the enforcement point is the cleanest regression negative control]]
- [[an ablation that reddens at the first assertion does not vouch for later ones]]
- [[ablate dont argue to prove a branch is unexercised]]
- [[live lane evidence must postdate the last relevant source commit]]
- [[live lane arms need recorded host load and orphan cleanup]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[the browser creates each subscription DataChannel after Hub reserves its label]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]

Not loaded: [[project-pipelines-playbook]]. This ticket touches no Project Pipelines package or plugin path.

## 4. Context loaded (base `e5573a2`)

- `src/botster/hubTerminalDataPlane.ts`: `detach()` (line 373) with the `ablateCancelDetach` early return (line 378); `closeStreamWithoutDetachRequest()` (clears `progressTimeout`, cancels the reader, bumps the generation); `closeStream(preserveTerminalFrameQueue)` (line 648, Detach owner through `sendDetachRequestOnce`); `armHydrationProgressBound()` (line 1115, 10 s `localWebrtcResponseChunkLimits.requestTimeoutMs` bound armed at `ghostsnp_install` and at stream ready); `recoverLostSnapshot()` (line 1082, `hydration_progress_timeout` → `snapshot_lost_recover` → `closeStream(true)` → new subscription id → `ensureAttached`); `hasSentDetachFor()`; `LiveTerminalHarness` (line 1445).
- `src/botster/webrtcDaemonClient.ts` `streamTerminal`: `abandon()` closes the channel without Detach; `unsubscribe()` sends Detach. Production planes call `abandon()`.
- `src/botster/terminal.ts` `DefaultTerminalViewBridge.detach()` and `unmount()`: awaits `dataPlane.detach()`, unsubscribes output, destroys the renderer.
- `scripts/live-packaged-protocol-harness.mjs`: shared terminal lane order at lines 500 to 545: `proveRetainedHistoryAfterEcho` → `proveRapidAlternateScreenReattach` (line 508, 20 cycles, unconditional) → `proveInFlightAttachCancellation` (line 510, shared mode) → `proveInPageTerminalDataChannelReconnect` (line 512) → `live-shared-session-keep-alive-passed` (line 534). `proveInFlightAttachCancellation` (line 8083) arms the snapshot-install hold, waits for `snapshot_install_held`, sets `harness.ablateCancelDetach = true`, unmounts through Home, waits up to 15 s for a `detach` daemon request, then requires `detach_count === 1`. `readDirectTerminalModeFlags` (line 8028) shows the `read_mode_flags` control request shape. `recordProofNote` (line 59). `echoProbe = "keys"` (line 142) is echoed on the primary screen before the alternate-screen cycles and asserted in `read_screen` at line 477.
- `scripts/live-packaged-protocol-helpers.mjs` `productionSessionScriptSource()` (line 533): the `*botster-web-production-alt-redraw:*` arm sends `ESC[?1049h`. No arm sends `ESC[?1049l`.
- `scripts/live-shared-session-coordinator.mjs` `assertCancelAblation` (line 125): nonzero exit plus first failure `expected exactly one detach for held subscription ..., got 0`; exit 0 throws `cancel ablation stayed green`.
- `src/App.test.mjs`: source guards at lines 2804 to 2871; stalled-hydration unit fixture at line 8930 (`hydrationProgressBoundMs: 20`, fake bridge with `abandon()`, `bindGhostsnpInstaller`, `opaqueFinishSnapshotEvent`) that already proves one stale-subscription Detach on recovery.
- `README.md` line 106: claims the ablation skips the Detach request and the reader cancel.
- `src/botster/generated/daemon-protocol.ts` line 213: `mode_flags.alt_screen: boolean`.
- Commits `6dc32b3..e5573a2`: `a51bcee` (hydration progress bound and retry), `4096753`, `9d2e2af`, `c407dc3`, `4e9e0c8`, `c5cff60` (dedicated entity and package-event channels), fixture-order repairs.
- Parent run `run_1788459722_264752` (botster-hub): Web shared-session coordinator against Hub `13074b6` / Core `72d1c75` printed `live-shared-session-cancel-passed` and exited 0 under `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1`; the coordinator threw `cancel ablation stayed green`. Human answers `question_1788465866_563736` and `question_1788468513_479819`.

## 5. Root cause on the current base

The ablation is broad, not narrow. Under `ablateCancelDetach`, `detach()` returns before `closeStreamWithoutDetachRequest()`. It leaves `attachmentGeneration` unchanged, the stream open, `hydration` present with its armed `progressTimeout`, and `detachSentFor` undefined.

The harness holds the GHOSTSNP install for the held subscription, so hydration cannot complete. Commit `a51bcee` arms a 10 s progress bound at `ghostsnp_install`. The harness then waits up to 15 s for a Detach. Inside that window the bound fires:

1. `armHydrationProgressBound` timeout → `hydration_progress_timeout` record.
2. `recoverLostSnapshot` → `snapshot_lost_recover` record → `closeStream(true)`.
3. `closeStream` → `sendDetachRequestOnce(heldId, heldGeneration)` → one `daemon_request` `detach` for the held id, plus `reader_cancel`.
4. `ensureAttached` with a new subscription id.

The cancel oracle counts one Detach, sees `reader_cancel`, sees `running`, and sees a fresh subscription id on remount. The negative control is vacuous. The unablated public cancel never reaches this state because `closeStreamWithoutDetachRequest()` clears the timer and bumps the generation before the single Detach.

This is the deterministic emitter. `failHydration` and `core_adapter_closed` are secondary paths through the same `closeStream()` owner and are covered by the same fix.

## 6. Scope

In scope, `botster-web` only.

A. Cancel ablation:

1. Narrow the ablation to the enforcement decision inside `detach()`. Under `ablateCancelDetach`, run every production cleanup step (`closeStreamWithoutDetachRequest()`, listener clear, status listener clear, lifecycle uninstall), record `cancel_detach_ablated`, set `detachSentFor = { heldSubscriptionId, heldGeneration }`, and skip `sendDetachRequestOnce`. `detached` is true, so `hasSentDetachFor` blocks every later emitter for the held id. The reader cancel still happens, so the decoder-abort oracle stays satisfiable and the cancel oracle is the first failure with `got 0`.
2. Keep the ablation gate inside `detach()`. Do not add a second switch in `closeStream()`, `recoverLostSnapshot()`, or `sendDetachRequestOnce()`.
3. Unit coverage in `src/App.test.mjs`, reusing the stalled-hydration fixture shape at line 8930 with `hydrationProgressBoundMs: 20` and `globalThis.window.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { terminal: [], ablateCancelDetach: true }`:
   - Positive control: public `detach()` without ablation sends exactly one `detach` for the held id.
   - Ablated cancel with a stalled hydration: deliver READY without `attached`, set the flag, await `detach()`, then wait past the bound. Assert zero `detach` requests, exactly one stream (no recovery reattach), records `cancel_detach_ablated` and `reader_cancel` for the held generation, and no `hydration_progress_timeout` record.
   - Red-on-revert: with the current early return restored, this test must fail at the `detach` count assertion (`1`, not `0`) and at the stream count (`2`). Record the failing assertion location. This is the deterministic reproduction of section 5.
4. Harness chronology: in `proveInFlightAttachCancellation`, collect the ordered `terminal` records for the held subscription from the hold index onward (`kind`, `subscription_id`, `generation`, index) together with the `daemon_request` `detach` entries. Include the chronology in the `live-shared-session-cancel-passed` marker and in the `got N` error message after the existing text, so both the reproduction and the ablation failure print it. Keep the `expected exactly one detach for held subscription ..., got 0` prefix unchanged so the coordinator regex still matches.
5. Update `README.md` line 106: the flag skips only the production `detach` request for the held subscription and marks the once-owner. It does not skip the reader cancel or stream close.

B. Alternate-screen exit (ticket revision 2026-09-03):

6. Add a producer arm `botster-web-production-alt-exit` in `productionSessionScriptSource()` that sends `ESC[?1049l` and echoes `botster-web-production-alt-exited`.
7. Add `proveAlternateScreenExit(page, sessionId)` in the harness and call it immediately after `proveRapidAlternateScreenReattach` (line 508) in every mode, before the cancel and reconnect proofs and before `live-shared-session-keep-alive-passed`. The proof:
   - reads `read_mode_flags` before exit and requires `alt_screen === true`;
   - captures `read_screen` text before exit (last alt cycle's `-final-row-` marker present);
   - sends `botster-web-production-alt-exit\n` through the mounted terminal and waits for `botster-web-production-alt-exited` in renderer writes;
   - reads `read_mode_flags` after exit and requires `alt_screen === false`;
   - reads `read_screen` after exit and requires the last alt `-final-row-` marker absent and `botster-web-production-alt-exited` present on the primary screen;
   - records a proof note `alternate_screen_exit` with both mode-flag readings and both screen summaries, and whether the pre-alt `botster-web-production-echo:keys` line is visible again.
   Rapid alternate-screen reattach itself is unchanged.
8. Source guards in `src/App.test.mjs`: `productionSessionScriptSource()` matches `1049l`; the harness contains `proveAlternateScreenExit` and calls it before `live-shared-session-keep-alive-passed`.
9. README shared-session section: one sentence that each keep-alive pass returns the producer to the primary screen before it prints the keep-alive marker.

C. Report: `docs/reports/make-cancel-detach-ablation-fail-at-the-cancel-oracle-implement.md`.

Explicitly out of scope:

- Hub, Core, TUI, `botster-hub-client`, or `botster-tui-kit` source. The TUI `NORTH_STAR_HISTORY` oracle stays unchanged. The parent reruns TUI `ghostty-shared`.
- Durable dashboard restore. Hub owns persisted exited rows. No second Web persistence path.
- Any change to the production cancel contract: exactly one Detach, `DETACH_REQUEST_BOUND_MS`, the `Promise.race` bound, the once-owner, last-listener close, or the hydration progress bound and its single retry.
- Any dual terminal route or control-channel terminal fallback.
- Relaxing the coordinator's first-failure regex, the 100 ms double-count wait, or the 20-cycle alternate-screen proof.

## 7. Repository ownership boundaries and cross-repo dependencies

- Web owns the ablation hook, data-plane cleanup order, harness oracles and chronology, producer script, coordinator assertion, README claims, and unit tests.
- Hub owns Detach idempotency, route retirement on channel close, reservation expiry, and `read_mode_flags` truth. No Hub change.
- Core owns adapter close and mode flags. No Core change.
- TUI owns the `ghostty-shared` late-history oracle. No TUI change. The parent ticket `ticket_1787600679_990088` depends on this ticket and reruns `ghostty-shared` after merge. No new dependency is registered.
- Live proof uses the parent Hub worktree `trybotster-botster-hub-project-pipelines-ticket_1787600679_990088` at `4d558e9` (Core lock `72d1c75`). Implement rebuilds `botster-hub` and `botster-session-worker` from that checkout before the runs and records both commits. Main `botster-hub` at `bb1a330` is older than the parent branch and is not the proof target.

## 8. Assumptions and unknowns

- A1 (confirmed by code, verified by the unit reproduction): the second Detach emitter is `recoverLostSnapshot` → `closeStream(true)` after the hydration progress bound fires on the ablated, still-current generation.
- A2: the harness sets `ablateCancelDetach` after the hold is observed, so the flag is visible when `detach()` runs. The `cancel_detach_ablated` record confirms this on the live run.
- A3: `detachSentFor` for the held id plus `detached === true` blocks every later emitter: `closeStream()`, the stale `ensureAttached` abort (checks `detached`), `handleTransportRecovered` (checks `detached`), and `abandonStreamHandle` (checks `hasSentDetachFor`).
- A4: `ESC[?1049l` on the producer PTY returns the session to the primary screen and Hub reports `alt_screen: false` through `read_mode_flags`. The live proof confirms this.
- U1: whether the un-detached held subscription stays bound on Hub until peer loss during the ablation pass. Each coordinator pass is a fresh driver process and peer. Implement records any reservation rejection in the later passes; a rejection is a finding, not a waiver.
- U2: whether the restored primary screen still shows the pre-alt `botster-web-production-echo:keys` line. The proof records it but does not require it; the required oracles are the mode flag, the absent alt marker, and the fresh primary echo.

## 9. Affected surfaces and files

- `src/botster/hubTerminalDataPlane.ts`: `detach()` ablation branch only.
- `scripts/live-packaged-protocol-harness.mjs`: chronology in `proveInFlightAttachCancellation`; new `proveAlternateScreenExit`; one call after line 508.
- `scripts/live-packaged-protocol-helpers.mjs`: new `botster-web-production-alt-exit` arm.
- `src/App.test.mjs`: two new plane tests; source guards for `1049l`, `proveAlternateScreenExit`, and the chronology field; guard regex adjustments only if the narrowed branch shape requires.
- `README.md`: line 106 and one sentence in the shared-session section.
- `vite.config.ts`: `resolve.dedupe: ["react", "react-dom"]` (accepted deviation `question_1788471014_552139`; production bundle otherwise ships two React copies and the live lane dies at `useMemo`).
- `scripts/check-react-singleton-bundle.mjs`: production-build smoke that requires exactly one `.useMemo=function` wrapper.
- `package.json`: `smoke:react-singleton`; `smoke:browser-runtime` runs that check after build.
- `docs/plans/make-cancel-detach-ablation-fail-at-the-cancel-oracle.md`, `docs/reports/make-cancel-detach-ablation-fail-at-the-cancel-oracle-implement.md`.

Not touched: `scripts/live-shared-session-coordinator.mjs`, `src/botster/webrtcDaemonClient.ts`, `src/botster/terminal.ts`, generated DTOs, pins.

## 10. Risks

- R1: the ablation edit changes production `detach()`. Mitigation: only the `ablateCancelDetach === true` branch changes; the positive-control test and the keep-alive passes with `detach_count: 1` prove the production path.
- R2: a source guard pins the current early-return shape. Mitigation: run `npm test` first; adjust only the failing guard and keep its intent.
- R3: the live lane is slow and load-sensitive. Mitigation: `uptime` before and after; lane-owned orphan cleanup by data directory and session id; one reproduction run and one final run.
- R4: the un-detached held subscription stays on Hub during the ablation pass. Mitigation: U1 recording; `waitForSessionLifecycle(running)` between passes.
- R5: the alternate-screen exit changes the screen the later cancel and reconnect proofs see. Mitigation: those proofs use subscription ids, attach records, and markers, not alt-screen rows. The exit runs in both lanes so IsolatedHub proves the same order.
- R6: the reproduction run does not print `cancel-passed` on this host. Then Implement must not guess. The unit reproduction is the primary root-cause evidence. Record the live first failure and ask the human whether the parent's observation is host-specific.

## 11. Runtime-teardown lens answers

| Field | Answer |
| --- | --- |
| `teardown_class_applies` | yes, narrow. The change edits the public cancel owner `HubTerminalDataPlane.detach()`. Only the test-ablation branch changes behavior. |
| `teardown_isolation` | One plane owns one session, subscription id, and generation. The ablated cancel abandons only the held channel. Sibling planes, entity and package-event channels, the control channel, and the peer stay up. |
| `teardown_bounds` | Unchanged. Production cancel races one Detach request against `DETACH_REQUEST_BOUND_MS`. The ablated branch sends no request and returns after synchronous local cleanup. The hydration progress bound is cleared by `closeStreamWithoutDetachRequest()` in both branches. |
| `late_message_matrix` | Attach: a stale `ensureAttached` completion abandons its stream and checks `detached` before Detach. Terminal frames: `isCurrentAttachment` rejects the old generation after cleanup bumps it. Hydration timer: cleared in cleanup; `recoverLostSnapshot` also requires `this.hydration === hydration`. `terminal-data-channel-closed`: listener uninstalled in `detach()`; `handleTransportLost` and `handleTransportRecovered` check `detached`. `terminal_subscription_closed`: `emitTerminalEvent` rejects the old generation; `closeStream()` checks `hasSentDetachFor`. |
| `production_path_proof` | Home unmount → `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount` → `HubTerminalDataPlane.detach()` → one `daemon_request` detach → `reader_cancel` → `running` → remount with a new subscription id. Proven by two keep-alive passes with `detach_count: 1` at the final commit. The ablated path is proven by `got 0` as the first failure with the printed chronology showing no `hydration_progress_timeout` or `snapshot_lost_recover` for the held id. |
| `ownership_identity` | `detachSentFor = { subscriptionId, generation }` plus `detached`. Under ablation the held id is marked so reused-id and late-generation emitters skip. |
| `sibling_fail_closed_policy` | Ablation affects one plane. If the abandoned route stays bound on Hub, peer loss at driver exit retires it (U1). No sibling sacrifice. |

## 12. Acceptance checks and tests

Deterministic gates at the final commit, in order:

1. `npm run typecheck`
2. `npm run lint` (existing Fast Refresh warnings allowed; zero errors)
3. `npm test` (protocol drift check plus `src/App.test.mjs` with the new plane tests and source guards)
4. `npm run build`
5. `npm run smoke:react-singleton` (fails with two `.useMemo=function` wrappers when `resolve.dedupe` is removed; passes with one wrapper after dedupe).
6. Red-on-revert for the ablated-cancel test: restore the early return, run `npm test`, record the failing assertion and location (`detach` count `1`; hydration timeout record is the second independent oracle; stream count stays `1` because `attachToAuthoritativeSession` returns when listeners are empty), restore, and show `git diff --exit-code` for `src/botster/hubTerminalDataPlane.ts`.

Live reproduction before the plane fix (attribution, required):

7. Commit order: (a) harness chronology and alternate-screen exit, (a2) Vite React `resolve.dedupe` plus `smoke:react-singleton` so the browser can boot, (b) plane ablation fix. Run step 9 at commit (a2) so the reproduction prints the chronology with the unchanged plane.
8. Rebuild the parent Hub worktree at `4d558e9`; record the Hub commit and the Core lock SHA. Record `uptime`. Remove lane-owned orphans by the `botster-web-shared-session-*` data directory and the `north-star-shared` session id.
9. Run `BOTSTER_HUB_BIN=... BOTSTER_SESSION_WORKER_BIN=... npm run smoke:live-packaged-protocol:shared-session` at commit (a2). Required: the ablation driver prints `live-shared-session-cancel-passed` whose chronology contains, in order for the held id, `cancel_detach_ablated`, `hydration_progress_timeout`, `snapshot_lost_recover`, `reader_cancel`, and one `daemon_request` `detach`; the coordinator throws `cancel ablation stayed green`. If the outcome differs, apply R6.

Live proof after the fix (one focused integration proof, required):

10. Record `uptime` and clean orphans again.
11. Run the same coordinator command at the final commit. Required: exit 0 and all of:
    - `live-shared-session-cancel-ablation-passed` with `first_failure` matching `expected exactly one detach for held subscription ..., got 0`, after `session-type-live-proof`, `new-session-picker-live-proof`, and `live-shared-session-terminal-lane`, without `live-shared-session-cancel-passed` or `live-shared-session-keep-alive-passed` in that pass, and with a chronology that shows `cancel_detach_ablated` and `reader_cancel` and no `hydration_progress_timeout`, `snapshot_lost_recover`, or `detach` for the held id.
    - Two keep-alive passes, each printing `live-shared-session-terminal-lane`, the `alternate_screen_exit` proof note with `alt_screen` true then false, `live-shared-session-cancel-passed` with `detach_count: 1`, and `live-shared-session-keep-alive-passed` for `north-star-shared`, with the in-page DataChannel reconnect proof inside the terminal lane.
    - One exit pass printing `live-shared-session-exit-passed` with `process_exit=true`.
    - `live-shared-session-coordinator-passed` with `keep_alive_runs=2`, `cancel_ablation=true`, `exit_pass=true`.
    - No `workspaces-shared-hub-browser-summary`, no IsolatedHub completion string, no `shutdown_session` for the shared session.
12. Between the second keep-alive pass and the exit pass, read the session with a Hub `read_mode_flags` request from the coordinator host or record the second pass's post-exit mode flags: `alt_screen` must be false when the pass ends. This is the state the TUI `ghostty-shared` leg inherits.
13. The live result commit must equal the final commit. Any later change to the data plane, WebRTC client, terminal bridge, harness, helpers, or Vite React resolution invalidates it.
14. Record `uptime` after, Hub commit, Core lock SHA, and pins (`@trybotster/hub-test-support@0.1.43`, `@trybotster/terminal-protocol@0.3.0`).

Downstream proof: the parent integration ticket reruns the complete matrix, including TUI `ghostty-shared`, after this merge. This run does not execute the parent matrix.

## 13. Vault gaps worth capturing

- A broad ablation that skips teardown hands the oracle to a second production owner; here a bounded-recovery timer supplied the single Detach. Candidate note extending [[narrow ablation at the enforcement point is the cleanest regression negative control]]: an ablation must clear every timer and bump every generation that the production path clears, or a later owner satisfies the oracle.
- [[in-flight cancel needs one Web Detach owner]] should list `recoverLostSnapshot` → `closeStream(true)` as a Detach owner that public cancel must disarm.
- [[web shared session keep alive leaves the producer on the alternate screen]] should record the Web-owned fix location once merged: the `alt-exit` producer arm and `proveAlternateScreenExit` before the keep-alive marker.
