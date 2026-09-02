import { createHubTerminalDataPlane } from "./hubTerminalDataPlane";
import type { SnapshotPhase, TerminalEvent } from "@trybotster/terminal-protocol";
import type { DaemonRequest } from "./realHubDaemonDto";
import type { TerminalStreamEvent } from "./hubTransport";
import { ResttyTerminalRenderer } from "./resttyRenderer";
import { ResttyWasm } from "../vendor/restty/internal.js";
import type { TerminalAttachmentStatus } from "./terminal";

const sessionId = "incremental-browser-proof-session";
const subscriptionId = "incremental-browser-proof-subscription";
const root = document.getElementById("root");
if (!root) throw new Error("Incremental attach smoke root is missing.");

let runtime: ResttyWasm | undefined;
let activeHandle = 0;
const originalCreate = ResttyWasm.prototype.create;
function recordRuntime(value: ResttyWasm): void {
  runtime = value;
}
ResttyWasm.prototype.create = function create(columns, rows, maxScrollback) {
  const handle = originalCreate.call(this, columns, rows, maxScrollback);
  recordRuntime(this);
  activeHandle = handle;
  return handle;
};

let deliverEvent: ((event: TerminalStreamEvent) => void | Promise<void>) | undefined;
const requests: DaemonRequest[] = [];
const sentFrames: Uint8Array[] = [];
const statuses: TerminalAttachmentStatus[] = [];
const dataPlane = createHubTerminalDataPlane({
  sessionId,
  subscriptionId,
  bridge: {
    async request(request) {
      requests.push(structuredClone(request));
      if (request.type === "read_mode_flags") {
        return {
          kind: "read_mode_flags",
          mode_flags: {
            session_id: sessionId,
            kitty_enabled: false,
            cursor_visible: true,
            bracketed_paste: false,
            mouse_mode: 0,
            alt_screen: false,
            focus_reporting: false,
            application_cursor: false,
            mode_generation: 1,
            mode_revision: 1
          },
          events: []
        } as never;
      }
      if (request.type === "read_screen") {
        return {
          kind: "read_screen",
          read_screen: { session_id: sessionId, text: "" },
          events: []
        } as never;
      }
      return { kind: "events", events: [] } as never;
    },
    streamTerminal(nextSessionId, nextSubscriptionId, onEvent) {
      if (nextSessionId !== sessionId || nextSubscriptionId !== subscriptionId) {
        throw new Error("Incremental attach smoke received a different subscription.");
      }
      deliverEvent = onEvent;
      return {
        ready: Promise.resolve(),
        async sendFrame(frame) {
          sentFrames.push(frame.slice());
        },
        abandon() {},
        unsubscribe() {}
      };
    }
  }
});

const renderer = new ResttyTerminalRenderer({ sessionId, renderer: "restty" });
renderer.mount(root);
renderer.attachDataPlane(dataPlane);
dataPlane.subscribeStatus?.((status) => statuses.push({ ...status }));

function snapshotEvent(bytes: Uint8Array, phase: SnapshotPhase): TerminalEvent {
  return {
    type: "snapshot",
    session_id: sessionId,
    subscription_id: subscriptionId,
    payload_base64: bytesToBase64(bytes),
    payload_encoding: "base64",
    bytes: bytes.byteLength,
    phase
  };
}

function outputEvent(bytes: Uint8Array): TerminalEvent {
  return {
    type: "terminal_output",
    session_id: sessionId,
    subscription_id: subscriptionId,
    payload_base64: bytesToBase64(bytes),
    payload_encoding: "base64",
    bytes: bytes.byteLength
  };
}

async function deliver(event: TerminalStreamEvent): Promise<void> {
  if (!deliverEvent) throw new Error("Incremental attach stream is not ready.");
  await deliverEvent(event);
}

function readViewportRows(): string[] {
  const state = runtime?.getRenderState(activeHandle);
  if (!state?.codepoints) return [];
  const rows: string[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    let value = "";
    for (let column = 0; column < state.cols; column += 1) {
      const codepoint = state.codepoints[row * state.cols + column] ?? 0;
      value += codepoint === 0 ? " " : String.fromCodePoint(codepoint);
    }
    rows.push(value.trimEnd());
  }
  return rows;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

type IncrementalAttachSmoke = {
  attached(): Promise<void>;
  deliverAttached(): Promise<void>;
  deliverHistoryIncomplete(): Promise<void>;
  deliverOutput(bytes: number[]): Promise<void>;
  deliverSnapshot(bytes: number[]): Promise<void>;
  deliverAttaching(): Promise<void>;
  getRequests(): DaemonRequest[];
  getSentFrames(): number[][];
  getRenderGrid(): { columns: number; rows: number } | null;
  getStatuses(): TerminalAttachmentStatus[];
  readViewportRows(): string[];
  resize(rows: number, columns: number): Promise<void>;
  writeInput(data: string): Promise<void>;
};

const harness: IncrementalAttachSmoke = {
  deliverAttaching: () => deliver({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "attaching" }),
  deliverSnapshot: (bytes) => deliver(snapshotEvent(Uint8Array.from(bytes), "ready")),
  deliverHistoryIncomplete: () => deliver({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "snapshot_history_incomplete" }),
  deliverAttached: () => deliver({ type: "attach_state", session_id: sessionId, subscription_id: subscriptionId, state: "attached" }),
  deliverOutput: (bytes) => deliver(outputEvent(Uint8Array.from(bytes))),
  writeInput: (data) => Promise.resolve(dataPlane.writeInput(data)),
  resize: (rows, columns) => Promise.resolve(renderer.resize(rows, columns)),
  getRequests: () => requests.map((request) => structuredClone(request)),
  getSentFrames: () => sentFrames.map((frame) => Array.from(frame)),
  getRenderGrid: () => {
    const state = runtime?.getRenderState(activeHandle);
    return state ? { columns: state.cols, rows: state.rows } : null;
  },
  getStatuses: () => statuses.map((status) => ({ ...status })),
  readViewportRows,
  async attached() {
    while (!statuses.some((status) => status.state === "attached")) {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
  }
};

(window as typeof window & { __BOTSTER_INCREMENTAL_ATTACH_SMOKE__?: IncrementalAttachSmoke })
  .__BOTSTER_INCREMENTAL_ATTACH_SMOKE__ = harness;
