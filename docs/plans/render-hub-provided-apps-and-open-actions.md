# Render hub-provided apps and open actions in botster-web

## Context loaded

- Pipeline context: ticket `ticket_1782361546_657341`, run `run_1782404669_274594`, active step `botster_plan`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, or answers were present. Dependency `ticket_1782361545_680661` is closed.
- Ticket intent: update botster-web so the Apps surface consumes the hub-provided installed app registry and app action descriptors instead of inferring app/client lifecycle from package rows. The UI must distinguish `web_app` and `terminal_app` launch behavior, open web apps through structured hub-provided URLs/actions, and show clear diagnostics for terminal apps or unavailable/blocked actions.
- Vault and playbook context: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan agents must author vault context as wikilinks not home paths]], [[installed apps are daemon app rows projected from package runnable entrypoints]], [[botster web dto field names must match authoritative rust serde structs]], [[generated typescript dtos must encode serde field optionality]], [[structured output fields need producer paths or explicit scaffold disposition]], and [[react component launcher proofs must render and interact with the real component]].
- Repo context inspected: `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/App.test.mjs`, `scripts/check-daemon-protocol-drift.mjs`, `README.md`, existing package/app plan artifacts, and current `package.json` scripts.
- Dependency context inspected: closed hub dependency worktree `trybotster-botster-hub-project-pipelines-ticket_1782361545_680661` for `crates/botster-hub-client/generated/daemon-protocol.ts`, `docs/client-protocol.md`, `docs/reports/expose-installed-app-registry-and-structured-app-launch-dtos-implement-report.md`, and `src/daemon_transport.rs`.
- Authoritative DTO surface from the closed dependency: `DaemonRequest` includes `{ type: "list_apps" }`; `DaemonResponse` includes optional `apps?: DaemonApp[]`; response kind includes `"apps"`; `DaemonApp` has `package_name`, `app_id`, `entrypoint_id`, `kind`, `launch_mode`, `lifecycle_state`, optional `diagnostics`, optional `actions`, optional `blocked_reasons`, and `launch_target`; `DaemonAppLaunchTarget` has `kind` and optional nullable `local_url`.
- Current botster-web path: the Apps route exists in `src/App.tsx`, but it lists package records from `botster-web.package` and derives "Apps with UI" from package surface descriptors. The real-hub transport currently pulls `list_packages`, maps package rows to `botster-web.package`, and does not send `list_apps` or expose a dedicated app entity family.
- Checklist workflow: `project_pipelines_create_vault_checklist` was attempted for this run and hit a plugin worker timeout. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], vault-note provenance, convention-conflict status, verification plan, and capture disposition are preserved in this plan and must also be submitted as gate evidence.

## Scope

- Refresh `src/botster/generated/daemon-protocol.ts` from the authoritative hub-client generated artifact so `list_apps`, `DaemonApp`, `DaemonAppLaunchTarget`, and optional `DaemonResponse.apps` are available with exact serde field names and optionality. Do not hand-invent DTO fields.
- Add a dedicated app read model in the browser real-hub adapter, likely `botster-web.app`, populated only from `DaemonResponse.apps` returned by `DaemonRequest::ListApps`.
- Update `createRealHubDogfoodTransport` so startup and relevant entity pulls request `list_apps` in addition to the package/package-marketplace pulls that still support package management and settings.
- Normalize `DaemonApp` rows into display/action fields without deriving app lifecycle from `DaemonPackage.runnable_entrypoints`, package state, process state, diagnostics, known ports, or package names.
- Update the Apps route in `src/App.tsx` to list installed app rows from the app registry. Package surfaces/settings can remain available for package management where already present, but the launcher surface must no longer use package rows as the app registry.
- For `web_app`, open only through hub-provided structured data:
  - if `launch_target.local_url` is present and not blocked, open that URL using the existing UI action flow or a narrowly-scoped browser open helper;
  - if an app action descriptor provides the launch/open request, dispatch the descriptor-backed action instead of hard-coding lifecycle legality;
  - if no URL/action is present, show a clear unavailable diagnostic.
- For `terminal_app`, render it as installed but do not try to open a background URL. Show a clear diagnostic that the app requires local terminal launch or foreground terminal handling not provided by this web surface.
- Render `blocked_reasons`, diagnostics, lifecycle state, action disabled/blocked status, and missing `local_url` as user-visible diagnostics on the Apps surface.
- Keep package lifecycle controls descriptor-driven. Existing package install/enable/disable/start/stop/restart controls should continue to flow from hub-provided action descriptors and remain separate from app launching.
- Update `README.md` and `docs/architecture.md` only where their current package-derived Apps wording becomes stale.

