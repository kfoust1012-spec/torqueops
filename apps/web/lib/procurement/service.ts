import {
  addSupplierCartLine,
  createPartRequest,
  createPartRequestFromEstimate,
  createPartReturn,
  createPurchaseOrderFromCart,
  findOrCreateOpenSupplierCart,
  getEstimateByJobId,
  getEstimatePartsSummary,
  getInvoiceByJobId,
  getInvoicePartsSummary,
  getJobById,
  getJobPartsSummary,
  getPartRequestLineActualCostSnapshots,
  getPartRequestById,
  getVehicleById,
  listOpenSupplierCartsByCompany,
  listPartRequestsByCompany,
  listPartRequestsByJobId,
  listPurchaseOrdersByCompany,
  listPurchaseOrdersByJobId,
  listSupplierAccountsByCompany,
  listSupplierCartsByJobId,
  listSupplierRoutingRulesByCompany,
  markCoreDue,
  markCoreReturned,
  markPurchaseOrderOrdered,
  recordPartInstallation,
  recordPurchaseReceipt,
  updatePartRequestLine
} from "@mobile-mechanic/api-client";
import {
  groupRequestLinesIntoSupplierBuckets,
  isPartRequestLineFulfilled,
  resolveActualUnitCostCents
} from "@mobile-mechanic/core";
import type {
  ConvertSupplierCartToPurchaseOrderInput,
  CreatePartRequestFromEstimateInput,
  CreatePartRequestInput,
  CreatePartReturnInput,
  Database,
  MarkCoreDueInput,
  MarkCoreReturnedInput,
  MarkPurchaseOrderOrderedInput,
  PartRequestLine,
  RecordPartInstallationInput,
  RecordPurchaseReceiptInput,
  RoutePartRequestLinesInput
} from "@mobile-mechanic/types";
import type { AppSupabaseClient } from "@mobile-mechanic/api-client";

function getOutstandingDemandQuantity(input: {
  quantityConsumedFromStock?: number;
  quantityReturnedToInventory?: number;
  quantityInstalled: number;
  quantityRequested: number;
  quantityReservedFromStock?: number;
}) {
  const netConsumedFromStockQuantity = Math.max(
    Number(input.quantityConsumedFromStock ?? 0) - Number(input.quantityReturnedToInventory ?? 0),
    0
  );

  return Math.max(
    Number(input.quantityRequested) -
      Number(input.quantityInstalled) -
      Number(input.quantityReservedFromStock ?? 0) -
      netConsumedFromStockQuantity,
    0
  );
}

function getOutstandingPurchaseOrderCoverageQuantity(input: {
  quantityInstalled: number;
  quantityOrdered: number;
  quantityReturned: number;
}) {
  return Math.max(
    Number(input.quantityOrdered) -
      Number(input.quantityInstalled) -
      Number(input.quantityReturned),
    0
  );
}

async function getPartRequestLinesByIds(client: AppSupabaseClient, lineIds: string[]) {
  if (!lineIds.length) {
    return [];
  }

  const result = await client
    .from("part_request_lines")
    .select("*")
    .in("id", lineIds)
    .returns<
      Array<{
        actual_unit_cost_cents: number | null;
        estimated_unit_cost_cents: number | null;
        estimate_line_item_id: string | null;
        id: string;
        part_request_id: string;
        job_id: string;
        description: string;
        status: PartRequestLine["status"];
        quantity_received: number;
        quantity_requested: number;
        quantity_installed: number;
        quantity_returned: number;
        quantity_core_due: number;
        quantity_core_returned: number;
        quoted_unit_cost_cents: number | null;
      }>
    >();

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as Array<{
    actual_unit_cost_cents: number | null;
    estimated_unit_cost_cents: number | null;
    estimate_line_item_id: string | null;
    id: string;
    part_request_id: string;
    job_id: string;
    description: string;
    status: PartRequestLine["status"];
    quantity_received: number;
    quantity_requested: number;
    quantity_installed: number;
    quantity_returned: number;
    quantity_core_due: number;
    quantity_core_returned: number;
    quoted_unit_cost_cents: number | null;
  }>;
}

