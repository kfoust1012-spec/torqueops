import { randomUUID } from "node:crypto";

import type { AppSupabaseClient } from "@mobile-mechanic/api-client";
import {
  createDataImportRun,
  disconnectMigrationSourceAccount,
  getDataImportRunById,
  getMigrationSourceAccountByProvider,
  listDataImportRunsByCompany,
  listMigrationSourceAccountsByCompany,
  updateMigrationSourceAccountStatus,
  upsertMigrationSourceAccount
} from "@mobile-mechanic/api-client";
import type {
  Database,
  Json,
  MigrationSourceCapabilities,
  ShopmonkeyMigrationSourceSettings,
  UpsertMigrationSourceAccountInput
} from "@mobile-mechanic/types";
import {
  disconnectMigrationSourceAccountInputSchema,
  upsertMigrationSourceAccountInputSchema
} from "@mobile-mechanic/validation";

import {
  buildCredentialHint,
  decryptProviderCredential,
  encryptProviderCredential
} from "./credentials";
import { buildAppUrl } from "../server-env";
import { verifyShopmonkeyConnection } from "./shopmonkey-client";

type MigrationSourceAccountRow =
  Database["public"]["Tables"]["migration_source_accounts"]["Row"];

export type DataImportRunEntitySummary = {
  created: number;
  id: string;
  label: string;
  total: number;
  updated: number;
};

export type DataImportRunWebhookSummary = {
  id: string | null;
  operation: string | null;
  receivedAt: string | null;
  table: string | null;
};

const DATA_IMPORT_RUN_ENTITY_SUMMARY_CONFIG = [
  {
    createdKey: "customersCreated",
    id: "customers",
    label: "Customers",
    updatedKey: "customersUpdated"
  },
  {
    createdKey: "customerAddressesCreated",
    id: "customerAddresses",
    label: "Addresses",
    updatedKey: "customerAddressesUpdated"
  },
  {
    createdKey: "vehiclesCreated",
    id: "vehicles",
    label: "Vehicles",
    updatedKey: "vehiclesUpdated"
  },
  {
    createdKey: "jobsCreated",
    id: "jobs",
    label: "Visits",
    updatedKey: "jobsUpdated"
  },
  {
    createdKey: "estimatesCreated",
    id: "estimates",
    label: "Estimates",
    updatedKey: null
  },
  {
    createdKey: "invoicesCreated",
    id: "invoices",
    label: "Invoices",
    updatedKey: null
  },
  {
    createdKey: "inspectionsCreated",
    id: "inspections",
    label: "Inspections",
    updatedKey: null
  },
  {
    createdKey: "attachmentsCreated",
    id: "attachments",
    label: "Attachments",
    updatedKey: null
  }
] as const;

