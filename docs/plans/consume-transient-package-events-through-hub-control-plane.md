# Web: consume transient package events through the Hub control plane

## Target repository and target

- Repository: `trybotster/botster-web`
- `target_id`: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Spawn target name: `booster-web` (Hub label); filesystem and GitHub identity are `botster-web`
- Assigned worktree: the Project Pipelines worktree for `ticket_1786663584_427840`
- Repository playbook: [[botster-web-playbook]]
- Botster layers: Ionic React client, WebRTC host-control connection, generated host DTO consumption, packaged-browser and live-Hub conformance
- Ticket: `ticket_1786663584_427840`; run `run_1787197984_591095`; pipeline `botster_stack_delivery` (direct merge, no PR)

Routing used `list_spawn_targets` against the ticket `target_id`. The ambient process directory was not the routing source.

## Runtime-teardown class determination

**Class applies: no.** Reasoning against each trigger in [[botster runtime teardown lenses]]:

- The ticket does not change WebRTC peer lifecycle, signaling, or peer maps. It adds one new request pair (`subscribe_events` / `unsubscribe_events`) on the existing host-control connection.
- The ticket does not change Session, ClientWorker, or SessionIo teardown. It forbids terminal adapter work explicitly.
- The ticket leaves no OS resources at risk on the Web side. The worst residual is a JavaScript listener, and the existing peer-generation guards already discard stale deliveries.
- Hub-side holder cleanup already shipped in the parent ticket: [[Client event holders are connection-scoped]] records that connection cleanup drops that connection's holders only.

Three behaviors that superficially resemble the class are planned and proven as ordinary acceptance checks instead:

1. **Late-message policy.** A `package_event` or `event_gap` whose `subscription_id` does not match a live current-generation holder is discarded with a recorded harness event, mirroring the shipped `terminal_subscription_closed` discard path.
2. **Ownership across reconnect.** Each peer generation creates a fresh `subscription_id`. A stale generation's id never routes into a new generation's holder.
3. **Fail-safe under pressure.** A gap or a missed event degrades to "no transient notice." Durable question state stays entity-driven and cannot be hidden by event loss.

Plan Review may force the class; these answers map directly onto the isolation, late-message, and ownership lenses if it does.

## Playbooks and notes loaded

### Role and charter

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]
- [[botster-architecture]]
- [[cli-patterns]] (mixed-generation index; used only as a pointer map)
- [[spa-patterns]]
- [[botster runtime teardown lenses]] (loaded to make the class determination above)

This ticket is not a consumer of Hub session-type eligibility work. The parents are the Hub client-event subscription ticket, the Project Pipelines `question.opened` producer ticket, and the Web protocol-planes ticket. Do not inject `list_session_types_for_target` / spawn Option A.

[[project-pipelines-playbook]] was not loaded. The ticket consumes a Project Pipelines event contract but changes no Project Pipelines package or plugin path and no workflow policy.

### Targeted atomic notes

Event plane contract:

- [[Client event subscriptions stay on the multiplexed host-control path]] — `SubscribeEvents` is an ordinary one-shot host request; delivery is unsolicited `DaemonEvent::PackageEvent` / `DaemonEvent::EventGap`; events never use the entity mailbox.
- [[Client event holders are connection-scoped]] — Hub keys holders by private connection identity plus caller `subscription_id`; reconnect creates a new holder.
- [[exact owner plus name is the only package event subscription key]] — no wildcards; exact strings only.
- [[Package-event subject filters are exact strings compiled at admission]] — optional exact subject set; v1 ceilings (16 values / 256 B / 4096 B / 64 subscriptions per connection).
- [[WebRTC host events use unsolicited daemon-event delivery]] — WebRTC carries host events as `DaemonLocalWebrtcDeliveryKind::DaemonEvent`.
- [[Fair host-control writing selects already-admitted frames]] — Hub-side fairness across control, entity, and event frames (shipped in the parent).
- [[package event contracts live on HubPackageManifest not Core PackageManifest]] — producer contracts are declared in `botster-package.json` `events.emitted`.
- [[events.emit is a non-blocking router ingress not an owner-pumped host bridge]] — producer side can shed; consumers must tolerate loss.
- [[a transient package event cannot be the sole authority for a durable close]] — durable state lives on package persistence and entity planes; events stay notices. This plan applies the consumer-side mirror of that rule.
- [[hub event pressure needs bounded flood regressions]] — flood behavior needs an explicit bounded regression, not an assumption.

