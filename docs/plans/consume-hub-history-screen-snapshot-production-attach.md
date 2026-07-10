# Document production reattach history and gate terminal readback

## Context Loaded

- Project Pipelines: ticket `ticket_1783552998_259024`, run `run_1783636082_471067`, returned Plan step `run_step_1783637492_223372`, required gate `botster_plan_gate`.
- Prior plan artifact: `artifact_1783636369_244258`. Plan Review `review_1783636622_819323` returned changes required with four substantive findings and verified that playbook loading, cited paths, dependency registration, target selection, and architectural boundaries were otherwise correct.
- Human answer to blocking question `question_1783636572_998255`: option B. Narrow this run to documentation of the already-proven WebRTC history path plus explicit `terminal_readback` compatibility handling. Do not block this run, use sibling protocol artifacts, hand-author DTOs, or add readback RPCs.
- Second Plan Review `review_1783637395_708494` approved every other revision but identified that `requiredDaemonFeatures` would create a false danger diagnostic for an unused capability. Human answer `question_1783637198_813970` selected option A: emit an optional warning diagnostic, keep `terminal_readback` out of required features, and promote it only when the follow-up actually calls readback.
- Follow-up registration is already complete: web readback ticket `ticket_1783636830_504538` depends on hub release ticket `ticket_1783636761_760074` through `dependency_1783636835_187485`.
- Closed source dependency remains `ticket_1783552997_403516`, which merged hub `read_screen`/`capture_snapshot` source support. The web-consumable release does not yet contain those DTOs.
- Required playbooks: [[planner-playbook]] and [[botster-planner-playbook]]. Botster overlays and ticket-specific notes remain those named in the prior artifact, especially [[botster data plane bypasses the hub through session and client actors]], [[botster local client api lives over hubruntime not raw core routers]], [[botster web dto field names must match authoritative rust serde structs]], [[generated typescript dtos must encode serde field optionality]], [[botster web generated protocol drift checks need explicit hub artifact paths]], and [[hub test support npm releases need external consumer smoke]].
- Corrected runtime baseline: `scripts/live-packaged-protocol-harness.mjs` defaults `BOTSTER_LIVE_PACKAGED_TRANSPORT` to `webrtc`, reloads the packaged URL through `reloadSamePackageUrlAndAssertWebrtc`, attaches the existing session, and calls `waitForHistoricalTerminalRestore`. That assertion requires `snapshot.data` or `scrollback.data` and a corresponding renderer write. `RealHubTerminalDataPlane` already writes those events into Restty. Therefore packaged WebRTC reattach history is already implemented and proven; this run documents it instead of rebuilding it.
- Artifact baseline: `@trybotster/hub-test-support` latest is `0.1.2`; neither that release nor the checked-in generated browser protocol exposes `read_screen`, `capture_snapshot`, or `terminal_readback`. The generated DTO drift check treats the package artifact as authoritative.
- Checklist correction: both previously timed-out create calls eventually persisted (`checklist_1783636153_193357`, `checklist_1783636180_382152`). This re-plan updates checklist evidence rather than relying only on the fallback narrative.

## Scope

1. Update `README.md` and `docs/architecture.md` to state precisely that the documented packaged dogfood command defaults to the production WebRTC data plane and already proves browser reload/reconnect, explicit attach to the existing session, renderable history restoration, and continued live terminal behavior.
2. Keep `requiredDaemonFeatures` unchanged. When an otherwise-compatible descriptor omits optional `terminal_readback`, append a warning-severity diagnostic through the existing connection-diagnostics surface. Use an `unsupported_feature`-style stable id/source, but give it clear copy: terminal screen/snapshot readback is optional and not yet available; typed client wiring is deferred to web ticket `ticket_1783636830_504538` pending hub release ticket `ticket_1783636761_760074`. It must not replace the normal success diagnostic or render as danger.
3. Keep `minimumConformanceFixtureRevision = 1` unchanged in this run. Raising the fixture floor to unpublished hub revision 10 would make every currently published web artifact incompatible without giving web the missing DTOs.
4. Extend focused tests in `src/App.test.mjs` for the optional warning and unchanged fixture-floor decision, plus source/documentation assertions that the packaged WebRTC history proof remains wired.
5. Document that typed `read_screen`/`capture_snapshot` client wiring is deferred to `ticket_1783636830_504538`, gated on release ticket `ticket_1783636761_760074`.

