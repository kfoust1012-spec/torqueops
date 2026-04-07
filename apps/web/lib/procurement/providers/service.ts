import { randomUUID } from "crypto";

import type { AppSupabaseClient } from "@mobile-mechanic/api-client";
import {
  addSupplierCartLine,
  createProcurementProviderOrder,
  createProcurementProviderOrderLine,
  createProcurementProviderQuote,
  createProcurementProviderQuoteLine,
  disconnectProcurementProviderAccount,
  findOrCreateOpenSupplierCart,
  getJobById,
  getLatestProcurementProviderQuoteByRequestAndAccount,
  getPartRequestById,
  getProcurementSupplyListById,
  getProcurementProviderAccountByProvider,
  getPurchaseOrderById,
  getVehicleById,
  listProcurementProviderAccountsByCompany,
  listProcurementProviderQuoteLinesByQuoteId,
  listProcurementProviderOrdersByPurchaseOrderId,
  listProcurementProviderSupplierMappingsByAccount,
  listSupplierAccountsByCompany,
  updatePartRequestLine,
  updateProcurementProviderAccountStatus,
  updateProcurementProviderQuoteContext,
  updateProcurementProviderQuoteLine,
  updateProcurementProviderOrderStatus,
  updateProcurementProviderQuoteLineSelection,
  updateProcurementProviderQuoteStatus,
  upsertProcurementProviderAccount,
  upsertProcurementProviderSupplierMapping
} from "@mobile-mechanic/api-client";
import {
  AMAZON_BUSINESS_LINK_URL,
  buildAmazonBusinessDisplayName,
  buildAmazonBusinessHandoffMetadata,
  buildAmazonBusinessSearchContext,
  buildAmazonBusinessSearchTerms,
  buildPartsTechDisplayName,
  buildPartsTechSearchTerms,
  buildRepairLinkDisplayName,
  buildRepairLinkSearchContext,
  buildRepairLinkSearchTerms,
  buildRepairLinkVehicleContext,
  getAmazonBusinessFallbackMode,
  REPAIRLINK_LOGIN_URL
} from "@mobile-mechanic/core";
import type {
  CreateManualAmazonBusinessQuoteLineInput,
  CreateManualRepairLinkQuoteLineInput,
  Database,
  Json,
  ProcurementProvider,
  ProcurementProviderAccount,
  ProcurementProviderOrder,
  ProcurementProviderOrderLine,
  ProcurementProviderQuote,
  ProcurementProviderQuoteLine,
  ProcurementProviderSupplierMapping,
  SearchAmazonBusinessOffersInput,
  RepairLinkHandoffMetadata,
  RepairLinkSearchContext,
  SubmitAmazonBusinessPurchaseOrderInput,
  SubmitProviderPurchaseOrderInput,
  UpsertProcurementProviderAccountInput,
  UpsertProcurementProviderSupplierMappingInput
} from "@mobile-mechanic/types";

import {
  buildCredentialHint,
  decryptProviderCredential,
  encryptProviderCredential
} from "./credentials";
import {
  writeBackPartCostsToEstimate,
  writeBackPartCostsToInvoice
} from "../service";
import { getProcurementProviderAdapter } from "./registry";
import type {
  ProcurementProviderAdapter,
  ProcurementProviderAdapterAccount
} from "./types";

type ProcurementProviderAccountRow =
  Database["public"]["Tables"]["procurement_provider_accounts"]["Row"];
type ProcurementProviderSupplierMappingRow =
  Database["public"]["Tables"]["procurement_provider_supplier_mappings"]["Row"];
type ProcurementProviderQuoteLineRow =
  Database["public"]["Tables"]["procurement_provider_quote_lines"]["Row"];
type SupplierCartLineRow = Database["public"]["Tables"]["supplier_cart_lines"]["Row"];

type PartsTechRequestWorkspace = {
  account: ProcurementProviderAccount | null;
  latestQuote:
    | {
        lines: ProcurementProviderQuoteLine[];
        quote: ProcurementProviderQuote;
      }
    | null;
  supplierMappings: ProcurementProviderSupplierMapping[];
  unmappedQuoteLineCount: number;
};

type RepairLinkRequestWorkspace = PartsTechRequestWorkspace;
type AmazonBusinessRequestWorkspace = PartsTechRequestWorkspace;

type PartsTechPurchaseOrderWorkspace = {
  account: ProcurementProviderAccount | null;
  linkedLineCount: number;
  linkedPurchaseOrderLines: Array<{
    description: string;
    id: string;
    partNumber: string | null;
    providerQuoteLineId: string;
    quantityOrdered: number;
    supplierPartNumber: string | null;
    unitOrderedCostCents: number;
  }>;
  orders: Array<{
    lines: ProcurementProviderOrderLine[];
    order: ProcurementProviderOrder;
  }>;
};

type RepairLinkPurchaseOrderWorkspace = PartsTechPurchaseOrderWorkspace;
type AmazonBusinessPurchaseOrderWorkspace = PartsTechPurchaseOrderWorkspace;

const PARTSTECH_PROVIDER = "partstech" as const;
const REPAIRLINK_PROVIDER = "repairlink" as const;
const AMAZON_BUSINESS_PROVIDER = "amazon_business" as const;

type PartsTechAccountInput = Extract<
  UpsertProcurementProviderAccountInput,
  { provider: "partstech" }
>;

type RepairLinkAccountInput = Extract<
  UpsertProcurementProviderAccountInput,
  { provider: "repairlink" }
>;
type AmazonBusinessAccountInput = Extract<
  UpsertProcurementProviderAccountInput,
  { provider: "amazon_business" }
>;

type RepairLinkFallbackMode = "manual_capture" | "manual_link_out";

function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function buildPartsTechSettingsJson(input: PartsTechAccountInput) {
  return {
    apiKeyHint: input.provider === PARTSTECH_PROVIDER ? buildCredentialHint(input.apiKey) : null,
    username: input.username
  } as Json;
}

function normalizePartsTechAccountInput(input: UpsertProcurementProviderAccountInput): PartsTechAccountInput {
  if (input.provider !== "partstech") {
    throw new Error("Expected a PartsTech account input.");
  }

  const partstechInput = input as PartsTechAccountInput;

  return {
    companyId: partstechInput.companyId,
    provider: "partstech",
    displayName: partstechInput.displayName,
    username: partstechInput.username.trim(),
    apiKey: partstechInput.apiKey.trim()
  };
}

function buildRepairLinkSettingsJson(input: RepairLinkAccountInput) {
  if (input.provider !== REPAIRLINK_PROVIDER) {
    throw new Error("Expected a RepairLink account input.");
  }

  return {
    defaultFallbackMode: input.defaultFallbackMode ?? "manual_capture",
    passwordHint: buildCredentialHint(input.password),
    preferredDealerMappingIds: input.preferredDealerMappingIds ?? [],
    username: input.username
  } as Json;
}

function buildRepairLinkSettingsJsonWithResolvedPasswordHint(
  input: RepairLinkAccountInput,
  passwordHint: string | null
) {
  if (input.provider !== REPAIRLINK_PROVIDER) {
    throw new Error("Expected a RepairLink account input.");
  }

  return {
    defaultFallbackMode: input.defaultFallbackMode ?? "manual_capture",
    passwordHint,
    preferredDealerMappingIds: input.preferredDealerMappingIds ?? [],
    username: input.username
  } as Json;
}

function normalizeRepairLinkAccountInput(input: UpsertProcurementProviderAccountInput): RepairLinkAccountInput {
  if (input.provider !== "repairlink") {
    throw new Error("Expected a RepairLink account input.");
  }

  const repairLinkInput = input as RepairLinkAccountInput;

  return {
    companyId: repairLinkInput.companyId,
    provider: "repairlink",
    displayName: repairLinkInput.displayName,
    username: repairLinkInput.username.trim(),
    password: repairLinkInput.password.trim(),
    preferredDealerMappingIds: repairLinkInput.preferredDealerMappingIds,
    defaultFallbackMode: repairLinkInput.defaultFallbackMode
  };
}

function buildAmazonBusinessSettingsJson(input: AmazonBusinessAccountInput) {
  if (input.provider !== AMAZON_BUSINESS_PROVIDER) {
    throw new Error("Expected an Amazon Business account input.");
  }

  return {
    accountEmail: input.accountEmail,
    buyerEmailMode: input.buyerEmailMode ?? "authorized_user",
    buyerEmailOverride: input.buyerEmailOverride ?? null,
    buyingGroupId: input.buyingGroupId ?? null,
    defaultFallbackMode: input.defaultFallbackMode ?? "manual_capture",
    defaultShippingAddressText: input.defaultShippingAddressText ?? null,
    defaultSupplierAccountId: input.defaultSupplierAccountId ?? null,
    region: input.region
  } as Json;
}

function normalizeAmazonBusinessAccountInput(
  input: UpsertProcurementProviderAccountInput
): AmazonBusinessAccountInput {
  if (input.provider !== AMAZON_BUSINESS_PROVIDER) {
    throw new Error("Expected an Amazon Business account input.");
  }

  const amazonInput = input as AmazonBusinessAccountInput;

  return {
    companyId: amazonInput.companyId,
    provider: "amazon_business",
    displayName: amazonInput.displayName,
    accountEmail: amazonInput.accountEmail.trim(),
    defaultSupplierAccountId: amazonInput.defaultSupplierAccountId ?? null,
    region: amazonInput.region,
    buyingGroupId: amazonInput.buyingGroupId?.trim() || null,
    buyerEmailMode: amazonInput.buyerEmailMode ?? "authorized_user",
    buyerEmailOverride: amazonInput.buyerEmailOverride?.trim() || null,
    defaultShippingAddressText: amazonInput.defaultShippingAddressText?.trim() || null,
    defaultFallbackMode: amazonInput.defaultFallbackMode ?? "manual_capture"
  };
}

function getRepairLinkFallbackMode(value: Json | null | undefined): RepairLinkFallbackMode {
  const jsonObject = toJsonObject(value);

  if (jsonObject.defaultFallbackMode === "manual_link_out") {
    return "manual_link_out";
  }

  if (jsonObject.fallbackMode === "manual_link_out") {
    return "manual_link_out";
  }

  return "manual_capture";
}

function getRepairLinkPreferredDealerMappingIds(value: Json | null | undefined): string[] {
  const jsonObject = toJsonObject(value);
  const preferredDealerMappingIds = jsonObject.preferredDealerMappingIds;

  if (!Array.isArray(preferredDealerMappingIds)) {
    return [];
  }

  return preferredDealerMappingIds.filter(
    (dealerMappingId): dealerMappingId is string => typeof dealerMappingId === "string"
  );
}

function getAmazonBusinessDefaultSupplierAccountId(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.defaultSupplierAccountId === "string"
    ? jsonObject.defaultSupplierAccountId
    : null;
}

function getAmazonBusinessAccountEmail(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.accountEmail === "string" ? jsonObject.accountEmail : null;
}

function getAmazonBusinessBuyerEmailMode(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return jsonObject.buyerEmailMode === "override" ? "override" : "authorized_user";
}

function getAmazonBusinessBuyerEmailOverride(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.buyerEmailOverride === "string"
    ? jsonObject.buyerEmailOverride
    : null;
}

function getAmazonBusinessBuyingGroupId(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.buyingGroupId === "string" ? jsonObject.buyingGroupId : null;
}

function getAmazonBusinessDefaultShippingAddressText(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.defaultShippingAddressText === "string"
    ? jsonObject.defaultShippingAddressText
    : null;
}

function getAmazonBusinessRegion(value: Json | null | undefined) {
  const jsonObject = toJsonObject(value);
  return typeof jsonObject.region === "string" ? jsonObject.region : null;
}

function normalizeAmazonSearchTerm(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildAmazonBusinessSupplyListSearchTerms(
  lines: Array<{
    description: string;
    providerProductKey: string | null;
    searchQuery: string | null;
  }>
) {
  const terms = new Set<string>();

  for (const line of lines) {
    const term =
      normalizeAmazonSearchTerm(line.searchQuery) ||
      normalizeAmazonSearchTerm(line.providerProductKey) ||
      normalizeAmazonSearchTerm(line.description);

    if (term) {
      terms.add(term);
    }
  }

  return [...terms];
}

async function resolveAmazonBusinessSearchTerms(
  client: AppSupabaseClient,
  input: {
    searchTerms: string[];
    selectedRouteableLines: Array<{
      description: string;
      id: string;
      partNumber: string | null;
    }>;
    supplyListId: string | null;
  }
) {
  const explicitSearchTerms = input.searchTerms
    .map((searchTerm) => searchTerm.trim())
    .filter(Boolean);

  if (explicitSearchTerms.length) {
    return [...new Set(explicitSearchTerms)];
  }

  if (!input.supplyListId) {
    return buildAmazonBusinessSearchTerms(input.selectedRouteableLines);
  }

  const supplyListResult = await getProcurementSupplyListById(client, input.supplyListId);

  if (supplyListResult.error || !supplyListResult.data) {
    throw supplyListResult.error ?? new Error("Supply list search context could not be loaded.");
  }

  const selectedDescriptionSet = new Set(
    input.selectedRouteableLines.map((line) => normalizeAmazonSearchTerm(line.description).toLowerCase())
  );
  const matchedSupplyListLines = supplyListResult.data.lines.filter((line) =>
    selectedDescriptionSet.has(normalizeAmazonSearchTerm(line.description).toLowerCase())
  );
  const searchSourceLines = matchedSupplyListLines.length
    ? matchedSupplyListLines
    : supplyListResult.data.lines;
  const supplyListSearchTerms = buildAmazonBusinessSupplyListSearchTerms(searchSourceLines);

  if (supplyListSearchTerms.length) {
    return supplyListSearchTerms;
  }

  return buildAmazonBusinessSearchTerms(input.selectedRouteableLines);
}

function areJsonValuesEquivalent(left: Json | null | undefined, right: Json | null | undefined) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function buildPartsTechAdapterAccount(
  row: ProcurementProviderAccountRow
): ProcurementProviderAdapterAccount {
  const decryptedApiKey = row.credential_ciphertext
    ? decryptProviderCredential(row.credential_ciphertext)
    : null;

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status,
    username: row.username,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    credentials:
      row.username && decryptedApiKey
        ? {
          username: row.username,
          apiKey: decryptedApiKey
        }
        : null
  };
}

function buildRepairLinkAdapterAccount(
  row: ProcurementProviderAccountRow
): ProcurementProviderAdapterAccount {
  const decryptedPassword = row.credential_ciphertext
    ? decryptProviderCredential(row.credential_ciphertext)
    : null;

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status,
    username: row.username,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    credentials:
      row.username && decryptedPassword
        ? {
            username: row.username,
            password: decryptedPassword
          }
        : null
  };
}

function buildAmazonBusinessAdapterAccount(
  row: ProcurementProviderAccountRow
): ProcurementProviderAdapterAccount {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status,
    username: row.username,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    credentials: null
  };
}

async function getProcurementProviderAccountRow(
  client: AppSupabaseClient,
  companyId: string,
  provider: ProcurementProvider
) {
  const result = await client
    .from("procurement_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle<ProcurementProviderAccountRow>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? null;
}

async function requirePartsTechAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  const [rawAccountRow, accountResult] = await Promise.all([
    getProcurementProviderAccountRow(client, companyId, PARTSTECH_PROVIDER),
    getProcurementProviderAccountByProvider(client, companyId, PARTSTECH_PROVIDER)
  ]);

  if (!rawAccountRow || accountResult.error || !accountResult.data) {
    throw new Error("Configure the PartsTech account before using this integration.");
  }

  return {
    account: accountResult.data,
    adapter: getProcurementProviderAdapter(PARTSTECH_PROVIDER),
    rawAccountRow
  };
}

