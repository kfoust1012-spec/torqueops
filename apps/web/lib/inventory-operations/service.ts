import {
  type AppSupabaseClient,
  cancelInventoryTransfer,
  createInventoryCycleCount,
  createInventoryTransfer,
  createJobInventoryIssue,
  getInventoryCycleCountById,
  getInventoryItemBalances,
  getInventoryTransferById,
  getInventoryTransferWorkspaceSummary,
  getLocationInventoryBalances,
  getLowStockByLocation,
  getVanStockSummaryByTechnician,
  listCoreInventoryEventsByPurchaseOrderId,
  listCoreInventoryEventsByJobId,
  listInventoryCycleCountsByCompany,
  listInventoryItemsByCompany,
  listInventoryTransactions,
  listInventoryTransfersByCompany,
  listJobInventoryIssuesByJobId,
  listStockLocationsByCompany,
  recordCoreInventoryHold,
  recordCoreInventoryReturn,
  receiveInventoryTransfer,
  shipInventoryTransfer,
  returnIssuedInventory,
  consumeIssuedInventory
} from "@mobile-mechanic/api-client";
import type {
  CancelInventoryTransferInput,
  CreateInventoryCycleCountInput,
  CreateInventoryTransferInput,
  CreateJobInventoryIssueInput,
  ReceiveInventoryTransferInput,
  RecordCoreInventoryHoldInput,
  RecordCoreInventoryReturnInput,
  ReturnIssuedInventoryInput,
  ShipInventoryTransferInput,
  TransferWorkspaceQuery
} from "@mobile-mechanic/types";

import { getJobInventoryDetail } from "../inventory/service";

export async function getInventoryOperationsWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  query: TransferWorkspaceQuery = {}
) {
  const [transferSummaryResult, transfersResult, lowStockByLocationResult, vanSummaryResult, locationsResult] =
    await Promise.all([
      getInventoryTransferWorkspaceSummary(client, companyId),
      listInventoryTransfersByCompany(client, companyId, query),
      getLowStockByLocation(client, companyId),
      getVanStockSummaryByTechnician(client, companyId),
      listStockLocationsByCompany(client, companyId)
    ]);

  if (transferSummaryResult.error) throw transferSummaryResult.error;
  if (transfersResult.error) throw transfersResult.error;
  if (lowStockByLocationResult.error) throw lowStockByLocationResult.error;
  if (vanSummaryResult.error) throw vanSummaryResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    transferSummary: transferSummaryResult.data,
    transfers: transfersResult.data ?? [],
    lowStockByLocation: lowStockByLocationResult.data ?? [],
    vanSummaries: vanSummaryResult.data ?? [],
    locations: locationsResult.data ?? []
  };
}

export async function getInventoryTransferDetail(
  client: AppSupabaseClient,
  transferId: string
) {
  const detailResult = await getInventoryTransferById(client, transferId);
  if (detailResult.error) throw detailResult.error;
  return detailResult.data;
}

export async function getInventoryLocationDetail(
  client: AppSupabaseClient,
  companyId: string,
  locationId: string
) {
  const [locationsResult, balancesResult, transactionsResult, cycleCountsResult, transfersResult, itemsResult] =
    await Promise.all([
      listStockLocationsByCompany(client, companyId),
      getLocationInventoryBalances(client, companyId, locationId),
      listInventoryTransactions(client, companyId, { stockLocationId: locationId, limit: 50 }),
      listInventoryCycleCountsByCompany(client, companyId, locationId),
      listInventoryTransfersByCompany(client, companyId, { stockLocationId: locationId }),
      listInventoryItemsByCompany(client, companyId, { includeInactive: true })
    ]);

  if (locationsResult.error) throw locationsResult.error;
  if (balancesResult.error) throw balancesResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (cycleCountsResult.error) throw cycleCountsResult.error;
  if (transfersResult.error) throw transfersResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const location = (locationsResult.data ?? []).find((entry) => entry.id === locationId) ?? null;
  const itemById = new Map((itemsResult.data ?? []).map((item) => [item.id, item]));

  return {
    location,
    balances: balancesResult.data ?? [],
    balanceRows: (balancesResult.data ?? []).map((balance) => ({
      balance,
      item: itemById.get(balance.inventoryItemId) ?? null
    })),
    transactions: transactionsResult.data ?? [],
    cycleCounts: cycleCountsResult.data ?? [],
    transfers: transfersResult.data ?? []
  };
}

