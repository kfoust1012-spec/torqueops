import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlaywrightBrowserMetadata,
  clearPlaywrightBrowserMetadata,
  getPlaywrightBrowserMetadataPath,
  isPlaywrightBrowserInstallSatisfied,
  loadPlaywrightBrowserMetadata,
  parsePlaywrightDryRunInstallLocations,
  savePlaywrightBrowserMetadata
} from "./playwright-browser-install.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-playwright-install-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("parsePlaywrightDryRunInstallLocations", () => {
  it("extracts every install location from dry-run output", () => {
    const output = [
      "Chrome for Testing 145.0.7632.6 (playwright chromium v1208)",
      "  Install location:    C:\\Users\\Kyle\\AppData\\Local\\ms-playwright\\chromium-1208",
      "",
      "FFmpeg (playwright ffmpeg v1011)",
      "  Install location:    C:\\Users\\Kyle\\AppData\\Local\\ms-playwright\\ffmpeg-1011"
    ].join("\n");

    expect(parsePlaywrightDryRunInstallLocations(output)).toEqual([
      "C:\\Users\\Kyle\\AppData\\Local\\ms-playwright\\chromium-1208",
      "C:\\Users\\Kyle\\AppData\\Local\\ms-playwright\\ffmpeg-1011"
    ]);
  });
});

describe("playwright browser metadata", () => {
  it("round-trips metadata to disk", () => {
    const repoRoot = createTempRepo();
    const metadata = buildPlaywrightBrowserMetadata({
      browser: "chromium",
      browsersPathEnv: null,
      installLocations: ["C:\\cache\\chromium-1208"],
      playwrightVersion: "1.58.2"
    });

    savePlaywrightBrowserMetadata(metadata, repoRoot);

    expect(loadPlaywrightBrowserMetadata(repoRoot)).toMatchObject({
      browser: "chromium",
      installLocations: ["C:\\cache\\chromium-1208"],
      playwrightVersion: "1.58.2"
    });

    clearPlaywrightBrowserMetadata(repoRoot);

    expect(fs.existsSync(getPlaywrightBrowserMetadataPath(repoRoot))).toBe(false);
  });

  it("treats cached metadata as satisfied only when the expected paths still exist", () => {
    const repoRoot = createTempRepo();
    const installDir = path.join(repoRoot, "ms-playwright", "chromium-1208");
    fs.mkdirSync(installDir, { recursive: true });

    const metadata = buildPlaywrightBrowserMetadata({
      browser: "chromium",
      browsersPathEnv: null,
      installLocations: [installDir],
      playwrightVersion: "1.58.2"
    });

    expect(isPlaywrightBrowserInstallSatisfied(metadata, {
      browser: "chromium",
      browsersPathEnv: null,
      playwrightVersion: "1.58.2"
    })).toBe(true);

    fs.rmSync(installDir, { force: true, recursive: true });

    expect(isPlaywrightBrowserInstallSatisfied(metadata, {
      browser: "chromium",
      browsersPathEnv: null,
      playwrightVersion: "1.58.2"
    })).toBe(false);
  });
});
