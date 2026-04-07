import { NextResponse } from "next/server";

import {
  deleteEstimateWorkspaceSection,
  updateEstimateWorkspaceSection
} from "../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../_shared";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    sectionId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body || typeof body.estimateId !== "string") {
    return NextResponse.json({ error: "Estimate id is required." }, { status: 400 });
  }

  try {
    const { sectionId } = await params;
    const workspace = await updateEstimateWorkspaceSection(
      context.supabase,
      context.companyId,
      body.estimateId,
      sectionId,
      body as never
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate section could not be saved."
    );
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const { context, response } = await requireEstimateWorkspaceApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body || typeof body.estimateId !== "string") {
    return NextResponse.json({ error: "Estimate id is required." }, { status: 400 });
  }

  try {
    const { sectionId } = await params;
    const workspace = await deleteEstimateWorkspaceSection(
      context.supabase,
      context.companyId,
      body.estimateId,
      sectionId
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Estimate section could not be removed."
    );
  }
}
