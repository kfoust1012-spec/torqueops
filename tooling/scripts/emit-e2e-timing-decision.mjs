import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildE2eTimingAnalysis } from "./lib/e2e-timing-analysis.mjs";
import { parseE2eTimingCliArgs } from "./lib/e2e-timing-cli.mjs";
import { emitGitHubAnnotations } from "./lib/github-annotations.mjs";
import {
  loadE2eTimingContext
} from "./lib/e2e-timing-context.mjs";

export function buildE2eTimingDecisionArtifact({
  analysis = null,
  baseline,
  historySummary,
  requireMainBaseline,
  requireSustainedRegression,
  result,
  runSummary,
  target
}) {
  const activeAnalysis = analysis ?? {
    baseline,
    blockingForFailure: result?.blockingForFailure ?? [],
    exitCode: result?.exitCode ?? 0,
    gate: {
      exitCode: result?.exitCode ?? 0,
      reason: result?.gateReason ?? null,
      requireMainBaseline,
      requireSustainedRegression,
      shouldFail: result?.shouldFail ?? false
    },
    gateReason: result?.gateReason ?? null,
    historyCount: historySummary?.count ?? 0,
    messages: result?.messages ?? [],
    regressions: {
      all: result?.regressions?.all ?? [],
      blocking: result?.regressions?.blocking ?? [],
      warnings: result?.regressions?.warnings ?? []
    },
    requireMainBaseline,
    requireSustainedRegression,
    runSummary,
    shouldFail: result?.shouldFail ?? false,
    sustainedBlockingKeys: result?.sustainedBlockingKeys ?? [],
    target,
    trendPhases: result?.trendPhases ?? []
  };

  return {
    baseline: {
      label: activeAnalysis.baseline?.label ?? "none",
      path: activeAnalysis.baseline?.path ?? null
    },
    gate: activeAnalysis.gate ?? {
      exitCode: activeAnalysis.exitCode,
      reason: activeAnalysis.gateReason,
      requireMainBaseline: activeAnalysis.requireMainBaseline,
      requireSustainedRegression: activeAnalysis.requireSustainedRegression,
      shouldFail: activeAnalysis.shouldFail
    },
    generatedAt: new Date().toISOString(),
    history: {
      count: activeAnalysis.historyCount ?? historySummary?.count ?? 0
    },
    messages: activeAnalysis.messages,
    regressions: {
      all: activeAnalysis.regressions?.all ?? [],
      blocking: activeAnalysis.regressions?.blocking ?? [],
      blockingForFailure: activeAnalysis.blockingForFailure ?? [],
      warnings: activeAnalysis.regressions?.warnings ?? []
    },
    run: {
      outcome: activeAnalysis.runSummary?.outcome ?? runSummary?.outcome ?? "unknown",
      target: activeAnalysis.target ?? target
    },
    target: activeAnalysis.target ?? target,
    trends: (activeAnalysis.trendPhases ?? []).map((phase) => ({
      key: phase.key,
      label: phase.label,
      sustainedBlocking: (activeAnalysis.sustainedBlockingKeys ?? []).includes(phase.key),
      vsLast: phase.vsLast,
      vsMedian: phase.vsMedian
    }))
  };
}

export function formatGitHubTimingAnnotations(decision) {
  const annotations = [];
  const gateLevel = decision.gate.shouldFail ? "error" : "notice";

  annotations.push({
    level: gateLevel,
    message: decision.messages[0] ?? `Timing decision generated for ${decision.target}.`,
    title: `E2E timing gate (${decision.target})`
  });

  for (const regression of decision.regressions.blockingForFailure ?? []) {
    annotations.push({
      level: decision.gate.shouldFail ? "error" : "warning",
      message: regression.message,
      title: `Blocking timing regression (${decision.target})`
    });
  }

  for (const regression of decision.regressions.warnings ?? []) {
    annotations.push({
      level: "warning",
      message: `${regression.message}${regression.noisy ? " (allowlisted noisy phase)" : ""}`,
      title: `Timing warning (${decision.target})`
    });
  }

  for (const phase of decision.trends ?? []) {
    const message = `${phase.label}: ${phase.vsLast.classification} vs last run, ${phase.vsMedian.classification} vs 7-run median`;
    const level =
      phase.sustainedBlocking || phase.vsLast.classification === "regressing" || phase.vsMedian.classification === "regressing"
        ? "warning"
        : "notice";
    annotations.push({
      level,
      message,
      title: `Timing trend (${decision.target})`
    });
  }

  return annotations;
}

function main() {
  const {
    baselinePath,
    baselineSummaryPath,
    githubAnnotations,
    historyDir,
    outputPath,
    requireMainBaseline,
    requireSustainedRegression,
    timingRulesPath,
    target
  } = parseE2eTimingCliArgs(process.argv.slice(2), {
    defaultOutputPath: ({ repoRoot, target: resolvedTarget }) =>
      path.join(repoRoot, ".artifacts", "e2e", `${resolvedTarget}-timing-decision.json`),
    includeGithubAnnotations: true,
    includeOutputPath: true,
    includeRequireMainBaseline: true,
    includeRequireSustainedRegression: true
  });
  const {
    baseline,
    historySummary,
    runSummary,
    timingConfig,
    target: resolvedTarget
  } = loadE2eTimingContext({
    baselinePath,
    baselineSummaryPath,
    historyDir,
    repoRoot: process.cwd(),
    target,
    timingRulesPath
  });
  const analysis = buildE2eTimingAnalysis({
    baseline,
    historySummary,
    requireMainBaseline,
    requireSustainedRegression,
    runSummary,
    timingConfig,
    target: resolvedTarget
  });
  const decision = buildE2eTimingDecisionArtifact({ analysis });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(decision, null, 2)}\n`, "utf8");
  console.log(`Saved timing decision artifact: ${path.relative(process.cwd(), outputPath) || path.basename(outputPath)}`);

  if (githubAnnotations) {
    emitGitHubAnnotations(formatGitHubTimingAnnotations(decision));
  }
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main();
}
