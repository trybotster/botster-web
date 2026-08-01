---
description: Plan to retain the selected plugin route and replay only its owner-authored surface pull after WebRTC reconnect
---

# Replay the selected plugin surface pull after reconnect

## Target repository and routing

- Ticket: `ticket_1785553389_894623`, "Web: replay selected plugin surface pull after reconnect".
- Run: `run_1785553417_250750`, Plan step `botster_stack_plan`.
- Authoritative target repository: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- The target was resolved from `project_pipelines_current_context` through the admitted spawn-target registry, not inferred from the process directory. The registry display name is misspelled `booster-web`, but its path, Git remote, and `repo_name` all identify `trybotster/botster-web` unambiguously.
- Assigned worktree: branch `project-pipelines/ticket_1785553389_894623` at baseline `8672e149c5eec2f750cf000de921d2032807d144`.

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. The targeted Botster/Web/reconnect notes below
5. [[project-pipelines-playbook]] for this run's durable checklist, artifact, gate, dependency, and advancement workflow; Project Pipelines implementation is not in scope

Botster role and architecture guidance:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]

Web charter guidance:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]

Targeted reconnect and surface guidance:

- [[botster browser pull requests must retry after webrtc reconnect]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[botster client subscriptions should not hydrate global state]]
- [[scoped entity snapshots preserve whole-family sequence gates]]
- [[botster spa has one route owned hub control plane connection]]
- [[botster webrtc request consumers should use operation gates not connection checks]]
- [[plugin surfaces request model state through ui bindings not hub subscribe]]
- [[botster plugin surfaces own navigation and plugin scoped sessions]]
- [[plugin-owned dynamic state uses plugin-namespaced entity frames]]
- [[plugin surface route completion needs explicit render phase]]
- [[browser transport helper modules must depend inward via injected callbacks]]
- [[packaged botster web reloads need fresh webrtc grants]]

## Context loaded

- `project_pipelines_current_context` supplied the ticket, active run/step, Plan gate schema, empty initial artifacts/findings/reviews/questions, and dependency state.
- `README.md`, `docs/architecture.md`, `package.json`, `package-lock.json`, current production sources, deterministic tests, the live packaged protocol harness, and repo-local prior plans were inspected. There is no `.github` workflow in this repository; the npm scripts documented by the README are the repository gates. Existing mainline artifacts establish `docs/plans/` as the plan destination.
- The baseline is clean. `npm test` exits 0 with protocol-drift plus runtime/renderer assertions, and `npm run typecheck` exits 0.
- `src/App.tsx` derives the selected plugin surface from the stable URL and dispatches its Hub-provided `botster.package.surface.render` action once per route key. `lastPluginRouteRenderKey` prevents a second dispatch for the same selected route for the lifetime of the mounted app.
- `src/botster/webrtcDaemonClient.ts` owns transport generations and automatically recreates the held `session` entity subscription after a DataChannel close. Its lifecycle events currently feed diagnostics but do not cause the selected route's surface request to replay.
- `src/botster/hubTransport.ts` is the normal Web-to-Hub adapter. Descriptor-backed surface renders travel through `runtimeClient.actions.dispatch` -> `HubControlFrame(action_request)` -> `plugin_surface_render`; reconnect recovery must keep using that path rather than call the daemon bridge directly.
- `src/botster/entities.ts` already treats full snapshots as authoritative replacements and tracks explicit entity pulls, but replaying every active package/app/list pull would violate this ticket's narrow selected-surface recovery requirement. The held `session` subscription already supplies the authoritative model baseline needed by the selected surface's bindings.
- `scripts/live-packaged-protocol-harness.mjs` already proves stable plugin routes, fresh WebRTC generations, authoritative `session` snapshots, owner-authored UiNode rendering, and bounded last-state evidence. The Workspaces lifecycle mode merged in the baseline exposes the generic Web defect when the selected surface does not reopen after reconnect.
- `fixtures/plugin-payload-contract` and the Hub-test-support contract matrix establish the repository's package-fixture and live-harness patterns. The regression must use a generic Web-owned plugin surface fixture, not Workspaces-specific semantics.
- Downstream ticket `ticket_1785296184_677408` targets `botster-workspaces` (`tgt_71266a8d976d4535902ffed09c18a7ba`) and already has dependency `dependency_1785553403_441166` on this Web ticket. No new or reversed dependency edge is needed.

