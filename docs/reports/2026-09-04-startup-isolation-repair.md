# Startup isolation repair

Status: implementation checks pass. Independent Codex review and publication remain pending.

Base revision: `67aa0dfe8013833318ecdebe33f1bb627517787d`.
Branch: `foundation/web-readiness`.
Worktree: `/private/tmp/botster-web-foundation.sm0cZt/web`.

## Problem

The startup chain in `useProductionHubConnection` ran every request in one serial promise chain.
The session pull was the last link.
One pending optional request blocked session load status.
One rejected optional request rejected the whole chain.
The catch handler then reported a connection failure and wrote a visible action status.

## Changes

`src/app/useProductionHubConnection.ts`:

- Connect (status request) and subscribe (session entity subscription) remain essential prerequisites. They run first, in order.
- After subscribe, the hook starts the session pull and every optional pull without awaiting them.
- The session pull reuses the session subscription that subscribe already started. Its load status completes when that subscription is ready.
- Each pull records its own load status. A rejected pull records a diagnostic and does not reject the chain. A session pull failure records a danger diagnostic. An optional pull failure records a warning.
- The production surface subscription is awaited after the pulls start. Its rejection records a warning diagnostic and does not reject the chain.
- A cancelled effect skips pull start and all later state writes.
- Only connect and subscribe failures reach the connection failure handler.

The change does not alter the transport, entity store, reconnect hydration, dependency pins, or Hub.
Reconnect recovery remains a separate item.

Finding: the shipped daemon transport has no `surface_subscribe` handler in `send`, so it resolves that frame immediately.
The hook still guards the `HubConnection.subscribeSurface` contract because other transports may implement it.

## Tests

`src/app/productionHubConnection.test.mjs`, entered from `src/App.test.mjs`.
`src/app/__fixtures__/productionHubConnectionHarness.tsx` mounts the actual hook.

Each scenario mounts the actual hook through `createBotsterWebClient` and the real `createHubTransport` over a controlled daemon bridge.
Surface pending and failure cases wrap the real transport `send` for the `surface_subscribe` frame only.

| Scenario | Verified behavior |
| --- | --- |
| optional | One optional request pending and one rejected. Session loads first. Rejection records a warning only. Later completion updates its own load key. |
| surface_pending | Surface subscription never settles. Session loads and rows render. No surface diagnostic. |
| surface_failure | Surface subscription rejects. Warning diagnostic only. No action status. |
| connect_failure | Status request rejects. `hub-unavailable` diagnostic, one action status, no optional call, session not loaded. |
| subscribe_failure | Session subscription rejects. `stream-disconnected` diagnostic, one action status, no optional call, session not loaded. |
| cancel_connect | Unmount while status is pending. Disconnect runs. Late resolution produces no observable late calls, diagnostics, action status, or rendered load updates. |
| cancel_subscribe | Unmount while session subscription is pending. Disconnect runs. Late resolution produces no observable late calls, diagnostics, action status, or rendered load updates. |
| cancel_optional | Unmount while an optional request is pending. Late rejection produces no observable late calls, diagnostics, action status, or rendered load updates. |

The successful startup scenarios (optional, surface_pending, surface_failure) also verify: status precedes session subscribe, session subscribe precedes the first optional call, every optional call and the surface subscribe occur, and a real session upsert frame through the actual subscription reaches the entity store and the rendered list.
The cancel scenarios return before those assertions.

The cancellation tests observe the bridge, the diagnostic and action callbacks, and the rendered load status. React unmount can suppress state setter effects on its own, so the tests do not independently instrument every setter invocation. The `cancelled` guards in the production source are present and reviewed.

## Executed checks

All commands ran in the worktree under Node `v22.21.1` in the root-assigned test window.
Logs are preserved read-only in `/private/tmp/botster-web-foundation.sm0cZt/evidence/startup-isolation/`.
That directory holds `SHA256SUMS` for every file listed below.

- `npm test`: exit 0 (`npm-test.log`). Protocol drift, renderer telemetry, application assertions, and all eight startup scenarios passed. Two pre-existing React act warnings from `PackageEventNoticeHarness` remain. None come from the new tests.
- `npm run build`: exit 0 (`npm-run-build.log`). TypeScript project checks and the Vite production build passed. Vite reports the pre-existing large-chunk warning.
- `npm run lint`: first run exit 1. The new test file used the bare `document` global, which the Node lint config rejects. The fix replaced it with `globalThis.document` on two lines, the form the existing suite uses. Second run exit 0 with zero errors and the five pre-existing warnings in unchanged files (`npm-run-lint-second-run.log`). Limitation: the second run overwrote the shared log of the first run. `npm-run-lint-first-run-excerpt.md` records the verbatim tail captured from the first run.
- `node src/App.test.mjs` after the lint fix: exit 0 (`app-test-rerun-after-lint-fix.log`). Wall time 13.5 seconds.

## Negative control

With the repaired hook replaced by the `67aa0df` version and the new tests unchanged, `node src/App.test.mjs` exited 1 (`app-test-negative-control-head-hook.log`).
The `optional` scenario failed at the session load assertion: actual `undefined`, expected `loaded`.
The serial chain had not reached the session pull because one optional request was pending.
The repaired hook was restored from a copy and its SHA-256 matched the pre-control hash.

## Hashes

Evidence files, SHA-256:

| File | SHA-256 |
| --- | --- |
| `npm-test.log` | `490109584d88ee4766016a6cd58053da04adebaf74dd479f009159397b5ce928` |
| `npm-run-build.log` | `cdc2492aeb014dc77c5b8aef2f2ec0cc4d3ac7c1dc6ad15ee80169245fd050e2` |
| `npm-run-lint-first-run-excerpt.md` | `5ef6639583e88d85b180f0c40793ef329f26c6c242e8aa1565700b03b4d52d21` |
| `npm-run-lint-second-run.log` | `cb9e8f1a6e07961811eb4dc683e70f03c9a4a45c9708f9d23b585798cdb3cb3d` |
| `app-test-rerun-after-lint-fix.log` | `edcd1c3d457acc5dd917ab2434371eeb2dcd6ea87abc2c343204bd83a8730d3c` |
| `app-test-negative-control-head-hook.log` | `ebf16693b91acb2d3da3accb8bde4a45726ec86ec556c45b477318e17deade4b` |

Source files at the time of the checks, SHA-256:

| File | SHA-256 |
| --- | --- |
| `src/app/useProductionHubConnection.ts` | `b616ede4082dc57c18d46c29b0484790955f510958f6019595e13f9db1f4ae9e` |
| `src/app/productionHubConnection.test.mjs` | `13fb67caa5eeca1426b15a1481c592fb29c4bae0baca689e4376deefc145038d` |
| `src/app/__fixtures__/productionHubConnectionHarness.tsx` | `12e240192f92e4d1792708a7cde7558d2b8cfa1baed60384cc62d43ea3e7ae06` |
| `src/App.test.mjs` | `448e9e8d3b6532544c4106e465e3c12d60ef93742c1fbeccb5110593ee1acd12` |

The first `npm test` and `npm run build` runs used the test file before the two-line `globalThis.document` change. The hash above is the committed file. The rerun and negative control used the committed file.

## Not covered

Reconnect recovery is not claimed by this change or these tests.
The production surface subscription is a transport no-op today; its pending and failure cases exercise the `HubConnection` contract through a wrapped send, not a failing implemented production request.
Independent review is pending.
