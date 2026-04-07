import type { TimestampFields, UUID } from "./common";
import type { InventoryBalance, InventoryItem, StockLocation } from "./inventory";

export const inventoryTransferStatuses = ["draft", "in_transit", "received", "canceled"] as const;
export type InventoryTransferStatus = (typeof inventoryTransferStatuses)[number];

export const jobInventoryIssueStatuses = [
  "issued",
  "partially_returned",
  "returned",
  "consumed"
] as const;
export type JobInventoryIssueStatus = (typeof jobInventoryIssueStatuses)[number];

export const coreInventoryStatuses = ["held", "returned"] as const;
export type CoreInventoryStatus = (typeof coreInventoryStatuses)[number];

export interface InventoryTransfer extends TimestampFields {
  id: UUID;
  companyId: UUID;
  fromStockLocationId: UUID;
  toStockLocationId: UUID;
  status: InventoryTransferStatus;
  referenceNumber: string | null;
  requestedByUserId: UUID;
  shippedByUserId: UUID | null;
  receivedByUserId: UUID | null;
  requestedAt: string;
  shippedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
}

export interface InventoryTransferLine extends TimestampFields {
  id: UUID;
  transferId: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  unitCostCents: number | null;
  notes: string | null;
}

export interface InventoryTransferDetail {
  transfer: InventoryTransfer;
  fromLocation: StockLocation;
  toLocation: StockLocation;
  lines: Array<{
    line: InventoryTransferLine;
    item: InventoryItem;
    fromBalance: InventoryBalance | null;
    toBalance: InventoryBalance | null;
  }>;
}

export interface JobInventoryIssue extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  partRequestLineId: UUID | null;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  inventoryReservationId: UUID;
  status: JobInventoryIssueStatus;
  quantityIssued: number;
  quantityConsumed: number;
  quantityReturned: number;
  unitCostCents: number;
  issuedByUserId: UUID;
  issuedAt: string;
  notes: string | null;
}

export interface JobInventoryIssueDetail {
  issue: JobInventoryIssue;
  item: InventoryItem;
  location: StockLocation;
}

export interface CoreInventoryEvent extends TimestampFields {
  id: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  purchaseOrderLineId: UUID | null;
  jobInventoryIssueId: UUID | null;
  partRequestLineId: UUID | null;
  quantity: number;
  status: CoreInventoryStatus;
  heldByUserId: UUID;
  heldAt: string;
  returnedAt: string | null;
  notes: string | null;
}

export interface InventoryCycleCount extends TimestampFields {
  id: UUID;
  companyId: UUID;
  stockLocationId: UUID;
  countedByUserId: UUID;
  countedAt: string;
  notes: string | null;
}

export interface InventoryCycleCountLine extends TimestampFields {
  id: UUID;
  cycleCountId: UUID;
  companyId: UUID;
  inventoryItemId: UUID;
  expectedQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  notes: string | null;
}

export interface InventoryCycleCountDetail {
  cycleCount: InventoryCycleCount;
  location: StockLocation;
  lines: Array<{
    line: InventoryCycleCountLine;
    item: InventoryItem;
  }>;
}

export interface InventoryLocationSummary {
  location: StockLocation;
  totalOnHandQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  lowStockCount: number;
}

export interface VanStockSummary {
  location: StockLocation;
  balances: InventoryBalance[];
  lowStockCount: number;
}

export interface TechnicianVanStockSummary {
  technicianUserId: UUID | null;
  vanLocation: StockLocation;
  balances: InventoryBalance[];
}

export interface JobInventoryDemandRow {
  partRequestLineId: UUID;
  description: string;
  inventoryItemId: UUID | null;
  quantityRequested: number;
  quantityReservedFromStock: number;
  quantityConsumedFromStock: number;
  quantityIssuedFromInventory: number;
  quantityReturnedToInventory: number;
  quantityInstalled: number;
  remainingReservableQuantity: number;
}

export interface JobInventoryCoverageSummary {
  jobId: UUID;
  openIssueCount: number;
  totalIssuedQuantity: number;
  totalConsumedQuantity: number;
  totalReturnedQuantity: number;
}

export interface InventoryTransferWorkspaceSummary {
  draftCount: number;
  inTransitCount: number;
  receivedTodayCount: number;
}

export interface LocationLowStockRow {
  location: StockLocation;
  rowCount: number;
}

export interface CreateInventoryTransferInput {
  companyId: UUID;
  fromStockLocationId: UUID;
  toStockLocationId: UUID;
  requestedByUserId: UUID;
  referenceNumber?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    inventoryItemId: UUID;
    quantityRequested: number;
    unitCostCents?: number | null | undefined;
    notes?: string | null | undefined;
  }>;
}

export interface ShipInventoryTransferInput {
  transferId: UUID;
  shippedByUserId: UUID;
  shippedAt?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    transferLineId: UUID;
    quantityShipped: number;
    unitCostCents?: number | null | undefined;
    notes?: string | null | undefined;
  }>;
}

export interface ReceiveInventoryTransferInput {
  transferId: UUID;
  receivedByUserId: UUID;
  receivedAt?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    transferLineId: UUID;
    quantityReceived: number;
    notes?: string | null | undefined;
  }>;
}

export interface CancelInventoryTransferInput {
  transferId: UUID;
  notes?: string | null | undefined;
}

export interface CreateJobInventoryIssueInput {
  companyId: UUID;
  inventoryReservationId: UUID;
  quantityIssued: number;
  issuedByUserId: UUID;
  issuedAt?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface ConsumeIssuedInventoryInput {
  issueId: UUID;
  quantityConsumed: number;
  notes?: string | null | undefined;
}

export interface ReturnIssuedInventoryInput {
  issueId: UUID;
  quantityReturned: number;
  returnedByUserId: UUID;
  effectiveAt?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface CreateInventoryCycleCountInput {
  companyId: UUID;
  stockLocationId: UUID;
  countedByUserId: UUID;
  countedAt?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    inventoryItemId: UUID;
    countedQuantity: number;
    notes?: string | null | undefined;
  }>;
}

export interface RecordCoreInventoryHoldInput {
  companyId: UUID;
  inventoryItemId: UUID;
  stockLocationId: UUID;
  quantity: number;
  heldByUserId: UUID;
  purchaseOrderLineId?: UUID | null | undefined;
  jobInventoryIssueId?: UUID | null | undefined;
  partRequestLineId?: UUID | null | undefined;
  notes?: string | null | undefined;
  effectiveAt?: string | null | undefined;
}

export interface RecordCoreInventoryReturnInput {
  coreEventId: UUID;
  returnedByUserId: UUID;
  notes?: string | null | undefined;
  effectiveAt?: string | null | undefined;
}

export interface LocationInventoryQuery {
  stockLocationId?: UUID | undefined;
  locationType?: "warehouse" | "shop" | "van" | undefined;
  lowStockOnly?: boolean | undefined;
}

export interface TransferWorkspaceQuery {
  status?: InventoryTransferStatus | undefined;
  stockLocationId?: UUID | undefined;
}
