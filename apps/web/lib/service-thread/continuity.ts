import {
  isTechnicianActiveFieldJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { CustomerAddress, JobListItem } from "@mobile-mechanic/types";

import type {
  VisitPromiseSummary,
  VisitReadinessSummary,
  VisitTrustSummary
} from "../jobs/operational-health";

export type ContinuityTone = "brand" | "danger" | "neutral" | "success" | "warning";

export type CommercialAccountMode = "fleet_account" | "retail_customer";

export type ReleaseRunwayState =
  | {
      copy: string;
      label: "Not ready";
      state: "not_ready";
      tone: ContinuityTone;
    }
  | {
      copy: string;
      label: "Ready for release";
      state: "ready_for_release";
      tone: ContinuityTone;
    }
  | {
      copy: string;
      label: "Placement in progress";
      state: "placement_in_progress";
      tone: ContinuityTone;
    }
  | {
      copy: string;
      label: "Placed";
      state: "placed";
      tone: ContinuityTone;
    };

export type PromiseConfidenceSnapshot = {
  confidencePercent: number;
  copy: string;
  label: string;
  level: "strong" | "watch" | "weak";
  recommendedAction: VisitPromiseSummary["recommendedAction"];
  tone: ContinuityTone;
};

export type RouteConfidenceSnapshot = {
  confidencePercent: number;
  copy: string;
  label: string;
  level: "strong" | "watch" | "weak";
  tone: ContinuityTone;
};

export type ServiceSiteThreadSummary = {
  activeVisitCount: number;
  copy: string;
  dominantIssueLabel: string;
  facts: string[];
  label: string;
  linkedAssetCount: number;
  linkedVisitCount: number;
  playbookState: "missing" | "ready";
  primaryContact: string | null;
  siteLabel: string;
  tone: ContinuityTone;
};

export type ActiveServiceThread = {
  actions: Array<{
    href: string;
    id: "closeout" | "customer" | "dispatch" | "finance" | "release_runway" | "site" | "visit";
    label: string;
  }>;
  commercialAccountMode: CommercialAccountMode;
  drawerTargets: Array<{
    href: string;
    id:
      | "estimate_file"
      | "invoice_file"
      | "site_context"
      | "supply_blocker"
      | "technician_context"
      | "visit_file";
    label: string;
  }>;
  continuity: {
    promiseConfidence: PromiseConfidenceSnapshot | null;
    releaseRunway: ReleaseRunwayState | null;
    routeConfidence: RouteConfidenceSnapshot | null;
    serviceSiteThread: ServiceSiteThreadSummary | null;
    trust: {
      copy: string;
      label: string;
      nextActionLabel: string;
      tone: ContinuityTone;
    } | null;
  };
  customer: {
    href: string | null;
    id: string | null;
    label: string;
  } | null;
  estimate: {
    href: string | null;
    id: string | null;
    label: string;
    status: string | null;
  } | null;
  invoice: {
    balanceLabel: string | null;
    href: string | null;
    id: string | null;
    label: string;
    status: string | null;
  } | null;
  jobId: string | null;
  kind: "customer" | "invoice" | "visit";
  nextMove: {
    copy: string;
    href: string;
    label: string;
    tone: ContinuityTone;
  } | null;
  primaryDesk: {
    href: string;
    id: "customers" | "dispatch" | "finance" | "fleet" | "supply" | "visits";
    label: string;
  };
  site: {
    href: string | null;
    id: string | null;
    label: string;
  } | null;
  title: string;
  vehicleOrUnit: {
    href: string | null;
    id: string | null;
    kind: "customer_vehicle" | "fleet_unit" | "unknown";
    label: string;
  } | null;
};

type ServiceSiteInput = Pick<
  CustomerAddress,
  | "accessWindowNotes"
  | "gateCode"
  | "id"
  | "label"
  | "line1"
  | "parkingNotes"
  | "serviceContactName"
  | "serviceContactPhone"
  | "siteName"
> | null | undefined;

type ServiceSitePlaybookInput = Pick<
  CustomerAddress,
  | "accessWindowNotes"
  | "gateCode"
  | "parkingNotes"
  | "serviceContactName"
  | "serviceContactPhone"
> | null | undefined;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getServiceSiteLabel(site: ServiceSiteInput) {
  if (!site) {
    return "No service site";
  }

  return site.siteName ?? site.label ?? site.line1 ?? "Service site";
}

export function hasServiceSitePlaybook(site: ServiceSitePlaybookInput) {
  return Boolean(
    site?.accessWindowNotes ||
      site?.gateCode ||
      site?.parkingNotes ||
      site?.serviceContactName ||
      site?.serviceContactPhone
  );
}

export function deriveReleaseRunwayState(input: {
  estimateStatus: string | null | undefined;
  hasBlockingIssues: boolean;
  hasOwner: boolean;
  hasPromise: boolean;
  readinessReadyCount: number;
  readinessTotalCount: number;
  visitStatus: Pick<JobListItem, "status">["status"] | null | undefined;
}): ReleaseRunwayState {
  const isPlaced =
    input.visitStatus === "completed" ||
    (input.visitStatus ? isTechnicianActiveFieldJobStatus(input.visitStatus) : false);

  if (isPlaced) {
    return {
      copy: "Work is already on the board and the release runway should now yield to live route control.",
      label: "Placed",
      state: "placed",
      tone: "success"
    };
  }

  if (input.estimateStatus !== "approved" && input.estimateStatus !== "accepted") {
    return {
      copy: "Approval is not clear yet, so the release runway should stay attached to estimate follow-through.",
      label: "Not ready",
      state: "not_ready",
      tone: "warning"
    };
  }

  if (input.hasBlockingIssues || !input.hasOwner || !input.hasPromise || input.readinessReadyCount < input.readinessTotalCount) {
    return {
      copy: "Approval is clear, but owner, promise, or readiness gaps are still blocking dispatch placement.",
      label: "Not ready",
      state: "not_ready",
      tone: "warning"
    };
  }

  if (input.visitStatus === "scheduled") {
    return {
      copy: "Owner, promise, and readiness are clear. The next move is placing this work onto the live route board.",
      label: "Ready for release",
      state: "ready_for_release",
      tone: "brand"
    };
  }

  return {
    copy: "Approval and readiness are clear, and the thread is actively being staged into dispatch.",
    label: "Placement in progress",
    state: "placement_in_progress",
    tone: "brand"
  };
}

export function derivePromiseConfidenceSnapshot(input: {
  hasServiceSitePlaybook: boolean;
  hasSupplyRisk: boolean;
  promiseSummary: Pick<
    VisitPromiseSummary,
    "confidencePercent" | "copy" | "recommendedAction"
  >;
  readinessSummary: Pick<VisitReadinessSummary, "readyCount" | "score" | "totalCount">;
  releaseRunwayState: ReleaseRunwayState | null;
  trustSummary: Pick<VisitTrustSummary, "risk">;
}) {
  let score = input.promiseSummary.confidencePercent;

  if (!input.hasServiceSitePlaybook) {
    score -= 12;
  }

  if (input.hasSupplyRisk) {
    score -= 14;
  }

  if (input.readinessSummary.totalCount > 0) {
    const readinessPercent =
      (input.readinessSummary.readyCount / input.readinessSummary.totalCount) * 100;
    score = Math.round((score * 0.7) + (readinessPercent * 0.3));
  }

  if (input.trustSummary.risk === "high") {
    score -= 10;
  } else if (input.trustSummary.risk === "watch") {
    score -= 5;
  }

  if (input.releaseRunwayState?.state === "not_ready") {
    score -= 8;
  }

  const confidencePercent = clampPercent(score);

  if (confidencePercent >= 75) {
    return {
      confidencePercent,
      copy: input.promiseSummary.copy,
      label: "Strong promise confidence",
      level: "strong" as const,
      recommendedAction: input.promiseSummary.recommendedAction,
      tone: "success" as const
    };
  }

  if (confidencePercent >= 45) {
    return {
      confidencePercent,
      copy: input.promiseSummary.copy,
      label: "Watch promise confidence",
      level: "watch" as const,
      recommendedAction: input.promiseSummary.recommendedAction,
      tone: "warning" as const
    };
  }

  return {
    confidencePercent,
    copy: input.promiseSummary.copy,
    label: "Weak promise confidence",
    level: "weak" as const,
    recommendedAction: input.promiseSummary.recommendedAction,
    tone: "danger" as const
  };
}

export function deriveRouteConfidenceSnapshot(input: {
  hasLiveGps: boolean;
  hasPartsConfidence: boolean;
  hasServiceSitePlaybook: boolean;
  hasTechnicianReadiness: boolean;
  laneSlackMinutes: number | null;
  promiseConfidencePercent: number;
  routeIssueCount: number;
}) {
  let score = input.promiseConfidencePercent;

  if (!input.hasLiveGps) {
    score -= 25;
  }

  if (!input.hasServiceSitePlaybook) {
    score -= 12;
  }

  if (!input.hasPartsConfidence) {
    score -= 14;
  }

  if (!input.hasTechnicianReadiness) {
    score -= 14;
  }

  if ((input.laneSlackMinutes ?? 0) <= 0) {
    score -= 16;
  } else if ((input.laneSlackMinutes ?? 0) <= 30) {
    score -= 8;
  }

  score -= input.routeIssueCount * 9;

  const confidencePercent = clampPercent(score);

  if (confidencePercent >= 75) {
    return {
      confidencePercent,
      copy: "GPS, site readiness, lane slack, parts confidence, and technician readiness are aligned.",
      label: "Strong route confidence",
      level: "strong" as const,
      tone: "success" as const
    };
  }

  if (confidencePercent >= 45) {
    return {
      confidencePercent,
      copy: "The route is still viable, but it needs closer monitoring before more work is committed.",
      label: "Watch route confidence",
      level: "watch" as const,
      tone: "warning" as const
    };
  }

  return {
    confidencePercent,
    copy: "Route confidence is degraded by missing GPS, site readiness, route slack, or technician readiness.",
    label: "Weak route confidence",
    level: "weak" as const,
    tone: "danger" as const
  };
}

export function deriveVisitRouteConfidenceSnapshot(input: {
  assignedTechnicianUserId: string | null | undefined;
  hasServiceSitePlaybook: boolean;
  hasSupplyRisk: boolean;
  promiseConfidencePercent: number;
  visitStatus: Pick<JobListItem, "status">["status"] | null | undefined;
}) {
  const hasOwner = Boolean(input.assignedTechnicianUserId);
  const liveRoute = input.visitStatus ? isTechnicianActiveFieldJobStatus(input.visitStatus) : false;
  const travelRoute = input.visitStatus ? isTechnicianTravelJobStatus(input.visitStatus) : false;

  return deriveRouteConfidenceSnapshot({
    hasLiveGps: liveRoute ? hasOwner : true,
    hasPartsConfidence: !input.hasSupplyRisk,
    hasServiceSitePlaybook: input.hasServiceSitePlaybook,
    hasTechnicianReadiness: hasOwner || input.visitStatus === "completed" || input.visitStatus === "canceled",
    laneSlackMinutes:
      input.visitStatus === "new"
        ? 15
        : input.visitStatus === "scheduled"
          ? 45
          : travelRoute
            ? 30
            : 60,
    promiseConfidencePercent: input.promiseConfidencePercent,
    routeIssueCount:
      (hasOwner || input.visitStatus === "completed" || input.visitStatus === "canceled" ? 0 : 1) +
      (input.hasServiceSitePlaybook ? 0 : 1) +
      (input.hasSupplyRisk ? 1 : 0)
  });
}

export function buildServiceSiteThreadSummary(input: {
  activeVisitCount: number;
  commercialAccountMode: CommercialAccountMode;
  linkedAssetCount: number;
  linkedVisitCount: number;
  siteFailureCount?: number;
  site: ServiceSiteInput;
}) {
  const playbookReady = hasServiceSitePlaybook(input.site);
  const siteLabel = getServiceSiteLabel(input.site);
  const primaryContact =
    input.site?.serviceContactName ?? input.site?.serviceContactPhone ?? null;
  const facts = [
    input.site?.accessWindowNotes ? "Access window live" : null,
    input.site?.gateCode ? "Gate code saved" : null,
    input.site?.parkingNotes ? "Parking notes saved" : null,
    primaryContact ? "Site contact ready" : null,
    input.activeVisitCount ? `${input.activeVisitCount} active visit${input.activeVisitCount === 1 ? "" : "s"}` : null,
    input.linkedAssetCount ? `${input.linkedAssetCount} linked asset${input.linkedAssetCount === 1 ? "" : "s"}` : null,
    input.linkedVisitCount > 1 ? `${input.linkedVisitCount} linked visits` : null
  ].filter((fact): fact is string => Boolean(fact));
  const siteFailureCount = input.siteFailureCount ?? 0;
  const dominantIssueLabel = !input.site
    ? "No anchored site"
    : !playbookReady
      ? "Missing site playbook"
      : siteFailureCount > 0
        ? `${siteFailureCount} repeat site issue${siteFailureCount === 1 ? "" : "s"}`
        : input.activeVisitCount > 1
          ? "Multi-visit pressure"
          : "Site thread stable";

  if (!input.site) {
    return {
      activeVisitCount: 0,
      copy:
        input.commercialAccountMode === "fleet_account"
          ? "Recurring fleet and account work needs a true site thread before access memory and parked-unit context stop leaking into notes."
          : "Anchor the thread to a service site so access memory, parking patterns, and repeat-location context stop living in notes.",
      dominantIssueLabel,
      facts,
      label: "No service site thread",
      linkedAssetCount: input.linkedAssetCount,
      linkedVisitCount: input.linkedVisitCount,
      playbookState: "missing" as const,
      primaryContact: null,
      siteLabel,
      tone: "warning" as const
    };
  }

  if (playbookReady) {
    return {
      activeVisitCount: input.activeVisitCount,
      copy:
        siteFailureCount > 0
          ? "Site memory is attached, but repeat friction at this location should stay visible before the next route commitment."
          : input.activeVisitCount > 0
            ? "Site memory, access context, and active visit pressure are all attached to the same execution thread."
            : "Site memory is attached and ready for the next recurring visit.",
      dominantIssueLabel,
      facts,
      label: "Site thread live",
      linkedAssetCount: input.linkedAssetCount,
      linkedVisitCount: input.linkedVisitCount,
      playbookState: "ready" as const,
      primaryContact,
      siteLabel,
      tone: "success" as const
    };
  }

  return {
    activeVisitCount: input.activeVisitCount,
    copy: "The location is anchored, but access memory is still too thin for a reliable field handoff.",
    dominantIssueLabel,
    facts,
    label: "Site playbook needed",
    linkedAssetCount: input.linkedAssetCount,
    linkedVisitCount: input.linkedVisitCount,
    playbookState: "missing" as const,
    primaryContact,
    siteLabel,
    tone: "warning" as const
  };
}
