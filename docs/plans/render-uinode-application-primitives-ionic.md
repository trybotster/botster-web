---
description: Plan for rendering new UiNode application primitives in botster-web with Ionic composition
---

# Render UiNode application primitives with Ionic composition

## Context Loaded

- Ticket: `ticket_1783529012_588056`, "Render new UINode application primitives in botster-web with Ionic composition".
- Run: `run_1783533654_501562`, active step `botster_plan`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, worktree: the pipeline-provided ticket worktree.
- Dependency: closed ticket `ticket_1783529011_789836`, "Update hub UINode validation and test support for application primitives".
- Pipeline context had no prior artifacts, findings, reviews, questions, answers, or open blockers. The only required plan gate is `botster_plan_gate`.
- Playbooks and vault notes loaded: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], and [[plan agents must author vault context as wikilinks not home paths]].
- Checklist discipline: `project_pipelines_checklist_instructions` was loaded. Creating the standard run checklist timed out through the plugin worker, so checklist evidence is preserved in this plan and the plan gate per [[project pipeline orchestration belongs in a device-level botster plugin]]'s checklist-timeout fallback guidance.
- Repo inspection found the production UiNode path is `src/App.tsx` -> `UiNodeSurface` -> `ionicUiNodeRendererRegistry` in `src/botster/IonicUiNodeRenderer.tsx`.
- Repo inspection found existing tests in `src/App.test.mjs`, existing CSS in `src/theme/app.css`, the published hub test-support package `@trybotster/hub-test-support@0.1.1`, and live browser harness coverage in `scripts/live-packaged-protocol-harness.mjs`.
- Dependency-version check: `npm view @trybotster/hub-test-support version` returned `0.1.1`, matching `package.json` and `package-lock.json`.

## Botster Layers Touched

- React/Ionic SPA renderer.
- Browser UiNode/action/entity binding path.
- Plugin-surface runtime harness for the authoritative composite fixture.
- Deterministic Node/SSR component tests and CSS.

No Rust hub/core, TUI, Rails relay, Lua plugin runtime, package admission, daemon protocol, or transport changes are planned unless the authoritative fixture exposes a schema mismatch that cannot be consumed by the existing browser adapter.

## Scope

1. Extend `src/botster/IonicUiNodeRenderer.tsx` to support the application primitives named by the ticket:
   - `metric`
   - `metric_grid`
   - richer `table`
   - `toolbar`
   - `action_bar`
   - `empty_state`
   - `status_badge`
   - `section`
   - enhanced `panel` density/variant/slot handling
   - list selection/action semantics
2. Use Ionic React primitives where they naturally fit: cards, grid/row/col, list/items, toolbar/buttons/search/select/segment, badges, and item buttons.
3. Preserve existing `UiNodeSurface` wiring so plugin app/settings routes and the dogfood first screen render through the production registry, not a test-only renderer.
4. Normalize only the hub/core-validated UiNode vocabulary needed for this ticket. Current code accepts `primitive`, while older plugin fixture Lua emits `type`; keep any adaptation constrained to the existing validated `ui_tree_snapshot` path and avoid plugin-specific branches.
5. Update CSS in `src/theme/app.css` only for classes required by these primitives, maintaining the existing Ionic shell palette and density.
6. Update deterministic tests in `src/App.test.mjs` to cover every primitive and interaction semantics called out in the ticket.
7. Update or add hub-test-support-backed fixture tests so the composite app fixture is rendered from authoritative package assets when available, not from a hand-copied web-only fixture.
8. Extend `scripts/live-packaged-protocol-harness.mjs` only as needed to prove the composite plugin surface leaves loading and renders through the real app route.

## Non-Scope

- No hardcoded Project Pipelines or Workspaces renderer branches.
- No new design system, Tailwind Catalyst migration, or non-Ionic component library.
- No broad app-shell redesign, terminal bridge work, package lifecycle changes, or route model changes.
- No handwritten DTO/protocol fields when generated or hub-test-support artifacts provide the authoritative shape.
- No speculative public UiNode contract changes in botster-web; unsupported hub/core fields should produce a precise implementation blocker or fallback, not private browser vocabulary.
- No dependency upgrades unless the implementer verifies a newer published dependency or attached artifact is required.