async function writeBackPartCostsToEstimateByLineIds(client: AppSupabaseClient, partRequestLineIds: string[]) {
  const uniqueLineIds = [...new Set(partRequestLineIds)];
  const [lines, actualCostSnapshotsResult] = await Promise.all([
    getPartRequestLinesByIds(client, uniqueLineIds),
    getPartRequestLineActualCostSnapshots(client, uniqueLineIds)
  ]);
  if (actualCostSnapshotsResult.error) {
    throw actualCostSnapshotsResult.error;
  }

  const actualCostSnapshotsByRequestLineId = new Map(
    (actualCostSnapshotsResult.data ?? []).map((snapshot) => [snapshot.partRequestLineId, snapshot])
  );

  for (const line of lines) {
    if (!line.estimate_line_item_id) {
      continue;
    }

    const estimatedCostCents =
      typeof line.estimated_unit_cost_cents === "number"
        ? Math.round(line.estimated_unit_cost_cents * Number(line.quantity_requested))
        : typeof line.quoted_unit_cost_cents === "number"
          ? Math.round(line.quoted_unit_cost_cents * Number(line.quantity_requested))
          : null;
    const actualUnitCostCents = resolveActualUnitCostCents({
      actualUnitCostCents: line.actual_unit_cost_cents,
      estimatedUnitCostCents: line.estimated_unit_cost_cents,
      quotedUnitCostCents: line.quoted_unit_cost_cents
    });
    const actualCostSnapshot = actualCostSnapshotsByRequestLineId.get(line.id);

    await client
      .from("estimate_line_items")
      .update({
        actual_cost_cents:
          typeof actualCostSnapshot?.actualCostCents === "number"
            ? actualCostSnapshot.actualCostCents
            : line.actual_unit_cost_cents === null || Number(line.quantity_received) <= 0
              ? null
              : Math.round(actualUnitCostCents * Math.max(Number(line.quantity_received) - Number(line.quantity_returned), 0)),
        estimated_cost_cents: estimatedCostCents,
        part_request_line_id: line.id
      })
      .eq("id", line.estimate_line_item_id);
  }
}

async function writeBackPartCostsToInvoiceByLineIds(client: AppSupabaseClient, partRequestLineIds: string[]) {
  const uniqueLineIds = [...new Set(partRequestLineIds)];
  const [lines, actualCostSnapshotsResult] = await Promise.all([
    getPartRequestLinesByIds(client, uniqueLineIds),
    getPartRequestLineActualCostSnapshots(client, uniqueLineIds)
  ]);
  if (actualCostSnapshotsResult.error) {
    throw actualCostSnapshotsResult.error;
  }

  const actualCostSnapshotsByRequestLineId = new Map(
    (actualCostSnapshotsResult.data ?? []).map((snapshot) => [snapshot.partRequestLineId, snapshot])
  );

  for (const line of lines) {
    const estimatedCostCents =
      typeof line.estimated_unit_cost_cents === "number"
        ? Math.round(line.estimated_unit_cost_cents * Number(line.quantity_requested))
        : typeof line.quoted_unit_cost_cents === "number"
          ? Math.round(line.quoted_unit_cost_cents * Number(line.quantity_requested))
          : null;
    const actualUnitCostCents = resolveActualUnitCostCents({
      actualUnitCostCents: line.actual_unit_cost_cents,
      estimatedUnitCostCents: line.estimated_unit_cost_cents,
      quotedUnitCostCents: line.quoted_unit_cost_cents
    });
    const actualCostSnapshot = actualCostSnapshotsByRequestLineId.get(line.id);

    await client
      .from("invoice_line_items")
      .update({
        actual_cost_cents:
          typeof actualCostSnapshot?.actualCostCents === "number"
            ? actualCostSnapshot.actualCostCents
            : line.actual_unit_cost_cents === null || Number(line.quantity_received) <= 0
              ? null
              : Math.round(actualUnitCostCents * Math.max(Number(line.quantity_received) - Number(line.quantity_returned), 0)),
        estimated_cost_cents: estimatedCostCents
      })
      .eq("part_request_line_id", line.id);
  }
}

export async function writeBackPartCostsToEstimate(
  client: AppSupabaseClient,
  partRequestLineIds: string[]
) {
  await writeBackPartCostsToEstimateByLineIds(client, partRequestLineIds);
}

