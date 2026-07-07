# Render Blocked Plugin Navigation Target Kinds

## Context Loaded

- Pipeline context: `ticket_1783398460_207102`, `run_1783398486_902615`, current step `botster_plan`, gate `botster_plan_gate`.
- Prior pipeline state: no prior artifacts, findings, reviews, open questions, or answers were present when planning started.
- Required vault/playbook context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[spa-patterns]], [[cli-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific vault context: [[botster plugin surfaces own navigation and plugin scoped sessions]], [[package navigation entries declare discoverability not host placement]], [[plugin surface actions route by explicit metadata]], [[plan steps need reviewable plan artifacts]].
- Repo context inspected: `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`, `src/App.test.mjs`, `package.json`, existing `docs/plans/` conventions.

## Scope

- Keep the change in the Botster React SPA layer.
- Replace the sidebar shortcut filter in `src/App.tsx` so hub-admitted package navigation entries are considered for display regardless of target kind.
- Remove the current `slice(0, 8)` cap for this sidebar section and render all admitted navigation entries in the hub-provided entity order. This avoids adding plugin ordering authority while ensuring unsupported or blocked entries cannot evict supported entries from visibility.
- Preserve supported navigation only for entries the browser can actually open today:
  - enabled `plugin_surface` entries with a package and surface should navigate through the existing stable host plugin-surface route behavior;
  - enabled entries with a browser-supported hub `route_path` should use the existing route-path adapter if it resolves through a side-effect-free predicate.
- Render blocked or disabled entries for `plugin_surface`, `app_entrypoint`, and unknown/future target kinds as inert unavailable entries with visible inline diagnostics.
- Render enabled but unsupported target kinds as inert entries with a precise visible inline unsupported diagnostic instead of allowing a broken clickable route.
- Extend deterministic tests so the real sidebar/user path proves entries are visible, inert when unavailable/unsupported, and that supported plugin-surface navigation remains wired.

## Non-Scope

- No app shell redesign, sidebar grouping redesign, plugin ordering authority, or host placement policy changes.
- No generated daemon protocol refresh unless the current checked-in DTO type is insufficient; current `DaemonPackageRouteTarget.kind: string` already admits unknown/future target kinds.
- No hub, CLI, Lua plugin, TUI, MCP, or package manifest changes.
- No new navigation target support for app entrypoints or custom HTML/iframe targets; unsupported enabled targets should diagnose precisely until web implements them.
- No broad refactor of entity frames, route hydration, package actions, plugin-surface rendering, or iframe rendering.

## Assumptions And Unknowns

- Assumption: `botster-web.package_navigation` is already the authoritative projected entity family for hub-admitted navigation registry rows.
- Assumption: render-time route support must be checked without side effects by reusing the same `appRouteFromPathname(routePath)` guard as `navigateToHubRoutePath`: supported means the parsed route has `view === "apps"` and a non-empty `packageName`. Do not call `navigateToHubRoutePath` during render.
- Assumption: `plugin_surface` remains the only target kind with production open behavior in this ticket; app entrypoints and unknown kinds must not be made clickable by inference.
- Unknown: the exact future target-kind vocabulary beyond the current string `kind`; tests should use representative values such as `app_entrypoint` and a synthetic unknown kind rather than hard-code a closed enum.
- Unknown: whether enabled `app_entrypoint` navigation will eventually map to installed app rows or a route descriptor. This ticket should not choose that product behavior silently.

## Affected Surfaces And Files

- `src/App.tsx`
  - route support helper: extract or add a small pure helper based on `appRouteFromPathname(routePath)` and share it with `navigateToHubRoutePath`, so render-time availability does not call the side-effecting navigator.
  - `openPackageNavigation`: keep side effects only in the click path and no-op or toast defensively if called for an unavailable entry; primary unsupported diagnostics must be derived before render.
  - `packageNavigationShortcuts`: stop filtering to only entries with `surface_id` and `target_kind === "plugin_surface"` and remove the `slice(0, 8)` cap rather than reordering entries.
  - sidebar render block: derive an entry view model with label, target kind, supported/openable state, visible diagnostic text, and click handler; keep blocked/unsupported entries inert.
  - diagnostic markup: show diagnostic text as visible inline sub-label/caption content inside each navigation item, not only as a `title` attribute. Blocked/disabled rows should use hub diagnostics when present, falling back to the existing "Unavailable from hub navigation registry" projection. Enabled unsupported rows should synthesize wording such as `Unsupported navigation target: <target_kind>` at render time.
- `src/App.test.mjs`
  - add/extend component/user-path assertions around the admitted navigation sidebar, including blocked `plugin_surface`, blocked `app_entrypoint`, blocked unknown/future target kind, enabled unsupported target kind, and supported enabled `plugin_surface`.
  - include a mixed set with more than eight admitted entries and assert that no supported `plugin_surface` entry disappears when blocked or unsupported entries are present earlier in hub order.
  - assert diagnostics on the chosen visible inline sub-label/caption surface, and assert blocked/unavailable wording is distinct from enabled-unsupported wording.
  - keep existing route-open, iframe, plugin-surface render, action, and generated protocol fixture assertions intact.
- `src/botster/__fixtures__/generatedDaemonProtocol.ts`
  - only if needed for projection-level coverage of additional target kinds; prefer local test fixtures in `App.test.mjs` if the fixture is meant to mirror generated protocol examples rather than ticket-specific UI cases.

## Risks

- Silent disappearance risk: retaining any `surface_id` or `plugin_surface` predicate in the shortcut list would preserve the bug for future target kinds.
- Cap-crowding disappearance risk: keeping `slice(0, 8)` after relaxing the target-kind filter would let blocked or unsupported entries push supported entries out of the rendered list. Resolve by removing the cap for this admitted-navigation section and preserving hub-provided order, rather than adding browser-owned prioritization.
- Broken-route risk: treating every `route_path` as clickable without confirming `navigateToHubRoutePath` support could send users to dead routes.
- Render-time side-effect risk: calling `navigateToHubRoutePath` to test support during render would mutate history and active route. Resolve by using the pure `appRouteFromPathname` guard for render-time support and reserving the navigator for click handling.
- Diagnostic ambiguity risk: blocked entries and enabled unsupported entries need distinguishable visible inline messages so users know whether hub policy blocked the route or the web client lacks support.
- Sidebar density risk: removing the cap may lengthen the Plugins section. This is acceptable for this ticket because preserving admitted entries is the requirement and adding ordering/prioritization authority is explicitly out of scope.
- Contract drift risk: tests should use current DTO field names from the generated TypeScript mirror, not invented fixture shapes.

## Acceptance Checks And Tests

- `npm test`
  - Existing drift and deterministic app tests remain green.
  - New assertions prove blocked `plugin_surface`, blocked `app_entrypoint`, and blocked unknown/future target kinds render as unavailable diagnostics rather than disappearing.
  - New assertions prove enabled unsupported target kinds do not call the navigation/open path and instead surface a precise visible unsupported diagnostic.
  - New assertions cover a mixed list with more than eight admitted entries and prove supported `plugin_surface` entries remain visible even when blocked or unsupported entries appear before them.
  - New assertions prove diagnostic text is present in visible rendered markup, not only in a hover `title`, and that blocked/unavailable diagnostics differ from enabled-unsupported diagnostics.
- `npm run typecheck`
  - Ensures target-kind branching and diagnostic helpers remain type-correct against the current DTO mirror.
- Existing smoke coverage remains relevant and should not be weakened:
  - route open and direct plugin-surface render assertions in `src/App.test.mjs`;
  - iframe/custom UiNode renderer assertions already present in the deterministic suite;
  - live packaged/plugin contract smokes can remain downstream verification if the implementation stage has the required hub/runtime available.

## Runtime Path Proof

The production user path is the sidebar in `src/App.tsx`: entity hydration pulls `botster-web.package_navigation`, the admitted navigation list feeds the `Admitted plugin navigation` sidebar section, render-time availability uses the pure route-support helper, and supported button clicks go through `openPackageNavigation`. The implementation must test rendered sidebar/button behavior and visible diagnostics, not only `packageNavigationRecord` projection.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should cite this document, loaded vault context, assumptions, risks, and acceptance tests.
- Implement stage should attach a patch summary and exact test command outputs.
- Review/Verify should reject any solution that merely exposes helper records without proving the sidebar user path changed.

## Vault Gaps Worth Capturing

- If implementation clarifies a durable policy for enabled-but-unsupported `app_entrypoint` navigation rows, capture a Botster SPA note for the diagnostic/opening boundary.
- If tests establish a reusable sidebar helper for admitted package navigation availability, capture the convention only if it becomes a pattern beyond this ticket.
- No new vault capture is needed for the plan itself; existing notes already cover host-owned navigation, package navigation discoverability, and plan artifact discipline.
