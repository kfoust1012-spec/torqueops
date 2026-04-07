import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveE2eExecutionSummary } from "./lib/e2e-execution-summary.mjs";
import {
  findBlockedSetupLogMatches,
  findMissingSetupSummaryProblems
} from "./assert-clean-e2e-setup-log.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-setup-log-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

function buildBootstrapSkipLog() {
  return [
    "== Prepared State ==",
    "Current local e2e state matches the verified prepared-state stamp. Skipping test:e2e:prepare.",
    "",
    "== Bootstrap Summary ==",
    "Outcome: prepared_state_skip",
    "Reason: The verified prepared-state stamp matched the current local DB and env state, so prepare was skipped.",
    "Total: 817ms",
    "Prepared-state check: 60ms",
    "Browser install: 756ms",
    "Browser install outcome: skip"
  ].join("\n");
}

describe("findBlockedSetupLogMatches", () => {
  it("reports blocked setup regressions", () => {
    const matches = findBlockedSetupLogMatches("A new version of Supabase CLI is available: 2.99.0");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.label).toBe("Supabase CLI upgrade notice");
  });
});

describe("findMissingSetupSummaryProblems", () => {
  it("accepts a clean bootstrap skip log when matching JSON summaries exist", () => {
    const repoRoot = createTempRepo();
    saveE2eExecutionSummary("bootstrap", {
      mode: "prepared_state_skip",
      reason: "prepared-state matched",
      timings: {
        preparedStateCheckMs: 60,
        totalMs: 817
      }
    }, repoRoot);
    saveE2eExecutionSummary("browserInstall", {
      mode: "skip",
      reason: "browser install skipped",
      timings: {
        totalMs: 756
      }
    }, repoRoot);

    expect(findMissingSetupSummaryProblems({
      log: buildBootstrapSkipLog(),
      repoRoot
    })).toEqual([]);
  });

  it("requires prepare summary artifacts when prepare ran", () => {
    const repoRoot = createTempRepo();
    saveE2eExecutionSummary("bootstrap", {
      mode: "snapshot_restore",
      reason: "snapshot restored",
      timings: {
        totalMs: 38100
      }
    }, repoRoot);
    saveE2eExecutionSummary("browserInstall", {
      mode: "skip",
      reason: "browser install skipped",
      timings: {
        totalMs: 756
      }
    }, repoRoot);

    const problems = findMissingSetupSummaryProblems({
      log: [
        "> mobile-mechanic-software@ test:e2e:prepare C:\\repo",
        "",
        "== Bootstrap Summary ==",
        "Outcome: snapshot_restore",
        "Reason: A reusable local snapshot matched the current fingerprint and restored successfully.",
        "Total: 38.3s",
        "Prepared-state check: 122ms",
        "Prepare: 36.9s",
        "Browser install: 752ms",
        "Prepare outcome: snapshot_restore",
        "Browser install outcome: skip"
      ].join("\n"),
      repoRoot
    });

    expect(problems).toContain("Prepare Summary block is missing from the setup log even though prepare ran.");
    expect(problems).toContain(`Prepare JSON summary is missing: ${path.join(".artifacts", "e2e", "prepare-last-run.json")}`);
  });

  it("flags prepared-state skip timing regressions and unexpected browser installs", () => {
    const repoRoot = createTempRepo();
    saveE2eExecutionSummary("bootstrap", {
      browserInstallMode: "install",
      mode: "prepared_state_skip",
      reason: "prepared-state matched",
      timings: {
        preparedStateCheckMs: 6_250,
        totalMs: 12_400
      }
    }, repoRoot);
    saveE2eExecutionSummary("browserInstall", {
      mode: "install",
      reason: "Chromium was installed unexpectedly",
      timings: {
        totalMs: 301_000
      }
    }, repoRoot);

    const problems = findMissingSetupSummaryProblems({
      log: [
        "== Prepared State ==",
        "Current local e2e state matches the verified prepared-state stamp. Skipping test:e2e:prepare.",
        "",
        "== Bootstrap Summary ==",
        "Outcome: prepared_state_skip",
        "Reason: The verified prepared-state stamp matched the current local DB and env state, so prepare was skipped.",
        "Total: 12.4s",
        "Prepared-state check: 6.3s",
        "Browser install: 5m 1.0s",
        "Browser install outcome: install"
      ].join("\n"),
      repoRoot
    });

    expect(problems).toContain("prepared_state_skip exceeded 10000ms (saw 12400ms).");
    expect(problems).toContain("Prepared-state check exceeded 5000ms (saw 6250ms).");
    expect(problems).toContain("prepared_state_skip unexpectedly fell back to a full Playwright browser install.");
    expect(problems).toContain("Browser install exceeded 300000ms (saw 301000ms).");
  });

  it("flags snapshot restore timing regressions", () => {
    const repoRoot = createTempRepo();
    saveE2eExecutionSummary("bootstrap", {
      browserInstallMode: "skip",
      mode: "snapshot_restore",
      reason: "snapshot restored",
      timings: {
        preparedStateCheckMs: 110,
        totalMs: 130_500
      }
    }, repoRoot);
    saveE2eExecutionSummary("browserInstall", {
      mode: "skip",
      reason: "browser install skipped",
      timings: {
        totalMs: 850
      }
    }, repoRoot);
    saveE2eExecutionSummary("prepare", {
      mode: "snapshot_restore",
      reason: "snapshot restored",
      timings: {
        restorePhaseMs: 121_250,
        totalMs: 121_250
      }
    }, repoRoot);

    const problems = findMissingSetupSummaryProblems({
      log: [
        "> mobile-mechanic-software@ test:e2e:prepare C:\\repo",
        "",
        "== Prepare Summary ==",
        "Outcome: snapshot_restore",
        "Reason: A reusable local snapshot matched the current fingerprint and restored successfully.",
        "Total: 2m 1.3s",
        "",
        "== Bootstrap Summary ==",
        "Outcome: snapshot_restore",
        "Reason: A reusable local snapshot matched the current fingerprint and restored successfully.",
        "Total: 2m 10.5s",
        "Prepared-state check: 110ms",
        "Prepare: 2m 1.3s",
        "Browser install: 850ms",
        "Prepare outcome: snapshot_restore",
        "Browser install outcome: skip"
      ].join("\n"),
      repoRoot
    });

    expect(problems).toContain("snapshot_restore exceeded 120000ms (saw 130500ms).");
    expect(problems).toContain("Snapshot restore phase exceeded 120000ms (saw 121250ms).");
  });
});
