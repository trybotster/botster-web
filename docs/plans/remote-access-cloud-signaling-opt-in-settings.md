# Remote Access Cloud Signaling Opt-in Settings

## Context Loaded

- Pipeline context: run `run_1782945280_848203`, step `botster_plan`, ticket `ticket_1782857283_805387`.
- Ticket dependencies are closed: WebRTC transport over encrypted hub protocol and durable browser identity storage. The identity-storage dependency is treated as hub-side/non-scope for this repo unless a hub DTO exposes browser identity or pairing state; do not invent a botster-web identity/pairing surface.
- Gate prompt requires context loaded, scope/non-scope, assumptions/unknowns, affected files, risks, acceptance checks, and vault gaps.
- No prior artifacts, findings, open questions, or answers were present.
- Vault/playbooks loaded: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]].
- Repo evidence loaded: `botster-package.json`, `src/botster/generated/daemon-protocol.ts`, `src/App.tsx`, `src/botster/realHubDogfoodTransport.ts`, `src/botster/actions.ts`, `src/botster/__fixtures__/generatedDaemonProtocol.ts`, `src/App.test.mjs`, `scripts/packaged-browser-smoke.mjs`, `scripts/live-packaged-protocol-harness.mjs`, `package.json`.

## Scope

- First probe whether the real local hub reads `botster-package.json` package configuration for `botster-web` and emits it through `ListPackages` as `DaemonPackageConfiguration.schema`.
- If the probe passes, add a package configuration schema entry in `botster-package.json` for explicit remote browser rendezvous opt-in through Botster Cloud/Rails zero-trust signaling.
- Make the setting understandable in the existing settings UI: local installed access remains available, remote browser access requires opt-in, pairing, and device approval.
- Project the schema/effective value/missing-required/diagnostic data through the existing `ListPackages` -> `botster-web.package` entity path, using existing generic boolean field support unless the probe exposes a concrete gap.
- Ensure the settings modal exposes remote access state plus action dispatch status for opt-in and opt-out through the authoritative `set_package_configuration` action.
- Extend deterministic fixture/smoke coverage only for client-render behavior against a fixture schema; do not treat mocked smoke output as runtime proof.
- Make live packaged protocol evidence the hard runtime gate: the real hub must return a manifest-sourced `botster-web` configuration schema and accept the `set_package_configuration` dispatch, or the implementation must register the hub dependency and stop.

## Non-scope

- Do not implement Botster Cloud/Rails signaling, ActionCable subscription policy, remote pairing, or device approval flows.
- Do not add a browser-local-only remote access store or fake success state.
- Do not add a new transport protocol, new DTO mirror, or manually invented remote-access request if the hub does not expose it.
- Do not continue with UI/schema/test implementation after the early hub probe fails; register the hub dependency required by the ticket contract instead.
- Do not redesign the Apps/settings page, terminal surface, package lifecycle UI, or marketplace flow.
- Do not add PII or display identity secrets; labels should describe policy/state without exposing user/device private data.

## Assumptions And Unknowns

- Assumption: the authoritative hub-facing DTO for this ticket is the existing generated `DaemonRequest` variant `{ type: "set_package_configuration"; package_name; values }` plus package `configuration` and action descriptors emitted by `ListPackages`.
- Assumption: a manifest configuration schema key is the right local package settings contract for an opt-in that belongs to the `botster-web` package.
- Assumption: the smallest schema key should be explicit, for example `remote_browser_rendezvous_enabled`, with a boolean default of `false`.
- Assumption: dependency `ticket_1782861299_366594` is hub-side/non-scope in `botster-web`; no browser identity, pairing, or device-approval UI is available here unless the hub exposes it through authoritative DTOs.
- Determining unknown: whether the currently compiled hub accepts a top-level `configuration` block in `botster-package.json` for this package and emits a `set_package_configuration` action for `botster-web`.
- Unknown: whether hub validation returns configuration-specific diagnostics, package decisions, generic diagnostics, or operator errors for rejected values.
- Required first implementation step: temporarily add the intended manifest configuration block, install/enable `botster-web` into a real local hub, run `ListPackages`, and inspect the returned `DaemonPackageConfiguration.schema` plus `set_package_configuration` action for `package_name: "botster-web"`.
- Required branch: schema/action emitted -> proceed with full opt-in implementation; schema/action missing -> register a hub dependency for manifest-sourced package configuration support and stop without landing mocked local-only settings.

## Botster Layers Touched

- React/Ionic SPA shell: settings modal rendering and user action feedback.
- Package manifest: first-party `botster-web` package configuration schema.
- Hub-client DTO consumption: generated TypeScript daemon protocol stays authoritative.
- Browser real-hub adapter: expected no transport change because generic package configuration already maps boolean fields to checkbox values and dispatches `set_package_configuration`.
- Browser/package smoke harnesses: deterministic and live production-path verification.

