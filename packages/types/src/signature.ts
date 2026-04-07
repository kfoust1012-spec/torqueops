import type { TimestampFields, UUID } from "./common";

export const signatureMimeTypes = ["image/png"] as const;

export type SignatureMimeType = (typeof signatureMimeTypes)[number];

export const maxSignatureFileSizeBytes = 2 * 1024 * 1024;

export interface Signature extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID;
  signedByName: string;
  statement: string;
  storageBucket: string;
  storagePath: string;
  mimeType: SignatureMimeType;
  fileSizeBytes: number;
  capturedByUserId: UUID | null;
}

export interface EstimateApproval {
  signatureId: UUID;
  approvedByName: string;
  approvalStatement: string;
  approvedAt: string;
}

export interface ApproveEstimateInput {
  signatureId: UUID;
  estimateId: UUID;
  companyId: UUID;
  jobId: UUID;
  signedByName: string;
  statement: string;
  capturedByUserId?: UUID | null | undefined;
  mimeType: SignatureMimeType;
  fileSizeBytes: number;
}
