import { NextResponse } from "next/server";

import { processDataImportRunById } from "../../../../../../lib/data-imports/processor";
import { queueShopmonkeyDeltaImportRun } from "../../../../../../lib/data-imports/service";
import {
  buildShopmonkeyDeltaRunInput,
  getShopmonkeyWebhookHeader,
  isShopmonkeyWebhookTimestampFresh,
  parseShopmonkeyWebhookBody,
  verifyShopmonkeyWebhookSignature
} from "../../../../../../lib/data-imports/shopmonkey-webhook";
import { createServiceRoleSupabaseClient } from "../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

async function resolveAutomationUserId(client: ReturnType<typeof createServiceRoleSupabaseClient>, companyId: string) {
  const result = await client
    .from("company_memberships")
    .select("user_id, role")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("role", ["owner", "admin", "technician"])
    .order("role", { ascending: true })
    .limit(1);

  if (result.error) {
    throw result.error;
  }

  return result.data?.[0]?.user_id ?? null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await context.params;
  const client = createServiceRoleSupabaseClient();
  const accountResult = await client
    .from("migration_source_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("provider", "shopmonkey")
    .maybeSingle();

  if (accountResult.error) {
    return NextResponse.json({ error: accountResult.error.message }, { status: 500 });
  }

  if (!accountResult.data || !accountResult.data.webhook_secret) {
    return NextResponse.json({ error: "Unknown Shopmonkey webhook account." }, { status: 404 });
  }

  const webhookId = getShopmonkeyWebhookHeader(request.headers, "webhook-id");
  const webhookTimestamp = getShopmonkeyWebhookHeader(request.headers, "webhook-timestamp");
  const webhookSignature = getShopmonkeyWebhookHeader(request.headers, "webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: "Missing Shopmonkey webhook headers." }, { status: 400 });
  }

  if (!isShopmonkeyWebhookTimestampFresh(webhookTimestamp)) {
    return NextResponse.json({ error: "Stale Shopmonkey webhook." }, { status: 400 });
  }

  const payload = await request.text();

  if (
    !verifyShopmonkeyWebhookSignature({
      payload,
      secret: accountResult.data.webhook_secret,
      signatureHeader: webhookSignature,
      timestamp: webhookTimestamp,
      webhookId
    })
  ) {
    return NextResponse.json({ error: "Invalid Shopmonkey webhook signature." }, { status: 401 });
  }

  const body = parseShopmonkeyWebhookBody(payload);

  if (!body) {
    return NextResponse.json({ error: "Invalid Shopmonkey webhook payload." }, { status: 400 });
  }

  const automationUserId = await resolveAutomationUserId(client, accountResult.data.company_id);

  if (!automationUserId) {
    return NextResponse.json(
      { error: "No active company user is available to own the import run." },
      { status: 409 }
    );
  }

  const receivedAt = new Date().toISOString();
  const runInput: Parameters<typeof queueShopmonkeyDeltaImportRun>[1] =
    buildShopmonkeyDeltaRunInput({
      body,
      companyId: accountResult.data.company_id,
      startedByUserId: automationUserId,
      webhookId,
      webhookReceivedAt: receivedAt
    });

  const run = await queueShopmonkeyDeltaImportRun(client, runInput);

  await processDataImportRunById(run.id);

  const currentSettings =
    accountResult.data.settings_json &&
    typeof accountResult.data.settings_json === "object" &&
    !Array.isArray(accountResult.data.settings_json)
      ? accountResult.data.settings_json
      : {};
  await client
    .from("migration_source_accounts")
    .update({
      settings_json: {
        ...currentSettings,
        lastWebhookId: webhookId,
        lastWebhookOperation: body.operation ?? null,
        lastWebhookReceivedAt: receivedAt,
        lastWebhookTable: body.table ?? null
      }
    })
    .eq("id", accountId);

  return NextResponse.json({ ok: true, runId: run.id });
}
