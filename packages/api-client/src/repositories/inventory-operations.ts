import {
  buildLocationLowStockRows,
  buildVanStockSummary
} from "@mobile-mechanic/core";
import type {
  CancelInventoryTransferInput,
  CreateInventoryCycleCountInput,
  CreateInventoryTransferInput,
  CreateJobInventoryIssueInput,
  CoreInventoryEvent,
  Database,
  InventoryCycleCount,
  InventoryCycleCountDetail,
  InventoryCycleCountLine,
  InventoryTransfer,
  InventoryTransferDetail,
  InventoryTransferLine,
  InventoryTransferWorkspaceSummary,
  JobInventoryIssue,
  JobInventoryIssueDetail,
  LocationLowStockRow,
  ReceiveInventoryTransferInput,
  RecordCoreInventoryHoldInput,
  RecordCoreInventoryReturnInput,
  ReturnIssuedInventoryInput,
  ShipInventoryTransferInput,
  TechnicianVanStockSummary,
  TransferWorkspaceQuery
} from "@mobile-mechanic/types";
import {
  cancelInventoryTransferInputSchema,
  createInventoryCycleCountInputSchema,
  createInventoryTransferInputSchema,
  createJobInventoryIssueInputSchema,
  receiveInventoryTransferInputSchema,
  recordCoreInventoryHoldInputSchema,
  recordCoreInventoryReturnInputSchema,
  returnIssuedInventoryInputSchema,
  shipInventoryTransferInputSchema,
  transferWorkspaceQuerySchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";
import {
  getInventoryItemBalances,
  getLowStockInventoryRows,
  getInventoryLocationBalances,
  listInventoryItemsByCompany,
  listStockLocationsByCompany
} from "./inventory";

type InventoryTransferRow = Database["public"]["Tables"]["inventory_transfers"]["Row"];
type InventoryTransferLineRow = Database["public"]["Tables"]["inventory_transfer_lines"]["Row"];
type JobInventoryIssueRow = Database["public"]["Tables"]["job_inventory_issues"]["Row"];
type CoreInventoryEventRow = Database["public"]["Tables"]["core_inventory_events"]["Row"];
type InventoryCycleCountRow = Database["public"]["Tables"]["inventory_cycle_counts"]["Row"];
type InventoryCycleCountLineRow = Database["public"]["Tables"]["inventory_cycle_count_lines"]["Row"];

function mapInventoryTransferRow(row: InventoryTransferRow): InventoryTransfer {
  return {
    id: row.id,
    companyId: row.company_id,
    fromStockLocationId: row.from_stock_location_id,
    toStockLocationId: row.to_stock_location_id,
    status: row.status,
    referenceNumber: row.reference_number,
    requestedByUserId: row.requested_by_user_id,
    shippedByUserId: row.shipped_by_user_id,
    receivedByUserId: row.received_by_user_id,
    requestedAt: row.requested_at,
    shippedAt: row.shipped_at,
    receivedAt: row.received_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryTransferLineRow(row: InventoryTransferLineRow): InventoryTransferLine {
  return {
    id: row.id,
    transferId: row.transfer_id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    quantityRequested: Number(row.quantity_requested),
    quantityShipped: Number(row.quantity_shipped),
    quantityReceived: Number(row.quantity_received),
    unitCostCents: row.unit_cost_cents,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJobInventoryIssueRow(row: JobInventoryIssueRow): JobInventoryIssue {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    partRequestLineId: row.part_request_line_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    inventoryReservationId: row.inventory_reservation_id,
    status: row.status,
    quantityIssued: Number(row.quantity_issued),
    quantityConsumed: Number(row.quantity_consumed),
    quantityReturned: Number(row.quantity_returned),
    unitCostCents: row.unit_cost_cents,
    issuedByUserId: row.issued_by_user_id,
    issuedAt: row.issued_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCoreInventoryEventRow(row: CoreInventoryEventRow): CoreInventoryEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    purchaseOrderLineId: row.purchase_order_line_id,
    jobInventoryIssueId: row.job_inventory_issue_id,
    partRequestLineId: row.part_request_line_id,
    quantity: Number(row.quantity),
    status: row.status,
    heldByUserId: row.held_by_user_id,
    heldAt: row.held_at,
    returnedAt: row.returned_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryCycleCountRow(row: InventoryCycleCountRow): InventoryCycleCount {
  return {
    id: row.id,
    companyId: row.company_id,
    stockLocationId: row.stock_location_id,
    countedByUserId: row.counted_by_user_id,
    countedAt: row.counted_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInventoryCycleCountLineRow(row: InventoryCycleCountLineRow): InventoryCycleCountLine {
  return {
    id: row.id,
    cycleCountId: row.cycle_count_id,
    companyId: row.company_id,
    inventoryItemId: row.inventory_item_id,
    expectedQuantity: Number(row.expected_quantity),
    countedQuantity: Number(row.counted_quantity),
    varianceQuantity: Number(row.variance_quantity),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listInventoryTransfersByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: TransferWorkspaceQuery = {}
) {
  const parsed = transferWorkspaceQuerySchema.parse(query);
  let builder = client
    .from("inventory_transfers")
    .select("*")
    .eq("company_id", companyId)
    .order("requested_at", { ascending: false });

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.stockLocationId) {
    builder = builder.or(
      `from_stock_location_id.eq.${parsed.stockLocationId},to_stock_location_id.eq.${parsed.stockLocationId}`
    );
  }

  const result = await builder.returns<InventoryTransferRow[]>();
  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryTransferRow) : null
  };
}

export async function getInventoryTransferById(client: AppSupabaseClient, transferId: string) {
  const transferResult = await client
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .single<InventoryTransferRow>();

  if (transferResult.error || !transferResult.data) {
    return { ...transferResult, data: null };
  }

  const transfer = mapInventoryTransferRow(transferResult.data);
  const [lineResult, itemsResult, locationsResult, balancesResult] = await Promise.all([
    client
      .from("inventory_transfer_lines")
      .select("*")
      .eq("transfer_id", transferId)
      .order("created_at", { ascending: true })
      .returns<InventoryTransferLineRow[]>(),
    listInventoryItemsByCompany(client, transfer.companyId, { includeInactive: true }),
    listStockLocationsByCompany(client, transfer.companyId),
    getInventoryItemBalances(client, transfer.companyId)
  ]);

  if (lineResult.error) throw lineResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (balancesResult.error) throw balancesResult.error;

  const lines = (lineResult.data ?? []).map(mapInventoryTransferLineRow);
  const itemById = new Map((itemsResult.data ?? []).map((item) => [item.id, item]));
  const locationById = new Map((locationsResult.data ?? []).map((location) => [location.id, location]));
  const balanceByKey = new Map(
    (balancesResult.data ?? []).map((balance) => [
      `${balance.inventoryItemId}:${balance.stockLocationId}`,
      balance
    ])
  );

  const data: InventoryTransferDetail = {
    transfer,
    fromLocation: locationById.get(transfer.fromStockLocationId)!,
    toLocation: locationById.get(transfer.toStockLocationId)!,
    lines: lines.map((line) => ({
      line,
      item: itemById.get(line.inventoryItemId)!,
      fromBalance: balanceByKey.get(`${line.inventoryItemId}:${transfer.fromStockLocationId}`) ?? null,
      toBalance: balanceByKey.get(`${line.inventoryItemId}:${transfer.toStockLocationId}`) ?? null
    }))
  };

  return { data, error: null };
}

export async function createInventoryTransfer(
  client: AppSupabaseClient,
  input: CreateInventoryTransferInput
) {
  const parsed = createInventoryTransferInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["create_inventory_transfer"]["Args"] = {
    target_company_id: parsed.companyId,
    target_from_stock_location_id: parsed.fromStockLocationId,
    target_requested_by_user_id: parsed.requestedByUserId,
    target_to_stock_location_id: parsed.toStockLocationId,
    target_lines: parsed.lines.map((line) => ({
      inventory_item_id: line.inventoryItemId,
      quantity_requested: line.quantityRequested,
      unit_cost_cents: line.unitCostCents ?? null,
      notes: line.notes ?? null
    }))
  };

  if (parsed.referenceNumber) rpcArgs.target_reference_number = parsed.referenceNumber;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;

  const rpcResult = await client.rpc("create_inventory_transfer", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  return getInventoryTransferById(client, rpcResult.data);
}

export async function shipInventoryTransfer(
  client: AppSupabaseClient,
  input: ShipInventoryTransferInput
) {
  const parsed = shipInventoryTransferInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["ship_inventory_transfer"]["Args"] = {
    target_transfer_id: parsed.transferId,
    target_shipped_by_user_id: parsed.shippedByUserId,
    target_lines: parsed.lines.map((line) => ({
      transfer_line_id: line.transferLineId,
      quantity_shipped: line.quantityShipped,
      unit_cost_cents: line.unitCostCents ?? null,
      notes: line.notes ?? null
    }))
  };

  if (parsed.shippedAt) rpcArgs.target_shipped_at = parsed.shippedAt;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;

  const rpcResult = await client.rpc("ship_inventory_transfer", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  return getInventoryTransferById(client, rpcResult.data);
}

export async function receiveInventoryTransfer(
  client: AppSupabaseClient,
  input: ReceiveInventoryTransferInput
) {
  const parsed = receiveInventoryTransferInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["receive_inventory_transfer"]["Args"] = {
    target_transfer_id: parsed.transferId,
    target_received_by_user_id: parsed.receivedByUserId,
    target_lines: parsed.lines.map((line) => ({
      transfer_line_id: line.transferLineId,
      quantity_received: line.quantityReceived,
      notes: line.notes ?? null
    }))
  };

  if (parsed.receivedAt) rpcArgs.target_received_at = parsed.receivedAt;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;

  const rpcResult = await client.rpc("receive_inventory_transfer", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  return getInventoryTransferById(client, rpcResult.data);
}

export async function cancelInventoryTransfer(
  client: AppSupabaseClient,
  input: CancelInventoryTransferInput
) {
  const parsed = cancelInventoryTransferInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["cancel_inventory_transfer"]["Args"] = {
    target_transfer_id: parsed.transferId
  };

  if (parsed.notes) {
    rpcArgs.target_notes = parsed.notes;
  }

  const rpcResult = await client.rpc("cancel_inventory_transfer", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  return getInventoryTransferById(client, rpcResult.data);
}

export async function listJobInventoryIssuesByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("job_inventory_issues")
    .select("*")
    .eq("job_id", jobId)
    .order("issued_at", { ascending: false })
    .returns<JobInventoryIssueRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapJobInventoryIssueRow) : null
  };
}

export async function createJobInventoryIssue(
  client: AppSupabaseClient,
  input: CreateJobInventoryIssueInput
) {
  const parsed = createJobInventoryIssueInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["create_job_inventory_issue"]["Args"] = {
    target_company_id: parsed.companyId,
    target_inventory_reservation_id: parsed.inventoryReservationId,
    target_quantity_issued: parsed.quantityIssued,
    target_issued_by_user_id: parsed.issuedByUserId
  };

  if (parsed.issuedAt) rpcArgs.target_issued_at = parsed.issuedAt;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;

  const rpcResult = await client.rpc("create_job_inventory_issue", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("job_inventory_issues")
    .select("*")
    .eq("id", rpcResult.data)
    .single<JobInventoryIssueRow>();

  return {
    ...result,
    data: result.data ? mapJobInventoryIssueRow(result.data) : null
  };
}

export async function consumeIssuedInventory(
  client: AppSupabaseClient,
  input: { issueId: string; quantityConsumed: number; notes?: string | null | undefined }
) {
  const parsed = {
    issueId: input.issueId,
    quantityConsumed: input.quantityConsumed,
    notes: input.notes ?? null
  };
  const rpcResult = await client.rpc("consume_job_inventory_issue", {
    target_issue_id: parsed.issueId,
    target_quantity_consumed: parsed.quantityConsumed,
    ...(parsed.notes ? { target_notes: parsed.notes } : {})
  });

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("job_inventory_issues")
    .select("*")
    .eq("id", rpcResult.data)
    .single<JobInventoryIssueRow>();

  return {
    ...result,
    data: result.data ? mapJobInventoryIssueRow(result.data) : null
  };
}

export async function returnIssuedInventory(
  client: AppSupabaseClient,
  input: ReturnIssuedInventoryInput
) {
  const parsed = returnIssuedInventoryInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["return_job_inventory_issue"]["Args"] = {
    target_issue_id: parsed.issueId,
    target_quantity_returned: parsed.quantityReturned,
    target_returned_by_user_id: parsed.returnedByUserId
  };

  if (parsed.notes) rpcArgs.target_notes = parsed.notes;
  if (parsed.effectiveAt) rpcArgs.target_effective_at = parsed.effectiveAt;

  const rpcResult = await client.rpc("return_job_inventory_issue", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("job_inventory_issues")
    .select("*")
    .eq("id", rpcResult.data)
    .single<JobInventoryIssueRow>();

  return {
    ...result,
    data: result.data ? mapJobInventoryIssueRow(result.data) : null
  };
}

export async function getJobInventoryIssueDetail(
  client: AppSupabaseClient,
  issueId: string
) {
  const issueResult = await client
    .from("job_inventory_issues")
    .select("*")
    .eq("id", issueId)
    .single<JobInventoryIssueRow>();

  if (issueResult.error || !issueResult.data) {
    return { ...issueResult, data: null };
  }

  const issue = mapJobInventoryIssueRow(issueResult.data);
  const [itemsResult, locationsResult] = await Promise.all([
    listInventoryItemsByCompany(client, issue.companyId, { includeInactive: true }),
    listStockLocationsByCompany(client, issue.companyId)
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;

  const item = (itemsResult.data ?? []).find((entry) => entry.id === issue.inventoryItemId);
  const location = (locationsResult.data ?? []).find((entry) => entry.id === issue.stockLocationId);

  if (!item || !location) {
    throw new Error("Inventory issue detail is missing its linked item or stock location.");
  }

  const data: JobInventoryIssueDetail = {
    issue,
    item,
    location
  };

  return { data, error: null };
}

export async function listCoreInventoryEventsByJobId(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string
) {
  const [issuesResult, requestLinesResult] = await Promise.all([
    listJobInventoryIssuesByJobId(client, jobId),
    client
      .from("part_request_lines")
      .select("id")
      .eq("company_id", companyId)
      .eq("job_id", jobId)
      .returns<Array<{ id: string }>>()
  ]);

  if (issuesResult.error) throw issuesResult.error;
  if (requestLinesResult.error) throw requestLinesResult.error;

  const issueIds = (issuesResult.data ?? []).map((issue) => issue.id);
  const requestLineIds = (requestLinesResult.data ?? []).map((line) => line.id);

  let builder = client
    .from("core_inventory_events")
    .select("*")
    .eq("company_id", companyId)
    .order("held_at", { ascending: false });

  const filters: string[] = [];
  if (issueIds.length) {
    filters.push(`job_inventory_issue_id.in.(${issueIds.join(",")})`);
  }
  if (requestLineIds.length) {
    filters.push(`part_request_line_id.in.(${requestLineIds.join(",")})`);
  }

  if (!filters.length) {
    return { data: [] as CoreInventoryEvent[], error: null };
  }

  builder = builder.or(filters.join(","));
  const result = await builder.returns<CoreInventoryEventRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCoreInventoryEventRow) : null
  };
}

export async function listCoreInventoryEventsByPurchaseOrderId(
  client: AppSupabaseClient,
  companyId: string,
  purchaseOrderId: string
) {
  const poLinesResult = await client
    .from("purchase_order_lines")
    .select("id")
    .eq("company_id", companyId)
    .eq("purchase_order_id", purchaseOrderId)
    .returns<Array<{ id: string }>>();

  if (poLinesResult.error) {
    return { ...poLinesResult, data: null };
  }

  const poLineIds = (poLinesResult.data ?? []).map((line) => line.id);
  if (!poLineIds.length) {
    return { data: [] as CoreInventoryEvent[], error: null };
  }

  const result = await client
    .from("core_inventory_events")
    .select("*")
    .eq("company_id", companyId)
    .in("purchase_order_line_id", poLineIds)
    .order("held_at", { ascending: false })
    .returns<CoreInventoryEventRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCoreInventoryEventRow) : null
  };
}

export async function recordCoreInventoryHold(
  client: AppSupabaseClient,
  input: RecordCoreInventoryHoldInput
) {
  const parsed = recordCoreInventoryHoldInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["record_core_inventory_hold"]["Args"] = {
    target_company_id: parsed.companyId,
    target_held_by_user_id: parsed.heldByUserId,
    target_inventory_item_id: parsed.inventoryItemId,
    target_quantity: parsed.quantity,
    target_stock_location_id: parsed.stockLocationId
  };

  if (parsed.purchaseOrderLineId) rpcArgs.target_purchase_order_line_id = parsed.purchaseOrderLineId;
  if (parsed.jobInventoryIssueId) rpcArgs.target_job_inventory_issue_id = parsed.jobInventoryIssueId;
  if (parsed.partRequestLineId) rpcArgs.target_part_request_line_id = parsed.partRequestLineId;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;
  if (parsed.effectiveAt) rpcArgs.target_effective_at = parsed.effectiveAt;

  const rpcResult = await client.rpc("record_core_inventory_hold", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("core_inventory_events")
    .select("*")
    .eq("id", rpcResult.data)
    .single<CoreInventoryEventRow>();

  return {
    ...result,
    data: result.data ? mapCoreInventoryEventRow(result.data) : null
  };
}

export async function recordCoreInventoryReturn(
  client: AppSupabaseClient,
  input: RecordCoreInventoryReturnInput
) {
  const parsed = recordCoreInventoryReturnInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["record_core_inventory_return"]["Args"] = {
    target_core_event_id: parsed.coreEventId,
    target_returned_by_user_id: parsed.returnedByUserId
  };

  if (parsed.notes) rpcArgs.target_notes = parsed.notes;
  if (parsed.effectiveAt) rpcArgs.target_effective_at = parsed.effectiveAt;

  const rpcResult = await client.rpc("record_core_inventory_return", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const result = await client
    .from("core_inventory_events")
    .select("*")
    .eq("id", rpcResult.data)
    .single<CoreInventoryEventRow>();

  return {
    ...result,
    data: result.data ? mapCoreInventoryEventRow(result.data) : null
  };
}

export async function listInventoryCycleCountsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  stockLocationId?: string
) {
  let builder = client
    .from("inventory_cycle_counts")
    .select("*")
    .eq("company_id", companyId)
    .order("counted_at", { ascending: false });

  if (stockLocationId) {
    builder = builder.eq("stock_location_id", stockLocationId);
  }

  const result = await builder.returns<InventoryCycleCountRow[]>();
  return {
    ...result,
    data: result.data ? result.data.map(mapInventoryCycleCountRow) : null
  };
}

export async function getInventoryCycleCountById(
  client: AppSupabaseClient,
  cycleCountId: string
) {
  const cycleCountResult = await client
    .from("inventory_cycle_counts")
    .select("*")
    .eq("id", cycleCountId)
    .single<InventoryCycleCountRow>();

  if (cycleCountResult.error || !cycleCountResult.data) {
    return { ...cycleCountResult, data: null };
  }

  const cycleCount = mapInventoryCycleCountRow(cycleCountResult.data);
  const [linesResult, itemsResult, locationsResult] = await Promise.all([
    client
      .from("inventory_cycle_count_lines")
      .select("*")
      .eq("cycle_count_id", cycleCountId)
      .order("created_at", { ascending: true })
      .returns<InventoryCycleCountLineRow[]>(),
    listInventoryItemsByCompany(client, cycleCount.companyId, { includeInactive: true }),
    listStockLocationsByCompany(client, cycleCount.companyId)
  ]);

  if (linesResult.error) throw linesResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (locationsResult.error) throw locationsResult.error;

  const itemById = new Map((itemsResult.data ?? []).map((item) => [item.id, item]));
  const location = (locationsResult.data ?? []).find(
    (entry) => entry.id === cycleCount.stockLocationId
  );

  if (!location) {
    throw new Error("Cycle count detail is missing its stock location.");
  }

  const data: InventoryCycleCountDetail = {
    cycleCount,
    location,
    lines: (linesResult.data ?? []).map((line) => ({
      line: mapInventoryCycleCountLineRow(line),
      item: itemById.get(line.inventory_item_id)!
    }))
  };

  return { data, error: null };
}

export async function createInventoryCycleCount(
  client: AppSupabaseClient,
  input: CreateInventoryCycleCountInput
) {
  const parsed = createInventoryCycleCountInputSchema.parse(input);
  const rpcArgs: Database["public"]["Functions"]["create_inventory_cycle_count"]["Args"] = {
    target_company_id: parsed.companyId,
    target_counted_by_user_id: parsed.countedByUserId,
    target_stock_location_id: parsed.stockLocationId,
    target_lines: parsed.lines.map((line) => ({
      inventory_item_id: line.inventoryItemId,
      counted_quantity: line.countedQuantity,
      notes: line.notes ?? null
    }))
  };

  if (parsed.countedAt) rpcArgs.target_counted_at = parsed.countedAt;
  if (parsed.notes) rpcArgs.target_notes = parsed.notes;

  const rpcResult = await client.rpc("create_inventory_cycle_count", rpcArgs);
  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  return getInventoryCycleCountById(client, rpcResult.data);
}

export async function getInventoryTransferWorkspaceSummary(
  client: AppSupabaseClient,
  companyId: string
) {
  const transfersResult = await listInventoryTransfersByCompany(client, companyId);
  if (transfersResult.error) {
    return { ...transfersResult, data: null };
  }

  const transfers = transfersResult.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const data: InventoryTransferWorkspaceSummary = {
    draftCount: transfers.filter((transfer) => transfer.status === "draft").length,
    inTransitCount: transfers.filter((transfer) => transfer.status === "in_transit").length,
    receivedTodayCount: transfers.filter(
      (transfer) => transfer.receivedAt?.slice(0, 10) === today
    ).length
  };

  return { data, error: null };
}

export async function getLowStockByLocation(
  client: AppSupabaseClient,
  companyId: string
) {
  const [lowStockResult, locationsResult] = await Promise.all([
    getLowStockInventoryRows(client, companyId),
    listStockLocationsByCompany(client, companyId)
  ]);

  if (lowStockResult.error) return { ...lowStockResult, data: null };
  if (locationsResult.error) return { ...locationsResult, data: null };

  const data: LocationLowStockRow[] = buildLocationLowStockRows(
    locationsResult.data ?? [],
    (lowStockResult.data ?? []).map((row) => row.balance)
  );

  return { data, error: null };
}

export async function getVanStockSummaryByTechnician(
  client: AppSupabaseClient,
  companyId: string
) {
  const [locationsResult, balancesResult] = await Promise.all([
    listStockLocationsByCompany(client, companyId),
    getInventoryItemBalances(client, companyId)
  ]);

  if (locationsResult.error) return { ...locationsResult, data: null };
  if (balancesResult.error) return { ...balancesResult, data: null };

  const data: TechnicianVanStockSummary[] = buildVanStockSummary(
    (locationsResult.data ?? []).filter((location) => location.locationType === "van"),
    balancesResult.data ?? []
  ).map((row) => ({
    technicianUserId: row.location.technicianUserId,
    vanLocation: row.location,
    balances: row.balances
  }));

  return { data, error: null };
}

export async function getLocationInventoryBalances(
  client: AppSupabaseClient,
  companyId: string,
  stockLocationId: string
) {
  return getInventoryLocationBalances(client, companyId, stockLocationId);
}
