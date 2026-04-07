import type {
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarJobEvent,
  DispatchCalendarSettings
} from "@mobile-mechanic/types";

import { getDispatchLocalDate, getSafeTimeZone } from "./scheduling";

type TrackPlacementInput = {
  id: string;
  startsAt: string;
  endsAt: string;
};

type TrackPlacementResult = {
  trackIndex: number;
  trackCount: number;
};

export function getMinutesIntoDispatchDay(input: {
  date: string;
  value: string;
  settings: DispatchCalendarSettings;
  timeZone: string;
}) {
  const timeZone = getSafeTimeZone(input.timeZone);
  const localDate = getDispatchLocalDate(input.value, timeZone);
  const sourceDate = localDate === input.date ? localDate : input.date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(input.value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  if (sourceDate !== input.date) {
    if (new Date(input.value).getTime() < new Date(`${input.date}T00:00:00.000Z`).getTime()) {
      return 0;
    }
  }

  return hour * 60 + minute - input.settings.dayStartHour * 60;
}

export function getDispatchDurationMinutes(startsAt: string, endsAt: string | null) {
  return Math.max(
    Math.round(
      (new Date(endsAt ?? startsAt).getTime() - new Date(startsAt).getTime()) / 60_000
    ),
    30
  );
}

export function summarizeLaneLoad(events: DispatchCalendarJobEvent[]) {
  return {
    scheduledCount: events.length,
    scheduledMinutes: events.reduce((total, event) => total + event.durationMinutes, 0)
  };
}

export function placeLaneEventsIntoTracks<T extends TrackPlacementInput>(events: T[]) {
  const sorted = [...events].sort((left, right) => {
    const leftStart = new Date(left.startsAt).getTime();
    const rightStart = new Date(right.startsAt).getTime();

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return new Date(left.endsAt).getTime() - new Date(right.endsAt).getTime();
  });
  const tracks: number[] = [];
  const placements = new Map<string, TrackPlacementResult>();

  for (const event of sorted) {
    const eventStart = new Date(event.startsAt).getTime();
    const eventEnd = new Date(event.endsAt).getTime();
    let nextTrackIndex = 0;

    while (
      nextTrackIndex < tracks.length
    ) {
      const trackEnd = tracks[nextTrackIndex];

      if (trackEnd === undefined || eventStart >= trackEnd || trackEnd === 0) {
        break;
      }

      nextTrackIndex += 1;
    }

    if (nextTrackIndex === tracks.length) {
      tracks.push(eventEnd);
    } else {
      tracks[nextTrackIndex] = eventEnd;
    }

    placements.set(event.id, {
      trackIndex: nextTrackIndex,
      trackCount: tracks.length
    });
  }

  return placements;
}

export function applyTrackPlacementToJobs(
  events: Omit<DispatchCalendarJobEvent, "trackIndex" | "trackCount">[]
) {
  const placements = placeLaneEventsIntoTracks(
    events.map((event) => ({
      id: event.id,
      startsAt: event.eventStartAt,
      endsAt: event.eventEndAt
    }))
  );

  return events.map((event) => ({
    ...event,
    trackIndex: placements.get(event.id)?.trackIndex ?? 0,
    trackCount: placements.get(event.id)?.trackCount ?? 1
  }));
}

export function applyTrackPlacementToAvailability(
  events: Omit<DispatchCalendarAvailabilityEvent, "trackIndex" | "trackCount">[]
) {
  const placements = placeLaneEventsIntoTracks(
    events.map((event) => ({
      id: event.id,
      startsAt: event.eventStartAt,
      endsAt: event.eventEndAt
    }))
  );

  return events.map((event) => ({
    ...event,
    trackIndex: placements.get(event.id)?.trackIndex ?? 0,
    trackCount: placements.get(event.id)?.trackCount ?? 1
  }));
}
