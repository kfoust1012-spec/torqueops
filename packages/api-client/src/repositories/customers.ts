import { getCustomerDisplayName, normalizeOptionalText, normalizeVin } from "@mobile-mechanic/core";
import type {
  Customer,
  CustomerListItem,
  CustomerListQuery,
  Database,
  UpdateCustomerInput
} from "@mobile-mechanic/types";
import { createCustomerInputSchema, customerListQuerySchema, updateCustomerInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleCustomerLookupRow = Pick<
  Database["public"]["Tables"]["vehicles"]["Row"],
  "customer_id"
>;

function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    companyId: row.company_id,
    relationshipType: row.relationship_type,
    companyName: row.company_name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCustomerListItem(row: CustomerRow): CustomerListItem {
  const customer = mapCustomerRow(row);

  return {
    id: customer.id,
    companyId: customer.companyId,
    relationshipType: customer.relationshipType,
    companyName: customer.companyName,
    displayName: getCustomerDisplayName(customer),
    email: customer.email,
    phone: customer.phone,
    isActive: customer.isActive
  };
}

function buildCustomerListBaseQuery(
  client: AppSupabaseClient,
  companyId: string,
  includeInactive: boolean | undefined
) {
  let builder = client
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (!includeInactive) {
    builder = builder.eq("is_active", true);
  }

  return builder;
}

function compareCustomerRows(left: CustomerRow, right: CustomerRow) {
  const byLastName = left.last_name.localeCompare(right.last_name);

  if (byLastName !== 0) {
    return byLastName;
  }

  return left.first_name.localeCompare(right.first_name);
}

export async function createCustomer(client: AppSupabaseClient, input: unknown) {
  const parsed = createCustomerInputSchema.parse(input);
  const firstName = parsed.firstName.trim();
  const lastName = parsed.lastName.trim();
  const email = normalizeOptionalText(parsed.email);
  const phone = normalizeOptionalText(parsed.phone);
  const notes = normalizeOptionalText(parsed.notes);
  const isActive = parsed.isActive ?? true;

  const result = await client
    .from("customers")
    .insert({
      company_id: parsed.companyId,
      relationship_type: parsed.relationshipType ?? "retail_customer",
      company_name: normalizeOptionalText(parsed.companyName),
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      notes,
      is_active: isActive
    })
    .select("*")
    .single<CustomerRow>();

  return {
    ...result,
    data: result.data ? mapCustomerRow(result.data) : null
  };
}

export async function updateCustomer(
  client: AppSupabaseClient,
  customerId: string,
  input: UpdateCustomerInput
) {
  const parsed = updateCustomerInputSchema.parse(input);
  const firstName = parsed.firstName.trim();
  const lastName = parsed.lastName.trim();
  const email = normalizeOptionalText(parsed.email);
  const phone = normalizeOptionalText(parsed.phone);
  const notes = normalizeOptionalText(parsed.notes);
  const isActive = parsed.isActive ?? true;

  const result = await client
    .from("customers")
    .update({
      relationship_type: parsed.relationshipType ?? "retail_customer",
      company_name: normalizeOptionalText(parsed.companyName),
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      notes,
      is_active: isActive
    })
    .eq("id", customerId)
    .select("*")
    .single<CustomerRow>();

  return {
    ...result,
    data: result.data ? mapCustomerRow(result.data) : null
  };
}

export async function getCustomerById(client: AppSupabaseClient, customerId: string) {
  const result = await client.from("customers").select("*").eq("id", customerId).single<CustomerRow>();

  return {
    ...result,
    data: result.data ? mapCustomerRow(result.data) : null
  };
}

export async function listCustomersByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: CustomerListQuery = {}
) {
  const parsed = customerListQuerySchema.parse(query);
  const baseBuilder = buildCustomerListBaseQuery(
    client,
    companyId,
    parsed.includeInactive
  );

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    const normalizedVin = normalizeVin(parsed.query);
    const [customerFieldResult, vehicleLookupResult] = await Promise.all([
      buildCustomerListBaseQuery(client, companyId, parsed.includeInactive)
        .or(
          `first_name.ilike.${search},last_name.ilike.${search},company_name.ilike.${search},email.ilike.${search},phone.ilike.${search}`
        )
        .returns<CustomerRow[]>(),
      normalizedVin
        ? client
            .from("vehicles")
            .select("customer_id")
            .eq("company_id", companyId)
            .ilike("vin", `%${normalizedVin}%`)
            .returns<VehicleCustomerLookupRow[]>()
        : Promise.resolve({
            data: [] as VehicleCustomerLookupRow[],
            error: null
          })
    ]);

    if (customerFieldResult.error) {
      return {
        ...customerFieldResult,
        data: null
      };
    }

    if (vehicleLookupResult.error) {
      return {
        ...vehicleLookupResult,
        data: null
      };
    }

    const matchingCustomerIds = [
      ...new Set((vehicleLookupResult.data ?? []).map((row) => row.customer_id))
    ];
    const vehicleCustomerResult = matchingCustomerIds.length
      ? await buildCustomerListBaseQuery(client, companyId, parsed.includeInactive)
          .in("id", matchingCustomerIds)
          .returns<CustomerRow[]>()
      : { data: [] as CustomerRow[], error: null };

    if (vehicleCustomerResult.error) {
      return {
        ...vehicleCustomerResult,
        data: null
      };
    }

    const rows = [
      ...(customerFieldResult.data ?? []),
      ...(vehicleCustomerResult.data ?? [])
    ];
    const dedupedRows = [...new Map(rows.map((row) => [row.id, row])).values()].sort(
      compareCustomerRows
    );

    return {
      ...customerFieldResult,
      data: dedupedRows.map(mapCustomerListItem)
    };
  }

  const result = await baseBuilder.returns<CustomerRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerListItem) : null
  };
}

export async function searchCustomersByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: string
) {
  return listCustomersByCompany(client, companyId, { query });
}

export async function archiveCustomer(client: AppSupabaseClient, customerId: string) {
  const result = await client
    .from("customers")
    .update({ is_active: false })
    .eq("id", customerId)
    .select("*")
    .single<CustomerRow>();

  return {
    ...result,
    data: result.data ? mapCustomerRow(result.data) : null
  };
}
