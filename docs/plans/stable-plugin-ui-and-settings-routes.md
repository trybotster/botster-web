# Stable plugin UI and settings routes

## Context loaded

- Pipeline context: ticket `ticket_1783189391_195226`, run `run_1783206619_278009`, active step `botster_plan`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, answers, or open dependencies were present. Three dependency tickets are closed: stable hub route contracts, real workspaces surfaces, and real project-pipelines surfaces.
- Ticket intent: botster-web must open plugin UI and settings as first-class routable pages. A click from Apps must change the browser URL, replace the main content area with the plugin app/settings view, and refresh/direct URL load must reconnect to the hub, hydrate state, resolve the route, and render the same view.
- Vault context loaded: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], and [[plan agents must author vault context as wikilinks not home paths]].
- Repo context inspected: `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/actions.ts`, `src/packageConfigurationForm.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `docs/plans/open-installed-ui-app-surfaces-from-apps-view.md`, and `docs/plans/wire-botster-web-dev-stack-package-app-settings-surfaces.md`.
- Current baseline: `AppView` only distinguishes `/dashboard`, `/apps`, and `/diagnostics`. Opening plugin UI dispatches `botster.package.surface.render` and stores `selectedPluginSurface` in React state, then renders it inside the Apps page. Package settings are shown in an `IonModal` keyed by `settingsPackageId`. Neither selected plugin surface nor settings modal is URL state, so refresh/direct load loses the selected plugin UI/settings context.
- Current protocol baseline: generated daemon DTOs include `list_apps`, `list_packages`, `set_package_configuration`, `plugin_surface_render`, and package `surfaces`. `realHubDogfoodTransport` projects package `surfaces` into `app_surfaces` and `settings_surfaces`, creates descriptor-backed `botster.package.surface.render` actions, projects configuration fields from hub schema/effective values, and refreshes package entities after configuration save.
- Botster layers touched: React/Ionic SPA, browser real-hub adapter only if route diagnostics need projected fields, generated DTO drift check, deterministic browser smoke, live packaged protocol harness, and docs/tests.
- Worktree/target assumption: implementation happens in this pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.

## Scope

- Add a small route model for stable plugin pages while preserving the current Ionic React shell:
  - `/dashboard`
  - `/apps`
  - `/apps/:packageName/:surfaceId` for plugin app UI surfaces
  - `/apps/:packageName/settings` for package settings/configuration
  - optionally `/apps/:packageName/settings/:surfaceId` if a package exposes multiple settings surfaces and the selected settings surface itself must render.
- Make Apps list clicks call a route navigation helper first, not only set local selected state. The production entry point must be browser history plus hydrated hub state.
- On route changes, resolve route params against hydrated `botster-web.package` and `botster-web.app` records from real hub DTOs. Prefer exact `package_name` plus descriptor `surface_id`; show an in-page diagnostic when package/surface is missing, disabled, blocked, or has no render action.
- Render plugin app UI as the Apps main content page, not a footer/banner/card at the bottom. Keep the Apps list/navigation available in the shell, but the active content should clearly be the selected plugin page.
- Convert package settings from modal-only state to a routable main-content settings page. Reuse `PluginSettingsPanel`, `GenericConfigurationForm`, `RemoteAccessConfigurationItem`, `configurationSaveAction`, and existing descriptor-backed package actions.
- Preserve package configuration behavior: form fields come from hub schema/effective values, saves send `set_package_configuration`, validation errors/diagnostics render visibly, and successful save refreshes `botster-web.package`.
- Refresh/direct URL load must reconnect through the current runtime, pull `botster-web.app` and `botster-web.package`, resolve the route, and dispatch the surface render exactly once for the active plugin app route.
- Keep URL web-app launch and terminal-app diagnostics working for non-plugin app rows.
- Add missing/disabled/blocked diagnostics in-page for direct URLs and click paths.
- Keep generated hub DTOs authoritative. Refresh `src/botster/generated/daemon-protocol.ts` only from the authoritative hub-client artifact if drift is detected.

## Non-scope

- No new routing library unless the existing history helpers become unreasonably complex; a small local route parser is sufficient for this shell.
- No Rust hub/core/TUI/plugin changes unless the generated hub DTOs are missing required route descriptors after drift check. If that happens, stop and ask/register a dependency instead of inventing browser-only fields.
- No browser-only DTO guesses, fixture-only route contracts, package-name allowlists, or inference from stdout, local URLs, ports, process state, diagnostics, or package source paths.
- No broad dashboard/sidebar redesign, operator workbench work, marketplace lifecycle redesign, terminal transport changes, or WebRTC subscription refactor.
- No dual old/new route vocabulary beyond a short internal helper split. Avoid carrying legacy selected-surface modal paths as a second product flow.
- No checked-in local paths, socket paths, hub data dirs, or PII.

## Assumptions and unknowns

- Assumption: closed dependency tickets mean the hub now exposes stable plugin app/settings surface descriptors and first-party project-pipelines/workspaces packages declare real UI/settings surfaces.
- Assumption: current botster-web should use package `surfaces` projected from `DaemonPackage.surfaces` as the route authority unless the refreshed DTO exposes a stronger app-owned route descriptor.
- Assumption: the canonical path should encode package and surface ids from authoritative DTO fields, not display titles. Use URL encoding for path segments and decode before exact matching.
- Assumption: `/apps/:packageName/settings` opens configuration and package settings; if there are multiple settings surfaces, render the settings index with actions or use `/apps/:packageName/settings/:surfaceId` for a selected settings surface.
- Unknown: whether `plugin_surface_render` for real first-party surfaces returns `ui_tree_snapshot` consistently or only `plugin_surface` status. If not enough data is returned to render a first-class view, implementation must document the hub blocker and ask rather than fake content.
- Unknown: whether route descriptor names are already present in refreshed generated DTOs. If they exist, the implementer should prefer them over locally assembled paths and update this plan during implementation handoff.
- Unknown: whether live smoke environment has compatible `BOTSTER_HUB_BIN`/`BOTSTER_SESSION_WORKER_BIN` or an existing hub with the needed first-party packages enabled. If blocked, record the exact blocker and still provide deterministic smoke coverage.
- Convention conflicts: none found. The plan follows Botster SPA/entity-frame guidance, generated DTO authority, plugin-owned UI boundaries, and path-neutral vault citation rules.

## Affected surfaces/files

- `src/App.tsx`: route parser/formatter, active route state, navigation helpers, Apps row click handlers, sidebar shortcuts, plugin app route resolver, settings route resolver, in-page diagnostics, selected surface rendering, settings page rendering, removal or downgrading of modal-only settings flow.
- `src/botster/realHubDogfoodTransport.ts`: likely unchanged, unless route diagnostics need package availability/action details already present in daemon DTOs but not projected into entity records.
- `src/botster/generated/daemon-protocol.ts`: refresh only from authoritative hub-client generated artifact when drift check proves mismatch.
- `src/packageConfigurationForm.ts`: likely unchanged; reuse for settings route saves.
- `src/App.test.mjs`: update source/regression assertions from modal-only settings to routable settings and add route parser/direct-load behavior checks.
- `scripts/packaged-browser-smoke.mjs`: update fake-daemon browser proof for stable plugin app and settings URLs, refresh preservation, successful and invalid settings saves, and visible in-page diagnostics.
- `scripts/live-packaged-protocol-harness.mjs`: add real-hub proof that Apps click changes to a stable plugin URL, direct reload preserves plugin app route, settings route opens, save/validation round trips render, and existing terminal/WebRTC reload smoke remains green.
- `README.md` and `docs/architecture.md`: update only if verified runtime behavior or documented commands change.

## Implementation outline

1. Run the protocol drift check with `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` pointed at the authoritative hub-client artifact when available. Refresh generated DTOs only from that artifact if needed.
2. Introduce a local route type such as dashboard/apps/diagnostics/plugin-app/plugin-settings and replace `AppView` string parsing with route parsing that preserves the stable URL path.
3. Add route URL builders for plugin app and settings pages using exact DTO ids: package name plus app/settings surface id.
4. Change `navigateToView`, Apps rows, sidebar app shortcuts, and settings buttons to push route URLs. For route-only changes, let the route resolver perform render/open behavior after hydration.
5. Split plugin app resolution into a helper that takes the active route plus `packages`/`installedApps`, finds the exact package and surface descriptor, and returns either a descriptor-backed render action or a typed diagnostic.
6. Add an effect that runs after package/app entity hydration and active route changes. For plugin app routes, dispatch `botster.package.surface.render` once per route key and store the rendered snapshot/status. Guard against duplicate dispatches across re-renders and reconnects.
7. Replace the selected plugin surface card inside the Apps index with a route-owned page region. It should show loading, missing package, missing surface, disabled/blocked, action failure, or rendered `UiNodeSurface`/status as full main content.
8. Replace `IonModal` settings with a route-owned settings page that reuses `PluginSettingsPanel`. The settings button should navigate to `/apps/:packageName/settings`; close/back should navigate to `/apps`.
9. Keep configuration save dispatching through `botster.package.configuration.save`, refresh `botster-web.package` after success/failure, and render returned validation errors from the refreshed package fields.
10. Update deterministic fake daemon and browser smoke to exercise app route and settings route by URL, including `page.reload()` on each.
11. Update live packaged protocol harness to prove the real route flow: Apps click -> URL change -> `plugin_surface_render` request -> visible plugin content -> refresh same URL -> same content; then settings route save success/error -> refresh same settings URL -> fields/errors still visible.
12. Run typecheck/lint/build/smokes and record any live-hub blocker precisely.

## Risks

- Route hydration race: direct URL load may resolve before package/app entities arrive. Mitigate with explicit loading state and route resolution only after entity pulls finish or fail.
- Duplicate action dispatch: React effects can rerun after entity updates or reconnect. Mitigate with route-key/request-key tracking and clear it only when route changes or transport reconnect requires replay.
- DTO drift: local assumptions about `surfaces`, `configuration`, or app ids may be stale. Mitigate with authoritative protocol drift checks before implementation.
- Settings regression: moving from modal to page can break existing form interactions and tests. Mitigate by reusing the current settings panel/form code and changing only ownership/navigation.
- Plugin route ambiguity: package name, app id, and surface id can differ. Mitigate by exact package/surface matching, visible diagnostics, and preferring hub-provided route descriptors if present.
- Plain app regression: non-plugin web apps using `local_url` and terminal apps should keep current behavior. Mitigate with explicit regression tests.
- Live smoke fragility: real hub/package availability may vary. Mitigate with deterministic smoke plus exact live blocker evidence when the environment is missing required binaries/packages.
- Terminal reload regression: plugin route refresh work must not duplicate terminal subscriptions or input handlers. Mitigate by keeping terminal route code isolated and rerunning existing mounted terminal/WebRTC smokes.

## Acceptance checks/tests

- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<authoritative hub-client daemon-protocol.ts> npm test`
  - Protocol drift passes or generated DTO refresh is explicit.
  - Route parser/builders cover `/apps`, `/apps/:package/:surface`, `/apps/:package/settings`, unknown package, unknown surface, URL encoding, and browser back/forward.
  - Installed app/package rows still come from `ListApps`/`ListPackages`.
  - Clicking an app UI row pushes a stable plugin URL and dispatches the descriptor-backed `plugin_surface_render` request.
  - Direct plugin app URL load after hydration renders the same surface in main content.
  - Settings button pushes `/apps/:package/settings`, renders configuration fields from hub schema, sends `set_package_configuration`, shows validation errors, and refreshes package state.
  - Non-plugin URL web apps and terminal apps keep their existing diagnostics/launch behavior.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run smoke:packaged-browser`
  - Deterministic fake-daemon browser proof must click a plugin UI app, assert URL path changes, assert main content renders plugin surface, reload the same URL, and assert it rehydrates.
  - Must open settings route, perform successful save and invalid save, assert visible validation/diagnostic round trip, reload settings URL, and assert context persists.
- `BOTSTER_HUB_BIN=<path> BOTSTER_SESSION_WORKER_BIN=<path> npm run smoke:live-packaged-protocol`, or existing-hub equivalent with `BOTSTER_HUB_SOCKET`/`BOTSTER_HUB_DATA_DIR`
  - Must prove a real local hub with first-party packages.
  - Must open Apps, click project-pipelines/workspaces/botster-web UI, observe stable URL and visible main-content plugin UI, refresh successfully, then open settings route and prove save/error/refresh behavior.
  - Must keep existing WebRTC reload/terminal smoke green, including no duplicated `send_input`, subscriptions, or renderer input handlers after route refresh.

## Vault gaps worth capturing

- Capture a Botster note if this implementation establishes a durable canonical URL shape for package app/settings surfaces.
- Capture a Botster note if the refreshed hub DTOs expose route descriptors that replace local path assembly.
- Capture a Botster note if route-key dispatch/replay becomes the general SPA pattern for plugin surface refresh across reconnects.
- Capture a Botster note if live first-party package setup has a repeatable acceptance prerequisite not already documented.
