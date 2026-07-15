# Adopt hub-test-support 0.1.7 binary-safe history revision 14

## Context loaded

- Pipeline context: ticket `ticket_1783965015_115417`, run `run_1784069958_911452`, active Plan step `botster_plan`, run target `tgt_40abcf71ccf049f4ac0c99953a799869`, and required gate `botster_plan_gate`. Both upstream dependencies are closed: the corrected revision-12 fixture release and Hub binary-safe history PR #133. There are no current-step artifacts, findings, or reviews. The prior revision-12 implementation question and answer were loaded; that answer required real packaged-path proof and prohibited weakening readiness when the old binaries stalled.
- Required planning authority: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], and [[spa-patterns]], plus the Botster planner overlay's ownership, explicit-target, explicit-worktree, operator-workbench, and vault-linking notes.
- Ticket-specific authority: [[botster clients restore visible terminal state from readscreen before buffered live output]], [[opaque terminal snapshot bytes do not prove renderable history]], [[coredaemon attached follows initial snapshots before live terminal output]], [[daemon attach drain cannot force snapshot or scrollback variants]], [[shared conformance fixtures that contradict the core contract teach clients the wrong state machine]], [[conformance fixture revisions must be unique per published content]], [[hub test support npm releases need external consumer smoke]], [[botster web dto field names must match authoritative rust serde structs]], [[botster terminal clients share one sessionio data plane subscription path]], [[cold turkey migrations eliminate dual code paths and version suffixes]], and [[plan agents must author vault context as wikilinks not home paths]].
- Human compatibility ruling: answer `question_1784070336_694456` requires `minimumConformanceFixtureRevision = 14`, makes `terminal_readback` required, and rejects older hubs. Revision 14 is a breaking history contract, not merely newer fixture provenance. The implementation must expose one current path with no legacy decoder, fallback, or version-specific branch.
- Published-package evidence: npm identifies `@trybotster/hub-test-support@0.1.7` as latest with integrity `sha512-46nX2cbTBHfBz7ukO8K/FkEpVy9JSqDQomZdTvN/Ho1fVCEKOnnYz04xyGgF8e0m9jImJbiKcaTfgyuvOmDd2w==`. Its metadata declares conformance revision 14. Comparing its tarball with 0.1.5 shows exactly two generated DTO replacements: Snapshot and Scrollback lose `data` and gain `payload_base64`, literal `payload_encoding: "base64"`, and `bytes`. The revision-14 fixture supplies opaque state plus separate `read_screen_text` and `no_history_read_screen_text` semantic oracles.
- Repo evidence: current main is the merged PR #63 revision-12 implementation. `package.json`/lock pin 0.1.5; the generated protocol still requires renderable Snapshot/Scrollback `data`; `RealHubTerminalDataPlane` writes that `data` to Restty and derives `restoredHistory`/`scrollback_unavailable` from it; the live harness waits for `snapshot.data`/`scrollback.data`; compatibility keeps `terminal_readback` optional and the minimum revision at 1; README and architecture repeat those superseded claims.
- Production path: packaged runtime mode creates `RealHubTerminalDataPlane` in `dogfoodMode`, `TerminalViewHost` mounts it through `DefaultTerminalViewBridge`, and bridge output subscriptions write into the mounted Restty renderer. This is the shipped path that must automatically issue ReadScreen during attach; Playwright-only controls are no longer sufficient evidence.
- Botster layers touched: React SPA terminal adapter and compatibility diagnostics, generated hub-client DTO mirror, npm package/lock provenance, packaged WebRTC live harness, tests, and docs. Hub/core/session-worker code is upstream and not modified here.
- Worktree/target assumption: all implementation and verification remain bound to target `tgt_40abcf71ccf049f4ac0c99953a799869` and this assigned worktree. Revision-14 binaries exist in the closed hub dependency worktree at commit `0f12630` for packaged live verification.
- Project Pipelines workflow checklist: `checklist_1784070221_412957`. Vault checklist: `checklist_1784070226_516047`. Both record loaded context, artifact comparison, production-path tracing, convention fit, planned verification, and capture disposition.

## Scope

