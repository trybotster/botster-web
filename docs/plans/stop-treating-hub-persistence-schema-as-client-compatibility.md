# Stop treating Hub persistence schema as client compatibility

## Target and context loaded

- Target repository: `botster-web` (`trybotster/botster-web`).
- Target id: `tgt_40abcf71ccf049f4ac0c99953a799869`.
- Pipeline ticket: `ticket_1785880000_707252`; run
  `run_1785880005_436520`.
- The target was resolved from the admitted Botster spawn-target registry. Its
  display name is misspelled `booster-web`, but its repository and target path
  resolve unambiguously to `trybotster/botster-web`. This assigned run worktree,
  not the target's ambient checkout, is the only edit location.
- Declared Plan base, current `origin/main`, and merge base are all
  `688183b0b56bdd891d37dc896b70178baa84997b`. Plan Review must fetch and renew
  that comparison before approval.
- Role and repository guidance loaded in order: [[planner-playbook]],
  [[botster-planner-playbook]], and [[botster-web-playbook]].
- Required architecture and surface guidance loaded: [[botster-architecture]],
  [[cli-patterns]], [[spa-patterns]],
  [[project pipeline orchestration belongs in a device-level botster plugin]],
  [[project pipelines needs an operator workbench not more primitives]],
  [[project pipelines ui contract belongs in the plugin readme]],
  [[botster orchestration should spawn agents with explicit target ids]],
  [[botster orchestration prompts must bind agents to explicit worktrees]],
  [[botster web uses vanilla ionic primitives by default]],
  [[botster web dto field names must match authoritative rust serde structs]],
  [[botster web adapts hub validated snapshot grammar only on ui tree path]],
  [[botster web plugin app routes are stable host routes]],
  [[botster web request caches belong in react query not zustand or hub session getters]],
  [[botster toolbar actions use declaration order plus fixed overflow intent]], and
  [[ui presentation operations are authored by accepted action results]].
- Targeted contract and verification notes loaded:
  [[botster hub client compatibility descriptors belong in client crate]],
  [[botster web generated protocol drift checks need explicit hub artifact paths]],
  [[adoption restart evidence must come from real protocol primitives not defaults]],
  [[hub generated protocol changes are a four site release chain]], and
  [[connection diagnostics derive from distinguishable runtime signals]].
- [[project-pipelines-playbook]] was loaded last for durable workflow policy,
  checklists, the ownership question, artifact evidence, gates, and advancement.
  Project Pipelines package/plugin source is not in implementation scope.
- Repository evidence inspected: `README.md`, `docs/architecture.md`, existing
  `docs/plans/` prior art, `package.json`, `package-lock.json`,
  `src/botster/connectionDiagnostics.ts`, the production subscription and health
  path in `src/App.tsx`, the session adapter in `src/botster/hubTransport.ts`,
  `src/botster/realHubDaemonDto.ts`, deterministic coverage in
  `src/App.test.mjs`, `scripts/check-daemon-protocol-drift.mjs`, and the real
  browser/Hub path in `scripts/live-packaged-protocol-harness.mjs`.
- Baseline `npm test` and `npm run typecheck` both pass on the declared base.

## Current runtime path and defect

The production Hub status response is projected by `statusRecord` in
`src/botster/hubTransport.ts` into the `botster-web.hub_status` entity family.
`App.tsx` subscribes to those frames and currently calls both
`schemaVersionDiagnosticFromFrame` and `compatibilityDiagnosticsFromFrame`.
The former compares `status.schema_version` to the Web-owned constant
`expectedDaemonSchemaVersion = 1` and emits a danger diagnostic for any other
value. `App.tsx` treats every danger diagnostic as blocking and renders
`Needs attention`; `ConnectionDiagnosticsPanel` labels it `Blocked`.

That is the wrong ownership boundary. `schema_version` is the Hub's durable
state format. Client compatibility is the independent
`DaemonStatus.compatibility` descriptor: protocol identity, protocol version,
minimum conformance fixture revision, and required features. The existing
descriptor path already evaluates those signals and preserves Hub-emitted
`compatibility_mismatch`/`unsupported_feature` diagnostics.

