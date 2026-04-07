import {
  AMAZON_BUSINESS_LINK_URL,
  buildAmazonBusinessHandoffMetadata,
  getAmazonBusinessFallbackMode,
  getAmazonBusinessFallbackReason,
  amazonBusinessFallbackCapabilities
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
import { getAmazonBusinessAutomationAvailability } from "./client";
import {
  buildAmazonBusinessProviderSearchContext,
  buildAmazonBusinessProviderSearchTerms
} from "./mapping";

function hasConfiguredAmazonFallback(account: ProcurementProviderAdapterAccount) {
  const settingsJson = account.settingsJson;

  if (!settingsJson || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
    return false;
  }

  return Boolean(
    typeof settingsJson.accountEmail === "string" &&
      settingsJson.accountEmail.trim() &&
      typeof settingsJson.region === "string" &&
      settingsJson.region.trim() &&
      typeof settingsJson.defaultSupplierAccountId === "string" &&
      settingsJson.defaultSupplierAccountId.trim()
  );
}

function buildMissingConfigurationMessage() {
  return "Save an Amazon Business account email, region, and default supplier account before using supply sourcing.";
}

export const amazonBusinessAdapter: ProcurementProviderAdapter = {
  provider: "amazon_business",
  getCapabilities() {
    return amazonBusinessFallbackCapabilities;
  },
  async verifyConnection(
    account: ProcurementProviderAdapterAccount
  ): Promise<ProcurementProviderVerificationResult> {
    if (!hasConfiguredAmazonFallback(account)) {
      return {
        status: "action_required",
        message: buildMissingConfigurationMessage(),
        capabilities: amazonBusinessFallbackCapabilities,
        lastErrorMessage: buildMissingConfigurationMessage()
      };
    }

    const availability = getAmazonBusinessAutomationAvailability();

    return {
      status: "connected",
      message: availability.reason,
      capabilities: amazonBusinessFallbackCapabilities,
      lastErrorMessage: null
    };
  },
  async searchOffers(
    input: ProcurementProviderSearchContextInput
  ): Promise<ProcurementProviderSearchResult> {
    const fallbackMode = getAmazonBusinessFallbackMode(
      input.account.settingsJson as Record<string, unknown> | null | undefined
    );
    const searchTerms = buildAmazonBusinessProviderSearchTerms(input);
    const message = hasConfiguredAmazonFallback(input.account)
      ? getAmazonBusinessFallbackReason()
      : buildMissingConfigurationMessage();

    return {
      status: "manual_required",
      message,
      capabilities: amazonBusinessFallbackCapabilities,
      lines: [],
      metadata: {
        fallbackMode,
        handoff: buildAmazonBusinessHandoffMetadata({
          manualReason: message,
          searchTerms,
          supplyListId: input.supplyListId ?? null
        }),
        linkOutUrl: AMAZON_BUSINESS_LINK_URL,
        provider: "amazon_business",
        searchContext: buildAmazonBusinessProviderSearchContext(input)
      } as unknown as Json
    };
  },
  async submitOrder(
    input: ProcurementProviderOrderContextInput
  ): Promise<ProcurementProviderOrderSubmissionResult> {
    const message = hasConfiguredAmazonFallback(input.account)
      ? getAmazonBusinessFallbackReason()
      : buildMissingConfigurationMessage();

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
        linkOutUrl: AMAZON_BUSINESS_LINK_URL,
        poNumber: input.purchaseOrder.poNumber,
        purchaseOrderId: input.purchaseOrder.id
      } as Json,
      rawResponseJson: {
        fallbackMode: "manual_order",
        linkOutUrl: AMAZON_BUSINESS_LINK_URL,
        provider: "amazon_business"
      } as Json,
      lastErrorMessage: hasConfiguredAmazonFallback(input.account)
        ? null
        : buildMissingConfigurationMessage(),
      providerOrderReference: null
    };
  }
};
