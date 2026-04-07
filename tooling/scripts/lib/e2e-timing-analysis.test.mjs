import { describe, expect, it } from "vitest";
import {
  buildE2eTimingAnalysis,
  evaluateTimingRegressions
} from "./e2e-timing-analysis.mjs";

describe("evaluateTimingRegressions", () => {
  it("splits blocking and warning regressions from one normalized pass", () => {
    const regressions = evaluateTimingRegressions({
      bootstrapMode: "prepared_state_skip",
      browserInstallMode: "install",
      timings: {
        bootstrapMs: 49_500,
        e2eMs: 61_500,
        logGuardMs: 2_200,
        preflightMs: 4_000,
        setupGuardMs: 2_100,
        totalMs: 113_000
      }
    }, {
      label: "latest successful main artifact",
      timings: {
        bootstrapMs: 42_000,
        e2eMs: 50_000,
        logGuardMs: 1_000,
        preflightMs: 1_000,
        setupGuardMs: 1_000,
        totalMs: 95_000
      }
    }, {
      timingConfig: {
        rows: [
          { key: "totalMs", label: "Total", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "bootstrapMs", label: "Bootstrap", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "e2eMs", label: "Playwright", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "preflightMs", label: "Preflight", severity: "warning", noisy: true, baselineMinMs: 1_000, minDeltaMs: 2_500, minPercentDelta: 100 },
          { key: "setupGuardMs", label: "Setup guard", severity: "warning", noisy: true, baselineMinMs: 1_000, minDeltaMs: 1_000, minPercentDelta: 100 },
          { key: "logGuardMs", label: "Startup/auth guard", severity: "warning", noisy: true, baselineMinMs: 1_000, minDeltaMs: 1_000, minPercentDelta: 100 }
        ],
        specialCases: {
          preparedStateSkipFullBrowserInstall: {
            label: "Playwright browser install",
            severity: "error"
          }
        }
      }
    });

    expect(regressions.blocking.map((item) => item.label)).toEqual([
      "Total",
      "Bootstrap",
      "Playwright",
      "Playwright browser install"
    ]);
    expect(regressions.warnings.map((item) => item.label)).toEqual([
      "Preflight",
      "Setup guard",
      "Startup/auth guard"
    ]);
  });
});

describe("buildE2eTimingAnalysis", () => {
  it("returns one assessment object with gate, regressions, and trends", () => {
    const analysis = buildE2eTimingAnalysis({
      baseline: {
        label: "latest successful main artifact",
        timings: {
          bootstrapMs: 42_000,
          e2eMs: 50_000,
          totalMs: 95_000
        }
      },
      historySummary: {
        count: 7,
        lastRun: {
          timings: {
            bootstrapMs: 43_000,
            e2eMs: 54_000,
            totalMs: 100_000
          }
        },
        medianTimings: {
          bootstrapMs: 44_000,
          e2eMs: 52_000,
          totalMs: 102_000
        }
      },
      requireSustainedRegression: true,
      runSummary: {
        browserInstallMode: "skip",
        bootstrapMode: "snapshot_restore",
        timings: {
          bootstrapMs: 49_500,
          e2eMs: 61_500,
          totalMs: 113_000
        }
      },
      target: "web",
      timingConfig: {
        rows: [
          { key: "totalMs", label: "Total", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "bootstrapMs", label: "Bootstrap", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "e2eMs", label: "Playwright", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 }
        ],
        specialCases: {}
      }
    });

    expect(analysis.gate.reason).toBe("sustained_blocking_regression");
    expect(analysis.shouldFail).toBe(true);
    expect(analysis.blockingForFailure.map((item) => item.label)).toEqual([
      "Total",
      "Bootstrap",
      "Playwright"
    ]);
    expect(analysis.trendSummary.count).toBe(7);
    expect(analysis.trendPhases).toHaveLength(3);
    expect(analysis.trendPhases[0]?.vsLast.classification).toBe("regressing");
  });
});
