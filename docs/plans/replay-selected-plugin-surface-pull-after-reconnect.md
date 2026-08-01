---
description: Plan to preserve the selected plugin URL across packaged WebRTC reconnect and prove its route-owned surface pull replays through Hub
---

# Replay the selected plugin surface pull after reconnect

## Target repository and routing

- Ticket: `ticket_1785553389_894623`, "Web: replay selected plugin surface pull after reconnect".
- Run: `run_1785553417_250750`, returned Plan step `run_step_1785554568_309118`.
- Authoritative target repository: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- The target was resolved from Project Pipelines context through the spawn-target registry and confirmed by Git remote. The registry display name is misspelled `booster-web`, but path and `repo_name` identify `trybotster/botster-web` unambiguously.
- Worktree branch: `project-pipelines/ticket_1785553389_894623`. Baseline is merge `8672e149c5eec2f750cf000de921d2032807d144`; the first Plan artifact is commit `6e27b2b` and this revision supersedes its unsupported diagnosis.

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. Targeted Web, route, surface, hydration, and reconnect notes
5. [[project-pipelines-playbook]] for durable review findings, checklists, artifacts, gates, and advancement; Project Pipelines implementation is not in scope

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

## Context loaded and reproduced failure

- `project_pipelines_current_context` supplied the returned Plan step, prior artifact/gate, Plan Review verdict, six open findings, dependency state, and both workflow/vault checklists.
- `README.md`, `docs/architecture.md`, `package.json`, `package-lock.json`, production route/transport/entity/action sources, deterministic tests, live harness, and relevant prior plans were inspected. There is no `.github` workflow; README/package npm scripts are repository gates. `docs/plans/` remains the authoritative artifact destination.
- Baseline `npm test` and `npm run typecheck` exit 0. Plan Review independently repeated both after fetching current remote refs.
- `src/App.tsx` parses the selected plugin URL, performs normal startup pulls, resolves the Hub-provided surface descriptor, and dispatches `botster.package.surface.render` through `runtimeClient.actions` once after route resolution. A hard reload remounts `App`, so `lastPluginRouteRenderKey` is recreated as `undefined`; it cannot suppress the post-reload request.
- The initial plan's generation-aware `webrtcDaemonClient -> hubRuntime -> App` design is rejected. The live harness has no in-place mounted-document DataChannel-drop path, and the reported Workspaces boundary is a hard navigation/remount.
- `reloadSamePackageUrlAndAssertWebrtc` in `scripts/live-packaged-protocol-harness.mjs` checks only origin equality. It reloads the current URL only when `cycle === 1`; all other values call `revisitPackageRuntime(page)`, which navigates to root `appUrl`.
- `exerciseWorkspacesLifecycle` passes string `"workspaces-lifecycle"` as `cycle`. The strict numeric comparison fails, so the helper navigates from the selected Workspaces route to package root. The next statement calls `assertSelectedAppSurfaceRendered`, which must time out because root has no selected plugin route.
- This was reproduced against Web baseline `8672e14` with Hub binaries from the authoritative `botster-hub` checkout and an immutable `/private/tmp` archive of exact Workspaces PR #11 commit `fce8aba572e80f07db4041f915f4c2d9860b9e40` (not a sibling worktree and without changing that repository). Exact command:

  `BOTSTER_HUB_BIN=<authoritative debug botster-hub> BOTSTER_SESSION_WORKER_BIN=<authoritative debug botster-session-worker> BOTSTER_WORKSPACES_PACKAGE_PATH=<immutable fce8aba archive> npm run smoke:workspaces-lifecycle`

- The escalated live run exits 1 after the initial compatibility/create/current-to-ended/removal path. Post-navigation WebRTC signaling, DataChannel open, encrypted stream readiness, fresh `session` subscription, authoritative `session` snapshot, and standard startup entity pulls all occur. It then fails at `scripts/live-packaged-protocol-harness.mjs:1392` with `locator.waitFor: Timeout 15000ms exceeded` waiting for `getByTestId('selected-app-surface')`.
- The failure is therefore pinned to `exerciseWorkspacesLifecycle` immediately after `reloadSamePackageUrlAndAssertWebrtc`, before `selectWorkspacesLifecycleWorkspace`, `reconnect-authoritative-history`, or `reconnectGenerationEvidence`.
- The generic `@trybotster/hub-test-support` contract-matrix package is already materialized by this repository's harness and supplies owner-authored `contract.app`/`contract.sessions` surfaces. It is the generic fixture required for the primary regression; no new published fixture or Workspaces-specific test double is needed.
- Downstream `ticket_1785296184_677408` targets `botster-workspaces` and already depends on this ticket through `dependency_1785553403_441166` in the correct direction.

## Scope

