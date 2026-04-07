import {
  buildLaborGuideSignalSearchText,
  buildLaborGuideSearchText,
  countMatchedSignals,
  getLaborGuideVehicleLabel,
  tokenizeLaborGuideText
} from "@mobile-mechanic/core";
import type {
  EstimateLineItem,
  LaborGuideConfidenceLevel,
  LaborGuideContext,
  LaborGuideSuggestionResult,
  LaborGuideSuggestedOperation
} from "@mobile-mechanic/types";
import { laborGuideContextSchema, laborGuideSuggestionResultSchema } from "@mobile-mechanic/validation";

import { curatedLaborGuideRules } from "./catalog";
import { buildSuggestedLaborLineItemDefaults } from "./mapping";

function getConfidenceLevel(matchCount: number, highConfidenceSignals: number): LaborGuideConfidenceLevel {
  if (matchCount >= highConfidenceSignals) {
    return "high";
  }

  if (matchCount > 1) {
    return "medium";
  }

  return "low";
}

function normalizeSuggestedOperationName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function filterSuggestedOperationsAgainstExistingLineItems(
  result: LaborGuideSuggestionResult,
  lineItems: Array<Pick<EstimateLineItem, "itemType" | "name">>
): LaborGuideSuggestionResult {
  if (result.status !== "ready" || !result.operations.length) {
    return result;
  }

  const existingLaborNames = new Set(
    lineItems
      .filter((lineItem) => lineItem.itemType === "labor")
      .map((lineItem) => normalizeSuggestedOperationName(lineItem.name))
  );

  if (!existingLaborNames.size) {
    return result;
  }

  const operations = result.operations.filter(
    (operation) => !existingLaborNames.has(normalizeSuggestedOperationName(operation.name))
  );

  if (operations.length === result.operations.length) {
    return result;
  }

  if (!operations.length) {
    const filteredResult: LaborGuideSuggestionResult = {
      status: "no_match",
      source: result.source,
      operations: [],
      warnings: [
        "Matching labor suggestions are already on this estimate. Edit the existing line items if you need to adjust time or pricing.",
        ...result.warnings
      ]
    };

    laborGuideSuggestionResultSchema.parse(filteredResult);

    return filteredResult;
  }

  const filteredResult: LaborGuideSuggestionResult = {
    ...result,
    operations,
    warnings: [
      "Suggestions already added to this estimate were hidden to avoid duplicate labor line items.",
      ...result.warnings
    ]
  };

  laborGuideSuggestionResultSchema.parse(filteredResult);

  return filteredResult;
}

export function suggestLaborOperations(input: LaborGuideContext): LaborGuideSuggestionResult {
  laborGuideContextSchema.parse(input);
  const context: LaborGuideContext = {
    ...input,
    estimateId: input.estimateId ?? null,
    vehicle: {
      ...input.vehicle,
      trim: input.vehicle.trim ?? null,
      engine: input.vehicle.engine ?? null,
      vin: input.vehicle.vin ?? null
    }
  };
  const searchText = buildLaborGuideSignalSearchText(context);
  const searchTokens = tokenizeLaborGuideText(searchText);
  const fullContextText = buildLaborGuideSearchText(context);

  if (searchTokens.length < 2) {
    const result: LaborGuideSuggestionResult = {
      status: "no_match",
      source: "curated-rules",
      operations: [],
      warnings: ["Add the job symptoms or requested service to get more useful labor suggestions."]
    };

    laborGuideSuggestionResultSchema.parse(result);

    return result;
  }

  const operations = curatedLaborGuideRules
    .map((rule) => {
      const matchedSignals = countMatchedSignals(searchText, rule.signals);
      const minimumSignals = rule.minimumSignals ?? 1;

      if (matchedSignals.length < minimumSignals) {
        return null;
      }

      const specificityScore = matchedSignals.reduce(
        (score, signal) => score + normalizeSuggestedOperationName(signal).length,
        0
      );

      const suggestion: LaborGuideSuggestedOperation = {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        suggestedHours: rule.suggestedHours,
        confidence: getConfidenceLevel(matchedSignals.length, rule.highConfidenceSignals ?? 2),
        rationale: `${rule.rationale} Vehicle context: ${getLaborGuideVehicleLabel(context.vehicle) || "Unknown vehicle"}.`,
        matchedSignals,
        lineItemDefaults: buildSuggestedLaborLineItemDefaults({
          name: rule.name,
          description: rule.description,
          suggestedHours: rule.suggestedHours,
          rationale: rule.rationale
        })
      };

      return {
        score: matchedSignals.length,
        specificityScore,
        context: fullContextText,
        suggestion
      };
    })
    .filter((candidate): candidate is {
      context: string;
      score: number;
      specificityScore: number;
      suggestion: LaborGuideSuggestedOperation;
    } =>
      Boolean(candidate)
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.specificityScore - left.specificityScore ||
        right.suggestion.suggestedHours - left.suggestion.suggestedHours
    )
    .slice(0, 5)
    .map((candidate) => candidate.suggestion);

  if (!operations.length) {
    const result: LaborGuideSuggestionResult = {
      status: "no_match",
      source: "curated-rules",
      operations: [],
      warnings: [
        "No labor suggestions matched this job yet. Manual line items are still available and remain the source of truth."
      ]
    };

    laborGuideSuggestionResultSchema.parse(result);

    return result;
  }

  const result: LaborGuideSuggestionResult = {
    status: "ready",
    source: "curated-rules",
    operations,
    warnings: [
      "Suggested hours are assistive only. Confirm pricing, scope, and parts coverage before sending the estimate."
    ]
  };

  laborGuideSuggestionResultSchema.parse(result);

  return result;
}
