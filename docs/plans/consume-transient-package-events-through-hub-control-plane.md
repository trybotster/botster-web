# Web: consume transient package events through the Hub control plane

Revision 5. Revision 1 received `changes_required` from `review_1787199378_844970`. Revision 2 resolved those seven findings per `review_1787199881_585990`, which added one product finding backed by blocking human answer `question_1787199815_341943`. Revision 3 implemented that answer; `review_1787200524_407810` found its identity join relied on a field absent from the authoritative dependency, per blocking human answer `question_1787200489_788604`. Revision 4 registered upstream ticket `ticket_1787200634_776665` for the session binding. Revision 5 pins the now-merged binding contract: Project Pipelines 0.4.0 at `cd7c2f9`.

## Plan Review response (rev 4)

| Finding | Response |
| --- | --- |
| `finding_1787200524_862085` identity join uses an unpublished field | Fixed. Human answer `question_1787200489_788604` rules Project Pipelines 0.3.0 at `beaba94` authoritative; its published `run_step` contract is `{id, run_id, step_id, status}` (`RECORD_REQUIRED_FIELDS`), and the device template 1.1.0 field is runtime evidence, not a dependency. Web truly requires the session binding: no Web route carries workflow identity, so route-only filtering would leave the production notice with no resolvable identity anywhere, contradicting `question_1787199815_341943`. Per the human's conditional, upstream ticket `ticket_1787200634_776665` (Project Pipelines: publish versioned run_step session binding for client identity joins) is created on the Project Pipelines target `tgt_a72ca1a83d504385b8648f71409119ab` and registered as blocking dependency `dependency_1787200640_706784` of this ticket. The identity join consumes only that published, versioned contract. See the revised "Active workflow identity". |

## Plan Review response (rev 3)

| Finding | Response |
| --- | --- |
| `finding_1787199881_617942` production notice scope contradicts the human decision | Fixed. The unscoped production mode is removed. The production source of active workflow identity is the currently viewed session joined to Project Pipelines entity records; a view with no active workflow identity shows no transient notice. Production-path positive and negative tests are required in unit and live lanes. See "Active workflow identity (human decision)". |

## Plan Review response (rev 2)

| Finding | Response |
| --- | --- |
| `finding_1787199379_612718` subjects contract incomplete | Fixed. Loaded [[question opened clients subscribe with empty subjects]] and [[project-pipelines-playbook]]. The subscribe request now carries `subjects: []` explicitly. A client-side workflow-scope filter seam is planned with positive and negative `run_id` / `ticket_id` / `step_id` tests. See "Subscription contract". |
| `finding_1787199379_758031` teardown class misclassified | Accepted. `teardown_class_applies` is now **yes**. All seven required fields are answered below, including the late-message matrix, bounded release, and sibling policy, with the tests the reviewer named. |
| `finding_1787199379_921556` gap proof conditional | Fixed. A dedicated gap lane sets `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` to force at least one observed `event_gap`, per [[hub test support lacks package event producer fixtures]]. The lane fails when no gap is observed. |
| `finding_1787199379_967888` SPA request race omitted | Fixed. Unit and live checks now cover release-before-ack, disconnect-before-ack, late event after release, StrictMode-style acquire/release ordering, and exactly-one-active-subscription after reconnect. |
| `finding_1787199379_833641` gate evidence fields (process) | Fixed procedurally. The rev-2 gate submission and the advance request both carry `plan_uri`, `artifact_id`, `checklist_id`, `target_id`, and `target_repository` as structured evidence. |
| `finding_1787199379_870836` producer source | Fixed. The fixture derives from the checked-in Hub `examples/event-plane-producer` at hub commit `7a09292` (its `events.emit` producer path), carries the Project Pipelines contract verbatim from `botster-project-pipelines` commit `beaba94`, and records both source commits in the fixture README header. |
| `finding_1787199379_842080` budgets unnamed | Fixed. Four numeric budgets are named with authoritative sources, measured and failed separately, and published in `docs/architecture.md`. See "Published budgets". |

## Target repository and target

- Repository: `trybotster/botster-web`
- `target_id`: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Spawn target name: `booster-web` (Hub label); filesystem and GitHub identity are `botster-web`
- Assigned worktree: the Project Pipelines worktree for `ticket_1786663584_427840`
- Repository playbook: [[botster-web-playbook]]
- Botster layers: Ionic React client, WebRTC host-control connection, generated host DTO consumption, packaged-browser and live-Hub conformance
- Ticket: `ticket_1786663584_427840`; run `run_1787197984_591095`; pipeline `botster_stack_delivery` (direct merge, no PR)