export async function writeBackPartCostsToInvoice(
  client: AppSupabaseClient,
  partRequestLineIds: string[]
) {
  await writeBackPartCostsToInvoiceByLineIds(client, partRequestLineIds);
}

export async function getProcurementWorkspace(client: AppSupabaseClient, companyId: string) {
  const [
    requestsResult,
    cartsResult,
    purchaseOrdersResult,
    supplierAccountsResult,
    supplierCartStatusResult,
    requestLinesResult,
    cartLineLinksResult,
    poLineLinksResult
  ] = await Promise.all([
    listPartRequestsByCompany(client, companyId),
    listOpenSupplierCartsByCompany(client, companyId),
    listPurchaseOrdersByCompany(client, companyId),
    listSupplierAccountsByCompany(client, companyId),
    client
      .from("supplier_carts")
      .select("id, status")
      .eq("company_id", companyId)
      .returns<Array<{ id: string; status: "open" | "submitted" | "converted" | "abandoned" }>>(),
    client
      .from("part_request_lines")
      .select(
        "id, part_request_id, job_id, description, status, quantity_requested, quantity_received, quantity_installed, quantity_returned, quantity_core_due, quantity_core_returned, quantity_reserved_from_stock, quantity_consumed_from_stock, quantity_returned_to_inventory"
      )
      .eq("company_id", companyId)
      .returns<
        Array<{
          id: string;
          part_request_id: string;
          job_id: string;
          description: string;
          status: PartRequestLine["status"];
          quantity_requested: number;
          quantity_received: number;
          quantity_installed: number;
          quantity_returned: number;
          quantity_core_due: number;
          quantity_core_returned: number;
          quantity_reserved_from_stock: number;
          quantity_consumed_from_stock: number;
          quantity_returned_to_inventory: number;
        }>
      >(),
    client
      .from("supplier_cart_lines")
      .select("part_request_line_id, cart_id, quantity")
      .eq("company_id", companyId)
      .returns<Array<{ cart_id: string; part_request_line_id: string; quantity: number }>>(),
    client
      .from("purchase_order_lines")
      .select(
        "part_request_line_id, purchase_order_id, quantity_ordered, quantity_installed, quantity_returned, quantity_core_due, quantity_core_returned"
      )
      .eq("company_id", companyId)
      .returns<
        Array<{
          part_request_line_id: string;
          purchase_order_id: string;
          quantity_core_due: number;
          quantity_core_returned: number;
          quantity_installed: number;
          quantity_ordered: number;
          quantity_returned: number;
        }>
      >()
  ]);

  if (requestsResult.error) {
    throw requestsResult.error;
  }
  if (cartsResult.error) {
    throw cartsResult.error;
  }
  if (purchaseOrdersResult.error) {
    throw purchaseOrdersResult.error;
  }
  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }
  if (supplierCartStatusResult.error) {
    throw supplierCartStatusResult.error;
  }
  if (requestLinesResult.error) {
    throw requestLinesResult.error;
  }
  if (cartLineLinksResult.error) {
    throw cartLineLinksResult.error;
  }
  if (poLineLinksResult.error) {
    throw poLineLinksResult.error;
  }

  const openRequests = (requestsResult.data ?? []).filter((request) => request.status === "open");
  const openRequestIds = new Set(openRequests.map((request) => request.id));
  const supplierCartStatusById = new Map(
    (supplierCartStatusResult.data ?? []).map((cart) => [cart.id, cart.status])
  );
  const purchaseOrdersById = new Map(
    (purchaseOrdersResult.data ?? []).map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
  );
  const openCartCoverageByRequestLineId = new Map<string, number>();
  const activePurchaseOrderCoverageByRequestLineId = new Map<string, number>();
  const openPurchaseOrderIds = new Set<string>();

  for (const line of cartLineLinksResult.data ?? []) {
    if (supplierCartStatusById.get(line.cart_id) !== "open") {
      continue;
    }

    openCartCoverageByRequestLineId.set(
      line.part_request_line_id,
      (openCartCoverageByRequestLineId.get(line.part_request_line_id) ?? 0) + Number(line.quantity)
    );
  }

  for (const line of poLineLinksResult.data ?? []) {
    const purchaseOrder = purchaseOrdersById.get(line.purchase_order_id);

    if (!purchaseOrder) {
      continue;
    }

    const outstandingCoverageQuantity = getOutstandingPurchaseOrderCoverageQuantity({
      quantityInstalled: Number(line.quantity_installed),
      quantityOrdered: Number(line.quantity_ordered),
      quantityReturned: Number(line.quantity_returned)
    });
    const hasOutstandingCore =
      Number(line.quantity_core_due) > Number(line.quantity_core_returned);

    if (["draft", "ordered", "partially_received"].includes(purchaseOrder.status)) {
      openPurchaseOrderIds.add(purchaseOrder.id);
    } else if (
      purchaseOrder.status === "received" &&
      (outstandingCoverageQuantity > 0 || hasOutstandingCore)
    ) {
      openPurchaseOrderIds.add(purchaseOrder.id);
    }

    if (
      ["draft", "ordered", "partially_received", "received"].includes(purchaseOrder.status) &&
      outstandingCoverageQuantity > 0
    ) {
      activePurchaseOrderCoverageByRequestLineId.set(
        line.part_request_line_id,
        (activePurchaseOrderCoverageByRequestLineId.get(line.part_request_line_id) ?? 0) +
          outstandingCoverageQuantity
      );
    }
  }

  const openPurchaseOrders = (purchaseOrdersResult.data ?? []).filter((purchaseOrder) =>
    openPurchaseOrderIds.has(purchaseOrder.id)
  );
  const manualAttentionLines = (requestLinesResult.data ?? []).filter((line) => {
    if (!openRequestIds.has(line.part_request_id)) {
      return false;
    }

    if (
      isPartRequestLineFulfilled({
        quantityInstalled: Number(line.quantity_installed),
        quantityRequested: Number(line.quantity_requested)
      })
    ) {
      return false;
    }

    const uncoveredDemandQuantity =
      getOutstandingDemandQuantity({
        quantityConsumedFromStock: Number(line.quantity_consumed_from_stock),
        quantityReturnedToInventory: Number(line.quantity_returned_to_inventory),
        quantityInstalled: Number(line.quantity_installed),
        quantityRequested: Number(line.quantity_requested),
        quantityReservedFromStock: Number(line.quantity_reserved_from_stock)
      }) -
      ((openCartCoverageByRequestLineId.get(line.id) ?? 0) +
        (activePurchaseOrderCoverageByRequestLineId.get(line.id) ?? 0));

    return uncoveredDemandQuantity > 0;
  });

  return {
    manualAttentionLines,
    openCarts: cartsResult.data ?? [],
    openPurchaseOrders,
    openRequests,
    summary: {
      coreOutstandingLines: (requestLinesResult.data ?? []).filter(
        (line) => Number(line.quantity_core_due) > Number(line.quantity_core_returned)
      ).length,
      manualAttentionCount: manualAttentionLines.length,
      openCarts: (cartsResult.data ?? []).length,
      openPurchaseOrders: openPurchaseOrders.length,
      openRequests: openRequests.length
    },
    supplierAccounts: supplierAccountsResult.data ?? []
  };
}

