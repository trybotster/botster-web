import type { TerminalDataPlaneAttachment, TerminalResizeGeometry } from "./terminal";

export interface TerminalGrid {
  rows: number;
  columns: number;
  widthPx: number;
  heightPx: number;
}

type TerminalGridTarget = Pick<TerminalDataPlaneAttachment, "resize">;

function sameGrid(left: TerminalGrid | undefined, right: TerminalGrid): boolean {
  return (
    left?.rows === right.rows &&
    left.columns === right.columns &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx
  );
}

function validGrid(rows: number, columns: number, widthPx: number, heightPx: number): TerminalGrid | undefined {
  const normalizedRows = Math.floor(rows);
  const normalizedColumns = Math.floor(columns);
  if (
    !Number.isFinite(normalizedRows) ||
    !Number.isFinite(normalizedColumns) ||
    normalizedRows <= 0 ||
    normalizedColumns <= 0
  ) {
    return undefined;
  }

  return {
    rows: normalizedRows,
    columns: normalizedColumns,
    widthPx: Number.isFinite(widthPx) && widthPx > 0 ? Math.floor(widthPx) : 0,
    heightPx: Number.isFinite(heightPx) && heightPx > 0 ? Math.floor(heightPx) : 0
  };
}

export function resizeGeometryFromGrid(grid: TerminalGrid): TerminalResizeGeometry {
  return { rows: grid.rows, cols: grid.columns, widthPx: grid.widthPx, heightPx: grid.heightPx };
}

/**
 * Own the latest browser grid and pixel size and synchronize them with the current Hub data
 * plane. RESIZE carries pixel geometry so the worker mouse encoder can report pixel formats.
 */
export class TerminalGridState {
  private grid?: TerminalGrid;
  private target?: TerminalGridTarget;
  private sentGrid?: TerminalGrid;

  current(): TerminalGrid | undefined {
    return this.grid ? { ...this.grid } : undefined;
  }

  attach(target: TerminalGridTarget): void {
    this.target = target;
    this.sentGrid = undefined;
    this.sendCurrentToHub();
  }

  detach(target?: TerminalGridTarget): void {
    if (target && this.target !== target) return;
    this.target = undefined;
    this.sentGrid = undefined;
  }

  measure(columns: number, rows: number, widthPx = 0, heightPx = 0): boolean {
    const grid = validGrid(rows, columns, widthPx, heightPx);
    if (!grid) return false;

    this.grid = grid;
    this.sendCurrentToHub();
    return true;
  }

  reapply(apply: (grid: TerminalGrid) => void): boolean {
    const grid = this.current();
    if (!grid) return false;

    apply(grid);
    this.sendCurrentToHub(true);
    return true;
  }

  private sendCurrentToHub(force = false): void {
    const grid = this.grid;
    if (!grid || !this.target?.resize || (!force && sameGrid(this.sentGrid, grid))) return;

    this.sentGrid = { ...grid };
    this.target.resize(resizeGeometryFromGrid(grid));
  }
}

export async function installSnapshotAndReapplyGrid(
  install: () => boolean | Promise<boolean>,
  gridState: TerminalGridState,
  apply: (grid: TerminalGrid) => void
): Promise<boolean> {
  const installed = await install();
  if (installed) {
    gridState.reapply(apply);
  }
  return installed;
}
