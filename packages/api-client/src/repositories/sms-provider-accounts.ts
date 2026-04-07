import type {
  Database,
  Json,
  SmsProvider,
  SmsProviderAccount,
  SmsProviderCapabilities
} from "@mobile-mechanic/types";

import type { AppSupabaseClient } from "../supabase/types";

type SmsProviderAccountRow = Database["public"]["Tables"]["sms_provider_accounts"]["Row"];
type SmsProviderAccountInsert = Database["public"]["Tables"]["sms_provider_accounts"]["Insert"];
type SmsProviderAccountUpdate = Database["public"]["Tables"]["sms_provider_accounts"]["Update"];

type UpsertSmsProviderAccountRecordInput = {
  capabilitiesJson: SmsProviderCapabilities;
  companyId: string;
  credentialCiphertext: string | null;
  credentialHint: string | null;
  displayName: string;
  fromNumber: string;
  isDefault: boolean;
  lastErrorMessage?: string | null | undefined;
  lastVerifiedAt?: string | null | undefined;
  provider: SmsProvider;
  settingsJson: Json;
  status: SmsProviderAccount["status"];
  username: string | null;
};

function asJson(value: Json): Json {
  return value;
}

function mapSmsProviderAccountRow(row: SmsProviderAccountRow): SmsProviderAccount {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider,
    status: row.status,
    displayName: row.display_name,
    username: row.username,
    fromNumber: row.from_number,
    isDefault: row.is_default,
    credentialHint: row.credential_hint,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    lastVerifiedAt: row.last_verified_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function clearDefaultSmsProviderAccount(
  client: AppSupabaseClient,
  companyId: string,
  providerToKeep?: SmsProvider
) {
  let builder = client
    .from("sms_provider_accounts")
    .update({ is_default: false })
    .eq("company_id", companyId)
    .eq("is_default", true);

  if (providerToKeep) {
    builder = builder.neq("provider", providerToKeep);
  }

  const result = await builder;

  if (result.error) {
    throw result.error;
  }
}

export async function listSmsProviderAccountsByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("provider", { ascending: true })
    .returns<SmsProviderAccountRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapSmsProviderAccountRow) : null
  };
}

export async function getSmsProviderAccountById(
  client: AppSupabaseClient,
  accountId: string
) {
  const result = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}

export async function getSmsProviderAccountByProvider(
  client: AppSupabaseClient,
  companyId: string,
  provider: SmsProvider
) {
  const result = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}

export async function getDefaultSmsProviderAccountByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const defaultResult = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle<SmsProviderAccountRow>();

  if (defaultResult.error) {
    return {
      ...defaultResult,
      data: null
    };
  }

  if (defaultResult.data) {
    return {
      ...defaultResult,
      data: mapSmsProviderAccountRow(defaultResult.data)
    };
  }

  const fallbackResult = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["connected", "action_required"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<SmsProviderAccountRow>();

  return {
    ...fallbackResult,
    data: fallbackResult.data ? mapSmsProviderAccountRow(fallbackResult.data) : null
  };
}

export async function upsertSmsProviderAccount(
  client: AppSupabaseClient,
  input: UpsertSmsProviderAccountRecordInput
) {
  if (input.isDefault) {
    await clearDefaultSmsProviderAccount(client, input.companyId, input.provider);
  }

  const payload: SmsProviderAccountInsert = {
    company_id: input.companyId,
    provider: input.provider,
    status: input.status,
    display_name: input.displayName,
    username: input.username,
    from_number: input.fromNumber,
    is_default: input.isDefault,
    credential_ciphertext: input.credentialCiphertext,
    credential_hint: input.credentialHint,
    settings_json: asJson(input.settingsJson),
    capabilities_json: asJson(input.capabilitiesJson as unknown as Json),
    last_verified_at: input.lastVerifiedAt ?? null,
    last_error_message: input.lastErrorMessage ?? null
  };

  const result = await client
    .from("sms_provider_accounts")
    .upsert(payload, { onConflict: "company_id,provider" })
    .select("*")
    .single<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}

export async function updateSmsProviderAccountStatus(
  client: AppSupabaseClient,
  accountId: string,
  input: {
    capabilitiesJson?: SmsProviderCapabilities | null | undefined;
    fromNumber?: string | undefined;
    isDefault?: boolean | undefined;
    lastErrorMessage?: string | null | undefined;
    lastVerifiedAt?: string | null | undefined;
    status: SmsProviderAccount["status"];
  }
) {
  const accountResult = await getSmsProviderAccountById(client, accountId);

  if (accountResult.error || !accountResult.data) {
    return {
      ...accountResult,
      data: null
    };
  }

  if (input.isDefault) {
    await clearDefaultSmsProviderAccount(client, accountResult.data.companyId, accountResult.data.provider);
  }

  const payload: SmsProviderAccountUpdate = {
    status: input.status,
    last_error_message: input.lastErrorMessage ?? null,
    last_verified_at: input.lastVerifiedAt ?? null
  };

  if (input.capabilitiesJson !== undefined) {
    payload.capabilities_json = input.capabilitiesJson as unknown as Json;
  }

  if (input.fromNumber !== undefined) {
    payload.from_number = input.fromNumber;
  }

  if (input.isDefault !== undefined) {
    payload.is_default = input.isDefault;
  }

  const result = await client
    .from("sms_provider_accounts")
    .update(payload)
    .eq("id", accountId)
    .select("*")
    .single<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}

export async function updateSmsProviderAccountSettingsJson(
  client: AppSupabaseClient,
  accountId: string,
  settingsJson: Json
) {
  const result = await client
    .from("sms_provider_accounts")
    .update({
      settings_json: asJson(settingsJson)
    })
    .eq("id", accountId)
    .select("*")
    .single<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}

export async function disconnectSmsProviderAccount(
  client: AppSupabaseClient,
  companyId: string,
  provider: SmsProvider
) {
  const payload: SmsProviderAccountUpdate = {
    status: "disconnected",
    username: null,
    credential_ciphertext: null,
    credential_hint: null,
    last_error_message: null,
    last_verified_at: null,
    is_default: false
  };

  const result = await client
    .from("sms_provider_accounts")
    .update(payload)
    .eq("company_id", companyId)
    .eq("provider", provider)
    .select("*")
    .single<SmsProviderAccountRow>();

  return {
    ...result,
    data: result.data ? mapSmsProviderAccountRow(result.data) : null
  };
}
