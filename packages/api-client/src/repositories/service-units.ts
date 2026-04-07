import {
  normalizeLicensePlate,
  normalizeOptionalText,
  normalizeVin
} from "@mobile-mechanic/core";
import type {
  CreateServiceUnitInput,
  Database,
  ServiceUnit,
  ServiceUnitListItem,
  ServiceUnitListQuery,
  UpdateServiceUnitInput
} from "@mobile-mechanic/types";
import {
  createServiceUnitInputSchema,
  serviceUnitQuerySchema,
  updateServiceUnitInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type ServiceUnitRow = Database["public"]["Tables"]["service_units"]["Row"];

function mapServiceUnitRow(row: ServiceUnitRow): ServiceUnit {
  return {
    id: row.id,
    companyId: row.company_id,
    stockLocationId: row.stock_location_id,
    assignedTechnicianUserId: row.assigned_technician_user_id,
    unitCode: row.unit_code,
    displayName: row.display_name,
    year: row.year,
    make: row.make,
    model: row.model,
    licensePlate: row.license_plate,
    licenseState: row.license_state,
    vin: row.vin,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapServiceUnitListItem(row: ServiceUnitRow): ServiceUnitListItem {
  const unit = mapServiceUnitRow(row);

  return {
    id: unit.id,
    companyId: unit.companyId,
    stockLocationId: unit.stockLocationId,
    assignedTechnicianUserId: unit.assignedTechnicianUserId,
    unitCode: unit.unitCode,
    displayName: unit.displayName,
    licensePlate: unit.licensePlate,
    licenseState: unit.licenseState,
    vin: unit.vin,
    isActive: unit.isActive
  };
}

export async function createServiceUnit(client: AppSupabaseClient, input: CreateServiceUnitInput) {
  const parsed = createServiceUnitInputSchema.parse(input);

  const result = await client
    .from("service_units")
    .insert({
      company_id: parsed.companyId,
      stock_location_id: parsed.stockLocationId,
      assigned_technician_user_id: parsed.assignedTechnicianUserId ?? null,
      unit_code: parsed.unitCode.trim().toUpperCase(),
      display_name: parsed.displayName.trim(),
      year: parsed.year ?? null,
      make: normalizeOptionalText(parsed.make),
      model: normalizeOptionalText(parsed.model),
      license_plate: normalizeLicensePlate(parsed.licensePlate),
      license_state: normalizeOptionalText(parsed.licenseState)?.toUpperCase() ?? null,
      vin: normalizeVin(parsed.vin),
      notes: normalizeOptionalText(parsed.notes),
      is_active: parsed.isActive ?? true
    })
    .select("*")
    .single<ServiceUnitRow>();

  return {
    ...result,
    data: result.data ? mapServiceUnitRow(result.data) : null
  };
}

export async function updateServiceUnit(
  client: AppSupabaseClient,
  serviceUnitId: string,
  input: UpdateServiceUnitInput
) {
  const parsed = updateServiceUnitInputSchema.parse(input);
  const updatePayload: Database["public"]["Tables"]["service_units"]["Update"] = {
    assigned_technician_user_id: parsed.assignedTechnicianUserId ?? null,
    unit_code: parsed.unitCode.trim().toUpperCase(),
    display_name: parsed.displayName.trim(),
    year: parsed.year ?? null,
    make: normalizeOptionalText(parsed.make),
    model: normalizeOptionalText(parsed.model),
    license_plate: normalizeLicensePlate(parsed.licensePlate),
    license_state: normalizeOptionalText(parsed.licenseState)?.toUpperCase() ?? null,
    vin: normalizeVin(parsed.vin),
    notes: normalizeOptionalText(parsed.notes),
    is_active: parsed.isActive ?? true
  };

  if (parsed.stockLocationId) {
    updatePayload.stock_location_id = parsed.stockLocationId;
  }

  const result = await client
    .from("service_units")
    .update(updatePayload)
    .eq("id", serviceUnitId)
    .select("*")
    .single<ServiceUnitRow>();

  return {
    ...result,
    data: result.data ? mapServiceUnitRow(result.data) : null
  };
}

export async function getServiceUnitById(client: AppSupabaseClient, serviceUnitId: string) {
  const result = await client
    .from("service_units")
    .select("*")
    .eq("id", serviceUnitId)
    .single<ServiceUnitRow>();

  return {
    ...result,
    data: result.data ? mapServiceUnitRow(result.data) : null
  };
}

export async function listServiceUnitsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: ServiceUnitListQuery = {}
) {
  const parsed = serviceUnitQuerySchema.parse(query);
  let builder = client
    .from("service_units")
    .select("*")
    .eq("company_id", companyId)
    .order("display_name", { ascending: true });

  if (!parsed.includeInactive) {
    builder = builder.eq("is_active", true);
  }

  if (parsed.assignedTechnicianUserId) {
    builder = builder.eq("assigned_technician_user_id", parsed.assignedTechnicianUserId);
  }

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    builder = builder.or(
      `display_name.ilike.${search},unit_code.ilike.${search},vin.ilike.${search},license_plate.ilike.${search}`
    );
  }

  const result = await builder.returns<ServiceUnitRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapServiceUnitListItem) : null
  };
}
