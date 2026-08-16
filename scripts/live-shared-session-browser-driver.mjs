import { assertCallerOwnedSharedSessionContract } from "./live-packaged-protocol-helpers.mjs";

const contract = assertCallerOwnedSharedSessionContract();
if (!contract.mode) {
  throw new Error(
    "shared-session browser driver requires BOTSTER_LIVE_DATA_DIR and BOTSTER_SHARED_SESSION_ID"
  );
}

await import("./live-packaged-protocol-harness.mjs");
