# Web reconnect resilience

Status: implementation checks pass on the corrected revision. Independent Codex review and publication remain pending.

The sections up to Hashes describe the first candidate `543d90e`. The Corrections section describes the reviewed corrections and their validation on `caa33d2`.

Base revision: `13f89ba937970b70c6194acf493b5f4b820e751e`.
Branch: `foundation/web-readiness`.
Worktree: `/private/tmp/botster-web-foundation.sm0cZt/web`.

## Problem

After a transport loss with reconnect demand, `WebrtcDaemonTransport` made one recovery attempt.
A failed attempt only recorded a harness event. Recovery then waited for a new caller request.
Astra identified five source hazards, all confirmed:

- `open()` awaited the bootstrap and the key import before it allocated `peerGeneration`, so two attempts could interleave.
- The `connect()` catch reset shared peer state unconditionally, so a stale failure could close a newer attempt's peer.
- `resetPeerState()` cleared `connectPromise` without invalidating the running attempt.
- `sendHello()` had no ownership guard after the ack await before it marked the stream ready and emitted lifecycle events.
- The post-Hello subscription restoration microtask had no cancellation fence.

## Changes

`src/botster/webrtcDaemonClient.ts`:

- One attempt identity. `startAttempt()` creates a `ConnectAttempt` whose `generation` is `++peerGeneration`, allocated before the first await. The attempt owns its promise, deadline timer, abort controller, and peer resources.
- Ownership. `ownsAttempt()` is true only while the attempt is `currentAttempt`, its generation equals `peerGeneration`, and the client is not disconnected. `open()` checks ownership after every await. A superseded attempt throws a stale failure.
- Publication. `open()` keeps the key, peer, and channel local until the ownership check, then publishes them. The peer listeners keep their identity checks.
- Completion. `completeAttempt()` resets the retry counter and clears reconnect demand only after the authenticated Hello that `open()` awaited.
- Failure by identity. `failAttempt()` settles once. An owning attempt captures reconnect demand before invalidation, resets shared peer state, closes its own resources, rejects its callers, and schedules recovery. A stale attempt closes only its own resources and rejects. A stale catch never clears a newer attempt's promise or timer.
- Absolute deadline. Each attempt arms one `window.setTimeout` for `attemptTimeoutMs` at attempt start. On expiry the attempt fails through `failAttempt()`, which rejects the caller even when the bootstrap provider or the fetch ignores cancellation, aborts the fetch through the attempt's `AbortController` where supported, and schedules recovery through the same path.
- Capped backoff. `scheduleRetry()` keeps one retry timer. Delay is `min(500 ms * 2^(attempt-1), 10 000 ms)`. Retries continue while reconnect demand exists until an authenticated Hello or an explicit `disconnect()`. There is no absolute retry budget. A caller request during the wait cancels the timer and starts the attempt immediately through the same single path.
- Sticky demand. `handleTransportClosed()` stores the demand snapshot that the close and error listeners capture before `emitLifecycle`, so later retries do not re-evaluate demand after terminal listeners detach. Demand clears only after an authenticated Hello and is captured again at the next loss.
- Loss during an attempt. When the control channel closes while its attempt is still connecting, `handleTransportClosed()` fails that attempt by identity instead of resetting around it.
- `sendHello()` takes the attempt, keys the Hello promise by generation, and rejects a late ack for a superseded or disconnected attempt without emitting lifecycle events.
- The post-Hello subscription restoration checks ownership inside the microtask.
- `disconnect()` invalidates ownership, cancels the retry timer, clears demand, and settles the in-flight attempt before shared cleanup.
- `resetPeerState()` no longer clears `connectPromise`.
- Lifecycle events `reconnect-attempt` and `reconnect-scheduled` expose retry state. `localWebrtcReconnectPolicy` exports the constants. No test-only production option was added; the existing window timer substitutions control delays in tests.

`src/botster/connectionDiagnostics.ts`: both new events map to the existing `webrtc-data-channel-state` diagnostic id with warning severity, so the App diagnostics listener replaces the danger closed state with retry state without an App change.

Unchanged: `HubTerminalDataPlane`, `hubTransport`, `protocol`, terminal reattachment paths, optional-family replay, paste, dependency pins, Hub.

## Tests

