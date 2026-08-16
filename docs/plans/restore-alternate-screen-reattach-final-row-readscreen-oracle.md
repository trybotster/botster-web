# Restore alternate-screen reattach final-row ReadScreen oracle

## Target

- Repository: `botster-web`
- Spawn target: `tgt_40abcf71ccf049f4ac0c99953a799869` (`list_spawn_targets` name `booster-web`, repo `trybotster/botster-web`)
- Ticket: `ticket_1786840565_508953`
- Run: `run_1786840591_550508`
- Parent Hub ticket: `ticket_1786661010_198387` / finding `finding_1786840394_749331`
- Human answer: `question_1786841372_658568`
- Final-integration Hub gate: `ticket_1786841441_227450` on `tgt_7e208a0c76a44980a83b63af976b1f22`
- This run is not a consumer of Hub session-type eligibility work.
- Do not re-add `dependency_1786841444_159699`. That edge made this Web ticket wait on the Hub session-type ticket and blocked the candidate-pair oracle.

## Playbooks and notes loaded

Role and charter:

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]
- [[botster-web-verifier-playbook]]
- [[botster runtime teardown lenses]]

Charter Must Load notes that constrain attach, resize, and ReadScreen:

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

Planner must-loads:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[botster pipeline needs continuous product owner between agent steps]]

Targeted atomic notes:

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
- [[vault example paths are not repository placement conventions]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan steps need reviewable plan artifacts]]

Not loaded: [[project-pipelines-playbook]]. This ticket is botster-web consumer work, not Project Pipelines package or plugin paths.

## Context loaded

Review ran Web `1e576852872bc78fead26c66dc10994447ba3b94` `npm run smoke:live-packaged-protocol` twice against Hub `9bd71ef` and Core `fc541a59`. Both runs passed Hello, initial attach, live output, mounted input, OSC, palette, and retained-history. Both runs then failed `proveRapidAlternateScreenReattach` at cycle 0. `readScreen` never contained the expected final-row marker within 20 seconds. Markers: `alt-00-msv2h031-final-row-` and `alt-00-msv2itk1-final-row-`.

This worktree HEAD is that same Web SHA. Tracked `.gitignore` matches HEAD and is not empty. The worktree path has no colon, so `CARGO_TARGET_DIR` is not required.

Hub `ReadScreen` is `observe_lifecycle_slice` plus Core `read_screen`. Hub copies `session_id` and `text`. It does not inspect terminal bodies. The oracle lives in `scripts/live-packaged-protocol-harness.mjs` in `proveRapidAlternateScreenReattach`. Do not weaken that oracle.

Production Web path:

1. Harness calls mounted `terminalControl.readScreen`.
2. `TerminalViewHost` forwards to `HubTerminalDataPlane.readScreen`.
3. The data plane sends `{ type: "read_screen", session_id }` through the existing WebRTC request gate.
4. A response is returned only while the same attachment generation and session id remain current.
5. `ReadScreen.text` is a diagnostic supplement. It is not the Restty paint path. GHOSTSNP install plus live `TerminalOutput` remains the renderer path.

The cycle-0 producer writes `CSI ? 1049 h`, clears, paints one row at a time, then overwrites the last row with `${marker}-final-row-${rows}`. The harness then navigates home and back, waits for a new attach and GHOSTSNP install, types a live echo, waits for a Restty renderer write of that echo, and polls `readScreen` for 20 seconds.

`question_1786841372_658568` answers the binary contract. For this Web ticket, current Hub and Core binaries means Hub `9bd71ef` and Core `fc541a59`. Reproduce and prove the oracle against that pair. Use current Web `main` plus this child branch. Do not let Hub `main` `d52c3eb` `exerciseSessionTypes` (`session_type CRUD triggered a resubscribe: 2 -> 3`) stop the candidate-pair oracle.

Plan Review independently reproduced that current-main failure at `scripts/live-packaged-protocol-harness.mjs:5387`. The run never reached the alternate-screen oracle. Hub ticket `ticket_1786841441_227450` owns that regression. It must restore current-main integration without weakening `exerciseSessionTypes`. It is the final-integration gate, not an ordering blocker for this candidate-pair work.

## Product decision ledger

