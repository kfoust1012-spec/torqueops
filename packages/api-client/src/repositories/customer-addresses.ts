import type {
  CreateCustomerAddressInput,
  CustomerAddress,
  Database,
  UpdateCustomerAddressInput
} from "@mobile-mechanic/types";
import {
  createCustomerAddressInputSchema,
  updateCustomerAddressInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CustomerAddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function mapCustomerAddressRow(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    label: row.label as CustomerAddress["label"],
    siteName: row.site_name,
    serviceContactName: row.service_contact_name,
    serviceContactPhone: row.service_contact_phone,
    accessWindowNotes: row.access_window_notes,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    gateCode: row.gate_code,
    parkingNotes: row.parking_notes,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function clearPrimaryAddress(client: AppSupabaseClient, customerId: string) {
  return client.from("customer_addresses").update({ is_primary: false }).eq("customer_id", customerId);
}
export async function createCustomerAddress(client: AppSupabaseClient, input: CreateCustomerAddressInput) {
  const parsed = createCustomerAddressInputSchema.parse(input);
  const payload: Database["public"]["Tables"]["customer_addresses"]["Insert"] = {
    customer_id: parsed.customerId,
    company_id: parsed.companyId,
    label: parsed.label ?? "service",
    site_name: normalizeOptionalText(parsed.siteName),
    service_contact_name: normalizeOptionalText(parsed.serviceContactName),
    service_contact_phone: normalizeOptionalText(parsed.serviceContactPhone),
    access_window_notes: normalizeOptionalText(parsed.accessWindowNotes),
    line1: parsed.line1.trim(),
    line2: normalizeOptionalText(parsed.line2),
    city: parsed.city.trim(),
    state: parsed.state.trim().toUpperCase(),
    postal_code: parsed.postalCode.trim(),
    country: (parsed.country ?? "US").trim().toUpperCase(),
    gate_code: normalizeOptionalText(parsed.gateCode),
    parking_notes: normalizeOptionalText(parsed.parkingNotes),
    is_primary: parsed.isPrimary ?? false,
    is_active: parsed.isActive ?? true
  };

  const result = await client
    .from("customer_addresses")
    .insert(payload)
    .select("*")
    .single<CustomerAddressRow>();

  return {
    ...result,
    data: result.data ? mapCustomerAddressRow(result.data) : null
  };
}

export async function updateCustomerAddress(
  client: AppSupabaseClient,
  addressId: string,
  input: UpdateCustomerAddressInput
) {
  const parsed = updateCustomerAddressInputSchema.parse(input);
  const updatePayload: Database["public"]["Tables"]["customer_addresses"]["Update"] = {
    label: parsed.label ?? "service",
    site_name: normalizeOptionalText(parsed.siteName),
    service_contact_name: normalizeOptionalText(parsed.serviceContactName),
    service_contact_phone: normalizeOptionalText(parsed.serviceContactPhone),
    access_window_notes: normalizeOptionalText(parsed.accessWindowNotes),
    line1: parsed.line1.trim(),
    line2: normalizeOptionalText(parsed.line2),
    city: parsed.city.trim(),
    state: parsed.state.trim().toUpperCase(),
    postal_code: parsed.postalCode.trim(),
    country: (parsed.country ?? "US").trim().toUpperCase(),
    gate_code: normalizeOptionalText(parsed.gateCode),
    parking_notes: normalizeOptionalText(parsed.parkingNotes),
    is_primary: parsed.isPrimary ?? false,
    is_active: parsed.isActive ?? true
  };

  const existing = await client
    .from("customer_addresses")
    .select("*")
    .eq("id", addressId)
    .single<CustomerAddressRow>();

  if (existing.error || !existing.data) {
    return {
      ...existing,
      data: null
    };
  }

  const result = await client
    .from("customer_addresses")
    .update(updatePayload)
    .eq("id", addressId)
    .select("*")
    .single<CustomerAddressRow>();

  return {
    ...result,
    data: result.data ? mapCustomerAddressRow(result.data) : null
  };
}

export async function listAddressesByCustomer(client: AppSupabaseClient, customerId: string) {
  const result = await client
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<CustomerAddressRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerAddressRow) : null
  };
}

export async function listAddressesByCompany(client: AppSupabaseClient, companyId: string) {
  const result = await client
    .from("customer_addresses")
    .select("*")
    .eq("company_id", companyId)
    .order("customer_id", { ascending: true })
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<CustomerAddressRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerAddressRow) : null
  };
}

export async function setPrimaryCustomerAddress(
  client: AppSupabaseClient,
  customerId: string,
  addressId: string
) {
  const result = await client
    .from("customer_addresses")
    .update({ is_primary: true })
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select("*")
    .single<CustomerAddressRow>();

  return {
    ...result,
    data: result.data ? mapCustomerAddressRow(result.data) : null
  };
}

export async function deleteCustomerAddress(client: AppSupabaseClient, addressId: string) {
  return client.from("customer_addresses").delete().eq("id", addressId);
}
