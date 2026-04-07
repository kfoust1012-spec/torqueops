import fs from "node:fs";
import path from "node:path";

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function walkJsonFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) {
    return collected;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkJsonFiles(entryPath, collected);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      collected.push(entryPath);
    }
  }

  return collected;
}

function toSortableTimestamp(summary) {
  const rawValue = summary?.updatedAt ?? summary?.completedAt ?? summary?.createdAt ?? null;
  const timestamp = rawValue ? Date.parse(rawValue) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function calculateMedian(values) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[mid] ?? null;
  }

  const left = sortedValues[mid - 1];
  const right = sortedValues[mid];
  return Number.isFinite(left) && Number.isFinite(right) ? Math.round((left + right) / 2) : null;
}

export function getDefaultE2eTimingHistoryDir(target, repoRoot = process.cwd()) {
  return path.join(repoRoot, ".artifacts", "e2e", "main-history", target);
}

export function loadE2eTimingHistory(target, repoRoot = process.cwd(), historyDir = null) {
  const targetDir = historyDir
    ? path.resolve(repoRoot, historyDir)
    : getDefaultE2eTimingHistoryDir(target, repoRoot);
  const summaries = walkJsonFiles(targetDir)
    .map((filePath) => safeReadJson(filePath))
    .filter((summary) => summary && typeof summary === "object")
    .sort((left, right) => toSortableTimestamp(right) - toSortableTimestamp(left));

  return {
    count: summaries.length,
    historyDir: targetDir,
    summaries
  };
}

export function summarizeE2eTimingHistory(history, timingKeys) {
  const summaries = history?.summaries ?? [];
  const lastRun = summaries[0] ?? null;
  const medianTimings = {};

  for (const key of timingKeys) {
    const values = summaries
      .map((summary) => summary?.timings?.[key])
      .filter((value) => Number.isFinite(value));
    medianTimings[key] = calculateMedian(values);
  }

  return {
    count: summaries.length,
    lastRun,
    medianTimings
  };
}
