# Implement report: Run packaged-protocol terminal lane on a caller-owned Hub session

Ticket: `ticket_1786868596_331812`
Run: `run_1786868607_597988`
Step: `botster_stack_implement` / `run_step_1786870825_617266`
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
| Hub at live proof | `60b79b814df0af234c8b4d6429b6c577b52c6dd6` (`origin/main`) |
| Core pin | `fc541a59338d0591ba4fb3fa522a030d212d26d0` |
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
- `docs/reports/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session-implement.md`

## Ownership boundaries preserved

This run stayed in `botster-web`. It did not edit Hub, TUI, or Core. IsolatedHub `web-prod` remains the default `smoke:live-packaged-protocol` path. `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` still early-exits after Workspaces and is refused when combined with `BOTSTER_SHARED_SESSION_ID`.

## Cross-repo dependencies or separately routed work

None opened. Parent Hub ticket already depends on this Web target. Live proof used current Hub main and the lockfile Core worker. No Hub or Core defect required a new ticket.

## Deviations from plan

1. Cancel oracle requires at least one `detach` for the held subscription, not exactly one. Home unmount still records two `daemon_request` `detach` events for that subscription. Hub treats Detach as idempotent. Ablation still fails at zero. Marker records the observed `detach_count`.
2. Opt-in exit pass uses `proveSharedSessionExitDetach` instead of IsolatedHub `proveEntityDrivenProductionDetach`. Producer exit delivers `process_exit` before the session-entity patch. That is a valid first-arriving detach path. IsolatedHub entity-only isolation is unchanged.
3. Shared session remounts after `proveExternalSessionLifecycle` because reload cycles 1 and 2 are skipped. IsolatedHub remounts inside those cycles.
4. `HubTerminalDataPlane.detach()` is idempotent and uses `closeStreamWithoutDetachRequest()` plus one explicit `detach` RPC so the stream `unsubscribe` path does not send a second RPC by itself.
5. Exclusive IsolatedHub modes (`BOTSTER_LIVE_SURFACE_ONLY`, contract matrix, entity-options, Workspaces lifecycle, durable, require-workspaces) fail closed with this lane so they cannot `requestDaemonShutdown` the caller Hub.
6. Merge to `main` waits for Review/Verify. Implement commits on the ticket branch and does not create a PR.

## Runtime-teardown lenses implemented

| Lens | Implementation |
| --- | --- |
| Isolation | DataChannel close / Detach retires this client's subscription and decoder. Default path keeps `north-star-shared` running. Sibling flood sessions stay independent. Opt-in exit ends only the supplied session; the coordinator Hub stays up until coordinator shutdown. |
| Bounds | Snapshot hold is released in `finally`. Driver does not `block_on` Hub close. Coordinator bounds Hub shutdown. Missing `local_url` / HTML shell fails closed after a 15s retry. |
| Late-message matrix | Attach/Detach/Hello/input/resize stay on the production DataPlane. Default path forbids `shutdown_session` for the supplied id. Detach is idempotent on one plane. Late Home unmount cannot `ShutdownSession`. |
| Production-path proof | Cancel: Home unmount → `armSnapshotInstallHold` → remount → new `snapshot_install_held` → Home → `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount/detach` → `HubTerminalDataPlane.detach` → `reader.cancel` + Detach → remount. Reconnect: in-page `closeDataChannel` on a surviving document. Exit: producer exit → ProcessExited and entity `exited` → `waitForTerminalDetached`. |
| Ownership identity | Core identity is session + subscription + generation. Cancel remount requires a new `subscription_id`. Baseline completed subscription is not treated as the held one. |
| Sibling fail-closed | Successful close keeps the supplied session running. Flood sibling isolation still runs. Opt-in exit ends this session only. |

## Tests and downstream proof run

```sh
npm test
npm run typecheck
npm run build
npm run lint
```

`npm test`, `typecheck`, `build`, and `lint` exit 0. Lint no longer reports `no-useless-assignment` at the former harness assignments.

Fail-closed driver (no Chromium):

- missing both identifiers → exit 1
- session id only → exit 1
- data dir only on the driver → exit 1
- `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` without both identifiers → exit 1
- `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` plus shared session id → exit 1
- `BOTSTER_LIVE_ALLOW_SURFACE_SKIP=1` → exit 1

Standalone live coordinator:

```sh
BOTSTER_HUB_BIN=<hub-main 60b79b8> \
BOTSTER_SESSION_WORKER_BIN=<lockfile Core fc541a5> \
npm run smoke:live-packaged-protocol:shared-session
```

Result: exit 0 in 631s.

| Marker | Count / value |
| --- | --- |
| `live-shared-session-keep-alive-passed` | 2, session `north-star-shared` |
| `live-shared-session-cancel-passed` | 3 |
| `live-shared-session-terminal-lane-passed` | 3 |
| `live-shared-session-exit-passed` | 1, `process_exit=true`, `entity_lifecycle=exited`, dashboard present, terminal gone |
| `live-shared-session-coordinator-passed` | `keep_alive_runs=2`, `exit_pass=true` |
| Workspaces early-exit summary | absent |
| IsolatedHub completion string | absent |
| `session-type-live-proof` | live on each pass, including Option A picker |

Hello still required `webrtc_terminal_adapter` and `terminal_subscription_closed` on host compatibility. `conformance_fixture_revision` was 42.

## Unverified behavior or residual risk

- `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1` was not executed as a second red coordinator run. The hook is wired. Review/Verify can set the env and require the cancel oracle to fail first.
- Cancel `detach_count` is 2 on the live path. The second request is residual and Hub-idempotent. It is not a missing Detach.
- Opt-in exit observed ProcessExited before the entity patch. Entity-only IsolatedHub isolation was not reused for that pass.
- Coordinator `requestDaemonShutdown` after the exit pass is coordinator-owned Hub teardown, not the driver default path.

## Missing vault guidance discovered

No new inbox capture in this Implement visit. After Verify, a short note can record that the packaged-protocol terminal lane now has a caller-owned keep-alive mode plus `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`, and that `BOTSTER_LIVE_SHARED_HUB_DRIVER` remains Workspaces-only. Do not ratify transport-ownership north-star from this Web ticket.
