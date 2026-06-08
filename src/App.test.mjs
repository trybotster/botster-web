import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [
  main,
  app,
  host,
  frames,
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
  readFile(new URL("./botster/UiFrameHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/frames.ts", import.meta.url), "utf8"),
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
assert.match(app, /import \{ UiFrameHost \} from "\.\/botster\/UiFrameHost"/);
assert.match(app, /import \{ TerminalViewHost \} from "\.\/botster\/TerminalViewHost"/);
assert.match(app, /import \{ botsterWebClientContract \} from "\.\/botster\/client"/);
assert.match(app, /import \{ placeholderFrameSet \} from "\.\/botster\/frames"/);
assert.match(app, /botsterWebClientContract\.label/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.match(app, /<UiFrameHost frameSet=\{placeholderFrameSet\} \/>/);
assert.match(app, /<TerminalViewHost \/>/);
assert.doesNotMatch(app, /terminal-placeholder/);
assert.match(host, /data-testid="ui-frame-host"/);
assert.match(frames, /ui_tree_snapshot/);
assert.match(frames, /entity_snapshot \/ upsert \/ patch \/ remove/);
assert.match(client, /export const botsterWebClientContract/);
assert.match(client, /"terminal_view bridge"/);
assert.match(protocol, /type HubControlFrameKind/);
assert.match(protocol, /"ui_tree_snapshot"/);
assert.match(protocol, /"entity_snapshot"/);
assert.match(entities, /replayActivePulls/);
assert.match(uiNodes, /render\(snapshot: UiTreeSnapshot, entities: EntityFrameStore\)/);
assert.match(actions, /botster\.session\.select/);
assert.doesNotMatch(actions, /click|submit|change/);
assert.match(terminal, /renderer: "restty"/);
assert.match(terminal, /class DefaultTerminalViewBridge/);
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

console.log("Renderer seam wiring assertions passed.");
