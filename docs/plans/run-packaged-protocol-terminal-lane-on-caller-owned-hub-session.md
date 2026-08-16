# Plan: Run packaged-protocol terminal lane on a caller-owned Hub session

Ticket: `ticket_1786868596_331812`
Run: `run_1786868607_597988`
Step: `botster_stack_plan`
Pipeline: `botster_stack_delivery` (direct merge, no PR)
Parent: Hub `ticket_1786661010_115885` / Plan Review `finding_1786868395_783448`
Product decision: `question_1786868962_323590` option **C**
Plan **revision 4** after Plan Review `review_1786870652_115918`.

This is a Web-owned harness-mode ticket. It does not change Hub or TUI. It does not invent a second production transport.

## Plan Review corrections

| Finding | Class | Fix |
| --- | --- | --- |
| `finding_1786870146_363019` live cancellation proof is not defined | product / high | Named `proveInFlightAttachCancellation`. Production unmount during in-flight attach. Decoder abort, one `detach`, no `shutdown_session`, session `running`, later attach, cancel marker, ablation. |
| `finding_1786870146_382387` lint already fails in this harness | product / high | This ticket owns the two `no-useless-assignment` repairs at harness lines 6909 and 6927. `npm run lint` must exit 0. Resolved in rev 2. |
| `finding_1786870146_640008` five vault checklists | process / info | Reuse `checklist_1786869803_886369`. Do not create another checklist. Resolved in rev 2. |
| `finding_1786870461_441376` cancel oracle cites an absent FINISH/PAGE drop | product / high | Use `armSnapshotInstallHold` / `snapshot_install_held` / `releaseSnapshotInstall`. Resolved in rev 3. |
| `finding_1786870652_315157` hold can arm without a new attach | product / high | Start the helper on Home. Wait for the current mount to unmount. Record the completed subscription only as baseline. Arm the hold, reopen the supplied session, and wait for a **new** `snapshot_install_held` subscription. Then unmount that held attach. |
| `finding_1786870652_777363` cites nonexistent `TerminalSessionManager` | product / medium | Exact path is `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount()` → `DefaultTerminalViewBridge.detach()` → `HubTerminalDataPlane.detach()`. |

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn-target name | `booster-web` (display typo; Git identity is `trybotster/botster-web`) |
| Authoritative path | spawn target `botster-web` |
| Plan worktree | this pipeline worktree; Plan does not mutate product code |
| Worktree hygiene | tracked `.gitignore` has content matching HEAD (160 bytes); path has no `:`; no `CARGO_TARGET_DIR` override |
| Merge policy | direct into `main`; do not create a PR |
| Session-type eligibility consumer | **true** |
| `teardown_class_applies` | **yes** |

