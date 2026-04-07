import { getRepairLinkFallbackReason } from "@mobile-mechanic/core";

export function getRepairLinkAutomationAvailability() {
  return {
    supportsDocumentedApiAutomation: false,
    reason: getRepairLinkFallbackReason()
  };
}
