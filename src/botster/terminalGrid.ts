import type { TerminalDataPlaneAttachment } from "./terminal";

export interface TerminalGrid {
  rows: number;
  columns: number;
}

type TerminalGridTarget = Pick<TerminalDataPlaneAttachment, "resize">;

function sameGrid(left: TerminalGrid | undefined, right: TerminalGrid): boolean {
  return left?.rows === right.rows && left.columns === right.columns;
}

function validGrid(rows: number, columns: number): TerminalGrid | undefined {
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
    columns: normalizedColumns
  };
}

/**
 * Own the latest browser grid and synchronize it with the current Hub data plane.
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

  measure(columns: number, rows: number): boolean {
    const grid = validGrid(rows, columns);
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
    void this.target.resize(grid.rows, grid.columns);
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
