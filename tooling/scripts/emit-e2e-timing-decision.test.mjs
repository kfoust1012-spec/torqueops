import { describe, expect, it } from "vitest";
import {
  buildE2eTimingDecisionArtifact,
  formatGitHubTimingAnnotations
} from "./emit-e2e-timing-decision.mjs";

describe("buildE2eTimingDecisionArtifact", () => {
  it("captures gate, regression, and trend data from a normalized analysis object", () => {
    const artifact = buildE2eTimingDecisionArtifact({
      analysis: {
        baseline: {
          label: "latest successful main artifact",
          path: ".artifacts/e2e/main-baseline/web/web-e2e-ci-summary.json"
        },
        blockingForFailure: [
          {
            key: "totalMs",
            label: "Total",
            message: "Total is slower than baseline by 6.0s (15.0%).",
            severity: "error"
          }
        ],
        exitCode: 1,
        gate: {
          exitCode: 1,
          reason: "sustained_blocking_regression",
          requireMainBaseline: false,
          requireSustainedRegression: true,
          shouldFail: true
        },
        gateReason: "sustained_blocking_regression",
        historyCount: 7,
        messages: ["Sustained timing regressions exceeded the enforcement threshold for web."],
        regressions: {
          all: [],
          blocking: [],
          warnings: [
            {
              key: "preflightMs",
              label: "Preflight",
              message: "Preflight is slower than baseline by 2.5s (250.0%).",
              noisy: true,
              severity: "warning"
            }
          ]
        },
        runSummary: {
          outcome: "passed"
        },
        shouldFail: true,
        sustainedBlockingKeys: ["totalMs"],
        target: "web",
        trendPhases: [
          {
            key: "totalMs",
            label: "Total",
            vsLast: { classification: "regressing" },
            vsMedian: { classification: "regressing" }
          }
        ]
      }
    });

    expect(artifact.gate.reason).toBe("sustained_blocking_regression");
    expect(artifact.history.count).toBe(7);
    expect(artifact.regressions.blockingForFailure[0]?.label).toBe("Total");
    expect(artifact.trends[0]?.sustainedBlocking).toBe(true);
  });
});

describe("formatGitHubTimingAnnotations", () => {
  it("formats gate, warning, and trend annotations", () => {
    const annotations = formatGitHubTimingAnnotations({
      gate: {
        shouldFail: false
      },
      messages: ["Blocking-tier timing regressions are not sustained for web."],
      regressions: {
        blockingForFailure: [],
        warnings: [
          {
            message: "Preflight is slower than baseline by 2.5s (250.0%).",
            noisy: true
          }
        ]
      },
      target: "web",
      trends: [
        {
          label: "Total",
          sustainedBlocking: false,
          vsLast: { classification: "regressing" },
          vsMedian: { classification: "flat" }
        }
      ]
    });

    expect(annotations[0]?.title).toBe("E2E timing gate (web)");
    expect(annotations[1]?.title).toBe("Timing warning (web)");
    expect(annotations[2]?.message).toBe("Total: regressing vs last run, flat vs 7-run median");
  });
});
