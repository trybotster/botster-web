# Implement report: Web generic package-event client without Project Pipelines coupling

Ticket: `ticket_1787278327_274484`
Run: `run_1787278334_136543`
Step: `botster_stack_implement` / `run_step_1787364175_274472`
Plan: `docs/plans/remove-project-pipelines-coupling-from-generic-package-event-client.md` revision 3 (`cf1c3db`)
Plan Review: `review_1787364160_424747` approved
Merge policy: direct (no pull request)

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `trybotster/botster-web` |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Spawn target name | `booster-web` (Hub label); Git identity is `botster-web` |
| Branch | `project-pipelines/ticket_1787278327_274484` |
| Base | `origin/main` at `71b461c20ccfe187bf2318773d791f168334fd18` |
| Teardown class | no |

Independent routing: `project_pipelines_current_context` ticket/run `target_id`, `list_spawn_targets`, and Botster context all map `tgt_40abcf71ccf049f4ac0c99953a799869` to `trybotster/botster-web`. The approved plan used the same routing. Work stayed in the pipeline-provided ticket worktree.

## Repository playbook and other playbooks/notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[project-pipelines-playbook]] — loaded because the ticket removes Project Pipelines coupling and the live lane still proves a package-owned notice contract
- [[event plane client proof uses library contract fixtures]]
- [[web package event notices are transient and entity state is durable]]
- [[generic botster clients must not hardcode package event reactions]]
- [[client notice reactions belong to package declarations not client constants]]
- [[published package owned notice reaction cutover is ui contract 0 3 3 and hub test support 0 1 41]]
- [[question opened notices target the agent session subject]]
- [[Package-event subject filters are exact strings compiled at admission]]
- [[exact owner plus name is the only package event subscription key]]
- [[package event owners use admitted package names not repository names]]
- [[botster web uses vanilla ionic primitives by default]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[a ui contract import line change costs one test line in each generic client]]
- [[web event plane budgets are published numeric host limits]]
- [[hub client event queue max requires Botster test mode]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]

Convention conflicts recorded: the [[botster-web-playbook]] required gate still tells Web to keep question subject filters empty and to filter workflow identity in the client. The human decision in `question_1787278509_823001` and the approved plan supersede that gate. Web now subscribes with the viewed session subject and does not filter `run_id` / `ticket_id` / `step_id`. Rails vault conventions from session start do not apply to this TypeScript client.

## Files changed

Feature behavior:

- `package.json`, `package-lock.json` — pin `@trybotster/ui-contract@0.3.3` and `@trybotster/hub-test-support@0.1.41`
- `src/botster/generated/daemon-protocol.ts` — copy published artifact; `DaemonPackage.notice_reactions` and the `PackageNoticeReactionDescriptor` import
- `src/botster/hubTransport.ts` — generic `notice_reactions` passthrough on `packageRecord()`
- `src/app/packageEventNotices.ts` — rewrite as descriptor-driven helpers; no owner, event name, entity family, or product payload schema
- `src/app/usePackageEventNotices.ts` — subscribe from admitted descriptors plus the viewed session subject; delete `run_step` / `run` entity demand
- `src/App.tsx` — compose the hook with `packages` and `recordDiagnostic`; no product constants
- `src/app/WorkbenchDialogs.tsx`, `src/app/dialogs/WorkbenchNotifications.tsx` — declared TTL and Ionic severity colour
- `src/app/__fixtures__/packageEventNoticeHarness.tsx` — production-hook mount harness
- `fixtures/package-notice-reaction/` — neutral owner `package-notice-reaction`, event `sample.notice`, session-scoped notice declaration
- `scripts/live-packaged-protocol-harness.mjs` — retarget the live lane to the neutral fixture and session-subject subscription
- `src/App.test.mjs` — pin 0.1.41 / 0.3.3 / revision 46 / DTO hash; encoded adapter proof; shared `resolveNoticeText` vectors; hook subscribe/receive/filter/gap/reconnect/notice proofs
- `README.md`, `docs/architecture.md` — pin 0.1.41 / revision 46 and descriptor-driven reaction

