import type {
  EstimateLineItem,
  EstimatePartsSummary,
  InvoiceLineItem,
  InvoicePartsSummary,
  JobPartsSummary,
  PartRequestLine
} from "@mobile-mechanic/types";

import { isPartRequestLineFulfilled } from "./status";

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function resolveDocumentLineCostCents(
  line: Pick<EstimateLineItem, "estimatedCostCents" | "actualCostCents"> | Pick<InvoiceLineItem, "estimatedCostCents" | "actualCostCents">
) {
  return line.actualCostCents ?? line.estimatedCostCents ?? 0;
}

export function resolveActualUnitCostCents(
  line: Pick<PartRequestLine, "actualUnitCostCents" | "quotedUnitCostCents" | "estimatedUnitCostCents">
) {
  return line.actualUnitCostCents ?? line.quotedUnitCostCents ?? line.estimatedUnitCostCents ?? 0;
}

export function calculateJobPartsSummary(
  requestLines: PartRequestLine[],
  estimateLineItems: Array<Pick<EstimateLineItem, "partRequestLineId" | "lineSubtotalCents">> = [],
  invoiceLineItems: Array<Pick<InvoiceLineItem, "partRequestLineId" | "lineSubtotalCents">> = [],
  actualCostCentsByRequestLineId: ReadonlyMap<string, number | null> = new Map()
): JobPartsSummary {
  const estimatedCostCents = sum(
    requestLines.map((line) =>
      Math.round((line.estimatedUnitCostCents ?? line.quotedUnitCostCents ?? 0) * line.quantityRequested)
    )
  );
  const actualCostCents = sum(
    requestLines.map((line) => {
      const snapshotActualCostCents = actualCostCentsByRequestLineId.get(line.id);
      if (typeof snapshotActualCostCents === "number") {
        return snapshotActualCostCents;
      }

      return Math.round(
        resolveActualUnitCostCents(line) * Math.max(line.quantityReceived - line.quantityReturned, 0)
      );
    })
  );
  const quotedCostCents = sum(
    requestLines.map((line) => Math.round((line.quotedUnitCostCents ?? 0) * line.quantityRequested))
  );
  const estimateSellByRequestLineId = new Map<string, number>();
  const invoiceSellByRequestLineId = new Map<string, number>();

  for (const line of estimateLineItems) {
    if (!line.partRequestLineId) {
      continue;
    }

    estimateSellByRequestLineId.set(
      line.partRequestLineId,
      (estimateSellByRequestLineId.get(line.partRequestLineId) ?? 0) + line.lineSubtotalCents
    );
  }

  for (const line of invoiceLineItems) {
    if (!line.partRequestLineId) {
      continue;
    }

    invoiceSellByRequestLineId.set(
      line.partRequestLineId,
      (invoiceSellByRequestLineId.get(line.partRequestLineId) ?? 0) + line.lineSubtotalCents
    );
  }

  const totalSellCents = sum(
    requestLines.map((line) => {
      const invoiceSell = invoiceSellByRequestLineId.get(line.id);
      if (typeof invoiceSell === "number") {
        return invoiceSell;
      }

      return estimateSellByRequestLineId.get(line.id) ?? 0;
    })
  );

  return {
    requestCount: new Set(requestLines.map((line) => line.partRequestId)).size,
    lineCount: requestLines.length,
    quotedCostCents,
    estimatedCostCents,
    actualCostCents,
    totalSellCents,
    grossProfitCents: totalSellCents - actualCostCents,
    openLineCount: requestLines.filter((line) => !isPartRequestLineFulfilled(line)).length,
    coreOutstandingCount: requestLines.filter((line) => line.quantityCoreDue > line.quantityCoreReturned).length
  };
}

export function calculateEstimatePartsSummary(
  estimateId: string,
  lineItems: Array<
    Pick<EstimateLineItem, "partRequestLineId" | "lineSubtotalCents" | "estimatedCostCents" | "actualCostCents">
  >
): EstimatePartsSummary {
  const linkedLineItems = lineItems.filter((line) => Boolean(line.partRequestLineId));
  const totalSellCents = sum(linkedLineItems.map((line) => line.lineSubtotalCents));
  const estimatedCostCents = sum(linkedLineItems.map((line) => line.estimatedCostCents));
  const actualCostCents = sum(linkedLineItems.map((line) => line.actualCostCents));
  const resolvedCostCents = sum(linkedLineItems.map(resolveDocumentLineCostCents));

  return {
    estimateId,
    linkedLineCount: linkedLineItems.length,
    estimatedCostCents,
    actualCostCents,
    totalSellCents,
    grossProfitCents: totalSellCents - resolvedCostCents
  };
}

export function calculateInvoicePartsSummary(
  invoiceId: string,
  lineItems: Array<
    Pick<InvoiceLineItem, "partRequestLineId" | "lineSubtotalCents" | "estimatedCostCents" | "actualCostCents">
  >
): InvoicePartsSummary {
  const linkedLineItems = lineItems.filter((line) => Boolean(line.partRequestLineId));
  const totalSellCents = sum(linkedLineItems.map((line) => line.lineSubtotalCents));
  const estimatedCostCents = sum(linkedLineItems.map((line) => line.estimatedCostCents));
  const actualCostCents = sum(linkedLineItems.map((line) => line.actualCostCents));
  const resolvedCostCents = sum(linkedLineItems.map(resolveDocumentLineCostCents));

  return {
    invoiceId,
    linkedLineCount: linkedLineItems.length,
    estimatedCostCents,
    actualCostCents,
    totalSellCents,
    grossProfitCents: totalSellCents - resolvedCostCents
  };
}
