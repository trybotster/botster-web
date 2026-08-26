# Implement report: vendor the current Restty revision and verify scroll pacing

Ticket: `ticket_1787600689_646958`
Run: `run_1787761714_735678`
Step: `botster_stack_implement` / `run_step_1787764454_901470`
Plan: `docs/plans/vendor-current-restty-revision-and-verify-scroll-pacing.md` revision 4, commit `3259ab86df8345212f283dd78f9b877461560983`, artifact `artifact_1787764083_977190`
Human decisions: `question_1787761913_284316` selected Q1 option B and Q2 option A. `question_1787761969_117759` keeps option B and requires one PTY wheel byte authority.

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1787600689_646958` |
| Merge policy | `direct` (no PR link required) |
| Teardown class | no |

The approved plan used the same `target_id` and repository. All edits stayed in this run worktree.

## Repository playbook and other playbooks/notes applied

Role and charter, in load order:

- `implementer-playbook.md`
- `botster-implementer-playbook.md`
- `botster-web-playbook.md`

Targeted notes:

- `Web vendors a complete Restty build from the approved commit.md`
- `vendored restty uses relative chunk imports so no Vite alias is needed.md`
- `verify pinned ref contents before writing format rules.md`
- `a product baseline is not a causality experiment.md`
- `a one armed capture is not a baseline.md`
- `debug runtime means two complete debug product stacks.md`
- `botster terminal attach owns one size snapshot and live output transaction.md`
- `verification evidence is scoped to a stable commit and clean tree.md`
- `implementation artifacts must match actual git state.md`
- `implement gate must verify committed work and pr link before review.md`
- `implementation steps must persist report artifacts for review.md`
- `pipeline vault checklists must cite exact resolvable note titles.md`
- `spa-patterns.md`

Not loaded:

- `project-pipelines-playbook.md`. This run changes no Project Pipelines package or plugin path.
- `botster runtime teardown lenses.md`. The approved plan sets `teardown_class_applies: false`.

Convention conflicts: none.

## Files changed

New:

- `src/botster/mountScopedWheelReencoder.ts`
- `src/vendor/restty/chunk-qya1z999.js`
- `docs/reports/vendor-current-restty-revision-and-verify-scroll-pacing-implement.md`

Removed:

- `src/vendor/restty/chunk-3mc71e83.js`

Changed:

- `src/vendor/restty/**` — complete vendor replace from `cd1911d0f`. README, `internal.js`, `restty.js`, `xterm.js`, and input type declarations updated. Relative chunk imports remain.
- `src/botster/resttyRenderer.ts` — mount-scoped wheel consume, live cell height and rows, mode-gated send, unmatched drain drop, teardown reset.
- `src/botster/botsterTerminalPtyTransport.ts` — **changed**. Added `writeSemantic()` so a prepared wheel decision cannot fall through as raw bytes when no mode-gated owner exists. `sendInput` uses that helper when a mode-gated path exists.
- `src/botster/mountedKeyboardSmoke.tsx` — G8 viewport oracle, history reader, render flush, scroll-to-bottom.
- `scripts/mounted-terminal-keyboard-smoke.mjs` — G8 lane behind `BOTSTER_MOUNTED_WHEEL_SCROLLBACK=1`.
- `mounted-terminal-keyboard-smoke.html` — bounded host so Restty keeps a viewport smaller than the 400-line history.
- `src/App.test.mjs` — revision and chunk asserts, W1 through W11.
- `scripts/terminal-baseline-capture.mjs` — `RESTTY_RUNTIME_FILES` uses `chunk-qya1z999.js`.
- `scripts/terminal-baseline-observation-format.mjs` — `PINNED_REVISIONS.modular_restty` is `cd1911d0f88606270b1457c6995a3c04cb497edf`. `format_version` stays 3.
- `docs/terminal-baseline-observation-format.md` — post-Restty controlled set is the future comparison set and does not exist yet.
- `package.json` — `smoke:mounted-terminal-wheel-scrollback`.

Did not edit `docs/plans/capture-the-debug-runtime-terminal-regression-baseline.md`.

## Ownership boundaries preserved

`botster-web` owns Restty mounting, input callbacks, resize, and teardown as a renderer integration. This run changed only that repository.

`trybotster/restty` was a build input. The build used a throwaway clean detached checkout, not the dirty local Restty working tree. No Restty upstream file was edited.

Core stays terminal authority. Hub stays content-blind. No new message kind was added.

## Cross-repo dependencies or separately routed work

- Closed dependency `ticket_1787603669_760394` published `format_version=3`. This run consumes that format and does not re-derive it.
- Downstream tickets `ticket_1787600676_914408` and `ticket_1787600679_990088` read the updated modular pin and the blocked controlled-set wording.
- No new dependency ticket was opened.

## Deviations from plan

None of the product scope changed. These are G8-lane details:

1. The shared smoke HTML now constrains `#root` and `.terminal-view-container` to the Playwright viewport with `overflow: hidden`. An unconstrained host made `restty_scrollbar_len` equal `restty_scrollbar_total`, so local history had no scroll range.
2. G8 strips the fixture trailing newline before `emitOutput` so the last painted row is line 400. The frozen fixture still supplies 400 lines of 80 bytes. A trailing newline left a blank cursor row and made a 3-line wheel end on line 398.
3. G8 dispatches one line-mode `WheelEvent` (`deltaY: -1`, `deltaMode: 1`). Vendored Restty converts that to a 3-line local scroll. The lane does not use `page.mouse.wheel`.
4. `botsterTerminalPtyTransport.ts` changed, as allowed by the plan.

## Build provenance

| Check | Result |
| --- | --- |
| P1 clean checkout | `cd1911d0f88606270b1457c6995a3c04cb497edf` in a throwaway clean checkout |
| P1 Ghostty pin | `eb72ec61304ea256be1d86ed8fa961c84e43ecbd` |
| P2 tools | bun `1.4.0`, zig `0.16.0`, `ReleaseSafe` |
| P3 WASM SHA-256 | `e84ec527a0d47d8cb869c15c965280f838e86578a52e9061a69dceac641cb527` (680783 bytes). Same as the previous vendor. |
| P4 GHOSTSNP fixture | `7aba861353b9d45cf28a128ba48e6e3ab0b0b87610d53e7136a591363cc4fd28` |
| P5 vendor tree | one chunk `chunk-qya1z999.js`; `chunk-3mc71e83.js` removed; fonts, grid, and runtime directories present |
| P6 imports | relative only; no Vite alias |

## Tests and downstream proof

Production entry: `src/botster/resttyRenderer.ts` mounts `Restty` and sends wheel bytes through `ptyTransport.writeSemantic`. W1 through W11 load `mountScopedWheelReencoder.ts` and the vendored `createInputHandler`. G5 through G8 render the mounted production path in Chromium.

| Gate | Command | Result |
| --- | --- | --- |
| G1 | `npm run typecheck` | pass |
| G2 | `npm run lint` | pass (5 pre-existing `react-refresh` warnings only) |
| G3 | `npm test` | pass |
| G4 | `npm run build` | pass |
| G5 | `npm run smoke:mounted-terminal-keyboard` | pass |
| G6 | `npm run smoke:ghostsnp-grid` | pass (`90x24`) |
| G7 | `npm run smoke:incremental-ghostsnp-attach` | pass |
| G8 | `npm run smoke:mounted-terminal-wheel-scrollback` | pass |

W1 through W11 ran inside G3. G8 settled on painted line 400, moved 3 lines to painted line 397, kept 80-byte numbered rows, and recorded zero PTY wheel bytes with mouse tracking off.

## Recorded, not claimed

The controlled observation set is blocked. Reason: `botster-ubuntu-24.04-16core` is unavailable, the same reason `ticket_1787603669_760394` recorded.

This report publishes no performance number, no local record, and no controlled record. It does not describe the missing record as an existing transport baseline. It does not claim a typing, attach, scrollback, or wall-clock improvement. It does not attribute a product difference to Restty, Hub, Core, or the client.

## Unverified behavior or residual risk

- The blocked controlled set remains the required future comparison set. This ticket does not fill it.
- G8 proves local scrollback only. PTY report count and direction stay with W2 and W3.
- G8 host CSS is smoke-only. Production `.terminal-view-container` already uses `height: 100%` and `overflow: hidden`.
- `page.mouse.wheel` is unused. G8 uses a cancelable bubbling `WheelEvent` on the canvas.

## Missing vault guidance discovered

The approved plan named three vault gaps. This run did not write inbox notes for them:

- V1 is now code in `mountScopedWheelReencoder.ts`. The plan and this report already record the throwaway-handler failure mode.
- V2 is a one-time chunk rename to `chunk-qya1z999.js`. Discovery happened during this vendor.
- V3 is the single pin update in `scripts/terminal-baseline-observation-format.mjs`.

No new product identity or convention conflict appeared. Durable capture is therefore not required for this ticket.

## Assumptions

- `cd1911d0f88606270b1457c6995a3c04cb497edf` is the approved Restty revision.
- Runtime-teardown lenses do not apply.
- Direct merge policy means this step must commit on the ticket branch and does not need a pull-request link.

## Review return

Review `review_1787766638_259701` sent two findings back.

`finding_1787766638_724111`: `consumeWheelEvent` now requires `applicationMouseActive`. Inactive events reset the accumulator and return no PTY decision. `syncApplicationMouseActive` clears leftover pixels on an off-to-on or on-to-off change, including after `write()` when Restty may have changed mouse modes. W12 proves four inactive `-4` px events leave `0` pending pixels, and the next active `-4` px event does not emit a report. W13 drives `ResttyTerminalRenderer` wheel listeners through `writeSemantic`, a double `encode` stale-retry, a large-delta burst, and unmatched-byte suppression.

`finding_1787766638_589538`: The plan no longer names a user-specific spawn-target path or Restty checkout path. This report no longer names a host checkout directory. A raw `git diff main...HEAD` scan of committed markdown after this commit must not match a user home directory path.
