# Web: remove Project Pipelines coupling from the generic package-event client

Revision 3. Revision 2 received `changes_required` from `review_1787363668_187959` for pinning a release that was never published; see "Revision 3". Revision 1 received `changes_required` from `review_1787349940_998291` with two blockers, one high, two medium, and one process finding. Revision 2 answers all six against the merged upstream artifacts.

## Plan Review response (rev 1 -> rev 2)

| Finding | Severity | Response |
| --- | --- | --- |
| `finding_1787349940_182802` the plan does not wire package notice descriptors into the production hook | blocker | Fixed. Rev 1 excluded `src/botster/hubTransport.ts` and therefore left the hook with no descriptor source. Rev 2 adds the smallest generic adapter change: `packageRecord()` preserves `notice_reactions` on the `botster-web.package` row, and `src/App.tsx` passes those reactive rows into the hook. See "Production wiring (rev 2)". |
| `finding_1787349940_689889` merged Hub source is not a consumable Web dependency | blocker | Fixed. Independently confirmed on 2026-08-21 that npm ends at `@trybotster/ui-contract@0.3.2` and `@trybotster/hub-test-support@0.1.39`, while the merge carries 0.3.3 and 0.1.40. Registered `ticket_1787351279_697528` on the Hub target for npm publication, and dependency edge `dependency_1787351283_317598`. The existing `ticket_1787349524_364728` covers only the Rust Git tag and does not make an npm coordinate installable. |
| `finding_1787349940_748237` the plan duplicates the canonical notice text resolver | high | Fixed. The Web-owned `noticeTextFromEvent` parser is removed from the plan. Web calls `resolveNoticeText` from `@trybotster/ui-contract` and handles its typed error codes. See "Notice text resolution (rev 2)". |
| `finding_1787349940_216135` the affected-file list cites an absent path | medium | Fixed. `src/app/dialogs/WorkbenchDialogs.tsx` does not exist. Every reference now reads `src/app/WorkbenchDialogs.tsx`, verified against the routed tree. `src/app/dialogs/WorkbenchNotifications.tsx` was checked and is correct. |
| `finding_1787349940_889046` acceptance gate G3 cannot pass and scans unrelated contracts | medium | Fixed. G3 is now a scoped scan of the three production reaction modules with an explicit exclusion rationale for generated DTOs, tests, fixtures, and unrelated package-management code. |
| `finding_1787349940_213858` final Plan completion evidence omitted artifact_id | info | Fixed procedurally. The rev-2 gate submission and advance request both carry `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, and `target_repository`. |


## Target repository and target

- Repository: `trybotster/botster-web`
- `target_id`: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Spawn target name: `booster-web` (Hub label); filesystem and GitHub identity are `botster-web`
- Repository playbook: [[botster-web-playbook]]
- Botster layers: Ionic React client, WebRTC host-control connection, generated host DTO consumption, client protocol fixtures
- Ticket: `ticket_1787278327_274484`; run `run_1787278334_136543`; pipeline `botster_stack_delivery` (direct merge, no pull request)
- Base: `origin/main` at `71b461c20ccfe187bf2318773d791f168334fd18`

Routing used `list_spawn_targets` against the ticket `target_id`. The ambient process directory was not the routing source.

## Playbooks and notes loaded

Role and repository:

1. [[planner-playbook]]
2. [[botster-planner-playbook]]
3. [[botster-web-playbook]] (repository ownership charter)
4. [[project-pipelines-playbook]] — loaded because the ticket removes Project Pipelines workflow policy from Web and may register a Project Pipelines dependency.

Targeted atomic notes:

- [[event plane client proof uses library contract fixtures]] — Web owns a canonical generic protocol harness; product plugins prove their own events separately. This note is the direct authority for the ticket.
- [[web package event notices are transient and entity state is durable]] — the transient notice and durable entity split that must survive this change.
- [[package event owners use admitted package names not repository names]] — runtime owner identity, relevant to whatever supplies the owner string after this change.
- [[package event contracts live on HubPackageManifest not Core PackageManifest]] — where a package-owned event declaration legally lives.
- [[exact owner plus name is the only package event subscription key]] — the subscription key that must stay exact.
- [[question opened clients subscribe with empty subjects]] — the current subscription shape. The human decision in this run supersedes it; see "Convention conflict recorded".
- [[web event plane budgets are published numeric host limits]] — published flood and gap limits.
- [[hub client event queue max requires Botster test mode]] — forced-gap lane configuration.
- [[hub test support 0 1 39 revision 44 is the web package event dto cutover]] — the pinned DTO and metadata baseline.
- [[botster packages should enforce core hub cli plugin provider boundaries]] — the ownership rule this ticket enforces.
- [[vault example paths are not repository placement conventions]] — plan destination comes from repository prior art; `docs/plans/` is confirmed by mainline prior art in this repository.

Not loaded: [[botster runtime teardown lenses]]. See "Runtime-teardown class" below.

## Context loaded

- Merged base commits `3ee129d` (Web consumption of transient Hub package events) and `71b461c` (conflicting workflow IDs, notice clearing).
- `src/app/packageEventNotices.ts`, `src/app/usePackageEventNotices.ts`, `src/App.tsx`, `src/app/WorkbenchDialogs.tsx`, `src/app/dialogs/WorkbenchNotifications.tsx`.
- `src/botster/hubTransport.ts`, `src/botster/webrtcDaemonClient.ts`, `src/botster/protocolPlanes.ts`, `src/botster/protocol.ts`, `src/botster/connectionDiagnostics.ts`.
- `src/botster/generated/daemon-protocol.ts` (`DaemonPackage`, `DaemonEvent`, `subscribe_events`, `package_event`, `event_gap`).
- Installed `@trybotster/ui-contract@0.3.2` and `@trybotster/hub-test-support@0.1.39` public surfaces.
- `src/App.test.mjs` package-event assertions, `fixtures/package-events/`, `scripts/live-packaged-protocol-harness.mjs`.
- `package.json` scripts, including `test`, `typecheck`, `lint`, `smoke:package-events`, `smoke:package-events:gap`.

## Coupling inventory (measured, not assumed)

Production Web source that names Project Pipelines today:

| File | Coupling |
| --- | --- |
| `src/app/packageEventNotices.ts` | `QUESTION_OPENED_EVENT_OWNER = "project-pipelines"`, `QUESTION_OPENED_EVENT_NAME = "question.opened"`, `RUN_STEP_FAMILY`, `RUN_FAMILY`, the `question_id` / `kind` / `notice` payload schema, the `run_id` / `ticket_id` / `step_id` identity keys, and the `agent_session_uuid` join |
| `src/app/usePackageEventNotices.ts` | imports and applies every constant above |
| `src/App.tsx` | composes `usePackageEventNotices` and `viewedSessionIdFromRoute` |

The transport and protocol layers are already generic. `src/botster/hubTransport.ts` and `src/botster/webrtcDaemonClient.ts` carry no Project Pipelines owner, event name, payload field, or entity family. Those layers are therefore out of scope except where a seam parameter must reach them.

## The missing public seam

The ticket requires event reactions to arrive through a public library composition boundary or a package-owned declaration, and forbids a Web-local package registry. No such seam exists today. Evidence:

- `DaemonPackage` in `src/botster/generated/daemon-protocol.ts` carries `surfaces`, `routes`, `actions`, `runnable_entrypoints`, `configuration`, and `availability`. It carries no event or notice declaration.
- `@trybotster/ui-contract@0.3.2` exports `PackageSurfaceDescriptor`, `UiNode`, `UiActionRequest`, and `UiActionResult`. It has no event or notice concept.
- `@trybotster/hub-test-support@0.1.39` publishes no client-visible projection of `events.emitted`.
- Per [[package event contracts live on HubPackageManifest not Core PackageManifest]], `events.emitted` is a producer-side schema admitted at the Hub. A schema declaration alone cannot tell a client to join `run_step.agent_session_uuid` to the viewed session and render `payload.notice`.

Blocking human question `question_1787278509_823001` records this finding and the three candidate resolutions.

## Runtime-teardown class

`teardown_class_applies`: **no**.

This ticket changes no WebRTC peer lifecycle, no `SessionIo` or `ClientWorker` teardown, no multi-peer ownership, no CPU, battery, or file-descriptor bound, and no terminal-state versus live-runtime divergence. It moves product constants out of two application modules and replaces product-specific client tests with neutral contract fixtures. The subscription acquire and release lifecycle in `src/botster/webrtcDaemonClient.ts` is preserved unchanged, not redesigned. [[botster runtime teardown lenses]] is therefore not loaded, per the explicit exclusion in [[botster-planner-playbook]].

The existing request-race and subscription-state proofs in `src/App.test.mjs` are preserved and must keep passing: release before acknowledgement, disconnect before acknowledgement, late event after release, and exactly one active subscription after reconnect.

## Invariants that must survive

These hold under every branch below.

1. Exactly one `subscribe_events` per connection generation for each distinct `owner` / `name` / `subjects` key, with the key still built from exact owner plus name.
2. `subjects` stays exactly what the reaction declaration plus the session subject scope produce. Web never invents a subject value.
3. Reconnect creates a fresh subscription id and replays no notice.
4. `event_gap` stays diagnostics only. It never creates, removes, or changes entity state.
5. Durable question rows keep coming from the entity plane, not the event plane.
6. Notice lifetime stays bounded at the published duration, and the notice clears when the viewed session changes.
7. The published flood and gap budgets in `docs/architecture.md` stay measured separately.

## Non-scope

- No change to `src/botster/webrtcDaemonClient.ts` subscription mechanics beyond passing a declared spec. Rev 2 adds exactly one generic passthrough field in `src/botster/hubTransport.ts`; see "Production wiring (rev 2)".
- No new Web-local package registry and no second event protocol.
- No change to the entity plane, terminal planes, or any unrelated route.
- No new Hub protocol authored inside `botster-web`.
- No pull request. Direct merge into `main`.

## Repository ownership boundaries

- `botster-web` owns client protocol consumption, the canonical generic client protocol harness, and rendering. It does not own package event policy, event schemas, or workflow identity semantics.
- `botster-hub` owns package event admission and any client-visible projection of a package declaration.
- `botster-project-pipelines` owns the `question.opened` contract and any Project Pipelines client reaction declaration.

The whole point of this ticket is to restore that boundary in Web production source.

## Human decision of record

Blocking question `question_1787278509_823001` was answered. The human chose option A with these binding refinements:

1. Register one shared `botster-hub` dependency for a package-owned client reaction descriptor in the canonical UI/client contract and its `DaemonPackage` projection.
2. Register one `botster-project-pipelines` dependency to declare the reaction and emit the targeting data. That ticket depends on the Hub ticket.
3. Web and TUI consume the same two contracts. Do not create client-specific variants.
4. Do not put Project Pipelines entity joins or field paths into the generic descriptor. Use the existing event subject mechanism for context targeting.
5. The shared contract may define a bounded generic notice reaction with an exact owner and name derived from the package, a standard session subject scope, a validated text pointer such as `/notice`, and bounded presentation fields such as TTL or severity.
6. Project Pipelines emits the active agent session uuid as `payload.subject` when that context exists. A session-scoped client subscribes with its current session subject. No subject means no session-scoped transient notice.
7. Durable question state stays package-owned entity or surface state. It is not part of the transient reaction descriptor.
8. This Web ticket registers the dependencies and parks before Implement. Do not land an unwired production refactor. After both dependencies merge, this same ticket implements the generic descriptor-driven Web client and the neutral public-boundary fixtures.
9. Preserve the current production notice through the package declaration, not through Web constants.

## Registered cross-repository dependencies

| Ticket | Target | Repository | Purpose |
| --- | --- | --- | --- |
| `ticket_1787278643_145174` | `tgt_7e208a0c76a44980a83b63af976b1f22` | `trybotster/botster-hub` | Publish the package-owned client notice reaction descriptor in the canonical UI/client contract, admit it on `HubPackageManifest`, and project it onto `DaemonPackage` |
| `ticket_1787278658_151737` | `tgt_a72ca1a83d504385b8648f71409119ab` | `trybotster/botster-project-pipelines` | Declare the `question.opened` notice reaction and emit `payload.subject` as the active agent session uuid |

Dependency edges:

- `dependency_1787278661_690676`: `ticket_1787278658_151737` depends on `ticket_1787278643_145174`.
- `dependency_1787278671_574148`: `ticket_1787278327_274484` depends on `ticket_1787278643_145174`.
- `dependency_1787278676_422577`: `ticket_1787278327_274484` depends on `ticket_1787278658_151737`.

This Web ticket therefore parks after Plan. It cannot start Implement until both dependencies close.

## Scope of this Web ticket, after both dependencies merge

1. **Consume the published descriptor.** Regenerate `src/botster/generated/daemon-protocol.ts` from the authoritative Hub artifact and pin the new `@trybotster/ui-contract` and `@trybotster/hub-test-support` versions. Verify DTO drift with `scripts/check-daemon-protocol-drift.mjs`, per [[botster web dto field names must match authoritative rust serde structs]].
2. **Make the reaction module generic.** Replace `src/app/packageEventNotices.ts` with a module that holds no owner, no event name, no entity family, and no product payload schema. It gains:
   - `packageNoticeReactionsFromPackages(packages)`: read admitted descriptors from the `DaemonPackage` projection only.
   - `noticeSubscribeSpec(descriptor, sessionSubject)`: build `{ owner, name, subjects }` from the descriptor plus the viewed session subject.
   - `noticeTextFromEvent(descriptor, payload)`: resolve the declared text pointer, validate that it yields a non-empty string, and return the notice.
   - The existing exact subscription key helper, unchanged.
3. **Make the hook generic.** `src/app/usePackageEventNotices.ts` iterates admitted descriptors, subscribes once per descriptor per connection generation with the current session subject, renders through the declared TTL and severity, clears on session change, and holds no entity demand for any product family. The `entity_pull` and `entity_release` calls for `project-pipelines.run_step` and `project-pipelines.run` are deleted, because subject targeting replaces the identity join.
4. **Keep `src/App.tsx` product-free.** It composes the generic hook with the admitted package list and the viewed session id. It imports no product constant.
5. **Replace product-specific client tests with neutral contract fixtures.** New fixture package under `fixtures/package-notice-reaction/` declares a neutral owner, a neutral event name, and a neutral notice reaction. `src/App.test.mjs` drives subscribe, receive, subject filter, gap, reconnect, and notice rendering through that fixture and through the public protocol boundary. The fixture enters at the encoded frame boundary, never after protocol decoding.
6. **Optional Project Pipelines conformance only.** Keep `fixtures/package-events/` as a live-lane conformance fixture if it costs no production composition. It must not be imported by any production module.
7. **Update documents.** `README.md` and `docs/architecture.md` state the new pinned package and revision metadata, and describe the descriptor-driven reaction. Package and revision claims must equal installed Hub test-support metadata.

## Non-scope of this Web ticket

- Authoring the descriptor shape. That is `ticket_1787278643_145174`.
- Declaring or emitting `question.opened`. That is `ticket_1787278658_151737`.
- Any TUI change.
- Any change to transport subscription mechanics beyond passing the declared spec and the one `notice_reactions` passthrough named in rev 2.

## Convention conflict recorded

The human decision supersedes two current statements.

| Current convention | Conflict | Resolution |
| --- | --- | --- |
| [[question opened clients subscribe with empty subjects]] | The client will now subscribe with its current session subject, not an empty subject set | Superseded by `question_1787278509_823001`. `ticket_1787278658_151737` owns the update. |
| [[botster-web-playbook]] required gate "use admitted owner names, keep question subject filters empty, and filter workflow identity in Web" | Web will no longer filter workflow identity, and subject filters will no longer be empty | Superseded by the same answer. The charter line needs an update after the dependencies merge. |

No other convention conflicts. [[web package event notices are transient and entity state is durable]] still holds: the notice stays transient and durable question rows stay on the package entity plane.

## Assumptions and unknowns

Assumptions:

- A1. The Hub descriptor will reach Web only through `DaemonPackage`. Web will read no other source.
- A2. The session subject value is the agent session uuid that Web already knows from its route. Web needs no entity read to build it.
- A3. `subscribe_events` keeps its current `subjects` array shape, so no new protocol frame is required in Web.
- A4. `event_gap` and the queue-limit behavior are unchanged by the Hub ticket.
- A5. `docs/plans/` is the plan destination, confirmed by mainline prior art in this repository.

Unknowns, all owned upstream:

- U1. The exact descriptor field names and the text-pointer grammar. `ticket_1787278643_145174` decides them. Web consumes whatever it publishes.
- U2. Whether the descriptor allows more than one reaction per package. Web will iterate a list either way.
- U3. Whether severity maps onto an Ionic toast colour. Web will map declared severity to existing Ionic primitives, per [[botster web uses vanilla ionic primitives by default]].
- U4. Whether Hub subject matching is exact equality or a prefix scope. Web will use exact equality unless the published contract states otherwise.

Implement must re-read the merged upstream contracts and must not act on these assumptions when the published artifacts disagree.

## Affected surfaces and files

Production:

- `src/app/packageEventNotices.ts` — rewritten generic; all product constants removed.
- `src/app/usePackageEventNotices.ts` — rewritten descriptor-driven; product entity demand removed.
- `src/App.tsx` — composition only; product imports removed.
- `src/app/dialogs/WorkbenchNotifications.tsx` and `src/app/WorkbenchDialogs.tsx` — declared TTL and severity replace the fixed 5000 ms default.
- `src/botster/generated/daemon-protocol.ts` — regenerated for the descriptor projection.

Tests, fixtures, and documents:

- `src/App.test.mjs` — product assertions replaced by neutral fixture assertions.
- `fixtures/package-notice-reaction/` — new neutral fixture package.
- `fixtures/package-events/` — retained only as an optional live conformance lane.
- `scripts/live-packaged-protocol-harness.mjs` — package-event lane retargeted to the neutral fixture.
- `package.json` — pinned contract versions; a neutral notice-reaction smoke script.
- `README.md`, `docs/architecture.md` — pinned package and revision metadata.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| R1. Upstream descriptor shape differs from A1 to A4 | Rework in Web | Web parks until both dependencies close, then re-reads the published artifacts before writing code |
| R2. Subject targeting loses notices that the identity join used to match | Silent behaviour regression | Live lane must show one notice for a subject-matched emit and none for a subject-mismatched emit, on the production path |
| R3. Deleting the entity demand for `run_step` and `run` removes rows another view needs | Broken unrelated view | Grep for every other consumer of those families before deletion; the current base has no other consumer |
| R4. The neutral fixture injects after protocol decoding | Test proves nothing | The fixture must emit encoded frames into the transport; the test asserts the entry point is the encoded boundary |
| R5. Declared TTL is unbounded or hostile | Toast never dismisses | Web clamps declared TTL to the published bounded range and keeps the current default when the descriptor omits it |
| R6. Regenerated DTO drifts from the authoritative Hub artifact | Contract mismatch | `scripts/check-daemon-protocol-drift.mjs` runs inside `npm test` |
| R7. Web lands the refactor before the dependencies merge | Unwired production code | The registered dependency edges block Implement; this plan forbids the unwired landing |

## Acceptance checks and tests

Gate for the parked state, verifiable now:

- G1. `ticket_1787278643_145174` and `ticket_1787278658_151737` exist on the correct targets, and all three dependency edges exist.
- G2. No source change lands in `botster-web` during the parked state.

Gates for Implement, after both dependencies close:

- G3. Forbidden-constant scan, scoped to the three production reaction modules only — `src/app/packageEventNotices.ts`, `src/app/usePackageEventNotices.ts`, and `src/App.tsx`:

  ```
  grep -nE '"project-pipelines|question\.opened|question_id|project-pipelines\.(run_step|run|question)' \
    src/app/packageEventNotices.ts src/app/usePackageEventNotices.ts src/App.tsx
  ```

  The command must return no match. The scan deliberately excludes `src/botster/generated/daemon-protocol.ts`, every test, every fixture, and unrelated generic package-management code. The generated DTO legitimately contains `ticket_id`, and unrelated tests and fixtures legitimately carry Project Pipelines package rows, so a repository-wide scan for bare `ticket_id` or `run_step` cannot pass and does not measure this ticket's intent.
- G4. `npm run typecheck` passes.
- G5. `npm run lint` passes.
- G6. `npm test` passes, including `scripts/check-daemon-protocol-drift.mjs`.
- G7. `npm run build` passes.
- G8. The neutral fixture proves, through the public protocol boundary, all six behaviours: subscribe, receive, subject filter, `event_gap`, reconnect, and notice rendering. Each has a positive and a negative case. The subject-filter negative case must produce no notice.
- G9. The neutral fixture entry point is the encoded frame boundary. A test asserts that the fixture never calls a decoded-payload injection path.
- G10. Reconnect creates a fresh subscription id and replays no notice.
- G11. Exactly one active subscription per descriptor per connection generation, after acquire, release, disconnect, and reconnect.
- G12. Notice lifetime is bounded by the declared TTL, and the notice clears when the viewed session changes.
- G13. Live proof: `npm run smoke:package-events` renders a notice for a subject-matched emit and none for a subject-mismatched emit, through real components and routes, per the [[botster-web-playbook]] rendering gate. Source regexes alone are insufficient.
- G14. Live gap proof: `npm run smoke:package-events:gap` still observes at least one `event_gap`, with both queue variables set on the isolated Hub child only, per [[hub client event queue max requires Botster test mode]].
- G15. The four published flood and gap budgets in `docs/architecture.md` are measured separately, and notices never exceed emitted events, per [[web event plane budgets are published numeric host limits]].
- G16. `README.md` and `docs/architecture.md` package and revision claims equal installed Hub test-support metadata.
- G17. Independent base re-verification: Implement re-fetches the merged Hub and Project Pipelines commits and cites their exact SHAs, rather than trusting this plan's assumptions.

Direct merge into `main`. No pull request.

## Vault gaps worth capturing

- V1. A new note: package-owned client reaction descriptors are the public seam for transient package notices, replacing client-held product constants. Source: `question_1787278509_823001`.
- V2. A new note: package event context targeting uses the event subject mechanism, not client-side entity joins.
- V3. Supersede [[question opened clients subscribe with empty subjects]] once `ticket_1787278658_151737` merges.
- V4. Update the [[botster-web-playbook]] required gate that tells Web to keep subject filters empty and to filter workflow identity in the client.
- V5. A new note: a generic client mechanism that ships with no composed production reaction is unwired implementation, and the human rejected that trade in this run.

---

# Revision 2

Revision 2 supersedes the rev-1 sections "Scope of this Web ticket, after both dependencies merge", "Assumptions and unknowns", and the G3 entry. Every other rev-1 section stands.

## Verified merged upstream contract

Rev 1 stated assumptions A1 to A4 because the contract did not exist yet. Both dependency tickets have merged, so these are now verified facts read from the merged sources, not assumptions.

Hub merge `12e0cc6` ("Merge ticket: Hub package-owned client notice reaction descriptor"), in `trybotster/botster-hub`:

- `DaemonPackage` gains `notice_reactions?: PackageNoticeReactionDescriptor[]`, verified at `packages/hub-test-support/daemon-protocol.ts:609`.
- `PackageNoticeReactionDescriptor` is `{ owner: string; name: string; subject_scope: PackageNoticeSubjectScope; text_pointer: string; ttl_ms: number; severity: PackageNoticeSeverity }`.
- `PackageNoticeSubjectScope` is the single value `"session"`.
- `PackageNoticeSeverity` is `"info" | "warning" | "error"`.
- `@trybotster/ui-contract` exports `resolveNoticeText(payload, pointer)` and `NOTICE_TEXT_MAX_BYTES = 512`.
- `resolveNoticeText` accepts one top-level RFC 6901 pointer, measures the decoded string as UTF-8 bytes, and does not trim or truncate. It throws typed errors with `code` values `missing`, `not_string`, `empty`, and `oversized`. The `oversized` error also carries `bytes`.
- `docs/client-protocol.md` states that `notice_reactions` is additive and optional, that empty vectors are omitted on the wire, that each projected descriptor always carries a required `owner` equal to the admitted package name, and that protocol version stays 7.
- Source-tree metadata at the merge: `@trybotster/hub-test-support` 0.1.40, `@trybotster/ui-contract` 0.3.3, protocol_version 7, conformance_fixture_revision 45. **Superseded.** The release skipped 0.1.40 and published 0.1.41 with conformance_fixture_revision 46. See "Revision 3" for the pins Implement must use.
- The generated protocol delta is two insertions and one deletion: the new field and its import. `subscribe_events`, `package_event`, and `event_gap` are untouched.

Project Pipelines merge, in `trybotster/botster-project-pipelines`:

- `botster-package.json` declares `notices: [{ name: "question.opened", subject_scope: "session", text_pointer: "/notice", ttl_ms: 10000, severity: "warning" }]`. It omits `owner`, so Hub projects the admitted name `project-pipelines`.
- The `question.opened` payload schema gains an optional `subject` string of at most 128 bytes.
- `plugin.lua:1980` reads `run_step.agent_session_uuid` and `plugin.lua:1981` sets `payload.subject` only when that value is a nonempty string.

Rev-1 assumption outcomes:

| Rev-1 item | Outcome |
| --- | --- |
| A1 descriptor reaches Web only through `DaemonPackage` | Confirmed. `notice_reactions` on the package row is the only client-visible source. |
| A2 the session subject is the agent session uuid Web knows from its route | Confirmed. Project Pipelines emits `payload.subject` as `run_step.agent_session_uuid`. Web needs no entity read. |
| A3 `subscribe_events` keeps its current `subjects` array shape | Confirmed. The frame is unchanged. |
| A4 `event_gap` and queue-limit behaviour unchanged | Confirmed. Protocol version stays 7 and neither frame changed. |
| U1 descriptor field names and pointer grammar | Resolved. Fields listed above; one top-level RFC 6901 pointer. |
| U2 more than one reaction per package | Resolved. `notice_reactions` is a vector, so Web iterates. |
| U3 severity mapping | Resolved. Three values map onto Ionic toast colours: `info` to `medium`, `warning` to `warning`, `error` to `danger`, per [[botster web uses vanilla ionic primitives by default]]. |
| U4 subject matching is exact or prefix | Resolved as **exact**, per [[Package-event subject filters are exact strings compiled at admission]]. Hub compares `payload.subject` against an exact-match set compiled at admission. |

## Additional notes loaded in rev 2

- [[generic botster clients must not hardcode package event reactions]] — names this exact violation at Web commit `71b461c` and states that renaming or relocating the constants does not fix it.
- [[client notice reactions belong to package declarations not client constants]] — the canonical contract. It also states that the binary composition root must stay generic, which independently rules out the rev-1 option B.
- [[question opened notices target the agent session subject]] — the Project Pipelines application, including the declared `ttl_ms: 10000` and `severity: "warning"`.
- [[Package-event subject filters are exact strings compiled at admission]] — exact matching plus the admission ceilings: 16 subject values per subscription, 256 UTF-8 bytes per value, 4,096 aggregate bytes per subscription, and 64 active subscriptions per host-control connection.

## Production wiring (rev 2)

This section answers `finding_1787349940_182802`. Rev 1 left the descriptor with no path from the wire to the hook.

Current path, measured: `hubTransport.ts` translates every `DaemonPackage` through `packageRecord()` at `src/botster/hubTransport.ts:845`. That function builds an explicit allow-list object and drops any field it does not name, so `notice_reactions` disappears. `src/App.tsx:213` reads the resulting rows with `runtimeClient.entities.list("botster-web.package")`.

Rev-2 wiring, smallest change that closes the gap:

1. `packageRecord()` adds one field to its returned record: `notice_reactions: packageRecord.notice_reactions ?? []`. This is a generic adapter passthrough. It names no package and no event.
2. `src/App.tsx` passes the existing `packages` rows into `usePackageEventNotices({ runtimeClient, viewedSessionId, packages })`. `App.tsx` already holds those rows at line 213, so no new subscription is added.
3. `usePackageEventNotices` derives its subscription set from `packages.flatMap((row) => row.notice_reactions)`. The hook holds no constant.

The production entry point therefore uses the new behaviour: a real `list_packages` response carrying `notice_reactions` produces a real subscription and a real toast. `src/botster/hubTransport.ts` moves from the rev-1 non-scope list into scope for exactly this one passthrough field.

Reactivity requirements, all provable at the encoded boundary:

- A package row that arrives after the first render adds its subscription without a remount.
- A package row whose `notice_reactions` becomes empty releases its subscription.
- A package removal releases its subscription.
- Reconnect re-subscribes once per descriptor per connection generation.
- Exactly one active subscription per descriptor at any time.

## Notice text resolution (rev 2)

This section answers `finding_1787349940_748237`. Web authors no pointer parser and no byte-limit check.

- Web calls `resolveNoticeText(payload, descriptor.text_pointer)` from `@trybotster/ui-contract`.
- Web catches the typed error and suppresses the notice for every `code`: `missing`, `not_string`, `empty`, and `oversized`.
- Each suppression emits one bounded connection diagnostic. Suppression never creates, removes, or changes entity state.
- Web does not trim, truncate, or re-measure the string. The canonical helper owns that behaviour, including RFC 6901 escape handling and the 512-byte UTF-8 limit.
- Web asserts the shared conformance vectors from `@trybotster/ui-contract/conformance-fixtures` rather than hand-authored equivalents.

## Subscription construction (rev 2)

- Owner and name come from the descriptor, never from Web.
- `subject_scope: "session"` means the subject set is `[viewedSessionId]` when a session is viewed.
- With no viewed session, Web sends no subscription for that descriptor. It does not fall back to an empty subject set, because an empty set accepts every live event and would restore the unscoped notice the human rejected in `question_1787278509_823001`.
- Web sends at most one subject value, well inside the admission ceilings of 16 values, 256 bytes per value, and 4,096 aggregate bytes.
- A question with no session binding does not reach a session-scoped subscriber. That is the intended contract, not a defect.

## TTL and severity (rev 2)

- The toast duration is `descriptor.ttl_ms`, clamped to a bounded range. Project Pipelines declares 10000, which replaces the current hardcoded 5000 in `src/app/dialogs/WorkbenchNotifications.tsx`.
- `severity` maps to the Ionic toast colour as listed in U3.
- The notice still clears when the viewed session changes.

## Dependencies after rev 2

| Ticket | Target | Repository | Status |
| --- | --- | --- | --- |
| `ticket_1787278643_145174` | `tgt_7e208a0c76a44980a83b63af976b1f22` | `botster-hub` | closed |
| `ticket_1787278658_151737` | `tgt_a72ca1a83d504385b8648f71409119ab` | `botster-project-pipelines` | closed |
| `ticket_1787351279_697528` | `tgt_7e208a0c76a44980a83b63af976b1f22` | `botster-hub` | closed — published 0.3.3 and 0.1.41; 0.1.40 was skipped |

Edge `dependency_1787351283_317598` registers the third ticket. Web stays parked until it closes, because the merged Hub source is not installable from the registry today.

Related but not a Web dependency: `ticket_1787349524_364728` publishes the `botster-ui-contract-v0.3.3` Git tag for Rust consumers. Web consumes npm, not Cargo, so that ticket does not gate this one.

## Acceptance checks added in rev 2

These are additional to G1 through G17, and G3 is replaced as shown above.

- G18. A clean registry install pins `@trybotster/ui-contract@0.3.3` and `@trybotster/hub-test-support@0.1.41`. `package.json` and `package-lock.json` record both. The install is verified from the registry, not from a workspace link.
- G19. Token checks on the installed artifacts: `notice_reactions` present in the installed `daemon-protocol.ts`, `resolveNoticeText` and `NOTICE_TEXT_MAX_BYTES` equal to 512 exported by the installed `ui-contract`, installed metadata reporting package_version 0.1.41, ui_contract 0.3.3, protocol_version 7, and conformance_fixture_revision 46, and the installed `daemon-protocol.ts` sha256 equal to `14121c4b1aa15f0728040b7ab3cc0189bf7720dc3159d994926d54e0251c5996`.
- G20. Encoded `list_packages` proof for descriptor reactivity: late package arrival subscribes, descriptor removal releases, package removal releases, reconnect re-subscribes once, and exactly one active subscription per descriptor throughout.
- G21. `resolveNoticeText` conformance: the shared vectors pass, and each typed error code suppresses the notice and emits exactly one bounded diagnostic. Include the 512-byte UTF-8 boundary, the no-trim case, and the no-truncate case.
- G22. TTL and severity render from the descriptor. A declared 10000 ms produces a 10000 ms toast, and each severity maps to its Ionic colour.
- G23. No-viewed-session proof: Web sends no subscription for a session-scoped descriptor when no session is viewed, and never substitutes an empty subject set.
- G24. Production wiring proof: with `notice_reactions` stripped from the encoded `list_packages` response, no subscription is sent and no toast appears. With it present, both happen. This proves the production path reads the descriptor rather than any residual constant.

## Vault gaps, revised in rev 2

Rev-1 gaps V1, V2, and V3 are now captured upstream in [[client notice reactions belong to package declarations not client constants]], [[question opened notices target the agent session subject]], and [[generic botster clients must not hardcode package event reactions]]. They no longer need new notes.

Remaining gaps:

- V4. Update the [[botster-web-playbook]] required gate that still tells Web to keep question subject filters empty and to filter workflow identity in the client. That gate now contradicts the merged contract.
- V5. A generic client mechanism shipped with no composed production reaction is unwired implementation. The human rejected that trade in `question_1787278509_823001`, and Plan Review independently blocked the rev-1 plan for the same class of gap at the adapter layer.
- V6 (new). A merged monorepo version bump is not a consumable client dependency. Node clients need the npm coordinate published, and a Rust Git tag does not supply it. This cost one blocker finding in this run.
- V7 (new). An adapter that builds an explicit allow-list record silently drops new protocol fields. Any additive DTO field needs a matching adapter passthrough before a consumer can see it.

---

# Revision 3

Revision 3 answers `review_1787363668_187959`. That review approved the architecture, the ownership boundary, the generic production wiring, and the downstream proof, and raised one product finding plus one process finding.

## Plan Review response (rev 2 -> rev 3)

| Finding | Severity | Response |
| --- | --- | --- |
| `finding_1787363668_207871` the plan pins the skipped hub-test-support release | high | Fixed. The release ticket deliberately skipped 0.1.40 and published 0.1.41 with conformance fixture revision 46. Rev 2 would have requested an artifact that does not exist. Every live pin now reads 0.1.41 and revision 46: the dependency table, G18, G19, the package pins below, and the rev-3 artifact payload. Verified independently by clean registry install, not by trusting the review. |
| `finding_1787363668_610561` the latest Plan completion evidence omits the plan artifact fields | info | Fixed procedurally. The rev-3 gate submission and advance request both carry `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, and `target_repository`. |

