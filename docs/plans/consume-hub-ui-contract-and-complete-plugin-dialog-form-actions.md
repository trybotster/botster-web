# Consume the Hub UI contract and complete plugin dialog/form actions

## Target and context

- Target repository: `trybotster/botster-web` (`botster-web`)
- Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Pipeline run: `run_1785199798_408981`
- Repository charter: [[botster-web-playbook]]
- Role/surface playbooks: [[planner-playbook]], [[botster-planner-playbook]], [[project-pipelines-playbook]]
- Architecture maps: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]]
- Atomic notes loaded:
  - [[botster web uses vanilla ionic primitives by default]]
  - [[botster web dto field names must match authoritative rust serde structs]]
  - [[botster web adapts hub validated snapshot grammar only on ui tree path]]
  - [[botster web plugin app routes are stable host routes]]
  - [[botster web request caches belong in react query not zustand or hub session getters]]
  - [[botster toolbar actions use declaration order plus fixed overflow intent]]
  - [[botster plugin modal state belongs in client-local presentation state]]
  - [[plugin surface actions route by explicit metadata]]
  - [[plugin-owned dynamic state uses plugin-namespaced entity frames]]
  - [[botster hub client state sync is entity frame only]]
  - [[runtime client acceptance must render delivered snapshots through real registry]]
  - [[conformance oracles assert action result frames not toast text]]
  - [[botster web generated protocol drift checks need explicit hub artifact paths]]
  - [[botster web form actions must preserve collected values into transport payloads]]
  - [[botster web drops core uiaction payload and ignores interaction props]]
- Repository context inspected: `README.md`, `docs/architecture.md`, `package.json`, the current generated daemon protocol/drift check, `src/App.tsx`, `src/botster/{uiNodes,actions,IonicUiNodeRenderer,UiNodeSurface,hubTransport,client}.ts*`, `src/App.test.mjs`, and `scripts/live-packaged-protocol-harness.mjs`.
- Authoritative producer context inspected: merged `botster-hub` commit `d79403c`, public `@trybotster/ui-contract@0.1.0`, the merged-but-unpublished protocol/conformance changes, current plugin-contract-matrix fixture, and Plan Review's artifact-level verification.
- Human scope decision: `question_1785200017_581035` says this ticket proves generic Web semantics with published/shared fixtures. It does not depend on or claim the final Workspaces/atomic-spawn product flow; that proof belongs to integration ticket `ticket_1785192726_335558`.
- Later human/dependency decision recorded by Plan Review: do not publish the merged intermediate Hub test-support version alone. Blocking Hub ticket `ticket_1785211693_467262` must add a real accepted presentation-`set` producer, merge it with the protocol changes, and publish one single next test-support version for Web to consume.

## Current production path and confirmed defects

The real browser path is:

`App` stable plugin route -> Hub `plugin_surface_render` -> identity-matched validated `ui_tree_snapshot` -> `UiNodeSurface` -> `IonicUiNodeRenderer` -> correlated action dispatcher -> `hubTransport` `plugin_surface_action` -> Hub `UiActionResult` -> surface/presentation update.

The current implementation forks that contract in four relevant places:

1. `uiNodes.ts` and `actions.ts` define local UiNode/action/request/result shapes instead of importing the Hub-owned package.
2. `validatedPluginSurfaceSnapshotNode` flattens the Hub tree into an id-required browser grammar and drops contract children such as `presentation_if`.
3. `Dialog` renders only from forbidden `props.open`; forms attach drafts to `params.values`, while transport sends only `action.payload`.
4. `hubTransport` emits the removed split daemon action fields and collapses typed result states/effects into a browser-local accepted boolean, so replacement, presentation, normalized values, and actionable field/form errors never reach the renderer.

## Scope

