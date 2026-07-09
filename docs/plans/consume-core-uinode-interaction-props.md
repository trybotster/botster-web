# Consume core UINode interaction props in botster-web plugin surfaces

## Context loaded

- Pipeline context: ticket `ticket_1783560828_921607`, run `run_1783569630_242047`, approved for Implement after Plan Review.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Botster vault constraints: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[botster web drops core uiaction payload and ignores interaction props]], [[botster-web should import canonical core uinode fixtures instead of mirroring them]], [[adapter test fixtures must validate translation not passthrough]], [[plugin surface handlers must validate against hub locked uinode contract]], [[botster web plugin app routes are stable host routes]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- General convention context loaded after return: `<knowledge-vault>/self/identity.md` and `<knowledge-vault>/self/goals.md`.
- Authoritative local core contract checked: `<local botster-core checkout>/crates/botster-core/src/contract/ui.rs` at explicit `botster-core` revision `978c436`, observed 2026-07-09.
- Repo context inspected: `src/App.tsx`, `src/botster/actions.ts`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, `src/botster/uiNodes.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/App.test.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `node_modules/@trybotster/hub-test-support/fixtures/plugin-contract-matrix/plugin.lua`, `package.json`, `README.md`, `docs/architecture.md`.
- Checklist discipline: the run vault checklist exists as `checklist_1783569717_789107`; its context item was updated. Initial checklist creation had timed out, so evidence is also preserved in this artifact and gate payload per [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Baseline verification: `npm ci` completed; `npm test` passed at baseline with `Renderer seam, runtime behavior, and registry fixture assertions passed.`

## Resolved core contract

The current split-repo contract is not an unknown for this ticket:

- `UiAction` is `{ id, payload: Option<Value>, disabled }` in `ui.rs` around lines 673-681. `payload` is the plugin action payload; routing metadata is not part of it.
- `UiSelection` is `{ mode, selected }` in `ui.rs` around lines 737-744. Selection is owner-authored read state. There is no core selection action, and validation only checks mode/selected consistency around `validate_selection`.
- `UiTableRow` is `{ id, cells, action }` in `ui.rs` around lines 793-804. The ticket's payload-bearing row action is `table.props.rows[].action`, not only table-level `row_action`.
- Valid EmptyState props are `title`, `description`, `icon`, `action`, `primary_action`, and `secondary_action` in `ui.rs` around lines 2033-2045. Core does not define `body` or an `actions` slot for EmptyState.
- Valid List props are `aria_label` and `selection`; valid ListItem props include `value`, `selected`, `action`, `activation`, `hover_label`, and `context_menu` in `ui.rs` around lines 2046-2059.
- Valid Table props include `columns`, `rows`, `empty_state`, `selection`, `row_action`, and `activation` in `ui.rs` around lines 2073-2085.
- The core schema is closed per node kind. Do not add renderer-local props to these hub-authored nodes.

## Scope

- Primary adapter work is in `src/App.tsx:429`, `validatedPluginSurfaceSnapshotNode`. It currently rebuilds only `button`/`action` props around `params`, never reads core `payload`, and never rewrites action-bearing props on EmptyState/ListItem/Table/table rows.
- Update botster-web action representation so `ActionBinding` carries core `payload` while keeping existing internal `params` only for non-plugin daemon/package control paths that already depend on it.
- Update plugin-surface action routing so stable route identity remains explicit but separate:
  - `package_name`, `surface_id`, and `action_id` identify the `plugin_surface_action` request.
  - `plugin_surface_action.payload` equals core `UiAction.payload` verbatim.
  - `package_name`, `surface_id`, and `action_id` must not be injected into handler payload.
- In `validatedPluginSurfaceSnapshotNode`, apply plugin surface routing metadata and payload preservation to every current UiAction-bearing location:
  - `props.action`
  - `props.primary_action`
  - `props.secondary_action`
  - `props.row_action`
  - `props.activation`
  - `props.rows[].action`
- Update `src/botster/IonicUiNodeRenderer.tsx` so the renderer consumes the same core interaction props:
  - `action`/`button` preserve and dispatch `payload`.
  - EmptyState renders `action`, `primary_action`, and `secondary_action` as real buttons.
  - ListItem dispatches `activation` on row/item activation gestures: body click and Enter. ListItem `action` renders as a distinct explicit affordance; it must not also fire from the body click. A single row/item body activation must produce exactly one dispatch.
  - ListItem `selected` renders owner-authored selected state with visual class/data and `aria-selected`.
  - List `selection` renders owner-authored selected state read-only, with no local mutation.
  - Table row-specific `rows[].action` renders as a distinct explicit row affordance. Returned Implement review discovered that table-level `row_action` and `activation` cannot carry row identity through `plugin_surface_action`, so botster-web must treat those table-level props as unsupported rather than rendering indistinguishable per-row controls.
  - Table `selection` renders owner-authored selected state read-only.
- Update `src/botster/realHubDogfoodTransport.ts` so plugin-surface dispatch sends `payload: action.payload ?? {}` and never `jsonObject(action.params)` for plugin handler payload.
- Update `scripts/live-packaged-protocol-harness.mjs` because it currently synthesizes a failure action with `fail: true` inside `params`, relying on the params-as-payload bug this ticket removes. Migrate the harness dispatch so route identity remains in routing metadata and the failure trigger is `payload: { fail: true }`; the failure path must still produce `accepted: false` with `contract action failed by request`.
- Add a separately named live payload-contract fixture and smoke script so the payload proof runs repeatably without replacing the canonical contract-matrix fixture.
- Preserve stable plugin host routes from [[botster web plugin app routes are stable host routes]]: `/apps/:package/:surface` and `/apps/:package/settings` continue routing through the route-owned hub connection.

## Non-scope

- No botster-core schema changes.
- No new renderer-local action props or plugin-authoring requirement to emit `params`.
- No broad renderer registry, app routing, entity store, or transport refactor.
- No local browser-grammar fixture as the primary contract proof for this ticket.
- No client-local selection mutation unless a future core contract adds an action for it.
- No package/daemon action migration away from `params` beyond what is necessary to isolate plugin-surface payload semantics.

## Assumptions and unknowns

- Assumption: the checked local core contract at explicit revision `978c436` observed 2026-07-09 is the contract this botster-web run should target. Implement must re-verify `UiAction`, `UiSelection`, and `UiTableRow` at that exact revision before coding. If the implementer sees a different hub-locked core revision in the actual test-support fixture, stop and reconcile before coding.
- Assumption: first-party plugins should receive only `UiAction.payload` as the Lua handler payload. Any current plugin reading `package_name`, `surface_id`, or `action_id` from payload is depending on pollution and must be named in the implementation report.
- Assumption: `params` can remain for existing botster-web daemon/package actions (`daemon_request`, package configuration, spawn target controls), but plugin-surface action payload must use `payload`.
- Assumption: this ticket needs two fixture/proof artifacts, because adapter dispatch proof and hub/plugin proof are different paths:
  - A deterministic JS fixture in hub/core source grammar feeds `validatedPluginSurfaceSnapshotNode` and proves payload reaches botster-web action dispatch unstripped.
  - A first-party Lua plugin package loaded by the live harness proves payload reaches the hub/plugin unchanged.
- Fixture decision: add a separately named first-party botster-web Lua plugin package for the live payload proof, for example `fixtures/plugin-payload-contract` with package name `botster.plugin-payload-contract`. Do not override `botster.plugin-contract-matrix` by name, because that would require cloning the canonical contract-matrix fixture and would hide hub-test-support drift.
- Harness decision: add a second explicit payload-fixture path in `scripts/live-packaged-protocol-harness.mjs`, for example `BOTSTER_PLUGIN_PAYLOAD_CONTRACT_PACKAGE_PATH`, plus a second install/enable call alongside the canonical contract-matrix package. The existing contract-matrix package remains installed and its existing assertions continue to run unchanged.
- Unknown: if implementation discovers that only hub-test-support can honestly host the live fixture, register a dependency ticket before continuing.
- Unknown: whether the live smoke scripts can run in the implementer environment without explicit `BOTSTER_HUB_BIN`/`BOTSTER_SESSION_WORKER_BIN`. For this ticket, that is a blocker, not a report-time waiver: ask a human before coding if the live harness prerequisite is unavailable.

## Affected surfaces/files

- `src/App.tsx:429`: primary surface. `validatedPluginSurfaceSnapshotNode` must translate hub/core grammar (`type`, `children`, action props, `rows[].action`) to browser renderer grammar while preserving payload and route metadata separately.
- `src/botster/actions.ts`: extend `ActionBinding` with `payload?: unknown` while retaining `params?: Record<string, unknown>` for existing internal paths.
- `src/botster/IonicUiNodeRenderer.tsx:386`: action reader must preserve `payload`; avoid rebuilding core actions only around `params`.
- `src/botster/IonicUiNodeRenderer.tsx:733`: EmptyState currently reads non-core `body` and an `actions` slot; it must render core `action`/`primary_action`/`secondary_action`. Existing non-core `body`/slot behavior may remain only as backward compatibility for legacy local snapshots, not as plugin contract.
- `src/botster/IonicUiNodeRenderer.tsx:815`: ListItem currently ignores `selected`, `action`, and `activation` on props; wire them.
- `src/botster/IonicUiNodeRenderer.tsx:833`: Table currently renders plain rows and ignores `rows[].action`, `row_action`, `activation`, and `selection`; wire them.
- `src/botster/realHubDogfoodTransport.ts:1169`: plugin surface dispatch must separate routing metadata from payload and assert routing keys are absent from payload.
- `src/App.test.mjs`: add deterministic behavior coverage for translation, renderer affordances, and action dispatch payload.
- `package.json`: add a wired script, for example `smoke:plugin-payload-contract`, that sets `BOTSTER_LIVE_CONTRACT_MATRIX=1`, sets the new payload fixture path environment variable to the repo fixture package, and runs `scripts/live-packaged-protocol-harness.mjs` after build. `npm run smoke:plugin-contract-matrix` remains the canonical matrix smoke and does not discharge the new payload proof by itself.
- `fixtures/plugin-payload-contract` or equivalent first-party fixture directory: add a minimal Lua plugin package named separately from `botster.plugin-contract-matrix`; it should include only the payload-bearing action, `rows[].action`, and interaction props under this ticket.
- `scripts/live-packaged-protocol-harness.mjs:18`: add a separate payload contract package constant; keep `contractMatrixPackageName` unchanged.
- `scripts/live-packaged-protocol-harness.mjs:315`: install and seed the payload contract package alongside the canonical contract-matrix package when the payload smoke is enabled; do not replace the canonical package.
- `scripts/live-packaged-protocol-harness.mjs:383`: add a resolver for the second payload package path/env var instead of reusing `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH` for this ticket's fixture.
- `scripts/live-packaged-protocol-harness.mjs:834`: keep the existing contract-matrix action proof for canonical behavior, and add a separate payload-contract action proof that targets the new package and asserts payload is received unchanged.
- `scripts/live-packaged-protocol-harness.mjs:849`: migrate synthesized failure dispatch from `params.fail` to `payload.fail` and require the existing failure-path assertion to stay green.
- `README.md` and `docs/architecture.md`: no current `params` plugin-authoring leak was found; keep a guard/assertion only if implementation adds or touches docs.

## Fixture strategy

- Deterministic adapter fixture: use a first-party botster-web JS fixture authored in hub/core source grammar, not browser target grammar:
  - `type`, not only `primitive`.
  - `children`, not only `slots.children`.
  - core action objects such as `action = { id, payload = { workspace_id = "workspace-alpha" }, disabled = false }`.
  - a table with `props.rows[].action` carrying the per-row `workspace_id` payload.
  - EmptyState with `primary_action` and/or `secondary_action`.
  - List/ListItem selected state and activation/action props.
- Live hub/plugin fixture: add a first-party Lua plugin package in a repo fixture directory such as `fixtures/plugin-payload-contract`, named separately from the canonical matrix package, for example `botster.plugin-payload-contract`. This Lua fixture must emit a payload-bearing action from hub/core grammar and echo the received payload in a structured result so the harness can assert handler receipt.
- Harness wiring for the live fixture: add a second package constant, resolver, env var, install/enable path, and smoke script such as `npm run smoke:plugin-payload-contract`. The script must set the payload fixture path itself so the proof is durable and repeatable, not a manual shell-export step.
- Do not extend `src/botster/__fixtures__/uiNodeConformance.ts` as the authoritative fixture unless it is explicitly labeled as a local fallback. [[botster-web should import canonical core uinode fixtures instead of mirroring them]] says mirrors are ticket-level workaround, not durable architecture.
- The deterministic adapter test must feed the source grammar into `validatedPluginSurfaceSnapshotNode`; target-shaped browser fixtures are insufficient per [[adapter test fixtures must validate translation not passthrough]].
- If implementation instead extends `@trybotster/hub-test-support`, register and cite the dependency ticket/revision before relying on it.

## Risks

- The primary corruption bug has two sites: `src/App.tsx` drops payload during snapshot adaptation, and `realHubDogfoodTransport.ts` currently sends all `params` as handler payload. Both must change.
- Removing route keys from handler payload is a behavior change for any plugin accidentally depending on polluted payload. Tests must include a negative assertion that `package_name`, `surface_id`, and `action_id` are absent from payload.
- The live harness currently depends on the bug: its failure path sends `fail: true` through `params`. If that dispatch is not migrated to `payload`, the harness will time out or falsely pass the wrong behavior.
- The live fixture currently installed from `@trybotster/hub-test-support` 0.1.2 has no payload-bearing UiAction, no `rows[].action`, and no activation/primary/selection props. It can prove transport shape only after being extended upstream or supplemented by a separately named local payload-contract fixture; it cannot satisfy the headline acceptance as-is.
- Overriding `botster.plugin-contract-matrix` with a local package would create a full-fidelity mirror of the canonical fixture and hide drift in hub-test-support. The plan forbids that path; add a second package instead.
- `table.props.rows` is a props array, not child slots. Slot-recursive adaptation will not reach `rows[].action` unless table rows are handled explicitly.
- EmptyState currently supports non-core local shapes (`body`, `actions` slot). Removing them may break local diagnostic snapshots; keeping them must be labeled compatibility and not treated as core plugin authoring guidance.
- Selection is owner-authored read state. Client-local mutation would invent semantics and risk schema-invalid output.
- The installed dependency set can drift; baseline must start with `npm ci`.
- Live harness proof may require local hub/session-worker binaries; if unavailable, ask a human before coding because this ticket requires live proof.

## Acceptance checks/tests

- Precondition baseline: `npm ci`, then `npm test` must pass before source changes. This was verified in Plan after the worktree was returned.
- Node/component behavior tests in `src/App.test.mjs` must prove:
  - `validatedPluginSurfaceSnapshotNode` translates hub/core source grammar and preserves `UiAction.payload`.
  - A table `props.rows[].action` with `payload: { workspace_id: ... }` reaches action dispatch with that payload.
  - The outbound `DaemonRequest { type: "plugin_surface_action" }` request payload deep-equals the fixture-authored core `UiAction.payload`, for example `{ workspace_id: ... }`. This request-payload equality is the negative assertion that route keys are absent. Do not apply this assertion to `plugin_action_result` payloads; action results may legitimately contain `package_name`.
  - EmptyState primary/secondary actions render as operable buttons.
  - ListItem `activation` body click and Enter dispatch exactly once; ListItem `action` renders as a distinct explicit affordance.
  - `rows[].action` renders as the explicit row affordance. Table-level `row_action` and `activation` produce explicit unsupported rendering evidence until the shared contract carries row identity.
  - `selection` and `list_item.selected` render selected state read-only with `aria-selected`/class/data evidence and no local mutation.
- Live harness migration proof: `scripts/live-packaged-protocol-harness.mjs` must migrate its synthetic failure dispatch from `params: { ..., fail: true }` to route metadata plus `payload: { fail: true }`, and `waitForContractActionResult(... accepted: false ...)` must still pass with `contract action failed by request`.
- Canonical live regression proof: `npm run smoke:plugin-contract-matrix` remains mandatory to prove the existing contract-matrix package still works and the harness failure dispatch migration did not break the canonical package.
- Payload live regression proof: add and run a wired command such as `npm run smoke:plugin-payload-contract`. The command must set the local payload fixture path environment variable itself, install/enable the separately named payload package alongside the canonical package, and prove a payload-bearing plugin action reaches the Lua handler unchanged. If the live harness prerequisite is unavailable, block and ask a human before implementation rather than waiving the command in the report.
- Existing `npm test` remains required after implementation.
- Run `npm run typecheck` and `npm run lint` if touched TypeScript surfaces compile through those gates.
- Documentation guard: grep `README.md` and `docs/architecture.md` for plugin-authoring guidance that requires renderer-local `params`; current baseline has none, so the check is preservation evidence, not a planned doc migration.

## Vault gaps worth capturing

- Capture the confirmed botster-web boundary: plugin-surface actions use core `payload`; internal botster-web daemon/package control actions may still use `params`.
- Capture the exact renderer behavior for owner-authored `selection`, `list_item.selected`, and table row actions after implementation.
- Capture any first-party plugin found to depend on polluted payload route keys.
- Capture whether the first-party hub-grammar fixture should graduate into `@trybotster/hub-test-support` as canonical cross-client conformance data.
