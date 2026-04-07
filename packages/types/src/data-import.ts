import type { Json, TimestampFields, UUID } from "./common";
import type { MigrationSourceProvider } from "./migration-source";

export const dataImportRunStatuses = [
  "queued",
  "processing",
  "paused",
  "completed",
  "failed",
  "canceled"
] as const;
export type DataImportRunStatus = (typeof dataImportRunStatuses)[number];

export const dataImportEntityTypes = [
  "customer",
  "customer_address",
  "vehicle",
  "order",
  "estimate",
  "invoice",
  "inspection",
  "attachment"
] as const;
export type DataImportEntityType = (typeof dataImportEntityTypes)[number];

export const dataImportCheckpointStatuses = [
  "pending",
  "processing",
  "completed",
  "failed"
] as const;
export type DataImportCheckpointStatus =
  (typeof dataImportCheckpointStatuses)[number];

export interface DataImportRun extends TimestampFields {
  id: UUID;
  companyId: UUID;
  sourceAccountId: UUID;
  provider: MigrationSourceProvider;
  status: DataImportRunStatus;
  startedByUserId: UUID;
  optionsJson: Json;
  summaryJson: Json;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  lastErrorMessage: string | null;
}

export interface CreateDataImportRunInput {
  companyId: UUID;
  sourceAccountId: UUID;
  provider: MigrationSourceProvider;
  startedByUserId: UUID;
  optionsJson?: Json;
}

export interface ExternalRecordMapping extends TimestampFields {
  id: UUID;
  companyId: UUID;
  provider: MigrationSourceProvider;
  entityType: DataImportEntityType;
  externalId: string;
  internalTable: string;
  internalId: UUID;
  payloadHash: string;
  sourceUpdatedAt: string | null;
  lastImportRunId: UUID | null;
}

export interface DataImportCheckpoint extends TimestampFields {
  id: UUID;
  runId: UUID;
  companyId: UUID;
  entityType: DataImportEntityType;
  status: DataImportCheckpointStatus;
  cursorJson: Json;
  processedCount: number;
  failedCount: number;
  lastErrorMessage: string | null;
}