1. Cold-switch normal package consumption:
   - add `@trybotster/ui-contract` to `dependencies`, pinned to the exact version named by the single next installed Hub test-support artifact's `metadata.json` (`ui_contract.package_version`); it is the client's normal build/protocol dependency and the generated daemon declarations import it directly;
   - update `@trybotster/hub-test-support` in `devDependencies` to the single next published version produced by blocking ticket `ticket_1785211693_467262`, then regenerate/copy its daemon TypeScript artifact through the existing drift workflow;
   - read `protocol_version`, `conformance_fixture_revision`, and `ui_contract.package_version` from that installed artifact rather than assuming version numbers from the current Hub checkout;
   - import UiNode, UiChild, UiAction, UiActionRequest, UiActionResult, presentation, form, and JSON types from the UI package;
   - remove local duplicate UI/action wire contracts and mirrored UI conformance fixtures instead of keeping aliases or compatibility adapters.
2. Render the canonical tree generically:
   - preserve the existing identity-matched `ui_tree_snapshot` boundary, but pass its canonical `UiNode`/`UiChild` grammar through without a second browser vocabulary;
   - resolve ordinary nodes, `bind_list`, and `presentation_if` predicates, including typed `present`, `truthy`, and `equals`, against generic entity and surface-scoped presentation stores;
   - render a present `Dialog` without reading `props.open`, selecting an appropriate vanilla Ionic presentation for the contract's `auto`/explicit intent;
   - preserve declared child/slot order, especially Toolbar `actions`, along with each action's overflow intent and reachability;
   - keep the stable `/packages/:package/surfaces/:surface` host route and existing package/surface identity.
3. Add one generic surface-scoped presentation store and result path:
   - scope keys by the active Hub, package, and surface;
   - dispatch every authored button/form action through the canonical worker request; apply `set`/`clear`/`toggle` only when the correlated accepted `UiActionResult.presentation` returns those operations;
   - do not invent reserved presentation action ids, client-local trigger markers, or any browser-only protocol meaning; `UiAction` has only `id`, optional `payload`, and optional `disabled`;
   - use the same generic state for equality-selected detail (representative `selected-workspace`) and contextual dialog visibility;
   - clear only the active surface's state on accepted owner effects; never apply presentation operations from rejected/deferred/error results or introduce a workspace-specific React store/state variable.
4. Build and route the canonical action envelope:
   - derive `surface_id`, `action_id`, and optional `node_id` from the rendered node/action context;
   - map both form submission controls and ordinary action buttons to required `kind: "submit"` (`UiActionKind::Submit` means “submit form values or commit an action”); emit `reset`, `validate`, or `cancel` only when the rendered control explicitly expresses that intent;
   - put form drafts only in `UiActionRequest.values`;
   - preserve optional non-form `UiAction.payload` only in `UiActionRequest.payload`;
   - send daemon `plugin_surface_action` as `{ package_name, request }`, with no split `surface_id`/`action_id`/`payload` fallback;
   - keep correlation identity exact and surface action routing generic.
5. Apply typed results at the owning rendered surface:
   - for `accepted`, apply presentation operations and the validated owner-authored whole-surface replacement, then clear stale errors for that action;
   - for `rejected`, `deferred`, or `error`, retain the current tree and presentation state, preserve/normalize the draft when supplied, and show field/form errors next to the real Ionic form controls;
   - do not infer success from toast text, refetch the surface, or imperatively refresh sessions.
6. Replace mirrored/source-only assertions with shared-fixture and runtime-path tests:
   - consume `@trybotster/ui-contract/conformance-fixtures` for complementary deterministic contract checks and the single next published Hub contract-matrix package for live producer proof;
   - add a focused typed deterministic tree for `bind_list`, including `empty_template` and a nested list, against the real generic entity store because neither current published fixture covers this greenfield Web path;
   - exercise the delivered snapshot through `UiNodeSurface` and the real transport adapter;
   - extend the live packaged harness for structured action-result and entity-frame evidence.
7. Update `README.md`/`docs/architecture.md` only where needed to record the UI contract dependency, canonical action/result flow, client-local presentation ownership, and exact browser/live verification commands.

