# Rename the Workspaces browser-driver spawn field to `session_type_id`

Ticket: `ticket_1786036336_442121`
Run: `run_1786046979_501325`
Target repository: **trybotster/botster-web** (`tgt_40abcf71ccf049f4ac0c99953a799869`)

Revision 2 — amended after Plan Review `review_1786048036_161044` (changes required).
All five findings are accepted; two changed the plan materially rather than cosmetically.
See "Plan Review response" at the end.

## Routing

`target_id` `tgt_40abcf71ccf049f4ac0c99953a799869` resolves to `trybotster/botster-web`.
The run worktree's `origin` remote is `git@github.com:trybotster/botster-web.git`, so the
authoritative target and the ambient directory agree; the plan is built from the target
repository regardless. Repositories are named by `target_id` and repository name
throughout — no local filesystem paths, per
[[plan agents must author vault context as wikilinks not home paths]].

### Context loaded

Role and repository charters:

- [[planner-playbook]] — generic Plan contract
- [[botster-planner-playbook]] — Botster Plan overlay
- [[botster-web-playbook]] — repository ownership charter
- [[botster repository playbooks are ownership charters composed with role overlays]]

Mandatory `[[botster-planner-playbook]]` "Must Load" set:

- [[botster-architecture]] — Botster domain map
- [[cli-patterns]] — Rust CLI/PTY/runtime constraints; supplies the Hub/worker build seam
- [[spa-patterns]] — React entity-store and renderer constraints
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]

Targeted notes implicated by this task surface:

- [[botster web form actions must preserve collected values into transport payloads]] —
  the renderer-to-transport seam this driver exercises: collected `params.values` must
  become the `plugin_surface_action` payload. Acceptance must type into the real rendered
  form and assert the same values arrive in the plugin action payload.
- [[downstream validators inherit selector pinning making negative assertions tautological]] —
  names this exact harness. Drives the redesigned option-value proof below.
- [[live hub proof records distinct hub and locked core binary provenance]] — drives the
  dual-source provenance procedure below.
- [[required smoke modes must disable skips and prove execution positively]] —
  required modes must neutralize skip paths and carry positive completion evidence.
- [[stale project pipeline worktrees can miss merged dependency apis]] — the run base is
  stale; this is the named failure mode.
- [[cold turkey migrations eliminate dual code paths and version suffixes]] — no alias.
- [[pipeline vault checklists must cite exact resolvable note titles]] — every title above
  was validated against its exact vault filename before submission.

`[[project-pipelines-playbook]]` deliberately not loaded: no Project Pipelines
package/plugin path and no workflow-policy change is in scope.

Repository context read: `botster-web` at `origin/main` and at the run base;
`botster-workspaces` at its merged head; `botster-hub` at the pinned protocol-6 revision.

## Baseline correction — rebase and reinstall first

