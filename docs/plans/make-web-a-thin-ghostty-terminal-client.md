# Plan: Make Web a thin Ghostty terminal client

Ticket: `ticket_1786471490_562794`  
Run: `run_1786508114_691875`  
Plan step: `botster_stack_plan` / `run_step_1786509313_766377`  
Plan **revision 4** after Plan Review `review_1786514229_999258` (`changes_required`)

Rev history:
- rev1: initial thin-client plan
- rev2: Plan Review fixture blocker + mandatory Restty + base refresh
- rev3: Hub fixture dep closed; pin `hub-test-support@0.1.30` conf **35** / Hub `de6b099…`
- rev4: request-race isolation after detach/session-switch; ModeGatedInput **re-encode** on stale retry; completion evidence artifact id fix

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` (path resolves to `botster-web`) |
| **Run base (refreshed)** | `origin/main` at `6048e0bede71c0f90899aac7e61cdf55575f4119` |
| Prior stale base | `6efb3b676b4fd0949618dcd41549213b30ca5b75` (two commits behind) |

Resolved via `list_spawn_targets` + ticket `target_id`. Worktree fast-forwarded to current `origin/main` this Plan visit (entity-options commits only; unrelated to terminal scope).

### Plan Review base re-verification (preserve)

Plan Review verified a clean current-main clone passed:

- `npm test`, `typecheck`, `lint`, `build`
- `smoke:browser-runtime`, `smoke:mounted-terminal-keyboard`
- live packaged WebRTC harness against rebuilt Hub revision 34

Implement must re-verify on this refreshed base after product changes.

## Plan Review corrections (rev 1 → rev 2)

| Finding | Severity | Decision |
| --- | --- | --- |
| `finding_1786509301_255127` Published rev-34 fixture contradicts GHOSTSNP state machine | product high | **Register blocking Hub dependency** `ticket_1786509361_611999`. Do **not** treat `@trybotster/hub-test-support@0.1.29` / conf **34** as the consumable Snapshot-only GHOSTSNP fixture source. Pin only the package published by that Hub ticket (conf **>34**, version **>0.1.29**). Add Web consumer checks for GHOSTSNP magic, ordering, no-history. |
| `finding_1786509301_466800` Restty revendor mandatory | product high | **Unconditional** revendor from Restty `448497041a4d0e8617662c568ae73f246b3a805f` (or newer main that retains GHOSTSNP import, `readOnly`, mouse/Kitty rehydrate). Copied-build + mounted consumer proofs required. |
| `finding_1786509301_154409` Run base behind origin/main | process medium | Fast-forwarded worktree to `6048e0be…`; record baseline evidence above. |
| `finding_1786509301_705124` Three vault checklists | process info | Reuse **only** `checklist_1786508294_948720`. No new checklist this visit. |

## Plan Review corrections (rev 3 → rev 4)

| Finding | Severity | Decision |
| --- | --- | --- |
| `finding_1786514229_874928` Acceptance misses request isolation after detach/session switch | product high | **Mandatory deterministic isolation tests** at every ownership-creating async boundary (attach/subscribe, snapshot install, mode read, resize, listener callbacks). On destroy or session switch mid-flight: zero old-session subscription recreation, listener wiring, resize/snapshot/mode requests, renderer install, or output flush into the new renderer. Keep production-path reconnect for current session separately. |
| `finding_1786514229_332822` Stale ModeGatedInput retry may resend wrong-mode bytes | product high | Retain **semantic** key/mouse event until admitted. On stale reject: refresh modes, **discard prior encoded bytes**, **re-encode from fresh modes**, retry **once** with matching freshness. Never pair stale bytes with a fresh token. Tests must prove mode-change alters expected sequence and Hub receives only new bytes. |
| `finding_1786514229_798428` Completion text still said rev2 artifact | process info | Completion evidence names `artifact_1786513873_631944` (rev3) and subsequent rev4 artifact from this visit. |

## Hub dependency closed (rev 3 pins)

| Field | Locked value |
| --- | --- |
| Hub dependency ticket | `ticket_1786509361_611999` **closed** |
| Hub merge | `de6b09982e72fd5efd04a5258f5fc645f611adbc` on `origin/main` |
| npm package | **`@trybotster/hub-test-support@0.1.30`** (public `latest`) |
| Conformance fixture revision | **35** |
| Protocol | `botster-hub-daemon-v1` / version **6** |
| Feature | `mode_gated_input` in required + supported matrix |
| UI contract named by support metadata | `@trybotster/ui-contract@0.3.2` (web main already on 0.3.2) |

### Published package proof (this Plan visit)

Installed tarball `@trybotster/hub-test-support@0.1.30`:

- `metadata.json`: `package_version=0.1.30`, `conformance_fixture_revision=35`
- `late-attach-history-conformance-fixture.json` conf **35**
- `history_then_live`: order `attach_state → snapshot → attach_state → terminal_output → process_exit`; Snapshot payload starts with **`GHOSTSNP`** (1176 bytes); `read_screen_text = "history-before-live\r\n"`
- `no_history_then_live`: same event types including Snapshot; Snapshot starts with **`GHOSTSNP`** (1157 bytes); `no_history_read_screen_text = ""` (empty visible text; snapshot still present)
- Rejected prior bad content: `AP9HVFkB` / `00ff47545901` is **not** in this package

**Consumer semantics for Web:**

1. Always import Snapshot only when magic is GHOSTSNP; fail closed otherwise.
2. History vs no-history is distinguished by **payload content / ReadScreen text**, not by Snapshot event absence (both cases emit Snapshot with GHOSTSNP).
3. Buffer live until install; flush after install (H0–H5).

### No longer blocking

Previously open `dependency_1786509368_408571` is **closed**. Web Plan may advance to Plan Review. Implement pins **exactly** 0.1.30 / conf **35** (or a later published package only if conf revision and GHOSTSNP fixture proofs remain true and are re-recorded).

## Repository playbook loaded

- [[botster-web-playbook]]

## Other role/surface playbooks and atomic notes loaded

### Role / stack

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-architecture]]
- [[spa-patterns]]
- [[cli-patterns]]
- [[botster runtime teardown lenses]] — class **does not apply** (see below)

Not loaded: [[project-pipelines-playbook]] (web terminal product code, not PP package paths).

### Charter-required web notes

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[hub qualifies effective session type ids as source name slash id]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]

### Terminal / Restty / Ghostty surface notes

- [[restty is a client renderer not authoritative terminal infrastructure]]
- [[restty is vendored into botster by manual build-and-copy workflow not a submodule]]
- [[vendored restty uses relative chunk imports so no Vite alias is needed]]
- [[empty font source lists are fatal in vendored restty]]
- [[session-process-owns-vt-parser-hub-rpc-snapshots]]
- [[initial terminal snapshots must precede live output activation]]
- [[botster clients restore visible terminal state from readscreen before buffered live output]] — **superseded for production attach by GHOSTSNP install**
- [[browser-buffers-live-output-during-snapshot-assembly-prevents-duplicate-scrollback]] — older discard pattern; Hub contract is buffer-then-flush after GHOSTSNP
- [[browser-terminal-initial-snapshot-can-arrive-before-transport-listeners]]
- [[browser terminal forwards restty size changes after connect starts]]
- [[reused browser terminal connections must resize before reconnect snapshots]]
- [[terminal session switches must cancel in-flight webrtc pty connects]]
- [[opaque terminal snapshot bytes do not prove renderable history]]
- [[binary-page-snapshots-replace-vt-in-protocol]]
- [[tui and browser are equal clients]]
- [[kitty keyboard protocol treats enter and backspace asymmetrically with disambiguate escape codes]]
- [[pinned libghostty exposes synchronous exact mouse mode state]]
- [[hub test support npm releases need external consumer smoke]]
- [[conformance fixture revisions must be unique per published content]]
- [[vault example paths are not repository placement conventions]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan review must verify a plan artifact exists before trusting gate summaries]]

### Dependency contracts

- Hub product plan (closed ticket `ticket_1786471489_718500`): Snapshot-only GHOSTSNP, ModeGatedInput, conf identity, H0–H5 hydration
- Restty closed ticket `ticket_1786471489_344578`: GHOSTSNP renderer + `readOnly` query mute + mode rehydrate
- **Hub fixture ticket closed:** `ticket_1786509361_611999` → `@trybotster/hub-test-support@0.1.30` conf **35** / Hub `de6b099…` (verified public tarball GHOSTSNP)

## Context loaded

### Ticket intent

Remove terminal-engine choices and client-owned terminal state synthesis from `botster-web`. Consume Hub Ghostty contract; render **GHOSTSNP** through Restty; encode Kitty/mouse from authoritative modes; do not answer OSC color queries in the browser; preserve full scrollback on attach/reconnect; production-path browser tests for Kitty, mouse, palette, scrollback, resize, reconnect, attach ordering.

### Historical Plan Review product blocker (rev2) — now fixed

Published `0.1.29` / conf **34** late-attach fixture used non-GHOSTSNP bytes (`AP9HVFkB` → `00ffGTY`) and ambiguous no-history. **Fixed** by closed ticket `ticket_1786509361_611999`:

- Public **`@trybotster/hub-test-support@0.1.30`** conf **35**
- Both history and no-history cases emit GHOSTSNP Snapshot payloads
- No-history uses empty ReadScreen text rather than Snapshot omission


### Current botster-web baseline (on refreshed main `6048e0be`)

| Surface | Current behavior | Gap |
| --- | --- | --- |
| `hubTerminalDataPlane.ts` | ReadScreen-primary hydrate; logs snapshot/scrollback without import | GHOSTSNP H0–H5 |
| `resttyRenderer.ts` | String PtyTransport; no snapshot load; no query mute | Mandatory Restty revendor APIs |
| `src/vendor/restty` | Commit `e974225…`; has `loadBinarySnapshot` only | **Missing** `readOnly`, mouse rehydrate (`getMouseTrackingBits` / rehydrate), full GHOSTSNP cutover from Restty main |
| `generated/daemon-protocol.ts` | Older pin | ModeGatedInput + full ModeFlags + freshness from **0.1.30** |
| `connectionDiagnostics.ts` | conf floor **14**; no `mode_gated_input` | conf **35** + `mode_gated_input` |
| `package.json` | hub-test-support **0.1.27** | Pin **0.1.30** (conf 35); ui-contract already **0.3.2** |
| Live harness | read_screen + capture_snapshot metadata path | GHOSTSNP install ordering oracles |

### Hub product contract to consume (once package fixed)

**Data plane:**

| Carrier | Client action |
| --- | --- |
| `DaemonEvent::Snapshot` | Import **only** verified GHOSTSNP bytes via Restty `loadBinarySnapshot` |
| `DaemonEvent::Scrollback` | Never import as GHOSTSNP |
| `DaemonEvent::TerminalOutput` | Buffer until install; then flush |

**Control plane:**

| Operation | Client action |
| --- | --- |
| `ReadModeFlags` | Freshness token after install; not a color source |
| `ModeGatedInput` | Kitty/mouse mode-dependent input |
| `send_input` | Non-mode-dependent only |
| `ReadScreen` | Optional supplement only |
| `CaptureSnapshot` | Metadata only |

**Hydration H0–H5:** attach → buffer live → import GHOSTSNP Snapshot → status → Restty install → ReadModeFlags → optional ReadScreen → flush live. Reconnect = new subscription full cycle.

**Compatibility identity (consumer pins — locked rev3):**

| Item | Locked for this Web plan |
| --- | --- |
| Protocol | **6** (additive; unchanged) |
| Conformance | **35** (from `@trybotster/hub-test-support@0.1.30`) |
| Feature | `mode_gated_input` required |
| npm package | **`@trybotster/hub-test-support@0.1.30`** |
| Hub binary floor | ≥ merge `de6b09982e72fd5efd04a5258f5fc645f611adbc` |
| **Do not pin** | `0.1.29` / conf **34** (known non-GHOSTSNP late-attach fixture) |

### Runtime-teardown class

| Field | Answer |
| --- | --- |
| `teardown_class_applies` | **no** |
| Why | Thin-client render/input + product attach/reconnect hydration; not WebRTC peer ownership teardown, SessionIo/ClientWorker forget, multi-peer sweeps, or FD/CPU spin |
| Product still required | Reconnect + attach ordering + Snapshot-before-live flush; **request-race / SPA request-state isolation** after detach or session switch (not the multi-peer teardown matrix) |

## Scope

### Closed prerequisite (satisfied)

1. **Hub** `ticket_1786509361_611999` **closed**; merge `de6b099…`; npm `@trybotster/hub-test-support@0.1.30` conf **35** verified with GHOSTSNP late-attach fixtures (see rev 3 pins).

### In scope (botster-web) — ready for Implement after Plan Review

1. **Unconditional Restty revendor**
   - Source: Restty commit **`448497041a4d0e8617662c568ae73f246b3a805f`** (origin/main at this Plan visit) or newer that retains:
     - GHOSTSNP-only `loadBinarySnapshot` fail-closed
     - `readOnly` query mute (DA/DSR/kitty + no OSC color reply path for pure renderer)
     - post-import mouse rehydrate + Kitty flag reads
   - Workflow: build Restty → delete stale `chunk-*.js` → copy dist into `src/vendor/restty` → update vendor README SHA
   - **Copied-build content proof:** search vendored tree for `readOnly`, GHOSTSNP/magic fail-closed path, mouse rehydrate symbols
   - Preserve non-empty `fontSources` ([[empty font source lists are fatal in vendored restty]])

2. **Protocol pin (exact)**
   - Install **`@trybotster/hub-test-support@0.1.30`**
   - Copy `daemon-protocol.ts` from that package (byte-identical drift check; sha256 in package metadata)
   - `minimumConformanceFixtureRevision` = **35**
   - `requiredDaemonFeatures` includes `mode_gated_input` (align with first-party matrix as applicable)
   - Keep `@trybotster/ui-contract@0.3.2` (already on main; matches support metadata)
   - Sync README / architecture pin claims to 0.1.30 / conf 35 / Hub ≥ `de6b099…`

3. **Thin data plane (`hubTerminalDataPlane.ts`)**
   - Implement H0–H5
   - Decode Snapshot `payload_base64`; verify GHOSTSNP; call Restty install
   - Never import Scrollback
   - Buffer live across install; flush after
   - Fail closed on missing/invalid GHOSTSNP under required conf (no silent ReadScreen-primary synthesis)
   - ModeGatedInput for mode-dependent input with **semantic-event retention** until admission:
     1. Encode Kitty key / mouse event from current authoritative modes + freshness token
     2. On stale rejection: `ReadModeFlags` (or gated result fields) for fresh modes/token
     3. **Discard** the previously encoded byte string
     4. **Re-encode** the same semantic event from the **fresh** modes
     5. Retry **once** with matching `mode_generation`/`mode_revision`
     6. Never send old bytes with a new token; never batch unlimited retries
   - Generation/subscription isolation with **hard cancel** on detach or session switch:
     - Bump attachment generation / clear subscriptions before teardown
     - In-flight attach, Snapshot decode/install, ReadModeFlags, resize, ModeGatedInput, and buffered flush must observe generation and become no-ops when stale
     - Stale work must not recreate the old subscription, re-wire listeners, issue old resize/snapshot/mode requests, install into a new Restty instance, or flush old output into the new renderer

4. **Thin renderer (`resttyRenderer.ts` + bridge)**
   - Production Restty: `readOnly: true` (or equivalent) so browser does not answer terminal queries including OSC colors
   - Do not provide OSC 10/11/12 default-color reply sources
   - `loadBinarySnapshot` on attach path
   - Kitty/mouse: encode from post-import WASM + authoritative mode flags; ModeGatedInput admission uses freshness; on stale, re-encode from fresh modes (not byte reuse)

5. **Consumer checks against authoritative fixtures (`0.1.30` conf 35)**
   - Decode late-attach `history_then_live` Snapshot payload; assert GHOSTSNP magic (reject `AP9HVFkB` / `00ffGTY`)
   - Assert event ordering: Snapshot before terminal_output in fixture + buffer-then-flush client behavior
   - Assert `no_history_then_live` still carries GHOSTSNP Snapshot with empty ReadScreen text (`""`) — do **not** assume Snapshot absence
   - Never soft-pass on 0.1.29 content

6. **Tests / harness**
   - Unit: H0–H5, Scrollback non-import, ModeGatedInput **re-encode** on stale, no OSC replies, no engine choice
   - **Request-race / SPA request-state isolation** (required; not optional):
     - Pause each ownership-creating async boundary (attach/stream acquire, Snapshot install, ReadModeFlags, resize, ModeGatedInput, listener delivery)
     - Destroy the data plane or switch `sessionId` before the paused work completes
     - Resume the old work; assert **zero** old-session side effects (no subscription recreate, no listener wiring, no resize/snapshot/mode/gated-input requests, no Restty install, no output flush into the new renderer)
     - Separate production reconnect path still proves full H0–H5 for the **current** session only
   - Flip ReadScreen-primary assertions
   - Mounted consumer proofs after revendor: snapshot import, query mute, Kitty, mouse
   - Live packaged WebRTC harness: attach order, scrollback, reconnect, Kitty, mouse, palette, resize, no browser OSC color replies
   - Keep non-terminal lanes green

7. **Docs**
   - GHOSTSNP-first attach; Restty pure renderer; pins for **0.1.30**/conf **35**/Hub `de6b099…`; Restty vendor SHA

### Non-scope

- Implementing Hub fixture/package fix inside this web run (owned by `ticket_1786509361_611999`)
- Restty **source** changes beyond revendor of built output
- Core/TUI product code
- Dual engines / dual decoders
- Control-path GHOSTSNP on responses
- Project Pipelines package work
- Runtime-teardown peer ownership rewrites
- Entity-options UI (already on main; do not regress)

## Repository ownership boundaries and cross-repo dependencies

| Layer | Owns | This ticket |
| --- | --- | --- |
| `botster-web` | Restty mount, WebRTC client, DTO consumption, browser harnesses | Implement thin client after pins available |
| `botster-hub` | Contract, fixtures, hub-test-support npm | Closed blocker `ticket_1786509361_611999` → pin **0.1.30**/conf **35**/Hub `de6b099…` |
| Core / Ghostty | Terminal truth + PTY queries | Consume via Hub events |
| Restty | Snapshot import + query mute | **Mandatory revendor** of closed renderer work |

### Dependencies

| Ticket | Target | Status | Role |
| --- | --- | --- | --- |
| `ticket_1786471489_344578` Restty GHOSTSNP renderer | Restty | closed | Consumable renderer at Restty `448497041…` |
| `ticket_1786471489_718500` Hub Ghostty contract | Hub | closed | Protocol/API; fixtures completed by `ticket_1786509361_611999` |
| **`ticket_1786509361_611999`** Publish GHOSTSNP late-attach fixtures | Hub `tgt_7e208a0c76a44980a83b63af976b1f22` | **closed** | Package **0.1.30** / conf **35** / Hub `de6b099…` |

Registered: `dependency_1786509368_408571` (closed).

## Assumptions and unknowns

### Assumptions

1. Public `@trybotster/hub-test-support@0.1.30` is the consumable pin (verified this visit).
2. Restty `448497041…` (or newer) is sufficient for import + `readOnly` + mouse/Kitty rehydrate.
3. No-history attach still delivers a GHOSTSNP Snapshot with empty ReadScreen text (fixture contract).
4. Cold turkey: Web requires conf **35** + `mode_gated_input`.
5. Plan path remains `docs/plans/` (repo prior art).
6. Live Hub bins for acceptance must be ≥ merge `de6b099…`.

### Unknowns

1. Whether production live attach always emits Snapshot before live on every Hub build after `de6b099…` — live harness must prove, not assume from fixtures alone.
2. Exact Restty commit if main moves past `448497041…` before Implement (floor remains that SHA).

### Human questions

None. Findings are product-actionable without product ambiguity.

## Affected surfaces / files

- `src/vendor/restty/**` + `src/vendor/restty/README.md` — **mandatory** revendor
- `package.json` / lockfile — hub-test-support **0.1.30**
- `src/botster/generated/daemon-protocol.ts`
- `src/botster/connectionDiagnostics.ts`
- `src/botster/hubTerminalDataPlane.ts`
- `src/botster/resttyRenderer.ts`
- `src/botster/terminal.ts` (interfaces if needed)
- `src/botster/TerminalViewHost.tsx` (harness controls if needed)
- `src/App.test.mjs` + fixtures under `src/botster/__fixtures__/`
- `scripts/live-packaged-protocol-harness.mjs` (+ helpers)
- `scripts/mounted-terminal-keyboard-smoke.mjs` and/or new mounted GHOSTSNP consumer smoke
- `scripts/check-daemon-protocol-drift.mjs` (mechanism unchanged)
- `README.md`, `docs/architecture.md`

## Risks

| Risk | Mitigation |
| --- | --- |
| Implement pins 0.1.29 despite known bad fixture | Plan locks **0.1.30**/conf **35**; consumer magic check fails on `AP9HVFkB` |
| Conditional Restty revendor leaves no-OSC broken | Revendor unconditional; content proof + mounted smokes |
| Double scrollback | Buffer-then-flush only after GHOSTSNP; never paint Scrollback as text |
| Mode race / wrong-mode bytes on retry | Semantic-event retention; discard+re-encode on stale; unit with mode-change altering byte sequence |
| Stale attach after session switch | Generation gates + isolation tests that complete in-flight work after destroy/switch |
| OSC color replies from browser | `readOnly` + no defaultColors; live oracle |
| Silent ReadScreen-primary fallback | Fail closed under required conf |
| Soft-skipped live | Fail closed when bins missing |
| Base drift again | Started from `6048e0be`; re-merge main if needed before Implement |

