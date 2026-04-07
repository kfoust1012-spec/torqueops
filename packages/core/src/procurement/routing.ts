import type {
  PartRequestLine,
  SupplierAccount,
  SupplierRoutingRule
} from "@mobile-mechanic/types";

type RouteableContext = {
  jobPriority?: string | null;
  vehicleMake?: string | null;
};

export type RankedSupplierRoute = {
  score: number;
  supplierAccount: SupplierAccount;
  matchingRule: SupplierRoutingRule | null;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function matchesRule(
  requestLine: PartRequestLine,
  rule: SupplierRoutingRule,
  context: RouteableContext
) {
  const partDescription = normalize(requestLine.description) ?? "";
  const jobPriority = normalize(context.jobPriority);
  const vehicleMake = normalize(context.vehicleMake);

  if (rule.matchJobPriority && normalize(rule.matchJobPriority) !== jobPriority) {
    return false;
  }

  if (rule.matchVehicleMake && normalize(rule.matchVehicleMake) !== vehicleMake) {
    return false;
  }

  if (rule.matchHasCore !== null && rule.matchHasCore !== requestLine.needsCore) {
    return false;
  }

  if (rule.matchPartTerm && !partDescription.includes(normalize(rule.matchPartTerm) ?? "")) {
    return false;
  }

  return true;
}

export function evaluateSupplierRoutingRules(
  requestLine: PartRequestLine,
  supplierAccounts: SupplierAccount[],
  routingRules: SupplierRoutingRule[],
  context: RouteableContext = {}
) {
  return supplierAccounts
    .filter((account) => account.isActive)
    .map((supplierAccount) => {
      const matchingRules = routingRules
        .filter((rule) => rule.supplierAccountId === supplierAccount.id && rule.isActive)
        .filter((rule) => matchesRule(requestLine, rule, context))
        .sort((left, right) => left.priority - right.priority);

      return {
        matchingRule: matchingRules[0] ?? null,
        score: matchingRules[0] ? 10_000 - matchingRules[0].priority : 0,
        supplierAccount
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.supplierAccount.sortOrder - right.supplierAccount.sortOrder);
}

export function rankSuppliersForRequestLine(
  requestLine: PartRequestLine,
  supplierAccounts: SupplierAccount[],
  routingRules: SupplierRoutingRule[],
  context: RouteableContext = {}
): RankedSupplierRoute[] {
  return evaluateSupplierRoutingRules(requestLine, supplierAccounts, routingRules, context);
}

export function buildSupplierBucketKey(
  supplierAccount: SupplierAccount,
  route: RankedSupplierRoute | null
) {
  const ruleSuffix = route?.matchingRule ? `rule:${route.matchingRule.id}` : "manual";
  return `${supplierAccount.mode}:${supplierAccount.id}:${ruleSuffix}`;
}

export function groupRequestLinesIntoSupplierBuckets(
  requestLines: PartRequestLine[],
  supplierAccounts: SupplierAccount[],
  routingRules: SupplierRoutingRule[],
  contextByJobId: Record<string, RouteableContext> = {}
) {
  const buckets = new Map<
    string,
    {
      supplierAccount: SupplierAccount;
      route: RankedSupplierRoute | null;
      requestLines: PartRequestLine[];
    }
  >();
  const unmatchedLines: PartRequestLine[] = [];

  for (const requestLine of requestLines) {
    const ranked = rankSuppliersForRequestLine(
      requestLine,
      supplierAccounts,
      routingRules,
      contextByJobId[requestLine.jobId] ?? {}
    );
    const topRoute = ranked[0];

    if (!topRoute) {
      unmatchedLines.push(requestLine);
      continue;
    }

    const bucketKey = buildSupplierBucketKey(topRoute.supplierAccount, topRoute);
    const bucket = buckets.get(bucketKey);

    if (bucket) {
      bucket.requestLines.push(requestLine);
      continue;
    }

    buckets.set(bucketKey, {
      supplierAccount: topRoute.supplierAccount,
      route: topRoute,
      requestLines: [requestLine]
    });
  }

  return {
    buckets: Array.from(buckets.entries()).map(([bucketKey, bucket]) => ({
      bucketKey,
      ...bucket
    })),
    unmatchedLines
  };
}
