"use client";

import {
  getMissingDecodedVehicleFieldLabels,
  isVinReadyForDecode,
  normalizeVinForDecode
} from "@mobile-mechanic/core";
import type { CustomerListItem, Vehicle, VinDecodeResult } from "@mobile-mechanic/types";
import { useState } from "react";

import {
  Button,
  Form,
  FormField,
  FormRow,
  Input,
  Textarea,
  buttonClassName
} from "../../../../components/ui";
import { applyDecodedVehicleFieldsToFormValues } from "../../../../lib/vehicles/form-enrichment";

type CustomerVehicleFormProps = {
  action: (formData: FormData) => Promise<void>;
  customer: Pick<CustomerListItem, "displayName" | "id" | "relationshipType">;
  hiddenFields?: Array<{ name: string; value: string }>;
  initialValues?: Vehicle | null;
  submitLabel: string;
};

type VinFeedbackState = {
  message: string;
  tone: "error" | "success" | "warning";
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
            ? `VIN decoded. Existing manual details were kept. ${result.warnings.join(" ")}`
            : "VIN decoded. Existing manual details were kept."
      };
    case "partial":
      return {
        tone: "warning",
        message: appliedFields.length
          ? `VIN decoded partially. Filled ${appliedFields.join(", ")}. ${result.warnings.join(" ")}`.trim()
          : result.warnings.length
            ? `VIN decoded partially. Existing manual details were kept. ${result.warnings.join(" ")}`
            : `VIN decoded partially. Missing ${getMissingDecodedVehicleFieldLabels(result.decoded).join(", ")}.`
      };
    case "not_found":
      return {
        tone: "warning",
        message: "VIN format is valid, but this vehicle could not be confirmed automatically."
      };
    case "provider_error":
      return {
        tone: "warning",
        message: "VIN lookup is unavailable right now. Continue with manual entry."
      };
    default:
      return {
        tone: "error",
        message: "VIN must be 17 characters and exclude I, O, and Q."
      };
  }
}

