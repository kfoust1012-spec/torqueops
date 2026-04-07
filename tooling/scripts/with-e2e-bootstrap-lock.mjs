import { execSync } from "node:child_process";
import { acquireLocalLock, releaseLocalLock } from "./lib/local-lock.mjs";

const targetScript = process.argv[2];

if (!targetScript) {
  console.error("Usage: node tooling/scripts/with-e2e-bootstrap-lock.mjs <pnpm-script-name>");
  process.exit(1);
}

const repoRoot = process.cwd();
const lockEnvKey = "MM_E2E_BOOTSTRAP_LOCK_HELD";

function runTargetScript() {
  execSync(`pnpm ${targetScript}`, {
    cwd: repoRoot,
    env: {
      ...process.env,
      [lockEnvKey]: "1"
    },
    stdio: "inherit"
  });
}

async function main() {
  if (process.env[lockEnvKey] === "1") {
    runTargetScript();
    return;
  }

  const { lockPath, metadata } = await acquireLocalLock({
    lockFileName: "e2e-bootstrap.lock",
    lockLabel: "local e2e bootstrap lock",
    owner: targetScript,
    repoRoot,
    timeoutEnvVarName: "MM_E2E_BOOTSTRAP_LOCK_TIMEOUT_MS"
  });
  console.log(`Acquired local e2e bootstrap lock for ${targetScript} with pid ${metadata.pid}.`);

  try {
    runTargetScript();
  } finally {
    releaseLocalLock(lockPath);
    console.log(`Released local e2e bootstrap lock for ${targetScript}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