Routing used `list_spawn_targets` against the ticket `target_id`. The ambient process directory was not the routing source.

## Runtime-teardown class (applies: yes)

**`teardown_class_applies`: yes.** The change adds an ownership-creating host-control message class (`subscribe_events`), extends `hasReconnectDemand()`, and manages holder release across WebRTC peer generations. Per [[botster runtime teardown lenses]], every required field follows.

**`teardown_isolation`.** The ownership set for one event subscription is: the Web-side holder record (spec, `subscription_id`, generation, listener) plus the Hub-side `(connection, subscription_id)` holder. One holder's failure — rejected subscribe, gap, or release — must not disturb entity subscriptions, terminal stream listeners, or other event holders. The registry is per-transport; a failed subscribe rejects only that holder's ready promise. Isolation is chosen; no shared resource forces sibling sacrifice.

**`teardown_bounds`.** Every `subscribe_events` / `unsubscribe_events` request is bounded by `requestTimeoutMs` = 10,000 ms (`localWebrtcResponseChunkLimits`, `src/botster/webrtcDaemonClient.ts`). Local release is synchronous: the holder leaves the registry immediately; the `unsubscribe_events` RPC is best-effort, bounded by the same timeout, with rejection swallowed. Disconnect runs through `resetPeerState`, which clears holder generation state synchronously and never blocks on a remote acknowledgement. The hard stop is peer close plus registry clear: delivery ends even when Hub never acknowledges.

**`late_message_matrix`.** Ownership-creating messages on the shared host-control connection, each with tag, reject, and sweep:

| Message | Owner tag | Reject after terminal failure | Sweep on race |
| --- | --- | --- | --- |
| `attach` (existing) | `session_id` + `subscription_id` + `coreGeneration` | stale terminal frames and closed events discarded with recorded reason | `abandon()` removes the listener; `resetPeerState` bumps the delivery epoch |
| `subscribe_entities` (existing) | `entityType` + per-generation `subscription_id` | ack for a superseded generation ignored via `subscription.generation` check | `resetPeerState` clears generation, id, and `snapshot_seq` |
| `subscribe_events` (new) | per-generation fresh UUID `subscription_id` in the holder registry | ack arriving after release or after a generation change is ignored: the holder is marked closed on release and acks check holder liveness and generation; a late ack must not resurrect the holder or reconnect demand | `resetPeerState` clears holder generation state; `package_event` / `event_gap` with an unknown or stale `subscription_id` is discarded with a recorded harness reason |
| `unsubscribe_events` (new) | targets the holder's current `subscription_id` | failure or timeout is swallowed; the local holder is already gone | Hub sweeps the remaining server-side holder on connection cleanup per [[Client event holders are connection-scoped]] |

Both queue orders are covered: event-then-reset (generation check on delivery) and reset-then-event (unknown id discard).

**`production_path_proof`.** Exact production path: route unmount or connection release → transport releases the holder (registry removal, closed flag) → best-effort `unsubscribe_events` when the channel is live → `disconnect` → `resetPeerState` → `hasReconnectDemand()` returns false → no reconnect attempt. Live oracles: after final route release the harness ledger shows no new WebRTC reconnect attempts and no further `daemon_event` deliveries for the released id; unit oracle: the fake bridge records that no `subscribe_events` follows release and that reconnect demand is absent. Red-on-revert control: removing the registry clear from the release path must fail the no-residual-demand assertion.

**`ownership_identity`.** Holder identity is `(peerGeneration, subscription_id)` with a fresh UUID per generation. A stale id never routes into a new generation's holder. Reused public ids across connections are Hub-separated by private connection identity ([[Client event holders are connection-scoped]]); Web never reuses a UUID across generations.

**`sibling_fail_closed_policy`.** On successful release or subscribe failure of one event holder: entity subscriptions, terminal streams, and other event holders keep working (tested). On ultimate failure (unsubscribe never acknowledged, channel dead): the local holder is already removed, the Hub-side holder dies with connection cleanup, and no sibling is sacrificed; the blast radius is bounded by `requestTimeoutMs`.

## Playbooks and notes loaded

