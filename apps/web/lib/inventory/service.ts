import {
  type AppSupabaseClient,
  createInventoryItem,
  createInventoryItemAlias,
  createInventoryReservation,
  createStockLocation,
  createInventoryAdjustment,
  getInventoryItemBalances,
  getInventoryItemById,
  getInventoryItemWithBalances,
  getInventoryLookup,
  getInventoryWorkspaceSummary,
  getJobInventorySummary as getJobInventorySummaryRecord,
  getLowStockInventoryRows,
  listInventoryItemAliasesByItemId,
  listInventoryItemsByCompany,
  listInventoryReservationsByJobId,
  listInventoryStockSettingsByItemId,
  listInventoryTransactions,
  listStockLocationsByCompany,
  receivePurchasedInventory,
  releaseInventoryReservation,
  updateInventoryItem,
  updateStockLocation,
  upsertInventoryStockSetting
} from "@mobile-mechanic/api-client";
import type {
  CreateInventoryAdjustmentInput,
  CreateInventoryItemAliasInput,
  CreateInventoryItemInput,
  CreateInventoryReservationInput,
  CreateStockLocationInput,
  InventoryLookupQuery,
  ReceivePurchasedInventoryInput,
  ReleaseInventoryReservationInput,
  UpdateInventoryItemInput,
  UpdateStockLocationInput,
  UpsertInventoryStockSettingInput
} from "@mobile-mechanic/types";

export async function getInventoryWorkspace(client: AppSupabaseClient, companyId: string) {
  const [summaryResult, lowStockResult, transactionsResult, locationsResult] = await Promise.all([
    getInventoryWorkspaceSummary(client, companyId),
    getLowStockInventoryRows(client, companyId),
    listInventoryTransactions(client, companyId, { limit: 12 }),
    listStockLocationsByCompany(client, companyId)
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (lowStockResult.error) throw lowStockResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    summary: summaryResult.data,
    lowStockRows: lowStockResult.data ?? [],
    recentTransactions: transactionsResult.data ?? [],
    locations: locationsResult.data ?? []
  };
}

export async function getInventoryLookupWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  query: InventoryLookupQuery = {}
) {
  const [lookupResult, locationsResult] = await Promise.all([
    getInventoryLookup(client, companyId, query),
    listStockLocationsByCompany(client, companyId)
  ]);

  if (lookupResult.error) throw lookupResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    rows: lookupResult.data ?? [],
    locations: locationsResult.data ?? []
  };
}

export async function getInventoryItemDetail(client: AppSupabaseClient, companyId: string, itemId: string) {
  const [itemResult, transactionsResult, settingsResult, locationsResult] = await Promise.all([
    getInventoryItemWithBalances(client, companyId, itemId),
    listInventoryTransactions(client, companyId, { inventoryItemId: itemId, limit: 24 }),
    listInventoryStockSettingsByItemId(client, companyId, itemId),
    listStockLocationsByCompany(client, companyId)
  ]);

  if (itemResult.error) throw itemResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    item: itemResult.data,
    transactions: transactionsResult.data ?? [],
    stockSettings: settingsResult.data ?? [],
    locations: locationsResult.data ?? []
  };
}