Independent resolution: `project_pipelines_current_context` ticket/run `target_id` plus `list_spawn_targets` both map `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. Routing did not use the process working directory.

## Repository playbook loaded

[[botster-web-playbook]]

## Other role/surface playbooks and atomic notes loaded

Role / stack:

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[botster pipeline needs continuous product owner between agent steps]]
- [[prefer framework and library components over custom solutions]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[pipeline artifacts should cite vault notes by wikilink not home path]]
- [[vault example paths are not repository placement conventions]]
- [[plan steps need reviewable plan artifacts]]
- [[cross repo dependency registration must use dependency repo target]]
- [[colon worktree paths break cargo dyld library paths]]
- [[hearth gate runs require restoring a pipeline wiped gitignore before attribution]]
- [[identity]]
- [[goals]]

Runtime-teardown class applies (in-page DataChannel reconnect, connection-loss vs host-session survival, ProcessExited vs session-entity exit, multi-client attach):

- [[botster runtime teardown lenses]]

Not loaded, with reason:

- [[project-pipelines-playbook]] — Project Pipelines package/plugin paths and workflow-policy implementation are out of scope
- [[botster-hub-playbook]], [[botster-tui-playbook]], [[botster-core-playbook]] — consulted only as ownership seams; this run must not edit those repositories
- other repository charters as this run's implementation charter

Targeted notes:

- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[a page reload is not a reconnect]]
- [[Web detaches the mounted terminal when the session entity is exited]]
- [[observe-first attached Drain can return SessionLifecycle without ProcessExit]]
- [[hub qualifies effective session type ids as source name slash id]]
- [[host-plane session_type deltas use per-subscriber contiguous snapshot_seq]]
- [[incomplete repo local session types drop the hub client connection]]
- [[first-party clients put terminal mechanism tokens only in terminal compatibility]]
- [[ready then history is a compatibility feature not an Attach field]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]]
- [[canceling incremental attach aborts the decoder and sends Detach]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[live hub proof records distinct hub and locked core binary provenance]]
- [[WebRTC DataChannel local close uses the peer close bound before cleanup]]
- [[a ready WebRTC send must win over a queued DataChannel close]]
- [[webrtc peer cleanup removes every per peer owner together]]
- [[terminal webrtc failure records do not prove peer runtime teardown]]
- [[offline peer claims require the data channel to stay closed]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[Core subscription hard-stop is synchronous close and drop on the host tick]]
- [[Core ClientWorker bind requires a live attach generation]]
- [[file descriptor exhaustion from stale webrtc connections]]
- [[graceful-termination-requires-explicit-cleanup-hooks]]

## Context loaded

Ticket: Web must run the existing packaged-protocol terminal proofs against a caller-owned Hub session so the parent north-star ticket can attach authentic Web and TUI to the same live session.

Current code on Web `30d961cd`:

- `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` (`scripts/workspaces-shared-hub-browser-driver.mjs`) handshakes `BOTSTER_LIVE_DATA_DIR`, then `process.exit(0)` after Workspaces. It never reaches `exerciseSessionTypes` or the terminal lane.
- Default `npm run smoke:live-packaged-protocol` requires `BOTSTER_HUB_BIN`, starts IsolatedHub, writes `botster-web-production-session.sh`, and `spawn`s `web-prod`.
- `BOTSTER_SHARED_SESSION_ID` does not exist.
- Reconnect cycles 1 and 2 use page reload / package-root revisit. `proveInPageTerminalDataChannelReconnect` is the surviving-document oracle.
- Default teardown writes `botster-web-production-exit`, then `ShutdownSession`, then `waitForTerminalDetached`.
- `exerciseSessionTypes` plus `exerciseNewSessionPickerListForTarget` already implement `list_session_types_for_target` + spawn Option A. Picker options come from Hub `session_type_id`. The client does not filter Hub rows by client `target_id` equality.
- Published pin is `@trybotster/hub-test-support@0.1.36` and `@trybotster/terminal-protocol@0.1.0`. That is above the session-type parent floor (hub-test-support `0.1.26` / conf 33).

Parent Hub plan rev 2 names the shared session `north-star-shared` unless the coordinator prints another id. Shared producer is Hub-owned. Web must not spawn a private replacement producer for that id.

Locked product decision `question_1786868962_323590`:

- Choose **C**.
- Default caller-owned lane must keep the supplied session alive.
- Parent coordinator must run two consecutive Web attaches and the TUI proof against that same live session.
- After both clients finish shared-session proofs, the coordinator must run one final Web pass with `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`.
- That final pass must prove ProcessExited or session-entity exit for the same supplied session.
- The default path must never exit the caller-owned session.
- The opt-in path must fail closed unless both `BOTSTER_LIVE_DATA_DIR` and `BOTSTER_SHARED_SESSION_ID` identify the caller-owned session.

## Product decision ledger

| Decision | Choice |
| --- | --- |
| Owner of this run | Web only. Do not edit `botster-hub` or `botster-tui`. Register any Hub/TUI/Core defect against that repo's `target_id`. |
| Mode identity | New caller-owned **terminal-lane** mode, distinct from `BOTSTER_LIVE_SHARED_HUB_DRIVER=1`. Workspaces early-exit must not be this path. |
| Env contract | Driver requires `BOTSTER_LIVE_DATA_DIR` + `BOTSTER_SHARED_SESSION_ID`. Missing either fails closed. Setting one without the other fails closed when this mode is selected. |
| IsolatedHub | Driver must not spawn IsolatedHub. A Web-owned standalone **coordinator** may start a Hub to host the two-run + exit proof. That coordinator is not the terminal-lane path. |
| Attach target | Attach the supplied id. Do not `spawn` a replacement for that id. Do not write the production script into the caller data dir from the driver. |
| Keep-alive default | Default path must not send the producer exit command, must not `ShutdownSession` the supplied session, and must not `requestDaemonShutdown`. |
| Exit opt-in | `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` only. Fail closed unless both data dir and session id identify the caller-owned session. Send the documented producer exit command. Observe ProcessExited **or** session-entity `exited`/`failed`. Use `waitForTerminalDetached`. Do not `ShutdownSession`. |
| Reconnect | In-page DataChannel close on a surviving document. Page reload is not reconnect. Skip harness reload cycles 1 and 2 in this mode. |
| Session types | Live `exerciseSessionTypes` + Option A picker. No client `target_id` equality filter. Live proof, not residual. |
| Producer | Caller/coordinator owns the producer. Standalone Web coordinator may run the existing `botster-web-production-*` script under the supplied id. Parent Hub coordinator owns the shared producer. Driver oracles stay on the existing production markers. |
| Two consecutive runs | Two default keep-alive attaches to the same still-live id. Exit is a third, opt-in pass. |
| Docs | Path from Web prior art: `docs/plans/**` and later `docs/reports/**`. |
| Merge | Direct into `main`. Do not create a PR. |

## Scope

1. Add a caller-owned terminal-lane mode to `scripts/live-packaged-protocol-harness.mjs`, triggered when `BOTSTER_SHARED_SESSION_ID` is non-empty.
2. Fail closed before Chromium when:
   - data dir is missing or blank
   - session id is missing or blank
   - only one of the two is set
   - `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` is also set
   - `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` is set without both identifiers
   - any `BOTSTER_LIVE_ALLOW_*_SKIP` is set
3. Handshake the already-running Hub on `BOTSTER_LIVE_DATA_DIR` the same way the shared-Hub driver does: wait for the socket, `status`, installed `botster-web`, and the launched `local_url`. Do not spawn IsolatedHub. Do not `start_package_entrypoint` unless the existing shared-Hub handshake already does that for a missing app URL. Do not install or enable packages.
4. After the common health / identity / in-page Hub-status reconnect prelude, **do not** take the Workspaces early-exit branch.
5. Keep `exerciseSessionTypes` and `exerciseNewSessionPickerListForTarget` on this Hub. Inject parent pins through `list_session_types_for_target` + spawn Option A. Do not filter by client `target_id` equality.
6. Skip `startProductionSession`. Open and attach `BOTSTER_SHARED_SESSION_ID`. Fail closed if that session is not running.
7. Run the existing terminal oracles against that id:
   - attach chronology (READY before FINISH / snapshot before live)
   - exact bytes
   - history / late-attach
   - resize (`botster-web-production-size`)
   - mounted input echo
   - `proveInFlightAttachCancellation` (named; see Cancellation oracle below)
   - `proveInPageTerminalDataChannelReconnect` (document sentinel; not reload)
   - no `shutdown_session` request for the supplied session on DataChannel close
8. Skip reload cycles 1 and 2.
9. Default path ends without producer exit, without `ShutdownSession`, and without Hub shutdown. Print a greppable keep-alive completion marker that includes the supplied session id.
10. If `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`, after the keep-alive oracles send the documented `botster-web-production-exit` command to the **supplied** session. Observe ProcessExited or session-entity `exited`/`failed`. Pass `waitForTerminalDetached` and the existing entity-driven detach isolation. Do not `ShutdownSession`. Print a greppable exit-pass marker.
11. Add a thin driver entry and a Web-owned standalone coordinator:
    - driver: require the env pair, set no Workspaces driver flag, import the harness
    - coordinator: start one Hub, spawn the supplied id with the existing production script, run the driver twice (keep-alive), then once with `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`
12. Repair the two current `no-useless-assignment` lint errors in this same harness file (lines 6909 and 6927). Do not leave `npm run lint` red.
13. Extend `src/App.test.mjs` fail-closed, mode-branch, and cancel-oracle source oracles. Update `README.md` Live WebRTC section. Write the implement report under `docs/reports/`.
14. Merge directly to Web `main`. Do not create a PR.

## Cancellation oracle

The ticket requires cancellation against the **supplied** session. There is no named live helper today. This ticket adds one. Sibling slow-client isolation is not this oracle.

**Production path (not a harness-only stub):**

The main lane already mounts the supplied terminal before later oracles. Arming the hold and calling `openSessionTerminal` on that existing route does **not** create a new `HubTerminalDataPlane` attach. `snapshot_install_held` would never arrive.

Required helper order:

1. If the supplied session terminal is mounted, `openHomeView` and wait until that mount is gone (`HOST_CHROME.terminalSessionViewTestId` absent, or the session container no longer present).
2. Record the completed subscription id only as a **baseline**. Do not treat it as the held/canceled subscription.
3. Arm the existing snapshot-install hold: `globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.armSnapshotInstallHold()`. Same seam as `proveHydrationBuffersUntilGhostsnpInstall`. Do not invent a FINISH/PAGE drop. `armDropNextInboundEntityFrame` is entity-delta only.
4. `openSessionTerminal(page, sharedSessionId)` reopens the production session route. `App` mounts a **new** `TerminalViewHost` with a new `HubTerminalDataPlane`.
5. `ensureAttached` sends `attach` and begins incremental hydration. `holdLiveSnapshotInstallIfArmed` records `snapshot_install_held` with a **new** `subscription_id` and `generation`, then parks GHOSTSNP install.
6. Wait until `snapshot_install_held` names a subscription id that is **not** the baseline completed subscription. Attach is now in-flight on the production decoder.
7. Leave the session route through production unmount: `openHomeView`. `TerminalViewHost` cleanup calls `DefaultTerminalViewBridge.unmount()`, which calls `DefaultTerminalViewBridge.detach()`, which calls `HubTerminalDataPlane.detach()`. There is no `TerminalSessionManager`.
8. `HubTerminalDataPlane.detach()` calls `closeStream()` → `this.hydration?.reader?.cancel()`, then `bridge.request({ type: "detach", session_id, subscription_id })` for the held subscription.
9. In a `finally` path, call `releaseSnapshotInstall()` so a leaked hold cannot hang the page after cancel.

**Required live assertions** (`proveInFlightAttachCancellation(page, sessionId)`):

- `snapshot_install_held` for a subscription id that is not the pre-helper baseline
- decoder abort or `event_delivery_failed` correlated to that held generation (`reader.cancel` / Restty incremental cancel)
- exactly one `daemon_request` `type: "detach"` for that held `subscription_id`
- zero `shutdown_session` for the supplied session id
- session entity lifecycle remains `running`
- remount + attach succeeds with a **new** `subscription_id`
- greppable marker: `live-shared-session-cancel-passed` plus `session_id`, `old_subscription_id`, `new_subscription_id`, `held_generation`, `detach_count`

**Red-on-removal:** `BOTSTER_LIVE_ABLATE_CANCEL_DETACH=1` (or delete the `detach()` request / `reader.cancel()` call site). The first failing assertion must be this cancel oracle, not a later echo or reconnect check.

`proveSiblingSlowClientAndHostStayUp` may still run as sibling isolation. It does not satisfy this oracle.

## Non-scope

- Editing `botster-hub` or `botster-tui`
- Changing IsolatedHub default `smoke:live-packaged-protocol` except to keep it distinct
- Changing `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` Workspaces early-exit behavior except to refuse combination with the terminal lane
- New production React transport, protocol meanings, or a second decoder path
- Treating page reload as reconnect
- Spawning `web-prod` when a shared id is supplied
- Publishing npm or bumping `@trybotster/hub-test-support` / `@trybotster/terminal-protocol`
- Project Pipelines package/plugin work
- Dual production paths or feature flags in the app
- Optional configurability beyond the locked `BOTSTER_SHARED_SESSION_PROVE_EXIT` contract

## Botster layers touched

- Browser live harness and helpers
- npm scripts / README
- Source-shape unit assertions
- Docs/plan and later implement report
- Not: Ionic production shell, Restty decoder, generated DTOs, Hub, TUI

## Worktree / target assumptions

- Implement stays in this Web worktree and rebases onto current Web `origin/main` before proof.
- Do not infer Hub or TUI from this worktree.
- Merge directly into `main`. Do not create a PR.

## Repository ownership boundaries and cross-repo dependencies

| Surface | Owner | This run |
| --- | --- | --- |
| Ionic shell, Restty mount, packaged-browser live harness | Web | add caller-owned terminal-lane mode + standalone coordinator |
| Host admission, adapters, `ShutdownSession` | Hub | consume current Hub main; do not edit |
| Terminal frames, attach generations, exact-session lifecycle | Core | consume Hub-locked Core; do not edit |
| Ghostty live attach | TUI | sibling `ticket_1786868597_171437`; not a dependency of this Web ticket |
| Session-type eligibility | Hub (already merged) | consume via Option A live proof |

No new cross-repo dependency ticket. Parent Hub ticket already depends on this Web ticket (`dependency_1786868605_621796` on `tgt_40abcf71ccf049f4ac0c99953a799869`). If live proof finds a Hub or Core defect, register a new ticket against that repository's `target_id`. Never register it against this Web target.

## Assumptions and unknowns

Assumptions:

- `question_1786868962_323590` is binding: default keep-alive, opt-in exit pass.
- Closed session-type Hub tickets remain merged. Hub ≥ `804dde7` / hub-test-support `0.1.26` / conf 33 is the floor. Current Web pin `0.1.36` satisfies the pin floor. Live proof still has to run against current Hub main and the lockfile Core worker.
- The supplied session already runs a producer that answers `botster-web-production-*` oracles, including the documented exit command on the opt-in pass. The standalone coordinator writes that script. The parent Hub coordinator owns the shared producer.
- Option A picker may create auxiliary session types, a spawn point, and a picker-spawned session. That is not a replacement of the supplied attach target.
- `proveExternalSessionLifecycle` and `proveSiblingSlowClientAndHostStayUp` may spawn non-supplied sibling sessions. They must not `ShutdownSession` the supplied id.
- Workspaces package path may be absent. That fallback log is expected and is not skip evidence for this terminal lane.

Unknowns Implement must resolve with evidence:

- Whether the already-running caller Hub has `botster-web` launched. If `local_url` is missing, fail closed rather than silently install or spawn IsolatedHub.
- Whether current Hub main still holds one session-type subscription through CRUD (`exerciseSessionTypes`). If it regresses, register a Hub ticket. Do not weaken the oracle.
- Whether Home unmount is complete before the hold is armed. If the helper still sees the first mount, fail closed rather than arming on a live attach. If the remount never emits `snapshot_install_held`, fail closed. Do not fall back to an absent FINISH drop.

## Affected surfaces/files

Expected Web-owned writes:

- `docs/plans/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session.md` (this plan)
- `scripts/live-packaged-protocol-harness.mjs` — new mode, fail-closed env, skip IsolatedHub/`web-prod`/reload cycles/Hub shutdown, attach supplied id, `proveInFlightAttachCancellation`, opt-in exit pass, and the two `no-useless-assignment` repairs at lines 6909 and 6927
- `scripts/live-packaged-protocol-helpers.mjs` — ownership / fail-closed helpers
- thin driver shim next to `scripts/workspaces-shared-hub-browser-driver.mjs`
- thin standalone coordinator modeled on `scripts/live-caller-owned-repeatability.mjs`
- `package.json` scripts
- `README.md` Live WebRTC section
- `src/App.test.mjs` mode-branch and fail-closed assertions
- `docs/reports/run-packaged-protocol-terminal-lane-on-caller-owned-hub-session-implement.md` (Implement)

Do not edit production attach/detach React code unless live proof shows the existing entity-driven detach or in-page reconnect fails on a caller-owned session. Prefer harness-only work.

## Risks

- Combining this mode with `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` would make the Workspaces early-exit look like terminal-lane success
- Page-reload cycles would green a missing reconnect listener ([[a page reload is not a reconnect]])
- Default-path producer exit or `ShutdownSession` would break two consecutive attaches and the parent Web+TUI composition
- `requestDaemonShutdown` would kill the caller-owned Hub
- Session-type CRUD resubscribe can stop the lane before terminal oracles; that is a Hub defect, not a Web skip
- Leftover mouse CSI can hide the alt-redraw arm ([[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]])
- Observe-first lifecycle can consume ProcessExited, so the exit pass must accept session-entity `exited`/`failed` ([[observe-first attached Drain can return SessionLifecycle without ProcessExit]], [[Web detaches the mounted terminal when the session entity is exited]])
- A terminal JSON file or a unit source regex is not live teardown proof
- Soft residual after IsolatedHub `web-prod` is not this ticket's acceptance
- Treating sibling slow-client isolation as the cancel oracle would leave the required supplied-session path unwired
- Leaving the two harness lint errors as "pre-existing" would keep the required lint gate red on the file this ticket changes
- A FINISH/PAGE drop control does not exist. Using `armDropNextInboundEntityFrame` would drop an entity delta, not hold terminal hydration
- Arming the hold while the first mount is still live times out: `openSessionTerminal` is a no-op attach on an already-mounted route

## Runtime-teardown answers

| Field | Answer |
| --- | --- |
| `teardown_class_applies` | yes — in-page DataChannel close/reopen, connection-loss detach vs host-session survival, ProcessExited vs session-entity exit, and a later TUI sibling on the same session |
| `teardown_isolation` | DataChannel close or Detach retires this client's peer generation, terminal subscription, and decoder. The supplied host session stays alive on the default path. Sibling entity families and a later TUI attach keep their owners. The opt-in exit pass retires only the supplied session's process/entity; it must not shut the Hub. |
| `teardown_bounds` | Web request/assembly already times out and fails the peer generation. DataChannel local close uses Hub's peer close bound; Web must not `block_on` Hub close. If close hangs, abandon the generation and fail the oracle. Unbounded Hub control-plane wait is a reject. |
| `late_message_matrix` | See table below. |
| `production_path_proof` | Cancel: Home unmount of the completed mount → arm `armSnapshotInstallHold` → reopen session → wait new `snapshot_install_held` → `openHomeView` → `TerminalViewHost` cleanup → `DefaultTerminalViewBridge.unmount()` → `DefaultTerminalViewBridge.detach()` → `HubTerminalDataPlane.detach()` → `reader.cancel()` + one `detach` RPC → `releaseSnapshotInstall` in `finally` → remount attach. Default reconnect: `closeDataChannel` → production reconnect listener → new Hello + Attach on the surviving document; zero `shutdown_session`; session stays `running`. Exit pass: producer exit → ProcessExited **or** entity `exited`/`failed` → App `releaseTerminalSession` → `waitForTerminalDetached`. Live coordinator proof, not a terminal JSON file. |
| `ownership_identity` | Core identity is session + subscription + generation. A late Detach or PeerClosed for generation N must not detach generation N+1 or a later mount. Route session id is the supplied `BOTSTER_SHARED_SESSION_ID`. |
| `sibling_fail_closed_policy` | Successful close: supplied session stays running; sibling families stay subscribed; later TUI can attach. Ultimate close failure: bound blast radius to this peer/subscription; fail if the supplied session is shut down or a sibling family is removed. Opt-in exit: this session may end; Hub and other sessions must survive. |

### Late-message matrix

| Message | Tag / owner | Reject after terminal failure | Sweep if it races PeerClosed |
| --- | --- | --- | --- |
| Attach | grant + live attach generation + supplied session id | no bind without live generation | stale Attach must not steal a replacement generation |
| Detach | session + subscription | idempotent | Detach after close must not decrement a replacement route |
| SubscribeEntities | grant + subscription id | rejected after peer revoke | residual rows swept with this peer |
| UnsubscribeEntities | same subscription id | idempotent | cannot unsubscribe a replacement owner |
| Hello | connection / peer | failed Hello does not leave a decoder | new Hello only on a new DataChannel generation |
| Input / resize | bound generation | rejected after close; gated until FINISH + attached | late input after close is dropped |
| DataChannel close | this peer | one effective detach of this client; no `ShutdownSession` | original channel stays closed through reconnect setup |
| ProcessExited | terminal subscription | valid first-arriving detach when Core delivers it | must not require Hub to invent a terminal frame |
| Session entity `exited`/`failed` | mounted route session id | detach this mount only | late event for a previous session id must not detach a later mount |
| ShutdownSession | host session policy | **forbidden** on default path for the supplied id; **forbidden** as the exit-pass detach mechanism | must not run on connection loss |

## Acceptance checks/tests

Repository gates (after hygiene). `npm run lint` is currently red on this harness at lines 6909 and 6927 (`no-useless-assignment`). This ticket repairs those two assignments. Lint must exit 0.

```sh
npm test
npm run typecheck
npm run build
npm run lint
```

Source oracles in `src/App.test.mjs`:

- missing `BOTSTER_LIVE_DATA_DIR` or `BOTSTER_SHARED_SESSION_ID` fails closed
- one identifier without the other fails closed
- `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` without both identifiers fails closed
- `BOTSTER_LIVE_SHARED_HUB_DRIVER=1` plus shared session id fails closed
- skip flags fail closed
- Workspaces early-exit branch is not reachable in this mode
- IsolatedHub spawn / `startProductionSession` / `session_id: "web-prod"` are not the attach path
- reload cycles are absent; `proveInPageTerminalDataChannelReconnect` is present
- `proveInFlightAttachCancellation` is present and is not `proveSiblingSlowClientAndHostStayUp`
- default path has no supplied-session `shutdown_session` and no `requestDaemonShutdown`
- opt-in path calls `waitForTerminalDetached` for the supplied id
- lines 6909 and 6927 no longer assign unused `null`

Standalone live proof (Web coordinator, current Hub main + lockfile Core worker):

```sh
BOTSTER_HUB_BIN=<hub-main-bin> \
BOTSTER_SESSION_WORKER_BIN=<lockfile-core-worker> \
npm run smoke:live-packaged-protocol:shared-session
```

That coordinator must:

1. Start one Hub and spawn `BOTSTER_SHARED_SESSION_ID` (default `north-star-shared`) with the existing production script.
2. Run the driver twice with only `BOTSTER_LIVE_DATA_DIR` + `BOTSTER_SHARED_SESSION_ID`.
3. Require both keep-alive completions to print the same session id, the terminal-lane marker, and `live-shared-session-cancel-passed`.
4. Run the driver once more with `BOTSTER_SHARED_SESSION_PROVE_EXIT=1`.
5. Require ProcessExited or session-entity `exited`/`failed` plus `waitForTerminalDetached`.
6. Fail if either keep-alive pass sent `shutdown_session` for the supplied id or shut down the Hub.
7. Fail if the Workspaces early-exit summary is the completion path.

Direct driver contract:

```sh
BOTSTER_LIVE_DATA_DIR=<caller-data-dir> \
BOTSTER_SHARED_SESSION_ID=north-star-shared \
  node scripts/<shared-session-driver>.mjs
```

Independent Plan Review / Verify re-run: two keep-alive attaches, then one exit pass, against the same caller-owned session. IsolatedHub `web-prod` and `drive:workspaces-shared-hub-browser` are not substitutes.

Session-type consumer proof: live `exerciseSessionTypes` and Option A on the caller-owned Hub. Do not accept residual IsolatedHub output.

Charter live proof: Hello still requires `webrtc_terminal_adapter` and `terminal_subscription_closed` on host compatibility, and `snapshot_delivery=ready_then_history` only on terminal compatibility. No Drain bodies.

## Implement sequence

1. Restore `.gitignore` if wiped. Confirm no `:` in the worktree path.
2. Rebase onto current Web `origin/main`.
3. Add fail-closed helpers and the mode branch. Do not touch the Workspaces early-exit path except to refuse combination.
4. Wire attach-to-supplied-id, skip IsolatedHub/`web-prod`/reload/Hub shutdown, keep session-type Option A, keep in-page reconnect.
5. Implement `proveInFlightAttachCancellation`: Home-unmount first, then arm hold, remount, wait for a new `snapshot_install_held`, then `DefaultTerminalViewBridge.unmount` → `detach` → `HubTerminalDataPlane.detach`, then `releaseSnapshotInstall` in `finally`. Require the cancel marker and the ablation. Do not add a terminal-frame drop. Do not cite `TerminalSessionManager`.
6. Wire `BOTSTER_SHARED_SESSION_PROVE_EXIT=1` as a final pass only.
7. Repair harness lint at lines 6909 and 6927.
8. Add driver shim, coordinator, npm scripts, README, and unit oracles.
9. Run `npm test`, typecheck, build, lint. Lint must exit 0.
10. Run the standalone coordinator: two keep-alive attaches (each must print `live-shared-session-cancel-passed`), then the exit pass.
11. Write the implement report with Hub SHA, Core worker SHA, session id, keep-alive markers, cancel markers, and exit-pass evidence.
12. Merge to Web `main`. Do not create a PR.

## Review / Verify overlays

- Review: [[botster-web-reviewer-playbook]] plus [[botster-runtime-reviewer-playbook]]
- Verify: [[botster-web-verifier-playbook]] plus [[botster-runtime-verifier-playbook]]

## Vault gaps worth capturing

- No Plan-time capture. After Verify, consider a short note that the packaged-protocol terminal lane now has a caller-owned keep-alive mode plus an opt-in exit pass, and that `BOTSTER_LIVE_SHARED_HUB_DRIVER` remains Workspaces-only.
- Do not ratify [[transport ownership north star for modular Botster is proposed]] from this Web ticket. That stays on the parent Hub integration ticket.