### Role and charter

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]
- [[botster-architecture]]
- [[cli-patterns]] (mixed-generation index; used only as a pointer map)
- [[spa-patterns]]
- [[botster runtime teardown lenses]] (class applies; all fields answered above)
- [[project-pipelines-playbook]] — loaded in rev 2. The `question.opened` client contract is Project Pipelines-owned policy: `subjects: []` plus client-side `run_id` / `ticket_id` / `step_id` filtering, nonempty subject filters rejected. This ticket still changes no Project Pipelines package path.

### Targeted atomic notes

Event plane contract:

- [[Client event subscriptions stay on the multiplexed host-control path]] — `SubscribeEvents` is an ordinary one-shot host request; delivery is unsolicited `DaemonEvent::PackageEvent` / `DaemonEvent::EventGap`; events never use the entity mailbox.
- [[Client event holders are connection-scoped]] — Hub keys holders by private connection identity plus caller `subscription_id`; reconnect creates a new holder.
- [[exact owner plus name is the only package event subscription key]] — no wildcards; exact strings only.
- [[Package-event subject filters are exact strings compiled at admission]] — a missing `payload.subject` cannot match a nonempty subject set.
- [[question opened clients subscribe with empty subjects]] — `question.opened` has no `subject` field, so consumers must send `subjects: []` and filter workflow ids client-side; a nonempty subject list receives nothing.
- [[hub test support lacks package event producer fixtures]] — revision 44 ships no producer helper; consumers use Hub-local helpers or `examples/event-plane-producer`, and `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` forces deterministic gaps.
- [[WebRTC host events use unsolicited daemon-event delivery]] — WebRTC carries host events as `DaemonLocalWebrtcDeliveryKind::DaemonEvent`.
- [[Fair host-control writing selects already-admitted frames]] — Hub-side fairness across control, entity, and event frames (shipped in the parent).
- [[package event contracts live on HubPackageManifest not Core PackageManifest]] — producer contracts are declared in `botster-package.json` `events.emitted`.
- [[events.emit is a non-blocking router ingress not an owner-pumped host bridge]] — producers can shed; consumers must tolerate loss.
- [[a transient package event cannot be the sole authority for a durable close]] — durable state lives on package persistence and entity planes; this plan applies the consumer-side mirror.
- [[hub event pressure needs bounded flood regressions]] — flood behavior needs an explicit bounded regression.

Web charter and transport:

- [[WebRTC adapter admission uses a Hello feature string not a generated DTO token]] — the capability gates on the `package_event_subscriptions` Hello feature string.
- [[botster spa has one route owned hub control plane connection]] — the event subscription belongs to the route-owned connection.
- [[botster browser pull requests must retry after webrtc reconnect]] and [[reused browser transports replay the live hub mode]] — reconnect replay obligations.
- [[a page reload is not a reconnect]] — reconnect proof closes and reopens the real DataChannel on one document.
- [[botster web dto field names must match authoritative rust serde structs]] and [[botster web generated protocol drift checks need explicit hub artifact paths]] — DTO consumption discipline.
- [[closed dependency tickets signal merged source not a consumable release]] — artifact availability verified directly (below).
- [[botster web pinned hub test support claims span readme and architecture docs]] — the pin bump updates both `README.md` and `docs/architecture.md`.
- [[botster web uses vanilla ionic primitives by default]] — the transient notice uses `IonToast`.
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]] — the lanes must pin their own hub, required anyway by the gap lane's env var.
- [[Protocol 7 gates WebRTC daemon events on close-event Hello negotiation]] — precedent for negotiated daemon-event delivery.

## Context loaded (source evidence)

