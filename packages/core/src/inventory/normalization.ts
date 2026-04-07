import type {
  CreateInventoryItemAliasInput,
  CreateInventoryItemInput,
  CreateStockLocationInput,
  UpdateInventoryItemInput,
  UpdateStockLocationInput
} from "@mobile-mechanic/types";

function trimOrNull(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeInventorySku(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeInventoryAlias(value: string) {
  return value.trim().toUpperCase().replaceAll(/\s+/g, "");
}

export function normalizeStockLocationSlug(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeInventoryItemInput<T extends CreateInventoryItemInput | UpdateInventoryItemInput>(
  input: T
): T {
  return {
    ...input,
    description: trimOrNull(input.description),
    manufacturer: trimOrNull(input.manufacturer),
    name: input.name.trim(),
    notes: trimOrNull(input.notes),
    partNumber: trimOrNull(input.partNumber)?.toUpperCase() ?? null,
    sku: normalizeInventorySku(input.sku)
  } as T;
}

export function normalizeInventoryAliasInput(input: CreateInventoryItemAliasInput) {
  return {
    ...input,
    value: normalizeInventoryAlias(input.value)
  };
}

export function normalizeStockLocationInput<T extends CreateStockLocationInput | UpdateStockLocationInput>(
  input: T
): T {
  return {
    ...input,
    name: input.name.trim(),
    notes: trimOrNull(input.notes),
    vehicleLabel: trimOrNull(input.vehicleLabel),
    slug: normalizeStockLocationSlug(input.slug)
  } as T;
}
