import type {
  AmazonBusinessAccountSettings,
  AmazonBusinessHandoffMetadata,
  AmazonBusinessSearchContext,
  PartRequestLine,
  ProcurementProviderAccount
} from "@mobile-mechanic/types";

export const AMAZON_BUSINESS_LINK_URL = "https://business.amazon.com/";

export function buildAmazonBusinessDisplayName(
  account?: Pick<ProcurementProviderAccount, "displayName"> | null
) {
  return account?.displayName?.trim() || "Amazon Business";
}

export function buildAmazonBusinessSearchTerms(
  lines: Array<Pick<PartRequestLine, "description" | "partNumber">>
) {
  const terms = new Set<string>();

  for (const line of lines) {
    const description = line.description.trim();
    if (description) {
      terms.add(description);
    }

    const partNumber = line.partNumber?.trim();
    if (partNumber) {
      terms.add(partNumber);
    }
  }

  return [...terms];
}

export function buildAmazonBusinessSearchContext(input: {
  estimateId?: string | null | undefined;
  jobId: string;
  lines: Array<Pick<PartRequestLine, "description" | "partNumber" | "id">>;
  requestId: string;
  searchTerms?: string[] | undefined;
  selectedPartRequestLineIds: string[];
  supplyListId?: string | null | undefined;
  fallbackMode?: "manual_capture" | "manual_link_out" | undefined;
}): AmazonBusinessSearchContext {
  return {
    requestId: input.requestId,
    jobId: input.jobId,
    estimateId: input.estimateId ?? null,
    searchTerms:
      input.searchTerms && input.searchTerms.length
        ? input.searchTerms
        : buildAmazonBusinessSearchTerms(input.lines),
    selectedPartRequestLineIds: input.selectedPartRequestLineIds,
    supplyListId: input.supplyListId ?? null,
    fallbackMode: input.fallbackMode ?? "manual_capture"
  };
}

export function buildAmazonBusinessHandoffMetadata(input: {
  manualReason: string;
  searchTerms: string[];
  supplyListId?: string | null | undefined;
}): AmazonBusinessHandoffMetadata {
  return {
    provider: "amazon_business",
    linkOutUrl: AMAZON_BUSINESS_LINK_URL,
    manualReason: input.manualReason,
    searchTerms: input.searchTerms,
    supplyListId: input.supplyListId ?? null
  };
}

export function getAmazonBusinessFallbackMode(
  settings:
    | Pick<AmazonBusinessAccountSettings, "defaultFallbackMode">
    | Record<string, unknown>
    | null
    | undefined
) {
  if (
    settings &&
    typeof settings === "object" &&
    "defaultFallbackMode" in settings &&
    settings.defaultFallbackMode === "manual_link_out"
  ) {
    return "manual_link_out" as const;
  }

  return "manual_capture" as const;
}
