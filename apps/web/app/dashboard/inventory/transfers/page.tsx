import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type InventoryTransfersRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryTransfersRedirectPage({ searchParams }: InventoryTransfersRedirectPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/inventory", (searchParams ? await searchParams : {}), { view: "movement" }));
}
