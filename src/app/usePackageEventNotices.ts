/** Route-owned package event subscription, identity filter, and transient notice state. */

import { useEffect, useState } from "react";

import type { createBotsterWebClient } from "../botster/client";
import {
  PACKAGE_EVENT_NOTICE_DURATION_MS,
  questionOpenedNoticeFromEvent,
  questionOpenedSubscribePayload,
  RUN_FAMILY,
  RUN_STEP_FAMILY,
  viewedSessionIdFromRoute,
  workflowIdentityFromSessionRecords
} from "./packageEventNotices";
import { appRouteFromPathname } from "./routing";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function usePackageEventNotices(options: {
  runtimeClient: RuntimeClient;
  viewedSessionId?: string;
}): {
  toast?: { message: string };
  durationMs: number;
  onDismiss: () => void;
} {
  const { runtimeClient, viewedSessionId } = options;
  const [toast, setToast] = useState<{ message: string } | undefined>();
  const [toastSessionId, setToastSessionId] = useState(viewedSessionId);
  if (viewedSessionId !== toastSessionId) {
    setToastSessionId(viewedSessionId);
    setToast(undefined);
  }

  useEffect(() => {
    const spec = questionOpenedSubscribePayload;
    void runtimeClient.hub.send({
      kind: "events_subscribe",
      payload: spec
    }).catch(() => undefined);

    const unsubscribe = runtimeClient.hub.onFrame((frame) => {
      if (frame.kind === "event_gap") {
        return;
      }
      if (frame.kind !== "package_event" || !frame.payload || typeof frame.payload !== "object") {
        return;
      }
      const payload = frame.payload as { owner?: unknown; name?: unknown; payload?: unknown };
      if (payload.owner !== spec.owner || payload.name !== spec.name) return;
      const identity = workflowIdentityFromSessionRecords(
        viewedSessionIdFromRoute(appRouteFromPathname(window.location.pathname)),
        runtimeClient.entities.list(RUN_STEP_FAMILY),
        runtimeClient.entities.list(RUN_FAMILY)
      );
      const notice = questionOpenedNoticeFromEvent(payload.payload, identity);
      if (notice) {
        setToast({ message: notice });
        if (typeof window !== "undefined") {
          const harness = (window as typeof window & {
            __BOTSTER_LIVE_PROTOCOL_HARNESS__?: { events?: Array<{ kind: string; payload: unknown }> };
          }).__BOTSTER_LIVE_PROTOCOL_HARNESS__;
          harness?.events?.push({ kind: "package_event_notice", payload: { message: notice } });
        }
      }
    });

    return () => {
      unsubscribe();
      void runtimeClient.hub.send({
        kind: "events_release",
        payload: spec
      }).catch(() => undefined);
    };
  }, [runtimeClient]);

  useEffect(() => {
    if (!viewedSessionId) return;
    for (const family of [RUN_STEP_FAMILY, RUN_FAMILY]) {
      void runtimeClient.hub.send({ kind: "entity_pull", payload: { family } }).catch(() => undefined);
    }
    return () => {
      for (const family of [RUN_STEP_FAMILY, RUN_FAMILY]) {
        void runtimeClient.hub.send({ kind: "entity_release", payload: { family } }).catch(() => undefined);
      }
    };
  }, [runtimeClient, viewedSessionId]);

  return {
    toast,
    durationMs: PACKAGE_EVENT_NOTICE_DURATION_MS,
    onDismiss: () => setToast(undefined)
  };
}
