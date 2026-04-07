import { describe, expect, it } from "vitest";

import {
  canTechnicianTransitionJobStatus,
  getAllowedTechnicianNextJobStatuses,
  isTechnicianActiveFieldJobStatus,
  isTechnicianLiveJobStatus,
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus,
  isTechnicianUpcomingJobStatus
} from "./status";

describe("job status helpers", () => {
  it("treats en route work as live technician work", () => {
    expect(isTechnicianLiveJobStatus("en_route")).toBe(true);
    expect(isTechnicianActiveFieldJobStatus("en_route")).toBe(true);
    expect(isTechnicianTravelJobStatus("en_route")).toBe(true);
    expect(isTechnicianOnSiteJobStatus("en_route")).toBe(false);
    expect(isTechnicianUpcomingJobStatus("en_route")).toBe(false);
  });

  it("keeps scheduled work in the upcoming queue", () => {
    expect(isTechnicianUpcomingJobStatus("scheduled")).toBe(true);
    expect(isTechnicianLiveJobStatus("scheduled")).toBe(false);
  });

  it("allows technicians to move from dispatch to en route", () => {
    expect(getAllowedTechnicianNextJobStatuses("dispatched")).toEqual(["en_route"]);
    expect(canTechnicianTransitionJobStatus("dispatched", "en_route")).toBe(true);
  });

  it("allows technicians to move from repair into payment-ready closeout", () => {
    expect(getAllowedTechnicianNextJobStatuses("repairing")).toContain("ready_for_payment");
    expect(canTechnicianTransitionJobStatus("repairing", "ready_for_payment")).toBe(true);
  });

  it("treats arrived work as on-site technician work", () => {
    expect(isTechnicianActiveFieldJobStatus("arrived")).toBe(true);
    expect(isTechnicianOnSiteJobStatus("arrived")).toBe(true);
    expect(isTechnicianTravelJobStatus("arrived")).toBe(false);
    expect(isTechnicianLiveJobStatus("arrived")).toBe(true);
  });

  it("treats dispatched work as active field work without moving it into the mobile live bucket", () => {
    expect(isTechnicianActiveFieldJobStatus("dispatched")).toBe(true);
    expect(isTechnicianUpcomingJobStatus("dispatched")).toBe(true);
    expect(isTechnicianLiveJobStatus("dispatched")).toBe(false);
  });
});