## Affected Surfaces And Files

- `botster-package.json`: add remote access opt-in schema metadata with safe default and user-facing label/help text.
- `src/App.tsx`: render the remote access configuration field as clear state/action text in `PluginSettingsPanel`; show pending/success/error through the existing correlated action/toast path.
- `src/botster/realHubDogfoodTransport.ts`: expected no diff. Only edit if the early hub probe or a focused failing test proves the existing generic boolean/configuration projection cannot render or dispatch the authoritative DTO.
- `src/botster/__fixtures__/generatedDaemonProtocol.ts`: add fixture package configuration/action coverage for the remote access opt-in.
- `src/App.test.mjs`: assert manifest schema, generated DTO usage, visible copy, no local fake state, and no unsupported remote/cloud request invention.
- `scripts/packaged-browser-smoke.mjs`: cover visible remote access opt-in/off state and captured `set_package_configuration` payload using fixture/mock schema only.
- `scripts/live-packaged-protocol-harness.mjs`: hard-gate runtime proof that real package runtime loads manifest-sourced settings from hub DTOs and dispatches `set_package_configuration`, or record/register the hub dependency gap.
- `README.md` or `docs/architecture.md`: only update if implementation introduces a durable operator-facing setting contract not already clear from the manifest and tests.

## Risks

- Hub support mismatch: generated DTO supports package configuration, but the live hub may not emit a configuration action for this package after manifest changes.
- Mocked proof risk: deterministic smoke already injects package configuration schema, so it cannot prove the manifest -> hub -> browser path.
- Schema-shape drift: the package schema grammar may require an existing field shape; do not invent unvalidated schema structure.
- UX ambiguity: users must not think remote access is enabled by local install alone.
- False success risk: existing action dispatch can show an accepted UI action even when the hub rejects the daemon request; visible feedback must reflect hub response/error.
- PII/security risk: settings copy must avoid device identifiers, grant secrets, pairing secrets, or cloud account details.
- Test brittleness: current `App.test.mjs` includes many source-shape assertions; keep additions narrow and behavior-oriented where possible.

## Acceptance Checks And Tests

- `npm test`: source/contract regression coverage for manifest schema, generated DTO usage, settings UI visibility, and no invented local-only remote state.
- `npm run typecheck`: TypeScript DTO/action changes compile against the generated daemon protocol.
- `npm run lint`: Ionic/React changes satisfy repo lint rules.
- Early real-hub probe: before broad implementation, prove real hub `ListPackages` returns `botster-web.configuration.schema` from the manifest and exposes a `set_package_configuration` action, or register the hub dependency and stop.
- `npm run smoke:packaged-browser`: deterministic packaged runtime shows remote access disabled by default, opens settings, dispatches opt-in/opt-out through `set_package_configuration`, and displays pending/success/error states; this is client-render coverage only because the schema is mocked.
- `npm run smoke:live-packaged-protocol`: hard runtime proof that compiled app -> package bridge -> real local hub `ListPackages` returns manifest-sourced `botster-web` settings -> settings UI -> `set_package_configuration` dispatch. If the hub lacks the needed action/schema support, capture that exact failure and register the hub dependency instead.
- Manual check, if live smoke is unavailable: inspect harness events for `daemon_request` with `type: "set_package_configuration"`, `package_name: "botster-web"`, and a non-PII boolean remote access value.

## Pipeline Gates And Artifacts

- Plan artifact: this document.
- Plan gate evidence should include this plan plus loaded vault notes, assumptions, current run/target ids, and checklist evidence.
- Implement gate should require changed files, verification command output, proof that the runtime path uses hub DTOs, and a dependency registration if hub support is missing.
- Implement gate should include the early probe result before accepting downstream UI/test work.
- Review/verify should reject any implementation that stores remote access only in React local state or dispatches a synthetic request not present in `src/botster/generated/daemon-protocol.ts`.
- Review/verify should reject evidence that relies only on `scripts/packaged-browser-smoke.mjs` fixture configuration without live manifest -> hub proof or an explicit hub dependency.

## Vault Gaps Worth Capturing

- Capture after implementation if the hub package manifest schema has a durable field grammar for boolean settings that future botster-web settings should follow.
- Capture after implementation if `set_package_configuration` proves to be the canonical remote-access opt-in mechanism, or if a missing hub action forces a new dependency.
- No convention conflict found in planning: the plan stays within Botster SPA/package settings conventions, authoritative DTO generation, and plugin/package configuration contracts.
