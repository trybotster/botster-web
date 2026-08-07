# Repair live-protocol harness breaks that accumulated behind the env gate

Ticket: `ticket_1786042828_142991`
Run: `run_1786060051_411729`
Target repository: **trybotster/botster-web** (`tgt_40abcf71ccf049f4ac0c99953a799869`)

Revision 2 — amended after Plan Review `review_1786060819_237168` (changes required).
All seven findings are accepted. See **Plan Review response** at the end.

## Routing

`target_id` `tgt_40abcf71ccf049f4ac0c99953a799869` resolves to `trybotster/botster-web`.
The run worktree remote is `git@github.com:trybotster/botster-web.git` and the run
base target path is the botster-web checkout, so the authoritative target and the
assigned worktree agree. Repositories are named by `target_id` and repository name
throughout — no local home filesystem paths, per
[[plan agents must author vault context as wikilinks not home paths]].

### Target repository and target_id

| Field | Value |
| --- | --- |
| Repository | `trybotster/botster-web` |
| `target_id` | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Pipeline | `botster_stack_delivery` |
| Step | `botster_stack_plan` (return visit after Plan Review) |
| Gate | `botster_stack_plan_gate` |
| Worktree SHA at plan r1 | `8048118` |
| Plan artifact path | `docs/plans/repair-live-protocol-harness-env-gate-drift.md` |

### Repository playbook loaded

- [[botster-web-playbook]] — ownership charter for Ionic React client, live/packaged
  browser conformance from the browser consumer perspective.

### Other role/surface playbooks and atomic notes loaded

Role and repository charters:

- [[planner-playbook]] — generic Plan contract
- [[botster-planner-playbook]] — Botster Plan overlay
- [[botster-web-playbook]] — repository ownership charter
- [[botster repository playbooks are ownership charters composed with role overlays]]

Mandatory `[[botster-planner-playbook]]` "Must Load" set:

- [[botster-architecture]] — Botster domain map
- [[cli-patterns]] — Hub/worker binary and runtime seams the live harness consumes
- [[spa-patterns]] — React entity-store and renderer constraints
- [[project pipeline orchestration belongs in a device-level botster plugin]]
- [[project pipelines needs an operator workbench not more primitives]]
- [[project pipelines ui contract belongs in the plugin readme]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]

Targeted notes implicated by this task surface (exact vault filenames validated):

- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[live harness route expectations must mirror production route gating]]
- [[required smoke modes must disable skips and prove execution positively]]
- [[env gated assertions are proven executed by the absent else branch marker]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[an ablation that reddens at the first assertion does not vouch for later ones]]
- [[conformance harnesses gate on deterministic invariants not timing]]
- [[ticket file lists are leads not implementation boundaries]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan review must check open sibling tickets that own part of the plan scope]] —
  applied on return visit for same-target contention
- [[plan review must verify a plan artifact exists before trusting gate summaries]] —
  r1 failed this; r2 registers and commits the plan artifact
- [[plan agents must author vault context as wikilinks not home paths]]

`[[project-pipelines-playbook]]` deliberately not loaded: no Project Pipelines
package/plugin path and no workflow-policy change is in scope.

### Context loaded

Pipeline context:

- Ticket description: outstanding `waitForTerminalDetached` break; three already-repaired
  latent breaks; structural env-gate drift requirement.
- Plan Review `review_1786060819_237168` → **changes_required** with 7 open findings
  (1 blocker, 3 high, 2 medium, 1 low). This revision addresses all seven.
- Sibling evidence: `docs/plans/manage-authoritative-hub-session-types.md` (checks 11/13/14
  not executed at detach); `docs/plans/rename-workspaces-browser-driver-spawn-field.md`
  (this ticket correctly non-scoped there; `sharedHubDriverMode` returns before the wait).

Repository code inspected (r1 + r2):

- `package.json` — `npm test` vs `smoke:live-packaged-protocol*`.
- `scripts/live-packaged-protocol-harness.mjs` (~5201 lines) — detach helper still waits for
  `[data-terminal-session-id='none']`; call site after `shutdownProductionSession()`.
