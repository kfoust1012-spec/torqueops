import { pathToFileURL } from "node:url";
import { buildE2eTimingAnalysis } from "./lib/e2e-timing-analysis.mjs";
import { parseE2eTimingCliArgs } from "./lib/e2e-timing-cli.mjs";
import {
  loadE2eTimingContext
} from "./lib/e2e-timing-context.mjs";

export function assessE2eTimingRegression({
  baseline,
  historySummary = { count: 0, lastRun: null, medianTimings: {} },
  requireMainBaseline = false,
  requireSustainedRegression = false,
  runSummary,
  timingConfig = null,
  target
}) {
  return buildE2eTimingAnalysis({
    baseline,
    historySummary,
    requireMainBaseline,
    requireSustainedRegression,
    runSummary,
    target,
    timingConfig
  });
}

function main() {
  const { baselinePath, baselineSummaryPath, historyDir, requireMainBaseline, requireSustainedRegression, target, timingRulesPath } = parseE2eTimingCliArgs(
    process.argv.slice(2),
    {
      includeRequireMainBaseline: true,
      includeRequireSustainedRegression: true
    }
  );
  const {
    baseline,
    historySummary,
    runSummary,
    timingConfig
  } = loadE2eTimingContext({
    baselinePath,
    baselineSummaryPath,
    historyDir,
    repoRoot: process.cwd(),
    target,
    timingRulesPath
  });
  const result = buildE2eTimingAnalysis({
    baseline,
    historySummary,
    requireMainBaseline,
    requireSustainedRegression,
    runSummary,
    target,
    timingConfig
  });

  for (const message of result.messages) {
    const output = result.shouldFail ? console.error : console.log;
    output(message);
  }

  process.exit(result.exitCode);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main();
}
