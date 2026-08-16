# Implement report: Detach the session terminal when the session entity is exited

Ticket: `ticket_1786848959_308437`
Run: `run_1786848964_511286`
Step: `botster_stack_implement` / `run_step_1786851545_429190`
Plan: `docs/plans/detach-session-terminal-when-session-entity-exited.md`

## Review return

Review `review_1786851532_276855` sent Implement back after `6f68632`. Three findings:

| Finding | Response |
| --- | --- |
| `finding_1786851532_802262` Live proof does not isolate entity-driven detach | Default live sequence now requires the Hub session row `lifecycle` `exited` or `failed`, records entity versus `process_exit` order, and fails if `exitedObserved` is true or if `process_exit` precedes the entity event. Both consecutive runs isolated `web-prod` with `lifecycle=exited`, `processExitEventCount=0`, and `exitedObserved=false`. After detach, the same peer answered `status` and two sibling sessions remained. Route tests now record production-shaped bridge `unmount`/`detach` and data-plane `detach`. |
| `finding_1786851532_659166` Committed plan leaks a local absolute home path | Replaced the spawn-target home path with a path-neutral phrase. The plan no longer contains a local home path. |
| `finding_1786851532_140594` New route harness fails lint | Removed unused parameter names. `eslint --quiet` on the new TypeScript files reports zero errors. Full lint still reports two pre-existing `no-useless-assignment` errors in `scripts/live-packaged-protocol-harness.mjs` at lines 6907 and 6925 from base `8c87c35`. Those lines are unchanged on this branch. |

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` |
| Branch | `project-pipelines/ticket_1786848959_308437` |
| Web base | `8c87c35bf6cbe6752b57fff364a98f3a128a6afb` |
| Hub candidate at proof | `bee15e7a0404a588bb3c368232e778a180c0f399` (`23440a4` is an ancestor) |
| Core pin | `fc541a59338d0591ba4fb3fa522a030d212d26d0` |
| Teardown class | yes |
| Merge policy | direct into `main`; no PR |

Independent `list_spawn_targets` maps `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. The approved plan used the same routing.

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

Planner must-loads and current modular transport notes:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[botster data plane bypasses the hub through session and client actors]]
- [[botster terminal clients share one sessionio data plane subscription path]]
- [[acceptance readiness requires the exact expected entity not any authoritative snapshot]]
- [[botster web dto field names must match authoritative rust serde structs]]

Targeted atomic notes:

- [[observe-first attached Drain can return SessionLifecycle without ProcessExit]]
- [[Hub session projection continues without subscribers or terminal Drain]]
- [[botster hub client state sync is entity frame only]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[terminal webrtc failure records do not prove peer runtime teardown]]
- [[webrtc peer cleanup removes every per peer owner together]]
- [[graceful-termination-requires-explicit-cleanup-hooks]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[Web terminal drain awaits each event consumer]]
- [[botster web hub frame entity snapshots omit subscription identity]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[cross repo dependency registration must use dependency repo target]]

Not loaded: [[project-pipelines-playbook]]. This visit did not change Project Pipelines package or plugin paths.

Convention conflicts: none.

## Files changed

- `src/botster/terminalSession.ts` — add `sessionEntityRequiresDetach` for Hub `lifecycle` values `exited` and `failed`; add `isMountedSessionRoute` so both App and tests share the mounted-id guard
- `src/app/useSessionEntityDetach.ts` — production detach effect used by App
- `src/App.tsx` — read the mounted session from `runtimeClient.entities.get("session", routeSessionId)` and call `releaseTerminalSession` when that record requires detach; keep `onExit={releaseTerminalSession}`
- `src/app/__fixtures__/sessionRouteDetachHarness.tsx` — focused `createRoot` harness that uses the production detach helpers and records a teardown ledger
- `src/App.test.mjs` — predicate coverage, App wiring regexes, route-state races, teardown-ledger assertions, and isolation-helper unit tests
- `scripts/live-packaged-protocol-helpers.mjs` — `sessionDetachIsolationProof` decision
- `scripts/live-packaged-protocol-harness.mjs` — entity-driven detach isolation, post-detach peer/sibling proof, and binary `git_head` provenance
- `docs/plans/detach-session-terminal-when-session-entity-exited.md` — approved plan, path-neutral spawn-target wording, and Review-required isolation acceptance
- `docs/reports/implement-detach-session-terminal-when-session-entity-exited.md` — this report

## Ownership boundaries preserved

| Surface | Owner | This visit |
| --- | --- | --- |
| Ionic session route, `releaseTerminalSession`, subscribed session-entity detach | botster-web | Implemented |
| `HubTerminalDataPlane` `process_exit` to status `exited` | botster-web | Kept as a valid second path |
| Restty mount and unmount | botster-web renderer integration | Existing unmount on route change |
| Session entity `lifecycle` publication | botster-hub | Consumed only |
| `observe_session_lifecycle` and adapter `process_exit` | botster-hub / botster-core | Not edited |

No Hub, Core, or TUI files were edited.

## Cross-repo dependencies or separately routed work

The parent Hub ticket already depends on this Web ticket through `dependency_1786848962_964959`. This visit did not register a new cross-repo ticket.

