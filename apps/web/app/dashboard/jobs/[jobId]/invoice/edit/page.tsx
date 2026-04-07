import { redirect } from "next/navigation";

import { buildDashboardAliasHref } from "../../../../../../lib/dashboard/route-alias";

type LegacyJobInvoiceEditPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyJobInvoiceEditPage({
  params,
  searchParams
}: LegacyJobInvoiceEditPageProps) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  redirect(buildDashboardAliasHref(`/dashboard/visits/${jobId}/invoice/edit`, resolvedSearchParams));
}

