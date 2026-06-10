import { createLocalDogfoodTransport } from "./localDogfoodTransport";
import {
  createHttpDaemonBridgeClient,
  createRealHubDogfoodTransport,
  realHubDogfoodSessionId,
  type DaemonBridgeClient
} from "./realHubDogfoodTransport";
import { createRealHubTerminalDataPlane } from "./realHubTerminalDataPlane";
import type { HubControlTransport } from "./protocol";
import { MockTerminalDataPlane, type TerminalDataPlaneAttachment, type TerminalViewDescriptor } from "./terminal";

export type DogfoodModeName = "fixture" | "real-hub";
export type TerminalDataPlaneKind = "mock" | "real-hub";

export interface DogfoodRuntimeConfig {
  mode: DogfoodModeName;
  statusText: string;
  transport: HubControlTransport;
  terminalDescriptor: TerminalViewDescriptor;
  terminalDataPlane: TerminalDataPlaneAttachment;
  terminalDataPlaneKind: TerminalDataPlaneKind;
}

export interface DogfoodRuntimeConfigOptions {
  env: Record<string, string | boolean | undefined>;
  locationHref: string;
  bridge?: DaemonBridgeClient;
  bridgeUrl?: string;
  packageRuntime?: boolean;
}

const realModeQueryValue = "real-hub";
const defaultBridgeUrl = "http://127.0.0.1:41739/request";
const fixtureSessionId = "terminal_view_smoke_session";

export function createDogfoodRuntimeConfig(options: DogfoodRuntimeConfigOptions): DogfoodRuntimeConfig {
  if (isRealHubDogfoodEnabled(options)) {
    const bridge = options.bridge ?? createHttpDaemonBridgeClient({ url: options.bridgeUrl ?? defaultBridgeUrl });

    return {
      mode: "real-hub",
      statusText: "Connected to isolated real hub dogfood bridge",
      transport: createRealHubDogfoodTransport({ bridge }),
      terminalDescriptor: {
        sessionId: realHubDogfoodSessionId,
        renderer: "restty"
      },
      terminalDataPlane: createRealHubTerminalDataPlane({ bridge }),
      terminalDataPlaneKind: "real-hub"
    };
  }

  return {
    mode: "fixture",
    statusText: "Waiting for local hub fixture frames",
    transport: createLocalDogfoodTransport(),
    terminalDescriptor: {
      sessionId: fixtureSessionId,
      renderer: "restty"
    },
    terminalDataPlane: new MockTerminalDataPlane(fixtureSessionId, [
      "botster-web terminal_view bridge\r\n",
      "Restty renderer attached through mock terminal data plane.\r\n"
    ]),
    terminalDataPlaneKind: "mock"
  };
}

export function isRealHubDogfoodEnabled(options: Pick<DogfoodRuntimeConfigOptions, "env" | "locationHref" | "packageRuntime">): boolean {
  const envEnabled = options.env.VITE_BOTSTER_REAL_HUB_DOGFOOD === "1" || options.env.VITE_BOTSTER_REAL_HUB_DOGFOOD === true;
  const url = new URL(options.locationHref, "http://botster-web.local/");
  const realModeRequested = url.searchParams.get("dogfood") === realModeQueryValue;
  return Boolean(options.packageRuntime) || (envEnabled && realModeRequested);
}