`src/botster/webrtcReconnect.test.mjs` (461 lines, 76 assertion sites), entered from `src/App.test.mjs` inside the block that installs the test window with lifecycle capture.
Every scenario uses the real `WebrtcDaemonTransport` through `createWebrtcDaemonClient` with fake peers, fake channels, automatic encrypted Hello, and window timers replaced by a map that records delay and lifecycle position so retry and deadline timers are identified exactly.

| Scenario | Verified behavior |
| --- | --- |
| (a) held entity demand | Subscribe, admit, close. Attempts 2 and 3 fail in the peer factory. Scheduled delays 500 and 1000 with one live retry timer; failed attempts clear their deadline. Attempt 4 recovers, re-subscribes with a new id, and delivers a real frame, with no caller request. Two Hello acks, three reconnect-attempt events. A second loss recovers immediately from held demand. Disconnect leaves no retry timer. |
| (a2) backoff reset | After recovery, a later loss with a failing attempt schedules attempt 1 at 500 ms again. |
| (b) terminal-only demand | Real `HubTerminalDataPlane` over the client, no entity subscription. Attach requested; close; two failures; recovery. The plane reports the loss and the reattach, detaches the abandoned subscription on the recovered peer, then attaches with a new subscription id. No entity subscribe occurs. |
| (c) duplicate signals and concurrent requests | Malformed frame plus two close calls produce one attempt and one timer. Two requests during the wait start exactly one attempt, cancel the timer, and both settle on the recovered peer. |
| (d) cancellation | Disconnect during bootstrap: no peer created, no lifecycle events, caller rejected. During signaling: fetch received the abort signal, disconnect aborted it, the late answer opened nothing, the attempt's channel closed, no Hello. After the Hello send: caller rejected, late ack emits no hello-ack and no encrypted-stream-ready. |
| (e) obsolete A after B | Attempt A blocked in signaling; its deadline fires, closes A's channel, schedules 500 ms. Attempt B succeeds and re-subscribes. A then settles late by rejection and, in a second pass, by resolution. B stays current, no extra Hello, no scheduled event, no timer change, and a request routes through B. |
| (f) capped backoff | Seven consecutive failures schedule 500, 1000, 2000, 4000, 8000, 10000, 10000. Each failed attempt cleared its deadline and exactly one retry timer is live. Attempt 9 recovers. Disconnect clears the timer. |

The existing test that recovers through a new `list_apps` request stays as a compatibility check. It is not the proof of recovery.

On the final repaired source, the clean run executed every scenario in the table in order: (a), (a2), (b), (c), (d) with its three cancellation points, (e) twice (late rejection, then late resolution), and (f). Every assertion site in the file lies on the passing path; none is reached only through a failure branch. The run exited 0, so each assertion held.

## Executed checks

All commands ran in the worktree under Node `v22.21.1` in a root-assigned test window.
Logs are read-only in `/private/tmp/botster-web-foundation.sm0cZt/evidence/web-reconnect/` with `SHA256SUMS`.

- `node src/App.test.mjs` clean targeted run after removing instrumentation: exit 0 (`app-test-clean.log`).
- `npm test`: exit 0 (`npm-test.log`). Two pre-existing React act warnings only.
- `npm run build`: exit 0 (`npm-run-build.log`). Pre-existing large-chunk warning only.
- `npm run lint`: exit 0, zero errors, five pre-existing warnings (`npm-run-lint.log`).

## Negative control

The repaired client hash was recorded (`client.sha256.before-control`), the `13f89ba` client was restored, and `node src/App.test.mjs` ran: exit 1 (`app-test-negative-control-13f89ba-client.log`).
Scenario (a) failed at the wait for the first `reconnect-scheduled` event after the failed recovery attempt. The old client makes one attempt and schedules nothing.
This control fails on retry lifecycle observation only. It does not by itself prove the later recovery, cancellation, ownership, or backoff scenarios; those are established only by the passing run on the repaired source.
The repaired client was restored and its SHA-256 matched.

## Failed iterations

`failed-iterations/` preserves the eleven earlier runs with a README. All were test-file defects: channel indexed before async creation, missing admission snapshot, a split comment, a self-recursive wait helper from a bulk edit (six runs, out-of-memory), and a race on the second retry fire. Temporary trace lines were added to the client for diagnosis and removed; the client file was byte-identical before and after.

## Hashes

