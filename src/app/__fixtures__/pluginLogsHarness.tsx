/** Mount harness for production usePluginLogs tests. */

import type { createBotsterWebClient } from "../../botster/client";
import { usePluginLogs } from "../usePluginLogs";

type RuntimeClient = ReturnType<typeof createBotsterWebClient>;

export function PluginLogsHarness(props: {
  runtimeClient: RuntimeClient;
  packageName: string;
  onState: (state: ReturnType<typeof usePluginLogs>) => void;
}) {
  const state = usePluginLogs(props.runtimeClient, props.packageName);
  props.onState(state);
  return null;
}
