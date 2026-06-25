# botster-web web_app package readiness URL plan

## Context loaded

- Pipeline context: `project_pipelines_current_context` for run `run_1782364558_228136`, step `botster_plan`, ticket `ticket_1782361545_531130`.
- Ticket intent: declare `botster-web` as a first-party web app package using the closed dependency's core/hub client app entrypoint contract, expose structured readiness evidence for hub `local_url`/app-launch state, keep the compiled packaged UI path, and document local-path install plus future hub open flow.
- Dependency context: `ticket_1782361545_165494` is recorded as closed. Plan Review verified the concrete merged contract in botster-core `origin/main`: `docs/examples/package-runnable-entrypoints.json` and `crates/botster-core/tests/package_runnable_entrypoint_contract_test.rs`.
- Concrete web app contract to consume verbatim: runnable entrypoint `{ id, kind: "web_app", launch_mode: "background", command, args, working_directory: { policy }, injections: [{ kind: "hub_connection" | "data_dir" | "hub_socket", target: { type: "environment", name }, required: true, description? }], environment: [...], readiness: { result_fields: ["local_url"] } }`. The launch result DTO carries structured `{ local_url: "http://127.0.0.1:49152" }` when `local_url` is declared. Core defines the manifest/result shape only; hub owns launch policy and any process-output capture.
- Playbooks and vault notes loaded: [[planner-playbook]], [[botster-planner-playbook]], [[botster-architecture]], [[cli-patterns]], [[spa-patterns]], [[project pipeline orchestration belongs in a device-level botster plugin]], [[project pipelines needs an operator workbench not more primitives]], [[project pipelines ui contract belongs in the plugin readme]], [[botster orchestration should spawn agents with explicit target ids]], [[botster orchestration prompts must bind agents to explicit worktrees]], [[plan steps need reviewable plan artifacts]], [[pipeline artifacts should use path neutral worktree references]], [[project pipelines checklist worker timeouts require artifact evidence fallback]].
- Repo context inspected: `botster-package.json`, `plugin.lua`, `README.md`, `package.json`, `scripts/real-hub-dogfood-bridge.mjs`, `scripts/packaged-browser-smoke.mjs`, `src/App.test.mjs`, `src/botster/generated/daemon-protocol.ts`.
- Workflow evidence: a run-level vault checklist was created and updated. Initial custom checklist creation failed on duplicate item ids, so checklist evidence is also preserved in this durable plan and the Plan gate evidence.
- Plan Review changes folded in: concrete cross-repo contract citation, `required:true` injection decision, `mode` replacement by `launch_mode`, named environment-to-injections manifest delta, testable `local_url` readiness evidence, and manifest-validation authority risk.

## Scope

- Update `botster-package.json` so the existing `web-client` runnable entrypoint becomes the concrete botster-core `web_app` contract:
  - `kind: "web_app"`;
  - `launch_mode: "background"`;
  - remove the stale `mode: "dev"` field;
  - keep `command: "node"`, `args` pointing at `scripts/real-hub-dogfood-bridge.mjs`, and `working_directory: { "policy": "package_root" }`;
  - replace the old optional environment rows for hub connection values with `injections` for `hub_connection`, `data_dir`, and `hub_socket` targeting environment variables, all `required: true`, matching the core example and asserting that hub-supervised normal package launch supplies these values;
  - add `readiness: { "result_fields": ["local_url"] }`.
- Preserve the inert Lua `entrypoints` row and `plugin.lua` unless the dependency contract explicitly removes the current enable/prepare requirement. Current vault context says local runnable packages still need a core entrypoint for enable/prepare.
- Update the package runtime startup/readiness path in `scripts/real-hub-dogfood-bridge.mjs` only as needed for structured readiness evidence. The runtime must compute the actual bound origin from `server.address()` and expose it as `local_url` in `GET /health`. If the bridge accepts a configured or ephemeral port, `local_url` must reflect the actual bound port, not the default constant.
- Update tests in `src/App.test.mjs` and, if generated hub DTOs changed, `src/botster/generated/daemon-protocol.ts` plus fixtures through the existing drift-check path.
- Update `README.md` to show local path install/enable and the intended hub-open flow once the hub app command exists, while keeping Vite documented as development-only.

## Non-scope

- Do not implement hub registry policy, trust policy, first-party admission semantics, or package lifecycle legality in `botster-web`.
- Do not require Vite at runtime for package use. Normal package runtime must keep serving `dist` through the existing bridge.
- Do not add a new transport protocol, new web server framework, extra package manager dependency, or broad refactor of the dogfood bridge.
- Do not change Project Pipelines plugin UI/workflow behavior; this ticket only touches the `botster-web` package/runtime/docs path.
- Do not implement hub process-output parsing or the future hub app command. The hub-population leg remains scaffold-only until hub owns that launch/capture path; this ticket provides the manifest declaration and concrete local runtime evidence.

## Assumptions and unknowns

