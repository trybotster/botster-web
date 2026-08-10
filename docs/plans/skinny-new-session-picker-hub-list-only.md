# Web: skinny New session picker — Hub list only, no client eligibility filter

**Plan revision:** 2 (addresses Plan Review `review_1786394913_313718` / `changes_required`)

**Ticket:** `ticket_1786387865_686375`

**Run:** `run_1786394076_567237`

**Step:** `botster_stack_plan` (sequence 3)

**Durable artifact (rev1):** `artifact_1786394337_903734` — same URI; this revision updates the plan body in place.

**Runtime-teardown class:** **Does not apply** (ordinary SPA UI + daemon list/spawn presentation; no WebRTC/peer lifecycle ownership change).

### Plan Review findings closed by this revision

| Finding | Severity | Fix in rev2 |
| --- | --- | --- |
| `finding_1786394913_271278` Required live proof can become an unowned residual | high | Live New-session list+spawn oracles are **required**, not residual. Hub binary must be rebuilt from **`cb93df53d6` or newer** (conformance **33**). If live cannot execute, Implement must **register a blocking owner ticket + dependency** — no informal waiver. |
| `finding_1786394913_983479` Required lint gate already fails on base | medium | Record baseline failure (`rejectSince` unused at `scripts/live-packaged-protocol-harness.mjs:3389`). **Own** the one-line deletion in this ticket because the harness is already in scope. `npm run lint` remains a required green gate. |
| `finding_1786394913_122643` Omits request-state guidance and race proof | medium | Load [[botster web request caches belong in react query not zustand or hub session getters]]. Classify list as **one-shot modal request** (not React Query cache; not entity store). Require target/request identity + stale-response acceptance test. |
| `finding_1786394914_447954` Plan completion evidence omits durable artifact id | medium | Gate + advance evidence include `artifact_id` (rev1 id and/or new revision artifact id). |

---

## Target repository and target_id

| Field | Value |
| --- | --- |
| **Target repository** | `trybotster/botster-web` (`botster-web`) |
| **Target id** | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| **Resolution** | Run/ticket `target_id` + project spawn-target map; package name `botster-web` and remote `git@github.com:trybotster/botster-web.git` in the pipeline worktree. **Not** inferred from ambient process cwd alone. |
| **Repository playbook** | [[botster-web-playbook]] |

---

## Repository playbook loaded

- [[botster-web-playbook]] — Ionic React client shell; renders Hub-owned state/actions; **does not** own session-type eligibility policy. Charter must-loads include request-cache boundary and dual-doc pin discipline.

## Other role/surface playbooks and atomic notes loaded

### Role overlays

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[spa-patterns]] (Botster planner must-load; browser as structured-state renderer)
- [[botster-architecture]] (domain map)

### Targeted atomic notes

- [[hub qualifies effective session type ids as source name slash id]]
- [[web-session-creation-must-be-target-first]]
- [[device hub owns admitted spawn targets not ambient repo cwd]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[botster web uses vanilla ionic primitives by default]]
- [[botster web request caches belong in react query not zustand or hub session getters]] ← **added rev2**
- [[prefer framework and library components over custom solutions]]
- [[vault example paths are not repository placement conventions]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[pipeline vault checklists must cite exact resolvable note titles]]

### Explicitly **not** loaded (out of class / out of scope)

- [[botster runtime teardown lenses]] — not runtime-teardown class
- [[project-pipelines-playbook]] — not Project Pipelines package/plugin paths
- [[botster-hub-playbook]] / [[botster-tui-playbook]] — ownership for parent/sibling tickets only; not this run’s charter

---

## Context loaded

### Ticket intent

New session at an admitted spawn point (e.g. Hub) shows **empty types** when only Global/device types exist, because Web fat-filters the management `session_type` entity catalog with:

```ts
sessionType.target_id === spawnPointTargetId
```

Device rows carry storage provenance `device:local` (management catalog), so they never match real spawn-point ids. Hub now owns Option A eligibility; Web must stop inventing spawn policy.

