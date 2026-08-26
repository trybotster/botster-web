# Web: vendor the current Restty revision and verify scroll pacing

Ticket: `ticket_1787600689_646958`
Run: `run_1787761714_735678`
Pipeline: `botster_stack_delivery`

## 1. Target repository

| Field | Value |
|-------|-------|
| `target_id` | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Spawn target path | `/Users/jasonconigliari/Projects/botster-web` |
| Repository playbook | `[[botster-web-playbook]]` |

The spawn target row for `tgt_40abcf71ccf049f4ac0c99953a799869` carries the display
name `booster-web` and the repository name `trybotster/botster-web`. The
repository name is authoritative. The ambient worktree was not used to resolve
the target.

## 2. Playbooks and notes loaded

Role and repository charters:

- `[[planner-playbook]]`
- `[[botster-planner-playbook]]`
- `[[botster-web-playbook]]`

Targeted atomic notes:

- `[[Web vendors a complete Restty build from the approved commit]]`
- `[[verify pinned ref contents before writing format rules]]`
- `[[vendored restty uses relative chunk imports so no Vite alias is needed]]`
- `[[a product baseline is not a causality experiment]]`
- `[[a one armed capture is not a baseline]]`
- `[[debug runtime means two complete debug product stacks]]`
- `[[botster terminal attach owns one size snapshot and live output transaction]]`
- `[[verification evidence is scoped to a stable commit and clean tree]]`

Not loaded, with reason:

- `[[botster runtime teardown lenses]]`. See section 10. The runtime-teardown
  class does not apply.
- `[[project-pipelines-playbook]]`. No Project Pipelines package or plugin path
  is in scope.
- Other repository charters. This run changes only `botster-web`.

## 3. Context loaded

Repository files read:

- `src/vendor/restty/README.md`
- `src/botster/resttyRenderer.ts`
- `scripts/terminal-baseline-observation-format.mjs`
- `scripts/terminal-baseline-capture.mjs`
- `docs/terminal-baseline-observation-format.md`
- `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md`
- `docs/reports/capture-the-debug-runtime-terminal-regression-baseline-implement.md`
- `src/App.test.mjs` (vendor and renderer assertions)
- `package.json`

Restty source read at the exact revisions:

- `59c640488f33b10296875471691e43da6890e074` (current vendored revision)
- `cd1911d0f88606270b1457c6995a3c04cb497edf` (target revision, `main` head)
- `git diff 59c640488 cd1911d0f` over `src/input/`, `src/runtime/`, and `tests/`

Pipeline context read: ticket, run, gates, dependencies, and the closed
dependency `ticket_1787603669_760394`.

Human decisions received:

- `question_1787761913_284316` selected Q1 option B and Q2 option A.
- `question_1787761969_117759` corrected my description of the wheel byte
  producer and supersedes the Q1 basis only. It keeps option B and adds the
  single-authority rule in section 6 item S5. Q2 is unchanged.

## 4. The approved revision

The current approved Restty revision is
`cd1911d0f88606270b1457c6995a3c04cb497edf`, the head of `trybotster/restty`
`main`, dated 2026-08-22.

`scripts/terminal-baseline-observation-format.mjs` already records that same
revision as `legacy_restty`. The legacy arm of the frozen baseline vendors it.
The modular arm still vendors `59c6404`. This ticket removes that difference.

The three commits between the two revisions are exactly the three wheel changes
the ticket requires:

| Commit | Subject |
|--------|---------|
| `90e411592` | `fix(input): accumulate wheel pixels and batch mouse reports` |
| `3d0847d60` | `fix(input): close wheel remainder and touch fallback nits` |
| `cd1911d0f` | `fix(input): pace TUI mouse wheel bursts across frames` |

The diff touches `src/input/`, `src/runtime/create-runtime.ts`,
`src/runtime/interaction-runtime/bind-pointer-events.ts`, and tests only. It
touches no Zig or WASM source.

`git ls-tree cd1911d0f reference/ghostty` reports
`eb72ec61304ea256be1d86ed8fa961c84e43ecbd`, the same Ghostty pin the current
vendor record names. The Restty package version stays `0.1.34`.

