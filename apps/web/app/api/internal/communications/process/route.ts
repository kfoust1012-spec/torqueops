import { NextResponse } from "next/server";

import { processCommunicationAutomations } from "../../../../../lib/communications/automation";
import { processQueuedCommunications } from "../../../../../lib/communications/processor";
import { getCommunicationsProcessSecret } from "../../../../../lib/server-env";

export const runtime = "nodejs";

const MAX_COMMUNICATION_PROCESS_LIMIT = 20;
const MAX_COMMUNICATION_AUTOMATION_LIMIT = 25;

export async function POST(request: Request) {
  const processSecret = getCommunicationsProcessSecret();
  const authorization = request.headers.get("authorization");

  if (!processSecret) {
    return NextResponse.json(
      { error: "COMMUNICATIONS_PROCESS_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (authorization !== `Bearer ${processSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    automationLimit?: number;
    limit?: number;
    skipAutomations?: boolean;
  };
  const limit =
    typeof body.limit === "number"
      ? Math.min(Math.max(body.limit, 1), MAX_COMMUNICATION_PROCESS_LIMIT)
      : 10;
  const automationLimit =
    typeof body.automationLimit === "number"
      ? Math.min(Math.max(body.automationLimit, 1), MAX_COMMUNICATION_AUTOMATION_LIMIT)
      : 10;
  const automationResult = body.skipAutomations
    ? null
    : await processCommunicationAutomations({ limitPerWorkflow: automationLimit });
  const result = await processQueuedCommunications(limit);

  return NextResponse.json({
    ...result,
    automations: automationResult
  });
}
