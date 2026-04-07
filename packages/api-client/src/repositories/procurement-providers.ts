import type {
  CreateProcurementProviderQuoteInput,
  CreateProcurementProviderQuoteLineInput,
  Database,
  Json,
  ProcurementProvider,
  ProcurementProviderAccount,
  ProcurementProviderCapabilities,
  ProcurementProviderOrder,
  ProcurementProviderOrderLine,
  ProcurementProviderOrderStatus,
  ProcurementProviderQuote,
  ProcurementProviderQuoteLine,
  ProcurementProviderQuoteStatus,
  ProcurementProviderSupplierMapping,
  UpsertProcurementProviderSupplierMappingInput
} from "@mobile-mechanic/types";
import {
  createProcurementProviderQuoteInputSchema,
  createProcurementProviderQuoteLineInputSchema,
  procurementProviderOrderStatusSchema,
  procurementProviderQuoteStatusSchema,
  upsertProcurementProviderSupplierMappingInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type ProcurementProviderAccountRow =
  Database["public"]["Tables"]["procurement_provider_accounts"]["Row"];
type ProcurementProviderSupplierMappingRow =
  Database["public"]["Tables"]["procurement_provider_supplier_mappings"]["Row"];
type ProcurementProviderQuoteRow =
  Database["public"]["Tables"]["procurement_provider_quotes"]["Row"];
type ProcurementProviderQuoteLineRow =
  Database["public"]["Tables"]["procurement_provider_quote_lines"]["Row"];
type ProcurementProviderOrderRow =
  Database["public"]["Tables"]["procurement_provider_orders"]["Row"];
type ProcurementProviderOrderLineRow =
  Database["public"]["Tables"]["procurement_provider_order_lines"]["Row"];
type ProcurementProviderAccountInsert =
  Database["public"]["Tables"]["procurement_provider_accounts"]["Insert"];
type ProcurementProviderAccountUpdate =
  Database["public"]["Tables"]["procurement_provider_accounts"]["Update"];
type ProcurementProviderSupplierMappingInsert =
  Database["public"]["Tables"]["procurement_provider_supplier_mappings"]["Insert"];
type ProcurementProviderQuoteInsert =
  Database["public"]["Tables"]["procurement_provider_quotes"]["Insert"];
type ProcurementProviderQuoteUpdate =
  Database["public"]["Tables"]["procurement_provider_quotes"]["Update"];
type ProcurementProviderQuoteLineInsert =
  Database["public"]["Tables"]["procurement_provider_quote_lines"]["Insert"];
type ProcurementProviderQuoteLineUpdate =
  Database["public"]["Tables"]["procurement_provider_quote_lines"]["Update"];
type ProcurementProviderOrderInsert =
  Database["public"]["Tables"]["procurement_provider_orders"]["Insert"];
type ProcurementProviderOrderUpdate =
  Database["public"]["Tables"]["procurement_provider_orders"]["Update"];
type ProcurementProviderOrderLineInsert =
  Database["public"]["Tables"]["procurement_provider_order_lines"]["Insert"];

type UpsertProcurementProviderAccountRecordInput = {
  capabilitiesJson: ProcurementProviderCapabilities;
  companyId: string;
  credentialCiphertext: string | null;
  credentialHint: string | null;
  displayName: string;
  lastErrorMessage?: string | null | undefined;
  lastVerifiedAt?: string | null | undefined;
  provider: ProcurementProvider;
  settingsJson: Json;
  status: ProcurementProviderAccount["status"];
  username: string | null;
};

type CreateProcurementProviderOrderInput = {
  companyId: string;
  providerAccountId: string;
  providerQuoteId?: string | null | undefined;
  purchaseOrderId: string;
  status: ProcurementProviderOrderStatus;
  providerOrderReference?: string | null | undefined;
  submittedAt?: string | null | undefined;
  responseReceivedAt?: string | null | undefined;
  manualFallbackReason?: string | null | undefined;
  rawRequestJson?: Json | null | undefined;
  rawResponseJson?: Json | null | undefined;
  lastErrorMessage?: string | null | undefined;
};

type CreateProcurementProviderOrderLineInput = {
  companyId: string;
  providerOrderId: string;
  purchaseOrderLineId: string;
  providerQuoteLineId?: string | null | undefined;
  providerLineReference?: string | null | undefined;
  quantity: number;
  unitPriceCents?: number | null | undefined;
  rawResponseJson?: Json | null | undefined;
};

function asJson(value: Json): Json {
  return value;
}

function mapProcurementProviderAccountRow(
  row: ProcurementProviderAccountRow
): ProcurementProviderAccount {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider,
    status: row.status,
    displayName: row.display_name,
    username: row.username,
    credentialHint: row.credential_hint,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    lastVerifiedAt: row.last_verified_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProcurementProviderSupplierMappingRow(
  row: ProcurementProviderSupplierMappingRow
): ProcurementProviderSupplierMapping {
  return {
    id: row.id,
    companyId: row.company_id,
    providerAccountId: row.provider_account_id,
    supplierAccountId: row.supplier_account_id,
    providerSupplierKey: row.provider_supplier_key,
    providerSupplierName: row.provider_supplier_name,
    providerLocationKey: row.provider_location_key,
    status: row.status,
    supportsQuote: row.supports_quote,
    supportsOrder: row.supports_order,
    lastVerifiedAt: row.last_verified_at,
    lastErrorMessage: row.last_error_message,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProcurementProviderQuoteRow(row: ProcurementProviderQuoteRow): ProcurementProviderQuote {
  return {
    id: row.id,
    companyId: row.company_id,
    providerAccountId: row.provider_account_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    partRequestId: row.part_request_id,
    status: row.status,
    vehicleContextJson: row.vehicle_context_json,
    searchContextJson: row.search_context_json,
    requestedByUserId: row.requested_by_user_id,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProcurementProviderQuoteLineRow(
  row: ProcurementProviderQuoteLineRow
): ProcurementProviderQuoteLine {
  return {
    id: row.id,
    companyId: row.company_id,
    providerQuoteId: row.provider_quote_id,
    partRequestLineId: row.part_request_line_id,
    providerSupplierMappingId: row.provider_supplier_mapping_id,
    providerOfferKey: row.provider_offer_key,
    providerProductKey: row.provider_product_key,
    providerLocationKey: row.provider_location_key,
    providerSupplierKey: row.provider_supplier_key,
    providerSupplierName: row.provider_supplier_name,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    coreChargeCents: row.core_charge_cents,
    availabilityText: row.availability_text,
    etaText: row.eta_text,
    selectedForCart: row.selected_for_cart,
    rawResponseJson: row.raw_response_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function assertProviderQuoteLineMappingBelongsToQuoteAccount(
  client: AppSupabaseClient,
  input: {
    providerQuoteId: string;
    providerSupplierMappingId: string;
  }
) {
  const [quoteResult, mappingResult] = await Promise.all([
    client
      .from("procurement_provider_quotes")
      .select("id, provider_account_id")
      .eq("id", input.providerQuoteId)
      .maybeSingle<{ id: string; provider_account_id: string }>(),
    client
      .from("procurement_provider_supplier_mappings")
      .select("id, provider_account_id")
      .eq("id", input.providerSupplierMappingId)
      .maybeSingle<{ id: string; provider_account_id: string }>()
  ]);

  if (quoteResult.error) {
    throw quoteResult.error;
  }

  if (mappingResult.error) {
    throw mappingResult.error;
  }

  if (!quoteResult.data) {
    throw new Error("Provider quote could not be loaded.");
  }

  if (!mappingResult.data) {
    throw new Error("Provider supplier mapping could not be loaded.");
  }

  if (quoteResult.data.provider_account_id !== mappingResult.data.provider_account_id) {
    throw new Error(
      "Provider supplier mapping must belong to the same provider account as the quote."
    );
  }
}

function mapProcurementProviderOrderRow(row: ProcurementProviderOrderRow): ProcurementProviderOrder {
  return {
    id: row.id,
    companyId: row.company_id,
    providerAccountId: row.provider_account_id,
    purchaseOrderId: row.purchase_order_id,
    providerQuoteId: row.provider_quote_id,
    status: row.status,
    providerOrderReference: row.provider_order_reference,
    submittedAt: row.submitted_at,
    responseReceivedAt: row.response_received_at,
    manualFallbackReason: row.manual_fallback_reason,
    rawRequestJson: row.raw_request_json,
    rawResponseJson: row.raw_response_json,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProcurementProviderOrderLineRow(
  row: ProcurementProviderOrderLineRow
): ProcurementProviderOrderLine {
  return {
    id: row.id,
    companyId: row.company_id,
    providerOrderId: row.provider_order_id,
    purchaseOrderLineId: row.purchase_order_line_id,
    providerQuoteLineId: row.provider_quote_line_id,
    providerLineReference: row.provider_line_reference,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    rawResponseJson: row.raw_response_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listProcurementProviderAccountsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("procurement_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("provider", { ascending: true })
    .returns<ProcurementProviderAccountRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapProcurementProviderAccountRow) : null
  };
}

export async function getProcurementProviderAccountByProvider(
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

  return {
    ...result,
    data: result.data ? mapProcurementProviderAccountRow(result.data) : null
  };
}

export async function upsertProcurementProviderAccount(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderAccountRecordInput
) {
  const payload: ProcurementProviderAccountInsert = {
    company_id: input.companyId,
    provider: input.provider,
    status: input.status,
    display_name: input.displayName,
    username: input.username,
    credential_ciphertext: input.credentialCiphertext,
    credential_hint: input.credentialHint,
    settings_json: asJson(input.settingsJson),
    capabilities_json: asJson(input.capabilitiesJson as unknown as Json),
    last_verified_at: input.lastVerifiedAt ?? null,
    last_error_message: input.lastErrorMessage ?? null
  };

  const result = await client
    .from("procurement_provider_accounts")
    .upsert(payload, { onConflict: "company_id,provider" })
    .select("*")
    .single<ProcurementProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderAccountRow(result.data) : null
  };
}

export async function updateProcurementProviderAccountStatus(
  client: AppSupabaseClient,
  accountId: string,
  input: {
    capabilitiesJson?: ProcurementProviderCapabilities | null | undefined;
    lastErrorMessage?: string | null | undefined;
    lastVerifiedAt?: string | null | undefined;
    status: ProcurementProviderAccount["status"];
  }
) {
  const payload: ProcurementProviderAccountUpdate = {
    status: input.status,
    last_error_message: input.lastErrorMessage ?? null,
    last_verified_at: input.lastVerifiedAt ?? null
  };

  if (input.capabilitiesJson !== undefined) {
    payload.capabilities_json = input.capabilitiesJson as unknown as Json;
  }

  const result = await client
    .from("procurement_provider_accounts")
    .update(payload)
    .eq("id", accountId)
    .select("*")
    .single<ProcurementProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderAccountRow(result.data) : null
  };
}

export async function disconnectProcurementProviderAccount(
  client: AppSupabaseClient,
  companyId: string,
  provider: ProcurementProvider
) {
  const payload: ProcurementProviderAccountUpdate = {
    status: "disconnected",
    username: null,
    credential_ciphertext: null,
    credential_hint: null,
    last_error_message: null,
    last_verified_at: null
  };

  const result = await client
    .from("procurement_provider_accounts")
    .update(payload)
    .eq("company_id", companyId)
    .eq("provider", provider)
    .select("*")
    .single<ProcurementProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderAccountRow(result.data) : null
  };
}

export async function listProcurementProviderSupplierMappingsByAccount(
  client: AppSupabaseClient,
  providerAccountId: string
) {
  const result = await client
    .from("procurement_provider_supplier_mappings")
    .select("*")
    .eq("provider_account_id", providerAccountId)
    .order("provider_supplier_name", { ascending: true })
    .returns<ProcurementProviderSupplierMappingRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapProcurementProviderSupplierMappingRow) : null
  };
}

export async function upsertProcurementProviderSupplierMapping(
  client: AppSupabaseClient,
  input: UpsertProcurementProviderSupplierMappingInput
) {
  const parsed = upsertProcurementProviderSupplierMappingInputSchema.parse(input);
  const payload: ProcurementProviderSupplierMappingInsert = {
    company_id: parsed.companyId,
    provider_account_id: parsed.providerAccountId,
    supplier_account_id: parsed.supplierAccountId,
    provider_supplier_key: parsed.providerSupplierKey,
    provider_supplier_name: parsed.providerSupplierName,
    provider_location_key: parsed.providerLocationKey ?? null,
    status: parsed.status,
    supports_quote: parsed.supportsQuote ?? true,
    supports_order: parsed.supportsOrder ?? false,
    metadata_json: asJson((parsed.metadataJson ?? {}) as Json)
  };

  const result = await client
    .from("procurement_provider_supplier_mappings")
    .upsert(payload, {
      onConflict: "provider_account_id,provider_supplier_key,provider_location_key"
    })
    .select("*")
    .single<ProcurementProviderSupplierMappingRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderSupplierMappingRow(result.data) : null
  };
}

export async function createProcurementProviderQuote(
  client: AppSupabaseClient,
  input: CreateProcurementProviderQuoteInput
) {
  const parsed = createProcurementProviderQuoteInputSchema.parse(input);
  const payload: ProcurementProviderQuoteInsert = {
    company_id: parsed.companyId,
    provider_account_id: parsed.providerAccountId,
    job_id: parsed.jobId,
    estimate_id: parsed.estimateId ?? null,
    part_request_id: parsed.partRequestId,
    status: parsed.status ?? "draft",
    vehicle_context_json: asJson((parsed.vehicleContextJson ?? {}) as Json),
    search_context_json: asJson((parsed.searchContextJson ?? {}) as Json),
    requested_by_user_id: parsed.requestedByUserId,
    requested_at: new Date().toISOString(),
    expires_at: parsed.expiresAt ?? null,
    metadata_json: asJson((parsed.metadataJson ?? {}) as Json)
  };

  const result = await client
    .from("procurement_provider_quotes")
    .insert(payload)
    .select("*")
    .single<ProcurementProviderQuoteRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteRow(result.data) : null
  };
}

export async function updateProcurementProviderQuoteStatus(
  client: AppSupabaseClient,
  quoteId: string,
  status: ProcurementProviderQuoteStatus,
  metadataJson?: Json | null
) {
  procurementProviderQuoteStatusSchema.parse(status);
  const payload: ProcurementProviderQuoteUpdate = { status };

  if (metadataJson !== undefined) {
    payload.metadata_json = metadataJson;
  }

  const result = await client
    .from("procurement_provider_quotes")
    .update(payload)
    .eq("id", quoteId)
    .select("*")
    .single<ProcurementProviderQuoteRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteRow(result.data) : null
  };
}

export async function updateProcurementProviderQuoteContext(
  client: AppSupabaseClient,
  quoteId: string,
  input: {
    metadataJson?: Json | null | undefined;
    searchContextJson?: Json | null | undefined;
    vehicleContextJson?: Json | null | undefined;
  }
) {
  const payload: ProcurementProviderQuoteUpdate = {};

  if (input.vehicleContextJson !== undefined) {
    payload.vehicle_context_json = input.vehicleContextJson;
  }

  if (input.searchContextJson !== undefined) {
    payload.search_context_json = input.searchContextJson;
  }

  if (input.metadataJson !== undefined) {
    payload.metadata_json = input.metadataJson;
  }

  const result = await client
    .from("procurement_provider_quotes")
    .update(payload)
    .eq("id", quoteId)
    .select("*")
    .single<ProcurementProviderQuoteRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteRow(result.data) : null
  };
}

export async function getLatestProcurementProviderQuoteByRequestAndAccount(
  client: AppSupabaseClient,
  input: {
    partRequestId: string;
    providerAccountId: string;
  }
) {
  const quoteResult = await client
    .from("procurement_provider_quotes")
    .select("*")
    .eq("part_request_id", input.partRequestId)
    .eq("provider_account_id", input.providerAccountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ProcurementProviderQuoteRow>();

  if (quoteResult.error || !quoteResult.data) {
    return {
      ...quoteResult,
      data: null
    };
  }

  const linesResult = await listProcurementProviderQuoteLinesByQuoteId(client, quoteResult.data.id);

  if (linesResult.error) {
    throw linesResult.error;
  }

  return {
    data: {
      quote: mapProcurementProviderQuoteRow(quoteResult.data),
      lines: linesResult.data ?? []
    },
    error: null
  };
}

export async function listProcurementProviderQuoteLinesByQuoteId(
  client: AppSupabaseClient,
  quoteId: string
) {
  const result = await client
    .from("procurement_provider_quote_lines")
    .select("*")
    .eq("provider_quote_id", quoteId)
    .order("created_at", { ascending: true })
    .returns<ProcurementProviderQuoteLineRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapProcurementProviderQuoteLineRow) : null
  };
}

