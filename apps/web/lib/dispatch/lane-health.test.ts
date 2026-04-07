import { describe, expect, it } from "vitest";

import { getDispatchLaneLoadState, getDispatchResourceLaneState } from "./lane-health";

describe("dispatch lane health helpers", () => {
  it("prioritizes conflicts and utilization thresholds for load state", () => {
    expect(
      getDispatchLaneLoadState({
        availabilityCount: 0,
        blockedPercent: 0,
        conflictCount: 1,
        utilizationPercent: 95
      })
    ).toEqual({ label: "Conflict", tone: "danger" });

    expect(
      getDispatchLaneLoadState({
        availabilityCount: 0,
        blockedPercent: 0,
        conflictCount: 0,
        utilizationPercent: 72
      })
    ).toEqual({ label: "Loaded", tone: "brand" });

    expect(
      getDispatchLaneLoadState({
        availabilityCount: 0,
        blockedPercent: 0,
        conflictCount: 0,
        utilizationPercent: 30
      })
    ).toEqual({ label: "Flow", tone: "info" });
  });

  it("treats blocked availability as shaped when capacity is otherwise open", () => {
    expect(
      getDispatchLaneLoadState({
        availabilityCount: 1,
        blockedPercent: 25,
        conflictCount: 0,
        utilizationPercent: 10
      })
    ).toEqual({ label: "Shaped", tone: "neutral" });
  });

  it("summarizes resource lane state from backlog and schedule counts", () => {
    expect(
      getDispatchResourceLaneState({
        availabilityBlockCount: 0,
        backlogCount: 2,
        conflictCount: 0,
        scheduledCount: 4
      })
    ).toEqual({ label: "Queued", tone: "warning" });

    expect(
      getDispatchResourceLaneState({
        availabilityBlockCount: 0,
        backlogCount: 0,
        conflictCount: 0,
        scheduledCount: 2
      })
    ).toEqual({ label: "Loaded", tone: "brand" });
  });
});