### Parent Hub dependency (closed + published artifact)

| Item | Status |
| --- | --- |
| Parent ticket | `ticket_1786387816_590636` **closed** |
| Parent PR | `trybotster/botster-hub` **#202** merged (`cb93df53d6`) |
| Public request | Additive `DaemonRequest` tag `list_session_types_for_target` with `{ target_id: string }` |
| Response | Existing `session_types` kind / `DaemonSessionType[]` (list-context `target_id = T`, effective `session_type_id`) |
| Spawn | `spawn_session_type` accepts every id list-for-T returns under Option A |
| Consumable npm | **`@trybotster/hub-test-support@0.1.26`** published; protocol **6**, conformance **33**, token `list_session_types_for_target` present |
| Web pin today | `@trybotster/hub-test-support@0.1.25` / conformance **32** — **must bump** as artifact-coupled consume |

Pipeline dependency row: `dependency_1786387869_522414` → parent **closed**. Source merge alone is insufficient per [[closed dependency tickets signal merged source not a consumable release]]; registry 0.1.26 is the load-bearing consume proof for **DTO/tests**. Live runtime proof requires a **Hub binary rebuilt from `cb93df53d6` or newer** (see Live proof section).

### Production code path (current fat client)

| Location | Behavior |
| --- | --- |
| `src/App.tsx` `sessionTypesForSpawnTarget` | Filters entity rows by `target_id === T` |
| `spawnSessionFormForTarget` / `openSpawnSession` | Seeds modal from entity catalog filter |
| Modal render `spawnSessionTypes` | Re-filters entity list while open |
| Empty copy | “No session types are available for this spawn point.” when filtered list empty **or** still loading entity family |
| `spawnSessionAction` → `botster.spawn_point.spawn_session` | Thin map → `hubTransport` `spawn_session_type` with `session_type_id` + `request.target_id` (**keep**) |
| Management | Held `session_type` subscription + CRUD/authoring via `botster.session_type.daemon_request` (**keep**) |
| Entity projection | `sessionTypeEntityRecord` sets store `id` = composite `session_type_id`, `definition_id` = bare id (**management only**) |

### Protocol / pin baseline in this worktree

- Vendored `src/botster/generated/daemon-protocol.ts` lacks `list_session_types_for_target`.
- README + `docs/architecture.md` both claim `@trybotster/hub-test-support@0.1.25` and revision-32 (claims present → two-document sync rule is **active** for this bump).
- `src/App.test.mjs` asserts metadata revision **32** and documents zero `list_session_types` traffic for management path.

### Baseline gate failure (rev2 — measured)

On `origin/main` at `6bfb4bba` (this worktree):

```text
npm run lint
# 1 error: scripts/live-packaged-protocol-harness.mjs:3389
# 'rejectSince' is assigned a value but never used  @typescript-eslint/no-unused-vars
# (+ pre-existing react-refresh warnings; error fails the gate)
```

Plan Review independently confirmed the same. **This ticket owns** deleting the unused `rejectSince` binding because the live harness is already in scope for New-session list/spawn oracles. Do **not** leave lint red or file a separate ticket for a one-line unused-binding delete in a file we already touch.

### Live Hub binary note (rev2 — measured by Plan Review)

An ambient Hub binary that reports **conformance revision 32** cannot prove the revision-33 list contract. Source `main` is merged at `cb93df53d6` and package `0.1.26` is on the registry. Implement **must** rebuild/use Hub + session-worker from **`cb93df53d6` or newer** for live acceptance (or block with a registered ticket — see Live proof).

---

## Scope and non-scope

### In scope (botster-web only)

