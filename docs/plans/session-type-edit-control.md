# Web: add the session-type edit control (lossless authoring view)

## Plan revision log

| Rev | When | Why |
| --- | --- | --- |
| 1 | Plan visit 1 (`run_step_1786064625_522600`) | Initial plan |
| 2 | Plan visit 2 (`run_step_1786065590_775493`) | Address Plan Review `review_1786065554_549413` **changes_required** — five open findings |

### Plan Review findings → plan deltas

| ID | Severity | Finding | Plan response |
| --- | --- | --- | --- |
| `finding_1786065554_227911` | **blocker** | Form→definition projector drops authored `target_id`; assumption #4 false | Retracted #4. Full field map. Opaque `definitionTargetId` (and any non-surfaced authored fields) seed from authoring read and re-emit on update. Oracle: authored `target_id` survives unrelated edit. Explicit description/icon omit-empty normalization. |
| `finding_1786065554_487008` | high | Proof stops at outgoing update request | After accepted update, re-open Edit and assert fresh `show_session_type_definition` still carries path, environment, context, and `target_id`. |
| `finding_1786065554_377628` | medium | Live smoke omits Hub binary env | Acceptance requires `BOTSTER_HUB_BIN` + `BOTSTER_SESSION_WORKER_BIN`; Hub built from commit containing `show_session_type_definition` (≥ hub `origin/main` `302190e`); capture harness `binary_provenance`. |
| `finding_1786065554_715081` | medium | Pre-existing harness failure waived without base isolation | Base run before change; name first failing step; match base; attribute to `ticket_1786042828_142991`; lane is known-gap never full pass. |
| `finding_1786065554_563336` | low | Vault checklist unfilled / duplicates | Fill authoritative vault checklist with notes/conflicts/verification/capture; skip duplicate checklist copies. |

## Target repository and target_id

- **Ticket:** `ticket_1786039279_917823` — Web: add the session-type edit control once Hub publishes a lossless authoring view
- **Run:** `run_1786064625_324223`, Plan step `botster_stack_plan`, run step `run_step_1786065590_775493` (sequence 3 — post Plan Review bounce)
- **Authoritative target repository:** `trybotster/botster-web`
- **target_id:** `tgt_40abcf71ccf049f4ac0c99953a799869`
- **base_target_path (run registry):** the spawn-target registry path for `tgt_40abcf71ccf049f4ac0c99953a799869`
- **Repository ownership charter:** [[botster-web-playbook]]
- **Routing proof:** Resolved from `project_pipelines_current_context` → `run.target_id` / `ticket.target_id` → spawn-target registry path and worktree remote `git@github.com:trybotster/botster-web.git`. Not inferred from the ambient process directory name. Plan Review independently confirmed the same routing.
- **Assigned worktree:** branch `project-pipelines/ticket_1786039279_917823` at `8048118` = `origin/main` (zero left/right delta after `git fetch origin main`). No rebase required before Implement. Plan Review must re-fetch.

## Repository playbook loaded

- [[botster-web-playbook]]

## Other role/surface playbooks and atomic notes loaded

Loaded in required order:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]]
4. Targeted atomic notes (below)
5. [[project-pipelines-playbook]] — **loaded for workflow policy only** (dependency registration, Plan Review obligations, gate/artifact discipline). No Project Pipelines package/plugin code is in scope.

### Botster planning overlays

- [[botster-architecture]]
- [[spa-patterns]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[vault example paths are not repository placement conventions]]

### Charter Must Load notes applied

- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web adapts hub validated snapshot grammar only on ui tree path]]
- [[botster web plugin app routes are stable host routes]]
- [[botster web request caches belong in react query not zustand or hub session getters]]
- [[botster toolbar actions use declaration order plus fixed overflow intent]]
- [[ui presentation operations are authored by accepted action results]]
- [[botster-web ionic supersedes catalyst for client shell]]
- [[hub qualifies effective session type ids as source name slash id]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[shared hub workspaces acceptance omits package path without skipping its lane]]

### Ticket-specific atomic notes