- Ticket, run, gates, dependencies, review `review_1787199378_844970` and its seven findings via `project_pipelines_current_context`. All three dependencies are closed: Hub client event subscriptions (`ticket_1786663583_640263`), Project Pipelines `question.opened` producer (`ticket_1786663583_568924`), Web protocol planes (`ticket_1786661008_897067`).
- **Artifact availability verified directly**: `npm pack @trybotster/hub-test-support@0.1.39` unpacked and inspected. `daemon-protocol.ts` contains `subscribe_events` (with optional `subjects`), `unsubscribe_events`, response kinds `event_subscribed` / `event_unsubscribed`, and `DaemonEvent` variants `package_event` / `event_gap`. `metadata.json`: protocol 7, conformance revision 44.
- Hub protocol contract: `botster-hub` `docs/client-protocol.md` "Package event subscriptions" (merge `7a09292`). Optional host feature `package_event_subscriptions`; Hello with it as a required feature; protocol stays 7; revision advances to 44; no public sequence, cursor, replay, or history field.
- Producer contract: `botster-project-pipelines` commit `beaba94` `botster-package.json` lines 127–143 declare `question.opened`, audience `["clients","plugins"]`, payload `{question_id (required), kind (required, human|agent), notice (required, ≤280 chars), blocking, run_id?, step_id?, ticket_id?}`, `additionalProperties: false`, **no `subject` field**. `plugin.lua` emits after the durable `save_state` commit.
- Producer example: `botster-hub` `examples/event-plane-producer` at `7a09292` — manifest `events.emitted` declaration plus a registered tool whose handler calls `events.emit(name, payload)` from the plugin worker VM.
- **Admitted owner string verified live**: `list_plugins` shows the plugin name `project-pipelines`. The ticket phrase "botster-project-pipelines" names the repository; the event owner key is the package name.
- botster-web worktree at `origin/main` (`855ccd0`), clean, `.gitignore` intact. Seams read: `src/botster/protocolPlanes.ts`, `src/botster/webrtcDaemonClient.ts` (`receiveHostEvent`, entity resubscribe machinery, the then-current shared-control terminal backlog, and `requestTimeoutMs: 10_000`), `src/botster/hubTransport.ts`, `src/botster/protocol.ts`, `src/app/useProductionHubConnection.ts`, `src/app/dialogs/WorkbenchNotifications.tsx`, `scripts/check-daemon-protocol-drift.mjs`, `scripts/live-packaged-protocol-harness.mjs` (lane flags, 15,000 ms standing waits, `fixtures/entity-options-reactive` surface-action trigger precedent, `__BOTSTER_LIVE_PROTOCOL_HARNESS__.listEntities` durable oracle). Ticket `ticket_1787600676_914408` later removed that terminal backlog when terminal delivery moved to per-subscription channels.
- Current pins: `@trybotster/hub-test-support@0.1.36` (revision 41 claims at `README.md:11` and `docs/architecture.md:55-56`), `@trybotster/ui-contract@0.3.2`, `@trybotster/terminal-protocol@0.1.0`.

## Subscription contract (rev 2)

The subscribe request is exactly:

```json
{ "type": "subscribe_events", "subscription_id": "<uuid>", "owner": "project-pipelines", "name": "question.opened", "subjects": [] }
```

`subjects: []` is explicit and required: the payload schema has no `subject` field, so a nonempty subject set would receive nothing ([[question opened clients subscribe with empty subjects]]). The unit oracle pins this exact body — no sequence, cursor, replay, or history field, and `subjects` present as an empty array.

**Workflow-scope filter.** Every delivered `question.opened` payload passes through one pure filter seam (for example `questionOpenedNoticeFromEvent(payload, identity)`):

1. Validity: `question_id`, `kind`, and `notice` must be present with the declared types; ids present with wrong types reject the payload.
2. Identity match: `identity` is `{ run_id?, ticket_id?, step_id? }` resolved from the active view (next section). The notice shows only when at least one payload workflow id equals the corresponding identity field.
3. **No identity, no notice**: when the active view resolves no workflow identity, the filter rejects every payload. There is no unscoped production mode.

## Active workflow identity (human decision)

Blocking human answer `question_1787199815_341943`: show the notice only when its `run_id`, `ticket_id`, or `step_id` matches the identity owned by the current route or view; a view with no active workflow identity shows no transient notice; an unscoped Hub workbench is not permission for device-wide notices.

**Production identity source.** The identity owner is the currently viewed session:

- The session route `/sessions/:sessionId` and the workbench's selected session view resolve to one viewed session uuid through a single selector.
- The consumer joins that uuid to Project Pipelines entity records consumable through the shared entity store and generic selectors: a `project-pipelines.run_step` record whose published session binding (`agent_session_uuid`) equals the viewed session uuid yields `run_id` and `step_id`; the matching `project-pipelines.run` record yields `ticket_id`.
- While a session view is active, the consumer holds entity demand for `project-pipelines.run_step` and `project-pipelines.run` through the existing generic `entity_pull` / `entity_release` held-subscription mechanism (the entity-options demand path). No new hydration machinery is added.

