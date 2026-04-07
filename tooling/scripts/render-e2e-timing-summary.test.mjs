import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveE2eCiRunSummary } from "./lib/e2e-ci-run-summary.mjs";
import { resolveTimingEvaluationConfig } from "./lib/e2e-timing-rules.mjs";
import {
  evaluateTimingRegressions,
  renderE2eTimingSummary,
  resolveBaselineReference
} from "./render-e2e-timing-summary.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-run-summary-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("renderE2eTimingSummary", () => {
  it("renders per-phase baselines and deltas", () => {
    const markdown = renderE2eTimingSummary({
      baseline: {
        label: "checked-in fallback",
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
        bootstrapMode: "snapshot_restore",
        browserInstallMode: "skip",
        outcome: "passed",
        prepareMode: "snapshot_restore",
        timings: {
          bootstrapMs: 38_400,
          e2eMs: 68_100,
          logGuardMs: 350,
          preflightMs: 500,
          setupGuardMs: 275,
          totalMs: 107_625
        }
      },
      target: "web"
    });

    expect(markdown).toContain("## E2E Timing Summary (web)");
    expect(markdown).toContain("- Baseline source: `checked-in fallback`");
    expect(markdown).toContain("- History source: `no recent main history downloaded`");
    expect(markdown).toContain("| Bootstrap | 38.4s | 42.0s | -3.6s (-8.6%) | n/a | n/a |");
    expect(markdown).toContain("| Total | 1m 47.6s | 1m 55.0s | -7.4s (-6.4%) | n/a | n/a |");
    expect(markdown).toContain("No timing regressions crossed the reporting threshold");
  });

  it("includes regression notes when a target is materially slower than baseline", () => {
    const markdown = renderE2eTimingSummary({
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
      runSummary: {
        bootstrapMode: "prepared_state_skip",
        browserInstallMode: "install",
        outcome: "passed",
        timings: {
          bootstrapMs: 48_500,
          e2eMs: 61_000,
          logGuardMs: 1_200,
          preflightMs: 3_800,
          setupGuardMs: 2_250,
          totalMs: 112_000
        }
      },
      target: "mobile"
    });

    expect(markdown).toContain("Blocking regressions");
    expect(markdown).toContain("Warnings");
    expect(markdown).toContain("Bootstrap is slower than baseline by 6.5s (15.5%).");
    expect(markdown).toContain("Playwright is slower than baseline by 11.0s (22.0%).");
    expect(markdown).toContain("Prepared-state skip still triggered a full Playwright browser install.");
    expect(markdown).toContain("Setup guard is slower than baseline by 1.3s (125.0%).");
    expect(markdown).toContain("(allowlisted noisy phase)");
  });

  it("renders a fallback message when the run summary is missing", () => {
    expect(renderE2eTimingSummary({
      baseline: null,
      runSummary: null,
      target: "web"
    })).toContain("No run summary artifact was found");
  });

  it("shows trend deltas against the last run and median when history exists", () => {
    const markdown = renderE2eTimingSummary({
      baseline: {
        label: "latest successful main artifact",
        timings: {
          bootstrapMs: 39_000,
          totalMs: 105_000
        }
      },
      historySummary: {
        count: 7,
        lastRun: {
          timings: {
            bootstrapMs: 39_000,
            totalMs: 105_000
          }
        },
        medianTimings: {
          bootstrapMs: 40_000,
          totalMs: 108_000
        }
      },
      runSummary: {
        bootstrapMode: "snapshot_restore",
        browserInstallMode: "skip",
        outcome: "passed",
        timings: {
          bootstrapMs: 38_000,
          totalMs: 103_000
        }
      },
      target: "web",
      timingConfig: {
        rows: [
          { key: "totalMs", label: "Total", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
          { key: "bootstrapMs", label: "Bootstrap", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 }
        ]
      }
    });

    expect(markdown).toContain("- History source: `7` recent successful main runs");
    expect(markdown).toContain("| Total | 1m 43.0s | 1m 45.0s | -2.0s (-1.9%) | -2.0s (-1.9%) | -5.0s (-4.6%) |");
    expect(markdown).toContain("| Bootstrap | 38.0s | 39.0s | -1.0s (-2.6%) | -1.0s (-2.6%) | -2.0s (-5.0%) |");
    expect(markdown).toContain("Trend classification");
    expect(markdown).toContain("- Total: flat vs last run, improving vs 7-run median");
    expect(markdown).toContain("- Bootstrap: flat vs last run, flat vs 7-run median");
  });
});

