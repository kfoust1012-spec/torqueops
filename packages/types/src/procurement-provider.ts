import type { Json, TimestampFields, UUID } from "./common";

export const procurementProviders = ["partstech", "repairlink", "amazon_business"] as const;
export type ProcurementProvider = (typeof procurementProviders)[number];

export const procurementProviderAccountStatuses = [
  "connected",
  "action_required",
  "error",
  "disconnected"
] as const;
export type ProcurementProviderAccountStatus =
  (typeof procurementProviderAccountStatuses)[number];

export const procurementProviderSupplierMappingStatuses = [
  "active",
  "pending_approval",
  "unmapped",
  "disabled"
] as const;
export type ProcurementProviderSupplierMappingStatus =
  (typeof procurementProviderSupplierMappingStatuses)[number];

export const procurementProviderQuoteStatuses = [
  "draft",
  "priced",
  "selected",
  "converted",
  "manual_required",
  "expired",
  "failed"
] as const;
export type ProcurementProviderQuoteStatus =
  (typeof procurementProviderQuoteStatuses)[number];

export const procurementProviderOrderStatuses = [
  "draft",
  "submitted",
  "accepted",
  "manual_required",
  "failed",
  "canceled"
] as const;
export type ProcurementProviderOrderStatus =
  (typeof procurementProviderOrderStatuses)[number];

export interface ProcurementProviderCapabilities {
  supportsAutomatedSearch: boolean;
  supportsAutomatedOrder: boolean;
  supportsManualQuoteCapture: boolean;
  supportsManualOrderFallback: boolean;
}

export interface PartsTechAccountSettings {
  username: string;
  apiKeyHint: string | null;
}

export interface RepairLinkAccountSettings {
  username: string;
  passwordHint: string | null;
  preferredDealerMappingIds: UUID[];
  defaultFallbackMode: "manual_capture" | "manual_link_out";
}

export const amazonBusinessRegions = [
  "US",
  "CA",
  "MX",
  "UK",
  "DE",
  "FR",
  "IT",
  "ES",
  "IN",
  "JP",
  "AU"
] as const;
export type AmazonBusinessRegion = (typeof amazonBusinessRegions)[number];

export interface AmazonBusinessAccountSettings {
  accountEmail: string;
  defaultSupplierAccountId: UUID | null;
  region: AmazonBusinessRegion;
  buyingGroupId: string | null;
  buyerEmailMode: "authorized_user" | "override";
  buyerEmailOverride: string | null;
  defaultShippingAddressText: string | null;
  defaultFallbackMode: "manual_capture" | "manual_link_out";
}

export interface RepairLinkDealerMappingMetadata {
  dealerCode?: string | null | undefined;
  dealerName?: string | null | undefined;
  supportedBrands?: string[] | undefined;
  notes?: string | null | undefined;
}

export interface ProcurementProviderAccount extends TimestampFields {
  id: UUID;
  companyId: UUID;
  provider: ProcurementProvider;
  status: ProcurementProviderAccountStatus;
  displayName: string;
  username: string | null;
  credentialHint: string | null;
  settingsJson: Json;
  capabilitiesJson: Json;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
}

export interface ProcurementProviderSupplierMapping extends TimestampFields {
  id: UUID;
  companyId: UUID;
  providerAccountId: UUID;
  supplierAccountId: UUID;
  providerSupplierKey: string;
  providerSupplierName: string;
  providerLocationKey: string | null;
  status: ProcurementProviderSupplierMappingStatus;
  supportsQuote: boolean;
  supportsOrder: boolean;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  metadataJson: Json;
}

export interface PartsTechVehicleContext {
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  vin: string | null;
  licensePlate: string | null;
}

export interface RepairLinkVehicleContext extends PartsTechVehicleContext {
  vin: string;
}

export interface PartsTechSearchContext {
  requestId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  searchTerms: string[];
  selectedPartRequestLineIds: UUID[];
  vehicle: PartsTechVehicleContext;
}

export interface RepairLinkSearchContext {
  requestId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  searchTerms: string[];
  selectedPartRequestLineIds: UUID[];
  selectedDealerMappingIds: UUID[];
  vehicle: RepairLinkVehicleContext;
  fallbackMode: "manual_capture" | "manual_link_out";
}

