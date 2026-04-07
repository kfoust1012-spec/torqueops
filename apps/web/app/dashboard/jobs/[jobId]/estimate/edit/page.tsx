import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../../lib/dashboard/route-alias";

type LegacyJobEstimateEditPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobEstimateEditPage({
  params,
  searchParams
}: LegacyJobEstimateEditPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/estimate/workspace`, resolvedSearchParams));
}
