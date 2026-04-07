import { NextResponse } from "next/server";

import { getVehicleById } from "@mobile-mechanic/api-client";

import { getCompanyContextResult } from "../../../../../../lib/company-context";
import { readVehicleCarfaxSummaryForVehicle } from "../../../../../../lib/carfax/service";

export const runtime = "nodejs";

type VehicleCarfaxSummaryRouteProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export async function GET(_request: Request, { params }: VehicleCarfaxSummaryRouteProps) {
  const companyContext = await getCompanyContextResult({ requireOfficeAccess: true });

  if (companyContext.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (companyContext.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (companyContext.status === "no-company") {
    return NextResponse.json({ error: "No active company context." }, { status: 403 });
  }

  const context = companyContext.context;
  const { vehicleId } = await params;
  const vehicleResult = await getVehicleById(context.supabase, vehicleId);

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }

  if (!vehicleResult.data || vehicleResult.data.companyId !== context.companyId) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const summary = await readVehicleCarfaxSummaryForVehicle(
    context.supabase,
    vehicleResult.data
  );

  return NextResponse.json(summary);
}
