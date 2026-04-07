import type {
  Database,
  Json,
  MigrationSourceAccount,
  MigrationSourceCapabilities,
  MigrationSourceProvider
} from "@mobile-mechanic/types";

import type { AppSupabaseClient } from "../supabase/types";

type MigrationSourceAccountRow =
  Database["public"]["Tables"]["migration_source_accounts"]["Row"];
type MigrationSourceAccountInsert =
  Database["public"]["Tables"]["migration_source_accounts"]["Insert"];
type MigrationSourceAccountUpdate =
  Database["public"]["Tables"]["migration_source_accounts"]["Update"];

type UpsertMigrationSourceAccountRecordInput = {
  capabilitiesJson: MigrationSourceCapabilities;
  companyId: string;
  credentialCiphertext: string | null;
  credentialHint: string | null;
  displayName: string;
  lastErrorMessage?: string | null | undefined;
  lastVerifiedAt?: string | null | undefined;
  provider: MigrationSourceProvider;
  settingsJson: Json;
  status: MigrationSourceAccount["status"];
  webhookSecret?: string | null | undefined;
};

function asJson(value: Json): Json {
  return value;
}

function mapMigrationSourceAccountRow(
  row: MigrationSourceAccountRow
): MigrationSourceAccount {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider,
    status: row.status,
    displayName: row.display_name,
    credentialHint: row.credential_hint,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    lastVerifiedAt: row.last_verified_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listMigrationSourceAccountsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("migration_source_accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("provider", { ascending: true })
    .returns<MigrationSourceAccountRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapMigrationSourceAccountRow) : null
  };
}

export async function getMigrationSourceAccountByProvider(
  client: AppSupabaseClient,
  companyId: string,
  provider: MigrationSourceProvider
) {
  const result = await client
    .from("migration_source_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle<MigrationSourceAccountRow>();

  return {
    ...result,
    data: result.data ? mapMigrationSourceAccountRow(result.data) : null
  };
}

export async function upsertMigrationSourceAccount(
  client: AppSupabaseClient,
  input: UpsertMigrationSourceAccountRecordInput
) {
  const payload: MigrationSourceAccountInsert = {
    company_id: input.companyId,
    provider: input.provider,
    status: input.status,
    display_name: input.displayName,
    credential_ciphertext: input.credentialCiphertext,
    credential_hint: input.credentialHint,
    webhook_secret: input.webhookSecret ?? null,
    settings_json: asJson(input.settingsJson),
    capabilities_json: asJson(input.capabilitiesJson as unknown as Json),
    last_verified_at: input.lastVerifiedAt ?? null,
    last_error_message: input.lastErrorMessage ?? null
  };

  const result = await client
    .from("migration_source_accounts")
    .upsert(payload, { onConflict: "company_id,provider" })
    .select("*")
    .single<MigrationSourceAccountRow>();

  return {
    ...result,
    data: result.data ? mapMigrationSourceAccountRow(result.data) : null
  };
}

export async function updateMigrationSourceAccountStatus(
  client: AppSupabaseClient,
  accountId: string,
  input: {
    capabilitiesJson?: MigrationSourceCapabilities | null | undefined;
    lastErrorMessage?: string | null | undefined;
    lastVerifiedAt?: string | null | undefined;
    status: MigrationSourceAccount["status"];
  }
) {
  const payload: MigrationSourceAccountUpdate = {
    status: input.status,
    last_error_message: input.lastErrorMessage ?? null,
    last_verified_at: input.lastVerifiedAt ?? null
  };

  if (input.capabilitiesJson !== undefined) {
    payload.capabilities_json = input.capabilitiesJson as unknown as Json;
  }

  const result = await client
    .from("migration_source_accounts")
    .update(payload)
    .eq("id", accountId)
    .select("*")
    .single<MigrationSourceAccountRow>();

  return {
    ...result,
    data: result.data ? mapMigrationSourceAccountRow(result.data) : null
  };
}

export async function disconnectMigrationSourceAccount(
  client: AppSupabaseClient,
  companyId: string,
  provider: MigrationSourceProvider
) {
  const payload: MigrationSourceAccountUpdate = {
    capabilities_json: {},
    settings_json: {},
    status: "disconnected",
    credential_ciphertext: null,
    credential_hint: null,
    webhook_secret: null,
    last_error_message: null,
    last_verified_at: null
  };

  const result = await client
    .from("migration_source_accounts")
    .update(payload)
    .eq("company_id", companyId)
    .eq("provider", provider)
    .select("*")
    .single<MigrationSourceAccountRow>();

  return {
    ...result,
    data: result.data ? mapMigrationSourceAccountRow(result.data) : null
  };
}
