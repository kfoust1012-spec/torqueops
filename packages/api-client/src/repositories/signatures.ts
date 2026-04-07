import {
  buildEstimateSignatureStoragePath,
  canEstimateBeApproved,
  canTransitionJobStatus,
  ESTIMATE_SIGNATURES_BUCKET,
  getJobWorkflowAutomationReason,
  normalizeApprovalStatement,
  normalizeSignerName,
  resolveJobWorkflowAutomationTarget
} from "@mobile-mechanic/core";
import type {
  ApproveEstimateInput,
  Database,
  Signature,
  SignatureMimeType
} from "@mobile-mechanic/types";
import { approveEstimateInputSchema } from "@mobile-mechanic/validation";
import type { AppSupabaseClient } from "../supabase/types";
import { changeJobStatus, getJobById } from "./jobs";

type SignatureRow = Database["public"]["Tables"]["signatures"]["Row"];
type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type SignatureResult = {
  data: Signature | null;
  error: Error | null;
};
type SignatureSignedUrlResult = {
  data: {
    signedUrl: string;
  } | null;
  error: Error | null;
};
type SignatureStorageUploadResult = {
  data: {
    fullPath?: string;
    path: string;
  } | null;
  error: Error | null;
};
type SignatureFilePayload = Blob | Uint8Array | ArrayBuffer;
type SignatureStorageDeleteResult = {
  data: Array<{
    name: string;
  }> | null;
  error: Error | null;
};

function mapEstimateRow(row: EstimateRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    status: row.status,
    estimateNumber: row.estimate_number,
    title: row.title,
    notes: row.notes,
    terms: row.terms,
    currencyCode: row.currency_code,
    taxRateBasisPoints: row.tax_rate_basis_points,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    voidedAt: row.voided_at,
    approvedSignatureId: row.approved_signature_id,
    approvedByName: row.approved_by_name,
    approvalStatement: row.approval_statement,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSignatureRow(row: SignatureRow): Signature {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    signedByName: row.signed_by_name,
    statement: row.statement,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type as SignatureMimeType,
    fileSizeBytes: row.file_size_bytes,
    capturedByUserId: row.captured_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createSignatureRecord(
  client: AppSupabaseClient,
  input: ApproveEstimateInput
): Promise<SignatureResult> {
  const parsed = approveEstimateInputSchema.parse(input);
  const storagePath = buildEstimateSignatureStoragePath({
    companyId: parsed.companyId,
    estimateId: parsed.estimateId,
    jobId: parsed.jobId,
    signatureId: parsed.signatureId
  });

  const result = await client
    .from("signatures")
    .insert({
      id: parsed.signatureId,
      company_id: parsed.companyId,
      job_id: parsed.jobId,
      estimate_id: parsed.estimateId,
      signed_by_name: normalizeSignerName(parsed.signedByName),
      statement: normalizeApprovalStatement(parsed.statement),
      storage_bucket: ESTIMATE_SIGNATURES_BUCKET,
      storage_path: storagePath,
      mime_type: parsed.mimeType,
      file_size_bytes: parsed.fileSizeBytes,
      captured_by_user_id: parsed.capturedByUserId ?? null
    })
    .select("*")
    .single<SignatureRow>();

  return {
    ...result,
    data: result.data ? mapSignatureRow(result.data) : null
  };
}

export async function getSignatureById(
  client: AppSupabaseClient,
  signatureId: string
): Promise<SignatureResult> {
  const result = await client
    .from("signatures")
    .select("*")
    .eq("id", signatureId)
    .single<SignatureRow>();

  return {
    ...result,
    data: result.data ? mapSignatureRow(result.data) : null
  };
}

export async function getSignatureByEstimateId(
  client: AppSupabaseClient,
  estimateId: string
): Promise<SignatureResult> {
  const result = await client
    .from("signatures")
    .select("*")
    .eq("estimate_id", estimateId)
    .maybeSingle<SignatureRow>();

  return {
    ...result,
    data: result.data ? mapSignatureRow(result.data) : null
  };
}

export async function uploadEstimateSignatureFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string,
  file: SignatureFilePayload,
  mimeType: SignatureMimeType
): Promise<SignatureStorageUploadResult> {
  const result = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: false
  });

  return {
    data: result.data,
    error: result.error
  };
}

export async function removeEstimateSignatureFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string
): Promise<SignatureStorageDeleteResult> {
  const result = await client.storage.from(bucket).remove([path]);

  return {
    data: result.data ? result.data.map((entry) => ({ name: entry.name })) : null,
    error: result.error
  };
}