export async function createProcurementProviderQuoteLine(
  client: AppSupabaseClient,
  input: CreateProcurementProviderQuoteLineInput
) {
  const parsed = createProcurementProviderQuoteLineInputSchema.parse(input);

  if (parsed.providerSupplierMappingId) {
    await assertProviderQuoteLineMappingBelongsToQuoteAccount(client, {
      providerQuoteId: parsed.providerQuoteId,
      providerSupplierMappingId: parsed.providerSupplierMappingId
    });
  }

  const payload: ProcurementProviderQuoteLineInsert = {
    company_id: parsed.companyId,
    provider_quote_id: parsed.providerQuoteId,
    part_request_line_id: parsed.partRequestLineId,
    provider_supplier_mapping_id: parsed.providerSupplierMappingId ?? null,
    provider_offer_key: parsed.providerOfferKey,
    provider_product_key: parsed.providerProductKey ?? null,
    provider_location_key: parsed.providerLocationKey ?? null,
    provider_supplier_key: parsed.providerSupplierKey,
    provider_supplier_name: parsed.providerSupplierName,
    description: parsed.description,
    manufacturer: parsed.manufacturer ?? null,
    part_number: parsed.partNumber ?? null,
    quantity: parsed.quantity,
    unit_price_cents: parsed.unitPriceCents ?? null,
    core_charge_cents: parsed.coreChargeCents ?? null,
    availability_text: parsed.availabilityText ?? null,
    eta_text: parsed.etaText ?? null,
    selected_for_cart: parsed.selectedForCart ?? false,
    raw_response_json: asJson((parsed.rawResponseJson ?? {}) as Json)
  };

  const result = await client
    .from("procurement_provider_quote_lines")
    .insert(payload)
    .select("*")
    .single<ProcurementProviderQuoteLineRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteLineRow(result.data) : null
  };
}