Web charter and transport:

- [[WebRTC adapter admission uses a Hello feature string not a generated DTO token]] — the new capability gates on the `package_event_subscriptions` Hello feature string.
- [[botster spa has one route owned hub control plane connection]] — the event subscription belongs to the route-owned connection, not to leaf views.
- [[botster browser pull requests must retry after webrtc reconnect]] and [[reused browser transports replay the live hub mode]] — reconnect replay obligations.
- [[a page reload is not a reconnect]] — reconnect proof must close and reopen the real DataChannel on one document.
- [[botster web dto field names must match authoritative rust serde structs]] and [[botster web generated protocol drift checks need explicit hub artifact paths]] — DTO consumption discipline.
- [[closed dependency tickets signal merged source not a consumable release]] — artifact availability was verified directly (below), not inferred from closed tickets.
- [[botster web pinned hub test support claims span readme and architecture docs]] — the pin bump must update both `README.md` and `docs/architecture.md`.
- [[botster web uses vanilla ionic primitives by default]] — the transient notice uses `IonToast`.
- [[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]] — live-lane environment sensitivity.
- [[Protocol 7 gates WebRTC daemon events on close-event Hello negotiation]] — precedent for negotiated daemon-event delivery.

## Context loaded (source evidence)

- Ticket, run, gates, dependencies via `project_pipelines_current_context`. All three dependencies are closed: Hub client event subscriptions (`ticket_1786663583_640263`), Project Pipelines `question.opened` producer (`ticket_1786663583_568924`), Web protocol planes (`ticket_1786661008_897067`).
- **Artifact availability verified directly** (per [[closed dependency tickets signal merged source not a consumable release]]): `npm pack @trybotster/hub-test-support@0.1.39` was unpacked and inspected at plan time. Its `daemon-protocol.ts` contains `subscribe_events`, `unsubscribe_events`, response kinds `event_subscribed` / `event_unsubscribed`, and `DaemonEvent` variants `package_event` / `event_gap`. Its `metadata.json` reports protocol_version 7 and `conformance_fixture_revision` 44. Version 0.1.38 (revision 43) also carries the tokens; 0.1.39 is latest and is the chosen pin.
- Hub protocol contract: `botster-hub` `docs/client-protocol.md` "Package event subscriptions" section (merge `7a09292`). `package_event_subscriptions` is an optional host-control feature; clients that want live package events Hello with that required feature. `PROTOCOL_VERSION` stays 7. Advertising the feature advances the conformance fixture revision to 44. No public sequence, cursor, replay, or history field exists.
- Producer contract: `botster-project-pipelines` `botster-package.json` declares `events.emitted` entry `question.opened` with audience `["clients","plugins"]` and payload schema `{question_id (required), kind (required, human|agent), notice (required, ≤280 chars), blocking, run_id?, step_id?, ticket_id?}`. `plugin.lua` emits it after the durable `save_state` commit. The payload has **no `subject` field**, so subject filters must not be used.
- **Admitted owner string verified live**: `list_plugins` on the running hub shows the plugin name `project-pipelines`. The ticket phrase "botster-project-pipelines" names the repository; the event owner key is the package name `project-pipelines`.
- botster-web worktree at `origin/main` (`855ccd0`), clean, `.gitignore` intact (14 lines). Key seams read: `src/botster/protocolPlanes.ts` (Hello requirements derive from installed hub-test-support metadata), `src/botster/webrtcDaemonClient.ts` (`receiveHostEvent` currently handles only `terminal_subscription_closed` and drops other host events; entity subscriptions resubscribe per peer generation), `src/botster/hubTransport.ts` (`DaemonBridgeClient` with optional `subscribeEvents`; `daemonEventFrame` currently projects only `runtime_observation`), `src/botster/protocol.ts` (`HubControlFrameKind` vocabulary), `src/app/useProductionHubConnection.ts` (route-owned connect + entity pulls), `src/app/dialogs/WorkbenchNotifications.tsx` (`IonToast` host), `scripts/check-daemon-protocol-drift.mjs` (byte-equality drift gate), `scripts/live-packaged-protocol-harness.mjs` (env-flag lane pattern, `fixtures/entity-options-reactive` path-install precedent, `__BOTSTER_LIVE_PROTOCOL_HARNESS__.listEntities` durable-state oracle).
- Current pins: `@trybotster/hub-test-support@0.1.36` (revision 41 claims in `README.md:11` and `docs/architecture.md:55-56`), `@trybotster/ui-contract@0.3.2`, `@trybotster/terminal-protocol@0.1.0`.