export async function startPartRequestForJob(client: AppSupabaseClient, input: CreatePartRequestInput) {
  const existingRequests = await listPartRequestsByJobId(client, input.jobId);
  if (existingRequests.error) {
    throw existingRequests.error;
  }

  const existingRequest = (existingRequests.data ?? []).find(
    (request) => request.origin === input.origin && request.status === "open" && request.estimateId === (input.estimateId ?? null)
  );

  if (existingRequest) {
    return getPartRequestById(client, existingRequest.id);
  }

  const result = await createPartRequest(client, input);
  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  return getPartRequestById(client, result.data.id);
}

export async function startPartRequestFromEstimate(
  client: AppSupabaseClient,
  input: CreatePartRequestFromEstimateInput
) {
  const result = await createPartRequestFromEstimate(client, input);
  if (result.error || !result.data) {
    return { ...result, data: null };
  }

  await writeBackPartCostsToEstimateByLineIds(client, result.data.lines.map((line) => line.id));
  return result;
}

export async function routePartRequestLinesToSupplierBuckets(
  client: AppSupabaseClient,
  input: RoutePartRequestLinesInput
) {
  const detailResult = await getPartRequestById(client, input.requestId);
  if (detailResult.error || !detailResult.data) {
    return { ...detailResult, data: null };
  }

  const [supplierAccountsResult, routingRulesResult, jobResult] = await Promise.all([
    listSupplierAccountsByCompany(client, input.companyId),
    listSupplierRoutingRulesByCompany(client, input.companyId),
    getJobById(client, detailResult.data.request.jobId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }
  if (routingRulesResult.error) {
    throw routingRulesResult.error;
  }
  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Visit could not be loaded for procurement routing.");
  }

  const targetLines = (detailResult.data.lines ?? []).filter((line) =>
    input.requestLineIds?.length ? input.requestLineIds.includes(line.id) : true
  );

  if (!targetLines.length) {
    return detailResult;
  }

  if (targetLines.some((line) => isPartRequestLineFulfilled(line))) {
    throw new Error("Only open procurement demand can be rerouted.");
  }

  const [vehicleResult, purchaseOrderLineLinksResult, existingCartLinesResult] = await Promise.all([
    getVehicleById(client, jobResult.data.vehicleId),
    client
      .from("purchase_order_lines")
      .select(
        "part_request_line_id, purchase_order_id, quantity_ordered, quantity_installed, quantity_returned"
      )
      .in("part_request_line_id", targetLines.map((line) => line.id))
      .returns<
        Array<{
          part_request_line_id: string;
          purchase_order_id: string;
          quantity_installed: number;
          quantity_ordered: number;
          quantity_returned: number;
        }>
      >(),
    client
      .from("supplier_cart_lines")
      .select("id, cart_id, part_request_line_id")
      .in("part_request_line_id", targetLines.map((line) => line.id))
      .returns<Array<{ cart_id: string; id: string; part_request_line_id: string }>>()
  ]);

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }
  if (purchaseOrderLineLinksResult.error) {
    throw purchaseOrderLineLinksResult.error;
  }
  if (existingCartLinesResult.error) {
    throw existingCartLinesResult.error;
  }

  const purchaseOrderIds = [
    ...new Set((purchaseOrderLineLinksResult.data ?? []).map((line) => line.purchase_order_id))
  ];
  const purchaseOrderStatusResult = purchaseOrderIds.length
    ? await client
        .from("purchase_orders")
        .select("id, status")
        .in("id", purchaseOrderIds)
        .returns<
          Array<{
            id: string;
            status: "draft" | "ordered" | "partially_received" | "received" | "canceled" | "closed";
          }>
        >()
    : {
        data: [] as Array<{
          id: string;
          status: "draft" | "ordered" | "partially_received" | "received" | "canceled" | "closed";
        }>,
        error: null
      };

  if (purchaseOrderStatusResult.error) {
    throw purchaseOrderStatusResult.error;
  }

  const purchaseOrderStatusById = new Map(
    (purchaseOrderStatusResult.data ?? []).map((purchaseOrder) => [purchaseOrder.id, purchaseOrder.status])
  );
  const activePurchaseOrderCoverageByRequestLineId = new Map<string, number>();

  for (const line of purchaseOrderLineLinksResult.data ?? []) {
    const purchaseOrderStatus = purchaseOrderStatusById.get(line.purchase_order_id);

    if (
      !purchaseOrderStatus ||
      !["draft", "ordered", "partially_received", "received"].includes(purchaseOrderStatus)
    ) {
      continue;
    }

    const outstandingCoverageQuantity = getOutstandingPurchaseOrderCoverageQuantity({
      quantityInstalled: Number(line.quantity_installed),
      quantityOrdered: Number(line.quantity_ordered),
      quantityReturned: Number(line.quantity_returned)
    });

    if (outstandingCoverageQuantity <= 0) {
      continue;
    }

    activePurchaseOrderCoverageByRequestLineId.set(
      line.part_request_line_id,
      (activePurchaseOrderCoverageByRequestLineId.get(line.part_request_line_id) ?? 0) +
        outstandingCoverageQuantity
    );
  }

  const existingCartLines = existingCartLinesResult.data ?? [];
  const cartIds = [...new Set(existingCartLines.map((row) => row.cart_id))];
  const cartRowsResult = cartIds.length
    ? await client
        .from("supplier_carts")
        .select("id, status")
        .in("id", cartIds)
        .returns<Array<{ id: string; status: "open" | "submitted" | "converted" | "abandoned" }>>()
    : {
        data: [] as Array<{
          id: string;
          status: "open" | "submitted" | "converted" | "abandoned";
        }>,
        error: null
      };

  if (cartRowsResult.error) {
    throw cartRowsResult.error;
  }

  const cartStatusById = new Map((cartRowsResult.data ?? []).map((cart) => [cart.id, cart.status]));
  const existingOpenCartLineIds = existingCartLines
    .filter((row) => cartStatusById.get(row.cart_id) === "open")
    .map((row) => row.id);
  const existingOpenCartIds = [
    ...new Set(
      existingCartLines
        .filter((row) => cartStatusById.get(row.cart_id) === "open")
        .map((row) => row.cart_id)
    )
  ];
  const routeableDemandByRequestLineId = new Map<string, number>();

  for (const requestLine of targetLines) {
    const unmetDemandQuantity = getOutstandingDemandQuantity({
      quantityConsumedFromStock: requestLine.quantityConsumedFromStock,
      quantityReturnedToInventory: requestLine.quantityReturnedToInventory,
      quantityInstalled: requestLine.quantityInstalled,
      quantityRequested: requestLine.quantityRequested,
      quantityReservedFromStock: requestLine.quantityReservedFromStock
    });
    const activePurchaseOrderCoverageQuantity =
      activePurchaseOrderCoverageByRequestLineId.get(requestLine.id) ?? 0;
    const routeableDemandQuantity = Math.max(
      unmetDemandQuantity - activePurchaseOrderCoverageQuantity,
      0
    );

    if (routeableDemandQuantity > 0) {
      routeableDemandByRequestLineId.set(requestLine.id, routeableDemandQuantity);
    }
  }

  if (existingOpenCartLineIds.length) {
    await client.from("supplier_cart_lines").delete().in("id", existingOpenCartLineIds);

    const remainingCartLinesResult = await client
      .from("supplier_cart_lines")
      .select("cart_id")
      .in("cart_id", existingOpenCartIds)
      .returns<Array<{ cart_id: string }>>();

    if (remainingCartLinesResult.error) {
      throw remainingCartLinesResult.error;
    }

    const cartIdsWithLines = new Set((remainingCartLinesResult.data ?? []).map((row) => row.cart_id));
    const emptyCartIds = existingOpenCartIds.filter((cartId) => !cartIdsWithLines.has(cartId));

    if (emptyCartIds.length) {
      await client.from("supplier_carts").update({ status: "abandoned" }).in("id", emptyCartIds);
    }
  }

  const routeableLines = targetLines.filter((line) => (routeableDemandByRequestLineId.get(line.id) ?? 0) > 0);

  if (!routeableLines.length) {
    return getPartRequestById(client, input.requestId);
  }

  const routingResult = groupRequestLinesIntoSupplierBuckets(
    routeableLines,
    supplierAccountsResult.data ?? [],
    routingRulesResult.data ?? [],
    {
      [jobResult.data.id]: {
        jobPriority: jobResult.data.priority,
        vehicleMake: vehicleResult.data?.make ?? null
      }
    }
  );

  for (const bucket of routingResult.buckets) {
    const cartResult = await findOrCreateOpenSupplierCart(
      client,
      input.companyId,
      bucket.supplierAccount.id,
      bucket.bucketKey,
      input.actorUserId
    );
    if (cartResult.error || !cartResult.data) {
      throw cartResult.error ?? new Error("Open supplier cart could not be created.");
    }

    for (const requestLine of bucket.requestLines) {
      await addSupplierCartLine(client, cartResult.data.id, {
        companyId: input.companyId,
        supplierAccountId: bucket.supplierAccount.id,
        partRequestLineId: requestLine.id,
        jobId: requestLine.jobId,
        quantity:
          routeableDemandByRequestLineId.get(requestLine.id) ?? requestLine.quantityRequested,
        quotedUnitCostCents: requestLine.quotedUnitCostCents ?? requestLine.estimatedUnitCostCents ?? null,
        quotedCoreChargeCents: requestLine.coreChargeCents,
        supplierPartNumber: requestLine.partNumber,
        supplierUrl: bucket.supplierAccount.externalUrl,
        notes: requestLine.notes
      });
      await updatePartRequestLine(client, requestLine.id, {
        status: "quoted",
        description: requestLine.description,
        manufacturer: requestLine.manufacturer,
        partNumber: requestLine.partNumber,
        supplierSku: requestLine.supplierSku,
        quantityRequested: requestLine.quantityRequested,
        quotedUnitCostCents: requestLine.quotedUnitCostCents,
        estimatedUnitCostCents: requestLine.estimatedUnitCostCents,
        actualUnitCostCents: requestLine.actualUnitCostCents,
        needsCore: requestLine.needsCore,
        coreChargeCents: requestLine.coreChargeCents,
        lastSupplierAccountId: bucket.supplierAccount.id,
        notes: requestLine.notes
      });
    }
  }

  return getPartRequestById(client, input.requestId);
}