1. **Consume** published Hub contract: pin `@trybotster/hub-test-support@0.1.26`, copy generated `daemon-protocol.ts` from the package (no hand-authored DTOs), update dual doc pin/revision claims when package pin moves.
2. **Remove** production fat-client eligibility filter `sessionTypesForSpawnTarget` (and any equivalent target_id equality used to build New session options).
3. **On open New session for admitted target T:** issue Hub target-scoped list via production transport:
   - Preferred: extend existing `botster.session_type.daemon_request` with `request_type: "list_session_types_for_target"` + `target_id`, mapped in `sessionTypeRequestFromAction` → `{ type: "list_session_types_for_target", target_id }` and return `session_types` on the action result (same pattern as authoring definition payload).
   - Do **not** invent a second eligibility matrix or browser-only policy.
4. **Render** only Hub-returned options: labels + effective ids (`session_type_id` / store-style composite id). Keep unavailable rows disabled when Hub sets `available === false`. Do not re-filter by entity `target_id`.
5. **Empty state only** when Hub returns an empty list for an enabled admitted T after a successful list response. Distinct loading and transport/error states (typed Hub reject for non-admitted target is an error/diagnostic path, not the “no types” empty copy).
6. **Submit** remains thin: `session_type_id` + spawn-point `target_id` + optional prompt via existing `botster.spawn_point.spawn_session` → `spawn_session_type`.
7. **Keep** entity `session_type` catalog for Session types management/authoring (`show_session_type_definition` lossless path). Management must not become the spawn picker authority.
8. **Request identity / stale response:** one-shot modal list with target- and request-generation identity so a late response for T1 cannot replace options after the user opens T2 (see Request-state decision).
9. **Baseline lint fix:** delete unused `rejectSince` at `scripts/live-packaged-protocol-harness.mjs:3389` (or equivalent) so `npm run lint` is green.
10. **Tests / harness:** unit + fixture transport + **required** live-packaged proof that New session open produces `list_session_types_for_target` and spawn succeeds against Hub ≥ `cb93df53d6`. Preserve authoring/CRUD oracles that still ban management `list_session_types` refresh if those remain correct.

### Non-scope

- Hub eligibility algorithm, materialize dual-root, or protocol publish (parent — done).
- TUI migration (`ticket_1786387865_677482`).
- Core taxonomy.
- Redesigning session-type management chrome, Workspaces spawn form (already list-for-target via plugin), or general UI polish beyond picker authority + empty/loading correctness.
- Introducing a new React Query dependency solely for this modal (see Request-state decision) unless a later ticket expands shared list caching.
- Runtime-teardown / WebRTC peer ownership changes.
- Project Pipelines engine/plugin work.
- Broad lint warning cleanup (`react-refresh/only-export-components` warnings are pre-existing and non-failing).

---

## Repository ownership boundaries and cross-repo dependencies

| Surface | Owner |
| --- | --- |
| Eligibility, list-for-T, materialize/spawn acceptance | **botster-hub** (parent ticket; not this run) |
| Public DTO / hub-test-support 0.1.26 | **botster-hub-client** package path (already published) |
| New session presentation, transport mapping, Ionic UI, browser tests | **botster-web** (this run) |
| TUI parity | **botster-tui** sibling ticket |
| Core | out of scope |

### Cross-repo dependencies

| Dependency | Target | Status | How this run consumes it |
| --- | --- | --- | --- |
| Hub eligibility + `list_session_types_for_target` | `tgt_7e208a0c76a44980a83b63af976b1f22` / ticket_1786387816_590636 | **Closed + merged** | Registry pin `@trybotster/hub-test-support@0.1.26` **and** live Hub binary rebuilt from **`cb93df53d6` or newer** |
| TUI sibling | `tgt_c3d470bab78549df920a41e8fb0e58d8` | Separate ticket | **Not** absorbed |

No new dependency is registered **up front**. If Implement cannot obtain/rebuild a Hub binary ≥ `cb93df53d6` to run the required live oracles, Implement must **create and register a blocking ticket** on the appropriate target (Hub binary distribution / CI pin / environment ownership — exact owner named in that ticket) and **block this run** rather than waiving live proof as residual.

---

## Request-state decision (rev2)

Loaded: [[botster web request caches belong in react query not zustand or hub session getters]].

