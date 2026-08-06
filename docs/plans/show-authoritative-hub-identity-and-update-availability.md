# Show authoritative Hub identity and update availability

## Target and context loaded

- Target repository: `botster-web` (`trybotster/botster-web`).
- Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Pipeline ticket: `ticket_1785970234_234515`; run `run_1786031355_921193`;
  run step `run_step_1786031355_272130`.
- The target was resolved from the admitted Botster spawn-target registry, not
  from the ambient working directory. The registry display name is misspelled
  `booster-web`, but its `repo_name` is `trybotster/botster-web` and its path is
  `/Users/jasonconigliari/Projects/botster-web`. The assigned run worktree
  `botster-sessions/git@github.com:trybotster-botster-web-project-pipelines-ticket_1785970234_234515`
  is the only edit location; the target's ambient checkout must not be edited.
- Repository playbook loaded: [[botster-web-playbook]].
- Role guidance loaded in order: [[planner-playbook]], then
  [[botster-planner-playbook]], then [[botster-web-playbook]].
- Botster architecture and surface guidance loaded: [[botster-architecture]],
  [[cli-patterns]], [[spa-patterns]],
  [[project pipeline orchestration belongs in a device-level botster plugin]],
  [[project pipelines needs an operator workbench not more primitives]],
  [[project pipelines ui contract belongs in the plugin readme]],
  [[botster orchestration should spawn agents with explicit target ids]],
  [[botster orchestration prompts must bind agents to explicit worktrees]].
- Repository charter required notes loaded:
  [[botster web uses vanilla ionic primitives by default]],
  [[botster web dto field names must match authoritative rust serde structs]],
  [[botster web adapts hub validated snapshot grammar only on ui tree path]],
  [[botster web plugin app routes are stable host routes]],
  [[botster web request caches belong in react query not zustand or hub session getters]],
  [[botster toolbar actions use declaration order plus fixed overflow intent]],
  [[ui presentation operations are authored by accepted action results]],
  [[botster-web ionic supersedes catalyst for client shell]].
- Targeted atomic notes loaded for this ticket:
  [[botster package daemon dto exposes sanitized package rows]] (package rows
  are a sanitized projection and are not the Hub identity surface),
  [[hub support metadata can force a web ui contract cold update]] (support pin
  and UI-contract pin move together as one cold update),
  [[cold turkey migrations eliminate dual code paths and version suffixes]],
  [[prefer framework and library components over custom solutions]],
  [[vault example paths are not repository placement conventions]].
- [[project-pipelines-playbook]] loaded. Corrected after Plan Review
  `finding_1786033050_924243`: the initial plan excluded it on the grounds that
  no Project Pipelines package or plugin path is in scope. That reasoning was
  wrong — the charter covers **workflow policy**, not only package paths, and
  this run's sequencing turns on cross-run dependency activation. The clauses
  that bind here are
  [[plan review must verify unmerged unregistered ticket dependencies]] (the
  current planning-stage dependency rule),
  [[plan review must reverify the declared base at review time]] and
  [[plan review must fetch before trusting remote tracking refs in run worktrees]]
  (the stale-base correction below),
  [[plan review must check open sibling tickets that own part of the plan scope]]
  (the same-target scope overlap this plan partitions into buckets), and
  [[project pipelines mcp create calls can time out after committing]] (the
  vault-checklist create for this run returned a worker timeout after
  committing, and was resolved by an owner-scoped read rather than a retry).
- **Deliberately not loaded as binding:**
  [[project pipeline step activation gates open ticket dependencies before side effects]].
  Revision 2 cited it as a current runtime contract. That was wrong and is
  corrected here per Plan Review `finding_1786033763_396233`: the note is
  `type: drift`, `status: superseded`, superseded by
  [[vault convention notes can document unimplemented behavior as shipped]], and
  states in its own body that its claims "must not be loaded as a current
  runtime contract." Citing it was precisely the failure mode that note exists to
  record — treating a convention-shaped note as implementation proof. I should
  have checked its frontmatter status when loading it. The current planning-stage
  rule is [[plan review must verify unmerged unregistered ticket dependencies]],
  which explicitly does not imply that runtime activation gating exists.
- Plan destination `docs/plans/` was chosen from mainline prior art in this
  repository (54 existing plans, most recently
  `docs/plans/stop-treating-hub-persistence-schema-as-client-compatibility.md`
  landed in `79a1608`), not from a generic vault example path.

## Base ref correction (blocking for Implement)

The run declares `base_ref: main`, but the run worktree and the concurrent Web
run worktree are both checked out at `713233f`, while `origin/main` has advanced
to `9753297` ("Improve hub navigation and session UX"). The merge base of this
branch and `origin/main` equals this branch's HEAD, so `713233f` is strictly
behind.

**This run is not implementable against `713233f`.** Commit `9753297` is the
commit that introduced the surface this ticket says to "finish":

- `App.tsx` `AppView` gained `"hub-settings"` at stable host route `/settings`.
- `hubSettingsSections` gained
  `{ id: "general", label: "General", description: "Hub identity and software" }`.
- `/diagnostics` now redirects into the `support` section.

Implement must rebase this branch onto `origin/main` `9753297` before making any
change, and Plan Review must re-fetch and renew that comparison before approval.
Every file, line number, and typecheck result below is stated against `9753297`.

## The defect, as it exists on `origin/main`

The ticket's core prohibition is already violated in shipped code:

- `src/App.tsx:1410` derives the Hub row from the installed package registry:
  `installedPackageRows.find((appPackage) => … === "botster-hub")`.
- `src/App.tsx:1951` renders
  `<dt>Hub version</dt><dd>{stringValue(hubPackage.version, "Unknown")}</dd>` —
  **Hub version derived from a package row.**
- `src/App.tsx:1411` binds "Check for updates" to that package row's
  `check_package_update` daemon request — a package update API standing in for a
  Hub binary update.
- `src/App.tsx:1953-1954` render protocol version and state schema through
  `stringValue(…, "unknown")`, so any hydration gap is user-visible as `unknown`.
