import { formatDurationMs } from "./e2e-execution-summary.mjs";
import { buildTimingTrendSummary } from "./e2e-timing-trends.mjs";
import { resolveTimingEvaluationConfig } from "./e2e-timing-rules.mjs";

const defaultHistorySummary = {
  count: 0,
  lastRun: null,
  medianTimings: {}
};

export function evaluateTimingRegressions(runSummary, baseline, options = {}) {
  const timingConfig = options.timingConfig ?? resolveTimingEvaluationConfig({
    config: options.timingRuleConfig,
    configPath: options.timingRulesPath,
    repoRoot: options.repoRoot ?? process.cwd(),
    target: options.target ?? "full"
  });
  const regressions = [];

  for (const row of timingConfig.rows) {
    const currentValue = runSummary?.timings?.[row.key];
    const baselineValue = baseline?.timings?.[row.key];
    const rule = row;

    if (
      !rule ||
      !Number.isFinite(currentValue) ||
      !Number.isFinite(baselineValue) ||
      baselineValue <= 0
    ) {
      continue;
    }

    const deltaMs = currentValue - baselineValue;
    const percentDelta = (deltaMs / baselineValue) * 100;
    const exceedsAbsolute = deltaMs >= rule.minDeltaMs;
    const exceedsPercent =
      baselineValue >= rule.baselineMinMs &&
      percentDelta >= rule.minPercentDelta;

    if (exceedsAbsolute || exceedsPercent) {
      regressions.push({
        key: row.key,
        label: row.label,
        message: `${row.label} is slower than baseline by ${formatDurationMs(deltaMs)} (${percentDelta.toFixed(1)}%).`,
        noisy: Boolean(rule.noisy),
        severity: rule.severity
      });
    }
  }

  const browserInstallSpecialCase = timingConfig.specialCases?.preparedStateSkipFullBrowserInstall;

  if (
    browserInstallSpecialCase &&
    runSummary?.bootstrapMode === "prepared_state_skip" &&
    runSummary?.browserInstallMode === "install"
  ) {
    regressions.push({
      key: "browserInstallMode",
      label: browserInstallSpecialCase.label ?? "Playwright browser install",
      message: browserInstallSpecialCase.message ?? "Prepared-state skip still triggered a full Playwright browser install.",
      noisy: Boolean(browserInstallSpecialCase.noisy),
      severity: browserInstallSpecialCase.severity ?? "error"
    });
  }

  return {
    all: regressions,
    blocking: regressions.filter((item) => item.severity === "error"),
    warnings: regressions.filter((item) => item.severity === "warning")
  };
}

export function buildE2eTimingAnalysis({
  baseline,
  historySummary = defaultHistorySummary,
  requireMainBaseline = false,
  requireSustainedRegression = false,
  runSummary,
  timingConfig = null,
  target
}) {
  const activeTimingConfig = timingConfig ?? resolveTimingEvaluationConfig({ target });
  const regressions = evaluateTimingRegressions(runSummary, baseline, {
    target,
    timingConfig: activeTimingConfig
  });
  const trendSummary = runSummary
    ? buildTimingTrendSummary(runSummary, historySummary, activeTimingConfig)
    : {
        count: 0,
        phases: [],
        sustainedBlockingKeys: new Set()
      };
  const trendPhaseKeys = new Set(trendSummary.phases.map((phase) => phase.key));
  const immediateBlocking = regressions.blocking.filter((item) => !trendPhaseKeys.has(item.key));
  const sustainedBlocking = regressions.blocking.filter((item) => trendSummary.sustainedBlockingKeys.has(item.key));
  const blockingForFailure = requireSustainedRegression
    ? [...immediateBlocking, ...sustainedBlocking]
    : regressions.blocking;

  let exitCode = 0;
  let gateReason = null;
  let messages = [];
  let shouldFail = false;

  if (!runSummary) {
    gateReason = "missing_run_summary";
    messages = [`No current run summary exists for ${target}; skipping timing regression enforcement.`];
  } else if (baseline?.label !== "latest successful main artifact") {
    gateReason = "non_main_baseline";
    messages = requireMainBaseline
      ? [`No main-branch baseline artifact exists for ${target}; skipping timing regression enforcement.`]
      : [`Using ${baseline?.label ?? "no"} baseline for ${target}; timing enforcement only blocks against a latest successful main artifact.`];
  } else if (regressions.all.length === 0) {
    gateReason = "no_regressions";
    messages = [`No timing regressions crossed the enforcement threshold for ${target}.`];
  } else if (regressions.blocking.length === 0) {
    gateReason = "warning_only";
    messages = [
      `Only warning-tier timing regressions were detected for ${target}; PR enforcement is not blocking on allowlisted noisy phases:`,
      ...regressions.warnings.map((item) => `- ${item.message}${item.noisy ? " (allowlisted noisy phase)" : ""}`)
    ];
  } else if (blockingForFailure.length === 0 && requireSustainedRegression) {
    gateReason = "not_sustained";
    messages = [
      `Blocking-tier timing regressions for ${target} are not sustained against both the last main run and the 7-run median, so PR enforcement is not failing:`,
      ...regressions.blocking.map((item) => `- ${item.message}`),
      ...trendSummary.phases.map((phase) => `- ${phase.label}: ${phase.vsLast.classification} vs last run, ${phase.vsMedian.classification} vs 7-run median`)
    ];
  } else if (blockingForFailure.length === 0) {
    gateReason = "warning_only";
    messages = [
      `Only warning-tier timing regressions were detected for ${target}; PR enforcement is not blocking on allowlisted noisy phases:`,
      ...regressions.warnings.map((item) => `- ${item.message}${item.noisy ? " (allowlisted noisy phase)" : ""}`)
    ];
  } else {
    gateReason = requireSustainedRegression ? "sustained_blocking_regression" : "blocking_regression";
    exitCode = 1;
    shouldFail = true;
    messages = [
      requireSustainedRegression
        ? `Sustained timing regressions exceeded the enforcement threshold for ${target} against both the last main run and the 7-run median:`
        : `Timing regressions exceeded the enforcement threshold for ${target} against the latest successful main artifact:`,
      ...blockingForFailure.map((item) => `- ${item.message}`),
      ...trendSummary.phases.map((phase) => `- Trend ${phase.label}: ${phase.vsLast.classification} vs last run, ${phase.vsMedian.classification} vs 7-run median`),
      ...regressions.warnings.map((item) => `- Warning: ${item.message}${item.noisy ? " (allowlisted noisy phase)" : ""}`)
    ];
  }

  return {
    baseline,
    baselineLabel: baseline?.label ?? "none",
    blockingForFailure,
    exitCode,
    gate: {
      exitCode,
      reason: gateReason,
      requireMainBaseline,
      requireSustainedRegression,
      shouldFail
    },
    gateReason,
    historyCount: historySummary?.count ?? 0,
    historySummary,
    messages,
    regressions,
    requireMainBaseline,
    requireSustainedRegression,
    runSummary,
    shouldFail,
    sustainedBlockingKeys: [...trendSummary.sustainedBlockingKeys],
    target,
    timingConfig: activeTimingConfig,
    trendPhases: trendSummary.phases,
    trendSummary
  };
}
