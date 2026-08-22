/** Mount harness for production usePackageEventNotices tests. */

import type { ConnectionDiagnostic } from "../../botster/connectionDiagnostics";
import type { createBotsterWebClient } from "../../botster/client";
import { usePackageEventNotices } from "../usePackageEventNotices";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function PackageEventNoticeHarness(props: {
  runtimeClient: RuntimeClient;
  viewedSessionId?: string;
  packages: ReadonlyArray<Record<string, unknown>>;
  recordDiagnostic?: (diagnostic: ConnectionDiagnostic | undefined) => void;
  onNotices: (notices: {
    toast?: { message: string; color: "medium" | "warning" | "danger" };
    durationMs: number;
  }) => void;
}) {
  const notices = usePackageEventNotices({
    runtimeClient: props.runtimeClient,
    viewedSessionId: props.viewedSessionId,
    packages: props.packages,
    recordDiagnostic: props.recordDiagnostic
  });
  props.onNotices({ toast: notices.toast, durationMs: notices.durationMs });
  return null;
}
