import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type InventoryItemsRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryItemsRedirectPage({ searchParams }: InventoryItemsRedirectPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/inventory", (searchParams ? await searchParams : {}), { view: "catalog" }));
}
