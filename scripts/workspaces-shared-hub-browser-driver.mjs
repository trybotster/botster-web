import {
  assertNoRequiredSmokeSkip,
  parseWorkspacesSpawnAssignment
} from "./workspaces-shared-hub-browser-helpers.mjs";

assertNoRequiredSmokeSkip();

if (typeof process.env.BOTSTER_LIVE_DATA_DIR !== "string" || process.env.BOTSTER_LIVE_DATA_DIR.trim() === "") {
  throw new Error("shared-Hub browser driver requires caller-owned BOTSTER_LIVE_DATA_DIR");
}
parseWorkspacesSpawnAssignment(process.env.BOTSTER_WORKSPACES_SPAWN_CASES);

process.env.BOTSTER_LIVE_SHARED_HUB_DRIVER = "1";
await import("./live-packaged-protocol-harness.mjs");