## Assumptions And Unknowns

- Assumption: the closed dependency means hub/core now validate the new application primitives and expose either generated DTOs, `@trybotster/hub-test-support` fixture updates, or live contract-matrix output this repo can consume.
- Assumption: `@trybotster/hub-test-support@0.1.1` is still the latest published package at plan time. The current installed `plugin-contract-matrix` fixture only shows older `panel`, `text`, `button`, and empty surface examples, so implementer must inspect whether the new primitive fixture is delivered elsewhere or by the live hub.
- Unknown: exact prop names for metric/table/toolbar/list selection in the authoritative hub/core contract. Implementer must derive them from generated DTOs, hub-test-support assets, or delivered live snapshots before finalizing renderer behavior.
- Unknown: whether `panel` is still emitted as `type: "panel"` by Lua fixtures and translated into `primitive: "section"` upstream, or whether botster-web must accept `panel` directly as a primitive. If both paths appear, prefer one cold-turkey normalized browser primitive path and document the producer boundary.
- Unknown: whether table row activation is represented as row-level `action`, per-cell actions, selected row ids, or slot actions. Implementer must follow the authoritative fixture and ask a human if multiple incompatible schemas are present.
- Worktree/target assumption: all edits and verification run in this assigned botster-web worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.

## Affected Surfaces And Files

- `src/botster/IonicUiNodeRenderer.tsx`: primary renderer registry and primitive implementation.
- `src/botster/uiNodes.ts`: only if the authoritative contract requires adding narrow optional render metadata types; avoid over-typing opaque `props`.
- `src/botster/UiNodeSurface.tsx`: only if the production entry point needs action/selection forwarding that cannot stay inside the renderer.
- `src/App.tsx`: only if app-route local state/action dispatch must pass additional selection state into `UiNodeSurface`.
- `src/botster/__fixtures__/uiNodeConformance.ts`: replace or extend the current mirrored fixture with an authoritative application-primitives fixture when available; keep provenance explicit.
- `src/App.test.mjs`: deterministic SSR/component assertions, action collection/dispatch assertions, accessibility smoke for table/list semantics, and runtime-path assertions.
- `src/theme/app.css`: bounded primitive styles for grid/card/table/list/action density.
- `src/botster/__fixtures__/IonicReactSsrMock.tsx`: add mocked Ionic components only for primitives used by tests.
- `scripts/live-packaged-protocol-harness.mjs`: composite fixture route proof that the plugin surface renders and does not remain in loading.
- `README.md` or `docs/architecture.md`: only if implementation discovers a new stable local renderer contract developers need to run the fixture/harness.

## Implementation Outline

1. Inspect the authoritative fixture/schema source first: `@trybotster/hub-test-support`, generated protocol artifacts, and live fixture payloads. Do not invent prop names from the ticket prose.
2. Add small renderer helpers for:
   - typed reads of row/column/metric/action/selection props;
   - accessible action extraction for node-level and row-level actions;
   - class naming for density/variant without creating a separate design system.
3. Add `metric` and `metric_grid` using `IonCard`, `IonCardHeader`, `IonCardContent`, `IonGrid`, `IonRow`, and `IonCol`.
4. Rework `table` to use Ionic-friendly grid/list composition while preserving roles: `role="table"`, `rowgroup`, `row`, `columnheader`, `cell`, selected state, empty state, and keyboard/click activation for actionable rows.
5. Add `toolbar` and `action_bar` using `IonToolbar`, `IonButtons`, `IonSearchbar`, `IonSelect` or `IonSegment` when the validated contract supplies those controls.
6. Add `status_badge` as an Ionic badge wrapper with validated tone/status mapping, keeping existing `badge` behavior intact unless the authoritative contract supersedes it.
7. Enhance `section`/`panel` rendering for header/body/footer/actions slots, density, and variant while preserving existing section output for current snapshots.
8. Enhance `list`/`list_item` selection and activation semantics with `button`, `detail`, `aria-selected`, selected classes, and action dispatch through existing `dispatchAction`.
9. Wire the composite fixture through `UiNodeSurface` and existing plugin app route harnesses so acceptance proves the production entry point changed.