1. Update the exact dev dependency and lock entry from `@trybotster/hub-test-support@0.1.5` to `0.1.7`, reinstall from the lock, verify package assets/integrity/revision 14, and replace the vendored generated daemon protocol from the authoritative package artifact.
2. Replace revision-12 fixture assertions cold-turkey. Assert revision 14, exact `Attaching -> opaque Snapshot -> Attached -> TerminalOutput -> ProcessExit` metadata order, the no-history order, literal base64 encoding, decoded fixture byte length, and the separate ReadScreen semantic oracles. Never accept or synthesize Snapshot/Scrollback `data`.
3. Change `RealHubTerminalDataPlane` so Snapshot/Scrollback are metadata-only events. They may be recorded for chronology but are never decoded as engine state, sent to output listeners, written to Restty, or used as evidence of visible history.
4. Start one visible-screen hydration cycle when the exact subscription reaches `Attached`: issue `ReadScreen`, buffer later `TerminalOutput.data` while readback is pending, emit non-empty `ReadScreen.text` first, then flush buffered live output in arrival order. Empty ReadScreen text emits no fabricated history and buffered/live output still proceeds.
5. Bind hydration to the current attachment generation. Detach, unsubscribe/re-attach, or replacement must invalidate stale ReadScreen replies and old buffers so an earlier cycle cannot write into the current renderer. Preserve session/subscription filtering, input, resize, process-exit, and cleanup behavior.
6. Delete the revision-12 presentation assumptions rather than leaving dormant compatibility code: remove `restoredHistory`, Snapshot/Scrollback `data` checks, history-kind renderer writes, and the `scrollback_unavailable` status/message. Keep status copy grounded in ReadScreen restoration or live-only attachment, not opaque payload byte counts.
7. Promote `terminal_readback` into `requiredDaemonFeatures`, remove its optional-warning branch/constant, and raise `minimumConformanceFixtureRevision` from 1 to 14. A hub below revision 14 must produce the existing explicit conformance-mismatch danger diagnostic naming observed and required revisions.
8. Rewrite the packaged live harness so it proves two separate properties on the real shipped path: subscription-scoped metadata chronology (`Attaching -> optional opaque state -> Attached -> live`) and renderer-visible restoration (automatic production ReadScreen text installed before later live output). Retain refresh/reconnect, keyboard, resize, response-chunk telemetry, exit, and cleanup proof.
9. Update README and architecture documentation to describe 0.1.7/revision 14, automatic shipped ReadScreen restoration, buffered live output, required compatibility floor/capability, and opaque state semantics.

## Non-scope

- No hub, core, session-worker, daemon framing, WebRTC transport, response-chunk protocol, or Restty implementation changes.
- No decoding or loading `payload_base64` into Restty, backend-specific snapshot interpretation, legacy `data` fallback, dual DTO, payload heuristic, or version-suffixed adapter.
- No new service/manager abstraction, general event queue, transport reorder buffer, optional configuration, broad terminal architecture refactor, or adjacent dependency upgrade.
- No change to protocol version 1. Revision 14 is enforced through the existing compatibility descriptor and feature checks.
- No requirement that every live attach emit Snapshot/Scrollback; the producer contract permits optional opaque initial state. Deterministic package fixtures own exact payload-shape proof when the public Attach/Drain path does not trigger those variants.
- No claim that `CaptureSnapshot` metadata restores visible history. It remains separate opaque-state metadata/readback scaffolding.

## Assumptions and unknowns

- Assumption: `Attached` is the client hydration boundary. ReadScreen is requested once per subscription after initial opaque state metadata and before later live bytes are released to the renderer, matching the upstream revision-14 client contract.
- Assumption: `ReadScreen.text` is a complete renderer-visible restoration payload for that hydration point. Arbitrary non-empty text, including whitespace and VT escapes, must be preserved exactly; code must not trim or parse it.
- Assumption: standard padded base64 and decoded-length equality are conformance assertions, not permission for Web to interpret the engine payload. The runtime adapter treats the payload as opaque metadata.
- Decision from the human answer: older fixture revisions are incompatible even if they advertise `terminal_readback`; compatibility floor 14 and required `terminal_readback` move together.
- Assumption: an empty ReadScreen result means no visible restoration text. It does not make a positive opaque snapshot into history; later live output transitions to the existing live-only presentation without fabricated bytes.
- Assumption: normal ReadScreen success is required for accepted revision-14 hubs. Existing request rejection/error handling should fail honestly and must not silently fall back to opaque payload rendering. The implementer should release or discard buffered bytes according to attachment teardown/error behavior without allowing an unbounded buffer; do not invent legacy recovery semantics.
- Unknown: the public live daemon path may omit opaque Snapshot/Scrollback events on a given attach. The live chronology must accept the documented optional branch and report what it observed; deterministic fixture/adapter tests must still prove the opaque-present branch.
- Unknown: whether a real live output event will naturally race the ReadScreen response. A deterministic delayed-ReadScreen adapter test owns the race and ordering proof; the live harness owns automatic production invocation, visible restoration, and continued live behavior.

