# Capture the debug-runtime terminal regression baseline

Plan for ticket `ticket_1787603669_760394` in project `project_1787600579_585482`
(Botster Isolated Subscription Data Plane), pipeline `botster_stack_delivery`,
run `run_1787632387_839095`, step `botster_stack_plan`.

**Revision 4**, after Plan Review `review_1787635233_314942` returned
`changes_required` a third time. Both findings were correct and both concerned
the paint endpoint. Changes in this revision:

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
  cropped to a frozen terminal bounding box and hashed, with a recorded
  `screenshot_poll` fallback and its quantizing interval. Both arms reach it
  identically through the same Playwright Chromium.

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

### 6.2 The frozen probe

Both arms run one dispatcher, `fixtures/terminal-baseline/seed.sh`, in an
ordinary shell session. The harness starts it by typing one setup command into
the session and pressing Enter, so nothing depends on an arm's spawn API
accepting an arbitrary command. That matters: the legacy browser API's
`add_session` takes a session type name such as `shell`
(`app/frontend/lib/connections/hub_connection.js:322-325`), not a command line.

The dispatcher is pure POSIX `sh`. It forks nothing per probe:

```sh
stty -echo 2>/dev/null || true
cr=$(printf '\r')
echo botster-baseline-ready
while IFS= read -r line; do
  case "$line" in
    botster-baseline-probe:*)
      m=${line#botster-baseline-probe:}
      m=${m%$cr}
      printf '%s\n' "$m" >> /ABSOLUTE/BASELINE/LOG/PATH
      printf 'botster-baseline-paint:%s\n' "$m"
      ;;
    botster-baseline-exit) exit 0 ;;
  esac
done
```

**Output order is fixed and load-bearing.** The dispatcher appends to the log
first and prints the visible marker second. `t_pty` therefore never follows the
paint change for the same repetition, which is what makes the §14 ordering
assertion meaningful rather than accidental.

Revision 4 added the second `printf`. Revision 3 wrote the log only, so the
dispatcher produced no terminal output at all and every paint endpoint had
nothing to observe. `stty -echo` stays, and it is now a stated advantage: the
typed probe line does not paint, so the first change in the sampled region after
the measured Enter is attributable to the dispatcher's own marker and to nothing
else.

Three further properties matter and each answers a review point:

1. **No bash feature.** `printf` and the append redirect are POSIX. `cr` is set
   once at start, so carriage-return stripping costs one fork for the whole
   session rather than one per probe.
2. **No environment dependency.** The harness substitutes the absolute log path
   as a literal when it writes the file. The probe reads no shell variable that
   the session must export.
3. **No process spawn per probe.** `printf` is a shell builtin in `dash` and
   `sh`. A per-probe `date` or `node` call would add tens of milliseconds to
   every measurement and swamp the value being recorded.

Each repetition types `botster-baseline-probe:<marker>` where `<marker>` is
unique per capture, arm, and repetition. The harness waits for the sampled region's hash to
hold stable for the settle window before it sends the final key, so typing
latency sits outside the measurement. **The measured keydown is the final Enter
and nothing else.**

### 6.3 The three endpoints

| Symbol | Meaning | Source |
|--------|---------|--------|
| `t_key` | the browser dispatched the final Enter of the probe line | capture-phase `keydown` listener installed by `addInitScript`, `Date.now()` |
| `t_pty` | the host observed the marker line the session shell wrote | host watcher over the arm's baseline log |
| `t_paint` | the dispatcher's visible probe marker reached the rendered terminal | paint oracle hash change over the frozen terminal region |

The **paint oracle runs on the host, not in the page.** Revision 4 replaced an
in-page `requestAnimationFrame` canvas-pixel sampler, which cannot execute. The
modular Restty renderer requests a WebGPU context
(`src/vendor/restty/chunk-3mc71e83.js:1522`, `requestAdapter` nearby) and can use
WebGL2 (`:1723`). An injected script does not own that GPU device, so it cannot
read the drawing buffer, and a terminal container element exposes no pixel buffer
at all. Naming a container selector a pixel-buffer fallback was wrong.

