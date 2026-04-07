import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultE2eTimingHistoryDir,
  loadE2eTimingHistory,
  summarizeE2eTimingHistory
} from "./e2e-timing-history.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-history-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

function writeSummary(repoRoot, target, runId, summary) {
  const targetDir = path.join(getDefaultE2eTimingHistoryDir(target, repoRoot), String(runId));
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, `${target}-e2e-ci-summary.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("loadE2eTimingHistory", () => {
  it("loads and sorts downloaded timing summary artifacts by recency", () => {
    const repoRoot = createTempRepo();
    writeSummary(repoRoot, "web", 101, {
      createdAt: "2026-03-20T10:00:00.000Z",
      timings: {
        totalMs: 110_000
      },
      updatedAt: "2026-03-20T10:01:00.000Z"
    });
    writeSummary(repoRoot, "web", 102, {
      createdAt: "2026-03-21T10:00:00.000Z",
      timings: {
        totalMs: 108_000
      },
      updatedAt: "2026-03-21T10:01:00.000Z"
    });

    const history = loadE2eTimingHistory("web", repoRoot);

    expect(history.count).toBe(2);
    expect(history.summaries[0]?.timings?.totalMs).toBe(108_000);
    expect(history.summaries[1]?.timings?.totalMs).toBe(110_000);
  });
});

describe("summarizeE2eTimingHistory", () => {
  it("computes last-run and median timing snapshots", () => {
    const summary = summarizeE2eTimingHistory({
      summaries: [
        { timings: { bootstrapMs: 40_000, totalMs: 100_000 } },
        { timings: { bootstrapMs: 42_000, totalMs: 106_000 } },
        { timings: { bootstrapMs: 38_000, totalMs: 104_000 } }
      ]
    }, ["bootstrapMs", "totalMs"]);

    expect(summary.lastRun?.timings?.bootstrapMs).toBe(40_000);
    expect(summary.medianTimings.bootstrapMs).toBe(40_000);
    expect(summary.medianTimings.totalMs).toBe(104_000);
  });
});
