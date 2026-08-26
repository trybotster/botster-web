import { createRoot } from "react-dom/client";

import { ResttyWasm } from "../vendor/restty/internal.js";
import { TerminalViewHost } from "./TerminalViewHost";
import type {
  TerminalAttachmentStatus,
  TerminalDataPlaneAttachment,
  TerminalOutput,
  TerminalSubscription,
  TerminalViewDescriptor
} from "./terminal";

let runtime: ResttyWasm | undefined;
let activeHandle = 0;
let lastCreate: { columns: number; rows: number; maxScrollback: number; handle: number } | null = null;
const originalCreate = ResttyWasm.prototype.create;
const captureRuntime = (nextRuntime: ResttyWasm, handle: number) => {
  runtime = nextRuntime;
  activeHandle = handle;
};
ResttyWasm.prototype.create = function create(columns, rows, maxScrollback) {
  const handle = originalCreate.call(this, columns, rows, maxScrollback);
  lastCreate = { columns, rows, maxScrollback, handle };
  captureRuntime(this, handle);
  return handle;
};

function wasmExports(): {
  restty_scrollbar_offset?: (handle: number) => number;
  restty_scrollbar_len?: (handle: number) => number;
  restty_scrollbar_total?: (handle: number) => number;
  restty_render_rows?: (handle: number) => number;
  restty_scroll_viewport?: (handle: number, delta: number) => number;
} | undefined {
  return runtime?.exports;
}

function flushRender(): void {
  runtime?.renderUpdate(activeHandle);
}

function readPaintedRows(): string[] {
  flushRender();
  const state = runtime?.getRenderState(activeHandle);
  if (!state?.codepoints) return [];
  const rows: string[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    let text = "";
    for (let column = 0; column < state.cols; column += 1) {
      const codepoint = state.codepoints[row * state.cols + column] ?? 0;
      text += codepoint === 0 ? " " : String.fromCodePoint(codepoint);
    }
    rows.push(text.trimEnd());
  }
  return rows;
}

function readNumberedHistory(): string[] {
  return readPaintedRows().filter((row) => /^\d+$/.test(row));
}

function readViewportRows(): string[] {
  const painted = readPaintedRows();
  const numbered = painted.filter((row) => /^\d+$/.test(row));
  const exports = wasmExports();
  const offset = exports?.restty_scrollbar_offset?.(activeHandle);
  const len = exports?.restty_scrollbar_len?.(activeHandle) ?? exports?.restty_render_rows?.(activeHandle);
  if (
    typeof offset === "number" &&
    typeof len === "number" &&
    len > 0 &&
    numbered.length > len
  ) {
    return numbered.slice(Math.max(0, offset), Math.max(0, offset) + len);
  }
  return painted;
}

function viewportMeta(): Record<
  string,
  number | boolean | string | null | { columns: number; rows: number; maxScrollback: number; handle: number }
> {
  flushRender();
  const exports = wasmExports();
  const state = runtime?.getRenderState(activeHandle);
  const numbered = readNumberedHistory();
  return {
    hasRuntime: Boolean(runtime),
    handle: activeHandle,
    abiKind: runtime?.abi?.kind ?? null,
    lastCreate,
    stateRows: state?.rows ?? null,
    stateCols: state?.cols ?? null,
    numbered: numbered.length,
    firstNumbered: numbered[0] ? Number(numbered[0]) : null,
    lastNumbered: numbered.at(-1) ? Number(numbered.at(-1)) : null,
    offset: exports?.restty_scrollbar_offset?.(activeHandle) ?? null,
    len: exports?.restty_scrollbar_len?.(activeHandle) ?? null,
    total: exports?.restty_scrollbar_total?.(activeHandle) ?? null,
    renderRows: exports?.restty_render_rows?.(activeHandle) ?? null
  };
}

function scrollViewportToBottom(): void {
  flushRender();
  const exports = wasmExports();
  const total = exports?.restty_scrollbar_total?.(activeHandle) ?? 0;
  const len = exports?.restty_scrollbar_len?.(activeHandle) ?? 0;
  const offset = exports?.restty_scrollbar_offset?.(activeHandle) ?? 0;
  const delta = Math.max(0, total - len) - offset;
  if (exports?.restty_scroll_viewport) {
    exports.restty_scroll_viewport(activeHandle, delta !== 0 ? delta : 10_000);
  } else {
    runtime?.scrollViewport(activeHandle, delta !== 0 ? delta : 10_000);
  }
  flushRender();
}

