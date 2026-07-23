import { createLocalDogfoodTransport } from "./localDogfoodTransport";
import {
  createRealHubDogfoodTransport,
  realHubDogfoodSessionId,
  type DaemonBridgeClient
} from "./realHubDogfoodTransport";
import { createRealHubTerminalDataPlane } from "./realHubTerminalDataPlane";
import {
  createLocalWebrtcBootstrapRefresher,
  createWebrtcDaemonClient,
  type LocalWebrtcBootstrap,
  WebrtcDaemonClientError
} from "./webrtcDaemonClient";
import type { HubControlTransport } from "./protocol";
import { MockTerminalDataPlane, type TerminalDataPlaneAttachment, type TerminalViewDescriptor } from "./terminal";

export type DogfoodModeName = "fixture" | "webrtc";
export type TerminalDataPlaneKind = "mock" | "webrtc";

export function terminalDataPlaneLabel(kind: TerminalDataPlaneKind): string {
  switch (kind) {
    case "webrtc":
      return "WebRTC DataChannel";
    case "mock":
      return "Fixture";
  }
}

export interface DogfoodRuntimeConfig {
  mode: DogfoodModeName;
  statusText: string;
  transport: HubControlTransport;
  terminalDescriptor: TerminalViewDescriptor;
  terminalDataPlane: TerminalDataPlaneAttachment;
  terminalDataPlaneKind: TerminalDataPlaneKind;
  startupError?: WebrtcDaemonClientError;
  createTerminalDataPlane(sessionId: string): TerminalDataPlaneAttachment;
}

export interface DogfoodRuntimeConfigOptions {
  locationHref: string;
  bridge?: DaemonBridgeClient;
  signalingUrl?: string;
  packageRuntime?: boolean;
  localWebrtcBootstrap?: LocalWebrtcBootstrap;
}

const fixtureSessionId = "terminal_view_smoke_session";

export function createDogfoodRuntimeConfig(options: DogfoodRuntimeConfigOptions): DogfoodRuntimeConfig {
  if (options.packageRuntime) {
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
      transport: createRealHubDogfoodTransport({ bridge }),
      terminalDescriptor: {
        sessionId: realHubDogfoodSessionId,
        renderer: "restty"
      },
      terminalDataPlane: createRealHubTerminalDataPlane({ bridge }),
      terminalDataPlaneKind: "webrtc",
      startupError,
      createTerminalDataPlane: (sessionId) => createRealHubTerminalDataPlane({ bridge, sessionId })
    };
  }

  const fixtureTerminalDataPlane = new MockTerminalDataPlane(fixtureSessionId, [
    "botster-web terminal_view bridge\r\n",
    "Restty renderer attached through mock terminal data plane.\r\n"
  ]);

  return {
    mode: "fixture",
    statusText: "Waiting for local hub fixture frames",
    transport: createLocalDogfoodTransport(),
    terminalDescriptor: {
      sessionId: fixtureSessionId,
      renderer: "restty"
    },
    terminalDataPlane: fixtureTerminalDataPlane,
    terminalDataPlaneKind: "mock",
    createTerminalDataPlane: (sessionId) =>
      sessionId === fixtureSessionId
        ? fixtureTerminalDataPlane
        : new MockTerminalDataPlane(sessionId, [])
  };
}

function unavailableDaemonClient(error: WebrtcDaemonClientError): DaemonBridgeClient {
  return {
    request: () => Promise.reject(error)
  };
}
