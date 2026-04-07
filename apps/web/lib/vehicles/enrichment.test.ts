import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  isVinReadyForDecode: (value: string | null | undefined) => {
    if (!value) {
      return false;
    }

    return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
  },
  normalizeOptionalText: (value: string | null | undefined) => {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  },
  normalizeVinForDecode: (value: string | null | undefined) => {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().toUpperCase();
    return normalized ? normalized : null;
  }
}));

vi.mock("./vin-decoder", () => ({
  decodeVin: vi.fn()
}));

import { enrichVehicleInputWithVinDecode, mergeVehicleInputWithDecodedFields } from "./enrichment";
import { decodeVin } from "./vin-decoder";

describe("vehicle enrichment", () => {
  it("fills only blank manual fields during server-side enrichment", () => {
    expect(
      mergeVehicleInputWithDecodedFields(
        {
          companyId: "company-1",
          customerId: "customer-1",
          year: null,
          make: "",
          model: "Accord",
          trim: null,
          engine: "",
          vin: "1HGCM82633A004352"
        },
        {
          year: 2020,
          make: "Honda",
          model: "Civic",
          trim: "EX",
          engine: "2.0L I4"
        }
      )
    ).toMatchObject({
      year: 2020,
      make: "Honda",
      model: "Accord",
      trim: "EX",
      engine: "2.0L I4"
    });
  });

  it("keeps manual input unchanged when decode fails", async () => {
    vi.mocked(decodeVin).mockResolvedValue({
      vin: "1HGCM82633A004352",
      status: "provider_error",
      decoded: {
        year: null,
        make: null,
        model: null,
        trim: null,
        engine: null
      },
      warnings: ["Vehicle details could not be fetched right now. Manual entry is still available."],
      source: "nhtsa"
    });

    await expect(
      enrichVehicleInputWithVinDecode({
        companyId: "company-1",
        customerId: "customer-1",
        year: 2022,
        make: "Honda",
        model: "Civic",
        trim: null,
        engine: null,
        vin: "1hgcm82633a004352"
      })
    ).resolves.toMatchObject({
      input: {
        year: 2022,
        make: "Honda",
        model: "Civic",
        vin: "1HGCM82633A004352"
      },
      decodeResult: {
        status: "provider_error"
      }
    });
  });

  it("updates untouched edit values when they still match the original stored vehicle fields", () => {
    expect(
      mergeVehicleInputWithDecodedFields(
        {
          customerId: "customer-1",
          year: 2021,
          make: "Honda",
          model: "Civic",
          trim: "Sport",
          engine: "2.0L I4",
          vin: "1HGCM82633A004352"
        },
        {
          year: 2020,
          make: "Honda",
          model: "Civic",
          trim: "EX",
          engine: "1.5L Turbo"
        },
        {
          year: 2021,
          make: "Honda",
          model: "Civic",
          trim: "Sport",
          engine: "2.0L I4"
        }
      )
    ).toMatchObject({
      year: 2020,
      make: "Honda",
      model: "Civic",
      trim: "EX",
      engine: "1.5L Turbo"
    });
  });
});