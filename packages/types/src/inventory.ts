import type { TimestampFields, UUID } from "./common";

export const inventoryItemTypes = ["stocked", "non_stocked"] as const;
export type InventoryItemType = (typeof inventoryItemTypes)[number];

export const inventoryAliasTypes = [
  "manufacturer_part_number",
  "supplier_sku",
  "alternate_sku"
] as const;
export type InventoryAliasType = (typeof inventoryAliasTypes)[number];

export const stockLocationTypes = ["warehouse", "shop", "van"] as const;
export type StockLocationType = (typeof stockLocationTypes)[number];

export const inventoryTransactionTypes = [
  "adjustment_in",
  "adjustment_out",
  "purchase_receipt",
  "purchase_return",
  "reservation_in",
  "reservation_out",
  "consumption",
  "release",
  "transfer_in",
  "transfer_out",
  "job_issue",
  "job_return",
  "cycle_count_gain",
  "cycle_count_loss",
  "core_hold_in",
  "core_hold_out",
  "core_return_out"
] as const;
export type InventoryTransactionType = (typeof inventoryTransactionTypes)[number];

export const inventoryOperationalTransactionTypes = [
  "adjustment_in",
  "adjustment_out",
  "purchase_receipt",
  "purchase_return",
  "consumption",
  "transfer_in",
  "transfer_out",
  "job_issue",
  "job_return",
  "cycle_count_gain",
  "cycle_count_loss",
  "core_hold_in",
  "core_hold_out",
  "core_return_out"
] as const;
export type InventoryOperationalTransactionType =
  (typeof inventoryOperationalTransactionTypes)[number];

export const inventoryTransactionSourceTypes = [
  "manual",
  "purchase_receipt",
  "purchase_return",
  "part_request",
  "job",
  "inventory_count",
  "transfer",
  "job_issue",
  "job_return",
  "cycle_count",
  "core_event"
] as const;
export type InventoryTransactionSourceType = (typeof inventoryTransactionSourceTypes)[number];

export const inventoryReorderStatuses = ["ok", "low_stock", "reorder_due"] as const;
export type InventoryReorderStatus = (typeof inventoryReorderStatuses)[number];

export interface InventoryItem extends TimestampFields {
  id: UUID;
  companyId: UUID;
  sku: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  supplierAccountId: UUID | null;
  defaultUnitCostCents: number | null;
  itemType: InventoryItemType;
  isActive: boolean;
  notes: string | null;
}

export interface InventoryItemAlias extends TimestampFields {
  id: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  aliasType: InventoryAliasType;
  value: string;
}

