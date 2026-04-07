"use client";

import { useMemo, useState } from "react";

import type { CustomerVehicleSummary, VehicleCarfaxSummary } from "@mobile-mechanic/types";

import { hasReadyCarfaxSummary } from "../../../../lib/carfax/presentation";
import { CarfaxSummaryCompactCard } from "../../_components/carfax-summary-card";

type VehiclePickerWithCarfaxProps = {
  vehicles: Array<
    CustomerVehicleSummary & {
      carfaxSummary: VehicleCarfaxSummary | null;
    }
  >;
  defaultVehicleId: string;
};

export function VehiclePickerWithCarfax({
  vehicles,
  defaultVehicleId
}: VehiclePickerWithCarfaxProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId);
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles]
  );
  const selectedSummary = selectedVehicle?.carfaxSummary ?? null;
  const readySummary = hasReadyCarfaxSummary(selectedSummary) ? selectedSummary : null;

  return (
    <>
      <label className="label">
        Vehicle
        <select
          className="input"
          defaultValue={defaultVehicleId}
          name="vehicleId"
          onChange={(event) => setSelectedVehicleId(event.target.value)}
          required
        >
          {vehicles.map((vehicle) => {
            return (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.displayName}
              </option>
            );
          })}
        </select>
      </label>

      {selectedVehicle && readySummary ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <CarfaxSummaryCompactCard
            eyebrow="Vehicle history"
            summary={readySummary}
            title="Carfax context"
          />
        </div>
      ) : null}
    </>
  );
}
