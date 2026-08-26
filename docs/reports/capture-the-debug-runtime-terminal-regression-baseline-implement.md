# Implement report: capture the debug-runtime terminal regression baseline

Ticket: `ticket_1787603669_760394`
Run: `run_1787632387_839095`
Step: `botster_stack_implement` / `run_step_1787720828_217032`
Returned from Review: `review_1787720810_475138`
Human decision: `question_1787702156_949472` requires `format_version=3`; earlier `question_1787678013_829162` chose B and D; `question_1787689401_836936` chose B
Plan: `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md` revision 10, resynced to format version 3
Approved review: `review_1787638112_854617`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Base commit | `bcf89f1102b8adf333cd93edb09274e04dab22eb` (`origin/main`) |
| Branch | `project-pipelines/ticket_1787603669_760394` |
| Merge policy | `direct` |
| Teardown class | yes, harness scope |

Independent `project_pipelines_get_project` maps `tgt_40abcf71ccf049f4ac0c99953a799869` to the Web tickets in this project, including this ticket. The approved plan used the same routing. Work stayed in the run worktree for `trybotster/botster-web`.

## Repository playbook and other playbooks/notes applied

Role and charter, in load order:

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[botster runtime teardown lenses]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[identity]]
- [[goals]]

Required context maps:

- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[restty is a client renderer not authoritative terminal infrastructure]]

Not loaded: [[project-pipelines-playbook]] — this ticket changes no Project Pipelines package or plugin path.

Targeted notes:

- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[the packaged-protocol terminal lane has a caller-owned keep-alive mode]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[ready then history is a compatibility feature not an Attach field]]
- [[Web vendors a complete Restty build from the approved commit]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[web event plane budgets are published numeric host limits]]
- [[hub client event queue max requires Botster test mode]]
- [[a page reload is not a reconnect]]
- [[current botster is a modular repository family not the legacy trybotster monorepo]]
- [[legacy trybotster notes are not current modular botster contracts]]
- [[terminal transport north star publishes behavioral oracles not numeric budgets]]
- [[live hub proof records distinct hub and locked core binary provenance]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[colon worktree paths break cargo dyld library paths]]

## Files changed

New:

- `scripts/terminal-baseline-observation-format.mjs`
- `scripts/terminal-baseline-observer.mjs`
- `scripts/terminal-baseline-capture.mjs`
- `fixtures/terminal-baseline/seed-shell-clock.bash`
- `fixtures/terminal-baseline/seed-posix.sh`
- `fixtures/terminal-baseline/history-seed.sh`
- `fixtures/terminal-baseline/sibling-flood.sh`
- `docs/terminal-baseline-observation-format.md`
- `.github/workflows/terminal-regression-baseline.yml`
- `docs/reports/capture-the-debug-runtime-terminal-regression-baseline-implement.md`

Changed:

- `package.json` — `observe:terminal-baseline` and `observe:terminal-baseline:validate`
- `src/App.test.mjs` — format version 3, attach+snapshot control operations, subscribe-attempt generation, page-isolation teardown, message-first and close-first late confirmations, send-only reject, remount-restore, concurrent-workload, one-armed publication, and runner-admission assertions
- `README.md` — pointer to the observation format
- `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md` — resynced to format version 3 and attach+snapshot operations

Unchanged production paths: everything under `src/botster/`, `src/app/`, and `src/vendor/restty/`. No file in the supplied Hub checkout or `~/Rails/trybotster` was written.

## Ownership boundaries preserved

`botster-web` owns the observation harness, format, validator, workflow, and records. Both product arms are path-supplied and read-only. The harness clones a scratch Hub checkout under `$TMPDIR` and never checks out or builds inside the supplied Hub source. The developer legacy tree is refused when dirty; the operator must supply a clean checkout at `f598075e`.

## Cross-repo dependencies or separately routed work

- `ticket_1787600670_129312` (`botster-hub`, closed) remains the registered parent.
- No new dependency ticket was opened.
- Modular binaries were built from Hub `f6db5c436f72b151fd6dacde61d3f4836a4dc925` as a build input, not as a published release.
- Downstream consumers remain `ticket_1787600689_646958` and `ticket_1787600679_990088`. Both now require `format_version=3`.

## Runtime-teardown lenses

Implemented in harness scope. No lens was dropped to informal follow-up.

