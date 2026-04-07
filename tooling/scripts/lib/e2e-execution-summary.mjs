import fs from "node:fs";
import path from "node:path";

const summaryFileMap = {
  bootstrap: path.join(".artifacts", "e2e", "bootstrap-last-run.json"),
  browserInstall: path.join(".artifacts", "e2e", "playwright-browser-install-last-run.json"),
  prepare: path.join(".artifacts", "e2e", "prepare-last-run.json")
};

export function formatDurationMs(durationMs) {
  const safeDuration = Math.max(0, Math.round(durationMs));

  if (safeDuration < 1_000) {
    return `${safeDuration}ms`;
  }

  if (safeDuration < 60_000) {
    return `${(safeDuration / 1_000).toFixed(1)}s`;
  }

  const minutes = Math.floor(safeDuration / 60_000);
  const seconds = ((safeDuration % 60_000) / 1_000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function getSummaryFilePath(kind, repoRoot = process.cwd()) {
  const relativePath = summaryFileMap[kind];

  if (!relativePath) {
    throw new Error(`Unknown e2e execution summary kind: ${kind}`);
  }

  return path.join(repoRoot, relativePath);
}

export function getE2eExecutionSummaryPath(kind, repoRoot = process.cwd()) {
  return getSummaryFilePath(kind, repoRoot);
}

export function loadE2eExecutionSummary(kind, repoRoot = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(getSummaryFilePath(kind, repoRoot), "utf8"));
  } catch {
    return null;
  }
}

export function saveE2eExecutionSummary(kind, summary, repoRoot = process.cwd()) {
  const targetPath = getSummaryFilePath(kind, repoRoot);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}