## Non-scope

- No broad layout redesign of the Ionic shell or Apps page.
- No new hub, Rust, core, TUI, or plugin runtime work in this botster-web ticket.
- No URL scraping from stdout, stderr, diagnostics, command args, environment variables, known ports, or package names.
- No browser-inferred lifecycle transitions from package state, entrypoint process state, or local optimistic state.
- No handwritten compatibility shim that accepts both old package-derived app inference and new app DTOs as equivalent app registries. This should be a cold client-surface migration to `ListApps`.
- No implementation of foreground terminal launch inside botster-web unless the hub-provided app action descriptor already supplies that exact behavior.
- No new state management library, transport protocol, or package dependency.

## Assumptions and unknowns

- Assumption: the closed dependency's generated hub-client artifact is authoritative for this ticket even though this worktree's vendored `src/botster/generated/daemon-protocol.ts` has not yet been refreshed.
- Assumption: `launch_target.kind` mirrors the core app kind vocabulary (`web_app`, `terminal_app`) and should not be converted to a second browser vocabulary.
- Assumption: app action descriptors reuse `DaemonPackageActionState` and should be forwarded through the existing descriptor-backed `botster.package.daemon_request` style rather than interpreted by local package lifecycle rules.
- Unknown: the final UX primitive for opening a web URL. Implementer should prefer an existing action dispatch path if the DTO carries a launch/open action; otherwise use a narrow browser `window.open(local_url, "_blank", "noopener,noreferrer")` path with tests proving missing/blocked URLs do not open.
- Unknown: whether the current real hub available in the implementation environment includes the dependency artifact on `origin/main`. If not, use the dependency worktree artifact explicitly for the protocol refresh and record that in verification.
- Worktree/target assumption: all implementation happens in this pipeline worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Convention conflicts: none found. The plan follows Botster SPA/entity-frame guidance, generated DTO authority, descriptor-driven actions, and path-neutral vault citation.

## Affected surfaces/files

- Botster layers touched: React/Ionic SPA, browser real-hub bridge adapter, generated hub-client DTO mirror, entity-frame read model, package/app tests, packaged browser smoke, and docs.
- `src/botster/generated/daemon-protocol.ts`: refresh from the hub-client generated artifact; expect `list_apps`, optional `apps`, `DaemonApp`, and `DaemonAppLaunchTarget`.
- `src/botster/realHubDaemonDto.ts`: likely no semantic change beyond re-exporting the refreshed generated protocol.
- `src/botster/realHubDogfoodTransport.ts`: add `appFamily`, `list_apps` request handling, app response frame projection, app row normalization, app action binding, and response ownership for `kind === "apps"`.
- `src/App.tsx`: switch Apps view and sidebar app shortcuts from package-derived app lists to app DTO-backed rows; add web-app open/missing-URL diagnostics and terminal-app local-terminal diagnostics.
- `src/App.test.mjs`: add source guards and executable component/user-path tests for app DTO rendering and interactions; update generated-protocol assertions.
- `scripts/packaged-browser-smoke.mjs` or `scripts/live-packaged-protocol-harness.mjs`: add smoke coverage if existing harness can assert no console errors plus DTO-backed Apps rendering/open diagnostics.
- `README.md` and `docs/architecture.md`: update only stale statements that say installed apps are package-derived.

## Implementation outline

1. Copy or regenerate the generated daemon protocol from the closed hub dependency artifact, then run the existing protocol drift check with `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` pointing at that artifact.
2. Introduce an app entity family such as `botster-web.app`. In `daemonResponseFrames`, project `response.apps ?? []` into this family only for `response.kind === "apps"`.
3. Add `entity_pull` handling for the app family that sends `{ type: "list_apps" }`.
4. Pull the app family from `App.tsx` during startup before rendering app counts and shortcuts. Keep package pulls for package management, settings surfaces, and marketplace install flows.
5. Add an `appRecord()` mapper that preserves DTO-backed fields and computes only presentation labels:
   - title from `package_name` plus `app_id` or `entrypoint_id`;
   - kind/launch mode/lifecycle directly from DTO strings;
   - diagnostics from `diagnostics`, `blocked_reasons`, action states, and missing URL/terminal-app constraints;
   - open action from hub-provided action descriptors and/or `launch_target.local_url`.