## Acceptance checks / tests

### Local (always)

```bash
# hygiene: tracked .gitignore non-empty
npm install   # hub-test-support@0.1.30
npm test
npm run typecheck
npm run lint
npm run build
npm run smoke:browser-runtime
npm run smoke:mounted-terminal-keyboard
# plus mounted GHOSTSNP consumer smoke if added
```

### Restty revendor proofs (mandatory)

1. Vendor README records Restty SHA ≥ `448497041a4d0e8617662c568ae73f246b3a805f`
2. Vendored sources/strings prove `readOnly` (or equivalent query mute) present
3. `loadBinarySnapshot` fail-closed for non-GHOSTSNP (e.g. `00ffGTY` / `AP9HVFkB` decoded bytes must not import as success)
4. Mounted browser proof: import valid GHOSTSNP; mute query replies; Kitty + mouse paths exercise post-import modes

### Protocol pin proofs

- Drift check against installed **`@trybotster/hub-test-support@0.1.30`**
- Metadata conf **35**; package_version **0.1.30**
- Consumer test: late-attach history payload **starts with GHOSTSNP magic** (not `00ff47545901`)
- Consumer test: no-history fixture includes GHOSTSNP Snapshot + empty ReadScreen text
- `mode_gated_input` required feature + ModeGatedInput DTO surface

