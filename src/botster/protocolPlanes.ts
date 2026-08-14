import hubMetadata from "@trybotster/hub-test-support/metadata";
import {
  CONFORMANCE_FIXTURE_REVISION as TERMINAL_CONFORMANCE,
  FEATURE_RESIZE,
  FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY,
  FEATURE_TERMINAL_STREAMING,
  PROTOCOL as TERMINAL_PROTOCOL,
  PROTOCOL_VERSION as TERMINAL_PROTOCOL_VERSION
} from "@trybotster/terminal-protocol";
import type { DaemonCompatibilityRequirement } from "./realHubDaemonDto";
import type { TerminalCompatibilityRequirement } from "@trybotster/terminal-protocol";

export const webClientName = "botster-web";

export const requiredHostFeatures = [
  "sessions",
  "terminal_readback",
  "plugin_surface_render",
  "plugin_surface_action",
  "mode_gated_input",
  "webrtc_terminal_adapter",
  "terminal_subscription_closed"
] as const;

export const requiredTerminalFeatures = [
  FEATURE_TERMINAL_STREAMING,
  FEATURE_RESIZE,
  FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY
] as const;

export const hostCompatibilityRequirement: DaemonCompatibilityRequirement = {
  protocol: hubMetadata.protocol,
  protocol_version: hubMetadata.protocol_version,
  required_features: [...requiredHostFeatures],
  minimum_conformance_fixture_revision: hubMetadata.conformance_fixture_revision,
  client_name: webClientName
};

export const terminalCompatibilityRequirement: TerminalCompatibilityRequirement = {
  protocol: TERMINAL_PROTOCOL,
  protocol_version: TERMINAL_PROTOCOL_VERSION,
  required_features: [...requiredTerminalFeatures],
  minimum_conformance_fixture_revision: TERMINAL_CONFORMANCE,
  client_name: webClientName
};

export const hostHelloProtocol = hubMetadata.protocol;
export const hostHelloProtocolVersion = hubMetadata.protocol_version;
export const hostHelloConformanceRevision = hubMetadata.conformance_fixture_revision;
