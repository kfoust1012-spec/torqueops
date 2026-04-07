import { getAssignedJobEstimateSummary } from "@mobile-mechanic/api-client";
import { NextResponse } from "next/server";

import { searchEstimateLiveRetailerOffers } from "../../../../../../../lib/estimates/workspace/service";
import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../../../lib/mobile-api-context";
import { getServiceRoleSupabaseClient } from "../../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return buildMobileCorsPreflightResponse(request);
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    );
  }

  try {
    const { jobId } = await params;
    const assignedEstimateResult = await getAssignedJobEstimateSummary(
      context.supabase,
      context.companyId,
      context.currentUserId,
      jobId
    );

    if (assignedEstimateResult.error || !assignedEstimateResult.data) {
      throw assignedEstimateResult.error ?? new Error("Assigned job not found.");
    }

    const result = await searchEstimateLiveRetailerOffers(
      getServiceRoleSupabaseClient(),
      context.companyId,
      assignedEstimateResult.data.estimate.id,
      body as never
    );

    return withMobileCors(request, NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Live retailer lookup could not be completed.";
    const normalizedMessage = message.toLowerCase();
    const status =
      normalizedMessage === "unauthorized"
        ? 401
        : normalizedMessage === "forbidden"
          ? 403
          : message === "Live retailer lookup could not be completed."
            ? 500
            : 400;

    return withMobileCors(request, NextResponse.json({ error: message }, { status }));
  }
}
