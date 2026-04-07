import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCompanyContextResultMock,
  getCustomerDisplayNameMock,
  listCustomersByCompanyMock,
  listInvoicesByCompanyMock,
  listJobsByCompanyMock,
  listVehiclesByCompanyMock
} = vi.hoisted(() => ({
  getCompanyContextResultMock: vi.fn(),
  getCustomerDisplayNameMock: vi.fn(),
  listCustomersByCompanyMock: vi.fn(),
  listInvoicesByCompanyMock: vi.fn(),
  listJobsByCompanyMock: vi.fn(),
  listVehiclesByCompanyMock: vi.fn()
}));

vi.mock("@mobile-mechanic/api-client", () => ({
  listCustomersByCompany: listCustomersByCompanyMock,
  listInvoicesByCompany: listInvoicesByCompanyMock,
  listJobsByCompany: listJobsByCompanyMock,
  listVehiclesByCompany: listVehiclesByCompanyMock
}));

vi.mock("@mobile-mechanic/core", () => ({
  getCustomerDisplayName: getCustomerDisplayNameMock
}));

vi.mock("../../../../lib/company-context", () => ({
  getCompanyContextResult: getCompanyContextResultMock
}));

import { GET } from "./route";

function createReturningBuilder<T>(result: Promise<{ data: T; error: Error | null }>) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn(() => result),
    select: vi.fn(() => builder)
  };

  return builder;
}

describe("command search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no results for short search terms without loading lookup sources", async () => {
    getCompanyContextResultMock.mockResolvedValue({
      context: {
        companyId: "company-1",
        supabase: { from: vi.fn() }
      },
      status: "ok"
    });

    const response = await GET(new Request("http://localhost/api/internal/command-search?q=a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: []
    });
    expect(listCustomersByCompanyMock).not.toHaveBeenCalled();
    expect(listVehiclesByCompanyMock).not.toHaveBeenCalled();
    expect(listJobsByCompanyMock).not.toHaveBeenCalled();
    expect(listInvoicesByCompanyMock).not.toHaveBeenCalled();
  });

  it("surfaces service sites with the related customer account name", async () => {
    const serviceSitesBuilder = createReturningBuilder(
      Promise.resolve({
        data: [
          {
            city: "Austin",
            customer_id: "cust-2",
            id: "site-1",
            is_active: true,
            is_primary: true,
            label: "Main lot",
            line1: "100 Main St",
            postal_code: "78701",
            service_contact_name: "Dana Yard",
            site_name: "Downtown yard",
            state: "TX"
          }
        ],
        error: null
      })
    );
    const relatedCustomersBuilder = createReturningBuilder(
      Promise.resolve({
        data: [
          {
            company_name: "North Loop Fleet",
            first_name: null,
            id: "cust-2",
            last_name: null,
            relationship_type: "fleet_account"
          }
        ],
        error: null
      })
    );

    getCompanyContextResultMock.mockResolvedValue({
      context: {
        companyId: "company-1",
        supabase: {
          from: vi.fn((table: string) => {
            if (table === "customer_addresses") {
              return serviceSitesBuilder;
            }

            if (table === "customers") {
              return relatedCustomersBuilder;
            }

            throw new Error(`Unexpected table lookup: ${table}`);
          })
        }
      },
      status: "ok"
    });
    listCustomersByCompanyMock.mockResolvedValue({
      data: [
        {
          displayName: "Alex Rivera",
          email: "alex@example.com",
          id: "cust-1",
          phone: "555-0100",
          relationshipType: "retail_customer"
        }
      ],
      error: null
    });
    listVehiclesByCompanyMock.mockResolvedValue({
      data: [
        {
          customerId: "cust-2",
          displayName: "2020 Ford Transit",
          id: "vehicle-1",
          licensePlate: "TEX123",
          vin: "VIN123"
        }
      ],
      error: null
    });
    listJobsByCompanyMock.mockResolvedValue({
      data: [
        {
          customerDisplayName: "North Loop Fleet",
          id: "job-1",
          status: "en_route",
          title: "Brake service",
          vehicleDisplayName: "2020 Ford Transit"
        }
      ],
      error: null
    });
    listInvoicesByCompanyMock.mockResolvedValue({
      data: [
        {
          invoiceId: "invoice-1",
          invoiceNumber: "INV-1001",
          title: "Brake service"
        }
      ],
      error: null
    });
    getCustomerDisplayNameMock.mockReturnValue("North Loop Fleet");

    const response = await GET(
      new Request("http://localhost/api/internal/command-search?q=yard")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results).toContainEqual(
      expect.objectContaining({
        hint: "North Loop Fleet · 100 Main St, Austin, TX, 78701 · Site thread",
        href: "/dashboard/customers?customerId=cust-2&tab=addresses&editAddressId=site-1",
        icon: "customers",
        keywords: expect.arrayContaining([
          "North Loop Fleet",
          "site thread",
          "Dana Yard",
          "100 Main St",
          "Austin",
          "TX",
          "78701"
        ]),
        label: "Downtown yard",
        tier: "workspace"
      })
    );
    expect(payload.results).toContainEqual(
      expect.objectContaining({
        hint: "North Loop Fleet · TEX123 · VIN123",
        href: "/dashboard/customers?customerId=cust-2&tab=vehicles&selectedVehicleId=vehicle-1",
        label: "2020 Ford Transit"
      })
    );
    expect(getCustomerDisplayNameMock).toHaveBeenCalledWith({
      companyName: "North Loop Fleet",
      firstName: null,
      lastName: null,
      relationshipType: "fleet_account"
    });
  });
});
