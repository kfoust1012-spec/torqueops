import { describe, expect, it } from "vitest";
import { createPrepareRunner } from "./run-e2e-prepare.mjs";

describe("createPrepareRunner", () => {
  it("discards a bad snapshot, falls back to a full rebuild, and refreshes the snapshot", async () => {
    const runCalls = [];
    const tryRunCalls = [];
    const printedSections = [];
    const warnings = [];
    const restoreAttempts = [];
    const clearedSnapshots = [];
    const savedSnapshots = [];
    const persistedSummaries = [];
    let verifySeedCalls = 0;
    let nowTick = 0;

    const runner = createPrepareRunner({
      clearSnapshot(repoRoot) {
        clearedSnapshots.push(repoRoot);
      },
      getSnapshotState() {
        return { isUsable: true };
      },
      now() {
        nowTick += 100;
        return nowTick;
      },
      print(label, detail) {
        printedSections.push({ detail, label });
      },
      repoRoot: "C:/repo",
      restoreSnapshot(repoRoot) {
        restoreAttempts.push(repoRoot);
      },
      runScript(scriptName) {
        runCalls.push(scriptName);

        if (scriptName === "test:e2e:verify-seed") {
          verifySeedCalls += 1;

          if (verifySeedCalls === 1) {
            throw new Error("snapshot verification failed");
          }
        }
      },
      saveSnapshot(repoRoot) {
        savedSnapshots.push(repoRoot);
      },
      saveSummary(summary) {
        persistedSummaries.push(summary);
      },
      shouldForceRebuild() {
        return false;
      },
      shouldUseSnapshot() {
        return true;
      },
      tryRunScript(scriptName) {
        tryRunCalls.push(scriptName);
      },
      warn(message) {
        warnings.push(message);
      }
    });

    const summary = await runner.run();

    expect(restoreAttempts).toEqual(["C:/repo"]);
    expect(clearedSnapshots).toEqual(["C:/repo"]);
    expect(savedSnapshots).toEqual(["C:/repo"]);
    expect(persistedSummaries).toHaveLength(1);
    expect(verifySeedCalls).toBe(2);
    expect(printedSections.map((entry) => entry.label)).toEqual([
      "Restore Snapshot",
      "Full Prepare",
      "Save Snapshot",
      "Prepare Summary"
    ]);
    expect(warnings).toContain("Local e2e snapshot restore failed. Falling back to a full rebuild and discarding the bad snapshot.");
    expect(warnings).toContain("snapshot verification failed");
    expect(tryRunCalls).toEqual(["db:stop", "db:stop", "db:stop"]);
    expect(summary.mode).toBe("full_rebuild");
    expect(summary.reason).toBe("Snapshot restore failed, so the local e2e state was rebuilt from scratch.");
    expect(summary.timings.totalMs).toBeGreaterThan(0);
    expect(runCalls).toEqual([
      "db:start",
      "test:e2e:prepare-env",
      "test:e2e:verify-seed",
      "db:start",
      "test:e2e:prepare-env",
      "db:reset:unlocked",
      "bootstrap:dev-users",
      "bootstrap:demo-data",
      "bootstrap:dispatch-stress",
      "test:e2e:verify-seed",
      "db:start",
      "test:e2e:prepare-env"
    ]);
  });
});
