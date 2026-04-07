import { describe, expect, it } from "vitest";

import {
  buildServiceHistoryHref,
  parseCustomerServiceHistorySearchParams,
  parseVehicleServiceHistorySearchParams
} from "./filters";

describe("service history filters", () => {
  it("parses customer history search params with repeated status filters", () => {
    const query = parseCustomerServiceHistorySearchParams({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      vehicleId: "5ef72a8e-8b31-4f67-962e-f3e13f68e122",
      jobStatuses: ["completed", "canceled"],
      invoiceStatuses: ["issued", "paid"],
      sort: "created_at"
    });

    expect(query).toEqual({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      vehicleId: "5ef72a8e-8b31-4f67-962e-f3e13f68e122",
      jobStatuses: ["completed", "canceled"],
      inspectionStatuses: [],
      estimateStatuses: [],
      invoiceStatuses: ["issued", "paid"],
      paymentStatuses: [],
      sort: "created_at"
    });
  });

  it("omits vehicle filters for vehicle history parsing", () => {
    const query = parseVehicleServiceHistorySearchParams({
      paymentStatuses: ["succeeded"]
    });

    expect(query).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      jobStatuses: [],
      inspectionStatuses: [],
      estimateStatuses: [],
      invoiceStatuses: [],
      paymentStatuses: ["succeeded"],
      sort: undefined
    });
  });

  it("builds repeatable hrefs for status arrays", () => {
    const href = buildServiceHistoryHref("/dashboard/customers/customer-1/history", {
      dateFrom: "2026-03-01",
      invoiceStatuses: ["issued", "paid"],
      paymentStatuses: ["succeeded"],
      sort: "service_date"
    });

    expect(href).toBe(
      "/dashboard/customers/customer-1/history?dateFrom=2026-03-01&invoiceStatuses=issued&invoiceStatuses=paid&paymentStatuses=succeeded&sort=service_date"
    );
  });
});