export async function createEstimateSignatureSignedUrl(
  client: AppSupabaseClient,
  signature: Pick<Signature, "storageBucket" | "storagePath">,
  expiresInSeconds = 3600
): Promise<SignatureSignedUrlResult> {
  const result = await client.storage
    .from(signature.storageBucket)
    .createSignedUrl(signature.storagePath, expiresInSeconds);

  return {
    data: result.data ? { signedUrl: result.data.signedUrl } : null,
    error: result.error
  };
}

export async function approveEstimateWithSignature(
  client: AppSupabaseClient,
  signatureFile: SignatureFilePayload,
  input: ApproveEstimateInput
) {
  const parsed = approveEstimateInputSchema.parse(input);
  const estimateResult = await client
    .from("estimates")
    .select("*")
    .eq("id", parsed.estimateId)
    .single<EstimateRow>();

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  if (
    estimateResult.data.company_id !== parsed.companyId ||
    estimateResult.data.job_id !== parsed.jobId
  ) {
    throw new Error("Approval input does not match the estimate company or job.");
  }

  if (!canEstimateBeApproved(estimateResult.data.status)) {
    throw new Error("Only sent estimates can be approved.");
  }

  const signatureResult = await createSignatureRecord(client, parsed);

  if (signatureResult.error || !signatureResult.data) {
    return {
      ...signatureResult,
      data: null
    };
  }

  const uploadResult = await uploadEstimateSignatureFile(
    client,
    signatureResult.data.storageBucket,
    signatureResult.data.storagePath,
    signatureFile,
    signatureResult.data.mimeType
  );

  if (uploadResult.error) {
    await client.from("signatures").delete().eq("id", signatureResult.data.id);

    return {
      data: null,
      error: uploadResult.error
    };
  }

  const estimateUpdateResult = await client
    .from("estimates")
    .update({
      status: "accepted",
      approved_signature_id: signatureResult.data.id,
      approved_by_name: signatureResult.data.signedByName,
      approval_statement: signatureResult.data.statement
    })
    .eq("id", parsed.estimateId)
    .select("*")
    .single<Database["public"]["Tables"]["estimates"]["Row"]>();

  if (estimateUpdateResult.error || !estimateUpdateResult.data) {
    const rollbackStorageResult = await removeEstimateSignatureFile(
      client,
      signatureResult.data.storageBucket,
      signatureResult.data.storagePath
    );

    if (rollbackStorageResult.error) {
      return {
        data: null,
        error: new Error(
          `Estimate approval failed and signature storage cleanup could not be completed: ${rollbackStorageResult.error.message}`
        )
      };
    }

    const rollbackRowResult = await client
      .from("signatures")
      .delete()
      .eq("id", signatureResult.data.id);

    if (rollbackRowResult.error) {
      return {
        data: null,
        error: new Error(
          `Estimate approval failed and signature metadata cleanup could not be completed: ${rollbackRowResult.error.message}`
        )
      };
    }

    return {
      data: null,
      error: estimateUpdateResult.error
    };
  }

  const jobResult = await getJobById(client, parsed.jobId);

  if (!jobResult.error && jobResult.data) {
    const targetStatus = resolveJobWorkflowAutomationTarget({
      currentStatus: jobResult.data.status,
      signal: { kind: "estimate_approved" }
    });

    if (targetStatus && canTransitionJobStatus(jobResult.data.status, targetStatus)) {
      await changeJobStatus(client, parsed.jobId, {
        reason: getJobWorkflowAutomationReason({
          signal: { kind: "estimate_approved" },
          targetStatus
        }),
        toStatus: targetStatus
      }).catch(() => undefined);
    }
  }

  return {
    ...estimateUpdateResult,
    data: estimateUpdateResult.data ? mapEstimateRow(estimateUpdateResult.data) : null
  };
}

export async function approveAssignedJobEstimate(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string,
  signatureFile: SignatureFilePayload,
  input: Omit<ApproveEstimateInput, "capturedByUserId" | "companyId" | "estimateId" | "jobId">
) {
  const estimateResult = await client
    .from("estimates")
    .select("*")
    .eq("job_id", jobId)
    .eq("company_id", companyId)
    .single<Database["public"]["Tables"]["estimates"]["Row"]>();

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  const jobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<Database["public"]["Tables"]["jobs"]["Row"]>();

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  return approveEstimateWithSignature(client, signatureFile, {
    ...input,
    capturedByUserId: technicianUserId,
    companyId,
    estimateId: estimateResult.data.id,
    jobId
  });
}
