import fs from "node:fs";
import path from "node:path";

const defaultLockTimeoutMs = 30 * 60 * 1_000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function readLockMetadata(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveTimeoutMs({ timeoutEnvVarName, timeoutMs }) {
  if (typeof timeoutMs === "number" && timeoutMs > 0) {
    return timeoutMs;
  }

  if (timeoutEnvVarName) {
    const parsed = parsePositiveInteger(process.env[timeoutEnvVarName]);

    if (parsed) {
      return parsed;
    }
  }

  const genericParsed = parsePositiveInteger(process.env.MM_LOCAL_LOCK_TIMEOUT_MS);

  if (genericParsed) {
    return genericParsed;
  }

  return defaultLockTimeoutMs;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getLockAgeMs(metadata) {
  const createdAtMs = metadata?.createdAt ? Date.parse(metadata.createdAt) : Number.NaN;

  if (Number.isNaN(createdAtMs)) {
    return null;
  }

  return Math.max(0, Date.now() - createdAtMs);
}

function describeOwner(metadata) {
  if (!metadata) {
    return "unknown owner";
  }

  const parts = [];

  if (metadata.owner) {
    parts.push(String(metadata.owner));
  }

  if (metadata.pid) {
    parts.push(`pid ${metadata.pid}`);
  }

  if (metadata.createdAt) {
    parts.push(`started ${metadata.createdAt}`);
  }

  const ageMs = getLockAgeMs(metadata);

  if (ageMs !== null) {
    parts.push(`age ${formatDuration(ageMs)}`);
  }

  return parts.length > 0 ? parts.join(", ") : "unknown owner";
}

function buildTimeoutError({ lockLabel, lockPath, metadata, repoRoot, timeoutMs }) {
  const relativeLockPath = path.relative(repoRoot, lockPath) || path.basename(lockPath);
  const ownerDescription = describeOwner(metadata);

  return new Error(
    [
      `Timed out after waiting ${formatDuration(timeoutMs)} for the ${lockLabel}.`,
      `Lock file: ${relativeLockPath}`,
      `Current owner: ${ownerDescription}`,
      `If that process is no longer healthy, stop it and delete ${relativeLockPath}, then rerun the command.`
    ].join("\n")
  );
}

export async function acquireLocalLock({
  lockFileName,
  lockLabel,
  owner,
  repoRoot = process.cwd(),
  timeoutEnvVarName,
  timeoutMs,
  waitIntervalMs = 1_000,
  waitNoticeIntervalMs = 5_000
}) {
  const lockDir = path.join(repoRoot, ".artifacts", "locks");
  const lockPath = path.join(lockDir, lockFileName);
  const resolvedTimeoutMs = resolveTimeoutMs({ timeoutEnvVarName, timeoutMs });
  fs.mkdirSync(lockDir, { recursive: true });

  let lastNoticeAt = 0;
  const waitStartedAt = Date.now();

  for (;;) {
    try {
      const handle = fs.openSync(lockPath, "wx");
      const metadata = {
        createdAt: new Date().toISOString(),
        owner,
        pid: process.pid
      };

      fs.writeFileSync(handle, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      fs.closeSync(handle);
      return { lockPath, metadata };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }

      const metadata = readLockMetadata(lockPath);

      if (metadata && !isProcessAlive(metadata.pid)) {
        console.warn(
          `Removing stale ${lockLabel}: ${describeOwner(metadata)} (${path.relative(repoRoot, lockPath) || path.basename(lockPath)}).`
        );
        fs.rmSync(lockPath, { force: true });
        continue;
      }

      const now = Date.now();

      if (now - waitStartedAt >= resolvedTimeoutMs) {
        throw buildTimeoutError({
          lockLabel,
          lockPath,
          metadata,
          repoRoot,
          timeoutMs: resolvedTimeoutMs
        });
      }

      if (now - lastNoticeAt >= waitNoticeIntervalMs) {
        const ownerLabel = metadata ? describeOwner(metadata) : "another local process";
        console.log(`Waiting for the ${lockLabel} held by ${ownerLabel}...`);
        lastNoticeAt = now;
      }

      await sleep(waitIntervalMs);
    }
  }
}

export function releaseLocalLock(lockPath) {
  fs.rmSync(lockPath, { force: true });
}
