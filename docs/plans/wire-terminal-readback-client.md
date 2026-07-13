# Wire terminal readback from the published hub contract

## Context Loaded

- Project Pipelines: ticket `ticket_1783636830_504538`, run `run_1783962079_105817`, active Plan step `run_step_1783962079_154033`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, and required gate `botster_plan_gate`. Both registered dependencies are closed. There are no prior run artifacts, reviews, findings, questions, or answers.
- Required planning authority: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[botster pipeline needs continuous product owner between agent steps]], and [[plan agents must author vault context as wikilinks not home paths]].
- Ticket-specific constraints: [[plan steps need reviewable plan artifacts]], [[generated typescript dtos must encode serde field optionality]], [[hub test support npm releases need external consumer smoke]], [[mounted browser terminal attach is idempotent by attachment identity]], [[terminal session switches must cancel in-flight webrtc pty connects]], [[coredaemon must expose terminal truth used by the production hub path]], [[lifecycle guards evaluated before the reconciling drain are one call stale]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repository path inspected: `package.json`, `package-lock.json`, `scripts/check-daemon-protocol-drift.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/connectionDiagnostics.ts`, `src/botster/dogfoodMode.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/terminal.ts`, `src/botster/TerminalViewHost.tsx`, `README.md`, `docs/architecture.md`, and the predecessor plan `docs/plans/consume-hub-history-screen-snapshot-production-attach.md`.
- Published dependency evidence: npm exposes `@trybotster/hub-test-support@0.1.3`. Its published tarball contains generated `read_screen` and `capture_snapshot` requests; optional/nullable `DaemonResponse.read_screen` and `.capture_snapshot`; `DaemonReadScreen { session_id, text }`; `DaemonCaptureSnapshot { session_id, rows, cols, payload_format?, payload_bytes }`; metadata conformance revision `10`; and an exported `late-attach-history-conformance-fixture.json` covering both history-before-live and no-history-before-live event sequences.
- Worktree/target assumption: implementation stays in this assigned botster-web worktree and target. No sibling hub checkout or protocol override is product evidence.

## Scope

1. Pin `@trybotster/hub-test-support` exactly to published version `0.1.3` in `package.json` and `package-lock.json`, install from the registry, and replace the vendored generated protocol file byte-for-byte from the package artifact. Do not hand-edit generated fields.
2. Add narrow typed `readScreen` and `captureSnapshot` behavior at the existing `DaemonBridgeClient.request` boundary. Each helper sends exactly `{ type, session_id }`, returns the matching optional response payload when present, preserves nullable/omitted response semantics, and never interprets snapshot payload metadata as renderable terminal bytes.
3. Pin the concrete consumer to the mounted terminal's existing live-harness control surface. `TerminalViewHost` will expose explicit readback controls backed by its current `TerminalDataPlaneAttachment`; `scripts/live-packaged-protocol-harness.mjs` will invoke them after the existing mounted WebRTC attach and validate their results. No readback request runs merely because attach succeeded.
4. Guard asynchronous readback results by mounted data-plane attachment identity. A response may be surfaced only while the same session/data-plane attachment that issued it remains current; detach, unmount, or replacement makes the late response stale. Focused tests must defer each response, change attachment identity, then prove the old result is ignored rather than applied to the new mount.
5. Promote `terminal_readback` into `requiredDaemonFeatures` in the same diff as the callable production path. Remove the locally synthesized optional-readback warning posture and update compatibility fixtures/assertions so missing `terminal_readback` yields the existing danger-severity `Hub capability missing` diagnostic.
6. Raise `minimumConformanceFixtureRevision` from `1` to the published revision `10`. A hub advertising revision `9` or lower becomes incompatible and yields `Hub conformance fixture mismatch` before feature compatibility is accepted. This is intentional because revision 10 is the released fixture/contract floor consumed by this client.
7. Consume `readLateAttachHistoryConformanceFixture()` from the published package in deterministic browser-side tests. Use its documented JSON for history-before-live ordering and the no-history case instead of importing Rust internals or creating a competing fixture.
8. Extend the default packaged WebRTC live harness to perform both explicit round trips through the mounted production client. Assert request/response session identity, non-empty screen text containing known session output, positive snapshot rows/columns, non-negative payload bytes, and optional payload format semantics while preserving the existing Attach/Drain render and input/resize/exit checks.
9. Update user/developer documentation that currently describes terminal readback as deferred and optional. Name `0.1.3`, revision 10, the explicit harness consumer, required capability behavior, and the distinction between Attach history rendering and readback metadata.

## Non-Scope

- No unconditional `read_screen` or `capture_snapshot` calls during attach, reconnect, polling, render, or subscription setup.
- No rendering `read_screen.text` into Restty, no decoding snapshot payloads, and no second terminal byte stream.
- No replacement or rebuilding of existing Attach/Drain late-history restoration, ordering, renderer writes, or reconnect behavior.
- No browser-owned terminal truth, scrollback/history cache, persistence, replay buffer, or synthetic fallback.
- No hub/core/session-worker changes, direct core/session-worker access, bridge-only truth, or bypass around the hub client protocol.
- No sibling-worktree `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` override as acceptance evidence.
- No broad transport refactor, terminal interface redesign beyond the two narrow optional controls, UI redesign, optional configurability, or adjacent cleanup.

## Assumptions And Unknowns

- Determined fact: `0.1.3` is the first published release after `0.1.2` and contains every DTO and fixture required by this ticket. The implementer must still prove a clean `npm ci` resolves that coordinate and `verifyPackageAssets()` passes.
- Product decision: the concrete consumer is the explicit mounted live-harness control path, not the attach hot path and not a new user-facing rendering surface. This satisfies the ticket's preference for conformance/live-harness consumption without adding round trips to ordinary terminal use.
- Product decision: `read_screen.text` is assertion/readback data only. `capture_snapshot` is session/dimension/format/byte-count metadata only. Neither payload enters `TerminalOutput` or Restty.
- Product decision: stale responses return no usable result after attachment identity changes. They do not mutate UI, renderer, harness state, or a replacement attachment. Exact public typing may use `undefined` for absent/stale results, matching the generated response's omitted/null payload semantics.
- Determined fact: the package exports browser JSON for the late-attach fixture, so mirroring stable JSON is unnecessary.
- Determined fact: raising the fixture floor to 10 rejects older hubs even when their protocol version remains 1. This is required rather than a compatibility waiver because web now consumes revision-10 terminal readback contracts.
- Assumption: the live hub/session-worker binaries used for acceptance are built from the release-compatible hub containing terminal readback. If they are unavailable, implementation must report the exact prerequisite and must not describe deterministic tests as live proof.
- Unknown to verify during implementation: whether a live snapshot currently supplies `payload_format` or omits it. Acceptance must allow both because the generated field is optional/nullable; it must not invent a required format.
- Convention conflicts: none. The plan consumes the published generated boundary, preserves backend terminal truth, uses the existing production WebRTC request path, avoids caches and speculative abstractions, and keeps the consumer explicit.

## Affected Surfaces And Files

- `package.json`, `package-lock.json`: exact `@trybotster/hub-test-support@0.1.3` pin and registry lock metadata.
- `src/botster/generated/daemon-protocol.ts`: byte-for-byte replacement from the published package artifact.
- `src/botster/realHubTerminalDataPlane.ts`: two typed request helpers/methods plus attachment-identity stale-response guarding; no readback-to-renderer path.
- `src/botster/terminal.ts`: narrow optional readback contracts/results on `TerminalDataPlaneAttachment`, with mock behavior only where required by existing test construction.
- `src/botster/TerminalViewHost.tsx`: expose the mounted data plane's two explicit controls to the already test-only live harness object; remove them during the same mount cleanup as existing controls.
- `src/botster/connectionDiagnostics.ts`: require `terminal_readback`, set fixture floor 10, and remove the temporary locally synthesized optional-warning branch/constant.
- `src/App.test.mjs`: package/version/asset assertions; exact request JSON and omitted/null response coverage; stale attachment response tests for both calls; revision/required-feature diagnostics; authoritative late-attach fixture consumption; source guards for the explicit live harness wiring.
- `scripts/live-packaged-protocol-harness.mjs`: call both mounted controls on the existing default WebRTC path and assert returned session/text/dimension/metadata values.
- `README.md`, `docs/architecture.md`: replace deferred/optional wording with the released, required, explicitly consumed contract and older-hub impact.
- `docs/plans/wire-terminal-readback-client.md`: this reviewable plan artifact.

## Implementation Sequence

1. Update the package pin/lock from npm, copy `daemon-protocol.ts` using the package's exported artifact helper or installed file, and immediately run the drift/asset checks. Treat generated output as authoritative.
2. Add the two narrow data-plane operations and tests for exact JSON plus present, `null`, and omitted response fields. Keep response validation scoped to the requested session id.
3. Add an attachment generation/current-identity guard around each in-flight operation. Unit-test detach/replacement before resolution for both RPCs and prove a late old-session payload is discarded.
4. Wire only the existing mounted harness controls to those operations. The runtime path is `TerminalViewHost` mounted attachment -> `RealHubTerminalDataPlane` -> `DaemonBridgeClient.request` -> default WebRTC transport; no call originates from `ensureAttached` or terminal event rendering.
5. Promote compatibility requirements and revision floor together with the calls. Convert ordinary compatible fixtures to revision 10 plus `terminal_readback`; retain dedicated negative fixtures for revision 9 and missing feature diagnostics.
6. Import the package's late-attach JSON into deterministic tests and exercise its history and no-history sequences through `RealHubTerminalDataPlane`.
7. Add live readback assertions after a known output/attach point and before session exit, then update docs and run the full verification matrix.

## Risks

- An implementation may accidentally put two RPCs back on every attach. Guard with source tests and review that only explicit harness control calls invoke them.
- An old attachment's delayed response may be mistaken for the current session after reload or selection change. Require generation/identity tests for both methods, not only session-id equality.
- Optional generated fields may be treated as required. Test omitted and `null` response payloads and omitted/nullable `payload_format` explicitly.
- Readback text may be mistaken for missing Attach history and rendered, duplicating terminal content. Keep the types and live assertions separate from `TerminalOutput` and renderer writes.
- Raising the revision floor can make otherwise-running old hubs show danger. This is intentional, must be documented, and must be proven with an exact revision-9 negative test.
- A stale installed package could make drift evidence misleading. Start acceptance from `npm ci`, assert installed metadata version `0.1.3`, and call `verifyPackageAssets()`.
- The live harness can pass over bridge mode while missing the production path. Run its default mode and assert it reports WebRTC; no transport override is accepted for headline evidence.
- Fixture tests could duplicate upstream JSON and drift. Import the published helper directly and assert metadata revision 10.

## Acceptance Checks And Tests

- `npm ci` resolves `@trybotster/hub-test-support@0.1.3`; a Node assertion confirms `metadata.package_version === "0.1.3"`, `metadata.conformance_fixture_revision === 10`, and `verifyPackageAssets().ok === true`.
- `npm test` passes with the generated-protocol drift check green against the installed published package and no environment override.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Deterministic tests prove:
  - exact `{ type: "read_screen", session_id }` and `{ type: "capture_snapshot", session_id }` requests;
  - typed present results, `null`, and omitted response payloads for both operations;
  - mismatched session responses and responses arriving after detach/replacement are not surfaced;
  - no helper result is written to `TerminalOutput` or Restty;
  - `requiredDaemonFeatures` includes `terminal_readback`, an otherwise-current descriptor missing it yields danger `Hub capability missing`, and no temporary optional-warning row remains;
  - fixture revision 10 is accepted and revision 9 yields danger `Hub conformance fixture mismatch`;
  - the published late-attach fixture's snapshot precedes live output and its no-history scenario remains valid without duplicated history.
- `npm run smoke:live-packaged-protocol` with compatible isolated hub/session-worker binaries proves the actual production entry point: default WebRTC opens, the mounted control issues both daemon requests, read-screen returns the requested session and known text, capture-snapshot returns the requested session plus positive dimensions and valid metadata, and existing reload/history/input/resize/exit/cleanup assertions remain green.
- Final diff review proves every changed line maps to package consumption, readback calls, identity safety, compatibility promotion, fixture use, live proof, documentation, or this plan; no unrelated cleanup is included.

## Pipeline Gates, Artifacts, And Checklist Evidence

- Plan artifact: this file. Attach it to run `run_1783962079_105817` as the durable Plan handoff.
- Plan gate evidence must use the seven required fields: context loaded, scope, assumptions/unknowns, affected surfaces/files, risks, acceptance checks/tests, and vault gaps.
- Project Pipelines workflow checklist evidence: current context loaded; published package inspected; production consumer pinned; acceptance mapped to commands/files; scope checked for no speculative behavior.
- Vault checklist evidence: named notes above constrained the plan; convention conflicts are `none`; plan-time verification includes npm registry versions and inspection of the published `0.1.3` tarball/metadata/DTO/fixture; durable capture disposition is below.
- Checklist creation calls timed out at the plugin-worker boundary during Plan. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], this artifact and gate carry the complete checklist evidence; if the timed-out rows later appear, update them rather than creating duplicates.
- Implement artifact must name the installed published version, exact changed production entry point, fixture revision behavior, command output, and live WebRTC output. Source presence alone is not sufficient.
- Review/Verify must reject unconditional attach calls, readback rendering/caching, handwritten DTO drift, stale-response acceptance, revision-floor ambiguity, bridge-only evidence, or an unwired helper.

