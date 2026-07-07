# Render hub-admitted plugin navigation and iframe UiNodes

## Context Loaded

- Pipeline context: ticket `ticket_1783371392_689355`, run `run_1783381569_999792`, active step `botster_plan`, gate `botster_plan_gate`.
- Dependency context: hub ticket `ticket_1783371372_931094` is registered as a closed dependency, so implementation should consume the landed hub DTOs instead of inventing browser-local navigation fields.
- Required playbooks: [[planner-playbook]] and [[botster-planner-playbook]].
- Constraining vault notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[botster-web ionic supersedes catalyst for client shell]], [[botster web plugin app routes are stable host routes]], [[plugin owned surface route renders run in plugin worker vms]], [[plugin asset message handlers run in plugin worker vms]], [[worker-rendered plugin assets remain readable from the hub]], [[botster web generated protocol drift checks need explicit hub artifact paths]], [[botster web dto field names must match authoritative rust serde structs]], [[generated typescript dtos must encode serde field optionality]], [[plugin surface handlers must validate against hub locked uinode contract]], [[runtime client acceptance must render delivered snapshots through real registry]], and [[plan steps need reviewable plan artifacts]].
- Repo context inspected: `src/App.tsx`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/uiNodes.ts`, `src/botster/pluginSurfaces.ts`, `src/botster/protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `scripts/real-hub-dogfood-bridge.mjs`, `package.json`, `README.md`, and prior plans under `docs/plans/`.
- Current repo baseline: botster-web already has stable `/apps/:package/:surface` and `/apps/:package/settings` route parsing, route-triggered `botster.package.surface.render`, package/app entity projections, route descriptor fields on `DaemonPackageRouteDescriptor`, and deterministic/live harness coverage for plugin surface render and direct reload. It does not yet expose a first-class navigation entity/registry in the shell, and the UiNode renderer does not support an iframe/webview primitive.
- Workflow evidence note: creating the Project Pipelines vault checklist timed out in the plugin worker. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], this plan and the Plan gate payload carry the vault-note, convention-conflict, verification, and capture evidence instead.

## Scope

- Refresh generated daemon protocol and test-support fixtures from the closed hub dependency, including any admitted navigation registry DTOs and iframe/webview UiNode fields. Do this through the existing generated protocol path and explicit drift check, not hand-written TypeScript guesses.
- Project hub-admitted navigation entries into the existing browser entity/runtime flow, likely as a new or extended `botster-web.navigation`/route entity family only if the generated DTO has a distinct registry. If the hub expresses the registry through `DaemonPackageRouteDescriptor` on app/package rows, extend the current route projection instead of adding a parallel browser abstraction.
- Render shell navigation from admitted hub navigation/route entries in the Ionic menu/split-pane/list. Preserve the fixed shell entries for Dashboard, Apps, and Diagnostics, but plugin shortcuts should come from hub-admitted entries instead of the current `installedApps.slice(0, 5)` shortcut guess.
- Preserve existing default app discovery by continuing to consume hub-derived `DaemonApp` and `DaemonPackage` projections where the hub uses app/package surfaces to derive navigation rows.
- Keep stable plugin URLs. For app surfaces, prefer hub-provided `route_path` when it parses into a valid app route; fall back to `/apps/:package/:surface` only when the hub DTO does not provide a valid route path.
- Make direct-load and refresh of plugin navigation routes pull enough hub state to resolve the package/surface, render through `plugin_surface_render`, and leave Loading for rendered or diagnostic terminal states.
- Render disabled or blocked navigation entries as visible unavailable diagnostics. They may appear in navigation, but must not become clickable broken links or dispatch render actions.
- Add an iframe/webview UiNode primitive to the production UiNode renderer with safe sandbox defaults, using hub-managed asset URLs/references from validated DTOs. Do not render raw HTML strings and do not introduce `dangerouslySetInnerHTML`.
- Gate bridge/actions for iframe nodes on explicit hub DTO allowances only. If the DTO does not allow scripts, forms, same-origin, downloads, or message bridge/action ids, the iframe must not enable them by default.
- Extend deterministic and live packaged/contract-matrix tests so they prove hub-admitted navigation consumption, direct-load/refresh, unavailable diagnostics, and iframe rendering through the production user path.