export async function updateProcurementProviderQuoteLine(
  client: AppSupabaseClient,
  quoteLineId: string,
  input: Partial<Omit<CreateProcurementProviderQuoteLineInput, "companyId" | "providerQuoteId">>
) {
  const payload: ProcurementProviderQuoteLineUpdate = {};

  if (input.providerSupplierMappingId) {
    const quoteLineResult = await client
      .from("procurement_provider_quote_lines")
      .select("provider_quote_id")
      .eq("id", quoteLineId)
      .maybeSingle<{ provider_quote_id: string }>();

    if (quoteLineResult.error) {
      throw quoteLineResult.error;
    }

    if (!quoteLineResult.data) {
      throw new Error("Provider quote line could not be loaded.");
    }

    await assertProviderQuoteLineMappingBelongsToQuoteAccount(client, {
      providerQuoteId: quoteLineResult.data.provider_quote_id,
      providerSupplierMappingId: input.providerSupplierMappingId
    });
  }

  if (input.providerSupplierMappingId !== undefined) {
    payload.provider_supplier_mapping_id = input.providerSupplierMappingId ?? null;
  }

  if (input.providerLocationKey !== undefined) {
    payload.provider_location_key = input.providerLocationKey ?? null;
  }

  if (input.providerProductKey !== undefined) {
    payload.provider_product_key = input.providerProductKey ?? null;
  }

  if (input.providerSupplierKey !== undefined) {
    payload.provider_supplier_key = input.providerSupplierKey;
  }

  if (input.providerSupplierName !== undefined) {
    payload.provider_supplier_name = input.providerSupplierName;
  }

  if (input.description !== undefined) {
    payload.description = input.description;
  }

  if (input.manufacturer !== undefined) {
    payload.manufacturer = input.manufacturer ?? null;
  }

  if (input.partNumber !== undefined) {
    payload.part_number = input.partNumber ?? null;
  }

  if (input.quantity !== undefined) {
    payload.quantity = input.quantity;
  }

  if (input.unitPriceCents !== undefined) {
    payload.unit_price_cents = input.unitPriceCents ?? null;
  }

  if (input.coreChargeCents !== undefined) {
    payload.core_charge_cents = input.coreChargeCents ?? null;
  }

  if (input.availabilityText !== undefined) {
    payload.availability_text = input.availabilityText ?? null;
  }

  if (input.etaText !== undefined) {
    payload.eta_text = input.etaText ?? null;
  }

  if (input.selectedForCart !== undefined) {
    payload.selected_for_cart = input.selectedForCart;
  }

  if (input.rawResponseJson !== undefined) {
    payload.raw_response_json = asJson((input.rawResponseJson ?? {}) as Json);
  }

  const result = await client
    .from("procurement_provider_quote_lines")
    .update(payload)
    .eq("id", quoteLineId)
    .select("*")
    .single<ProcurementProviderQuoteLineRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteLineRow(result.data) : null
  };
}

