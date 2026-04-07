import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { formatDurationMs } from "./lib/e2e-execution-summary.mjs";
import {
  buildE2eTimingAnalysis,
  evaluateTimingRegressions as evaluateRegressions
} from "./lib/e2e-timing-analysis.mjs";
import { parseE2eTimingCliArgs } from "./lib/e2e-timing-cli.mjs";
import {
  loadE2eTimingContext
} from "./lib/e2e-timing-context.mjs";
import {
  resolveTimingEvaluationConfig
} from "./lib/e2e-timing-rules.mjs";
export {
  resolveE2eTimingBaselineReference as resolveBaselineReference
} from "./lib/e2e-timing-context.mjs";
export { evaluateRegressions as evaluateTimingRegressions };

function formatSignedDurationMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs === 0) {
    return "0ms";
  }

  const sign = durationMs > 0 ? "+" : "-";
  return `${sign}${formatDurationMs(Math.abs(durationMs))}`;
}

function formatDelta(currentValue, baselineValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) {
    return "n/a";
  }

  const deltaMs = currentValue - baselineValue;
  const percentDelta = (deltaMs / baselineValue) * 100;
  const direction = deltaMs > 0 ? "+" : "";
  return `${formatSignedDurationMs(deltaMs)} (${direction}${percentDelta.toFixed(1)}%)`;
}

function formatTrendLabel(classification) {
  switch (classification) {
    case "improving":
      return "improving";
    case "regressing":
      return "regressing";
    case "flat":
      return "flat";
    default:
      return "n/a";
  }
}

export function findTimingRegressionNotes(runSummary, baseline) {
  return evaluateRegressions(runSummary, baseline).all.map((item) => item.message);
}

export function renderE2eTimingSummary({
  analysis = null,
  baseline,
  historySummary = { count: 0, lastRun: null, medianTimings: {} },
  target,
  runSummary,
  timingConfig = resolveTimingEvaluationConfig({ target })
}) {
  const activeAnalysis = analysis ?? buildE2eTimingAnalysis({
    baseline,
    historySummary,
    runSummary,
    target,
    timingConfig
  });
  const activeRunSummary = activeAnalysis.runSummary;
  const activeBaseline = activeAnalysis.baseline;
  const activeHistorySummary = activeAnalysis.historySummary;
  const activeTarget = activeAnalysis.target;
  const activeTimingConfig = activeAnalysis.timingConfig;

  if (!activeRunSummary) {
    return `## E2E Timing Summary (${activeTarget})\n\nNo run summary artifact was found for this target.\n`;
  }

  const metadataLines = [
    `- Outcome: \`${activeRunSummary.outcome ?? "unknown"}\``,
    `- Bootstrap mode: \`${activeRunSummary.bootstrapMode ?? "unknown"}\``,
    `- Browser install mode: \`${activeRunSummary.browserInstallMode ?? "unknown"}\``,
    `- Baseline source: \`${activeBaseline?.label ?? "none"}\``
  ];

  if (activeRunSummary.prepareMode) {
    metadataLines.push(`- Prepare mode: \`${activeRunSummary.prepareMode}\``);
  }

  const tableLines = [
    "| Phase | Current | Baseline | Delta | vs last | vs 7-run median |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const row of activeTimingConfig.rows) {
    const currentValue = activeRunSummary.timings?.[row.key];
    const baselineValue = activeBaseline?.timings?.[row.key];
    const lastRunValue = activeHistorySummary.lastRun?.timings?.[row.key];
    const medianValue = activeHistorySummary.medianTimings?.[row.key];
    tableLines.push(
      `| ${row.label} | ${Number.isFinite(currentValue) ? formatDurationMs(currentValue) : "n/a"} | ${Number.isFinite(baselineValue) ? formatDurationMs(baselineValue) : "n/a"} | ${formatDelta(currentValue, baselineValue)} | ${formatDelta(currentValue, lastRunValue)} | ${formatDelta(currentValue, medianValue)} |`
    );
  }

  const blockingBlock = activeAnalysis.regressions.blocking.length > 0
    ? `\n**Blocking regressions**\n\n${activeAnalysis.regressions.blocking.map((item) => `- ${item.message}`).join("\n")}\n`
    : "";
  const warningsBlock = activeAnalysis.regressions.warnings.length > 0
    ? `\n**Warnings**\n\n${activeAnalysis.regressions.warnings.map((item) => `- ${item.message}${item.noisy ? " (allowlisted noisy phase)" : ""}`).join("\n")}\n`
    : "";
  const trendBlock =
    activeAnalysis.trendSummary.count > 0
      ? `\n**Trend classification**\n\n${activeAnalysis.trendSummary.phases.map((phase) => `- ${phase.label}: ${formatTrendLabel(phase.vsLast.classification)} vs last run, ${formatTrendLabel(phase.vsMedian.classification)} vs 7-run median`).join("\n")}\n`
      : "";
  const notesBlock =
    activeAnalysis.regressions.all.length > 0
      ? `${trendBlock}${blockingBlock}${warningsBlock}`
      : trendBlock
        ? `${trendBlock}\nNo timing regressions crossed the reporting threshold for this target.\n`
      : "\nNo timing regressions crossed the reporting threshold for this target.\n";
  const historyLine =
    activeHistorySummary.count > 0
      ? `- History source: \`${activeHistorySummary.count}\` recent successful main runs`
      : "- History source: `no recent main history downloaded`";

  return [
    `## E2E Timing Summary (${activeTarget})`,
    "",
    ...metadataLines,
    historyLine,
    "",
    ...tableLines,
    notesBlock
  ].join("\n");
}

function main() {
  const { baselinePath, baselineSummaryPath, historyDir, outputPath, target, timingRulesPath } = parseE2eTimingCliArgs(
    process.argv.slice(2),
    {
      defaultOutputPath: process.env.GITHUB_STEP_SUMMARY ?? null,
      includeOutputPath: true
    }
  );
  const context = loadE2eTimingContext({
    baselinePath,
    baselineSummaryPath,
    historyDir,
    repoRoot: process.cwd(),
    target,
    timingRulesPath
  });
  const analysis = buildE2eTimingAnalysis(context);
  const markdown = renderE2eTimingSummary({ analysis });

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.appendFileSync(outputPath, `${markdown}\n`, "utf8");
  }

  process.stdout.write(markdown);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main();
}