- No product name, build revision, installation mode, provenance, release
  channel, or update outcome is displayed at all.

This is precisely what [[botster package daemon dto exposes sanitized package rows]]
warns against: `DaemonPackage` is a sanitized client projection, not the
authoritative identity surface for the Hub itself.

## Authoritative contract (verified, not assumed)

`@trybotster/hub-test-support@0.1.24` was fetched from the registry and verified
in this run:

- Tarball integrity computes to
  `sha512-n0/DDMw5PmnFdxp54dk4Y4pdAM0VfotQblBnamqkViwbmJgmSS7ZrAFPskzOcVZ70hHgJdfHaH4UwArwP0DvXw==`,
  matching the coordinate published by `ticket_1785971560_802153`.
- `metadata.json` declares `protocol_version: 6`,
  `conformance_fixture_revision: 31`, and `ui_contract.package_version: 0.3.1`.
- Web's direct `@trybotster/ui-contract` pin is already `0.3.1`, so the metadata
  equality invariant in
  [[hub support metadata can force a web ui contract cold update]] is satisfied
  and **no UI-contract cold update is forced by this bump.**

The contract Web must consume:

```ts
DaemonStatus.software: DaemonSoftwareIdentity      // now required
DaemonStatus.installation: DaemonInstallationIdentity  // now required

DaemonSoftwareIdentity { product_id, product_name, version, build_revision? }
DaemonInstallationMode = "development" | "unmanaged" | "managed"
DaemonInstallationIdentity { mode, provenance, release_channel?, provider?, diagnostics? }

DaemonRequest  | { type: "check_hub_update" }
DaemonResponse.hub_update?: DaemonHubUpdate | null   // response kind "hub_update"
DaemonHubUpdateState = "current" | "available" | "unavailable"
DaemonHubUpdate { state, current_version, available_version?, build_revision?, reason?, action? }
```

`DaemonPackageCompatibility.hub_version` **was removed** by the Hub. That removal
is the contract-level enforcement of this ticket's prohibition.

Note for the Implement agent: `DaemonHubUpdate` has exactly three states. There
is no `error` or `offline` state. Offline and error are *transport and operator
failures of the request*, not update states, and must be rendered from the
rejected action result / operator error path — never synthesized into a fourth
`DaemonHubUpdateState`.

## Cross-run collision (escalated, resolved as option A)

A second run is active in this same repository right now:
`run_1786031348_611758`, `ticket_1785970233_750553`, "Web: manage authoritative
Hub session types". It owns the session-types management surface.

`npm test` runs `scripts/check-daemon-protocol-drift.mjs`, which **byte-compares**
`src/botster/generated/daemon-protocol.ts` against the installed
`@trybotster/hub-test-support` artifact. A partial protocol bump is therefore
impossible: it is all-or-nothing, and both runs need it.

I applied the 0.1.24 artifact to a throwaway worktree at `origin/main` and ran
`npm run typecheck`. Exactly 14 errors, partitioning into three buckets:

| Bucket | Owner | Errors | Sites |
| --- | --- | --- | --- |
| A | **This ticket** | 1 | `src/botster/__fixtures__/generatedDaemonProtocol.ts:279` — `hub_version` no longer exists on `DaemonPackageCompatibility` |
| B | `ticket_1785970233_750553` | 6 | `hubTransport.ts` 27, 142, 246 (×2), 253, 1100 — `DaemonSessionTemplate`→`DaemonSessionType`, `list_session_templates`→`list_session_types`, `session_templates`→`session_types`, `spawn_session_template`→`spawn_session_type` |
| C | **Neither ticket** | 7 | `hubTransport.ts` 369-378, `webrtcDaemonClient.ts` 850, 855 — protocol 6 adds `DaemonEntityFrame` variant `entity_error { subscription_id, entity_type, code, message }`, which has no `id`/`patch`/`snapshot_seq` and breaks existing union narrowing |

> ⚠️ **Everything from here to the end of this section is HISTORICAL.** Option
> (A) assigned the bump to this run; that assignment was later superseded when
> the sibling landed the bump itself. See "The A/B/C bucket partition is
> SUPERSEDED" below for what is actually in force. This record is kept because
> the analysis is what made the collision decidable, not because it still
> assigns work.

**Resolved at the time: option (A).** Orchestrator answered
`question_1786031902_463107` with an explicit decision. This run owns the bump
and lands it in one PR: the support pin, the byte-exact re-vendor, bucket A,
bucket C, bucket B as a purely mechanical rename, and the documentation
coordinate lines. It does not touch the session-types UI, CRUD, provenance model,
entity family, or the `session-types` settings section — all of that stays with
`ticket_1785970233_750553`.

Rationale recorded by the orchestrator: the bump is not incidental to this
ticket, it *is* its subject matter — `hub_version` leaving
`DaemonPackageCompatibility` is precisely the defect this ticket was filed to
fix. Option (C) would buy a cleaner boundary at the cost of an extra full run
cycle while blocking both feature runs; option (B) would serialize this smaller
ticket behind a materially larger one and still leave bucket C unowned.

### Sequencing: concurrent by explicit decision, ordering is orchestrator-managed

**Both `botster-web` runs proceed concurrently. This is Jason's explicit
decision, not an accident to be prevented.** Recorded in the authoritative answer
to `question_1786034136_524714`.

- `dependency_1786032120_366099` **has been removed**.
  `ticket_1785970233_750553` no longer depends on this ticket. Do not treat it as
  a current prerequisite.
- **Whoever merges second resolves the conflict.** This is accepted up front.
- Ordering between tickets in this environment is maintained by **orchestrator
  instruction only**. If a plan needs another ticket to land first, it must say so
  explicitly and expect a human or the orchestrator to sequence it — never an
  engine.

**Correction to revisions 2 and 3.** Those revisions described the Project
Pipelines dependency gate `8990969` as enforcing here, and revision 3 recorded a
"gate regression" when the sibling activated Implement. That framing was wrong
and is withdrawn in full:

