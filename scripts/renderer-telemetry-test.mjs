import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/botster/terminal.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createRendererWriteObserver, DefaultTerminalViewBridge } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const previousHarness = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
const previousBtoa = globalThis.btoa;
let encodings = 0;
globalThis.btoa = (value) => {
  encodings += 1;
  return Buffer.from(value, "binary").toString("base64");
};

async function mountFallback(write = () => undefined) {
  let output;
  const writes = [];
  const container = { dataset: {} };
  const descriptor = { sessionId: "telemetry-test", renderer: "restty" };
  const bridge = new DefaultTerminalViewBridge(() => ({
    mount() {},
    write(data) { writes.push(data); return write(data); },
    onInput() { return { unsubscribe() {} }; },
    resize() {},
    focus() {},
    destroy() {}
  }));
  await bridge.mount(container, descriptor);
  await bridge.attach(descriptor, {
    sessionId: descriptor.sessionId,
    writeInput() {},
    subscribeOutput(listener) {
      output = listener;
      return { unsubscribe() {} };
    },
    detach() {}
  });
  return { bridge, descriptor, output, writes, container };
}

try {
  delete globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  assert.equal(createRendererWriteObserver("production"), undefined);
  const production = await mountFallback();
  const bytes = new Uint8Array(65_536).fill(65);
  production.output(bytes);
  await Promise.resolve();
  assert.deepEqual(production.writes, [bytes]);
  assert.deepEqual(production.container.dataset, {});
  assert.equal(encodings, 0);
  await production.bridge.detach(production.descriptor);

  globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {};
  assert.equal(createRendererWriteObserver("no-recorder"), undefined);
  const harness = { terminal: [], suppressRendererWriteTelemetry: true };
  globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = harness;
  const instrumented = await mountFallback();
  instrumented.output(bytes);
  await Promise.resolve();
  assert.equal(encodings, 0);
  assert.deepEqual(harness.terminal, []);

  harness.suppressRendererWriteTelemetry = false;
  instrumented.output(bytes);
  await Promise.resolve();
  assert.equal(encodings, 1);
  assert.deepEqual(instrumented.container.dataset, {});
  assert.deepEqual(harness.terminal, [{
    kind: "renderer_write",
    payload: {
      payload_bytes_base64: Buffer.from(bytes).toString("base64"),
      bytes: bytes.byteLength,
      sessionId: "telemetry-test"
    }
  }]);

  globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { terminal: [] };
  instrumented.output(bytes);
  await Promise.resolve();
  assert.equal(encodings, 1);
  assert.deepEqual(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminal, []);
  await instrumented.bridge.detach(instrumented.descriptor);

  for (const outcome of ["complete", "suppress", "replace"]) {
    const recorder = { terminal: [] };
    globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = recorder;
    let finishWrite;
    const rendered = new Promise((resolve) => { finishWrite = resolve; });
    const delayed = await mountFallback(() => rendered);
    const before = encodings;
    delayed.output(bytes);
    await Promise.resolve();
    assert.equal(encodings, before, "Telemetry must wait for successful rendering.");
    if (outcome === "suppress") recorder.suppressRendererWriteTelemetry = true;
    if (outcome === "replace") globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = { terminal: [] };
    finishWrite();
    await Promise.resolve();
    assert.equal(encodings, before + (outcome === "complete" ? 1 : 0));
    assert.equal(recorder.terminal.length, outcome === "complete" ? 1 : 0);
    await delayed.bridge.detach(delayed.descriptor);
  }
  console.log("Renderer telemetry: production, suppression, collection, and recorder replacement passed.");
} finally {
  globalThis.btoa = previousBtoa;
  if (previousHarness === undefined) delete globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
  else globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__ = previousHarness;
}
