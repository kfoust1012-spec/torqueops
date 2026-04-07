import {
  getCustomerDocumentLinkById,
  recordCustomerDocumentLinkEvent
} from "@mobile-mechanic/api-client";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "../../../../../lib/auth";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";

function getLinkId(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = (body as { linkId?: unknown }).linkId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const linkId = getLinkId(body);

  if (!linkId) {
    return NextResponse.json({ error: "Missing linkId." }, { status: 400 });
  }

  const linkResult = await getCustomerDocumentLinkById(supabase, linkId);

  if (linkResult.error) {
    throw linkResult.error;
  }

  if (!linkResult.data) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const eventResult = await recordCustomerDocumentLinkEvent(supabase, {
    linkId: linkResult.data.id,
    companyId: linkResult.data.companyId,
    customerId: linkResult.data.customerId,
    jobId: linkResult.data.jobId,
    documentKind: linkResult.data.documentKind,
    estimateId: linkResult.data.estimateId,
    invoiceId: linkResult.data.invoiceId,
    eventType: "copied",
    createdByUserId: user.id
  });

  if (eventResult.error) {
    throw eventResult.error;
  }

  return NextResponse.json({ ok: true });
}