function classifyTrend(currentValue, referenceValue, rule) {
  if (
    !rule ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(referenceValue) ||
    referenceValue <= 0
  ) {
    return {
      classification: "no_data",
      deltaMs: null,
      percentDelta: null
    };
  }

  const deltaMs = currentValue - referenceValue;
  const percentDelta = (deltaMs / referenceValue) * 100;
  const exceedsAbsolute = Math.abs(deltaMs) >= rule.minDeltaMs;
  const exceedsPercent =
    referenceValue >= rule.baselineMinMs &&
    Math.abs(percentDelta) >= rule.minPercentDelta;

  if (!exceedsAbsolute && !exceedsPercent) {
    return {
      classification: "flat",
      deltaMs,
      percentDelta
    };
  }

  return {
    classification: deltaMs > 0 ? "regressing" : "improving",
    deltaMs,
    percentDelta
  };
}

export function buildTimingTrendSummary(runSummary, historySummary, timingConfig) {
  const phases = [];
  const sustainedBlockingKeys = new Set();

  for (const row of timingConfig.rows.filter((item) => item.severity === "error")) {
    const currentValue = runSummary?.timings?.[row.key];
    const lastRunValue = historySummary?.lastRun?.timings?.[row.key];
    const medianValue = historySummary?.medianTimings?.[row.key];
    const vsLast = classifyTrend(currentValue, lastRunValue, row);
    const vsMedian = classifyTrend(currentValue, medianValue, row);

    phases.push({
      key: row.key,
      label: row.label,
      vsLast,
      vsMedian
    });

    if (vsLast.classification === "regressing" && vsMedian.classification === "regressing") {
      sustainedBlockingKeys.add(row.key);
    }
  }

  return {
    count: historySummary?.count ?? 0,
    phases,
    sustainedBlockingKeys
  };
}