export interface StockLocation extends TimestampFields {
  id: UUID;
  companyId: UUID;
  name: string;
  slug: string;
  locationType: StockLocationType;
  technicianUserId: UUID | null;
  vehicleLabel: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface InventoryStockSetting extends TimestampFields {
  id: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  reorderPointQuantity: number;
  lowStockThresholdQuantity: number;
  preferredReorderQuantity: number | null;
  isStockedHere: boolean;
}

export interface InventoryTransaction extends TimestampFields {
  id: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  transactionType: InventoryTransactionType;
  sourceType: InventoryTransactionSourceType;
  sourceId: UUID | null;
  jobId: UUID | null;
  partRequestLineId: UUID | null;
  purchaseOrderLineId: UUID | null;
  purchaseReceiptLineId: UUID | null;
  partReturnLineId: UUID | null;
  quantityDelta: number;
  unitCostCents: number | null;
  referenceNumber: string | null;
  notes: string | null;
  createdByUserId: UUID;
  effectiveAt: string;
}

export interface InventoryReservation extends TimestampFields {
  id: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  jobId: UUID;
  partRequestLineId: UUID | null;
  quantityReserved: number;
  quantityReleased: number;
  quantityConsumed: number;
  notes: string | null;
  createdByUserId: UUID;
}

export interface InventoryBalance {
  inventoryItemId: UUID;
  stockLocationId: UUID;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPointQuantity: number | null;
  lowStockThresholdQuantity: number | null;
  preferredReorderQuantity: number | null;
  reorderStatus: InventoryReorderStatus;
}

export interface InventoryItemWithBalances {
  item: InventoryItem;
  aliases: InventoryItemAlias[];
  balances: InventoryBalance[];
  totalOnHandQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
}

export interface InventoryLookupResult {
  item: InventoryItem;
  aliases: InventoryItemAlias[];
  balances: InventoryBalance[];
}

export interface InventoryWorkspaceSummary {
  itemCount: number;
  locationCount: number;
  lowStockCount: number;
  totalOnHandQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
}

export interface InventoryReorderRow {
  item: InventoryItem;
  location: StockLocation;
  balance: InventoryBalance;
}

export interface JobInventorySummary {
  jobId: UUID;
  reservations: Array<{
    reservation: InventoryReservation;
    item: InventoryItem;
    location: StockLocation;
    balance: InventoryBalance | null;
  }>;
  totalReservedQuantity: number;
  openReservationCount: number;
}

export interface InventoryLookupQuery {
  query?: string | undefined;
  stockLocationId?: UUID | undefined;
  itemType?: InventoryItemType | undefined;
  includeInactive?: boolean | undefined;
  lowStockOnly?: boolean | undefined;
}

export interface InventoryTransactionsQuery {
  inventoryItemId?: UUID | undefined;
  stockLocationId?: UUID | undefined;
  jobId?: UUID | undefined;
  sourceType?: InventoryTransactionSourceType | undefined;
  transactionType?: InventoryOperationalTransactionType | undefined;
  limit?: number | undefined;
}

export interface CreateInventoryItemInput {
  companyId: UUID;
  sku: string;
  name: string;
  description?: string | null | undefined;
  manufacturer?: string | null | undefined;
  partNumber?: string | null | undefined;
  supplierAccountId?: UUID | null | undefined;
  defaultUnitCostCents?: number | null | undefined;
  itemType?: InventoryItemType | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpdateInventoryItemInput {
  sku: string;
  name: string;
  description?: string | null | undefined;
  manufacturer?: string | null | undefined;
  partNumber?: string | null | undefined;
  supplierAccountId?: UUID | null | undefined;
  defaultUnitCostCents?: number | null | undefined;
  itemType?: InventoryItemType | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface CreateInventoryItemAliasInput {
  companyId: UUID;
  inventoryItemId: UUID;
  aliasType: InventoryAliasType;
  value: string;
}

export interface CreateStockLocationInput {
  companyId: UUID;
  name: string;
  slug: string;
  locationType?: StockLocationType | undefined;
  technicianUserId?: UUID | null | undefined;
  vehicleLabel?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpdateStockLocationInput {
  name: string;
  slug: string;
  locationType?: StockLocationType | undefined;
  technicianUserId?: UUID | null | undefined;
  vehicleLabel?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UpsertInventoryStockSettingInput {
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  reorderPointQuantity?: number | undefined;
  lowStockThresholdQuantity?: number | undefined;
  preferredReorderQuantity?: number | null | undefined;
  isStockedHere?: boolean | undefined;
}

export interface CreateInventoryAdjustmentInput {
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  transactionType: "adjustment_in" | "adjustment_out";
  quantity: number;
  unitCostCents?: number | null | undefined;
  notes?: string | null | undefined;
  createdByUserId: UUID;
  effectiveAt?: string | null | undefined;
}

export interface CreateInventoryReservationInput {
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  jobId: UUID;
  partRequestLineId?: UUID | null | undefined;
  quantityReserved: number;
  notes?: string | null | undefined;
  createdByUserId: UUID;
}

export interface ReleaseInventoryReservationInput {
  reservationId: UUID;
  quantityReleased: number;
}

export interface ConsumeReservedInventoryInput {
  reservationId: UUID;
  quantityConsumed: number;
  createdByUserId: UUID;
  effectiveAt?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface ReceivePurchasedInventoryInput {
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  purchaseOrderLineId: UUID;
  purchaseReceiptLineId?: UUID | null | undefined;
  quantityReceived: number;
  unitCostCents?: number | null | undefined;
  notes?: string | null | undefined;
  createdByUserId: UUID;
  effectiveAt?: string | null | undefined;
}
