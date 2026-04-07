import type { TimestampFields, UUID } from "./common";

export interface ServiceUnit extends TimestampFields {
  id: UUID;
  companyId: UUID;
  stockLocationId: UUID;
  assignedTechnicianUserId: UUID | null;
  unitCode: string;
  displayName: string;
  year: number | null;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  vin: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface ServiceUnitListItem {
  id: UUID;
  companyId: UUID;
  stockLocationId: UUID;
  assignedTechnicianUserId: UUID | null;
  unitCode: string;
  displayName: string;
  licensePlate: string | null;
  licenseState: string | null;
  vin: string | null;
  isActive: boolean;
}

export interface CreateServiceUnitInput {
  companyId: UUID;
  stockLocationId: UUID;
  assignedTechnicianUserId?: UUID | null | undefined;
  unitCode: string;
  displayName: string;
  year?: number | null | undefined;
  make?: string | null | undefined;
  model?: string | null | undefined;
  licensePlate?: string | null | undefined;
  licenseState?: string | null | undefined;
  vin?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpdateServiceUnitInput {
  stockLocationId?: UUID | undefined;
  assignedTechnicianUserId?: UUID | null | undefined;
  unitCode: string;
  displayName: string;
  year?: number | null | undefined;
  make?: string | null | undefined;
  model?: string | null | undefined;
  licensePlate?: string | null | undefined;
  licenseState?: string | null | undefined;
  vin?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface ServiceUnitListQuery {
  assignedTechnicianUserId?: UUID | undefined;
  includeInactive?: boolean | undefined;
  query?: string | undefined;
}
