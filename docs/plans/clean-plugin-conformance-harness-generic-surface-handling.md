# Clean Plugin Conformance Harness And Generic Surface Handling Plan

## Context Loaded

- Pipeline context: ticket `ticket_1783296451_109737`, run `run_1783296524_171414`, step `botster_plan`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, gate `botster_plan_gate`. No prior artifacts, findings, reviews, questions, or answers were present.
- Role and vault context: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan steps need reviewable plan artifacts]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Ticket-specific vault constraints: [[runtime client acceptance must render delivered snapshots through real registry]], [[botster-web should import canonical core uinode fixtures instead of mirroring them]], [[plugin surface route completion needs explicit render phase]], [[plugin surface handlers must validate against hub locked uinode contract]], [[botster settings store keeps state transitions while helpers own filesystem mechanics]].
- Project Pipelines checklist: `project_pipelines_checklist_instructions` was loaded. `project_pipelines_create_vault_checklist` timed out with the known plugin worker timeout, so checklist evidence is preserved in this plan and the Plan gate evidence per [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context sampled: `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, `src/botster/pluginSurfaces.ts`, `src/botster/uiNodes.ts`, `src/App.test.mjs`, `package.json`, and existing `docs/plans/*` artifacts.
- Baseline command evidence: `npm test` currently stops at `scripts/check-daemon-protocol-drift.mjs` because the authoritative hub daemon protocol artifact is not present in this checkout. `node src/App.test.mjs` passes with `Renderer seam, runtime behavior, and registry fixture assertions passed.`

## Scope

- Remove committed Project-Pipelines ticket-numbered or ephemeral fallback paths from `scripts/live-packaged-protocol-harness.mjs`; keep portable environment variables and stable hub checkout fixture references only.
- Tighten plugin contract matrix smoke assertions so app/settings/action/blocked paths match deterministic fixture-owned strings and structured harness events, not broad fragments such as `accepted`, `error`, or `operator`.
- Replace fixture-specific `contract.action` dispatch and toast handling in shipped app/transport code with generic package/surface/action metadata:
  - actions emitted from plugin surface body normalization should carry package name, surface id, and action id;
  - real hub dispatch should translate those metadata fields into `plugin_surface_action`;
  - feedback should derive from returned plugin action result or generic action result data, not a hardcoded contract id.
- Revisit client-side UiNode body synthesis/remapping narrowly:
  - prefer hub-provided `ui_tree_snapshot` when returned;
  - keep any body-to-UiNode fallback only as a documented compatibility boundary for placeholder `plugin_surface.body` payloads;
  - do not expand the local primitive swap table unless the live hub contract requires it.
- Tighten settings-surface freshness so rendered settings assertions prove saved or seeded effective configuration is visible after refresh/reopen, not that default labels render.
- Re-run and document the existing live packaged protocol smoke and packaged browser smoke after shared helper changes.

## Non-Scope

- No redesign of the UiNode contract, entity store, action dispatcher, package registry DTOs, or daemon protocol.
- No broad migration from local mirrored UiNode fixtures to canonical core fixtures unless the import seam already exists in the checked-out hub artifacts; otherwise record the dependency gap.
- No Botster hub/core changes from this repo step except pointing existing scripts at externally supplied hub binaries/artifacts.
- No new optional harness modes, compatibility aliases, or product-specific special cases beyond removing the current fixture-specific paths.
- No UI restyling or app-shell redesign.

## Botster Layers Touched

- React/Ionic SPA runtime path: `src/App.tsx`, `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`.
- Browser-to-hub transport adapter: `src/botster/realHubDogfoodTransport.ts`.
- Plugin conformance and packaged smoke harnesses: `scripts/live-packaged-protocol-harness.mjs`, `scripts/packaged-browser-smoke.mjs` if helper assertions are shared or documented there.
- Static/conformance tests: `src/App.test.mjs`.
- Docs/test command surface: `README.md` or `docs/architecture.md` only if current smoke instructions need updating to match the cleaned harness.

## Worktree And Target Assumptions

- Implementation agents must work in the assigned pipeline worktree for run `run_1783296524_171414`, not an ambient checkout.
- Hub binaries and fixtures are external inputs. Live verification should use `BOTSTER_HUB_BIN`, `BOTSTER_SESSION_WORKER_BIN`, `BOTSTER_HUB_SOURCE_DIR`, `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH`, `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL`, or sibling checkout paths that are stable and path-neutral.
- If no compatible hub binary/artifact is available in an implementer environment, the implementation must still update static/local tests and preserve exact live commands plus the reason the live smoke could not run.

## Assumptions And Unknowns

- Assumption: the contract matrix fixture provides deterministic success, rejected/error, blocked, settings, and seeded-configuration strings. The harness should assert those exact strings or structured response fields.
- Assumption: plugin surface body action nodes can carry enough metadata in `props.action` or action params to dispatch generically without recognizing `contract.action`.
- Assumption: settings freshness can be proven from package `configuration.effective_values`, action_result payloads, or a settings surface summary after save/reopen/reload.
- Unknown: whether the current hub response exposes a validated `ui_tree_snapshot` for all contract matrix surfaces. If not, document the boundary in code/docs and open a narrow dependency ticket for hub-provided validated snapshots or canonical fixture import.
- Unknown: whether the packaged browser smoke shares any helper path with the live protocol harness. If it does not, only document that it was rerun unchanged.

## Affected Surfaces And Files

- `scripts/live-packaged-protocol-harness.mjs`
  - Remove any ticket-numbered fallback path.
  - Tighten `assertContractBlockedSurface`, `exerciseContractMatrixActions`, `assertContractSettingsSummary`, and settings freshness checks.
  - Ensure failure messages include observed harness events without leaking local paths or secrets.
- `src/botster/realHubDogfoodTransport.ts`
  - Replace the `action.id === "contract.action"` branch with generic plugin surface action dispatch based on package/surface/action metadata.
  - Preserve existing `botster.package.surface.render`, package configuration, package daemon request, spawn, attach, and diagnostic paths.
- `src/App.tsx`
  - Remove `contract.action` toast special-casing.
  - Keep route render phase behavior and settings route rendering intact.
  - Narrow or document `normalizePluginSurfaceNode` primitive remapping if retained.
- `src/botster/IonicUiNodeRenderer.tsx` and `src/botster/UiNodeSurface.tsx`
  - Touch only if action metadata collection/dispatch requires preserving generic action params through rendered nodes.
- `src/App.test.mjs`
  - Add assertions that shipped code no longer contains fixture-specific `contract.action` dispatch/toast logic.
  - Add assertions for generic `plugin_surface_action` translation and deterministic harness expectations where practical.
- `README.md` or `docs/architecture.md`
  - Update only if smoke command prerequisites or hub artifact variables are stale after cleanup.

## Risks

- Over-tightened smoke assertions may become brittle if they assert presentation copy owned by the browser instead of fixture-owned strings or structured hub events.
- Removing `contract.action` special casing can break the conformance smoke if action metadata is lost while normalizing `plugin_surface.body` into UiNode actions.
- Body-to-UiNode normalization can become a second client-side contract fork. Keep it documented as fallback and prefer delivered `ui_tree_snapshot`.
- Settings freshness can false-pass if it only checks input labels or defaults. It must assert the saved/seeded endpoint/mode/secret-state values after a hub refresh path.
- Live smoke commands depend on external hub binaries, session-worker binaries, browser availability, and authoritative generated protocol artifacts.
- Harness logs can accidentally expose local paths or secrets. Assertions and plan/report text should use path-neutral wording and preserve `api_token` redaction checks.

## Acceptance Checks And Tests

- Static/local:
  - `node src/App.test.mjs` passes.
  - `npm test` passes when `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` or a stable sibling hub checkout provides the authoritative daemon protocol artifact.
  - `npm run build` passes.
  - Optional if touched code warrants it: `npm run lint` and `npm run typecheck`.
- Live packaged protocol:
  - `npm run smoke:live-packaged-protocol` with `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` supplied.
  - `npm run smoke:plugin-contract-matrix` with `BOTSTER_LIVE_CONTRACT_MATRIX=1` and `BOTSTER_PLUGIN_CONTRACT_MATRIX_PACKAGE_PATH` or `BOTSTER_HUB_SOURCE_DIR` supplied.
  - The contract matrix smoke must fail on loading-only route behavior and dispatch-only action behavior.
- Packaged browser:
  - `npm run smoke:packaged-browser` after any shared helper or route/render behavior changes.
- Source hygiene:
  - `rg -n "project-pipelines-""ticket|botster-""sessions|/""Users/" scripts src docs README.md package.json` should find no committed ephemeral ticket worktree paths or PII in changed artifacts.
  - `rg -n "contract\\.action" src scripts` should show only fixture/harness setup or deterministic fixture assertion text, not generic product dispatch/toast branches.
  - `rg -n "accepted\\|error\\|operator" scripts/live-packaged-protocol-harness.mjs` should be reviewed so broad regex fragments are not used as the only success/error/blocked proof.

## Pipeline Gates And Artifacts

- Plan gate evidence should point to this plan and include the checklist timeout fallback, loaded vault notes, baseline command evidence, and convention conflict result.
- Plan Review should verify the implementation plan stays surgical and does not introduce dual product-specific action paths.
- Implement gate should include changed production entry paths, exact command results, and live-smoke results or explicit unavailable-hub evidence.
- Verify should rerun the acceptance checks against the live worktree and inspect source hygiene scans, not only accept implementer summaries.

## Vault Gaps Worth Capturing

- Capture a new note if the hub still cannot expose validated `ui_tree_snapshot` or canonical UiNode fixture artifacts to botster-web, because this ticket is another recurrence of local client-side UiNode grammar fallback.
- Capture a new note if generic `plugin_surface_action` dispatch reveals a reusable action metadata convention for hub-provided plugin surfaces.
- Capture a new note if settings freshness needs a standard conformance pattern for saved `configuration.effective_values` versus schema defaults.
- No convention conflicts found in planning. The plan follows the loaded Botster boundaries: plugin/product behavior stays metadata-driven, browser acceptance renders delivered surfaces through real runtime paths, and checklist timeout evidence is preserved in durable artifacts.