The run worktree was cut at `49d7fd6` (merge of PR #83). `origin/main` has since advanced
to `19bd32c` (merge of PR #82). This is precisely
[[stale project pipeline worktrees can miss merged dependency apis]]: planning against the
stale base would produce a false picture of what remains.

1. **Rebase onto `origin/main` (`19bd32c`).** Two facts exist only there:
   - PIECE 2. At `49d7fd6` the fixture still writes `.botster/session-templates.json`
     with key `session_templates`. At `origin/main` it writes `.botster/session-types.json`
     with key `session_types` and the six required fields
     (`scripts/workspaces-shared-hub-browser-smoke.mjs:152-166`).
   - Web's production spawn vocabulary. At `49d7fd6`, `src/App.tsx:688` and
     `src/botster/hubTransport.ts:1113,1136` still read `template_id`. On `origin/main`
     they are already `session_type_id`, so no production `src/` change is in scope.

2. **Realign dependencies to the lockfile.** Rebase does not update `node_modules`.
   Observed in this worktree: installed `@trybotster/hub-test-support` is **0.1.21** while
   `package.json` requires **0.1.24**, which makes `npm test` stop at
   `check-daemon-protocol-drift.mjs` before `App.test.mjs` ever runs.

   ```bash
   npm install
   npm ls @trybotster/hub-test-support   # must report 0.1.24
   ```

   Run this before any gate, or the gates measure the wrong contract.

All line references below are against `origin/main` (`19bd32c`).

## Scope

Cold-cut the Workspaces browser acceptance driver's spawn-field vocabulary from
`template_id` to `session_type_id`, correct the spawn-case **value** to the Hub-qualified
session-type id, make the qualified-value proof independent of the injected value, and
prove the lane end to end against a real Hub carrying the merged Workspaces package.

### In scope

| Site | Change | Why forced |
| --- | --- | --- |
| `scripts/workspaces-shared-hub-browser-helpers.mjs:69` | `template_id` -> `session_type_id` in the `parseWorkspacesSpawnAssignment` normalizer (key and `requiredString` path label) | Named by the ticket; owns the assignment vocabulary every consumer reads |
| `scripts/workspaces-shared-hub-browser-smoke.mjs:135` | `template_id: "shared-browser"` -> `session_type_id: "shared-git/shared-browser"` | Named by the ticket; value corrected — see "The value changes too" |
| `scripts/live-packaged-protocol-harness.mjs:1956` | `spawnCase.template_id` -> `spawnCase.session_type_id`, **and** enumerate rendered options first | Reads the renamed helper field; independence fix |
| `scripts/live-packaged-protocol-harness.mjs:1972` | assertion key `template_id` -> `session_type_id`, **and** re-key correlation off `values` | **The wire-level break**, plus the tautology fix |
| `src/App.test.mjs:79` | assignment fixture field rename | Exercises the renamed parser |
| `src/App.test.mjs:1263` | source-text pin on the smoke's spawn case | Pins the renamed key and qualified value |
| `README.md:159,166` | `BOTSTER_WORKSPACES_SPAWN_CASES` schema docs | Documents the renamed caller-owned contract |

### The ticket's file list is incomplete, and the harness sites are inside its boundary

The ticket names two files. The real break surface is four code sites across three script
files. `scripts/workspaces-shared-hub-browser-driver.mjs` is a 14-line shim that sets
`BOTSTER_LIVE_SHARED_HUB_DRIVER=1` and imports `live-packaged-protocol-harness.mjs`; the
shared-Hub browser driver **is** that harness. So the harness edits fall inside the
ticket's own prose boundary ("the Workspaces browser acceptance driver only"), and they
are additionally forced by the helper rename.

Both sites live in `driveSharedHubSpawnCase` (line 1878), reachable only from
`exerciseSharedHubWorkspaces` (1745), reachable only from the `sharedHubDriverMode` branch
at line 227. **No other lane executes them.** `smoke:workspaces-compat` and
`smoke:workspaces-lifecycle` are untouched.

Line 1972 is the deterministic failure the ticket predicts. It asserts the
renderer-collected submit payload:

```js
values: { target_id, workspace_id, branch, template_id: spawnCase.template_id, prompt, ticket_id }
```

The Workspaces plugin now names that select input `session_type_id` (`plugin.lua:1231-1236`:
node id `botster-workspaces-spawn-template`, `name` = `session_type_id`). The Web renderer
collects form values by the node's `name` prop — the seam
[[botster web form actions must preserve collected values into transport payloads]] pins —
so the real request carries `session_type_id` and this assertion fails. Line 1956 selects
by **node id**, which Workspaces did not rename, so the selector still resolves; only the
value source moves.

### The value changes too — this is not purely mechanical

The ticket calls the work "small and mechanical." The key rename is; the value is not.

Hub qualifies effective session-type ids as `source_name/id`
(`botster-hub src/session_types.rs:767`), and for a repo source `source_name` is the spawn
target id (`:902`). The projection Workspaces consumes (`list_session_types_for_target`,
`:650`) returns `HubSessionType` rows whose `session_type_id` carries that qualified form
(`:689`), and the plugin maps it straight into the select option value
(`plugin.lua:591-594`; `test/plugin_runtime_test.lua:64` documents "fully qualified as
`<source name>/<id>`").

The smoke admits its fixture repo as spawn target `shared-git`
(`workspaces-shared-hub-browser-smoke.mjs:55`) and seeds a repo session type `shared-browser`.
The rendered option value is therefore **`shared-git/shared-browser`**. Renaming the key
while keeping the bare `shared-browser` would select a value that does not exist among the
rendered options — a green-looking rename that still cannot spawn.

### Out of scope

- **Session-types management UI** — `ticket_1785970233_750553`, merged as PR #82.
- **Hub General/Maintenance surface** — `ticket_1785970234_234515`, merged as PR #83.
- **`waitForTerminalDetached` and the env-gate drift class** — `ticket_1786042828_142991`.
  Confirmed non-blocking here: `sharedHubDriverMode` returns at harness line 227-234,
  before that call at line 398.
- **Web-internal Hub-native spawn vocabulary** — already `session_type_id` on `origin/main`.
- **`docs/plans/manage-authoritative-hub-session-types.md`** — historical record of a
  merged run, including its correct rationale for deferring this rename.
- **No compatibility alias**, per [[cold turkey migrations eliminate dual code paths and version suffixes]].

## Ownership boundaries and cross-repo dependencies

Every edit is a botster-web test/driver/doc asset. No protocol meaning, session policy, or
package contract moves into this repository. Per `[[botster-web-playbook]]` "Does Not Own",
Web stays a consumer: the field name and the qualified-id shape are read from the merged
Workspaces plugin and Hub's projection, never invented here.

| Repository | `target_id` | Role | State |
| --- | --- | --- | --- |
| botster-workspaces | `tgt_71266a8d976d4535902ffed09c18a7ba` | Owns the spawn form field name | **Merged** at `3ec366abd1fd86dcade81b7a14470dcacfcbd504`. Registered as `dependency_1786036350_443365`; `ticket_1785984128_479155` closed. |
| botster-hub | `tgt_7e208a0c76a44980a83b63af976b1f22` | Owns the qualified-id shape and the repo session-type file | `8a60bd58841179f8b1fd4040d9362d18ea244230`. Consumed, not changed. |
| botster-core | `tgt_1f7bce66eb304881980f9b4a2a5ae3fe` | Owns the session worker | `33ebcd98d19031d23e91b03d8da0ee3f8d1410d4` — the revision **locked by the Hub checkout**, not the Hub SHA and not any local checkout. |
| botster-tui | `tgt_c3d470bab78549df920a41e8fb0e58d8` | Owns the equivalent TUI driver rename | `ticket_1786036326_597046`. Not this run. |

No new cross-repository dependency is needed: the one blocking dependency is closed and
its artifact is a merged package checkout, not an unpublished registry coordinate.

## Runtime provenance — two source identities, not one

Per [[live hub proof records distinct hub and locked core binary provenance]], `botster-hub`
and `botster-session-worker` have **distinct** source identities. A SHA-256 digest proves
binary stability across the run; it does not prove which source produced the binary.

**This is not hypothetical here.** Hub's `Cargo.lock` pins Core as a git dependency:

```
name = "botster-core"
source = "git+https://github.com/trybotster/botster-core?branch=main#33ebcd98d19031d23e91b03d8da0ee3f8d1410d4"
```

An ambient `botster-core` checkout is on an unrelated branch at a different revision, so
pointing `BOTSTER_SESSION_WORKER_BIN` at *its* target directory would supply a worker from
a revision the Hub never locked. Revision 1 of this plan did exactly that. The worker must
come from the locked revision, built under the Hub checkout.

Procedure, from a clean `botster-hub` checkout at the exact Hub SHA:

```bash
git rev-parse HEAD                 # must equal 8a60bd58841179f8b1fd4040d9362d18ea244230
git status --porcelain             # must be empty
cargo build --locked --release -p botster-hub --bin botster-hub
grep -A 2 'name = "botster-core"' Cargo.lock   # confirm locked Core rev 33ebcd98...
cargo build --locked --release -p botster-core --bin botster-session-worker
realpath target/release/botster-hub target/release/botster-session-worker
```

Both realpaths must live under that checkout's `target/` directory. Record in the report:
the Hub SHA, its clean status, the locked Core SHA read from `Cargo.lock`, both build
commands, both resolved realpaths, and the SHA-256 digests the smoke emits. Rebuild
whenever the source-to-binary binding cannot be proven — a prebuilt binary of unknown
provenance is not evidence.

**Workspaces provenance** is pinned the same way, not as "`3ec366a` or later". Record the
exact consumed checkout SHA `3ec366abd1fd86dcade81b7a14470dcacfcbd504`, confirm it is
clean, and inspect the consumed tokens directly rather than inferring them:

```bash
git rev-parse HEAD && git status --porcelain
grep -n 'session_type_managed_git_spawn' botster-package.json   # legacy scope must be absent
grep -n 'session_type_id' plugin.lua                            # form field name
```

## Assumptions and unknowns

**Assumptions, each verified during Implement rather than asserted:**

1. The rendered option value is `shared-git/shared-browser`. Derived from Hub source; the
   redesigned proof below **observes it independently** rather than trusting this reading.
   If the live enumeration disagrees, this plan is wrong and Implement should say so.
   **Confirmed during Implement.** The live enumeration recorded
   `session_type_options: ["shared-git/shared-browser"]` in all four spawn cases across
   both generations — a single-element list, so the bare `shared-browser` was genuinely
   not selectable and the value correction was load-bearing, not cosmetic.
2. `npm install` reconciles `@trybotster/hub-test-support` to 0.1.24 without further drift.
   **Confirmed:** `npm ls` reports 0.1.24 and `npm test` reaches `src/App.test.mjs`.
3. Rebasing onto `19bd32c` is conflict-free: this branch has no commits yet. **Confirmed.**

**Unknowns:**

- Whether the live smoke surfaces further protocol-6 drift beyond this rename. Routing
  rule: drift caused by this rename is in scope; drift in untouched code belongs to
  `ticket_1786042828_142991`. Either way it is a finding with exact output, never a
  weakened lane.
- Whether the qualified id makes the caller-owned assignment contract awkward for callers
  that know only the bare authored id. Observation only; changing the contract is not
  this ticket.

## Affected surfaces and files

```
scripts/workspaces-shared-hub-browser-helpers.mjs   assignment parser vocabulary
scripts/workspaces-shared-hub-browser-smoke.mjs     spawn-case key and value
scripts/live-packaged-protocol-harness.mjs          option enumeration, select fill, request correlation
src/App.test.mjs                                    parser fixture, smoke source pin, negative control
README.md                                           BOTSTER_WORKSPACES_SPAWN_CASES schema
docs/plans/rename-workspaces-browser-driver-spawn-field.md   this plan
```

Unchanged and deliberately so: `scripts/workspaces-shared-hub-browser-driver.mjs`
(carries no field name), all of `src/` production code, and the
`botster-workspaces-spawn-template` node id.

## Risks

1. **Key renamed, value left bare** — the most likely way to ship a broken green. The
   independent option enumeration is the control.
2. **Tautological proof.** Asserting a value the harness itself injected and then selected
   on proves nothing. Addressed structurally below.
3. **Worker built from the wrong Core revision.** Colocation under a target directory is
   not provenance. Addressed by the dual-source procedure.
4. **Stale `node_modules`** silently measuring the wrong protocol contract.
5. **Partial rename** leaves harness:1956 passing `undefined` into the select. Gate on
   zero remaining `template_id` outside `docs/plans/`.
6. **Waiving a pre-existing live failure.** Do not. Produce exact output and attribute it
   to the owning ticket, or route back.

## Acceptance checks and tests

Repository-owned gates from `[[botster-web-playbook]]`, after rebase and `npm install`:

```bash
npm run typecheck
npm run lint
npm run build
npm test                       # check-daemon-protocol-drift + src/App.test.mjs
```

### Downstream proof (PIECE 3)

```bash
BOTSTER_HUB_BIN=<hub-checkout@8a60bd58>/target/release/botster-hub \
BOTSTER_SESSION_WORKER_BIN=<hub-checkout@8a60bd58>/target/release/botster-session-worker \
BOTSTER_WORKSPACES_PACKAGE_PATH=<workspaces-checkout@3ec366ab> \
npm run smoke:workspaces-shared-hub-browser
```

Both binaries come from the **Hub** checkout — the worker from the Core revision that
checkout locks. This is the charter's "applicable packaged-browser/live-hub smoke" and the
ticket's end-to-end proof: it installs and enables the merged Workspaces package on a real
Hub, drives the real rendered Ionic form in a real browser, and spawns a real managed-Git
session.

### The qualified-value proof must be independent

`setUiNodeSelectValue` (harness:2067) assigns `select.value` directly and dispatches
`ionChange`; it never checks the value exists among the rendered options.
`waitForWorkspacesPluginSurfaceRequest` (harness:2274) then **filters** candidate events by
`stableJson(request.values) === stableJson(expected.values)` (line 2297). So passing the
expected values as the wait predicate makes the later "assertion" a selection criterion —
the tautology named in
[[downstream validators inherit selector pinning making negative assertions tautological]],
which cites this very harness. A driver could inject the bare `shared-browser`, emit a
payload containing it, and the wait would happily match.

Apply repair shape 2 from that note — capture by an orthogonal key, then assert identity:

1. **Enumerate before injecting.** Read the rendered option values under
   `[data-ui-node-id='botster-workspaces-spawn-template']` (the renderer emits
   `ion-select-option` per `src/botster/IonicUiNodeRenderer.tsx:914`) *before* setting the
   field. Assert the assignment's `session_type_id` is a member, and record the full
   enumerated list in the summary. This observes what Hub and Workspaces published,
   upstream of any injection.
2. **Correlate by `request_id`, not by expected values.** Capture the raw
   `plugin_surface_action` request by its `request_id` (or another orthogonal token such as
   sequence position), then assert `session_type_id` and its value on that captured
   payload. Do not pass the expected `values` map as the wait predicate for the field under
   test.

Only then does the report's "observed rendered option value" mean anything.

### Required evidence in the implementation report

1. `workspaces-shared-hub-browser-summary` JSON, both generations, `completed: true` —
   the positive completion ledger [[required smoke modes must disable skips and prove execution positively]]
   requires. Note that `assertNoRequiredSmokeSkip`, `proveSkipRejection`, and
   `assertTwoGenerationLedger` already implement both safeguards; name them as satisfied.
2. The **enumerated** rendered option values, and the qualified id observed among them.
3. The `request_id`-correlated submit payload carrying `session_type_id` — structured
   protocol evidence, not toast text.
4. Accepted action results and correlated Hub/session identity per case.
5. Full dual-source provenance: Hub SHA, clean status, locked Core SHA, both build
   commands, both realpaths, both digests, plus the Workspaces checkout SHA and inspected
   tokens.
6. Package admission succeeding — the
   `UngrantedCapability(session_template_managed_git_spawn)` denial that blocked
   `ticket_1785970233_750553` must be gone.

### Cold-cut gate and negative control

- No live code references `template_id`:
  `git grep -n 'template_id' -- scripts/ src/ ':!src/App.test.mjs'` returns nothing.
- `src/App.test.mjs` must assert `parseWorkspacesSpawnAssignment` **rejects** an assignment
  carrying the old `template_id` key, proving the alias is absent rather than merely
  unused.

**Amended during Implement (revision 2 gate was self-contradictory).** Revision 2 wrote
this gate as `git grep -n 'template_id' -- . ':!docs/plans'` returning nothing, which the
negative control on the very next line cannot satisfy: rejecting the old key requires
naming it in the rejected input. The gate's intent is "no *live* driver or production code
still keys on `template_id`", so it is scoped to `scripts/` and `src/` excluding the test
that enforces the cut. The four surviving occurrences in `src/App.test.mjs` are cold-cut
enforcement, not usage: two explanatory comments, the deliberately-rejected assignment, and
an `assert.doesNotMatch(..., /template_id/)` pin on the smoke script. `docs/plans/` remains
excluded as historical record.

## Production path

Not scaffold-only. The changed lines are the acceptance driver's own submission path, and
the runtime path proven is the real one: rendered Workspaces spawn form -> Web renderer
form-value collection -> `plugin_surface_action` -> Workspaces `spawn_session` -> Hub
`ensure_worktree_and_spawn` -> managed-Git worktree and live session. Web's production
`src/` is already migrated on `origin/main` and is exercised unchanged by the same run.

## Plan Review response

| Finding | Severity | Disposition |
| --- | --- | --- |
| `finding_1786048036_452757` — absolute path leakage | high | Fixed. Every user-specific absolute filesystem path removed; repositories cited by name and `target_id`, vault context by wikilink, runtime locations by placeholder. |
| `finding_1786048036_279468` — provenance does not bind binaries to distinct revisions | high | Fixed, and it was a real defect. Hub locks Core as a **git** dependency at `33ebcd98...`; the ambient Core checkout is on an unrelated branch, so revision 1 would have supplied a worker the Hub never locked. |
| `finding_1786048036_540202` — non-independent option-value oracle | medium | Fixed. Verified the mechanism in source: `setUiNodeSelectValue` does not validate membership, and the wait helper filters on `request.values`. Redesigned per repair shape 2. |
| `finding_1786048036_241678` — missing mandatory context | medium | Fixed. Mandatory overlays and all six targeted notes loaded, cited, and applied to concrete plan constraints. |
| `finding_1786048036_297747` — dependency install alignment | low | Fixed, and reproduced: installed `hub-test-support` is 0.1.21 against a required 0.1.24. |

## Vault gaps worth capturing

1. **Hub qualifies effective session-type ids as `source_name/id`, and for repo sources
   `source_name` is the spawn target id.** Two repositories' acceptance drivers key on this
   value; nothing in the vault records it.
2. **A cold-cut field rename can be a value-shape change, not only a key change.**
   Generalizable check: when a migration renames an identifier field, ask whether the
   identifier's shape moved with it.
3. **Ticket file lists are leads, not boundaries.** This ticket named two files; the
   wire-level break was in an unnamed third. Trace the consumer graph before accepting a
   stated surface.
4. Possible `[[botster-web-playbook]]` extension: the shared-Hub browser driver is
   `live-packaged-protocol-harness.mjs` behind a 14-line shim, and its lanes are
   mode-gated — which decides *which known breaks apply to which lane*. Non-obvious from
   filenames.
