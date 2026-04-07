import type { Json, UUID } from "./common";

export const carfaxSummaryStatuses = ["ready", "not_available", "provider_error"] as const;

export type CarfaxSummaryStatus = (typeof carfaxSummaryStatuses)[number];

export const carfaxHistoryFlagSeverities = ["info", "warning", "alert"] as const;

export type CarfaxHistoryFlagSeverity = (typeof carfaxHistoryFlagSeverities)[number];

export const carfaxHistoryFlagKinds = [
  "accident",
  "damage",
  "open_recall",
  "title_issue",
  "odometer_issue",
  "owner_history",
  "use_history"
] as const;

export type CarfaxHistoryFlagKind = (typeof carfaxHistoryFlagKinds)[number];

export interface CarfaxMaintenanceHighlight {
  label: string;
  details: string | null;
  performedAt: string | null;
  odometer: number | null;
}

export interface CarfaxHistoryFlag {
  kind: CarfaxHistoryFlagKind;
  severity: CarfaxHistoryFlagSeverity;
  label: string;
  details: string | null;
  reportedAt: string | null;
}

export interface CarfaxReportSummary {
  reportDate: string | null;
  ownerCount: number | null;
  openRecallCount: number | null;
  serviceRecordCount: number | null;
  accidentCount: number | null;
  damageCount: number | null;
  lastReportedOdometer: number | null;
  lastReportedAt: string | null;
  maintenanceHighlights: CarfaxMaintenanceHighlight[];
  historyFlags: CarfaxHistoryFlag[];
  warnings: string[];
}

export interface VehicleCarfaxSummary {
  source: "carfax";
  vehicleId: UUID;
  vin: string;
  status: CarfaxSummaryStatus;
  summary: CarfaxReportSummary | null;
  fetchedAt: string | null;
  lastAttemptedAt: string;
  nextEligibleRefreshAt: string;
  lastErrorMessage: string | null;
}

export interface UpsertVehicleCarfaxSummaryInput {
  companyId: UUID;
  vehicleId: UUID;
  vin: string;
  status: CarfaxSummaryStatus;
  summary: CarfaxReportSummary | null;
  fetchedAt?: string | null;
  lastAttemptedAt?: string;
  nextEligibleRefreshAt?: string;
  lastErrorMessage?: string | null;
}

export type CarfaxSummaryJson = Json;
