import { execSync } from "node:child_process";

const repoRoot = process.cwd();
const supabaseCli = "pnpm exec supabase";
const resetCommand = `${supabaseCli} db reset`;
const statusCommand = `${supabaseCli} status -o json`;
const stopCommand = `${supabaseCli} stop`;
const startCommand = `${supabaseCli} start`;
const transientResetErrorPattern =
  /Error status 502|invalid response was received from the upstream server/i;
const transientStorageErrorPattern =
  /\b502\b|upstream server|econnreset|fetch failed|networkerror|network error|aborted/i;

function runCommand(command) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForSupabaseStatus() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const output = runCommand(statusCommand);
      JSON.parse(output);
      return true;
    } catch {
      await sleep(2_000);
    }
  }

  return false;
}

function isTransientStorageError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return transientStorageErrorPattern.test(message);
}

async function getSupabaseStatus() {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const output = runCommand(statusCommand);
      return JSON.parse(output);
    } catch {
      await sleep(2_000);
    }
  }

  throw new Error("Supabase status did not become readable after reset.");
}

async function waitForStorageReady() {
  const status = await getSupabaseStatus();
  const headers = {
    apikey: status.SECRET_KEY,
    Authorization: `Bearer ${status.SECRET_KEY}`
  };
  let restartedServices = false;
  let lastError = null;

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await fetch(`${status.API_URL}/storage/v1/bucket`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GET ${status.API_URL}/storage/v1/bucket failed: ${response.status} ${body}`);
      }

      return;
    } catch (error) {
      lastError = error;

      if (!isTransientStorageError(error)) {
        throw error;
      }

      if (!restartedServices && attempt === 15) {
        console.warn("Supabase storage is still recovering. Recycling the local Supabase stack...");
        try {
          const stopOutput = runCommand(stopCommand);
          if (stopOutput) {
            process.stdout.write(stopOutput);
          }

          const startOutput = runCommand(startCommand);
          if (startOutput) {
            process.stdout.write(startOutput);
          }
        } catch (startError) {
          const stdout = startError.stdout ?? "";
          const stderr = startError.stderr ?? "";

          if (stdout) {
            process.stdout.write(stdout);
          }

          if (stderr) {
            process.stderr.write(stderr);
          }
        }
        restartedServices = true;
      }

      await sleep(2_000);
    }
  }

  throw new Error(
    `Supabase storage did not become ready after reset: ${
      lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error")
    }`
  );
}

async function main() {
  try {
    const output = runCommand(resetCommand);
    process.stdout.write(output);
    await waitForStorageReady();
    return;
  } catch (error) {
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    const combinedOutput = `${stdout}${stderr}`;

    if (stdout) {
      process.stdout.write(stdout);
    }

    if (stderr) {
      process.stderr.write(stderr);
    }

    if (!transientResetErrorPattern.test(combinedOutput)) {
      throw error;
    }

    console.warn("");
    console.warn("Supabase reset hit a transient restart error. Waiting for local services to recover...");

    const recovered = await waitForSupabaseStatus();

    if (!recovered) {
      throw error;
    }

    console.warn("Supabase recovered after reset restart. Continuing.");
    await waitForStorageReady();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
