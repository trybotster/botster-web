import { createHubTerminalDataPlane } from "./hubTerminalDataPlane";
import type { DaemonRequest } from "./realHubDaemonDto";
import type { TerminalStreamEvent } from "./hubTransport";
import { ResttyTerminalRenderer } from "./resttyRenderer";
import { ResttyWasm } from "../vendor/restty/internal.js";
import type { TerminalAttachmentStatus, TerminalInputOutcome } from "./terminal";
import {
  encodeTerminalBody,
  type HistoryUnavailableReasonName,
  type TerminalEvent
} from "./generated/terminal-protocol";

/**
 * Browser smoke fixture: one real HubTerminalDataPlane and one real ResttyTerminalRenderer
 * over a fake bridge. The driver script feeds authentic scheme 2 frames (encoded by the
 * Core-generated test encoder) in the route order and reads the painted viewport.
 */
const sessionId = "incremental-browser-proof-session";
const subscriptionId = "incremental-browser-proof-subscription";
const routeGeneration = 1;
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
const outcomes: TerminalInputOutcome[] = [];
const dataPlane = createHubTerminalDataPlane({
  sessionId,
  subscriptionId,
  bridge: {
    async request(request) {
      requests.push(structuredClone(request));
      if (request.type === "read_screen") {
        return {
          kind: "read_screen",
          read_screen: { session_id: sessionId, text: "" },
          events: []
        } as never;
      }
      return { kind: "events", events: [] } as never;
    },
    subscribeLifecycle() {
      return { unsubscribe() {} };
    },
    streamTerminal(nextSessionId, nextSubscriptionId, onEvent) {
      if (nextSessionId !== sessionId || nextSubscriptionId !== subscriptionId) {
        throw new Error("Incremental attach smoke received a different subscription.");
      }
      deliverEvent = onEvent;
      return {
        ready: Promise.resolve(),
        generation: routeGeneration,
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
const attachedWaiters: Array<() => void> = [];
dataPlane.subscribeStatus?.((status) => {
  statuses.push({ ...status });
  if (status.state === "attached") {
    for (const wake of attachedWaiters.splice(0)) wake();
  }
});
dataPlane.subscribeInputOutcomes?.((outcome) => outcomes.push({ ...outcome }));

async function deliver(event: TerminalEvent, streamEpoch = 0): Promise<void> {
  if (!deliverEvent) throw new Error("Incremental attach stream is not ready.");
  await deliverEvent({ route: subscriptionId, generation: routeGeneration, streamEpoch, body: encodeTerminalBody(event) });
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

type IncrementalAttachSmoke = {
  attached(): Promise<void>;
  deliverAttaching(): Promise<void>;
  deliverAttached(): Promise<void>;
  deliverModes(modeBits: number, rows: number, cols: number): Promise<void>;
  deliverSnapshotReady(bytes: number[]): Promise<void>;
  deliverSnapshotHistory(bytes: number[]): Promise<void>;
  deliverSnapshotFinish(): Promise<void>;
  deliverHistoryUnavailable(reason: HistoryUnavailableReasonName): Promise<void>;
  deliverOutput(bytes: number[]): Promise<void>;
  deliverProcessExit(code: number | null): Promise<void>;
  deliverRouteResync(fromEpoch: number, toEpoch: number): Promise<void>;
  /** Deliver one frame under an explicit stream epoch, for stale-epoch proofs. */
  deliverOutputInEpoch(bytes: number[], streamEpoch: number): Promise<void>;
  getRequests(): DaemonRequest[];
  getSentFrames(): number[][];
  getOutcomes(): TerminalInputOutcome[];
  getRenderGrid(): { columns: number; rows: number } | null;
  getStatuses(): TerminalAttachmentStatus[];
  readViewportRows(): string[];
  resize(rows: number, columns: number): Promise<void>;
  /** Explicit RAW_BYTES input; the smoke intends raw bytes here. */
  writeInput(data: string): Promise<void>;
};

const harness: IncrementalAttachSmoke = {
  deliverAttaching: () => deliver({ kind: "attach_state", state: "attaching" }),
  deliverAttached: () => deliver({ kind: "attach_state", state: "attached" }),
  deliverModes: (modeBits, rows, cols) => deliver({ kind: "modes", mode_bits: modeBits, rows, cols }),
  deliverSnapshotReady: (bytes) => deliver({ kind: "snapshot_ready", payload: Uint8Array.from(bytes) }),
  deliverSnapshotHistory: (bytes) => deliver({ kind: "snapshot_history", payload: Uint8Array.from(bytes) }),
  deliverSnapshotFinish: () => deliver({ kind: "snapshot_finish" }),
  deliverHistoryUnavailable: (reason) => deliver({ kind: "history_unavailable", reason }),
  deliverOutput: (bytes) => deliver({ kind: "output", payload: Uint8Array.from(bytes) }),
  deliverProcessExit: (code) => deliver({ kind: "process_exit", code }),
  deliverRouteResync: (fromEpoch, toEpoch) =>
    deliver({ kind: "route_resync", from_epoch: fromEpoch, to_epoch: toEpoch }, toEpoch),
  deliverOutputInEpoch: (bytes, streamEpoch) => deliver({ kind: "output", payload: Uint8Array.from(bytes) }, streamEpoch),
  writeInput: (data) => {
    dataPlane.sendInput({ kind: "raw", bytes: new TextEncoder().encode(data) });
    return Promise.resolve();
  },
  resize: (rows, columns) => Promise.resolve(renderer.resize(rows, columns)),
  getRequests: () => requests.map((request) => structuredClone(request)),
  getSentFrames: () => sentFrames.map((frame) => Array.from(frame)),
  getOutcomes: () => outcomes.map((outcome) => ({ ...outcome })),
  getRenderGrid: () => {
    const state = runtime?.getRenderState(activeHandle);
    return state ? { columns: state.cols, rows: state.rows } : null;
  },
  getStatuses: () => statuses.map((status) => ({ ...status })),
  readViewportRows,
  /** Resolves on the attached status itself; the smoke's caller owns the deadline. */
  attached() {
    if (statuses.some((status) => status.state === "attached")) return Promise.resolve();
    return new Promise<void>((resolve) => attachedWaiters.push(resolve));
  }
};

(window as typeof window & { __BOTSTER_INCREMENTAL_ATTACH_SMOKE__?: IncrementalAttachSmoke })
  .__BOTSTER_INCREMENTAL_ATTACH_SMOKE__ = harness;
