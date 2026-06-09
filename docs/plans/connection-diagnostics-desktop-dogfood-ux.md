# botster-web connection diagnostics and desktop dogfood UX plan

## Context loaded

- Pipeline context: `ticket_1781040134_737435`, `run_1781040142_210037`, step `botster_plan`, gate `botster_plan_gate`; no prior artifacts, findings, questions, answers, or reviews were present.
- Required planner notes: [[planner-playbook]] and [[botster-planner-playbook]].
- Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Review-return context loaded: [[runtime client acceptance must render delivered snapshots through real registry]], [[botster-web should import canonical core uinode fixtures instead of mirroring them]], and [[botster core host profile compatibility checks stay deliberately narrow]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/dogfoodMode.ts`, `src/botster/localDogfoodTransport.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/theme/app.css`, `README.md`, `docs/architecture.md`, and prior plans under `docs/plans/`.
- Project Pipelines checklist: `checklist_1781040197_222971`. Creation initially returned a plugin worker timeout, but the checklist persisted and is usable.

## Scope

- Add an explicit connection diagnostics model in `src/botster/` that the production app can render for:
  - local hub unavailable or bridge request failure;
  - compatibility mismatch from the existing `DaemonStatus.schema_version` compared against the web client's expected daemon schema version, with any future richer compatibility descriptor kept additive;
  - control stream disconnected or failed after initial connection;
  - action failure and operator error frames;
  - terminal streaming unavailable or failed.
- Wire diagnostics into the real production user path in `src/App.tsx`: the app's `connect -> subscribe -> subscribeSurface -> entity pulls` flow must update visible control-plane diagnostics, while terminal-unavailable diagnostics are wired through the `TerminalViewHost` / `terminalDataPlane` seam that already renders outside that promise chain.
- Improve the primary desktop dogfood layout while preserving Ionic shell primitives and Restty terminal ownership:
  - clear session list/status region;
  - terminal region;
  - activity/error diagnostics panel;
  - action controls/status.
- Keep protocol use aligned with existing bridge/client seams:
  - web may adapt `DaemonRequest`, `DaemonResponse`, and `DaemonEvent` at the current bridge boundary;
  - terminal bytes stay behind `TerminalDataPlaneAttachment` and `TerminalViewHost`;
  - no private web-only durable hub protocol or `HubControlFrame` terminal byte variants.
- Extend `src/App.test.mjs` with automated coverage for unavailable, disconnected, action failure/operator error, terminal unavailable, schema-version compatibility mismatch, and desktop layout smoke.
- Update `README.md` with manual docs for running against the local hub bridge and interpreting each diagnostic state.

## Non-scope

- No changes to hub/core/TUI crates, daemon DTO definitions, or `botster-hub-client` behavior from this branch.
- No replacement of Ionic React shell primitives, no broad design-system migration, and no new frontend framework.
- No Restty renderer ownership changes and no browser-side terminal truth, scrollback truth, or session recovery truth.
- No new product workflow primitives or Project Pipelines plugin changes.
- No mutation of the user's real Botster identity or real Botster home state; real-hub dogfood remains isolated through the documented bridge/temp data-dir flow.

## Assumptions and unknowns

- Assumption: current bridge failures can be represented as diagnostics without changing the daemon DTO contract. Implementer should classify request exceptions and SSE/terminal attach failures at the adapter/app boundary.
- Assumption: `DaemonStatus.schema_version` is the compatibility signal available now. The web client should define its expected daemon schema version locally, compare it with the status response, and render a mismatch diagnostic from the actual real-hub path.
- Assumption: any future compatibility descriptor remains additive to the `schema_version` comparison rather than replacing it in this ticket.
- Assumption: desktop layout can be improved using existing CSS and Ionic components without adding dependencies.
- Unknown: exact future compatibility descriptor fields from the hub. Do not block this ticket on them; keep the consumer seam narrow and additive after the current `schema_version` check.
- Unknown: whether local implementer/verify environment has compatible `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN`; automated tests should cover deterministic fakes, while manual/live verification should record exact binary availability.

## Botster layers touched

- React SPA / Ionic shell: `src/App.tsx`, `src/theme/app.css`.
- Browser transport and bridge adapters: `src/botster/dogfoodMode.ts`, `src/botster/realHubDogfoodTransport.ts`, possibly `src/botster/localDogfoodTransport.ts`.
- Terminal browser data-plane seam: `src/botster/realHubTerminalDataPlane.ts`, `src/botster/TerminalViewHost.tsx` only as needed to surface terminal-unavailable diagnostics while preserving Restty ownership. This is separate from the hub connect promise chain.
- Tests/docs: `src/App.test.mjs`, `README.md`, possibly `docs/architecture.md` only if the diagnostics contract changes architecture-level boundaries.

## Worktree and target assumptions

- This run is bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and workspace `botster-web diagnostics desktop dogfood`.
- Implementer should work only in this ticket worktree and should not edit ambient Botster core/hub/TUI checkouts.

## Risks

- Diagnostics could become a private protocol if web code invents hub states instead of deriving from bridge errors, daemon DTOs including `schema_version`, terminal stream status, or a clearly future-facing additive compatibility descriptor slot.
- Desktop layout changes could regress mobile or resize behavior if the grid/flex min-size and terminal overflow constraints are loosened.
- Terminal-unavailable UI could accidentally catch errors while leaving Restty subscriptions or EventSource handles alive. Cleanup coverage must remain explicit.
- Source-presence tests in `App.test.mjs` can be tautological. New diagnostic tests must drive in-memory bridge/client fakes and assert rendered output with `renderToStaticMarkup`, not only add `assert.match()` checks over source text.
- Real-hub manual proof can be mistaken for production WebRTC proof. Docs must keep the bridge labeled as local dogfood harness only.

## Acceptance checks and tests

- `npm test`
  - drives bridge unavailable/request rejection through an in-memory fake and asserts rendered diagnostics via `renderToStaticMarkup`;
  - drives disconnected/stream failure state through an in-memory fake and asserts rendered diagnostics via `renderToStaticMarkup`;
  - drives operator error/action failure state through fake daemon responses/action results and asserts rendered diagnostics via `renderToStaticMarkup`;
  - drives terminal streaming unavailable/failure through a fake `TerminalDataPlaneAttachment` or bridge without `streamTerminal`, asserts rendered terminal diagnostic via `renderToStaticMarkup`, and verifies cleanup remains explicit;
  - drives a real `DaemonStatus.schema_version` mismatch through the fake bridge/status response and asserts the rendered compatibility diagnostic via `renderToStaticMarkup`;
  - renders delivered dogfood snapshots through the production `UiNodeSurface`/entity-store path for representative bound output, following [[runtime client acceptance must render delivered snapshots through real registry]];
  - covers desktop layout regions for sessions, terminal, activity/error diagnostics, and actions through rendered markup and structural CSS checks.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Boundary guard: `protocol.ts`, `localDogfoodTransport.ts`, and `realHubDogfoodTransport.ts` must still avoid private terminal byte frame names such as `terminal_input`, `terminal_output`, and `pty_bytes`.
- CSS media-query/mobile fallback evidence is structural only in this repo's current no-jsdom/no-vitest test stack. Do not overclaim runtime viewport verification unless the implementer adds a real browser test harness.
- Manual/live dogfood, if binaries are available:
  - start `npm run dogfood:hub` with explicit `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN`;
  - start `VITE_BOTSTER_REAL_HUB_DOGFOOD=1 npm run dev`;
  - open `http://127.0.0.1:5173/?dogfood=real-hub`;
  - confirm diagnostics for healthy bridge, spawned isolated session, invalid action/operator error, terminal ready marker or terminal-unavailable state, and cleanup on bridge shutdown.
- If live binaries are unavailable, record the exact missing prerequisite and do not present fake bridge tests as live-hub proof.

## Pipeline gates and artifacts

- Plan artifact: this file.
- Gate evidence should include this plan, checklist evidence, assumptions above, and the production entry point path through `src/App.tsx`.
- Implementation gate should include command outputs for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, plus live/manual evidence or exact unavailable-binary evidence.

## Vault gaps worth capturing

- Capture if implementation discovers a durable compatibility descriptor contract beyond the current `DaemonStatus.schema_version` comparison for same-device web clients.
- Capture if terminal stream failure diagnostics need a cross-client rule for distinguishing unavailable stream support from disconnected stream lifetime.
- No new vault note is needed from planning alone; existing notes cover the main boundaries: Ionic shell, entity frames, terminal data-plane ownership, bridge harness isolation, and Project Pipelines checklist timeout fallback.