## Scope

1. **Pin and vendor.** Bump `@trybotster/hub-test-support` to `0.1.39`. Re-vendor `src/botster/generated/daemon-protocol.ts` byte-identical to the published artifact. Update the pin and revision claims in `README.md` and `docs/architecture.md` (revision 41 → 44, 0.1.36 → 0.1.39).
2. **Hello negotiation.** Add `"package_event_subscriptions"` to `requiredHostFeatures` in `src/botster/protocolPlanes.ts`. `minimum_conformance_fixture_revision` follows the installed metadata to 44 automatically. Feature tokens stay on the host requirement, never the terminal requirement.
3. **WebRTC bridge event subscriptions.** In `src/botster/webrtcDaemonClient.ts`, add a package-event subscription registry that mirrors the entity-subscription lifecycle: client-generated `subscription_id` per peer generation; `subscribe_events` issued after connect and Hello; `event_subscribed` expected; resubscribe with a **fresh** `subscription_id` after DataChannel reconnect; best-effort `unsubscribe_events` on release; registry counted by `hasReconnectDemand()`. Route `package_event` and `event_gap` in `receiveHostEvent` to the matching current-generation holder by `subscription_id`; discard mismatches with a recorded harness event. Event delivery must not enter `enqueueTerminalDelivery` and must not await consumers on the DataChannel message path.
4. **Transport frame plane.** Add `DaemonBridgeClient.subscribePackageEvents?` (owner, name, optional subjects). Add outbound `HubControlFrame` kinds `events_subscribe` / `events_release` handled in `createHubTransport` as held bridge subscriptions (same shape as generic entity demand). Project deliveries as inbound frames: kind `package_event` with `{owner, name, payload}` and kind `event_gap` with `{owner, name}`.
5. **Concrete consumer.** From the route-owned connection (`useProductionHubConnection` or a sibling hook it calls), send one `events_subscribe` for owner `project-pipelines`, name `question.opened`, no subjects. On a matching `package_event` frame, validate the payload shape (`question_id`, `kind`, `notice`, `blocking`) and show one transient notice through a dedicated `IonToast` instance (bounded text from `notice`, fixed duration, no persistence, no navigation side effects). On `event_gap`: drop transient reactions and record a connection diagnostic; never alter entity state and never surface an error UI.
6. **Proof.** Unit coverage in `src/App.test.mjs`; a new live packaged-protocol lane (`BOTSTER_LIVE_PACKAGE_EVENTS=1` plus an npm `smoke:` alias) with a fixture producer package under `fixtures/package-events/`; this plan document.

## Non-scope

- No change to the durable question or attention UI. Project Pipelines surfaces keep rendering durable question state from package entity state through the existing plugin-surface path.
- No generic notification framework, no per-event settings, no subscription configurability beyond the one concrete case. The transport/frame seam is generic only because the DTOs are; product policy stays one subscription.
- No Hub, Core, or Project Pipelines changes. No new protocol semantics; Web consumes generated DTOs only.
- No terminal-plane work: no Hub-specific terminal logic, no inspection or scheduling of terminal adapter frames, no event traffic on the terminal data plane.
- No event persistence, no event ids stored, no replay or history requests (the public DTOs contain no such fields; unit tests pin the request shape).

## Ownership boundaries and cross-repo dependencies

| Concern | Owner | Status |
| --- | --- | --- |
| Event admission, exact owner+name filters, shedding, gap production, host-control fairness | botster-hub | Shipped (`7a09292`, ticket closed) |
| Generated DTOs and conformance metadata | `@trybotster/hub-test-support@0.1.39` on npm | Published; content verified at plan time |
| `question.opened` contract and emit-after-commit ordering | botster-project-pipelines plugin | Shipped (`a198f16`..`beaba94`, ticket closed) |
| Independent Hub control / Core terminal planes in Web | botster-web (parent ticket) | Shipped (`ticket_1786661008_897067` closed) |
| Subscription client lifecycle, reconnect resubscribe, gap handling, transient notice UI | botster-web | **This ticket** |

