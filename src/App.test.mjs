import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

const [
  main,
  app,
  client,
  dogfoodMode,
  localDogfoodTransport,
  realHubDaemonDto,
  realHubDogfoodTransport,
  realHubTerminalDataPlane,
  protocol,
  entities,
  uiNodes,
  actions,
  terminal,
  resttyRenderer,
  terminalHost,
  terminalSmokeFixture,
  pluginSurfaces,
  dogfoodBridgeScript,
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
  readFile(new URL("./botster/realHubDogfoodTransport.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/realHubTerminalDataPlane.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/entities.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/uiNodes.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminal.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/resttyRenderer.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/TerminalViewHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminalSmokeFixture.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/pluginSurfaces.ts", import.meta.url), "utf8"),
  readFile(new URL("../scripts/real-hub-dogfood-bridge.mjs", import.meta.url), "utf8"),
  readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("./theme/app.css", import.meta.url), "utf8"),
  readFile(new URL("./vendor/restty/README.md", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiNodeSurface \} from "\.\/botster\/UiNodeSurface"/);
assert.match(app, /import \{ TerminalViewHost \} from "\.\/botster\/TerminalViewHost"/);
assert.match(app, /createBotsterWebClient/);
assert.match(app, /createDogfoodRuntimeConfig/);
assert.match(app, /runtimeClient\.hub\.subscribeSurface/);
assert.match(app, /runtimeClient\.entities\.pull/);
assert.match(app, /surfaceSnapshot \?\? loadingSnapshot/);
assert.doesNotMatch(app, /fixtureEntityFrames/);
assert.doesNotMatch(app, /uiNodeConformanceSnapshot/);
assert.doesNotMatch(app, /createInMemoryEntityFrameStore\(fixtureEntityFrames\)/);
assert.match(app, /botsterWebClientContract\.label/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.match(app, /<UiNodeSurface/);
assert.match(app, /onAction=\{dispatchAction\}/);
assert.match(app, /dataPlane=\{dogfoodRuntime\.terminalDataPlane\}/);
assert.match(app, /descriptor=\{dogfoodRuntime\.terminalDescriptor\}/);
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
assert.match(dogfoodMode, /createRealHubDogfoodTransport/);
assert.match(dogfoodMode, /createRealHubTerminalDataPlane/);
assert.match(realHubDaemonDto, /export type DaemonRequest/);
assert.match(realHubDaemonDto, /type: "status"/);
assert.match(realHubDaemonDto, /type: "spawn"/);
assert.match(realHubDaemonDto, /export interface DaemonResponse/);
assert.match(realHubDaemonDto, /export type DaemonEvent/);
assert.match(realHubDogfoodTransport, /kind: "daemon_request"/);
assert.match(realHubDogfoodTransport, /reply\.kind !== "daemon_response"/);
assert.match(realHubDogfoodTransport, /daemonResponseFrames/);
assert.match(realHubDogfoodTransport, /realHubDogfoodUiTreeSnapshot/);
assert.match(realHubTerminalDataPlane, /streamTerminal/);
assert.match(realHubTerminalDataPlane, /type: "send_input"/);
assert.match(realHubTerminalDataPlane, /type: "detach"/);
assert.match(dogfoodBridgeScript, /protocol = "botster-hub-daemon-v1"/);
assert.match(dogfoodBridgeScript, /BOTSTER_HUB_BIN/);
assert.match(dogfoodBridgeScript, /kind: "daemon_response"/);
assert.match(dogfoodBridgeScript, /text\/event-stream/);
assert.match(dogfoodBridgeScript, /sendSseEvent\(response, "daemon_event"/);
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
assert.match(terminal, /renderer: "restty"/);
assert.match(terminal, /class DefaultTerminalViewBridge/);
assert.match(terminal, /TerminalViewMount/);
assert.match(terminal, /attach\(/);
assert.match(terminal, /detach\(/);
assert.match(terminal, /writeInput\(/);
assert.match(terminal, /subscribeOutput/);
assert.match(terminal, /renderer\.destroy\(\)/);
assert.match(resttyRenderer, /from "\.\.\/vendor\/restty\/xterm\.js"/);
assert.match(resttyRenderer, /new ResttyTerminal/);
assert.match(resttyRenderer, /this\.terminal\.dispose\(\)/);
assert.match(terminalHost, /ResizeObserver/);
assert.match(terminalHost, /bridge\.attach/);
assert.match(terminalHost, /bridge\.unmount/);
assert.match(terminalHost, /terminalMount/);
assert.match(terminalSmokeFixture, /runTerminalViewBridgeSmokeFixture/);
assert.match(terminalSmokeFixture, /emitInput\("ls\\n"\)/);
assert.match(terminalSmokeFixture, /dataPlane\.emitOutput\("ok\\r\\n"\)/);
assert.match(terminalSmokeFixture, /bridge\.resize\(descriptor, 24, 80\)/);
assert.match(terminalSmokeFixture, /bridge\.unmount\(descriptor\)/);
assert.match(pluginSurfaces, /sandbox: "host_rendered" \| "isolated_asset"/);
assert.match(architecture, /Control-plane hub frames/);
assert.match(architecture, /Terminal data-plane/);
assert.match(architecture, /Restty-backed `terminal_view`/);
assert.match(architecture, /botster-hub-client/);
assert.match(readme, /vendored build from the trybotster\/restty fork/);
assert.match(readme, /VITE_BOTSTER_REAL_HUB_DOGFOOD=1/);
assert.match(readme, /BOTSTER_HUB_BIN/);
assert.match(css, /\.workspace-grid/);
assert.match(css, /\.terminal-panel/);
assert.match(css, /overflow: hidden/);
assert.match(vendorReadme, /e9742252312ee616d8f186b697d70349cf329250/);
assert.doesNotMatch(uiNodes, /terminal_view/);
assert.doesNotMatch(protocol, /terminal_input|terminal_output|terminal_resize|pty_bytes/);
assert.doesNotMatch(localDogfoodTransport, /terminal_input|terminal_output|terminal_resize|pty_bytes/);
assert.doesNotMatch(realHubDogfoodTransport, /terminal_input|terminal_output|terminal_resize|pty_bytes/);

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
assert.ok(smoke.secondRenderer);
assert.ok(smoke.lifecycle.indexOf("destroy") < smoke.lifecycle.lastIndexOf("create"));
assert.doesNotMatch(smoke.firstRenderer.writes.join(""), /stale/);
assert.doesNotMatch(smoke.dataPlane.inputs.join(""), /stale/);

const compiledRoot = join(tmpdir(), "botster-web-runtime-test");
await rm(compiledRoot, { recursive: true, force: true });
await mkdir(join(compiledRoot, "botster"), { recursive: true });

await Promise.all([
  compileTsModule("botster/actions.ts", join(compiledRoot, "botster/actions.js")),
  compileTsModule("botster/capabilities.ts", join(compiledRoot, "botster/capabilities.js")),
  compileTsModule("botster/client.ts", join(compiledRoot, "botster/client.js")),
  compileTsModule("botster/dogfoodMode.ts", join(compiledRoot, "botster/dogfoodMode.js")),
  compileTsModule("botster/entities.ts", join(compiledRoot, "botster/entities.js")),
  compileTsModule("botster/localDogfoodTransport.ts", join(compiledRoot, "botster/localDogfoodTransport.js")),
  compileTsModule("botster/protocol.ts", join(compiledRoot, "botster/protocol.js")),
  compileTsModule("botster/realHubDaemonDto.ts", join(compiledRoot, "botster/realHubDaemonDto.js")),
  compileTsModule("botster/realHubDogfoodTransport.ts", join(compiledRoot, "botster/realHubDogfoodTransport.js")),
  compileTsModule("botster/realHubTerminalDataPlane.ts", join(compiledRoot, "botster/realHubTerminalDataPlane.js")),
  compileTsModule("botster/terminal.ts", join(compiledRoot, "botster/terminal.js"))
]);

const requireRuntime = createRequire(join(compiledRoot, "runtime-test.cjs"));
const { createBotsterWebClient } = requireRuntime("./botster/client.js");
const { createLocalDogfoodTransport } = requireRuntime("./botster/localDogfoodTransport.js");
const { createDogfoodRuntimeConfig } = requireRuntime("./botster/dogfoodMode.js");
const {
  createHttpDaemonBridgeClient,
  createRealHubDogfoodTransport,
  daemonResponseFrames,
  realHubDogfoodSessionId
} = requireRuntime("./botster/realHubDogfoodTransport.js");
const { createRealHubTerminalDataPlane } = requireRuntime("./botster/realHubTerminalDataPlane.js");

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
          stale_sessions: []
        },
        sessions: [],
        events: []
      };
    }

    if (request.type === "list_sessions") {
      return {
        kind: "sessions",
        sessions: [{ session_id: realHubDogfoodSessionId, lifecycle: "running" }],
        events: []
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
await realTransport.send({
  kind: "action_request",
  payload: {
    request_id: "real-action-1",
    origin: "ui_node",
    action: { id: "botster.session.select", target: realHubDogfoodSessionId }
  }
});
await flushMicrotasks();
assert.equal(bridgeRequests.some((request) => request.type === "status"), true);
assert.equal(bridgeRequests.some((request) => request.type === "list_sessions"), true);
assert.equal(bridgeRequests.some((request) => request.type === "spawn" && request.session_id === realHubDogfoodSessionId), true);
assert.equal(realFrames.some((frame) => frame.kind === "ui_tree_snapshot"), true);
assert.equal(realFrames.some((frame) => frame.kind === "entity_snapshot"), true);
assert.equal(realFrames.some((frame) => frame.kind === "entity_patch"), true);
assert.equal(realFrames.some((frame) => frame.kind === "action_result"), true);

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

const terminalDataPlane = createRealHubTerminalDataPlane({
  bridge
});
const terminalOutput = [];
const terminalSubscription = terminalDataPlane.subscribeOutput((data) => terminalOutput.push(data));
await flushMicrotasks();
await terminalDataPlane.writeInput("ping\n");
await terminalDataPlane.resize(24, 80);
terminalSubscription.unsubscribe();
await terminalDataPlane.detach();
assert.equal(bridgeTerminalStreams.some((stream) => stream.sessionId === realHubDogfoodSessionId), true);
assert.equal(bridgeRequests.some((request) => request.type === "send_input" && request.data === "ping\n"), true);
assert.equal(bridgeRequests.some((request) => request.type === "resize" && request.rows === 24 && request.cols === 80), true);
assert.equal(bridgeRequests.some((request) => request.type === "detach"), true);
assert.equal(bridgeTerminalStreams.some((stream) => stream.unsubscribed === true), true);
assert.equal(terminalOutput.some((data) => data.includes("botster-web-dogfood-ready")), true);

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
    { createInMemoryEntityFrameStore }
  ] = await Promise.all([
    vite.ssrLoadModule("/src/botster/IonicUiNodeRenderer.tsx"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
    vite.ssrLoadModule("/src/botster/localDogfoodTransport.ts"),
    vite.ssrLoadModule("/src/botster/entities.ts")
  ]);

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
} finally {
  await vite.close();
}

console.log("Renderer seam, runtime behavior, and registry fixture assertions passed.");

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
