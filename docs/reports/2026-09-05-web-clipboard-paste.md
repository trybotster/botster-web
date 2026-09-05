# Web clipboard paste through the Core paste transaction

Status: local implementation checks pass on `e2f3486`. Root source review is in progress. The live mounted lane and two negative controls have not run. Publication is pending.

Base revision: `b556822250f83d02cbbd853c0967ec6d6f64dd1a8`.
Branch: `foundation/web-readiness`.
Worktree: `/private/tmp/botster-web-foundation.sm0cZt/web`.
Audit: `docs/reports/2026-09-04-multiplexer-foundation-audit.md`, section 5, second half.

## Problem

Restty's DOM paste handlers wrapped clipboard text with bracketed-paste markers from Restty's own parser state and submitted it through `sendKeyInput` with source `key`. The Web renderer therefore saw a paste as ordinary key input, the mode-gated encoder refused anything over 65,519 bytes with `PayloadTooLarge`, zero frames were sent, and the failure reached only a harness record. The Core paste transaction was reachable only from the raw `writeInput` path, which the mounted renderer never used. Restty's context-menu Paste item entered the same key path.

## Ownership

- Core validates assembly, bounds, in-flight state, and mode; emits the bracketed-paste opener and closer only when the fenced mode has `bracketed_paste`; and delivers. Verified in the pinned Core `93acae3` sources, which equal `68ca23d` on these paths: `client_worker.rs:895-1106`, `managed_session_runtime.rs:579-638` and `:2312-2333`, `botster-session-worker.rs:648-700`.
- Web detects the paste gesture, supplies the raw text and the mode token, encodes the protocol frames with the package encoder, presents the outcome, retries only a zero-write stale-mode rejection once, and cancels only before Commit.
- Restty owns nothing for paste. Its formatting and key path are bypassed for every recognized paste.

## Changes

