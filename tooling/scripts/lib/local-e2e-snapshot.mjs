import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const snapshotVersion = 1;
const snapshotDirName = path.join(".artifacts", "e2e", "local-snapshot");
const tempHelperContainerPrefix = "mm-e2e-snapshot-helper";
const volumeHelperImage = "busybox:1.37.0";
const snapshotInputPaths = [
  "package.json",
  path.join("supabase", "config.toml"),
  path.join("supabase", "migrations"),
  path.join("tooling", "scripts", "assert-e2e-seed-integrity.mjs"),
  path.join("tooling", "scripts", "bootstrap-demo-data.mjs"),
  path.join("tooling", "scripts", "bootstrap-dev-users.mjs"),
  path.join("tooling", "scripts", "bootstrap-dispatch-stress.mjs"),
  path.join("tooling", "scripts", "lib", "bootstrap-utils.mjs")
];
const snapshotTargets = [
  {
    mountDestination: "/var/lib/postgresql/data",
    snapshotSubdirectory: "db",
    volumeNamePrefix: "supabase_db"
  },
  {
    mountDestination: "/mnt",
    snapshotSubdirectory: "storage",
    volumeNamePrefix: "supabase_storage"
  }
];

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  });
}

function walkFiles(targetPath, repoRoot, files) {
  const stats = fs.statSync(targetPath);

  if (stats.isDirectory()) {
    const entries = fs.readdirSync(targetPath).sort((left, right) => left.localeCompare(right));

    for (const entry of entries) {
      walkFiles(path.join(targetPath, entry), repoRoot, files);
    }

    return;
  }

  files.push(path.relative(repoRoot, targetPath));
}

