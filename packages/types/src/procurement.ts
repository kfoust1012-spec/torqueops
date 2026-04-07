import type { TimestampFields, UUID } from "./common";

export const supplierAccountModes = ["manual", "link_out"] as const;
export type SupplierAccountMode = (typeof supplierAccountModes)[number];

export const partRequestOrigins = ["job_detail", "estimate_editor"] as const;
export type PartRequestOrigin = (typeof partRequestOrigins)[number];

export const partRequestStatuses = ["open", "fulfilled", "canceled"] as const;
export type PartRequestStatus = (typeof partRequestStatuses)[number];

export const partLifecycleStatuses = [
  "quoted",
  "ordered",
  "received",
  "installed",
  "returned",
  "core_due",
  "core_returned"
] as const;
export type PartLifecycleStatus = (typeof partLifecycleStatuses)[number];

export const supplierCartStatuses = ["open", "submitted", "converted", "abandoned"] as const;
export type SupplierCartStatus = (typeof supplierCartStatuses)[number];

export const purchaseOrderStatuses = [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "canceled",
  "closed"
] as const;
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number];

export const partReturnStatuses = ["draft", "submitted", "completed", "canceled"] as const;
export type PartReturnStatus = (typeof partReturnStatuses)[number];

export interface SupplierAccount extends TimestampFields {
  id: UUID;
  companyId: UUID;
  name: string;
  slug: string;
  mode: SupplierAccountMode;
  externalUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SupplierRoutingRule extends TimestampFields {
  id: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  name: string;
  priority: number;
  isActive: boolean;
  matchJobPriority: string | null;
  matchVehicleMake: string | null;
  matchHasCore: boolean | null;
  matchPartTerm: string | null;
}

export interface PartRequest extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  origin: PartRequestOrigin;
  status: PartRequestStatus;
  requestedByUserId: UUID;
  assignedBuyerUserId: UUID | null;
  notes: string | null;
}

export interface PartRequestLine extends TimestampFields {
  id: UUID;
  partRequestId: UUID;
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  estimateLineItemId: UUID | null;
  inventoryItemId: UUID | null;
  quantityReservedFromStock: number;
  quantityConsumedFromStock: number;
  quantityIssuedFromInventory: number;
  quantityReturnedToInventory: number;
  status: PartLifecycleStatus;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  supplierSku: string | null;
  quantityRequested: number;
  quantityOrdered: number;
  quantityReceived: number;
  quantityInstalled: number;
  quantityReturned: number;
  quantityCoreDue: number;
  quantityCoreReturned: number;
  quotedUnitCostCents: number | null;
  estimatedUnitCostCents: number | null;
  actualUnitCostCents: number | null;
  needsCore: boolean;
  coreChargeCents: number;
  lastSupplierAccountId: UUID | null;
  notes: string | null;
  createdByUserId: UUID;
}

export interface SupplierCart extends TimestampFields {
  id: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  status: SupplierCartStatus;
  sourceBucketKey: string;
  createdByUserId: UUID;
  submittedByUserId: UUID | null;
  submittedAt: string | null;
  convertedPurchaseOrderId: UUID | null;
}

export interface SupplierCartLine extends TimestampFields {
  id: UUID;
  cartId: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  partRequestLineId: UUID;
  providerQuoteLineId: UUID | null;
  jobId: UUID;
  quotedUnitCostCents: number | null;
  quotedCoreChargeCents: number;
  quantity: number;
  supplierPartNumber: string | null;
  supplierUrl: string | null;
  availabilityText: string | null;
  notes: string | null;
}

export interface PurchaseOrder extends TimestampFields {
  id: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  supplierCartId: UUID | null;
  status: PurchaseOrderStatus;
  poNumber: string;
  orderedByUserId: UUID;
  orderedAt: string | null;
  expectedAt: string | null;
  externalReference: string | null;
  manualOrderUrl: string | null;
  notes: string | null;
}

export interface PurchaseOrderLine extends TimestampFields {
  id: UUID;
  purchaseOrderId: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  partRequestLineId: UUID;
  jobId: UUID;
  supplierCartLineId: UUID | null;
  inventoryItemId: UUID | null;
  stockLocationId: UUID | null;
  status: PartLifecycleStatus;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  supplierPartNumber: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  quantityInstalled: number;
  quantityReturned: number;
  quantityCoreDue: number;
  quantityCoreReturned: number;
  unitOrderedCostCents: number;
  unitActualCostCents: number | null;
  coreChargeCents: number;
  isCoreReturnable: boolean;
}

