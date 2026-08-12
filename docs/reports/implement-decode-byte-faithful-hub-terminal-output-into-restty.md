# Implement report: Decode byte-faithful Hub terminal output into Restty

Ticket: `ticket_1786562565_267926`
Run: `run_1786568427_879557`
Step: `botster_stack_implement` / `run_step_1786570300_646693`

## Target repository and target_id

| Field | Value |
| --- | --- |
| Target repository | `botster-web` (`trybotster/botster-web`) |
| Target id | `tgt_40abcf71ccf049f4ac0c99953a799869` |
| Branch | `project-pipelines/ticket_1786562565_267926-byte-contract` |
| Base | `origin/main` `4292d30a9e7a0671e8594db87df797b543eeb661` |
| Unrelated resize commit | `d5799db` not included |
| Teardown class | false |

## Repository playbook and other playbooks/notes applied

- [[implementer-playbook]]
- [[botster-implementer-playbook]]
- [[botster-web-playbook]]
- [[spa-patterns]]
- [[live terminal output base64 envelopes carry renderable bytes]]
- [[botster clients restore visible terminal state from readscreen before buffered live output]]
- [[restty is a client renderer not authoritative terminal infrastructure]]
- [[a removed field rejection test must hold every other field valid]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[a cold cut field rename can be a value shape change not only a key change]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[hub support metadata can force a web ui contract cold update]]
- [[cold turkey migrations eliminate dual code paths and version suffixes]]
- [[a regression test must be shown to go red with the fix reverted]]
- [[an ablation that reddens at the first assertion does not vouch for later ones]]
- [[a page reload is not a reconnect]]
- [[live hub proof records distinct hub and locked core binary provenance]]
- [[hub generated protocol changes are a four site release chain]]
- [[webrtc peer registry owns production data plane receivers]]
- [[implement gate must verify committed work and pr link before review]]
- [[implementation artifacts must match actual git state]]
- [[implementation steps must persist report artifacts for review]]
- [[pipeline vault checklists must cite exact resolvable note titles]]

Not loaded: [[project-pipelines-playbook]] (not Project Pipelines package/plugin paths), [[botster runtime teardown lenses]] (class does not apply).

## Files changed

- `package.json` / `package-lock.json` — pin `@trybotster/hub-test-support@0.1.31`
- `src/botster/generated/daemon-protocol.ts` — copy installed protocol 7 artifact
- `README.md` / `docs/architecture.md` — revision-36 / 0.1.31 claims together
- `src/botster/terminal.ts` — `TerminalOutput = Uint8Array`; telemetry as base64/bytes
- `src/botster/hubTerminalDataPlane.ts` — envelope decode, byte hydration, retired-`data` reject
- `src/botster/resttyRenderer.ts` — production `onData(Uint8Array)` path; renderer telemetry as bytes
- `src/botster/connectionDiagnostics.ts` — conformance floor 36
- `src/botster/TerminalViewHost.tsx`, `terminalSmokeFixture.ts`, `mountedKeyboardSmoke.tsx` — mock/smoke fixtures emit bytes
- `src/App.test.mjs` — envelope fixtures, split UTF-8, retired-`data`, lint regex
- `scripts/live-packaged-protocol-harness.mjs` — Drain envelope + Restty-bound byte records, token producer, lint inits
- `scripts/mounted-terminal-keyboard-smoke.mjs` — decode renderer-write bytes
- `docs/plans/decode-byte-faithful-hub-terminal-output-into-restty.md` — approved plan revision 2
- `docs/reports/implement-decode-byte-faithful-hub-terminal-output-into-restty.md` — this report

Absent on purpose: `src/botster/botsterTerminalPtyTransport.ts`.

## Ownership boundaries preserved

Web owns browser decode and Restty feed. Hub producer, publish, SessionIo, and TUI remain outside this run. Restty internals were not revendored; vendored `onData(string | Uint8Array)` is the production path.

## Cross-repo dependencies or separately routed work

- Closed Hub parent `ticket_1786562565_286591` / merge `7499c16` is source only.
- Publish ticket `ticket_1786568764_412473` stayed operator-owned. Implement consumed the published registry coordinate `@trybotster/hub-test-support@0.1.31`, not ticket close.
- TUI sibling `ticket_1786562566_712634` not touched.

## Deviations from plan

None. Clean-base lint sites were fixed only in already-touched files. UI-contract stayed `0.3.2`. Protocol version floor stayed 1. GHOSTSNP remained primary paint.

## Tests and downstream proof run

Publish pin, from a clean temp dir: `npm pack @trybotster/hub-test-support@0.1.31` then installed package metadata `package_version=0.1.31`, `protocol_version=7`, `conformance_fixture_revision=36`, `ui_contract=0.3.2`, live `terminal_output` envelope without `data: string`.

Repo gates:

- `npm test` (includes `scripts/check-daemon-protocol-drift.mjs` against the installed package) exit 0
- `npm run typecheck` exit 0
- `npm run lint` exit 0 (only pre-existing `IonicUiNodeRenderer.tsx` warning)
- `npm run build` exit 0
- `npm run smoke:browser-runtime` exit 0
- `npm run smoke:mounted-terminal-keyboard` exit 0
- `npm run smoke:live-packaged-protocol` exit 0

Live provenance:

- Hub SHA `7499c1615078069ba391489b20c6f39c55c2d4c6`
- Locked Core SHA `5a9938377b492ee1fa3acfb31365ebbebccc2a96`
- Hub realpath under that checkout `target/debug/botster-hub`
- Worker realpath under that checkout `target/debug/botster-session-worker`
- Live identity: protocol 7 / conformance 36
- Production chain: packaged UI → `TerminalViewHost` → `HubTerminalDataPlane` → `WebrtcDaemonClient.streamTerminal` → decode → Restty `onData`
- Attach chronology stayed `attaching → snapshot → attached → terminal_output`
- In-page DataChannel reconnect kept the document sentinel and minted a new subscription
- Split UTF-8 / NUL / ESC / `0xff` used session-script token commands so each Drain payload was an exact byte chunk

Ablation:

- Per-frame `TextDecoder` first failed `src/App.test.mjs` split-UTF-8 bytes (`[239,191,189]` vs `[226]`)
- Removing the retired-`data` guard first failed the valid-envelope-plus-`data` throw

`git diff origin/main -- scripts/live-packaged-protocol-harness.mjs src/App.test.mjs` contains the lint sites (`renderBaseline`/`orderedGapEvidence` initializers and the `no-regex-spaces` pattern).

## Unverified behavior or residual risk

- Shared-Hub / Workspaces lanes were not this ticket's product surface. The live harness recorded the expected missing-package-path fallback and ran the first-party production branch.
- Handshake still does not emit `DaemonHello`. Live peer admission succeeded at protocol 7 without a Web-owned hello change.
- Vendored Restty `onData(Uint8Array)` was confirmed by types and live Restty-bound byte records; Restty was not revendored.

## Missing vault guidance discovered

The ReadScreen-primary note was stale for first-party Web attach. Updated [[botster clients restore visible terminal state from readscreen before buffered live output]] and [[live terminal output base64 envelopes carry renderable bytes]], and captured `first-party Web attach is GHOSTSNP-primary` in the vault inbox.
