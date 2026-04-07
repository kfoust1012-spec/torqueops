import {
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { DispatchCalendarJobEvent } from "@mobile-mechanic/types";

import type { VisitPromiseSummary } from "../jobs/operational-health";

export type DispatchOnBoardPromiseSummary = Pick<
  VisitPromiseSummary,
  | "breachRisk"
  | "confidenceLabel"
  | "confidencePercent"
  | "copy"
  | "label"
  | "lastCustomerUpdateAt"
  | "lastCustomerUpdateLabel"
  | "nextUpdateLabel"
  | "owner"
  | "promisedAt"
  | "recommendedAction"
  | "tone"
>;

export type DispatchOnBoardFollowThroughItem = {
  job: DispatchCalendarJobEvent;
  lastCustomerUpdateAgeMinutes: number | null;
  promiseSummary: DispatchOnBoardPromiseSummary;
  riskScore: number;
};

export type DispatchLaneFollowThroughSummary = {
  attentionCount: number;
  dangerCount: number;
  highestRiskTone: DispatchOnBoardPromiseSummary["tone"] | "neutral";
  staleLabel: string;
  staleMinutes: number | null;
};

function getMinutesSince(value: string | null, now: Date) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(Math.round((now.getTime() - timestamp) / 60_000), 0);
}

function getToneRiskScore(tone: DispatchOnBoardPromiseSummary["tone"]) {
  switch (tone) {
    case "danger":
      return 420;
    case "warning":
      return 260;
    case "brand":
      return 170;
    case "success":
      return 40;
    default:
      return 0;
  }
}

function getBreachRiskScore(risk: DispatchOnBoardPromiseSummary["breachRisk"]) {
  switch (risk) {
    case "high":
      return 190;
    case "watch":
      return 95;
    default:
      return 0;
  }
}

function getRecommendedActionScore(
  action: DispatchOnBoardPromiseSummary["recommendedAction"]
) {
  switch (action) {
    case "en_route":
      return 160;
    case "dispatched":
      return 145;
    case "appointment_confirmation":
      return 120;
    case "set_promise":
      return 110;
    default:
      return 0;
  }
}

function getStatusRiskScore(status: DispatchCalendarJobEvent["status"]) {
  if (isTechnicianTravelJobStatus(status)) {
    return 70;
  }

  if (isTechnicianOnSiteJobStatus(status)) {
    return status === "waiting_approval" || status === "waiting_parts" ? 58 : 52;
  }

  switch (status) {
    case "scheduled":
      return 36;
    case "new":
      return 22;
    default:
      return 0;
  }
}

function getCustomerUpdateAgeRiskScore(
  ageMinutes: number | null,
  action: DispatchOnBoardPromiseSummary["recommendedAction"]
) {
  if (ageMinutes === null) {
    return action ? 96 : 32;
  }

  if (!action) {
    return Math.min(Math.round(ageMinutes / 30), 18);
  }

  if (ageMinutes >= 6 * 60) {
    return 92;
  }

  if (ageMinutes >= 2 * 60) {
    return 72;
  }

  if (ageMinutes >= 60) {
    return 50;
  }

  if (ageMinutes >= 20) {
    return 26;
  }

  return 0;
}

function getNextUpdateRiskScore(nextUpdateLabel: string) {
  if (nextUpdateLabel === "Due now") {
    return 115;
  }

  if (nextUpdateLabel.startsWith("Due in")) {
    return 44;
  }

  if (nextUpdateLabel === "Set promise first" || nextUpdateLabel === "Reset timing now") {
    return 70;
  }

  return 0;
}

export function getDispatchOnBoardFollowThroughRiskScore(input: {
  job: DispatchCalendarJobEvent;
  now?: Date;
  promiseSummary: DispatchOnBoardPromiseSummary;
}) {
  const now = input.now ?? new Date();
  const lastCustomerUpdateAgeMinutes = getMinutesSince(
    input.promiseSummary.lastCustomerUpdateAt,
    now
  );
  const confidenceGapScore = Math.max(100 - input.promiseSummary.confidencePercent, 0);

  return (
    getToneRiskScore(input.promiseSummary.tone) +
    getBreachRiskScore(input.promiseSummary.breachRisk) +
    getRecommendedActionScore(input.promiseSummary.recommendedAction) +
    getStatusRiskScore(input.job.status) +
    getCustomerUpdateAgeRiskScore(
      lastCustomerUpdateAgeMinutes,
      input.promiseSummary.recommendedAction
    ) +
    getNextUpdateRiskScore(input.promiseSummary.nextUpdateLabel) +
    confidenceGapScore
  );
}

