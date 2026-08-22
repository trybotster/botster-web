/** Route-owned descriptor-driven package notice subscription and toast state. */

import { useEffect, useMemo, useState } from "react";

import type { ConnectionDiagnostic } from "../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../botster/client";
import {
  clampNoticeTtlMs,
  NOTICE_TTL_DEFAULT_MS,
  noticeColorFromSeverity,
  noticeSubscribeSpec,
  noticeTextFromEvent,
  packageEventSubscriptionKey,
  packageNoticeReactionsFromPackages,
  type PackageEventSubscribeSpec
} from "./packageEventNotices";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

type PackageEventToast = {
  message: string;
  color: "medium" | "warning" | "danger";
};

function packageNoticeSuppressedDiagnostic(
  owner: string,
  name: string,
  suppressed: { code: string; message: string }
): ConnectionDiagnostic {
  return {
    id: `package-notice-suppressed-${owner}-${name}-${suppressed.code}`,
    title: "Package notice suppressed",
    detail: `${owner}/${name}: ${suppressed.message}`,
    severity: "warning",
    source: "stream",
    operation: "package_event"
  };
}

export function usePackageEventNotices(options: {
  runtimeClient: RuntimeClient;
  viewedSessionId?: string;
  packages: ReadonlyArray<Record<string, unknown>>;
  recordDiagnostic?: (diagnostic: ConnectionDiagnostic | undefined) => void;
}): {
  toast?: PackageEventToast;
  durationMs: number;
  onDismiss: () => void;
} {
  const { runtimeClient, viewedSessionId, packages, recordDiagnostic } = options;
  const reactionKey = JSON.stringify(packages.map((row) => row.notice_reactions ?? []));
  const reactions = useMemo(
    () => packageNoticeReactionsFromPackages(packages),
    // Descriptor identity is serialized; `packages` is a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reactionKey]
  );
  const specs = useMemo(() => {
    const next: PackageEventSubscribeSpec[] = [];
    const seen = new Set<string>();
    for (const descriptor of reactions) {
      const spec = noticeSubscribeSpec(descriptor, viewedSessionId);
      if (!spec) continue;
      const key = packageEventSubscriptionKey(spec);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(spec);
    }
    return next;
  }, [reactions, viewedSessionId]);
  const specKey = specs.map(packageEventSubscriptionKey).join("\n");
  const [toast, setToast] = useState<PackageEventToast | undefined>();
  const [durationMs, setDurationMs] = useState(NOTICE_TTL_DEFAULT_MS);
  const [toastSessionId, setToastSessionId] = useState(viewedSessionId);
  if (viewedSessionId !== toastSessionId) {
    setToastSessionId(viewedSessionId);
    setToast(undefined);
  }

  useEffect(() => {
    for (const spec of specs) {
      void runtimeClient.hub.send({
        kind: "events_subscribe",
        payload: spec
      }).catch(() => undefined);
    }

    const unsubscribe = runtimeClient.hub.onFrame((frame) => {
      if (frame.kind === "event_gap") {
        return;
      }
      if (frame.kind !== "package_event" || !frame.payload || typeof frame.payload !== "object") {
        return;
      }
      const payload = frame.payload as { owner?: unknown; name?: unknown; payload?: unknown };
      if (typeof payload.owner !== "string" || typeof payload.name !== "string") return;
      const descriptor = reactions.find(
        (item) => item.owner === payload.owner && item.name === payload.name
      );
      if (!descriptor) return;
      const resolved = noticeTextFromEvent(descriptor, payload.payload);
      if ("suppressed" in resolved) {
        recordDiagnostic?.(packageNoticeSuppressedDiagnostic(
          descriptor.owner,
          descriptor.name,
          resolved.suppressed
        ));
        return;
      }
      const nextToast = {
        message: resolved.text,
        color: noticeColorFromSeverity(descriptor.severity)
      };
      const nextDuration = clampNoticeTtlMs(descriptor.ttl_ms);
      setDurationMs(nextDuration);
      setToast(nextToast);
      if (typeof window !== "undefined") {
        const harness = (window as typeof window & {
          __BOTSTER_LIVE_PROTOCOL_HARNESS__?: { events?: Array<{ kind: string; payload: unknown }> };
        }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
        harness?.events?.push({
          kind: "package_event_notice",
          payload: {
            message: nextToast.message,
            color: nextToast.color,
            duration_ms: nextDuration,
            owner: descriptor.owner,
            name: descriptor.name
          }
        });
      }
    });

    return () => {
      unsubscribe();
      for (const spec of specs) {
        void runtimeClient.hub.send({
          kind: "events_release",
          payload: spec
        }).catch(() => undefined);
      }
    };
  }, [runtimeClient, specKey, recordDiagnostic, specs, reactions]);

  return {
    toast,
    durationMs,
    onDismiss: () => setToast(undefined)
  };
}