| Question | Decision |
| --- | --- |
| Is spawn-point list a **cacheable remote query** shared across the app? | **No** for this ticket. It is a **one-shot modal request** issued on each New session open for target T. |
| React Query? | botster-web **does not currently depend on** React Query. Adding RQ solely for this ephemeral modal is out of scope and not required by the note’s anti-pattern (do not stash remote lists in Zustand/entity store or hub session getters). |
| Where does state live? | **Modal/local React state** on the New session form: `options`, `loadStatus`, `error`, plus **request identity** (`targetId` + generation token / request id). **Not** the entity store family `session_type`. **Not** hub session getters. |
| Stale response rule | A list response applies only if its `target_id` (and generation/request id) still matches the **currently open** modal target. Late T1 results after open T2 are discarded. Closing the modal invalidates in-flight apply. |
| Invalidation | No shared cache to invalidate. Re-open always re-requests. |
| Forbidden | Using entity catalog as fallback; writing list results into `session_type` entity family; global “last list” without target identity. |

---

## Assumptions and unknowns

### Assumptions (explicit)

1. Parent Option A is live on merged Hub main and in published 0.1.26 — **verified** via npm pack contents (`list_session_types_for_target`) and parent implement report.
2. Web should call the **daemon request** `list_session_types_for_target` (not reintroduce management `list_session_types` for the picker). Entity subscription remains management-only.
3. Option values for spawn must be Hub **effective** `session_type_id` (qualified `source_name/id`), consistent with [[hub qualifies effective session type ids as source name slash id]] and existing entity store `id` projection.
4. Auto-select when exactly one **available** type remains desirable UX and is still pure presentation (no eligibility invention).
5. Existing empty copy string can stay if and only if it is gated on Hub empty list success; loading/error copy must not collapse into that empty success state.
6. Dual README/architecture pin claims stay in sync for the 0.1.26 / revision-33 bump (claims currently present).
7. Hub typed rejects for disabled/missing targets surface Hub’s `error.message` verbatim (charter: report Hub verdict).
8. Implement can rebuild Hub from `cb93df53d6+` in the agent/CI environment (the authoritative Hub checkout may still hold an older binary — **rebuild required**).

### Unknowns (resolved by Implement execution, not by residual waiver)

1. Exact live-harness stage placement for the New-session list-for-target oracle (extend existing live session-type stages vs. a focused addition). Prefer the smallest addition that proves **production entry**: open New session control → daemon request → options render → spawn.
2. Whether ambient prebuilt binaries exist at the required SHA; if not, rebuild from source is the default path.

---

## Affected surfaces/files

| Path | Change |
| --- | --- |
| `package.json` / lockfile | Pin `@trybotster/hub-test-support` **0.1.26** |
| `src/botster/generated/daemon-protocol.ts` | Copy from published package (adds `list_session_types_for_target`) |
| `src/botster/hubTransport.ts` | Map list-for-target in `sessionTypeRequestFromAction`; include `session_types` on action result when present |
| `src/App.tsx` | Remove `sessionTypesForSpawnTarget` production use; open/load picker from Hub list; modal one-shot state with target/generation identity; keep spawn submit + management entity path |
| `src/App.test.mjs` | Replace fat-filter unit tests; assert list-for-target request/result path; **stale T1/T2 response** test; update pin/revision **33** assertions; keep management “no list_session_types refresh” where still true |
| `scripts/live-packaged-protocol-harness.mjs` | Prove target-scoped list traffic on New session open + spawn; **delete unused `rejectSince`** so lint is green |
| `README.md`, `docs/architecture.md` | Bump hub-test-support pin + revision-33 claims together |
| `docs/plans/skinny-new-session-picker-hub-list-only.md` | This plan (repo prior art path `docs/plans/`) |

---

## Implementation sketch (surgical)