1. Correct the packaged browser reconnect helper contract so route-preserving reconnect is explicit and cannot be selected accidentally by overloading a label/cycle argument. Preserve the exact current origin, pathname, search, and hash when the caller is proving a selected plugin route.
2. Keep the reconnect boundary production-shaped: perform a hard reload or same-URL direct revisit that fetches a fresh package HTML bootstrap, opens a fresh WebRTC generation, remounts the real React/Ionic application, and re-enters the stable route.
3. Prove the remounted route performs its existing pull-owned behavior through the normal production path: normal startup descriptor pulls -> route resolution -> `runtimeClient.actions.dispatch` -> `HubControlFrame(action_request)` -> `createHubTransport` -> `plugin_surface_render` -> matching owner-authored tree -> `UiNodeSurface`.
4. Add an exact URL invariant to the route-preserving helper. Before continuing to diagnostics, fail if the full selected route differs after reconnect. Origin-only equality is insufficient.
5. Extend the existing generic contract-matrix browser proof to select an admitted generic plugin surface, record its exact URL and render-request count, cross the route-preserving WebRTC reconnect boundary, and assert:
   - the exact URL is unchanged;
   - grant and `session` subscription identities are fresh;
   - one new matching `plugin_surface_render` travels through the normal Hub transport;
   - an accepted matching owner-authored tree renders in the real selected-surface region;
   - no client-synthesized surface or fixture-specific production branch exists.
6. Change Workspaces lifecycle acceptance to use that same route-preserving helper. Do not pass a semantic label through a numeric navigation branch. After reconnect, keep the selected Workspaces route, wait for its normal owner surface request/result, reselect through rendered controls, and continue existing lifecycle oracles.
7. Retain bounded last-state diagnostics and add the route fields needed to diagnose this class of failure: expected/before/after URL, navigation mode, latest surface render request/result identity/count, latest accepted tree, rendered selected-surface text/node ids, transport/subscription ids, and relevant entity chronology. Continue redacting grant secrets and avoiding broad logs.
8. Add deterministic regression coverage for helper navigation semantics, exact URL preservation, the generic surface request-count oracle, and the Workspaces call-site regression. The test must fail against `8672e14` because that call navigates to root before the selected-surface assertion.
9. Document the corrected route-preserving reconnect proof only if README/architecture wording changes materially; do not claim an in-place transport reconnect that the harness does not exercise.

## Non-scope

- No generation-aware `lastPluginRouteRenderKey`, new WebRTC lifecycle observer, in-place DataChannel-drop harness, or production reconnect coordinator. The reproduced hard reload remounts `App` and does not need them.
- No production changes to `src/App.tsx`, `src/botster/webrtcDaemonClient.ts`, `src/botster/hubRuntime.ts`, `src/botster/hubTransport.ts`, `src/botster/protocol.ts`, `src/botster/client.ts`, or `src/botster/entities.ts` unless the focused generic regression disproves the reproduced route-loss diagnosis.
- No split or generation rewrite of the shared app/settings `lastPluginRouteRenderKey`. Because this plan no longer changes that ref, settings behavior remains untouched; deterministic/source coverage should guard that non-change.
- No Workspaces-specific production state, package name/surface branch, lifecycle classifier, row synthesis, or locally-authored UiNode tree.
- No changes to Workspaces, Hub, Hub Client, Core, TUI/TUI-kit, UI Contract, Project Pipelines plugin code, or published test-support packages.
- No subscribe-time hydration, `list_sessions`, polling, retry loop, fixed sleep, second WebRTC connection owner, HTTP fallback, or direct `DaemonBridgeClient.request` surface call.
- No added post-reconnect global replay/list-refresh workaround. A hard document load naturally performs the existing explicit startup pulls needed to resolve descriptors; those baseline requests are allowed and must not be mislabeled as an added fallback.
- No sibling worktree consumption. The Plan reproduction used an immutable commit archive; the required final downstream run remains in the Workspaces ticket's own routed worktree.
- No adjacent route/settings/terminal/renderer/package cleanup or dependency bump.

## Repository ownership boundaries and cross-repository dependencies

- **botster-web owns:** packaged browser navigation/reload semantics, stable route preservation, the route-owned request path, real Ionic rendering assertions, generic fixture consumption, bounded diagnostics, and deterministic/live harness coverage.
- **botster-workspaces owns:** workspace records, lifecycle grouping, owner-authored tree, and the final real-branch consumer pass. `ticket_1785296184_677408` already depends on this Web ticket and must rerun the merged mode before closing.
- **botster-hub / hub-client own:** fresh WebRTC grants/generations, canonical `session` subscription/snapshots, descriptors, plugin worker execution, and daemon request/result truth. Web consumes unchanged public behavior.
- **botster-core / UI Contract own:** accepted UiNode/action/binding grammar. Web renders the identity-matched owner tree without creating another grammar.
- **Project Pipelines owns:** durable review findings, checklists, artifacts, gates, and the existing dependency edge only.
- No blocking cross-repository prerequisite remains. If the generic contract-matrix surface cannot pass after exact-route preservation, stop and route the newly reproduced external contract defect rather than reviving the speculative generation design.

