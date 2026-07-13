# Wire terminal readback from the published hub contract

## Context Loaded

- Project Pipelines: ticket `ticket_1783636830_504538`, run `run_1783962079_105817`, returned Plan step `run_step_1783963300_314842`, target `tgt_40abcf71ccf049f4ac0c99953a799869`, and required gate `botster_plan_gate`. Both registered dependencies are closed. The first plan is `artifact_1783962815_537338`; Plan Review `review_1783963261_946811` returned changes required with seven findings.
- Superseding human answer `question_1783962965_554228` selected option B: this ticket is intentionally conformance-readiness scaffolding with no production invocation. Keep `terminal_readback` optional/warning, keep `minimumConformanceFixtureRevision` at `1`, and do not invent a user-facing control merely to justify promotion. This answer waives the older ticket requirements to promote the feature, raise the fixture floor, and claim a changed production path.
- Required planning authority: [[identity]], [[goals]], [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[botster pipeline needs continuous product owner between agent steps]], and [[plan agents must author vault context as wikilinks not home paths]].
- Ticket-specific constraints: [[plan steps need reviewable plan artifacts]], [[generated typescript dtos must encode serde field optionality]], [[hub test support npm releases need external consumer smoke]], [[mounted browser terminal attach is idempotent by attachment identity]], [[terminal session switches must cancel in-flight webrtc pty connects]], [[coredaemon must expose terminal truth used by the production hub path]], [[lifecycle guards evaluated before the reconciling drain are one call stale]], and [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repository path inspected: `package.json`, `package-lock.json`, `scripts/check-daemon-protocol-drift.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/connectionDiagnostics.ts`, `src/botster/dogfoodMode.ts`, `src/botster/generated/daemon-protocol.ts`, `src/botster/realHubDaemonDto.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/terminal.ts`, `src/botster/TerminalViewHost.tsx`, `README.md`, `docs/architecture.md`, and the predecessor plan `docs/plans/consume-hub-history-screen-snapshot-production-attach.md`.
- Published dependency evidence: npm exposes `@trybotster/hub-test-support@0.1.3`. Its published tarball contains generated `read_screen` and `capture_snapshot` requests; optional/nullable `DaemonResponse.read_screen` and `.capture_snapshot`; `DaemonReadScreen { session_id, text }`; `DaemonCaptureSnapshot { session_id, rows, cols, payload_format?, payload_bytes }`; metadata conformance revision `10`; and an exported `late-attach-history-conformance-fixture.json` covering both history-before-live and no-history-before-live event sequences.
- Worktree/target assumption: implementation stays in this assigned botster-web worktree and target. No sibling hub checkout or protocol override is product evidence.

## Scope

1. Pin `@trybotster/hub-test-support` exactly to published version `0.1.3` in `package.json` and `package-lock.json`, install from the registry, and replace the vendored generated protocol file byte-for-byte from the package artifact. Do not hand-edit generated fields.
2. Add narrow typed `readScreen` and `captureSnapshot` behavior at the existing `DaemonBridgeClient.request` boundary. Each helper sends exactly `{ type, session_id }`, returns the matching optional response payload when present, preserves nullable/omitted response semantics, and never interprets snapshot payload metadata as renderable terminal bytes.
3. Pin the concrete consumer to the mounted terminal's existing Playwright-only live-harness control surface. `TerminalViewHost` will expose readback controls only when `window.__BOTSTER_LIVE_PROTOCOL_HARNESS__` was injected by the harness; `scripts/live-packaged-protocol-harness.mjs` will invoke them after the existing mounted WebRTC attach and validate their results. No shipped browser session installs these controls, and no readback request runs merely because attach succeeded.
4. Guard asynchronous readback results by mounted data-plane attachment identity. A response may be surfaced only while the same session/data-plane attachment that issued it remains current; detach, unmount, or replacement makes the late response stale. Focused tests must defer each response, change attachment identity, then prove the old result is ignored rather than applied to the new mount.
5. Consume `readLateAttachHistoryConformanceFixture()` from the published package in deterministic browser-side tests. Use its documented JSON for history-before-live ordering and the no-history case instead of importing Rust internals or creating a competing fixture.
6. Extend the default packaged WebRTC live harness to perform both explicit round trips through the mounted conformance client. Assert request/response session identity, non-empty screen text containing known session output, positive snapshot rows/columns, non-negative payload bytes, and optional payload format semantics while preserving the existing Attach/Drain render and input/resize/exit checks.
7. Preserve compatibility posture deliberately: do not change `requiredDaemonFeatures`, `terminalReadbackOptionalDiagnosticId`, its warning branch, or `minimumConformanceFixtureRevision = 1`. Add regression assertions that prevent package metadata revision 10 or the published support matrix from silently changing those hand-owned client decisions.
8. Update user/developer documentation that currently says typed helpers are deferred. Name the `0.1.3` package pin, the Playwright-only conformance consumer, the unchanged optional/warning capability and revision-1 floor, the lack of production invocation, and the distinction between Attach history rendering and readback metadata.

## Non-Scope

- No unconditional `read_screen` or `capture_snapshot` calls during attach, reconnect, polling, render, or subscription setup.
- No rendering `read_screen.text` into Restty, no decoding snapshot payloads, and no second terminal byte stream.
- No replacement or rebuilding of existing Attach/Drain late-history restoration, ordering, renderer writes, or reconnect behavior.
- No browser-owned terminal truth, scrollback/history cache, persistence, replay buffer, or synthetic fallback.
- No hub/core/session-worker changes, direct core/session-worker access, bridge-only truth, or bypass around the hub client protocol.
- No sibling-worktree `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` override as acceptance evidence.
- No change to `requiredDaemonFeatures`, `terminalReadbackOptionalDiagnosticId`, its warning behavior, or `minimumConformanceFixtureRevision = 1`; do not reconcile the published support matrix's additional required features in this ticket.
- No new user-facing readback control and no claim that a shipped browser invokes either RPC.
- No broad transport refactor, terminal interface redesign beyond the two narrow optional controls, UI redesign, optional configurability, or adjacent cleanup.

## Assumptions And Unknowns

- Determined fact: `0.1.3` is the first published release after `0.1.2` and contains every DTO and fixture required by this ticket. The implementer must still prove a clean `npm ci` resolves that coordinate and `verifyPackageAssets()` passes.
- Superseding product decision: the concrete consumer is the Playwright-injected mounted live-harness control path only. This ticket intentionally delivers conformance-readiness scaffolding; it does not change a production or user path and must not be presented as doing so.
- Product decision: `read_screen.text` is assertion/readback data only. `capture_snapshot` is session/dimension/format/byte-count metadata only. Neither payload enters `TerminalOutput` or Restty.
- Product decision: stale responses return no usable result after attachment identity changes. They do not mutate UI, renderer, harness state, or a replacement attachment. Exact public typing may use `undefined` for absent/stale results, matching the generated response's omitted/null payload semantics.
- Determined fact: the package exports browser JSON for the late-attach fixture, so mirroring stable JSON is unnecessary.
- Determined fact: package metadata revision 10 does not automatically set the hand-owned web compatibility floor. `minimumConformanceFixtureRevision` remains 1, so older revision-1 hubs remain compatible.
- Assumption: the live hub/session-worker binaries used for acceptance are built from the release-compatible hub containing terminal readback. If they are unavailable, implementation must report the exact prerequisite and must not describe deterministic tests as live proof.
- Unknown to verify during implementation: whether a live snapshot currently supplies `payload_format` or omits it. Acceptance must allow both because the generated field is optional/nullable; it must not invent a required format.
- Convention/ticket conflict and resolution: the original ticket required promotion and production-path proof, but repository evidence showed the proposed harness consumer is inert outside Playwright. Plan Review escalated instead of silently waiving either side; `question_1783962965_554228` option B explicitly waives those requirements and authorizes scaffold-only delivery. The revised plan otherwise follows generated protocol authority, backend terminal truth, attachment lifecycle safety, and minimal-scope conventions.

## Affected Surfaces And Files

- `package.json`, `package-lock.json`: exact `@trybotster/hub-test-support@0.1.3` pin and registry lock metadata.
- `src/botster/generated/daemon-protocol.ts`: byte-for-byte replacement from the published package artifact.
- `src/botster/realHubTerminalDataPlane.ts`: two typed request helpers/methods plus attachment-identity stale-response guarding; no readback-to-renderer path.
- `src/botster/terminal.ts`: narrow optional readback contracts/results on `TerminalDataPlaneAttachment`, with mock behavior only where required by existing test construction.
- `src/botster/TerminalViewHost.tsx`: expose the mounted data plane's two explicit controls to the already test-only live harness object; remove them during the same mount cleanup as existing controls.
- `src/botster/connectionDiagnostics.ts`: protected non-change surface; keep optional warning behavior and revision floor 1 exactly as-is.
- `src/App.test.mjs`: package/version/asset assertions; exact request JSON and omitted/null response coverage; stale attachment response tests for both calls; regression assertions for unchanged optional/revision-1 compatibility; authoritative late-attach fixture consumption; source guards for the Playwright-only live harness wiring.
- `scripts/live-packaged-protocol-harness.mjs`: call both mounted controls on the existing default WebRTC path and assert returned session/text/dimension/metadata values.
- `README.md`, `docs/architecture.md`: replace helper-deferral wording with the released conformance-only wiring while preserving optional capability and revision-1 compatibility documentation.
- `docs/plans/wire-terminal-readback-client.md`: this reviewable plan artifact.

## Implementation Sequence

1. Update the package pin/lock from npm, copy `daemon-protocol.ts` using the package's exported artifact helper or installed file, and immediately run the drift/asset checks. Treat generated output as authoritative.
2. Add the two narrow data-plane operations and tests for exact JSON plus present, `null`, and omitted response fields. Keep response validation scoped to the requested session id.
3. Add an attachment generation/current-identity guard around each in-flight operation. Unit-test detach/replacement before resolution for both RPCs and prove a late old-session payload is discarded.
4. Wire only the existing Playwright-injected mounted harness controls to those operations. The conformance path is `TerminalViewHost` mounted attachment -> `RealHubTerminalDataPlane` -> `DaemonBridgeClient.request` -> default WebRTC transport; no call originates from shipped UI, `ensureAttached`, or terminal event rendering.
5. Keep compatibility constants and warning behavior untouched. Add inverse regression assertions: `terminal_readback` remains absent from `requiredDaemonFeatures`, the optional warning remains, and revision 1 remains compatible despite package metadata revision 10.
6. Import the package's late-attach JSON into deterministic tests and exercise its history and no-history sequences through `RealHubTerminalDataPlane`.
7. Add live readback assertions after a known output/attach point and before session exit, then update docs to label the path honestly as conformance-only and run the full verification matrix.

## Risks

- An implementation may accidentally put two RPCs back on every attach. Guard with source tests and review that only explicit harness control calls invoke them.
- An old attachment's delayed response may be mistaken for the current session after reload or selection change. Require generation/identity tests for both methods, not only session-id equality.
- Optional generated fields may be treated as required. Test omitted and `null` response payloads and omitted/nullable `payload_format` explicitly.
- Readback text may be mistaken for missing Attach history and rendered, duplicating terminal content. Keep the types and live assertions separate from `TerminalOutput` and renderer writes.
- Published package metadata and its support matrix may tempt implementation to broaden the hand-owned web compatibility requirements. Guard the unchanged optional feature and revision-1 floor with explicit tests and non-scope wording.
- A stale installed package could make drift evidence misleading. Start acceptance from `npm ci`, assert installed metadata version `0.1.3`, and call `verifyPackageAssets()`.
- The live harness can pass over bridge mode and hide a broken WebRTC conformance path. Run its default mode and assert it reports WebRTC, while stating plainly that even this proof is not a shipped production invocation.
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
  - `requiredDaemonFeatures` still omits `terminal_readback`, a descriptor missing it still yields `terminalReadbackOptionalDiagnosticId` at warning severity rather than danger, and the existing compatible-success row remains;
  - `minimumConformanceFixtureRevision` remains 1 and a revision-1 hub remains compatible; published metadata revision 10 is asserted as package provenance, not adopted as the client floor;
  - the published late-attach fixture's snapshot precedes live output and its no-history scenario remains valid without duplicated history.
- `npm run smoke:live-packaged-protocol` with compatible isolated hub/session-worker binaries proves the Playwright-injected conformance path: default WebRTC opens, the mounted control issues both daemon requests, read-screen returns the requested session and known text, capture-snapshot returns the requested session plus positive dimensions and valid metadata, and existing reload/history/input/resize/exit/cleanup assertions remain green. Evidence must say this is not production invocation.
- Final diff review proves every changed line maps to package consumption, readback scaffolding, identity safety, unchanged-compatibility regression coverage, fixture use, conformance proof, documentation, or this plan; no unrelated cleanup is included.

## Pipeline Gates, Artifacts, And Checklist Evidence

- Plan artifact: this file. Attach it to run `run_1783962079_105817` as the durable Plan handoff.
- Plan gate evidence must use the seven required fields: context loaded, scope, assumptions/unknowns, affected surfaces/files, risks, acceptance checks/tests, and vault gaps.
- Project Pipelines workflow checklist evidence: returned context and review loaded; superseding answer applied; published package inspected; conformance-only consumer pinned; acceptance mapped to commands/files; scope checked for no speculative behavior.
- Vault checklist evidence: named notes above constrained the plan; the production-proof/ticket conflict and human resolution are recorded; plan-time verification includes npm registry versions and inspection of the published `0.1.3` tarball/metadata/DTO/fixture; durable capture disposition is below.
- Checklist creation calls timed out at the plugin-worker boundary during Plan. Per [[project pipelines checklist worker timeouts require artifact evidence fallback]], this artifact and gate carry the complete checklist evidence; if the timed-out rows later appear, update them rather than creating duplicates.
- Implement artifact must name the installed published version, exact Playwright harness entry point, unchanged compatibility posture, command output, and live WebRTC output, and explicitly label the delivery conformance-readiness scaffolding with no production invocation.
- Review/Verify must reject unconditional attach calls, readback rendering/caching, handwritten DTO drift, stale-response acceptance, compatibility promotion, a new user-facing control, bridge-only evidence, or any production-path claim.

## Vault Gaps Worth Capturing

- Candidate after implementation: a durable Botster note that terminal readback is an explicit client operation and not attach-time rendering. Capture only if the implementation/live evidence confirms this as a reusable cross-client contract, not merely this ticket's harness choice.
- Candidate after implementation: attachment-scoped request/response helpers must discard late replies by attachment identity even when the session id matches. Existing notes cover stale transport connects and idempotent mounts, but not this narrower request/readback rule.
- No vault write belongs in the Plan step. The exact published version, revision, and file list are release-specific project facts and remain in this repo plan plus pipeline artifacts.

## Plan-Time Verification Evidence

- `npm view @trybotster/hub-test-support versions --json` returned `0.1.0` through `0.1.3`.
- The published `0.1.3` tarball reports metadata fixture revision 10, exports `./late-attach-history-conformance-fixture`, and includes the authoritative generated daemon protocol.
- The generated artifact contains the two request variants, optional/nullable response fields, screen text DTO, and snapshot metadata DTO.
- Current production code creates `RealHubTerminalDataPlane` over the WebRTC `DaemonBridgeClient`, but `TerminalViewHost` installs mounted live-harness controls only when Playwright injected `window.__BOTSTER_LIVE_PROTOCOL_HARNESS__`; nothing in shipped `src/` creates that global.
- Current compatibility code treats `terminal_readback` as optional and revision 1 as sufficient. Per `question_1783962965_554228`, those are protected non-changes; only the typed helper/harness deferral changes.