- There is **no dependency gate running in this environment and there never was
  one**. This Hub executes a legacy plugin; the standalone package from
  `botster-project-pipelines` PR #15 targets the new Hub, which is not in service,
  is intentionally not installed here, and is not pending a cutover.
- Registered dependency edges here are **advisory records, not enforcement** —
  unconditionally, not "until something is fixed".
- The sibling activating Implement was therefore **not a regression, not a bug,
  and not an incident**. It is how this environment has always behaved.

The underlying observation reported at `1786033884` was factually accurate and
well-evidenced; the interpretation placed on it was not. Nothing downstream of
this plan should carry forward any expectation that a gate "should have held".

### The A/B/C bucket partition is SUPERSEDED — the bump is the sibling's to land

The bucket partition above is retained as the record of how the collision was
analysed, but **it no longer assigns work.** The sibling run
`run_1786031348_611758` hit a hard block — its entire ticket consumes protocol-6
types that do not exist at the old coordinate, so every one of its acceptance
checks was unreachable — and under Jason's concurrent-execution decision it
landed the bump itself rather than idle indefinitely behind a run that at the
time had only plan commits and no pushed branch.

**The rule that replaces buckets:** anything *mechanically forced* by the bump,
whose correct value is read off the artifact's `metadata.json`, belongs to
whoever is unblocking on it — there is exactly one right answer, both runs would
produce it identically, and no divergent state is possible. Anything requiring
**judgement about Hub identity or maintenance semantics is this run's.**

**Landed by the sibling — do not redo, revert, re-vendor, or re-apply:**

| Item | Was |
| --- | --- |
| `package.json` / `package-lock.json` | `0.1.21` → `0.1.24` |
| `src/botster/generated/daemon-protocol.ts` | byte-copied via `readDaemonProtocolTypescript()`; drift check passes at sha256 `c5cc9413` |
| `src/botster/__fixtures__/generatedDaemonProtocol.ts:279` | `hub_version` line deleted (was bucket A) |
| `src/botster/webrtcDaemonClient.ts` | `entity_error` handled before the delta path |
| `src/botster/hubTransport.ts` | session-type renames and the `entity_error` projection (was buckets B and C) |
| `src/App.test.mjs:1373-1374` | `4` → `6`, `28` → `31` |
| `README.md:11`, `docs/architecture.md:53-54` | `revision-31`, `@trybotster/hub-test-support@0.1.24` |

If any of it is found **wrong**, that is a **finding to raise, not something to
silently fix.**

**Correction worth carrying forward: bucket C was never type-level.** The earlier
instruction to fix `webrtcDaemonClient.ts` with union narrowing was wrong, and
following it would have shipped a bug that still typechecked.
`receiveEntityFrame` returns early for `entity_snapshot` and falls everything
else through to the delta path, where `frame.snapshot_seq !== currentSequence + 1`
evaluates `undefined !== N+1` for an `entity_error` frame and fires
`resubscribeEntity` with `sequence_gap`. A cast or an `in` guard satisfies `tsc`
and still ships a resubscribe loop. The type error and the behavioural
requirement were the same line, and that behaviour belongs to the session-types
ticket. It is handled there.

### Verified state of the prerequisite (checked at revision 5)

Stated precisely, because this plan now depends on it:

- `origin/main` is still `9753297`. **The sibling's work is not merged.**
- The sibling's branch has three commits, and `git diff --stat 9753297..HEAD`
  shows they touch **only** `docs/plans/manage-authoritative-hub-session-types.md`.
- The bump therefore exists **only as uncommitted working-tree modifications** in
  the sibling's worktree: `package.json`, `package-lock.json`, `src/App.tsx`,
  `src/App.test.mjs`, `src/botster/generated/daemon-protocol.ts`,
  `src/botster/__fixtures__/generatedDaemonProtocol.ts`,
  `src/botster/hubTransport.ts`, `src/botster/protocol.ts`,
  `src/botster/webrtcDaemonClient.ts`, `README.md`, `docs/architecture.md`.
- Spot-checked and confirmed correct in that worktree: pin at `0.1.24`, zero
  `hub_version` occurrences in the fixture, `App.test.mjs:1373-1374` at `6`/`31`,
  `revision-31` and `@0.1.24` in both documents, and `check_hub_update` present in
  the vendored protocol.

**Consequence for Implement.** There is nothing to rebase onto yet. Do not begin
on the assumption that the prerequisite is in the tree — confirm the sibling's
work is committed and merged first, then rebase onto it. If this run reaches
Implement while that work is still uncommitted, say so and stop rather than
re-applying the bump, which would create exactly the divergent state the
single-owner rule exists to prevent.

### Revision 6 (Implement): revision 5's supersession is WITHDRAWN — this run lands the bump

Revision 5's central premise was factually wrong and its instruction to Implement
has been overridden. Recorded here because the plan is the durable contract.

**What was wrong.** Revision 5 and the accompanying orchestrator message said the
sibling "landed" the protocol-6 bump and that the pin, re-vendor, `hub_version`
deletion, `entity_error` handling, session-type renames,
`src/App.test.mjs:1373-1374`, and the two documentation coordinate lines were
therefore prerequisites this run must not re-apply. "Landed" was used to mean
"done in its own worktree." It does not mean merged, and the difference is the
one that mattered.

**Evidence gathered at Implement, before editing:**

- `git rev-parse origin/main` after `git fetch` → `9753297`, unchanged.
- `git show origin/main:package.json` → `"@trybotster/hub-test-support": "0.1.21"`.
- `git show origin/main:src/botster/generated/daemon-protocol.ts | grep -c
  "check_hub_update\|entity_error"` → `0`. Main still vendors protocol 4.
- `git ls-remote --heads origin` → five branches, none for
  `ticket_1785970233_750553`. The sibling branch is not pushed.

**Consequence.** Following revision 5 would have produced a branch that does not
compile: `DaemonStatus.software`, `DaemonStatus.installation`,
`DaemonRequest::check_hub_update`, and `DaemonResponse.hub_update` do not exist at
protocol 4, so this ticket's entire subject would have had no types to build on.
There is no identity-only deliverable against `9753297`.

