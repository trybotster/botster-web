import { Restty, ResttyWasm } from "../vendor/restty/internal.js";

type Grid = { columns: number; rows: number };

const root = document.getElementById("root");
if (!root) throw new Error("GHOSTSNP grid smoke root is missing");

let runtime: ResttyWasm | undefined;
let activeHandle = 0;
let mountedGrid: Grid | undefined;
const originalCreate = ResttyWasm.prototype.create;
const captureRuntime = (nextRuntime: ResttyWasm) => {
  runtime = nextRuntime;
};
ResttyWasm.prototype.create = function create(columns, rows, maxScrollback) {
  const handle = originalCreate.call(this, columns, rows, maxScrollback);
  captureRuntime(this);
  activeHandle = handle;
  mountedGrid = { columns, rows };
  return handle;
};

const restty = new Restty({
  root,
  createInitialPane: { focus: false },
  appOptions: {
    readOnly: true,
    renderer: "webgl2"
  }
});

type GhostsnpGridSmoke = {
  getMountedGrid(): Grid | undefined;
  getRenderGrid(): Grid | undefined;
  importSnapshot(bytes: Uint8Array): boolean;
  readViewportRows(): string[];
  scrollToOldest(): void;
};

const harness: GhostsnpGridSmoke = {
  getMountedGrid() {
    return mountedGrid ? { ...mountedGrid } : undefined;
  },
  getRenderGrid() {
    const state = runtime?.getRenderState(activeHandle);
    return state ? { columns: state.cols, rows: state.rows } : undefined;
  },
  importSnapshot(bytes) {
    return restty.loadBinarySnapshot(bytes);
  },
  readViewportRows() {
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
  },
  scrollToOldest() {
    runtime?.scrollViewport(activeHandle, -10_000);
    runtime?.renderUpdate(activeHandle);
  }
};

(window as typeof window & { __BOTSTER_GHOSTSNP_GRID_SMOKE__?: GhostsnpGridSmoke })
  .__BOTSTER_GHOSTSNP_GRID_SMOKE__ = harness;
