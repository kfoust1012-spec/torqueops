import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../../lib/dashboard/route-alias";

type LegacyJobEstimateWorkspacePageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobEstimateWorkspacePage({
  params,
  searchParams
}: LegacyJobEstimateWorkspacePageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(
    buildDashboardAliasHref(`/dashboard/visits/${jobId}/estimate/workspace`, resolvedSearchParams)
  );
}

