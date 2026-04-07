import {
  buildAmazonBusinessSearchContext,
  buildAmazonBusinessSearchTerms
} from "@mobile-mechanic/core";
import type { AmazonBusinessSearchContext } from "@mobile-mechanic/types";

import type { ProcurementProviderSearchContextInput } from "../types";

export function buildAmazonBusinessProviderSearchContext(
  input: ProcurementProviderSearchContextInput
): AmazonBusinessSearchContext {
  const selectedPartRequestLineIds =
    input.selectedPartRequestLineIds?.length
      ? input.selectedPartRequestLineIds
      : input.lines.map((line) => line.id);

  return buildAmazonBusinessSearchContext({
    requestId: input.requestId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    lines: input.lines,
    selectedPartRequestLineIds,
    supplyListId: input.supplyListId ?? null,
    fallbackMode:
      input.account.settingsJson &&
      typeof input.account.settingsJson === "object" &&
      !Array.isArray(input.account.settingsJson) &&
      input.account.settingsJson.defaultFallbackMode === "manual_link_out"
        ? "manual_link_out"
        : "manual_capture"
  });
}

export function buildAmazonBusinessProviderSearchTerms(
  input: ProcurementProviderSearchContextInput
) {
  if (input.searchTerms?.length) {
    return input.searchTerms;
  }

  return buildAmazonBusinessSearchTerms(input.lines);
}
