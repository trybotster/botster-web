# Implement report: Run packaged-protocol terminal lane on a caller-owned Hub session

Ticket: `ticket_1786868596_331812`
Run: `run_1786868607_597988`
Step: `botster_stack_implement` / `run_step_1786901647_697653`
Plan: `docs/plans/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session.md` revision 4
Product decision: `question_1786868962_323590` option **C**

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Branch | `project-pipelines/ticket_1786868596_331812` |
| Web base | `30d961cd78154ad95477c46cb9410b4b8edae48f` |
| Hub at live proof | `c72712e2606b8abe77e1b91c2a736791036fadd8` (descendant of `60b79b8`) |
| Session worker at live proof | Hub-tree debug `botster-session-worker` paired with that Hub |
| Lockfile Core pin | `fc541a59338d0591ba4fb3fa522a030d212d26d0` |
| Session id | `north-star-shared` |
| Teardown class | yes |
| Merge policy | direct into `main`; no PR |

Independent `project_pipelines_current_context` ticket/run `target_id` maps to `trybotster/botster-web`. The approved plan used the same routing.

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

Not loaded: [[project-pipelines-playbook]] — Project Pipelines package/plugin paths and workflow-policy implementation are out of scope.

Targeted notes:

- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[a page reload is not a reconnect]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[observe-first attached Drain can return SessionLifecycle without ProcessExit]]
- [[canceling incremental attach aborts the decoder and sends Detach]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]

## Files changed

- `docs/plans/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session.md`
- `scripts/live-packaged-protocol-harness.mjs`
- `scripts/live-packaged-protocol-helpers.mjs`
- `scripts/live-shared-session-browser-driver.mjs`
- `scripts/live-shared-session-coordinator.mjs`
- `package.json`
- `README.md`
- `src/App.test.mjs`
- `src/botster/hubTerminalDataPlane.ts`
- `src/botster/terminal.ts`
- `src/botster/TerminalViewHost.tsx`
- `docs/reports/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session-implement.md`

## Ownership boundaries preserved

This run stayed in `botster-web`. It did not edit Hub, TUI, or Core. IsolatedHub `web-prod` remains the default `smoke:live-packaged-protocol` path. `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` still early-exits after Workspaces and is refused when combined with `BOTSTER_SHARED_SESSION_ID`.

## Cross-repo dependencies or separately routed work

None opened. Parent Hub ticket already depends on this Web target. A first live attempt pairing Hub `c72712e` with the lockfile Core `fc541a5` worker failed at shared-session spawn (`spawn_failed` before start). The successful coordinator used the Hub tree's matching debug session-worker. No Hub or Core ticket was opened.

## Review return

Review `review_1786874869_811589` sent Implement back after `77d39c7`. Two findings:

| Finding | Response |
| --- | --- |
| `finding_1786874869_948891` Cancellation accepts two Detach requests | Resolved on `71d5ee9` for the mounted unmount path: `detach_count === 1`. The last-listener abandon used to get that count created `finding_1786899753_286268`. |
| `finding_1786874869_927008` Cancellation ablation has no valid result | The coordinator now runs `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1` first, through session types and the Option A picker. That pass exits 1 at `expected exactly one detach ... got 0`. Marker: `live-shared-session-cancel-ablation-passed`. |

Review `review_1786899753_646191` sent Implement back after `71d5ee9`:

| Finding | Response |
| --- | --- |
| `finding_1786899753_286268` Last output unsubscribe no longer releases the server subscription | Last output listener calls `closeStream()` again, so WebRTC `stream.unsubscribe()` sends Detach. `DefaultTerminalViewBridge.detach` now stops input, calls `dataPlane.detach()` once, then releases renderer/output subscriptions after the plane has cleared the stream. Unit test `last-listener-one-detach` expects exactly one stream Detach and no later request. Unit test `bridge-unmount-one-detach` expects exactly one request Detach and no stream Detach. |

Review `review_1786900496_133407` sent Implement back after `3a683df`:

| Finding | Response |
| --- | --- |
| `finding_1786900496_948548` Sequential public cleanup can send two Detach requests | `closeStream()` records `detachSentForSubscriptionId`. Later `detach()` still clears listeners, status, and the lifecycle listener, but skips a second request for that subscription. A new attach clears the mark. Unit `last-listener-one-detach` now unsubscribes, then `detach()` twice, and still records one stream Detach. |
| `finding_1786900496_305971` A rejected Detach request stops local view cleanup | `DefaultTerminalViewBridge.detach` and `unmount` use `finally` so the data-plane reference, output subscriptions, renderer, and mount map are released after a rejected Detach. Fire-and-forget `TerminalViewHost` unmounts catch the rejection. Unit `bridge-unmount-reject-cleanup` proves one request Detach, output unsubscribe, renderer destroy, mount removal, and no second Detach. |
| `finding_1786900496_203307` The changed production unmount order has no live proof | Re-ran the complete shared-session coordinator after these teardown fixes. Exit 0 in 577s. Ablation first failure `got 0`. Two keep-alives and the exit pass each record `detach_count: 1`. |

Review `review_1786901636_166708` sent Implement back after `68a1126`:

| Finding | Response |
| --- | --- |
| `finding_1786901636_894520` Renderer destruction failure leaves the mount registered | `unmount` now records a Detach error, destroys the renderer, and deletes the mount in a nested `finally`. If both fail, the Detach error is thrown. Unit `bridge-unmount-destroy-reject` rejects with the Detach error, deletes the mount (later unmount is a no-op), records one Detach, and remounts a later generation that can unmount again. |

