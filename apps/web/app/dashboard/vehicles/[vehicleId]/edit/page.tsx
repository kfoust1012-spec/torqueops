import { getVehicleById } from "@mobile-mechanic/api-client";
import { notFound, redirect } from "next/navigation";

import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerVehicleHref } from "../../../../../lib/customers/workspace";

type EditVehiclePageProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export default async function EditVehiclePage({ params }: EditVehiclePageProps) {
  const context = await requireCompanyContext();
  const { vehicleId } = await params;
  const vehicleResult = await getVehicleById(context.supabase, vehicleId);

  if (vehicleResult.error || !vehicleResult.data || vehicleResult.data.companyId !== context.companyId) {
    notFound();
  }

  redirect(buildCustomerVehicleHref(vehicleResult.data.customerId, vehicleId, { edit: true }));
}
