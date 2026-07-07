import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  materializePluginContractMatrixFixture,
  metadata as hubTestSupportMetadata,
  verifyPackageAssets
} from "@trybotster/hub-test-support";
import ts from "typescript";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { dogfoodBridgeShutdownPlan, resolveDogfoodBridgeMode } = await import(
  new URL("../scripts/dogfoodBridgeMode.mjs", import.meta.url)
);

const hostForTests = "127.0.0.1";

const [
  main,
  app,
  client,
  dogfoodMode,
  localDogfoodTransport,
  realHubDaemonDto,
  generatedDaemonProtocol,
  realHubDogfoodTransport,
  realHubTerminalDataPlane,
  webrtcDaemonClient,
  connectionDiagnostics,
  connectionDiagnosticsPanel,
  dogfoodFirstScreen,
  protocol,
  entities,
  uiNodes,
  actions,
  terminal,
  resttyRenderer,
  terminalHost,
  terminalSmokeFixture,
  pluginSurfaces,
  packageManifestRaw,
  packageJsonRaw,
  pluginEntrypoint,
  checkDaemonProtocolDriftScript,
  dogfoodBridgeModeScript,
  dogfoodBridgeScript,
  liveProtocolHarnessScript,
  architecture,
  readme,
  css,
  vendorReadme
] = await Promise.all([
  readFile(new URL("./main.tsx", import.meta.url), "utf8"),
  readFile(new URL("./App.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/client.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/dogfoodMode.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/localDogfoodTransport.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/realHubDaemonDto.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/generated/daemon-protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/realHubDogfoodTransport.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/realHubTerminalDataPlane.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/webrtcDaemonClient.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/connectionDiagnostics.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/ConnectionDiagnosticsPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/dogfoodFirstScreen.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/entities.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/uiNodes.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminal.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/resttyRenderer.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/TerminalViewHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminalSmokeFixture.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/pluginSurfaces.ts", import.meta.url), "utf8"),
  readFile(new URL("../botster-package.json", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../plugin.lua", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-daemon-protocol-drift.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/dogfoodBridgeMode.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/real-hub-dogfood-bridge.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/live-packaged-protocol-harness.mjs", import.meta.url), "utf8"),
  readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("./theme/app.css", import.meta.url), "utf8"),
  readFile(new URL("./vendor/restty/README.md", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiNodeSurface \} from "\.\/botster\/UiNodeSurface"/);
assert.match(app, /IonToast/);
assert.match(app, /import \{ TerminalViewHost \} from "\.\/botster\/TerminalViewHost"/);
assert.match(app, /import \{ ConnectionDiagnosticsPanel \} from "\.\/botster\/ConnectionDiagnosticsPanel"/);
assert.match(app, /import \{ DogfoodFirstScreen/);
assert.match(app, /createBotsterWebClient/);
assert.match(app, /createDogfoodRuntimeConfig/);
assert.match(app, /platform:\s*\{\s*desktop:/);
assert.match(app, /packageRuntime \? \{ bridgeUrl: `\$\{window\.location\.origin\}\/request` \} : \{\}/);
assert.match(app, /__BOTSTER_PACKAGE_RUNTIME__/);
assert.match(app, /initialConnectionDiagnostics\(dogfoodRuntime\.mode, dogfoodRuntime\.statusText, dogfoodRuntime\.terminalDataPlaneKind\)/);
assert.match(app, /terminalDataPlaneLabel\(dogfoodRuntime\.terminalDataPlaneKind\)/);
assert.match(app, /window\.addEventListener\(webRtcDaemonLifecycleEventName, recordWebRtcLifecycle\)/);
assert.match(app, /runtimeClient\.hub\.subscribeSurface/);
assert.match(app, /runtimeClient\.entities\.pull/);
assert.match(app, /type AppRoute =/);
assert.match(app, /const appViewPaths: Record<AppView, string>/);
assert.match(app, /function appRouteFromPathname\(pathname: string\): AppRoute/);
assert.match(app, /normalizedPath\.startsWith\("\/packages\/"\)/);
assert.match(app, /routeKind === "surfaces"/);
assert.match(app, /routeKind === "settings"/);
assert.match(app, /function appRoutePath\(route: AppRoute\): string/);
assert.match(app, /function pushAppRouteUrl\(route: AppRoute\): void/);
assert.match(app, /navigateToHubRoutePath/);
assert.match(app, /botster-web\.package_navigation/);
assert.match(app, /openPackageNavigation/);
assert.doesNotMatch(app, /installedApps\.slice\(0, 5\)/);
assert.match(app, /window\.history\.pushState\(\{ botsterRoute: route \}/);
assert.match(app, /window\.addEventListener\("popstate", syncViewFromLocation\)/);
assert.match(app, /lastPluginRouteRenderKey/);
assert.match(app, /routePluginSurfaceDiagnostic/);
assert.match(app, /data-testid="plugin-settings-route"/);
assert.doesNotMatch(app, /IonModal/);
assert.match(app, /Marketplace registry path/);
assert.match(app, /Local package path/);
assert.match(app, /registry_path: registryPath/);
assert.match(app, /request_type: "install_package_local_path"/);
assert.match(app, /packageActionFeedback\(result\)/);
assert.match(app, /setPackageActionToast\(packageFeedback\)/);
assert.match(app, /package_decision/);
assert.match(app, /install_plan/);
assert.match(app, /schemaVersionDiagnosticFromFrame/);
assert.match(app, /operatorErrorDiagnostic/);
assert.match(app, /hubConnectionDiagnosticFromFrame/);
assert.match(app, /dogfood\.diagnostic_action_status/);
assert.match(app, /dogfood\.plugin_surface_status/);
assert.match(app, /plugin-surface-hub-validated-v1/);
assert.doesNotMatch(app, /plugin-surface-body-v1|normalizePluginSurfaceNode|pluginSurfaceBodySnapshot/);
assert.match(app, /terminalUnavailableDiagnostic/);
assert.match(app, /surfaceSnapshot \?\? loadingSnapshot/);
assert.match(app, /runtimeClient\.entities\.list\("botster-web\.app"\)/);
assert.match(app, /pullDogfoodEntity\("app", \{ family: "botster-web\.app" \}\)/);
assert.match(app, /window\.open\(localUrl, "_blank", "noopener,noreferrer"\)/);
assert.match(app, /export function AppListItem/);
assert.match(app, /appSurfacePackages\.get\(stringValue\(app\.package_name, ""\)\)/);
assert.match(app, /packageAppSurfaces\(app\)/);
assert.match(app, /packageSettingsSurfaces\(app\)/);
assert.match(app, /navigateToPluginSurface\(packageName, surfaceId\)/);
assert.match(app, /runtimeClient\.actions\.dispatch\(\{ origin: "ui_node", action: routePluginLaunchAction \}\)/);
assert.match(app, /surfaceLaunchAction\(surface\)/);
assert.doesNotMatch(app, /const packagesWithUi|const packagesWithoutUi/);
assert.match(app, /aria-label="Rendered app surface"/);
assert.doesNotMatch(app, /function pluginViewSurface/);
assert.doesNotMatch(app, /function pluginSettingsSurface/);
assert.doesNotMatch(app, /app\.view_surface(?!s)|app\.plugin_view_surface|app\.primary_surface|app\.ui_surface/);
assert.doesNotMatch(app, /app\.settings_surface(?!s)|app\.plugin_settings_surface/);
assert.doesNotMatch(app, /fixtureEntityFrames/);
assert.doesNotMatch(app, /uiNodeConformanceSnapshot/);
assert.doesNotMatch(app, /createInMemoryEntityFrameStore\(fixtureEntityFrames\)/);
assert.match(app, /botsterWebClientContract\.label/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.doesNotMatch(app, /Ionic React renderer shell/);
assert.doesNotMatch(app, /<IonButton fill="solid" color="primary">\s*[\s\S]*Inspect frames/);
assert.doesNotMatch(app, /Inspect frames/);
assert.match(app, /<UiNodeSurface/);
assert.match(app, /<ConnectionDiagnosticsPanel/);
assert.match(app, /<DogfoodFirstScreen/);
assert.match(app, /data-testid="renderer-registry-workflow"/);
assert.match(app, /aria-label="Diagnostic workspace"/);
assert.doesNotMatch(app, /data-testid="terminal-workflow"/);
assert.doesNotMatch(app, /Selected app/);
assert.doesNotMatch(app, /selected-app-panel/);
assert.match(app, /<IonGrid className="workflow-overview"/);
assert.match(app, /<IonGrid className="dashboard-layout"/);
assert.match(app, /<IonGrid className="workspace-grid"/);
assert.match(app, /<IonCol size="12" sizeLg="8"/);
assert.match(app, /<IonCol size="12" sizeLg="4"/);
assert.match(app, /onAction=\{dispatchAction\}/);
assert.match(app, /selectedRealHubTerminalSessionId/);
assert.match(app, /isAttachableSession/);
assert.match(app, /dogfoodRuntime\.createTerminalDataPlane\(terminalDescriptor\.sessionId\)/);
assert.match(app, /descriptor=\{terminalDescriptor\}/);
assert.match(app, /dataPlane=\{terminalDataPlane\}/);
assert.match(app, /Select a running session to attach the terminal panel/);
assert.match(app, /onDiagnostic=\{recordTerminalDiagnostic\}/);
assert.doesNotMatch(app, /terminal-placeholder/);
assert.match(client, /export const botsterWebClientContract/);
assert.match(client, /createBotsterWebClient/);
assert.match(client, /InMemoryUiTreeSnapshotStore/);
assert.match(client, /frame\.kind === "ui_tree_snapshot"/);
assert.match(client, /"terminal_view bridge"/);
assert.match(localDogfoodTransport, /createLocalDogfoodTransport/);
assert.match(localDogfoodTransport, /dogfoodUiTreeSnapshot/);
assert.match(localDogfoodTransport, /"botster\.session\.select"/);
assert.match(localDogfoodTransport, /"botster\.session\.rename"/);
assert.match(dogfoodMode, /VITE_BOTSTER_REAL_HUB_DOGFOOD/);
assert.match(dogfoodMode, /dogfood"\) === realModeQueryValue/);
assert.match(dogfoodMode, /packageRuntime/);
assert.match(dogfoodMode, /createRealHubDogfoodTransport/);
assert.match(dogfoodMode, /createRealHubTerminalDataPlane/);
assert.match(realHubDaemonDto, /export type \* from "\.\/generated\/daemon-protocol"/);
assert.match(realHubDaemonDto, /DaemonBridgeRequestEnvelope/);
assert.match(realHubDaemonDto, /DaemonBridgeResponseEnvelope/);
assert.doesNotMatch(realHubDaemonDto, /export type DaemonRequest\s*=/);
assert.doesNotMatch(realHubDaemonDto, /export interface DaemonResponse\s*\{/);
assert.doesNotMatch(realHubDaemonDto, /export interface DaemonPackage\s*\{/);
assert.doesNotMatch(realHubDaemonDto, /export type DaemonEvent\s*=/);
assert.match(generatedDaemonProtocol, /Generated from crates\/botster-hub-client Rust serde DTOs/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_apps" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_package_navigation" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_packages" \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "list_available_packages"; registry_path: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "install_package_registry_entry"; registry_path: string; entry_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "set_package_configuration"; package_name: string; values: Record<string, JsonValue> \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "install_package_local_path"; path: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "enable_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "disable_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "remove_package"; package_name: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "start_package_entrypoint"; package_name: string; entrypoint_id: string; environment_overrides\?: Record<string, string> \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "stop_package_entrypoint"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "restart_package_entrypoint"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "package_entrypoint_status"; package_name: string; entrypoint_id: string \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "plugin_surface_render"; package_name: string; surface_id: string; payload: JsonValue \}/);
assert.match(generatedDaemonProtocol, /\| \{ type: "plugin_surface_action"; package_name: string; surface_id: string; action_id: string; payload: JsonValue \}/);
assert.doesNotMatch(app, /action\.id === "contract\.action"/);
assert.doesNotMatch(realHubDogfoodTransport, /action\.id === "contract\.action"/);
assert.doesNotMatch(realHubDogfoodTransport, /botster\.plugin-contract-matrix|surface_id:\s*"contract\.app"/);
assert.match(realHubDogfoodTransport, /pluginSurfaceActionRequest\(action\)/);
assert.match(realHubDogfoodTransport, /package_name:\s*pluginSurfaceAction\.packageName/);
assert.match(realHubDogfoodTransport, /surface_id:\s*pluginSurfaceAction\.surfaceId/);
assert.match(realHubDogfoodTransport, /action_id:\s*pluginSurfaceAction\.actionId/);
assert.match(liveProtocolHarnessScript, /waitForContractActionResult/);
assert.match(liveProtocolHarnessScript, /waitForVisibleContractMatrixText/);
assert.doesNotMatch(liveProtocolHarnessScript, /accepted\|accepted/i);
assert.doesNotMatch(liveProtocolHarnessScript, /operator\/i/);
assert.doesNotMatch(liveProtocolHarnessScript, /Rejected contract\\.action\|error/i);
assert.match(generatedDaemonProtocol, /plugin_surface\?: DaemonPluginSurface \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonPluginSurface/);
assert.match(generatedDaemonProtocol, /body: JsonValue;/);
assert.match(generatedDaemonProtocol, /ui_tree_snapshot\?: DaemonUiTreeSnapshot \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonUiTreeSnapshot/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackage/);
assert.match(generatedDaemonProtocol, /apps\?: DaemonApp\[\];/);
assert.match(generatedDaemonProtocol, /package_navigation\?: DaemonPackageNavigationEntry\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonApp/);
assert.match(generatedDaemonProtocol, /export interface DaemonAppLaunchTarget/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageNavigationEntry/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageNavigationSource/);
assert.match(generatedDaemonProtocol, /local_url\?: string \| null;/);
assert.match(generatedDaemonProtocol, /package_name: string/);
assert.match(generatedDaemonProtocol, /requested_capabilities: DaemonCapability\[\]/);
assert.match(generatedDaemonProtocol, /runnable_entrypoints: DaemonPackageRunnableEntrypoint\[\]/);
assert.match(generatedDaemonProtocol, /configuration: DaemonPackageConfiguration;/);
assert.match(generatedDaemonProtocol, /actions\?: DaemonPackageActionState\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageActionState/);
assert.match(generatedDaemonProtocol, /request\?: DaemonPackageActionRequest \| null;/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageConfiguration/);
assert.match(generatedDaemonProtocol, /schema\?: JsonValue \| null;/);
assert.match(generatedDaemonProtocol, /effective_values\?: Record<string, JsonValue>;/);
assert.match(generatedDaemonProtocol, /missing_required\?: string\[\];/);
assert.match(generatedDaemonProtocol, /export interface DaemonPackageProcess/);
assert.match(generatedDaemonProtocol, /pid\?: number;/);
assert.match(generatedDaemonProtocol, /diagnostics\?: DaemonDiagnostic\[\]/);
assert.match(generatedDaemonProtocol, /export type DaemonEvent/);
assert.match(generatedDaemonProtocol, /\| \{ type: "snapshot"; session_id: string; subscription_id: string; data: string; bytes: number \}/);
assert.doesNotMatch(realHubDaemonDto, /compressed\?: boolean|encoding\?: string/);
assert.match(realHubDogfoodTransport, /kind: "daemon_request"/);
assert.match(realHubDogfoodTransport, /reply\.kind !== "daemon_response"/);
assert.match(realHubDogfoodTransport, /subscribeEvents/);
assert.match(realHubDogfoodTransport, /daemonEventSubscription/);
assert.match(realHubDogfoodTransport, /recordLiveHarnessEvent\("hub_frame"/);
assert.match(realHubDogfoodTransport, /daemonResponseFrames/);
assert.match(realHubDogfoodTransport, /realHubDogfoodUiTreeSnapshot/);
assert.match(realHubDogfoodTransport, /const packageFamily = "botster-web\.package"/);
assert.match(realHubDogfoodTransport, /const appFamily = "botster-web\.app"/);
assert.match(realHubDogfoodTransport, /const packageNavigationFamily = "botster-web\.package_navigation"/);
assert.match(realHubDogfoodTransport, /bridge\.request\(\{ type: "list_apps" \}\)/);
assert.match(realHubDogfoodTransport, /bridge\.request\(\{ type: "list_package_navigation" \}\)/);
assert.match(realHubDogfoodTransport, /const availablePackageFamily = "botster-web\.available_package"/);
assert.match(realHubDogfoodTransport, /bridge\.request\(\{ type: "list_packages" \}\)/);
assert.match(realHubDogfoodTransport, /type: "list_available_packages"/);
assert.match(realHubDogfoodTransport, /type: "set_package_configuration"/);
assert.match(realHubDogfoodTransport, /botster\.package\.configuration\.save/);
assert.match(realHubDogfoodTransport, /botster\.package\.configure/);
assert.match(realHubDogfoodTransport, /botster\.package\.surface\.render/);
assert.match(realHubDogfoodTransport, /type: "plugin_surface_render"/);
assert.match(realHubDogfoodTransport, /DaemonPackageActionState/);
assert.match(realHubDogfoodTransport, /function appRecord\(app: DaemonApp\)/);
assert.match(realHubDogfoodTransport, /family: appFamily/);
assert.match(realHubDogfoodTransport, /id: "botster\.app\.open_url"/);
assert.match(realHubDogfoodTransport, /botster\.package\.daemon_request/);
assert.match(realHubDogfoodTransport, /package_decision: response\.package_decision/);
assert.match(realHubDogfoodTransport, /install_plan: response\.install_plan/);
assert.match(realHubDogfoodTransport, /diagnostics: responseDiagnostics\(response\)/);
assert.match(realHubDogfoodTransport, /daemonRequestFromDescriptor/);
assert.match(realHubDogfoodTransport, /type: "enable_package"/);
assert.match(realHubDogfoodTransport, /type: "disable_package"/);
assert.match(realHubDogfoodTransport, /type: "remove_package"/);
assert.match(realHubDogfoodTransport, /type: "start_package_entrypoint"/);
assert.match(realHubDogfoodTransport, /type: "stop_package_entrypoint"/);
assert.match(realHubDogfoodTransport, /type: "restart_package_entrypoint"/);
assert.match(realHubDogfoodTransport, /type: "package_entrypoint_status"/);
assert.doesNotMatch(realHubDogfoodTransport, /function packageManagementRequest|function packageEntrypointRequest|unsupportedPackageAction/);
assert.match(realHubDogfoodTransport, /family: packageFamily/);
assert.match(realHubDogfoodTransport, /family: availablePackageFamily/);
assert.doesNotMatch(realHubDogfoodTransport, /["']view_surface["']|["']settings_surface["']|UpdatePackage|update_package|reload_package|type: "restart_hub"/);
assert.match(realHubTerminalDataPlane, /streamTerminal/);
assert.match(realHubTerminalDataPlane, /type: "send_input"/);
assert.match(realHubTerminalDataPlane, /recordLiveHarnessTerminal\("input"/);
assert.match(realHubTerminalDataPlane, /recordLiveHarnessTerminal\("resize"/);
assert.match(realHubTerminalDataPlane, /this\.emitOutput\(event\.data, "output"\)/);
assert.match(realHubTerminalDataPlane, /this\.emitOutput\(event\.data, event\.type\)/);
assert.match(realHubTerminalDataPlane, /recordLiveHarnessTerminal\("attach_state"/);
assert.match(realHubTerminalDataPlane, /scrollback_unavailable/);
assert.match(realHubTerminalDataPlane, /Historical terminal \$\{kind\} restored/);
assert.match(realHubTerminalDataPlane, /type: "detach"/);
assert.match(realHubTerminalDataPlane, /const maxAttachAttempts = \d+/);
assert.match(realHubTerminalDataPlane, /attempt <= maxAttachAttempts/);
assert.match(realHubTerminalDataPlane, /this\.listeners\.size === 0/);
assert.match(connectionDiagnostics, /expectedDaemonSchemaVersion = 1/);
assert.match(connectionDiagnostics, /schemaVersionDiagnosticFromFrame/);
assert.match(connectionDiagnostics, /operatorErrorDiagnostic/);
assert.match(connectionDiagnostics, /terminalUnavailableDiagnostic/);
assert.match(connectionDiagnosticsPanel, /data-diagnostic-id/);
assert.match(connectionDiagnosticsPanel, /severityRank/);
assert.match(connectionDiagnosticsPanel, /severityLabel/);
assert.match(dogfoodFirstScreen, /Local hub workbench/);
assert.match(dogfoodFirstScreen, /packageLoadStatus/);
assert.match(dogfoodFirstScreen, /sessionLoadStatus/);
assert.match(dogfoodFirstScreen, /realHubDogfoodSessionId/);
assert.match(dogfoodBridgeScript, /protocol = "botster-hub-daemon-v1"/);
assert.match(dogfoodBridgeScript, /resolveDogfoodBridgeMode/);
assert.match(dogfoodBridgeScript, /serveStaticUi/);
assert.match(dogfoodBridgeScript, /__BOTSTER_PACKAGE_RUNTIME__/);
assert.match(dogfoodBridgeScript, /case "\.mjs":/);
assert.match(dogfoodBridgeScript, /case "\.map":/);
assert.match(dogfoodBridgeModeScript, /BOTSTER_HUB_BIN/);
assert.match(dogfoodBridgeModeScript, /BOTSTER_HUB_SOCKET/);
assert.match(dogfoodBridgeModeScript, /BOTSTER_HUB_DATA_DIR/);
assert.match(dogfoodBridgeScript, /kind: "daemon_response"/);
assert.match(dogfoodBridgeScript, /deterministicBotsterWebSurfaceResponse/);
assert.match(dogfoodBridgeScript, /package_name: "botster-web"/);
assert.match(dogfoodBridgeScript, /surface_id: daemonRequest\.surface_id/);
assert.match(dogfoodBridgeScript, /existing_hub_shutdown_ignored/);
assert.match(dogfoodBridgeScript, /text\/event-stream/);
assert.match(dogfoodBridgeScript, /sendSseEvent\(response, "daemon_event"/);
assert.match(liveProtocolHarnessScript, /BOTSTER_HUB_BIN/);
assert.match(liveProtocolHarnessScript, /BOTSTER_SESSION_WORKER_BIN/);
assert.match(liveProtocolHarnessScript, /delete env\.BOTSTER_HUB_SOCKET/);
assert.match(liveProtocolHarnessScript, /delete env\.BOTSTER_HUB_DATA_DIR/);
assert.match(liveProtocolHarnessScript, /chromium\.launch/);
assert.match(liveProtocolHarnessScript, /__BOTSTER_LIVE_PROTOCOL_HARNESS__/);
assert.match(liveProtocolHarnessScript, /botster-web-dogfood-ready/);
assert.match(liveProtocolHarnessScript, /page\.reload/);
assert.match(liveProtocolHarnessScript, /reloadSamePackageUrlAndAssertWebrtc/);
assert.match(liveProtocolHarnessScript, /latestLocalWebrtcGrantId/);
assert.doesNotMatch(liveProtocolHarnessScript, /type: "stop_package_entrypoint"/);
assert.match(liveProtocolHarnessScript, /waitForSessionAttachable\(page, true\)/);
assert.match(liveProtocolHarnessScript, /waitForHistoricalTerminalRestore/);
assert.match(liveProtocolHarnessScript, /waitForTerminalRendererWrite/);
assert.match(liveProtocolHarnessScript, /waitForTerminalCanvas/);
assert.match(liveProtocolHarnessScript, /waitForDaemonRequestCount/);
assert.match(liveProtocolHarnessScript, /waitForTerminalSession/);
assert.match(liveProtocolHarnessScript, /type: "send_input"/);
assert.match(liveProtocolHarnessScript, /typeThroughMountedTerminal\(page, `\$\{echoProbe\}\\n`\)/);
assert.match(liveProtocolHarnessScript, /callTerminalControl\(page, "focus"\)/);
assert.match(liveProtocolHarnessScript, /page\.waitForTimeout\(100\)/);
assert.match(liveProtocolHarnessScript, /page\.keyboard\.insertText\(data\)/);
assert.doesNotMatch(liveProtocolHarnessScript, /callTerminalControl\(page, "writeInput", `\$\{echoProbe\}\\n`\)/);
assert.match(liveProtocolHarnessScript, /key === "grant_secret" && nextValue !== "\[redacted\]"/);
assert.match(liveProtocolHarnessScript, /waitForTerminalAttachState\(page, \["attached"\]\)/);
assert.match(liveProtocolHarnessScript, /waitForTerminalDetached/);
assert.match(liveProtocolHarnessScript, /botster-web-dogfood-echo:/);
assert.match(liveProtocolHarnessScript, /botster-web-dogfood-size:/);
assert.match(liveProtocolHarnessScript, /waitForResizeProof/);
assert.match(liveProtocolHarnessScript, /assertNoUnknownSession/);
assert.match(liveProtocolHarnessScript, /last observed/);
assert.match(liveProtocolHarnessScript, /botster-web-dogfood-exiting/);
assert.match(liveProtocolHarnessScript, /process_exit/);
assert.match(liveProtocolHarnessScript, /waitForSessionStatus/);
assert.match(liveProtocolHarnessScript, /hub_frame/);
assert.match(liveProtocolHarnessScript, /botster-web\.session/);
assert.match(liveProtocolHarnessScript, /daemon_shutdown/);
assert.match(liveProtocolHarnessScript, /assertNoBrowserFailures/);
assert.match(liveProtocolHarnessScript, /browserFailureSummary/);
assert.match(protocol, /type HubControlFrameKind/);
assert.match(protocol, /"action_request"/);
assert.match(protocol, /"ui_tree_snapshot"/);
assert.match(protocol, /"entity_snapshot"/);
assert.match(entities, /class InMemoryEntityFrameStore/);
assert.match(entities, /createInMemoryEntityFrameStore/);
assert.match(entities, /replayActivePulls/);
assert.match(
  uiNodes,
  /render\(snapshot: UiTreeSnapshot, entities: EntityFrameStore, options\?: UiNodeRenderOptions\)/
);
assert.match(actions, /class CorrelatedActionDispatcher/);
assert.match(actions, /botster\.session\.select/);
assert.doesNotMatch(actions, /click|submit|change/);
assert.match(uiNodes, /dispatchAction\?: \(action: ActionBinding, node: UiNode\) => void/);
assert.doesNotMatch(app, /dangerouslySetInnerHTML|srcDoc/);
assert.doesNotMatch(client, /dangerouslySetInnerHTML|srcDoc/);
assert.doesNotMatch(localDogfoodTransport, /dangerouslySetInnerHTML|srcDoc/);
assert.doesNotMatch(realHubDogfoodTransport, /dangerouslySetInnerHTML|srcDoc/);
assert.match(terminal, /renderer: "restty"/);
assert.match(terminal, /class DefaultTerminalViewBridge/);
assert.match(terminal, /TerminalViewMount/);
assert.match(terminal, /attach\(/);
assert.match(terminal, /detach\(/);
assert.match(terminal, /state\.dataPlane === dataPlane/);
assert.match(terminal, /renderer\.attachDataPlane/);
assert.match(terminal, /renderer_write/);
assert.match(terminal, /terminalLastRenderedOutput/);
assert.match(terminal, /writeInput\(/);
assert.match(terminal, /subscribeOutput/);
assert.match(terminal, /renderer\.destroy\(\)/);
assert.match(resttyRenderer, /from "\.\.\/vendor\/restty\/internal\.js"/);
assert.doesNotMatch(resttyRenderer, /vendor\/restty\/xterm\.js/);
assert.match(resttyRenderer, /new Restty/);
assert.match(resttyRenderer, /createInitialPane:\s*\{\s*focus:\s*false\s*\}/);
assert.match(resttyRenderer, /fontSources: botsterResttyFontSources/);
assert.match(resttyRenderer, /ptyTransport: this\.ptyTransport/);
assert.match(resttyRenderer, /connectPty\(\)/);
assert.doesNotMatch(resttyRenderer, /connectPty\(dataPlane\.sessionId\)/);
assert.match(resttyRenderer, /dataPlane\.resize\(rows, cols\)/);
assert.doesNotMatch(resttyRenderer, /fontPreset:\s*"none"/);
assert.doesNotMatch(resttyRenderer, /terminalRendererInput/);
assert.doesNotMatch(resttyRenderer, /sendInput\(data, "key"\)/);
assert.match(resttyRenderer, /this\.terminal\?\.destroy\(\)/);
assert.doesNotMatch(terminalHost, /ResizeObserver/);
assert.doesNotMatch(terminalHost, /requestAnimationFrame/);
assert.doesNotMatch(terminalHost, /cancelAnimationFrame/);
assert.match(terminalHost, /data-terminal-attach-state/);
assert.match(terminalHost, /subscribeStatus/);
assert.match(terminalHost, /bridge\.attach/);
assert.match(terminalHost, /focus: \(\) => bridge\.focus\(descriptor\)/);
assert.match(terminalHost, /bridge\.unmount/);
assert.match(terminalHost, /delete harness\.terminalControl/);
assert.match(terminalHost, /terminalMount/);
assert.match(terminalHost, /data-terminal-diagnostic="mount-failed"/);
assert.doesNotMatch(terminalHost, /tabIndex=\{0\}/);
assert.doesNotMatch(terminalHost, /onFocus=\{/);
assert.match(terminalSmokeFixture, /runTerminalViewBridgeSmokeFixture/);
assert.match(terminalSmokeFixture, /emitInput\("ls\\n"\)/);
assert.match(terminalSmokeFixture, /dataPlane\.emitOutput\("ok\\r\\n"\)/);
assert.match(terminalSmokeFixture, /bridge\.resize\(descriptor, 24, 80\)/);
assert.match(terminalSmokeFixture, /bridge\.writeInput\(descriptor, "premount\\n"\)/);
assert.match(terminalSmokeFixture, /bridge\.unmount\(descriptor\)/);
assert.match(pluginSurfaces, /sandbox: "host_rendered" \| "isolated_asset"/);
assert.match(architecture, /Control-plane hub frames/);
assert.match(architecture, /Terminal data-plane/);
assert.match(architecture, /Restty-backed `terminal_view`/);
assert.match(architecture, /botster-hub-client/);
assert.match(readme, /vendored build from the trybotster\/restty fork/);
assert.match(readme, /VITE_BOTSTER_REAL_HUB_DOGFOOD=1/);
assert.match(readme, /BOTSTER_HUB_BIN/);
assert.match(readme, /BOTSTER_HUB_SOCKET/);
assert.match(readme, /BOTSTER_HUB_DATA_DIR/);
assert.match(readme, /smoke:live-packaged-protocol/);
assert.match(readme, /Installed package runtime prefers the hub-issued local WebRTC bootstrap grant/);
assert.match(architecture, /src\/botster\/webrtcDaemonClient\.ts/);
assert.match(architecture, /AesGcmEnvelope/);
assert.match(generatedDaemonProtocol, /export interface AesGcmEnvelope/);
assert.match(generatedDaemonProtocol, /type: "local_webrtc_signal"/);
assert.match(generatedDaemonProtocol, /\| \{ type: "issue_local_webrtc_bootstrap"; package_name: string; entrypoint_id: string; origin: string \}/);
assert.match(generatedDaemonProtocol, /DaemonLocalWebrtcBootstrap/);
assert.match(generatedDaemonProtocol, /DaemonLocalWebrtcAnswer/);
assert.match(generatedDaemonProtocol, /local_webrtc_bootstrap/);
assert.match(generatedDaemonProtocol, /local_webrtc_answer/);
assert.match(dogfoodBridgeScript, /BOTSTER_LOCAL_WEBRTC_GRANT_ID/);
assert.match(dogfoodBridgeScript, /__BOTSTER_LOCAL_WEBRTC_BOOTSTRAP__/);
assert.match(app, /normalizeLocalWebrtcBootstrap/);
assert.match(webrtcDaemonClient, /createWebrtcDaemonClient/);
assert.match(webrtcDaemonClient, /createLocalWebrtcBootstrapRefresher/);
assert.match(webrtcDaemonClient, /createDataChannel\("botster-daemon"/);
assert.match(webrtcDaemonClient, /type: "local_webrtc_signal"/);
assert.match(webrtcDaemonClient, /grant_secret: "\[redacted\]"/);
assert.match(webrtcDaemonClient, /key === "grant_secret" \? "\[redacted\]" : redactedHarnessPayload\(value\)/);
assert.match(realHubDogfoodTransport, /key === "grant_secret" \? "\[redacted\]" : redactedHarnessPayload\(value\)/);
assert.match(webrtcDaemonClient, /crypto\.subtle\.encrypt/);
assert.match(webrtcDaemonClient, /crypto\.subtle\.decrypt/);
assert.match(webrtcDaemonClient, /AesGcmEnvelope/);
assert.match(readme, /botster-web-dogfood-size:<rows>x<cols>/);
assert.match(readme, /botster-web-dogfood-exit/);
assert.match(readme, /botster-package\.json/);
assert.match(readme, /packages install --data-dir[\s\S]*--path/);
assert.match(readme, /packages show --data-dir .* botster-web/);
assert.match(readme, /packages enable --data-dir .* botster-web/);
assert.match(readme, /local_development/);
assert.match(readme, /first-party-ready/);
assert.match(readme, /kind: web_app/);
assert.match(readme, /launch_mode: background/);
assert.match(readme, /readiness: local_url/);
assert.match(readme, /botster packages open botster-web web-client/);
assert.match(readme, /dogfood-app/);
assert.match(readme, /dogfood-settings/);
assert.match(readme, /PluginSurfaceRender/);
assert.match(vendorReadme, /e9742252312ee616d8f186b697d70349cf329250/);
assert.doesNotMatch(uiNodes, /terminal_view/);
assert.doesNotMatch(protocol, /terminal_input|terminal_output|terminal_resize|pty_bytes/);
assert.doesNotMatch(localDogfoodTransport, /terminal_input|terminal_output|terminal_resize|pty_bytes/);
assert.doesNotMatch(realHubDogfoodTransport, /terminal_input|terminal_output|terminal_resize|pty_bytes/);

const packageManifest = JSON.parse(packageManifestRaw);
const packageJson = JSON.parse(packageJsonRaw);
assert.equal(packageManifest.name, "botster-web");
assert.equal(packageManifest.version, packageJson.version);
assert.equal(packageJson.devDependencies["@trybotster/hub-test-support"], "0.1.1");
assert.equal(hubTestSupportMetadata.package_name, "@trybotster/hub-test-support");
assert.equal(hubTestSupportMetadata.package_version, "0.1.1");
assert.equal(hubTestSupportMetadata.plugin_contract_matrix.package_name, "botster.plugin-contract-matrix");
assert.equal(verifyPackageAssets().ok, true);
assert.match(checkDaemonProtocolDriftScript, /@trybotster\/hub-test-support/);
assert.doesNotMatch(checkDaemonProtocolDriftScript, /\.\.\/botster-hub|Skipping daemon protocol drift check|check out \.\.\/botster-hub/);
assert.match(liveProtocolHarnessScript, /@trybotster\/hub-test-support/);
assert.match(liveProtocolHarnessScript, /materializePluginContractMatrixFixture/);
assert.doesNotMatch(
  liveProtocolHarnessScript,
  /BOTSTER_HUB_SOURCE_DIR \? join\(process\.env\.BOTSTER_HUB_SOURCE_DIR, "fixtures\/plugins\/plugin-contract-matrix"\)/
);
const materializedFixtureRoot = await mkdtemp(join(tmpdir(), "botster-web-contract-matrix-fixture-"));
try {
  const materializedFixturePath = materializePluginContractMatrixFixture(materializedFixtureRoot);
  const materializedFixtureManifest = JSON.parse(await readFile(join(materializedFixturePath, "botster-package.json"), "utf8"));
  const materializedFixturePlugin = await readFile(join(materializedFixturePath, "plugin.lua"), "utf8");
  assert.equal(materializedFixtureManifest.name, "botster.plugin-contract-matrix");
  assert.match(materializedFixturePlugin, /contract\.app/);
} finally {
  await rm(materializedFixtureRoot, { recursive: true, force: true });
}
const mismatchedProtocolRoot = await mkdtemp(join(tmpdir(), "botster-web-daemon-protocol-mismatch-"));
try {
  const mismatchedProtocolPath = join(mismatchedProtocolRoot, "daemon-protocol.ts");
  await writeFile(mismatchedProtocolPath, `${generatedDaemonProtocol}\n// deliberate drift\n`);
  const driftResult = await runNodeScript(new URL("../scripts/check-daemon-protocol-drift.mjs", import.meta.url), {
    BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL: mismatchedProtocolPath
  });
  assert.notEqual(driftResult.code, 0);
  assert.match(`${driftResult.stdout}\n${driftResult.stderr}`, /Vendored daemon protocol drift detected/);
  assert.doesNotMatch(`${driftResult.stdout}\n${driftResult.stderr}`, /missing|Skipping daemon protocol drift check/i);
} finally {
  await rm(mismatchedProtocolRoot, { recursive: true, force: true });
}
assert.equal(
  packageJson.scripts["smoke:live-packaged-protocol"],
  "npm run build && node scripts/live-packaged-protocol-harness.mjs"
);
assert.equal(packageManifest.kind, "plugin");
assert.equal(packageManifest.botster, ">=0.1.0");
assert.deepEqual(packageManifest.source, { type: "path", path: "." });
assert.deepEqual(packageManifest.capabilities, []);
assert.deepEqual(packageManifest.configuration, {
  fields: [
    {
      key: "remote_browser_rendezvous_enabled",
      type: "boolean",
      label: "Remote browser access",
      description: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
      default: { type: "boolean", value: false }
    }
  ]
});
assert.deepEqual(packageManifest.surfaces, [
  {
    id: "dogfood-app",
    kind: "app",
    title: "botster-web Dogfood",
    description: "Descriptor-backed botster-web app surface for package launcher dogfood.",
    order: 1,
    category: "dogfood",
    supports: ["render"]
  },
  {
    id: "dogfood-settings",
    kind: "settings",
    title: "botster-web Settings",
    description: "Descriptor-backed settings surface for package launcher dogfood.",
    order: 2,
    category: "dogfood",
    supports: ["render"]
  }
]);
assert.equal(packageManifest.surfaces.some((surface) => surface.kind === "app"), true);
assert.equal(packageManifest.surfaces.some((surface) => surface.kind === "settings"), true);
assert.deepEqual(packageManifest.entrypoints, [
  { runtime: "lua", path: "plugin.lua", bootstrap: false }
]);
assert.equal(packageManifest.runnable_entrypoints.length, 1);
assert.match(pluginEntrypoint, /kind = "surface_route"/);
assert.match(pluginEntrypoint, /descriptor_id = "dogfood-app"/);
assert.match(pluginEntrypoint, /descriptor_id = "dogfood-settings"/);
assert.match(pluginEntrypoint, /Deterministic app surface rendered by the botster-web dogfood package/);
assert.doesNotMatch(pluginEntrypoint, /tools|commands|surfaces|entities|mcp/);

const [webClientEntrypoint] = packageManifest.runnable_entrypoints;
assert.equal(webClientEntrypoint.id, "web-client");
assert.equal(webClientEntrypoint.kind, "web_app");
assert.equal(webClientEntrypoint.launch_mode, "background");
assert.equal(webClientEntrypoint.command, "node");
assert.deepEqual(webClientEntrypoint.args, ["scripts/real-hub-dogfood-bridge.mjs"]);
assert.deepEqual(webClientEntrypoint.working_directory, { policy: "package_root" });
assert.equal(Object.hasOwn(webClientEntrypoint, "mode"), false);
assert.equal(webClientEntrypoint.may_supervise, true);
assert.deepEqual(webClientEntrypoint.capabilities, [{ surface: "network", scope: "localhost" }]);
assert.deepEqual(
  webClientEntrypoint.injections.map(({ kind, target, required }) => ({ kind, target, required })),
  [
    {
      kind: "hub_connection",
      target: { type: "environment", name: "BOTSTER_HUB_CONNECTION" },
      required: true
    },
    {
      kind: "data_dir",
      target: { type: "environment", name: "BOTSTER_HUB_DATA_DIR" },
      required: true
    },
    {
      kind: "hub_socket",
      target: { type: "environment", name: "BOTSTER_HUB_SOCKET" },
      required: true
    }
  ]
);
assert.equal(
  webClientEntrypoint.environment.length,
  0
);
assert.deepEqual(webClientEntrypoint.readiness, { result_fields: ["local_url"] });
assert.equal(
  webClientEntrypoint.injections.some(({ target }) => target.name === "BOTSTER_HUB_BIN"),
  false
);
assert.equal(
  webClientEntrypoint.injections.some(({ target }) => target.name === "BOTSTER_WEB_DOGFOOD_DATA_DIR"),
  false
);

const spawnedBridgeMode = resolveDogfoodBridgeMode(
  { BOTSTER_HUB_BIN: "./target/debug/botster-hub", BOTSTER_SESSION_WORKER_BIN: "./target/debug/botster-session-worker" },
  { cwd: "/workspace", generatedDataDir: "/tmp/botster-web-dogfood-test" }
);
assert.equal(spawnedBridgeMode.ok, true);
assert.equal(spawnedBridgeMode.mode, "spawned_hub");
assert.equal(spawnedBridgeMode.diagnosticLabel, "spawned isolated hub");
assert.equal(spawnedBridgeMode.socketPath, "/tmp/botster-web-dogfood-test/botster-hub.sock");
assert.equal(spawnedBridgeMode.hubBin, "/workspace/target/debug/botster-hub");
assert.deepEqual(spawnedBridgeMode.hubArgs, [
  "start",
  "--data-dir",
  "/tmp/botster-web-dogfood-test",
  "--session-worker-bin",
  "/workspace/target/debug/botster-session-worker"
]);
assert.deepEqual(dogfoodBridgeShutdownPlan(spawnedBridgeMode), {
  sendDaemonShutdown: true,
  terminateHubProcess: true,
  removeDataDir: true
});

const spawnedBridgeModeWithoutHubBin = resolveDogfoodBridgeMode({}, { generatedDataDir: "/tmp/unused" });
assert.equal(spawnedBridgeModeWithoutHubBin.ok, false);
assert.match(spawnedBridgeModeWithoutHubBin.error, /BOTSTER_HUB_BIN/);

const existingSocketBridgeMode = resolveDogfoodBridgeMode(
  { BOTSTER_HUB_SOCKET: "./dogfood/botster-hub.sock" },
  { cwd: "/workspace" }
);
assert.equal(existingSocketBridgeMode.ok, true);
assert.equal(existingSocketBridgeMode.mode, "existing_hub");
assert.equal(existingSocketBridgeMode.source, "socket");
assert.equal(existingSocketBridgeMode.diagnosticLabel, "existing hub socket");
assert.equal(existingSocketBridgeMode.socketPath, "/workspace/dogfood/botster-hub.sock");
assert.equal(existingSocketBridgeMode.hubBin, undefined);
assert.equal(existingSocketBridgeMode.hubArgs, undefined);
assert.deepEqual(existingSocketBridgeMode.health, {
  ok: true,
  mode: "existing_hub",
  source: "socket",
  socket: "configured"
});
assert.deepEqual(dogfoodBridgeShutdownPlan(existingSocketBridgeMode), {
  sendDaemonShutdown: false,
  terminateHubProcess: false,
  removeDataDir: false
});

const existingDataDirBridgeMode = resolveDogfoodBridgeMode(
  { BOTSTER_HUB_DATA_DIR: "./dogfood-data" },
  { cwd: "/workspace" }
);
assert.equal(existingDataDirBridgeMode.ok, true);
assert.equal(existingDataDirBridgeMode.mode, "existing_hub");
assert.equal(existingDataDirBridgeMode.source, "data_dir");
assert.equal(existingDataDirBridgeMode.diagnosticLabel, "existing hub data dir");
assert.equal(existingDataDirBridgeMode.socketPath, "/workspace/dogfood-data/botster-hub.sock");
assert.equal(existingDataDirBridgeMode.hubBin, undefined);
assert.equal(existingDataDirBridgeMode.hubArgs, undefined);
assert.deepEqual(dogfoodBridgeShutdownPlan(existingDataDirBridgeMode), {
  sendDaemonShutdown: false,
  terminateHubProcess: false,
  removeDataDir: false
});

const socketWinsBridgeMode = resolveDogfoodBridgeMode(
  { BOTSTER_HUB_SOCKET: "/tmp/socket.sock", BOTSTER_HUB_DATA_DIR: "/tmp/data-dir" },
  { cwd: "/workspace" }
);
assert.equal(socketWinsBridgeMode.ok, true);
assert.equal(socketWinsBridgeMode.source, "socket");
assert.equal(socketWinsBridgeMode.socketPath, "/tmp/socket.sock");

const mixedOwnershipBridgeMode = resolveDogfoodBridgeMode({
  BOTSTER_HUB_SOCKET: "/tmp/socket.sock",
  BOTSTER_WEB_DOGFOOD_DATA_DIR: "/tmp/spawned-data-dir"
});
assert.equal(mixedOwnershipBridgeMode.ok, false);
assert.match(mixedOwnershipBridgeMode.error, /cannot be combined/);

const packageBridgeRuntime = await startPackageBridgeRuntime({ launchResult: true });
try {
  const rootResponse = await fetch(`${packageBridgeRuntime.origin}/`);
  const rootHtml = await rootResponse.text();
  assert.equal(rootResponse.status, 200, rootHtml);
  assert.match(rootResponse.headers.get("content-type"), /text\/html/);
  assert.match(rootHtml, /<div id="root"><\/div>/);
  assert.match(rootHtml, /window\.__BOTSTER_PACKAGE_RUNTIME__ = true/);

  const realHubResponse = await fetch(`${packageBridgeRuntime.origin}/?dogfood=real-hub`);
  assert.equal(realHubResponse.status, 200);
  assert.match(await realHubResponse.text(), /window\.__BOTSTER_PACKAGE_RUNTIME__ = true/);

  const faviconResponse = await fetch(`${packageBridgeRuntime.origin}/favicon.ico`);
  assert.equal(faviconResponse.status, 204);

  const fallbackResponse = await fetch(`${packageBridgeRuntime.origin}/sessions/local-dogfood`);
  assert.equal(fallbackResponse.status, 200);
  assert.match(await fallbackResponse.text(), /botster package runtime/);

  const assetResponse = await fetch(`${packageBridgeRuntime.origin}/assets/app.js`);
  const assetBody = await assetResponse.text();
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type"), /text\/javascript/);
  assert.match(assetBody, /console\.log\("package asset"\)/);
  assert.doesNotMatch(assetBody, /__BOTSTER_PACKAGE_RUNTIME__/);

  const traversalResponse = await fetch(`${packageBridgeRuntime.origin}/%2e%2e/package.json`);
  assert.equal(traversalResponse.status, 404);

  const healthResponse = await fetch(`${packageBridgeRuntime.origin}/health`);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    mode: "existing_hub",
    source: "socket",
    socket: "configured",
    local_url: packageBridgeRuntime.origin
  });
  assert.deepEqual(await readLaunchResult(packageBridgeRuntime.launchResultPath), {
    entrypoint_id: "web-client",
    process_state: "running",
    local_url: packageBridgeRuntime.origin
  });

  const requestResponse = await fetch(`${packageBridgeRuntime.origin}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "daemon_request",
      request_id: "package-runtime-status",
      payload: { type: "status" }
    })
  });
  assert.deepEqual(await requestResponse.json(), {
    kind: "daemon_response",
    request_id: "package-runtime-status",
    payload: {
      kind: "status",
      status: { lifecycle_state: "running", schema_version: 1 },
      events: []
    }
  });
  assert.deepEqual(packageBridgeRuntime.daemonRequests, [{ type: "status" }]);
} finally {
  await packageBridgeRuntime.stop();
}

const desktopCss = removeCssAtRules(css);
assert.doesNotMatch(desktopCss, /\.workspace-grid\s*\{[^}]*grid-template-columns/);
assert.doesNotMatch(desktopCss, /\.dashboard-layout\s*\{[^}]*grid-template-columns/);
assert.doesNotMatch(desktopCss, /\.app-grid\s*\{[^}]*grid-template-columns/);

const terminalPanelRule = extractTopLevelCssRule(desktopCss, ".terminal-panel");
assert.match(terminalPanelRule, /max-height:\s*calc\(100vh\s*-\s*210px\)/);
assert.match(terminalPanelRule, /overflow:\s*hidden/);

const dogfoodMainRule = extractTopLevelCssRule(desktopCss, ".dogfood-main");
assert.match(dogfoodMainRule, /display:\s*grid/);

const diagnosticPanelRule = extractTopLevelCssRule(desktopCss, ".diagnostic-panel");
assert.match(diagnosticPanelRule, /padding:\s*14px/);

const dogfoodStatusGridRule = extractTopLevelCssRule(desktopCss, ".dogfood-status-grid");
assert.match(dogfoodStatusGridRule, /display:\s*grid/);
assert.match(dogfoodStatusGridRule, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);

const dogfoodPrimaryActionRule = extractTopLevelCssRule(desktopCss, ".dogfood-primary-action");
assert.match(dogfoodPrimaryActionRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);

const mobileCss = extractCssAtRule(css, "@media (max-width: 860px)");
assert.doesNotMatch(mobileCss, /\.workspace-grid\s*\{[^}]*grid-template-columns/);
assert.match(extractTopLevelCssRule(mobileCss, ".dogfood-status-grid"), /grid-template-columns:\s*1fr\s*;/);
assert.match(extractTopLevelCssRule(mobileCss, ".dogfood-primary-action"), /grid-template-columns:\s*1fr\s*;/);
assert.match(extractTopLevelCssRule(mobileCss, ".terminal-panel"), /max-height:\s*none/);

const testCompileDir = await mkdtemp(join(tmpdir(), "botster-terminal-smoke-"));
const terminalJs = ts.transpileModule(terminal, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const terminalSmokeFixtureJs = ts
  .transpileModule(terminalSmokeFixture, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  })
  .outputText.replace('from "./terminal";', 'from "./terminal.mjs";');

await Promise.all([
  writeFile(join(testCompileDir, "terminal.mjs"), terminalJs),
  writeFile(join(testCompileDir, "terminalSmokeFixture.mjs"), terminalSmokeFixtureJs)
]);

const { runTerminalViewBridgeSmokeFixture } = await import(
  pathToFileURL(join(testCompileDir, "terminalSmokeFixture.mjs"))
);
const smoke = await runTerminalViewBridgeSmokeFixture();

assert.deepEqual(smoke.dataPlane.inputs, ["ls\n"]);
assert.deepEqual(smoke.firstRenderer.writes, ["ready\r\n", "ok\r\n"]);
assert.deepEqual(smoke.firstRenderer.resizes, [{ rows: 24, columns: 80 }]);
assert.equal(smoke.dataPlane.outputSubscriptionCount, 1);
assert.equal(smoke.dataPlane.outputUnsubscribeCount, 1);
assert.equal(smoke.dataPlane.detachCount, 1);
assert.ok(smoke.secondRenderer);
assert.ok(smoke.lifecycle.indexOf("destroy") < smoke.lifecycle.lastIndexOf("create"));
assert.equal(smoke.lifecycle.filter((event) => event === "focus").length, 2);
assert.equal(smoke.lifecycle.filter((event) => event === "input:unsubscribe").length, 1);
assert.doesNotMatch(smoke.firstRenderer.writes.join(""), /stale/);
assert.doesNotMatch(smoke.dataPlane.inputs.join(""), /stale/);
assert.doesNotMatch(smoke.dataPlane.inputs.join(""), /premount/);

const compiledRoot = join(tmpdir(), "botster-web-runtime-test");
await rm(compiledRoot, { recursive: true, force: true });
await mkdir(join(compiledRoot, "botster"), { recursive: true });
await mkdir(join(compiledRoot, "botster/__fixtures__"), { recursive: true });

await Promise.all([
  compileTsModule("botster/__fixtures__/generatedDaemonProtocol.ts", join(compiledRoot, "botster/__fixtures__/generatedDaemonProtocol.js")),
  compileTsModule("botster/actions.ts", join(compiledRoot, "botster/actions.js")),
  compileTsModule("botster/capabilities.ts", join(compiledRoot, "botster/capabilities.js")),
  compileTsModule("botster/client.ts", join(compiledRoot, "botster/client.js")),
  compileTsModule("botster/connectionDiagnostics.ts", join(compiledRoot, "botster/connectionDiagnostics.js")),
  compileTsModule("botster/dogfoodMode.ts", join(compiledRoot, "botster/dogfoodMode.js")),
  compileTsModule("botster/entities.ts", join(compiledRoot, "botster/entities.js")),
  compileTsModule("botster/localDogfoodTransport.ts", join(compiledRoot, "botster/localDogfoodTransport.js")),
  compileTsModule("botster/protocol.ts", join(compiledRoot, "botster/protocol.js")),
  compileTsModule("botster/realHubDaemonDto.ts", join(compiledRoot, "botster/realHubDaemonDto.js")),
  compileTsModule("botster/realHubDogfoodTransport.ts", join(compiledRoot, "botster/realHubDogfoodTransport.js")),
  compileTsModule("botster/realHubTerminalDataPlane.ts", join(compiledRoot, "botster/realHubTerminalDataPlane.js")),
  compileTsModule("botster/webrtcDaemonClient.ts", join(compiledRoot, "botster/webrtcDaemonClient.js")),
  compileTsModule("botster/terminal.ts", join(compiledRoot, "botster/terminal.js"))
]);

const requireRuntime = createRequire(join(compiledRoot, "runtime-test.cjs"));
const { createBotsterWebClient } = requireRuntime("./botster/client.js");
const { createLocalDogfoodTransport } = requireRuntime("./botster/localDogfoodTransport.js");
const { createDogfoodRuntimeConfig, terminalDataPlaneLabel } = requireRuntime("./botster/dogfoodMode.js");
const {
  createHttpDaemonBridgeClient,
  createRealHubDogfoodTransport,
  daemonResponseFrames,
  defaultSpawnCommand,
  realHubDogfoodSessionId
} = requireRuntime("./botster/realHubDogfoodTransport.js");
const { createRealHubTerminalDataPlane } = requireRuntime("./botster/realHubTerminalDataPlane.js");
const {
  createLocalWebrtcBootstrapRefresher,
  createWebrtcDaemonClient,
  WebrtcDaemonClientError,
  webRtcDaemonLifecycleEventName
} = requireRuntime("./botster/webrtcDaemonClient.js");
const { DefaultTerminalViewBridge } = requireRuntime("./botster/terminal.js");
const {
  generatedDaemonRequestFixtures,
  generatedAppResponseFixture,
  generatedPackageNavigationResponseFixture,
  generatedPackageResponseFixture
} = requireRuntime("./botster/__fixtures__/generatedDaemonProtocol.js");
const {
  actionFailureDiagnostic,
  bridgeUnavailableDiagnostic,
  compatibilityDiagnosticsFromFrame,
  connectionFailureDiagnostic,
  hubConnectionDiagnosticFromFrame,
  hubStatusFamily,
  initialConnectionDiagnostics,
  operatorErrorDiagnostic,
  schemaVersionDiagnosticFromFrame,
  streamDisconnectedDiagnostic,
  terminalUnavailableDiagnostic,
  upsertDiagnostic,
  webRtcLifecycleDiagnostic,
  webRtcFailureDiagnostic
} = requireRuntime("./botster/connectionDiagnostics.js");

assert.deepEqual(generatedDaemonRequestFixtures.map((request) => request.type), [
  "list_apps",
  "list_package_navigation",
  "list_packages",
  "list_available_packages",
  "inspect_available_package",
  "preview_package_install",
  "install_package_registry_entry",
  "set_package_configuration",
  "set_package_configuration",
  "install_package_local_path",
  "start_package_entrypoint",
  "stop_package_entrypoint",
  "restart_package_entrypoint",
  "package_entrypoint_status",
  "enable_package",
  "disable_package",
  "remove_package",
  "plugin_surface_render",
  "plugin_surface_action"
]);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "set_package_configuration" && request.package_name === "project-pipelines"),
  {
    type: "set_package_configuration",
    package_name: "project-pipelines",
    values: {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      api_token: { type: "secret", state: "write_only" }
    }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "set_package_configuration" && request.package_name === "botster-web"),
  {
    type: "set_package_configuration",
    package_name: "botster-web",
    values: {
      remote_browser_rendezvous_enabled: { type: "boolean", value: true }
    }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "plugin_surface_render"),
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: { route: "/pipelines" }
  }
);
assert.deepEqual(
  generatedDaemonRequestFixtures.find((request) => request.type === "plugin_surface_action"),
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    surface_id: "home",
    action_id: "ticket.open",
    payload: { ticket_id: "ticket_1" }
  }
);
assert.equal(
  daemonResponseFrames(generatedPackageResponseFixture, 12)
    .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package")
    .payload.records[0].id,
  "project-pipelines"
);
const packageNavigationSnapshot = daemonResponseFrames(generatedPackageNavigationResponseFixture, 12)
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package_navigation");
assert.equal(packageNavigationSnapshot.payload.records.length, 2);
assert.equal(packageNavigationSnapshot.payload.records[0].id, "project-pipelines:home");
assert.equal(packageNavigationSnapshot.payload.records[0].route_path, "/packages/project-pipelines/surfaces/home");
assert.equal(packageNavigationSnapshot.payload.records[0].launch_action.id, "botster.package.surface.render");
assert.equal(packageNavigationSnapshot.payload.records[1].blocked, true);
assert.equal(packageNavigationSnapshot.payload.records[1].launch_action, undefined);
const optionalDaemonAppFrames = daemonResponseFrames(
  {
    kind: "apps",
    apps: [
      {
        package_name: "optional-web",
        app_id: "browser",
        entrypoint_id: "web",
        kind: "web_app",
        launch_mode: "browser",
        lifecycle_state: "running",
        launch_target: { kind: "web_app" }
      }
    ],
    events: []
  },
  13
);
const optionalDaemonPackageFrames = daemonResponseFrames(
  {
    kind: "packages",
    packages: [
      {
        package_name: "optional-package",
        version: "0.1.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [],
        runnable_entrypoints: [],
        configuration: {},
        availability: { state: "available" },
        provider_profile_admitted: false
      }
    ],
    events: []
  },
  14
);
const optionalDaemonAppRecord = optionalDaemonAppFrames
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app")
  .payload.records[0];
const optionalDaemonPackageRecord = optionalDaemonPackageFrames
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package")
  .payload.records[0];
assert.equal(optionalDaemonAppRecord.local_url, "");
assert.equal(optionalDaemonAppRecord.diagnostics_summary, "Web app has no hub-provided local URL.");
assert.equal(optionalDaemonAppRecord.app_action_summary, "No app actions returned");
assert.equal(optionalDaemonPackageRecord.app_surface_summary, "No app surfaces");
assert.equal(optionalDaemonPackageRecord.settings_surface_summary, "No settings surfaces");
assert.equal(optionalDaemonPackageRecord.package_action_summary, "No package actions returned");
assert.deepEqual(optionalDaemonPackageRecord.configuration_fields, []);
const appSnapshot = daemonResponseFrames(generatedAppResponseFixture, 12)
  .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app");
assert.equal(appSnapshot.payload.records[0].id, "botster-web:dogfood");
assert.equal(appSnapshot.payload.records[0].local_url, "http://127.0.0.1:41739");
assert.equal(appSnapshot.payload.records[0].open_action.disabled, false);
assert.equal(appSnapshot.payload.records[1].kind, "terminal_app");
assert.equal(appSnapshot.payload.records[1].open_action.disabled, true);
assert.match(appSnapshot.payload.records[1].diagnostics_summary, /local terminal launch/);
assert.equal(
  daemonResponseFrames({ ...generatedPackageResponseFixture, kind: "available_packages" }, 12)
    .find((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.available_package")
    .payload.records[0].id,
  "github-provider"
);

const transport = {
  sent: [],
  ingress: undefined,
  async connect(_capabilities, ingress) {
    this.ingress = ingress;
  },
  async disconnect() {
    this.ingress = undefined;
  },
  async send(frame) {
    this.sent.push(frame);
  },
  inject(frame) {
    this.ingress?.(frame);
  }
};
const runtime = createBotsterWebClient({
  transport,
  actionIdGenerator: deterministicIds("ui-action"),
  actionTimeoutMs: 10
});

await runtime.hub.connect({ client: "botster-web", capabilities: [] });
await runtime.hub.subscribe();
assert.equal(runtime.entities.list("session").length, 0);
assert.equal(transport.sent.filter((frame) => frame.kind === "entity_pull").length, 0);
assert.equal(runtime.uiTree.current(), undefined);

transport.inject({
  kind: "ui_tree_snapshot",
  payload: {
    kind: "ui_tree_snapshot",
    surface: "runtime-test",
    version: "test-v1",
    root: { id: "runtime-root", primitive: "text", props: { text: "Runtime snapshot" } }
  }
});
assert.equal(runtime.uiTree.current().surface, "runtime-test");

transport.inject({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: "session",
    sequence: 5,
    records: [
      { id: "session-1", title: "One" },
      { id: "session-2", title: "Two" }
    ]
  }
});
assert.deepEqual(runtime.entities.list("session").map((record) => record.id), [
  "session-1",
  "session-2"
]);

transport.inject({
  kind: "entity_upsert",
  payload: {
    operation: "entity_upsert",
    key: { family: "session", id: "session-3" },
    sequence: 6,
    record: { id: "ignored", title: "Three", active: false }
  }
});
assert.equal(runtime.entities.get("session", "session-3").title, "Three");

transport.inject({
  kind: "entity_patch",
  payload: {
    operation: "entity_patch",
    key: { family: "session", id: "session-3" },
    sequence: 7,
    record: { active: true }
  }
});
assert.deepEqual(runtime.entities.get("session", "session-3"), {
  id: "session-3",
  title: "Three",
  active: true
});

transport.inject({
  kind: "entity_remove",
  payload: {
    operation: "entity_remove",
    key: { family: "session", id: "session-2" },
    sequence: 8
  }
});
assert.equal(runtime.entities.get("session", "session-2"), undefined);

transport.inject({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: "session",
    sequence: 1,
    records: [{ id: "session-reset", title: "Reconnect baseline" }]
  }
});
assert.deepEqual(runtime.entities.list("session").map((record) => record.id), ["session-reset"]);

transport.inject({
  kind: "entity_patch",
  payload: {
    operation: "entity_patch",
    key: { family: "session", id: "session-reset" },
    sequence: 0,
    record: { title: "stale" }
  }
});
assert.equal(runtime.entities.get("session", "session-reset").title, "Reconnect baseline");

const actionResult = runtime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.session.select", target: "session-reset" }
});
const actionFrame = transport.sent.find((frame) => frame.kind === "action_request");
assert.equal(actionFrame.payload.request_id, "ui-action-1");
assert.equal(actionFrame.payload.action.id, "botster.session.select");
assert.equal(runtime.actions.pendingCount(), 1);

transport.inject({
  kind: "action_result",
  payload: {
    request_id: "unknown-request",
    accepted: true
  }
});
assert.equal(runtime.actions.pendingCount(), 1);

transport.inject({
  kind: "action_result",
  payload: {
    request_id: "ui-action-1",
    accepted: true,
    result: { selected: "session-reset" }
  }
});
assert.deepEqual(await actionResult, {
  accepted: true,
  request_id: "ui-action-1",
  result: { selected: "session-reset" },
  reason: undefined
});
assert.equal(runtime.actions.pendingCount(), 0);

await runtime.entities.pull({ family: "session" });
await runtime.hub.subscribeSurface({ surface: "workspace", path: "/sessions" });
transport.sent.length = 0;
await runtime.entities.replayActivePulls();
await runtime.hub.replaySurfaceSubscriptions();
assert.deepEqual(transport.sent.map((frame) => frame.kind), ["entity_pull", "surface_subscribe"]);

const configurablePackageConfiguration = {
  schema: {
    fields: [
      { key: "endpoint", type: "url", label: "Webhook endpoint", required: true },
      {
        key: "mode",
        type: "select",
        label: "Mode",
        default: { type: "select", value: "read" },
        options: [
          { value: "read", label: "Read" },
          { value: "write", label: "Write" }
        ]
      },
      { key: "enabled", type: "boolean", label: "Enabled", default: { type: "boolean", value: true } },
      { key: "api_token", type: "secret", label: "API token", required: true, default: { type: "secret", state: "unset" } }
    ]
  },
  effective_values: {
    mode: { type: "select", value: "read" },
    enabled: { type: "boolean", value: true },
    api_token: { type: "secret", state: "redacted" }
  },
  missing_required: ["endpoint"],
  diagnostics: []
};
const configuredPackageConfiguration = {
  ...configurablePackageConfiguration,
  effective_values: {
    endpoint: { type: "url", value: "https://example.invalid/hook" },
    mode: { type: "select", value: "read" },
    enabled: { type: "boolean", value: true },
    api_token: { type: "secret", state: "redacted" }
  },
  missing_required: []
};
const botsterWebRemoteAccessConfiguration = {
  schema: packageManifest.configuration,
  effective_values: {
    remote_browser_rendezvous_enabled: { type: "boolean", value: false }
  },
  missing_required: [],
  diagnostics: []
};
const emptyPackageConfiguration = {};
const availablePackageAvailability = { state: "available", reasons: [] };
const blockedGithubAvailability = {
  state: "blocked",
  reasons: [
    {
      reason: "auth_required",
      action: "enable_package",
      requirement: "github"
    }
  ]
};

function daemonAction(action_id, status, request, reason = undefined, diagnostics = []) {
  return {
    action_id,
    status,
    reason,
    diagnostics,
    required_references: [],
    request
  };
}

function packageRequest(request_type, package_name) {
  return { request_type, package_name };
}

function entrypointRequest(request_type, package_name, entrypoint_id) {
  return { request_type, package_name, entrypoint_id };
}

function installedPackageActions(package_name, enabled = true, configurable = false) {
  return [
    daemonAction("enable_package", enabled ? "unavailable" : "available", enabled ? null : packageRequest("enable_package", package_name), enabled ? "already_enabled" : undefined),
    daemonAction("disable_package", enabled ? "available" : "unavailable", enabled ? packageRequest("disable_package", package_name) : null, enabled ? undefined : "not_enabled"),
    daemonAction("remove_package", "available", packageRequest("remove_package", package_name)),
    daemonAction("set_package_configuration", configurable ? "available" : "unavailable", configurable ? packageRequest("set_package_configuration", package_name) : null, configurable ? undefined : "no_configuration_schema"),
    daemonAction("check_package_update", "available", packageRequest("check_package_update", package_name)),
    daemonAction("reload_package", "unavailable", null, "unsupported"),
    daemonAction("restart_hub", "unavailable", null, "unsupported")
  ];
}

function entrypointActions(package_name, entrypoint_id) {
  return [
    daemonAction("start_package_entrypoint", "available", entrypointRequest("start_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("stop_package_entrypoint", "available", entrypointRequest("stop_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("restart_package_entrypoint", "available", entrypointRequest("restart_package_entrypoint", package_name, entrypoint_id)),
    daemonAction("package_entrypoint_status", "available", entrypointRequest("package_entrypoint_status", package_name, entrypoint_id))
  ];
}

const bridgeRequests = [];
const bridgeTerminalStreams = [];
const bridge = {
  async request(request) {
    bridgeRequests.push(request);
    if (request.type === "status") {
      return {
        kind: "status",
        status: {
          lifecycle_state: "running",
          compatibility: {
            protocol: "botster-hub-daemon-v1",
            protocol_version: 1,
            features: [
              "sessions",
              "terminal_streaming",
              "resize",
              "plugin_surface_render",
              "plugin_surface_action"
            ],
            conformance_fixture_revision: 1
          },
          host_id: "dogfood-host",
          host_display_name: "Dogfood Hub",
          schema_version: 1,
          data_dir_configured: true,
          core_initialized: true,
          state_source: "explicit",
          package_count: 3,
          enabled_package_count: 1,
          provider_count: 0,
          enabled_provider_count: 0,
          session_count: 1,
          recovered_sessions: [],
          stale_sessions: [],
          diagnostics: [
            {
              kind: "connected",
              message: "Hub control channel is connected"
            }
          ]
        },
        sessions: [],
        events: [],
        diagnostics: [
          {
            kind: "unsupported_feature",
            feature: "terminal_streaming"
          }
        ]
      };
    }

    if (request.type === "list_apps") {
      return generatedAppResponseFixture;
    }

    if (request.type === "list_packages") {
      return {
        kind: "packages",
        packages: [
          {
            package_name: "botster-web",
            version: "0.1.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [],
            surfaces: packageManifest.surfaces,
            runnable_entrypoints: [
              {
                id: "web-client",
                kind: "web",
                command: "node",
                args: ["scripts/real-hub-dogfood-bridge.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [{ surface: "network", scope: "localhost" }],
                may_supervise: true,
                process: {
                  state: "running",
                  pid: 41739,
                  started_at: 1781112600,
                  diagnostics: []
                },
                actions: entrypointActions("botster-web", "web-client")
              }
            ],
            configuration: botsterWebRemoteAccessConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions("botster-web", true, true),
            provider_profile_admitted: false
          },
          {
            package_name: "project-pipelines",
            version: "0.8.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [
              { surface: "SessionActions", scope: "project-pipelines" },
              { surface: "McpTools", scope: null }
            ],
            surfaces: [
              {
                id: "home",
                kind: "app",
                title: "Pipelines",
                description: "Project Pipelines workbench",
                order: 1,
                category: "workflow",
                supports: ["render"]
              },
              {
                id: "settings",
                kind: "settings",
                title: "Pipeline Settings",
                description: "Project Pipelines settings",
                order: 2,
                supports: ["render"]
              }
            ],
            view_surface: { id: "legacy-view", title: "Legacy View" },
            settings_surface: { id: "legacy-settings", title: "Legacy Settings" },
            runnable_entrypoints: [
              {
                id: "web-client",
                kind: "web",
                command: "node",
                args: ["scripts/real-hub-dogfood-bridge.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [{ surface: "network", scope: "localhost" }],
                may_supervise: true,
                process: {
                  state: "running",
                  pid: 4273,
                  started_at: 1781112500,
                  diagnostics: []
                },
                actions: entrypointActions("project-pipelines", "web-client")
              },
              {
                id: "worker",
                kind: "daemon",
                command: "node",
                args: ["scripts/worker.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "dev",
                capabilities: [],
                may_supervise: true,
                process: {
                  state: "failed",
                  started_at: 1781112400,
                  exited_at: 1781112460,
                  exit_status: "exit:42",
                  diagnostics: [{ kind: "stderr", message: "fixture failure" }]
                },
                actions: entrypointActions("project-pipelines", "worker")
              }
            ],
            configuration: configurablePackageConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [
              { id: "botster", package_name: "botster", state: "available", reasons: [] }
            ],
            feature_availability: [
              { id: "pipeline-runs", state: "available", reasons: [] }
            ],
            actions: installedPackageActions("project-pipelines", true, true),
            provider_profile_admitted: false
          },
          {
            package_name: "github-provider",
            version: "1.2.3",
            classification: "provider",
            state: "disabled",
            requested_capabilities: [{ surface: "ClientAdmission", scope: "github" }],
            surfaces: [
              {
                id: "settings",
                kind: "settings",
                title: "GitHub Settings",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [
              {
                id: "poller",
                kind: "provider",
                command: "node",
                args: ["scripts/poller.mjs"],
                working_directory: { policy: "package_root", path: null },
                environment: [],
                mode: "local",
                capabilities: [],
                may_supervise: true,
                process: {
                  state: "stopped",
                  started_at: 1781112100,
                  exited_at: 1781112200,
                  exit_status: "signal:term",
                  diagnostics: []
                },
                actions: entrypointActions("github-provider", "poller")
              }
            ],
            configuration: emptyPackageConfiguration,
            availability: blockedGithubAvailability,
            dependency_availability: [
              {
                id: "project-pipelines",
                package_name: "project-pipelines",
                state: "blocked",
                reasons: [{ reason: "dependency_disabled", action: "enable_package", package_name: "project-pipelines" }]
              }
            ],
            feature_availability: [
              {
                id: "github-prs",
                state: "blocked",
                reasons: [{ reason: "auth_required", action: "enable_package", requirement: "github" }]
              }
            ],
            actions: [
              daemonAction(
                "enable_package",
                "blocked",
                null,
                "auth_required",
                [{ kind: "auth_required", message: "GitHub auth is required" }]
              ),
              ...installedPackageActions("github-provider", false, false).filter((action) => action.action_id !== "enable_package")
            ],
            provider_profile_admitted: false
          },
          {
            package_name: "local-diagnostics",
            version: "0.1.0",
            classification: "plugin",
            state: "installed",
            requested_capabilities: [],
            surfaces: [
              {
                id: "misc",
                kind: "diagnostic",
                title: "Diagnostics",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [],
            configuration: emptyPackageConfiguration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions("local-diagnostics", false, false),
            provider_profile_admitted: false
          }
        ],
        events: [],
        diagnostics: [
          {
            kind: "connected",
            operation: "list_packages",
            message: "Package registry listed"
          }
        ]
      };
    }

    if (request.type === "set_package_configuration") {
      const endpoint = request.values.endpoint;
      const configuration =
        endpoint && typeof endpoint === "object" && "value" in endpoint && endpoint.value
          ? configuredPackageConfiguration
          : configurablePackageConfiguration;
      return {
        kind: "packages",
        packages: [
          {
            package_name: request.package_name,
            version: "0.8.0",
            classification: "plugin",
            state: "enabled",
            requested_capabilities: [{ surface: "SessionActions", scope: "project-pipelines" }],
            surfaces: [
              {
                id: "home",
                kind: "app",
                title: "Pipelines",
                order: 1,
                supports: ["render"]
              }
            ],
            runnable_entrypoints: [],
            configuration,
            availability: availablePackageAvailability,
            dependency_availability: [],
            feature_availability: [],
            actions: installedPackageActions(request.package_name, true, true),
            provider_profile_admitted: false
          }
        ],
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "list_sessions") {
      return {
        kind: "sessions",
        sessions: [{ session_id: realHubDogfoodSessionId, lifecycle: "running" }],
        events: []
      };
    }

    if (request.type === "plugin_surface_render") {
      if (request.package_name === "botster-web") {
        const settings = request.surface_id === "dogfood-settings";
        const bodyText = settings
          ? "Deterministic settings surface rendered by the botster-web dogfood package."
          : "Deterministic app surface rendered by the botster-web dogfood package.";
        return {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: request.surface_id,
            body: bodyText,
            ui_tree_snapshot: {
              package_name: "botster-web",
              surface_id: request.surface_id,
              body: {
                id: `botster-web-${request.surface_id}-root`,
                primitive: "section",
                props: { label: settings ? "Dogfood Settings" : "Dogfood App" },
                slots: {
                  children: [
                    {
                      id: `botster-web-${request.surface_id}-copy`,
                      primitive: "text",
                      props: { text: bodyText }
                    }
                  ]
                }
              }
            }
          },
          events: [],
          diagnostics: []
        };
      }

      return {
        kind: "plugin_surface",
        plugin_surface: {
          package_name: request.package_name,
          surface_id: request.surface_id,
          body: { rendered: true },
          ui_tree_snapshot: {
            package_name: request.package_name,
            surface_id: request.surface_id,
            body: {
              id: `${request.package_name}-${request.surface_id}-root`,
              primitive: "section",
              props: { label: "Rendered plugin surface" }
            }
          }
        },
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "plugin_surface_action") {
      return {
        kind: "plugin_action_result",
        plugin_action_result: {
          state: "success",
          message: `${request.action_id} accepted`
        },
        events: [],
        diagnostics: []
      };
    }

    if (
      request.type === "enable_package" ||
      request.type === "disable_package" ||
      request.type === "remove_package" ||
      request.type === "start_package_entrypoint" ||
      request.type === "stop_package_entrypoint" ||
      request.type === "restart_package_entrypoint" ||
      request.type === "package_entrypoint_status"
    ) {
      return {
        kind: "packages",
        packages: [],
        events: [],
        diagnostics: []
      };
    }

    if (request.type === "spawn") {
      return {
        kind: "spawned",
        sessions: [{ session_id: request.session_id, lifecycle: "running" }],
        events: [{ type: "session_lifecycle", session_id: request.session_id, state: "running" }]
      };
    }

    if (request.type === "shutdown_session") {
      return {
        kind: "operator_error",
        sessions: [],
        events: [],
        error: {
          code: "session_not_found",
          request_id: "operator-error-1",
          operation: "shutdown_session",
          message: "Session not found"
        }
      };
    }

    if (request.type === "attach" || request.type === "drain") {
      return {
        kind: "events",
        events: [
          {
            type: "terminal_output",
            session_id: request.session_id,
            subscription_id: "botster-web-dogfood-terminal",
            data: request.type === "attach" ? "botster-web-dogfood-ready\r\n" : "botster-web-dogfood-echo:ping\r\n"
          }
        ]
      };
    }

    return { kind: "events", events: [] };
  },
  streamTerminal(sessionId, subscriptionId, onEvent) {
    bridgeTerminalStreams.push({ sessionId, subscriptionId });
    onEvent({
      type: "attach_state",
      session_id: sessionId,
      subscription_id: subscriptionId,
      state: "attached"
    });
    onEvent({
      type: "snapshot",
      session_id: sessionId,
      subscription_id: subscriptionId,
      data: "snapshot-history\r\n",
      bytes: 18
    });
    onEvent({
      type: "scrollback",
      session_id: sessionId,
      subscription_id: subscriptionId,
      data: "scrollback-history\r\n",
      bytes: 20
    });
    onEvent({
      type: "terminal_output",
      session_id: sessionId,
      subscription_id: subscriptionId,
      data: "botster-web-dogfood-ready\r\n"
    });
    return {
      unsubscribe() {
        bridgeTerminalStreams.push({ sessionId, subscriptionId, unsubscribed: true });
      }
    };
  }
};

const fixtureMode = createDogfoodRuntimeConfig({
  env: {},
  locationHref: "http://127.0.0.1:5173/?dogfood=real-hub",
  bridge
});
assert.equal(fixtureMode.mode, "fixture");
assert.equal(fixtureMode.terminalDataPlaneKind, "mock");

const realMode = createDogfoodRuntimeConfig({
  env: { VITE_BOTSTER_REAL_HUB_DOGFOOD: "1" },
  locationHref: "http://127.0.0.1:5173/?dogfood=real-hub",
  bridge
});
assert.equal(realMode.mode, "real-hub");
assert.equal(realMode.terminalDataPlaneKind, "real-hub");
assert.equal(realMode.terminalDescriptor.sessionId, realHubDogfoodSessionId);
assert.notEqual(realMode.createTerminalDataPlane(realHubDogfoodSessionId), realMode.terminalDataPlane);
assert.match(defaultSpawnCommand(), /botster-web-dogfood-ready/);
assert.match(defaultSpawnCommand(), /botster-web-dogfood-size/);
assert.match(defaultSpawnCommand(), /stty size/);
assert.match(defaultSpawnCommand(), /botster-web-dogfood-exit/);
assert.notEqual(realMode.terminalDescriptor.sessionId, "terminal_view_smoke_session");
assert.notEqual(realMode.terminalDataPlane.constructor.name, "MockTerminalDataPlane");

const packageRuntimeMode = createDogfoodRuntimeConfig({
  env: {},
  locationHref: "http://127.0.0.1:41739/",
  bridge,
  bridgeUrl: "http://127.0.0.1:41739/request",
  packageRuntime: true
});
assert.equal(packageRuntimeMode.mode, "real-hub");
assert.equal(packageRuntimeMode.terminalDataPlaneKind, "real-hub");

const localWebrtcBootstrapFixture = {
  grant_id: "grant-test",
  grant_secret: "secret-0000000000000000000000000000000000000000000000000000000000000000",
  package_name: "botster-web",
  entrypoint_id: "web-client",
  expected_origin: "http://127.0.0.1:41739",
  expires_at: 0,
  signaling_transport: "daemon_request",
  data_plane: "webrtc_data_channel",
  ordered: true,
  signaling_url: "http://127.0.0.1:41739/request"
};
const packageWebrtcMode = createDogfoodRuntimeConfig({
  env: {},
  locationHref: "http://127.0.0.1:41739/",
  bridge,
  packageRuntime: true,
  localWebrtcBootstrap: localWebrtcBootstrapFixture
});
assert.equal(packageWebrtcMode.mode, "webrtc");
assert.equal(packageWebrtcMode.terminalDataPlaneKind, "webrtc");
assert.equal(packageWebrtcMode.statusText, "Connected to local hub over WebRTC");
const realModeDiagnostics = initialConnectionDiagnostics(realMode.mode, realMode.statusText, realMode.terminalDataPlaneKind);
assert.equal(
  realModeDiagnostics.find((diagnostic) => diagnostic.id === "terminal-data-plane").title,
  "Terminal data plane: bridge/SSE"
);
assert.equal(
  realModeDiagnostics.find((diagnostic) => diagnostic.id === "bridge-sse-data-transport").source,
  "data-plane"
);
assert.equal(
  realModeDiagnostics.some((diagnostic) => /bootstrap\/signaling only/.test(diagnostic.detail)),
  false
);
const webRtcModeDiagnostics = initialConnectionDiagnostics(packageWebrtcMode.mode, packageWebrtcMode.statusText, packageWebrtcMode.terminalDataPlaneKind);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "terminal-data-plane").title,
  "Terminal data plane: WebRTC DataChannel"
);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "webrtc-signaling-bridge").source,
  "signaling"
);
assert.match(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "packaged-ui-bridge").detail,
  /terminal bytes use the WebRTC data plane/
);
assert.equal(
  webRtcModeDiagnostics.find((diagnostic) => diagnostic.id === "package-asset-revision").title,
  "Package asset revision unknown"
);
const mismatchedModeDiagnostics = initialConnectionDiagnostics("real-hub", realMode.statusText, "webrtc");
assert.equal(
  mismatchedModeDiagnostics.some((diagnostic) => diagnostic.id === "webrtc-signaling-bridge"),
  true
);
assert.equal(
  mismatchedModeDiagnostics.some((diagnostic) => diagnostic.id === "bridge-sse-data-transport"),
  false
);
const originalWindow = globalThis.window;
const lifecycleEvents = [];
globalThis.window = {
  location: { origin: "http://127.0.0.1:41739" },
  setTimeout,
  clearTimeout,
  dispatchEvent(event) {
    lifecycleEvents.push({ name: event.type, detail: event.detail });
    return true;
  }
};
try {
  const bootstrapRefreshRequests = [];
  const refreshedBootstrapFixture = {
    ...localWebrtcBootstrapFixture,
    grant_id: "grant-refresh",
    grant_secret: localWebrtcBootstrapFixture.grant_secret.replace(/0/g, "1")
  };
  const refreshedBootstrap = await createLocalWebrtcBootstrapRefresher({
    bootstrap: localWebrtcBootstrapFixture,
    bridgeUrl: "http://127.0.0.1:41739/request",
    requestIdGenerator: () => "bootstrap-refresh-test",
    fetchImpl: async (url, init) => {
      const envelope = JSON.parse(init.body);
      bootstrapRefreshRequests.push({ url, envelope });
      return {
        ok: true,
        json: async () => ({
          kind: "daemon_response",
          request_id: envelope.request_id,
          payload: {
            kind: "local_webrtc_bootstrap",
            local_webrtc_bootstrap: refreshedBootstrapFixture
          }
        })
      };
    }
  })();
  assert.equal(bootstrapRefreshRequests[0].url, "http://127.0.0.1:41739/request");
  assert.deepEqual(bootstrapRefreshRequests[0].envelope, {
    kind: "daemon_request",
    request_id: "bootstrap-refresh-test",
    payload: {
      type: "issue_local_webrtc_bootstrap",
      package_name: "botster-web",
      entrypoint_id: "web-client",
      origin: "http://127.0.0.1:41739"
    }
  });
  assert.equal(refreshedBootstrap.grant_id, "grant-refresh");
  assert.equal(refreshedBootstrap.signaling_url, localWebrtcBootstrapFixture.signaling_url);

  const dataChannels = [createFakeDataChannel(), createFakeDataChannel()];
  let nextPeerConnectionIndex = 0;
  const dataChannel = dataChannels[0];
  const signalingRequests = [];
  const refreshedBootstraps = [
    refreshedBootstrapFixture,
    {
      ...localWebrtcBootstrapFixture,
      grant_id: "grant-refresh-2",
      grant_secret: localWebrtcBootstrapFixture.grant_secret.replace(/0/g, "2")
    }
  ];
  let refreshBootstrapCalls = 0;
  const webrtcClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    refreshBootstrap: async () => refreshedBootstraps[refreshBootstrapCalls++],
    peerConnectionFactory: () => createFakePeerConnection(dataChannels[nextPeerConnectionIndex++]),
    fetchImpl: async (_url, init) => {
      const envelope = JSON.parse(init.body);
      signalingRequests.push(envelope.payload);
      return {
        ok: true,
        json: async () => ({
          payload: {
            local_webrtc_answer: {
              grant_id: "grant-test",
              answer: { type: "answer", sdp: "answer-sdp" }
            }
          }
        })
      };
    }
  });
  const responsePromise = webrtcClient.request({ type: "status" });
  await waitForTestCondition(() => signalingRequests.length > 0);
  assert.equal(signalingRequests[0].type, "local_webrtc_signal");
  assert.equal(signalingRequests[0].grant_id, "grant-refresh");
  await waitForTestCondition(() => lifecycleEvents.some((event) => event.detail.type === "data-channel-open"));
  assert.equal(lifecycleEvents.find((event) => event.detail.type === "data-channel-open").name, webRtcDaemonLifecycleEventName);
  assert.equal(
    webRtcLifecycleDiagnostic(lifecycleEvents.find((event) => event.detail.type === "data-channel-open").detail).title,
    "WebRTC DataChannel open"
  );
  await waitForTestCondition(() => dataChannel.sent.length > 0);
  assert.equal(
    lifecycleEvents.some((event) => event.detail.type === "encrypted-stream-ready" && event.detail.requestType === "status"),
    true
  );
  assert.equal(
    webRtcLifecycleDiagnostic(lifecycleEvents.find((event) => event.detail.type === "encrypted-stream-ready").detail).title,
    "Encrypted client stream ready"
  );
  assert.equal(dataChannel.sent.length, 1);
  assert.doesNotMatch(dataChannel.sent[0], /"type":"status"/);
  const outboundEnvelope = JSON.parse(dataChannel.sent[0]);
  assert.deepEqual(Object.keys(outboundEnvelope).sort(), ["ciphertext", "nonce", "version"]);
  dataChannel.emitMessage(await encryptTestEnvelope(
    refreshedBootstraps[0].grant_secret,
    { kind: "status", status: null, sessions: [], packages: [], package_decision: null, lifecycle: [], plugin_tools: [], plugin_tool_result: null, events: [], cleanup: null, coordination: null, error: null }
  ));
  assert.equal((await responsePromise).kind, "status");
  const secondResponsePromise = webrtcClient.request({ type: "list_sessions" });
  await waitForTestCondition(() => dataChannel.sent.length > 1);
  dataChannel.emitMessage(await encryptTestEnvelope(
    refreshedBootstraps[0].grant_secret,
    { kind: "sessions", sessions: [], events: [], diagnostics: [] }
  ));
  assert.equal((await secondResponsePromise).kind, "sessions");
  assert.equal(
    lifecycleEvents.filter((event) => event.detail.type === "encrypted-stream-ready").length,
    1
  );
  dataChannel.close();
  await waitForTestCondition(() => lifecycleEvents.some((event) => event.detail.type === "data-channel-closed"));
  const reconnectResponsePromise = webrtcClient.request({ type: "list_apps" });
  await waitForTestCondition(() => signalingRequests.length === 2);
  assert.equal(signalingRequests[1].type, "local_webrtc_signal");
  assert.equal(signalingRequests[1].grant_id, "grant-refresh-2");
  await waitForTestCondition(() => dataChannels[1].sent.length > 0);
  assert.deepEqual(
    await decryptTestEnvelope(refreshedBootstraps[1].grant_secret, dataChannels[1].sent[0]),
    { type: "list_apps" }
  );
  dataChannels[1].emitMessage(await encryptTestEnvelope(
    refreshedBootstraps[1].grant_secret,
    { kind: "apps", apps: [], events: [], diagnostics: [] }
  ));
  assert.equal((await reconnectResponsePromise).kind, "apps");
  assert.equal(
    lifecycleEvents.filter((event) => event.detail.type === "encrypted-stream-ready").length,
    2
  );

  const invalidBootstrapClient = createWebrtcDaemonClient({
    bootstrap: {
      ...localWebrtcBootstrapFixture,
      grant_secret: "secret-invalid"
    },
    peerConnectionFactory: () => createFakePeerConnection(createFakeDataChannel()),
    fetchImpl: async () => {
      throw new Error("signaling should not be called for invalid bootstrap");
    }
  });
  await assert.rejects(
    invalidBootstrapClient.request({ type: "status" }),
    (error) => connectionFailureDiagnostic(false, error).id === "webrtc-bootstrap-failed"
  );

  const signalingFailureClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    peerConnectionFactory: () => createFakePeerConnection(createFakeDataChannel()),
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    })
  });
  await assert.rejects(
    signalingFailureClient.request({ type: "status" }),
    (error) => connectionFailureDiagnostic(false, error).id === "webrtc-signaling-failed"
  );
} finally {
  globalThis.window = originalWindow;
}
const mountedWebrtcInputs = [];
const mountedWebrtcDataPlane = {
  sessionId: realHubDogfoodSessionId,
  writeInput(data) {
    mountedWebrtcInputs.push(data);
  },
  subscribeOutput() {
    return { unsubscribe() {} };
  },
  detach() {}
};
let mountedInputListener;
const mountedWebrtcBridge = new DefaultTerminalViewBridge(() => ({
  mount() {},
  onInput(listener) {
    mountedInputListener = listener;
    return { unsubscribe() {} };
  },
  write() {},
  resize() {},
  focus() {},
  destroy() {}
}));
await mountedWebrtcBridge.mount(
  { dataset: {} },
  { sessionId: realHubDogfoodSessionId, renderer: "restty" }
);
await mountedWebrtcBridge.attach(
  { sessionId: realHubDogfoodSessionId, renderer: "restty" },
  mountedWebrtcDataPlane
);
mountedInputListener("webrtc-mounted-input\n");
assert.deepEqual(mountedWebrtcInputs, ["webrtc-mounted-input\n"]);

globalThis.window = {
  location: { origin: "http://127.0.0.1:41739" },
  setTimeout,
  clearTimeout
};
try {
  const mountedRealWebrtcDataChannel = createFakeDataChannel();
  const mountedRealWebrtcBridgeClient = createWebrtcDaemonClient({
    bootstrap: localWebrtcBootstrapFixture,
    peerConnectionFactory: () => createFakePeerConnection(mountedRealWebrtcDataChannel),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        payload: {
          local_webrtc_answer: {
            grant_id: "grant-test",
            answer: { type: "answer", sdp: "answer-sdp" }
          }
        }
      })
    })
  });
  let mountedRealWebrtcWritePromise;
  const mountedRealWebrtcDataPlane = {
    sessionId: realHubDogfoodSessionId,
    writeInput(data) {
      mountedRealWebrtcWritePromise = mountedRealWebrtcBridgeClient.request({
        type: "send_input",
        session_id: realHubDogfoodSessionId,
        data
      });
      return mountedRealWebrtcWritePromise;
    },
    subscribeOutput() {
      return { unsubscribe() {} };
    },
    detach() {}
  };
  let mountedRealWebrtcInputListener;
  const mountedRealWebrtcBridge = new DefaultTerminalViewBridge(() => ({
    mount() {},
    onInput(listener) {
      mountedRealWebrtcInputListener = listener;
      return { unsubscribe() {} };
    },
    write() {},
    resize() {},
    focus() {},
    destroy() {}
  }));
  await mountedRealWebrtcBridge.mount(
    { dataset: {} },
    { sessionId: realHubDogfoodSessionId, renderer: "restty" }
  );
  await mountedRealWebrtcBridge.attach(
    { sessionId: realHubDogfoodSessionId, renderer: "restty" },
    mountedRealWebrtcDataPlane
  );
  mountedRealWebrtcInputListener("webrtc-mounted-input\n");
  const mountedRealWebrtcInputRequest = await waitForEncryptedRequest(
    mountedRealWebrtcDataChannel,
    localWebrtcBootstrapFixture.grant_secret,
    (request) => request.type === "send_input" && request.data === "webrtc-mounted-input\n"
  );
  assert.deepEqual(mountedRealWebrtcInputRequest, {
    type: "send_input",
    session_id: realHubDogfoodSessionId,
    data: "webrtc-mounted-input\n"
  });
  mountedRealWebrtcDataChannel.emitMessage(await encryptTestEnvelope(
    localWebrtcBootstrapFixture.grant_secret,
    { kind: "events", events: [] }
  ));
  await mountedRealWebrtcWritePromise;
  await mountedRealWebrtcBridge.detach({ sessionId: realHubDogfoodSessionId, renderer: "restty" });
} finally {
  globalThis.window = originalWindow;
}

const bridgeResolutionFetchUrls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  bridgeResolutionFetchUrls.push(String(url));
  const envelope = JSON.parse(init.body);
  return {
    ok: true,
    json: async () => ({
      kind: "daemon_response",
      request_id: envelope.request_id,
      payload: {
        kind: "status",
        status: {
          lifecycle_state: "running",
          compatibility: {
            protocol: "botster-hub-daemon-v1",
            protocol_version: 1,
            features: [
              "sessions",
              "terminal_streaming",
              "resize",
              "plugin_surface_render",
              "plugin_surface_action"
            ],
            conformance_fixture_revision: 1
          },
          host_id: "dogfood-host",
          host_display_name: "Dogfood Hub",
          schema_version: 1,
          data_dir_configured: true,
          core_initialized: true,
          state_source: "explicit",
          package_count: 0,
          enabled_package_count: 0,
          provider_count: 0,
          enabled_provider_count: 0,
          session_count: 0,
          recovered_sessions: [],
          stale_sessions: [],
          diagnostics: []
        },
        sessions: [],
        events: [],
        diagnostics: []
      }
    })
  };
};
try {
  const viteDevRealMode = createDogfoodRuntimeConfig({
    env: { VITE_BOTSTER_REAL_HUB_DOGFOOD: "1" },
    locationHref: "http://127.0.0.1:5173/?dogfood=real-hub"
  });
  await viteDevRealMode.transport.connect({ client: "botster-web", capabilities: [] }, () => undefined);

  const packageOriginRealMode = createDogfoodRuntimeConfig({
    env: {},
    locationHref: "http://127.0.0.1:41888/",
    bridgeUrl: "http://127.0.0.1:41888/request",
    packageRuntime: true
  });
  await packageOriginRealMode.transport.connect({ client: "botster-web", capabilities: [] }, () => undefined);
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(bridgeResolutionFetchUrls, [
  "http://127.0.0.1:41739/request",
  "http://127.0.0.1:41888/request"
]);

const httpFetchCalls = [];
const httpBridge = createHttpDaemonBridgeClient({
  url: "http://127.0.0.1:41739/request",
  fetchImpl: async (_url, init) => {
    const envelope = JSON.parse(init.body);
    httpFetchCalls.push(envelope);
    return {
      ok: true,
      json: async () => ({
        kind: "daemon_response",
        request_id: envelope.request_id,
        payload: { kind: "status", events: [] }
      })
    };
  },
  requestIdGenerator: deterministicIds("daemon-request")
});
await httpBridge.request({ type: "status" });
assert.deepEqual(httpFetchCalls[0], {
  kind: "daemon_request",
  request_id: "daemon-request-1",
  payload: { type: "status" }
});

const realTransport = createRealHubDogfoodTransport({ bridge });
const realFrames = [];
await realTransport.connect({ client: "botster-web", capabilities: [] }, (frame) => realFrames.push(frame));
await flushMicrotasks();
await realTransport.send({ kind: "surface_subscribe", payload: { surface: "botster-web.dogfood.session" } });
await flushMicrotasks();
await realTransport.send({ kind: "entity_pull", payload: { family: "botster-web.app" } });
await flushMicrotasks();
await realTransport.send({ kind: "entity_pull", payload: { family: "botster-web.package" } });
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-action-1",
    origin: "ui_node",
    action: { id: "botster.session.select", target: realHubDogfoodSessionId }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-missing-required",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "project-pipelines",
      params: {
        values: {}
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-1",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "project-pipelines",
      params: {
        values: {
          endpoint: { type: "url", value: "https://example.invalid/hook" },
          mode: { type: "select", value: "write" },
          enabled: { type: "boolean", value: true }
        }
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-config-save-remote-access",
    origin: "ui_node",
    action: {
      id: "botster.package.configuration.save",
      target: "botster-web",
      params: {
        values: {
          remote_browser_rendezvous_enabled: { type: "boolean", value: true }
        }
      }
    }
  }
});
await flushMicrotasks();
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-plugin-surface-action-1",
    origin: "ui_node",
    action: {
      id: "ticket.open",
      label: "Open ticket",
      params: {
        package_name: "project-pipelines",
        surface_id: "home",
        action_id: "ticket.open",
        ticket_id: "ticket_123"
      }
    }
  }
});
await flushMicrotasks();
for (const action of [
  {
    id: "botster.package.surface.render",
    target: "project-pipelines",
    params: { package_name: "project-pipelines", surface_id: "home" }
  },
  {
    id: "botster.package.surface.render",
    target: "botster-web",
    params: { package_name: "botster-web", surface_id: "dogfood-app" }
  },
  {
    id: "botster.package.surface.render",
    target: "botster-web",
    params: { package_name: "botster-web", surface_id: "dogfood-settings" }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "enable_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "disable_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "remove_package", package_name: "project-pipelines" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "start_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "stop_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "restart_package_entrypoint", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  },
  {
    id: "botster.package.daemon_request",
    target: "project-pipelines",
    params: {
      daemon_request: { request_type: "package_entrypoint_status", package_name: "project-pipelines", entrypoint_id: "web-client" }
    }
  }
]) {
  await realTransport.send({
    kind: "action_request",
    payload: {
      request_id: `real-${action.id}`,
      origin: "ui_node",
      action
    }
  });
  await flushMicrotasks();
}
assert.equal(bridgeRequests.some((request) => request.type === "status"), true);
assert.equal(bridgeRequests.some((request) => request.type === "list_sessions"), true);
assert.equal(bridgeRequests.some((request) => request.type === "list_packages"), true);
assert.equal(bridgeRequests.some((request) => request.type === "spawn" && request.session_id === realHubDogfoodSessionId), true);
const configSaveRequests = bridgeRequests.filter((request) => request.type === "set_package_configuration");
assert.equal(configSaveRequests.length, 3);
assert.deepEqual(configSaveRequests[0], {
  type: "set_package_configuration",
  package_name: "project-pipelines",
  values: {}
});
const configSaveRequest = configSaveRequests[1];
assert.deepEqual(configSaveRequest, {
  type: "set_package_configuration",
  package_name: "project-pipelines",
  values: {
    endpoint: { type: "url", value: "https://example.invalid/hook" },
    mode: { type: "select", value: "write" },
    enabled: { type: "boolean", value: true }
  }
});
assert.doesNotMatch(JSON.stringify(configSaveRequest), /api_token|redacted|write_only|super-secret-token/);
assert.deepEqual(configSaveRequests[2], {
  type: "set_package_configuration",
  package_name: "botster-web",
  values: {
    remote_browser_rendezvous_enabled: { type: "boolean", value: true }
  }
});
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "plugin_surface_render"),
  {
    type: "plugin_surface_render",
    package_name: "project-pipelines",
    surface_id: "home",
    payload: {}
  }
);
assert.deepEqual(
  bridgeRequests.find((request) => request.type === "plugin_surface_action"),
  {
    type: "plugin_surface_action",
    package_name: "project-pipelines",
    surface_id: "home",
    action_id: "ticket.open",
    payload: {
      package_name: "project-pipelines",
      surface_id: "home",
      action_id: "ticket.open",
      ticket_id: "ticket_123"
    }
  }
);
assert.deepEqual(
  bridgeRequests.filter((request) => request.type === "plugin_surface_render" && request.package_name === "botster-web"),
  [
    {
      type: "plugin_surface_render",
      package_name: "botster-web",
      surface_id: "dogfood-app",
      payload: {}
    },
    {
      type: "plugin_surface_render",
      package_name: "botster-web",
      surface_id: "dogfood-settings",
      payload: {}
    }
  ]
);
assert.equal(bridgeRequests.some((request) => request.type === "enable_package" && request.package_name === "project-pipelines"), true);
assert.equal(bridgeRequests.some((request) => request.type === "disable_package" && request.package_name === "project-pipelines"), true);
assert.equal(bridgeRequests.some((request) => request.type === "remove_package" && request.package_name === "project-pipelines"), true);
assert.equal(
  bridgeRequests.some((request) => request.type === "start_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "stop_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "restart_package_entrypoint" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(
  bridgeRequests.some((request) => request.type === "package_entrypoint_status" && request.entrypoint_id === "web-client"),
  true
);
assert.equal(bridgeRequests.some((request) => request.type === "list_apps"), true);
assert.equal(bridgeRequests.some((request) => /legacy/.test(JSON.stringify(request))), false);
assert.equal(bridgeRequests.some((request) => /update_package|reload_package|restart_hub/.test(request.type)), false);
assert.equal(realFrames.some((frame) => frame.kind === "ui_tree_snapshot"), true);
assert.equal(realFrames.some((frame) => frame.kind === "entity_snapshot"), true);
assert.equal(
  realFrames.some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.package"),
  true
);
assert.equal(
  realFrames.some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.app"),
  true
);
assert.equal(realFrames.some((frame) => frame.kind === "entity_patch"), true);
assert.equal(realFrames.some((frame) => frame.kind === "action_result"), true);

const realRuntime = createBotsterWebClient({
  transport: realMode.transport,
  actionIdGenerator: deterministicIds("real-runtime-action"),
  actionTimeoutMs: 50
});
await realRuntime.hub.connect({ client: "botster-web", capabilities: [] });
await realRuntime.hub.subscribeSurface({ surface: "botster-web.dogfood.session", path: "/sessions/real-hub" });
await realRuntime.entities.pull({ family: "botster-web.hub_status" });
await realRuntime.entities.pull({ family: "botster-web.package" });
await realRuntime.entities.pull({ family: "botster-web.session" });
await flushMicrotasks();
assert.equal(realRuntime.uiTree.current().surface, "botster-web.dogfood.session");
assert.deepEqual(realRuntime.entities.list("botster-web.session").map((record) => record.id), [
  realHubDogfoodSessionId
]);
assert.equal(realRuntime.entities.get("botster-web.session", "session-local-1"), undefined);
assert.equal(realRuntime.entities.get("botster-web.hub_status", "local-hub").host_id, "dogfood-host");
assert.deepEqual(realRuntime.entities.list("botster-web.package").map((record) => record.id), [
  "botster-web",
  "project-pipelines",
  "github-provider",
  "local-diagnostics"
]);
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").status, "enabled");
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").app_surface_count, 1);
assert.equal(realRuntime.entities.get("botster-web.package", "botster-web").settings_surface_count, 1);
assert.deepEqual(realRuntime.entities.get("botster-web.package", "botster-web").app_surfaces[0].launch_action, {
  id: "botster.package.surface.render",
  target: "botster-web",
  label: "botster-web Dogfood",
  params: {
    package_name: "botster-web",
    surface_id: "dogfood-app",
    surface_kind: "app",
    supports: ["render"]
  }
});
assert.deepEqual(realRuntime.entities.get("botster-web.package", "botster-web").settings_surfaces[0].launch_action, {
  id: "botster.package.surface.render",
  target: "botster-web",
  label: "botster-web Settings",
  params: {
    package_name: "botster-web",
    surface_id: "dogfood-settings",
    surface_kind: "settings",
    supports: ["render"]
  }
});
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").status, "enabled");
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").capability_summary, /SessionActions:project-pipelines/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").capability_summary, /McpTools/);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_count, 2);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_summary, /web-client \(web\)/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_summary, /worker \(daemon\)/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /web-client running/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /pid 4273/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /worker failed/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_process_summary, /exit_status exit:42/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_diagnostics_summary, /worker stderr: fixture failure/);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").app_surface_count, 1);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").settings_surface_count, 1);
assert.deepEqual(realRuntime.entities.get("botster-web.package", "project-pipelines").app_surfaces[0].launch_action, {
  id: "botster.package.surface.render",
  target: "project-pipelines",
  label: "Pipelines",
  params: {
    package_name: "project-pipelines",
    surface_id: "home",
    surface_kind: "app",
    supports: ["render"]
  }
});
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").view_surface, undefined);
assert.equal(realRuntime.entities.get("botster-web.package", "project-pipelines").settings_surface, undefined);
const projectPipelineActions = realRuntime.entities.get("botster-web.package", "project-pipelines").package_actions;
assert.equal(projectPipelineActions.find((action) => action.action_id === "enable_package").action.disabled, true);
assert.equal(projectPipelineActions.find((action) => action.action_id === "disable_package").action.id, "botster.package.daemon_request");
assert.equal(projectPipelineActions.find((action) => action.action_id === "remove_package").action.id, "botster.package.daemon_request");
assert.equal(projectPipelineActions.find((action) => action.action_id === "check_package_update").action.disabled, false);
assert.equal(projectPipelineActions.find((action) => action.action_id === "reload_package").action.disabled, true);
assert.equal(projectPipelineActions.find((action) => action.action_id === "restart_hub").action.disabled, true);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").availability_summary, /No blocked reasons/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").dependency_availability_summary, /botster available/);
assert.match(realRuntime.entities.get("botster-web.package", "project-pipelines").feature_availability_summary, /pipeline-runs available/);
assert.deepEqual(
  realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_actions.map((entrypointAction) => entrypointAction.action_id).slice(0, 4),
  [
    "start_package_entrypoint",
    "stop_package_entrypoint",
    "restart_package_entrypoint",
    "package_entrypoint_status"
  ]
);
assert.equal(
  realRuntime.entities.get("botster-web.package", "project-pipelines").entrypoint_actions.every((entrypointAction) => entrypointAction.action.id === "botster.package.daemon_request"),
  true
);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").status, "disabled");
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").availability_summary, /enable_package: auth_required/);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").app_surface_count, 0);
assert.equal(realRuntime.entities.get("botster-web.package", "github-provider").settings_surface_count, 1);
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").entrypoint_process_summary, /poller stopped/);
assert.match(realRuntime.entities.get("botster-web.package", "github-provider").entrypoint_process_summary, /exited_at 1781112200/);
assert.equal(realRuntime.entities.get("botster-web.package", "local-diagnostics").capability_summary, "No requested capabilities");
assert.equal(realRuntime.entities.get("botster-web.package", "local-diagnostics").entrypoint_summary, "No runnable entrypoints");
assert.deepEqual(realRuntime.entities.get("botster-web.hub_status", "local-hub").compatibility.features, [
  "sessions",
  "terminal_streaming",
  "resize",
  "plugin_surface_render",
  "plugin_surface_action"
]);
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).target, "isolated-local-hub");
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).attachable, true);
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).attach_action.id, "botster.session.attach");
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).attach_action.disabled, false);
const appSurfaceRender = realRuntime.actions.dispatch({
  origin: "ui_node",
  action: realRuntime.entities.get("botster-web.package", "botster-web").app_surfaces[0].launch_action
});
await flushMicrotasks();
assert.deepEqual(await appSurfaceRender, {
  accepted: true,
  request_id: "real-runtime-action-1",
  result: {
    package_name: "botster-web",
    surface_id: "dogfood-app",
    kind: "plugin_surface",
    plugin_surface: {
      package_name: "botster-web",
      surface_id: "dogfood-app",
      body: "Deterministic app surface rendered by the botster-web dogfood package.",
      ui_tree_snapshot: {
        package_name: "botster-web",
        surface_id: "dogfood-app",
        body: {
          id: "botster-web-dogfood-app-root",
          primitive: "section",
          props: { label: "Dogfood App" },
          slots: {
            children: [
              {
                id: "botster-web-dogfood-app-copy",
                primitive: "text",
                props: { text: "Deterministic app surface rendered by the botster-web dogfood package." }
              }
            ]
          }
        }
      }
    }
  },
  reason: undefined
});
assert.equal(
  daemonResponseFrames({ kind: "status", sessions: [], packages: [], events: [] }, 21)
    .some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.session"),
  false
);
assert.equal(
  daemonResponseFrames({ kind: "sessions", sessions: [], packages: [], events: [] }, 21)
    .some((frame) => frame.kind === "entity_snapshot" && frame.payload.family === "botster-web.session"),
  true
);

const attachSuccess = realRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.session.attach", target: realHubDogfoodSessionId }
});
await flushMicrotasks();
assert.deepEqual(await attachSuccess, {
  accepted: true,
  request_id: "real-runtime-action-2",
  result: {
    session_id: realHubDogfoodSessionId,
    state: "selected",
    mode: "real_hub_dogfood"
  },
  reason: undefined
});

for (const frame of daemonResponseFrames({
  kind: "events",
  events: [{ type: "process_exit", session_id: realHubDogfoodSessionId, code: 0 }]
}, 22)) {
  if (frame.kind === "entity_patch") {
    realRuntime.entities.apply(frame.payload);
  }
}
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).status, "exited");
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).attachable, false);
assert.equal(realRuntime.entities.get("botster-web.session", realHubDogfoodSessionId).attach_action.disabled, true);

const runtimeDiagnostics = [];
const diagnosticRuntime = createBotsterWebClient({
  transport: realMode.transport,
  actionIdGenerator: deterministicIds("diagnostic-runtime-action"),
  actionTimeoutMs: 50
});
diagnosticRuntime.hub.onFrame((frame) => {
  const schemaDiagnostic = schemaVersionDiagnosticFromFrame(frame);
  if (schemaDiagnostic) runtimeDiagnostics.push(schemaDiagnostic);
  const hubDiagnostic = hubConnectionDiagnosticFromFrame(frame);
  if (hubDiagnostic) runtimeDiagnostics.push(hubDiagnostic);
  runtimeDiagnostics.push(...compatibilityDiagnosticsFromFrame(frame));
});
await diagnosticRuntime.hub.connect({ client: "botster-web", capabilities: [] });
await flushMicrotasks();
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "schema-version"), true);
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "hub-compatibility"), false);
assert.equal(runtimeDiagnostics.some((diagnostic) => diagnostic.id === "hub-diagnostic-connected"), true);
assert.equal(
  runtimeDiagnostics.some(
    (diagnostic) =>
      diagnostic.id === "hub-diagnostic-unsupported_feature-terminal_streaming" &&
      diagnostic.detail.includes("Capability: terminal_streaming")
  ),
  true
);
assert.equal(
  runtimeDiagnostics.some((diagnostic) => diagnostic.title === "Hub compatibility descriptor compatible"),
  false
);

const hubDiagnosticFrames = daemonResponseFrames({
  kind: "status",
  status: {
    lifecycle_state: "running",
    compatibility: {
      protocol: "botster-hub-daemon-v1",
      protocol_version: 1,
      features: [
        "sessions",
        "terminal_streaming",
        "resize",
        "plugin_surface_render",
        "plugin_surface_action"
      ],
      conformance_fixture_revision: 1
    },
    host_id: "dogfood-host",
    host_display_name: "Dogfood Hub",
    schema_version: 1,
    data_dir_configured: true,
    core_initialized: true,
    state_source: "explicit",
    package_count: 0,
    enabled_package_count: 0,
    provider_count: 0,
    enabled_provider_count: 0,
    session_count: 1,
    recovered_sessions: [],
    stale_sessions: [],
    diagnostics: [
      {
        kind: "compatibility_mismatch",
        message: "Hub protocol is not compatible",
        operation: "status"
      }
    ]
  },
  events: [
    {
      type: "runtime_observation",
      kind: "terminal_stream_unavailable"
    }
  ],
  diagnostics: [
    {
      kind: "action_failure",
      message: "Spawn action failed",
      operation: "spawn"
    }
  ]
}, 11).filter((frame) => frame.kind === "connection_diagnostic");
assert.equal(hubDiagnosticFrames.length, 3);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "compatibility_mismatch")).title,
  "Hub compatibility mismatch"
);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "terminal_stream_unavailable")).title,
  "Terminal stream unavailable"
);
assert.equal(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")).source,
  "action"
);
assert.match(
  hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")).detail,
  /Operation: spawn/
);
assert.equal(
  streamDisconnectedDiagnostic(new Error("SSE closed")).title,
  "Control stream disconnected"
);

const mappedFrames = daemonResponseFrames({
  kind: "operator_error",
  events: [],
  error: {
    code: "invalid",
    request_id: "operator-error-2",
    operation: "test",
    message: "Invalid request"
  }
}, 10);
assert.equal(mappedFrames.some((frame) => frame.kind === "operator_error"), true);
assert.equal(operatorErrorDiagnostic(mappedFrames.find((frame) => frame.kind === "operator_error")).title, "Hub operator error");

const spawnFailureDiagnosticMessage = "Spawn failed before terminal attach; the requested session already exists.";
const spawnFailureFrames = daemonResponseFrames({
  kind: "operator_error",
  sessions: [],
  packages: [],
  events: [],
  error: {
    code: "session_already_exists",
    request_id: "spawn-failure-runtime",
    operation: "spawn",
    message: "runtime failed while handling Spawn: Runtime"
  },
  diagnostics: [
    {
      kind: "action_failure",
      operation: "spawn",
      feature: null,
      message: spawnFailureDiagnosticMessage
    }
  ]
}, 12);
const spawnFailureOperatorDiagnostic = operatorErrorDiagnostic(spawnFailureFrames.find((frame) => frame.kind === "operator_error"));
const spawnFailureHubDiagnostic = hubConnectionDiagnosticFromFrame(
  spawnFailureFrames.find((frame) => frame.kind === "connection_diagnostic")
);
assert.equal(spawnFailureFrames.some((frame) => frame.kind === "operator_error"), true);
assert.equal(spawnFailureFrames.some((frame) => frame.kind === "connection_diagnostic"), true);
assert.equal(spawnFailureOperatorDiagnostic.title, "Hub operator error");
assert.equal(spawnFailureOperatorDiagnostic.detail, "runtime failed while handling Spawn: Runtime");
assert.equal(spawnFailureHubDiagnostic.title, "Hub action failed");
assert.equal(spawnFailureHubDiagnostic.severity, "warning");
assert.equal(spawnFailureHubDiagnostic.source, "action");
assert.match(spawnFailureHubDiagnostic.detail, new RegExp(spawnFailureDiagnosticMessage));
assert.match(spawnFailureHubDiagnostic.detail, /Operation: spawn/);
assert.doesNotMatch(spawnFailureHubDiagnostic.detail, /Capability:/);

const mismatchedSchemaDiagnostic = schemaVersionDiagnosticFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 2 }]
  }
});
assert.equal(mismatchedSchemaDiagnostic.title, "Daemon schema mismatch");
assert.match(mismatchedSchemaDiagnostic.detail, /expected schema 1/);

const matchingSchemaDiagnostic = schemaVersionDiagnosticFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 1 }]
  }
});
assert.equal(matchingSchemaDiagnostic.title, "Daemon schema compatible");

const descriptorUnavailableDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [{ id: "local-hub", schema_version: 1 }]
  }
})[0];
assert.equal(descriptorUnavailableDiagnostic.title, "Hub compatibility descriptor unavailable");
assert.equal(descriptorUnavailableDiagnostic.id, "hub-compatibility");

const protocolMismatchDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "other-protocol",
          protocol_version: 1,
          features: [
            "sessions",
            "terminal_streaming",
            "resize",
            "plugin_surface_render",
            "plugin_surface_action"
          ],
          conformance_fixture_revision: 1
        }
      }
    ]
  }
})[0];
assert.equal(protocolMismatchDiagnostic.title, "Hub protocol mismatch");

const missingCapabilityDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: ["sessions"],
          conformance_fixture_revision: 1
        }
      }
    ]
  }
})[0];
assert.equal(missingCapabilityDiagnostic.title, "Hub capability missing");
assert.match(missingCapabilityDiagnostic.detail, /terminal_streaming/);
assert.equal(missingCapabilityDiagnostic.id, "hub-compatibility");

const compatibleDescriptorDiagnostic = compatibilityDiagnosticsFromFrame({
  kind: "entity_snapshot",
  payload: {
    operation: "entity_snapshot",
    family: hubStatusFamily,
    records: [
      {
        id: "local-hub",
        schema_version: 1,
        compatibility: {
          protocol: "botster-hub-daemon-v1",
          protocol_version: 1,
          features: [
            "sessions",
            "terminal_streaming",
            "resize",
            "plugin_surface_render",
            "plugin_surface_action"
          ],
          conformance_fixture_revision: 1
        }
      }
    ]
  }
})[0];
const transitionedCompatibilityDiagnostics = [
  descriptorUnavailableDiagnostic,
  compatibleDescriptorDiagnostic
].reduce((diagnostics, diagnostic) => upsertDiagnostic(diagnostics, diagnostic), []);
assert.equal(transitionedCompatibilityDiagnostics.length, 1);
assert.equal(transitionedCompatibilityDiagnostics[0].title, "Hub compatibility descriptor compatible");

const absentHubDiagnosticIds = [bridgeUnavailableDiagnostic(new Error("connect ECONNREFUSED"))].map(({ id }) => id);
assert.deepEqual(absentHubDiagnosticIds, ["bridge-unavailable"]);
assert.equal(absentHubDiagnosticIds.includes("hub-compatibility"), false);

assert.equal(bridgeUnavailableDiagnostic(new Error("connect ECONNREFUSED")).title, "Local hub bridge unavailable");
assert.equal(streamDisconnectedDiagnostic(new Error("SSE closed")).title, "Control stream disconnected");
assert.equal(connectionFailureDiagnostic(false, new Error("connect ECONNREFUSED")).id, "bridge-unavailable");
assert.notEqual(connectionFailureDiagnostic(false, new Error("connect ECONNREFUSED")).id, "stream-disconnected");
assert.equal(connectionFailureDiagnostic(true, new Error("SSE closed")).id, "stream-disconnected");
const webRtcDiagnosticCases = [
  ["bootstrap", "webrtc-bootstrap-failed", "Local WebRTC bootstrap failed", "pairing"],
  ["signaling", "webrtc-signaling-failed", "Local WebRTC signaling failed", "signaling"],
  ["transport", "webrtc-transport-failed", "Local WebRTC transport failed", "webrtc"],
  ["encryption", "webrtc-encryption-failed", "Local WebRTC encryption failed", "encryption"],
  ["data-plane", "webrtc-data-plane-failed", "Local WebRTC data plane failed", "data-plane"]
];
for (const [stage, id, title, source] of webRtcDiagnosticCases) {
  const diagnostic = webRtcFailureDiagnostic(new WebrtcDaemonClientError(stage, `${stage} reachable failure`));
  assert.equal(diagnostic.id, id);
  assert.equal(diagnostic.title, title);
  assert.equal(diagnostic.source, source);
  assert.match(diagnostic.detail, new RegExp(`${stage} reachable failure`));

  const connectionDiagnostic = connectionFailureDiagnostic(false, new WebrtcDaemonClientError(stage, `${stage} connect failure`));
  assert.equal(connectionDiagnostic.id, id);
  assert.notEqual(connectionDiagnostic.id, "bridge-unavailable");
  assert.notEqual(connectionDiagnostic.id, "stream-disconnected");
}
assert.equal(
  terminalUnavailableDiagnostic(new WebrtcDaemonClientError("data-plane", "attach drain failed")).id,
  "webrtc-data-plane-failed"
);
assert.notEqual(
  terminalUnavailableDiagnostic(new WebrtcDaemonClientError("encryption", "decrypt failed")).id,
  "terminal-unavailable"
);
assert.equal(
  actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "Session not found" }
  ).detail,
  "Session not found"
);
assert.equal(
  actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "Session not found" }
  ).actionTarget,
  "missing-real-hub-session"
);
assert.match(
  actionFailureDiagnostic(
    { id: "botster.package.configuration.save", target: "project-pipelines" },
    {
      accepted: false,
      reason: "Package configuration failed",
      result: {
        diagnostics: [
          {
            kind: "field",
            field: "pipeline_mode",
            message: "select_option_unknown: invalid-mode"
          }
        ]
      }
    }
  ).detail,
  /Package configuration failed field: pipeline_mode: select_option_unknown: invalid-mode/
);

const terminalDataPlane = createRealHubTerminalDataPlane({
  bridge
});
const terminalOutput = [];
const terminalStatuses = [];
const terminalStatusSubscription = terminalDataPlane.subscribeStatus((status) => terminalStatuses.push(status));
const terminalSubscription = terminalDataPlane.subscribeOutput((data) => terminalOutput.push(data));
await flushMicrotasks();
await terminalDataPlane.writeInput("ping\n");
await terminalDataPlane.resize(24, 80);
const detachRequestsBeforeListenerClose = bridgeRequests.filter((request) => request.type === "detach").length;
terminalSubscription.unsubscribe();
assert.equal(
  bridgeRequests.filter((request) => request.type === "detach").length,
  detachRequestsBeforeListenerClose
);
assert.equal(bridgeTerminalStreams.filter((stream) => stream.unsubscribed === true).length, 1);
await terminalDataPlane.detach();
terminalStatusSubscription.unsubscribe();
assert.equal(bridgeTerminalStreams.some((stream) => stream.sessionId === realHubDogfoodSessionId), true);
assert.equal(bridgeRequests.some((request) => request.type === "send_input" && request.data === "ping\n"), true);
assert.equal(bridgeRequests.some((request) => request.type === "resize" && request.rows === 24 && request.cols === 80), true);
assert.equal(bridgeRequests.some((request) => request.type === "detach"), true);
assert.equal(bridgeTerminalStreams.filter((stream) => stream.unsubscribed === true).length, 1);
assert.deepEqual(terminalOutput.slice(0, 3), [
  "snapshot-history\r\n",
  "scrollback-history\r\n",
  "botster-web-dogfood-ready\r\n"
]);
assert.equal(terminalOutput.some((data) => data.includes("botster-web-dogfood-ready")), true);
assert.equal(terminalStatuses.some((status) => status.state === "attached" && status.message.includes("Historical terminal scrollback restored")), true);
assert.equal(terminalStatuses.some((status) => status.state === "scrollback_unavailable"), false);

const reattachedTerminalOutput = [];
const reattachedTerminalSubscription = terminalDataPlane.subscribeOutput((data) => reattachedTerminalOutput.push(data));
await waitFor(() => reattachedTerminalOutput.some((data) => data.includes("botster-web-dogfood-ready")));
reattachedTerminalSubscription.unsubscribe();
assert.equal(
  bridgeTerminalStreams.filter((stream) => stream.sessionId === realHubDogfoodSessionId && stream.unsubscribed !== true).length,
  2
);
assert.equal(
  bridgeRequests.filter((request) => request.type === "list_sessions").length >= 2,
  true
);

const byteOnlyTerminalStatuses = [];
const byteOnlyTerminalOutput = [];
const byteOnlyTerminalDataPlane = createRealHubTerminalDataPlane({
  bridge: {
    async request(request) {
      if (request.type === "list_sessions") {
        return {
          kind: "sessions",
          sessions: [{ session_id: realHubDogfoodSessionId, lifecycle: "running" }],
          events: []
        };
      }
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      onEvent({
        type: "snapshot",
        session_id: sessionId,
        subscription_id: subscriptionId,
        bytes: 19
      });
      onEvent({
        type: "terminal_output",
        session_id: sessionId,
        subscription_id: subscriptionId,
        data: "byte-only-live-output\r\n"
      });
      return {
        unsubscribe() {}
      };
    }
  }
});
byteOnlyTerminalDataPlane.subscribeStatus((status) => byteOnlyTerminalStatuses.push(status));
byteOnlyTerminalDataPlane.subscribeOutput((data) => byteOnlyTerminalOutput.push(data));
await waitFor(() => byteOnlyTerminalOutput.some((data) => data.includes("byte-only-live-output")));
assert.deepEqual(byteOnlyTerminalOutput, ["byte-only-live-output\r\n"]);
assert.equal(byteOnlyTerminalStatuses.some((status) => status.state === "scrollback_unavailable"), true);
assert.match(
  byteOnlyTerminalStatuses.find((status) => status.state === "scrollback_unavailable").message,
  /cannot render that snapshot format yet/
);

const delayedBridgeRequests = [];
const delayedBridgeTerminalStreams = [];
let delayedListSessions = 0;
const delayedTerminalDataPlane = createRealHubTerminalDataPlane({
  bridge: {
    async request(request) {
      delayedBridgeRequests.push(request);
      if (request.type === "list_sessions") {
        delayedListSessions += 1;
        return {
          kind: "sessions",
          sessions: delayedListSessions >= 3 ? [{ session_id: realHubDogfoodSessionId, lifecycle: "running" }] : [],
          events: []
        };
      }
      return { kind: "events", events: [] };
    },
    streamTerminal(sessionId, subscriptionId, onEvent) {
      delayedBridgeTerminalStreams.push({ sessionId, subscriptionId });
      onEvent({
        type: "terminal_output",
        session_id: sessionId,
        subscription_id: subscriptionId,
        data: "botster-web-dogfood-ready-after-retry\r\n"
      });
      return {
        unsubscribe() {
          delayedBridgeTerminalStreams.push({ sessionId, subscriptionId, unsubscribed: true });
        }
      };
    }
  }
});
const delayedOutput = [];
const delayedStatuses = [];
delayedTerminalDataPlane.subscribeStatus((status) => delayedStatuses.push(status));
delayedTerminalDataPlane.subscribeOutput((data) => delayedOutput.push(data));
const delayedResize = delayedTerminalDataPlane.resize(9, 34);
await waitFor(() => delayedOutput.some((data) => data.includes("ready-after-retry")));
await delayedResize;
assert.equal(delayedStatuses.some((status) => status.state === "live_only"), true);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize").length, 1);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize")[0].rows, 9);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "resize")[0].cols, 34);
assert.equal(delayedBridgeRequests.filter((request) => request.type === "list_sessions").length, 3);
assert.equal(delayedBridgeTerminalStreams.length, 1);

const terminalWithoutStream = createRealHubTerminalDataPlane({
  bridge: {
    async request() {
      return { kind: "events", events: [] };
    }
  }
});
let terminalAttachError;
try {
  terminalWithoutStream.subscribeOutput(() => undefined);
} catch (error) {
  terminalAttachError = error;
}
assert.match(terminalAttachError.message, /streaming terminal attach/);
assert.equal(terminalUnavailableDiagnostic(terminalAttachError).title, "Terminal stream unavailable");

const localRuntime = createBotsterWebClient({
  transport: createLocalDogfoodTransport(),
  actionIdGenerator: deterministicIds("dogfood-action"),
  actionTimeoutMs: 50
});

await localRuntime.hub.connect({ client: "botster-web", capabilities: [] });
await localRuntime.hub.subscribe();
await localRuntime.hub.subscribeSurface({ surface: "botster-web.dogfood.session", path: "/sessions/local" });
await localRuntime.entities.pull({ family: "botster-web.session" });
await localRuntime.entities.pull({ family: "botster-web.session_draft", id: "draft-1" });
await flushMicrotasks();
assert.equal(localRuntime.uiTree.current().surface, "botster-web.dogfood.session");
assert.deepEqual(localRuntime.entities.list("botster-web.session").map((record) => record.id), ["session-local-1"]);

const localSuccess = localRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.session.select", target: "session-local-1" }
});
await flushMicrotasks();
assert.deepEqual(await localSuccess, {
  accepted: true,
  request_id: "dogfood-action-1",
  result: { session_id: "session-local-1", state: "running" },
  reason: undefined
});
assert.equal(localRuntime.entities.get("botster-web.session", "session-local-1").status, "running");

const localValidation = localRuntime.actions.dispatch({
  origin: "ui_node",
  action: { id: "botster.session.rename", target: "session-local-1", params: { draft_id: "draft-1" } }
});
await flushMicrotasks();
assert.deepEqual(await localValidation, {
  accepted: false,
  request_id: "dogfood-action-2",
  result: undefined,
  reason: "Session name is required"
});
assert.deepEqual(localRuntime.entities.get("botster-web.session_draft", "draft-1").fields[0].errors, [
  "Session name is required"
]);

const vite = await createServer({
  configFile: false,
  resolve: {
    alias: {
      "@ionic/react": new URL("./botster/__fixtures__/IonicReactSsrMock.tsx", import.meta.url)
        .pathname
    }
  },
  optimizeDeps: {
    noDiscovery: true
  },
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const [
    { ionicUiNodeRendererRegistry },
    { uiNodeConformanceSnapshot, fixtureEntityFrames, fixtureProvenance },
    { dogfoodUiTreeSnapshot },
    { realHubDogfoodUiTreeSnapshot },
    { ConnectionDiagnosticsPanel },
    { DogfoodFirstScreen },
    { createInMemoryEntityFrameStore },
    { configurationFieldType, configurationSaveAction, configurationSubmitValues },
    {
      AppListItem,
      PluginListItem,
      PluginSurfaceRoutePage,
      PluginSettingsPanel,
      packageAppSurfaces,
      packageSettingsSurfaces,
      renderedPluginSurfaceState,
      surfaceLaunchAction
    }
  ] = await Promise.all([
    vite.ssrLoadModule("/src/botster/IonicUiNodeRenderer.tsx"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
    vite.ssrLoadModule("/src/botster/localDogfoodTransport.ts"),
    vite.ssrLoadModule("/src/botster/realHubDogfoodTransport.ts"),
    vite.ssrLoadModule("/src/botster/ConnectionDiagnosticsPanel.tsx"),
    vite.ssrLoadModule("/src/botster/dogfoodFirstScreen.tsx"),
    vite.ssrLoadModule("/src/botster/entities.ts"),
    vite.ssrLoadModule("/src/packageConfigurationForm.ts"),
    vite.ssrLoadModule("/src/App.tsx")
  ]);

  function findReactElement(node, predicate) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findReactElement(child, predicate);
        if (match) return match;
      }
      return undefined;
    }
    if (!node || typeof node !== "object") return undefined;
    if ("props" in node && predicate(node)) return node;
    const children = "props" in node ? node.props.children : undefined;
    const queue = Array.isArray(children) ? children : [children];
    for (const child of queue) {
      const match = findReactElement(child, predicate);
      if (match) return match;
    }
    return undefined;
  }

  assert.equal(terminalDataPlaneLabel("webrtc"), "WebRTC DataChannel");
  assert.equal(terminalDataPlaneLabel("real-hub"), "Bridge/SSE");
  assert.equal(terminalDataPlaneLabel("mock"), "Fixture");

  const descriptorPackageAction = {
    id: "descriptor-only:disable_package",
    action_id: "disable_package",
    status: "available",
    reason: "",
    diagnostics: [],
    required_references: [],
    action: {
      id: "botster.package.daemon_request",
      target: "descriptor-only",
      label: "Disable Package",
      params: {
        package_name: "descriptor-only",
        action_id: "disable_package",
        action_status: "available",
        action_reason: "",
        daemon_request: {
          request_type: "disable_package",
          package_name: "descriptor-only"
        }
      }
    }
  };

  const dtoBackedWebApp = {
    id: "botster-web:dogfood",
    title: "botster-web dogfood",
    kind: "web_app",
    launch_target_kind: "web_app",
    lifecycle_state: "running",
    local_url: "http://127.0.0.1:41739",
    diagnostics: [],
    diagnostics_summary: "Lifecycle: running",
    open_action: {
      id: "botster.app.open_url",
      target: "botster-web:dogfood",
      label: "Open app",
      disabled: false,
      params: { local_url: "http://127.0.0.1:41739" }
    }
  };
  const dtoBackedMissingUrlApp = {
    ...dtoBackedWebApp,
    id: "botster-web:missing-url",
    title: "Missing URL",
    local_url: "",
    diagnostics_summary: "Web app has no hub-provided local URL.",
    open_action: {
      ...dtoBackedWebApp.open_action,
      target: "botster-web:missing-url",
      disabled: true,
      params: { local_url: "" }
    }
  };
  const dtoBackedBlockedApp = {
    ...dtoBackedWebApp,
    id: "botster-web:blocked",
    title: "Blocked App",
    blocked_reasons: ["capability blocked"],
    diagnostics: ["capability blocked"],
    diagnostics_summary: "capability blocked",
    open_action: {
      ...dtoBackedWebApp.open_action,
      target: "botster-web:blocked",
      disabled: true
    }
  };
  const dtoBackedTerminalApp = {
    id: "project-pipelines:worker",
    title: "project-pipelines worker",
    kind: "terminal_app",
    launch_target_kind: "terminal_app",
    lifecycle_state: "installed",
    diagnostics: [],
    diagnostics_summary: "Requires local terminal launch.",
    open_action: {
      id: "botster.app.open_url",
      target: "project-pipelines:worker",
      label: "Launch in terminal",
      disabled: true,
      params: {}
    }
  };
  const dtoBackedUiSurfaceApp = {
    ...dtoBackedWebApp,
    id: "project-pipelines:web-client",
    title: "project-pipelines web client",
    package_name: "project-pipelines",
    local_url: ""
  };
  const matchedAppSurface = {
    surface_id: "home",
    title: "Pipelines",
    description: "Project Pipelines workbench",
    launch_action: {
      id: "botster.package.surface.render",
      target: "project-pipelines",
      label: "Pipelines",
      params: {
        package_name: "project-pipelines",
        surface_id: "home",
        surface_kind: "app",
        supports: ["render"]
      }
    }
  };
  const openedApps = [];
  const webAppMarkup = renderToStaticMarkup(
    createElement(AppListItem, {
      app: dtoBackedWebApp,
      onOpen: (appRecord) => openedApps.push(appRecord)
    })
  );
  assert.match(webAppMarkup, /botster web dogfood/);
  assert.match(webAppMarkup, /web_app/);
  assert.match(webAppMarkup, /Open/);
  assert.doesNotMatch(webAppMarkup, /Descriptor Dogfood|PackageSurfaces/);
  const webAppTree = AppListItem({
    app: dtoBackedWebApp,
    onOpen: (appRecord) => openedApps.push(appRecord)
  });
  const webAppItem = findReactElement(webAppTree, (element) => typeof element.props?.onClick === "function");
  assert.ok(webAppItem);
  webAppItem.props.onClick();
  assert.deepEqual(openedApps.map((appRecord) => appRecord.id), ["botster-web:dogfood"]);
  const uiSurfaceMarkup = renderToStaticMarkup(
    createElement(AppListItem, {
      app: dtoBackedUiSurfaceApp,
      surface: matchedAppSurface,
      onOpen: (appRecord) => openedApps.push(appRecord)
    })
  );
  assert.match(uiSurfaceMarkup, /project pipelines web client/);
  assert.match(uiSurfaceMarkup, /Project Pipelines workbench/);
  assert.match(uiSurfaceMarkup, /Open UI/);
  assert.doesNotMatch(uiSurfaceMarkup, /has no hub-provided local URL/);

  const renderPluginSurfaceRoutePage = (selectedSurface) =>
    renderToStaticMarkup(
      createElement(PluginSurfaceRoutePage, {
        packageName: "botster-web",
        surfaceId: "dogfood-app",
        selectedSurface,
        localState: {},
        entities: createInMemoryEntityFrameStore(),
        onAction: () => undefined
      })
    );
  const expectedDogfoodSurface = { packageName: "botster-web", surfaceId: "dogfood-app" };
  const validatedDogfoodSnapshot = {
    kind: "ui_tree_snapshot",
    surface: "botster-web/dogfood-app",
    version: "plugin-surface-hub-validated-v1",
    root: {
      id: "dogfood-app-root",
      primitive: "section",
      props: { title: "Dogfood App", label: "Dogfood App" },
      slots: {
        children: [
          {
            id: "dogfood-app-copy",
            primitive: "text",
            props: { text: "Workspaces rendered" }
          },
          {
            id: "dogfood-app-action",
            primitive: "action",
            props: {
              label: "Run deterministic action",
              action: {
                id: "ticket.open",
                label: "Run deterministic action",
                params: {
                  package_name: "botster-web",
                  surface_id: "dogfood-app",
                  action_id: "ticket.open"
                }
              }
            }
          }
        ]
      }
    }
  };
  const successfulValidatedSnapshotSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web Dogfood",
    phase: "rendered",
    status: "botster-web Dogfood: Workspaces rendered (botster-web/dogfood-app)",
    snapshot: validatedDogfoodSnapshot
  });
  assert.match(successfulValidatedSnapshotSurfaceMarkup, /data-testid="plugin-route-status-badge"/);
  assert.match(successfulValidatedSnapshotSurfaceMarkup, />Rendered<\/ion-badge>/);
  assert.match(successfulValidatedSnapshotSurfaceMarkup, /Workspaces rendered/);
  assert.doesNotMatch(successfulValidatedSnapshotSurfaceMarkup, />Loading<\/ion-badge>/);
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "dogfood-app",
            body: "Workspaces rendered",
            ui_tree_snapshot: {
              package_name: "botster-web",
              surface_id: "dogfood-app",
              body: {
                id: "dogfood-app-root",
                type: "panel",
                props: { title: "Dogfood App" },
                children: [
                  {
                    id: "dogfood-app-copy",
                    type: "text",
                    props: { text: "Workspaces rendered" }
                  },
                  {
                    id: "dogfood-app-action",
                    type: "button",
                    props: { label: "Run deterministic action", action: "ticket.open" }
                  }
                ]
              }
            }
          }
        }
      },
      "botster-web Dogfood",
      expectedDogfoodSurface,
      "botster-web/dogfood-app"
    ),
    {
      routeKey: "botster-web/dogfood-app",
      title: "botster-web Dogfood",
      phase: "rendered",
      status: "botster-web Dogfood: Workspaces rendered (botster-web/dogfood-app)",
      snapshot: validatedDogfoodSnapshot
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "dogfood-app",
            body: { text: "Workspaces rendered from JSON body" }
          }
        }
      },
      "botster-web Dogfood",
      expectedDogfoodSurface,
      "botster-web/dogfood-app"
    ),
    {
      routeKey: "botster-web/dogfood-app",
      title: "botster-web Dogfood",
      phase: "error",
      status: "botster-web Dogfood requires a hub validated UiTree snapshot for botster-web/dogfood-app; this hub returned only an unvalidated plugin surface body."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "botster-web",
            surface_id: "dogfood-app",
            body: {}
          }
        }
      },
      "botster-web Dogfood",
      expectedDogfoodSurface,
      "botster-web/dogfood-app"
    ),
    {
      routeKey: "botster-web/dogfood-app",
      title: "botster-web Dogfood",
      phase: "error",
      status: "botster-web Dogfood requires a hub validated UiTree snapshot for botster-web/dogfood-app; this hub returned only an unvalidated plugin surface body."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      { accepted: true, result: { kind: "plugin_surface" } },
      "botster-web Dogfood",
      expectedDogfoodSurface,
      "botster-web/dogfood-app"
    ),
    {
      routeKey: "botster-web/dogfood-app",
      title: "botster-web Dogfood",
      phase: "error",
      status: "Render response did not include botster-web/dogfood-app validated snapshot."
    }
  );
  assert.deepEqual(
    renderedPluginSurfaceState(
      {
        accepted: true,
        result: {
          kind: "plugin_surface",
          plugin_surface: {
            package_name: "other-package",
            surface_id: "other-surface",
            body: "Other rendered"
          }
        }
      },
      "botster-web Dogfood",
      expectedDogfoodSurface,
      "botster-web/dogfood-app"
    ),
    {
      routeKey: "botster-web/dogfood-app",
      title: "botster-web Dogfood",
      phase: "error",
      status: "Render response did not include botster-web/dogfood-app validated snapshot."
    }
  );
  const structuredErrorSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web Dogfood",
    phase: "error",
    status: "Surface render blocked by package policy."
  });
  assert.match(structuredErrorSurfaceMarkup, />Error<\/ion-badge>/);
  assert.match(structuredErrorSurfaceMarkup, /Surface render blocked by package policy/);
  assert.doesNotMatch(structuredErrorSurfaceMarkup, />Loading<\/ion-badge>/);
  const pendingSurfaceMarkup = renderPluginSurfaceRoutePage({
    title: "botster-web Dogfood",
    phase: "rendering",
    status: "Rendering botster-web Dogfood"
  });
  assert.match(pendingSurfaceMarkup, />Loading<\/ion-badge>/);

  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedMissingUrlApp, onOpen: () => undefined })),
    /Web app has no hub-provided local URL/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedBlockedApp, onOpen: () => undefined })),
    /capability blocked/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedTerminalApp, onOpen: () => undefined })),
    /Requires local terminal launch/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: dtoBackedTerminalApp, onOpen: () => undefined })),
    /Terminal/
  );
  assert.match(
    renderToStaticMarkup(createElement(AppListItem, { app: optionalDaemonAppRecord, onOpen: () => undefined })),
    /Web app has no hub-provided local URL/
  );

  const descriptorApp = {
    id: "descriptor-only",
    title: "Descriptor Only",
    version: "1.0.0",
    capability_summary: "PackageSurfaces:render",
    package_actions: [descriptorPackageAction],
    app_surfaces: [
      {
        surface_id: "dogfood-app",
        title: "Descriptor Dogfood",
        description: "Descriptor-backed app surface",
        launch_action: {
          id: "botster.package.surface.render",
          target: "descriptor-only",
          label: "Descriptor Dogfood",
          params: {
            package_name: "descriptor-only",
            surface_id: "dogfood-app",
            surface_kind: "app",
            supports: ["render"]
          }
        }
      }
    ],
    settings_surfaces: [
      {
        surface_id: "dogfood-settings",
        title: "Descriptor Settings",
        description: "Descriptor-backed settings surface",
        launch_action: {
          id: "botster.package.surface.render",
          target: "descriptor-only",
          label: "Descriptor Settings",
          params: {
            package_name: "descriptor-only",
            surface_id: "dogfood-settings",
            surface_kind: "settings",
            supports: ["render"]
          }
        }
      }
    ]
  };
  const legacyOnlyApp = {
    id: "legacy-only",
    title: "Legacy Only",
    version: "0.9.0",
    capability_summary: "PackageSurfaces:legacy",
    view_surface: { id: "legacy-view", title: "Legacy View" },
    settings_surface: { id: "legacy-settings", title: "Legacy Settings" }
  };
  const openedSettings = [];
  const descriptorListMarkup = renderToStaticMarkup(
    createElement(PluginListItem, {
      app: descriptorApp,
      onOpen: () => undefined,
      onSettings: (appRecord) => openedSettings.push(appRecord)
    })
  );
  assert.match(descriptorListMarkup, /Descriptor Only/);
  assert.match(descriptorListMarkup, /1 UI/);
  assert.doesNotMatch(descriptorListMarkup, /Descriptor Dogfood|Disable Package|surface-action-row/);
  assert.equal(packageAppSurfaces(descriptorApp).length, 1);
  assert.equal(packageSettingsSurfaces(descriptorApp).length, 1);
  assert.equal(surfaceLaunchAction(packageAppSurfaces(descriptorApp)[0]).id, "botster.package.surface.render");

  const descriptorListTree = PluginListItem({
    app: descriptorApp,
    onOpen: () => undefined,
    onSettings: (appRecord) => openedSettings.push(appRecord)
  });
  const descriptorSettingsButton = findReactElement(
    descriptorListTree,
    (element) => element.props?.["aria-label"] === "Settings for Descriptor Only" && typeof element.props?.onClick === "function"
  );
  assert.ok(descriptorSettingsButton);
  descriptorSettingsButton.props.onClick({ stopPropagation() {} });
  assert.deepEqual(openedSettings.map((appRecord) => appRecord.id), ["descriptor-only"]);

  const descriptorSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: descriptorApp,
      onAction: () => undefined
    })
  );
  assert.match(descriptorSettingsMarkup, /Descriptor Settings/);
  assert.match(descriptorSettingsMarkup, /Descriptor-backed settings surface/);
  assert.match(descriptorSettingsMarkup, /Disable Package/);
  const configurableDescriptorApp = {
    ...descriptorApp,
    configuration_fields: [
      {
        id: "endpoint",
        label: "Endpoint",
        kind: "text_input",
        config_type: "url",
        value: "",
        required: true,
        helper: "Webhook receiver URL",
        errors: ["Required configuration is missing."]
      },
      {
        id: "mode",
        label: "Mode",
        kind: "select",
        config_type: "select",
        value: "read",
        options: [
          { value: "read", label: "Read" },
          { value: "write", label: "Write" }
        ],
        errors: []
      },
      {
        id: "enabled",
        label: "Enabled",
        kind: "checkbox",
        config_type: "boolean",
        value: true,
        errors: []
      },
      {
        id: "api_token",
        label: "API token",
        kind: "secret",
        config_type: "secret",
        value: "",
        secret_state: "redacted",
        placeholder: "Saved credential",
        helper: "Leave blank to keep the existing secret.",
        errors: []
      }
    ],
    configuration_submit: {
      id: "botster.package.configuration.save",
      target: "descriptor-only",
      label: "Save configuration",
      params: {
        package_name: "descriptor-only",
        daemon_request: {
          request_type: "set_package_configuration",
          package_name: "descriptor-only"
        }
      }
    }
  };
  const configurationSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: configurableDescriptorApp,
      onAction: () => undefined
    })
  );
  assert.match(configurationSettingsMarkup, /Package configuration/);
  assert.match(configurationSettingsMarkup, /ion-input/);
  assert.match(configurationSettingsMarkup, /ion-select/);
  assert.match(configurationSettingsMarkup, /ion-checkbox/);
  assert.match(configurationSettingsMarkup, /Required configuration is missing/);
  assert.match(configurationSettingsMarkup, /Secret saved/);
  assert.match(configurationSettingsMarkup, /Save configuration/);
  assert.equal(configurationFieldType({ kind: "checkbox", config_type: "boolean" }), "boolean");
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: "replacement-token"
    }),
    {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      mode: { type: "select", value: "write" },
      enabled: { type: "boolean", value: false },
      api_token: { type: "secret", state: "write_only" }
    }
  );
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: ""
    }),
    {
      endpoint: { type: "url", value: "https://example.invalid/hook" },
      mode: { type: "select", value: "write" },
      enabled: { type: "boolean", value: false }
    }
  );
  assert.deepEqual(
    configurationSubmitValues(configurableDescriptorApp.configuration_fields, {
      endpoint: "",
      mode: "read",
      enabled: true,
      api_token: ""
    }),
    {
      endpoint: { type: "url", value: "" },
      mode: { type: "select", value: "read" },
      enabled: { type: "boolean", value: true }
    }
  );
  assert.deepEqual(
    configurationSaveAction(configurableDescriptorApp.configuration_submit, configurableDescriptorApp.configuration_fields, {
      endpoint: "https://example.invalid/hook",
      mode: "write",
      enabled: false,
      api_token: ""
    }),
    {
      ...configurableDescriptorApp.configuration_submit,
      params: {
        ...configurableDescriptorApp.configuration_submit.params,
        values: {
          endpoint: { type: "url", value: "https://example.invalid/hook" },
          mode: { type: "select", value: "write" },
          enabled: { type: "boolean", value: false }
        }
      }
    }
  );
  const remoteAccessSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: {
        id: "botster-web",
        title: "botster-web",
        configuration_fields: [
          {
            id: "remote_browser_rendezvous_enabled",
            label: "Remote browser access",
            kind: "checkbox",
            config_type: "boolean",
            value: false,
            helper: "Local installed access stays available. Remote browser rendezvous through Botster Cloud requires opt-in, pairing, and device approval.",
            errors: ["Remote access configuration failed"]
          }
        ],
        configuration_submit: {
          id: "botster.package.configuration.save",
          target: "botster-web",
          label: "Configure",
          disabled: false,
          params: {
            package_name: "botster-web",
            daemon_request: { request_type: "set_package_configuration", package_name: "botster-web" }
          }
        },
        settings_surfaces: [],
        package_actions: []
      },
      onAction: () => undefined
    })
  );
  assert.equal((remoteAccessSettingsMarkup.match(/Remote browser access/g) ?? []).length, 1);
  assert.match(remoteAccessSettingsMarkup, /Remote browser rendezvous is off/);
  assert.match(remoteAccessSettingsMarkup, /Remote access configuration failed/);
  assert.doesNotMatch(remoteAccessSettingsMarkup, /Remote browser access[\\s\\S]*boolean[\\s\\S]*Remote browser access/);
  const optionalSettingsMarkup = renderToStaticMarkup(
    createElement(PluginSettingsPanel, {
      app: optionalDaemonPackageRecord,
      onAction: () => undefined
    })
  );
  assert.match(optionalSettingsMarkup, /No settings surface registered/);
  assert.doesNotMatch(optionalSettingsMarkup, /Package configuration|undefined|null/);

  const legacyListMarkup = renderToStaticMarkup(
    createElement(PluginListItem, {
      app: legacyOnlyApp,
      onOpen: () => undefined,
      onSettings: (appRecord) => openedSettings.push(appRecord)
    })
  );
  assert.match(legacyListMarkup, /Legacy Only/);
  assert.match(legacyListMarkup, /No UI/);
  assert.doesNotMatch(legacyListMarkup, /Legacy View|Legacy Settings|surface-action-row/);
  assert.equal(packageAppSurfaces(legacyOnlyApp).length, 0);
  assert.equal(packageSettingsSurfaces(legacyOnlyApp).length, 0);

  const collectedActions = [];
  const markup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      uiNodeConformanceSnapshot,
      createInMemoryEntityFrameStore(fixtureEntityFrames),
      {
        capabilities: {
          ionic_shell: true,
          ui_tree_snapshot: true,
          entity_frame_store: true,
          semantic_actions: true,
          terminal_view_bridge: true,
          plugin_surface_sandbox: true,
          isolated_plugin_asset: false
        },
        collectAction(action, node) {
          collectedActions.push({ action, nodeId: node.id });
        }
      }
    )
  );

  assert.equal(ionicUiNodeRendererRegistry.supports("stack"), true);
  assert.equal(ionicUiNodeRendererRegistry.supports("timeline"), false);
  assert.match(markup, /Universal primitives/);
  assert.match(markup, /Renderer registry/);
  assert.match(markup, /Capability fallback/);
  assert.match(markup, /Title already exists/);
  assert.match(markup, /data-action-id="botster\.session\.select"/);
  assert.match(markup, /Unsupported capability: isolated_plugin_asset/);
  assert.match(markup, /data-unsupported-primitive="timeline"/);
  assert.equal(collectedActions.some(({ action }) => action.id === "botster.session.select"), true);
  assert.equal(fixtureProvenance.mirroredFor, "ticket_1780941197_299829");
  assert.equal(ionicUiNodeRendererRegistry.supports("iframe"), true);

  const iframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.test",
        version: "test",
        root: {
          id: "preview-frame",
          primitive: "iframe",
          props: {
            src: "/packages/iframe.plugin/assets/preview.html",
            title: "Preview",
            html: "<script>window.__raw = true</script>",
            srcdoc: "<p>raw</p>",
            sandbox: ["allow-forms", "allow-scripts", "allow-top-navigation"]
          }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(iframeMarkup, /<iframe/);
  assert.match(iframeMarkup, /src="\/packages\/iframe\.plugin\/assets\/preview\.html"/);
  assert.match(iframeMarkup, /title="Preview"/);
  assert.match(iframeMarkup, /sandbox="allow-forms allow-scripts"/);
  assert.doesNotMatch(iframeMarkup, /srcdoc|__raw|allow-top-navigation|dangerouslySetInnerHTML/);

  const invalidIframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.invalid",
        version: "test",
        root: {
          id: "bad-frame",
          primitive: "iframe",
          props: { src: "javascript:alert(1)", title: "Bad" }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(invalidIframeMarkup, /Iframe source unavailable/);
  assert.doesNotMatch(invalidIframeMarkup, /javascript:alert/);

  const protocolRelativeIframeMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(
      {
        kind: "ui_tree_snapshot",
        surface: "iframe.protocol-relative",
        version: "test",
        root: {
          id: "protocol-relative-frame",
          primitive: "iframe",
          props: { src: "//example.invalid/preview.html", title: "Protocol relative" }
        }
      },
      createInMemoryEntityFrameStore(),
      {}
    )
  );
  assert.match(protocolRelativeIframeMarkup, /Iframe source unavailable/);
  assert.doesNotMatch(protocolRelativeIframeMarkup, /example\.invalid/);

  const dogfoodStore = createInMemoryEntityFrameStore();
  dogfoodStore.apply({
    operation: "entity_snapshot",
    family: "botster-web.session",
    records: [
      {
        id: "session-local-1",
        title: "Local dogfood session",
        status: "running",
        last_result: "action_request accepted by local dogfood adapter"
      }
    ]
  });
  dogfoodStore.apply({
    operation: "entity_snapshot",
    family: "botster-web.session_draft",
    records: [
      {
        id: "draft-1",
        fields: [
          {
            id: "session_name",
            label: "Session name",
            kind: "text_input",
            value: "",
            errors: ["Session name is required"]
          },
          {
            id: "target",
            label: "Target",
            kind: "text_input",
            value: "botster-web",
            errors: []
          }
        ]
      }
    ]
  });

  const dogfoodMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(dogfoodUiTreeSnapshot, dogfoodStore, {
      capabilities: {
        ionic_shell: true,
        ui_tree_snapshot: true,
        entity_frame_store: true,
        semantic_actions: true,
        terminal_view_bridge: true,
        plugin_surface_sandbox: true
      },
      localState: {
        "dogfood.action_status": "Accepted botster.session.select"
      }
    })
  );

  assert.match(dogfoodMarkup, /Session spawn\/attach dogfood/);
  assert.match(dogfoodMarkup, /Accepted botster\.session\.select/);
  assert.match(dogfoodMarkup, /Local dogfood session/);
  assert.match(dogfoodMarkup, /running/);
  assert.match(dogfoodMarkup, /action_request accepted by local dogfood adapter/);
  assert.match(dogfoodMarkup, /Session name is required/);
  assert.match(dogfoodMarkup, /data-action-id="botster\.session\.select"/);
  assert.match(dogfoodMarkup, /data-action-id="botster\.session\.rename"/);

  const realHubStore = createInMemoryEntityFrameStore();
  for (const frame of daemonResponseFrames({
    kind: "packages",
    packages: [
      {
        package_name: "botster-web",
        version: "0.1.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [],
        surfaces: packageManifest.surfaces,
        runnable_entrypoints: [
          {
            id: "web-client",
            kind: "web",
            command: "node",
            args: ["scripts/real-hub-dogfood-bridge.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [{ surface: "network", scope: "localhost" }],
            may_supervise: true,
            process: {
              state: "running",
              pid: 41739,
              started_at: 1781112600,
              diagnostics: []
            },
            actions: entrypointActions("botster-web", "web-client")
          }
        ],
        configuration: botsterWebRemoteAccessConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [],
        feature_availability: [],
        actions: installedPackageActions("botster-web", true, true),
        provider_profile_admitted: false
      },
      {
        package_name: "project-pipelines",
        version: "0.8.0",
        classification: "plugin",
        state: "enabled",
        requested_capabilities: [{ surface: "SessionActions", scope: "project-pipelines" }],
        surfaces: [
          {
            id: "home",
            kind: "app",
            title: "Pipelines",
            description: "Project Pipelines workbench",
            order: 1,
            supports: ["render"]
          },
          {
            id: "settings",
            kind: "settings",
            title: "Pipeline Settings",
            order: 2,
            supports: ["render"]
          }
        ],
        view_surface: { id: "legacy-view", title: "Legacy View" },
        settings_surface: { id: "legacy-settings", title: "Legacy Settings" },
        runnable_entrypoints: [
          {
            id: "web-client",
            kind: "web",
            command: "node",
            args: ["scripts/real-hub-dogfood-bridge.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "running",
              pid: 4273,
              started_at: 1781112500,
              diagnostics: []
            },
            actions: entrypointActions("project-pipelines", "web-client")
          }
        ],
        configuration: configurablePackageConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [
          { id: "botster", package_name: "botster", state: "available", reasons: [] }
        ],
        feature_availability: [
          { id: "pipeline-runs", state: "available", reasons: [] }
        ],
        actions: installedPackageActions("project-pipelines", true, true),
        provider_profile_admitted: false
      },
      {
        package_name: "github-provider",
        version: "1.2.3",
        classification: "provider",
        state: "disabled",
        requested_capabilities: [{ surface: "ClientAdmission", scope: "github" }],
        runnable_entrypoints: [
          {
            id: "poller",
            kind: "provider",
            command: "node",
            args: ["scripts/poller.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "local",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "stopped",
              started_at: 1781112100,
              exited_at: 1781112200,
              exit_status: "signal:term",
              diagnostics: []
            },
            actions: entrypointActions("github-provider", "poller")
          }
        ],
        configuration: emptyPackageConfiguration,
        availability: blockedGithubAvailability,
        dependency_availability: [
          {
            id: "project-pipelines",
            package_name: "project-pipelines",
            state: "blocked",
            reasons: [{ reason: "dependency_disabled", action: "enable_package", package_name: "project-pipelines" }]
          }
        ],
        feature_availability: [
          {
            id: "github-prs",
            state: "blocked",
            reasons: [{ reason: "auth_required", action: "enable_package", requirement: "github" }]
          }
        ],
        actions: [
          daemonAction(
            "enable_package",
            "blocked",
            null,
            "auth_required",
            [{ kind: "auth_required", message: "GitHub auth is required" }]
          ),
          ...installedPackageActions("github-provider", false, false).filter((action) => action.action_id !== "enable_package")
        ],
        provider_profile_admitted: false
      },
      {
        package_name: "local-diagnostics",
        version: "0.1.0",
        classification: "plugin",
        state: "installed",
        requested_capabilities: [],
        runnable_entrypoints: [
          {
            id: "worker",
            kind: "daemon",
            command: "node",
            args: ["scripts/worker.mjs"],
            working_directory: { policy: "package_root", path: null },
            environment: [],
            mode: "dev",
            capabilities: [],
            may_supervise: true,
            process: {
              state: "failed",
              started_at: 1781112400,
              exited_at: 1781112460,
              exit_status: "exit:42",
              diagnostics: [{ kind: "stderr", message: "fixture failure" }]
            }
          }
        ],
        configuration: emptyPackageConfiguration,
        availability: availablePackageAvailability,
        dependency_availability: [],
        feature_availability: [],
        actions: installedPackageActions("local-diagnostics", false, false),
        provider_profile_admitted: false
      }
    ]
  }, 13)) {
    if (frame.kind === "entity_snapshot") {
      realHubStore.apply(frame.payload);
    }
  }
  for (const frame of daemonResponseFrames({
    kind: "sessions",
    sessions: [{ session_id: realHubDogfoodSessionId, lifecycle: "running" }]
  }, 14)) {
    if (frame.kind === "entity_snapshot") {
      realHubStore.apply(frame.payload);
    }
  }
  for (const frame of daemonResponseFrames(generatedAppResponseFixture, 15)) {
    if (frame.kind === "entity_snapshot") {
      realHubStore.apply(frame.payload);
    }
  }

  const realHubMarkup = renderToStaticMarkup(
    ionicUiNodeRendererRegistry.render(realHubDogfoodUiTreeSnapshot, realHubStore, {
      capabilities: {
        ionic_shell: true,
        ui_tree_snapshot: true,
        entity_frame_store: true,
        semantic_actions: true,
        terminal_view_bridge: true,
        plugin_surface_sandbox: true
      },
      localState: {
        "dogfood.action_status": `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`,
        "dogfood.diagnostic_action_status": "Session not found",
        "dogfood.plugin_surface_status": "botster-web Dogfood: Deterministic app surface rendered by the botster-web dogfood package. (botster-web/dogfood-app)"
      }
    })
  );
  assert.match(realHubMarkup, /Installed packages/);
  assert.match(realHubMarkup, /Installed apps/);
  assert.match(realHubMarkup, /botster-web/);
  assert.match(realHubMarkup, /botster-web dogfood/);
  assert.match(realHubMarkup, /Lifecycle: running/);
  assert.match(realHubMarkup, /Requires local terminal launch/);
  assert.match(realHubMarkup, /botster-web Settings/);
  assert.match(realHubMarkup, /dogfood-settings/);
  assert.match(realHubMarkup, /Remote browser access/);
  assert.match(realHubMarkup, /Rendered package surface|Rendered app surface/);
  assert.match(realHubMarkup, /Deterministic app surface rendered by the botster-web dogfood package/);
  assert.match(realHubMarkup, /botster-web\/dogfood-app/);
  assert.match(realHubMarkup, /project-pipelines/);
  assert.match(realHubMarkup, /enabled/);
  assert.match(realHubMarkup, /github-provider/);
  assert.match(realHubMarkup, /disabled/);
  assert.match(realHubMarkup, /local-diagnostics/);
  assert.match(realHubMarkup, /installed/);
  assert.match(realHubMarkup, /SessionActions:project-pipelines/);
  assert.match(realHubMarkup, /No requested capabilities/);
  assert.match(realHubMarkup, /No provider profile admission/);
  assert.match(realHubMarkup, /web-client \(web\)/);
  assert.match(realHubMarkup, /web-client running/);
  assert.match(realHubMarkup, /pid 4273/);
  assert.match(realHubMarkup, /poller \(provider\)/);
  assert.match(realHubMarkup, /poller stopped/);
  assert.match(realHubMarkup, /exited_at 1781112200/);
  assert.match(realHubMarkup, /worker \(daemon\)/);
  assert.match(realHubMarkup, /worker failed/);
  assert.match(realHubMarkup, /exit_status exit:42/);
  assert.match(realHubMarkup, /worker stderr: fixture failure/);
  assert.match(realHubMarkup, /Package configuration/);
  assert.match(realHubMarkup, /project-pipelines configuration/);
  assert.match(realHubMarkup, /Webhook endpoint \*/);
  assert.match(realHubMarkup, /API token \*/);
  assert.match(realHubMarkup, /Mode/);
  assert.match(realHubMarkup, /Enabled/);
  assert.match(realHubMarkup, /Required configuration is missing/);
  assert.match(realHubMarkup, /Existing secret is saved/);
  assert.match(realHubMarkup, /Configure project-pipelines/);
  assert.match(realHubMarkup, /No blocked reasons/);
  assert.match(realHubMarkup, /botster available/);
  assert.match(realHubMarkup, /pipeline-runs available/);
  assert.match(realHubMarkup, /enable_package: auth_required/);
  assert.match(realHubMarkup, /Package lifecycle actions/);
  assert.match(realHubMarkup, /disable_package available/);
  assert.match(realHubMarkup, /reload_package unavailable \(unsupported\)/);
  assert.match(realHubMarkup, /Launch installed apps/);
  assert.match(realHubMarkup, /Open settings surfaces/);
  assert.match(realHubMarkup, /Pipelines/);
  assert.match(realHubMarkup, /Pipeline Settings/);
  assert.match(realHubMarkup, /data-action-id="botster\.package\.surface\.render"/);
  assert.match(realHubMarkup, /data-action-id="botster\.package\.configuration\.save"/);
  assert.match(realHubMarkup, /data-action-id="botster\.package\.configure"/);
  assert.match(realHubMarkup, /data-action-id="botster\.package\.daemon_request"/);
  assert.match(realHubMarkup, /data-action-id="botster\.app\.open_url"/);
  assert.match(realHubMarkup, /data-action-id="botster\.package\.daemon_request"[^>]*disabled=""/);
  assert.doesNotMatch(realHubMarkup, /write_only|super-secret-token/);
  assert.doesNotMatch(realHubMarkup, /Legacy View|Legacy Settings/);
  assert.match(realHubMarkup, /Diagnostic action failure/);
  assert.match(realHubMarkup, /Run missing-session diagnostic/);
  assert.match(realHubMarkup, /Session not found/);
  assert.match(realHubMarkup, new RegExp(`Spawn requested for ${realHubDogfoodSessionId}`));
  assert.doesNotMatch(realHubMarkup, /Trigger invalid action/);
  assert.doesNotMatch(realHubMarkup, /Error state/);
  assert.match(realHubMarkup, /Attachable/);
  assert.match(realHubMarkup, /data-action-id="botster\.session\.attach"/);
  assert.doesNotMatch(realHubMarkup, /install_package|update_package|retry_package/);

  const healthyFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [matchingSchemaDiagnostic, compatibleDescriptorDiagnostic],
      packages: [
        {
          id: "botster-web",
          title: "botster-web",
          status: "enabled",
          entrypoint_process_summary: "web-client running"
        }
      ],
      packageLoadStatus: "loaded",
      sessions: [{ id: realHubDogfoodSessionId, status: "running" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(healthyFirstScreenMarkup, /Local hub workbench/);
  assert.match(healthyFirstScreenMarkup, /Hub, bridge, package registry, session state, spawn action, and terminal/);
  assert.match(healthyFirstScreenMarkup, new RegExp(`Spawn ${realHubDogfoodSessionId}`));
  assert.match(healthyFirstScreenMarkup, /botster-web-dogfood-ready/);
  assert.match(healthyFirstScreenMarkup, /Output appears in the terminal panel/);
  assert.match(healthyFirstScreenMarkup, /Packages/);
  assert.match(healthyFirstScreenMarkup, /Loaded/);
  assert.match(healthyFirstScreenMarkup, /Sessions/);
  assert.match(healthyFirstScreenMarkup, /Running/);
  assert.match(healthyFirstScreenMarkup, /Terminal output destination/);
  assert.doesNotMatch(healthyFirstScreenMarkup, /Ionic React renderer shell/);
  assert.doesNotMatch(healthyFirstScreenMarkup, /Spawn succeeded/);

  const bridgeDownFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [bridgeUnavailableDiagnostic(new Error("connect ECONNREFUSED"))],
      packages: [],
      packageLoadStatus: "not_loaded",
      sessions: [],
      sessionLoadStatus: "not_loaded",
      actionStatus: "connect ECONNREFUSED"
    })
  );
  assert.match(bridgeDownFirstScreenMarkup, /<h3>Hub<\/h3><ion-badge color="danger">Blocked/);
  assert.match(bridgeDownFirstScreenMarkup, /<h3>Bridge<\/h3><ion-badge color="danger">Blocked/);
  assert.match(bridgeDownFirstScreenMarkup, /connect ECONNREFUSED/);
  assert.doesNotMatch(bridgeDownFirstScreenMarkup, /<h3>Hub<\/h3><ion-badge color="success">Connected/);

  const unloadedFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [],
      packages: [],
      packageLoadStatus: "not_loaded",
      sessions: [],
      sessionLoadStatus: "not_loaded",
      actionStatus: "Packaged runtime attached to real hub bridge"
    })
  );
  assert.match(unloadedFirstScreenMarkup, /Not loaded/);
  assert.match(unloadedFirstScreenMarkup, /Package registry pull has not completed yet/);
  assert.match(unloadedFirstScreenMarkup, /Session pull has not completed yet/);
  assert.doesNotMatch(unloadedFirstScreenMarkup, /Loaded package registry returned zero package records/);

  const emptyFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [],
      packages: [],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Packaged runtime attached to real hub bridge"
    })
  );
  assert.match(emptyFirstScreenMarkup, /Empty/);
  assert.match(emptyFirstScreenMarkup, /Loaded package registry returned zero package records/);
  assert.match(emptyFirstScreenMarkup, /No sessions are loaded yet/);

  const failedPackageFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [compatibleDescriptorDiagnostic],
      packages: [
        {
          id: "botster-web",
          status: "enabled",
          entrypoint_process_summary: "web-client running; worker failed (exit_status exit:42)"
        }
      ],
      packageLoadStatus: "loaded",
      sessions: [{ id: realHubDogfoodSessionId, status: "running" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(failedPackageFirstScreenMarkup, /<article class="dogfood-status-card danger"><div class="dogfood-status-title"><h3>Packages<\/h3><ion-badge color="danger">Error/);
  assert.match(failedPackageFirstScreenMarkup, /1 has failed entrypoint state/);

  const degradedTerminalFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [terminalUnavailableDiagnostic(new Error("terminal stream closed"))],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [{ id: realHubDogfoodSessionId, status: "running" }],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(degradedTerminalFirstScreenMarkup, /terminal stream closed/);
  assert.match(degradedTerminalFirstScreenMarkup, /Packages/);
  assert.match(degradedTerminalFirstScreenMarkup, /Sessions/);
  assert.match(degradedTerminalFirstScreenMarkup, /Running/);

  const spawnRequestedFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [compatibleDescriptorDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: `Spawn requested for ${realHubDogfoodSessionId}; session state below confirms when it is running.`
    })
  );
  assert.match(spawnRequestedFirstScreenMarkup, /<h3>Spawn action<\/h3><ion-badge color="medium">Requested/);
  assert.doesNotMatch(spawnRequestedFirstScreenMarkup, /Session botster-web-dogfood-session is running/);

  const spawnFailedFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [spawnFailureOperatorDiagnostic, spawnFailureHubDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "runtime failed while handling Spawn: Runtime"
    })
  );
  assert.match(spawnFailedFirstScreenMarkup, /Spawn action/);
  assert.match(spawnFailedFirstScreenMarkup, /Blocked/);
  assert.match(spawnFailedFirstScreenMarkup, new RegExp(spawnFailureDiagnosticMessage));
  assert.doesNotMatch(spawnFailedFirstScreenMarkup, /Session botster-web-dogfood-session is running/);
  assert.doesNotMatch(spawnFailedFirstScreenMarkup, /Spawn succeeded/);

  const missingSessionOperatorDiagnostic = operatorErrorDiagnostic({
    kind: "operator_error",
    payload: {
      operation: "shutdown_session",
      code: "session_not_found",
      message: "unknown session: missing-real-hub-session"
    }
  });
  const missingSessionActionDiagnostic = actionFailureDiagnostic(
    { id: "botster.session.rename", target: "missing-real-hub-session" },
    { accepted: false, reason: "unknown session: missing-real-hub-session" }
  );
  const missingSessionFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [missingSessionOperatorDiagnostic, missingSessionActionDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Packaged runtime attached to real hub bridge"
    })
  );
  assert.match(missingSessionFirstScreenMarkup, /<h3>Spawn action<\/h3><ion-badge color="medium">Ready/);
  assert.match(missingSessionFirstScreenMarkup, new RegExp(`Creates ${realHubDogfoodSessionId}`));
  assert.doesNotMatch(missingSessionFirstScreenMarkup, /<h3>Spawn action<\/h3><ion-badge color="danger">Blocked/);
  assert.doesNotMatch(missingSessionFirstScreenMarkup, /unknown session: missing-real-hub-session/);

  const nonSpawnHubActionDiagnostic = hubConnectionDiagnosticFromFrame({
    kind: "connection_diagnostic",
    payload: {
      kind: "action_failure",
      operation: "rename",
      message: "unknown session: missing-real-hub-session"
    }
  });
  const nonSpawnHubActionFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [nonSpawnHubActionDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "Packaged runtime attached to real hub bridge"
    })
  );
  assert.match(nonSpawnHubActionFirstScreenMarkup, /<h3>Spawn action<\/h3><ion-badge color="medium">Ready/);
  assert.doesNotMatch(nonSpawnHubActionFirstScreenMarkup, /unknown session: missing-real-hub-session/);

  const primaryActionFailureDiagnostic = actionFailureDiagnostic(
    { id: "botster.session.select", target: realHubDogfoodSessionId },
    { accepted: false, reason: "spawn action rejected" }
  );
  const primaryActionFailedFirstScreenMarkup = renderToStaticMarkup(
    createElement(DogfoodFirstScreen, {
      mode: "real-hub",
      statusText: "Packaged runtime attached to real hub bridge",
      diagnostics: [primaryActionFailureDiagnostic],
      packages: [{ id: "botster-web", status: "enabled", entrypoint_process_summary: "web-client running" }],
      packageLoadStatus: "loaded",
      sessions: [],
      sessionLoadStatus: "loaded",
      actionStatus: "spawn action rejected"
    })
  );
  assert.match(primaryActionFailedFirstScreenMarkup, /<h3>Spawn action<\/h3><ion-badge color="warning">Blocked/);
  assert.match(primaryActionFailedFirstScreenMarkup, /spawn action rejected/);

  const diagnosticsMarkup = renderToStaticMarkup(
    createElement(ConnectionDiagnosticsPanel, {
      diagnostics: [
        bridgeUnavailableDiagnostic(new Error("connect ECONNREFUSED")),
        mismatchedSchemaDiagnostic,
        ...runtimeDiagnostics,
        hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "compatibility_mismatch")),
        hubConnectionDiagnosticFromFrame(hubDiagnosticFrames.find((frame) => frame.payload.kind === "action_failure")),
        spawnFailureOperatorDiagnostic,
        spawnFailureHubDiagnostic,
        descriptorUnavailableDiagnostic,
        protocolMismatchDiagnostic,
        missingCapabilityDiagnostic,
        compatibleDescriptorDiagnostic,
        streamDisconnectedDiagnostic(new Error("SSE closed")),
        actionFailureDiagnostic(
          { id: "botster.session.rename", target: "missing-real-hub-session" },
          { accepted: false, reason: "Session not found" }
        ),
        terminalUnavailableDiagnostic(terminalAttachError)
      ]
    })
  );
  assert.match(diagnosticsMarkup, /Connection diagnostics/);
  assert.match(diagnosticsMarkup, /Local hub bridge unavailable/);
  assert.match(diagnosticsMarkup, /Daemon schema mismatch/);
  assert.match(diagnosticsMarkup, /Hub connection established/);
  assert.match(diagnosticsMarkup, /Hub capability unsupported/);
  assert.match(diagnosticsMarkup, /Hub compatibility mismatch/);
  assert.match(diagnosticsMarkup, /Hub action failed/);
  assert.match(diagnosticsMarkup, new RegExp(spawnFailureDiagnosticMessage));
  assert.match(diagnosticsMarkup, /runtime failed while handling Spawn: Runtime/);
  assert.match(diagnosticsMarkup, /Capability: terminal_streaming/);
  assert.match(diagnosticsMarkup, /Operation: spawn/);
  assert.match(diagnosticsMarkup, /Hub compatibility descriptor compatible/);
  assert.match(diagnosticsMarkup, /Hub compatibility descriptor unavailable/);
  assert.match(diagnosticsMarkup, /Hub protocol mismatch/);
  assert.match(diagnosticsMarkup, /Hub capability missing/);
  assert.match(diagnosticsMarkup, /Control stream disconnected/);
  assert.match(diagnosticsMarkup, /Action failed/);
  assert.match(diagnosticsMarkup, /Terminal stream unavailable/);
  assert.match(diagnosticsMarkup, /data-diagnostic-id="terminal-unavailable"/);
  assert.match(diagnosticsMarkup, /Blocked \/ bridge/);
  assert.match(diagnosticsMarkup, /Warning \/ action/);
  assert.match(diagnosticsMarkup, /Healthy \/ compatibility/);
  assert.ok(
    diagnosticsMarkup.indexOf("Local hub bridge unavailable") < diagnosticsMarkup.indexOf("Hub action failed"),
    "danger diagnostics should render before warning diagnostics"
  );

  const transitionedDiagnosticsMarkup = renderToStaticMarkup(
    createElement(ConnectionDiagnosticsPanel, {
      diagnostics: transitionedCompatibilityDiagnostics
    })
  );
  assert.match(transitionedDiagnosticsMarkup, /Hub compatibility descriptor compatible/);
  assert.doesNotMatch(transitionedDiagnosticsMarkup, /Hub compatibility descriptor unavailable/);
  assert.equal((transitionedDiagnosticsMarkup.match(/data-diagnostic-id="hub-compatibility"/g) ?? []).length, 1);
} finally {
  await vite.close();
}

console.log("Renderer seam, runtime behavior, and registry fixture assertions passed.");

async function startPackageBridgeRuntime({ launchResult = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "botster-web-package-runtime-"));
  const socketPath = join(root, "botster-hub.sock");
  const launchResultPath = join(root, "launch-result.json");
  const port = await findAvailablePort();
  const daemonRequests = [];
  await mkdir(join(root, "dist", "assets"), { recursive: true });
  await Promise.all([
    writeFile(
      join(root, "dist", "index.html"),
      '<!doctype html><html><head><title>botster package runtime</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>'
    ),
    writeFile(join(root, "dist", "assets", "app.js"), 'console.log("package asset");')
  ]);

  const daemon = createNetServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    let handshakeComplete = false;
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) {
          const frame = JSON.parse(line);
          if (!handshakeComplete) {
            assert.deepEqual(frame, { protocol: "botster-hub-daemon-v1" });
            handshakeComplete = true;
            socket.write(`${JSON.stringify({ protocol: "botster-hub-daemon-v1" })}\n`);
          } else {
            daemonRequests.push(frame);
            if (frame.type === "status") {
              socket.write(
                `${JSON.stringify({
                  kind: "status",
                  status: { lifecycle_state: "running", schema_version: 1 },
                  events: []
                })}\n`
              );
            } else {
              socket.write(`${JSON.stringify({ kind: "events", events: [] })}\n`);
            }
          }
        }
        newline = buffer.indexOf("\n");
      }
    });
  });

  await new Promise((resolve, reject) => {
    daemon.once("error", reject);
    daemon.listen(socketPath, () => {
      daemon.off("error", reject);
      resolve();
    });
  });

  const bridgeProcess = spawn(
    process.execPath,
    [new URL("../scripts/real-hub-dogfood-bridge.mjs", import.meta.url).pathname],
    {
      cwd: root,
      env: {
        ...process.env,
        BOTSTER_HUB_SOCKET: socketPath,
        BOTSTER_WEB_DOGFOOD_BRIDGE_PORT: String(port),
        ...(launchResult ? { BOTSTER_ENTRYPOINT_LAUNCH_RESULT: launchResultPath } : {})
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stdout = "";
  let stderr = "";
  bridgeProcess.stdout.setEncoding("utf8");
  bridgeProcess.stderr.setEncoding("utf8");
  bridgeProcess.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  bridgeProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await waitForHttpOk(`http://127.0.0.1:${port}/health`, () => {
    if (bridgeProcess.exitCode !== null) {
      throw new Error(`bridge exited before readiness: stdout=${stdout} stderr=${stderr}`);
    }
  });

  return {
    origin: `http://127.0.0.1:${port}`,
    launchResultPath: launchResult ? launchResultPath : undefined,
    daemonRequests,
    async stop() {
      bridgeProcess.kill("SIGTERM");
      await Promise.race([
        once(bridgeProcess, "exit"),
        new Promise((resolve) => setTimeout(resolve, 1_000))
      ]);
      daemon.close();
      await once(daemon, "close");
      await rm(root, { recursive: true, force: true });
    }
  };
}

async function readLaunchResult(path) {
  const deadline = Date.now() + 2_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError ?? new Error("timed out waiting for launch result");
}

async function findAvailablePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, hostForTests, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

async function waitForHttpOk(url, assertStillRunning) {
  const deadline = Date.now() + 5_000;
  let lastError;
  while (Date.now() < deadline) {
    assertStillRunning();
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError ?? new Error(`timed out waiting for ${url}`);
}

async function compileTsModule(sourcePath, outputPath) {
  const source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  });

  await writeFile(outputPath, result.outputText);
}

function deterministicIds(prefix) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForTestCondition(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("timed out waiting for test condition");
}

function createFakeDataChannel() {
  const listeners = new Map();
  return {
    readyState: "connecting",
    sent: [],
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((entry) => entry !== listener)
      );
    },
    send(data) {
      this.sent.push(data);
    },
    open() {
      this.readyState = "open";
      for (const listener of listeners.get("open") ?? []) listener({});
    },
    close() {
      if (this.readyState === "closed") return;
      this.readyState = "closed";
      for (const listener of listeners.get("close") ?? []) listener({});
    },
    emitMessage(data) {
      for (const listener of listeners.get("message") ?? []) listener({ data });
    }
  };
}

function createFakePeerConnection(dataChannel) {
  return {
    iceGatheringState: "complete",
    localDescription: { type: "offer", sdp: "offer-sdp", toJSON: () => ({ type: "offer", sdp: "offer-sdp" }) },
    createDataChannel() {
      return dataChannel;
    },
    async createOffer() {
      return this.localDescription;
    },
    async setLocalDescription(description) {
      this.localDescription = description;
    },
    async setRemoteDescription() {
      dataChannel.open();
    },
    close() {},
    addEventListener() {},
    removeEventListener() {}
  };
}

async function encryptTestEnvelope(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToArrayBuffer(secret.slice("secret-".length)),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return JSON.stringify({
    nonce: Buffer.from(nonce).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    version: 1
  });
}

async function decryptTestEnvelope(secret, envelopeJson) {
  const envelope = JSON.parse(envelopeJson);
  const key = await crypto.subtle.importKey(
    "raw",
    hexToArrayBuffer(secret.slice("secret-".length)),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(envelope.nonce) },
    key,
    base64ToArrayBuffer(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function waitForEncryptedRequest(dataChannel, secret, predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const envelope of dataChannel.sent) {
      const request = await decryptTestEnvelope(secret, envelope);
      if (predicate(request)) {
        return request;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("timed out waiting for encrypted WebRTC request");
}

function hexToArrayBuffer(encoded) {
  const bytes = new Uint8Array(encoded.length / 2);
  for (let index = 0; index < encoded.length; index += 2) {
    bytes[index / 2] = Number.parseInt(encoded.slice(index, index + 2), 16);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function base64ToArrayBuffer(encoded) {
  const bytes = Buffer.from(encoded, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function runNodeScript(scriptUrl, env = {}) {
  const child = spawn(process.execPath, [scriptUrl.pathname], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code, signal] = await once(child, "exit");
  return { code, signal, stdout, stderr };
}

function extractTopLevelCssRule(source, selector) {
  const ruleBodies = [];
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(source)) !== null) {
    const selectors = match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) {
      ruleBodies.push(match[2]);
    }
  }

  assert.ok(ruleBodies.length > 0, `expected CSS rule for ${selector}`);
  return ruleBodies.join("\n");
}

function extractCssAtRule(source, atRule) {
  const atRuleStart = source.indexOf(atRule);
  assert.notEqual(atRuleStart, -1, `expected CSS at-rule ${atRule}`);
  const blockStart = source.indexOf("{", atRuleStart);
  assert.notEqual(blockStart, -1, `expected CSS block for ${atRule}`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(blockStart + 1, index);
      }
    }
  }

  assert.fail(`expected closing brace for ${atRule}`);
}

function removeCssAtRules(source) {
  let remaining = source;
  let atRuleStart = remaining.indexOf("@");

  while (atRuleStart !== -1) {
    const blockStart = remaining.indexOf("{", atRuleStart);
    assert.notEqual(blockStart, -1, "expected CSS at-rule block");

    let depth = 0;
    let blockEnd = -1;
    for (let index = blockStart; index < remaining.length; index += 1) {
      if (remaining[index] === "{") {
        depth += 1;
      } else if (remaining[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blockEnd = index + 1;
          break;
        }
      }
    }

    assert.notEqual(blockEnd, -1, "expected closing brace for CSS at-rule");
    remaining = `${remaining.slice(0, atRuleStart)}${remaining.slice(blockEnd)}`;
    atRuleStart = remaining.indexOf("@");
  }

  return remaining;
}
