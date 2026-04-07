import type { TimestampFields, UUID } from "./common";

export const serviceAssetOwnershipTypes = ["customer_owned", "fleet_account_asset"] as const;

export type ServiceAssetOwnershipType = (typeof serviceAssetOwnershipTypes)[number];

export interface Vehicle extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  ownershipType: ServiceAssetOwnershipType;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  vin: string | null;
  color: string | null;
  odometer: number | null;
  notes: string | null;
  isActive: boolean;
}

export interface VehicleListItem {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  ownershipType: ServiceAssetOwnershipType;
  displayName: string;
  vin: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  isActive: boolean;
}

export interface CustomerVehicleSummary {
  id: UUID;
  customerId: UUID;
  ownershipType: ServiceAssetOwnershipType;
  displayName: string;
  vin: string | null;
  licensePlate: string | null;
  isActive: boolean;
}

export interface CustomerWithVehicles {
  customerId: UUID;
  vehicles: Vehicle[];
}

export interface CreateVehicleInput {
  companyId: UUID;
  customerId: UUID;
  ownershipType?: ServiceAssetOwnershipType;
  year?: number | null;
  make: string;
  model: string;
  trim?: string | null;
  engine?: string | null;
  licensePlate?: string | null;
  licenseState?: string | null;
  vin?: string | null;
  color?: string | null;
  odometer?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface UpdateVehicleInput {
  customerId: UUID;
  ownershipType?: ServiceAssetOwnershipType;
  year?: number | null;
  make: string;
  model: string;
  trim?: string | null;
  engine?: string | null;
  licensePlate?: string | null;
  licenseState?: string | null;
  vin?: string | null;
  color?: string | null;
  odometer?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface VehicleListQuery {
  query?: string;
  includeInactive?: boolean;
}
