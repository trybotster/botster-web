# Adopt hub-test-support 0.1.5 conformance revision 12

## Context loaded

- Pipeline context: ticket `ticket_1783965015_115417`, run `run_1784048123_817070`, active Plan step `botster_plan`, run target `tgt_40abcf71ccf049f4ac0c99953a799869`, and required gate `botster_plan_gate`. The upstream 0.1.5/revision-12 release dependency is closed. There are no prior artifacts, reviews, findings, questions, or answers.
- Required planning authority: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], and [[spa-patterns]], plus the Botster planner overlay's project-pipeline ownership, operator-workbench, explicit-target, and explicit-worktree notes.
- Ticket-specific authority: [[shared conformance fixtures that contradict the core contract teach clients the wrong state machine]], [[conformance fixture revisions must be unique per published content]], [[hub test support npm releases need external consumer smoke]], [[botster web dto field names must match authoritative rust serde structs]], [[botster terminal clients share one sessionio data plane subscription path]], [[coredaemon attached follows initial snapshots before live terminal output]], [[opaque terminal snapshot bytes do not prove renderable history]], [[adoption restart evidence must come from real protocol primitives not defaults]], and [[plan agents must author vault context as wikilinks not home paths]].
- Published-package evidence: npm reports `@trybotster/hub-test-support@0.1.5` with integrity `sha512-nbaogrWWnGv0yHLz0UsXYFd0j2rx1MslK5wSepOvBqEMtteVNqfI7MkfLXyzu4cwwQv5A9lXBTaN3WtrlVhDVg==`. Its metadata declares conformance revision 12. Comparing its installed-consumer tarball with 0.1.4 shows the generated daemon protocol is byte-identical; the meaningful change is the late-attach fixture ordering from `Attached -> Snapshot -> live` to `Attaching -> Snapshot -> Attached -> live`, with the no-history case now `Attaching -> Attached -> live`.
- Repo evidence: `package.json` and `package-lock.json` pin 0.1.4; `src/App.test.mjs` asserts package 0.1.4 and revision 11 and consumes the shared late-attach fixture; `scripts/check-daemon-protocol-drift.mjs` and `verifyPackageAssets()` make the installed package authoritative; `TerminalViewHost` mounts the shipped Restty path through `RealHubTerminalDataPlane`; and `scripts/live-packaged-protocol-harness.mjs` proves refresh/Attach history and continued live output over the packaged real-hub path.
- Botster layers touched: React SPA terminal adapter and tests, npm package/lock provenance, packaged real-hub browser harness, and documentation. Hub/core/session-worker contracts are not touched.
- The working `node_modules` currently contains stale 0.1.1 bytes, so it is not planning evidence. Implementation must reinstall from the updated lock before verification.
- Both Project Pipelines checklist creation calls returned plugin-worker timeouts to the caller, but the operations completed asynchronously and created `checklist_1784048273_927241` and `checklist_1784048278_749965`. Their items are the authoritative workflow record and are completed with the context, convention, verification-plan, and capture-disposition evidence summarized here.

## Scope

1. Change the exact dev-dependency and lock coordinate from `@trybotster/hub-test-support@0.1.4` to `0.1.5`, including the revision-12 tarball integrity, using the repository's normal npm lock update path.
2. Update package metadata and late-attach conformance assertions from revision 11 to revision 12.
3. Strengthen the shared-fixture client assertions so they prove both permitted sequences: `Attaching -> initial Snapshot/Scrollback -> Attached -> live` and `Attaching -> Attached -> live`. Assert readiness/status ordering as well as final output ordering so the old Attached-before-Snapshot fixture cannot pass unnoticed.
4. Add a focused client regression for an opaque blank snapshot: a positive `bytes` count without non-empty renderable `data` is metadata, not visible restored history. It must not be emitted to Restty, mark history restored, or suppress/clobber the following live output. Preserve the existing honest `scrollback_unavailable` status for positive opaque bytes; a following non-empty `terminal_output.data` must still be emitted and visible without rewriting that diagnostic state to `live_only`. A blank event with zero/absent `bytes` retains the existing no-history/live-only behavior.
5. Make the smallest `RealHubTerminalDataPlane` change necessary for that blank-snapshot regression while preserving non-empty `snapshot.data`/`scrollback.data`, session/subscription filtering, detach, input, resize, and process-exit behavior.
6. Update the README and architecture statements that identify 0.1.4/revision 11 and describe readiness ordering, without changing the hand-owned minimum compatible conformance revision of 1.
7. Prove the shipped runtime path with the packaged live protocol harness and prove package contents through the repository's package-backed drift/asset checks.

