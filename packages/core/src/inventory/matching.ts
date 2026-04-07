import type {
  InventoryItem,
  InventoryItemAlias,
  PartRequestLine,
  PurchaseOrderLine
} from "@mobile-mechanic/types";

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toUpperCase().replaceAll(/\s+/g, "") ?? null;
}

export function matchInventoryItemByPartNumber(
  items: Array<Pick<InventoryItem, "id" | "partNumber">>,
  partNumber: string | null | undefined
) {
  const normalized = normalizeMatchValue(partNumber);

  if (!normalized) {
    return null;
  }

  return items.find((item) => normalizeMatchValue(item.partNumber) === normalized) ?? null;
}

export function matchInventoryItemByAlias(
  aliases: Array<Pick<InventoryItemAlias, "inventoryItemId" | "value">>,
  aliasValue: string | null | undefined
) {
  const normalized = normalizeMatchValue(aliasValue);

  if (!normalized) {
    return null;
  }

  return aliases.find((alias) => normalizeMatchValue(alias.value) === normalized) ?? null;
}

export function resolveInventoryItemCandidateFromProcurementLine(
  line:
    | Pick<PartRequestLine, "inventoryItemId" | "partNumber" | "supplierSku">
    | Pick<PurchaseOrderLine, "inventoryItemId" | "partNumber" | "supplierPartNumber">
) {
  return {
    explicitInventoryItemId: line.inventoryItemId ?? null,
    normalizedPartNumber: normalizeMatchValue(line.partNumber),
    normalizedAlias:
      "supplierSku" in line
        ? normalizeMatchValue(line.supplierSku)
        : normalizeMatchValue(line.supplierPartNumber)
  };
}
