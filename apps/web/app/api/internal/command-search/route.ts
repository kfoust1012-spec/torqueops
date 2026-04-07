import {
  listCustomersByCompany,
  listInvoicesByCompany,
  listJobsByCompany,
  listVehiclesByCompany
} from "@mobile-mechanic/api-client";
import { getCustomerDisplayName } from "@mobile-mechanic/core";
import type { Database } from "@mobile-mechanic/types";
import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { buildVisitThreadHref } from "../../../../lib/visits/workspace";

type CommandSearchResult = {
  hint: string;
  href: string;
  icon: "customerVehicles" | "customers" | "fleet" | "invoices" | "jobs";
  keywords: string[];
  label: string;
  tier: "control" | "support" | "workspace";
};

type CustomerLookupRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "company_name" | "first_name" | "id" | "last_name" | "relationship_type"
>;

type ServiceSiteLookupRow = Pick<
  Database["public"]["Tables"]["customer_addresses"]["Row"],
  | "city"
  | "customer_id"
  | "id"
  | "is_active"
  | "is_primary"
  | "label"
  | "line1"
  | "postal_code"
  | "service_contact_name"
  | "site_name"
  | "state"
>;

function buildAddressSummary(site: ServiceSiteLookupRow) {
  return [site.line1, site.city, site.state, site.postal_code].filter(Boolean).join(", ");
}

function uniqueResults(results: CommandSearchResult[]) {
  return [...new Map(results.map((result) => [result.href, result])).values()];
}

