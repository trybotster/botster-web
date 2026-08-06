---
description: Plan for migrating the botster-web Session types surface onto the authoritative Hub session-type contract with source-aware CRUD, canonical entity frames, and a preserved target-first launch flow
---

# Manage authoritative Hub session types in botster-web

## Target repository and routing

- Ticket: `ticket_1785970233_750553`, "Web: manage authoritative Hub session types".
- Run: `run_1786031348_611758`, Plan step `botster_stack_plan`, run step `run_step_1786031348_790523`.
- Authoritative target: `trybotster/botster-web`.
- Target ID: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Repository ownership charter: [[botster-web-playbook]].
- Routing was resolved from `project_pipelines_current_context` -> `run.target_id` -> the Botster spawn-target registry, then confirmed against this worktree's `origin` remote (`git@github.com:trybotster/botster-web.git`). It was not inferred from the ambient directory. The registry display name is misspelled `booster-web`; its `path` and `repo_name` resolve unambiguously to `trybotster/botster-web`.
- Assigned worktree: branch `project-pipelines/ticket_1785970233_750553`.

### Worktree staleness — must be corrected before Implement

The run worktree was cut at `713233f`, **one commit behind `origin/main` (`9753297`, "Improve hub navigation and session UX")**. That single missing commit is the one that introduced the entire Session types surface this ticket targets. Planning against the worktree `HEAD` produces a false "the surface does not exist" conclusion.

Implement must rebase onto `origin/main` before editing, per [[stale project pipeline worktrees can miss merged dependency apis]] and [[plan review must fetch before trusting remote tracking refs in run worktrees]]. **Every file and line reference in this plan is against `origin/main` (`9753297`), not the current worktree `HEAD`.**

## Playbooks and atomic notes loaded

Loaded in the required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]] — the exact repository ownership charter for the routed target
4. Targeted atomic notes below
5. [[project-pipelines-playbook]] — **loaded**. Initially omitted on the reasoning that no Project Pipelines package or plugin path is edited by this run. That was too narrow: blocking-dependency registration and the Implement hold are workflow *policy*, which this charter owns, and it carries the Plan Review obligations this run depends on — [[plan review must fetch before trusting remote tracking refs in run worktrees]], [[plan review must reverify the declared base at review time]], [[plan review must check open sibling tickets that own part of the plan scope]], and [[plan review must verify baseline test execution and register blocking dependencies]]. No Project Pipelines *code* is in scope; the policy is.

Task-surface convention (initially omitted, now loaded):

- [[web-session-creation-must-be-target-first]] — the exact convention behind the ticket's "preserve target-first session creation". The spawn target is the admission-controlled trust boundary and the source of runtime context, so the client must not offer session-type, branch, or worktree choices before an admitted target is chosen. This run preserves that ordering exactly. Note the convention is current but its "Implementation" section is stale: it cites `_new_session_chooser_modal.html.erb` and Stimulus controllers from the superseded Rails client, not the Ionic React shell (see Vault gaps).

Charter "Must Load" notes:

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[botster-web ionic supersedes catalyst for client shell]]

Botster planning guidance:

- [[botster-architecture]]
- [[spa-patterns]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]

Entity-frame and pipeline-hazard notes targeted by this ticket:

- [[botster hub client state sync is entity frame only]] — the decision this ticket enforces: no parallel list-refresh path.
- [[botster client subscriptions should not hydrate global state]] — subscribe establishes transport; surfaces request the snapshots they need.
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[plugin-owned dynamic state uses plugin-namespaced entity frames]] — the namespacing rule that distinguishes canonical Hub families from `botster-web.*` projections.
- [[stale project pipeline worktrees can miss merged dependency apis]]
- [[plan review must fetch before trusting remote tracking refs in run worktrees]]
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]] — live-smoke ownership-mode evidence is part of the test result.

Plan destination follows the target repository's own prior art: `docs/plans/` holds ~40 current plan files in `botster-web`. It was not taken from a vault example path.

## Context loaded

