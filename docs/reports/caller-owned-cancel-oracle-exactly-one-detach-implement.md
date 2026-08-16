# Implement report: caller-owned cancel oracle reports exactly one detach

Ticket: `ticket_1786912123_916503`
Run: `run_1786914339_154671`
Step: `botster_stack_implement` / `run_step_1786915626_597589`
Plan: `docs/plans/caller-owned-cancel-oracle-exactly-one-detach.md` revision 2 (`artifact_1786915342_247683`)

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Branch | `project-pipelines/ticket_1786912123_916503` |
| Web base | `ebb6677902ff5920ebb75685a74bba30b9b81b87` |
| Hub at live proof | `c72712e2606b8abe77e1b91c2a736791036fadd8` |
| Session worker at live proof | Hub-tree debug `botster-session-worker` paired with that Hub |
| Lockfile Core pin | `fc541a59338d0591ba4fb3fa522a030d212d26d0` (not used as live worker; spawn pairing follows prior Web ticket) |
| Session id | `north-star-shared` |
| Teardown class | yes |
| Merge policy | direct into `main`; no pull request |

Independent `project_pipelines_current_context` for `run_1786914339_154671` maps `target_id` to `trybotster/botster-web`. The approved plan used the same routing.

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
- [[identity]]
- [[goals]]

Not loaded: [[project-pipelines-playbook]] — Project Pipelines package/plugin paths are out of scope.

Targeted notes:

- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[canceling incremental attach aborts the decoder and sends Detach]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[mounted browser terminal attach is idempotent by attachment identity]]
- [[incremental GHOSTSNP uses one decoder per subscription]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[Web terminal drain awaits each event consumer]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[terminal subscription lifecycle is Core owned while host session policy is Hub owned]]
- [[cleanup_webrtc_channel double-fires from concurrent callers]]
- [[terminal session switches must cancel in-flight webrtc pty connects]]
- [[botster webrtc request consumers should use operation gates not connection checks]]
- [[a page reload is not a reconnect]]
- [[WebRTC DataChannel local close uses the peer close bound before cleanup]]
- [[webrtc peer cleanup removes every per peer owner together]]
- [[late webrtc messages after disconnect must not recreate clients]]
- [[hub qualifies effective session type ids as source name slash id]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[first-party clients put terminal mechanism tokens only in terminal compatibility]]
- [[ready then history is a compatibility feature not an Attach field]]

## Files changed

- `src/botster/hubTerminalDataPlane.ts` — one Detach owner (`sendDetachRequestOnce`); `DETACH_REQUEST_BOUND_MS=10000`; hang `Promise.race`; stop `detached` resurrection; stop once-flag clear on a detached id; stale attach uses `abandon`; transport recovery uses the same owner
- `src/App.test.mjs` — in-flight hold + detach; last-listener then detach (request owner); stale attach; no-resurrect; remount new id; never-resolving hang; reattach uses a new plane
- `docs/plans/caller-owned-cancel-oracle-exactly-one-detach.md` — already on branch (Plan rev 2)
- `docs/reports/caller-owned-cancel-oracle-exactly-one-detach-implement.md` — this report

## Ownership boundaries preserved

This run stayed in `botster-web`. It did not edit Hub, Core, TUI, or `botster-hub-client`. Hub Detach remains idempotent. IsolatedHub shared helpers were not changed. Caller-owned keep-alive still forbids `ShutdownSession`.

## Cross-repo dependencies or separately routed work

None opened. Parent Hub ticket `ticket_1786661010_115885` already depends on this Web ticket for authentic same-session proof.

## Deviations from plan

1. Live proof used Hub-tree debug `botster-session-worker` with Hub `c72712e`, not the lockfile Core `fc541a5` worker binary, matching the prior Web caller-owned ticket spawn pairing.
2. The post-detach reattach unit path now creates a new `HubTerminalDataPlane` instead of resurrecting a publicly detached plane via `subscribeOutput`. That matches the plan's no-resurrect rule.
3. Last-listener Detach is now a data-plane `request` Detach when `abandon` exists (production shape). Stream `unsubscribe` remains the fallback emitter only for older bridges without `abandon`.
4. Merge to `main` waits for Review/Verify. Implement commits on the ticket branch and does not create a PR.

## Runtime-teardown lenses implemented

| Lens | Implementation |
| --- | --- |
| Isolation | One cancel unmount retires this client's subscription, decoder, and mount. Peer, sibling flood sessions, and supplied host session stay up. |
| Bounds | `HubTerminalDataPlane.detach()` races the single detach request against `DETACH_REQUEST_BOUND_MS` (10_000; test hook may shorten). Timeout is failure; once-flag stays set; unmount `finally` still destroys and deletes. |
| Late-message matrix | Attach/Detach/stream listener/resize/input covered. Stale attach abandons without a second Detach. Recovery remints id and stale-detaches through the once-owner. Keep-alive forbids `shutdown_session`. |
| Production-path proof | Home unmount → `DefaultTerminalViewBridge.unmount` → `HubTerminalDataPlane.detach` → one `daemon_request` detach → decoder abort → remount new `subscription_id`. Hang unit uses never-resolving request + 25 ms bound. Live oracle: two consecutive shared-session coordinators. |
| Ownership identity | Cancel remount requires a new `subscription_id`. Once-flag is per subscription id and is not cleared for an id that already sent Detach. |
| Sibling fail-closed | Hang and reject paths keep a sibling plane attached; session stays up; no sibling sacrifice. |

## Tests and downstream proof run

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

All four exit 0. Lint still reports only pre-existing `react-refresh/only-export-components` warnings.

Fail-closed driver:

- missing identifiers → exit 1
- session id only → exit 1
- data dir only → exit 1
- `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` + `BOTSTER_SHARED_SESSION_ID` → exit 1

Live caller-owned proof (twice):

```sh
BOTSTER_HUB_BIN=<hub debug at c72712e> \
BOTSTER_SESSION_WORKER_BIN=<matching hub-tree debug session-worker> \
npm run smoke:live-packaged-protocol:shared-session
# second run: node scripts/live-shared-session-coordinator.mjs
```

| Run | Exit | Elapsed | Ablation first failure | Cancel markers |
| --- | --- | --- | --- | --- |
| 1 | 0 | ~952s | `got 0` | three `live-shared-session-cancel-passed` with `detach_count: 1` |
| 2 | 0 | ~763s | `got 0` | three `live-shared-session-cancel-passed` with `detach_count: 1` |

Both runs printed:

- `live-shared-session-cancel-ablation-passed` with first failure `got 0`
- two `live-shared-session-keep-alive-passed`
- `live-shared-session-exit-passed`
- `live-shared-session-coordinator-passed` with `keep_alive_runs: 2`, `cancel_ablation: true`, `exit_pass: true`
- session-type live proof and Option A picker on ablation and later passes
- no IsolatedHub `web-prod` completion string
- no Workspaces early-exit summary

`conformance_fixture_revision` observed: 43.

## Unverified behavior or residual risk

- Vite preview remount timing during hold was not separately instrumented beyond the live oracle.
- Transport recovery during the exact cancel hold window was not forced in unit tests; recovery still uses the once-owner.
- Parent Hub authentic same-session coordinator remains for `ticket_1786661010_115885` after this merge.

## Missing vault guidance discovered

Captured inbox note: in-flight cancel can emit 0 or 2 Web Detaches when stream `unsubscribe` and public `detach()` are separate owners, and when `subscribeOutput` or a new attach clears the once-flag. Path: `~/knowledge/inbox/in-flight-cancel-needs-one-web-detach-owner.md`.
