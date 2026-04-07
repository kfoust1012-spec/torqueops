import {
  assertTransactionLocationConsistency,
  calculateInventoryBalancesByLocation,
  calculateReorderStatus,
  isLowStock,
  matchInventoryItemByAlias,
  matchInventoryItemByPartNumber,
  normalizeInventoryAliasInput,
  normalizeInventoryItemInput,
  normalizeStockLocationInput,
  resolveInventoryItemCandidateFromProcurementLine,
  sumOnHandFromTransactions,
  sumReservedQuantity
} from "@mobile-mechanic/core";
import type {
  CreateInventoryAdjustmentInput,
  CreateInventoryItemAliasInput,
  CreateInventoryItemInput,
  CreateInventoryReservationInput,
  Database,
  InventoryBalance,
  InventoryItem,
  InventoryItemAlias,
  InventoryItemWithBalances,
  InventoryLookupQuery,
  InventoryLookupResult,
  InventoryReservation,
  InventoryReorderRow,
  InventoryStockSetting,
  InventoryTransaction,
  InventoryTransactionsQuery,
  InventoryWorkspaceSummary,
  JobInventorySummary,
  ReceivePurchasedInventoryInput,
  ReleaseInventoryReservationInput,
  StockLocation,
  UpdateInventoryItemInput,
  UpdateStockLocationInput,
  UpsertInventoryStockSettingInput,
  CreateStockLocationInput
} from "@mobile-mechanic/types";
import {
  createInventoryAdjustmentInputSchema,
  createInventoryItemAliasInputSchema,
  createInventoryItemInputSchema,
  createInventoryReservationInputSchema,
  createStockLocationInputSchema,
  inventoryLookupQuerySchema,
  inventoryTransactionsQuerySchema,
  receivePurchasedInventoryInputSchema,
  releaseInventoryReservationInputSchema,
  updateInventoryItemInputSchema,
  updateStockLocationInputSchema,
  upsertInventoryStockSettingInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type InventoryItemRow = Database["public"]["Tables"]["inventory_items"]["Row"];
type InventoryItemAliasRow = Database["public"]["Tables"]["inventory_item_aliases"]["Row"];
type StockLocationRow = Database["public"]["Tables"]["stock_locations"]["Row"];
type InventoryStockSettingRow = Database["public"]["Tables"]["inventory_stock_settings"]["Row"];
type InventoryTransactionRow = Database["public"]["Tables"]["inventory_transactions"]["Row"];
type InventoryReservationRow = Database["public"]["Tables"]["inventory_reservations"]["Row"];
type PurchaseOrderLineRow = Database["public"]["Tables"]["purchase_order_lines"]["Row"];
type PurchaseReceiptLineRow = Database["public"]["Tables"]["purchase_receipt_lines"]["Row"];
type PartRequestLineCompanyRow = Pick<
  Database["public"]["Tables"]["part_request_lines"]["Row"],
  "id" | "company_id"
>;

function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    companyId: row.company_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    supplierAccountId: row.supplier_account_id,
    defaultUnitCostCents: row.default_unit_cost_cents,
    itemType: row.item_type,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryItemAliasRow(row: InventoryItemAliasRow): InventoryItemAlias {
  return {
    id: row.id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    aliasType: row.alias_type,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapStockLocationRow(row: StockLocationRow): StockLocation {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.slug,
    locationType: row.location_type,
    technicianUserId: row.technician_user_id,
    vehicleLabel: row.vehicle_label,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryStockSettingRow(row: InventoryStockSettingRow): InventoryStockSetting {
  return {
    id: row.id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    reorderPointQuantity: Number(row.reorder_point_quantity),
    lowStockThresholdQuantity: Number(row.low_stock_threshold_quantity),
    preferredReorderQuantity:
      row.preferred_reorder_quantity === null ? null : Number(row.preferred_reorder_quantity),
    isStockedHere: row.is_stocked_here,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryTransactionRow(row: InventoryTransactionRow): InventoryTransaction {
  return {
    id: row.id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    transactionType: row.transaction_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    jobId: row.job_id,
    partRequestLineId: row.part_request_line_id,
    purchaseOrderLineId: row.purchase_order_line_id,
    purchaseReceiptLineId: row.purchase_receipt_line_id,
    partReturnLineId: row.part_return_line_id,
    quantityDelta: Number(row.quantity_delta),
    unitCostCents: row.unit_cost_cents,
    referenceNumber: row.reference_number,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    effectiveAt: row.effective_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryReservationRow(row: InventoryReservationRow): InventoryReservation {
  return {
    id: row.id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    jobId: row.job_id,
    partRequestLineId: row.part_request_line_id,
    quantityReserved: Number(row.quantity_reserved),
    quantityReleased: Number(row.quantity_released),
    quantityConsumed: Number(row.quantity_consumed),
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getOpenReservationQuantity(
  reservation: Pick<InventoryReservation, "quantityReserved" | "quantityReleased" | "quantityConsumed">
) {
  return Math.max(
    reservation.quantityReserved - reservation.quantityReleased - reservation.quantityConsumed,
    0
  );
}

function buildBalanceMaps(
  transactions: InventoryTransaction[],
  reservations: InventoryReservation[]
) {
  const onHandByPair = new Map<string, number>();
  const reservedByPair = new Map<string, number>();

  for (const transaction of transactions) {
    const key = `${transaction.inventoryItemId}:${transaction.stockLocationId}`;
    onHandByPair.set(
      key,
      (onHandByPair.get(key) ?? 0) +
        sumOnHandFromTransactions([{ quantityDelta: transaction.quantityDelta }])
    );
  }

  for (const reservation of reservations) {
    const key = `${reservation.inventoryItemId}:${reservation.stockLocationId}`;
    reservedByPair.set(
      key,
      (reservedByPair.get(key) ?? 0) +
        sumReservedQuantity([
          {
            quantityReserved: reservation.quantityReserved,
            quantityReleased: reservation.quantityReleased,
            quantityConsumed: reservation.quantityConsumed
          }
        ])
    );
  }

  return { onHandByPair, reservedByPair };
}

function assertCompanyOwnership(
  companyId: string,
  actualCompanyId: string,
  label: string
) {
  if (companyId !== actualCompanyId) {
    throw new Error(`${label} must belong to the current company.`);
  }
}

function assertActiveInventoryItem(
  item: Pick<InventoryItemRow, "is_active">,
  label = "Inventory item"
) {
  if (!item.is_active) {
    throw new Error(`${label} must be active for operational inventory changes.`);
  }
}

function assertStockedInventoryItem(
  item: Pick<InventoryItemRow, "item_type">,
  label = "Inventory item"
) {
  if (item.item_type !== "stocked") {
    throw new Error(`${label} must be stocked before it can participate in inventory operations.`);
  }
}

function assertActiveStockLocation(
  location: Pick<StockLocationRow, "is_active">,
  label = "Stock location"
) {
  if (!location.is_active) {
    throw new Error(`${label} must be active for operational inventory changes.`);
  }
}

export async function listInventoryStockSettingsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("inventory_stock_settings")
    .select("*")
    .eq("company_id", companyId)
    .returns<InventoryStockSettingRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryStockSettingRow) : null
  };
}

export async function listInventoryStockSettingsByItemId(
  client: AppSupabaseClient,
  companyId: string,
  itemId: string
) {
  const result = await client
    .from("inventory_stock_settings")
    .select("*")
    .eq("company_id", companyId)
    .eq("inventory_item_id", itemId)
    .returns<InventoryStockSettingRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryStockSettingRow) : null
  };
}

export async function listInventoryItemsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: InventoryLookupQuery = {}
) {
  const parsed = inventoryLookupQuerySchema.parse(query);
  let builder = client
    .from("inventory_items")
    .select("*")
    .eq("company_id", companyId)
    .order("sku", { ascending: true });

  if (!parsed.includeInactive) {
    builder = builder.eq("is_active", true);
  }

  if (parsed.itemType) {
    builder = builder.eq("item_type", parsed.itemType);
  }

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    builder = builder.or(
      `sku.ilike.${search},name.ilike.${search},part_number.ilike.${search},manufacturer.ilike.${search}`
    );
  }

  const result = await builder.returns<InventoryItemRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryItemRow) : null
  };
}

export async function getInventoryItemById(client: AppSupabaseClient, itemId: string) {
  const result = await client
    .from("inventory_items")
    .select("*")
    .eq("id", itemId)
    .single<InventoryItemRow>();

  return {
    ...result,
    data: result.data ? mapInventoryItemRow(result.data) : null
  };
}

export async function createInventoryItem(client: AppSupabaseClient, input: CreateInventoryItemInput) {
  const parsed = normalizeInventoryItemInput(createInventoryItemInputSchema.parse(input));

  const result = await client
    .from("inventory_items")
    .insert({
      company_id: parsed.companyId,
      sku: parsed.sku,
      name: parsed.name,
      description: parsed.description ?? null,
      manufacturer: parsed.manufacturer ?? null,
      part_number: parsed.partNumber ?? null,
      supplier_account_id: parsed.supplierAccountId ?? null,
      default_unit_cost_cents: parsed.defaultUnitCostCents ?? null,
      item_type: parsed.itemType ?? "stocked",
      is_active: parsed.isActive ?? true,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<InventoryItemRow>();

  return {
    ...result,
    data: result.data ? mapInventoryItemRow(result.data) : null
  };
}

export async function updateInventoryItem(
  client: AppSupabaseClient,
  itemId: string,
  input: UpdateInventoryItemInput
) {
  const parsed = normalizeInventoryItemInput(updateInventoryItemInputSchema.parse(input));

  const result = await client
    .from("inventory_items")
    .update({
      sku: parsed.sku,
      name: parsed.name,
      description: parsed.description ?? null,
      manufacturer: parsed.manufacturer ?? null,
      part_number: parsed.partNumber ?? null,
      supplier_account_id: parsed.supplierAccountId ?? null,
      default_unit_cost_cents: parsed.defaultUnitCostCents ?? null,
      item_type: parsed.itemType ?? "stocked",
      is_active: parsed.isActive ?? true,
      notes: parsed.notes ?? null
    })
    .eq("id", itemId)
    .select("*")
    .single<InventoryItemRow>();

  return {
    ...result,
    data: result.data ? mapInventoryItemRow(result.data) : null
  };
}

export async function listInventoryItemAliasesByItemId(client: AppSupabaseClient, itemId: string) {
  const result = await client
    .from("inventory_item_aliases")
    .select("*")
    .eq("inventory_item_id", itemId)
    .order("created_at", { ascending: true })
    .returns<InventoryItemAliasRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryItemAliasRow) : null
  };
}

export async function createInventoryItemAlias(
  client: AppSupabaseClient,
  input: CreateInventoryItemAliasInput
) {
  const parsed = normalizeInventoryAliasInput(createInventoryItemAliasInputSchema.parse(input));

  const result = await client
    .from("inventory_item_aliases")
    .insert({
      company_id: parsed.companyId,
      inventory_item_id: parsed.inventoryItemId,
      alias_type: parsed.aliasType,
      value: parsed.value
    })
    .select("*")
    .single<InventoryItemAliasRow>();

  return {
    ...result,
    data: result.data ? mapInventoryItemAliasRow(result.data) : null
  };
}

export async function deleteInventoryItemAlias(client: AppSupabaseClient, aliasId: string) {
  return client.from("inventory_item_aliases").delete().eq("id", aliasId);
}

export async function listStockLocationsByCompany(client: AppSupabaseClient, companyId: string) {
  const result = await client
    .from("stock_locations")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true })
    .returns<StockLocationRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapStockLocationRow) : null
  };
}

