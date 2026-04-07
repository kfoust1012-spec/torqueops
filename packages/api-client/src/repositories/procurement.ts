import {
  calculateEstimatePartsSummary,
  calculateInvoicePartsSummary,
  calculateJobPartsSummary,
  calculatePartLifecycleStatus,
  isPartRequestLineFulfilled,
  normalizePartRequestInput,
  normalizePartRequestLineInput,
  normalizeSupplierAccountInput
} from "@mobile-mechanic/core";
import { purchaseOrderStatuses } from "@mobile-mechanic/types";
import type {
  AddPartRequestLineInput,
  AddSupplierCartLineInput,
  ConvertSupplierCartToPurchaseOrderInput,
  CreatePartRequestFromEstimateInput,
  CreatePartRequestInput,
  CreatePartReturnInput,
  CreateSupplierAccountInput,
  CreateSupplierRoutingRuleInput,
  Database,
  MarkCoreDueInput,
  MarkCoreReturnedInput,
  MarkPurchaseOrderOrderedInput,
  PartRequest,
  PartRequestDetail,
  PartRequestLine,
  ProcurementWorkspaceQuery,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderLine,
  RecordPartInstallationInput,
  RecordPurchaseReceiptInput,
  SupplierAccount,
  SupplierCart,
  SupplierCartDetail,
  SupplierCartLine,
  SupplierRoutingRule,
  UpdatePartRequestLineInput,
  UpdateSupplierAccountInput,
  UpdateSupplierCartLineInput,
  UpdateSupplierRoutingRuleInput
} from "@mobile-mechanic/types";
import {
  addPartRequestLineInputSchema,
  addSupplierCartLineInputSchema,
  convertSupplierCartToPurchaseOrderInputSchema,
  createPartRequestFromEstimateInputSchema,
  createPartRequestInputSchema,
  createPartReturnInputSchema,
  createSupplierAccountInputSchema,
  createSupplierRoutingRuleInputSchema,
  markCoreDueInputSchema,
  markCoreReturnedInputSchema,
  markPurchaseOrderOrderedInputSchema,
  procurementWorkspaceQuerySchema,
  recordPartInstallationInputSchema,
  recordPurchaseReceiptInputSchema,
  updatePartRequestLineInputSchema,
  updateSupplierAccountInputSchema,
  updateSupplierCartLineInputSchema,
  updateSupplierRoutingRuleInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type SupplierAccountRow = Database["public"]["Tables"]["supplier_accounts"]["Row"];
type SupplierAccountInsert = Database["public"]["Tables"]["supplier_accounts"]["Insert"];
type SupplierAccountUpdate = Database["public"]["Tables"]["supplier_accounts"]["Update"];
type SupplierRoutingRuleRow = Database["public"]["Tables"]["supplier_routing_rules"]["Row"];
type SupplierRoutingRuleUpdate = Database["public"]["Tables"]["supplier_routing_rules"]["Update"];
type PartRequestRow = Database["public"]["Tables"]["part_requests"]["Row"];
type PartRequestLineRow = Database["public"]["Tables"]["part_request_lines"]["Row"];
type PartRequestLineInsert = Database["public"]["Tables"]["part_request_lines"]["Insert"];
type PartRequestLineUpdate = Database["public"]["Tables"]["part_request_lines"]["Update"];
type SupplierCartRow = Database["public"]["Tables"]["supplier_carts"]["Row"];
type SupplierCartLineRow = Database["public"]["Tables"]["supplier_cart_lines"]["Row"];
type SupplierCartLineUpdate = Database["public"]["Tables"]["supplier_cart_lines"]["Update"];
type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];
type PurchaseOrderLineRow = Database["public"]["Tables"]["purchase_order_lines"]["Row"];
type PurchaseOrderLineInsert = Database["public"]["Tables"]["purchase_order_lines"]["Insert"];
type PurchaseOrderLineUpdate = Database["public"]["Tables"]["purchase_order_lines"]["Update"];
type PurchaseReceiptRow = Database["public"]["Tables"]["purchase_receipts"]["Row"];
type PurchaseReceiptLineRow = Database["public"]["Tables"]["purchase_receipt_lines"]["Row"];
type PartReturnRow = Database["public"]["Tables"]["part_returns"]["Row"];
type PartReturnLineRow = Database["public"]["Tables"]["part_return_lines"]["Row"];
type EstimateLineItemRow = Database["public"]["Tables"]["estimate_line_items"]["Row"];
type InvoiceLineItemRow = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type EstimateLineItemUpdate = Database["public"]["Tables"]["estimate_line_items"]["Update"];

type PartRequestLineActualCostSnapshot = {
  actualCostCents: number | null;
  actualUnitCostCents: number | null;
  grossQuantityReceived: number;
  netQuantityReceived: number;
  partRequestLineId: string;
  totalReturnCreditCents: number;
};

type PurchaseOrderMutationContext = {
  line: PurchaseOrderLineRow;
  purchaseOrder: Pick<PurchaseOrderRow, "id" | "status" | "supplier_account_id">;
};