## Non-Scope

- No changes to `RealHubTerminalDataPlane`, `webrtcDaemonClient`, `dogfoodMode`, `App`, `TerminalViewHost`, the live harness runtime flow, Restty, or terminal event ordering.
- No `read_screen` or `capture_snapshot` requests, attach-time side effects, readback UI/status, browser cache, or parallel terminal truth.
- No generated daemon protocol edits, dependency-version bump, sibling hub checkout, `BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL` override as evidence, or compatibility DTO maintained beside generated types.
- No bridge/SSE-only proof, broad visual redesign, terminal rewrite, hub/core changes, or adjacent cleanup.

## Assumptions And Unknowns

- Determined fact: production packaged reattach history is already delivered and tested through WebRTC. This is existing baseline evidence, not implementation scope.
- Determined fact: web cannot honestly add typed readback requests until a published hub-test-support release contains the generated DTOs. Human option B explicitly defers that work.
- Decision: `terminal_readback` is optional in this run. Its absence produces a warning, while the five current required features continue to define whether botster-web can function. Promotion to `requiredDaemonFeatures` belongs in `ticket_1783636830_504538`, when web actually invokes readback.
- Decision: the minimum conformance fixture revision remains 1. Revision 10 is not consumable from the current published artifact.
- Assumption: existing `compatibilityDiagnostic()` behavior reports each missing required feature through the current connection diagnostics surface. Implementation should reuse it, not add a second diagnostic system.
- Worktree/target: all implementation occurs in this assigned botster-web worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.
- No remaining ambiguity requires a human question. The two human answers pin the reduced scope, optional-warning behavior, and deferral.
- Convention conflicts: none. The reduced plan is smaller, keeps protocol authority in generated hub artifacts, uses existing diagnostics, and avoids speculative runtime behavior.

## Affected Surfaces And Files

- `src/botster/connectionDiagnostics.ts`: leave `requiredDaemonFeatures` and `minimumConformanceFixtureRevision` unchanged; append one warning diagnostic when an otherwise-compatible descriptor omits optional `terminal_readback`.
- `src/App.test.mjs`: add a focused fixture for the optional warning. Deliberately leave the existing five-feature compatible descriptors at the current fixture sites (around lines 2740, 2866, 3025, and 3075) unchanged. Preserve the assertions that this descriptor yields `Hub compatibility descriptor compatible` and no danger diagnostic (around lines 2853 and 5589), while also asserting the optional readback row is warning severity and renders as a warning.
- `README.md`: clarify that the default live packaged command is WebRTC and explicitly names reload/reattach history proof; record readback deferral tickets.
- `docs/architecture.md`: document event-history ownership, the existing WebRTC proof, compatibility feature gating, and deferred typed readback.
- `docs/plans/consume-hub-history-screen-snapshot-production-attach.md`: this revised handoff artifact.

## Implementation Shape

1. Run `npm ci`, then report the resolved `@trybotster/hub-test-support` version. Do not accept the pre-existing stale `node_modules` tree as evidence.
2. Add one narrow optional-feature warning through `compatibilityDiagnosticsFromFrame`; preserve the existing required feature list and compatible success row. Do not introduce new state, stores, or a second diagnostic system.
3. Amend docs to point at the actual runtime path: packaged mode -> WebRTC client -> public daemon Attach/Drain -> `RealHubTerminalDataPlane` -> Restty, with history asserted after reload by the existing live harness.
4. Name both follow-up tickets in docs so the temporary compatibility-only disposition is reviewable and does not silently become permanent.
5. Run deterministic checks and the existing live packaged command when compatible hub/session-worker binaries are available; attach exact evidence.

## Risks