export async function syncOpenSupplierCartsForRequest(
  client: AppSupabaseClient,
  input: RoutePartRequestLinesInput
) {
  return routePartRequestLinesToSupplierBuckets(client, input);
}

export async function convertCartToPurchaseOrder(
  client: AppSupabaseClient,
  input: ConvertSupplierCartToPurchaseOrderInput
) {
  return createPurchaseOrderFromCart(client, input);
}

export async function orderPurchaseOrder(
  client: AppSupabaseClient,
  purchaseOrderId: string,
  input: MarkPurchaseOrderOrderedInput
) {
  return markPurchaseOrderOrdered(client, purchaseOrderId, input);
}

async function getAffectedRequestLineIds(client: AppSupabaseClient, purchaseOrderLineIds: string[]) {
  if (!purchaseOrderLineIds.length) {
    return [];
  }

  const result = await client
    .from("purchase_order_lines")
    .select("part_request_line_id")
    .in("id", purchaseOrderLineIds)
    .returns<Array<{ part_request_line_id: string }>>();

  if (result.error) {
    throw result.error;
  }

  return [...new Set((result.data ?? []).map((row) => row.part_request_line_id))];
}

export async function receivePurchaseOrderLines(
  client: AppSupabaseClient,
  input: RecordPurchaseReceiptInput
) {
  const result = await recordPurchaseReceipt(client, input);
  if (result.error) {
    return result;
  }

  const requestLineIds = await getAffectedRequestLineIds(client, input.lines.map((line) => line.purchaseOrderLineId));
  await Promise.all([
    writeBackPartCostsToEstimateByLineIds(client, requestLineIds),
    writeBackPartCostsToInvoiceByLineIds(client, requestLineIds)
  ]);

  return result;
}

