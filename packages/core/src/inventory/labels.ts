function formatInventoryLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatInventoryTransactionTypeLabel(status: string) {
  return formatInventoryLabel(status);
}

export function formatStockLocationTypeLabel(status: string) {
  return formatInventoryLabel(status);
}

export function formatInventoryReorderStatusLabel(status: string) {
  return formatInventoryLabel(status);
}
