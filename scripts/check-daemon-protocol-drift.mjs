import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Generated protocol artifacts are copied verbatim from their owning repositories at a
 * recorded revision. This check proves each vendored copy still matches the SHA-256 recorded
 * in PROVENANCE.json, so a hand edit or a partial copy fails before any test runs.
 */
const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const generatedDir = resolve(repoRoot, "src/botster/generated");
const provenancePath = resolve(generatedDir, "PROVENANCE.json");

const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const artifacts = provenance?.artifacts;
if (!artifacts || typeof artifacts !== "object" || Object.keys(artifacts).length === 0) {
  throw new Error(`No generated artifacts are recorded in ${provenancePath}.`);
}

const failures = [];
for (const [fileName, entry] of Object.entries(artifacts)) {
  const vendoredPath = resolve(generatedDir, fileName);
  const contents = await readFile(vendoredPath);
  const actual = createHash("sha256").update(contents).digest("hex");
  if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    failures.push(`${fileName}: PROVENANCE.json has no valid sha256.`);
    continue;
  }
  if (actual !== entry.sha256) {
    failures.push(
      `${fileName}: vendored copy sha256 ${actual} does not match recorded ${entry.sha256} ` +
        `(${entry.owner} ${entry.revision} ${entry.source_path}). Copy the generated artifact again; never edit it by hand.`
    );
  }
}

if (failures.length > 0) {
  throw new Error(["Generated protocol artifact drift detected.", ...failures].join("\n"));
}