## Non-Scope

- No route layout, route padding, local navigation, sidebar replacement, or plugin-specific page layout behavior. Plugin root UiNode owns page layout and gets the full app content area.
- No raw package manifest parsing in botster-web for shell decisions.
- No raw HTML injection, no `dangerouslySetInnerHTML`, and no browser-created HTML blobs from hub strings.
- No new frontend framework, state library, routing library, build tool, or broad Ionic shell redesign.
- No Rust hub/core implementation unless the refreshed generated protocol proves the closed dependency did not actually expose the required registry/iframe DTO. In that case implementation should ask or reopen/register a dependency rather than fabricate web-only fields.
- No TUI parity work, terminal renderer changes, package lifecycle refactors, WebRTC transport changes, or unrelated cleanup.

## Assumptions And Unknowns

- Assumption: the closed hub dependency exposes admitted plugin navigation through generated daemon DTOs reachable by the existing package/app list or package route descriptor path, or by a newly generated navigation registry response/frame.
- Assumption: `DaemonPackageRouteDescriptor.route_path`, `enabled`, `blocked`, `diagnostics`, `target`, `surface_id`, and related fields remain the browser's route authority when no separate navigation DTO exists.
- Assumption: app/package rows remain valid default discovery input because the ticket explicitly says to preserve default app discovery where the hub derives entries for app surfaces.
- Assumption: iframe/webview nodes arrive as hub-validated UiNode primitives or nested `plugin_surface.ui_tree_snapshot` bodies. The browser should adapt only the validated snapshot path that already carries package/surface identity, not body-only plugin surface fallbacks.
- Unknown: exact DTO names and field names for the hub-admitted navigation registry and iframe/webview primitive until the generated protocol artifact is refreshed from the closed hub ticket. Field names must follow the authoritative generated Rust serde output.
- Unknown: exact allow-list vocabulary for iframe bridge/actions. If the DTO has no explicit allow flags or action descriptors, implementation must default to inert iframe rendering and ask before enabling a bridge.
- Unknown: whether the local pipeline environment has compatible hub/session-worker binaries for live smoke. If unavailable, implementer must record exact missing prerequisites and still run deterministic tests; Verify should rerun live acceptance where binaries exist.
- Worktree/target assumption: this plan applies to the current Project Pipelines worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`; artifacts should remain path-neutral.
- Convention conflicts: none. The plan follows the Ionic shell decision, DTO authority rules, stable host routes, and sandboxed plugin asset model.

## Affected Surfaces And Files

- `src/botster/generated/daemon-protocol.ts`: refreshed generated DTOs for admitted navigation registry, route descriptors, and iframe/webview UiNode primitive support.
- `src/botster/__fixtures__/generatedDaemonProtocol.ts`: generated/request/response fixtures updated only to mirror authoritative hub artifacts.
- `src/botster/realHubDaemonDto.ts`: type exports remain the public daemon DTO boundary; avoid adding local mirror fields here unless generated artifacts require helper exports.
- `src/botster/realHubDogfoodTransport.ts`: daemon response projection into entity frames. Add/extend route/navigation entity projection, route action construction, disabled/blocked diagnostics, and iframe asset/action fields as needed from real hub DTOs.
- `src/App.tsx`: Ionic shell navigation rendering, plugin route resolver, direct-load/refresh behavior, disabled/blocked route diagnostics, and route use of hub-admitted entries.
- `src/botster/IonicUiNodeRenderer.tsx`: iframe/webview primitive renderer, sandbox attribute construction, safe asset URL/reference handling, capability checks, and action/message bridge gating.
- `src/botster/uiNodes.ts`: UiNode prop typing remains generic, but renderer option/action hooks may need a narrow extension for iframe bridge dispatch if the hub DTO requires it.
- `src/botster/capabilities.ts`: capability name updates only if the refreshed hub/client contract changes the current `plugin_surface_sandbox`/asset vocabulary.
- `src/botster/pluginSurfaces.ts`: likely cleanup or extension if the existing sandbox descriptor seam becomes the host for iframe asset mounting; do not create an unused abstraction.
- `src/App.test.mjs`: deterministic coverage for navigation projection, route resolution, disabled/blocked diagnostics, iframe renderer markup/sandbox attributes, no raw HTML injection, and action gating.
- `scripts/packaged-browser-smoke.mjs`: compiled-browser smoke for admitted navigation entries, direct route reload, disabled/blocked entry display, and iframe asset rendering.
- `scripts/live-packaged-protocol-harness.mjs`: real hub proof for Workspaces navigation from the admitted registry, direct-load/refresh, blocked diagnostics, and contract-matrix iframe UiNode rendering.
- `scripts/real-hub-dogfood-bridge.mjs`: deterministic bridge fixture updates only to mirror authoritative DTOs for packaged smoke.
- `README.md`: update only if command behavior, harness expectations, or user-visible plugin navigation/iframe support changes.

## Implementation Shape

1. Refresh protocol/test-support artifacts from the hub dependency, then run the explicit drift check against the authoritative hub generated protocol artifact. Stop and ask if the expected navigation/iframe DTOs are absent.
2. Identify the source of admitted navigation in the refreshed DTOs:
   - if a distinct navigation registry exists, project it into entity frames and use it for shell plugin navigation;
   - if routes are attached to app/package rows, treat `DaemonPackageRouteDescriptor` as the admitted registry and extend the existing package/app projection.
3. Add a small navigation projection helper close to current DTO projection code. It should normalize labels, paths, package/surface targets, enabled/blocked state, diagnostics, and render actions from hub DTOs only.
4. Update the Ionic menu and Apps list to render plugin navigation rows from that projection. Disabled/blocked rows render labels and diagnostics without dispatching or navigating to broken targets.
5. Keep route resolution path-owned: URL parses to package/surface, route effect waits for package/navigation hydration, dispatches only hub-provided render actions, and displays terminal diagnostics when the route is missing, disabled, blocked, or lacks a render action.
6. Add iframe/webview renderer support in `IonicUiNodeRenderer`. Use `<iframe>` with a conservative `sandbox` value, explicit `src` from hub-managed asset URL/reference, stable title, and no `srcDoc`/innerHTML. Only include sandbox tokens and message/action plumbing that the validated node explicitly permits.
7. Extend contract-matrix/deterministic fixtures with one enabled navigation route, one disabled/blocked navigation route, and one iframe/webview UiNode referencing a generated HTML asset. The fixture should include a raw-HTML-looking payload to prove it is not injected into the DOM.
8. Extend live harnesses so acceptance clicks or opens the same routes users use, observes `plugin_surface_render`, checks iframe sandbox/src behavior, reloads/direct-loads the plugin URL, and proves the daemon remains responsive after blocked navigation.

## Risks

- DTO drift risk: implementing against guessed field names would pass fixture tests while failing against the real hub. Mitigation: explicit generated artifact refresh and drift check with `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL`.
- Dual-source navigation risk: showing app-derived shortcuts beside admitted navigation entries can duplicate or contradict hub policy. Mitigation: pick one projected navigation list as the shell source and keep app/package rows as supporting discovery only.
- Disabled/blocked route risk: a disabled row that still has `button`/`detail` behavior can dispatch a render and produce confusing errors. Mitigation: terminal diagnostic state and disabled/non-clickable UI tests.
- Direct-load race risk: route effects can run before app/package/navigation hydration and incorrectly mark missing routes. Mitigation: keep a loading diagnostic until relevant entity pulls complete.
- Iframe security risk: raw HTML injection, `srcDoc`, overbroad sandbox tokens, or implicit same-origin/scripts could break the ticket's safety requirement. Mitigation: hub asset URLs only, default sandbox deny, explicit allow flags only, and source/tests banning `dangerouslySetInnerHTML`.
- Worker asset visibility risk: worker-rendered surfaces may expose assets that the hub cannot later serve. Mitigation: live harness must load the iframe asset through the hub-managed URL, not only assert the node exists.
- Test fixture self-reference risk: deterministic bridge fixtures can encode the web assumption rather than hub reality. Mitigation: use generated hub test-support artifacts for contract matrix and keep live smoke as required acceptance.
- Layout regression risk: plugin surfaces should own full page layout; adding shell padding/local nav around iframe pages would violate the ticket. Mitigation: render route content in the existing main app content area without adding plugin-specific wrappers beyond the host route status/diagnostic shell.

## Acceptance Checks And Tests

- `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=<hub generated daemon-protocol.ts> node scripts/check-daemon-protocol-drift.mjs`
  - Must not skip. Proves browser DTOs match the closed hub dependency.
- `npm test`
  - Must prove deterministic projection of hub-admitted navigation, disabled/blocked diagnostics, direct route state derivation, iframe sandbox attributes, no `dangerouslySetInnerHTML`, and generated fixture coverage.
- `npm run typecheck`
  - Must pass after refreshed DTO and renderer changes.
- `npm run lint`
  - Must pass without suppressing security-relevant iframe or raw HTML warnings.
- `npm run build`
  - Must pass for packaged runtime.
- `npm run smoke:packaged-browser`
  - Must drive the compiled UI path, show plugin navigation from hub-shaped admitted entries, click/open a plugin route, refresh/direct-load it, show disabled/blocked diagnostics, and render the iframe asset with sandboxed `src`.
- `BOTSTER_LIVE_CONTRACT_MATRIX=1 npm run smoke:live-packaged-protocol` with compatible hub/session-worker binaries.
  - Must prove Workspaces or another real first-party plugin navigation route comes from the admitted registry, not package-manifest guessing.
  - Must prove direct-load/refresh of that route still renders the plugin surface.
  - Must prove disabled/blocked entries are visible diagnostics and do not break subsequent daemon requests.
  - Must prove iframe UiNode loads a hub-managed generated HTML asset and no raw HTML injection is used.
  - Existing WebRTC/session/plugin surface smoke paths must remain green.
- Static/grep checks in tests or review:
  - No `dangerouslySetInnerHTML`.
  - No `srcDoc` for plugin HTML.
  - No raw manifest parsing for shell navigation decisions.
  - No committed PII, local data dirs, socket paths, or user-specific paths in fixtures/artifacts.

## Pipeline Gates And Artifacts

- Plan artifact: `docs/plans/hub-admitted-plugin-navigation-and-iframe-uinodes.md`.
- Plan gate evidence should include this file, loaded vault notes, no convention conflicts, checklist timeout fallback, and acceptance commands.
- Implement gate should include changed production entry points, exact verification command results, protocol drift evidence with explicit artifact path, packaged smoke evidence, live smoke evidence or exact unavailable-binary blocker, and proof that the route/iframe behavior is wired into `src/App.tsx` and `IonicUiNodeRenderer`.
- Plan Review should reject fixture-only navigation proof, guessed DTO fields, raw HTML/`srcDoc`, disabled rows that still navigate, route-only code with no production shell wiring, or live-smoke skips without exact prerequisite evidence.

## Vault Gaps Worth Capturing

- Capture a Botster/web note if the closed hub dependency establishes a durable DTO name and projection rule for the admitted navigation registry.
- Capture an iframe/webview UiNode security note once implementation confirms the exact hub DTO allow-list vocabulary and sandbox token mapping.
- Capture a harness note if live iframe asset loading needs a reusable Workspaces/contract-matrix fixture convention.
- No new durable note is needed for checklist timeout fallback, explicit generated protocol drift paths, stable plugin routes, or worker-rendered asset visibility; those are already covered by loaded vault notes.
