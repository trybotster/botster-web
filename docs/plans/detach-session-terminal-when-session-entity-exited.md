# Detach the session terminal when the session entity is exited

## Target

- Repository: `botster-web`
- Spawn target: `tgt_40abcf71ccf049f4ac0c99953a799869` (`list_spawn_targets` name `booster-web`, repo `trybotster/botster-web`)
- Ticket: `ticket_1786848959_308437`
- Run: `run_1786848964_511286`
- Parent Hub ticket: `ticket_1786661010_198387` / finding `finding_1786847824_563256`
- Parent run: `run_1786754929_522007`
- This run is not a consumer of Hub session-type eligibility work.
- Do not inject `list_session_types_for_target` pins or spawn Option A.

## Playbooks and notes loaded

Role and charter:

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]
- [[botster runtime teardown lenses]]

Planner must-loads:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[plan steps need reviewable plan artifacts]]
- [[vault example paths are not repository placement conventions]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]

Current modular transport notes from [[cli-patterns]] that constrain this Web change:

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
- [[file descriptor exhaustion from stale webrtc connections]]
- [[graceful-termination-requires-explicit-cleanup-hooks]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[Web terminal drain awaits each event consumer]]
- [[botster web hub frame entity snapshots omit subscription identity]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[cross repo dependency registration must use dependency repo target]]

Charter notes that constrain attach, paint, and live proof but do not change this detach scope:

- [[Web vendors a complete Restty build from the approved commit]]
- [[ready then history is a compatibility feature not an Attach field]]
- [[first-party clients put terminal mechanism tokens only in terminal compatibility]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[leftover mouse CSI can prefix the next PTY line and skip a producer case arm]]

Not loaded: [[project-pipelines-playbook]]. This ticket is botster-web consumer work, not Project Pipelines package or plugin paths.

Plan Review `review_1786849663_315391` returned `changes_required`. This revision answers:

- `finding_1786849663_747202`: remove speculative `entity_remove` detach
- `finding_1786849663_595583`: add first-arrival, A-to-B late-event, and sibling-isolation acceptance
- `finding_1786849663_645834`: load [[cli-patterns]] and the current modular transport notes above

## Context loaded

Hub Review ran Web `8c87c35bf6cbe6752b57fff364a98f3a128a6afb` `npm run smoke:live-packaged-protocol` twice against Hub `23440a4` and Core `fc541a59`. Both runs passed build, attach chronology, live output, in-page reconnect, and all 20 alternate-screen cycles. Both runs then wrote `botster-web-production-exit`, observed `botster-web-production-exiting`, called `ShutdownSession`, and timed out in `waitForTerminalDetached`.

Both failures reported:

- `exitedObserved=false`
- `lastObservedAttachState=attached`
- `sessionContainerPresent=true`
- `dashboardPresent=false`

This worktree HEAD is that same Web SHA. Tracked `.gitignore` matches HEAD and is not empty. The worktree path has no colon, so `CARGO_TARGET_DIR` is not required.

Hub classify uses `CoreDaemon::observe_session_lifecycle`. That query can consume a parked `ProcessExited` into session lifecycle and not place `process_exit` on the bound adapter. Hub cannot invent a `ProcessExited` terminal frame. Hub already publishes the exited session entity on the control plane. [[observe-first attached Drain can return SessionLifecycle without ProcessExit]] and [[Hub session projection continues without subscribers or terminal Drain]] record that fact.

Current Web production path:

1. `App.tsx` mounts `TerminalViewHost` for the session route.
2. `releaseTerminalSession` navigates to the dashboard only when the route still matches that session.
3. `TerminalViewHost` calls `onExit` only when data-plane status becomes `exited`.
4. `HubTerminalDataPlane.emitProcessExit` is the only producer of that `exited` status, and it runs only on a terminal-plane `process_exit` event.
5. `recordTerminalAttachmentStatus` also releases on attachment `failed`.
6. `App.tsx` does not inspect the subscribed session entity lifecycle. It does not navigate home when that entity becomes `exited` or `failed`.

`waitForTerminalDetached` already uses the production destination: the session terminal host is gone and the dashboard is present. The oracle is not the defect. The missing production handler is the defect.

