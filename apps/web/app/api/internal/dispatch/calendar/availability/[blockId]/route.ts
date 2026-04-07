import { NextResponse } from "next/server";

import {
  removeDispatchAvailabilityBlock,
  updateDispatchAvailabilityBlock
} from "../../../../../../../lib/dispatch/service";

import { parseJsonRequest, requireDispatchApiContext } from "../../_shared";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    blockId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { context: companyContext, response } = await requireDispatchApiContext();

  if (!companyContext) {
    return response;
  }

  const params = await context.params;
  const blockId = params.blockId?.trim();

  if (!blockId) {
    return NextResponse.json({ error: "Availability block ID is required." }, { status: 400 });
  }

  const result = await removeDispatchAvailabilityBlock(companyContext, blockId);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { context: companyContext, response } = await requireDispatchApiContext();

  if (!companyContext) {
    return response;
  }

  const params = await context.params;
  const blockId = params.blockId?.trim();

  if (!blockId) {
    return NextResponse.json({ error: "Availability block ID is required." }, { status: 400 });
  }

  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await updateDispatchAvailabilityBlock(companyContext, blockId, body as never);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, block: result.data ?? null });
}
