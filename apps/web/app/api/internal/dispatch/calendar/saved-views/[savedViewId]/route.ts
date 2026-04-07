import { NextResponse } from "next/server";
import type { UpdateDispatchSavedViewInput } from "@mobile-mechanic/types";

import { deleteSavedDispatchView, saveDispatchView } from "../../../../../../../lib/dispatch/service";

import { parseJsonRequest, requireDispatchApiContext } from "../../_shared";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    savedViewId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { context: companyContext, response } = await requireDispatchApiContext();

  if (!companyContext) {
    return response;
  }

  const params = await context.params;
  const savedViewId = params.savedViewId?.trim();
  const body = await parseJsonRequest<Record<string, unknown>>(request);

  if (!savedViewId || !body) {
    return NextResponse.json({ error: "Invalid saved view update." }, { status: 400 });
  }

  try {
    const savedViewInput: UpdateDispatchSavedViewInput & {
      savedViewId: string;
      technicianUserIds: string[];
    } = {
      includeUnassigned:
        typeof body.includeUnassigned === "boolean" ? body.includeUnassigned : undefined,
      isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
      name: typeof body.name === "string" ? body.name : "",
      savedViewId,
      scope: body.scope as UpdateDispatchSavedViewInput["scope"],
      technicianUserIds: Array.isArray(body.technicianUserIds)
        ? body.technicianUserIds.filter((value): value is string => typeof value === "string")
        : [],
      view: body.view as UpdateDispatchSavedViewInput["view"]
    };
    const savedView = await saveDispatchView(companyContext, {
      ...savedViewInput
    });
    return NextResponse.json({ ok: true, savedView });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saved view could not be updated." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { context: companyContext, response } = await requireDispatchApiContext();

  if (!companyContext) {
    return response;
  }

  const params = await context.params;
  const savedViewId = params.savedViewId?.trim();

  if (!savedViewId) {
    return NextResponse.json({ error: "Saved view ID is required." }, { status: 400 });
  }

  try {
    await deleteSavedDispatchView(companyContext, savedViewId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saved view could not be deleted." },
      { status: 400 }
    );
  }
}
