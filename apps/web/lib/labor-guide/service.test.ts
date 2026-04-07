import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  buildLaborGuideSignalSearchText: (context: {
    title: string;
    description?: string | null;
    customerConcern?: string | null;
  }) => [context.title, context.description, context.customerConcern].filter(Boolean).join(" ").toLowerCase(),
  buildLaborGuideSearchText: (context: {
    title: string;
    description?: string | null;
    customerConcern?: string | null;
    internalSummary?: string | null;
    vehicle: {
      year: number | null;
      make: string;
      model: string;
      trim: string | null;
      engine: string | null;
    };
  }) =>
    [
      context.title,
      context.description,
      context.customerConcern,
      context.internalSummary,
      context.vehicle.year ? String(context.vehicle.year) : null,
      context.vehicle.make,
      context.vehicle.model,
      context.vehicle.trim,
      context.vehicle.engine
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  countMatchedSignals: (searchText: string, signals: string[]) =>
    signals.filter((signal) => searchText.includes(signal.toLowerCase())),
  getLaborGuideVehicleLabel: (vehicle: { year: number | null; make: string; model: string }) =>
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
  tokenizeLaborGuideText: (value: string) => value.split(/\s+/).filter(Boolean)
}));

import { filterSuggestedOperationsAgainstExistingLineItems, suggestLaborOperations } from "./service";

describe("labor guide service", () => {
  it("returns brake-related suggestions from job context", () => {
    const result = suggestLaborOperations({
      jobId: "11111111-1111-4111-8111-111111111111",
      estimateId: "22222222-2222-4222-8222-222222222222",
      title: "Front brakes grinding when stopping",
      description: "Customer reports brake noise and vibration when braking.",
      customerConcern: "Front brakes are grinding.",
      internalSummary: null,
      vehicle: {
        year: 2019,
        make: "Honda",
        model: "Accord",
        trim: "Sport",
        engine: "2.0L I4",
        vin: null
      }
    });

    expect(result.status).toBe("ready");
    expect(result.operations.map((operation) => operation.code)).toContain("brake-system-inspection");
  });

  it("returns no_match when there is not enough useful context", () => {
    const result = suggestLaborOperations({
      jobId: "11111111-1111-4111-8111-111111111111",
      title: "Help",
      description: null,
      customerConcern: null,
      internalSummary: null,
      vehicle: {
        year: 2018,
        make: "Toyota",
        model: "Camry",
        trim: null,
        engine: null,
        vin: null
      }
    });

    expect(result).toMatchObject({
      status: "no_match",
      operations: []
    });
  });

  it("hides suggestions that already exist as labor line items on the estimate", () => {
    const result = suggestLaborOperations({
      jobId: "11111111-1111-4111-8111-111111111111",
      estimateId: "22222222-2222-4222-8222-222222222222",
      title: "Front brakes grinding when stopping",
      description: "Customer reports brake noise and vibration when braking.",
      customerConcern: "Front brakes are grinding.",
      internalSummary: null,
      vehicle: {
        year: 2019,
        make: "Honda",
        model: "Accord",
        trim: "Sport",
        engine: "2.0L I4",
        vin: null
      }
    });

    const filtered = filterSuggestedOperationsAgainstExistingLineItems(result, [
      {
        itemType: "labor",
        name: "Brake system inspection"
      }
    ]);

    expect(filtered.operations.map((operation) => operation.name)).not.toContain("Brake system inspection");
    expect(filtered.warnings[0]).toContain("hidden to avoid duplicate labor line items");
  });

  it("does not let internal summary history text drive suggestions by itself", () => {
    const result = suggestLaborOperations({
      jobId: "11111111-1111-4111-8111-111111111111",
      title: "Customer wants a pre-purchase inspection",
      description: "General check before buying the vehicle.",
      customerConcern: null,
      internalSummary: "History note: prior Carfax entry mentions oil change overdue and spark plugs due.",
      vehicle: {
        year: 2019,
        make: "Honda",
        model: "Accord",
        trim: "Sport",
        engine: "2.0L I4",
        vin: null
      }
    });

    expect(result).toMatchObject({
      status: "no_match",
      operations: []
    });
  });

  it("prefers confirmed battery replacement labor over generic starting diagnosis", () => {
    const result = suggestLaborOperations({
      jobId: "11111111-1111-4111-8111-111111111111",
      title: "No-start battery and charging diagnosis",
      description: "Customer needs battery replacement after testing.",
      customerConcern: "battery replacement",
      internalSummary: null,
      vehicle: {
        year: 2020,
        make: "Honda",
        model: "CR-V",
        trim: "EX",
        engine: "1.5L Turbo",
        vin: null
      }
    });

    expect(result.status).toBe("ready");
    expect(result.operations[0]?.code).toBe("battery-replacement");
  });
});