**Authoritative resolution** — `question_1786037342_380989`, answered by the
orchestrator after independently verifying every point above: **option (A), keep
the bump, revert nothing.** Approved plan revision 4 governs, and the A/B/C bucket
ownership table in it is restored as this run's work. The duplicate bump is an
accepted cost of Jason's concurrent-execution decision, and it is the cheapest
possible conflict: both branches byte-copy `daemon-protocol.ts` from the same
immutable published artifact, so that file resolves identically from either side,
and both resolve `package.json`/`package-lock.json` to `0.1.24`.

**Revision 5's bucket-C correction is retained and independently confirmed.** It
was right that the fix was never type-level. `entity_error` is handled by an early
return in `receiveEntityFrame` placed *before* the delta path
(`src/botster/webrtcDaemonClient.ts` 833-844), so `snapshot_seq` is never compared
and `resubscribeEntity` never fires. Proven behaviourally, not by typecheck: a live
`entity_error` frame is delivered to the listener, the channel sends no
unsubscribe/resubscribe traffic, and a following in-sequence delta still applies.

### Revision 6: additions to the affected-files promise

Three files are touched that revision 4's table did not list:

| File | Why |
| --- | --- |
| `src/theme/app.css` | The ticket requires state schema be *secondary* to software status. DOM order alone does not make it visibly secondary, and `.hub-metadata-secondary` had no rule. |
| `src/botster/entities.ts` | Comment only. Records that `replayActivePulls()` has no production caller so a future reader does not assume registered pulls are replayed. |
| `scripts/live-packaged-protocol-harness.mjs` | Listed in revision 4, but additionally carries a one-line repair of a **pre-existing** failure (below). |

### Revision 6: resolved unknown 4 — observed live update-check values

Revision 4 assumption 4 left the development-checkout `reason`/`action` strings
unknown, to be observed rather than invented. Observed against the live Hub built
from `botster-hub` `8a60bd5`:

```json
{ "state": "unavailable", "current_version": "0.1.0",
  "reason": "development_checkout", "action": "manual" }
```

Rendered verbatim as `Updates unavailable — development_checkout` with
`data-hub-update-state="unavailable"` and the action shown as `manual`. Note this
means the development-checkout path exercises `unavailable`, not `current`.

### Revision 6: pre-existing live-harness failures, classified

`npm run smoke:live-packaged-protocol` has three independent failures on
`origin/main` `9753297`. All three were isolated by running the identical command
on a base worktree at `9753297`.

| # | Failure | Classification |
| --- | --- | --- |
| 1 | `assertCurrentHubCompatibilityAndSchema`: `schema_version !== 2` against live schema 3 | **In scope, fixed.** Changed to a floor (`< 3`) rather than pinned to 3, so the next Hub schema bump does not relocate the same failure. Protocol and conformance floors moved to 6 and 31. |
| 2 | `closePackageSettingsRoute`: clicks `{ name: "Apps" }` but `9753297` relabelled that control to `Back` | **Pre-existing, repaired to unblock.** One line. This ticket's required reconnect proof runs after it, so it could not be reached otherwise. |
| 3 | `waitForTerminalDetached`: `[data-terminal-session-id='none']` never appears | **Pre-existing, NOT fixed.** Terminal-lifecycle, unrelated to Hub identity or updates. Base exit 1 and branch exit 1 with an identical message from the same helper. |

Base-vs-branch evidence for #3: on base, failures 1 and 2 were patched away in the
throwaway worktree purely to let execution reach #3; it then failed identically.
This run's identity and update assertions were therefore moved *ahead* of the
terminal shutdown/detach steps so the ticket's evidence executes rather than
sitting behind an unrelated break.

### Revision 6: the replayActivePulls decision, made explicitly

`EntityFrameStore.replayActivePulls()` has no production caller. Registering
`botster-web.hub_status` as an active pull therefore makes it replay-*eligible*
while nothing replays it generically. Both this run's Plan agent and the
orchestrator asked for an explicit decision rather than leaving the two mechanisms
implicitly redundant.

**Decision: reconnect hydration stays listener-driven per family.** Widening it to
a generic replay of every registered family would change reconnect behaviour for
surfaces this ticket does not own, including the sibling's session-types surface,
and is out of scope. Made unambiguous three ways: the mechanism is a named,
exported, unit-tested function (`replayHubStatusOnLifecycleEvent`) rather than an
inline arrow; its doc comment states it is the *sole* mechanism and that removing
it would silently reintroduce the regression; and `replayActivePulls()` carries a
comment saying it has no production caller.

### This run's subject, undiminished

Nothing has been taken from this ticket. This run still owns, and these all
require judgement rather than a value read off metadata:

- Hub **product / build / install identity** rendered from
  `DaemonStatus.software`, and **never** from an installed package row.
- **Host identity.**
- **Compatibility** protocol / version / conformance / features display.
- **State schema**, kept secondary to user-facing software status.
- **Check for updates** wired to the Hub self-update check action.
- Rendering **current, available, unavailable/manual, offline, and error**
  outcomes using Hub-provided `reason`/`action` metadata.
- Protocol and schema values already emitted by `DaemonStatus` **never regressing
  to `unknown` after connect or reconnect**, proven across WebRTC reconnect
  replay.

Confirmed still present and untouched in the sibling's worktree, so the defect
this ticket exists to fix is genuinely still this run's to fix: `hubPackage` at
`App.tsx:1681`, the package-row-derived `Hub version` row at `:2222`, and the
`check_package_update` binding at `:1682`. Line numbers have shifted from the
`9753297` values cited earlier in this plan (`1410`/`1951`/`1411`) because of the
sibling's edits — **anchor on the symbols, not the line numbers.**

`DaemonCompatibilityRequirement.minimum_protocol_version` → `protocol_version`
remains this run's **only if it needs behavioural handling in this surface.** The
sibling explicitly disclaimed it and reports typecheck clean without touching it.

### Deviation reporting (orchestrator constraint)

