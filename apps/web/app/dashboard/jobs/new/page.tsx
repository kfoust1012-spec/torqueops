import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type LegacyNewJobPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyNewJobPage({ searchParams }: LegacyNewJobPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref("/dashboard/visits/new", resolvedSearchParams));
}