function readCellHeight(): number {
  const canvas = document.querySelector(".terminal-view-container canvas");
  const rect = canvas?.getBoundingClientRect();
  const rows = lastCreate?.rows ?? runtime?.getRenderState(activeHandle)?.rows;
  if (!rect || rect.height <= 0 || !rows) return 20;
  return rect.height / rows;
}

const descriptor: TerminalViewDescriptor = {
  sessionId: "mounted_keyboard_smoke_session",
  renderer: "restty"
};

const readyOutput = "botster-web-mounted-keyboard-ready\r\n";
const echoPrefix = "botster-web-mounted-keyboard-echo:";
const outputListeners = new Set<(data: TerminalOutput) => void>();
const statusListeners = new Set<(status: TerminalAttachmentStatus) => void>();

type MountedKeyboardHarness = {
  callbackOrder: string[];
  emitOutput(data: string | Uint8Array): void;
  emitStatus(status: TerminalAttachmentStatus): void;
  exitSessions: string[];
  inputs: string[];
  statuses: Array<{ sessionId: string; state: TerminalAttachmentStatus["state"] }>;
  terminal: Array<{ kind: string; payload: unknown }>;
  outputSubscribers: number;
  readViewportRows(): string[];
  readNumberedHistory(): string[];
  readCellHeight(): number;
  flushRender(): void;
  scrollViewportToBottom(): void;
  viewportMeta(): Record<
    string,
    number | boolean | string | null | { columns: number; rows: number; maxScrollback: number; handle: number }
  >;
};

const harness: MountedKeyboardHarness = {
  callbackOrder: [],
  emitOutput(data) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    for (const listener of outputListeners) {
      listener(bytes);
    }
    harness.callbackOrder.push(`output:${new TextDecoder().decode(bytes)}`);
  },
  emitStatus(status) {
    for (const listener of statusListeners) {
      listener(status);
    }
  },
  exitSessions: [],
  inputs: [],
  statuses: [],
  terminal: [],
  outputSubscribers: 0,
  readViewportRows,
  readNumberedHistory,
  readCellHeight,
  flushRender,
  scrollViewportToBottom,
  viewportMeta
};

(window as typeof window & {
  __BOTSTER_MOUNTED_KEYBOARD_SMOKE__?: MountedKeyboardHarness;
  __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
    events: unknown[];
    terminal: Array<{ kind: string; payload: unknown }>;
  };
}).__BOTSTER_MOUNTED_KEYBOARD_SMOKE__ = harness;

(window as typeof window & {
  __BOTSTER_LIVE_PROTOCOL_HARNESS__?: {
    events: unknown[];
    terminal: Array<{ kind: string; payload: unknown }>;
  };
}).__BOTSTER_LIVE_PROTOCOL_HARNESS__ = {
  events: [],
  terminal: harness.terminal
};

const dataPlane: TerminalDataPlaneAttachment = {
  sessionId: descriptor.sessionId,
  writeInput(data) {
    harness.inputs.push(data);
    const output = new TextEncoder().encode(`${echoPrefix}${data.trimEnd()}\r\n`);
    for (const listener of outputListeners) {
      listener(output);
    }
  },
  subscribeOutput(listener) {
    outputListeners.add(listener);
    harness.outputSubscribers = outputListeners.size;
    window.setTimeout(() => {
      if (outputListeners.has(listener)) {
        listener(new TextEncoder().encode(readyOutput));
      }
    }, 0);

    return {
      unsubscribe() {
        outputListeners.delete(listener);
        harness.outputSubscribers = outputListeners.size;
      }
    };
  },
  subscribeStatus(listener): TerminalSubscription {
    statusListeners.add(listener);
    listener({
      state: "attached",
      message: "Mounted keyboard smoke data plane attached"
    });

    return {
      unsubscribe() {
        statusListeners.delete(listener);
      }
    };
  },
  resize() {},
  detach() {
    outputListeners.clear();
    statusListeners.clear();
  }
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("mounted keyboard smoke root is missing");
}

createRoot(rootElement).render(
  <TerminalViewHost
    descriptor={descriptor}
    dataPlane={dataPlane}
    onAttachmentStatus={(sessionId, status) => {
      harness.statuses.push({ sessionId, state: status.state });
    }}
    onExit={(sessionId) => {
      harness.exitSessions.push(sessionId);
      harness.callbackOrder.push(`exit:${sessionId}`);
    }}
  />
);
