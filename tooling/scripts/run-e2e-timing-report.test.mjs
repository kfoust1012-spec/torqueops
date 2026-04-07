import { describe, expect, it, vi } from "vitest";
import { createE2eTimingReportRunner } from "./run-e2e-timing-report.mjs";

describe("createE2eTimingReportRunner", () => {
  it("writes the summary, decision artifact, and annotations in one pass", () => {
    const writes = [];
    const appends = [];
    const annotations = [];
    const runner = createE2eTimingReportRunner({
      appendSummary: (filePath, content) => {
        appends.push({ content, filePath });
      },
      analyzeTiming: () => ({
        baseline: {
          label: "checked-in fallback"
        },
        blockingForFailure: [],
        exitCode: 0,
        gate: {
          shouldFail: false
        },
        gateReason: "non_main_baseline",
        historySummary: {
          count: 0
        },
        messages: ["Using checked-in fallback baseline for web."],
        regressions: {
          all: [],
          blocking: [],
          warnings: []
        },
        runSummary: {
          outcome: "passed"
        },
        shouldFail: false,
        sustainedBlockingKeys: [],
        target: "web",
        trendPhases: []
      }),
      buildDecision: vi.fn(({ analysis }) => ({
        gate: {
          shouldFail: false
        },
        messages: ["Using checked-in fallback baseline for web."],
        regressions: {
          blockingForFailure: [],
          warnings: []
        },
        target: analysis.target,
        trends: []
      })),
      emitAnnotations: (items) => {
        annotations.push(...items);
      },
      formatAnnotations: () => [
        {
          level: "notice",
          message: "Using checked-in fallback baseline for web.",
          title: "E2E timing gate (web)"
        }
      ],
      loadTimingContext: () => ({
        baseline: {
          label: "checked-in fallback",
          path: "tooling/e2e-timing-baselines.json",
          timings: {
            totalMs: 115_000
          }
        },
        historySummary: {
          count: 0,
          lastRun: null,
          medianTimings: {}
        },
        runSummary: {
          outcome: "passed",
          timings: {
            totalMs: 105_000
          }
        },
        timingConfig: {
          rows: []
        }
      }),
      renderSummary: ({ analysis }) => `## E2E Timing Summary (${analysis.target})\n`,
      writeDecision: (filePath, content) => {
        writes.push({ content, filePath });
      }
    });

    const result = runner.run({
      baselinePath: "tooling/e2e-timing-baselines.json",
      decisionOutputPath: ".artifacts/e2e/web-timing-decision.json",
      enforce: false,
      githubAnnotations: true,
      requireSustainedRegression: true,
      summaryOutputPath: ".artifacts/e2e/timing-summary.md",
      target: "web",
      timingRulesPath: "tooling/e2e-timing-rules.json"
    });

    expect(result.exitCode).toBe(0);
    expect(writes[0]?.filePath).toContain("web-timing-decision.json");
    expect(appends[0]?.content).toContain("## E2E Timing Summary (web)");
    expect(annotations[0]?.title).toBe("E2E timing gate (web)");
    expect(result.decision.target).toBe("web");
  });

  it("returns the gate exit code when enforcement is enabled", () => {
    const runner = createE2eTimingReportRunner({
      analyzeTiming: () => ({
        baseline: {
          label: "latest successful main artifact"
        },
        blockingForFailure: [
          {
            message: "Total is slower than baseline by 6.0s (15.0%)."
          }
        ],
        exitCode: 1,
        gate: {
          shouldFail: true
        },
        gateReason: "sustained_blocking_regression",
        historySummary: {
          count: 0
        },
        messages: ["Sustained timing regressions exceeded the enforcement threshold for web."],
        regressions: {
          all: [],
          blocking: [],
          warnings: []
        },
        runSummary: {
          timings: {
            totalMs: 120_000
          }
        },
        shouldFail: true,
        sustainedBlockingKeys: [],
        target: "web",
        trendPhases: []
      }),
      buildDecision: () => ({
        gate: {
          shouldFail: true
        },
        messages: ["Sustained timing regressions exceeded the enforcement threshold for web."],
        regressions: {
          blockingForFailure: [],
          warnings: []
        },
        target: "web",
        trends: []
      }),
      formatAnnotations: () => [],
      loadTimingContext: () => ({
        baseline: {
          label: "latest successful main artifact",
          timings: {
            totalMs: 100_000
          }
        },
        historySummary: {
          count: 0,
          lastRun: null,
          medianTimings: {}
        },
        runSummary: {
          timings: {
            totalMs: 120_000
          }
        },
        timingConfig: {
          rows: []
        }
      }),
      renderSummary: () => "summary",
      writeDecision: () => {}
    });

    const result = runner.run({
      baselinePath: "tooling/e2e-timing-baselines.json",
      decisionOutputPath: ".artifacts/e2e/web-timing-decision.json",
      enforce: true,
      githubAnnotations: false,
      requireSustainedRegression: true,
      summaryOutputPath: null,
      target: "web",
      timingRulesPath: "tooling/e2e-timing-rules.json"
    });

    expect(result.exitCode).toBe(1);
  });
});
