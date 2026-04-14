import { NextResponse } from "next/server";

import { refreshLaborOperationStatsForObservedCompanies } from "../../../../../lib/labor-guide/processor";
import { getImportsProcessSecret } from "../../../../../lib/server-env";

export const runtime = "nodejs";

const MAX_COMPANY_REFRESH_LIMIT = 100;
const MAX_OBSERVATION_SCAN_LIMIT = 20000;

export async function POST(request: Request) {
  const processSecret = getImportsProcessSecret();
  const authorization = request.headers.get("authorization");

  if (!processSecret) {
    return NextResponse.json(
      { error: "IMPORTS_PROCESS_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (authorization !== `Bearer ${processSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    companyLimit?: number;
    observationScanLimit?: number;
  };
  const companyLimit =
    typeof body.companyLimit === "number"
      ? Math.min(Math.max(body.companyLimit, 1), MAX_COMPANY_REFRESH_LIMIT)
      : undefined;
  const observationScanLimit =
    typeof body.observationScanLimit === "number"
      ? Math.min(Math.max(body.observationScanLimit, 1), MAX_OBSERVATION_SCAN_LIMIT)
      : undefined;

  try {
    const result = await refreshLaborOperationStatsForObservedCompanies({
      ...(companyLimit ? { companyLimit } : {}),
      ...(observationScanLimit ? { observationScanLimit } : {})
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Labor guide refresh failed."
      },
      { status: 500 }
    );
  }
}
