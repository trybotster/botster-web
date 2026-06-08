# Restty terminal_view bridge plan

## Context loaded

Pipeline context loaded for run `run_1780957208_873675`, ticket `ticket_1780941197_102887`, current step `botster_plan`, and gate `botster_plan_gate`. Plan Review returned the ticket to Plan with open findings about plan durability, Restty acquisition, verification feasibility, lifecycle leak discipline, data-plane location, bridge interface scope, and acceptance mapping.

Vault and project context loaded:

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[plan steps need reviewable plan artifacts]]
- [[botster-web ionic supersedes catalyst for client shell]]
- [[restty is a client renderer not authoritative terminal infrastructure]]
- [[retained Restty instances leak memory when not destroyed before remount]]
- [[botster data plane bypasses the hub through session and client actors]]
- [[botster terminal clients share one sessionio data plane subscription path]]
- [[botster lua terminal apis expose subscriptions instead of pty forwarders]]
- [[botster terminal forwarder terminology is deprecated]]
- [[vendored restty uses relative chunk imports so no Vite alias is needed]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]

Repo context inspected:

- `package.json`
- `src/App.tsx`
- `src/App.test.mjs`
- `src/botster/client.ts`
- `src/botster/protocol.ts`
- `src/botster/terminal.ts`
- `src/botster/uiNodes.ts`
- `src/botster/UiFrameHost.tsx`
- `src/theme/app.css`
- `docs/architecture.md`
- `README.md`