6. Replace package-derived `packagesWithUi`/`packagesWithoutUi` launcher lists with DTO-backed installed app rows. Keep package settings in a separate package-management/settings section if needed.
7. Add user-path behavior:
   - `web_app` with `launch_target.local_url` opens the URL;
   - `web_app` without URL or with blocked action shows a diagnostic/toast and does not open;
   - `terminal_app` shows a local-terminal-required diagnostic and does not attempt a web URL.
8. Update docs only after the code path is wired, using neutral repo paths and note titles.

## Risks

- DTO drift risk: hand-editing protocol types can reintroduce undefined reads. Mitigation: refresh from generated hub artifact and run `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<artifact> npm test` or at least the drift script plus `npm test`.
- Underwired implementation risk: adding DTO types without pulling `list_apps` through the production `createRealHubDogfoodTransport` path would satisfy source scans but not the user path. Mitigation: tests must assert actual transport request, entity projection, and component rendering.
- Parallel lifecycle risk: package rows already expose runnable entrypoints and actions. The implementation must not keep using them as the app launcher source. Package management remains package-based; installed app launching becomes app DTO-based.
- URL inference risk: old package readiness docs discuss local URLs. The Apps surface must use `DaemonApp.launch_target.local_url` only, and absence must be accepted as valid wire state.
- Terminal-app UX risk: terminal apps may look broken if displayed like web apps. The UI must clearly distinguish local terminal launch requirements.
- Optionality risk: `apps`, `diagnostics`, `actions`, `blocked_reasons`, and `local_url` can be omitted. Tests should cover omitted fields, not only empty arrays or present `null`.
- Smoke fragility risk: packaged browser smoke depends on a compatible hub/bridge. If live smoke cannot run locally, implementer must still prove the component/transport path with executable tests and record the exact live-smoke blocker.
- PII risk: app diagnostics may contain paths if the hub ever leaks them. Tests/docs should avoid checking in local absolute paths, usernames, sockets, or data dirs.

## Acceptance checks/tests

- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=../trybotster-botster-hub-project-pipelines-ticket_1782361545_680661/crates/botster-hub-client/generated/daemon-protocol.ts npm test`
  - Protocol drift check compares against the authoritative dependency artifact.
  - Generated-protocol assertions cover `list_apps`, `DaemonResponse.apps?: DaemonApp[]`, `DaemonResponseKind` `"apps"`, `DaemonApp`, and optional `DaemonAppLaunchTarget.local_url`.
  - Transport tests prove `entity_pull` for the app family sends `{ type: "list_apps" }` and projects `DaemonResponse.apps` into app records.
  - App component tests render real `PluginListItem` or its replacement with representative `DaemonApp` rows, not source regex alone.
  - Positive web-app test: DTO-backed `web_app` with `launch_target.local_url` renders as openable and dispatches/opens the structured URL.
  - Missing URL test: `web_app` with omitted/null `local_url` renders a clear unavailable diagnostic and does not open.
  - Blocked action test: app action descriptor with blocked/unavailable status renders disabled/diagnostic state and does not dispatch as available.
  - Terminal app test: `terminal_app` renders as installed with local-terminal-required diagnostic and no web open attempt.
  - Regression test: Apps view no longer derives app launcher rows from `DaemonPackage.runnable_entrypoints` or package surface descriptors.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run smoke:packaged-browser` if the local hub/bridge can exercise the refreshed app DTO path; otherwise record the precise environment blocker and keep executable component/transport proof.
- Manual runtime evidence for Implement/Verify: load the Apps route against a hub with `ListApps`, confirm the bridge issues `list_apps`, app rows render from `DaemonResponse.apps`, web-app open behavior uses `launch_target.local_url`, terminal apps show diagnostics, and the browser console has no errors.

## Vault gaps worth capturing

- Capture a botster-web note after implementation if the app DTO-backed entity family establishes the reusable pattern for first-party clients migrating from package-derived launcher rows to `ListApps`.
- Capture a note if app action descriptors require a distinct open-action vocabulary beyond existing `DaemonPackageActionState`; do not pre-capture until implementation confirms it.
- No new note is needed for checklist timeout fallback; the existing [[project pipelines checklist worker timeouts require artifact evidence fallback]] convention already covers this run.
