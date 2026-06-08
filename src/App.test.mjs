import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [main, app, host, frames, client, protocol, entities, uiNodes, actions, terminal, pluginSurfaces, architecture, readme] = await Promise.all([
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
  readFile(new URL("./botster/pluginSurfaces.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiFrameHost \} from "\.\/botster\/UiFrameHost"/);
assert.match(app, /import \{ botsterWebClientContract \} from "\.\/botster\/client"/);
assert.match(app, /import \{ placeholderFrameSet \} from "\.\/botster\/frames"/);
assert.match(app, /botsterWebClientContract\.label/);
assert.match(app, /botsterWebClientContract\.seams\.map/);
assert.match(app, /<UiFrameHost frameSet=\{placeholderFrameSet\} \/>/);
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
assert.match(pluginSurfaces, /sandbox: "host_rendered" \| "isolated_asset"/);
assert.match(architecture, /Control-plane hub frames/);
assert.match(architecture, /Terminal data-plane/);
assert.match(architecture, /external botster-core/);
assert.match(readme, /Future Rails or cloud hosting/);

console.log("Renderer seam wiring assertions passed.");
