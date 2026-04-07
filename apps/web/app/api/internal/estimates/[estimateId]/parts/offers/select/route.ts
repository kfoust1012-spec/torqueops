import { NextResponse } from "next/server";

import { selectEstimatePartOffer } from "../../../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../../../_shared";

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
    const workspace = await selectEstimatePartOffer(
      context.supabase,
      context.companyId,
      context.currentUserId,
      estimateId,
      body as never
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Supplier offer could not be selected."
    );
  }
}
