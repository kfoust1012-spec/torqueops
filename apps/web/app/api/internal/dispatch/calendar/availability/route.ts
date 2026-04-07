import { NextResponse } from "next/server";

import { createDispatchAvailabilityBlock } from "../../../../../../lib/dispatch/service";

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

  const result = await createDispatchAvailabilityBlock(context, body as never);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, block: result.data ?? null });
}
