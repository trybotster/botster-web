import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  metadata as hubTestSupportMetadata,
  readFirstPartyClientSupportMatrix
} from "@trybotster/hub-test-support";

const generatedDaemonProtocol = await (async () => {
  const source = readFileSync(
    new URL("../src/botster/generated/daemon-protocol.ts", import.meta.url),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
})();

export const daemonProtocol = generatedDaemonProtocol.PROTOCOL;

export const daemonUnixFraming = Object.freeze({
  lengthPrefixBytes: generatedDaemonProtocol.UNIX_FRAME_LENGTH_PREFIX_BYTES,
  controlContainer: generatedDaemonProtocol.UNIX_CONTAINER_CONTROL,
  terminalContainer: generatedDaemonProtocol.UNIX_CONTAINER_TERMINAL,
  maxTerminalRouteBytes: generatedDaemonProtocol.MAX_UNIX_TERMINAL_ROUTE_BYTES,
  maxFrameBytes: generatedDaemonProtocol.MAX_UNIX_FRAME_BYTES
});

export function daemonCompatibilityRequirement(clientName, requiredFeatures) {
  const supportMatrix = readFirstPartyClientSupportMatrix();
  const supportedFeatures = Array.isArray(supportMatrix.supported_features)
    ? supportMatrix.supported_features
    : [];
  if (
    hubTestSupportMetadata.protocol !== daemonProtocol ||
    supportMatrix.protocol !== daemonProtocol ||
    supportMatrix.protocol_version !== hubTestSupportMetadata.protocol_version ||
    supportMatrix.conformance_fixture_revision !== hubTestSupportMetadata.conformance_fixture_revision ||
    !Array.isArray(requiredFeatures) ||
    requiredFeatures.some((feature) => typeof feature !== "string") ||
    requiredFeatures.some((feature) => !supportedFeatures.includes(feature))
  ) {
    throw new Error("vendored Hub support metadata is inconsistent");
  }
  return {
    protocol: daemonProtocol,
    protocol_version: hubTestSupportMetadata.protocol_version,
    required_features: [...requiredFeatures],
    minimum_conformance_fixture_revision: hubTestSupportMetadata.conformance_fixture_revision,
    client_name: clientName
  };
}

export function firstPartyClientCompatibilityRequirement(clientName) {
  const supportMatrix = readFirstPartyClientSupportMatrix();
  return daemonCompatibilityRequirement(clientName, supportMatrix.required_features);
}
