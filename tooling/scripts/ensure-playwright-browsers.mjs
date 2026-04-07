import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveE2eExecutionSummary } from "./lib/e2e-execution-summary.mjs";
import {
  buildPlaywrightBrowserMetadata,
  clearPlaywrightBrowserMetadata,
  isPlaywrightBrowserInstallSatisfied,
  loadPlaywrightBrowserMetadata,
  parsePlaywrightDryRunInstallLocations,
  savePlaywrightBrowserMetadata
} from "./lib/playwright-browser-install.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const e2eRoot = path.join(repoRoot, "apps", "e2e");
const browserName = process.argv[2] ?? "chromium";
const requireFromE2e = createRequire(path.join(e2eRoot, "package.json"));
const playwrightPackagePath = requireFromE2e.resolve("@playwright/test/package.json");
const playwrightCliPath = path.join(path.dirname(playwrightPackagePath), "cli.js");
const playwrightVersion = requireFromE2e(playwrightPackagePath).version;
const nodeBinary = process.execPath && path.isAbsolute(process.execPath) && existsSync(process.execPath)
  ? process.execPath
  : (process.platform === "win32" ? "node.exe" : "node");

function runPlaywrightCommand(args) {
  return execFileSync(nodeBinary, [playwrightCliPath, ...args], {
    cwd: e2eRoot,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function getExpectedInstallState() {
  return {
    browser: browserName,
    browsersPathEnv: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
    playwrightVersion
  };
}

function resolveInstallMetadata() {
  const dryRunOutput = runPlaywrightCommand(["install", "--dry-run", browserName]);
  const installLocations = parsePlaywrightDryRunInstallLocations(dryRunOutput);

  if (installLocations.length === 0) {
    throw new Error(`Could not determine Playwright install locations for ${browserName}.`);
  }

  return buildPlaywrightBrowserMetadata({
    browser: browserName,
    browsersPathEnv: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
    installLocations,
    playwrightVersion
  });
}

function main() {
  const startedAtMs = Date.now();
  const expectedState = getExpectedInstallState();
  const cachedMetadata = loadPlaywrightBrowserMetadata(repoRoot);

  if (isPlaywrightBrowserInstallSatisfied(cachedMetadata, expectedState)) {
    saveE2eExecutionSummary("browserInstall", {
      browser: browserName,
      createdAt: new Date().toISOString(),
      mode: "skip",
      playwrightVersion,
      reason: "The current Playwright browser install metadata is still valid.",
      timings: {
        totalMs: Date.now() - startedAtMs
      }
    }, repoRoot);
    console.log(`Playwright ${browserName} browsers already installed for v${playwrightVersion}. Skipping browser install.`);
    return;
  }

  const dryRunStartedAtMs = Date.now();
  const resolvedMetadata = resolveInstallMetadata();
  const dryRunMs = Date.now() - dryRunStartedAtMs;

  if (isPlaywrightBrowserInstallSatisfied(resolvedMetadata, expectedState)) {
    savePlaywrightBrowserMetadata(resolvedMetadata, repoRoot);
    saveE2eExecutionSummary("browserInstall", {
      browser: browserName,
      createdAt: new Date().toISOString(),
      mode: "refresh_metadata",
      playwrightVersion,
      reason: "Required Playwright browser files were already present, so install metadata was refreshed.",
      timings: {
        dryRunMs,
        totalMs: Date.now() - startedAtMs
      }
    }, repoRoot);
    console.log(`Playwright ${browserName} browsers already present for v${playwrightVersion}. Cached install metadata refreshed.`);
    return;
  }

  console.log(`Installing Playwright ${browserName} browsers for v${playwrightVersion}.`);
  const installStartedAtMs = Date.now();

  try {
    execFileSync(nodeBinary, [playwrightCliPath, "install", browserName], {
      cwd: e2eRoot,
      env: process.env,
      stdio: "inherit"
    });
  } catch (error) {
    clearPlaywrightBrowserMetadata(repoRoot);
    throw error;
  }

  const installedMetadata = resolveInstallMetadata();

  if (!isPlaywrightBrowserInstallSatisfied(installedMetadata, expectedState)) {
    clearPlaywrightBrowserMetadata(repoRoot);
    throw new Error(`Playwright ${browserName} install completed, but the required browser locations are still missing.`);
  }

  savePlaywrightBrowserMetadata(installedMetadata, repoRoot);
  saveE2eExecutionSummary("browserInstall", {
    browser: browserName,
    createdAt: new Date().toISOString(),
    mode: "install",
    playwrightVersion,
    reason: "Playwright browser files were missing and were installed.",
    timings: {
      dryRunMs,
      installMs: Date.now() - installStartedAtMs,
      totalMs: Date.now() - startedAtMs
    }
  }, repoRoot);
  console.log(`Playwright ${browserName} browsers are installed and cached for v${playwrightVersion}.`);
}

main();
