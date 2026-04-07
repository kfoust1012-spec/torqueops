function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatInventoryTransferStatusLabel(value: string) {
  return formatLabel(value);
}

export function formatJobInventoryIssueStatusLabel(value: string) {
  return formatLabel(value);
}

export function formatCoreInventoryStatusLabel(value: string) {
  return formatLabel(value);
}
