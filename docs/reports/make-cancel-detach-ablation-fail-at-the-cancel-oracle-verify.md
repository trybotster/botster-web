# Verify report: make BOTSTER_LIVE_ABLATE_CANCEL_DETACH fail at the cancel oracle

Ticket: `ticket_1788467459_333288`
Run: `run_1788467924_677099`
Step: `botster_stack_verify` / `run_step_1788473341_547799`
Verify vault checklist: `checklist_1788474134_355036`

## Independently resolved target

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1788467459_333288` |
| Verified commit | `946fded` (clean working tree) |
| Base | `e5573a2` |
| Hub used for live proof | worktree `ticket_1787600679_990088` at `4d558e9`, clean tree |
| Teardown class | applies, narrow |

`project_pipelines_current_context` maps `target_id` to `botster-web`. I did not use the ambient
directory to route.

## Playbooks and notes loaded

Role and charter:

- [[verifier-playbook]]
- [[botster-verifier-playbook]]
- [[botster-web-playbook]]
- [[botster-web-verifier-playbook]] (Ionic React / browser / Restty overlay)
- [[botster runtime teardown lenses]]

Not loaded, with reason:

- [[botster-pipeline-verifier-playbook]] and [[project-pipelines-playbook]]: the diff touches no
  Project Pipelines engine, schema, tool, prompt, or surface path.
- [[botster-package-verifier-playbook]]: no package, plugin, manifest, or capability change.

Targeted notes:

- [[an ablation that skips teardown can satisfy the oracle from a later owner]]
- [[public cancel must disarm hydration recovery before the Detach decision]]
- [[in-flight cancel needs one Web Detach owner]]
- [[web shared session keep alive leaves the producer on the alternate screen]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[live lane evidence must postdate the last relevant source commit]]
- [[live lane arms need recorded host load and orphan cleanup]]
- [[live packaged harness failures are scoped to the active mode branch]]

## Commands and results

All commands ran from the run worktree at `946fded` with a clean tree.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 0 errors, 5 pre-existing `react-refresh` warnings |
| `npm test` | 0 | drift check plus `src/App.test.mjs` pass |
| `npm run smoke:react-singleton` | 0 | `react-singleton-bundle-passed {"file":"index-DpaCJII1.js","useMemoWrappers":1}` |
| `npm run smoke:browser-runtime` | 0 | `browser runtime interaction smoke passed` |
| `npm run smoke:live-packaged-protocol:shared-session` | 0 | `live-shared-session-coordinator-passed {"session_id":"north-star-shared","keep_alive_runs":2,"cancel_ablation":true,"exit_pass":true}` |

Live lane environment:

```sh
BOTSTER_HUB_BIN=<hub worktree 4d558e9>/target/debug/botster-hub
BOTSTER_SESSION_WORKER_BIN=<hub worktree 4d558e9>/target/debug/botster-session-worker
npm run smoke:live-packaged-protocol:shared-session
```

Hub identity in the run: protocol `botster-hub-daemon-v1` version 8, conformance fixture
revision 48, schema version 3.

Host load before: `6.00 10.47 17.65`. After: `4.32 9.00 14.20`. After the run no lane-owned
`botster-session-worker` and no `/tmp/botster-web-shared-session-*` directory remained. Foreign
session-workers `14620`, `15125`, `51084`, and `89334` belong to other worktrees. I did not kill
them.

## Behavior proved, with the production path

### 1. The ablation now fails for the intended cancel reason

Coordinator marker:

```
live-shared-session-cancel-ablation-passed {"session_id":"north-star-shared","exit_code":1,
 "first_failure":"expected exactly one detach for held subscription
 botster-web-terminal-357333da-8d1a-4bdd-a9f6-ddb73aa5dc30, got 0"}
```

Held-subscription chronology from the same failure:

```
snapshot_install_held -> cancel_detach_ablated -> reader_cancel ; detach: []
```

The complete run log contains zero `hydration_progress_timeout` records and zero
`snapshot_lost_recover` records. No later owner emitted the Detach that the ablated public cancel
skipped. This is the exact defect shape described in
[[an ablation that skips teardown can satisfy the oracle from a later owner]].

Production path: Home unmount -> `DefaultTerminalViewBridge.unmount` ->
`HubTerminalDataPlane.detach()`. The ablation changes only whether `sendDetachRequestOnce` runs.
`closeStreamWithoutDetachRequest()` still cancels the snapshot reader, clears
`hydration.progressTimeout`, and advances `attachmentGeneration`.

### 2. Normal cancel still sends exactly one Detach

Three `live-shared-session-cancel-passed` markers, one per non-ablated driver run, each with
`detach_count: 1` and one `daemon_request` `detach` for the held subscription id.

### 3. The producer returns to the primary screen before the keep-alive marker

`proveAlternateScreenExit` runs at `scripts/live-packaged-protocol-harness.mjs:509`, after
`proveRapidAlternateScreenReattach` at line 508 and before both
`live-shared-session-keep-alive-passed` (line 535) and `proveSharedSessionExit` (line 533).

Each of the four driver runs recorded:

```
alternate_screen_exit {"before_alt_screen":true,"after_alt_screen":false,
 "last_alt_final_row":"alt-19-...-final-row-40","keys_echo_visible_after_exit":true}
```

The oracle is a live Hub `read_mode_flags` transition, not a source shape. It throws when
`before_alt_screen` is not `true`, so it cannot pass vacuously. It also requires the last
alternate-screen row to be gone and `botster-web-production-alt-exited` to be visible on the
primary screen.

### 4. Keep-alive and exit lanes stay intact

Two `live-shared-session-keep-alive-passed` markers for `north-star-shared`, then
`live-shared-session-exit-passed {"process_exit":true,"entity_lifecycle":"exited",...}`. No
`shutdown_session`, no IsolatedHub completion path, no Workspaces early-exit path.

## Red-on-revert controls I ran myself

| Ablation | Command | Failure |
| --- | --- | --- |
| Restore the early return in `detach()` before `closeStreamWithoutDetachRequest()` | `npm test` | `AssertionError: ablated cancel emitted detach: [...]` actual `1`, expected `0` |
| Remove `resolve.dedupe` from `vite.config.ts` | `npm run smoke:react-singleton` | `expected one React useMemo wrapper in index-ofc4pE3e.js after resolve.dedupe, got 2` |

I restored both files with `git checkout --` and re-ran `npm run build`. The tree is clean.

## Review findings status

- `finding_1788468768_812636` (rebase onto current main): resolved. `git merge-base` base
  `e5573a2` is the branch base and `HEAD` is `946fded`.
- `finding_1788468768_264942` (reachable ordered root-cause evidence): resolved. The live
  chronology collector prints the ordered held-subscription records in both the failing ablation
  and the passing cancel marker.
- `finding_1788468768_173149` (Plan completion evidence): waived at Plan Review, process-only.
- Review `review_1788473309_644482` approved with no findings. Review `review_1788473301_878778`
  carries verdict `changes_required` with the same approval summary and no findings; I read it as
  a superseded duplicate submission, not an open objection.

No new findings.

## Ownership and scope

Only `botster-web` files changed. No Hub, Core, TUI, or `botster-hub-client` edit. The dedicated
DataChannel subscription path is untouched, and no dual terminal route returned. No second Web
persistence path and no durable dashboard restore. The Vite `resolve.dedupe` deviation and the
`smoke:react-singleton` guard are authorized by `question_1788471014_552139`.

## Cross-repository consumer proof

The Hub consumer is real: the live lane ran against the parent worktree Hub at `4d558e9` through
the packaged WebRTC path, and Hub accepted the reservation, admission Hello, terminal
subscription, `read_mode_flags`, `read_screen`, and Detach for every run.

The TUI consumer is not proved here. The ticket assigns the `ghostty-shared` rerun to parent
integration ticket `ticket_1787600679_990088` after merge. I did not run the TUI matrix.

## Unverified behavior

- U1: TUI `ghostty-shared` `NORTH_STAR_HISTORY` after a late attach. Web now leaves the session on
  the primary screen, which is the required precondition, but the TUI leg is parent-ticket work.
- U2: I did not ablate the `botster-web-production-alt-exit` producer arm in a live run. The
  before/after `alt_screen` transition is direct positive evidence, and the harness throws when
  the flag does not flip, so the oracle is load-bearing. A producer-arm ablation would cost one
  more full coordinator run.
- U3: whether Hub keeps the un-detached held subscription bound during the ablation. Later
  keep-alive passes attached with no reservation rejection, so no leak surfaced.
- U4: single live series. I ran the coordinator once at `946fded`, exit 0. I do not claim a
  consecutive-green streak.

## Remaining risk

- `scripts/check-react-singleton-bundle.mjs` keys on the minified `.useMemo=function` shape and on
  exactly one `dist/assets/index-*.js`. A React or bundler change can make it fail for the wrong
  reason. It fails loudly, so it cannot go silent.
- `detachSentFor` assignment inside the ablation branch is harness-only code in production source.
  It is guarded by `liveHarness()?.ablateCancelDetach`, which matches the existing pattern in this
  file.
- Host load was high during the live run because of foreign workers. Every required marker still
  printed.

## Vault gaps

- Captured to inbox:
  `~/knowledge/inbox/duplicate-react-in-the-packaged-web-bundle-kills-every-live-browser-lane.md`.
- [[web shared session keep alive leaves the producer on the alternate screen]] should name
  `proveAlternateScreenExit` and the `botster-web-production-alt-exit` producer arm as the Web fix
  location.
