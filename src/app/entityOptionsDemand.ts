/** Claim-scoped demand helpers for entity-backed select option families. */

import {
  collectEntityOptionFamilies,
  type JsonObject
} from "@trybotster/ui-contract";

/** Families held process-wide by production chrome; never released by surface demand. */
const PROCESS_WIDE_ENTITY_FAMILIES = new Set(["session", "session_type"]);

export function isProcessWideEntityFamily(family: string): boolean {
  return PROCESS_WIDE_ENTITY_FAMILIES.has(family);
}

export function collectSurfaceEntityOptionFamilies(root: unknown): string[] {
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return [];
  }
  return collectEntityOptionFamilies(root as JsonObject);
}

export interface EntityOptionsDemandDiff {
  /** Families that must be ensured (idempotent ensure). */
  demand: string[];
  /** Surface-scoped families that must be released. Process-wide families are never released. */
  release: string[];
  /** Full desired family set for the claim after the sync. */
  nextHeld: string[];
}

/**
 * Diff desired families for the current claim against families already held for that claim.
 * Process-wide families are demanded when needed but never released by surface demand.
 */
export function diffEntityOptionsDemand(
  desiredFamilies: readonly string[],
  heldFamilies: ReadonlySet<string>
): EntityOptionsDemandDiff {
  const desired = new Set(desiredFamilies.filter((family) => typeof family === "string" && family.length > 0));
  const demand: string[] = [];
  const release: string[] = [];

  for (const family of desired) {
    if (!heldFamilies.has(family)) {
      demand.push(family);
    }
  }

  for (const family of heldFamilies) {
    if (!desired.has(family) && !isProcessWideEntityFamily(family)) {
      release.push(family);
    }
  }

  demand.sort();
  release.sort();
  return {
    demand,
    release,
    nextHeld: [...desired].sort()
  };
}

/**
 * When a claim is abandoned (route exit or cleared surface), release every non-process-wide
 * family previously held for that claim.
 */
export function releaseEntityOptionsDemand(heldFamilies: ReadonlySet<string>): string[] {
  return [...heldFamilies].filter((family) => !isProcessWideEntityFamily(family)).sort();
}
