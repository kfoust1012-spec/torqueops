import path from "node:path";
import { getDefaultE2eTimingBaselinePath } from "./e2e-timing-context.mjs";
import { getDefaultE2eTimingRulePath } from "./e2e-timing-rules.mjs";

function resolveTargetDefault(value, context) {
  return typeof value === "function" ? value(context) : value;
}

export function parseE2eTimingCliArgs(argv, options = {}) {
  const args = [...argv];
  const repoRoot = options.repoRoot ?? process.cwd();
  const targetDefault = options.targetDefault ?? "full";
  const target = args.shift() ?? targetDefault;
  const defaultContext = { repoRoot, target };
  const baselinePathDefault = resolveTargetDefault(
    options.defaultBaselinePath ?? getDefaultE2eTimingBaselinePath(repoRoot),
    defaultContext
  );
  const timingRulesPathDefault = resolveTargetDefault(
    options.defaultTimingRulesPath ?? getDefaultE2eTimingRulePath(repoRoot),
    defaultContext
  );
  const parsed = {
    baselinePath: baselinePathDefault,
    baselineSummaryPath: null,
    historyDir: null,
    target,
    timingRulesPath: timingRulesPathDefault
  };

  if (options.includeOutputPath) {
    parsed.outputPath = resolveTargetDefault(options.defaultOutputPath ?? null, defaultContext);
  }

  if (options.includeDecisionOutputPath) {
    parsed.decisionOutputPath =
      resolveTargetDefault(options.defaultDecisionOutputPath, defaultContext) ??
      path.join(repoRoot, ".artifacts", "e2e", `${target}-timing-decision.json`);
  }

  if (options.includeRequireMainBaseline) {
    parsed.requireMainBaseline = false;
  }

  if (options.includeRequireSustainedRegression) {
    parsed.requireSustainedRegression = false;
  }

  if (options.includeGithubAnnotations) {
    parsed.githubAnnotations = false;
  }

  if (options.includeEnforce) {
    parsed.enforce = false;
  }

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === "--baseline") {
      parsed.baselinePath = path.resolve(repoRoot, args.shift() ?? baselinePathDefault);
      continue;
    }

    if (arg === "--baseline-summary") {
      parsed.baselineSummaryPath = path.resolve(repoRoot, args.shift() ?? "");
      continue;
    }

    if (arg === "--history-dir") {
      parsed.historyDir = path.resolve(repoRoot, args.shift() ?? "");
      continue;
    }

    if (arg === "--timing-rules") {
      parsed.timingRulesPath = path.resolve(repoRoot, args.shift() ?? timingRulesPathDefault);
      continue;
    }

    if (arg === "--output" && options.includeOutputPath) {
      parsed.outputPath = args.shift() ?? null;
      continue;
    }

    if (arg === "--decision-output" && options.includeDecisionOutputPath) {
      parsed.decisionOutputPath = path.resolve(repoRoot, args.shift() ?? parsed.decisionOutputPath);
      continue;
    }

    if (arg === "--summary-output" && options.includeOutputPath) {
      parsed.outputPath = path.resolve(repoRoot, args.shift() ?? "");
      continue;
    }

    if (arg === "--require-main-baseline" && options.includeRequireMainBaseline) {
      parsed.requireMainBaseline = true;
      continue;
    }

    if (arg === "--require-sustained-regression" && options.includeRequireSustainedRegression) {
      parsed.requireSustainedRegression = true;
      continue;
    }

    if (arg === "--github-annotations" && options.includeGithubAnnotations) {
      parsed.githubAnnotations = true;
      continue;
    }

    if (arg === "--enforce" && options.includeEnforce) {
      parsed.enforce = true;
    }
  }

  return parsed;
}
