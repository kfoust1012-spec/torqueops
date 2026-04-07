import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import type { MobileAppContext } from "../../lib/app-context";
import {
  isWorkdayLocationTrackingActive,
  loadWorkdayLastSharedAt,
  loadWorkdayTrackingContext,
  startWorkdayLocationTracking,
  stopWorkdayLocationTracking
} from "./workday-location-service";

type LocationSharingStatus = "idle" | "starting" | "sharing" | "error";

type LiveLocationSharingState = {
  errorMessage: string | null;
  isSharing: boolean;
  lastSharedAt: string | null;
  permissionStatus: Location.PermissionStatus | null;
  status: LocationSharingStatus;
};

export function useLiveLocationSharing(appContext: MobileAppContext | null) {
  const [state, setState] = useState<LiveLocationSharingState>({
    errorMessage: null,
    isSharing: false,
    lastSharedAt: null,
    permissionStatus: null,
    status: "idle"
  });

  const refreshStatus = useCallback(async () => {
    const [trackingActive, trackingContext, lastSharedAt, foregroundPermission, backgroundPermission] =
      await Promise.all([
        isWorkdayLocationTrackingActive(),
        loadWorkdayTrackingContext(),
        loadWorkdayLastSharedAt(),
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync()
      ]);

    const matchesCurrentUser =
      Boolean(appContext) &&
      trackingContext?.companyId === appContext?.companyId &&
      trackingContext?.technicianUserId === appContext?.userId;

    setState((current) => ({
      ...current,
      errorMessage: null,
      isSharing: trackingActive && matchesCurrentUser,
      lastSharedAt,
      permissionStatus:
        backgroundPermission.status === Location.PermissionStatus.GRANTED
          ? backgroundPermission.status
          : foregroundPermission.status,
      status: trackingActive && matchesCurrentUser ? "sharing" : "idle"
    }));
  }, [appContext]);

  const stopSharing = useCallback(async () => {
    await stopWorkdayLocationTracking();
    setState((current) => ({
      ...current,
      errorMessage: null,
      isSharing: false,
      lastSharedAt: null,
      status: "idle"
    }));
  }, []);

  const startSharing = useCallback(async () => {
    if (!appContext) {
      return;
    }

    setState((current) => ({
      ...current,
      errorMessage: null,
      status: "starting"
    }));

    try {
      const lastSharedAt = await startWorkdayLocationTracking(appContext);
      setState((current) => ({
        ...current,
        errorMessage: null,
        isSharing: true,
        lastSharedAt,
        permissionStatus: Location.PermissionStatus.GRANTED,
        status: "sharing"
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage:
          error instanceof Error ? error.message : "Unable to start workday location tracking.",
        isSharing: false,
        status: "error"
      }));
    }
  }, [appContext]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshStatus();
      }
    });

    (async () => {
      try {
        await refreshStatus();
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setState((current) => ({
          ...current,
          errorMessage:
            error instanceof Error ? error.message : "Unable to read workday tracking status.",
          isSharing: false,
          status: "error"
        }));
      }
    })();

    intervalId = setInterval(() => {
      void refreshStatus();
    }, 30_000);

    return () => {
      isMounted = false;
      appStateSubscription.remove();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!appContext) {
      void stopSharing();
    }
  }, [appContext, stopSharing]);

  return {
    ...state,
    startSharing,
    stopSharing
  };
}
