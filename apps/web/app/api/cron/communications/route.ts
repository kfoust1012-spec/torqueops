import { NextRequest, NextResponse } from "next/server";

import { processCommunicationAutomations } from "../../../../lib/communications/automation";
import { processQueuedCommunications } from "../../../../lib/communications/processor";
import { getCronSecret } from "../../../../lib/server-env";

export const runtime = "nodejs";

const DEFAULT_COMMUNICATION_PROCESS_LIMIT = 10;
const DEFAULT_COMMUNICATION_AUTOMATION_LIMIT = 10;

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automations = await processCommunicationAutomations({
    limitPerWorkflow: DEFAULT_COMMUNICATION_AUTOMATION_LIMIT
  });
  const result = await processQueuedCommunications(DEFAULT_COMMUNICATION_PROCESS_LIMIT);

  return NextResponse.json({
    ...result,
    automations
  });
}
