# Wire botster-web to dev-stack package app and settings surfaces

## Context loaded

- Pipeline context: ticket `ticket_1782761742_194150`, run `run_1782761800_809116`, active step `botster_plan`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, answers, or dependencies were present in `project_pipelines_current_context`.
- Ticket intent: make `botster-web` useful as the local dev-stack client shell by consuming authoritative hub-client DTOs for package, app, and config state; showing installed first-party packages; opening plugin app surfaces; exposing package settings and validation results; and invoking hub package lifecycle actions instead of local fixtures or inferred state.
- Vault context loaded: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], and [[botster orchestration prompts must bind agents to explicit worktrees]].
- Repo context inspected: `README.md`, `docs/architecture.md`, `docs/plans/render-hub-provided-apps-and-open-actions.md`, `docs/plans/marketplace-package-lifecycle-dependency-gates.md`, `docs/plans/web-app-package-readiness-url.md`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/check-daemon-protocol-drift.mjs`, and `botster-package.json`.
- Current repo baseline: much of the ticket is already scaffolded or partially implemented. The real-hub transport uses generated daemon DTOs, pulls `list_apps` and `list_packages`, projects app/package entity families, renders installed apps and packages, supports descriptor-backed package surfaces, provides package action bindings, and documents the package app path. The remaining work should close gaps between "code exists" and "dev-stack shell acceptance is proven against a real local hub."
- Checklist workflow: `project_pipelines_create_vault_checklist` was attempted and hit a plugin worker timeout. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], vault-note provenance, convention-conflict status, verification plan, and capture disposition are recorded in this plan and should be repeated in gate evidence.

## Scope

- Verify and tighten the production real-hub path from `src/App.tsx` through `createDogfoodRuntimeConfig()`, `createRealHubDogfoodTransport()`, the bridge, and rendered Ionic surfaces. Source-only evidence is not enough.
- Keep `src/botster/generated/daemon-protocol.ts` as the authoritative DTO mirror from `botster-hub-client`; refresh only from generated artifacts if drift is found. Do not hand-maintain protocol fields.
- Ensure the app launcher uses `DaemonRequest::ListApps` / `DaemonResponse.apps` rows as the installed app source, including plugin app surface behavior and diagnostics for terminal or blocked apps.
- Ensure the package/settings surface uses `DaemonRequest::ListPackages`, package `surfaces`, package `configuration`, and descriptor-backed `plugin_surface_render` for settings surfaces when present.
- Ensure package configuration saving sends `DaemonRequest::SetPackageConfiguration` with submitted values only, renders hub-returned validation results or diagnostics, and handles omitted optional DTO fields.
- Ensure package lifecycle/action controls are rendered only from hub-returned action descriptors and dispatch the descriptor request shape. This includes install, enable, disable, remove, start, stop, restart, update/check/update-preview/apply where the generated DTO exposes them.
- Extend executable tests and smoke harnesses so acceptance proves a real local hub path can display package/app state, open at least one plugin surface, show settings metadata, and report lifecycle/action diagnostics without relying on browser-console-only evidence.
- Update `README.md` and `docs/architecture.md` only if implementation discovers stale wording about the runtime path.

## Non-scope

- No broad Ionic shell redesign, dashboard redesign, or speculative operator-workbench work.
- No Rust hub/core/TUI changes unless the current generated DTOs are missing fields required by the ticket; if so, stop and register/ask for the dependency instead of inventing browser fields.
- No new transport protocol. The same-device bridge remains a dev/test harness around daemon DTOs, not production WebRTC parity.
- No browser inference from package names, stdout, stderr, known ports, local fixtures, process guesses, or hard-coded first-party package lists.
- No new package dependency, state-management library, or custom protocol abstraction.
- No checked-in PII, local usernames, socket paths, hub data dirs, or real user package state.

## Assumptions and unknowns

- Assumption: the current hub-client generated protocol already includes the relevant app, package, surface, configuration, marketplace, and lifecycle request/response DTOs shown in this repo.
- Assumption: `botster-web` should remain an Ionic React shell over structured state, with Restty only as terminal rendering.
- Assumption: first-party package display should come from hub-returned package/app rows and trust/classification fields, not from a browser-maintained allowlist.
- Assumption: package settings metadata means both descriptor-backed settings surfaces and package configuration schema/field metadata when present.
- Unknown: whether the local implementation environment has a compatible `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` available for live smoke. If not, implementer must record the exact blocker and still provide deterministic transport/component tests.
- Unknown: whether current hub validation failures return configuration-specific diagnostics, package decisions, operator errors, or generic diagnostics. Implementation should render whatever authoritative DTO shape is returned instead of normalizing it into a fake form API.
- Worktree/target assumption: all implementation happens in this pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Convention conflicts: none found. The plan follows generated DTO authority, Botster SPA/entity-frame contracts, descriptor-driven actions, plugin-owned policy boundaries, and path-neutral vault citations.

## Affected surfaces/files

- Botster layers touched: React/Ionic SPA, browser real-hub adapter, generated daemon DTO mirror, bridge smoke harness, package manifest, docs, and tests.
- `src/App.tsx`: app/package/settings rendering, action dispatch status, settings modal, configuration form/value handling, visible diagnostics.
- `src/botster/realHubDogfoodTransport.ts`: daemon request dispatch, app/package/config/surface/action entity projection, action descriptor forwarding, response diagnostics.
- `src/botster/generated/daemon-protocol.ts` and `src/botster/realHubDaemonDto.ts`: generated DTO source of truth and re-export seam.
- `src/App.test.mjs`: executable assertions and rendered component/user-path tests for app/package/settings/action behavior.
- `scripts/packaged-browser-smoke.mjs`: fake daemon/package-runtime smoke should cover installed packages, installed apps, settings surface render, configuration validation/action diagnostics, and lifecycle action visibility.
- `scripts/live-packaged-protocol-harness.mjs`: live hub smoke should assert `list_apps`, `list_packages`, plugin surface render, settings/config metadata, lifecycle/action diagnostics, and absence of browser/page errors.
- `scripts/real-hub-dogfood-bridge.mjs`: only if the bridge fake/live adapter is missing deterministic dev-stack responses for the package settings and plugin surface acceptance path.
- `botster-package.json`: confirm the local `botster-web` package continues to declare app and settings surfaces plus the `web-client` runnable entrypoint.
- `README.md` and `docs/architecture.md`: update after code if runtime evidence or wording changes.

## Implementation outline

1. Run the existing drift/test baseline enough to identify whether the current generated DTO mirror is current. If drift exists, refresh from the generated hub-client artifact instead of editing DTOs by hand.
2. Audit `daemonResponseFrames()`, `packageRecord()`, `appRecord()`, `dispatchDaemonAction()`, and descriptor conversion to ensure all package lifecycle/settings/plugin surface actions forward the descriptor-provided daemon request shape.
3. Make settings/config metadata user-visible in the settings modal, including required markers, effective values, missing-required validation, redacted secret replacement behavior if represented in the DTO, and hub diagnostics after save.
4. Ensure `plugin_surface_render` results become visible on the Apps/settings path, not just in harness state.
5. Ensure package lifecycle/action diagnostics are visible in page UI through toast/status/diagnostic rows, not only emitted to console or stored in global harness arrays.
6. Extend fake daemon responses in packaged smoke only as a deterministic harness mirror of authoritative DTOs. Do not make the fake responses the app contract.
7. Extend live packaged harness assertions to prove the production entry point changed: compiled app -> package bridge -> real local hub DTO requests -> rendered app/package/settings/action UI.
8. Update docs only where the verified path differs from current text.

## Risks

- Underwired acceptance risk: existing tests include many source-regex assertions. The implementation must add runtime/user-path checks that render the real components and observe actual bridge requests.
- DTO drift risk: generated TypeScript may silently diverge from `botster-hub-client`. Use `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` when the sibling checkout is unavailable.
- Optionality risk: daemon fields such as `apps`, `diagnostics`, `actions`, `surfaces`, `configuration.schema`, validation fields, and `local_url` can be omitted. Tests should cover omitted fields.
- Inference regression risk: package runnable entrypoints and surfaces are tempting to use as app launcher truth. The app launcher must stay on `ListApps`; package rows remain package management/settings truth.
- Validation UX risk: config errors may arrive in different daemon response branches. Render authoritative diagnostics generically before adding narrow form-specific assumptions.
- Live smoke fragility risk: a compatible hub/session-worker may not exist in the pipeline environment. If blocked, preserve exact missing binary or protocol mismatch evidence.
- PII risk: live hub output may include paths or local identifiers. Scrub acceptance logs and do not commit local paths.

## Acceptance checks/tests

- `npm test` with protocol drift enabled when possible:
  - `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=/path/to/botster-hub-client/generated/daemon-protocol.ts npm test`
  - Proves generated DTO alignment, app/package request coverage, package config/action DTOs, and component/user-path behavior.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run smoke:packaged-browser`:
  - Must prove compiled package runtime renders installed app rows from `ListApps`, installed package rows from `ListPackages`, opens or renders at least one plugin surface, shows settings/config metadata, dispatches a package lifecycle/action descriptor, and reports diagnostics visibly.
