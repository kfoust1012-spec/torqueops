import { describe, expect, it } from "vitest";

import {
  buildAppointmentConfirmationBody,
  buildDispatchUpdateBody
} from "./rendering";

describe("communication rendering", () => {
  it("includes meet your mechanic details in appointment confirmations", () => {
    const body = buildAppointmentConfirmationBody({
      customerName: "Jamie Carter",
      jobTitle: "Brake inspection",
      scheduledStartAt: "2026-03-11T14:00:00.000Z",
      scheduledEndAt: null,
      arrivalWindowStartAt: null,
      arrivalWindowEndAt: null,
      companyTimeZone: "America/Chicago",
      technicianName: "Alex Tech",
      technicianProfile: {
        userId: "tech-1",
        fullName: "Alex Tech",
        bio: "ASE certified mobile mechanic focused on transparent repair advice.",
        certifications: ["ASE A5 Brakes", "ASE A6 Electrical"],
        yearsExperience: 9,
        photoUrl: "https://example.com/photo.jpg"
      },
      serviceAddress: "123 Main St, Austin, TX 78701",
      visitUrl: "https://example.com/visit/token",
      actionUrl: null
    });

    expect(body).toContain("Meet your mechanic: Alex Tech");
    expect(body).toContain("Experience: 9 years");
    expect(body).toContain("Mechanic profile and visit details: https://example.com/visit/token");
  });

  it("still renders dispatch updates when only the visit url is available", () => {
    const body = buildDispatchUpdateBody({
      customerName: "Jamie Carter",
      jobTitle: "Brake inspection",
      updateType: "en_route",
      technicianName: "Alex Tech",
      technicianProfile: null,
      scheduledStartAt: null,
      arrivalWindowStartAt: null,
      arrivalWindowEndAt: null,
      companyTimeZone: "America/Chicago",
      serviceAddress: null,
      visitUrl: "https://example.com/visit/token",
      actionUrl: null
    });

    expect(body).toContain("Your technician is on the way for Brake inspection.");
    expect(body).toContain("Mechanic profile and visit details: https://example.com/visit/token");
  });

  it("renders running late dispatch updates with the delayed copy", () => {
    const body = buildDispatchUpdateBody({
      customerName: "Jamie Carter",
      jobTitle: "Brake inspection",
      updateType: "running_late",
      technicianName: "Alex Tech",
      technicianProfile: null,
      scheduledStartAt: "2026-03-11T14:00:00.000Z",
      arrivalWindowStartAt: null,
      arrivalWindowEndAt: null,
      companyTimeZone: "America/Chicago",
      serviceAddress: null,
      visitUrl: null,
      actionUrl: null
    });

    expect(body).toContain("Your technician is running late for Brake inspection.");
    expect(body).toContain("We will keep you posted as timing shifts.");
  });
});