export function CustomerVehicleForm({
  action,
  customer,
  hiddenFields = [],
  initialValues,
  submitLabel
}: CustomerVehicleFormProps) {
  const ownershipType =
    customer.relationshipType === "fleet_account" ? "fleet_account_asset" : "customer_owned";
  const [vin, setVin] = useState(initialValues?.vin ?? "");
  const [year, setYear] = useState(toInputValue(initialValues?.year));
  const [make, setMake] = useState(initialValues?.make ?? "");
  const [model, setModel] = useState(initialValues?.model ?? "");
  const [trim, setTrim] = useState(initialValues?.trim ?? "");
  const [engine, setEngine] = useState(initialValues?.engine ?? "");
  const [manualUnlocked, setManualUnlocked] = useState(Boolean(initialValues));
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [vinFeedback, setVinFeedback] = useState<VinFeedbackState | null>(null);

  const canSubmit = manualUnlocked || Boolean(initialValues);

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
              : "VIN lookup is unavailable right now. Continue with manual entry."
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
      setManualUnlocked(true);
      setVinFeedback(getDecodeFeedback(result, mergeResult.appliedFields));
    } catch {
      setVinFeedback({
        tone: "warning",
        message: "VIN lookup is unavailable right now. Continue with manual entry."
      });
    } finally {
      setIsDecodingVin(false);
    }
  }

  return (
    <Form action={action} className="customer-vehicle-form">
      <input name="customerId" type="hidden" value={customer.id} />
      <input name="ownershipType" type="hidden" value={initialValues?.ownershipType ?? ownershipType} />
      {hiddenFields.map((field) => (
        <input key={field.name} name={field.name} type="hidden" value={field.value} />
      ))}

      <div className="customer-vehicle-form__owner">
        <div>
          <p className="customer-vehicle-form__owner-label">Relationship context</p>
          <p className="customer-vehicle-form__owner-value">{customer.displayName}</p>
        </div>
        <div>
          <p className="customer-vehicle-form__owner-label">Asset model</p>
          <p className="customer-vehicle-form__owner-value">
            {ownershipType === "fleet_account_asset" ? "Fleet-managed asset" : "Customer-owned vehicle"}
          </p>
        </div>
      </div>

      <div className="customer-vehicle-form__stage">
        <div className="customer-vehicle-form__stage-header">
          <div>
            <p className="customer-vehicle-form__stage-step">Step 1</p>
            <h3 className="customer-vehicle-form__stage-title">Start with the VIN</h3>
          </div>
          {!manualUnlocked ? (
            <button
              className={buttonClassName({ tone: "ghost", size: "sm" })}
              onClick={() => setManualUnlocked(true)}
              type="button"
            >
              Skip to manual
            </button>
          ) : null}
        </div>

        <FormField
          hint="Use a 17-character VIN to fill year, make, model, trim, and engine automatically."
          htmlFor="customer-vehicle-vin"
          label="VIN"
        >
          <div className="customer-vehicle-form__vin-row">
            <Input
              autoCapitalize="characters"
              id="customer-vehicle-vin"
              maxLength={17}
              minLength={17}
              name="vin"
              onChange={(event) => setVin(event.target.value.toUpperCase())}
              pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
              title="VIN must be 17 characters and exclude I, O, and Q."
              type="text"
              value={vin}
            />
            <Button
              disabled={isDecodingVin}
              onClick={() => void decodeVin()}
              tone="secondary"
              type="button"
            >
              {isDecodingVin ? "Decoding..." : "Decode VIN"}
            </Button>
          </div>
          {vinFeedback ? (
            <p
              className={`customer-vehicle-form__feedback customer-vehicle-form__feedback--${vinFeedback.tone}`}
            >
              {vinFeedback.message}
            </p>
          ) : null}
        </FormField>
      </div>

      {manualUnlocked ? (
        <>
          <div className="customer-vehicle-form__stage">
            <div className="customer-vehicle-form__stage-header">
              <div>
                <p className="customer-vehicle-form__stage-step">Step 2</p>
                <h3 className="customer-vehicle-form__stage-title">Confirm the essentials</h3>
              </div>
            </div>

            <FormRow>
              <FormField htmlFor="customer-vehicle-year" label="Year">
                <Input
                  id="customer-vehicle-year"
                  name="year"
                  onChange={(event) => setYear(event.target.value)}
                  type="number"
                  value={year}
                />
              </FormField>

              <FormField htmlFor="customer-vehicle-make" label="Make" required>
                <Input
                  id="customer-vehicle-make"
                  name="make"
                  onChange={(event) => setMake(event.target.value)}
                  required
                  type="text"
                  value={make}
                />
              </FormField>

              <FormField htmlFor="customer-vehicle-model" label="Model" required>
                <Input
                  id="customer-vehicle-model"
                  name="model"
                  onChange={(event) => setModel(event.target.value)}
                  required
                  type="text"
                  value={model}
                />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField htmlFor="customer-vehicle-trim" label="Trim">
                <Input
                  id="customer-vehicle-trim"
                  name="trim"
                  onChange={(event) => setTrim(event.target.value)}
                  type="text"
                  value={trim}
                />
              </FormField>

              <FormField htmlFor="customer-vehicle-engine" label="Engine">
                <Input
                  id="customer-vehicle-engine"
                  name="engine"
                  onChange={(event) => setEngine(event.target.value)}
                  type="text"
                  value={engine}
                />
              </FormField>

              <FormField htmlFor="customer-vehicle-odometer" label="Odometer">
                <Input
                  defaultValue={initialValues?.odometer ?? ""}
                  id="customer-vehicle-odometer"
                  min={0}
                  name="odometer"
                  type="number"
                />
              </FormField>
            </FormRow>
          </div>

          <details className="customer-vehicle-form__advanced" open={Boolean(initialValues)}>
            <summary className="customer-vehicle-form__advanced-toggle">
              Registration, service notes, and secondary details
            </summary>

            <div className="customer-vehicle-form__advanced-fields">
              <FormRow>
                <FormField htmlFor="customer-vehicle-plate" label="License plate">
                  <Input
                    defaultValue={initialValues?.licensePlate ?? ""}
                    id="customer-vehicle-plate"
                    name="licensePlate"
                    type="text"
                  />
                </FormField>

                <FormField htmlFor="customer-vehicle-state" label="License state">
                  <Input
                    defaultValue={initialValues?.licenseState ?? ""}
                    id="customer-vehicle-state"
                    maxLength={2}
                    name="licenseState"
                    placeholder="TX"
                    type="text"
                  />
                </FormField>

                <FormField htmlFor="customer-vehicle-color" label="Color">
                  <Input
                    defaultValue={initialValues?.color ?? ""}
                    id="customer-vehicle-color"
                    name="color"
                    type="text"
                  />
                </FormField>
              </FormRow>

              <FormField htmlFor="customer-vehicle-notes" label="Notes">
                <Textarea
                  defaultValue={initialValues?.notes ?? ""}
                  id="customer-vehicle-notes"
                  name="notes"
                  placeholder="Known issues, service context, or customer-reported details."
                  rows={3}
                />
              </FormField>

              <label className="customer-editor-form__toggle">
                <input
                  defaultChecked={initialValues?.isActive ?? true}
                  name="isActive"
                  type="checkbox"
                />
                <span>Vehicle is active for new service work</span>
              </label>
            </div>
          </details>
        </>
      ) : null}

      {canSubmit ? (
        <div className="ui-button-grid">
          <button className={buttonClassName()} type="submit">
            {submitLabel}
          </button>
        </div>
      ) : null}
    </Form>
  );
}