describe("resolveBaselineReference", () => {
  it("prefers a downloaded main-branch summary artifact when present", () => {
    const repoRoot = createTempRepo();
    const baselineSummaryPath = path.join(repoRoot, ".artifacts", "e2e", "main-baseline", "web", "web-e2e-ci-summary.json");
    fs.mkdirSync(path.dirname(baselineSummaryPath), { recursive: true });
    fs.writeFileSync(baselineSummaryPath, JSON.stringify({
      outcome: "passed",
      timings: {
        bootstrapMs: 39_000,
        totalMs: 105_000
      }
    }), "utf8");

    const baseline = resolveBaselineReference({
      baselineConfig: {
        web: {
          timings: {
            bootstrapMs: 42_000,
            totalMs: 115_000
          }
        }
      },
      repoRoot,
      target: "web"
    });

    expect(baseline.label).toBe("latest successful main artifact");
    expect(baseline.timings?.bootstrapMs).toBe(39_000);
  });

  it("falls back to the checked-in baseline when no downloaded artifact exists", () => {
    const repoRoot = createTempRepo();

    const baseline = resolveBaselineReference({
      baselineConfig: {
        mobile: {
          timings: {
            bootstrapMs: 42_000,
            totalMs: 95_000
          }
        }
      },
      baselinePath: path.join(repoRoot, "tooling", "e2e-timing-baselines.json"),
      repoRoot,
      target: "mobile"
    });

    expect(baseline.label).toBe("checked-in fallback");
    expect(baseline.timings?.totalMs).toBe(95_000);
  });
});

describe("evaluateTimingRegressions", () => {
  it("splits blocking and warning-tier regressions", () => {
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
      target: "web",
      timingConfig: resolveTimingEvaluationConfig({ target: "web" })
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

  it("uses target-specific thresholds from the timing rules config", () => {
    const runSummary = {
      bootstrapMode: "snapshot_restore",
      browserInstallMode: "skip",
      timings: {
        bootstrapMs: 42_200,
        e2eMs: 55_800,
        logGuardMs: 1_100,
        preflightMs: 4_200,
        setupGuardMs: 1_050,
        totalMs: 116_000
      }
    };
    const baseline = {
      label: "latest successful main artifact",
      timings: {
        bootstrapMs: 42_000,
        e2eMs: 50_000,
        logGuardMs: 1_000,
        preflightMs: 1_000,
        setupGuardMs: 1_000,
        totalMs: 110_000
      }
    };

    const webRegressions = evaluateTimingRegressions(runSummary, baseline, {
      target: "web",
      timingConfig: resolveTimingEvaluationConfig({ target: "web" })
    });
    const mobileRegressions = evaluateTimingRegressions(runSummary, baseline, {
      target: "mobile",
      timingConfig: resolveTimingEvaluationConfig({ target: "mobile" })
    });

    expect(webRegressions.warnings.map((item) => item.label)).toContain("Preflight");
    expect(mobileRegressions.warnings.map((item) => item.label)).not.toContain("Preflight");
    expect(webRegressions.blocking.map((item) => item.label)).toContain("Playwright");
    expect(mobileRegressions.blocking.map((item) => item.label)).not.toContain("Playwright");
  });
});

describe("saveE2eCiRunSummary", () => {
  it("writes the target summary artifact to the expected path", () => {
    const repoRoot = createTempRepo();

    saveE2eCiRunSummary("web", {
      outcome: "passed",
      timings: {
        totalMs: 1_000
      }
    }, repoRoot);

    const summaryPath = path.join(repoRoot, ".artifacts", "e2e", "web-e2e-ci-summary.json");
    expect(fs.existsSync(summaryPath)).toBe(true);
  });
});
