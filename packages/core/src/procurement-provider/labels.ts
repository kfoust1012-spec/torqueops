import {
  formatDesignStatusLabel,
  type DesignStatusTone,
  resolveDesignStatusTone
} from "../design/tokens";

export function formatProcurementProviderLabel(provider: string | null | undefined) {
  if (!provider) {
    return "";
  }

  if (provider === "partstech") {
    return "PartsTech";
  }

  if (provider === "repairlink") {
    return "RepairLink";
  }

  if (provider === "amazon_business") {
    return "Amazon Business";
  }

  return formatDesignStatusLabel(provider);
}

export function formatProcurementProviderAccountStatusLabel(status: string | null | undefined) {
  return formatDesignStatusLabel(status);
}

export function formatProcurementProviderQuoteStatusLabel(status: string | null | undefined) {
  return formatDesignStatusLabel(status);
}

export function formatProcurementProviderOrderStatusLabel(status: string | null | undefined) {
  return formatDesignStatusLabel(status);
}

export function resolveProcurementProviderTone(status: string | null | undefined): DesignStatusTone {
  return resolveDesignStatusTone(status);
}