## Vault Gaps Worth Capturing

- Candidate after implementation: a durable Botster note that terminal readback is an explicit client operation and not attach-time rendering. Capture only if the implementation/live evidence confirms this as a reusable cross-client contract, not merely this ticket's harness choice.
- Candidate after implementation: attachment-scoped request/response helpers must discard late replies by attachment identity even when the session id matches. Existing notes cover stale transport connects and idempotent mounts, but not this narrower request/readback rule.
- No vault write belongs in the Plan step. The exact published version, revision, and file list are release-specific project facts and remain in this repo plan plus pipeline artifacts.

## Plan-Time Verification Evidence

- `npm view @trybotster/hub-test-support versions --json` returned `0.1.0` through `0.1.3`.
- The published `0.1.3` tarball reports metadata fixture revision 10, exports `./late-attach-history-conformance-fixture`, and includes the authoritative generated daemon protocol.
- The generated artifact contains the two request variants, optional/nullable response fields, screen text DTO, and snapshot metadata DTO.
- Current production code creates `RealHubTerminalDataPlane` over the WebRTC `DaemonBridgeClient`; `TerminalViewHost` installs/removes mounted live-harness controls; the live harness defaults to WebRTC and already invokes those controls for terminal behavior.
- Current compatibility code still treats `terminal_readback` as optional and revision 1 as sufficient, and current docs describe wiring as deferred. Those are the deliberate ticket-owned transitions.
