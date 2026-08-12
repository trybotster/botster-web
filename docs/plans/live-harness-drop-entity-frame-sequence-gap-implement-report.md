# Implement report: live harness drop entity frame sequence_gap

## Target repository and target_id

| Field | Value |
|-------|-------|
| Target repository | `trybotster/botster-web` |
| Target ID | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Ticket | `ticket_1786518263_839128` |
| Run | `run_1786522059_661378` |
| Branch | `project-pipelines/ticket_1786518263_839128` |
| Implementation base | `aa19ffbbc07a2e2e60fe8e412185961719d7c526` (≥ `2a41220`) |
| Teardown class | **false** (N/A) |

## Repository playbook and other playbooks/notes applied

### Role / charter

1. [[implementer-playbook]]
2. [[botster-implementer-playbook]]
3. [[botster-web-playbook]]

### Map / atomic notes consulted

- [[botster-architecture]]
- [[spa-patterns]]
- [[botster hub client state sync is entity frame only]]
- [[botster entity snapshots are authoritative reconnect baselines]]
- [[a page reload is not a reconnect]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[adding harness event families changes every mixed family oracle]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[implementation artifacts must match actual git state]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[implementation deviations must resync committed plan acceptance checks]]

### Explicitly not loaded

- [[project-pipelines-playbook]] — no package/plugin path edits
- [[botster runtime teardown lenses]] — teardown_class_applies=false

## Files changed

| Path | Change |
|------|--------|
| `src/botster/webrtcDaemonClient.ts` | Filter-bound `armDropNextInboundEntityFrame` / `getDropNextInboundEntityFrameState` / `disarmDropNextInboundEntityFrame`; intercept before `receiveEntityFrame`; `webrtc_entity_frame_harness_drop` event; discard correlation fields (`rejected_snapshot_seq`, etc.); transportControl surface |
| `scripts/live-packaged-protocol-harness.mjs` | Membership ordered-gap stage (warmup A → drop B → gap C); force-free stale submit; SPA request-state oracles; mandatory A/B/C cleanup; lifecycle-mode early exit |
| `src/App.test.mjs` | Contract unit tests + source guards for control and no force-click |
| `README.md` | Control contract, pins, two-mutation (A/B/C) chronology, parent citation |
| `docs/plans/live-harness-drop-entity-frame-sequence-gap.md` | Plan + implement deviations |
| `docs/plans/live-harness-drop-entity-frame-sequence-gap-implement-report.md` | This report |
| `.gitignore` | Restored from HEAD (was emptied in worktree) |

## Ownership boundaries preserved

- **In scope (botster-web):** WebRTC client harness seams, live protocol harness, unit tests, README.
- **Consumed pins only (no product edits):**
  - Hub binaries rebuilt from `de6b09982e72fd5efd04a5258f5fc645f611adbc` (fixture revision 35)
  - Workspaces package path at `7ab4d1334214b3ea3c8b02e9ea665a27e70c0916`
- No Hub, Workspaces package, TUI, core, or Project Pipelines plugin code changes.

## Cross-repo dependencies or separately routed work

None registered. Pins were available locally:

- Hub: `pinned Hub checkout` @ `de6b099` (release rebuild for conf 35)
- Workspaces: `.../ticket_1786474780_590414` @ `7ab4d13`

## Deviations from plan

1. **Warmup claim A + drop B + gap C** (instead of drop A + gap B only).
   Observed: dual-client Add dialog opens a second membership subscriber that advances the Hub package-entity provider floor without updating P1’s `package_last_applied_seq`. The first claim after that open is delivered as `package_entity_resync` (entity_snapshot), which the delta-only drop filter correctly ignores.
   Implement settles floor with warmup claim **A** (resync OK; A becomes stale selection), then arms and drops claim **B**, then claim **C** triggers production `sequence_gap`. Stale selection under test remains A. Seeds A+B+C; cleanup all three. Recorded in committed plan “Implement deviations”.

2. **`smoke:workspaces-lifecycle` early exit** after lifecycle proof (mirrors entity-options reactive). Prevents continuing into unrelated session/terminal GHOSTSNP stages that failed on this Hub pin after lifecycle already passed.