| Lens | Implementation |
| --- | --- |
| Isolation | Isolated data directory, Hub process, and browser context per arm. One arm failure stops that arm's process tree only. |
| Bounds | SIGTERM, then SIGKILL after `teardown_budget_ms`. Escalation is recorded. No unbounded wait. |
| Late-message matrix | Terminal attach, entity family, package-event burst, and spawned session are tagged and released before the next repetition or arm stop. Legacy attach closes the observer and the page. Tests reject a prior decoded confirmation after the next subscribe starts, in both message-first and close-first order. |
| Production-path proof | Real browser, real client build, real Hub, real PTY dispatcher. Control saturation uses each stack's production browser control connection. The candidate record stays in memory until both arm process trees and required sockets are gone. A JSON record is written only after that proof. |
| Ownership identity | Each arm records `arm_id`, Hub pid, data directory, and session ids. Each probe marker includes capture, arm, family, and repetition. Paint remounts restore the saturation probe session before the next probe. |
| Sibling fail-closed | A one-armed or partial record is not a baseline. Ultimate stop failure fails the capture. |

## Deviations from plan

1. `dispatcher_append_calibration_ms` measures the same builtin `printf` plus append on the host, without the browser. It does not yet open the session PTY device node directly.
2. Family collection runs after both arms have started. The frozen `n=20` is one pass per family per arm. The capture does not yet repeat the full 20-rep set in the opposite arm order as a second isolated campaign.
3. Format version 3 is now the committed contract (`question_1787702156_949472`). The plan, format document, and downstream citations were resynced in this visit. Version 2 is retired before any baseline is authoritative. There is no version 2 compatibility path.
4. Vault checklist creation timed out at the plugin worker on the first Implement visit. This visit reuses the existing run checklist when list/create is available.

These deviations do not change the two dispatcher variants, the single paint oracle, or the prohibition on transport and Restty edits.

## Review findings addressed

`review_1787720810_475138` returned three open findings. This visit keeps `format_version=3` and isolates each legacy attach attempt.

| Finding | Fix |
| --- | --- |
| `finding_1787720810_498840` peer generation reused | Each legacy attach uses a new production page and records the subscribe-attempt generation from that page's production `subscribe` encode. A closed observer rejects a later `subscribed` confirmation, including the prior attempt's confirmation after the next subscribe starts. |
| `finding_1787720810_671234` teardown is a local flag | Teardown waits for the production `unsubscribe` encode, proves the observer is non-live and closed, and closes the old page before the next subscribe. Tests cover message-first and close-first late confirmations. |
| `finding_1787720810_222741` stale resize claim | The current-tense resize sentence is removed. Version 2 resize send-completion is historical only. |

`review_1787719971_189552` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787719971_691507` missing legacy generation | Legacy inbound requires an integer subscribe-attempt generation with the decoded `subscribed` confirmation. A missing or stale generation is not inbound data. |
| `finding_1787719971_814820` different attach session input | Both arms attach the frozen probe session. Legacy opens that session through the production dashboard on an isolated page. It does not call `completeLegacyNewSession`. Session creation or identity drift fails closed. |

`review_1787708542_834767` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787708542_278974` legacy attach not production-reachable | Legacy `terminal_attach` no longer waits for `_botsterTestTerminal` and no longer calls a test-only `subscribe`. It remounts the frozen probe session through the production UI and records the production `subscribe` encode plus the decoded `subscribed` confirmation. Teardown is production home-navigation unsubscribe, not a local flag. |
| `finding_1787708542_477295` modular identity copied from the request | Modular attach inbound records only decoder `attach_state.session_id` and `attach_state.subscription_id` plus `webrtc_response_assembly.generation`. Assembly plus `{ok:true}` without `attach_state` leaves inbound at 0 even when the request carried ids. A local generation counter cannot satisfy the identity check. |

`review_1787702471_847790` and `review_1787702323_569873` findings from the prior visit remain resolved after the version 3 cold-cut:

| Finding | Fix |
| --- | --- |
| `finding_1787702471_881933` / `finding_1787702323_104056` synthetic inbound | Version 3 removes `terminal_resize` and every send-completion inbound path. Inbound frames and bytes come only from decoded `subscribed` / attach-admission and snapshot decoder events. A send-only `subscribe` or `attach` promise does not change the inbound counter. |
| `finding_1787702471_962836` / `finding_1787702323_920784` missing attach | Control saturation now uses `terminal_attach` and `terminal_snapshot`. Legacy issues production `subscribe` and counts decoded `subscribed`. Modular issues production `attach` and counts decoder assembly plus matching session and subscription identity. Each attach tears down before the next starts. Wrong identity, wrong generation, late messages, and incomplete teardown reject. |