- Assumption: the botster-core `web_app` manifest contract cited above is authoritative for this ticket even though the source files live in the sibling core repo, not this `botster-web` tree.
- Assumption: hub-supervised package launch should require hub injection values. Marking `hub_connection`, `data_dir`, and `hub_socket` injections `required: true` matches the core contract. The packaged browser smoke remains valid because it bypasses hub manifest launch and explicitly supplies a fake `BOTSTER_HUB_SOCKET` while exercising the compiled UI path without Vite.
- Assumption: structured readiness for this ticket is the combination of manifest `readiness.result_fields:["local_url"]` plus local runtime `GET /health` returning the actual `local_url`. The future hub launch-result capture remains outside this repo until the hub app command exists.
- Unknown: whether botster-core will later add an authoritative manifest drift-check artifact like `src/botster/generated/daemon-protocol.ts`. For now, `src/App.test.mjs` can assert the concrete merged shape but is still a local mirror, not serde validation.
- Worktree/target assumption: work happens in the pipeline-provided ticket worktree for target `tgt_40abcf71ccf049f4ac0c99953a799869`.

## Affected surfaces/files

- `botster-package.json`: primary package manifest change from generic `kind: "web"` + `mode: "dev"` runnable entrypoint to `kind: "web_app"` + `launch_mode: "background"` + required injections + `readiness.result_fields:["local_url"]`.
- `scripts/real-hub-dogfood-bridge.mjs`: narrow readiness change to compute and expose actual `local_url` from the bound HTTP server while keeping compiled UI serving and existing bridge modes.
- `src/App.test.mjs`: manifest validation and package-runtime tests should assert the new contract and structured readiness evidence.
- `src/botster/generated/daemon-protocol.ts` and related fixture files: only if the closed dependency changed public hub-client DTOs that the browser mirrors.
- `README.md`: local path install docs and hub app opening docs once the hub command exists.
- `plugin.lua`: expected unchanged unless enable/prepare requirements changed upstream.

## Risks

- Core-contract drift risk: `src/App.test.mjs` will assert a local JS mirror of the merged botster-core contract, not run the core serde validator. Mitigation: cite botster-core source paths in docs/tests and assert the full concrete shape, including `web_app`, `launch_mode`, `injections`, and `readiness`.
- Runtime regression risk: moving the entrypoint could accidentally make Vite required. Mitigation: keep `node scripts/real-hub-dogfood-bridge.mjs` serving `dist` and prove with packaged browser smoke.
- Hub-wiring risk: manifest declares `local_url` as a launch result field before hub app command/process capture exists. Mitigation: document that hub population is scaffold-only in this repo and prove the local runtime emits `local_url` through `/health`.
- Port/readiness risk: `BOTSTER_WEB_DOGFOOD_BRIDGE_PORT` defaults to `41739`, but hub-launched apps may need ephemeral ports. Mitigation: `local_url` must be computed after bind from `server.address()` and tests should cover the configured-port path at minimum.
- Required-injection risk: setting required injections can appear to conflict with standalone smoke. Mitigation: state the boundary: required injections apply to hub-supervised package launch; smoke supplies a fake socket directly and proves compiled UI/no-Vite runtime, not manifest-driven hub launch.
- PII risk: plan/docs/test fixtures must avoid local absolute paths, sockets, or usernames in committed artifacts.

## Acceptance checks/tests

- `npm test`
  - Existing daemon protocol drift check still passes.
  - Manifest validation asserts the full concrete merged shape: `kind:"web_app"`, `launch_mode:"background"`, no stale `mode:"dev"`, required `hub_connection`/`data_dir`/`hub_socket` injections targeting environment variables, and `readiness.result_fields:["local_url"]`.
  - Package runtime tests prove `/`, `/?dogfood=real-hub`, SPA fallback routes, assets, and `/health` still work without Vite.
  - Package runtime tests assert `GET /health` includes `local_url` equal to the actual bridge origin used by the test.
- `npm run build`
  - Verifies TypeScript/Vite compiled packaged UI remains intact.
- `npm run smoke:packaged-browser`
  - Proves the compiled packaged UI opens through the package bridge, renders real-hub dogfood UI, avoids console/page/asset failures, and preserves the terminal/data-plane smoke path.
- Manual or test-level runtime-path explanation in Implement gate:
  - show where hub/package start uses `botster-package.json` to launch `node scripts/real-hub-dogfood-bridge.mjs`;
  - show how manifest `readiness.result_fields:["local_url"]` pairs with runtime `GET /health.local_url`;
  - state that hub launch-result capture/open-app command is intentionally scaffold-only here because core defines the result field but not process-to-host emission and hub owns that future path;
  - show why Vite is not in the normal package runtime path.

## Vault gaps worth capturing

- Capture the exact `web_app` client app entrypoint/readiness manifest contract from botster-core after implementation confirms the final botster-web shape.
- Capture a Botster-web note if structured app readiness establishes a reusable pattern for local URL evidence across first-party web clients.
- No new checklist-timeout note is needed from this plan step because [[project pipelines checklist worker timeouts require artifact evidence fallback]] already covers the observed fallback pattern.