- Binding answer `question_1786841372_658568`: current Hub and Core binaries means Hub `9bd71ef` and Core `fc541a59` for reproduction and both consecutive oracle proofs.
- Default Web base: current Web `main` (`1e57685`) plus this child branch.
- Non-goal: do not change the final-row marker requirement, the 20-second poll, or the cycle-0 first-failure meaning.
- Non-goal: do not weaken `exerciseSessionTypes`. Do not move the Hub `d52c3eb` session-type resubscribe defect into this Web ticket.
- Non-goal: do not edit Hub in this ticket unless Review later proves a Hub adapter drop of `read_screen` text.
- Non-goal: do not create a pull request. Merge the Web oracle fix directly into `main` after the candidate-pair proofs.
- Final-integration gate: Hub ticket `ticket_1786841441_227450` on `tgt_7e208a0c76a44980a83b63af976b1f22` must restore Hub `main` so live packaged-protocol can reach the alternate-screen oracle. Do not add an ordering dependency from this Web ticket onto that Hub ticket.
- Follow-up-ok: register a Core ticket on `tgt_1f7bce66eb304881980f7c83125ea6c16e` if Core readback owns the missing last row.
- Follow-up-ok: register a second Hub ticket on `tgt_7e208a0c76a44980a83b63af976b1f22` only if Core has the final-row marker and the Hub `read_screen` body that Web receives does not.
- Ask a human only if the three-way differential cannot be run, or if the three surfaces disagree in a way this ledger does not cover.

## Scope

1. Reproduce cycle 0 against Hub `9bd71ef` and Core `fc541a59`. Record binary provenance, harness mode, and the first failing assertion.
2. Capture a differential without changing the oracle:
   - Whether `readScreen` returns `undefined`, empty text, or text that lacks only the final-row prefix.
   - Whether any `${marker}-row-` cells exist. Missing earlier rows means the alt-redraw command likely never ran or the whole alt screen is absent. Earlier rows without the final-row prefix means last-row clipping or an incomplete redraw.
   - Whether `read_screen_supplement` from attach already lacks the marker.
   - Whether the later live echo marker is present in `readScreen` after Restty already wrote it.
   - Whether a same-session Unix-socket or Hub-daemon `read_screen` taken beside the browser call contains the marker.
3. Classify owner from that differential:
   - Web-owned: the Hub or Core body has the marker, or Web drops a current attachment response, sends the wrong session, or loses the alt-redraw input before detach.
   - Core-owned: a production Core `read_screen` on the same session also lacks the final row after the producer and reattach sequence.
   - Hub-owned: Core has the marker and the Hub response body that Web receives does not.
4. If Web-owned, make the smallest consumer fix in the existing request and attachment-identity path. Keep `read_screen` on the operation gate. Do not move it into React Query. Do not paint `ReadScreen.text` into Restty. Keep Attach as `{ session_id, subscription_id }`. Keep terminal mechanism tokens on `Hello.terminal_compatibility` only. Keep READY paint before FINISH. Do not send remount resize or input before FINISH and `Attached`. Restore canvas pixel size after READY handle swap. Drive any attach-path test through `createBinarySnapshotReader` and authentic READY/PAGE/FINISH bytes.
5. If Core-owned or adapter-drop Hub-owned, register a dependency ticket against that repository target. Do not edit that repository in this run. Do not use `ticket_1786841441_227450` for a missing final row.
6. Rerun `npm run smoke:live-packaged-protocol` twice against Hub `9bd71ef` and Core `fc541a59`. Both runs must pass `proveRapidAlternateScreenReattach` cycle 0 with the final-row marker still required in `readScreen`.

## Non-scope

- Do not weaken, skip, or retarget the final-row `readScreen` oracle.
- Do not treat Restty renderer text as a substitute for `readScreen`.
- Do not edit Hub unless Review proves an adapter drop of `read_screen` text after this plan's differential.
- Do not change Core, session-worker, or Ghostty in this botster-web run.
- Do not change session-type eligibility, spawn Option A, or `list_session_types_for_target`.
- Do not fix or weaken `exerciseSessionTypes`. Hub ticket `ticket_1786841441_227450` owns the Hub `main` resubscribe regression.
- Do not add browser-owned terminal truth, a second paint path, or optional configurability.
- Do not broaden into retained-history, OSC, palette, or in-page DataChannel reconnect unless the Web fix forces that surface.
- Do not load or implement Project Pipelines package work.

## Ownership boundaries and cross-repo dependencies

| Surface | Owner | This run |
| --- | --- | --- |
| Ionic shell, WebRTC request gate, `HubTerminalDataPlane.readScreen`, mounted harness control | botster-web | Yes, if the consumer drops or never delivers a current response |
| GHOSTSNP install and live byte flush | botster-web renderer integration | Inspect only. Do not replace ReadScreen with Restty |
| Alternate-screen PTY bytes, worker snapshot fence, Core `read_screen` text | botster-core / session-worker | Register `tgt_1f7bce66eb304881980f7c83125ea6c16e` if Core text lacks the row |
| Hub `observe_lifecycle_slice` plus pass-through `read_screen` | botster-hub | Register a new ticket on `tgt_7e208a0c76a44980a83b63af976b1f22` only if adapter drop is proved |
| Hub `main` session-type CRUD resubscribe `2 -> 3` | botster-hub | Already filed as `ticket_1786841441_227450` on `tgt_7e208a0c76a44980a83b63af976b1f22`. Final-integration gate only |
| Ghostty last-row / alt-screen snapshot mechanics | botster-terminal-ghostty via Core | Not in this run. Core ticket owns that escalation |

