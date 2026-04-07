import type { Customer } from "./customer";
import type { TimestampFields, UUID } from "./common";
import type { Job } from "./job";
import type {
  PartRequest,
  PartRequestLine,
  SupplierAccount,
  SupplierCart,
  SupplierCartLine
} from "./procurement";
import type {
  ProcurementProvider,
  ProcurementProviderAccount,
  ProcurementProviderQuote,
  ProcurementProviderQuoteLine
} from "./procurement-provider";
import type { Signature } from "./signature";
import type { Vehicle } from "./vehicle";

export const estimateStatuses = ["draft", "sent", "accepted", "declined", "void"] as const;

export type EstimateStatus = (typeof estimateStatuses)[number];

export const estimateLineItemTypes = ["labor", "part", "fee"] as const;

export type EstimateLineItemType = (typeof estimateLineItemTypes)[number];

export const estimateSectionSources = [
  "manual",
  "labor_suggestion",
  "service_package"
] as const;

export type EstimateSectionSource = (typeof estimateSectionSources)[number];

export const estimateLiveRetailerSearchProviders = ["oreilly"] as const;

export type EstimateLiveRetailerSearchProvider =
  (typeof estimateLiveRetailerSearchProviders)[number];

export const estimateSupplierConnectorIds = ["fitment", "oreilly", "manual"] as const;
export type EstimateSupplierConnectorId = (typeof estimateSupplierConnectorIds)[number];

export const estimateSupplierConnectorFlows = [
  "seeded_fitment",
  "integrated_lookup",
  "browser_handoff",
  "manual_capture"
] as const;
export type EstimateSupplierConnectorFlow = (typeof estimateSupplierConnectorFlows)[number];

export interface EstimateSupplierConnector {
  id: EstimateSupplierConnectorId;
  label: string;
  shortLabel: string;
  primaryFlow: EstimateSupplierConnectorFlow;
  provider: EstimateLiveRetailerSearchProvider | null;
  supportsDirectSearch: boolean;
  supportsBrowserHandoff: boolean;
  supportsManualCapture: boolean;
  browserLabel: string | null;
  browserHost: string | null;
}

export interface Estimate extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  status: EstimateStatus;
  estimateNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  currencyCode: "USD";
  taxRateBasisPoints: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  voidedAt: string | null;
  approvedSignatureId: UUID | null;
  approvedByName: string | null;
  approvalStatement: string | null;
  createdByUserId: UUID;
}

export interface EstimateLineItem extends TimestampFields {
  id: UUID;
  estimateId: UUID;
  companyId: UUID;
  jobId: UUID;
  estimateSectionId: UUID | null;
  partRequestLineId: UUID | null;
  position: number;
  itemType: EstimateLineItemType;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  estimatedCostCents: number | null;
  actualCostCents: number | null;
  taxable: boolean;
}

