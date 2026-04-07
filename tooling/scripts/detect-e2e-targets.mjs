import { execSync } from "node:child_process";
import fs from "node:fs";

const exactSharedFiles = new Set([
  ".github/workflows/e2e.yml",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "turbo.json"
]);

const sharedPrefixes = ["apps/e2e/", "packages/", "supabase/", "tooling/"];
const webPrefixes = ["apps/web/"];
const mobilePrefixes = ["apps/mobile/"];

function normalizeFiles(files) {
  return files
    .map((file) => file.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function hasPrefix(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function classifyTargets(files) {
  let web = false;
  let mobile = false;

  for (const file of files) {
    const isShared = exactSharedFiles.has(file) || hasPrefix(file, sharedPrefixes);

    if (isShared || hasPrefix(file, webPrefixes)) {
      web = true;
    }

    if (isShared || hasPrefix(file, mobilePrefixes)) {
      mobile = true;
    }

    if (web && mobile) {
      break;
    }
  }

  return { mobile, web };
}

function getChangedFiles() {
  const changedFilesEnv = process.env.CHANGED_FILES;

  if (changedFilesEnv) {
    return normalizeFiles(changedFilesEnv.split(/\r?\n/));
  }

  const baseSha = process.env.GITHUB_BASE_SHA;
  const headSha = process.env.GITHUB_HEAD_SHA;

  if (!baseSha || !headSha) {
    throw new Error("GITHUB_BASE_SHA and GITHUB_HEAD_SHA are required when CHANGED_FILES is not provided.");
  }

  const output = execSync(`git diff --name-only --diff-filter=ACMR "${baseSha}" "${headSha}"`, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return normalizeFiles(output.split(/\r?\n/));
}

function writeGitHubOutput(outputs) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? "local";
  const forceAllTargets = eventName === "workflow_dispatch" || eventName === "push";

  const files =
    forceAllTargets
      ? []
      : getChangedFiles();

  const targets =
    forceAllTargets
      ? { mobile: true, web: true }
      : classifyTargets(files);

  writeGitHubOutput({
    mobile: String(targets.mobile),
    web: String(targets.web)
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        eventName,
        files,
        ...targets
      },
      null,
      2
    )}\n`
  );
}

main();