The executable oracle is a Chrome DevTools Protocol screencast, which both arms
reach identically because both run the same Playwright Chromium
(`playwright` 1.60.0, `chromium.launch` already used across `scripts/`):

1. The harness opens a CDP session with `context.newCDPSession(page)` and calls
   `Page.startScreencast` with a frozen format, quality, and `maxWidth`.
2. Chromium emits a frame whenever the compositor paints, carrying
   `metadata.timestamp`. The harness converts that timestamp to milliseconds and
   records `paint_clock_offset_calibration_ms`, measured by comparing a frame
   timestamp against a host `Date.now()` at a known change, so paint values share
   the wall clock the PTY endpoints use.
3. The harness crops each decoded frame to the terminal element's bounding box,
   measured once per arm and frozen, then hashes the cropped bytes. Cropping keeps
   unrelated page animation out of the signal.
4. A hash change is a paint change. The first change after attach is the
   paint-ready endpoint. The first sample of a hash held stable for the frozen
   settle window is the paint-settled endpoint.

Screencast frames arrive only when the compositor paints, so this oracle costs no
per-sample round trip and never touches Restty's GPU device.

**Fallback.** If `Page.startScreencast` is unavailable on an arm, the harness
falls back to timed `elementHandle.screenshot()` sampling over the same bounding
box. The record then carries `paint_oracle: "screenshot_poll"` and the exact
`paint_sample_interval_ms`, because that interval quantizes every paint value in
that arm. The primary oracle records `paint_oracle: "cdp_screencast"`. An arm may
not silently mix the two.

The **keydown listener** records a timestamp only. It never cancels, rewrites, or
delays the event.

`t_key` and `t_pty` share one wall clock because the capture requires the browser
and the PTY to run on one host. G12 asserts that requirement and the record
carries `same_host: true`. A capture that cannot prove one host emits no
`key_to_pty` value.

### 6.4 What `key_to_pty` includes, stated plainly

`key_to_pty` is `t_pty - t_key`: the final Enter of the probe line, to the host
observing the marker the session shell wrote. It includes the browser input path,
the transport, the PTY write, the dispatcher's builtin `printf`, the filesystem
append, and the host watcher's detection latency. The plan does not hide those
components. Each capture records two calibration values per arm:

- `watcher_detection_calibration_ms` — the host appends a marker to the same log
  itself and measures its own detection latency over the same sample count. This
  is the floor that every `key_to_pty` value sits above.
- `dispatcher_append_calibration_ms` — the same dispatcher line driven directly
  into the session's PTY on the host, with no browser in the path.

Echo receipt is never called `key_to_pty`. The `key_to_pty` entry also carries
`pty_to_paint_ms` (`t_paint - t_pty`) and `key_to_paint_ms` (`t_paint - t_key`),
so the round trip stays decomposable without adding a family.

`[[restty is a client renderer not authoritative terminal infrastructure]]`
applies here. The paint oracle observes a client renderer, not terminal
authority, which is exactly why the authoritative arrival endpoint is the PTY
oracle and the paint endpoints are reported separately.

### 6.5 Preconditions before any measurement

G16 fails closed on each of these, per arm:

1. The dispatcher printed `botster-baseline-ready`.
2. One warm-up probe added exactly one line to the arm's baseline log, and that
   line equals the expected marker exactly. An empty or malformed line blocks the
   arm's PTY families with a typed reason instead of recording a number.
3. The same warm-up probe changed the hashed region: the paint oracle observed at
   least one hash change after that probe's `t_pty`, and the arm's rendered
   terminal shows `botster-baseline-paint:<marker>`. A warm-up that writes the log
   but paints nothing blocks the arm's paint families with a typed reason. This is
   the precondition revision 3 lacked, and it is why the missing dispatcher output
   would have been caught before any number was recorded.
4. The watcher calibration and the paint calibration each produced a non-empty
   sample set, and the arm recorded which `paint_oracle` it used.

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

Version token: `terminal_baseline_observation_format=1`. Downstream tickets cite
the version, not the file layout.

