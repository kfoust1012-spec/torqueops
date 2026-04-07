import { getAmazonBusinessFallbackReason } from "@mobile-mechanic/core";

export function getAmazonBusinessAutomationAvailability() {
  return {
    supportsDocumentedApiAutomation: false,
    reason: getAmazonBusinessFallbackReason()
  };
}
