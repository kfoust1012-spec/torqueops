function formatProcurementLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPartLifecycleStatusLabel(status: string) {
  return formatProcurementLabel(status);
}

export function formatPurchaseOrderStatusLabel(status: string) {
  return formatProcurementLabel(status);
}

export function formatSupplierAccountModeLabel(mode: string) {
  return formatProcurementLabel(mode);
}
