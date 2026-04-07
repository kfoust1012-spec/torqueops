import type { DispatchCalendarResource } from "@mobile-mechanic/types";

export type DispatchLaneHealthState = {
  label: "Conflict" | "Flow" | "Loaded" | "Open" | "Queued" | "Shaped" | "Tight" | "At risk";
  tone: "brand" | "danger" | "info" | "neutral" | "warning";
};

type DispatchLaneLoadInput = {
  availabilityCount: number;
  blockedPercent: number;
  conflictCount: number;
  utilizationPercent: number;
};

export function getDispatchLaneLoadState(input: DispatchLaneLoadInput): DispatchLaneHealthState {
  if (input.conflictCount > 0) {
    return { label: "Conflict", tone: "danger" };
  }

  if (input.utilizationPercent >= 88) {
    return { label: "Tight", tone: "warning" };
  }

  if (input.utilizationPercent >= 60) {
    return { label: "Loaded", tone: "brand" };
  }

  if (input.utilizationPercent >= 25) {
    return { label: "Flow", tone: "info" };
  }

  if (input.availabilityCount > 0 || input.blockedPercent >= 20) {
    return { label: "Shaped", tone: "neutral" };
  }

  return { label: "Open", tone: "neutral" };
}

export function getDispatchResourceLaneState(resource: Pick<DispatchCalendarResource, "availabilityBlockCount" | "backlogCount" | "conflictCount" | "scheduledCount">): DispatchLaneHealthState {
  if (resource.conflictCount > 0) {
    return { label: "At risk", tone: "danger" };
  }

  if (resource.backlogCount > 0) {
    return { label: "Queued", tone: "warning" };
  }

  if (resource.scheduledCount > 0) {
    return { label: "Loaded", tone: "brand" };
  }

  if (resource.availabilityBlockCount > 0) {
    return { label: "Shaped", tone: "neutral" };
  }

  return { label: "Open", tone: "neutral" };
}