## Independent release verification

Performed on 2026-08-21 in an empty scratch directory, installing from the public registry rather than from a workspace link or the Hub source tree.

Registry listings:

- `@trybotster/hub-test-support` versions end `... 0.1.38, 0.1.39, 0.1.41`. There is no 0.1.40.
- `@trybotster/ui-contract` versions end `... 0.3.2, 0.3.3`.

Clean install of `@trybotster/hub-test-support@0.1.41` and `@trybotster/ui-contract@0.3.3`:

| Check | Observed |
| --- | --- |
| `metadata.json` package_version | `0.1.41` |
| `metadata.json` protocol_version | `7` |
| `metadata.json` conformance_fixture_revision | `46` |
| `metadata.json` ui_contract.package_version | `0.3.3` |
| `metadata.json` daemon_protocol.sha256 | `14121c4b1aa15f0728040b7ab3cc0189bf7720dc3159d994926d54e0251c5996` |
| Recomputed sha256 of the shipped `daemon-protocol.ts` | `14121c4b1aa15f0728040b7ab3cc0189bf7720dc3159d994926d54e0251c5996` — equal, so the declared hash matches the shipped file |
| `daemon-protocol.ts:609` | `notice_reactions?: PackageNoticeReactionDescriptor[];` |
| `@trybotster/ui-contract` runtime exports | `resolveNoticeText` is a function; `NOTICE_TEXT_MAX_BYTES` is `512`; `packageVersion` is `0.3.3` |