- Ticket, run, gates, dependencies, questions, and answers from `project_pipelines_current_context`.
- Repository: `README.md`, `docs/architecture.md`, `package.json` scripts, `botster-package.json`, `plugin.lua`, `scripts/check-daemon-protocol-drift.mjs`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/hubTransport.ts`, `src/botster/entities.ts`, `src/botster/connectionDiagnostics.ts`, `src/botster/webrtcDaemonClient.ts`, `src/botster/capabilities.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`.
- Authoritative consumed artifact: `@trybotster/hub-test-support@0.1.24`, unpacked from the npm registry. `metadata.json` confirms `protocol_version: 6`, `conformance_fixture_revision: 31`, `daemon_protocol.sha256 c5cc9413…`. Published from Hub commit `8a60bd58841179f8b1fd4040d9362d18ea244230`.
- `first-party-client-support-matrix.json` from that artifact lists `session_type_entity_subscriptions` in both `required_features` and `supported_features`.
- Hub source at `8a60bd58` was read **for planning comprehension only** — `src/session_types.rs`, `src/daemon_transport.rs`, `src/client_api.rs`, `tests/hub_client_api_test.rs`. The consumed contract for implementation is the published npm artifact, never Hub source.
- Orchestrator coordination message (concurrent-run warning) and durable answer `question_1786031801_745643`.

## What exists today on `origin/main`

This ticket is a **replace-in-place migration**, not a greenfield build.

Read-only, inference-based Session types list — the subject of "replace":

- `src/App.tsx:1973-2006` — `/settings/session-types`, `data-testid="session-types-view"`, section id `session-types`, registered at `src/App.tsx:130`. Renders only `title`, the resolved spawn-target label, and an Available/Unavailable `IonBadge` derived from `template.available === false`.
- `src/botster/hubTransport.ts` `sessionTemplateRecord` — sets `title: humanizeIdentifier(template.id)` and `subtitle: template.package_name`. This is the forbidden "inferring semantics from names".
- `src/botster/hubTransport.ts:139-141, 246-256` — Web-owned pull family `botster-web.session_template` fed by request/response `list_session_templates`. This is the forbidden list-refresh fallback.
- `src/App.tsx:1046` — initial `pullProductionEntity("sessionTemplate", …)`; `src/App.tsx:1110-1111` — re-pull after every `botster.spawn_target.daemon_request`.

Target-first session creation — the subject of "preserve":

- `src/App.tsx:657-662` `sessionTemplatesForSpawnTarget` filters on `stringValue(template.target_id, "") === targetId` **and** silently drops `available === false`.
- `src/App.tsx:666-679` `spawnSessionFormForTarget` — auto-selects when exactly one type matches the target.
- `src/App.tsx:681-688` `spawnSessionAction` — action id `botster.spawn_point.spawn_session`, param `template_id`.
- `src/App.tsx:1373-1375, 1378-1408, 2278-2348` — the spawn modal, target-scoped `IonSelect`, prompt field, dispatch, and success toast.
- `src/botster/hubTransport.ts:1089-1120` — dispatch to daemon request `spawn_session_template`.

Existing coverage: `src/App.test.mjs:963` (view exists), `2806-2820` / `2931` (fixture bridge), `4058` / `4382` (real transport pull -> snapshot), `4066` / `4265-4267` (spawn dispatch), `5685` (`sessionTemplatesForSpawnTarget` unit), `5701-5707` (action id/label), `7126-7154` (`daemonResponseFrames` record projection). `scripts/browser-runtime-smoke.mjs:135` asserts the navigation label. **`scripts/live-packaged-protocol-harness.mjs` has zero session-type coverage** — that is the production-proof gap this run must close.

## The authoritative contract being consumed

From `@trybotster/hub-test-support@0.1.24/daemon-protocol.ts`:

- Requests: `list_session_types`, `show_session_type { session_type_id }`, `create_session_type { source, definition }`, `update_session_type { source, definition }`, `delete_session_type { source, session_type_id }`, `resolve_session_type`, `spawn_session_type { session_type_id, session_id, request }`.
- `DaemonSessionTypeMutationSource` = `{ source: "device" } | { source: "repo", target_id } | { source: "package", package_name }`.
- `DaemonSessionType` carries `session_type_id`, `source`, `source_name`, `id`, `editable`, `overridden_sources[]`, `diagnostics[]`, `label`, `description`, `icon`, `role`, `interaction`, `traits[]`, `lifecycle`, `command`, `args[]`, `working_directory_policy`, `allowed_environment_overrides[]`, `context_keys[]`, `target_id`, `available`.
- `DaemonSessionEntity` gains `session_type_id`, `session_type_source`, `role`, `traits[]`, `interaction`, `session_type_lifecycle`.
- `DaemonEntityFrame` gains `entity_error { subscription_id, entity_type, code, message }`.

Behavioural facts confirmed in Hub source at `8a60bd58` and treated as contract expectations:

- Canonical entity type string is **`session_type`** (bare, like `session` — not a `botster-web.*` projection).
- The Hub session-type subscription driver emits **snapshot / upsert / remove / error only — never `patch`** — sequenced by a `session_type_generation` counter bumped on every definition-changing daemon request. Overflow yields `entity_error` with code `entity_provider_frame_too_large`.
- Precedence rank is Package(0) < Device(1) < Repo(2). The winner's `overridden_sources` lists lower-rank peers and Hub appends its own `diagnostics` line.
- Package-sourced mutations are rejected outright with `read_only_session_type_source`.
- Repo mutations require an **enabled admitted** spawn target and write `.botster/session-types.json` inside it — a Hub-side write, never a browser filesystem write.
- Validation authority is entirely Hub-side (`validate_session_type`): bounded tokens, namespaced `role`, unique traits, relative-safe command/working directory, environment-name rules. Error kinds Web must render verbatim: `invalid_session_type`, `invalid_session_type_role`, `invalid_session_type_semantics`, `invalid_session_type_traits`, `invalid_session_type_path`, `invalid_environment`, `session_type_already_exists`, `unknown_session_type`, `ambiguous_session_type`, `target_not_admitted`, `read_only_session_type_source`, `session_type_unavailable`, `invalid_session_types`.
- `materialize_session_type` resolves the spawn target as `request.target_id ?? definition.target_id ?? source_default` and then **requires equality with the source default**, else `target_not_admitted`. One eligible target per session type, full stop. This is what makes target-first filtering correct rather than forbidden.
- Role/interaction/lifecycle/traits are free namespaced tokens with **no Hub enum**. Confirmed representable and orthogonal: interactive agent (`botster.agent` / `interactive` / `[terminal]` / `task`), interactive accessory (`botster.accessory` / `interactive` / `[terminal, companion]` / `persistent`), service accessory (`botster.accessory` / `service` / `[background]` / `persistent`).

## Scope

### 0. Inherited from the dependency run — do not redo

Per durable answer `question_1786031902_298547`, `ticket_1785970234_234515` also lands, as purely mechanical zero-behaviour-change unblock edits, the six `src/botster/hubTransport.ts` session-type renames (`DaemonSessionTemplate` -> `DaemonSessionType`, `list_session_templates` -> `list_session_types`, the `session_templates` response kind and field, `spawn_session_template` -> `spawn_session_type`) plus the `entity_error` union-narrowing plumbing at `hubTransport.ts:369-378` and `webrtcDaemonClient.ts:850,855`.

Treat all of that as **already present at rebase**. It is type-level only and makes no claim on this surface. This run owns the behavioural change on top of it: the pull-to-subscription swap, mutation dispatch, and the entire UI. If a rename is somehow missing after the rebase, apply it as part of this work rather than blocking.

### 1. Cold-cut the transport vocabulary — `src/botster/hubTransport.ts`

- Delete the session-type **pull family** `botster-web.session_template`/`botster-web.session_type` constant, its `entity_pull` branch, the `list_session_types` request call, the `response.kind === "session_types"` snapshot projection, `sessionTemplateRecord`/`sessionTypeRecord`, and `humanizeIdentifier`. No alias, no dual schema. The dependency run renames these; this run removes them.
- Add `ensureSessionTypeEntitySubscription()` modelled exactly on the existing `ensureSessionEntitySubscription()`, holding `bridge.subscribeEntityFrames("session_type", …)`. Route `entity_pull` family `"session_type"` to it, precisely as family `"session"` is routed today. Reconnect replay is then inherited from `webrtcDaemonClient.reconnectEntitySubscriptions()`, which is already entity-type generic.
- Tear the subscription down in `disconnect()` alongside the session subscription.
- Extend the entity-frame projection to carry `entity_error` through as a surface-scoped Hub-sourced diagnostic (verbatim `code` and `message`). It must **not** trigger a refetch or a resubscribe loop. The dependency run supplies only the type-level union narrowing; the projection and the user-visible state are this run's (see scope item 4).
- Replace the `botster.spawn_point.spawn_session` dispatch body: daemon request `spawn_session_type` with `session_type_id`. Keep the action id, the `{ target_id, context: { prompt } }` request shape, and the structured result envelope, renaming `template_id` -> `session_type_id` and `request_type` -> `spawn_session_type`.
- Add a `botster.session_type.daemon_request` dispatch modelled on the existing `botster.spawn_target.daemon_request`, carrying `create_session_type` / `update_session_type` / `delete_session_type` with a `DaemonSessionTypeMutationSource`. Emit Hub's error kind and message in the action result; publish no optimistic entity frame.

### 2. Replace the read-only list with source-aware management — `src/App.tsx`

- `/settings/session-types` reads `runtimeClient.entities.list("session_type")`.
- Rows render Hub descriptors verbatim: `label` (never a name derived from `id`), `description`, `icon`, `role`, `interaction`, `traits`, `lifecycle`, `source` + `source_name`, `target_id`, `available`, `editable`, `overridden_sources`, `diagnostics`. Unknown namespaced roles and traits render as their literal token; no lookup table, no fallback classification, no inference from `command`.
- Group by Hub `source` (`device` / `repo` / `package`). Package rows are visibly read-only: the state is derived **solely from Hub `editable === false`**, and such rows expose no edit or delete control.

  The consumed contract carries **no read-only reason string**. `DaemonSessionType` has `editable` plus optional `diagnostics[]`, and Hub sets `editable: rank != Package` with `diagnostics` empty except when a row overrides lower-precedence definitions. Web therefore renders a static read-only affordance derived from the `editable` boolean, alongside the Hub-provided `source` and `source_name`, and renders `diagnostics` verbatim **only when present**. It must not synthesise an explanatory reason, and it must not treat an absent diagnostic as an error. If a distinct Hub-authored read-only reason is ever wanted, that is a separately routed `botster-hub` contract change verified through a new published artifact — not something this run invents client-side.
- Detail view exposes `command`, `args`, `working_directory_policy`, `allowed_environment_overrides`, `context_keys`, and the full override chain.
- **Edit and Delete** controls, which act on an existing row, are gated **solely** on that row's Hub `editable` value. No other client-side condition may hide or enable them.
- **Create** is gated differently, because `editable` is a per-row field and a create control has no row. Availability comes from the set of writable sources Hub already projects: the `device` source, plus any enabled admitted repo target read from the existing `botster-web.spawn_target` family. The form submits `create_session_type` with the corresponding `DaemonSessionTypeMutationSource`, and Hub owns every semantic and admission rejection (`target_not_admitted`, `read_only_session_type_source`, `session_type_already_exists`, and the validation kinds). Web must **not** synthesise a create-availability boolean or infer writability from anything other than Hub-projected source state.
- The form maps to `DaemonSessionTypeDefinition`. Submit is disabled only for structurally empty required inputs; every semantic rule stays Hub-side and its rejection renders as Hub's `kind` + `message` on the owning form. Web must not re-implement token, namespace, uniqueness, or path rules.
- Pending / error / success states follow the existing `spawnTargetForm` submitting/error pattern.
- Remove the `botster-web.session_template` re-pull at `src/App.tsx:1110-1111`; mutation results arrive as pushed `upsert` / `remove`.
- Surface-local capability check: if Hub-provided `status.compatibility.features` omits `session_type_entity_subscriptions`, render a Hub-sourced unsupported state on this surface only.

### 3. Preserve the target-first launch flow — `src/App.tsx`

- Keep the flow shape, the action id `botster.spawn_point.spawn_session`, the modal, the prompt field, and the success toast. Removing it would be a user-facing regression the ticket forbids.
- Rename `sessionTemplatesForSpawnTarget` -> `sessionTypesForSpawnTarget`, `spawnSessionFormForTarget`'s `templateId` -> `sessionTypeId`, and `spawnSessionAction`'s `template_id` param -> `session_type_id`.
- Preserve the ordering required by [[web-session-creation-must-be-target-first]]: the admitted spawn target is chosen first, and no session-type or prompt affordance is offered until it is. The target is the admission-controlled trust boundary and the source of runtime context.
- Keep filtering the option set by Hub-provided `target_id` — that is presentation of a Hub field and it is exactly what the one-target-per-type rule makes correct.
- **Stop silently dropping `available === false`.** Render those as disabled options carrying Hub's `diagnostics`, so eligibility is visible rather than invisibly enforced client-side.
- Surface Hub's `target_not_admitted` and every other spawn rejection verbatim on the form instead of pre-empting it.
- Role and traits shape valid UX only (for example, prompt affordance for `interaction: "interactive"`); they never gate the request.

### 4. Own the product-facing entity-subscription error state — `src/App.tsx`

Explicitly assigned to this run by durable answer `question_1786031902_298547`: the Hub-identity run fixes `entity_error` at type level only and was instructed not to design product-facing error UX for entity subscriptions.

- When the `session_type` subscription delivers `entity_error`, the Session types surface renders a Hub-sourced error state carrying Hub's `code` and `message` verbatim — no Web-authored copy, no inferred remediation.
- The state is terminal for that subscription generation: no automatic retry, no resubscribe loop, no fallback to a list request. `entity_provider_frame_too_large` is the concrete case Hub emits.
- Keep the previously rendered rows visible with a stale marker rather than blanking the surface.
- **No new reconnect affordance.** The fetched base has generic automatic entity resubscription on WebRTC reconnect (`webrtcDaemonClient.reconnectEntitySubscriptions`) and no user-invocable reconnect action anywhere in `App.tsx`, `hubTransport.ts`, or `webrtcDaemonClient.ts`. The ticket does not require one, and adding a rendered control with no existing production entrypoint would be a speculative new abstraction. Recovery therefore remains the existing automatic path on the next transport generation.
- Distinguish this from the missing-`session_type_entity_subscriptions` capability state, which is a different, Hub-feature-derived condition.

### Non-scope

- ~~**The shared `hub-test-support` 0.1.21 -> 0.1.24 bump and everything that rides with it.**~~ **MOVED INTO SCOPE AT IMPLEMENT — see Deviations.** This run now lands the bump and its mechanical closure. It still does **not** claim the `DaemonCompatibilityRequirement` rename or any Hub identity / General / Maintenance behaviour, which remain `ticket_1785970234_234515`'s.

  The governing seam is now a **rule**, not a file list (`question_1786036651_149333`): this run owns everything mechanically forced by the bump whose correct value is **dictated by the installed artifact's `metadata.json`** — exactly one right answer, read off rather than decided. `ticket_1785970234_234515` owns everything requiring **judgement about Hub identity and maintenance semantics** — what `DaemonStatus.software` means for display, the `check_hub_update` action and its outcome states, the General/Maintenance surface, and any prose that is an editorial claim rather than a coordinate.

  Never hand-author the drift-gated protocol DTOs. Running the package's own `readDaemonProtocolTypescript()` vendor step is the sanctioned operation that `scripts/check-daemon-protocol-drift.mjs` exists to enforce; hand-editing is what it exists to catch.
- Hub General/Maintenance: software/build/install identity, host identity, compatibility display, state schema, `check_hub_update`. Owned by `ticket_1785970234_234515`.
- `requiredDaemonFeatures`, `minimumDaemonProtocolVersion`, `minimumConformanceFixtureRevision` in `src/botster/connectionDiagnostics.ts` stay at their deliberately permissive `1` / `14` (commit `2246678`, "Stop gating Web compatibility on Hub schema"). Approved explicitly by the orchestrator.
- `resolve_session_type` preflight. Hub validates at spawn and returns a typed error; a second round trip would be speculative. Deliberate omission, recorded here.
- Any Hub, Core, TUI, Workspaces, or Project Pipelines package change.
- No compatibility UI, no legacy `session_template` alias, no local filesystem write, no client-owned session policy.

## Repository ownership boundaries and cross-repo dependencies

Boundaries honoured, per [[botster-web-playbook]]:

- Hub owns session-type policy, CRUD authority, provenance, precedence, validation, target admission, and canonical projections. Web renders Hub descriptors and dispatches Hub actions. Web adds no browser-only protocol meaning.
- Web owns the Ionic shell, `/settings/session-types` routing, generated-DTO consumption, entity-store rendering, and browser diagnostics — nothing more.
- Repo-sourced writes land in `.botster/session-types.json` **through Hub**, never from the browser.

Dependencies:

| Dependency | Repository / target | Status | Consumed as |
| --- | --- | --- | --- |
| `ticket_1785970233_236046` — Hub session-type contract | `botster-hub` / `tgt_7e208a0c76a44980a83b63af976b1f22` | closed, registered | `@trybotster/hub-test-support@0.1.24` from Hub `8a60bd58` |
| `ticket_1785970234_234515` — Web Hub identity + shared bump | `botster-web` / `tgt_40abcf71ccf049f4ac0c99953a799869` | **open — blocking** | protocol 6 / conformance 31 vendored into this repository |

**Confirmed registered.** The blocking edge now exists as `dependency_1786032120_366099` (`ticket_1785970233_750553` depends on `ticket_1785970234_234515`, `depends_on_status: open`) and appears in this run's `blocking_dependencies`. The Implement hold is engine-enforced, not conventional. This resolves the open action carried in plan revisions 1 and 2.

**Gate-regression watch.** This run holding at Implement while `ticket_1785970234_234515` is open is the first production exercise of the blocking-dependency gate merged as `8990969`. If any agent on this run is activated into `botster_stack_implement` while that dependency is still open, that is a gate regression, not good fortune: report it to the orchestrator immediately and do not proceed with edits.

Concurrent same-repository run seam (`run_1786031355_921193`):

- `src/App.tsx` — both runs edit the same `hub-settings` block. They own section `general`; this run owns section `session-types`. `hubSettingsSections` at `src/App.tsx:126-132` is shared; neither run should reorder it.
- `src/botster/hubTransport.ts` — they add `check_hub_update` / `hub_update` projection; this run adds the `session_type` subscription and mutation dispatch.
- `src/App.test.mjs` — a single 373 KB file both runs extend.
- Sequencing is forced by the dependency: their bump lands first, this run rebases onto it. This plan therefore assumes protocol 6 and conformance 31 are already vendored at the first Implement edit.

## Assumptions and unknowns

Assumptions:

1. ~~`ticket_1785970234_234515` lands the 0.1.24 bump, the byte-exact re-vendor, the six mechanical `hubTransport.ts` renames, and the `entity_error` type-level union narrowing before this run's Implement step begins.~~ **INVALIDATED AT IMPLEMENT — superseded, see Deviations.**

   Why it failed: the blocking dependency `dependency_1786032120_366099` was **removed** by an explicit operator decision (Jason) so both `botster-web` runs proceed concurrently and resolve merge conflicts as they arise. At the first Implement edit, `ticket_1785970234_234515` had not started implementing — its branch `project-pipelines/ticket_1785970234_234515` held three plan-only commits at `9f68b7a`, still `hub-test-support@0.1.21`, still zero `session_type` tokens, with nothing pushed to `origin`. Waiting would have idled this run indefinitely behind work nobody had begun.

   What replaced it: **this run lands the bump and its full mechanical closure**, authorised by durable answers `question_1786035761_202841`, `question_1786036233_827175`, and `question_1786036651_149333`. See Deviations for the exact files and the ownership rule that now governs the seam.

   Note on ordering claims generally: dependency enforcement in this environment is **partial** — the engine gates `project_pipelines_start_run` (`engine.lua:1816`, "ticket dependencies must close before starting a run") but does **not** gate step activation. A plan must therefore state which mechanism an ordering assumption relies on, and treat step-transition ordering as a claim to verify at the transition rather than an engine guarantee. This plan's original "Implement hold is engine-enforced" wording was wrong on exactly that point.
2. Implement rebases onto `origin/main` first, so `9753297` is present.
3. The canonical entity type string is `session_type`, and Hub emits snapshot/upsert/remove/error with no patch. Confirmed in Hub source at `8a60bd58` and by the support matrix; to be re-confirmed against the vendored `0.1.24` DTO at Implement time.
4. `webrtcDaemonClient.reconnectEntitySubscriptions()` handles a second held subscription without change, being entity-type generic.
5. The browser client can issue session-type mutations over the operator-granted WebRTC daemon channel without a new package capability, exactly as `create_spawn_target` does today with `botster-package.json` `capabilities: []`.

Unknowns to resolve during Implement:

1. Whether the `BOTSTER_HUB_BIN` / `BOTSTER_SESSION_WORKER_BIN` binaries available for the live smoke are built at Hub `>= 8a60bd58`. An older binary cannot serve `session_type` subscriptions and the live proof would fail closed, not silently pass.
2. Whether the live harness's temporary spawn target can be admitted **and enabled** in time to exercise the repo-sourced write path; if not, repo-source CRUD proof may need the harness to create the target first.
3. Exact `IonSelect` keyboard semantics under Playwright for the target-first option list. `renderToStaticMarkup` cannot prove keyboard behaviour, so it must come from the live browser stage.

## Affected surfaces and files

All paths are against `origin/main` (`9753297`).

| File | Change |
| --- | --- |
| `src/botster/hubTransport.ts` | Remove the session-type pull family, its `entity_pull` branch, the list request, the response-kind projection, the record projector, and `humanizeIdentifier`. Add `session_type` held subscription + teardown, `entity_error` projection, `botster.session_type.daemon_request` dispatch, and the spawn dispatch body. The six mechanical renames and the `entity_error` union narrowing arrive from `ticket_1785970234_234515`. |
| `src/App.tsx` | Replace the `session-types` section (`1973-2006`) with source-aware list/detail/CRUD. Rename and retarget `sessionTypesForSpawnTarget` / `spawnSessionFormForTarget` / `spawnSessionAction` / `rejectedSpawnSessionForm` (`648-691`). Retarget the spawn modal (`2278-2348`). Swap the `sessionTemplate` pull for the `session_type` subscription (`1046`), drop the re-pull (`1110-1111`), rename `entityLoadStatus` key (`887, 893, 1017`). Add the session-type form modal. |
| `src/App.test.mjs` | Migrate the fixture bridge (`2806-2820`, `2931`), transport/projection assertions (`4058`, `4066`, `4265-4267`, `4382`, `7126-7154`), and helper units (`5685`, `5701-5707`). Add CRUD, provenance, override, read-only, unknown-role/trait, and `entity_error` cases. |
| `scripts/live-packaged-protocol-harness.mjs` | Add the session-type production stage (see acceptance checks). |
| `scripts/live-packaged-protocol-helpers.mjs` | Add session-type oracle helpers alongside the existing ones. |
| `scripts/browser-runtime-smoke.mjs` | Extend beyond the `135` navigation-label check to render the migrated surface. |
| `src/theme/app.css` | Styles for the new rows/forms, only if Ionic primitives are insufficient. |
| `docs/architecture.md` | Document `session_type` as a held canonical subscription. **Excluding** the `53-54` coordinate lines owned by the other run. |
| `README.md` | Document the new live session-type proof mode. **Excluding** the `11` coordinate line. |

Additionally changed at Implement as the authorised **unblock-only bump closure** (see Deviations):

| File | Change | Authorised by |
| --- | --- | --- |
| `package.json` | `@trybotster/hub-test-support` `0.1.21` -> `0.1.24` (one line) | `question_1786035761_202841` |
| `package-lock.json` | refreshed for `0.1.24` | `question_1786035761_202841` |
| `src/botster/generated/daemon-protocol.ts` | byte-copy via the package's own `readDaemonProtocolTypescript()`; drift check verifies `sha256 c5cc9413…` | `question_1786035761_202841` |
| `src/botster/webrtcDaemonClient.ts` | `entity_error` early return in `receiveEntityFrame` before the delta-sequencing branch | `question_1786036233_827175` |
| `src/botster/__fixtures__/generatedDaemonProtocol.ts` | delete `hub_version` (removed from `DaemonPackageCompatibility` at protocol 6) | `question_1786036233_827175` |
| `src/App.test.mjs:1373-1374` | `protocol_version` 4 -> 6, `conformance_fixture_revision` 28 -> 31 | `question_1786036651_149333` |
| `README.md:11`, `docs/architecture.md:53-54` | `revision-28` -> `revision-31`, `@0.1.21` -> `@0.1.24` | `question_1786036651_149333` |
| `src/botster/protocol.ts` | add `entity_error` to `HubControlFrameKind` and the `EntitySubscriptionErrorPayload` shape | this run's scope item 4 |

Still not touched: `src/botster/connectionDiagnostics.ts`, `plugin.lua`, `botster-package.json`, `src/botster/entities.ts` (the generic store already supports a second family), and `docs/plans/stop-treating-hub-persistence-schema-as-client-compatibility.md` — a historical plan record whose coordinates were true when written; rewriting it to match today's artifact would falsify a historical record and destroy the evidence for why that decision was made.

## Deviations from this plan, and why

1. **This run landed the `hub-test-support` 0.1.21 -> 0.1.24 bump and its full mechanical closure**, which the plan had assigned to `ticket_1785970234_234515`. Authorised by `question_1786035761_202841`, extended by `question_1786036233_827175` and `question_1786036651_149333`.

   Cause: Assumption 1 was invalidated (see Assumptions). Every type this ticket consumes — `DaemonSessionType`, `create/update/delete/spawn_session_type`, `DaemonSessionTypeMutationSource`, `entity_error` — lives in that bump, so no acceptance check was reachable without it: `typecheck`, `build`, and `test` all failed at the first import.

   Why it is safe: the vendor output is a byte-copy of an immutable published artifact, so whichever run produces it the bytes are identical (`sha256 c5cc9413…`), and `package.json` / `package-lock.json` resolve to the same `0.1.24`. The merge conflict is a no-op that resolves correctly from either side.

2. **`src/botster/webrtcDaemonClient.ts` `entity_error` handling was behaviourally required by this ticket, not merely type-level.** `receiveEntityFrame` handles `entity_snapshot` and then falls through to delta sequencing. An `entity_error` frame carries no `snapshot_seq`, so `frame.snapshot_seq !== currentSequence + 1` evaluates `undefined !== N+1` — true — and `resubscribeEntity` fires with `"sequence_gap"`. That is exactly the resubscribe loop Risk 5 and scope item 4 forbid and acceptance check 15 must disprove. A narrowing that merely satisfied `tsc` would have compiled green and shipped the defect. Authorised by `question_1786036233_827175`.

3. **Live-harness coverage is narrower than the 15 checks this plan promised.** Recorded explicitly rather than quietly delivered thin — see "Live coverage actually delivered" below.

4. **Three pre-existing `origin/main` harness defects were repaired to make any live evidence reachable.** All three are unrelated to this ticket's subject and none was introduced by this branch.

   - `assertCurrentHubCompatibilityAndSchema` pinned `status.schema_version === 2`. Hub reached state schema 3 in `botster-hub` `802b511` "Make Hub session types authoritative" (merged as `8a60bd58`, the already-closed dependency `ticket_1785970233_236046`). Changed to a **floor** (`< 2` fails), not a deletion, so a genuinely older Hub is still caught. Consistent with `botster-web` commit `2246678` "Stop gating Web compatibility on Hub schema"; this assertion was a survivor of the pre-`2246678` world. Authorised by `question_1786037405_499651`.
   - `assertCurrentHubSchemaPresentation` pinned the rendered string `"schema version 2"`. Relaxed to `/schema version \d+/` while keeping every neutrality assertion (`Info / server`, never `Blocked`). Same survivor, same reasoning.
   - `closePackageSettingsRoute` clicked a button named `"Apps"`. Commit `9753297` renamed that control to `"Back"` and repointed it at `packageSettingsReturnRoute` **without updating the harness**. One-word selector repair. `PluginSettingsRoutePage` is byte-identical to base in this branch's diff.

5. **One pre-existing `origin/main` harness defect is left UNFIXED and the live run still exits non-zero because of it.** `waitForTerminalDetached` waits for `[data-terminal-session-id='none']`. Commit `9753297` **removed** that placeholder element from `src/App.tsx` — `origin/main`'s `App.tsx` contains zero `data-terminal-session-id` occurrences, and this branch's diff touches it in zero lines. Repairing it means designing a replacement detach oracle for terminal lifecycle, a subsystem this ticket does not touch; guessing at it would be worse than reporting it. Routed for a separate decision.

   Root cause of all four: `9753297` is ordinary same-repo mainline work that changed UI the live harness asserts against, and the harness could not run at all against a schema-3 Hub, so the drift went undetected.

6. **The edit control is withheld from this run.** Scope narrowed by operator decision in `question_1786039185_622023`, resolving Review finding `finding_1786039064_233720`.

   Hub's update is wholesale replacement (`*existing = definition`, `src/session_types.rs:297` at pinned `8a60bd58`), so an edit must send a complete `DaemonSessionTypeDefinition`. The published row cannot reconstruct one: `PackageSessionType` carries `working_directory` (policy **and** path) and `environment`, while `HubSessionType` publishes only `working_directory_policy` and `allowed_environment_overrides` — the projection at `src/session_types.rs:705` reads the full working directory and keeps just the policy. `show_session_type` returns the same sanitized row, and `DaemonResolvedSessionType`'s `working_directory` / `environment` are *resolved* for a concrete session, not authored, so they cannot substitute without inventing authored values from resolved ones — precisely the inference this ticket forbids.

   Editing any definition authored with a relative working-directory path or an environment would therefore silently destroy that data. Withholding the control is what this ticket's own constraints imply, not a departure from them.

   Routed, not dropped:

   | Ticket | Repository | Purpose |
   | --- | --- | --- |
   | `ticket_1786039258_173310` | `botster-hub` | Publish a lossless authoring view so clients can edit without data loss |
   | `ticket_1786039279_917823` | `botster-web` | Add the edit control once that lands; depends on the Hub ticket via `dependency_1786039286_431750` |

   That dependency edge genuinely blocks `ticket_1786039279_917823` from **starting**, because run-start gating is real; step-activation gating is not, so nothing may treat it as an in-run hold.

   The withholding is visible in the product, not only here: editable rows render "Editing not available yet" rather than appearing broken or silently missing the affordance.

   No `update_session_type` branch is left behind in `sessionTypeRequestFromAction` either. With the control withheld nothing can construct that request, so the clause would have been unreachable scaffolding for another ticket's capability; `ticket_1786039279_917823` re-adds it together with the control and its own coverage.

7. **Edit/delete addressed Hub by the wrong identifier.** Review finding `finding_1786039064_430152`, a real defect. `sessionTypeEntityRecord` overwrote Hub's bare `id` with the composite `session_type_id`, so delete submitted `device/live-harness-agent` where Hub expects `live-harness-agent`. The bare id is now preserved as `definition_id` alongside the store id.

   Why the original proof missed it: the live stage called the Hub socket with `definition.id` directly and the fixtures used invented colon ids, so the harness confirmed **Hub's** contract while the **client's** request shape stayed unexercised. A downstream proof that drives the dependency instead of your own client will pass while the client is broken. Create and delete are now driven through the rendered Ionic controls and assert the exact Web-produced daemon request.

8. **The shared-Hub browser fixture wrote a file the authoritative Hub does not read.** Review finding `finding_1786040251_493572`. `scripts/workspaces-shared-hub-browser-smoke.mjs` seeded `.botster/session-templates.json`, but Hub reads `REPO_SESSION_TYPES_FILE = ".botster/session-types.json"` with key `session_types`, and `PackageSessionType` requires `role`, `interaction`, and `lifecycle`. The admitted repo therefore contributed no `shared-browser` session type and that smoke's declared Workspaces/Web spawn path was unexercisable. The fixture now writes the authoritative file and schema. The Workspaces plugin still owns the assignment vocabulary, so `template_id: "shared-browser"` is preserved as an external seam.

   The production-source negative oracles stayed green because they inspect consumers, not fixture writers — worth remembering: a cold cut must sweep the code that *produces* fixtures for the counterpart system, not only the code that consumes its responses.

   That smoke still cannot complete end to end, and the remaining work is **already registered** — my first write-up wrongly described it as generic unregistered staleness, which was a routing failure on my part, not a gap in the project:

   | Ticket | Target | Owns |
   | --- | --- | --- |
   | `ticket_1785984128_479155` | `tgt_71266a8d976d4535902ffed09c18a7ba` (botster-workspaces) | The capability-scope migration `session_template_managed_git_spawn` -> `session_type_managed_git_spawn`, plus the manifest and Lua vocabulary. Its own description records the root cause exactly: Hub `8a60bd58` `src/profile.rs default_capability_grants()` no longer grants the legacy scope and `PackageRegistry::enable` hard-denies it, so the installed Workspaces package cannot be enabled on a protocol-6 Hub at all. |
   | `ticket_1786036336_442121` | `tgt_40abcf71ccf049f4ac0c99953a799869` (botster-web) | The shared-Hub browser driver follow-up, blocked on the above via `dependency_1786036350_443365`. |

   **Overlap this run created, and how it is resolved.** `ticket_1786036336_442121` carried two pieces. Its PIECE 2 — migrating this fixture's path, key, and definition shape — is exactly what this commit landed, because Review required it here. That ticket has been updated to record PIECE 2 as complete at this commit, leaving it PIECE 1 (the `template_id` -> `session_type_id` driver rename) plus the end-to-end shared-Hub proof.

   Preserving `template_id` here was therefore correct rather than merely conservative: that rename is `ticket_1786036336_442121`'s PIECE 1 and is blocked until Workspaces lands the corresponding tool-argument change. Renaming it now would have produced a driver keyed to a field the installed package does not yet send.

9. **Rebased onto the merged sibling at `origin/main` `49d7fd6`.** `ticket_1785970234_234515` merged as PR #83, so this branch's own copy of the bump closure met main's. Every one of those files — `package.json`, `package-lock.json`, `daemon-protocol.ts`, `generatedDaemonProtocol.ts`, `README.md`, `docs/architecture.md` — is now **byte-identical to main**, confirming the determinism argument that authorised landing them here.

   Three resolutions were semantic rather than textual and are recorded because a reviewer should not have to rediscover them:

   - **`entity_error` projection.** Main projects it into a global `connection_diagnostic` for any entity type; this run projects it into a family-scoped frame the Session types surface consumes. Neither supersedes the other, so `daemonEntityFrame` keeps the family-scoped projection and the diagnostic moved to `entitySubscriptionDiagnosticFrame`, with `emitEntityFrame` emitting **both**. Main's assertions were rewritten to prove the split rather than dropped, and its non-canonical-family case still holds because the diagnostic accepts any entity type.
   - **`webrtcDaemonClient` `entity_error`.** Auto-merge left two blocks. Main's is taken: it is semantically identical — delivers to the listener and returns before the delta path, so `resubscribeEntity` cannot fire — and additionally records a `state: "error"` harness event. This run's duplicate was removed as dead code.
   - **`hubCompatibility`.** Main refactored it into `HubGeneralSection`, so the capability check now derives Hub-reported features from `hubStatus`. The first attempt regressed it: `arrayOfStrings` collapses *absent* and *empty* to `[]`, so a length check enabled management against a Hub whose loaded status authoritatively declared **no** features. It is now an exported `sessionTypeManagementSupported` predicate keyed on whether Hub **reported** a feature list at all — permissive only before status arrives, authoritative once it has — matching the pre-rebase semantics. Ablation: reinstating the length check reddens the loaded-empty-features case.

     Tightened again after Review: permissive is now keyed strictly on `hubStatus === undefined`. A loaded record with a missing, malformed, or empty feature list is authoritative and means unsupported — treating any of them as "still loading" would let the client infer capability from Hub's silence. The notices were extracted into `SessionTypesSurfaceNotices` so the capability state and the subscription-error state are proved by RENDERING both, not by source text: loaded `features: []` renders `session-types-unsupported` and the create action is absent, an `entity_error` renders `session-types-subscription-error` verbatim while capability is unaffected, and both together render as two distinct states. Three ablations red — inverting the render condition, unwiring the predicate, and reverting to loaded-record-permissive.

   Convergent evidence worth noting: the sibling independently made the same three pre-existing harness repairs this run had made (the `Apps` -> `Back` selector, the schema floor, and the schema-presentation check). Main's are equal or stricter — its schema floor is 3 and its presentation check asserts the exact reported version — so main's were taken in all three. Preferring the stricter of two independently derived fixes is the right default.

   Two runs rediscovering the same three latent defects in one afternoon is evidence about the harness rather than coincidence, and it is now owned: **`ticket_1786042828_142991`** — "Web: repair the live-protocol harness breaks that accumulated behind the env gate" — records those three plus the still-outstanding `waitForTerminalDetached` break, and carries the structural requirement of deciding how an env-gated lane stops drifting out of sync with the app. The same failure mode is independently confirmed in `botster-tui` via `ticket_1786038825_352271`.

   `session_type_subscribes` moved from 1 to 2 and that is correct, not a regression. Main's `proveInPageReconnectReplaysHubStatus` forces a fresh WebRTC generation before this stage runs, so the second subscribe is the held subscription being re-established. The loop check is unchanged and still passes: it compares the count before and after CRUD, and that delta is zero. This also delivers the first half of acceptance check 10 — the subscription survives a real transport generation and the surface creates, renders, and deletes correctly afterward.

## Live coverage actually delivered

Run: `BOTSTER_HUB_BIN=…/target/debug/botster-hub BOTSTER_SESSION_WORKER_BIN=…/target/debug/botster-session-worker npm run smoke:live-packaged-protocol`, Hub built at `8a60bd5` — the exact commit `hub-test-support@0.1.24` was published from.

Emitted proof line:

```
session-type-live-proof {"created_session_type_id":"device/live-harness-agent",
  "invalid_error_kind":"invalid_session_type_role",
  "read_only_error_kind":"read_only_session_type_source",
  "session_type_subscribes":1,
  "web_create_definition_id":"web-authored-agent",
  "web_delete_session_type_id":"web-authored-agent",
  "entity_error_terminal_state":"covered_in_unit_suite_not_live_see_report"}