## Non-scope

- No daemon protocol DTO changes: the published 0.1.4 and 0.1.5 `daemon-protocol.ts` artifacts are byte-identical. `src/botster/generated/daemon-protocol.ts` should remain unchanged and is a verification surface only.
- No hub, core, session-worker, WebRTC framing, Restty, bridge, or terminal architecture redesign.
- No new protocol fields, private web terminal frames, compatibility-version bump, or change to the minimum compatible fixture revision.
- No broad test refactor, status model redesign, optional configurability, adjacent dependency upgrades, or cleanup unrelated to revision-12 adoption.
- No weakening of the live packaged harness to accept fixture-only or deterministic-only evidence.

## Assumptions and unknowns

- Assumption: this agent and later pipeline agents remain bound to the explicit target and assigned worktree named above; no ambient checkout is authoritative.
- Assumption: “opaque blank Snapshot payload length” means `snapshot.bytes` may be positive while `snapshot.data` is absent or the empty string. Only non-empty `data` is renderable terminal history; `bytes` is metadata and must never be substituted as output.
- Decision: positive opaque bytes with no non-empty `data` remain `scrollback_unavailable`, matching the current status semantics for an unrenderable daemon snapshot. Later live output is rendered but does not erase that diagnostic. Zero/absent bytes do not claim an opaque snapshot and may transition to `live_only` when live output arrives.
- Assumption: arbitrary non-empty terminal data must not be trimmed or interpreted for visual meaning because valid VT payloads can contain whitespace and escape sequences. The narrow blank guard should distinguish absent/empty string from non-empty bytes, not attempt a terminal parser.
- Assumption: package 0.1.5 is the intended exact adoption coordinate; this was verified from the published npm artifact, not inferred from the ticket alone.
- Unknown: whether a compatible local hub/session-worker pair will emit the corrected readiness sequence during the live harness. Verification must use revision-12-compatible binaries and record their paths/versions; inability to run the shipped path is a blocker or explicit pipeline finding, not grounds to claim runtime acceptance from deterministic tests.
- Unknown: whether the live hub naturally emits the opaque blank case. Deterministic client coverage owns that edge case; the live harness owns real attach/readiness/history/live ordering.

## Affected surfaces and files

- `package.json`: exact dev-dependency coordinate `0.1.5`.
- `package-lock.json`: root coordinate plus resolved version, tarball URL, and published integrity.
- `src/App.test.mjs`: package/revision assertions; exact revision-12 fixture sequence assertions; data-plane status/output ordering; opaque blank snapshot regression; package asset verification.
- `src/botster/realHubTerminalDataPlane.ts`: likely one narrow renderability guard so absent/empty `data` does not set `restoredHistory` or emit history.
- `scripts/live-packaged-protocol-harness.mjs`: required change. Record the observed subscription-scoped `attach_state`, `snapshot`/`scrollback`, and `terminal_output` events and assert `Attaching -> optional non-empty history -> Attached -> live`; preserve the existing refresh/Attach, Restty history, continued input/resize/exit, and response telemetry checks.
- `README.md` and `docs/architecture.md`: replace 0.1.4/revision-11 provenance and document strong readiness ordering/blank-history semantics where user-facing behavior is described.
- `src/botster/generated/daemon-protocol.ts`: verification-only, expected unchanged.

## Implementation sequence

1. Update the exact package and lock entry, reinstall from the lock, and first prove metadata version 0.1.5, revision 12, integrity, `verifyPackageAssets().ok`, and generated-protocol byte equality.
2. Replace hard-coded package/revision assertions and add direct fixture-shape assertions for both readiness sequences before exercising the adapter. This makes a future fixture-order regression fail at the shared-contract boundary.
3. Extend the existing fixture-driven `RealHubTerminalDataPlane` test to capture statuses and output in temporal order. Require attaching first, optional non-empty history next, attached before live, then process exit; require no-history attach to become live without fabricated restored history.
4. Add the isolated opaque blank snapshot case with positive `bytes`, empty or absent `data`, `Attached`, and non-empty live output. Adjust only the data-plane renderability guard needed to keep the snapshot metadata separate from visible output; preserve `scrollback_unavailable` while proving the following live output is still emitted.
5. Extend the packaged live harness with a mandatory ordered event assertion for the exact subscription under test: `attaching`, optional renderable snapshot/scrollback, `attached`, then live output. Do not infer chronology from final renderer contents or a terminal default.
6. Run the complete deterministic and build gates, then the packaged real-hub protocol harness against compatible binaries. Update documentation only for behavior/provenance actually proven.

