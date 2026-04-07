import { redirect } from "next/navigation";

type InventoryLookupRedirectPageProps = {
  searchParams?: Promise<{
    includeInactive?: string | string[];
    locationId?: string | string[];
    lowStock?: string | string[];
    lowStockOnly?: string | string[];
    q?: string | string[];
  }>;
};

function getQueryValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

export default async function InventoryLookupRedirectPage({
  searchParams
}: InventoryLookupRedirectPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  params.set("view", "catalog");

  const query = getQueryValue(resolvedSearchParams.q);
  if (query) {
    params.set("q", query);
  }

  const locationId = getQueryValue(resolvedSearchParams.locationId);
  if (locationId) {
    params.set("lookupLocationId", locationId);
  }

  const lowStock =
    getQueryValue(resolvedSearchParams.lowStock) === "1" ||
    getQueryValue(resolvedSearchParams.lowStockOnly) === "true";
  if (lowStock) {
    params.set("lowStock", "1");
  }

  if (getQueryValue(resolvedSearchParams.includeInactive) === "1") {
    params.set("includeInactive", "1");
  }

  redirect(`/dashboard/supply/inventory?${params.toString()}`);
}
