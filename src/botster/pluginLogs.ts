import type { ActionBinding } from "./actions";
import type { DaemonPluginLogRecord, DaemonPluginLogs } from "./generated/daemon-protocol";

/** Action that reads one package's plugin log records (protocol 12 read_plugin_logs). */
export const readPluginLogsActionId = "botster.package.read_plugin_logs";

/**
 * The Hub refuses a read it cannot serve without waiting or unfunded memory with these
 * operator codes; the caller may read again. Web does not retry by itself.
 */
export const retryablePluginLogErrorCodes: ReadonlySet<string> = new Set(["plugin_logs_busy", "plugin_logs_capacity"]);

export function readPluginLogsAction(packageName: string, afterSeq?: number): ActionBinding {
  return {
    id: readPluginLogsActionId,
    label: "Read plugin logs",
    params: afterSeq === undefined ? { package_name: packageName } : { package_name: packageName, after_seq: afterSeq }
  };
}

/** The request an action carries, or undefined when its package name or after_seq is malformed. */
export function readPluginLogsRequestFromAction(
  action: ActionBinding
): { type: "read_plugin_logs"; package_name: string; after_seq?: number } | undefined {
  const packageName = action.params?.package_name;
  const afterSeq = action.params?.after_seq;
  if (typeof packageName !== "string" || packageName.length === 0) return undefined;
  if (afterSeq === undefined) return { type: "read_plugin_logs", package_name: packageName };
  if (typeof afterSeq !== "number" || !Number.isSafeInteger(afterSeq) || afterSeq < 0) return undefined;
  return { type: "read_plugin_logs", package_name: packageName, after_seq: afterSeq };
}

/**
 * One page as a reader sees it. Two different gaps:
 * - evicted: seqs below first_available_seq left the plugin's ring (oldest first); this page
 *   starts after a gap when the reader had not read up to first_available_seq - 1;
 * - rate limited: a record's dropped_before counts records the plugin's rate limit refused
 *   just before it; those never entered the ring.
 */
export function pluginLogPage(logs: DaemonPluginLogs, afterSeq: number | undefined): {
  packageName: string;
  records: DaemonPluginLogRecord[];
  nextSeq: number;
  evicted: { fromSeq: number; toSeq: number } | undefined;
  rateLimited: Array<{ beforeSeq: number; count: number }>;
} {
  const firstUnread = (afterSeq ?? 0) + 1;
  return {
    packageName: logs.package_name,
    records: logs.records,
    nextSeq: logs.next_seq,
    evicted: logs.first_available_seq > firstUnread
      ? { fromSeq: firstUnread, toSeq: logs.first_available_seq - 1 }
      : undefined,
    rateLimited: logs.records
      .filter((record) => record.dropped_before > 0)
      .map((record) => ({ beforeSeq: record.seq, count: record.dropped_before }))
  };
}
