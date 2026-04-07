import { getAssignedJobDetailForTechnician } from "@mobile-mechanic/api-client";
import { NextResponse } from "next/server";

import { upsertTechnicianJobCloseoutSyncMarker } from "../../../../../../lib/jobs/closeout-sync-markers";
import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../../lib/mobile-api-context";
import { getServiceRoleSupabaseClient } from "../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    jobId: string;
  }>;
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export async function OPTIONS(request: Request) {
  return buildMobileCorsPreflightResponse(request);
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        hasPendingAttachmentSync?: unknown;
        hasPendingInspectionSync?: unknown;
      }
    | null;

  if (
    !body ||
    !isBoolean(body.hasPendingAttachmentSync) ||
    !isBoolean(body.hasPendingInspectionSync)
  ) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid closeout sync payload." }, { status: 400 })
    );
  }

  try {
    const { jobId } = await params;
    const assignedJobResult = await getAssignedJobDetailForTechnician(
      context.supabase,
      context.companyId,
      context.currentUserId,
      jobId
    );

    if (assignedJobResult.error || !assignedJobResult.data) {
      throw assignedJobResult.error ?? new Error("Assigned job not found.");
    }

    const marker = await upsertTechnicianJobCloseoutSyncMarker({
      companyId: context.companyId,
      hasPendingAttachmentSync: body.hasPendingAttachmentSync,
      hasPendingInspectionSync: body.hasPendingInspectionSync,
      jobId,
      supabase: getServiceRoleSupabaseClient() as any,
      technicianUserId: context.currentUserId
    });

    return withMobileCors(
      request,
      NextResponse.json({
        marker,
        ok: true
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Closeout sync state could not be recorded.";
    const normalized = message.toLowerCase();
    const status =
      normalized === "unauthorized"
        ? 401
        : normalized === "forbidden"
          ? 403
          : normalized.includes("not found")
            ? 404
            : 400;

    return withMobileCors(request, NextResponse.json({ error: message }, { status }));
  }
}
