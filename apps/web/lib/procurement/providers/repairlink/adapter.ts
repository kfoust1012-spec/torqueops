import {
  getRepairLinkFallbackReason,
  repairLinkFallbackCapabilities,
  REPAIRLINK_LOGIN_URL
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
import { getRepairLinkAutomationAvailability } from "./client";
import { buildRepairLinkProviderSearchContext } from "./mapping";

function buildMissingCredentialMessage() {
  return "Save a RepairLink username and password before using this integration.";
}

function hasRepairLinkCredentials(account: ProcurementProviderAdapterAccount) {
  return Boolean(
    account.credentials?.username?.trim() && account.credentials?.password?.trim()
  );
}

function getRepairLinkFallbackMode(account: ProcurementProviderAdapterAccount) {
  const settingsJson = account.settingsJson;

  if (
    settingsJson &&
    typeof settingsJson === "object" &&
    !Array.isArray(settingsJson) &&
    settingsJson.defaultFallbackMode === "manual_link_out"
  ) {
    return "manual_link_out" as const;
  }

  return "manual_capture" as const;
}

export const repairLinkAdapter: ProcurementProviderAdapter = {
  provider: "repairlink",
  getCapabilities() {
    return repairLinkFallbackCapabilities;
  },
  async verifyConnection(account): Promise<ProcurementProviderVerificationResult> {
    if (!hasRepairLinkCredentials(account)) {
      return {
        status: "error",
        message: buildMissingCredentialMessage(),
        capabilities: repairLinkFallbackCapabilities,
        lastErrorMessage: buildMissingCredentialMessage()
      };
    }

    const availability = getRepairLinkAutomationAvailability();

    return {
      status: "connected",
      message: availability.reason,
      capabilities: repairLinkFallbackCapabilities,
      lastErrorMessage: null
    };
  },
  async searchOffers(
    input: ProcurementProviderSearchContextInput
  ): Promise<ProcurementProviderSearchResult> {
    const fallbackMode = getRepairLinkFallbackMode(input.account);
    const message = hasRepairLinkCredentials(input.account)
      ? getRepairLinkFallbackReason()
      : buildMissingCredentialMessage();

    if (!input.vehicle.vin?.trim()) {
      return {
        status: "failed",
        message: "RepairLink sourcing requires a VIN before creating an OEM search session.",
        capabilities: repairLinkFallbackCapabilities,
        lines: [],
        metadata: {
          fallbackMode,
          loginUrl: REPAIRLINK_LOGIN_URL,
          provider: "repairlink"
        } as Json
      };
    }

    if (!input.selectedSupplierMappingIds?.length) {
      return {
        status: "failed",
        message: "Select at least one active RepairLink dealer mapping before starting an OEM search session.",
        capabilities: repairLinkFallbackCapabilities,
        lines: [],
        metadata: {
          fallbackMode,
          loginUrl: REPAIRLINK_LOGIN_URL,
          provider: "repairlink"
        } as Json
      };
    }

    return {
      status: "manual_required",
      message,
      capabilities: repairLinkFallbackCapabilities,
      lines: [],
      metadata: {
        fallbackMode,
        loginUrl: REPAIRLINK_LOGIN_URL,
        provider: "repairlink",
        searchContext: {
          ...buildRepairLinkProviderSearchContext(input),
          fallbackMode
        }
      } as unknown as Json
    };
  },
  async submitOrder(
    input: ProcurementProviderOrderContextInput
  ): Promise<ProcurementProviderOrderSubmissionResult> {
    const message = hasRepairLinkCredentials(input.account)
      ? getRepairLinkFallbackReason()
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
        loginUrl: REPAIRLINK_LOGIN_URL,
        poNumber: input.purchaseOrder.poNumber,
        purchaseOrderId: input.purchaseOrder.id
      } as Json,
      rawResponseJson: {
        fallbackMode: "manual_order",
        loginUrl: REPAIRLINK_LOGIN_URL,
        provider: "repairlink"
      } as Json,
      lastErrorMessage: hasRepairLinkCredentials(input.account)
        ? message
        : buildMissingCredentialMessage(),
      providerOrderReference: null
    };
  }
};
