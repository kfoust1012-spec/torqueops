import {
  buildJobAttachmentStoragePath,
  JOB_ATTACHMENTS_BUCKET,
  normalizeAttachmentCaption
} from "@mobile-mechanic/core";
import type {
  Attachment,
  AttachmentListQuery,
  AttachmentMimeType,
  CreateAttachmentInput,
  Database,
  UpdateAttachmentInput
} from "@mobile-mechanic/types";
import {
  attachmentListQuerySchema,
  createAttachmentInputSchema,
  updateAttachmentInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type AttachmentResult = {
  data: Attachment | null;
  error: Error | null;
};
type AttachmentListResult = {
  data: Attachment[] | null;
  error: Error | null;
};
type AttachmentStorageUploadResult = {
  data: {
    fullPath?: string;
    path: string;
  } | null;
  error: Error | null;
};
type AttachmentStorageDeleteResult = {
  data: Array<{
    name: string;
  }> | null;
  error: Error | null;
};
type AttachmentSignedUrlResult = {
  data: {
    signedUrl: string;
  } | null;
  error: Error | null;
};
type AttachmentDeleteResult = {
  data: null;
  error: Error | null;
};

function mapAttachmentRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    inspectionId: row.inspection_id,
    inspectionItemId: row.inspection_item_id,
    uploadedByUserId: row.uploaded_by_user_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type as AttachmentMimeType,
    fileSizeBytes: row.file_size_bytes,
    category: row.category,
    caption: row.caption,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getAssignedActiveJob(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  return client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<JobRow>();
}

export async function createAttachmentRecord(
  client: AppSupabaseClient,
  input: CreateAttachmentInput
): Promise<AttachmentResult> {
  const parsed = createAttachmentInputSchema.parse(input);
  const storageBucket = JOB_ATTACHMENTS_BUCKET;
  const storagePath = buildJobAttachmentStoragePath({
    attachmentId: parsed.id,
    companyId: parsed.companyId,
    fileName: parsed.fileName,
    jobId: parsed.jobId
  });

  const result = await client
    .from("attachments")
    .insert({
      id: parsed.id,
      company_id: parsed.companyId,
      job_id: parsed.jobId,
      inspection_id: parsed.inspectionId ?? null,
      inspection_item_id: parsed.inspectionItemId ?? null,
      uploaded_by_user_id: parsed.uploadedByUserId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: parsed.fileName.trim(),
      mime_type: parsed.mimeType,
      file_size_bytes: parsed.fileSizeBytes,
      category: parsed.category,
      caption: normalizeAttachmentCaption(parsed.caption)
    })
    .select("*")
    .single<AttachmentRow>();

  return {
    ...result,
    data: result.data ? mapAttachmentRow(result.data) : null
  };
}

export async function updateAttachment(
  client: AppSupabaseClient,
  attachmentId: string,
  input: UpdateAttachmentInput
): Promise<AttachmentResult> {
  const parsed = updateAttachmentInputSchema.parse(input);
  const updates: Database["public"]["Tables"]["attachments"]["Update"] = {};

  if (parsed.category !== undefined) {
    updates.category = parsed.category;
  }

  if (parsed.caption !== undefined) {
    updates.caption = normalizeAttachmentCaption(parsed.caption);
  }

  const result = await client
    .from("attachments")
    .update(updates)
    .eq("id", attachmentId)
    .select("*")
    .single<AttachmentRow>();

  return {
    ...result,
    data: result.data ? mapAttachmentRow(result.data) : null
  };
}

export async function deleteAttachment(
  client: AppSupabaseClient,
  attachmentId: string
): Promise<AttachmentDeleteResult> {
  const attachmentResult = await getAttachmentById(client, attachmentId);

  if (attachmentResult.error || !attachmentResult.data) {
    return {
      data: null,
      error: attachmentResult.error
    };
  }

  const storageResult = await removeAttachmentFile(
    client,
    attachmentResult.data.storageBucket,
    attachmentResult.data.storagePath
  );

  if (storageResult.error) {
    return {
      data: null,
      error: storageResult.error
    };
  }

  const result = await client.from("attachments").delete().eq("id", attachmentId);

  return {
    data: null,
    error: result.error
  };
}

export async function getAttachmentById(
  client: AppSupabaseClient,
  attachmentId: string
): Promise<AttachmentResult> {
  const result = await client
    .from("attachments")
    .select("*")
    .eq("id", attachmentId)
    .single<AttachmentRow>();

  return {
    ...result,
    data: result.data ? mapAttachmentRow(result.data) : null
  };
}

export async function listAttachmentsByJob(
  client: AppSupabaseClient,
  jobId: string,
  query: AttachmentListQuery = {}
): Promise<AttachmentListResult> {
  const parsed = attachmentListQuerySchema.parse(query);
  let builder = client
    .from("attachments")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (parsed.inspectionId) {
    builder = builder.eq("inspection_id", parsed.inspectionId);
  }

  if (parsed.inspectionItemId) {
    builder = builder.eq("inspection_item_id", parsed.inspectionItemId);
  }

  if (parsed.category) {
    builder = builder.eq("category", parsed.category);
  }

  const result = await builder.returns<AttachmentRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapAttachmentRow) : null
  };
}