1. **Protocol consume:** `npm install @trybotster/hub-test-support@0.1.26` → copy `daemon-protocol.ts` → dual-doc pin update → drift check green.
2. **Transport:** In `sessionTypeRequestFromAction`, before mutation-source requirement:

   ```ts
   if (requestType === "list_session_types_for_target") {
     const targetId = readConfigString(request.target_id);
     return targetId ? { type: "list_session_types_for_target", target_id: targetId } : undefined;
   }
   ```

   On response, pass through `session_types` on the action result envelope (mirror `session_type_definition` authoring pattern).

3. **UI state (one-shot modal):** On `openSpawnSession(target)`:
   - Set form shell: `targetId`, `targetLabel`, clear `sessionTypeId`/`prompt`, `loadStatus: "loading"`, `options: []`, clear error.
   - Bump `listGeneration` (or capture `requestId`) for this open.
   - Dispatch list-for-target for `targetId`.
   - On settle: apply options/error **only if** modal still open for the same `targetId` and generation/request id.
   - Auto-select when exactly one available option.
4. **Option identity:** `value` / submit id = Hub `session_type_id` (composite). Label = Hub `label`.
5. **Delete** `sessionTypesForSpawnTarget` export once all call sites and tests are retargeted (no dead fat-filter helper left).
6. **Do not** change `spawnSessionAction` request shape unless a real gap appears; it already sends `session_type_id` + target on the action.
7. **Lint baseline:** remove unused `const rejectSince = await harnessEventCount(page);` at harness ~3389 (or use the count if a subsequent oracle needs it — prefer delete if unused).
8. **Live bins:** rebuild Hub + session-worker from `cb93df53d6+`; export `BOTSTER_HUB_BIN` / `BOTSTER_SESSION_WORKER_BIN`; run live smoke oracles below.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Pin 0.1.25 while calling list-for-target | Hard pin + drift check + test metadata assertions |
| Empty state races while list in flight | Explicit loading status; empty copy only after successful empty list |
| Stale list for wrong target | Generation + targetId identity; unit test T1 late after T2 open |
| Using entity catalog as fallback when list fails | **Forbidden** — fail closed with Hub/transport error; no client eligibility fallback |
| Option value bare id vs qualified id | Always use Hub `session_type_id`; correlate spawn request in tests |
| Live Hub binary older than #202 / rev 32 only | **Required** rebuild ≥ `cb93df53d6`; refuse residual waiver; block with registered ticket if rebuild/run impossible |
| Baseline lint fails on unused `rejectSince` | Own one-line delete in this PR |
| Accidental reintroduction of management `list_session_types` for picker | Separate request type; tests assert `list_session_types_for_target` and keep management no-list-refresh oracles scoped correctly |
| Over-scoping management UI or React Query adoption | Touch only New session open/render/submit + protocol pin + harness lint + list oracles |

---

## Acceptance checks/tests

### Local / CI (required — all green)

```bash
npm install
npm test                 # drift check + App.test.mjs
npm run typecheck
npm run build
npm run lint             # must pass; owns rejectSince deletion
npm run smoke:browser-runtime
```

### Unit / fixture proofs (required)

1. **No fat filter:** `sessionTypesForSpawnTarget` absent from production `src/`.
2. **Open path:** opening New session for target T dispatches exactly one `list_session_types_for_target` with `target_id: T` through the real action → hubTransport → bridge request shape.
3. **Render authority:** options rendered are the Hub response set; a device Global option appears when Hub returns it for T (no client `target_id === T` filter).
4. **Empty only on Hub empty:** successful empty `session_types: []` shows empty copy; loading does not; error shows Hub/transport reason.
5. **Stale response (rev2):** open T1 (in-flight), open T2, resolve T1 late → options still match T2 only; T1 payload discarded.
6. **Spawn thin path:** selecting Hub option G and submit emits `spawn_session_type` with `session_type_id: G` and `request.target_id: T`.
7. **Management preserved:** Session types authoring still uses entity subscription + `show_session_type_definition` / create/update/delete; list-for-target is not written into the entity catalog.
8. **Protocol pin:** metadata package_version `0.1.26`, conformance_fixture_revision `33`, vendored protocol equals installed artifact, README + architecture both claim pin + `revision-33`.
9. **Lint:** `npm run lint` exit 0 (no unused `rejectSince`).

