# Verify report: show Hub-authored ended sessions and complete caller-owned alt-exited keep-alive

Ticket: `ticket_1788477497_716720`
Run: `run_1788477522_704573`
Step: `botster_stack_verify` / `run_step_1788481970_523459`
Parent integration ticket: `ticket_1787600679_990088`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1788477497_716720` |
| Verified commit | `bf56458` |
| Web base | `062e314` |
| Hub at live proof | `d7bd2c7`; `4d558e9` is an ancestor |
| Core lock | `72d1c75` |
| Teardown class | does not apply |
| Merge policy | direct; no pull request |

I resolved the target independently. `project_pipelines_current_context` returns `target_id`
`tgt_40abcf71ccf049f4ac0c99953a799869`. `git remote -v` in the run worktree returns
`git@github.com:trybotster/botster-web.git`.

## Playbooks and notes loaded

Role: [[verifier-playbook]], [[botster-verifier-playbook]].

Repository charter: [[botster-web-playbook]].

Surface overlay: [[botster-web-verifier-playbook]].

Overlays not loaded, with reasons:

- [[botster-runtime-verifier-playbook]] — no runtime, actor, lifecycle, PTY, or transport source changed. Teardown class does not apply.
- [[botster-package-verifier-playbook]] — no package, plugin, manifest, or capability path changed.
- [[botster-pipeline-verifier-playbook]] and [[project-pipelines-playbook]] — no Project Pipelines engine, schema, tool, prompt, or surface path changed.

Targeted notes:

- [[live lane evidence must postdate the last relevant source commit]]
- [[live lane arms need recorded host load and orphan cleanup]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[web shared session keep alive leaves the producer on the alternate screen]]
- [[source regex guards can mask behavioral ablations]]
- [[an ablation that skips teardown can satisfy the oracle from a later owner]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[duplicate React in the packaged Web bundle blocks every live browser lane]]
- [[botster web uses vanilla ionic primitives by default]]

Vault checklist: `checklist_1788483587_813047`.

## Commit and evidence freshness

`git diff --stat c19229b..HEAD` shows one file, `docs/reports/...-implement.md`. The two commits
after the recorded live commit change no source. I still reran both live lanes at `bf56458`, so
every live claim in this report belongs to the verified commit.

## Commands and results

Repository gates at `bf56458`, clean tree:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 0 errors, 5 pre-existing `react-refresh` warnings |
| `npm test` | 0 | daemon protocol drift check plus `src/App.test.mjs` |
| `npm run smoke:react-singleton` | 0 | `react-singleton-bundle-passed {"file":"index-BgMJFlyi.js","useMemoWrappers":1}` |

Live lanes at `bf56458`, Hub `d7bd2c7`, Core lock `72d1c75`:

| Command | Exit | Host load before | Host load after | Result |
| --- | --- | --- | --- | --- |
| `npm run smoke:live-packaged-protocol:durable` | 0 | `28.58 20.72 14.15` | `33.11 25.70 17.13` | `live packaged protocol harness passed (webrtc)`; post-detach siblings include `botster-web-durable-exited-1` through `-5` |
| `npm run smoke:live-packaged-protocol:shared-session` | 0 | `30.10 25.42 17.22` | `13.80 36.33 32.78` | `live-shared-session-coordinator-passed {"session_id":"north-star-shared","keep_alive_runs":2,"cancel_ablation":true,"exit_pass":true}` |

Negative controls, each restored afterward:

| Ablation | Command | Exit | First failure |
| --- | --- | --- | --- |
| `src/App.tsx` `endedSessions={endedSessions}` to `endedSessions={[]}`, one line | `npm run smoke:live-packaged-protocol:durable` | 1 | `locator.waitFor: Timeout 30000ms exceeded` waiting for `getByTestId('dashboard-ended-sessions').getByText('botster-web-durable-exited-1', { exact: true })` |
| removed the `*botster-web-production-alt-exit*)` arm from `productionSessionScriptSource`, one line | `npm run smoke:live-packaged-protocol:shared-session` | 1 | `producer contract mismatch: the supplied session producer answered botster-web-production-alt-exit with the fallthrough echo and did not leave the alternate screen; caller-owned producers must implement the README producer command contract` |

After restore: `git status --porcelain` empty, `git diff --check` exit 0, `npm test` exit 0,
`npm run typecheck` exit 0.

## Behavior and production path proved

Requirement 1, Hub-authored ended rows on Home:

- `src/App.tsx:217` reads one session entity list. `currentDashboardSessions` and
  `endedDashboardSessions` split it. `src/App.tsx:362` passes `endedSessions` to `DashboardView`.
- `src/app/dashboard.tsx:118` renders the `dashboard-ended-sessions` section only when a row exists.
  It passes `showActions={false}`, so ended rows carry no Stop control.
- `src/app/dashboardSessions.ts:17` filters `lifecycle_class === "ended"` only. It reads neither
  `lifecycle` nor `registry_state`, so Hub keeps lifecycle authority.
- The live durable lane proves the rendered path twice. `assertDurableSeededSessionsVisible`
  requires a `hub_frame` session record with `lifecycle_class: "ended"` for each of the five seeded
  ids, requires the row inside `dashboard-ended-sessions`, and requires zero matches inside the
  current `Sessions` list. `proveExternalSessionLifecycle` then spawns a live external session,
  shuts it down, and requires the same row to move into the ended section before removal.

Requirement 2, caller-owned alternate-screen exit:

- `proveAlternateScreenExit` in `scripts/live-packaged-protocol-harness.mjs:8136` polls decoded
  renderer writes through `classifyAltExitRendererWrites` and fails fast on producer drift.
- The live shared-session lane completes on the caller-owned `north-star-shared` session. Both
  keep-alive passes recorded `alternate_screen_exit` with `before_alt_screen: true`,
  `after_alt_screen: false`, and `keys_echo_visible_after_exit: true`. That satisfies
  [[web shared session keep alive leaves the producer on the alternate screen]]: the producer ends
  on the primary screen before a later TUI attach.
- The Hub-owned constraint held. `cancel_ablation` is `true` and the dedicated-channel cancel
  ablation still failed first at the Detach oracle, so the proof from `ticket_1788467459_333288` /
  `062e314` is preserved.

Ablation reachability, per [[live packaged harness failures are scoped to the active mode branch]]:
the deficient-producer arm ran in caller-owned shared-session mode, and
`rapid_alternate_screen_reattach` with `iterations:20` passed before the throw. The lane reached the
new branch. The generic 45-second message
`timed out waiting for mounted terminal renderer write botster-web-production-alt-exited` does not
appear in that log.

Neither ablation ran `npm test`, so the source-regex guards in `src/App.test.mjs` could not mask the
behavioral oracle. [[source regex guards can mask behavioral ablations]] is satisfied.

## Review findings

| Finding | Title | Status |
| --- | --- | --- |
| `finding_1788480901_772207` | Run the required current-only Home live negative control | Resolved and independently reproduced |
| `finding_1788480902_692896` | Execute the producer-mismatch branch through the production harness | Resolved and independently reproduced |

I did not accept the resolution text. I reran both concrete evidence commands myself and recorded the
exact first failure and exit status for each.

## Accepted deviation reviewed

`src/App.tsx` now passes the unfiltered session entity list to `HubSettingsRouteView`. That widens
the Diagnostics `Sessions` entity panel and the `LocalHubFirstScreen` session summary to include
ended rows. I inspected both consumers. `LocalHubFirstScreen` chooses its attach candidate with
`isAttachableSession`, which requires `lifecycle_class === "current"`, so ended rows cannot become
attachable and no Stop path changes. A raw entity diagnostics panel that shows the raw entity list
matches its stated purpose. The deviation is recorded in the plan and the implementation report.

## Cross-repository consumer proof

Web is the browser consumer of Hub-authored `lifecycle_class`. The live lanes ran against the real
Hub binary at `d7bd2c7` with Core lock `72d1c75`, not a fixture. `git merge-base --is-ancestor
4d558e9 d7bd2c7` confirms the Hub candidate that authors persisted `ended` rows is present.

Web changed no public DTO, no generated contract, and no Hub, Core, TUI, or `botster-hub-client`
source. Package pins stay `@trybotster/hub-test-support` `0.1.43`, `@trybotster/ui-contract` `0.3.3`,
`@trybotster/terminal-protocol` `0.3.0`. No downstream repository needs a matching change for this
ticket.

## Unverified behavior

- Hub `script/prove-north-star-shared-session` did not run here. The Hub `PRODUCER_SCRIPT` repair and
  the complete north-star rerun belong to `ticket_1787600679_990088` after this merge, per human
  answer `question_1788478164_365550`.
- TUI `ghostty-shared` and its `NORTH_STAR_HISTORY` assertion did not run here. Same owner.
- `npm run smoke:live-packaged-protocol` (IsolatedHub `web-prod`) was not rerun during Verify. The
  Implementer ran it green at `c19229b`, and the durable lane at `bf56458` exercises the same Home
  render path against a live Hub.
- Rows with `lifecycle_class: "indeterminate"` stay hidden from both Home sections. This is the
  accepted plan assumption. No live lane produces such a row, so the behavior is proved by unit test
  only.
- The ended section has no sorting, pagination, or cap. That was explicit non-scope.

## Remaining risk

- Each live lane ran once at `bf56458`. There is no consecutive-green streak for this commit. Host
  load was high during the arms (one-minute average between 2.7 and 33), and the lanes still passed.
- Two orphaned `botster-session-worker` processes from the parent Hub worktree remained after the
  failing ablation arms. They are reparented to PID 1 with their own temporary socket directories. I
  left them running rather than risk stopping another active session's work. They add host
  contention for later runs.
- The ended section grows without bound as Hub accumulates persisted ended rows. A Hub with many
  ended sessions will render a long Home list.
- `classifyAltExitRendererWrites` joins renderer write chunks with no separator, which is correct for
  split chunks. A future producer whose output places `ed` immediately after a truncated
  `...alt-exit` chunk could classify as `exited`. The live evidence shows no such case.

## Vault gaps worth capturing

- Convention, deferred: Web Home renders Hub-authored `ended` rows in a separate non-attachable
  section and never infers lifecycle. The shape held through Review and Verify. Capture with the
  integration merge, because that ticket may still adjust the cross-client handoff.
- Gotcha, deferred: a copied caller-owned producer script drifts from the owning client's producer
  contract. Capture after the integration ticket confirms the Hub producer repair shape.
- Gotcha candidate, new and proposed: for a client-side producer-contract diagnostic, the valid
  negative control removes the producer arm, not the client enforcement branch. This complements
  [[an ablation that skips teardown can satisfy the oracle from a later owner]]. Capture only if the
  pattern repeats.
