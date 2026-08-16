# Plan: caller-owned cancel oracle reports exactly one detach

Ticket: `ticket_1786912123_916503`
Run: `run_1786914339_154671`
Parent run: `run_1786867245_870799` (`ticket_1786661010_115885`)
Base: `origin/main` at `ebb6677902ff5920ebb75685a74bba30b9b81b87`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Authoritative path | spawn-target `tgt_40abcf71ccf049f4ac0c99953a799869` → `trybotster/botster-web` |
| Worktree | this run worktree; HEAD is `ebb6677` |
| Repository playbook | [[botster-web-playbook]] |
| Teardown class | yes |
| Session-type eligibility consumer | yes (keep parent pins; do not expand spawn/list work) |
| Merge policy | direct into `main`; no pull request |

Independent `list_spawn_targets` maps `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. The ticket forbids a Hub-target fix.

## Repository playbook loaded

[[botster-web-playbook]]

Web owns browser connection lifecycle, Restty teardown, and packaged/live-hub conformance from the consumer side. Web does not own Hub Detach idempotency, Core subscription inventory, or host session policy.

## Other role and surface playbooks and atomic notes loaded

Role and maps:

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-architecture]]
- [[spa-patterns]]
- [[cli-patterns]] (index only; current ownership stays on the web charter)
- [[identity]]
- [[goals]]

Class overlay:

- [[botster runtime teardown lenses]]

Process:

- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[vault example paths are not repository placement conventions]]

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

Not loaded: [[project-pipelines-playbook]]. This ticket does not change Project Pipelines package or plugin paths.

Rails vault conventions from session start do not apply to this Ionic React client.

## Context loaded

Ticket fact:

- Shipped caller-owned lane on Web `ebb6677` against Hub `c72712e` / lockfile Core `fc541a59` fails `proveInFlightAttachCancellation`.
- Hub coordinator `script/prove-north-star-shared-session` → `npm run drive:live-packaged-protocol:shared-session` failed twice: `expected exactly one detach … got 2`.
- Web standalone `npm run smoke:live-packaged-protocol:shared-session` failed on the second keep-alive: `got 0`.
- Earlier oracles on the same driver pass: session-type live proof, Option A picker, rapid alternate-screen cycle 0, sibling flood, no `ShutdownSession`.
- Hub Detach is idempotent. The oracle counts Web-emitted `daemon_request` `{ type: "detach", subscription_id }` after Home unmount.
- Parent `ticket_1786661010_115885` cannot complete authentic same-session proof until this path emits exactly one detach on keep-alive.

Prior Web ticket `ticket_1786868596_331812` already shipped this oracle and the dual-emitter guard. Live proof on that ticket recorded `detach_count: 1`. The same SHA now reports 0 or 2. This visit repairs the production cancel owner. It does not weaken the oracle.

Observed production path on `ebb6677`:

1. Home unmount removes `TerminalViewHost`.
2. Host cleanup and the cancelled-mount branch both call `DefaultTerminalViewBridge.unmount`.
3. `unmount` → `detach` stops input, then `HubTerminalDataPlane.detach()`.
4. `detach()` sets `detached`, calls `closeStreamWithoutDetachRequest()` (`abandon`, no Detach), then may `bridge.request({ type: "detach" })`.
5. After that, output unsubscribe may call `closeStream()` → `streamTerminal.unsubscribe()` → a second `request({ type: "detach" })`.
6. `attachToAuthoritativeSession` can also `unsubscribe()` a stale stream after a generation bump. That path always sends Detach.
7. `subscribeOutput()` sets `this.detached = false`.
8. `attachToAuthoritativeSession` sets `this.detachSentForSubscriptionId = undefined` after it opens the stream.

The cancel oracle arms `armSnapshotInstallHold`, remounts, waits for a new `snapshot_install_held`, then Home-unmounts. That is an in-flight attach. The 100 ms wait after the first counted detach exists to catch a second request.

`got 2` and `got 0` are one race, not two product bugs:

- Two emitters fire for the held `subscription_id` → `got 2`.
- The once-flag skips the request Detach after a stream abort that used a different id, or after a flag set without a recorded `daemon_request` for the held id → `got 0`.
- A remount or transport recovery that mints a new id before Home can also make the oracle count 0 against the held id.

## Scope

Make the caller-owned cancel unmount emit exactly one `detach` daemon request for the held subscription.

Keep decoder abort. Keep session `running`. Keep later remount on a new `subscription_id`. Keep no `shutdown_session`.

Surgical production change, in this order:

1. Give `HubTerminalDataPlane` one Detach owner for a subscription generation.
   - One function sends at most one `{ type: "detach", session_id, subscription_id }` for that exact id.
   - Public `detach()`, last-listener `closeStream()`, and stale-attach abort must share that owner.
   - Stale `attachToAuthoritativeSession` must `abandon()` the leftover stream when the public detach already owns the request. It must not call `unsubscribe()` as a second Detach emitter.
2. Stop resurrecting a publicly detached plane.
   - `subscribeOutput()` must not clear `detached` after a public detach of the current subscription.
   - A later attach needs a new subscription generation or a new plane. Same-identity attach stays idempotent per [[mounted browser terminal attach is idempotent by attachment identity]].
3. Stop clearing the once-flag on a subscription that already detached.
   - `attachToAuthoritativeSession` must not set `detachSentForSubscriptionId = undefined` for an id that already sent Detach.
4. Public `detach()` must release the held attached id.
   - If transport recovery minted a later id, detach the abandoned held id through the same once-owner (the existing stale-detach path). Do not send two Detaches for the held id.
5. Keep current unmount `finally` cleanup. A rejected or hung Detach must still destroy the renderer, delete the mount, and abort the decoder.
6. Bound the Detach request on the browser side. Do not wait without a fail path. Local unmount must finish if the request rejects.

Oracle and harness:

- Keep `proveInFlightAttachCancellation` exact-one. Do not accept 0 or 2.
- Keep `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1` first failure at `got 0`.
- Keep caller-owned keep-alive. Do not send `ShutdownSession`.
- Keep `list_session_types_for_target` + spawn Option A. Do not filter by client `target_id` equality.

## Non-scope

- Hub, Core, TUI, or `botster-hub-client` edits.
- Changing Hub Detach idempotency.
- IsolatedHub `web-prod` behavior except shared-file regressions that this change causes.
- Workspaces-only `BOTSTER_LIVE_SHARED_HUB_DRIVER=1`.
- Peer close, DataChannel close, or Hub `cleanup_once`.
- Session-type CRUD, spawn UI, or React Query cache work.
- Weakening the 100 ms double-count wait into a pass.
- Dual pipelines or planner-variety extras.

## Repository ownership boundaries and cross-repo dependencies

| Surface | Owner | This run |
| --- | --- | --- |
| Home unmount, `TerminalViewHost`, `DefaultTerminalViewBridge`, `HubTerminalDataPlane` | Web | yes |
| `streamTerminal.unsubscribe` Detach request | Web | yes, only as a shared once-owner |
| Decoder abort on cancel | Web | yes |
| Hub Detach handler | Hub | no; treat as idempotent |
| Core `(session, subscription, generation)` | Core | consume only |
| Host session stay-alive | Hub policy | consume only; Web must not `ShutdownSession` |
| Parent same-session proof | Hub ticket `ticket_1786661010_115885` | downstream consumer after this merge |

No new dependency ticket. Parent already depends on this ticket. Do not register work against the Hub target.

## Assumptions and unknowns

Assumptions:

- `got 0` and `got 2` are the same Web owner race under in-flight attach.
- The live oracle is correct. The production path is wrong.
- Hub `c72712e` / lockfile Core `fc541a59` stay the live pin unless Implement records a newer consumed binary and why.
- Caller-owned proof still needs `BOTSTER_LIVE_DATA_DIR` and `BOTSTER_SHARED_SESSION_ID`.
- Session-type live proof and Option A stay required and already pass; this ticket must not regress them.
- Rails conventions do not apply.

Unknowns Implement must close with evidence, not guesses:

- Whether Vite preview or the coordinator HTML shell remounts `TerminalViewHost` during the hold.
- Whether `stream.unsubscribe` Detach is always recorded as `events.kind === "daemon_request"`.
- Whether transport recovery fires during the hold on the failing coordinator runs.

If Implement finds a Hub occupancy leak for the held id after exactly one Web Detach, stop and register a Hub-target ticket. Do not broaden this run.

## Affected surfaces and files

Likely:

- `src/botster/hubTerminalDataPlane.ts` — one Detach owner; stop `detached` resurrection; stop once-flag clear on a detached id; stale attach uses `abandon`.
- `src/botster/webrtcDaemonClient.ts` — only if stream `unsubscribe` / `abandon` must share the same request owner. Prefer to keep Detach counting in the data plane.
- `src/botster/terminal.ts` — only if unmount/attach order still lets last-listener run before public detach. Do not reorder unless a unit test requires it.
- `src/botster/TerminalViewHost.tsx` — only if cancelled-mount and effect cleanup still start two public detaches after the data-plane once-owner exists. Prefer to leave the host if the plane is sufficient.
- `src/App.test.mjs` — in-flight hold + detach; last-listener then detach; stale attach abort + detach; subscribeOutput after detach; remount new subscription.
- `docs/reports/caller-owned-cancel-oracle-exactly-one-detach-implement.md` — Implement report (repo prior art is `docs/reports/`).

Do not change IsolatedHub-only branches in `scripts/live-packaged-protocol-harness.mjs` unless a shared helper breaks. The oracle stays exact-one.

## Risks

- Collapsing both emitters into `abandon` without a request Detach recreates `finding_1786899753_286268` (zero server release).
- Leaving `subscribeOutput()` clearing `detached` lets a remount send a second Detach for the held id.
- Clearing `detachSentForSubscriptionId` on every stream open lets a late attach send a second Detach.
- Counting only request Detach while last-listener still uses stream Detach can look like `got 0` if the request path is skipped.
- Changing IsolatedHub shared helpers can break `smoke:live-packaged-protocol`.
- Live proof against the lockfile Core worker may fail spawn, as on the parent Web ticket. Record the exact Hub and worker binaries.

## Runtime-teardown lens answers

`teardown_class_applies`: yes. The ticket is in-flight attach cancel, Home unmount, subscription Detach, decoder abort, and keep-alive versus terminal session state.

`teardown_isolation`: One cancel unmount retires this client's `(session_id, subscription_id, generation)`, its decoder, and its mount. The WebRTC peer stays. Sibling entity families stay. The supplied host session stays `running`. Sibling flood sessions stay independent.

`teardown_bounds`: Detach request must have a fail path. Unmount `finally` already destroys the renderer and deletes the mount after reject. Do not `block_on` Hub close. Snapshot hold stays released in the oracle `finally`. Missing live identifiers stay fail-closed.

`late_message_matrix`:

| Message | Tag | After public cancel | Sweep if it races close |
| --- | --- | --- | --- |
| `attach` | `session_id` + `subscription_id` | reject or ignore if `detached` or generation is stale | `abandon()` leftover stream; do not send a second Detach |
| `detach` | same pair | once per subscription id | skip if already sent for that id |
| `streamTerminal` listener | same pair | closed / abandoned | drop events for stale generation |
| `resize` / input | attached generation | drop while detached or before FINISH+attached | no new ownership |
| `subscribe_entities` / `unsubscribe_entities` | entity subscription id | unchanged; not this cancel owner | out of scope unless this change touches them |
| `Hello` / DataChannel recovery | peer generation | recovery may mint a new terminal subscription | stale detach of the old id uses the once-owner; do not recreate the cancelled mount |
| `shutdown_session` | session id | forbidden on keep-alive | fail the oracle if emitted |

`production_path_proof`: Home → `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount` → `HubTerminalDataPlane.detach` → one `daemon_request` detach for the held id + `reader_cancel` or `event_delivery_failed` for that generation → session entity `running` → remount with a new `subscription_id`. Live oracle: `proveInFlightAttachCancellation` on two consecutive keep-alive runs. Ablation: `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1` first failure `got 0`. Do not treat a unit call or a terminal JSON file as sufficient.

`ownership_identity`: Core identity is `(session_id, subscription_id, generation)`. Web `subscription_id` is minted per plane, or reminted on surviving-document recovery. Cancel remount must use a new `subscription_id`. A delayed Detach for the old id must not be counted as, or applied to, the new id.

`sibling_fail_closed_policy`: Success: supplied session stays up; sibling flood stays independent; peer stays. Ultimate Detach failure: local mount and decoder still die; session stays up; no sibling sacrifice. Test both the reject path (already present) and the in-flight cancel path.

## Acceptance checks and tests

Charter gates:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Focused unit proof (production classes, not harness-only helpers):

- In-flight attach paused at `beforeAttachAcquire` or `beforeSnapshotInstall`, then `detach()`: exactly one Detach for the held id; decoder abort; later `detach()` is a no-op.
- Last-listener unsubscribe then `detach()`: exactly one Detach total.
- Stale `attachToAuthoritativeSession` abort plus public `detach()`: exactly one Detach total.
- `subscribeOutput` after public detach does not send a second Detach for the same id.
- Rejected Detach still unmounts, destroys, and deletes the mount (keep existing test).
- Remount uses a new `subscription_id`.

Live caller-owned proof (required, not residual):

```sh
# fail-closed
# missing data dir / session id still exit 1
# BOTSTER_LIVE_SHARED_HUB_DRIVER=1 + BOTSTER_SHARED_SESSION_ID still exit 1