## Non-scope

- No changes to Hub, Core, botster-hub-client, botster-workspaces, Project Pipelines plugin code, TUI, or TUI kit.
- No workspace creation, target/template selection, Git/worktree, atomic-spawn, or session-grouping policy in React.
- No dependency on open Hub atomic-spawn ticket `ticket_1785192690_547868` or Workspaces rewrite ticket `ticket_1785192719_380772`.
- No claim that representative “New workspace”/“Spawn session” fixture labels prove the final producer-authored workflow; integration ticket `ticket_1785192726_335558` owns that proof.
- No new state library, workspace-specific store, list/poll refresh fallback, raw HTML, custom modal framework, Catalyst component, local/sibling package override, compatibility action envelope, or broad adjacent UI refactor.
- No browser-local presentation trigger or reserved presentation action namespace; opening a contextual dialog is a real action -> worker -> accepted presentation-`set` round trip.

## Ownership boundaries and dependencies

- Hub-owned `botster-ui-contract` is the sole renderer-neutral UiNode/action/presentation ABI and validation authority.
- `botster-hub-client`/generated daemon protocol owns `{ package_name, request: UiActionRequest }` framing and typed `UiActionResult`.
- Hub runtime/plugin worker owns validating and routing producer trees/results; Web must not revalidate with a divergent schema or apply producer policy.
- `botster-web` owns Ionic rendering, the scoped client-local presentation store, form drafts/errors, whole-surface replacement application, stable route lifecycle, and real browser conformance.
- Plugin-owned model state and grouped session lifecycle remain entity-frame-only; Web consumes those frames through its generic store and never issues an imperative session-list refresh.
- Existing prerequisite `ticket_1785192683_691772` is closed/merged. Registry propagation completed during planning: `npm view` now resolves public `@trybotster/ui-contract@0.1.0` and its normal registry tarball. Implementation must not use `file:`, sibling checkout, local tarball, or worktree overrides.
- Blocking cross-repository dependency `ticket_1785211693_467262` (“Hub conformance: prove live presentation set/open through plugin surface actions”) is registered against the authoritative `botster-hub` target `tgt_7e208a0c76a44980a83b63af976b1f22`. It must merge a real accepted `set` producer and publish one single next `@trybotster/hub-test-support` version carrying both that producer and the already-merged protocol changes. Do not publish the intermediate package separately.
- Implement cannot start until that dependency is closed and its single next package version is available from the normal registry. If its final publication requires npm credentials/2FA, report the exact operator command supplied by the dependency ticket; this Web plan must not guess a version or trigger a standalone intermediate publish.

## Assumptions and unknowns

- Assumption: the single next Hub test-support package retains the already-merged canonical request/result ABI and declares the exact direct UI-contract dependency Web must pin. Treat its installed `metadata.json`, not this plan or the current Hub checkout, as version authority.
- Confirmed contract fact: an accepted replacement is the next whole-surface root. `node_id` remains action/result correlation identity and does not define an inline patch target. This is published as `accepted_replacement_scope: "whole_surface"` by Hub test support.
- Assumption: current Hub/package/surface identity already available at the stable route is sufficient to construct a non-persistent presentation scope; do not add a browser-generated durable Hub identity.
- Confirmed contract fact: presentation operations are reachable only through `UiActionResult.presentation`, and the contract rejects presentation/replacement effects on every non-accepted result. There is no client-local presentation action descriptor or reserved action-id namespace.
- Confirmed action-kind mapping: ordinary action commits and form submissions use `kind: "submit"`; other variants require explicit rendered intent.
- Unknown: the final package version assigned by blocking ticket `ticket_1785211693_467262` and its publication timing. Read all version/revision facts from its installed metadata.
- Resolved unknown: representative Workspaces labels are generic fixture copy only; final producer behavior is downstream integration scope.

## Affected surfaces and likely files

