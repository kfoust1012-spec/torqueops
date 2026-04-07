import { describe, expect, it } from "vitest";

import { buildServiceHistoryVisits, summarizeServiceHistory } from "./service";

describe("service history service", () => {
  it("builds filtered visits and summary totals from existing job-linked records", () => {
    const visits = buildServiceHistoryVisits({
      jobs: [
        {
          id: "job-1",
          companyId: "company-1",
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          status: "completed",
          title: "Brake service",
          description: null,
          customerConcern: null,
          internalSummary: null,
          scheduledStartAt: "2026-03-10T14:00:00.000Z",
          scheduledEndAt: null,
          arrivalWindowStartAt: null,
          arrivalWindowEndAt: null,
          startedAt: null,
          completedAt: "2026-03-10T16:00:00.000Z",
          canceledAt: null,
          assignedTechnicianUserId: null,
          priority: "normal",
          source: "office",
          isActive: true,
          createdByUserId: "user-1",
          createdAt: "2026-03-09T12:00:00.000Z",
          updatedAt: "2026-03-10T16:05:00.000Z"
        }
      ],
      estimates: [
        {
          id: "estimate-1",
          companyId: "company-1",
          jobId: "job-1",
          status: "accepted",
          estimateNumber: "EST-001",
          title: "Front brake repair",
          notes: null,
          terms: null,
          currencyCode: "USD",
          taxRateBasisPoints: 0,
          subtotalCents: 30000,
          discountCents: 0,
          taxCents: 0,
          totalCents: 30000,
          sentAt: "2026-03-09T12:30:00.000Z",
          acceptedAt: "2026-03-09T13:00:00.000Z",
          declinedAt: null,
          voidedAt: null,
          approvedSignatureId: null,
          approvedByName: null,
          approvalStatement: null,
          createdByUserId: "user-1",
          createdAt: "2026-03-09T12:00:00.000Z",
          updatedAt: "2026-03-09T13:00:00.000Z"
        }
      ],
      invoices: [
        {
          id: "invoice-1",
          companyId: "company-1",
          jobId: "job-1",
          estimateId: "estimate-1",
          status: "partially_paid",
          invoiceNumber: "INV-001",
          title: "Brake invoice",
          notes: null,
          terms: null,
          currencyCode: "USD",
          paymentUrl: null,
          paymentUrlExpiresAt: null,
          stripeCheckoutSessionId: null,
          taxRateBasisPoints: 0,
          subtotalCents: 30000,
          discountCents: 0,
          taxCents: 0,
          totalCents: 30000,
          amountPaidCents: 15000,
          balanceDueCents: 15000,
          dueAt: null,
          issuedAt: "2026-03-10T16:10:00.000Z",
          paidAt: null,
          voidedAt: null,
          createdByUserId: "user-1",
          createdAt: "2026-03-10T16:10:00.000Z",
          updatedAt: "2026-03-10T16:10:00.000Z"
        }
      ],
      inspections: [
        {
          inspection: {
            id: "inspection-1",
            companyId: "company-1",
            jobId: "job-1",
            status: "completed",
            templateVersion: "v1",
            startedByUserId: "user-1",
            completedByUserId: "user-1",
            startedAt: "2026-03-10T14:05:00.000Z",
            completedAt: "2026-03-10T15:00:00.000Z",
            createdAt: "2026-03-10T14:05:00.000Z",
            updatedAt: "2026-03-10T15:00:00.000Z"
          },
          summary: {
            inspectionId: "inspection-1",
            status: "completed",
            startedAt: "2026-03-10T14:05:00.000Z",
            completedAt: "2026-03-10T15:00:00.000Z",
            criticalCount: 1,
            highCount: 0,
            recommendationCount: 2
          }
        }
      ],
      payments: [
        {
          id: "payment-1",
          companyId: "company-1",
          jobId: "job-1",
          invoiceId: "invoice-1",
          provider: "stripe",
          status: "succeeded",
          stripeCheckoutSessionId: "cs_123",
          stripePaymentIntentId: null,
          stripeChargeId: null,
          stripeEventId: "evt_123",
          manualTenderType: null,
          manualReferenceNote: null,
          recordedByUserId: null,
          amountCents: 15000,
          currencyCode: "USD",
          receiptUrl: null,
          paidAt: "2026-03-10T17:00:00.000Z",
          createdAt: "2026-03-10T17:00:00.000Z",
          updatedAt: "2026-03-10T17:00:00.000Z"
        }
      ],
      vehicleDisplayNamesById: new Map([["vehicle-1", "2021 Honda Civic"]]),
      query: {
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        invoiceStatuses: ["partially_paid"],
        sort: "service_date"
      }
    });

    expect(visits).toHaveLength(1);
    expect(visits[0]?.vehicleDisplayName).toBe("2021 Honda Civic");
    expect(visits[0]?.invoice?.balanceDueCents).toBe(15000);
    expect(visits[0]?.payments).toHaveLength(1);

    expect(summarizeServiceHistory(visits)).toEqual({
      totalJobs: 1,
      completedJobs: 1,
      totalInvoicedCents: 30000,
      totalPaidCents: 15000,
      openBalanceCents: 15000,
      lastServiceAt: "2026-03-10T16:00:00.000Z"
    });
  });

  it("keeps last service date based on service activity even when visits are sorted by creation time", () => {
    const visits = buildServiceHistoryVisits({
      jobs: [
        {
          id: "job-older-service-newer-created",
          companyId: "company-1",
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          status: "completed",
          title: "Older service, newer record",
          description: null,
          customerConcern: null,
          internalSummary: null,
          scheduledStartAt: "2026-02-10T08:00:00.000Z",
          scheduledEndAt: null,
          arrivalWindowStartAt: null,
          arrivalWindowEndAt: null,
          startedAt: null,
          completedAt: "2026-02-10T09:00:00.000Z",
          canceledAt: null,
          assignedTechnicianUserId: null,
          priority: "normal",
          source: "office",
          isActive: true,
          createdByUserId: "user-1",
          createdAt: "2026-03-09T18:00:00.000Z",
          updatedAt: "2026-03-09T18:00:00.000Z"
        },
        {
          id: "job-newer-service-older-created",
          companyId: "company-1",
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          status: "scheduled",
          title: "Newer service, older record",
          description: null,
          customerConcern: null,
          internalSummary: null,
          scheduledStartAt: "2026-03-10T08:00:00.000Z",
          scheduledEndAt: null,
          arrivalWindowStartAt: null,
          arrivalWindowEndAt: null,
          startedAt: null,
          completedAt: null,
          canceledAt: null,
          assignedTechnicianUserId: null,
          priority: "normal",
          source: "office",
          isActive: true,
          createdByUserId: "user-1",
          createdAt: "2026-03-08T18:00:00.000Z",
          updatedAt: "2026-03-08T18:00:00.000Z"
        }
      ],
      estimates: [],
      invoices: [],
      inspections: [],
      payments: [],
      vehicleDisplayNamesById: new Map([['vehicle-1', '2021 Honda Civic']]),
      query: {
        sort: "created_at"
      }
    });

    expect(visits.map((visit) => visit.jobTitle)).toEqual([
      "Older service, newer record",
      "Newer service, older record"
    ]);

    expect(summarizeServiceHistory(visits)).toEqual({
      totalJobs: 2,
      completedJobs: 1,
      totalInvoicedCents: 0,
      totalPaidCents: 0,
      openBalanceCents: 0,
      lastServiceAt: "2026-03-10T08:00:00.000Z"
    });
  });

  it("uses canceled timestamps in service-date ordering ahead of older completed work", () => {
    const visits = buildServiceHistoryVisits({
      jobs: [
        {
          id: "job-canceled",
          companyId: "company-1",
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          status: "canceled",
          title: "Canceled follow-up",
          description: null,
          customerConcern: null,
          internalSummary: null,
          scheduledStartAt: "2026-02-25T15:00:00.000Z",
          scheduledEndAt: null,
          arrivalWindowStartAt: null,
          arrivalWindowEndAt: null,
          startedAt: null,
          completedAt: null,
          canceledAt: "2026-03-05T17:30:00.000Z",
          assignedTechnicianUserId: null,
          priority: "normal",
          source: "office",
          isActive: true,
          createdByUserId: "user-1",
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: "2026-03-05T17:30:00.000Z"
        },
        {
          id: "job-completed",
          companyId: "company-1",
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          status: "completed",
          title: "Completed repair",
          description: null,
          customerConcern: null,
          internalSummary: null,
          scheduledStartAt: "2026-02-18T16:00:00.000Z",
          scheduledEndAt: null,
          arrivalWindowStartAt: null,
          arrivalWindowEndAt: null,
          startedAt: null,
          completedAt: "2026-02-18T17:22:00.000Z",
          canceledAt: null,
          assignedTechnicianUserId: null,
          priority: "normal",
          source: "office",
          isActive: true,
          createdByUserId: "user-1",
          createdAt: "2026-02-18T12:00:00.000Z",
          updatedAt: "2026-02-18T17:22:00.000Z"
        }
      ],
      estimates: [],
      invoices: [],
      inspections: [],
      payments: [],
      vehicleDisplayNamesById: new Map([["vehicle-1", "2021 Honda Civic"]]),
      query: {
        sort: "service_date"
      }
    });

    expect(visits.map((visit) => ({ title: visit.jobTitle, sortAt: visit.sortAt, canceledAt: visit.canceledAt }))).toEqual([
      {
        title: "Canceled follow-up",
        sortAt: "2026-03-05T17:30:00.000Z",
        canceledAt: "2026-03-05T17:30:00.000Z"
      },
      {
        title: "Completed repair",
        sortAt: "2026-02-18T17:22:00.000Z",
        canceledAt: null
      }
    ]);
  });
});