export async function getJobInventoryDetail(client: AppSupabaseClient, companyId: string, jobId: string) {
  const [
    summaryResult,
    itemsResult,
    locationsResult,
    balancesResult,
    requestLinesResult,
    requestStatusesResult
  ] = await Promise.all([
    getJobInventorySummaryRecord(client, companyId, jobId),
    listInventoryItemsByCompany(client, companyId, { includeInactive: true }),
    listStockLocationsByCompany(client, companyId),
    getInventoryItemBalances(client, companyId),
    client
      .from("part_request_lines")
      .select(
        "id, part_request_id, description, inventory_item_id, quantity_requested, quantity_installed, quantity_returned, quantity_reserved_from_stock, quantity_consumed_from_stock, quantity_returned_to_inventory, part_number, supplier_sku"
      )
      .eq("job_id", jobId)
      .returns<
        Array<{
          id: string;
          part_request_id: string;
          description: string;
          inventory_item_id: string | null;
          quantity_requested: number;
          quantity_installed: number;
          quantity_returned: number;
          quantity_reserved_from_stock: number;
          quantity_consumed_from_stock: number;
          quantity_returned_to_inventory: number;
          part_number: string | null;
          supplier_sku: string | null;
        }>
      >(),
    client
      .from("part_requests")
      .select("id, status")
      .eq("job_id", jobId)
      .returns<Array<{ id: string; status: "open" | "fulfilled" | "canceled" }>>()
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (balancesResult.error) throw balancesResult.error;
  if (requestLinesResult.error) throw requestLinesResult.error;
  if (requestStatusesResult.error) throw requestStatusesResult.error;

  const openReservedQuantityByRequestLineId = new Map<string, number>();
  const activeReservationLocationsByRequestLineId = new Map<
    string,
    Array<{ id: string; name: string; isActive: boolean }>
  >();
  const requestStatusById = new Map(
    (requestStatusesResult.data ?? []).map((request) => [request.id, request.status])
  );

  for (const entry of summaryResult.data?.reservations ?? []) {
    if (!entry.reservation.partRequestLineId) {
      continue;
    }

    const openQuantity = Math.max(
      entry.reservation.quantityReserved -
        entry.reservation.quantityReleased -
        entry.reservation.quantityConsumed,
      0
    );

    openReservedQuantityByRequestLineId.set(
      entry.reservation.partRequestLineId,
      (openReservedQuantityByRequestLineId.get(entry.reservation.partRequestLineId) ?? 0) + openQuantity
    );

    if (openQuantity > 0) {
      const locations = activeReservationLocationsByRequestLineId.get(entry.reservation.partRequestLineId) ?? [];

      if (!locations.some((location) => location.id === entry.location.id)) {
        locations.push({
          id: entry.location.id,
          name: entry.location.name,
          isActive: entry.location.isActive
        });
      }

      activeReservationLocationsByRequestLineId.set(entry.reservation.partRequestLineId, locations);
    }
  }

  return {
    summary: summaryResult.data,
    inventoryItems: itemsResult.data ?? [],
    locations: locationsResult.data ?? [],
    balances: balancesResult.data ?? [],
    requestLines: (requestLinesResult.data ?? []).map((line) => {
      const requestedQuantity = Number(line.quantity_requested);
      const openReservedQuantity = openReservedQuantityByRequestLineId.get(line.id) ?? 0;
      const consumedFromStockQuantity = Number(line.quantity_consumed_from_stock);
      const returnedToInventoryQuantity = Number(line.quantity_returned_to_inventory);
      const netConsumedFromStockQuantity = Math.max(
        consumedFromStockQuantity - returnedToInventoryQuantity,
        0
      );
      const installedQuantity = Number(line.quantity_installed);
      const requestStatus = requestStatusById.get(line.part_request_id) ?? "open";
      const remainingReservableQuantity =
        requestStatus === "open"
          ? Math.max(
              requestedQuantity - installedQuantity - openReservedQuantity - netConsumedFromStockQuantity,
              0
            )
          : 0;

      return {
        ...line,
        quantity_requested: requestedQuantity,
        quantity_installed: installedQuantity,
        quantity_reserved_from_stock: Number(line.quantity_reserved_from_stock),
        quantity_consumed_from_stock: consumedFromStockQuantity,
        quantity_returned_to_inventory: returnedToInventoryQuantity,
        netConsumedFromStockQuantity,
        openReservedQuantity,
        activeReservationLocations: activeReservationLocationsByRequestLineId.get(line.id) ?? [],
        remainingReservableQuantity,
        requestStatus
      };
    })
  };
}

export async function receivePurchaseOrderLineIntoInventory(
  client: AppSupabaseClient,
  input: ReceivePurchasedInventoryInput
) {
  return receivePurchasedInventory(client, input);
}

export async function reserveInventoryForPartRequestLine(
  client: AppSupabaseClient,
  input: CreateInventoryReservationInput
) {
  return createInventoryReservation(client, input);
}

export async function releaseInventoryReservationById(
  client: AppSupabaseClient,
  input: ReleaseInventoryReservationInput
) {
  return releaseInventoryReservation(client, input);
}

export async function createInventoryItemRecord(client: AppSupabaseClient, input: CreateInventoryItemInput) {
  return createInventoryItem(client, input);
}

export async function updateInventoryItemRecord(
  client: AppSupabaseClient,
  itemId: string,
  input: UpdateInventoryItemInput
) {
  return updateInventoryItem(client, itemId, input);
}

export async function createInventoryAliasRecord(
  client: AppSupabaseClient,
  input: CreateInventoryItemAliasInput
) {
  return createInventoryItemAlias(client, input);
}

export async function createStockLocationRecord(client: AppSupabaseClient, input: CreateStockLocationInput) {
  return createStockLocation(client, input);
}

export async function updateStockLocationRecord(
  client: AppSupabaseClient,
  locationId: string,
  input: UpdateStockLocationInput
) {
  return updateStockLocation(client, locationId, input);
}

export async function upsertInventoryStockSettingRecord(
  client: AppSupabaseClient,
  input: UpsertInventoryStockSettingInput
) {
  return upsertInventoryStockSetting(client, input);
}

export async function createInventoryAdjustmentRecord(
  client: AppSupabaseClient,
  input: CreateInventoryAdjustmentInput
) {
  return createInventoryAdjustment(client, input);
}

export async function listInventoryItemAliasesForItem(client: AppSupabaseClient, itemId: string) {
  return listInventoryItemAliasesByItemId(client, itemId);
}

export async function listJobInventoryReservations(client: AppSupabaseClient, jobId: string) {
  return listInventoryReservationsByJobId(client, jobId);
}

export async function getInventoryItemRecord(client: AppSupabaseClient, itemId: string) {
  return getInventoryItemById(client, itemId);
}