- Selector surface inventory (r2): roughly `getByTestId` 54, `getByText` 37, `getByRole` 23,
  `querySelector` 13, `getByLabel` 7, plus many `data-*` attribute strings. Static host
  `data-testid`s used by the harness include `dashboard-view`, `plugin-settings-route`,
  `terminal-session-view`, `selected-app-surface`, hub identity/settings testids, etc.
- `scripts/live-packaged-protocol-helpers.mjs` — already imported by `src/App.test.mjs:51`;
  the shared pure-function home for harness predicates.
- `src/App.tsx` — `releaseTerminalSession` → toast + `navigateToView("dashboard")`;
  settings Back text is `Back`; `data-testid="dashboard-view"`.
- `src/botster/TerminalViewHost.tsx` — `data-terminal-session-id={descriptor.sessionId}`,
  `data-terminal-attach-state`, `onExit` on `status.state === "exited"`.
- `src/App.test.mjs` — 79 `renderToStaticMarkup` sites; prior art at session-route render
  currently injects a stub terminal div (pattern, not the coupling we need); Hub General
  section already rendered for schema presentation contracts.
- Commit `9753297` removed the `none` placeholder.
- Live prerequisites on this host (Plan Review verified; re-checked at r2): release
  `botster-hub` and `botster-session-worker` binaries exist under the botster-hub release
  target; Playwright Chromium is cached. Only the env vars need setting for the live
  command — not a missing-binary situation.

## Product truth for the outstanding break

Production detach path after process exit:

1. `TerminalViewHost` receives attachment status `exited` and calls `onExit(sessionId)`.
2. `App.releaseTerminalSession` shows `Session ${sessionId} ended` and navigates to
   **dashboard**.
3. `routeSessionId` becomes `undefined` → `terminalPanel` is `null` → host unmounts.
4. There is **no** `data-terminal-session-id="none"` placeholder.

`waitForTerminalDetached` waiting for that placeholder is permanently false against current
DOM and times out after substantive terminal assertions already passed.

## Scope

### A. Fix the outstanding detach oracle (shared predicate)

1. Export a **pure DOM detach predicate** from
   `scripts/live-packaged-protocol-helpers.mjs` (existing shared module already imported by
   unit tests). Signature sketch (Implement may refine names):

   - Input: a document-like root (or HTML string + parse) and the expected `sessionId`.
   - Success when:
     - no `.terminal-view-container` still carries `data-terminal-session-id === sessionId`,
       and
     - `[data-testid="dashboard-view"]` is present (positive destination from
       `releaseTerminalSession`).
   - Failure diagnostics must be structured enough for live timeouts to report
     `lastObservedAttachState`, whether the session container was still present, and
     whether dashboard was present.

2. `waitForTerminalDetached(page, sessionId)` in the harness **must call that same
   predicate** via `page.waitForFunction` / `page.evaluate` — not a second copy of the
   selector string. One source of truth.

3. Do **not** reintroduce a product-only `none` placeholder to satisfy the harness.

4. Keep the call site after `shutdownProductionSession()`; pass `productionSessionId`
   explicitly.

5. **Discriminating exit observation (finding on load-bearing assumption):**
   After `shutdownProductionSession()`, the live path must observe evidence that the
   exit chain started, not only the final dashboard:

   - While waiting, record snapshots of `data-terminal-attach-state` on `.terminal-status`
     when present.
   - Success requires the detach predicate (dashboard + session host gone for that id).
   - On timeout, throw an error that includes at least:
     - whether `exited` was ever observed on `data-terminal-attach-state`,
     - last observed attach state,
     - whether the session terminal container remained,
     - whether dashboard was present.
   - This distinguishes **exit status never arrived** from **exit arrived but destination
     never rendered**. Green unit pins alone cannot make that discrimination.

### B. Audit — checkable procedure, not an unaided reading pass

Manual scroll of 5201 lines is how the drift accumulated. The audit is mechanical and
falsifiable.

#### B.1 Selector taxonomy (coverage model)

