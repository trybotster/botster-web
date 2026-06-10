import { isAbsolute, join, resolve } from "node:path";

export function resolveDogfoodBridgeMode(env, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const generatedDataDir = options.generatedDataDir;
  const existingSocket = resolvePath(env.BOTSTER_HUB_SOCKET, cwd);
  const existingDataDir = resolvePath(env.BOTSTER_HUB_DATA_DIR, cwd);
  const spawnedDataDir = env.BOTSTER_WEB_DOGFOOD_DATA_DIR;
  const hasExistingHubConfig = Boolean(existingSocket || existingDataDir);

  if (hasExistingHubConfig && spawnedDataDir) {
    return {
      ok: false,
      error:
        "BOTSTER_HUB_SOCKET/BOTSTER_HUB_DATA_DIR cannot be combined with BOTSTER_WEB_DOGFOOD_DATA_DIR; existing-hub mode never owns bridge data-dir cleanup."
    };
  }

  if (existingSocket) {
    return {
      ok: true,
      mode: "existing_hub",
      source: "socket",
      diagnosticLabel: "existing hub socket",
      socketPath: existingSocket,
      ownsHub: false,
      ownsDataDir: false,
      keepData: true,
      health: { ok: true, mode: "existing_hub", source: "socket", socket: "configured" }
    };
  }

  if (existingDataDir) {
    return {
      ok: true,
      mode: "existing_hub",
      source: "data_dir",
      diagnosticLabel: "existing hub data dir",
      dataDir: existingDataDir,
      socketPath: join(existingDataDir, "botster-hub.sock"),
      ownsHub: false,
      ownsDataDir: false,
      keepData: true,
      health: { ok: true, mode: "existing_hub", source: "data_dir", data_dir: "configured", socket: "derived" }
    };
  }

  const hubBin = resolvePath(env.BOTSTER_HUB_BIN, cwd);
  if (!hubBin) {
    return {
      ok: false,
      error: "BOTSTER_HUB_BIN must point to a botster-hub binary."
    };
  }

  const dataDir = resolvePath(spawnedDataDir, cwd) ?? generatedDataDir;
  if (!dataDir) {
    return {
      ok: false,
      error: "spawned bridge mode requires a data directory."
    };
  }

  const sessionWorkerBin = resolvePath(env.BOTSTER_SESSION_WORKER_BIN, cwd);
  const hubArgs = ["start", "--data-dir", dataDir];

  if (sessionWorkerBin) {
    hubArgs.push("--session-worker-bin", sessionWorkerBin);
  }

  return {
    ok: true,
    mode: "spawned_hub",
    source: "spawned_isolated",
    diagnosticLabel: "spawned isolated hub",
    hubBin,
    sessionWorkerBin,
    dataDir,
    socketPath: join(dataDir, "botster-hub.sock"),
    hubArgs,
    ownsHub: true,
    ownsDataDir: !spawnedDataDir,
    keepData: env.BOTSTER_WEB_DOGFOOD_KEEP_DATA === "1",
    health: {
      ok: true,
      mode: "spawned_hub",
      source: "spawned_isolated",
      data_dir: spawnedDataDir ? "configured" : "<isolated-temp-dir>",
      socket: "derived"
    }
  };
}

export function dogfoodBridgeShutdownPlan(config) {
  return {
    sendDaemonShutdown: config.ownsHub,
    terminateHubProcess: config.ownsHub,
    removeDataDir: config.ownsDataDir && !config.keepData
  };
}

function resolvePath(path, cwd) {
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(cwd, path);
}
