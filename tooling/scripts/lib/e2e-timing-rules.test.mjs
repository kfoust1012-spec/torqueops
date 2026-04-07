import { describe, expect, it } from "vitest";
import { resolveTimingEvaluationConfig } from "./e2e-timing-rules.mjs";

describe("resolveTimingEvaluationConfig", () => {
  it("loads the default ordered timing rows", () => {
    const config = resolveTimingEvaluationConfig({ target: "web" });

    expect(config.rows.map((row) => row.key)).toEqual([
      "totalMs",
      "bootstrapMs",
      "e2eMs",
      "preflightMs",
      "setupGuardMs",
      "logGuardMs"
    ]);
    expect(config.specialCases.preparedStateSkipFullBrowserInstall?.severity).toBe("error");
  });

  it("applies target-specific overrides without code branching", () => {
    const webConfig = resolveTimingEvaluationConfig({ target: "web" });
    const mobileConfig = resolveTimingEvaluationConfig({ target: "mobile" });
    const webPreflightRule = webConfig.rows.find((row) => row.key === "preflightMs");
    const mobilePreflightRule = mobileConfig.rows.find((row) => row.key === "preflightMs");
    const webE2eRule = webConfig.rows.find((row) => row.key === "e2eMs");
    const mobileE2eRule = mobileConfig.rows.find((row) => row.key === "e2eMs");

    expect(webPreflightRule?.minDeltaMs).toBe(2_500);
    expect(mobilePreflightRule?.minDeltaMs).toBe(4_000);
    expect(mobilePreflightRule?.baselineMinMs).toBe(5_000);
    expect(webE2eRule?.minDeltaMs).toBe(5_000);
    expect(mobileE2eRule?.minDeltaMs).toBe(7_000);
  });
});
