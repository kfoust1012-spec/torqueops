import { NextRequest, NextResponse } from "next/server";

import { processDataImportRunById } from "../../../../lib/data-imports/processor";
import { getCronSecret } from "../../../../lib/server-env";
import { createServiceRoleSupabaseClient } from "../../../../lib/supabase/service-role";

export const runtime = "nodejs";

const DEFAULT_IMPORT_PROCESS_LIMIT = 5;

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createServiceRoleSupabaseClient();
  const queuedRuns = await client
    .from("data_import_runs")
    .select("id")
    .eq("provider", "shopmonkey")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(DEFAULT_IMPORT_PROCESS_LIMIT);

  if (queuedRuns.error) {
    return NextResponse.json({ error: queuedRuns.error.message }, { status: 500 });
  }

  const processedRunIds: string[] = [];

  for (const run of queuedRuns.data ?? []) {
    const processedRun = await processDataImportRunById(run.id);
    processedRunIds.push(processedRun.id);
  }

  return NextResponse.json({ processedRunIds });
}