`review_1787701425_278522` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787701425_914685` unrelated reply | Superseded by format version 3. `observeInbound` still receives the selected semantic name. Modular counts `webrtc_response_assembly` for that wire type only. Legacy snapshot still counts `0x02` rows. Version 3 has no `terminal_resize` inbound path. |

`review_1787701045_427701` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787701046_872600` unrelated send | `observeOutbound` still receives the selected semantic name. Modular counts `daemon_request` rows for that arm's wire type only. Legacy counts ledger rows for `resize` or `request_snapshot` only. |

`review_1787699804_592583` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787699804_683507` one-reply control | `control_response_saturation` still proves the browser sent the selected request before Enter and that its one response arrives after `t_key`. The send counter is now the selected wire operation, not the combined resize-plus-snapshot count. |

`review_1787696822_102316` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787696822_729346` settle delay | Each wrapper still starts one producer in `beforeEnter`, after the 250 ms settle window and marker typing. Package and sibling wait for inbound growth before Enter. Control waits for the outbound send before Enter. |

`review_1787696331_611826` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787696331_767389` promise oracle | Package and sibling Enter still use the production inbound counter. Control Enter uses the production outbound send counter, not a local promise flag. |

`review_1787691852_111616` findings from the prior visit remain resolved:

| Finding | Fix |
| --- | --- |
| `finding_1787691852_727555` pre-key progress | The load snapshot remains at `t_key`. Progress that finishes before `t_key` and does not continue after it still fails closed. |
| `finding_1787691852_815060` self-asserted booleans | `recordIsPublishableBaseline` and `validateObservationRecord` recompute rate and byte equality from the recorded family values and the frozen tolerance. Stored booleans are derived output only. Mutated rates with booleans left `true` reject. |
| `finding_1787691852_901374` protocol layers | Both arms count `decoded_inbound_control_payload_bytes`. Modular bytes come from decoded `transportControl.request` replies. Legacy bytes use the same helper on snapshot blobs and decoded control messages. Encrypted assembly `total_bytes` is not the unit. Equal wire fixtures produce equal counted bytes. |

`review_1787682036_465458` findings from the prior visit remain resolved or waived. The same-laptop JSON remains blocked on GitHub sign-in (`question_1787689401_836936`).

| Finding | Fix |
| --- | --- |
| `finding_1787682036_650514` overlap | Saturation helpers wrap `sendProbe`. `review_1787691852_111616` then moved the load snapshot to `t_key` and required post-key progress. |
| `finding_1787682036_551936` inbound frames | Control rates still count modular `webrtc_response_assembly` frames and legacy inbound `handleMessage` events. Byte counts now use the shared decoded-payload unit. The local request wrapper is not counted. |
| `finding_1787682036_522359` local record | Waived for this ticket (`question_1787689401_836936` choice B). This ticket did not capture a performance baseline. No incomplete record is marked publishable. |
| `finding_1787682036_946083` developer path | Removed the developer Hub absolute path from the public report. |

`review_1787677878_514675` findings from the prior visit remain resolved or waived:

| Finding | Fix |
| --- | --- |
| `finding_1787677878_907488` remount identity | Paint remounts restore the saturation probe session. The harness asserts the mounted session id before each saturation probe. A remount that leaves the probe on the history session fails closed. |
| `finding_1787677878_840670` live producer proof | Control burst issues exactly 20 sequential browser requests. Package burst emits 20 slices of 10. Sibling flood keeps terminal A mounted and requires subscription plus counter growth on every measured sample. |
| `finding_1787677878_764546` equal browser control | Version 3 uses `terminal_attach` and `terminal_snapshot` through each arm's production browser control connection. The record stores semantic names, wire types, rates, bytes, and tolerance. Direct daemon Unix sockets are not used for this family. |
| `finding_1787677878_148374` one-armed publication | The validator requires every required family measured on both arms, except legacy `package_event_saturation` as `not_applicable`. A blocked publication family is not a publishable baseline. |
| `finding_1787677878_719710` controlled runner | Waived for this ticket only (`question_1787678013_829162` choice B). The workflow, schema validation, teardown proof, and rerun instructions remain. The controlled record is deferred because the runner is unregistered. This report does not claim a controlled baseline exists. |

## Tests and downstream proof

Deterministic gates:

| Gate | Command | Result |
| --- | --- | --- |
| G1 | `npm run typecheck` | passed |
| G2 | `npm run lint` | passed, five known warnings in untouched files |
| G3 | `npm test` | passed, two known `act(...)` warnings |
| G4 | `npm run build` | passed |
| G6 | validator assertions in `src/App.test.mjs` | format version 3, attach+snapshot operations, send-only completion rejected as inbound, sequential attach teardown, identity and generation checks, producer starts after settle and marker typing, control send and reply required for the selected wire operation, unrelated send or reply cannot satisfy a snapshot sample, package and sibling inbound required before Enter and after t_key, production sendProbe delay on the positive path, one-shot-before-Enter reject for sustained families, one physical control request per sample, invalid-number reject, and one-armed reject |
| G13 | `observe:terminal-baseline:validate` | available; used after a written record |

G5 pinned sequence from the prior Implement visit remains the last completed live-packaged proof:

| Field | Value |
| --- | --- |
| `HUB_SOURCE` | botster-hub checkout (read-only) |
| `HUB_SOURCE_HEAD` | `f66d459666614f670c932433abedc964ad2f5356` |
| Scratch revision | `f6db5c436f72b151fd6dacde61d3f4836a4dc925` |
| `Cargo.lock` Core pin | `7eafa470a18025895995bbedc20d34b58106a03b` present |
| Hub binary | scratch `target/debug/botster-hub` |
| Worker binary | scratch `target/debug/botster-session-worker` |
| Smoke | `npm run smoke:live-packaged-protocol` passed |
| Source after smoke | HEAD and porcelain unchanged |

Downstream proof: `docs/terminal-baseline-observation-format.md` states that `ticket_1787600689_646958` records the post-Restty set in `format_version=3` and that `ticket_1787600679_990088` compares against that baseline.

## Observational output

### O2. Deferred controlled runner

`botster-ubuntu-24.04-16core` is still unregistered. Human choice B waives the controlled record for this ticket only. The project still requires that record when the runner exists. Later tickets must not describe a local record as controlled-runner evidence.

### O3. Rerun procedure

See `docs/terminal-baseline-observation-format.md`. Register the runner, provision both product arms, dispatch the workflow, keep `format_version=3`.

### O1. Local two-arm set

Human choice B in `question_1787689401_836936` waives the local two-arm JSON for this ticket. This session cannot complete GitHub OAuth. The only non-GitHub direct sign-in route is test-only. This visit did not use that route and did not add an authentication bypass.

A clean scratch clone at `f598075e` reached a reachable legacy URL and then failed closed at `Sign in with GitHub`. No observation JSON was written. This ticket did not capture a performance baseline. A one-arm or incomplete record is not a two-arm record and is not publishable.

Later tickets must not use this ticket as evidence for a measured latency improvement or regression. When an authenticated browser session or the controlled runner exists, run the complete two-arm `format_version=3` capture before any performance claim.

## Unverified behavior or residual risk

- No controlled-runner JSON exists. That requirement is waived for this ticket only (`question_1787678013_829162` choice B).
- No local two-arm JSON exists. That requirement is waived for this ticket (`question_1787689401_836936` choice B).
- This ticket did not capture a performance baseline.
- Live G7, G9, G10, G16, and G18 product-arm proof still needs a successful two-arm capture.
- Legacy Rails provisioning on Linux CI is unproven.
- Exact canvas settle-window calibration is frozen at 250 ms and may need a later `format_version` bump if both arms prove a different stable window.
- Control-response equalization records a 0.25 tolerance. Achieved live values still require a completed two-arm set.
- Live `issueControlRequest` is one browser RPC. The harness requires the production send before Enter and the one response after `t_key`. A reply that arrives before Enter fails closed. Package-event and sibling families still require inbound growth on both sides of Enter.
- Legacy attach inbound is the decoded `subscribed` confirmation plus that page's subscribe-attempt generation. Each attempt uses a new page. Teardown waits for production unsubscribe, closes the observer, and closes the page before the next subscribe. Modular attach inbound requires decoder `attach_state` plus assembly generation. Request fields, peer-connection generation, local generation counters, missing generation, and new-session creation are not inbound data. Snapshot replies remain the producer `0x02` / `read_screen` decoder payload.

## Missing vault guidance discovered

The five gaps in plan §15 were not in the vault. They are captured to the vault inbox:

- `debug-runtime-means-two-complete-debug-product-stacks.md`
- `a-cross-arm-terminal-baseline-needs-a-client-neutral-oracle.md`
- `egress-saturation-and-request-saturation-are-different-workloads.md`
- `a-product-baseline-is-not-a-causality-experiment.md`
- `a-one-armed-capture-is-not-a-baseline.md`
