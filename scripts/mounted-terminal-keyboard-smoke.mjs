import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { verifyMountedRendererTelemetry } from "./mounted-renderer-telemetry.mjs";

const host = "127.0.0.1";
const probe = "botster-web-mounted-keyboard-input";
const echo = `botster-web-mounted-keyboard-echo:${probe}`;
const fullLine = `${probe}\n`;
const finalOutput = "botster-web-mounted-final-output\r\n";
const wheelScrollbackLane = process.env.BOTSTER_MOUNTED_WHEEL_SCROLLBACK === "1";
const historySeedPath = fileURLToPath(new URL("../fixtures/terminal-baseline/history-seed.sh", import.meta.url));
const WHEEL_LINE_EVENTS = 1;
const WHEEL_LINES = 3;
const HISTORY_LINE_BYTES = 80;
const HISTORY_LAST_LINE = 400;

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
  await verifyMountedRendererTelemetry(browser, `http://${host}:${address.port}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

  if (wheelScrollbackLane) {
    const history = execFileSync("sh", [historySeedPath], { encoding: "utf8" })
      .replace(/\n/g, "\r\n")
      .replace(/(?:\r\n)+$/, "");
    await page.evaluate((output) => {
      globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__.emitOutput(output);
    }, history);
    try {
      await page.waitForFunction(
        ({ expectedLine, lineBytes }) => {
          const numbered = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readNumberedHistory?.() ?? [];
          return numbered.some((row) => Number(row) === expectedLine && row.length === lineBytes);
        },
        { expectedLine: HISTORY_LAST_LINE, lineBytes: HISTORY_LINE_BYTES },
        { timeout: 15_000 }
      );
    } catch (error) {
      const state = await page.evaluate(() => {
        const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
        return {
          history: harness?.readNumberedHistory?.() ?? [],
          meta: harness?.viewportMeta?.(),
          inputs: harness?.inputs,
          terminalKinds: (harness?.terminal ?? []).map((entry) => entry.kind)
        };
      });
      throw new Error(`${error.message}\nG8 history state:\n${JSON.stringify(state, null, 2)}`, { cause: error });
    }
    await page.evaluate(() => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      harness.flushRender();
      harness.scrollViewportToBottom();
    });
    try {
      await page.waitForFunction(
        ({ expectedLine, lineBytes }) => {
          const rows = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readViewportRows?.() ?? [];
          return rows.at(-1) === String(expectedLine).padStart(lineBytes, "0");
        },
        { expectedLine: HISTORY_LAST_LINE, lineBytes: HISTORY_LINE_BYTES },
        { timeout: 15_000 }
      );
    } catch (error) {
      const state = await page.evaluate(() => {
        const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
        const rows = harness?.readViewportRows?.() ?? [];
        return {
          lastRows: rows.slice(-12),
          firstRows: rows.slice(0, 8),
          meta: harness?.viewportMeta?.(),
          cellHeight: harness?.readCellHeight?.(),
          inputs: harness?.inputs,
          terminalKinds: (harness?.terminal ?? []).map((entry) => entry.kind)
        };
      });
      throw new Error(`${error.message}\nG8 settle state:\n${JSON.stringify(state, null, 2)}`, { cause: error });
    }
    const settled = await page.evaluate(() => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return {
        rows: harness.readViewportRows(),
        cellHeight: harness.readCellHeight(),
        inputs: [...harness.inputs]
      };
    });
    const settledNumbered = settled.rows.filter((row) => /^\d+$/.test(row));
    const settledLast = Number(settled.rows.at(-1));
    if (settledLast !== HISTORY_LAST_LINE) {
      throw new Error(`settled viewport last line was ${settledLast}, expected ${HISTORY_LAST_LINE}`);
    }
    for (const row of settledNumbered) {
      if (row.length !== HISTORY_LINE_BYTES) {
        throw new Error(`settled line ${Number(row)} width ${row.length}, expected ${HISTORY_LINE_BYTES}`);
      }
    }
    const expectedLine = HISTORY_LAST_LINE - WHEEL_LINES * WHEEL_LINE_EVENTS;
    await page.evaluate((lineEvents) => {
      const canvas = globalThis.document.querySelector(".terminal-view-container canvas");
      const container = globalThis.document.querySelector(".terminal-view-container");
      const target = canvas ?? container;
      if (!(target instanceof globalThis.HTMLElement)) {
        throw new Error("mounted wheel scrollback lane has no wheel target");
      }
      for (let index = 0; index < lineEvents; index += 1) {
        target.dispatchEvent(
          new globalThis.WheelEvent("wheel", {
            deltaY: -1,
            deltaMode: 1,
            bubbles: true,
            cancelable: true
          })
        );
      }
    }, WHEEL_LINE_EVENTS);
    try {
      await page.waitForFunction(
        ({ lastLine, lineBytes }) => {
          const rows = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readViewportRows?.() ?? [];
          return rows.at(-1) === String(lastLine).padStart(lineBytes, "0");
        },
        { lastLine: expectedLine, lineBytes: HISTORY_LINE_BYTES },
        { timeout: 15_000 }
      );
    } catch (error) {
      const state = await page.evaluate(() => {
        const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
        const rows = harness?.readViewportRows?.() ?? [];
        return {
          lastRows: rows.slice(-12),
          firstRows: rows.slice(0, 8),
          meta: harness?.viewportMeta?.(),
          cellHeight: harness?.readCellHeight?.(),
          inputs: harness?.inputs
        };
      });
      throw new Error(`${error.message}\nG8 scroll state:\n${JSON.stringify(state, null, 2)}`, { cause: error });
    }
    const after = await page.evaluate(() => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return {
        rows: harness.readViewportRows(),
        inputs: [...harness.inputs]
      };
    });
    const afterNumbered = after.rows.filter((row) => /^\d+$/.test(row));
    const afterLast = Number(after.rows.at(-1));
    if (afterLast !== expectedLine) {
      throw new Error(`scrolled viewport last line was ${afterLast}, expected ${expectedLine}`);
    }
    for (const row of afterNumbered) {
      if (row.length !== HISTORY_LINE_BYTES) {
        throw new Error(`scrolled line ${Number(row)} width ${row.length}, expected ${HISTORY_LINE_BYTES}`);
      }
    }
    const esc = String.fromCharCode(0x1b);
    const wheelBytes = after.inputs.filter((data) =>
      data.includes(`${esc}[<64`) || data.includes(`${esc}[<65`) || data.startsWith(`${esc}[M`)
    );
    if (wheelBytes.length !== 0) {
      throw new Error(`G8 expected zero PTY wheel bytes, got ${JSON.stringify(wheelBytes)}`);
    }
    console.log("mounted terminal wheel scrollback smoke passed");
  } else {

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
        writes.some((entry) => {
          if (entry.kind !== "renderer_write") return false;
          const encoded = entry.payload?.payload_bytes_base64;
          if (typeof encoded !== "string") return false;
          try {
            return new TextDecoder().decode(
              Uint8Array.from(globalThis.atob(encoded), (char) => char.charCodeAt(0))
            ).includes(expectedEcho);
          } catch {
            return false;
          }
        })
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
  }
} finally {
  await browser?.close();
  await vite?.close();
}
