import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseE2eTimingCliArgs } from "./e2e-timing-cli.mjs";

describe("parseE2eTimingCliArgs", () => {
  it("applies shared defaults for target, baseline, history, and timing rules", () => {
    const repoRoot = "C:/repo";
    const parsed = parseE2eTimingCliArgs([], { repoRoot });

    expect(parsed.target).toBe("full");
    expect(parsed.baselinePath).toBe(path.join(repoRoot, "tooling", "e2e-timing-baselines.json"));
    expect(parsed.timingRulesPath).toBe(path.join(repoRoot, "tooling", "e2e-timing-rules.json"));
    expect(parsed.baselineSummaryPath).toBeNull();
    expect(parsed.historyDir).toBeNull();
  });

  it("supports target-aware output defaults and optional flags in one shared parser", () => {
    const repoRoot = "C:/repo";
    const parsed = parseE2eTimingCliArgs([
      "web",
      "--baseline", "custom-baseline.json",
      "--baseline-summary", ".artifacts/e2e/main-baseline/web/web-e2e-ci-summary.json",
      "--history-dir", ".artifacts/e2e/main-history/web",
      "--timing-rules", "tooling/custom-rules.json",
      "--require-main-baseline",
      "--require-sustained-regression",
      "--github-annotations",
      "--enforce",
      "--decision-output", ".artifacts/e2e/custom-decision.json",
      "--summary-output", ".artifacts/e2e/custom-summary.md"
    ], {
      repoRoot,
      defaultDecisionOutputPath: ({ repoRoot: activeRoot, target }) =>
        path.join(activeRoot, ".artifacts", "e2e", `${target}-timing-decision.json`),
      defaultOutputPath: ({ repoRoot: activeRoot, target }) =>
        path.join(activeRoot, ".artifacts", "e2e", `${target}-timing-summary.md`),
      includeDecisionOutputPath: true,
      includeEnforce: true,
      includeGithubAnnotations: true,
      includeOutputPath: true,
      includeRequireMainBaseline: true,
      includeRequireSustainedRegression: true
    });

    expect(parsed.target).toBe("web");
    expect(parsed.baselinePath).toBe(path.resolve(repoRoot, "custom-baseline.json"));
    expect(parsed.baselineSummaryPath).toBe(path.resolve(repoRoot, ".artifacts/e2e/main-baseline/web/web-e2e-ci-summary.json"));
    expect(parsed.historyDir).toBe(path.resolve(repoRoot, ".artifacts/e2e/main-history/web"));
    expect(parsed.timingRulesPath).toBe(path.resolve(repoRoot, "tooling/custom-rules.json"));
    expect(parsed.requireMainBaseline).toBe(true);
    expect(parsed.requireSustainedRegression).toBe(true);
    expect(parsed.githubAnnotations).toBe(true);
    expect(parsed.enforce).toBe(true);
    expect(parsed.decisionOutputPath).toBe(path.resolve(repoRoot, ".artifacts/e2e/custom-decision.json"));
    expect(parsed.outputPath).toBe(path.resolve(repoRoot, ".artifacts/e2e/custom-summary.md"));
  });
});
