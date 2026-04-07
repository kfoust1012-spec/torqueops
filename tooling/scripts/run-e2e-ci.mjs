import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  getE2eExecutionSummaryPath,
  loadE2eExecutionSummary
} from "./lib/e2e-execution-summary.mjs";
import {
  getE2eCiRunSummaryPath,
  saveE2eCiRunSummary
} from "./lib/e2e-ci-run-summary.mjs";
import { acquireLocalLock, releaseLocalLock } from "./lib/local-lock.mjs";
import { assertLocalE2ePortsAvailable } from "./lib/local-port-guard.mjs";
import { assertLocalSupabasePortsReady } from "./lib/local-supabase-guard.mjs";

const targetArg = process.argv[2] ?? "full";

const targets = {
  full: {
    description: "full e2e regression suite",
    logFile: ".artifacts/e2e/e2e-ci.log",
    setupLogFile: ".artifacts/e2e/e2e-ci-setup.log",
    testScript: "test:e2e"
  },
  mobile: {
    description: "mobile e2e regression suite",
    logFile: ".artifacts/e2e/mobile-e2e-ci.log",
    setupLogFile: ".artifacts/e2e/mobile-e2e-ci-setup.log",
    testScript: "test:e2e:mobile"
  },
  web: {
    description: "web e2e regression suite",
    logFile: ".artifacts/e2e/web-e2e-ci.log",
    setupLogFile: ".artifacts/e2e/web-e2e-ci-setup.log",
    testScript: "test:e2e:web"
  }
};

const target = targets[targetArg];

if (!target) {
  const validTargets = Object.keys(targets).join(", ");
  console.error(`Unknown e2e CI target "${targetArg}". Expected one of: ${validTargets}`);
  process.exit(1);
}

const cwd = process.cwd();
const logPath = path.resolve(cwd, target.logFile);
const relativeLogPath = path.relative(cwd, logPath) || path.basename(logPath);
const setupLogPath = path.resolve(cwd, target.setupLogFile);
const relativeSetupLogPath = path.relative(cwd, setupLogPath) || path.basename(setupLogPath);
const runSummaryPath = getE2eCiRunSummaryPath(targetArg, cwd);
const summaryArtifactPaths = [
  getE2eExecutionSummaryPath("bootstrap", cwd),
  getE2eExecutionSummaryPath("browserInstall", cwd),
  getE2eExecutionSummaryPath("prepare", cwd),
  runSummaryPath
];
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function printStep(label, detail) {
  console.log(`\n== ${label} ==`);

  if (detail) {
    console.log(detail);
  }
}

function runCommand(command, args, options = {}) {
  const { label, logPath: capturePath = null } = options;

  return new Promise((resolve, reject) => {
    const spawnOptions = {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"]
    };
    let spawnCommand = command;
    let spawnArgs = args;

    if (process.platform === "win32" && (command === "pnpm" || command === "pnpm.cmd")) {
      spawnCommand = `pnpm ${args.join(" ")}`;
      spawnArgs = [];
      spawnOptions.shell = true;
    }

    const child = spawn(spawnCommand, spawnArgs, spawnOptions);

    let logStream = null;
    const cleanupSignals = [];

    if (capturePath) {
      fs.mkdirSync(path.dirname(capturePath), { recursive: true });
      logStream = fs.createWriteStream(capturePath, { flags: "w" });
    }

    const forwardChunk = (chunk, isError = false) => {
      if (isError) {
        process.stderr.write(chunk);
      } else {
        process.stdout.write(chunk);
      }

      if (logStream) {
        logStream.write(chunk);
      }
    };

    for (const signal of ["SIGINT", "SIGTERM"]) {
      const handler = () => {
        child.kill(signal);
      };

      cleanupSignals.push({ handler, signal });
      process.on(signal, handler);
    }

    child.stdout.on("data", (chunk) => {
      forwardChunk(chunk, false);
    });

    child.stderr.on("data", (chunk) => {
      forwardChunk(chunk, true);
    });

    child.on("error", (error) => {
      if (logStream) {
        logStream.end();
      }

      for (const { handler, signal } of cleanupSignals) {
        process.off(signal, handler);
      }

      reject(error);
    });

    child.on("close", (code, signal) => {
      if (logStream) {
        logStream.end();
      }

      for (const { handler, signal: registeredSignal } of cleanupSignals) {
        process.off(registeredSignal, handler);
      }

      if (code === 0) {
        resolve();
        return;
      }

      const exitDetail = signal
        ? `${label ?? command} exited on signal ${signal}`
        : `${label ?? command} exited with code ${code ?? 1}`;

      reject(new Error(exitDetail));
    });
  });
}