The required `@trybotster/hub-test-support@0.1.21` repin also changes generated
`DaemonEntityFrame` snapshot/upsert payloads from `DaemonSessionEntity` to
`JsonValue`, while leaving the daemon wire generic for package-owned entity
families. Human answer `question_1785880268_791929` cold-folded the inseparable
session-only Web consumer narrowing from zero-run sibling
`ticket_1785731573_705379` into this ticket and closed the sibling as subsumed.

## Published artifact preflight

- Registry package `@trybotster/hub-test-support@0.1.21` exists with integrity
  `sha512-0ZMXq0ie5P0UZvJEcTsa2QbAP1cSKpk3N6g+/kQUz95yZRN1zsv+iZB1YTi49hJykeog8Nkd0g+tCLki3xmsIg==`.
- A clean `npm pack` shows metadata protocol `botster-hub-daemon-v1`, protocol
  version `4`, conformance fixture revision `28`, and UI contract `0.3.1`.
- Its generated protocol SHA-256 is
  `141a0d96e120c1f596d13650cc8b1baa42944af89920240c55030ea3f54dd14f`.
- The clean authoritative Hub checkout is exactly
  `11d73d27e01732981e803041ea702aa09db57112` and reports durable schema version
  `2`. No unpublished Hub artifact or upstream source change is required.

## Scope

1. **Cold-repin and synchronize the published Hub artifacts.** Update
   `package.json` and `package-lock.json` from exact support version `0.1.20` to
   `0.1.21`, run `npm ci`, and replace
   `src/botster/generated/daemon-protocol.ts` only with the package/Hub-generated
   bytes. Update the repository's expected support metadata from conformance
   revision `27` to `28` and refresh the current coordinate statements in
   `README.md` and `docs/architecture.md`. Do not edit generated DTOs by hand or
   change the direct `@trybotster/ui-contract@0.3.1` pin.

2. **Make persistence schema informational only.** In
   `src/botster/connectionDiagnostics.ts`, delete
   `expectedDaemonSchemaVersion` and all equality/mismatch behavior. Preserve a
   schema diagnostic only as neutral operator context: any numeric
   `schema_version` may produce one `info` row with copy that identifies it as
   the Hub durable-state schema and explicitly points compatibility to
   `DaemonStatus.compatibility`. It must not say compatible/mismatch, use danger
   or warning severity, or be the source of a blocking health state. Rename the
   helper and update `App.tsx` imports/call sites if needed so the source no
   longer implies a client schema gate.

3. **Narrow generic entity records at the Web consumer boundary.** In
   `src/botster/hubTransport.ts`, keep the first gate
   `frame.entity_type === "session"`. Only after that gate, validate each
   snapshot/upsert `JsonValue` as the generated `DaemonSessionEntity` shape
   before calling `sessionEntityRecord`. Valid session records retain the
   existing canonical `session` projection; invalid/non-object session values
   are not projected. Non-session package-owned frames remain generic and are
   not reinterpreted or narrowed by this session adapter. Patch/remove behavior
   and the daemon generated contract remain unchanged. Add no compatibility
   cast, alternate DTO, or browser-only wire grammar.

4. **Replace the deterministic regression oracle.** In `src/App.test.mjs`,
   remove assertions that lock `schema 1` to success and `schema 2` to danger.
   Prove both schema `1` and schema `2` are informational/non-blocking, and prove
   schema `2` plus a valid compatibility descriptor yields a healthy descriptor
   diagnostic. Retain/add explicit danger assertions for wrong protocol,
   too-low protocol version, too-low conformance revision, and every missing
   required feature. Update rendered Diagnostics assertions to require neutral
   schema copy and `Info`, never `Blocked`/mismatch. Add session adapter cases
   for valid generic JSON snapshot/upsert records, malformed session records,
   and a non-session package-owned frame; only validated session records may
   reach `sessionEntityRecord` and the canonical session entity store.

5. **Prove the production browser path against the current Hub.** Extend
   `scripts/live-packaged-protocol-harness.mjs` on its normal fresh isolated-Hub
   path. After opening the real compiled Ionic Diagnostics route, read the
   structured status evidence and require protocol `botster-hub-daemon-v1`,
   protocol version `4`, conformance revision `28`, required features, and
   `schema_version === 2`. Require the rendered `schema-version` row to be
   informational and not contain mismatch/Blocked copy. Require the shell to be
   connected (`Connected` or `Connected with warnings`), not `Needs attention`
   because of schema. Keep the assertion tied to structured harness events and
   the rendered production DOM; source presence and fixture-only tests are not
   acceptance.

