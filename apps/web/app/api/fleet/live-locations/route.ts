import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../lib/company-context";
import { listFleetLiveDevices } from "../../../../lib/fleet/live-location-service";

export async function GET() {
  const companyContextResult = await getCompanyContextResult({ requireOfficeAccess: true });

  if (companyContextResult.status === "unauthenticated") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (companyContextResult.status === "no-company") {
    return NextResponse.json({ error: "No company context is available." }, { status: 404 });
  }

  if (companyContextResult.status === "forbidden") {
    return NextResponse.json({ error: "Fleet access is not available for this user." }, { status: 403 });
  }

  const { context } = companyContextResult;
  const liveDevicesResult = await listFleetLiveDevices({
    companyId: context.companyId,
    supabase: context.supabase
  });

  if (liveDevicesResult.error || !liveDevicesResult.data) {
    return NextResponse.json({ error: "Unable to load live technician locations." }, { status: 500 });
  }

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    technicians: liveDevicesResult.data
  });
}