async function requireRepairLinkAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  const [rawAccountRow, accountResult] = await Promise.all([
    getProcurementProviderAccountRow(client, companyId, REPAIRLINK_PROVIDER),
    getProcurementProviderAccountByProvider(client, companyId, REPAIRLINK_PROVIDER)
  ]);

  if (!rawAccountRow || accountResult.error || !accountResult.data) {
    throw new Error("Configure the RepairLink account before using this integration.");
  }

  return {
    account: accountResult.data,
    adapter: getProcurementProviderAdapter(REPAIRLINK_PROVIDER),
    rawAccountRow
  };
}

async function requireAmazonBusinessAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  const [rawAccountRow, accountResult] = await Promise.all([
    getProcurementProviderAccountRow(client, companyId, AMAZON_BUSINESS_PROVIDER),
    getProcurementProviderAccountByProvider(client, companyId, AMAZON_BUSINESS_PROVIDER)
  ]);

  if (!rawAccountRow || accountResult.error || !accountResult.data) {
    throw new Error("Configure the Amazon Business account before using this integration.");
  }

  return {
    account: accountResult.data,
    adapter: getProcurementProviderAdapter(AMAZON_BUSINESS_PROVIDER),
    rawAccountRow
  };
}

async function ensurePartsTechQuote(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    jobId: string;
    estimateId: string | null;
    partRequestId: string;
    requestedByUserId: string;
    searchContextJson: Json;
    vehicleContextJson: Json;
    providerAccountId: string;
  }
) {
  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: input.partRequestId,
    providerAccountId: input.providerAccountId
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (
    latestQuoteResult.data &&
    !["converted", "expired", "failed"].includes(latestQuoteResult.data.quote.status)
  ) {
    return latestQuoteResult.data.quote;
  }

  const createdQuoteResult = await createProcurementProviderQuote(client, {
    companyId: input.companyId,
    providerAccountId: input.providerAccountId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    partRequestId: input.partRequestId,
    requestedByUserId: input.requestedByUserId,
    status: "manual_required",
    vehicleContextJson: input.vehicleContextJson,
    searchContextJson: input.searchContextJson,
    metadataJson: {
      fallbackMode: "manual_capture",
      provider: PARTSTECH_PROVIDER
    } as Json
  });

  if (createdQuoteResult.error || !createdQuoteResult.data) {
    throw createdQuoteResult.error ?? new Error("Provider quote could not be created.");
  }

  return createdQuoteResult.data;
}

async function ensureRepairLinkQuote(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    jobId: string;
    metadataJson?: Json | undefined;
    estimateId: string | null;
    partRequestId: string;
    requestedByUserId: string;
    searchContextJson: Json;
    vehicleContextJson: Json;
    providerAccountId: string;
  }
) {
  const fallbackMode = getRepairLinkFallbackMode(input.metadataJson ?? input.searchContextJson);
  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: input.partRequestId,
    providerAccountId: input.providerAccountId
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (
    latestQuoteResult.data &&
    !["converted", "expired", "failed"].includes(latestQuoteResult.data.quote.status)
  ) {
    const shouldReuseExistingQuote =
      latestQuoteResult.data.lines.length === 0 ||
      (areJsonValuesEquivalent(
        latestQuoteResult.data.quote.vehicleContextJson,
        input.vehicleContextJson
      ) &&
        areJsonValuesEquivalent(
          latestQuoteResult.data.quote.searchContextJson,
          input.searchContextJson
        ));

    if (!shouldReuseExistingQuote) {
      const createdQuoteResult = await createProcurementProviderQuote(client, {
        companyId: input.companyId,
        providerAccountId: input.providerAccountId,
        jobId: input.jobId,
        estimateId: input.estimateId,
        partRequestId: input.partRequestId,
        requestedByUserId: input.requestedByUserId,
        status: "manual_required",
        vehicleContextJson: input.vehicleContextJson,
        searchContextJson: input.searchContextJson,
        metadataJson:
          input.metadataJson ??
          ({
            fallbackMode,
            provider: REPAIRLINK_PROVIDER
          } as Json)
      });

      if (createdQuoteResult.error || !createdQuoteResult.data) {
        throw createdQuoteResult.error ?? new Error("Provider quote could not be created.");
      }

      return createdQuoteResult.data;
    }

    const refreshedQuoteResult = await updateProcurementProviderQuoteContext(
      client,
      latestQuoteResult.data.quote.id,
      {
        metadataJson: input.metadataJson,
        searchContextJson: input.searchContextJson,
        vehicleContextJson: input.vehicleContextJson
      }
    );

    if (refreshedQuoteResult.error || !refreshedQuoteResult.data) {
      throw (
        refreshedQuoteResult.error ?? new Error("RepairLink quote context could not be refreshed.")
      );
    }

    return refreshedQuoteResult.data;
  }

  const createdQuoteResult = await createProcurementProviderQuote(client, {
    companyId: input.companyId,
    providerAccountId: input.providerAccountId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    partRequestId: input.partRequestId,
    requestedByUserId: input.requestedByUserId,
    status: "manual_required",
    vehicleContextJson: input.vehicleContextJson,
    searchContextJson: input.searchContextJson,
    metadataJson:
      input.metadataJson ??
      ({
        fallbackMode,
        provider: REPAIRLINK_PROVIDER
      } as Json)
  });

  if (createdQuoteResult.error || !createdQuoteResult.data) {
    throw createdQuoteResult.error ?? new Error("Provider quote could not be created.");
  }

  return createdQuoteResult.data;
}

async function ensureAmazonBusinessQuote(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    estimateId: string | null;
    jobId: string;
    metadataJson?: Json | undefined;
    partRequestId: string;
    providerAccountId: string;
    requestedByUserId: string;
    searchContextJson: Json;
    vehicleContextJson?: Json | undefined;
  }
) {
  const fallbackMode = getAmazonBusinessFallbackMode(
    toJsonObject(input.metadataJson ?? input.searchContextJson)
  );
  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: input.partRequestId,
    providerAccountId: input.providerAccountId
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (
    latestQuoteResult.data &&
    !["converted", "expired", "failed"].includes(latestQuoteResult.data.quote.status)
  ) {
    const shouldReuseExistingQuote =
      latestQuoteResult.data.lines.length === 0 ||
      areJsonValuesEquivalent(
        latestQuoteResult.data.quote.searchContextJson,
        input.searchContextJson
      );

    if (!shouldReuseExistingQuote) {
      const createdQuoteResult = await createProcurementProviderQuote(client, {
        companyId: input.companyId,
        providerAccountId: input.providerAccountId,
        jobId: input.jobId,
        estimateId: input.estimateId,
        partRequestId: input.partRequestId,
        requestedByUserId: input.requestedByUserId,
        status: "manual_required",
        vehicleContextJson: input.vehicleContextJson,
        searchContextJson: input.searchContextJson,
        metadataJson:
          input.metadataJson ??
          ({
            fallbackMode,
            linkOutUrl: AMAZON_BUSINESS_LINK_URL,
            provider: AMAZON_BUSINESS_PROVIDER
          } as Json)
      });

      if (createdQuoteResult.error || !createdQuoteResult.data) {
        throw createdQuoteResult.error ?? new Error("Provider quote could not be created.");
      }

      return createdQuoteResult.data;
    }

    const refreshedQuoteResult = await updateProcurementProviderQuoteContext(
      client,
      latestQuoteResult.data.quote.id,
      {
        metadataJson: input.metadataJson,
        searchContextJson: input.searchContextJson,
        vehicleContextJson: input.vehicleContextJson
      }
    );

    if (refreshedQuoteResult.error || !refreshedQuoteResult.data) {
      throw (
        refreshedQuoteResult.error ??
        new Error("Amazon Business quote context could not be refreshed.")
      );
    }

    return refreshedQuoteResult.data;
  }

  const createdQuoteResult = await createProcurementProviderQuote(client, {
    companyId: input.companyId,
    providerAccountId: input.providerAccountId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    partRequestId: input.partRequestId,
    requestedByUserId: input.requestedByUserId,
    status: "manual_required",
    vehicleContextJson: input.vehicleContextJson,
    searchContextJson: input.searchContextJson,
    metadataJson:
      input.metadataJson ??
      ({
        fallbackMode,
        linkOutUrl: AMAZON_BUSINESS_LINK_URL,
        provider: AMAZON_BUSINESS_PROVIDER
      } as Json)
  });

  if (createdQuoteResult.error || !createdQuoteResult.data) {
    throw createdQuoteResult.error ?? new Error("Provider quote could not be created.");
  }

  return createdQuoteResult.data;
}

async function upsertPartsTechStatusFromVerification(
  client: AppSupabaseClient,
  rawAccountRow: ProcurementProviderAccountRow,
  adapter: ProcurementProviderAdapter
) {
  const verification = await adapter.verifyConnection(
    buildPartsTechAdapterAccount(rawAccountRow)
  );

  const updatedAccountResult = await updateProcurementProviderAccountStatus(
    client,
    rawAccountRow.id,
    {
      capabilitiesJson: verification.capabilities,
      lastErrorMessage: verification.lastErrorMessage ?? null,
      lastVerifiedAt: new Date().toISOString(),
      status: verification.status
    }
  );

  if (updatedAccountResult.error || !updatedAccountResult.data) {
    throw updatedAccountResult.error ?? new Error("Provider account status could not be updated.");
  }

  return {
    account: updatedAccountResult.data,
    verification
  };
}

async function upsertRepairLinkStatusFromVerification(
  client: AppSupabaseClient,
  rawAccountRow: ProcurementProviderAccountRow,
  adapter: ProcurementProviderAdapter
) {
  const verification = await adapter.verifyConnection(
    buildRepairLinkAdapterAccount(rawAccountRow)
  );

  const updatedAccountResult = await updateProcurementProviderAccountStatus(
    client,
    rawAccountRow.id,
    {
      capabilitiesJson: verification.capabilities,
      lastErrorMessage: verification.lastErrorMessage ?? null,
      lastVerifiedAt: new Date().toISOString(),
      status: verification.status
    }
  );

  if (updatedAccountResult.error || !updatedAccountResult.data) {
    throw updatedAccountResult.error ?? new Error("Provider account status could not be updated.");
  }

  return {
    account: updatedAccountResult.data,
    verification
  };
}

async function listPartsTechSupplierMappings(
  client: AppSupabaseClient,
  providerAccountId: string
) {
  const result = await listProcurementProviderSupplierMappingsByAccount(
    client,
    providerAccountId
  );

  if (result.error) {
    throw result.error;
  }

  return result.data ?? [];
}

async function listRepairLinkDealerMappings(
  client: AppSupabaseClient,
  providerAccountId: string
) {
  const result = await listProcurementProviderSupplierMappingsByAccount(
    client,
    providerAccountId
  );

  if (result.error) {
    throw result.error;
  }

  return result.data ?? [];
}

function getQuoteStatusForConvertedLines(lines: ProcurementProviderQuoteLine[]) {
  if (!lines.length) {
    return "manual_required" as const;
  }

  return lines.every((line) => line.selectedForCart) ? "converted" : "selected";
}

function normalizeManualOfferIdentityValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function findMatchingRequestLineForProviderOffer(
  routeableLines: Array<{
    description: string;
    id: string;
    partNumber: string | null;
  }>,
  input: {
    description: string;
    partNumber?: string | null | undefined;
    partRequestLineId?: string | null | undefined;
  }
) {
  if (input.partRequestLineId) {
    return routeableLines.find((requestLine) => requestLine.id === input.partRequestLineId) ?? null;
  }

  const normalizedPartNumber = normalizeManualOfferIdentityValue(input.partNumber);
  const normalizedDescription = normalizeManualOfferIdentityValue(input.description);
  const exactMatches = routeableLines.filter((requestLine) => {
    const partNumberMatches = normalizedPartNumber
      ? normalizeManualOfferIdentityValue(requestLine.partNumber) === normalizedPartNumber
      : true;
    const descriptionMatches = normalizedDescription
      ? normalizeManualOfferIdentityValue(requestLine.description) === normalizedDescription
      : true;

    return partNumberMatches && descriptionMatches;
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (normalizedPartNumber) {
    const partNumberMatches = routeableLines.filter(
      (requestLine) =>
        normalizeManualOfferIdentityValue(requestLine.partNumber) === normalizedPartNumber
    );

    if (partNumberMatches.length === 1) {
      return partNumberMatches[0];
    }
  }

  if (normalizedDescription) {
    const descriptionMatches = routeableLines.filter(
      (requestLine) =>
        normalizeManualOfferIdentityValue(requestLine.description) === normalizedDescription
    );

    if (descriptionMatches.length === 1) {
      return descriptionMatches[0];
    }
  }

  return null;
}

function findMatchingManualProviderQuoteLine(
  lines: ProcurementProviderQuoteLine[],
  input: {
    coreChargeCents?: number | null;
    description: string;
    partNumber?: string | null;
    partRequestLineId: string;
    providerLocationKey?: string | null;
    providerProductKey?: string | null;
    providerSupplierKey: string;
    providerSupplierMappingId?: string | null;
    providerSupplierName: string;
    quantity: number;
    unitPriceCents?: number | null;
  }
) {
  const normalizedDescription = normalizeManualOfferIdentityValue(input.description);
  const normalizedPartNumber = normalizeManualOfferIdentityValue(input.partNumber);
  const normalizedLocationKey = normalizeManualOfferIdentityValue(input.providerLocationKey);
  const normalizedProductKey = normalizeManualOfferIdentityValue(input.providerProductKey);
  const normalizedSupplierKey = normalizeManualOfferIdentityValue(input.providerSupplierKey);
  const normalizedSupplierName = normalizeManualOfferIdentityValue(input.providerSupplierName);

  return lines.find((line) => {
    return (
      line.partRequestLineId === input.partRequestLineId &&
      (line.providerSupplierMappingId ?? null) === (input.providerSupplierMappingId ?? null) &&
      normalizeManualOfferIdentityValue(line.providerLocationKey) === normalizedLocationKey &&
      normalizeManualOfferIdentityValue(line.providerSupplierKey) === normalizedSupplierKey &&
      normalizeManualOfferIdentityValue(line.providerSupplierName) === normalizedSupplierName &&
      normalizeManualOfferIdentityValue(line.description) === normalizedDescription &&
      normalizeManualOfferIdentityValue(line.partNumber) === normalizedPartNumber &&
      normalizeManualOfferIdentityValue(line.providerProductKey) === normalizedProductKey &&
      Number(line.quantity) === Number(input.quantity) &&
      (line.unitPriceCents ?? null) === (input.unitPriceCents ?? null) &&
      (line.coreChargeCents ?? null) === (input.coreChargeCents ?? null)
    );
  });
}

function findMatchingProviderSupplierMapping(
  mappings: ProcurementProviderSupplierMapping[],
  input: {
    providerLocationKey?: string | null | undefined;
    providerSupplierKey: string;
    providerSupplierName: string;
  }
) {
  const normalizedSupplierKey = normalizeManualOfferIdentityValue(input.providerSupplierKey);
  const normalizedSupplierName = normalizeManualOfferIdentityValue(input.providerSupplierName);
  const normalizedLocationKey = normalizeManualOfferIdentityValue(input.providerLocationKey);
  const supplierMatches = mappings.filter(
    (mapping) =>
      normalizeManualOfferIdentityValue(mapping.providerSupplierKey) === normalizedSupplierKey
  );

  if (normalizedLocationKey) {
    const exactLocationMatches = supplierMatches.filter(
      (mapping) =>
        normalizeManualOfferIdentityValue(mapping.providerLocationKey) === normalizedLocationKey
    );

    if (exactLocationMatches.length === 1) {
      return exactLocationMatches[0];
    }

    return null;
  }

  if (supplierMatches.length === 1) {
    return supplierMatches[0];
  }

  const exactNameMatches = supplierMatches.filter(
    (mapping) =>
      normalizeManualOfferIdentityValue(mapping.providerSupplierName) === normalizedSupplierName
  );

  if (exactNameMatches.length === 1) {
    return exactNameMatches[0];
  }

  const locationAgnosticMatches = supplierMatches.filter(
    (mapping) => !normalizeManualOfferIdentityValue(mapping.providerLocationKey)
  );

  if (locationAgnosticMatches.length === 1) {
    return locationAgnosticMatches[0];
  }

  return null;
}

export async function getProcurementIntegrationsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const accountsResult = await listProcurementProviderAccountsByCompany(client, companyId);

  if (accountsResult.error) {
    throw accountsResult.error;
  }

  const partstechAccount =
    (accountsResult.data ?? []).find((account) => account.provider === PARTSTECH_PROVIDER) ??
    null;
  const repairlinkAccount =
    (accountsResult.data ?? []).find((account) => account.provider === REPAIRLINK_PROVIDER) ??
    null;
  const amazonBusinessAccount =
    (accountsResult.data ?? []).find((account) => account.provider === AMAZON_BUSINESS_PROVIDER) ??
    null;
  const partsTechMappings = partstechAccount
    ? await listPartsTechSupplierMappings(client, partstechAccount.id)
    : [];
  const repairLinkMappings = repairlinkAccount
    ? await listRepairLinkDealerMappings(client, repairlinkAccount.id)
    : [];
  const attentionItems: string[] = [];

  if (!partstechAccount) {
    attentionItems.push("PartsTech account is not configured.");
  } else if (partstechAccount.status !== "connected") {
    attentionItems.push(
      partstechAccount.lastErrorMessage ??
        "PartsTech requires manual attention before automation can be attempted."
    );
  }

  const unmappedMappings = partsTechMappings.filter(
    (mapping) => mapping.status === "unmapped"
  ).length;
  const pendingMappings = partsTechMappings.filter(
    (mapping) => mapping.status === "pending_approval"
  ).length;

  if (unmappedMappings > 0) {
    attentionItems.push(`${unmappedMappings} PartsTech supplier mapping(s) are still unmapped.`);
  }

  if (pendingMappings > 0) {
    attentionItems.push(
      `${pendingMappings} PartsTech supplier mapping(s) still need provider-side approval.`
    );
  }

  if (!repairlinkAccount) {
    attentionItems.push("RepairLink account is not configured.");
  } else if (["error", "disconnected"].includes(repairlinkAccount.status)) {
    attentionItems.push(
      repairlinkAccount.lastErrorMessage ??
        "RepairLink requires manual attention before OEM handoff can be used."
    );
  }

  const repairLinkPendingMappings = repairLinkMappings.filter(
    (mapping) => mapping.status === "pending_approval"
  ).length;

  if (repairLinkPendingMappings > 0) {
    attentionItems.push(
      `${repairLinkPendingMappings} RepairLink dealer mapping(s) still need provider-side approval.`
    );
  }

  if (!amazonBusinessAccount) {
    attentionItems.push("Amazon Business account is not configured.");
  } else if (amazonBusinessAccount.status !== "connected") {
    attentionItems.push(
      amazonBusinessAccount.lastErrorMessage ??
        "Amazon Business requires manual attention before supplies sourcing can use the provider workspace."
    );
  } else if (!getAmazonBusinessDefaultSupplierAccountId(amazonBusinessAccount.settingsJson)) {
    attentionItems.push(
      "Amazon Business needs a default supplier account before supply quotes can convert into supplier carts."
    );
  }

  return {
    attentionItems,
    amazonBusiness: {
      account: amazonBusinessAccount
    },
    partsTech: {
      account: partstechAccount,
      mappings: partsTechMappings
    },
    repairLink: {
      account: repairlinkAccount,
      mappings: repairLinkMappings
    }
  };
}

export async function getPartsTechSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [integrationsWorkspace, supplierAccountsResult] = await Promise.all([
    getProcurementIntegrationsWorkspace(client, companyId),
    listSupplierAccountsByCompany(client, companyId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  return {
    account: integrationsWorkspace.partsTech.account,
    attentionItems: integrationsWorkspace.attentionItems,
    mappings: integrationsWorkspace.partsTech.mappings,
    supplierAccounts: (supplierAccountsResult.data ?? []).filter((account) => account.isActive)
  };
}

export async function getAmazonBusinessSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [integrationsWorkspace, supplierAccountsResult] = await Promise.all([
    getProcurementIntegrationsWorkspace(client, companyId),
    listSupplierAccountsByCompany(client, companyId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const supplierAccounts = (supplierAccountsResult.data ?? []).filter((account) => account.isActive);

  return {
    account: integrationsWorkspace.amazonBusiness.account,
    attentionItems: integrationsWorkspace.attentionItems,
    defaultSupplierAccount:
      supplierAccounts.find(
        (account) =>
          account.id ===
          getAmazonBusinessDefaultSupplierAccountId(
            integrationsWorkspace.amazonBusiness.account?.settingsJson
          )
      ) ?? null,
    supplierAccounts
  };
}

export async function savePartsTechAccountSettings(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderAccountInput
) {
  const normalizedInput = normalizePartsTechAccountInput(input);
  const accountResult = await upsertProcurementProviderAccount(client, {
    capabilitiesJson: getProcurementProviderAdapter(PARTSTECH_PROVIDER).getCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext: encryptProviderCredential(normalizedInput.apiKey),
    credentialHint: buildCredentialHint(normalizedInput.apiKey),
    displayName: buildPartsTechDisplayName(null),
    provider: PARTSTECH_PROVIDER,
    settingsJson: buildPartsTechSettingsJson(normalizedInput),
    status: "action_required",
    username: normalizedInput.username
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("PartsTech settings could not be saved.");
  }

  return verifyPartsTechConnection(client, normalizedInput.companyId);
}

export async function saveAmazonBusinessAccountSettings(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderAccountInput
) {
  const normalizedInput = normalizeAmazonBusinessAccountInput(input);
  const accountResult = await upsertProcurementProviderAccount(client, {
    capabilitiesJson: getProcurementProviderAdapter(AMAZON_BUSINESS_PROVIDER).getCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext: null,
    credentialHint: null,
    displayName: buildAmazonBusinessDisplayName(null),
    provider: AMAZON_BUSINESS_PROVIDER,
    settingsJson: buildAmazonBusinessSettingsJson(normalizedInput),
    status: "action_required",
    username: normalizedInput.accountEmail
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("Amazon Business settings could not be saved.");
  }

  return verifyAmazonBusinessConnection(client, normalizedInput.companyId);
}

export async function verifyPartsTechConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  const { adapter, rawAccountRow } = await requirePartsTechAccount(client, companyId);
  return upsertPartsTechStatusFromVerification(client, rawAccountRow, adapter);
}

export async function verifyAmazonBusinessConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  const { adapter, rawAccountRow } = await requireAmazonBusinessAccount(client, companyId);
  const verificationResult = await adapter.verifyConnection(
    buildAmazonBusinessAdapterAccount(rawAccountRow)
  );

  const accountStatusResult = await updateProcurementProviderAccountStatus(
    client,
    rawAccountRow.id,
    {
      capabilitiesJson: verificationResult.capabilities,
      lastErrorMessage: verificationResult.lastErrorMessage ?? null,
      lastVerifiedAt: new Date().toISOString(),
      status: verificationResult.status
    }
  );

  if (accountStatusResult.error || !accountStatusResult.data) {
    throw accountStatusResult.error ?? new Error("Amazon Business status could not be updated.");
  }

  return accountStatusResult.data;
}

export async function disconnectPartsTechAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  await requirePartsTechAccount(client, companyId);
  const disconnectedAccountResult = await disconnectProcurementProviderAccount(
    client,
    companyId,
    PARTSTECH_PROVIDER
  );

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("PartsTech could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}

export async function disconnectAmazonBusinessAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  await requireAmazonBusinessAccount(client, companyId);
  const disconnectedAccountResult = await disconnectProcurementProviderAccount(
    client,
    companyId,
    AMAZON_BUSINESS_PROVIDER
  );

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("Amazon Business could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}

export async function savePartsTechSupplierMapping(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderSupplierMappingInput
) {
  const result = await upsertProcurementProviderSupplierMapping(client, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("PartsTech supplier mapping could not be saved.");
  }

  return result.data;
}

export async function getRepairLinkSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [integrationsWorkspace, supplierAccountsResult] = await Promise.all([
    getProcurementIntegrationsWorkspace(client, companyId),
    listSupplierAccountsByCompany(client, companyId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const attentionItems: string[] = [];

  if (!integrationsWorkspace.repairLink.account) {
    attentionItems.push("RepairLink account is not configured.");
  } else if (
    ["error", "disconnected"].includes(integrationsWorkspace.repairLink.account.status)
  ) {
    attentionItems.push(
      integrationsWorkspace.repairLink.account.lastErrorMessage ??
        "RepairLink requires manual attention before VIN-linked OEM sourcing can be used."
    );
  }

  const pendingRepairLinkMappings = integrationsWorkspace.repairLink.mappings.filter(
    (mapping) => mapping.status === "pending_approval"
  ).length;

  if (pendingRepairLinkMappings > 0) {
    attentionItems.push(
      `${pendingRepairLinkMappings} RepairLink dealer mapping(s) still need provider-side approval.`
    );
  }

  return {
    account: integrationsWorkspace.repairLink.account,
    attentionItems,
    mappings: integrationsWorkspace.repairLink.mappings,
    supplierAccounts: (supplierAccountsResult.data ?? []).filter((account) => account.isActive)
  };
}

export async function saveRepairLinkAccountSettings(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderAccountInput
) {
  const normalizedInput = normalizeRepairLinkAccountInput(input);
  const existingAccountRow = await getProcurementProviderAccountRow(
    client,
    normalizedInput.companyId,
    REPAIRLINK_PROVIDER
  );

  if (!normalizedInput.password && !existingAccountRow?.credential_ciphertext) {
    throw new Error("Enter a RepairLink password before saving this account.");
  }

  const credentialCiphertext =
    normalizedInput.password
      ? encryptProviderCredential(normalizedInput.password)
      : existingAccountRow?.credential_ciphertext ?? null;
  const credentialHint =
    normalizedInput.password
      ? buildCredentialHint(normalizedInput.password)
      : existingAccountRow?.credential_hint ?? null;
  const accountResult = await upsertProcurementProviderAccount(client, {
    capabilitiesJson: getProcurementProviderAdapter(REPAIRLINK_PROVIDER).getCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext,
    credentialHint,
    displayName: buildRepairLinkDisplayName(null),
    provider: REPAIRLINK_PROVIDER,
    settingsJson: buildRepairLinkSettingsJsonWithResolvedPasswordHint(
      normalizedInput,
      credentialHint
    ),
    status: "action_required",
    username: normalizedInput.username
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("RepairLink settings could not be saved.");
  }

  return verifyRepairLinkConnection(client, normalizedInput.companyId);
}

export async function verifyRepairLinkConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  const { adapter, rawAccountRow } = await requireRepairLinkAccount(client, companyId);
  return upsertRepairLinkStatusFromVerification(client, rawAccountRow, adapter);
}

export async function disconnectRepairLinkAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  await requireRepairLinkAccount(client, companyId);
  const disconnectedAccountResult = await disconnectProcurementProviderAccount(
    client,
    companyId,
    REPAIRLINK_PROVIDER
  );

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("RepairLink could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}

export async function saveRepairLinkDealerMapping(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderSupplierMappingInput
) {
  const providerAccountResult = await client
    .from("procurement_provider_accounts")
    .select("id, provider")
    .eq("id", input.providerAccountId)
    .eq("company_id", input.companyId)
    .maybeSingle<{ id: string; provider: ProcurementProvider }>();

  if (providerAccountResult.error) {
    throw providerAccountResult.error;
  }

  if (!providerAccountResult.data || providerAccountResult.data.provider !== REPAIRLINK_PROVIDER) {
    throw new Error("RepairLink dealer mappings must belong to the configured RepairLink account.");
  }

  const result = await upsertProcurementProviderSupplierMapping(client, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("RepairLink dealer mapping could not be saved.");
  }

  return result.data;
}

export async function getRequestProviderWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  requestId: string
): Promise<PartsTechRequestWorkspace> {
  const partstechAccountResult = await getProcurementProviderAccountByProvider(
    client,
    companyId,
    PARTSTECH_PROVIDER
  );

  if (partstechAccountResult.error) {
    throw partstechAccountResult.error;
  }

  if (!partstechAccountResult.data) {
    return {
      account: null,
      latestQuote: null,
      supplierMappings: [],
      unmappedQuoteLineCount: 0
    };
  }

  const [quoteResult, mappings] = await Promise.all([
    getLatestProcurementProviderQuoteByRequestAndAccount(client, {
      partRequestId: requestId,
      providerAccountId: partstechAccountResult.data.id
    }),
    listPartsTechSupplierMappings(client, partstechAccountResult.data.id)
  ]);

  if (quoteResult.error) {
    throw quoteResult.error;
  }

  return {
    account: partstechAccountResult.data,
    latestQuote: quoteResult.data,
    supplierMappings: mappings,
    unmappedQuoteLineCount:
      quoteResult.data?.lines.filter((line) => !line.providerSupplierMappingId).length ?? 0
  };
}

async function getProviderRequestContext(
  client: AppSupabaseClient,
  requestId: string,
  selectedPartRequestLineIds?: string[] | null
) {
  const requestResult = await getPartRequestById(client, requestId);

  if (requestResult.error || !requestResult.data) {
    throw requestResult.error ?? new Error("Part request could not be loaded.");
  }

  const jobResult = await getJobById(client, requestResult.data.request.jobId);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Visit could not be loaded.");
  }

  const vehicleResult = await getVehicleById(client, jobResult.data.vehicleId);

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }

  const routeableLines = requestResult.data.lines.filter((line) => {
    const netConsumedFromStock = Math.max(
      line.quantityConsumedFromStock - line.quantityReturnedToInventory,
      0
    );

    return (
      line.quantityRequested -
        line.quantityInstalled -
        line.quantityReservedFromStock -
        netConsumedFromStock >
      0
    );
  });

  const selectedLineIdSet = new Set(
    (selectedPartRequestLineIds ?? []).filter((lineId) => typeof lineId === "string" && lineId.trim().length > 0)
  );
  const selectedRouteableLines =
    selectedLineIdSet.size > 0
      ? routeableLines.filter((line) => selectedLineIdSet.has(line.id))
      : routeableLines;

  return {
    request: requestResult.data,
    job: jobResult.data,
    vehicle: vehicleResult.data ?? null,
    routeableLines: selectedRouteableLines
  };
}

export async function getRepairLinkRequestWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  requestId: string
): Promise<RepairLinkRequestWorkspace> {
  const repairLinkAccountResult = await getProcurementProviderAccountByProvider(
    client,
    companyId,
    REPAIRLINK_PROVIDER
  );

  if (repairLinkAccountResult.error) {
    throw repairLinkAccountResult.error;
  }

  if (!repairLinkAccountResult.data) {
    return {
      account: null,
      latestQuote: null,
      supplierMappings: [],
      unmappedQuoteLineCount: 0
    };
  }

  const [quoteResult, mappings] = await Promise.all([
    getLatestProcurementProviderQuoteByRequestAndAccount(client, {
      partRequestId: requestId,
      providerAccountId: repairLinkAccountResult.data.id
    }),
    listRepairLinkDealerMappings(client, repairLinkAccountResult.data.id)
  ]);

  if (quoteResult.error) {
    throw quoteResult.error;
  }

  return {
    account: repairLinkAccountResult.data,
    latestQuote: quoteResult.data,
    supplierMappings: mappings,
    unmappedQuoteLineCount:
      quoteResult.data?.lines.filter((line) => !line.providerSupplierMappingId).length ?? 0
  };
}

export async function getAmazonBusinessRequestWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  requestId: string
): Promise<AmazonBusinessRequestWorkspace> {
  const amazonAccountResult = await getProcurementProviderAccountByProvider(
    client,
    companyId,
    AMAZON_BUSINESS_PROVIDER
  );

  if (amazonAccountResult.error) {
    throw amazonAccountResult.error;
  }

  if (!amazonAccountResult.data) {
    return {
      account: null,
      latestQuote: null,
      supplierMappings: [],
      unmappedQuoteLineCount: 0
    };
  }

  const quoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: requestId,
    providerAccountId: amazonAccountResult.data.id
  });

  if (quoteResult.error) {
    throw quoteResult.error;
  }

  return {
    account: amazonAccountResult.data,
    latestQuote: quoteResult.data,
    supplierMappings: [],
    unmappedQuoteLineCount: 0
  };
}

export async function searchPartsTechForRequest(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    requestId: string;
    requestedByUserId: string;
    searchTerms?: string[] | undefined;
    selectedPartRequestLineIds?: string[] | undefined;
  }
) {
  const { account, adapter, rawAccountRow } = await requirePartsTechAccount(
    client,
    input.companyId
  );
  const requestContext = await getProviderRequestContext(
    client,
    input.requestId,
    input.selectedPartRequestLineIds
  );
  const explicitSearchTerms = input.searchTerms
    ?.map((searchTerm) => searchTerm.trim())
    .filter(Boolean);
  const searchTerms =
    explicitSearchTerms && explicitSearchTerms.length
      ? explicitSearchTerms
      : buildPartsTechSearchTerms(
          requestContext.routeableLines.map((line) => ({
            description: line.description,
            partNumber: line.partNumber
          }))
        );

  if (!requestContext.routeableLines.length) {
    throw new Error("There is no remaining procurement demand to search through PartsTech.");
  }

  const searchResult = await adapter.searchOffers({
    account: buildPartsTechAdapterAccount(rawAccountRow),
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    lines: requestContext.routeableLines.map((line) => ({
      description: line.description,
      id: line.id,
      partNumber: line.partNumber,
      quantityRequested: line.quantityRequested
    })),
    requestId: requestContext.request.request.id,
    searchTerms,
    selectedPartRequestLineIds: requestContext.routeableLines.map((line) => line.id),
    vehicle: {
      engine: requestContext.vehicle?.engine ?? null,
      licensePlate: requestContext.vehicle?.licensePlate ?? null,
      make: requestContext.vehicle?.make ?? null,
      model: requestContext.vehicle?.model ?? null,
      vin: requestContext.vehicle?.vin ?? null,
      year: requestContext.vehicle?.year ?? null
    }
  });

  const vehicleContextJson = {
    engine: requestContext.vehicle?.engine ?? null,
    licensePlate: requestContext.vehicle?.licensePlate ?? null,
    make: requestContext.vehicle?.make ?? null,
    model: requestContext.vehicle?.model ?? null,
    vin: requestContext.vehicle?.vin ?? null,
    year: requestContext.vehicle?.year ?? null
  } as Json;
  const searchContextJson = {
    fallbackMode: "manual_capture",
    provider: PARTSTECH_PROVIDER,
    searchTerms,
    selectedPartRequestLineIds: requestContext.routeableLines.map((line) => line.id)
  } as Json;
  const metadataJson = {
    ...toJsonObject(searchResult.metadata),
    fallbackMode: "manual_capture",
    message: searchResult.message,
    provider: PARTSTECH_PROVIDER
  } as Json;

  const shouldReuseOpenManualQuote =
    searchResult.status === "manual_required" && searchResult.lines.length === 0;
  const quoteResult = shouldReuseOpenManualQuote
    ? {
        data: await ensurePartsTechQuote(client, {
          companyId: input.companyId,
          estimateId: requestContext.request.request.estimateId,
          jobId: requestContext.request.request.jobId,
          partRequestId: requestContext.request.request.id,
          providerAccountId: account.id,
          requestedByUserId: input.requestedByUserId,
          searchContextJson,
          vehicleContextJson
        }),
        error: null
      }
    : await createProcurementProviderQuote(client, {
        companyId: input.companyId,
        providerAccountId: account.id,
        jobId: requestContext.request.request.jobId,
        estimateId: requestContext.request.request.estimateId,
        partRequestId: requestContext.request.request.id,
        requestedByUserId: input.requestedByUserId,
        status: searchResult.status,
        vehicleContextJson,
        searchContextJson,
        metadataJson
      });

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("PartsTech quote session could not be created.");
  }

  if (shouldReuseOpenManualQuote) {
    await updateProcurementProviderQuoteStatus(
      client,
      quoteResult.data.id,
      quoteResult.data.status === "priced" || quoteResult.data.status === "selected"
        ? quoteResult.data.status
        : searchResult.status,
      metadataJson
    );
  }

  const mappings = await listPartsTechSupplierMappings(client, account.id);

  for (const line of searchResult.lines) {
    const matchingRequestLine = findMatchingRequestLineForProviderOffer(requestContext.routeableLines, {
      description: line.description,
      partNumber: line.partNumber,
      partRequestLineId: line.partRequestLineId
    });

    if (!matchingRequestLine) {
      continue;
    }

    const matchingMapping = findMatchingProviderSupplierMapping(mappings, {
      providerLocationKey: line.providerLocationKey,
      providerSupplierKey: line.providerSupplierKey,
      providerSupplierName: line.providerSupplierName
    });

    const createdQuoteLineResult = await createProcurementProviderQuoteLine(client, {
      availabilityText: line.availabilityText ?? null,
      companyId: input.companyId,
      coreChargeCents: line.coreChargeCents ?? null,
      description: line.description,
      etaText: line.etaText ?? null,
      manufacturer: line.manufacturer ?? null,
      partNumber: line.partNumber ?? null,
      partRequestLineId: matchingRequestLine.id,
      providerOfferKey: line.providerOfferKey,
      providerLocationKey: line.providerLocationKey ?? matchingMapping?.providerLocationKey ?? null,
      providerQuoteId: quoteResult.data.id,
      providerSupplierKey: line.providerSupplierKey,
      providerSupplierMappingId: matchingMapping?.id ?? null,
      providerSupplierName: line.providerSupplierName,
      quantity: line.quantity,
      rawResponseJson: (line.rawResponseJson ?? {}) as Json,
      selectedForCart: false,
      unitPriceCents: line.unitPriceCents ?? null
    });

    if (createdQuoteLineResult.error || !createdQuoteLineResult.data) {
      throw createdQuoteLineResult.error ?? new Error("PartsTech offer could not be persisted.");
    }
  }

  return getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id
  });
}

