# Implement report: capture the debug-runtime terminal regression baseline

Ticket: `ticket_1787603669_760394`
Run: `run_1787632387_839095`
Step: `botster_stack_implement` / `run_step_1787677900_817703`
Returned from Review: `review_1787677878_514675`
Human decision: `question_1787678013_829162` chose B and D
Plan: `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md` revision 9, resynced to format version 2
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
- `src/App.test.mjs` — format version 2, control-operation, remount-restore, concurrent-workload, one-armed publication, and runner-admission assertions
- `README.md` — pointer to format version 2
- `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md` — resynced to format version 2 and the B+D control operations

Unchanged production paths: everything under `src/botster/`, `src/app/`, and `src/vendor/restty/`. No file in the supplied Hub checkout or `~/Rails/trybotster` was written.

## Ownership boundaries preserved

`botster-web` owns the observation harness, format, validator, workflow, and records. Both product arms are path-supplied and read-only. The harness clones a scratch Hub checkout under `$TMPDIR` and never checks out or builds inside the supplied Hub source. The developer legacy tree is refused when dirty; the operator must supply a clean checkout at `f598075e`.

## Cross-repo dependencies or separately routed work

- `ticket_1787600670_129312` (`botster-hub`, closed) remains the registered parent.
- No new dependency ticket was opened.
- Modular binaries were built from Hub `f6db5c436f72b151fd6dacde61d3f4836a4dc925` as a build input, not as a published release.
- Downstream consumers remain `ticket_1787600689_646958` and `ticket_1787600679_990088`. Both now require `format_version=2`.

## Runtime-teardown lenses

Implemented in harness scope. No lens was dropped to informal follow-up.

| Lens | Implementation |
| --- | --- |
| Isolation | Isolated data directory, Hub process, and browser context per arm. One arm failure stops that arm's process tree only. |
| Bounds | SIGTERM, then SIGKILL after `teardown_budget_ms`. Escalation is recorded. No unbounded wait. |
| Late-message matrix | Terminal attach, entity family, package-event burst, and spawned session are tagged and released before the next repetition or arm stop. |
| Production-path proof | Real browser, real client build, real Hub, real PTY dispatcher. Control saturation uses each stack's production browser control connection. The candidate record stays in memory until both arm process trees and required sockets are gone. A JSON record is written only after that proof. |
| Ownership identity | Each arm records `arm_id`, Hub pid, data directory, and session ids. Each probe marker includes capture, arm, family, and repetition. Paint remounts restore the saturation probe session before the next probe. |
| Sibling fail-closed | A one-armed or partial record is not a baseline. Ultimate stop failure fails the capture. |

## Deviations from plan

1. `dispatcher_append_calibration_ms` measures the same builtin `printf` plus append on the host, without the browser. It does not yet open the session PTY device node directly.
2. Family collection runs after both arms have started. The frozen `n=20` is one pass per family per arm. The capture does not yet repeat the full 20-rep set in the opposite arm order as a second isolated campaign.
3. Format version 2 is now the committed contract (`question_1787678013_829162`). The plan, format document, README, and downstream citations were resynced in this visit. Version 1 is retired before any baseline is authoritative.
4. Vault checklist creation timed out at the plugin worker on the first Implement visit. This visit reuses the existing run checklist when list/create is available.

These deviations do not change the two dispatcher variants, the single paint oracle, or the prohibition on transport and Restty edits.

## Review findings addressed

`review_1787677878_514675` returned five open findings. This visit implements each one:

| Finding | Fix |
| --- | --- |
| `finding_1787677878_907488` remount identity | Paint remounts restore the saturation probe session. The harness asserts the mounted session id before each saturation probe. A remount that leaves the probe on the history session fails closed. |
| `finding_1787677878_840670` live producer proof | Control burst issues exactly 20 sequential browser requests. Package burst emits 20 slices of 10. Sibling flood keeps terminal A mounted and requires subscription plus counter growth on every measured sample. |
| `finding_1787677878_764546` equal browser control | Version 2 uses `terminal_resize` and `terminal_snapshot` through each arm's production browser control connection. The record stores semantic names, wire types, rates, bytes, and tolerance. Direct daemon Unix sockets are not used for this family. |
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
| G6 | validator assertions in `src/App.test.mjs` | format version 2, browser producer, retired names, and one-armed reject |
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

Downstream proof: `docs/terminal-baseline-observation-format.md` states that `ticket_1787600689_646958` records the post-Restty set in `format_version=2` and that `ticket_1787600679_990088` compares against that baseline.

## Observational output

### O2. Deferred controlled runner

`botster-ubuntu-24.04-16core` is still unregistered. Human choice B waives the controlled record for this ticket only. The project still requires that record when the runner exists. Later tickets must not describe a local record as controlled-runner evidence.

### O3. Rerun procedure

See `docs/terminal-baseline-observation-format.md`. Register the runner, provision both product arms, dispatch the workflow, keep `format_version=2`.

### O1. Local two-arm set

This visit keeps the local same-laptop two-arm record as non-gating observation evidence. The developer legacy tree at the frozen revision is dirty, so the harness refuses it. A clean scratch clone at `f598075e` was used without writing to that developer tree.

This visit ran `npm run observe:terminal-baseline` against that clone and `/Users/jasonconigliari/Projects/botster-hub`. The capture reached a reachable legacy URL and then failed closed:

`legacy remount: new-session-button is not available`

The pinned legacy product renders `data-testid=new-session-button` only after a signed-in GitHub session and a workbench shell. The home page offers `Sign in with GitHub`. The harness now fails with that typed reason instead of inventing a login bypass. No partial two-arm JSON was written. This report does not invent wall-clock numbers and does not claim a publishable baseline exists.

## Unverified behavior or residual risk

- No controlled-runner JSON exists. The requirement is waived for this ticket only.
- A complete local two-arm JSON is still unpublished. The clean legacy arm reached HTTP but stopped at GitHub sign-in. The harness does not automate OAuth and does not write to the supplied trees.
- Live G7, G9, G10, G16, and G18 product-arm proof still needs a successful two-arm capture.
- Legacy Rails provisioning on Linux CI is unproven.
- Exact canvas settle-window calibration is frozen at 250 ms and may need a later `format_version` bump if both arms prove a different stable window.
- Control-response equalization records achieved rates, bytes, and a 0.25 tolerance. A completed two-arm set is still required to freeze achieved values.

## Missing vault guidance discovered

The five gaps in plan §15 were not in the vault. They are captured to the vault inbox:

- `debug-runtime-means-two-complete-debug-product-stacks.md`
- `a-cross-arm-terminal-baseline-needs-a-client-neutral-oracle.md`
- `egress-saturation-and-request-saturation-are-different-workloads.md`
- `a-product-baseline-is-not-a-causality-experiment.md`
- `a-one-armed-capture-is-not-a-baseline.md`