The buckets are no longer this run's deviations, so the earlier bucket-B/C
wording does not apply. The standing requirement remains: the implementation
report must **not** say `deviations_from_plan: None` — a previous run in this
project shipped that line while silently narrowing a public descriptor, and
Review caught it. Any deviation actually taken must be named with its reason.

## Scope

**Prerequisite, not scope (landed by the sibling):** the support pin, the
byte-exact `daemon-protocol.ts` re-vendor, the `hub_version` fixture deletion,
the `entity_error` handling in `webrtcDaemonClient.ts` and `hubTransport.ts`, the
session-type renames, `App.test.mjs:1373-1374`, and the README/architecture
coordinate lines. Do not redo any of it. See the superseded-buckets section
above, including the verification that it is **not yet committed or merged**.

1. **Stop deriving Hub identity from a package row.** Delete the
   `hubPackage`-derived "Hub version" row and the `hubPackage`-derived
   `hubUpdateAction` from `src/App.tsx` — currently `hubPackage` at `:1681`,
   the version row at `:2222`, the `check_package_update` binding at `:1682` in
   the sibling's tree; **anchor on the symbols, not the line numbers.** Cold cut,
   no fallback to the package row, per
   [[cold turkey migrations eliminate dual code paths and version suffixes]].
   The fixture-level `hub_version` deletion is already done; this is the
   user-visible half, which is the part this ticket was actually filed for.
3. **Project software and installation identity into the hub status record.**
   Extend `statusRecord()` in `src/botster/hubTransport.ts` (`9753297` line 384)
   to carry `status.software` and `status.installation` alongside the existing
   `host_id`, `schema_version`, `compatibility`, and `state_source` facts.
   This is the single projection point for the `botster-web.hub_status` family.
4. **Render authoritative identity in the General section** (`src/App.tsx`
   `hub-settings` / `general`, `data-testid="hub-settings-general"`), reading
   from `runtimeClient.entities.get("botster-web.hub_status", "local-hub")`:
   product name and version, build revision when present, installation mode and
   provenance, release channel and provider when present, host display name and
   host id, and protocol identifier/version/conformance/features. Keep state
   schema present but visually secondary to user-facing software status, as the
   ticket requires.
5. **Wire "Check for updates" to the Hub self-update action.** Add a
   `botster.hub.check_update` branch to `dispatchDaemonAction()` in
   `hubTransport.ts` that issues `{ type: "check_hub_update" }` and emits an
   action result carrying `hub_update` plus response diagnostics — modelled on
   the existing `botster.spawn_target.daemon_request` branch (`9753297`
   lines 1069-1086). Render `current`, `available`, and `unavailable` from the
   Hub-provided `state`, `current_version`, `available_version`, `reason`, and
   `action`. Render offline and error from the rejected action result and
   operator-error path. Per
   [[ui presentation operations are authored by accepted action results]], the
   outcome must come from the accepted action result, not from client inference.
6. **Close the reconnect hydration gap.** Register
   `botster-web.hub_status` as an explicit production pull in the `App.tsx`
   connect chain, alongside the existing `pullProductionEntity(…)` calls, so it
   becomes an entry in `InMemoryEntityFrameStore.activePulls` and is therefore
   replay-eligible. Re-pull hub status on WebRTC reconnect by extending the
   `webRtcDaemonLifecycleEventName` window listener that already exists in
   `App.tsx` (`9753297` lines ~851-857) for diagnostics. Today `hub_status`
   arrives only as a side effect of `hubTransport.connect()` issuing
   `{ type: "status" }` once at mount; `entities.replayActivePulls()` has **no
   production caller at all**, and the WebRTC layer's
   `reconnectEntitySubscriptions()` re-subscribes Hub entity subscriptions only.
   That is the concrete mechanism by which protocol and schema can regress to
   `unknown`.
7. **Add `software` and `installation` to the inline `DaemonStatus` fixtures** in
   `src/App.test.mjs` (the `production-host` regions), so the identity rendering
   above is exercised. The protocol/conformance constants at `:1373-1374` and the
   README/architecture coordinate lines are **already landed by the sibling** —
   do not touch them.
8. **Handle `DaemonCompatibilityRequirement.minimum_protocol_version` →
   `protocol_version` only if it needs behavioural handling in this surface.**
   The sibling disclaimed it and reports typecheck clean without touching it, and
   no Web code constructs a `DaemonCompatibilityRequirement`. If nothing in the
   General/Maintenance surface reads it, take no action and say so.

**Explicitly unchanged** (orchestrator constraint): the compatibility floor in
`src/botster/connectionDiagnostics.ts` — `minimumDaemonProtocolVersion` stays
`1`, `minimumConformanceFixtureRevision` stays `14`, and `requiredDaemonFeatures`
is untouched. Commit `2246678` made these deliberately permissive; raising a
global compatibility floor is in neither ticket. Capability checks stay
surface-local and Hub-sourced.

## Non-scope

- The session-types management feature: list, detail, create, edit, delete,
  override, provenance, editability, target eligibility, and the `session-types`
  settings section. Owned by `ticket_1785970233_750553`.
- Applying or installing a Hub update. The Hub contract exposes a *check* only;
  the managed installer is `ticket_1785970573_178886` in `botster-hub`.
- Any direct GitHub or registry call from Web, and any client-owned release
  policy, channel selection, or update cadence. Web renders Hub-provided
  `reason`/`action` verbatim.
- Hub-side identity, provenance, or update-check logic. Merged and closed under
  `ticket_1785970233_522967`.
- Broad refactors of `App.tsx`, the entity store, or the WebRTC client beyond
  the minimum in items 6 and 7.
- Restoring a `hub_version` compatibility field anywhere.

## Repository ownership boundaries and cross-repo dependencies

- `botster-web` owns only the browser projection: DTO consumption, the
  `botster-web.hub_status` entity projection, the General/Maintenance rendering,
  and the action dispatch that issues `check_hub_update`.