## Risks

- A package-only version bump could leave client assertions compatible with the old invalid ordering. Mitigation: assert the exact shared-fixture event sequence and adapter status/output chronology.
- Treating `bytes > 0` as visible history creates a false restored state; treating all whitespace/escape-only strings as blank could discard valid VT content. Mitigation: use the narrow absent/empty-string distinction and keep `bytes` metadata-only.
- An empty history write may look harmless but can suppress the later live-only transition through `restoredHistory`. Mitigation: assert status as well as output and require live data after the blank snapshot.
- Stale `node_modules` can make package checks exercise 0.1.1 while source/lock claim 0.1.5. Mitigation: clean lock-based install and runtime metadata assertions before tests.
- A deterministic fixture can prove adapter behavior without proving the production attach path. Mitigation: the live packaged protocol harness remains required and must identify the real hub/session-worker used.
- Touching the generated DTO despite identical upstream artifacts would introduce unjustified drift. Mitigation: require byte equality and reject generated-file changes unless fresh package evidence contradicts the published comparison.

## Acceptance checks and tests

- Fresh lock-based install resolves exactly `@trybotster/hub-test-support@0.1.5`; imported metadata reports revision 12; `verifyPackageAssets()` returns `{ ok: true }`.
- Deterministic assertions prove the shared fixture itself is `Attaching -> Snapshot -> Attached -> terminal_output -> process_exit`, and its no-history variant is `Attaching -> Attached -> terminal_output -> process_exit`.
- Adapter assertions prove non-empty history is emitted before live output, blank/absent history data is not emitted or counted as restored, positive `bytes` alone does not become visible history, positive opaque bytes preserve `scrollback_unavailable`, and later live output remains visible without clearing that diagnostic.
- `npm test` passes, including package asset checks and generated daemon-protocol drift against the installed 0.1.5 artifact.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- `npm run smoke:live-packaged-protocol` passes against revision-12-compatible real hub/session-worker binaries and records the exact subscription's ordered real events, explicitly asserting `attach_state:attaching -> optional non-empty snapshot/scrollback -> attach_state:attached -> terminal_output`. It must also prove the actual production chain: packaged UI -> `TerminalViewHost` -> `RealHubTerminalDataPlane` -> mounted Restty, with continued keyboard input, resize, readback controls, process exit, and clean shutdown. Evidence identifies the hub/session-worker binaries by path and version.
- Review the final diff: every changed line must trace to the exact package coordinate, revision-12 assertions, blank-history correctness, required runtime proof, or documentation made stale by those changes.

## Pipeline gates and artifacts

- Plan artifact: this document, attached to `botster_plan_gate` with all required fields and links to the completed run checklists.
- Implement evidence must include the exact package/lock diff, installed metadata/asset verification, generated protocol unchanged proof, production-entrypoint explanation, deterministic command results, and live packaged protocol output with binary provenance.
- Plan Review should reject an implementation that only bumps metadata, asserts final output without readiness chronology, treats `bytes` as rendered content, trims/interprets arbitrary VT data, edits generated DTOs without upstream drift, or substitutes fixture evidence for the live packaged runtime.
- Vault checklist evidence: notes listed under Context loaded constrained the plan; after applying Plan Review's three corrections, convention conflicts are none; expected verification is listed above; durable capture disposition is below. The two asynchronously created run checklists carry the item-level evidence.

## Vault gaps worth capturing

- Capture a durable note if implementation confirms the general client rule that a terminal history event's positive `bytes` count is metadata while only non-empty `data` establishes renderable history. Suggested claim: “botster web counts only non-empty daemon history data as restored output.”
- Capture a durable note if the live revision-12 path reveals a readiness state or payload form not represented by the published fixture.
- If implementation merely confirms the ticket and existing notes, no vault write is needed; record that no new durable knowledge was discovered rather than duplicating the conformance-revision and shared-fixture notes.
