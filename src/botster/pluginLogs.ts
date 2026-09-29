import type { ActionBinding } from "./actions";
import type { DaemonPluginLogRecord, DaemonPluginLogs } from "./generated/daemon-protocol";

/** Action that reads one package's plugin log records (protocol 12 read_plugin_logs). */
export const readPluginLogsActionId = "botster.package.read_plugin_logs";

/**
 * The Hub refuses a read it cannot fund a copy of with this operator code; the caller may read
 * again. Web does not retry by itself. The Hub no longer answers plugin_logs_busy: a read waits
 * for the log book's lock instead.
 */
export const retryablePluginLogErrorCodes: ReadonlySet<string> = new Set(["plugin_logs_capacity"]);

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

/**
 * What the plugin logs view holds for one package. The cursor belongs to exactly one log:
 * `logId` (absent when the package has no log). Records are ascending by seq.
 */
export interface PluginLogView {
  loaded: boolean;
  logId: string | undefined;
  cursor: number;
  records: DaemonPluginLogRecord[];
  evicted: Array<{ fromSeq: number; toSeq: number }>;
  /** The view was replaced because the plugin's log started again (a new log_id). */
  restarted: boolean;
}

/** One read the view asks for. A reset read (after_seq 0) is authoritative for its log_id. */
export interface PluginLogRead {
  afterSeq: number;
  reset: boolean;
}

export const emptyPluginLogView: PluginLogView = {
  loaded: false,
  logId: undefined,
  cursor: 0,
  records: [],
  evicted: [],
  restarted: false
};

/** The read for opening the view (all retained records) or for "Load newer". */
export function nextPluginLogRead(view: PluginLogView, kind: "open" | "newer"): PluginLogRead {
  return kind === "open" || !view.loaded ? { afterSeq: 0, reset: false } : { afterSeq: view.cursor, reset: false };
}

function viewFromPage(logs: DaemonPluginLogs, restarted: boolean): PluginLogView {
  const records = [...logs.records].sort((a, b) => a.seq - b.seq);
  const lastSeq = records.at(-1)?.seq ?? 0;
  return {
    loaded: true,
    logId: logs.log_id,
    cursor: Math.max(lastSeq, logs.first_available_seq - 1),
    records,
    evicted: logs.first_available_seq > 1 ? [{ fromSeq: 1, toSeq: logs.first_available_seq - 1 }] : [],
    restarted
  };
}

/**
 * Apply one page to the view. The cursor is bound to log_id (Hub client protocol, revision 53):
 * - the first read, and a reset read, replace the view with the page (a reset read is
 *   authoritative for its own log_id, so a reset never chains);
 * - a page with the held log_id appends records after the cursor;
 * - a page with a different log_id (present or absent) is discarded whole, because it can skip
 *   the new log's lower seqs, and one reset read from after_seq 0 is requested.
 * A new generation alone is not a new log: reloads keep the log_id.
 */
export function applyPluginLogPage(
  view: PluginLogView,
  logs: DaemonPluginLogs,
  read: PluginLogRead
): { view: PluginLogView; followUp?: PluginLogRead } {
  if (read.reset) return { view: viewFromPage(logs, view.loaded) };
  if (!view.loaded) return { view: viewFromPage(logs, false) };
  if (logs.log_id !== view.logId) return { view, followUp: { afterSeq: 0, reset: true } };
  const fresh = logs.records.filter((record) => record.seq > view.cursor).sort((a, b) => a.seq - b.seq);
  const evicted = logs.first_available_seq > view.cursor + 1
    ? [...view.evicted, { fromSeq: view.cursor + 1, toSeq: logs.first_available_seq - 1 }]
    : view.evicted;
  const lastSeq = fresh.at(-1)?.seq ?? view.cursor;
  return {
    view: {
      ...view,
      cursor: Math.max(lastSeq, logs.first_available_seq - 1, view.cursor),
      records: [...view.records, ...fresh],
      evicted,
      restarted: false
    }
  };
}

/** Visible text for a refused read: capacity has its own text, any other refusal shows the Hub's reason. */
export function pluginLogRefusalMessage(errorKind: string | undefined, reason: string | undefined): string {
  if (errorKind === "plugin_logs_capacity") return "The Hub could not fund a copy of this page; try again.";
  return reason ?? "Plugin logs could not be read.";
}
