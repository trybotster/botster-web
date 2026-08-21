# Web: remove Project Pipelines coupling from the generic package-event client

Revision 1.

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
- `src/app/packageEventNotices.ts`, `src/app/usePackageEventNotices.ts`, `src/App.tsx`, `src/app/dialogs/WorkbenchDialogs.tsx`, `src/app/dialogs/WorkbenchNotifications.tsx`.
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

- No change to `src/botster/hubTransport.ts` or `src/botster/webrtcDaemonClient.ts` subscription mechanics beyond passing a declared spec.
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
- Any change to transport subscription mechanics beyond passing the declared spec.

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
- `src/app/dialogs/WorkbenchNotifications.tsx` and `src/app/dialogs/WorkbenchDialogs.tsx` — declared TTL and severity replace the fixed 5000 ms default.
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

- G3. `grep -rn "project-pipelines\|question\.opened\|question_id\|run_step\|ticket_id" src/` returns no match in production source. Matches are allowed only in optional conformance fixtures and their tests.
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
