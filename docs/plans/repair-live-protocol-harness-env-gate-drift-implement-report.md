# Implement report — live-protocol harness env-gate repair

Ticket: `ticket_1786042828_142991`  
Run: `run_1786060051_411729`  
Step: `botster_stack_implement`  
Commit: `9855ad1cf17a8e50f78f769d418ae8518cfdcb25`  
PR: https://github.com/trybotster/botster-web/pull/85

## Target repository and target_id

| Field | Value |
| --- | --- |
| Repository | `trybotster/botster-web` |
| `target_id` | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Worktree | run worktree for this ticket (remote `trybotster/botster-web`) |
| Plan routing | Matches approved plan r3 (`docs/plans/repair-live-protocol-harness-env-gate-drift.md` @ `b545a31`) |

## Repository playbook and other playbooks/notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]] (ownership charter — only browser harness/helpers/unit chrome; no Hub/Core/TUI/Workspaces code)
- Targeted notes: [[the shared hub browser driver is the live packaged protocol harness behind a shim]], [[live packaged harness failures are scoped to the active mode branch]], [[a regression test must be shown to go red with the fix reverted]], [[conformance harnesses gate on deterministic invariants not timing]], [[implement gate must verify committed work and pr link before review]], [[implementation steps must persist report artifacts for review]]
- `[[project-pipelines-playbook]]` not loaded (no PP package/plugin path in scope)

## Constraints stated before edits

- Surgical fix only: detach oracle + default-path host-chrome inventory anti-drift
- Shared artifact shape (a): constants + pure decision + per-side extraction; no DOM parser
- Export-for-contract / structural extractions allowed; no product UX redesign of session release
- Live smoke is a hard gate for the detach half
- Plan approval condition: give `dashboard-view` a rendered-output home via extraction

