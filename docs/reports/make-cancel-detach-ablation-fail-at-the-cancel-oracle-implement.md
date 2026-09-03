# Implement report: make BOTSTER_LIVE_ABLATE_CANCEL_DETACH fail at the cancel oracle

Ticket: `ticket_1788467459_333288`
Run: `run_1788467924_677099`
Step: `botster_stack_implement` / `run_step_1788469377_829071`
Plan: `docs/plans/make-cancel-detach-ablation-fail-at-the-cancel-oracle.md` revision 2 (`artifact_1788469072_527069`), plus the accepted Vite deviation in `question_1788471014_552139`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1788467459_333288` |
| Web base | `e5573a2` |
| Live result commit | `ad57167` |
| Hub at live proof | parent worktree `ticket_1787600679_990088` at `4d558e9` |
| Core lock | `72d1c75` |
| Session id | `north-star-shared` |
| Teardown class | yes, narrow |
| Merge policy | direct into `main`; no pull request |

Independent `project_pipelines_current_context` maps `target_id` to `trybotster/botster-web`. The approved plan used the same routing.

## Repository playbook and other playbooks/notes applied

Role and charter:

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[botster runtime teardown lenses]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[pipeline artifacts should use path neutral worktree references]]
- [[identity]]
- [[goals]]

Not loaded: [[project-pipelines-playbook]]. This ticket does not touch Project Pipelines package or plugin paths.

Targeted notes:

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
- [[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]]

## Files changed

- `src/botster/hubTerminalDataPlane.ts` — under `ablateCancelDetach`, run `closeStreamWithoutDetachRequest()`, clear listeners, mark `detachSentFor` for the held id/generation, skip only `sendDetachRequestOnce`
- `scripts/live-packaged-protocol-harness.mjs` — cancel chronology; `proveAlternateScreenExit` after rapid alt-screen reattach in every mode
- `scripts/live-packaged-protocol-helpers.mjs` — producer arm `botster-web-production-alt-exit` sends `ESC[?1049l`
- `src/App.test.mjs` — positive/ablated stalled-hydration plane tests; source guards for `1049l`, `proveAlternateScreenExit`, chronology, Vite dedupe
- `README.md` — ablation skips only the Detach request; keep-alive returns to the primary screen
- `vite.config.ts` — `resolve.dedupe: ["react", "react-dom"]` (`question_1788471014_552139`)
- `scripts/check-react-singleton-bundle.mjs` — production-build smoke: exactly one `.useMemo=function` wrapper
- `package.json` — `smoke:react-singleton`; `smoke:browser-runtime` runs that check after build
- `docs/plans/make-cancel-detach-ablation-fail-at-the-cancel-oracle.md` — accepted Vite deviation and singleton smoke
- `docs/reports/make-cancel-detach-ablation-fail-at-the-cancel-oracle-implement.md` — this report

## Ownership boundaries preserved

This run stayed in `botster-web`. It did not edit Hub, Core, TUI, or `botster-hub-client`. Hub still owns Detach idempotency and `read_mode_flags`. TUI `NORTH_STAR_HISTORY` is unchanged. No dual terminal route. No second Web persistence path.

## Cross-repo dependencies or separately routed work

None opened. Parent integration ticket `ticket_1787600679_990088` already depends on this ticket and reruns TUI `ghostty-shared` after merge.

## Deviations from plan

1. Vite React `resolve.dedupe` and `smoke:react-singleton` (`question_1788471014_552139`). Without it the production bundle shipped two React copies and Playwright died at `useMemo` before Hub settings.
2. Live attribution ran at `b03cf8b` (harness + Vite dedupe), not at harness-only `85ed927`, because `85ed927` could not boot.
3. Unit red-on-revert of the early-return `detach()` fails at detach count `1` and at `hydration_progress_timeout`. Stream count stays `1` because `attachToAuthoritativeSession` returns when `listeners.size === 0` after public detach. That is not the plan's stream-count-`2` oracle.
4. Chronology matches `subscription_id` or `previous_subscription_id`, not generation. Generation matching mixed remount records.
5. Live reproduction chronology at `b03cf8b` showed `cancel_detach_ablated`, `hydration_progress_timeout`, `reader_cancel`, and one `detach`. It did not print `snapshot_lost_recover` because that record uses `previous_subscription_id`. After the plane fix, that path does not run.
6. Docs-only report commit may follow `ad57167`. Live proof used `ad57167` for data plane, harness, helpers, and Vite resolution.

## Runtime-teardown lenses implemented

| Lens | Implementation |
| --- | --- |
| Isolation | Ablated cancel abandons one plane's held subscription. Peer, sibling entity/event channels, and the supplied session stay up. |
| Bounds | Production cancel still races one Detach against `DETACH_REQUEST_BOUND_MS`. The ablated branch sends no request. `closeStreamWithoutDetachRequest()` clears the hydration progress bound. |
| Late-message matrix | Attach completions check `detached`. Terminal frames check generation. Hydration timer is cleared. Transport lost/recovered check `detached`. `hasSentDetachFor` blocks later `closeStream()` Detach for the held id. |
| Production-path proof | Home unmount → `DefaultTerminalViewBridge.unmount` → `HubTerminalDataPlane.detach()`. Keep-alive passes: `detach_count: 1`. Ablation: first failure `got 0` with `cancel_detach_ablated` and `reader_cancel` and no `hydration_progress_timeout`. |
| Ownership identity | `detachSentFor = { subscriptionId, generation }` plus `detached`. Ablation marks the held id so later emitters skip. |
| Sibling fail-closed | No sibling sacrifice. Session-workers `14620` and `15125` were left running under the host-clear instruction. |

## Tests and downstream proof run

Deterministic:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:react-singleton
```

Typecheck, test, build, and singleton smoke exit 0. Lint: zero errors, existing Fast Refresh warnings only.

Singleton red-on-revert: remove `resolve.dedupe`, `npm run smoke:react-singleton` fails `expected one React useMemo wrapper ... got 2`. Restore. Green is one wrapper in `index-B0-TFq0U.js`.

Plane red-on-revert: restore the early return in `detach()`. `npm test` fails at `src/App.test.mjs` detach count `1 !== 0`. A separate assertion-first run fails at `hydration_progress_timeout` (`true !== false`) with records `cancel_detach_ablated`, `hydration_progress_timeout`, `snapshot_lost_recover`, `reader_cancel`. Restore.

Live reproduction at `b03cf8b` (unchanged plane):

- Load before: 7.02 7.77 7.19. After: 37.45 24.79 14.55.
- Coordinator exit 1: `cancel ablation stayed green`.
- Driver printed `session-type-live-proof`, `new-session-picker-live-proof`, `live-shared-session-terminal-lane`, `live-shared-session-cancel-passed` with `detach_count: 1`.
- Held-id chronology: `cancel_detach_ablated`, `hydration_progress_timeout`, `reader_cancel`, one `daemon_request` `detach`.
- `alternate_screen_exit`: `before_alt_screen: true`, `after_alt_screen: false`.

Live proof at `ad57167` (plane fix):

```sh
BOTSTER_HUB_BIN=<parent Hub 4d558e9>
BOTSTER_SESSION_WORKER_BIN=<matching session-worker>
npm run smoke:live-packaged-protocol:shared-session
```

Exit 0. Load before: 13.84 19.62 15.91. After: 31.01 25.86 20.12. Hub `4d558e9`, Core lock `72d1c75`. Pins: `@trybotster/hub-test-support@0.1.43`, `@trybotster/terminal-protocol@0.3.0`.

| Marker | Result |
| --- | --- |
| `live-shared-session-cancel-ablation-passed` | `first_failure` = `expected exactly one detach for held subscription botster-web-terminal-88f52b0d-28cb-4bf2-bef9-84e5b2ba0d8a, got 0` |
| Ablation chronology | `cancel_detach_ablated`, `reader_cancel`, `detach: []`; no `hydration_progress_timeout` |
| Keep-alive | two `live-shared-session-keep-alive-passed`; each cancel `detach_count: 1` |
| `alternate_screen_exit` | `before_alt_screen: true`, `after_alt_screen: false` on keep-alive and exit passes |
| Exit | `live-shared-session-exit-passed` with `process_exit: true` |
| Coordinator | `keep_alive_runs=2`, `cancel_ablation=true`, `exit_pass=true` |
| Absent | IsolatedHub completion, `workspaces-shared-hub-browser-summary`, `shutdown_session` |

Two earlier coordinator attempts at `85ed927` died at Hub settings with `useMemo` and are not acceptance evidence.

Downstream: parent ticket reruns TUI `ghostty-shared`. This run did not execute that matrix.

## Unverified behavior or residual risk

- U1: whether Hub keeps the un-detached held subscription bound during ablation. Later keep-alive passes attached; no reservation rejection was printed.
- U2: primary-screen `botster-web-production-echo:keys` visibility is recorded, not required. Live `alternate_screen_exit` showed it true after exit.
- Host load during live lanes was high because of foreign Rails test workers. The required markers still printed.
- `snapshot_lost_recover` is not printed in live chronology after the collector change; the post-fix ablation path must not reach it, and the log contains zero copies of that kind.

## Missing vault guidance discovered

Captured to inbox (not promoted in this run):

- an ablation that skips teardown can satisfy the oracle from a later owner
- public cancel must disarm hydration recovery before the detach owner is ablated

[[web shared session keep alive leaves the producer on the alternate screen]] should later name `proveAlternateScreenExit` and the `alt-exit` producer arm as the Web fix location.