## Non-scope and ownership boundaries

- Do not change Hub persistence schema/versioning, migration policy, status
  production, compatibility descriptor semantics, or daemon entity wire types.
- Do not replace the constant with `2`, add a schema-version compatibility
  fallback, support two schema gates, or infer compatibility from persistence.
- Do not weaken or remove blocking protocol, protocol-version, conformance, or
  required-feature checks.
- Do not add generic package entity storage or package-family behavior to this
  Web session adapter. This ticket only prevents the generated generic wire
  shape from being unsafely treated as a session.
- Do not refactor adjacent diagnostics, transport, entity-store, renderer, or
  test-harness architecture.
- Hub owns the published producer artifacts and current schema-2 runtime; Web
  owns the exact package pin, vendored generated copy, consumer validation,
  Diagnostics semantics, and browser proof. The required Hub release is already
  published, so there is no cross-repository dependency.

## Assumptions and unknowns

- The implementation consumes immutable published `0.1.21` bytes verified in
  this Plan. If registry integrity, metadata, or the explicit Hub generated
  artifact differs, stop rather than selecting another coordinate.
- The live proof must rebuild/use binaries from clean Hub commit `11d73d27`, not
  trust a stale `target/` binary merely because the source checkout is current.
- A fresh isolated Hub should avoid unrelated danger diagnostics. If one occurs,
  diagnose it exactly; do not weaken the schema regression into a source-only
  assertion or waive the connected UI oracle.
- Malformed records are a Web boundary negative test, not a new product
  diagnostic surface. Adding an invalid-record warning is follow-up scope unless
  current adapter conventions require one for an existing reachable path.

## Affected surfaces and files

- `package.json`, `package-lock.json`
- `src/botster/generated/daemon-protocol.ts`
- `src/botster/connectionDiagnostics.ts`
- `src/botster/hubTransport.ts`
- `src/App.tsx`
- `src/App.test.mjs`
- `scripts/live-packaged-protocol-harness.mjs`
- `README.md`, `docs/architecture.md`
- This plan artifact only; no historical `docs/plans/` document is retrofitted.

## Risks

- Updating only the npm pin without the vendored generated file will fail the
  drift gate; editing only the vendored file can hide wrong published bytes.
- The generic `JsonValue` change can invite an unchecked cast. The type guard
  must validate required fields and run only after `entity_type == "session"`.
- Existing JavaScript test records omit fields TypeScript previously trusted.
  Tests must use contract-valid session records rather than weakening the guard.
- Leaving schema diagnostics under compatibility/mismatch copy can preserve the
  product bug even with info severity. Both copy and severity are part of the
  acceptance oracle.
- A live smoke against a stale Hub binary can falsely prove schema `1`; record
  exact source commit, rebuild, and assert observed structured schema `2`.
- A broad global `Connected` assertion can be noisy if another real danger is
  present. Use the fresh isolated path and retain exact diagnostic evidence so
  unrelated failures are investigated rather than ignored.

## Acceptance checks

Run from a clean worktree after implementation:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build

BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL=/path/to/hub-checkout/crates/botster-hub-client/generated/daemon-protocol.ts \
  node scripts/check-daemon-protocol-drift.mjs

BOTSTER_HUB_BIN=/path/to/clean-11d73d27/botster-hub \
BOTSTER_SESSION_WORKER_BIN=/path/to/locked-core/botster-session-worker \
  npm run smoke:live-packaged-protocol
```

Before the live command, prove the Hub checkout is clean at
`11d73d27e01732981e803041ea702aa09db57112` and rebuild both binaries through
the Hub repository's owned Cargo path. Attach the live harness's structured
status and DOM evidence: schema `2`, protocol `4`, conformance revision `28`,
required features present, informational schema row, healthy compatibility row,
and connected rather than schema-blocked shell.

Regression review must also show that reverting only the schema semantic change
makes the schema-2 deterministic/live oracle fail, while protocol/version/
conformance/feature negative cases continue to pass as blocking diagnostics.

## Vault gap worth capturing

After implementation and live verification, capture one atomic Botster decision:
Hub `DaemonStatus.schema_version` describes Hub-private durable persistence and
is informational to clients; client compatibility derives exclusively from the
public compatibility descriptor. No note is written during Plan because the
new behavior is not yet implemented or verified.
