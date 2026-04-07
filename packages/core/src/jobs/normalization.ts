import type {
  CreateJobInput,
  CreateJobNoteInput,
  JobStatus,
  UpdateJobInput,
  UpdateJobNoteInput
} from "@mobile-mechanic/types";

import { normalizeOptionalText } from "../customers/normalization";

export function normalizeJobDateTime(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  return new Date(normalized).toISOString();
}

export function getInitialJobStatus(
  input: Pick<CreateJobInput, "scheduledStartAt" | "arrivalWindowStartAt">
): JobStatus {
  return input.scheduledStartAt || input.arrivalWindowStartAt ? "scheduled" : "new";
}

export function normalizeJobInput(input: CreateJobInput): {
  companyId: string;
  customerId: string;
  vehicleId: string;
  serviceSiteId: string | null;
  title: string;
  description: string | null;
  customerConcern: string | null;
  internalSummary: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  assignedTechnicianUserId: string | null;
  priority: CreateJobInput["priority"];
  source: CreateJobInput["source"];
  isActive: CreateJobInput["isActive"];
  createdByUserId: string;
};
export function normalizeJobInput(input: UpdateJobInput): {
  customerId: string;
  vehicleId: string;
  serviceSiteId: string | null;
  title: string;
  description: string | null;
  customerConcern: string | null;
  internalSummary: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  assignedTechnicianUserId: string | null;
  priority: UpdateJobInput["priority"];
  source: UpdateJobInput["source"];
  isActive: UpdateJobInput["isActive"];
};
export function normalizeJobInput(input: CreateJobInput | UpdateJobInput) {
  return {
    ...input,
    serviceSiteId: input.serviceSiteId ?? null,
    title: input.title.trim(),
    description: normalizeOptionalText(input.description),
    customerConcern: normalizeOptionalText(input.customerConcern),
    internalSummary: normalizeOptionalText(input.internalSummary),
    scheduledStartAt: normalizeJobDateTime(input.scheduledStartAt),
    scheduledEndAt: normalizeJobDateTime(input.scheduledEndAt),
    arrivalWindowStartAt: normalizeJobDateTime(input.arrivalWindowStartAt),
    arrivalWindowEndAt: normalizeJobDateTime(input.arrivalWindowEndAt),
    assignedTechnicianUserId: input.assignedTechnicianUserId ?? null
  };
}

export function normalizeJobNoteInput(input: CreateJobNoteInput): {
  jobId: string;
  companyId: string;
  authorUserId: string;
  body: string;
  isInternal: CreateJobNoteInput["isInternal"];
};
export function normalizeJobNoteInput(input: UpdateJobNoteInput): {
  body: string;
  isInternal: UpdateJobNoteInput["isInternal"];
};
export function normalizeJobNoteInput(input: CreateJobNoteInput | UpdateJobNoteInput) {
  return {
    ...input,
    body: input.body.trim()
  };
}