## 5. What the new revision changes for a consumer

`InputHandlerOptions` gains two optional members, `getCellHeight` and `getRows`.
`MouseTracker` becomes stateful for wheel reports:

- It accumulates `pendingWheelPx` across wheel events.
- It converts accumulated pixels into row steps with `getCellHeight`.
- It bursts at most `min(WHEEL_REPORTS_PER_BURST, getRows())` reports at once.
- It drains the leftover through `scheduleWheelDrain`, which defaults to
  `requestAnimationFrame`.
- It drops a stale remainder when the scroll direction reverses.
- Without `getCellHeight` and `getRows` it falls back to 20 pixels and 24 rows.

`createResttyApp` passes `getCellHeight: () => gridState.cellH` and
`getRows: () => gridState.rows`. The mounted `Restty` instance therefore gets
the new behavior with real grid metrics as soon as Web vendors the build.

`src/botster/resttyRenderer.ts` has a second wheel path. `encodeSemanticInput`
re-encodes the same wheel event against fresh mode flags with a throwaway
`createInputHandler` that receives neither option. The bytes Web sends to the
PTY come from that re-encode, not from the mounted runtime. After the update the
two paths can disagree:

- The re-encode uses 20 pixels per cell and 24 rows while the mounted runtime
  uses the live grid, so the two burst sizes can differ.
- The re-encode starts with an empty accumulator on every event, so a single
  sub-cell delta produces no bytes.
- A deferred drain from the mounted tracker reaches the PTY path with no
  matching pending semantic, so it passes through as raw bytes and skips the
  mode gate.

Before `cd1911d0f` both paths emitted one report per wheel event, so they
agreed. Vendor-only delivery would therefore let rendered scroll distance and
PTY scroll distance diverge. Section 6 fixes that.

## 6. Scope

Human decision `question_1787761913_284316` selected Q1 option B and Q2
option A.

### In scope

S1. Build Restty at `cd1911d0f88606270b1457c6995a3c04cb497edf` from a clean
checkout with `bun run build:wasm` and `bun run build`, then vendor the complete
distribution into `src/vendor/restty/`.

S2. Update `src/vendor/restty/README.md` to name the new revision, the unchanged
Ghostty pin `eb72ec6`, Zig `0.16.0`, `ReleaseSafe`, and the three wheel changes.

S3. Update every non-vendor reference to the emitted chunk file name. The build
emits a content-hashed `chunk-*.js`, so `chunk-3mc71e83.js` changes. Known
non-vendor references: `src/App.test.mjs:2501` and
`scripts/terminal-baseline-capture.mjs:91`.

S4. Update `src/App.test.mjs:2498` to assert the new revision, and keep the
existing `readOnly`, `suppressQueryReplies`, and OSC 10/11/12 assertions.

S5. Give the Web wheel path the mount-scoped integration the human approved in
`question_1787761969_117759`:

- Keep one mount-scoped wheel re-encoder. That re-encoder is the only PTY wheel
  byte authority. Do not create a second PTY wheel producer.
- Give the re-encoder the same live cell height and row count the mounted Restty
  handler uses, through `getCellHeight` and `getRows`.
- Refresh the current mouse mode bits before each immediate send and before each
  deferred drain.
- Route every PTY wheel byte through the existing mode-gated input path.
- Suppress unmatched raw wheel drain bytes that arrive from the mounted Restty
  handler, so mounted-handler bytes and re-encoded bytes never both reach the
  PTY.
- Cancel pending wheel state and scheduled drains on teardown, session
  replacement, and generation change.
- Emit nothing from a stale mount or a stale generation.

The mounted Restty handler keeps renderer wheel accumulation and live grid
metrics. Web keeps the mode-gated PTY send decision. The two must agree on
report count and direction.