`isAttachableSession` already requires `lifecycle === "running"` and `lifecycle_class === "current"`. Dashboard listing uses `lifecycle_class === "current"`. Those helpers prevent a new attach. They do not unmount an already mounted terminal.

## Product decision ledger

- Binding defect: after Hub cold-cut, terminal-plane `process_exit` is not a deterministic detach oracle. The subscribed session entity `lifecycle` value is the deterministic oracle.
- Default Web base: current Web `main` (`8c87c35`) plus this child branch.
- Binary pair: Hub parent candidate `23440a4` at finding time, and Core `fc541a59338d0591ba4fb3fa522a030d212d26d0`. Implement must resolve the current parent Hub worktree HEAD at proof time and record the SHA it actually runs.
- Detach immediately when the mounted session entity `lifecycle` is `exited` or `failed`. Do not wait for a later `process_exit`.
- Do not detach because a session row is missing, because the family is `not_loaded`, or because Hub sent `entity_remove`. The ticket oracle is `lifecycle` `exited` or `failed` only. Hub already publishes the exited entity. Missing-row detach is out of scope.
- Keep terminal-plane `process_exit` as a valid first-arriving detach path. Both paths call the same `releaseTerminalSession` with that session id. The first matching call wins. A later event for a session that is no longer the mounted route is a no-op.
- Keep the alternate-screen final-row `ReadScreen` oracle. Do not weaken, skip, or retarget it.
- Keep `waitForTerminalDetached` as the live detach oracle. Do not change its destination facts.
- Non-goal: do not change Hub production Drain, host tokens, or adapter close policy.
- Non-goal: do not change Core, session-worker, or Ghostty in this run.
- Non-goal: do not add a drain wait, optional configurability, or a second terminal truth.
- Non-goal: do not create a pull request. Merge directly into `main` after two live proofs.
- Follow-up-ok: register a Hub ticket on `tgt_7e208a0c76a44980a83b63af976b1f22` only if the candidate does not publish `lifecycle` `exited` or `failed` for the mounted session after production exit and `ShutdownSession`.
- Ask a human only if Hub publishes a different lifecycle vocabulary than `exited` / `failed` and the DTO plus live entity row disagree.

## Scope

1. Add a Hub-authored predicate for a session entity that requires detach. Use `DaemonSessionEntity.lifecycle` values `exited` and `failed`. Do not infer from `registry_state`. Do not invent a local heuristic.
2. In `App.tsx`, watch Hub frames for the mounted session id. Resolve that row from the full `session` family by `id`, `session_uuid`, or `session_id`, not from `currentDashboardSessions`. When that record requires detach, call the existing `releaseTerminalSession`.
3. Keep `TerminalViewHost` `onExit={releaseTerminalSession}` for terminal-plane `process_exit`.
4. Keep attachment `failed` as a detach path.
5. Keep Restty unmount as the existing `TerminalViewHost` cleanup. Do not add a second renderer teardown.
6. Add focused unit coverage for the predicate. Add a real `createRoot` route-state test, in the same style as the existing plugin-route "late A must not replace B" proof, that drives the production detach helpers used by `App`.
7. That route-state test must prove both first-arrival orders, an A-to-B late-event race, and sibling survival. It must also prove that `entity_remove` does not detach.
8. Prove `npm run smoke:live-packaged-protocol` `waitForTerminalDetached` after production exit and `ShutdownSession`, more than once, against the Hub candidate and Core `fc541a59`. Keep the alternate-screen final-row oracle.

## Non-scope

- Do not change Hub Drain, host tokens, adapter close, or session-entity publication.
- Do not change Core `observe_session_lifecycle` or adapter `process_exit` placement.
- Do not weaken `proveRapidAlternateScreenReattach` or `waitForTerminalDetached`.
- Do not keep the mounted terminal after entity exit in order to drain a `process_exit` that Hub may never deliver.
- Do not detach on `entity_remove`, an empty snapshot, a `not_loaded` family, or a missing row. Those are not this ticket's oracle.
- Do not make an exited or failed session newly attachable.
- Do not close the WebRTC peer because one session entity ended. The peer still owns sibling subscriptions and host control.
- Do not change session-type eligibility, spawn Option A, or `list_session_types_for_target`.
- Do not load or implement Project Pipelines package work.
- Do not edit `botster-hub`, `botster-core`, or `botster-tui` in this run.