| Class | Examples | Unit-contractable? | Live-only? |
| --- | --- | --- | --- |
| **Host chrome (static)** | `data-testid` values, nav button names (`Apps`, `Home`, `Back`), `data-terminal-session-id` / `data-terminal-attach-state`, `data-diagnostic-id="schema-version"`, `plugin-settings-route`, `dashboard-view`, `terminal-session-view` | **Yes** — predicate against `renderToStaticMarkup` of the owning product component | Live still re-proves end-to-end |
| **Dynamic plugin trees** | `data-ui-node-id='…'`, Workspaces/contract matrix node ids, installed-package row text from live Hub | No without full Hub fixtures | **Yes** |
| **Protocol/event oracles** | `hub_frame`, `daemon_request`, WebRTC lifecycle kinds | No (not DOM chrome) | **Yes** |

The structural half of the ticket is about **host chrome** renames breaking the harness —
the class that already failed three times (Back, schema floor, schema presentation) plus
detach. Dynamic plugin ids and protocol events are not the env-gate chrome-drift class;
they remain live-proven.

#### B.2 Host-chrome contract inventory (by construction)

Implement adds a **named inventory** in `scripts/live-packaged-protocol-helpers.mjs`, e.g.
`HOST_CHROME_CONTRACTS` (name flexible), each entry:

| Field | Meaning |
| --- | --- |
| `id` | stable contract id |
| `harnessUse` | where the default live path depends on it |
| `render` | which product component/fixture produces the markup |
| `predicate` | pure function over markup/DOM — **the same function the harness uses when applicable** |
| `class` | always `host-chrome` for inventory members |

**Minimum inventory for this ticket (must ship):**

1. **terminal-mounted** — real `TerminalViewHost` (not a stub div) with a known session id
   renders `data-terminal-session-id="<id>"` and `data-terminal-attach-state`.
2. **terminal-detached** — markup representing post-release dashboard (dashboard testid
   present, no terminal container for that session id) satisfies the shared detach
   predicate; mounted terminal markup must **not**.
3. **settings-back** — `PluginSettingsRoutePage` (or equivalent export) renders a button
   whose accessible name is `Back`; harness close path uses that name.
4. **schema-presentation-neutral** — Hub General / diagnostic render includes
   `data-diagnostic-id="schema-version"` with neutral Info/server framing (not
   Blocked/mismatch); aligns with existing schema presentation intent.
5. **schema-floor-in-harness** — the live compatibility check remains a floor
   (`schema_version < 3`), not equality — still unit-pinned against the harness module
   text *only as a secondary pin*; the product diagnostic remains rendered-output based.

**Already-repaired oracles** stay in the inventory so they cannot regress silently.

#### B.3 Mechanical audit procedure (required implement output)

1. Extract static host-chrome tokens from
   `scripts/live-packaged-protocol-harness.mjs` used on the **default**
   `smoke:live-packaged-protocol` path (not every mode branch):
   - string args to `getByTestId`, exact `getByRole` names, exact `getByLabel` strings,
     static `querySelector` / attribute selectors for `data-testid`, `data-terminal-*`,
     `data-diagnostic-id`, and static nav button names.
2. For each extracted token:
   - If it is in `HOST_CHROME_CONTRACTS` → must have a green unit evaluation against
     rendered markup.
   - If it is dynamic plugin / protocol → classify `live-only` with one-line reason
     (e.g. `data-ui-node-id from Hub snapshot`).
   - If it is static host chrome **missing** from the inventory → **add it to the
     inventory or fix the harness** in this PR. No silent omissions.
3. Implementation report **must** include a table:

   `| token | class | inventory id or live-only reason | unit result |`

   A bare “audit complete” is not acceptance.

4. Scope B is therefore the same mechanism as Scope C — not a separate manual grep
   ritual. Finding stale selectors **falls out of** building and running the inventory
   against rendered markup.

### C. Structural prevention — rendered-output contracts, not source greps

**Rejected (r1):** “source-backed product DOM contracts” and absence-pins on the one
known-dead selector. That is the mechanism that already failed:
`assert.match(liveProtocolHarnessScript, /waitForTerminalDetached/)` is green today while
the helper waits for a selector no product file emits.

**Required (r2):**

