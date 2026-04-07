import type { Json, TimestampFields, UUID } from "./common";

export const migrationSourceProviders = ["shopmonkey"] as const;
export type MigrationSourceProvider = (typeof migrationSourceProviders)[number];

export const migrationSourceAccountStatuses = [
  "connected",
  "action_required",
  "error",
  "disconnected"
] as const;
export type MigrationSourceAccountStatus =
  (typeof migrationSourceAccountStatuses)[number];

export interface MigrationSourceCapabilities {
  supportsCustomerImport: boolean;
  supportsVehicleImport: boolean;
  supportsOrderImport: boolean;
  supportsInspectionImport: boolean;
  supportsExportApi: boolean;
  supportsWebhooks: boolean;
}

export interface ShopmonkeyMigrationSourceSettings {
  apiKeyHint: string | null;
  lastWebhookId?: string | null | undefined;
  lastWebhookOperation?: string | null | undefined;
  lastWebhookReceivedAt?: string | null | undefined;
  lastWebhookTable?: string | null | undefined;
  webhookUrl?: string | null | undefined;
}

export interface MigrationSourceAccount extends TimestampFields {
  id: UUID;
  companyId: UUID;
  provider: MigrationSourceProvider;
  status: MigrationSourceAccountStatus;
  displayName: string;
  credentialHint: string | null;
  settingsJson: Json;
  capabilitiesJson: Json;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
}

export type UpsertMigrationSourceAccountInput = {
  companyId: UUID;
  provider: "shopmonkey";
  displayName: string;
  apiKey: string;
};

export interface VerifyMigrationSourceAccountInput {
  companyId: UUID;
  provider: MigrationSourceProvider;
}

export interface DisconnectMigrationSourceAccountInput {
  companyId: UUID;
  provider: MigrationSourceProvider;
}