export async function updateProcurementProviderQuoteLineSelection(
  client: AppSupabaseClient,
  quoteLineId: string,
  selectedForCart: boolean
) {
  const result = await client
    .from("procurement_provider_quote_lines")
    .update({ selected_for_cart: selectedForCart })
    .eq("id", quoteLineId)
    .select("*")
    .single<ProcurementProviderQuoteLineRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderQuoteLineRow(result.data) : null
  };
}

export async function listProcurementProviderOrdersByPurchaseOrderId(
  client: AppSupabaseClient,
  purchaseOrderId: string
) {
  const ordersResult = await client
    .from("procurement_provider_orders")
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: false })
    .returns<ProcurementProviderOrderRow[]>();

  if (ordersResult.error) {
    return { ...ordersResult, data: null };
  }

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  const linesResult = orderIds.length
    ? await client
        .from("procurement_provider_order_lines")
        .select("*")
        .in("provider_order_id", orderIds)
        .returns<ProcurementProviderOrderLineRow[]>()
    : {
        data: [] as ProcurementProviderOrderLineRow[],
        error: null
      };

  if (linesResult.error) {
    throw linesResult.error;
  }

  const linesByOrderId = new Map<string, ProcurementProviderOrderLine[]>();
  for (const line of linesResult.data ?? []) {
    const rows = linesByOrderId.get(line.provider_order_id) ?? [];
    rows.push(mapProcurementProviderOrderLineRow(line));
    linesByOrderId.set(line.provider_order_id, rows);
  }

  return {
    data: orders.map((order) => ({
      order: mapProcurementProviderOrderRow(order),
      lines: linesByOrderId.get(order.id) ?? []
    })),
    error: null
  };
}

