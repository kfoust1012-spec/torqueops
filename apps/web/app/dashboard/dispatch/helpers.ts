import type {
  CreateTechnicianAvailabilityBlockInput,
  DispatchBoardData,
  QuickAssignDispatchJobInput,
  QuickRescheduleDispatchJobInput
} from "@mobile-mechanic/types";

type DispatchSearchParams = {
  view?: string | string[];
  date?: string | string[];
  technicianUserId?: string | string[];
  includeUnscheduled?: string | string[];
};

type DispatchHrefState = {
  view: DispatchBoardData["view"];
  date: string;
  technicianUserId: string;
  includeUnscheduled: boolean;
};

export type DispatchPageState = DispatchHrefState;

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getBooleanSearchParam(value: string | string[] | undefined): boolean {
  const resolved = getSearchParam(value).trim();
  return resolved === "1" || resolved === "true";
}

export function getReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/dashboard/dispatch")) {
    return "/dashboard/dispatch";
  }

  return value;
}

export function resolveDispatchPageState(
  searchParams: DispatchSearchParams,
  fallbackDate: string
): DispatchPageState {
  const view = getSearchParam(searchParams.view).trim() === "week" ? "week" : "day";
  const requestedDate = getSearchParam(searchParams.date).trim();
  const date = isValidDateString(requestedDate) ? requestedDate : fallbackDate;
  const requestedTechnicianUserId = getSearchParam(searchParams.technicianUserId).trim();
  const technicianUserId = isValidUuid(requestedTechnicianUserId) ? requestedTechnicianUserId : "";
  const includeUnscheduled =
    searchParams.includeUnscheduled === undefined
      ? true
      : getBooleanSearchParam(searchParams.includeUnscheduled);

  return {
    view,
    date,
    technicianUserId,
    includeUnscheduled
  };
}

export function buildDispatchHref(
  current: DispatchHrefState,
  patch: Partial<DispatchHrefState>
): string {
  const params = new URLSearchParams();
  const nextView = patch.view ?? current.view;
  const nextDate = patch.date ?? current.date;
  const nextTechnicianUserId = patch.technicianUserId ?? current.technicianUserId;
  const nextIncludeUnscheduled = patch.includeUnscheduled ?? current.includeUnscheduled;

  params.set("view", nextView);
  params.set("date", nextDate);

  if (nextTechnicianUserId) {
    params.set("technicianUserId", nextTechnicianUserId);
  }

  if (nextIncludeUnscheduled) {
    params.set("includeUnscheduled", "1");
  }

  return `/dashboard/dispatch?${params.toString()}`;
}

export function parseQuickAssignFormData(formData: FormData): {
  jobId: string;
  input: QuickAssignDispatchJobInput;
  returnTo: string;
} {
  return {
    jobId: getRequiredString(formData, "jobId"),
    input: {
      assignedTechnicianUserId: getNullableString(formData, "assignedTechnicianUserId")
    },
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}

export function parseQuickRescheduleFormData(formData: FormData): {
  jobId: string;
  input: QuickRescheduleDispatchJobInput;
  returnTo: string;
} {
  return {
    jobId: getRequiredString(formData, "jobId"),
    input: {
      scheduledStartAt: getRequiredString(formData, "scheduledStartAt"),
      scheduledEndAt: getNullableString(formData, "scheduledEndAt")
    },
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}

export function parseCreateAvailabilityBlockFormData(
  formData: FormData,
  companyId: string,
  createdByUserId: string
): {
  input: CreateTechnicianAvailabilityBlockInput;
  returnTo: string;
} {
  return {
    input: {
      companyId,
      technicianUserId: getRequiredString(formData, "technicianUserId"),
      blockType: getRequiredString(formData, "blockType") as
        | "unavailable"
        | "time_off"
        | "break"
        | "training",
      title: getRequiredString(formData, "title"),
      startsAt: getRequiredString(formData, "startsAt"),
      endsAt: getRequiredString(formData, "endsAt"),
      isAllDay: formData.get("isAllDay") === "on",
      notes: getNullableString(formData, "notes"),
      createdByUserId
    },
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}

export function parseDeleteAvailabilityBlockFormData(formData: FormData): {
  blockId: string;
  returnTo: string;
} {
  return {
    blockId: getRequiredString(formData, "blockId"),
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}

export function parseSendAppointmentConfirmationFormData(formData: FormData): {
  jobId: string;
  returnTo: string;
} {
  return {
    jobId: getRequiredString(formData, "jobId"),
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}

export function parseSendDispatchUpdateFormData(formData: FormData): {
  jobId: string;
  updateType: "dispatched" | "en_route";
  returnTo: string;
} {
  return {
    jobId: getRequiredString(formData, "jobId"),
    updateType: getRequiredString(formData, "updateType") === "en_route" ? "en_route" : "dispatched",
    returnTo: getReturnTo(getNullableString(formData, "returnTo"))
  };
}