## Risks

- Schema drift risk: the ticket describes primitives, but the current installed contract-matrix fixture does not visibly contain them. Mitigation: inspect authoritative generated/test-support artifacts first and block with a precise question if absent.
- Accessibility regression risk: table/list activation can become clickable `div` markup. Mitigation: use Ionic actionable items/buttons or explicit keyboard handlers and roles in tests.
- Unwired implementation risk: adding renderer cases without proving `App.tsx` plugin routes invoke them would satisfy source inspection but not the user path. Mitigation: test through `UiNodeSurface` and live plugin route harness.
- Design drift risk: custom table/card CSS could become a browser-only design system. Mitigation: compose Ionic primitives and keep CSS to layout/density glue.
- Backward-compatibility risk: existing snapshots use `stack`, `section`, `list`, `table`, forms, iframe, and plugin routes. Mitigation: preserve current tests and only adjust existing markup where required by the ticket.
- Fixture provenance risk: extending `src/botster/__fixtures__/uiNodeConformance.ts` by hand can drift from core/hub. Mitigation: import/materialize hub-test-support fixtures when possible and keep explicit provenance if a mirror remains temporary.

## Acceptance Checks And Tests

1. `npm test` passes, including protocol drift and deterministic app/renderer tests.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. New `src/App.test.mjs` coverage proves `supports()` returns true for every new primitive named by the ticket.
5. Renderer tests prove `metric` and `metric_grid` render Ionic card/grid markup and do not require custom Catalyst/Tailwind components.
6. Renderer tests prove table header/body/empty state, selected row state, and row activation dispatch with accessible roles/keyboard or Ionic button semantics.
7. Renderer tests prove `toolbar`/`action_bar` render Ionic toolbar/buttons/search/filter/segment/select controls as appropriate to the authoritative fixture.
8. Renderer tests prove `empty_state`, `status_badge`, section/panel slots, density/variant classes, and list selection/action semantics.
9. A composite fixture test renders the authoritative application-primitives screen through `UiNodeSurface`, not by calling renderer internals alone.
10. `npm run smoke:plugin-contract-matrix` or a narrower documented live harness path proves the plugin surface route leaves loading and renders the composite app fixture through `/apps/:package/:surface`.
11. Accessibility smoke covers table/list selection and row activation semantics in SSR/component assertions and, where browser-only behavior matters, in the Playwright harness.
12. No source/test/docs additions contain local absolute paths, Project Pipelines worktree paths, or hand-authored copies of generated DTO fields when an authoritative artifact exists.

## Runtime Path Proof

- Deterministic proof: `src/App.test.mjs` should render the composite fixture through `UiNodeSurface`, which uses `ionicUiNodeRendererRegistry` exactly as `src/App.tsx` does.
- Browser proof: `scripts/live-packaged-protocol-harness.mjs` should open the package app route, wait for `plugin_surface_render`, and assert the composite fixture content is visible rather than a loading state.
- Entry-point proof: keep or add assertions that `src/App.tsx` imports and mounts `UiNodeSurface` for dogfood/plugin app surfaces.

## Pipeline Gates And Artifacts

- Plan gate evidence should cite this file and include the loaded context, checklist timeout fallback, dependency-version check, and repo inspection findings.
- Implement gate should include changed files, exact authoritative fixture/schema source used, command outputs, and browser/runtime evidence.
- Review should reject implementations that only add static renderer cases without proving a production route or `UiNodeSurface` path renders them.
- Verify should rerun deterministic checks plus the browser/runtime harness and re-check any resolved findings against the live worktree.

## Vault Gaps Worth Capturing

- Capture a durable note if implementation confirms a stable application-primitives prop contract for `metric`, `metric_grid`, `toolbar`, `action_bar`, `panel`, table selection, or list activation.
- Capture a note if hub-test-support needs a named exported application-primitives fixture distinct from the older plugin contract matrix.
- Capture a note if checklist creation timeouts remain common enough that plan-stage gate templates should automatically include fallback evidence fields.