export async function searchRepairLinkForRequest(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    requestId: string;
    requestedByUserId: string;
    selectedPartRequestLineIds?: string[] | undefined;
    selectedDealerMappingIds: string[];
  }
) {
  const { account, adapter, rawAccountRow } = await requireRepairLinkAccount(
    client,
    input.companyId
  );
  const fallbackMode = getRepairLinkFallbackMode(rawAccountRow.settings_json);
  const requestContext = await getProviderRequestContext(
    client,
    input.requestId,
    input.selectedPartRequestLineIds
  );

  if (!requestContext.routeableLines.length) {
    throw new Error("There is no remaining procurement demand to search through RepairLink.");
  }

  if (!requestContext.vehicle?.vin?.trim()) {
    throw new Error("RepairLink sourcing requires a VIN on the vehicle before starting an OEM search.");
  }

  const mappings = await listRepairLinkDealerMappings(client, account.id);
  const selectedMappings = mappings.filter(
    (mapping) =>
      input.selectedDealerMappingIds.includes(mapping.id) &&
      !["disabled", "unmapped"].includes(mapping.status) &&
      mapping.supportsQuote
  );

  if (!selectedMappings.length) {
    throw new Error(
      "Select at least one active RepairLink dealer mapping that supports quote capture."
    );
  }

  const vehicleContext = buildRepairLinkVehicleContext({
    engine: requestContext.vehicle.engine ?? null,
    licensePlate: requestContext.vehicle.licensePlate ?? null,
    make: requestContext.vehicle.make ?? null,
    model: requestContext.vehicle.model ?? null,
    vin: requestContext.vehicle.vin,
    year: requestContext.vehicle.year ?? null
  });
  const searchContext = buildRepairLinkSearchContext({
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    lines: requestContext.routeableLines.map((line) => ({
      description: line.description,
      id: line.id,
      partNumber: line.partNumber
    })),
    requestId: requestContext.request.request.id,
    selectedPartRequestLineIds: requestContext.routeableLines.map((line) => line.id),
    selectedDealerMappingIds: selectedMappings.map((mapping) => mapping.id),
    vehicle: vehicleContext,
    fallbackMode
  });

  const searchResult = await adapter.searchOffers({
    account: buildRepairLinkAdapterAccount(rawAccountRow),
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    lines: requestContext.routeableLines.map((line) => ({
      description: line.description,
      id: line.id,
      partNumber: line.partNumber,
      quantityRequested: line.quantityRequested
    })),
    requestId: requestContext.request.request.id,
    selectedPartRequestLineIds: requestContext.routeableLines.map((line) => line.id),
    selectedSupplierMappingIds: selectedMappings.map((mapping) => mapping.id),
    vehicle: vehicleContext
  });

  const vehicleContextJson = vehicleContext as unknown as Json;
  const searchContextJson = searchContext as unknown as Json;
  const metadataJson = {
    ...toJsonObject(searchResult.metadata),
    fallbackMode,
    message: searchResult.message,
    provider: REPAIRLINK_PROVIDER
  } as Json;

  const shouldReuseOpenManualQuote =
    searchResult.status === "manual_required" && searchResult.lines.length === 0;
  const quoteResult = shouldReuseOpenManualQuote
    ? {
        data: await ensureRepairLinkQuote(client, {
          companyId: input.companyId,
          estimateId: requestContext.request.request.estimateId,
          jobId: requestContext.request.request.jobId,
          metadataJson,
          partRequestId: requestContext.request.request.id,
          providerAccountId: account.id,
          requestedByUserId: input.requestedByUserId,
          searchContextJson,
          vehicleContextJson
        }),
        error: null
      }
    : await createProcurementProviderQuote(client, {
        companyId: input.companyId,
        providerAccountId: account.id,
        jobId: requestContext.request.request.jobId,
        estimateId: requestContext.request.request.estimateId,
        partRequestId: requestContext.request.request.id,
        requestedByUserId: input.requestedByUserId,
        status: searchResult.status,
        vehicleContextJson,
        searchContextJson,
        metadataJson
      });

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("RepairLink quote session could not be created.");
  }

  if (shouldReuseOpenManualQuote) {
    await updateProcurementProviderQuoteStatus(
      client,
      quoteResult.data.id,
      quoteResult.data.status === "priced" || quoteResult.data.status === "selected"
        ? quoteResult.data.status
        : searchResult.status,
      metadataJson
    );
  }

  for (const line of searchResult.lines) {
    const matchingRequestLine = findMatchingRequestLineForProviderOffer(
      requestContext.routeableLines,
      {
        description: line.description,
        partNumber: line.partNumber,
        partRequestLineId: line.partRequestLineId
      }
    );

    if (!matchingRequestLine) {
      continue;
    }

    const matchingMapping = findMatchingProviderSupplierMapping(selectedMappings, {
      providerLocationKey: line.providerLocationKey,
      providerSupplierKey: line.providerSupplierKey,
      providerSupplierName: line.providerSupplierName
    });

    const createdQuoteLineResult = await createProcurementProviderQuoteLine(client, {
      availabilityText: line.availabilityText ?? null,
      companyId: input.companyId,
      coreChargeCents: line.coreChargeCents ?? null,
      description: line.description,
      etaText: line.etaText ?? null,
      manufacturer: line.manufacturer ?? null,
      partNumber: line.partNumber ?? null,
      partRequestLineId: matchingRequestLine.id,
      providerOfferKey: line.providerOfferKey,
      providerLocationKey: line.providerLocationKey ?? matchingMapping?.providerLocationKey ?? null,
      providerQuoteId: quoteResult.data.id,
      providerSupplierKey: line.providerSupplierKey,
      providerSupplierMappingId: matchingMapping?.id ?? null,
      providerSupplierName: line.providerSupplierName,
      quantity: line.quantity,
      rawResponseJson: (line.rawResponseJson ?? {}) as Json,
      selectedForCart: false,
      unitPriceCents: line.unitPriceCents ?? null
    });

    if (createdQuoteLineResult.error || !createdQuoteLineResult.data) {
      throw createdQuoteLineResult.error ?? new Error("RepairLink offer could not be persisted.");
    }
  }

  return getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id
  });
}

export async function searchAmazonBusinessForRequest(
  client: AppSupabaseClient,
  input: SearchAmazonBusinessOffersInput
) {
  const { account, adapter, rawAccountRow } = await requireAmazonBusinessAccount(
    client,
    input.companyId
  );
  const requestContext = await getProviderRequestContext(client, input.requestId);
  const requestedLineIdSet = new Set(
    input.selectedPartRequestLineIds.length
      ? input.selectedPartRequestLineIds
      : requestContext.routeableLines.map((line) => line.id)
  );
  const selectedRouteableLines = requestContext.routeableLines.filter((line) =>
    requestedLineIdSet.has(line.id)
  );

  if (!selectedRouteableLines.length) {
    throw new Error("Select at least one open supply line before starting Amazon Business sourcing.");
  }

  if (!input.searchTerms.length && !input.supplyListId) {
    throw new Error(
      "Provide Amazon search terms or select an applied supply list before starting a supply sourcing session."
    );
  }

  const fallbackMode = getAmazonBusinessFallbackMode(toJsonObject(account.settingsJson));
  const searchTerms = await resolveAmazonBusinessSearchTerms(client, {
    searchTerms: input.searchTerms,
    selectedRouteableLines,
    supplyListId: input.supplyListId ?? null
  });
  const searchResult = await adapter.searchOffers({
    account: buildAmazonBusinessAdapterAccount(rawAccountRow),
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    lines: selectedRouteableLines.map((line) => ({
      description: line.description,
      id: line.id,
      partNumber: line.partNumber,
      quantityRequested: line.quantityRequested
    })),
    requestId: requestContext.request.request.id,
    searchTerms,
    selectedPartRequestLineIds: selectedRouteableLines.map((line) => line.id),
    supplyListId: input.supplyListId ?? null,
    vehicle: {
      engine: requestContext.vehicle?.engine ?? null,
      licensePlate: requestContext.vehicle?.licensePlate ?? null,
      make: requestContext.vehicle?.make ?? null,
      model: requestContext.vehicle?.model ?? null,
      vin: requestContext.vehicle?.vin ?? null,
      year: requestContext.vehicle?.year ?? null
    }
  });
  const searchContextJson = buildAmazonBusinessSearchContext({
    estimateId: requestContext.request.request.estimateId,
    fallbackMode,
    jobId: requestContext.request.request.jobId,
    lines: selectedRouteableLines,
    requestId: requestContext.request.request.id,
    searchTerms,
    selectedPartRequestLineIds: selectedRouteableLines.map((line) => line.id),
    supplyListId: input.supplyListId ?? null
  }) as unknown as Json;
  const metadataJson =
    searchResult.metadata ??
    ({
      fallbackMode,
      handoff: buildAmazonBusinessHandoffMetadata({
        manualReason: searchResult.message ?? AMAZON_BUSINESS_LINK_URL,
        searchTerms,
        supplyListId: input.supplyListId ?? null
      }),
      linkOutUrl: AMAZON_BUSINESS_LINK_URL,
      provider: AMAZON_BUSINESS_PROVIDER
    } as unknown as Json);

  const defaultRouteableLine = selectedRouteableLines[0];

  if (!defaultRouteableLine) {
    throw new Error("Select at least one open supply line before starting Amazon Business sourcing.");
  }

  const quote = await ensureAmazonBusinessQuote(client, {
    companyId: input.companyId,
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    metadataJson,
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id,
    requestedByUserId: input.requestedByUserId,
    searchContextJson,
    vehicleContextJson: {
      vin: requestContext.vehicle?.vin ?? null
    } as Json
  });

  if (searchResult.lines.length > 0) {
    for (const line of searchResult.lines) {
      const lineResult = await createProcurementProviderQuoteLine(client, {
        availabilityText: line.availabilityText ?? null,
        companyId: input.companyId,
        coreChargeCents: line.coreChargeCents ?? null,
        description: line.description,
        etaText: line.etaText ?? null,
        manufacturer: line.manufacturer ?? null,
        partNumber: line.partNumber ?? null,
        partRequestLineId: line.partRequestLineId ?? defaultRouteableLine.id,
        providerOfferKey: line.providerOfferKey,
        providerProductKey: line.providerProductKey ?? null,
        providerQuoteId: quote.id,
        providerSupplierKey: line.providerSupplierKey,
        providerSupplierName: line.providerSupplierName,
        quantity: line.quantity,
        rawResponseJson: (line.rawResponseJson ?? {}) as Json,
        selectedForCart: false,
        unitPriceCents: line.unitPriceCents ?? null
      });

      if (lineResult.error || !lineResult.data) {
        throw lineResult.error ?? new Error("Amazon Business quote line could not be saved.");
      }
    }
  }

  await updateProcurementProviderQuoteStatus(client, quote.id, searchResult.status, metadataJson);

  return getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id
  });
}

