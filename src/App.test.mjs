import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [main, app, host, frames] = await Promise.all([
  readFile(new URL("./main.tsx", import.meta.url), "utf8"),
  readFile(new URL("./App.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/UiFrameHost.tsx", import.meta.url), "utf8"),
  readFile(new URL("./botster/frames.ts", import.meta.url), "utf8")
]);

assert.match(main, /import App from "\.\/App"/);
assert.match(main, /<App \/>/);
assert.match(app, /import \{ UiFrameHost \} from "\.\/botster\/UiFrameHost"/);
assert.match(app, /import \{ placeholderFrameSet \} from "\.\/botster\/frames"/);
assert.match(app, /<UiFrameHost frameSet=\{placeholderFrameSet\} \/>/);
assert.match(host, /data-testid="ui-frame-host"/);
assert.match(frames, /kind: "uinode"/);
assert.match(frames, /kind: "action"/);
assert.match(frames, /kind: "entity"/);

console.log("Renderer seam wiring assertions passed.");
