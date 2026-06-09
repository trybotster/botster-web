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
  protocol,
  entities,
  uiNodes,
  actions,
  terminal,
  resttyRenderer,
  terminalHost,
  terminalSmokeFixture,
  pluginSurfaces,
  architecture,
  readme,
  css,
  vendorReadme
] = await Promise.all([
  readFile(new URL("./main.tsx", import.meta.url), "utf8"),
  readFile(new URL("./App.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/client.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/protocol.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/entities.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/uiNodes.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminal.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/resttyRenderer.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/TerminalViewHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/terminalSmokeFixture.ts", import.meta.url), "utf8"),
  readFile(new URL("./botster/pluginSurfaces.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("./theme/app.css", import.meta.url), "utf8"),
  readFile(new URL("./vendor/restty/README.md", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiNodeSurface \} from "\.\/botster\/UiNodeSurface"/);
assert.match(app, /import \{ TerminalViewHost \} from "\.\/botster\/TerminalViewHost"/);
assert.match(app, /import \{ botsterWebClientContract \} from "\.\/botster\/client"/);
assert.match(app, /fixtureEntityFrames/);
assert.match(app, /uiNodeConformanceSnapshot/);
assert.match(app, /createInMemoryEntityFrameStore\(fixtureEntityFrames\)/);
assert.match(app, /botsterWebClientContract\.label/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.match(app, /<UiNodeSurface/);
assert.match(app, /<TerminalViewHost \/>/);
assert.doesNotMatch(app, /terminal-placeholder/);
assert.match(client, /export const botsterWebClientContract/);
assert.match(client, /createBotsterWebClient/);
assert.match(client, /"terminal_view bridge"/);
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
assert.match(architecture, /external botster-core/);
assert.match(readme, /vendored build from the trybotster\/restty fork/);
assert.match(css, /\.workspace-grid/);
assert.match(css, /\.terminal-panel/);
assert.match(css, /overflow: hidden/);
assert.match(vendorReadme, /e9742252312ee616d8f186b697d70349cf329250/);
assert.doesNotMatch(uiNodes, /terminal_view/);
assert.doesNotMatch(protocol, /terminal_input|terminal_output|terminal_resize|pty_bytes/);

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
  compileTsModule("botster/entities.ts", join(compiledRoot, "botster/entities.js")),
  compileTsModule("botster/protocol.ts", join(compiledRoot, "botster/protocol.js"))
]);

const requireRuntime = createRequire(join(compiledRoot, "runtime-test.cjs"));
const { createBotsterWebClient } = requireRuntime("./botster/client.js");

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
    { createInMemoryEntityFrameStore }
  ] = await Promise.all([
    vite.ssrLoadModule("/src/botster/IonicUiNodeRenderer.tsx"),
    vite.ssrLoadModule("/src/botster/__fixtures__/uiNodeConformance.ts"),
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