```

| # | Acceptance check | Status |
| --- | --- | --- |
| 1 | Snapshot from `subscribe_entities { entity_type: "session_type" }` | **Covered live** — subscription ready, snapshot rendered |
| 2 | No list-refresh, whole span | **Covered live** — asserted before mount and after every mutation; zero `list_session_types` / `list_session_templates`. Also asserted in `smoke:browser-runtime` and as a production-source assertion in `App.test.mjs` |
| 3 | Create -> pushed `entity_upsert` | **Covered live through the rendered form** — asserts exactly one Web-produced `create_session_type` with the authored definition id and device source, then the pushed row. Also covered via a Hub-socket create anchored past the initial snapshot |
| 4 | Edit -> upsert; Delete -> remove | **Delete covered live through the rendered control**, asserting the exact Web-produced `delete_session_type` carries the bare authoring id. Edit is out of scope for this run (deviation 6) |
| 5 | Validation rejected by Hub | **Covered live** — `invalid_session_type_role` |
| 6 | Read-only package row | **Covered live** — `read_only_session_type_source`; no edit/delete control asserted in the unit suite |
| 7 | Override chain + diagnostics | **Unit only** — rendered assertions on `overridden_sources` and `diagnostics`; a live two-source override needs a package-sourced fixture the harness Hub does not carry |
| 8 | Agent / interactive accessory / service accessory shapes | **Unit only** — all three rendered, incl. that a service accessory never presents as an agent |
| 9 | Unknown namespaced role/trait | **Unit only** — `acme.custom_role` / `acme.custom_trait` render literally |
| 10 | Reconnect: new subscription id, fresh baseline | **Partially covered live after the rebase** — main's in-page reconnect forces a fresh generation before this stage, the held `session_type` subscription is re-established (`session_type_subscribes_before_crud` = 2), and all CRUD then succeeds against it. The explicit fresh-baseline/delta assertions still do not run, because the harness exits at the pre-existing terminal-detach defect |
| 11 | Restart persistence | **NOT EXECUTED** — the harness exits at `waitForTerminalDetached`, whose `[data-terminal-session-id='none']` anchor commit `9753297` removed from `App.tsx`. Owned by `ticket_1786042828_142991` |
| 12 | Target-first spawn -> `spawn_session_type` | **Unit only** — dispatch shape asserted end to end through the real transport; the live spawn stage sits past the blocked point |
| 13 | Spawn rejection `target_not_admitted` | **NOT EXECUTED** — same `waitForTerminalDetached` exit. Owned by `ticket_1786042828_142991` |
| 14 | Keyboard/accessibility parity | **NOT EXECUTED** — same `waitForTerminalDetached` exit. Owned by `ticket_1786042828_142991` |
| 15 | `entity_error` terminal state | **Covered in the unit suite against the real `WebrtcDaemonClient`**, not live. A real chunked `entity_error` envelope is delivered and the channel is asserted to issue no further frames — the no-resubscribe proof. Not live because Hub emits it only on genuine provider overflow and there is no injection seam; adding one would put a test-only frame entry point into production transport, which this ticket does not warrant. The live run separately proves `session_type_subscribes` stays at 1 across all CRUD, so no resubscribe occurred |

## Risks

1. **Stale-worktree false absence.** Already materialised once in this run: planning against `713233f` yielded a "no such surface" reading and a proposal that would have deleted a shipped feature. Mitigation: mandatory rebase, and every reference in this plan anchored to `origin/main`. Plan Review should re-verify against `origin/main`.
2. **Merge conflict with `run_1786031355_921193`** in `src/App.tsx`, `src/botster/hubTransport.ts`, and `src/App.test.mjs`. Mitigated by the dependency ordering; residual risk in the shared `hub-settings` block.
3. **Losing target-first launch during the rename.** It is a live, asserted feature. Mitigation: keep the action id stable and keep `src/App.test.mjs:5701-5707` green in migrated form.
4. **Silent list-refresh regression.** The `botster.spawn_target.daemon_request` handler currently also re-pulls session templates; a partial migration could leave a hidden refresh path. Mitigation: an explicit request-count oracle asserting zero `list_session_types` requests after the initial subscribe, mirroring the existing `list_sessions` oracle.
5. **`entity_error` resubscribe loop.** `entity_provider_frame_too_large` is terminal for that subscription. Mitigation: render, do not retry; assert no resubscribe follows.
6. **Duplicate validation authority creeping into the form.** Mitigation: only structural emptiness may disable submit; a review check that no token/namespace/uniqueness rule is reimplemented in Web.
7. **Live-smoke ownership mode.** Per [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]], the harness can attach to an ambient Hub inside a pipeline worktree. Mitigation: record the ownership mode and attached socket as part of the evidence, and check exit codes rather than report prose.
8. **Hub binary older than `8a60bd58`** would fail the live session-type stage. Mitigation: assert Hub protocol version 6 from `status` before the stage, and fail closed with a clear message.

## Acceptance checks and tests

Repository gates (all required by [[botster-web-playbook]]):

```bash
npm test          # includes scripts/check-daemon-protocol-drift.mjs byte-equality against 0.1.24
npm run lint
npm run typecheck
npm run build
npm run smoke:browser-runtime
```

Live production proof — the charter requires real components and routes, structured protocol evidence, and no fixture-only assertions:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

New session-type stage in that harness, driven through rendered Ionic controls in Chromium:

1. **Snapshot** — `subscribe_entities { entity_type: "session_type" }` yields an authoritative snapshot; the surface renders from it.
2. **No list-refresh** — the cold-cut proof, and it must be airtight. Start daemon-request capture **before the Session types surface mounts**, not after the first subscribe, and assert **zero** `list_session_types` requests across the entire span: mount, initial subscribe, snapshot, create, edit, delete, spawn, reconnect, and `entity_error`. Asserting only "after the initial subscribe" would pass while a mount-time or pre-subscribe legacy list request survived. Pair that runtime oracle with a **production-consumer** source assertion: no `list_session_types` request construction or `session_types` response-kind consumer remains under `src/` excluding `src/botster/generated/`. The assertion must be scoped that way, not repository-wide: the negative oracle itself has to name `list_session_types` in order to prove it was never sent, so a literal repository-wide ban would either fail the very test that provides the proof or push Implement toward obfuscated string construction. Test and harness files (`src/App.test.mjs`, `scripts/*`) are therefore explicitly permitted to reference the token for oracle purposes.
3. **Create** — device session type created through the rendered form; observe a pushed `entity_upsert` with a higher `snapshot_seq`. Assert the structured action result, not toast text.
4. **Edit** — update yields `entity_upsert`; **Delete** yields `entity_remove`.
5. **Validation** — submit a definition Hub rejects; assert Hub's error `kind` and `message` render on the owning form and that no entity frame was published.
6. **Read-only package row** — a package-sourced row exposes no edit/delete control; a forced mutation returns `read_only_session_type_source`.
7. **Override** — same `id` from two sources; assert the effective row's `source`, `overridden_sources`, and Hub `diagnostics` render, with repo winning over device winning over package.
8. **Shapes** — interactive agent, interactive terminal accessory, and service accessory all render with correct orthogonal role/interaction/traits/lifecycle. A `long_running` accessory must not present as an agent.
9. **Unknown namespaced role/trait** — an unrecognised namespaced token renders literally with no fallback classification.
10. **Reconnect** — force a fresh WebRTC generation; assert a new subscription id, a fresh snapshot baseline, and continued deltas, reusing the existing reconnect-generation evidence helper.
11. **Restart persistence** — restart Hub on the same data directory using the `BOTSTER_LIVE_DURABLE_STATE=1` seeded-mode pattern; assert device session types created through the UI survive.
12. **Target-first spawn** — pick a spawn target, spawn from the target-scoped list; assert the daemon request is `spawn_session_type` with `session_type_id`, and that the resulting canonical `session` entity carries `session_type_id`, `session_type_source`, `role`, `traits`, `interaction`, and `session_type_lifecycle`.
13. **Spawn rejection** — force `target_not_admitted`; assert Hub's message renders and no session is created.
14. **Keyboard and accessibility** — activate create, edit, delete, and the target-first select by keyboard as well as mouse, mirroring the existing `contract.sessions` mouse+keyboard identity pattern. Assert one exact daemon request per activation.
15. **Subscription error state** — deliver an `entity_error` frame on the `session_type` subscription; assert Hub's `code` and `message` render verbatim, previously rendered rows stay visible as stale, no automatic retry or resubscribe follows, and no `list_session_types` request is issued. Assert the missing-capability state renders distinctly from this one.

Unit and component coverage in `src/App.test.mjs` for row projection, provenance/override/editability rendering, unknown role/trait rendering, `entity_error` projection, form state transitions, and the migrated helpers. `renderToStaticMarkup` covers markup only; keyboard behaviour is proved in the live browser stage.

Evidence to record: exact commands, exit codes, the live harness ownership mode and attached socket, `status.compatibility.protocol_version` observed as 6, the resolved `hub-test-support` coordinate, and the request-count oracle output.

## Vault gaps worth capturing

1. **Same-repository mainline staleness causes false-absence planning.** [[stale project pipeline worktrees can miss merged dependency apis]] covers a worktree missing a *dependency* PR. This case is a distinct variant worth its own note: the missing commit (`9753297`) was ordinary same-repo mainline work belonging to **no pipeline run at all**, and `origin/main` advanced in the race between the orchestrator's pre-wave fetch and worktree creation — so both Web run branches were cut one commit stale with nothing in the dependency graph to signal it. A grep returning zero was accurate about the tree and still produced a false absence conclusion about the repository. Capture candidate: planners must diff `HEAD` against a freshly fetched `origin/main` and read the missing commits before any absence claim, and confirm absence with more than one probe before proposing removal of user-facing behaviour. Orchestrators should re-fetch immediately before worktree creation, or record the base commit they intended.
2. **Concurrent same-repository pipeline runs need an explicit shared-prerequisite owner.** No vault note covers two active runs in one repository both needing an identical generated-artifact bump behind a byte-equality drift gate. The resolution used here — assign the bump to the run whose ticket owns that subject matter, then register a blocking dependency — is reusable.
3. **botster-web entity family naming is load-bearing and undocumented.** Canonical Hub families are bare (`session`, `session_type`) and arrive by held subscription; Web-owned request/response projections are `botster-web.*` and arrive by pull. Choosing the wrong prefix silently reintroduces the list-refresh path this ticket exists to remove. `docs/architecture.md` states the `session` case but not the rule.
4. **Hub session-type target eligibility is exactly one target per type.** `materialize_session_type` requires the resolved target to equal the source default, so a definition's own `target_id` cannot widen eligibility. This is what makes client-side target-first filtering correct rather than a duplication of Hub authority — a distinction easy to get backwards, as this run's first reading did.
5. **[[web-session-creation-must-be-target-first]] has a stale Implementation section.** The convention is current and correct, but it points at `_new_session_chooser_modal.html.erb`, `new_session_chooser_controller.js`, `new_agent_form_controller.js`, and the `botster:new-session-target` custom event — a Rails/Stimulus client superseded by the Ionic React shell per [[botster-web ionic supersedes catalyst for client shell]]. It also frames session type as the binary "Agent or Accessory", which the protocol-6 contract replaces with orthogonal namespaced role plus interaction, traits, and lifecycle. Update candidate: keep the convention and the rationale, repoint the implementation at `src/App.tsx`'s spawn modal, and restate the choice as target-then-session-type rather than target-then-Agent/Accessory. A planner following the current note's pointers would search for files that no longer exist.
6. **`project-pipelines-playbook` is workflow-policy scope, not only code scope.** This run initially skipped it because no Project Pipelines package or plugin file is edited, but the charter also governs dependency registration, gate holds, and the Plan Review obligations a Web run relies on. Its "Load for every change to its engine, schema, tools, prompts, surface, gates, or pipeline artifacts" line reads as code-scoped and invited the wrong call. Clarification candidate: state that runs which *depend on* pipeline policy — blocking dependencies, gate holds, cross-run sequencing — load it too.