1. Every anti-drift host-chrome contract **evaluates the harness’s own predicate** (or the
   inventory predicate the harness imports) against markup from
   `renderToStaticMarkup` of the **real** product component.
2. Export predicates from `scripts/live-packaged-protocol-helpers.mjs`; import them in
   `src/App.test.mjs` (existing pattern at line 51) **and** use them from the harness.
3. `source-backed` greps are allowed only as **secondary** pins (e.g. script wiring,
   package.json command strings), never as the sole anti-drift proof for a chrome oracle.
4. Absence of the old `none` selector may remain as a **negative regression pin** but is
   not the structural fix by itself.
5. Negative control ([[a regression test must be shown to go red with the fix reverted]]):
   - Restoring the `none` wait (or breaking the shared detach predicate so mounted markup
     still “passes”) must fail the unit contract that executes the predicate against
     rendered markup.
   - Ablating inventory entries for Back / schema presentation must fail their rendered
     contracts specifically ([[an ablation that reddens at the first assertion does not vouch for later ones]]).

This is **not** a harness page-object framework. It is a small shared pure-function module
plus a named inventory — the minimum that gives “covered by construction” for host chrome
without abstracting Playwright.

### D. Prove the runtime path — live is a hard gate

Live packaged proof is **required** for the detach half of this ticket. It is not optional
and is not satisfied by unit pins alone.

Hard acceptance command (binaries verified present on this host):

```bash
BOTSTER_HUB_BIN=<botster-hub release binary> \
BOTSTER_SESSION_WORKER_BIN=<botster-session-worker release binary> \
npm run smoke:live-packaged-protocol
```

- Do **not** pre-authorize skipping because “binaries might be missing.” On this host they
  are not; only env vars need to point at them.
- If the live run fails for a genuine environmental or upstream reason, stop and register
  an owner ticket / blocking dependency with exact evidence — do not land with unit-only
  success for the detach half.
- Expected live outcomes:
  - Exit 0.
  - Success log includes `live packaged protocol harness passed (webrtc)`.
  - Does **not** throw `timed out waiting for terminal detach placeholder` (or any new
    timeout that lacks the discriminating attach-state fields from Scope A).
  - Timeout errors, if any during development, must show whether `exited` was observed.

Also required:

```bash
npm test
npm run typecheck
```

Unit suite must execute the host-chrome inventory against rendered markup and prove the
shared detach predicate.

### E. Artifact durability (Plan Review blocker)

1. Commit `docs/plans/repair-live-protocol-harness-env-gate-drift.md` on the run branch
   (matches `docs/plans/` convention on `origin/main`).
2. Register it as a **plan-kind** Project Pipelines artifact via
   `project_pipelines_add_artifact` so `artifact.added` appears in run history and
   Plan Review’s artifact precondition can pass.

## Non-scope

- No product UX redesign of session release beyond fixing harness/oracle coupling.
- No reintroduction of a synthetic `none` placeholder as the preferred fix.
- No weakening/deletion of schema, Back, or presentation assertions.
- No Hub/Core/TUI/Workspaces code changes. TUI env-gate lesson
  (`ticket_1786038825_352271`) is parallel evidence only.
- No shared-Hub driver rewrite; that mode returns before the broken wait.
- No Project Pipelines package/plugin policy changes.
- No Playwright page-object framework or broad harness rewrite.
- No new GitHub Actions live CI job in this ticket (unit inventory is the cheap gate;
  live remains the named smoke hard-required for this run’s detach proof).
- No claim to unit-test dynamic `data-ui-node-id` plugin trees without Hub fixtures.

## Ownership boundaries and cross-repo dependencies

| Repository | `target_id` | Role | State |
| --- | --- | --- | --- |
| **botster-web** | `tgt_40abcf71ccf049f4ac0c99953a799869` | Harness, helpers, unit inventory, browser DOM chrome | **This run** |
| botster-hub | consumer only | Live binaries | Not changed; hard-required inputs |
| botster-tui | n/a | Parallel env-gate lesson | Not a dependency |

No new cross-repository dependency for the known detach break. If live fails for an
upstream missing surface, register a dependency then — not as a pre-emptive caveat.