## Ownership boundaries and cross-repo dependencies

| Surface | Owner | This run |
| --- | --- | --- |
| Ionic session route, `releaseTerminalSession`, subscribed session-entity detach | botster-web | Yes |
| `HubTerminalDataPlane` `process_exit` to status `exited` | botster-web | Keep as a valid second path. Do not make it the only path |
| Restty mount and unmount | botster-web renderer integration | Existing unmount on route change. No new renderer policy |
| Session entity `lifecycle` / `lifecycle_class` publication | botster-hub | Consume only. Register `tgt_7e208a0c76a44980a83b63af976b1f22` if the candidate does not publish `exited` or `failed` |
| `observe_session_lifecycle` and parked `ProcessExited` consumption | botster-core / botster-hub | Already shipped. Do not change here |
| Adapter `process_exit` placement | botster-hub / botster-core | Out of scope. Hub cannot invent the frame |

Do not register a cross-repo ticket on this Web target. The parent Hub ticket already depends on this Web ticket through `dependency_1786848962_964959`.

If Implement proves the Hub candidate does not publish the exited session entity, register a new Hub ticket against `tgt_7e208a0c76a44980a83b63af976b1f22`. Do not edit Hub here.

## Assumptions and unknowns

- Determined fact: `list_spawn_targets` resolves `tgt_40abcf71ccf049f4ac0c99953a799869` to the botster-web spawn target named `booster-web` and repo `trybotster/botster-web`.
- Determined fact: this worktree is Web `8c87c35`, the same SHA Review used.
- Determined fact: this ticket is not a Hub session-type eligibility consumer.
- Assumption: Hub candidate `23440a4` already publishes the mounted session entity with `lifecycle` `exited` after production exit and `ShutdownSession`. The ticket states that as the Hub-owned fact.
- Assumption: `DaemonSessionEntity.lifecycle` values `exited` and `failed` are the producer vocabulary. Implement must confirm those strings on the live entity row, not invent synonyms.
- Assumption: `releaseTerminalSession` plus route unmount is enough Restty and data-plane cleanup. The existing `TerminalViewHost` effect already unsubscribes and unmounts.
- Assumption: losing any in-flight terminal bytes after entity exit is acceptable. The harness already observed `botster-web-production-exiting` before `ShutdownSession`.
- Resolved by Plan Review: `entity_remove` is not a detach oracle for this ticket. Implement must ignore a missing mounted row. If live Hub later removes the row without publishing `exited` or `failed`, register a Hub ticket on `tgt_7e208a0c76a44980a83b63af976b1f22`. Do not invent a Web remove heuristic.
- Unknown until proof time: the exact parent Hub worktree SHA if Implement advanced past `23440a4`. Record the SHA that actually ran.

## Affected surfaces and files

- `src/botster/terminalSession.ts` — add `sessionEntityRequiresDetach` next to `isAttachableSession`
- `src/App.tsx` — watch the mounted session entity and call `releaseTerminalSession`
- `src/App.test.mjs` — predicate tests, source contract that App uses the subscribed entity, and a `createRoot` route-state race that proves both first-arrival orders, A-to-B late events, `entity_remove` non-detach, and sibling survival
- `src/app/__fixtures__/sessionRouteDetachHarness.tsx` — only if Implement needs a focused harness like `pluginRouteStateHarness.tsx`; do not invent a second detach policy
- `docs/plans/detach-session-terminal-when-session-entity-exited.md` — this plan

Inspect only, change only if the production path requires it:

- `src/app/terminalChrome.ts` — existing release toast
- `src/botster/TerminalViewHost.tsx` — keep `onExit` on data-plane `exited`
- `src/botster/hubTerminalDataPlane.ts` — keep `emitProcessExit`
- `src/botster/generated/daemon-protocol.ts` — `DaemonSessionEntity.lifecycle`
- `scripts/live-packaged-protocol-harness.mjs` — keep `waitForTerminalDetached` and the alternate-screen oracle
- `scripts/live-packaged-protocol-helpers.mjs` — keep `isTerminalDetached`

Do not treat vault example paths as placement authority. This repository already stores reviewable plans under `docs/plans/`.

## Runtime-teardown class answers