3. **Discard event correlation fields** on production `webrtc_entity_frame_discarded` (`rejected_snapshot_seq`, `rejected_frame_type`, `current_snapshot_seq`) — observational only; sequence-gap policy unchanged.

## Tests and downstream proof run

### Deterministic

```text
npm test          # pass
npm run typecheck # pass
npm run build     # pass (also via smoke)
```

Unit coverage: no-harness fail-closed; arm-only result; non-match pass-through; one-shot drop; two-frame chronology → `sequence_gap`; snapshot/error never match default filter; source guards for control + no force-click.

### Live (mandatory)

```bash
BOTSTER_HUB_BIN=.../botster-hub/target/release/botster-hub \
BOTSTER_SESSION_WORKER_BIN=.../botster-session-worker \
BOTSTER_WORKSPACES_PACKAGE_PATH=.../ticket_1786474780_590414 \
npm run smoke:workspaces-lifecycle
# EXIT 0
```

Provenance:

| Pin | Value |
|-----|-------|
| Web | `aa19ffb` + this branch work |
| Hub source | `de6b099` (rebuilt release; conf fixture 35) |
| Workspaces | `7ab4d13` |

Positive stage evidence (representative):

- `harness-drop`: `snapshot_seq=5`, `frame_type=entity_upsert`, family `botster-workspaces.membership`
- `ordered-gap`: `sequence_gap` with `gap_trigger_snapshot_seq=6`, `current_snapshot_seq_at_gap=4`, replacement snapshot seq `7` on **new** subscription id
- options A/B/C excluded after replacement
- stale submit `click_completion_phase=blocked_gate`, zero stale add_session
- cleanup: all three sessions membership-removed + hub shutdown/remove
- `workspaces lifecycle live proof passed (webrtc)`

### Production path proof

Harness drop sits after decrypt/assembly of `daemon_entity_frame` and **before** `receiveEntityFrame`. Live claim B is a real Hub-produced membership upsert; claim C takes production `sequence_gap` → `resubscribeEntity` → unsubscribe/subscribe → replacement snapshot → entity_options reconcile. Not store injection, not `closeDataChannel`, not reload.

## Review revisit (sequence 11)

Addressed open Review findings:

| Finding | Fix |
|---------|-----|
| Parent usage obsolete A/B chronology | README + source guards: warmup A, drop B, gap C, cleanup A/B/C |
| SPA pending/result not inspected | `getActionRequestState()` harness seam on production ActionDispatcher; live oracle compares pending + recent results |
| Absolute home path in report | Neutralized to “pinned Hub/Workspaces checkout” |
| Cleanup false success | Fail membership remove errors; `listEntities` proves membership + session absence |
| `timed_out` unreachable | 30s default arm timeout (+ optional `timeout_ms`); unit test |

## Review revisit (sequence 13)

| Finding | Fix |
|---------|-----|
| Plan acceptance still taught obsolete seed A+B / drop A / gap B | Plan chronology table, cleanup contract, scope, acceptance checks, product ledger, and production-path blurb rewritten to warmup A / drop B / gap C / cleanup A+B+C; timed_out documented as always bounded; harness JSDoc + finally comment updated; source guards reject obsolete exact phrases |

## Unverified behavior or residual risk

1. **Ablation** `BOTSTER_LIVE_ABLATE_STALE_SUBMIT=1` not re-run in this Implement session (green path force-free + blocked_gate + SPA state proven live; ablation path still fails first at outbound/SPA oracles).
2. **Default** `smoke:live-packaged-protocol` full terminal lane not re-run (lifecycle mode intentionally exits).
3. Hub dual-subscriber package-entity floor behavior remains a product hazard; Web harness compensates with warmup claim rather than changing Hub.

## Missing vault guidance discovered

1. Dual-client package-entity subscribe advances provider floor and can force `package_entity_resync` instead of ordered deltas for earlier subscribers — worth a vault note after capture.
2. Reconnect (`closeDataChannel`) vs ordered-gap (`armDropNextInboundEntityFrame`) distinction is documented in README; optional vault capture still listed in plan.

## Convention conflicts

None.
