import type { CreateDataImportRunInput, DataImportRun, Database, Json } from "@mobile-mechanic/types";
import { createDataImportRunInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type DataImportRunRow = Database["public"]["Tables"]["data_import_runs"]["Row"];
type DataImportRunInsert = Database["public"]["Tables"]["data_import_runs"]["Insert"];
type DataImportRunUpdate = Database["public"]["Tables"]["data_import_runs"]["Update"];

function asJson(value: Json): Json {
  return value;
}

function mapDataImportRunRow(row: DataImportRunRow): DataImportRun {
  return {
    id: row.id,
    companyId: row.company_id,
    sourceAccountId: row.source_account_id,
    provider: row.provider,
    status: row.status,
    startedByUserId: row.started_by_user_id,
    optionsJson: row.options_json,
    summaryJson: row.summary_json,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listDataImportRunsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  limit = 10
) {
  const result = await client
    .from("data_import_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DataImportRunRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapDataImportRunRow) : null
  };
}

export async function getDataImportRunById(client: AppSupabaseClient, runId: string) {
  const result = await client
    .from("data_import_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle<DataImportRunRow>();

  return {
    ...result,
    data: result.data ? mapDataImportRunRow(result.data) : null
  };
}

export async function createDataImportRun(
  client: AppSupabaseClient,
  input: CreateDataImportRunInput
) {
  const parsed = createDataImportRunInputSchema.parse(input);
  const payload: DataImportRunInsert = {
    company_id: parsed.companyId,
    source_account_id: parsed.sourceAccountId,
    provider: parsed.provider,
    started_by_user_id: parsed.startedByUserId,
    options_json: asJson((parsed.optionsJson ?? {}) as Json)
  };

  const result = await client
    .from("data_import_runs")
    .insert(payload)
    .select("*")
    .single<DataImportRunRow>();

  return {
    ...result,
    data: result.data ? mapDataImportRunRow(result.data) : null
  };
}

export async function claimDataImportRunForProcessing(
  client: AppSupabaseClient,
  runId: string
) {
  const now = new Date().toISOString();
  const payload: DataImportRunUpdate = {
    status: "processing",
    started_at: now,
    finished_at: null,
    last_heartbeat_at: now,
    last_error_message: null
  };

  const result = await client
    .from("data_import_runs")
    .update(payload)
    .eq("id", runId)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle<DataImportRunRow>();

  return {
    ...result,
    data: result.data ? mapDataImportRunRow(result.data) : null
  };
}

export async function updateDataImportRun(
  client: AppSupabaseClient,
  runId: string,
  input: {
    finishedAt?: string | null | undefined;
    lastErrorMessage?: string | null | undefined;
    lastHeartbeatAt?: string | null | undefined;
    startedAt?: string | null | undefined;
    status?: DataImportRun["status"] | undefined;
    summaryJson?: Json | undefined;
  }
) {
  const payload: DataImportRunUpdate = {};

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.startedAt !== undefined) {
    payload.started_at = input.startedAt;
  }

  if (input.finishedAt !== undefined) {
    payload.finished_at = input.finishedAt;
  }

  if (input.lastHeartbeatAt !== undefined) {
    payload.last_heartbeat_at = input.lastHeartbeatAt;
  }

  if (input.lastErrorMessage !== undefined) {
    payload.last_error_message = input.lastErrorMessage;
  }

  if (input.summaryJson !== undefined) {
    payload.summary_json = asJson(input.summaryJson);
  }

  const result = await client
    .from("data_import_runs")
    .update(payload)
    .eq("id", runId)
    .select("*")
    .single<DataImportRunRow>();

  return {
    ...result,
    data: result.data ? mapDataImportRunRow(result.data) : null
  };
}
