import { getVehicleById } from "@mobile-mechanic/api-client";
import { notFound, redirect } from "next/navigation";

import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerVehicleHref } from "../../../../../lib/customers/workspace";
import { parseVehicleServiceHistorySearchParams } from "../../../../../lib/service-history/filters";

type VehicleHistoryPageProps = {
  params: Promise<{
    vehicleId: string;
  }>;
  searchParams?: Promise<VehicleHistorySearchParams>;
};

type VehicleHistorySearchParams = Record<string, string | string[] | undefined>;

export default async function VehicleHistoryPage({
  params,
  searchParams
}: VehicleHistoryPageProps) {
  const context = await requireCompanyContext();
  const [{ vehicleId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as VehicleHistorySearchParams)
  ]);
  const vehicleResult = await getVehicleById(context.supabase, vehicleId);

  if (vehicleResult.error || !vehicleResult.data || vehicleResult.data.companyId !== context.companyId) {
    notFound();
  }

  const filters = parseVehicleServiceHistorySearchParams(resolvedSearchParams ?? {});

  redirect(
    buildCustomerVehicleHref(vehicleResult.data.customerId, vehicleId, {
      tab: "history",
      ...filters
    })
  );
}
