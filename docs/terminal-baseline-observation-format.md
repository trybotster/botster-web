# Terminal baseline observation format

Version token: `terminal_baseline_observation_format=2`

This is the published observation format for ticket `ticket_1787603669_760394`.
Version 2 supersedes version 1 before any baseline becomes authoritative
(`question_1787678013_829162`). Downstream tickets must reuse this version.
They must not re-derive the schema.

- `ticket_1787600689_646958` records the post-Restty transport baseline in
  `format_version=2`.
- `ticket_1787600679_990088` compares its post-cut set against that post-Restty
  baseline (architecture contract §14 row A20).

## Product baseline only

This format records a **product baseline**, not a transport-causality experiment.
The two arms differ in Hub, Core, client, and Lua runtime at once. No row of a
`format_version=2` record may be read as evidence that any single component
caused a difference. Every record carries `product_baseline_only: true` and the
same inline statement.

A one-armed record is not a baseline. The harness refuses to publish a
comparison when either arm cannot complete.

## Source of truth

`scripts/terminal-baseline-observation-format.mjs` is the executable schema,
statistic helper, and validator. This document describes that module. A change
to the contract bumps `format_version`.

## Capture-level oracles

| Member | Allowed values | Rule |
|--------|----------------|------|
| `paint_oracle` | `cdp_screencast` | The only paint oracle. The validator rejects any other value. An arm without `Page.startScreencast` blocks the cross-arm paint families. |
| `pty_clock` | `shell_epochrealtime` or `host_watcher` | Negotiated once for the whole two-arm capture. Both arms use the same clock and the same dispatcher variant. |

`key_to_pty` is `t_pty - t_key`. Under `shell_epochrealtime`, `t_pty` is the
dispatcher's clock evaluation immediately before the append.
`decomposition_valid` is then `true`, and `append_cost_calibration_ms` bounds
the evaluation-to-append interval. Under `host_watcher`, `t_pty` is the host
observation of the append, `decomposition_valid` is `false`, and negative
`pty_to_paint_ms` values are recorded rather than discarded.

The paint oracle observes a client renderer. Restty is not terminal authority.

## Eight families

| Family | Start | End | Oracle |
|--------|-------|-----|--------|
| `key_to_pty` | final Enter of the probe line | `t_pty` | pty |
| `attach_ready` | mounted terminal begins attach | first sampled-region hash change after attach | paint |
| `history_finish` | first sampled-region hash change after attach | sampled-region hash stable for the settle window | paint |
| `scrollback` | first wheel event dispatch | sampled-region hash stable for the settle window | paint |
| `large_history` | attach against the seeded large-history session | sampled-region hash stable for the settle window | paint |
| `control_response_saturation` | `t_key` during the control-response burst | `t_pty` | pty |
| `package_event_saturation` | `t_key` during the 200 package-event burst | `t_pty` | pty |
| `sibling_saturation` | `t_key` on terminal B while terminal A is flooded | `t_pty` for terminal B | pty |

`package_event_saturation` is modular-only. The legacy arm records
`status: "not_applicable"` with the reason that `f598075e` has no
harness-drivable package-event plane. The retired term `event_saturation` must
not reappear.

Each measured family records `n`, `warmup_discarded`, `min`, `p50`, `p95`, and
`max` in milliseconds. A family that cannot run records `status` plus a typed
reason, never a number. The record must not carry a threshold field.

The validator requires:

- `endpoint_start` and `endpoint_end` to match the family contract
- `n=20` and `warmup_discarded=3` on every measured family
- `frozen_inputs` to match the frozen constants
- every required family measured on both arms, except legacy
  `package_event_saturation` as `not_applicable`
- no blocked publication family, so a one-armed or partial record is not a
  publishable baseline

## Control-response operations

`control_response_saturation` uses two shared browser-issued semantic
operations. Both arms issue them through each stack's production browser
control connection. The harness must not use a direct daemon Unix socket.

| Semantic name | Legacy wire type | Modular wire type |
|---------------|------------------|-------------------|
| `terminal_resize` | `resize` | `resize` |
| `terminal_snapshot` | `request_snapshot` | `read_screen` |

The record stores the semantic name and the arm-specific wire type. Each arm
records `request_rate`, `response_rate`, `response_bytes`, `producer`,
`wire_request_types`, and `tolerance`. The harness equalizes the measured
server-to-browser frame rate and byte rate and records the achieved values.

The retired names `list_configs` and `list_session_types` must not reappear.
Do not add unsupported aliases to either product.

## Frozen inputs

The harness fails closed when it cannot prove a frozen input. The constants live
in the format module. They include viewport `1440x900` at device scale factor
`1`, 20 measured repetitions, 3 discarded warm-ups, the settle window, the
history and sibling workloads, and PNG screencast dimensions at or above the
viewport.

## Local observation

```bash
BOTSTER_LEGACY_CHECKOUT=/path/to/clean-f598075e \
BOTSTER_HUB_SOURCE=/path/to/botster-hub \
npm run observe:terminal-baseline
```

The legacy checkout must be clean at
`f598075e6c143ef14b34d3a3dffdf2ec6a8d9eb6`. The Hub source is read-only. The
harness clones a scratch checkout at
`f6db5c436f72b151fd6dacde61d3f4836a4dc925` and builds there.

Validate a record:

```bash
npm run observe:terminal-baseline:validate -- docs/reports/terminal-baseline-observation-local-<capture_id>.json
```

The local set is observational and non-gating. This ticket did not publish a
local record. Later tickets must not describe a local record as
controlled-runner evidence, and must not use this ticket as evidence for a
measured latency improvement or regression.

## Controlled runner rerun

The workflow `.github/workflows/terminal-regression-baseline.yml` is
`workflow_dispatch` on `botster-ubuntu-24.04-16core`. The harness admits that
host only after it proves Linux, Ubuntu 24.04, x64, and 16 logical CPUs. A
mislabeled host cannot publish the controlled record. No code change is required
to produce the controlled set.

1. Register a GitHub Actions runner with label `botster-ubuntu-24.04-16core`.
2. Provision both product arms on that runner, including the legacy Ruby and
   Rails toolchain.
3. Dispatch the workflow with a clean legacy checkout at `f598075e` and a Hub
   source that can clone `f6db5c4`.
4. Keep `format_version=2`. Do not add a threshold field.

Until that runner exists, the controlled set stays deferred. A one-armed
workflow result is not a baseline. This ticket waives both the local record
(`question_1787689401_836936`) and the controlled record
(`question_1787678013_829162`). The project still requires those records
when an authenticated session or the runner exists. Do not mark an incomplete
record as publishable.
