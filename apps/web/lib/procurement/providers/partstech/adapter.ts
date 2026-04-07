import {
  getPartsTechFallbackReason,
  partsTechFallbackCapabilities
} from "@mobile-mechanic/core";
import type { Json } from "@mobile-mechanic/types";

import type {
  ProcurementProviderAdapter,
  ProcurementProviderAdapterAccount,
  ProcurementProviderOrderContextInput,
  ProcurementProviderOrderSubmissionResult,
  ProcurementProviderSearchContextInput,
  ProcurementProviderSearchResult,
  ProcurementProviderVerificationResult
} from "../types";
import { getPartsTechAutomationAvailability } from "./client";
import { buildPartsTechSearchContext } from "./mapping";

function buildMissingCredentialMessage() {
  return "Save a PartsTech username and API key before using this integration.";
}

function hasPartsTechCredentials(account: ProcurementProviderAdapterAccount) {
  return Boolean(
    account.credentials?.username?.trim() && account.credentials?.apiKey?.trim()
  );
}

export const partsTechAdapter: ProcurementProviderAdapter = {
  provider: "partstech",
  getCapabilities() {
    return partsTechFallbackCapabilities;
  },
  async verifyConnection(account): Promise<ProcurementProviderVerificationResult> {
    if (!hasPartsTechCredentials(account)) {
      return {
        status: "error",
        message: buildMissingCredentialMessage(),
        capabilities: partsTechFallbackCapabilities,
        lastErrorMessage: buildMissingCredentialMessage()
      };
    }

    const availability = getPartsTechAutomationAvailability();

    return {
      status: availability.supportsDocumentedApiAutomation ? "connected" : "action_required",
      message: availability.reason,
      capabilities: partsTechFallbackCapabilities,
      lastErrorMessage: availability.supportsDocumentedApiAutomation
        ? null
        : availability.reason
    };
  },
  async searchOffers(
    input: ProcurementProviderSearchContextInput
  ): Promise<ProcurementProviderSearchResult> {
    const message = hasPartsTechCredentials(input.account)
      ? getPartsTechFallbackReason()
      : buildMissingCredentialMessage();
    const searchContext = buildPartsTechSearchContext(input);

    return {
      status: "manual_required",
      message,
      capabilities: partsTechFallbackCapabilities,
      lines: [],
      metadata: {
        fallbackMode: "manual_capture",
        provider: "partstech",
        searchContext
      } as unknown as Json
    };
  },
  async submitOrder(
    input: ProcurementProviderOrderContextInput
  ): Promise<ProcurementProviderOrderSubmissionResult> {
    const message = hasPartsTechCredentials(input.account)
      ? getPartsTechFallbackReason()
      : buildMissingCredentialMessage();

    return {
      status: "manual_required",
      message,
      lineResults: input.purchaseOrderLines.map((line) => ({
        purchaseOrderLineId: line.id,
        providerQuoteLineId: line.providerQuoteLineId,
        quantity: line.quantityOrdered,
        unitPriceCents: line.unitOrderedCostCents,
        rawResponseJson: {
          fallbackMode: "manual_order",
          supplierPartNumber: line.supplierPartNumber
        } as Json
      })),
      manualFallbackReason: message,
      rawRequestJson: {
        poNumber: input.purchaseOrder.poNumber,
        purchaseOrderId: input.purchaseOrder.id
      } as Json,
      rawResponseJson: {
        fallbackMode: "manual_order",
        provider: "partstech"
      } as Json,
      lastErrorMessage: hasPartsTechCredentials(input.account) ? message : buildMissingCredentialMessage(),
      providerOrderReference: null
    };
  }
};