function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function toJsonStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toJsonNumber(value: Json | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildDefaultCapabilities(): MigrationSourceCapabilities {
  return {
    supportsCustomerImport: false,
    supportsVehicleImport: false,
    supportsOrderImport: false,
    supportsInspectionImport: false,
    supportsExportApi: false,
    supportsWebhooks: false
  };
}

function buildInitialImportRunOptions() {
  return {
    mode: "full",
    requestPresignedUrl: true,
    tables: ["customer", "vehicle", "order", "inspection"]
  } as Json;
}

function buildShopmonkeySettingsJson(
  input: ReturnType<typeof normalizeShopmonkeyInput>,
  accountId: string
) {
  const settings: ShopmonkeyMigrationSourceSettings = {
    apiKeyHint: buildCredentialHint(input.apiKey),
    webhookUrl: buildAppUrl(`/api/webhooks/imports/shopmonkey/${accountId}`)
  };

  return settings as unknown as Json;
}

function normalizeShopmonkeyInput(input: UpsertMigrationSourceAccountInput) {
  const parsed = upsertMigrationSourceAccountInputSchema.parse(input);

  if (parsed.provider !== "shopmonkey") {
    throw new Error("Expected a Shopmonkey migration-source input.");
  }

  return {
    ...parsed,
    apiKey: parsed.apiKey.trim(),
    displayName: parsed.displayName.trim()
  };
}

async function getMigrationSourceAccountRow(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("migration_source_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", "shopmonkey")
    .maybeSingle<MigrationSourceAccountRow>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? null;
}

export function getExportFileName(summaryJson: Json | null | undefined) {
  const summary = toJsonObject(summaryJson);
  return typeof summary.exportFileName === "string" ? summary.exportFileName : null;
}

export function getImportRunExportRequestError(summaryJson: Json | null | undefined) {
  const summary = toJsonObject(summaryJson);
  return toOptionalString(summary.exportRequestError);
}

export function getImportRunEntitySummaries(
  summaryJson: Json | null | undefined
): DataImportRunEntitySummary[] {
  const counts = toJsonObject(toJsonObject(summaryJson).counts);

  return DATA_IMPORT_RUN_ENTITY_SUMMARY_CONFIG.map((config) => {
    const created = toJsonNumber(counts[config.createdKey]);
    const updated = config.updatedKey ? toJsonNumber(counts[config.updatedKey]) : 0;

    return {
      created,
      id: config.id,
      label: config.label,
      total: created + updated,
      updated
    };
  });
}

export function getImportRunFailures(summaryJson: Json | null | undefined) {
  const summary = toJsonObject(summaryJson);
  return toJsonStringArray(summary.failures);
}

export function getImportRunMode(optionsJson: Json | null | undefined) {
  const options = toJsonObject(optionsJson);
  return options.mode === "delta" ? "delta" : "full";
}

export function getImportRunRequestedTables(
  summaryJson: Json | null | undefined,
  optionsJson: Json | null | undefined
) {
  const summary = toJsonObject(summaryJson);
  const requestedTables = toJsonStringArray(summary.requestedTables);

  if (requestedTables.length) {
    return requestedTables;
  }

  const options = toJsonObject(optionsJson);
  return toJsonStringArray(options.tables);
}

export function getImportRunWebhookSummary(optionsJson: Json | null | undefined) {
  const options = toJsonObject(optionsJson);
  const webhook = toJsonObject(options.webhook);
  const id = toOptionalString(webhook.id);
  const operation = toOptionalString(webhook.operation);
  const receivedAt = toOptionalString(webhook.receivedAt);
  const table = toOptionalString(webhook.table);

  if (!id && !operation && !receivedAt && !table) {
    return null;
  }

  return {
    id,
    operation,
    receivedAt,
    table
  } satisfies DataImportRunWebhookSummary;
}

export async function getDataImportSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [accountsResult, runsResult] = await Promise.all([
    listMigrationSourceAccountsByCompany(client, companyId),
    listDataImportRunsByCompany(client, companyId)
  ]);

  if (accountsResult.error) {
    throw accountsResult.error;
  }

  if (runsResult.error) {
    throw runsResult.error;
  }

  return {
    accounts: accountsResult.data ?? [],
    runs: runsResult.data ?? []
  };
}

export async function getShopmonkeyMigrationSourceSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [workspace, accountResult] = await Promise.all([
    getDataImportSettingsWorkspace(client, companyId),
    getMigrationSourceAccountByProvider(client, companyId, "shopmonkey")
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }

  const account = accountResult.data ?? null;
  const recentRuns = account
    ? workspace.runs.filter((run) => run.sourceAccountId === account.id)
    : [];
  const latestRun = recentRuns[0] ?? null;

  return {
    ...workspace,
    account,
    latestRun,
    recentRuns
  };
}

export async function getShopmonkeyImportRunDetailWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  runId: string
) {
  const [workspace, runResult] = await Promise.all([
    getShopmonkeyMigrationSourceSettingsWorkspace(client, companyId),
    getDataImportRunById(client, runId)
  ]);

  if (runResult.error) {
    throw runResult.error;
  }

  const run = runResult.data;

  if (
    !workspace.account ||
    !run ||
    run.companyId !== companyId ||
    run.provider !== "shopmonkey" ||
    run.sourceAccountId !== workspace.account.id
  ) {
    return null;
  }

  return {
    ...workspace,
    run
  };
}

