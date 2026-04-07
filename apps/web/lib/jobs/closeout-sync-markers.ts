export type TechnicianJobCloseoutSyncMarker = {
  hasPendingAttachmentSync: boolean;
  hasPendingCloseoutSync: boolean;
  hasPendingInspectionSync: boolean;
  jobId: string;
  technicianUserId: string;
  updatedAt: string;
};

function mapTechnicianJobCloseoutSyncMarker(row: {
  has_pending_attachment_sync: boolean;
  has_pending_closeout_sync: boolean;
  has_pending_inspection_sync: boolean;
  job_id: string;
  technician_user_id: string;
  updated_at: string;
}) {
  return {
    hasPendingAttachmentSync: row.has_pending_attachment_sync,
    hasPendingCloseoutSync: row.has_pending_closeout_sync,
    hasPendingInspectionSync: row.has_pending_inspection_sync,
    jobId: row.job_id,
    technicianUserId: row.technician_user_id,
    updatedAt: row.updated_at
  } satisfies TechnicianJobCloseoutSyncMarker;
}

export async function upsertTechnicianJobCloseoutSyncMarker(input: {
  companyId: string;
  hasPendingAttachmentSync: boolean;
  hasPendingInspectionSync: boolean;
  jobId: string;
  supabase: any;
  technicianUserId: string;
}) {
  const hasPendingCloseoutSync =
    input.hasPendingInspectionSync || input.hasPendingAttachmentSync;
  const result = await input.supabase
    .from("technician_job_closeout_sync_markers")
    .upsert(
      {
        company_id: input.companyId,
        has_pending_attachment_sync: input.hasPendingAttachmentSync,
        has_pending_closeout_sync: hasPendingCloseoutSync,
        has_pending_inspection_sync: input.hasPendingInspectionSync,
        job_id: input.jobId,
        technician_user_id: input.technicianUserId,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "company_id,job_id,technician_user_id"
      }
    )
    .select(
      "job_id, technician_user_id, has_pending_inspection_sync, has_pending_attachment_sync, has_pending_closeout_sync, updated_at"
    )
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Closeout sync marker could not be stored.");
  }

  return mapTechnicianJobCloseoutSyncMarker(result.data);
}

export async function getTechnicianJobCloseoutSyncMarker(input: {
  jobId: string;
  supabase: any;
  technicianUserId: string | null;
}) {
  if (!input.technicianUserId) {
    return null;
  }

  const result = await input.supabase
    .from("technician_job_closeout_sync_markers")
    .select(
      "job_id, technician_user_id, has_pending_inspection_sync, has_pending_attachment_sync, has_pending_closeout_sync, updated_at"
    )
    .eq("job_id", input.jobId)
    .eq("technician_user_id", input.technicianUserId)
    .maybeSingle();

  if (result.error || !result.data) {
    return null;
  }

  return mapTechnicianJobCloseoutSyncMarker(result.data);
}
