import { beforeAll, describe, expect, it } from "vitest";

let buildTechnicianJobPushNotification: typeof import("./mobile-push-notifications")["buildTechnicianJobPushNotification"];

const baseJob = {
  arrivalWindowEndAt: null,
  arrivalWindowStartAt: null,
  assignedTechnicianUserId: "tech-1",
  canceledAt: null,
  companyId: "company-1",
  completedAt: null,
  createdAt: "2026-04-04T12:00:00.000Z",
  createdByUserId: "user-1",
  customerConcern: null,
  customerId: "customer-1",
  description: null,
  id: "job-1",
  internalSummary: null,
  isActive: true,
  priority: "normal" as const,
  scheduledEndAt: null,
  scheduledStartAt: "2026-04-05T15:00:00.000Z",
  serviceSiteId: null,
  source: "office" as const,
  startedAt: null,
  status: "scheduled" as const,
  title: "Brake inspection",
  updatedAt: "2026-04-04T12:00:00.000Z",
  vehicleId: "vehicle-1"
};

const baseJobSeed = {
  customer: {
    companyId: "company-1",
    companyName: null,
    createdAt: "2026-04-04T12:00:00.000Z",
    email: "customer@example.com",
    firstName: "Alex",
    id: "customer-1",
    isActive: true,
    lastName: "Driver",
    notes: null,
    phone: "555-0100",
    relationshipType: "retail_customer" as const,
    updatedAt: "2026-04-04T12:00:00.000Z"
  },
  job: baseJob,
  primaryAddress: null,
  serviceSite: null,
  vehicle: {
    color: null,
    companyId: "company-1",
    createdAt: "2026-04-04T12:00:00.000Z",
    customerId: "customer-1",
    engine: null,
    id: "vehicle-1",
    isActive: true,
    licensePlate: null,
    licenseState: null,
    make: "Ford",
    model: "Transit",
    notes: null,
    odometer: null,
    ownershipType: "customer_owned" as const,
    trim: null,
    updatedAt: "2026-04-04T12:00:00.000Z",
    vin: null,
    year: 2022
  }
};

describe("buildTechnicianJobPushNotification", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

    ({ buildTechnicianJobPushNotification } = await import("./mobile-push-notifications"));
  });

  it("builds an assignment notification for a newly assigned technician", () => {
    const notification = buildTechnicianJobPushNotification({
      companyTimeZone: "America/Chicago",
      nextJob: baseJob,
      previousJob: {
        ...baseJob,
        assignedTechnicianUserId: null
      }
    });

    expect(notification?.title).toBe("New job assigned");
    expect(notification?.data.type).toBe("job_assigned");
    expect(notification?.data.path).toBe("/jobs/job-1");
  });

  it("builds a timing update only when the same technician keeps the job", () => {
    const notification = buildTechnicianJobPushNotification({
      companyTimeZone: "America/Chicago",
      nextJob: {
        ...baseJob,
        scheduledStartAt: "2026-04-05T17:30:00.000Z"
      },
      previousJob: baseJob
    });

    expect(notification?.title).toBe("Job timing updated");
    expect(notification?.data.type).toBe("job_rescheduled");
  });

  it("includes the stop seed when one is provided", () => {
    const notification = buildTechnicianJobPushNotification({
      companyTimeZone: "America/Chicago",
      jobSeed: baseJobSeed,
      nextJob: baseJob,
      previousJob: {
        ...baseJob,
        assignedTechnicianUserId: null
      }
    });

    expect(notification?.data.jobSeed?.job.id).toBe("job-1");
    expect(notification?.data.jobSeed?.customer.id).toBe("customer-1");
  });

  it("does not emit a push when nothing technician-facing changed", () => {
    expect(
      buildTechnicianJobPushNotification({
        companyTimeZone: "America/Chicago",
        nextJob: baseJob,
        previousJob: baseJob
      })
    ).toBeNull();
  });
});