export interface EstimateTotals {
  subtotalCents: number;
  discountCents: number;
  taxableSubtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface EstimateSection extends TimestampFields {
  id: UUID;
  estimateId: UUID;
  companyId: UUID;
  jobId: UUID;
  position: number;
  title: string;
  description: string | null;
  notes: string | null;
  source: EstimateSectionSource;
  sourceRef: string | null;
  createdByUserId: UUID;
}

export interface EstimateDetail {
  estimate: Estimate;
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  lineItems: EstimateLineItem[];
  totals: EstimateTotals;
  signature: Signature | null;
}

export interface EstimateSummary {
  estimateId: UUID;
  jobId: UUID;
  status: EstimateStatus;
  estimateNumber: string;
  title: string;
  customerName: string | null;
  vehicleLabel: string | null;
  totalCents: number;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  voidedAt: string | null;
  updatedAt: string;
}

export interface EstimateVehicleContextSnapshot {
  vehicleId: UUID;
  displayName: string;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  vin: string | null;
  licensePlate: string | null;
  odometer: number | null;
}

export interface EstimatePartOfferSummary {
  provider: ProcurementProvider;
  providerAccount: ProcurementProviderAccount | null;
  quote: ProcurementProviderQuote;
  quoteLine: ProcurementProviderQuoteLine;
  supplierLabel: string;
  supplierMappingId: UUID | null;
  isSelected: boolean;
}

export interface EstimateManualPartOfferSummary {
  supplierAccount: SupplierAccount;
  cart: SupplierCart;
  cartLine: SupplierCartLine;
  supplierLabel: string;
  isSelected: boolean;
}

export interface EstimateCatalogPartOfferSummary {
  id: string;
  supplierLabel: string;
  supplierAccountId: UUID | null;
  supplierUrl: string | null;
  manufacturer: string | null;
  partNumber: string;
  description: string;
  quotedUnitCostCents: number;
  availabilityText: string | null;
  fitmentNotes: string | null;
}

export interface EstimateLiveRetailerPartOffer {
  id: string;
  provider: EstimateLiveRetailerSearchProvider;
  supplierLabel: string;
  supplierUrl: string | null;
  manufacturer: string | null;
  partNumber: string;
  description: string;
  quotedUnitCostCents: number;
  quotedCoreChargeCents: number;
  availabilityText: string | null;
  fitmentNotes: string | null;
  searchQuery: string;
}

export interface EstimateWorkspaceLineItem extends EstimateLineItem {
  linkedPartRequestLine: PartRequestLine | null;
  partOffers: EstimatePartOfferSummary[];
  manualPartOffers: EstimateManualPartOfferSummary[];
  catalogPartOffers: EstimateCatalogPartOfferSummary[];
}

export interface EstimateSectionDetail {
  section: EstimateSection;
  lineItems: EstimateWorkspaceLineItem[];
}

export interface EstimateServicePackageLine extends TimestampFields {
  id: UUID;
  servicePackageId: UUID;
  companyId: UUID;
  position: number;
  itemType: EstimateLineItemType;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  taxable: boolean;
  manufacturer: string | null;
  partNumber: string | null;
  supplierSku: string | null;
}

export interface EstimateServicePackage extends TimestampFields {
  id: UUID;
  companyId: UUID;
  name: string;
  description: string | null;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  createdByUserId: UUID;
  lines: EstimateServicePackageLine[];
}

export interface EstimateWorkspaceSummary {
  sectionCount: number;
  lineItemCount: number;
  laborLineCount: number;
  partLineCount: number;
  feeLineCount: number;
  totalLaborHours: number;
}

export interface EstimateWorkspacePricingDefaults {
  laborRateCents: number;
  laborRateSource: "estimate_history" | "fallback";
  partSellMultiplierBasisPoints: number;
  partSellMultiplierSource: "estimate_history" | "fallback";
}

export interface EstimateWorkspace {
  estimate: Estimate;
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  vehicleContext: EstimateVehicleContextSnapshot;
  totals: EstimateTotals;
  summary: EstimateWorkspaceSummary;
  pricingDefaults: EstimateWorkspacePricingDefaults;
  sections: EstimateSectionDetail[];
  ungroupedLineItems: EstimateWorkspaceLineItem[];
  partRequest: PartRequest | null;
  servicePackages: EstimateServicePackage[];
  providerAccounts: ProcurementProviderAccount[];
  supplierAccounts: SupplierAccount[];
  signature: Signature | null;
}

export interface EstimateWorkspaceMutationResult {
  workspace: EstimateWorkspace;
  changedEntityId?: UUID | null | undefined;
  message?: string | null | undefined;
}

export interface CreateEstimateInput {
  companyId: UUID;
  jobId: UUID;
  estimateNumber: string;
  title: string;
  notes?: string | null | undefined;
  terms?: string | null | undefined;
  taxRateBasisPoints?: number | undefined;
  discountCents?: number | undefined;
  createdByUserId: UUID;
}

export interface UpdateEstimateInput {
  estimateNumber: string;
  title: string;
  notes?: string | null | undefined;
  terms?: string | null | undefined;
  taxRateBasisPoints?: number | undefined;
  discountCents?: number | undefined;
}

export interface CreateEstimateLineItemInput {
  estimateSectionId?: UUID | null | undefined;
  itemType: EstimateLineItemType;
  name: string;
  description?: string | null | undefined;
  quantity: number;
  unitPriceCents: number;
  taxable?: boolean | undefined;
}

export interface UpdateEstimateLineItemInput {
  estimateSectionId?: UUID | null | undefined;
  itemType: EstimateLineItemType;
  name: string;
  description?: string | null | undefined;
  quantity: number;
  unitPriceCents: number;
  taxable?: boolean | undefined;
}

export interface ChangeEstimateStatusInput {
  status: EstimateStatus;
}

export interface EstimateListQuery {
  status?: EstimateStatus | undefined;
  query?: string | undefined;
}

export interface CreateEstimateSectionInput {
  estimateId: UUID;
  companyId: UUID;
  jobId: UUID;
  title: string;
  description?: string | null | undefined;
  notes?: string | null | undefined;
  source?: EstimateSectionSource | undefined;
  sourceRef?: string | null | undefined;
  createdByUserId: UUID;
}

export interface UpdateEstimateSectionInput {
  title: string;
  description?: string | null | undefined;
  notes?: string | null | undefined;
  position?: number | undefined;
}

export interface MoveEstimateLineItemInput {
  estimateSectionId?: UUID | null | undefined;
  position: number;
}

export interface CreateEstimateServicePackageInput {
  companyId: UUID;
  name: string;
  description?: string | null | undefined;
  notes?: string | null | undefined;
  sortOrder?: number | undefined;
  createdByUserId: UUID;
  lines: Array<{
    itemType: EstimateLineItemType;
    name: string;
    description?: string | null | undefined;
    quantity: number;
    unitPriceCents: number;
    taxable?: boolean | undefined;
    manufacturer?: string | null | undefined;
    partNumber?: string | null | undefined;
    supplierSku?: string | null | undefined;
  }>;
}

export interface UpdateEstimateServicePackageInput {
  name: string;
  description?: string | null | undefined;
  notes?: string | null | undefined;
  sortOrder?: number | undefined;
  isActive?: boolean | undefined;
  lines: Array<{
    itemType: EstimateLineItemType;
    name: string;
    description?: string | null | undefined;
    quantity: number;
    unitPriceCents: number;
    taxable?: boolean | undefined;
    manufacturer?: string | null | undefined;
    partNumber?: string | null | undefined;
    supplierSku?: string | null | undefined;
  }>;
}

export interface ApplyEstimateServicePackageInput {
  servicePackageId: UUID;
  targetSectionTitle?: string | null | undefined;
}

export interface SaveEstimateSectionAsPackageInput {
  name: string;
  description?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface SearchEstimatePartOffersInput {
  lineItemId: UUID;
  provider: ProcurementProvider;
  searchTerms?: string[] | undefined;
  selectedDealerMappingIds?: UUID[] | undefined;
}

export interface SearchEstimateLiveRetailerOffersInput {
  lineItemId: UUID;
  query?: string | null | undefined;
  provider?: EstimateLiveRetailerSearchProvider | undefined;
  limit?: number | undefined;
}

export interface SearchEstimateLiveRetailerOffersResult {
  connector: EstimateSupplierConnector;
  provider: EstimateLiveRetailerSearchProvider;
  providerLabel: string;
  query: string;
  offers: EstimateLiveRetailerPartOffer[];
}

export interface SelectEstimatePartOfferInput {
  lineItemId: UUID;
  providerQuoteLineId: UUID;
}

export interface CreateEstimateManualPartOfferInput {
  lineItemId: UUID;
  supplierAccountId: UUID;
  supplierPartNumber?: string | null | undefined;
  quotedUnitCostCents: number;
  quotedCoreChargeCents?: number | undefined;
  availabilityText?: string | null | undefined;
  supplierUrl?: string | null | undefined;
  notes?: string | null | undefined;
  selectAfterCreate?: boolean | undefined;
}

export interface SelectEstimateManualPartOfferInput {
  lineItemId: UUID;
  supplierCartLineId: UUID;
}

export interface SelectEstimateCatalogPartOfferInput {
  lineItemId: UUID;
  offerId: string;
}

export interface SelectEstimateLiveRetailerOfferInput {
  lineItemId: UUID;
  offer: EstimateLiveRetailerPartOffer;
}