- [[sanitized projection plus wholesale replacement update contracts silent data loss]] — seed **and** re-emit must be lossless; projector drop is the same failure class
- [[editor scoped reads sit in the mutation admission group not the sanitized read group]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[hub generated protocol changes are a four site release chain]]
- [[hub test support npm releases need external consumer smoke]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[conformance fixture revisions must be unique per published content]]
- [[generated typescript dtos must encode serde field optionality]]
- [[botster hub client state sync is entity frame only]]
- [[web-session-creation-must-be-target-first]]
- [[plan review must fetch before trusting remote tracking refs in run worktrees]]
- [[plan review must reverify the declared base at review time]]
- [[plan review must check open sibling tickets that own part of the plan scope]]
- [[plan review must verify baseline test execution and register blocking dependencies]]
- [[react component launcher proofs must render and interact with the real component]]
- [[conformance oracles assert action result frames not toast text]]
- [[conformance helpers must dispatch the action id read from the rendered node]]

Plan destination: repository prior art under `docs/plans/`.

## Context loaded

### Pipeline context

- Ticket: complete the withheld edit half; depends on Hub lossless authoring view.
- Registered dependencies (both **closed**):
  - `ticket_1786039258_173310` — Hub lossless authoring view
  - `ticket_1786042460_231768` — Hub release of test-support coordinate
- Plan Review: `review_1786065554_549413` **changes_required** with five findings (above).
- Open same-target sibling: `ticket_1786042828_142991` — live harness `waitForTerminalDetached` repair. **Out of product scope**; base-isolation discipline required when live lane exits non-zero.

### Consumed artifact (Plan-time proof)

Worktree still pins `@trybotster/hub-test-support@0.1.24`.

**Published and verified from npm registry:**

| Fact | Value |
| --- | --- |
| Coordinate | `@trybotster/hub-test-support@0.1.25` (`latest`) |
| `protocol_version` | `6` |
| `conformance_fixture_revision` | `32` |
| `daemon_protocol.sha256` | `fb441d038011b940db43618864bfab061bdd5baf586bfe274eea3270d3e46d69` |
| `ui_contract` | `@trybotster/ui-contract@0.3.1` (no forced UI-contract cold update) |
| Seam | `show_session_type_definition` → `DaemonSessionTypeEditableDefinition` |
| Matrix | `session_type_authoring.supported === true`; absent-from-published-row: `context`, `environment`, `working_directory` |

Hub landed a **lossless editable-definition read**. Update remains wholesale replacement (`*existing = definition`). Web must be lossless at **both** boundaries:

1. Seed only from `session_type_definition` (not the sanitized entity row).
2. Re-emit **every** authored definition field on update (including fields the form does not surface as controls).

Hub id shapes:

- Prefer composite entity id for `show_session_type_definition` (avoid `ambiguous_session_type`).
- Update/delete use bare `definition.id` (store `definition_id`).

### What exists today (`origin/main` @ `8048118`)

| Area | State |
| --- | --- |
| List/create/delete + entity subscription | Live |
| `sessionTypeEntityRecord` id split (composite store id + `definition_id`) | Live |
| Edit affordance | Placeholder `session-type-edit-unavailable-*` |
| Transport `update_session_type` | Explicitly withheld |
| Transport `sessionTypeDefinition` | **Already** re-emits `target_id` **if present on the action definition** |
| App `sessionTypeDefinitionFromForm` | **Does not emit `target_id`** — this is the Plan Review blocker |
| Live harness create/delete via rendered controls | Live; update still socket-direct |

## Lossless field map (replaces false assumption #4)

`DaemonSessionTypeDefinition` ↔ form / wire. This is the authority Implement must implement and test.