## Scope

1. Preserve the selected plugin app route and its exact Hub-provided render descriptor as the mounted view's active surface pull across a WebRTC transport generation change.
2. Make the route render guard generation-aware: dispatch once on the initial selected route and exactly once again after each confirmed fresh reconnect generation while that same route remains selected. Route changes replace the active request; leaving the route clears it.
3. Feed reconnect readiness into the route-owned replay coordinator through the existing typed WebRTC/Hub composition seam. Keep transport lifecycle ownership below the React view, and inject/forward only the minimal reconnect-ready signal needed by the route coordinator; do not make request consumers inspect peer internals.
4. Replay the selected surface through `runtimeClient.actions.dispatch` and the normal `HubControlFrame`/`createHubTransport` action path. Do not invoke `DaemonBridgeClient.request`, `plugin_surface_render`, or plugin code directly from `App.tsx`.
5. Correlate the replayed result to the current route's package, surface, route key, request, and transport generation. Ignore stale results from a prior route or generation. Preserve explicit `rendering | rendered | error` completion and bounded diagnostics.
6. Reconcile the accepted matching `plugin_surface.ui_tree_snapshot` as the new selected owner-authored tree. Let the existing entity store and frame-version invalidation render its `ui.bind`/`ui.bind_list` content against the fresh authoritative `session` snapshot; do not synthesize tree content or lifecycle state in Web.
7. Add a deterministic generic plugin-surface reconnect fixture/test that distinguishes the initial owner-authored tree from the replayed owner-authored tree and proves one request per generation, stable route ownership, matching-result replacement, and stale-result rejection.
8. Extend the existing packaged WebRTC browser harness with a generic opt-in reconnect proof using a repository-owned generic plugin package fixture. It must keep the page on the selected stable app URL, observe a fresh transport/subscription generation, observe exactly one replayed `plugin_surface_render`, and assert the replay response changes the real rendered Ionic surface.
9. Retain compact failure evidence: selected route, transport/subscription generation, surface-render request/result identities and counts, latest accepted owner tree, rendered surface text/node ids, and relevant entity chronology. Do not dump secrets, grants, or broad process logs.
10. Update `README.md` and `docs/architecture.md` only to describe the verified selected-surface reconnect behavior and the new focused command/fixture if implementation adds one.

## Non-scope