export async function createStockLocation(client: AppSupabaseClient, input: CreateStockLocationInput) {
  const parsed = normalizeStockLocationInput(createStockLocationInputSchema.parse(input));

  const result = await client
    .from("stock_locations")
    .insert({
      company_id: parsed.companyId,
      name: parsed.name,
      slug: parsed.slug,
      location_type: parsed.locationType ?? "warehouse",
      technician_user_id: parsed.technicianUserId ?? null,
      vehicle_label: parsed.vehicleLabel ?? null,
      is_active: parsed.isActive ?? true,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<StockLocationRow>();

  return {
    ...result,
    data: result.data ? mapStockLocationRow(result.data) : null
  };
}

export async function updateStockLocation(
  client: AppSupabaseClient,
  locationId: string,
  input: UpdateStockLocationInput
) {
  const parsed = normalizeStockLocationInput(updateStockLocationInputSchema.parse(input));

  const result = await client
    .from("stock_locations")
    .update({
      name: parsed.name,
      slug: parsed.slug,
      location_type: parsed.locationType ?? "warehouse",
      technician_user_id: parsed.technicianUserId ?? null,
      vehicle_label: parsed.vehicleLabel ?? null,
      is_active: parsed.isActive ?? true,
      notes: parsed.notes ?? null
    })
    .eq("id", locationId)
    .select("*")
    .single<StockLocationRow>();

  return {
    ...result,
    data: result.data ? mapStockLocationRow(result.data) : null
  };
}

export async function upsertInventoryStockSetting(
  client: AppSupabaseClient,
  input: UpsertInventoryStockSettingInput
) {
  const parsed = upsertInventoryStockSettingInputSchema.parse(input);
  const [itemResult, locationResult] = await Promise.all([
    client.from("inventory_items").select("*").eq("id", parsed.inventoryItemId).single<InventoryItemRow>(),
    client.from("stock_locations").select("*").eq("id", parsed.stockLocationId).single<StockLocationRow>()
  ]);

  if (itemResult.error) {
    return { ...itemResult, data: null };
  }

  if (locationResult.error) {
    return { ...locationResult, data: null };
  }

  assertCompanyOwnership(parsed.companyId, itemResult.data.company_id, "Inventory item");
  assertCompanyOwnership(parsed.companyId, locationResult.data.company_id, "Stock location");
  assertStockedInventoryItem(itemResult.data);

  const result = await client
    .from("inventory_stock_settings")
    .upsert(
      {
        company_id: parsed.companyId,
        inventory_item_id: parsed.inventoryItemId,
        stock_location_id: parsed.stockLocationId,
        reorder_point_quantity: parsed.reorderPointQuantity ?? 0,
        low_stock_threshold_quantity: parsed.lowStockThresholdQuantity ?? 0,
        preferred_reorder_quantity: parsed.preferredReorderQuantity ?? null,
        is_stocked_here: parsed.isStockedHere ?? true
      },
      { onConflict: "company_id,inventory_item_id,stock_location_id" }
    )
    .select("*")
    .single<InventoryStockSettingRow>();

  return {
    ...result,
    data: result.data ? mapInventoryStockSettingRow(result.data) : null
  };
}

export async function listInventoryTransactions(
  client: AppSupabaseClient,
  companyId: string,
  query: InventoryTransactionsQuery = {}
) {
  const parsed = inventoryTransactionsQuerySchema.parse(query);
  let builder = client
    .from("inventory_transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (parsed.inventoryItemId) builder = builder.eq("inventory_item_id", parsed.inventoryItemId);
  if (parsed.stockLocationId) builder = builder.eq("stock_location_id", parsed.stockLocationId);
  if (parsed.jobId) builder = builder.eq("job_id", parsed.jobId);
  if (parsed.sourceType) builder = builder.eq("source_type", parsed.sourceType);
  if (parsed.transactionType) builder = builder.eq("transaction_type", parsed.transactionType);
  if (parsed.limit) builder = builder.limit(parsed.limit);

  const result = await builder.returns<InventoryTransactionRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryTransactionRow) : null
  };
}

export async function createInventoryAdjustment(
  client: AppSupabaseClient,
  input: CreateInventoryAdjustmentInput
) {
  const parsed = createInventoryAdjustmentInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["create_inventory_adjustment"]["Args"] = {
    target_company_id: parsed.companyId,
    target_created_by_user_id: parsed.createdByUserId,
    target_inventory_item_id: parsed.inventoryItemId,
    target_quantity: parsed.quantity,
    target_stock_location_id: parsed.stockLocationId,
    target_transaction_type: parsed.transactionType
  };

  if (parsed.unitCostCents !== null && typeof parsed.unitCostCents === "number") {
    rpcArgs.target_unit_cost_cents = parsed.unitCostCents;
  }

  if (parsed.notes) {
    rpcArgs.target_notes = parsed.notes;
  }

  if (parsed.effectiveAt) {
    rpcArgs.target_effective_at = parsed.effectiveAt;
  }

  const rpcResult = await client.rpc("create_inventory_adjustment", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("inventory_transactions")
    .select("*")
    .eq("id", rpcResult.data)
    .single<InventoryTransactionRow>();

  return {
    ...result,
    data: result.data ? mapInventoryTransactionRow(result.data) : null
  };
}

export async function listOpenInventoryReservationsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("inventory_reservations")
    .select("*")
    .eq("company_id", companyId)
    .gt("quantity_reserved", 0)
    .returns<InventoryReservationRow[]>();

  const reservations = (result.data ?? [])
    .map(mapInventoryReservationRow)
    .filter((reservation) => getOpenReservationQuantity(reservation) > 0);

  return {
    ...result,
    data: reservations
  };
}

export async function listInventoryReservationsByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("inventory_reservations")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<InventoryReservationRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryReservationRow) : null
  };
}

