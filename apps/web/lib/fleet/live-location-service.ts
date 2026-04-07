import {
  listAssignableTechniciansByCompany,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import type { Database } from "@mobile-mechanic/types";

import type {
  FleetLiveDevice,
  FleetLiveTrackPoint,
  FleetTrackingState
} from "../../app/dashboard/fleet/_components/fleet-live-tracking";

type TechnicianLocationPingRow = Database["public"]["Tables"]["technician_location_pings"]["Row"];

const MAX_PING_LOOKBACK_HOURS = 24;
const TRACK_HISTORY_WINDOW_MINUTES = 60;
const MAX_TRACK_POINTS = 18;

function isMissingTechnicianLocationPingTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return (
    candidate.code === "PGRST205" ||
    message.includes("technician_location_pings") ||
    message.includes("schema cache")
  );
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "MM";
}

function buildTrackingHealth({
  accuracyMeters,
  lastPingMinutes
}: {
  accuracyMeters: number | null;
  lastPingMinutes: number | null;
}): {
  isFresh: boolean;
  trackingState: FleetTrackingState;
  trackingSummary: string;
} {
  if (lastPingMinutes === null) {
    return {
      isFresh: false,
      trackingState: "waiting",
      trackingSummary: "Waiting for first ping"
    };
  }

  if (lastPingMinutes > 15) {
    return {
      isFresh: false,
      trackingState: "offline",
      trackingSummary: `Offline ${lastPingMinutes}m`
    };
  }

  if (lastPingMinutes > 5) {
    return {
      isFresh: false,
      trackingState: "stale",
      trackingSummary: `Stale ${lastPingMinutes}m`
    };
  }

  if (accuracyMeters !== null && accuracyMeters > 80) {
    return {
      isFresh: true,
      trackingState: "limited",
      trackingSummary: `Low accuracy ${Math.round(accuracyMeters)}m`
    };
  }

  return {
    isFresh: true,
    trackingState: "live",
    trackingSummary: lastPingMinutes === 0 ? "Live now" : `${lastPingMinutes}m ago`
  };
}

function toTrackPoint(ping: TechnicianLocationPingRow): FleetLiveTrackPoint {
  return {
    accuracyMeters: ping.accuracy_meters,
    capturedAt: ping.captured_at,
    headingDegrees: ping.heading_degrees,
    latitude: ping.latitude,
    longitude: ping.longitude,
    speedMetersPerSecond: ping.speed_meters_per_second
  };
}

export async function listFleetLiveDevices(input: {
  companyId: string;
  supabase: AppSupabaseClient;
}) {
  const cutoffIso = new Date(Date.now() - MAX_PING_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const [techniciansResult, pingsResult] = await Promise.all([
    listAssignableTechniciansByCompany(input.supabase as never, input.companyId),
    input.supabase
      .from("technician_location_pings")
      .select("*")
      .eq("company_id", input.companyId)
      .gte("captured_at", cutoffIso)
      .order("captured_at", { ascending: false })
      .returns<TechnicianLocationPingRow[]>()
  ]);

  if (techniciansResult.error || !techniciansResult.data) {
    return {
      data: null,
      error: techniciansResult.error ?? new Error("Unable to load company technicians.")
    };
  }

  if (pingsResult.error) {
    if (isMissingTechnicianLocationPingTable(pingsResult.error)) {
      return {
        data: techniciansResult.data
          .map<FleetLiveDevice>((technician) => ({
            accuracyMeters: null,
            headingDegrees: null,
            initials: getInitials(technician.displayName),
            isFresh: false,
            lastPingAt: null,
            lastPingMinutes: null,
            latitude: null,
            longitude: null,
            name: technician.displayName,
            recentTrack: [],
            role: technician.role,
            speedMetersPerSecond: null,
            trackingState: "waiting",
            trackingSummary: "Live GPS not configured yet",
            userId: technician.userId
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        error: null
      };
    }

    return {
      data: null,
      error: pingsResult.error
    };
  }

  const latestPingByUserId = new Map<string, TechnicianLocationPingRow>();
  const recentTrackByUserId = new Map<string, FleetLiveTrackPoint[]>();
  const recentTrackCutoffTime = Date.now() - TRACK_HISTORY_WINDOW_MINUTES * 60 * 1000;

  for (const ping of pingsResult.data ?? []) {
    if (!latestPingByUserId.has(ping.technician_user_id)) {
      latestPingByUserId.set(ping.technician_user_id, ping);
    }

    if (new Date(ping.captured_at).getTime() < recentTrackCutoffTime) {
      continue;
    }

    const currentTrack = recentTrackByUserId.get(ping.technician_user_id) ?? [];

    if (currentTrack.length >= MAX_TRACK_POINTS) {
      continue;
    }

    currentTrack.push(toTrackPoint(ping));
    recentTrackByUserId.set(ping.technician_user_id, currentTrack);
  }

  const technicians = techniciansResult.data
    .map<FleetLiveDevice>((technician) => {
      const ping = latestPingByUserId.get(technician.userId) ?? null;
      const lastPingMinutes = ping
        ? Math.max(0, Math.round((Date.now() - new Date(ping.captured_at).getTime()) / 60_000))
        : null;
      const trackingHealth = buildTrackingHealth({
        accuracyMeters: ping?.accuracy_meters ?? null,
        lastPingMinutes
      });

      return {
        accuracyMeters: ping?.accuracy_meters ?? null,
        headingDegrees: ping?.heading_degrees ?? null,
        initials: getInitials(technician.displayName),
        isFresh: trackingHealth.isFresh,
        lastPingAt: ping?.captured_at ?? null,
        lastPingMinutes,
        latitude: ping?.latitude ?? null,
        longitude: ping?.longitude ?? null,
        name: technician.displayName,
        recentTrack: [...(recentTrackByUserId.get(technician.userId) ?? [])].reverse(),
        role: technician.role,
        speedMetersPerSecond: ping?.speed_meters_per_second ?? null,
        trackingState: trackingHealth.trackingState,
        trackingSummary: trackingHealth.trackingSummary,
        userId: technician.userId
      };
    })
    .sort((left, right) => {
      if (left.lastPingMinutes === null && right.lastPingMinutes === null) {
        return left.name.localeCompare(right.name);
      }

      if (left.lastPingMinutes === null) {
        return 1;
      }

      if (right.lastPingMinutes === null) {
        return -1;
      }

      if (left.lastPingMinutes !== right.lastPingMinutes) {
        return left.lastPingMinutes - right.lastPingMinutes;
      }

      return left.name.localeCompare(right.name);
    });

  return {
    data: technicians,
    error: null
  };
}
