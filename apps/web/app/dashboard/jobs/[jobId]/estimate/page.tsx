import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type LegacyJobEstimatePageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobEstimatePage({
  params,
  searchParams
}: LegacyJobEstimatePageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/estimate`, resolvedSearchParams));
}