Do not register a cross-repo ticket on this Web target. The parent Hub ticket already depends on this Web ticket.

Do not add an ordering dependency from `ticket_1786840565_508953` onto `ticket_1786841441_227450`. Plan Review already removed `dependency_1786841444_159699` after it blocked return to Plan. Cite the Hub ticket as the current-main integration gate. Keep both candidate-pair oracle runs unblocked.

## Assumptions and unknowns

- Determined fact: `question_1786841372_658568` binds current Hub and Core binaries to Hub `9bd71ef` and Core `fc541a59` for reproduction and both consecutive proofs. Implement must still record the SHAs it actually runs.
- Assumption: the live echo renderer write proves the new attach can accept input. It does not prove the earlier alt-redraw line reached the PTY before navigate-away.
- Assumption: Hub `read_screen` remains a body pass-through at `9bd71ef`.
- Unknown until reproduction: whether cycle 0 lacks every alt-row marker, lacks only the final row, or returns `undefined` for 20 seconds.
- Unknown until reproduction: whether Web `isCurrentAttachment` drops every poll after the live echo.
- Unknown until reproduction: whether `stty size` during rapid detach yields a usable row count. Even a blank `rows` value still interpolates `${marker}-final-row-` if the case arm runs.

## Affected surfaces and files

Likely Web consumer and proof surfaces:

- `src/botster/hubTerminalDataPlane.ts` — `readScreen`, attachment-generation guard, optional `read_screen_supplement`
- `src/botster/TerminalViewHost.tsx` — mounted harness `readScreen` control
- `src/botster/terminal.ts` — optional readback contract
- `src/App.test.mjs` — stale-generation and request-identity tests if the consumer changes
- `scripts/live-packaged-protocol-harness.mjs` — diagnostic telemetry around `proveRapidAlternateScreenReattach` only; keep the final-row assertion
- `docs/plans/restore-alternate-screen-reattach-final-row-readscreen-oracle.md` — this plan

Inspect during triage, change only if the owner is Web:

- `src/botster/generated/daemon-protocol.ts` — request and `DaemonReadScreen` shape
- production session script in the live harness — `botster-web-production-alt-redraw:*` case

Do not treat vault example paths as placement authority. This repository already stores reviewable plans under `docs/plans/`.

## Runtime-teardown class answers

`teardown_class_applies`: yes. Live Restty can show the post-reattach echo while authoritative `ReadScreen` lacks the alt-screen final row. That is terminal-state versus live-runtime divergence on one session.

`teardown_isolation`: one production session and one terminal subscription generation. A failed cycle must not stop sibling proofs that already passed, and must not require killing other Hub sessions.

`teardown_bounds`: attach and GHOSTSNP waits stay at 30 seconds. The ReadScreen poll stays at 20 seconds. Do not add an unbounded close or `block_on`. If a Web request hangs, the existing WebRTC operation gate timeout remains the bound.

`late_message_matrix`:

| Message | Owner tag | After navigate-away / new attach | Residual sweep |
| --- | --- | --- | --- |
| `write_input` alt-redraw | current mounted attachment and session id | A late write from the unmounted view must not apply to a replacement session | Unmount cancels the old data plane |
| `attach` / incremental GHOSTSNP | `subscription_id` plus attachment generation | A new generation must ignore the previous stream | `closeStream` and generation bump |
| `read_screen` | attachment generation plus `session_id` | A stale generation returns `undefined`; a current generation must keep the Hub body | No browser cache of screen text |
| live `TerminalOutput` | same subscription transaction | Buffer until GHOSTSNP install, then flush | Drop buffered bytes on generation change |
| `detach` / transport-lost | previous `subscription_id` | Must not delete a replacement subscription | Existing transport-lost path |

`production_path_proof`: live packaged default mode, not the shared-Hub shim. Path is mounted `terminalControl.readScreen` to `HubTerminalDataPlane.readScreen` to WebRTC `read_screen` to Hub pass-through to Core `read_screen`. Proof is two consecutive `npm run smoke:live-packaged-protocol` runs against Hub `9bd71ef` and Core `fc541a59` whose cycle-0 oracle still requires the final-row marker in `readScreen`. A unit test or a Restty screenshot is not enough. Current Hub `main` reaching this path is owned by `ticket_1786841441_227450`.