export async function installPurchasedParts(client: AppSupabaseClient, input: RecordPartInstallationInput) {
  const result = await recordPartInstallation(client, input);
  if (result.error || !result.data) {
    return result;
  }

  await Promise.all([
    writeBackPartCostsToEstimateByLineIds(client, [result.data.partRequestLineId]),
    writeBackPartCostsToInvoiceByLineIds(client, [result.data.partRequestLineId])
  ]);

  return result;
}

export async function returnPurchasedParts(client: AppSupabaseClient, input: CreatePartReturnInput) {
  const result = await createPartReturn(client, input);
  if (result.error) {
    return result;
  }

  const requestLineIds = await getAffectedRequestLineIds(client, input.lines.map((line) => line.purchaseOrderLineId));
  await Promise.all([
    writeBackPartCostsToEstimateByLineIds(client, requestLineIds),
    writeBackPartCostsToInvoiceByLineIds(client, requestLineIds)
  ]);

  return result;
}

export async function returnPurchaseOrderLine(
  client: AppSupabaseClient,
  input: CreatePartReturnInput & {
    inventoryQuantityReturned?: number | null | undefined;
  }
) {
  if (input.lines.length !== 1) {
    throw new Error("Atomic purchase returns currently support one purchase order line at a time.");
  }

  const line = input.lines[0]!;
  const rpcArgs: Database["public"]["Functions"]["return_purchase_order_line_with_inventory"]["Args"] = {
    target_company_id: input.companyId,
    target_purchase_order_id: input.purchaseOrderId ?? "",
    target_purchase_order_line_id: line.purchaseOrderLineId,
    target_quantity_returned: line.quantityReturned,
    target_returned_by_user_id: input.returnedByUserId,
    target_supplier_account_id: input.supplierAccountId
  };

  if (!input.purchaseOrderId) {
    throw new Error("A purchase order ID is required to return a purchase order line.");
  }

  if (typeof input.inventoryQuantityReturned === "number" && input.inventoryQuantityReturned > 0) {
    rpcArgs.target_inventory_quantity_returned = input.inventoryQuantityReturned;
  }

  if (line.isCoreReturn) {
    rpcArgs.target_is_core_return = true;
  }

  if (typeof line.creditAmountCents === "number") {
    rpcArgs.target_credit_amount_cents = line.creditAmountCents;
  }

  if (input.returnedAt) {
    rpcArgs.target_returned_at = input.returnedAt;
  }

  if (input.returnNumber) {
    rpcArgs.target_return_number = input.returnNumber;
  }

  if (input.reason) {
    rpcArgs.target_reason = input.reason;
  }

  const returnNotes = line.notes ?? input.notes;
  if (returnNotes) {
    rpcArgs.target_notes = returnNotes;
  }

  const rpcResult = await client.rpc("return_purchase_order_line_with_inventory", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return { ...rpcResult, data: null };
  }

  const requestLineIds = await getAffectedRequestLineIds(client, [line.purchaseOrderLineId]);
  await Promise.all([
    writeBackPartCostsToEstimateByLineIds(client, requestLineIds),
    writeBackPartCostsToInvoiceByLineIds(client, requestLineIds)
  ]);

  return {
    data: { id: rpcResult.data },
    error: null
  };
}