export async function uploadAttachmentFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string,
  file: Blob,
  mimeType: AttachmentMimeType
): Promise<AttachmentStorageUploadResult> {
  const result = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: false
  });

  return {
    data: result.data
      ? {
          fullPath: result.data.fullPath,
          path: result.data.path
        }
      : null,
    error: result.error
  };
}

export async function removeAttachmentFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string
): Promise<AttachmentStorageDeleteResult> {
  const result = await client.storage.from(bucket).remove([path]);

  return {
    data: result.data ? result.data.map((entry) => ({ name: entry.name })) : null,
    error: result.error
  };
}

export async function createAttachmentSignedUrl(
  client: AppSupabaseClient,
  attachment: Pick<Attachment, "storageBucket" | "storagePath">,
  expiresInSeconds = 3600
) : Promise<AttachmentSignedUrlResult> {
  const result = await client.storage
    .from(attachment.storageBucket)
    .createSignedUrl(attachment.storagePath, expiresInSeconds);

  return {
    data: result.data
      ? {
          signedUrl: result.data.signedUrl
        }
      : null,
    error: result.error
  };
}

export async function createAndUploadJobAttachment(
  client: AppSupabaseClient,
  file: Blob,
  input: CreateAttachmentInput
): Promise<AttachmentResult> {
  const recordResult = await createAttachmentRecord(client, input);

  if (recordResult.error || !recordResult.data) {
    return recordResult;
  }

  const uploadResult = await uploadAttachmentFile(
    client,
    recordResult.data.storageBucket,
    recordResult.data.storagePath,
    file,
    recordResult.data.mimeType
  );

  if (uploadResult.error) {
    await deleteAttachment(client, recordResult.data.id);

    return {
      data: null,
      error: uploadResult.error
    };
  }

  return getAttachmentById(client, recordResult.data.id);
}

export async function listAssignedJobAttachments(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string,
  query: AttachmentListQuery = {}
): Promise<AttachmentListResult> {
  const jobResult = await getAssignedActiveJob(client, companyId, technicianUserId, jobId);

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  return listAttachmentsByJob(client, jobId, query);
}

export async function createAssignedJobAttachment(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  file: Blob,
  input: CreateAttachmentInput
): Promise<AttachmentResult> {
  const jobResult = await getAssignedActiveJob(client, companyId, technicianUserId, input.jobId);

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  if (
    input.companyId !== companyId ||
    input.uploadedByUserId !== technicianUserId
  ) {
    throw new Error("Attachment input does not match the active technician context.");
  }

  return createAndUploadJobAttachment(client, file, input);
}

export async function updateAssignedJobAttachmentCaption(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  attachmentId: string,
  input: UpdateAttachmentInput
): Promise<AttachmentResult> {
  const attachmentResult = await getAttachmentById(client, attachmentId);

  if (attachmentResult.error || !attachmentResult.data) {
    return {
      ...attachmentResult,
      data: null
    };
  }

  const jobResult = await getAssignedActiveJob(
    client,
    companyId,
    technicianUserId,
    attachmentResult.data.jobId
  );

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  if (attachmentResult.data.uploadedByUserId !== technicianUserId) {
    throw new Error("Technicians can only edit their own attachment metadata.");
  }

  return updateAttachment(client, attachmentId, input);
}
