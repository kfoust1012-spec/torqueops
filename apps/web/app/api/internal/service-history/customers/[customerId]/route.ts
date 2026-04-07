import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../../../lib/company-context";
import { parseCustomerServiceHistoryUrlSearchParams } from "../../../../../../lib/service-history/filters";
import { getCustomerServiceHistory } from "../../../../../../lib/service-history/service";

export const runtime = "nodejs";

type CustomerHistoryRouteProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(request: Request, { params }: CustomerHistoryRouteProps) {
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
    const { customerId } = await params;
    const filters = parseCustomerServiceHistoryUrlSearchParams(new URL(request.url).searchParams);
    const history = await getCustomerServiceHistory(context.supabase, context.companyId, customerId, filters);

    if (!history) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
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