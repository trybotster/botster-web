# Terminal baseline observation format

Version token: `terminal_baseline_observation_format=3`

This is the published observation format for ticket `ticket_1787603669_760394`.
Version 3 supersedes version 2 before any baseline becomes authoritative
(`question_1787702156_949472`). Downstream tickets must reuse this version.
They must not re-derive the schema. There is no version 2 compatibility path.

- `ticket_1787600689_646958` vendors Restty `cd1911d0f88606270b1457c6995a3c04cb497edf`
  and updates `PINNED_REVISIONS.modular_restty`. It does not publish a local or
  controlled observation record. `botster-ubuntu-24.04-16core` is unavailable.
- The post-Restty controlled set is the required future transport comparison set
  for `ticket_1787600676_914408` and `ticket_1787600679_990088`. That set does
  not exist yet. Those tickets reuse this version 3 schema when the runner
  exists. They must not claim a measured latency improvement from
  `ticket_1787600689_646958`.
- Do not describe the missing controlled set as an existing transport baseline.

## Product baseline only

This format records a **product baseline**, not a transport-causality experiment.
The two arms differ in Hub, Core, client, and Lua runtime at once. No row of a
`format_version=3` record may be read as evidence that any single component
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
| `terminal_attach` | `subscribe` | `attach` |
| `terminal_snapshot` | `request_snapshot` | `read_screen` |

Legacy attach issues the production terminal `subscribe` by opening the
frozen probe session on a new page. It does not create a new session and
does not use the test-only `_botsterTestTerminal` hook. Inbound is the
decoded `subscribed` confirmation plus that page's subscribe-attempt
generation. Modular attach inbound is the decoded `attach_state` admission
after `webrtc_response_assembly`. Identity and generation come only from
that decoder or encoder pair. The harness does not copy request fields or
use peer-connection generation. Both arms attach the same frozen session
identity. Attach attempts run sequentially. Each legacy attempt uses a new
page. Teardown waits for the production `unsubscribe`, proves the observer
is closed, and closes that page before the next subscribe. The harness
rejects send-only completion, local callbacks, request bytes, synthetic
byte estimates, missing decoder identity, missing generation, wrong
identity, wrong or stale generation, session creation, session identity
drift, late messages after teardown, and incomplete teardown. `resize` is
not a version 3 control operation.

The record stores the semantic name and the arm-specific wire type. Each arm
records `request_rate`, `response_rate`, `response_bytes`, `inbound_byte_unit`,
`producer`, `wire_request_types`, and `tolerance`. Both arms count
`decoded_inbound_control_payload_bytes`: the decoded control payload after
decrypt or decode, excluding DataChannel or WebRTC framing and a leading
`0x00`, `0x01`, or `0x02` prefix. Encrypted assembly `total_bytes` is not the
unit. The validator recomputes rate and byte equality from the recorded family
values and the frozen tolerance. Stored equalization booleans are derived
output only.

The retired names `list_configs`, `list_session_types`, and `terminal_resize`
must not reappear. Do not add unsupported aliases to either product.

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
4. Keep `format_version=3`. Do not add a threshold field.

Until that runner exists, the controlled set stays deferred. A one-armed
workflow result is not a baseline. This ticket waives both the local record
(`question_1787689401_836936`) and the controlled record
(`question_1787678013_829162`). The project still requires those records
when an authenticated session or the runner exists. Do not mark an incomplete
record as publishable.
