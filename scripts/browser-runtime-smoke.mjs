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
  await proveHubSettingsOnMobile();
  await proveHubGeneralWithoutHub();
  console.log("browser runtime interaction smoke passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function proveHubSettingsOnMobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${origin}/missing-bootstrap`, { waitUntil: "networkidle" });
  await openHubSettings(page);
  await page.getByRole("heading", { name: "Hub settings", exact: true }).waitFor();
  const settingsNavigation = page.getByLabel("Hub settings sections");
  await assertHubSettingsHeadingHierarchy(page, settingsNavigation);
  await settingsNavigation.getByRole("button", { name: /Spawn points/ }).click();
  await page.getByTestId("spawn-points-view").waitFor();
  assertNoPageErrors("mobile Hub settings", pageErrors);
  await page.close();
}

/**
 * This harness serves static dist plus a single injected __BOTSTER_PACKAGE_RUNTIME__ flag
 * with no Hub bridge, so createHubRuntimeConfig falls back to unavailableDaemonClient and
 * botster-web.hub_status can never populate here. That makes it the right home for the
 * no-Hub and offline rendering of the General section, and the wrong place to prove
 * populated identity or a real update check — those live in the live packaged-protocol
 * harness against a real Hub.
 */
async function proveHubGeneralWithoutHub() {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${origin}/settings`, { waitUntil: "networkidle" });
  const general = page.getByTestId("hub-settings-general");
  await general.waitFor();
  await page.getByRole("heading", { name: "General", exact: true }).waitFor({ state: "visible" });

  // Honest fallbacks with no Hub reachable: never a fabricated version, and never the
  // permanently-"unknown" rendering that numeric coercion used to produce.
  const softwareIdentity = await general.getByTestId("hub-software-identity").innerText();
  for (const [label, expected] of [["Software", "Not reported"], ["Version", "Not reported"]]) {
    if (!new RegExp(`${label}\\s*\\n?\\s*${expected}`).test(softwareIdentity)) {
      throw new Error(`Hub General ${label} did not render "${expected}" with no Hub: ${softwareIdentity}`);
    }
  }
  if (/\bBotster Hub\b|\b\d+\.\d+\.\d+\b/.test(softwareIdentity)) {
    throw new Error(`Hub General fabricated software identity with no Hub: ${softwareIdentity}`);
  }
  const internalState = await general.getByTestId("hub-internal-state").innerText();
  if (/unknown/i.test(`${softwareIdentity}\n${internalState}`)) {
    throw new Error(`Hub General still renders "unknown" instead of "Not reported": ${internalState}`);
  }

  // State schema stays present but secondary to user-facing software status.
  const ordering = await general.evaluate((section) => {
    const nodes = Array.from(section.querySelectorAll("[data-testid]"));
    return nodes.map((node) => node.getAttribute("data-testid"));
  });
  if (ordering.indexOf("hub-software-identity") > ordering.indexOf("hub-internal-state")) {
    throw new Error(`State schema is not secondary to software status: ${ordering.join(", ")}`);
  }
  if (!/State schema/.test(internalState)) {
    throw new Error(`State schema is not rendered at all: ${internalState}`);
  }

  // Check for updates is present and, with no Hub reachable, renders the offline outcome
  // from the rejected action result rather than any DaemonHubUpdateState.
  const updateRegion = general.getByTestId("hub-software-update");
  await updateRegion.getByRole("button", { name: "Check for updates", exact: true }).click();
  await general.getByTestId("hub-update-outcome").filter({ hasText: /Update check failed/ }).waitFor();
  const updateOutcome = await general.getByTestId("hub-update-outcome").innerText();
  if (await updateRegion.getAttribute("data-hub-update-state") !== null) {
    throw new Error(`Offline update check synthesized a DaemonHubUpdateState: ${updateOutcome}`);
  }
  if (await general.getByTestId("hub-update-action").count() !== 0) {
    throw new Error("Offline update check rendered a Hub-authored action it never received");
  }

  assertNoPageErrors("Hub General without a Hub", pageErrors);
  await page.close();
}

async function proveMissingBootstrapDiagnostic() {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${origin}/missing-bootstrap`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Your sessions" }).waitFor();

  const sidebarGeometry = await page.locator("ion-menu.app-sidebar").evaluate((menu) => {
    const container = menu.shadowRoot?.querySelector(".menu-inner");
    const hostBounds = menu.getBoundingClientRect();
    const containerBounds = container?.getBoundingClientRect();
    return {
      viewportHeight: globalThis.innerHeight,
      host: { top: hostBounds.top, bottom: hostBounds.bottom, height: hostBounds.height, borderRadius: globalThis.getComputedStyle(menu).borderRadius },
      container: containerBounds ? { top: containerBounds.top, bottom: containerBounds.bottom, height: containerBounds.height, borderRadius: globalThis.getComputedStyle(container).borderRadius } : null
    };
  });
  if (
    sidebarGeometry.host.top !== 0 ||
    sidebarGeometry.host.bottom !== sidebarGeometry.viewportHeight ||
    sidebarGeometry.host.borderRadius !== "0px" ||
    !sidebarGeometry.container ||
    sidebarGeometry.container.top !== 0 ||
    sidebarGeometry.container.bottom !== sidebarGeometry.viewportHeight ||
    sidebarGeometry.container.borderRadius !== "0px"
  ) {
    throw new Error(`Sidebar surface does not fill the viewport: ${JSON.stringify(sidebarGeometry)}`);
  }

  await openHubSettings(page);
  await page.getByLabel("Hub settings sections").getByRole("button", { name: /Support/ }).click();
  const diagnosticsView = page.getByTestId("diagnostics-view");
  await diagnosticsView.getByText("Developer details", { exact: true }).click();
  const diagnosticsWorkflow = page.getByTestId("diagnostics-workflow");
  await diagnosticsWorkflow.getByText("Local WebRTC bootstrap failed", { exact: true }).waitFor();
  await diagnosticsWorkflow.getByText("Botster package runtime requires a valid local WebRTC bootstrap grant.", { exact: true }).waitFor();
  assertNoPageErrors("missing-bootstrap diagnostic", pageErrors);
  await page.close();
}