The reviewer's cited hash matches the recomputed hash exactly.

## Pins Implement must use

- `@trybotster/ui-contract@0.3.3`
- `@trybotster/hub-test-support@0.1.41`
- protocol_version 7
- conformance_fixture_revision 46
- `daemon-protocol.ts` sha256 `14121c4b1aa15f0728040b7ab3cc0189bf7720dc3159d994926d54e0251c5996`

Do not pin 0.1.40 or revision 45. Those values exist only in the Hub source tree at merge `12e0cc6` and were never published. Every earlier mention of them in this document is historical record, not a pin.

`README.md` and `docs/architecture.md` must state 0.1.41 and revision 46, because the charter requires those claims to equal installed Hub test-support metadata.

## Dependency status after rev 3

All three dependencies are closed:

| Ticket | Repository | Status |
| --- | --- | --- |
| `ticket_1787278643_145174` | `botster-hub` | closed — descriptor contract and `DaemonPackage` projection |
| `ticket_1787278658_151737` | `botster-project-pipelines` | closed — declaration and `payload.subject` emission |
| `ticket_1787351279_697528` | `botster-hub` | closed — npm publication, released as 0.1.41 rather than 0.1.40 |

The park is over. Nothing blocks Implement after Plan Review approves rev 3.

## Assumptions and risks changed in rev 3

- The rev-2 remaining unknown "the published npm tarball contents cannot be verified until the release closes" is now closed. The tarball is installed and verified, including the content hash.
- The descriptor contract itself is unchanged by the release. `notice_reactions`, the descriptor fields, `resolveNoticeText`, `NOTICE_TEXT_MAX_BYTES`, and protocol_version 7 are identical to what rev 2 recorded from the merge. Only the package version and the conformance fixture revision moved.
- R9 (new). A release can skip the version its source tree declares. Pinning a version read from a merged source tree, rather than from the registry, produces an uninstallable plan. Rev 2 made exactly that error. Implement must read pins from the registry and from installed metadata, never from an upstream `package.json` in a source checkout.

## Vault gaps added in rev 3

- V8 (new). A merged source-tree version is not the released version. A release can skip a version, so downstream pins must come from the registry and from installed metadata, not from the upstream source tree. This cost one high finding in this run, immediately after V6 cost a blocker for the same family of mistake.
