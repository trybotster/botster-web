import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const vendoredPath = resolve(repoRoot, "src/botster/generated/daemon-protocol.ts");
const sourcePath = process.env.BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL
  ? resolve(process.env.BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL)
  : resolve(repoRoot, "../botster-hub/crates/botster-hub-client/generated/daemon-protocol.ts");

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

if (!(await fileExists(sourcePath))) {
  console.warn(
    [
      "Skipping daemon protocol drift check: source botster-hub-client artifact is missing.",
      `hub source: ${sourcePath}`,
      "Set BOTSTER_HUB_CLIENT_DAEMON_PROTOCOL or check out ../botster-hub to enable drift verification."
    ].join("\n")
  );
  process.exit(0);
}

const [vendoredProtocol, sourceProtocol] = await Promise.all([
  readFile(vendoredPath, "utf8"),
  readFile(sourcePath, "utf8")
]);

if (vendoredProtocol !== sourceProtocol) {
  throw new Error(
    [
      "Vendored daemon protocol drift detected.",
      `botster-web: ${vendoredPath}`,
      `hub source: ${sourcePath}`,
      "Copy the generated hub artifact into botster-web instead of editing protocol DTOs by hand."
    ].join("\n")
  );
}
