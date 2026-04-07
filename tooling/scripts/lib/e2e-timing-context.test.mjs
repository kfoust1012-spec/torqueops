import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadE2eTimingContext,
  resolveE2eTimingBaselineReference
} from "./e2e-timing-context.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-timing-context-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("resolveE2eTimingBaselineReference", () => {
  it("prefers the downloaded main baseline artifact over the checked-in fallback", () => {
    const repoRoot = createTempRepo();
    writeJson(
      path.join(repoRoot, ".artifacts", "e2e", "main-baseline", "web", "web-e2e-ci-summary.json"),
      {
        timings: {
          totalMs: 101_000
        }
      }
    );

    const baseline = resolveE2eTimingBaselineReference({
      baselineConfig: {
        web: {
          timings: {
            totalMs: 115_000
          }
        }
      },
      repoRoot,
      target: "web"
    });

    expect(baseline.label).toBe("latest successful main artifact");
    expect(baseline.timings?.totalMs).toBe(101_000);
  });
});

describe("loadE2eTimingContext", () => {
  it("loads baseline, history summary, timing config, and run summary through one shared path", () => {
    const repoRoot = createTempRepo();
    writeJson(path.join(repoRoot, "tooling", "e2e-timing-baselines.json"), {
      web: {
        timings: {
          bootstrapMs: 42_000,
          totalMs: 115_000
        }
      }
    });
    writeJson(path.join(repoRoot, "tooling", "e2e-timing-rules.json"), {
      rows: [
        {
          key: "totalMs",
          label: "Total",
          severity: "error",
          baselineMinMs: 20_000,
          minDeltaMs: 5_000,
          minPercentDelta: 15
        },
        {
          key: "bootstrapMs",
          label: "Bootstrap",
          severity: "error",
          baselineMinMs: 20_000,
          minDeltaMs: 5_000,
          minPercentDelta: 15
        }
      ]
    });
    writeJson(path.join(repoRoot, ".artifacts", "e2e", "web-e2e-ci-summary.json"), {
      outcome: "passed",
      timings: {
        bootstrapMs: 39_500,
        totalMs: 109_000
      }
    });
    writeJson(path.join(repoRoot, ".artifacts", "e2e", "main-history", "web", "a.json"), {
      updatedAt: "2026-03-27T12:00:00.000Z",
      timings: {
        bootstrapMs: 40_000,
        totalMs: 110_000
      }
    });
    writeJson(path.join(repoRoot, ".artifacts", "e2e", "main-history", "web", "b.json"), {
      updatedAt: "2026-03-26T12:00:00.000Z",
      timings: {
        bootstrapMs: 41_000,
        totalMs: 112_000
      }
    });

    const context = loadE2eTimingContext({
      repoRoot,
      target: "web"
    });

    expect(context.baseline.label).toBe("checked-in fallback");
    expect(context.historySummary.count).toBe(2);
    expect(context.historySummary.lastRun?.timings?.totalMs).toBe(110_000);
    expect(context.historySummary.medianTimings.totalMs).toBe(111_000);
    expect(context.runSummary?.outcome).toBe("passed");
    expect(context.timingConfig.rows.map((row) => row.key)).toEqual(["totalMs", "bootstrapMs"]);
    expect(context.timingRulesPath).toContain(path.join("tooling", "e2e-timing-rules.json"));
  });
});
