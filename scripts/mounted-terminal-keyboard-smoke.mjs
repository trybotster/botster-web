import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { verifyMountedRendererTelemetry } from "./mounted-renderer-telemetry.mjs";
import { harnessWaitSupportScript, waitForDom } from "./harness-waits.mjs";

/** Restty is ready when its wasm terminal exists (the fixture reports ResttyWasm.create). */
const waitForMountedReady = (pageRef, label) => waitForDom(
  pageRef,
  () => pageRef.evaluate(() => globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.viewportMeta?.().hasRuntime === true),
  { label, deadlineMs: 15_000 }
);

const host = "127.0.0.1";
const probe = "botster-web-mounted-keyboard-input";
const echo = `botster-web-mounted-keyboard-echo:${probe}`;
const fullLine = `${probe}\n`;
const finalOutput = "botster-web-mounted-final-output\r\n";
const wheelScrollbackLane = process.env.BOTSTER_MOUNTED_WHEEL_SCROLLBACK === "1";
const clipboardPasteLane = process.env.BOTSTER_MOUNTED_PASTE === "1";
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
  await page.addInitScript({ content: harnessWaitSupportScript });
  await page.goto(`http://${host}:${address.port}/mounted-terminal-keyboard-smoke.html`, {
    waitUntil: "domcontentloaded"
  });

  await waitForDom(page, () => page.evaluate(() => {
      const canvas = globalThis.document.querySelector(".terminal-view-container canvas");
      if (canvas?.tagName !== "CANVAS") return false;
      const bounds = canvas.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    }, undefined), { label: "waitForMountedReady condition 1", deadlineMs: 15_000 });
  await waitForDom(page, () => page.evaluate(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl?.focus), undefined), { label: "waitForMountedReady condition 2", deadlineMs: 15_000 });
  await waitForDom(page, () => page.evaluate(() =>
      (globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.terminal ?? []).some(
        (entry) => entry.kind === "pty_connected"
      ), undefined), { label: "waitForMountedReady condition 3", deadlineMs: 15_000 });
  await waitForMountedReady(page, "mounted terminal ready line");

  if (clipboardPasteLane) {
    await proveMountedClipboardPaste(page, browser, `http://${host}:${address.port}`);
  } else if (wheelScrollbackLane) {
    const history = execFileSync("sh", [historySeedPath], { encoding: "utf8" })
      .replace(/\n/g, "\r\n")
      .replace(/(?:\r\n)+$/, "");
    await page.evaluate((output) => {
      globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__.emitOutput(output);
    }, history);
    try {
      await waitForDom(page, () => page.evaluate(({ expectedLine, lineBytes }) => {
          const numbered = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readNumberedHistory?.() ?? [];
          return numbered.some((row) => Number(row) === expectedLine && row.length === lineBytes);
        }, { expectedLine: HISTORY_LAST_LINE, lineBytes: HISTORY_LINE_BYTES }), { label: "waitForMountedReady condition 4", deadlineMs: 15_000 });
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
      await waitForDom(page, () => page.evaluate(({ expectedLine, lineBytes }) => {
          const rows = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readViewportRows?.() ?? [];
          return rows.at(-1) === String(expectedLine).padStart(lineBytes, "0");
        }, { expectedLine: HISTORY_LAST_LINE, lineBytes: HISTORY_LINE_BYTES }), { label: "waitForMountedReady condition 5", deadlineMs: 15_000 });
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
      await waitForDom(page, () => page.evaluate(({ lastLine, lineBytes }) => {
          const rows = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.readViewportRows?.() ?? [];
          return rows.at(-1) === String(lastLine).padStart(lineBytes, "0");
        }, { lastLine: expectedLine, lineBytes: HISTORY_LINE_BYTES }), { label: "waitForMountedReady condition 6", deadlineMs: 15_000 });
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
  await waitForDom(page, { locator: page.locator(".terminal-view-container canvas").first(), state: "actionable" }, { label: "page.locator('.terminal-view-container canvas').first() before click" });
  await page.locator(".terminal-view-container canvas").first().click({ position: { x: 10, y: 10 } });
  // A browser fires beforeinput before input for committed text. The container capture
  // consumes beforeinput; Restty's own input handler then encodes render-only bytes.
  await page.evaluate((data) => {
    const target = globalThis.document.activeElement;
    if (!(target instanceof globalThis.HTMLTextAreaElement)) {
      throw new Error(`mounted terminal keyboard smoke expected Restty textarea focus, observed ${target?.tagName ?? "none"}`);
    }
    target.value = data;
    target.dispatchEvent(
      new globalThis.InputEvent("beforeinput", {
        inputType: "insertText",
        data,
        bubbles: true,
        cancelable: true
      })
    );
    target.dispatchEvent(
      new globalThis.InputEvent("input", {
        inputType: "insertText",
        data,
        bubbles: true
      })
    );
  }, fullLine);

  await waitForDom(page, () => page.evaluate(({ expectedProbe, expectedEcho }) => {
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
    }, { expectedProbe: fullLine, expectedEcho: echo }), { label: "waitForMountedReady condition 7", deadlineMs: 15_000 }).catch(async (error) => {
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
  await waitForDom(page, () => page.evaluate(({ output, sessionId }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return (
        harness.exitSessions.length === 1 &&
        harness.exitSessions[0] === sessionId &&
        harness.callbackOrder.indexOf(`output:${output}`) <
          harness.callbackOrder.indexOf(`exit:${sessionId}`)
      );
    }, { output: finalOutput, sessionId: "mounted_keyboard_smoke_session" }), { label: "waitForMountedReady condition 8", deadlineMs: 15_000 });

  console.log("mounted terminal keyboard and exit-order smoke passed");
  }
} finally {
  await browser?.close();
  await vite?.close();
}

/**
 * Mounted clipboard paste through the real Restty renderer and the production capture path.
 * Every case dispatches a real DOM paste gesture on the focused Restty textarea. Nothing here
 * calls the paste owner directly, and no case infers paste from payload length.
 */
async function proveMountedClipboardPaste(page, browser, origin) {
  const largeText = `botster-web-mounted-paste:${"p".repeat(70_000)}\n`;
  const unicodeText = "héllo wörld — €12 😀 日本語 ✓\n".repeat(64);
  const unicodeBytes = Buffer.byteLength(unicodeText, "utf8");
  if (unicodeBytes <= unicodeText.length) throw new Error("unicode paste fixture must exceed its UTF-16 length");
  const menuText = "botster-web-mounted-context-menu-paste\n";

  const focusTerminal = async () => {
    await page.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl.focus());
    await waitForDom(page, { locator: page.locator(".terminal-view-container canvas").first(), state: "actionable" }, { label: "page.locator('.terminal-view-container canvas').first() before click" });
    await page.locator(".terminal-view-container canvas").first().click({ position: { x: 10, y: 10 } });
    await waitForDom(page, () => page.evaluate(() => globalThis.document.activeElement instanceof globalThis.HTMLTextAreaElement, undefined), { label: "focusTerminal condition 1", deadlineMs: 5_000 });
  };
  const dispatchPaste = (text) =>
    page.evaluate((data) => {
      const target = globalThis.document.activeElement;
      if (!(target instanceof globalThis.HTMLTextAreaElement)) {
        throw new Error(`mounted paste smoke expected Restty textarea focus, observed ${target?.tagName ?? "none"}`);
      }
      const transfer = new globalThis.DataTransfer();
      if (data) transfer.setData("text/plain", data);
      const event = new globalThis.ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true });
      const dispatched = target.dispatchEvent(event);
      return { dispatched, defaultPrevented: event.defaultPrevented };
    }, text);
  const readState = () =>
    page.evaluate(() => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      const terminal = harness?.terminal ?? [];
      return {
        pastes: harness.pastes.map((text) => ({ chars: text.length, text })),
        pasteOutcomes: harness.pasteOutcomes,
        inputs: [...harness.inputs],
        callbackOrder: [...harness.callbackOrder],
        ptySendInputs: terminal.filter((entry) => entry.kind === "restty_input_uncaptured").map((entry) => `${entry.payload?.source ?? ""}:${entry.payload?.bytes ?? 0}`),
        clipboardPastes: terminal.filter((entry) => entry.kind === "clipboard_paste").map((entry) => entry.payload),
        message: globalThis.document.querySelector(".terminal-input-message")?.textContent ?? null,
        messageOutcome: globalThis.document.querySelector(".terminal-input-message")?.getAttribute("data-terminal-input-outcome") ?? null
      };
    });
  const failWith = async (label, error) => {
    const state = await readState();
    throw new Error(`${label}: ${error.message}\nmounted paste smoke state:\n${JSON.stringify({
      ...state,
      pastes: state.pastes.map((entry) => ({ chars: entry.chars, head: entry.text.slice(0, 40) }))
    }, null, 2)}`, { cause: error });
  };

  await focusTerminal();

  // 1. 70,000-byte clipboard paste reaches the paste owner byte-identical, never the key path.
  const large = await dispatchPaste(largeText);
  if (!large.defaultPrevented) throw new Error("large paste was not consumed by the Botster capture handler");
  await waitForDom(page, () => page.evaluate(({ expected }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return harness.pastes.length === 1 && harness.pastes[0] === expected &&
        harness.pasteOutcomes.some((entry) => entry.outcome === "written" && entry.requestedBytes === expected.length && entry.writtenPtyBytes === expected.length);
    }, { expected: largeText }), { label: "failWith condition 1", deadlineMs: 15_000 }).catch((error) => failWith("large paste", error));
  let state = await readState();
  if (state.inputs.length !== 0 || state.ptySendInputs.length !== 0) {
    throw new Error(`large paste leaked into the key path: inputs=${state.inputs.length} pty_send_input=${state.ptySendInputs.length}`);
  }
  if (state.clipboardPastes.length !== 1 || state.clipboardPastes[0].chars !== largeText.length) {
    throw new Error(`expected exactly one clipboard_paste record, observed ${JSON.stringify(state.clipboardPastes)}`);
  }
  if (state.message !== null) throw new Error(`written paste must not leave an input message, observed ${state.message}`);

  // 2. Unicode paste: UTF-8 byte count exceeds UTF-16 length and text arrives byte-identical.
  await dispatchPaste(unicodeText);
  await waitForDom(page, () => page.evaluate(({ expected, expectedBytes }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return harness.pastes.length === 2 && harness.pastes[1] === expected &&
        harness.pasteOutcomes.filter((entry) => entry.outcome === "written" && entry.requestedBytes === expectedBytes && entry.writtenPtyBytes === expectedBytes).length === 1;
    }, { expected: unicodeText, expectedBytes: unicodeBytes }), { label: "failWith condition 2", deadlineMs: 15_000 }).catch((error) => failWith("unicode paste", error));

  // 3. Ordinary keys before and after a paste stay on the key path, in order.
  await page.keyboard.type("a", { delay: 10 });
  await dispatchPaste("P\n");
  await page.keyboard.type("b", { delay: 10 });
  await waitForDom(page, () => page.evaluate(() => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      const order = harness.callbackOrder;
      const a = order.indexOf("input:a");
      const paste = order.indexOf("paste:2");
      const b = order.indexOf("input:b");
      return a >= 0 && paste > a && b > paste && harness.pastes.length === 3;
    }, undefined), { label: "failWith condition 3", deadlineMs: 15_000 }).catch((error) => failWith("ordered keys around paste", error));
  state = await readState();
  if (state.inputs.some((data) => data.includes("P\n"))) throw new Error("paste text reached the key path during the ordering case");

  // 4. Empty clipboard text is not consumed by Botster; Restty's own handler still runs.
  const empty = await dispatchPaste("");
  if (!empty.defaultPrevented) throw new Error("empty paste should still be default-prevented by Restty's own handler");
  state = await readState();
  if (state.pastes.length !== 3 || state.clipboardPastes.length !== 3) {
    throw new Error(`empty paste must not create a paste operation: ${JSON.stringify({ pastes: state.pastes.length, records: state.clipboardPastes.length })}`);
  }

  // 5. Context-menu Paste routes to the paste owner; other items remain.
  await page.evaluate((text) => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => text, writeText: async () => undefined }
    });
  }, menuText);
  await waitForDom(page, { locator: page.locator(".terminal-view-container canvas").first(), state: "actionable" }, { label: "page.locator('.terminal-view-container canvas').first() before click" });
  await page.locator(".terminal-view-container canvas").first().click({ button: "right", position: { x: 20, y: 20 } });
  const menu = page.locator(".pane-context-menu");
  await waitForDom(page, { locator: menu, state: "visible" }, { label: "menu", deadlineMs: 5_000 });
  const menuLabels = await menu.locator(".pane-context-menu-item").allInnerTexts();
  if (!menuLabels.some((label) => label.startsWith("Copy")) || !menuLabels.some((label) => label.startsWith("Paste"))) {
    throw new Error(`context menu lost its default items: ${JSON.stringify(menuLabels)}`);
  }
  await waitForDom(page, { locator: menu.locator(".pane-context-menu-item").filter({ hasText: "Paste" }).first(), state: "actionable" }, { label: "menu.locator('.pane-context-menu-item').filter({ hasText: 'Paste' }... before click" });
  await menu.locator(".pane-context-menu-item").filter({ hasText: "Paste" }).first().click();
  await waitForDom(page, () => page.evaluate(({ expected }) => {
      const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
      return harness.pastes.length === 4 && harness.pastes[3] === expected &&
        (harness.terminal ?? []).some((entry) => entry.kind === "clipboard_paste" && entry.payload?.source === "context_menu");
    }, { expected: menuText }), { label: "failWith condition 4", deadlineMs: 15_000 }).catch((error) => failWith("context-menu paste", error));
  state = await readState();
  if (state.inputs.some((data) => data.includes("context-menu"))) throw new Error("context-menu paste reached the key path");

  console.log("mounted terminal clipboard paste smoke passed " + JSON.stringify({
    large_bytes: largeText.length,
    unicode_bytes: unicodeBytes,
    unicode_chars: unicodeText.length,
    pastes: state.pastes.length,
    key_inputs: state.inputs
  }));

  // 6. Attachment without a paste owner: explicit unsupported rejection, visible and dismissible.
  const unsupportedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await unsupportedPage.addInitScript({ content: harnessWaitSupportScript });
  try {
    await unsupportedPage.goto(`${origin}/mounted-terminal-keyboard-smoke.html?pasteOwner=off`, { waitUntil: "domcontentloaded" });
    await waitForDom(unsupportedPage, () => unsupportedPage.evaluate(() => Boolean(globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__?.terminalControl?.focus) &&
        (globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__?.terminal ?? []).some((entry) => entry.kind === "pty_connected"), undefined), { label: "failWith condition 5", deadlineMs: 15_000 });
    await waitForMountedReady(unsupportedPage, "unsupported-paste page ready line");
    await unsupportedPage.evaluate(() => globalThis.__BOTSTER_LIVE_PROTOCOL_HARNESS__.terminalControl.focus());
    await waitForDom(unsupportedPage, { locator: unsupportedPage.locator(".terminal-view-container canvas").first(), state: "actionable" }, { label: "unsupportedPage.locator('.terminal-view-container canvas').first() before click" });
    await unsupportedPage.locator(".terminal-view-container canvas").first().click({ position: { x: 10, y: 10 } });
    const unsupported = await unsupportedPage.evaluate((data) => {
      const target = globalThis.document.activeElement;
      const transfer = new globalThis.DataTransfer();
      transfer.setData("text/plain", data);
      const event = new globalThis.ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented };
    }, "unsupported-paste\n");
    if (!unsupported.defaultPrevented) throw new Error("unsupported-attachment paste was not consumed as a paste");
    await waitForDom(unsupportedPage, () => unsupportedPage.evaluate(() => {
        const harness = globalThis.__BOTSTER_MOUNTED_KEYBOARD_SMOKE__;
        const message = globalThis.document.querySelector(".terminal-input-message");
        return harness.pasteOutcomes.length === 1 && harness.pasteOutcomes[0].outcome === "rejected_locally" &&
          harness.pasteOutcomes[0].reason === "unsupported" && harness.pastes.length === 0 && harness.inputs.length === 0 &&
          message?.getAttribute("data-terminal-input-outcome") === "rejected_locally" &&
          (message?.textContent ?? "").includes("has no paste owner");
      }, undefined), { label: "failWith condition 6", deadlineMs: 15_000 });
    await waitForDom(unsupportedPage, { locator: unsupportedPage.locator(".terminal-input-message button"), state: "actionable" }, { label: "unsupportedPage.locator('.terminal-input-message button') before click" });
    await unsupportedPage.locator(".terminal-input-message button").click();
    await waitForDom(unsupportedPage, () => unsupportedPage.evaluate(() => globalThis.document.querySelector(".terminal-input-message") === null, undefined), { label: "failWith condition 7", deadlineMs: 5_000 });
    console.log("mounted terminal unsupported paste owner smoke passed");
  } finally {
    await unsupportedPage.close();
  }
}
