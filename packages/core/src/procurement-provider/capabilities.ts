import type {
  ProcurementProviderCapabilities,
  ProcurementProviderOrderResult,
  ProcurementProviderQuoteResult
} from "@mobile-mechanic/types";

export const partsTechFallbackCapabilities: ProcurementProviderCapabilities = {
  supportsAutomatedSearch: false,
  supportsAutomatedOrder: false,
  supportsManualQuoteCapture: true,
  supportsManualOrderFallback: true
};

export const repairLinkFallbackCapabilities: ProcurementProviderCapabilities = {
  supportsAutomatedSearch: false,
  supportsAutomatedOrder: false,
  supportsManualQuoteCapture: true,
  supportsManualOrderFallback: true
};

export const amazonBusinessFallbackCapabilities: ProcurementProviderCapabilities = {
  supportsAutomatedSearch: false,
  supportsAutomatedOrder: false,
  supportsManualQuoteCapture: true,
  supportsManualOrderFallback: true
};

export function getPartsTechFallbackReason() {
  return "Automated PartsTech API endpoints are not confirmed in official documentation for this codebase. Use the PartsTech account as a tracked manual fallback until partner API details are configured.";
}

export function getRepairLinkFallbackReason() {
  return "Automated RepairLink API endpoints are not confirmed in official documentation for this codebase. Use RepairLink as a VIN-linked OEM handoff with manual quote capture or manual ordering until documented automation is available.";
}

export function getAmazonBusinessFallbackReason() {
  return "Amazon Business supplies purchasing is configured through the procurement provider layer, but unsupported or unconfirmed automation falls back to manual capture or link-out instead of guessing undocumented flows.";
}

export function buildManualQuoteResult(
  quote: ProcurementProviderQuoteResult["quote"],
  lines: ProcurementProviderQuoteResult["lines"] = [],
  message = getPartsTechFallbackReason()
): ProcurementProviderQuoteResult {
  return {
    status: "manual_required",
    message,
    capabilities: partsTechFallbackCapabilities,
    quote,
    lines
  };
}

export function buildManualOrderResult(
  order: ProcurementProviderOrderResult["order"],
  lines: ProcurementProviderOrderResult["lines"] = [],
  message = getPartsTechFallbackReason()
): ProcurementProviderOrderResult {
  return {
    status: "manual_required",
    message,
    order,
    lines
  };
}