Baseline verification before implementation passed:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build` with only Vite's existing large-chunk warning

## Scope

Implement the first `terminal_view` bridge for `botster-web` as a browser client renderer path.

In scope:

- Decide and implement how this repo obtains Restty.
- Extend the existing `TerminalViewBridge` seam in `src/botster/terminal.ts` to cover the ticket-scoped lifecycle: `mount`, `unmount`, `attach`, `detach`, `resize`, `focus`, input writes, and output subscription.
- Keep terminal input/output on a terminal data-plane adapter boundary, separate from `HubControlFrame` in `src/botster/protocol.ts`.
- Add a React terminal host used by the production app path in `src/App.tsx`, replacing the placeholder-only terminal panel.
- Add a mock/test terminal data-plane adapter for the scaffold smoke path.
- Add a Restty renderer adapter with dependency injection so tests can use a Restty-compatible fake without requiring real WebGL.
- Ensure Restty lifecycle cleanup calls `destroy()` before remounting or releasing the instance, and detaches listeners/closures.
- Propagate measured container size to terminal rows/columns and through the bridge resize path.
- Preserve Ionic layout constraints around the terminal container.
- Update README and architecture docs only where scaffold statements become stale.

Non-scope:

- No live Botster hub, WebRTC, session-worker, or real PTY integration.
- No terminal scrollback authority, recovery truth, snapshot truth, or backend parser ownership in the browser.
- No `terminal_view` registration as a `UiNode` primitive and no changes to `UiNodeRendererRegistry` for this bridge.
- No generic terminal cache, multi-tab retention policy, theme system, or adjacent app-shell refactor.
- No hub control-frame byte routing for terminal input/output.

## Restty acquisition and wiring decision

Use a package dependency that points at the `trybotster/restty` fork, not the botster monorepo's manual vendor-copy workflow.

Reasoning:

- The ticket explicitly names the `trybotster/restty` fork.
- `@trybotster/restty` is not published on npm.
- npm has `restty@0.1.35`, but using upstream npm would silently ignore the fork requirement unless a human confirms the fork and upstream package are equivalent.
- The existing vendoring workflow described by Botster vault notes is for the botster monorepo's `app/frontend/vendor/` shape, not this standalone Ionic/Vite repo.
- A Git dependency in `package.json` keeps this repo's acquisition decision explicit and reviewable without adding custom copy scripts.
- If implementation discovers the fork cannot be consumed directly because it does not ship built `dist/` artifacts or package metadata suitable for npm Git installs, stop and ask a human whether to vendor the built bundle or use npm `restty`.

Vite implications:

- If a vendored bundle becomes necessary, `[[vendored restty uses relative chunk imports so no Vite alias is needed]]` applies only if `restty.js` and every emitted `chunk-*.js` are copied together into the same directory.
- Do not add a Vite alias speculatively.

## Assumptions and unknowns

Assumptions:

- This ticket is scaffold-level browser integration: the terminal data-plane adapter is mockable and not wired to a live hub.
- Real browser pixel rendering through WebGL/WebGPU can be covered by a local demo if needed; automated test acceptance can use an injected Restty-compatible fake renderer.
- The production user path to prove is `src/App.tsx` rendering the terminal host, not only type declarations.
- Terminal subscription vocabulary is the correct model for browser terminal lifetime, even though this scaffold's adapter is mock-only.

Unknowns for implementer to resolve:

- Exact Restty public API for constructing a terminal, writing output, handling input, fitting/focusing, resizing, and destruction.
- Whether the `trybotster/restty` Git dependency exposes built artifacts directly enough for Vite/TypeScript consumption.
- Whether a lightweight DOM harness can be written with existing dependencies, or whether a test dependency such as Vitest/jsdom is needed. Do not claim actual Restty mount coverage from the existing source-text `npm test` harness.

## Affected surfaces and files

Likely files:

- `package.json`
- `package-lock.json`
- `src/botster/terminal.ts`
- `src/botster/client.ts`
- `src/App.tsx`
- `src/theme/app.css`
- `src/App.test.mjs`
- New terminal host or test support files under `src/botster/`
- `docs/architecture.md`
- `README.md`

Botster layers touched:

- React SPA / Ionic client shell
- Browser terminal renderer boundary
- Browser terminal data-plane placeholder adapter
- Tests and docs

Worktree and target assumptions:

- This plan applies to the current Project Pipelines run worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Do not include local absolute worktree paths in committed artifacts.

## Bridge shape

Extend the existing `TerminalViewBridge` in `src/botster/terminal.ts`; do not create a parallel bridge.

The seam should model:

- `mount(container, descriptor)` creates or attaches the renderer to a DOM container.
- `unmount(descriptor)` detaches listeners, unsubscribes output, detaches the terminal data-plane handle, calls renderer `destroy()`, and clears references.
- `attach(descriptor, dataPlane)` creates a terminal subscription-style mock data-plane handle for the session.
- `detach(descriptor)` releases the subscription-style handle.
- `resize(descriptor, rows, columns)` forwards measured rows/columns to the renderer and data-plane adapter.
- `focus(descriptor)` focuses the renderer/container.
- Input from Restty flows to the mock terminal data-plane adapter as bytes or strings through an explicit writer callback.
- Output from the mock terminal data-plane adapter reaches Restty through an output subscription callback.

The mock/test data-plane adapter should live with the terminal bridge test fixture, for example under `src/botster/terminal.ts` as narrow interfaces plus a mock implementation under `src/botster/terminalSmoke*` or `src/botster/__fixtures__` if the repo grows a fixture convention. It must not route terminal bytes through `HubControlFrame`.

## Risks

- Restty retention leak if unmount/remount fails to call `destroy()` before creating a replacement instance for the same container.
- Browser terminal state becoming authoritative if the bridge owns scrollback, snapshots, parser state, or recovery truth.
- Dependency ambiguity around `trybotster/restty` versus npm `restty`.
- Automated test overclaiming: the current `npm test` source-text harness cannot mount a DOM, canvas, WebGL, or actual Restty instance.
- Ionic layout corruption if the terminal canvas/container lacks stable sizing, overflow constraints, or flex min-size handling.
- Stale input/output listeners after session switches if cleanup is incomplete.

## Acceptance checks and tests

Required commands after implementation:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Acceptance mapping:

1. terminal_view renders through Restty

   - Production path: `src/App.tsx` must render the terminal host instead of a placeholder-only panel.
   - Automated smoke: mount the terminal host with an injected Restty-compatible fake renderer and assert the fake renderer is created through the same bridge path used by production.
   - Real Restty: if feasible in local browser demo, show the terminal container instantiates the real Restty adapter. If not feasible in automation due to WebGL/WebGPU, state that real-pixel rendering is local-demo-only for this ticket.

2. Input forwards through a mock client boundary

   - Smoke test triggers renderer input and asserts the mock terminal data-plane adapter receives the bytes/string for the expected session id.
   - Confirm this path does not create or receive `HubControlFrame` terminal byte messages.

3. Output is received

   - Smoke test emits output from the mock terminal data-plane adapter and asserts the renderer adapter receives a write call.
   - The output subscription cleanup must be asserted on unmount/detach.

4. Resize does not corrupt surrounding Ionic layout

   - Smoke test drives the resize measurement path and asserts rows/columns propagate to both renderer and mock data-plane adapter.
   - Add a DOM/layout-oriented assertion for stable terminal container classes or dimensions: the terminal panel keeps bounded height/min-width/overflow constraints and does not remove the existing `workspace-grid` / Ionic shell structure.
   - If a browser demo is used, verify desktop and narrow viewport terminal container sizing without overlap or layout breakage.

5. Destroy-before-remount lifecycle

   - Add a lifecycle smoke test that mounts, unmounts, and remounts the same terminal descriptor/container.
   - Assert the first renderer's `destroy()` is called before the second renderer is created.
   - Assert output subscriptions and input listeners from the first mount do not receive events after unmount.

6. Bridge contract remains separate from UiNode

   - Test or source assertion confirms `terminal_view` is not added to `UiNodeRendererRegistry` and is not represented as a `UiNode` primitive.
   - Docs continue to state Restty is a terminal renderer only, while UiNode/action/entity frames remain the dynamic product UI contract.

## Vault gaps worth capturing

No new durable vault knowledge needs capture from this planning pass. Existing notes already cover the important constraints: reviewable plan artifacts, Ionic shell decision, Restty as renderer only, Restty destroy lifecycle, Vite chunk behavior, and terminal subscription/data-plane ownership.

## Finding response summary

- `finding_1780957739_659651`: fixed by committing this repo-visible plan artifact and attaching it to the run.
- `finding_1780957739_813777`: fixed by explicitly choosing a Git dependency to the fork unless implementation proves that impossible and asks a human.
- `finding_1780957739_611427`: fixed by not claiming current `npm test` can mount real Restty; acceptance uses an injected fake renderer or a declared local-demo path for real WebGL.
- `finding_1780957739_799021`: fixed by adding destroy-before-remount risk and lifecycle test requirement.
- `finding_1780957739_844833`: fixed by locating the mock terminal data-plane adapter on the terminal bridge/test fixture side, outside hub control frames.
- `finding_1780957739_988833`: fixed by naming extensions on the existing `TerminalViewBridge` and keeping terminal_view out of UiNode.
- `finding_1780957739_285469`: fixed by mapping checks to each ticket acceptance criterion.
