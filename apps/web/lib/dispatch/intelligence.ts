import type { DispatchBoardJobItem, DispatchCalendarResource } from "@mobile-mechanic/types";

type FieldLaneStop = {
  isLate: boolean;
};

type FieldLaneSignal = {
  activeAvailabilityTitle: string | null;
  jobsRemaining: number;
  nextStop: FieldLaneStop | null;
  routeHealth: "healthy" | "watch" | "issue";
  routeIssueCount: number;
  routeStops: FieldLaneStop[];
  status: "idle" | "offline" | "delayed" | "en_route" | "on_job";
};

export function getDispatchLaneOpportunityScore(resource: DispatchCalendarResource) {
  return (
    resource.conflictCount * 10_000 +
    resource.backlogCount * 2_000 +
    resource.scheduledCount * 200 +
    resource.scheduledMinutes
  );
}

export function getDispatchLanePressureScore(resource: DispatchCalendarResource) {
  return (
    resource.conflictCount * 10_000 +
    resource.backlogCount * 2_000 +
    resource.scheduledCount * 160 +
    resource.scheduledMinutes
  );
}

export function getDispatchLaneSuggestionCopy(
  visit: DispatchBoardJobItem,
  lane: DispatchCalendarResource | null
) {
  if (!lane) {
    return "No visible lane available right now";
  }

  if (visit.assignedTechnicianUserId && visit.assignedTechnicianUserId === lane.technicianUserId) {
    if (lane.conflictCount > 0) {
      return "Assigned lane needs cleanup first";
    }

    if (lane.backlogCount > 0) {
      return "Assigned lane still has waiting work";
    }

    return "Assigned lane is already visible";
  }

  if (lane.conflictCount === 0 && lane.backlogCount === 0 && lane.scheduledCount === 0) {
    return "Open lane now";
  }

  if (lane.conflictCount === 0 && lane.backlogCount === 0 && lane.scheduledCount <= 1) {
    return "Same-day insert likely";
  }

  if (lane.conflictCount === 0 && lane.backlogCount === 0) {
    return "Lowest-pressure visible lane";
  }

  if (lane.conflictCount === 0) {
    return "Lane can still absorb work with review";
  }

  return "Manual lane review needed";
}

export function getFieldLaneAttentionPriority(
  technician: FieldLaneSignal,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  let score = 0;

  if (technician.status === "offline") {
    score += 100;
  }

  if (technician.status === "delayed") {
    score += 70;
  }

  if (technician.routeHealth === "issue") {
    score += 60;
  } else if (technician.routeHealth === "watch") {
    score += 30;
  }

  if (!hasLiveDevice) {
    score += 18;
  }

  if (!technician.nextStop && waitingCount > 0) {
    score += 26;
  }

  if (technician.jobsRemaining === 0 && waitingCount > 0) {
    score += 20;
  }

  if (technician.status === "idle") {
    score += 10;
  }

  return score;
}

export function getFieldLaneCapacityScore(
  technician: FieldLaneSignal,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  if (!waitingCount) {
    return -100;
  }

  let score = 0;

  if (technician.status === "offline") score -= 120;
  if (technician.activeAvailabilityTitle) score -= 90;
  if (technician.status === "delayed") score -= 55;
  if (technician.routeHealth === "issue") score -= 45;
  if (technician.routeHealth === "watch") score -= 15;
  if (technician.routeStops.some((stop) => stop.isLate)) score -= 30;
  if (!hasLiveDevice) score -= 12;

  if (technician.status === "idle") score += 50;
  if (technician.jobsRemaining === 0) score += 42;
  if (!technician.nextStop) score += 24;
  if (technician.jobsRemaining <= 1) score += 16;
  if (hasLiveDevice) score += 10;
  if (technician.routeHealth === "healthy") score += 12;

  return score;
}