**Authoritative binding dependency (human decision `question_1787200489_788604`).** The authoritative Project Pipelines artifact is the registered dependency at commit `beaba94`, package 0.3.0, whose published `run_step` contract is `{id, run_id, step_id, status}` — it does not publish `agent_session_uuid`. The active device template 1.1.0 carries the field but is runtime evidence, not a stable Web dependency. Web truly requires the session binding: no Web route carries workflow identity, so route-only filtering would leave the production notice with no resolvable identity, contradicting `question_1787199815_341943`. Therefore:

- Upstream ticket `ticket_1787200634_776665` (blocking dependency `dependency_1787200640_706784`) is **closed**: merged into Project Pipelines main at `cd7c2f9`, package version **0.4.0**. The merged contract publishes `agent_session_uuid` on `project-pipelines.run_step` entity snapshots and documents it in the plugin README as the join `question.opened` consumers use to match a viewed session to `run_id`, `step_id`, and `ticket_id`.
- The field is **optional**: visits exist before any spawn, non-PTY steps never gain a session, and a spawn response can omit a session id. The Web consumer treats a `run_step` without the binding as resolving no identity — no notice — which is the same fail-safe as the no-identity rule.
- The Web identity join consumes only this published contract at PP ≥ 0.4.0 / `cd7c2f9`. Implement verifies the field against that merged source — never against the device template.
- The live fixture mirrors the 0.4.0 `run_step` / `run` record shapes and records `cd7c2f9` in its README header.

**Identity lifetime.** The identity derives from the current route/view plus the entity store, recomputes on route or entity change, and clears on navigation or unmount. A late event after navigation resolves no identity and shows nothing. Dashboard, apps, settings, and Project Pipelines surface routes without a viewed session resolve no identity and show no notice; the durable question and attention UI on those surfaces stays package-entity driven and is unaffected.

Unit tests drive the production seam both ways: positive (a payload matching the resolved `run_id` / `ticket_id` / `step_id` produces a notice) and negative (non-matching ids, payloads without workflow ids, and views without identity produce none). The live lane proves the same through the production path (below).

## Scope

1. **Pin and vendor.** Bump `@trybotster/hub-test-support` to `0.1.39`. Re-vendor `src/botster/generated/daemon-protocol.ts` byte-identical. Update pin and revision claims in `README.md` and `docs/architecture.md` (41 → 44, 0.1.36 → 0.1.39), and publish the event-plane budgets (below) in `docs/architecture.md`.
2. **Hello negotiation.** Add `"package_event_subscriptions"` to `requiredHostFeatures` in `src/botster/protocolPlanes.ts`; the revision minimum follows the installed metadata to 44.
3. **WebRTC bridge event subscriptions.** Generation-scoped holder registry in `src/botster/webrtcDaemonClient.ts` per the teardown answers above: fresh UUID per generation, `subscribe_events` after connect and Hello, `event_subscribed` expected within `requestTimeoutMs`, resubscribe with a fresh id after reconnect, best-effort bounded `unsubscribe_events` on release, registry counted by `hasReconnectDemand()`, release marks the holder closed so a late ack cannot resurrect it. `receiveHostEvent` routes `package_event` / `event_gap` to the matching current-generation holder; mismatches are discarded with a recorded reason. Event delivery never enters `enqueueTerminalDelivery` and never awaits consumers on the DataChannel message path.
4. **Transport frame plane.** `DaemonBridgeClient.subscribePackageEvents?` (owner, name, subjects). Outbound `HubControlFrame` kinds `events_subscribe` / `events_release` held in `createHubTransport` like generic entity demand. Inbound frames: `package_event` `{owner, name, payload}` and `event_gap` `{owner, name}`.
5. **Concrete consumer.** From the route-owned production connection: one `events_subscribe` for `project-pipelines` / `question.opened` / `subjects: []`. Deliveries pass the workflow-scope filter seam against the active workflow identity resolved from the viewed session (human decision above); a passing payload shows one transient notice through a dedicated `IonToast` (bounded `notice` text, fixed duration, no persistence, no navigation). Views without identity show no notice. `event_gap`: drop transient reactions, record a connection diagnostic, never touch entity state, never show an error UI.
6. **Proof.** Unit coverage in `src/App.test.mjs`; live packaged lanes (`BOTSTER_LIVE_PACKAGE_EVENTS=1`, plus the forced-gap sub-lane) with the fixture producer under `fixtures/package-events/`; this plan document.