S5a. Make the wheel encode idempotent per browser event.
`HubTerminalDataPlane.writeModeGatedInputAfterBarrier` can call
`ModeDependentTerminalInput.encode` up to three times for one semantic event:
once at `src/botster/hubTerminalDataPlane.ts:188`, again after a mode refresh at
`:207`, and again with fresh modes after a stale reject at `:259`. A stateful
re-encoder that mutated its accumulator inside `encode` would count one browser
wheel event two or three times.

The plan therefore fixes the boundary this way:

- The mount-scoped re-encoder mutates wheel state exactly once, when the browser
  wheel event arrives, not inside `encode`.
- That mutation produces one immutable wheel decision for the event: the burst
  step count, the direction, and the cell and row values used.
- Every `encode(modes)` call for that event renders bytes from that immutable
  decision against the modes it receives. It never advances or rewinds the
  accumulator.
- A stale reject therefore re-renders the same decision with fresh modes and
  produces no extra scroll distance.
- A deferred drain is a separate semantic event. It takes its own decision, then
  goes through `writeModeGatedInput` once.

S6. Update `PINNED_REVISIONS.modular_restty` in
`scripts/terminal-baseline-observation-format.mjs` to
`cd1911d0f88606270b1457c6995a3c04cb497edf`. Keep `format_version=3`.

S7. Update `docs/terminal-baseline-observation-format.md` so it states:

- The post-Restty controlled set is the required future transport comparison set
  for `ticket_1787600676_914408` and `ticket_1787600679_990088`.
- That set does not exist yet. `botster-ubuntu-24.04-16core` is unavailable.
- Those tickets reuse the same version 3 schema when the runner exists.
- Those tickets must not claim a measured latency improvement from this ticket.

S9. Add the focused large-history and wheel scrollback lane defined in
section 11, exposed as `npm run smoke:mounted-terminal-wheel-scrollback`.

S8. Write `docs/reports/vendor-current-restty-revision-and-verify-scroll-pacing-implement.md`
with the build provenance, the deterministic wheel evidence, and the blocked
controlled record with its exact missing-runner reason.

### Out of scope

N1. Any transport change. Sibling tickets `ticket_1787600676_914408` and
`ticket_1787600684_892051` own dedicated subscription DataChannels.

N2. Any transport-causality claim. This ticket does not attribute a product
difference to Restty, Hub, Core, or the client.

N3. Publishing performance numbers. No local record and no controlled record.

N4. Any threshold field, any `format_version` bump, and any schema re-derivation.

N5. Ghostty semantics, keyboard encoding, attach, snapshot, resize, and
reconnect behavior.

N6. Adjacent cleanup in `resttyRenderer.ts` outside the wheel path.

N7. Changing the legacy arm. The legacy monorepo is not a delivery target.

## 7. Ownership boundaries and cross-repository dependencies

- `botster-web` owns Restty mounting, input callbacks, resize, and teardown as a
  renderer integration. This plan keeps every change inside that boundary.
- `trybotster/restty` (`tgt_9a348ca759594fdeaed2894c1f70a4c7`) is a build input.
  Web reads it, builds it, and vendors the result. This plan changes no Restty
  file. No new dependency ticket is required, because `cd1911d0f` is already
  merged on `main` and already approved as the legacy arm pin.
- Core keeps terminal authority. Restty is a renderer, not terminal truth.
- Hub stays content-blind. This plan sends no new message kind.
- Dependency `ticket_1787603669_760394` is closed. It published
  `format_version=3` and waived both observation records. This plan consumes that
  format and does not re-derive it.
- Downstream consumers `ticket_1787600676_914408` and `ticket_1787600679_990088`
  read the updated pin and the updated format document.

## 8. Assumptions and unknowns

Assumptions:

A1. `cd1911d0f88606270b1457c6995a3c04cb497edf` is the current approved revision.
Source: it is the head of `trybotster/restty` `main`, it contains exactly the
three required wheel commits, and the frozen format module already names it as
`legacy_restty`.

A2. The WASM artifact is unchanged. The diff touches no Zig source and the
Ghostty submodule pin is identical at both revisions. Implement must prove this
by comparing the emitted WASM bytes, not by assuming it.

