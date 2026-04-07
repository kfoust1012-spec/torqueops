import { NextResponse } from "next/server";

import {
  getEstimateWorkspace,
  updateEstimateWorkspaceMeta
} from "../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../_shared";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    estimateId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  try {
    const { estimateId } = await params;
    const workspace = await getEstimateWorkspace(context.supabase, context.companyId, estimateId);

    if (workspace.estimate.companyId !== context.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate builder could not be loaded."
    );
  }
}

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
    const { estimateId } = await params;
    const workspace = await updateEstimateWorkspaceMeta(
      context.supabase,
      context.companyId,
      estimateId,
      body as never
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate settings could not be saved."
    );
  }
}
