import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  getMissingDecodedVehicleFieldLabels: (decoded: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
  }) => {
    const missing: string[] = [];

    if (!decoded.year) {
      missing.push("year");
    }

    if (!decoded.make) {
      missing.push("make");
    }

    if (!decoded.model) {
      missing.push("model");
    }

    if (!decoded.trim) {
      missing.push("trim");
    }

    if (!decoded.engine) {
      missing.push("engine");
    }

    return missing;
  },
  hasDecodedVehicleCoreFields: (decoded: {
    year: number | null;
    make: string | null;
    model: string | null;
  }) => Boolean(decoded.year && decoded.make && decoded.model),
  normalizeOptionalText: (value: string | null | undefined) => {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}));

import { decodeVin, mapNhtsaVinDecodeResponse } from "./vin-decoder";

describe("vin decoder", () => {
  it("maps successful NHTSA decode fields into the shared result", () => {
    expect(
      mapNhtsaVinDecodeResponse("1HGCM82633A004352", {
        Results: [
          {
            ModelYear: "2018",
            Make: "Honda",
            Model: "Civic",
            Trim: "EX",
            EngineModel: "2.0L I4",
            ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct"
          }
        ]
      })
    ).toEqual({
      vin: "1HGCM82633A004352",
      status: "success",
      decoded: {
        year: 2018,
        make: "Honda",
        model: "Civic",
        trim: "EX",
        engine: "2.0L I4"
      },
      warnings: [],
      source: "nhtsa"
    });
  });

  it("marks partial decode when core fields are incomplete", () => {
    const result = mapNhtsaVinDecodeResponse("1HGCM82633A004352", {
      Results: [
        {
          ModelYear: "2018",
          Make: "Honda",
          Model: "",
          Trim: "Sport"
        }
      ]
    });

    expect(result.status).toBe("partial");
    expect(result.decoded).toMatchObject({
      year: 2018,
      make: "Honda",
      model: null,
      trim: "Sport"
    });
  });

  it("returns provider_error when the external request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(decodeVin("1HGCM82633A004352")).resolves.toMatchObject({
      status: "provider_error",
      decoded: {
        year: null,
        make: null,
        model: null,
        trim: null,
        engine: null
      }
    });
  });
});