## Deviations from plan

1. Opt-in exit pass uses `proveSharedSessionExitDetach` instead of IsolatedHub `proveEntityDrivenProductionDetach`. Producer exit delivers `process_exit` before the session-entity patch. That is a valid first-arriving detach path. IsolatedHub entity-only isolation is unchanged.
2. Shared session remounts after `proveExternalSessionLifecycle` because reload cycles 1 and 2 are skipped. IsolatedHub remounts inside those cycles.
3. Exclusive IsolatedHub modes (`BOTSTER_LIVE_SURFACE_ONLY`, contract matrix, entity-options, Workspaces lifecycle, durable, require-workspaces) fail closed with this lane so they cannot `requestDaemonShutdown` the caller Hub.
4. Merge to `main` waits for Review/Verify. Implement commits on the ticket branch and does not create a PR.
5. Live coordinator on this return used the Hub-tree debug session-worker with Hub `c72712e`. The lockfile Core `fc541a5` worker failed spawn against that Hub.

## Runtime-teardown lenses implemented

| Lens | Implementation |
| --- | --- |
| Isolation | DataChannel close / Detach retires this client's subscription and decoder. Default path keeps `north-star-shared` running. Sibling flood sessions stay independent. Opt-in exit ends only the supplied session; the coordinator Hub stays up until coordinator shutdown. |
| Bounds | Snapshot hold is released in `finally`. Driver does not `block_on` Hub close. Coordinator bounds Hub shutdown. Missing `local_url` / HTML shell fails closed after a 15s retry. |
| Late-message matrix | Attach/Detach/Hello/input/resize stay on the production DataPlane. Default path forbids `shutdown_session` for the supplied id. Detach is idempotent on one plane. Late Home unmount cannot `ShutdownSession`. |
| Production-path proof | Cancel: Home unmount → `armSnapshotInstallHold` → remount → new `snapshot_install_held` → Home → `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount` (nested `finally` always deletes the mount; Detach error wins if destroy also fails) → stop input → `HubTerminalDataPlane.detach` (one request Detach + decoder cancel, even if the request rejects) → then release output subscriptions. Standalone last-listener `unsubscribe` uses `closeStream()` (stream Detach). A later `detach()` on the same subscription is local cleanup only. Reconnect: in-page `closeDataChannel` on a surviving document. Exit: producer exit → ProcessExited and entity `exited` → `waitForTerminalDetached`. |
| Ownership identity | Core identity is session + subscription + generation. Cancel remount requires a new `subscription_id`. Baseline completed subscription is not treated as the held one. |
| Sibling fail-closed | Successful close keeps the supplied session running. Flood sibling isolation still runs. Opt-in exit ends this session only. |

## Tests and downstream proof run

```sh
npm test
npm run typecheck
npm run build
npm run lint
```

`npm test`, `typecheck`, `build`, and `lint` exit 0 after `finding_1786901636_894520`. Lint still reports only the pre-existing `react-refresh/only-export-components` warnings. This return did not re-run the live coordinator; the finding is a unit-proven destroy-rejection path. The 577s coordinator result on `68a1126` remains the live unmount-order proof.

Fail-closed driver (no Chromium):

- missing both identifiers → exit 1
- session id only → exit 1
- data dir only on the driver → exit 1
- `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` without both identifiers → exit 1
- `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` plus shared session id → exit 1
- `BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1` → exit 1

Standalone live coordinator after the teardown fixes:

```sh
BOTSTER_HUB_BIN=<hub debug at c72712e> \
BOTSTER_SESSION_WORKER_BIN=<matching hub-tree debug session-worker> \
npm run smoke:live-packaged-protocol:shared-session
```

Result: exit 0 in 577s.

| Marker | Count / value |
| --- | --- |
| `live-shared-session-cancel-ablation-passed` | 1; first failure `expected exactly one detach ... got 0`; session types and picker ran |
| `live-shared-session-keep-alive-passed` | 2, session `north-star-shared` |
| `live-shared-session-cancel-passed` | 3, each with `detach_count: 1` |
| `live-shared-session-terminal-lane-passed` | 3 |
| `live-shared-session-exit-passed` | 1, `process_exit=true`, entity proof `lifecycle=exited`, `process_exit_before_entity=true` |
| `live-shared-session-coordinator-passed` | `keep_alive_runs=2`, `cancel_ablation=true`, `exit_pass=true` |
| Workspaces early-exit summary | absent |
| IsolatedHub completion string | absent |
| `session-type-live-proof` | live on ablation and every later pass, including Option A picker |

Hello still required `webrtc_terminal_adapter` and `terminal_subscription_closed` on host compatibility. `conformance_fixture_revision` was 42.

## Unverified behavior or residual risk

- Opt-in exit observed ProcessExited before the entity patch. Entity-only IsolatedHub isolation was not reused for that pass.
- Coordinator `requestDaemonShutdown` after the exit pass is coordinator-owned Hub teardown, not the driver default path.
- Live coordinator used the Hub-tree debug session-worker, not the lockfile Core `fc541a5` worker, because that pairing failed at spawn.
- This return did not re-run the live coordinator. Destroy-rejection cleanup is unit-proved.

## Missing vault guidance discovered

No new inbox capture in this Implement visit. After Verify, a short note can record that the packaged-protocol terminal lane now has a caller-owned keep-alive mode plus `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`, and that `BOTSTER_LIVE_SHARED_HUB_DRIVER` remains Workspaces-only. Do not ratify transport-ownership north-star from this Web ticket.
