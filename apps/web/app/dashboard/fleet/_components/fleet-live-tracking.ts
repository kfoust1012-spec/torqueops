import type { BadgeTone } from "../../../../components/ui";

import type { FleetMapPoint } from "./fleet-types";

export type FleetTrackingState = "live" | "limited" | "stale" | "offline" | "waiting";

export type FleetLiveTrackPoint = {
  accuracyMeters: number | null;
  capturedAt: string;
  headingDegrees: number | null;
  latitude: number;
  longitude: number;
  speedMetersPerSecond: number | null;
};

export type FleetLiveDevice = {
  accuracyMeters: number | null;
  headingDegrees: number | null;
  initials: string;
  isFresh: boolean;
  lastPingAt: string | null;
  lastPingMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  name: string;
  recentTrack: FleetLiveTrackPoint[];
  role: string;
  speedMetersPerSecond: number | null;
  trackingState: FleetTrackingState;
  trackingSummary: string;
  userId: string;
};

export function findLiveDeviceForTechnicianId(
  technicianUserId: string,
  liveDevices: FleetLiveDevice[]
) {
  return liveDevices.find((device) => device.userId === technicianUserId) ?? null;
}

export function getLiveDevicePoint(device: FleetLiveDevice | null): FleetMapPoint | null {
  if (!device || device.latitude === null || device.longitude === null) {
    return null;
  }

  return {
    label: device.trackingSummary,
    latitude: device.latitude,
    longitude: device.longitude
  };
}

export function getTrackingTone(state: FleetTrackingState): BadgeTone {
  switch (state) {
    case "live":
      return "success";
    case "limited":
    case "stale":
      return "warning";
    case "offline":
      return "danger";
    default:
      return "neutral";
  }
}

export function getTrackingStatusLabel(state: FleetTrackingState) {
  switch (state) {
    case "live":
      return "Live GPS";
    case "limited":
      return "Low accuracy";
    case "stale":
      return "Stale ping";
    case "offline":
      return "Offline";
    default:
      return "Waiting";
  }
}

export function getTrackingLabel(input: {
  fallbackLastPingMinutes: number | null;
  liveDevice: FleetLiveDevice | null;
}) {
  if (input.liveDevice) {
    return getTrackingStatusLabel(input.liveDevice.trackingState);
  }

  if (typeof input.fallbackLastPingMinutes === "number") {
    return input.fallbackLastPingMinutes <= 5 ? "Recent ping" : "Ping aging";
  }

  return "Waiting";
}