export async function createManualPartsTechQuoteLine(
  client: AppSupabaseClient,
  input: {
    availabilityText?: string | null;
    companyId: string;
    coreChargeCents?: number | null;
    description: string;
    etaText?: string | null;
    manufacturer?: string | null;
    partNumber?: string | null;
    partRequestLineId: string;
    providerSupplierKey?: string | null;
    providerSupplierMappingId?: string | null;
    providerSupplierName?: string | null;
    quantity: number;
    requestId: string;
    requestedByUserId: string;
    unitPriceCents?: number | null;
  }
) {
  const { account } = await requirePartsTechAccount(client, input.companyId);
  const requestResult = await getPartRequestById(client, input.requestId);

  if (requestResult.error || !requestResult.data) {
    throw requestResult.error ?? new Error("Part request could not be loaded.");
  }

  const mappingRow = input.providerSupplierMappingId
    ? await client
        .from("procurement_provider_supplier_mappings")
        .select("*")
        .eq("id", input.providerSupplierMappingId)
        .single<ProcurementProviderSupplierMappingRow>()
    : { data: null as ProcurementProviderSupplierMappingRow | null, error: null };

  if (mappingRow.error) {
    throw mappingRow.error;
  }

  if (
    mappingRow.data &&
    mappingRow.data.provider_account_id !== account.id
  ) {
    throw new Error("Selected PartsTech supplier mapping does not belong to this PartsTech account.");
  }

  if (mappingRow.data && ["disabled", "unmapped"].includes(mappingRow.data.status)) {
    throw new Error(
      "Selected PartsTech supplier mapping is not active. Use an active or pending-approval mapping before capturing a quote."
    );
  }

  const quote = await ensurePartsTechQuote(client, {
    companyId: input.companyId,
    estimateId: requestResult.data.request.estimateId,
    jobId: requestResult.data.request.jobId,
    partRequestId: requestResult.data.request.id,
    providerAccountId: account.id,
    requestedByUserId: input.requestedByUserId,
    searchContextJson: {
      fallbackMode: "manual_capture",
      provider: PARTSTECH_PROVIDER
    } as Json,
    vehicleContextJson: {
      engine: null,
      licensePlate: null,
      make: null,
      model: null,
      vin: null,
      year: null
    } as Json
  });

  const providerSupplierKey =
    input.providerSupplierKey?.trim() || mappingRow.data?.provider_supplier_key;
  const providerSupplierName =
    input.providerSupplierName?.trim() || mappingRow.data?.provider_supplier_name;
  const providerLocationKey = mappingRow.data?.provider_location_key ?? null;

  if (!providerSupplierKey || !providerSupplierName) {
    throw new Error(
      "Provide a PartsTech supplier key and supplier name, or select an existing supplier mapping."
    );
  }

  const existingQuoteLinesResult = await listProcurementProviderQuoteLinesByQuoteId(
    client,
    quote.id
  );

  if (existingQuoteLinesResult.error) {
    throw existingQuoteLinesResult.error;
  }

  const matchingManualLine = findMatchingManualProviderQuoteLine(
    existingQuoteLinesResult.data ?? [],
    {
      coreChargeCents: input.coreChargeCents ?? null,
      description: input.description,
      partNumber: input.partNumber ?? null,
      partRequestLineId: input.partRequestLineId,
      providerLocationKey,
      providerSupplierKey,
      providerSupplierMappingId: mappingRow.data?.id ?? null,
      providerSupplierName,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents ?? null
    }
  );

  if (matchingManualLine) {
    const updatedQuoteLineResult = await updateProcurementProviderQuoteLine(
      client,
      matchingManualLine.id,
      {
        availabilityText: input.availabilityText ?? null,
        coreChargeCents: input.coreChargeCents ?? null,
        description: input.description,
        etaText: input.etaText ?? null,
        manufacturer: input.manufacturer ?? null,
        partNumber: input.partNumber ?? null,
        providerLocationKey,
        providerSupplierKey,
        providerSupplierMappingId: mappingRow.data?.id ?? null,
        providerSupplierName,
        quantity: input.quantity,
        rawResponseJson: {
          capturedManually: true,
          provider: PARTSTECH_PROVIDER
        } as Json,
        unitPriceCents: input.unitPriceCents ?? null
      }
    );

    if (updatedQuoteLineResult.error || !updatedQuoteLineResult.data) {
      throw updatedQuoteLineResult.error ?? new Error("Manual PartsTech offer could not be updated.");
    }

    await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
      fallbackMode: "manual_capture",
      provider: PARTSTECH_PROVIDER
    });

    return updatedQuoteLineResult.data;
  }

  const quoteLineResult = await createProcurementProviderQuoteLine(client, {
    availabilityText: input.availabilityText ?? null,
    companyId: input.companyId,
    coreChargeCents: input.coreChargeCents ?? null,
    description: input.description,
    etaText: input.etaText ?? null,
    manufacturer: input.manufacturer ?? null,
    partNumber: input.partNumber ?? null,
    partRequestLineId: input.partRequestLineId,
    providerLocationKey,
    providerOfferKey: `manual-${randomUUID()}`,
    providerQuoteId: quote.id,
    providerSupplierKey,
    providerSupplierMappingId: mappingRow.data?.id ?? null,
    providerSupplierName,
    quantity: input.quantity,
    rawResponseJson: {
      capturedManually: true,
      provider: PARTSTECH_PROVIDER
    } as Json,
    selectedForCart: false,
    unitPriceCents: input.unitPriceCents ?? null
  });

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("Manual PartsTech offer could not be saved.");
  }

  await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
    fallbackMode: "manual_capture",
    provider: PARTSTECH_PROVIDER
  });

  return quoteLineResult.data;
}

export async function createManualRepairLinkQuoteLine(
  client: AppSupabaseClient,
  input: CreateManualRepairLinkQuoteLineInput
) {
  const { account } = await requireRepairLinkAccount(client, input.companyId);
  const fallbackMode = getRepairLinkFallbackMode(account.settingsJson);
  const requestContext = await getProviderRequestContext(client, input.requestId);

  if (!requestContext.vehicle?.vin?.trim()) {
    throw new Error("RepairLink manual quote capture requires a VIN on the vehicle.");
  }

  const mappingRowResult = await client
    .from("procurement_provider_supplier_mappings")
    .select("*")
    .eq("id", input.providerSupplierMappingId)
    .single<ProcurementProviderSupplierMappingRow>();

  if (mappingRowResult.error || !mappingRowResult.data) {
    throw mappingRowResult.error ?? new Error("RepairLink dealer mapping could not be loaded.");
  }

  if (mappingRowResult.data.provider_account_id !== account.id) {
    throw new Error("Selected RepairLink dealer mapping does not belong to this RepairLink account.");
  }

  if (
    ["disabled", "unmapped"].includes(mappingRowResult.data.status) ||
    !mappingRowResult.data.supports_quote
  ) {
    throw new Error(
      "Selected RepairLink dealer mapping is not active for quote capture. Use an active or pending-approval dealer mapping that supports quote capture."
    );
  }

  const selectedRequestLine = requestContext.routeableLines.find(
    (line) => line.id === input.partRequestLineId
  );

  if (!selectedRequestLine) {
    throw new Error(
      "This RepairLink quote line can only be captured against part-request lines that still need OEM sourcing."
    );
  }

  const quote = await ensureRepairLinkQuote(client, {
    companyId: input.companyId,
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    metadataJson: {
      fallbackMode,
      loginUrl: REPAIRLINK_LOGIN_URL,
      provider: REPAIRLINK_PROVIDER
    } as Json,
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id,
    requestedByUserId: input.requestedByUserId,
    searchContextJson: buildRepairLinkSearchContext({
      estimateId: requestContext.request.request.estimateId,
      jobId: requestContext.request.request.jobId,
      lines: requestContext.routeableLines.map((line) => ({
        description: line.description,
        id: line.id,
        partNumber: line.partNumber
      })),
      requestId: requestContext.request.request.id,
      selectedPartRequestLineIds: [selectedRequestLine.id],
      selectedDealerMappingIds: [mappingRowResult.data.id],
      vehicle: buildRepairLinkVehicleContext({
        engine: requestContext.vehicle?.engine ?? null,
        licensePlate: requestContext.vehicle?.licensePlate ?? null,
        make: requestContext.vehicle?.make ?? null,
        model: requestContext.vehicle?.model ?? null,
        vin: requestContext.vehicle?.vin ?? "",
        year: requestContext.vehicle?.year ?? null
      }),
      fallbackMode
    }) as unknown as Json,
    vehicleContextJson: buildRepairLinkVehicleContext({
      engine: requestContext.vehicle?.engine ?? null,
      licensePlate: requestContext.vehicle?.licensePlate ?? null,
      make: requestContext.vehicle?.make ?? null,
      model: requestContext.vehicle?.model ?? null,
      vin: requestContext.vehicle?.vin ?? "",
      year: requestContext.vehicle?.year ?? null
    }) as unknown as Json
  });

  const existingQuoteLinesResult = await listProcurementProviderQuoteLinesByQuoteId(
    client,
    quote.id
  );

  if (existingQuoteLinesResult.error) {
    throw existingQuoteLinesResult.error;
  }

  const matchingManualLine = findMatchingManualProviderQuoteLine(
    existingQuoteLinesResult.data ?? [],
    {
      coreChargeCents: input.coreChargeCents ?? null,
      description: input.description,
      partNumber: input.partNumber ?? null,
      partRequestLineId: selectedRequestLine.id,
      providerLocationKey: mappingRowResult.data.provider_location_key ?? null,
      providerSupplierKey: mappingRowResult.data.provider_supplier_key,
      providerSupplierMappingId: mappingRowResult.data.id,
      providerSupplierName: mappingRowResult.data.provider_supplier_name,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents ?? null
    }
  );

  if (matchingManualLine) {
    const updatedQuoteLineResult = await updateProcurementProviderQuoteLine(
      client,
      matchingManualLine.id,
      {
        availabilityText: input.availabilityText ?? null,
        coreChargeCents: input.coreChargeCents ?? null,
        description: input.description,
        etaText: input.etaText ?? null,
        partNumber: input.partNumber ?? null,
        providerLocationKey: mappingRowResult.data.provider_location_key ?? null,
        providerSupplierKey: mappingRowResult.data.provider_supplier_key,
        providerSupplierMappingId: mappingRowResult.data.id,
        providerSupplierName: mappingRowResult.data.provider_supplier_name,
        quantity: input.quantity,
        rawResponseJson: {
          capturedManually: true,
          provider: REPAIRLINK_PROVIDER
        } as Json,
        unitPriceCents: input.unitPriceCents ?? null
      }
    );

    if (updatedQuoteLineResult.error || !updatedQuoteLineResult.data) {
      throw updatedQuoteLineResult.error ?? new Error("Manual RepairLink offer could not be updated.");
    }

    await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
      fallbackMode,
      loginUrl: REPAIRLINK_LOGIN_URL,
      provider: REPAIRLINK_PROVIDER
    });

    return updatedQuoteLineResult.data;
  }

  const quoteLineResult = await createProcurementProviderQuoteLine(client, {
    availabilityText: input.availabilityText ?? null,
    companyId: input.companyId,
    coreChargeCents: input.coreChargeCents ?? null,
    description: input.description,
    etaText: input.etaText ?? null,
    partNumber: input.partNumber ?? null,
    partRequestLineId: selectedRequestLine.id,
    providerLocationKey: mappingRowResult.data.provider_location_key ?? null,
    providerOfferKey: `manual-${randomUUID()}`,
    providerQuoteId: quote.id,
    providerSupplierKey: mappingRowResult.data.provider_supplier_key,
    providerSupplierMappingId: mappingRowResult.data.id,
    providerSupplierName: mappingRowResult.data.provider_supplier_name,
    quantity: input.quantity,
    rawResponseJson: {
      capturedManually: true,
      loginUrl: REPAIRLINK_LOGIN_URL,
      provider: REPAIRLINK_PROVIDER
    } as Json,
    selectedForCart: false,
    unitPriceCents: input.unitPriceCents ?? null
  });

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("Manual RepairLink offer could not be saved.");
  }

  await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
    fallbackMode,
    loginUrl: REPAIRLINK_LOGIN_URL,
    provider: REPAIRLINK_PROVIDER
  });

  return quoteLineResult.data;
}