function mapSupplierAccountRow(row: SupplierAccountRow): SupplierAccount {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.slug,
    mode: row.mode,
    externalUrl: row.external_url,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function resolveEstimatedUnitCostCentsFromEstimateLineItem(
  lineItem: Pick<EstimateLineItemRow, "estimated_cost_cents" | "quantity">
) {
  if (typeof lineItem.estimated_cost_cents !== "number") {
    return null;
  }

  const quantity = Math.max(Number(lineItem.quantity), 1);
  return Math.round(lineItem.estimated_cost_cents / quantity);
}

function mapSupplierRoutingRuleRow(row: SupplierRoutingRuleRow): SupplierRoutingRule {
  return {
    id: row.id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    name: row.name,
    priority: row.priority,
    isActive: row.is_active,
    matchJobPriority: row.match_job_priority,
    matchVehicleMake: row.match_vehicle_make,
    matchHasCore: row.match_has_core,
    matchPartTerm: row.match_part_term,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartRequestRow(row: PartRequestRow): PartRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    origin: row.origin,
    status: row.status,
    requestedByUserId: row.requested_by_user_id,
    assignedBuyerUserId: row.assigned_buyer_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartRequestLineRow(row: PartRequestLineRow): PartRequestLine {
  return {
    id: row.id,
    partRequestId: row.part_request_id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    estimateLineItemId: row.estimate_line_item_id,
    inventoryItemId: row.inventory_item_id,
    quantityReservedFromStock: Number(row.quantity_reserved_from_stock),
    quantityConsumedFromStock: Number(row.quantity_consumed_from_stock),
    quantityIssuedFromInventory: Number(row.quantity_issued_from_inventory),
    quantityReturnedToInventory: Number(row.quantity_returned_to_inventory),
    status: row.status,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    supplierSku: row.supplier_sku,
    quantityRequested: Number(row.quantity_requested),
    quantityOrdered: Number(row.quantity_ordered),
    quantityReceived: Number(row.quantity_received),
    quantityInstalled: Number(row.quantity_installed),
    quantityReturned: Number(row.quantity_returned),
    quantityCoreDue: Number(row.quantity_core_due),
    quantityCoreReturned: Number(row.quantity_core_returned),
    quotedUnitCostCents: row.quoted_unit_cost_cents,
    estimatedUnitCostCents: row.estimated_unit_cost_cents,
    actualUnitCostCents: row.actual_unit_cost_cents,
    needsCore: row.needs_core,
    coreChargeCents: row.core_charge_cents,
    lastSupplierAccountId: row.last_supplier_account_id,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupplierCartRow(row: SupplierCartRow): SupplierCart {
  return {
    id: row.id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    status: row.status,
    sourceBucketKey: row.source_bucket_key,
    createdByUserId: row.created_by_user_id,
    submittedByUserId: row.submitted_by_user_id,
    submittedAt: row.submitted_at,
    convertedPurchaseOrderId: row.converted_purchase_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupplierCartLineRow(row: SupplierCartLineRow): SupplierCartLine {
  return {
    id: row.id,
    cartId: row.cart_id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    partRequestLineId: row.part_request_line_id,
    providerQuoteLineId: row.provider_quote_line_id,
    jobId: row.job_id,
    quotedUnitCostCents: row.quoted_unit_cost_cents,
    quotedCoreChargeCents: row.quoted_core_charge_cents,
    quantity: Number(row.quantity),
    supplierPartNumber: row.supplier_part_number,
    supplierUrl: row.supplier_url,
    availabilityText: row.availability_text,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPurchaseOrderRow(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    supplierCartId: row.supplier_cart_id,
    status: row.status,
    poNumber: row.po_number,
    orderedByUserId: row.ordered_by_user_id,
    orderedAt: row.ordered_at,
    expectedAt: row.expected_at,
    externalReference: row.external_reference,
    manualOrderUrl: row.manual_order_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPurchaseOrderLineRow(row: PurchaseOrderLineRow): PurchaseOrderLine {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    partRequestLineId: row.part_request_line_id,
    jobId: row.job_id,
    supplierCartLineId: row.supplier_cart_line_id,
    inventoryItemId: row.inventory_item_id,
    stockLocationId: row.stock_location_id,
    status: row.status,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    supplierPartNumber: row.supplier_part_number,
    quantityOrdered: Number(row.quantity_ordered),
    quantityReceived: Number(row.quantity_received),
    quantityInstalled: Number(row.quantity_installed),
    quantityReturned: Number(row.quantity_returned),
    quantityCoreDue: Number(row.quantity_core_due),
    quantityCoreReturned: Number(row.quantity_core_returned),
    unitOrderedCostCents: row.unit_ordered_cost_cents,
    unitActualCostCents: row.unit_actual_cost_cents,
    coreChargeCents: row.core_charge_cents,
    isCoreReturnable: row.is_core_returnable,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listPartRequestLinesByRequestId(client: AppSupabaseClient, requestId: string) {
  const result = await client
    .from("part_request_lines")
    .select("*")
    .eq("part_request_id", requestId)
    .order("created_at", { ascending: true })
    .returns<PartRequestLineRow[]>();

  return { ...result, data: result.data ? result.data.map(mapPartRequestLineRow) : null };
}

async function listSupplierCartLinesByCartId(client: AppSupabaseClient, cartId: string) {
  const result = await client
    .from("supplier_cart_lines")
    .select("*")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true })
    .returns<SupplierCartLineRow[]>();

  return { ...result, data: result.data ? result.data.map(mapSupplierCartLineRow) : null };
}

async function listPurchaseOrderLinesByPurchaseOrderId(client: AppSupabaseClient, purchaseOrderId: string) {
  const result = await client
    .from("purchase_order_lines")
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: true })
    .returns<PurchaseOrderLineRow[]>();

  return { ...result, data: result.data ? result.data.map(mapPurchaseOrderLineRow) : null };
}

export async function getPartRequestLineActualCostSnapshots(
  client: AppSupabaseClient,
  partRequestLineIds: string[]
) {
  const uniquePartRequestLineIds = [...new Set(partRequestLineIds)];

  if (!uniquePartRequestLineIds.length) {
    return { data: [] as PartRequestLineActualCostSnapshot[], error: null };
  }

  const poLinesResult = await client
    .from("purchase_order_lines")
    .select(
      "id, part_request_line_id, quantity_received, quantity_returned, unit_ordered_cost_cents, unit_actual_cost_cents"
    )
    .in("part_request_line_id", uniquePartRequestLineIds)
    .returns<
      Array<
        Pick<
          PurchaseOrderLineRow,
          | "id"
          | "part_request_line_id"
          | "quantity_received"
          | "quantity_returned"
          | "unit_ordered_cost_cents"
          | "unit_actual_cost_cents"
        >
      >
    >();

  if (poLinesResult.error) {
    throw poLinesResult.error;
  }

  const poLines = poLinesResult.data ?? [];
  const purchaseOrderLineIds = poLines.map((line) => line.id);

  if (!purchaseOrderLineIds.length) {
    return { data: [] as PartRequestLineActualCostSnapshot[], error: null };
  }

  const [receiptLinesResult, returnLinesResult] = await Promise.all([
    client
      .from("purchase_receipt_lines")
      .select("purchase_order_line_id, quantity_received, unit_received_cost_cents")
      .in("purchase_order_line_id", purchaseOrderLineIds)
      .returns<
        Array<
          Pick<
            PurchaseReceiptLineRow,
            "purchase_order_line_id" | "quantity_received" | "unit_received_cost_cents"
          >
        >
      >(),
    client
      .from("part_return_lines")
      .select("purchase_order_line_id, quantity_returned, is_core_return, credit_amount_cents")
      .in("purchase_order_line_id", purchaseOrderLineIds)
      .returns<
        Array<
          Pick<
            PartReturnLineRow,
            "purchase_order_line_id" | "quantity_returned" | "is_core_return" | "credit_amount_cents"
          >
        >
      >()
  ]);

  if (receiptLinesResult.error) {
    throw receiptLinesResult.error;
  }
  if (returnLinesResult.error) {
    throw returnLinesResult.error;
  }

  const receiptLinesByPurchaseOrderLineId = new Map<string, Array<(typeof receiptLinesResult.data)[number]>>();
  for (const receiptLine of receiptLinesResult.data ?? []) {
    const lines = receiptLinesByPurchaseOrderLineId.get(receiptLine.purchase_order_line_id) ?? [];
    lines.push(receiptLine);
    receiptLinesByPurchaseOrderLineId.set(receiptLine.purchase_order_line_id, lines);
  }

  const returnLinesByPurchaseOrderLineId = new Map<string, Array<(typeof returnLinesResult.data)[number]>>();
  for (const returnLine of returnLinesResult.data ?? []) {
    const lines = returnLinesByPurchaseOrderLineId.get(returnLine.purchase_order_line_id) ?? [];
    lines.push(returnLine);
    returnLinesByPurchaseOrderLineId.set(returnLine.purchase_order_line_id, lines);
  }

  const snapshotsByRequestLineId = new Map<string, PartRequestLineActualCostSnapshot>();

  for (const poLine of poLines) {
    const receiptLines = receiptLinesByPurchaseOrderLineId.get(poLine.id) ?? [];
    const returnLines = returnLinesByPurchaseOrderLineId.get(poLine.id) ?? [];
    const fallbackUnitCostCents = poLine.unit_actual_cost_cents ?? poLine.unit_ordered_cost_cents ?? 0;
    const grossQuantityReceived = Number(poLine.quantity_received);
    const quantityReturned = Number(poLine.quantity_returned);
    const netQuantityReceived = Math.max(grossQuantityReceived - quantityReturned, 0);
    const receiptCostCents =
      receiptLines.length > 0
        ? receiptLines.reduce(
            (total, receiptLine) =>
              total +
              Math.round(
                Number(receiptLine.quantity_received) *
                  Number(receiptLine.unit_received_cost_cents ?? fallbackUnitCostCents)
              ),
            0
          )
        : grossQuantityReceived > 0
          ? Math.round(grossQuantityReceived * Number(fallbackUnitCostCents))
          : 0;
    const totalReturnCreditCents = returnLines.reduce((total, returnLine) => {
      if (typeof returnLine.credit_amount_cents === "number") {
        return total + returnLine.credit_amount_cents;
      }

      if (returnLine.is_core_return) {
        return total;
      }

      return total + Math.round(Number(returnLine.quantity_returned) * Number(fallbackUnitCostCents));
    }, 0);
    const actualCostCents = Math.max(receiptCostCents - totalReturnCreditCents, 0);
    const existingSnapshot = snapshotsByRequestLineId.get(poLine.part_request_line_id);

    if (existingSnapshot) {
      const mergedActualCostCents =
        (existingSnapshot.actualCostCents ?? 0) + actualCostCents;
      const mergedNetQuantityReceived = existingSnapshot.netQuantityReceived + netQuantityReceived;
      snapshotsByRequestLineId.set(poLine.part_request_line_id, {
        actualCostCents: mergedActualCostCents,
        actualUnitCostCents:
          mergedNetQuantityReceived > 0
            ? Math.round(mergedActualCostCents / mergedNetQuantityReceived)
            : null,
        grossQuantityReceived: existingSnapshot.grossQuantityReceived + grossQuantityReceived,
        netQuantityReceived: mergedNetQuantityReceived,
        partRequestLineId: poLine.part_request_line_id,
        totalReturnCreditCents: existingSnapshot.totalReturnCreditCents + totalReturnCreditCents
      });
      continue;
    }

    snapshotsByRequestLineId.set(poLine.part_request_line_id, {
      actualCostCents,
      actualUnitCostCents: netQuantityReceived > 0 ? Math.round(actualCostCents / netQuantityReceived) : null,
      grossQuantityReceived,
      netQuantityReceived,
      partRequestLineId: poLine.part_request_line_id,
      totalReturnCreditCents
    });
  }

  return {
    data: uniquePartRequestLineIds
      .map((partRequestLineId) => snapshotsByRequestLineId.get(partRequestLineId))
      .filter((snapshot): snapshot is PartRequestLineActualCostSnapshot => Boolean(snapshot)),
    error: null
  };
}

async function syncOpenCartAndDraftPurchaseOrderQuantitiesForRequestLine(
  client: AppSupabaseClient,
  partRequestLineId: string,
  quantityRequested: number
) {
  const [cartLinesResult, purchaseOrderLinesResult] = await Promise.all([
    client
      .from("supplier_cart_lines")
      .select("id, cart_id")
      .eq("part_request_line_id", partRequestLineId)
      .returns<Array<Pick<SupplierCartLineRow, "id" | "cart_id">>>(),
    client
      .from("purchase_order_lines")
      .select("id, purchase_order_id")
      .eq("part_request_line_id", partRequestLineId)
      .returns<Array<Pick<PurchaseOrderLineRow, "id" | "purchase_order_id">>>()
  ]);

  if (cartLinesResult.error) {
    throw cartLinesResult.error;
  }
  if (purchaseOrderLinesResult.error) {
    throw purchaseOrderLinesResult.error;
  }

  const cartLineIds = (cartLinesResult.data ?? []).map((line) => line.id);
  const cartIds = [...new Set((cartLinesResult.data ?? []).map((line) => line.cart_id))];
  const purchaseOrderLineIds = (purchaseOrderLinesResult.data ?? []).map((line) => line.id);
  const purchaseOrderIds = [
    ...new Set((purchaseOrderLinesResult.data ?? []).map((line) => line.purchase_order_id))
  ];

  const [cartsResult, purchaseOrdersResult] = await Promise.all([
    cartIds.length
      ? client
          .from("supplier_carts")
          .select("id, status")
          .in("id", cartIds)
          .returns<Array<Pick<SupplierCartRow, "id" | "status">>>()
      : Promise.resolve({ data: [] as Array<Pick<SupplierCartRow, "id" | "status">>, error: null }),
    purchaseOrderIds.length
      ? client
          .from("purchase_orders")
          .select("id, status")
          .in("id", purchaseOrderIds)
          .returns<Array<Pick<PurchaseOrderRow, "id" | "status">>>()
      : Promise.resolve({
          data: [] as Array<Pick<PurchaseOrderRow, "id" | "status">>,
          error: null
        })
  ]);

  if (cartsResult.error) {
    throw cartsResult.error;
  }
  if (purchaseOrdersResult.error) {
    throw purchaseOrdersResult.error;
  }

  const openCartIds = new Set(
    (cartsResult.data ?? []).filter((cart) => cart.status === "open").map((cart) => cart.id)
  );
  const draftPurchaseOrderIds = new Set(
    (purchaseOrdersResult.data ?? [])
      .filter((purchaseOrder) => purchaseOrder.status === "draft")
      .map((purchaseOrder) => purchaseOrder.id)
  );

  const openCartLineIds = (cartLinesResult.data ?? [])
    .filter((line) => openCartIds.has(line.cart_id))
    .map((line) => line.id);
  const draftPurchaseOrderLineIds = (purchaseOrderLinesResult.data ?? [])
    .filter((line) => draftPurchaseOrderIds.has(line.purchase_order_id))
    .map((line) => line.id);

  const supplierCartLineUpdate: SupplierCartLineUpdate = {
    quantity: quantityRequested
  };
  const purchaseOrderLineUpdate: PurchaseOrderLineUpdate = {
    quantity_ordered: quantityRequested
  };

  if (openCartLineIds.length) {
    const updateOpenCartLinesResult = await client
      .from("supplier_cart_lines")
      .update(supplierCartLineUpdate)
      .in("id", openCartLineIds);

    if (updateOpenCartLinesResult.error) {
      throw updateOpenCartLinesResult.error;
    }
  }

  if (draftPurchaseOrderLineIds.length) {
    const updateDraftPurchaseOrderLinesResult = await client
      .from("purchase_order_lines")
      .update(purchaseOrderLineUpdate)
      .in("id", draftPurchaseOrderLineIds);

    if (updateDraftPurchaseOrderLinesResult.error) {
      throw updateDraftPurchaseOrderLinesResult.error;
    }
  }
}

async function getPurchaseOrderMutationContext(
  client: AppSupabaseClient,
  purchaseOrderLineId: string,
  options: {
    allowedPurchaseOrderStatuses: PurchaseOrder["status"][];
    expectedPurchaseOrderId?: string | null;
    expectedSupplierAccountId?: string | null;
  }
): Promise<PurchaseOrderMutationContext> {
  const lineResult = await client
    .from("purchase_order_lines")
    .select("*")
    .eq("id", purchaseOrderLineId)
    .single<PurchaseOrderLineRow>();

  if (lineResult.error || !lineResult.data) {
    throw lineResult.error ?? new Error("Purchase order line not found.");
  }

  const purchaseOrderResult = await client
    .from("purchase_orders")
    .select("id, status, supplier_account_id")
    .eq("id", lineResult.data.purchase_order_id)
    .single<Pick<PurchaseOrderRow, "id" | "status" | "supplier_account_id">>();

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order not found.");
  }

  if (
    options.expectedPurchaseOrderId &&
    lineResult.data.purchase_order_id !== options.expectedPurchaseOrderId
  ) {
    throw new Error("Purchase order line does not belong to the selected purchase order.");
  }

  if (
    options.expectedSupplierAccountId &&
    purchaseOrderResult.data.supplier_account_id !== options.expectedSupplierAccountId
  ) {
    throw new Error("Purchase order supplier does not match the selected supplier account.");
  }

  if (!options.allowedPurchaseOrderStatuses.includes(purchaseOrderResult.data.status)) {
    throw new Error("This purchase order is not in a state that allows that procurement action.");
  }

  return {
    line: lineResult.data,
    purchaseOrder: purchaseOrderResult.data
  };
}

async function syncPartRequestHeaderStatus(client: AppSupabaseClient, requestId: string) {
  const linesResult = await listPartRequestLinesByRequestId(client, requestId);
  if (linesResult.error) {
    throw linesResult.error;
  }

  const lines = linesResult.data ?? [];
  const nextStatus = lines.length > 0 && lines.every((line) => isPartRequestLineFulfilled(line))
    ? "fulfilled"
    : "open";

  await client.from("part_requests").update({ status: nextStatus }).eq("id", requestId);
}

async function syncPartRequestLineFromPurchaseOrderLines(client: AppSupabaseClient, partRequestLineId: string) {
  const poLinesResult = await client
    .from("purchase_order_lines")
    .select("*")
    .eq("part_request_line_id", partRequestLineId)
    .returns<PurchaseOrderLineRow[]>();

  if (poLinesResult.error) {
    throw poLinesResult.error;
  }

  const poLines = poLinesResult.data ?? [];
  const actualCostSnapshotsResult = await getPartRequestLineActualCostSnapshots(client, [partRequestLineId]);
  if (actualCostSnapshotsResult.error) {
    throw actualCostSnapshotsResult.error;
  }

  const actualCostSnapshot = actualCostSnapshotsResult.data?.[0] ?? null;
  const nextStatus = calculatePartLifecycleStatus({
    quantityOrdered: poLines.reduce((sum, line) => sum + Number(line.quantity_ordered), 0),
    quantityReceived: poLines.reduce((sum, line) => sum + Number(line.quantity_received), 0),
    quantityInstalled: poLines.reduce((sum, line) => sum + Number(line.quantity_installed), 0),
    quantityReturned: poLines.reduce((sum, line) => sum + Number(line.quantity_returned), 0),
    quantityCoreDue: poLines.reduce((sum, line) => sum + Number(line.quantity_core_due), 0),
    quantityCoreReturned: poLines.reduce((sum, line) => sum + Number(line.quantity_core_returned), 0)
  });

  const result = await client
    .from("part_request_lines")
    .update({
      actual_unit_cost_cents: actualCostSnapshot?.actualUnitCostCents ?? null,
      quantity_core_due: poLines.reduce((sum, line) => sum + Number(line.quantity_core_due), 0),
      quantity_core_returned: poLines.reduce((sum, line) => sum + Number(line.quantity_core_returned), 0),
      quantity_installed: poLines.reduce((sum, line) => sum + Number(line.quantity_installed), 0),
      quantity_ordered: poLines.reduce((sum, line) => sum + Number(line.quantity_ordered), 0),
      quantity_received: poLines.reduce((sum, line) => sum + Number(line.quantity_received), 0),
      quantity_returned: poLines.reduce((sum, line) => sum + Number(line.quantity_returned), 0),
      status: nextStatus
    })
    .eq("id", partRequestLineId)
    .select("*")
    .single<PartRequestLineRow>();

  return {
    ...result,
    data: result.data ? mapPartRequestLineRow(result.data) : null
  };
}

async function syncPurchaseOrderStatus(client: AppSupabaseClient, purchaseOrderId: string) {
  const purchaseOrderResult = await client
    .from("purchase_orders")
    .select("status")
    .eq("id", purchaseOrderId)
    .single<Pick<PurchaseOrderRow, "status">>();

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    throw purchaseOrderResult.error ?? new Error("Purchase order not found.");
  }

  if (purchaseOrderResult.data.status === "canceled" || purchaseOrderResult.data.status === "closed") {
    return;
  }

  const linesResult = await listPurchaseOrderLinesByPurchaseOrderId(client, purchaseOrderId);
  if (linesResult.error) {
    throw linesResult.error;
  }

  const lines = linesResult.data ?? [];
  const totalOrdered = lines.reduce((sum, line) => sum + line.quantityOrdered, 0);
  const totalReceived = lines.reduce((sum, line) => sum + line.quantityReceived, 0);

  let nextStatus: PurchaseOrder["status"] = "draft";
  if (totalOrdered > 0) {
    nextStatus = "ordered";
  }
  if (totalReceived > 0) {
    nextStatus = totalReceived >= totalOrdered ? "received" : "partially_received";
  }

  await client.from("purchase_orders").update({ status: nextStatus }).eq("id", purchaseOrderId);
}

function assertPurchaseOrderLineQuantities(
  current: Pick<
    PurchaseOrderLineRow,
    | "quantity_ordered"
    | "quantity_received"
    | "quantity_installed"
    | "quantity_returned"
    | "quantity_core_due"
    | "quantity_core_returned"
  >,
  overrides: Partial<{
    quantityReceived: number;
    quantityInstalled: number;
    quantityReturned: number;
    quantityCoreDue: number;
    quantityCoreReturned: number;
  }>
) {
  const quantityOrdered = Number(current.quantity_ordered);
  const quantityReceived = overrides.quantityReceived ?? Number(current.quantity_received);
  const quantityInstalled = overrides.quantityInstalled ?? Number(current.quantity_installed);
  const quantityReturned = overrides.quantityReturned ?? Number(current.quantity_returned);
  const quantityCoreDue = overrides.quantityCoreDue ?? Number(current.quantity_core_due);
  const quantityCoreReturned = overrides.quantityCoreReturned ?? Number(current.quantity_core_returned);

  if (quantityReceived > quantityOrdered) {
    throw new Error("Cannot receive more quantity than was ordered.");
  }

  if (quantityInstalled + quantityReturned > quantityReceived) {
    throw new Error("Installed and returned quantity cannot exceed received quantity.");
  }

  if (quantityCoreDue > quantityReceived) {
    throw new Error("Core due quantity cannot exceed received quantity.");
  }

  if (quantityCoreReturned > quantityCoreDue) {
    throw new Error("Core returned quantity cannot exceed the outstanding core due quantity.");
  }
}

export async function listSupplierAccountsByCompany(client: AppSupabaseClient, companyId: string) {
  const result = await client
    .from("supplier_accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<SupplierAccountRow[]>();

  return { ...result, data: result.data ? result.data.map(mapSupplierAccountRow) : null };
}

export async function getSupplierAccountById(client: AppSupabaseClient, supplierAccountId: string) {
  const result = await client
    .from("supplier_accounts")
    .select("*")
    .eq("id", supplierAccountId)
    .single<SupplierAccountRow>();

  return { ...result, data: result.data ? mapSupplierAccountRow(result.data) : null };
}

export async function createSupplierAccount(client: AppSupabaseClient, input: CreateSupplierAccountInput) {
  const normalized = normalizeSupplierAccountInput(createSupplierAccountInputSchema.parse(input));
  const payload: SupplierAccountInsert = {
    company_id: normalized.companyId,
    name: normalized.name,
    slug: normalized.slug,
    mode: normalized.mode,
    external_url: normalized.externalUrl ?? null,
    contact_name: normalized.contactName ?? null,
    contact_email: normalized.contactEmail ?? null,
    contact_phone: normalized.contactPhone ?? null,
    notes: normalized.notes ?? null,
    sort_order: normalized.sortOrder ?? 0
  };
  const result = await client
    .from("supplier_accounts")
    .insert(payload)
    .select("*")
    .single<SupplierAccountRow>();

  return { ...result, data: result.data ? mapSupplierAccountRow(result.data) : null };
}

export async function updateSupplierAccount(
  client: AppSupabaseClient,
  supplierAccountId: string,
  input: UpdateSupplierAccountInput
) {
  const normalized = normalizeSupplierAccountInput(updateSupplierAccountInputSchema.parse(input));
  const payload: SupplierAccountUpdate = {
    name: normalized.name,
    slug: normalized.slug,
    mode: normalized.mode,
    external_url: normalized.externalUrl ?? null,
    contact_name: normalized.contactName ?? null,
    contact_email: normalized.contactEmail ?? null,
    contact_phone: normalized.contactPhone ?? null,
    notes: normalized.notes ?? null
  };

  if (normalized.isActive !== undefined) {
    payload.is_active = normalized.isActive;
  }

  if (normalized.sortOrder !== undefined) {
    payload.sort_order = normalized.sortOrder;
  }

  const result = await client
    .from("supplier_accounts")
    .update(payload)
    .eq("id", supplierAccountId)
    .select("*")
    .single<SupplierAccountRow>();

  return { ...result, data: result.data ? mapSupplierAccountRow(result.data) : null };
}

export async function listSupplierRoutingRulesByCompany(client: AppSupabaseClient, companyId: string) {
  const result = await client
    .from("supplier_routing_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("priority", { ascending: true })
    .returns<SupplierRoutingRuleRow[]>();

  return { ...result, data: result.data ? result.data.map(mapSupplierRoutingRuleRow) : null };
}

export async function createSupplierRoutingRule(
  client: AppSupabaseClient,
  input: CreateSupplierRoutingRuleInput
) {
  const parsed = createSupplierRoutingRuleInputSchema.parse(input);
  const result = await client
    .from("supplier_routing_rules")
    .insert({
      company_id: parsed.companyId,
      supplier_account_id: parsed.supplierAccountId,
      name: parsed.name.trim(),
      priority: parsed.priority ?? 0,
      match_job_priority: parsed.matchJobPriority ?? null,
      match_vehicle_make: parsed.matchVehicleMake ?? null,
      match_has_core: parsed.matchHasCore ?? null,
      match_part_term: parsed.matchPartTerm ?? null
    })
    .select("*")
    .single<SupplierRoutingRuleRow>();

  return { ...result, data: result.data ? mapSupplierRoutingRuleRow(result.data) : null };
}

export async function updateSupplierRoutingRule(
  client: AppSupabaseClient,
  ruleId: string,
  input: UpdateSupplierRoutingRuleInput
) {
  const parsed = updateSupplierRoutingRuleInputSchema.parse(input);
  const payload: SupplierRoutingRuleUpdate = {
    supplier_account_id: parsed.supplierAccountId,
    name: parsed.name.trim(),
    priority: parsed.priority ?? 0,
    match_job_priority: parsed.matchJobPriority ?? null,
    match_vehicle_make: parsed.matchVehicleMake ?? null,
    match_has_core: parsed.matchHasCore ?? null,
    match_part_term: parsed.matchPartTerm ?? null
  };

  if (parsed.isActive !== undefined) {
    payload.is_active = parsed.isActive;
  }

  const result = await client
    .from("supplier_routing_rules")
    .update(payload)
    .eq("id", ruleId)
    .select("*")
    .single<SupplierRoutingRuleRow>();

  return { ...result, data: result.data ? mapSupplierRoutingRuleRow(result.data) : null };
}

export async function deleteSupplierRoutingRule(client: AppSupabaseClient, ruleId: string) {
  return client.from("supplier_routing_rules").delete().eq("id", ruleId);
}

export async function listPartRequestsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: ProcurementWorkspaceQuery = {}
) {
  const parsed = procurementWorkspaceQuerySchema.parse(query);
  let builder = client
    .from("part_requests")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (parsed.jobId) {
    builder = builder.eq("job_id", parsed.jobId);
  }
  if (parsed.status) {
    const requestStatuses: PartRequest["status"][] = ["open", "fulfilled", "canceled"];
    if (requestStatuses.includes(parsed.status as PartRequest["status"])) {
      builder = builder.eq("status", parsed.status as PartRequest["status"]);
    }
  }

  const result = await builder.returns<PartRequestRow[]>();
  return { ...result, data: result.data ? result.data.map(mapPartRequestRow) : null };
}

export async function listPartRequestsByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("part_requests")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<PartRequestRow[]>();

  return { ...result, data: result.data ? result.data.map(mapPartRequestRow) : null };
}

export async function getPartRequestById(client: AppSupabaseClient, requestId: string) {
  const [requestResult, linesResult] = await Promise.all([
    client.from("part_requests").select("*").eq("id", requestId).single<PartRequestRow>(),
    listPartRequestLinesByRequestId(client, requestId)
  ]);

  if (requestResult.error || !requestResult.data) {
    return { ...requestResult, data: null as PartRequestDetail | null };
  }

  if (linesResult.error) {
    throw linesResult.error;
  }

  const partRequestLineIds = (linesResult.data ?? []).map((line) => line.id);

  if (!partRequestLineIds.length) {
    return {
      data: {
        request: mapPartRequestRow(requestResult.data),
        lines: [],
        linkedCarts: [],
        linkedPurchaseOrders: []
      },
      error: null
    };
  }

  const cartsResult = await client
    .from("supplier_cart_lines")
    .select("cart_id")
    .in("part_request_line_id", partRequestLineIds)
    .returns<Array<{ cart_id: string }>>();
  const purchaseOrderLinesResult = await client
    .from("purchase_order_lines")
    .select("purchase_order_id")
    .in("part_request_line_id", partRequestLineIds)
    .returns<Array<{ purchase_order_id: string }>>();

  if (cartsResult.error) {
    throw cartsResult.error;
  }
  if (purchaseOrderLinesResult.error) {
    throw purchaseOrderLinesResult.error;
  }

  const cartIds = [...new Set((cartsResult.data ?? []).map((row) => row.cart_id))];
  const purchaseOrderIds = [...new Set((purchaseOrderLinesResult.data ?? []).map((row) => row.purchase_order_id))];
  const [cartsRows, poRows] = await Promise.all([
    cartIds.length
      ? client.from("supplier_carts").select("*").in("id", cartIds).returns<SupplierCartRow[]>()
      : Promise.resolve({ data: [], error: null }),
    purchaseOrderIds.length
      ? client.from("purchase_orders").select("*").in("id", purchaseOrderIds).returns<PurchaseOrderRow[]>()
      : Promise.resolve({ data: [], error: null })
  ]);

  if (cartsRows.error) {
    throw cartsRows.error;
  }
  if (poRows.error) {
    throw poRows.error;
  }

  return {
    data: {
      request: mapPartRequestRow(requestResult.data),
      lines: linesResult.data ?? [],
      linkedCarts: (cartsRows.data ?? []).map(mapSupplierCartRow),
      linkedPurchaseOrders: (poRows.data ?? []).map(mapPurchaseOrderRow)
    },
    error: null
  };
}

export async function createPartRequest(client: AppSupabaseClient, input: CreatePartRequestInput) {
  const normalized = normalizePartRequestInput(createPartRequestInputSchema.parse(input));
  const result = await client
    .from("part_requests")
    .insert({
      company_id: normalized.companyId,
      job_id: normalized.jobId,
      estimate_id: normalized.estimateId ?? null,
      origin: normalized.origin,
      requested_by_user_id: normalized.requestedByUserId,
      notes: normalized.notes ?? null
    })
    .select("*")
    .single<PartRequestRow>();

  return { ...result, data: result.data ? mapPartRequestRow(result.data) : null };
}

export async function createPartRequestFromEstimate(
  client: AppSupabaseClient,
  input: CreatePartRequestFromEstimateInput
) {
  const parsed = createPartRequestFromEstimateInputSchema.parse(input);
  const existingRequestResult = await client
    .from("part_requests")
    .select("*")
    .eq("estimate_id", parsed.estimateId)
    .eq("origin", "estimate_editor")
    .eq("status", "open")
    .maybeSingle<PartRequestRow>();

  if (existingRequestResult.error) {
    throw existingRequestResult.error;
  }

  const request =
    existingRequestResult.data
      ? mapPartRequestRow(existingRequestResult.data)
      : (
          await createPartRequest(client, {
            companyId: parsed.companyId,
            jobId: parsed.jobId,
            estimateId: parsed.estimateId,
            origin: "estimate_editor",
            requestedByUserId: parsed.requestedByUserId,
            notes: parsed.notes
          })
        ).data;

  if (!request) {
    return { data: null, error: new Error("Part request could not be created.") };
  }

  const existingRequestLinesResult = await listPartRequestLinesByRequestId(client, request.id);
  if (existingRequestLinesResult.error) {
    throw existingRequestLinesResult.error;
  }

  const existingRequestLinesByEstimateLineItemId = new Map(
    (existingRequestLinesResult.data ?? [])
      .filter((line) => Boolean(line.estimateLineItemId))
      .map((line) => [line.estimateLineItemId!, line])
  );
  const existingRequestLinesById = new Map(
    (existingRequestLinesResult.data ?? []).map((line) => [line.id, line])
  );

  const estimateLineItemsResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", parsed.estimateId)
    .eq("item_type", "part")
    .order("position", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  if (estimateLineItemsResult.error) {
    throw estimateLineItemsResult.error;
  }

  const currentEstimateLineItemIds = new Set((estimateLineItemsResult.data ?? []).map((lineItem) => lineItem.id));

  for (const lineItem of estimateLineItemsResult.data ?? []) {
    const estimatedUnitCostCents = resolveEstimatedUnitCostCentsFromEstimateLineItem(lineItem);
    const nextQuantityRequested = Number(lineItem.quantity);
    const existingRequestLine =
      existingRequestLinesByEstimateLineItemId.get(lineItem.id) ??
      (lineItem.part_request_line_id
        ? existingRequestLinesById.get(lineItem.part_request_line_id) ?? null
        : null);

    if (existingRequestLine) {
      const stockCoverageQuantity =
        existingRequestLine.quantityReservedFromStock + existingRequestLine.quantityConsumedFromStock;

      if (nextQuantityRequested < stockCoverageQuantity) {
        throw new Error(
          `Estimate-sourced part demand for "${lineItem.name}" cannot be reduced below ${stockCoverageQuantity} while stock is reserved or consumed.`
        );
      }

      const updatedRequestLineResult = await updatePartRequestLine(client, existingRequestLine.id, {
        status: existingRequestLine.status,
        description: lineItem.name,
        manufacturer: existingRequestLine.manufacturer,
        partNumber: existingRequestLine.partNumber,
        supplierSku: existingRequestLine.supplierSku,
        quantityRequested: nextQuantityRequested,
        quotedUnitCostCents: existingRequestLine.quotedUnitCostCents,
        estimatedUnitCostCents,
        actualUnitCostCents: existingRequestLine.actualUnitCostCents,
        needsCore: existingRequestLine.needsCore,
        coreChargeCents: existingRequestLine.coreChargeCents,
        lastSupplierAccountId: existingRequestLine.lastSupplierAccountId,
        notes: lineItem.description ?? existingRequestLine.notes
      });

      if (updatedRequestLineResult.error || !updatedRequestLineResult.data) {
        throw updatedRequestLineResult.error ?? new Error("Failed to update estimate-sourced part request line.");
      }

      await syncOpenCartAndDraftPurchaseOrderQuantitiesForRequestLine(
        client,
        updatedRequestLineResult.data.id,
        nextQuantityRequested
      );
      await client
        .from("estimate_line_items")
        .update({
          estimated_cost_cents: lineItem.estimated_cost_cents,
          part_request_line_id: updatedRequestLineResult.data.id
        })
        .eq("id", lineItem.id);
      continue;
    }

    const createdRequestLineResult = await addPartRequestLine(client, request.id, {
      companyId: parsed.companyId,
      jobId: parsed.jobId,
      estimateId: parsed.estimateId,
      estimateLineItemId: lineItem.id,
      description: lineItem.name,
      partNumber: null,
      quantityRequested: nextQuantityRequested,
      estimatedUnitCostCents,
      notes: lineItem.description,
      createdByUserId: parsed.requestedByUserId
    });

    if (createdRequestLineResult.error || !createdRequestLineResult.data) {
      throw createdRequestLineResult.error ?? new Error("Failed to create estimate-sourced part request line.");
    }

    await client
      .from("estimate_line_items")
      .update({
        estimated_cost_cents: lineItem.estimated_cost_cents,
        part_request_line_id: createdRequestLineResult.data.id
      })
      .eq("id", lineItem.id);
  }

  const orphanRequestLines = (existingRequestLinesResult.data ?? []).filter(
    (line) => line.estimateLineItemId && !currentEstimateLineItemIds.has(line.estimateLineItemId)
  );

  if (orphanRequestLines.length) {
    const orphanLineIds = orphanRequestLines.map((line) => line.id);
    const [linkedCartLinesResult, linkedPurchaseOrderLinesResult] = await Promise.all([
      client
        .from("supplier_cart_lines")
        .select("part_request_line_id")
        .in("part_request_line_id", orphanLineIds)
        .returns<Array<{ part_request_line_id: string }>>(),
      client
        .from("purchase_order_lines")
        .select("part_request_line_id")
        .in("part_request_line_id", orphanLineIds)
        .returns<Array<{ part_request_line_id: string }>>()
    ]);

    if (linkedCartLinesResult.error) {
      throw linkedCartLinesResult.error;
    }
    if (linkedPurchaseOrderLinesResult.error) {
      throw linkedPurchaseOrderLinesResult.error;
    }

    const protectedLineIds = new Set([
      ...(linkedCartLinesResult.data ?? []).map((line) => line.part_request_line_id),
      ...(linkedPurchaseOrderLinesResult.data ?? []).map((line) => line.part_request_line_id)
    ]);

    for (const orphanRequestLine of orphanRequestLines) {
      if (
        orphanRequestLine.quantityReservedFromStock > 0 ||
        orphanRequestLine.quantityConsumedFromStock > 0
      ) {
        continue;
      }

      if (protectedLineIds.has(orphanRequestLine.id)) {
        continue;
      }

      await deletePartRequestLine(client, orphanRequestLine.id);
    }
  }

  return getPartRequestById(client, request.id);
}

export async function addPartRequestLine(
  client: AppSupabaseClient,
  requestId: string,
  input: AddPartRequestLineInput
) {
  const normalized = normalizePartRequestLineInput(addPartRequestLineInputSchema.parse(input));
  const payload: PartRequestLineInsert = {
    part_request_id: requestId,
    company_id: normalized.companyId,
    job_id: normalized.jobId,
    estimate_id: normalized.estimateId ?? null,
    estimate_line_item_id: normalized.estimateLineItemId ?? null,
    inventory_item_id: normalized.inventoryItemId ?? null,
    description: normalized.description,
    manufacturer: normalized.manufacturer ?? null,
    part_number: normalized.partNumber ?? null,
    supplier_sku: normalized.supplierSku ?? null,
    quantity_requested: normalized.quantityRequested ?? 1,
    quoted_unit_cost_cents: normalized.quotedUnitCostCents ?? null,
    estimated_unit_cost_cents: normalized.estimatedUnitCostCents ?? null,
    needs_core: normalized.needsCore ?? false,
    core_charge_cents: normalized.coreChargeCents ?? 0,
    notes: normalized.notes ?? null,
    created_by_user_id: normalized.createdByUserId
  };
  const result = await client
    .from("part_request_lines")
    .insert(payload)
    .select("*")
    .single<PartRequestLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  if (normalized.estimateLineItemId) {
    await client
      .from("estimate_line_items")
      .update({
        estimated_cost_cents:
          typeof normalized.estimatedUnitCostCents === "number"
            ? Math.round((normalized.quantityRequested ?? 1) * normalized.estimatedUnitCostCents)
            : null,
        part_request_line_id: result.data.id
      })
      .eq("id", normalized.estimateLineItemId);
  }

  await syncPartRequestHeaderStatus(client, requestId);
  return { ...result, data: mapPartRequestLineRow(result.data) };
}

export async function updatePartRequestLine(
  client: AppSupabaseClient,
  lineId: string,
  input: UpdatePartRequestLineInput
) {
  const normalized = normalizePartRequestLineInput(updatePartRequestLineInputSchema.parse(input));
  const payload: PartRequestLineUpdate = {
    description: normalized.description,
    manufacturer: normalized.manufacturer ?? null,
    part_number: normalized.partNumber ?? null,
    supplier_sku: normalized.supplierSku ?? null,
    notes: normalized.notes ?? null
  };

  if (normalized.status !== undefined) {
    payload.status = normalized.status;
  }
  if (normalized.quantityRequested !== undefined) {
    payload.quantity_requested = normalized.quantityRequested;
  }
  if (normalized.inventoryItemId !== undefined) {
    payload.inventory_item_id = normalized.inventoryItemId ?? null;
  }
  if (normalized.quotedUnitCostCents !== undefined) {
    payload.quoted_unit_cost_cents = normalized.quotedUnitCostCents;
  }
  if (normalized.estimatedUnitCostCents !== undefined) {
    payload.estimated_unit_cost_cents = normalized.estimatedUnitCostCents;
  }
  if (normalized.actualUnitCostCents !== undefined) {
    payload.actual_unit_cost_cents = normalized.actualUnitCostCents;
  }
  if (normalized.needsCore !== undefined) {
    payload.needs_core = normalized.needsCore;
  }
  if (normalized.coreChargeCents !== undefined) {
    payload.core_charge_cents = normalized.coreChargeCents;
  }
  if (normalized.lastSupplierAccountId !== undefined) {
    payload.last_supplier_account_id = normalized.lastSupplierAccountId ?? null;
  }

  const result = await client
    .from("part_request_lines")
    .update(payload)
    .eq("id", lineId)
    .select("*")
    .single<PartRequestLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  if (result.data.estimate_line_item_id) {
    const estimateLineItemUpdate: EstimateLineItemUpdate = {
      part_request_line_id: result.data.id
    };

    if (normalized.estimatedUnitCostCents !== undefined) {
      estimateLineItemUpdate.estimated_cost_cents =
        typeof normalized.estimatedUnitCostCents === "number"
          ? Math.round(
              (normalized.quantityRequested ?? Number(result.data.quantity_requested)) *
                normalized.estimatedUnitCostCents
            )
          : null;
    }

    await client
      .from("estimate_line_items")
      .update(estimateLineItemUpdate)
      .eq("id", result.data.estimate_line_item_id);
  }

  await syncPartRequestHeaderStatus(client, result.data.part_request_id);
  return { ...result, data: mapPartRequestLineRow(result.data) };
}

export async function deletePartRequestLine(client: AppSupabaseClient, lineId: string) {
  const existingResult = await client
    .from("part_request_lines")
    .select("part_request_id")
    .eq("id", lineId)
    .maybeSingle<{ part_request_id: string }>();

  if (existingResult.error) {
    throw existingResult.error;
  }

  const result = await client.from("part_request_lines").delete().eq("id", lineId);

  if (existingResult.data?.part_request_id) {
    await syncPartRequestHeaderStatus(client, existingResult.data.part_request_id);
  }

  return result;
}

export async function listOpenSupplierCartsByCompany(client: AppSupabaseClient, companyId: string) {
  const result = await client
    .from("supplier_carts")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["open", "submitted"])
    .order("created_at", { ascending: false })
    .returns<SupplierCartRow[]>();

  return { ...result, data: result.data ? result.data.map(mapSupplierCartRow) : null };
}

export async function listSupplierCartsByJobId(client: AppSupabaseClient, jobId: string) {
  const cartLineRows = await client
    .from("supplier_cart_lines")
    .select("cart_id")
    .eq("job_id", jobId)
    .returns<Array<{ cart_id: string }>>();

  if (cartLineRows.error) {
    throw cartLineRows.error;
  }

  const cartIds = [...new Set((cartLineRows.data ?? []).map((row) => row.cart_id))];
  if (!cartIds.length) {
    return { data: [], error: null };
  }

  const result = await client.from("supplier_carts").select("*").in("id", cartIds).returns<SupplierCartRow[]>();
  return { ...result, data: result.data ? result.data.map(mapSupplierCartRow) : null };
}

export async function getSupplierCartById(client: AppSupabaseClient, cartId: string) {
  const [cartResult, linesResult] = await Promise.all([
    client.from("supplier_carts").select("*").eq("id", cartId).single<SupplierCartRow>(),
    listSupplierCartLinesByCartId(client, cartId)
  ]);

  if (cartResult.error || !cartResult.data) {
    return { ...cartResult, data: null as SupplierCartDetail | null };
  }
  if (linesResult.error) {
    throw linesResult.error;
  }

  const supplierAccountResult = await getSupplierAccountById(client, cartResult.data.supplier_account_id);
  if (supplierAccountResult.error || !supplierAccountResult.data) {
    throw supplierAccountResult.error ?? new Error("Supplier account not found.");
  }

  const requestLineIds = (linesResult.data ?? []).map((line) => line.partRequestLineId);
  if (!requestLineIds.length) {
    return {
      data: {
        cart: mapSupplierCartRow(cartResult.data),
        supplierAccount: supplierAccountResult.data,
        lines: []
      },
      error: null
    };
  }

  const requestLinesResult = await client
    .from("part_request_lines")
    .select("*")
    .in("id", requestLineIds)
    .returns<PartRequestLineRow[]>();

  if (requestLinesResult.error) {
    throw requestLinesResult.error;
  }

  const requestLineMap = new Map((requestLinesResult.data ?? []).map((row) => [row.id, mapPartRequestLineRow(row)]));

  return {
    data: {
      cart: mapSupplierCartRow(cartResult.data),
      supplierAccount: supplierAccountResult.data,
      lines: (linesResult.data ?? []).map((cartLine) => ({
        cartLine,
        requestLine: requestLineMap.get(cartLine.partRequestLineId)!
      }))
    },
    error: null
  };
}

export async function findOrCreateOpenSupplierCart(
  client: AppSupabaseClient,
  companyId: string,
  supplierAccountId: string,
  sourceBucketKey: string,
  actorUserId: string
) {
  const existing = await client
    .from("supplier_carts")
    .select("*")
    .eq("company_id", companyId)
    .eq("supplier_account_id", supplierAccountId)
    .eq("source_bucket_key", sourceBucketKey)
    .eq("status", "open")
    .maybeSingle<SupplierCartRow>();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return { data: mapSupplierCartRow(existing.data), error: null };
  }

  const result = await client
    .from("supplier_carts")
    .insert({
      company_id: companyId,
      supplier_account_id: supplierAccountId,
      source_bucket_key: sourceBucketKey,
      created_by_user_id: actorUserId
    })
    .select("*")
    .single<SupplierCartRow>();

  return { ...result, data: result.data ? mapSupplierCartRow(result.data) : null };
}

export async function addSupplierCartLine(client: AppSupabaseClient, cartId: string, input: AddSupplierCartLineInput) {
  const parsed = addSupplierCartLineInputSchema.parse(input);
  const result = await client
    .from("supplier_cart_lines")
    .insert({
      cart_id: cartId,
      company_id: parsed.companyId,
      supplier_account_id: parsed.supplierAccountId,
      part_request_line_id: parsed.partRequestLineId,
      provider_quote_line_id: parsed.providerQuoteLineId ?? null,
      job_id: parsed.jobId,
      quantity: parsed.quantity,
      quoted_unit_cost_cents: parsed.quotedUnitCostCents ?? null,
      quoted_core_charge_cents: parsed.quotedCoreChargeCents ?? 0,
      supplier_part_number: parsed.supplierPartNumber ?? null,
      supplier_url: parsed.supplierUrl ?? null,
      availability_text: parsed.availabilityText ?? null,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<SupplierCartLineRow>();

  return { ...result, data: result.data ? mapSupplierCartLineRow(result.data) : null };
}

export async function updateSupplierCartLine(
  client: AppSupabaseClient,
  cartLineId: string,
  input: UpdateSupplierCartLineInput
) {
  const parsed = updateSupplierCartLineInputSchema.parse(input);
  const cartLineContextResult = await client
    .from("supplier_cart_lines")
    .select("cart_id")
    .eq("id", cartLineId)
    .single<Pick<SupplierCartLineRow, "cart_id">>();

  if (cartLineContextResult.error || !cartLineContextResult.data) {
    return { ...cartLineContextResult, data: null };
  }

  const cartStatusResult = await client
    .from("supplier_carts")
    .select("status")
    .eq("id", cartLineContextResult.data.cart_id)
    .single<Pick<SupplierCartRow, "status">>();

  if (cartStatusResult.error || !cartStatusResult.data) {
    throw cartStatusResult.error ?? new Error("Supplier cart not found.");
  }

  if (cartStatusResult.data.status !== "open") {
    return {
      data: null,
      error: new Error("Only open supplier carts can be edited.")
    };
  }

  const result = await client
    .from("supplier_cart_lines")
    .update({
      quantity: parsed.quantity,
      quoted_unit_cost_cents: parsed.quotedUnitCostCents ?? null,
      quoted_core_charge_cents: parsed.quotedCoreChargeCents ?? 0,
      supplier_part_number: parsed.supplierPartNumber ?? null,
      supplier_url: parsed.supplierUrl ?? null,
      availability_text: parsed.availabilityText ?? null,
      notes: parsed.notes ?? null
    })
    .eq("id", cartLineId)
    .select("*")
    .single<SupplierCartLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  const requestLineResult = await client
    .from("part_request_lines")
    .select("*")
    .eq("id", result.data.part_request_line_id)
    .single<PartRequestLineRow>();

  if (requestLineResult.error || !requestLineResult.data) {
    throw requestLineResult.error ?? new Error("Linked part request line not found.");
  }

  const nextEstimatedCostCents =
    typeof result.data.quoted_unit_cost_cents === "number"
      ? Math.round(Number(requestLineResult.data.quantity_requested) * result.data.quoted_unit_cost_cents)
      : requestLineResult.data.estimated_unit_cost_cents === null
        ? null
        : Math.round(
            Number(requestLineResult.data.quantity_requested) * requestLineResult.data.estimated_unit_cost_cents
          );

  await client
    .from("part_request_lines")
    .update({
      quoted_unit_cost_cents: result.data.quoted_unit_cost_cents,
      core_charge_cents: result.data.quoted_core_charge_cents,
      last_supplier_account_id: result.data.supplier_account_id
    })
    .eq("id", result.data.part_request_line_id);

  if (requestLineResult.data.estimate_line_item_id) {
    await client
      .from("estimate_line_items")
      .update({
        estimated_cost_cents: nextEstimatedCostCents,
        part_request_line_id: requestLineResult.data.id
      })
      .eq("id", requestLineResult.data.estimate_line_item_id);
  }

  await client
    .from("invoice_line_items")
    .update({
      estimated_cost_cents: nextEstimatedCostCents
    })
    .eq("part_request_line_id", requestLineResult.data.id);

  return { ...result, data: mapSupplierCartLineRow(result.data) };
}

export async function removeSupplierCartLine(client: AppSupabaseClient, cartLineId: string) {
  return client.from("supplier_cart_lines").delete().eq("id", cartLineId);
}

export async function listPurchaseOrdersByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: ProcurementWorkspaceQuery = {}
) {
  const parsed = procurementWorkspaceQuerySchema.parse(query);
  let builder = client
    .from("purchase_orders")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (parsed.supplierAccountId) {
    builder = builder.eq("supplier_account_id", parsed.supplierAccountId);
  }
  if (parsed.status && purchaseOrderStatuses.includes(parsed.status as PurchaseOrder["status"])) {
    builder = builder.eq("status", parsed.status as PurchaseOrder["status"]);
  }

  const result = await builder.returns<PurchaseOrderRow[]>();
  return { ...result, data: result.data ? result.data.map(mapPurchaseOrderRow) : null };
}

export async function listPurchaseOrdersByJobId(client: AppSupabaseClient, jobId: string) {
  const poLineRows = await client
    .from("purchase_order_lines")
    .select("purchase_order_id")
    .eq("job_id", jobId)
    .returns<Array<{ purchase_order_id: string }>>();

  if (poLineRows.error) {
    throw poLineRows.error;
  }

  const purchaseOrderIds = [...new Set((poLineRows.data ?? []).map((row) => row.purchase_order_id))];
  if (!purchaseOrderIds.length) {
    return { data: [], error: null };
  }

  const result = await client
    .from("purchase_orders")
    .select("*")
    .in("id", purchaseOrderIds)
    .returns<PurchaseOrderRow[]>();

  return { ...result, data: result.data ? result.data.map(mapPurchaseOrderRow) : null };
}

export async function getPurchaseOrderById(client: AppSupabaseClient, purchaseOrderId: string) {
  const [purchaseOrderResult, linesResult] = await Promise.all([
    client.from("purchase_orders").select("*").eq("id", purchaseOrderId).single<PurchaseOrderRow>(),
    listPurchaseOrderLinesByPurchaseOrderId(client, purchaseOrderId)
  ]);

  if (purchaseOrderResult.error || !purchaseOrderResult.data) {
    return { ...purchaseOrderResult, data: null as PurchaseOrderDetail | null };
  }
  if (linesResult.error) {
    throw linesResult.error;
  }

  const supplierAccountResult = await getSupplierAccountById(client, purchaseOrderResult.data.supplier_account_id);
  if (supplierAccountResult.error || !supplierAccountResult.data) {
    throw supplierAccountResult.error ?? new Error("Supplier account not found.");
  }

  const receiptsResult = await client
    .from("purchase_receipts")
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("received_at", { ascending: false })
    .returns<PurchaseReceiptRow[]>();
  const returnsResult = await client
    .from("part_returns")
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: false })
    .returns<PartReturnRow[]>();

  if (receiptsResult.error) {
    throw receiptsResult.error;
  }
  if (returnsResult.error) {
    throw returnsResult.error;
  }

  const receiptIds = (receiptsResult.data ?? []).map((receipt) => receipt.id);
  const returnIds = (returnsResult.data ?? []).map((partReturn) => partReturn.id);
  const [receiptLinesResult, returnLinesResult] = await Promise.all([
    receiptIds.length
      ? client.from("purchase_receipt_lines").select("*").in("receipt_id", receiptIds).returns<PurchaseReceiptLineRow[]>()
      : Promise.resolve({ data: [] as PurchaseReceiptLineRow[], error: null }),
    returnIds.length
      ? client.from("part_return_lines").select("*").in("part_return_id", returnIds).returns<PartReturnLineRow[]>()
      : Promise.resolve({ data: [] as PartReturnLineRow[], error: null })
  ]);

  if (receiptLinesResult.error) {
    throw receiptLinesResult.error;
  }
  if (returnLinesResult.error) {
    throw returnLinesResult.error;
  }

  return {
    data: {
      purchaseOrder: mapPurchaseOrderRow(purchaseOrderResult.data),
      supplierAccount: supplierAccountResult.data,
      lines: linesResult.data ?? [],
      receipts: (receiptsResult.data ?? []).map((receipt) => ({
        receipt: {
          id: receipt.id,
          companyId: receipt.company_id,
          supplierAccountId: receipt.supplier_account_id,
          purchaseOrderId: receipt.purchase_order_id,
          receiptNumber: receipt.receipt_number,
          receivedByUserId: receipt.received_by_user_id,
          receivedAt: receipt.received_at,
          notes: receipt.notes,
          createdAt: receipt.created_at,
          updatedAt: receipt.updated_at
        },
        lines: (receiptLinesResult.data ?? [])
          .filter((line) => line.receipt_id === receipt.id)
          .map((line) => ({
            id: line.id,
            receiptId: line.receipt_id,
            companyId: line.company_id,
            purchaseOrderLineId: line.purchase_order_line_id,
            quantityReceived: Number(line.quantity_received),
            receivedIntoInventoryQuantity: Number(line.received_into_inventory_quantity),
            unitReceivedCostCents: line.unit_received_cost_cents,
            notes: line.notes,
            createdAt: line.created_at,
            updatedAt: line.updated_at
          }))
      })),
      returns: (returnsResult.data ?? []).map((partReturn) => ({
        partReturn: {
          id: partReturn.id,
          companyId: partReturn.company_id,
          supplierAccountId: partReturn.supplier_account_id,
          purchaseOrderId: partReturn.purchase_order_id,
          status: partReturn.status,
          returnNumber: partReturn.return_number,
          reason: partReturn.reason,
          returnedByUserId: partReturn.returned_by_user_id,
          returnedAt: partReturn.returned_at,
          notes: partReturn.notes,
          createdAt: partReturn.created_at,
          updatedAt: partReturn.updated_at
        },
        lines: (returnLinesResult.data ?? [])
          .filter((line) => line.part_return_id === partReturn.id)
          .map((line) => ({
            id: line.id,
            partReturnId: line.part_return_id,
            companyId: line.company_id,
            purchaseOrderLineId: line.purchase_order_line_id,
            quantityReturned: Number(line.quantity_returned),
            isCoreReturn: line.is_core_return,
            creditAmountCents: line.credit_amount_cents,
            notes: line.notes,
            createdAt: line.created_at,
            updatedAt: line.updated_at
          }))
      }))
    },
    error: null
  };
}

export async function createPurchaseOrderFromCart(
  client: AppSupabaseClient,
  input: ConvertSupplierCartToPurchaseOrderInput
) {
  const parsed = convertSupplierCartToPurchaseOrderInputSchema.parse(input);
  const cartResult = await getSupplierCartById(client, parsed.cartId);
  if (cartResult.error || !cartResult.data) {
    return { ...cartResult, data: null };
  }

  if (cartResult.data.cart.status !== "open") {
    return {
      data: null,
      error: new Error("Only open supplier carts can be converted into purchase orders.")
    };
  }

  if (cartResult.data.cart.convertedPurchaseOrderId) {
    return {
      data: null,
      error: new Error("This supplier cart has already been converted into a purchase order.")
    };
  }

  if (!cartResult.data.lines.length) {
    return {
      data: null,
      error: new Error("Supplier carts must contain at least one line before conversion.")
    };
  }

  const poResult = await client
    .from("purchase_orders")
    .insert({
      company_id: parsed.companyId,
      supplier_account_id: cartResult.data.cart.supplierAccountId,
      supplier_cart_id: parsed.cartId,
      po_number: parsed.poNumber.trim(),
      ordered_by_user_id: parsed.orderedByUserId,
      expected_at: parsed.expectedAt ?? null,
      external_reference: parsed.externalReference ?? null,
      manual_order_url: parsed.manualOrderUrl ?? null,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<PurchaseOrderRow>();

  if (poResult.error || !poResult.data) {
    return { ...poResult, data: null };
  }

  const poLines: PurchaseOrderLineInsert[] = cartResult.data.lines.map(({ cartLine, requestLine }) => ({
    purchase_order_id: poResult.data.id,
    company_id: parsed.companyId,
    supplier_account_id: cartResult.data.cart.supplierAccountId,
    part_request_line_id: requestLine.id,
    job_id: requestLine.jobId,
    supplier_cart_line_id: cartLine.id,
    status: "quoted",
    description: requestLine.description,
    manufacturer: requestLine.manufacturer,
    part_number: requestLine.partNumber,
    supplier_part_number: cartLine.supplierPartNumber,
    quantity_ordered: cartLine.quantity,
    unit_ordered_cost_cents: cartLine.quotedUnitCostCents ?? requestLine.quotedUnitCostCents ?? 0,
    core_charge_cents: cartLine.quotedCoreChargeCents,
    is_core_returnable: requestLine.needsCore
  }));

  if (poLines.length) {
    const insertLinesResult = await client.from("purchase_order_lines").insert(poLines);
    if (insertLinesResult.error) {
      throw insertLinesResult.error;
    }
  }

  await client
    .from("supplier_carts")
    .update({
      converted_purchase_order_id: poResult.data.id,
      status: "converted",
      submitted_at: new Date().toISOString(),
      submitted_by_user_id: parsed.orderedByUserId
    })
    .eq("id", parsed.cartId);

  return { ...poResult, data: mapPurchaseOrderRow(poResult.data) };
}

export async function markPurchaseOrderOrdered(
  client: AppSupabaseClient,
  purchaseOrderId: string,
  input: MarkPurchaseOrderOrderedInput
) {
  const parsed = markPurchaseOrderOrderedInputSchema.parse(input);
  const existingPurchaseOrderResult = await client
    .from("purchase_orders")
    .select("*")
    .eq("id", purchaseOrderId)
    .single<PurchaseOrderRow>();

  if (existingPurchaseOrderResult.error || !existingPurchaseOrderResult.data) {
    return { ...existingPurchaseOrderResult, data: null };
  }

  if (existingPurchaseOrderResult.data.status !== "draft") {
    return {
      data: null,
      error: new Error("Only draft purchase orders can be marked ordered.")
    };
  }

  const result = await client
    .from("purchase_orders")
    .update({
      status: "ordered",
      ordered_at: parsed.orderedAt ?? new Date().toISOString(),
      expected_at: parsed.expectedAt ?? null,
      external_reference: parsed.externalReference ?? null,
      manual_order_url: parsed.manualOrderUrl ?? null,
      notes: parsed.notes ?? null
    })
    .eq("id", purchaseOrderId)
    .select("*")
    .single<PurchaseOrderRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  const poLinesResult = await listPurchaseOrderLinesByPurchaseOrderId(client, purchaseOrderId);
  if (poLinesResult.error) {
    throw poLinesResult.error;
  }

  await client.from("purchase_order_lines").update({ status: "ordered" }).eq("purchase_order_id", purchaseOrderId);
  for (const line of poLinesResult.data ?? []) {
    await syncPartRequestLineFromPurchaseOrderLines(client, line.partRequestLineId);
  }
  await syncPurchaseOrderStatus(client, purchaseOrderId);

  return { ...result, data: mapPurchaseOrderRow(result.data) };
}

export async function updatePurchaseOrderExpectedAt(
  client: AppSupabaseClient,
  purchaseOrderId: string,
  expectedAt: string | null
) {
  return client.from("purchase_orders").update({ expected_at: expectedAt }).eq("id", purchaseOrderId);
}

export async function recordPurchaseReceipt(
  client: AppSupabaseClient,
  input: RecordPurchaseReceiptInput
) {
  const parsed = recordPurchaseReceiptInputSchema.parse(input);
  const mutationContexts = await Promise.all(
    parsed.lines.map((line) =>
      getPurchaseOrderMutationContext(client, line.purchaseOrderLineId, {
        allowedPurchaseOrderStatuses: ["ordered", "partially_received"],
        expectedPurchaseOrderId: parsed.purchaseOrderId,
        expectedSupplierAccountId: parsed.supplierAccountId
      })
    )
  );

  for (let index = 0; index < mutationContexts.length; index += 1) {
    const context = mutationContexts[index]!;
    const line = parsed.lines[index]!;
    const nextQuantityReceived = Number(context.line.quantity_received) + line.quantityReceived;
    assertPurchaseOrderLineQuantities(context.line, {
      quantityReceived: nextQuantityReceived
    });
  }

  const receiptResult = await client
    .from("purchase_receipts")
    .insert({
      company_id: parsed.companyId,
      supplier_account_id: parsed.supplierAccountId,
      purchase_order_id: parsed.purchaseOrderId,
      receipt_number: parsed.receiptNumber ?? null,
      received_by_user_id: parsed.receivedByUserId,
      received_at: parsed.receivedAt,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<PurchaseReceiptRow>();

  if (receiptResult.error || !receiptResult.data) {
    return { ...receiptResult, data: null };
  }

  for (let index = 0; index < parsed.lines.length; index += 1) {
    const line = parsed.lines[index]!;
    const mutationContext = mutationContexts[index]!;
    const nextQuantityReceived = Number(mutationContext.line.quantity_received) + line.quantityReceived;
    const nextStatus = calculatePartLifecycleStatus({
      quantityOrdered: Number(mutationContext.line.quantity_ordered),
      quantityReceived: nextQuantityReceived,
      quantityInstalled: Number(mutationContext.line.quantity_installed),
      quantityReturned: Number(mutationContext.line.quantity_returned),
      quantityCoreDue: Number(mutationContext.line.quantity_core_due),
      quantityCoreReturned: Number(mutationContext.line.quantity_core_returned)
    });

    const receiptLineResult = await client
      .from("purchase_receipt_lines")
      .insert({
        receipt_id: receiptResult.data.id,
        company_id: parsed.companyId,
        purchase_order_line_id: line.purchaseOrderLineId,
        quantity_received: line.quantityReceived,
        unit_received_cost_cents: line.unitReceivedCostCents ?? null,
        notes: line.notes ?? null
      })
      .select("*")
      .single<PurchaseReceiptLineRow>();

    if (receiptLineResult.error) {
      throw receiptLineResult.error;
    }

    await client
      .from("purchase_order_lines")
      .update({
        quantity_received: nextQuantityReceived,
        status: nextStatus,
        unit_actual_cost_cents: line.unitReceivedCostCents ?? mutationContext.line.unit_actual_cost_cents
      })
      .eq("id", line.purchaseOrderLineId);

    await syncPartRequestLineFromPurchaseOrderLines(client, mutationContext.line.part_request_line_id);
  }

  await syncPurchaseOrderStatus(client, parsed.purchaseOrderId);
  return { ...receiptResult, data: receiptResult.data };
}

export async function recordPartInstallation(
  client: AppSupabaseClient,
  input: RecordPartInstallationInput
) {
  const parsed = recordPartInstallationInputSchema.parse(input);
  const mutationContext = await getPurchaseOrderMutationContext(client, parsed.purchaseOrderLineId, {
    allowedPurchaseOrderStatuses: ["ordered", "partially_received", "received"]
  });
  const nextQuantityInstalled = Number(mutationContext.line.quantity_installed) + parsed.quantityInstalled;
  assertPurchaseOrderLineQuantities(mutationContext.line, {
    quantityInstalled: nextQuantityInstalled
  });
  const nextStatus = calculatePartLifecycleStatus({
    quantityOrdered: Number(mutationContext.line.quantity_ordered),
    quantityReceived: Number(mutationContext.line.quantity_received),
    quantityInstalled: nextQuantityInstalled,
    quantityReturned: Number(mutationContext.line.quantity_returned),
    quantityCoreDue: Number(mutationContext.line.quantity_core_due),
    quantityCoreReturned: Number(mutationContext.line.quantity_core_returned)
  });

  const result = await client
    .from("purchase_order_lines")
    .update({
      quantity_installed: nextQuantityInstalled,
      status: nextStatus
    })
    .eq("id", parsed.purchaseOrderLineId)
    .select("*")
    .single<PurchaseOrderLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  await syncPartRequestLineFromPurchaseOrderLines(client, result.data.part_request_line_id);
  await syncPurchaseOrderStatus(client, result.data.purchase_order_id);
  return { ...result, data: mapPurchaseOrderLineRow(result.data) };
}

export async function createPartReturn(client: AppSupabaseClient, input: CreatePartReturnInput) {
  const parsed = createPartReturnInputSchema.parse(input);
  const mutationContexts = await Promise.all(
    parsed.lines.map((line) =>
      getPurchaseOrderMutationContext(client, line.purchaseOrderLineId, {
        allowedPurchaseOrderStatuses: ["ordered", "partially_received", "received"],
        expectedPurchaseOrderId: parsed.purchaseOrderId ?? null,
        expectedSupplierAccountId: parsed.supplierAccountId
      })
    )
  );

  for (let index = 0; index < mutationContexts.length; index += 1) {
    const context = mutationContexts[index]!;
    const line = parsed.lines[index]!;
    const nextQuantityReturned = Number(context.line.quantity_returned) + line.quantityReturned;
    const nextQuantityCoreReturned =
      Number(context.line.quantity_core_returned) + (line.isCoreReturn ? line.quantityReturned : 0);
    assertPurchaseOrderLineQuantities(context.line, {
      quantityReturned: nextQuantityReturned,
      quantityCoreReturned: nextQuantityCoreReturned
    });
  }

  const result = await client
    .from("part_returns")
    .insert({
      company_id: parsed.companyId,
      supplier_account_id: parsed.supplierAccountId,
      purchase_order_id: parsed.purchaseOrderId ?? null,
      status: parsed.returnedAt ? "completed" : "submitted",
      return_number: parsed.returnNumber ?? null,
      reason: parsed.reason ?? null,
      returned_by_user_id: parsed.returnedByUserId,
      returned_at: parsed.returnedAt ?? null,
      notes: parsed.notes ?? null
    })
    .select("*")
    .single<PartReturnRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  for (let index = 0; index < parsed.lines.length; index += 1) {
    const line = parsed.lines[index]!;
    const mutationContext = mutationContexts[index]!;
    await client.from("part_return_lines").insert({
      part_return_id: result.data.id,
      company_id: parsed.companyId,
      purchase_order_line_id: line.purchaseOrderLineId,
      quantity_returned: line.quantityReturned,
      is_core_return: line.isCoreReturn ?? false,
      credit_amount_cents: line.creditAmountCents ?? null,
      notes: line.notes ?? null
    });

    const nextQuantityReturned = Number(mutationContext.line.quantity_returned) + line.quantityReturned;
    const nextQuantityCoreReturned =
      Number(mutationContext.line.quantity_core_returned) + (line.isCoreReturn ? line.quantityReturned : 0);
    const nextStatus = calculatePartLifecycleStatus({
      quantityOrdered: Number(mutationContext.line.quantity_ordered),
      quantityReceived: Number(mutationContext.line.quantity_received),
      quantityInstalled: Number(mutationContext.line.quantity_installed),
      quantityReturned: nextQuantityReturned,
      quantityCoreDue: Number(mutationContext.line.quantity_core_due),
      quantityCoreReturned: nextQuantityCoreReturned
    });

    await client
      .from("purchase_order_lines")
      .update({
        quantity_returned: nextQuantityReturned,
        quantity_core_returned: nextQuantityCoreReturned,
        status: nextStatus
      })
      .eq("id", line.purchaseOrderLineId);

    await syncPartRequestLineFromPurchaseOrderLines(client, mutationContext.line.part_request_line_id);
    await syncPurchaseOrderStatus(client, mutationContext.line.purchase_order_id);
  }

  return { ...result, data: result.data };
}

export async function markCoreDue(client: AppSupabaseClient, input: MarkCoreDueInput) {
  const parsed = markCoreDueInputSchema.parse(input);
  const mutationContext = await getPurchaseOrderMutationContext(client, parsed.purchaseOrderLineId, {
    allowedPurchaseOrderStatuses: ["ordered", "partially_received", "received"]
  });

  if (!mutationContext.line.is_core_returnable) {
    return {
      data: null,
      error: new Error("Core tracking is only available for lines marked as core returnable.")
    };
  }

  assertPurchaseOrderLineQuantities(mutationContext.line, {
    quantityCoreDue: parsed.quantityCoreDue
  });
  const nextStatus = calculatePartLifecycleStatus({
    quantityOrdered: Number(mutationContext.line.quantity_ordered),
    quantityReceived: Number(mutationContext.line.quantity_received),
    quantityInstalled: Number(mutationContext.line.quantity_installed),
    quantityReturned: Number(mutationContext.line.quantity_returned),
    quantityCoreDue: parsed.quantityCoreDue,
    quantityCoreReturned: Number(mutationContext.line.quantity_core_returned)
  });
  const result = await client
    .from("purchase_order_lines")
    .update({
      quantity_core_due: parsed.quantityCoreDue,
      status: nextStatus
    })
    .eq("id", parsed.purchaseOrderLineId)
    .select("*")
    .single<PurchaseOrderLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  await syncPartRequestLineFromPurchaseOrderLines(client, result.data.part_request_line_id);
  return { ...result, data: mapPurchaseOrderLineRow(result.data) };
}

export async function markCoreReturned(client: AppSupabaseClient, input: MarkCoreReturnedInput) {
  const parsed = markCoreReturnedInputSchema.parse(input);
  const mutationContext = await getPurchaseOrderMutationContext(client, parsed.purchaseOrderLineId, {
    allowedPurchaseOrderStatuses: ["ordered", "partially_received", "received"]
  });

  if (!mutationContext.line.is_core_returnable) {
    return {
      data: null,
      error: new Error("Core tracking is only available for lines marked as core returnable.")
    };
  }

  assertPurchaseOrderLineQuantities(mutationContext.line, {
    quantityCoreReturned: parsed.quantityCoreReturned
  });
  const nextStatus = calculatePartLifecycleStatus({
    quantityOrdered: Number(mutationContext.line.quantity_ordered),
    quantityReceived: Number(mutationContext.line.quantity_received),
    quantityInstalled: Number(mutationContext.line.quantity_installed),
    quantityReturned: Number(mutationContext.line.quantity_returned),
    quantityCoreDue: Number(mutationContext.line.quantity_core_due),
    quantityCoreReturned: parsed.quantityCoreReturned
  });
  const result = await client
    .from("purchase_order_lines")
    .update({
      quantity_core_returned: parsed.quantityCoreReturned,
      status: nextStatus
    })
    .eq("id", parsed.purchaseOrderLineId)
    .select("*")
    .single<PurchaseOrderLineRow>();

  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  await syncPartRequestLineFromPurchaseOrderLines(client, result.data.part_request_line_id);
  return { ...result, data: mapPurchaseOrderLineRow(result.data) };
}

export async function getJobPartsSummary(client: AppSupabaseClient, jobId: string) {
  const [requestLinesResult, estimateLinesResult, invoiceLinesResult] = await Promise.all([
    client.from("part_request_lines").select("*").eq("job_id", jobId).returns<PartRequestLineRow[]>(),
    client
      .from("estimate_line_items")
      .select("*")
      .eq("job_id", jobId)
      .not("part_request_line_id", "is", null)
      .returns<EstimateLineItemRow[]>(),
    client
      .from("invoice_line_items")
      .select("*")
      .eq("job_id", jobId)
      .not("part_request_line_id", "is", null)
      .returns<InvoiceLineItemRow[]>()
  ]);

  if (requestLinesResult.error) {
    throw requestLinesResult.error;
  }
  if (estimateLinesResult.error) {
    throw estimateLinesResult.error;
  }
  if (invoiceLinesResult.error) {
    throw invoiceLinesResult.error;
  }

  const requestLines = (requestLinesResult.data ?? []).map(mapPartRequestLineRow);
  const actualCostSnapshotsResult = await getPartRequestLineActualCostSnapshots(
    client,
    requestLines.map((line) => line.id)
  );

  if (actualCostSnapshotsResult.error) {
    throw actualCostSnapshotsResult.error;
  }

  const actualCostCentsByRequestLineId = new Map(
    (actualCostSnapshotsResult.data ?? []).map((snapshot) => [
      snapshot.partRequestLineId,
      snapshot.actualCostCents
    ])
  );

  return {
    data: calculateJobPartsSummary(
      requestLines,
      (estimateLinesResult.data ?? []).map((line) => ({
        partRequestLineId: line.part_request_line_id,
        lineSubtotalCents: line.line_subtotal_cents
      })),
      (invoiceLinesResult.data ?? []).map((line) => ({
        partRequestLineId: line.part_request_line_id,
        lineSubtotalCents: line.line_subtotal_cents
      })),
      actualCostCentsByRequestLineId
    ),
    error: null
  };
}

export async function getEstimatePartsSummary(client: AppSupabaseClient, estimateId: string) {
  const result = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .not("part_request_line_id", "is", null)
    .returns<EstimateLineItemRow[]>();

  if (result.error) {
    throw result.error;
  }

  return {
    data: calculateEstimatePartsSummary(
      estimateId,
      (result.data ?? []).map((line) => ({
        partRequestLineId: line.part_request_line_id,
        lineSubtotalCents: line.line_subtotal_cents,
        estimatedCostCents: line.estimated_cost_cents,
        actualCostCents: line.actual_cost_cents
      }))
    ),
    error: null
  };
}

export async function getInvoicePartsSummary(client: AppSupabaseClient, invoiceId: string) {
  const result = await client
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .not("part_request_line_id", "is", null)
    .returns<InvoiceLineItemRow[]>();

  if (result.error) {
    throw result.error;
  }

  return {
    data: calculateInvoicePartsSummary(
      invoiceId,
      (result.data ?? []).map((line) => ({
        partRequestLineId: line.part_request_line_id,
        lineSubtotalCents: line.line_subtotal_cents,
        estimatedCostCents: line.estimated_cost_cents,
        actualCostCents: line.actual_cost_cents
      }))
    ),
    error: null
  };
}
