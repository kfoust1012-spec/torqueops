import { getDispatchCalendarSettings, listTechnicianAvailabilityBlocks } from "@mobile-mechanic/api-client";
import {
  getDispatchLocalDate,
  getDispatchRange,
  getSafeTimeZone,
  zonedLocalDateTimeToUtc
} from "@mobile-mechanic/core";
import type { TechnicianAvailabilityBlock } from "@mobile-mechanic/types";

import type { MobileAppContext } from "../../lib/app-context";
import { supabase } from "../../lib/supabase";

type DispatchHoursSettings = {
  dayEndHour: number;
  dayStartHour: number;
  showSaturday: boolean;
  showSunday: boolean;
};

export type WorkdayTrackingPolicy = {
  blockingBlock: TechnicianAvailabilityBlock | null;
  companyTimeZone: string;
  localDate: string;
  shouldAutoStartNow: boolean;
  shouldStopRunningNow: boolean;
  shouldTrackNow: boolean;
  workdayEndsAt: string | null;
  workdayStartsAt: string | null;
};

const DEFAULT_DISPATCH_HOURS: DispatchHoursSettings = {
  dayEndHour: 19,
  dayStartHour: 7,
  showSaturday: true,
  showSunday: false
};

function getDispatchHoursSettings(
  settings: Awaited<ReturnType<typeof getDispatchCalendarSettings>>["data"]
): DispatchHoursSettings {
  if (!settings) {
    return DEFAULT_DISPATCH_HOURS;
  }

  return {
    dayEndHour: settings.dayEndHour,
    dayStartHour: settings.dayStartHour,
    showSaturday: settings.showSaturday,
    showSunday: settings.showSunday
  };
}

function isEnabledWorkday(date: Date, timeZone: string, settings: DispatchHoursSettings) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short"
  }).format(date);

  if (weekday === "Sat") {
    return settings.showSaturday;
  }

  if (weekday === "Sun") {
    return settings.showSunday;
  }

  return true;
}

function findCurrentBlockingBlock(
  blocks: TechnicianAvailabilityBlock[],
  now: Date
): TechnicianAvailabilityBlock | null {
  return (
    blocks.find((block) => {
      if (!["time_off", "unavailable"].includes(block.blockType)) {
        return false;
      }

      const startsAt = new Date(block.startsAt).getTime();
      const endsAt = new Date(block.endsAt).getTime();
      const nowMs = now.getTime();

      return nowMs >= startsAt && nowMs < endsAt;
    }) ?? null
  );
}

export async function loadWorkdayTrackingPolicy(
  appContext: MobileAppContext
): Promise<WorkdayTrackingPolicy> {
  const now = new Date();
  const companyTimeZone = getSafeTimeZone(appContext.company.timezone);
  const localDate = getDispatchLocalDate(now, companyTimeZone);
  const range = getDispatchRange(localDate, "day", companyTimeZone);
  const [settingsResult, availabilityResult] = await Promise.all([
    getDispatchCalendarSettings(supabase, appContext.companyId),
    listTechnicianAvailabilityBlocks(
      supabase,
      appContext.companyId,
      range.rangeStartAt,
      range.rangeEndAt,
      appContext.userId
    )
  ]);

  if (settingsResult.error) {
    throw settingsResult.error;
  }

  if (availabilityResult.error) {
    throw availabilityResult.error;
  }

  const settings = getDispatchHoursSettings(settingsResult.data);
  const enabledWorkday = isEnabledWorkday(now, companyTimeZone, settings);

  if (!enabledWorkday) {
    return {
      blockingBlock: null,
      companyTimeZone,
      localDate,
      shouldAutoStartNow: false,
      shouldStopRunningNow: true,
      shouldTrackNow: false,
      workdayEndsAt: null,
      workdayStartsAt: null
    };
  }

  const workdayStartsAt = zonedLocalDateTimeToUtc(
    `${localDate}T${settings.dayStartHour.toString().padStart(2, "0")}:00`,
    companyTimeZone
  ).toISOString();
  const workdayEndsAt = zonedLocalDateTimeToUtc(
    `${localDate}T${settings.dayEndHour.toString().padStart(2, "0")}:00`,
    companyTimeZone
  ).toISOString();
  const withinHours =
    now.getTime() >= new Date(workdayStartsAt).getTime() &&
    now.getTime() < new Date(workdayEndsAt).getTime();
  const blockingBlock = findCurrentBlockingBlock(availabilityResult.data ?? [], now);
  const shouldTrackNow = withinHours && !blockingBlock;

  return {
    blockingBlock,
    companyTimeZone,
    localDate,
    shouldAutoStartNow: shouldTrackNow,
    shouldStopRunningNow: !withinHours,
    shouldTrackNow,
    workdayEndsAt,
    workdayStartsAt
  };
}