| Definition field | Form state | Visible control | Seed from authoring `definition` | Emit on create/update |
| --- | --- | --- | --- | --- |
| `id` | `id` | yes (locked on edit) | yes | always bare id |
| `label` | `label` | yes | yes | trimmed required |
| `description` | `description` | yes | yes (`""` if null/absent) | **omit when empty** (do not force `Some("")`) |
| `icon` | `icon` | yes (existing if present) | yes | **omit when empty** |
| `role` | `role` | yes | yes | required |
| `interaction` | `interaction` | yes | yes | required |
| `traits` | `traits` + **`seededTraits`** | yes | join + seed | **seeded list while text untouched**; else token list |
| `lifecycle` | `lifecycle` | yes | yes | required |
| `command` | `command` | yes | yes | required |
| `args` | `args` + **`seededArgs`** | yes | join + seed | **seeded list while text untouched**; else token list |
| `working_directory` | `workingDirectoryPolicy` + `workingDirectoryPath` | yes | policy + path for `relative`; policy only for `package_root` | relative always emits `path` (incl. `""`); package_root omits path; never invent path from sanitized row |
| `environment` | `environment` (`KEY=value` lines) + **`seededEnvironment`** | yes | `formatMetadata` + seed map | **seeded map while text untouched**; else parseMetadata |
| `allowed_environment_overrides` | `allowedEnvironmentOverrides` + **`seededAllowedEnvironmentOverrides`** | yes | join + seed | **seeded list while text untouched**; else token list |
| `context` | `contextKeys` + **`seededContext`** | yes | join + seed | **seeded list while text untouched** (`definition.context`, not published `context_keys` alone on edit seed) |
| **`target_id`** | **`definitionTargetId`** (new) | **no new UI required** — opaque carry | **from `definition.target_id` only** | **re-emit when non-empty; never drop on edit** |
| — | `source` / `sourceTargetId` | create source picker | from authoring **`source`** (mutation source), not from sanitized row alone | mutation `source` on create/update/delete — **distinct from** definition `target_id` |

### Critical distinctions

- **`sourceTargetId`** = repo mutation source’s spawn-target id (`DaemonSessionTypeMutationSource::Repo { target_id }`).
- **`definitionTargetId`** = authored field on `DaemonSessionTypeDefinition.target_id` (session-type’s preferred spawn target binding).
- Confusing them, or only carrying the mutation source, still drops definition `target_id` under wholesale update.

### Description / icon normalization (explicit decision)

Hub models both as `Option<String>` with `skip_serializing_if`. Transport already omits blank strings. **Accepted normalization for this ticket:** empty form strings omit on the wire (treat as absent), matching current transport. Do **not** serialize empty strings as present values. No separate “preserve null vs empty” UI. Documented here so Implement does not invent dual state.

### Why seed-only was insufficient

Even a perfect authoring seed is useless if `sessionTypeDefinitionFromForm` rebuilds the definition from visible controls alone and drops opaque authored fields. Lossless requires seed **and** re-emit of every definition field Hub stores.

## Scope

### 1. Consume `@trybotster/hub-test-support@0.1.25` and re-vendor protocol

- Bump pin `0.1.24` → `0.1.25`; install; vendor `src/botster/generated/daemon-protocol.ts` **byte-exactly** via package `readDaemonProtocolTypescript()`.
- Sync **both** `README.md` and `docs/architecture.md` pins (`0.1.25`, revision-32).
- No ui-contract bump expected.

### 2. Transport: authoring read + update

File: `src/botster/hubTransport.ts`

- Add `show_session_type_definition` and `update_session_type` to `sessionTypeRequestFromAction`.
- Pass `session_type_definition` (and kind) through action-result payload for open-edit seeding.
- Keep existing `sessionTypeDefinition` projector’s `target_id` pass-through; **App must supply it**.
- No list hydration; no optimistic entity frames.

### 3. UI + form: lossless edit

File: `src/App.tsx`

- Replace edit-unavailable note with Edit control gated solely on Hub `editable === true`.
- testid: `edit-session-type-${compositeId}`.
- Open-edit: dispatch show with composite id → seed **only** from accepted `DaemonSessionTypeEditableDefinition` using the field map → on rejection do not fall back to sanitized row.
- Form `mode: "create" | "edit"`; edit locks identifier; submit `update_session_type` with mutation source from authoring response.
- **`definitionTargetId` (and any other non-surfaced authored fields)** survive edit without a new control unless product later wants one.
- Submission promise: pending “Saving…”, rejection keeps draft + Hub error, success closes only on accept.
- Delete unchanged (bare `definition_id`).

