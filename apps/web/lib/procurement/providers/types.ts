import type {
  Json,
  ProcurementProvider,
  ProcurementProviderAccount,
  ProcurementProviderCapabilities,
  ProcurementProviderOrderStatus,
  ProcurementProviderQuoteStatus
} from "@mobile-mechanic/types";

export type ProcurementProviderVerificationResult = {
  capabilities: ProcurementProviderCapabilities;
  lastErrorMessage?: string | null | undefined;
  message: string;
  status: ProcurementProviderAccount["status"];
};

export type ProcurementProviderSearchOfferCandidate = {
  availabilityText?: string | null | undefined;
  coreChargeCents?: number | null | undefined;
  description: string;
  etaText?: string | null | undefined;
  manufacturer?: string | null | undefined;
  providerLocationKey?: string | null | undefined;
  partRequestLineId?: string | null | undefined;
  partNumber?: string | null | undefined;
  providerOfferKey: string;
  providerProductKey?: string | null | undefined;
  providerSupplierKey: string;
  providerSupplierName: string;
  quantity: number;
  rawResponseJson?: Json | undefined;
  unitPriceCents?: number | null | undefined;
};

export type ProcurementProviderSearchResult = {
  capabilities: ProcurementProviderCapabilities;
  lines: ProcurementProviderSearchOfferCandidate[];
  message: string;
  metadata?: Json | undefined;
  status: ProcurementProviderQuoteStatus;
};

export type ProcurementProviderOrderLineCandidate = {
  providerLineReference?: string | null | undefined;
  providerQuoteLineId?: string | null | undefined;
  purchaseOrderLineId: string;
  quantity: number;
  rawResponseJson?: Json | undefined;
  unitPriceCents?: number | null | undefined;
};

export type ProcurementProviderOrderSubmissionResult = {
  lastErrorMessage?: string | null | undefined;
  lineResults: ProcurementProviderOrderLineCandidate[];
  manualFallbackReason?: string | null | undefined;
  message: string;
  providerOrderReference?: string | null | undefined;
  rawRequestJson?: Json | undefined;
  rawResponseJson?: Json | undefined;
  status: ProcurementProviderOrderStatus;
};

export type ProcurementProviderAdapterAccount = Pick<
  ProcurementProviderAccount,
  "capabilitiesJson" | "displayName" | "id" | "provider" | "settingsJson" | "status" | "username"
> & {
  credentials: {
    username: string;
    apiKey?: string | null | undefined;
    password?: string | null | undefined;
  } | null;
};

export type ProcurementProviderSearchContextInput = {
  account: ProcurementProviderAdapterAccount;
  estimateId: string | null;
  jobId: string;
  lines: Array<{
    description: string;
    id: string;
    partNumber: string | null;
    quantityRequested: number;
  }>;
  requestId: string;
  searchTerms?: string[] | undefined;
  selectedSupplierMappingIds?: string[] | undefined;
  selectedPartRequestLineIds?: string[] | undefined;
  supplyListId?: string | null | undefined;
  vehicle: {
    engine: string | null;
    licensePlate: string | null;
    make: string | null;
    model: string | null;
    vin: string | null;
    year: number | null;
  };
};

export type ProcurementProviderOrderContextInput = {
  account: ProcurementProviderAdapterAccount;
  purchaseOrder: {
    id: string;
    poNumber: string;
    supplierAccountId: string;
  };
  purchaseOrderLines: Array<{
    description: string;
    id: string;
    partNumber: string | null;
    providerQuoteLineId: string | null;
    quantityOrdered: number;
    supplierPartNumber: string | null;
    unitOrderedCostCents: number;
  }>;
};

export interface ProcurementProviderAdapter {
  provider: ProcurementProvider;
  getCapabilities(): ProcurementProviderCapabilities;
  searchOffers(
    input: ProcurementProviderSearchContextInput
  ): Promise<ProcurementProviderSearchResult>;
  submitOrder(
    input: ProcurementProviderOrderContextInput
  ): Promise<ProcurementProviderOrderSubmissionResult>;
  verifyConnection(
    account: ProcurementProviderAdapterAccount
  ): Promise<ProcurementProviderVerificationResult>;
}