- No Workspaces-specific package name, surface id, lifecycle class, row identity, client state, fixture branch, or locally synthesized workspace/session truth.
- No changes to `botster-workspaces`, Hub, Hub Client, Core, TUI/TUI-kit, UI Contract, Project Pipelines plugin code, or published test-support packages in this run.
- No subscribe-time hydration, `list_sessions`, imperative list refresh, replay of every package/app/marketplace/spawn-target pull, or global entity-store reset. The sanctioned held `session` subscription remains the model-state reconnect path.
- No new physical connection owner, second WebRTC client, direct bridge request, HTTP fallback, polling, timing retry, fixed sleep, or retry-until-green loop.
- No browser-authored UiNode tree, surface body fallback, lifecycle projection, compatibility route, or fixture-specific production branch.
- No weakening of identity matching, stale-generation filtering, action correlation, explicit render phases, or bounded failure diagnostics.
- No sibling worktree consumption. The downstream Workspaces rerun must occur in its own routed ticket/worktree against its real branch.
- No dependency/version changes unless the authoritative protocol drift check proves an actual consumed-contract prerequisite; if so, stop and register that separately rather than guessing DTOs.
- No adjacent route, renderer, terminal, marketplace, settings, or package-list cleanup.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns:** the stable browser route, selected-surface request lifetime, reconnect replay coordination, normal Hub transport adaptation, matching-result reconciliation, Ionic rendering, diagnostics, generic fixture, deterministic tests, and packaged browser acceptance.
- **botster-workspaces owns:** workspace records, session-reference lifecycle semantics, current/ended/unavailable grouping, and the owner-authored production tree. `ticket_1785296184_677408` already depends on this ticket and must rerun the corrected merged Web mode against its real branch before closing.
- **botster-hub / hub-client own:** WebRTC daemon protocol, fresh session subscription generations, authoritative session snapshots/deltas, package descriptors, plugin worker execution, and daemon request/result truth. This run consumes those public contracts unchanged.
- **botster-core / UI Contract own:** renderer-neutral UiNode/action/binding grammar and validation. Web accepts the identity-matched `ui_tree_snapshot` and renders it without inventing a second grammar.
- **Project Pipelines owns:** this run's durable checklist, gate, artifact, and existing dependency edge only. Its plugin/package implementation is not touched.
- There is no blocking cross-repository prerequisite for the Web implementation. If the generic fixture cannot express the required behavior through current admitted public contracts, stop and register the missing contract against its owning target rather than broadening this run.

## Assumptions and unknowns

- Assumption: a typed reconnect-ready event can identify a fresh transport generation without exposing `RTCPeerConnection` or DataChannel objects to React. The implementer should use the narrowest existing lifecycle seam and include generation identity if needed to deduplicate opens.
- Assumption: the selected route's descriptor-backed render action is the surface pull to retain. It is read-shaped even though the current adapter carries it through the correlated action envelope; this ticket does not rename or fork the public Hub request.
- Assumption: the initial DataChannel open must not cause a duplicate render. The replay key therefore needs to distinguish initial route hydration from later confirmed generations.
- Assumption: the replayed owner tree may arrive before or after the reconnect `session` snapshot. Existing frame-driven rerendering must converge either ordering without a second surface render or list refresh.
- Assumption: settings surfaces are outside the reported `selected-app-surface` defect unless a generic failing test proves they share the same route-owned pull path. Do not bulk-retrofit them speculatively.
- Unknown: whether the smallest clean seam is a generation callback on the injected daemon client, a transport lifecycle callback, or a Hub-level reconnect event. Choose after a focused failing test, but keep the dependency direction runtime/transport -> injected coordinator -> route and never helper -> React import.
- Unknown: whether the generic live fixture should extend the existing repository payload-contract package or use a dedicated reconnect package. Prefer the smallest fixture change that exposes two distinguishable owner-authored renders without coupling unrelated payload assertions.
- Unknown: whether a response from the failed generation can reach the action dispatcher after reconnect. Deterministic coverage must settle this; if possible, gate it by request plus route/generation identity rather than relying on timing.
- Convention conflicts: none. The plan keeps runtime and producer truth in their owners, uses one route-owned connection, preserves pull-based hydration, reuses framework/repository seams, and avoids speculative abstraction or compatibility paths.

## Affected surfaces and files