## Convention reconciliation, assumptions, and unknowns

- [[botster browser pull requests must retry after webrtc reconnect]] still constrains the result. Here the hard reload creates a fresh application instance, whose stable selected URL reactivates normal explicit startup pulls and the route-owned surface pull. No additional global replay mechanism is needed.
- The narrowing is safe because `src/botster/entities.ts` retains families across an in-place transport generation, while this reproduced boundary is stronger: a full remount reconstructs stores and performs the normal explicit startup pulls. The fix must not add a second refresh after those normal requests.
- [[botster client subscriptions should not hydrate global state]] is preserved: subscribe remains transport/session-subscription setup; app/package descriptors and the selected surface remain explicit requests from the remounted route.
- Assumption: preserving the full selected URL is the intended hard-reconnect behavior. This is directly supported by the ticket wording, the stable-route note, and the reproduced root-navigation failure.
- Assumption: the existing generic contract-matrix fixture's owner-authored `contract.app` is sufficient to prove surface replay. The live oracle must use structured request/result/tree evidence, not static shell text.
- Assumption: normal hard-load `list_apps`, `list_packages`, navigation, and session-subscription requests are expected startup behavior. The prohibition is against adding an imperative global refresh/retry to fix route loss.
- Unknown: whether the cleanest helper is a dedicated `reloadCurrentRouteAndAssertWebrtc` function or a discriminated navigation-mode argument. Prefer the smallest unambiguous API; do not retain a parameter whose type silently chooses unrelated navigation semantics.
- Unknown: after route preservation, the exact `fce8aba` Workspaces run may expose a later producer-owned lifecycle assertion. That later result must be recorded precisely, but it does not justify weakening the generic route proof.
- Convention conflict found and reconciled: the broad replay note can sound like every cached family needs replay, but the actual hard-remount boundary already issues normal view-owned startup pulls. The plan explicitly allows those and rejects any additional global fallback.

## Affected surfaces and files

- `scripts/live-packaged-protocol-harness.mjs`: replace the ambiguous reconnect navigation contract, preserve/assert exact selected URLs, add the generic selected-surface reconnect proof, route Workspaces lifecycle through it, and extend bounded evidence.
- `scripts/live-packaged-protocol-helpers.mjs`: only if a small pure URL/request chronology helper makes deterministic coverage direct and reusable.
- `src/App.test.mjs`: deterministic assertions for helper semantics, exact route preservation, generic surface request/result chronology, pre-fix negative control, and absence of speculative production reconnect wiring.
- `README.md`: update only if the focused proof/command or documented reconnect semantics change.
- `docs/architecture.md`: update only if needed to distinguish hard route-preserving reload from in-place WebRTC transport recovery.
- `package.json`: expected unchanged because `smoke:plugin-contract-matrix` and `smoke:workspaces-lifecycle` already exist.
- `fixtures/`: expected unchanged; the installed Hub-test-support contract matrix is the existing generic owner fixture.
- `docs/plans/replay-selected-plugin-surface-pull-after-reconnect.md`: revised durable plan artifact.

## Implementation outline

1. Preserve the reproduced pre-fix evidence in implementation reporting: exact baseline, Workspaces SHA, command, successful pre-reconnect stages, failing selected-surface assertion, and root-navigation cause.
2. Refactor the reconnect helper/call site so labels do not select navigation behavior. Add exact full-URL before/after assertions for route-preserving reload/revisit.
3. Extend the generic contract-matrix flow to cross that helper while `contract.app` is selected. Capture the prior grant/subscription/render count, then require fresh identities, exact route, one additional matching surface request, accepted result, and rendered owner tree.
4. Use the same route-preserving helper in Workspaces lifecycle and continue the existing reconnect/history assertions. Preserve current bounded diagnostics and add exact route/request evidence.
5. Add deterministic helper/chronology/source tests, including a negative assertion that the old string-through-numeric-cycle call shape no longer exists.
6. Run repository and live gates. If the exact Workspaces archive progresses to a later producer-owned failure, record it without changing Web production semantics; the downstream real-branch run remains mandatory.

## Risks

