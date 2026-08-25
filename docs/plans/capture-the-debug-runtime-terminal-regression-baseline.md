# Capture the debug-runtime terminal regression baseline

Plan for ticket `ticket_1787603669_760394` in project `project_1787600579_585482`
(Botster Isolated Subscription Data Plane), pipeline `botster_stack_delivery`,
run `run_1787632387_839095`, step `botster_stack_plan`.

**Revision 9**, after Plan Review `review_1787637601_156332` returned
`changes_required` an eighth time, with one low finding:

- `finding_1787637601_996900`: two risk mitigations contradicted the final
  contract. One said the plan records `paint_oracle` per arm, although §6.3.2 and
  §7 pin one capture-level `cdp_screencast` constant. The other said both stamps
  are `Date.now()`, although `t_pty` comes from Bash `$EPOCHREALTIME` under
  `shell_epochrealtime`. Both rows are rewritten and both were read back out of
  the file. The same sweep found §12 assumption 6 carrying the identical pair of
  stale claims, plus a sentence saying revision 3 removed the shell timestamp
  dependency without noting that revisions 5 and 6 reinstated it behind the
  §6.2.1 handshake. That assumption is rewritten too.

**Revision 8**, after Plan Review `review_1787637212_457290` returned
`changes_required` a seventh time, with one blocker:

- `finding_1787637212_599586`: the acceptance table still carried the revision 4
  G16 row, which requires exactly one warm-up log line, requires the paint change
  after `t_pty`, and requires a paint calibration that §6.3.2 deleted. As written
  that gate rejected a valid capture under either clock, and it contradicted
  §6.2, §6.3, and §6.5.

  **This one is worse than a stale row.** I reported G16 as fixed in two earlier
  finding resolutions, but the edit never landed in the file: it targeted text
  that a previous revision had already changed, so the replacement silently did
  nothing and I did not check the result. Revision 8 rewrites G16 to match §6.5
  exactly, and I verified the row in the file afterwards rather than trusting the
  edit.

  The same unverified-edit failure had left two other claims unbacked, and this
  revision fixes both: G6 now rejects any `paint_oracle` other than
  `cdp_screencast`, and G19 now requires `append_cost_calibration_ms` under
  `shell_epochrealtime`. The audit the finding asked for also corrected G18's
  dispatcher-variant clause, the `key_to_pty` endpoint wording in §7, and two risk
  rows that still described a per-arm paint oracle.

**Revision 7**, after Plan Review `review_1787636833_416607` returned
`changes_required` a sixth time, with one finding:

- `finding_1787636833_238713` (high): the `screenshot_poll` fallback defined only
  a polling interval, never whether `t_paint` was the screenshot request start,
  its completion, or a point between, and never bounded the variable capture
  duration of that host-to-browser round trip. Its paint values would have had no
  stable endpoint. This revision takes the finding's preferred smallest fix and
  **deletes the fallback**. `cdp_screencast` is the only paint oracle, the
  validator rejects any other value, and an arm without `Page.startScreencast`
  blocks the cross-arm paint families rather than substituting a second
  instrument. The fallback was speculative in the first place: both arms run the
  same Playwright Chromium, so either both reach the protocol or neither does.

**Revision 6**, after Plan Review `review_1787636271_653821` returned
`changes_required` a fifth time. All three findings were correct, and all three
were consequences of revision 5 describing a two-clock design without writing it
out. Changes in this revision:

- `finding_1787636271_189997` (blocker): revision 5 kept only the POSIX
  marker-only dispatcher, so the `shell_epochrealtime` path it described was not
  buildable. §6.2 now writes both variants in full: §6.2.1 the exact handshake
  command with a numeric acceptance band, §6.2.2 variant A started with
  `exec bash --noprofile --norc`, §6.2.3 variant B started with `exec sh`, §6.2.4
  both log formats, and §6.2.5 which properties belong to which variant. The
  "no bash feature" and "no environment dependency" claims are now scoped rather
  than stated as if they covered the whole design. §10 replaces the single
  `seed.sh` entry with the two dispatcher files and the shared workloads.
- `finding_1787636271_455482` (high): revision 5 called `t_pty` the append itself.
  `"$EPOCHREALTIME"` is a `printf` argument, so the shell evaluates it before the
  redirection appends. §6.3.1 renames the endpoint to the clock evaluation
  immediately before the append, and variant A's second append measures the
  interval to the completed append as `append_cost_calibration_ms`, recorded as a
  component rather than a subtractable correction.
- `finding_1787636272_619639` (high): G16 still required the warm-up hash change
  to fall after `t_pty`, which is the ordering §6.3.1 withdrew, and required
  calibrations unconditionally including the deleted paint clock offset. G16 and
  §6.5 now attribute the warm-up paint change by marker with no ordering
  requirement, and require each calibration only for the clock and oracle the
  capture actually negotiated.

**Revision 5**, after Plan Review `review_1787635739_699638` returned
`changes_required` a fourth time. All three findings were correct. Changes in that
revision:

- `finding_1787635739_874404` (blocker): revision 4 claimed that the dispatcher's
  write order made `t_pty` precede the probe's paint change, and gated on it. The
  claim was false. Write order orders the two writes, not the two observations: an
  asynchronous host file-watcher callback can run after the compositor has already
  painted, so the gate would have rejected valid repetitions and biased the set
  toward fast callbacks. §6.3.1 replaces it. The harness now prefers a PTY
  timestamp the shell itself produces, accepted only after a handshake proves the
  shell clock advances and tracks the host clock, and recorded as
  `pty_clock: "shell_epochrealtime"`. When that handshake fails, the host-watcher
  fallback is used and the plan states its limits instead of hiding them: no
  `t_pty` versus `t_paint` ordering is asserted, the watcher calibration is an
  uncertainty band rather than a subtractable floor, negative `pty_to_paint_ms`
  values are recorded rather than discarded, and `decomposition_valid` is `false`.
  G8 now asserts only that `t_key` precedes both endpoints.
- `finding_1787635739_911538` (high): revision 4 let one arm use compositor
  timestamps while the other polled. §6.3.2 negotiates `paint_oracle` once for the
  whole two-arm capture, and the same rule now governs `pty_clock`. Both are
  capture-level record members, and G18 rejects a record whose arms imply
  different values. If either arm cannot support the primary, both downgrade
  together or the cross-arm paint families block.
- `finding_1787635739_140104` (high): §6.3.2 completes the CDP contract. Every
  frame is acknowledged with its `sessionId`, teardown stops the screencast and
  detaches the session, `metadata.timestamp * 1000` is used directly as epoch
  milliseconds and the revision 4 known-change offset calibration is deleted
  because it would have absorbed the latency being measured, and the exact
  frame-coordinate transform is defined from `pageScaleFactor`, `scrollOffsetX`,
  `scrollOffsetY`, `offsetTop`, and a measured `scale`. A frame lacking the
  optional `metadata.timestamp` is discarded and counted. New gate G18 adds the
  sustained-frame, transform-stability, and crop-marker checks.

**Revision 4**, after Plan Review `review_1787635233_314942` returned
`changes_required` a third time. Both findings were correct and both concerned
the paint endpoint. Changes in that revision:

- `finding_1787635233_741153` (blocker): the revision 3 dispatcher ran
  `stty -echo` and wrote only the log, so it produced no terminal output and every
  paint endpoint had nothing to observe. §6.2 adds a second `printf` that emits
  `botster-baseline-paint:<marker>` through the PTY after the log append, fixes
  that output order, and explains why `stty -echo` now helps: the typed probe line
  does not paint, so the first change after the measured Enter is attributable to
  the dispatcher's marker alone. G16 gains a warm-up precondition that requires
  the same marker to change the rendered terminal before any paint measurement.
- `finding_1787635233_778119` (high): the in-page `requestAnimationFrame`
  canvas-pixel sampler cannot execute. Restty requests a WebGPU context
  (`src/vendor/restty/chunk-3mc71e83.js:1522`) and can use WebGL2 (`:1723`), an
  injected script does not own that device, and a container element exposes no
  pixel buffer, so calling it a fallback was wrong. §6.3 moves the paint oracle to
  the host: a CDP `Page.startScreencast` session, compositor-timestamped frames
  cropped to a frozen terminal bounding box and hashed. Both arms reach it
  identically through the same Playwright Chromium. That revision also added a
  `screenshot_poll` fallback, which revision 7 later deleted.

**Revision 3**, after Plan Review `review_1787634482_723479` returned
`changes_required` a second time. Changes in that revision:

- `finding_1787634482_538653` (blocker): the revision 2 probe could not execute.
  `$EPOCHREALTIME` is a bash feature and the modular production session runs `sh`
  (`scripts/live-packaged-protocol-harness.mjs:6024`), so both the timestamp and
  the marker expanded empty. §6.2 replaces it with a frozen POSIX `sh` dispatcher
  that writes only the marker with a builtin `printf`, and §6.3 moves the
  timestamp to a host-side watcher. §6.2 also fixes the marker injection and names
  the final Enter as the only measured keydown. §6.5 and G16 prove the probe is
  live before any measurement.
- `finding_1787634483_606028` (high): §7 freezes the full legacy Restty commit
  `cd1911d0f88606270b1457c6995a3c04cb497edf`, and G14 now requires a full
  40-character revision and blocks the arm when exact source identity cannot be
  proved.