### Unit / component (red if GHOSTSNP path removed)

1. Buffer live until Snapshot install; ordered flush
2. Scrollback never loads into Restty
3. Invalid Snapshot fail closed
4. **ModeGatedInput stale path re-encodes:** given semantic key/mouse event E, encode under mode A → bytes BA; force stale reject with mode B where encode(E,B)=BB and BB≠BA; assert Hub receives only a single ModeGatedInput with BB + fresh token, never BA paired with the fresh token
5. No OSC color reply path
6. No alternate engine selection
7. **Detach/session-switch isolation matrix** (deterministic paused async boundaries):

| Boundary paused mid-flight | After destroy / session switch + resume | Assert |
| --- | --- | --- |
| Attach / stream acquire | complete old attach | no old subscription recreate; no listener wiring for old sub |
| Snapshot decode/install | complete old install | no Restty `loadBinarySnapshot` on new renderer; no old buffer flush |
| ReadModeFlags | complete old response | no mode state applied to new session; no gated input using old token |
| Resize | complete old resize | no resize RPC for old session id |
| ModeGatedInput | complete old admit/reject | no input RPC for old session; no flush into new renderer |
| Live output listener | deliver old chunk | no write into new Restty / no dataset write for new mount |

Keep a **current-session** reconnect/H0–H5 test separate from this isolation matrix.

