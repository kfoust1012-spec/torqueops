import {
  listAssignableTechniciansByCompany,
  listInventoryCycleCountsByCompany,
  listInventoryItemsByCompany,
  listStockLocationsByCompany,
  listSupplierAccountsByCompany
} from "@mobile-mechanic/api-client";
import { formatCurrencyFromCents, formatDateTime, formatInventoryTransactionTypeLabel } from "@mobile-mechanic/core";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Form,
  FormField,
  FormRow,
  HeaderCell,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  Textarea,
  Cell,
  buttonClassName
} from "../../../components/ui";
import { requireCompanyContext } from "../../../lib/company-context";
import {
  createInventoryItemRecord,
  createStockLocationRecord,
  getInventoryItemDetail,
  getInventoryLookupWorkspace,
  getInventoryWorkspace,
  updateStockLocationRecord
} from "../../../lib/inventory/service";
import {
  cancelTransferInventory,
  getInventoryCycleCountDetail,
  getInventoryLocationDetail,
  getInventoryOperationsWorkspace,
  getInventoryTransferDetail,
  receiveTransferredInventory,
  runInventoryCycleCount,
  shipTransferInventory,
  transferInventoryBetweenLocations
} from "../../../lib/inventory-operations/service";
import { buildDashboardAliasHref } from "../../../lib/dashboard/route-alias";

type InventoryAgendaTone = "brand" | "danger" | "progress" | "success" | "warning";
type InventoryView = "catalog" | "control" | "counts" | "locations" | "movement";

type InventoryAgendaItem = {
  actionHref: string;
  actionLabel: string;
  description: string;
  eyebrow: string;
  key: string;
  statusLabel: string;
  title: string;
  tone: InventoryAgendaTone;
  value: number | string;
};

type InventoryWorkspacePageProps = {
  searchParams?: Promise<{
    cycleCountId?: string | string[];
    includeInactive?: string | string[];
    itemId?: string | string[];
    locationId?: string | string[];
    lookupLocationId?: string | string[];
    lowStock?: string | string[];
    q?: string | string[];
    transferId?: string | string[];
    view?: string | string[];
  }>;
};

function getQueryValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

function parseInventoryView(value: string | null): InventoryView {
  switch (value) {
    case "catalog":
    case "locations":
    case "movement":
    case "counts":
      return value;
    default:
      return "control";
  }
}

function getInventoryViewLabel(view: InventoryView) {
  switch (view) {
    case "catalog":
      return "Catalog";
    case "locations":
      return "Locations";
    case "movement":
      return "Movement";
    case "counts":
      return "Counts";
    default:
      return "Control";
  }
}

function buildInventoryHref({
  cycleCountId,
  includeInactive,
  itemId,
  locationId,
  lookupLocationId,
  lowStock,
  q,
  transferId,
  view
}: {
  cycleCountId?: string | null | undefined;
  includeInactive?: boolean | undefined;
  itemId?: string | null | undefined;
  locationId?: string | null | undefined;
  lookupLocationId?: string | null | undefined;
  lowStock?: boolean | undefined;
  q?: string | null | undefined;
  transferId?: string | null | undefined;
  view: InventoryView;
}) {
  const params = new URLSearchParams();
  params.set("view", view);

  if (q) {
    params.set("q", q);
  }

  if (lookupLocationId) {
    params.set("lookupLocationId", lookupLocationId);
  }

  if (lowStock) {
    params.set("lowStock", "1");
  }

  if (includeInactive) {
    params.set("includeInactive", "1");
  }

  if (itemId) {
    params.set("itemId", itemId);
  }

  if (locationId) {
    params.set("locationId", locationId);
  }

  if (transferId) {
    params.set("transferId", transferId);
  }

  if (cycleCountId) {
    params.set("cycleCountId", cycleCountId);
  }

  return `/dashboard/supply/inventory?${params.toString()}`;
}

function revalidateInventoryWorkspace() {
  revalidatePath("/dashboard/supply/inventory");
  revalidatePath("/dashboard/inventory");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : 0;
}

function getNullableNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : null;
}