- Optional readback copy could still sound like a broken product. Keep severity at warning and state that current Attach/Drain terminal history works; only future screen/snapshot readback wiring is deferred.
- Raising the fixture revision prematurely would create broader incompatibility without usable DTOs. Keep the floor at 1 and test that decision.
- Documentation could still imply bridge transport or net-new history work. It must say WebRTC is the default and the history path already exists.
- A source-only test could overstate runtime proof. Acceptance continues to rely on the existing packaged WebRTC live harness for history, while this diff only documents and protects that proof.
- Stale local dependencies can produce misleading drift failures. Use `npm ci` and record the resolved installed package version.
- The deferred ticket could be lost if docs omit its release dependency. Name both `ticket_1783636830_504538` and `ticket_1783636761_760074`.

## Acceptance Checks And Tests

- `npm ci`, followed by an exact resolved-version check for `@trybotster/hub-test-support` (expected `0.1.2` until the release ticket lands).
- `npm test`: generated protocol drift and application assertions pass from the clean install.
- `npm run typecheck`, `npm run lint`, and `npm run build`.
- Focused deterministic coverage proves:
  - `requiredDaemonFeatures` remains exactly the current five functional requirements and does not include `terminal_readback`;
  - an otherwise-compatible descriptor without `terminal_readback` still yields `Hub compatibility descriptor compatible`, plus a distinct warning-severity optional readback diagnostic naming both follow-up tickets;
  - the optional diagnostic is not danger and does not sort/render as a red broken-state row;
  - `minimumConformanceFixtureRevision` remains 1;
  - documentation/source guards identify WebRTC as the default live packaged transport and retain the reload -> attach -> historical restore path.
- `npm run smoke:live-packaged-protocol` with compatible isolated hub/session-worker binaries remains the runtime proof: default transport is WebRTC, browser reload renews WebRTC bootstrap, explicit attach restores non-empty `snapshot.data`/`scrollback.data` into the renderer before continued live behavior, then input/resize/exit/cleanup still pass.
- If live binaries are unavailable, implementation must attach the exact missing prerequisite; deterministic success alone must not be described as rerunning the live proof.
- Diff review confirms no generated DTO changes, no readback requests, no browser cache, no sibling artifact path, and no hub/core bypass.

## Pipeline Gates And Artifacts

- Revised plan artifact: this file, superseding the scope in `artifact_1783636369_244258`.
- Plan Review findings addressed:
  - unpublished artifact blocker resolved by human option B and registered follow-up/dependency;
  - false bridge-only premise corrected to existing WebRTC proof;
  - speculative attach RPCs removed;
  - `connectionDiagnostics.ts` and the fixture-revision decision are explicit;
  - verification requires `npm ci` and resolved-version evidence.
- Second Plan Review finding addressed: `terminal_readback` remains optional, the false required-feature danger is removed, warning behavior is pinned by `question_1783637198_813970`, and exact affected/unchanged `App.test.mjs` fixture groups are named.
- Implement gate should attach the small changed-file list, clean dependency version, deterministic command output, live command output or exact unavailable prerequisite, and production-path documentation evidence.
- Review/Verify should reject scope growth into generated DTOs, readback RPCs, new terminal state, harness rewrites, or claims that this run newly implements reattach history.

## Vault Gaps Worth Capturing

- Capture after the release/follow-up lands if Botster establishes a durable rule for warning about an optional future capability before a client can consume its typed operations; this run records a human-scoped transitional decision, not a general convention.
- Capture the released terminal-readback artifact contract in the follow-up ticket when package version, DTOs, and fixtures actually exist.
- No durable vault write is needed from this re-plan. The premise correction and ticket routing are already preserved in Project Pipelines review, question, dependency, and artifact records.

## Plan-Time Verification Evidence

- `scripts/live-packaged-protocol-harness.mjs`: default transport is `webrtc`; the reload loop renews/asserts WebRTC and then calls `waitForHistoricalTerminalRestore`.
- `waitForHistoricalTerminalRestore`: requires an output sourced from `snapshot` or `scrollback` with string data and asserts a renderer write.
- `src/botster/realHubTerminalDataPlane.ts`: handles renderable `snapshot`/`scrollback` before live output handling.
- `src/botster/connectionDiagnostics.ts`: current required features omit `terminal_readback`; fixture revision is 1; `unsupported_feature` already maps to warning/compatibility, so the existing diagnostic surface is the intended edit point.
- `npm view @trybotster/hub-test-support versions --json`: only `0.1.0`, `0.1.1`, and `0.1.2` exist; readback DTO consumption remains deferred.
