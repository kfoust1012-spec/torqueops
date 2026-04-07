"use client";

import {
  getMissingDecodedVehicleFieldLabels,
  isVinReadyForDecode,
  normalizeVinForDecode
} from "@mobile-mechanic/core";
import type { CustomerListItem, Vehicle, VinDecodeResult } from "@mobile-mechanic/types";
import { useState } from "react";

import { applyDecodedVehicleFieldsToFormValues } from "../../../../lib/vehicles/form-enrichment";

type VehicleFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  customers: CustomerListItem[];
  initialValues?: Vehicle | null;
  submitLabel: string;
};

type VinFeedbackState = {
  tone: "success" | "warning" | "error";
  message: string;
};

function toInputValue(value: number | string | null | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function getDecodeFeedback(result: VinDecodeResult, appliedFields: string[]): VinFeedbackState {
  switch (result.status) {
    case "success":
      return {
        tone: "success",
        message: appliedFields.length
          ? `VIN decoded. Filled ${appliedFields.join(", ")}. ${result.warnings.join(" ")}`.trim()
          : result.warnings.length
            ? `VIN decoded. Existing manual vehicle details were kept. ${result.warnings.join(" ")}`
            : "VIN decoded. Existing manual vehicle details were kept."
      };
    case "partial":
      return {
        tone: "warning",
        message: appliedFields.length
          ? `VIN decoded partially. Filled ${appliedFields.join(", ")}. ${result.warnings.join(" ")}`.trim()
          : result.warnings.length
            ? `VIN decoded partially. Existing manual vehicle details were kept. ${result.warnings.join(" ")}`
            : `VIN decoded partially. Missing ${getMissingDecodedVehicleFieldLabels(result.decoded).join(", ")}.`
      };
    case "not_found":
      return {
        tone: "warning",
        message: "VIN format is valid, but vehicle details could not be confirmed automatically."
      };
    case "provider_error":
      return {
        tone: "warning",
        message: "Vehicle details could not be fetched right now. Manual entry is still available."
      };
    default:
      return {
        tone: "error",
        message: "VIN must be 17 characters and exclude I, O, and Q."
      };
  }
}

export function VehicleForm({
  action,
  cancelHref,
  customers,
  initialValues,
  submitLabel
}: VehicleFormProps) {
  const [vin, setVin] = useState(initialValues?.vin ?? "");
  const [year, setYear] = useState(toInputValue(initialValues?.year));
  const [make, setMake] = useState(initialValues?.make ?? "");
  const [model, setModel] = useState(initialValues?.model ?? "");
  const [trim, setTrim] = useState(initialValues?.trim ?? "");
  const [engine, setEngine] = useState(initialValues?.engine ?? "");
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [vinFeedback, setVinFeedback] = useState<VinFeedbackState | null>(null);

  async function decodeVin() {
    const normalizedVin = normalizeVinForDecode(vin);
    setVin(normalizedVin ?? "");

    if (!normalizedVin || !isVinReadyForDecode(normalizedVin)) {
      setVinFeedback({
        tone: "error",
        message: "VIN must be 17 characters and exclude I, O, and Q."
      });
      return;
    }

    setIsDecodingVin(true);
    setVinFeedback(null);

    try {
      const response = await fetch("/api/vehicles/decode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ vin: normalizedVin }),
        cache: "no-store"
      });
      const payload = (await response.json()) as VinDecodeResult | { message?: string };

      if (!response.ok) {
        setVinFeedback({
          tone: "error",
          message:
            "message" in payload && payload.message
              ? payload.message
              : "Vehicle details could not be fetched right now. Manual entry is still available."
        });
        return;
      }

      const result = payload as VinDecodeResult;

      const mergeResult = applyDecodedVehicleFieldsToFormValues(
        {
          year,
          make,
          model,
          trim,
          engine
        },
        result.decoded,
        {
          year: toInputValue(initialValues?.year),
          make: initialValues?.make ?? "",
          model: initialValues?.model ?? "",
          trim: initialValues?.trim ?? "",
          engine: initialValues?.engine ?? ""
        }
      );

      setYear(mergeResult.values.year);
      setMake(mergeResult.values.make);
      setModel(mergeResult.values.model);
      setTrim(mergeResult.values.trim);
      setEngine(mergeResult.values.engine);

      setVinFeedback(getDecodeFeedback(result, mergeResult.appliedFields));
    } catch {
      setVinFeedback({
        tone: "warning",
        message: "Vehicle details could not be fetched right now. Manual entry is still available."
      });
    } finally {
      setIsDecodingVin(false);
    }
  }

  return (
    <form action={action} className="panel stack">
      <div className="form-grid">
        <label className="label">
          Customer
          <select
            className="input"
            defaultValue={initialValues?.customerId ?? customers[0]?.id ?? ""}
            name="customerId"
            required
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          VIN
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <input
                autoCapitalize="characters"
                className="input"
                maxLength={17}
                minLength={17}
                name="vin"
                onChange={(event) => setVin(event.target.value.toUpperCase())}
                pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
                title="VIN must be 17 characters and exclude I, O, and Q."
                type="text"
                value={vin}
              />
              <button className="button secondary-button" disabled={isDecodingVin} onClick={() => void decodeVin()} type="button">
                {isDecodingVin ? "Decoding..." : "Decode VIN"}
              </button>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              Enter a full 17-character VIN to auto-fill year, make, model, trim, and engine.
            </p>

            {vinFeedback ? (
              <p
                aria-live="polite"
                className="muted"
                style={{
                  margin: 0,
                  color:
                    vinFeedback.tone === "error"
                      ? "#b91c1c"
                      : vinFeedback.tone === "success"
                        ? "#166534"
                        : undefined
                }}
              >
                {vinFeedback.message}
              </p>
            ) : null}
          </div>
        </label>

        <label className="label">
          Year
          <input
            className="input"
            name="year"
            onChange={(event) => setYear(event.target.value)}
            type="number"
            value={year}
          />
        </label>

        <label className="label">
          Make
          <input
            className="input"
            name="make"
            onChange={(event) => setMake(event.target.value)}
            required
            type="text"
            value={make}
          />
        </label>

        <label className="label">
          Model
          <input
            className="input"
            name="model"
            onChange={(event) => setModel(event.target.value)}
            required
            type="text"
            value={model}
          />
        </label>

        <label className="label">
          Engine
          <input
            className="input"
            name="engine"
            onChange={(event) => setEngine(event.target.value)}
            type="text"
            value={engine}
          />
        </label>

        <label className="label">
          Trim
          <input className="input" name="trim" onChange={(event) => setTrim(event.target.value)} type="text" value={trim} />
        </label>

        <label className="label">
          License plate
          <input
            className="input"
            defaultValue={initialValues?.licensePlate ?? ""}
            name="licensePlate"
            type="text"
          />
        </label>

        <label className="label">
          License state
          <input
            className="input"
            defaultValue={initialValues?.licenseState ?? ""}
            maxLength={2}
            name="licenseState"
            type="text"
          />
        </label>

        <label className="label">
          Color
          <input
            className="input"
            defaultValue={initialValues?.color ?? ""}
            name="color"
            type="text"
          />
        </label>

        <label className="label">
          Odometer
          <input
            className="input"
            defaultValue={initialValues?.odometer ?? ""}
            min={0}
            name="odometer"
            type="number"
          />
        </label>
      </div>

      <label className="label">
        Notes
        <textarea
          className="textarea"
          defaultValue={initialValues?.notes ?? ""}
          name="notes"
          rows={4}
        />
      </label>

      <label className="checkbox-row">
        <input defaultChecked={initialValues?.isActive ?? true} name="isActive" type="checkbox" />
        Active vehicle
      </label>

      <div className="action-row">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <a className="button secondary-button button-link" href={cancelHref}>
          Cancel
        </a>
      </div>
    </form>
  );
}
