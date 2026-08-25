# Capture the debug-runtime terminal regression baseline

Plan for ticket `ticket_1787603669_760394` in project `project_1787600579_585482`
(Botster Isolated Subscription Data Plane), pipeline `botster_stack_delivery`,
run `run_1787632387_839095`, step `botster_stack_plan`.

**Revision 2**, after Plan Review `review_1787633696_367103` returned
`changes_required`. Changes in this revision:

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

Plan Review revision 1 replaced the original design. The first plan proposed a
wire oracle that wrapped `WebSocket` and `RTCDataChannel` message events and
searched each frame for a plaintext probe marker. That oracle cannot work.
`src/botster/webrtcDaemonClient.ts:1726-1745` decrypts AES-GCM envelopes after
the channel event, so the modular arm delivers ciphertext at that point, and
`app/frontend/lib/connections/terminal_connection.js:5` states the legacy arm is
end-to-end encrypted over its own DataChannel as well. The wire oracle would find
no marker on either arm, and its end point was browser echo receipt, which is not
PTY arrival. The wire oracle is deleted from this plan.

The replacement observes both arms at points where plaintext evidence exists and
no client instrumentation is required.

**PTY oracle (host wall clock).** Both arms run a real PTY with a real shell. The
frozen seed script defines one probe command. Executing that command appends one
line to a host file named by `BOTSTER_BASELINE_LOG`:

```
printf '%s %s\n' "$EPOCHREALTIME" "$marker" >> "$BOTSTER_BASELINE_LOG"
```

The harness reads that file directly on the host filesystem. The value is
plaintext, arm-neutral, and produced by the product's own PTY path, not by a
harness stub.

**Paint oracle.** An `addInitScript` payload installs a `requestAnimationFrame`
sampler over the mounted terminal canvas. It hashes the canvas pixel buffer each
frame and records the timestamp of each hash change. First change after attach is
the paint-ready endpoint. The first sample of a hash held stable for the frozen
settle window is the paint-settled endpoint.

**Keydown endpoint.** The same `addInitScript` payload installs a capture-phase
`keydown` listener that stamps `Date.now()` for the probe key. It records a
timestamp only. It never cancels, rewrites, or delays the event.

Three endpoints therefore exist per repetition:

| Symbol | Meaning | Source |
|--------|---------|--------|
| `t_key` | the browser dispatched the probe key | capture-phase keydown, `Date.now()` |
| `t_pty` | the session shell executed the probe command | `EPOCHREALTIME` in the host log file |
| `t_paint` | the echoed output reached the canvas | paint oracle hash change |

`t_key` and `t_pty` share one wall clock because the capture requires the browser
and the PTY to run on one host. G12 asserts that requirement and the record
carries `same_host: true`. A capture that cannot prove one host emits no
`key_to_pty` value.

**Naming.** `key_to_pty` is `t_pty - t_key`: browser keydown dispatch to shell
execution of the probe command. It includes the shell's own execution cost. The
plan does not hide that cost. Each capture records
`shell_exec_calibration_ms` per arm, measured by driving the identical probe
command on a local PTY with no browser in the path, so a reader can see the floor
that every `key_to_pty` value sits above. Echo receipt is never called
`key_to_pty`.

Consequences:

- No production file under `src/botster/`, `src/app/`, or `src/vendor/` changes,
  and no file in the legacy checkout changes.
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
| `declared_revision` | the Restty source commit the arm declares |
| `declaration_source` | the exact file or commit that declares it |
| `artifact_sha256` | the SHA-256 of every vendored Restty distribution file the arm loads |
| `ghostty_pin` | the Restty-pinned Ghostty commit when the arm declares one, otherwise `null` with a reason |

Known values at plan time. The modular arm declares Restty
`59c640488f33b10296875471691e43da6890e074` and Ghostty pin
`eb72ec61304ea256be1d86ed8fa961c84e43ecbd` in `src/vendor/restty/README.md`. The
legacy arm at `f598075e` vendors `app/frontend/vendor/chunk-02afddvq.js`, declared
by the commit message of `2b52d0c9` as Restty `cd1911d0f`; that arm declares no
Ghostty pin. The legacy declaration is a short revision in a commit message, so
`artifact_sha256` is what makes it verifiable. G14 rejects a record whose
`declared_revision` or `artifact_sha256` is missing or does not match the loaded
files.