A3. The GHOSTSNP browser fixture stays at SHA-256
`7aba861353b9d45cf28a128ba48e6e3ab0b0b87610d53e7136a591363cc4fd28`. Implement
must re-verify.

A4. `bun 1.4.0` and `zig 0.16.0` are installed and are the versions the build
uses. Both resolve on this host through mise.

A5. The local Restty checkout at `/Users/jasonconigliari/Projects/restty` has a
dirty submodule and untracked files. Implement must build from a clean checkout
of `cd1911d0f`, not from that working tree.

Unknowns for Implement to resolve:

U1. The exact emitted chunk file name. It is content-hashed and cannot be known
before the build.

U2. Whether the build emits any new or removed top-level file under `dist/`. The
vendor copy must add and remove files to match, not merge over the old tree.

U3. Whether the mounted grid exposes a cell height directly, or whether the
implementation must derive it from canvas height divided by rows. The renderer
already derives rows and columns from the pane and from
`ptyTransport.currentGrid()`.

U4. The correct stale-generation identity for a deferred drain. The renderer
already tracks a descriptor with a session identity. Implement must bind the
drain guard to the existing mount and attachment identity rather than add a new
one.

U5. Whether `git status` reports the correction question answer before Plan
Review. The plan does not depend on it.

## 9. Affected surfaces and files

| File | Change |
|------|--------|
| `src/vendor/restty/**` | Replace with the complete build from `cd1911d0f`. |
| `src/vendor/restty/README.md` | New revision, unchanged Ghostty pin, new wheel behavior. |
| `src/botster/resttyRenderer.ts` | Mount-scoped wheel handler, grid metrics, guarded deferred drain. |
| `src/App.test.mjs` | New revision assertion, new chunk name, new deterministic wheel tests. |
| `src/botster/mountedKeyboardSmoke.tsx` | Large-history and wheel scrollback lane. |
| `scripts/mounted-terminal-keyboard-smoke.mjs` | Large-history and wheel scrollback lane. |
| `package.json` | `smoke:mounted-terminal-wheel-scrollback` script. |
| `src/botster/botsterTerminalPtyTransport.ts` | Only if the idempotent encode boundary requires it. Implement must state whether it changed. |
| `scripts/terminal-baseline-capture.mjs` | New chunk name in `RESTTY_RUNTIME_FILES`. |
| `scripts/terminal-baseline-observation-format.mjs` | `modular_restty` pin. |
| `docs/terminal-baseline-observation-format.md` | Future comparison set wording. |
| `docs/plans/vendor-current-restty-revision-and-verify-scroll-pacing.md` | This plan. |
| `docs/reports/vendor-current-restty-revision-and-verify-scroll-pacing-implement.md` | Implement report. |

`docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md` also
names the old chunk file. It is a historical plan record. Do not edit it.

## 10. Runtime-teardown class

`teardown_class_applies: false`.

The ticket changes a vendored renderer build and one browser input encoding
path. It changes no WebRTC or peer lifecycle, no SessionIo or ClientWorker
teardown, no multi-peer ownership, and no terminal-state versus live-runtime
divergence. The deferred wheel drain adds one scheduled callback inside a single
mount. Section 6 item S5 already requires drain cancellation on unmount,
replacement, and teardown, and stale-generation rejection. Section 11 proves
both with deterministic tests. `[[botster runtime teardown lenses]]` is
therefore not loaded, per the Plan step instruction that excludes ordinary
client input tickets.

## 11. Acceptance checks and tests

### Build provenance

P1. Clean checkout of `cd1911d0f88606270b1457c6995a3c04cb497edf`, with
`git status --porcelain` empty and the `reference/ghostty` submodule at
`eb72ec6`. Record both.

P2. `bun run build:wasm` then `bun run build`. Record `bun --version` and
`zig version`.

P3. The emitted WASM bytes equal the currently vendored WASM bytes. Record the
SHA-256 of both.

P4. `fixtures/ghostsnp/rich-matrix-v1.bin` still hashes to
`7aba861353b9d45cf28a128ba48e6e3ab0b0b87610d53e7136a591363cc4fd28`.

