/** Descriptor-driven package notice helpers. No product owner, event, or entity constants. */

import {
  resolveNoticeText,
  type JsonValue,
  type PackageNoticeReactionDescriptor,
  type PackageNoticeSeverity,
  type PackageNoticeSubjectScope
} from "@trybotster/ui-contract";

export const NOTICE_TTL_MIN_MS = 1_000;
export const NOTICE_TTL_MAX_MS = 60_000;
export const NOTICE_TTL_DEFAULT_MS = 5_000;

export type PackageEventSubscribeSpec = {
  owner: string;
  name: string;
  subjects: string[];
};

export type NoticeTextResult =
  | { text: string }
  | { suppressed: { code: string; message: string; bytes?: number } };

const SEVERITIES = new Set<PackageNoticeSeverity>(["info", "warning", "error"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function viewedSessionIdFromRoute(route: { view: string; sessionId?: string }): string | undefined {
  return route.view === "session" && typeof route.sessionId === "string" && route.sessionId.length > 0
    ? route.sessionId
    : undefined;
}

export function admittedNoticeReaction(value: unknown): PackageNoticeReactionDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.owner !== "string" || value.owner.length === 0) return undefined;
  if (typeof value.name !== "string" || value.name.length === 0) return undefined;
  if (value.subject_scope !== "session") return undefined;
  if (typeof value.text_pointer !== "string" || value.text_pointer.length === 0) return undefined;
  if (typeof value.ttl_ms !== "number" || !Number.isFinite(value.ttl_ms)) return undefined;
  if (typeof value.severity !== "string" || !SEVERITIES.has(value.severity as PackageNoticeSeverity)) {
    return undefined;
  }
  return {
    owner: value.owner,
    name: value.name,
    subject_scope: value.subject_scope as PackageNoticeSubjectScope,
    text_pointer: value.text_pointer,
    ttl_ms: value.ttl_ms,
    severity: value.severity as PackageNoticeSeverity
  };
}

export function packageNoticeReactionsFromPackages(
  packages: ReadonlyArray<Record<string, unknown>>
): PackageNoticeReactionDescriptor[] {
  const descriptors: PackageNoticeReactionDescriptor[] = [];
  for (const row of packages) {
    const reactions = row.notice_reactions;
    if (!Array.isArray(reactions)) continue;
    for (const item of reactions) {
      const descriptor = admittedNoticeReaction(item);
      if (descriptor) descriptors.push(descriptor);
    }
  }
  return descriptors;
}

export function noticeSubscribeSpec(
  descriptor: PackageNoticeReactionDescriptor,
  sessionSubject: string | undefined
): PackageEventSubscribeSpec | undefined {
  if (descriptor.subject_scope !== "session") return undefined;
  if (typeof sessionSubject !== "string" || sessionSubject.length === 0) return undefined;
  return {
    owner: descriptor.owner,
    name: descriptor.name,
    subjects: [sessionSubject]
  };
}

export function noticeTextFromEvent(
  descriptor: PackageNoticeReactionDescriptor,
  payload: unknown
): NoticeTextResult {
  try {
    return { text: resolveNoticeText(payload as JsonValue, descriptor.text_pointer) };
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
    const message = error instanceof Error ? error.message : "notice text resolution failed";
    const bytes = isRecord(error) && typeof error.bytes === "number" ? error.bytes : undefined;
    return { suppressed: { code, message, bytes } };
  }
}

export function clampNoticeTtlMs(ttlMs: unknown): number {
  if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs)) return NOTICE_TTL_DEFAULT_MS;
  return Math.min(NOTICE_TTL_MAX_MS, Math.max(NOTICE_TTL_MIN_MS, Math.trunc(ttlMs)));
}

export function noticeColorFromSeverity(severity: string | undefined): "medium" | "warning" | "danger" {
  if (severity === "warning") return "warning";
  if (severity === "error") return "danger";
  return "medium";
}

export function packageEventSubscriptionKey(spec: PackageEventSubscribeSpec): string {
  return `${spec.owner}\0${spec.name}\0${JSON.stringify(spec.subjects)}`;
}