No new cross-repository prerequisite is required. All dependency edges are closed and the artifact-coupled edge was verified against the published package content, not the ticket status. Live-proof requirement: the harness Hub must be a build at or after merge `7a09292` so it advertises `package_event_subscriptions`; the harness must fail with an explicit message when the feature is absent rather than passing vacuously.

## Assumptions and unknowns

1. **Owner string.** The subscription owner is the admitted package name `project-pipelines`, verified live via `list_plugins` and the manifest `name` field. The ticket's "botster-project-pipelines" is the repository name. If Plan Review reads the ticket as requiring a different owner string, that is a producer-side rename and needs a human decision.
2. **Fixture producer for live proof.** The live lane installs a path fixture package named `project-pipelines` (under `fixtures/package-events/`) that declares the byte-identical `question.opened` `events.emitted` contract copied from the real manifest, persists a durable question record to a plugin entity family, and then emits the event — the same commit-then-emit order as the real plugin. Driving the full real Project Pipelines state machine (MCP `ask_human` with pipeline state) inside the packaged harness is out of proportion for a browser-consumption proof; the harness hub is isolated, so the name cannot collide with a real installation. The fixture asserts the exact owner/name/payload contract end to end. If Plan Review requires the real plugin as producer, that is a scope decision to escalate.
3. **Required Hello feature.** Adding `package_event_subscriptions` to `requiredHostFeatures` makes new Web refuse Hubs older than `7a09292`. Precedent: `terminal_subscription_closed` is already required, and the repository family moves in direct-merge lockstep. The alternative (optional feature detection with degraded mode) adds a dual code path this ticket does not need.
4. **"Published budgets."** The ticket's budget language is interpreted as: Hub-side fairness budgets already proven in the parent Hub ticket, plus Web-side bounds — package events never enter the ordered terminal delivery queue (whose backlog cap is `maximumTerminalDeliveryBacklog`), and the flood regression must complete entity convergence and terminal echo within the existing harness step timeouts. No new budget constants are invented.
5. **Notice placement.** The toast mounts in the same shell that hosts the existing `WorkbenchNotifications`, as a separate `IonToast` instance so package-event notices never contend with action-result toasts. Exact placement is an Implement detail inside that shell.

## Affected surfaces and files

- `package.json`, `package-lock.json` — hub-test-support pin 0.1.36 → 0.1.39; new `smoke:package-events` script.
- `src/botster/generated/daemon-protocol.ts` — re-vendored artifact (byte-identical; drift check enforces).
- `src/botster/protocolPlanes.ts` — `package_event_subscriptions` host feature.
- `src/botster/webrtcDaemonClient.ts` — package-event subscription registry, `receiveHostEvent` routing, reconnect demand, harness event records.
- `src/botster/hubTransport.ts` — `DaemonBridgeClient.subscribePackageEvents?`, `events_subscribe` / `events_release` handling, `package_event` / `event_gap` frame projection.
- `src/botster/protocol.ts` — new `HubControlFrameKind` members.
- `src/app/useProductionHubConnection.ts` (plus a small hook/helper such as `src/app/packageEventNotices.ts`) — one concrete subscription, payload validation, notice state, gap diagnostic.
- `src/app/workbench.tsx` / `src/app/WorkbenchDialogs.tsx` (or `WorkbenchShell.tsx`) — mount the transient notice toast.
- `src/App.test.mjs` — unit coverage.
- `scripts/live-packaged-protocol-harness.mjs` — `BOTSTER_LIVE_PACKAGE_EVENTS=1` lane.
- `fixtures/package-events/botster-package.json`, `fixtures/package-events/plugin.lua` — fixture producer.
- `README.md`, `docs/architecture.md` — pin/revision claims.
- `docs/plans/consume-transient-package-events-through-hub-control-plane.md` — this plan.

## Risks

