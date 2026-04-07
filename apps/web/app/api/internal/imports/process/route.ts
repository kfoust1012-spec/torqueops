import { NextResponse } from "next/server";

import { processDataImportRunById } from "../../../../../lib/data-imports/processor";
import { getImportsProcessSecret } from "../../../../../lib/server-env";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

const MAX_IMPORT_PROCESS_LIMIT = 10;

export async function POST(request: Request) {
  const processSecret = getImportsProcessSecret();
  const authorization = request.headers.get("authorization");

  if (!processSecret) {
    return NextResponse.json(
      { error: "IMPORTS_PROCESS_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (authorization !== `Bearer ${processSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    runId?: string;
  };

  if (body.runId) {
    const run = await processDataImportRunById(body.runId);
    return NextResponse.json({ processedRunIds: [run.id] });
  }

  const limit =
    typeof body.limit === "number"
      ? Math.min(Math.max(body.limit, 1), MAX_IMPORT_PROCESS_LIMIT)
      : 5;
  const client = createServiceRoleSupabaseClient();
  const queuedRuns = await client
    .from("data_import_runs")
    .select("id")
    .eq("provider", "shopmonkey")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queuedRuns.error) {
    return NextResponse.json({ error: queuedRuns.error.message }, { status: 500 });
  }

  const processedRunIds: string[] = [];

  for (const run of queuedRuns.data ?? []) {
    await processDataImportRunById(run.id);
    processedRunIds.push(run.id);
  }

  return NextResponse.json({
    processedRunIds
  });
}