export async function getJobInventoryOperationsDetail(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string
) {
  const [inventoryDetail, issuesResult, coreEventsResult] = await Promise.all([
    getJobInventoryDetail(client, companyId, jobId),
    listJobInventoryIssuesByJobId(client, jobId),
    listCoreInventoryEventsByJobId(client, companyId, jobId)
  ]);

  if (issuesResult.error) throw issuesResult.error;
  if (coreEventsResult.error) throw coreEventsResult.error;

  const itemById = new Map(inventoryDetail.inventoryItems.map((item) => [item.id, item]));
  const locationById = new Map(inventoryDetail.locations.map((location) => [location.id, location]));

  return {
    ...inventoryDetail,
    issues: (issuesResult.data ?? []).map((issue) => ({
      issue,
      item: itemById.get(issue.inventoryItemId) ?? null,
      location: locationById.get(issue.stockLocationId) ?? null
    })),
    coreEvents: (coreEventsResult.data ?? []).map((event) => ({
      event,
      item: itemById.get(event.inventoryItemId) ?? null,
      location: locationById.get(event.stockLocationId) ?? null
    }))
  };
}

export async function getPurchaseOrderCoreInventoryEvents(
  client: AppSupabaseClient,
  companyId: string,
  purchaseOrderId: string
) {
  const result = await listCoreInventoryEventsByPurchaseOrderId(client, companyId, purchaseOrderId);
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function transferInventoryBetweenLocations(
  client: AppSupabaseClient,
  input: CreateInventoryTransferInput
) {
  return createInventoryTransfer(client, input);
}

export async function shipTransferInventory(
  client: AppSupabaseClient,
  input: ShipInventoryTransferInput
) {
  return shipInventoryTransfer(client, input);
}

export async function receiveTransferredInventory(
  client: AppSupabaseClient,
  input: ReceiveInventoryTransferInput
) {
  return receiveInventoryTransfer(client, input);
}

export async function cancelTransferInventory(
  client: AppSupabaseClient,
  input: CancelInventoryTransferInput
) {
  return cancelInventoryTransfer(client, input);
}

export async function issueInventoryToJob(
  client: AppSupabaseClient,
  input: CreateJobInventoryIssueInput
) {
  return createJobInventoryIssue(client, input);
}

export async function consumeIssuedInventoryForJob(
  client: AppSupabaseClient,
  input: { issueId: string; quantityConsumed: number; notes?: string | null | undefined }
) {
  return consumeIssuedInventory(client, input);
}

export async function returnUnusedInventoryFromJob(
  client: AppSupabaseClient,
  input: ReturnIssuedInventoryInput
) {
  return returnIssuedInventory(client, input);
}

export async function holdCoreInInventory(
  client: AppSupabaseClient,
  input: RecordCoreInventoryHoldInput
) {
  return recordCoreInventoryHold(client, input);
}

export async function returnCoreFromInventory(
  client: AppSupabaseClient,
  input: RecordCoreInventoryReturnInput
) {
  return recordCoreInventoryReturn(client, input);
}

export async function runInventoryCycleCount(
  client: AppSupabaseClient,
  input: CreateInventoryCycleCountInput
) {
  return createInventoryCycleCount(client, input);
}

export async function getInventoryCycleCountDetail(
  client: AppSupabaseClient,
  cycleCountId: string
) {
  const result = await getInventoryCycleCountById(client, cycleCountId);
  if (result.error) throw result.error;
  return result.data;
}
