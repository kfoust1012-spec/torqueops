import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type LegacyJobEditPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobEditPage({
  params,
  searchParams
}: LegacyJobEditPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/edit`, resolvedSearchParams));
}

