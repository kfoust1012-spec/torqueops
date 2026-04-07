import { redirect } from "next/navigation";

import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { parseCustomerServiceHistorySearchParams } from "../../../../../lib/service-history/filters";

type CustomerHistoryPageProps = {
  params: Promise<{
    customerId: string;
  }>;
  searchParams?: Promise<CustomerHistorySearchParams>;
};

type CustomerHistorySearchParams = Record<string, string | string[] | undefined>;

export default async function CustomerHistoryPage({
  params,
  searchParams
}: CustomerHistoryPageProps) {
  const [{ customerId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as CustomerHistorySearchParams)
  ]);
  const filters = parseCustomerServiceHistorySearchParams(resolvedSearchParams ?? {});

  redirect(
    buildCustomerWorkspaceHref(customerId, { mode: "workspace", tab: "history", ...filters })
  );
}
