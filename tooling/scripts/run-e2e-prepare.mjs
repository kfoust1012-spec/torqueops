import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  formatDurationMs,
  saveE2eExecutionSummary
} from "./lib/e2e-execution-summary.mjs";
import {
  clearLocalE2eSnapshot,
  getLocalE2eSnapshotState,
  restoreLocalE2eSnapshot,
  saveLocalE2eSnapshot,
  shouldForceLocalE2eSnapshotRebuild,
  shouldUseLocalE2eSnapshot
} from "./lib/local-e2e-snapshot.mjs";

const repoRoot = process.cwd();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runPnpmScript(scriptName) {
  execSync(`${pnpmBin} ${scriptName}`, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

function tryRunPnpmScript(scriptName) {
  try {
    runPnpmScript(scriptName);
  } catch (error) {
    console.warn(`Ignoring ${scriptName} failure during Supabase restart.`);
    console.warn(error instanceof Error ? error.message : String(error));
  }
}

function printSection(label, detail) {
  console.log(`\n== ${label} ==`);

  if (detail) {
    console.log(detail);
  }
}

function printPrepareSummary(print, summary) {
  print("Prepare Summary");
  console.log(`Outcome: ${summary.mode}`);
  console.log(`Reason: ${summary.reason}`);
  console.log(`Total: ${formatDurationMs(summary.timings.totalMs)}`);

  if (Number.isFinite(summary.timings.restorePhaseMs)) {
    console.log(`Restore phase: ${formatDurationMs(summary.timings.restorePhaseMs)}`);
  }

  if (Number.isFinite(summary.timings.fullPreparePhaseMs)) {
    console.log(`Full prepare phase: ${formatDurationMs(summary.timings.fullPreparePhaseMs)}`);
  }

  if (Number.isFinite(summary.timings.saveSnapshotPhaseMs)) {
    console.log(`Save snapshot phase: ${formatDurationMs(summary.timings.saveSnapshotPhaseMs)}`);
  }

  if (Number.isFinite(summary.timings.restartAfterSnapshotMs)) {
    console.log(`Restart after snapshot: ${formatDurationMs(summary.timings.restartAfterSnapshotMs)}`);
  }
}

export function createPrepareRunner(dependencies = {}) {
  const {
    clearSnapshot = clearLocalE2eSnapshot,
    getSnapshotState = getLocalE2eSnapshotState,
    now = Date.now,
    print = printSection,
    repoRoot: runnerRepoRoot = repoRoot,
    restoreSnapshot = restoreLocalE2eSnapshot,
    runScript = runPnpmScript,
    saveSummary,
    saveSnapshot = saveLocalE2eSnapshot,
    shouldForceRebuild = shouldForceLocalE2eSnapshotRebuild,
    shouldUseSnapshot = shouldUseLocalE2eSnapshot,
    tryRunScript = tryRunPnpmScript,
    warn = console.warn
  } = dependencies;
  const persistSummary = saveSummary ?? ((summary, repoRootForSummary = runnerRepoRoot) =>
    saveE2eExecutionSummary("prepare", summary, repoRootForSummary));

  function runnerRestartSupabaseStack() {
    tryRunScript("db:stop");
    runScript("db:start");
  }

  function runnerPrepareEnvironmentFiles() {
    runScript("test:e2e:prepare-env");
  }

  function runnerFullPrepare() {
    runnerRestartSupabaseStack();
    runnerPrepareEnvironmentFiles();
    runScript("db:reset:unlocked");
    runScript("bootstrap:dev-users");
    runScript("bootstrap:demo-data");
    runScript("bootstrap:dispatch-stress");
    runScript("test:e2e:verify-seed");
  }

  function invalidateSnapshot(reason, error) {
    warn(reason);
    warn(error instanceof Error ? error.message : String(error));
    clearSnapshot(runnerRepoRoot);
  }

  return {
    async run() {
      const startedAtMs = now();
      const snapshotEnabled = shouldUseSnapshot();
      const forceRebuild = shouldForceRebuild();
      const snapshotState = getSnapshotState(runnerRepoRoot);
      const summary = {
        createdAt: new Date().toISOString(),
        mode: null,
        reason: null,
        snapshot: {
          enabled: snapshotEnabled,
          forceRebuild,
          wasUsable: snapshotState.isUsable
        },
        timings: {
          totalMs: 0
        }
      };

      if (snapshotEnabled && snapshotState.isUsable && !forceRebuild) {
        print("Restore Snapshot", "Restoring the version-matched local e2e seed snapshot instead of replaying migrations and seeders.");

        try {
          const restoreStartedAtMs = now();
          tryRunScript("db:stop");
          restoreSnapshot(runnerRepoRoot);
          runScript("db:start");
          runnerPrepareEnvironmentFiles();
          runScript("test:e2e:verify-seed");
          summary.mode = "snapshot_restore";
          summary.reason = "A reusable local snapshot matched the current fingerprint and restored successfully.";
          summary.timings.restorePhaseMs = now() - restoreStartedAtMs;
          summary.timings.totalMs = now() - startedAtMs;
          persistSummary(summary, runnerRepoRoot);
          printPrepareSummary(print, summary);
          return summary;
        } catch (error) {
          summary.snapshot.restoreFailed = true;
          invalidateSnapshot("Local e2e snapshot restore failed. Falling back to a full rebuild and discarding the bad snapshot.", error);
        }
      }

      print("Full Prepare", snapshotEnabled && !forceRebuild
        ? "Building fresh local e2e seed state because no reusable snapshot was available."
        : "Building fresh local e2e seed state because snapshot reuse is disabled or a rebuild was requested.");
      const fullPrepareStartedAtMs = now();
      runnerFullPrepare();
      summary.timings.fullPreparePhaseMs = now() - fullPrepareStartedAtMs;

      if (!snapshotEnabled) {
        summary.mode = "full_rebuild";
        summary.reason = "Local snapshot reuse is disabled for this run.";
        summary.timings.totalMs = now() - startedAtMs;
        persistSummary(summary, runnerRepoRoot);
        printPrepareSummary(print, summary);
        return summary;
      }

      summary.mode = "full_rebuild";

      if (forceRebuild) {
        summary.reason = "Snapshot rebuild was forced by MM_E2E_SNAPSHOT_REBUILD=1.";
      } else if (summary.snapshot.restoreFailed) {
        summary.reason = "Snapshot restore failed, so the local e2e state was rebuilt from scratch.";
      } else if (!summary.snapshot.wasUsable) {
        summary.reason = "No reusable local snapshot was available, so the local e2e state was rebuilt from scratch.";
      } else {
        summary.reason = "The local e2e state was rebuilt from scratch.";
      }

      print("Save Snapshot", "Saving a reusable local DB and storage snapshot for faster future e2e prepares.");

      try {
        const saveSnapshotStartedAtMs = now();
        tryRunScript("db:stop");
        saveSnapshot(runnerRepoRoot);
        summary.snapshot.saved = true;
        summary.timings.saveSnapshotPhaseMs = now() - saveSnapshotStartedAtMs;
      } catch (error) {
        summary.snapshot.saveFailed = true;
        invalidateSnapshot("Saving the local e2e snapshot failed. Future runs will fall back to a full rebuild.", error);
      }

      const restartStartedAtMs = now();
      runScript("db:start");
      runnerPrepareEnvironmentFiles();
      summary.timings.restartAfterSnapshotMs = now() - restartStartedAtMs;
      summary.timings.totalMs = now() - startedAtMs;
      persistSummary(summary, runnerRepoRoot);
      printPrepareSummary(print, summary);
      return summary;
    }
  };
}

async function main() {
  await createPrepareRunner().run();
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