- `finding_1787634483_623553` (high): §10 no longer directs Implement to build the
  retired wire oracle or seven families. It names the keydown stamp, the paint
  oracle, the host watcher, and all eight families.
- `finding_1787634483_166548` (high): G5 no longer mutates the supplied Hub
  checkout. It clones a scratch checkout under `$TMPDIR`, builds only there, and
  G17 proves both supplied checkouts are unchanged.
- `finding_1787634483_772046` (low): §2 now loads and records
  `[[botster-architecture]]`, `[[cli-patterns]]`, and `[[spa-patterns]]`, and
  states the one constraint they add.

**Revision 2**, after Plan Review `review_1787633696_367103` returned
`changes_required`. Changes in that revision:

- `finding_1787633696_107977` (blocker): the wire oracle is deleted. Both arms
  encrypt terminal bytes at the DataChannel, so a frame-level marker search finds
  nothing, and echo receipt is not PTY arrival. §6 replaces it with a PTY oracle
  on the host wall clock plus the paint oracle, and names the metric honestly.
- `finding_1787633696_468463` (high): §7.1 splits the ambiguous
  `event_saturation` family into `control_response_saturation` (cross-stack) and
  `package_event_saturation` (modular-only, legacy `not_applicable`), and defines
  `sibling_saturation` arm-neutrally. Approved by `question_1787633836_780366`.
- `finding_1787633696_945152` (high): §7 makes per-arm Restty provenance a
  required record member, and G14 rejects a missing or unverified one.
- `finding_1787633696_848106` (high): §14 replaces the bare G5 npm script with
  the complete pinned build and smoke sequence.
- `finding_1787633696_171220` (medium): §5 permits `src/App.test.mjs` explicitly
  while keeping the prohibition on production files under `src/`.
- `finding_1787633696_983713` (low) and `finding_1787633696_469509` (info) are
  process and infrastructure items. This visit resubmits complete gate evidence
  and reuses the existing Plan checklist rather than creating another.

This ticket publishes the observation format that `ticket_1787600689_646958`
(Restty vendor) and `ticket_1787600679_990088` (integration cold cut) must reuse.
It records a pre-change product baseline. It changes no terminal transport code
and no Restty revision.

## 1. Target

| Field | Value |
|-------|-------|
| Target repository | `botster-web` (`https://github.com/trybotster/botster-web.git`) |
| `target_id` | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Base commit | `bcf89f1102b8adf333cd93edb09274e04dab22eb`, equal to `origin/main` |
| Branch | `project-pipelines/ticket_1787603669_760394` |
| Worktree | clean, tracked `.gitignore` present (14 lines), path contains no `:` |
| Cargo gates | none in this repository; no `CARGO_TARGET_DIR` override needed for the Web gates |

The `target_id` came from the run record, not from the process working
directory. `project_pipelines_get_project` maps this `target_id` to the three
Web tickets in this project (676, 684, 689) and to this ticket.

## 2. Playbooks and notes loaded

Repository playbook: `[[botster-web-playbook]]`.

Role playbooks, in load order:

1. `[[planner-playbook]]`
2. `[[botster-planner-playbook]]`
3. `[[botster-web-playbook]]`
4. `[[botster runtime teardown lenses]]` (class applies in harness scope, see §9)

Required `[[botster-planner-playbook]]` context maps, loaded on the second Plan
Review return per `finding_1787634483_772046`:

- `[[botster-architecture]]` — the domain map and source of architectural truth.
  Its Repository Ownership section confirms the routing this plan already used:
  `botster-web` owns the Ionic React client, UiNode rendering, Restty, and browser
  conformance. It adds no new constraint to this ticket.
- `[[cli-patterns]]` — Rust CLI, TUI, PTY, and terminal-layer constraints. Its PTY
  Patterns section adds one constraint the plan now states explicitly:
  `[[restty is a client renderer not authoritative terminal infrastructure]]`.
  That is why §6.4 keeps the authoritative arrival endpoint on the PTY oracle and
  reports the paint endpoints separately, rather than treating a rendered canvas
  as terminal truth.
- `[[spa-patterns]]` — React SPA and entity-store frontend constraints. It
  confirms `[[a page reload is not a reconnect]]`, already loaded, and adds no new
  constraint here because this ticket runs no reconnect proof. Reconnect proof
  belongs to `ticket_1787600676_914408` and `ticket_1787600684_892051`.

`[[project-pipelines-playbook]]` was not loaded. This ticket changes no Project
Pipelines package or plugin path.

Atomic notes read for this plan:

- `[[the shared hub browser driver is the live packaged protocol harness behind a shim]]`
- `[[live packaged harness failures are scoped to the active mode branch]]`
- `[[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]`
- `[[botster terminal attach owns one size snapshot and live output transaction]]`
- `[[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]`
- `[[botster web attach installs GHOSTSNP before buffered live bytes]]`
- `[[ready then history is a compatibility feature not an Attach field]]`
- `[[Web vendors a complete Restty build from the approved commit]]`
- `[[incremental browser attach proof uses the authentic Restty reader]]`
- `[[web event plane budgets are published numeric host limits]]`
- `[[hub client event queue max requires Botster test mode]]`
- `[[a page reload is not a reconnect]]`
- `[[current botster is a modular repository family not the legacy trybotster monorepo]]`
- `[[legacy trybotster notes are not current modular botster contracts]]`
- `[[terminal transport north star publishes behavioral oracles not numeric budgets]]`
- `[[live hub proof records distinct hub and locked core binary provenance]]`

## 3. Context loaded

Read in `botster-web` at `bcf89f1`:

- `package.json` — the smoke script vocabulary and the two pinned packages
  (`@trybotster/terminal-protocol` 0.1.0, `@trybotster/ui-contract` 0.3.3).
- `scripts/live-packaged-protocol-harness.mjs` (9,358 lines) — the packaged
  browser harness, `installLiveHarnessPageHooks`, the package-event flood lane
  at lines 1834-1932, `proveSiblingSlowClientAndHostStayUp` at line 7038, the
  isolated-Hub spawn at lines 9059-9175.
- `scripts/live-packaged-protocol-helpers.mjs` — `LOCKED_HUB_BUILD_COMMAND`,
  `LOCKED_SESSION_WORKER_BUILD_COMMAND`, `candidateBinaryProvenance`.
- `src/botster/hubTerminalDataPlane.ts` (1,408 lines) — `recordLiveHarnessTerminal`
  and its 53 call sites, including `attach`, `attach_state`, `ghostsnp_install`,
  `input`, `output`, `terminal_subscription_closed`.
- `src/botster/resttyRenderer.ts` — `renderer_write` and `before_input`.
- `src/botster/protocolPlanes.ts` — the required host and terminal feature sets.
- `docs/plans/`, `docs/reports/` — the plan and report placement convention in
  this repository. There is no `.github/workflows` directory today.

Read in `botster-hub`:

- `docs/plans/freeze-subscription-ownership-and-capture-the-regression-baseline.md`
  — the frozen architecture contract. §4 assigns the pre-change observation set
  and the observation format to this ticket. §14 row A20 requires post-cut
  observations to reuse the frozen format. §17 names the throughput risk this
  baseline must be able to detect.
- `.github/workflows/loaded-daemon-lifecycle.yml:69` — the only existing use of
  the `botster-ubuntu-24.04-16core` label in the stack.
- `docs/reports/prove-the-event-plane-cannot-lag-or-block-hub-operations-implement.md`
  — records that no runner carries that label (`question_1787447435_428566`).
- `Cargo.lock` at `f6db5c4` — locked `botster-core` revision
  `7eafa470a18025895995bbedc20d34b58106a03b`.

Read in `~/Rails/trybotster` (legacy arm, read-only):

- `mise.toml:98` — `run_hub_debug`.
- `Procfile.dev` — the Rails web, vite, jobs, and MCP processes.
- `app/frontend/components/terminal/TerminalView.jsx` — the legacy client mounts
  Restty and exposes no `__BOTSTER_RESTTY_DEBUG__` global.

Pipeline context read: the ticket, the run, the gate prompt, the project
description, all twelve project tickets, the closed dependency
`ticket_1787600670_129312`, and the answered blocking question
`question_1787632597_922353`.

## 4. Resolved ambiguity

The ticket phrase "the new debug runtime" and "the legacy debug runtime" appears
nowhere in the stack. `grep -ri "debug runtime"` returns zero matches across
`botster-web`, `botster-hub`, `botster-core`, `botster-tui`, and
`botster-project-pipelines`. The architecture contract never defines it.

`question_1787632597_922353` resolves both arms and the runner policy. The answer
is binding for this plan.

**Legacy arm — the trybotster monorepo product stack.**

| Field | Value |
|-------|-------|
| Repository | `~/Rails/trybotster` |
| Frozen revision | `f598075e6c143ef14b34d3a3dffdf2ec6a8d9eb6` |
| Hub launch | `mise r run_hub_debug` |
| Expanded task | `cd cli && RUST_LOG=debug BOTSTER_DUMP_RESTTY_FIXTURES=1 BOTSTER_DEV=1 BOTSTER_LUA_PERF=1 cargo run` |
| Client | the Rails app plus `app/frontend`, started through `bin/dev` |

**Modular arm — the current repository family.**

