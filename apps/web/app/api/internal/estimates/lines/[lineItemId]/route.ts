import { NextResponse } from "next/server";

import {
  deleteEstimateWorkspaceLineItem,
  updateEstimateWorkspaceLineItem
} from "../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../_shared";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    lineItemId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { lineItemId } = await params;
    const workspace = await updateEstimateWorkspaceLineItem(
      context.supabase,
      context.companyId,
      context.currentUserId,
      lineItemId,
      body as never
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate line could not be saved."
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  try {
    const { lineItemId } = await params;
    const workspace = await deleteEstimateWorkspaceLineItem(
      context.supabase,
      context.companyId,
      context.currentUserId,
      lineItemId
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate line could not be removed."
    );
  }
}
