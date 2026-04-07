import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type LegacyJobInvoicePageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobInvoicePage({
  params,
  searchParams
}: LegacyJobInvoicePageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/invoice`, resolvedSearchParams));
}