- `botster-hub` owns software identity, installation provenance, release policy,
  and the update-check result. Both Hub dependencies are **closed**:
  `ticket_1785970233_522967` (contract) and `ticket_1785971560_802153`
  (published coordinate). No new cross-repository dependency is required.
- `botster-hub-client` owns the generated TypeScript. Web vendors it byte-exact
  and never edits it.
- Cross-run seam inside this repository, not cross-repo: the protocol bump,
  `hubTransport.ts`, and `webrtcDaemonClient.ts` are shared with
  `run_1786031348_611758`. Flagged above, escalated in
  `question_1786031902_463107`, not silently claimed.

## Assumptions and unknowns

1. **Resolved, no longer an assumption:** sequencing option (A), confirmed by
   the orchestrator in `question_1786031902_463107`.
2. **Resolved, no longer an assumption:** the rebase onto `origin/main`
   `9753297` is confirmed and mandatory for both Web runs. The orchestrator
   verified the cause independently — `origin/main` advanced by one commit
   between the pre-wave fetch and worktree creation, so `713233f` is that
   commit's immediate parent. `9753297` is not one of this project's runs.
3. **Resolved by Plan Review's live run.** Plan Review executed the live harness
   against a real Hub and observed the values this plan had listed as unknown:

   | Field | Live value |
   | --- | --- |
   | `status.schema_version` | `3` |
   | `software.product_name` | `Botster Hub` |
   | `software.version` | `0.1.0` |
   | `installation.mode` | `development` |
   | `installation.provenance` | `development_build` |

   Corroborated independently against `botster-hub` source at `8a60bd5`:
   `crates/botster-hub-client/src/lib.rs:2688-2693` carries `product_id
   "botster-hub"`, `product_name "Botster Hub"`, `mode "development"`, and
   `provenance "development_build"`.

   The live schema value is `3`, not `2`. That means
   `scripts/live-packaged-protocol-harness.mjs`'s hard-coded
   `status?.schema_version !== 2` assertion **fails today** — Plan Review hit
   exactly that failure from the current stale Web against a protocol-6 Hub.
   Implement corrects the assertion to the observed value. These values are
   recorded as expected observations, not as constants to hard-code into
   rendering; Web still renders whatever the Hub reports.
4. **Still unknown, and correctly so:** the exact `reason` and `action` strings
   returned by `check_hub_update` for a development checkout. Plan Review did not
   report them. Implement must observe them from the live Hub at `8a60bd5` and
   render them verbatim — never invented, never remapped to client-authored copy.
5. **Assumed:** the local `botster-hub` debug binary is rebuilt from `8a60bd5`
   before live proof. The checkout is at `8a60bd5` and a binary exists at
   `target/debug/botster-hub`, but its mtime predates verification, so Implement
   should rebuild rather than trust it.
6. **Unknown:** whether `entity_error` is reachable in the current live harness.
   If it is not, item 7 is proven by unit-level frame handling plus typecheck,
   and that limitation must be stated rather than papered over.

## Affected surfaces and files

Botster layers touched: React/Ionic SPA client only. No Lua plugin, no Rust hub,
no core, no TUI, no MCP surface.

| File | Change |
| --- | --- |
| `src/botster/hubTransport.ts` | `statusRecord()` carries `software`/`installation`; `botster.hub.check_update` dispatch branch. **Not** the renames or `entity_error` — already landed. |
| `src/App.tsx` | remove `hubPackage` version + `check_package_update` binding; render software/installation/host/protocol/schema; update-outcome rendering; register `hub_status` pull; re-pull on WebRTC reconnect |
| `src/App.test.mjs` | `software`/`installation` fixtures; General-section and update-outcome assertions. **Not** `:1373-1374` — already landed. |
| `scripts/browser-runtime-smoke.mjs` | missing-bootstrap/offline General rendering only — no populated identity, no real update action |
| `scripts/live-packaged-protocol-harness.mjs` | populated-identity and real Check-for-updates DOM proof, protocol/conformance/features and secondary-schema rendering, compatibility and support-diagnostic assertions, reconnect proof; `schema_version !== 2` corrected to the observed `3` |
| `README.md`, `docs/architecture.md` | **already landed by the sibling** — coordinate lines are at `revision-31` / `@0.1.24`. Touch only if a Maintenance-surface claim needs adding. |

## Risks

1. **The prerequisite is not yet committed or merged — this is now the top
   risk.** The bump this plan depends on exists only as uncommitted working-tree
   modifications in the sibling's worktree (verified: `origin/main` is still
   `9753297`, and all three sibling commits touch only their plan document). If
   that work is lost, reverted, or its PR is rejected, this ticket becomes
   unimplementable, because `DaemonStatus.software`, `DaemonStatus.installation`,
   and `check_hub_update` do not exist at the old coordinate. Mitigation:
   Implement must confirm the work is committed and merged before starting, and
   must **stop and report rather than re-apply the bump** if it is not — re-applying
   is exactly the divergent state the single-owner rule exists to prevent.
2. **Cross-run merge conflict in `hubTransport.ts` and `App.tsx` — EXPECTED AND
   ACCEPTED.** Both runs are authorised to proceed concurrently, so conflict is a
   planned outcome: whoever merges second resolves it. Earlier revisions framed
   this around a dependency hold and a gate regression; both framings are
   withdrawn. What remains is ordinary conflict discipline — this run never
   enters the session-types surface, and never re-vendors the generated protocol.
   `src/App.tsx` is the contended file, since both runs edit the settings shell.
2. **Stale base.** Implementing on `713233f` would recreate a surface that
   already exists on `9753297` and produce a large false diff. Mitigation:
   mandatory rebase, re-verified at Plan Review.
3. **Drift check is byte-exact.** Any hand edit to the generated protocol, or a
   `package-lock.json` that resolves a different support version, fails
   `npm test`. Mitigation: copy verbatim, and assert the resolved installed
   version and integrity hash.
4. **Silent identity regression to `unknown`.** The reconnect path is the real
   hazard and is currently unproven in production code. Mitigation: item 6 plus
   an explicit reconnect-replay acceptance check rather than a first-connect-only
   assertion.