export async function createProcurementProviderOrder(
  client: AppSupabaseClient,
  input: CreateProcurementProviderOrderInput
) {
  procurementProviderOrderStatusSchema.parse(input.status);
  const payload: ProcurementProviderOrderInsert = {
    company_id: input.companyId,
    provider_account_id: input.providerAccountId,
    purchase_order_id: input.purchaseOrderId,
    provider_quote_id: input.providerQuoteId ?? null,
    status: input.status,
    provider_order_reference: input.providerOrderReference ?? null,
    submitted_at: input.submittedAt ?? null,
    response_received_at: input.responseReceivedAt ?? null,
    manual_fallback_reason: input.manualFallbackReason ?? null,
    raw_request_json: asJson((input.rawRequestJson ?? {}) as Json),
    raw_response_json: asJson((input.rawResponseJson ?? {}) as Json),
    last_error_message: input.lastErrorMessage ?? null
  };

  const result = await client
    .from("procurement_provider_orders")
    .insert(payload)
    .select("*")
    .single<ProcurementProviderOrderRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderOrderRow(result.data) : null
  };
}

export async function createProcurementProviderOrderLine(
  client: AppSupabaseClient,
  input: CreateProcurementProviderOrderLineInput
) {
  const payload: ProcurementProviderOrderLineInsert = {
    company_id: input.companyId,
    provider_order_id: input.providerOrderId,
    purchase_order_line_id: input.purchaseOrderLineId,
    provider_quote_line_id: input.providerQuoteLineId ?? null,
    provider_line_reference: input.providerLineReference ?? null,
    quantity: input.quantity,
    unit_price_cents: input.unitPriceCents ?? null,
    raw_response_json: asJson((input.rawResponseJson ?? {}) as Json)
  };

  const result = await client
    .from("procurement_provider_order_lines")
    .insert(payload)
    .select("*")
    .single<ProcurementProviderOrderLineRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderOrderLineRow(result.data) : null
  };
}