async function openHubSettings(page) {
  const menuButton = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  const sidebar = page.locator("ion-menu.app-sidebar");
  const settingsButton = sidebar.getByRole("button", { name: "Hub settings", exact: true });
  await settingsButton.waitFor({ state: "visible" });
  const [sidebarBounds, settingsBounds] = await Promise.all([
    sidebar.boundingBox(),
    settingsButton.boundingBox()
  ]);
  const bottomGap = sidebarBounds && settingsBounds
    ? sidebarBounds.y + sidebarBounds.height - (settingsBounds.y + settingsBounds.height)
    : undefined;
  if (bottomGap === undefined || bottomGap > 20) {
    throw new Error(`Hub settings is not pinned to the bottom of the sidebar: gap=${String(bottomGap)}`);
  }
  await settingsButton.click();
}

async function assertHubSettingsHeadingHierarchy(page, settingsNavigation) {
  const sections = [
    ["General", "General"],
    ["Session types", "Session types"],
    ["Extensions", "Extension configuration"],
    ["Spawn points", "Spawn points"],
    ["Support", "Support"]
  ];
  const headingSizes = [];
  for (const [tabName, headingName] of sections) {
    await settingsNavigation.getByRole("button", { name: new RegExp(`^${tabName}`) }).click();
    const heading = page.getByRole("heading", { name: headingName, exact: true });
    await heading.waitFor({ state: "visible" });
    headingSizes.push(await heading.evaluate((element) => globalThis.getComputedStyle(element).fontSize));
  }
  if (new Set(headingSizes).size !== 1) {
    throw new Error(`Hub settings headings use inconsistent sizes: ${headingSizes.join(", ")}`);
  }
  const supportHeading = page.getByRole("heading", { name: "Support", exact: true });
  const healthHeading = page.getByRole("heading", { name: "Local Botster health", exact: true });
  const healthSummary = page.getByLabel("Local hub health summary");
  const healthCardHeading = healthSummary.getByRole("heading", { name: "Hub", exact: true });
  const hierarchy = await Promise.all([
    supportHeading.evaluate((element) => ({ tagName: element.tagName, size: Number.parseFloat(globalThis.getComputedStyle(element).fontSize) })),
    healthHeading.evaluate((element) => ({ tagName: element.tagName, size: Number.parseFloat(globalThis.getComputedStyle(element).fontSize) })),
    healthCardHeading.evaluate((element) => ({ tagName: element.tagName, size: Number.parseFloat(globalThis.getComputedStyle(element).fontSize) }))
  ]);
  if (
    hierarchy[0].tagName !== "H2"
    || hierarchy[1].tagName !== "H3"
    || hierarchy[2].tagName !== "H4"
    || hierarchy[1].size >= hierarchy[0].size
    || hierarchy[2].size >= hierarchy[1].size
  ) {
    throw new Error(`Hub settings heading hierarchy is invalid: ${JSON.stringify(hierarchy)}`);
  }
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