export async function createManualAmazonBusinessQuoteLine(
  client: AppSupabaseClient,
  input: CreateManualAmazonBusinessQuoteLineInput
) {
  const { account } = await requireAmazonBusinessAccount(client, input.companyId);
  const requestContext = await getProviderRequestContext(client, input.requestId);
  const fallbackMode = getAmazonBusinessFallbackMode(toJsonObject(account.settingsJson));
  const selectedRequestLine = requestContext.routeableLines.find(
    (line) => line.id === input.partRequestLineId
  );

  if (!selectedRequestLine) {
    throw new Error(
      "This Amazon Business quote line can only be captured against supply lines that still need sourcing."
    );
  }

  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  const latestQuoteSearchContext = toJsonObject(latestQuoteResult.data?.quote.searchContextJson);
  const preservedSupplyListId =
    latestQuoteResult.data?.lines.length === 0 &&
    typeof latestQuoteSearchContext.supplyListId === "string"
      ? latestQuoteSearchContext.supplyListId
      : null;
  const preservedSearchTerms =
    latestQuoteResult.data?.lines.length === 0 &&
    Array.isArray(latestQuoteSearchContext.searchTerms)
      ? latestQuoteSearchContext.searchTerms.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : [];
  const effectiveSearchTerms =
    preservedSearchTerms.length > 0
      ? preservedSearchTerms
      : buildAmazonBusinessSearchTerms(requestContext.routeableLines);

  const quote = await ensureAmazonBusinessQuote(client, {
    companyId: input.companyId,
    estimateId: requestContext.request.request.estimateId,
    jobId: requestContext.request.request.jobId,
    metadataJson: {
      fallbackMode,
      handoff: buildAmazonBusinessHandoffMetadata({
        manualReason: "Amazon Business offer captured manually.",
        searchTerms: effectiveSearchTerms,
        supplyListId: preservedSupplyListId
      }),
      linkOutUrl: AMAZON_BUSINESS_LINK_URL,
      provider: AMAZON_BUSINESS_PROVIDER
    } as unknown as Json,
    partRequestId: requestContext.request.request.id,
    providerAccountId: account.id,
    requestedByUserId: input.requestedByUserId,
    searchContextJson: buildAmazonBusinessSearchContext({
      estimateId: requestContext.request.request.estimateId,
      fallbackMode,
      jobId: requestContext.request.request.jobId,
      lines: requestContext.routeableLines,
      requestId: requestContext.request.request.id,
      searchTerms: effectiveSearchTerms,
      selectedPartRequestLineIds: [input.partRequestLineId],
      supplyListId: preservedSupplyListId
    }) as unknown as Json,
    vehicleContextJson: {
      vin: requestContext.vehicle?.vin ?? null
    } as Json
  });

  const existingQuoteLinesResult = await listProcurementProviderQuoteLinesByQuoteId(
    client,
    quote.id
  );

  if (existingQuoteLinesResult.error) {
    throw existingQuoteLinesResult.error;
  }

  const matchingManualLine = findMatchingManualProviderQuoteLine(
    existingQuoteLinesResult.data ?? [],
    {
      coreChargeCents: null,
      description: input.description,
      partNumber: input.partNumber ?? null,
      partRequestLineId: input.partRequestLineId,
      providerLocationKey: null,
      providerProductKey: input.providerProductKey ?? null,
      providerSupplierKey: AMAZON_BUSINESS_PROVIDER,
      providerSupplierMappingId: null,
      providerSupplierName: buildAmazonBusinessDisplayName(account),
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents ?? null
    }
  );

  if (matchingManualLine) {
    const updatedQuoteLineResult = await updateProcurementProviderQuoteLine(
      client,
      matchingManualLine.id,
      {
        availabilityText: input.availabilityText ?? null,
        description: input.description,
        etaText: input.etaText ?? null,
        manufacturer: "Amazon Business",
        partNumber: input.partNumber ?? null,
        providerProductKey: input.providerProductKey ?? null,
        providerSupplierKey: AMAZON_BUSINESS_PROVIDER,
        providerSupplierName: buildAmazonBusinessDisplayName(account),
        quantity: input.quantity,
        rawResponseJson: {
          capturedManually: true,
          linkOutUrl: AMAZON_BUSINESS_LINK_URL,
          provider: AMAZON_BUSINESS_PROVIDER
        } as Json,
        unitPriceCents: input.unitPriceCents ?? null
      }
    );

    if (updatedQuoteLineResult.error || !updatedQuoteLineResult.data) {
      throw updatedQuoteLineResult.error ?? new Error("Manual Amazon Business offer could not be updated.");
    }

    await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
      fallbackMode,
      linkOutUrl: AMAZON_BUSINESS_LINK_URL,
      provider: AMAZON_BUSINESS_PROVIDER
    });

    return updatedQuoteLineResult.data;
  }

  const quoteLineResult = await createProcurementProviderQuoteLine(client, {
    availabilityText: input.availabilityText ?? null,
    companyId: input.companyId,
    description: input.description,
    etaText: input.etaText ?? null,
    manufacturer: "Amazon Business",
    partNumber: input.partNumber ?? null,
    partRequestLineId: input.partRequestLineId,
    providerOfferKey: input.providerProductKey?.trim() || `manual-${randomUUID()}`,
    providerProductKey: input.providerProductKey ?? null,
    providerQuoteId: quote.id,
    providerSupplierKey: AMAZON_BUSINESS_PROVIDER,
    providerSupplierName: buildAmazonBusinessDisplayName(account),
    quantity: input.quantity,
    rawResponseJson: {
      capturedManually: true,
      linkOutUrl: AMAZON_BUSINESS_LINK_URL,
      provider: AMAZON_BUSINESS_PROVIDER
    } as Json,
    selectedForCart: false,
    unitPriceCents: input.unitPriceCents ?? null
  });

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("Manual Amazon Business offer could not be saved.");
  }

  await updateProcurementProviderQuoteStatus(client, quote.id, "priced", {
    fallbackMode,
    linkOutUrl: AMAZON_BUSINESS_LINK_URL,
    provider: AMAZON_BUSINESS_PROVIDER
  });

  return quoteLineResult.data;
}

export function getAmazonBusinessFallbackModeFromSettings(
  account: Pick<ProcurementProviderAccount, "settingsJson"> | null | undefined
) {
  return getAmazonBusinessFallbackMode(toJsonObject(account?.settingsJson ?? null));
}

export async function convertAmazonBusinessQuoteLineToSupplierCart(
  client: AppSupabaseClient,
  input: {
    actorUserId: string;
    companyId: string;
    providerQuoteLineId: string;
  }
) {
  const { account } = await requireAmazonBusinessAccount(client, input.companyId);
  const quoteLineResult = await client
    .from("procurement_provider_quote_lines")
    .select("*")
    .eq("id", input.providerQuoteLineId)
    .single<ProcurementProviderQuoteLineRow>();

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("Amazon Business offer could not be loaded.");
  }

  const quoteResult = await client
    .from("procurement_provider_quotes")
    .select("*")
    .eq("id", quoteLineResult.data.provider_quote_id)
    .single<Database["public"]["Tables"]["procurement_provider_quotes"]["Row"]>();

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("Provider quote session could not be loaded.");
  }

  if (quoteResult.data.provider_account_id !== account.id) {
    throw new Error(
      "This Amazon Business quote line does not belong to the active Amazon Business account."
    );
  }

  const existingCartLineResult = await client
    .from("supplier_cart_lines")
    .select("id")
    .eq("provider_quote_line_id", quoteLineResult.data.id)
    .maybeSingle<{ id: string }>();

  if (existingCartLineResult.error) {
    throw existingCartLineResult.error;
  }

  if (existingCartLineResult.data) {
    return existingCartLineResult.data.id;
  }

  const supplierAccountId = getAmazonBusinessDefaultSupplierAccountId(account.settingsJson);

  if (!supplierAccountId) {
    throw new Error(
      "Amazon Business needs a default supplier account before supply offers can convert into supplier carts."
    );
  }

  const fallbackMode = getAmazonBusinessFallbackMode(
    toJsonObject(quoteResult.data.search_context_json)
  );
  const cartResult = await findOrCreateOpenSupplierCart(
    client,
    input.companyId,
    supplierAccountId,
    `amazon-business:${account.id}`,
    input.actorUserId
  );

  if (cartResult.error || !cartResult.data) {
    throw cartResult.error ?? new Error("Supplier cart could not be created.");
  }

  const addCartLineResult = await addSupplierCartLine(client, cartResult.data.id, {
    availabilityText: quoteLineResult.data.availability_text,
    companyId: input.companyId,
    jobId: quoteResult.data.job_id,
    notes: `Amazon Business offer ${quoteLineResult.data.provider_product_key ?? quoteLineResult.data.provider_offer_key}`,
    partRequestLineId: quoteLineResult.data.part_request_line_id,
    providerQuoteLineId: quoteLineResult.data.id,
    quantity: Number(quoteLineResult.data.quantity),
    quotedCoreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
    quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
    supplierAccountId,
    supplierPartNumber:
      quoteLineResult.data.part_number ?? quoteLineResult.data.provider_product_key,
    supplierUrl: AMAZON_BUSINESS_LINK_URL
  });

  if (addCartLineResult.error || !addCartLineResult.data) {
    throw addCartLineResult.error ?? new Error("Supplier cart line could not be created.");
  }

  const requestLineResult = await client
    .from("part_request_lines")
    .select("manufacturer, notes, part_number, supplier_sku")
    .eq("id", quoteLineResult.data.part_request_line_id)
    .maybeSingle<{
      manufacturer: string | null;
      notes: string | null;
      part_number: string | null;
      supplier_sku: string | null;
    }>();

  if (requestLineResult.error) {
    throw requestLineResult.error;
  }

  const resolvedManufacturer =
    quoteLineResult.data.manufacturer &&
    quoteLineResult.data.manufacturer.trim() &&
    quoteLineResult.data.manufacturer !== "Amazon Business"
      ? quoteLineResult.data.manufacturer
      : requestLineResult.data?.manufacturer ?? null;
  const resolvedPartNumber =
    quoteLineResult.data.part_number?.trim() || requestLineResult.data?.part_number || null;
  const resolvedSupplierSku = requestLineResult.data?.supplier_sku ?? null;

  await Promise.all([
    updateProcurementProviderQuoteLineSelection(client, quoteLineResult.data.id, true),
    updatePartRequestLine(client, quoteLineResult.data.part_request_line_id, {
      coreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
      description: quoteLineResult.data.description,
      lastSupplierAccountId: supplierAccountId,
      manufacturer: resolvedManufacturer,
      notes: requestLineResult.data?.notes ?? null,
      partNumber: resolvedPartNumber,
      quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
      status: "quoted",
      supplierSku: resolvedSupplierSku
    })
  ]);

  await Promise.all([
    writeBackPartCostsToEstimate(client, [quoteLineResult.data.part_request_line_id]),
    writeBackPartCostsToInvoice(client, [quoteLineResult.data.part_request_line_id])
  ]);

  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: quoteResult.data.part_request_id,
    providerAccountId: quoteResult.data.provider_account_id
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (latestQuoteResult.data) {
    await updateProcurementProviderQuoteStatus(
      client,
      latestQuoteResult.data.quote.id,
      getQuoteStatusForConvertedLines(latestQuoteResult.data.lines),
      {
        fallbackMode,
        linkOutUrl: AMAZON_BUSINESS_LINK_URL,
        provider: AMAZON_BUSINESS_PROVIDER
      }
    );
  }

  return addCartLineResult.data.id;
}

export async function convertPartsTechQuoteLineToSupplierCart(
  client: AppSupabaseClient,
  input: {
    actorUserId: string;
    companyId: string;
    providerQuoteLineId: string;
  }
) {
  const quoteLineResult = await client
    .from("procurement_provider_quote_lines")
    .select("*")
    .eq("id", input.providerQuoteLineId)
    .single<ProcurementProviderQuoteLineRow>();

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("PartsTech offer could not be loaded.");
  }

  const quoteResult = await client
    .from("procurement_provider_quotes")
    .select("*")
    .eq("id", quoteLineResult.data.provider_quote_id)
    .single<Database["public"]["Tables"]["procurement_provider_quotes"]["Row"]>();

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("Provider quote session could not be loaded.");
  }

  const existingCartLineResult = await client
    .from("supplier_cart_lines")
    .select("id")
    .eq("provider_quote_line_id", quoteLineResult.data.id)
    .maybeSingle<{ id: string }>();

  if (existingCartLineResult.error) {
    throw existingCartLineResult.error;
  }

  if (existingCartLineResult.data) {
    return existingCartLineResult.data.id;
  }

  if (!quoteLineResult.data.provider_supplier_mapping_id) {
    throw new Error(
      "Map this PartsTech supplier to an internal supplier account before converting the offer into a supplier cart."
    );
  }

  const mappingResult = await client
    .from("procurement_provider_supplier_mappings")
    .select("*")
    .eq("id", quoteLineResult.data.provider_supplier_mapping_id)
    .single<ProcurementProviderSupplierMappingRow>();

  if (mappingResult.error || !mappingResult.data) {
    throw mappingResult.error ?? new Error("Provider supplier mapping could not be loaded.");
  }

  if (["disabled", "unmapped"].includes(mappingResult.data.status)) {
    throw new Error(
      "This PartsTech supplier mapping is not active. Update the mapping before creating a supplier cart."
    );
  }

  const cartResult = await findOrCreateOpenSupplierCart(
    client,
    input.companyId,
    mappingResult.data.supplier_account_id,
    `partstech:${quoteLineResult.data.provider_supplier_key}:${mappingResult.data.id}`,
    input.actorUserId
  );

  if (cartResult.error || !cartResult.data) {
    throw cartResult.error ?? new Error("Supplier cart could not be created.");
  }

  const addCartLineResult = await addSupplierCartLine(client, cartResult.data.id, {
    availabilityText: quoteLineResult.data.availability_text,
    companyId: input.companyId,
    jobId: quoteResult.data.job_id,
    notes: `PartsTech offer ${quoteLineResult.data.provider_offer_key}`,
    partRequestLineId: quoteLineResult.data.part_request_line_id,
    providerQuoteLineId: quoteLineResult.data.id,
    quantity: Number(quoteLineResult.data.quantity),
    quotedCoreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
    quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
    supplierAccountId: mappingResult.data.supplier_account_id,
    supplierPartNumber: quoteLineResult.data.part_number,
    supplierUrl: null
  });

  if (addCartLineResult.error || !addCartLineResult.data) {
    throw addCartLineResult.error ?? new Error("Supplier cart line could not be created.");
  }

  await Promise.all([
    updateProcurementProviderQuoteLineSelection(client, quoteLineResult.data.id, true),
    updatePartRequestLine(client, quoteLineResult.data.part_request_line_id, {
      coreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
      description: quoteLineResult.data.description,
      lastSupplierAccountId: mappingResult.data.supplier_account_id,
      manufacturer: quoteLineResult.data.manufacturer,
      notes: null,
      partNumber: quoteLineResult.data.part_number,
      quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
      status: "quoted",
      supplierSku: null
    })
  ]);

  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: quoteResult.data.part_request_id,
    providerAccountId: quoteResult.data.provider_account_id
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (latestQuoteResult.data) {
    await updateProcurementProviderQuoteStatus(
      client,
      latestQuoteResult.data.quote.id,
      getQuoteStatusForConvertedLines(latestQuoteResult.data.lines),
      {
        fallbackMode: "manual_capture",
        provider: PARTSTECH_PROVIDER
      }
    );
  }

  return addCartLineResult.data.id;
}

