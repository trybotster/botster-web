import { chromium } from "playwright";
import { createServer } from "vite";

const host = "127.0.0.1";
const probe = "botster-web-mounted-keyboard-input";
const echo = `botster-web-mounted-keyboard-echo:${probe}`;
const fullLine = `${probe}\n`;
const finalOutput = "botster-web-mounted-final-output\r\n";

let vite;
let browser;

try {
  vite = await createServer({
    server: {
      host,
      port: 0
    }
  });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("mounted terminal keyboard smoke could not resolve Vite address");
  }

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://${host}:${address.port}/mounted-terminal-keyboard-smoke.html`, {
    waitUntil: "domcontentloaded"
  });

  await page.waitForFunction(
    () => {
      const canvas = globalThis.document.querySelector(".terminal-view-container canvas");
      if (canvas?.tagName !== "CANVAS") return false;
      const bounds = canvas.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    },
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    () => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl?.focus),
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    () =>
      (globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.terminal ?? []).some(
        (entry) => entry.kind === "pty_connected"
      ),
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(1_000);

  await page.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl.focus());
  await page.locator(".terminal-view-container canvas").first().click({ position: { x: 10, y: 10 } });
  await page.evaluate((data) => {
    const target = globalThis.document.activeElement;
    if (!(target instanceof globalThis.HTMLTextAreaElement)) {
      throw new Error(`mounted terminal keyboard smoke expected Restty textarea focus, observed ${target?.tagName ?? "none"}`);
    }
    target.value = data;
    target.dispatchEvent(
      new globalThis.InputEvent("input", {
        inputType: "insertText",
        data,
        bubbles: true
      })
    );
  }, fullLine);

  await page.waitForFunction(
    ({ expectedProbe, expectedEcho }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      const writes = harness?.terminal ?? [];
      return (
        harness?.inputs?.length === 1 &&
        harness.inputs[0] === expectedProbe &&
        writes.some(
          (entry) =>
            entry.kind === "renderer_write" &&
            String(entry.payload?.data ?? "").includes(expectedEcho)
        )
      );
    },
    { expectedProbe: fullLine, expectedEcho: echo },
    { timeout: 15_000 }
  ).catch(async (error) => {
    const state = await page.evaluate(() => {
      const activeElement = globalThis.document.activeElement;
      return {
        activeElement: activeElement
          ? {
              tagName: activeElement.tagName,
              className: activeElement.getAttribute("class"),
              ariaLabel: activeElement.getAttribute("aria-label")
            }
          : null,
        harness: globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__,
        terminalControl: Object.keys(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl ?? {}),
        textareas: Array.from(globalThis.document.querySelectorAll("textarea")).map((textarea) => ({
          className: textarea.getAttribute("class"),
          value: textarea.value,
          ariaLabel: textarea.getAttribute("aria-label")
        }))
      };
    });
    throw new Error(`${error.message}\nmounted keyboard smoke state:\n${JSON.stringify(state, null, 2)}`);
  });

  await page.evaluate(() => {
    const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
    harness.emitStatus({ state: "attaching", message: "Still attaching" });
    harness.emitStatus({ state: "failed", message: "Synthetic attach failure" });
  });
  const exitsBeforeTerminalStatus = await page.evaluate(
    () => globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__.exitSessions
  );
  if (exitsBeforeTerminalStatus.length !== 0) {
    throw new Error(`non-exited terminal status invoked onExit: ${JSON.stringify(exitsBeforeTerminalStatus)}`);
  }

  await page.evaluate((output) => {
    const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
    harness.emitOutput(output);
    harness.emitStatus({ state: "exited", message: "Synthetic process exit" });
    harness.emitStatus({ state: "exited", message: "Duplicate synthetic process exit" });
  }, finalOutput);
  await page.waitForFunction(
    ({ output, sessionId }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return (
        harness.exitSessions.length === 1 &&
        harness.exitSessions[0] === sessionId &&
        harness.callbackOrder.indexOf(`output:${output}`) <
          harness.callbackOrder.indexOf(`exit:${sessionId}`)
      );
    },
    { output: finalOutput, sessionId: "mounted_keyboard_smoke_session" },
    { timeout: 15_000 }
  );

  console.log("mounted terminal keyboard and exit-order smoke passed");
} finally {
  await browser?.close();
  await vite?.close();
}
