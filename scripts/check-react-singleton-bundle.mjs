import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist/assets");
const indexFiles = readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name));
if (indexFiles.length !== 1) {
  throw new Error(`expected one dist/assets/index-*.js, got ${JSON.stringify(indexFiles)}`);
}

const file = indexFiles[0];
const source = readFileSync(join(assetsDir, file), "utf8");
const useMemoWrappers = source.split(".useMemo=function").length - 1;
if (useMemoWrappers !== 1) {
  throw new Error(
    `expected one React useMemo wrapper in ${file} after resolve.dedupe, got ${useMemoWrappers}`
  );
}

console.log(`react-singleton-bundle-passed ${JSON.stringify({ file, useMemoWrappers })}`);