Live proof used parent Hub worktree HEAD `bee15e7`. That candidate published `lifecycle` values that allowed `waitForTerminalDetached` to pass. No Hub follow-up ticket was required.

## Deviations from plan

- Parent Hub SHA at proof time is `bee15e7`, not finding-time `23440a4`. The plan required recording the SHA that actually ran. `23440a4` is an ancestor of `bee15e7`.
- The App detach watch lives in `useSessionEntityDetach`, which App calls. This keeps one detach policy for App and the route-state harness. It is not a product-scope change.
- This Implement visit commits to the ticket branch and does not merge to `main`. The pipeline merge policy remains direct. Review still has to run. No pull request was opened.
- Review `review_1786851532_276855` required a discriminating live isolation oracle and a production-shaped teardown ledger. The committed plan acceptance checks now require those proofs.

## Runtime-teardown lenses

Every lens from [[botster runtime teardown lenses]] is implemented. None was dropped to follow-up.

| Lens | Implementation |
| --- | --- |
| Isolation | Detach owns one mounted route session id and its TerminalViewHost. Session A events do not unmount session B. |
| Bounds | `releaseTerminalSession` is a route change. Unmount already unsubscribes and calls `bridge.unmount`. `waitForTerminalDetached` stays at 15 seconds. No `block_on` or extra drain wait. |
| Late-message matrix | `entity_patch` / `entity_upsert` with `lifecycle` `exited` or `failed` detaches the mounted id. `entity_remove`, empty snapshot, and missing row do not detach. Late A entity or `process_exit` after B mounts is a no-op. Terminal-plane `process_exit` remains a valid first or late path for the mounted id. |
| Production-path proof | Two consecutive default-mode `npm run smoke:live-packaged-protocol` runs passed `waitForTerminalDetached` after `botster-web-production-exit` and `ShutdownSession`, then isolated entity-driven detach: Hub row `lifecycle=exited`, no `process_exit`, `exitedObserved=false`. |
| Ownership identity | Web detaches by mounted route `sessionId`. Terminal-plane ownership stays on the host generation. |
| Sibling and fail-closed | After A detaches, sibling session C and a held `session_type` family remain in route tests. Live proof then issued a same-peer `status` request and observed two remaining sibling sessions. The peer is not closed. On detach failure the 15-second oracle fails the harness; siblings stay up. |

## Tests and downstream proof run

Charter gates:

- `npm run typecheck` — pass
- `npm test` — pass
- `npm run build` — pass, as part of each live smoke
- `eslint --quiet` on new TypeScript files — zero errors
- Full `npm run lint` — two pre-existing harness `no-useless-assignment` errors on unchanged base lines 6907 and 6925

Route-state `createRoot` + `act` tests prove:

1. Mounted A plus entity `exited` navigates home and removes A's host
2. Mounted A plus terminal-plane `process_exit` navigates home and removes A's host
3. The second A event after the first detach is a no-op
4. After navigate A to B, late A `exited` and late A `process_exit` leave B mounted
5. `entity_remove` of mounted A does not detach A
6. After A detaches, sibling session C and `session_type` `type-shell` remain

Required live pair, default harness mode `webrtc`, not the shared-Hub shim:

```bash
BOTSTER_HUB_BIN=<hub-candidate-bee15e7> \
BOTSTER_SESSION_WORKER_BIN=<core-fc541a59-session-worker> \
npm run smoke:live-packaged-protocol
```

| Run | Exit | Alternate-screen cycle 0 | Detach isolation |
| --- | --- | --- | --- |
| 1 | 0 | `cycle_0_final_row_present=true`, 20 cycles | `lifecycle=exited`, `processExitEventCount=0`, `exitedObserved=false`, same-peer `status`, 2 sibling sessions |
| 2 | 0 | `cycle_0_final_row_present=true`, 20 cycles | `lifecycle=exited`, `processExitEventCount=0`, `exitedObserved=false`, same-peer `status`, 2 sibling sessions |

Recorded SHAs:

- Harness mode: default `webrtc`
- Hub: `bee15e7a0404a588bb3c368232e778a180c0f399`
- Core: `fc541a59338d0591ba4fb3fa522a030d212d26d0`
- Web base: `8c87c35bf6cbe6752b57fff364a98f3a128a6afb`

## Unverified behavior or residual risk

- The live pair now inspects the Hub session row and the raw `entity_patch` order. It does not mount two first-party Restty hosts at once. Multi-session race coverage remains in the route-state tests.
- Live `session_type` rows are empty after the harness session-type CRUD cleanup. Sibling proof on the live pair uses remaining session rows plus a same-peer `status` request.
- `local WebRTC data channel close failed: data channel closed` still appears during harness teardown. That is existing peer-close noise, not this detach path.

## Missing vault guidance discovered

No current Web-owned note stated that a first-party client must detach when the subscribed session entity is `exited` or `failed`. After the live pair passed, that claim was captured to the vault inbox as `web-detaches-the-mounted-terminal-when-the-session-entity-is-exited.md`. Candidate title matches the plan: `Web detaches the mounted terminal when the session entity is exited`.