`teardown_class_applies`: yes. After production exit and `ShutdownSession`, the session entity is terminal while the mounted Restty host stays `attached`. That is terminal-state versus live-runtime divergence on one session.

`teardown_isolation`: one mounted session id and its `TerminalViewHost` / data-plane generation. Entity exit for session A must not unmount session B, close the WebRTC peer, or drop sibling entity families.

`teardown_bounds`: `releaseTerminalSession` is a route change. Unmount already unsubscribes status and calls `bridge.unmount`. Do not add `block_on` or an unbounded close. `waitForTerminalDetached` stays at 15 seconds. Existing WebRTC request-gate timeouts remain the bound for any in-flight terminal request.

`late_message_matrix`:

| Message | Owner tag | After entity `exited` / `failed` | Residual sweep |
| --- | --- | --- | --- |
| Session `entity_patch` / `entity_upsert` with `lifecycle` `exited` or `failed` | mounted route `sessionId` equals record id | First matching event for the mounted id detaches | Route change unmounts the host |
| Session `entity_remove`, empty snapshot, or missing row | no owner tag for detach | Do not detach. Wait for `exited` / `failed` or `process_exit` | No sweep |
| Session `entity_patch` / `process_exit` for session A after route is B | incoming session id | Reject. B stays mounted | Ignore late A |
| Terminal-plane `process_exit` | attachment generation plus session id | Valid first or late path for the mounted id. Late A after B mounts is a no-op | `onExit` still wired |
| `attach_state`, `snapshot`, `terminal_output` | attachment generation | Unmount drops the data plane. Late frames must not remount | Existing generation guard |
| `write_input` / `resize` | current mounted attachment | After unmount, harness and UI must not send through the old host | Host controls uninstall on unmount |
| New `Attach` / dashboard open | `isAttachableSession` | Exited or failed rows stay non-attachable | Dashboard already filters `lifecycle_class === "current"` |
| `SubscribeEntities` / session-type deltas | existing subscription identity | Do not resubscribe because one session ended | Held subscriptions stay |
| Peer `Hello`, host requests, sibling sessions | live peer | Peer stays open | Do not treat session detach as peer close |

`production_path_proof`: live packaged default mode, not the shared-Hub shim. Path is Hub session entity frame to `runtimeClient.entities` to `App` effect to `releaseTerminalSession` to dashboard unmount. Live proof is two consecutive `npm run smoke:live-packaged-protocol` runs against the Hub candidate and Core `fc541a59` that pass `waitForTerminalDetached` after `botster-web-production-exit` and `ShutdownSession`. A unit helper or a terminal JSON file is not enough. `proveRapidAlternateScreenReattach` must still require the final-row marker in `readScreen`. Request-race, ownership identity, and sibling isolation are proved by the `createRoot` route-state tests listed under Acceptance checks, not by the one-session live pair alone.

`ownership_identity`: Web detaches by mounted route `sessionId`. Terminal-plane ownership stays `(session_id, subscription_id, attachmentGeneration)`. A delayed `process_exit` or entity patch for session A must not detach a later mount of session B. Core generation identity stays on Core if a replacement attach occurs.

`sibling_fail_closed_policy`: on success, Hello, attach, live output, alternate-screen cycles, in-page reconnect, and later host requests must still pass. On ultimate detach failure, stay on the session route until the 15-second oracle fails. Do not close the peer or other sessions. Do not fail-closed Hub.

## Risks

- Waiting for `process_exit` after entity exit recreates the Review timeout. Do not add a drain delay.
- Detaching only on `lifecycle_class` would miss a still-`current` row that already has `lifecycle` `exited`. Use the ticket's `exited` / `failed` values.
- Using dashboard `current` rows as the source hides the mounted exited entity. Read the full `session` family.
- Detaching on a missing row, `not_loaded` family, reconnect snapshot, or `entity_remove` can unmount a valid route. Do not add that path.
- Changing `waitForTerminalDetached` to accept `attachState === attached` would hide a still-mounted host. Keep the destination oracle.
- Editing Hub Drain or adapter close in this Web ticket violates the parent ownership split.
- The older plan `docs/plans/consume-current-published-hub-protocol-artifact.md` said to keep the terminal mounted through entity exit so polling could drain `process_exit`. That product decision is stale after Hub cold-cut. Do not follow it.

## Acceptance checks

Required live proof, default harness mode:

