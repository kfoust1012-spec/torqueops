import { redirect } from "next/navigation";

import {
  buildCustomerWorkspaceHref,
  normalizeCustomerWorkspaceTab,
  readBooleanSearchParam,
  readSelectedVehicleIdSearchParam,
  readSingleSearchParam
} from "../../../../lib/customers/workspace";
import { parseCustomerServiceHistorySearchParams } from "../../../../lib/service-history/filters";

type CustomerDetailPageProps = {
  params: Promise<{
    customerId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerDetailPage({
  params,
  searchParams
}: CustomerDetailPageProps) {
  const [{ customerId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>)
  ]);
  const query =
    typeof resolvedSearchParams.query === "string" ? resolvedSearchParams.query.trim() : "";

  redirect(
    buildCustomerWorkspaceHref(customerId, {
      mode: "workspace",
      query,
      tab: normalizeCustomerWorkspaceTab(resolvedSearchParams.tab),
      selectedVehicleId:
        readSelectedVehicleIdSearchParam(resolvedSearchParams.selectedVehicleId) ?? undefined,
      editCustomer: readBooleanSearchParam(resolvedSearchParams.editCustomer),
      newAddress: readBooleanSearchParam(resolvedSearchParams.newAddress),
      editAddressId: readSingleSearchParam(resolvedSearchParams.editAddressId) ?? undefined,
      newVehicle: readBooleanSearchParam(resolvedSearchParams.newVehicle),
      editVehicleId: readSingleSearchParam(resolvedSearchParams.editVehicleId) ?? undefined,
      ...parseCustomerServiceHistorySearchParams(resolvedSearchParams)
    })
  );
}