| File | SHA-256 |
| --- | --- |
| `src/botster/webrtcDaemonClient.ts` | `c9a6972e89b89899fc8c464ae40564cafef7b129ab64075d222165146a438fd0` |
| `src/botster/connectionDiagnostics.ts` | `1f2be6b440942eea7caa7e08d4ef97cca662da4c1fb931a151d987efb45b8306` |
| `src/botster/webrtcReconnect.test.mjs` | `8155ffd6d08e94dd75d64f031e869d98a83fae8bed176075b084e67d1b4523dd` |
| `src/App.test.mjs` | `eee682715635777c2947e8526bf3745423dd690c5c7e0f70bf7af15ff71b0190` |

| Evidence file | SHA-256 |
| --- | --- |
| `app-test-clean.log` | `edcd1c3d457acc5dd917ab2434371eeb2dcd6ea87abc2c343204bd83a8730d3c` |
| `npm-test.log` | `490109584d88ee4766016a6cd58053da04adebaf74dd479f009159397b5ce928` |
| `npm-run-build.log` | `5f4bea6c0f8a3f77a3ae3e371795b8819625a4cc4de5c9c9be5bb2c4c8c4e604` |
| `npm-run-lint.log` | `cb9e8f1a6e07961811eb4dc683e70f03c9a4a45c9708f9d23b585798cdb3cb3d` |
| `app-test-negative-control-13f89ba-client.log` | `b0415fba2f19933ea5c15bf64ef71490a8810c07abf1c0a8d9c7eaf169ed4b4e` |
| `client.sha256.before-control` | `595b579bab2d245e9d6c840fc2acf58bba37f1a0fc9b859cbefff3ea0dbe6adf` |

## Not covered

Optional-family replay after reconnect, paste, and Hub changes are outside this change.
The tests use fake peers and channels; they do not exercise a real RTCPeerConnection or a live Hub.
Independent review is pending.

## Corrections after review

Root review of `76b1f89` required four changes. Two further findings arrived during correction. All are in commits `2a63bff`, `b2f59cd`, `f01e221`, `30456fc`, `6cab51d`, and `caa33d2` on the same branch.

Client (`src/botster/webrtcDaemonClient.ts`, `2a63bff` and `b2f59cd`):

- `sendHello()` re-checks ownership after the `hello-ack` lifecycle callback before it marks the stream ready or emits `encrypted-stream-ready`.
- `startAttempt()` installs the attempt deadline before it emits `reconnect-attempt`, and stops without opening if the callback settled or invalidated the attempt.
- `scheduleRetry()` installs the retry timer before it emits `reconnect-scheduled`.
- The close, error, and message-failure handlers pass their peer generation to `handleTransportClosed()`. When a callback has already started a newer attempt, the handler fails only the lost generation's pending requests and never touches the newer attempt.
- `captureReconnectDemand()` records demand at the moment of loss, before any callback can detach a terminal listener or start the next attempt. Demand clears only after an authenticated Hello or `disconnect()`.
- `failPending(generation)` partitions the pending list in one pass.

Tests (`src/botster/webrtcReconnect.test.mjs`, `src/App.test.mjs`):

- Scenario (b) completes the actual admission on the recovered peer: terminal reservation, reserved-channel Hello, two snapshot frames through the bound ghostsnp reader, `Attached` status, then `terminal_output` delivered by the real `HubTerminalDataPlane` to its output subscriber. Control `read_mode_flags` and `read_screen` requests are answered as they arrive.
- Scenario (g) drives each callback boundary through the `onLifecycle` option: a `hello-ack` callback that disconnects (readiness rejects, no ready event, no restore, request rejects), a `reconnect-attempt` callback that disconnects (no peer, no deadline timer, nothing scheduled), a `reconnect-scheduled` callback that disconnects (no retry timer), and a `data-channel-closed` callback that starts a request (the new attempt survives, serves the request, restores the subscription, nothing scheduled; both control requests answered once in wire order).
- Scenario (g2): terminal-only demand where the loss callback starts attempt B; B fails; the captured demand schedules retry 1 at 500 ms; the callback's request rejects; attempt 3 recovers to detach then attach with a new subscription id, with no new caller request.
- Scenario (h): `refreshBootstrap` never settles; the only live deadline timer fires; the caller rejects with the timeout; the late bootstrap result creates no peer, events, or timers.
- Owned timers are captured at each `reconnect-attempt` and `reconnect-scheduled` emission and fired by identity; the exactly-one-live-timer assertions remain.
- Every scenario runs under a named 20 s bound on the real Node timer, separate from the controlled window timers; a timeout reports the scenario name and awaited stage.
- The pre-existing source-text guard at `App.test.mjs:2053` names `captureReconnectDemand` before the same `data-channel-error` emission.
- The file header names which scenarios recover and which cover cancellation, callback boundaries, and the deadline.