export interface AmazonBusinessSearchContext {
  requestId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  searchTerms: string[];
  selectedPartRequestLineIds: UUID[];
  supplyListId: UUID | null;
  fallbackMode: "manual_capture" | "manual_link_out";
}

export interface RepairLinkHandoffMetadata {
  provider: "repairlink";
  loginUrl: string;
  manualReason: string;
  selectedDealerMappingIds: UUID[];
  searchTerms: string[];
  vehicle: RepairLinkVehicleContext;
}

export interface AmazonBusinessHandoffMetadata {
  provider: "amazon_business";
  linkOutUrl: string;
  manualReason: string;
  searchTerms: string[];
  supplyListId: UUID | null;
}

export interface ProcurementProviderQuote extends TimestampFields {
  id: UUID;
  companyId: UUID;
  providerAccountId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  partRequestId: UUID;
  status: ProcurementProviderQuoteStatus;
  vehicleContextJson: Json;
  searchContextJson: Json;
  requestedByUserId: UUID;
  requestedAt: string;
  expiresAt: string | null;
  metadataJson: Json;
}

export interface ProcurementProviderQuoteLine extends TimestampFields {
  id: UUID;
  companyId: UUID;
  providerQuoteId: UUID;
  partRequestLineId: UUID;
  providerSupplierMappingId: UUID | null;
  providerOfferKey: string;
  providerProductKey: string | null;
  providerLocationKey: string | null;
  providerSupplierKey: string;
  providerSupplierName: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unitPriceCents: number | null;
  coreChargeCents: number | null;
  availabilityText: string | null;
  etaText: string | null;
  selectedForCart: boolean;
  rawResponseJson: Json;
}

export interface ProcurementProviderOrder extends TimestampFields {
  id: UUID;
  companyId: UUID;
  providerAccountId: UUID;
  purchaseOrderId: UUID;
  providerQuoteId: UUID | null;
  status: ProcurementProviderOrderStatus;
  providerOrderReference: string | null;
  submittedAt: string | null;
  responseReceivedAt: string | null;
  manualFallbackReason: string | null;
  rawRequestJson: Json;
  rawResponseJson: Json;
  lastErrorMessage: string | null;
}

export interface ProcurementProviderOrderLine extends TimestampFields {
  id: UUID;
  companyId: UUID;
  providerOrderId: UUID;
  purchaseOrderLineId: UUID;
  providerQuoteLineId: UUID | null;
  providerLineReference: string | null;
  quantity: number;
  unitPriceCents: number | null;
  rawResponseJson: Json;
}

export interface ProcurementProviderQuoteResult {
  status: ProcurementProviderQuoteStatus;
  message: string | null;
  capabilities: ProcurementProviderCapabilities;
  quote: ProcurementProviderQuote;
  lines: ProcurementProviderQuoteLine[];
}

export interface ProcurementProviderOrderResult {
  status: ProcurementProviderOrderStatus;
  message: string | null;
  order: ProcurementProviderOrder;
  lines: ProcurementProviderOrderLine[];
}

export type UpsertProcurementProviderAccountInput =
  | {
      companyId: UUID;
      provider: "partstech";
      displayName: string;
      username: string;
      apiKey: string;
    }
  | {
      companyId: UUID;
      provider: "repairlink";
      displayName: string;
      username: string;
      password: string;
      preferredDealerMappingIds?: UUID[] | undefined;
      defaultFallbackMode?: "manual_capture" | "manual_link_out" | undefined;
    }
  | {
      companyId: UUID;
      provider: "amazon_business";
      displayName: string;
      accountEmail: string;
      defaultSupplierAccountId?: UUID | null | undefined;
      region: AmazonBusinessRegion;
      buyingGroupId?: string | null | undefined;
      buyerEmailMode?: "authorized_user" | "override" | undefined;
      buyerEmailOverride?: string | null | undefined;
      defaultShippingAddressText?: string | null | undefined;
      defaultFallbackMode?: "manual_capture" | "manual_link_out" | undefined;
    };

export interface VerifyProcurementProviderAccountInput {
  companyId: UUID;
  provider: ProcurementProvider;
}