### Live / downstream consumer proof (required — not residual)

**Hard requirement (charter + Plan Review high finding):** Implement must run live packaged protocol smoke against a Hub binary whose source is **`cb93df53d6` or newer** (protocol 6, conformance **33**, list-for-target present). Ambient rev-32 binaries are **out of contract**.

```bash
# Rebuild example (paths illustrative; use worktree or Projects checkout at cb93df53d6+)
# cargo build --locked -p botster-hub --bin botster-hub
# cargo build --locked -p botster-core --bin botster-session-worker
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

**Required live oracles** (structured capture, not toast text alone):

1. Production New session open for admitted spawn point T produces `list_session_types_for_target` traffic.
2. Device Global type G appears among rendered options for T when Hub admits it.
3. Spawn of G at T is accepted (`spawn_session_type`) and yields a session entity / success path consistent with existing spawn proof.
4. Picker empty state only if Hub list empty (control with fixture or real empty target).
5. Record in implement report: Hub binary identity (path + git SHA or version metadata proving ≥ `cb93df53d6` / conformance 33).

**If live cannot reach execution** (no rebuild path, no bins, harness infra failure not caused by this change):

1. **Do not** mark live as residual success.
2. File an owner ticket on the correct target describing the missing binary/environment.
3. Register it as a **blocking dependency** on this ticket/run.
4. Leave this run blocked until live oracles can run — Plan Review / Verify reject informal waivers.

Unit/fixture proof remains necessary but **not sufficient** alone when a rebuildable Hub source is available (it is).

### Production entry point proof (required narrative in implement report)

Trace: **Spawn targets → “New session” button → IonModal open → `list_session_types_for_target` → IonSelect options → Start session → `botster.spawn_point.spawn_session` → `spawn_session_type`**. Evidence that code exists without this path is insufficient.

---

## Vault gaps worth capturing

1. **Management catalog vs spawn-point list split (client)** — entity `session_type` is authoring inventory; New session must use `list_session_types_for_target` only.
2. **Device Global multi-target eligibility (Option A)** — product rule for clients: do not filter device rows by `device:local` equality.
3. **One-shot modal list vs React Query** — ephemeral target-scoped list uses generation-guarded local state until RQ is a real stack dependency; still forbidden to cache in entity store.
4. **Artifact-coupled consume** — list-for-target lands in hub-test-support **0.1.26** / rev **33**; live also needs binary ≥ parent merge SHA.

No convention conflicts found between [[botster-web-playbook]] and this ticket after rev2 (request-cache note applied as one-shot + identity guards, not RQ adoption).

---

## Product decision ledger (this run)

| Decision | Choice |
| --- | --- |
| Eligibility owner | Hub only |
| Picker data source | `list_session_types_for_target` on open |
| Entity catalog | Management/authoring only |
| Client `target_id === T` filter | **Delete** |
| Fallback to entity list on list failure | **No** |
| List state model | **One-shot modal** + target/generation identity (not RQ cache this ticket) |
| Option id shape | Hub effective `session_type_id` |
| Spawn mapping | Keep existing thin action |
| Ionic | Keep IonModal / IonSelect / IonNote |
| Protocol pin | 0.1.26 / conformance 33 |
| Live proof | **Required** vs Hub ≥ `cb93df53d6`; no residual waiver |
| Baseline lint `rejectSince` | **Owned** by this ticket |
| Runtime-teardown | N/A |

---

## Pipeline gates and artifacts

- Gate: `botster_stack_plan_gate` (attestation) — this document + structured evidence fields.
- Plan URI: `docs/plans/skinny-new-session-picker-hub-list-only.md`
- Durable artifact id (rev1 create, body updated in rev2): **`artifact_1786394337_903734`**
- Optional: attach a new plan artifact revision on submit if the engine prefers a new id; still cite both URI and id in completion evidence.
- Next step: Plan Review (`botster_stack_plan_review`)
