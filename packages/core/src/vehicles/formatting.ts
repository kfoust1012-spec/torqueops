import type { Vehicle } from "@mobile-mechanic/types";

export function getVehicleDisplayName(vehicle: Pick<Vehicle, "year" | "make" | "model">): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}
