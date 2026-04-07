import fs from "node:fs";
import path from "node:path";
import { loadE2eCiRunSummary } from "./e2e-ci-run-summary.mjs";
import {
  getDefaultE2eTimingHistoryDir,
  loadE2eTimingHistory,
  summarizeE2eTimingHistory
} from "./e2e-timing-history.mjs";
import {
  getDefaultE2eTimingRulePath,
  loadE2eTimingRuleConfig,
  resolveTimingEvaluationConfig
} from "./e2e-timing-rules.mjs";

function loadJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function getDefaultE2eTimingBaselinePath(repoRoot = process.cwd()) {
  return path.join(repoRoot, "tooling", "e2e-timing-baselines.json");
}

export function getDefaultE2eTimingBaselineSummaryPath(target, repoRoot = process.cwd()) {
  return path.join(repoRoot, ".artifacts", "e2e", "main-baseline", target, `${target}-e2e-ci-summary.json`);
}

export function loadE2eTimingBaselineConfig(
  baselinePath = getDefaultE2eTimingBaselinePath(process.cwd())
) {
  return loadJsonFile(baselinePath, {});
}

export function resolveE2eTimingBaselineReference({
  baselineConfig = {},
  baselinePath = getDefaultE2eTimingBaselinePath(process.cwd()),
  baselineSummaryPath = null,
  repoRoot = process.cwd(),
  target
}) {
  const candidateSummaryPath = baselineSummaryPath
    ? path.resolve(repoRoot, baselineSummaryPath)
    : getDefaultE2eTimingBaselineSummaryPath(target, repoRoot);
  const summaryBaseline = loadJsonFile(candidateSummaryPath, null);

  if (summaryBaseline?.timings && typeof summaryBaseline.timings === "object") {
    return {
      label: "latest successful main artifact",
      path: candidateSummaryPath,
      timings: summaryBaseline.timings
    };
  }

  const staticBaseline = baselineConfig?.[target] ?? null;

  if (staticBaseline?.timings && typeof staticBaseline.timings === "object") {
    return {
      label: "checked-in fallback",
      path: path.relative(repoRoot, baselinePath) || path.basename(baselinePath),
      timings: staticBaseline.timings
    };
  }

  return {
    label: "none",
    path: null,
    timings: null
  };
}

export function loadE2eTimingContext({
  baselineConfig = null,
  baselinePath = getDefaultE2eTimingBaselinePath(process.cwd()),
  baselineSummaryPath = null,
  history = null,
  historyDir = null,
  repoRoot = process.cwd(),
  runSummary,
  target = "full",
  timingRuleConfig = null,
  timingRulesPath = getDefaultE2eTimingRulePath(repoRoot)
} = {}) {
  const activeBaselineConfig = baselineConfig ?? loadE2eTimingBaselineConfig(baselinePath);
  const activeTimingRuleConfig = timingRuleConfig ?? loadE2eTimingRuleConfig(timingRulesPath);
  const baseline = resolveE2eTimingBaselineReference({
    baselineConfig: activeBaselineConfig,
    baselinePath,
    baselineSummaryPath,
    repoRoot,
    target
  });
  const timingConfig = resolveTimingEvaluationConfig({
    config: activeTimingRuleConfig,
    configPath: timingRulesPath,
    repoRoot,
    target
  });
  const resolvedHistoryDir = historyDir
    ? path.resolve(repoRoot, historyDir)
    : getDefaultE2eTimingHistoryDir(target, repoRoot);
  const activeHistory = history ?? loadE2eTimingHistory(target, repoRoot, resolvedHistoryDir);
  const historySummary = summarizeE2eTimingHistory(
    activeHistory,
    timingConfig.rows.map((row) => row.key)
  );
  const activeRunSummary = runSummary === undefined
    ? loadE2eCiRunSummary(target, repoRoot)
    : runSummary;

  return {
    baseline,
    baselineConfig: activeBaselineConfig,
    baselinePath,
    history: activeHistory,
    historyDir: activeHistory.historyDir ?? resolvedHistoryDir,
    historySummary,
    repoRoot,
    runSummary: activeRunSummary,
    target,
    timingConfig,
    timingRuleConfig: activeTimingRuleConfig,
    timingRulesPath
  };
}