BOTSTER_HUB_BIN=<hub at c72712e or recorded pin> \
BOTSTER_SESSION_WORKER_BIN=<matching worker> \
npm run smoke:live-packaged-protocol:shared-session
```

Run that coordinator twice in a row. Each run must show:

- Ablation first failure `got 0` with session-type live proof and Option A picker.
- Two keep-alive attaches to the supplied session.
- Every `live-shared-session-cancel-passed` marker has `detach_count: 1`.
- Decoder abort for the held generation.
- Remount `new_subscription_id !== old_subscription_id`.
- No `shutdown_session` for the supplied id.
- Session lifecycle `running` after cancel.
- No IsolatedHub `web-prod` completion string and no Workspaces early-exit summary.

If Implement touches shared harness helpers, also run IsolatedHub `npm run smoke:live-packaged-protocol` or prove the IsolatedHub branch was not executed.

Downstream: this merge unblocks parent `ticket_1786661010_115885` authentic same-session proof. That parent re-runs the Hub coordinator. This Web run must not edit Hub.

## Vault gaps worth capturing

After Implement proves the race, capture one inbox note: in-flight cancel can emit 0 or 2 Web Detaches when stream `unsubscribe` and public `detach()` are separate owners, and when `subscribeOutput` or a new attach clears the once-flag. Do not capture during Plan.

No convention conflict. Rails fat-model conventions do not apply here.

## Implement sequence

1. Add failing unit tests for the in-flight hold + detach matrix before production edits.
2. Collapse Detach emission to one subscription-scoped owner.
3. Keep decoder abort and unmount `finally`.
4. Run unit, typecheck, lint, and build.
5. Run two consecutive caller-owned live coordinators. Record Hub SHA, worker binary, and markers.
6. Write `docs/reports/caller-owned-cancel-oracle-exactly-one-detach-implement.md`.
7. Commit on this ticket branch. Do not create a pull request.
