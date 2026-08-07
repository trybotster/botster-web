# Implement report — live-protocol harness env-gate repair (return visit)

Ticket: `ticket_1786042828_142991`  
Run: `run_1786060051_411729`  
Step: `botster_stack_implement` (return after Review `changes_required`)  
PR: https://github.com/trybotster/botster-web/pull/85

## Target repository and target_id

| Field | Value |
| --- | --- |
| Repository | `trybotster/botster-web` |
| `target_id` | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Plan routing | Matches approved plan r3 |

## Addresses review findings

| Finding | Disposition |
| --- | --- |
| `finding_1786063749_335040` (high) incomplete default-path extraction | Finished extraction; new contracts for diagnostics, hub settings sections, session-types chrome, package settings chrome, local hub first screen, populated AppsView Installed list |
| `finding_1786063749_497091` (high) tautological completeness | `evaluatedHostChromeContractIds` recorded only when evaluations run; deepEqual both directions against `HOST_CHROME_CONTRACTS` ids |
| `finding_1786063749_610872` (low) AppsViewShell name | Renamed to `AppsView` |
| `finding_1786063749_806873` (low) no vault checklist | Implement vault checklist recorded on the run |
| `finding_1786063749_397968` (medium) diagnostics residual | Extracted `DiagnosticsView` with owned `developer-diagnostics`; inventory entry; residual row removed |
| `finding_1786063749_673779` (medium) dead constants / raw literals | Harness routes headings, sections, package labels, installed list, session-type testids through `HOST_CHROME`; page.evaluate paths receive constants as args |

## Repository playbook and notes applied

- [[implementer-playbook]], [[botster-implementer-playbook]], [[botster-web-playbook]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation steps must persist report artifacts for review]]
- [[self asserting artifacts are not reviewer evidence]] (completeness guard is binding, not tautological)
- Convention conflicts: **none**

## Files changed (this return)

| Path | Change |
| --- | --- |
| `scripts/live-packaged-protocol-helpers.mjs` | Expanded `HOST_CHROME` + inventory contracts for remaining default-path chrome |
| `scripts/live-packaged-protocol-harness.mjs` | Route remaining default-path chrome through shared constants; browser evaluates receive args |
| `src/App.tsx` | `DiagnosticsView` (owns developer-diagnostics), `HubSettingsSectionsNav`, `SessionTypesView`, `SessionTypeSubmitButton`; AppsView owns Installed list; export `RemoteAccessConfigurationItem` |
| `src/App.test.mjs` | Evaluated-id completeness; new rendered contracts; render-field symbol check |
| `docs/plans/repair-live-protocol-harness-env-gate-drift-implement-report.md` | This report |

## Ownership boundaries preserved

botster-web only. No Hub/Core/TUI/Workspaces code. Mode-branch chrome remains out of unit inventory.

## Cross-repo routing

None. Live binaries consumed only.

## Deviations from plan

Same as prior implement plus return-visit extractions authorized by r3 export-for-contract and Review required fixes. Inventory larger than original five minimums by construction of B.3.

## Default-path host-chrome inventory (evaluation-bound)

Inventory ids (each has an executing unit evaluation recorded into `evaluatedHostChromeContractIds`):

1. terminal-mounted  
2. terminal-detached  
3. settings-back  
4. schema-presentation-neutral  
5. schema-floor-in-harness  
6. dashboard-view  
7. terminal-session-view  
8. hub-general-chrome  
9. apps-view (empty + populated Installed)  
10. workbench-nav  
11. selected-app-surface  
12. diagnostics-view (testid + developer-diagnostics class + Support heading)  
13. hub-settings-sections (Session types + Support labels)  
14. session-types-chrome (view/create/submit/delete testids)  
15. package-settings-chrome (Package configuration + Remote browser access)  
16. local-hub-first-screen (Hub heading)

Mechanical default-path call chain covered: openDiagnosticsView, openAppsView/installedList, assertCurrentHubSchemaPresentation, assertRemoteAccessSettingsDispatch, exerciseSessionTypes/createSessionTypeThroughRenderedForm, terminal detach, hub general, settings back.

Classified live-only / out of scope (unchanged policy): dynamic `data-ui-node-id` plugin trees; protocol/event oracles; mode-branch chrome (workspaces/contract/payload/shared-hub/durable-only paths beyond default tokens already shared).

## Tests and downstream proof

```text
npm test                          # exit 0
npm run typecheck                 # exit 0
BOTSTER_HUB_BIN=… BOTSTER_SESSION_WORKER_BIN=… \
  npm run smoke:live-packaged-protocol
# exit 0 — live packaged protocol harness passed (webrtc)
```

Completeness negative property: inventory entry without evaluation fails deepEqual; render field must name an imported symbol.

## Unverified / residual risk

- Some page.evaluate string selectors for dynamic plugin nodes remain live-only by design.
- Mode-branch chrome still outside inventory (plan B.1).
- “Settings for botster web” / Opt in/Out copy remain product labels with existing pre-pins; not re-audited as separate inventory rows beyond package-settings chrome.

## Missing vault guidance

- Inventory completeness guards must bind evaluation execution, not set membership of the inventory array itself.
- Export-for-contract extractions should own their static chrome (e.g. developer-diagnostics) rather than leaving it as an ad-hoc residual disposition.
