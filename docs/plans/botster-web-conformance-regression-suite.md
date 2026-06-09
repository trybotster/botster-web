# Botster Web Conformance Regression Suite Plan

## Context Loaded

- Pipeline context: ticket `ticket_1781034379_541483`, run `run_1781034385_476980`, active step `botster_plan`, gate `botster_plan_gate`, no prior artifacts, findings, questions, or answers.
- Required playbooks: [[planner-playbook]], [[botster-planner-playbook]].
- Required Botster overlay notes: [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Ticket-specific vault constraints: [[botster hub client crate is the external client boundary]], [[external client hub tests use subprocess spawned hub test support]], [[tui client attach uses hub protocol not session protocol]], [[per request http sockets cause immediate terminal subscription detach]], [[runtime client acceptance must render delivered snapshots through real registry]], [[botster-web should import canonical core uinode fixtures instead of mirroring them]], [[botster-web ionic supersedes catalyst for client shell]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `package.json`, `src/App.tsx`, `src/App.test.mjs`, `src/botster/client.ts`, `src/botster/protocol.ts`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/realHubTerminalDataPlane.ts`, `src/botster/TerminalViewHost.tsx`, `src/botster/terminal.ts`, `src/theme/app.css`, `scripts/real-hub-dogfood-bridge.mjs`, `README.md`, `docs/architecture.md`, and existing `docs/plans/real-hub-dogfood-path.md`.
- Baseline verification: `npm test` passes with `Renderer seam, runtime behavior, and registry fixture assertions passed.`
- Plan Review context: `review_1781034747_835101` returned changes required. Open findings require this revised plan to diff against existing `src/App.test.mjs`, avoid tautological desktop checks, decide stream-close cleanup semantics, and route new coverage through the compiled-runtime harness.
- Checklist evidence: `project_pipelines_create_vault_checklist` initially timed out with `plugin worker invoke timeout`, but `checklist_1781034446_598151` later persisted. This revision updates that checklist and preserves evidence in gate artifacts as the fallback record.

## Existing Coverage Vs Gap

The implementation should add marginal conformance coverage, not rewrite the current suite. Existing `src/App.test.mjs` coverage already proves:

- Daemon DTO shape/source boundary exists: `DaemonRequest`, `DaemonResponse`, `DaemonEvent`, and `daemon_request` envelope string guards at lines 91-102.
- Negative control-plane boundary guard: `protocol.ts`, `localDogfoodTransport.ts`, and `realHubDogfoodTransport.ts` must not contain terminal byte frame names at lines 155-158.
- The compiled-runtime harness imports the real runtime modules under test at lines 200-222.
- Real mode requires both build-time env and `?dogfood=real-hub` at lines 470-485.
- HTTP bridge request envelopes carry `kind: "daemon_request"` and verbatim status payload at lines 487-509.
- Real transport behavior requests status/list/spawn and emits UI/entity/action frames at lines 511-532.
- Operator errors map into `operator_error` frames at lines 534-544.
- Terminal data-plane output/input/resize/detach are covered through `createRealHubTerminalDataPlane()` at lines 546-561.
- Delivered dogfood snapshots are rendered through the Ionic registry and entity store at lines 621-759.

True remaining gaps for this ticket:

- Add an explicit anti-demo regression in the compiled-runtime path: real-hub mode must not use local fixture session ids, local fixture entity frames, or mock terminal data when both opt-ins are present.
- Add stream-close cleanup coverage at the bridge/client boundary. Current `RealHubTerminalDataPlane` only closes the stream from explicit `detach()`, while final listener unsubscribe only removes the listener. The plan chooses a scoped runtime behavior change: when the last output listener unsubscribes, close the held `streamTerminal()` subscription without sending daemon `detach`; explicit `detach()` remains the path that sends the daemon detach request and clears listeners. Add behavioral assertions for both paths.
- Replace current desktop string-presence assertions with a non-tautological CSS contract assertion: parse or structurally extract the base `.workspace-grid` rule and assert it has a multi-column `grid-template-columns`; assert `.terminal-panel` has bounded `max-height`; assert the single-column `.workspace-grid { grid-template-columns: 1fr; }` rule is inside `@media (max-width: 860px)`.
- Keep existing source-string guards only for negative protocol-boundary checks. New real-hub assertions should use the compiled-runtime harness wherever possible.

## Scope

- Add or tighten `botster-web` regression coverage around the existing real hub dogfood path:
  - status and session listing through the real hub bridge adapter;
  - semantic session action flow including spawn/select and error result;
  - terminal stream attach/drain through the held Restty data-plane boundary;
  - terminal input and resize where the bridge supports them;
  - stream close and detach cleanup;
  - teardown/shutdown behavior through the bridge harness;
  - desktop layout smoke checks for the primary dogfood shell.
- Preserve the shared boundary: browser code may adapt `DaemonRequest`, `DaemonResponse`, and `DaemonEvent` DTOs, but must not invent a durable web-only Botster protocol or add terminal byte frames to `src/botster/protocol.ts`.
- Keep the production runtime path wired through `src/App.tsx`, `createDogfoodRuntimeConfig()`, `createBotsterWebClient()`, and `TerminalViewHost`; tests must prove this path rather than only inspecting source strings.
- Keep deterministic fixture coverage for renderer/unit paths, but label it as fallback support, not real hub conformance evidence.
- Update `README.md` or `docs/architecture.md` only where command names or conformance expectations need to match the regression suite.

## Non-Scope

- No edits to botster-hub, botster-core, botster-tui, session-worker, or the hub conformance fixtures from this branch.
- No production WebRTC/browser transport work; the same-device dogfood bridge remains a local dev/test harness.
- No broad UI redesign, state-library change, Ionic replacement, Restty replacement, or dependency churn.
- No mutation of the user's real Botster identity or durable home state; real-hub checks must use isolated temp data and neutral ids.
- No new mirrored UiNode fixture grammar; reuse existing `src/botster/__fixtures__` provenance and record canonical fixture import unavailability as a vault/repo gap.

## Assumptions And Unknowns

- Assumption: the existing `scripts/real-hub-dogfood-bridge.mjs` is the intended local harness for botster-web-only conformance coverage.
- Assumption: in this repo, `npm test` is the primary automated regression entrypoint; new coverage should fit that runner unless browser-level coverage is truly required.
- Assumption: desktop layout smoke coverage should start with a non-tautological CSS contract parser/extractor in `npm test`, since no browser automation dependency currently exists and the ticket asks for regression smoke rather than pixel-perfect layout verification.
- Unknown: whether the implementer environment has compatible `BOTSTER_HUB_BIN` and `BOTSTER_SESSION_WORKER_BIN` binaries available. If unavailable, tests should still cover adapter/harness behavior with deterministic bridge fakes, and docs must preserve the exact live command for Verify to rerun where binaries exist.
- Unknown: whether canonical core UiNode fixtures are importable from this botster-web checkout. If not, do not block the ticket; keep local fixture provenance explicit and record the import seam as a vault/repo gap.
- Unknown: whether a lightweight browser runner is acceptable. Prefer not adding one unless Node/SSR coverage cannot prove desktop layout basics.

## Affected Surfaces And Files

- `src/App.test.mjs`: extend the existing compiled-runtime harness with only the remaining conformance gaps: anti-demo real mode assertions, stream-close cleanup assertions, and structural CSS desktop contract assertions.
- `src/botster/realHubDogfoodTransport.ts`: may need small testability exports or stricter behavior around response-to-frame mapping and operator-error/action-result paths.
- `src/botster/realHubTerminalDataPlane.ts`: scoped behavior change to close the held stream when the final output listener unsubscribes; do not send daemon `detach` from that unsubscribe path. Keep explicit `detach()` as the daemon detach/clear-all path.
- `scripts/real-hub-dogfood-bridge.mjs`: add harness-level assertions or minor fixes if attach/drain cleanup, teardown, or error surfaces are not already testable.
- `src/App.tsx` and `src/botster/dogfoodMode.ts`: only touch if the current production entry point cannot be behavior-tested as wired.
- `src/theme/app.css`: only touch if desktop layout smoke reveals the primary dogfood screen can collapse or overflow at desktop dimensions.
- `README.md` and `docs/architecture.md`: align test/docs commands and explicitly distinguish fixture fallback from real hub conformance evidence.

## Risks

- The suite could pass by testing bridge fakes while the real app still uses fixture/demo state. Mitigation: drive `createDogfoodRuntimeConfig()` and `createBotsterWebClient()` through the compiled-runtime harness and assert real mode does not expose local fixture session ids or mock terminal data.
- Terminal stream coverage could accidentally use one-shot request sockets. Mitigation: assert the `/terminal` stream path or fake bridge `streamTerminal()` remains held until cleanup.
- Cleanup could remain unproven if listener unsubscribe and `detach()` semantics are conflated. Mitigation: explicitly test final-listener unsubscribe closes the held stream without daemon detach, and explicit `detach()` sends the daemon detach request.
- Desktop layout smoke can remain tautological if it only matches selector names. Mitigation: parse/extract rule bodies and media-query placement for desktop columns, bounded terminal panel, and mobile-only single-column fallback.
- Mirrored local fixtures can drift from core. Mitigation: prefer canonical fixture import if available; otherwise keep provenance and record the gap.

## Acceptance Checks And Tests

- `npm test` must fail if real-hub mode regresses to local demo fixtures or bypasses the shared daemon DTO assumptions.
- `npm test` should include behavior coverage for:
  - real-mode selection requiring both `VITE_BOTSTER_REAL_HUB_DOGFOOD=1` and `?dogfood=real-hub`;
  - real-hub mode not returning local fixture session ids, fixture entity families as proof, or `terminalDataPlaneKind: "mock"`;
  - status/list responses becoming `botster-web.hub_status` and `botster-web.session` entity frames;
  - semantic action dispatch producing spawn/select and operator-error/action-result behavior;
  - terminal stream attach receiving output through `RealHubTerminalDataPlane`;
  - input, resize, explicit detach, and final-listener stream-close cleanup behavior;
  - source/boundary guard that `protocol.ts` does not gain terminal byte frame names such as `terminal_input`, `terminal_output`, or `pty_bytes`;
  - delivered dogfood snapshots rendered through the real Ionic registry and entity store, not only parallel fixtures;
  - desktop shell CSS contract: base `.workspace-grid` is a two-column grid, `.terminal-panel` has bounded desktop height, and the single-column `.workspace-grid` rule is gated by `@media (max-width: 860px)`.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` after implementation.
- If compatible hub binaries are available, run the documented live bridge command with explicit temp data and capture status/list, spawn, attach/drain marker, input where supported, error, resize, and teardown evidence. If unavailable, record the exact missing binary prerequisite rather than treating fixture tests as live-hub proof.

## Pipeline Gates And Artifacts

- Plan gate evidence should point to this plan and include the checklist timeout fallback.
- Plan Review should reject any implementation plan that treats fixture-only coverage as satisfying real hub conformance.
- Implement gate should include command output for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and live bridge evidence or exact unavailable-binary evidence.
- Verify should re-run the same commands and inspect that changed lines trace to this ticket's coverage intent.

## Vault Gaps Worth Capturing

- Capture if botster-web establishes a durable convention for Node-only conformance tests around a same-device hub bridge.
- Capture if terminal data-plane cleanup needs a clearer cross-client rule for listener unsubscribe versus explicit detach.
- Capture if canonical core UiNode fixtures remain unavailable to botster-web, because the current local mirror is still a known drift risk.