export interface DisconnectProcurementProviderAccountInput {
  companyId: UUID;
  provider: ProcurementProvider;
}

export interface UpsertProcurementProviderSupplierMappingInput {
  companyId: UUID;
  providerAccountId: UUID;
  supplierAccountId: UUID;
  providerSupplierKey: string;
  providerSupplierName: string;
  providerLocationKey?: string | null | undefined;
  status: ProcurementProviderSupplierMappingStatus;
  supportsQuote?: boolean | undefined;
  supportsOrder?: boolean | undefined;
  metadataJson?: Json | undefined;
}

export interface SearchPartsTechOffersInput {
  companyId: UUID;
  providerAccountId: UUID;
  requestId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  requestedByUserId: UUID;
  selectedPartRequestLineIds?: UUID[] | undefined;
  searchTerms: string[];
  vehicle: PartsTechVehicleContext;
}

export interface SearchRepairLinkOffersInput {
  companyId: UUID;
  providerAccountId: UUID;
  requestId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  requestedByUserId: UUID;
  selectedPartRequestLineIds?: UUID[] | undefined;
  selectedDealerMappingIds: UUID[];
  vehicle: RepairLinkVehicleContext;
}

export interface SearchAmazonBusinessOffersInput {
  companyId: UUID;
  providerAccountId: UUID;
  requestId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  requestedByUserId: UUID;
  selectedPartRequestLineIds: UUID[];
  searchTerms: string[];
  supplyListId?: UUID | null | undefined;
}

export interface CreateProcurementProviderQuoteInput {
  companyId: UUID;
  providerAccountId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  partRequestId: UUID;
  requestedByUserId: UUID;
  vehicleContextJson?: Json | undefined;
  searchContextJson?: Json | undefined;
  status?: ProcurementProviderQuoteStatus | undefined;
  expiresAt?: string | null | undefined;
  metadataJson?: Json | undefined;
}

export interface CreateProcurementProviderQuoteLineInput {
  companyId: UUID;
  providerQuoteId: UUID;
  partRequestLineId: UUID;
  providerSupplierMappingId?: UUID | null | undefined;
  providerOfferKey: string;
  providerProductKey?: string | null | undefined;
  providerLocationKey?: string | null | undefined;
  providerSupplierKey: string;
  providerSupplierName: string;
  description: string;
  manufacturer?: string | null | undefined;
  partNumber?: string | null | undefined;
  quantity: number;
  unitPriceCents?: number | null | undefined;
  coreChargeCents?: number | null | undefined;
  availabilityText?: string | null | undefined;
  etaText?: string | null | undefined;
  selectedForCart?: boolean | undefined;
  rawResponseJson?: Json | undefined;
}

export interface SelectProviderQuoteLineForCartInput {
  companyId: UUID;
  providerQuoteLineId: UUID;
  actorUserId: UUID;
}

export interface CreateManualRepairLinkQuoteLineInput {
  companyId: UUID;
  requestId: UUID;
  partRequestLineId: UUID;
  requestedByUserId: UUID;
  providerSupplierMappingId: UUID;
  description: string;
  partNumber?: string | null | undefined;
  quantity: number;
  unitPriceCents?: number | null | undefined;
  coreChargeCents?: number | null | undefined;
  availabilityText?: string | null | undefined;
  etaText?: string | null | undefined;
}

export interface CreateManualAmazonBusinessQuoteLineInput {
  companyId: UUID;
  requestId: UUID;
  partRequestLineId: UUID;
  requestedByUserId: UUID;
  description: string;
  partNumber?: string | null | undefined;
  providerProductKey?: string | null | undefined;
  quantity: number;
  unitPriceCents?: number | null | undefined;
  availabilityText?: string | null | undefined;
  etaText?: string | null | undefined;
}

export interface SubmitProviderPurchaseOrderInput {
  companyId: UUID;
  providerAccountId: UUID;
  purchaseOrderId: UUID;
  providerQuoteId?: UUID | null | undefined;
  actorUserId: UUID;
  manualReference?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface SubmitAmazonBusinessPurchaseOrderInput extends SubmitProviderPurchaseOrderInput {
  provider: "amazon_business";
}