export async function convertRepairLinkQuoteLineToSupplierCart(
  client: AppSupabaseClient,
  input: {
    actorUserId: string;
    companyId: string;
    providerQuoteLineId: string;
  }
) {
  const quoteLineResult = await client
    .from("procurement_provider_quote_lines")
    .select("*")
    .eq("id", input.providerQuoteLineId)
    .single<ProcurementProviderQuoteLineRow>();

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("RepairLink offer could not be loaded.");
  }

  const quoteResult = await client
    .from("procurement_provider_quotes")
    .select("*")
    .eq("id", quoteLineResult.data.provider_quote_id)
    .single<Database["public"]["Tables"]["procurement_provider_quotes"]["Row"]>();

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("Provider quote session could not be loaded.");
  }
  const fallbackMode = getRepairLinkFallbackMode(quoteResult.data.search_context_json);

  const existingCartLineResult = await client
    .from("supplier_cart_lines")
    .select("id")
    .eq("provider_quote_line_id", quoteLineResult.data.id)
    .maybeSingle<{ id: string }>();

  if (existingCartLineResult.error) {
    throw existingCartLineResult.error;
  }

  if (existingCartLineResult.data) {
    return existingCartLineResult.data.id;
  }

  if (!quoteLineResult.data.provider_supplier_mapping_id) {
    throw new Error(
      "Map this RepairLink dealer to an internal supplier account before converting the OEM offer into a supplier cart."
    );
  }

  const mappingResult = await client
    .from("procurement_provider_supplier_mappings")
    .select("*")
    .eq("id", quoteLineResult.data.provider_supplier_mapping_id)
    .single<ProcurementProviderSupplierMappingRow>();

  if (mappingResult.error || !mappingResult.data) {
    throw mappingResult.error ?? new Error("Provider dealer mapping could not be loaded.");
  }

  if (["disabled", "unmapped"].includes(mappingResult.data.status) || !mappingResult.data.supports_quote) {
    throw new Error(
      "This RepairLink dealer mapping is not active for quote conversion. Update the mapping before creating a supplier cart."
    );
  }

  const cartResult = await findOrCreateOpenSupplierCart(
    client,
    input.companyId,
    mappingResult.data.supplier_account_id,
    `repairlink:${quoteLineResult.data.provider_supplier_key}:${mappingResult.data.id}`,
    input.actorUserId
  );

  if (cartResult.error || !cartResult.data) {
    throw cartResult.error ?? new Error("Supplier cart could not be created.");
  }

  const addCartLineResult = await addSupplierCartLine(client, cartResult.data.id, {
    availabilityText: quoteLineResult.data.availability_text,
    companyId: input.companyId,
    jobId: quoteResult.data.job_id,
    notes: `RepairLink offer ${quoteLineResult.data.provider_offer_key}`,
    partRequestLineId: quoteLineResult.data.part_request_line_id,
    providerQuoteLineId: quoteLineResult.data.id,
    quantity: Number(quoteLineResult.data.quantity),
    quotedCoreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
    quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
    supplierAccountId: mappingResult.data.supplier_account_id,
    supplierPartNumber: quoteLineResult.data.part_number,
    supplierUrl: REPAIRLINK_LOGIN_URL
  });

  if (addCartLineResult.error || !addCartLineResult.data) {
    throw addCartLineResult.error ?? new Error("Supplier cart line could not be created.");
  }

  await Promise.all([
    updateProcurementProviderQuoteLineSelection(client, quoteLineResult.data.id, true),
    updatePartRequestLine(client, quoteLineResult.data.part_request_line_id, {
      coreChargeCents: quoteLineResult.data.core_charge_cents ?? 0,
      description: quoteLineResult.data.description,
      lastSupplierAccountId: mappingResult.data.supplier_account_id,
      manufacturer: quoteLineResult.data.manufacturer,
      notes: null,
      partNumber: quoteLineResult.data.part_number,
      quotedUnitCostCents: quoteLineResult.data.unit_price_cents,
      status: "quoted",
      supplierSku: null
    })
  ]);

  const latestQuoteResult = await getLatestProcurementProviderQuoteByRequestAndAccount(client, {
    partRequestId: quoteResult.data.part_request_id,
    providerAccountId: quoteResult.data.provider_account_id
  });

  if (latestQuoteResult.error) {
    throw latestQuoteResult.error;
  }

  if (latestQuoteResult.data) {
    await updateProcurementProviderQuoteStatus(
      client,
      latestQuoteResult.data.quote.id,
      getQuoteStatusForConvertedLines(latestQuoteResult.data.lines),
      {
        fallbackMode,
        loginUrl: REPAIRLINK_LOGIN_URL,
        provider: REPAIRLINK_PROVIDER
      }
    );
  }

  return addCartLineResult.data.id;
}

export async function getPurchaseOrderProviderWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  purchaseOrderId: string
): Promise<PartsTechPurchaseOrderWorkspace> {
  const [accountResult, purchaseOrderResult, existingOrdersResult] = await Promise.all([
    getProcurementProviderAccountByProvider(client, companyId, PARTSTECH_PROVIDER),
    getPurchaseOrderById(client, purchaseOrderId),
    listProcurementProviderOrdersByPurchaseOrderId(client, purchaseOrderId)
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }
  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }
  if (existingOrdersResult.error) {
    throw existingOrdersResult.error;
  }

  const supplierCartLineIds = purchaseOrderResult.data.lines
    .map((line) => line.supplierCartLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const supplierCartLineResult = supplierCartLineIds.length
    ? await client
        .from("supplier_cart_lines")
        .select("id, provider_quote_line_id")
        .in("id", supplierCartLineIds)
        .returns<Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>>()
    : {
        data: [] as Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>,
        error: null
      };

  if (supplierCartLineResult.error) {
    throw supplierCartLineResult.error;
  }

  const providerQuoteLineIdBySupplierCartLineId = new Map(
    (supplierCartLineResult.data ?? []).map((line) => [line.id, line.provider_quote_line_id])
  );

  return {
    account: accountResult.data ?? null,
    linkedLineCount: purchaseOrderResult.data.lines.filter((line) =>
      Boolean(
        line.supplierCartLineId
          ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
          : null
      )
    ).length,
    linkedPurchaseOrderLines: purchaseOrderResult.data.lines
      .map((line) => ({
        description: line.description,
        id: line.id,
        partNumber: line.partNumber,
        providerQuoteLineId:
          (line.supplierCartLineId
            ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
            : null) ?? null,
        quantityOrdered: line.quantityOrdered,
        supplierPartNumber: line.supplierPartNumber,
        unitOrderedCostCents: line.unitOrderedCostCents
      }))
      .filter((line): line is PartsTechPurchaseOrderWorkspace["linkedPurchaseOrderLines"][number] =>
        Boolean(line.providerQuoteLineId)
      ),
    orders: existingOrdersResult.data ?? []
  };
}

export async function getAmazonBusinessPurchaseOrderWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  purchaseOrderId: string
): Promise<AmazonBusinessPurchaseOrderWorkspace> {
  const [accountResult, purchaseOrderResult, existingOrdersResult] = await Promise.all([
    getProcurementProviderAccountByProvider(client, companyId, AMAZON_BUSINESS_PROVIDER),
    getPurchaseOrderById(client, purchaseOrderId),
    listProcurementProviderOrdersByPurchaseOrderId(client, purchaseOrderId)
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }
  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }
  if (existingOrdersResult.error) {
    throw existingOrdersResult.error;
  }

  const supplierCartLineIds = purchaseOrderResult.data.lines
    .map((line) => line.supplierCartLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const supplierCartLineResult = supplierCartLineIds.length
    ? await client
        .from("supplier_cart_lines")
        .select("id, provider_quote_line_id")
        .in("id", supplierCartLineIds)
        .returns<Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>>()
    : {
        data: [] as Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>,
        error: null
      };

  if (supplierCartLineResult.error) {
    throw supplierCartLineResult.error;
  }

  const providerQuoteLineIds = (supplierCartLineResult.data ?? [])
    .map((line) => line.provider_quote_line_id)
    .filter((lineId): lineId is string => Boolean(lineId));
  const providerQuoteLinesResult = providerQuoteLineIds.length
    ? await client
        .from("procurement_provider_quote_lines")
        .select("id, provider_quote_id")
        .in("id", providerQuoteLineIds)
        .returns<Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>>()
    : {
        data: [] as Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>,
        error: null
      };

  if (providerQuoteLinesResult.error) {
    throw providerQuoteLinesResult.error;
  }

  const providerQuoteIds = [
    ...new Set((providerQuoteLinesResult.data ?? []).map((line) => line.provider_quote_id))
  ];
  const providerQuotesResult = providerQuoteIds.length
    ? await client
        .from("procurement_provider_quotes")
        .select("id, provider_account_id")
        .in("id", providerQuoteIds)
        .returns<
          Array<
            Pick<
              Database["public"]["Tables"]["procurement_provider_quotes"]["Row"],
              "id" | "provider_account_id"
            >
          >
        >()
    : {
        data: [] as Array<
          Pick<
            Database["public"]["Tables"]["procurement_provider_quotes"]["Row"],
            "id" | "provider_account_id"
          >
        >,
        error: null
      };

  if (providerQuotesResult.error) {
    throw providerQuotesResult.error;
  }

  const providerAccountIdByQuoteId = new Map(
    (providerQuotesResult.data ?? []).map((quote) => [quote.id, quote.provider_account_id])
  );
  const providerQuoteLineIdBySupplierCartLineId = new Map(
    (supplierCartLineResult.data ?? [])
      .map((line) => {
        const quoteLine = (providerQuoteLinesResult.data ?? []).find(
          (quoteLineRow) => quoteLineRow.id === line.provider_quote_line_id
        );
        const providerAccountId = quoteLine
          ? providerAccountIdByQuoteId.get(quoteLine.provider_quote_id)
          : null;

        if (!line.provider_quote_line_id || providerAccountId !== accountResult.data?.id) {
          return null;
        }

        return [line.id, line.provider_quote_line_id] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );

  return {
    account: accountResult.data ?? null,
    linkedLineCount: purchaseOrderResult.data.lines.filter((line) =>
      Boolean(
        line.supplierCartLineId
          ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
          : null
      )
    ).length,
    linkedPurchaseOrderLines: purchaseOrderResult.data.lines
      .map((line) => ({
        description: line.description,
        id: line.id,
        partNumber: line.partNumber,
        providerQuoteLineId:
          (line.supplierCartLineId
            ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
            : null) ?? null,
        quantityOrdered: line.quantityOrdered,
        supplierPartNumber: line.supplierPartNumber,
        unitOrderedCostCents: line.unitOrderedCostCents
      }))
      .filter(
        (
          line
        ): line is AmazonBusinessPurchaseOrderWorkspace["linkedPurchaseOrderLines"][number] =>
          Boolean(line.providerQuoteLineId)
      ),
    orders: (existingOrdersResult.data ?? []).filter(
      (entry) => entry.order.providerAccountId === accountResult.data?.id
    )
  };
}

export async function submitPurchaseOrderViaPartsTech(
  client: AppSupabaseClient,
  input: SubmitProviderPurchaseOrderInput
) {
  const { account, adapter, rawAccountRow } = await requirePartsTechAccount(
    client,
    input.companyId
  );
  const [purchaseOrderWorkspace, purchaseOrderResult] = await Promise.all([
    getPurchaseOrderProviderWorkspace(client, input.companyId, input.purchaseOrderId),
    getPurchaseOrderById(client, input.purchaseOrderId)
  ]);

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }

  if (!purchaseOrderWorkspace.linkedPurchaseOrderLines.length) {
    throw new Error(
      "This purchase order does not include any PartsTech-linked lines. Convert a PartsTech offer into a supplier cart before recording a provider order."
    );
  }

  const existingOrder = purchaseOrderWorkspace.orders.find(
    (entry) => entry.order.providerAccountId === account.id
  );

  if (existingOrder) {
    return existingOrder;
  }

  const quoteLineIds = purchaseOrderWorkspace.linkedPurchaseOrderLines
    .map((line) => line.providerQuoteLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const quoteLinesResult = quoteLineIds.length
    ? await client
        .from("procurement_provider_quote_lines")
        .select("id, provider_quote_id")
        .in("id", quoteLineIds)
        .returns<Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>>()
    : {
        data: [] as Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>,
        error: null
      };

  if (quoteLinesResult.error) {
    throw quoteLinesResult.error;
  }

  const providerQuoteIds = [
    ...new Set((quoteLinesResult.data ?? []).map((line) => line.provider_quote_id))
  ];

  if (!providerQuoteIds.length) {
    throw new Error("Provider-linked purchase-order lines are missing their quote provenance.");
  }

  const providerQuotesResult = await client
    .from("procurement_provider_quotes")
    .select("id, provider_account_id")
    .in("id", providerQuoteIds)
    .returns<Array<Pick<Database["public"]["Tables"]["procurement_provider_quotes"]["Row"], "id" | "provider_account_id">>>();

  if (providerQuotesResult.error) {
    throw providerQuotesResult.error;
  }

  if ((providerQuotesResult.data ?? []).length !== providerQuoteIds.length) {
    throw new Error("One or more PartsTech quote sessions could not be loaded for this PO.");
  }

  const hasMismatchedProviderAccount = (providerQuotesResult.data ?? []).some(
    (quote) => quote.provider_account_id !== account.id
  );

  if (hasMismatchedProviderAccount) {
    throw new Error(
      "This purchase order includes provider-linked lines from a different integration account."
    );
  }

  const providerQuoteId = providerQuoteIds.length === 1 ? providerQuoteIds[0] : null;
  const submissionResult = await adapter.submitOrder({
    account: buildPartsTechAdapterAccount(rawAccountRow),
    purchaseOrder: {
      id: purchaseOrderResult.data.purchaseOrder.id,
      poNumber: purchaseOrderResult.data.purchaseOrder.poNumber,
      supplierAccountId: purchaseOrderResult.data.purchaseOrder.supplierAccountId
    },
    purchaseOrderLines: purchaseOrderWorkspace.linkedPurchaseOrderLines
  });

  const providerOrderResult = await createProcurementProviderOrder(client, {
    companyId: input.companyId,
    providerAccountId: account.id,
    providerQuoteId,
    purchaseOrderId: input.purchaseOrderId,
    status: submissionResult.status,
    providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
    submittedAt: new Date().toISOString(),
    responseReceivedAt: new Date().toISOString(),
    manualFallbackReason: submissionResult.manualFallbackReason ?? null,
    rawRequestJson: {
      ...toJsonObject(submissionResult.rawRequestJson),
      manualReference: input.manualReference ?? null,
      notes: input.notes ?? null
    } as Json,
    rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
    lastErrorMessage: submissionResult.lastErrorMessage ?? null
  });

  if (providerOrderResult.error || !providerOrderResult.data) {
    throw providerOrderResult.error ?? new Error("Provider order could not be recorded.");
  }

  for (const lineResult of submissionResult.lineResults) {
    const createLineResult = await createProcurementProviderOrderLine(client, {
      companyId: input.companyId,
      providerOrderId: providerOrderResult.data.id,
      providerLineReference: lineResult.providerLineReference ?? null,
      providerQuoteLineId: lineResult.providerQuoteLineId ?? null,
      purchaseOrderLineId: lineResult.purchaseOrderLineId,
      quantity: lineResult.quantity,
        rawResponseJson: (lineResult.rawResponseJson ?? {}) as Json,
        unitPriceCents: lineResult.unitPriceCents ?? null
      });

    if (createLineResult.error) {
      throw createLineResult.error;
    }
  }

  for (const linkedProviderQuoteId of providerQuoteIds) {
    await updateProcurementProviderQuoteStatus(client, linkedProviderQuoteId, "converted", {
      convertedPurchaseOrderId: input.purchaseOrderId,
      fallbackMode: submissionResult.status === "manual_required" ? "manual_order" : "provider_order",
      provider: PARTSTECH_PROVIDER
    });
  }

  const updatedOrderResult = await updateProcurementProviderOrderStatus(
    client,
    providerOrderResult.data.id,
    {
      lastErrorMessage: submissionResult.lastErrorMessage ?? null,
      manualFallbackReason: submissionResult.manualFallbackReason ?? null,
      providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
      rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
      responseReceivedAt: new Date().toISOString(),
      status: submissionResult.status,
      submittedAt: new Date().toISOString()
    }
  );

  if (updatedOrderResult.error || !updatedOrderResult.data) {
    throw updatedOrderResult.error ?? new Error("Provider order status could not be updated.");
  }

  const ordersResult = await listProcurementProviderOrdersByPurchaseOrderId(
    client,
    input.purchaseOrderId
  );

  if (ordersResult.error) {
    throw ordersResult.error;
  }

  const persistedOrder = updatedOrderResult.data;
  const updatedOrder = (ordersResult.data ?? []).find(
    (entry) => entry.order.id === persistedOrder.id
  );

  return updatedOrder ?? {
    lines: [],
    order: persistedOrder
  };
}

export async function submitPurchaseOrderViaAmazonBusiness(
  client: AppSupabaseClient,
  input: SubmitAmazonBusinessPurchaseOrderInput
) {
  const { account, adapter, rawAccountRow } = await requireAmazonBusinessAccount(
    client,
    input.companyId
  );
  const [purchaseOrderWorkspace, purchaseOrderResult] = await Promise.all([
    getAmazonBusinessPurchaseOrderWorkspace(client, input.companyId, input.purchaseOrderId),
    getPurchaseOrderById(client, input.purchaseOrderId)
  ]);

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }

  if (!purchaseOrderWorkspace.linkedPurchaseOrderLines.length) {
    throw new Error(
      "This purchase order does not include any Amazon Business-linked lines. Convert an Amazon Business supply offer into a supplier cart before recording provider order provenance."
    );
  }

  const existingOrder = purchaseOrderWorkspace.orders.find(
    (entry) => entry.order.providerAccountId === account.id
  );

  if (existingOrder) {
    return existingOrder;
  }

  const quoteLineIds = purchaseOrderWorkspace.linkedPurchaseOrderLines
    .map((line) => line.providerQuoteLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const quoteLinesResult = quoteLineIds.length
    ? await client
        .from("procurement_provider_quote_lines")
        .select("id, provider_quote_id")
        .in("id", quoteLineIds)
        .returns<Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>>()
    : {
        data: [] as Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>,
        error: null
      };

  if (quoteLinesResult.error) {
    throw quoteLinesResult.error;
  }

  const providerQuoteIds = [
    ...new Set((quoteLinesResult.data ?? []).map((line) => line.provider_quote_id))
  ];

  if (!providerQuoteIds.length) {
    throw new Error("Provider-linked purchase-order lines are missing their quote provenance.");
  }

  const providerQuotesResult = await client
    .from("procurement_provider_quotes")
    .select("id, provider_account_id")
    .in("id", providerQuoteIds)
    .returns<
      Array<
        Pick<
          Database["public"]["Tables"]["procurement_provider_quotes"]["Row"],
          "id" | "provider_account_id"
        >
      >
    >();

  if (providerQuotesResult.error) {
    throw providerQuotesResult.error;
  }

  if ((providerQuotesResult.data ?? []).length !== providerQuoteIds.length) {
    throw new Error("One or more Amazon Business quote sessions could not be loaded for this PO.");
  }

  const hasMismatchedProviderAccount = (providerQuotesResult.data ?? []).some(
    (quote) => quote.provider_account_id !== account.id
  );

  if (hasMismatchedProviderAccount) {
    throw new Error(
      "This purchase order includes provider-linked lines from a different integration account."
    );
  }

  const providerQuoteId = providerQuoteIds.length === 1 ? providerQuoteIds[0] : null;
  const submissionResult = await adapter.submitOrder({
    account: buildAmazonBusinessAdapterAccount(rawAccountRow),
    purchaseOrder: {
      id: purchaseOrderResult.data.purchaseOrder.id,
      poNumber: purchaseOrderResult.data.purchaseOrder.poNumber,
      supplierAccountId: purchaseOrderResult.data.purchaseOrder.supplierAccountId
    },
    purchaseOrderLines: purchaseOrderWorkspace.linkedPurchaseOrderLines
  });

  const providerOrderResult = await createProcurementProviderOrder(client, {
    companyId: input.companyId,
    providerAccountId: account.id,
    providerQuoteId,
    purchaseOrderId: input.purchaseOrderId,
    status: submissionResult.status,
    providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
    submittedAt: new Date().toISOString(),
    responseReceivedAt: new Date().toISOString(),
    manualFallbackReason: submissionResult.manualFallbackReason ?? null,
    rawRequestJson: {
      ...toJsonObject(submissionResult.rawRequestJson),
      manualReference: input.manualReference ?? null,
      notes: input.notes ?? null
    } as Json,
    rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
    lastErrorMessage: submissionResult.lastErrorMessage ?? null
  });

  if (providerOrderResult.error || !providerOrderResult.data) {
    throw providerOrderResult.error ?? new Error("Provider order could not be recorded.");
  }

  for (const lineResult of submissionResult.lineResults) {
    const createLineResult = await createProcurementProviderOrderLine(client, {
      companyId: input.companyId,
      providerOrderId: providerOrderResult.data.id,
      providerLineReference: lineResult.providerLineReference ?? null,
      providerQuoteLineId: lineResult.providerQuoteLineId ?? null,
      purchaseOrderLineId: lineResult.purchaseOrderLineId,
      quantity: lineResult.quantity,
      rawResponseJson: (lineResult.rawResponseJson ?? {}) as Json,
      unitPriceCents: lineResult.unitPriceCents ?? null
    });

    if (createLineResult.error) {
      throw createLineResult.error;
    }
  }

  for (const linkedProviderQuoteId of providerQuoteIds) {
    await updateProcurementProviderQuoteStatus(client, linkedProviderQuoteId, "converted", {
      convertedPurchaseOrderId: input.purchaseOrderId,
      fallbackMode:
        submissionResult.status === "manual_required" ? "manual_order" : "provider_order",
      linkOutUrl: AMAZON_BUSINESS_LINK_URL,
      provider: AMAZON_BUSINESS_PROVIDER
    });
  }

  const updatedOrderResult = await updateProcurementProviderOrderStatus(
    client,
    providerOrderResult.data.id,
    {
      lastErrorMessage: submissionResult.lastErrorMessage ?? null,
      manualFallbackReason: submissionResult.manualFallbackReason ?? null,
      providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
      rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
      responseReceivedAt: new Date().toISOString(),
      status: submissionResult.status,
      submittedAt: new Date().toISOString()
    }
  );

  if (updatedOrderResult.error || !updatedOrderResult.data) {
    throw updatedOrderResult.error ?? new Error("Provider order status could not be updated.");
  }

  const ordersResult = await listProcurementProviderOrdersByPurchaseOrderId(
    client,
    input.purchaseOrderId
  );

  if (ordersResult.error) {
    throw ordersResult.error;
  }

  const persistedOrder = updatedOrderResult.data;
  const updatedOrder = (ordersResult.data ?? []).find(
    (entry) => entry.order.id === persistedOrder.id
  );

  return updatedOrder ?? {
    lines: [],
    order: persistedOrder
  };
}

export async function getRepairLinkPurchaseOrderWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  purchaseOrderId: string
): Promise<RepairLinkPurchaseOrderWorkspace> {
  const [accountResult, purchaseOrderResult, existingOrdersResult] = await Promise.all([
    getProcurementProviderAccountByProvider(client, companyId, REPAIRLINK_PROVIDER),
    getPurchaseOrderById(client, purchaseOrderId),
    listProcurementProviderOrdersByPurchaseOrderId(client, purchaseOrderId)
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }
  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }
  if (existingOrdersResult.error) {
    throw existingOrdersResult.error;
  }

  const supplierCartLineIds = purchaseOrderResult.data.lines
    .map((line) => line.supplierCartLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const supplierCartLineResult = supplierCartLineIds.length
    ? await client
        .from("supplier_cart_lines")
        .select("id, provider_quote_line_id")
        .in("id", supplierCartLineIds)
        .returns<Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>>()
    : {
        data: [] as Array<Pick<SupplierCartLineRow, "id" | "provider_quote_line_id">>,
        error: null
      };

  if (supplierCartLineResult.error) {
    throw supplierCartLineResult.error;
  }

  const providerQuoteLineIdBySupplierCartLineId = new Map(
    (supplierCartLineResult.data ?? []).map((line) => [line.id, line.provider_quote_line_id])
  );

  return {
    account: accountResult.data ?? null,
    linkedLineCount: purchaseOrderResult.data.lines.filter((line) =>
      Boolean(
        line.supplierCartLineId
          ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
          : null
      )
    ).length,
    linkedPurchaseOrderLines: purchaseOrderResult.data.lines
      .map((line) => ({
        description: line.description,
        id: line.id,
        partNumber: line.partNumber,
        providerQuoteLineId:
          (line.supplierCartLineId
            ? providerQuoteLineIdBySupplierCartLineId.get(line.supplierCartLineId)
            : null) ?? null,
        quantityOrdered: line.quantityOrdered,
        supplierPartNumber: line.supplierPartNumber,
        unitOrderedCostCents: line.unitOrderedCostCents
      }))
      .filter(
        (
          line
        ): line is RepairLinkPurchaseOrderWorkspace["linkedPurchaseOrderLines"][number] =>
          Boolean(line.providerQuoteLineId)
      ),
    orders: (existingOrdersResult.data ?? []).filter(
      (entry) => entry.order.providerAccountId === accountResult.data?.id
    )
  };
}

export function getRepairLinkFallbackModeFromSettings(
  account: Pick<ProcurementProviderAccount, "settingsJson"> | null | undefined
) {
  return getRepairLinkFallbackMode(account?.settingsJson ?? null);
}

export function getRepairLinkPreferredDealerIdsFromSettings(
  account: Pick<ProcurementProviderAccount, "settingsJson"> | null | undefined
) {
  return getRepairLinkPreferredDealerMappingIds(account?.settingsJson ?? null);
}

export async function submitPurchaseOrderViaRepairLink(
  client: AppSupabaseClient,
  input: SubmitProviderPurchaseOrderInput
) {
  const { account, adapter, rawAccountRow } = await requireRepairLinkAccount(
    client,
    input.companyId
  );
  const [purchaseOrderWorkspace, purchaseOrderResult] = await Promise.all([
    getRepairLinkPurchaseOrderWorkspace(client, input.companyId, input.purchaseOrderId),
    getPurchaseOrderById(client, input.purchaseOrderId)
  ]);

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order could not be loaded.");
  }

  if (!purchaseOrderWorkspace.linkedPurchaseOrderLines.length) {
    throw new Error(
      "This purchase order does not include any RepairLink-linked lines. Convert a RepairLink OEM quote into a supplier cart before recording a provider order."
    );
  }

  const existingOrder = purchaseOrderWorkspace.orders.find(
    (entry) => entry.order.providerAccountId === account.id
  );

  if (existingOrder) {
    return existingOrder;
  }

  const quoteLineIds = purchaseOrderWorkspace.linkedPurchaseOrderLines
    .map((line) => line.providerQuoteLineId)
    .filter((lineId): lineId is string => Boolean(lineId));
  const quoteLinesResult = quoteLineIds.length
    ? await client
        .from("procurement_provider_quote_lines")
        .select("id, provider_quote_id")
        .in("id", quoteLineIds)
        .returns<Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>>()
    : {
        data: [] as Array<Pick<ProcurementProviderQuoteLineRow, "id" | "provider_quote_id">>,
        error: null
      };

  if (quoteLinesResult.error) {
    throw quoteLinesResult.error;
  }

  const providerQuoteIds = [
    ...new Set((quoteLinesResult.data ?? []).map((line) => line.provider_quote_id))
  ];

  if (!providerQuoteIds.length) {
    throw new Error("Provider-linked purchase-order lines are missing their quote provenance.");
  }

  const providerQuotesResult = await client
    .from("procurement_provider_quotes")
    .select("id, provider_account_id")
    .in("id", providerQuoteIds)
    .returns<
      Array<
        Pick<
          Database["public"]["Tables"]["procurement_provider_quotes"]["Row"],
          "id" | "provider_account_id"
        >
      >
    >();

  if (providerQuotesResult.error) {
    throw providerQuotesResult.error;
  }

  if ((providerQuotesResult.data ?? []).length !== providerQuoteIds.length) {
    throw new Error("One or more RepairLink quote sessions could not be loaded for this PO.");
  }

  const hasMismatchedProviderAccount = (providerQuotesResult.data ?? []).some(
    (quote) => quote.provider_account_id !== account.id
  );

  if (hasMismatchedProviderAccount) {
    throw new Error(
      "This purchase order includes provider-linked lines from a different integration account."
    );
  }

  const providerQuoteId = providerQuoteIds.length === 1 ? providerQuoteIds[0] : null;
  const submissionResult = await adapter.submitOrder({
    account: buildRepairLinkAdapterAccount(rawAccountRow),
    purchaseOrder: {
      id: purchaseOrderResult.data.purchaseOrder.id,
      poNumber: purchaseOrderResult.data.purchaseOrder.poNumber,
      supplierAccountId: purchaseOrderResult.data.purchaseOrder.supplierAccountId
    },
    purchaseOrderLines: purchaseOrderWorkspace.linkedPurchaseOrderLines
  });

  const providerOrderResult = await createProcurementProviderOrder(client, {
    companyId: input.companyId,
    providerAccountId: account.id,
    providerQuoteId,
    purchaseOrderId: input.purchaseOrderId,
    status: submissionResult.status,
    providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
    submittedAt: new Date().toISOString(),
    responseReceivedAt: new Date().toISOString(),
    manualFallbackReason: submissionResult.manualFallbackReason ?? null,
    rawRequestJson: {
      ...toJsonObject(submissionResult.rawRequestJson),
      manualReference: input.manualReference ?? null,
      notes: input.notes ?? null
    } as Json,
    rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
    lastErrorMessage: submissionResult.lastErrorMessage ?? null
  });

  if (providerOrderResult.error || !providerOrderResult.data) {
    throw providerOrderResult.error ?? new Error("Provider order could not be recorded.");
  }

  for (const lineResult of submissionResult.lineResults) {
    const createLineResult = await createProcurementProviderOrderLine(client, {
      companyId: input.companyId,
      providerOrderId: providerOrderResult.data.id,
      providerLineReference: lineResult.providerLineReference ?? null,
      providerQuoteLineId: lineResult.providerQuoteLineId ?? null,
      purchaseOrderLineId: lineResult.purchaseOrderLineId,
      quantity: lineResult.quantity,
      rawResponseJson: (lineResult.rawResponseJson ?? {}) as Json,
      unitPriceCents: lineResult.unitPriceCents ?? null
    });

    if (createLineResult.error) {
      throw createLineResult.error;
    }
  }

  for (const linkedProviderQuoteId of providerQuoteIds) {
    await updateProcurementProviderQuoteStatus(client, linkedProviderQuoteId, "converted", {
      convertedPurchaseOrderId: input.purchaseOrderId,
      fallbackMode: submissionResult.status === "manual_required" ? "manual_order" : "provider_order",
      loginUrl: REPAIRLINK_LOGIN_URL,
      provider: REPAIRLINK_PROVIDER
    });
  }

  const updatedOrderResult = await updateProcurementProviderOrderStatus(
    client,
    providerOrderResult.data.id,
    {
      lastErrorMessage: submissionResult.lastErrorMessage ?? null,
      manualFallbackReason: submissionResult.manualFallbackReason ?? null,
      providerOrderReference: submissionResult.providerOrderReference ?? input.manualReference ?? null,
      rawResponseJson: (submissionResult.rawResponseJson ?? {}) as Json,
      responseReceivedAt: new Date().toISOString(),
      status: submissionResult.status,
      submittedAt: new Date().toISOString()
    }
  );

  if (updatedOrderResult.error || !updatedOrderResult.data) {
    throw updatedOrderResult.error ?? new Error("Provider order status could not be updated.");
  }

  const ordersResult = await listProcurementProviderOrdersByPurchaseOrderId(
    client,
    input.purchaseOrderId
  );

  if (ordersResult.error) {
    throw ordersResult.error;
  }

  const persistedOrder = updatedOrderResult.data;
  const updatedOrder = (ordersResult.data ?? []).find(
    (entry) => entry.order.id === persistedOrder.id
  );

  return updatedOrder ?? {
    lines: [],
    order: persistedOrder
  };
}