### Live packaged production path

```bash
BOTSTER_HUB_BIN=... BOTSTER_SESSION_WORKER_BIN=... \
  npm run smoke:live-packaged-protocol
```

| Behavior | Oracle |
| --- | --- |
| Attach ordering | GHOSTSNP install before flushed live writes |
| Scrollback | Renderable history retained after attach/reconnect |
| Reconnect | New subscription full H0–H5 for **current** session (does not replace isolation matrix) |
| Kitty | Mode-gated admission under kitty flags |
| Mouse | Authoritative mode; mode-gated when required |
| Palette | Post-OSC GHOSTSNP colors, not Hub startup RGB |
| Resize | Works after install |
| No OSC color reply | Browser emits none |

Record Hub SHA, hub-test-support version, conf rev, Restty vendor SHA.

### Downstream charter proof

Real routes/components + structured protocol evidence per [[botster-web-playbook]]. Fixture-only insufficient for live claims.

## Implementation sequence

1. Hygiene `.gitignore`; base = current main (`6048e0be…` or newer).
2. **Unconditional Restty revendor** ≥ `448497041…` + content proofs.
3. Pin hub-test-support **0.1.30**; copy protocol; conf **35** / `mode_gated_input` / docs; Hub live bins ≥ `de6b099…`.
4. Data plane H0–H5 + ModeGatedInput with semantic-event re-encode on stale + generation isolation.
5. Renderer install + query mute.
6. Isolation matrix unit tests + ModeGatedInput re-encode unit tests; fixture consumer magic/order; flip ReadScreen-primary assertions; live harness oracles.
7. Full acceptance suite + provenance (record Hub SHA, package 0.1.30, conf 35, Restty vendor SHA).