Each capture writes one JSON record with these top-level members.

| Member | Content |
|--------|---------|
| `format_version` | `1` |
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

Every arm entry also records `paint_oracle` (`cdp_screencast` or
`screenshot_poll`), the frozen terminal bounding box, and, for
`screenshot_poll`, the exact `paint_sample_interval_ms` that quantizes that arm's
paint values.

Each observation family records `endpoint_start`, `endpoint_end`, `oracle`
(`pty` or `paint`), `unit` (`ms`), `n`, `warmup_discarded`, and the statistic set
`min`, `p50`, `p95`, `max`. A family that cannot run on an arm records
`status: "not_applicable"` plus a reason, never a number.

The eight families:

| Family | `endpoint_start` | `endpoint_end` | Oracle |
|--------|------------------|----------------|--------|
| `key_to_pty` | `t_key`, the probe keydown | `t_pty`, the shell executed the probe command | pty |
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
same logical browser control request family, `list_configs` and
`list_session_types`, on the same request schedule. The harness measures ingress
and egress separately and equalizes the server-to-client **response** frames per
second and bytes per second within a recorded tolerance. Each arm records
`request_rate`, `response_rate`, `response_bytes`, `producer`, and `tolerance`.
Terminal input and output are probed during the response burst through the PTY
oracle. If the two arms' response shapes differ, the record states that
limitation, and no row claims isolated transport causality.

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
| Dispatcher | one frozen POSIX `sh` script, started by typing one setup command into an ordinary shell session in both arms |
| Repetitions | 20 measured, 3 warm-up repetitions discarded and recorded as discarded |
| Scrollback gesture | fixed wheel delta, fixed event count, fixed pacing |
| History size | one fixed line count and one fixed byte count, produced by the seed script |
| Control-response burst | one fixed schedule of `list_configs` and `list_session_types`, with the server-to-client response rate and bytes equalized across arms within the recorded tolerance |
| Package-event burst | 200 package events on the modular arm only, matching the existing lane at `scripts/live-packaged-protocol-harness.mjs:1835` |
| Sibling flood | two mounted terminals, terminal A flooded with a fixed output byte count from the seed script, terminal B probed |
| Settle window | one fixed millisecond window for sampled-region hash stability |
| Paint sampling | CDP `Page.startScreencast` with frozen format, quality, and `maxWidth`, cropped to the frozen terminal bounding box; the `screenshot_poll` fallback records its exact interval |
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
  watcher, and the per-arm capture routine. It contains no wire oracle and no
  in-page canvas readback; §6.1 and §6.3 record why both were removed.
- `scripts/terminal-baseline-capture.mjs` — the two-arm orchestrator. Starts each
  arm, starts the dispatcher and proves the §6.5 preconditions, runs all eight
  families of §7 in both arm orders, tears each arm down, validates the record,
  and writes it.
- `fixtures/terminal-baseline/seed.sh` — the POSIX `sh` dispatcher of §6.2, the
  history seed, and the sibling flood workload. It writes the marker only. The
  timestamp comes from the host watcher, not from the shell.
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
  `format_version=1`.
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
6. `Date.now()` in the page and the host watcher's `Date.now()` read one wall
   clock, because G12 requires the browser and the PTY to run on one host. The
   record carries `same_host: true`. A capture that cannot prove one host emits no
   `key_to_pty` value. Revision 3 removed the earlier dependency on the shell
   producing its own timestamp: `$EPOCHREALTIME` is a bash feature and the modular
   production session runs `sh`
   (`scripts/live-packaged-protocol-harness.mjs:6024`).
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
4. The exact terminal bounding box in each arm, and whether
   `Page.startScreencast` is available on both. Owned by this ticket's Implement
   step. The bounding box is measured once per arm and frozen into the record. An
   arm without screencast records `paint_oracle: "screenshot_poll"` with its exact
   interval rather than mixing oracles, and G16 blocks the arm's paint families if
   neither oracle observes the warm-up marker.
