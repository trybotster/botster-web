import { strict as assert } from "node:assert";

export async function verifyMountedRendererTelemetry(browser, baseUrl) {
  for (const enabled of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    try {
      await page.goto(`${baseUrl}/mounted-terminal-keyboard-smoke.html?rendererTelemetry=${enabled ? "on" : "off"}`, {
        waitUntil: "domcontentloaded"
      });
      await page.waitForFunction(() => {
        const fixture = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
        return fixture?.outputSubscribers === 1 && fixture.viewportMeta().hasRuntime;
      }, undefined, { timeout: 15_000 }).catch(async (cause) => {
        const state = await page.evaluate(() => {
          const fixture = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
          return { subscribers: fixture?.outputSubscribers, rows: fixture?.readViewportRows(), meta: fixture?.viewportMeta() };
        });
        throw new Error(`Mounted telemetry readiness failed: ${JSON.stringify({ enabled, state, errors })}`, { cause });
      });

      for (const suppressed of enabled ? [false, true] : [false]) {
        const marker = `telemetry-${enabled ? "on" : "off"}-${suppressed ? "suppressed" : "visible"}`;
        const result = await page.evaluate(({ marker, suppressed }) => {
          const fixture = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
          const recorder = globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__;
          if (recorder) recorder.suppressRendererWriteTelemetry = suppressed;
          const payload = `${marker}\r\n`;
          const original = globalThis.btoa;
          let encodings = 0;
          globalThis.btoa = (value) => {
            if (value === payload) encodings += 1;
            return original(value);
          };
          const start = fixture.terminal.length;
          try {
            fixture.emitOutput(payload);
          } finally {
            globalThis.btoa = original;
          }
          return {
            encodings,
            writes: fixture.terminal.slice(start).filter((entry) => entry.kind === "renderer_write"),
            hasRecorder: Boolean(recorder)
          };
        }, { marker, suppressed });

        await page.waitForFunction((marker) =>
          globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__.readViewportRows().some((row) => row.includes(marker)),
        marker, { timeout: 15_000 });
        assert.equal(result.hasRecorder, enabled);
        assert.equal(result.encodings, enabled && !suppressed ? 1 : 0);
        assert.equal(result.writes.length, enabled && !suppressed ? 1 : 0);
        if (result.writes.length) {
          assert.equal(result.writes[0].payload.payload_bytes_base64, Buffer.from(`${marker}\r\n`).toString("base64"));
        }
        assert.equal(await page.locator("[data-terminal-last-rendered-output]").count(), 0);
      }
    } finally {
      await page.close();
    }
  }
  console.log("Mounted Restty telemetry: disabled, enabled, and suppressed collection passed.");
}
