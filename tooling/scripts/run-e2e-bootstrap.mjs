import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sleep } from "./lib/bootstrap-utils.mjs";
import {
  formatDurationMs,
  loadE2eExecutionSummary,
  saveE2eExecutionSummary
} from "./lib/e2e-execution-summary.mjs";
import {
  clearPreparedStateStamp,
  computeCurrentPreparedStateStamp,
  loadPreparedStateStamp,
  savePreparedStateStamp,
  shouldUsePreparedStateStamp
} from "./lib/e2e-prepared-state.mjs";

const repoRoot = process.cwd();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const transientPreparedStateErrorPattern = /fetch failed|networkerror|network error|econnreset|aborted|timeout/i;

function runPnpmScript(scriptName) {
  execSync(`${pnpmBin} ${scriptName}`, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

function printSection(label, detail) {
  console.log(`\n== ${label} ==`);

  if (detail) {
    console.log(detail);
  }
}

function printBootstrapSummary(print, summary) {
  print("Bootstrap Summary");
  console.log(`Outcome: ${summary.mode}`);
  console.log(`Reason: ${summary.reason}`);
  console.log(`Total: ${formatDurationMs(summary.timings.totalMs)}`);
  console.log(`Prepared-state check: ${formatDurationMs(summary.timings.preparedStateCheckMs)}`);

  if (Number.isFinite(summary.timings.prepareMs)) {
    console.log(`Prepare: ${formatDurationMs(summary.timings.prepareMs)}`);
  }

  if (Number.isFinite(summary.timings.browserInstallMs)) {
    console.log(`Browser install: ${formatDurationMs(summary.timings.browserInstallMs)}`);
  }

  if (summary.prepareMode) {
    console.log(`Prepare outcome: ${summary.prepareMode}`);
  }

  if (summary.browserInstallMode) {
    console.log(`Browser install outcome: ${summary.browserInstallMode}`);
  }
}

function isTransientPreparedStateError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return transientPreparedStateErrorPattern.test(message);
}

export function createBootstrapRunner(dependencies = {}) {
  const {
    clearStamp = clearPreparedStateStamp,
    computeStamp = computeCurrentPreparedStateStamp,
    loadStamp = loadPreparedStateStamp,
    loadSummary,
    now = Date.now,
    print = printSection,
    repoRoot: runnerRepoRoot = repoRoot,
    runScript = runPnpmScript,
    saveSummary,
    saveStamp = savePreparedStateStamp,
    shouldUseStamp = shouldUsePreparedStateStamp,
    warn = console.warn
  } = dependencies;
  const readSummary = loadSummary ?? ((kind, repoRootForSummary = runnerRepoRoot) =>
    loadE2eExecutionSummary(kind, repoRootForSummary));
  const persistSummary = saveSummary ?? ((summary, repoRootForSummary = runnerRepoRoot) =>
    saveE2eExecutionSummary("bootstrap", summary, repoRootForSummary));

  async function computeStampWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        return await computeStamp(runnerRepoRoot);
      } catch (error) {
        lastError = error;

        if (!isTransientPreparedStateError(error) || attempt === 6) {
          throw error;
        }

        await sleep(500 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "unknown prepared-state error"));
  }

  async function refreshPreparedStateStamp() {
    try {
      const stamp = await computeStampWithRetry();
      saveStamp(stamp, runnerRepoRoot);
      return stamp;
    } catch (error) {
      clearStamp(runnerRepoRoot);
      warn("Could not refresh the local prepared-state stamp. Future runs will fall back to test:e2e:prepare.");
      warn(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async function tryReusePreparedState() {
    if (!shouldUseStamp()) {
      return false;
    }

    const existingStamp = loadStamp(runnerRepoRoot);

    if (!existingStamp) {
      return false;
    }

    try {
      const currentStamp = await computeStampWithRetry();
      const canReuse =
        currentStamp.snapshotFingerprint === existingStamp.snapshotFingerprint &&
        currentStamp.envFingerprint === existingStamp.envFingerprint &&
        currentStamp.seedFingerprint === existingStamp.seedFingerprint;

      if (!canReuse) {
        print("Prepared State", "The local e2e state stamp no longer matches the current DB or env state. Running test:e2e:prepare.");
        clearStamp(runnerRepoRoot);
        return false;
      }

      print("Prepared State", "Current local e2e state matches the verified prepared-state stamp. Skipping test:e2e:prepare.");
      saveStamp(currentStamp, runnerRepoRoot);
      return true;
    } catch (error) {
      warn("Prepared-state verification failed. Falling back to test:e2e:prepare.");
      warn(error instanceof Error ? error.message : String(error));
      clearStamp(runnerRepoRoot);
      return false;
    }
  }

  return {
    async run() {
      const startedAtMs = now();
      const preparedStateCheckStartedAtMs = now();
      const preparedStateEnabled = shouldUseStamp();
      const reusedPreparedState = preparedStateEnabled
        ? await tryReusePreparedState()
        : false;
      const summary = {
        browserInstallMode: null,
        createdAt: new Date().toISOString(),
        mode: null,
        prepareMode: null,
        reason: null,
        timings: {
          preparedStateCheckMs: now() - preparedStateCheckStartedAtMs,
          totalMs: 0
        }
      };

      if (!reusedPreparedState) {
        const prepareStartedAtMs = now();
        runScript("test:e2e:prepare");
        summary.timings.prepareMs = now() - prepareStartedAtMs;
        const prepareSummary = readSummary("prepare", runnerRepoRoot);
        summary.prepareMode = prepareSummary?.mode ?? "prepare_completed";
        summary.mode = prepareSummary?.mode ?? "prepare_completed";
        summary.reason = prepareSummary?.reason ?? "Local e2e state was prepared before browser tests.";

        if (preparedStateEnabled) {
          await refreshPreparedStateStamp();
        }
      } else {
        summary.mode = "prepared_state_skip";
        summary.reason = "The verified prepared-state stamp matched the current local DB and env state, so prepare was skipped.";
      }

      const browserInstallStartedAtMs = now();
      runScript("test:e2e:install");
      summary.timings.browserInstallMs = now() - browserInstallStartedAtMs;
      const browserInstallSummary = readSummary("browserInstall", runnerRepoRoot);
      summary.browserInstallMode = browserInstallSummary?.mode ?? "browser_install_completed";
      summary.timings.totalMs = now() - startedAtMs;
      persistSummary(summary, runnerRepoRoot);
      printBootstrapSummary(print, summary);
      return summary;
    }
  };
}

async function main() {
  await createBootstrapRunner().run();
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