5. Whether the two arms' `list_configs` and `list_session_types` response shapes
   are close enough to equalize response frames and bytes within a useful
   tolerance. Owned by this ticket's Implement step, which must record the
   achieved tolerance and, when the shapes differ, record that limitation in the
   record rather than dropping the family.


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
| The paint oracle is moved back into the page for convenience | Four observation families silently stop working on a WebGPU or WebGL2 canvas | §6.3 fixes the oracle on the host through CDP screencast and records `paint_oracle` per arm; G16 blocks an arm whose warm-up probe paints nothing |
| The `screenshot_poll` fallback quantization is read as product latency | Paint values carry an unstated floor equal to the sample interval | The record carries `paint_oracle` and `paint_sample_interval_ms` per arm, and an arm may not mix the two oracles |
| A per-probe helper process is added later for convenience | Process startup swamps the value being measured | §6.2 fixes the dispatcher as builtin `printf` plus an append redirect, with the one `cr` fork at session start only |
| Browser and host-watcher wall clocks diverge | `key_to_pty` becomes meaningless or negative | Both stamps are `Date.now()` in one host's clock; G12 requires one host, the record carries `same_host: true`, and G15 discards and records any repetition whose `t_pty` precedes `t_key` |
| The probe expands empty and records a zero-length marker | A silently wrong number enters the baseline | G16 requires `botster-baseline-ready` plus a warm-up probe whose log line equals the expected marker exactly, and blocks the arm otherwise |
| The two saturation families get conflated again | A modular-only diagnostic is read as a cross-stack comparison | §7.1 retires the term `event_saturation`; the schema, the report names, and the published document use `control_response_saturation` and `package_event_saturation` |
| `list_configs` and `list_session_types` response shapes differ between arms | A cross-stack row overstates equivalence | The record stores request rate, response rate, response bytes, producer, and tolerance per arm, and states the shape limitation; no row claims isolated transport causality |

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
| G6 | The validator rejects a record missing any required member, missing an arm, carrying one arm only, or carrying a threshold field | unit assertions in `src/App.test.mjs` |
| G7 | Byte fidelity holds in both arms: the probe marker echoed by the PTY appears intact | harness assertion per repetition |
| G8 | Ordering holds in every repetition: `t_key` precedes `t_pty`, `t_pty` precedes the probe's paint change, and paint-ready precedes paint-settled | harness assertion per repetition, enforced by the §6.2 output order |
| G9 | No terminal delivery queue overflow occurs during the package-event burst | reuse the existing overflow check at `scripts/live-packaged-protocol-harness.mjs:1906` |
| G10 | Package events never enter the terminal adapter path in the modular arm | reuse the existing check at `scripts/live-packaged-protocol-harness.mjs:1923` |
| G11 | Arm teardown is proven live: recorded Hub and worker pids are gone and the arm socket path is absent after stop | harness assertion per arm |
| G12 | Both checkouts are clean and at the recorded revisions before the capture starts | harness precondition, fails closed |
| G13 | The recorded record validates against `format_version=1` | `npm run observe:terminal-baseline:validate` |
| G14 | Every arm entry carries a full 40-character Restty `declared_revision`, a `declaration_source`, and an `artifact_sha256` that matches the vendored files the arm actually loads; a short revision is rejected and the arm is blocked | validator assertion plus a harness precondition, fails closed |
| G15 | Both arms ran on one host, and no repetition has `t_pty` before `t_key` | harness precondition and per-repetition assertion |
| G16 | Per arm, the dispatcher printed `botster-baseline-ready`; one warm-up probe added exactly one log line equal to the expected marker; the same warm-up produced at least one sampled-region hash change after its `t_pty` and rendered `botster-baseline-paint:<marker>`; and the watcher and paint calibrations each produced a non-empty sample set | harness precondition, fails closed; a log failure blocks that arm's PTY families and a paint failure blocks that arm's paint families |
| G17 | Neither supplied checkout changed: each `HEAD` and each `git status --porcelain` is identical before and after the capture | harness precondition and post-condition, fails closed |

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
  post-Restty transport baseline in `format_version=1`, and that
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
