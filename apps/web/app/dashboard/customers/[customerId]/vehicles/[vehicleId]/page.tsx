import { redirect } from "next/navigation";

import {
  buildCustomerVehicleHref,
  normalizeCustomerRegistrySegment,
  normalizeCustomerWorkspaceMode,
  readSingleSearchParam
} from "../../../../../../lib/customers/workspace";
import { parseVehicleServiceHistorySearchParams } from "../../../../../../lib/service-history/filters";

type CustomerVehicleDetailPageProps = {
  params: Promise<{
    customerId: string;
    vehicleId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerVehicleDetailPage({
  params,
  searchParams
}: CustomerVehicleDetailPageProps) {
  const [{ customerId, vehicleId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>)
  ]);
  const historyFilters = parseVehicleServiceHistorySearchParams(resolvedSearchParams);

  redirect(
    buildCustomerVehicleHref(customerId, vehicleId, {
      mode: normalizeCustomerWorkspaceMode(resolvedSearchParams.mode),
      query: readSingleSearchParam(resolvedSearchParams.query),
      segment: normalizeCustomerRegistrySegment(resolvedSearchParams.segment),
      tab: readSingleSearchParam(resolvedSearchParams.tab) === "history" ? "history" : "overview",
      dateFrom: historyFilters.dateFrom,
      dateTo: historyFilters.dateTo,
      jobStatuses: historyFilters.jobStatuses,
      inspectionStatuses: historyFilters.inspectionStatuses,
      estimateStatuses: historyFilters.estimateStatuses,
      invoiceStatuses: historyFilters.invoiceStatuses,
      paymentStatuses: historyFilters.paymentStatuses,
      sort: historyFilters.sort
    })
  );
}
