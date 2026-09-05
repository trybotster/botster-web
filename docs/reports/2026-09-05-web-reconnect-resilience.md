# Web reconnect resilience

Status: implementation checks pass. Independent Codex review and publication remain pending.

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