export async function createInventoryReservation(
  client: AppSupabaseClient,
  input: CreateInventoryReservationInput
) {
  const parsed = createInventoryReservationInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["reserve_inventory_for_job"]["Args"] = {
    target_company_id: parsed.companyId,
    target_created_by_user_id: parsed.createdByUserId,
    target_inventory_item_id: parsed.inventoryItemId,
    target_job_id: parsed.jobId,
    target_quantity_reserved: parsed.quantityReserved,
    target_stock_location_id: parsed.stockLocationId
  };

  if (parsed.notes) {
    rpcArgs.target_notes = parsed.notes;
  }

  if (parsed.partRequestLineId) {
    rpcArgs.target_part_request_line_id = parsed.partRequestLineId;
  }

  const rpcResult = await client.rpc("reserve_inventory_for_job", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const reservationResult = await client
    .from("inventory_reservations")
    .select("*")
    .eq("id", rpcResult.data)
    .single<InventoryReservationRow>();

  return {
    ...reservationResult,
    data: reservationResult.data ? mapInventoryReservationRow(reservationResult.data) : null
  };
}

export async function releaseInventoryReservation(
  client: AppSupabaseClient,
  input: ReleaseInventoryReservationInput
) {
  const parsed = releaseInventoryReservationInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["release_inventory_reservation"]["Args"] = {
    target_quantity_released: parsed.quantityReleased,
    target_reservation_id: parsed.reservationId
  };

  const rpcResult = await client.rpc("release_inventory_reservation", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const reservationResult = await client
    .from("inventory_reservations")
    .select("*")
    .eq("id", parsed.reservationId)
    .single<InventoryReservationRow>();

  return {
    ...reservationResult,
    data: reservationResult.data ? mapInventoryReservationRow(reservationResult.data) : null
  };
}

export async function consumeReservedInventory(
  client: AppSupabaseClient,
  input: {
    reservationId: string;
    quantityConsumed: number;
    createdByUserId: string;
    effectiveAt?: string | null | undefined;
    notes?: string | null | undefined;
  }
) {
  const rpcArgs: Database["public"]["Functions"]["consume_inventory_reservation"]["Args"] = {
    target_created_by_user_id: input.createdByUserId,
    target_quantity_consumed: input.quantityConsumed,
    target_reservation_id: input.reservationId
  };

  if (input.effectiveAt) {
    rpcArgs.target_effective_at = input.effectiveAt;
  }

  if (input.notes) {
    rpcArgs.target_notes = input.notes;
  }

  const rpcResult = await client.rpc("consume_inventory_reservation", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const [reservationResult, transactionResult] = await Promise.all([
    client
      .from("inventory_reservations")
      .select("*")
      .eq("id", input.reservationId)
      .single<InventoryReservationRow>(),
    client
      .from("inventory_transactions")
      .select("*")
      .eq("id", rpcResult.data)
      .single<InventoryTransactionRow>()
  ]);

  if (reservationResult.error || !reservationResult.data) {
    return { ...reservationResult, data: null };
  }

  if (transactionResult.error || !transactionResult.data) {
    return { ...transactionResult, data: null };
  }

  return {
    data: {
      reservation: mapInventoryReservationRow(reservationResult.data),
      transaction: mapInventoryTransactionRow(transactionResult.data)
    },
    error: null
  };
}

async function listCompanyInventoryState(client: AppSupabaseClient, companyId: string) {
  const [itemsResult, locationsResult, aliasesResult, settingsResult, transactionsResult, reservationsResult] =
    await Promise.all([
      listInventoryItemsByCompany(client, companyId, { includeInactive: true }),
      listStockLocationsByCompany(client, companyId),
      client
        .from("inventory_item_aliases")
        .select("*")
        .eq("company_id", companyId)
        .returns<InventoryItemAliasRow[]>(),
      listInventoryStockSettingsByCompany(client, companyId),
      listInventoryTransactions(client, companyId),
      listOpenInventoryReservationsByCompany(client, companyId)
    ]);

  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (aliasesResult.error) throw aliasesResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (reservationsResult.error) throw reservationsResult.error;

  return {
    items: itemsResult.data ?? [],
    locations: locationsResult.data ?? [],
    aliases: (aliasesResult.data ?? []).map(mapInventoryItemAliasRow),
    settings: settingsResult.data ?? [],
    transactions: transactionsResult.data ?? [],
    reservations: reservationsResult.data ?? []
  };
}

export async function getInventoryItemBalances(
  client: AppSupabaseClient,
  companyId: string,
  inventoryItemId?: string
) {
  const state = await listCompanyInventoryState(client, companyId);
  const items = inventoryItemId ? state.items.filter((item) => item.id === inventoryItemId) : state.items;
  const { onHandByPair, reservedByPair } = buildBalanceMaps(state.transactions, state.reservations);
  const settingsByItemLocationKey = new Map<string, InventoryStockSetting>(
    state.settings.map((setting) => [`${setting.inventoryItemId}:${setting.stockLocationId}`, setting])
  );

  const balances: InventoryBalance[] = [];

  for (const item of items) {
    const locationIds = state.locations.map((location) => location.id);
    const onHandByLocationId = new Map<string, number>();
    const reservedByLocationId = new Map<string, number>();
    const settingsByLocationId = new Map<string, InventoryStockSetting>();

    for (const locationId of locationIds) {
      const key = `${item.id}:${locationId}`;
      onHandByLocationId.set(locationId, onHandByPair.get(key) ?? 0);
      reservedByLocationId.set(locationId, reservedByPair.get(key) ?? 0);

      const setting = settingsByItemLocationKey.get(key);
      if (setting) {
        settingsByLocationId.set(locationId, setting);
      }
    }

    balances.push(
      ...calculateInventoryBalancesByLocation({
        inventoryItemId: item.id,
        stockLocationIds: locationIds,
        onHandByLocationId,
        reservedByLocationId,
        stockSettingsByLocationId: settingsByLocationId,
        reorderStatusResolver: ({ availableQuantity, lowStockThresholdQuantity, reorderPointQuantity }) =>
          calculateReorderStatus({
            availableQuantity,
            lowStockThresholdQuantity,
            reorderPointQuantity
          })
      })
    );
  }

  return { data: balances, error: null };
}

export async function getInventoryLocationBalances(
  client: AppSupabaseClient,
  companyId: string,
  stockLocationId?: string
) {
  const balanceResult = await getInventoryItemBalances(client, companyId);

  if (balanceResult.error) {
    return balanceResult;
  }

  return {
    data: (balanceResult.data ?? []).filter((balance) =>
      stockLocationId ? balance.stockLocationId === stockLocationId : true
    ),
    error: null
  };
}

export async function getLowStockInventoryRows(client: AppSupabaseClient, companyId: string) {
  const state = await listCompanyInventoryState(client, companyId);
  const balancesResult = await getInventoryItemBalances(client, companyId);
  const balances = balancesResult.data ?? [];
  const itemById = new Map(state.items.map((item) => [item.id, item]));
  const locationById = new Map(state.locations.map((location) => [location.id, location]));

  const rows: InventoryReorderRow[] = balances
    .filter((balance) => isLowStock(balance.reorderStatus))
    .map((balance) => ({
      item: itemById.get(balance.inventoryItemId)!,
      location: locationById.get(balance.stockLocationId)!,
      balance
    }))
    .filter((row) => Boolean(row.item) && Boolean(row.location))
    .filter(
      (row) =>
        row.item.isActive &&
        row.item.itemType === "stocked" &&
        row.location.isActive
    );

  return { data: rows, error: null };
}

export async function getInventoryWorkspaceSummary(client: AppSupabaseClient, companyId: string) {
  const state = await listCompanyInventoryState(client, companyId);
  const balancesResult = await getInventoryItemBalances(client, companyId);
  const balances = balancesResult.data ?? [];
  const activeItemIds = new Set(
    state.items
      .filter((item) => item.isActive && item.itemType === "stocked")
      .map((item) => item.id)
  );
  const activeLocationIds = new Set(
    state.locations.filter((location) => location.isActive).map((location) => location.id)
  );
  const activeBalances = balances.filter(
    (balance) =>
      activeItemIds.has(balance.inventoryItemId) && activeLocationIds.has(balance.stockLocationId)
  );

  const summary: InventoryWorkspaceSummary = {
    itemCount: state.items.filter((item) => item.isActive && item.itemType === "stocked").length,
    locationCount: state.locations.filter((location) => location.isActive).length,
    lowStockCount: activeBalances.filter((balance) => isLowStock(balance.reorderStatus)).length,
    totalOnHandQuantity: activeBalances.reduce((total, balance) => total + balance.onHandQuantity, 0),
    totalReservedQuantity: activeBalances.reduce(
      (total, balance) => total + balance.reservedQuantity,
      0
    ),
    totalAvailableQuantity: activeBalances.reduce(
      (total, balance) => total + balance.availableQuantity,
      0
    )
  };

  return { data: summary, error: null };
}

export async function getInventoryLookup(
  client: AppSupabaseClient,
  companyId: string,
  query: InventoryLookupQuery = {}
) {
  const [itemsResult, aliasesResult, balancesResult] = await Promise.all([
    listInventoryItemsByCompany(client, companyId, query),
    client
      .from("inventory_item_aliases")
      .select("*")
      .eq("company_id", companyId)
      .returns<InventoryItemAliasRow[]>(),
    getInventoryItemBalances(client, companyId)
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (aliasesResult.error) throw aliasesResult.error;
  if (balancesResult.error) throw balancesResult.error;

  const aliasesByItemId = new Map<string, InventoryItemAlias[]>();
  for (const alias of (aliasesResult.data ?? []).map(mapInventoryItemAliasRow)) {
    const aliases = aliasesByItemId.get(alias.inventoryItemId) ?? [];
    aliases.push(alias);
    aliasesByItemId.set(alias.inventoryItemId, aliases);
  }

  const filteredBalances = (balancesResult.data ?? []).filter((balance) =>
    query.stockLocationId ? balance.stockLocationId === query.stockLocationId : true
  );

  const balancesByItemId = new Map<string, InventoryBalance[]>();
  for (const balance of filteredBalances) {
    const balances = balancesByItemId.get(balance.inventoryItemId) ?? [];
    balances.push(balance);
    balancesByItemId.set(balance.inventoryItemId, balances);
  }

  let rows: InventoryLookupResult[] = (itemsResult.data ?? []).map((item) => ({
    item,
    aliases: aliasesByItemId.get(item.id) ?? [],
    balances: balancesByItemId.get(item.id) ?? []
  }));

  if (query.lowStockOnly) {
    rows = rows.filter((row) => row.balances.some((balance) => isLowStock(balance.reorderStatus)));
  }

  return { data: rows, error: null };
}

export async function getInventoryItemWithBalances(
  client: AppSupabaseClient,
  companyId: string,
  itemId: string
) {
  const [itemResult, aliasesResult, balancesResult] = await Promise.all([
    getInventoryItemById(client, itemId),
    listInventoryItemAliasesByItemId(client, itemId),
    getInventoryItemBalances(client, companyId, itemId)
  ]);

  if (itemResult.error) return { ...itemResult, data: null };
  if (aliasesResult.error) return { ...aliasesResult, data: null };
  if (balancesResult.error) return { ...balancesResult, data: null };
  if (!itemResult.data) return { data: null, error: null };

  const data: InventoryItemWithBalances = {
    item: itemResult.data,
    aliases: aliasesResult.data ?? [],
    balances: balancesResult.data ?? [],
    totalOnHandQuantity: (balancesResult.data ?? []).reduce((total, balance) => total + balance.onHandQuantity, 0),
    totalReservedQuantity: (balancesResult.data ?? []).reduce(
      (total, balance) => total + balance.reservedQuantity,
      0
    ),
    totalAvailableQuantity: (balancesResult.data ?? []).reduce(
      (total, balance) => total + balance.availableQuantity,
      0
    )
  };

  return { data, error: null };
}

async function getReceivedToInventoryQuantityForPurchaseOrderLine(
  client: AppSupabaseClient,
  purchaseOrderLineId: string
) {
  const result = await client
    .from("inventory_transactions")
    .select("quantity_delta")
    .eq("purchase_order_line_id", purchaseOrderLineId)
    .eq("transaction_type", "purchase_receipt")
    .returns<Array<Pick<InventoryTransactionRow, "quantity_delta">>>();

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).reduce((total, row) => total + Number(row.quantity_delta), 0);
}

async function getReturnedFromInventoryQuantityForPurchaseOrderLine(
  client: AppSupabaseClient,
  purchaseOrderLineId: string
) {
  const result = await client
    .from("inventory_transactions")
    .select("quantity_delta")
    .eq("purchase_order_line_id", purchaseOrderLineId)
    .eq("transaction_type", "purchase_return")
    .returns<Array<Pick<InventoryTransactionRow, "quantity_delta">>>();

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).reduce((total, row) => total + Math.abs(Number(row.quantity_delta)), 0);
}

export async function receivePurchasedInventory(
  client: AppSupabaseClient,
  input: ReceivePurchasedInventoryInput
) {
  const parsed = receivePurchasedInventoryInputSchema.parse(input);
  if (!parsed.purchaseReceiptLineId) {
    throw new Error("Record and select a purchase receipt line before receiving this part into inventory.");
  }

  const rpcArgs: Database["public"]["Functions"]["receive_purchased_inventory"]["Args"] = {
    target_company_id: parsed.companyId,
    target_created_by_user_id: parsed.createdByUserId,
    target_inventory_item_id: parsed.inventoryItemId,
    target_purchase_order_line_id: parsed.purchaseOrderLineId,
    target_purchase_receipt_line_id: parsed.purchaseReceiptLineId,
    target_quantity_received: parsed.quantityReceived,
    target_stock_location_id: parsed.stockLocationId
  };

  if (parsed.unitCostCents !== null && typeof parsed.unitCostCents === "number") {
    rpcArgs.target_unit_cost_cents = parsed.unitCostCents;
  }

  if (parsed.notes) {
    rpcArgs.target_notes = parsed.notes;
  }

  if (parsed.effectiveAt) {
    rpcArgs.target_effective_at = parsed.effectiveAt;
  }

  const rpcResult = await client.rpc("receive_purchased_inventory", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const transactionResult = await client
    .from("inventory_transactions")
    .select("*")
    .eq("id", rpcResult.data)
    .single<InventoryTransactionRow>();

  return {
    ...transactionResult,
    data: transactionResult.data ? mapInventoryTransactionRow(transactionResult.data) : null
  };
}

export async function findInventoryItemForProcurementLine(
  client: AppSupabaseClient,
  companyId: string,
  line:
    | { inventoryItemId: string | null; partNumber: string | null; supplierSku?: string | null }
    | { inventoryItemId: string | null; partNumber: string | null; supplierPartNumber?: string | null }
) {
  const [itemsResult, aliasesResult] = await Promise.all([
    listInventoryItemsByCompany(client, companyId, { includeInactive: true }),
    client
      .from("inventory_item_aliases")
      .select("*")
      .eq("company_id", companyId)
      .returns<InventoryItemAliasRow[]>()
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (aliasesResult.error) throw aliasesResult.error;

  const candidate = resolveInventoryItemCandidateFromProcurementLine(line as never);
  const items = itemsResult.data ?? [];
  const aliases = (aliasesResult.data ?? []).map(mapInventoryItemAliasRow);

  if (candidate.explicitInventoryItemId) {
    return items.find((item) => item.id === candidate.explicitInventoryItemId) ?? null;
  }

  const matchedByPartNumber = matchInventoryItemByPartNumber(items, candidate.normalizedPartNumber);
  if (matchedByPartNumber) {
    return matchedByPartNumber;
  }

  const matchedAlias = matchInventoryItemByAlias(aliases, candidate.normalizedAlias);
  if (!matchedAlias) {
    return null;
  }

  return items.find((item) => item.id === matchedAlias.inventoryItemId) ?? null;
}

export async function getJobInventorySummary(client: AppSupabaseClient, companyId: string, jobId: string) {
  const [reservationsResult, itemsResult, locationsResult, balancesResult] = await Promise.all([
    listInventoryReservationsByJobId(client, jobId),
    listInventoryItemsByCompany(client, companyId, { includeInactive: true }),
    listStockLocationsByCompany(client, companyId),
    getInventoryItemBalances(client, companyId)
  ]);

  if (reservationsResult.error) throw reservationsResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (balancesResult.error) throw balancesResult.error;

  const itemById = new Map((itemsResult.data ?? []).map((item) => [item.id, item]));
  const locationById = new Map((locationsResult.data ?? []).map((location) => [location.id, location]));
  const balanceByPair = new Map(
    (balancesResult.data ?? []).map((balance) => [`${balance.inventoryItemId}:${balance.stockLocationId}`, balance] as const)
  );

  const reservations = (reservationsResult.data ?? []).map((reservation) => ({
    reservation,
    item: itemById.get(reservation.inventoryItemId)!,
    location: locationById.get(reservation.stockLocationId)!,
    balance: balanceByPair.get(`${reservation.inventoryItemId}:${reservation.stockLocationId}`) ?? null
  }));

  const data: JobInventorySummary = {
    jobId,
    reservations,
    totalReservedQuantity: reservations.reduce(
      (total, entry) => total + getOpenReservationQuantity(entry.reservation),
      0
    ),
    openReservationCount: reservations.filter(
      (entry) => getOpenReservationQuantity(entry.reservation) > 0
    ).length
  };

  return { data, error: null };
}