## Vault gaps worth capturing

1. GHOSTSNP-first client hydrate supersedes rev-14 ReadScreen-primary.
2. Published conf revision must not reuse numbers when fixture magic/content changes ([[conformance fixture revisions must be unique per published content]] — this incident is proof).
3. Browser pure-renderer: no OSC color query replies.
4. ModeGatedInput stale path must **re-encode** semantic input (not retry old bytes).
5. Browser terminal generation isolation after detach/session switch (request-race proofs).

## Product decision ledger

| Decision | Choice |
| --- | --- |
| Primary attach restore | GHOSTSNP Snapshot only |
| Scrollback events | Non-import |
| ReadScreen | Optional supplement |
| Mode-dependent input | ModeGatedInput; stale → re-encode semantic event once |
| Stale async after switch | Generation-gated no-ops; isolation matrix tests required |
| OSC color queries | Session only |
| Package pin | **`@trybotster/hub-test-support@0.1.30` / conf 35**; Hub ≥ `de6b099…`; **not** 0.1.29/34 |
| Restty | Mandatory revendor ≥ `448497041…` |
| Engine | Restty only |

## Worktree hygiene (this Plan visit)

1. Confirmed tracked `.gitignore` non-empty (160 bytes).
2. Base remains `origin/main` `6048e0be…` (unchanged this rev).
3. No colon in path; no `CARGO_TARGET_DIR` needed.
4. Vault checklist: **reuse** `checklist_1786508294_948720` only (no new create).

## Completion evidence (Plan gate)

- `target_repository`: `botster-web`
- `target_id`: `tgt_40abcf71ccf049f4ac0c99953a799869`
- `repository_playbook`: [[botster-web-playbook]]
- `plan_uri`: `docs/plans/make-web-a-thin-ghostty-terminal-client.md`
- `artifact_id`: rev3 `artifact_1786513873_631944`; this visit also registers a new rev4 plan artifact via `project_pipelines_add_artifact` (use the latest in gate evidence)
- `checklist_id`: `checklist_1786508294_948720`
- `teardown_class_applies`: no
- `hub_dependency_ticket`: `ticket_1786509361_611999` (**closed**)
- `hub_merge_sha`: `de6b09982e72fd5efd04a5258f5fc645f611adbc`
- `hub_test_support_pin`: `0.1.30`
- `conformance_fixture_revision`: `35`
- `restty_vendor_pin_min`: `448497041a4d0e8617662c568ae73f246b3a805f`
- `base_sha`: `6048e0bede71c0f90899aac7e61cdf55575f4119`