export async function GET(request: Request) {
  const contextResult = await getCompanyContextResult({ requireOfficeAccess: true });

  if (contextResult.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (contextResult.status === "no-company" || contextResult.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const context = contextResult.context;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const searchTerm = query.replace(/[,%()]/g, " ").trim();

  if (searchTerm.length < 2) {
    return NextResponse.json({ ok: true, results: [] satisfies CommandSearchResult[] });
  }

  const [customersResult, vehiclesResult, jobsResult, invoicesResult, serviceSitesResult] =
    await Promise.all([
      listCustomersByCompany(context.supabase, context.companyId, { query: searchTerm }),
      listVehiclesByCompany(context.supabase, context.companyId, {
        includeInactive: true,
        query: searchTerm
      }),
      listJobsByCompany(context.supabase, context.companyId, {
        includeInactive: true,
        query: searchTerm
      }),
      listInvoicesByCompany(context.supabase, context.companyId, { query: searchTerm }),
      context.supabase
        .from("customer_addresses")
        .select(
          "id, customer_id, site_name, label, line1, city, state, postal_code, service_contact_name, is_primary, is_active"
        )
        .eq("company_id", context.companyId)
        .eq("is_active", true)
        .or(
          [
            `site_name.ilike.%${searchTerm}%`,
            `line1.ilike.%${searchTerm}%`,
            `city.ilike.%${searchTerm}%`,
            `state.ilike.%${searchTerm}%`,
            `postal_code.ilike.%${searchTerm}%`,
            `service_contact_name.ilike.%${searchTerm}%`
          ].join(",")
        )
        .order("is_primary", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(6)
        .returns<ServiceSiteLookupRow[]>()
    ]);

  if (customersResult.error) {
    return NextResponse.json({ error: customersResult.error.message }, { status: 500 });
  }

  if (vehiclesResult.error) {
    return NextResponse.json({ error: vehiclesResult.error.message }, { status: 500 });
  }

  if (jobsResult.error) {
    return NextResponse.json({ error: jobsResult.error.message }, { status: 500 });
  }

  if (invoicesResult.error) {
    return NextResponse.json({ error: invoicesResult.error.message }, { status: 500 });
  }

  if (serviceSitesResult.error) {
    return NextResponse.json({ error: serviceSitesResult.error.message }, { status: 500 });
  }

  const customerLookups = customersResult.data ?? [];
  const vehicleLookups = (vehiclesResult.data ?? []).slice(0, 5);
  const jobLookups = (jobsResult.data ?? []).slice(0, 5);
  const invoiceLookups = (invoicesResult.data ?? []).slice(0, 5);
  const serviceSiteLookups = serviceSitesResult.data ?? [];

  const relatedCustomerIds = [
    ...new Set([
      ...vehicleLookups.map((vehicle) => vehicle.customerId),
      ...serviceSiteLookups.map((site) => site.customer_id)
    ])
  ].filter((customerId) => !customerLookups.some((customer) => customer.id === customerId));

  const relatedCustomersResult = relatedCustomerIds.length
    ? await context.supabase
        .from("customers")
        .select("id, relationship_type, company_name, first_name, last_name")
        .eq("company_id", context.companyId)
        .in("id", relatedCustomerIds)
        .returns<CustomerLookupRow[]>()
    : { data: [] as CustomerLookupRow[], error: null };

  if (relatedCustomersResult.error) {
    return NextResponse.json({ error: relatedCustomersResult.error.message }, { status: 500 });
  }

  const customerDisplayNamesById = new Map<string, string>();

  for (const customer of customerLookups) {
    customerDisplayNamesById.set(customer.id, customer.displayName);
  }

  for (const customer of relatedCustomersResult.data ?? []) {
    customerDisplayNamesById.set(
      customer.id,
      getCustomerDisplayName({
        companyName: customer.company_name,
        firstName: customer.first_name,
        lastName: customer.last_name,
        relationshipType: customer.relationship_type
      })
    );
  }

  const customerResults = customerLookups.slice(0, 5).map<CommandSearchResult>((customer) => ({
    hint:
      customer.relationshipType === "fleet_account"
        ? "Fleet account thread"
        : "Customer thread",
    href: buildCustomerWorkspaceHref(customer.id),
    icon: "customers",
    keywords: [customer.email ?? "", customer.phone ?? "", customer.relationshipType].filter(Boolean),
    label: customer.displayName,
    tier: "workspace"
  }));

  const vehicleResults = vehicleLookups.map<CommandSearchResult>((vehicle) => {
    const customerName = customerDisplayNamesById.get(vehicle.customerId) ?? "Customer";

    return {
      hint: `${customerName} · ${[vehicle.licensePlate, vehicle.vin].filter(Boolean).join(" · ") || "Vehicle record"}`,
      href: buildCustomerWorkspaceHref(vehicle.customerId, {
        selectedVehicleId: vehicle.id,
        tab: "vehicles"
      }),
      icon: "customerVehicles",
      keywords: [customerName, vehicle.licensePlate ?? "", vehicle.vin ?? ""].filter(Boolean),
      label: vehicle.displayName,
      tier: "workspace"
    };
  });

  const jobResults = jobLookups.map<CommandSearchResult>((job) => ({
    hint: `${job.customerDisplayName} · ${job.vehicleDisplayName} · ${job.status.replace(/_/g, " ")}`,
    href: buildVisitThreadHref(job.id),
    icon: "jobs",
    keywords: [job.customerDisplayName, job.vehicleDisplayName, job.status],
    label: job.title,
    tier: "workspace"
  }));

  const invoiceResults = invoiceLookups.map<CommandSearchResult>((invoice) => ({
    hint: `Finance file · ${invoice.title}`,
    href: `/dashboard/finance?invoiceId=${invoice.invoiceId}`,
    icon: "invoices",
    keywords: [invoice.invoiceNumber ?? "", invoice.title],
    label: invoice.invoiceNumber
      ? `${invoice.invoiceNumber} · ${invoice.title}`
      : invoice.title,
    tier: "support"
  }));

  const serviceSiteResults = serviceSiteLookups.map<CommandSearchResult>((site) => {
    const customerName = customerDisplayNamesById.get(site.customer_id) ?? "Customer";
    const siteName = site.site_name ?? site.label;

    return {
      hint: `${customerName} · ${buildAddressSummary(site) || "Service site"} · Site thread`,
      href: buildCustomerWorkspaceHref(site.customer_id, { editAddressId: site.id, tab: "addresses" }),
      icon: "customers",
      keywords: [
        customerName,
        "site thread",
        site.service_contact_name ?? "",
        site.line1,
        site.city,
        site.state,
        site.postal_code
      ].filter(Boolean),
      label: siteName,
      tier: "workspace"
    };
  });

  return NextResponse.json({
    ok: true,
    results: uniqueResults([
      ...jobResults,
      ...customerResults,
      ...vehicleResults,
      ...serviceSiteResults,
      ...invoiceResults
    ]).slice(0, 12)
  });
}
