import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const vendoredPath = resolve(repoRoot, "src/botster/generated/daemon-protocol.ts");

async function authoritativeProtocol() {
  if (process.env.BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL) {
    const overridePath = resolve(process.env.BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL);
    return {
      label: overridePath,
      contents: await readFile(overridePath, "utf8")
    };
  }

  const {
    metadata: hubTestSupportMetadata,
    readDaemonProtocolTypescript,
    verifyPackageAssets
  } = await loadHubTestSupport();
  const assetCheck = verifyPackageAssets();
  if (!assetCheck.ok) {
    throw new Error(
      [
        "Daemon protocol drift check requires a valid @trybotster/hub-test-support artifact.",
        `package: ${hubTestSupportMetadata.package_name}@${hubTestSupportMetadata.package_version}`,
        `artifact: ${hubTestSupportMetadata.daemon_protocol.artifact_path}`,
        `failures: ${assetCheck.failures.join(", ")}`,
        "Run npm install so the declared devDependency is present, or set BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL for a local override."
      ].join("\n")
    );
  }

  return {
    label: `${hubTestSupportMetadata.package_name}@${hubTestSupportMetadata.package_version}:${hubTestSupportMetadata.daemon_protocol.artifact_path}`,
    contents: readDaemonProtocolTypescript()
  };
}

async function loadHubTestSupport() {
  try {
    return await import("@trybotster/hub-test-support");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        [
          "Daemon protocol drift check requires the declared @trybotster/hub-test-support devDependency.",
          "Run npm install so the artifact package is present, or set BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL for a local override."
        ].join("\n"),
        { cause: error }
      );
    }
    throw error;
  }
}

const vendoredProtocol = await readFile(vendoredPath, "utf8");
const sourceProtocol = await authoritativeProtocol();

if (vendoredProtocol !== sourceProtocol.contents) {
  throw new Error(
    [
      "Vendored daemon protocol drift detected.",
      `botster-web: ${vendoredPath}`,
      `hub artifact: ${sourceProtocol.label}`,
      "Copy the generated hub artifact into botster-web instead of editing protocol DTOs by hand."
    ].join("\n")
  );
}