function collectSnapshotInputFiles(repoRoot) {
  const files = [];

  for (const relativeInputPath of snapshotInputPaths) {
    const absoluteInputPath = path.join(repoRoot, relativeInputPath);

    if (!fs.existsSync(absoluteInputPath)) {
      continue;
    }

    walkFiles(absoluteInputPath, repoRoot, files);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function computeLocalE2eSnapshotFingerprint(repoRoot = process.cwd()) {
  const hash = crypto.createHash("sha256");
  const inputFiles = collectSnapshotInputFiles(repoRoot);

  for (const relativeFilePath of inputFiles) {
    const absoluteFilePath = path.join(repoRoot, relativeFilePath);
    hash.update(`${relativeFilePath}\n`);
    hash.update(fs.readFileSync(absoluteFilePath));
    hash.update("\n");
  }

  return {
    fingerprint: hash.digest("hex"),
    inputFiles
  };
}

function loadProjectId(repoRoot) {
  const configPath = path.join(repoRoot, "supabase", "config.toml");
  const configText = fs.readFileSync(configPath, "utf8");
  const projectIdMatch = configText.match(/^\s*project_id\s*=\s*"([^"]+)"/m);

  if (!projectIdMatch) {
    throw new Error(`Could not determine Supabase project_id from ${path.relative(repoRoot, configPath)}.`);
  }

  return projectIdMatch[1];
}

function assertDockerVolumeExists(volumeName, repoRoot) {
  runCommand("docker", ["volume", "inspect", volumeName], {
    cwd: repoRoot
  });
}

function ensureSnapshotDirectory(snapshotDir) {
  fs.rmSync(snapshotDir, { force: true, recursive: true });
  fs.mkdirSync(snapshotDir, { recursive: true });
}

function copyVolumeToHost({ destinationPath, mountDestination, repoRoot, volumeName, helperSuffix }) {
  const helperContainerName = makeHelperContainerName(helperSuffix);

  fs.mkdirSync(destinationPath, { recursive: true });

  try {
    runCommand(
      "docker",
      ["create", "--name", helperContainerName, "-v", `${volumeName}:${mountDestination}`, volumeHelperImage, "sh"],
      {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    runCommand("docker", ["cp", "-a", `${helperContainerName}:${mountDestination}${path.posix.sep}.`, destinationPath], {
      cwd: repoRoot,
      stdio: ["ignore", "inherit", "inherit"]
    });
  } finally {
    removeHelperContainer(helperContainerName, repoRoot);
  }
}

function makeHelperContainerName(suffix) {
  return `${tempHelperContainerPrefix}-${process.pid}-${suffix}`;
}

function removeHelperContainer(containerName, repoRoot) {
  try {
    runCommand("docker", ["rm", "-f", containerName], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    // Best-effort cleanup only.
  }
}

function clearVolumeMount({ mountDestination, repoRoot, volumeName }) {
  const shellCommand = `mkdir -p ${mountDestination} && find ${mountDestination} -mindepth 1 -maxdepth 1 -exec rm -rf {} +`;
  runCommand(
    "docker",
    ["run", "--rm", "-v", `${volumeName}:${mountDestination}`, "--entrypoint", "sh", volumeHelperImage, "-lc", shellCommand],
    {
      cwd: repoRoot,
      stdio: ["ignore", "inherit", "inherit"]
    }
  );
}

function copyHostPathToVolume({ sourcePath, mountDestination, helperSuffix, repoRoot, volumeName }) {
  const helperContainerName = makeHelperContainerName(helperSuffix);

  try {
    runCommand(
      "docker",
      ["create", "--name", helperContainerName, "-v", `${volumeName}:${mountDestination}`, volumeHelperImage, "sh"],
      {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    runCommand("docker", ["cp", "-a", `${sourcePath}${path.sep}.`, `${helperContainerName}:${mountDestination}`], {
      cwd: repoRoot,
      stdio: ["ignore", "inherit", "inherit"]
    });
  } finally {
    removeHelperContainer(helperContainerName, repoRoot);
  }
}

function loadSnapshotMeta(metaPath) {
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

export function getLocalE2eSnapshotState(repoRoot = process.cwd()) {
  const snapshotDir = path.join(repoRoot, snapshotDirName);
  const metaPath = path.join(snapshotDir, "meta.json");
  const { fingerprint, inputFiles } = computeLocalE2eSnapshotFingerprint(repoRoot);
  const meta = loadSnapshotMeta(metaPath);
  const hasDbSnapshot = fs.existsSync(path.join(snapshotDir, "db"));
  const hasStorageSnapshot = fs.existsSync(path.join(snapshotDir, "storage"));
  const isUsable =
    Boolean(meta) &&
    meta.version === snapshotVersion &&
    meta.fingerprint === fingerprint &&
    hasDbSnapshot &&
    hasStorageSnapshot;

  return {
    fingerprint,
    inputFiles,
    isUsable,
    meta,
    metaPath,
    snapshotDir
  };
}

export function clearLocalE2eSnapshot(repoRoot = process.cwd()) {
  const snapshotDir = path.join(repoRoot, snapshotDirName);
  fs.rmSync(snapshotDir, { force: true, recursive: true });
}

export function shouldUseLocalE2eSnapshot() {
  if (process.env.CI) {
    return false;
  }

  if (process.env.MM_E2E_SNAPSHOT_DISABLED === "1") {
    return false;
  }

  return true;
}

export function shouldForceLocalE2eSnapshotRebuild() {
  return process.env.MM_E2E_SNAPSHOT_REBUILD === "1";
}

export function restoreLocalE2eSnapshot(repoRoot = process.cwd()) {
  const projectId = loadProjectId(repoRoot);
  const snapshotState = getLocalE2eSnapshotState(repoRoot);

  if (!snapshotState.isUsable) {
    throw new Error("Local e2e snapshot is not usable for restore.");
  }

  for (const target of snapshotTargets) {
    const volumeName = `${target.volumeNamePrefix}_${projectId}`;
    assertDockerVolumeExists(volumeName, repoRoot);
    clearVolumeMount({
      mountDestination: target.mountDestination,
      repoRoot,
      volumeName
    });
    copyHostPathToVolume({
      helperSuffix: `${target.snapshotSubdirectory}-restore`,
      mountDestination: target.mountDestination,
      repoRoot,
      sourcePath: path.join(snapshotState.snapshotDir, target.snapshotSubdirectory),
      volumeName
    });
  }
}

export function saveLocalE2eSnapshot(repoRoot = process.cwd()) {
  const projectId = loadProjectId(repoRoot);
  const snapshotState = getLocalE2eSnapshotState(repoRoot);
  const snapshotDir = snapshotState.snapshotDir;
  ensureSnapshotDirectory(snapshotDir);

  for (const target of snapshotTargets) {
    const volumeName = `${target.volumeNamePrefix}_${projectId}`;
    assertDockerVolumeExists(volumeName, repoRoot);
    copyVolumeToHost({
      destinationPath: path.join(snapshotDir, target.snapshotSubdirectory),
      helperSuffix: `${target.snapshotSubdirectory}-save`,
      mountDestination: target.mountDestination,
      repoRoot,
      volumeName
    });
  }

  const metadata = {
    createdAt: new Date().toISOString(),
    fingerprint: snapshotState.fingerprint,
    inputFiles: snapshotState.inputFiles,
    projectId,
    version: snapshotVersion
  };

  fs.writeFileSync(path.join(snapshotDir, "meta.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}
