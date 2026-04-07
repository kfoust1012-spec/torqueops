import { NextResponse } from "next/server";

import { saveEstimateWorkspaceSectionAsPackage } from "../../../../../../../lib/estimates/workspace/service";

import {
  createEstimateWorkspaceApiErrorResponse,
  parseJsonRequest,
  requireEstimateWorkspaceApiContext
} from "../../../_shared";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    sectionId: string;
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
    const { sectionId } = await params;
    const servicePackage = await saveEstimateWorkspaceSectionAsPackage(
      context.supabase,
      context.companyId,
      context.currentUserId,
      sectionId,
      body as never
    );

    return NextResponse.json({ ok: true, servicePackage });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Section could not be saved as a reusable package."
    );
  }
}