### 4. Tests and live proof

#### Unit / component (`src/App.test.mjs`)

- Flip withheld `update_session_type` assertions.
- Field map: seed+project preserves relative path, environment, context, **and `target_id`** when only label changes.
- Ablation: projecting without `definitionTargetId` must fail the target_id oracle.
- Edit control only when `editable`; package rows read-only.
- Form promise behaviour at component level where suite patterns allow.
- Id shapes: show uses composite; update uses bare `definition.id`.

#### Live packaged protocol harness

**Load-bearing production path.** Extend rendered session-type stage:

**A. Primary path (ticket)**

1. Through rendered controls, create device type with relative working-directory path **and** non-empty environment (and non-empty context if the form can author it).
2. Click Edit (rendered).
3. Assert web-produced `show_session_type_definition` with **composite** id.
4. Change only an unrelated field (e.g. label).
5. Submit; assert web-produced `update_session_type` with bare `definition.id` and preserved path + environment (+ context) on the request.
6. **Read-back (finding high):** re-open Edit; assert the **new** `show_session_type_definition` response still carries the same relative path, environment map, and context.
7. Form promise: pending state; forced Hub rejection keeps form open with form error; success closes.
8. Keep create/delete bare-id proofs; zero list hydration / resubscribe loop.

**B. `target_id` survival (blocker oracle)**

- Author a definition that includes a non-null `definition.target_id` (fixture setup may use the Hub socket **only** to create a valid Hub-accepted row if the create form does not yet expose that field; **edit must still be driven through the rendered Edit control**).
- Edit an unrelated visible field through the UI.
- Assert outgoing update still carries `definition.target_id` **and** re-open Edit read-back still shows it.

Do not accept request-only evidence as complete for path/env/`target_id`.

### Non-scope

- Hub/core/TUI/Workspaces/plugin changes; partial-update redesign; widening sanitized subscription rows.
- Full repair of `ticket_1786042828_142991`.
- Spawn redesign; client-side Hub token validation; hand-authored DTOs.
- Speculative form frameworks; inventing a second transport channel for authoring reads.

## Repository ownership boundaries and cross-repo dependencies

| Owner | Responsibility |
| --- | --- |
| **botster-hub** | Policy, validation, wholesale update, authoring read, package read-only, published npm coordinate |
| **botster-web** | Ionic shell, DTO consumption, lossless form map, Edit UX, browser live proof |

| Dependency | Status | Consumed as |
| --- | --- | --- |
| Hub authoring view + release | closed | `@trybotster/hub-test-support@0.1.25` (registry verified) |

No new cross-repo dependency. If install lacks tokens, open a Hub release ticket on the **hub** target.

Sibling `ticket_1786042828_142991` remains out of product scope; base-isolation only.

## Assumptions and unknowns

### Assumptions

1. Hub seam is authoring read, not partial update — confirmed by 0.1.25.
2. Prefer composite id for show; bare `definition.id` for update/delete.
3. Operator WebRTC already admits mutation-group ops including authoring read (`allow_runtime`).
4. ~~Form field vocabulary is sufficient~~ **RETRACTED.** Replaced by the field map above. Visible create controls alone are **not** a complete edit projector.
5. Description/icon empty → omit is accepted normalization for this ticket.
6. Opaque carry of `definitionTargetId` without a new create UI control is acceptable if edit seed/re-emit is proven; create may continue omitting `target_id` unless already authored.

### Unknowns (Implement resolves with evidence)

1. Exact action-result nesting for `session_type_definition` — follow existing `actionResultFrame` patterns.
2. **Hub binary for live smoke:** Implement must build (or point at) a binary from hub commit **≥ `302190e`** on `origin/main` (merge of the 0.1.25 release PR; contains authoring view). Record that commit and harness `binary_provenance` in evidence. Do not treat “run bare npm script” as sufficient.
3. Whether create form should later expose definition `target_id` as a control — **not required** for this ticket if the opaque edit path is proven with a fixture that has the field.

