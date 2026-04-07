import fs from "node:fs";
import path from "node:path";

const metadataPathRelative = path.join(".artifacts", "e2e", "playwright-browser-install.json");

export function parsePlaywrightDryRunInstallLocations(output) {
  return Array.from(output.matchAll(/Install location:\s+(.+)$/gm), (match) => match[1].trim())
    .filter(Boolean);
}

export function normalizeInstallLocation(location) {
  return path.normalize(location);
}

export function buildPlaywrightBrowserMetadata({
  browser = "chromium",
  installLocations,
  playwrightVersion,
  browsersPathEnv = process.env.PLAYWRIGHT_BROWSERS_PATH ?? null
}) {
  return {
    browser,
    browsersPathEnv,
    installLocations: installLocations.map(normalizeInstallLocation),
    playwrightVersion,
    savedAt: new Date().toISOString()
  };
}

export function getPlaywrightBrowserMetadataPath(repoRoot = process.cwd()) {
  return path.join(repoRoot, metadataPathRelative);
}

export function loadPlaywrightBrowserMetadata(repoRoot = process.cwd()) {
  const metadataPath = getPlaywrightBrowserMetadataPath(repoRoot);

  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {
    return null;
  }
}

export function savePlaywrightBrowserMetadata(metadata, repoRoot = process.cwd()) {
  const metadataPath = getPlaywrightBrowserMetadataPath(repoRoot);
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

export function clearPlaywrightBrowserMetadata(repoRoot = process.cwd()) {
  fs.rmSync(getPlaywrightBrowserMetadataPath(repoRoot), { force: true });
}

export function isPlaywrightBrowserInstallSatisfied(metadata, expected) {
  if (!metadata) {
    return false;
  }

  if (metadata.browser !== expected.browser) {
    return false;
  }

  if (metadata.playwrightVersion !== expected.playwrightVersion) {
    return false;
  }

  if ((metadata.browsersPathEnv ?? null) !== (expected.browsersPathEnv ?? null)) {
    return false;
  }

  if (!Array.isArray(metadata.installLocations) || metadata.installLocations.length === 0) {
    return false;
  }

  return metadata.installLocations.every((installLocation) => fs.existsSync(normalizeInstallLocation(installLocation)));
}
