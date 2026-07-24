import { createHubTransport, type DaemonBridgeClient } from "./hubTransport";
import { createHubTerminalDataPlane } from "./hubTerminalDataPlane";
import {
  createLocalWebrtcBootstrapRefresher,
  createWebrtcDaemonClient,
  type LocalWebrtcBootstrap,
  WebrtcDaemonClientError
} from "./webrtcDaemonClient";
import type { HubControlTransport } from "./protocol";
import type { TerminalDataPlaneAttachment } from "./terminal";

export type TerminalDataPlaneKind = "webrtc";

export function terminalDataPlaneLabel(): string {
  return "WebRTC DataChannel";
}

export interface HubRuntimeConfig {
  mode: "webrtc";
  statusText: string;
  transport: HubControlTransport;
  terminalDataPlaneKind: TerminalDataPlaneKind;
  startupError?: WebrtcDaemonClientError;
  createTerminalDataPlane(sessionId: string): TerminalDataPlaneAttachment;
}

export interface HubRuntimeConfigOptions {
  locationHref: string;
  bridge?: DaemonBridgeClient;
  signalingUrl?: string;
  localWebrtcBootstrap?: LocalWebrtcBootstrap;
}

export function createHubRuntimeConfig(options: HubRuntimeConfigOptions): HubRuntimeConfig {
  const signalingUrl = options.signalingUrl ?? `${new URL(options.locationHref, "http://botster-web.local/").origin}/request`;
  const startupError = options.localWebrtcBootstrap
    ? undefined
    : new WebrtcDaemonClientError("bootstrap", "Botster package runtime requires a valid local WebRTC bootstrap grant.");
  const bridge = options.bridge ?? (
    options.localWebrtcBootstrap
      ? createWebrtcDaemonClient({
          bootstrap: options.localWebrtcBootstrap,
          refreshBootstrap: createLocalWebrtcBootstrapRefresher({
            bootstrap: options.localWebrtcBootstrap,
            signalingUrl
          })
        })
      : unavailableDaemonClient(startupError!)
  );

  return {
    mode: "webrtc",
    statusText: startupError ? "Local WebRTC bootstrap unavailable" : "Connected to local hub over WebRTC",
    transport: createHubTransport({ bridge }),
    terminalDataPlaneKind: "webrtc",
    startupError,
    createTerminalDataPlane: (sessionId) => createHubTerminalDataPlane({ bridge, sessionId })
  };
}

function unavailableDaemonClient(error: WebrtcDaemonClientError): DaemonBridgeClient {
  return {
    request: () => Promise.reject(error)
  };
}