export async function saveShopmonkeyMigrationSourceAccountSettings(
  client: AppSupabaseClient,
  input: UpsertMigrationSourceAccountInput
) {
  const normalizedInput = normalizeShopmonkeyInput(input);
  const existingAccount = await getMigrationSourceAccountRow(client, normalizedInput.companyId);
  const accountId = existingAccount?.id ?? randomUUID();
  const accountResult = await upsertMigrationSourceAccount(client, {
    capabilitiesJson: buildDefaultCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext: encryptProviderCredential(normalizedInput.apiKey),
    credentialHint: buildCredentialHint(normalizedInput.apiKey),
    displayName: normalizedInput.displayName,
    provider: "shopmonkey",
    settingsJson: buildShopmonkeySettingsJson(normalizedInput, accountId),
    status: "action_required",
    webhookSecret: existingAccount?.webhook_secret ?? randomUUID().replaceAll("-", "")
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("Shopmonkey settings could not be saved.");
  }

  return accountResult.data;
}

export async function queueShopmonkeyDeltaImportRun(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    customerId?: string;
    operation?: string;
    orderId?: string;
    startedByUserId: string;
    table?: string;
    vehicleId?: string;
    webhookId?: string;
    webhookReceivedAt?: string;
  }
) {
  const accountResult = await getMigrationSourceAccountByProvider(
    client,
    input.companyId,
    "shopmonkey"
  );

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (!accountResult.data) {
    throw new Error("Shopmonkey is not configured for this company.");
  }

  const runResult = await createDataImportRun(client, {
    companyId: input.companyId,
    sourceAccountId: accountResult.data.id,
    provider: "shopmonkey",
    startedByUserId: input.startedByUserId,
    optionsJson: {
      customerId: input.customerId ?? null,
      mode: "delta",
      orderId: input.orderId ?? null,
      requestPresignedUrl: false,
      tables: [],
      vehicleId: input.vehicleId ?? null,
      webhook: {
        id: input.webhookId ?? null,
        operation: input.operation ?? null,
        receivedAt: input.webhookReceivedAt ?? null,
        table: input.table ?? null
      }
    } as Json
  });

  if (runResult.error || !runResult.data) {
    throw runResult.error ?? new Error("Shopmonkey delta import run could not be created.");
  }

  return runResult.data;
}

export async function verifyShopmonkeyMigrationSourceConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  const accountRow = await getMigrationSourceAccountRow(client, companyId);

  if (!accountRow) {
    throw new Error("Shopmonkey is not configured for this company.");
  }

  const apiKey = decryptProviderCredential(accountRow.credential_ciphertext);

  if (!apiKey) {
    throw new Error("Shopmonkey credential is not available.");
  }

  const verification = await verifyShopmonkeyConnection(apiKey);
  const statusResult = await updateMigrationSourceAccountStatus(client, accountRow.id, {
    capabilitiesJson: verification.capabilities,
    lastErrorMessage: verification.lastErrorMessage,
    lastVerifiedAt: new Date().toISOString(),
    status: verification.status
  });

  if (statusResult.error || !statusResult.data) {
    throw statusResult.error ?? new Error("Shopmonkey status could not be updated.");
  }

  return {
    account: statusResult.data,
    verification
  };
}

export async function queueShopmonkeyInitialImportRun(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    startedByUserId: string;
  }
) {
  const accountResult = await getMigrationSourceAccountByProvider(
    client,
    input.companyId,
    "shopmonkey"
  );

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (!accountResult.data) {
    throw new Error("Shopmonkey is not configured for this company.");
  }

  if (accountResult.data.status !== "connected") {
    throw new Error("Verify the Shopmonkey connection before starting an import run.");
  }

  const runResult = await createDataImportRun(client, {
    companyId: input.companyId,
    sourceAccountId: accountResult.data.id,
    provider: "shopmonkey",
    startedByUserId: input.startedByUserId,
    optionsJson: buildInitialImportRunOptions()
  });

  if (runResult.error || !runResult.data) {
    throw runResult.error ?? new Error("Shopmonkey import run could not be created.");
  }

  return runResult.data;
}

export async function disconnectShopmonkeyMigrationSourceAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  const parsed = disconnectMigrationSourceAccountInputSchema.parse({
    companyId,
    provider: "shopmonkey"
  });
  const existingAccountResult = await getMigrationSourceAccountByProvider(
    client,
    parsed.companyId,
    parsed.provider
  );

  if (existingAccountResult.error) {
    throw existingAccountResult.error;
  }

  if (!existingAccountResult.data) {
    throw new Error("Shopmonkey is not configured for this company.");
  }

  const disconnectedAccountResult = await disconnectMigrationSourceAccount(
    client,
    parsed.companyId,
    parsed.provider
  );

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("Shopmonkey could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}
