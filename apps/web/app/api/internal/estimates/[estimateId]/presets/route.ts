import { NextResponse } from "next/server";
import {
  createEstimateLineItems,
  createEstimateSection,
  getEstimateById
} from "@mobile-mechanic/api-client";

import {
  autoSourceBestEstimateCatalogOffers,
  getEstimateWorkspace
} from "../../../../../../lib/estimates/workspace/service";
import { startPartRequestFromEstimate } from "../../../../../../lib/procurement/service";
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
    const sectionTitle =
      typeof body.sectionTitle === "string" ? body.sectionTitle.trim() : "";
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!sectionTitle) {
      return NextResponse.json(
        { error: "A quick repair preset title is required." },
        { status: 400 }
      );
    }

    if (!lines.length) {
      return NextResponse.json(
        { error: "Preset line items are required." },
        { status: 400 }
      );
    }

    const estimateResult = await getEstimateById(context.supabase, estimateId);

    if (estimateResult.error || !estimateResult.data) {
      throw estimateResult.error ?? new Error("Estimate could not be loaded.");
    }

    const sectionResult = await createEstimateSection(context.supabase, {
      companyId: context.companyId,
      createdByUserId: context.currentUserId,
      description,
      estimateId,
      jobId: estimateResult.data.jobId,
      notes: null,
      title: sectionTitle
    });

    if (sectionResult.error || !sectionResult.data) {
      throw sectionResult.error ?? new Error("Quick repair section could not be created.");
    }

    const sectionId = sectionResult.data.id;
    const lineResult = await createEstimateLineItems(
      context.supabase,
      estimateId,
      lines.map((line) => ({
        ...(line as Record<string, unknown>),
        estimateSectionId: sectionId
      })) as never
    );

    if (lineResult.error || !lineResult.data) {
      throw lineResult.error ?? new Error("Quick repair lines could not be created.");
    }

    const shouldSyncPartRequest = lineResult.data.some((line) => line.itemType === "part");

    if (shouldSyncPartRequest) {
      const requestResult = await startPartRequestFromEstimate(context.supabase, {
        companyId: context.companyId,
        estimateId,
        jobId: estimateResult.data.jobId,
        requestedByUserId: context.currentUserId
      });

      if (requestResult.error) {
        throw requestResult.error;
      }

      await autoSourceBestEstimateCatalogOffers(
        context.supabase,
        context.companyId,
        context.currentUserId,
        estimateId,
        {
          lineItemIds: (lineResult.data ?? [])
            .filter((lineItem) => lineItem.itemType === "part")
            .map((lineItem) => lineItem.id)
        }
      );
    }

    const workspace = await getEstimateWorkspace(context.supabase, context.companyId, estimateId);

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return createEstimateWorkspaceApiErrorResponse(
      error,
      "Quick repair preset could not be applied."
    );
  }
}