async function main() {
  const runStartedAtMs = Date.now();
  const { lockPath: runLockPath, metadata } = await acquireLocalLock({
    lockFileName: "e2e-run.lock",
    lockLabel: "local e2e CI run lock",
    owner: `${targetArg}:${target.testScript}`,
    repoRoot: cwd,
    timeoutEnvVarName: "MM_E2E_RUN_LOCK_TIMEOUT_MS"
  });
  console.log(`Acquired local e2e CI run lock for ${targetArg} with pid ${metadata.pid}.`);

  const runSummary = {
    bootstrapMode: null,
    browserInstallMode: null,
    createdAt: new Date().toISOString(),
    description: target.description,
    errorMessage: null,
    failureStep: null,
    files: {
      logFile: relativeLogPath,
      setupLogFile: relativeSetupLogPath
    },
    outcome: "running",
    prepareMode: null,
    target: targetArg,
    testScript: target.testScript,
    timings: {
      bootstrapMs: 0,
      e2eMs: 0,
      logGuardMs: 0,
      preflightMs: 0,
      setupGuardMs: 0,
      totalMs: 0
    }
  };

  function persistRunSummary() {
    runSummary.timings.totalMs = Date.now() - runStartedAtMs;
    runSummary.updatedAt = new Date().toISOString();
    saveE2eCiRunSummary(targetArg, runSummary, cwd);
  }

  try {
    fs.rmSync(logPath, { force: true });
    fs.rmSync(setupLogPath, { force: true });

    for (const summaryPath of summaryArtifactPaths) {
      fs.rmSync(summaryPath, { force: true });
    }

    persistRunSummary();

    printStep("Preflight", "Checking required local web and Expo ports before bootstrap.");
    const preflightStartedAtMs = Date.now();
    await assertLocalE2ePortsAvailable();
    await assertLocalSupabasePortsReady();
    runSummary.timings.preflightMs = Date.now() - preflightStartedAtMs;
    persistRunSummary();

    printStep("Bootstrap", `Preparing the local e2e environment before the CI-style run and writing setup output to ${relativeSetupLogPath}.`);
    const bootstrapStartedAtMs = Date.now();
    await runCommand(pnpmBin, ["test:e2e:bootstrap"], {
      logPath: setupLogPath,
      label: "pnpm test:e2e:bootstrap"
    });
    runSummary.timings.bootstrapMs = Date.now() - bootstrapStartedAtMs;
    runSummary.bootstrapMode = loadE2eExecutionSummary("bootstrap", cwd)?.mode ?? null;
    runSummary.prepareMode = loadE2eExecutionSummary("prepare", cwd)?.mode ?? null;
    runSummary.browserInstallMode = loadE2eExecutionSummary("browserInstall", cwd)?.mode ?? null;
    persistRunSummary();

    printStep("Guard Setup Log", `Checking ${relativeSetupLogPath} for blocked reset, storage, and setup regressions.`);
    const setupGuardStartedAtMs = Date.now();
    await runCommand(process.execPath, ["tooling/scripts/assert-clean-e2e-setup-log.mjs", relativeSetupLogPath], {
      label: "assert-clean-e2e-setup-log"
    });
    runSummary.timings.setupGuardMs = Date.now() - setupGuardStartedAtMs;
    persistRunSummary();

    printStep("Run E2E", `Running the ${target.description} and writing the Playwright log to ${relativeLogPath}.`);
    const e2eStartedAtMs = Date.now();
    await runCommand(pnpmBin, [target.testScript], {
      logPath,
      label: `pnpm ${target.testScript}`
    });
    runSummary.timings.e2eMs = Date.now() - e2eStartedAtMs;
    persistRunSummary();

    printStep("Guard Log", `Checking ${relativeLogPath} for blocked startup and auth regressions.`);
    const logGuardStartedAtMs = Date.now();
    await runCommand(process.execPath, ["tooling/scripts/assert-clean-e2e-log.mjs", relativeLogPath], {
      label: "assert-clean-e2e-log"
    });
    runSummary.timings.logGuardMs = Date.now() - logGuardStartedAtMs;
    runSummary.outcome = "passed";
    persistRunSummary();

    console.log(`\nCI-style e2e run finished cleanly. Setup log: ${relativeSetupLogPath}. Playwright log: ${relativeLogPath}`);
  } catch (error) {
    runSummary.outcome = "failed";
    runSummary.errorMessage = error instanceof Error ? error.message : String(error);
    persistRunSummary();
    throw error;
  } finally {
    releaseLocalLock(runLockPath);
    console.log(`Released local e2e CI run lock for ${targetArg}.`);
  }
}

main().catch((error) => {
  console.error(`\nCI-style e2e run failed for target "${targetArg}".`);
  console.error(error instanceof Error ? error.message : String(error));

  if (fs.existsSync(setupLogPath)) {
    console.error(`Captured setup log: ${relativeSetupLogPath}`);
  }

  if (fs.existsSync(logPath)) {
    console.error(`Captured Playwright log: ${relativeLogPath}`);
  }

  for (const summaryPath of summaryArtifactPaths) {
    if (fs.existsSync(summaryPath)) {
      const relativeSummaryPath = path.relative(cwd, summaryPath) || path.basename(summaryPath);
      console.error(`Captured summary artifact: ${relativeSummaryPath}`);
    }
  }

  process.exit(1);
});
