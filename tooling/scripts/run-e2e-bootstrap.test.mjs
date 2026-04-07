import { describe, expect, it } from "vitest";
import { createBootstrapRunner } from "./run-e2e-bootstrap.mjs";

describe("createBootstrapRunner", () => {
  it("skips prepare when the prepared-state stamp still matches", async () => {
    const calls = [];
    const savedStamps = [];
    const savedSummaries = [];
    const printed = [];
    let nowTick = 0;

    const runner = createBootstrapRunner({
      computeStamp() {
        return Promise.resolve({
          envFingerprint: "env",
          seedFingerprint: "seed",
          snapshotFingerprint: "snapshot"
        });
      },
      loadStamp() {
        return {
          envFingerprint: "env",
          seedFingerprint: "seed",
          snapshotFingerprint: "snapshot"
        };
      },
      loadSummary(kind) {
        if (kind === "browserInstall") {
          return { mode: "skip" };
        }

        return null;
      },
      now() {
        nowTick += 100;
        return nowTick;
      },
      print(label, detail) {
        printed.push({ detail, label });
      },
      repoRoot: "C:/repo",
      runScript(scriptName) {
        calls.push(scriptName);
      },
      saveSummary(summary) {
        savedSummaries.push(summary);
      },
      saveStamp(stamp) {
        savedStamps.push(stamp);
      },
      shouldUseStamp() {
        return true;
      }
    });

    const summary = await runner.run();

    expect(calls).toEqual(["test:e2e:install"]);
    expect(savedStamps).toHaveLength(1);
    expect(savedSummaries).toHaveLength(1);
    expect(summary.mode).toBe("prepared_state_skip");
    expect(summary.browserInstallMode).toBe("skip");
    expect(printed).toEqual([
      {
        detail: "Current local e2e state matches the verified prepared-state stamp. Skipping test:e2e:prepare.",
        label: "Prepared State"
      },
      {
        detail: undefined,
        label: "Bootstrap Summary"
      }
    ]);
  });

  it("falls back to prepare and refreshes the stamp when the current state changed", async () => {
    const calls = [];
    const cleared = [];
    const savedStamps = [];
    const savedSummaries = [];
    const printed = [];
    let nowTick = 0;

    const runner = createBootstrapRunner({
      clearStamp(repoRoot) {
        cleared.push(repoRoot);
      },
      computeStamp() {
        return Promise.resolve({
          envFingerprint: "env",
          seedFingerprint: "seed-next",
          snapshotFingerprint: "snapshot"
        });
      },
      loadStamp() {
        return {
          envFingerprint: "env",
          seedFingerprint: "seed-prev",
          snapshotFingerprint: "snapshot"
        };
      },
      loadSummary(kind) {
        if (kind === "prepare") {
          return {
            mode: "snapshot_restore",
            reason: "A reusable local snapshot matched the current fingerprint and restored successfully."
          };
        }

        if (kind === "browserInstall") {
          return { mode: "skip" };
        }

        return null;
      },
      now() {
        nowTick += 100;
        return nowTick;
      },
      print(label, detail) {
        printed.push({ detail, label });
      },
      repoRoot: "C:/repo",
      runScript(scriptName) {
        calls.push(scriptName);
      },
      saveSummary(summary) {
        savedSummaries.push(summary);
      },
      saveStamp(stamp) {
        savedStamps.push(stamp);
      },
      shouldUseStamp() {
        return true;
      }
    });

    const summary = await runner.run();

    expect(cleared).toEqual(["C:/repo"]);
    expect(calls).toEqual(["test:e2e:prepare", "test:e2e:install"]);
    expect(savedStamps).toHaveLength(1);
    expect(savedSummaries).toHaveLength(1);
    expect(savedStamps[0]?.seedFingerprint).toBe("seed-next");
    expect(summary.mode).toBe("snapshot_restore");
    expect(summary.prepareMode).toBe("snapshot_restore");
    expect(printed).toEqual([
      {
        detail: "The local e2e state stamp no longer matches the current DB or env state. Running test:e2e:prepare.",
        label: "Prepared State"
      },
      {
        detail: undefined,
        label: "Bootstrap Summary"
      }
    ]);
  });
});
