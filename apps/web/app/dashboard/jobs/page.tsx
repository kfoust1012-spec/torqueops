import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../lib/dashboard/route-alias";

type LegacyJobsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobsPage({ searchParams }: LegacyJobsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref("/dashboard/visits", resolvedSearchParams));
}

