import type {
  CreateProcurementSupplyListInput,
  Database,
  ProcurementSupplyList,
  ProcurementSupplyListDetail,
  ProcurementSupplyListLine,
  UpsertProcurementSupplyListLineInput,
  UpdateProcurementSupplyListInput
} from "@mobile-mechanic/types";
import {
  createProcurementSupplyListInputSchema,
  upsertProcurementSupplyListLineInputSchema,
  updateProcurementSupplyListInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type ProcurementSupplyListRow =
  Database["public"]["Tables"]["procurement_supply_lists"]["Row"];
type ProcurementSupplyListLineRow =
  Database["public"]["Tables"]["procurement_supply_list_lines"]["Row"];
type ProcurementSupplyListInsert =
  Database["public"]["Tables"]["procurement_supply_lists"]["Insert"];
type ProcurementSupplyListUpdate =
  Database["public"]["Tables"]["procurement_supply_lists"]["Update"];
type ProcurementSupplyListLineInsert =
  Database["public"]["Tables"]["procurement_supply_list_lines"]["Insert"];
type ProcurementSupplyListLineUpdate =
  Database["public"]["Tables"]["procurement_supply_list_lines"]["Update"];

function mapProcurementSupplyListRow(
  row: ProcurementSupplyListRow
): ProcurementSupplyList {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProcurementSupplyListLineRow(
  row: ProcurementSupplyListLineRow
): ProcurementSupplyListLine {
  return {
    id: row.id,
    supplyListId: row.supply_list_id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    description: row.description,
    defaultQuantity: Number(row.default_quantity),
    searchQuery: row.search_query,
    provider: row.provider,
    providerProductKey: row.provider_product_key,
    providerOfferKey: row.provider_offer_key,
    expectedUnitCostCents: row.expected_unit_cost_cents,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listProcurementSupplyListsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("procurement_supply_lists")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true })
    .returns<ProcurementSupplyListRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapProcurementSupplyListRow) : null
  };
}

export async function getProcurementSupplyListById(
  client: AppSupabaseClient,
  supplyListId: string
) {
  const [listResult, linesResult] = await Promise.all([
    client
      .from("procurement_supply_lists")
      .select("*")
      .eq("id", supplyListId)
      .maybeSingle<ProcurementSupplyListRow>(),
    client
      .from("procurement_supply_list_lines")
      .select("*")
      .eq("supply_list_id", supplyListId)
      .order("created_at", { ascending: true })
      .returns<ProcurementSupplyListLineRow[]>()
  ]);

  if (listResult.error) {
    return {
      error: listResult.error,
      data: null
    };
  }

  if (linesResult.error) {
    return {
      error: linesResult.error,
      data: null
    };
  }

  if (!listResult.data) {
    return {
      error: null,
      data: null
    };
  }

  return {
    error: null,
    data: {
      list: mapProcurementSupplyListRow(listResult.data),
      lines: (linesResult.data ?? []).map(mapProcurementSupplyListLineRow)
    } satisfies ProcurementSupplyListDetail
  };
}

export async function createProcurementSupplyList(
  client: AppSupabaseClient,
  input: CreateProcurementSupplyListInput
) {
  const parsed = createProcurementSupplyListInputSchema.parse(input);
  const payload: ProcurementSupplyListInsert = {
    company_id: parsed.companyId,
    name: parsed.name,
    description: parsed.description ?? null,
    created_by_user_id: parsed.createdByUserId
  };

  const result = await client
    .from("procurement_supply_lists")
    .insert(payload)
    .select("*")
    .single<ProcurementSupplyListRow>();

  return {
    ...result,
    data: result.data ? mapProcurementSupplyListRow(result.data) : null
  };
}

export async function updateProcurementSupplyList(
  client: AppSupabaseClient,
  supplyListId: string,
  input: UpdateProcurementSupplyListInput
) {
  const parsed = updateProcurementSupplyListInputSchema.parse(input);
  const payload: ProcurementSupplyListUpdate = {};

  if (parsed.name !== undefined) {
    payload.name = parsed.name;
  }

  if (parsed.description !== undefined) {
    payload.description = parsed.description ?? null;
  }

  if (parsed.isActive !== undefined) {
    payload.is_active = parsed.isActive;
  }

  const result = await client
    .from("procurement_supply_lists")
    .update(payload)
    .eq("id", supplyListId)
    .select("*")
    .single<ProcurementSupplyListRow>();

  return {
    ...result,
    data: result.data ? mapProcurementSupplyListRow(result.data) : null
  };
}

export async function deleteProcurementSupplyList(
  client: AppSupabaseClient,
  supplyListId: string
) {
  return client.from("procurement_supply_lists").delete().eq("id", supplyListId);
}

export async function upsertProcurementSupplyListLine(
  client: AppSupabaseClient,
  input: UpsertProcurementSupplyListLineInput
) {
  const parsed = upsertProcurementSupplyListLineInputSchema.parse(input);

  if (parsed.lineId) {
    const payload: ProcurementSupplyListLineUpdate = {
      inventory_item_id: parsed.inventoryItemId ?? null,
      description: parsed.description,
      default_quantity: parsed.defaultQuantity,
      search_query: parsed.searchQuery ?? null,
      provider: parsed.provider,
      provider_product_key: parsed.providerProductKey ?? null,
      provider_offer_key: parsed.providerOfferKey ?? null,
      expected_unit_cost_cents: parsed.expectedUnitCostCents ?? null,
      notes: parsed.notes ?? null
    };

    const result = await client
      .from("procurement_supply_list_lines")
      .update(payload)
      .eq("id", parsed.lineId)
      .select("*")
      .single<ProcurementSupplyListLineRow>();

    return {
      ...result,
      data: result.data ? mapProcurementSupplyListLineRow(result.data) : null
    };
  }

  const payload: ProcurementSupplyListLineInsert = {
    supply_list_id: parsed.supplyListId,
    company_id: parsed.companyId,
    inventory_item_id: parsed.inventoryItemId ?? null,
    description: parsed.description,
    default_quantity: parsed.defaultQuantity,
    search_query: parsed.searchQuery ?? null,
    provider: parsed.provider,
    provider_product_key: parsed.providerProductKey ?? null,
    provider_offer_key: parsed.providerOfferKey ?? null,
    expected_unit_cost_cents: parsed.expectedUnitCostCents ?? null,
    notes: parsed.notes ?? null
  };

  const result = await client
    .from("procurement_supply_list_lines")
    .insert(payload)
    .select("*")
    .single<ProcurementSupplyListLineRow>();

  return {
    ...result,
    data: result.data ? mapProcurementSupplyListLineRow(result.data) : null
  };
}

export async function deleteProcurementSupplyListLine(
  client: AppSupabaseClient,
  supplyListLineId: string
) {
  return client.from("procurement_supply_list_lines").delete().eq("id", supplyListLineId);
}