- **Helper regression:** changing the shared numeric terminal reload loop could weaken its reload-versus-revisit coverage. Prefer a dedicated route-preserving helper or discriminated mode and keep cycles 1/2 behavior covered.
- **Origin-only false green:** a package-root page shares the selected route's origin. Exact URL equality must be asserted before any surface assertion.
- **Static-content false green:** shell or fixture title text could exist without a replay. Require a new matching `plugin_surface_render`, accepted identity-matched result/tree, and real selected-surface DOM.
- **Startup-pull misclassification:** hard reload legitimately reissues explicit descriptor pulls. Test against added extra refreshes, not the baseline remount sequence.
- **Workspaces leakage:** the primary proof must stay generic. Workspaces remains downstream confirmation and no production branch may contain its identifiers.
- **Overbroad helper option:** a boolean such as `preserveRoute` can recreate ambiguity. Prefer names/types that make navigation behavior explicit at the call site.
- **Later producer failure:** fixing route loss may expose a genuine Workspaces lifecycle assertion. Keep stage-specific evidence and ownership boundaries rather than treating all red as Web.
- **Diagnostic secrets/bloat:** route evidence is safe; grant secrets remain redacted and broad event dumps stay bounded.

## Acceptance checks and tests

Baseline and repository gates:

- `npm test`: protocol drift plus deterministic route/helper/request chronology assertions pass.
- `npm run typecheck`.
- `npm run lint` with no new errors or warnings attributable to the change.
- `npm run build`.
- `npm run smoke:browser-runtime` remains green.

Generic production-path proof:

- `BOTSTER_HUB_BIN=<authoritative hub> BOTSTER_SESSION_WORKER_BIN=<authoritative worker> npm run smoke:plugin-contract-matrix`.
- The existing generic contract package is installed through Hub and `contract.app` is opened through admitted navigation.
- Record the exact selected URL and current `plugin_surface_render` count, then perform the explicit route-preserving hard reconnect.
- Assert the full URL is unchanged, grant and `session` subscription ids are fresh, exactly one new matching surface render request/result is observed through normal Hub transport, and the accepted owner-authored tree renders inside `selected-app-surface`.
- Assert no unsupported UiNode, client-synthesized surface, direct bridge surface call, `list_sessions`, retry loop, leaked grant, page/console/404 error, or unexpected extra surface render.
- The new oracle must fail against `8672e14`; the reproduced negative control is the old root-navigation call followed by the 15-second selected-surface timeout.

Exact defect confirmation:

- Re-run `npm run smoke:workspaces-lifecycle` against an explicit immutable snapshot/path for Workspaces commit `fce8aba572e80f07db4041f915f4c2d9860b9e40`, never a sibling worktree.
- Post-fix, exact route evidence must show the selected Workspaces URL survives the hard reconnect, a new matching `plugin_surface_render` succeeds, and `assertSelectedAppSurfaceRendered` no longer times out.
- Continue through `selectWorkspacesLifecycleWorkspace`, `reconnect-authoritative-history`, and fresh subscription/snapshot oracles. If a later assertion fails, report its exact stage/oracle and classify ownership.

Downstream proof:

- After this Web change merges, `ticket_1785296184_677408` must run the corrected merged `smoke:workspaces-lifecycle` in its own routed worktree against its real branch and obtain exit 0 before closing. Existing dependency `dependency_1785553403_441166` enforces the order.
- A pass caused by navigating to root, skipping the selected route, static shell text, retry timing, global refresh, or locally synthesized tree does not satisfy acceptance.

## Pipeline artifacts, findings, and gates

- Commit this revised plan and attach a new artifact that supersedes `artifact_1785553989_705957` while preserving the earlier artifact as review history.
- Gate evidence must cite the live reproduction, explicitly withdraw the generation-aware root-cause claim, and map each Plan Review finding to the revised section that resolves it.
- Workflow and vault checklists must record the new reproduction command/result, the discovered convention reconciliation, and unchanged capture disposition.
- Resolve review findings only after the revised artifact and evidence exist; then submit the Plan gate and request Plan Review again without waiver.

## Vault gaps worth capturing

- Candidate after implementation: overloaded test-helper parameters must not silently select navigation semantics when route persistence is the oracle. Capture only if this proves reusable beyond this harness.
- Existing notes already cover stable plugin URLs, reconnect pull replay, explicit render phases, and authoritative snapshots; no new architectural note is needed at Plan time.
- Do not capture ticket ids, Workspaces SHA, temporary archive paths, or the one-time failure as durable conventions.

## Convention check

- One apparent conflict is now explicit and reconciled: the broad reconnect-pull note requires mounted view dependencies to be re-requested, while this ticket's actual boundary is a full remount that naturally performs the normal explicit pulls. The surgical fix preserves the selected route so those existing pulls run; it does not add global hydration or a second refresh.
- No other convention conflict. The revised plan removes speculative production plumbing, keeps Hub/Workspaces truth in their owners, uses the existing stable route and normal Hub transport, and proves the exact user path that failed.
