import {
  getVehicleById,
  getVehicleCarfaxSummaryByVehicleId,
  listVehicleCarfaxSummariesByVehicleIds,
  upsertVehicleCarfaxSummary,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import { isVinReadyForDecode, normalizeVinForDecode } from "@mobile-mechanic/core";
import type { Vehicle, VehicleCarfaxSummary } from "@mobile-mechanic/types";

import { getCarfaxConfig } from "../server-env";
import {
  buildCarfaxProviderRequest,
  normalizeCarfaxProviderPayload,
  type FetchCarfaxSummaryResult
} from "./provider";

const CARFAX_REQUEST_TIMEOUT_MS = 8_000;
const CARFAX_READY_REFRESH_MS = 24 * 60 * 60 * 1_000;
const CARFAX_NOT_AVAILABLE_REFRESH_MS = 24 * 60 * 60 * 1_000;
const CARFAX_PROVIDER_ERROR_REFRESH_MS = 15 * 60 * 1_000;

function addMilliseconds(base: Date, milliseconds: number): string {
  return new Date(base.getTime() + milliseconds).toISOString();
}

function getNextEligibleRefreshAt(status: FetchCarfaxSummaryResult["status"], now: Date): string {
  if (status === "provider_error") {
    return addMilliseconds(now, CARFAX_PROVIDER_ERROR_REFRESH_MS);
  }

  if (status === "not_available") {
    return addMilliseconds(now, CARFAX_NOT_AVAILABLE_REFRESH_MS);
  }

  return addMilliseconds(now, CARFAX_READY_REFRESH_MS);
}

function matchesVehicleVin(summary: VehicleCarfaxSummary | null, vehicle: Pick<Vehicle, "vin">): boolean {
  const vin = normalizeVinForDecode(vehicle.vin);
  return Boolean(summary && vin && summary.vin === vin);
}

function getProviderErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.trim();
    }

    if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
      const nestedRecord = record.data as Record<string, unknown>;

      if (typeof nestedRecord.message === "string" && nestedRecord.message.trim()) {
        return nestedRecord.message.trim();
      }

      if (typeof nestedRecord.error === "string" && nestedRecord.error.trim()) {
        return nestedRecord.error.trim();
      }
    }
  }

  return fallback;
}

function getCarfaxFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Carfax request timed out. Try again later.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Carfax summary could not be fetched right now.";
}

export async function fetchCarfaxSummaryByVin(vin: string): Promise<FetchCarfaxSummaryResult> {
  const normalizedVin = normalizeVinForDecode(vin);

  if (!normalizedVin || !isVinReadyForDecode(normalizedVin)) {
    return {
      status: "provider_error",
      summary: null,
      lastErrorMessage: "A valid VIN is required before Carfax can be requested."
    };
  }

  const carfaxConfig = getCarfaxConfig();

  if (!carfaxConfig) {
    return {
      status: "provider_error",
      summary: null,
      lastErrorMessage: "Carfax integration is not configured for this environment."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CARFAX_REQUEST_TIMEOUT_MS);

  try {
    const request = buildCarfaxProviderRequest(normalizedVin, carfaxConfig);
    const response = await fetch(request.url, {
      ...request.init,
      signal: controller.signal
    });

    if (response.status === 204 || response.status === 404) {
      return {
        status: "not_available",
        summary: null,
        lastErrorMessage: null
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      return {
        status: "provider_error",
        summary: null,
        lastErrorMessage: getProviderErrorMessage(
          payload,
          "Carfax summary could not be fetched right now."
        )
      };
    }

    return normalizeCarfaxProviderPayload(payload);
  } catch (error) {
    return {
      status: "provider_error",
      summary: null,
      lastErrorMessage: getCarfaxFetchErrorMessage(error)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readVehicleCarfaxSummaryForVehicle(
  client: AppSupabaseClient,
  vehicle: Pick<Vehicle, "id" | "vin">
): Promise<VehicleCarfaxSummary | null> {
  const vin = normalizeVinForDecode(vehicle.vin);

  if (!isVinReadyForDecode(vin)) {
    return null;
  }

  const result = await getVehicleCarfaxSummaryByVehicleId(client, vehicle.id);

  if (result.error) {
    throw result.error;
  }

  if (!result.data || result.data.vin !== vin) {
    return null;
  }

  return result.data;
}

export async function listVehicleCarfaxSummaryMapForVehicles(
  client: AppSupabaseClient,
  vehicles: Array<Pick<Vehicle, "id" | "vin">>
) {
  const result = await listVehicleCarfaxSummariesByVehicleIds(
    client,
    vehicles.map((vehicle) => vehicle.id)
  );

  if (result.error) {
    throw result.error;
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const summariesByVehicleId = new Map(
    (result.data ?? [])
      .filter((summary) => matchesVehicleVin(summary, vehicleById.get(summary.vehicleId) ?? { vin: null }))
      .map((summary) => [summary.vehicleId, summary] as const)
  );

  return summariesByVehicleId;
}

export async function readVehicleCarfaxSummary(
  client: AppSupabaseClient,
  companyId: string,
  vehicleId: string
): Promise<VehicleCarfaxSummary | null> {
  const vehicleResult = await getVehicleById(client, vehicleId);

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }

  if (!vehicleResult.data || vehicleResult.data.companyId !== companyId) {
    return null;
  }

  return readVehicleCarfaxSummaryForVehicle(client, vehicleResult.data);
}

export async function refreshVehicleCarfaxSummaryForVehicle(
  client: AppSupabaseClient,
  vehicle: Pick<Vehicle, "id" | "companyId" | "vin">
): Promise<VehicleCarfaxSummary | null> {
  const vin = normalizeVinForDecode(vehicle.vin);

  if (!vin || !isVinReadyForDecode(vin)) {
    return null;
  }

  const existing = await readVehicleCarfaxSummaryForVehicle(client, vehicle);

  if (existing && Date.parse(existing.nextEligibleRefreshAt) > Date.now()) {
    return existing;
  }

  const now = new Date();
  const fetched = await fetchCarfaxSummaryByVin(vin);
  const nowIso = now.toISOString();
  const result = await upsertVehicleCarfaxSummary(client, {
    companyId: vehicle.companyId,
    vehicleId: vehicle.id,
    vin,
    status: fetched.status,
    summary: fetched.summary,
    fetchedAt: fetched.status === "ready" ? nowIso : null,
    lastAttemptedAt: nowIso,
    nextEligibleRefreshAt: getNextEligibleRefreshAt(fetched.status, now),
    lastErrorMessage: fetched.lastErrorMessage
  });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function refreshVehicleCarfaxSummary(
  client: AppSupabaseClient,
  companyId: string,
  vehicleId: string
): Promise<VehicleCarfaxSummary | null> {
  const vehicleResult = await getVehicleById(client, vehicleId);

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }

  if (!vehicleResult.data || vehicleResult.data.companyId !== companyId) {
    return null;
  }

  return refreshVehicleCarfaxSummaryForVehicle(client, vehicleResult.data);
}