P5. The vendored tree contains the emitted JavaScript, every `chunk-*.js`, the
type declarations, and the font, grid, and runtime subdirectories. No file from
the previous build remains that the new build does not emit.

P6. Every vendored import stays relative. No Vite alias is added.

### Deterministic wheel tests

The human decision requires ten. W11 is the eleventh, added by Plan Review finding finding_1787762913_785846. Add them to `src/App.test.mjs` through
the existing compiled-runtime harness so they exercise the real renderer module,
not a source regex.

W1. Sub-cell pixel deltas accumulate across browser wheel events into one row
report.
W2. The mounted handler report count and the PTY report count agree.
W3. The mounted handler scroll direction and the PTY scroll direction agree.
W4. A large delta produces a burst bounded by the live grid row count.
W5. Pixel-to-cell conversion uses the live cell height, not the 20-pixel
fallback.
W6. Every deferred PTY drain passes through the mode gate.
W7. No unmatched mounted drain reaches raw PTY input.
W8. A mouse mode change before a drain changes the drain decision.
W9. A stale mount and a stale generation emit no bytes, and a teardown before a
scheduled drain cancels it.
W10. One wheel event cannot produce duplicate PTY bytes.
W11. One forced stale `ModeGatedInput` reject calls `encode` twice for one wheel
event, and the result is one accumulator mutation, correct fresh-mode bytes on
the retry, and no duplicate immediate or deferred PTY bytes.

### Repository gates

G1. `npm run typecheck`.
G2. `npm run lint`.
G3. `npm test`.
G4. `npm run build`.
G5. `npm run smoke:mounted-terminal-keyboard`.
G6. `npm run smoke:ghostsnp-grid`.
G7. `npm run smoke:incremental-ghostsnp-attach`.
G8. `npm run smoke:mounted-terminal-wheel-scrollback`, the new focused
large-history and wheel scrollback gate defined below.

G5 through G8 are the browser render proofs for the new vendored build. They
cover terminal render, GHOSTSNP grid install, incremental attach against the
production reader, and large-history scrollback under real wheel events.

### Focused large-history and scrollback gate

The ticket requires focused wheel, scrollback, large-history, and
terminal-render tests. W1 through W11 cover wheel behavior. G6 covers retained
GHOSTSNP scrollback, but its fixture retains only
`SCROLLBACK-LINE-000` through `SCROLLBACK-LINE-029`. G7 delivers one PAGE frame
and does not prove a large history. G8 closes that gap.

G8 is deterministic. It records no wall-clock value and belongs to neither
observation set.

- Harness: extend the existing mounted terminal smoke,
  `src/botster/mountedKeyboardSmoke.tsx` and
  `scripts/mounted-terminal-keyboard-smoke.mjs`, with a second lane selected by
  an environment flag. Do not add a new harness.
- Workload: the frozen large-history workload already in the repository,
  `fixtures/terminal-baseline/history-seed.sh`. It is 400 lines of 80 bytes,
  and each line is its own zero-padded index. Feed those bytes through the
  harness `emitOutput` sink, which is the production terminal output path.
- Production reader path: the mounted `Restty` instance and the vendored
  incremental reader. The lane uses no test-only decoder.
- Oracle: rendered rows. After the workload settles, the lane reads the viewport
  rows, dispatches real wheel events at the mounted canvas, and reads the rows
  again.
- Assertions: the settled viewport ends at line 400; a known wheel distance
  scrolls back to the exact expected zero-padded line index for that distance;
  every visible line keeps its full 80 bytes; and the PTY input sink receives
  the wheel reports that match the rendered distance, per W2 and W3.
- Failure condition: a missing line, a truncated line, a scroll distance that
  disagrees with the rendered rows, or any page error.

### Production path proof

The change is not scaffold-only. The production entry point is the mounted
`Restty` instance created in `src/botster/resttyRenderer.ts` and the wheel bytes
that instance sends through `ptyTransport`. W1 through W11 run against that
module. G5 through G7 render it in a real browser.

### Recorded, not claimed