## Files changed

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-helpers.mjs` | `HOST_CHROME`, `isTerminalDetached`, markup extractors, `HOST_CHROME_CONTRACTS` inventory |
| `scripts/live-packaged-protocol-harness.mjs` | `waitForTerminalDetached(page, sessionId)` uses shared constants + decision + discriminating timeout diagnostics; default-path chrome uses `HOST_CHROME` |
| `src/App.tsx` | Export/extract `DashboardView`, `WorkbenchNav`, `AppsView`; export `PluginSettingsRoutePage` (behavior-neutral) |
| `src/App.test.mjs` | Rendered-output inventory contracts + shared decision true/false pairs + none-oracle absence pin |
| `package.json` | **Unchanged** (no DOM-parser dependency) |

## Ownership boundaries preserved

- botster-web only: harness, helpers, unit suite, browser chrome export-for-contract
- No Hub/Core/TUI/Workspaces product code
- No new browser-only protocol meaning
- Mode-branch lanes (workspaces-compat/lifecycle, durable, contract matrix, payload, shared-hub driver) remain env-gated and out of unit inventory claim

## Cross-repo dependencies or separately routed work

- Live binaries consumed from local botster-hub release build (not modified)
- TUI env-gate ticket is parallel evidence only
- Sibling same-target contention `ticket_1786039279_917823` still blocked on Hub; not absorbed

## Deviations from plan

1. **Dashboard extraction (plan approval condition, not a plan text delta):** Extracted `DashboardView` (~50-line block) into an exported behavior-neutral component so inventory item `terminal-detached` / `dashboard-view` can prove `data-testid="dashboard-view"` via `renderToStaticMarkup`. Named here as **structural, not behavioral**.
2. **Also extracted `WorkbenchNav` and `AppsView` shells** so default-path Home/Apps chrome has the same rendered-output home pattern. Behavior-neutral; App renders the same chrome through these components.
3. **Inventory larger than the five minimum ids:** added `dashboard-view`, `terminal-session-view`, `hub-general-chrome`, `apps-view`, `workbench-nav`, `selected-app-surface` to close B.3 static-token gaps with unit evaluations.
4. No plan file rewrite for these (they are authorized by r3 export-for-contract + approval condition). Acceptance checks still match plan D/E.

## Production entry point (runtime path changed)

1. Live path after production terminal exercise: `shutdownProductionSession()` → session attachment `exited` → `TerminalViewHost` `onExit` → `App.releaseTerminalSession` → toast + `navigateToView("dashboard")` → terminal host unmounts.
2. Harness `waitForTerminalDetached(page, productionSessionId)` extracts live DOM facts with `HOST_CHROME`, applies `isTerminalDetached({ sessionContainerIds, dashboardPresent }, sessionId)`.
3. Success no longer depends on removed `data-terminal-session-id='none'`.
4. Unit suite proves the same decision against rendered `TerminalViewHost` (false) and `DashboardView` (true) markup.

## Default-path host-chrome inventory audit table

| token | class | inventory id or live-only reason | unit result |
| --- | --- | --- | --- |
| `dashboard-view` | host-chrome | `dashboard-view` / `terminal-detached` | green (`DashboardView`) |
| `apps-view` | host-chrome | `apps-view` | green (`AppsView`) |
| `terminal-session-view` | host-chrome | `terminal-session-view` | green (`SessionRouteView`) |
| `plugin-settings-route` + Back | host-chrome | `settings-back` | green (`PluginSettingsRoutePage`) |
| `data-terminal-session-id` / attach-state / container | host-chrome | `terminal-mounted` | green (`TerminalViewHost`) |
| `schema-version` diagnostic | host-chrome | `schema-presentation-neutral` | green (`ConnectionDiagnosticsPanel`) |
| `status.schema_version < 3` | host-chrome | `schema-floor-in-harness` | green (constant + harness pin) |
| Home / Apps / Botster workbench | host-chrome | `workbench-nav` | green (`WorkbenchNav`) |
| Hub general identity testids + Check for updates | host-chrome | `hub-general-chrome` | green (`HubGeneralSection`) |
| `selected-app-surface` | host-chrome | `selected-app-surface` | green (`PluginSurfaceRoutePage`) |
| `diagnostics-view` | host-chrome | residual: constant wired in harness; full shell still inline in App | not unit-extracted this PR; live-proven on support path |
| Hub settings footer button label | host-chrome | residual: harness uses `HOST_CHROME.hubSettingsNavButtonName` | constant shared; footer button not extracted component |
| `data-ui-node-id` plugin trees | dynamic plugin | live-only (Hub snapshot) | n/a |
| protocol/event oracles | protocol | live-only | n/a |
| mode-branch chrome (workspaces/contract/payload/shared-hub) | mode-branch | out of scope B.1 | n/a |

## Tests and downstream proof run

```text
npm test
# exit 0 — Renderer seam, runtime behavior, and registry fixture assertions passed.

npm run typecheck
# exit 0

BOTSTER_HUB_BIN=<botster-hub release> \
BOTSTER_SESSION_WORKER_BIN=<botster-session-worker release> \
npm run smoke:live-packaged-protocol
# exit 0 — live packaged protocol harness passed (webrtc)
# No detach-placeholder timeout. schema_version=3 floor held.
```

No new DOM-parser dependency in `package.json`.

## Unverified behavior or residual risk

- Brief `data-terminal-attach-state="exited"` visibility window is handled by snapshot polling; live passed without needing long-lived exited node.
- `diagnostics-view` and Hub settings footer button lack dedicated exported component contracts (constants shared; residual rename risk lower priority than min inventory).
- Mode-branch host chrome remains outside unit inventory by plan design.
- Sibling edit-control ticket may touch `App.test.mjs` later — rebase if it lands first.

## Missing vault guidance discovered

Still novel candidates (capture after merge if desired):

1. Env-gated live harnesses need shared chrome constants + pure decision proven against rendered host chrome under the default suite.
2. Terminal detach after exit is unmount + dashboard, not a `none` placeholder.
3. Plan-approval conditions that require export-for-contract extractions should name the exact component when the token lives only in App’s return.

## Assumptions stated

- Detach destination remains dashboard navigation + terminal host unmount (verified live).
- `shutdownProductionSession()` still drives attachment status to `exited` (live passed; timeout diagnostics would report if not).
- Coverage claim is **default-path host chrome only**.
