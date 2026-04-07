import * as Location from "expo-location";

import type { MobileAppContext } from "../../lib/app-context";
import { clientStorage } from "../../lib/client-storage";
import { platformOS } from "../../lib/platform-os";
import { supabase } from "../../lib/supabase";
import {
  clearQueuedLocationPings,
  enqueueLocationPing,
  flushQueuedLocationPings,
  type LocationPingPayload
} from "./offline-location-ping-queue";
import { loadWorkdayTrackingPolicy, type WorkdayTrackingPolicy } from "./workday-location-policy";

export const WORKDAY_LOCATION_TASK_NAME = "mobile-mechanic-workday-location";

type StoredTrackingContext = {
  companyId: string;
  companyTimeZone: string | null;
  technicianUserId: string;
  workdayDate: string | null;
  workdayEndsAt: string | null;
  workdayStartsAt: string | null;
};

const TRACKING_CONTEXT_KEY = "workday-location-tracking-context";
const LAST_SHARED_AT_KEY = "workday-location-last-shared-at";
const supportsWorkdayLocationTasks =
  platformOS !== "web" &&
  typeof Location.hasStartedLocationUpdatesAsync === "function" &&
  typeof Location.startLocationUpdatesAsync === "function" &&
  typeof Location.stopLocationUpdatesAsync === "function";

const WORKDAY_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  activityType: Location.ActivityType.AutomotiveNavigation,
  deferredUpdatesInterval: 60_000,
  distanceInterval: 50,
  foregroundService: {
    killServiceOnDestroy: false,
    notificationBody:
      "Dispatch can see your live position while your workday tracker is running.",
    notificationColor: "#1f4ca8",
    notificationTitle: "Mobile Mechanic workday tracking"
  },
  mayShowUserSettingsDialog: true,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  timeInterval: 60_000
};

async function ensureAuthenticatedSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Sign back into the mobile app before sharing background location.");
  }
}

function buildLocationPingPayload({
  companyId,
  location,
  technicianUserId
}: {
  companyId: string;
  location: Location.LocationObject;
  technicianUserId: string;
}): LocationPingPayload {
  const { coords, timestamp } = location;

  return {
    accuracyMeters: coords.accuracy ?? null,
    altitudeMeters: coords.altitude ?? null,
    capturedAt: new Date(timestamp).toISOString(),
    companyId,
    headingDegrees: Number.isFinite(coords.heading) ? coords.heading : null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    speedMetersPerSecond: Number.isFinite(coords.speed) ? coords.speed : null,
    technicianUserId
  };
}

async function insertLocationPing(payload: LocationPingPayload) {
  const result = await supabase.from("technician_location_pings").insert({
    accuracy_meters: payload.accuracyMeters,
    altitude_meters: payload.altitudeMeters,
    captured_at: payload.capturedAt,
    company_id: payload.companyId,
    heading_degrees: payload.headingDegrees,
    latitude: payload.latitude,
    longitude: payload.longitude,
    source: "mobile_app",
    speed_meters_per_second: payload.speedMetersPerSecond,
    technician_user_id: payload.technicianUserId
  });

  if (result.error) {
    throw result.error;
  }

  await clientStorage.setItem(LAST_SHARED_AT_KEY, payload.capturedAt);
}

async function persistLocationPingPayload(payload: LocationPingPayload) {
  await ensureAuthenticatedSession();
  await flushQueuedLocationPings(insertLocationPing);

  try {
    await insertLocationPing(payload);
    return {
      queued: false as const
    };
  } catch (error) {
    const queuedCount = await enqueueLocationPing(payload);

    return {
      queued: true as const,
      queuedCount,
      reason: error
    };
  }
}

export async function persistLocationPing({
  companyId,
  location,
  technicianUserId
}: {
  companyId: string;
  location: Location.LocationObject;
  technicianUserId: string;
}) {
  return persistLocationPingPayload(
    buildLocationPingPayload({
      companyId,
      location,
      technicianUserId
    })
  );
}