- Dependency/artifacts: `package.json`, `package-lock.json`, `src/botster/generated/daemon-protocol.ts`, `scripts/check-daemon-protocol-drift.mjs`.
- Contract ownership and dispatch: `src/botster/uiNodes.ts` (shrink to Web-only snapshot/render context or remove), `src/botster/actions.ts`, `src/botster/client.ts`, `src/botster/hubTransport.ts`, and any generated-protocol fixture that must track the installed artifact metadata.
- Production rendering/state: `src/botster/IonicUiNodeRenderer.tsx`, `src/botster/UiNodeSurface.tsx`, `src/App.tsx`; `src/theme/app.css` only for Ionic layout/error presentation that cannot be expressed by existing styles.
- Tests/fixtures: `src/App.test.mjs`, remove or replace `src/botster/__fixtures__/uiNodeConformance.ts`, and extend `scripts/live-packaged-protocol-harness.mjs`.
- Docs: `README.md`, `docs/architecture.md`, and the implementation report required by the later pipeline gate if repository precedent calls for one.

## Risks

- A type-only dependency swap can leave the production adapter translating into the old grammar. Mitigate with exact request JSON and delivered-snapshot DOM proof.
- Special `UiChild` recursion can accidentally mutate author trees or lose entity row context. Cover nested `bind_list` plus presentation predicates and replacement nodes.
- A generic child/slot rewrite can reorder Toolbar actions or lose overflow intent/reachability. Assert declared action order through constrained Ionic rendering.
- Unscoped presentation keys can leak dialog/selection state across package surfaces or Hub reconnects. Test identical keys on two surfaces.
- Applying effects before checking result state/identity can close a rejected form or replace the wrong node. Gate all effects on exact correlation plus `state === "accepted"`.
- Re-rendering a form can reset drafts or hide actionable errors. Test rejected normalized values, field ids, form errors, and a subsequent accepted submit.
- Ionic modal lifecycle can unmount form state or trap focus incorrectly. Exercise real component open, typing, rejection, retry, acceptance, close, and route refresh.
- Existing action helpers serve package/session controls as well as plugin surfaces. Keep the canonical plugin request change narrow and retain deterministic coverage for non-plugin actions.
- Live harness assertions can race on toasts or frame variants. Assert durable structured requests/results and converged entity-store rows, accepting snapshot/upsert/patch lifecycle delivery as appropriate.
- Dependency lag can tempt a local override or premature intermediate publication. Treat the registered Hub ticket and its single next normal registry artifact as a hard prerequisite.

## Acceptance checks

### Artifact and deterministic checks

1. After blocking ticket `ticket_1785211693_467262` closes, `npm install` resolves its single next `@trybotster/hub-test-support` release in `devDependencies` and the metadata-declared `@trybotster/ui-contract` version in direct `dependencies`; lockfile integrity and dependency edges show no local path or sibling override.
2. Read and record `protocol_version`, `conformance_fixture_revision`, and `ui_contract.package_version` from the installed test-support `metadata.json`. `npm test` passes and its drift check compares the checked-in daemon protocol to that exact installed artifact.
3. `npm run typecheck`, `npm run lint`, and `npm run build` pass.
4. Focused tests prove no local UiNode/UiActionRequest/UiActionResult declaration remains and shared conformance fixtures are imported from the published package.
5. A focused deterministic renderer test drives a typed `bind_list` tree through the real entity store, proving populated rows, `empty_template`, nested list row context, and entity snapshot/upsert/patch/remove convergence. It also proves Toolbar action declaration order and overflow intent survive the canonical `UiChild`/slot walk.

### Real renderer/transport behavior

6. Render a delivered Hub-validated snapshot through the production `App` route -> `UiNodeSurface` -> Ionic registry, not a parallel helper.
7. Start with no inline form. Click the new producer's representative “New workspace” contextual button and assert a real `{ package_name, request }` round trip reaches the worker. Its correlated accepted result must carry presentation `set`; only then may the valid Dialog render, without `props.open`. Type real values and assert the submit transport emits:

