import type { AppRole, JobPriority, JobStatus } from "@mobile-mechanic/types";
import type {
  PromiseConfidenceSnapshot,
  RouteConfidenceSnapshot
} from "../../../../lib/service-thread/continuity";

export type FleetOperationalStatus = "en_route" | "on_job" | "idle" | "delayed" | "offline";

export type FleetRouteHealth = "healthy" | "watch" | "issue";

export type FleetMapPoint = {
  latitude: number;
  label: string;
  longitude: number;
};

export type FleetRouteMetrics = {
  available: boolean;
  distanceMiles: number;
  source: "direct" | "tomtom";
  trafficDelayMinutes: number;
  travelMinutes: number;
};

export type FleetSignalTone = "neutral" | "success" | "warning" | "danger" | "brand";

export type FleetStopView = {
  addressLabel: string;
  arrivalWindowEndAt: string | null;
  arrivalWindowStartAt: string | null;
  assignedTechnicianName: string | null;
  assignedTechnicianUserId: string | null;
  cityStateLabel: string;
  coords: FleetMapPoint | null;
  customerId: string;
  customerName: string;
  hasServiceSitePlaybook: boolean;
  id: string;
  isCurrent: boolean;
  isLate: boolean;
  isNext: boolean;
  isUnscheduled: boolean;
  jobId: string;
  priority: JobPriority;
  scheduledEndAt: string | null;
  scheduledLabel: string | null;
  scheduledStartAt: string | null;
  serviceSiteId: string | null;
  status: JobStatus;
  title: string;
  vehicleDisplayName: string;
  windowLabel: string | null;
};

export type FleetTechnicianView = {
  activeAvailabilityTitle: string | null;
  currentLocationLabel: string;
  currentStop: FleetStopView | null;
  email: string | null;
  id: string;
  initials: string;
  jobsRemaining: number;
  meetYourMechanicMissingFields: string[];
  meetYourMechanicReady: boolean;
  name: string;
  nextStop: FleetStopView | null;
  phone: string | null;
  role: AppRole;
  routeHealth: FleetRouteHealth;
  routeHealthLabel: string;
  routeIssueCount: number;
  routeStops: FleetStopView[];
  status: FleetOperationalStatus;
  vehicleLabel: string | null;
  vehicleUnit: string | null;
};

export type FleetCrewReadinessPacketSignal = {
  detail: string;
  label: string;
  tone: FleetSignalTone;
  value: string;
};

export type FleetCrewReadinessPacket = {
  currentLabel: string;
  headline: string;
  nextAction: string;
  nextLabel: string;
  promiseConfidence: PromiseConfidenceSnapshot | null;
  routeConfidence: RouteConfidenceSnapshot | null;
  signals: FleetCrewReadinessPacketSignal[];
  technicianName: string;
  unitLabel: string;
};

export type FleetWorkspaceData = {
  companyTimeZone: string;
  date: string;
  dateLabel: string;
  dayEndHour: number;
  generatedAt: string;
  isTodayView: boolean;
  liveDevices: import("./fleet-live-tracking").FleetLiveDevice[];
  queueJobs: FleetStopView[];
  technicians: FleetTechnicianView[];
  tomTomConfigured: boolean;
};

export function formatFleetMinutes(minutes: number) {
  if (minutes <= 0) {
    return "0m";
  }

  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;

  if (!hours) {
    return `${remainder}m`;
  }

  if (!remainder) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function formatFleetMiles(miles: number) {
  if (!Number.isFinite(miles)) {
    return "0 mi";
  }

  return `${miles.toFixed(miles >= 100 ? 0 : 1)} mi`;
}

export function getFleetOperationalStatusLabel(status: FleetOperationalStatus) {
  switch (status) {
    case "en_route":
      return "En route";
    case "on_job":
      return "On job";
    case "delayed":
      return "Behind";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

export function getFleetPriorityLabel(priority: JobPriority) {
  switch (priority) {
    case "urgent":
      return "Emergency";
    case "high":
      return "Priority";
    case "low":
      return "Low";
    default:
      return "Scheduled";
  }
}

export function getFleetRouteHealthTone(health: FleetRouteHealth) {
  switch (health) {
    case "issue":
      return "danger" as const;
    case "watch":
      return "warning" as const;
    default:
      return "success" as const;
  }
}