export async function persistLocationPingBatch({
  companyId,
  locations,
  technicianUserId
}: {
  companyId: string;
  locations: Location.LocationObject[];
  technicianUserId: string;
}) {
  await ensureAuthenticatedSession();
  await flushQueuedLocationPings(insertLocationPing);

  const uniquePayloads = locations
    .slice()
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((location) =>
      buildLocationPingPayload({
        companyId,
        location,
        technicianUserId
      })
    )
    .filter((payload, index, array) => {
      const previous = array[index - 1];

      return !previous || previous.capturedAt !== payload.capturedAt;
    });

  let queuedCount = 0;

  for (const payload of uniquePayloads) {
    try {
      await insertLocationPing(payload);
    } catch {
      queuedCount = await enqueueLocationPing(payload);

      for (const remainingPayload of uniquePayloads.slice(uniquePayloads.indexOf(payload) + 1)) {
        queuedCount = await enqueueLocationPing(remainingPayload);
      }

      return {
        queued: true as const,
        queuedCount
      };
    }
  }

  return {
    queued: false as const,
    queuedCount
  };
}

export async function flushPendingWorkdayLocationPings() {
  await ensureAuthenticatedSession();
  return flushQueuedLocationPings(insertLocationPing);
}

export async function loadWorkdayTrackingContext(): Promise<StoredTrackingContext | null> {
  const rawValue = await clientStorage.getItem(TRACKING_CONTEXT_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredTrackingContext;

    if (!parsed.companyId || !parsed.technicianUserId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function saveWorkdayTrackingContext(context: StoredTrackingContext) {
  await clientStorage.setItem(TRACKING_CONTEXT_KEY, JSON.stringify(context));
}

async function clearWorkdayTrackingContext() {
  await clientStorage.removeItem(TRACKING_CONTEXT_KEY);
  await clientStorage.removeItem(LAST_SHARED_AT_KEY);
}

export async function loadWorkdayLastSharedAt() {
  return clientStorage.getItem(LAST_SHARED_AT_KEY);
}

async function hasRequiredWorkdayLocationPermissions() {
  if (!supportsWorkdayLocationTasks) {
    return false;
  }

  const [foregroundPermission, backgroundPermission] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync()
  ]);

  return (
    foregroundPermission.status === Location.PermissionStatus.GRANTED &&
    backgroundPermission.status === Location.PermissionStatus.GRANTED
  );
}

async function requestWorkdayLocationPermissions() {
  if (!supportsWorkdayLocationTasks) {
    throw new Error("Workday location tracking is not supported in the web preview.");
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    throw new Error("Turn on location services on this device before starting workday tracking.");
  }

  const foregroundPermission = await Location.getForegroundPermissionsAsync();
  const nextForegroundPermission =
    foregroundPermission.status === Location.PermissionStatus.GRANTED
      ? foregroundPermission
      : await Location.requestForegroundPermissionsAsync();

  if (nextForegroundPermission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error(
      "Foreground location permission is required before workday tracking can start."
    );
  }

  const backgroundPermission = await Location.getBackgroundPermissionsAsync();
  const nextBackgroundPermission =
    backgroundPermission.status === Location.PermissionStatus.GRANTED
      ? backgroundPermission
      : await Location.requestBackgroundPermissionsAsync();

  if (nextBackgroundPermission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error(
      "Background location permission is required so dispatch can see your position while the app is in the background."
    );
  }
}

export async function isWorkdayLocationTrackingActive() {
  if (!supportsWorkdayLocationTasks) {
    return false;
  }

  return Location.hasStartedLocationUpdatesAsync(WORKDAY_LOCATION_TASK_NAME);
}

function buildWorkdayNotAvailableMessage(policy: WorkdayTrackingPolicy) {
  if (policy.blockingBlock) {
    return `${policy.blockingBlock.title} is blocking technician work right now, so workday tracking will stay off until that block ends.`;
  }

  if (!policy.workdayStartsAt || !policy.workdayEndsAt) {
    return "Workday tracking is off because dispatch hours are not active right now.";
  }

  return "Workday tracking only runs during the technician's active dispatch hours.";
}

async function saveTrackingContextFromPolicy(
  appContext: MobileAppContext,
  policy: WorkdayTrackingPolicy
) {
  await saveWorkdayTrackingContext({
    companyId: appContext.companyId,
    companyTimeZone: policy.companyTimeZone,
    technicianUserId: appContext.userId,
    workdayDate: policy.localDate,
    workdayEndsAt: policy.workdayEndsAt,
    workdayStartsAt: policy.workdayStartsAt
  });
}

export async function startWorkdayLocationTracking(
  appContext: MobileAppContext,
  options?: {
    requestPermissions?: boolean | undefined;
    schedulePolicy?: WorkdayTrackingPolicy | undefined;
  }
) {
  if (!supportsWorkdayLocationTasks) {
    throw new Error("Workday location tracking is not supported in the web preview.");
  }

  const schedulePolicy = options?.schedulePolicy ?? (await loadWorkdayTrackingPolicy(appContext));

  if (!schedulePolicy.shouldTrackNow) {
    throw new Error(buildWorkdayNotAvailableMessage(schedulePolicy));
  }

  if (options?.requestPermissions === false) {
    if (!(await hasRequiredWorkdayLocationPermissions())) {
      throw new Error("Background location permission is still required before workday tracking can auto-start.");
    }
  } else {
    await requestWorkdayLocationPermissions();
  }

  await saveTrackingContextFromPolicy(appContext, schedulePolicy);

  if (await isWorkdayLocationTrackingActive()) {
    await Location.stopLocationUpdatesAsync(WORKDAY_LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(WORKDAY_LOCATION_TASK_NAME, WORKDAY_LOCATION_OPTIONS);

  const currentLocation = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: true
  });

  await persistLocationPing({
    companyId: appContext.companyId,
    location: currentLocation,
    technicianUserId: appContext.userId
  });

  return new Date(currentLocation.timestamp).toISOString();
}

export async function syncWorkdayLocationTrackingWithSchedule(appContext: MobileAppContext) {
  const schedulePolicy = await loadWorkdayTrackingPolicy(appContext);

  if (!supportsWorkdayLocationTasks) {
    return {
      action: "unchanged" as const,
      policy: schedulePolicy
    };
  }

  const trackingActive = await isWorkdayLocationTrackingActive();

  if (trackingActive) {
    await saveTrackingContextFromPolicy(appContext, schedulePolicy);
  }

  if (trackingActive && schedulePolicy.shouldStopRunningNow) {
    await stopWorkdayLocationTracking();
    return {
      action: "stopped" as const,
      policy: schedulePolicy
    };
  }

  if (!trackingActive && schedulePolicy.shouldAutoStartNow && (await hasRequiredWorkdayLocationPermissions())) {
    await startWorkdayLocationTracking(appContext, {
      requestPermissions: false,
      schedulePolicy
    });
    return {
      action: "started" as const,
      policy: schedulePolicy
    };
  }

  if (trackingActive) {
    await flushPendingWorkdayLocationPings();
  }

  return {
    action: "unchanged" as const,
    policy: schedulePolicy
  };
}

export async function stopWorkdayLocationTracking(options?: { clearPendingPings?: boolean | undefined }) {
  if (supportsWorkdayLocationTasks && (await isWorkdayLocationTrackingActive())) {
    await Location.stopLocationUpdatesAsync(WORKDAY_LOCATION_TASK_NAME);
  }

  await clearWorkdayTrackingContext();

  if (options?.clearPendingPings) {
    await clearQueuedLocationPings();
  }
}