`src/botster/terminal.ts`: `TerminalInputOutcome` with outcomes admitted, rejected, partial, cancelled, and unknown. Sizes are explicit: `minimumBytes` (UTF-16 length, always known), `requestedBytes` (exact UTF-8 size, present only after encoding), `deliveredBytes` (Core's `bytes_written` on admitted and partial). `writePaste` on the attachment contract, `onInputOutcome` on the renderer adapter, `subscribeInputOutcomes` on the bridge, a mock `writePaste`.

`src/botster/hubTerminalDataPlane.ts`: `writePaste` runs every check that needs no byte count before its single encoding (empty, detached, `MAX_QUEUED_PASTE_OPERATIONS` 16, UTF-16 length against `MAX_PASTE_BYTES`), then encodes once and checks the UTF-8 size and `MAX_QUEUED_PASTE_BYTES` (2 × `MAX_PASTE_BYTES`). Counters release in a `finally` on every outcome. The transaction joins `terminalFrameQueue`; a coalesced resize flushes before the next queued send and never between Begin and Commit; keys queued after a paste cannot overtake it. Frames come from the package `encodePaste` under the authoritative mode token. The plane awaits the paste `input_result` by operation id within `PASTE_RESULT_BOUND_MS` 8 s. Pending resolvers carry the attachment generation and are removed only by identity, so ids that restart on a new attachment cannot be removed by an old finalizer. Result mapping: admitted; `stale_mode` retried once with a new operation id under the returned mode; `partial_write` or any non-admitted result with bytes written → partial with the authoritative count; `timeout` → unknown, because Core's post-submit Timeout can follow a completed write; every other rejection → rejected. Before Commit, an attachment change or a failed frame send sends `encodePasteAbort` best-effort only on the stream that carried Begin and reports cancelled. After Commit, stream loss reports unknown; reaching the result bound attempts the same bounded abort (`PASTE_ABORT_BOUND_MS` 1 s) and reports unknown. Abort never retracts a completed write.

`src/botster/botsterTerminalPtyTransport.ts`: `writePaste` never encodes the clipboard and never falls back to key input; without a plane or a paste owner it reports an explicit unsupported rejection with `minimumBytes`.

`src/botster/resttyRenderer.ts`: capture-phase `paste` and `insertFromPaste` `beforeinput` listeners on the container consume only non-empty `text/plain`, default-prevent so no duplicate `beforeinput` follows, and route the text. Detection is by event type only. `onPaneCreated` replaces only `pane.app.pasteFromClipboard`, the context-menu Paste action: it reads the clipboard once, treats an empty read as inert, reports a failed read as a `clipboard_unavailable` rejection, and never invokes Restty's original handler. Other menu items are untouched. Outcomes are published through `onInputOutcome`.

`src/botster/TerminalViewHost.tsx` and `src/botster/terminalInputMessage.ts`: a persistent, dismissible input message with `data-terminal-input-outcome`, cleared by Dismiss or a later admitted paste, reset for a replacement session. Attachment lifecycle is untouched. The continuation after `await bridge.attach` returns when cleanup already ran. Cleanup and that continuation each take a subscription reference and clear it before unsubscribing, so a subscription is released exactly once. Outcomes are forwarded through `onInputOutcome`.

`src/App.tsx` and `src/botster/connectionDiagnostics.ts`: `terminalInputOutcomeDiagnostic` upserts one durable diagnostics row per session with the requested and delivered sizes.

Unchanged: `hubTransport`, `protocol`, terminal reattachment, optional-family replay, the terminal-protocol package, Hub, Core, pins. No frame limit was widened.

## Tests

`src/botster/terminalPaste.test.mjs` (from `App.test.mjs`): a real `HubTerminalDataPlane` over a real `WebrtcDaemonTransport` with fake peers, admitted through reservation, reserved-channel Hello, snapshot READY and FINISH, and Attached. Frames sent on the reserved channel are decrypted and decoded. Named scenarios bounded at 20 s with stage reporting: p1 exact 70,000-byte frame sequence equal to the package encoder output; p2 Unicode content across chunks with `minimumBytes` below `requestedBytes`; p3 byte-identical frames under `bracketed_paste` off and on; p4 one stale retry then no third attempt; p5 rejected, unknown (timeout), and partial mappings without retry; p6 too-large refused before encoding with no exact size, empty refused, 16-operation overflow, two 1 MiB pastes admitted with a third refused on the byte bound, counters released; p7 key, coalesced resize, Begin..Commit, then key; p8 failed chunk send → Begin then Abort, cancelled; p9 loss after Commit → unknown, and result bound → unknown with a trailing Abort and a clean late result; p10 unsupported transport paths; p11 an old finalizer released after the next attachment reused operation id 1 cannot remove the new resolver.

`src/botster/terminalViewHostPaste.test.mjs`: mounted through React on the suite's minimal DOM. v1 unmount during a pending attach installs no outcome subscription and releases the status subscription exactly once; v2 message lifecycle (rejected persists, partial, too-large, admitted clears, unknown, forwarding order); v3 a replacement session shows no old message and releases the old subscription.

`scripts/mounted-terminal-keyboard-smoke.mjs`, lane `BOTSTER_MOUNTED_PASTE=1` (`npm run smoke:mounted-terminal-paste`): real Chromium, real `ClipboardEvent` on the focused Restty textarea: 70,027-byte paste byte-identical to the paste owner with zero key-path input; Unicode 1,728 chars / 2,752 bytes with all three sizes; keys `a` and `b` recorded in order around a paste; empty clipboard left to Restty and still default-prevented; context-menu Paste routed to the owner with Copy and other items present; a `?pasteOwner=off` page shows the explicit unsupported message that Dismiss clears.

`scripts/live-packaged-protocol-harness.mjs`, `proveMountedClipboardPaste`: a real paste gesture through the mounted renderer against the real Hub, producer acknowledgement of the 70,000-byte line, an admitted paste `input_result` with exact bytes, zero key-path leakage, and a key typed afterwards echoed after the acknowledgement. Not yet run. It covers ASCII under the session's current bracket mode only.

`App.test.mjs`: the generated CommonJS copy of the terminal-protocol package now exports every size constant from the real package, and the suite asserts parity with the package before any runtime test.

## Validation ledger

Evidence is read-only in `/private/tmp/botster-web-foundation.sm0cZt/evidence/web-paste/` with `SHA256SUMS`. Each targeted run stopped at its first failure under root's checkpoint rule.

| Revision | Run | Outcome |
| --- | --- | --- |
| `653fc2b` | typecheck; targeted | typecheck exit 0; p1 frame wait expired (fixture answered control reads only during admission; not proven as the cause) |
| `99cafe8` | targeted | p1–p5 passed; p6 admission timeout |
| `a16fad5` | targeted | p6 admission timeout again; the 2 s admission bound never fired, so the stage label was stale |
| `912e270` | targeted | bound-constant assertion: `MAX_QUEUED_PASTE_BYTES` was `NaN` in the generated runtime |
| `4fdef5a` | targeted | parity passed; p1–p7 passed; p8 blocked on an unanswered mode-flags read |
| `a3fec66` | targeted | all eleven paste scenarios passed; view-host v1 failed because the scenario no longer unmounted |
| `7934e87` | targeted | v1 scenario passed; status subscription released twice |
| `aff42d7` | targeted | exact-once release passed; v2 finder read the wrong class field |
| `b8f5f1d` | targeted | exit 0 |
| `b8f5f1d` | npm test; build; lint | test exit 0; build exit 0; lint one error (unused helper) and two new warnings |
| `6331446` | lint; build; targeted | lint one error (unused import); build exit 0; targeted exit 0 |
| `e2f3486` | lint; targeted; mounted paste smoke; npm test; build | all exit 0; lint zero errors and the five pre-existing warnings |

The `NaN` assertion proved a fixture defect: the generated CommonJS package had exported only `MAX_INPUT_DATA_BYTES`, so the compiled plane under test received `undefined` for `MAX_PASTE_BYTES` and its bounds were ineffective in the test runtime. That defect is consistent with, but not a full-sequence proof of, the two earlier p6 timeouts. The other test-file defects were scenario or fixture errors, not client behavior.

## Negative controls on `e969c74`

Both controls ran the unchanged `e2f3486` smoke script and harness page against altered production source, in this worktree, with an exact saved diff, a trap-guaranteed reverse patch, and a hash check after restore. Each run mounted the page and passed the telemetry pre-check before failing. Each failed at the first paste case with the wrong-route signature: `pastes` 0, `pasteOutcomes` 0, `clipboard_paste` records 0, one key-path input of 70,027 characters beginning `botster-web-mounted-paste:`, one `pty_send_input` of 70,027 characters, no input message. That is the fault the change targets, so the passing smoke on `e2f3486` is not a fixture artifact.

| Control | Source under test | Smoke exit | Restore |
| --- | --- | --- | --- |
| B | `e969c74` with the two capture registrations and their cleanup lines removed from `resttyRenderer.ts` (4 lines) | 1, first case | renderer hash equals the table above; status clean |
| A | `b556822` versions of `resttyRenderer.ts`, `hubTerminalDataPlane.ts`, `botsterTerminalPtyTransport.ts`, `TerminalViewHost.tsx`, and `terminal.ts`, verified by blob id, under the retained `e969c74` harness page and smoke script | 1, first case | all five hashes equal the table above; status clean |

Control A is a compatibility harness over main's production files, not a pure main build: main's harness page has no paste recorder, so the branch page was retained to give main's renderer a paste owner it never calls. The two smoke logs are byte-identical because the script output is deterministic; their write times differ. Evidence is in the worktree under `node_modules/.botster-foundation-evidence/web-paste/negative-controls/` with its own `SHA256SUMS` (11 entries).

## Live lane with an exact receiver (implemented, not yet run)

`npm run smoke:live-packaged-protocol:paste` runs the live harness with `BOTSTER_LIVE_PASTE_CASES=1`, which adds `proveLivePasteCases` after the existing `proveMountedClipboardPaste`. The production session script gains three cases: `bracket-on` and `bracket-off` emit DECSET and DECRST 2004 explicitly and echo a done marker; `receive:<N>` is the receiver. N must be a positive integer no greater than `MAX_PASTE_BYTES` plus the 12 marker bytes. The receiver saves its stty state and fails closed with an error line, without a ready line, if the save or the raw switch fails. It enters raw mode with echo off (no `icrnl`, no `opost`, no `isig`, no line editing), starts a reader (`dd bs=1 count=N` from `/dev/tty` into one file next to the script; `dd` writes each byte as it arrives, so a reader killed by the watchdog loses nothing, which `head` did not guarantee) and a 30 s wall-clock watchdog, both owned by pid, and only then prints its ready line. On success or timeout it kills and reaps both processes, restores the saved state, and echoes `received:<N>:<count>:<sha256>` after removing the file. The script's exit and signal traps run the same cleanup: stop an active reader and watchdog, remove the exact file, restore the saved state, then restore the entry state. `VTIME` 10 s ends an idle read. Script lines can arrive split across output events, so the harness waits for each complete line, including the digest and the line terminator, and validates the announced N in the receipt.

Each case keeps two digests apart. The payload digest is the clipboard text as UTF-8, compared with Web's `requestedBytes`. The wire digest adds `ESC[200~` and `ESC[201~` only when the case set bracketed paste on, and is compared with the receiver's digest; the receiver's count is compared with the wire length. The admitted `input_result` must report the mode the case set. Pinned Core `93acae3` prepends and appends the markers before the mode-gated PTY write and reports the actual PTY write count, so `bytes_written` equals payload plus 12 under bracketed paste and the payload otherwise. Web forwards that count unchanged as `deliveredBytes`, so under bracketed paste `deliveredBytes` exceeds `requestedBytes` by 12 for an admitted paste; the diagnostics row shows both. Stale-mode retries are recorded per case and bounded at one, never asserted absent, because each mode switch changes the mode token.

Cases, in order: bracket off, ASCII 70,000 bytes plus its marker prefix; Unicode with UTF-8 bytes above the UTF-16 length; CRLF bytes unchanged; bracket on, 4,096 bytes with markers on the wire; bracket off again, 4,096 bytes without markers; an oversized clipboard text refused as `too_large` with no `requestedBytes`. For that refusal the harness observes the rejected outcome, no new `paste`, `paste_committed`, or `paste_settled` telemetry, and no key-path input carrying the text; that no protocol frame was sent is an inference from the plane source, because the plane records no per-frame telemetry. Every admitted case asserts exactly one outcome and one settlement for its operation id, zero key-path leakage, and a key typed after the receipt echoed after it.

### Receiver-only proof (run, passed)

`npm run proof:paste-receiver` (`scripts/paste-receiver-proof.mjs`) runs the exact generated session script under a real PTY through `script(1)`, with no Hub, browser, or build, and shares the complete-line patterns with the live harness. It passed all six cases on the current source in about 42 s: normal input of 3,852 bytes containing CR, LF, both bracket markers, `0x03`, and every byte value 1 to 255, received byte-identical by count and SHA-256 with the terminal state equal to the baseline `stty -g` and the line loop still echoing afterwards; fragmented receipt parsing, where the shared pattern first matches only when the terminator byte arrives under 1-byte and 7-byte chunking; idle timeout, where 100 of 4,096 announced bytes produced a receipt after about 10 s with the correct count and digest; fail-closed inputs `0`, `abc`, `1048589`, and a 20-digit string, each producing an error line of the expected kind and no ready line; wall-clock timeout, where one byte every 5 s produced a receipt after about 29.7 s with the 6 trickled bytes intact; and signal cleanup, where `SIGTERM` to the armed shell removed the receive file and left no reader, watchdog, or sleep process within 50 ms. In every armed state the proof observed and tracked the `dd` reader, the watchdog subshell, and its `sleep` child, and none survived. Three earlier runs failed on proof plumbing or a receiver defect and are preserved with their transcripts: Node's socket stdio is rejected by `script(1)` (fixed with a pipe wrapper); `head -c` buffered its output and reported 0 bytes when the watchdog killed it (fixed by switching the reader to `dd bs=1`); and the signal assertion waited for the wrapper pipeline instead of the shell. Evidence: `node_modules/.botster-foundation-evidence/web-paste/receiver-proof/` with `SHA256SUMS`.

Cancellation and error cases (before-Commit cancel, after-Commit unknown, Core `PartialWrite` and `Timeout`) stay at design stage: they need an observed protocol boundary in the live page, and the plane's test hooks are constructor-only, so a deterministic mechanism is not yet available without a production change.

## Finding: delivered-byte wording under bracketed paste

`deliveredBytes` forwards Core's `bytes_written`, which is the actual PTY write and includes the 12 bracket marker bytes when `bracketed_paste` is on. The plane's detail strings say "Paste delivered N of M bytes" and "Terminal delivered N of M bytes before the write stopped", where M is the payload size, and the partial input message says "Paste partially delivered (N of M)". Under bracketed paste an admitted 4,096-byte paste therefore reads "delivered 4108 of 4096 bytes", and a partial count includes up to 6 opener bytes that are not payload. The counts are correct as PTY bytes; the "of M" framing was misleading. Correction applied in the source commit after the harness commit: `deliveredBytes` stays Core's count and Web never subtracts markers to invent payload progress; the `terminal.ts` contract says the count includes Core's bracketed-paste markers; the plane's admitted and partial details read "Terminal wrote N PTY bytes for a M-byte clipboard paste" (partial adds "before the write stopped"), with ", including bracketed-paste markers" appended when the result's `mode_flags.bracketed_paste` is true; the rejected detail says "after N PTY bytes"; the partial input message reads "Paste partially delivered (N PTY bytes written for M bytes of clipboard text)"; the diagnostics row says "N PTY bytes written". The p5 partial detail regex and the view-host v2 partial and admitted fixtures were updated to the new wording.

## Cancellation coverage by ownership boundary

Boundaries observed in every case: the decoded frames on the reserved channel (Begin, Chunk, Commit, Abort), the plane's `paste_committed` and `paste_settled` telemetry, and the single outcome. No case infers a boundary from elapsed time. All of these run in the controlled fixture of `terminalPaste.test.mjs`: the real `HubTerminalDataPlane` over the real `WebrtcDaemonTransport` with fake peers, admitted through reservation and Hello. The full mounted application (Chromium and the real Hub) covers admitted, stale-retry, and too-large outcomes in the live lane; cancelled and unknown presentation is covered by the React view-host test on the minimal DOM, because the mounted application has no deterministic interruption point.

| Label | Case | Boundary | Status |
| --- | --- | --- | --- |
| F1 | pre-Commit interruption by a failed frame send on a live generation (p8) | frames Begin then Abort, no Commit; outcome cancelled "was not sent" | passed earlier and in this run |
| F2 | pre-Commit interruption by attachment change (p12, new) | the reserved channel is closed synchronously after Begin is forwarded; the plane's stream-loss path bumps the generation; the transaction's next-iteration `stillLive` guard cancels with "attachment changed"; the lost stream carries Begin only, no Abort on a recovered generation; the replacement stream carries nothing from that operation; a later paste restarts at operation id 1 and admits | passed; no production hook was necessary, the existing fake send boundary expressed it |
| F3 | loss of the authoritative result after Commit (p9-lost) | Commit observed on the decoded stream before the control channel closes; outcome unknown `stream_lost`; no Abort | passed |
| F4 | result bound after Commit (p9-bound) | controlled timer after Commit observed; outcome unknown `result_bound`; Abort observed as the fourth frame; a late admitted result settles cleanly | passed |
| F5 | Core-side authoritative rejection | p5 maps injected `partial_write`, `timeout`, and rejections without retry, which proves Web's mapping only, not a real Core rejection | mapping passed; a real `session_not_writable` case is pending and needs Core confirmation that an ended session keeps an attachable subscription that still answers with `input_result` |

## Not yet covered

- Live lane: implemented, not run. It also lacks bracket-off and bracket-on, Unicode, CRLF, and cancellation or error cases. Local success does not establish live acceptance.
- Root source review remains open. Publication is pending.

## Hashes on `e2f3486`

| File | SHA-256 |
| --- | --- |
| `src/botster/terminal.ts` | `ce9db1e31d9bb3635a87c5a4186baba2152ea3e465043bf4a357c7bff4a2f5c6` |
| `src/botster/hubTerminalDataPlane.ts` | `73decd2120d970dd5fbc0f4695a521a2970b1b02623f916d3603c6d4a4a1996a` |
| `src/botster/botsterTerminalPtyTransport.ts` | `9a66dcbab93aa03f146488c1c4cd68438b9de44df46eaaf5639d789c655e235b` |
| `src/botster/resttyRenderer.ts` | `c33bbe82f34531b6ceda77106a17eee46275778d71c89639fd1b58a712123528` |
| `src/botster/TerminalViewHost.tsx` | `73ff243d9b5613b14b67d822a8a1164846436bb73d387c831028a317fae08f4b` |
| `src/botster/terminalInputMessage.ts` | `8c67bbcd3e32455992f156d1e2185cc7bf19c0c6986288416b95f7c0278b689b` |
| `src/botster/connectionDiagnostics.ts` | `1fa34305daee28a4f6e3bf34ac14cfc573ba9a962605c6d48e4133c3ae2b0c3c` |
| `src/App.tsx` | `e56ae6ef9a5abf0244aecf52b2825b6b591b919ea4361ad519b3de75ac66974a` |
| `src/theme/app.css` | `3652c4b07c10627a06bc2c89c73ac7acedd2dcc8689103f41a29ca0dad6d0f7f` |
| `src/botster/mountedKeyboardSmoke.tsx` | `9ae0e43adff1af3152b3668cb9837b8e35c4ab9e84088fe79ebbe56b37a899c4` |
| `src/botster/terminalPaste.test.mjs` | `b3195a9ab9cc7696fbcd76b614e90e6818692938b57eaeddc19a5b3771ee075b` |
| `src/botster/terminalViewHostPaste.test.mjs` | `4b05e52ddeadb5127cd13abfe2104c990752f783f40ef6095292ab0cc77d95ba` |
| `src/App.test.mjs` | `281244fa35d2310cbde26a7b7b909233e9e582c92dc3bb5fbc58b3ffc4073c24` |
| `scripts/mounted-terminal-keyboard-smoke.mjs` | `3857afd7354a56142627111d91b89d5dab82894167b50040732fd72a1b89a0e6` |
| `scripts/live-packaged-protocol-harness.mjs` | `fe57640d2c707c3e28e23b8ccc93ef0777b7f97035787a8b55d3eea8557902a5` |
| `package.json` | `bcb5f41e9749e3249921947b67e275586d8e8bbbdd6f5849a6513f25606f4dde` |

| Receipt | SHA-256 |
| --- | --- |
| `app-test-targeted-e2f3486.log` | `edcd1c3d457acc5dd917ab2434371eeb2dcd6ea87abc2c343204bd83a8730d3c` |
| `npm-test-e2f3486.log` | `490109584d88ee4766016a6cd58053da04adebaf74dd479f009159397b5ce928` |
| `npm-run-build-e2f3486.log` | `3e226bc523db6e357a202c0d9bbc5924a8ec5042ca1054cb340abb3e5ed25a8b` |
| `npm-run-lint-e2f3486.log` | `cb9e8f1a6e07961811eb4dc683e70f03c9a4a45c9708f9d23b585798cdb3cb3d` |
| `smoke-mounted-terminal-paste-e2f3486.log` | `360e4bd42b3620ddea59954dcb03fb00fe524cb46d6575b559c2c0133dee4048` |
