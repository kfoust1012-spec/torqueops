import { NextResponse } from "next/server";

import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../lib/mobile-api-context";
import { registerTechnicianPushSubscription } from "../../../../../lib/mobile-push-notifications";

export const runtime = "nodejs";

type PushSubscriptionRequestBody = {
  expoPushToken?: string;
  installationId?: string;
  platform?: string;
};

function isSupportedPlatform(value: string): value is "android" | "ios" {
  return value === "android" || value === "ios";
}

export async function OPTIONS(request: Request) {
  return buildMobileCorsPreflightResponse(request);
}

export async function POST(request: Request) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as PushSubscriptionRequestBody | null;
  const expoPushToken = body?.expoPushToken?.trim() ?? "";
  const installationId = body?.installationId?.trim() ?? "";
  const platform = body?.platform?.trim() ?? "";

  if (!expoPushToken || !installationId || !isSupportedPlatform(platform)) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid push subscription payload." }, { status: 400 })
    );
  }

  await registerTechnicianPushSubscription({
    companyId: context.companyId,
    expoPushToken,
    installationId,
    platform,
    technicianUserId: context.currentUserId
  });

  return withMobileCors(request, NextResponse.json({ ok: true }));
}