- `BOTSTER_HUB_BIN=/path/to/botster-hub BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker npm run smoke:live-packaged-protocol`, or existing-hub equivalent with `BOTSTER_HUB_SOCKET`/`BOTSTER_HUB_DATA_DIR`:
  - Must prove real local hub connectivity, app/package DTO requests, plugin surface render, package settings/config visibility, lifecycle/action diagnostics, Restty terminal path, no unexpected console/page errors, and no browser-console-only evidence.
- Manual verification, if live harness cannot be completed:
  - Open `/?dogfood=real-hub` against a local hub.
  - Confirm the mode chip reads `real-hub`.
  - Confirm installed first-party package rows and installed app rows are visible.
  - Open at least one plugin app/settings surface.
  - Save or attempt invalid package configuration and observe visible validation/diagnostic output.
  - Invoke a descriptor-backed package lifecycle/action and observe visible success/failure diagnostics.

## Vault gaps worth capturing

- Capture a Botster-web note after implementation if this ticket establishes a durable acceptance pattern for package app/settings/lifecycle surfaces in the first-party web shell.
- Capture a note if package configuration validation has a stable daemon DTO shape that should guide future web/TUI settings renderers.
- Capture a note if live smoke needs a new standard way to locate compatible `botster-hub` and `botster-session-worker` binaries from botster-web.
- No new note is needed for checklist timeout fallback; [[project pipelines checklist worker timeouts require artifact evidence fallback]] already covers the operational response.
