import { getPartsTechFallbackReason } from "@mobile-mechanic/core";

export function getPartsTechAutomationAvailability() {
  return {
    supportsDocumentedApiAutomation: false,
    reason: getPartsTechFallbackReason()
  };
}