function getTransferLines(formData: FormData) {
  return [0, 1, 2]
    .map((index) => {
      const inventoryItemId = getNullableString(formData, `inventoryItemId_${index}`);
      const quantityRequested = getNumber(formData, `quantityRequested_${index}`);

      if (!inventoryItemId || quantityRequested <= 0) {
        return null;
      }

      return {
        inventoryItemId,
        quantityRequested,
        unitCostCents: getNullableString(formData, `unitCostCents_${index}`)
          ? getNumber(formData, `unitCostCents_${index}`)
          : null,
        notes: getNullableString(formData, `lineNotes_${index}`)
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
}

function getCycleCountLines(formData: FormData) {
  return [0, 1, 2, 3, 4]
    .map((index) => {
      const inventoryItemId = getNullableString(formData, `inventoryItemId_${index}`);
      const countedQuantity = getString(formData, `countedQuantity_${index}`).trim();

      if (!inventoryItemId || countedQuantity === "") {
        return null;
      }

      return {
        inventoryItemId,
        countedQuantity: Number(countedQuantity),
        notes: getNullableString(formData, `lineNotes_${index}`)
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
}

async function tryOrNull<T>(value: Promise<T>) {
  try {
    return await value;
  } catch {
    return null;
  }
}

function formatTransferReference(referenceNumber: string | null, transferId: string) {
  return referenceNumber ?? transferId.slice(0, 8).toUpperCase();
}

function formatSignedQuantity(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function getReorderAction(balance: {
  preferredReorderQuantity: number | null;
  reorderPointQuantity: number | null;
  lowStockThresholdQuantity: number | null;
  reorderStatus: string;
}) {
  if (balance.preferredReorderQuantity && balance.reorderStatus === "reorder_due") {
    return `Reorder ${balance.preferredReorderQuantity}`;
  }

  if (balance.preferredReorderQuantity) {
    return `Plan ${balance.preferredReorderQuantity}`;
  }

  if (balance.reorderPointQuantity !== null) {
    return `Point ${balance.reorderPointQuantity}`;
  }

  if (balance.lowStockThresholdQuantity !== null) {
    return `Threshold ${balance.lowStockThresholdQuantity}`;
  }

  return "Review rule";
}

function getCoverageTone(availableShare: number, totalOnHandQuantity: number): InventoryAgendaTone {
  if (totalOnHandQuantity === 0) {
    return "brand";
  }

  if (availableShare < 45) {
    return "danger";
  }

  if (availableShare < 70) {
    return "warning";
  }

  return "success";
}

function getLowStockSortWeight(status: string) {
  switch (status) {
    case "reorder_due":
      return 0;
    case "low_stock":
      return 1;
    default:
      return 2;
  }
}

function getInventoryPriority({
  activeLocationCount,
  draftTransferCount,
  hasAnyItems,
  inTransitCount,
  lowStockCount,
  locationAlertCount,
  reorderDueCount,
  vanAlertCount
}: {
  activeLocationCount: number;
  draftTransferCount: number;
  hasAnyItems: boolean;
  inTransitCount: number;
  lowStockCount: number;
  locationAlertCount: number;
  reorderDueCount: number;
  vanAlertCount: number;
}) {
  if (!hasAnyItems || activeLocationCount === 0) {
    return {
      eyebrow: "Inventory foundation",
      title: "Stand up the stock network before demand arrives",
      description:
        "Create stocked items and active locations first so receiving, transfers, van stock, and reorder thresholds can operate from a real ledger.",
      primaryHref: buildInventoryHref({ view: "catalog" }),
      primaryLabel: "Configure items",
      secondaryHref: buildInventoryHref({ view: "locations" }),
      secondaryLabel: "Create locations",
      tone: "brand" as const
    };
  }

  if (reorderDueCount > 0) {
    return {
      eyebrow: "Reorder pressure",
      title: `${reorderDueCount} balance${reorderDueCount === 1 ? "" : "s"} need immediate replenishment`,
      description: `Available stock is already below reorder point across ${locationAlertCount} location${locationAlertCount === 1 ? "" : "s"}. Prioritize critical rows before sourcing or transfer coverage falls behind.`,
      primaryHref: buildInventoryHref({ view: "catalog", lowStock: true }),
      primaryLabel: "Review low stock",
      secondaryHref: buildInventoryHref({ view: "movement" }),
      secondaryLabel: "Open transfers",
      tone: "danger" as const
    };
  }

  if (inTransitCount > 0 || draftTransferCount > 0) {
    return {
      eyebrow: "Stock in motion",
      title: "Inventory is moving between shop and van locations",
      description: `${inTransitCount} transfer${inTransitCount === 1 ? "" : "s"} are in transit and ${draftTransferCount} draft${draftTransferCount === 1 ? "" : "s"} still need shipment. Keep the board clean so field stock stays reliable.`,
      primaryHref: buildInventoryHref({ view: "movement" }),
      primaryLabel: "Manage transfers",
      secondaryHref: buildInventoryHref({ view: "locations" }),
      secondaryLabel: "Review locations",
      tone: "progress" as const
    };
  }

  if (lowStockCount > 0 || vanAlertCount > 0) {
    return {
      eyebrow: "Routine attention",
      title: "Stock health is stable but needs routine control",
      description: `${lowStockCount} low-stock row${lowStockCount === 1 ? "" : "s"} and ${vanAlertCount} van location${vanAlertCount === 1 ? "" : "s"} need review before they turn into reorder-critical gaps.`,
      primaryHref: buildInventoryHref({ view: "catalog", lowStock: true }),
      primaryLabel: "Open stock lookup",
      secondaryHref: buildInventoryHref({ view: "locations" }),
      secondaryLabel: "Check locations",
      tone: "warning" as const
    };
  }

  return {
    eyebrow: "Control stable",
    title: "Inventory control is balanced across the stock network",
    description:
      "No locations are below threshold and there is no active transfer pressure. Use the workspace to keep replenishment, van stock, and movement visibility tight.",
    primaryHref: buildInventoryHref({ view: "catalog" }),
    primaryLabel: "Open stock lookup",
    secondaryHref: buildInventoryHref({ view: "catalog" }),
    secondaryLabel: "Review items",
    tone: "success" as const
  };
}

function InventoryAgendaCard({ item }: { item: InventoryAgendaItem }) {
  return (
    <article className={`inventory-agenda-card inventory-agenda-card--${item.tone}`}>
      <div className="inventory-agenda-card__header">
        <p className="inventory-agenda-card__eyebrow">{item.eyebrow}</p>
        <Badge tone={item.tone}>{item.statusLabel}</Badge>
      </div>
      <p className="inventory-agenda-card__value">{item.value}</p>
      <h3 className="inventory-agenda-card__title">{item.title}</h3>
      <p className="inventory-agenda-card__copy">{item.description}</p>
      <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={item.actionHref}>
        {item.actionLabel}
      </Link>
    </article>
  );
}

export async function InventoryWorkspacePageImpl({ searchParams }: InventoryWorkspacePageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = parseInventoryView(getQueryValue(resolvedSearchParams.view));
  const searchQuery = getQueryValue(resolvedSearchParams.q) ?? "";
  const lookupLocationId = getQueryValue(resolvedSearchParams.lookupLocationId) ?? "";
  const lowStockLookupOnly = getQueryValue(resolvedSearchParams.lowStock) === "1";
  const includeInactive = getQueryValue(resolvedSearchParams.includeInactive) === "1";
  const selectedItemIdParam = getQueryValue(resolvedSearchParams.itemId);
  const selectedLocationIdParam = getQueryValue(resolvedSearchParams.locationId);
  const selectedTransferIdParam = getQueryValue(resolvedSearchParams.transferId);
  const selectedCycleCountIdParam = getQueryValue(resolvedSearchParams.cycleCountId);
  const [workspace, operations] = await Promise.all([
    getInventoryWorkspace(context.supabase, context.companyId),
    getInventoryOperationsWorkspace(context.supabase, context.companyId)
  ]);

  const sortedLowStockRows = [...workspace.lowStockRows].sort((left, right) => {
    const statusDifference =
      getLowStockSortWeight(left.balance.reorderStatus) - getLowStockSortWeight(right.balance.reorderStatus);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    if (left.balance.availableQuantity !== right.balance.availableQuantity) {
      return left.balance.availableQuantity - right.balance.availableQuantity;
    }

    return left.item.sku.localeCompare(right.item.sku);
  });
  const reorderDueRows = sortedLowStockRows.filter((row) => row.balance.reorderStatus === "reorder_due");
  const lowStockOnlyRows = sortedLowStockRows.filter((row) => row.balance.reorderStatus === "low_stock");
  const flaggedLocations = operations.lowStockByLocation
    .filter((row) => row.rowCount > 0)
    .sort((left, right) => right.rowCount - left.rowCount);
  const warehouseCount = workspace.locations.filter((location) => location.locationType === "warehouse").length;
  const shopCount = workspace.locations.filter((location) => location.locationType === "shop").length;
  const vanCount = workspace.locations.filter((location) => location.locationType === "van").length;
  const activeLocations = workspace.locations.filter((location) => location.isActive);
  const inactiveLocationCount = workspace.locations.length - activeLocations.length;
  const vanSummaries = [...operations.vanSummaries].sort((left, right) => {
    const leftAlerts = left.balances.filter((balance) => balance.reorderStatus !== "ok").length;
    const rightAlerts = right.balances.filter((balance) => balance.reorderStatus !== "ok").length;
    return rightAlerts - leftAlerts;
  });
  const displayedQueueRows = sortedLowStockRows.slice(0, 10);
  const hiddenQueueRowCount = Math.max(sortedLowStockRows.length - displayedQueueRows.length, 0);
  const displayedFlaggedLocations = flaggedLocations.slice(0, 5);
  const displayedVanSummaries = vanSummaries.slice(0, 4);
  const displayedTransfers = operations.transfers.slice(0, 5);
  const displayedTransactions = workspace.recentTransactions.slice(0, 6);
  const positiveTransactionCount = displayedTransactions.filter((transaction) => transaction.quantityDelta > 0).length;
  const negativeTransactionCount = displayedTransactions.filter((transaction) => transaction.quantityDelta < 0).length;
  const trackedVanBalanceCount = vanSummaries.reduce((total, summary) => total + summary.balances.length, 0);
  const transferMovementCount =
    operations.transferSummary.inTransitCount + operations.transferSummary.draftCount;
  const vanAlertRows = operations.vanSummaries.reduce(
    (total, summary) => total + summary.balances.filter((balance) => balance.reorderStatus !== "ok").length,
    0
  );
  const vanAttentionCount = operations.vanSummaries.filter((summary) =>
    summary.balances.some((balance) => balance.reorderStatus !== "ok")
  ).length;
  const totalOnHandQuantity = workspace.summary.totalOnHandQuantity;
  const availableShareRaw =
    totalOnHandQuantity > 0 ? (workspace.summary.totalAvailableQuantity / totalOnHandQuantity) * 100 : 0;
  const reservedShareRaw =
    totalOnHandQuantity > 0 ? (workspace.summary.totalReservedQuantity / totalOnHandQuantity) * 100 : 0;
  const availableShare = Math.round(availableShareRaw);
  const reservedShare = Math.round(reservedShareRaw);
  const totalMovementVolume = displayedTransactions.reduce(
    (total, transaction) => total + Math.abs(transaction.quantityDelta),
    0
  );
  const hasInventoryFoundation = workspace.summary.itemCount > 0 && activeLocations.length > 0;
  const priority = getInventoryPriority({
    activeLocationCount: activeLocations.length,
    draftTransferCount: operations.transferSummary.draftCount,
    hasAnyItems: workspace.summary.itemCount > 0,
    inTransitCount: operations.transferSummary.inTransitCount,
    lowStockCount: workspace.summary.lowStockCount,
    locationAlertCount: flaggedLocations.length,
    reorderDueCount: reorderDueRows.length,
    vanAlertCount: vanAttentionCount
  });
  const coverageTone = getCoverageTone(availableShare, totalOnHandQuantity);
  const locationNameById = new Map(workspace.locations.map((location) => [location.id, location.name]));
  const topLocationAlert = flaggedLocations[0] ?? null;
  const controlAgenda: InventoryAgendaItem[] = [
    hasInventoryFoundation
      ? {
          actionHref: buildInventoryHref({ view: "catalog", lowStock: true }),
          actionLabel: workspace.summary.lowStockCount ? "Open low stock" : "Review thresholds",
          description: reorderDueRows.length
            ? `${reorderDueRows.length} balance${reorderDueRows.length === 1 ? "" : "s"} are already past reorder point and ${lowStockOnlyRows.length} more are trending low.`
            : workspace.summary.lowStockCount
              ? `${lowStockOnlyRows.length} balance${lowStockOnlyRows.length === 1 ? "" : "s"} are trending low before they reach reorder point.`
              : "Threshold signals are quiet right now. Use the lookup to verify stocked locations and reorder rules.",
          eyebrow: "Reorder queue",
          key: "reorder",
          statusLabel: reorderDueRows.length ? "Due now" : workspace.summary.lowStockCount ? "Watch" : "Clear",
          title: reorderDueRows.length
            ? `${reorderDueRows.length} balance${reorderDueRows.length === 1 ? "" : "s"} past reorder point`
            : workspace.summary.lowStockCount
              ? `${workspace.summary.lowStockCount} low-stock row${workspace.summary.lowStockCount === 1 ? "" : "s"} need review`
              : "No low-stock balances are waiting",
          tone: reorderDueRows.length ? "danger" : workspace.summary.lowStockCount ? "warning" : "success",
          value: reorderDueRows.length || workspace.summary.lowStockCount
        }
      : {
          actionHref:
            workspace.summary.itemCount === 0
              ? buildInventoryHref({ view: "catalog" })
              : buildInventoryHref({ view: "locations" }),
          actionLabel: workspace.summary.itemCount === 0 ? "Create items" : "Create locations",
          description:
            "Inventory control needs a live catalog and active stock locations before transfer, van-stock, and reorder workflows become operational.",
          eyebrow: "Foundation",
          key: "foundation",
          statusLabel: "Set up",
          title: workspace.summary.itemCount === 0 ? "Start with stocked items" : "Activate the stock network",
          tone: "brand",
          value: workspace.summary.itemCount === 0 ? workspace.summary.itemCount : activeLocations.length
        },
    {
      actionHref: buildInventoryHref({ view: "movement" }),
      actionLabel: transferMovementCount ? "Manage transfers" : "Open transfer board",
      description: transferMovementCount
        ? `${operations.transferSummary.inTransitCount} transfer${operations.transferSummary.inTransitCount === 1 ? "" : "s"} are already moving and ${operations.transferSummary.draftCount} draft${operations.transferSummary.draftCount === 1 ? "" : "s"} still need shipment.`
        : "No transfer pressure right now. Stock is not currently moving between warehouse, shop, and vans.",
      eyebrow: "Transfer board",
      key: "transfer",
      statusLabel: transferMovementCount ? "In motion" : "Quiet",
      title: transferMovementCount
        ? `${operations.transferSummary.inTransitCount} in transit and ${operations.transferSummary.draftCount} draft`
        : "No transfer movement needs attention",
      tone: transferMovementCount ? "progress" : "success",
      value: transferMovementCount
    },
    {
      actionHref: topLocationAlert
        ? buildInventoryHref({ view: "locations", locationId: topLocationAlert.location.id })
        : buildInventoryHref({ view: "locations" }),
      actionLabel: topLocationAlert ? "Review hottest location" : "Open locations",
      description: topLocationAlert
        ? `${topLocationAlert.location.name} carries ${topLocationAlert.rowCount} flagged balance${topLocationAlert.rowCount === 1 ? "" : "s"}, the highest pressure point in the network.`
        : "No single warehouse, shop, or van is stacking unhealthy stock pressure right now.",
      eyebrow: "Location pressure",
      key: "locations",
      statusLabel: topLocationAlert ? "Hot spot" : "Balanced",
      title: topLocationAlert
        ? `${topLocationAlert.location.name} is carrying the most stock pressure`
        : "Location health is evenly distributed",
      tone: topLocationAlert ? (topLocationAlert.rowCount > 2 ? "danger" : "warning") : "success",
      value: flaggedLocations.length
    },
    {
      actionHref: buildInventoryHref({ view: "locations" }),
      actionLabel: vanCount ? "Inspect van stock" : "Set up van locations",
      description: vanCount
        ? `${vanAttentionCount} van location${vanAttentionCount === 1 ? "" : "s"} need stock attention across ${vanAlertRows} flagged balance${vanAlertRows === 1 ? "" : "s"}.`
        : "Van locations have not been configured yet, so field inventory is still off the board.",
      eyebrow: "Field vans",
      key: "vans",
      statusLabel: vanCount ? (vanAttentionCount ? "Attention" : "Ready") : "Missing",
      title: vanCount
        ? vanAttentionCount
          ? `${Math.max(vanCount - vanAttentionCount, 0)} of ${vanCount} van locations are ready`
          : "Every van location is stocked above threshold"
        : "Van-stock control has not been set up",
      tone: vanCount ? (vanAttentionCount ? "warning" : "success") : "brand",
      value: vanCount ? vanAttentionCount : 0
    }
  ];
  const controlHref = buildInventoryHref({ view: "control" });
  const catalogHref = buildInventoryHref({
    view: "catalog",
    q: searchQuery || undefined,
    lookupLocationId: lookupLocationId || undefined,
    lowStock: lowStockLookupOnly,
    includeInactive,
    itemId: selectedItemIdParam ?? undefined
  });
  const locationsHref = buildInventoryHref({
    view: "locations",
    locationId: selectedLocationIdParam ?? undefined
  });
  const movementHref = buildInventoryHref({
    view: "movement",
    transferId: selectedTransferIdParam ?? undefined
  });
  const countsHref = buildInventoryHref({
    view: "counts",
    cycleCountId: selectedCycleCountIdParam ?? undefined
  });
  const viewLinks = [
    {
      href: controlHref,
      key: "control" as const,
      label: getInventoryViewLabel("control"),
      value: `${workspace.summary.lowStockCount} watch`
    },
    {
      href: catalogHref,
      key: "catalog" as const,
      label: getInventoryViewLabel("catalog"),
      value: `${workspace.summary.itemCount} items`
    },
    {
      href: locationsHref,
      key: "locations" as const,
      label: getInventoryViewLabel("locations"),
      value: `${activeLocations.length} active`
    },
    {
      href: movementHref,
      key: "movement" as const,
      label: getInventoryViewLabel("movement"),
      value: `${transferMovementCount} moving`
    },
    {
      href: countsHref,
      key: "counts" as const,
      label: getInventoryViewLabel("counts"),
      value: `${operations.locations.length} locations`
    }
  ];

  let catalogLookup: Awaited<ReturnType<typeof getInventoryLookupWorkspace>> | null = null;
  let catalogSupplierAccounts: Array<{ id: string; name: string }> = [];
  let catalogItemDetail: Awaited<ReturnType<typeof getInventoryItemDetail>> | null = null;
  let catalogSelectedItemId: string | null = null;

  if (view === "catalog") {
    const [lookup, supplierAccountsResult] = await Promise.all([
      getInventoryLookupWorkspace(context.supabase, context.companyId, {
        query: searchQuery || undefined,
        stockLocationId: lookupLocationId || undefined,
        lowStockOnly: lowStockLookupOnly,
        includeInactive
      }),
      listSupplierAccountsByCompany(context.supabase, context.companyId)
    ]);

    if (supplierAccountsResult.error) {
      throw supplierAccountsResult.error;
    }

    catalogLookup = lookup;
    catalogSupplierAccounts = supplierAccountsResult.data ?? [];
    catalogSelectedItemId = selectedItemIdParam ?? lookup.rows[0]?.item.id ?? null;
    catalogItemDetail = catalogSelectedItemId
      ? await tryOrNull(getInventoryItemDetail(context.supabase, context.companyId, catalogSelectedItemId))
      : null;
  }

  let locationRecords: Awaited<ReturnType<typeof listStockLocationsByCompany>>["data"] = null;
  let locationTechnicians: Awaited<ReturnType<typeof listAssignableTechniciansByCompany>>["data"] = null;
  let selectedLocationId: string | null = null;
  let locationDetail: Awaited<ReturnType<typeof getInventoryLocationDetail>> | null = null;

  if (view === "locations") {
    const [locationsResult, techniciansResult] = await Promise.all([
      listStockLocationsByCompany(context.supabase, context.companyId),
      listAssignableTechniciansByCompany(context.supabase, context.companyId)
    ]);

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    if (techniciansResult.error) {
      throw techniciansResult.error;
    }

    locationRecords = locationsResult.data ?? [];
    locationTechnicians = techniciansResult.data ?? [];
    selectedLocationId = selectedLocationIdParam ?? locationRecords[0]?.id ?? null;
    locationDetail = selectedLocationId
      ? await tryOrNull(getInventoryLocationDetail(context.supabase, context.companyId, selectedLocationId))
      : null;
  }

  let movementActiveItems: Awaited<ReturnType<typeof listInventoryItemsByCompany>>["data"] = null;
  let movementActiveLocations: Awaited<ReturnType<typeof listStockLocationsByCompany>>["data"] = null;
  let selectedTransferId: string | null = null;
  let transferDetail: Awaited<ReturnType<typeof getInventoryTransferDetail>> | null = null;

  if (view === "movement") {
    const [itemsResult, locationsResult] = await Promise.all([
      listInventoryItemsByCompany(context.supabase, context.companyId, {
        includeInactive: false,
        itemType: "stocked"
      }),
      listStockLocationsByCompany(context.supabase, context.companyId)
    ]);

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    movementActiveItems = (itemsResult.data ?? []).filter((item) => item.isActive && item.itemType === "stocked");
    movementActiveLocations = (locationsResult.data ?? []).filter((location) => location.isActive);
    selectedTransferId = selectedTransferIdParam ?? operations.transfers[0]?.id ?? null;
    transferDetail = selectedTransferId
      ? await tryOrNull(getInventoryTransferDetail(context.supabase, selectedTransferId))
      : null;
  }

  let countLocations: Awaited<ReturnType<typeof listStockLocationsByCompany>>["data"] = null;
  let countItems: Awaited<ReturnType<typeof listInventoryItemsByCompany>>["data"] = null;
  let cycleCounts: Awaited<ReturnType<typeof listInventoryCycleCountsByCompany>>["data"] = null;
  let selectedCycleCountId: string | null = null;
  let cycleCountDetail: Awaited<ReturnType<typeof getInventoryCycleCountDetail>> | null = null;

  if (view === "counts") {
    const [locationsResult, itemsResult, cycleCountsResult] = await Promise.all([
      listStockLocationsByCompany(context.supabase, context.companyId),
      listInventoryItemsByCompany(context.supabase, context.companyId, {
        includeInactive: false,
        itemType: "stocked"
      }),
      listInventoryCycleCountsByCompany(context.supabase, context.companyId)
    ]);

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (cycleCountsResult.error) {
      throw cycleCountsResult.error;
    }

    countLocations = (locationsResult.data ?? []).filter((location) => location.isActive);
    countItems = (itemsResult.data ?? []).filter((item) => item.isActive && item.itemType === "stocked");
    cycleCounts = cycleCountsResult.data ?? [];
    selectedCycleCountId = selectedCycleCountIdParam ?? cycleCounts[0]?.id ?? null;
    cycleCountDetail = selectedCycleCountId
      ? await tryOrNull(getInventoryCycleCountDetail(context.supabase, selectedCycleCountId))
      : null;
  }

  async function createItemAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createInventoryItemRecord(actionContext.supabase, {
      companyId: actionContext.companyId,
      sku: getString(formData, "sku"),
      name: getString(formData, "name"),
      description: getNullableString(formData, "description"),
      manufacturer: getNullableString(formData, "manufacturer"),
      partNumber: getNullableString(formData, "partNumber"),
      supplierAccountId: getNullableString(formData, "supplierAccountId"),
      defaultUnitCostCents: getNullableNumber(formData, "defaultUnitCostCents"),
      itemType: getString(formData, "itemType") === "non_stocked" ? "non_stocked" : "stocked",
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Inventory item could not be created.");
    }

    revalidateInventoryWorkspace();
    redirect(
      buildInventoryHref({
        view: "catalog",
        q: searchQuery || undefined,
        lookupLocationId: lookupLocationId || undefined,
        lowStock: lowStockLookupOnly,
        includeInactive,
        itemId: result.data.id
      })
    );
  }

  async function createLocationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createStockLocationRecord(actionContext.supabase, {
      companyId: actionContext.companyId,
      name: getString(formData, "name"),
      slug: getString(formData, "slug"),
      locationType:
        getString(formData, "locationType") === "van"
          ? "van"
          : getString(formData, "locationType") === "shop"
            ? "shop"
            : "warehouse",
      technicianUserId: getNullableString(formData, "technicianUserId"),
      vehicleLabel: getNullableString(formData, "vehicleLabel"),
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Stock location could not be created.");
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "locations", locationId: result.data.id }));
  }

  async function updateLocationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const locationId = getString(formData, "locationId");
    const result = await updateStockLocationRecord(actionContext.supabase, locationId, {
      name: getString(formData, "name"),
      slug: getString(formData, "slug"),
      locationType:
        getString(formData, "locationType") === "van"
          ? "van"
          : getString(formData, "locationType") === "shop"
            ? "shop"
            : "warehouse",
      technicianUserId: getNullableString(formData, "technicianUserId"),
      vehicleLabel: getNullableString(formData, "vehicleLabel"),
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "locations", locationId }));
  }

  async function createTransferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await transferInventoryBetweenLocations(actionContext.supabase, {
      companyId: actionContext.companyId,
      fromStockLocationId: getString(formData, "fromStockLocationId"),
      toStockLocationId: getString(formData, "toStockLocationId"),
      requestedByUserId: actionContext.currentUserId,
      referenceNumber: getNullableString(formData, "referenceNumber"),
      notes: getNullableString(formData, "notes"),
      lines: getTransferLines(formData)
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Inventory transfer could not be created.");
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "movement", transferId: result.data.transfer.id }));
  }

  async function shipTransferAction(formData: FormData) {
    "use server";

    if (!selectedTransferId || !transferDetail) {
      throw new Error("Choose a transfer before shipping inventory.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await shipTransferInventory(actionContext.supabase, {
      transferId: selectedTransferId,
      shippedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "notes"),
      lines: transferDetail.lines
        .map(({ line }) => ({
          transferLineId: line.id,
          quantityShipped: getNumber(formData, `quantityShipped_${line.id}`),
          unitCostCents: getNullableString(formData, `unitCostCents_${line.id}`)
            ? getNumber(formData, `unitCostCents_${line.id}`)
            : line.unitCostCents,
          notes: getNullableString(formData, `lineNotes_${line.id}`)
        }))
        .filter((line) => line.quantityShipped > 0)
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "movement", transferId: selectedTransferId }));
  }

  async function receiveTransferAction(formData: FormData) {
    "use server";

    if (!selectedTransferId || !transferDetail) {
      throw new Error("Choose a transfer before receiving inventory.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await receiveTransferredInventory(actionContext.supabase, {
      transferId: selectedTransferId,
      receivedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "notes"),
      lines: transferDetail.lines
        .map(({ line }) => ({
          transferLineId: line.id,
          quantityReceived: getNumber(formData, `quantityReceived_${line.id}`),
          notes: getNullableString(formData, `lineNotes_${line.id}`)
        }))
        .filter((line) => line.quantityReceived > 0)
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "movement", transferId: selectedTransferId }));
  }

  async function cancelTransferAction(formData: FormData) {
    "use server";

    if (!selectedTransferId) {
      throw new Error("Choose a transfer before canceling it.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await cancelTransferInventory(actionContext.supabase, {
      transferId: selectedTransferId,
      notes: getNullableString(formData, "cancelNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "movement", transferId: selectedTransferId }));
  }

  async function createCycleCountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const stockLocationId = getString(formData, "stockLocationId");
    const result = await runInventoryCycleCount(actionContext.supabase, {
      companyId: actionContext.companyId,
      stockLocationId,
      countedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "notes"),
      lines: getCycleCountLines(formData)
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Inventory cycle count could not be recorded.");
    }

    revalidateInventoryWorkspace();
    redirect(buildInventoryHref({ view: "counts", cycleCountId: result.data.cycleCount.id }));
  }

  return (
    <Page className="inventory-control-page" layout="command">
      <PageHeader
        eyebrow="Inventory"
        title="Inventory control"
        description={
          <>
            Direct stock health, movement discipline, and field readiness for{" "}
            <strong>{context.company.name}</strong>.
          </>
        }
        status={
          <div className="inventory-control-page__status ui-page-status-cluster">
            <Badge tone={priority.tone}>{priority.eyebrow}</Badge>
            <Badge tone={workspace.summary.lowStockCount ? "warning" : "success"}>
              {workspace.summary.lowStockCount
                ? `${workspace.summary.lowStockCount} low-stock row${workspace.summary.lowStockCount === 1 ? "" : "s"}`
                : "Stock stable"}
            </Badge>
            <Badge tone={transferMovementCount ? "progress" : "neutral"}>
              {transferMovementCount ? `${transferMovementCount} transfer movement` : "No transfer pressure"}
            </Badge>
          </div>
        }
        actions={
          <>
            <Link className={buttonClassName({ tone: view === "control" ? "primary" : "secondary" })} href={controlHref}>
              Control
            </Link>
            <Link className={buttonClassName({ tone: view === "catalog" ? "secondary" : "tertiary" })} href={catalogHref}>
              Catalog
            </Link>
            <Link className={buttonClassName({ tone: view === "movement" ? "secondary" : "tertiary" })} href={movementHref}>
              Movement
            </Link>
            <Link className={buttonClassName({ tone: view === "locations" ? "secondary" : "ghost" })} href={locationsHref}>
              Locations
            </Link>
            <Link className={buttonClassName({ tone: view === "counts" ? "secondary" : "ghost" })} href={countsHref}>
              Counts
            </Link>
          </>
        }
      />

      <div className="inventory-mode-nav" aria-label="Inventory workspace modes">
        {viewLinks.map((link) => (
          <Link
            key={link.key}
            className={buttonClassName({
              className: "inventory-mode-nav__link",
              size: "sm",
              tone: view === link.key ? "secondary" : "ghost"
            })}
            data-active={view === link.key ? "true" : "false"}
            href={link.href}
          >
            <span className="inventory-mode-nav__label">{link.label}</span>
            <span className="inventory-mode-nav__value">{link.value}</span>
          </Link>
        ))}
      </div>

      {view === "control" ? (
      <div className="inventory-control-workspace">
        <section className="inventory-command-band">
          <div className="inventory-command-band__main">
            <div className="inventory-command-band__copy">
              <p className="inventory-command-band__eyebrow">{priority.eyebrow}</p>
              <h2 className="inventory-command-band__title">{priority.title}</h2>
              <p className="inventory-command-band__description">{priority.description}</p>
            </div>

            <div className="inventory-command-band__actions">
              <Link className={buttonClassName()} href={priority.primaryHref}>
                {priority.primaryLabel}
              </Link>
              <Link className={buttonClassName({ tone: "secondary" })} href={priority.secondaryHref}>
                {priority.secondaryLabel}
              </Link>
              <Link className={buttonClassName({ tone: "tertiary" })} href={buildInventoryHref({ view: "catalog" })}>
                Stock lookup
              </Link>
            </div>

            <div className="inventory-kpi-grid">
              <article className="inventory-kpi inventory-kpi--availability">
                <span>Available units</span>
                <strong>{workspace.summary.totalAvailableQuantity}</strong>
                <p>
                  {totalOnHandQuantity
                    ? `${availableShare}% of on-hand stock is free to allocate.`
                    : "No stock has been received into the network yet."}
                </p>
              </article>
              <article className="inventory-kpi inventory-kpi--reserved">
                <span>Reserved units</span>
                <strong>{workspace.summary.totalReservedQuantity}</strong>
                <p>
                  {workspace.summary.totalReservedQuantity
                    ? `${reservedShare}% of on-hand stock is already committed to work.`
                    : "Nothing is reserved against visits right now."}
                </p>
              </article>
              <article className="inventory-kpi inventory-kpi--locations">
                <span>Active locations</span>
                <strong>{activeLocations.length}</strong>
                <p>
                  {inactiveLocationCount
                    ? `${inactiveLocationCount} inactive location${inactiveLocationCount === 1 ? "" : "s"} still need cleanup.`
                    : "Every configured stock location is active."}
                </p>
              </article>
              <article className="inventory-kpi inventory-kpi--catalog">
                <span>Catalog items</span>
                <strong>{workspace.summary.itemCount}</strong>
                <p>
                  {workspace.summary.itemCount
                    ? `${workspace.summary.locationCount} location${workspace.summary.locationCount === 1 ? "" : "s"} are participating in the stock network.`
                    : "Build the stocked catalog before replenishment signals can mean anything."}
                </p>
              </article>
            </div>

            <div className="inventory-brief-grid">
              <section className="inventory-brief-card">
                <div className="inventory-brief-card__header">
                  <div>
                    <p className="inventory-brief-card__eyebrow">Availability split</p>
                    <h3 className="inventory-brief-card__title">How much stock is still free to move</h3>
                  </div>
                  <Badge tone={coverageTone}>{totalOnHandQuantity ? `${availableShare}% free` : "Awaiting stock"}</Badge>
                </div>
                <div className="inventory-coverage-bar" aria-hidden="true">
                  <span
                    className="inventory-coverage-bar__segment inventory-coverage-bar__segment--available"
                    style={{ width: `${availableShareRaw}%` }}
                  />
                  <span
                    className="inventory-coverage-bar__segment inventory-coverage-bar__segment--reserved"
                    style={{ width: `${reservedShareRaw}%` }}
                  />
                </div>
                <p className="inventory-brief-card__copy">
                  {totalOnHandQuantity
                    ? `${workspace.summary.totalAvailableQuantity} units are available and ${workspace.summary.totalReservedQuantity} units are already reserved across the network.`
                    : "No stock is on hand yet, so coverage will appear here after the first receipt or adjustment."}
                </p>
                <div className="inventory-mini-stat-grid">
                  <div className="inventory-mini-stat">
                    <span>On hand</span>
                    <strong>{workspace.summary.totalOnHandQuantity}</strong>
                  </div>
                  <div className="inventory-mini-stat">
                    <span>Available</span>
                    <strong>{workspace.summary.totalAvailableQuantity}</strong>
                  </div>
                  <div className="inventory-mini-stat">
                    <span>Reserved</span>
                    <strong>{workspace.summary.totalReservedQuantity}</strong>
                  </div>
                </div>
              </section>

              <section className="inventory-brief-card">
                <div className="inventory-brief-card__header">
                  <div>
                    <p className="inventory-brief-card__eyebrow">Network mix</p>
                    <h3 className="inventory-brief-card__title">Where stock can physically live</h3>
                  </div>
                  <Badge tone={inactiveLocationCount ? "warning" : "success"}>
                    {activeLocations.length} active
                  </Badge>
                </div>
                <p className="inventory-brief-card__copy">
                  {workspace.summary.itemCount
                    ? `${workspace.summary.itemCount} stocked item${workspace.summary.itemCount === 1 ? "" : "s"} are distributed across warehouse, shop, and van locations.`
                    : "The network is configured, but the stocked catalog still needs to be built before the workspace becomes useful."}
                </p>
                <div className="inventory-mini-stat-grid inventory-mini-stat-grid--network">
                  <div className="inventory-mini-stat">
                    <span>Warehouse</span>
                    <strong>{warehouseCount}</strong>
                  </div>
                  <div className="inventory-mini-stat">
                    <span>Shop</span>
                    <strong>{shopCount}</strong>
                  </div>
                  <div className="inventory-mini-stat">
                    <span>Van</span>
                    <strong>{vanCount}</strong>
                  </div>
                  <div className="inventory-mini-stat">
                    <span>Inactive</span>
                    <strong>{inactiveLocationCount}</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="inventory-command-band__rail">
            <div className="inventory-command-band__rail-header">
              <div>
                <p className="inventory-command-band__rail-eyebrow">Control agenda</p>
                <h3 className="inventory-command-band__rail-title">What to address next</h3>
              </div>
              <Badge tone={priority.tone}>{priority.eyebrow}</Badge>
            </div>

            <div className="inventory-agenda-grid">
              {controlAgenda.map((item) => (
                <InventoryAgendaCard item={item} key={item.key} />
              ))}
            </div>
          </div>
        </section>

        <section className="inventory-operations-grid">
          <div className="inventory-operations-grid__primary">
            <Card className="inventory-panel inventory-panel--queue">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Exception queue</CardEyebrow>
                  <CardTitle>Critical balances</CardTitle>
                  <CardDescription>
                    Sort the stock queue by urgency first: balances below reorder point, then balances trending low.
                  </CardDescription>
                </CardHeaderContent>
                <div className="inventory-card-header-actions">
                  {hiddenQueueRowCount ? <Badge tone="neutral">Top 10 shown</Badge> : null}
                  <Link
                    className={buttonClassName({ tone: "secondary", size: "sm" })}
                    href={buildInventoryHref({ view: "catalog", lowStock: true })}
                  >
                    Open lookup
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="inventory-panel-strip">
                  <div className="inventory-panel-strip__item">
                    <span>Reorder due</span>
                    <strong>{reorderDueRows.length}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Trending low</span>
                    <strong>{lowStockOnlyRows.length}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Alert locations</span>
                    <strong>{flaggedLocations.length}</strong>
                  </div>
                </div>

                {sortedLowStockRows.length ? (
                  <TableWrap className="inventory-reorder-table-wrap">
                    <Table className="inventory-reorder-table">
                      <thead>
                        <tr>
                          <HeaderCell>Item</HeaderCell>
                          <HeaderCell>Location</HeaderCell>
                          <HeaderCell>Status</HeaderCell>
                          <HeaderCell>Available</HeaderCell>
                          <HeaderCell>Next move</HeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedQueueRows.map((row) => (
                          <tr key={`${row.item.id}:${row.location.id}`}>
                            <Cell>
                              <div className="inventory-reorder-table__identity">
                                <strong>{row.item.sku}</strong>
                                <p className="inventory-reorder-table__meta">{row.item.name}</p>
                              </div>
                            </Cell>
                            <Cell>
                              <div className="inventory-reorder-table__identity">
                                <strong>{row.location.name}</strong>
                                <p className="inventory-reorder-table__meta">{row.location.slug}</p>
                              </div>
                            </Cell>
                            <Cell>
                              <StatusBadge status={row.balance.reorderStatus} />
                            </Cell>
                            <Cell>
                              <div className="inventory-reorder-table__readout">
                                <strong>{row.balance.availableQuantity}</strong>
                                <p className="inventory-reorder-table__meta">
                                  On hand {row.balance.onHandQuantity} · Reserved {row.balance.reservedQuantity}
                                </p>
                              </div>
                            </Cell>
                            <Cell>
                              <div className="inventory-reorder-table__readout">
                                <strong>{getReorderAction(row.balance)}</strong>
                                <p className="inventory-reorder-table__meta">
                                  Reorder point {row.balance.reorderPointQuantity ?? "not set"}
                                </p>
                              </div>
                            </Cell>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                ) : (
                  <EmptyState
                    className="inventory-empty-state inventory-empty-state--queue"
                    eyebrow="Queue clear"
                    title="No balances are below threshold"
                    description="Critical balances will surface here once available stock drops below low-stock or reorder thresholds."
                    actions={
                      <Link
                        className={buttonClassName({ tone: "secondary", size: "sm" })}
                        href={buildInventoryHref({ view: "catalog" })}
                      >
                        Review stock rules
                      </Link>
                    }
                  />
                )}
              </CardContent>
            </Card>

            <div className="inventory-boards-grid">
              <Card className="inventory-panel inventory-panel--transfers">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Movement board</CardEyebrow>
                    <CardTitle>Transfers in motion</CardTitle>
                    <CardDescription>
                      Keep the stock-moving board clean so warehouse, shop, and van inventory stay trustworthy.
                    </CardDescription>
                  </CardHeaderContent>
                  <Link
                    className={buttonClassName({ tone: "tertiary", size: "sm" })}
                    href={buildInventoryHref({ view: "movement" })}
                  >
                    All transfers
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="inventory-panel-strip">
                    <div className="inventory-panel-strip__item">
                      <span>In transit</span>
                      <strong>{operations.transferSummary.inTransitCount}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>Draft</span>
                      <strong>{operations.transferSummary.draftCount}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>Received today</span>
                      <strong>{operations.transferSummary.receivedTodayCount}</strong>
                    </div>
                  </div>

                  {displayedTransfers.length ? (
                    <div className="inventory-list">
                      {displayedTransfers.map((transfer) => {
                        const fromLocation = locationNameById.get(transfer.fromStockLocationId) ?? "Unknown";
                        const toLocation = locationNameById.get(transfer.toStockLocationId) ?? "Unknown";

                        return (
                          <article key={transfer.id} className="inventory-list__item inventory-list__item--transfer">
                            <div className="inventory-list__main">
                              <div className="inventory-list__identity">
                                <p className="inventory-list__eyebrow">
                                  {formatTransferReference(transfer.referenceNumber, transfer.id)}
                                </p>
                                <h3 className="inventory-list__title">
                                  {fromLocation} to {toLocation}
                                </h3>
                                <p className="inventory-list__description">
                                  Requested{" "}
                                  {formatDateTime(transfer.requestedAt, { timeZone: context.company.timezone })}
                                </p>
                              </div>
                              <div className="inventory-list__meta">
                                <StatusBadge status={transfer.status} />
                              </div>
                            </div>
                            <div className="inventory-list__actions">
                              <Link
                                className={buttonClassName({ tone: "tertiary", size: "sm" })}
                                href={buildInventoryHref({ view: "movement", transferId: transfer.id })}
                              >
                                Open
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No transfers yet"
                      title="Stock is not moving between locations"
                      description="The transfer board will light up here when inventory starts moving between warehouse, shop, and van stock."
                      actions={
                        <Link
                          className={buttonClassName({ tone: "secondary", size: "sm" })}
                          href={buildInventoryHref({ view: "movement" })}
                        >
                          Create transfer
                        </Link>
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="inventory-panel inventory-panel--activity">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Ledger</CardEyebrow>
                    <CardTitle>Recent inventory activity</CardTitle>
                    <CardDescription>
                      Receipts, issues, returns, and adjustments should read like operational history, not background noise.
                    </CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <div className="inventory-panel-strip">
                    <div className="inventory-panel-strip__item">
                      <span>Movement volume</span>
                      <strong>{totalMovementVolume}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>Additions</span>
                      <strong>{positiveTransactionCount}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>Reductions</span>
                      <strong>{negativeTransactionCount}</strong>
                    </div>
                  </div>

                  {displayedTransactions.length ? (
                    <div className="inventory-list">
                      {displayedTransactions.map((transaction) => {
                        const locationName = locationNameById.get(transaction.stockLocationId) ?? "Unknown location";

                        return (
                          <article key={transaction.id} className="inventory-list__item inventory-list__item--movement">
                            <div className="inventory-list__main">
                              <div className="inventory-list__identity">
                                <p className="inventory-list__eyebrow">
                                  {formatDateTime(transaction.effectiveAt, {
                                    timeZone: context.company.timezone
                                  })}
                                </p>
                                <h3 className="inventory-list__title">
                                  {formatInventoryTransactionTypeLabel(transaction.transactionType)}
                                </h3>
                                <p className="inventory-list__description">
                                  {locationName}
                                  {transaction.referenceNumber ? ` · ${transaction.referenceNumber}` : ""}
                                </p>
                              </div>
                              <div className="inventory-list__meta">
                                <Badge tone={transaction.quantityDelta >= 0 ? "success" : "warning"}>
                                  Qty {formatSignedQuantity(transaction.quantityDelta)}
                                </Badge>
                                <Badge tone="brand">{transaction.sourceType.replaceAll("_", " ")}</Badge>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No ledger movement"
                      title="Inventory activity has not started yet"
                      description="Receipts, transfers, issues, and adjustments will build the first movement history here."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="inventory-operations-grid__rail">
            <Card className="inventory-panel inventory-panel--alerts">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Location pressure</CardEyebrow>
                  <CardTitle>Where stock risk is concentrating</CardTitle>
                  <CardDescription>
                    Use location pressure to separate isolated low balances from a real site-level stock problem.
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
              <CardContent>
                <div className="inventory-panel-strip">
                  <div className="inventory-panel-strip__item">
                    <span>Flagged locations</span>
                    <strong>{flaggedLocations.length}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Active locations</span>
                    <strong>{activeLocations.length}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Hottest row count</span>
                    <strong>{topLocationAlert?.rowCount ?? 0}</strong>
                  </div>
                </div>

                {displayedFlaggedLocations.length ? (
                  <div className="inventory-list">
                    {displayedFlaggedLocations.map((row) => (
                      <article key={row.location.id} className="inventory-list__item inventory-list__item--location-alert">
                        <div className="inventory-list__main">
                          <div className="inventory-list__identity">
                            <p className="inventory-list__eyebrow">{row.location.slug}</p>
                            <h3 className="inventory-list__title">{row.location.name}</h3>
                            <p className="inventory-list__description">
                              {row.rowCount} low-stock balance{row.rowCount === 1 ? "" : "s"} at this location
                            </p>
                          </div>
                          <div className="inventory-list__meta">
                            <StatusBadge status={row.location.locationType} fallbackTone="info" />
                            <Badge tone={row.rowCount > 2 ? "danger" : "warning"}>
                              {row.rowCount} flagged
                            </Badge>
                          </div>
                        </div>
                        <div className="inventory-list__actions">
                          <Link
                            className={buttonClassName({ tone: "tertiary", size: "sm" })}
                            href={buildInventoryHref({ view: "locations", locationId: row.location.id })}
                          >
                            Review
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    className="inventory-empty-state"
                    eyebrow="Location health clear"
                    title="No location is carrying concentrated stock risk"
                    description="Location pressure will appear here when one warehouse, shop, or van starts stacking too many unhealthy balances."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="inventory-panel inventory-panel--vans">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Field readiness</CardEyebrow>
                  <CardTitle>Van stock status</CardTitle>
                  <CardDescription>
                    Vans should feel like controlled field inventory, not disconnected side stock.
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
              <CardContent>
                <div className="inventory-panel-strip">
                  <div className="inventory-panel-strip__item">
                    <span>Ready vans</span>
                    <strong>{Math.max(vanCount - vanAttentionCount, 0)}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Flagged vans</span>
                    <strong>{vanAttentionCount}</strong>
                  </div>
                  <div className="inventory-panel-strip__item">
                    <span>Tracked balances</span>
                    <strong>{trackedVanBalanceCount}</strong>
                  </div>
                </div>

                {displayedVanSummaries.length ? (
                  <div className="inventory-list">
                    {displayedVanSummaries.map((summary) => {
                      const alertCount = summary.balances.filter((balance) => balance.reorderStatus !== "ok").length;

                      return (
                        <article key={summary.vanLocation.id} className="inventory-list__item inventory-list__item--van">
                          <div className="inventory-list__main">
                            <div className="inventory-list__identity">
                              <p className="inventory-list__eyebrow">{summary.vanLocation.slug}</p>
                              <h3 className="inventory-list__title">{summary.vanLocation.name}</h3>
                              <p className="inventory-list__description">
                                {summary.vanLocation.vehicleLabel ?? "Technician van location"} · {summary.balances.length} tracked
                                balance{summary.balances.length === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="inventory-list__meta">
                              <Badge tone={alertCount ? "warning" : "success"}>
                                {alertCount ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Ready"}
                              </Badge>
                            </div>
                          </div>
                          <div className="inventory-list__actions">
                            <Link
                              className={buttonClassName({ tone: "tertiary", size: "sm" })}
                              href={buildInventoryHref({ view: "locations", locationId: summary.vanLocation.id })}
                            >
                              Open van
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    className="inventory-empty-state"
                    eyebrow="No van stock"
                    title="Van locations have not been set up yet"
                    description="Add van locations so field inventory can be tracked and replenished with the same ledger discipline as the shop."
                    actions={
                      <Link
                        className={buttonClassName({ tone: "secondary", size: "sm" })}
                        href={buildInventoryHref({ view: "locations" })}
                      >
                        Manage locations
                      </Link>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
      ) : view === "catalog" ? (
        <>
          <section className="inventory-workspace-mode">
            <div className="inventory-workspace-mode__primary">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Search</CardEyebrow>
                    <CardTitle>Catalog lookup</CardTitle>
                    <CardDescription>
                      Search stock by SKU, part number, or description and keep the selected item inspector open while you work.
                    </CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form method="get">
                    <input name="view" type="hidden" value="catalog" />
                    {catalogSelectedItemId ? <input name="itemId" type="hidden" value={catalogSelectedItemId} /> : null}
                    <FormRow>
                      <FormField label="Search">
                        <Input defaultValue={searchQuery} name="q" placeholder="SKU, name, part number" />
                      </FormField>
                      <FormField label="Location">
                        <Select defaultValue={lookupLocationId} name="lookupLocationId">
                          <option value="">All locations</option>
                          {catalogLookup?.locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </FormRow>
                    <div className="inventory-toolbar-row">
                      <label className="ui-field__hint inventory-inline-check">
                        <input defaultChecked={lowStockLookupOnly} name="lowStock" type="checkbox" value="1" />
                        Low stock only
                      </label>
                      <label className="ui-field__hint inventory-inline-check">
                        <input defaultChecked={includeInactive} name="includeInactive" type="checkbox" value="1" />
                        Include inactive items
                      </label>
                    </div>
                    <div className="inventory-toolbar-row">
                      <Button type="submit">Search catalog</Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>

              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Results</CardEyebrow>
                    <CardTitle>Catalog rows</CardTitle>
                    <CardDescription>
                      Select a row to inspect item availability without leaving the workspace.
                    </CardDescription>
                  </CardHeaderContent>
                  <Badge tone="brand">{catalogLookup?.rows.length ?? 0} rows</Badge>
                </CardHeader>
                <CardContent>
                  {catalogLookup?.rows.length ? (
                    <TableWrap>
                      <Table>
                        <thead>
                          <tr>
                            <HeaderCell>SKU</HeaderCell>
                            <HeaderCell>Name</HeaderCell>
                            <HeaderCell>Aliases</HeaderCell>
                            <HeaderCell>Locations</HeaderCell>
                            <HeaderCell>Available</HeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {catalogLookup.rows.map((row) => (
                            <tr
                              className={row.item.id === catalogSelectedItemId ? "inventory-results-table__row--selected" : undefined}
                              key={row.item.id}
                            >
                              <Cell>
                                <div className="ui-table-cell-title">
                                  <Link
                                    href={buildInventoryHref({
                                      view: "catalog",
                                      q: searchQuery || undefined,
                                      lookupLocationId: lookupLocationId || undefined,
                                      lowStock: lowStockLookupOnly,
                                      includeInactive,
                                      itemId: row.item.id
                                    })}
                                  >
                                    {row.item.sku}
                                  </Link>
                                  <p className="ui-table-cell-meta">{row.item.partNumber ?? "No part number"}</p>
                                </div>
                              </Cell>
                              <Cell>{row.item.name}</Cell>
                              <Cell>
                                {row.aliases.length ? row.aliases.map((alias) => alias.value).join(", ") : "No aliases"}
                              </Cell>
                              <Cell>{row.balances.length ? row.balances.length : "No stock"}</Cell>
                              <Cell>
                                {row.balances.reduce((total, balance) => total + balance.availableQuantity, 0)}
                              </Cell>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No results"
                      title="No stock matched this search"
                      description="Try a SKU, part number, or broader description search."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="inventory-workspace-mode__rail">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Create</CardEyebrow>
                    <CardTitle>Add inventory item</CardTitle>
                    <CardDescription>Create a new stockable SKU without leaving the catalog workspace.</CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form action={createItemAction}>
                    <FormRow>
                      <FormField label="SKU" required>
                        <Input name="sku" required />
                      </FormField>
                      <FormField label="Item name" required>
                        <Input name="name" required />
                      </FormField>
                    </FormRow>
                    <FormRow>
                      <FormField label="Manufacturer">
                        <Input name="manufacturer" />
                      </FormField>
                      <FormField label="Part number">
                        <Input name="partNumber" />
                      </FormField>
                    </FormRow>
                    <FormRow>
                      <FormField label="Supplier">
                        <Select defaultValue="" name="supplierAccountId">
                          <option value="">No default supplier</option>
                          {catalogSupplierAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Default unit cost (cents)">
                        <Input min="0" name="defaultUnitCostCents" type="number" />
                      </FormField>
                    </FormRow>
                    <FormRow>
                      <FormField label="Item type">
                        <Select defaultValue="stocked" name="itemType">
                          <option value="stocked">Stocked</option>
                          <option value="non_stocked">Non-stocked</option>
                        </Select>
                      </FormField>
                      <FormField label="Description">
                        <Input name="description" />
                      </FormField>
                    </FormRow>
                    <label className="ui-field__hint inventory-inline-check">
                      <input defaultChecked name="isActive" type="checkbox" />
                      Active item
                    </label>
                    <FormField label="Notes">
                      <Textarea name="notes" rows={3} />
                    </FormField>
                    <Button type="submit">Create inventory item</Button>
                  </Form>
                </CardContent>
              </Card>

              <Card className="inventory-workspace-card inventory-inspector-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Inspector</CardEyebrow>
                    <CardTitle>{catalogItemDetail?.item ? `${catalogItemDetail.item.item.sku} availability` : "Choose an item"}</CardTitle>
                    <CardDescription>
                      Keep the item context visible while you search and compare stock across locations.
                    </CardDescription>
                  </CardHeaderContent>
                  {catalogItemDetail?.item ? (
                    <Link
                      className={buttonClassName({ tone: "tertiary", size: "sm" })}
                      href={`/dashboard/supply/inventory/items/${catalogItemDetail.item.item.id}`}
                    >
                      Advanced editor
                    </Link>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {catalogItemDetail?.item ? (
                    <>
                      <div className="inventory-panel-strip">
                        <div className="inventory-panel-strip__item">
                          <span>On hand</span>
                          <strong>{catalogItemDetail.item.totalOnHandQuantity}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Reserved</span>
                          <strong>{catalogItemDetail.item.totalReservedQuantity}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Available</span>
                          <strong>{catalogItemDetail.item.totalAvailableQuantity}</strong>
                        </div>
                      </div>
                      <div className="inventory-inspector-stack">
                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Item</p>
                          <h3 className="inventory-inspector-section__title">{catalogItemDetail.item.item.name}</h3>
                          <p className="inventory-agenda-card__copy">
                            {catalogItemDetail.item.item.partNumber ?? "No part number"} ·{" "}
                            {catalogItemDetail.item.item.manufacturer ?? "No manufacturer"}
                          </p>
                          <div className="inventory-list__meta">
                            <StatusBadge
                              status={catalogItemDetail.item.item.itemType}
                              fallbackTone={catalogItemDetail.item.item.isActive ? "success" : "warning"}
                            />
                            {catalogItemDetail.item.item.defaultUnitCostCents !== null ? (
                              <Badge tone="brand">
                                {formatCurrencyFromCents(catalogItemDetail.item.item.defaultUnitCostCents)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Aliases</p>
                          {catalogItemDetail.item.aliases.length ? (
                            <div className="inventory-chip-wrap">
                              {catalogItemDetail.item.aliases.map((alias) => (
                                <Badge key={alias.id} tone="neutral">
                                  {alias.value}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="inventory-agenda-card__copy">No alternate identifiers yet.</p>
                          )}
                        </div>

                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Location balances</p>
                          {catalogItemDetail.item.balances.length ? (
                            <div className="inventory-list">
                              {catalogItemDetail.item.balances.slice(0, 6).map((balance) => {
                                const location =
                                  catalogItemDetail.locations.find((entry) => entry.id === balance.stockLocationId) ?? null;

                                return (
                                  <article className="inventory-list__item inventory-list__item--movement" key={balance.stockLocationId}>
                                    <div className="inventory-list__main">
                                      <div className="inventory-list__identity">
                                        <p className="inventory-list__eyebrow">{location?.slug ?? "Unknown"}</p>
                                        <h3 className="inventory-list__title">{location?.name ?? "Unknown location"}</h3>
                                        <p className="inventory-list__description">
                                          On hand {balance.onHandQuantity} · reserved {balance.reservedQuantity}
                                        </p>
                                      </div>
                                      <div className="inventory-list__meta">
                                        <StatusBadge status={balance.reorderStatus} />
                                        <Badge tone="brand">Avail {balance.availableQuantity}</Badge>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="inventory-agenda-card__copy">This item has no stock at any location yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="Item inspector"
                      title="Choose a catalog row"
                      description="Select a row from the results table to inspect balances and availability without leaving this workspace."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      ) : view === "locations" ? (
        <>
          <section className="inventory-workspace-mode">
            <div className="inventory-workspace-mode__primary">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Network</CardEyebrow>
                    <CardTitle>Stock locations</CardTitle>
                    <CardDescription>
                      Select a location to inspect balances, transfer history, and cycle-count activity while keeping the list visible.
                    </CardDescription>
                  </CardHeaderContent>
                  <Badge tone="brand">{locationRecords?.length ?? 0} locations</Badge>
                </CardHeader>
                <CardContent>
                  {locationRecords?.length ? (
                    <TableWrap>
                      <Table>
                        <thead>
                          <tr>
                            <HeaderCell>Name</HeaderCell>
                            <HeaderCell>Type</HeaderCell>
                            <HeaderCell>Technician</HeaderCell>
                            <HeaderCell>Vehicle</HeaderCell>
                            <HeaderCell>Status</HeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {locationRecords.map((location) => {
                            const technician =
                              locationTechnicians?.find((entry) => entry.userId === location.technicianUserId) ?? null;

                            return (
                              <tr
                                className={location.id === selectedLocationId ? "inventory-results-table__row--selected" : undefined}
                                key={location.id}
                              >
                                <Cell>
                                  <div className="ui-table-cell-title">
                                    <Link href={buildInventoryHref({ view: "locations", locationId: location.id })}>
                                      {location.name}
                                    </Link>
                                    <p className="ui-table-cell-meta">{location.slug}</p>
                                  </div>
                                </Cell>
                                <Cell>
                                  <StatusBadge status={location.locationType} fallbackTone="info" />
                                </Cell>
                                <Cell>{technician?.displayName ?? "No technician"}</Cell>
                                <Cell>{location.vehicleLabel ?? "—"}</Cell>
                                <Cell>
                                  <Badge tone={location.isActive ? "success" : "warning"}>
                                    {location.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </Cell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </TableWrap>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No locations"
                      title="Create the first stock location"
                      description="The network needs at least one location before inventory can be received, transferred, or counted."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="inventory-workspace-mode__rail">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Create</CardEyebrow>
                    <CardTitle>Add location</CardTitle>
                    <CardDescription>Warehouse, shop, and van locations all belong in the same stock network.</CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form action={createLocationAction}>
                    <FormRow>
                      <FormField label="Name" required>
                        <Input name="name" required />
                      </FormField>
                      <FormField label="Slug" required>
                        <Input name="slug" required />
                      </FormField>
                    </FormRow>
                    <FormField label="Location type">
                      <Select defaultValue="warehouse" name="locationType">
                        <option value="warehouse">Warehouse</option>
                        <option value="shop">Shop</option>
                        <option value="van">Van</option>
                      </Select>
                    </FormField>
                    <FormRow>
                      <FormField label="Assigned technician">
                        <Select defaultValue="" name="technicianUserId">
                          <option value="">No technician</option>
                          {locationTechnicians?.map((technician) => (
                            <option key={technician.userId} value={technician.userId}>
                              {technician.displayName}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Vehicle label">
                        <Input name="vehicleLabel" placeholder="Van 12" />
                      </FormField>
                    </FormRow>
                    <label className="ui-field__hint inventory-inline-check">
                      <input defaultChecked name="isActive" type="checkbox" />
                      Active location
                    </label>
                    <FormField label="Notes">
                      <Textarea name="notes" rows={3} />
                    </FormField>
                    <Button type="submit">Create location</Button>
                  </Form>
                </CardContent>
              </Card>

              <Card className="inventory-workspace-card inventory-inspector-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Inspector</CardEyebrow>
                    <CardTitle>{locationDetail?.location ? locationDetail.location.name : "Choose a location"}</CardTitle>
                    <CardDescription>
                      Edit the selected location while keeping its stock history in view.
                    </CardDescription>
                  </CardHeaderContent>
                  {locationDetail?.location ? (
                    <Link
                      className={buttonClassName({ tone: "tertiary", size: "sm" })}
                      href={`/dashboard/supply/inventory/locations/${locationDetail.location.id}`}
                    >
                      Detail page
                    </Link>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {locationDetail?.location ? (
                    <>
                      <Form action={updateLocationAction}>
                        <input name="locationId" type="hidden" value={locationDetail.location.id} />
                        <FormRow>
                          <FormField label="Name">
                            <Input defaultValue={locationDetail.location.name} name="name" />
                          </FormField>
                          <FormField label="Slug">
                            <Input defaultValue={locationDetail.location.slug} name="slug" />
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Type">
                            <Select defaultValue={locationDetail.location.locationType} name="locationType">
                              <option value="warehouse">Warehouse</option>
                              <option value="shop">Shop</option>
                              <option value="van">Van</option>
                            </Select>
                          </FormField>
                          <FormField label="Assigned technician">
                            <Select defaultValue={locationDetail.location.technicianUserId ?? ""} name="technicianUserId">
                              <option value="">No technician</option>
                              {locationTechnicians?.map((technician) => (
                                <option key={technician.userId} value={technician.userId}>
                                  {technician.displayName}
                                </option>
                              ))}
                            </Select>
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Vehicle label">
                            <Input defaultValue={locationDetail.location.vehicleLabel ?? ""} name="vehicleLabel" />
                          </FormField>
                          <FormField label="Notes">
                            <Input defaultValue={locationDetail.location.notes ?? ""} name="notes" />
                          </FormField>
                        </FormRow>
                        <label className="ui-field__hint inventory-inline-check">
                          <input defaultChecked={locationDetail.location.isActive} name="isActive" type="checkbox" />
                          Active location
                        </label>
                        <Button tone="secondary" type="submit">Save location</Button>
                      </Form>

                      <div className="inventory-panel-strip">
                        <div className="inventory-panel-strip__item">
                          <span>Balances</span>
                          <strong>{locationDetail.balanceRows.length}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Transfers</span>
                          <strong>{locationDetail.transfers.length}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Counts</span>
                          <strong>{locationDetail.cycleCounts.length}</strong>
                        </div>
                      </div>

                      <div className="inventory-inspector-stack">
                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Recent balances</p>
                          {locationDetail.balanceRows.length ? (
                            <div className="inventory-list">
                              {locationDetail.balanceRows.slice(0, 5).map((row) => (
                                <article className="inventory-list__item inventory-list__item--movement" key={row.balance.inventoryItemId}>
                                  <div className="inventory-list__main">
                                    <div className="inventory-list__identity">
                                      <p className="inventory-list__eyebrow">{row.item?.sku ?? "Unknown item"}</p>
                                      <h3 className="inventory-list__title">{row.item?.name ?? "Missing inventory item"}</h3>
                                      <p className="inventory-list__description">
                                        On hand {row.balance.onHandQuantity} · reserved {row.balance.reservedQuantity}
                                      </p>
                                    </div>
                                    <div className="inventory-list__meta">
                                      <StatusBadge status={row.balance.reorderStatus} />
                                      <Badge tone="brand">Avail {row.balance.availableQuantity}</Badge>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="inventory-agenda-card__copy">Nothing is stored here yet.</p>
                          )}
                        </div>

                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Recent activity</p>
                          {locationDetail.transactions.length ? (
                            <div className="inventory-list">
                              {locationDetail.transactions.slice(0, 4).map((transaction) => (
                                <article className="inventory-list__item inventory-list__item--movement" key={transaction.id}>
                                  <div className="inventory-list__main">
                                    <div className="inventory-list__identity">
                                      <p className="inventory-list__eyebrow">
                                        {formatDateTime(transaction.effectiveAt, {
                                          timeZone: context.company.timezone
                                        })}
                                      </p>
                                      <h3 className="inventory-list__title">
                                        {formatInventoryTransactionTypeLabel(transaction.transactionType)}
                                      </h3>
                                      <p className="inventory-list__description">Qty delta {transaction.quantityDelta}</p>
                                    </div>
                                    <div className="inventory-list__meta">
                                      <Badge tone="brand">{transaction.sourceType.replaceAll("_", " ")}</Badge>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="inventory-agenda-card__copy">No transactions have hit this location yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="Location inspector"
                      title="Choose a location"
                      description="Select a row from the network list to edit the location and inspect its stock context."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      ) : view === "movement" ? (
        <>
          <section className="inventory-workspace-mode">
            <div className="inventory-workspace-mode__primary">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Queue</CardEyebrow>
                    <CardTitle>Transfer board</CardTitle>
                    <CardDescription>
                      Draft, ship, and receive inventory movement while keeping the transfer queue in view.
                    </CardDescription>
                  </CardHeaderContent>
                  <Badge tone={transferMovementCount ? "progress" : "neutral"}>
                    {transferMovementCount ? `${transferMovementCount} active` : "Quiet"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="inventory-panel-strip">
                    <div className="inventory-panel-strip__item">
                      <span>Draft</span>
                      <strong>{operations.transferSummary.draftCount}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>In transit</span>
                      <strong>{operations.transferSummary.inTransitCount}</strong>
                    </div>
                    <div className="inventory-panel-strip__item">
                      <span>Received today</span>
                      <strong>{operations.transferSummary.receivedTodayCount}</strong>
                    </div>
                  </div>

                  {operations.transfers.length ? (
                    <TableWrap>
                      <Table>
                        <thead>
                          <tr>
                            <HeaderCell>Reference</HeaderCell>
                            <HeaderCell>Status</HeaderCell>
                            <HeaderCell>Requested</HeaderCell>
                            <HeaderCell>Route</HeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {operations.transfers.map((transfer) => {
                            const fromLocation =
                              operations.locations.find((location) => location.id === transfer.fromStockLocationId)?.name ??
                              "Unknown";
                            const toLocation =
                              operations.locations.find((location) => location.id === transfer.toStockLocationId)?.name ??
                              "Unknown";

                            return (
                              <tr
                                className={transfer.id === selectedTransferId ? "inventory-results-table__row--selected" : undefined}
                                key={transfer.id}
                              >
                                <Cell>
                                  <Link href={buildInventoryHref({ view: "movement", transferId: transfer.id })}>
                                    {formatTransferReference(transfer.referenceNumber, transfer.id)}
                                  </Link>
                                </Cell>
                                <Cell>
                                  <StatusBadge status={transfer.status} />
                                </Cell>
                                <Cell>{formatDateTime(transfer.requestedAt, { timeZone: context.company.timezone })}</Cell>
                                <Cell>{fromLocation} to {toLocation}</Cell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </TableWrap>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No transfers"
                      title="No stock movement between locations yet"
                      description="Create the first transfer when stock needs to move between warehouse, shop, and van locations."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="inventory-workspace-mode__rail">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Create</CardEyebrow>
                    <CardTitle>New transfer</CardTitle>
                    <CardDescription>Draft the move and keep the board visible while you create it.</CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form action={createTransferAction}>
                    <FormRow>
                      <FormField label="From location">
                        <Select defaultValue={movementActiveLocations?.[0]?.id ?? ""} name="fromStockLocationId">
                          <option value="">Select location</option>
                          {movementActiveLocations?.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="To location">
                        <Select defaultValue={movementActiveLocations?.[1]?.id ?? ""} name="toStockLocationId">
                          <option value="">Select location</option>
                          {movementActiveLocations?.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </FormRow>
                    <FormField label="Reference number">
                      <Input name="referenceNumber" />
                    </FormField>
                    {[0, 1, 2].map((index) => (
                      <div className="inventory-builder-block" key={index}>
                        <FormRow>
                          <FormField label={`Item ${index + 1}`}>
                            <Select defaultValue="" name={`inventoryItemId_${index}`}>
                              <option value="">Select stocked item</option>
                              {movementActiveItems?.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.sku} · {item.name}
                                </option>
                              ))}
                            </Select>
                          </FormField>
                          <FormField label="Quantity">
                            <Input min="0.01" name={`quantityRequested_${index}`} step="0.01" type="number" />
                          </FormField>
                          <FormField label="Unit cost (cents)">
                            <Input min="0" name={`unitCostCents_${index}`} type="number" />
                          </FormField>
                        </FormRow>
                        <FormField label="Line notes">
                          <Input name={`lineNotes_${index}`} />
                        </FormField>
                      </div>
                    ))}
                    <FormField label="Notes">
                      <Textarea name="notes" rows={3} />
                    </FormField>
                    <Button type="submit">Create transfer</Button>
                  </Form>
                </CardContent>
              </Card>

              <Card className="inventory-workspace-card inventory-inspector-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Inspector</CardEyebrow>
                    <CardTitle>
                      {transferDetail
                        ? formatTransferReference(transferDetail.transfer.referenceNumber, transferDetail.transfer.id)
                        : "Choose a transfer"}
                    </CardTitle>
                    <CardDescription>
                      Manage the selected transfer lifecycle without leaving the board.
                    </CardDescription>
                  </CardHeaderContent>
                  {transferDetail ? (
                    <Link
                      className={buttonClassName({ tone: "tertiary", size: "sm" })}
                      href={`/dashboard/supply/inventory/transfers/${transferDetail.transfer.id}`}
                    >
                      Detail page
                    </Link>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {transferDetail ? (
                    <>
                      <div className="inventory-panel-strip">
                        <div className="inventory-panel-strip__item">
                          <span>Status</span>
                          <strong>{transferDetail.transfer.status.replaceAll("_", " ")}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>From</span>
                          <strong>{transferDetail.fromLocation.name}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>To</span>
                          <strong>{transferDetail.toLocation.name}</strong>
                        </div>
                      </div>

                      <div className="inventory-inspector-stack">
                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Ship</p>
                          <Form action={shipTransferAction}>
                            {transferDetail.lines.map(({ line, item, fromBalance }) => {
                              const remainingToShip = Math.max(line.quantityRequested - line.quantityShipped, 0);

                              return (
                                <div className="inventory-builder-block" key={line.id}>
                                  <p className="inventory-list__eyebrow">{item.sku}</p>
                                  <h3 className="inventory-inspector-section__title">{item.name}</h3>
                                  <p className="inventory-agenda-card__copy">
                                    Requested {line.quantityRequested} · shipped {line.quantityShipped} · source available{" "}
                                    {fromBalance?.availableQuantity ?? 0}
                                  </p>
                                  <FormRow>
                                    <FormField label="Qty to ship">
                                      <Input
                                        defaultValue={remainingToShip > 0 ? remainingToShip : ""}
                                        disabled={transferDetail.transfer.status !== "draft"}
                                        max={remainingToShip}
                                        min="0.01"
                                        name={`quantityShipped_${line.id}`}
                                        step="0.01"
                                        type="number"
                                      />
                                    </FormField>
                                    <FormField label="Unit cost (cents)">
                                      <Input
                                        defaultValue={line.unitCostCents ?? ""}
                                        disabled={transferDetail.transfer.status !== "draft"}
                                        min="0"
                                        name={`unitCostCents_${line.id}`}
                                        type="number"
                                      />
                                    </FormField>
                                  </FormRow>
                                  <FormField label="Line notes">
                                    <Input disabled={transferDetail.transfer.status !== "draft"} name={`lineNotes_${line.id}`} />
                                  </FormField>
                                </div>
                              );
                            })}
                            <FormField label="Notes">
                              <Textarea disabled={transferDetail.transfer.status !== "draft"} name="notes" rows={2} />
                            </FormField>
                            <Button disabled={transferDetail.transfer.status !== "draft"} type="submit">
                              {transferDetail.transfer.status === "draft" ? "Ship transfer" : "Already shipped"}
                            </Button>
                          </Form>
                        </div>

                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Receive</p>
                          <Form action={receiveTransferAction}>
                            {transferDetail.lines.map(({ line, item, toBalance }) => {
                              const remainingToReceive = Math.max(line.quantityShipped - line.quantityReceived, 0);

                              return (
                                <div className="inventory-builder-block" key={line.id}>
                                  <p className="inventory-list__eyebrow">{item.sku}</p>
                                  <h3 className="inventory-inspector-section__title">{item.name}</h3>
                                  <p className="inventory-agenda-card__copy">
                                    Shipped {line.quantityShipped} · received {line.quantityReceived} · destination on hand{" "}
                                    {toBalance?.onHandQuantity ?? 0}
                                  </p>
                                  <FormRow>
                                    <FormField label="Qty to receive">
                                      <Input
                                        defaultValue={remainingToReceive > 0 ? remainingToReceive : ""}
                                        disabled={transferDetail.transfer.status !== "in_transit"}
                                        max={remainingToReceive}
                                        min="0.01"
                                        name={`quantityReceived_${line.id}`}
                                        step="0.01"
                                        type="number"
                                      />
                                    </FormField>
                                    <FormField label="Line notes">
                                      <Input
                                        disabled={transferDetail.transfer.status !== "in_transit"}
                                        name={`lineNotes_${line.id}`}
                                      />
                                    </FormField>
                                  </FormRow>
                                </div>
                              );
                            })}
                            <FormField label="Notes">
                              <Textarea disabled={transferDetail.transfer.status !== "in_transit"} name="notes" rows={2} />
                            </FormField>
                            <Button disabled={transferDetail.transfer.status !== "in_transit"} tone="secondary" type="submit">
                              {transferDetail.transfer.status === "in_transit" ? "Receive transfer" : "Not ready to receive"}
                            </Button>
                          </Form>
                        </div>

                        <div className="inventory-inspector-section">
                          <p className="inventory-agenda-card__eyebrow">Cancel draft</p>
                          <Form action={cancelTransferAction}>
                            <FormField label="Cancel notes">
                              <Textarea disabled={transferDetail.transfer.status !== "draft"} name="cancelNotes" rows={2} />
                            </FormField>
                            <Button disabled={transferDetail.transfer.status !== "draft"} tone="danger" type="submit">
                              {transferDetail.transfer.status === "draft" ? "Cancel transfer" : "Only drafts can be canceled"}
                            </Button>
                          </Form>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="Transfer inspector"
                      title="Choose a transfer"
                      description="Select a transfer row to ship, receive, or review line quantities without opening a separate page."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="inventory-workspace-mode">
            <div className="inventory-workspace-mode__primary">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>History</CardEyebrow>
                    <CardTitle>Cycle counts</CardTitle>
                    <CardDescription>
                      Keep count history visible while recording the next correction.
                    </CardDescription>
                  </CardHeaderContent>
                  <Badge tone="brand">{cycleCounts?.length ?? 0} counts</Badge>
                </CardHeader>
                <CardContent>
                  {cycleCounts?.length ? (
                    <TableWrap>
                      <Table>
                        <thead>
                          <tr>
                            <HeaderCell>Counted at</HeaderCell>
                            <HeaderCell>Location</HeaderCell>
                            <HeaderCell>Notes</HeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {cycleCounts.map((cycleCount) => {
                            const location =
                              countLocations?.find((entry) => entry.id === cycleCount.stockLocationId) ??
                              workspace.locations.find((entry) => entry.id === cycleCount.stockLocationId) ??
                              null;

                            return (
                              <tr
                                className={cycleCount.id === selectedCycleCountId ? "inventory-results-table__row--selected" : undefined}
                                key={cycleCount.id}
                              >
                                <Cell>
                                  <Link href={buildInventoryHref({ view: "counts", cycleCountId: cycleCount.id })}>
                                    {formatDateTime(cycleCount.countedAt, { timeZone: context.company.timezone })}
                                  </Link>
                                </Cell>
                                <Cell>{location?.name ?? "Unknown location"}</Cell>
                                <Cell>{cycleCount.notes ?? "—"}</Cell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </TableWrap>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="No counts"
                      title="No cycle counts recorded yet"
                      description="Run the first count to establish an audit trail for stock corrections."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="inventory-workspace-mode__rail">
              <Card className="inventory-workspace-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Create</CardEyebrow>
                    <CardTitle>New cycle count</CardTitle>
                    <CardDescription>Record counted quantities without leaving the count history workspace.</CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form action={createCycleCountAction}>
                    <FormField label="Location">
                      <Select defaultValue={countLocations?.[0]?.id ?? ""} name="stockLocationId">
                        <option value="">Select location</option>
                        {countLocations?.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div className="inventory-builder-block" key={index}>
                        <FormRow>
                          <FormField label={`Item ${index + 1}`}>
                            <Select defaultValue="" name={`inventoryItemId_${index}`}>
                              <option value="">Select stocked item</option>
                              {countItems?.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.sku} · {item.name}
                                </option>
                              ))}
                            </Select>
                          </FormField>
                          <FormField label="Counted quantity">
                            <Input min="0" name={`countedQuantity_${index}`} step="0.01" type="number" />
                          </FormField>
                        </FormRow>
                        <FormField label="Line notes">
                          <Input name={`lineNotes_${index}`} />
                        </FormField>
                      </div>
                    ))}
                    <FormField label="Notes">
                      <Textarea name="notes" rows={3} />
                    </FormField>
                    <Button type="submit">Record cycle count</Button>
                  </Form>
                </CardContent>
              </Card>

              <Card className="inventory-workspace-card inventory-inspector-card">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Inspector</CardEyebrow>
                    <CardTitle>
                      {cycleCountDetail
                        ? formatDateTime(cycleCountDetail.cycleCount.countedAt, { timeZone: context.company.timezone })
                        : "Choose a count"}
                    </CardTitle>
                    <CardDescription>
                      Inspect expected versus counted quantities without leaving count history.
                    </CardDescription>
                  </CardHeaderContent>
                  {cycleCountDetail ? (
                    <Link
                      className={buttonClassName({ tone: "tertiary", size: "sm" })}
                      href={`/dashboard/supply/inventory/cycle-counts/${cycleCountDetail.cycleCount.id}`}
                    >
                      Detail page
                    </Link>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {cycleCountDetail ? (
                    <>
                      <div className="inventory-panel-strip">
                        <div className="inventory-panel-strip__item">
                          <span>Location</span>
                          <strong>{cycleCountDetail.location.name}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Lines</span>
                          <strong>{cycleCountDetail.lines.length}</strong>
                        </div>
                        <div className="inventory-panel-strip__item">
                          <span>Variance rows</span>
                          <strong>{cycleCountDetail.lines.filter(({ line }) => line.varianceQuantity !== 0).length}</strong>
                        </div>
                      </div>

                      {cycleCountDetail.lines.length ? (
                        <TableWrap>
                          <Table>
                            <thead>
                              <tr>
                                <HeaderCell>Item</HeaderCell>
                                <HeaderCell>Expected</HeaderCell>
                                <HeaderCell>Counted</HeaderCell>
                                <HeaderCell>Variance</HeaderCell>
                              </tr>
                            </thead>
                            <tbody>
                              {cycleCountDetail.lines.map(({ line, item }) => (
                                <tr key={line.id}>
                                  <Cell>
                                    <div className="ui-table-cell-title">
                                      <strong>{item.sku}</strong>
                                      <p className="ui-table-cell-meta">{item.name}</p>
                                    </div>
                                  </Cell>
                                  <Cell>{line.expectedQuantity}</Cell>
                                  <Cell>{line.countedQuantity}</Cell>
                                  <Cell>{line.varianceQuantity}</Cell>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </TableWrap>
                      ) : (
                        <EmptyState
                          className="inventory-empty-state"
                          eyebrow="No lines"
                          title="This cycle count has no lines"
                          description="Record a fresh count if this one was created incorrectly."
                        />
                      )}
                    </>
                  ) : (
                    <EmptyState
                      className="inventory-empty-state"
                      eyebrow="Count inspector"
                      title="Choose a recorded count"
                      description="Select a count row to review its variance lines without leaving the count workspace."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

export default async function InventoryWorkspacePage({ searchParams }: InventoryWorkspacePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  redirect(buildDashboardAliasHref("/dashboard/supply/inventory", resolvedSearchParams));
}