```bash
BOTSTER_HUB_BIN=<hub-candidate> \
BOTSTER_SESSION_WORKER_BIN=<core-fc541a59-session-worker> \
npm run smoke:live-packaged-protocol
```

Run that command twice. Both runs must:

- keep `proveRapidAlternateScreenReattach` cycle 0 with the final-row marker still required in `readScreen`
- write `botster-web-production-exit`
- observe `botster-web-production-exiting`
- call `ShutdownSession`
- pass `waitForTerminalDetached` for that session
- require the matching Hub session entity `lifecycle` `exited` or `failed`
- prove terminal-plane `process_exit` did not cause that accepted detach (`exitedObserved` stays false and the first shared `events` ledger `process_exit` does not precede the entity `exited`/`failed` frame)
- record raw entity versus `process_exit` event order plus Hub and worker provenance: both realpaths under the candidate checkout target directory, Hub revision, locked Core revision, and either a clean checkout plus the two locked build commands or a receipt whose commands equal those locked commands
- after detach, prove the same WebRTC peer still answers a `status` request and a sibling session or held `session_type` family remains

Record harness mode, branch marker, Hub SHA, Core SHA, and Web SHA. These two candidate-pair runs are the required product proof.

Also run repository charter gates after the Web code change:

- `npm run typecheck`
- `npm test`
- `npm run build`

Add or extend `src/App.test.mjs` so that:

- `sessionEntityRequiresDetach` is true for `lifecycle` `exited` and `failed`
- `sessionEntityRequiresDetach` is false for `lifecycle` `running`, `undefined`, and a missing record
- `App.tsx` still wires `onExit={releaseTerminalSession}`
- `App.tsx` reads the subscribed session entity and calls `releaseTerminalSession` only when that mounted record requires detach

Add a real `createRoot` + `act` route-state test that uses the production detach helpers, following the existing plugin-route "late A must not replace B" pattern. It must prove all of:

1. First arrival: mounted A plus entity `exited` for A navigates home and removes A's terminal host.
2. First arrival: mounted A plus terminal-plane `process_exit` for A navigates home and removes A's terminal host.
3. Either order: the second A event after the first detach is a no-op and does not remount A.
4. A-to-B race: mount A, navigate to B, then deliver late A `lifecycle` `exited` and late A `process_exit`. B stays mounted. A's host is absent.
5. `entity_remove` of A while A is mounted does not detach A.
6. After A detaches, sibling session row C remains in the entity store and a held `session_type` family remains available. The test must not close or drop a sibling peer/session subscription as part of A's detach.
7. Entity detach of A records production-shaped teardown: bridge `unmount`, bridge `detach`, and data-plane `detach` for A only.

Source regexes alone do not satisfy items 1-7.

Those route-state tests are not a substitute for the two live candidate-pair runs. The live pair remains the production-path hard-stop proof for one exited session on the packaged peer. The route-state tests are the required request-race, ownership-identity, and sibling-isolation proof.

Do not open a pull request. Merge directly into `main` after the two live proofs pass.

## Vault gaps

- No current Web-owned note states that a first-party client must detach the mounted terminal when the subscribed session entity is `exited` or `failed`, because Hub observation can consume `ProcessExited` without adapter `process_exit`.
- Capture after Implement proves the live path. Candidate title: `Web detaches the mounted terminal when the session entity is exited`.
- The older Web plan that retained the mount through entity exit is now a stale local document, not a vault convention. Do not revive it.

## Implementation sequence

1. Confirm worktree hygiene. Restore `.gitignore` from HEAD only if it is empty or missing. Do not truncate it.
2. Confirm Hub candidate and Core `fc541a59` binaries. Record the SHAs.
3. Inspect one live session entity row after production exit and `ShutdownSession` if the first proof still fails. Confirm `lifecycle` is `exited` or `failed`.
4. Add the predicate and the `App` effect. Keep `process_exit` `onExit`. Guard both paths on the mounted route session id. Do not detach on a missing row.
5. Add the predicate tests and the `createRoot` route-state race listed above.
6. Run typecheck, unit tests, build, and two consecutive live packaged-protocol smokes.
7. Merge directly to `main` when both live runs pass `waitForTerminalDetached` and still keep the alternate-screen oracle. Do not open a pull request.