1. **Drift-gate breakage.** The vendored protocol must be byte-identical to the 0.1.39 artifact; hand edits are forbidden. Mitigation: copy from `node_modules`, `npm test` runs the drift check.
2. **Conformance revision jump 41 → 44.** The pin bump raises Web's `minimum_conformance_fixture_revision`; a stale local Hub then fails Hello. This is intended lockstep behavior, but the harness must report it as a Hub-version failure, not a mystery timeout.
3. **Flood-induced render churn.** Each matching event updates React notice state. Mitigation: only the one subscribed owner/name reaches the app; the flood regression bounds the effect; notice state coalesces to the latest event.
4. **Toast contention.** A second `IonToast` avoids fighting `packageActionToast`, but stacking behavior needs a look during Implement.
5. **Reconnect races.** Event resubscription runs beside entity resubscription on the same reconnect path. Holders are independent and unordered by contract; unit tests cover resubscribe-after-reset, and the live lane covers a real DataChannel close/reopen on one document ([[a page reload is not a reconnect]]).
6. **Ambient-hub sensitivity.** Packaged smokes can attach to an ambient hub inside pipeline worktrees ([[packaged browser smoke attaches to the ambient hub inside pipeline worktrees]]); the lane must pin its hub and fail loudly on a feature-less hub.
7. **Gap mis-handling.** Treating `event_gap` as an error would violate the ticket. The gap path is diagnostic-only and covered by unit and live checks.

## Acceptance checks and tests

Repository gates (all must pass):

1. `npm run typecheck`, `npm run lint`, `npm test` (drift check + `App.test.mjs`), `npm run build`.

Unit coverage (`src/App.test.mjs`, fake transport/bridge):

2. Connect issues exactly one `subscribe_events` per connection generation for `project-pipelines` / `question.opened`; the request body is exactly `{type, subscription_id, owner, name}` with no subjects, sequence, cursor, replay, or history field.
3. A matching `package_event` frame produces one transient notice with the payload `notice` text; a `package_event` for a different owner or name produces nothing.
4. `event_gap` produces no notice and no entity mutation; previously applied durable entity records remain readable.
5. Simulated transport reset then reconnect issues a new `subscribe_events` with a **different** `subscription_id`; a `package_event` carrying the old `subscription_id` is discarded.
6. A malformed `package_event` payload (missing `question_id` or `notice`) is rejected without a notice and without a crash.

Live packaged proof (new lane, real WebRTC, final independent Hub control and Core terminal planes):

7. Hello with `package_event_subscriptions` is accepted by a Hub at or after `7a09292`; the lane fails with an explicit message when the hub does not advertise the feature.
8. The fixture producer's surface action commits a durable question record to its entity family and then emits `question.opened`; the browser shows **exactly one** transient notice (structured harness event plus a DOM oracle on the toast, not toast-text-only assertions — the harness event ledger is the primary oracle).
9. Missed event: emit while the DataChannel is closed (harness `closeDataChannel` in-place reconnect on one surviving document); after reconnect the durable question record is visible through `listEntities` / entity pull, no notice replays, and the fresh subscription receives a subsequent live event.
10. Flood: the fixture emits a bounded burst (≥200 events). Entity reconciliation converges and a terminal echo round-trip completes within the existing harness step timeouts; the browser stays responsive; notice count never exceeds emitted count; any shed tail surfaces as `event_gap`, and the durable record stays visible.
11. Terminal isolation: harness event records show no terminal adapter frames and no terminal-queue involvement caused by event traffic (event deliveries appear only as `daemon_event` records).

Downstream/documentation proof:

12. `README.md` and `docs/architecture.md` claims match the installed package via a source-derived check (grep the installed `metadata.json` values into the diff review), per [[botster web pinned hub test support claims span readme and architecture docs]].
13. The production entry point is proven changed: the subscription is issued from the route-owned production connection path (`useProductionHubConnection`), not only from harness code.

## Vault gaps worth capturing

1. **Package event owner strings are admitted package names, not repository names** — `botster-project-pipelines` (repo) vs `project-pipelines` (owner key). Gotcha class; would have silently produced a dead subscription.
2. **Web package-event notices are transient; entity state is the only durable authority** — the consumer-side mirror of [[a transient package event cannot be the sole authority for a durable close]].
3. **hub-test-support 0.1.39 / conformance revision 44 is the package-event DTO cutover for Web** — same shape as the existing 0.1.35/0.1.36 cutover notes.
4. If Implement finds the harness hub feature-detection awkward, capture the pattern for asserting advertised host features in packaged smokes.