export async function updateCoreTracking(
  client: AppSupabaseClient,
  input: MarkCoreDueInput | MarkCoreReturnedInput,
  mode: "due" | "returned"
) {
  const result = mode === "due" ? await markCoreDue(client, input as MarkCoreDueInput) : await markCoreReturned(client, input as MarkCoreReturnedInput);
  if (result.error || !result.data) {
    return result;
  }

  await Promise.all([
    writeBackPartCostsToEstimateByLineIds(client, [result.data.partRequestLineId]),
    writeBackPartCostsToInvoiceByLineIds(client, [result.data.partRequestLineId])
  ]);

  return result;
}

export async function getJobProcurementDetail(client: AppSupabaseClient, jobId: string) {
  const [jobResult, requestsResult, cartsResult, purchaseOrdersResult, jobSummaryResult, estimateResult, invoiceResult] =
    await Promise.all([
      getJobById(client, jobId),
      listPartRequestsByJobId(client, jobId),
      listSupplierCartsByJobId(client, jobId),
      listPurchaseOrdersByJobId(client, jobId),
      getJobPartsSummary(client, jobId),
      getEstimateByJobId(client, jobId),
      getInvoiceByJobId(client, jobId)
    ]);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Visit not found.");
  }
  if (requestsResult.error) {
    throw requestsResult.error;
  }
  if (cartsResult.error) {
    throw cartsResult.error;
  }
  if (purchaseOrdersResult.error) {
    throw purchaseOrdersResult.error;
  }
  if (jobSummaryResult.error) {
    throw jobSummaryResult.error;
  }

  const [estimatePartsSummaryResult, invoicePartsSummaryResult] = await Promise.all([
    estimateResult.data ? getEstimatePartsSummary(client, estimateResult.data.id) : Promise.resolve({ data: null, error: null }),
    invoiceResult.data ? getInvoicePartsSummary(client, invoiceResult.data.id) : Promise.resolve({ data: null, error: null })
  ]);

  if (estimatePartsSummaryResult.error) {
    throw estimatePartsSummaryResult.error;
  }
  if (invoicePartsSummaryResult.error) {
    throw invoicePartsSummaryResult.error;
  }

  return {
    carts: cartsResult.data ?? [],
    estimatePartsSummary: estimatePartsSummaryResult.data,
    invoicePartsSummary: invoicePartsSummaryResult.data,
    job: jobResult.data,
    jobPartsSummary: jobSummaryResult.data,
    purchaseOrders: purchaseOrdersResult.data ?? [],
    requests: requestsResult.data ?? []
  };
}
