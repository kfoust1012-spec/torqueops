import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../../../lib/company-context";
import { parseVehicleServiceHistoryUrlSearchParams } from "../../../../../../lib/service-history/filters";
import { getVehicleServiceHistory } from "../../../../../../lib/service-history/service";

export const runtime = "nodejs";

type VehicleHistoryRouteProps = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export async function GET(request: Request, { params }: VehicleHistoryRouteProps) {
  try {
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
    const filters = parseVehicleServiceHistoryUrlSearchParams(new URL(request.url).searchParams);
    const history = await getVehicleServiceHistory(context.supabase, context.companyId, vehicleId, filters);

    if (!history) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }

    return NextResponse.json(history);
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        {
          error: "Invalid history query.",
          issues: (error as { issues: unknown }).issues
        },
        { status: 400 }
      );
    }

    throw error;
  }
}