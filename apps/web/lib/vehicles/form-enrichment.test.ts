import { describe, expect, it } from "vitest";

import { applyDecodedVehicleFieldsToFormValues } from "./form-enrichment";

describe("vehicle form enrichment", () => {
  it("fills only blank form fields from decoded VIN data", () => {
    expect(
      applyDecodedVehicleFieldsToFormValues(
        {
          year: "",
          make: "",
          model: "Accord",
          trim: "",
          engine: "2.4L I4"
        },
        {
          year: 2020,
          make: "Honda",
          model: "Civic",
          trim: "EX",
          engine: "2.0L I4"
        }
      )
    ).toEqual({
      values: {
        year: "2020",
        make: "Honda",
        model: "Accord",
        trim: "EX",
        engine: "2.4L I4"
      },
      appliedFields: ["year", "make", "trim"]
    });
  });

  it("does not claim applied fields when the form already has manual values", () => {
    expect(
      applyDecodedVehicleFieldsToFormValues(
        {
          year: "2021",
          make: "Honda",
          model: "Civic",
          trim: "Sport",
          engine: "2.0L I4"
        },
        {
          year: 2020,
          make: "Honda",
          model: "Civic",
          trim: "EX",
          engine: "1.5L Turbo"
        }
      )
    ).toEqual({
      values: {
        year: "2021",
        make: "Honda",
        model: "Civic",
        trim: "Sport",
        engine: "2.0L I4"
      },
      appliedFields: []
    });
  });

  it("updates untouched edit-form values when they still match the original vehicle data", () => {
    expect(
      applyDecodedVehicleFieldsToFormValues(
        {
          year: "2021",
          make: "Honda",
          model: "Civic",
          trim: "Sport",
          engine: "2.0L I4"
        },
        {
          year: 2020,
          make: "Honda",
          model: "Civic",
          trim: "EX",
          engine: "1.5L Turbo"
        },
        {
          year: "2021",
          make: "Honda",
          model: "Civic",
          trim: "Sport",
          engine: "2.0L I4"
        }
      )
    ).toEqual({
      values: {
        year: "2020",
        make: "Honda",
        model: "Civic",
        trim: "EX",
        engine: "1.5L Turbo"
      },
      appliedFields: ["year", "make", "model", "trim", "engine"]
    });
  });
});