## Affected surfaces and files

- `package.json`, `package-lock.json`: exact 0.1.7 coordinate, tarball URL, integrity, and installed provenance.
- `src/botster/generated/daemon-protocol.ts`: replace from the package artifact; expected substantive delta is the two Snapshot/Scrollback DTO field definitions.
- `src/botster/realHubTerminalDataPlane.ts`: metadata-only history handling, per-attachment ReadScreen hydration, FIFO live buffer, stale-cycle protection, and status cleanup.
- `src/botster/terminal.ts`: remove the obsolete `scrollback_unavailable` status variant if it has no remaining current-path producer; no renderer abstraction change is expected.
- `src/botster/connectionDiagnostics.ts`: require `terminal_readback`, set minimum revision 14, and remove the optional readback warning path.
- `src/App.test.mjs`: package/revision/asset assertions, generated DTO shape, exact revision-14 fixture contract, opaque-not-rendered regression, delayed ReadScreen/live ordering, empty restoration, stale cycle, compatibility floor/capability, and harness-source guards.
- `scripts/live-packaged-protocol-harness.mjs`: automatic ReadScreen restoration proof, renderer ordering, opaque metadata chronology, and revised diagnostics; preserve the remaining packaged WebRTC acceptance flow.
- `README.md`, `docs/architecture.md`: remove revision-12/renderable-history/optional-readback claims and document the revision-14 shipped path.
- Verification-only entry points expected unchanged: `src/botster/dogfoodMode.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/resttyRenderer.ts`, and `scripts/check-daemon-protocol-drift.mjs`.

## Implementation sequence

1. Install 0.1.7 through the normal npm lock workflow, verify `metadata.package_version`, revision 14, integrity, and `verifyPackageAssets().ok`, then copy the package's generated protocol artifact into the vendored path. Do not hand-edit DTOs.
2. Update direct package/fixture assertions first so tests reject revision 12, any Snapshot/Scrollback `data`, invalid fixture base64/length metadata, or a missing ReadScreen oracle.
3. Update compatibility constants and tests as one atomic change: minimum revision 14, required `terminal_readback`, no optional warning, explicit older-revision failure.
4. Replace the adapter's renderable-event path with a small attachment-local hydration state: pending ReadScreen, buffered live strings, and generation identity. Opaque events record metadata only; `Attached` starts hydration; successful current-cycle readback emits screen text followed by buffered live output.
5. Add focused deterministic cases for opaque-present and no-opaque fixtures, delayed ReadScreen with live bytes arriving in flight, empty ReadScreen, detach/re-attach stale response, exact session/subscription filtering, and no base64/data reaching output listeners.
6. Change the live harness from waiting on history event `data` to waiting on the automatic production `read_screen` request and renderer-visible retained marker. Keep chronology inspection independent and redact/avoid logging full opaque payloads.
7. Update docs only after deterministic and live behavior is proven, then review the final diff for cold-turkey removal of every revision-12 assumption.

## Risks