Each observation family records `endpoint_start`, `endpoint_end`, `oracle`
(`pty` or `paint`), `unit` (`ms`), `n`, `warmup_discarded`, and the statistic set
`min`, `p50`, `p95`, `max`. A family that cannot run on an arm records
`status: "not_applicable"` plus a reason, never a number.

The eight families:

| Family | `endpoint_start` | `endpoint_end` | Oracle |
|--------|------------------|----------------|--------|
| `key_to_pty` | `t_key`, the probe keydown | `t_pty`, the shell executed the probe command | pty |
| `attach_ready` | the mounted terminal begins attach | first canvas hash change after attach | paint |
| `history_finish` | first canvas hash change after attach | canvas hash stable for the settle window | paint |
| `scrollback` | first wheel event dispatch | canvas hash stable for the settle window | paint |
| `large_history` | attach against the seeded large-history session | canvas hash stable for the settle window | paint |
| `control_response_saturation` | `t_key` during the control-response burst | `t_pty` | pty |
| `package_event_saturation` | `t_key` during the 200 package-event burst | `t_pty` | pty |
| `sibling_saturation` | `t_key` on terminal B while terminal A is flooded | `t_pty` for terminal B | pty |

The `key_to_pty` entry also carries the sibling statistic sets `pty_to_paint_ms`
(`t_paint - t_pty`) and `key_to_paint_ms` (`t_paint - t_key`), so the round trip
stays decomposable without adding a family, and `shell_exec_calibration_ms` from
§6.

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
| Probe command | one fixed command per repetition, appending `$EPOCHREALTIME` and a unique marker to `$BOTSTER_BASELINE_LOG` |
| Repetitions | 20 measured, 3 warm-up repetitions discarded and recorded as discarded |
| Scrollback gesture | fixed wheel delta, fixed event count, fixed pacing |
| History size | one fixed line count and one fixed byte count, produced by the seed script |
| Control-response burst | one fixed schedule of `list_configs` and `list_session_types`, with the server-to-client response rate and bytes equalized across arms within the recorded tolerance |
| Package-event burst | 200 package events on the modular arm only, matching the existing lane at `scripts/live-packaged-protocol-harness.mjs:1835` |
| Sibling flood | two mounted terminals, terminal A flooded with a fixed output byte count from the seed script, terminal B probed |
| Settle window | one fixed millisecond window for canvas-hash stability |
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
- `scripts/terminal-baseline-observer.mjs` — the `addInitScript` payload and the
  per-arm capture routine, including the wire and paint oracles.
- `scripts/terminal-baseline-capture.mjs` — the two-arm orchestrator. Starts each
  arm, runs the seven families in both arm orders, tears each arm down, validates
  the record, and writes it.
- `fixtures/terminal-baseline/seed.sh` — the frozen session workload, the history
  seed, the probe command that appends `$EPOCHREALTIME` and the marker to
  `$BOTSTER_BASELINE_LOG`, and the sibling flood workload.
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
5. Both arms run a real PTY with a real shell that can execute the frozen probe
   command and append to `$BOTSTER_BASELINE_LOG`. Verified in the modular arm
   through the existing packaged harness terminal lane. Implement must verify it
   on the legacy arm before recording any `key_to_pty` value, and mark the family
   `blocked` with a typed reason if it does not hold.
6. `Date.now()` in the page and `$EPOCHREALTIME` in the session shell read one
   wall clock, because G12 requires the browser and the PTY to run on one host.
   The record carries `same_host: true`. A capture that cannot prove one host
   emits no `key_to_pty` value.
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
3. Whether the legacy arm exposes a stable mounted-canvas selector. Owned by this
   ticket's Implement step. If not, the paint oracle falls back to the arm's
   terminal container element and records which selector it used.
