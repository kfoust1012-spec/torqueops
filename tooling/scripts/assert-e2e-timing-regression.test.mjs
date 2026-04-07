import { describe, expect, it } from "vitest";
import { assessE2eTimingRegression } from "./assert-e2e-timing-regression.mjs";

describe("assessE2eTimingRegression", () => {
  it("does not fail when only the checked-in fallback baseline exists", () => {
    const result = assessE2eTimingRegression({
      baseline: {
        label: "checked-in fallback",
        timings: {
          e2eMs: 50_000,
          totalMs: 95_000
        }
      },
      runSummary: {
        browserInstallMode: "skip",
        bootstrapMode: "snapshot_restore",
        timings: {
          e2eMs: 62_000,
          totalMs: 112_000
        }
      },
      target: "mobile"
    });

    expect(result.shouldFail).toBe(false);
    expect(result.messages[0]).toContain("timing enforcement only blocks against a latest successful main artifact");
  });

  it("passes when the latest successful main artifact baseline is within threshold", () => {
    const result = assessE2eTimingRegression({
      baseline: {
        label: "latest successful main artifact",
        timings: {
          bootstrapMs: 42_000,
          e2eMs: 70_000,
          totalMs: 115_000
        }
      },
      runSummary: {
        browserInstallMode: "skip",
        bootstrapMode: "snapshot_restore",
        timings: {
          bootstrapMs: 39_000,
          e2eMs: 68_500,
          totalMs: 110_000
        }
      },
      target: "web"
    });

    expect(result.shouldFail).toBe(false);
    expect(result.messages[0]).toContain("No timing regressions crossed");
  });

  it("does not fail when only warning-tier noisy-phase regressions are present", () => {
    const result = assessE2eTimingRegression({
      baseline: {
        label: "latest successful main artifact",
        timings: {
          bootstrapMs: 42_000,
          e2eMs: 70_000,
          logGuardMs: 1_000,
          preflightMs: 1_000,
          setupGuardMs: 1_000,
          totalMs: 115_000
        }
      },
      runSummary: {
        browserInstallMode: "skip",
        bootstrapMode: "snapshot_restore",
        timings: {
          bootstrapMs: 42_500,
          e2eMs: 70_500,
          logGuardMs: 2_150,
          preflightMs: 3_900,
          setupGuardMs: 2_050,
          totalMs: 116_000
        }
      },
      target: "web"
    });

    expect(result.shouldFail).toBe(false);
    expect(result.messages[0]).toContain("warning-tier timing regressions");
    expect(result.messages).toContain("- Preflight is slower than baseline by 2.9s (290.0%). (allowlisted noisy phase)");
  });

  it("does not fail a sustained gate when blocking regressions are not sustained", () => {
    const result = assessE2eTimingRegression({
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
            bootstrapMs: 40_000,
            e2eMs: 48_000,
            totalMs: 92_000
          }
        },
        medianTimings: {
          bootstrapMs: 49_000,
          e2eMs: 61_000,
          totalMs: 112_000
        }
      },
      requireSustainedRegression: true,
      runSummary: {
        browserInstallMode: "skip",
        bootstrapMode: "snapshot_restore",
        timings: {
          bootstrapMs: 48_500,
          e2eMs: 61_000,
          totalMs: 112_000
        }
      },
      target: "web"
    });

    expect(result.shouldFail).toBe(false);
    expect(result.messages[0]).toContain("not sustained");
    expect(result.messages).toContain("- Total is slower than baseline by 17.0s (17.9%).");
    expect(result.messages).toContain("- Total: regressing vs last run, flat vs 7-run median");
  });

  it("fails when the latest successful main artifact baseline is materially slower and sustained", () => {
    const result = assessE2eTimingRegression({
      baseline: {
        label: "latest successful main artifact",
        timings: {
          bootstrapMs: 42_000,
          e2eMs: 50_000,
          logGuardMs: 1_000,
          preflightMs: 1_000,
          setupGuardMs: 1_000,
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
        browserInstallMode: "install",
        bootstrapMode: "prepared_state_skip",
        timings: {
          bootstrapMs: 49_500,
          e2eMs: 61_500,
          logGuardMs: 2_100,
          preflightMs: 3_900,
          setupGuardMs: 2_050,
          totalMs: 113_000
        }
      },
      target: "mobile"
    });

    expect(result.shouldFail).toBe(true);
    expect(result.messages[0]).toContain("Sustained timing regressions exceeded");
    expect(result.messages).toContain("- Bootstrap is slower than baseline by 7.5s (17.9%).");
    expect(result.messages).toContain("- Playwright is slower than baseline by 11.5s (23.0%).");
    expect(result.messages).toContain("- Prepared-state skip still triggered a full Playwright browser install.");
    expect(result.messages).toContain("- Trend Total: regressing vs last run, regressing vs 7-run median");
    expect(result.messages).toContain("- Warning: Setup guard is slower than baseline by 1.1s (105.0%). (allowlisted noisy phase)");
  });
});