```json
{
  "type": "plugin_surface_action",
  "package_name": "...",
  "request": {
    "request_id": "...",
    "surface_id": "...",
    "action_id": "...",
    "node_id": "...",
    "kind": "submit",
    "values": { "name": "..." },
    "payload": { "...": "non-form metadata only" }
  }
}
```

8. Return a rejected result and prove the same dialog/tree/presentation state remains open, entered or normalized draft values remain visible, and field/form errors are actionable in the real Ionic controls. No presentation/replacement effect applies.
9. Retry with an accepted result and prove its owner-authored replacement renders at the correlated location, presentation `clear` closes the dialog, and stale errors disappear.
10. Through the live worker round trip, exercise accepted presentation `set` and later `clear`; deterministically exercise `toggle`, `equals`, representative selected-workspace detail, and identical-key isolation across package/surface scopes through the imported contract fixtures and real renderer/store. No workspace-specific React state is allowed, and non-accepted results must never apply any operation.
11. Open a representative target-first “Spawn session” dialog through the same action -> worker -> accepted `set` mechanics, then submit/reject/accept/clear and apply the replacement result. Prove no workspace/Git policy or imperative list refresh exists in Web.
12. Feed grouped session lifecycle solely as `entity_snapshot`/`entity_upsert`/`entity_patch`/`entity_remove` frames into the deterministic `bind_list` path and assert rendered detail converges through the generic entity store.

### Browser/live-Hub proof required by the repository charter

13. `npm run smoke:browser-runtime` proves the compiled real React/Ionic bundle and stable route behavior.
14. `BOTSTER_HUB_BIN=... BOTSTER_SESSION_WORKER_BIN=... npm run smoke:plugin-contract-matrix` installs the single next published Hub fixture in an isolated Hub and proves the full live sequence:
    - contextual action request -> worker -> accepted presentation `set` -> Dialog renders;
    - real form typing reaches worker-visible `values`;
    - structured rejected results retain tree/presentation and surface errors;
    - structured accepted results apply replacement and presentation `clear`;
    - request/result package, surface, action, node, and request identities match.
15. The live smoke must fail loudly—not skip or substitute deterministic fixtures—when installed fixture metadata/body lacks the accepted presentation-`set` producer from `ticket_1785211693_467262`.
16. Keep published UI-contract fixtures (`accepted.presentation` set/toggle/clear, `dialog_presence`, and `selected_workspace_equality`) as deterministic complementary coverage. They do not replace the live action/worker/result path.
17. Extend the live harness so success is asserted from recorded `plugin_surface_action` requests, typed plugin action results, and converged entity rows—not toast text, source regexes, or hand-authored action payloads.
18. Downstream disposition is explicit: this ticket proves renderer-generic representative Workspaces semantics; integration ticket `ticket_1785192726_335558` later proves the actual botster-workspaces-authored New workspace/Spawn session flow after its Hub/Workspaces producers land.

## Baseline evidence

- `npm test`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed with the existing large-chunk warning.
- `npm run lint`: passed with zero errors and seven existing `react-refresh/only-export-components` warnings.
- Registry/dependency state: public UI contract `0.1.0` resolves normally. The currently public Hub test support predates the merged protocol changes; do not publish the merged intermediate package separately. Registered Hub dependency `ticket_1785211693_467262` must produce the single next release with the missing live accepted-`set` producer.

## Vault gaps worth capturing

- Update/supersede [[botster web form actions must preserve collected values into transport payloads]] after implementation: that note records the old broken seam and recommends moving form drafts into payload, while the merged canonical ABI now requires `UiActionRequest.values` and reserves `payload` for non-form metadata.
- Capture the settled whole-surface replacement rule: accepted `replacement` becomes the rendered root, while `node_id` remains correlation identity rather than an inline patch target.
- Update the modal-state note to clarify that the presentation store is client-local but set/clear/toggle triggers arrive only from correlated accepted worker results; there is no browser-local presentation action namespace.
