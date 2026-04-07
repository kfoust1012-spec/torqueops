import type { TimestampFields, UUID } from "./common";
import type { ProcurementProvider } from "./procurement-provider";

export interface ProcurementSupplyList extends TimestampFields {
  id: UUID;
  companyId: UUID;
  name: string;
  description: string | null;
  isActive: boolean;
  createdByUserId: UUID;
}

export interface ProcurementSupplyListLine extends TimestampFields {
  id: UUID;
  supplyListId: UUID;
  companyId: UUID;
  inventoryItemId: UUID | null;
  description: string;
  defaultQuantity: number;
  searchQuery: string | null;
  provider: ProcurementProvider;
  providerProductKey: string | null;
  providerOfferKey: string | null;
  expectedUnitCostCents: number | null;
  notes: string | null;
}

export interface ProcurementSupplyListDetail {
  lines: ProcurementSupplyListLine[];
  list: ProcurementSupplyList;
}

export interface CreateProcurementSupplyListInput {
  companyId: UUID;
  name: string;
  description?: string | null | undefined;
  createdByUserId: UUID;
}

export interface UpdateProcurementSupplyListInput {
  name?: string | undefined;
  description?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpsertProcurementSupplyListLineInput {
  lineId?: UUID | undefined;
  supplyListId: UUID;
  companyId: UUID;
  inventoryItemId?: UUID | null | undefined;
  description: string;
  defaultQuantity: number;
  searchQuery?: string | null | undefined;
  provider: ProcurementProvider;
  providerProductKey?: string | null | undefined;
  providerOfferKey?: string | null | undefined;
  expectedUnitCostCents?: number | null | undefined;
  notes?: string | null | undefined;
}

export interface ApplyProcurementSupplyListToRequestInput {
  companyId: UUID;
  requestId: UUID;
  supplyListId: UUID;
  actorUserId: UUID;
}
