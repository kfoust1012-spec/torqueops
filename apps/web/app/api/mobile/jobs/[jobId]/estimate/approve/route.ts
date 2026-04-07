import { approveAssignedJobEstimate } from "@mobile-mechanic/api-client";
import { maxSignatureFileSizeBytes } from "@mobile-mechanic/types";
import {
  approvalStatementSchema,
  signerNameSchema
} from "@mobile-mechanic/validation";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

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

function decodePngBase64(pngBase64: string) {
  const normalized = pngBase64
    .trim()
    .replace(/^data:image\/png;base64,/i, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(Buffer.from(normalized, "base64"));

  if (!bytes.byteLength) {
    throw new Error("The approval signature could not be read.");
  }

  if (bytes.byteLength > maxSignatureFileSizeBytes) {
    throw new Error("The approval signature is too large to save.");
  }

  return bytes;
}

function validatePngBytes(pngBytes: Uint8Array) {
  if (!pngBytes.byteLength) {
    throw new Error("The approval signature could not be read.");
  }

  if (pngBytes.byteLength > maxSignatureFileSizeBytes) {
    throw new Error("The approval signature is too large to save.");
  }

  return pngBytes;
}

async function parseApprovalRequest(request: Request) {
  const formData = await request.clone().formData().catch(() => null);

  if (formData && (formData.has("signature") || formData.has("signedByName") || formData.has("statement"))) {
    const signature = formData.get("signature");

    if (!(signature instanceof File)) {
      throw new Error("Capture the customer signature before saving approval.");
    }

    return {
      pngBytes: validatePngBytes(new Uint8Array(await signature.arrayBuffer())),
      signedByName: signerNameSchema.parse(formData.get("signedByName")),
      statement: approvalStatementSchema.parse(formData.get("statement"))
    };
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    throw new Error("Invalid request body.");
  }

  const pngBase64 = typeof body.pngBase64 === "string" ? body.pngBase64.trim() : "";

  if (pngBase64.length < 32) {
    throw new Error("Capture the customer signature before saving approval.");
  }

  return {
    pngBytes: validatePngBytes(decodePngBase64(pngBase64)),
    signedByName: signerNameSchema.parse(body.signedByName),
    statement: approvalStatementSchema.parse(body.statement)
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
    const parsed = await parseApprovalRequest(request);
    const serviceRole = getServiceRoleSupabaseClient();
    const result = await approveAssignedJobEstimate(
      serviceRole,
      context.companyId,
      context.currentUserId,
      jobId,
      parsed.pngBytes,
      {
        fileSizeBytes: parsed.pngBytes.byteLength,
        mimeType: "image/png",
        signatureId: randomUUID(),
        signedByName: parsed.signedByName,
        statement: parsed.statement
      }
    );

    if (result.error || !result.data) {
      throw result.error ?? new Error("The approval signature could not be saved.");
    }

    return withMobileCors(
      request,
      NextResponse.json({
        approvedAt: result.data.acceptedAt,
        estimateId: result.data.id,
        ok: true,
        status: result.data.status
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "The approval signature could not be saved.";
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
