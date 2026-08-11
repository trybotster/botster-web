/** Spawn-point (target) form helpers. */

import { formatMetadata, readRecord, stringValue } from "./values";

export type SpawnTargetFormMode = "create" | "edit";

export interface SpawnTargetFormState {
  mode: SpawnTargetFormMode;
  targetId: string;
  originalTargetId?: string;
  label: string;
  root: string;
  kind: string;
  enabled: boolean;
  metadata: string;
}

export const emptySpawnTargetForm: SpawnTargetFormState = {
  mode: "create",
  targetId: "",
  label: "",
  root: "",
  kind: "directory",
  enabled: true,
  metadata: ""
};

export function spawnTargetFormFromRecord(record: Record<string, unknown>): SpawnTargetFormState {
  const targetId = stringValue(record.target_id, String(record.id));
  return {
    mode: "edit",
    targetId,
    originalTargetId: targetId,
    label: stringValue(record.label, stringValue(record.title, targetId)),
    root: stringValue(record.root, ""),
    kind: stringValue(record.kind, "directory"),
    enabled: record.enabled !== false,
    metadata: formatMetadata(readRecord(record.metadata))
  };
}

export function spawnTargetIdFromLabel(label: string): string {
  return label
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function compareSpawnTargetRows(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const leftEnabled = left.enabled !== false ? 0 : 1;
  const rightEnabled = right.enabled !== false ? 0 : 1;
  return leftEnabled - rightEnabled
    || stringValue(left.label, stringValue(left.title, String(left.id))).localeCompare(stringValue(right.label, stringValue(right.title, String(right.id))))
    || String(left.id).localeCompare(String(right.id));
}
