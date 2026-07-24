// Pinned to trybotster/botster-core merge 16bf08f29ec723c70c290cf995745ccbf79d4f05.
// Contract assets: crates/botster-core-test-support/fixtures/runnable-entrypoint-hub-connection.

export function decodeHubConnection(serialized) {
  if (typeof serialized !== "string" || serialized.trim() === "") {
    throw new HubConnectionError("missing_hub_connection", "BOTSTER_HUB_CONNECTION is required.");
  }

  let descriptor;
  try {
    descriptor = JSON.parse(serialized);
  } catch {
    throw new HubConnectionError("malformed_hub_connection", "BOTSTER_HUB_CONNECTION must contain valid JSON.");
  }

  if (!isRecord(descriptor) || !hasExactKeys(descriptor, ["transport"])) {
    throw new HubConnectionError(
      "invalid_hub_connection",
      "Hub connection descriptor must contain only transport."
    );
  }

  const transport = descriptor.transport;
  if (
    !isRecord(transport) ||
    !hasExactKeys(transport, ["type", "path"]) ||
    transport.type !== "unix_socket" ||
    typeof transport.path !== "string" ||
    !transport.path.startsWith("/")
  ) {
    throw new HubConnectionError(
      "invalid_hub_connection_transport",
      "Hub connection transport must be unix_socket with an absolute path."
    );
  }

  return Object.freeze({
    transport: Object.freeze({ type: "unix_socket", path: transport.path })
  });
}

export class HubConnectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HubConnectionError";
    this.code = code;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}
