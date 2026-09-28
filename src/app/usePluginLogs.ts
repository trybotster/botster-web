/** Plugin log reads for one package's settings view, through the read_plugin_logs action. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { createBotsterWebClient } from "../botster/client";
import type { DaemonPluginLogs } from "../botster/generated/daemon-protocol";
import {
  applyPluginLogPage,
  emptyPluginLogView,
  nextPluginLogRead,
  pluginLogRefusalMessage,
  readPluginLogsAction,
  type PluginLogRead,
  type PluginLogView
} from "../botster/pluginLogs";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export type PluginLogStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "refused"; message: string; retryable: boolean };

/** The (runtime client, package) that a view, its cursor and its status belong to. */
type PluginLogOwner = { runtimeClient: RuntimeClient; packageName: string };

type PluginLogState = { owner: PluginLogOwner; view: PluginLogView; status: PluginLogStatus };

/**
 * One read at a time, started only by opening the view, "Load newer" or Retry (no polling).
 * Everything the view holds belongs to one owner (runtime client + package): a new owner renders
 * an empty, loading view at once (no rows of the previous owner), its cursor and failed read
 * start empty, and a response sent for an older owner or epoch never lands. Records survive a
 * refused read only within the same owner. Retry repeats the exact read that was refused (a
 * refused reset read retries from after_seq 0).
 */
export function usePluginLogs(runtimeClient: RuntimeClient, packageName: string) {
  const owner = useMemo<PluginLogOwner>(() => ({ runtimeClient, packageName }), [runtimeClient, packageName]);
  const [state, setState] = useState<PluginLogState>(() => ({ owner, view: emptyPluginLogView, status: { kind: "loading" } }));
  const viewRef = useRef<PluginLogView>(emptyPluginLogView);
  const epochRef = useRef(0);
  const inFlightRef = useRef(false);
  const failedReadRef = useRef<PluginLogRead | undefined>(undefined);

  const read = useCallback((request: PluginLogRead, epoch: number) => {
    inFlightRef.current = true;
    const run = (current: PluginLogRead) => {
      void owner.runtimeClient.actions
        .dispatch({ origin: "ui_node", action: readPluginLogsAction(owner.packageName, current.afterSeq) })
        .then((result) => {
          if (epoch !== epochRef.current) return;
          const payload = (result.result ?? {}) as { plugin_logs?: DaemonPluginLogs | null; error_kind?: string };
          if (!result.accepted || !payload.plugin_logs) {
            inFlightRef.current = false;
            failedReadRef.current = current;
            setState({
              owner,
              view: viewRef.current,
              status: { kind: "refused", message: pluginLogRefusalMessage(payload.error_kind, result.reason), retryable: true }
            });
            return;
          }
          const applied = applyPluginLogPage(viewRef.current, payload.plugin_logs, current);
          viewRef.current = applied.view;
          failedReadRef.current = undefined;
          // A reset read is authoritative for its log_id, so this recursion is at most one deep.
          if (applied.followUp) {
            setState({ owner, view: applied.view, status: { kind: "loading" } });
            run(applied.followUp);
            return;
          }
          inFlightRef.current = false;
          setState({ owner, view: applied.view, status: { kind: "idle" } });
        })
        .catch((error: unknown) => {
          if (epoch !== epochRef.current) return;
          inFlightRef.current = false;
          failedReadRef.current = current;
          setState({
            owner,
            view: viewRef.current,
            status: {
              kind: "refused",
              message: error instanceof Error ? error.message : "Plugin logs could not be read.",
              retryable: true
            }
          });
        });
    };
    run(request);
  }, [owner]);

  useEffect(() => {
    // A new owner starts empty: its own cursor, no failed read, nothing in flight.
    epochRef.current += 1;
    viewRef.current = emptyPluginLogView;
    failedReadRef.current = undefined;
    inFlightRef.current = false;
    read(nextPluginLogRead(emptyPluginLogView, "open"), epochRef.current);
    return () => {
      epochRef.current += 1;
      inFlightRef.current = false;
    };
  }, [read]);

  const loadNewer = useCallback(() => {
    if (inFlightRef.current) return;
    setState({ owner, view: viewRef.current, status: { kind: "loading" } });
    read(nextPluginLogRead(viewRef.current, "newer"), epochRef.current);
  }, [owner, read]);

  const retry = useCallback(() => {
    if (inFlightRef.current || !failedReadRef.current) return;
    setState({ owner, view: viewRef.current, status: { kind: "loading" } });
    read(failedReadRef.current, epochRef.current);
  }, [owner, read]);

  // Until the new owner's first answer, render its empty loading view, never the old rows.
  const current = state.owner === owner ? state : { owner, view: emptyPluginLogView, status: { kind: "loading" } as PluginLogStatus };
  return { view: current.view, status: current.status, loadNewer, retry };
}
