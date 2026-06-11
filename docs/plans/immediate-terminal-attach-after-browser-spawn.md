# Immediate terminal attach after browser spawn

## Context Loaded

- Project Pipelines context: ticket `ticket_1781139349_445499`, run `run_1781145937_671475`, step `botster_plan`, gate `botster_plan_gate`.
- Prior human answers: the old run/worktree mismatch was resolved by starting this fresh botster-web-targeted run; the sibling live harness dependency is closed and the harness is now present in this worktree.
- Vault notes: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan steps need reviewable plan artifacts]], [[identity]], [[goals]].
- Repo evidence: `scripts/live-packaged-protocol-harness.mjs` exists and still reloads immediately after spawn; `src/App.tsx` mounts `TerminalViewHost` with the real-hub data plane; `src/botster/TerminalViewHost.tsx` attaches the terminal data plane on mount; `src/botster/realHubTerminalDataPlane.ts` opens the terminal stream immediately and sends resize/input directly; `scripts/real-hub-dogfood-bridge.mjs` sends one attach request when `/terminal` opens.

## Scope

- Reproduce the race on current main by removing or disabling the post-spawn `page.reload()` in `scripts/live-packaged-protocol-harness.mjs`.
- Capture the exact failing browser harness event/request path before changing runtime behavior, especially whether failure comes from `/terminal` attach, resize, input, or a later stream drain.
- Make the smallest production-path change that lets the mounted terminal stream become attachable after the browser-dispatched spawn without a page reload.
- Update the live packaged protocol harness so it no longer reloads after spawn and asserts the absence of `operator_error`/`unknown_session` for the new session path.
- Add focused unit or smoke coverage around the changed TypeScript/bridge behavior, then run the live packaged protocol harness against a real local hub path.

## Non-Scope

- No new Botster protocol primitive unless reproduction proves the existing web package bridge cannot express the required behavior.
- No broad terminal architecture rewrite, Restty renderer changes, or migration away from the existing `TerminalDataPlaneAttachment` contract.
- No UI redesign, Project Pipelines plugin changes, or cleanup of unrelated diagnostics.
- No retry/backoff configurability unless needed to keep the harness deterministic.

## Botster Layers Touched

- React/Ionic SPA client shell: terminal mount and action dispatch path.
- Browser terminal data plane: `RealHubTerminalDataPlane` stream attach, resize, and input sequencing.
- Packaged real-hub dogfood bridge: `/terminal` SSE behavior only if the client needs attach error visibility or retry hooks.
- Live packaged harness: regression proof and workaround removal.

## Assumptions And Unknowns

- Assumption: this fresh run is correctly bound to the botster-web target and the assigned worktree is the current worktree.
- Assumption: the intended session id is the fixed dogfood id `botster-web-dogfood-session`.
- Assumption: the production-shaped path for this ticket is the packaged bridge plus real local hub harness, not the local mock dogfood transport.
- Unknown: the exact current failure signature after removing reload. The implementer must reproduce before deciding whether the fix belongs in the browser data plane, bridge SSE handling, or hub-facing request order.
- Unknown: whether attach before spawn returns a terminal stream `daemon_error`, a daemon `operator_error`, or just a closed stream. The plan requires recording this in the harness state.

## Affected Surfaces / Files

- `scripts/live-packaged-protocol-harness.mjs`: remove reload workaround, add no-unknown-session assertions and richer failure diagnostics.
- `src/botster/realHubTerminalDataPlane.ts`: likely home for durable attach intent, retry, or gating terminal control until the session is attachable.
- `src/botster/realHubDogfoodTransport.ts`: possible small change if spawn success/session lifecycle should notify the data-plane attach path.
- `src/botster/TerminalViewHost.tsx`: possible change only if attach should be deferred until a session-ready signal is available from props.
- `scripts/real-hub-dogfood-bridge.mjs`: possible change only if `/terminal` must surface attach errors in a typed way the browser can retry without losing the stream intent.
- `src/App.test.mjs`: focused assertions for whichever runtime path changes.
- `README.md` only if harness operation or the live verification command changes.

## Implementation Plan

1. First change only the harness locally to remove `page.reload()` after the spawn click and run the live packaged protocol harness against a real hub configuration. Keep the failing output, harness state, and daemon events as implementation evidence.
2. Add harness assertions that scan `__BOTSTER_LIVE_PROTOCOL_HARNESS__.events` and terminal events for `operator_error` or error payloads with `code === "unknown_session"` / `operation` in `attach`, `resize`, or `send_input`.
3. Fix the narrow race at the surface proven by reproduction:
   - If `/terminal` attach fails before the session exists, keep a browser-side terminal attach intent alive and retry/reopen the stream after spawn/session lifecycle rather than requiring a full page reload.
   - If resize or input fires before attachability, buffer or defer only terminal control messages for the target session until the terminal stream is attached.
   - If the bridge hides typed attach failures, expose enough structured SSE error detail for the data plane to retry deliberately, not by blind reload.
4. Preserve the existing architecture boundary: the browser/package bridge adapts to the real hub protocol, terminal bytes stay in the terminal data plane, and the UI action remains a semantic spawn action.
5. Remove the harness reload permanently and prove terminal ready output, input echo, resize proof, and clean exit on the live packaged path.

## Risks

- A blind retry loop could mask real attach failures or keep noisy sockets alive. It should be bounded, tied to mounted listener state, and stop on detach/unmount/process exit.
- Buffering input before the session exists could send stale user input to a later unrelated session if the session id changes. Keep buffering scoped to the fixed descriptor/session id and clear on detach.
- Moving spawn policy into `TerminalViewHost` would couple UI rendering to product workflow; prefer the data-plane/bridge boundary unless reproduction proves otherwise.
- The live harness depends on external hub binaries/configuration, so unit tests must cover control flow while the harness remains the acceptance proof.

## Acceptance Checks / Tests

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run smoke:packaged-browser`
- `npm run smoke:live-packaged-protocol` with a real local hub configuration, after removing the post-spawn reload.
- Verification evidence must include the production path: browser click dispatches spawn, terminal attaches/resizes without reload, terminal output includes `botster-web-dogfood-ready`, input echo works, resize proof returns the requested rows/columns, and no harness event records `unknown_session` for attach/resize/input.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation confirms a general rule such as "botster-web terminal attach intent must survive spawn/session visibility races" or "packaged bridge terminal SSE errors must be typed for retry." Do not capture until the exact failure surface is proven.
