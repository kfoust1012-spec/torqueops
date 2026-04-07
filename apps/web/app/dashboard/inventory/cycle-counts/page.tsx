import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type InventoryCycleCountsRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryCycleCountsRedirectPage({ searchParams }: InventoryCycleCountsRedirectPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/inventory", (searchParams ? await searchParams : {}), { view: "counts" }));
}
