import { NextResponse } from "next/server";

import { searchEstimateLiveRetailerOffers } from "../../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../../_shared";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    estimateId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { estimateId } = await params;
    const result = await searchEstimateLiveRetailerOffers(
      context.supabase,
      context.companyId,
      estimateId,
      body as never
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Live retailer lookup could not be completed."
    );
  }
}