## Non-scope

- No change to the durable question or attention UI; Project Pipelines surfaces keep rendering durable question state from package entity state.
- No generic notification framework, no per-event settings, no configurability beyond the one concrete subscription plus the filter seam the contract requires.
- No Hub, Core, or Project Pipelines changes. No new protocol semantics.
- No terminal-plane work: no Hub-specific terminal logic, no terminal adapter frame inspection or scheduling.
- No event persistence, no stored event ids, no replay or history requests.

## Ownership boundaries and cross-repo dependencies

| Concern | Owner | Status |
| --- | --- | --- |
| Event admission, exact owner+name filters, shedding, gap production, host-control fairness | botster-hub | Shipped (`7a09292`, ticket closed) |
| Generated DTOs and conformance metadata | `@trybotster/hub-test-support@0.1.39` on npm | Published; content verified at plan time |
| `question.opened` contract, emit-after-commit, client contract policy (`subjects: []` + workflow-id filtering) | botster-project-pipelines | Shipped (`beaba94`, ticket closed); policy recorded in [[project-pipelines-playbook]] |
| Producer example and gap-forcing env (`examples/event-plane-producer`, `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX`) | botster-hub | Checked in at `7a09292` |
| Independent Hub control / Core terminal planes in Web | botster-web (parent ticket) | Shipped (closed) |
| Published `run_step` session binding (`agent_session_uuid`) for the identity join | botster-project-pipelines | Shipped: `ticket_1787200634_776665` closed, merged at `cd7c2f9`, package 0.4.0 (field optional; documented as the `question.opened` consumer join) |
| Subscription client lifecycle, reconnect resubscribe, gap handling, identity resolution, filter seam, transient notice UI | botster-web | **This ticket** |

One registered cross-repository prerequisite (the session-binding ticket above), created per human answer `question_1787200489_788604` on the dependency repository target rather than broadening this run. Live-proof requirement: the harness Hub must be at or after `7a09292` (advertises `package_event_subscriptions`, honors `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX`); the lanes fail with an explicit message otherwise and must spawn a pinned hub, not attach to an ambient one.

## Assumptions and unknowns

1. **Owner string.** The subscription owner is the admitted package name `project-pipelines` (verified via `list_plugins` and the manifest). The ticket's "botster-project-pipelines" is the repository name.
2. **Fixture producer derivation.** The live fixture package under `fixtures/package-events/` is named `project-pipelines`, derives its producer path from the checked-in Hub `examples/event-plane-producer` at `7a09292` (manifest `events.emitted` declaration plus a handler calling `events.emit(name, payload)` in the plugin worker VM), carries the `question.opened` contract verbatim from `beaba94`, persists a durable question entity record before emitting (commit-then-emit), and adds a surface-action trigger following the `fixtures/entity-options-reactive` precedent so the browser harness drives emission through the production action path. For the identity join, the fixture also publishes `project-pipelines.run_step` and `project-pipelines.run` records binding the harness's viewed session uuid (`agent_session_uuid`) to a known `run_id` / `step_id` / `ticket_id`, mirroring the record shape published by Project Pipelines 0.4.0 at `cd7c2f9` (recorded in the fixture README header). Both source commits are recorded in the fixture README header. The harness hub is isolated, so the name cannot collide with a real installation.
3. **Required Hello feature.** `package_event_subscriptions` becomes a required host feature (precedent: `terminal_subscription_closed`; direct-merge lockstep family). New Web refuses pre-`7a09292` Hubs; the failure must read as a Hub-version incompatibility.
4. **Notice scope and binding are settled, not assumed.** Human answer `question_1787199815_341943` fixes the scope (active-view identity matching, no notice without identity). Human answer `question_1787200489_788604` fixes the binding authority, delivered by `ticket_1787200634_776665`: Project Pipelines 0.4.0 at `cd7c2f9` publishes the optional `run_step.agent_session_uuid` binding Web consumes. Implement verifies the field against that merged source, never against the device template.
5. **Notice placement.** The toast mounts beside the existing `WorkbenchNotifications` as a separate `IonToast`; exact placement is an Implement detail.

## Published budgets (rev 2)

The flood and gap lanes measure and fail each budget separately, and `docs/architecture.md` publishes all four as the Web event-plane budgets:

| Budget | Value | Authoritative source |
| --- | --- | --- |
| Terminal delivery assembly | 1 message per terminal channel | `TerminalChannelBinding.assembly`, `src/botster/webrtcDaemonClient.ts` — event traffic stays on the control channel and cannot consume this per-terminal state |
| Host request round-trip | 10,000 ms | `localWebrtcResponseChunkLimits.requestTimeoutMs` — a control request issued mid-flood must resolve inside this bound |
| Entity reconciliation deadline | 15,000 ms | The harness's standing 15,000 ms wait ceilings in `scripts/live-packaged-protocol-harness.mjs` — the durable question entity mutated during flood must converge inside this bound, measured and recorded |
| Terminal echo round-trip deadline | 15,000 ms | Same harness ceiling — a terminal input echo completed during flood must round-trip inside this bound, measured and recorded |

## Affected surfaces and files

- `package.json`, `package-lock.json` — pin 0.1.39; `smoke:package-events` script (and the forced-gap invocation).
- `src/botster/generated/daemon-protocol.ts` — re-vendored artifact.
- `src/botster/protocolPlanes.ts` — `package_event_subscriptions` host feature.
- `src/botster/webrtcDaemonClient.ts` — holder registry, `receiveHostEvent` routing, reconnect demand, bounded release, harness records.
- `src/botster/hubTransport.ts` — `subscribePackageEvents?`, `events_subscribe` / `events_release`, `package_event` / `event_gap` projection.
- `src/botster/protocol.ts` — new `HubControlFrameKind` members.
- `src/app/useProductionHubConnection.ts` plus a small helper (for example `src/app/packageEventNotices.ts` with the filter seam and the active-workflow-identity selector joining the viewed session to `project-pipelines.run_step` / `project-pipelines.run` records) — subscription, identity resolution, filtering, notice state, gap diagnostic, held entity demand on session views.
- `src/app/workbench.tsx` / `src/app/WorkbenchDialogs.tsx` (or `WorkbenchShell.tsx`) — notice toast mount.
- `src/App.test.mjs` — unit coverage including the race and teardown matrix.
- `scripts/live-packaged-protocol-harness.mjs` — `BOTSTER_LIVE_PACKAGE_EVENTS=1` lane plus the forced-gap sub-lane.
- `fixtures/package-events/botster-package.json`, `fixtures/package-events/plugin.lua`, fixture README header with source commits.
- `README.md`, `docs/architecture.md` — pin/revision claims and published budgets.
- `docs/plans/consume-transient-package-events-through-hub-control-plane.md` — this plan.

## Risks

1. **Drift-gate byte-equality** on the re-vendored protocol; copy from `node_modules`, never hand-edit.
2. **Revision jump 41 → 44** makes stale local Hubs fail Hello; must surface as a Hub-version failure, not a timeout.
3. **Flood-induced render churn**; bounded by the single subscribed owner/name, the filter seam, coalescing notice state, and the flood budgets.
4. **Toast contention** with `packageActionToast`; separate instance, checked during Implement.
5. **Reconnect and release races**; covered by the teardown matrix tests and the live DataChannel close/reopen on one document.
6. **Ambient-hub sensitivity**; lanes spawn a pinned hub (mandatory for the gap env var) and fail loudly on a feature-less hub.
7. **Gap mis-handling**; diagnostic-only path, unit plus forced-gap live coverage.
8. **Fixture drift from the shipped producer path**; mitigated by deriving from the checked-in example and recording source commits.
9. **Identity binding contract discipline.** The binding shipped (PP 0.4.0, `cd7c2f9`) and is optional per its contract; the fixture and the join must follow that merged contract exactly, including the missing-binding fail-safe (no identity, no notice). Consuming the device template instead of the merged contract is a reject. Holding entity demand on session views adds one held generic subscription pair; it reuses the existing demand machinery and releases on unmount.

## Acceptance checks and tests

Repository gates:

1. `npm run typecheck`, `npm run lint`, `npm test` (drift check + `App.test.mjs`), `npm run build`.

Unit coverage (`src/App.test.mjs`, fake transport/bridge):