export interface PurchaseReceipt extends TimestampFields {
  id: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  purchaseOrderId: UUID;
  receiptNumber: string | null;
  receivedByUserId: UUID;
  receivedAt: string;
  notes: string | null;
}

export interface PurchaseReceiptLine extends TimestampFields {
  id: UUID;
  receiptId: UUID;
  companyId: UUID;
  purchaseOrderLineId: UUID;
  quantityReceived: number;
  receivedIntoInventoryQuantity: number;
  unitReceivedCostCents: number | null;
  notes: string | null;
}

export interface PartReturn extends TimestampFields {
  id: UUID;
  companyId: UUID;
  supplierAccountId: UUID;
  purchaseOrderId: UUID | null;
  status: PartReturnStatus;
  returnNumber: string | null;
  reason: string | null;
  returnedByUserId: UUID;
  returnedAt: string | null;
  notes: string | null;
}

export interface PartReturnLine extends TimestampFields {
  id: UUID;
  partReturnId: UUID;
  companyId: UUID;
  purchaseOrderLineId: UUID;
  quantityReturned: number;
  isCoreReturn: boolean;
  creditAmountCents: number | null;
  notes: string | null;
}

export interface JobPartsSummary {
  requestCount: number;
  lineCount: number;
  quotedCostCents: number;
  estimatedCostCents: number;
  actualCostCents: number;
  totalSellCents: number;
  grossProfitCents: number;
  openLineCount: number;
  coreOutstandingCount: number;
}

export interface EstimatePartsSummary {
  estimateId: UUID;
  linkedLineCount: number;
  estimatedCostCents: number;
  actualCostCents: number;
  totalSellCents: number;
  grossProfitCents: number;
}

export interface InvoicePartsSummary {
  invoiceId: UUID;
  linkedLineCount: number;
  estimatedCostCents: number;
  actualCostCents: number;
  totalSellCents: number;
  grossProfitCents: number;
}

export interface ProcurementWorkspaceSummary {
  openRequests: number;
  openCarts: number;
  openPurchaseOrders: number;
  manualAttentionCount: number;
  coreOutstandingLines: number;
}

export interface PartRequestDetail {
  request: PartRequest;
  lines: PartRequestLine[];
  linkedCarts: SupplierCart[];
  linkedPurchaseOrders: PurchaseOrder[];
}

export interface SupplierCartDetail {
  cart: SupplierCart;
  supplierAccount: SupplierAccount;
  lines: Array<{
    cartLine: SupplierCartLine;
    requestLine: PartRequestLine;
  }>;
}

export interface PurchaseOrderDetail {
  purchaseOrder: PurchaseOrder;
  supplierAccount: SupplierAccount;
  lines: PurchaseOrderLine[];
  receipts: Array<{
    receipt: PurchaseReceipt;
    lines: PurchaseReceiptLine[];
  }>;
  returns: Array<{
    partReturn: PartReturn;
    lines: PartReturnLine[];
  }>;
}

export interface ProcurementWorkspaceQuery {
  status?: PartLifecycleStatus | PurchaseOrderStatus | PartRequestStatus | undefined;
  supplierAccountId?: UUID | undefined;
  jobId?: UUID | undefined;
  query?: string | undefined;
}