export function getFieldLaneCapacitySummary(technician: FieldLaneSignal) {
  if (technician.activeAvailabilityTitle) {
    return `${technician.activeAvailabilityTitle} is blocking same-day insertion.`;
  }

  if (technician.status === "offline") {
    return "Offline and not ready for same-day insertion.";
  }

  if (technician.status === "idle" || technician.jobsRemaining === 0 || !technician.nextStop) {
    return "Open lane with slack for same-day work.";
  }

  if (technician.routeHealth === "issue" || technician.routeStops.some((stop) => stop.isLate)) {
    return "Capacity exists, but the current route needs recovery before inserting more work.";
  }

  if (technician.jobsRemaining === 1) {
    return "One stop left and still flexible enough for a careful insert.";
  }

  return "Route still has room if timing and promise windows hold.";
}

export function getFieldLaneDriftSummary(technician: FieldLaneSignal, hasLiveDevice: boolean) {
  if (technician.status === "offline") {
    return { summary: "Offline and needs contact before route confidence can recover.", tone: "danger" as const };
  }

  if (!hasLiveDevice) {
    return { summary: "Missing live GPS, so route confidence is degraded.", tone: "warning" as const };
  }

  if (technician.routeStops.some((stop) => stop.isLate) || technician.status === "delayed") {
    return { summary: "Late work is already on this route and needs recovery action.", tone: "danger" as const };
  }

  if (technician.routeHealth === "issue") {
    return {
      summary: `${technician.routeIssueCount} route issues are pulling this lane off plan.`,
      tone: "danger" as const
    };
  }

  return { summary: "Watch the route timing before inserting more work.", tone: "warning" as const };
}

export function getFieldLanePriorityLabel(
  technician: FieldLaneSignal,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  if (technician.status === "offline") {
    return "Recover now";
  }

  if (technician.status === "delayed" || technician.routeHealth === "issue") {
    return "Route risk";
  }

  if (!hasLiveDevice) {
    return "Restore GPS";
  }

  if ((technician.jobsRemaining === 0 || technician.status === "idle" || !technician.nextStop) && waitingCount > 0) {
    return "Insert work";
  }

  if (technician.routeHealth === "watch") {
    return "Watch timing";
  }

  return "Stable lane";
}

export function getFieldLanePriorityCopy(
  technician: FieldLaneSignal,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  if (technician.status === "offline") {
    return "Call the tech and confirm route state before dispatch moves more work.";
  }

  if (technician.status === "delayed" || technician.routeHealth === "issue") {
    return "Use this lane for recovery before inserting anything new.";
  }

  if (!hasLiveDevice) {
    return "Live location is missing, so route confidence is degraded.";
  }

  if ((technician.jobsRemaining === 0 || technician.status === "idle" || !technician.nextStop) && waitingCount > 0) {
    return "Cleanest visible lane for same-day insertion right now.";
  }

  if (technician.routeHealth === "watch") {
    return "Timing is still viable, but this route needs closer monitoring.";
  }

  return "No immediate exception is visible on this lane.";
}

export function getFieldLaneInspectorAction(
  technician: FieldLaneSignal,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  if (technician.status === "offline") {
    return {
      title: "Recover technician contact",
      copy: "This lane is offline. Confirm contact and location before trusting the rest of the day.",
      tone: "danger" as const
    };
  }

  if (technician.status === "delayed" || technician.routeHealth === "issue") {
    return {
      title: "Stabilize route before inserting work",
      copy: "Late stops or route issues are already present. Recovery beats utilization on this lane.",
      tone: "warning" as const
    };
  }

  if (!hasLiveDevice) {
    return {
      title: "Restore live GPS confidence",
      copy: "The route may still be healthy, but dispatch is operating from stale field visibility.",
      tone: "warning" as const
    };
  }

  if ((technician.jobsRemaining === 0 || technician.status === "idle" || !technician.nextStop) && waitingCount > 0) {
    return {
      title: "Best lane for same-day insertion",
      copy: "This lane has the cleanest visible slack. Confirm promise window, then place the next waiting stop here.",
      tone: "success" as const
    };
  }

  return {
    title: "Hold and monitor",
    copy: "The lane is currently stable. Keep it moving unless queue pressure or route health changes.",
    tone: "default" as const
  };
}