R1. Record the controlled observation set as blocked. Reason:
`botster-ubuntu-24.04-16core` is unavailable, the same reason
`ticket_1787603669_760394` recorded.
R2. Publish no performance number, no local record, and no controlled record.
R3. Do not describe the missing record as an existing transport baseline.
R4. Do not claim a typing, attach, scrollback, or wall-clock improvement.
R5. Keep the deterministic wheel and render evidence separate from the
unavailable wall-clock observations.

### Evidence hygiene

E1. Record every gate against one stable commit with a clean tracked worktree.
E2. Renew review after any semantic rebase.

## 12. Risks

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | The chunk hash changes and a stale literal name breaks the harness. | S3 updates both known non-vendor references. G3 and G5 through G7 fail loudly if one is missed. |
| R2 | The WASM artifact differs unexpectedly. | P3 compares bytes and stops the ticket if they differ. |
| R3 | The deferred drain leaks past teardown. | W9 proves cancellation and stale rejection. |
| R4 | The mount-scoped handler weakens mode gating. | S5 refreshes mode bits before each send and keeps one mode-gated PTY path. W6 and W8 prove it. |
| R5 | A persistent accumulator leaks across sessions. | The re-encoder is mount-scoped and reset on replacement. W9 proves rejection. |
| R6 | The plan is read as a performance claim. | R2 through R4 forbid it. The format document keeps `product_baseline_only`. |
| R7 | The vendor copy merges over the old tree and keeps dead files. | P5 requires an exact tree match. |
| R8 | The reviewer reads `59c6404` in the historical baseline plan as current. | Section 9 states that document is historical and unedited. |
| R9 | A stale-mode reject double-counts one wheel event. | S5a moves the accumulator mutation out of `encode`. W11 forces the reject and proves one mutation. |
| R10 | The large-history gate drifts into a timing claim. | G8 asserts rendered rows and PTY bytes only. It records no wall-clock value. |

## 13. Vault gaps worth capturing

V1. A consumer that re-encodes an input event with a throwaway handler breaks
when the library makes that encoding stateful. Candidate note: a stateless
re-encode of a library input event cannot carry library input state.

V2. A vendored build with content-hashed chunk names needs discovery, not
literal file names, in harness file lists. Candidate note: vendored
content-hashed chunk names do not belong in harness constants.

V3. A frozen observation format that names a per-arm revision needs one update
point when a consumer ticket moves that revision. Candidate note: a frozen
baseline pin table is the single update point for a vendored revision change.

## 14. Plan Review response

Plan Review `review_1787762913_280106` returned `changes_required` with four
findings. This revision answers all four.

- `finding_1787762913_785846` (product, high). Section 6 item S5a defines the
  idempotent semantic event boundary and names the three `encode` call sites in
  `src/botster/hubTerminalDataPlane.ts`. Section 11 test W11 forces one stale
  `ModeGatedInput` reject, calls `encode` twice for one wheel event, and proves
  one accumulator mutation, correct fresh-mode retry bytes, and no duplicate
  immediate or deferred PTY bytes. Section 9 now lists
  `src/botster/botsterTerminalPtyTransport.ts` as a conditional file, and
  Implement must state whether it changed.
- `finding_1787762913_265075` (product, high). Section 11 adds gate G8, the
  focused large-history and wheel scrollback gate. It names the frozen 400-line,
  80-byte workload in `fixtures/terminal-baseline/history-seed.sh`, the
  production reader path, the rendered-row oracle, the exact assertions, and the
  failure condition. G8 records no wall-clock value and stays separate from both
  observation sets.
- `finding_1787762913_645421` (process, info). The first Plan visit did submit
  full gate evidence, and `gate_result_1787762292_620280` passed with
  `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, and
  `target_repository`. The step completion record did not carry those fields.
  This visit resubmits the complete set and keeps artifact identity
  `artifact_1787762199_877842`.
- `finding_1787762913_210296` (process, info). The first Plan visit did create
  `checklist_1787762152_320749`. This visit reuses that checklist rather than
  creating a second one, and it does not touch the Plan Review checklist
  `checklist_1787762539_902444`.