4. Whether the two arms' `list_configs` and `list_session_types` response shapes
   are close enough to equalize response frames and bytes within a useful
   tolerance. Owned by this ticket's Implement step, which must record the
   achieved tolerance and, when the shapes differ, record that limitation in the
   record rather than dropping the family.
5. The full Restty revision the legacy arm vendors. `2b52d0c9` declares the short
   revision `cd1911d0f` in a commit message only. Owned by this ticket's Implement
   step, which records the short declaration plus `artifact_sha256` and resolves
   the full revision from the `trybotster/restty` repository when it is
   reachable.

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
| The shell's own execution cost is read as transport latency | Every `key_to_pty` value is inflated by an unstated floor | §6 records `shell_exec_calibration_ms` per arm from the identical probe command driven on a local PTY with no browser; the metric name states it includes shell execution |
| Browser and PTY wall clocks diverge | `key_to_pty` becomes meaningless or negative | G12 requires one host and the record carries `same_host: true`; the harness discards and records any repetition whose `t_pty` precedes `t_key` |
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
| G8 | Ordering holds: paint-ready precedes paint-settled in every repetition | harness assertion per repetition |
| G9 | No terminal delivery queue overflow occurs during the package-event burst | reuse the existing overflow check at `scripts/live-packaged-protocol-harness.mjs:1906` |
| G10 | Package events never enter the terminal adapter path in the modular arm | reuse the existing check at `scripts/live-packaged-protocol-harness.mjs:1923` |
| G11 | Arm teardown is proven live: recorded Hub and worker pids are gone and the arm socket path is absent after stop | harness assertion per arm |
| G12 | Both checkouts are clean and at the recorded revisions before the capture starts | harness precondition, fails closed |
| G13 | The recorded record validates against `format_version=1` | `npm run observe:terminal-baseline:validate` |
| G14 | Every arm entry carries a Restty `declared_revision`, a `declaration_source`, and an `artifact_sha256` that matches the vendored files the arm actually loads | validator assertion plus a harness precondition, fails closed |
| G15 | Both arms ran on one host, and no repetition has `t_pty` before `t_key` | harness precondition and per-repetition assertion |

G5 aborts before it reaches any test when it is written as the bare npm script:
`npm run smoke:live-packaged-protocol` builds Web and then exits, because
`scripts/live-packaged-protocol-harness.mjs:142-145` requires `BOTSTER_HUB_BIN`
and lines 9062-9066 require `BOTSTER_SESSION_WORKER_BIN`. Plan Review reproduced
that pre-execution abort. G5 is therefore the complete pinned sequence:

```sh
# 1. Pin the Hub checkout to the modular arm revision.
git -C "$HUB_CHECKOUT" fetch --quiet origin
git -C "$HUB_CHECKOUT" checkout --quiet f6db5c436f72b151fd6dacde61d3f4836a4dc925
test -z "$(git -C "$HUB_CHECKOUT" status --porcelain)"

# 2. Prove the locked Core revision before building.
grep -q '7eafa470a18025895995bbedc20d34b58106a03b' "$HUB_CHECKOUT/Cargo.lock"

# 3. Build both debug binaries from that checkout.
( cd "$HUB_CHECKOUT" && cargo build --locked --bin botster-hub )
( cd "$HUB_CHECKOUT" && cargo build --locked -p botster-core-daemon --bin botster-session-worker )

# 4. Run the lane with both binaries supplied.
BOTSTER_HUB_BIN="$HUB_CHECKOUT/target/debug/botster-hub" \
BOTSTER_SESSION_WORKER_BIN="$HUB_CHECKOUT/target/debug/botster-session-worker" \
  npm run smoke:live-packaged-protocol
```

Implement records the resolved `$HUB_CHECKOUT`, both binary real paths, and the
`Cargo.lock` grep result in the implement report. `candidateBinaryProvenance` in
`scripts/live-packaged-protocol-helpers.mjs` already requires both real paths to
sit under the same cargo target directory, so step 3 must build into the Hub
checkout's own `target/`.

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
