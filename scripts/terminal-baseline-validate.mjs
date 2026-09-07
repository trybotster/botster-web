import { readFile } from "node:fs/promises";
import { validateObservationRecord } from "./terminal-baseline-observation-format.mjs";

const recordPath = process.argv[2];
if (!recordPath) {
  throw new Error("record path is required");
}

const record = JSON.parse(await readFile(recordPath, "utf8"));
const result = validateObservationRecord(record);
if (!result.ok) {
  process.stderr.write(`${result.errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`valid ${record.capture_id} format_version=${record.format_version}\n`);
}