- Emitting live output before ReadScreen completes lets restoration overwrite newer terminal content. Mitigation: attachment-local FIFO buffering with a deterministic delayed-response regression.
- Writing ReadScreen after a detach or replacement can clobber the next renderer. Mitigation: advance/check a hydration generation and test a late reply from the old cycle.
- Treating opaque byte length or payload presence as visible history recreates the revision-12 bug. Mitigation: no runtime payload decoding/rendering and explicit zero-output assertions for opaque events.
- A package bump without copying the generated DTO leaves compile-time contract drift. Mitigation: package-backed drift check plus exact generated-file comparison.
- Keeping the optional readback warning or floor 1 would falsely admit the deleted contract. Mitigation: atomic compatibility regressions for required capability and revision-14 mismatch diagnostics.
- Large base64 payloads copied into harness logs can inflate memory and leak opaque engine state into artifacts. Mitigation: record only type/encoding/byte count and small validation facts, not full payloads.
- An empty screen could be mistaken for failed hydration or fabricated history. Mitigation: separate empty ReadScreen tests from opaque metadata and prove later live output remains visible.
- Fixture-only success could hide an unwired production path. Mitigation: the live harness must observe the automatic `read_screen` daemon request and the resulting Restty renderer write through the packaged WebRTC chain.
- ReadScreen rejection could strand an unbounded live buffer. Mitigation: bound the buffer consistently with existing response limits or terminate the failed hydration/attachment honestly; review must reject silent indefinite retention or opaque fallback.

## Acceptance checks and tests

- Fresh lock install resolves exactly `@trybotster/hub-test-support@0.1.7`; imported metadata reports revision 14 and the published integrity; `verifyPackageAssets()` returns `{ ok: true }`.
- Generated protocol drift passes and the vendored union exposes only `payload_base64`, literal `payload_encoding: "base64"`, and `bytes` for Snapshot/Scrollback—no `data` field.
- Fixture assertions prove exact history/no-history metadata sequences, base64 encoding/decoded length, separate ReadScreen text, and process-exit metadata.
- Adapter tests prove opaque payloads never reach terminal output listeners; ReadScreen text is emitted first; TerminalOutput arriving during hydration is buffered and flushed FIFO afterward; empty text fabricates nothing; detach/re-attach discards stale readback; session/subscription filtering and process exit remain correct.
- Compatibility tests prove revision 13 and below fail with an explicit required-14/observed-revision diagnostic, revision 14 passes, `terminal_readback` is required, and the old optional warning no longer exists.
- `npm test` passes, including package asset verification and generated protocol drift.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- `npm run smoke:live-packaged-protocol` passes against the revision-14 hub and session-worker binaries from the closed dependency worktree. It proves the actual packaged chain `dogfoodMode -> TerminalViewHost -> DefaultTerminalViewBridge -> RealHubTerminalDataPlane -> Restty`, observes automatic production ReadScreen restoration, records subscription-scoped `Attaching -> optional opaque state -> Attached -> live` metadata order, and retains keyboard, resize, response-chunk telemetry, process-exit, and clean-shutdown checks.
- Release evidence repeats the live packaged command five times, as required by the current harness documentation, and records binary paths/versions plus each chronology/restoration summary. No run may substitute fixture-only proof.
- Final diff review maps every changed line to 0.1.7 provenance, revision-14 DTO/fixture adoption, ReadScreen hydration, buffered ordering, compatibility enforcement, live-path proof, or documentation made stale by those changes.

## Pipeline gates and artifacts

- Plan artifact: this document, attached to `botster_plan_gate` with all required fields and checklist IDs.
- Implement evidence must include package/lock provenance, generated artifact replacement proof, compatibility tests, deterministic hydration chronology, production-entrypoint trace, all command outputs, and five live packaged runs with revision-14 binary provenance.
- Plan Review must reject any `event.data` history path, base64-to-text decoding, bytes-as-history heuristic, legacy/version branch, optional `terminal_readback`, revision floor below 14, unbounded hydration buffer, stale-cycle renderer write, fixture-only acceptance, or docs claiming Playwright-only readback.
- Vault checklist evidence: the notes under Context loaded constrain the plan; convention conflicts are none; verification commands and plan-stage artifact checks are recorded; durable capture disposition is below.

## Vault gaps worth capturing

- No new capture is needed now. [[botster clients restore visible terminal state from readscreen before buffered live output]] already records the durable revision-14 contract, including opaque base64, ReadScreen-first hydration, buffered live output, reconnect cycles, and cold-turkey deletion of revisions 12/13.
- Capture a new gotcha only if implementation discovers a distinct reusable rule not already covered—for example, a precise ReadScreen/live causal-boundary limitation or a required bounded-buffer behavior shared by other clients.
- If implementation merely confirms the existing note, record “no new durable knowledge” rather than duplicating it.