5. **Synthesizing a fourth update state.** `offline`/`error` are not
   `DaemonHubUpdateState` values. Mitigation: render them from the rejected
   action result path, and assert in tests that no client-authored state string
   reaches the DTO.
6. **Fixture-mode blindness.** `smoke:browser-runtime` runs at
   `/missing-bootstrap` with no Hub bridge, so it can prove only the unavailable
   and offline rendering. Populated identity and the real update action are
   impossible there. Mitigation: acceptance now **assigns** populated-identity
   and real-action DOM proof to the live packaged-protocol harness and scopes the
   browser smoke to missing/offline UI. The earlier plan named both harnesses but
   assigned the work to the one that cannot perform it; Plan Review caught that
   as `finding_1786033049_425897`.
7. **UI-contract coupling.** Verified non-issue for this bump (both sides
   `0.3.1`), but must be re-checked if the support pin moves again.

## Acceptance checks and tests

Repository gates required by [[botster-web-playbook]]:

- `npm run typecheck` — clean. Specifically, all 14 spike errors resolved.
- `npm test` — includes `scripts/check-daemon-protocol-drift.mjs`; must pass
  against the installed `0.1.24` artifact with no override env var.
- `npm run lint` — clean.
- `npm run build` — production build succeeds.

Contract evidence:

- Assert the installed `@trybotster/hub-test-support` resolves to `0.1.24` with
  integrity
  `sha512-n0/DDMw5PmnFdxp54dk4Y4pdAM0VfotQblBnamqkViwbmJgmSS7ZrAFPskzOcVZ70hHgJdfHaH4UwArwP0DvXw==`,
  and that its metadata declares protocol 6 / conformance 31 / ui-contract
  `0.3.1` equal to Web's direct pin.
- Assert `grep -r hub_version src/` returns nothing.

Component and behavior tests in `src/App.test.mjs`:

- Hub version rendering survives with **zero** `botster-web.package` rows loaded
  — the direct regression test for "never derive Hub version from a package row".
- `statusRecord()` carries `software` and `installation` through the
  `botster-web.hub_status` projection.
- `check_hub_update` dispatch produces `current`, `available`, and `unavailable`
  renderings driven by Hub-provided `state`/`reason`/`action`.
- Development-checkout and managed-release `installation.mode` fixtures render
  distinct, honest, non-destructive outcomes.

Offline and error are **two distinct production signals** and get two separate
checks. Corrects Plan Review `finding_1786033049_621190`: the earlier plan
collapsed them into one "offline/error path" assertion, which cannot prove both
and cannot catch a fourth state synthesized on only one of them.

- **Offline — transport rejection / disconnected.** `check_hub_update` is
  dispatched with no reachable Hub (rejected bridge request, or a closed WebRTC
  transport). Assert the General section renders an offline outcome, that the
  action result is `accepted: false`, and that **no** `DaemonHubUpdateState`
  value (`current`/`available`/`unavailable`) appears anywhere in the rendered
  output or the result payload.
- **Error — connected, `operator_error` response.** The Hub is connected and
  answers `check_hub_update` with a `DaemonOperatorError`. Assert the error is
  rendered through the existing `operatorErrorDiagnostic` path with the Hub's
  own `code`/`message`, and again that no `DaemonHubUpdateState` value is
  synthesized. This is a different code path from transport rejection and must
  not be proven by reusing the offline fixture.
- `current`, `available`, and `unavailable` assertions stay separate from both of
  the above and remain strictly Hub-authored.

Stale-client / new-Hub compatibility — required by the ticket, added per Plan
Review `finding_1786033050_137111`:

- Assert a Hub advertising protocol `6` / conformance `31` is accepted under the
  deliberately unchanged `minimumDaemonProtocolVersion` `1` /
  `minimumConformanceFixtureRevision` `14` floor, producing the
  `Hub compatibility descriptor compatible` success diagnostic and **no**
  mismatch or `unsupported_feature` diagnostic.
- Assert the General section still renders authoritative protocol identifier,
  version, conformance revision, and features in that configuration rather than
  degrading to `Not reported`.

Support-diagnostic preservation — the ticket requires diagnostics be preserved
for support, and this change edits both `statusRecord()` and the action-result
projection, so it must be asserted rather than assumed:

- Assert `statusRecord()` still merges `status.diagnostics` with response
  diagnostics into the `botster-web.hub_status` record after `software` and
  `installation` are added.
