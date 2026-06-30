# Open installed UI app surfaces from Apps view

## Context loaded

- Pipeline context: ticket `ticket_1782795779_894762`, run `run_1782795790_507079`, active step `botster_plan`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, answers, or dependencies were present in `project_pipelines_current_context`.
- Ticket intent: installed packages/apps that declare UI surfaces must be openable from the botster-web Apps view. The web client must consume authoritative hub app/surface/action DTOs, render an obvious open action for UI apps, send the correct `PluginSurfaceRender` or app-open request through the real hub bridge, and replace or navigate the main content area to the selected app surface instead of leaving users on the generic dashboard.
- Vault context loaded: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Repo context inspected: `src/App.tsx`, `src/botster/actions.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `README.md`, `docs/architecture.md`, and adjacent plan artifacts.
- Current baseline: `DaemonRequest` already includes `list_apps`, `plugin_surface_render`, and `plugin_surface_action`; `DaemonApp` and `DaemonPackageSurfaceDescriptor` are present in the generated protocol mirror. `realHubDogfoodTransport` already pulls `list_apps`, projects installed app rows into `botster-web.app`, projects package `surfaces` into package `app_surfaces/settings_surfaces`, and dispatches `botster.package.surface.render` through a real bridge `plugin_surface_render` request. The Apps UI still opens installed app rows as URL/terminal app launchers only, while plugin UI surface rendering is reachable from installed package rows. That leaves the ticket gap: installed UI apps in the Apps list do not expose an obvious in-place plugin surface open path.
- Checklist workflow: `project_pipelines_create_vault_checklist` was attempted for this run and hit a plugin worker timeout. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], vault-note provenance, convention-conflict status, verification plan, and capture disposition are preserved here and in gate evidence.

## Scope

- Keep the implementation surgical in the React/Ionic SPA and real-hub browser bridge. Do not add new hub primitives unless a verified authoritative DTO/request is missing.
- Make installed app rows in the Apps view open UI surfaces when the app/package is labeled as having a UI surface.
- Use authoritative hub DTOs only:
  - installed apps from `DaemonRequest { type: "list_apps" }` / `DaemonResponse.apps`;
  - package surface descriptors from `DaemonPackage.surfaces`;
  - package/app actions from `DaemonPackageActionState` request descriptors;
  - plugin surface render through `DaemonRequest { type: "plugin_surface_render", package_name, surface_id, payload }`.
- Join installed app rows to package app surface descriptors by `package_name` where the app DTO does not itself carry a surface descriptor. If the hub protocol has gained app-owned surface/open descriptors, prefer those generated fields after refreshing the protocol mirror.
- Render an explicit open affordance on installed app rows that have an app UI surface, with disabled/diagnostic state for terminal-only, blocked, missing URL, or missing surface cases.
- On opening a UI app surface, dispatch the existing `botster.package.surface.render` action or the hub-provided app-open action through `runtimeClient.actions.dispatch`, then show the selected rendered plugin surface in the Apps main content area.
- Change the main content from generic dashboard/status to the selected plugin surface result. A minimal first pass can replace the current "Rendered package surface" status panel with a selected app-surface panel under the Apps view; if the bridge returns a full `ui_tree_snapshot`, render it through the existing `UiNodeSurface`/registry path instead of only status text.
- Ensure project-pipelines or workspaces first-party UI surface is covered as the required acceptance target. Existing fixtures already include `project-pipelines` package surface `home`; live acceptance should prove at least that surface opens from Apps, not only from Installed packages.
- Update tests and smoke harnesses so the user path proves UI changed in the browser, not just bridge requests or console output.

## Non-scope

- No broad redesign of the dashboard, sidebar, terminal view, package settings, or marketplace/package management sections.
- No new local fixture-only protocol, synthetic app surface fields, or URL inference from package names, logs, ports, stdout, stderr, diagnostics, command args, or process state.
- No Rust hub/core/TUI/plugin changes unless implementation verifies the hub protocol lacks the request/DTO required to open UI app surfaces; if so, stop and ask/register a hub dependency.
- No migration away from generated daemon DTOs or descriptor-backed actions.
- No new dependencies, state library, routing framework, or speculative app registry abstraction.
- No checked-in PII, local usernames, socket paths, hub data dirs, or real user package state.

## Assumptions and unknowns

- Assumption: the current generated daemon protocol mirror is close enough to start, but implementer must run the protocol drift check against the authoritative hub-client artifact before relying on fields.
- Assumption: for current DTO shape, the reliable way to find a UI surface for an installed app is `DaemonApp.package_name` joined to the matching `botster-web.package.app_surfaces` descriptor.
- Assumption: opening a package app surface from an installed app row should use the existing descriptor-generated `botster.package.surface.render` action unless the refreshed DTO exposes a more direct app-open request.
- Assumption: web app URL opening through `launch_target.local_url` remains valid for non-plugin web apps; this ticket adds the UI surface path and should not regress plain URL web-app launch behavior.
- Unknown: whether live first-party `project-pipelines` or `workspaces` app rows carry `kind`/`launch_target` values that should be treated as web apps, plugin surfaces, or both. Tests should cover the package-surface join and live smoke should record the actual DTO shape.
- Unknown: whether `plugin_surface_render` returns only `plugin_surface` JSON status or a renderable `ui_tree_snapshot` for project-pipelines/workspaces in the real hub. If the response is not renderable enough to replace the content area, implementation should stop and ask for the hub dependency instead of inventing a browser-only fake.
- Worktree/target assumption: all work happens in this pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Convention conflicts: none found. The plan follows Botster SPA/entity-frame guidance, generated DTO authority, descriptor-driven actions, plugin-owned surface boundaries, and path-neutral vault citations.

## Affected surfaces/files

- Botster layers touched: React/Ionic SPA, browser real-hub bridge adapter, generated daemon DTO mirror/drift check, entity-frame read model, package/app component tests, packaged browser smoke, live packaged protocol harness, docs.
- `src/App.tsx`: Apps view row affordances, app-to-package-surface lookup, open handler behavior, selected surface state/rendering, sidebar app shortcuts if they remain launcher shortcuts.
- `src/botster/realHubDogfoodTransport.ts`: likely small changes only if app rows need to carry joined UI surface metadata, or if `plugin_surface_render` responses need to emit a renderable snapshot/frame in addition to action result status.
- `src/botster/generated/daemon-protocol.ts`: refresh only from authoritative generated hub-client artifact if drift is found.
- `src/botster/realHubDaemonDto.ts`: likely unchanged re-export seam.
- `src/App.test.mjs`: unit, projection, and rendered user-path coverage for installed app UI-surface open behavior and selected content rendering.
- `scripts/packaged-browser-smoke.mjs`: fake-daemon browser proof that clicking the installed app UI surface opens visible plugin content from the Apps list.
- `scripts/live-packaged-protocol-harness.mjs`: live hub proof for project-pipelines/workspaces UI surface opening from Apps, including visible browser assertion and no console/page errors.
- `scripts/real-hub-dogfood-bridge.mjs`: only if deterministic surface responses need to mirror authoritative live DTO behavior for packaged smoke.
- `README.md` and `docs/architecture.md`: update only stale wording after implementation if the Apps view behavior or acceptance command changes.

## Implementation outline

1. Run the existing drift/test baseline with an explicit authoritative hub-client artifact when available: `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<hub-client generated daemon-protocol.ts> npm test`. Refresh generated DTOs only from that artifact if drift is reported.
2. Add a small selector/helper in `src/App.tsx` that maps an installed app row to its matching package app surface descriptor by `package_name`, preserving URL/terminal diagnostics when no UI surface exists.
3. Update `AppListItem` to show a clear UI-open affordance when that helper finds a surface. Keep terminal and unavailable states visibly distinct.
4. Update `openApp` so UI-surface apps dispatch the descriptor-backed render action through `dispatchAction`; URL web apps still use `launch_target.local_url`; terminal apps and blocked/missing data show diagnostics without opening.
5. Track the selected/opened app surface result in Apps view state. Use the existing `readPluginSurfaceRenderStatus` path for status, and render a real `ui_tree_snapshot` through the existing registry if the response supplies one.
6. Make the Apps main content visibly change after a successful open. The assertion target should be selected package/surface title plus rendered body/snapshot, not only a toast.
7. Extend deterministic fixtures so an installed `project-pipelines` app row plus package `home` app surface can be opened from the Installed apps list.
8. Extend packaged browser smoke to click the installed app row/open affordance for project-pipelines or botster-web and wait for visible rendered plugin surface content.
9. Extend live packaged protocol harness to navigate to Apps, wait for `list_apps` and `list_packages`, click the first-party UI app surface (`project-pipelines` or `workspaces`), verify the bridge sent `plugin_surface_render` or authoritative app-open request, and assert the selected surface is visible in-browser.
10. Update docs only after code/tests prove the runtime path.

## Risks

- DTO drift risk: hand-maintaining app/surface fields would violate Botster protocol authority. Mitigation: use generated protocol drift checks and refresh from the hub-client artifact only.
- Underwired UI risk: dispatching `plugin_surface_render` without replacing Apps content would reproduce the bug. Mitigation: tests must assert visible selected surface content after clicking from Apps.
- Join ambiguity risk: installed app rows and package surface descriptors are separate DTO families. Mitigation: join only by exact `package_name`, prefer app-owned descriptors if the authoritative DTO exposes them, and show diagnostics when no exact surface exists.
- Plain web-app regression risk: existing `launch_target.local_url` behavior must still work for non-plugin web apps. Mitigation: keep URL tests and separate the UI-surface branch from URL launch branch.
- Terminal-app UX risk: terminal apps may be rendered as broken UI apps if the detection is too broad. Mitigation: preserve current terminal diagnostics and only show UI open when a real app surface descriptor/action exists.
- Live smoke fragility risk: the local environment may lack compatible first-party packages or hub binaries. Mitigation: implement deterministic browser smoke, and for live acceptance record exact binary/package/protocol blockers if they occur.
- PII risk: live hub diagnostics can include local paths. Mitigation: do not commit live logs; assertions should use package/surface names and generic visible text.

## Acceptance checks/tests

- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<path-to-authoritative-hub-client-generated-daemon-protocol.ts> npm test`
  - Protocol drift check passes or DTO refresh is explicitly made from the artifact.
  - Unit/projection tests prove app rows still come from `ListApps` and package app surfaces still come from `ListPackages`.
  - Component tests render `AppListItem` with and without a matched UI surface and show the correct open/disabled diagnostics.
  - User-path tests dispatch click/open from an installed app row and assert the action request is `plugin_surface_render` or authoritative app-open, with `package_name` and `surface_id` matching the DTOs.
  - Regression tests prove URL web apps still open `launch_target.local_url`, terminal apps do not open a URL, and legacy `view_surface/settings_surface` fields are not accepted as the contract.
  - Render tests assert selected plugin surface content appears in the Apps main content area after open.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run smoke:packaged-browser`
  - Must click an installed app UI surface from the Apps view and assert the browser shows selected plugin surface content, not only that the bridge request occurred.
- `BOTSTER_HUB_BIN=<path> BOTSTER_SESSION_WORKER_BIN=<path> npm run smoke:live-packaged-protocol`, or existing-hub equivalent with `BOTSTER_HUB_SOCKET`/`BOTSTER_HUB_DATA_DIR`
  - Must prove a real local dev-stack hub with first-party packages installed.
  - Must wait for `list_apps` and `list_packages`.
  - Must open at least `project-pipelines` or `workspaces` UI surface from Apps.
  - Must assert the selected plugin surface is visible in the browser and no unexpected console/page errors occurred.
- Manual fallback if live harness is blocked:
  - Record exact missing binary, package install, protocol mismatch, or hub DTO blocker.
  - Still provide deterministic component/transport/packaged-browser proof.
  - If the missing piece is a hub protocol request/DTO, ask/register the dependency instead of merging a fixture-only path.

## Vault gaps worth capturing

- Capture a Botster note after implementation if the app-to-package-surface join becomes the durable first-party client pattern for opening package UI surfaces from installed app rows.
- Capture a Botster note if the real hub exposes a direct app-open DTO/action that supersedes the package surface join.
- Capture a Botster note if live acceptance reveals a repeatable setup requirement for first-party `project-pipelines` or `workspaces` packages in botster-web smoke.
- No new note is needed for checklist timeout fallback; [[project pipelines checklist worker timeouts require artifact evidence fallback]] already covers this operational response.
