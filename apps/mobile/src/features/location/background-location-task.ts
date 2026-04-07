import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import {
  loadWorkdayTrackingContext,
  persistLocationPingBatch,
  stopWorkdayLocationTracking,
  WORKDAY_LOCATION_TASK_NAME
} from "./workday-location-service";

type LocationTaskPayload = {
  locations?: Location.LocationObject[];
};

if (!TaskManager.isTaskDefined(WORKDAY_LOCATION_TASK_NAME)) {
  TaskManager.defineTask(
    WORKDAY_LOCATION_TASK_NAME,
    async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskPayload>) => {
      if (error) {
        return;
      }

      const trackingContext = await loadWorkdayTrackingContext();

      if (!trackingContext) {
        return;
      }

      if (
        trackingContext.workdayEndsAt &&
        Date.now() >= new Date(trackingContext.workdayEndsAt).getTime()
      ) {
        await stopWorkdayLocationTracking();
        return;
      }

      const nextLocations = (data?.locations ?? []).filter(Boolean);

      if (!nextLocations.length) {
        return;
      }

      try {
        await persistLocationPingBatch({
          companyId: trackingContext.companyId,
          locations: nextLocations,
          technicianUserId: trackingContext.technicianUserId
        });
      } catch {
        return;
      }
    }
  );
}