Retained without production import: `fixtures/package-events/` as an optional historical conformance fixture.

This report: `docs/reports/remove-project-pipelines-coupling-from-generic-package-event-client-implement.md`

## Ownership boundaries preserved

- `botster-web` owns client protocol consumption, the generic notice mechanism, and rendering.
- `botster-hub` owns the descriptor contract and `DaemonPackage` projection. Web consumes the published npm artifacts.
- `botster-project-pipelines` owns `question.opened` declaration and `payload.subject` emission. Web no longer hardcodes that contract.
- No new Hub protocol was authored in Web. No Web-local package registry was added.

## Cross-repo dependencies or separately routed work

Closed before Implement:

- `ticket_1787278643_145174` (Hub descriptor contract)
- `ticket_1787278658_151737` (Project Pipelines declaration and subject emission)
- `ticket_1787351279_697528` (npm publication of 0.3.3 and 0.1.41)

G17 re-verification on 2026-08-21:

- Hub `origin/main` `e23196f` contains merge `12e0cc6`
- Project Pipelines `origin/main` `643c4d7` contains declaration `2b1359e`
- Registry install: `@trybotster/hub-test-support@0.1.41` (revision 46, protocol 7) and `@trybotster/ui-contract@0.3.3`
- Installed `daemon-protocol.ts` sha256 `14121c4b1aa15f0728040b7ab3cc0189bf7720dc3159d994926d54e0251c5996`

No new cross-repo tickets were required.

## Deviations from plan

None that change the committed plan contract.

The live forced-gap lane now re-opens the session before the burst. A session-scoped descriptor releases its subscription on the dashboard, so a burst with no subscriber cannot produce `event_gap`. That is required by G23 and the human decision, not a product-scope change.

TTL clamp uses the Hub admission range 1,000 through 60,000 ms. Declared values inside that range pass through unchanged.

## Tests and downstream proof run

- G3 forbidden-constant scan of the three production reaction modules: no match
- `npm run typecheck` passed
- `npm run lint` passed (zero errors, five pre-existing warnings)
- `npm test` passed, including `scripts/check-daemon-protocol-drift.mjs`
- `npm run build` passed
- Live `npm run smoke:package-events` with Hub `e23196f` rebuilt `botster-hub`: `package-events live proof passed (webrtc)`. Flood budgets `control_ms` 21, `entity_ms` 9, `flood_ms` 4407, `emitted` 200, `received_events` 9, `received_notices` 9. Notices did not exceed emitted events.
- Live `npm run smoke:package-events:gap` with `BOTSTER_ENV=test` and `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX=1` on the isolated Hub child: `package-events forced-gap live proof passed (webrtc)`

Production entry point: `App` passes `runtimeClient.entities.list("botster-web.package")` into `usePackageEventNotices`. `packageRecord()` preserves `notice_reactions`. The hook subscribes with `{ owner, name, subjects: [viewedSessionId] }` from the admitted descriptor. Encoded `list_packages` without `notice_reactions` produces `[]` and no subscription. Encoded `list_packages` with the descriptor produces the subscription and toast path.

## Unverified behavior or residual risk

- Browser toast colour and duration were asserted from Ionic attributes in the live lane (`color="warning"`) and from hook state in unit tests. Visual colour at both desktop and mobile viewports was not separately screenshot-verified.
- The first live smoke against the previously built Hub binary failed closed because that binary reported conformance revision 45. Implement rebuilt Hub from `e23196f` locally for evidence. Downstream Verify should use a Hub that reports revision 46.
- `fixtures/package-events/` remains in the tree and is unused by the default smoke path. It still names Project Pipelines as a live producer. It is not imported by production modules.

## Missing vault guidance discovered

- V4 remains: update the [[botster-web-playbook]] required gate that still tells Web to keep empty subject filters and to filter workflow identity in the client. That update belongs in the vault, not in this Web ticket.
- No new inbox capture this visit. V6–V8 were already captured upstream during Plan.
