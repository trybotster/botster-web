# Renderer telemetry repair

Status: implementation checks pass. Final independent review and publication remain pending.

Base revision: `9e18b1046b75438e971b9fe56a16137581ac2d1b`.
Branch: `foundation/web-readiness`.
Worktree: `/private/tmp/botster-web-foundation.sm0cZt/web`.

## Changes

Both renderer paths stop writing terminal payloads to DOM attributes.
The shared observer factory returns no callback when no harness terminal recorder exists.
Restty installs that optional observer when it mounts.
The fallback bridge creates its optional observer when it attaches.
The fallback does not create a telemetry completion callback when collection is disabled.

An enabled recorder receives one base64 payload per chunk.
The callback checks suppression before encoding.
The callback also rejects a replacement harness object before encoding.
Replacing the terminal array within the same harness remains supported.
Installing a harness after mounting requires remounting to enable collection.
Existing harness consumers install their recorder before mounting.

The change does not alter terminal decoding, input, transport framing, dependency pins, or reconnect behavior.
The active Hub integration matrix continues to use the unchanged Web revision.

## Executed checks

`node scripts/renderer-telemetry-test.mjs` passed under Node `v22.21.1`.
The test transpiles the production terminal module and exercises the actual fallback bridge.
It does not use a separate implementation of the observer.

The test verifies these cases:

- No recorder: output reaches the renderer with zero payload encodings and no payload attribute.
- Empty harness: the factory creates no observer.
- Suppressed recorder: output produces no telemetry encoding.
- Enabled recorder: one 65,536-byte chunk produces one exact encoded event.
- Replaced harness object: the old observer produces no telemetry.
- Deferred rendering: telemetry waits for successful write completion.
- Suppression or recorder replacement during a deferred write: completion performs no encoding.

`git diff --check` passed.
`node --check scripts/mounted-renderer-telemetry.mjs` passed.
Syntax checks do not establish mounted behavior.

## Independent source review

Astra found no blocking source defect in the initial telemetry patch.
The review checked both renderer paths and existing harness consumers.
The review required deferred-write coverage and actual mounted Restty coverage.
Root added the deferred-write tests and reran the focused test successfully.
The mounted test now passes against the actual Restty renderer.

## Final implementation checks

- `npm test`: exit 0. Protocol drift, telemetry tests, and application assertions passed. React act warnings remain in the output.
- `npm run build`: exit 0. This command runs TypeScript project checks and the Vite production build. Vite reports a large-chunk warning.
- `npm run lint`: exit 0, with zero errors and five warnings in unchanged files.
- `node scripts/mounted-terminal-keyboard-smoke.mjs`: exit 0. Disabled, enabled, and suppressed telemetry checks passed, followed by keyboard and exit-order checks.

Full test, build, and lint logs are `/private/tmp/botster-web-foundation.sm0cZt/web-tests.log`, `web-build.log`, and `web-lint.log`.
The mounted command result is recorded in the coordinator's tool output.
The browser runner closed its pages, browser, and Vite listener through its cleanup block.
No independent process-group cleanup audit was performed.

The first browser attempt could not write through a dependency symlink under the sandbox.
Root replaced that symlink with a private copy of the existing node_modules directory.
No dependency version changed. No package installation ran.
The next attempt could not bind a local port under the sandbox; the approved browser execution used the local listener.

The first two approved browser executions timed out in the new test's readiness condition.
The fixture had one output subscriber and a terminal runtime, but its initial ready text was absent.
That initial text is sent asynchronously during subscription setup and is not a reliable renderer readiness signal.
The corrected test waits for the runtime and subscription before emitting its own marker.
It then requires that exact marker in the actual viewport. The corrected mounted command passed.

## Required delivery checks

The full Web tests, build, lint, and mounted checks above have run.
To repeat the mounted check, run `node scripts/mounted-terminal-keyboard-smoke.mjs` with this worktree as the current directory.
The mounted script now checks two separate Restty mounts before its existing keyboard and exit-order checks.
One mount has no live recorder. The other mount has an enabled recorder and then suppresses collection.
Both mounts must render marker text through the terminal model.
The test reads viewport content independently of telemetry.
It also counts payload encodings and checks for absent payload attributes.

Review the final source and all executed evidence before publication.
Do not infer a measured throughput improvement from reduced encoding work.
Reconnect, startup isolation, and mounted large-paste repairs remain separate work within the foundation goal.
