import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, sep } from "node:path";
import { chromium } from "playwright";

const host = "127.0.0.1";
const distRoot = join(process.cwd(), "dist");
const indexPath = join(distRoot, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}`);
  const assetPath = safeAssetPath(url.pathname);
  if (assetPath) {
    try {
      const asset = await readFile(assetPath);
      response.writeHead(200, { "content-type": contentType(assetPath) });
      response.end(asset);
      return;
    } catch {
      response.writeHead(404);
      response.end();
      return;
    }
  }

  const packageRuntimeScript = url.pathname === "/missing-bootstrap"
    ? "<script>window.__BOTSTER_PACKAGE_RUNTIME__ = true;</script>"
    : "";
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(indexHtml.replace("<head>", `<head>${packageRuntimeScript}`));
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, host, resolve);
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("browser runtime smoke server did not bind a TCP port");
}
const origin = `http://${host}:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  await proveMissingBootstrapDiagnostic();
  console.log("browser runtime interaction smoke passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function proveMissingBootstrapDiagnostic() {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${origin}/missing-bootstrap`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Your sessions" }).waitFor();

  await page.getByRole("button", { name: "Needs attention" }).click();
  const diagnosticsView = page.getByTestId("diagnostics-view");
  await diagnosticsView.getByText("Developer details", { exact: true }).click();
  const diagnosticsWorkflow = page.getByTestId("diagnostics-workflow");
  await diagnosticsWorkflow.getByText("Local WebRTC bootstrap failed", { exact: true }).waitFor();
  await diagnosticsWorkflow.getByText("Botster package runtime requires a valid local WebRTC bootstrap grant.", { exact: true }).waitFor();
  assertNoPageErrors("missing-bootstrap diagnostic", pageErrors);
  await page.close();
}

function safeAssetPath(pathname) {
  if (!pathname.startsWith("/assets/")) return undefined;
  const candidate = normalize(join(distRoot, pathname));
  const relativePath = relative(distRoot, candidate);
  if (relativePath.startsWith(`..${sep}`) || relativePath === "..") return undefined;
  return candidate;
}

function contentType(path) {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function assertNoPageErrors(label, errors) {
  if (errors.length > 0) {
    throw new Error(`${label} raised browser errors: ${errors.join(" | ")}`);
  }
}
