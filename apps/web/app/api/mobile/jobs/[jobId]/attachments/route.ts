import { createAssignedJobAttachment } from "@mobile-mechanic/api-client";
import type { AttachmentMimeType } from "@mobile-mechanic/types";
import { attachmentCategorySchema, attachmentMimeTypeSchema } from "@mobile-mechanic/validation";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

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

async function parseAttachmentRequest(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Select a photo or video before saving stop evidence.");
  }

  const mimeType = attachmentMimeTypeSchema.parse(file.type) as AttachmentMimeType;
  const category = attachmentCategorySchema.parse(formData.get("category"));
  const captionEntry = formData.get("caption");
  const inspectionIdEntry = formData.get("inspectionId");
  const inspectionItemIdEntry = formData.get("inspectionItemId");

  return {
    category,
    caption: typeof captionEntry === "string" ? captionEntry : "",
    file,
    inspectionId: typeof inspectionIdEntry === "string" && inspectionIdEntry.trim() ? inspectionIdEntry : null,
    inspectionItemId:
      typeof inspectionItemIdEntry === "string" && inspectionItemIdEntry.trim()
        ? inspectionItemIdEntry
        : null,
    mimeType
  };
}

export async function OPTIONS(request: Request) {
  return buildMobileCorsPreflightResponse(request);
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  try {
    const { jobId } = await params;
    const parsed = await parseAttachmentRequest(request);
    const fileSizeBytes = parsed.file.size || 1;
    const serviceRole = getServiceRoleSupabaseClient();
    const result = await createAssignedJobAttachment(serviceRole, context.companyId, context.currentUserId, parsed.file, {
      id: randomUUID(),
      companyId: context.companyId,
      jobId,
      inspectionId: parsed.inspectionId,
      inspectionItemId: parsed.inspectionItemId,
      uploadedByUserId: context.currentUserId,
      fileName: parsed.file.name || `attachment-${Date.now()}`,
      mimeType: parsed.mimeType,
      fileSizeBytes,
      category: parsed.category,
      caption: parsed.caption
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("The evidence could not be saved.");
    }

    return withMobileCors(
      request,
      NextResponse.json({
        attachment: result.data,
        ok: true
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim() ? error.message : "The evidence could not be saved.";
    const normalized = message.toLowerCase();
    const status =
      normalized === "unauthorized"
        ? 401
        : normalized === "forbidden"
          ? 403
          : 400;

    return withMobileCors(request, NextResponse.json({ error: message }, { status }));
  }
}