## Botster layers touched

- Browser live packaged protocol harness + shared helpers.
- Default-suite unit tests (`src/App.test.mjs`).
- Product components only if inventory proves a true product DOM bug (not expected for
  detach).
- Plan artifact under `docs/plans/`.

## Worktree / target assumptions

- Implement and verify in this run’s assigned botster-web worktree
  ([[botster orchestration prompts must bind agents to explicit worktrees]]).
- Rebase onto `origin/main` if it advances before implement
  ([[stale project pipeline worktrees can miss merged dependency apis]]).
- **Same-target file contention (finding, low):** open ticket
  `ticket_1786039279_917823` (“Web: add the session-type edit control once Hub publishes
  a lossless authoring view”) is on the same `target_id` and is expected to touch
  `src/App.test.mjs` and possibly `scripts/live-packaged-protocol-harness.mjs`. Scope
  overlap is **contention, not inseparable ownership** — that ticket is blocked on Hub
  release `ticket_1786042460_231768`. This run still owns detach oracle + host-chrome
  inventory. Implement should rebase/restack if the sibling lands first; do not absorb
  the edit-control feature into this ticket.

## Assumptions and unknowns

**Assumptions**

- Detach destination remains dashboard navigation + terminal host unmount.
- `shutdownProductionSession()` under live WebRTC still drives attachment status to
  `exited` and thus `onExit` — **now treated as a checked claim** via discriminating live
  timeout diagnostics (Scope A), not a silent assumption.
- Host-chrome inventory is the right structural floor; dynamic plugin trees stay live-only.
- Live binaries and Playwright Chromium are available on this host when env vars are set.

**Unknowns**

- How briefly `data-terminal-attach-state="exited"` remains mounted before navigation
  unmounts the host; implementation may need snapshot polling rather than a long-lived
  exited node. Timeout diagnostics still must record whether exited was seen.
- Exact final list of default-path host-chrome tokens after extraction — the inventory
  grows to cover them in this PR; that list is an implement deliverable, not a plan-time
  freeze of all 182 call sites.

## Affected surfaces / files

| Path | Expected change |
| --- | --- |
| `scripts/live-packaged-protocol-helpers.mjs` | Export shared detach predicate + host-chrome inventory / pure predicates |
| `scripts/live-packaged-protocol-harness.mjs` | Use shared detach predicate; discriminating wait diagnostics; any inventory-driven chrome fixes |
| `src/App.test.mjs` | Import predicates; `renderToStaticMarkup` contracts for inventory (real `TerminalViewHost`, settings Back, schema diagnostic, detach true/false pairs) |
| `src/App.tsx` / `src/botster/TerminalViewHost.tsx` | Only if inventory proves product bug |
| `docs/plans/repair-live-protocol-harness-env-gate-drift.md` | This plan (committed + registered) |
| `README.md` | Optional; skip unless live env invocation docs are wrong |

## Implementation sequence

1. Commit/register plan artifact durability (Plan step).
2. Add shared detach predicate + minimum inventory entries in helpers (tests fail first
   where the harness still uses `none`).
3. Point harness `waitForTerminalDetached` at the shared predicate; add exit-discrimination
   diagnostics.
4. Add rendered-output unit contracts for the inventory (real components).
5. Run mechanical extraction of default-path host-chrome tokens; extend inventory or fix
   harness until the report table has no silent static gaps.
6. `npm test` + `npm run typecheck`.
7. Hard live gate: `smoke:live-packaged-protocol` with release Hub/worker env vars.
8. Attach implement evidence: inventory table, unit results, live success log, ablation
   notes.

## Risks

| Risk | Mitigation |
| --- | --- |
| Vacuous detach wait | Shared predicate requires dashboard + absence of session host; call site still mounts first |
| Exit never emitted | Timeout diagnostics must report whether `exited` was observed |
| Unit green / live hang | Live is hard gate for detach half |
| Inventory under-coverage | Mechanical extraction + “static host chrome must join inventory” rule |
| Overbuilding a page-object layer | Pure functions + named inventory only |
| Sibling edit-control contention | Documented; rebase if needed; do not absorb feature |
| Weakening schema/Back | Forbidden; inventory keeps them green |