export interface CreateSupplierAccountInput {
  companyId: UUID;
  name: string;
  slug: string;
  mode: SupplierAccountMode;
  externalUrl?: string | null | undefined;
  contactName?: string | null | undefined;
  contactEmail?: string | null | undefined;
  contactPhone?: string | null | undefined;
  notes?: string | null | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateSupplierAccountInput {
  name: string;
  slug: string;
  mode: SupplierAccountMode;
  externalUrl?: string | null | undefined;
  contactName?: string | null | undefined;
  contactEmail?: string | null | undefined;
  contactPhone?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}

export interface CreateSupplierRoutingRuleInput {
  companyId: UUID;
  supplierAccountId: UUID;
  name: string;
  priority?: number | undefined;
  matchJobPriority?: string | null | undefined;
  matchVehicleMake?: string | null | undefined;
  matchHasCore?: boolean | null | undefined;
  matchPartTerm?: string | null | undefined;
}

export interface UpdateSupplierRoutingRuleInput {
  supplierAccountId: UUID;
  name: string;
  priority?: number | undefined;
  isActive?: boolean | undefined;
  matchJobPriority?: string | null | undefined;
  matchVehicleMake?: string | null | undefined;
  matchHasCore?: boolean | null | undefined;
  matchPartTerm?: string | null | undefined;
}

export interface CreatePartRequestInput {
  companyId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  origin: PartRequestOrigin;
  requestedByUserId: UUID;
  notes?: string | null | undefined;
}

export interface CreatePartRequestFromEstimateInput {
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID;
  requestedByUserId: UUID;
  notes?: string | null | undefined;
}

export interface AddPartRequestLineInput {
  companyId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  estimateLineItemId?: UUID | null | undefined;
  inventoryItemId?: UUID | null | undefined;
  description: string;
  manufacturer?: string | null | undefined;
  partNumber?: string | null | undefined;
  supplierSku?: string | null | undefined;
  quantityRequested?: number | undefined;
  quotedUnitCostCents?: number | null | undefined;
  estimatedUnitCostCents?: number | null | undefined;
  needsCore?: boolean | undefined;
  coreChargeCents?: number | undefined;
  notes?: string | null | undefined;
  createdByUserId: UUID;
}

export interface UpdatePartRequestLineInput {
  status?: PartLifecycleStatus | undefined;
  description: string;
  inventoryItemId?: UUID | null | undefined;
  manufacturer?: string | null | undefined;
  partNumber?: string | null | undefined;
  supplierSku?: string | null | undefined;
  quantityRequested?: number | undefined;
  quotedUnitCostCents?: number | null | undefined;
  estimatedUnitCostCents?: number | null | undefined;
  actualUnitCostCents?: number | null | undefined;
  needsCore?: boolean | undefined;
  coreChargeCents?: number | undefined;
  lastSupplierAccountId?: UUID | null | undefined;
  notes?: string | null | undefined;
}

export interface RoutePartRequestLinesInput {
  companyId: UUID;
  requestId: UUID;
  requestLineIds?: UUID[] | undefined;
  actorUserId: UUID;
}

export interface AddSupplierCartLineInput {
  companyId: UUID;
  supplierAccountId: UUID;
  partRequestLineId: UUID;
  providerQuoteLineId?: UUID | null | undefined;
  jobId: UUID;
  quantity: number;
  quotedUnitCostCents?: number | null | undefined;
  quotedCoreChargeCents?: number | undefined;
  supplierPartNumber?: string | null | undefined;
  supplierUrl?: string | null | undefined;
  availabilityText?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface UpdateSupplierCartLineInput {
  quantity: number;
  quotedUnitCostCents?: number | null | undefined;
  quotedCoreChargeCents?: number | undefined;
  supplierPartNumber?: string | null | undefined;
  supplierUrl?: string | null | undefined;
  availabilityText?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface ConvertSupplierCartToPurchaseOrderInput {
  companyId: UUID;
  cartId: UUID;
  poNumber: string;
  orderedByUserId: UUID;
  expectedAt?: string | null | undefined;
  externalReference?: string | null | undefined;
  manualOrderUrl?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface MarkPurchaseOrderOrderedInput {
  status?: Extract<PurchaseOrderStatus, "ordered"> | undefined;
  orderedAt?: string | null | undefined;
  expectedAt?: string | null | undefined;
  externalReference?: string | null | undefined;
  manualOrderUrl?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface RecordPurchaseReceiptInput {
  companyId: UUID;
  supplierAccountId: UUID;
  purchaseOrderId: UUID;
  receivedByUserId: UUID;
  receivedAt: string;
  receiptNumber?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    purchaseOrderLineId: UUID;
    quantityReceived: number;
    unitReceivedCostCents?: number | null | undefined;
    notes?: string | null | undefined;
  }>;
}

export interface RecordPartInstallationInput {
  purchaseOrderLineId: UUID;
  quantityInstalled: number;
}

export interface CreatePartReturnInput {
  companyId: UUID;
  supplierAccountId: UUID;
  purchaseOrderId?: UUID | null | undefined;
  returnedByUserId: UUID;
  returnedAt?: string | null | undefined;
  returnNumber?: string | null | undefined;
  reason?: string | null | undefined;
  notes?: string | null | undefined;
  lines: Array<{
    purchaseOrderLineId: UUID;
    quantityReturned: number;
    isCoreReturn?: boolean | undefined;
    creditAmountCents?: number | null | undefined;
    notes?: string | null | undefined;
  }>;
}

export interface MarkCoreDueInput {
  purchaseOrderLineId: UUID;
  quantityCoreDue: number;
}

export interface MarkCoreReturnedInput {
  purchaseOrderLineId: UUID;
  quantityCoreReturned: number;
}