- Assert the `check_hub_update` action result carries Hub response diagnostics
  through to the Support section, matching the existing
  `botster.spawn_target.daemon_request` branch's `diagnostics:
  responseDiagnostics(response)` shape.

Reconnect proof — the check the ticket calls out explicitly:

- After a simulated WebRTC transport close and reconnect, assert protocol,
  protocol version, conformance, schema, product name, and version are still the
  authoritative values and have **not** become `unknown` or `Not reported`.
- Assert `botster-web.hub_status` is present in `activePulls` so it is
  replay-eligible, and that the reconnect listener re-pulls it.

Real-render proof — **reassigned**, correcting Plan Review
`finding_1786033049_425897`. The earlier plan asked
`scripts/browser-runtime-smoke.mjs` to render populated identity and click a real
update action. That harness cannot do either, and the plan's own risk 6 conceded
as much while still assigning the work there. Verified independently: the smoke
server serves static `dist` plus a single injected
`window.__BOTSTER_PACKAGE_RUNTIME__ = true` on `/missing-bootstrap`, with no Hub
bridge; and `createHubRuntimeConfig` falls back to `unavailableDaemonClient`
whenever `__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__` is absent. So `hub_status` can
never populate there and `check_hub_update` can never execute.

The only in-browser injection seam is `__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__`, which
drives a **real** WebRTC connection to a **real** Hub. Inventing a controlled
in-browser bridge fixture would mean adding a new client abstraction purely for
testing, which this ticket's "smallest surgical change" constraint forbids.
Therefore the split is:

**`scripts/browser-runtime-smoke.mjs` — scoped to missing-bootstrap / offline UI
only.** This is genuine value, not a consolation prize: it is the natural home
for the offline outcome above.

- Navigate to `/settings`, open **General**, and assert the no-Hub state renders
  honestly (`Not reported` rather than a fabricated version, and no crash).
- Assert the **Check for updates** control is present and correctly disabled or
  renders the offline outcome with no Hub reachable.
- Assert no page errors, reusing the existing `assertNoPageErrors` helper, and
  keep the existing `assertHubSettingsHeadingHierarchy` coverage intact.

**`scripts/live-packaged-protocol-harness.mjs` — owns all populated-identity and
real-action DOM proof.** It already drives Chromium against a real installed Hub
and already records structured evidence via
`__BOTSTER_LIVE_PROTOCOL_HARNESS__`, so this is where the user path actually
exists.

- Navigate to `/settings`, open **General**, and assert on **rendered DOM text**:
  product name, version, build revision when present, installation mode,
  provenance, release channel and provider when present, host display name and
  host id.
- Assert rendered protocol identifier, protocol version, conformance revision,
  and features as user-path evidence — not only as recorded frames.
- Assert state schema is rendered **and visibly secondary** to user-facing
  software status, satisfying the ticket's ordering requirement rather than
  merely its presence requirement.
- Click the real **Check for updates** button and assert the rendered outcome
  against the Hub's actual `state`/`reason`/`action`.

Downstream live proof against a real Hub, required by the charter's live-hub
conformance gate:

```bash
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
npm run smoke:live-packaged-protocol
```

- Hub rebuilt from `botster-hub` `8a60bd5` (the commit `0.1.24` was published
  from).
- Extend `assertCurrentHubCompatibilityAndSchema` to assert authoritative
  `software`/`installation` facts and correct the hard-coded
  `schema_version !== 2` assertion, which Plan Review proved **fails today**
  against a protocol-6 Hub reporting schema `3`.
- Reuse the existing `requiredProvenanceField(record, field, label)` helper in
  `scripts/workspaces-shared-hub-browser-helpers.mjs` for those assertions
  rather than writing new ones. It already fails loudly on `undefined`, `null`,
  and `""`, which is exactly the "must never regress to unknown" invariant, and
  reusing it follows
  [[prefer framework and library components over custom solutions]].
- Exercise the real `check_hub_update` request against the live Hub and record
  the actual state, reason, and action for a development checkout.
- Prove identity survives the harness's existing two-WebRTC-generation reload
  path — this is the reconnect-replay evidence in production shape.

Structured evidence, not toast text, per the charter: assert on
`__BOTSTER_LIVE_PROTOCOL_HARNESS__` recorded frames and daemon responses.

## Vault gaps worth capturing

1. **Hub identity is a status projection, never a package row.** The contract
   removal of `DaemonPackageCompatibility.hub_version` plus the
   `DaemonStatus.software`/`installation` addition is a durable client rule that
   already bit `botster-web` and `botster-tui` independently
   (`ticket_1785976581_841608`). Worth an atomic note linked from
   [[botster package daemon dto exposes sanitized package rows]].
2. **Push-hydrated entity families must be registered as active pulls to survive
   reconnect.** `botster-web.hub_status` arrives as a side effect of
   `hubTransport.connect()` and is therefore invisible to
   `replayActivePulls()`; `replayActivePulls()` additionally has no production
   caller. That is a reusable Botster SPA reconnect gotcha, not a one-off bug.
3. **Mechanically-forced work belongs to whoever unblocks on it; judgement work
   belongs to its subject-matter ticket.** The most useful rule to come out of
   this run, and a better partition than the A/B/C buckets it replaced. If the
   correct value is read off an artifact's `metadata.json`, both runs would
   produce it identically and no divergent state is possible, so the blocked run
   should just land it. If it requires judgement about a domain — here, Hub
   identity and maintenance semantics — it stays with the ticket that owns that
   domain. This resolves protocol-bump collisions without serialising runs.
4. **A type error and a behavioural bug can be the same line, and fixing only the
   type ships the bug.** `entity_error` in `webrtcDaemonClient.receiveEntityFrame`
   falls through to the delta path where `frame.snapshot_seq !== currentSequence + 1`
   evaluates `undefined !== N+1` and fires `resubscribeEntity` with
   `sequence_gap`. A cast or `in` guard satisfies `tsc` and still ships a
   resubscribe loop. Worth capturing that "narrow the union" is not automatically
   a type-level-only change.
4. **Update state is three-valued; offline and error are transport outcomes.**
   Worth a short note so no client invents a fourth `DaemonHubUpdateState`.
5. **A test harness with no Hub bridge cannot be real-render proof for
   Hub-sourced state.** From this run's first review cycle: name the harness that
   can actually reach the state, and resist adding a test-only bridge abstraction
   to make the wrong harness work.
6. **Check a vault note's `status` before citing it as binding.** This run cited
   [[project pipeline step activation gates open ticket dependencies before side effects]]
   as a current runtime contract when it is `type: drift`, `status: superseded`,
   and says so in its own body. Ironically that note exists to record exactly
   this failure. A concrete planning rule — verify frontmatter `status` at load
   time, not just that the filename resolves — would have prevented it, and
   filename-resolution checks alone demonstrably do not.
7. **In this environment, Project Pipelines dependency edges are advisory
   records, not enforcement.** The Hub here runs a legacy plugin; the standalone
   package that would enforce ordering targets the new Hub, is intentionally not
   installed, and is not pending a cutover. Ordering between tickets is
   maintained by orchestrator instruction only. This is the highest-value capture
   from this run: revisions 2 and 3 of this plan both reasoned as though an
   engine would sequence the work, and a plan that needs another ticket to land
   first must instead say so explicitly and expect a human to sequence it.
8. **Correcting a claim needs the same evidence standard as making one.** This
   run reported a "gate regression" on accurate observations plus an inherited
   assumption that the gate was installed. The observation was sound; the
   inference was not. Worth capturing that an environment-capability assumption
   should be verified before an incident is declared on top of it.
