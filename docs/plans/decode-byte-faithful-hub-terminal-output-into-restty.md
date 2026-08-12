# Plan: Decode byte-faithful Hub terminal output into Restty

Ticket: `ticket_1786562565_267926`
Run: `run_1786568427_879557`
Plan step: `botster_stack_plan` / `run_step_1786569678_789301`

Plan **revision 2** after Plan Review `review_1786569660_694340` (`changes_required`).

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` (path resolves to `botster-web`) |
| **Implement base** | `origin/main` at `4292d30a9e7a0671e8594db87df797b543eeb661` |
| This worktree HEAD (do not ship) | `d5799db04a486c8eae04c2db8973d43aa6fb4204` (`Fix terminal resize replay races`) |
| `teardown_class_applies` | **false** |
| Session-type eligibility consumer | **false** |

Resolved via `list_spawn_targets` + ticket `target_id`. Do not infer the repository from the pipeline working directory.

### Plan Review corrections (rev 1 → rev 2)

| Finding | Severity | Decision |
| --- | --- | --- |
| `finding_1786569661_869919` Rebase and file scope depend on unrelated `d5799db` | product high | **Implement starts from a clean `origin/main` at `4292d30…`.** Do not cherry-pick, rebase onto, or extract `d5799db`. On that base, `BotsterTerminalPtyTransport` is an **internal class in `src/botster/resttyRenderer.ts`**. `src/botster/botsterTerminalPtyTransport.ts` does not exist. Pass `Uint8Array` through that existing `subscribeOutput` → `onData` call. |
| `finding_1786569661_649067` Required lint gate already fails in affected files | product high | Record the exact clean-base lint result below. Implement includes **only** the three error-site cleanups in files this ticket already edits. After those plus product edits, `npm run lint` must exit 0. Prove with branch-versus-`4292d30` diff that the lint sites are in this ticket's diff. |
| `finding_1786569661_461910` GHOSTSNP and ReadScreen authority conflict | product medium | **Convention conflict, not “none”.** Production attach stays **GHOSTSNP-primary** (closed Web ticket `ticket_1786471490_562794`, shipped `origin/main` `hubTerminalDataPlane.ts`). [[botster clients restore visible terminal state from readscreen before buffered live output]] is **stale for first-party Web attach**: it still names ReadScreen as visible restoration. This ticket does not restore ReadScreen-primary paint. Vault capture: update that note so Web attach is GHOSTSNP install, then flush buffered live bytes; ReadScreen is optional supplement only. |

### Plan Review base re-verification (preserve)

Plan Review must independently verify a **clean `origin/main` clone at `4292d30…`**, not this worktree. Implement must create/reset the product branch from that SHA. Do not fold `d5799db` into this ticket. There is no provider PR for the resize extraction.

### Clean-base lint (this Plan visit)

Detached worktree at `origin/main` `4292d30…`, `npm run lint`, exit **1**:

```
scripts/live-packaged-protocol-harness.mjs:3226  no-useless-assignment  renderBaseline
scripts/live-packaged-protocol-harness.mjs:3227  no-useless-assignment  orderedGapEvidence
src/App.test.mjs:1952                           no-regex-spaces
src/botster/IonicUiNodeRenderer.tsx:1119         react-refresh/only-export-components  (warning)
```

`IonicUiNodeRenderer.tsx` is **not** in this ticket’s product scope. After the three errors in the already-touched harness and `App.test.mjs` are fixed, `npm run lint` is expected to exit 0 with that warning remaining. Do not drive a renderer-file refactor to silence the warning.

## Repository playbook loaded

- [[botster-web-playbook]]

## Other role/surface playbooks and atomic notes loaded

### Role / stack

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-architecture]]
- [[spa-patterns]]
- [[cli-patterns]] — mixed-generation index only; ownership from the web charter
- [[prefer framework and library components over custom solutions]]
- [[identity]]
- [[goals]]

Not loaded:

- [[project-pipelines-playbook]] — this ticket is web terminal protocol consumption, not Project Pipelines package/plugin paths
- [[botster runtime teardown lenses]] — class does not apply (see below)

Planner overlay notes loaded (required by [[botster-planner-playbook]], not product scope here):

- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]
- [[colon worktree paths break cargo dyld library paths]]

### Charter-required web notes

- [[botster web uses vanilla ionic primitives by default]]
- [[botster-web ionic supersedes catalyst for client shell]]
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
- [[offline peer claims require the data channel to stay closed]]
- [[botster web hub frame entity snapshots omit subscription identity]]

### Terminal / Restty / protocol notes

- [[live terminal output base64 envelopes carry renderable bytes]]
- [[botster clients restore visible terminal state from readscreen before buffered live output]]
- [[coredaemon attached follows initial snapshots before live terminal output]]
- [[opaque terminal snapshot bytes do not prove renderable history]]
- [[restty is a client renderer not authoritative terminal infrastructure]]
- [[restty is vendored into botster by manual build-and-copy workflow not a submodule]]
- [[tui and browser are equal clients]]
- [[botster terminal clients share one sessionio data plane subscription path]]
- [[webrtc peer registry owns production data plane receivers]]
- [[snapshots-delivered-as-atomic-webrtc-messages]]
- [[a page reload is not a reconnect]]
- [[botster browser pull requests must retry after webrtc reconnect]]
- [[mounted browser terminal attach is idempotent by attachment identity]]
- [[cold turkey migrations eliminate dual code paths and version suffixes]]
- [[a removed field rejection test must hold every other field valid]]
- [[daemon event shape changes bump conformance fixture revision not protocol version]]
- [[conformance fixture revisions must be unique per published content]]
- [[hub generated protocol changes are a four site release chain]]
- [[hub test support npm releases need external consumer smoke]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[cross repo dependency registration must use dependency repo target]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[generated typescript dtos must encode serde field optionality]]
- [[generated dto drift tests need symmetric field and type checks]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[hub support metadata can force a web ui contract cold update]]
- [[live hub proof records distinct hub and locked core binary provenance]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[an ablation that reddens at the first assertion does not vouch for later ones]]
- [[hub replays full history on every attach so clients must clear per cycle]] — superseded by the ReadScreen/GHOSTSNP hydration note; cited only as history

## Context loaded

Project: `project_1786468118_227513` — Botster Ghostty-only terminal cutover.

This ticket consumes the closed Hub parent:

| Field | Value |
| --- | --- |
| Parent ticket | `ticket_1786562565_286591` **closed** |
| Hub target | `tgt_7e208a0c76a44980a83b63af976b1f22` |
| Merge | `7499c1615078069ba391489b20c6f39c55c2d4c6` (`trybotster/botster-hub#209`) |
| Protocol | **7** |
| Conformance | **36** |
| Prepared package | `@trybotster/hub-test-support@0.1.31` |
| UI contract named by that metadata | `@trybotster/ui-contract@0.3.2` (already Web's pin) |

Parent residual, independently rechecked this Plan visit: **0.1.31 is unpublished**. `npm view` latest is still `0.1.30`. Installed 0.1.30 tarball still types `terminal_output.data: string` and reports protocol 6 / revision 35.

Human answer `question_1786569045_561395` (option B):

- Removed ticket-level dependency `dependency_1786568772_382847` so Plan Review can proceed.
- Hub publish ticket `ticket_1786568764_412473` stays **open** on Hub target `tgt_7e208a0c76a44980a83b63af976b1f22` for operator publish and external registry smoke.
- **Mandatory Implement gate:** the exact published registry coordinate `@trybotster/hub-test-support@0.1.31`.
- Do **not** implement against `0.1.30`, a local path, a packed tarball, or a compatibility shape.

Sibling TUI consumer `ticket_1786562566_712634` stays separately routed. Do not implement TUI here.

### Current Web production facts

1. Vendored `DaemonEvent` still types `{ type: "terminal_output"; …; data: string }`.
2. `HubTerminalDataPlane.emitTerminalEvent` reads `event.data`, buffers `string[]` during GHOSTSNP hydration, and `emitOutput`s strings.
3. `bufferHydratingOutput` sizes the buffer with `TextEncoder.encode(data)` — a UTF-8 recode of an already-lossy string.
4. `export type TerminalOutput = string`.
5. Production Restty path is `attachDataPlane` → `BotsterTerminalPtyTransport.subscribeOutput` → Restty `PtyCallbacks.onData`. Restty already accepts `string | Uint8Array` and routes `Uint8Array` through `queueBytes` → `sendInputBytes` with no per-frame `TextDecoder`.
6. The fallback `ResttyRenderer.write` calls `sendInput(data, "pty")` (string path). Production does not use it when `attachDataPlane` is bound.
7. Live events arrive on the production WebRTC path: `WebrtcDaemonClient.streamTerminal` → `Drain` → `onEvent`. No Web-specific terminal protocol exists; do not add one.
8. Web currently pins `@trybotster/hub-test-support@0.1.30` / revision 35 in `package.json`, `README.md`, and `docs/architecture.md`.
9. `minimumConformanceFixtureRevision = 35`. `minimumDaemonProtocolVersion = 1` is a diagnostic floor, not a Hello advertisement. The WebRTC client does not emit `DaemonHello`.
10. Existing in-page reconnect already closes the real `RTCDataChannel` and requires a fresh subscription + GHOSTSNP install. Keep that; do not treat page reload as reconnect.

### Runtime-teardown class

`teardown_class_applies`: **false**.

This ticket is a cold-turkey live-output decode/render change. Reconnect, hydration, and WebRTC Drain are proof surfaces for the new decoder, not peer teardown, SessionIo/ClientWorker teardown, multi-peer ownership, CPU/battery/FD spin, or terminal-state vs live-runtime divergence. [[botster runtime teardown lenses]] is not loaded. One Plan → Implement path.

## Scope

Consume Hub's published protocol-7 live envelope and give Restty the exact decoded bytes.

Locked product shape:

```text
Incoming DaemonEvent.terminal_output {
  session_id,
  subscription_id,
  payload_base64,              // standard padded base64
  payload_encoding: "base64",  // only accepted value
  bytes                        // exact decoded length
}
→ decode to Uint8Array without TextDecoder / String
→ hydrate-buffer as Uint8Array[]
→ Restty PtyCallbacks.onData(Uint8Array)
```

Required work in this repository:

1. Before any product edit, prove the **published registry** coordinate `@trybotster/hub-test-support@0.1.31` (clean `npm pack` / install, not Hub source, not a sibling path, not a local tarball, not `0.1.30`).
2. Pin **exactly** `@trybotster/hub-test-support@0.1.31`. Copy `daemon-protocol.ts` from that installed package. If 0.1.31 is still unpublished or its installed bytes lack protocol 7 / revision 36 / the live envelope, stop. Do not substitute another version or a compatibility decoder.
3. Copy `daemon-protocol.ts` from the installed package into `src/botster/generated/daemon-protocol.ts`. Do not hand-author the DTO.
4. Keep `@trybotster/ui-contract@0.3.2` unless the published support metadata names a different UI-contract version. Current 0.1.31 metadata still names 0.3.2, so no UI-contract cold update is expected.
5. Change `TerminalOutput` from `string` to `Uint8Array`. Remove the string-only contract. No union, no dual decoder, no `data` fallback.
6. Decode live output with the same envelope rules as Snapshot/Scrollback (encoding, base64, length) **without** treating the bytes as opaque engine state. Snapshot/Scrollback stay unrendered. Live bytes go to Restty.
7. Reject retired `data` on an otherwise valid envelope (`'data' in event`). Build that negative case from a valid current payload plus only the extra key ([[a removed field rejection test must hold every other field valid]]).
8. Buffer hydration as `Uint8Array[]` and count `byteLength`. Flush those exact chunks after GHOSTSNP install. Do not `TextDecoder.decode` / `TextEncoder.encode` the live path.
9. Feed Restty through the existing `onData(Uint8Array)` production path. Do not invent a Web terminal protocol or a second Restty write adapter.
10. Update README and architecture docs together when the pin/revision claims change.
11. Prove deterministic unit/component cases and live packaged WebRTC cases listed in Acceptance.

## Non-scope

- Hub producer, daemon projection, SessionIo, ClientWorker, or Core PTY ownership.
- Publishing `@trybotster/hub-test-support` (Hub ticket `ticket_1786568764_412473`).
- TUI consumption (`ticket_1786562566_712634`).
- Snapshot/Scrollback semantics, GHOSTSNP magic rules, or ReadScreen as the primary paint path. Those stay as the already-shipped thin Ghostty client.
- `SendInput` / `ModeGatedInput` string payloads.
- Restty revendor unless Implement proves the vendored `onData(Uint8Array)` → `queueBytes` → `sendInputBytes` path is missing or stringifies per frame. Current vendored types and Restty source already have the byte path.
- UI-contract renderer migration (not implicated while support metadata stays on 0.3.2).
- Session-type eligibility, spawn Option A, or hub-test-support 0.1.26 / conf 33 parent pins.
- WebRTC peer teardown, multi-peer ownership, or runtime-teardown lenses.
- The extra worktree commit `d5799db` (resize races).
- Optional configurability, dual-accept of `data`, or “decode as UTF-8 when valid.”

## Repository ownership boundaries and cross-repo dependencies

| Layer | Owner | This run |
| --- | --- | --- |
| Exact live PTY bytes | botster-core | Already true. No Core ticket. |
| Public daemon envelope, generated TS, fixtures, npm package | botster-hub / hub-client | Parent merged. **Publish still Hub-owned.** |
| Browser decode + Restty feed | botster-web | This ticket |
| Thin TUI Ghostty consume | botster-tui | Sibling ticket. Do not broaden. |
| Restty renderer internals | restty | Use existing `onData(Uint8Array)`. Revendor only if that path is absent. |

Dependencies:

| Ticket | Target | Status | Role |
| --- | --- | --- | --- |
| `ticket_1786562565_286591` | Hub `tgt_7e208a0c76a44980a83b63af976b1f22` | closed | Source merge (necessary, not sufficient) |
| `ticket_1786568764_412473` | Hub `tgt_7e208a0c76a44980a83b63af976b1f22` | open, **not** a ticket-level edge | Operator publish + external registry smoke. Implement waits on published `0.1.31`, not on this ticket closing. |

Do not point default tests at a sibling Hub checkout. `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` is an optional local override, not CI acceptance.

## Assumptions and unknowns

1. **Publish coordinate.** Human locked Implement to the exact published `@trybotster/hub-test-support@0.1.31`. Re-query npm and prove that installed tarball is protocol 7 / revision 36 / live envelope. If it is missing or wrong, stop. Do not pin `0.1.30`, a path dep, or a packed local tarball.
2. **Handshake.** WebRTC client does not emit `DaemonHello`. Assume Hub peer admission still accepts the packaged browser after protocol 7. Live smoke is the proof. If Hub now rejects the peer, find the existing handshake site and advertise protocol 7 / min conformance 36 there. Do not invent a second hello protocol.
3. **Restty byte path.** Vendored Restty already concatenates `Uint8Array` chunks and flushes via `sendInputBytes`. Implement must confirm the vendored JS still does this. If it stringifies per chunk, that is a Restty-repo follow-up, not a Web-only TextDecoder workaround.
4. **Worktree extra commit.** `d5799db` is unpublished resize work. Out of scope. Implement from `origin/main`.
5. **UI contract.** 0.1.31 metadata still names `ui-contract@0.3.2`. If publish changes that version, stop and treat it as a coupled cold update ([[hub support metadata can force a web ui contract cold update]]). Do not silently migrate renderer identity.
6. **Diagnostic floors.** Raise `minimumConformanceFixtureRevision` to the installed package revision (36). Keep `minimumDaemonProtocolVersion` as a floor unless live handshake evidence requires an exact protocol-7 advertisement.
7. **Hydration vs ReadScreen (convention conflict).** Shipped `origin/main` `completeGhostsnpHydration` comments and implements “Optional ReadScreen supplement only — never primary paint path.” Closed thin-client plan `docs/plans/make-web-a-thin-ghostty-terminal-client.md` already marked [[botster clients restore visible terminal state from readscreen before buffered live output]] as superseded for production attach. The vault note is still `status: current` and still says ReadScreen supplies visible restoration. **This ticket keeps GHOSTSNP-primary.** Buffer decoded live `Uint8Array`s until GHOSTSNP install, then flush. Do not install `ReadScreen.text` as the Restty paint path. Capture the vault update after Implement.

## Affected surfaces/files

| Path | Change |
| --- | --- |
| `package.json` / `package-lock.json` | Pin published hub-test-support |
| `src/botster/generated/daemon-protocol.ts` | Copy installed artifact |
| `README.md` and `docs/architecture.md` | Move 0.1.30 / revision-35 claims together |
| `src/botster/terminal.ts` | `TerminalOutput = Uint8Array` |
| `src/botster/hubTerminalDataPlane.ts` | Decode envelope; byte hydration; reject `data`; telemetry as bytes |
| `src/botster/resttyRenderer.ts` | Internal `BotsterTerminalPtyTransport.subscribeOutput` already forwards to Restty `onData`. Keep that path. Do not send live output through string `sendInput(..., "pty")`. Do **not** add `src/botster/botsterTerminalPtyTransport.ts` (that file exists only on `d5799db`). |
| `src/botster/terminal.ts` fallback `renderer.write` | Either unused in production (`attachDataPlane`) or accept `Uint8Array` without UTF-8 recode |
| `src/botster/connectionDiagnostics.ts` | Conformance floor 36; protocol floor only if handshake evidence requires it |
| `src/App.test.mjs` | Envelope fixtures; byte assertions; split UTF-8; retired-`data` rejection; **narrow `no-regex-spaces` fix at line 1952** |
| `scripts/live-packaged-protocol-harness.mjs` | Production Drain envelope + Restty-bound byte records; split-UTF-8 live probe; in-page DataChannel reconnect; **narrow `no-useless-assignment` fix at lines 3226–3227** |
| `scripts/check-daemon-protocol-drift.mjs` | Unchanged mechanism; must run against the installed package, not a skip |

Absent on Implement base: `src/botster/botsterTerminalPtyTransport.ts`. Do not create it.

Do not add a new protocol module or a Web-only live-output DTO.

## Risks

1. **Unpublished parent artifact.** Implementing against Hub source, a sibling checkout, `0.1.30`, or a local tarball would violate [[closed dependency tickets signal merged source not a consumable release]] and the human answer. Implement is gated on a clean registry install of `@trybotster/hub-test-support@0.1.31`, not on the open publish ticket closing.
2. **Per-frame UTF-8 repair.** Any `TextDecoder`, `new TextDecoder().decode`, template-string coercion, or `TextEncoder.encode` on live frames reintroduces U+FFFD on a split `€` (`[0xE2]` then `[0x82, 0xAC]`).
3. **String telemetry / dataset.** `dataset.terminalLastRenderedOutput = data` and harness `{ data }` will coerce `Uint8Array` incorrectly. Record `payload_bytes_base64` / `bytes` instead.
4. **Hydration byte budget.** Counting UTF-8 recoded strings under- or over-counts arbitrary bytes. Use `byteLength`.
5. **Dual `data` accept.** Typed DTOs omit `data`, but `JSON.parse` keeps extra keys. Must reject `'data' in event` on a valid envelope.
6. **Shared opaque type.** Reusing Snapshot/Scrollback “do not render” helpers for live output would drop live bytes. Share only the envelope validator.
7. **Live split-frame producer.** `echo €` can stay in one PTY write. Live proof needs a barrier producer (Hub used a file token). Visible `€` after the fact is not enough.
8. **Reload mistaken for reconnect.** Existing in-page `closeDataChannel` path is the reconnect proof. Reload cycles elsewhere do not satisfy this ticket.
9. **Protocol-7 live Hub.** Live smoke must use Hub ≥ `7499c16` plus a session-worker from that Hub lockfile ([[live hub proof records distinct hub and locked core binary provenance]]). A protocol-6 Hub will not emit the new envelope.
10. **Request-race isolation.** Keep the existing attach/snapshot/mode/resize/listener generation guards. Byte-type change must not flush stale hydration into a new session.

## Acceptance checks/tests

### Publish pin (before product edits)

From a clean temp dir:

```sh
npm pack @trybotster/hub-test-support@0.1.31
# assert metadata: package_version, protocol_version=7, conformance_fixture_revision=36
# assert daemon-protocol.ts terminal_output uses payload_base64/payload_encoding/bytes
# assert it does not type data: string
# assert late-attach live events use the envelope
# assert ui_contract.package_version matches Web's direct pin
```

Then pin that exact version, copy the protocol file, run:

```sh
npm test
# includes scripts/check-daemon-protocol-drift.mjs against the installed package
```

A skipped drift check is not evidence.

### Deterministic (must go red if the decoder is reverted)

1. Shared late-attach fixture order remains `attaching → snapshot → attached → terminal_output`. Snapshot stays GHOSTSNP and unrendered. Live event fields are the envelope, not `data`.
2. Decode `[0xE2]` then `[0x82, 0xAC]` as two `Uint8Array`s. Concatenation is the euro sign. Neither frame is U+FFFD. Ablate per-frame `TextDecoder` and require this test to be the first failure.
3. Arbitrary bytes, `NUL` (`0x00`), ESC (`0x1b[…`), and invalid UTF-8 (`0xff`) survive as the same bytes.
4. Valid envelope plus only retired `data` is rejected; nothing is emitted to Restty.
5. Invalid base64, unknown encoding, and length mismatch fail closed.
6. Hydration: live frames that arrive after Snapshot/Attached and before GHOSTSNP install stay buffered as bytes and flush in order after install. Status is not `live_only` when GHOSTSNP restored.
7. Isolation: destroy/switch mid-hydration does not flush old bytes into the new renderer (existing generation hooks).
8. Typecheck: `TerminalOutput` is `Uint8Array`. No remaining production `event.data` live-output reads.

### Live packaged WebRTC (production path)

Use `npm run smoke:live-packaged-protocol` against Hub ≥ `7499c16` and the locked Core worker from that Hub `Cargo.lock`. Record Hub SHA, Core SHA, and both binary realpaths.

Prove on the **production** chain: packaged UI → `TerminalViewHost` → `HubTerminalDataPlane` → `WebrtcDaemonClient.streamTerminal`/`Drain` → decode → Restty `onData(Uint8Array)`.

Required live evidence:

1. Recorded `daemon_event` `terminal_output` frames use `payload_base64` / `payload_encoding` / `bytes`, not `data`.
2. Restty-bound harness records (`recordLiveHarnessTerminal("output", …)`) carry the same decoded bytes (base64 of the `Uint8Array` given to `onData`).
3. Split multi-byte UTF-8 across Hub frames: producer barrier writes `[0xE2]`, wait until that exact Drain payload is recorded, then write `[0x82, 0xAC]`. Assert both Restty-bound chunks. Visible `€` alone is insufficient.
4. Arbitrary / NUL / ESC live bytes on the same path.
5. GHOSTSNP Snapshot then Attached then live bytes on the exact subscription (existing chronology helper, updated for the envelope).
6. Hydration buffering still holds live bytes until GHOSTSNP install on the live path.
7. In-page reconnect: stamp `globalThis` sentinel, close the real DataChannel, observe close + reopen without navigation, new subscription id, GHOSTSNP reinstall, then later live bytes on the new generation ([[a page reload is not a reconnect]]).
8. Shared-Hub / workspaces lanes are not this ticket's product surface. If a later assertion in `live-packaged-protocol-harness.mjs` is mode-gated, attribute failures to the executed branch only ([[live packaged harness failures are scoped to the active mode branch]]).

### Repo gates

```sh
npm test
npm run typecheck
npm run lint    # must exit 0; compare to clean-base 4292d30 exit 1 (3 errors above)
npm run build
npm run smoke:browser-runtime
npm run smoke:mounted-terminal-keyboard
npm run smoke:live-packaged-protocol   # with provenance-pinned Hub + worker
git diff origin/main -- scripts/live-packaged-protocol-harness.mjs src/App.test.mjs
# lint sites 3226-3227 and 1952 must appear in this ticket diff
```

Charter also requires rendered interaction, not regex-only proof. The live harness is that proof. Unit tests are not a substitute for the WebRTC path.

## Vault gaps worth capturing

1. Parent Hub work already captured [[live terminal output base64 envelopes carry renderable bytes]].
2. **Required capture after Implement:** [[botster clients restore visible terminal state from readscreen before buffered live output]] still claims ReadScreen-primary visible restoration. First-party Web attach on `origin/main` is GHOSTSNP-primary. Update that note (or add a current successor) so Web/TUI attach authority matches shipped code. Record the conflict in the Plan checklist; do not leave it as `none`.
3. If vendored Restty's JS does not honor `Uint8Array` on the production `onData` path, capture that as a Restty-repo follow-up rather than a Web decoder workaround.
4. The unpublished-vs-merged parent is already covered by [[closed dependency tickets signal merged source not a consumable release]] and [[hub generated protocol changes are a four site release chain]]. Publish ticket `ticket_1786568764_412473` remains operator-owned; Implement waits on registry `0.1.31`, not ticket close.

## Implement sequencing

1. Reset/create the product branch from `origin/main` `4292d30…`. Do not include `d5799db`.
2. Do not edit product decode code until `@trybotster/hub-test-support@0.1.31` is on the public registry and a clean install proves protocol 7 / revision 36 / the live envelope. Do not wait on ticket close as a substitute for that install.
3. Apply the three clean-base lint error fixes in `scripts/live-packaged-protocol-harness.mjs` and `src/App.test.mjs` in the same branch as the product edits.
4. Pin package, copy protocol, update both docs, raise conformance floor.
5. Change `TerminalOutput` and the data-plane decoder/hydration/telemetry. Edit the internal `BotsterTerminalPtyTransport` in `resttyRenderer.ts`, not a new file.
6. Update tests and the live harness probe.
7. Run deterministic gates including `npm run lint` (exit 0), then provenance-pinned live WebRTC proof.
8. Ablate the decoder (reintroduce per-frame `TextDecoder` or `event.data`) and show the new split-UTF-8 and retired-`data` tests go red first.
9. Capture the ReadScreen-vs-GHOSTSNP vault update.
