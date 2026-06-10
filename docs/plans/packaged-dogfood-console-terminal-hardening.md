# Packaged dogfood console and terminal lifecycle hardening plan

## Context loaded

- Pipeline context: ticket `ticket_1781123809_105781`, run `run_1781124193_830411`, step `botster_plan`, gate `botster_plan_gate`, no prior artifacts, findings, questions, or answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Botster architecture context: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific constraints: [[plan steps need reviewable plan artifacts]], [[project pipelines checklist worker timeouts require artifact evidence fallback]], [[restty is a client renderer not authoritative terminal infrastructure]], [[retained Restty instances leak memory when not destroyed before remount]], [[botster web frontend is react catalyst and new wire entity store first]], [[botster-web ionic supersedes catalyst for client shell]], [[browser dogfood clients derive bridge url per runtime]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/botster/resttyRenderer.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/connectionDiagnostics.ts`, `scripts/real-hub-dogfood-bridge.mjs`, `README.md`, and prior `docs/plans/*`.
- Checklist evidence: `project_pipelines_create_vault_checklist` returned a plugin-worker timeout, but the checklist record was created as `checklist_1781124245_625389`. Its context and convention items were marked done; verification and capture stay pending for implementation/verify.

## Scope

In scope:

- Harden only `botster-web` packaged dogfood behavior.
- Add a harmless `/favicon.ico` response or package-served favicon so the packaged server no longer emits an unexpected favicon 404.
- Make Restty font configuration safe in packaged runtime when optional local developer fonts are absent. The fix should prefer a reliable packaged/browser fallback and treat optional local-font misses as expected only when they do not become fatal runtime errors.
- Make `TerminalViewHost` and `DefaultTerminalViewBridge` focus/mount lifecycle safe:
  - focus before mount must not throw or produce an unhandled rejection;
  - repeated focus events must not recurse into stack overflow;
  - unmount/remount must preserve destroy-before-remount cleanup and not leave stale subscriptions;
  - mount or renderer capability failure must render a bounded degraded diagnostic path instead of throwing.
- Strengthen the client harness so it exercises the real-hub dogfood flow without a browser: bridge transport, surface subscription, spawn action, daemon/entity/session frames, terminal descriptor/data-plane attachment, focus ordering, operator-error responses, degraded terminal mount, missing-font/package-runtime mode, repeated focus, and unmount/remount.
- Add a real packaged browser smoke command using an actual browser automation harness if practical. It must serve the compiled package runtime, open `/?dogfood=real-hub`, capture console/page errors, and fail on unexpected 404s, unhandled promise rejections, stack overflows, `terminal_view is not mounted`, and fatal Restty font errors.
- Document the smoke command and expected filtering for optional non-fatal local font warnings.

Non-scope:

- No edits to botster-hub, botster-core, TUI, session-worker, Rails, cloud, or WebRTC production transport.
- No replacement of Ionic, Restty, the entity store, or the existing daemon DTO bridge shape.
- No private terminal byte frames in `HubControlFrame`; terminal bytes stay behind `TerminalDataPlaneAttachment`.
- No broad UI redesign, speculative terminal cache, configurable font system, or package runtime refactor beyond what the console-error ticket requires.
- No mutation of the user's real Botster identity or durable home state; dogfood verification must keep using existing explicit bridge/socket/data-dir controls.

## Botster layers touched

- React/Ionic SPA shell.
- Browser terminal renderer boundary.
- Browser terminal data-plane adapter boundary.
- Same-device packaged dogfood bridge/server.
- Node client harness and real browser smoke harness.
- README/package scripts/docs only where needed to expose verification commands.

## Worktree and target assumptions

- This plan applies to the current Project Pipelines run worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repo-visible artifacts must use neutral worktree references and vault wikilinks, not local absolute paths.
- The current package runtime remains the intended production path to prove: compiled assets served by `scripts/real-hub-dogfood-bridge.mjs` and opened as `http://127.0.0.1:<port>/?dogfood=real-hub`.

## Assumptions and unknowns

Assumptions:

- The observed `terminal_view is not mounted` rejection comes from `TerminalViewHost` calling `bridge.focus(descriptor)` on focus before `DefaultTerminalViewBridge.mount()` has registered state.
- The focus stack overflow is a browser/Restty focus feedback loop: DOM focus calls bridge focus, bridge calls Restty focus, Restty or the container re-emits focus.
- The bridge server's static handler is the right place for the favicon fix because the observed 404 is from packaged runtime serving.
- Restty can run with `fontPreset: "none"` plus browser/default or packaged font sources without requiring local developer fonts.
- Browser automation is acceptable if it adds a minimal dev dependency such as Playwright after verifying the current latest package version, per the dependency-version convention. If that is too heavy for this slice, the implementer must ask a human before substituting weaker coverage.

Unknowns:

- Exact Restty option needed to suppress fatal `font load error - Unable to load any configured font source` without masking real renderer failure.
- Whether the packaged smoke should reuse the existing bridge script directly or add a narrowly named wrapper script that builds, starts the bridge on an ephemeral port, and launches the browser.
- Whether a real current hub binary/session-worker is available in the implementation environment. Harness tests should not depend on it; packaged browser smoke may use a fake daemon socket if it still proves compiled app/runtime/browser console behavior, and live-hub evidence should be added when binaries are available.

## Affected surfaces and files

Likely files:

- `scripts/real-hub-dogfood-bridge.mjs`: favicon/static handling and possibly smoke-friendly startup markers.
- `src/botster/resttyRenderer.ts`: packaged-safe Restty font fallback/configuration and renderer error normalization.
- `src/botster/TerminalViewHost.tsx`: focus guard, degraded diagnostic rendering/state, bounded resize/focus behavior.
- `src/botster/terminal.ts`: make focus/resize/write-before-mount no-op or diagnostic-safe where appropriate, preserve destroy-before-remount, add lifecycle tests for unmount/remount.
- `src/botster/realHubTerminalDataPlane.ts`: deterministic attach/detach lifecycle behavior if harness exposes stream ordering gaps.
- `src/App.test.mjs`: expand harness coverage from source assertions into behavior cases for real-hub dogfood mapping, terminal lifecycle, degraded paths, and package static favicon/runtime mode.
- `package.json` / `package-lock.json`: add a narrowly named browser smoke script and browser automation dependency only if the chosen runner is added.
- New smoke script under `scripts/` if needed, for example `scripts/packaged-browser-smoke.mjs`.
- `README.md`: document the browser smoke command, expected prerequisites, and allowed console warning filters.
- This plan artifact: `docs/plans/packaged-dogfood-console-terminal-hardening.md`.

## Implementation shape

1. Add regression-first Node harness cases.
   - Exercise `createDogfoodRuntimeConfig()` with package-runtime mode and real-hub mode without injecting away bridge URL construction.
   - Use daemon DTO fixtures to drive status/list/spawn/operator-error/session/entity updates.
   - Attach `RealHubTerminalDataPlane` to a fake bridge stream, emit terminal output, trigger resize/input/detach, and assert stream close semantics.
   - Drive `DefaultTerminalViewBridge` with a fake renderer through mount, focus before mount, repeated focus, attach, resize, unmount, remount, and degraded mount failure.

2. Fix static packaged runtime noise.
   - Serve `/favicon.ico` as either a small package asset or a deliberate `204 No Content`.
   - Add tests in the package bridge runtime harness that fetch `/favicon.ico` and assert it is not an unexpected 404.

3. Fix Restty packaged font behavior.
   - Configure the Restty adapter so package/runtime browser mode has at least one reliable non-local font path or a browser/default fallback.
   - Keep optional local developer fonts optional. Tests should assert the configuration does not request only unavailable local fonts and that fatal font errors are not emitted during smoke.

4. Fix terminal focus and degraded lifecycle.
   - Change focus-before-mount from throw/rejection into a bounded pending/no-op/diagnostic-safe behavior.
   - Add a reentrancy guard so focus events do not recursively call Restty focus.
   - Keep `destroy()` before replacing an existing renderer and verify stale listeners/subscriptions are removed.
   - Render a clear degraded diagnostic state from `TerminalViewHost` when renderer mount/attach fails, while allowing the rest of the dogfood UI to continue.

5. Add packaged browser smoke.
   - Prefer Playwright or the repo's chosen browser runner if one already exists. This repo currently has no browser runner.
   - If adding Playwright, first verify the current latest package version, then add the smallest dependency/script needed.
   - Build the app, start the package bridge on loopback, open `/?dogfood=real-hub`, collect browser console/page errors, and fail on the ticket's exact error classes plus unexpected 404s.
   - Filter only explicitly expected optional font warnings; do not filter fatal Restty font errors, unhandled promise rejections, stack overflows, or mounted-terminal errors.

## Risks

- Browser smoke can become too synthetic if it uses only static fetches or source assertions. It must actually open the compiled app in a browser and observe console/page errors.
- A fake daemon socket can prove packaged browser runtime but not live hub compatibility. If live binaries are unavailable, record that exactly and still keep deterministic harness coverage for daemon DTO mapping.
- Focus fixes can mask legitimate missing terminal state if every pre-mount operation silently succeeds. Prefer bounded no-op/diagnostic behavior only for lifecycle races the UI can recover from.
- Restty lifecycle changes can reintroduce retained renderer instances if remount creates before destroying the prior instance.
- Font-warning filters can hide real runtime defects if they match too broadly.
- Adding Playwright can be dependency churn; the ticket explicitly calls for actual browser automation if practical, so the dependency is acceptable only if scoped to this smoke path and latest version is verified.

## Acceptance checks and tests

Required implementation verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- New packaged browser smoke command documented in `README.md` and run during verification.

Harness acceptance:

- Real-hub dogfood client flow is covered without a browser: connect/subscribe, spawn action dispatch, daemon response mapping, entity/session updates, terminal descriptor/data-plane attach, terminal output/input/resize/detach, and operator-error responses.
- Degraded/error cases are deterministic: terminal mount failure, focus before mount, repeated focus events, missing packaged/local font fallback, unmount/remount, stream unavailable, and no unhandled `terminal_view is not mounted` rejection.
- Package bridge tests prove `/favicon.ico` is harmless and package runtime HTML still injects `__BOTSTER_PACKAGE_RUNTIME__`.

Browser smoke acceptance:

- The compiled package runtime is served over loopback and `/?dogfood=real-hub` loads in an actual browser.
- Captured console/page events fail the run for unhandled promise rejections, stack overflows, `terminal_view is not mounted`, fatal Restty font errors, and unexpected 404s.
- Optional local font warnings are either gone or explicitly expected with narrow filters.
- Terminal panel mounts cleanly or renders the degraded diagnostic without throwing.

Runtime path proof:

- `src/App.tsx` still constructs the production `dogfoodRuntime` through `createDogfoodRuntimeConfig()`.
- `TerminalViewHost` receives `dogfoodRuntime.terminalDataPlane` and `dogfoodRuntime.terminalDescriptor` in the production app path.
- The packaged smoke opens the same compiled package server path used by `npm run dogfood:hub`, not a test-only HTML page.

## Pipeline gates and artifacts

- Plan gate evidence should point to this plan artifact and the checklist record `checklist_1781124245_625389`.
- Plan Review should reject any implementation plan that drops browser smoke without a human answer, broadens scope into hub/core, or proves only source existence instead of runtime paths.
- Implement should attach exact command output for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the packaged browser smoke command.
- Verify should rerun the smoke command and inspect console/page-error filtering, not only trust the harness source.

## Vault gaps worth capturing

- Capture a new vault note if implementation settles a durable `botster-web` convention for packaged browser smoke tests.
- Capture a note if Restty has a stable packaged font fallback rule that should constrain future terminal renderer work.
- Capture a note if the focus-before-mount guard reveals a general Botster terminal lifecycle convention beyond the existing Restty destroy/remount note.
- No new durable convention was discovered during planning itself.
