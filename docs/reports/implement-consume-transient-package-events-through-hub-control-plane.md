# Implement report: Consume transient package events through the Hub control plane

Ticket: `ticket_1786663584_427840`
Run: `run_1787197984_591095`
Step: `botster_stack_implement` / `run_step_1787237635_112668`
Plan: `docs/plans/consume-transient-package-events-through-hub-control-plane.md` revision 5 (`025fce5`)
Plan Review: `review_1787237618_639262` approved

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1786663584_427840` |
| Base | `origin/main` |
| Teardown class | yes |
| Merge policy | direct (no pull request) |

Ticket, run, and approved plan all bind `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. Work stayed in the pipeline-provided ticket worktree for that target.

## Repository playbook and other playbooks/notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[project-pipelines-playbook]] — `question.opened` client contract and Implement-gate evidence
- [[botster runtime teardown lenses]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[pipeline artifacts should use path neutral worktree references]]
- [[implementation reports separate merge cleanup from feature behavior]]
- [[question opened clients subscribe with empty subjects]]
- [[exact owner plus name is the only package event subscription key]]
- [[Client event holders are connection-scoped]]
- [[hub test support lacks package event producer fixtures]]
- [[a transient package event cannot be the sole authority for a durable close]]
- [[WebRTC adapter admission uses a Hello feature string not a generated DTO token]]
- [[botster web uses vanilla ionic primitives by default]]
- [[spa-patterns]]
- [[Host package-event negotiation survives terminal admission rejection]]
- [[botster spa has one route owned hub control plane connection]]
- [[botster review and verify must scan all committed artifacts for pii]]

Convention conflicts: none. Rails vault conventions from session start do not apply to this TypeScript client.

## Files changed

Feature behavior:

- `package.json`, `package-lock.json` — pin `@trybotster/hub-test-support@0.1.39`; add `smoke:package-events` and `smoke:package-events:gap`
- `src/botster/generated/daemon-protocol.ts` — copy published revision-44 host artifact (`subscribe_events`, `unsubscribe_events`, `package_event`, `event_gap`)
- `src/botster/protocolPlanes.ts` — Hello requires `package_event_subscriptions`
- `src/botster/protocol.ts` — add `events_subscribe`, `events_release`, `package_event`, `event_gap` frame kinds
- `src/botster/webrtcDaemonClient.ts` — generation-scoped package-event holders, reconnect after Hello, `hasReconnectDemand` includes holders, host `package_event`/`event_gap` bypass the terminal queue
- `src/botster/hubTransport.ts` — refcounted `events_subscribe`/`events_release`; inbound `package_event`/`event_gap`; `event_gap` is a connection diagnostic
- `src/botster/connectionDiagnostics.ts` — title “Package event gap”
- `src/app/packageEventNotices.ts` — exact owner/name/`subjects: []`, viewed-session identity join, notice filter
- `src/app/usePackageEventNotices.ts` — production subscribe on the route-owned connection; demand `project-pipelines.run_step` and `project-pipelines.run` while a session is viewed
- `src/App.tsx`, `src/app/WorkbenchDialogs.tsx`, `src/app/dialogs/WorkbenchNotifications.tsx` — one top `IonToast` with `data-testid="package-event-notice"`
- `src/app/useProductionHubConnection.ts` — harness `demandEntityFamily`/`releaseEntityFamily`
- `src/app/usePluginSurfaceDispatch.ts` — harness `dispatchPluginSurfaceAction` so live emit stays on the session route
- `src/App.test.mjs` — pin/features/revision 44, identity/filter matrix, holder races, sibling health, StrictMode
- `scripts/live-packaged-protocol-harness.mjs` — live package-event lane, forced-gap spawn (`BOTSTER_ENV=test` on the isolated hub child), flood budgets
- `fixtures/package-events/` — isolated producer named `project-pipelines` (Hub example at `7a09292`, PP contract `beaba94`, session binding `cd7c2f9`)
- `README.md`, `docs/architecture.md` — pin 0.1.39 / revision 44 and published event-plane budgets
- `docs/plans/consume-transient-package-events-through-hub-control-plane.md` — approved plan (already committed)
- `docs/reports/implement-consume-transient-package-events-through-hub-control-plane.md` — this report

Merge/rebase cleanup: none.

## Ownership boundaries preserved

Web owns Hello feature composition, generation-scoped holders, host-frame projection, viewed-session identity join, and one Ionic toast. This run did not edit botster-core, botster-hub, botster-hub-client, botster-tui, botster-tui-kit, botster-workspaces, or botster-project-pipelines. Host DTOs were copied from the published hub-test-support artifact. Workflow truth stays on package entities. Event owner is admitted package name `project-pipelines`, not repository name `botster-project-pipelines`.

## Cross-repo dependencies or separately routed work