| Field | Value |
|-------|-------|
| Hub revision | `f6db5c436f72b151fd6dacde61d3f4836a4dc925` |
| Web revision | `bcf89f1102b8adf333cd93edb09274e04dab22eb` (this run's clean base) |
| Locked Core revision | `7eafa470a18025895995bbedc20d34b58106a03b`, read from Hub `Cargo.lock` at `f6db5c4` |
| Hub build | `cargo build --locked --bin botster-hub` |
| Worker build | `cargo build --locked -p botster-core-daemon --bin botster-session-worker` |
| Client launch | `BOTSTER_HUB_BIN=<hub>/target/debug/botster-hub BOTSTER_SESSION_WORKER_BIN=<hub>/target/debug/botster-session-worker` plus the packaged Web app |

Both arms are debug cargo builds. Neither arm uses `--release`.

This is a **product baseline**, not a transport-causality experiment. The two
arms differ in Hub, Core, client, and Lua runtime at once. No row of this
baseline may be read as evidence that any single component caused a difference.
The observation format carries that statement as a required field so a later
ticket cannot quote a number without it.

## 5. Scope

In scope:

1. A client-neutral observation harness in `botster-web` that drives both arms.
2. The frozen observation format, published as a document and as an executable
   schema plus validator.
3. The eight observation families of §7, which cover the seven the ticket
   names after §7.1 splits the ambiguous `event_saturation` term.
4. A recorded local two-arm observation set, marked observational and non-gating.
5. A `workflow_dispatch` GitHub workflow pinned to `botster-ubuntu-24.04-16core`.
6. A blocked controlled-runner record that names the exact missing-runner reason
   and the rerun procedure.
7. The deterministic correctness gate, kept separate from every wall-clock value.

Non-scope:

- Do not change terminal transport in any repository.
- Do not change the vendored Restty revision. `ticket_1787600689_646958` owns it.
- Do not change any production file under `src/`. §6 explains why no production
  change is needed. `src/App.test.mjs` is explicitly permitted, because it is this
  repository's only test entry point and G6 needs it. Nothing under
  `src/botster/`, `src/app/`, or `src/vendor/` changes.
- Do not change any file in `~/Rails/trybotster`. The legacy arm is driven from
  an unmodified checkout at the frozen revision.
- Do not add DataChannel isolation, entity channels, or event channels. Tickets
  676, 684, and the Hub tickets own those.
- Do not assert a wall-clock threshold anywhere. No timing value gates CI.
- Do not claim a controlled-runner observation set. The runner does not exist.

## 6. Design: one client-neutral oracle pair for both arms

### 6.1 What two review returns removed

**Revision 2 deleted the wire oracle.** The first plan wrapped `WebSocket` and
`RTCDataChannel` message events and searched each frame for a plaintext probe
marker. `src/botster/webrtcDaemonClient.ts:1726-1745` decrypts AES-GCM after the
channel event, and `app/frontend/lib/connections/terminal_connection.js:5` states
the legacy path is end-to-end encrypted, so that oracle would find no marker on
either arm. Its end point was also echo receipt, which is not PTY arrival.

**Revision 3 deleted `$EPOCHREALTIME`.** Revision 2 asked the session shell to
write its own timestamp. That does not execute. The modular production session
runs `sh <path>` (`scripts/live-packaged-protocol-harness.mjs:6024`), and
`$EPOCHREALTIME` is a bash feature that expands empty under `sh`. Revision 2 also
left the marker injection and the measured keydown boundary undefined. Revision 3
replaces the shell timestamp with a host-side watcher and specifies every step.

### 6.2 The frozen probe, and the two dispatcher variants

Both arms run one dispatcher in an ordinary shell session. The harness starts it
by typing one setup command and pressing Enter, so nothing depends on an arm's
spawn API accepting an arbitrary command. That matters: the legacy browser API's
`add_session` takes a session type name such as `shell`
(`app/frontend/lib/connections/hub_connection.js:322-325`), not a command line.

Revision 6 writes both dispatcher variants out in full. Revision 5 described a
negotiated shell clock in §6.3.1 but left only the POSIX marker-only script here,
so Implement could not have built the `shell_epochrealtime` path at all.

#### 6.2.1 The clock handshake, typed before any dispatcher

The harness types this line into the arm's shell session and reads the resulting
file on the host. `/ABS/HANDSHAKE/PATH` is substituted as a literal absolute path.

```sh
command -v bash >/dev/null 2>&1 && bash -c 'printf "%s %s\n" "$EPOCHREALTIME" "$EPOCHREALTIME"' > /ABS/HANDSHAKE/PATH || : > /ABS/HANDSHAKE/PATH
```

`bash` re-evaluates `EPOCHREALTIME` at each reference, so a working clock yields
two different values on one line. The harness accepts `shell_epochrealtime` only
when **all** of these hold, and records the raw line either way:

| Check | Exact rule |
|-------|------------|
| Shape | both fields match `^[0-9]{10}\.[0-9]{6}$` |
| Advances | the second value is greater than or equal to the first, and the pair is not identical |
| Tracks the host | `|value * 1000 - hostDateNow| <= 2000` milliseconds for both fields |
| Empty file | an empty handshake file means no `bash`, so the arm reports `host_watcher` |

§6.3.2 turns the two arms' results into one capture-level `pty_clock`: both arms
must report `shell_epochrealtime` for the capture to use it.

#### 6.2.2 Variant A, `pty_clock: shell_epochrealtime`

Started by typing `exec bash --noprofile --norc /ABS/SEED/PATH`. The harness
substitutes `/ABS/LOG/PATH` as a literal.

```bash
stty -echo 2>/dev/null || true
printf 'botster-baseline-ready\n'
while IFS= read -r line; do
  case "$line" in
    botster-baseline-probe:*)
      m=${line#botster-baseline-probe:}
      m=${m%$'\r'}
      printf '%s %s\n' "$EPOCHREALTIME" "$m" >> /ABS/LOG/PATH
      printf '%s %s post\n' "$EPOCHREALTIME" "$m" >> /ABS/LOG/PATH
      printf 'botster-baseline-paint:%s\n' "$m"
      ;;
    botster-baseline-exit) exit 0 ;;
  esac
done
```

The second append exists for calibration, not for the endpoint. §6.3.1 explains
what it measures.

#### 6.2.3 Variant B, `pty_clock: host_watcher`

Started by typing `exec sh /ABS/SEED/PATH`. This is the POSIX variant, and it is
the only one that runs when either arm lacks a proven `bash` clock.

```sh
stty -echo 2>/dev/null || true
cr=$(printf '\r')
printf 'botster-baseline-ready\n'
while IFS= read -r line; do
  case "$line" in
    botster-baseline-probe:*)
      m=${line#botster-baseline-probe:}
      m=${m%$cr}
      printf '%s\n' "$m" >> /ABS/LOG/PATH
      printf 'botster-baseline-paint:%s\n' "$m"
      ;;
    botster-baseline-exit) exit 0 ;;
  esac
done
```

Variant B uses `cr=$(printf '\r')` rather than `${m%$'\r'}` because `$'...'` is a
bash feature. That single command substitution runs once at session start, not
once per probe.

#### 6.2.4 Log formats

| Clock | Line format |
|-------|-------------|
| `shell_epochrealtime` | `<epoch_seconds.microseconds> <marker>` and a second `<epoch_seconds.microseconds> <marker> post` |
| `host_watcher` | `<marker>` |

The harness parses by the negotiated clock, and G16 rejects a log line that does
not match the negotiated format.

#### 6.2.5 Properties, and which variant each applies to

**Both variants.** The probe costs no process spawn: `printf` is a builtin in both
`bash` and `dash`. Nothing depends on session environment, because the harness
substitutes absolute log paths as literals rather than reading a variable. The
measured keydown is the final Enter of the probe line and nothing else; the
harness waits for the sampled region's hash to hold stable for the settle window
before sending it, so typing latency sits outside the measurement.

**Output order.** Every variant appends first and prints the visible marker
second. That orders the two writes. It does **not** order the two observations,
and §6.3.1 states exactly what that does and does not buy.

**`stty -echo` is deliberate.** The typed probe line does not paint, so the first
change in the sampled region after the measured Enter is attributable to the
dispatcher's own marker and to nothing else.

**Variant B only.** Variant B is pure POSIX and uses no bash feature. Revision 5
stated that property as if it covered the whole design; it covers this variant.
Variant A requires `bash`, which §6.2.1 proves before the capture selects it.


### 6.3 The three endpoints, and what orders them

| Symbol | Meaning | Source |
|--------|---------|--------|
| `t_key` | the browser dispatched the final Enter of the probe line | capture-phase `keydown` listener installed by `addInitScript`, `Date.now()` |
| `t_pty` | the dispatcher evaluated its clock immediately before appending the marker, or the host observed the append | see §6.3.1 |
| `t_paint` | the dispatcher's visible probe marker reached the rendered terminal | §6.3.2 |

`t_key` causes both other endpoints, so `t_key` precedes both in every valid
repetition. That is the **only** ordering this plan asserts. §6.3.1 explains why
revision 5 withdrew a second ordering claim that revision 4 made and could not
support.

#### 6.3.1 The PTY endpoint and its clock

Revision 4 claimed that fixing the dispatcher's write order made `t_pty` precede
the probe's paint change, and made that a gate. **The claim was false and the gate
was harmful.** The shell's write order orders the two *writes*. It does not order
the two *observations*: `t_pty` was the moment an asynchronous host file watcher
ran its callback, and `t_paint` is a compositor frame timestamp. A watcher
callback can run after the compositor has already painted. A gate asserting
otherwise would reject valid repetitions and bias the surviving set toward fast
watcher callbacks.

Revision 5 fixes this in two parts.

**Part one: prefer a PTY timestamp the shell itself produces.** The dispatcher is
started by a typed setup command, so the harness can select the interpreter and
then *prove* what it got rather than assume it. The setup handshake runs a fixed
probe that prints two consecutive sub-second timestamps. The harness accepts the
shell clock only when all of the following hold:

1. Both values parse as epoch seconds with sub-second digits.
2. The two values differ, which proves the source is not a frozen constant.
3. Both sit within a recorded sane band of the host's `Date.now()`.

When the handshake of §6.2.1 passes in both arms, the dispatcher writes its own
timestamp beside the marker and the record carries
`pty_clock: "shell_epochrealtime"`.

**`t_pty` is not the append.** `"$EPOCHREALTIME"` is a `printf` argument, so the
shell evaluates it *before* the redirection performs the append. Revision 5 called
it the append itself, which was wrong. `t_pty` under this clock is exactly *the
moment the dispatcher evaluated its clock, immediately before appending the
marker*, and the plan uses that wording everywhere.

The interval between that evaluation and the completed append is measured, not
assumed. Variant A's second append (§6.2.2) evaluates the clock again *after* the
first append has returned, so `post - pre` bounds one append plus one `printf`.
The capture records that distribution as `append_cost_calibration_ms`. It is a
recorded component of `key_to_pty`, not a subtractable correction, and
`decomposition_valid: true` under this clock means the endpoint is a real shell
clock reading with that bound stated, not that the interval is zero. Revision 2 assumed this source without
proving it and was correctly rejected, because `$EPOCHREALTIME` is a bash feature
that expands empty under the `sh` the modular session starts
(`scripts/live-packaged-protocol-harness.mjs:6024`). The difference now is the
handshake: the plan proves the clock exists before it records a single number,
and falls back when it does not.

**Part two: when no such clock exists, stop pretending.** The fallback keeps the
POSIX dispatcher of §6.2 and the host log watcher, and the record carries
`pty_clock: "host_watcher"`. Under that clock `t_pty` is an *observation* of the
append, not the append. The plan then states plainly:

- No ordering between `t_pty` and `t_paint` is asserted or gated.
- `watcher_detection_calibration_ms` is recorded as an **uncertainty band** on
  `t_pty`, not as a floor that can be subtracted away.
- `pty_to_paint_ms` may be negative. Negative values are recorded, never
  discarded, because discarding them is exactly the bias the review identified.
  The record marks the family `decomposition_valid: false` under this clock, so a
  later ticket cannot read `key_to_pty` and `pty_to_paint` as a clean split.

Under `shell_epochrealtime`, `decomposition_valid` is `true` and
`pty_to_paint_ms` is a real decomposition.

#### 6.3.2 The paint oracle

Revision 4 replaced an in-page `requestAnimationFrame` canvas sampler, which
cannot execute. The modular Restty renderer requests a WebGPU context
(`src/vendor/restty/chunk-3mc71e83.js:1522`) and can use WebGL2 (`:1723`). An
injected script does not own that GPU device, so it cannot read the drawing
buffer, and a terminal container element exposes no pixel buffer at all.

The oracle is a Chrome DevTools Protocol screencast, reached identically by both
arms through the same Playwright Chromium (`playwright` 1.60.0). Revision 5
completes the contract the review found incomplete.

**Frame loop and acknowledgment.** The harness opens `context.newCDPSession(page)`
and calls `Page.startScreencast`. It subscribes to `Page.screencastFrame` and
**acknowledges every frame** with `Page.screencastFrameAck` carrying that frame's
`sessionId`. Chromium stops emitting frames without the acknowledgment; Playwright
itself sends it at
`node_modules/playwright-core/lib/coreBundle.js` (`screencastFrameAck`,
`{ sessionId: payload.sessionId }`). Teardown calls `Page.stopScreencast` and
detaches the CDP session before the browser context closes, so no frame from a
retired arm reaches the next one.

**Timestamp.** `Page.ScreencastFrameMetadata.timestamp` is a
`Network.TimeSinceEpoch`, that is, epoch **seconds**. The harness uses
`metadata.timestamp * 1000` directly as epoch milliseconds. Revision 4's
`paint_clock_offset_calibration_ms` is deleted: calibrating against a "known
change" would have absorbed the very product latency being measured, which the
review correctly identified. That field must not reappear.

`timestamp` is optional in the protocol type. A frame without a timestamp cannot
carry a paint endpoint, so the harness discards it, records the discard count, and
G18 blocks the paint families for that arm if any measured repetition's endpoint
would have depended on such a frame.

**Coordinate transform.** A CSS-pixel bounding box cannot be applied to an encoded
frame without a defined transform, and revision 4 omitted one. The harness:

1. Sets `maxWidth` and `maxHeight` at or above the frozen viewport in device
   pixels, so Chromium performs no additional downscale.
2. Computes `scale = encodedFrameWidth / metadata.deviceWidth`, and records the
   measured `scale` per arm. G18 requires the same `scale` across every frame of a
   capture.
3. Maps the frozen CSS bounding box to frame pixels as
   `x' = (x - metadata.scrollOffsetX) * metadata.pageScaleFactor * scale` and
   `y' = ((y - metadata.scrollOffsetY) * metadata.pageScaleFactor + metadata.offsetTop) * scale`,
   with width and height scaled the same way.
4. Crops the decoded frame to that rectangle and hashes the cropped bytes. A hash
   change is a paint change.

The capture holds `scrollOffsetX`, `scrollOffsetY`, and `pageScaleFactor` fixed by
construction, and G18 asserts they do not change mid-capture, so the transform
stays constant for a whole capture.

**One oracle, and no fallback.** `cdp_screencast` is the only paint oracle. If
`Page.startScreencast` is unavailable in either arm, the capture blocks the
cross-arm paint families with a typed reason. It does not substitute a second
instrument.

Revision 7 deleted the `screenshot_poll` fallback that revisions 4 through 6
carried. A timed `elementHandle.screenshot()` loop is a host-to-browser round trip
with a variable capture duration, and the plan defined only its polling interval,
never whether `t_paint` was the request start, the completion, or something
between. Its paint values would have had no stable endpoint and an unrecorded
instrument cost. The fallback was also speculative: both arms run the same
Playwright Chromium, so either both reach the protocol or neither does. Deleting
it removes a branch, removes a whole class of unstated instrument error, and makes
`paint_oracle` a constant that a future change must bump `format_version` to
alter.

The one-per-capture rule still governs `pty_clock`: both arms use
`shell_epochrealtime` or both use `host_watcher`, never one of each.


### 6.4 What `key_to_pty` includes, stated plainly

`key_to_pty` is `t_pty - t_key`: the final Enter of the probe line, to `t_pty` as
§6.3.1 defines it for the negotiated clock — the dispatcher's clock evaluation
immediately before the append under `shell_epochrealtime`, or the host's
observation of the append under `host_watcher`. It includes the browser input path, the
transport, the PTY write, and the dispatcher's builtin `printf`. Under
`pty_clock: "host_watcher"` it also includes the host watcher's detection
latency, which is why that clock records an uncertainty band rather than a floor.

Each capture records these calibration values per arm:

- `dispatcher_append_calibration_ms` — the same dispatcher line driven directly
  into the session's PTY on the host, with no browser in the path.
- `watcher_detection_calibration_ms` — recorded only under
  `pty_clock: "host_watcher"`. The host appends a marker to the same log itself
  and measures its own detection latency over the same sample count. It is an
  uncertainty band on `t_pty`, not a subtractable floor.
- `append_cost_calibration_ms` — recorded only under
  `pty_clock: "shell_epochrealtime"`, from variant A's second append (§6.2.2). It
  bounds the interval between the clock evaluation that produces `t_pty` and the
  completed append, and it is a recorded component rather than a subtractable
  correction.
- `shell_clock_handshake` — the raw handshake line and the acceptance results
  from §6.2.1, recorded whichever way the handshake resolved.

Echo receipt is never called `key_to_pty`. The `key_to_pty` entry also carries
`pty_to_paint_ms`, `key_to_paint_ms`, and `decomposition_valid` from §6.3.1.

`[[restty is a client renderer not authoritative terminal infrastructure]]`
applies here. The paint oracle observes a client renderer through the browser's
own protocol, not terminal authority, which is why the arrival endpoint stays on
the PTY side and paint endpoints are reported separately.

### 6.5 Preconditions before any measurement

G16 fails closed on each of these, per arm, and G18 on the capture as a whole:

1. The dispatcher printed `botster-baseline-ready`.
2. The shell-clock handshake of §6.3.1 resolved, and the resolved `pty_clock` is
   the same for both arms.
3. One warm-up probe added exactly the lines the negotiated §6.2.4 format
   prescribes, with the marker matching exactly: one line under `host_watcher`,
   two under `shell_epochrealtime`. An empty, malformed, or wrong-format line
   blocks the arm's PTY families with a typed reason instead of recording a
   number.
4. The same warm-up probe changed the cropped region: the paint oracle observed at
   least one hash change attributable to that probe, and the arm's rendered
   terminal shows `botster-baseline-paint:<marker>`. Attribution is by marker, not
   by ordering: the plan does **not** require that change to fall after `t_pty`,
   because §6.3.1 shows no such ordering exists under `host_watcher`. A warm-up
   that writes the log but paints nothing blocks the arm's paint families with a
   typed reason.
5. `Page.startScreencast` works in both arms, the measured `scale`,
   `pageScaleFactor`, `scrollOffsetX`, and `scrollOffsetY` are stable, and a
   sustained-frame check received acknowledged frames continuously across the
   warm-up rather than stalling after the first. If either arm cannot start a
   screencast, the capture blocks the cross-arm paint families rather than
   substituting a second instrument.
6. Every calibration the negotiated clock and oracle require produced a non-empty
   sample set. `watcher_detection_calibration_ms` is required only under
   `host_watcher`; `append_cost_calibration_ms` only under
   `shell_epochrealtime`; `dispatcher_append_calibration_ms` always. No paint
   clock-offset calibration is required or permitted.

### 6.6 What does not change

- No production file under `src/botster/`, `src/app/`, or `src/vendor/` changes,
  and no file in either supplied checkout changes.
- The existing `__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminal` records stay
  available in the modular arm. The harness records them as **arm-local semantic
  context** (`attach`, `ghostsnp_install` READY, `ghostsnp_install` FINISH), never
  as a cross-arm comparison endpoint.
- Cross-arm comparison uses the PTY oracle and the paint oracle only.

The existing harness pushes `{kind, payload}` without a timestamp. The observer
adds timestamps by replacing the two arrays created in
`installLiveHarnessPageHooks` with arrays whose `push` stamps `at` and `wall`.
That is a harness-side change in `scripts/`, not a production change.


## 7. The frozen observation format

Version token: `terminal_baseline_observation_format=2`. Downstream tickets cite
the version, not the file layout. Version 2 supersedes version 1 before any
baseline becomes authoritative (`question_1787678013_829162`).

Each capture writes one JSON record with these top-level members.

| Member | Content |
|--------|---------|
| `format_version` | `2` |
| `capture_id` | stable id for one two-arm capture |
| `product_baseline_only` | always `true`, with the §4 causality statement inline |
| `same_host` | always `true`; the capture refuses to emit a record whose browser and PTY ran on different hosts |
| `host` | os, kernel, cpu model, logical cpu count, memory, runner label or `local` |
| `browser` | Playwright channel, Chromium build, viewport, device scale factor |
| `arms` | exactly two entries, `legacy` and `modular` |
| `frozen_inputs` | the §8 table, byte for byte identical across arms |
| `observations` | the eight families below, per arm |
| `correctness` | the deterministic gate results, per arm |
| `blocked` | list of observation families that produced no value, each with a typed reason |

Each arm entry records `revisions`, `build_commands`, `launch_command`,
`binary_real_paths`, `client`, `restty`, and `env` for every variable the launch
sets.

`revisions` carries the repository and commit for the arm, and for the modular
arm the locked Core revision read from the Hub `Cargo.lock`.

`restty` is a required member of every arm entry, because the ticket requires the
exact Restty revision. It carries:

| Field | Content |
|-------|---------|
| `declared_revision` | the full 40-character Restty source commit for the arm; a short revision is rejected |
| `declaration_source` | the exact file or commit that declares it |
| `artifact_sha256` | the SHA-256 of every vendored Restty distribution file the arm loads |
| `ghostty_pin` | the Restty-pinned Ghostty commit when the arm declares one, otherwise `null` with a reason |

Both full revisions are frozen here. The modular arm declares Restty
`59c640488f33b10296875471691e43da6890e074` with Ghostty pin
`eb72ec61304ea256be1d86ed8fa961c84e43ecbd`, both stated in
`src/vendor/restty/README.md`. The legacy arm at `f598075e` vendors
`app/frontend/vendor/chunk-02afddvq.js`, whose declaring commit `2b52d0c9` names
the short revision `cd1911d0f`; that short revision resolves in the authoritative
`trybotster/restty` repository to the full commit
`cd1911d0f88606270b1457c6995a3c04cb497edf`, which is the value the record must
carry. The legacy arm declares no Ghostty pin, so `ghostty_pin` is `null` with
that reason.

G14 rejects a record whose `declared_revision` is absent, is not a full
40-character commit, or whose `artifact_sha256` does not match the vendored files
the arm actually loads. `artifact_sha256` proves the bytes; it is not a substitute
for source identity, and G14 requires both. An arm whose exact source revision
cannot be proved is marked blocked rather than recorded with a short or inferred
value.

`paint_oracle` and `pty_clock` are **capture-level** members, not per-arm members.
`paint_oracle` is always `"cdp_screencast"`; §6.3.2 explains why there is no second
value and the validator rejects any other. `pty_clock` is `shell_epochrealtime` or
`host_watcher`, negotiated once for the whole two-arm capture. A record whose two
arms imply different `pty_clock` values is invalid and G18 rejects it. Each arm
entry records the frozen terminal bounding box, the measured frame `scale`, and
the discarded-frame count.

The `key_to_pty` family also records `decomposition_valid`, which is `true` only
under `pty_clock: "shell_epochrealtime"`. Under `host_watcher` it is `false`, and
`pty_to_paint_ms` may be negative and is recorded rather than discarded.

Each observation family records `endpoint_start`, `endpoint_end`, `oracle`
(`pty` or `paint`), `unit` (`ms`), `n`, `warmup_discarded`, and the statistic set
`min`, `p50`, `p95`, `max`. A family that cannot run on an arm records
`status: "not_applicable"` plus a reason, never a number.

The eight families:

| Family | `endpoint_start` | `endpoint_end` | Oracle |
|--------|------------------|----------------|--------|
| `key_to_pty` | `t_key`, the final Enter of the probe line | `t_pty` as §6.3.1 defines it for the negotiated clock | pty |
| `attach_ready` | the mounted terminal begins attach | first sampled-region hash change after attach | paint |
| `history_finish` | first sampled-region hash change after attach | sampled-region hash stable for the settle window | paint |
| `scrollback` | first wheel event dispatch | sampled-region hash stable for the settle window | paint |
| `large_history` | attach against the seeded large-history session | sampled-region hash stable for the settle window | paint |
| `control_response_saturation` | `t_key` during the control-response burst | `t_pty` | pty |
| `package_event_saturation` | `t_key` during the 200 package-event burst | `t_pty` | pty |
| `sibling_saturation` | `t_key` on terminal B while terminal A is flooded | `t_pty` for terminal B | pty |

The `key_to_pty` entry also carries the sibling statistic sets `pty_to_paint_ms`
(`t_paint - t_pty`) and `key_to_paint_ms` (`t_paint - t_key`), so the round trip
stays decomposable without adding a family, and both calibration values from
§6.4.

`attach_ready` and `history_finish` also record the modular arm's protocol states
(`ghostsnp_install` READY and FINISH) under `arm_local_semantics`. The legacy arm
records `arm_local_semantics: null`, because
`snapshot_delivery=ready_then_history` is a modular-only feature
(`[[ready then history is a compatibility feature not an Attach field]]`). The
cross-arm numbers stay paint-based, so the asymmetry never becomes a silent
apples-to-oranges comparison.

### 7.1 The two saturation families

Plan Review finding `finding_1787633696_468463` and the answer to
`question_1787633836_780366` split the original single `event_saturation` family.
A Hub-authored package-event burst is server-to-client egress. A browser-issued
request burst adds client-to-server ingress, request dispatch, and response
generation. Matching aggregate frames and bytes does not make those workloads
equivalent, so the plan does not pretend it does. The term `event_saturation` is
retired to keep the vocabulary unambiguous.

**`control_response_saturation` — cross-stack comparison.** Both arms issue the
same two browser-issued semantic operations through each stack's production
browser control connection, never a direct daemon Unix socket
(`question_1787678013_829162`):

1. `terminal_resize` — wire type `resize` on both arms
2. `terminal_snapshot` — legacy wire type `request_snapshot`, modular wire type
   `read_screen`

The record stores the semantic name and the arm-specific wire type. The harness
measures ingress and egress separately and equalizes the server-to-browser
response frames per second and bytes per second within a recorded tolerance.
Each arm records `request_rate`, `response_rate`, `response_bytes`, `producer`,
`wire_request_types`, and `tolerance`. Terminal input and output are probed
during the response burst through the PTY oracle. The retired names
`list_configs` and `list_session_types` must not reappear. If the two arms'
response shapes differ, the record states that limitation, and no row claims
isolated transport causality.

**`package_event_saturation` — modular-only diagnostic.** The modular arm runs
the existing 200 package-event fixture burst
(`scripts/live-packaged-protocol-harness.mjs:1835`). The legacy arm records
`status: "not_applicable"` with the exact reason: legacy `f598075e` has no
harness-drivable package-event plane. The plan does not manufacture a legacy
package-event equivalent from unrelated control requests.

**`sibling_saturation` — arm-neutral by construction.** Each arm mounts two
terminals, floods terminal A with the frozen PTY workload from the seed script,
and probes terminal B. The session script, output bytes, probe sequence, and
observation fields are identical in both arms. This family needs no
product-specific plane and no modular harness helper shape.

## 8. Frozen harness inputs

Every input outside the measured arm is fixed and recorded. The harness fails
closed when it cannot prove a value.

| Input | Frozen value |
|-------|--------------|
| Viewport | 1440 x 900, device scale factor 1 |
| Terminal geometry | fixed rows and columns, asserted equal on both arms before any measurement |
| Browser | one Playwright Chromium build, recorded by revision |
| Session workload | one seeded shell session started from a fixed script committed under `fixtures/terminal-baseline/` |
| Probe line | `botster-baseline-probe:<marker>` with a marker unique per capture, arm, and repetition; the measured keydown is the final Enter only |
| Dispatcher | one frozen variant for the whole capture, §6.2.2 under `shell_epochrealtime` or §6.2.3 under `host_watcher`, started by typing one setup command into an ordinary shell session in both arms; the two arms never run different variants |
| Repetitions | 20 measured, 3 warm-up repetitions discarded and recorded as discarded |
| Scrollback gesture | fixed wheel delta, fixed event count, fixed pacing |
| History size | one fixed line count and one fixed byte count, produced by `fixtures/terminal-baseline/history-seed.sh` |
| Control-response burst | one fixed schedule of `terminal_resize` and `terminal_snapshot` through each arm's browser control connection, with the server-to-browser response rate and bytes equalized across arms within the recorded tolerance |
| Package-event burst | 200 package events on the modular arm only, matching the existing lane at `scripts/live-packaged-protocol-harness.mjs:1835` |
| Sibling flood | two mounted terminals, terminal A flooded with a fixed output byte count from `fixtures/terminal-baseline/sibling-flood.sh`, terminal B probed |
| Settle window | one fixed millisecond window for sampled-region hash stability |
| Paint sampling | CDP `Page.startScreencast` with frozen format, quality, and `maxWidth`/`maxHeight` at or above the viewport in device pixels, every frame acknowledged, cropped by the §6.3.2 transform. There is no second oracle |
| PTY clock | one clock for the whole capture, `shell_epochrealtime` when the §6.3.1 handshake proves it in both arms, otherwise `host_watcher` in both |
| Order | arms run in both orders across the capture, so warm-cache order is not confounded with arm |

Rerunning both arms on one machine in one capture is what makes the comparison
meaningful. The harness refuses to emit a record whose two arms ran on different
hosts or different browser builds.


## 9. Runtime-teardown lens answers

`[[botster runtime teardown lenses]]` applies in **harness scope**. The ticket
touches multi-terminal concurrency and terminal-state versus live-runtime
divergence, which the note names as triggers. This ticket changes no runtime
code, so every answer below constrains the observation harness and what the
baseline must record, not a product behavior change.

| Field | Answer |
|-------|--------|
| `teardown_class_applies` | Yes, harness scope. The capture mounts two concurrent terminal subscriptions, saturates one, and spawns and stops a Hub and a session worker per arm. Leaked ownership between repetitions would silently corrupt every wall-clock value. |
| `teardown_isolation` | Each arm owns an isolated data directory, an isolated Hub process, an isolated session worker, and its own browser context. One arm's failure kills that arm's process tree only. Repetitions inside one arm share the session on purpose; the harness records the session id in each observation so a shared-session effect is visible rather than hidden. |
| `teardown_bounds` | Every stop path is bounded. The harness sends the arm's stop signal, waits a fixed budget, then escalates to `SIGKILL` on the recorded pid and records `teardown: "escalated"` in the arm entry. No unbounded wait exists in the capture loop. A hung arm marks its families `blocked`, never `0`. |
| `late_message_matrix` | The harness creates durable ownership through four surfaces. Terminal attach: tagged by session id and, in the modular arm, subscription id and generation; rejected after arm stop because the browser context is closed first; residual state swept by deleting the arm data directory. Entity subscription: tagged by family; released with the existing `releaseEntityFamily` before arm stop. Package-event subscription: tagged by owner package and subject; the burst producer is stopped before the terminal probes of the next repetition. Spawned session: tagged by session id, recorded, and stopped in the arm teardown. A repetition that cannot prove all four are released is discarded and recorded as discarded. |
| `production_path_proof` | The capture drives the real product path in both arms: real browser, real client build, real Hub process, real PTY. The PTY oracle reads a timestamp the session's own shell wrote through the product's real PTY path, not a harness stub. Arm teardown is proven live: after stop, the harness asserts the recorded Hub pid and worker pid are gone and the arm's socket path is absent. A terminal JSON record alone is not accepted as teardown proof. |
| `ownership_identity` | Each arm entry carries `arm_id`, the Hub pid, the worker pid, the data directory real path, and the session id. Each observation carries the `capture_id`, `arm_id`, repetition index, and session id. A stale sample from a previous repetition therefore cannot be attributed to the current one. |
| `sibling_fail_closed_policy` | On a clean arm stop, the other arm keeps its already-recorded observations. On an ultimate stop failure, the harness fails the whole capture, marks both arms `blocked`, and emits no partial two-arm comparison. A one-armed record is never published as a baseline. |

## 10. Affected surfaces and files

New files in `botster-web`:

- `scripts/terminal-baseline-observation-format.mjs` — the frozen schema, the
  version token, the statistic helper, and the validator. One source of truth for
  the harness, the validator, and the tests.
- `scripts/terminal-baseline-observer.mjs` — the `addInitScript` payload (the
  capture-phase keydown stamp and the timestamped harness arrays), the host-side
  CDP screencast paint oracle with its crop and hash, the host-side baseline-log
  watcher, the §6.2.1 clock handshake and its acceptance band, the parser for both
  §6.2.4 log formats, and the per-arm capture routine. It contains no wire oracle,
  no in-page canvas readback, and no second paint instrument; §6.1, §6.3.2, and the
  revision 7 note record why each was removed.
- `scripts/terminal-baseline-capture.mjs` — the two-arm orchestrator. Negotiates
  `pty_clock` once and requires `Page.startScreencast` in both arms. It starts each
  arm and its dispatcher, proves the §6.5 preconditions, runs all eight families of
  §7 in both arm orders, tears each arm down, validates the record, and writes it.
- `fixtures/terminal-baseline/seed-shell-clock.bash` — dispatcher variant A of
  §6.2.2, used when the capture negotiates `pty_clock: "shell_epochrealtime"`. It
  writes its own clock reading beside the marker, plus the second append that
  feeds `append_cost_calibration_ms`.
- `fixtures/terminal-baseline/seed-posix.sh` — dispatcher variant B of §6.2.3,
  used when the capture negotiates `pty_clock: "host_watcher"`. It writes the
  marker only, and the timestamp then comes from the host watcher.
- `fixtures/terminal-baseline/history-seed.sh` and
  `fixtures/terminal-baseline/sibling-flood.sh` — the frozen history and flood
  workloads, shared by both variants.
Both dispatcher variants print `botster-baseline-paint:<marker>` after their
append, and the harness substitutes every absolute path as a literal when it
writes the file.
- `docs/terminal-baseline-observation-format.md` — the published contract that
  `ticket_1787600689_646958` and `ticket_1787600679_990088` must reuse.
- `.github/workflows/terminal-regression-baseline.yml` — `workflow_dispatch`,
  `runs-on: botster-ubuntu-24.04-16core`, both arm checkouts as inputs.
- `docs/reports/capture-the-debug-runtime-terminal-regression-baseline-implement.md`
  — the implement report, including the blocked controlled-runner record.
- `docs/reports/terminal-baseline-observation-local-<capture_id>.json` — the
  recorded local two-arm set.

Changed files in `botster-web`:

- `package.json` — add `observe:terminal-baseline` and
  `observe:terminal-baseline:validate`. No dependency change.
- `src/App.test.mjs` — add the format, validator, Restty-provenance, and
  same-host assertions. This is the repository's only test entry point, and §5
  permits it explicitly.
- `README.md` — one pointer to the published observation format.

Files that must not change: everything under `src/botster/`, `src/app/`, and
`src/vendor/restty/`, and every file in `~/Rails/trybotster`. `src/App.test.mjs`
is the one permitted exception under `src/`, as §5 states.

## 11. Ownership boundaries and cross-repository dependencies

`botster-web` owns the observation harness, the observation format, the
validator, the workflow, and the recorded records. That matches the charter:
Web owns browser-consumer conformance and browser-specific diagnostics.

The harness treats both arms as **external, path-supplied, read-only product
stacks**. It receives `BOTSTER_LEGACY_CHECKOUT` and the modular Hub checkout path
as inputs, verifies each checkout's revision and cleanliness, and never writes to
either. Web therefore does not become an owner of Hub, Core, or the legacy
monorepo.

Cross-repository dependencies:

- `ticket_1787600670_129312` (`botster-hub`, closed) supplies the frozen
  architecture contract this baseline serves. It is already registered as a
  dependency of this ticket.
- No new dependency is required. The modular arm consumes the merged Hub
  revision `f6db5c4` as a **build input**, not as a released package, which is
  what `[[closed dependency tickets signal merged source not a consumable release]]`
  warns about. The plan therefore builds the two debug binaries from a Hub
  checkout at that exact revision and records the real paths, rather than
  claiming a published release.
- The legacy monorepo is not a Botster Stack Delivery target and receives no
  change, so no dependency is registered against it.

Downstream consumers of this ticket's output:

- `ticket_1787600689_646958` must record its post-Restty set in
  `format_version=2`.
- `ticket_1787600679_990088` must record its post-cut set in the same format and
  compare against the post-Restty transport baseline, per architecture contract
  §14 row A20.

## 12. Assumptions and unknowns

Assumptions:

1. The two arms defined in §4 are correct. Source:
   `question_1787632597_922353`, answered by the project orchestrator.
2. "Same browser build" means the same Playwright Chromium binary and viewport.
   It cannot mean the same web client: the legacy arm serves its own Rails plus
   `app/frontend` client by construction, and that difference is part of the
   compared product stack. The record states this in `arms[].client`.
3. The legacy arm must be measured from a clean checkout at
   `f598075e6c143ef14b34d3a3dffdf2ec6a8d9eb6`. The developer copy at
   `~/Rails/trybotster` is currently dirty. The harness refuses a dirty legacy
   checkout and instructs the operator to supply a clean worktree at that
   revision.
4. `botster-ubuntu-24.04-16core` is still unregistered. Evidence: the
   `botster-web` repository runner list is empty, org runner listing returns 403
   for this session, and the Hub campaign recorded it unregistered under
   `question_1787447435_428566`.
5. Both arms can start an ordinary shell session into which the harness types one
   setup command that runs the §6.2 dispatcher. This assumption replaces a weaker
   one: the legacy browser API's `add_session` takes a session type name, not a
   command line (`app/frontend/lib/connections/hub_connection.js:322-325`), so the
   plan does not rely on either arm accepting an arbitrary spawn command. G16
   proves the dispatcher started and answered a warm-up probe before any
   measurement, and blocks the arm's PTY families with a typed reason otherwise.
6. Every endpoint reads one host's wall clock, because G12 requires the browser
   and the PTY to run on one host and the record carries `same_host: true`. The
   sources differ by endpoint and by negotiated clock: `t_key` and `t_paint` come
   from the browser, and `t_pty` comes from the host watcher's `Date.now()` under
   `host_watcher` or from Bash `$EPOCHREALTIME` under `shell_epochrealtime`. A
   capture that cannot prove one host emits no `key_to_pty` value. The shell
   source is never assumed: `$EPOCHREALTIME` is a bash feature and the modular
   production session starts with `sh`
   (`scripts/live-packaged-protocol-harness.mjs:6024`), which is why revision 3
   removed the assumed shell timestamp and revisions 5 and 6 reinstated it only
   behind the §6.2.1 handshake and its 2000 ms acceptance band.
7. Both arms deliver terminal bytes over an **encrypted** WebRTC DataChannel.
   Verified: `src/botster/webrtcDaemonClient.ts:1726-1745` decrypts AES-GCM after
   the channel event, and
   `app/frontend/lib/connections/terminal_connection.js:5` states the legacy path
   is end-to-end encrypted. This is why §6 uses no wire oracle.

Unknowns, each with an owner:

1. Whether the legacy arm can run at all on a Linux CI runner. It needs Ruby,
   the Rails asset toolchain, and the database. Owned by this ticket's Implement
   step, which must record the provisioning requirement in the workflow and mark
   the controlled set blocked for the runner reason regardless.
2. The exact canvas settle window that separates history completion from live
   output on both arms. Owned by this ticket's Implement step; it must be
   calibrated once, then frozen into the format and recorded.
3. Whether the legacy arm's shell session accepts the typed dispatcher setup
   command and keeps `stty -echo` in effect. Owned by this ticket's Implement
   step, gated by G16, which blocks rather than guesses.
4. The exact terminal bounding box in each arm, whether `Page.startScreencast`
   works in both, and whether the §6.3.1 shell-clock handshake passes in both.
   Owned by this ticket's Implement step. Each bounding box is measured once per
   arm and frozen. The PTY clock is negotiated once for the capture, so a missing
   `bash` clock in one arm downgrades both arms together. The paint oracle has no
   downgrade path at all: an arm without `Page.startScreencast` blocks the
   cross-arm paint families. G16 and G18 enforce both rules rather than allowing a
   mixed comparison.
5. Whether the two arms' `terminal_resize` and `terminal_snapshot` response
   shapes are close enough to equalize server-to-browser frames and bytes within
   a useful tolerance. Owned by this ticket's Implement step, which must record
   the achieved values and tolerance and, when the shapes differ, record that
   limitation in the record rather than dropping the family.


## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| A reader quotes a baseline number as transport causality | A later ticket claims the transport change fixed or broke typing without evidence | `product_baseline_only` is a required record member carrying the §4 statement; the published document repeats it; the ticket already forbids the claim |
| Two arms measured through two different oracles | The comparison measures the oracles | §6 uses one PTY oracle and one paint oracle for both arms; arm-local semantics are recorded but never compared |
| Local laptop noise dominates the values | A meaningless baseline is frozen into the format | The local set is explicitly observational and non-gating; both arm orders run; the record carries `n`, `p50`, and `p95`, not a single mean |
| The legacy arm cannot be provisioned on the controlled runner | The controlled two-arm set never happens | The workflow takes the legacy checkout as an input and fails closed with a typed skip; a one-armed record is never published as a baseline (§9 sibling policy) |
| A timing value becomes a CI assertion | Flaky CI, and the ticket's separation rule breaks | The deterministic gate and the observation writer are separate entry points; the validator rejects a record that carries a threshold field |
| A leaked session or subscription between repetitions | Silent corruption of every later value in the arm | §9 late-message matrix; a repetition that cannot prove release is discarded and recorded as discarded |
| The format needs a change after the Restty ticket | Downstream sets become incomparable | The version token is explicit; a change bumps `format_version` and the changing ticket must restate both sets |
| The watcher and dispatcher costs are read as transport latency | Every `key_to_pty` value is inflated by an unstated floor | §6.4 names every included component and records `watcher_detection_calibration_ms` and `dispatcher_append_calibration_ms` per arm per capture |
| Observer order is inferred from shell write order | A false invariant becomes a gate that rejects valid samples and biases the set toward fast watcher callbacks | §6.3.1 withdraws the claim; G8 asserts only `t_key` before both endpoints; negative `pty_to_paint_ms` is recorded rather than discarded and `decomposition_valid` marks when the split is not real |
| The two arms resolve different clocks or dispatcher variants | The capture compares the instruments rather than the products | §6.3.2 negotiates `pty_clock` once per capture and pins `paint_oracle` to `cdp_screencast`; both are capture-level record members, and G18 rejects a record whose arms imply different values |
| Screencast frames stop after the first | A silent stall reads as no paint change | Every frame is acknowledged with its `sessionId`, and G18 runs a sustained-frame check across the warm-up |
| A paint calibration absorbs the latency it is meant to bound | The measured value is silently deflated | `metadata.timestamp * 1000` is used directly as epoch milliseconds; the revision 4 known-change offset calibration is deleted and must not reappear |
| The paint oracle is moved back into the page for convenience | Four observation families silently stop working on a WebGPU or WebGL2 canvas | §6.3.2 fixes the oracle on the host through CDP screencast and pins `paint_oracle` to the single capture-level constant `cdp_screencast`, which G6 and G18 enforce; G16 blocks an arm whose warm-up probe paints nothing |
| A second paint instrument is added as a convenience fallback | Its capture-time endpoint and instrument cost go unstated, and paint values lose a stable endpoint | §6.3.2 deletes `screenshot_poll` outright; `cdp_screencast` is the only oracle, the validator rejects any other value, and an arm without screencast blocks the cross-arm paint families |
| A per-probe helper process is added later for convenience | Process startup swamps the value being measured | §6.2 fixes the dispatcher as builtin `printf` plus an append redirect, with the one `cr` fork at session start only |
| Browser, shell, and host-watcher wall clocks diverge | `key_to_pty` becomes meaningless or negative | All endpoints read one host's wall clock: `t_key` and `t_paint` from the browser, `t_pty` from the host watcher's `Date.now()` under `host_watcher` or from Bash `$EPOCHREALTIME` under `shell_epochrealtime`, where §6.2.1 accepts that clock only after it parses, advances, and sits within 2000 ms of the host clock. G12 requires one host, the record carries `same_host: true`, and G15 discards and records any repetition whose `t_pty` precedes `t_key` |
| The probe expands empty and records a zero-length marker | A silently wrong number enters the baseline | G16 requires `botster-baseline-ready` plus a warm-up probe whose log line equals the expected marker exactly, and blocks the arm otherwise |
| The two saturation families get conflated again | A modular-only diagnostic is read as a cross-stack comparison | §7.1 retires the term `event_saturation`; the schema, the report names, and the published document use `control_response_saturation` and `package_event_saturation` |
| `terminal_resize` and `terminal_snapshot` response shapes differ between arms | A cross-stack row overstates equivalence | The record stores request rate, response rate, response bytes, producer, wire request types, and tolerance per arm, and states the shape limitation; no row claims isolated transport causality |

## 14. Acceptance checks and tests

Deterministic gates. Each must pass before any observation is recorded, and each
is independent of every wall-clock value.

| # | Gate | Command or oracle |
|---|------|-------------------|
| G1 | Repository typecheck passes | `npm run typecheck` |
| G2 | Lint passes | `npm run lint` |
| G3 | Unit and drift tests pass, including new format and validator assertions | `npm test` |
| G4 | Production build passes | `npm run build` |
| G5 | The existing packaged live lane still passes on the modular arm, executed to completion rather than aborting on a missing binary | the full pinned sequence below |
| G6 | The validator rejects a record missing any required member, missing an arm, carrying one arm only, carrying a threshold field, or carrying any `paint_oracle` other than `cdp_screencast` | unit assertions in `src/App.test.mjs` |
| G7 | Byte fidelity holds in both arms: the probe marker echoed by the PTY appears intact | harness assertion per repetition |
| G8 | The only asserted ordering holds in every repetition: `t_key` precedes `t_pty`, `t_key` precedes the probe's paint change, and paint-ready precedes paint-settled. No ordering between `t_pty` and `t_paint` is asserted, because §6.3.1 shows the mechanism does not guarantee one under `host_watcher` | harness assertion per repetition |
| G9 | No terminal delivery queue overflow occurs during the package-event burst | reuse the existing overflow check at `scripts/live-packaged-protocol-harness.mjs:1906` |
| G10 | Package events never enter the terminal adapter path in the modular arm | reuse the existing check at `scripts/live-packaged-protocol-harness.mjs:1923` |
| G11 | Arm teardown is proven live: recorded Hub and worker pids are gone and the arm socket path is absent after stop | harness assertion per arm |
| G12 | Both checkouts are clean and at the recorded revisions before the capture starts | harness precondition, fails closed |
| G13 | The recorded record validates against `format_version=2` | `npm run observe:terminal-baseline:validate` |
| G14 | Every arm entry carries a full 40-character Restty `declared_revision`, a `declaration_source`, and an `artifact_sha256` that matches the vendored files the arm actually loads; a short revision is rejected and the arm is blocked | validator assertion plus a harness precondition, fails closed |
| G15 | Both arms ran on one host, and no repetition has `t_pty` or the probe's paint change before `t_key` | harness precondition and per-repetition assertion |
| G16 | Per arm, matching §6.5 exactly: the dispatcher printed `botster-baseline-ready`; the §6.2.1 handshake resolved and both arms report the same `pty_clock`; one warm-up probe added exactly the lines the negotiated §6.2.4 format prescribes, one line under `host_watcher` and two under `shell_epochrealtime`, with the marker matching exactly and a wrong-format line blocking the arm; the same warm-up produced a sampled-region hash change **attributed by marker, with no ordering required against `t_pty`**, and the rendered terminal shows `botster-baseline-paint:<marker>`; `Page.startScreencast` works in both arms; and every calibration the negotiated clock requires produced a non-empty sample set, meaning `watcher_detection_calibration_ms` only under `host_watcher`, `append_cost_calibration_ms` only under `shell_epochrealtime`, `dispatcher_append_calibration_ms` always, and no paint calibration of any kind | harness precondition, fails closed; a log failure blocks that arm's PTY families and a paint failure blocks that arm's paint families |
| G17 | Neither supplied checkout changed: each `HEAD` and each `git status --porcelain` is identical before and after the capture | harness precondition and post-condition, fails closed |
| G18 | Capture-level oracle integrity: `paint_oracle` is `cdp_screencast`, both arms resolved the same `pty_clock`, and both arms ran the same §6.2 dispatcher variant; every frame was acknowledged with its `sessionId`, the sustained-frame check never stalled, `scale`, `pageScaleFactor`, `scrollOffsetX`, and `scrollOffsetY` were stable across the capture, and no measured endpoint depended on a frame lacking `metadata.timestamp`; the screencast was stopped and the CDP session detached in teardown | harness precondition, per-frame assertion, and post-condition, fails closed |
| G19 | Under `pty_clock: "host_watcher"`, `decomposition_valid` is `false` and no negative `pty_to_paint_ms` sample was discarded; under `shell_epochrealtime`, the handshake record and `append_cost_calibration_ms` are present and `decomposition_valid` is `true` | validator assertion plus a harness assertion |

G5 aborts before it reaches any test when it is written as the bare npm script:
`npm run smoke:live-packaged-protocol` builds Web and then exits, because
`scripts/live-packaged-protocol-harness.mjs:142-145` requires `BOTSTER_HUB_BIN`
and lines 9062-9066 require `BOTSTER_SESSION_WORKER_BIN`. Plan Review reproduced
that pre-execution abort. G5 is therefore the complete pinned sequence:

The sequence must not mutate the supplied checkout. §11 calls both supplied
stacks read-only, and the available Hub checkout currently sits at `f66d459`, so
a `checkout` there would change user state before any proof. G5 therefore builds
in a dedicated scratch checkout and leaves the supplied repository untouched.

```sh
# 0. Record the supplied checkout's state and never write to it.
HUB_SOURCE_HEAD="$(git -C "$HUB_SOURCE" rev-parse HEAD)"
test -z "$(git -C "$HUB_SOURCE" status --porcelain)"

# 1. Create a scratch checkout at the modular arm revision.
HUB_SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/botster-baseline-hub.XXXXXX")"
git clone --quiet --no-checkout --shared "$HUB_SOURCE" "$HUB_SCRATCH"
git -C "$HUB_SCRATCH" checkout --quiet f6db5c436f72b151fd6dacde61d3f4836a4dc925
test -z "$(git -C "$HUB_SCRATCH" status --porcelain)"

# 2. Prove the locked Core revision in the scratch checkout before building.
grep -q '7eafa470a18025895995bbedc20d34b58106a03b' "$HUB_SCRATCH/Cargo.lock"

# 3. Build both debug binaries in the scratch checkout only.
( cd "$HUB_SCRATCH" && cargo build --locked --bin botster-hub )
( cd "$HUB_SCRATCH" && cargo build --locked -p botster-core-daemon --bin botster-session-worker )

# 4. Run the lane with both scratch binaries supplied.
BOTSTER_HUB_BIN="$HUB_SCRATCH/target/debug/botster-hub" \
BOTSTER_SESSION_WORKER_BIN="$HUB_SCRATCH/target/debug/botster-session-worker" \
  npm run smoke:live-packaged-protocol

# 5. Prove the supplied checkout is unchanged.
test "$(git -C "$HUB_SOURCE" rev-parse HEAD)" = "$HUB_SOURCE_HEAD"
test -z "$(git -C "$HUB_SOURCE" status --porcelain)"
```

`git clone --shared` keeps the scratch checkout cheap because it reuses the
source object store, and it still gives the scratch its own worktree, index, and
`target/`. The scratch path sits under `$TMPDIR` and therefore contains no colon
on this host; the harness asserts that before invoking cargo, per
`[[colon worktree paths break cargo dyld library paths]]`.

`candidateBinaryProvenance` in `scripts/live-packaged-protocol-helpers.mjs`
requires both binary real paths to sit under one cargo target directory, which
step 3 satisfies inside the scratch checkout.

Implement records `$HUB_SOURCE`, `$HUB_SOURCE_HEAD`, the resolved `$HUB_SCRATCH`,
both binary real paths, the `Cargo.lock` grep result, and the step 5 unchanged
proof in the implement report. The legacy arm follows the same rule: the harness
reads the supplied legacy checkout and never writes to it, and requires the
operator to supply a clean checkout at `f598075e` rather than moving the
developer copy.

Observational output, non-gating:

| # | Output | Where |
|---|--------|-------|
| O1 | The local two-arm set, all eight families, both arms, both arm orders | `docs/reports/terminal-baseline-observation-local-<capture_id>.json` |
| O2 | The blocked controlled-runner record with the exact missing-runner reason | the implement report, and `blocked[]` in the record |
| O3 | The rerun procedure that produces the controlled set with no code change | `docs/terminal-baseline-observation-format.md` |

Downstream proof required by the charter and the architecture contract:

- The published document must state that `ticket_1787600689_646958` records the
  post-Restty transport baseline in `format_version=2`, and that
  `ticket_1787600679_990088` compares its post-cut set against that baseline
  (architecture contract §14 row A20).
- No downstream ticket may re-derive the format. It cites the version.

Explicitly not claimed:

- No controlled-runner observation set. The runner does not exist.
- No transport-causality conclusion.
- No performance regression or improvement verdict. This ticket records; it does
  not judge.

## 15. Vault gaps worth capturing

1. **The two debug product arms.** The legacy monorepo revision, its
   `run_hub_debug` task, and the modular two-binary debug build are the
   definition of "debug runtime" for this project. That definition existed only
   in an answered pipeline question. Capture it after Implement.
2. **A cross-arm baseline needs a client-neutral oracle, and the wire is not one
   of them.** Comparing two product stacks through one stack's internal
   instrumentation compares the instrumentation, and both arms encrypt terminal
   bytes at the DataChannel, so a frame-level marker search finds nothing. §6
   states the PTY and paint oracle rule. Capture it.
3. **Egress saturation and request saturation are different workloads.** §7.1
   records why matching aggregate frames and bytes does not make a Hub-authored
   event burst equivalent to a browser-issued request burst.
4. **A product baseline is not a causality experiment.** The required
   `product_baseline_only` member exists because a multi-component baseline
   invites single-component claims. Capture the rule with the format.
5. **A one-armed capture is not a baseline.** The fail-closed rule of §9 is not
   in the vault.