2. Connect issues exactly one `subscribe_events` per connection generation with the exact body `{type, subscription_id, owner: "project-pipelines", name: "question.opened", subjects: []}` — `subjects` present and empty; no sequence, cursor, replay, or history field.
3. Filter seam and identity positive/negative through the production path: with a viewed session whose `project-pipelines.run_step` / `project-pipelines.run` records resolve an identity, a payload matching `run_id`, `ticket_id`, or `step_id` produces a notice; non-matching ids, payloads without workflow ids, and views without identity (no session viewed, or no matching run_step record) produce none; identity clears on navigation, so a late event after route change produces nothing; invalid payloads (missing `question_id` / `notice`, wrongly typed ids) are rejected without a crash; session views hold and release the `project-pipelines.run_step` / `project-pipelines.run` entity demand.
4. A matching `package_event` produces one transient notice; a different owner or name produces nothing.
5. `event_gap` produces no notice and no entity mutation; durable entity records remain readable.
6. Reset then reconnect issues a new `subscribe_events` with a different `subscription_id`; a `package_event` or ack carrying the old id is discarded.
7. **Request race:** release-before-ack — releasing the holder while `subscribe_events` awaits its ack leaves no holder, no notice on a late event, and no reconnect demand; disconnect-before-ack behaves the same; a late ack after release cannot resurrect the holder; StrictMode-style acquire/release/acquire ordering ends with exactly one active subscription; after reconnect exactly one subscription is active.
8. **Teardown matrix:** release during in-flight subscribe (above); stale ack ignored; stale event discarded; disconnect completes without waiting on any remote ack (bounded by `requestTimeoutMs` at most); no residual reconnect demand after final release (red-on-revert: removing the registry clear fails this); sibling health — entity subscription and terminal stream listeners survive event-holder release and failure.

Live packaged proof (real WebRTC, final independent Hub control and Core terminal planes, pinned hub ≥ `7a09292`):

9. Hello with `package_event_subscriptions` accepted; explicit failure naming the Hub version when the feature is absent.
10. The fixture commits a durable question entity, then emits; the browser shows exactly one transient notice, proven by the structured harness event ledger plus a DOM oracle.
11. Identity live check through the production path: with the harness's shared session viewed and the fixture's `run_step` / `run` records binding that session, an event carrying the bound `run_id` shows the notice; an event with a different `run_id` shows none; after navigating to a view without identity (dashboard), a further event shows none while the durable question entity stays visible.
12. Missed event: emit while the DataChannel is closed (harness `closeDataChannel`, one surviving document); after reconnect the durable entity is visible via `listEntities` / entity pull, no notice replays, and the fresh subscription receives a later live event.
13. **Forced gap lane:** hub spawned with `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` set low; burst emit; the lane requires at least one observed `event_gap` in the ledger (fails when none is observed), proves transient reactions stop for shed events, and proves the durable question entity remains visible.
14. **Flood with named budgets:** ≥200-event burst; each published budget above is measured and failed separately — no terminal backlog overflow, a mid-flood control request inside 10,000 ms, entity convergence inside 15,000 ms, terminal echo inside 15,000 ms; notice count never exceeds emitted count.
15. Terminal isolation: harness records show event traffic only as `daemon_event` deliveries; no terminal adapter frames and no terminal-queue involvement from events.
16. Teardown/live: after final route release, no further reconnect attempts and no `daemon_event` deliveries for the released subscription appear in the ledger.

Downstream/documentation proof:

17. `README.md` and `docs/architecture.md` claims match the installed `metadata.json` (source-derived check), and `docs/architecture.md` publishes the event-plane budgets.
18. Production entry point proof: the subscription and identity resolution are issued from the route-owned production connection path (`useProductionHubConnection`), not only from harness code.
19. Dependency contract proof: the publishing contract is Project Pipelines 0.4.0 at merge `cd7c2f9` (from `ticket_1787200634_776665`). Implement verifies `run_step.agent_session_uuid` against that merged source (never the device template) before the join lands, and the unit matrix covers the optional-binding case: a `run_step` without the field resolves no identity and shows no notice.

## Vault gaps worth capturing

1. **Package event owner strings are admitted package names, not repository names** (`project-pipelines` vs `botster-project-pipelines`).
2. **Web package-event notices are transient; entity state is the only durable authority** — consumer-side mirror of [[a transient package event cannot be the sole authority for a durable close]].
3. **hub-test-support 0.1.39 / revision 44 is the package-event DTO cutover for Web.**
4. **Web event-plane budgets and where they are published** — once the numbers land in `docs/architecture.md`, capture the pattern of naming numeric budgets for flood lanes.
5. If the forced-gap env plumbing through the harness-spawned hub is awkward, capture the working recipe.
