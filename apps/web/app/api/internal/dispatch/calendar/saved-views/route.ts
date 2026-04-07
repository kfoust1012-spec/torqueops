import { NextResponse } from "next/server";

import { saveDispatchView } from "../../../../../../lib/dispatch/service";

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

  try {
    const savedView = await saveDispatchView(context, body as never);
    return NextResponse.json({ ok: true, savedView });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saved view could not be created." },
      { status: 400 }
    );
  }
}