## Affected surfaces / files

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | Pin 0.1.25 |
| `src/botster/generated/daemon-protocol.ts` | Byte-exact vendor |
| `src/botster/hubTransport.ts` | show + update; authoring payload on action result |
| `src/App.tsx` | Edit control; form mode; field map including `definitionTargetId`; submit update |
| `src/App.test.mjs` | Flip withheld gates; lossless projector tests |
| `scripts/live-packaged-protocol-harness.mjs` | Rendered edit + read-back + target_id oracle |
| `scripts/live-packaged-protocol-helpers.mjs` | Only if needed |
| `README.md`, `docs/architecture.md` | Pin/revision sync |
| `docs/plans/session-type-edit-control.md` | This plan |

## Risks

| Risk | Mitigation |
| --- | --- |
| Silent drop of path/env/`target_id`/context on edit | Field map + ablation unit tests + live read-back |
| Confusing mutation `source.target_id` with definition `target_id` | Distinct form fields; map table; oracle uses definition field |
| Composite vs bare id | Rendered show/update oracles |
| Pin/doc drift | Drift script + dual-doc pins |
| Late harness failure mis-attributed as pass | Base isolation; known-gap reporting |
| Old Hub binary | Explicit build commit + binary_provenance |

## Acceptance checks / tests

### Local gates

```text
npm install
npm run typecheck
npm test
npm run build
```

### Live smoke (runnable form — required)

Hub binary **must** include `show_session_type_definition` (hub `origin/main` ≥ `302190e`).

```text
# Build example (Implement records actual paths + hub commit SHA):
#   cd <botster-hub-checkout-at-or-after-302190e> && cargo build -p botster-hub …
export BOTSTER_HUB_BIN=/path/to/botster-hub
export BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker
npm run smoke:live-packaged-protocol
```

Capture from harness output:

- `binary_provenance` (hub + worker)
- session-type stage oracles (create path+env, show composite, update bare id, preserved fields on request, **read-back after re-open Edit**, form promise, target_id survival)
- no list hydration

### Base isolation for pre-existing late failure (required when full command ≠ 0)

1. **Before product edits (or against clean `origin/main`):** run the **same** live command; record first failing step name/message.
2. **After product edits:** run again; first non-cascade failure must match base (expected: `waitForTerminalDetached` / `[data-terminal-session-id='none']` owned by `ticket_1786042828_142991`).
3. Report the lane as **session-type oracles proven; full harness known-gap**, never as an unqualified pass.
4. Do not weaken or delete oracles to force exit 0.

### Unit evidence

- Projector preserves path, environment, context, `target_id` across unrelated edit.
- Ablation of `definitionTargetId` fails that oracle.

## Vault gaps worth capturing

1. **Lossless edit = seed + re-emit of full authored definition**, including non-rendered fields — generalization of [[sanitized projection plus wholesale replacement update contracts silent data loss]] for client form projectors. Capture after Implement if the pattern is confirmed.
2. `web-session-creation-must-be-target-first` Implementation section still Rails-era (pre-existing).
3. Env-gated live harness detach break remains sibling `ticket_1786042828_142991`.

## Implementation sequence

1. Bump 0.1.25; vendor; dual-doc pins; drift green.
2. Transport show + update + authoring action-result payload.
3. Form field map including `definitionTargetId`; Edit UI; open-edit seed; update submit.
4. Unit/component tests (including ablation).
5. Live harness: primary path + read-back + target_id oracle; run with Hub/worker bins; record provenance; base-isolate late failure if needed.
6. Commit; implementation report; do not claim full harness pass if only late sibling stage fails.

## Botster layers touched

- React SPA / Ionic settings session-types
- Generated Hub DTO consumption
- Live browser packaged-protocol harness

Not touched: Lua plugins, Hub source (consume only), TUI, Project Pipelines package code.
