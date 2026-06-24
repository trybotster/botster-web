export type * from "./generated/daemon-protocol";

import type { DaemonRequest, DaemonResponse } from "./generated/daemon-protocol";

export interface DaemonBridgeRequestEnvelope {
  kind: "daemon_request";
  request_id: string;
  payload: DaemonRequest;
}

export interface DaemonBridgeResponseEnvelope {
  kind: "daemon_response";
  request_id: string;
  payload: DaemonResponse;
}
