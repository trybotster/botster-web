# Implement report: Restore alternate-screen reattach final-row ReadScreen oracle

Ticket: `ticket_1786840565_508953`
Run: `run_1786840591_550508`
Step: `botster_stack_implement` / `run_step_1786841856_848054`
Plan: `docs/plans/restore-alternate-screen-reattach-final-row-readscreen-oracle.md`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` |
| Branch | `project-pipelines/ticket_1786840565_508953` |
| Web base | `1e576852872bc78fead26c66dc10994447ba3b94` |
| Hub pin | `9bd71ef8dcb8a7b6f748ee80349f962ba939b17e` |
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

Charter and targeted notes that constrained attach, resize, and ReadScreen:

- [[Web vendors a complete Restty build from the approved commit]]
- [[ready then history is a compatibility feature not an Attach field]]
- [[first-party clients put terminal mechanism tokens only in terminal compatibility]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[production incremental reader tests must cover the public handle swap path]]
- [[incremental READY handle swap must restore canvas pixel size]]
- [[incremental resize gating covers both the WASM grid and PTY sink]]
- [[GHOSTSNP READY terminal stays usable after a later history failure]]
- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[botster clients restore visible terminal state from readscreen before buffered live output]]
- [[restty is a client renderer not authoritative terminal infrastructure]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[coredaemon must expose terminal truth used by the production hub path]]
- [[retention without a reachable flush is data loss]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[worker backed attach snapshots fence PTY output at the worker]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[Web terminal drain awaits each event consumer]]
- [[botster webrtc request consumers should use operation gates not connection checks]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[cross repo dependency registration must use dependency repo target]]
- [[spa-patterns]]
- [[botster-architecture]]

Not loaded: [[project-pipelines-playbook]]. This visit did not change Project Pipelines package or plugin paths.

Convention conflicts: none.

## Files changed

- `scripts/live-packaged-protocol-harness.mjs` — flush leftover mouse CSI before the alt-redraw command; match `*botster-web-production-alt-redraw:*)`; strip CR from the extracted marker; turn mouse tracking off before the alt-screen paint; keep the final-row `readScreen` oracle; add cycle-0 differential telemetry and a greppable pass line
- `src/App.test.mjs` — source checks that the oracle still requires `finalRowPrefix` in `readScreen`, the producer arm is prefix-tolerant, and the command flush exists
- `docs/reports/implement-restore-alternate-screen-reattach-final-row-readscreen-oracle.md` — this report

No product consumer change in `hubTerminalDataPlane.ts` or `TerminalViewHost.tsx`. `read_screen` stays on the operation gate. `ReadScreen.text` is not painted into Restty.

## Ownership boundaries preserved

- Web owns the live harness producer script and the mounted `send_input` command that starts the alt-redraw.
- Hub `9bd71ef` remains a pass-through of Core `read_screen` (`session_id` and `text` only).
- Core `fc541a59` remains the ReadScreen owner. This visit did not edit Core or Hub.
- Hub ticket `ticket_1786841441_227450` remains the current-main session-type integration gate. This visit did not add `dependency_1786841444_159699`.

## Cross-repo dependencies or separately routed work

None added.

Unix-socket `read_screen` matched the browser body. The Hub body was not a dropped last row. The producer default-echoed the alt-redraw command, so Core never entered the alternate screen.

## Runtime-teardown lenses

Every lens from [[botster runtime teardown lenses]] stayed in force. No lens was dropped.

| Lens | Implementation |
| --- | --- |
| Isolation | One production session (`web-prod`) and one terminal subscription generation per remount. Sibling proofs that already passed stayed intact. |
| Bounds | Attach and GHOSTSNP waits stay at 30 seconds. The ReadScreen poll stays at 20 seconds. No unbounded close was added. |
| Late-message matrix | `send_input` still uses the current mounted attachment. Stale-generation `read_screen` still returns `undefined`. A current generation keeps the Hub body. |
| Production-path proof | Default live packaged mode. Path is mounted `terminalControl.writeInput` / `readScreen` to `HubTerminalDataPlane` to WebRTC `send_input` / `read_screen`. |
| Ownership identity | Web still keys `read_screen` on `attachmentGeneration` plus `session_id`. |
| Sibling / fail-closed | A failed later shutdown or detach does not rewrite the cycle-0 oracle. The oracle still requires the final-row marker. |

## Deviations from plan

- Implement did not merge to `main`. The pipeline still has Review and Verify. The ticket branch holds the commit. Merge policy stays direct and still requires no PR.
- The full smoke still exits nonzero after the oracle. The harness already says the later shutdown and detach steps fail on main for unrelated reasons. Smoke 1 failed at `shutdown_session` runtime error. Smoke 2 failed at `waitForTerminalDetached`. Those later steps are not this ticket's cycle-0 oracle.
- Diagnostic telemetry was added around the oracle. The assertion still requires `finalScreen?.text?.includes(finalRowPrefix)`.

## Classification and fix

Reproduction against Hub `9bd71ef` and Core `fc541a59` failed at cycle 0 with a defined `readScreen` body. All 166 polls were defined. The session id was `web-prod`. The live echo was present. No `${marker}-row-` cells existed.

The full body contained `botster-web-production-echo:botster-web-production-alt-redraw:<marker>`. Unix-socket `read_screen` matched. One `send_input` request was sent.

`proveMountedMouseModeGatedInput` enables DECSET 1000/1006 and clicks the canvas. Those ModeGatedInput bytes have no newline. `read -r` keeps them on the current line. The next alt-redraw `send_input` completed that dirty line. The exact `botster-web-production-alt-redraw:*)` arm never ran.

The Web-owned repair:

1. Flush a newline before the alt-redraw command.
2. Match `*botster-web-production-alt-redraw:*)`.
3. Extract the marker after that prefix and strip CR.
4. Turn mouse tracking off before the alt-screen paint.

A local producer check shows a prefixed mouse CSI line now emits `${marker}-final-row-`.

## Tests and downstream proof run

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 |
| `BOTSTER_HUB_BIN=<hub-9bd71ef> BOTSTER_SESSION_WORKER_BIN=<core-fc541a59-session-worker> npm run smoke:live-packaged-protocol` (reproduction, before fix) | cycle 0 failed; command default-echoed; Unix and browser bodies matched |
| Same command after the fix, first live run | reached later `shutdown_session` runtime error; duration ~167s versus ~65s for cycle-0 failure |
| Same command after the fix, second live run | `rapid_alternate_screen_reattach passed {"iterations":20,"cycle_0_final_row_present":true,"cycles":20}`; all 20 cycles had `final_row_present` and `install_before_first_write`; later detach wait timed out |

Harness mode: default live packaged protocol, not the shared-Hub shim. Branch marker: `project-pipelines/ticket_1786840565_508953`.

The production entry point is `scripts/live-packaged-protocol-harness.mjs` `proveRapidAlternateScreenReattach`. The producer script is written by `startProductionSession` and executed as the live `web-prod` session.

## Unverified behavior or residual risk

- Later smoke shutdown and detach still fail after the oracle. The harness comments that those steps fail on main for unrelated reasons. This visit did not repair them.
- Current Hub `main` `d52c3eb` still cannot reach this oracle because `exerciseSessionTypes` fails. Hub ticket `ticket_1786841441_227450` owns that gate.
- One extra smoke start failed before Hello with `packaged UI shell was not served`. That start did not reach the oracle.

## Missing vault guidance discovered

No current note stated that leftover mouse CSI can prefix the next `send_input` line and skip a producer case arm. Captured to the vault inbox as `mouse-csi-leftovers-can-prefix-the-next-pty-line.md`.