`ownership_identity`: Web uses `attachmentGeneration` and `session_id`. Attach uses `subscription_id`. Delayed `read_screen` from generation N must not be returned as generation N+1. Core and Hub owner identity stay on those repositories if the differential leaves this run.

`sibling_fail_closed_policy`: on success, Hello, attach, live output, mounted input, OSC, palette, retained-history, and later alt-screen cycles must still pass. On ultimate Web request failure, return `undefined` and keep polling until the existing 20-second bound. Do not fail-closed the Hub or sibling sessions.

## Risks

- The first command may never reach the PTY because navigate-away detaches immediately. A Web input-loss fix is in scope. A Core/Hub drop of unread input is not, except as a registered dependency.
- A Web generation guard can hide a good Core screen as `undefined` for the whole poll. Implement must log defined versus missing bodies, not only marker absence.
- Adding diagnostics can accidentally relax the oracle. Source tests must keep the `finalRowPrefix` / `readScreen` requirement.
- Putting `ReadScreen.text` into Restty would violate the GHOSTSNP-primary rule.
- Using Hub `main` `d52c3eb` as the first reproduction fails at `exerciseSessionTypes` and never reaches the oracle. That is Hub ticket `ticket_1786841441_227450`, not this Web defect.
- A remount resize or input before FINISH and `Attached` can change producer geometry while the alt-screen redraw or snapshot is still in flight. [[incremental resize gating covers both the WASM grid and PTY sink]] and [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]] make that a Web-owned suspect.
- A Core last-row clip can look like a Web bug if Implement never compares a side-channel `read_screen`.

## Acceptance checks

Required live proof, default harness mode:

```bash
BOTSTER_HUB_BIN=<hub-9bd71ef> \
BOTSTER_SESSION_WORKER_BIN=<core-fc541a59-session-worker> \
npm run smoke:live-packaged-protocol
```

Run that command twice. Both runs must pass `proveRapidAlternateScreenReattach` cycle 0. The oracle must still require the final-row marker in `readScreen`. Record harness mode, branch marker, and binary provenance. These two candidate-pair runs are the required product proof for this Web ticket.

Also run repository charter gates after any Web code change:

- `npm run typecheck`
- `npm test`
- `npm run build`

If the Web consumer or remount attach path changes, add or extend a focused `src/App.test.mjs` case for the exact request-identity, generation, or pre-FINISH resize/input bug. If attach handling changes, prove READY paint through `createBinarySnapshotReader` and authentic frames. Those units are not a substitute for the two live candidate-pair runs.

If the owner is Core, this Web run does not merge a product fix. It registers a Core ticket on `tgt_1f7bce66eb304881980f7c83125ea6c16e` with the differential evidence and keeps this ticket blocked on that dependency.

If Review later proves a Hub adapter drop of `read_screen` text, register a new Hub ticket on `tgt_7e208a0c76a44980a83b63af976b1f22`. Do not reuse `ticket_1786841441_227450` for that defect. Do not edit Hub here.

Current-main integration remains gated on `ticket_1786841441_227450`. That ticket must keep `exerciseSessionTypes` and must reach the later terminal lane. This Web ticket may merge the candidate-pair oracle fix to `main` without waiting for that Hub ticket. Do not open a pull request.

## Vault gaps

- No current note states that rapid navigate-away during a multi-row alt-screen redraw can leave live Restty echo intact while `ReadScreen` lacks the final-row marker.
- Capture after Implement owns the failure, not before. Candidate title only if the differential is durable: alternate-screen reattach must keep the last row in ReadScreen.

## Implementation sequence

1. Confirm worktree hygiene. Restore `.gitignore` from HEAD only if it is empty or missing. Do not truncate it.
2. Build or locate Hub `9bd71ef` and Core `fc541a59` session-worker binaries. Do not use Hub `main` `d52c3eb` as the first reproduction.
3. Reproduce cycle 0 once and keep the first failing `readScreen` body.
4. Run the differential in the previous Scope section. Also record whether remount sent resize or input before FINISH and `Attached`. Classify owner before editing product code.
5. Apply only the owning Web consumer fix, or register the correct-repo dependency.
6. Keep the oracle. Add only the unit coverage the Web fix needs.
7. Run typecheck, unit tests, build, and two consecutive candidate-pair live packaged-protocol smokes.
8. Merge the Web oracle fix to `main` when those two runs pass. Do not wait for `ticket_1786841441_227450`. Do not open a pull request.
