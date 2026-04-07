import {
  getVehicleDisplayName,
  normalizeLicensePlate,
  normalizeOptionalText,
  normalizeVin
} from "@mobile-mechanic/core";
import type {
  CreateVehicleInput,
  CustomerVehicleSummary,
  Database,
  UpdateVehicleInput,
  Vehicle,
  VehicleListItem,
  VehicleListQuery
} from "@mobile-mechanic/types";
import {
  createVehicleInputSchema,
  updateVehicleInputSchema,
  vehicleListQuerySchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

function mapVehicleRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    ownershipType: row.ownership_type,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    engine: row.engine,
    licensePlate: row.license_plate,
    licenseState: row.license_state,
    vin: row.vin,
    color: row.color,
    odometer: row.odometer,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVehicleListItem(row: VehicleRow): VehicleListItem {
  const vehicle = mapVehicleRow(row);

  return {
    id: vehicle.id,
    companyId: vehicle.companyId,
    customerId: vehicle.customerId,
    ownershipType: vehicle.ownershipType,
    displayName: getVehicleDisplayName(vehicle),
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    licenseState: vehicle.licenseState,
    isActive: vehicle.isActive
  };
}

function mapCustomerVehicleSummary(row: VehicleRow): CustomerVehicleSummary {
  const vehicle = mapVehicleRow(row);

  return {
    id: vehicle.id,
    customerId: vehicle.customerId,
    ownershipType: vehicle.ownershipType,
    displayName: getVehicleDisplayName(vehicle),
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    isActive: vehicle.isActive
  };
}

export async function createVehicle(client: AppSupabaseClient, input: CreateVehicleInput) {
  const parsed = createVehicleInputSchema.parse(input);
  const year = parsed.year ?? null;
  const make = parsed.make.trim();
  const model = parsed.model.trim();
  const trim = normalizeOptionalText(parsed.trim);
  const engine = normalizeOptionalText(parsed.engine);
  const licensePlate = normalizeLicensePlate(parsed.licensePlate);
  const licenseState = normalizeOptionalText(parsed.licenseState)?.toUpperCase() ?? null;
  const vin = normalizeVin(parsed.vin);
  const color = normalizeOptionalText(parsed.color);
  const odometer = parsed.odometer ?? null;
  const notes = normalizeOptionalText(parsed.notes);
  const isActive = parsed.isActive ?? true;

  const result = await client
    .from("vehicles")
    .insert({
      company_id: parsed.companyId,
      customer_id: parsed.customerId,
      ownership_type: parsed.ownershipType ?? "customer_owned",
      year,
      make,
      model,
      trim,
      engine,
      license_plate: licensePlate,
      license_state: licenseState,
      vin,
      color,
      odometer,
      notes,
      is_active: isActive
    })
    .select("*")
    .single<VehicleRow>();

  return {
    ...result,
    data: result.data ? mapVehicleRow(result.data) : null
  };
}

export async function updateVehicle(
  client: AppSupabaseClient,
  vehicleId: string,
  input: UpdateVehicleInput
) {
  const parsed = updateVehicleInputSchema.parse(input);
  const year = parsed.year ?? null;
  const make = parsed.make.trim();
  const model = parsed.model.trim();
  const trim = normalizeOptionalText(parsed.trim);
  const engine = normalizeOptionalText(parsed.engine);
  const licensePlate = normalizeLicensePlate(parsed.licensePlate);
  const licenseState = normalizeOptionalText(parsed.licenseState)?.toUpperCase() ?? null;
  const vin = normalizeVin(parsed.vin);
  const color = normalizeOptionalText(parsed.color);
  const odometer = parsed.odometer ?? null;
  const notes = normalizeOptionalText(parsed.notes);
  const isActive = parsed.isActive ?? true;

  const result = await client
    .from("vehicles")
    .update({
      customer_id: parsed.customerId,
      ownership_type: parsed.ownershipType ?? "customer_owned",
      year,
      make,
      model,
      trim,
      engine,
      license_plate: licensePlate,
      license_state: licenseState,
      vin,
      color,
      odometer,
      notes,
      is_active: isActive
    })
    .eq("id", vehicleId)
    .select("*")
    .single<VehicleRow>();

  return {
    ...result,
    data: result.data ? mapVehicleRow(result.data) : null
  };
}

export async function getVehicleById(client: AppSupabaseClient, vehicleId: string) {
  const result = await client.from("vehicles").select("*").eq("id", vehicleId).single<VehicleRow>();

  return {
    ...result,
    data: result.data ? mapVehicleRow(result.data) : null
  };
}

export async function listVehiclesByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: VehicleListQuery = {}
) {
  const parsed = vehicleListQuerySchema.parse(query);
  let builder = client
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!parsed.includeInactive) {
    builder = builder.eq("is_active", true);
  }

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    builder = builder.or(
      `make.ilike.${search},model.ilike.${search},vin.ilike.${search},license_plate.ilike.${search}`
    );
  }

  const result = await builder.returns<VehicleRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapVehicleListItem) : null
  };
}

export async function listVehiclesByCustomer(client: AppSupabaseClient, customerId: string) {
  const result = await client
    .from("vehicles")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .returns<VehicleRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerVehicleSummary) : null
  };
}

export async function archiveVehicle(client: AppSupabaseClient, vehicleId: string) {
  const result = await client
    .from("vehicles")
    .update({ is_active: false })
    .eq("id", vehicleId)
    .select("*")
    .single<VehicleRow>();

  return {
    ...result,
    data: result.data ? mapVehicleRow(result.data) : null
  };
}
