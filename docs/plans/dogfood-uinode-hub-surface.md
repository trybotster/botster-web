# Dogfood UiNode Hub Surface Plan

## Context Loaded

- Pipeline context: `ticket_1780941198_706138`, run `run_1780963809_287413`, step `botster_plan`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, workspace `botster-web dogfood UiNode hub surface`.
- Closed prerequisites: `ticket_1780941197_299829` (Ionic UiNode renderer registry), `ticket_1780941197_102887` (Restty terminal_view bridge), and `ticket_1780941198_256150` (hub connection, entity store, action dispatch skeleton).
- Gate prompt: attach plan evidence covering context, scope, assumptions, affected files, risks, acceptance checks, and vault gaps.
- Current repo context: this checkout is a focused standalone `botster-web` Vite/Ionic React app. The production entry point is `src/App.tsx`, which currently renders fixture UiNode/entity data and a mock terminal bridge.
- Vault/playbook context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Baseline verification: `npm test` passes with "Renderer seam, runtime behavior, and registry fixture assertions passed."

## Scope

Implement one real local-hub dogfood surface in `botster-web` using the existing shared contracts:

- Prefer a session spawn/attach surface because it proves `ui_tree_snapshot`, entity frames, semantic action dispatch, form validation/error state, and `terminal_view` in one user path.
- Wire the production app path so the visible first screen uses the runtime client and chosen surface data instead of only `uiNodeConformanceSnapshot` fixtures.
- Keep hub interaction behind `src/botster/client.ts`, `src/botster/protocol.ts`, `src/botster/entities.ts`, `src/botster/actions.ts`, and the existing terminal bridge. Add only the narrow adapter needed for local hub connection.
- Render success, pending, validation, and transport/error states through UiNode/Ionic primitives, not bespoke product HTML for dynamic state.
- Document local-only commands for running `botster-web` against a local hub, exercising a successful action, seeing validation/error state, and mounting terminal output if the session-based path is used.
- Extend tests so they prove runtime behavior: the app consumes hub frames, renders the chosen surface through `UiNodeSurface`, dispatches an action request, handles an action result/error, and preserves the terminal bridge boundary.

## Non-Scope

- No cloud, Rails, ActionCable, or public hosting work.
- No new workflow primitives or Botster core policy.
- No broad UiNode v2 contract redesign, renderer replacement, or duplicate terminal primitive inside UiNode.
- No broad visual redesign of the shell beyond the layout needed for a desktop-quality dogfood surface.
- No PII or real user/repo data in fixtures, docs, tests, screenshots, or default UI copy.
- No dependency upgrades unless implementation discovers the existing pinned packages cannot support the ticket. Dependency versions must be looked up before changing.

## Assumptions And Unknowns

- Assumption: the closed prerequisite tickets are present in this worktree. The current code shows the expected seams: `createBotsterWebClient`, `InMemoryEntityFrameStore`, `CorrelatedActionDispatcher`, `IonicUiNodeRenderer`, and `TerminalViewHost`.
- Assumption: local hub support can be reached through a local-only transport adapter or documented dev fixture without adding cloud/Rails policy to the client shell.
- Assumption: the production path to prove is `src/App.tsx`; code existing under `src/botster/*` alone is insufficient.
- Unknown: the exact local hub browser transport shape available to this standalone repo. Implementer must inspect the current Botster local hub contract before choosing WebSocket, local static config, or a fixture-backed local adapter.
- Unknown: whether session spawn/attach is stable enough from the standalone web client. If not, use package/plugin configuration only after documenting the reason and still proving success and validation/error states through UiNode/action/entity contracts.
- Unknown: whether terminal output can be mounted from real session egress in this repo without additional core APIs. If session attach is unavailable, keep terminal bridge wired with a clearly documented local fixture and record why the ticket is intentionally not fully session-based.

## Affected Surfaces And Files

- `src/App.tsx`: replace fixture-only first screen with the chosen dogfood surface and runtime state wiring.
- `src/botster/client.ts`: likely add narrow helpers for view startup, replay, and local transport integration while preserving injected-transport tests.
- `src/botster/protocol.ts`: add only frame kinds/payload typing needed for the selected local hub path.
- `src/botster/entities.ts`: use existing entity snapshots/deltas; only extend if selected surface needs scoped pulls or binding behavior not already covered.
- `src/botster/actions.ts`: use existing semantic action correlation; add presentation state only if needed for pending/result feedback.
- `src/botster/IonicUiNodeRenderer.tsx` and `src/botster/UiNodeSurface.tsx`: add minimal event dispatch or action result presentation needed to make buttons/forms perform real actions.
- `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, and `src/botster/resttyRenderer.ts`: preserve `terminal_view` as terminal-only renderer; connect it to real session data-plane only if available.
- `src/theme/app.css`: layout adjustments for dense desktop Ionic workbench and responsive constraints.
- `README.md` and possibly `docs/architecture.md`: local hub dogfood commands, transport assumptions, and the exact chosen runtime path.
- `src/App.test.mjs`: extend string, runtime, SSR, and smoke assertions for the dogfood surface and docs.

## Risks

- The app may remain fixture-driven if the Implementer only adds more sample snapshots. Acceptance requires the visible production path to consume the runtime client or an explicitly documented local-hub adapter.
- Session spawn/attach may require core APIs absent from this standalone checkout. The fallback must be explicit and narrower, not a silent downgrade.
- Mixing terminal bytes into `HubControlFrame` would violate the terminal data-plane boundary. Terminal output must stay behind `terminal_view` and a session/client data-plane adapter.
- Adding product-specific stores for plugin/session state would violate the entity-frame-first client contract. Dynamic state should remain in entity frames and action results.
- UiNode action handlers can drift into DOM event vocabulary. Action ids must remain semantic Botster intents.
- Documentation can overclaim "real hub" behavior if the path is fixture-backed. Local commands must name exactly what is real and what is scaffolded.
- Checklist persistence timed out during planning, so gate artifacts must carry the workflow evidence fallback.

## Acceptance Checks And Tests

- `npm test`: extend and keep passing. It should assert that the production app imports and mounts the dogfood surface, no longer relies only on `uiNodeConformanceSnapshot`, dispatches semantic `action_request` frames, applies `action_result` success and error state, and preserves `terminal_view` outside UiNode/protocol control frames.
- `npm run typecheck`: verify TypeScript contract changes.
- `npm run lint`: verify React/Ionic code quality.
- `npm run build`: prove the Vite/Ionic production bundle compiles.
- Manual/local command evidence in `README.md`: commands to start the local hub or documented local fixture, start `botster-web`, open the chosen route, perform a successful action, trigger validation/error state, and confirm terminal output if session-based.
- Runtime path proof: document where `src/App.tsx` constructs or receives `createBotsterWebClient()` state and where the surface subscribes/pulls/renderers consume hub frames.
- If session-based: prove terminal mounting with local hub session output. If fallback-based: document the missing hub support and prove the selected package/plugin configuration action path instead.

## Vault Gaps Worth Capturing

- Capture a new vault note only if implementation discovers a durable local-hub browser transport rule not already covered by [[botster client subscriptions should not hydrate global state]], [[botster wire v2 clients must consume ui tree snapshots and render composites with entity stores]], or terminal data-plane notes.
- Capture a new vault note if `botster-web` needs a repo-specific local hub command convention that should survive this ticket.
- No convention conflict found in planning. The checklist-create timeout matches existing [[project pipelines checklist worker timeouts require artifact evidence fallback]], so this plan and gate submission carry the checklist evidence fallback.