## Acceptance checks / tests

### Unit / typecheck (required)

```bash
npm test
npm run typecheck
```

Must show:

- Shared detach predicate rejects mounted terminal markup and accepts post-release
  dashboard markup.
- Real `TerminalViewHost` render includes session id + attach-state attributes.
- Settings Back + schema presentation contracts green via rendered markup.
- Harness imports/uses the shared detach predicate (not a private `none` wait).
- Inventory table items each have an executing unit evaluation.

### Live (required hard gate for detach half)

```bash
BOTSTER_HUB_BIN=<release botster-hub> \
BOTSTER_SESSION_WORKER_BIN=<release botster-session-worker> \
npm run smoke:live-packaged-protocol
```

Must show:

- Exit 0 and `live packaged protocol harness passed (webrtc)`.
- No detach-placeholder timeout.
- Unblocks the post-detach class of checks previously recorded as not executed.

### Discriminating failure shape (required design)

A forced timeout or a broken exit path must surface whether `exited` was observed — not a
single opaque “detach failed” string that collapses both failure modes.

### Negative controls

- Restore `none` wait → unit inventory/detach contract fails.
- Break Back or schema presentation product chrome → corresponding inventory contract fails.

### Charter gates ([[botster-web-playbook]])

- Real components and routes for host-chrome contracts; live smoke for full packaged path.
- No new browser-only protocol meaning.
- Structured failure evidence on timeouts.

## Pipeline gates and artifacts

- Plan artifact path: `docs/plans/repair-live-protocol-harness-env-gate-drift.md`
- Must be **git-committed** and **registered** as plan-kind via
  `project_pipelines_add_artifact`
- Plan gate: `botster_stack_plan_gate`
- Implement (later): inventory table, unit evidence, live evidence with env vars set,
  production entrypoint explanation
  (`TerminalViewHost` exited → `releaseTerminalSession` → dashboard → shared predicate)

## Vault gaps worth capturing

After implement, capture only if still novel:

1. **Env-gated live harnesses need shared predicates evaluated against rendered host chrome
   under the default suite** — not source greps of harness text.
2. **Terminal detach after exit is unmount + dashboard, not a `none` placeholder.**
3. Skip speculative CI policy until an in-repo CI surface exists.

## Product decision ledger

| Item | Decision |
| --- | --- |
| Structural anti-drift | Shared pure predicates + host-chrome inventory evaluated on `renderToStaticMarkup` |
| Source greps alone | Rejected as anti-drift mechanism |
| Coverage claim | All default-path **static host chrome**; dynamic plugin/protocol remain live-only with explicit classification |
| Live smoke for detach | **Hard required** with release Hub/worker env |
| Pre-authorized live skip | **Removed** |
| Product `none` placeholder | Non-goal |
| Assertion weakening | Forbidden |
| Full page-object framework | Non-goal |
| New CI live job | Non-goal this ticket |
| Sibling edit-control ticket | Contention noted; not absorbed |

---

## Plan Review response

Review: `review_1786060819_237168` — **changes_required**. All findings accepted.

| Finding | Severity | Response in r2 |
| --- | --- | --- |
| No registered plan artifact; untracked file | blocker | Commit plan on run branch; `project_pipelines_add_artifact` plan-kind registration |
| Structural anti-drift uses source greps | high | Scope C rewritten: shared predicates from helpers evaluated against real component markup; source greps secondary only |
| Absence-pins cannot catch next rename | high | Host-chrome inventory by construction; mechanical extraction forces static tokens into inventory or live-only classification with reason |
| Scope B audit has no method | high | Audit = inventory + extraction procedure + required per-token report table |
| Live proof pre-authorized skippable | medium | Live hard gate; skip caveat removed; env vars point at verified release binaries |
| Load-bearing exited assumption unchecked | medium | Discriminating wait diagnostics: must report whether `exited` was observed |
| Same-target sibling file contention | low | Documented `ticket_1786039279_917823` contention on `App.test.mjs` / harness; no inseparable overlap |
