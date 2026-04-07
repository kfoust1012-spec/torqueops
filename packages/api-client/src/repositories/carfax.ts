import type {
  Database,
  UpsertVehicleCarfaxSummaryInput,
  VehicleCarfaxSummary
} from "@mobile-mechanic/types";
import {
  carfaxReportSummarySchema,
  upsertVehicleCarfaxSummaryInputSchema,
  vehicleCarfaxSummarySchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type VehicleCarfaxSummaryRow = Database["public"]["Tables"]["vehicle_carfax_summaries"]["Row"];

function mapVehicleCarfaxSummaryRow(row: VehicleCarfaxSummaryRow): VehicleCarfaxSummary {
  return vehicleCarfaxSummarySchema.parse({
    source: "carfax",
    vehicleId: row.vehicle_id,
    vin: row.vin_snapshot,
    status: row.status,
    summary: row.summary ? carfaxReportSummarySchema.parse(row.summary) : null,
    fetchedAt: row.fetched_at,
    lastAttemptedAt: row.last_attempted_at,
    nextEligibleRefreshAt: row.next_eligible_refresh_at,
    lastErrorMessage: row.last_error_message
  });
}

export async function getVehicleCarfaxSummaryByVehicleId(
  client: AppSupabaseClient,
  vehicleId: string
) {
  const result = await client
    .from("vehicle_carfax_summaries")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .maybeSingle<VehicleCarfaxSummaryRow>();

  return {
    ...result,
    data: result.data ? mapVehicleCarfaxSummaryRow(result.data) : null
  };
}

export async function listVehicleCarfaxSummariesByVehicleIds(
  client: AppSupabaseClient,
  vehicleIds: string[]
) {
  if (!vehicleIds.length) {
    return {
      data: [] as VehicleCarfaxSummary[],
      error: null
    };
  }

  const result = await client
    .from("vehicle_carfax_summaries")
    .select("*")
    .in("vehicle_id", vehicleIds)
    .returns<VehicleCarfaxSummaryRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapVehicleCarfaxSummaryRow) : null
  };
}

export async function upsertVehicleCarfaxSummary(
  client: AppSupabaseClient,
  input: UpsertVehicleCarfaxSummaryInput
) {
  const parsed = upsertVehicleCarfaxSummaryInputSchema.parse(input);
  const lastAttemptedAt = parsed.lastAttemptedAt ?? new Date().toISOString();
  const nextEligibleRefreshAt = parsed.nextEligibleRefreshAt ?? lastAttemptedAt;
  const result = await client
    .from("vehicle_carfax_summaries")
    .upsert(
      {
        company_id: parsed.companyId,
        vehicle_id: parsed.vehicleId,
        vin_snapshot: parsed.vin,
        status: parsed.status,
        summary: parsed.summary,
        fetched_at: parsed.fetchedAt ?? null,
        last_attempted_at: lastAttemptedAt,
        next_eligible_refresh_at: nextEligibleRefreshAt,
        last_error_message: parsed.lastErrorMessage ?? null
      },
      {
        onConflict: "vehicle_id"
      }
    )
    .select("*")
    .single<VehicleCarfaxSummaryRow>();

  return {
    ...result,
    data: result.data ? mapVehicleCarfaxSummaryRow(result.data) : null
  };
}