export async function updateProcurementProviderOrderStatus(
  client: AppSupabaseClient,
  providerOrderId: string,
  input: {
    lastErrorMessage?: string | null | undefined;
    manualFallbackReason?: string | null | undefined;
    providerOrderReference?: string | null | undefined;
    rawResponseJson?: Json | null | undefined;
    responseReceivedAt?: string | null | undefined;
    status: ProcurementProviderOrderStatus;
    submittedAt?: string | null | undefined;
  }
) {
  procurementProviderOrderStatusSchema.parse(input.status);
  const payload: ProcurementProviderOrderUpdate = {
    status: input.status,
    provider_order_reference: input.providerOrderReference ?? null,
    manual_fallback_reason: input.manualFallbackReason ?? null,
    last_error_message: input.lastErrorMessage ?? null
  };

  if (input.submittedAt !== undefined) {
    payload.submitted_at = input.submittedAt;
  }

  if (input.responseReceivedAt !== undefined) {
    payload.response_received_at = input.responseReceivedAt;
  }

  if (input.rawResponseJson !== undefined) {
    payload.raw_response_json = input.rawResponseJson;
  }

  const result = await client
    .from("procurement_provider_orders")
    .update(payload)
    .eq("id", providerOrderId)
    .select("*")
    .single<ProcurementProviderOrderRow>();

  return {
    ...result,
    data: result.data ? mapProcurementProviderOrderRow(result.data) : null
  };
}
