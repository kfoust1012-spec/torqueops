import { getVehicleById } from "@mobile-mechanic/api-client";
import { redirect } from "next/navigation";

import { requireCompanyContext } from "../../../lib/company-context";
import { buildCustomersHref, readSingleSearchParam } from "../../../lib/customers/workspace";

type CustomerVehiclesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerVehiclesPage({ searchParams }: CustomerVehiclesPageProps) {
  const context = await requireCompanyContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSingleSearchParam(resolvedSearchParams.query)?.trim();
  const requestedVehicleId = readSingleSearchParam(resolvedSearchParams.vehicleId);

  let customerId: string | undefined;
  let selectedVehicleId: string | undefined;

  if (requestedVehicleId) {
    const vehicleResult = await getVehicleById(context.supabase, requestedVehicleId);

    if (
      !vehicleResult.error &&
      vehicleResult.data &&
      vehicleResult.data.companyId === context.companyId
    ) {
      customerId = vehicleResult.data.customerId;
      selectedVehicleId = vehicleResult.data.id;
    }
  }

  redirect(
    buildCustomersHref({
      customerId,
      query: query || undefined,
      selectedVehicleId,
      tab: "vehicles"
    })
  );
}
