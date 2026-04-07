import { NextResponse } from "next/server";
import { getJobById } from "@mobile-mechanic/api-client";

import { resizeDispatchCalendarJob } from "../../../../../../lib/dispatch/service";
import { sendTechnicianJobPushNotification } from "../../../../../../lib/mobile-push-notifications";

import { parseJsonRequest, requireDispatchApiContext } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { context, response } = await requireDispatchApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const previousJobResult = jobId ? await getJobById(context.supabase, jobId) : null;
  const result = await resizeDispatchCalendarJob(context, body as never);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  if (result.data) {
    await sendTechnicianJobPushNotification({
      companyId: context.companyId,
      companyTimeZone: context.company.timezone,
      nextJob: result.data,
      previousJob: previousJobResult?.data ?? null
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, job: result.data ?? null });
}
