import { describe, expect, it } from "vitest";
import { buildTimingTrendSummary } from "./e2e-timing-trends.mjs";

describe("buildTimingTrendSummary", () => {
  it("classifies blocking timing phases against the last run and median", () => {
    const trendSummary = buildTimingTrendSummary({
      timings: {
        bootstrapMs: 48_000,
        e2eMs: 61_000,
        totalMs: 112_000
      }
    }, {
      count: 7,
      lastRun: {
        timings: {
          bootstrapMs: 42_000,
          e2eMs: 50_000,
          totalMs: 95_000
        }
      },
      medianTimings: {
        bootstrapMs: 44_000,
        e2eMs: 55_000,
        totalMs: 100_000
      }
    }, {
      rows: [
        { key: "totalMs", label: "Total", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
        { key: "bootstrapMs", label: "Bootstrap", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 },
        { key: "e2eMs", label: "Playwright", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 }
      ]
    });

    expect(trendSummary.phases.map((phase) => phase.label)).toEqual([
      "Total",
      "Bootstrap",
      "Playwright"
    ]);
    expect(trendSummary.phases[0]?.vsLast.classification).toBe("regressing");
    expect(trendSummary.phases[0]?.vsMedian.classification).toBe("regressing");
    expect([...trendSummary.sustainedBlockingKeys]).toEqual([
      "totalMs",
      "e2eMs"
    ]);
  });

  it("marks small movements as flat", () => {
    const trendSummary = buildTimingTrendSummary({
      timings: {
        totalMs: 101_000
      }
    }, {
      count: 3,
      lastRun: {
        timings: {
          totalMs: 100_000
        }
      },
      medianTimings: {
        totalMs: 100_500
      }
    }, {
      rows: [
        { key: "totalMs", label: "Total", severity: "error", baselineMinMs: 20_000, minDeltaMs: 5_000, minPercentDelta: 15 }
      ]
    });

    expect(trendSummary.phases[0]?.vsLast.classification).toBe("flat");
    expect(trendSummary.phases[0]?.vsMedian.classification).toBe("flat");
    expect(trendSummary.sustainedBlockingKeys.size).toBe(0);
  });
});
