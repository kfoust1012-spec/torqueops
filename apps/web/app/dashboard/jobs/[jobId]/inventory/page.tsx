import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type LegacyJobInventoryPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobInventoryPage({
  params,
  searchParams
}: LegacyJobInventoryPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/inventory`, resolvedSearchParams));
}

