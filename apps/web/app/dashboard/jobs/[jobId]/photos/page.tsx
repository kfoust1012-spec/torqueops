import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type LegacyJobPhotosPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobPhotosPage({
  params,
  searchParams
}: LegacyJobPhotosPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/photos`, resolvedSearchParams));
}

