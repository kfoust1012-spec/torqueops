import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type InventoryLocationsRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryLocationsRedirectPage({ searchParams }: InventoryLocationsRedirectPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/inventory", (searchParams ? await searchParams : {}), { view: "locations" }));
}