Validation rounds, each stopped at the first failure under root's checkpoint rule; receipts are read-only in `/private/tmp/botster-web-foundation.sm0cZt/evidence/web-reconnect-corrections/` with `SHA256SUMS`:

| Revision | Typecheck | Targeted suite | Outcome |
| --- | --- | --- | --- |
| `b2f59cd` | exit 0 | exit 1 | Pre-existing source-text guard expected the old capture name; no reconnect scenario reached. Fixed in `f01e221`. |
| `30456fc` | exit 0 | exit 1 | All scenarios through (f) passed; (g) first case crashed on an unowned readiness rejection in the test. Fixed in `6cab51d`. |
| `6cab51d` | exit 0 | exit 13 | Unsettled await with no stage evidence; cause not attributed. Wire-order answers and the bounded runner added in `caa33d2`. |
| `caa33d2` | exit 0 | exit 0 | All eleven scenario passes completed; none timed out. |

Final checks on `caa33d2`: `npm test` exit 0, `npm run build` exit 0, `npm run lint` exit 0 with zero errors and five pre-existing warnings.

Negative control on `caa33d2`: the repaired client hash was recorded, the `13f89ba` client was restored, `node src/App.test.mjs` exited 1, and the repaired client was restored with a matching hash. This control failed at the source-text guard at `App.test.mjs:2053`, because the old client does not contain `captureReconnectDemand`. It ended before the reconnect scenarios and proves only that the guard rejects the old client. The behavioral retry-lifecycle control remains the earlier run in `evidence/web-reconnect/`.

Final source hashes on `caa33d2`:

| File | SHA-256 |
| --- | --- |
| `src/botster/webrtcDaemonClient.ts` | `8be7edafd97899a892532e72c68fcff778db7b7b090f5033db1fe1bd1164604f` |
| `src/botster/connectionDiagnostics.ts` | `1f2be6b440942eea7caa7e08d4ef97cca662da4c1fb931a151d987efb45b8306` |
| `src/botster/webrtcReconnect.test.mjs` | `35448d562df6185b034b2918a6be48a08892cfff7a887480d408ade462a0b28a` |
| `src/App.test.mjs` | `17dad0e79bc58311833d9ef8a51bb70fe5341d510dfb19874f355098a1efcb5e` |

Corrections evidence hashes:

| File | SHA-256 |
| --- | --- |
| `app-test-targeted-caa33d2.log` | `edcd1c3d457acc5dd917ab2434371eeb2dcd6ea87abc2c343204bd83a8730d3c` |
| `npm-test-caa33d2.log` | `490109584d88ee4766016a6cd58053da04adebaf74dd479f009159397b5ce928` |
| `npm-run-build-caa33d2.log` | `667142572dce458176171d17609240d20d413c36f81de1ee1afc238999dd1455` |
| `npm-run-lint-caa33d2.log` | `cb9e8f1a6e07961811eb4dc683e70f03c9a4a45c9708f9d23b585798cdb3cb3d` |
| `npm-run-typecheck-caa33d2.log` | `3b1cfdf5282122d5a787e07cd5884278f1c81be57e8e7246f36e006fb0ee0267` |
| `app-test-negative-control-13f89ba-client-caa33d2.log` | `90b3f500848e15e8d600a8fb913d881924e9060825a2cbf30f9a0a32562ea099` |
| `client.sha256.before-control-caa33d2` | `a59ee92cde5fafe5b7eed2e480052aad7124241b4b1c7091b0dd65653e2d6988` |
| `app-test-targeted-failure-1.log` (`b2f59cd`) | `0c1f01f6d2bd3497b857bc080928a7549877355bf99a6d56b0b2f98a3c3d5c63` |
| `app-test-targeted-30456fc.log` | `95098aeb921eacb0731c39204661e56431ac42c9b73b0aa803b0927e329644a1` |
| `app-test-targeted-6cab51d.log` | `6abd3fb36a29922344fa307a37606d57fdc508aff2b56a92472c017e8bd09633` |