All registered dependencies are closed. This run consumed published contracts:

- `@trybotster/hub-test-support@0.1.39` (conformance revision 44)
- Hub live binary at or after `7a09292` (advertises `package_event_subscriptions`)
- Project Pipelines 0.4.0 at `cd7c2f9` (`run_step.agent_session_uuid`, optional)
- `question.opened` schema from `beaba94`

No new cross-repository ticket was opened. Hub `BOTSTER_ENV=test` gating of `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` is Hub behavior; Web only sets that env on the isolated gap-lane hub child.

## Deviations from plan

No accepted scope change. The committed plan contract is unchanged.

Implementation details that the plan did not spell out:

- Hub applies `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` only when `BOTSTER_ENV=test`. The gap lane sets that env on the isolated hub child, not on the browser process.
- The live harness spawns the production session before WebRTC Hello. A unix spawn after `subscribe_events` failed with `missing field kind`.
- After emit, durable question visibility uses harness `releaseEntityFamily` then `demandEntityFamily` because entity snapshots are subscribe-time. That proves the entity plane, not the event plane, is durable.
- Identity is read from `window.location.pathname` at event time so the production filter does not assign a ref during render.

## Runtime-teardown lenses

Every lens from [[botster runtime teardown lenses]] is implemented. None was waived.

| Lens | Implementation |
| --- | --- |
| Isolation | One connection generation owns its event holders. Holder release does not drop entity subscriptions or terminal listeners. A sibling client remains healthy. |
| Bounds | Host requests use published `requestTimeoutMs` 10_000. Release is local-first: the holder is closed and removed, then `unsubscribe_events` is best-effort. Disconnect does not wait on a remote ack beyond that bound. |
| Late-message matrix | `subscribe_events` is grant-tagged by peer generation plus caller `subscription_id`. `unsubscribe_events` uses the caller id only. `package_event` and `event_gap` drop on stale generation or unknown id. Release-before-ack leaves no holder and no reconnect demand. A late ack cannot resurrect a closed holder. |
| Production-path proof | `App` → `usePackageEventNotices` → `hub.send({kind:"events_subscribe"})` → `DaemonBridgeClient.subscribePackageEvents` → WebRTC `subscribe_events` after Hello. Live lanes drive that path over a real DataChannel. |
| Ownership identity | Web holder key is `(peerGeneration, subscription_id)`. Reconnect mints a fresh UUID. A `package_event` or ack with the old id is discarded. |
| Sibling fail-closed | Successful event-holder release leaves entity and terminal siblings live. Ultimate peer close follows existing shared-peer fail-closed policy. Unit matrix covers sibling health. |

## Tests and downstream proof run

Commands:

```sh
npm test
npm run typecheck
npm run lint
npm run build
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
BOTSTER_LIVE_PACKAGE_EVENTS=1 \
node scripts/live-packaged-protocol-harness.mjs
BOTSTER_HUB_BIN=/path/to/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/botster-session-worker \
BOTSTER_LIVE_PACKAGE_EVENTS=1 \
BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX=1 \
node scripts/live-packaged-protocol-harness.mjs
```

Results:

- `npm test` passed (`check-daemon-protocol-drift.mjs` plus `src/App.test.mjs`).
- Typecheck passed.
- Lint passed with five pre-existing `react-refresh/only-export-components` warnings and zero new errors.
- Production build passed. Vite reports the existing large-chunk warning.
- Main live lane (prior visit, Hub `7a09292`) printed `package-events live proof passed (webrtc)` and measured flood budgets (`control_ms` 18, `flood_ms` 3823).
- Forced-gap live lane printed `[package-events] gap lane: hub BOTSTER_ENV=test BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX=1` and `package-events forced-gap live proof passed (webrtc)`.

Production entry point: `usePackageEventNotices` in `App.tsx` issues the subscription on the route-owned production connection from `useProductionHubConnection`. The live harness does not open a second control-plane connection.

## Unverified behavior or residual risk

- Browser-tool interaction of the toast was not run in this agent session. Proof used the packaged Playwright harness against the compiled production client.
- Closed-channel emit through in-page `plugin_surface_action` cannot reach Hub; the missed-event lane uses unix emit with catch/skip for that case.
- `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` remains a Hub test-only control. Production hubs ignore it unless `BOTSTER_ENV=test`.
- Pre-existing lint fast-refresh warnings and the Vite chunk-size warning were not part of this ticket.

## Missing vault guidance discovered

[[hub test support lacks package event producer fixtures]] names `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` but does not say Hub ignores that variable unless `BOTSTER_ENV=test`. Implement captured that recipe, plus the plan’s owner-name, transient-notice, DTO-cutover, and budget notes, into the vault inbox.

## Merge policy

Direct merge. No pull request.