export function buildDispatchOnBoardFollowThroughItems(input: {
  jobs: DispatchCalendarJobEvent[];
  now?: Date;
  promiseSummariesByJobId: Map<string, DispatchOnBoardPromiseSummary>;
}) {
  const now = input.now ?? new Date();

  return input.jobs
    .filter((job) => job.isActive && job.status !== "completed" && job.status !== "canceled")
    .map<DispatchOnBoardFollowThroughItem | null>((job) => {
      const promiseSummary = input.promiseSummariesByJobId.get(job.id);

      if (!promiseSummary) {
        return null;
      }

      const lastCustomerUpdateAgeMinutes = getMinutesSince(
        promiseSummary.lastCustomerUpdateAt,
        now
      );

      return {
        job,
        lastCustomerUpdateAgeMinutes,
        promiseSummary,
        riskScore: getDispatchOnBoardFollowThroughRiskScore({
          job,
          now,
          promiseSummary
        })
      };
    })
    .filter((item): item is DispatchOnBoardFollowThroughItem => Boolean(item))
    .sort((left, right) => {
      if (left.riskScore !== right.riskScore) {
        return right.riskScore - left.riskScore;
      }

      const leftAge = left.lastCustomerUpdateAgeMinutes ?? -1;
      const rightAge = right.lastCustomerUpdateAgeMinutes ?? -1;

      if (leftAge !== rightAge) {
        return rightAge - leftAge;
      }

      const leftPromise = left.promiseSummary.promisedAt
        ? Date.parse(left.promiseSummary.promisedAt)
        : Number.MAX_SAFE_INTEGER;
      const rightPromise = right.promiseSummary.promisedAt
        ? Date.parse(right.promiseSummary.promisedAt)
        : Number.MAX_SAFE_INTEGER;

      if (leftPromise !== rightPromise) {
        return leftPromise - rightPromise;
      }

      return left.job.title.localeCompare(right.job.title);
    });
}

export function getDispatchOnBoardFollowThroughActionLabel(
  action: DispatchOnBoardPromiseSummary["recommendedAction"]
) {
  switch (action) {
    case "appointment_confirmation":
      return "Confirm timing";
    case "dispatched":
      return "Send dispatched";
    case "en_route":
      return "Send en route";
    case "set_promise":
      return "Reset promise";
    default:
      return "Review thread";
  }
}

export function needsDispatchPromiseIntervention(
  summary: DispatchOnBoardPromiseSummary | null | undefined
) {
  return Boolean(
    summary?.recommendedAction && (summary.tone === "warning" || summary.tone === "danger")
  );
}

export function formatDispatchFollowThroughAgeLabel(minutes: number | null) {
  if (minutes === null) {
    return "No update logged";
  }

  if (minutes < 60) {
    return `Stale ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `Stale ${hours}h ${remainder}m` : `Stale ${hours}h`;
}

export function summarizeDispatchLaneFollowThrough(
  items: DispatchOnBoardFollowThroughItem[]
): DispatchLaneFollowThroughSummary {
  const attentionItems = items.filter((item) =>
    needsDispatchPromiseIntervention(item.promiseSummary)
  );
  const staleMinutes = attentionItems.reduce<number | null>((current, item) => {
    if (item.lastCustomerUpdateAgeMinutes === null) {
      return null;
    }

    if (current === null) {
      return current;
    }

    return Math.max(current, item.lastCustomerUpdateAgeMinutes);
  }, 0);
  const hasMissingCustomerUpdate = attentionItems.some(
    (item) => item.lastCustomerUpdateAgeMinutes === null
  );
  const highestRiskTone =
    attentionItems.some((item) => item.promiseSummary.tone === "danger")
      ? "danger"
      : attentionItems.some((item) => item.promiseSummary.tone === "warning")
        ? "warning"
        : "neutral";

  return {
    attentionCount: attentionItems.length,
    dangerCount: attentionItems.filter((item) => item.promiseSummary.tone === "danger").length,
    highestRiskTone,
    staleLabel: attentionItems.length
      ? hasMissingCustomerUpdate
        ? "No update logged"
        : formatDispatchFollowThroughAgeLabel(staleMinutes)
      : "No follow-through due",
    staleMinutes: attentionItems.length ? (hasMissingCustomerUpdate ? null : staleMinutes) : null
  };
}

export function getDispatchLaneFollowThroughPressureScore(
  summary: DispatchLaneFollowThroughSummary
) {
  const staleScore =
    summary.attentionCount === 0
      ? 0
      : summary.staleMinutes === null
        ? 96
        : Math.min(Math.round(summary.staleMinutes / 12), 84);

  return summary.dangerCount * 220 + (summary.attentionCount - summary.dangerCount) * 120 + staleScore;
}
