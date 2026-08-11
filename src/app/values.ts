/** Shared value readers for botster-web feature modules. */

export function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Numeric hub facts such as protocol version, conformance revision, and state schema
 * arrive as JSON numbers. Rendering them through stringValue() reports every one of
 * them as the fallback, which is the "regressed to unknown" failure the hub never made.
 */
export function reportedNumber(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
}

export function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

export function parseTokenList(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => (
      typeof entry === "string" ? [[key, entry]] : []
    ))
  );
}

export function joinTokenList(value: unknown): string {
  return stringArray(value).join(", ");
}

export function formatMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function parseMetadata(input: string): Record<string, string> {
  return Object.fromEntries(
    input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex < 1) return [];
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return key ? [[key, value]] : [];
      })
  );
}

/**
 * Prefer the seeded authored array while the paired text control is byte-identical to the
 * seed projection; re-parse only after the operator edits the control.
 */
export function tokenListFromForm(text: string, seeded: string[] | undefined): string[] {
  if (seeded !== undefined && text === joinTokenList(seeded)) {
    return seeded;
  }
  return parseTokenList(text);
}

export function environmentFromForm(
  text: string,
  seeded: Record<string, string> | undefined
): Record<string, string> {
  if (seeded !== undefined && text === formatMetadata(seeded)) {
    return seeded;
  }
  return parseMetadata(text);
}

export function actionLabelFromId(actionId: string): string {
  return actionId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function readDiagnosticMessage(value: unknown): string | undefined {
  const record = readRecord(value);
  return readString(record.message);
}

export function visibleStatusText(value: string): string {
  return value;
}

export function appDisplayName(title: unknown, fallback: string): string {
  return stringValue(title, fallback).replace(/[-_]+/g, " ");
}