- `src/App.tsx`: retain the selected route's active surface pull, make the once-per-route guard generation-aware, dispatch replay through the normal runtime client, reject stale route/generation results, and reconcile the returned tree/status.
- `src/botster/webrtcDaemonClient.ts`: likely expose a typed fresh-generation/reconnect-ready lifecycle signal through the existing injected lifecycle seam; no React import or request-specific policy.
- `src/botster/hubRuntime.ts` and/or `src/botster/hubTransport.ts`: likely forward/inject the minimal lifecycle signal at the existing composition boundary. Do not add a second transport or direct surface daemon call.
- `src/botster/protocol.ts` or `src/botster/client.ts`: only if a Hub/runtime-level reconnect observer is the smallest way to keep React independent of WebRTC internals. Avoid broad protocol vocabulary changes.
- `src/botster/entities.ts`: expected unchanged; its authoritative snapshot reconciliation is exercised, not expanded into global pull replay.
- `src/App.test.mjs`: add deterministic route/generation/request/reconciliation regression coverage and source guards against direct bridge/list-refresh/Workspaces-specific paths.
- `fixtures/plugin-payload-contract/{botster-package.json,plugin.lua}` or a focused sibling fixture under `fixtures/`: generic owner-authored surface whose initial and replayed render trees are distinguishable. Final placement follows the smallest established fixture pattern.
- `scripts/live-packaged-protocol-harness.mjs`: add the focused generic reconnect scenario and bounded last-state evidence while reusing current Hub/browser/WebRTC setup.
- `scripts/live-packaged-protocol-helpers.mjs`: only if a small pure chronology/evidence helper is needed by both the harness and deterministic tests.
- `package.json`: only if a focused opt-in smoke command is added.
- `README.md`, `docs/architecture.md`: document only the shipped reconnect behavior and runnable proof.
- `docs/plans/replay-selected-plugin-surface-pull-after-reconnect.md`: this plan artifact.

## Implementation outline

1. Add a failing deterministic regression around the current selected-route guard: one initial surface request succeeds, a fresh reconnect generation occurs without a route change, the pull replays once, and the second matching owner tree replaces the first.
2. Expose/forward the minimal typed generation-ready signal through the existing WebRTC -> runtime/transport composition boundary. Prove initial open and reconnect are distinguishable and duplicate lifecycle notifications do not duplicate requests.
3. Replace the lifetime-only `lastPluginRouteRenderKey` rule with route-plus-generation pull ownership. Preserve the route URL and current surface during reconnect; mark rendering/error only when the current generation's correlated request warrants it.
4. Send initial and replay requests through the same descriptor-backed runtime action path. Apply only the matching current result and preserve existing explicit phase, diagnostics, presentation scope, and UiNode snapshot adaptation rules.
5. Add the generic owner-authored plugin fixture and exercise it through the existing packaged WebRTC browser harness. Force the real reconnect boundary already used by the harness, then assert fresh generation, one replay request, accepted matching response, and changed rendered tree with no global list refresh.
6. Add negative assertions for duplicate replays, stale route/generation responses, `list_sessions`, package/list refresh during reconnect, direct daemon-bridge surface calls, Workspaces literals in production code, and timing-retry loops.
7. Update focused docs, run repository gates, and attach both generic runtime proof and the downstream Workspaces handoff requirement.

## Risks

- **Initial-open duplication:** treating every DataChannel open as reconnect can issue two initial renders. Gate replay on a fresh post-initial generation and assert exact request counts.
- **Reconnect ordering:** session snapshot and surface result can arrive in either order. Keep structural tree replacement separate from entity-frame reconciliation and prove eventual rendered convergence.
- **Stale response overwrite:** a failed generation or prior route may complete late and replace the current tree. Correlate package, surface, route key, request id, and generation before applying.
- **Over-hydration:** calling `replayActivePulls()` globally would refresh unrelated lists and violate subscribe/pull ownership. Replay only the selected surface; retain the held session subscription for bound model state.
- **Reconnect storm:** close/error and resubscribe signals may describe one generation more than once. Use generation identity and an idempotent route-generation key, not debounce sleeps.
- **Fixture leakage:** a generic fixture can accidentally create a production special case. Keep fixture behavior in Lua/package assets and assert production source contains no fixture/package identifiers.
- **Diagnostic bloat or secrets:** transport evidence can contain grant material. Project only bounded identities/counts/tree/text/entity chronology and retain existing redaction checks.
- **Downstream false green:** a static tree could render after reconnect without proving replay. The fixture must expose distinguishable owner-authored generations and the harness must observe the second `plugin_surface_render` request/result.

## Acceptance checks and tests

Repository gates:

- `npm test`
  - Protocol drift passes.
  - Deterministic runtime coverage proves initial request once, reconnect replay once, route preservation, current-result matching, stale-result rejection, owner-tree replacement, and entity snapshot convergence.
  - Source guards reject direct bridge surface calls, `list_sessions`, global refresh fallback, Workspaces literals, and timing retry loops.
- `npm run typecheck`.
- `npm run lint` with no new errors or warnings attributable to this change.
- `npm run build`.
- `npm run smoke:browser-runtime` to keep ordinary fixture and missing-bootstrap behavior green.

Focused production-path proof:

- Run the focused generic plugin-surface reconnect mode through `scripts/live-packaged-protocol-harness.mjs` with explicit `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` (using the final repo-owned npm command if one is added).
- The harness must install/enable the generic fixture through Hub, open its admitted stable route in the real React/Ionic app, and render the initial owner tree.
- Without navigating away or synthesizing DOM/state, cross the existing real WebRTC reconnect boundary and prove a fresh transport/session-subscription generation.
- Observe exactly one additional normal `plugin_surface_render` request for the selected package/surface, its correlated accepted response, and the changed owner-authored tree in `data-testid="selected-app-surface"`.
- Assert no `list_sessions`, no package/app/navigation/spawn-target list refresh caused by reconnect, no second connection owner, no unsupported UiNode, no page/console/404 error, no leaked grant secret, and normal cleanup.
- On failure, retain bounded last-state diagnostics named in Scope item 9 and exit non-zero; no retry timing may turn the result green.

Regression and downstream proof:

- `npm run smoke:plugin-contract-matrix` remains green, including canonical session snapshot/delta/reconnect bindings and existing stable route/direct-load behavior.
- `npm run smoke:workspaces-lifecycle` remains the real product consumer mode, but this Web run must not read a sibling Workspaces worktree or encode Workspaces behavior in the fix.
- After the Web fix is merged, downstream `ticket_1785296184_677408` must run the corrected merged `smoke:workspaces-lifecycle` against its real Workspaces branch (the defect was observed at PR #11 commit `fce8aba`) and obtain exit 0 before that producer ticket closes. The existing dependency `dependency_1785553403_441166` enforces this ordering.
- If the downstream command still times out reopening `selected-app-surface`, or only passes after a list refresh/retry/synthetic tree, this ticket's acceptance is not satisfied.

## Pipeline artifacts and gates

- Commit this repo-local plan and attach it as the Plan artifact/gate evidence.
- The Project Pipelines workflow checklist records target resolution, prescribed playbook order, code/CI/prior-art inspection, bounded ownership, tests, and downstream proof.
- The vault checklist records exact note titles, convention conflicts (`none`), baseline verification (`npm test`, `npm run typecheck` both exit 0), and capture disposition.
- Plan Review should verify the current target/remote, this artifact, the already-registered downstream dependency, and that the plan does not silently turn a Web reconnect fix into Workspaces, Hub, or Project Pipelines implementation.

## Vault gaps worth capturing

- No new note is needed at Plan time: [[botster browser pull requests must retry after webrtc reconnect]] already states the durable rule, while [[botster web plugin app routes are stable host routes]] and [[plugin surface route completion needs explicit render phase]] cover route and completion ownership.
- Capture after implementation only if the concrete route-plus-transport-generation replay key becomes a reusable Botster Web pattern not already present in those notes.
- Capture after implementation only if owner-authored tree reconciliation has a stable ordering rule relative to authoritative entity snapshots that is not covered by [[botster entity snapshots are authoritative reconnect baselines]].
- Do not capture Workspaces commit ids, fixture markers, ticket ids, or one-off harness commands as architectural knowledge.

## Convention check

- No convention conflict. Every planned runtime line traces to reconnecting the currently selected surface, accepting the authoritative producer tree, or proving that path. The plan uses the existing route, WebRTC runtime, Hub action transport, Ionic renderer, entity store, and live harness; it adds no speculative product abstraction, compatibility path, global refresh, or cross-repository implementation.
