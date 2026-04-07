import { describe, expect, it } from "vitest";

import { getFieldStopStageSummary } from "./field-workflow";

describe("field workflow helpers", () => {
  it("keeps scheduled work in the travel stage", () => {
    const summary = getFieldStopStageSummary({
      jobStatus: "scheduled"
    });

    expect(summary.stage).toBe("travel");
    expect(summary.label).toBe("Ready to depart");
  });

  it("keeps unreleased work out of the live field stages", () => {
    const summary = getFieldStopStageSummary({
      jobStatus: "new"
    });

    expect(summary.stage).toBe("travel");
    expect(summary.label).toBe("Awaiting release");
    expect(summary.blocker).toContain("not fully released");
  });

  it("prioritizes inspection before later blockers", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 0,
      estimateStatus: "accepted",
      inspectionStatus: "in_progress",
      invoiceStatus: "issued",
      jobStatus: "in_progress",
      photoCount: 2
    });

    expect(summary.stage).toBe("inspection");
    expect(summary.nextActionLabel).toBe("Open inspection");
  });

  it("keeps en route work in the travel stage", () => {
    const summary = getFieldStopStageSummary({
      jobStatus: "en_route"
    });

    expect(summary.stage).toBe("travel");
    expect(summary.label).toBe("En route");
    expect(summary.nextActionLabel).toBe("Mark arrived");
  });

  it("surfaces approval before billing when an estimate is sent", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 0,
      estimateStatus: "sent",
      inspectionStatus: "completed",
      invoiceStatus: "issued",
      jobStatus: "in_progress",
      photoCount: 3
    });

    expect(summary.stage).toBe("approval");
    expect(summary.label).toBe("Waiting approval");
  });

  it("surfaces estimate drafting before invoice work", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 0,
      estimateStatus: "draft",
      inspectionStatus: "completed",
      invoiceStatus: "draft",
      jobStatus: "in_progress",
      photoCount: 1
    });

    expect(summary.stage).toBe("approval");
    expect(summary.label).toBe("Estimate draft");
  });

  it("surfaces payment due when billing is still open", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 12500,
      estimateStatus: "accepted",
      inspectionStatus: "completed",
      invoiceStatus: "issued",
      jobStatus: "in_progress",
      photoCount: 2
    });

    expect(summary.stage).toBe("billing");
    expect(summary.label).toBe("Payment due");
  });

  it("surfaces waiting parts as its own stage", () => {
    const summary = getFieldStopStageSummary({
      jobStatus: "waiting_parts"
    });

    expect(summary.stage).toBe("parts");
    expect(summary.label).toBe("Waiting parts");
  });

  it("marks the stop ready to close only after evidence is present", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 0,
      estimateStatus: "accepted",
      inspectionStatus: "completed",
      invoiceStatus: "paid",
      jobStatus: "in_progress",
      photoCount: 1
    });

    expect(summary.stage).toBe("closeout");
    expect(summary.label).toBe("Ready to close");
  });

  it("blocks voided estimates before billing", () => {
    const summary = getFieldStopStageSummary({
      balanceDueCents: 0,
      estimateStatus: "void",
      inspectionStatus: "completed",
      invoiceStatus: "draft",
      jobStatus: "in_progress",
      photoCount: 1
    });

    expect(summary.stage).toBe("approval");
    expect(summary.label).toBe("Estimate voided");
  });
});
