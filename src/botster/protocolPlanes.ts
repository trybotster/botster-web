import {
  CONFORMANCE_FIXTURE_REVISION as HOST_CONFORMANCE,
  PROTOCOL as HOST_PROTOCOL,
  PROTOCOL_VERSION as HOST_PROTOCOL_VERSION
} from "./generated/daemon-protocol";
import {
  CONFORMANCE_FIXTURE_REVISION as TERMINAL_CONFORMANCE,
  FEATURE_RESIZE,
  FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY,
  FEATURE_TERMINAL_STREAMING,
  FEATURE_TRANSPORT_DUPLEX_BINARY,
  PROTOCOL as TERMINAL_PROTOCOL,
  PROTOCOL_VERSION as TERMINAL_PROTOCOL_VERSION
} from "./generated/terminal-protocol";
import type { DaemonCompatibilityRequirement } from "./realHubDaemonDto";
import type { TerminalCompatibilityRequirement } from "./generated/terminal-protocol";

export const webClientName = "botster-web";

export const requiredHostFeatures = [
  "sessions",
  "terminal_readback",
  "plugin_surface_render",
  "plugin_surface_action",
  "webrtc_terminal_adapter",
  "terminal_subscription_closed",
  "package_event_subscriptions"
] as const;

export const requiredTerminalFeatures = [
  FEATURE_TERMINAL_STREAMING,
  FEATURE_RESIZE,
  FEATURE_TRANSPORT_DUPLEX_BINARY,
  FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY
] as const;

export const hostCompatibilityRequirement: DaemonCompatibilityRequirement = {
  protocol: HOST_PROTOCOL,
  protocol_version: HOST_PROTOCOL_VERSION,
  required_features: [...requiredHostFeatures],
  minimum_conformance_fixture_revision: HOST_CONFORMANCE,
  client_name: webClientName
};

export const terminalCompatibilityRequirement: TerminalCompatibilityRequirement = {
  protocol: TERMINAL_PROTOCOL,
  protocol_version: TERMINAL_PROTOCOL_VERSION,
  required_features: [...requiredTerminalFeatures],
  minimum_conformance_fixture_revision: TERMINAL_CONFORMANCE,
  client_name: webClientName
};

export const hostHelloProtocol = HOST_PROTOCOL;
export const hostHelloProtocolVersion = HOST_PROTOCOL_VERSION;
export const hostHelloConformanceRevision = HOST_CONFORMANCE;
